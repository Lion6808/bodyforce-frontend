import React, { useEffect, useState } from "react";
import { Calendar, Users, Filter, Grid, List, ChevronLeft, ChevronRight } from "lucide-react";

// Utilitaires de date simplifiés
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

// Simulation des données pour la démo
const mockMembers = [
  { badgeId: "001", name: "Dupont", firstName: "Jean", photo: null },
  { badgeId: "002", name: "Martin", firstName: "Marie", photo: null },
  { badgeId: "003", name: "Bernard", firstName: "Pierre", photo: null },
  { badgeId: "004", name: "Dubois", firstName: "Sophie", photo: null },
  { badgeId: "005", name: "Leroy", firstName: "Paul", photo: null },
  { badgeId: "006", name: "Moreau", firstName: "Julie", photo: null },
];

const mockPresences = (() => {
  const presences = [];
  const now = new Date();
  for (let i = 0; i < 150; i++) {
    const date = new Date(now.getTime() - Math.random() * 14 * 24 * 60 * 60 * 1000);
    const hour = Math.floor(Math.random() * 16) + 6; // Entre 6h et 21h
    date.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
    presences.push({
      badgeId: mockMembers[Math.floor(Math.random() * mockMembers.length)].badgeId,
      timestamp: date.toISOString(),
    });
  }
  return presences;
})();

