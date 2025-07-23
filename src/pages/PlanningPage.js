import React, { useEffect, useState } from "react";
import { supabaseServices } from "../supabaseClient";
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
} from "lucide-react";

// Utilitaires de date
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

const parseTimestamp = (timestamp) => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === "string") {
    if (
      timestamp.includes("T") &&
      (timestamp.includes("+00:00") || timestamp.includes("+00"))
    ) {
      const datePart = timestamp.split("T")[0];
      let timePart;

      if (timestamp.includes("+00:00")) {
        timePart = timestamp.split("T")[1].split("+00:00")[0];
      } else if (timestamp.includes("+00")) {
        timePart = timestamp.split("T")[1].split("+00")[0];
      }

      return new Date(`${datePart}T${timePart}`);
    }

    if (timestamp.includes(" ") && timestamp.includes("+00")) {
      const [datePart, timeWithTz] = timestamp.split(" ");
      const timePart = timeWithTz.split("+00")[0];
      return new Date(`${datePart}T${timePart}`);
    }

    return new Date(timestamp);
  }

  return new Date(timestamp);
};

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

function PlanningPage() {
  const [presences, setPresences] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [period, setPeriod] = useState("week");
  const [startDate, setStartDate] = useState(startOfDay(new Date()));
  const [endDate, setEndDate] = useState(endOfDay(new Date()));
  const [dateAutoSet, setDateAutoSet] = useState(false);
  const [filterBadge, setFilterBadge] = useState("");
  const [filterName, setFilterName] = useState("");
  const [showNightHours, setShowNightHours] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const loadData = async (showRetryIndicator = false) => {
    try {
      if (showRetryIndicator) {
        setIsRetrying(true);
      }
      setLoading(true);
      setError("");

      const testResult = await supabaseServices.testConnection();
      if (!testResult) throw new Error("Test de connexion échoué");

      const membersData = await supabaseServices.getMembers();
      const presencesData = await supabaseServices.getPresencesWithMembers();

      const transformedPresences = (presencesData || []).map((p) => ({
        badgeId: p.badgeId,
        timestamp: p.timestamp,
        parsedDate: parseTimestamp(p.timestamp),
      }));

      const transformedMembers = (membersData || []).map((m) => ({
        badgeId: m.badgeId,
        name: m.name,
        firstName: m.firstName,
        photo: m.photo || null,
      }));

      setPresences(transformedPresences);
      setMembers(transformedMembers);
      setRetryCount(0);
    } catch (error) {
      let errorMessage = "Erreur de connexion à la base de données";
      if (error.message) errorMessage = error.message;
      setError(errorMessage);
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (presences.length > 0 && !dateAutoSet) {
      const dates = presences.map((p) => parseTimestamp(p.timestamp));
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      setStartDate(startOfDay(minDate));
      setEndDate(endOfDay(maxDate));
      setDateAutoSet(true);
    }
  }, [presences, dateAutoSet]);

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

  const filteredPresences = presences.filter((p) => {
    const presenceDate = parseTimestamp(p.timestamp);
    return isWithinInterval(presenceDate, {
      start: startDate,
      end: endDate,
    });
  });

  const groupedByMember = {};
  filteredPresences.forEach((p) => {
    const key = p.badgeId;
    if (!groupedByMember[key]) groupedByMember[key] = [];
    groupedByMember[key].push(parseTimestamp(p.timestamp));
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
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* En-tête calendrier */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Planning des présences
                </h1>
                <p className="text-gray-600 mt-1">
                  Visualisez les présences des membres
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-gray-100 rounded-lg px-4 py-2 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {visibleMembers.length}
                </div>
                <div className="text-xs text-gray-600">Membres</div>
              </div>

              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-md transition-all ${viewMode === "list"
                      ? "bg-white shadow-md text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                    }`}
                  title="Vue liste"
                >
                  <List className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("compact")}
                  className={`p-2 rounded-md transition-all ${viewMode === "compact"
                      ? "bg-white shadow-md text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                    }`}
                  title="Vue compacte"
                >
                  <Users className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-md transition-all ${viewMode === "grid"
                      ? "bg-white shadow-md text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                    }`}
                  title="Vue grille"
                >
                  <Grid className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-3 rounded-lg transition-all ${showFilters
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation période */}
          <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 rounded-lg">
            <button
              onClick={() => navigatePeriod("prev")}
              className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm flex-shrink-0"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Début:
                </label>
                <input
                  type="date"
                  value={toDateString(startDate)}
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
                  className="border-2 border-gray-200 rounded-lg px-3 py-1 text-sm focus:border-blue-500 focus:outline-none bg-white"
                />
              </div>

              <select
                className="border-2 border-gray-200 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none bg-white font-medium text-sm"
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
                <div className="text-sm sm:text-lg font-bold text-gray-900 truncate">
                  {formatDate(startDate, "dd/MM/yyyy")} -{" "}
                  {formatDate(endDate, "dd/MM/yyyy")}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  {allDays.length} jours
                </div>
              </div>
            </div>

            <button
              onClick={() => navigatePeriod("next")}
              className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm flex-shrink-0"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rechercher par nom
                </label>
                <input
                  type="text"
                  placeholder="Nom ou prénom..."
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filtrer par badge
                </label>
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
                <button
                  onClick={() => loadData(true)}
                  disabled={isRetrying}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                           disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-lg transition-all 
                           duration-200 flex items-center justify-center gap-2"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`}
                  />
                  Actualiser
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Affichage erreurs ou chargement */}
        {loading ? (
          <div className="flex justify-center items-center mt-10 text-gray-500">
            Chargement en cours...
          </div>
        ) : error ? (
          <div className="bg-red-100 text-red-800 px-4 py-3 rounded-lg flex items-center gap-3 shadow-md">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        ) : visibleMembers.length === 0 ? (
          <div className="text-center text-gray-500 mt-6">
            Aucun membre trouvé pour les filtres donnés.
          </div>
        ) : (
          <>
            {viewMode === "list" && (
              <div className="grid grid-cols-1 gap-4">
                {visibleMembers.map((m) => (
                  <div
                    key={m.badgeId}
                    className="bg-white rounded-xl shadow p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border"
                  >
                    <div className="flex items-center gap-4">
                      {m.photo ? (
                        <img
                          src={m.photo}
                          alt={`${m.name} ${m.firstName}`}
                          className="w-12 h-12 rounded-full object-cover border"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                          ?
                        </div>
                      )}
                      <div>
                        <div className="font-semibold">
                          {m.name} {m.firstName}
                        </div>
                        <div className="text-sm text-gray-500">
                          Badge : {m.badgeId}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(groupedByMember[m.badgeId] || [])
                        .sort((a, b) => b - a)
                        .map((d, i) => (
                          <div
                            key={i}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                          >
                            {formatDate(d, "dd/MM/yyyy HH:mm")}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {viewMode === "compact" && (
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 bg-white rounded-xl overflow-hidden shadow">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        Membre
                      </th>
                      {allDays.map((day, idx) => (
                        <th
                          key={idx}
                          className="px-2 py-2 text-xs text-gray-500 whitespace-nowrap"
                        >
                          {formatDate(day, "dd/MM")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMembers.map((m) => (
                      <tr key={m.badgeId} className="border-t border-gray-100">
                        <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-800">
                          {m.name} {m.firstName}
                        </td>
                        {allDays.map((day, idx) => {
                          const present = (groupedByMember[m.badgeId] || []).some(
                            (d) =>
                              d.getFullYear() === day.getFullYear() &&
                              d.getMonth() === day.getMonth() &&
                              d.getDate() === day.getDate()
                          );
                          return (
                            <td
                              key={idx}
                              className="px-2 py-1 text-center text-sm"
                            >
                              {present ? "✅" : "-"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {viewMode === "grid" && (
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 bg-white rounded-xl overflow-hidden shadow text-xs">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-3 text-left text-gray-700 whitespace-nowrap">
                        Heure / Date
                      </th>
                      {allDays.map((day, idx) => (
                        <th
                          key={idx}
                          className="px-2 py-2 text-gray-500 whitespace-nowrap"
                        >
                          {formatDate(day, "dd/MM")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hours.map((hour) => (
                      <tr key={hour} className="border-t border-gray-100">
                        <td className="px-2 py-1 font-medium text-gray-700 whitespace-nowrap">
                          {`${hour.toString().padStart(2, "0")}:00`}
                        </td>
                        {allDays.map((day, idx) => {
                          const presence = presences.find((p) => {
                            const d = parseTimestamp(p.timestamp);
                            return (
                              d.getFullYear() === day.getFullYear() &&
                              d.getMonth() === day.getMonth() &&
                              d.getDate() === day.getDate() &&
                              d.getHours() === hour
                            );
                          });

                          return (
                            <td
                              key={idx}
                              className={`text-center px-2 py-1 ${presence ? "bg-blue-100 text-blue-600" : ""
                                }`}
                            >
                              {presence ? "•" : ""}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default PlanningPage;
