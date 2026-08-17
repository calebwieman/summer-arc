/**
 * What is actually deployed, in plain text, behind no gate.
 *
 * Answering "is this build live yet" has meant signing in, opening the
 * settings sheet and scrolling — and when the answer is "no", every one of
 * those steps is happening against the wrong build anyway. This is one URL,
 * openable from any browser:
 *
 *   404       -> the deployment predates this route entirely
 *   a SHA     -> exactly which commit is serving
 *
 * Read at request time rather than inlined at build time so it reports the
 * running deployment even if a stale bundle were somehow cached in front.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? "local-dev";
  const ref = process.env.VERCEL_GIT_COMMIT_REF ?? "unknown-branch";
  const env = process.env.VERCEL_ENV ?? "local";

  return new Response(
    [`commit: ${sha.slice(0, 7)}`, `branch: ${ref}`, `env:    ${env}`].join("\n") +
      "\n",
    {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        // Never let a CDN answer this from cache; that would defeat the point.
        "cache-control": "no-store, max-age=0",
      },
    },
  );
}
