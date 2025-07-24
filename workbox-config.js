module.exports = {
  globDirectory: 'build/',
  globPatterns: [
    '**/*.{html,js,css,json,png,jpg,svg,woff2}'
  ],
  swDest: 'build/sw.js',
  clientsClaim: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.destination === 'image',
      handler: 'CacheFirst',
      options: {
        cacheName: 'images-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60 // 30 jours
        }
      }
    },
    {
      urlPattern: ({ url }) => url.pathname.startsWith('/'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
      }
    }
  ]
};
