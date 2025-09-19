// 📄 workbox-config.js — BodyForce (generateSW)
// ------------------------------------------------------------
// Utilisation :
//   npm run build && workbox generateSW workbox-config.js
// Le SW sera généré dans build/service-worker.js
// ------------------------------------------------------------

module.exports = {
  // Répertoire de build créé par react-scripts
  globDirectory: "build/",
  // Fichiers statiques à pré-cacher
  globPatterns: [
    "**/*.{js,css,html,svg,png,ico,json,woff,woff2,ttf,eot}"
  ],

  // Emplacement de sortie du service worker généré
  swDest: "build/service-worker.js",

  // Options recommandées
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,

  // Évite que ces paramètres d'URL bustent le cache (tracking, timestamp, etc.)
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^t$/, /^v$/],

  // Taille max des assets précachés (augmente si besoin pour gros bundles)
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB

  // Stratégies runtime (non précachées)
  runtimeCaching: [
    // 1) IMAGES publiques Supabase (avatars, certificats publics, etc.)
    {
      urlPattern: ({ url }) =>
        url.origin.includes("supabase.co") &&
        url.pathname.includes("/object/public/"),
      handler: "CacheFirst",
      options: {
        cacheName: "supabase-images",
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 jours
        },
        // Respecte les headers HTTP pour l'expiration quand disponibles
        matchOptions: { ignoreSearch: false },
      },
    },

    // 2) API REST Supabase — cache léger
    {
      urlPattern: ({ url }) =>
        url.origin.includes("supabase.co") &&
        url.pathname.includes("/rest/v1/"),
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "supabase-api",
        matchOptions: { ignoreSearch: false },
      },
    },

    // 3) Google Fonts (exemple classique, optionnel)
    {
      urlPattern: ({ url }) =>
        url.origin === "https://fonts.googleapis.com" ||
        url.origin === "https://fonts.gstatic.com",
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "google-fonts",
        matchOptions: { ignoreSearch: true },
      },
    },

    // 4) Images locales de l’app (optionnel : CacheFirst)
    {
      urlPattern: ({ request, url }) =>
        request.destination === "image" && url.origin === self.location.origin,
      handler: "CacheFirst",
      options: {
        cacheName: "app-images",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
        matchOptions: { ignoreSearch: true },
      },
    },
  ],
};
