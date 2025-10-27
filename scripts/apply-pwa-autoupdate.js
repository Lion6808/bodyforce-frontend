/**
 * scripts/apply-pwa-autoupdate.js
 * ---------------------------------------------------------
 * Ajoute le minimum pour :
 *  - Vérifier les updates PWA au lancement
 *  - Activer l'update sur clic (skipWaiting + clients.claim)
 *  - Afficher un badge version en bas à droite (devient "Mettre à jour" s'il y a une nouvelle version)
 *
 * Le script :
 *  - Crée/écrase public/version.json (auto-généré ensuite via prebuild)
 *  - Ajoute 2 hooks: useServiceWorkerUpdates, useAppVersion
 *  - Patche service-worker.js (2 listeners)
 *  - Ajoute "prebuild" dans package.json si absent
 *  - Injecte imports + hooks + badge dans src/App.js (tentative safe; sinon affiche instructions)
 *  - Crée scripts/write-version.js
 *
 * Sauvegardes .bak faites avant patch sur App.js / package.json / service-worker.js.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const files = {
  versionJson: path.join(ROOT, 'public', 'version.json'),
  sw: path.join(ROOT, 'src', 'service-worker.js'),
  app: path.join(ROOT, 'src', 'App.js'),
  pkg: path.join(ROOT, 'package.json'),
  hookSW: path.join(ROOT, 'src', 'hooks', 'useServiceWorkerUpdates.js'),
  hookVer: path.join(ROOT, 'src', 'hooks', 'useAppVersion.js'),
  writeVer: path.join(ROOT, 'scripts', 'write-version.js'),
};

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function backup(file) {
  if (fs.existsSync(file)) {
    const bak = file + '.bak';
    fs.copyFileSync(file, bak);
  }
}

function writeFilePretty(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, 'utf8');
  logOK(`Écrit: ${path.relative(ROOT, file)}`);
}

function logOK(msg) { console.log('  ✅', msg); }
function logInfo(msg) { console.log('  ℹ️ ', msg); }
function logWarn(msg) { console.log('  ⚠️ ', msg); }
function logErr(msg) { console.log('  ❌', msg); }

function addIfMissing(haystack, snippet, label) {
  if (haystack.includes(snippet.trim())) {
    logInfo(`${label} déjà présent`);
    return haystack;
  }
  return haystack + '\n' + snippet + '\n';
}

(function main() {
  console.log('\n=== BODYFORCE — Mise à jour PWA auto-update + badge version ===\n');

  // 1) public/version.json (placeholder; sera réécrit par prebuild)
  try {
    writeFilePretty(files.versionJson, JSON.stringify({ version: "1.0.0 (auto)", commit: "" }, null, 2));
  } catch (e) { logErr(e.message); }

  // 2) hooks
  try {
    writeFilePretty(files.hookSW, `import { useEffect, useState } from "react";

export default function useServiceWorkerUpdates({ checkOnLoad = true } = {}) {
  const [waitingReg, setWaitingReg] = useState(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    (async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;

      if (reg.waiting) setWaitingReg(reg);

      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingReg(reg);
          }
        });
      });

      if (checkOnLoad) {
        try { await reg.update(); } catch {}
      }
    })();

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [checkOnLoad]);

  const activateUpdate = () =>
    waitingReg?.waiting?.postMessage({ type: "SKIP_WAITING" });

  return { hasUpdate: !!waitingReg?.waiting, activateUpdate };
}
`);
    writeFilePretty(files.hookVer, `import { useEffect, useState } from "react";

export default function useAppVersion() {
  const [version, setVersion] = useState(localStorage.getItem("app_version") || null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/version.json", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.version) {
          localStorage.setItem("app_version", data.version);
          setVersion(data.version);
        }
      } catch {}
    };

    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return version || "0.0.0";
}
`);
  } catch (e) { logErr(e.message); }

  // 3) write-version.js
  try {
    writeFilePretty(files.writeVer, `const fs = require("fs");
const path = require("path");
const pkg = require("../package.json");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = { version: \`\${pkg.version} (\${stamp})\`, commit: process.env.GIT_COMMIT || "" };

fs.writeFileSync(
  path.join(__dirname, "..", "public", "version.json"),
  JSON.stringify(out, null, 2),
  "utf8"
);
console.log("Wrote public/version.json ->", out);
`);
  } catch (e) { logErr(e.message); }

  // 4) Patch service-worker.js (2 listeners)
  try {
    if (!fs.existsSync(files.sw)) {
      logWarn(`Introuvable: ${path.relative(ROOT, files.sw)} — je passe cette étape (OK si vous n'avez pas de SW).`);
    } else {
      backup(files.sw);
      let sw = fs.readFileSync(files.sw, 'utf8');

      const msgListener = `self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});`;

      const activateListener = `self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});`;

      if (!sw.includes('SKIP_WAITING')) {
        sw = addIfMissing(sw, msgListener, 'listener SKIP_WAITING');
      } else {
        logInfo('Listener SKIP_WAITING déjà présent');
      }
      if (!sw.includes('clients.claim()')) {
        sw = addIfMissing(sw, activateListener, 'listener clients.claim()');
      } else {
        logInfo('Listener clients.claim() déjà présent');
      }

      fs.writeFileSync(files.sw, sw, 'utf8');
      logOK(`Patche: ${path.relative(ROOT, files.sw)}`);
    }
  } catch (e) { logErr(e.message); }

  // 5) Patch package.json : ajouter "prebuild"
  try {
    if (!fs.existsSync(files.pkg)) throw new Error('package.json introuvable.');
    backup(files.pkg);
    const pkg = JSON.parse(fs.readFileSync(files.pkg, 'utf8'));
    pkg.scripts = pkg.scripts || {};
    if (!pkg.scripts.prebuild) {
      pkg.scripts.prebuild = "node scripts/write-version.js";
      fs.writeFileSync(files.pkg, JSON.stringify(pkg, null, 2), 'utf8');
      logOK('Ajout script "prebuild" dans package.json');
    } else {
      logInfo('"prebuild" déjà présent dans package.json (aucune modif)');
    }
  } catch (e) { logErr(e.message); }

  // 6) Patch App.js : imports, hooks, badge
  try {
    if (!fs.existsSync(files.app)) throw new Error('src/App.js introuvable.');
    backup(files.app);
    let app = fs.readFileSync(files.app, 'utf8');

    // a) imports
    const importSW = `import useServiceWorkerUpdates from "./hooks/useServiceWorkerUpdates";`;
    const importVer = `import useAppVersion from "./hooks/useAppVersion";`;

    if (!app.includes(importSW)) {
      app = app.replace(/(^|\n)import .*?;\s*\n/gs, (m) => m + importSW + '\n');
      logOK('Import useServiceWorkerUpdates ajouté');
    } else {
      logInfo('Import useServiceWorkerUpdates déjà présent');
    }
    if (!app.includes(importVer)) {
      app = app.replace(importSW, importSW + '\n' + importVer);
      logOK('Import useAppVersion ajouté');
    } else {
      logInfo('Import useAppVersion déjà présent');
    }

    // b) hooks inside function App()
    const hookLines = `const { hasUpdate, activateUpdate } = useServiceWorkerUpdates({ checkOnLoad: true });
  const version = useAppVersion();`;

    if (app.includes('function App(')) {
      app = app.replace(/function App\s*\([^)]*\)\s*\{\s*/, (m) => m + '\n  ' + hookLines + '\n  ');
      logOK('Hooks insérés dans function App(...)');
    } else if (app.includes('const App =') || app.includes('export default function App')) {
      // Try to insert after first opening brace of App
      app = app.replace(/(const\s+App\s*=\s*\([^\)]*\)\s*=>\s*\{\s*|export\s+default\s+function\s+App\s*\([^\)]*\)\s*\{\s*)/, (m) => m + '\n  ' + hookLines + '\n  ');
      logOK('Hooks insérés dans App (arrow/default export)');
    } else {
      logWarn("Impossible d'injecter automatiquement les hooks dans App.js. Je te donnerai les lignes à coller manuellement.");
    }

    // c) badge JSX — append just before final export/closing if possible
    const badge = `
      <button
        onClick={hasUpdate ? activateUpdate : undefined}
        className={\`fixed bottom-3 right-3 z-50 px-3 py-1.5 rounded-md text-xs shadow \${hasUpdate ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-700/80 text-gray-100 cursor-default"}\`}
        title={hasUpdate ? "Nouvelle version disponible — cliquer pour mettre à jour" : \`Version \${version}\`}
        aria-label="Version de l'application"
      >
        {hasUpdate ? "Mettre à jour" : \`v \${version}\`}
      </button>`;

    // Try to insert before the last closing tag of JSX returned
    if (app.includes('return (')) {
      app = app.replace(/return\s*\(\s*([\s\S]*?)\);\s*\}?[\s]*export/s, (m, inner) => {
        if (inner.includes('hasUpdate ? "Mettre à jour"')) {
          logInfo('Badge déjà présent (détection jsx)');
          return m; // already
        }
        const newInner = inner + '\n' + badge + '\n';
        logOK('Badge version injecté dans JSX de App');
        return `return (\n${newInner});\nexport`;
      });
    } else {
      logWarn("Je n'ai pas localisé le bloc `return (` dans App.js. Je te laisse un rappel en fin de console pour coller le badge manuellement.");
    }

    fs.writeFileSync(files.app, app, 'utf8');
    logOK(`Patche: ${path.relative(ROOT, files.app)}`);

  } catch (e) { logErr(e.message); }

  console.log('\n=== Terminé ===\n');
  console.log('Étapes suivantes :');
  console.log('1) Vérifie les .bak si besoin de rollback (App.js.bak, package.json.bak, service-worker.js.bak)');
  console.log('2) npm install   (si nécessaire)');
  console.log('3) npm run build');
  console.log('4) npm start     (test local)');
  console.log('5) git checkout -b feature/pwa-autoupdate-version');
  console.log('6) git add . && git commit -m "PWA: auto-update au lancement + badge version"');
  console.log('7) git push origin feature/pwa-autoupdate-version  → Ouvre la PR sur GitHub');
  console.log('\nSi le script n’a pas pu insérer automatiquement les hooks ou le badge:');
  console.log('- Dans App.js, ajoute en haut :');
  console.log('    import useServiceWorkerUpdates from "./hooks/useServiceWorkerUpdates";');
  console.log('    import useAppVersion from "./hooks/useAppVersion";');
  console.log('- Dans la fonction App(), ajoute :');
  console.log('    const { hasUpdate, activateUpdate } = useServiceWorkerUpdates({ checkOnLoad: true });');
  console.log('    const version = useAppVersion();');
  console.log('- Dans le JSX de App (en bas), ajoute le bouton/badge :');
  console.log('    <button onClick={hasUpdate ? activateUpdate : undefined} className={...}>…</button>\n');
})();
