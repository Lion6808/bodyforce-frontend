import React, { useEffect, useState } from "react";
import { Calendar, Users, Filter, Grid, List, ChevronLeft, ChevronRight, RefreshCw, AlertCircle } from "lucide-react";
import { supabaseServices } from "../supabaseClient";

// Utilitaires de date
const formatDate = (date, format) => {
  const options = {
    'yyyy-MM-dd': { year: 'numeric', month: '2-digit', day: '2-digit' },
    'dd/MM/yyyy': { day: '2-digit', month: '2-digit', year: 'numeric' },
    'EEE dd/MM': { weekday: 'short', day: '2-digit', month: '2-digit' },
    'EEE dd': { weekday: 'short', day: '2-digit' },
    'HH:mm': { hour: '2-digit', minute: '2-digit', hour12: false },
  };

  if (format === 'yyyy-MM-dd') {
    return date.toISOString().split('T')[0];
  }

  return new Intl.DateTimeFormat('fr-FR', options[format] || {}).format(date);
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
  newDate.setDate(newDate.getDate() + (weeks * 7));
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

function PlanningPage() {
  const [presences, setPresences] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("week");
  const [startDate, setStartDate] = useState(startOfDay(subWeeks(new Date(), 1)));
  const [endDate, setEndDate] = useState(endOfDay(new Date()));
  const [filterBadge, setFilterBadge] = useState("");
  const [filterName, setFilterName] = useState("");
  const [showNightHours, setShowNightHours] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(formatDate(startOfDay(subWeeks(new Date(), 1)), 'yyyy-MM-dd'));

  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      if (width < 768) {
        setViewMode("list");
      } else if (width < 1200) {
        setViewMode("compact");
      } else {
        setViewMode("grid");
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Charger les données depuis Supabase
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Chargement des données - Période:', formatDate(startDate, 'dd/MM/yyyy'), 'au', formatDate(endDate, 'dd/MM/yyyy'));

      // Charger les membres et présences en parallèle
      const [membersData, presencesData] = await Promise.all([
        supabaseServices.getMembers(),
        supabaseServices.getPresences(startDate, endDate)
      ]);

      setMembers(membersData);
      setPresences(presencesData);

      console.log(`✅ Données chargées: ${presencesData.length} présences, ${membersData.length} membres`);

      // Afficher quelques statistiques dans la console
      if (presencesData.length > 0) {
        const uniqueBadges = [...new Set(presencesData.map(p => p.badgeId))];
        console.log(`📊 ${uniqueBadges.length} badges différents ont des présences sur cette période`);
      }

    } catch (err) {
      console.error("❌ Erreur chargement données:", err);
      setError(`Erreur lors du chargement: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Tester la connexion au démarrage
  useEffect(() => {
    const testConnection = async () => {
      const isConnected = await supabaseServices.testConnection();
      if (!isConnected) {
        setError("Impossible de se connecter à la base de données");
      }
    };
    testConnection();
  }, []);

  // Charger les données quand les dates changent
  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const updateDateRange = (value, base = new Date()) => {
    const start = startOfDay(base);
    let end = endOfDay(base);
    if (value === "week") end = endOfDay(addWeeks(start, 1));
    if (value === "month") end = endOfDay(addMonths(start, 1));
    if (value === "year") end = endOfDay(addYears(start, 1));
    setStartDate(start);
    setEndDate(end);
    setCustomStartDate(formatDate(start, 'yyyy-MM-dd'));
  };

  const handleCustomDateChange = (dateString) => {
    setCustomStartDate(dateString);
    const newStartDate = startOfDay(new Date(dateString));
    updateDateRange(period, newStartDate);
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

  // Convertir les timestamps PostgreSQL en objets Date
  const toLocalDate = (timestamp) => {
    if (!timestamp) return new Date();

    if (timestamp instanceof Date) {
      return timestamp;
    }

    if (typeof timestamp === 'string') {
      // PostgreSQL timestamp with timezone
      return new Date(timestamp);
    }

    return new Date(timestamp);
  };

  // Filtrer les présences par période
  const filteredPresences = presences.filter((p) => {
    const d = toLocalDate(p.timestamp);
    if (isNaN(d.getTime())) {
      console.warn('Date invalide dans présence:', p.id, p.timestamp);
      return false;
    }
    return isWithinInterval(d, { start: startDate, end: endDate });
  });

  // Grouper les présences par badge
  const groupedByBadge = {};
  filteredPresences.forEach((p) => {
    const badgeId = p.badgeId;
    if (!groupedByBadge[badgeId]) groupedByBadge[badgeId] = [];
    const presenceDate = toLocalDate(p.timestamp);
    if (!isNaN(presenceDate.getTime())) {
      groupedByBadge[badgeId].push(presenceDate);
    }
  });

  const allDays = eachDayOfInterval({ start: startDate, end: endDate });
  const fullHours = Array.from({ length: 24 }, (_, i) => i);
  const hours = showNightHours ? fullHours : fullHours.slice(6);

  // Obtenir les infos d'un membre par badgeId
  const getMemberInfo = (badgeId) => {
    const member = members.find(m => m.badgeId === badgeId);
    return member || {
      id: null,
      badgeId: badgeId,
      name: "Membre inconnu",
      firstName: "",
      photo: null
    };
  };

  // Filtrer les badges visibles
  const visibleBadges = Object.keys(groupedByBadge).filter(badgeId => {
    const member = getMemberInfo(badgeId);
    return (
      (!filterName || `${member.name} ${member.firstName}`.toLowerCase().includes(filterName.toLowerCase())) &&
      (!filterBadge || badgeId.includes(filterBadge))
    );
  });

  // Vue liste pour mobile
  const ListView = () => (
    <div className="space-y-4">
      {visibleBadges.map((badgeId) => {
        const member = getMemberInfo(badgeId);
        const memberPresences = groupedByBadge[badgeId] || [];
        const dailyPresences = {};

        memberPresences.forEach(timestamp => {
          const dayKey = formatDate(timestamp, 'yyyy-MM-dd');
          if (!dailyPresences[dayKey]) dailyPresences[dayKey] = [];
          dailyPresences[dayKey].push(timestamp);
        });

        return (
          <div key={badgeId} className="bg-white rounded-xl shadow-md p-4 border border-gray-100 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              {member.photo ? (
                <img src={member.photo} alt="avatar" className="w-14 h-14 object-cover rounded-full border-2 border-blue-200" />
              ) : (
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {member.firstName?.[0] || 'M'}{member.name?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-lg truncate">
                  {member.name} {member.firstName}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm text-gray-500 truncate">Badge: {badgeId}</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap">
                    {memberPresences.length} présence(s)
                  </span>
                  {!member.id && (
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                      ⚠️ Non trouvé
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {allDays.map(day => {
                const dayKey = formatDate(day, 'yyyy-MM-dd');
                const dayPresences = dailyPresences[dayKey] || [];
                const hasPresences = dayPresences.length > 0;

                return (
                  <div key={dayKey} className={`p-3 rounded-lg text-center transition-all hover:scale-105 ${hasPresences ? 'bg-gradient-to-br from-green-100 to-green-200 border-2 border-green-300 shadow-sm' :
                      isWeekend(day) ? 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200' :
                        'bg-gray-50 border border-gray-200'
                    }`}>
                    <div className="font-semibold text-sm mb-1">{formatDate(day, 'EEE dd')}</div>
                    {hasPresences ? (
                      <div className="space-y-1">
                        {dayPresences.slice(0, 2).map((p, idx) => (
                          <div key={idx} className="bg-green-600 text-white px-2 py-1 rounded-md text-xs font-medium">
                            {formatDate(p, 'HH:mm')}
                          </div>
                        ))}
                        {dayPresences.length > 2 && (
                          <div className="text-green-700 text-xs font-medium">+{dayPresences.length - 2}</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-400 text-xs">—</div>
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

  // Vue compacte pour tablettes
  const CompactView = () => (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6 border border-gray-200">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
            <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Planning des présences</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Données temps réel depuis Supabase • {presences.length} présences chargées
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Bouton refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            title="Actualiser les données"
          >
            <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Statistiques rapides */}
          <div className="bg-gray-100 rounded-lg px-3 py-2 sm:px-4 sm:py-2 text-center">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">{visibleBadges.length}</div>
            <div className="text-xs text-gray-600">Badges</div>
          </div>
          <div className="bg-gray-100 rounded-lg px-3 py-2 sm:px-4 sm:py-2 text-center">
            <div className="text-xl sm:text-2xl font-bold text-green-600">{filteredPresences.length}</div>
            <div className="text-xs text-gray-600">Présences</div>
          </div>

          {/* Boutons de vue */}
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1 sm:gap-2">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1 sm:p-2 rounded-md transition-all ${viewMode === "list" ? "bg-white shadow-md text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
              title="Vue liste"
            >
              <List className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={() => setViewMode("compact")}
              className={`p-1 sm:p-2 rounded-md transition-all ${viewMode === "compact" ? "bg-white shadow-md text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
              title="Vue compacte"
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1 sm:p-2 rounded-md transition-all ${viewMode === "grid" ? "bg-white shadow-md text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
              title="Vue grille détaillée"
            >
              <Grid className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 sm:p-3 rounded-lg transition-all ${showFilters ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Navigation période */}
      <div className="flex flex-col sm:flex-row items-center justify-between mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 rounded-lg gap-3 sm:gap-4">
        <button
          onClick={() => navigatePeriod("prev")}
          className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm"
          title="Période précédente"
        >
          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
        </button>

        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 flex-1 w-full sm:w-auto">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center w-full sm:w-auto">
            <select
              className="border-2 border-gray-200 rounded-lg px-3 py-2 sm:px-4 sm:py-2 focus:border-blue-500 focus:outline-none bg-white font-medium w-full sm:w-auto"
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

            <div className="flex flex-col sm:flex-row gap-2 items-center w-full sm:w-auto">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Date début :</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => handleCustomDateChange(e.target.value)}
                className="border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none bg-white text-sm w-full sm:w-auto"
              />
            </div>
          </div>

          <div className="text-center">
            <div className="text-sm sm:text-lg font-bold text-gray-900 break-words">
              {formatDate(startDate, "dd/MM/yyyy")} - {formatDate(endDate, "dd/MM/yyyy")}
            </div>
            <div className="text-xs sm:text-sm text-gray-600">{allDays.length} jours</div>
          </div>
        </div>

        <button
          onClick={() => navigatePeriod("next")}
          className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm"
          title="Période suivante"
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
        </button>
      </div>
    </div>
  );

  // Vue grille complète pour desktop
  const GridView = () => (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      <div className="overflow-auto max-h-[75vh]">
        <div className="min-w-max">
          <div className="grid" style={{ gridTemplateColumns: `240px repeat(${allDays.length * hours.length}, 45px)` }}>
            <div className="sticky top-0 left-0 bg-gradient-to-r from-blue-600 to-purple-600 z-20 h-16 border-b border-r flex items-center justify-center font-bold text-white">
              <div className="text-center">
                <Users className="w-6 h-6 mx-auto mb-1" />
                <div className="text-sm">Membres</div>
              </div>
            </div>
            {allDays.map((day, dIdx) =>
              hours.map((h, hIdx) => (
                <div
                  key={`header-${dIdx}-${h}`}
                  className={`text-[9px] border-b border-r flex flex-col items-center justify-center h-16 font-medium ${isWeekend(day) ? "bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800" :
                      "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700"
                    }`}
                >
                  {hIdx === 0 && (
                    <div className="font-bold whitespace-nowrap mb-1">
                      {formatDate(day, 'EEE dd/MM')}
                    </div>
                  )}
                  <div className="font-semibold">{`${h.toString().padStart(2, "0")}h`}</div>
                </div>
              ))
            )}
            {visibleBadges.map((badgeId, idx) => {
              const member = getMemberInfo(badgeId);

              return (
                <React.Fragment key={badgeId}>
                  <div className={`sticky left-0 z-10 px-3 py-2 border-r border-b h-16 flex items-center gap-3 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}>
                    {member.photo ? (
                      <img src={member.photo} alt="avatar" className="w-12 h-12 object-cover rounded-full border border-gray-300" />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {member.firstName?.[0] || 'M'}{member.name?.[0] || '?'}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-sm truncate">{member.name} {member.firstName}</span>
                      <span className="text-xs text-gray-500">
                        Badge: {badgeId} • {groupedByBadge[badgeId]?.length || 0} présence(s)
                      </span>
                    </div>
                  </div>
                  {allDays.map((day) =>
                    hours.map((h) => {
                      const times = groupedByBadge[badgeId] || [];
                      const present = times.some((t) =>
                        t.getFullYear() === day.getFullYear() &&
                        t.getMonth() === day.getMonth() &&
                        t.getDate() === day.getDate() &&
                        t.getHours() === h
                      );
                      return (
                        <div
                          key={`${badgeId}-${day.toISOString()}-${h}`}
                          className={`h-16 border-b border-r relative group transition-all duration-200 ${present ? "bg-gradient-to-br from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 cursor-pointer shadow-sm" :
                              isWeekend(day) ? "bg-blue-50 hover:bg-blue-100" :
                                idx % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50 hover:bg-gray-100"
                            }`}
                        >
                          {present && (
                            <>
                              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                                <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                                  <span className="text-white font-bold text-lg">✓</span>
                                </div>
                              </div>
                              <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                                <div className="font-semibold">{formatDate(day, 'EEE dd/MM')} à {h}h</div>
                                <div className="opacity-90">{member.name} {member.firstName}</div>
                                <div className="opacity-75">Badge: {badgeId}</div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Chargement des présences depuis Supabase...</p>
          <p className="text-sm text-gray-500 mt-2">Connexion à la base de données</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg border-2 border-red-200 max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-600 mb-2">Erreur de connexion</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={fetchData}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 w-full justify-center"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors w-full"
            >
              Recharger la page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Planning des présences</h1>
                <p className="text-gray-600 mt-1">
                  Données temps réel depuis Supabase • {presences.length} présences chargées
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Bouton refresh */}
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                title="Actualiser les données"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              {/* Statistiques rapides */}
              <div className="bg-gray-100 rounded-lg px-4 py-2 text-center">
                <div className="text-2xl font-bold text-blue-600">{visibleBadges.length}</div>
                <div className="text-xs text-gray-600">Badges</div>
              </div>

              <div className="bg-gray-100 rounded-lg px-4 py-2 text-center">
                <div className="text-2xl font-bold text-green-600">{filteredPresences.length}</div>
                <div className="text-xs text-gray-600">Présences</div>
              </div>

              {/* Boutons de vue */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-md transition-all ${viewMode === "list" ? "bg-white shadow-md text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                  title="Vue liste"
                >
                  <List className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("compact")}
                  className={`p-2 rounded-md transition-all ${viewMode === "compact" ? "bg-white shadow-md text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                  title="Vue compacte"
                >
                  <Users className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-md transition-all ${viewMode === "grid" ? "bg-white shadow-md text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                  title="Vue grille détaillée"
                >
                  <Grid className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-3 rounded-lg transition-all ${showFilters ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation période */}
          <div className="flex flex-col sm:flex-row items-center justify-between mt-6 p-4 bg-gray-50 rounded-lg gap-4">
            <button
              onClick={() => navigatePeriod("prev")}
              className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm"
              title="Période précédente"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 w-full sm:w-auto">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center w-full sm:w-auto">
                <select
                  className="border-2 border-gray-200 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none bg-white font-medium w-full sm:w-auto"
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

                <div className="flex flex-col sm:flex-row gap-2 items-center w-full sm:w-auto">
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Date début :</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => handleCustomDateChange(e.target.value)}
                    className="border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none bg-white text-sm w-full sm:w-auto"
                  />
                </div>
              </div>

              <div className="text-center">
                <div className="text-base sm:text-lg font-bold text-gray-900 break-words">
                  {formatDate(startDate, "dd/MM/yyyy")} - {formatDate(endDate, "dd/MM/yyyy")}
                </div>
                <div className="text-sm text-gray-600">{allDays.length} jours</div>
              </div>
            </div>

            <button
              onClick={() => navigatePeriod("next")}
              className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm"
              title="Période suivante"
            >
              <ChevronRight className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Filtres */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher par nom</label>
                <input
                  type="text"
                  placeholder="Nom ou prénom..."
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Filtrer par badge</label>
                <input
                  type="text"
                  placeholder="Numéro de badge..."
                  value={filterBadge}
                  onChange={(e) => setFilterBadge(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-3 text-sm font-medium p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={showNightHours}
                    onChange={() => setShowNightHours(!showNightHours)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  Afficher 00h - 06h
                </label>
              </div>
              <div className="flex items-end">
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg w-full">
                  <div className="font-semibold text-blue-800 mb-1">État de la base :</div>
                  <div className="space-y-1">
                    <div>{members.length} membres</div>
                    <div>{presences.length} présences totales</div>
                    <div>{filteredPresences.length} sur la période</div>
                    <div>{visibleBadges.length} badges affichés</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contenu principal */}
        {visibleBadges.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-gray-200">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucune présence trouvée</h3>
            <p className="text-gray-500 mb-4">
              {presences.length === 0
                ? "Aucune présence enregistrée dans la base de données Supabase."
                : "Aucune présence trouvée sur cette période avec les filtres appliqués."
              }
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={fetchData}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Actualiser
              </button>
              {(filterName || filterBadge) && (
                <button
                  onClick={() => {
                    setFilterName("");
                    setFilterBadge("");
                  }}
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Réinitialiser filtres
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {viewMode === "list" && <ListView />}
            {viewMode === "compact" && <CompactView />}
            {viewMode === "grid" && <GridView />}
          </>
        )}
      </div>
    </div>
  );
}

export default PlanningPage;