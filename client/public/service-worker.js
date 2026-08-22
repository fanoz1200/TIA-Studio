const CACHE_NAME = "tia-studio-shell-v2";
const APP_SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const cacheResponse = (response) => {
    if (response.ok && (request.destination || url.pathname === "/")) {
      caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    }
    return response;
  };

  // صفحة التطبيق يجب أن تصل من الشبكة أولاً حتى لا يستمر مستخدم قديم في رؤية
  // index.html يحتوي على أصل JavaScript لإصدار سابق بعد اكتمال النشر.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(cacheResponse)
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then(cacheResponse).catch(() => cached);
      return cached || network;
    }),
  );
});
