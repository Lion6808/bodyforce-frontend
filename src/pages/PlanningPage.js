/**
 * PlanningPage.js
 *
 * Attendance planning page for the BodyForce application.
 * Displays member presences over configurable date ranges with three view modes:
 *   - List view: daily presence badges per member
 *   - Compact view: grid/table with day columns
 *   - Monthly view: calendar with avatar tooltips
 *
 * Features:
 *   - Server-side pagination (members with presences in the selected period)
 *   - Debounced filters (name, badge ID)
 *   - Excel import (UPSERT with onConflict badgeId,timestamp)
 *   - Intratone synchronization (admin only)
 *   - Period navigation (week / month / year) with shortcut presets
 *   - Responsive layout with mobile-specific behavior
 *
 * Data source: Supabase (tables: members, presences)
 */

// ============================================================================
// SECTION 1 -- Imports
// ============================================================================

import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import * as XLSX from "xlsx";
import { supabase, supabaseServices } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import MemberForm from "../components/MemberForm";
import Avatar from "../components/Avatar";

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

// ============================================================================
// SECTION 2 -- Constants & Configuration
// ============================================================================

/** Backend API base URL (local dev vs production) */
const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : "https://bodyforce.onrender.com";

/** Number of members displayed per page */
const PAGE_SIZE = 10;

// ============================================================================
// SECTION 3 -- Utility functions (pure, no component state dependency)
// ============================================================================

/** Concatenate CSS class names, filtering out falsy values */
const cn = (...classes) => classes.filter(Boolean).join(" ");

/**
 * Format a Date object according to a predefined format key.
 * Uses Intl.DateTimeFormat with locale "fr-FR".
 * @param {Date} date
 * @param {string} fmt - One of: "yyyy-MM-dd", "dd/MM/yyyy", "EEE dd/MM",
 *                        "EEE dd", "HH:mm", "MMMM yyyy", "EEEE dd MMMM"
 * @returns {string}
 */
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

/** Parse a timestamp string into a Date object */
const parseTimestamp = (ts) => new Date(ts);

/**
 * Convert a Date to "YYYY-MM-DD" string (local timezone).
 * @param {Date|null} date
 * @returns {string}
 */
const toDateString = (date) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Check if a date falls on a weekend (Saturday or Sunday) */
const isWeekend = (date) => [0, 6].includes(date.getDay());

/** Check if a date falls within the given interval (inclusive) */
const isWithinInterval = (date, interval) =>
  date >= interval.start && date <= interval.end;

/** Generate an array of Date objects for each day in the interval */
const eachDayOfInterval = ({ start, end }) => {
  const out = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

/** Return a new Date set to 00:00:00.000 of the given day */
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** Return a new Date set to 23:59:59.999 of the given day */
const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

/** Add n weeks to a date */
const addWeeks = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n * 7);
  return x;
};

/** Add n months to a date */
const addMonths = (d, n) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};

/** Add n years to a date */
const addYears = (d, n) => {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + n);
  return x;
};

/** Subtract n weeks from a date */
const subWeeks = (d, n) => addWeeks(d, -n);

/** Check if a date is today */
const isToday = (d) => d.toDateString() === new Date().toDateString();

// ============================================================================
// SECTION 4 -- Tailwind CSS class maps
// ============================================================================

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
};

// ============================================================================
// SECTION 5 -- Main component
// ============================================================================

/**
 * PlanningPage component.
 * Renders the attendance planning dashboard with period navigation,
 * filters, statistics summary, and three switchable view modes.
 */
