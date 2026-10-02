// Tour de vérification BodyForce : connexion + chaque page (desktop et mobile), captures,
// débordements, défilements horizontaux internes, erreurs console / HTTP.
// Usage : node tour-bf.mjs http://localhost:3000 <dossier-captures> <fichier-identifiants> [desktop|mobile]
// Fichier d’identifiants : 1re ligne = email, dernière ligne = mot de passe. Jamais affichés.
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.argv[2] || "http://localhost:3000";
const OUT = process.argv[3];
const CRED = process.argv[4];
const ONLY = process.argv[5]; // "desktop" | "mobile" | undefined

const lines = fs.readFileSync(CRED, "utf8").replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const email = lines[0];
const password = lines[lines.length - 1];

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, serviceWorkers: "block" },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: "block" },
};

const ROUTES = ["/", "/members", "/planning", "/payments", "/statistics", "/emails", "/reports"];
const pause = (p, ms) => p.waitForTimeout(ms);

async function measure(page) {
  return page.evaluate(() => {
    const scrollers = [];
    for (const el of document.querySelectorAll("body *")) {
      const ox = getComputedStyle(el).overflowX;
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        const label = (el.getAttribute("aria-label") || el.className || el.tagName).toString().slice(0, 50);
        scrollers.push(`${label} (${el.clientWidth}px, contenu ${el.scrollWidth}px)`);
      }
    }
    return { overflowX: document.documentElement.scrollWidth - window.innerWidth, url: location.pathname, scrollers };
  });
}

const browser = await chromium.launch();
for (const [name, opts] of Object.entries(VIEWPORTS)) {
  if (ONLY && ONLY !== name) continue;
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  let errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 160)));
  page.on("response", (r) => { if (r.status() >= 400 && /supabase|localhost/.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url().replace(/^https:\/\/[^/]+/, '').slice(0, 220)}`); });

  const shot = async (label) => {
    await pause(page, 1200);
    const m = await measure(page);
    const file = `${OUT}/${name}-${label}.png`;
    await page.screenshot({ path: file });
    console.log(`[${name}] ${label.padEnd(22)} url=${m.url.padEnd(16)} debordement=${m.overflowX}px defilements-internes=${m.scrollers.length ? m.scrollers.join(' ; ') : 'aucun'} erreurs=${errors.length ? errors.join(" || ") : "aucune"}`);
    errors = [];
  };

  // Connexion
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
  await pause(page, 2500);
  await shot("00-apres-connexion");

  for (const r of ROUTES) {
    await page.goto(BASE + r, { waitUntil: "networkidle" });
    await shot("route" + r.replace(/\//g, "_"));
  }

  // Statistiques : bouton Comité
  await page.goto(BASE + "/statistics", { waitUntil: "networkidle" });
  await pause(page, 1500);
  const comite = page.getByRole("button", { name: /Comité (inclus|exclu)/ });
  if (await comite.count()) {
    await comite.first().click();
    await page.waitForLoadState("networkidle");
    await shot("stats-comite-bascule");
    await comite.first().click(); // remettre l'état initial
    await pause(page, 1500);
  } else console.log(`[${name}] bouton Comité introuvable`);

  // Membres : recherche puis ouverture d'une fiche et de ses onglets
  await page.goto(BASE + "/members", { waitUntil: "networkidle" });
  await pause(page, 1500);
  const search = page.locator('input[type="text"], input[type="search"]').first();
  if (await search.count()) {
    await search.fill("a?e");
    await shot("membres-recherche-joker");
    await search.fill("");
  }
  const open = name === "desktop"
    ? page.locator('button[title="Modifier"]').first()
    : page.getByRole("button", { name: "Modifier" }).first();
  if (await open.count()) {
    await open.click();
    await page.waitForLoadState("networkidle");
    await shot("fiche-profil");
    for (const tab of ["Documents", "Abonnement", "Presence", "Messages"]) {
      const b = page.locator('nav[aria-label="Tabs"]').getByRole("button", { name: new RegExp("^" + tab) }).first();
      if (await b.count()) { await b.click(); await shot("fiche-" + tab.toLowerCase()); }
      else console.log(`[${name}] onglet ${tab} introuvable`);
    }
  } else console.log(`[${name}] bouton Modifier introuvable`);

  await ctx.close();
}
await browser.close();
