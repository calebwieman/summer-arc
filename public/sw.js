// Standard service worker
// Strategy:
//  - Navigation (HTML routes): network-first, fall back to cache, then "/"
//  - Static assets (same-origin GET): stale-while-revalidate
//  - Bump CACHE_NAME to force-refresh clients
// Bump on every asset change — activate deletes all other caches, which is the
// only way an already-installed PWA lets go of stale icons and routes.
// v5 dropped the old Summer entries; v6 ships the new mark.
// v8 ships the mobile layout repair — an installed PWA holding the cached "/"
// shell would otherwise keep serving the overlapping layout.
// v31: the Gym shipped (v1+v2) without a bump — an offline fallback could
// still serve the pre-gym shell. This purge retires it everywhere.
const CACHE_NAME = "standard-cache-v31";
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.svg",
  "/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch(() => {
            /* ignore individual failures */
          }),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Avoid caching Next dev/HMR endpoints
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    // Never cache a redirected navigation. Signed out, a request for "/"
    // follows the gate to /login and would otherwise be stored *as* "/",
    // leaving the login screen cached as the app forever.
    if (fresh && fresh.ok && !fresh.redirected) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const fallback = await cache.match("/");
    if (fallback) return fallback;
    return new Response("Offline", {
      status: 503,
      headers: { "content-type": "text/plain" },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}
