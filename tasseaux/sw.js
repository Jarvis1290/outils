// Ancienne adresse : ce service worker se retire tout seul (la nouvelle app garde son cache).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => { e.waitUntil(self.registration.unregister()); });
