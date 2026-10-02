import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const ok = <T,>(data: T, status = 200) => NextResponse.json({ data, error: null }, { status });

export function fail(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ data: null, error: { code, message, details } }, { status });
}

/** Wrap a route handler: consistent envelope, no stack traces or secrets leaked to the browser. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) return fail(err.code, err.message, err.status, err.details);
      if (err instanceof ZodError) {
        return fail("validation_failed", "The request was not valid.", 422, err.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
      }
      console.error("[api] unhandled error", err instanceof Error ? err.message : err);
      return fail("internal_error", "Something went wrong. Please try again.", 500);
    }
  };
}
