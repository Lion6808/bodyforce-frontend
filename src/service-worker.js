/* eslint-disable no-undef */
// 📄 src/service-worker.js — BodyForce (custom Workbox + injectManifest)
// ------------------------------------------------------------
// Ce SW combine :
// 1) App Shell (fallback vers index.html hors-ligne)
// 2) CacheFirst des images publiques Supabase
// 3) StaleWhileRevalidate pour l'API REST Supabase
// 4) CacheFirst des images locales
// 5) Gestion classique : skipWaiting/clientsClaim + ping 'message'
// ------------------------------------------------------------

// Charge Workbox (CDN)
importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js");

if (workbox) {
  // Options globales
  workbox.core.setCacheNameDetails({
    prefix: "bodyforce",
    suffix: "v1",
    precache: "precache",
    runtime: "runtime",
  });

  // Prend la main immédiatement après update
  workbox.core.clientsClaim();
  workbox.core.skipWaiting();

  // ------------------------------------------------------------
  // 1) Precache manifest (injecté automatiquement par injectManifest)
  // ------------------------------------------------------------
  // Nettoyage des anciens caches (remplace cleanupOutdatedCaches du config)
  workbox.precaching.cleanupOutdatedCaches();
  
  // eslint-disable-next-line no-restricted-globals
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || [], {
    // On laisse passer les query params usuels sauf busting (géré côté runtime)
    // ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
  });

  // ------------------------------------------------------------
  // 2) App Shell fallback (SPA) — renvoie index.html en mode offline
  // ------------------------------------------------------------
  const navigationHandler = workbox.precaching.createHandlerBoundToURL("/index.html");
  workbox.routing.registerRoute(
    // Navigation requests (SPA)
    ({ request }) => request.mode === "navigate",
    async (params) => {
      try {
        return await navigationHandler(params);
      } catch (err) {
        // En dernier recours, si index.html n'est pas disponible : réponse simple
        return new Response("<h1>Hors-ligne</h1><p>Veuillez réessayer.</p>", {
          headers: { "Content-Type": "text/html" },
        });
      }
    }
  );

  // ------------------------------------------------------------
  // 3) IMAGES Supabase publiques  → CacheFirst (30 jours)
  //    Exemple d'URL: https://<project>.supabase.co/storage/v1/object/public/photo/...
  // ------------------------------------------------------------
  workbox.routing.registerRoute(
    ({ url }) => url.origin.includes("supabase.co") && url.pathname.includes("/object/public/"),
    new workbox.strategies.CacheFirst({
      cacheName: "supabase-images",
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 500,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 jours
        }),
        // Respecte les en-têtes HTTP si présents
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // ------------------------------------------------------------
  // 4) API REST Supabase → StaleWhileRevalidate (réponses légères)
  //    Exemple: https://<project>.supabase.co/rest/v1/...
  // ------------------------------------------------------------
  workbox.routing.registerRoute(
    ({ url }) => url.origin.includes("supabase.co") && url.pathname.includes("/rest/v1/"),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: "supabase-api",
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // ------------------------------------------------------------
  // 5) Images locales de l'app → CacheFirst (30 jours)
  // ------------------------------------------------------------
  workbox.routing.registerRoute(
    ({ request, url }) => request.destination === "image" && url.origin === self.location.origin,
    new workbox.strategies.CacheFirst({
      cacheName: "app-images",
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // ------------------------------------------------------------
  // 6) (Optionnel) Google Fonts → SWR
  // ------------------------------------------------------------
  workbox.routing.registerRoute(
    ({ url }) =>
      url.origin === "https://fonts.googleapis.com" ||
      url.origin === "https://fonts.gstatic.com",
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: "google-fonts",
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );
}

// ------------------------------------------------------------
// 7) Events utilitaires
// ------------------------------------------------------------

// Message entré (ex: {type:'SKIP_WAITING'})
self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// (facultatif) Log install/activate
self.addEventListener("install", () => {
  // console.log("[SW] Installed");
});
self.addEventListener("activate", (event) => {
  // console.log("[SW] Activated");
  event.waitUntil(self.clients.claim());
});

// ------------------------------------------------------------
// Push notifications — rappel fin d'entraînement
// ------------------------------------------------------------
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "BodyForce", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: data.data || {},
      requireInteraction: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { badgeId, timestamp } = event.notification.data || {};
  const url =
    badgeId && timestamp
      ? `/workout-end?badgeId=${encodeURIComponent(badgeId)}&ts=${encodeURIComponent(timestamp)}`
      : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});