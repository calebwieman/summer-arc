import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, PUBLIC_PATHS, safeEqual, sessionToken } from "@/lib/auth";

/**
 * Edge gate. Every request for the app is checked here, before any page is
 * served, so the password check cannot be skipped by reading the bundle or
 * poking at localStorage the way a client-side gate can.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/fonts")) {
    return NextResponse.next();
  }

  const password = process.env.STANDARD_PASSWORD;
  // Not configured (a local checkout with no .env.local) — stay open rather
  // than lock the owner out of their own dev server.
  if (!password) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (token && safeEqual(token, await sessionToken(password))) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Static assets and the image optimiser are served without a check; the
  // bundle contains no secrets and gating them breaks the login page itself.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
