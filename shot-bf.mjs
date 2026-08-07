/**
 * Capture une page de BodyForce et MESURE les zones tactiles.
 * Adapte du skill verifier-rendu-ui : ici on ne mesure pas un canevas react-flow,
 * mais tous les boutons/liens cliquables, pour reperer ceux sous le minimum
 * tactile (44px Apple / 48px Google).
 *
 * Usage :
 *   node shot-bf.mjs <url> <email> <motdepasse> <route> <sortie.png> [mobile|desktop]
 * Exemple :
 *   node shot-bf.mjs http://localhost:3000 a@b.fr pass /messages msg.png mobile
 *
 * Si <email> vaut "-" : pas de connexion (capture d'une page publique, ex. /login).
 */
import { chromium } from "playwright";

const [, , url, email, password, route = "/", sortie = "shot.png", mode = "desktop"] =
  process.argv;

const viewport =
  mode === "mobile" ? { width: 390, height: 844 } : { width: 1400, height: 900 };

const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport, deviceScaleFactor: 2 });

const journal = [];
page.on("console", (m) => {
  if (m.type() === "error") journal.push(`[error] ${m.text().slice(0, 200)}`);
});
page.on("pageerror", (e) => journal.push(`[pageerror] ${e.message.slice(0, 200)}`));

// --- Connexion (sauf si email == "-") ---
if (email && email !== "-") {
  await page.goto(`${url}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page
    .waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 })
    .catch(() => {});
}

await page.goto(`${url}${route}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// --- Mesure des zones tactiles ---
const MIN = 44; // seuil Apple ; Google recommande 48
const cibles = await page.evaluate((MIN) => {
  const els = [...document.querySelectorAll('button, a[href], [role="button"]')];
  const petits = [];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue; // invisible
    if (r.height < MIN || r.width < MIN) {
      const label =
        (el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          el.textContent ||
          "")
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 40) || "(sans texte)";
      petits.push({
        label,
        w: Math.round(r.width),
        h: Math.round(r.height),
        classes: (el.className.baseVal ?? el.className ?? "").toString().slice(0, 90),
      });
    }
  }
  return { total: els.length, petits };
}, MIN);

console.log("URL finale :", page.url());
console.log(`Cliquables : ${cibles.total} | sous ${MIN}px : ${cibles.petits.length}`);
console.log(JSON.stringify(cibles.petits, null, 1));
console.log("\n--- console ---");
console.log(journal.length ? journal.join("\n") : "(aucune erreur)");

await page.screenshot({ path: sortie, fullPage: false });
await navigateur.close();
