// 📄 Fichier : PlanningPage.js
// 🗂️ Dossier : src/pages
// 📅 Date : 2025-08-11
// 🎯 Objet : Planning — 100% Tailwind (sans .module.css) en conservant TOUTES les fonctionnalités d’origine
// 🔧 Dépendances : date-fns, lucide-react, xlsx, supabaseClient
// 🖤 Dark mode : classes `dark:`
// 📱 Responsive : classes Tailwind (sm:, md:, lg:), auto vue mobile
// ⚡ Perf : pagination serveur (.range), dédoublonnage client (2 min), temps réel INSERT, export CSV, import XLSX (admin)
// ───────────────────────────────────────────────────────────────
// 🔹 Partie 1 — Imports, helpers & constantes
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import * as XLSX from "xlsx";
import {
  Calendar,
  Users,
  Filter,
  Grid as GridIcon,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Upload,
  Download,
  Clock,
  Image as ImageIcon,
  Search,
} from "lucide-react";
import {
  format,
  parseISO,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  subWeeks,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isWithinInterval,
} from "date-fns";
import { fr } from "date-fns/locale";

// Virtualisation optionnelle si 'react-window' est installé
let VirtualList = null;
try {
  // eslint-disable-next-line
  // @ts-ignore
  VirtualList = require("react-window").FixedSizeList;
} catch (_) {
  VirtualList = null;
}

const PAGE_SIZE = 100;               // page côté serveur
const DEDUPE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes pour dédoublage
const MAX_BATCH_INSERT = 500;        // insert Supabase en lot pour import XLSX

// Formatage FR
const fmt = (d, pattern) => format(d, pattern, { locale: fr });

// Convertisseur robuste de timestamp (gère variantes ISO +Z/+00)
const parseTimestamp = (timestamp) => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;

  if (typeof timestamp === "string") {
    try {
      // normalise certains formats avec +00 / +00:00
      if (timestamp.includes("T")) {
        const d = new Date(timestamp);
        if (!isNaN(d)) return d;
      }
      // fallback : parseISO
      const d2 = parseISO(timestamp);
      if (!isNaN(d2)) return d2;
    } catch {}
  }
  // dernier recours
  const d3 = new Date(timestamp);
  return isNaN(d3) ? new Date() : d3;
};

