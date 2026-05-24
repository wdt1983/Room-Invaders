/// <reference lib="webworker" />

/**
 * Room Invaders — Service Worker (MVP)
 *
 * Strategy:
 * - Cache-first for static assets (sprites, audio, UI icons)
 * - Network-first for API calls and dynamic pages
 * - Precache the app shell on install
 *
 * This is a basic SW for MVP. Will be expanded with Workbox or
 * Serwist patterns when offline room editing is implemented.
 */

const SW_VERSION = "0.0.3";
const CACHE_NAME = `room-invaders-v${SW_VERSION}`;

const PRECACHE_URLS: string[] = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// Type the service worker global scope
declare const self: ServiceWorkerGlobalScope;

// ─── INSTALL ────────────────────────────────────────────
self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // Activate immediately, don't wait for old SW to finish
  self.skipWaiting();
});

// ─── ACTIVATE ───────────────────────────────────────────
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ─── FETCH ──────────────────────────────────────────────
self.addEventListener("fetch", (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Static assets: cache-first
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif|ico|woff2?|ttf|otf)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else: network-first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || new Response("Offline", { status: 503 });
        });
      })
  );
});
