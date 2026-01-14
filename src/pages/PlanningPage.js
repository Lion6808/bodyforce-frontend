// 📄 PlanningPage.js — React — Dossier : src/pages — Date : 2025-10-08
// ✅ Ajouts : Pagination 20 membres/page + egress optimisée (requêtes ciblées)
// ✅ Import Excel : UPSERT par chunks (onConflict badgeId,timestamp) → évite 409
// ✅ CORRECTION : Debounce sur les filtres pour éviter le rafraîchissement à chaque caractère
// ⚠️ Règles BODYFORCE respectées : structure & styles conservés, modifications minimales


import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import * as XLSX from "xlsx";
import { supabase, supabaseServices } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import MemberForm from "../components/MemberForm";

import {
  Calendar,
  Users,
  Filter,
  Grid,
  List,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Clock,
  TrendingUp,
  BarChart3,
} from "lucide-react";

import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";

// Tailwind helpers
const cn = (...classes) => classes.filter(Boolean).join(" ");

const classes = {
  pageContainer:
    "min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4",
  maxWidthWrapper: "max-w-full mx-auto",
  card: "bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700",
  headerCard:
    "bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700",
  buttonPrimary:
    "px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2",
  buttonSecondary: "p-2 rounded-md transition-all",
  presetButton:
    "px-2 py-1 text-xs bg-white dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-600",
  input:
    "border-2 border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100",
  select:
    "border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium text-sm",
  iconContainer: "p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl",
  title: "text-3xl font-bold text-gray-900 dark:text-gray-100",
  subtitle: "text-gray-600 dark:text-gray-400 mt-1",
  avatar:
    "w-10 h-10 object-cover rounded-full border border-blue-200 dark:border-blue-600",
  avatarInitials:
    "w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm",
};

// 👉 Avatar (même usage que dans MembersPage)
import Avatar from "../components/Avatar";

// Dates utils
const formatDate = (date, fmt) => {
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
const parseTimestamp = (ts) => new Date(ts);

const toDateString = (date) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const isWeekend = (date) => [0, 6].includes(date.getDay());
const isWithinInterval = (date, interval) =>
  date >= interval.start && date <= interval.end;
const eachDayOfInterval = ({ start, end }) => {
  const out = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
const addWeeks = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n * 7);
  return x;
};
const addMonths = (d, n) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};
const addYears = (d, n) => {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + n);
  return x;
};
const subWeeks = (d, n) => addWeeks(d, -n);
const isToday = (d) => d.toDateString() === new Date().toDateString();

// ────────────────────────────────────────────────────────────────────────────────