// Itération jours inclusifs
const eachDayOfInterval = (interval) => {
  const days = [];
  const cur = new Date(interval.start);
  while (cur <= interval.end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
};

// Clé affichage nom
const fullName = (m) => {
  if (!m) return "—";
  const p1 = m.firstName?.trim() ?? "";
  const p2 = m.name?.trim() ?? "";
  return (p1 + " " + p2).trim() || m.username || "—";
};

// Image membre
const MemberPhoto = ({ url, alt }) => {
  if (!url) {
    return (
      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-neutral-800 flex items-center justify-center">
        <ImageIcon className="w-5 h-5 text-gray-400" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt || "photo"}
      className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-neutral-800"
      loading="lazy"
    />
  );
};
// 🔹 Partie 2 — Composant principal : états & périodes
export default function PlanningPage() {
  const { role } = useAuth(); // 'admin' ou 'user'
  const [isMobile, setIsMobile] = useState(false);

  // Données
  const [members, setMembers] = useState([]);   // {id, name, firstName, badgeId, photo}
  const [rows, setRows] = useState([]);         // presences brutes chargées (paginées)
  const [total, setTotal] = useState(null);

  // UI/états
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);

  // Périodes
  const [period, setPeriod] = useState("week"); // 'day' | 'week' | 'month' | 'year'
  const [startDate, setStartDate] = useState(startOfDay(subWeeks(new Date(), 1)));
  const [endDate, setEndDate] = useState(endOfDay(new Date()));

  // Pagination
  const [page, setPage] = useState(0);

  // Filtres
  const [filterName, setFilterName] = useState("");
  const [filterBadge, setFilterBadge] = useState("");
  const [showNightHours, setShowNightHours] = useState(false);

  // Vue
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'

  // Détection mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Range util selon périodicité
  const updateDateRange = useCallback((value, base = new Date()) => {
    let s, e;
    if (value === "day") {
      s = startOfDay(base);
      e = endOfDay(base);
    } else if (value === "week") {
      s = startOfWeek(base, { weekStartsOn: 1 });
      e = endOfWeek(base, { weekStartsOn: 1 });
    } else if (value === "month") {
      s = startOfMonth(base);
      e = endOfMonth(base);
    } else {
      s = startOfYear(base);
      e = endOfYear(base);
    }
    setStartDate(s);
    setEndDate(e);
  }, []);

  // Initialisation de la plage (garde week par défaut mais calcule le bon range)
  useEffect(() => {
    updateDateRange(period, new Date());
    // eslint-disable-next-line
  }, []);

  const goPrev = () => {
    const dir = -1;
    let base = startDate;
    if (period === "day") base = addDays(base, dir);
    else if (period === "week") base = addWeeks(base, dir);
    else if (period === "month") base = addMonths(base, dir);
    else base = addYears(base, dir);
    updateDateRange(period, base);
  };

  const goNext = () => {
    const dir = +1;
    let base = startDate;
    if (period === "day") base = addDays(base, dir);
    else if (period === "week") base = addWeeks(base, dir);
    else if (period === "month") base = addMonths(base, dir);
    else base = addYears(base, dir);
    updateDateRange(period, base);
  };

  const goToday = () => updateDateRange(period, new Date());

  // Libellé période
  const periodLabel = useMemo(() => {
    if (period === "day") return fmt(startDate, "dd/MM/yyyy");
    if (period === "week")
      return `${fmt(startDate, "dd/MM")} → ${fmt(endDate, "dd/MM")}`;
    if (period === "month") return fmt(startDate, "LLLL yyyy");
    return fmt(startDate, "yyyy");
  }, [period, startDate, endDate]);
// 🔹 Partie 3 — Chargement membres & présences (pagination serveur) + realtime
  const resetAndFetch = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setRows([]);
      setTotal(null);
      setPage(0);

      // 1) Membres (pour noms & photos)
      const { data: membersData, error: mErr } = await supabase
        .from("members")
        .select("id, name, firstName, badgeId, photo");
      if (mErr) throw mErr;
      setMembers(membersData || []);

      // 2) Première page de présences (dans la plage)
      const from = 0;
      const to = PAGE_SIZE - 1;
      const { data, error: pErr, count } = await supabase
        .from("presences")
        .select("*", { count: "exact" })
        .gte("timestamp", startDate.toISOString())
        .lt("timestamp", endDate.toISOString())
        .order("timestamp", { ascending: false })
        .range(from, to);
      if (pErr) throw pErr;

      setRows(data || []);
      setTotal(count ?? null);
      setPage(1);
    } catch (e) {
      console.error(e);
      setError(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  // Recharger sur changement de plage/period
  useEffect(() => {
    resetAndFetch();
  }, [resetAndFetch]);

  // Charger plus
  const fetchMore = async () => {
    try {
      setLoadingMore(true);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error: pErr } = await supabase
        .from("presences")
        .select("*")
        .gte("timestamp", startDate.toISOString())
        .lt("timestamp", endDate.toISOString())
        .order("timestamp", { ascending: false })
        .range(from, to);
      if (pErr) throw pErr;
      setRows((prev) => [...prev, ...(data || [])]);
      setPage((p) => p + 1);
    } catch (e) {
      console.error(e);
      setError(e.message || "Erreur lors du chargement supplémentaire");
    } finally {
      setLoadingMore(false);
    }
  };

  // Realtime INSERT
  useEffect(() => {
    const ch = supabase
      .channel("presences-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "presences" },
        (payload) => {
          const r = payload.new;
          const ts = parseTimestamp(r.timestamp);
          if (isWithinInterval(ts, { start: startDate, end: endDate })) {
            setRows((prev) => [r, ...prev]);
            setTotal((t) => (t == null ? null : t + 1));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [startDate, endDate]);
// 🔹 Partie 4 — Filtres, dédoublonnage & projections (grid/list)
  const memberByBadge = useMemo(() => {
    const map = new Map();
    for (const m of members) {
      const key = (m.badgeId || "").trim();
      if (key) map.set(key, m);
    }
    return map;
  }, [members]);

  // Filtrage local + dédup 2 minutes par badge
  const filtered = useMemo(() => {
    if (!rows?.length) return [];

    // pré-tri ASC pour comparaison temporelle, puis retour DESC
    const sortedAsc = [...rows].sort(
      (a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp)
    );

    const nameQ = (filterName || "").trim().toLowerCase();
    const badgeQ = (filterBadge || "").trim().toLowerCase();

    const lastByBadge = new Map();
    const acc = [];

    for (const r of sortedAsc) {
      const ts = parseTimestamp(r.timestamp).getTime();
      const badge = (r.badgeId || "").trim();
      const mem = memberByBadge.get(badge);
      const displayName = fullName(mem).toLowerCase();

      // Filtres
      if (nameQ && !displayName.includes(nameQ)) continue;
      if (badgeQ && !badge.toLowerCase().includes(badgeQ)) continue;

      // Dédup 2 min / badge
      const lastTs = lastByBadge.get(badge);
      if (!lastTs || ts - lastTs > DEDUPE_WINDOW_MS) {
        acc.push(r);
        lastByBadge.set(badge, ts);
      }
    }

    return acc.reverse(); // DESC pour affichage
  }, [rows, memberByBadge, filterName, filterBadge]);

  // Groupement par badge (pour Grid)
  const groupedByMember = useMemo(() => {
    const map = new Map();
    for (const p of filtered) {
      const b = (p.badgeId || "").trim() || "_";
      const arr = map.get(b) || [];
      arr.push(parseTimestamp(p.timestamp));
      map.set(b, arr);
    }
    return map;
  }, [filtered]);

  // Liste des jours de la plage
  const days = useMemo(
    () => eachDayOfInterval({ start: startDate, end: endDate }),
    [startDate, endDate]
  );

  // Heures pour ruler journalière / filtre nuit
  const hours = useMemo(() => {
    const base = Array.from({ length: 24 }, (_, i) => i);
    return showNightHours ? base : base.slice(6); // 6h → 23h
  }, [showNightHours]);
// 🔹 Partie 5 — Import Excel (admin) & Export CSV
  const fileInputRef = useRef(null);

  const onClickImport = () => fileInputRef.current?.click();

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setRetrying(true);
      setError("");

      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rowsX = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Détection simple des colonnes (badgeId, timestamp/date+heure)
      const header = (rowsX[0] || []).map((h) =>
        String(h || "").trim().toLowerCase()
      );

      const idxBadge =
        header.findIndex((h) => ["badgeid", "badge", "id", "badge_id"].includes(h)) !== -1
          ? header.findIndex((h) => ["badgeid", "badge", "id", "badge_id"].includes(h))
          : 0;

      const idxTs = header.findIndex((h) =>
        ["timestamp", "date", "datetime", "heure"].includes(h)
      );

      const body = rowsX.slice(1);
      const toInsert = [];

      for (const r of body) {
        const badge = String(r[idxBadge] || "").trim();
        if (!badge) continue;

        let ts;
        if (idxTs >= 0) {
          const raw = r[idxTs];
          // Si date + heure existent en colonnes séparées, on peut les concaténer
          if (header.includes("date") && header.includes("heure")) {
            const iDate = header.indexOf("date");
            const iHeure = header.indexOf("heure");
            const dStr = r[iDate];
            const hStr = r[iHeure] || "00:00";
            ts = parseTimestamp(`${dStr}T${hStr}`);
          } else {
            ts = parseTimestamp(raw);
          }
        } else {
          // Pas de colonne explicite : on tente la 2e colonne
          ts = parseTimestamp(r[1]);
        }

        if (!isNaN(ts)) {
          toInsert.push({
            badgeId: badge,
            timestamp: ts.toISOString(),
          });
        }
      }

      // Insert en batch
      for (let i = 0; i < toInsert.length; i += MAX_BATCH_INSERT) {
        const chunk = toInsert.slice(i, i + MAX_BATCH_INSERT);
        const { error: iErr } = await supabase.from("presences").insert(chunk);
        if (iErr) throw iErr;
      }

      // Reload
      await resetAndFetch();
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de l'import");
    } finally {
      setRetrying(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Export CSV de la vue filtrée (après dédup)
  const exportCSV = () => {
    const header = ["Date", "Heure", "Nom", "BadgeId"];
    const lines = [header.join(";")];

    for (const r of filtered) {
      const ts = parseTimestamp(r.timestamp);
      const badge = (r.badgeId || "").trim();
      const mem = memberByBadge.get(badge);
      lines.push(
        [fmt(ts, "dd/MM/yyyy"), fmt(ts, "HH:mm"), fullName(mem), badge].join(";")
      );
    }

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `presences_${period}_${fmt(startDate, "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
// 🔹 Partie 6 — Rendus UI : états, toolbar, vues Grid & List
  const renderLoading = () => (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span>Chargement…</span>
      </div>
    </div>
  );

  const renderError = () => (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="max-w-lg w-full bg-white dark:bg-neutral-900 border border-red-200 dark:border-red-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          <div className="font-semibold text-red-700 dark:text-red-300">
            Problème de connexion
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">{error}</div>
        <button
          onClick={resetAndFetch}
          className="mt-4 px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800"
        >
          Réessayer
        </button>
      </div>
    </div>
  );

  // Toolbar (période, date, navigation, filtres, actions)
  const Toolbar = () => (
    <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-gray-100/80 dark:bg-neutral-950/80 backdrop-blur border-b border-gray-200 dark:border-neutral-800">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Choix période */}
        <div className="inline-flex rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
          {["day", "week", "month", "year"].map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriod(p);
                updateDateRange(p, startDate);
              }}
              className={`px-3 py-2 text-sm ${
                period === p ? "bg-white dark:bg-neutral-900" : ""
              }`}
            >
              {p === "day" ? "Jour" : p === "week" ? "Semaine" : p === "month" ? "Mois" : "Année"}
            </button>
          ))}
        </div>

        {/* Navigation temporelle */}
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 hover:bg-white/60 dark:hover:bg-neutral-900/60"
            title="Précédent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-sm min-w-[180px] text-center">
            <div className="font-semibold">{periodLabel}</div>
          </div>

          <button
            onClick={goNext}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 hover:bg-white/60 dark:hover:bg-neutral-900/60"
            title="Suivant"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={goToday}
            className="px-3 py-2 rounded-lg border border-blue-300 text-blue-700 dark:text-blue-400 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            Aujourd’hui
          </button>

          <input
            type="date"
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
            value={fmt(startDate, "yyyy-MM-dd")}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              const d = parseISO(v);
              if (!isNaN(d)) updateDateRange(period, d);
            }}
          />
        </div>

        {/* Espace */}
        <div className="flex-1" />

        {/* Filtres */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <input
              type="search"
              placeholder="Nom…"
              className="w-40 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
            />
          </div>
          <input
            type="search"
            placeholder="Badge…"
            className="w-40 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
            value={filterBadge}
            onChange={(e) => setFilterBadge(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800">
            <input
              type="checkbox"
              checked={showNightHours}
              onChange={(e) => setShowNightHours(e.target.checked)}
            />
            Heures nuit
          </label>

          {/* Vue */}
          <div className="inline-flex rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <button
              className={`px-3 py-2 text-sm ${
                viewMode === "grid" ? "bg-white dark:bg-neutral-900" : ""
              }`}
              onClick={() => setViewMode("grid")}
              title="Vue Grille"
            >
              <GridIcon className="w-4 h-4" />
            </button>
            <button
              className={`px-3 py-2 text-sm ${
                viewMode === "list" ? "bg-white dark:bg-neutral-900" : ""
              }`}
              onClick={() => setViewMode("list")}
              title="Vue Liste"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Actions */}
          <button
            onClick={exportCSV}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 hover:bg-white/60 dark:hover:bg-neutral-900/60 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          {role === "admin" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportExcel}
              />
              <button
                onClick={onClickImport}
                disabled={retrying}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 hover:bg-white/60 dark:hover:bg-neutral-900/60 flex items-center gap-2 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Import
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // VUE LISTE (virtualisée si possible)
  const renderList = () => {
    const items = filtered;

    const Row = ({ index, style }) => {
      const r = items[index];
      const ts = parseTimestamp(r.timestamp);
      const badge = (r.badgeId || "").trim();
      const mem = memberByBadge.get(badge);
      return (
        <div
          style={style}
          className="grid grid-cols-[auto,1fr,100px,110px] md:grid-cols-[auto,1fr,120px,160px] items-center gap-3 px-3 py-2 border-b border-gray-200 dark:border-neutral-800 text-sm"
        >
          <MemberPhoto url={mem?.photo} alt={fullName(mem)} />
          <div className="truncate">
            <div className="font-medium">{fullName(mem)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <Users className="inline w-3 h-3 mr-1" />
              Badge: {badge || "—"}
            </div>
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            <Clock className="inline w-3 h-3 mr-1" />
            {fmt(ts, "HH:mm")}
          </div>
          <div className="text-gray-500 dark:text-gray-400">
            {fmt(ts, "dd/MM/yyyy")}
          </div>
        </div>
      );
    };

    return (
      <div className="rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
        <div className="hidden md:grid grid-cols-[auto,1fr,120px,160px] bg-gray-50 dark:bg-neutral-900 text-xs font-medium uppercase tracking-wide px-3 py-2 border-b border-gray-200 dark:border-neutral-800">
          <div />
          <div>Nom</div>
          <div>Heure</div>
          <div>Date</div>
        </div>

        {VirtualList ? (
          <VirtualList
            height={520}
            itemCount={items.length}
            itemSize={56}
            width={"100%"}
            itemKey={(i) =>
              items[i]?.id ?? `${items[i]?.badgeId ?? "x"}-${i}`
            }
          >
            {Row}
          </VirtualList>
        ) : (
          <div>
            {items.map((_, i) => (
              <Row key={i} index={i} style={{}} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between px-3 py-3 bg-gray-50 dark:bg-neutral-900">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Chargées : {rows.length} / {total ?? "?"}
          </div>
          <button
            disabled={loadingMore || (total != null && rows.length >= total)}
            onClick={fetchMore}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 disabled:opacity-50"
          >
            {loadingMore
              ? "Chargement..."
              : total != null && rows.length >= total
              ? "Tout chargé"
              : "Charger plus"}
          </button>
        </div>
      </div>
    );
  };

  // VUE GRILLE : tuiles par membre + pastilles par jour de la période
  const renderGrid = () => {
    // Construire un tableau des membres concernés (ayant au moins 1 présence filtrée)
    const membersInView = [];
    for (const [badge, dates] of groupedByMember.entries()) {
      const mem = memberByBadge.get(badge);
      membersInView.push({ badge, mem, dates });
    }
    // Tri par nom
    membersInView.sort((a, b) =>
      fullName(a.mem).localeCompare(fullName(b.mem), "fr")
    );

    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {membersInView.map(({ badge, mem, dates }) => {
          const dateSet = new Set(dates.map((d) => fmt(d, "yyyy-MM-dd")));
          return (
            <div
              key={badge}
              className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <MemberPhoto url={mem?.photo} alt={fullName(mem)} />
                <div className="truncate">
                  <div className="font-semibold">{fullName(mem)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Badge: {badge || "—"}
                  </div>
                </div>
              </div>

              {/* Bandeau jours */}
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-[repeat(7,1fr)] gap-2 text-xs mb-2">
                    {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(
                      (d) => (
                        <div
                          key={d}
                          className="text-center text-gray-500 dark:text-gray-400"
                        >
                          {d}
                        </div>
                      )
                    )}
                  </div>

                  {/* Rangées de semaines sur la période courante */}
                  <div className="grid gap-2">
                    {/* On découpe la liste 'days' en semaines de 7 jours */}
                    {Array.from({ length: Math.ceil(days.length / 7) }).map(
                      (_, wi) => {
                        const slice = days.slice(wi * 7, wi * 7 + 7);
                        return (
                          <div
                            key={wi}
                            className="grid grid-cols-[repeat(7,1fr)] gap-2"
                          >
                            {slice.map((d, di) => {
                              const key = fmt(d, "yyyy-MM-dd");
                              const present = dateSet.has(key);
                              return (
                                <div
                                  key={di}
                                  className={`h-8 rounded-md flex items-center justify-center border text-xs ${
                                    present
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800"
                                      : "bg-gray-50 dark:bg-neutral-800 text-gray-400 border-gray-200 dark:border-neutral-800"
                                  }`}
                                  title={`${fmt(d, "EEE dd/MM")} — ${
                                    present ? "Présent" : "—"
                                  }`}
                                >
                                  {fmt(d, "dd")}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };
// 🔹 Partie 7 — Render principal
  return (
    <div className="p-4 sm:p-6 bg-gray-100 dark:bg-neutral-950 min-h-screen text-gray-900 dark:text-gray-100">
      <Toolbar />

      {/* Stats rapides */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Période</div>
          <div className="text-sm font-semibold">
            {fmt(startDate, "dd/MM/yyyy")} → {fmt(endDate, "dd/MM/yyyy")}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Lignes (après dédup)
          </div>
          <div className="text-sm font-semibold">{filtered.length}</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Badges uniques
          </div>
          <div className="text-sm font-semibold">{groupedByMember.size}</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Total (serveur)
          </div>
          <div className="text-sm font-semibold">{total ?? "—"}</div>
        </div>
      </div>

      {/* Corps */}
      <div className="mt-4">
        {error ? (
          renderError()
        ) : loading ? (
          renderLoading()
        ) : (isMobile ? "list" : viewMode) === "list" ? (
          renderList()
        ) : (
          renderGrid()
        )}
      </div>
    </div>
  );
}
// ✅ FIN DU FICHIER
