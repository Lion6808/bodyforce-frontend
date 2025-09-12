// 📄 Fichier : src/pages/MyAttendancesPage.js
// 🧩 Type   : React Page
// 📁 Dossier: src/pages
// 📆 Date   : 2025-09-12
//
// ✅ Contenu complet, prêt à coller tel quel
// - Lecture des présences de l’utilisateur connecté (badgeId depuis AuthContext.userMemberData)
// - Filtres de dates, bouton Actualiser
// - Tuiles statistiques (Total, Jours uniques, Moyenne/jour, Heure favorite)
// - Répartition par jour de la semaine (barres)
// - Répartition par heure (grille 24h)
// - Historique des visites (liste triée desc.)
// - Compatible dark mode (classes Tailwind `dark:`)
// - Aucune dépendance extérieure supplémentaire

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";

/* -------------------------------------------
   Helpers de date (alignés avec MemberFormPage)
-------------------------------------------- */
const formatIntl = (date, fmt) => {
  try {
    const map = {
      "yyyy-MM-dd": { year: "numeric", month: "2-digit", day: "2-digit" },
      "dd/MM/yyyy": { day: "2-digit", month: "2-digit", year: "numeric" },
      "HH:mm": { hour: "2-digit", minute: "2-digit", hour12: false },
      "MMMM yyyy": { month: "long", year: "numeric" },
      "EEEE dd MMMM": { weekday: "long", day: "numeric", month: "long" },
    };
    if (fmt === "yyyy-MM-dd") return date.toISOString().split("T")[0];
    return new Intl.DateTimeFormat("fr-FR", map[fmt] || {}).format(date);
  } catch {
    return "";
  }
};

const toDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseTimestamp = (ts) => new Date(ts);

/* ------------------------------------------------------
   Calcul des statistiques (équivalent onglet "Présence")
------------------------------------------------------- */
const calculateAttendanceStats = (presences) => {
  if (!presences || !presences.length) {
    return {
      totalVisits: 0,
      uniqueDays: 0,
      avgVisitsPerDay: 0,
      peakHour: -1,
      peakDay: "",
      firstVisit: null,
      lastVisit: null,
      dailyStats: [],
      hourlyDistribution: new Array(24).fill(0),
      weeklyDistribution: new Array(7).fill(0),
    };
  }

  const dailyPresences = {};
  const hourlyDistribution = new Array(24).fill(0);
  const weeklyDistribution = new Array(7).fill(0); // 0=Dim .. 6=Sam

  presences.forEach((p) => {
    const d = p.parsedDate;
    const dateKey = toDateString(d);
    (dailyPresences[dateKey] ||= []).push(p);
    hourlyDistribution[d.getHours()] += 1;
    weeklyDistribution[d.getDay()] += 1;
  });

  const totalVisits = presences.length;
  const uniqueDays = Object.keys(dailyPresences).length;
  const avgVisitsPerDay = uniqueDays ? Math.round((totalVisits / uniqueDays) * 10) / 10 : 0;

  const peakHour = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));
  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const peakDay = dayNames[weeklyDistribution.indexOf(Math.max(...weeklyDistribution))] || "";

  const dailyStats = Object.entries(dailyPresences)
    .map(([date, visits]) => ({
      date: new Date(date),
      visits: visits.length,
      first: visits[visits.length - 1]?.parsedDate, // arrivée la plus tôt dans la journée (car data triée desc ensuite)
      last: visits[0]?.parsedDate,                   // dernier badge de la journée
    }))
    .sort((a, b) => b.date - a.date);

  const firstVisit = presences[presences.length - 1]?.parsedDate || null; // plus ancienne dans l’intervalle
  const lastVisit = presences[0]?.parsedDate || null;                      // plus récente

  return {
    totalVisits,
    uniqueDays,
    avgVisitsPerDay,
    peakHour,
    peakDay,
    firstVisit,
    lastVisit,
    dailyStats,
    hourlyDistribution,
    weeklyDistribution,
  };
};

