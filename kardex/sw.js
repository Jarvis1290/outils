// Kardex — fonctionne entièrement hors ligne.
// Tout est gardé dans le téléphone dès la première ouverture : page, icônes, polices.
// La page : réseau d'abord (nouvelle version au lancement suivant), mais si le réseau ne répond pas
// en 4 s, la copie du téléphone s'ouvre tout de suite (mode avion, réseau faible).
const CACHE = "kardex-v2.0";
const IA = "ia-depth-v1";   // moteur + modèle IA (37 Mo) : cache à part, gardé d'une version à l'autre
const PREFIX = "kardex-";
const CORE = ["./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./fonts/fonts.css", "./fonts/Inter-latin-ext-cf3eb50f.woff2", "./fonts/Inter-latin-f11d729b.woff2", "./fonts/JetBrainsMono-latin-4f27206c.woff2", "./fonts/JetBrainsMono-latin-ext-06ad3600.woff2", "./fonts/SairaStencilOne-latin-0b383b2f.woff2", "./fonts/SairaStencilOne-latin-ext-917ada4f.woff2"];
const TIMEOUT = 4000;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" })))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

const OFFLINE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hors ligne</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#14171c;color:#eef0f3;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><div style="font-size:56px">✈️</div><h1 style="font-size:22px">Pas de réseau</h1>
<p style="color:#9aa3ad;max-width:320px">Kardex n'a pas encore été ouverte avec du réseau sur ce téléphone. Ouvre-la une fois connecté : ensuite elle marche partout, même en mode avion.</p>
<button onclick="location.reload()" style="font-size:16px;padding:10px 18px;border-radius:12px;border:0;background:#f5a524;color:#14110a;font-weight:700">Réessayer</button></div></body></html>`;

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("./index.html"))
    .then(r => r || new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;                    // le reste d'internet : toujours en direct
  if (url.pathname.includes("/ia/")) {                           // IA : téléchargée une fois au 1er relief, puis hors ligne
    e.respondWith(caches.open(IA).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }))));
    return;
  }
  if (req.mode === "navigate") {
    const net = fetch(req.url, { cache: "no-cache" }).then(r => {
      if (r && r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put("./index.html", c)); }
      return r;
    });
    e.waitUntil(net.catch(() => {}));                            // la mise à jour continue en arrière-plan
    e.respondWith(new Promise(ok => {
      let done = false;
      const fallback = () => { if (!done) { done = true; ok(fromCache(req)); } };
      const t = setTimeout(() => caches.match("./index.html").then(h => h && fallback()), TIMEOUT);
      net.then(r => { if (done) return; if (r && r.ok) { done = true; clearTimeout(t); ok(r); } else fallback(); }, fallback);
    }));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {   // icônes, polices… : téléphone d'abord
    if (r && r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(h => h || Response.error()))));
});
