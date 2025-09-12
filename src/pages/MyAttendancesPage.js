// 📄 Fichier : src/pages/MyAttendancesPage.js
// 🎯 Objectif : Vue "Mes présences" (utilisateur simple) avec le DESIGN de l’onglet Admin
// 🌓 Dark mode : Contrastes corrigés (pas de texte noir sur fond sombre)
// 📱 Mobile : Grilles et tailles adaptées (XS/SM/MD/LG), no overflow

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import {
  FaCalendarAlt,
  FaIdCard,
  FaUser,
  FaRedoAlt,
  FaClock,
  FaFireAlt,
  FaChartBar,
} from "react-icons/fa";

/* -------------------------------------------
   Helpers de date
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
  const dayNames = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
  const peakDay = dayNames[weeklyDistribution.indexOf(Math.max(...weeklyDistribution))] || "";

  const dailyStats = Object.entries(dailyPresences)
    .map(([date, visits]) => ({
      date: new Date(date),
      visits: visits.length,
      first: visits[visits.length - 1]?.parsedDate,
      last: visits[0]?.parsedDate,
    }))
    .sort((a, b) => b.date - a.date);

  const firstVisit = presences[presences.length - 1]?.parsedDate || null;
  const lastVisit = presences[0]?.parsedDate || null;

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
   UI Subcomponents
-------------------------------------------- */
function StatTile({ icon: Icon, title, value, accent = "indigo" }) {
  const gradient =
    accent === "green"
      ? "from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/20"
      : accent === "purple"
      ? "from-purple-50 to-fuchsia-50 dark:from-purple-900/30 dark:to-fuchsia-900/20"
      : accent === "orange"
      ? "from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20"
      : "from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/20";

  const iconBg =
    accent === "green"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
      : accent === "purple"
      ? "bg-purple-500/15 text-purple-600 dark:text-purple-300"
      : accent === "orange"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
      : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300";

  return (
    <div className={`p-4 rounded-2xl border dark:border-gray-700 shadow-sm bg-gradient-to-br ${gradient}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className="text-lg" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">
            {title}
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
        </div>
      </div>
    </div>
  );
}

function BarRow({ label, value, max }) {
  const width = max ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="w-10 text-xs text-gray-600 dark:text-gray-300">{label}</div>
      <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="w-10 text-right text-xs text-gray-600 dark:text-gray-300">{value}</div>
    </div>
  );
}

function HourCell({ hour, count, max }) {
  const alpha = max ? 0.15 + (count / max) * 0.6 : 0.15;
  return (
    <div className="flex flex-col items-center">
      <div className="text-[10px] text-gray-600 dark:text-gray-300 mb-1">{hour}h</div>
      <div
        className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center shadow-sm"
        style={{ background: `rgba(99,102,241,${alpha})` }} // indigo
        title={`${count} visite${count > 1 ? "s" : ""}`}
      >
        <span className="text-xs font-semibold text-gray-900 dark:text-white">{count || ""}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------
   PAGE
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
  const memberName =
    userMemberData?.firstname || userMemberData?.lastname
      ? `${userMemberData?.firstname || ""} ${userMemberData?.lastname || ""}`.trim()
      : user?.email || "Utilisateur";

  const memberPhoto = userMemberData?.photo || "";

  useEffect(() => {
    const fetchPresences = async () => {
      if (!user || !badgeId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("presences")
          .select("*")
          .eq("badgeId", badgeId) // 🔁 switch possible par email si ta table le permet
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

  // Raccourcis période
  const setDays = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    setRange({ start: formatIntl(start, "yyyy-MM-dd"), end: formatIntl(end, "yyyy-MM-dd") });
  };

  const setMonths = (months) => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    setRange({ start: formatIntl(start, "yyyy-MM-dd"), end: formatIntl(end, "yyyy-MM-dd") });
  };

  const dayLabels = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];

  return (
    <div className="p-4 md:p-6 text-gray-900 dark:text-gray-100">
      {/* Header + fiche mini */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Mes présences</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Consultez vos statistiques et l’historique de vos visites.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium">{memberName}</div>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Badge : {badgeId || "—"}
            </div>
          </div>
          <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-white dark:ring-gray-700 shadow-lg flex-shrink-0">
            {memberPhoto ? (
              <img
                src={memberPhoto}
                alt="avatar"
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-400">
                <FaUser />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bloc "Suivi des présences" */}
      <div className="rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm mb-6">
        <div className="px-4 md:px-6 py-4 border-b dark:border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
              <FaChartBar />
            </div>
            <div>
              <div className="text-sm font-semibold">Suivi des présences</div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                Membre : {memberName} {badgeId ? `(Badge : ${badgeId})` : ""}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <button
              className="text-xs px-3 py-1.5 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 dark:text-gray-100"
              onClick={() => setDays(7)}
            >
              7 derniers jours
            </button>
            <button
              className="text-xs px-3 py-1.5 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 dark:text-gray-100"
              onClick={() => setDays(30)}
            >
              30 derniers jours
            </button>
            <button
              className="text-xs px-3 py-1.5 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 dark:text-gray-100"
              onClick={() => setMonths(3)}
            >
              3 derniers mois
            </button>

            <div className="flex items-end gap-2">
              <div className="flex flex-col">
                <label className="text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                  Début
                </label>
                <input
                  type="date"
                  value={range.start}
                  onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
                  className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                  Fin
                </label>
                <input
                  type="date"
                  value={range.end}
                  onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
                  className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
              <button
                onClick={() => setRange((r) => ({ ...r }))}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                title="Actualiser"
              >
                <FaRedoAlt /> Actualiser
              </button>
            </div>
          </div>
        </div>

        {/* Tuiles récap */}
        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          <StatTile icon={FaCalendarAlt} title="Total visites" value={stats.totalVisits} accent="indigo" />
          <StatTile icon={FaIdCard} title="Jours uniques" value={stats.uniqueDays} accent="green" />
          <StatTile icon={FaClock} title="Moyenne / jour" value={stats.avgVisitsPerDay} accent="purple" />
          <StatTile icon={FaFireAlt} title="Heure favorite" value={stats.peakHour >= 0 ? `${stats.peakHour}h` : "-"} accent="orange" />
        </div>
      </div>

      {/* États simples */}
      {!user && (
        <div className="p-4 rounded-2xl border dark:border-gray-700 bg-yellow-50 text-yellow-900 mb-6">
          Vous devez être connecté pour voir vos présences.
        </div>
      )}
      {user && !userMemberData && (
        <div className="p-4 rounded-2xl border dark:border-gray-700 bg-yellow-50 text-yellow-900 mb-6">
          Aucun profil membre lié à votre compte. Contactez un administrateur.
        </div>
      )}
      {user && userMemberData && !badgeId && (
        <div className="p-4 rounded-2xl border dark:border-gray-700 bg-yellow-50 text-yellow-900 mb-6">
          Aucun badge n’est associé à votre profil. Contactez un administrateur.
        </div>
      )}

      {/* Loader */}
      {loading && (
        <div className="my-6 text-sm text-gray-600 dark:text-gray-300">Chargement…</div>
      )}

      {/* Contenu principal */}
      {!loading && user && userMemberData && badgeId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Répartition par jour */}
          <div className="p-4 md:p-6 rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <div className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Répartition par jour de la semaine
            </div>
            {(() => {
              const max = Math.max(...stats.weeklyDistribution);
              return dayLabels.map((lbl, idx) => (
                <BarRow key={lbl} label={lbl} value={stats.weeklyDistribution[idx] || 0} max={max} />
              ));
            })()}
            {stats.peakDay && (
              <div className="mt-4 text-sm text-indigo-700 dark:text-indigo-300">
                Jour préféré : {stats.peakDay}
              </div>
            )}
          </div>

          {/* Répartition par heure */}
          <div className="p-4 md:p-6 rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <div className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Répartition par heure
            </div>
            <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
              {Array.from({ length: 24 }).map((_, h) => (
                <HourCell
                  key={h}
                  hour={h}
                  count={stats.hourlyDistribution[h] || 0}
                  max={Math.max(...stats.hourlyDistribution)}
                />
              ))}
            </div>
            {stats.peakHour >= 0 && (
              <div className="mt-4 text-sm text-purple-700 dark:text-purple-300">
                Heure de pointe : {stats.peakHour}h
              </div>
            )}
          </div>

          {/* Historique des visites */}
          <div className="lg:col-span-2 p-4 md:p-6 rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <div className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Historique des visites
            </div>
            {stats.dailyStats.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Aucune visite sur la période sélectionnée.
              </div>
            ) : (
              <ul className="divide-y dark:divide-gray-700">
                {stats.dailyStats.map((d) => {
                  const k = d.date.toISOString();
                  return (
                    <li key={k} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100 flex-shrink-0">
                          {formatIntl(d.date, "dd/MM/yyyy")}
                        </div>
                        <div className="text-sm min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {formatIntl(d.date, "EEEE dd MMMM")}
                          </div>
                          <div className="text-gray-600 dark:text-gray-300 text-xs">
                            {d.visits} visite{d.visits > 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-800 dark:text-gray-200 flex-shrink-0">
                        {d.first && `Arrivée : ${formatIntl(d.first, "HH:mm")}`}
                        {d.last && d.first !== d.last && ` — Dernier badge : ${formatIntl(d.last, "HH:mm")}`}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ✅ FIN DU FICHIER
