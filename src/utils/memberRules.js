// ===================================================================
// Règles métier membres — SOURCE UNIQUE côté frontend
// -------------------------------------------------------------------
// Alignées sur les RPC SQL (get_statistics, get_detailed_statistics) :
//   - actif  = date de fin STRICTEMENT postérieure à aujourd'hui
//   - expiré = date de fin passée, égale à aujourd'hui, ou absente
//   - maintenance exclue des compteurs (voir memberTypes.js)
// Toute page qui compte ou filtre des membres doit passer par ici.
// ===================================================================

import { isCountedMember } from "./memberTypes";

/** Date locale au format "yyyy-MM-dd" (comparable en chaîne). */
const toDayKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Partie date ("yyyy-MM-dd") d'une date de fin, ou null si absente/invalide. */
const endDayKey = (endDate) => {
  if (!endDate) return null;
  const key = String(endDate).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
};

/** Abonnement en cours (date de fin postérieure à aujourd'hui). */
export const isMemberActive = (m, today = new Date()) => {
  const end = endDayKey(m?.endDate);
  return end !== null && end > toDayKey(today);
};

/** Abonnement échu : date de fin passée, égale à aujourd'hui, ou absente. */
export const isMemberExpired = (m, today = new Date()) => !isMemberActive(m, today);

/** Actif dont l'abonnement se termine dans les `days` prochains jours (inclus). */
export const isExpiringSoon = (m, days = 30, today = new Date()) => {
  if (!isMemberActive(m, today)) return false;
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  return endDayKey(m.endDate) <= toDayKey(limit);
};

/** Adhérent au sens strict (ni comité, ni maintenance). */
export const isAdherent = (m) => (m?.member_type || "adherent") === "adherent";

/**
 * Compteurs de la page Membres, mêmes définitions que get_statistics.
 * @param {object[]} members - fiches membres (avec member_type, endDate, gender, etudiant)
 */
export const computeMemberStats = (members, today = new Date()) => {
  const counted = members.filter(isCountedMember);
  const active = counted.filter((m) => isMemberActive(m, today));
  const activeAdherents = active.filter(isAdherent);

  return {
    total: counted.length,
    actifs: active.length,
    expires: counted.length - active.length,
    hommes: active.filter((m) => m.gender === "Homme").length,
    femmes: active.filter((m) => m.gender === "Femme").length,
    etudiants: active.filter((m) => m.etudiant).length,
    synthese: {
      actifs: activeAdherents.length,
      hommes: activeAdherents.filter((m) => m.gender === "Homme").length,
      femmes: activeAdherents.filter((m) => m.gender === "Femme").length,
      etudiantsHommes: activeAdherents.filter((m) => m.etudiant && m.gender === "Homme").length,
      etudiantsFemmes: activeAdherents.filter((m) => m.etudiant && m.gender === "Femme").length,
      comite: active.filter((m) => m.member_type === "comite").length,
    },
  };
};
