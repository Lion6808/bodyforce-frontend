// Utilitaires de dates (format fr-FR, week-end, aujourd'hui) — extraits de MemberFormPage



/**
 * Format a Date object according to a predefined format key.
 * @param {Date} date - The date to format.
 * @param {string} fmt - One of the supported format keys (e.g. "dd/MM/yyyy").
 * @returns {string} The formatted date string in French locale.
 */
export const formatDate = (date, fmt) => {
  const map = {
    "yyyy-MM-dd": { year: "numeric", month: "2-digit", day: "2-digit" },
    "dd/MM/yyyy": { day: "2-digit", month: "2-digit", year: "numeric" },
    "EEE dd/MM": { weekday: "short", day: "2-digit", month: "2-digit" },
    "EEE dd": { weekday: "short", day: "2-digit" },
    "HH:mm": { hour: "2-digit", minute: "2-digit", hour12: false },
    "MMMM yyyy": { month: "long", year: "numeric" },
    "EEEE dd MMMM": { weekday: "long", day: "numeric", month: "long" },
  };
  if (fmt === "yyyy-MM-dd") return date.toISOString().split("T")[0];
  return new Intl.DateTimeFormat("fr-FR", map[fmt] || {}).format(date);
};

/** Parse an ISO timestamp string into a Date. */
export const parseTimestamp = (ts) => new Date(ts);

/** Convert a Date to a "yyyy-MM-dd" string (local time). Returns "" for falsy input. */
export const toDateString = (date) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Return true if the given date falls on a Saturday or Sunday. */
export const isWeekend = (date) => [0, 6].includes(date.getDay());

/** Return true if the given date is today. */
export const isToday = (d) => d.toDateString() === new Date().toDateString();
