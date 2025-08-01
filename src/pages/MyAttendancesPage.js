// src/pages/MyAttendancesPage.jsx - VERSION COMPLÈTE CORRIGÉE
import React, { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "../contexts/AuthContext";
import {
  FaCalendarCheck,
  FaCalendarTimes,
  FaClock,
  FaMapMarkerAlt,
  FaUserCheck,
  FaExclamationTriangle,
  FaFilter,
  FaSearch,
  FaDownload,
  FaChartLine,
  FaSyncAlt,
  FaUser,
  FaCalendarAlt,
  FaHistory,
  FaChartBar,
  FaEye,
  FaTh,
  FaList,
  FaFire,
  FaTrophy,
  FaStar
} from "react-icons/fa";
import styles from "./MyAttendancesPage.module.css";

// Client Supabase
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);


// Utilitaires de date
const formatDate = (date, format) => {
  const options = {
    "yyyy-MM-dd": { year: "numeric", month: "2-digit", day: "2-digit" },
    "dd/MM/yyyy": { day: "2-digit", month: "2-digit", year: "numeric" },
    "EEE dd/MM": { weekday: "short", day: "2-digit", month: "2-digit" },
    "EEE dd": { weekday: "short", day: "2-digit" },
    "HH:mm": { hour: "2-digit", minute: "2-digit", hour12: false },
    "full": { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }
  };

  if (format === "yyyy-MM-dd") {
    return date.toISOString().split("T")[0];
  }

  return new Intl.DateTimeFormat("fr-FR", options[format] || {}).format(date);
};

const parseTimestamp = (timestamp) => new Date(timestamp);

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

const addMonths = (date, months) => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
};

const addDays = (date, days) => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
};

const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

