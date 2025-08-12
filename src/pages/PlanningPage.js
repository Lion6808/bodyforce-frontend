import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import * as XLSX from "xlsx";

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
import { createClient } from "@supabase/supabase-js";
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";

// Client Supabase direct
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

// ... (Toutes les fonctions utilitaires comme formatDate, etc. sont ici) ...
// NOTE: Le code des utilitaires est masqué ici pour la lisibilité, mais il est dans le bloc final.

const cn = (...classes) => classes.filter(Boolean).join(' ');

// ... (début des utilitaires)
const formatDate = (date, formatStr) => {
  const options = {
    "yyyy-MM-dd": { year: "numeric", month: "2-digit", day: "2-digit" },
    "dd/MM/yyyy": { day: "2-digit", month: "2-digit", year: "numeric" },
    "EEE dd/MM": { weekday: "short", day: "2-digit", month: "2-digit" },
    "EEE dd": { weekday: "short", day: "2-digit" },
    "HH:mm": { hour: "2-digit", minute: "2-digit", hour12: false },
    "MMMM yyyy": { month: "long", year: "numeric" },
    "EEEE dd MMMM": { weekday: "long", day: "numeric", month: "long" }
  };
  if (formatStr === "yyyy-MM-dd") return date.toISOString().split("T")[0];
  return new Intl.DateTimeFormat("fr-FR", options[formatStr] || {}).format(date);
};
const parseTimestamp = (timestamp) => new Date(timestamp);
const toDateString = (date) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const isWeekend = (date) => { const day = date.getDay(); return day === 0 || day === 6; };
const isWithinInterval = (date, interval) => date >= interval.start && date <= interval.end;
const eachDayOfInterval = (interval) => {
  const days = [];
  const current = new Date(interval.start);
  while (current <= interval.end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
};
const startOfDay = (date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };
const endOfDay = (date) => { const d = new Date(date); d.setHours(23, 59, 59, 999); return d; };
const addWeeks = (date, weeks) => { const d = new Date(date); d.setDate(d.getDate() + weeks * 7); return d; };
const addMonths = (date, months) => { const d = new Date(date); d.setMonth(d.getMonth() + months); return d; };
const addYears = (date, years) => { const d = new Date(date); d.setFullYear(d.getFullYear() + years); return d; };
const isToday = (date) => new Date().toDateString() === date.toDateString();
// ... (fin des utilitaires)


function PlanningPage() {
  // ... (Tous les états useState sont ici) ...
  const [presences, setPresences] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const { role } = useAuth();
  const [period, setPeriod] = useState("week");
  const [startDate, setStartDate] = useState(startOfDay(startOfWeek(new Date(), { weekStartsOn: 1 })));
  const [endDate, setEndDate] = useState(endOfDay(endOfWeek(new Date(), { weekStartsOn: 1 })));
  const [filterBadge, setFilterBadge] = useState("");
  const [filterName, setFilterName] = useState("");
  const [showNightHours, setShowNightHours] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [hoveredMember, setHoveredMember] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // ... (Toutes les fonctions comme loadData, handleRetry, etc. sont ici) ...
  const loadData = async (showRetryIndicator = false) => {
    // ...
  };
  useEffect(() => { loadData(); }, [startDate, endDate]);
  const handleRetry = () => { /* ... */ };
  useEffect(() => { 
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  const updateDateRange = (newPeriod, baseDate = new Date()) => {
    setPeriod(newPeriod);
    let newStart, newEnd;
    switch (newPeriod) {
      case "week": newStart = startOfWeek(baseDate, { weekStartsOn: 1 }); newEnd = endOfWeek(baseDate, { weekStartsOn: 1 }); break;
      case "month": newStart = startOfMonth(baseDate); newEnd = endOfMonth(baseDate); break;
      case "year": newStart = startOfYear(baseDate); newEnd = endOfYear(baseDate); break;
      default: newStart = startOfWeek(baseDate, { weekStartsOn: 1 }); newEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
    }
    setStartDate(startOfDay(newStart));
    setEndDate(endOfDay(newEnd));
  };
  const navigatePeriod = (direction) => {
    const amount = direction === "prev" ? -1 : 1;
    let newBaseDate;
    if (period === "week") newBaseDate = addWeeks(startDate, amount);
    else if (period === "month") newBaseDate = addMonths(startDate, amount);
    else newBaseDate = addYears(startDate, amount);
    updateDateRange(period, newBaseDate);
  };
  const handleImportExcel = async (event) => { /* ... */ };


  // ... (Les composants de rendu comme renderLoading, renderError sont ici) ...
  if (loading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error}</div>;

  // ... (La logique de filtrage et de groupement des données est ici) ...
  const filteredPresences = presences;
  const groupedByMember = {};
  filteredPresences.forEach(p => {
    const key = p.badgeId;
    if (!groupedByMember[key]) groupedByMember[key] = [];
    groupedByMember[key].push(new Date(p.timestamp));
  });
  const allDays = eachDayOfInterval({ start: startDate, end: endDate });
  const getMemberInfo = (badgeId) => members.find(m => m.badgeId === badgeId) || {};
  const visibleMembers = Object.keys(groupedByMember).map(badgeId => getMemberInfo(badgeId)).filter(m => m.badgeId);


  // ==================================================================
  // <-- DÉFINITION DES DIFFÉRENTES VUES (ListView, CompactView, etc.)
  // ==================================================================
  
  const StatsResume = () => (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6">Résumé des stats...</div>
  );

  const ListView = () => (
    <div className="space-y-4">
      {visibleMembers.map((member) => {
        const memberPresences = groupedByMember[member.badgeId] || [];
        return (
          <div key={member.badgeId} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center gap-3 mb-4">
              {/* ... avatar et nom ... */}
            </div>
            <div className="grid grid-cols-7 md:grid-cols-14 gap-1.5">
              {allDays.map((day) => {
                const dayTimes = memberPresences.filter(t => toDateString(t) === toDateString(day));
                const hasPresence = dayTimes.length > 0;
                return (
                  <div key={day.toISOString()} className="relative group">
                    <div className={cn("p-2 rounded text-center cursor-pointer transition-all hover:scale-105", hasPresence && "bg-green-500 text-white", !hasPresence && isWeekend(day) && "bg-blue-100 dark:bg-blue-900/20", !hasPresence && !isWeekend(day) && "bg-gray-100 dark:bg-gray-700")}>
                      <div className="font-bold text-sm">{day.getDate()}</div>
                    </div>
                    {hasPresence && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                        {/* ... tooltip ... */}
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
  );
  
  const CompactView = () => (<div>Vue Compacte</div>);
  const MonthlyView = () => (<div>Vue Mensuelle</div>);


  // ==================================================================
  // <-- ICI LE RETURN PRINCIPAL QUI CONSTRUIT TOUTE LA PAGE
  // ==================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-full mx-auto">
        
        {/* ================================================================== */}
        {/* <-- SECTION EN-TÊTE : TITRE, BOUTONS DE VUE, BOUTON FILTRE         */}
        {/* ================================================================== */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Planning des présences</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Suivi en temps réel des présences membres</p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center sm:justify-end bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1">
              {/* <-- BOUTONS DE CHOIX DE VUE */}
              <button onClick={() => setViewMode("list")} className={cn("p-2 rounded-md", viewMode === 'list' && "bg-white shadow text-blue-600")}><List className="w-5 h-5" /></button>
              <button onClick={() => setViewMode("compact")} className={cn("p-2 rounded-md", viewMode === 'compact' && "bg-white shadow text-blue-600")}><Users className="w-5 h-5" /></button>
              <button onClick={() => setViewMode("monthly")} className={cn("p-2 rounded-md", viewMode === 'monthly' && "bg-white shadow text-blue-600")}><Grid className="w-5 h-5" /></button>
              
              {/* <-- BOUTON POUR AFFICHER/CACHER LES FILTRES */}
              <button onClick={() => setShowFilters(!showFilters)} className={cn("p-3 rounded-lg", showFilters && "bg-blue-100 text-blue-600")}><Filter className="w-5 h-5" /></button>
            </div>
          </div>

          {/* ================================================================== */}
          {/* <-- SECTION NAVIGATION PÉRIODE : FLÈCHES, SÉLECTEUR, DATES        */}
          {/* ================================================================== */}
          <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <button onClick={() => navigatePeriod("prev")} className="p-2 hover:bg-white rounded-lg"><ChevronLeft className="w-6 h-6" /></button>
            <div className="flex items-center gap-4">
              <select className="border-2 rounded-lg px-4 py-2" value={period} onChange={(e) => updateDateRange(e.target.value, startDate)}>
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
                <option value="year">Année</option>
              </select>
              <div className="text-center">
                <div className="font-bold">{formatDate(startDate, "dd/MM/yyyy")} - {formatDate(endDate, "dd/MM/yyyy")}</div>
                <div className="text-sm text-gray-500">{allDays.length} jours</div>
              </div>
            </div>
            <button onClick={() => navigatePeriod("next")} className="p-2 hover:bg-white rounded-lg"><ChevronRight className="w-6 h-6" /></button>
          </div>
          
          {/* ================================================================== */}
          {/* <-- SECTION RACCOURCIS DE PÉRIODE                              */}
          {/* ================================================================== */}
          <div className="mt-4 flex flex-wrap gap-2">
             <button onClick={() => { const today = new Date(); setStartDate(startOfDay(today)); setEndDate(endOfDay(today)); }} className="px-2 py-1 text-xs border rounded">Aujourd'hui</button>
             <button onClick={() => { setStartDate(startOfDay(startOfWeek(new Date(), { weekStartsOn: 1 }))); setEndDate(endOfDay(endOfWeek(new Date(), { weekStartsOn: 1 }))); }} className="px-2 py-1 text-xs border rounded">Cette Semaine</button>
             {/* ... autres boutons de raccourcis ... */}
          </div>
        </div>

        {/* ================================================================== */}
        {/* <-- SECTION FILTRES (APPARAÎT CONDITIONNELLEMENT)                  */}
        {/* ================================================================== */}
        {showFilters && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label>Rechercher par nom</label>
                <input type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)} className="w-full border-2 rounded p-2" />
              </div>
              <div>
                <label>Filtrer par badge</label>
                <input type="text" value={filterBadge} onChange={(e) => setFilterBadge(e.target.value)} className="w-full border-2 rounded p-2" />
              </div>
              {/* ... autres filtres ... */}
            </div>
          </div>
        )}

        <StatsResume />

        {/* ================================================================== */}
        {/* <-- AFFICHAGE DE LA VUE SÉLECTIONNÉE (LISTE, COMPACTE OU MENSUELLE) */}
        {/* ================================================================== */}
        {visibleMembers.length === 0 ? (
          <div>Aucune présence trouvée.</div>
        ) : (
          <>
            {viewMode === "list" && <ListView />}
            {viewMode === "compact" && !isMobile && <CompactView />}
            {viewMode === "monthly" && !isMobile && <MonthlyView />}
          </>
        )}
      </div>
    </div>
  );
}

export default PlanningPage;