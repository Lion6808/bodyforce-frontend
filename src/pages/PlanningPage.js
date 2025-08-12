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
  User,
  Plus,
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

// Classes Tailwind réutilisables
const classes = {
  // Layout
  pageContainer: "min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4",
  maxWidthWrapper: "max-w-full mx-auto",
  
  // Cards
  card: "bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700",
  headerCard: "bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700",
  
  // Buttons
  buttonPrimary: "px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2",
  buttonSecondary: "p-2 rounded-md transition-all",
  presetButton: "px-2 py-1 text-xs bg-white dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-600",
  
  // Form elements
  input: "border-2 border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100",
  select: "border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium text-sm",
  
  // Icons
  iconContainer: "p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl",
  
  // Text
  title: "text-3xl font-bold text-gray-900 dark:text-gray-100",
  subtitle: "text-gray-600 dark:text-gray-400 mt-1",
  
  // Avatar
  avatar: "w-10 h-10 object-cover rounded-full border border-blue-200 dark:border-blue-600",
  avatarInitials: "w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm",
  
  // Tooltip
  tooltip: "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none",
  tooltipContent: "bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-2 py-1.5 shadow-xl min-w-max border border-gray-700",
};

// Utilitaires
const cn = (...classes) => classes.filter(Boolean).join(' ');

// Utilitaires de date
const formatDate = (date, format) => {
  const options = {
    "yyyy-MM-dd": { year: "numeric", month: "2-digit", day: "2-digit" },
    "dd/MM/yyyy": { day: "2-digit", month: "2-digit", year: "numeric" },
    "EEE dd/MM": { weekday: "short", day: "2-digit", month: "2-digit" },
    "EEE dd": { weekday: "short", day: "2-digit" },
    "HH:mm": { hour: "2-digit", minute: "2-digit", hour12: false },
    "MMMM yyyy": { month: "long", year: "numeric" },
    "EEEE dd MMMM": { weekday: "long", day: "numeric", month: "long" }
  };

  if (format === "yyyy-MM-dd") {
    return date.toISOString().split("T")[0];
  }

  return new Intl.DateTimeFormat("fr-FR", options[format] || {}).format(date);
};

const parseTimestamp = (timestamp) => new Date(timestamp);

const toDateString = (date) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6; // Dimanche ou Samedi
};

const isWithinInterval = (date, interval) => {
  return date >= interval.start && date <= interval.end;
};

const eachDayOfInterval = (interval) => {
  const days = [];
  const current = new Date(interval.start);

  while (current <= interval.end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
};

const startOfDay = (date) => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

const endOfDay = (date) => {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

const addWeeks = (date, weeks) => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + weeks * 7);
  return newDate;
};

const addMonths = (date, months) => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
};

const addYears = (date, years) => {
  const newDate = new Date(date);
  newDate.setFullYear(newDate.getFullYear() + years);
  return newDate;
};

const subWeeks = (date, weeks) => addWeeks(date, -weeks);

const isToday = (date) => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

