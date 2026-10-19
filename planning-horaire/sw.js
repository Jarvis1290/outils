// Service worker dédié au Planning Horaire (indépendant des autres outils du repo)
// v1.2 : réseau d'abord (toujours la dernière version en ligne), cache seulement hors ligne.
const CACHE_NAME = "planning-horaire-v1.2";
const FILES = [
  "index.html",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png"
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
      return Promise.all(keys.filter(function(k){ return k.indexOf("planning-horaire-") === 0 && k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event){
  // Ne gère que les fichiers de ce dossier d'outil, laisse le reste du site tranquille.
  var isOurs = event.request.mode === "navigate" || FILES.some(function(f){ return event.request.url.indexOf(f) !== -1; });
  if (!isOurs || event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request, { cache: "no-cache" }).then(function(resp){
      var copy = resp.clone();
      caches.open(CACHE_NAME).then(function(c){ c.put(event.request, copy); });
      return resp;
    }).catch(function(){
      return caches.match(event.request).then(function(c){ return c || caches.match("index.html"); });
    })
  );
});
