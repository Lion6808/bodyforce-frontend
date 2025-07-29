// src/pages/MyAttendancesPage.jsx
import React, { useEffect, useState } from "react";
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
  FaRefresh,
} from "react-icons/fa";
import styles from "./MyAttendancesPage.module.css";

// Client Supabase - utilise la même configuration que PlanningPage
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

// Utilitaires de date - copiés de PlanningPage
const formatDate = (date, format) => {
  const options = {
    "yyyy-MM-dd": { year: "numeric", month: "2-digit", day: "2-digit" },
    "dd/MM/yyyy": { day: "2-digit", month: "2-digit", year: "numeric" },
    "EEE dd/MM": { weekday: "short", day: "2-digit", month: "2-digit" },
    "EEE dd": { weekday: "short", day: "2-digit" },
    "HH:mm": { hour: "2-digit", minute: "2-digit", hour12: false },
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

function MyAttendancesPage() {
  const { user, role } = useAuth();
  const [presences, setPresences] = useState([]);
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    dateRange: 'month' // 'week', 'month', '3months', 'year'
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      fetchMemberData();
    }
  }, [user]);

  useEffect(() => {
    if (memberData) {
      loadPresences();
    }
  }, [memberData, filters]);

  const fetchMemberData = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setMemberData(data);
    } catch (err) {
      console.error('Erreur récupération membre:', err);
      setError('Impossible de récupérer votre profil de membre');
    }
  };

  const loadPresences = async (showRetryIndicator = false) => {
    if (!memberData?.badgeId) return;

    try {
      if (showRetryIndicator) {
        setIsRetrying(true);
      }
      setLoading(true);
      setError("");

      // Calculer la plage de dates selon les filtres
      let startDate, endDate;
      const now = new Date();
      
      switch (filters.dateRange) {
        case 'week':
          startDate = startOfDay(new Date(now.setDate(now.getDate() - 7)));
          endDate = endOfDay(new Date());
          break;
        case 'month':
          startDate = startOfDay(new Date(filters.year, filters.month - 1, 1));
          endDate = endOfDay(new Date(filters.year, filters.month, 0));
          break;
        case '3months':
          endDate = endOfDay(new Date(filters.year, filters.month, 0));
          startDate = startOfDay(addMonths(endDate, -2));
          break;
        case 'year':
          startDate = startOfDay(new Date(filters.year, 0, 1));
          endDate = endOfDay(new Date(filters.year, 11, 31));
          break;
        default:
          startDate = startOfDay(new Date(filters.year, filters.month - 1, 1));
          endDate = endOfDay(new Date(filters.year, filters.month, 0));
      }

      console.log("🔄 Chargement des présences pour:", memberData.badgeId, {
        début: startDate.toLocaleDateString(),
        fin: endDate.toLocaleDateString(),
      });

      // Chargement des présences FILTRÉ par badge et période - inspiré de PlanningPage
      let allPresences = [];
      let from = 0;
      const pageSize = 1000;
      let done = false;

      while (!done) {
        const { data, error } = await supabase
          .from("presences")
          .select("*")
          .eq("badgeId", memberData.badgeId) // Filtrer par le badge du membre connecté
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
        ...p,
        parsedDate: parseTimestamp(p.timestamp),
        date: formatDate(parseTimestamp(p.timestamp), "yyyy-MM-dd"),
        time: formatDate(parseTimestamp(p.timestamp), "HH:mm"),
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

  // Filtrer les présences par terme de recherche
  const filteredPresences = presences.filter(presence => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      presence.badgeId?.toLowerCase().includes(searchLower) ||
      formatDate(presence.parsedDate, "dd/MM/yyyy").includes(searchLower) ||
      presence.time.includes(searchLower)
    );
  });

  const getPresencesByDate = () => {
    const groupedByDate = {};
    filteredPresences.forEach((presence) => {
      const dateKey = presence.date;
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(presence);
    });

    // Trier les dates par ordre décroissant
    return Object.keys(groupedByDate)
      .sort((a, b) => new Date(b) - new Date(a))
      .map(date => ({
        date,
        presences: groupedByDate[date].sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        )
      }));
  };

  const getAttendanceStats = () => {
    const total = filteredPresences.length;
    
    // Compter les jours uniques avec présence
    const uniqueDays = new Set(filteredPresences.map(p => p.date)).size;
    
    // Calculer la moyenne de présences par jour
    const avgPerDay = uniqueDays > 0 ? (total / uniqueDays).toFixed(1) : 0;
    
    return {
      total,
      uniqueDays,
      avgPerDay,
      firstPresence: filteredPresences.length > 0 ? 
        Math.min(...filteredPresences.map(p => new Date(p.timestamp))) : null,
      lastPresence: filteredPresences.length > 0 ? 
        Math.max(...filteredPresences.map(p => new Date(p.timestamp))) : null
    };
  };

  const exportToPDF = () => {
    // Créer un contenu basique pour l'export
    const presencesByDate = getPresencesByDate();
    const stats = getAttendanceStats();
    
    let content = `Rapport de présences - ${memberData.firstName} ${memberData.name}\n`;
    content += `Badge: ${memberData.badgeId}\n`;
    content += `Période: ${formatDate(new Date(filters.year, filters.month - 1, 1), "dd/MM/yyyy")} - ${formatDate(new Date(filters.year, filters.month, 0), "dd/MM/yyyy")}\n\n`;
    content += `Statistiques:\n`;
    content += `- Total présences: ${stats.total}\n`;
    content += `- Jours présents: ${stats.uniqueDays}\n`;
    content += `- Moyenne par jour: ${stats.avgPerDay}\n\n`;
    
    content += `Détail par jour:\n`;
    presencesByDate.forEach(({ date, presences }) => {
      content += `\n${formatDate(new Date(date), "EEE dd/MM/yyyy")} (${presences.length} présence(s)):\n`;
      presences.forEach(p => {
        content += `  - ${p.time}\n`;
      });
    });

    // Créer et télécharger le fichier
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presences_${memberData.badgeId}_${filters.month}-${filters.year}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Écrans de chargement et d'erreur - inspirés de PlanningPage
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
              <FaRefresh className={`${styles.retryIcon} ${styles.spinning}`} />
              Reconnexion...
            </>
          ) : (
            <>
              <FaRefresh className={styles.retryIcon} />
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

  const stats = getAttendanceStats();
  const presencesByDate = getPresencesByDate();

  return (
    <div className={styles.container}>
      {/* En-tête avec statistiques */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            <h1 className={styles.pageTitle}>
              <FaCalendarCheck className={styles.titleIcon} />
              Mes Présences
            </h1>
            <p className={styles.memberName}>
              {memberData.firstName} {memberData.name} - Badge: {memberData.badgeId}
            </p>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{stats.total}</div>
              <div className={styles.statLabel}>Total présences</div>
            </div>
            <div className={`${styles.statCard} ${styles.present}`}>
              <div className={styles.statNumber}>{stats.uniqueDays}</div>
              <div className={styles.statLabel}>Jours présents</div>
            </div>
            <div className={`${styles.statCard} ${styles.average}`}>
              <div className={styles.statNumber}>{stats.avgPerDay}</div>
              <div className={styles.statLabel}>Moy. par jour</div>
            </div>
            <div className={`${styles.statCard} ${styles.info}`}>
              <div className={styles.statNumber}>
                {stats.lastPresence ? formatDate(new Date(stats.lastPresence), "dd/MM") : '-'}
              </div>
              <div className={styles.statLabel}>Dernière</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className={styles.filtersSection}>
        <div className={styles.filtersGrid}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>
              <FaSearch className={styles.filterIcon} />
              Rechercher
            </label>
            <input
              type="text"
              placeholder="Date, heure..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>
              <FaFilter className={styles.filterIcon} />
              Période
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
              className={styles.filterSelect}
            >
              <option value="week">7 derniers jours</option>
              <option value="month">Ce mois</option>
              <option value="3months">3 derniers mois</option>
              <option value="year">Cette année</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Mois</label>
            <select
              value={filters.month}
              onChange={(e) => setFilters({...filters, month: parseInt(e.target.value)})}
              className={styles.filterSelect}
              disabled={filters.dateRange !== 'month'}
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

          <button
            onClick={exportToPDF}
            className={styles.exportButton}
            title="Exporter en fichier texte"
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
            <FaRefresh className={`${styles.refreshIcon} ${isRetrying ? styles.spinning : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Liste des présences */}
      <div className={styles.attendancesList}>
        {filteredPresences.length === 0 ? (
          <div className={styles.emptyState}>
            <FaCalendarCheck className={styles.emptyIcon} />
            <h3>Aucune présence trouvée</h3>
            <p>Aucune présence ne correspond à vos critères de recherche.</p>
            <button
              onClick={handleRetry}
              className={styles.retryButton}
            >
              <FaRefresh className={styles.retryIcon} />
              Recharger les données
            </button>
          </div>
        ) : (
          <div className={styles.attendancesByDate}>
            {presencesByDate.map(({ date, presences }) => (
              <div key={date} className={styles.dateGroup}>
                <div className={styles.dateHeader}>
                  <h3 className={styles.dateTitle}>
                    {formatDate(new Date(date), "EEE dd/MM/yyyy")}
                  </h3>
                  <span className={styles.dateCount}>
                    {presences.length} présence{presences.length > 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className={styles.presencesGrid}>
                  {presences.map((presence, index) => (
                    <div key={`${presence.badgeId}-${presence.timestamp}-${index}`} className={styles.presenceCard}>
                      <div className={styles.presenceTime}>
                        <FaClock className={styles.timeIcon} />
                        <span className={styles.timeText}>{presence.time}</span>
                      </div>
                      <div className={styles.presenceDetails}>
                        <span className={styles.badgeInfo}>
                          Badge: {presence.badgeId}
                        </span>
                        <span className={styles.timestampInfo}>
                          {formatDate(presence.parsedDate, "dd/MM/yyyy")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MyAttendancesPage;