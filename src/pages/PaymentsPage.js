/**
 * PaymentsPage.js
 *
 * Payments tracking dashboard for Club Body Force.
 * Displays per-member payment status, statistics, progress bars,
 * and provides CSV/PDF export capabilities.
 *
 * Optimized for low egress: members are loaded without photos,
 * photos are lazy-loaded per page, and results are paginated (20/page).
 */

// =============================================================================
// SECTION 1 -- Imports
// =============================================================================

import React, { useState, useEffect, useMemo, useRef } from "react";
import jsPDF from "jspdf";
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Calendar,
  Search,
  Filter,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  Edit,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import Avatar from "../components/Avatar";
import { supabase, supabaseServices } from "../supabaseClient";
import MemberForm from "../components/MemberForm";

// =============================================================================
// SECTION 2 -- Search utilities (stateless helpers)
// =============================================================================

/**
 * Normalize a string for accent-insensitive comparison.
 * Strips diacritics and lowercases the result.
 */
const normalize = (s = "") =>
  s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Escape special regex characters so they are treated as literals. */
const escapeForWildcard = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

/**
 * Convert a single search token (possibly with wildcards * / ? and
 * anchors ^ / $) into a RegExp.
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
 * Parse a raw search string into an array of OR-clauses,
 * where each clause is an array of AND-token regexes.
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
 * Test whether a member matches the compiled search clauses.
 * Returns true if any OR-clause is fully satisfied (all AND-tokens match).
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
 * Analyze raw search text and return metadata used by the SearchHints component.
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
    p
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
  );
  return {
    active: true,
    clauses,
    hasWildcards: /[*?]/.test(text),
    hasAnchors: /(\^|\$)/.test(text),
  };
};

// =============================================================================
// SECTION 3 -- Payment helper functions (stateless)
// =============================================================================

/** Check whether a payment is overdue (unpaid and past its expected date). */
function isOverdue(payment) {
  if (payment.is_paid) return false;
  if (!payment.encaissement_prevu) return false;
  return new Date(payment.encaissement_prevu) < new Date();
}

/** Derive the display status of a single payment record. */
function getPaymentStatus(payment) {
  if (payment.is_paid) return "paid";
  if (isOverdue(payment)) return "overdue";
  return "pending";
}

/** Return the emoji icon for a given payment method. */
const getPaymentMethodIcon = (method) => {
  switch (method) {
    case "carte":
      return "\uD83D\uDCB3";
    case "cheque":
    case "ch\u00E8que":
      return "\uD83D\uDCDD";
    case "especes":
    case "esp\u00E8ces":
      return "\uD83D\uDCB5";
    case "autre":
      return "\uD83D\uDD04";
    default:
      return "\u2753";
  }
};

/** Return the human-readable label for a payment status. */
const getStatusLabel = (status) => {
  switch (status) {
    case "paid":
      return "Pay\u00E9";
    case "pending":
      return "En attente";
    case "overdue":
      return "En retard";
    case "no_payments":
      return "Aucun paiement";
    default:
      return "Inconnu";
  }
};

/** Format a date string to French locale (date only). */
const formatDate = (dateString) => {
  if (!dateString) return "Non d\u00E9finie";
  try {
    return new Date(dateString).toLocaleDateString("fr-FR");
  } catch {
    return "Date invalide";
  }
};

/** Format a date string to French locale (date + time). */
const formatDateTime = (dateString) => {
  if (!dateString) return "Non d\u00E9finie";
  try {
    return new Date(dateString).toLocaleString("fr-FR");
  } catch {
    return "Date invalide";
  }
};

// =============================================================================
// SECTION 4 -- SearchHints component
// =============================================================================

/**
 * Displays visual badges describing the active search query
 * (wildcards, anchors, OR / AND groups) with usage examples.
 */
