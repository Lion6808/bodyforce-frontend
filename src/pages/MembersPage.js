/**
 * MembersPage.js
 *
 * Main members list page with optimised egress (pagination + lazy photo loading).
 * Features: advanced search (wildcards, anchors, OR/AND), filters by gender /
 * student / expired / recent badges / missing certificate, bulk actions,
 * Excel import/export, mobile card view and desktop table view.
 */

// =============================================================================
// SECTION 1 -- Imports
// =============================================================================

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase, supabaseServices } from "../supabaseClient";
import MemberForm from "../components/MemberForm";
import { isBefore, parseISO } from "date-fns";
import {
  FaEdit,
  FaTrash,
  FaPlus,
  FaSync,
  FaExternalLinkAlt,
  FaChevronLeft,
  FaChevronRight,
  FaSearch,
  FaFileImport,
  FaFileExport,
} from "react-icons/fa";
import Avatar from "../components/Avatar";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

// =============================================================================
// SECTION 2 -- Search utilities (stateless helpers)
// =============================================================================

/**
 * Normalise a string for accent-insensitive, lowercase comparison.
 * @param {string} s - Input string.
 * @returns {string} Normalised string.
 */
const normalize = (s = "") =>
  s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Escape regex-special characters but leave wildcard markers intact. */
const escapeForWildcard = (s) => s.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");

/**
 * Convert a single user-facing search token to a RegExp.
 * Supports `*` (any chars), `?` (one char), `^` / `$` anchors.
 * @param {string} tokenRaw - Raw token typed by the user.
 * @returns {RegExp|null}
 */
