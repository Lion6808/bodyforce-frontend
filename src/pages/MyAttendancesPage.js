// src/pages/MyAttendancesPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
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
} from "react-icons/fa";
import styles from "./MyAttendancesPage.module.css";

function MyAttendancesPage() {
  const { user, role } = useAuth();
  const [attendances, setAttendances] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    status: 'all',
    sessionType: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      fetchMemberData();
    }
  }, [user]);

  useEffect(() => {
    if (memberData) {
      fetchAttendances();
      fetchSessions();
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

  const fetchAttendances = async () => {
    if (!memberData) return;

    try {
      setLoading(true);
      
      let query = supabase
        .from('attendances')
        .select(`
          *,
          session:sessions(
            id,
            name,
            date,
            startTime,
            endTime,
            location,
            sessionType,
            description
          )
        `)
        .eq('member_id', memberData.id)
        .order('date', { ascending: false });

      // Appliquer les filtres
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.month && filters.year) {
        const startDate = new Date(filters.year, filters.month - 1, 1);
        const endDate = new Date(filters.year, filters.month, 0);
        query = query
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data || [];

      // Filtrer par type de session
      if (filters.sessionType !== 'all') {
        filteredData = filteredData.filter(att => 
          att.session?.sessionType === filters.sessionType
        );
      }

      // Filtrer par terme de recherche
      if (searchTerm) {
        filteredData = filteredData.filter(att =>
          att.session?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          att.session?.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          att.notes?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setAttendances(filteredData);
    } catch (err) {
      console.error('Erreur récupération présences:', err);
      setError('Impossible de récupérer vos présences');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('sessionType')
        .order('sessionType');

      if (error) throw error;

      // Extraire les types uniques
      const uniqueTypes = [...new Set(data.map(s => s.sessionType).filter(Boolean))];
      setSessions(uniqueTypes);
    } catch (err) {
      console.error('Erreur récupération sessions:', err);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'present':
        return <FaUserCheck className={`${styles.statusIcon} ${styles.present}`} />;
      case 'absent':
        return <FaCalendarTimes className={`${styles.statusIcon} ${styles.absent}`} />;
      case 'late':
        return <FaClock className={`${styles.statusIcon} ${styles.late}`} />;
      default:
        return <FaCalendarCheck className={`${styles.statusIcon} ${styles.unknown}`} />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'present':
        return 'Présent(e)';
      case 'absent':
        return 'Absent(e)';
      case 'late':
        return 'En retard';
      default:
        return status || 'Inconnu';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.slice(0, 5); // Format HH:MM
  };

  const getAttendanceStats = () => {
    const total = attendances.length;
    const present = attendances.filter(a => a.status === 'present').length;
    const absent = attendances.filter(a => a.status === 'absent').length;
    const late = attendances.filter(a => a.status === 'late').length;
    
    return {
      total,
      present,
      absent,
      late,
      presentPercent: total > 0 ? Math.round((present / total) * 100) : 0,
      absentPercent: total > 0 ? Math.round((absent / total) * 100) : 0,
      latePercent: total > 0 ? Math.round((late / total) * 100) : 0
    };
  };

  const exportToPDF = () => {
    // Logique d'export PDF - à implémenter selon vos besoins
    console.log('Export PDF des présences');
  };

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

  const stats = getAttendanceStats();

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
              {memberData.firstName} {memberData.name}
            </p>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{stats.total}</div>
              <div className={styles.statLabel}>Total</div>
            </div>
            <div className={`${styles.statCard} ${styles.present}`}>
              <div className={styles.statNumber}>
                {stats.present} ({stats.presentPercent}%)
              </div>
              <div className={styles.statLabel}>Présent(e)</div>
            </div>
            <div className={`${styles.statCard} ${styles.absent}`}>
              <div className={styles.statNumber}>
                {stats.absent} ({stats.absentPercent}%)
              </div>
              <div className={styles.statLabel}>Absent(e)</div>
            </div>
            <div className={`${styles.statCard} ${styles.late}`}>
              <div className={styles.statNumber}>
                {stats.late} ({stats.latePercent}%)
              </div>
              <div className={styles.statLabel}>En retard</div>
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
              placeholder="Nom de session, description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>
              <FaFilter className={styles.filterIcon} />
              Mois
            </label>
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

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Statut</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className={styles.filterSelect}
            >
              <option value="all">Tous</option>
              <option value="present">Présent(e)</option>
              <option value="absent">Absent(e)</option>
              <option value="late">En retard</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Type</label>
            <select
              value={filters.sessionType}
              onChange={(e) => setFilters({...filters, sessionType: e.target.value})}
              className={styles.filterSelect}
            >
              <option value="all">Tous types</option>
              {sessions.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <button
            onClick={exportToPDF}
            className={styles.exportButton}
            title="Exporter en PDF"
          >
            <FaDownload className={styles.exportIcon} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Liste des présences */}
      <div className={styles.attendancesList}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <span>Chargement de vos présences...</span>
          </div>
        ) : error ? (
          <div className={styles.errorMessage}>{error}</div>
        ) : attendances.length === 0 ? (
          <div className={styles.emptyState}>
            <FaCalendarCheck className={styles.emptyIcon} />
            <h3>Aucune présence trouvée</h3>
            <p>Aucune présence ne correspond à vos critères de recherche.</p>
          </div>
        ) : (
          <div className={styles.attendanceGrid}>
            {attendances.map((attendance) => (
              <div key={attendance.id} className={styles.attendanceCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.sessionInfo}>
                    <h3 className={styles.sessionName}>
                      {attendance.session?.name || 'Session inconnue'}
                    </h3>
                    <p className={styles.sessionDate}>
                      {formatDate(attendance.date)}
                    </p>
                  </div>
                  <div className={styles.statusBadge}>
                    {getStatusIcon(attendance.status)}
                    <span className={styles.statusText}>
                      {getStatusText(attendance.status)}
                    </span>
                  </div>
                </div>

                <div className={styles.cardContent}>
                  {attendance.session && (
                    <div className={styles.sessionDetails}>
                      <div className={styles.detailItem}>
                        <FaClock className={styles.detailIcon} />
                        <span>
                          {formatTime(attendance.session.startTime)} - {formatTime(attendance.session.endTime)}
                        </span>
                      </div>
                      
                      {attendance.session.location && (
                        <div className={styles.detailItem}>
                          <FaMapMarkerAlt className={styles.detailIcon} />
                          <span>{attendance.session.location}</span>
                        </div>
                      )}

                      {attendance.session.sessionType && (
                        <div className={styles.detailItem}>
                          <span className={styles.sessionTypeBadge}>
                            {attendance.session.sessionType}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {attendance.notes && (
                    <div className={styles.notesSection}>
                      <h4 className={styles.notesTitle}>Notes :</h4>
                      <p className={styles.notesText}>{attendance.notes}</p>
                    </div>
                  )}
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