function PlanningPage() {
  // --------------------------------------------------------------------------
  // 5.1 -- State declarations
  // --------------------------------------------------------------------------

  // Core data (scoped to current page and period)
  const [presences, setPresences] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const { role } = useAuth();

  // Intratone sync (admin only)
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  // Period and date range
  const [period, setPeriod] = useState("week");
  const [startDate, setStartDate] = useState(startOfDay(subWeeks(new Date(), 1)));
  const [endDate, setEndDate] = useState(endOfDay(new Date()));

  // Immediate filter inputs (updated on each keystroke)
  const [filterBadgeInput, setFilterBadgeInput] = useState("");
  const [filterNameInput, setFilterNameInput] = useState("");

  // Debounced filter values (trigger data fetching after 500ms idle)
  const [filterBadge, setFilterBadge] = useState("");
  const [filterName, setFilterName] = useState("");

  // UI state
  const [showNightHours, setShowNightHours] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);

  // Member detail modal state
  const [selectedMember, setSelectedMember] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Monthly view tooltip and expansion state
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [hoveredMember, setHoveredMember] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const navigate = useNavigate();

  // --------------------------------------------------------------------------
  // 5.2 -- Member edit / modal handlers
  // --------------------------------------------------------------------------

  /** Open the member edit form (modal on mobile, navigation on desktop) */
  const handleEditMember = async (member) => {
    if (!member || !member.id) return;

    if (isMobile) {
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
      navigate("/members/edit", {
        state: { member, returnPath: "/planning", memberId: member.id },
      });
    }
  };

  /** Close the member edit modal */
  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedMember(null);
  };

  /** Save handler after member edit -- reload data to reflect changes */
  const handleSaveMember = async () => {
    setShowForm(false);
    setSelectedMember(null);
    await loadData();
  };

  // --------------------------------------------------------------------------
  // 5.3 -- Data loading (Supabase)
  // --------------------------------------------------------------------------

  /**
   * Fetch members and presences from Supabase for the current period and filters.
   * Steps:
   *   A) Fetch all badgeIds with at least one presence in the period
   *   B) Load corresponding members, apply name/badge filters, sort by last seen
   *   C) Paginate the filtered member list
   *   D) Fetch presences only for the current page's members
   *
   * @param {boolean} showRetryIndicator - Whether to show the retry spinner
   */
  const loadData = async (showRetryIndicator = false) => {
    try {
      if (showRetryIndicator) setIsRetrying(true);
      setLoading(true);
      setError("");

      // A) Fetch presences in the period (optionally filtered by badge)
      let presencesQ = supabase
        .from("presences")
        .select("badgeId,timestamp")
        .gte("timestamp", startDate.toISOString())
        .lte("timestamp", endDate.toISOString());

      if (filterBadge?.trim()) {
        presencesQ = presencesQ.ilike("badgeId", `%${filterBadge.trim()}%`);
      }

      const { data: presInPeriod, error: prsErr } = await presencesQ;
      if (prsErr) throw new Error(`Erreur presences (periode): ${prsErr.message}`);

      // Build a map of last-seen timestamp per badge
      const lastSeenByBadge = {};
      (presInPeriod || []).forEach((p) => {
        if (!p || !p.badgeId || !p.timestamp) return;
        const t = new Date(p.timestamp).getTime();
        if (!Number.isFinite(t)) return;
        if (!lastSeenByBadge[p.badgeId] || t > lastSeenByBadge[p.badgeId]) {
          lastSeenByBadge[p.badgeId] = t;
        }
      });

      // Collect distinct badge IDs present in the period
      const badgeIdSet = new Set(
        (presInPeriod || [])
          .map((p) => p.badgeId)
          .filter((b) => !!b)
      );
      const allBadgeIdsInPeriod = Array.from(badgeIdSet);

      // No presences found -- clear display and return early
      if (allBadgeIdsInPeriod.length === 0) {
        setMembers([]);
        setPresences([]);
        setTotalMembers(0);
        setRetryCount(0);
        return;
      }

      // B) Load members matching the badge IDs, then apply filters
      const { data: periodMembersAll, error: membersErr } = await supabase
        .from("members")
        .select("id,name,firstName,badgeId,badge_number,photo")
        .in("badgeId", allBadgeIdsInPeriod)
        .order("name", { ascending: true });

      if (membersErr) throw new Error(`Erreur membres: ${membersErr.message}`);

      let filteredMembers = periodMembersAll || [];

      // Sort by most recent presence (descending), then alphabetically
      filteredMembers.sort((a, b) => {
        const tb = lastSeenByBadge[b.badgeId] ?? 0;
        const ta = lastSeenByBadge[a.badgeId] ?? 0;
        if (tb !== ta) return tb - ta;
        return (a.name || "").localeCompare(b.name || "");
      });

      // Apply name filter
      if (filterName?.trim()) {
        const s = filterName.trim().toLowerCase();
        filteredMembers = filteredMembers.filter((m) =>
          `${m.name || ""} ${m.firstName || ""}`.toLowerCase().includes(s)
        );
      }

      // Apply badge filter (client-side complement to server-side ilike)
      if (filterBadge?.trim()) {
        const s = filterBadge.trim();
        filteredMembers = filteredMembers.filter((m) =>
          (m.badgeId || "").includes(s)
        );
      }

      // C) Paginate members
      const total = filteredMembers.length;
      setTotalMembers(total);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE;
      const pageMembers = filteredMembers.slice(from, to);
      setMembers(pageMembers);

      // D) Fetch presences only for the current page's members
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

        if (error) throw new Error(`Erreur presences (page): ${error.message}`);
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
      setError(err.message || "Erreur de connexion a la base de donnees");
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  // --------------------------------------------------------------------------
  // 5.4 -- Effects
  // --------------------------------------------------------------------------

  // Reload data whenever period, filters, or page change
  useEffect(() => {
    loadData();
  }, [startDate, endDate, filterName, filterBadge, page]);

  // Debounce: propagate name input to actual filter after 500ms idle
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilterName(filterNameInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [filterNameInput]);

  // Debounce: propagate badge input to actual filter after 500ms idle
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilterBadge(filterBadgeInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [filterBadgeInput]);

  // Track viewport width for responsive layout
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // --------------------------------------------------------------------------
  // 5.5 -- Period navigation helpers
  // --------------------------------------------------------------------------

  /** Retry loading data (manual refresh) */
  const handleRetry = () => {
    setRetryCount((v) => v + 1);
    loadData(true);
  };

  /**
   * Align start/end dates to the natural boundaries of the given period type.
   * Also resets pagination to page 1.
   * @param {string} value - "week" | "month" | "year"
   * @param {Date} base - Reference date for alignment
   */
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

  /** Navigate to the previous or next period */
  const navigatePeriod = (direction) => {
    const amount = direction === "prev" ? -1 : 1;
    let newStart;
    if (period === "week") newStart = addWeeks(startDate, amount);
    else if (period === "month") newStart = addMonths(startDate, amount);
    else newStart = addYears(startDate, amount);
    updateDateRange(period, newStart);
  };

  /** Convert a raw timestamp to a local Date */
  const toLocalDate = (timestamp) => parseTimestamp(timestamp);

  // --------------------------------------------------------------------------
  // 5.6 -- Excel import
  // --------------------------------------------------------------------------

  /**
   * Handle Excel file import.
   * Reads .xlsx/.xls, maps "Quand"/"Quoi"/"Qui" columns to presence records,
   * then upserts in 500-row chunks (onConflict: badgeId,timestamp).
   */
  const handleImportExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Verify authentication (needed for RLS)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Vous devez etre connecte pour importer des presences.");
        return;
      }
    } catch (e) {
      console.error("Auth check error:", e);
    }

    // Date parsing helpers
    const excelSerialToDate = (serial) => {
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
      const d = new Date(str);
      return isNaN(d) ? null : d;
    };

    const toJsDate = (val) => {
      if (val instanceof Date) return val;
      if (typeof val === "number") return excelSerialToDate(val);
      if (typeof val === "string") return tryParseFR(val);
      return null;
    };

    // Read and process the file
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });

        // Import statistics
        let totalRows = 0;
        let kept = 0;
        let filteredOtherType = 0;
        let skippedNoBadge = 0;
        let skippedNoDate = 0;
        let unparsableDate = 0;

        const allowedTypes = new Set(["Badges ou Telecommandes", "CleMobil"]);
        const payload = [];

        for (const row of rows) {
          totalRows++;

          const quoi = (row["Quoi"] ?? "").toString().trim();
          const quiRaw = row["Qui"];
          const quandRaw = row["Quand"];

          // Filter by type (ignore "BP", empty lines, etc.)
          if (!allowedTypes.has(quoi)) {
            filteredOtherType++;
            continue;
          }

          // Badge ID is required
          const badgeId = (quiRaw ?? "").toString().trim();
          if (!badgeId) {
            skippedNoBadge++;
            continue;
          }

          // Date is required
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
              "Aucune ligne importee.",
              `Lignes totales: ${totalRows}`,
              `- Gardees: ${kept}`,
              `- Filtrees (type): ${filteredOtherType}`,
              `- Sans badge: ${skippedNoBadge}`,
              `- Sans date: ${skippedNoDate}`,
              `- Date illisible: ${unparsableDate}`,
            ].join("\n")
          );
          return;
        }

        // Upsert in chunks of 500
        const chunkSize = 500;
        let affected = 0;

        for (let i = 0; i < payload.length; i += chunkSize) {
          const chunk = payload.slice(i, i + chunkSize);
          const { data: upserted, error } = await supabase
            .from("presences")
            .upsert(chunk, { onConflict: "badgeId,timestamp" })
            .select("badgeId");

          if (error) {
            console.error("Upsert error:", error);
            alert("Erreur lors de l'upsert: " + (error.message || "inconnue"));
            return;
          }

          affected += Array.isArray(upserted) ? upserted.length : 0;
        }

        alert(
          [
            "Import termine.",
            `Lignes totales lues: ${totalRows}`,
            `- Retenues pour import: ${kept}`,
            `- Upsertees (insert+update): ${affected} (doublons ignores)`,
            `- Filtrees type: ${filteredOtherType} | Sans badge: ${skippedNoBadge} | Sans date: ${skippedNoDate} | Date illisible: ${unparsableDate}`,
          ].join("\n")
        );

        loadData();
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Erreur import Excel:", err);
      alert("Erreur lors de l'import.");
    } finally {
      // Allow re-importing the same file without page reload
      try { event.target.value = ""; } catch { }
    }
  };

  // --------------------------------------------------------------------------
  // 5.7 -- Loading and error screens
  // --------------------------------------------------------------------------

  /** Render the connection error screen with retry button */
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

  /** Render the loading spinner screen */
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

  // Early returns for loading / error states
  if (loading) return renderLoading();
  if (error && !isRetrying) return renderConnectionError();

  // --------------------------------------------------------------------------
  // 5.8 -- Derived data (computed from state after loading)
  // --------------------------------------------------------------------------

  // Filter presences to the current date range
  const filteredPresences = presences.filter((p) => {
    const presenceDate = toLocalDate(p.timestamp);
    return isWithinInterval(presenceDate, { start: startDate, end: endDate });
  });

  // Group presence dates by member badge ID
  const groupedByMember = {};
  filteredPresences.forEach((p) => {
    const key = p.badgeId;
    if (!groupedByMember[key]) groupedByMember[key] = [];
    groupedByMember[key].push(toLocalDate(p.timestamp));
  });

  // All days in the selected period
  const allDays = eachDayOfInterval({ start: startDate, end: endDate });

  /** Look up a member object by badge ID */
  const getMemberInfo = (badgeId) =>
    members.find((m) => m.badgeId === badgeId) || {};

  // Members visible in the current page
  const visibleMembers = members;

  // --------------------------------------------------------------------------
  // 5.9 -- Statistics computation
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // 5.10 -- Pagination
  // --------------------------------------------------------------------------

  const totalPages = Math.max(1, Math.ceil(totalMembers / PAGE_SIZE));

  /** Navigate to a specific page (clamped to valid range) */
  const goToPage = (p) => setPage(Math.min(Math.max(1, p), totalPages));

  /** Pagination control component */
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

  // ============================================================================
  // SECTION 6 -- Sub-components (StatsResume, ListView, CompactView, MonthlyView)
  // ============================================================================

  // --------------------------------------------------------------------------
  // 6.1 -- StatsResume: period summary cards
  // --------------------------------------------------------------------------

  /** Render the statistics summary cards for the selected period */
  const StatsResume = () => (
    <div className={cn(classes.card, "p-6 mb-6")}>
      {/* Section header */}
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

      {/* Stat cards grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Active members */}
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

        {/* Total presences */}
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

        {/* Average members per day */}
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

        {/* Days covered */}
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

        {/* Busiest day */}
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

  // --------------------------------------------------------------------------
  // 6.2 -- ListView: daily presence badges per member
  // --------------------------------------------------------------------------

  /** Render the list view with daily presence dots per member */
  const ListView = () => (
    <div className={cn(classes.card, "overflow-visible")}>
      {/* List header with pagination */}
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

      {/* Member rows */}
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
              {/* Member info */}
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
                      Badge: {member?.badgeId}{member?.badge_number ? ` (${member.badge_number})` : ''}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                      {times.length} présence(s)
                    </span>
                  </div>
                </div>
              </div>

              {/* Daily presence grid */}
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

                      {/* Tooltip with presence times */}
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

      {/* Bottom pagination */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center">
        <Pager />
      </div>
    </div>
  );

  // --------------------------------------------------------------------------
  // 6.3 -- CompactView: grid table with day columns
  // --------------------------------------------------------------------------

  /** Render the compact grid view with a column per day */
  const CompactView = () => (
    <div className={cn(classes.card, "overflow-visible")}>
      {/* Compact view header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Vue compacte ({visibleMembers.length} membres)
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Aperçu rapide des présences par jour
        </p>
      </div>

      {/* Scrollable grid */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Column headers (days) */}
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

          {/* Member rows */}
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
                {/* Member name cell */}
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

                {/* Day cells */}
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

      {/* Bottom pagination */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center">
        <Pager />
      </div>
    </div>
  );

  // --------------------------------------------------------------------------
  // 6.4 -- MonthlyView: calendar grid with member avatars
  // --------------------------------------------------------------------------

  /** Render the monthly calendar view with avatar tooltips */
  const MonthlyView = () => {
    /** Generate a 6-week (42 day) calendar grid starting from Monday */
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

    // Group presences by day and member for quick lookup
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

    /** Toggle expansion of a calendar day cell */
    const toggleDayExpansion = (dayKey) => {
      const s = new Set(expandedDays);
      s.has(dayKey) ? s.delete(dayKey) : s.add(dayKey);
      setExpandedDays(s);
    };

    /** Tooltip hover handlers */
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

    /**
     * Render a single member avatar with optional multi-passage badge
     * and a detailed hover tooltip.
     */
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

          {/* Multi-passage badge indicator */}
          {presenceCount > 1 && (
            <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[8px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center border border-white dark:border-gray-800 shadow-sm animate-pulse">
              {presenceCount > 99 ? "99+" : presenceCount}
            </div>
          )}

          {/* Detailed hover tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-[200]">
            <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-xl shadow-2xl p-4 min-w-[280px] max-w-[320px] border border-gray-700 dark:border-gray-600">
              {/* Tooltip header: avatar + name */}
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
                    Badge: {member?.badgeId}
                  </p>
                </div>
              </div>

              {/* Tooltip body: date and passage times */}
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
                          {presences.length} passages (inhabituel)
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

              {/* Tooltip footer: status */}
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

              {/* Tooltip arrow */}
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
        {/* Calendar navigation header */}
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

        {/* Day-of-week headers */}
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

        {/* Calendar day cells */}
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

            // Determine how many avatars to show vs. hide
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
                {/* Day number and member count badge */}
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
                    </div>
                  )}
                </div>

                {/* Member avatars */}
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
                        {/* Row 1: first 3 avatars */}
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
                        {/* Row 2: avatars 4-6 */}
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
                        {/* Row 3: avatars 7-9 */}
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

                    {/* Expand / collapse button */}
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
                            ? "\u2212"
                            : `+${Math.max(
                              0,
                              memberIds.length - visibleMembers.length
                            )}`}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Today indicator dot */}
                {today && (
                  <div className="absolute top-1 right-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Calendar legend */}
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
                50
              </span>
              <span>Journée très chargée</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // SECTION 7 -- Main render
  // ============================================================================

  return (
    <div className={classes.pageContainer}>
      <div className={classes.maxWidthWrapper}>
        {/* Page header */}
        <div className={classes.headerCard}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Title and icon */}
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

            {/* View mode switcher and filter toggle */}
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

            {/* Admin actions: Excel import and Intratone sync */}
            {role === "admin" && (
              <div className="mt-4 flex flex-col gap-3">
                <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition w-fit">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportExcel}
                    className="hidden"
                  />
                  Importer fichier Excel (.xlsx)
                </label>

                {/* Intratone sync button */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={async () => {
                      setSyncLoading(true);
                      setSyncResult(null);
                      try {
                        const res = await fetch(`${API_URL}/api/intratone/sync`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: JSON.stringify({ role: "admin" }),
                          },
                        });
                        const data = await res.json();
                        setSyncResult(data);
                        if (data.success) loadData();
                      } catch (err) {
                        setSyncResult({ error: err.message });
                      } finally {
                        setSyncLoading(false);
                      }
                    }}
                    disabled={syncLoading}
                    className="px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-lg transition-all duration-200 flex items-center gap-2"
                  >
                    <RefreshCw className={cn("w-4 h-4", syncLoading && "animate-spin")} />
                    {syncLoading ? "Synchronisation..." : "Synchroniser Intratone"}
                  </button>

                  {/* Sync result feedback */}
                  {syncResult && (
                    <span className={cn(
                      "text-sm font-medium",
                      syncResult.error
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-600 dark:text-green-400"
                    )}>
                      {syncResult.error
                        ? `Erreur: ${syncResult.error}`
                        : syncResult.message
                          ? syncResult.message
                          : `${syncResult.events ?? 0} event(s) sync`}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Period navigation bar */}
          <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg overflow-visible">
            <button
              onClick={() => navigatePeriod("prev")}
              className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors shadow-sm flex-shrink-0"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 flex-1 min-w-0">
              {/* Start date picker */}
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

              {/* Period type selector */}
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

              {/* Current date range display */}
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

          {/* Quick date presets */}
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

        {/* Filter panel (toggled) */}
        {showFilters && (
          <div className={classes.card + " p-6 mb-6"}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Name filter */}
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
              {/* Badge filter */}
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
              {/* Night hours toggle */}
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
              {/* Refresh button */}
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

        {/* Statistics summary */}
        <StatsResume />

        {/* Main content: selected view or empty state */}
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

        {/* Member edit modal (mobile only) */}
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
