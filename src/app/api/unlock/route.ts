import { AUTH_COOKIE, AUTH_MAX_AGE, safeEqual, sessionToken } from "@/lib/auth";

/** Deliberately slow down guessing without making a correct entry feel laggy. */
const FAIL_DELAY_MS = 400;

export async function POST(req: Request) {
  const expected = process.env.STANDARD_PASSWORD;
  if (!expected) {
    return Response.json({ ok: false, reason: "unconfigured" }, { status: 500 });
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    if (typeof body.password === "string") password = body.password;
  } catch {
    /* fall through to the failure path */
  }

  if (!safeEqual(password, expected)) {
    await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
    return Response.json({ ok: false }, { status: 401 });
  }

  // Secure is omitted on plain http so a local dev server can still sign in.
  const https =
    req.headers.get("x-forwarded-proto") === "https" ||
    new URL(req.url).protocol === "https:";

  const cookie = [
    `${AUTH_COOKIE}=${await sessionToken(expected)}`,
    "Path=/",
    `Max-Age=${AUTH_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
    https ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
}