function MyAttendancesPage() {
  const { user, role } = useAuth();
  
  // États principaux
  const [presences, setPresences] = useState([]);
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // États pour l'interface
  const [viewMode, setViewMode] = useState('calendar');
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    dateRange: 'month'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [timelineStartDate, setTimelineStartDate] = useState(new Date());

  // Chargement initial
  useEffect(() => {
    if (user) {
      fetchMemberData();
    }
  }, [user]);

  useEffect(() => {
    if (memberData) {
      loadPresences();
    }
  }, [memberData, filters, customStartDate, customEndDate, timelineStartDate]);

  // Récupération des données membre
  const fetchMemberData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setMemberData(data);
        console.log("✅ Données membre chargées:", data);
      } else {
        console.log(⚠️ Aucun membre trouvé pour cet utilisateur");
      }
    } catch (err) {
      console.error('Erreur récupération membre:', err);
      setError('Impossible de récupérer votre profil de membre');
    }
  };

  // Calcul de la plage de dates
  const getDateRange = () => {
    const now = new Date();
    let startDate, endDate;
    
    switch (filters.dateRange) {
      case 'week':
        endDate = endOfDay(now);
        startDate = startOfDay(addDays(now, -7));
        break;
      case 'month':
        startDate = startOfDay(new Date(filters.year, filters.month - 1, 1));
        endDate = endOfDay(new Date(filters.year, filters.month, 0));
        break;
      case '3months':
        endDate = endOfDay(new Date(filters.year, filters.month, 0));
        startDate = startOfDay(addMonths(endDate, -3));
        break;
      case 'year':
        startDate = startOfDay(new Date(filters.year, 0, 1));
        endDate = endOfDay(new Date(filters.year, 11, 31));
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = startOfDay(new Date(customStartDate));
          endDate = endOfDay(new Date(customEndDate));
        } else {
          startDate = startOfDay(new Date(filters.year, filters.month - 1, 1));
          endDate = endOfDay(new Date(filters.year, filters.month, 0));
        }
        break;
      case '7days':
        endDate = endOfDay(timelineStartDate);
        startDate = startOfDay(addDays(timelineStartDate, -6));
        break;
      case '14days':
        endDate = endOfDay(timelineStartDate);
        startDate = startOfDay(addDays(timelineStartDate, -13));
        break;
      case '30days':
        endDate = endOfDay(timelineStartDate);
        startDate = startOfDay(addDays(timelineStartDate, -29));
        break;
      default:
        startDate = startOfDay(new Date(filters.year, filters.month - 1, 1));
        endDate = endOfDay(new Date(filters.year, filters.month, 0));
    }

    return { startDate, endDate };
  };

  // Chargement des présences depuis Supabase
  const loadPresences = async (showRetryIndicator = false) => {
    if (!memberData?.badgeId) {
      console.log("⚠️ Pas de badgeId disponible");
      return;
    }

    try {
      if (showRetryIndicator) {
        setIsRetrying(true);
      }
      setLoading(true);
      setError("");

      const { startDate, endDate } = getDateRange();

      console.log("🔄 Chargement des présences pour:", memberData.badgeId, {
        début: startDate.toLocaleDateString(),
        fin: endDate.toLocaleDateString(),
      });

      let allPresences = [];
      let from = 0;
      const pageSize = 1000;
      let done = false;

      while (!done) {
        const { data, error } = await supabase
          .from("presences")
          .select("*")
          .eq("badgeId", memberData.badgeId)
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
        ...p,
        parsedDate: parseTimestamp(p.timestamp),
        date: formatDate(parseTimestamp(p.timestamp), "yyyy-MM-dd"),
        time: formatDate(parseTimestamp(p.timestamp), "HH:mm"),
        fullDate: formatDate(parseTimestamp(p.timestamp), "full"),
        dayOfWeek: formatDate(parseTimestamp(p.timestamp), "EEE dd/MM"),
        hour: parseTimestamp(p.timestamp).getHours()
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

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    loadPresences(true);
  };

  const filteredPresences = useMemo(() => {
    return presences.filter(presence => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        presence.badgeId?.toLowerCase().includes(searchLower) ||
        formatDate(presence.parsedDate, "dd/MM/yyyy").includes(searchLower) ||
        presence.time.includes(searchLower) ||
        presence.fullDate.toLowerCase().includes(searchLower)
      );
    });
  }, [presences, searchTerm]);

  const stats = useMemo(() => {
    const total = filteredPresences.length;
    const uniqueDays = new Set(filteredPresences.map(p => p.date)).size;
    const avgPerDay = uniqueDays > 0 ? (total / uniqueDays).toFixed(1) : 0;
    
    const hourCounts = {};
    filteredPresences.forEach(p => {
      const hour = p.hour;
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const mostFrequentHour = Object.keys(hourCounts).reduce((a, b) => 
      hourCounts[a] > hourCounts[b] ? a : b, 0
    );

    const sortedDates = [...new Set(filteredPresences.map(p => p.date))].sort();
    let maxStreak = 0;
    let currentStreak = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const current = new Date(sortedDates[i]);
      const previous = new Date(sortedDates[i - 1]);
      const diffTime = Math.abs(current - previous);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentStreak++;
      } else {
        maxStreak = Math.max(maxStreak, currentStreak);
        currentStreak = 1;
      }
    }
    maxStreak = Math.max(maxStreak, currentStreak);
    
    return {
      total,
      uniqueDays,
      avgPerDay,
      mostFrequentHour: hourCounts[mostFrequentHour] ? `${mostFrequentHour}h` : '-',
      maxStreak,
      firstPresence: filteredPresences.length > 0 ? 
        Math.min(...filteredPresences.map(p => new Date(p.timestamp))) : null,
      lastPresence: filteredPresences.length > 0 ? 
        Math.max(...filteredPresences.map(p => new Date(p.timestamp))) : null
    };
  }, [filteredPresences]);

  const calendarData = useMemo(() => {
    const presencesByDate = {};
    filteredPresences.forEach(p => {
      if (!presencesByDate[p.date]) {
        presencesByDate[p.date] = [];
      }
      presencesByDate[p.date].push(p);
    });

    const startDate = new Date(filters.year, filters.month - 1, 1);
    const calendar = [];

    const firstDayOfWeek = startDate.getDay();
    const startCalendar = new Date(startDate);
    startCalendar.setDate(startDate.getDate() - (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1));

    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startCalendar);
      currentDate.setDate(startCalendar.getDate() + i);
      
      const dateKey = formatDate(currentDate, "yyyy-MM-dd");
      const presences = presencesByDate[dateKey] || [];
      const isCurrentMonth = currentDate.getMonth() === filters.month - 1;
      const isToday = dateKey === formatDate(new Date(), "yyyy-MM-dd");
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

      calendar.push({
        date: currentDate,
        dateKey,
        presences,
        count: presences.length,
        isCurrentMonth,
        isToday,
        isWeekend
      });
    }

    return calendar;
  }, [filteredPresences, filters]);

  const heatmapData = useMemo(() => {
    const hourData = {};
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    
    days.forEach((day, dayIndex) => {
      hourData[dayIndex] = {};
      for (let hour = 6; hour <= 22; hour++) {
        hourData[dayIndex][hour] = 0;
      }
    });

    filteredPresences.forEach(p => {
      const dayOfWeek = (p.parsedDate.getDay() + 6) % 7;
      const hour = p.hour;
      if (hour >= 6 && hour <= 22) {
        hourData[dayOfWeek][hour]++;
      }
    });

    const maxValue = Math.max(...Object.values(hourData).flatMap(hours => Object.values(hours)));

    return { hourData, maxValue, days };
  }, [filteredPresences]);

  const timelineData = useMemo(() => {
    const getDaysCount = () => {
      switch (filters.dateRange) {
        case '7days': return 7;
        case '14days': return 14;
        case '30days': return 30;
        default: return 7;
      }
    };

    if (!['7days', '14days', '30days'].includes(filters.dateRange)) {
      const periodDays = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = formatDate(date, "yyyy-MM-dd");
        const dayPresences = filteredPresences.filter(p => p.date === dateKey);
        
        periodDays.push({
          date,
          dateKey,
          presences: dayPresences,
          count: dayPresences.length
        });
      }
      return periodDays;
    }

    const daysCount = getDaysCount();
    const periodDays = [];
    
    for (let i = daysCount - 1; i >= 0; i--) {
      const date = new Date(timelineStartDate);
      date.setDate(date.getDate() - i);
      const dateKey = formatDate(date, "yyyy-MM-dd");
      const dayPresences = filteredPresences.filter(p => p.date === dateKey);
      
      periodDays.push({
        date,
        dateKey,
        presences: dayPresences,
        count: dayPresences.length
      });
    }
    return periodDays;
  }, [filteredPresences, filters.dateRange, timelineStartDate]);

  const handleViewModeChange = (newViewMode) => {
    setViewMode(newViewMode);
    
    if (newViewMode === 'timeline' && !['7days', '14days', '30days'].includes(filters.dateRange)) {
      setFilters({...filters, dateRange: '7days'});
      setTimelineStartDate(new Date());
    } else if (newViewMode === 'calendar' && ['7days', '14days', '30days'].includes(filters.dateRange)) {
      setFilters({...filters, dateRange: 'month'});
    }
  };

  const getPresencesByDate = () => {
    const groupedByDate = {};
    filteredPresences.forEach((presence) => {
      const dateKey = presence.date;
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(presence);
    });

    return Object.keys(groupedByDate)
      .sort((a, b) => new Date(b) - new Date(a))
      .map(date => ({
        date,
        presences: groupedByDate[date].sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        ),
        isWeekend: isWeekend(new Date(date))
      }));
  };

  const exportToText = () => {
    const presencesByDate = getPresencesByDate();
    const { startDate, endDate } = getDateRange();
    
    let content = `=== RAPPORT DE PRÉSENCES ===\n\n`;
    content += `Membre: ${memberData.firstName} ${memberData.name}\n`;
    content += `Badge: ${memberData.badgeId}\n`;
    content += `Période: ${formatDate(startDate, "dd/MM/yyyy")} - ${formatDate(endDate, "dd/MM/yyyy")}\n`;
    content += `Généré le: ${formatDate(new Date(), "dd/MM/yyyy")} à ${formatDate(new Date(), "HH:mm")}\n\n`;
    
    content += `=== STATISTIQUES ===\n`;
    content += `Total présences: ${stats.total}\n`;
    content += `Jours présents: ${stats.uniqueDays}\n`;
    content += `Moyenne par jour: ${stats.avgPerDay}\n`;
    content += `Heure la plus fréquente: ${stats.mostFrequentHour}\n`;
    content += `Streak maximum: ${stats.maxStreak} jours\n`;
    
    if (stats.firstPresence) {
      content += `Première présence: ${formatDate(new Date(stats.firstPresence), "dd/MM/yyyy")} à ${formatDate(new Date(stats.firstPresence), "HH:mm")}\n`;
    }
    if (stats.lastPresence) {
      content += `Dernière présence: ${formatDate(new Date(stats.lastPresence), "dd/MM/yyyy")} à ${formatDate(new Date(stats.lastPresence), "HH:mm")}\n`;
    }
    
    content += `\n=== DÉTAIL PAR JOUR ===\n`;
    presencesByDate.forEach(({ date, presences, isWeekend }) => {
      const dayLabel = isWeekend ? " (Week-end)" : "";
      content += `\n${formatDate(new Date(date), "full")}${dayLabel} - ${presences.length} présence(s):\n`;
      presences.forEach((p, index) => {
        content += `  ${index + 1}. ${p.time}\n`;
      });
    });

    if (filteredPresences.length === 0) {
      content += `\nAucune présence trouvée pour cette période.\n`;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presences_${memberData.badgeId}_${formatDate(new Date(), "yyyy-MM-dd")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ✅ NAVIGATION DE PÉRIODES - inspirée de PlanningPage
  const navigatePeriod = (direction) => {
    const amount = direction === 'prev' ? -1 : 1;
    let newStart;

    if (filters.dateRange === 'week') {
      newStart = addDays(new Date(), amount * 7);
    } else if (filters.dateRange === 'month') {
      newStart = new Date();
      newStart.setMonth(newStart.getMonth() + amount);
      setFilters({
        ...filters,
        month: newStart.getMonth() + 1,
        year: newStart.getFullYear()
      });
      return;
    } else if (filters.dateRange === 'year') {
      newStart = new Date();
      newStart.setFullYear(newStart.getFullYear() + amount);
      setFilters({
        ...filters,
        year: newStart.getFullYear()
      });
      return;
    } else {
      return;
    }

    setTimelineStartDate(newStart);
  };

  const getCurrentPeriodLabel = () => {
    const { startDate, endDate } = getDateRange();
    if (filters.dateRange === 'month') {
      return new Date(filters.year, filters.month - 1).toLocaleDateString('fr-FR', { 
        month: 'long', 
        year: 'numeric' 
      });
    }
    return `${formatDate(startDate, "dd/MM")} - ${formatDate(endDate, "dd/MM/yyyy")}`;
  };

  // ✅ RACCOURCIS RAPIDES - inspirés de PlanningPage
  const setQuickPeriod = (type) => {
    const today = new Date();
    let startDate, endDate;

    switch (type) {
      case 'today':
        startDate = endDate = today;
        break;
      case '7days':
        startDate = addDays(today, -6);
        endDate = today;
        break;
      case '30days':
        startDate = addDays(today, -29);
        endDate = today;
        break;
      case 'thisWeek':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - today.getDay() + 1);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        break;
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'thisYear':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today.getFullYear(), 11, 31);
        break;
    }

    setFilters({...filters, dateRange: 'custom'});
    setCustomStartDate(formatDate(startDate, "yyyy-MM-dd"));
    setCustomEndDate(formatDate(endDate, "yyyy-MM-dd"));
  };

  // Écrans de chargement et d'erreur
  const renderConnectionError = () => (
    <div className={styles.container}>
      <div className={styles.errorCard}>
        <FaExclamationTriangle className={styles.errorIcon} />
        <h2 className={styles.errorTitle}>Problème de connexion</h2>
        <p className={styles.errorMessage}>{error}</p>
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className={styles.retryButton}
        >
          {isRetrying ? (
            <>
              <FaSyncAlt className={`${styles.retryIcon} ${styles.spinning}`} />
              Reconnexion...
            </>
          ) : (
            <>
              <FaSyncAlt className={styles.retryIcon} />
              Réessayer
            </>
          )}
        </button>
        {retryCount > 0 && (
          <p className={styles.retryCount}>
            Tentative {retryCount + 1}
          </p>
        )}
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className={styles.container}>
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <h2 className={styles.loadingTitle}>
          {isRetrying ? "Reconnexion en cours..." : "Chargement de vos présences..."}
        </h2>
        <p className={styles.loadingSubtitle}>
          Badge: {memberData?.badgeId || 'Chargement...'}
        </p>
      </div>
    </div>
  );

  // ✅ COMPOSANT CALENDRIER
  const CalendarView = () => (
    <div className={styles.calendarContainer}>
      <div className={styles.calendarHeader}>
        <div className={styles.monthNavigation}>
          <button 
            onClick={() => setFilters({...filters, month: filters.month === 1 ? 12 : filters.month - 1, year: filters.month === 1 ? filters.year - 1 : filters.year})}
            className={styles.navButton}
          >
            ←
          </button>
          <h3 className={styles.monthTitle}>
            {new Date(filters.year, filters.month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </h3>
          <button 
            onClick={() => setFilters({...filters, month: filters.month === 12 ? 1 : filters.month + 1, year: filters.month === 12 ? filters.year + 1 : filters.year})}
            className={styles.navButton}
          >
            →
          </button>
        </div>
      </div>
      
      <div className={styles.calendarGrid}>
        <div className={styles.calendarDaysHeader}>
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
            <div key={day} className={styles.dayHeader}>{day}</div>
          ))}
        </div>
        
        <div className={styles.calendarDays}>
          {calendarData.map((day, index) => (
            <div 
              key={index}
              className={`${styles.calendarDay} ${!day.isCurrentMonth ? styles.otherMonth : ''} ${day.isToday ? styles.today : ''} ${day.isWeekend ? styles.weekend : ''} ${day.count > 0 ? styles.hasPresence : ''}`}
            >
              <div className={styles.dayNumber}>{day.date.getDate()}</div>
              {day.count > 0 && (
                <div className={styles.presenceIndicators}>
                  <div className={`${styles.presenceCount} ${styles[`count${Math.min(day.count, 5)}`]}`}>
                    {day.count > 9 ? '9+' : day.count}
                  </div>
                  <div className={styles.presenceDots}>
                    {day.presences.slice(0, 3).map((presence, i) => (
                      <div 
                        key={i} 
                        className={styles.presenceDot}
                        title={`${presence.time}`}
                      />
                    ))}
                    {day.count > 3 && <div className={styles.moreDots}>+{day.count - 3}</div>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ✅ COMPOSANT HEATMAP
  const HeatmapView = () => (
    <div className={styles.heatmapContainer}>
      <h3 className={styles.heatmapTitle}>Activité par heure et jour de la semaine</h3>
      <div className={styles.heatmapGrid}>
        <div className={styles.heatmapYAxis}>
          {heatmapData.days.map((day, index) => (
            <div key={index} className={styles.dayLabel}>{day}</div>
          ))}
        </div>
        <div className={styles.heatmapContent}>
          <div className={styles.heatmapXAxis}>
            {Array.from({length: 17}, (_, i) => i + 6).map(hour => (
              <div key={hour} className={styles.hourLabel}>{hour}h</div>
            ))}
          </div>
          <div className={styles.heatmapCells}>
            {heatmapData.days.map((day, dayIndex) => (
              <div key={dayIndex} className={styles.heatmapRow}>
                {Array.from({length: 17}, (_, i) => i + 6).map(hour => {
                  const value = heatmapData.hourData[dayIndex][hour];
                  const intensity = heatmapData.maxValue > 0 ? value / heatmapData.maxValue : 0;
                  return (
                    <div 
                      key={hour}
                      className={styles.heatmapCell}
                      style={{
                        backgroundColor: intensity > 0 
                          ? `rgba(59, 130, 246, ${0.2 + intensity * 0.8})` 
                          : '#f3f4f6',
                        color: intensity > 0.5 ? 'white' : '#374151'
                      }}
                      title={`${day} ${hour}h: ${value} présence${value > 1 ? 's' : ''}`}
                    >
                      {value > 0 && <span className={styles.cellValue}>{value}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.heatmapLegend}>
        <span>Moins d'activité</span>
        <div className={styles.legendGradient}></div>
        <span>Plus d'activité</span>
      </div>
    </div>
  );

  // ✅ COMPOSANT TIMELINE CORRIGÉ
  const TimelineView = () => {
    const navigateTimeline = (direction) => {
      const daysToMove = filters.dateRange === '7days' ? 7 : filters.dateRange === '14days' ? 14 : 30;
      const newDate = new Date(timelineStartDate);
      newDate.setDate(newDate.getDate() + (direction === 'next' ? daysToMove : -daysToMove));
      setTimelineStartDate(newDate);
    };

    const canNavigateNext = () => {
      const today = new Date();
      return timelineStartDate < today;
    };

    const getPeriodLabel = () => {
      const endDate = new Date(timelineStartDate);
      const startDate = new Date(timelineStartDate);
      const daysCount = filters.dateRange === '7days' ? 7 : filters.dateRange === '14days' ? 14 : 30;
      startDate.setDate(startDate.getDate() - (daysCount - 1));
      
      return `${formatDate(startDate, "dd/MM")} - ${formatDate(endDate, "dd/MM/yyyy")}`;
    };

    const getCurrentPeriod = () => {
      return filters.dateRange === '7days' ? '7' : filters.dateRange === '14days' ? '14' : '30';
    };

    // ✅ Calcul adaptatif des dimensions
    const getBarWidth = () => {
      const daysCount = timelineData.length;
      if (daysCount <= 7) return '70%';
      if (daysCount <= 14) return '50%';
      return '35%';
    };

    const getTimelineHeight = () => {
      const daysCount = timelineData.length;
      if (daysCount <= 7) return '350px';
      if (daysCount <= 14) return '320px';
      return '280px';
    };

    const getGap = () => {
      const daysCount = timelineData.length;
      if (daysCount <= 7) return '1rem';
      if (daysCount <= 14) return '0.75rem';
      return '0.5rem';
    };

    return (
      <div className={styles.timelineContainer}>
        <div className={styles.timelineHeader}>
          <h3 className={styles.timelineTitle}>
            Activité des {getCurrentPeriod()} derniers jours
          </h3>
          
          <div className={styles.timelineNavigation}>
            <button
              onClick={() => navigateTimeline('prev')}
              className={styles.timelineNavButton}
            >
              ← Précédent
            </button>
            
            <div className={styles.timelinePeriodInfo}>
              {getPeriodLabel()}
            </div>
            
            <button
              onClick={() => navigateTimeline('next')}
              disabled={!canNavigateNext()}
              className={styles.timelineNavButton}
            >
              Suivant →
            </button>
          </div>
        </div>

        <div className={styles.timelinePeriodControls}>
          <div className={styles.periodButtons}>
            {[
              { id: '7days', label: '7 jours' },
              { id: '14days', label: '14 jours' },
              { id: '30days', label: '30 jours' }
            ].map(period => (
              <button
                key={period.id}
                onClick={() => {
                  setFilters({...filters, dateRange: period.id});
                  setTimelineStartDate(new Date());
                }}
                className={`${styles.periodButton} ${filters.dateRange === period.id ? styles.activePeriod : ''}`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* ✅ Timeline avec dimensions adaptatives */}
        <div 
          className={styles.timelineChart}
          style={{
            height: getTimelineHeight(),
            gap: getGap(),
            padding: timelineData.length > 14 ? '1.5rem 0.5rem 1rem' : '2rem 1.5rem 1.5rem'
          }}
          data-days={timelineData.length}
        >
          {timelineData.map((day, index) => (
            <div key={index} className={styles.timelineDay}>
              <div className={styles.timelineDate}>
                <div className={`${styles.dateLabel} ${timelineData.length > 14 ? styles.compactLabel : ''}`}>
                  {timelineData.length > 14 
                    ? formatDate(day.date, "dd/MM").split('/')[0]
                    : formatDate(day.date, "EEE dd")
                  }
                </div>
                <div className={`${styles.countLabel} ${timelineData.length > 14 ? styles.compactCount : ''}`}>
                  {day.count}
                </div>
              </div>
              
              <div className={styles.timelineBarContainer}>
                <div 
                  className={styles.timelineBar}
                  style={{
                    height: `${Math.max((day.count / Math.max(...timelineData.map(d => d.count))) * 100, 5)}%`,
                    width: getBarWidth()
                  }}
                >
                  <div className={styles.barGradient}></div>
                </div>
              </div>
              
              <div className={styles.timelinePresences}>
                {timelineData.length <= 14 ? (
                  <>
                    {day.presences.slice(0, 3).map((presence, i) => (
                      <div key={i} className={styles.timelinePresenceTime}>
                        {presence.time}
                      </div>
                    ))}
                    {day.count > 3 && <div className={styles.moreTimes}>+{day.count - 3}</div>}
                  </>
                ) : (
                  day.count > 0 && (
                    <div className={`${styles.timelinePresenceTime} ${styles.compactPresence}`}>
                      {day.presences[0]?.time}
                      {day.count > 1 && <span className={styles.plusIndicator}>+{day.count - 1}</span>}
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ✅ COMPOSANT LISTE
  const ListView = () => {
    const presencesByDate = getPresencesByDate();

    return (
      <div className={styles.attendancesList}>
        {filteredPresences.length === 0 ? (
          <div className={styles.emptyState}>
            <FaCalendarCheck className={styles.emptyIcon} />
            <h3>Aucune présence trouvée</h3>
            <p>
              {presences.length === 0 
                ? "Aucune présence enregistrée pour cette période."
                : "Aucune présence ne correspond à vos critères de recherche."
              }
            </p>
            <div className={styles.emptyActions}>
              <button
                onClick={handleRetry}
                className={styles.retryButton}
              >
                <FaSyncAlt className={styles.retryIcon} />
                Recharger les données
              </button>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className={styles.clearSearchButton}
                >
                  Effacer la recherche
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.attendancesByDate}>
            <div className={styles.resultsHeader}>
              <h3 className={styles.resultsTitle}>
                {filteredPresences.length} présence{filteredPresences.length > 1 ? 's' : ''} trouvée{filteredPresences.length > 1 ? 's' : ''}
                {searchTerm && ` pour "${searchTerm}"`}
              </h3>
              {presences.length !== filteredPresences.length && (
                <p className={styles.filteredInfo}>
                  ({presences.length - filteredPresences.length} présence{presences.length - filteredPresences.length > 1 ? 's' : ''} masquée{presences.length - filteredPresences.length > 1 ? 's' : ''} par les filtres)
                </p>
              )}
            </div>

            {presencesByDate.map(({ date, presences, isWeekend }) => (
              <div key={date} className={`${styles.dateGroup} ${isWeekend ? styles.weekendGroup : ''}`}>
                <div className={styles.dateHeader}>
                  <h3 className={styles.dateTitle}>
                    <FaCalendarAlt className={styles.dateIcon} />
                    {formatDate(new Date(date), "full")}
                    {isWeekend && <span className={styles.weekendBadge}>Week-end</span>}
                  </h3>
                  <span className={styles.dateCount}>
                    {presences.length} présence{presences.length > 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className={styles.presencesGrid}>
                  {presences.map((presence, index) => (
                    <div 
                      key={`${presence.badgeId}-${presence.timestamp}-${index}`} 
                      className={styles.presenceCard}
                    >
                      <div className={styles.presenceHeader}>
                        <div className={styles.presenceTime}>
                          <FaClock className={styles.timeIcon} />
                          <span className={styles.timeText}>{presence.time}</span>
                        </div>
                        <div className={styles.presenceNumber}>
                          #{index + 1}
                        </div>
                      </div>
                      
                      <div className={styles.presenceDetails}>
                        <div className={styles.presenceInfo}>
                          <span className={styles.badgeInfo}>
                            <FaUserCheck className={styles.badgeIcon} />
                            Badge: {presence.badgeId}
                          </span>
                        </div>
                        
                        <div className={styles.timestampInfo}>
                          <small className={styles.fullTimestamp}>
                            {formatDate(presence.parsedDate, "dd/MM/yyyy")} à {presence.time}
                          </small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Vérifications de rendu
  if (!memberData) {
    return (
      <div className={styles.container}>
        <div className={styles.warningCard}>
          <div className={styles.warningHeader}>
            <FaExclamationTriangle className={styles.warningIcon} />
            <h2 className={styles.warningTitle}>Profil non configuré</h2>
          </div>
          <p className={styles.warningMessage}>
            Votre compte utilisateur n'est pas encore lié à un profil de membre.
          </p>
          <p className={styles.warningSubMessage}>
            Contactez un administrateur pour associer votre compte à votre profil de membre.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return renderLoading();
  if (error && !isRetrying) return renderConnectionError();

  const { startDate, endDate } = getDateRange();

  return (
    <div className={styles.container}>
      {/* Header avec statistiques */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            <h1 className={styles.pageTitle}>
              <FaCalendarCheck className={styles.titleIcon} />
              Mes Présences
            </h1>
            <p className={styles.memberName}>
              <FaUser className={styles.memberIcon} />
              {memberData.firstName} {memberData.name} - Badge: {memberData.badgeId}
            </p>
            <p className={styles.periodInfo}>
              <FaCalendarAlt className={styles.periodIcon} />
              Période: {formatDate(startDate, "dd/MM/yyyy")} - {formatDate(endDate, "dd/MM/yyyy")}
              {['7days', '14days', '30days'].includes(filters.dateRange) && (
                <span className={styles.timelineBadge}>
                  Timeline {filters.dateRange === '7days' ? '7' : filters.dateRange === '14days' ? '14' : '30'}j
                </span>
              )}
            </p>
          </div>

          <div className={styles.statsGrid}>
            <div className={`${styles.statCard} ${styles.totalStat}`}>
              <div className={styles.statIcon}>
                <FaHistory />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statNumber}>{stats.total}</div>
                <div className={styles.statLabel}>Total présences</div>
              </div>
            </div>
            
            <div className={`${styles.statCard} ${styles.daysStat}`}>
              <div className={styles.statIcon}>
                <FaCalendarCheck />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statNumber}>{stats.uniqueDays}</div>
                <div className={styles.statLabel}>Jours présents</div>
              </div>
            </div>
            
            <div className={`${styles.statCard} ${styles.streakStat}`}>
              <div className={styles.statIcon}>
                <FaFire />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statNumber}>{stats.maxStreak}</div>
                <div className={styles.statLabel}>Streak max</div>
              </div>
            </div>
            
            <div className={`${styles.statCard} ${styles.timeStat}`}>
              <div className={styles.statIcon}>
                <FaClock />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statNumber}>{stats.mostFrequentHour}</div>
                <div className={styles.statLabel}>Heure fréquente</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contrôles de vue et filtres */}
      <div className={styles.controlsSection}>
        <div className={styles.viewControls}>
          <div className={styles.viewButtons}>
            {[
              { id: 'calendar', icon: FaCalendarAlt, label: 'Calendrier' },
              { id: 'heatmap', icon: FaTh, label: 'Heatmap' },
              { id: 'timeline', icon: FaChartBar, label: 'Timeline' },
              { id: 'list', icon: FaList, label: 'Liste' }
            ].map(view => (
              <button
                key={view.id}
                onClick={() => handleViewModeChange(view.id)}
                className={`${styles.viewButton} ${viewMode === view.id ? styles.active : ''}`}
              >
                <view.icon className={styles.viewIcon} />
                {view.label}
              </button>
            ))}
          </div>

          <div className={styles.filtersControls}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>
                <FaSearch className={styles.filterIcon} />
                Rechercher
              </label>
              <input
                type="text"
                placeholder="Date, heure, jour..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            {/* ✅ Select de période amélioré */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>
                <FaFilter className={styles.filterIcon} />
                Période
              </label>
              <select
                value={filters.dateRange}
                onChange={(e) => {
                  const newRange = e.target.value;
                  setFilters({...filters, dateRange: newRange});
                  
                  if (newRange !== 'custom') {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }
                  
                  if (['7days', '14days', '30days'].includes(newRange)) {
                    setTimelineStartDate(new Date());
                  }
                }}
                className={styles.filterSelect}
              >
                <optgroup label="Périodes fixes">
                  <option value="week">Semaine actuelle</option>
                  <option value="month">Mois actuel</option>
                  <option value="3months">3 derniers mois</option>
                  <option value="year">Année actuelle</option>
                </optgroup>
                
                {viewMode === 'timeline' && (
                  <optgroup label="Timeline">
                    <option value="7days">Timeline 7 jours</option>
                    <option value="14days">Timeline 14 jours</option>
                    <option value="30days">Timeline 30 jours</option>
                  </optgroup>
                )}
                
                <optgroup label="Personnalisé">
                  <option value="custom">Période personnalisée</option>
                </optgroup>
              </select>
            </div>

            {/* ✅ Dates personnalisées */}
            {filters.dateRange === 'custom' && (
              <>
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Du</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className={styles.dateInput}
                  />
                </div>
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Au</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className={styles.dateInput}
                  />
                </div>
              </>
            )}

            {filters.dateRange === 'month' && (
              <>
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Mois</label>
                  <select
                    value={filters.month}
                    onChange={(e) => setFilters({...filters, month: parseInt(e.target.value)})}
                    className={styles.filterSelect}
                  >
                    {Array.from({length: 12}, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2024, i).toLocaleDateString('fr-FR', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Année</label>
                  <select
                    value={filters.year}
                    onChange={(e) => setFilters({...filters, year: parseInt(e.target.value)})}
                    className={styles.filterSelect}
                  >
                    {Array.from({length: 5}, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return <option key={year} value={year}>{year}</option>;
                    })}
                  </select>
                </div>
              </>
            )}

            <div className={styles.actionButtons}>
              <button
                onClick={exportToText}
                className={styles.exportButton}
                title="Exporter en fichier texte"
                disabled={filteredPresences.length === 0}
              >
                <FaDownload className={styles.exportIcon} />
                Export
              </button>

              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className={styles.refreshButton}
                title="Actualiser"
              >
                <FaSyncAlt className={`${styles.refreshIcon} ${isRetrying ? styles.spinning : ''}`} />
                Actualiser
              </button>
            </div>
          </div>
        </div>

        {/* ✅ Navigation de période avec raccourcis - inspirée de PlanningPage */}
        <div className={styles.periodSelectorContainer}>
          <div className={styles.periodNavigation}>
            <button
              onClick={() => navigatePeriod('prev')}
              className={styles.periodNavButton}
              disabled={!['week', 'month', 'year'].includes(filters.dateRange)}
            >
              ←
            </button>

            <div className={styles.periodInfo}>
              <div className={styles.periodLabel}>
                {getCurrentPeriodLabel()}
              </div>
              <div className={styles.periodSubLabel}>
                {(() => {
                  const { startDate, endDate } = getDateRange();
                  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                  return `${days} jours`;
                })()}
              </div>
            </div>

            <button
              onClick={() => navigatePeriod('next')}
              className={styles.periodNavButton}
              disabled={!['week', 'month', 'year'].includes(filters.dateRange)}
            >
              →
            </button>
          </div>

          {/* ✅ Raccourcis rapides */}
          <div className={styles.periodPresets}>
            <span className={styles.presetsLabel}>Raccourcis :</span>
            
            <button onClick={() => setQuickPeriod('today')} className={styles.presetButton}>
              Aujourd'hui
            </button>

            <button onClick={() => setQuickPeriod('7days')} className={styles.presetButton}>
              7 derniers jours
            </button>

            <button onClick={() => setQuickPeriod('30days')} className={styles.presetButton}>
              30 derniers jours
            </button>

            <button onClick={() => setQuickPeriod('thisWeek')} className={styles.presetButton}>
              Cette Semaine
            </button>

            <button onClick={() => setQuickPeriod('thisMonth')} className={styles.presetButton}>
              Ce Mois
            </button>

            <button onClick={() => setQuickPeriod('thisYear')} className={styles.presetButton}>
              Cette Année
            </button>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className={styles.mainContent}>
        {viewMode === 'calendar' && <CalendarView />}
        {viewMode === 'heatmap' && <HeatmapView />}
        {viewMode === 'timeline' && <TimelineView />}
        {viewMode === 'list' && <ListView />}
      </div>

      {/* Footer avec informations supplémentaires */}
      {filteredPresences.length > 0 && (
        <div className={styles.footer}>
          <div className={styles.footerStats}>
            <div className={styles.footerStat}>
              <strong>Première présence:</strong> {stats.firstPresence ? formatDate(new Date(stats.firstPresence), "dd/MM/yyyy") : '-'}
            </div>
            <div className={styles.footerStat}>
              <strong>Dernière présence:</strong> {stats.lastPresence ? formatDate(new Date(stats.lastPresence), "dd/MM/yyyy") : '-'}
            </div>
            <div className={styles.footerStat}>
              <strong>Période analysée:</strong> {formatDate(startDate, "dd/MM")} - {formatDate(endDate, "dd/MM/yyyy")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyAttendancesPage;