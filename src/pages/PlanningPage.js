// 📄 PlanningPage.js — Dossier : src/pages — Date : 2025-08-11
// 🎯 Objectifs : UI + perf + realtime (sans .module.css)
// - Filtres: Jour/Semaine, date, recherche (nom/badge), bouton Aujourd’hui
// - Pagination serveur (.range) + tri desc sur timestamp
// - Dédoublonnage souple par badge (fenêtre 2 min)
// - Temps réel (INSERT sur public.presences) : ajout en tête si dans la plage filtrée
// - Export CSV de la vue courante
// - Dark mode + responsive
//
// 🧩 Dépendances : date-fns (déjà), react-window (optionnel)
//    npm i react-window  # (facultatif) pour activer la virtualisation

// 🔹 Partie 1 — Imports & setup
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  format, parseISO, startOfDay, endOfDay,
  startOfWeek, endOfWeek, addDays, isWithinInterval
} from "date-fns";
import { fr } from "date-fns/locale";

// Essayer d'activer la virtualisation si react-window est installé
let VirtualList = null;
try {
  // eslint-disable-next-line
  // @ts-ignore
  VirtualList = require("react-window").FixedSizeList;
} catch (_) {
  VirtualList = null;
}

const PAGE_SIZE = 100;
const DEDUPE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

function PlanningPage() {
  // 🔹 Partie 2 — State & helpers

  // Filtres
  const [mode, setMode] = useState("day"); // 'day' | 'week'
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [search, setSearch] = useState("");
  const searchRef = useRef(search);

  // Données + pagination
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Intervalle temporel selon mode
  const range = useMemo(() => {
    if (mode === "week") {
      const s = startOfWeek(anchorDate, { weekStartsOn: 1 }); // Lundi
      const e = endOfWeek(anchorDate, { weekStartsOn: 1 });
      return { start: s, end: e };
    }
    return { start: startOfDay(anchorDate), end: endOfDay(anchorDate) };
  }, [mode, anchorDate]);

  // Formats FR
  const fmtDate = (d) => format(d, "dd/MM/yyyy", { locale: fr });
  const fmtTime = (d) => format(d, "HH:mm", { locale: fr });

  // 🔹 Partie 3 — Chargement paginé & temps réel

  async function fetchPage({ reset = false } = {}) {
    try {
      if (reset) {
        setLoading(true);
        setError(null);
        setPage(0);
      } else {
        setLoadingMore(true);
      }

      const from = (reset ? 0 : page) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error: err, count } = await supabase
        .from("presences")
        .select("*", { count: "exact" })
        .gte("timestamp", range.start.toISOString())
        .lt("timestamp", range.end.toISOString())
        .order("timestamp", { ascending: false })
        .range(from, to);

      if (err) throw err;

      setRows((prev) => (reset ? (data || []) : [...prev, ...(data || [])]));
      setTotal(count ?? null);
      if (reset) setPage(1);
      else setPage((p) => p + 1);
    } catch (e) {
      console.error("fetchPage error:", e);
      setError(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // Recharger quand filtres changent
  useEffect(() => {
    fetchPage({ reset: true });
    // eslint-disable-next-line
  }, [mode, anchorDate]);

  // Realtime: écouter INSERT
  useEffect(() => {
    const ch = supabase
      .channel("presences-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "presences" },
        (payload) => {
          const r = payload.new;
          const ts = new Date(r.timestamp);
          if (isWithinInterval(ts, { start: range.start, end: range.end })) {
            setRows((prev) => [r, ...prev]);
            setTotal((t) => (t == null ? null : t + 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [range.start, range.end]);

  // 🔹 Partie 4 — Dédoublonnage & filtrage

  const filtered = useMemo(() => {
    if (!rows?.length) return [];

    // Filtre texte local
    const q = (search || "").trim().toLowerCase();
    const filterText = (r) => {
      if (!q) return true;
      const hay = `${r.memberName ?? ""} ${r.badgeId ?? ""}`.toLowerCase();
      return hay.includes(q);
    };

    // Dédup sur 2 min par badge — on trie ASC pour comparer, puis on ré-inverse
    const sortedAsc = [...rows].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    const lastByBadge = new Map();
    const acc = [];
    for (const r of sortedAsc) {
      if (!filterText(r)) continue;
      const badge = r.badgeId ?? "_";
      const ts = new Date(r.timestamp).getTime();
      const lastTs = lastByBadge.get(badge);
      if (!lastTs || ts - lastTs > DEDUPE_WINDOW_MS) {
        acc.push(r);
        lastByBadge.set(badge, ts);
      }
    }
    return acc.reverse();
  }, [rows, search]);

  // Stats rapides
  const quickStats = useMemo(() => {
    const uniqueBadges = new Set();
    for (const r of filtered) {
      if (r.badgeId) uniqueBadges.add(r.badgeId);
    }
    return {
      count: filtered.length,
      uniques: uniqueBadges.size,
    };
  }, [filtered]);

  // Export CSV
  const exportCSV = () => {
    const header = ["Date", "Heure", "Nom", "BadgeId"];
    const lines = [header.join(";")];
    for (const r of filtered) {
      const d = new Date(r.timestamp);
      lines.push([fmtDate(d), fmtTime(d), r.memberName ?? "", r.badgeId ?? ""].join(";"));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `presences_${mode}_${format(anchorDate, "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Debounce simple recherche
  useEffect(() => {
    const id = setTimeout(() => {
      searchRef.current = search;
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  // Navigation dates
  const gotoToday = () => setAnchorDate(new Date());
  const prev = () => setAnchorDate((d) => addDays(d, mode === "week" ? -7 : -1));
  const next = () => setAnchorDate((d) => addDays(d, mode === "week" ? +7 : +1));

  // Rendu d'une ligne (pour virtualisation)
  const RowItem = ({ index, style }) => {
    const r = filtered[index];
    const d = new Date(r.timestamp);
    return (
      <div
        style={style}
        className="grid grid-cols-[1fr_120px_120px] md:grid-cols-[1fr_140px_160px] gap-3 px-3 items-center border-b border-gray-200 dark:border-neutral-800 text-sm"
      >
        <div className="truncate text-gray-900 dark:text-gray-100">
          {r.memberName ?? "—"}
        </div>
        <div className="text-gray-600 dark:text-gray-400">{fmtTime(d)}</div>
        <div className="text-gray-500 dark:text-gray-400">{r.badgeId ?? "—"}</div>
      </div>
    );
  };

  // 🔹 Partie 5 — UI
  return (
    <div className="p-4 sm:p-6 bg-gray-100 dark:bg-neutral-950 min-h-screen text-gray-900 dark:text-gray-100">
      {/* Barre d'outils sticky */}
      <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-gray-100/80 dark:bg-neutral-950/80 backdrop-blur border-b border-gray-200 dark:border-neutral-800">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="inline-flex rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <button
              className={`px-3 py-2 text-sm ${mode === "day" ? "bg-white dark:bg-neutral-900" : ""}`}
              onClick={() => setMode("day")}
            >
              Jour
            </button>
            <button
              className={`px-3 py-2 text-sm ${mode === "week" ? "bg-white dark:bg-neutral-900" : ""}`}
              onClick={() => setMode("week")}
            >
              Semaine
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 hover:bg-white/60 dark:hover:bg-neutral-900/60"
              title="Précédent"
            >
              ◀
            </button>
            <input
              type="date"
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
              value={format(anchorDate, "yyyy-MM-dd")}
              onChange={(e) => setAnchorDate(parseISO(e.target.value))}
            />
            <button
              onClick={next}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 hover:bg-white/60 dark:hover:bg-neutral-900/60"
              title="Suivant"
            >
              ▶
            </button>
            <button
              onClick={gotoToday}
              className="px-3 py-2 rounded-lg border border-blue-300 text-blue-700 dark:text-blue-400 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              Aujourd’hui
            </button>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <input
              type="search"
              placeholder="Rechercher (nom, badge)…"
              className="w-64 max-w-[60vw] px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              onClick={exportCSV}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 hover:bg-white/60 dark:hover:bg-neutral-900/60"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Période</div>
          <div className="text-sm font-semibold">
            {fmtDate(range.start)} → {fmtDate(range.end)}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Lignes (après dédup)</div>
          <div className="text-sm font-semibold">{filtered.length}</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Badges uniques</div>
          <div className="text-sm font-semibold">{quickStats.uniques}</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Total (serveur)</div>
          <div className="text-sm font-semibold">{total ?? "—"}</div>
        </div>
      </div>

      {/* Tableau / Liste */}
      <div className="mt-4 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_140px_160px] bg-gray-50 dark:bg-neutral-900 text-xs font-medium uppercase tracking-wide px-3 py-2 border-b border-gray-200 dark:border-neutral-800">
          <div>Nom</div>
          <div>Heure</div>
          <div>Badge</div>
        </div>

        {/* Virtualisation si dispo, sinon liste simple */}
        {VirtualList ? (
          <VirtualList
            height={520}
            itemCount={filtered.length}
            itemSize={56}
            width={"100%"}
          >
            {({ index, style }) => {
              const r = filtered[index];
              const d = new Date(r.timestamp);
              return (
                <div
                  style={style}
                  className="grid grid-cols-[1fr_120px_120px] md:grid-cols-[1fr_140px_160px] gap-3 px-3 py-0 items-center border-b border-gray-200 dark:border-neutral-800 text-sm"
                >
                  <div className="truncate">{r.memberName ?? "—"}</div>
                  <div className="text-gray-600 dark:text-gray-400">{fmtTime(d)}</div>
                  <div className="text-gray-500 dark:text-gray-400">{r.badgeId ?? "—"}</div>
                </div>
              );
            }}
          </VirtualList>
        ) : (
          <div>
            {filtered.map((r, i) => {
              const d = new Date(r.timestamp);
              return (
                <div
                  key={r.id ?? `${r.badgeId}-${i}`}
                  className="grid grid-cols-[1fr_120px_120px] md:grid-cols-[1fr_140px_160px] gap-3 px-3 py-3 items-center border-b border-gray-200 dark:border-neutral-800 text-sm"
                >
                  <div className="truncate">{r.memberName ?? "—"}</div>
                  <div className="text-gray-600 dark:text-gray-400">{fmtTime(d)}</div>
                  <div className="text-gray-500 dark:text-gray-400">{r.badgeId ?? "—"}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer pagination */}
        <div className="flex items-center justify-between px-3 py-3 bg-gray-50 dark:bg-neutral-900">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Chargées : {rows.length} / {total ?? "?"}
          </div>
          <button
            disabled={loadingMore || (total != null && rows.length >= total)}
            onClick={() => fetchPage()}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 disabled:opacity-50"
          >
            {loadingMore ? "Chargement..." : (total != null && rows.length >= total ? "Tout chargé" : "Charger plus")}
          </button>
        </div>
      </div>

      {/* États */}
      {loading && (
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Chargement…
        </div>
      )}
      {error && (
        <div className="mt-3 text-sm text-red-600 dark:text-red-400">
          Erreur : {error}
        </div>
      )}
    </div>
  );
}

export default PlanningPage;

// ✅ FIN DU FICHIER
