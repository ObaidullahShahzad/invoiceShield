import "server-only";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { env } from "./env";

interface ServiceAccount {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
}

/** Accept a private key however it was pasted (quoted, with literal "\n", with real newlines, or base64-encoded). */
function normalizeKey(raw: string): string {
  let k = raw.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
  if (!k.includes("BEGIN") && /^[A-Za-z0-9+/=\s]+$/.test(k)) k = Buffer.from(k, "base64").toString("utf8");
  return k;
}

/** Credentials from FIREBASE_SERVICE_ACCOUNT (whole JSON, raw or base64) or the three FIREBASE_ADMIN_* variables. */
function serviceAccount(): ServiceAccount | null {
  const e = env();
  const json = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (json) {
    const text = json.startsWith("{") ? json : Buffer.from(json, "base64").toString("utf8");
    const sa = JSON.parse(text) as { project_id?: string; client_email?: string; private_key?: string };
    return { projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key && normalizeKey(sa.private_key) };
  }
  if (e.FIREBASE_ADMIN_CLIENT_EMAIL && e.FIREBASE_ADMIN_PRIVATE_KEY) {
    return {
      projectId: e.FIREBASE_ADMIN_PROJECT_ID ?? e.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: e.FIREBASE_ADMIN_CLIENT_EMAIL.trim().replace(/^["']|["']$/g, ""),
      privateKey: normalizeKey(e.FIREBASE_ADMIN_PRIVATE_KEY),
    };
  }
  return null;
}

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const e = env();
  const storageBucket = e.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const sa = serviceAccount();
  if (sa) return initializeApp({ credential: cert(sa), projectId: sa.projectId, storageBucket });
  if (process.env.VERCEL) {
    // Application-default credentials do not exist on Vercel; fail with a message that shows up in the logs.
    throw new Error("Firebase Admin is not configured: set FIREBASE_SERVICE_ACCOUNT, or FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY, in the Vercel project settings.");
  }
  return initializeApp({ credential: applicationDefault(), projectId: e.NEXT_PUBLIC_FIREBASE_PROJECT_ID, storageBucket });
}

export const adminAuth = () => getAuth(app());
export const adminBucket = () => getStorage(app()).bucket();

const g = globalThis as unknown as { __isDb?: Firestore };
export function db(): Firestore {
  if (!g.__isDb) {
    g.__isDb = getFirestore(app());
    g.__isDb.settings({ ignoreUndefinedProperties: true });
  }
  return g.__isDb;
}
