/**
 * Shared between the edge middleware and the unlock route, so both must stay
 * on Web Crypto only — no Node built-ins.
 *
 * The password itself never reaches the browser. What the browser holds is a
 * digest of it, in an httpOnly cookie the page's own JavaScript cannot read.
 */

export const AUTH_COOKIE = "standard_auth";

/** Rotating this invalidates every existing session at once. */
const SALT = "::standard-v1";

/** One year — this is a sign-in you do once per device. */
export const AUTH_MAX_AGE = 60 * 60 * 24 * 365;

export async function sessionToken(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password + SALT);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Length-independent, branch-free compare so failures leak no timing signal. */
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Paths that must stay reachable while signed out. */
export const PUBLIC_PATHS = new Set([
  "/login",
  "/api/unlock",
  // Which build is live is not a secret, and gating it would mean signing in
  // before you can find out whether the sign-in screen is even current.
  "/version",
  // The PWA needs these before sign-in or it cannot install or show its icon.
  "/manifest.json",
  "/sw.js",
  "/favicon.svg",
  "/favicon-32.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
]);
