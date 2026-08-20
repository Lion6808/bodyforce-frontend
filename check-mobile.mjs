/**
 * Diagnostic "deviation horizontale" mobile :
 *  - mesure le debordement horizontal statique (scrollWidth vs innerWidth)
 *  - liste les elements plus larges que le viewport
 *  - simule un scroll VERTICAL avec un leger wobble horizontal et lit le
 *    transform applique a .swipe-content (pour prouver le bug de swipe).
 *
 * Usage : node check-mobile.mjs <url> <email> <mdp> <route> <sortie.png>
 */
import { chromium } from "playwright";

const [, , url, email, password, route = "/", sortie = "diag.png"] = process.argv;

const nav = await chromium.launch();
const ctx = await nav.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();

if (email && email !== "-") {
  await page.goto(`${url}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
}
await page.goto(`${url}${route}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// 1) Debordement statique
const overflow = await page.evaluate(() => {
  const de = document.documentElement;
  const coupables = [];
  document.querySelectorAll("*").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth + 1 || r.left < -1) {
      coupables.push({
        tag: el.tagName.toLowerCase(),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
        classes: (el.className.baseVal ?? el.className ?? "").toString().slice(0, 70),
      });
    }
  });
  return {
    innerWidth: window.innerWidth,
    scrollWidth: de.scrollWidth,
    debordeHorizontalement: de.scrollWidth > window.innerWidth,
    coupables: coupables.slice(0, 8),
  };
});
console.log("=== Debordement statique ===");
console.log(JSON.stringify(overflow, null, 1));

// 2) Simulation d'un scroll vertical avec wobble horizontal
const transformPendantScroll = await page.evaluate(async () => {
  const cible =
    document.querySelector(".swipe-content") ||
    document.querySelector(".swipe-container") ||
    document.querySelector("main");
  if (!cible) return "(.swipe-content introuvable)";

  const zone = document.querySelector(".swipe-container") || cible;
  const faireTouch = (type, x, y) => {
    const t = new Touch({ identifier: 1, target: zone, clientX: x, clientY: y });
    zone.dispatchEvent(
      new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: type === "touchend" ? [] : [t],
        targetTouches: type === "touchend" ? [] : [t],
        changedTouches: [t],
      })
    );
  };

  // Scroll VERTICAL (montee de 200px) mais avec un wobble horizontal de ~16px
  // qui franchit le seuil (diffX>10) TANT QUE diffY<100 : c'est la fenetre du bug.
  faireTouch("touchstart", 200, 650);
  let transformMax = "none";
  const pts = [
    [206, 630], // diffX -6,  diffY 20
    [214, 605], // diffX -14 (>10), diffY 45  -> devrait declencher
    [216, 565], // diffX -16, diffY 85 (<100)
    [216, 505], // diffX -16, diffY 145 (>100) -> condition fausse, offset conserve
    [216, 450], // scroll continue, contenu reste decale
  ];
  for (const [x, y] of pts) {
    faireTouch("touchmove", x, y);
    const tr = getComputedStyle(cible).transform;
    if (tr && tr !== "none" && tr !== "matrix(1, 0, 0, 1, 0, 0)") transformMax = tr;
    await new Promise((r) => setTimeout(r, 30));
  }
  faireTouch("touchend", 216, 450);
  return transformMax;
});
console.log("\n=== Transform de .swipe-content pendant un scroll VERTICAL ===");
console.log(transformPendantScroll);

await page.screenshot({ path: sortie });
await nav.close();
