/**
 * BoodschappenBaas – Service Worker
 * Biedt offline ondersteuning en automatische verversing bij nieuwe versies.
 *
 * De cache-naam bevat een versie die wordt vervangen door GitHub Actions
 * bij elke commit naar main, zodat de app automatisch ververst.
 */

const CACHE_NAME = 'boodschappenbaas-%%VERSION%%';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/store.js',
  './js/yaml-parser.js',
  './data/items.yaml',
  './icons/icon.svg',
  './icons/maskable.svg',
];

// ── Install: pre-cache alle assets ──────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()) // Nieuwe SW activeert direct
  );
});

// ── Activate: verwijder oude caches ─────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim()) // Claim alle open clients
  );
});

// ── Fetch: cache-first strategie ────────────────────────────
self.addEventListener('fetch', (event) => {
  // Negeer niet-GET verzoeken
  if (event.request.method !== 'GET') return;

  // Negeer verzoeken buiten de app scope
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
