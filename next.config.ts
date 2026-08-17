import type { NextConfig } from "next";

/**
 * Security header baseline. HSTS is added by Vercel; everything else is on us.
 *
 * `script-src` carries 'unsafe-inline' because the theme is stamped by a
 * parser-blocking inline script before first paint, and Next's App Router
 * emits its own inline bootstrap — a nonce-based policy would require
 * middleware on every request and would defeat static prerendering. The app
 * loads no third-party script, renders no user-generated HTML and talks to no
 * origin but itself, so the residual XSS surface is close to nil.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Nothing here needs a camera, a microphone or a location.
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  /**
   * Build stamp, surfaced in the settings sheet.
   *
   * Working out whether a phone was running the latest deploy meant comparing
   * pixels against a known screenshot, which is slow and easy to get wrong.
   * Vercel sets VERCEL_GIT_COMMIT_SHA at build time; inlining it here makes the
   * running build identifiable from the device in two taps.
   */
  env: {
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7),
    NEXT_PUBLIC_BUILD_AT: new Date().toISOString().slice(0, 16).replace("T", " "),
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
