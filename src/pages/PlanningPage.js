import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import * as XLSX from "xlsx";
import styles from "./PlanningPage.module.css";

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

// Utilitaires de date corrigés
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
    <div className={styles.statusPageContainer}>
      <div className={styles.statusCard}>
        <AlertCircle className={styles.errorIcon} />
        <h2 className={styles.statusCardTitle}>Problème de connexion</h2>
        <p className={styles.statusCardText}>{error}</p>
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className={styles.statusButton}
        >
          {isRetrying ? (
            <>
              <RefreshCw className={`${styles.statusButtonIcon} ${styles.statusButtonIconSpin}`} />
              Reconnexion...
            </>
          ) : (
            <>
              <RefreshCw className={styles.statusButtonIcon} />
              Réessayer
            </>
          )}
        </button>
        {retryCount > 0 && (
          <p className={styles.retryCountText}>Tentative {retryCount + 1}</p>
        )}
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingContent}>
        <div className={styles.loadingSpinnerContainer}>
          <RefreshCw className={styles.loadingSpinner} />
        </div>
        <h2 className={styles.loadingTitle}>
          {isRetrying ? "Reconnexion en cours..." : "Chargement du planning..."}
        </h2>
        <p className={styles.loadingSubtitle}>
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

  // Vue liste pour mobile (conservée)
  const ListView = () => (
    <div className={styles.listViewContainer}>
      {visibleMembers.map((member) => {
        const memberPresences = groupedByMember[member.badgeId] || [];
        const dailyPresences = {};

        memberPresences.forEach((timestamp) => {
          const dayKey = toDateString(timestamp);
          if (!dailyPresences[dayKey]) dailyPresences[dayKey] = [];
          dailyPresences[dayKey].push(timestamp);
        });

        const totalPresencesInPeriod = memberPresences.length;

        return (
          <div key={member.badgeId} className={styles.memberCardList}>
            <div className={styles.memberHeaderList}>
              {member.photo ? (
                <img
                  src={member.photo}
                  alt="avatar"
                  className={styles.memberAvatar}
                />
              ) : (
                <div className={styles.memberInitials}>
                  {member.firstName?.[0]}
                  {member.name?.[0]}
                </div>
              )}
              <div className={styles.memberInfoList}>
                <h3 className={styles.memberNameList}>
                  {member.name} {member.firstName}
                </h3>
                <div className={styles.memberMetaList}>
                  <span className={styles.memberBadgeId}>
                    Badge: {member.badgeId}
                  </span>
                  <span className={styles.memberPresenceCount}>
                    {totalPresencesInPeriod} présence(s)
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.daysGridList}>
              {allDays.map((day) => {
                const dayKey = toDateString(day);
                const dayPresences = dailyPresences[dayKey] || [];
                const hasPresences = dayPresences.length > 0;

                return (
                  <div key={dayKey} className={styles.dayCellList}>
                    <div
                      className={`${styles.dayCellContent} ${
                        hasPresences
                          ? styles.dayCellPresent
                          : isWeekend(day)
                          ? styles.dayCellWeekend
                          : styles.dayCellNormal
                      }`}
                    >
                      <div className={styles.dayCellDate}>
                        {formatDate(day, "EEE dd").split(" ")[1]}
                      </div>
                      {hasPresences && (
                        <div className={styles.dayCellPresenceCount}>
                          {dayPresences.length}
                        </div>
                      )}
                    </div>

                    {hasPresences && (
                      <div className={styles.tooltip}>
                        <div className={styles.tooltipContent}>
                          <div className={styles.tooltipHeader}>
                            {formatDate(day, "EEE dd/MM")}
                          </div>
                          <div className={styles.tooltipBody}>
                            {dayPresences.slice(0, 3).map((p, idx) => (
                              <div key={idx} className={styles.tooltipTime}>
                                {formatDate(p, "HH:mm")}
                              </div>
                            ))}
                            {dayPresences.length > 3 && (
                              <div className={styles.tooltipMore}>
                                +{dayPresences.length - 3} autres
                              </div>
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
  );

  // Vue compacte (conservée)
  const CompactView = () => (
    <div className={styles.compactViewContainer}>
      <div className={styles.compactViewScroll}>
        <div className={styles.compactViewGrid}>
          <div
            className={styles.compactViewGridInner}
            style={{
              gridTemplateColumns: `180px repeat(${allDays.length}, minmax(100px, 1fr))`,
            }}
          >
            <div className={styles.compactHeaderCell}>
              <Users className={styles.compactHeaderIcon} />
              Membres
            </div>
            {allDays.map((day) => (
              <div
                key={day.toISOString()}
                className={`${styles.compactDayHeader} ${
                  isWeekend(day)
                    ? styles.compactDayHeaderWeekend
                    : styles.compactDayHeaderNormal
                }`}
              >
                <div className={styles.compactDayDate}>{formatDate(day, "EEE dd")}</div>
                <div className={styles.compactDayMonth}>
                  {formatDate(day, "dd/MM").split("/")[1]}
                </div>
              </div>
            ))}

            {visibleMembers.map((member, idx) => (
              <React.Fragment key={member.badgeId}>
                <div
                  className={`${styles.compactMemberCell} ${
                    idx % 2 === 0 ? styles.compactMemberCellEven : styles.compactMemberCellOdd
                  }`}
                >
                  {member.photo ? (
                    <img
                      src={member.photo}
                      alt="avatar"
                      className={styles.compactMemberAvatar}
                    />
                  ) : (
                    <div className={styles.compactMemberInitials}>
                      {member.firstName?.[0]}
                      {member.name?.[0]}
                    </div>
                  )}
                  <div className={styles.compactMemberInfo}>
                    <div className={styles.compactMemberName}>
                      {member.name}
                    </div>
                    <div className={styles.compactMemberFirstName}>
                      {member.firstName}
                    </div>
                  </div>
                </div>
                {allDays.map((day) => {
                  const times = groupedByMember[member.badgeId] || [];
                  const dayPresences = times.filter((t) => {
                    const tDateStr = toDateString(t);
                    const dayDateStr = toDateString(day);
                    return tDateStr === dayDateStr;
                  });

                  return (
                    <div
                      key={`${member.badgeId}-${day.toISOString()}`}
                      className={`${styles.compactDataCell} ${
                        dayPresences.length > 0
                          ? styles.compactDataCellPresent
                          : isWeekend(day)
                          ? styles.compactDataCellWeekend
                          : idx % 2 === 0
                          ? styles.compactDataCellEven
                          : styles.compactDataCellOdd
                      }`}
                    >
                      {dayPresences.length > 0 && (
                        <div className={styles.presenceTimesContainer}>
                          {dayPresences.slice(0, 3).map((time, tidx) => (
                            <div
                              key={tidx}
                              className={styles.presenceTimeChip}
                            >
                              {formatDate(time, "HH:mm")}
                            </div>
                          ))}
                          {dayPresences.length > 3 && (
                            <div className={styles.presenceMoreChip}>
                              +{dayPresences.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // NOUVELLE VUE MENSUELLE (remplace la vue grille)
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

    // Navigation mensuelle
    const navigateMonth = (direction) => {
      const newDate = new Date(startDate);
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      setStartDate(startOfDay(newDate));
      setEndDate(endOfDay(new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0)));
    };

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

    // Gestion de l'expansion des jours
    const toggleDayExpansion = (dayKey) => {
      const newExpandedDays = new Set(expandedDays);
      if (newExpandedDays.has(dayKey)) {
        newExpandedDays.delete(dayKey);
      } else {
        newExpandedDays.add(dayKey);
      }
      setExpandedDays(newExpandedDays);
    };

    // Gestionnaire de survol
    const handleMemberMouseEnter = (badgeId, dayKey, event) => {
      const member = members.find(m => m.badgeId === badgeId);
      const memberPresences = presencesByDayAndMember[dayKey]?.[badgeId] || [];
      
      setHoveredMember({
        member,
        presences: memberPresences,
        dayKey
      });
      setMousePosition({ x: event.clientX, y: event.clientY });
    };

    const handleMouseMove = (event) => {
      if (hoveredMember) {
        setMousePosition({ x: event.clientX, y: event.clientY });
      }
    };

    const handleMouseLeave = () => {
      setHoveredMember(null);
    };

    // Rendu d'un mini-avatar de membre avec compteur (optimisé pour 1 passage/jour)
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
          {member.photo ? (
            <img
              src={member.photo}
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
          
          {/* Compteur UNIQUEMENT si passages multiples (cas exceptionnel) */}
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

    // Tooltip optimisé pour 1 passage par jour
    const renderTooltip = () => {
      if (!hoveredMember) return null;

      const { member, presences, dayKey } = hoveredMember;
      const day = new Date(dayKey + 'T00:00:00');
      const isMultiplePassages = presences.length > 1;
      
      return (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: mousePosition.x + 15,
            top: mousePosition.y - 10,
            transform: 'translateY(-50%)'
          }}
        >
          <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-xl shadow-2xl p-4 min-w-[280px] max-w-[320px] border border-gray-700">
            {/* En-tête avec photo et nom */}
            <div className="flex items-center gap-3 mb-3">
              {member?.photo ? (
                <img
                  src={member.photo}
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
              onClick={() => navigateMonth('prev')}
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
              onClick={() => navigateMonth('next')}
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
            const memberIds = Object.keys(dayMemberPresences).filter(badgeId => {
              const member = getMemberInfo(badgeId);
              return (!filterName ||
                `${member.name} ${member.firstName}`
                  .toLowerCase()
                  .includes(filterName.toLowerCase())) &&
              (!filterBadge || member.badgeId?.includes(filterBadge));
            });
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
              // Cas intense : >20 membres (comme vos 50)
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

  // Composant de résumé des statistiques
  const StatsResume = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Résumé de la période
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(startDate, "dd/MM/yyyy")} - {formatDate(endDate, "dd/MM/yyyy")}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {stats.totalPresences}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Passages totaux
          </div>
        </div>

        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.uniqueMembers}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Membres actifs
          </div>
        </div>

        <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {stats.avgMembersPerDay}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Moy. membres/jour
          </div>
        </div>

        <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {stats.avgPresencesPerDay}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Moy. passages/jour
          </div>
        </div>
      </div>

      {stats.busiestDay.members > 0 && (
        <div className="mt-4 p-3 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg border border-red-200 dark:border-red-700">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Jour le plus chargé : 
              <strong className="text-red-600 dark:text-red-400 ml-1">
                {formatDate(new Date(stats.busiestDay.day), "dd/MM/yyyy")} 
                ({stats.busiestDay.members} membres, {stats.busiestDay.presences} passages)
              </strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.pageContainer}>
      <div className={styles.maxWidthWrapper}>
        {/* En-tête */}
        <div className={styles.headerCard}>
          <div className={styles.headerContent}>
            <div className={styles.headerTitleGroup}>
              <div className={styles.headerIconContainer}>
                <Calendar className={styles.headerIcon} />
              </div>
              <div>
                <h1 className={styles.headerTitle}>
                  Planning des présences
                </h1>
                <p className={styles.headerSubtitle}>
                  Visualisez les présences des membres
                </p>
              </div>
            </div>

            {/* Boutons de vue + filtre */}
            <div className={styles.viewFilterControls}>
              <button
                onClick={() => setViewMode("list")}
                className={`${styles.viewButton} ${
                  viewMode === "list"
                    ? styles.viewButtonActive
                    : styles.viewButtonInactive
                }`}
                title="Vue liste"
              >
                <List className={styles.viewButtonIcon} />
              </button>
              
              {/* Vue compacte uniquement si pas mobile */}
              {!isMobile && (
                <button
                  onClick={() => setViewMode("compact")}
                  className={`${styles.viewButton} ${
                    viewMode === "compact"
                      ? styles.viewButtonActive
                      : styles.viewButtonInactive
                  }`}
                  title="Vue compacte"
                >
                  <Users className={styles.viewButtonIcon} />
                </button>
              )}

              {/* Vue mensuelle (remplace grille) uniquement si pas mobile */}
              {!isMobile && (
                <button
                  onClick={() => setViewMode("monthly")}
                  className={`${styles.viewButton} ${
                    viewMode === "monthly"
                      ? styles.viewButtonActive
                      : styles.viewButtonInactive
                  }`}
                  title="Vue mensuelle"
                >
                  <Grid className={styles.viewButtonIcon} />
                </button>
              )}

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`${styles.filterButton} ${
                  showFilters
                    ? styles.filterButtonActive
                    : styles.filterButtonInactive
                }`}
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
          <div className={styles.periodNav}>
            <button
              onClick={() => navigatePeriod("prev")}
              className={styles.navButton}
            >
              <ChevronLeft className={styles.navButtonIcon} />
            </button>

            <div className={styles.periodControls}>
              {/* Sélecteur de date de début */}
              <div className={styles.dateInputGroup}>
                <label className={styles.dateLabel}>
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
                  className={styles.dateInput}
                />
              </div>

              <select
                className={styles.periodSelect}
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

              <div className={styles.periodDisplay}>
                <div className={styles.periodDateRange}>
                  {formatDate(startDate, "dd/MM/yyyy")} -{" "}
                  {formatDate(endDate, "dd/MM/yyyy")}
                </div>
                <div className={styles.periodDaysCount}>
                  {allDays.length} jours
                </div>
              </div>
            </div>

            <button
              onClick={() => navigatePeriod("next")}
              className={styles.navButton}
            >
              <ChevronRight className={styles.navButtonIcon} />
            </button>
          </div>

          {/* Presets rapides pour navigation facile */}
          <div className={styles.presetsContainer}>
            <div className={styles.presetsContent}>
              <span className={styles.presetsLabel}>
                Raccourcis :
              </span>

              <button
                onClick={() => {
                  const today = new Date();
                  setStartDate(startOfDay(today));
                  setEndDate(endOfDay(today));
                }}
                className={styles.presetButton}
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
                }}
                className={styles.presetButton}
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
                }}
                className={styles.presetButton}
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
                }}
                className={styles.presetButton}
              >
                Cette Semaine
              </button>

              <button
                onClick={() => {
                  setStartDate(startOfDay(startOfMonth(new Date())));
                  setEndDate(endOfDay(endOfMonth(new Date())));
                }}
                className={styles.presetButton}
              >
                Ce Mois
              </button>

              <button
                onClick={() => {
                  setStartDate(startOfDay(startOfYear(new Date())));
                  setEndDate(endOfDay(endOfYear(new Date())));
                }}
                className={styles.presetButton}
              >
                Cette Année
              </button>
            </div>
          </div>
        </div>

        {/* Filtres */}
       {showFilters && (
         <div className={styles.filtersContainer}>
           <div className={styles.filtersGrid}>
             <div>
               <label className={styles.filterInputLabel}>
                 Rechercher par nom
               </label>
               <input
                 type="text"
                 placeholder="Nom ou prénom..."
                 value={filterName}
                 onChange={(e) => setFilterName(e.target.value)}
                 className={styles.filterInput}
               />
             </div>
             <div>
               <label className={styles.filterInputLabel}>
                 Filtrer par badge
               </label>
               <input
                 type="text"
                 placeholder="Numéro de badge..."
                 value={filterBadge}
                 onChange={(e) => setFilterBadge(e.target.value)}
                 className={styles.filterInput}
               />
             </div>
             <div className={styles.checkboxContainer}>
               <label className={styles.checkboxLabel}>
                 <input
                   type="checkbox"
                   checked={showNightHours}
                   onChange={() => setShowNightHours(!showNightHours)}
                   className={styles.checkboxInput}
                 />
                 <span className={styles.checkboxText}>Afficher 00h - 06h</span>
               </label>
             </div>
             <div className={styles.refreshButtonContainer}>
               <button
                 onClick={handleRetry}
                 disabled={isRetrying}
                 className={styles.refreshButton}
               >
                 <RefreshCw
                   className={`${styles.refreshButtonIcon} ${
                     isRetrying ? styles.refreshButtonIconSpin : ""
                   }`}
                 />
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
         <div className={styles.emptyStateContainer}>
           <div className={styles.emptyStateIconContainer}>
             <Users className={styles.emptyStateIcon} />
           </div>
           <h3 className={styles.emptyStateTitle}>
             Aucune présence trouvée
           </h3>
           <p className={styles.emptyStateText}>
             Aucune présence n'a été enregistrée sur cette période ou avec ces
             filtres.
             <br />
             Essayez d'ajuster la période ou utilisez les raccourcis ci-dessus.
           </p>
           <button
             onClick={handleRetry}
             className={styles.emptyStateButton}
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