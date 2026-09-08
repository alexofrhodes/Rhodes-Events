/* PWA: precache app shell; network-first so republish updates show. */
const SHELL = "events-shell-v58";
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
    path.endsWith("/icons/flag-gr.svg")
  );
}

function isDataOrImage(path) {
  return path.includes("/data/") || path.includes("/img/");
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
    const res = await fetch(req);
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

  if (req.mode === "navigate" || isShellPath(path)) {
    event.respondWith(networkFirst(req, req.mode === "navigate" ? "index.html" : req));
    return;
  }

  if (isDataOrImage(path)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Other same-origin GETs: network, fall back to cache if present
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
