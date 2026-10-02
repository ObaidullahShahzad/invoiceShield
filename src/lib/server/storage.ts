import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "./env";
import { adminBucket } from "./firebase-admin";

const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");

function localPath(p: string) {
  const full = path.resolve(LOCAL_ROOT, p);
  if (!full.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Invalid storage path");
  return full;
}

export async function putFile(storagePath: string, data: Buffer, contentType: string): Promise<void> {
  if (env().STORAGE_DRIVER === "local") {
    const full = localPath(storagePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return;
  }
  await adminBucket().file(storagePath).save(data, { contentType, resumable: false, metadata: { cacheControl: "private, max-age=0" } });
}

export async function getFile(storagePath: string): Promise<Buffer> {
  if (env().STORAGE_DRIVER === "local") return fs.readFile(localPath(storagePath));
  const [buf] = await adminBucket().file(storagePath).download();
  return buf;
}
