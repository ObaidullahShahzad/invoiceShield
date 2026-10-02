import "server-only";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import { env } from "./env";
import { adminBucket, db } from "./firebase-admin";

/**
 * Where uploaded invoice files live.
 * - firestore (default): files are split into <1 MiB chunks stored as Bytes fields. Works on the free Spark plan and on
 *   serverless hosts such as Vercel, and is covered by the same deny-all rules as the rest of the data.
 * - firebase: Cloud Storage bucket (needs the Blaze plan on new projects). Preferable for large volumes.
 * - local: ./.data/uploads on disk. Development only — serverless filesystems are read-only/ephemeral.
 */

// Firestore caps a document at 1 MiB and a commit at 10 MiB; stay well under both.
const CHUNK_BYTES = 900 * 1024;
const CHUNKS_PER_BATCH = 8;

const fileDoc = (storagePath: string) => db().collection("files").doc(createHash("sha256").update(storagePath).digest("hex"));
const chunkId = (i: number) => String(i).padStart(4, "0");

const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");

function localPath(p: string) {
  const full = path.resolve(LOCAL_ROOT, p);
  if (!full.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Invalid storage path");
  return full;
}

export async function putFile(storagePath: string, data: Buffer, contentType: string): Promise<void> {
  const driver = env().STORAGE_DRIVER;
  if (driver === "firestore") {
    const ref = fileDoc(storagePath);
    const count = Math.max(1, Math.ceil(data.length / CHUNK_BYTES));
    for (let start = 0; start < count; start += CHUNKS_PER_BATCH) {
      const batch = db().batch();
      for (let i = start; i < Math.min(count, start + CHUNKS_PER_BATCH); i++) {
        batch.set(ref.collection("chunks").doc(chunkId(i)), { data: data.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES) });
      }
      await batch.commit();
    }
    // The manifest is written last, so a partially written file is never readable.
    await ref.set({ path: storagePath, contentType, size: data.length, chunkCount: count, createdAt: FieldValue.serverTimestamp() });
    return;
  }
  if (driver === "local") {
    if (process.env.VERCEL) throw new Error("STORAGE_DRIVER=local cannot be used on Vercel; use firestore.");
    const full = localPath(storagePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return;
  }
  await adminBucket().file(storagePath).save(data, { contentType, resumable: false, metadata: { cacheControl: "private, max-age=0" } });
}

export async function getFile(storagePath: string): Promise<Buffer> {
  const driver = env().STORAGE_DRIVER;
  if (driver === "firestore") {
    const ref = fileDoc(storagePath);
    const manifest = await ref.get();
    if (!manifest.exists) throw new Error("File not found");
    const { chunkCount, size } = manifest.data() as { chunkCount: number; size: number };
    const chunks = await ref.collection("chunks").orderBy("__name__").get();
    if (chunks.size !== chunkCount) throw new Error("File is incomplete");
    const buf = Buffer.concat(chunks.docs.map((d) => Buffer.from(d.get("data") as Uint8Array)));
    if (buf.length !== size) throw new Error("File size mismatch");
    return buf;
  }
  if (driver === "local") return fs.readFile(localPath(storagePath));
  const [buf] = await adminBucket().file(storagePath).download();
  return buf;
}
