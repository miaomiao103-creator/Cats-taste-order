const CACHE_NAME = "catstaste-order-v4";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.webmanifest",
  "./icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  if (url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        fetch(req).then(res => {
          cache.put(req, res.clone());
          return res;
        }).catch(() => caches.match(req))
      )
    );
    return;
  }

  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then(cached =>
        cached || fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        }).catch(() => caches.match("./index.html"))
      )
    );
  }
});
