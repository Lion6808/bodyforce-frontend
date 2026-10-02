// ===================================================================
// Planning — accès aux données et règles d'affichage
// -------------------------------------------------------------------
// RPC (Script/sql/2026-10-02_planning_refonte.sql) :
//   - get_planning_passages(p_start, p_end) : passages d'une journée avec
//     le titulaire du badge À LA DATE du passage (via badge_history)
//   - get_planning_anomalies(p_days)        : points de la vue Contrôle
//   - table planning_anomaly_seen           : points marqués « vu »
// RPC existante : get_member_presences(p_member_id) pour l'assiduité.
// ===================================================================

import { supabase } from "../../supabaseClient";
import { isMemberActive } from "../../utils/memberRules";
import { toDateString } from "../../utils/dateUtils";

// -------------------------------------------------------------------
// Dates et formats
// -------------------------------------------------------------------

export const startOfLocalDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const endOfLocalDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const sameDay = (a, b) => toDateString(a) === toDateString(b);

export const dayKey = (ts) => toDateString(new Date(ts));

export const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** "Vendredi 2 octobre" */
export const fmtDayLong = (d) => {
  const s = new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "02/10/2026" à partir d'une date ou d'une chaîne "yyyy-MM-dd" */
export const fmtDate = (d) => {
  if (!d) return "";
  const s = String(d).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, j] = s.split("-");
    return `${j}/${m}/${y}`;
  }
  return new Date(d).toLocaleDateString("fr-FR");
};

