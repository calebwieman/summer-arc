import html from "./plan-html";

/**
 * GET /plan — the semester master plan, behind the same edge gate as the app.
 *
 * A route handler rather than a page: the document is complete, hand-built
 * HTML (own styles, own script), and wrapping it in the app shell would fight
 * both layouts. Static — the content only changes with a deploy.
 */
export function GET() {
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
