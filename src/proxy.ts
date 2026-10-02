import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "is_session";

/**
 * Optimistic gate only: it checks that a session cookie exists so signed-out visitors are redirected early.
 * The cookie is cryptographically verified on the server in every layout and route handler.
 */
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE);
  const { pathname } = req.nextUrl;
  if (pathname === "/login") {
    return hasSession ? NextResponse.redirect(new URL("/dashboard", req.url)) : NextResponse.next();
  }
  if (!hasSession) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|samples|.*\\.(?:png|jpg|svg|ico|webp|pdf)$).*)"],
};