function PlanningPage() {
  const [presences, setPresences] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const { role } = useAuth();

  const [period, setPeriod] = useState("week");
  const [startDate, setStartDate] = useState(
    startOfDay(startOfWeek(new Date(), { weekStartsOn: 1 }))
  );
  const [endDate, setEndDate] = useState(
    endOfDay(endOfWeek(new Date(), { weekStartsOn: 1 }))
  );

  const [filterBadge, setFilterBadge] = useState("");
  const [filterName, setFilterName] = useState("");
  const [showNightHours, setShowNightHours] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // États pour la vue mensuelle
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [hoveredMember, setHoveredMember] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // REQUÊTES DIRECTES SUPABASE
  const loadData = async (showRetryIndicator = false) => {
    try {
      if (showRetryIndicator) {
        setIsRetrying(true);
      }
      setLoading(true);
      setError("");

      console.log("🔄 Chargement des données...", {
        début: startDate.toLocaleDateString(),
        fin: endDate.toLocaleDateString(),
      });

      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("*");

      if (membersError) {
        console.error("❌ Erreur membres:", membersError);
        throw new Error(`Erreur membres: ${membersError.message}`);
      }

      setMembers(Array.isArray(membersData) ? membersData : []);
      console.log("✅ Membres chargés:", membersData?.length || 0);

      let allPresences = [];
      let from = 0;
      const pageSize = 1000;
      let done = false;

      while (!done) {
        const { data, error } = await supabase
          .from("presences")
          .select("*")
          .gte("timestamp", startDate.toISOString())
          .lte("timestamp", endDate.toISOString())
          .order("timestamp", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) {
          console.error("❌ Erreur présences:", error);
          throw new Error(`Erreur présences: ${error.message}`);
        }

        if (data && data.length > 0) {
          allPresences = [...allPresences, ...data];
          from += pageSize;
        }

        if (!data || data.length < pageSize) {
          done = true;
        }
      }

      console.log("✅ Présences chargées:", allPresences.length);

      const transformedPresences = allPresences.map((p) => ({
        badgeId: p.badgeId,
        timestamp: p.timestamp,
        parsedDate: parseTimestamp(p.timestamp),
      }));

      setPresences(transformedPresences);
      setRetryCount(0);

      console.log("✅ Chargement terminé avec succès");
    } catch (error) {
      console.error("💥 Erreur lors du chargement des données:", error);
      setError(error.message || "Erreur de connexion à la base de données");
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    loadData(true);
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // CORRECTION 2: S'assurer que la période est correcte pour la vue mensuelle
  const updateDateRange = (newPeriod, baseDate = new Date()) => {
    setPeriod(newPeriod);
    let newStart, newEnd;
  
    switch (newPeriod) {
      case "week":
        newStart = startOfWeek(baseDate, { weekStartsOn: 1 });
        newEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
        break;
      case "month":
        newStart = startOfMonth(baseDate);
        newEnd = endOfMonth(baseDate);
        break;
      case "year":
        newStart = startOfYear(baseDate);
        newEnd = endOfYear(baseDate);
        break;
      default:
        newStart = startOfWeek(baseDate, { weekStartsOn: 1 });
        newEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
    }
    setStartDate(startOfDay(newStart));
    setEndDate(endOfDay(newEnd));
  };
  
  const navigatePeriod = (direction) => {
    const amount = direction === "prev" ? -1 : 1;
    let newBaseDate;
  
    if (period === "week") {
      newBaseDate = addWeeks(startDate, amount);
    } else if (period === "month") {
      newBaseDate = addMonths(startDate, amount);
    } else { // year
      newBaseDate = addYears(startDate, amount);
    }
  
    updateDateRange(period, newBaseDate);
  };

  const toLocalDate = (timestamp) => {
    return parseTimestamp(timestamp);
  };

  const handleImportExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        let count = 0;
        for (const row of rows) {
          const badgeId = row["Qui"]?.toString();
          const rawDate = row["Quand"];
          if (!badgeId || !rawDate) continue;

          const match = rawDate.match(/(\d{2})\/(\d{2})\/(\d{2})\s(\d{2}):(\d{2})/);
          if (!match) continue;

          const [, dd, mm, yy, hh, min] = match;
          const localDate = new Date(`20${yy}-${mm}-${dd}T${hh}:${min}:00`);
          const isoDate = localDate.toISOString();

          const { error } = await supabase
            .from("presences")
            .insert([{ badgeId, timestamp: isoDate }]);

          if (!error) count++;
        }

        alert(`✅ Import terminé : ${count} présences insérées.`);
        loadData();
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Erreur import Excel :", err);
      alert("❌ Erreur lors de l'import.");
    }
  };

  const renderConnectionError = () => (
    <div className={classes.pageContainer + " flex items-center justify-center"}>
      <div className={classes.card + " p-8 max-w-md w-full text-center"}>
        <AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">Problème de connexion</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">{error}</p>
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className={cn(classes.buttonPrimary, "w-full")}
        >
          {isRetrying ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" /> Reconnexion...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" /> Réessayer
            </>
          )}
        </button>
        {retryCount > 0 && <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">Tentative {retryCount + 1}</p>}
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className={classes.pageContainer + " flex items-center justify-center"}>
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <RefreshCw className="w-8 h-8 animate-spin text-white" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
          {isRetrying ? "Reconnexion en cours..." : "Chargement du planning..."}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Période: {formatDate(startDate, "dd/MM/yyyy")} - {formatDate(endDate, "dd/MM/yyyy")}
        </p>
      </div>
    </div>
  );

  if (loading) return renderLoading();
  if (error && !isRetrying) return renderConnectionError();

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

  const visibleMembers = Object.keys(groupedByMember)
    .map((badgeId) => getMemberInfo(badgeId))
    .filter(
      (m) =>
        (!filterName ||
          `${m.name} ${m.firstName}`
            .toLowerCase()
            .includes(filterName.toLowerCase())) &&
        (!filterBadge || m.badgeId?.includes(filterBadge))
    );

  const calculateStats = () => {
    const totalPresences = filteredPresences.length;
    const uniqueMembers = new Set(filteredPresences.map(p => p.badgeId)).size;
    const dailyAverages = {};

    allDays.forEach(day => {
      const dayKey = toDateString(day);
      const dayPresences = filteredPresences.filter(p =>
        toDateString(p.parsedDate) === dayKey
      );
      dailyAverages[dayKey] = {
        presences: dayPresences.length,
        members: new Set(dayPresences.map(p => p.badgeId)).size
      };
    });

    const avgMembersPerDay = allDays.length > 0 ? Object.values(dailyAverages)
      .reduce((sum, day) => sum + day.members, 0) / allDays.length : 0;

    const busiestDay = Object.entries(dailyAverages)
      .reduce((max, [day, stats]) =>
        stats.members > max.members ? { day, ...stats } : max,
        { day: '', members: 0, presences: 0 }
      );

    return {
      totalPresences,
      uniqueMembers,
      avgMembersPerDay: Math.round(avgMembersPerDay * 10) / 10,
      busiestDay
    };
  };
  const stats = calculateStats();
  
  const StatsResume = () => (
    <div className={cn(classes.card, "p-6 mb-6")}>
      <div className="flex items-center gap-3 mb-6">
        <div className={classes.iconContainer}><BarChart3 className="w-6 h-6 text-white" /></div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Résumé de la période</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{formatDate(startDate, "dd/MM/yyyy")} - {formatDate(endDate, "dd/MM/yyyy")}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Blocs de stats ici... */}
      </div>
    </div>
  );

  // CORRECTION 3: L'ancienne vue liste, recréée en Tailwind pur
  const ListView = () => (
    <div className="space-y-4">
      {visibleMembers.map((member) => {
        const memberPresences = groupedByMember[member.badgeId] || [];
        
        return (
          <div key={member.badgeId} className={cn(classes.card, "p-4")}>
            {/* En-tête du membre */}
            <div className="flex items-center gap-3 mb-4">
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt="avatar" className={classes.avatar} />
              ) : (
                <div className={classes.avatarInitials}>
                  {member.firstName?.[0] || ''}{member.name?.[0] || ''}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {member.name} {member.firstName}
                </h3>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>Badge: {member.badgeId}</span>
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full font-medium">
                    {memberPresences.length} présence(s)
                  </span>
                </div>
              </div>
            </div>

            {/* Grille des jours */}
            <div className="grid grid-cols-7 md:grid-cols-14 lg:grid-cols-21 gap-1.5">
              {allDays.map((day) => {
                const dayKey = toDateString(day);
                const dayTimes = memberPresences.filter(t => toDateString(t) === dayKey);
                const hasPresence = dayTimes.length > 0;

                return (
                  <div key={day.toISOString()} className="relative group">
                    <div className={cn(
                      "p-2 rounded text-center cursor-pointer transition-all duration-200 hover:scale-105",
                      hasPresence && "bg-green-500 text-white shadow",
                      !hasPresence && isWeekend(day) && "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
                      !hasPresence && !isWeekend(day) && "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    )}>
                      <div className="font-bold text-sm">{day.getDate()}</div>
                      {hasPresence && <div className="text-[10px] font-bold mt-0.5">{dayTimes.length}</div>}
                    </div>
                    
                    {/* Tooltip pour les jours de présence */}
                    {hasPresence && (
                      <div className={cn(classes.tooltip)}>
                        <div className={cn(classes.tooltipContent)}>
                          <div className="font-semibold mb-1">{formatDate(day, "EEE dd/MM")}</div>
                          <div className="space-y-0.5">
                            {dayTimes.slice(0, 5).map((time, idx) => (
                              <div key={idx} className="text-xs font-mono">{formatDate(time, "HH:mm")}</div>
                            ))}
                            {dayTimes.length > 5 && <div className="text-xs opacity-75 mt-1">+{dayTimes.length - 5} autres</div>}
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
  );
  
  const CompactView = () => (
    <div className={cn(classes.card, "overflow-hidden")}>
        {/* ... L'implémentation de la vue compacte est conservée ... */}
    </div>
  );

  // Vue Mensuelle - AVEC CORRECTIONS
  const MonthlyView = () => {
    const generateCalendarDays = () => {
      const year = startDate.getFullYear();
      const month = startDate.getMonth();
      const firstDayOfMonth = new Date(year, month, 1);
      const startCalendar = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 }); // Commence le lundi
      
      const days = [];
      let current = new Date(startCalendar);
      for (let i = 0; i < 42; i++) { // 6 semaines pour un calendrier complet
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      return days;
    };
    
    const calendarDays = generateCalendarDays();
    const presencesByDayAndMember = (() => {
        const grouped = {};
        filteredPresences.forEach(p => {
            const dateKey = toDateString(p.parsedDate);
            if (!grouped[dateKey]) grouped[dateKey] = {};
            if (!grouped[dateKey][p.badgeId]) grouped[dateKey][p.badgeId] = [];
            grouped[dateKey][p.badgeId].push(p);
        });
        return grouped;
    })();

    const toggleDayExpansion = (dayKey) => {
        const newSet = new Set(expandedDays);
        if (newSet.has(dayKey)) newSet.delete(dayKey);
        else newSet.add(dayKey);
        setExpandedDays(newSet);
    };

    // CORRECTION 1: Simplification de la gestion du tooltip
    const handleMemberMouseEnter = (badgeId, dayKey, event) => {
        const member = members.find(m => m.badgeId === badgeId);
        const memberPresences = presencesByDayAndMember[dayKey]?.[badgeId] || [];
        
        const rect = event.currentTarget.getBoundingClientRect();
        setTooltipPosition({ 
            x: rect.left + rect.width / 2, 
            y: rect.top 
        });
        
        setHoveredMember({ member, presences: memberPresences, dayKey });
    };

    const handleMouseLeave = () => {
        setHoveredMember(null);
    };

    const renderMemberAvatar = (badgeId, presenceCount, dayKey, index) => {
        const member = members.find(m => m.badgeId === badgeId);
        if (!member) return null;
        const avatarSize = 'w-8 h-8';
        const textSize = 'text-xs';
        
        return (
          <div
            key={badgeId}
            className="relative group cursor-pointer"
            onMouseEnter={(e) => handleMemberMouseEnter(badgeId, dayKey, e)}
            onMouseLeave={handleMouseLeave}
            style={{ zIndex: index + 10 }}
          >
            {member.avatarUrl ? (
              <img src={member.avatarUrl} alt="avatar" className={`${avatarSize} object-cover rounded-full border-2 border-white dark:border-gray-800 shadow-sm hover:shadow-md transform hover:scale-110 transition-all`}/>
            ) : (
              <div className={`${avatarSize} bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold ${textSize} border-2 border-white dark:border-gray-800 shadow-sm hover:shadow-md transform hover:scale-110 transition-all`}>
                {member.firstName?.[0]}{member.name?.[0]}
              </div>
            )}
            {presenceCount > 1 && (
              <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[8px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center border border-white dark:border-gray-800 shadow-sm animate-pulse">
                {presenceCount > 9 ? '9+' : presenceCount}
              </div>
            )}
          </div>
        );
    };

    const renderTooltip = () => {
        if (!hoveredMember) return null;
        const { member, presences, dayKey } = hoveredMember;
        const day = new Date(dayKey + 'T00:00:00');
        
        return (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: 'translate(-50%, -105%)' // Positionne au-dessus et centré
            }}
          >
            <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-xl shadow-2xl p-4 min-w-[280px] border border-gray-700">
                {/* ... Contenu du tooltip ... */}
                 <div className="flex items-center gap-3 mb-3">
                    {member?.avatarUrl ? (
                        <img src={member.avatarUrl} alt="avatar" className="w-12 h-12 object-cover rounded-full border-2 border-blue-400" />
                    ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            {member?.firstName?.[0]}{member?.name?.[0]}
                        </div>
                    )}
                    <div>
                        <h4 className="font-bold text-lg text-white">{member?.name} {member?.firstName}</h4>
                        <p className="text-blue-300 text-sm">Badge: {member?.badgeId}</p>
                    </div>
                </div>
            </div>
          </div>
        );
    };

    return (
        <div className={cn(classes.card, "overflow-hidden")}>
            {/* ... Le reste de la vue mensuelle ... */}
            {renderTooltip()}
        </div>
    );
};


  return (
    <div className={classes.pageContainer}>
      <div className={classes.maxWidthWrapper}>
        {/* En-tête */}
        <div className={classes.headerCard}>
            {/* ... code de l'en-tête, des filtres, etc. ... */}
             <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                {/* ... */}
             </div>

             {/* Navigation période */}
             <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <button onClick={() => navigatePeriod("prev")} className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors shadow-sm"><ChevronLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" /></button>
                <div className="flex items-center gap-4">
                    <select
                        className={classes.select}
                        value={period}
                        onChange={(e) => updateDateRange(e.target.value, startDate)}
                    >
                        <option value="week">Semaine</option>
                        <option value="month">Mois</option>
                        <option value="year">Année</option>
                    </select>
                    <div className="text-center">
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {viewMode === 'monthly' ? formatDate(startDate, "MMMM yyyy") : `${formatDate(startDate, "dd/MM/yyyy")} - ${formatDate(endDate, "dd/MM/yyyy")}`}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{allDays.length} jours</div>
                    </div>
                </div>
                <button onClick={() => navigatePeriod("next")} className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors shadow-sm"><ChevronRight className="w-6 h-6 text-gray-600 dark:text-gray-400" /></button>
            </div>
        </div>

        {showFilters && (
           <div className={classes.card + " p-6 mb-6"}>
              {/* ... Filtres ... */}
           </div>
        )}

        <StatsResume />

        {visibleMembers.length === 0 ? (
          <div className={cn(classes.card, "p-12 text-center")}>
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-12 h-12 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Aucune présence trouvée</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Essayez d'ajuster la période ou les filtres.</p>
            <button onClick={handleRetry} className={cn(classes.buttonPrimary, "mx-auto")}>
              <RefreshCw className="w-4 h-4" /> Recharger
            </button>
          </div>
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