/** "Aujourd'hui, 18:42" / "Hier, 18:05" / "Lundi 28/09, 18:12" */
export const fmtRelative = (ts, now = new Date()) => {
  const d = new Date(ts);
  if (sameDay(d, now)) return `Aujourd'hui, ${fmtTime(d)}`;
  if (sameDay(d, addDays(now, -1))) return `Hier, ${fmtTime(d)}`;
  const wd = d.toLocaleDateString("fr-FR", { weekday: "long" });
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)} ${d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  })}, ${fmtTime(d)}`;
};

export const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export const fullName = (m) =>
  [m?.first_name ?? m?.firstName, m?.name].filter(Boolean).join(" ") || "Sans nom";

// -------------------------------------------------------------------
// Journée : passages
// -------------------------------------------------------------------

export async function fetchDayPassages(day) {
  const { data, error } = await supabase.rpc("get_planning_passages", {
    p_start: startOfLocalDay(day).toISOString(),
    p_end: endOfLocalDay(day).toISOString(),
  });
  if (error) throw new Error(`Passages du jour : ${error.message}`);
  return data || [];
}

/** Heure du dernier passage enregistré (fraîcheur de la synchro Intratone). */
export async function fetchLastPassageTime() {
  const { data, error } = await supabase
    .from("presences")
    .select("timestamp")
    .order("timestamp", { ascending: false })
    .limit(1);
  if (error) return null;
  return data?.[0]?.timestamp || null;
}

/**
 * Catégorie d'un passage pour les filtres et étiquettes :
 * exit (bouton poussoir), inconnu, maintenance, comite, adherent.
 */
export const passageKind = (row) => {
  if (!row.badge_id) return "exit";
  if (!row.member_id) return "inconnu";
  return row.member_type || "adherent";
};

/** Passage d'un adhérent dont l'abonnement n'était plus valide ce jour-là. */
export const isInvalidPassage = (row) =>
  passageKind(row) === "adherent" && !isMemberActive({ endDate: row.end_date }, new Date(row.ts));

export const FILTERS = [
  { id: "all", label: "Tous" },
  { id: "adherent", label: "Adhérents" },
  { id: "comite", label: "Comité" },
  { id: "maintenance", label: "Maintenance" },
  { id: "inconnu", label: "Inconnus" },
];

// -------------------------------------------------------------------
// Contrôle : anomalies + « Marquer vu »
// -------------------------------------------------------------------

export const CONTROL_DAYS = 30;

export async function fetchAnomalies() {
  const { data, error } = await supabase.rpc("get_planning_anomalies", { p_days: CONTROL_DAYS });
  if (error) throw new Error(`Contrôle : ${error.message}`);
  return data || {};
}

/** { key: seen_at } */
export async function fetchSeen() {
  const { data, error } = await supabase
    .from("planning_anomaly_seen")
    .select("key,seen_at")
    .limit(1000);
  if (error) throw new Error(`Points vus : ${error.message}`);
  const map = {};
  (data || []).forEach((r) => {
    map[r.key] = r.seen_at;
  });
  return map;
}

export async function markSeen(key) {
  const { error } = await supabase
    .from("planning_anomaly_seen")
    .upsert({ key, seen_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export async function unmarkSeen(key) {
  const { error } = await supabase.from("planning_anomaly_seen").delete().eq("key", key);
  if (error) throw new Error(error.message);
}

/**
 * Sections de la vue Contrôle. Un point marqué vu se rouvre si un
 * nouveau passage arrive après la date où il a été vu.
 */
export function buildControlSections(anomalies, seen) {
  const isDone = (key, lastTs) => !!seen[key] && new Date(seen[key]) >= new Date(lastTs);

  const sections = [
    {
      id: "expired",
      tone: "orange",
      title: "Abonnement expiré, mais passe encore",
      hint: "Le badge ouvre toujours la porte après la date de fin.",
      items: (anomalies.expired || []).map((x) => ({
        key: `expired:${x.member_id}`,
        who: fullName(x),
        member: { id: x.member_id, name: x.name, first_name: x.first_name, member_type: "adherent" },
        detail: `${x.end_date ? `Expiré le ${fmtDate(x.end_date)}` : "Sans date de fin"} · ${plural(
          x.count,
          "passage",
          "passages"
        )} depuis · dernier ${fmtRelative(x.last_ts).toLowerCase()}`,
        lastTs: x.last_ts,
        action: { type: "member", label: "Voir la fiche", memberId: x.member_id },
      })),
    },
    {
      id: "unknown",
      tone: "orange",
      title: "Badge non attribué",
      hint: "Un badge passe mais n'appartient à aucune fiche.",
      items: (anomalies.unknown || []).map((x) => ({
        key: `unknown:${x.badge_id}`,
        who: `Badge ${x.badge_id}`,
        badgeId: x.badge_id,
        detail: `${plural(x.count, "passage", "passages")} · dernier ${fmtRelative(x.last_ts).toLowerCase()}`,
        lastTs: x.last_ts,
        action: { type: "copy", label: "Copier le n° de badge", value: x.badge_id },
      })),
    },
    {
      id: "night",
      tone: "blue",
      title: "Passage de nuit",
      hint: "En dehors de 6 h – 23 h.",
      items: (anomalies.night || []).map((x) => ({
        key: `night:${x.presence_id}`,
        who: x.member_id ? fullName(x) : `Badge ${x.badge_id}`,
        member: x.member_id ? { id: x.member_id, name: x.name, first_name: x.first_name } : null,
        badgeId: x.badge_id,
        detail: fmtRelative(x.ts),
        lastTs: x.ts,
        action: { type: "day", label: "Voir la journée", day: x.ts },
      })),
    },
    {
      id: "period",
      tone: "gray",
      title: "Badge utilisé hors de sa période",
      hint: "Passage avant la date d'attribution ou après la reprise du badge : à corriger dans l'historique des badges.",
      items: (anomalies.out_of_period || []).map((x) => ({
        key: `period:${x.badge_id}`,
        who: `Badge ${x.badge_id}`,
        badgeId: x.badge_id,
        detail: `${plural(x.count, "passage", "passages")} sans titulaire à cette date · du ${fmtDate(
          x.first_ts
        )} au ${fmtDate(x.last_ts)}`,
        lastTs: x.last_ts,
        action: { type: "copy", label: "Copier le n° de badge", value: x.badge_id },
      })),
    },
  ];

  let remaining = 0;
  sections.forEach((s) =>
    s.items.forEach((it) => {
      it.done = isDone(it.key, it.lastTs);
      if (!it.done) remaining++;
    })
  );
  return { sections: sections.filter((s) => s.items.length > 0), remaining };
}

// -------------------------------------------------------------------
// Membre : assiduité
// -------------------------------------------------------------------

export async function fetchMemberLite(memberId) {
  const { data, error } = await supabase
    .from("members")
    .select("id,name,firstName,endDate,member_type")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw new Error(`Membre : ${error.message}`);
  return data;
}

/** Liste légère pour la recherche (sans photo). */
export async function fetchMembersIndex() {
  const { data, error } = await supabase
    .from("members")
    .select("id,name,firstName,badgeId,badge_number,member_type,endDate")
    .order("name", { ascending: true })
    .limit(2000);
  if (error) throw new Error(`Membres : ${error.message}`);
  return data || [];
}

export async function fetchMemberTimestamps(memberId, from, to) {
  const { data, error } = await supabase
    .rpc("get_member_presences", { p_member_id: memberId })
    .gte("timestamp", from.toISOString())
    .lte("timestamp", to.toISOString())
    .order("timestamp", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`Présences : ${error.message}`);
  return (data || []).map((p) => p.timestamp);
}

/** Lundi (00:00) de la semaine d'une date. */
const weekStart = (d) => {
  const x = startOfLocalDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

/**
 * Indicateurs d'assiduité à partir des horodatages (triés du plus récent au plus ancien).
 * Un jour de venue = un jour avec au moins un passage.
 */
export function computeAttendance(timestamps, member, now = new Date()) {
  const days = new Set(timestamps.map(dayKey));
  const since30 = startOfLocalDay(addDays(now, -29));
  const since90 = startOfLocalDay(addDays(now, -89));

  const days30 = [...days].filter((k) => k >= toDateString(since30)).length;

  // Semaines consécutives avec au moins une venue (semaine en cours ignorée si vide)
  const weeks = new Set(timestamps.map((t) => toDateString(weekStart(new Date(t)))));
  let cursor = weekStart(now);
  if (!weeks.has(toDateString(cursor))) cursor = addDays(cursor, -7);
  let streak = 0;
  while (weeks.has(toDateString(cursor))) {
    streak++;
    cursor = addDays(cursor, -7);
  }

  // Habitudes sur 90 jours : jours de venue par jour de semaine (lundi d'abord)
  const week = [0, 0, 0, 0, 0, 0, 0];
  const hours = {};
  const firstByDay = {};
  timestamps.forEach((t) => {
    const d = new Date(t);
    if (d < since90) return;
    const k = dayKey(t);
    if (!firstByDay[k] || d < firstByDay[k]) firstByDay[k] = d;
  });
  Object.values(firstByDay).forEach((d) => {
    week[(d.getDay() + 6) % 7]++;
    hours[d.getHours()] = (hours[d.getHours()] || 0) + 1;
  });
  const visits90 = Object.keys(firstByDay).length;
  let slot = "—";
  if (visits90 > 0) {
    const h = Number(Object.entries(hours).sort((a, b) => b[1] - a[1])[0][0]);
    const weekend = week[5] + week[6];
    slot = `${weekend / visits90 > 0.6 ? "Week-end, " : ""}${h} h – ${h + 1} h`;
  }

  // Passages après l'expiration (adhérent dont l'abonnement est échu)
  let regularity = streak > 0 ? plural(streak, "semaine d'affilée", "semaines d'affilée") : "Aucune cette semaine";
  const expired = member && !isMemberActive(member, now);
  if (expired && (member.member_type || "adherent") === "adherent") {
    const end = member.endDate ? String(member.endDate).slice(0, 10) : null;
    const after = end ? timestamps.filter((t) => dayKey(t) >= end).length : timestamps.length;
    regularity = plural(after, "passage depuis l'expiration", "passages depuis l'expiration");
  }

  return {
    days30,
    avg: `${(days30 / (30 / 7)).toFixed(1).replace(".", ",")} / sem.`,
    last: timestamps[0] ? fmtRelative(timestamps[0], now) : "—",
    regularity,
    week,
    slot,
  };
}
