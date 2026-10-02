import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError } from "./api";
import { adminAuth } from "./firebase-admin";

export const SESSION_COOKIE = "is_session";
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  uid: string;
  email: string;
  name: string;
}

async function readSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const d = await adminAuth().verifySessionCookie(token, true);
    const email = d.email ?? "";
    return { uid: d.uid, email, name: (d.name as string | undefined) ?? (email.split("@")[0] || "Reviewer") };
  } catch {
    return null;
  }
}

/** Per-request memoised session lookup for Server Components. */
export const getSessionUser = cache(readSession);

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** For route handlers: verifies the session and, for state-changing requests, the request origin. */
export async function requireApiUser(req: Request): Promise<SessionUser> {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const host = (await headers()).get("host");
    if (origin && host && new URL(origin).host !== host) throw new ApiError("forbidden_origin", "Cross-origin request blocked.", 403);
  }
  const user = await getSessionUser();
  if (!user) throw new ApiError("unauthenticated", "Please sign in to continue.", 401);
  return user;
}
