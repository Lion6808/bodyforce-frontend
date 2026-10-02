// Périodes de la page Statistiques (année en cours / précédente) — partagées page et widgets



export const CURRENT_YEAR = new Date().getFullYear();

export const PREVIOUS_YEAR = CURRENT_YEAR - 1;

export const CURRENT_MONTH = new Date().getMonth() + 1; // 1-12

export const CURRENT_DAY = new Date().getDate(); // Jour du mois (1-31)

export const PERIOD_OPTIONS = [
  { value: "current", label: `${CURRENT_YEAR}`, year: CURRENT_YEAR },
  { value: "previous", label: `${PREVIOUS_YEAR}`, year: PREVIOUS_YEAR },
  { value: "comparison", label: "Comparaison" },
];
