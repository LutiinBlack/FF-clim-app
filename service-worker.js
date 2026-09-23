const CACHE_NAME = "ffclim-rapports-v4";
const CORE_ASSETS = [
  "./index.html",
  "./manifest.json",
];
const STATIC_ASSETS = [
  "./icon-192.png",
  "./icon-512.png",
  "./icon-192-maskable.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([...CORE_ASSETS, ...STATIC_ASSETS]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Strategy:
// - core files (the app page + manifest): network-first, so any update we
//   ship is picked up on the very next load, with the cached copy only used
//   as an offline fallback.
// - static assets (icons) and everything else (CDN scripts, fonts): cache-first,
//   since those rarely change, to keep the app fast and working offline.
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Never cache calls to Supabase (auth, database, storage) or any non-GET
  // request — this data must always be fresh, straight from the network.
  if (req.url.includes("supabase.co") || req.method !== "GET") {
    event.respondWith(fetch(req));
    return;
  }

  const isCore = CORE_ASSETS.some((a) => req.url.endsWith(a.replace("./", "")));

  if (isCore) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      });
    })
  );
});

