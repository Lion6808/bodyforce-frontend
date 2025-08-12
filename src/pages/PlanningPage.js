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
  return day === 0 || day === 6;
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
    startOfDay(subWeeks(new Date(), 1))
  );
  const [endDate, setEndDate] = useState(endOfDay(new Date()));

  const [filterBadge, setFilterBadge] = useState("");
  const [filterName, setFilterName] = useState("");
  const [showNightHours, setShowNightHours] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // États pour la vue mensuelle
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [hoveredMember, setHoveredMember] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

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

      // Chargement des membres
      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("*");

      if (membersError) {
        console.error("❌ Erreur membres:", membersError);
        throw new Error(`Erreur membres: ${membersError.message}`);
      }

      setMembers(Array.isArray(membersData) ? membersData : []);
      console.log("✅ Membres chargés:", membersData?.length || 0);

      // Chargement des présences FILTRÉ par période
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

      // Transformation avec parsing des timestamps
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

  // Recharger quand la période change
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

  const updateDateRange = (value, base = new Date()) => {
    const start = startOfDay(base);
    let end = endOfDay(base);
    if (value === "week") end = endOfDay(addWeeks(start, 1));
    if (value === "month") end = endOfDay(addMonths(start, 1));
    if (value === "year") end = endOfDay(addYears(start, 1));
    setStartDate(start);
    setEndDate(end);
  };

  const navigatePeriod = (direction) => {
    const amount = direction === "prev" ? -1 : 1;
    let newStart;

    if (period === "week") {
      newStart = addWeeks(startDate, amount);
    } else if (period === "month") {
      newStart = addMonths(startDate, amount);
    } else {
      newStart = addYears(startDate, amount);
    }

    updateDateRange(period, newStart);
  };

  const toLocalDate = (timestamp) => {
    return parseTimestamp(timestamp);
  };

  // Import Excel
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

  // Écrans de chargement et d'erreur
  const renderConnectionError = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center border border-gray-200 dark:border-gray-700">
        <AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
          Problème de connexion
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">{error}</p>
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
          Période: {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
        </p>
      </div>
    </div>
  );

  if (loading) return renderLoading();
  if (error && !isRetrying) return renderConnectionError();

  // Filtrage des données
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

  // Calcul des statistiques pour le résumé
  const calculateStats = () => {
    const totalPresences = filteredPresences.length;
    const uniqueMembers = new Set(filteredPresences.map(p => p.badgeId)).size;
    const dailyAverages = {};

    // Calcul par jour
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

    const avgPresencesPerDay = Object.values(dailyAverages)
      .reduce((sum, day) => sum + day.presences, 0) / allDays.length;

    const avgMembersPerDay = Object.values(dailyAverages)
      .reduce((sum, day) => sum + day.members, 0) / allDays.length;

    // Jour le plus chargé
    const busiestDay = Object.entries(dailyAverages)
      .reduce((max, [day, stats]) =>
        stats.members > max.members ? { day, ...stats } : max,
        { day: '', members: 0, presences: 0 }
      );

    return {
      totalPresences,
      uniqueMembers,
      avgPresencesPerDay: Math.round(avgPresencesPerDay * 10) / 10,
      avgMembersPerDay: Math.round(avgMembersPerDay * 10) / 10,
      busiestDay
    };
  };

  const stats = calculateStats();

  // Composant Résumé des statistiques
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
            {formatDate(startDate, "dd/MM/yyyy")} - {formatDate(endDate, "dd/MM/yyyy")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Membres actifs</span>
          </div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.uniqueMembers}</div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-xs font-medium text-green-700 dark:text-green-400">Total présences</span>
          </div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.totalPresences}</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-medium text-purple-700 dark:text-purple-400">Moy./jour</span>
          </div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.avgMembersPerDay}</div>
          <div className="text-xs text-purple-600 dark:text-purple-400">membres</div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <span className="text-xs font-medium text-orange-700 dark:text-orange-400">Jours couverts</span>
          </div>
          <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">{allDays.length}</div>
        </div>

        {stats.busiestDay.day && (
          <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg p-4 border border-red-200 dark:border-red-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-xs font-medium text-red-700 dark:text-red-400">Jour pic</span>
            </div>
            <div className="text-lg font-bold text-red-900 dark:text-red-100">{stats.busiestDay.members}</div>
            <div className="text-xs text-red-600 dark:text-red-400">
              {new Date(stats.busiestDay.day).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Vue Liste
  const ListView = () => (
    <div className={cn(classes.card, "overflow-hidden")}>
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Planning des présences ({visibleMembers.length} membres)
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {stats.totalPresences} présences sur {allDays.length} jours
        </p>
      </div>
      
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {visibleMembers.map((member, idx) => {
          const times = groupedByMember[member.badgeId] || [];
          
          return (
            <div key={member.badgeId || idx} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={`${member.name} ${member.firstName}`}
                      className={classes.avatar}
                    />
                  ) : (
                    <div className={classes.avatarInitials}>
                      {member.firstName?.[0] || ''}
                      {member.name?.[0] || ''}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {member.name} {member.firstName}
                    </h3>
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full font-medium">
                      Badge {member.badgeId}
                    </span>
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full font-medium">
                      {times.length} présences
                    </span>
                  </div>
                  
                  {times.length > 0 ? (
                    <div className="space-y-3">
                      {allDays.map((day) => {
                        const dayTimes = times.filter((t) => {
                          const tDateStr = toDateString(t);
                          const dayDateStr = toDateString(day);
                          return tDateStr === dayDateStr;
                        });
                        
                        if (dayTimes.length === 0) return null;
                        
                        return (
                          <div key={day.toISOString()} className="flex items-center gap-3">
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[100px]">
                              {formatDate(day, "EEE dd/MM")}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {dayTimes.map((time, tidx) => (
                                <span
                                  key={tidx}
                                  className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded font-mono"
                                >
                                  {formatDate(time, "HH:mm")}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                      Aucune présence sur cette période
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Vue Compacte 
  const CompactView = () => (
    <div className={cn(classes.card, "overflow-hidden")}>
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
          {/* En-tête des jours */}
          <div className="grid" style={{gridTemplateColumns: `200px repeat(${allDays.length}, 80px)`}}>
            <div className="p-3 font-semibold text-gray-900 dark:text-gray-100 border-r border-b-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
              Membre
            </div>
            {allDays.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "p-2 text-center border-r border-b-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700",
                  isToday(day) && "bg-blue-100 dark:bg-blue-900/30",
                  isWeekend(day) && !isToday(day) && "bg-blue-50 dark:bg-blue-900/10"
                )}
              >
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {formatDate(day, "EEE dd")}
                </div>
              </div>
            ))}
          </div>

          {/* Lignes des membres */}
          {visibleMembers.map((member, idx) => {
            const times = groupedByMember[member.badgeId] || [];
            
            return (
              <div
                key={member.badgeId || idx}
                className="grid hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                style={{gridTemplateColumns: `200px repeat(${allDays.length}, 80px)`}}
              >
                <div className="p-3 border-r border-b border-gray-200 dark:border-gray-600 flex items-center gap-3 bg-white dark:bg-gray-800">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={`${member.name} ${member.firstName}`}
                      className="w-8 h-8 object-cover rounded-full border border-blue-200 dark:border-blue-600"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {member.firstName?.[0] || ''}
                      {member.name?.[0] || ''}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100">
                      {member.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {member.firstName}
                    </div>
                  </div>
                </div>
                
                {allDays.map((day) => {
                  const dayTimes = times.filter((t) => {
                    const tDateStr = toDateString(t);
                    const dayDateStr = toDateString(day);
                    return tDateStr === dayDateStr;
                  });
                  
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
    </div>
  );

  // Vue Mensuelle - NOUVELLE VERSION avec avatars et tooltips
  const MonthlyView = () => {
    // Génération du calendrier mensuel
    const generateCalendarDays = () => {
      const year = startDate.getFullYear();
      const month = startDate.getMonth();
      
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startCalendar = new Date(firstDay);
      startCalendar.setDate(startCalendar.getDate() - firstDay.getDay() + 1); // Commencer le lundi
      
      const days = [];
      const current = new Date(startCalendar);
      
      // Générer 6 semaines (42 jours) pour avoir un calendrier complet
      for (let i = 0; i < 42; i++) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      
      return days;
    };

    const calendarDays = generateCalendarDays();

    // Grouper les présences par jour et par membre
    const groupPresencesByDayAndMember = () => {
      const grouped = {};
      
      filteredPresences.forEach(presence => {
        const date = parseTimestamp(presence.timestamp);
        const dateKey = toDateString(date);
        
        if (!grouped[dateKey]) {
          grouped[dateKey] = {};
        }
        
        if (!grouped[dateKey][presence.badgeId]) {
          grouped[dateKey][presence.badgeId] = [];
        }
        
        grouped[dateKey][presence.badgeId].push({
          ...presence,
          parsedDate: date
        });
      });
      
      return grouped;
    };

    const presencesByDayAndMember = groupPresencesByDayAndMember();

    // Gestion de l'expansion des jours avec beaucoup de membres
    const toggleDayExpansion = (dayKey) => {
      const newExpandedDays = new Set(expandedDays);
      if (newExpandedDays.has(dayKey)) {
        newExpandedDays.delete(dayKey);
      } else {
        newExpandedDays.add(dayKey);
      }
      setExpandedDays(newExpandedDays);
    };

    const handleMemberMouseEnter = (badgeId, dayKey, event) => {
      const member = members.find(m => m.badgeId === badgeId);
      const memberPresences = presencesByDayAndMember[dayKey]?.[badgeId] || [];
      
      const rect = event.currentTarget.getBoundingClientRect();
      setMousePosition({ 
        x: rect.left + rect.width / 2, 
        y: rect.top 
      });
      
      setHoveredMember({
        member,
        presences: memberPresences,
        dayKey
      });
    };

    const handleMouseMove = (event) => {
      if (hoveredMember) {
        const rect = event.currentTarget.getBoundingClientRect();
        setMousePosition({ 
          x: rect.left + rect.width / 2, 
          y: rect.top 
        });
      }
    };

    const handleMouseLeave = () => {
      setHoveredMember(null);
    };

    // Rendu d'un mini-avatar de membre avec compteur
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
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ zIndex: index + 10 }}
        >
          {/* Avatar */}
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt="avatar"
              className={`${avatarSize} object-cover rounded-full border-2 border-white dark:border-gray-800 
                         shadow-sm hover:shadow-md transform hover:scale-110 transition-all duration-200`}
            />
          ) : (
            <div className={`${avatarSize} bg-gradient-to-br from-blue-500 to-purple-600 rounded-full 
                            flex items-center justify-center text-white font-bold ${textSize}
                            border-2 border-white dark:border-gray-800 shadow-sm hover:shadow-md 
                            transform hover:scale-110 transition-all duration-200`}>
              {member.firstName?.[0]}{member.name?.[0]}
            </div>
          )}
          
          {/* Compteur UNIQUEMENT si passages multiples */}
          {presenceCount > 1 && (
            <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[8px] font-bold 
                           rounded-full min-w-[16px] h-4 flex items-center justify-center 
                           border border-white dark:border-gray-800 shadow-sm animate-pulse">
              {presenceCount > 99 ? '99+' : presenceCount}
            </div>
          )}
        </div>
      );
    };

    // Tooltip optimisé avec positionnement corrigé
    const renderTooltip = () => {
      if (!hoveredMember) return null;

      const { member, presences, dayKey } = hoveredMember;
      const day = new Date(dayKey + 'T00:00:00');
      const isMultiplePassages = presences.length > 1;
      
      return (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: mousePosition.x,
            top: mousePosition.y - 10,
            transform: 'translateX(-50%) translateY(-100%)'
          }}
        >
          <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-xl shadow-2xl p-4 min-w-[280px] max-w-[320px] border border-gray-700 dark:border-gray-600">
            {/* En-tête avec photo et nom */}
            <div className="flex items-center gap-3 mb-3">
              {member?.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt="avatar"
                  className="w-12 h-12 object-cover rounded-full border-2 border-blue-400"
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {member?.firstName?.[0]}{member?.name?.[0]}
                </div>
              )}
              <div>
                <h4 className="font-bold text-lg text-white">
                  {member?.name} {member?.firstName}
                </h4>
                <p className="text-blue-300 text-sm">Badge: {member?.badgeId}</p>
              </div>
            </div>
            
            {/* Informations du jour */}
            <div className="space-y-2 border-t border-gray-700 pt-3 mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span className="text-sm">{formatDate(day, "EEEE dd MMMM")}</span>
              </div>
              
              {/* Cas standard : 1 passage */}
              {!isMultiplePassages ? (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-400" />
                  <span className="text-sm">Passage à {formatDate(presences[0].parsedDate, "HH:mm")}</span>
                </div>
              ) : (
                /* Cas exceptionnel : passages multiples */
                <>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-semibold text-orange-300">
                      ⚠️ {presences.length} passages (inhabituel)
                    </span>
                  </div>
                  
                  {/* Liste des heures pour les cas multiples */}
                  <div className="mt-2">
                    <div className="text-xs text-gray-300 mb-1">Heures de passage :</div>
                    <div className="flex flex-wrap gap-1">
                      {presences.slice(0, 6).map((presence, index) => (
                        <div
                          key={index}
                          className="bg-orange-600 bg-opacity-30 text-orange-300 px-2 py-1 rounded text-xs border border-orange-500 border-opacity-30"
                        >
                          {formatDate(presence.parsedDate, "HH:mm")}
                        </div>
                      ))}
                      {presences.length > 6 && (
                        <div className="bg-gray-600 bg-opacity-30 text-gray-300 px-2 py-1 rounded text-xs border border-gray-500 border-opacity-30">
                          +{presences.length - 6}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Badge de statut */}
            <div className="flex justify-between items-center">
              <span className="px-2 py-1 bg-green-500 bg-opacity-20 text-green-400 text-xs rounded-full border border-green-500 border-opacity-30">
                Présent(e)
              </span>
              {isMultiplePassages && (
                <span className="text-xs text-orange-400 font-medium">
                  Vérifier badge
                </span>
              )}
            </div>

            {/* Flèche du tooltip */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* En-tête du calendrier */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigatePeriod('prev')}
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
              onClick={() => navigatePeriod('next')}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Jours de la semaine */}
        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day, index) => (
            <div
              key={day}
              className={`p-4 text-center font-semibold text-sm border-r border-gray-200 dark:border-gray-600 last:border-r-0
                         ${index >= 5 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendrier */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, dayIndex) => {
            const dateKey = toDateString(day);
            const dayMemberPresences = presencesByDayAndMember[dateKey] || {};
            const memberIds = Object.keys(dayMemberPresences);
            const totalPresences = Object.values(dayMemberPresences).reduce((sum, presences) => sum + presences.length, 0);
            const isCurrentMonth = day.getMonth() === startDate.getMonth();
            const isWeekendDay = isWeekend(day);
            const isTodayDay = isToday(day);
            const isExpanded = expandedDays.has(dateKey);
            
            // Gestion intelligente de l'affichage selon le nombre de membres
            let visibleMembers, hiddenMembersCount, showExpandButton;
            
            if (memberIds.length <= 9) {
              // Cas normal : ≤9 membres, on affiche tout
              visibleMembers = memberIds;
              hiddenMembersCount = 0;
              showExpandButton = false;
            } else if (memberIds.length <= 20) {
              // Cas moyen : 10-20 membres
              if (isExpanded) {
                visibleMembers = memberIds; // Tout afficher en mode étendu
                hiddenMembersCount = 0;
                showExpandButton = true;
              } else {
                visibleMembers = memberIds.slice(0, 6); // Afficher 6 + bouton d'expansion
                hiddenMembersCount = memberIds.length - 6;
                showExpandButton = true;
              }
            } else {
              // Cas intense : >20 membres
              if (isExpanded) {
                visibleMembers = memberIds.slice(0, 30); // Max 30 même en étendu
                hiddenMembersCount = Math.max(0, memberIds.length - 30);
                showExpandButton = true;
              } else {
                visibleMembers = memberIds.slice(0, 6); // 6 + indicateur
                hiddenMembersCount = memberIds.length - 6;
                showExpandButton = true;
              }
            }
            
            return (
              <div
                key={dayIndex}
                className={`${isExpanded ? 'min-h-[200px]' : 'min-h-[140px]'} border-r border-b border-gray-200 dark:border-gray-600 last:border-r-0 p-2 relative
                           ${!isCurrentMonth ? 'bg-gray-50 dark:bg-gray-700 opacity-50' : ''}
                           ${isWeekendDay ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-white dark:bg-gray-800'}
                           ${isTodayDay ? 'ring-2 ring-blue-500 ring-inset' : ''}
                           ${isExpanded ? 'bg-blue-25 dark:bg-blue-900/5' : ''}
                           hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200`}
              >
                {/* En-tête du jour */}
                <div className="flex justify-between items-start mb-2">
                  <span
                    className={`text-sm font-semibold
                               ${!isCurrentMonth ? 'text-gray-400 dark:text-gray-500' : 
                                 isTodayDay ? 'text-blue-600 dark:text-blue-400' :
                                 isWeekendDay ? 'text-blue-600 dark:text-blue-400' : 
                                 'text-gray-900 dark:text-gray-100'}`}
                  >
                    {day.getDate()}
                  </span>
                  
                  {/* Compteur total avec indicateur de densité */}
                  {totalPresences > 0 && (
                    <div className="flex items-center gap-1">
                      <span className={`text-xs px-2 py-1 rounded-full font-bold
                                     ${memberIds.length > 30 ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
                                       memberIds.length > 15 ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' :
                                       'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'}`}>
                        {memberIds.length > 99 ? '99+' : memberIds.length}
                      </span>
                      {memberIds.length > 20 && (
                        <span className="text-[10px] text-red-500 dark:text-red-400 font-bold">🔥</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Grille des avatars de membres - Adaptive selon le volume */}
                {memberIds.length > 0 && (
                  <div className="space-y-1">
                    {isExpanded && memberIds.length > 20 ? (
                      // Mode étendu pour gros volumes : grille dense 6 colonnes
                      <div className="grid grid-cols-6 gap-0.5">
                        {visibleMembers.map((badgeId, index) => (
                          <div key={badgeId} className="flex justify-center">
                            {renderMemberAvatar(badgeId, dayMemberPresences[badgeId].length, dateKey, index)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      // Mode normal : grille 3x3 lisible
                      <>
                        {/* Première ligne - jusqu'à 3 membres */}
                        <div className="flex justify-start gap-1 flex-wrap">
                          {visibleMembers.slice(0, 3).map((badgeId, index) => 
                            renderMemberAvatar(badgeId, dayMemberPresences[badgeId].length, dateKey, index)
                          )}
                        </div>
                        
                        {/* Deuxième ligne - 3 membres supplémentaires */}
                        {visibleMembers.length > 3 && (
                          <div className="flex justify-start gap-1 flex-wrap">
                            {visibleMembers.slice(3, 6).map((badgeId, index) => 
                              renderMemberAvatar(badgeId, dayMemberPresences[badgeId].length, dateKey, index + 3)
                            )}
                          </div>
                        )}
                        
                        {/* Troisième ligne - 3 derniers membres */}
                        {visibleMembers.length > 6 && (
                          <div className="flex justify-start gap-1 flex-wrap">
                            {visibleMembers.slice(6, 9).map((badgeId, index) => 
                              renderMemberAvatar(badgeId, dayMemberPresences[badgeId].length, dateKey, index + 6)
                            )}
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Boutons d'action */}
                    <div className="flex justify-center gap-1 mt-1">
                      {/* Indicateur membres cachés */}
                      {hiddenMembersCount > 0 && !showExpandButton && (
                        <div className="w-8 h-8 bg-gray-400 dark:bg-gray-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-sm">
                          <span className="text-xs text-white font-bold">+{hiddenMembersCount}</span>
                        </div>
                      )}
                      
                      {/* Bouton d'expansion/collapse */}
                      {showExpandButton && (
                        <button
                          onClick={() => toggleDayExpansion(dateKey)}
                          className={`px-2 py-1 rounded-full text-[10px] font-bold transition-all transform hover:scale-105
                                     ${isExpanded 
                                       ? 'bg-blue-500 text-white' 
                                       : memberIds.length > 30 
                                         ? 'bg-red-500 text-white animate-pulse' 
                                         : 'bg-orange-500 text-white'}`}
                          title={isExpanded ? 'Réduire' : `Voir les ${memberIds.length} membres`}
                        >
                          {isExpanded ? (
                            <span>−</span>
                          ) : (
                            <span>+{hiddenMembersCount}</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Indicateur aujourd'hui */}
                {isTodayDay && (
                  <div className="absolute top-1 right-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Légende */}
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
              <button className="px-2 py-1 bg-orange-500 text-white rounded-full text-[10px] font-bold">
                +44
              </button>
              <span>Cliquer pour voir plus</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full font-bold bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                50 🔥
              </span>
              <span>Journée très chargée</span>
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {renderTooltip()}
      </div>
    );
  };

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

            {/* Boutons de vue + filtre */}
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

              {!isMobile && (
                <button
                  onClick={() => setViewMode("monthly")}
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

            {/* Import Excel pour admin */}
            {role === "admin" && (
              <div className="mt-4">
                <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition">
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={handleImportExcel}
                    className="hidden"
                  />
                  📁 Importer fichier Excel (.xlsx)
                </label>
              </div>
            )}
          </div>

          {/* Navigation période */}
          <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
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
                    const newStartDate = new Date(e.target.value);
                    setStartDate(startOfDay(newStartDate));
                    if (period === "week") {
                      setEndDate(endOfDay(addWeeks(newStartDate, 1)));
                    } else if (period === "month") {
                      setEndDate(endOfDay(addMonths(newStartDate, 1)));
                    } else {
                      setEndDate(endOfDay(addYears(newStartDate, 1)));
                    }
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
                  updateDateRange(value, startDate);
                }}
              >
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
                <option value="year">Année</option>
              </select>

              <div className="text-center min-w-0">
                <div className="text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                  {formatDate(startDate, "dd/MM/yyyy")} - {formatDate(endDate, "dd/MM/yyyy")}
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

          {/* Presets rapides */}
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
                }}
                className={classes.presetButton}
              >
                Aujourd'hui
              </button>

              <button
                onClick={() => {
                  const today = new Date();
                  setStartDate(startOfDay(new Date(today.setDate(today.getDate() - 6))));
                  setEndDate(endOfDay(new Date()));
                }}
                className={classes.presetButton}
              >
                7 derniers jours
              </button>

              <button
                onClick={() => {
                  const today = new Date();
                  setStartDate(startOfDay(new Date(today.setDate(today.getDate() - 29))));
                  setEndDate(endOfDay(new Date()));
                }}
                className={classes.presetButton}
              >
                30 derniers jours
              </button>

              <button
                onClick={() => {
                  setStartDate(startOfDay(startOfWeek(new Date(), { weekStartsOn: 1 })));
                  setEndDate(endOfDay(endOfWeek(new Date(), { weekStartsOn: 1 })));
                }}
                className={classes.presetButton}
              >
                Cette Semaine
              </button>

              <button
                onClick={() => {
                  setStartDate(startOfDay(startOfMonth(new Date())));
                  setEndDate(endOfDay(endOfMonth(new Date())));
                }}
                className={classes.presetButton}
              >
                Ce Mois
              </button>

              <button
                onClick={() => {
                  setStartDate(startOfDay(startOfYear(new Date())));
                  setEndDate(endOfDay(endOfYear(new Date())));
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
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className={cn(classes.input, "w-full placeholder-gray-500 dark:placeholder-gray-400")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Filtrer par badge
                </label>
                <input
                  type="text"
                  placeholder="Numéro de badge..."
                  value={filterBadge}
                  onChange={(e) => setFilterBadge(e.target.value)}
                  className={cn(classes.input, "w-full placeholder-gray-500 dark:placeholder-gray-400")}
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
                  <span className="text-gray-700 dark:text-gray-300">Afficher 00h - 06h</span>
                </label>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className={cn(classes.buttonPrimary, "w-full")}
                >
                  <RefreshCw className={cn("w-4 h-4", isRetrying && "animate-spin")} />
                  Actualiser
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Résumé des statistiques */}
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
              Aucune présence n'a été enregistrée sur cette période ou avec ces filtres.
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
      </div>
    </div>
  );
}

export default PlanningPage;