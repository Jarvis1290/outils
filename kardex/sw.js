// Kardex — fonctionnement hors ligne
const CACHE = "kardex-v1.9";
const CORE = ["./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("kardex-") && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin && !/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
  if (req.mode === "navigate") {                                // la page : réseau d'abord, sinon cache
    e.respondWith(fetch(req.url, { cache: "no-cache" }).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put("./index.html", c)); return r; })
      .catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {   // le reste : cache d'abord
    if (r && (r.ok || r.type === "opaque")) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
    return r;
  }).catch(() => hit)));
});
