import "server-only";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { env } from "./env";

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const e = env();
  const storageBucket = e.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (e.FIREBASE_ADMIN_CLIENT_EMAIL && e.FIREBASE_ADMIN_PRIVATE_KEY) {
    return initializeApp({
      credential: cert({
        projectId: e.FIREBASE_ADMIN_PROJECT_ID ?? e.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: e.FIREBASE_ADMIN_CLIENT_EMAIL,
        // Private keys pasted into env files carry literal "\n" sequences.
        privateKey: e.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      storageBucket,
    });
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