const tokenToRegex = (tokenRaw) => {
  if (!tokenRaw) return null;
  let t = tokenRaw.trim();
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
const parseSearch = (search) => {
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
const matchesSearch = (member, compiledClauses) => {
  if (!compiledClauses.length) return true;
  const haystack = normalize(
    [member.name, member.firstName, member.badgeId, member.email, member.mobile]
      .filter(Boolean)
      .join(" ")
  );
  return compiledClauses.some((tokens) => tokens.every((rx) => rx.test(haystack)));
};

/**
 * Analyse raw search text and return metadata for the SearchHints component.
 * @param {string} raw - Raw search input.
 * @returns {{ active: boolean, clauses: string[][], hasWildcards: boolean, hasAnchors: boolean }}
 */
const analyzeSearch = (raw) => {
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

// =============================================================================
// SECTION 3 -- Constants & configuration
// =============================================================================

/** Number of members displayed per page. */
const ITEMS_PER_PAGE = 20;

/** Subscription end-date overrides keyed by subscription year. */
const SUBSCRIPTION_END_DATES = {
  2025: "2026-01-01",
  2026: "2027-01-10",
  2027: "2028-01-15",
};

/**
 * Return the configured subscription end date for a given year.
 * Falls back to December 31st if no override exists.
 * @param {number} year
 * @returns {string} ISO date string.
 */
const getSubscriptionEndDate = (year) => {
  if (SUBSCRIPTION_END_DATES[year]) {
    return SUBSCRIPTION_END_DATES[year];
  }
  console.warn(`No subscription end date configured for ${year}, using fallback`);
  return `${year}-12-31`;
};

/**
 * Return a Tailwind badge-colour class string for a subscription type.
 * @param {string} type - Subscription type label.
 * @returns {string}
 */
const getBadgeColor = (type) => {
  switch (type) {
    case "Mensuel":
      return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
    case "Trimestriel":
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300";
    case "Semestriel":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
    case "Annuel":
    case "Année civile":
      return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300";
    default:
      return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300";
  }
};

/**
 * Check whether a member's subscription has expired.
 * @param {object} m - Member record.
 * @returns {boolean}
 */
const isMemberExpired = (m) => {
  if (!m.endDate) return false;
  try {
    return isBefore(parseISO(m.endDate), new Date());
  } catch {
    return false;
  }
};

/**
 * Check whether a member has attached files / certificates.
 * @param {object} member
 * @returns {boolean}
 */
const memberHasFiles = (member) => {
  if (!member.files) return false;
  if (Array.isArray(member.files)) return member.files.length > 0;
  if (typeof member.files === "string") return member.files !== "[]" && member.files !== "";
  return Object.keys(member.files).length > 0;
};

// =============================================================================
// SECTION 4 -- Sub-components
// =============================================================================

// 4.1 -- SearchHints
// -----------------------------------------------------------------------------

/**
 * Inline component that renders contextual hints about the current search query.
 * @param {{ search: string }} props
 */
function SearchHints({ search }) {
  const info = analyzeSearch(search);
  if (!info.active) return null;

  return (
    <div className="w-full sm:w-auto sm:max-w-[36rem] text-xs mt-1 space-y-1">
      {/* Active-mode badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
          Recherche avancée
        </span>
        {info.hasWildcards && (
          <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
            Jokers * et ?
          </span>
        )}
        {info.hasAnchors && (
          <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
            Ancres ^ et $
          </span>
        )}
      </div>

      {/* Clause visualisation */}
      <div className="flex flex-wrap items-center gap-2">
        {info.clauses.map((tokens, i) => (
          <div
            key={i}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
            title="Tous les tokens d'un groupe = AND"
          >
            {tokens.map((t, j) => (
              <span
                key={j}
                className="px-1.5 py-0.5 rounded bg-white/70 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 font-mono"
              >
                {t}
              </span>
            ))}
            <span className="ml-1 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              AND
            </span>
          </div>
        ))}
        {info.clauses.length > 1 && (
          <span
            className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400"
            title="Groupes reliés par OR"
          >
            (Groupes reliés par OR)
          </span>
        )}
      </div>

      {/* Usage examples */}
      <div className="text-[11px] text-gray-500 dark:text-gray-400">
        Exemples : <code className="font-mono">b*</code> (commence par b),{" "}
        <code className="font-mono">*son</code> (finit par son),{" "}
        <code className="font-mono">mar?</code> (mar + 1 char),{" "}
        <code className="font-mono">homme mar*</code> (AND),{" "}
        <code className="font-mono">b* OR mar*</code> (OR),{" "}
        <code className="font-mono">^mar*</code> (ancré début),{" "}
        <code className="font-mono">*tin$</code> (ancré fin).
      </div>
    </div>
  );
}

// 4.2 -- Widget
// -----------------------------------------------------------------------------

/**
 * Clickable stat widget used in the filter bar.
 * @param {{ title: string, value: number, onClick: Function, active: boolean }} props
 */
function Widget({ title, value, onClick, active = false }) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-3xl text-center cursor-pointer transition-colors duration-150 border-2 transform-gpu ${
        active
          ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 shadow-md"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-700 shadow-sm"
      }`}
    >
      <div
        className={`text-sm ${
          active
            ? "text-blue-700 dark:text-blue-300 font-medium"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        {title}
      </div>
      <div
        className={`text-xl font-bold ${
          active
            ? "text-blue-800 dark:text-blue-200"
            : "text-gray-800 dark:text-gray-200"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

// =============================================================================
// SECTION 5 -- Main component
// =============================================================================

function MembersPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const editedMemberIdFromState = location.state?.memberId;

  // ---------------------------------------------------------------------------
  // 5.1 -- State
  // ---------------------------------------------------------------------------

  // Core data
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [activeFilter, setActiveFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & photos
  const [currentPage, setCurrentPage] = useState(1);
  const [photosCache, setPhotosCache] = useState({});
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // Mobile modal
  const [selectedMember, setSelectedMember] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // ---------------------------------------------------------------------------
  // 5.2 -- Refs
  // ---------------------------------------------------------------------------

  const memberRefs = useRef({});
  const restoreRef = useRef(null);
  const photosLoadingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // 5.3 -- Derived / memoised values
  // ---------------------------------------------------------------------------

  /** Members visible on the current page. */
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMembers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMembers, currentPage]);

  const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  // Statistics
  const total = filteredMembers.length;
  const maleCount = filteredMembers.filter((m) => m.gender === "Homme").length;
  const femaleCount = filteredMembers.filter((m) => m.gender === "Femme").length;
  const studentCount = filteredMembers.filter((m) => m.etudiant).length;

  const expiredCount = members.filter((m) => {
    if (!m.endDate) return true;
    try {
      return isBefore(parseISO(m.endDate), new Date());
    } catch {
      return true;
    }
  }).length;

  const noCertCount = filteredMembers.filter((m) => !memberHasFiles(m)).length;

  const membersWithBadge = members.filter((m) => m.badge_number != null).length;
  const recentCount = Math.min(20, membersWithBadge);

  // ---------------------------------------------------------------------------
  // 5.4 -- Effects
  // ---------------------------------------------------------------------------

  // Detect mobile breakpoint
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Disable browser scroll restoration
  useEffect(() => {
    const { history } = window;
    const prev = history.scrollRestoration;
    try {
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    } catch {}
    return () => {
      try {
        if ("scrollRestoration" in history)
          history.scrollRestoration = prev || "auto";
      } catch {}
    };
  }, []);

  // Restore saved page context from sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem("membersPageCtx");
    if (!raw) return;
    try {
      const ctx = JSON.parse(raw);
      if (typeof ctx.search === "string") setSearch(ctx.search);
      if (ctx.activeFilter !== undefined) setActiveFilter(ctx.activeFilter);
      if (typeof ctx.sortAsc === "boolean") setSortAsc(ctx.sortAsc);
      if (Array.isArray(ctx.selectedIds)) setSelectedIds(ctx.selectedIds);
      if (typeof ctx.currentPage === "number") setCurrentPage(ctx.currentPage);
      restoreRef.current = ctx;
    } catch {}
  }, []);

  // Scroll to edited member after returning from the edit page
  useEffect(() => {
    if (!editedMemberIdFromState) return;
    if (loading || filteredMembers.length === 0) return;

    const t = setTimeout(() => {
      scrollToMember(editedMemberIdFromState);
      window.history.replaceState({}, "", location.pathname);
    }, 100);

    return () => clearTimeout(t);
  }, [editedMemberIdFromState, loading, filteredMembers, location.pathname]);

  // Scroll to last-viewed member (stored in sessionStorage)
  useEffect(() => {
    if (loading || filteredMembers.length === 0) return;

    const lastId = sessionStorage.getItem("membersLastId");
    if (!lastId) return;

    let attempts = 0;
    const maxAttempts = 40;
    let done = false;

    const highlight = (el) => {
      el.style.transition = "all 0.3s ease";
      el.style.transform = "scale(1.02)";
      el.style.boxShadow = "0 8px 25px rgba(59,130,246,0.3)";
      el.style.borderColor = "#3B82F6";
      setTimeout(() => {
        el.style.transform = "";
        el.style.boxShadow = "";
        el.style.borderColor = "";
      }, 1000);
    };

    const tryScroll = () => {
      if (done) return;
      const sel = `[data-member-id="${CSS.escape(String(lastId))}"]`;
      const el = document.querySelector(sel);
      if (el) {
        el.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
        highlight(el);
        sessionStorage.removeItem("membersLastId");
        done = true;
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) {
        requestAnimationFrame(tryScroll);
      } else {
        sessionStorage.removeItem("membersLastId");
      }
    };

    requestAnimationFrame(tryScroll);
  }, [loading, filteredMembers]);

  // Fetch members on mount (without photos)
  useEffect(() => {
    fetchMembers();
  }, []);

  // Apply search + filters whenever members, search, sort or filter change
  useEffect(() => {
    const compiledClauses = parseSearch(search);

    // Base: apply search
    let result = members.filter((m) => matchesSearch(m, compiledClauses));

    if (activeFilter === "Homme") {
      result = result.filter((m) => m.gender === "Homme" && !isMemberExpired(m));
    } else if (activeFilter === "Femme") {
      result = result.filter((m) => m.gender === "Femme" && !isMemberExpired(m));
    } else if (activeFilter === "Etudiant") {
      result = result.filter((m) => m.etudiant && !isMemberExpired(m));
    } else if (activeFilter === "Expiré") {
      result = result.filter((m) => isMemberExpired(m));
    } else if (activeFilter === "Récent") {
      // 20 most recently assigned badges by badge_number descending
      result = [...members]
        .filter((m) => m.badge_number != null)
        .sort((a, b) => (b.badge_number || 0) - (a.badge_number || 0))
        .slice(0, 20);
    } else if (activeFilter === "SansCertif") {
      result = result.filter((m) => {
        if (isMemberExpired(m)) return false;
        return !memberHasFiles(m);
      });
    } else if (activeFilter === "Actifs" || !activeFilter) {
      // Default: all active (non-expired)
      result = result.filter((m) => !isMemberExpired(m));
    }

    // Sort by name (except "Recent" which keeps badge_number order)
    if (activeFilter !== "Récent") {
      result.sort((a, b) => {
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
    }

    setFilteredMembers(result);
    setCurrentPage(1);
  }, [members, search, sortAsc, activeFilter]);

  // Lazy-load photos for the current page
  useEffect(() => {
    if (loading || paginatedMembers.length === 0) return;
    if (photosLoadingRef.current) return;

    const loadPhotosForCurrentPage = async () => {
      const memberIds = paginatedMembers.map((m) => m.id);
      const missingIds = memberIds.filter((id) => !(id in photosCache));

      if (missingIds.length === 0) return;

      try {
        photosLoadingRef.current = true;
        setLoadingPhotos(true);

        const newPhotos = (await supabaseServices.getMemberPhotos(missingIds)) || {};

        const nextCache = { ...photosCache, ...newPhotos };
        for (const id of missingIds) {
          if (!(id in newPhotos)) nextCache[id] = null;
        }

        // Only update state if the cache actually changed
        let changed = false;
        const keys = new Set([...Object.keys(photosCache), ...Object.keys(nextCache)]);
        for (const k of keys) {
          if (photosCache[k] !== nextCache[k]) {
            changed = true;
            break;
          }
        }
        if (changed) setPhotosCache(nextCache);
      } catch (err) {
        console.error("Error loading photos:", err);
      } finally {
        setLoadingPhotos(false);
        photosLoadingRef.current = false;
      }
    };

    loadPhotosForCurrentPage();
  }, [currentPage, paginatedMembers, loading, photosCache]);

  // ---------------------------------------------------------------------------
  // 5.5 -- Handlers
  // ---------------------------------------------------------------------------

  /** Scroll to a member row/card and briefly highlight it. */
  const scrollToMember = (memberId) => {
    const memberElement =
      memberRefs.current[memberId] ||
      document.querySelector(`[data-member-id="${CSS.escape(String(memberId))}"]`);
    if (memberElement) {
      memberElement.scrollIntoView({ behavior: "smooth", block: "center" });
      memberElement.style.transition = "all 0.3s ease";
      memberElement.style.transform = "scale(1.02)";
      memberElement.style.boxShadow = "0 8px 25px rgba(59, 130, 246, 0.3)";
      memberElement.style.borderColor = "#3B82F6";
      setTimeout(() => {
        memberElement.style.transform = "";
        memberElement.style.boxShadow = "";
        memberElement.style.borderColor = "";
      }, 1000);
    }
  };

  /** Persist current page context to sessionStorage. */
  const saveMembersPageContext = (extra = {}) => {
    const scrollEl = document.scrollingElement || document.documentElement;
    const ctx = {
      search,
      activeFilter,
      sortAsc,
      selectedIds,
      currentPage,
      scrollY: scrollEl ? scrollEl.scrollTop : window.scrollY || 0,
      savedAt: Date.now(),
      ...extra,
    };
    sessionStorage.setItem("membersPageCtx", JSON.stringify(ctx));
  };

  /** Fetch all members from Supabase (without photos). */
  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseServices.getMembersWithoutPhotos();
      setMembers(data || []);
    } catch (err) {
      console.error("Error fetching members:", err);
      setError(`Erreur lors du chargement: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /** Navigate to a given page number. */
  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    saveMembersPageContext({ currentPage: page });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Open the edit view for a member (modal on mobile, route on desktop). */
  const handleEditMember = (member) => {
    if (isMobile) {
      setSelectedMember(member);
      setShowForm(true);
    } else {
      sessionStorage.setItem("membersLastId", String(member.id));
      saveMembersPageContext({ editedMemberId: member.id });
      navigate("/members/edit", {
        state: { member, returnPath: "/members", memberId: member.id },
      });
    }
  };

  /** Open the creation view (modal on mobile, route on desktop). */
  const handleAddMember = () => {
    if (isMobile) {
      setSelectedMember(null);
      setShowForm(true);
    } else {
      sessionStorage.removeItem("membersLastId");
      saveMembersPageContext({ editedMemberId: null });
      navigate("/members/new", { state: { member: null, returnPath: "/members" } });
    }
  };

  /** Import badge mappings from an Excel file. */
  const handleImportBadges = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

          const badges = [];
          let skipped = 0;

          for (const row of rows) {
            const appartement = row["Appartement"];
            const badgeRealId = row["Badges ou Télécommandes"];

            if (appartement && badgeRealId) {
              const match = String(appartement).match(/adhérent(\d+)/i);
              if (match) {
                const badgeNumber = parseInt(match[1], 10);
                badges.push({
                  badge_number: badgeNumber,
                  badge_real_id: String(badgeRealId).trim(),
                });
              } else {
                skipped++;
              }
            } else {
              skipped++;
            }
          }

          if (badges.length === 0) {
            alert(
              "Aucun badge trouve dans le fichier.\n\n" +
              "Verifiez que le fichier contient les colonnes:\n" +
              "- Appartement (adherent001, adherent002, ...)\n" +
              "- Badges ou Telecommandes"
            );
            return;
          }

          // Upsert in batches of 100
          const BATCH_SIZE = 100;
          for (let i = 0; i < badges.length; i += BATCH_SIZE) {
            const batch = badges.slice(i, i + BATCH_SIZE);
            const { error } = await supabase
              .from("badge_mapping")
              .upsert(batch, {
                onConflict: "badge_number",
                ignoreDuplicates: false,
              });
            if (error) throw error;
          }

          alert(
            `Import termine avec succes !\n\n` +
            `Total badges: ${badges.length}\n` +
            `Lignes ignorees: ${skipped}\n\n` +
            `Les badges sont maintenant disponibles dans les formulaires.`
          );
        } catch (err) {
          console.error("Error processing badge file:", err);
          alert(`Erreur lors du traitement du fichier:\n${err.message}`);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Error reading badge file:", err);
      alert(`Erreur lors de la lecture du fichier:\n${err.message}`);
    }

    // Reset input so the same file can be re-imported
    event.target.value = "";
  };

  /** Export the current filtered member list as a styled Excel file. */
  const handleExportMembers = async () => {
    try {
      const today = new Date();
      const dateStr = today.toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const fileDate = today.toISOString().split("T")[0];

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "BodyForce";
      workbook.created = today;

      const worksheet = workbook.addWorksheet("Membres BodyForce", {
        pageSetup: {
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
        },
        headerFooter: {
          oddHeader: "&C&B&14BODYFORCE - Liste des Membres",
          oddFooter: "&L&D &T&C&P / &N&R&F",
        },
      });

      // Embed logo
      let logoId = null;
      try {
        const logoResponse = await fetch("/images/logo.png");
        const logoBlob = await logoResponse.blob();
        const logoBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(",")[1]);
          reader.readAsDataURL(logoBlob);
        });
        logoId = workbook.addImage({ base64: logoBase64, extension: "png" });
      } catch (logoErr) {
        console.warn("Logo not loaded:", logoErr);
      }

      if (logoId !== null) {
        worksheet.addImage(logoId, {
          tl: { col: 0, row: 0 },
          ext: { width: 80, height: 80 },
        });
      }

      const startRow = logoId !== null ? 2 : 1;

      // Title row
      worksheet.mergeCells(startRow, 1, startRow, 8);
      const titleCell = worksheet.getCell(startRow, 1);
      titleCell.value = "LISTE DES MEMBRES BODYFORCE";
      titleCell.font = { bold: true, size: 18, color: { argb: "FF1E3A8A" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(startRow).height = 30;

      // Date row
      worksheet.mergeCells(startRow + 1, 1, startRow + 1, 8);
      const dateCell = worksheet.getCell(startRow + 1, 1);
      dateCell.value = `Export du ${dateStr}`;
      dateCell.font = { italic: true, size: 11, color: { argb: "FF666666" } };
      dateCell.alignment = { horizontal: "center" };

      // Count row
      worksheet.mergeCells(startRow + 2, 1, startRow + 2, 8);
      const countCell = worksheet.getCell(startRow + 2, 1);
      countCell.value = `${filteredMembers.length} membres`;
      countCell.font = { bold: true, size: 12 };
      countCell.alignment = { horizontal: "center" };

      const headerRowNum = startRow + 4;

      // Column headers
      const headers = ["Nom", "Prénom", "Badge N°", "Badge ID", "Tél. mobile", "Tél. fixe", "Email", "Adresse"];
      const headerRow = worksheet.getRow(headerRowNum);
      headers.forEach((header, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = header;
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FF1E40AF" } },
          bottom: { style: "thin", color: { argb: "FF1E40AF" } },
          left: { style: "thin", color: { argb: "FF1E40AF" } },
          right: { style: "thin", color: { argb: "FF1E40AF" } },
        };
      });
      headerRow.height = 25;

      // Data rows
      filteredMembers.forEach((member, rowIdx) => {
        const rowNum = headerRowNum + 1 + rowIdx;
        const row = worksheet.getRow(rowNum);
        const isEven = rowIdx % 2 === 0;

        const values = [
          member.name || "",
          member.firstName || "",
          member.badge_number || "",
          member.badgeId || "",
          member.mobile || "",
          member.phone || "",
          member.email || "",
          member.address || "",
        ];

        values.forEach((value, colIdx) => {
          const cell = row.getCell(colIdx + 1);
          cell.value = value;
          cell.font = { size: 10 };
          cell.alignment = { vertical: "middle", wrapText: colIdx === 7 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFE5E7EB" } },
            right: { style: "thin", color: { argb: "FFE5E7EB" } },
          };
          if (isEven) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
          }
        });
        row.height = 20;
      });

      // Column widths
      worksheet.columns = [
        { width: 18 },
        { width: 15 },
        { width: 10 },
        { width: 14 },
        { width: 15 },
        { width: 15 },
        { width: 30 },
        { width: 40 },
      ];

      // Auto-filter & frozen header
      const lastDataRow = headerRowNum + filteredMembers.length;
      worksheet.autoFilter = {
        from: { row: headerRowNum, column: 1 },
        to: { row: lastDataRow, column: 8 },
      };
      worksheet.views = [{ state: "frozen", ySplit: headerRowNum }];

      // Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `BodyForce_Membres_${fileDate}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting members:", err);
      alert(`Erreur lors de l'export: ${err.message}`);
    }
  };

  /** Close the mobile member form modal. */
  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedMember(null);
  };

  /** Delete a single member after confirmation. */
  const handleDelete = async (id) => {
    if (window.confirm("Supprimer ce membre ? Cette action est irréversible.")) {
      try {
        await supabaseServices.deleteMember(id);
        await fetchMembers();
      } catch (err) {
        console.error("Error deleting member:", err);
        alert(`Erreur lors de la suppression: ${err.message}`);
      }
    }
  };

  /** Delete all selected members after confirmation. */
  const handleBulkDelete = async () => {
    if (
      window.confirm(
        `Supprimer les ${selectedIds.length} membres sélectionnés ? Cette action est irréversible.`
      )
    ) {
      try {
        for (const id of selectedIds) {
          await supabaseServices.deleteMember(id);
        }
        setSelectedIds([]);
        await fetchMembers();
      } catch (err) {
        console.error("Error bulk-deleting members:", err);
        alert(`Erreur lors de la suppression: ${err.message}`);
      }
    }
  };

  /** Quick-renew a member's subscription for the current calendar year. */
  const handleQuickRenew = async (member) => {
    const currentYear = new Date().getFullYear();
    const confirmMsg =
      `Réabonner ${member.firstName} ${member.name} pour l'année ${currentYear} ?\n\n` +
      `Abonnement : Année civile\nDu 01/01/${currentYear} au 31/12/${currentYear}`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const updatedData = {
        subscriptionType: "Année civile",
        startDate: `${currentYear}-01-01`,
        endDate: getSubscriptionEndDate(currentYear),
        last_subscription_date: new Date().toISOString(),
      };

      await supabaseServices.updateMember(member.id, updatedData);
      await fetchMembers();

      alert(`${member.firstName} ${member.name} réabonné(e) avec succès !`);
    } catch (err) {
      console.error("Error renewing subscription:", err);
      alert(`Erreur lors du réabonnement: ${err.message}`);
    }
  };

  /** Toggle select-all for the current page. */
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedMembers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedMembers.map((m) => m.id));
    }
  };

  /** Toggle selection for a single member. */
  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // ===========================================================================
  // SECTION 6 -- Render
  // ===========================================================================

  // 6.0 -- Loading state
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            Chargement des membres optimisé...
          </p>
        </div>
      </div>
    );
  }

  // 6.0 -- Error state
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <div className="text-center p-8 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
        <div className="text-red-600 dark:text-red-400 mb-4">Erreur</div>
        <p className="text-gray-700 dark:text-gray-300 mb-4">{error}</p>
        <button
          onClick={fetchMembers}
          className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <FaSync />
          Réessayer
        </button>
      </div>
    );
  }

  // 6.1 -- Main layout
  // ---------------------------------------------------------------------------
  return (
    <div className="px-2 sm:px-4 members-container">

      {/* 6.1 -- Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
            Liste des membres
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {members.length} membres
          </p>
        </div>
        <button
          onClick={fetchMembers}
          disabled={loading}
          className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg transition-colors inline-flex items-center gap-2 disabled:opacity-50"
          title="Actualiser la liste"
        >
          <FaSync className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {/* 6.2 -- Filter widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-6">
        <Widget
          title="Total"
          value={total}
          onClick={() => setActiveFilter("Actifs")}
          active={activeFilter === "Actifs" || !activeFilter}
        />
        <Widget title="Hommes" value={maleCount} onClick={() => setActiveFilter("Homme")} active={activeFilter === "Homme"} />
        <Widget title="Femmes" value={femaleCount} onClick={() => setActiveFilter("Femme")} active={activeFilter === "Femme"} />
        <Widget title="Étudiants" value={studentCount} onClick={() => setActiveFilter("Etudiant")} active={activeFilter === "Etudiant"} />
        <Widget title="Expirés" value={expiredCount} onClick={() => setActiveFilter("Expiré")} active={activeFilter === "Expiré"} />
        <Widget title="Badges récents" value={recentCount} onClick={() => setActiveFilter("Récent")} active={activeFilter === "Récent"} />
        <Widget title="Sans certif" value={noCertCount} onClick={() => setActiveFilter("SansCertif")} active={activeFilter === "SansCertif"} />
      </div>

      {/* 6.3 -- Action bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 p-4 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Add member — primary action */}
          <button
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl inline-flex items-center justify-center gap-2 transition-colors font-medium"
            onClick={handleAddMember}
          >
            <FaPlus />
            Ajouter un membre
          </button>

          {/* Separator */}
          <div className="hidden sm:block w-px h-8 bg-gray-200 dark:bg-gray-600 mx-1" />

          {/* Import badges — secondary/ghost */}
          <button
            className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 px-3 py-2.5 rounded-xl inline-flex items-center justify-center gap-2 transition-colors text-sm"
            onClick={() => document.getElementById("badge-import-input").click()}
            title="Importer badges (.xlsx)"
          >
            <FaFileImport />
            <span className="hidden md:inline">Importer</span>
          </button>
          <input
            id="badge-import-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImportBadges}
            style={{ display: "none" }}
          />

          {/* Export Excel — secondary/ghost */}
          <button
            className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 px-3 py-2.5 rounded-xl inline-flex items-center justify-center gap-2 transition-colors text-sm"
            onClick={handleExportMembers}
            title={`Exporter ${filteredMembers.length} membres vers Excel`}
          >
            <FaFileExport />
            <span className="hidden md:inline">Exporter</span>
          </button>

          {/* Bulk delete */}
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white px-4 py-2.5 rounded-xl inline-flex items-center justify-center gap-2 transition-colors text-sm font-medium"
            >
              <FaTrash />
              Supprimer ({selectedIds.length})
            </button>
          )}
        </div>

        {/* Search input */}
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher nom, prénom..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 pl-10 pr-4 py-2.5 rounded-full w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <SearchHints search={search} />
        </div>
      </div>

      {/* 6.4 -- Pagination (top) */}
      {totalPages > 1 && (
        <div className="mb-4 flex items-center justify-between bg-white dark:bg-gray-800 rounded-3xl p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400 pl-2">
            Page {currentPage} sur {totalPages} — {startIndex + 1}-{Math.min(endIndex, filteredMembers.length)} sur {filteredMembers.length}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300"
            >
              <FaChevronLeft className="w-3 h-3" />
              <span className="hidden sm:inline">Précédent</span>
            </button>

            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                .map((page, idx, arr) => (
                  <React.Fragment key={page}>
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <span className="px-1.5 text-gray-400 dark:text-gray-600 text-sm">...</span>
                    )}
                    <button
                      onClick={() => goToPage(page)}
                      className={`min-w-[36px] px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        page === currentPage
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                ))}
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300"
            >
              <span className="hidden sm:inline">Suivant</span>
              <FaChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 6.5 -- Member list */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          {search || activeFilter
            ? "Aucun membre ne correspond aux critères de recherche"
            : "Aucun membre trouvé dans la base de données"}
        </div>
      ) : (
        <>
          {/* 6.5.1 -- Desktop table view */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="p-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === paginatedMembers.length && paginatedMembers.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                    </th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Photo</th>
                    <th className="p-3 text-left">
                      <button
                        onClick={() => setSortAsc(!sortAsc)}
                        className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      >
                        Nom{" "}
                        <span className="text-gray-500 dark:text-gray-400">{sortAsc ? "\u25B2" : "\u25BC"}</span>
                      </button>
                    </th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Infos</th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Abonnement</th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Badge</th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Status</th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {paginatedMembers.map((member) => {
                    const isExpired = member.endDate
                      ? (() => {
                          try {
                            return isBefore(parseISO(member.endDate), new Date());
                          } catch {
                            return true;
                          }
                        })()
                      : true;

                    const hasFiles = memberHasFiles(member);

                    return (
                      <tr
                        key={member.id}
                        data-member-id={member.id}
                        ref={(el) => {
                          if (el) memberRefs.current[member.id] = el;
                        }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-[1.01] hover:shadow-xl hover:border-blue-300 transition-all duration-400 transform-gpu member-row"
                      >
                        {/* Checkbox */}
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(member.id)}
                            onChange={() => toggleSelect(member.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                        </td>

                        {/* Avatar */}
                        <td className="p-3">
                          <Avatar
                            photo={photosCache[member.id] || null}
                            firstName={member.firstName}
                            name={member.name}
                            size={48}
                            onClick={() => handleEditMember(member)}
                            title="Cliquer pour modifier"
                          />
                        </td>

                        {/* Name */}
                        <td className="p-3">
                          <div
                            className="font-medium text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-all duration-200 flex items-center gap-2 group"
                            onClick={() => handleEditMember(member)}
                            title="Cliquer pour modifier"
                          >
                            <span>
                              {member.name} {member.firstName}
                            </span>
                            <FaExternalLinkAlt className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity duration-200" />
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">ID: {member.id}</div>
                        </td>

                        {/* Info (gender, student, email, phone) */}
                        <td className="p-3">
                          <div className="text-sm space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  member.gender === "Femme"
                                    ? "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300"
                                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                }`}
                              >
                                {member.gender}
                              </span>
                              {member.etudiant && (
                                <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full text-xs font-medium">
                                  Étudiant
                                </span>
                              )}
                            </div>
                            {member.email && (
                              <div
                                className="text-gray-600 dark:text-gray-400 text-xs truncate max-w-[200px]"
                                title={member.email}
                              >
                                {member.email}
                              </div>
                            )}
                            {member.mobile && (
                              <div className="text-gray-600 dark:text-gray-400 text-xs">{member.mobile}</div>
                            )}
                          </div>
                        </td>

                        {/* Subscription */}
                        <td className="p-3">
                          <div className="space-y-1">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getBadgeColor(
                                member.subscriptionType
                              )}`}
                            >
                              {member.subscriptionType || "Non défini"}
                            </span>
                            {member.startDate && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Début: {member.startDate}
                              </div>
                            )}
                            {member.endDate && (
                              <div
                                className={`text-xs ${
                                  isExpired
                                    ? "text-red-600 dark:text-red-400 font-medium"
                                    : "text-gray-500 dark:text-gray-400"
                                }`}
                              >
                                Fin: {member.endDate}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Badge */}
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 px-2 py-1 rounded text-sm font-mono">
                              {member.badgeId || "\u2014"}
                            </span>
                            {member.badge_number && (
                              <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs font-mono">
                                {member.badge_number}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            {isExpired ? (
                              <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-2 py-1 rounded-full text-xs font-medium">
                                Expiré
                              </span>
                            ) : (
                              <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded-full text-xs font-medium">
                                Actif
                              </span>
                            )}
                            {hasFiles ? (
                              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full text-xs font-medium">
                                Docs OK
                              </span>
                            ) : (
                              <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 px-2 py-1 rounded-full text-xs font-medium">
                                Manquant
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {isExpired && (
                              <button
                                onClick={() => handleQuickRenew(member)}
                                className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors p-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                                title="Réabonner pour l'année en cours"
                              >
                                <FaSync className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleEditMember(member)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                              title="Modifier"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => handleDelete(member.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                              title="Supprimer"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6.5.2 -- Mobile card view */}
          <div className="lg:hidden space-y-4">
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.length === paginatedMembers.length && paginatedMembers.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Sélectionner la page</span>
              </label>
              <button onClick={() => setSortAsc(!sortAsc)}>
                <span className="text-gray-700 dark:text-gray-300">Nom</span>{" "}
                <span className="text-gray-500 dark:text-gray-400">{sortAsc ? "\u25B2" : "\u25BC"}</span>
              </button>
            </div>

            {paginatedMembers.map((member) => {
              const isExpired = member.endDate
                ? (() => {
                    try {
                      return isBefore(parseISO(member.endDate), new Date());
                    } catch {
                      return true;
                    }
                  })()
                : true;

              const hasFiles = memberHasFiles(member);

              return (
                <div
                  key={member.id}
                  data-member-id={member.id}
                  ref={(el) => {
                    if (el) memberRefs.current[member.id] = el;
                  }}
                  className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow duration-150 transform-gpu member-card"
                >
                  {/* Card header: checkbox, avatar, name */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(member.id)}
                        onChange={() => toggleSelect(member.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mt-1"
                      />
                      <Avatar
                        photo={photosCache[member.id] || null}
                        firstName={member.firstName}
                        name={member.name}
                        size={48}
                        onClick={() => handleEditMember(member)}
                        title="Cliquer pour modifier"
                      />
                      <div className="flex-1">
                        <div
                          className="font-semibold text-gray-900 dark:text-white text-lg cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-all duration-200"
                          onClick={() => handleEditMember(member)}
                          title="Cliquer pour modifier"
                        >
                          {member.name} {member.firstName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">ID: {member.id}</div>
                      </div>
                    </div>
                  </div>

                  {/* Card body: badges & contact */}
                  <div className="mb-3">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          member.gender === "Femme"
                            ? "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300"
                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        }`}
                      >
                        {member.gender}
                      </span>
                      {member.etudiant && (
                        <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full text-xs font-medium">
                          Étudiant
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getBadgeColor(
                          member.subscriptionType
                        )}`}
                      >
                        {member.subscriptionType || "Non défini"}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      {member.email && (
                        <div className="flex items-center gap-2">
                          <span className="truncate">{member.email}</span>
                        </div>
                      )}
                      {member.mobile && (
                        <div className="flex items-center gap-2">
                          <span>{member.mobile}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card details: subscription + badge */}
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        ABONNEMENT
                      </div>
                      <div className="space-y-1">
                        {member.startDate && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Début: {member.startDate}
                          </div>
                        )}
                        {member.endDate && (
                          <div
                            className={`text-xs ${
                              isExpired
                                ? "text-red-600 dark:text-red-400 font-medium"
                                : "text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            Fin: {member.endDate}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        BADGE
                      </div>
                      <div className="flex flex-col gap-1 mb-3">
                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 px-2 py-1 rounded text-sm font-mono">
                          {member.badgeId || "\u2014"}
                        </span>
                        {member.badge_number && (
                          <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs font-mono">
                            {member.badge_number}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card status badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {isExpired ? (
                      <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-2 py-1 rounded-full text-xs font-medium">
                        Expiré
                      </span>
                    ) : (
                      <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded-full text-xs font-medium">
                        Actif
                      </span>
                    )}
                    {hasFiles ? (
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full text-xs font-medium">
                        Docs OK
                      </span>
                    ) : (
                      <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 px-2 py-1 rounded-full text-xs font-medium">
                        Manquant
                      </span>
                    )}
                  </div>

                  {/* Card actions */}
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2">
                    {isExpired && (
                      <button
                        onClick={() => handleQuickRenew(member)}
                        className="w-full bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white px-3 py-2.5 rounded-lg inline-flex items-center justify-center gap-2 transition-colors font-medium"
                        title="Réabonner pour l'année en cours"
                      >
                        <FaSync className="w-4 h-4" />
                        Réabonner pour {new Date().getFullYear()}
                      </button>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditMember(member)}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-3 py-2 rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
                      >
                        <FaEdit />
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="flex-1 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white px-3 py-2 rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
                      >
                        <FaTrash />
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 6.6 -- Pagination (bottom) */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between bg-white dark:bg-gray-800 rounded-3xl p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400 pl-2">
            Page {currentPage} sur {totalPages} — {startIndex + 1}-{Math.min(endIndex, filteredMembers.length)} sur {filteredMembers.length}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300"
            >
              <FaChevronLeft className="w-3 h-3" />
              <span className="hidden sm:inline">Précédent</span>
            </button>

            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                .map((page, idx, arr) => (
                  <React.Fragment key={page}>
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <span className="px-1.5 text-gray-400 dark:text-gray-600 text-sm">...</span>
                    )}
                    <button
                      onClick={() => goToPage(page)}
                      className={`min-w-[36px] px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        page === currentPage
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                ))}
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300"
            >
              <span className="hidden sm:inline">Suivant</span>
              <FaChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 6.7 -- Summary footer */}
      {filteredMembers.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-3xl text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center justify-between">
            <div>
              Affichage de {startIndex + 1}-{Math.min(endIndex, filteredMembers.length)} sur {filteredMembers.length} membre
              {filteredMembers.length !== 1 ? "s" : ""} filtrés — {members.length} total
            </div>
            {loadingPhotos && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                Chargement photos...
              </div>
            )}
          </div>
          {selectedIds.length > 0 && (
            <div className="mt-2 text-blue-600 dark:text-blue-400 font-medium">
              {selectedIds.length} sélectionné{selectedIds.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* 6.8 -- Mobile member form modal */}
      {showForm && isMobile && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-start justify-center overflow-auto">
          <div className="bg-white dark:bg-gray-800 mt-4 mb-4 rounded-xl shadow-xl w-full max-w-4xl mx-4">
            <MemberForm
              member={selectedMember}
              onSave={async (memberData, closeModal) => {
                try {
                  let memberId;
                  if (selectedMember?.id) {
                    await supabaseServices.updateMember(selectedMember.id, memberData);
                    memberId = selectedMember.id;
                  } else {
                    const newMember = await supabaseServices.createMember(memberData);
                    memberId = newMember.id;
                  }

                  if (closeModal) {
                    setShowForm(false);
                    setSelectedMember(null);
                  }

                  await fetchMembers();

                  if (memberId) {
                    setTimeout(() => scrollToMember(memberId), 200);
                  }
                } catch (saveError) {
                  console.error("Error saving member:", saveError);
                  alert(`Erreur lors de la sauvegarde: ${saveError.message}`);
                }
              }}
              onCancel={handleCloseForm}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SECTION 7 -- Export
// =============================================================================

export default MembersPage;
