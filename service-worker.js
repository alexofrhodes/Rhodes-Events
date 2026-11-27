/* PWA: precache app shell; network-first so republish updates show.
   The cache version lives in sw-version.js (written by Publish, not part of the template):
   a new number there makes browsers install this worker again. */
try {
  importScripts("sw-version.js");
} catch (_) {
  /* new site without a published version yet */
}
const SHELL = "events-shell-v" + (self.SHELL_VERSION || 1);
const SHELL_URLS = [
  "./",
  "index.html",
  "css/site.css",
  "js/site.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/site-qr.png",
  "icons/flag-gb.svg",
  "icons/flag-gr.svg",
  "vendor/rhodes-kit/rk.css",
  "vendor/rhodes-kit/rk.js",
  "vendor/leaflet/leaflet.css",
  "vendor/leaflet/leaflet.js",
  "vendor/leaflet.markercluster/MarkerCluster.css",
  "vendor/leaflet.markercluster/MarkerCluster.Default.css",
  "vendor/leaflet.markercluster/leaflet.markercluster.js",
];

function isShellPath(path) {
  return (
    path.endsWith("/") ||
    path.endsWith("/index.html") ||
    path.endsWith("/css/site.css") ||
    path.endsWith("/js/site.js") ||
    path.endsWith("/manifest.webmanifest") ||
    path.endsWith("/icons/icon-192.png") ||
    path.endsWith("/icons/icon-512.png") ||
    path.endsWith("/icons/site-qr.png") ||
    path.endsWith("/icons/flag-gb.svg") ||
    path.endsWith("/icons/flag-gr.svg") ||
    path.includes("/vendor/")
  );
}

function isData(path) {
  return path.includes("/data/");
}

function isImage(path) {
  return path.includes("/img/");
}

/* Event pictures: show the saved copy at once (no reload flash), refresh it in the background
   so a republished picture appears on the next view. */
async function cacheThenRefresh(event) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(event.request);
  const refresh = fetch(event.request)
    .then((res) => {
      if (res && res.ok) cache.put(event.request, res.clone());
      return res;
    })
    .catch(() => cached);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  return refresh;
}

async function precacheShell() {
  const cache = await caches.open(SHELL);
  await Promise.all(
    SHELL_URLS.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "reload" });
        if (res && res.ok) await cache.put(url, res.clone());
      } catch (_) {
        /* install still succeeds if one asset fails */
      }
    })
  );
}

async function networkFirst(req, cacheKey) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req, { cache: "no-store" });
    if (res && res.ok) await cache.put(cacheKey || req, res.clone());
    return res;
  } catch (_) {
    const cached = await cache.match(cacheKey || req);
    if (cached) return cached;
    if (req.mode === "navigate") {
      return (await cache.match("index.html")) || (await cache.match("./"));
    }
    throw _;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // Event share pages (e/<id>.html) just forward to the app: never cache them as index.html.
  if (path.includes("/e/")) return;

  if (req.mode === "navigate" || isShellPath(path)) {
    event.respondWith(networkFirst(req, req.mode === "navigate" ? "index.html" : req));
    return;
  }

  if (isImage(path)) {
    event.respondWith(cacheThenRefresh(event));
    return;
  }

  if (isData(path)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Other same-origin GETs: network, fall back to cache if present
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
