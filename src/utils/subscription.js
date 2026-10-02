// Abonnements : durées et date de fin « Année civile » — source unique
// (fiche membre et bouton « Réabonner » de la page Membres).

/** Map of subscription type labels to their duration in months (0 = civil year). */
export const subscriptionDurations = {
  Mensuel: 1,
  Trimestriel: 3,
  Semestriel: 6,
  Annuel: 12,
  "Année civile": 0,
};

/**
 * End date of an "Année civile" subscription started in `year`:
 * from 01/01/year to 01/01/(year + 1).
 * (In practice registrations open at the club's permanence on the first
 * Saturday of January; the club treats the season as 01/01 -> 01/01.)
 * With the "active = end date after today" rule (utils/memberRules), the
 * subscription expires on 01/01 of the following year.
 * @param {number} year
 * @returns {string} ISO date string "yyyy-MM-dd"
 */
export const getSubscriptionEndDate = (year) => `${Number(year) + 1}-01-01`;
