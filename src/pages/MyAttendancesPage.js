// 📄 MyAttendancesPage.jsx — Page de suivi personnel — BODYFORCE
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
        console.log("⚠️ Aucun membre trouvé pour cet utilisateur");
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
      setFilters({ ...filters, dateRange: '7days' });
      setTimelineStartDate(new Date());
    } else if (newViewMode === 'calendar' && ['7days', '14days', '30days'].includes(filters.dateRange)) {
      setFilters({ ...filters, dateRange: 'month' });
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

    setFilters({ ...filters, dateRange: 'custom' });
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
            onClick={() => setFilters({ ...filters, month: filters.month === 1 ? 12 : filters.month - 1, year: filters.month === 1 ? filters.year - 1 : filters.year })}
            className={styles.navButton}
          >
            ←
          </button>
          <h3 className={styles.monthTitle}>
            {new Date(filters.year, filters.month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={() => setFilters({ ...filters, month: filters.month === 12 ? 1 : filters.month + 1, year: filters.month === 12 ? filters.year + 1 : filters.year })}
            className={styles.navButton}
          >
            →
          </button>
        </div>
      </div>
      <div className={styles.presenceList}>
        {getPresencesByDate().map(({ date, presences, isWeekend }) => (
          <div
            key={date}
            className={`${styles.dateGroup} ${isWeekend ? styles.weekend : ""}`}
          >
            <h4 className={styles.dateLabel}>
              {formatDate(new Date(date), "full")} ({presences.length})
            </h4>
            <ul className={styles.presenceItems}>
              {presences.map((presence, index) => (
                <li key={index} className={styles.presenceItem}>
                  <FaClock className={styles.presenceIcon} />
                  {presence.time}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );

  // ✅ COMPOSANT TIMELINE - corrigé pour 30 jours (espacement + largeur adaptative)
  const TimelineView = () => {
    const getBarWidth = () => {
      const count = timelineData.length;
      if (count <= 7) return "60px";
      if (count <= 14) return "50px";
      if (count <= 30) return "32px";
      return "20px";
    };

    const getGap = () => {
      const count = timelineData.length;
      if (count <= 7) return "16px";
      if (count <= 14) return "12px";
      if (count <= 30) return "8px";
      return "4px";
    };

    const getTimelineHeight = () => {
      const max = Math.max(...timelineData.map(day => day.count), 1);
      return Math.min(240, 40 + max * 12);
    };

    return (
      <div className={styles.timelineChart}>
        <div className={styles.timelineControls}>
          <button
            onClick={() => setTimelineStartDate(addDays(timelineStartDate, -timelineData.length))}
            className={styles.timelineNavButton}
          >
            ←
          </button>
          <div className={styles.timelinePeriodLabel}>
            {getCurrentPeriodLabel()}
          </div>
          <button
            onClick={() => setTimelineStartDate(addDays(timelineStartDate, timelineData.length))}
            className={styles.timelineNavButton}
          >
            →
          </button>
        </div>

        <div
          className={styles.timelineBarsContainer}
          style={{
            height: getTimelineHeight(),
            gap: getGap(),
          }}
        >
          {timelineData.map((day, index) => (
            <div
              key={index}
              className={styles.timelineDay}
              style={{
                width: getBarWidth(),
                flexShrink: 0,
              }}
            >
              <div
                className={styles.timelineBar}
                style={{
                  height: `${Math.min(100, day.count * 10)}%`,
                }}
              />
              <div className={styles.timelineLabel}>
                {formatDate(day.date, "EEE dd")}
              </div>
              <div className={styles.timelineCount}>
                {day.count}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Mes Présences</h1>
        <div className={styles.viewSwitch}>
          <button
            className={`${styles.switchButton} ${viewMode === 'calendar' ? styles.active : ''}`}
            onClick={() => handleViewModeChange('calendar')}
          >
            <FaCalendarAlt />
            Calendrier
          </button>
          <button
            className={`${styles.switchButton} ${viewMode === 'timeline' ? styles.active : ''}`}
            onClick={() => handleViewModeChange('timeline')}
          >
            <FaChartLine />
            Timeline
          </button>
        </div>
      </div>

      <div className={styles.controls}>
        <input
          type="text"
          placeholder="Rechercher..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />

        <div className={styles.quickPeriodButtons}>
          <button onClick={() => setQuickPeriod('today')}>Aujourd'hui</button>
          <button onClick={() => setQuickPeriod('7days')}>7 jours</button>
          <button onClick={() => setQuickPeriod('30days')}>30 jours</button>
          <button onClick={() => setQuickPeriod('thisWeek')}>Cette semaine</button>
          <button onClick={() => setQuickPeriod('thisMonth')}>Ce mois</button>
          <button onClick={() => setQuickPeriod('thisYear')}>Cette année</button>
        </div>

        <button className={styles.exportButton} onClick={exportToText}>
          <FaDownload />
          Exporter .txt
        </button>
      </div>

      {error && renderConnectionError()}
      {loading && renderLoading()}

      {!loading && !error && (
        <>
          {viewMode === 'calendar' && <CalendarView />}
          {viewMode === 'timeline' && <TimelineView />}
        </>
      )}
    </div>
  );
}

export default MyAttendancesPage;

// ✅ FIN DU FICHIER
