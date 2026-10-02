// Recherche avancée de membres (jokers * et ?, ancres ^ $, ET / OU) — commune aux pages
// Membres, Paiements et Planning.
// Un nombre de 1 à 4 chiffres = n° de badge COURT (égalité exacte, ex. 167) ;
// un nombre plus long = badge LONG (même partiel, ex. 2208428).



/**
 * Normalise a string for accent-insensitive, lowercase comparison.
 * @param {string} s - Input string.
 * @returns {string} Normalised string.
 */
export const normalize = (s = "") =>
  s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Escape regex-special characters but leave the wildcards * and ? intact. */
export const escapeForWildcard = (s) => s.replace(/[-/\\^$+.()|[\]{}]/g, "\\$&");

/**
 * Convert a single user-facing search token to a RegExp.
 * Supports `*` (any chars), `?` (one char), `^` / `$` anchors.
 * @param {string} tokenRaw - Raw token typed by the user.
 * @returns {RegExp|null}
 */
export const tokenToRegex = (tokenRaw) => {
  if (!tokenRaw) return null;
  let t = tokenRaw.trim();
  // N° de badge court : comparé tel quel au champ badge_number
  if (/^\d{1,4}$/.test(t)) {
    const rx = new RegExp("^" + t + "$");
    rx.shortBadge = String(Number(t));
    return rx;
  }
  const anchoredStart = t.startsWith("^");
  const anchoredEnd = t.endsWith("$");
  if (anchoredStart) t = t.slice(1);
  if (anchoredEnd) t = t.slice(0, -1);
  t = escapeForWildcard(t);
  t = t.replace(/\*/g, ".*").replace(/\?/g, ".");
  if (!anchoredStart) t = ".*" + t;
  if (!anchoredEnd) t = t + ".*";
  return new RegExp("^" + t + "$", "i");
};

/**
 * Parse a search string into an array of OR-clauses.
 * Each clause is an array of RegExp (AND tokens).
 * @param {string} search - Raw search input.
 * @returns {RegExp[][]}
 */
export const parseSearch = (search) => {
  const raw = (search || "").trim();
  if (!raw) return [];
  const orClauses = raw
    .split(/\s+OR\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);
  return orClauses.map((clause) =>
    clause
      .split(/\s+/)
      .map((tok) => tok.trim())
      .filter(Boolean)
      .map(tokenToRegex)
      .filter(Boolean)
  );
};

/**
 * Test whether a member matches a set of compiled search clauses.
 * @param {object} member - Member record.
 * @param {RegExp[][]} compiledClauses - Output of parseSearch().
 * @returns {boolean}
 */
export const matchesSearch = (member, compiledClauses) => {
  if (!compiledClauses.length) return true;
  const haystack = normalize(
    [member.name, member.firstName, member.badgeId, member.email, member.mobile]
      .filter(Boolean)
      .join(" ")
  );
  const shortBadge = member.badge_number != null ? String(member.badge_number) : null;
  return compiledClauses.some((tokens) =>
    tokens.every((rx) => (rx.shortBadge ? rx.shortBadge === shortBadge : rx.test(haystack)))
  );
};

/**
 * Analyse raw search text and return metadata for the SearchHints component.
 * @param {string} raw - Raw search input.
 * @returns {{ active: boolean, clauses: string[][], hasWildcards: boolean, hasAnchors: boolean }}
 */
export const analyzeSearch = (raw) => {
  const text = (raw || "").trim();
  if (!text)
    return { active: false, clauses: [], hasWildcards: false, hasAnchors: false };
  const orParts = text
    .split(/\s+OR\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const clauses = orParts.map((p) =>
    p.split(/\s+/).map((t) => t.trim()).filter(Boolean)
  );
  return {
    active: true,
    clauses,
    hasWildcards: /[*?]/.test(text),
    hasAnchors: /(\^|\$)/.test(text),
  };
};
