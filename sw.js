// Page d'accueil « Outils d'atelier » — s'ouvre aussi hors ligne.
// Ne gère QUE la page d'accueil et ses icônes : chaque app garde son propre service worker.
const CACHE = "outils-accueil-v1";
const CORE = ["./", "./index.html", "./planning-horaire/icon-192.png", "./porte-outils/icon-192.png",
  "./suivi-vehicules/icon-192.png", "./kardex/icon-192.png", "./calcul-atelier/icon-192.png"];
const OURS = new Set(CORE.map(u => new URL(u, location.href).href));
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" })))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("outils-accueil-") && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const req = e.request, u = new URL(req.url); u.search = ""; u.hash = "";
  if (req.method !== "GET" || !OURS.has(u.href)) return;          // tout le reste : pas touché
  e.respondWith(fetch(req, { cache: "no-cache" }).then(r => {
    if (r && r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(u.href, c)); }
    return r;
  }).catch(() => caches.match(u.href).then(h => h || caches.match("./index.html"))));
});
