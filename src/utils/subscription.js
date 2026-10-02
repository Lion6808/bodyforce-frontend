// Abonnements : durées et date de fin « Année civile » — source unique
// (fiche membre et bouton « Réabonner » de la page Membres).
//
// Pourquoi la permanence de janvier : les nouveaux badges sont préparés à
// l'avance et enregistrés dans Intratone ; ils sont remis aux adhérents à la
// permanence du premier samedi de janvier, où les anciens sont rendus. Entre
// le 1er janvier et cette permanence, l'ancien badge reste donc valable : la
// saison N se termine le jour de la permanence de l'année N + 1.

/** Map of subscription type labels to their duration in months (0 = civil year). */
export const subscriptionDurations = {
  Mensuel: 1,
  Trimestriel: 3,
  Semestriel: 6,
  Annuel: 12,
  "Année civile": 0,
};

/**
 * Dates de permanence forcées, par année ("yyyy-MM-dd").
 * À renseigner uniquement si la permanence n'a pas lieu à la date calculée.
 * Exemple : { 2029: "2029-01-13" }
 */
export const PERMANENCE_OVERRIDES = {};

const pad = (n) => String(n).padStart(2, "0");

/**
 * Jour de la permanence de janvier de `year` : le premier samedi de janvier,
 * sauf si le 1er janvier (férié) tombe un samedi → samedi suivant (le 8).
 * @param {number} year
 * @returns {string} "yyyy-MM-dd"
 */
export const getPermanenceDate = (year) => {
  const y = Number(year);
  if (PERMANENCE_OVERRIDES[y]) return PERMANENCE_OVERRIDES[y];
  const jan1 = new Date(Date.UTC(y, 0, 1)).getUTCDay(); // 0 = dimanche … 6 = samedi
  let day = 1 + ((6 - jan1 + 7) % 7); // premier samedi de janvier
  if (day === 1) day = 8; // 1er janvier férié
  return `${y}-01-${pad(day)}`;
};

/**
 * Fin d'un abonnement « Année civile » de la saison `year` :
 * le jour de la permanence de janvier de l'année suivante.
 * @param {number} year
 * @returns {string} "yyyy-MM-dd"
 */
export const getSubscriptionEndDate = (year) => getPermanenceDate(Number(year) + 1);

/** "yyyy-MM-dd" → "dd/MM/yyyy" (affichage). */
export const formatIsoDateFr = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