function SearchHints({ search }) {
  const info = analyzeSearch(search);
  if (!info.active) return null;

  return (
    <div className="w-full sm:w-auto sm:max-w-[36rem] text-xs mt-1 space-y-1">
      {/* Active badge indicators */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
          Recherche avanc\u00E9e
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

      {/* Token groups visualization */}
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
            title="Groupes reli\u00E9s par OR"
          >
            (Groupes reli\u00E9s par OR)
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
        <code className="font-mono">^mar*</code> (ancr\u00E9 d\u00E9but),{" "}
        <code className="font-mono">*tin$</code> (ancr\u00E9 fin).
      </div>
    </div>
  );
}

// =============================================================================
// SECTION 5 -- Constants
// =============================================================================

const ITEMS_PER_PAGE = 20;

// =============================================================================
// SECTION 6 -- PaymentsPage component
// =============================================================================

/**
 * Main payments page component.
 * Loads members (without photos) and their payments from Supabase,
 * enriches each member with aggregated payment data, and renders
 * a responsive dashboard with stats, filters, pagination, and export.
 */
function PaymentsPage() {
  // ---------------------------------------------------------------------------
  // 6.1 -- Responsive & dark mode detection
  // ---------------------------------------------------------------------------

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkIfMobile = () => setIsMobile(window.innerWidth < 1024);
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // ---------------------------------------------------------------------------
  // 6.2 -- Data state
  // ---------------------------------------------------------------------------

  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState("");

  // ---------------------------------------------------------------------------
  // 6.3 -- Filters & search state
  // ---------------------------------------------------------------------------

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // ---------------------------------------------------------------------------
  // 6.4 -- UI interaction state
  // ---------------------------------------------------------------------------

  const [expandedMember, setExpandedMember] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // ---------------------------------------------------------------------------
  // 6.5 -- Pagination & lazy photo cache
  // ---------------------------------------------------------------------------

  const [currentPage, setCurrentPage] = useState(1);
  const [photosCache, setPhotosCache] = useState({});
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const photosLoadingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // 6.6 -- Data loading
  // ---------------------------------------------------------------------------

  /**
   * Fetch members (without photos) and payments from Supabase.
   * @param {boolean} showRetryIndicator - Show the retry spinner in the UI.
   */
  const loadData = async (showRetryIndicator = false) => {
    try {
      if (showRetryIndicator) setIsRetrying(true);
      setLoading(true);
      setError("");

      // Members without photos (egress-friendly)
      const membersData = await supabaseServices.getMembersWithoutPhotos();

      // Payments with joined member data (no photo)
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select(
          `
            *,
            members (id, badgeId, name, firstName, email, phone, mobile)
          `
        )
        .order("date_paiement", { ascending: false });

      if (paymentsError) throw new Error(`Erreur paiements: ${paymentsError.message}`);

      setMembers(membersData || []);
      setPayments(paymentsData || []);
      setRetryCount(0);
    } catch (e) {
      setError(e.message || "Erreur de connexion \u00E0 la base de donn\u00E9es");
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /** Increment the retry counter and reload data with a visual indicator. */
  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    loadData(true);
  };

  // ---------------------------------------------------------------------------
  // 6.7 -- Computed statistics
  // ---------------------------------------------------------------------------

  const stats = {
    totalMembers: members.length,
    totalExpected: payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    totalReceived: payments
      .filter((p) => p.is_paid)
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    totalPending: payments
      .filter((p) => !p.is_paid && !isOverdue(p))
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    totalOverdue: payments
      .filter((p) => !p.is_paid && isOverdue(p))
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    paidCount: payments.filter((p) => p.is_paid).length,
    pendingCount: payments.filter((p) => !p.is_paid && !isOverdue(p)).length,
    overdueCount: payments.filter((p) => !p.is_paid && isOverdue(p)).length,
  };
  stats.collectionRate =
    stats.totalExpected > 0 ? (stats.totalReceived / stats.totalExpected) * 100 : 0;

  // ---------------------------------------------------------------------------
  // 6.8 -- Enriched members (with aggregated payment data)
  // ---------------------------------------------------------------------------

  const enrichedMembers = useMemo(() => {
    return members.map((member) => {
      const memberPayments = payments.filter((p) => p.member_id === member.id);
      const totalDue = memberPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const totalPaid = memberPayments
        .filter((p) => p.is_paid)
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const progressPercentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;
      const hasOverdue = memberPayments.some((p) => !p.is_paid && isOverdue(p));
      const hasPending = memberPayments.some((p) => !p.is_paid && !isOverdue(p));

      let overallStatus = "no_payments";
      if (memberPayments.length > 0) {
        if (hasOverdue) overallStatus = "overdue";
        else if (hasPending) overallStatus = "pending";
        else overallStatus = "paid";
      }

      const lastPaymentDate = memberPayments
        .filter((p) => p.is_paid)
        .sort((a, b) => new Date(b.date_paiement) - new Date(a.date_paiement))[0]
        ?.date_paiement;

      return {
        ...member,
        payments: memberPayments,
        totalDue,
        totalPaid,
        progressPercentage,
        overallStatus,
        lastPaymentDate,
      };
    });
  }, [members, payments]);

  // ---------------------------------------------------------------------------
  // 6.9 -- Filtering & advanced search
  // ---------------------------------------------------------------------------

  const filteredMembers = useMemo(() => {
    const compiledClauses = parseSearch(searchTerm);
    return enrichedMembers.filter((member) => {
      const matchesSearchQuery = matchesSearch(member, compiledClauses);
      const matchesStatus = statusFilter === "all" || member.overallStatus === statusFilter;
      return matchesSearchQuery && matchesStatus;
    });
  }, [enrichedMembers, searchTerm, statusFilter]);

  // ---------------------------------------------------------------------------
  // 6.10 -- Pagination
  // ---------------------------------------------------------------------------

  const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  const paginatedMembers = useMemo(() => {
    return filteredMembers.slice(startIndex, endIndex);
  }, [filteredMembers, startIndex, endIndex]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // ---------------------------------------------------------------------------
  // 6.11 -- Lazy-load photos for the current page
  // ---------------------------------------------------------------------------

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

        // Mark members with no photo as null so we don't re-fetch
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
        console.error("Erreur chargement photos:", err);
      } finally {
        setLoadingPhotos(false);
        photosLoadingRef.current = false;
      }
    };

    loadPhotosForCurrentPage();
  }, [currentPage, paginatedMembers, loading, photosCache]);

  // ---------------------------------------------------------------------------
  // 6.12 -- Pagination navigation
  // ---------------------------------------------------------------------------

  /** Navigate to a specific page number (with bounds checking). */
  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---------------------------------------------------------------------------
  // 6.13 -- Status display helpers (dark-mode aware)
  // ---------------------------------------------------------------------------

  /** Return Tailwind classes for a given payment status, respecting dark mode. */
  const getStatusColor = (status) => {
    const baseClasses = isDarkMode
      ? {
          paid: "text-green-400 bg-green-900/30",
          pending: "text-yellow-400 bg-yellow-900/30",
          overdue: "text-red-400 bg-red-900/30",
          no_payments: "text-gray-400 bg-gray-800/30",
        }
      : {
          paid: "text-green-600 bg-green-100",
          pending: "text-yellow-600 bg-yellow-100",
          overdue: "text-red-600 bg-red-100",
          no_payments: "text-gray-600 bg-gray-100",
        };
    return baseClasses[status] || baseClasses.no_payments;
  };

  /** Return the Lucide icon component for a given payment status. */
  const getStatusIcon = (status) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="w-4 h-4" />;
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "overdue":
        return <AlertCircle className="w-4 h-4" />;
      case "no_payments":
        return <CreditCard className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  // ---------------------------------------------------------------------------
  // 6.14 -- PDF export
  // ---------------------------------------------------------------------------

  /** Generate and download a landscape PDF report of the filtered members. */
  const exportToPDF = () => {
    try {
      const doc = new jsPDF("landscape", "mm", "a4");
      const primaryColor = [59, 130, 246];
      const textColor = [0, 0, 0];
      const whiteColor = [255, 255, 255];

      // Header banner
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 297, 25, "F");
      doc.setTextColor(...whiteColor);
      doc.setFontSize(18);
      doc.text("CLUB BODY FORCE - RAPPORT PAIEMENTS", 148, 15, { align: "center" });

      const dateStr = new Date().toLocaleDateString("fr-FR");
      doc.setFontSize(10);
      doc.text(`Genere le ${dateStr}`, 148, 22, { align: "center" });

      doc.setTextColor(...textColor);
      let yPos = 35;

      // Global statistics block
      doc.setFontSize(14);
      doc.text("STATISTIQUES GLOBALES", 20, yPos);
      yPos += 10;
      doc.setDrawColor(200, 200, 200);
      doc.rect(15, yPos - 2, 267, 35);
      doc.setFontSize(10);
      doc.text(`Total Attendu: ${stats.totalExpected.toLocaleString("fr-FR")} \u20AC`, 20, yPos + 5);
      doc.text(
        `Total Recu: ${stats.totalReceived.toLocaleString("fr-FR")} \u20AC (${stats.collectionRate.toFixed(1)}%)`,
        150,
        yPos + 5
      );
      doc.text(
        `En Attente: ${stats.totalPending.toLocaleString("fr-FR")} \u20AC (${stats.pendingCount} paiements)`,
        20,
        yPos + 15
      );
      doc.text(
        `En Retard: ${stats.totalOverdue.toLocaleString("fr-FR")} \u20AC (${stats.overdueCount} paiements)`,
        150,
        yPos + 15
      );
      doc.text(`Nombre de membres: ${stats.totalMembers}`, 20, yPos + 25);
      doc.text(`Paiements effectues: ${stats.paidCount}`, 150, yPos + 25);
      yPos += 45;

      // Payment method breakdown
      doc.setFontSize(14);
      doc.text("REPARTITION PAR METHODE DE PAIEMENT", 20, yPos);
      yPos += 10;
      doc.rect(15, yPos - 2, 267, 30);
      doc.setFontSize(10);
      let xPos = 20;

      ["carte", "ch\u00E8que", "esp\u00E8ces", "autre"].forEach((method) => {
        const methodPayments = payments.filter(
          (p) =>
            p.is_paid &&
            (p.method === method ||
              (method === "ch\u00E8que" && p.method === "cheque") ||
              (method === "esp\u00E8ces" && p.method === "especes"))
        );
        const total = methodPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const percentage = stats.totalReceived > 0 ? (total / stats.totalReceived) * 100 : 0;

        doc.text(`${method.toUpperCase()}:`, xPos, yPos + 8);
        doc.text(`${total.toFixed(2)} \u20AC`, xPos, yPos + 15);
        doc.text(`${percentage.toFixed(1)}%`, xPos, yPos + 22);
        xPos += 65;
      });

      yPos += 40;

      // Member detail table
      doc.setFontSize(14);
      doc.text(`DETAIL DES MEMBRES (${filteredMembers.length} affiches)`, 20, yPos);
      yPos += 10;

      doc.setFontSize(9);
      doc.text("NOM PRENOM", 20, yPos);
      doc.text("BADGE", 80, yPos);
      doc.text("STATUT", 110, yPos);
      doc.text("PROGRESSION", 145, yPos);
      doc.text("MONTANTS", 185, yPos);
      doc.text("DERNIER PAIEMENT", 235, yPos);
      yPos += 5;

      doc.setDrawColor(0, 0, 0);
      doc.line(15, yPos, 280, yPos);
      yPos += 8;

      doc.setFontSize(8);

      filteredMembers.forEach((member, index) => {
        // Page break when near the bottom
        if (yPos > 190) {
          doc.addPage();
          yPos = 20;

          doc.setFontSize(9);
          doc.text("NOM PRENOM", 20, yPos);
          doc.text("BADGE", 80, yPos);
          doc.text("STATUT", 110, yPos);
          doc.text("PROGRESSION", 145, yPos);
          doc.text("MONTANTS", 185, yPos);
          doc.text("DERNIER PAIEMENT", 235, yPos);
          yPos += 5;
          doc.line(15, yPos, 280, yPos);
          yPos += 8;
          doc.setFontSize(8);
        }

        const fullName = `${member.firstName || ""} ${member.name || ""}`.trim();
        const truncatedName =
          fullName.length > 25 ? fullName.substring(0, 22) + "..." : fullName;
        doc.text(truncatedName, 20, yPos);
        doc.text(member.badgeId || "N/A", 80, yPos);

        const statusText =
          member.overallStatus === "paid"
            ? "Paye"
            : member.overallStatus === "pending"
            ? "Attente"
            : member.overallStatus === "overdue"
            ? "Retard"
            : "Aucun";
        doc.text(statusText, 110, yPos);
        doc.text(`${member.progressPercentage.toFixed(0)}%`, 145, yPos);
        doc.text(
          `${member.totalPaid.toFixed(0)}\u20AC/${member.totalDue.toFixed(0)}\u20AC`,
          185,
          yPos
        );

        const lastPayment = member.lastPaymentDate
          ? formatDate(member.lastPaymentDate)
          : "Aucun";
        doc.text(lastPayment, 235, yPos);

        yPos += 6;

        // Separator every 5 rows
        if ((index + 1) % 5 === 0) {
          doc.setDrawColor(220, 220, 220);
          doc.line(15, yPos - 1, 280, yPos - 1);
          yPos += 2;
        }
      });

      // Footer on every page
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i}/${pageCount}`, 148, 205, { align: "center" });
        doc.text("Club Body Force - Rapport genere automatiquement", 148, 210, {
          align: "center",
        });
      }

      const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "_");
      doc.save(`Rapport_Paiements_${timestamp}.pdf`);
    } catch (err) {
      console.error("Erreur export PDF:", err);
      alert("Erreur lors de la g\u00E9n\u00E9ration du PDF.");
    }
  };

  // ---------------------------------------------------------------------------
  // 6.15 -- CSV export
  // ---------------------------------------------------------------------------

  /** Generate and download a CSV file of the filtered members. */
  const exportToCSV = () => {
    try {
      const csvData = filteredMembers.map((member) => ({
        Nom: member.name || "",
        "Pr\u00E9nom": member.firstName || "",
        Badge: member.badgeId || "",
        Email: member.email || "",
        "T\u00E9l\u00E9phone": member.phone ?? member.mobile ?? "",
        Statut: getStatusLabel(member.overallStatus),
        "Progression (%)": member.progressPercentage.toFixed(1),
        "Total D\u00FB (\u20AC)": member.totalDue.toFixed(2),
        "Total Pay\u00E9 (\u20AC)": member.totalPaid.toFixed(2),
        "Reste \u00E0 Payer (\u20AC)": (member.totalDue - member.totalPaid).toFixed(2),
        "Nombre de Paiements": member.payments.length,
        "Paiements Effectu\u00E9s": member.payments.filter((p) => p.is_paid).length,
        "Paiements en Retard": member.payments.filter((p) => !p.is_paid && isOverdue(p)).length,
        "Dernier Paiement": member.lastPaymentDate
          ? formatDate(member.lastPaymentDate)
          : "Aucun",
      }));

      const headers = Object.keys(csvData[0] || {});
      const csvContent = [
        headers.join(","),
        ...csvData.map((row) =>
          headers.map((h) => `"${String(row[h]).replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Paiements_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
    } catch (err) {
      console.error("Erreur export CSV:", err);
      alert("Erreur lors de la g\u00E9n\u00E9ration du CSV.");
    }
  };

  // ---------------------------------------------------------------------------
  // 6.16 -- Member edit handler
  // ---------------------------------------------------------------------------

  /**
   * Open the MemberForm modal pre-populated with the selected member's data.
   * Pulls the cached photo if available.
   */
  const handleEditMember = (member) => {
    const memberOnlyData = {
      id: member.id,
      name: member.name,
      firstName: member.firstName,
      email: member.email,
      phone: member.phone ?? member.mobile ?? "",
      mobile: member.mobile ?? member.phone ?? "",
      badgeId: member.badgeId,
      photo: photosCache[member.id] || null,
      dateOfBirth: member.dateOfBirth,
      address: member.address,
      subscriptionType: member.subscriptionType || member.membershipType || "Mensuel",
      membershipType: member.membershipType,
      startDate: member.startDate,
      endDate: member.endDate,
      status: member.status,
      emergencyContact: member.emergencyContact,
      emergencyPhone: member.emergencyPhone,
      medicalInfo: member.medicalInfo,
      files: member.files,
    };
    setSelectedMember(memberOnlyData);
    setShowForm(true);
  };

  // ---------------------------------------------------------------------------
  // 6.17 -- Error & loading screens
  // ---------------------------------------------------------------------------

  /** Full-screen connection error view with retry button. */
  const renderConnectionError = () => (
    <div
      className={`min-h-screen ${
        isDarkMode
          ? "bg-gradient-to-br from-gray-900 to-black"
          : "bg-gradient-to-br from-blue-50 to-purple-50"
      } flex items-center justify-center p-4`}
    >
      <div
        className={`${
          isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        } rounded-xl shadow-lg p-8 max-w-md w-full text-center border`}
      >
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
        <h2
          className={`text-2xl font-bold ${
            isDarkMode ? "text-white" : "text-gray-800"
          } mb-4`}
        >
          Probl\u00E8me de connexion
        </h2>
        <p className={`${isDarkMode ? "text-gray-300" : "text-gray-600"} mb-8`}>
          {error}
        </p>
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-3"
        >
          {isRetrying ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Reconnexion...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              R\u00E9essayer
            </>
          )}
        </button>
        {retryCount > 0 && (
          <p
            className={`text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            } mt-4`}
          >
            Tentative {retryCount + 1}
          </p>
        )}
      </div>
    </div>
  );

  /** Full-screen loading spinner. */
  const renderLoading = () => (
    <div
      className={`min-h-screen ${
        isDarkMode
          ? "bg-gradient-to-br from-gray-900 to-black"
          : "bg-gradient-to-br from-blue-50 to-purple-50"
      } flex items-center justify-center`}
    >
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <RefreshCw className="w-8 h-8 animate-spin text-white" />
        </div>
        <h2
          className={`text-xl font-semibold ${
            isDarkMode ? "text-white" : "text-gray-800"
          } mb-2`}
        >
          {isRetrying ? "Reconnexion en cours..." : "Chargement des paiements..."}
        </h2>
        <p className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
          Mode optimis\u00E9 egress
        </p>
      </div>
    </div>
  );

  // Early returns for loading / error states
  if (loading) return renderLoading();
  if (error && !isRetrying) return renderConnectionError();

  // ---------------------------------------------------------------------------
  // 6.18 -- PaginationBar sub-component
  // ---------------------------------------------------------------------------

  /** Reusable pagination bar rendered at top and bottom of the member list. */
  const PaginationBar = ({ position = "top" }) =>
    totalPages > 1 ? (
      <div
        className={`${position === "top" ? "mb-4" : "mt-4"} flex items-center justify-between ${
          isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        } rounded-lg p-4 border`}
      >
        {/* Page info */}
        <div className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          Page {currentPage} sur {totalPages} &bull; Affichage de{" "}
          {filteredMembers.length === 0 ? 0 : startIndex + 1}-
          {Math.min(endIndex, filteredMembers.length)} sur {filteredMembers.length} membres
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className={`px-3 py-2 rounded-lg inline-flex items-center gap-1 ${
              isDarkMode
                ? "bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800"
                : "bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100"
            } disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Pr\u00E9c\u00E9dent</span>
          </button>

          {/* Page number buttons with ellipsis */}
          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (page) =>
                  page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
              )
              .map((page, idx, arr) => (
                <React.Fragment key={page}>
                  {idx > 0 && arr[idx - 1] !== page - 1 && (
                    <span
                      className={`px-2 ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}
                    >
                      ...
                    </span>
                  )}
                  <button
                    onClick={() => goToPage(page)}
                    className={`px-3 py-2 rounded-lg transition-colors ${
                      page === currentPage
                        ? "bg-blue-600 text-white"
                        : isDarkMode
                        ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
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
            className={`px-3 py-2 rounded-lg inline-flex items-center gap-1 ${
              isDarkMode
                ? "bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800"
                : "bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100"
            } disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          >
            <span className="hidden sm:inline">Suivant</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    ) : null;

  // ---------------------------------------------------------------------------
  // 6.19 -- Mobile card view
  // ---------------------------------------------------------------------------

  /** Render the member list as cards for small screens. */
  const renderMobileView = () => (
    <div className="space-y-4">
      {paginatedMembers.map((member) => (
        <div
          key={member.id}
          className={`${
            isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          } rounded-lg shadow border overflow-hidden`}
        >
          <div className="p-4">
            {/* Member identity row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  <Avatar
                    photo={photosCache[member.id] || null}
                    firstName={member.firstName}
                    name={member.name}
                    size={48}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4
                    className={`text-lg font-semibold ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    } truncate`}
                  >
                    {member.firstName || "Pr\u00E9nom"} {member.name || "Nom"}
                  </h4>
                  <p
                    className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Badge: {member.badgeId || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0 ml-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                    member.overallStatus
                  )}`}
                >
                  {getStatusIcon(member.overallStatus)}
                  <span className="hidden sm:inline">
                    {getStatusLabel(member.overallStatus)}
                  </span>
                </span>
              </div>
            </div>

            {/* Progress & amounts */}
            <div className="grid grid-cols-1 gap-3">
              <div
                className={`${isDarkMode ? "bg-gray-700" : "bg-gray-50"} p-3 rounded-lg`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-sm font-medium ${
                      isDarkMode ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    Progression
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {member.progressPercentage.toFixed(0)}%
                  </span>
                </div>
                <div
                  className={`w-full ${
                    isDarkMode ? "bg-gray-600" : "bg-gray-200"
                  } rounded-full h-2`}
                >
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      member.progressPercentage === 100
                        ? "bg-gradient-to-r from-green-400 to-green-600"
                        : member.progressPercentage > 50
                        ? "bg-gradient-to-r from-yellow-400 to-yellow-600"
                        : "bg-gradient-to-r from-red-400 to-red-600"
                    }`}
                    style={{
                      width: `${Math.min(member.progressPercentage, 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Amounts card */}
                <div
                  className={`${
                    isDarkMode ? "bg-gray-700" : "bg-gray-50"
                  } p-3 rounded-lg`}
                >
                  <div
                    className={`text-sm font-medium ${
                      isDarkMode ? "text-gray-300" : "text-gray-600"
                    } mb-1`}
                  >
                    Montants
                  </div>
                  <div className="text-sm">
                    <div className="font-bold text-green-600">
                      {member.totalPaid.toFixed(2)} \u20AC
                    </div>
                    <div
                      className={`${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      sur {member.totalDue.toFixed(2)} \u20AC
                    </div>
                  </div>
                </div>

                {/* Payment count card */}
                <div
                  className={`${
                    isDarkMode ? "bg-gray-700" : "bg-gray-50"
                  } p-3 rounded-lg`}
                >
                  <div
                    className={`text-sm font-medium ${
                      isDarkMode ? "text-gray-300" : "text-gray-600"
                    } mb-1`}
                  >
                    Paiements
                  </div>
                  <div className="text-sm">
                    <div className="font-bold text-blue-600">
                      {member.payments.filter((p) => p.is_paid).length}
                    </div>
                    <div
                      className={`${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      sur {member.payments.length}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() =>
                  setExpandedMember(expandedMember === member.id ? null : member.id)
                }
                className={`flex-1 text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center justify-center gap-1 py-2 border ${
                  isDarkMode
                    ? "border-blue-500 hover:bg-blue-900/20"
                    : "border-blue-200 hover:bg-blue-50"
                } rounded-lg transition-colors`}
              >
                {expandedMember === member.id ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Masquer les d\u00E9tails
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Voir les d\u00E9tails
                  </>
                )}
              </button>

              <button
                onClick={() => handleEditMember(member)}
                className={`flex-1 sm:flex-none text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center justify-center gap-1 py-2 px-4 border ${
                  isDarkMode
                    ? "border-orange-500 hover:bg-orange-900/20"
                    : "border-orange-200 hover:bg-orange-50"
                } rounded-lg transition-colors`}
              >
                <Edit className="w-4 h-4" />
                Modifier
              </button>
            </div>
          </div>

          {/* Expanded payment details */}
          {expandedMember === member.id && (
            <div
              className={`border-t ${
                isDarkMode ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="p-4 space-y-4">
                <h5
                  className={`font-semibold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  } flex items-center gap-2`}
                >
                  <CreditCard className="w-4 h-4" />
                  D\u00E9tail des paiements
                </h5>

                {member.payments.length > 0 ? (
                  <div className="space-y-3">
                    {member.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className={`${
                          isDarkMode
                            ? "bg-gray-800 border-gray-700"
                            : "bg-white border"
                        } rounded-lg p-3`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              getPaymentStatus(payment)
                            )}`}
                          >
                            {getStatusIcon(getPaymentStatus(payment))}
                            {getStatusLabel(getPaymentStatus(payment))}
                          </span>
                          <span
                            className={`text-sm font-medium ${
                              isDarkMode ? "text-white" : "text-gray-900"
                            }`}
                          >
                            #{payment.id}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span
                              className={`${
                                isDarkMode ? "text-gray-400" : "text-gray-500"
                              }`}
                            >
                              Montant:
                            </span>
                            <div className="font-bold">
                              {parseFloat(payment.amount || 0).toFixed(2)} \u20AC
                            </div>
                          </div>
                          <div>
                            <span
                              className={`${
                                isDarkMode ? "text-gray-400" : "text-gray-500"
                              }`}
                            >
                              M\u00E9thode:
                            </span>
                            <div className="flex items-center gap-1">
                              <span>{getPaymentMethodIcon(payment.method)}</span>
                              <span className="capitalize">{payment.method}</span>
                            </div>
                          </div>
                          <div>
                            <span
                              className={`${
                                isDarkMode ? "text-gray-400" : "text-gray-500"
                              }`}
                            >
                              Date paiement:
                            </span>
                            <div className="font-medium">
                              {payment.is_paid
                                ? formatDate(payment.date_paiement)
                                : "Non pay\u00E9"}
                            </div>
                          </div>
                          <div>
                            <span
                              className={`${
                                isDarkMode ? "text-gray-400" : "text-gray-500"
                              }`}
                            >
                              \u00C9ch\u00E9ance:
                            </span>
                            <div className="font-medium">
                              {formatDate(payment.encaissement_prevu)}
                            </div>
                          </div>
                        </div>

                        {payment.commentaire && (
                          <div
                            className={`mt-2 p-2 ${
                              isDarkMode ? "bg-gray-700" : "bg-gray-100"
                            } rounded text-sm`}
                          >
                            <span
                              className={`${
                                isDarkMode ? "text-gray-400" : "text-gray-500"
                              }`}
                            >
                              Commentaire:
                            </span>
                            <div
                              className={`${
                                isDarkMode ? "text-gray-300" : "text-gray-700"
                              } mt-1`}
                            >
                              {payment.commentaire}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <CreditCard
                      className={`w-8 h-8 ${
                        isDarkMode ? "text-gray-500" : "text-gray-400"
                      } mx-auto mb-2`}
                    />
                    <p
                      className={`${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      } text-sm`}
                    >
                      Aucun paiement enregistr\u00E9
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // ===========================================================================
  // SECTION 7 -- Main render
  // ===========================================================================

  return (
    <div
      className={`min-h-screen ${
        isDarkMode
          ? "bg-gradient-to-br from-gray-900 to-black"
          : "bg-gradient-to-br from-blue-50 to-purple-50"
      } p-4 lg:p-6`}
    >
      <div className="max-w-full mx-auto">
        {/* Page header & export buttons */}
        <div className="mb-6 lg:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1
                className={`text-2xl lg:text-4xl font-bold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                } mb-2`}
              >
                Suivi des Paiements
              </h1>
              <p className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                Mode optimis\u00E9 egress &bull; {members.length} membres &bull; Pagination{" "}
                {ITEMS_PER_PAGE}/page
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 lg:gap-3">
              <button
                onClick={exportToCSV}
                disabled={loading || filteredMembers.length === 0}
                className={`flex items-center justify-center gap-2 px-4 py-2 ${
                  isDarkMode
                    ? "bg-gray-800 border-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:text-gray-500 text-white"
                    : "bg-white border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                } border rounded-lg transition-colors text-sm font-medium`}
              >
                <Download className="w-4 h-4" />
                Exporter CSV
              </button>
              <button
                onClick={exportToPDF}
                disabled={loading || filteredMembers.length === 0}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Exporter PDF
              </button>
              <button
                onClick={() => loadData(true)}
                disabled={isRetrying}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`}
                />
                Actualiser
              </button>
            </div>
          </div>
        </div>

        {/* Statistics cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6 lg:mb-8">
          {/* Total expected */}
          <div
            className={`${
              isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            } rounded-xl shadow-lg p-4 lg:p-6 border`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <p
                  className={`text-xs lg:text-sm font-medium ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Total Attendu
                </p>
                <p
                  className={`text-lg lg:text-2xl font-bold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {stats.totalExpected.toLocaleString()} \u20AC
                </p>
                <p
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  } mt-1`}
                >
                  {payments.length} paiement(s)
                </p>
              </div>
              <div
                className={`hidden lg:block p-3 ${
                  isDarkMode ? "bg-blue-900/30" : "bg-blue-100"
                } rounded-full`}
              >
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Total received */}
          <div
            className={`${
              isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            } rounded-xl shadow-lg p-4 lg:p-6 border`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <p
                  className={`text-xs lg:text-sm font-medium ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Total Re\u00E7u
                </p>
                <p className="text-lg lg:text-2xl font-bold text-green-600">
                  {stats.totalReceived.toLocaleString()} \u20AC
                </p>
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {stats.collectionRate.toFixed(1)}%
                </p>
              </div>
              <div
                className={`hidden lg:block p-3 ${
                  isDarkMode ? "bg-green-900/30" : "bg-green-100"
                } rounded-full`}
              >
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Pending */}
          <div
            className={`${
              isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            } rounded-xl shadow-lg p-4 lg:p-6 border`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <p
                  className={`text-xs lg:text-sm font-medium ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  En Attente
                </p>
                <p className="text-lg lg:text-2xl font-bold text-yellow-600">
                  {stats.totalPending.toLocaleString()} \u20AC
                </p>
                <p
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  } mt-1`}
                >
                  {stats.pendingCount} paiement(s)
                </p>
              </div>
              <div
                className={`hidden lg:block p-3 ${
                  isDarkMode ? "bg-yellow-900/30" : "bg-yellow-100"
                } rounded-full`}
              >
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          {/* Overdue */}
          <div
            className={`${
              isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            } rounded-xl shadow-lg p-4 lg:p-6 border`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <p
                  className={`text-xs lg:text-sm font-medium ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  En Retard
                </p>
                <p className="text-lg lg:text-2xl font-bold text-red-600">
                  {stats.totalOverdue.toLocaleString()} \u20AC
                </p>
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  {stats.overdueCount} paiement(s)
                </p>
              </div>
              <div
                className={`hidden lg:block p-3 ${
                  isDarkMode ? "bg-red-900/30" : "bg-red-100"
                } rounded-full`}
              >
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Global progress bar */}
        <div
          className={`${
            isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          } rounded-xl shadow-lg p-4 lg:p-6 mb-6 lg:mb-8 border`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <h3
              className={`text-lg font-semibold ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}
            >
              Progression Globale
            </h3>
            <span className="text-xl lg:text-2xl font-bold text-blue-600">
              {stats.collectionRate.toFixed(1)}%
            </span>
          </div>
          <div
            className={`w-full ${
              isDarkMode ? "bg-gray-700" : "bg-gray-200"
            } rounded-full h-3 lg:h-4`}
          >
            <div
              className="bg-gradient-to-r from-blue-500 to-green-500 h-3 lg:h-4 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(stats.collectionRate, 100)}%` }}
            />
          </div>
          <div
            className={`flex justify-between text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            } mt-2`}
          >
            <span>{stats.totalReceived.toLocaleString()} \u20AC re\u00E7us</span>
            <span>{stats.totalExpected.toLocaleString()} \u20AC attendus</span>
          </div>
        </div>

        {/* Search & filter controls */}
        <div
          className={`${
            isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          } rounded-xl shadow-lg p-4 lg:p-6 mb-4 border`}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search input */}
              <div className="flex-1">
                <div className="relative">
                  <Search
                    className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
                      isDarkMode ? "text-gray-500" : "text-gray-400"
                    } w-5 h-5`}
                  />
                  <input
                    type="text"
                    placeholder="Rechercher par nom, pr\u00E9nom ou badge..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border ${
                      isDarkMode
                        ? "border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                        : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    } rounded-lg`}
                  />
                </div>
                <SearchHints search={searchTerm} />
              </div>

              {/* Status filter dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`px-4 py-2 border ${
                  isDarkMode
                    ? "border-gray-600 bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"
                    : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                } rounded-lg sm:w-48`}
              >
                <option value="all">Tous les statuts</option>
                <option value="paid">Pay\u00E9</option>
                <option value="pending">En attente</option>
                <option value="overdue">En retard</option>
                <option value="no_payments">Aucun paiement</option>
              </select>

              {/* Filter toggle button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 sm:w-auto ${
                  showFilters
                    ? "bg-blue-100 text-blue-600"
                    : isDarkMode
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filtres</span>
              </button>
            </div>

            {/* Result count & reset */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {filteredMembers.length} membre(s) affich\u00E9(s) sur {members.length}
                {loadingPhotos && (
                  <span className="ml-2 text-blue-500">
                    &bull; Chargement photos...
                  </span>
                )}
              </p>
              {(searchTerm || statusFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium self-start sm:self-auto"
                >
                  R\u00E9initialiser les filtres
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Pagination (top) */}
        <PaginationBar position="top" />

        {/* Member list: mobile cards or desktop table */}
        {isMobile ? (
          <div
            className={`${
              isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            } rounded-xl shadow-lg border`}
          >
            <div
              className={`px-4 py-4 border-b ${
                isDarkMode ? "border-gray-700" : "border-gray-200"
              }`}
            >
              <h3
                className={`text-lg font-semibold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                Membres ({filteredMembers.length})
              </h3>
            </div>
            <div className="p-4">
              {paginatedMembers.length > 0 ? (
                renderMobileView()
              ) : (
                <div className="text-center py-12">
                  <Users
                    className={`w-16 h-16 ${
                      isDarkMode ? "text-gray-500" : "text-gray-400"
                    } mx-auto mb-4`}
                  />
                  <h3
                    className={`text-lg font-medium ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    } mb-2`}
                  >
                    Aucun membre trouv\u00E9
                  </h3>
                  <p
                    className={`${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Essayez de modifier vos crit\u00E8res de recherche
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Desktop table view */
          <div
            className={`${
              isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            } rounded-xl shadow-lg overflow-hidden border`}
          >
            <div
              className={`px-6 py-4 border-b ${
                isDarkMode ? "border-gray-700" : "border-gray-200"
              }`}
            >
              <h3
                className={`text-lg font-semibold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                D\u00E9tail par Membre ({filteredMembers.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                {/* Table header */}
                <thead className={`${isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                  <tr>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium ${
                        isDarkMode ? "text-gray-300" : "text-gray-500"
                      } uppercase tracking-wider`}
                    >
                      Membre
                    </th>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium ${
                        isDarkMode ? "text-gray-300" : "text-gray-500"
                      } uppercase tracking-wider`}
                    >
                      Statut
                    </th>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium ${
                        isDarkMode ? "text-gray-300" : "text-gray-500"
                      } uppercase tracking-wider`}
                    >
                      Progression
                    </th>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium ${
                        isDarkMode ? "text-gray-300" : "text-gray-500"
                      } uppercase tracking-wider`}
                    >
                      Montants
                    </th>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium ${
                        isDarkMode ? "text-gray-300" : "text-gray-500"
                      } uppercase tracking-wider`}
                    >
                      Dernier Paiement
                    </th>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium ${
                        isDarkMode ? "text-gray-300" : "text-gray-500"
                      } uppercase tracking-wider`}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>

                {/* Table body */}
                <tbody
                  className={`${
                    isDarkMode
                      ? "bg-gray-800 divide-gray-700"
                      : "bg-white divide-gray-200"
                  } divide-y`}
                >
                  {paginatedMembers.map((member) => (
                    <React.Fragment key={member.id}>
                      <tr
                        className={`${
                          isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-50"
                        } transition-colors`}
                      >
                        {/* Member identity cell */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <Avatar
                                photo={photosCache[member.id] || null}
                                firstName={member.firstName}
                                name={member.name}
                                size={40}
                              />
                            </div>
                            <div className="ml-4">
                              <div
                                className={`text-sm font-medium ${
                                  isDarkMode ? "text-white" : "text-gray-900"
                                }`}
                              >
                                {member.firstName || "Pr\u00E9nom"}{" "}
                                {member.name || "Nom"}
                              </div>
                              <div
                                className={`text-sm ${
                                  isDarkMode ? "text-gray-400" : "text-gray-500"
                                }`}
                              >
                                Badge: {member.badgeId || "N/A"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status badge cell */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                              member.overallStatus
                            )}`}
                          >
                            {getStatusIcon(member.overallStatus)}
                            {getStatusLabel(member.overallStatus)}
                          </span>
                        </td>

                        {/* Progress bar cell */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-32">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span
                                className={`${
                                  isDarkMode ? "text-gray-300" : "text-gray-600"
                                }`}
                              >
                                {member.progressPercentage.toFixed(0)}%
                              </span>
                              <span
                                className={`${
                                  isDarkMode ? "text-gray-400" : "text-gray-500"
                                } text-xs`}
                              >
                                {member.totalPaid.toFixed(0)}\u20AC/
                                {member.totalDue.toFixed(0)}\u20AC
                              </span>
                            </div>
                            <div
                              className={`w-full ${
                                isDarkMode ? "bg-gray-700" : "bg-gray-200"
                              } rounded-full h-2`}
                            >
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${
                                  member.progressPercentage === 100
                                    ? "bg-gradient-to-r from-green-400 to-green-600"
                                    : member.progressPercentage > 50
                                    ? "bg-gradient-to-r from-yellow-400 to-yellow-600"
                                    : "bg-gradient-to-r from-red-400 to-red-600"
                                }`}
                                style={{
                                  width: `${Math.min(member.progressPercentage, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Amounts cell */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div
                              className={`font-medium ${
                                isDarkMode ? "text-white" : "text-gray-900"
                              }`}
                            >
                              {member.totalPaid.toFixed(2)} \u20AC /{" "}
                              {member.totalDue.toFixed(2)} \u20AC
                            </div>
                            <div
                              className={`${
                                isDarkMode ? "text-gray-400" : "text-gray-500"
                              }`}
                            >
                              {member.payments.length} paiement(s)
                            </div>
                          </div>
                        </td>

                        {/* Last payment cell */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div
                            className={`text-sm ${
                              isDarkMode ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {member.lastPaymentDate ? (
                              <div className="flex items-center gap-1">
                                <Calendar
                                  className={`w-4 h-4 ${
                                    isDarkMode ? "text-gray-500" : "text-gray-400"
                                  }`}
                                />
                                {formatDate(member.lastPaymentDate)}
                              </div>
                            ) : (
                              <span
                                className={`${
                                  isDarkMode ? "text-gray-500" : "text-gray-400"
                                } italic`}
                              >
                                Aucun paiement
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions cell */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                setExpandedMember(
                                  expandedMember === member.id ? null : member.id
                                )
                              }
                              className="text-blue-600 hover:text-blue-900 transition-colors flex items-center gap-1"
                            >
                              {expandedMember === member.id ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                              {expandedMember === member.id
                                ? "Masquer"
                                : "D\u00E9tails"}
                            </button>

                            <button
                              onClick={() => handleEditMember(member)}
                              className="text-orange-600 hover:text-orange-900 transition-colors flex items-center gap-1"
                            >
                              <Edit className="w-4 h-4" />
                              Modifier
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded payment detail row */}
                      {expandedMember === member.id && (
                        <tr>
                          <td
                            colSpan="6"
                            className={`px-6 py-4 ${
                              isDarkMode ? "bg-gray-900" : "bg-gray-50"
                            }`}
                          >
                            <div className="space-y-4">
                              <h4
                                className={`font-medium ${
                                  isDarkMode ? "text-white" : "text-gray-900"
                                } flex items-center gap-2`}
                              >
                                <CreditCard className="w-4 h-4" />
                                D\u00E9tail des paiements de {member.firstName}{" "}
                                {member.name}
                              </h4>

                              {member.payments.length > 0 ? (
                                <div className="grid gap-3">
                                  {member.payments.map((payment) => (
                                    <div
                                      key={payment.id}
                                      className={`${
                                        isDarkMode
                                          ? "bg-gray-800 border-gray-700"
                                          : "bg-white border-gray-200"
                                      } rounded-lg p-4 border`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-3">
                                            <span
                                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                                getPaymentStatus(payment)
                                              )}`}
                                            >
                                              {getStatusIcon(
                                                getPaymentStatus(payment)
                                              )}
                                              {getStatusLabel(
                                                getPaymentStatus(payment)
                                              )}
                                            </span>
                                            <span
                                              className={`font-medium ${
                                                isDarkMode
                                                  ? "text-white"
                                                  : "text-gray-900"
                                              }`}
                                            >
                                              Paiement #{payment.id}
                                            </span>
                                          </div>

                                          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div>
                                              <span
                                                className={`${
                                                  isDarkMode
                                                    ? "text-gray-400"
                                                    : "text-gray-500"
                                                }`}
                                              >
                                                Montant:
                                              </span>
                                              <div className="font-medium">
                                                {parseFloat(
                                                  payment.amount || 0
                                                ).toFixed(2)}{" "}
                                                \u20AC
                                              </div>
                                            </div>
                                            <div>
                                              <span
                                                className={`${
                                                  isDarkMode
                                                    ? "text-gray-400"
                                                    : "text-gray-500"
                                                }`}
                                              >
                                                M\u00E9thode:
                                              </span>
                                              <div className="font-medium flex items-center gap-1">
                                                <span>
                                                  {getPaymentMethodIcon(
                                                    payment.method
                                                  )}
                                                </span>
                                                <span className="capitalize">
                                                  {payment.method}
                                                </span>
                                              </div>
                                            </div>
                                            <div>
                                              <span
                                                className={`${
                                                  isDarkMode
                                                    ? "text-gray-400"
                                                    : "text-gray-500"
                                                }`}
                                              >
                                                Date de paiement:
                                              </span>
                                              <div className="font-medium">
                                                {payment.is_paid
                                                  ? formatDateTime(
                                                      payment.date_paiement
                                                    )
                                                  : "Non pay\u00E9"}
                                              </div>
                                            </div>
                                            <div>
                                              <span
                                                className={`${
                                                  isDarkMode
                                                    ? "text-gray-400"
                                                    : "text-gray-500"
                                                }`}
                                              >
                                                Encaissement pr\u00E9vu:
                                              </span>
                                              <div className="font-medium">
                                                {formatDate(
                                                  payment.encaissement_prevu
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          {payment.commentaire && (
                                            <div
                                              className={`mt-3 p-2 ${
                                                isDarkMode
                                                  ? "bg-gray-700"
                                                  : "bg-gray-50"
                                              } rounded`}
                                            >
                                              <span
                                                className={`${
                                                  isDarkMode
                                                    ? "text-gray-400"
                                                    : "text-gray-500"
                                                } text-sm`}
                                              >
                                                Commentaire:
                                              </span>
                                              <div
                                                className={`${
                                                  isDarkMode
                                                    ? "text-gray-300"
                                                    : "text-gray-700"
                                                } text-sm mt-1`}
                                              >
                                                {payment.commentaire}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-8">
                                  <CreditCard
                                    className={`w-12 h-12 ${
                                      isDarkMode
                                        ? "text-gray-500"
                                        : "text-gray-400"
                                    } mx-auto mb-3`}
                                  />
                                  <p
                                    className={`${
                                      isDarkMode
                                        ? "text-gray-400"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    Aucun paiement enregistr\u00E9 pour ce membre
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Empty state for desktop table */}
            {paginatedMembers.length === 0 && (
              <div className="text-center py-12">
                <Users
                  className={`w-12 h-12 ${
                    isDarkMode ? "text-gray-500" : "text-gray-400"
                  } mx-auto mb-4`}
                />
                <h3
                  className={`text-lg font-medium ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  } mb-2`}
                >
                  Aucun membre trouv\u00E9
                </h3>
                <p
                  className={`${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Essayez de modifier vos crit\u00E8res de recherche
                </p>
              </div>
            )}
          </div>
        )}

        {/* Pagination (bottom) */}
        <PaginationBar position="bottom" />

        {/* Payment method breakdown & recent payments */}
        <div className="mt-6 lg:mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Breakdown by payment method */}
          <div
            className={`${
              isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            } rounded-xl shadow-lg p-4 lg:p-6 border`}
          >
            <h3
              className={`text-lg font-semibold ${
                isDarkMode ? "text-white" : "text-gray-900"
              } mb-4`}
            >
              R\u00E9partition par M\u00E9thode
            </h3>
            <div className="space-y-3">
              {["carte", "ch\u00E8que", "esp\u00E8ces", "autre"].map((method) => {
                const methodPayments = payments.filter(
                  (p) =>
                    p.is_paid &&
                    (p.method === method ||
                      (method === "ch\u00E8que" && p.method === "cheque") ||
                      (method === "esp\u00E8ces" && p.method === "especes"))
                );
                const total = methodPayments.reduce(
                  (sum, p) => sum + parseFloat(p.amount || 0),
                  0
                );
                const percentage =
                  stats.totalReceived > 0
                    ? (total / stats.totalReceived) * 100
                    : 0;

                return (
                  <div
                    key={method}
                    className={`flex items-center justify-between p-3 ${
                      isDarkMode ? "bg-gray-700" : "bg-gray-50"
                    } rounded-lg`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg lg:text-xl">
                        {getPaymentMethodIcon(method)}
                      </span>
                      <span
                        className={`font-medium capitalize ${
                          isDarkMode ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {method}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-sm lg:text-base">
                        {total.toFixed(2)} \u20AC
                      </div>
                      <div
                        className={`text-xs lg:text-sm ${
                          isDarkMode ? "text-gray-400" : "text-gray-500"
                        }`}
                      >
                        {percentage.toFixed(1)}% &bull; {methodPayments.length}{" "}
                        paiement(s)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent payments list */}
          <div
            className={`${
              isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            } rounded-xl shadow-lg p-4 lg:p-6 border`}
          >
            <h3
              className={`text-lg font-semibold ${
                isDarkMode ? "text-white" : "text-gray-900"
              } mb-4`}
            >
              Paiements R\u00E9cents
            </h3>
            <div className="space-y-3">
              {payments
                .filter((p) => p.is_paid)
                .slice(0, 5)
                .map((payment) => (
                  <div
                    key={payment.id}
                    className={`flex items-center justify-between p-3 ${
                      isDarkMode ? "bg-gray-700" : "bg-gray-50"
                    } rounded-lg`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-lg">
                        {getPaymentMethodIcon(payment.method)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`font-medium text-sm ${
                            isDarkMode ? "text-white" : "text-gray-900"
                          } truncate`}
                        >
                          {payment.members?.firstName} {payment.members?.name}
                        </div>
                        <div
                          className={`text-xs ${
                            isDarkMode ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          {formatDate(payment.date_paiement)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-medium text-sm lg:text-base text-green-600">
                        {parseFloat(payment.amount).toFixed(2)} \u20AC
                      </div>
                    </div>
                  </div>
                ))}
              {payments.filter((p) => p.is_paid).length === 0 && (
                <div
                  className={`text-center py-6 lg:py-8 ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  <Clock
                    className={`w-8 lg:w-12 h-8 lg:h-12 mx-auto mb-2 ${
                      isDarkMode ? "text-gray-600" : "text-gray-300"
                    }`}
                  />
                  <p className="text-sm">Aucun paiement r\u00E9cent</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global summary banner */}
        <div className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-4 lg:p-6 text-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl lg:text-3xl font-bold">
                {stats.totalMembers}
              </div>
              <div className="text-sm lg:text-base text-blue-100">
                Membres total
              </div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-bold">
                {stats.collectionRate.toFixed(1)}%
              </div>
              <div className="text-sm lg:text-base text-blue-100">
                Taux de collecte
              </div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-bold">
                {stats.paidCount + stats.pendingCount + stats.overdueCount}
              </div>
              <div className="text-sm lg:text-base text-blue-100">
                Total paiements
              </div>
            </div>
          </div>
        </div>

        {/* Page footer */}
        <div className="mt-6 text-center">
          <p
            className={`text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            Derni\u00E8re mise \u00E0 jour : {new Date().toLocaleString("fr-FR")}
          </p>
          <p
            className={`text-xs ${
              isDarkMode ? "text-gray-500" : "text-gray-400"
            } mt-1`}
          >
            Club Body Force - Syst\u00E8me de Gestion des Paiements v2.1 (Optimis\u00E9
            Egress)
          </p>
        </div>
      </div>

      {/* Member edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-start justify-center overflow-auto">
          <div
            className={`${
              isDarkMode ? "bg-gray-800" : "bg-white"
            } mt-4 mb-4 rounded-xl shadow-xl w-full max-w-4xl mx-4`}
          >
            <MemberForm
              member={selectedMember}
              onSave={async (memberData, closeModal) => {
                try {
                  if (selectedMember?.id) {
                    const { error } = await supabase
                      .from("members")
                      .update(memberData)
                      .eq("id", selectedMember.id);
                    if (error) throw error;
                  } else {
                    const { error } = await supabase
                      .from("members")
                      .insert([memberData])
                      .select();
                    if (error) throw error;
                  }

                  if (closeModal) {
                    setShowForm(false);
                    setSelectedMember(null);
                  }
                  await loadData();
                } catch (saveError) {
                  console.error("Erreur sauvegarde membre:", saveError);
                  alert(`Erreur lors de la sauvegarde: ${saveError.message}`);
                }
              }}
              onCancel={() => {
                setShowForm(false);
                setSelectedMember(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SECTION 8 -- Export
// =============================================================================

export default PaymentsPage;
