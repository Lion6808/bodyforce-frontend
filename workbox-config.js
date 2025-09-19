// 📄 workbox-config.js — injectManifest (SW custom)
module.exports = {
  globDirectory: "build/",
  globPatterns: [
    "**/*.{js,css,html,svg,png,ico,json,woff,woff2,ttf,eot}"
  ],
  swDest: "build/service-worker.js",
  // 👇 IMPORTANT : on pointe vers TON SW custom
  swSrc: "src/service-worker.js",

  // cleanupOutdatedCaches: true, // ← SUPPRIMÉ (obsolète dans les nouvelles versions)
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
};