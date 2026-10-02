// Abonnements : durées et dates de fin « Année civile » — extraits de MemberFormPage



/** Map of subscription type labels to their duration in months (0 = civil year). */
export const subscriptionDurations = {
  Mensuel: 1,
  Trimestriel: 3,
  Semestriel: 6,
  Annuel: 12,
  "Année civile": 0,
};

/**
 * Configured end dates for "Année civile" subscriptions, keyed by start year.
 * Adjust these values as needed for each season.
 */
export const SUBSCRIPTION_END_DATES = {
  2025: "2026-01-01",
  2026: "2027-01-01",
  2027: "2028-01-01",
  2028: "2029-01-01",
  2029: "2030-01-01",
};

/**
 * Return the configured subscription end date for a given year.
 * Falls back to Dec 31 of the given year if no entry exists.
 * @param {number} year
 * @returns {string} ISO date string "yyyy-MM-dd"
 */
export const getSubscriptionEndDate = (year) => {
  if (SUBSCRIPTION_END_DATES[year]) {
    return SUBSCRIPTION_END_DATES[year];
  }
  console.warn(`Pas de date configuree pour ${year}`);
  return `${year}-12-31`;
};