function PlanningPage() {
  const [presences, setPresences] = useState(mockPresences);
  const [members, setMembers] = useState(mockMembers);
  const [period, setPeriod] = useState("week");
  const [startDate, setStartDate] = useState(startOfDay(subWeeks(new Date(), 1)));
  const [endDate, setEndDate] = useState(endOfDay(new Date()));
  const [filterBadge, setFilterBadge] = useState("");
  const [filterName, setFilterName] = useState("");
  const [showNightHours, setShowNightHours] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // "grid", "list", "compact"
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(formatDate(startOfDay(subWeeks(new Date(), 1)), 'yyyy-MM-dd'));

  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      // Auto-select best view mode based on screen size
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

  // Fonction améliorée pour gérer les dates de Supabase
  const toLocalDate = (timestamp) => {
    if (!timestamp) return new Date();
    
    // Si c'est déjà un objet Date
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    // Si c'est une string ISO
    if (typeof timestamp === 'string') {
      // Gérer les différents formats de Supabase
      if (timestamp.includes('T') || timestamp.includes('Z')) {
        return new Date(timestamp);
      } else {
        // Format YYYY-MM-DD HH:mm:ss sans timezone
        return new Date(timestamp + 'Z'); // Ajouter Z pour UTC si pas de timezone
      }
    }
    
    return new Date(timestamp);
  };

  const filteredPresences = presences.filter((p) => {
    const d = toLocalDate(p.timestamp);
    // Vérifier que la date est valide
    if (isNaN(d.getTime())) {
      console.warn('Date invalide:', p.timestamp);
      return false;
    }
    return isWithinInterval(d, { start: startDate, end: endDate });
  });

  const groupedByMember = {};
  filteredPresences.forEach((p) => {
    const key = p.badgeId;
    if (!groupedByMember[key]) groupedByMember[key] = [];
    const presenceDate = toLocalDate(p.timestamp);
    if (!isNaN(presenceDate.getTime())) {
      groupedByMember[key].push(presenceDate);
    }
  });

  const allDays = eachDayOfInterval({ start: startDate, end: endDate });
  const fullHours = Array.from({ length: 24 }, (_, i) => i);
  const hours = showNightHours ? fullHours : fullHours.slice(6);

  const getMemberInfo = (badgeId) => members.find((m) => m.badgeId === badgeId) || {};

  const visibleMembers = Object.keys(groupedByMember)
    .map((badgeId) => getMemberInfo(badgeId))
    .filter(
      (m) =>
        (!filterName || `${m.name} ${m.firstName}`.toLowerCase().includes(filterName.toLowerCase())) &&
        (!filterBadge || m.badgeId?.includes(filterBadge))
    );

  // Vue liste pour mobile
  const ListView = () => (
    <div className="space-y-4">
      {visibleMembers.map((member) => {
        const memberPresences = groupedByMember[member.badgeId] || [];
        const dailyPresences = {};
        
        memberPresences.forEach(timestamp => {
          const dayKey = formatDate(timestamp, 'yyyy-MM-dd');
          if (!dailyPresences[dayKey]) dailyPresences[dayKey] = [];
          dailyPresences[dayKey].push(timestamp);
        });

        return (
          <div key={member.badgeId} className="bg-white rounded-xl shadow-md p-4 border border-gray-100 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              {member.photo ? (
                <img src={member.photo} alt="avatar" className="w-14 h-14 object-cover rounded-full border-2 border-blue-200" />
              ) : (
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {member.firstName?.[0]}{member.name?.[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-lg truncate">{member.name} {member.firstName}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm text-gray-500 truncate">Badge: {member.badgeId}</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap">
                    {memberPresences.length} présence(s)
                  </span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {allDays.map(day => {
                const dayKey = formatDate(day, 'yyyy-MM-dd');
                const dayPresences = dailyPresences[dayKey] || [];
                const hasPresences = dayPresences.length > 0;
                
                return (
                  <div key={dayKey} className={`p-3 rounded-lg text-center transition-all hover:scale-105 ${
                    hasPresences ? 'bg-gradient-to-br from-green-100 to-green-200 border-2 border-green-300 shadow-sm' : 
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
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <div className="min-w-full">
          <div className="grid bg-gray-50" style={{ gridTemplateColumns: `180px repeat(${allDays.length}, minmax(100px, 1fr))` }}>
            {/* En-tête */}
            <div className="sticky top-0 left-0 bg-gradient-to-r from-blue-600 to-purple-600 z-20 p-4 border-b border-r font-bold text-center text-white">
              <Users className="w-5 h-5 mx-auto mb-1" />
              Membres
            </div>
            {allDays.map((day) => (
              <div
                key={day.toISOString()}
                className={`p-3 text-center font-medium border-b border-r ${
                  isWeekend(day) ? "bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800" : 
                  "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700"
                }`}
              >
                <div className="text-sm">{formatDate(day, 'EEE dd')}</div>
                <div className="text-xs opacity-75">{formatDate(day, 'dd/MM').split('/')[1]}</div>
              </div>
            ))}
            
            {/* Lignes des membres */}
            {visibleMembers.map((member, idx) => (
              <React.Fragment key={member.badgeId}>
                <div className={`sticky left-0 z-10 p-3 border-r border-b flex items-center gap-3 ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}>
                  {member.photo ? (
                    <img src={member.photo} alt="avatar" className="w-10 h-10 object-cover rounded-full border border-gray-300" />
                  ) : (
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {member.firstName?.[0]}{member.name?.[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{member.name}</div>
                    <div className="text-xs text-gray-500 truncate">{member.firstName}</div>
                  </div>
                </div>
                {allDays.map((day) => {
                  const times = groupedByMember[member.badgeId] || [];
                  const dayPresences = times.filter(t => 
                    t.getFullYear() === day.getFullYear() &&
                    t.getMonth() === day.getMonth() &&
                    t.getDate() === day.getDate()
                  );
                  
                  return (
                    <div
                      key={`${member.badgeId}-${day.toISOString()}`}
                      className={`p-2 border-b border-r min-h-[80px] transition-colors hover:bg-opacity-80 ${
                        dayPresences.length > 0 ? "bg-gradient-to-br from-green-100 to-green-200" : 
                        isWeekend(day) ? "bg-blue-50" : 
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                    >
                      {dayPresences.length > 0 && (
                        <div className="space-y-1">
                          {dayPresences.slice(0, 3).map((time, tidx) => (
                            <div key={tidx} className="bg-green-600 text-white px-2 py-1 rounded-md text-xs font-medium text-center shadow-sm">
                              {formatDate(time, 'HH:mm')}
                            </div>
                          ))}
                          {dayPresences.length > 3 && (
                            <div className="text-green-700 text-xs text-center font-medium">+{dayPresences.length - 3}</div>
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

  // Vue grille complète pour desktop
  const GridView = () => (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      <div className="overflow-auto max-h-[75vh]">
        <div className="min-w-max">
          <div className="grid" style={{ gridTemplateColumns: `220px repeat(${allDays.length * hours.length}, 45px)` }}>
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
                  className={`text-[9px] border-b border-r flex flex-col items-center justify-center h-16 font-medium ${
                    isWeekend(day) ? "bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800" : 
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
            {visibleMembers.map((member, idx) => (
              <React.Fragment key={member.badgeId}>
                <div className={`sticky left-0 z-10 px-3 py-2 border-r border-b h-16 flex items-center gap-3 ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}>
                  {member.photo ? (
                    <img src={member.photo} alt="avatar" className="w-12 h-12 object-cover rounded-full border border-gray-300" />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      {member.firstName?.[0]}{member.name?.[0]}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold text-sm truncate">{member.name} {member.firstName}</span>
                    <span className="text-xs text-gray-500">
                      {groupedByMember[member.badgeId]?.length || 0} présence(s)
                    </span>
                  </div>
                </div>
                {allDays.map((day) =>
                  hours.map((h) => {
                    const times = groupedByMember[member.badgeId] || [];
                    const present = times.some((t) =>
                      t.getFullYear() === day.getFullYear() &&
                      t.getMonth() === day.getMonth() &&
                      t.getDate() === day.getDate() &&
                      t.getHours() === h
                    );
                    return (
                      <div
                        key={`${member.badgeId}-${day.toISOString()}-${h}`}
                        className={`h-16 border-b border-r relative group transition-all duration-200 ${
                          present ? "bg-gradient-to-br from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 cursor-pointer shadow-sm" : 
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
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

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
                <p className="text-gray-600 mt-1">Visualisez les présences des membres</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Statistiques rapides */}
              <div className="bg-gray-100 rounded-lg px-4 py-2 text-center">
                <div className="text-2xl font-bold text-blue-600">{visibleMembers.length}</div>
                <div className="text-xs text-gray-600">Membres</div>
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
                  title="Vue grille"
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
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Date de début :</label>
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
            </div>
          </div>
        )}

        {/* Contenu principal */}
        {visibleMembers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-gray-200">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucune présence trouvée</h3>
            <p className="text-gray-500">Aucune présence n'a été enregistrée sur cette période ou avec ces filtres.</p>
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
                