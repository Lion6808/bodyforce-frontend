import React, { useEffect, useState, useMemo } from "react";
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
import { fr } from "date-fns/locale";

// Client Supabase direct
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

// Utilitaires
const cn = (...classes) => classes.filter(Boolean).join(' ');
const formatDate = (date, formatStr) => format(date, formatStr, { locale: fr });
const parseTimestamp = (timestamp) => parseISO(timestamp);
const toDateString = (date) => (date && date instanceof Date) ? format(date, 'yyyy-MM-dd') : "";
const isWeekend = (date) => { const day = date.getDay(); return day === 0 || day === 6; };
const eachDayOfInterval = (interval) => {
  const days = [];
  if (!interval.start || !interval.end) return days;
  let current = new Date(interval.start);
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
const isToday = (date) => toDateString(new Date()) === toDateString(date);

function PlanningPage() {
  const [presences, setPresences] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { role } = useAuth();

  const [period, setPeriod] = useState("week");
  const [startDate, setStartDate] = useState(startOfDay(startOfWeek(new Date(), { weekStartsOn: 1 })));
  const [endDate, setEndDate] = useState(endOfDay(endOfWeek(new Date(), { weekStartsOn: 1 })));

  const [filterName, setFilterName] = useState("");
  const [filterBadge, setFilterBadge] = useState("");
  const [showNightHours, setShowNightHours] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: membersData, error: membersError } = await supabase.from("members").select("*");
      if (membersError) throw membersError;
      setMembers(Array.isArray(membersData) ? membersData : []);

      const { data: presencesData, error: presencesError } = await supabase
        .from("presences")
        .select("*")
        .gte("timestamp", startDate.toISOString())
        .lte("timestamp", endDate.toISOString());
      if (presencesError) throw presencesError;
      
      const transformed = presencesData.map(p => ({...p, parsedDate: parseTimestamp(p.timestamp)}));
      setPresences(transformed);

    } catch (err) {
      setError(err.message || "Erreur de chargement des données.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [startDate, endDate]);
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
  
  const { visibleMembers, groupedByMember, allDays } = useMemo(() => {
     const filteredMembersByText = members.filter(m =>
        (!filterName || `${m.name} ${m.firstName}`.toLowerCase().includes(filterName.toLowerCase())) &&
        (!filterBadge || m.badgeId?.includes(filterBadge))
    );
    
    const memberMap = new Map(filteredMembersByText.map(m => [m.badgeId, m]));
    const relevantPresences = presences.filter(p => memberMap.has(p.badgeId));
    
    const grouped = {};
    for(const p of relevantPresences) {
        if(!grouped[p.badgeId]) grouped[p.badgeId] = [];
        grouped[p.badgeId].push(p.parsedDate);
    }
    
    const visibleMemberIds = new Set(Object.keys(grouped));
    const finalVisibleMembers = filteredMembersByText.filter(m => visibleMemberIds.has(m.badgeId));
    
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return { visibleMembers: finalVisibleMembers, groupedByMember: grouped, allDays: days };
  }, [presences, members, filterName, filterBadge, startDate, endDate]);

  const stats = useMemo(() => {
    const totalPresences = presences.length;
    const uniqueMembers = new Set(presences.map(p => p.badgeId)).size;
    const avgPresencesPerDay = allDays.length > 0 ? (totalPresences / allDays.length).toFixed(1) : 0;
    return { totalPresences, uniqueMembers, avgPresencesPerDay };
  }, [presences, allDays]);
  
  const handleImportExcel = async (event) => { /* ... (code inchangé) ... */ };

  // --- VUES ---
  
  const ListView = () => (
    <div className="space-y-3">
        {visibleMembers.map((member) => {
            const memberPresences = groupedByMember[member.badgeId] || [];
            return (
                <div key={member.badgeId} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm">{member.firstName?.[0]}{member.name?.[0]}</div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base truncate">{member.name} {member.firstName}</h3>
                            <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Badge: {member.badgeId}</span>
                                <span className="bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full text-xs font-medium">{memberPresences.length} présence(s)</span>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 sm:grid-cols-14 gap-1">
                        {allDays.map((day) => {
                            const dayPresences = (groupedByMember[member.badgeId] || []).filter(p => toDateString(p) === toDateString(day));
                            const hasPresence = dayPresences.length > 0;
                            return (
                                <div key={day.toISOString()} className="relative group">
                                    <div className={cn("p-1.5 rounded text-center text-xs transition-all hover:scale-105 cursor-pointer", hasPresence ? "bg-green-500 text-white shadow-sm" : isWeekend(day) ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400")}>
                                        <div className="font-medium text-xs">{formatDate(day, 'dd')}</div>
                                        {hasPresence && <div className="text-[10px] font-bold mt-0.5">{dayPresences.length}</div>}
                                    </div>
                                    {hasPresence && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max hidden group-hover:block z-10 p-2 bg-gray-900 text-white text-xs rounded shadow-lg border border-gray-700">
                                            <div className="font-semibold mb-1">{formatDate(day, 'eeee d MMMM')}</div>
                                            {dayPresences.map((p, i) => <div key={i}>{formatDate(p, 'HH:mm')}</div>)}
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

  // --- INTERFACE PRINCIPALE ---
  
  if (loading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-full mx-auto">
        {/* En-tête */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl"><Calendar className="w-8 h-8 text-white" /></div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Planning des présences</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Visualisez les présences des membres</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-center sm:justify-end bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1 w-full sm:w-auto">
                <button onClick={() => setViewMode("list")} className={cn("p-2 rounded-md transition-all", viewMode === 'list' ? "bg-white dark:bg-gray-600 shadow-md text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200")}><List className="w-5 h-5" /></button>
                <button onClick={() => alert("Vue non implémentée")} className={cn("p-2 rounded-md transition-all", "text-gray-600 dark:text-gray-400")}><Users className="w-5 h-5" /></button>
                <button onClick={() => alert("Vue non implémentée")} className={cn("p-2 rounded-md transition-all", "text-gray-600 dark:text-gray-400")}><Grid className="w-5 h-5" /></button>
                <button onClick={() => setShowFilters(!showFilters)} className={cn("p-3 rounded-lg transition-all", showFilters ? "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400")}><Filter className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <button onClick={() => navigatePeriod("prev")} className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg"><ChevronLeft className="w-6 h-6" /></button>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <select value={period} onChange={(e) => updateDateRange(e.target.value, startDate)} className="border-2 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"><option value="week">Semaine</option><option value="month">Mois</option><option value="year">Année</option></select>
              <div className="text-center"><div className="font-bold text-lg">{formatDate(startDate, "dd MMM")} - {formatDate(endDate, "dd MMM yyyy")}</div><div className="text-sm text-gray-500">{allDays.length} jours</div></div>
            </div>
            <button onClick={() => navigatePeriod("next")} className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg"><ChevronRight className="w-6 h-6" /></button>
          </div>
        </div>

        {/* Filtres */}
        {showFilters && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Rechercher par nom</label><input type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)} className="w-full border-2 rounded-lg p-2" /></div>
              <div><label className="block text-sm font-medium mb-1">Filtrer par badge</label><input type="text" value={filterBadge} onChange={(e) => setFilterBadge(e.target.value)} className="w-full border-2 rounded-lg p-2" /></div>
            </div>
          </div>
        )}
        
        {/* Contenu principal */}
        {visibleMembers.length === 0 ? (
          <div className="text-center p-10 bg-white rounded-lg shadow">Aucune présence trouvée pour cette période ou avec ces filtres.</div>
        ) : (
          <>
            {viewMode === "list" && <ListView />}
            {/* Les autres vues peuvent être ajoutées ici */}
          </>
        )}
      </div>
    </div>
  );
}

export default PlanningPage;