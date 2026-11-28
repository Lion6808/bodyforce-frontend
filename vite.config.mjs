// vite.config.mjs — BodyForce (remplace react-scripts / CRA depuis v2.15.0)
//
// Objectif : se comporter comme l'ancien build CRA pour ne rien changer ailleurs :
// - sortie dans build/ (Render + workbox-config.js + tour-bf.mjs l'utilisent)
// - variables d'environnement REACT_APP_* lues via process.env.REACT_APP_* (code inchangé)
// - JSX autorisé dans les fichiers .js (24 fichiers de src/ en contiennent)
// - serveur de dev sur le port 3000
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Charge .env / .env.[mode] ET les variables d'environnement système (Render)
  // dont le nom commence par REACT_APP_.
  const env = loadEnv(mode, process.cwd(), "REACT_APP_");

  // Variables utilisées dans src/ : remplacées par undefined si absentes
  // (comme CRA), sinon « process is not defined » dans le navigateur.
  const KNOWN_KEYS = [
    "REACT_APP_SUPABASE_URL",
    "REACT_APP_SUPABASE_ANON_KEY",
    "REACT_APP_VAPID_PUBLIC_KEY",
    "REACT_APP_API_URL",
  ];
  const processEnv = {};
  for (const key of new Set([...KNOWN_KEYS, ...Object.keys(env)])) {
    processEnv[`process.env.${key}`] =
      env[key] !== undefined ? JSON.stringify(env[key]) : "undefined";
  }

  return {
    plugins: [react({ include: /\.(js|jsx)$/ })],

    define: {
      ...processEnv,
      "process.env.NODE_ENV": JSON.stringify(
        mode === "production" ? "production" : "development"
      ),
    },

    // JSX dans les fichiers .js
    esbuild: {
      loader: "jsx",
      include: /src\/.*\.jsx?$/,
      exclude: [],
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: { ".js": "jsx" },
      },
    },

    server: {
      port: 3000,
      open: false,
    },
    preview: {
      port: 3000,
    },

    build: {
      outDir: "build",
      emptyOutDir: true,
      chunkSizeWarningLimit: 2000,
    },
  };
});
