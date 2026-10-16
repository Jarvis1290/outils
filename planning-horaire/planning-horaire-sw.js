// Service worker dédié au Planning Horaire (indépendant des autres outils du repo)
const CACHE_NAME = "planning-horaire-v1";
const FILES = [
  "planning-horaire.html",
  "planning-horaire-manifest.json",
  "planning-horaire-icon-192.png",
  "planning-horaire-icon-512.png",
  "planning-horaire-icon-maskable-512.png"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){ return cache.addAll(FILES); })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event){
  // Ne gère que les requêtes vers ce propre dossier d'outil, laisse le reste du site tranquille.
  if (!FILES.some(function(f){ return event.request.url.indexOf(f) !== -1; })) return;
  event.respondWith(
    caches.match(event.request).then(function(cached){
      return cached || fetch(event.request);
    })
  );
});
