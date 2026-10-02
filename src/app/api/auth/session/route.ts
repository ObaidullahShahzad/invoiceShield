import { cookies } from "next/headers";
import { z } from "zod";
import { ApiError, handle, ok } from "@/lib/server/api";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/server/auth";
import { adminAuth } from "@/lib/server/firebase-admin";
import { upsertUser } from "@/lib/server/repo";

export const runtime = "nodejs";

const body = z.object({ idToken: z.string().min(20) });

export const POST = handle(async (req: Request) => {
  const { idToken } = body.parse(await req.json());
  const decoded = await adminAuth()
    .verifyIdToken(idToken)
    .catch(() => {
      throw new ApiError("unauthenticated", "Sign-in could not be verified.", 401);
    });
  // Only exchange recently issued tokens for a session cookie.
  if (Date.now() / 1000 - decoded.auth_time > 5 * 60) throw new ApiError("unauthenticated", "Please sign in again.", 401);
  const sessionCookie = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  (await cookies()).set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
  const email = decoded.email ?? "";
  await upsertUser({ uid: decoded.uid, email, name: (decoded.name as string | undefined) ?? (email.split("@")[0] || "Reviewer") });
  return ok({ signedIn: true });
});

export const DELETE = handle(async () => {
  (await cookies()).delete(SESSION_COOKIE);
  return ok({ signedIn: false });
});