function PlanningPage() {
  // Données (paginées)
  const [presences, setPresences] = useState([]); // uniquement pour les membres de la page & la période
  const [members, setMembers] = useState([]);     // membres de la page courante
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const { role } = useAuth();

  // Période & filtres
  const [period, setPeriod] = useState("week");
  const [startDate, setStartDate] = useState(startOfDay(subWeeks(new Date(), 1)));
  const [endDate, setEndDate] = useState(endOfDay(new Date()));

  // 🔥 CORRECTION : États séparés pour la saisie immédiate et le filtre debounced
  const [filterBadgeInput, setFilterBadgeInput] = useState("");
  const [filterNameInput, setFilterNameInput] = useState("");

  // États debounced (déclenchent les requêtes après 500ms d'inactivité)
  const [filterBadge, setFilterBadge] = useState("");
  const [filterName, setFilterName] = useState("");

  const [showNightHours, setShowNightHours] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const navigate = useNavigate();

  const handleEditMember = async (member) => {
    if (!member || !member.id) return;

    if (isMobile) {
      // Mobile : modal
      try {
        const fullMember = await supabaseServices.getMemberById(member.id);
        setSelectedMember(fullMember || member);
        setShowForm(true);
      } catch (err) {
        console.error("Erreur chargement membre:", err);
        setSelectedMember(member);
        setShowForm(true);
      }
    } else {
      // Desktop : navigate
      navigate("/members/edit", {
        state: { member, returnPath: "/planning", memberId: member.id },
      });
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedMember(null);
  };

  const handleSaveMember = async () => {
    setShowForm(false);
    setSelectedMember(null);
    // Recharger les données pour afficher les modifications
    await loadData();
  };




  // Pagination
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1); // 1-based
  const [totalMembers, setTotalMembers] = useState(0);


  // États pour la modal de détail du membre
  const [selectedMember, setSelectedMember] = useState(null);
  const [showForm, setShowForm] = useState(false);
  // Vue mensuelle (tooltip corrigé)
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [hoveredMember, setHoveredMember] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Chargement Supabase (membres paginés + présences de la période pour ces membres)
  const loadData = async (showRetryIndicator = false) => {
    try {
      if (showRetryIndicator) setIsRetrying(true);
      setLoading(true);
      setError("");

      // A) Récupère tous les badgeId AYANT AU MOINS UNE PRÉSENCE sur la période
      //    (en tenant compte du filtre badge si fourni)
      let presencesQ = supabase
        .from("presences")
        .select("badgeId,timestamp")
        .gte("timestamp", startDate.toISOString())
        .lte("timestamp", endDate.toISOString());

      if (filterBadge?.trim()) {
        // Filtrer côté DB réduit l'egress
        presencesQ = presencesQ.ilike("badgeId", `%${filterBadge.trim()}%`);
      }

      const { data: presInPeriod, error: prsErr } = await presencesQ;
      if (prsErr) throw new Error(`Erreur présences (période): ${prsErr.message}`);

      // ➕ NEW: map dernier passage par badgeId
      const lastSeenByBadge = {};
      (presInPeriod || []).forEach((p) => {
        if (!p || !p.badgeId || !p.timestamp) return;
        const t = new Date(p.timestamp).getTime();
        if (!Number.isFinite(t)) return;
        if (!lastSeenByBadge[p.badgeId] || t > lastSeenByBadge[p.badgeId]) {
          lastSeenByBadge[p.badgeId] = t;
        }
      });

      // Distinct badgeIds présents dans la période
      const badgeIdSet = new Set(
        (presInPeriod || [])
          .map((p) => p.badgeId)
          .filter((b) => !!b)
      );
      const allBadgeIdsInPeriod = Array.from(badgeIdSet);

      // Si aucun présent → reset affichage et fin
      if (allBadgeIdsInPeriod.length === 0) {
        setMembers([]);
        setPresences([]);
        setTotalMembers(0);
        setRetryCount(0);
        return;
      }

      // B) Charger les members correspondants puis appliquer filtre nom
      const { data: periodMembersAll, error: membersErr } = await supabase
        .from("members")
        .select("id,name,firstName,badgeId,photo")
        .in("badgeId", allBadgeIdsInPeriod)
        .order("name", { ascending: true });

      if (membersErr) throw new Error(`Erreur membres: ${membersErr.message}`);

      let filteredMembers = (periodMembersAll || []);

      filteredMembers.sort((a, b) => {
        const tb = lastSeenByBadge[b.badgeId] ?? 0;
        const ta = lastSeenByBadge[a.badgeId] ?? 0;
        if (tb !== ta) return tb - ta;          // du plus récent au plus ancien
        // tie-break par nom pour une stabilité d'affichage
        return (a.name || "").localeCompare(b.name || "");
      });

      if (filterName?.trim()) {
        const s = filterName.trim().toLowerCase();
        filteredMembers = filteredMembers.filter((m) =>
          `${m.name || ""} ${m.firstName || ""}`.toLowerCase().includes(s)
        );
      }
      if (filterBadge?.trim()) {
        const s = filterBadge.trim();
        filteredMembers = filteredMembers.filter((m) =>
          (m.badgeId || "").includes(s)
        );
      }

      // C) Pagination SUR les membres présents dans la période
      const total = filteredMembers.length;
      setTotalMembers(total);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE;
      const pageMembers = filteredMembers.slice(from, to);
      setMembers(pageMembers);

      // D) Charger les présences UNIQUEMENT pour les membres de la page (et sur la période)
      const pageBadgeIds = pageMembers.map((m) => m.badgeId).filter(Boolean);

      let prs = [];
      if (pageBadgeIds.length) {
        const { data, error } = await supabase
          .from("presences")
          .select("badgeId,timestamp")
          .gte("timestamp", startDate.toISOString())
          .lte("timestamp", endDate.toISOString())
          .in("badgeId", pageBadgeIds)
          .order("timestamp", { ascending: false });

        if (error) throw new Error(`Erreur présences (page): ${error.message}`);
        prs = data || [];
      }

      setPresences(
        prs.map((p) => ({
          badgeId: p.badgeId,
          timestamp: p.timestamp,
          parsedDate: parseTimestamp(p.timestamp),
        }))
      );

      setRetryCount(0);
    } catch (err) {
      console.error("Erreur:", err);
      setError(err.message || "Erreur de connexion à la base de données");
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, filterName, filterBadge, page]);

  // 🔥 CORRECTION : Debounce pour filterName (attend 500ms après la dernière saisie)
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilterName(filterNameInput);
      setPage(1); // Reset à la page 1 quand on filtre
    }, 500);
    return () => clearTimeout(timer);
  }, [filterNameInput]);

  // 🔥 CORRECTION : Debounce pour filterBadge (attend 500ms après la dernière saisie)
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilterBadge(filterBadgeInput);
      setPage(1); // Reset à la page 1 quand on filtre
    }, 500);
    return () => clearTimeout(timer);
  }, [filterBadgeInput]);

  const handleRetry = () => {
    setRetryCount((v) => v + 1);
    loadData(true);
  };

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ✅ Aligne la période sur les bornes naturelles + reset page
  const updateDateRange = (value, base = new Date()) => {
    setPage(1);
    if (value === "week") {
      const start = startOfWeek(base, { weekStartsOn: 1 });
      const end = endOfWeek(base, { weekStartsOn: 1 });
      setStartDate(startOfDay(start));
      setEndDate(endOfDay(end));
    } else if (value === "month") {
      const start = startOfMonth(base);
      const end = endOfMonth(base);
      setStartDate(startOfDay(start));
      setEndDate(endOfDay(end));
    } else {
      const start = startOfYear(base);
      const end = endOfYear(base);
      setStartDate(startOfDay(start));
      setEndDate(endOfDay(end));
    }
  };

  // Navigation ‹ › qui s'aligne via updateDateRange
  const navigatePeriod = (direction) => {
    const amount = direction === "prev" ? -1 : 1;
    let newStart;
    if (period === "week") newStart = addWeeks(startDate, amount);
    else if (period === "month") newStart = addMonths(startDate, amount);
    else newStart = addYears(startDate, amount);
    updateDateRange(period, newStart);
  };

  const toLocalDate = (timestamp) => parseTimestamp(timestamp);

  // Import Excel – passage en UPSERT par chunks (onConflict badgeId,timestamp)
  const handleImportExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 1) Auth (utile avec RLS)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("❌ Vous devez être connecté pour importer des présences.");
        return;
      }
    } catch (e) {
      console.error("Auth check error:", e);
    }

    // 2) Helpers parsing
    const excelSerialToDate = (serial) => {
      // Excel serial → JS Date (base 1899-12-30)
      const base = new Date(Date.UTC(1899, 11, 30));
      const ms = Math.round(Number(serial) * 86400) * 1000;
      return new Date(base.getTime() + ms);
    };

    const tryParseFR = (s) => {
      const str = String(s).trim();
      // dd/MM/yy HH:mm
      let m = str.match(/^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
      if (m) {
        const [, dd, mm, yy, HH, MI] = m;
        return new Date(`20${yy}-${mm}-${dd}T${HH}:${MI}:00`);
      }
      // dd/MM/yyyy HH:mm
      m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
      if (m) {
        const [, dd, mm, yyyy, HH, MI] = m;
        return new Date(`${yyyy}-${mm}-${dd}T${HH}:${MI}:00`);
      }
      const d = new Date(str); // fallback (ISO, etc.)
      return isNaN(d) ? null : d;
    };

    const toJsDate = (val) => {
      if (val instanceof Date) return val;
      if (typeof val === "number") return excelSerialToDate(val);
      if (typeof val === "string") return tryParseFR(val);
      return null;
    };

    // 3) Lecture + mapping colonnes spécifiques (Quand, Quoi, Qui)
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });

        // Stats diag
        let totalRows = 0;
        let kept = 0;
        let filteredOtherType = 0;
        let skippedNoBadge = 0;
        let skippedNoDate = 0;
        let unparsableDate = 0;

        const allowedTypes = new Set(["Badges ou Télécommandes", "CleMobil"]);
        const payload = [];

        for (const row of rows) {
          totalRows++;

          const quoi = (row["Quoi"] ?? "").toString().trim();
          const quiRaw = row["Qui"];
          const quandRaw = row["Quand"];

          // Filtre type (ignore "BP", lignes vides, etc.)
          if (!allowedTypes.has(quoi)) {
            filteredOtherType++;
            continue;
          }

          // Badge obligatoire
          const badgeId = (quiRaw ?? "").toString().trim();
          if (!badgeId) {
            skippedNoBadge++;
            continue;
          }

          // Date obligatoire
          if (quandRaw == null) {
            skippedNoDate++;
            continue;
          }

          const dt = toJsDate(quandRaw);
          if (!dt || isNaN(dt)) {
            unparsableDate++;
            continue;
          }

          payload.push({ badgeId, timestamp: dt.toISOString() });
          kept++;
        }

        if (payload.length === 0) {
          alert(
            [
              "ℹ️ Aucune ligne importée.",
              `Lignes totales: ${totalRows}`,
              `• Gardées: ${kept}`,
              `• Filtrées (type ≠ 'Badges ou Télécommandes' / 'CleMobil'): ${filteredOtherType}`,
              `• Sans badge: ${skippedNoBadge}`,
              `• Sans date: ${skippedNoDate}`,
              `• Date illisible: ${unparsableDate}`,
            ].join("\n")
          );
          return;
        }

        // 4) UPSERT par chunks
        const chunkSize = 500;
        let affected = 0;

        for (let i = 0; i < payload.length; i += chunkSize) {
          const chunk = payload.slice(i, i + chunkSize);
          const { data: upserted, error } = await supabase
            .from("presences")
            .upsert(chunk, { onConflict: "badgeId,timestamp" })
            .select("badgeId"); // lignes touchées (insert + update)

          if (error) {
            console.error("Upsert error:", error);
            alert("❌ Erreur lors de l'upsert: " + (error.message || "inconnue"));
            return;
          }

          affected += Array.isArray(upserted) ? upserted.length : 0;
        }

        alert(
          [
            "✅ Import terminé.",
            `Lignes totales lues: ${totalRows}`,
            `• Retenues pour import: ${kept}`,
            `• Upsertées (insert+update): ${affected} (doublons ignorés)`,
            `• Filtrées type: ${filteredOtherType} | Sans badge: ${skippedNoBadge} | Sans date: ${skippedNoDate} | Date illisible: ${unparsableDate}`,
          ].join("\n")
        );

        // Recharge l'affichage
        loadData();
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Erreur import Excel :", err);
      alert("❌ Erreur lors de l'import.");
    } finally {
      // Permet de réimporter le même fichier sans recharger la page
      try { event.target.value = ""; } catch { }
    }
  };

  // UI: états de chargement / erreur
  const renderConnectionError = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center border border-gray-200 dark:border-gray-700">
        <AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
          Problème de connexion
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
          {error}
        </p>
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-lg"
        >
          {isRetrying ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Reconnexion...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              Réessayer
            </>
          )}
        </button>
        {retryCount > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            Tentative {retryCount + 1}
          </p>
        )}
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <RefreshCw className="w-8 h-8 animate-spin text-white" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
          {isRetrying ? "Reconnexion en cours..." : "Chargement du planning..."}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Période: {startDate.toLocaleDateString()} -{" "}
          {endDate.toLocaleDateString()}
        </p>
      </div>
    </div>
  );

  if (loading) return renderLoading();
  if (error && !isRetrying) return renderConnectionError();

  // Filtrage local (présences) – garde la logique d'origine
  const filteredPresences = presences.filter((p) => {
    const presenceDate = toLocalDate(p.timestamp);
    return isWithinInterval(presenceDate, { start: startDate, end: endDate });
  });

  const groupedByMember = {};
  filteredPresences.forEach((p) => {
    const key = p.badgeId;
    if (!groupedByMember[key]) groupedByMember[key] = [];
    groupedByMember[key].push(toLocalDate(p.timestamp));
  });

  const allDays = eachDayOfInterval({ start: startDate, end: endDate });
  const fullHours = Array.from({ length: 24 }, (_, i) => i);
  const hours = showNightHours ? fullHours : fullHours.slice(6);

  const getMemberInfo = (badgeId) =>
    members.find((m) => m.badgeId === badgeId) || {};

  const visibleMembers = members;

  // Stats (identiques à ta version)
  const stats = (() => {
    const totalPresences = filteredPresences.length;
    const uniqueMembers = new Set(filteredPresences.map((p) => p.badgeId)).size;
    const daily = {};
    allDays.forEach((day) => {
      const k = toDateString(day);
      const dayPresences = filteredPresences.filter(
        (p) => toDateString(p.parsedDate) === k
      );
      daily[k] = {
        presences: dayPresences.length,
        members: new Set(dayPresences.map((p) => p.badgeId)).size,
      };
    });
    const vals = Object.values(daily);
    const avgPresencesPerDay =
      Math.round(
        (vals.reduce((s, x) => s + x.presences, 0) / allDays.length) * 10
      ) / 10;
    const avgMembersPerDay =
      Math.round(
        (vals.reduce((s, x) => s + x.members, 0) / allDays.length) * 10
      ) / 10;
    const busiestDay = Object.entries(daily).reduce(
      (max, [day, v]) => (v.members > max.members ? { day, ...v } : max),
      { day: "", members: 0, presences: 0 }
    );
    return {
      totalPresences,
      uniqueMembers,
      avgPresencesPerDay,
      avgMembersPerDay,
      busiestDay,
    };
  })();

  // ─────────────── Pagination UI (type MembersPage/PaymentsPage) ───────────────
  const totalPages = Math.max(1, Math.ceil(totalMembers / PAGE_SIZE));
  const goToPage = (p) => setPage(Math.min(Math.max(1, p), totalPages));

  const Pager = () => {
    const pages = [];
    const cur = page;
    const max = totalPages;
    const push = (n, label = n) =>
      pages.push(
        <button
          key={label}
          onClick={() => goToPage(n)}
          className={cn(
            "px-3 py-1 rounded-md text-sm border",
            n === cur
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          )}
        >
          {label}
        </button>
      );

    if (max <= 7) {
      for (let i = 1; i <= max; i++) push(i);
    } else {
      push(1);
      if (cur > 4) pages.push(<span key="l" className="px-1">…</span>);
      const start = Math.max(2, cur - 1);
      const end = Math.min(max - 1, cur + 1);
      for (let i = start; i <= end; i++) push(i);
      if (cur < max - 3) pages.push(<span key="r" className="px-1">…</span>);
      push(max);
    }

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => goToPage(page - 1)}
          disabled={page === 1}
          className={cn(
            "px-3 py-1 rounded-md text-sm border",
            page === 1
              ? "bg-gray-100 dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600 cursor-not-allowed"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          )}
        >
          Précédent
        </button>
        {pages}
        <button
          onClick={() => goToPage(page + 1)}
          disabled={page === totalPages}
          className={cn(
            "px-3 py-1 rounded-md text-sm border",
            page === totalPages
              ? "bg-gray-100 dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600 cursor-not-allowed"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          )}
        >
          Suivant
        </button>
      </div>
    );
  };

  const StatsResume = () => (
    <div className={cn(classes.card, "p-6 mb-6")}>
      <div className="flex items-center gap-3 mb-6">
        <div className={classes.iconContainer}>
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Résumé de la période
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {formatDate(startDate, "dd/MM/yyyy")} -{" "}
            {formatDate(endDate, "dd/MM/yyyy")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
              Membres actifs
            </span>
          </div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {visibleMembers.length}
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-xs font-medium text-green-700 dark:text-green-400">
              Total présences
            </span>
          </div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-100">
            {filteredPresences.length}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-medium text-purple-700 dark:text-purple-400">
              Moy./jour
            </span>
          </div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
            {stats.avgMembersPerDay}
          </div>
          <div className="text-xs text-purple-600 dark:text-purple-400">
            membres
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <span className="text-xs font-medium text-orange-700 dark:text-orange-400">
              Jours couverts
            </span>
          </div>
          <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
            {allDays.length}
          </div>
        </div>

        {stats.busiestDay.day && (
          <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg p-4 border border-red-200 dark:border-red-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-xs font-medium text-red-700 dark:text-red-400">
                Jour pic
              </span>
            </div>
            <div className="text-lg font-bold text-red-900 dark:text-red-100">
              {stats.busiestDay.members}
            </div>
            <div className="text-xs text-red-600 dark:text-red-400">
              {new Date(stats.busiestDay.day).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Vue Liste (pastilles journalières) – ajout du Pager (haut + bas)
  const ListView = () => (
    <div className={cn(classes.card, "overflow-visible")}>
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Planning des présences ({visibleMembers.length} membres)
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {filteredPresences.length} présences sur {allDays.length} jours
          </p>
        </div>
        <div className="hidden md:block">
          <Pager />
        </div>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {visibleMembers.map((member, idx) => {
          const times = groupedByMember[member.badgeId] || [];
          const daily = times.reduce((acc, d) => {
            const k = toDateString(d);
            (acc[k] ||= []).push(d);
            return acc;
          }, {});
          return (
            <div
              key={member.badgeId || idx}
              className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <Avatar
                  photo={member.photo}
                  firstName={member.firstName}
                  name={member.name}
                  size={40}
                  onClick={() => handleEditMember(member)}
                  title="Cliquer pour voir le détail"
                />

                <div className="min-w-0">
                  <div
                    className="font-semibold text-gray-900 dark:text-gray-100 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    onClick={() => handleEditMember(member)}
                  >
                    {member.name} {member.firstName}
                  </div>
                  <div className="flex items-center gap-2 text-xs mt-0.5">
                    <span className="text-gray-500 dark:text-gray-400">
                      Badge {member.badgeId}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                      {times.length} présence(s)
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-7 sm:grid-cols-14 gap-1">
                {allDays.map((day) => {
                  const k = toDateString(day);
                  const dayPres = daily[k] || [];
                  const has = dayPres.length > 0;
                  return (
                    <div key={k} className="relative group">
                      <div
                        className={cn(
                          "h-10 sm:h-12 rounded-md flex flex-col items-center justify-center text-[10px] sm:text-xs font-medium transition-all",
                          has
                            ? "bg-green-500 text-white shadow-sm hover:scale-105"
                            : isWeekend(day)
                              ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                        )}
                      >
                        <div className="leading-none">
                          {formatDate(day, "EEE dd").split(" ")[1]}
                        </div>
                        {has && (
                          <div className="text-[10px] font-bold mt-0.5">
                            {dayPres.length}
                          </div>
                        )}
                      </div>

                      {has && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                          <div className="bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-2 py-1.5 shadow-xl min-w-max border border-gray-700">
                            <div className="font-semibold mb-1">
                              {formatDate(day, "EEE dd/MM")}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {dayPres.slice(0, 6).map((d, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 font-mono"
                                >
                                  {formatDate(d, "HH:mm")}
                                </span>
                              ))}
                              {dayPres.length > 6 && (
                                <span className="opacity-75">
                                  +{dayPres.length - 6}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center">
        <Pager />
      </div>
    </div>
  );

  // Vue Compacte (tableau rapide) – pager ajouté en bas
  const CompactView = () => (
    <div className={cn(classes.card, "overflow-visible")}>
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Vue compacte ({visibleMembers.length} membres)
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Aperçu rapide des présences par jour
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-max">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `200px repeat(${allDays.length}, 80px)`,
            }}
          >
            <div className="p-3 font-semibold text-gray-900 dark:text-gray-100 border-r border-b-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
              Membre
            </div>
            {allDays.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "p-2 text-center border-r border-b-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700",
                  isToday(day) && "bg-blue-100 dark:bg-blue-900/30",
                  isWeekend(day) &&
                  !isToday(day) &&
                  "bg-blue-50 dark:bg-blue-900/10"
                )}
              >
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {formatDate(day, "EEE dd")}
                </div>
              </div>
            ))}
          </div>

          {visibleMembers.map((member, idx) => {
            const times = groupedByMember[member.badgeId] || [];
            return (
              <div
                key={member.badgeId || idx}
                className="grid hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                style={{
                  gridTemplateColumns: `200px repeat(${allDays.length}, 80px)`,
                }}
              >
                <div className="p-3 border-r border-b border-gray-200 dark:border-gray-600 flex items-center gap-3 bg-white dark:bg-gray-800">
                  <Avatar
                    photo={member.photo}
                    firstName={member.firstName}
                    name={member.name}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      {member.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {member.firstName}
                    </div>
                  </div>
                </div>

                {allDays.map((day) => {
                  const dayTimes = times.filter(
                    (t) => toDateString(t) === toDateString(day)
                  );
                  return (
                    <div
                      key={`${member.badgeId}-${day.toISOString()}`}
                      className={cn(
                        "p-2 border-r border-b border-gray-200 dark:border-gray-600 min-h-[60px] flex items-center justify-center text-xs font-bold transition-colors",
                        dayTimes.length > 0
                          ? dayTimes.length > 3
                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                            : dayTimes.length > 1
                              ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                              : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : isWeekend(day)
                            ? "bg-blue-50 dark:bg-blue-900/10 text-gray-400 dark:text-gray-500"
                            : idx % 2 === 0
                              ? "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                              : "bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                      )}
                    >
                      {dayTimes.length > 0 ? dayTimes.length : ""}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center">
        <Pager />
      </div>
    </div>
  );

  // Vue Mensuelle
  const MonthlyView = () => {
    const generateCalendarDays = () => {
      const y = startDate.getFullYear();
      const m = startDate.getMonth();
      const firstDay = new Date(y, m, 1);
      const startCalendar = new Date(firstDay);
      const dow = firstDay.getDay();
      const shift = dow === 0 ? -5 : 1 - dow;
      startCalendar.setDate(startCalendar.getDate() + shift);

      const days = [];
      const cur = new Date(startCalendar);
      for (let i = 0; i < 42; i++) {
        days.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      return days;
    };

    const calendarDays = generateCalendarDays();

    const presencesByDayAndMember = (() => {
      const grouped = {};
      filteredPresences.forEach((presence) => {
        const date = parseTimestamp(presence.timestamp);
        const key = toDateString(date);
        grouped[key] ||= {};
        (grouped[key][presence.badgeId] ||= []).push({
          ...presence,
          parsedDate: date,
        });
      });
      return grouped;
    })();

    const toggleDayExpansion = (dayKey) => {
      const s = new Set(expandedDays);
      s.has(dayKey) ? s.delete(dayKey) : s.add(dayKey);
      setExpandedDays(s);
    };

    const onAvatarEnter = (badgeId, dayKey, e) => {
      const member = members.find((m) => m.badgeId === badgeId);
      const memberPresences = presencesByDayAndMember[dayKey]?.[badgeId] || [];
      setMousePos({ x: e.clientX, y: e.clientY });
      setHoveredMember({ member, presences: memberPresences, dayKey });
    };

    const onAvatarMove = (e) => {
      if (hoveredMember) {
        setMousePos({ x: e.clientX, y: e.clientY });
      }
    };

    const onAvatarLeave = () => {
      setTimeout(() => {
        setHoveredMember(null);
      }, 100);
    };

    const renderMemberAvatar = (
      badgeId,
      presenceCount,
      dayKey,
      dayIndex,
      memberIndex
    ) => {
      const member = members.find((m) => m.badgeId === badgeId);
      if (!member) return null;

      const uniqueZIndex = dayIndex * 100 + memberIndex + 10;

      return (
        <div
          key={badgeId}
          className="relative group cursor-pointer"
          style={{ zIndex: uniqueZIndex }}
          onMouseEnter={(e) => onAvatarEnter(badgeId, dayKey, e)}
          onMouseMove={onAvatarMove}
          onMouseLeave={onAvatarLeave}
        >
          <Avatar
            photo={member.photo}
            firstName={member.firstName}
            name={member.name}
            size={32}
          />

          {presenceCount > 1 && (
            <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[8px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center border border-white dark:border-gray-800 shadow-sm animate-pulse">
              {presenceCount > 99 ? "99+" : presenceCount}
            </div>
          )}

          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-[200]">
            <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-xl shadow-2xl p-4 min-w-[280px] max-w-[320px] border border-gray-700 dark:border-gray-600">
              <div className="flex items-center gap-3 mb-3">
                <Avatar
                  photo={member.photo}
                  firstName={member.firstName}
                  name={member.name}
                  size={48}
                />
                <div>
                  <h4 className="font-bold text-lg">
                    {member?.name} {member?.firstName}
                  </h4>
                  <p className="text-blue-300 text-sm">
                    Badge: {member?.badge_number}
                  </p>
                </div>
              </div>

              <div className="space-y-2 border-t border-gray-700 pt-3 mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="text-sm">
                    {formatDate(new Date(dayKey + "T00:00:00"), "EEEE dd MMMM")}
                  </span>
                </div>

                {(() => {
                  const presences = presencesByDayAndMember[dayKey]?.[badgeId] || [];
                  const multiple = presences.length > 1;
                  if (!multiple) {
                    return (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-green-400" />
                        <span className="text-sm">
                          Passage à {" "}
                          {formatDate(presences[0]?.parsedDate, "HH:mm")}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-orange-400" />
                        <span className="text-sm font-semibold text-orange-300">
                          ⚠️ {presences.length} passages (inhabituel)
                        </span>
                      </div>

                      <div className="mt-2">
                        <div className="text-xs text-gray-300 mb-1">
                          Heures de passage :
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {presences.slice(0, 6).map((presence, i) => (
                            <div
                              key={i}
                              className="bg-orange-600/30 text-orange-300 px-2 py-1 rounded text-xs border border-orange-500/30"
                            >
                              {formatDate(presence.parsedDate, "HH:mm")}
                            </div>
                          ))}
                          {presences.length > 6 && (
                            <div className="bg-gray-600/30 text-gray-300 px-2 py-1 rounded text-xs border border-gray-500/30">
                              +{presences.length - 6}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="flex justify-between items-center">
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                  Présent(e)
                </span>
                {presenceCount > 1 && (
                  <span className="text-xs text-orange-400 font-medium">
                    Vérifier badge
                  </span>
                )}
              </div>

              <div className="absolute top-full left-1/2 -translate-x-1/2">
                <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigatePeriod("prev")}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white capitalize">
                {formatDate(startDate, "MMMM yyyy")}
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                Planning des présences
              </p>
            </div>
            <button
              onClick={() => navigatePeriod("next")}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day, i) => (
            <div
              key={day}
              className={`p-4 text-center font-semibold text-sm border-r border-gray-200 dark:border-gray-600 last:border-r-0 ${i >= 5
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-700 dark:text-gray-300"
                }`}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const dateKey = toDateString(day);
            const dayMemberPresences = presencesByDayAndMember[dateKey] || {};
            const memberIds = Object.keys(dayMemberPresences);
            const totalPresences = Object.values(dayMemberPresences).reduce(
              (s, arr) => s + arr.length,
              0
            );
            const inMonth = day.getMonth() === startDate.getMonth();
            const weekend = isWeekend(day);
            const today = isToday(day);
            const expanded = expandedDays.has(dateKey);

            let visibleMembers, hiddenMembersCount, showExpandButton;
            if (memberIds.length <= 9) {
              visibleMembers = memberIds;
              hiddenMembersCount = 0;
              showExpandButton = false;
            } else if (memberIds.length <= 20) {
              if (expanded) {
                visibleMembers = memberIds;
                hiddenMembersCount = 0;
                showExpandButton = true;
              } else {
                visibleMembers = memberIds.slice(0, 6);
                hiddenMembersCount = memberIds.length - 6;
                showExpandButton = true;
              }
            } else {
              if (expanded) {
                visibleMembers = memberIds.slice(0, 30);
                hiddenMembersCount = Math.max(0, memberIds.length - 30);
                showExpandButton = true;
              } else {
                visibleMembers = memberIds.slice(0, 6);
                hiddenMembersCount = memberIds.length - 6;
                showExpandButton = true;
              }
            }

            return (
              <div
                key={idx}
                className={`${expanded ? "min-h-[200px]" : "min-h-[140px]"
                  } border-r border-b border-gray-200 dark:border-gray-600 last:border-r-0 p-2 relative ${!inMonth ? "bg-gray-50 dark:bg-gray-700 opacity-50" : ""
                  } ${weekend
                    ? "bg-blue-50 dark:bg-blue-900/10"
                    : "bg-white dark:bg-gray-800"
                  } ${today ? "ring-2 ring-blue-500 ring-inset" : ""} ${expanded ? "bg-blue-25 dark:bg-blue-900/5" : ""
                  } hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      !inMonth
                        ? "text-gray-400 dark:text-gray-500"
                        : today
                          ? "text-blue-600 dark:text-blue-400"
                          : weekend
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-900 dark:text-gray-100"
                    )}
                  >
                    {day.getDate()}
                  </span>

                  {totalPresences > 0 && (
                    <div className="flex items-center gap-1">
                      <span
                        className={cn(
                          "text-xs px-2 py-1 rounded-full font-bold",
                          memberIds.length > 30
                            ? "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                            : memberIds.length > 15
                              ? "bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
                              : "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                        )}
                      >
                        {memberIds.length > 99 ? "99+" : memberIds.length}
                      </span>
                      {memberIds.length > 20 && (
                        <span className="text-[10px] text-red-500 dark:text-red-400 font-bold">
                          🔥
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {memberIds.length > 0 && (
                  <div className="space-y-1">
                    {expanded && memberIds.length > 20 ? (
                      <div className="grid grid-cols-6 gap-0.5">
                        {visibleMembers.map((badgeId, index) => (
                          <div key={badgeId} className="flex justify-center">
                            {renderMemberAvatar(
                              badgeId,
                              dayMemberPresences[badgeId].length,
                              dateKey,
                              idx,
                              index
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-start gap-1 flex-wrap">
                          {visibleMembers
                            .slice(0, 3)
                            .map((badgeId, memberIndex) =>
                              renderMemberAvatar(
                                badgeId,
                                dayMemberPresences[badgeId].length,
                                dateKey,
                                idx,
                                memberIndex
                              )
                            )}
                        </div>
                        {visibleMembers.length > 3 && (
                          <div className="flex justify-start gap-1 flex-wrap">
                            {visibleMembers
                              .slice(3, 6)
                              .map((badgeId, memberIndex) =>
                                renderMemberAvatar(
                                  badgeId,
                                  dayMemberPresences[badgeId].length,
                                  dateKey,
                                  idx,
                                  memberIndex + 3
                                )
                              )}
                          </div>
                        )}
                        {visibleMembers.length > 6 && (
                          <div className="flex justify-start gap-1 flex-wrap">
                            {visibleMembers
                              .slice(6, 9)
                              .map((badgeId, memberIndex) =>
                                renderMemberAvatar(
                                  badgeId,
                                  dayMemberPresences[badgeId].length,
                                  dateKey,
                                  idx,
                                  memberIndex + 6
                                )
                              )}
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex justify-center gap-1 mt-1">
                      {showExpandButton && (
                        <button
                          onClick={() => toggleDayExpansion(dateKey)}
                          className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold transition-all transform hover:scale-105",
                            expanded
                              ? "bg-blue-500 text-white"
                              : memberIds.length > 30
                                ? "bg-red-500 text-white animate-pulse"
                                : "bg-orange-500 text-white"
                          )}
                          title={
                            expanded
                              ? "Réduire"
                              : `Voir les ${memberIds.length} membres`
                          }
                        >
                          {expanded
                            ? "−"
                            : `+${Math.max(
                              0,
                              memberIds.length - visibleMembers.length
                            )}`}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {today && (
                  <div className="absolute top-1 right-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 p-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                AB
              </div>
              <span>Membre présent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold relative">
                AB
                <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[8px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center border border-white animate-pulse">
                  3
                </div>
              </div>
              <span>Passages multiples</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full font-bold bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                50 🔥
              </span>
              <span>Journée très chargée</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ───────────────────────────────────────────────────────────────────────────────
  // Rendu principal
  return (
    <div className={classes.pageContainer}>
      <div className={classes.maxWidthWrapper}>
        {/* En-tête */}
        <div className={classes.headerCard}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={classes.iconContainer}>
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className={classes.title}>Planning des présences</h1>
                <p className={classes.subtitle}>
                  Suivi en temps réel des présences membres
                </p>
              </div>
            </div>

            {/* Vues + filtre - ORDRE CORRIGÉ */}
            <div className="flex flex-wrap justify-center sm:justify-end bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1 w-full sm:w-auto">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  classes.buttonSecondary,
                  viewMode === "list"
                    ? "bg-white dark:bg-gray-600 shadow-md text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                )}
                title="Vue liste"
              >
                <List className="w-5 h-5" />
              </button>

              {!isMobile && (
                <button
                  onClick={() => {
                    setViewMode("monthly");
                    if (period !== "month") {
                      setPeriod("month");
                      updateDateRange("month", startDate);
                    }
                  }}
                  className={cn(
                    classes.buttonSecondary,
                    viewMode === "monthly"
                      ? "bg-white dark:bg-gray-600 shadow-md text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  )}
                  title="Vue mensuelle"
                >
                  <Grid className="w-5 h-5" />
                </button>
              )}

              {!isMobile && (
                <button
                  onClick={() => setViewMode("compact")}
                  className={cn(
                    classes.buttonSecondary,
                    viewMode === "compact"
                      ? "bg-white dark:bg-gray-600 shadow-md text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  )}
                  title="Vue compacte"
                >
                  <Users className="w-5 h-5" />
                </button>
              )}

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "p-3 rounded-lg transition-all",
                  showFilters
                    ? "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                )}
                title="Afficher les filtres"
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>

            {role === "admin" && (
              <div className="mt-4">
                <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportExcel}
                    className="hidden"
                  />
                  📥 Importer fichier Excel (.xlsx)
                </label>
              </div>
            )}
          </div>

          {/* Navigation période */}
          <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg overflow-visible">
            <button
              onClick={() => navigatePeriod("prev")}
              className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors shadow-sm flex-shrink-0"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Début:
                </label>
                <input
                  type="date"
                  value={formatDate(startDate, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const picked = new Date(e.target.value);
                    if (period === "week") {
                      const s = startOfWeek(picked, { weekStartsOn: 1 });
                      const en = endOfWeek(picked, { weekStartsOn: 1 });
                      setStartDate(startOfDay(s));
                      setEndDate(endOfDay(en));
                    } else if (period === "month") {
                      const s = startOfMonth(picked);
                      const en = endOfMonth(picked);
                      setStartDate(startOfDay(s));
                      setEndDate(endOfDay(en));
                    } else {
                      const s = startOfYear(picked);
                      const en = endOfYear(picked);
                      setStartDate(startOfDay(s));
                      setEndDate(endOfDay(en));
                    }
                    setPage(1);
                  }}
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1 text-sm focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              <select
                className={classes.select}
                value={period}
                onChange={(e) => {
                  const value = e.target.value;
                  setPeriod(value);
                  setPage(1);
                  updateDateRange(value, startDate);
                }}
              >
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
                <option value="year">Année</option>
              </select>

              <div className="text-center min-w-0">
                <div className="text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                  {formatDate(startDate, "dd/MM/yyyy")} -{" "}
                  {formatDate(endDate, "dd/MM/yyyy")}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {allDays.length} jours
                </div>
              </div>
            </div>

            <button
              onClick={() => navigatePeriod("next")}
              className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors shadow-sm flex-shrink-0"
            >
              <ChevronRight className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Raccourcis */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-300 mr-2">
                Raccourcis :
              </span>

              <button
                onClick={() => {
                  const today = new Date();
                  setStartDate(startOfDay(today));
                  setEndDate(endOfDay(today));
                  setPage(1);
                }}
                className={classes.presetButton}
              >
                Aujourd'hui
              </button>

              <button
                onClick={() => {
                  const today = new Date();
                  setStartDate(
                    startOfDay(new Date(today.setDate(today.getDate() - 6)))
                  );
                  setEndDate(endOfDay(new Date()));
                  setPage(1);
                }}
                className={classes.presetButton}
              >
                7 derniers jours
              </button>

              <button
                onClick={() => {
                  const today = new Date();
                  setStartDate(
                    startOfDay(new Date(today.setDate(today.getDate() - 29)))
                  );
                  setEndDate(endOfDay(new Date()));
                  setPage(1);
                }}
                className={classes.presetButton}
              >
                30 derniers jours
              </button>

              <button
                onClick={() => {
                  setStartDate(
                    startOfDay(startOfWeek(new Date(), { weekStartsOn: 1 }))
                  );
                  setEndDate(
                    endOfDay(endOfWeek(new Date(), { weekStartsOn: 1 }))
                  );
                  setPage(1);
                }}
                className={classes.presetButton}
              >
                Cette Semaine
              </button>

              <button
                onClick={() => {
                  setStartDate(startOfDay(startOfMonth(new Date())));
                  setEndDate(endOfDay(endOfMonth(new Date())));
                  setPage(1);
                }}
                className={classes.presetButton}
              >
                Ce Mois
              </button>

              <button
                onClick={() => {
                  setStartDate(startOfDay(startOfYear(new Date())));
                  setEndDate(endOfDay(endOfYear(new Date())));
                  setPage(1);
                }}
                className={classes.presetButton}
              >
                Cette Année
              </button>
            </div>
          </div>
        </div>

        {/* Filtres */}
        {showFilters && (
          <div className={classes.card + " p-6 mb-6"}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rechercher par nom
                </label>
                <input
                  type="text"
                  placeholder="Nom ou prénom..."
                  value={filterNameInput}
                  onChange={(e) => setFilterNameInput(e.target.value)}
                  className={cn(
                    classes.input,
                    "w-full placeholder-gray-500 dark:placeholder-gray-400"
                  )}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Filtrer par badge
                </label>
                <input
                  type="text"
                  placeholder="Numéro de badge..."
                  value={filterBadgeInput}
                  onChange={(e) => setFilterBadgeInput(e.target.value)}
                  className={cn(
                    classes.input,
                    "w-full placeholder-gray-500 dark:placeholder-gray-400"
                  )}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-3 text-sm font-medium p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={showNightHours}
                    onChange={() => setShowNightHours(!showNightHours)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Afficher 00h - 06h
                  </span>
                </label>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className={cn(classes.buttonPrimary, "w-full")}
                >
                  <RefreshCw
                    className={cn("w-4 h-4", isRetrying && "animate-spin")}
                  />
                  Actualiser
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Résumé */}
        <StatsResume />

        {/* Contenu principal */}
        {visibleMembers.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center border border-gray-200 dark:border-gray-700">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-12 h-12 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Aucune présence trouvée
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Aucune présence n'a été enregistrée sur cette période ou avec ces
              filtres.
              <br />
              Essayez d'ajuster la période ou utilisez les raccourcis ci-dessus.
            </p>
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Recharger les données
            </button>
          </div>
        ) : (
          <>
            {viewMode === "list" && <ListView />}
            {viewMode === "compact" && !isMobile && <CompactView />}
            {viewMode === "monthly" && !isMobile && <MonthlyView />}
          </>
        )}

        {/* Modal pour afficher/éditer le membre sur mobile */}
        {showForm && selectedMember && (
          <MemberForm
            member={selectedMember}
            onSave={handleSaveMember}
            onCancel={handleCloseForm}
          />
        )}
      </div>
    </div>
  );
}

export default PlanningPage;

// ✅ FIN DU FICHIER