/* -------------------------------------------
   PETIT COMPOSANT : StatCard (tuile)
-------------------------------------------- */
function StatCard({ title, value }) {
  return (
    <div className="p-4 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700">
      <div className="text-xs text-gray-500 dark:text-gray-400">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

/* -------------------------------------------
   PAGE : MyAttendancesPage
-------------------------------------------- */
export default function MyAttendancesPage() {
  const { user, userMemberData } = useAuth();
  const [range, setRange] = useState(() => {
    const today = new Date();
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return {
      start: formatIntl(monthAgo, "yyyy-MM-dd"),
      end: formatIntl(today, "yyyy-MM-dd"),
    };
  });
  const [loading, setLoading] = useState(false);
  const [presences, setPresences] = useState([]);
  const stats = useMemo(() => calculateAttendanceStats(presences), [presences]);

  const badgeId = userMemberData?.badgeId || null;
  // 🔁 Si tu préfères filtrer par email côté table `presences`, remplace la requête par:
  // .eq("email", user?.email)

  useEffect(() => {
    const fetchPresences = async () => {
      if (!user) return;
      if (!badgeId) return; // pas de badge lié -> rien à afficher

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("presences")
          .select("*")
          .eq("badgeId", badgeId) // ⬅️ switch possible vers .eq("email", user.email)
          .gte("timestamp", `${range.start}T00:00:00`)
          .lte("timestamp", `${range.end}T23:59:59`)
          .order("timestamp", { ascending: false });

        if (error) {
          console.error("[MyAttendances] Supabase error:", error);
          setPresences([]);
        } else {
          const list = (data || []).map((p) => ({
            ...p,
            parsedDate: parseTimestamp(p.timestamp),
          }));
          setPresences(list);
        }
      } catch (e) {
        console.error("[MyAttendances] fetchPresences exception:", e);
        setPresences([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPresences();
  }, [user, badgeId, range.start, range.end]);

  return (
    <div className="p-4 md:p-6">
      {/* Titre + période choisie */}
      <div className="mb-4">
        <h1 className="text-xl md:text-2xl font-semibold">Mes présences</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Visualisez vos visites et statistiques d’assiduité.
        </p>
      </div>

      {/* Bandeau filtres & action */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end justify-between mb-4">
        <div className="flex gap-3">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">Début</label>
            <input
              type="date"
              value={range.start}
              onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
              className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fin</label>
            <input
              type="date"
              value={range.end}
              onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
              className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
        </div>

        <button
          onClick={() => setRange((r) => ({ ...r }))} // force refresh (inutile mais explicite)
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99]"
        >
          Actualiser
        </button>
      </div>

      {/* États */}
      {!user && (
        <div className="p-4 rounded-xl border bg-yellow-50 text-yellow-800">
          Vous devez être connecté pour voir vos présences.
        </div>
      )}
      {user && !userMemberData && (
        <div className="p-4 rounded-xl border bg-yellow-50 text-yellow-800">
          Aucun profil membre lié à votre compte. Contactez un administrateur.
        </div>
      )}
      {user && userMemberData && !badgeId && (
        <div className="p-4 rounded-xl border bg-yellow-50 text-yellow-800">
          Aucun badge n’est associé à votre profil. Contactez un administrateur.
        </div>
      )}

      {/* Loader */}
      {loading && (
        <div className="my-6 text-sm text-gray-500 dark:text-gray-400">Chargement…</div>
      )}

      {/* Contenu principal (stats + répartitions + historique) */}
      {!loading && user && userMemberData && badgeId && (
        <>
          {/* Tuiles récap */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
            <StatCard title="Total visites" value={stats.totalVisits} />
            <StatCard title="Jours uniques" value={stats.uniqueDays} />
            <StatCard title="Moyenne/jour" value={stats.avgVisitsPerDay} />
            <StatCard title="Heure favorite" value={stats.peakHour >= 0 ? `${stats.peakHour}h` : "-"} />
          </div>

          {/* Répartition par jour de la semaine */}
          <div className="p-4 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 mb-6">
            <h4 className="font-semibold mb-3">Répartition par jour de la semaine</h4>
            {(() => {
              const labels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
              const max = Math.max(...stats.weeklyDistribution);
              return labels.map((label, idx) => {
                const val = stats.weeklyDistribution[idx] || 0;
                const width = max ? (val / max) * 100 : 0;
                return (
                  <div key={label} className="flex items-center gap-3 my-1">
                    <div className="w-10 text-xs text-gray-500 dark:text-gray-400">{label}</div>
                    <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 dark:bg-green-400 transition-all"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className="w-8 text-right text-xs text-gray-500 dark:text-gray-400">
                      {val}
                    </div>
                  </div>
                );
              });
            })()}
            {stats.peakDay && (
              <div className="mt-3 text-sm text-blue-600 dark:text-blue-300">
                Jour préféré : {stats.peakDay}
              </div>
            )}
          </div>

          {/* Répartition par heure */}
          <div className="p-4 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 mb-6">
            <h4 className="font-semibold mb-3">Répartition par heure</h4>
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
              {Array.from({ length: 24 }).map((_, hour) => {
                const count = stats.hourlyDistribution[hour] || 0;
                const max = Math.max(...stats.hourlyDistribution);
                const alpha = max ? 0.15 + (count / max) * 0.6 : 0.15;
                return (
                  <div key={hour} className="flex flex-col items-center">
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">{hour}h</div>
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: `rgba(99,102,241,${alpha})` }} // indigo-500 en rgba
                      title={`${count} visite${count > 1 ? "s" : ""}`}
                    >
                      <span className="text-xs font-semibold">{count || ""}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {stats.peakHour >= 0 && (
              <div className="mt-3 text-sm text-purple-600 dark:text-purple-300">
                Heure de pointe : {stats.peakHour}h
              </div>
            )}
          </div>

          {/* Historique des visites */}
          <div className="p-4 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700">
            <h4 className="font-semibold mb-3">Historique des visites</h4>
            {stats.dailyStats.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Aucune visite sur la période sélectionnée.
              </div>
            ) : (
              <ul className="divide-y dark:divide-gray-700">
                {stats.dailyStats.map((d) => {
                  const k = d.date.toISOString();
                  return (
                    <li key={k} className="py-3 flex items-center justify-between">
                      <div className="text-sm">
                        <div className="font-medium">
                          {formatIntl(d.date, "EEEE dd MMMM")}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs">
                          {d.visits} visite{d.visits > 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">
                        {d.first && `Arrivée: ${formatIntl(d.first, "HH:mm")}`}
                        {d.last && d.first !== d.last && ` – Dernier badge: ${formatIntl(d.last, "HH:mm")}`}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ✅ FIN DU FICHIER
