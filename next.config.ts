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
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
