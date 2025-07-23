import React, { useEffect, useState } from "react";
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

// ✅ Client Supabase direct (comme votre ancien code qui fonctionne)
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
  };

  if (format === "yyyy-MM-dd") {
    return date.toISOString().split("T")[0];
  }

  return new Intl.DateTimeFormat("fr-FR", options[format] || {}).format(date);
};

// Fonction pour convertir correctement les timestamps
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

      const localDateString = `${datePart}T${timePart}`;
      const localDate = new Date(localDateString);
      return localDate;
    }

    if (timestamp.includes(" ") && timestamp.includes("+00")) {
      const [datePart, timeWithTz] = timestamp.split(" ");
      const timePart = timeWithTz.split("+00")[0];
      const localDateString = `${datePart}T${timePart}`;
      const localDate = new Date(localDateString);
      return localDate;
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
  // ✅ Période par défaut plus courte pour éviter la lenteur
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

  // ✅ REQUÊTES DIRECTES SUPABASE (comme votre ancien code qui fonctionne)
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

      // ✅ Chargement des membres (même logique que votre ancien code)
      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("*");

      if (membersError) {
        console.error("❌ Erreur membres:", membersError);
        throw new Error(`Erreur membres: ${membersError.message}`);
      }

      setMembers(Array.isArray(membersData) ? membersData : []);
      console.log("✅ Membres chargés:", membersData?.length || 0);

      // ✅ Chargement des présences FILTRÉ par période (EXACTEMENT comme votre ancien code)
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

  // ✅ Recharger quand la période change (comme votre ancien code)
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

  // Écrans de chargement et d'erreur
  const renderConnectionError = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center border border-gray-200">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Problème de connexion
        </h2>
        <p className="text-gray-600 mb-8 leading-relaxed">{error}</p>
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                   disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-6 
                   rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-lg"
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
          <p className="text-sm text-gray-500 mt-4">
            Tentative {retryCount + 1}
          </p>
        )}
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <RefreshCw className="w-8 h-8 animate-spin text-white" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          {isRetrying ? "Reconnexion en cours..." : "Chargement du planning..."}
        </h2>
        <p className="text-gray-600">
          Période: {startDate.toLocaleDateString()} -{" "}
          {endDate.toLocaleDateString()}
        </p>
      </div>
    </div>
  );

  if (loading) return renderLoading();
  if (error && !isRetrying) return renderConnectionError();

  // ✅ Les présences sont déjà filtrées par la requête, pas besoin de re-filtrer
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

  // Vue liste pour mobile - Version compacte
  const ListView = () => (
    <div className="space-y-3">
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
          <div
            key={member.badgeId}
            className="bg-white rounded-lg shadow-sm p-3 border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-3">
              {member.photo ? (
                <img
                  src={member.photo}
                  alt="avatar"
                  className="w-10 h-10 object-cover rounded-full border border-blue-200"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                  {member.firstName?.[0]}
                  {member.name?.[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 text-base truncate">
                  {member.name} {member.firstName}
                </h3>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-500">
                    Badge: {member.badgeId}
                  </span>
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                    {totalPresencesInPeriod} présence(s)
                  </span>
                </div>
              </div>
            </div>

            {/* Grille compacte des jours */}
            <div className="grid grid-cols-7 sm:grid-cols-14 gap-1">
              {allDays.map((day) => {
                const dayKey = toDateString(day);
                const dayPresences = dailyPresences[dayKey] || [];
                const hasPresences = dayPresences.length > 0;

                return (
                  <div key={dayKey} className={`relative group`}>
                    <div
                      className={`p-1.5 rounded text-center text-xs transition-all hover:scale-105 cursor-pointer ${
                        hasPresences
                          ? "bg-green-500 text-white shadow-sm"
                          : isWeekend(day)
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      <div className="font-medium text-xs">
                        {formatDate(day, "EEE dd").split(" ")[1]}
                      </div>
                      {hasPresences && (
                        <div className="text-[10px] font-bold mt-0.5">
                          {dayPresences.length}
                        </div>
                      )}
                    </div>

                    {/* Tooltip avec détails au hover */}
                    {hasPresences && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                        <div className="bg-gray-900 text-white text-xs rounded-lg px-2 py-1.5 shadow-xl min-w-max">
                          <div className="font-semibold mb-1">
                            {formatDate(day, "EEE dd/MM")}
                          </div>
                          <div className="space-y-0.5">
                            {dayPresences.slice(0, 3).map((p, idx) => (
                              <div key={idx} className="text-[11px]">
                                {formatDate(p, "HH:mm")}
                              </div>
                            ))}
                            {dayPresences.length > 3 && (
                              <div className="text-[11px] opacity-75">
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

  // Vue compacte pour tablettes
  const CompactView = () => (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <div className="min-w-full">
          <div
            className="grid bg-gray-50"
            style={{
              gridTemplateColumns: `180px repeat(${allDays.length}, minmax(100px, 1fr))`,
            }}
          >
            {/* En-tête */}
            <div className="sticky top-0 left-0 bg-gradient-to-r from-blue-600 to-purple-600 z-20 p-4 border-b border-r font-bold text-center text-white">
              <Users className="w-5 h-5 mx-auto mb-1" />
              Membres
            </div>
            {allDays.map((day) => (
              <div
                key={day.toISOString()}
                className={`p-3 text-center font-medium border-b border-r ${
                  isWeekend(day)
                    ? "bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800"
                    : "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700"
                }`}
              >
                <div className="text-sm">{formatDate(day, "EEE dd")}</div>
                <div className="text-xs opacity-75">
                  {formatDate(day, "dd/MM").split("/")[1]}
                </div>
              </div>
            ))}

            {/* Lignes des membres */}
            {visibleMembers.map((member, idx) => (
              <React.Fragment key={member.badgeId}>
                <div
                  className={`sticky left-0 z-10 p-3 border-r border-b flex items-center gap-3 ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  {member.photo ? (
                    <img
                      src={member.photo}
                      alt="avatar"
                      className="w-10 h-10 object-cover rounded-full border border-gray-300"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {member.firstName?.[0]}
                      {member.name?.[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">
                      {member.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
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
                      className={`p-2 border-b border-r min-h-[80px] transition-colors hover:bg-opacity-80 ${
                        dayPresences.length > 0
                          ? "bg-gradient-to-br from-green-100 to-green-200"
                          : isWeekend(day)
                          ? "bg-blue-50"
                          : idx % 2 === 0
                          ? "bg-white"
                          : "bg-gray-50"
                      }`}
                    >
                      {dayPresences.length > 0 && (
                        <div className="space-y-1">
                          {dayPresences.slice(0, 3).map((time, tidx) => (
                            <div
                              key={tidx}
                              className="bg-green-600 text-white px-2 py-1 rounded-md text-xs font-medium text-center shadow-sm"
                            >
                              {formatDate(time, "HH:mm")}
                            </div>
                          ))}
                          {dayPresences.length > 3 && (
                            <div className="text-green-700 text-xs text-center font-medium">
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

  // Vue grille complète pour desktop
  const GridView = () => (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      <div className="overflow-auto max-h-[75vh]">
        <div className="min-w-max">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `220px repeat(${
                allDays.length * hours.length
              }, 45px)`,
            }}
          >
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
                    isWeekend(day)
                      ? "bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800"
                      : "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700"
                  }`}
                >
                  {hIdx === 0 && (
                    <div className="font-bold whitespace-nowrap mb-1">
                      {formatDate(day, "EEE dd/MM")}
                    </div>
                  )}
                  <div className="font-semibold">{`${h
                    .toString()
                    .padStart(2, "0")}h`}</div>
                </div>
              ))
            )}
            {visibleMembers.map((member, idx) => (
              <React.Fragment key={member.badgeId}>
                <div
                  className={`sticky left-0 z-10 px-3 py-2 border-r border-b h-16 flex items-center gap-3 ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  {member.photo ? (
                    <img
                      src={member.photo}
                      alt="avatar"
                      className="w-12 h-12 object-cover rounded-full border border-gray-300"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      {member.firstName?.[0]}
                      {member.name?.[0]}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold text-sm truncate">
                      {member.name} {member.firstName}
                    </span>
                    <span className="text-xs text-gray-500">
                      {groupedByMember[member.badgeId]?.length || 0} présence(s)
                    </span>
                  </div>
                </div>
                {allDays.map((day) =>
                  hours.map((h) => {
                    const times = groupedByMember[member.badgeId] || [];
                    const present = times.some((t) => {
                      const tDateStr = toDateString(t);
                      const dayDateStr = toDateString(day);
                      return tDateStr === dayDateStr && t.getHours() === h;
                    });

                    return (
                      <div
                        key={`${member.badgeId}-${day.toISOString()}-${h}`}
                        className={`h-16 border-b border-r relative group transition-all duration-200 ${
                          present
                            ? "bg-gradient-to-br from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 cursor-pointer shadow-sm"
                            : isWeekend(day)
                            ? "bg-blue-50 hover:bg-blue-100"
                            : idx % 2 === 0
                            ? "bg-white hover:bg-gray-50"
                            : "bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        {present && (
                          <>
                            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                              <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold text-lg">
                                  ✓
                                </span>
                              </div>
                            </div>
                            <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                              <div className="font-semibold">
                                {formatDate(day, "EEE dd/MM")} à {h}h
                              </div>
                              <div className="opacity-90">
                                {member.name} {member.firstName}
                              </div>
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
                <h1 className="text-3xl font-bold text-gray-900">
                  Planning des présences
                </h1>
                <p className="text-gray-600 mt-1">
                  Visualisez les présences des membres
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Statistiques rapides */}
              <div className="bg-gray-100 rounded-lg px-4 py-2 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {visibleMembers.length}
                </div>
                <div className="text-xs text-gray-600">Membres</div>
              </div>

              <div className="bg-gray-100 rounded-lg px-4 py-2 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {filteredPresences.length}
                </div>
                <div className="text-xs text-gray-600">Présences</div>
              </div>

              {/* Boutons de vue */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === "list"
                      ? "bg-white shadow-md text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  title="Vue liste"
                >
                  <List className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("compact")}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === "compact"
                      ? "bg-white shadow-md text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  title="Vue compacte"
                >
                  <Users className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === "grid"
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
                className={`p-3 rounded-lg transition-all ${
                  showFilters
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
              {/* Sélecteur de date de début */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
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

          {/* ✅ Presets rapides pour navigation facile */}
          {/* Presets rapides */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-blue-800 mr-2">
                Raccourcis :
              </span>

              <button
                onClick={() => {
                  const today = new Date();
                  setStartDate(startOfDay(today));
                  setEndDate(endOfDay(today));
                }}
                className="px-2 py-1 text-xs bg-white hover:bg-blue-100 text-blue-700 rounded"
              >
                Aujourd’hui
              </button>

              <button
                onClick={() => {
                  const today = new Date();
                  setStartDate(
                    startOfDay(new Date(today.setDate(today.getDate() - 6)))
                  );
                  setEndDate(endOfDay(new Date()));
                }}
                className="px-2 py-1 text-xs bg-white hover:bg-blue-100 text-blue-700 rounded"
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
                className="px-2 py-1 text-xs bg-white hover:bg-blue-100 text-blue-700 rounded"
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
                className="px-2 py-1 text-xs bg-white hover:bg-blue-100 text-blue-700 rounded"
              >
                Cette Semaine
              </button>

              <button
                onClick={() => {
                  setStartDate(startOfDay(startOfMonth(new Date())));
                  setEndDate(endOfDay(endOfMonth(new Date())));
                }}
                className="px-2 py-1 text-xs bg-white hover:bg-blue-100 text-blue-700 rounded"
              >
                Ce Mois
              </button>

              <button
                onClick={() => {
                  setStartDate(startOfDay(startOfYear(new Date())));
                  setEndDate(endOfDay(endOfYear(new Date())));
                }}
                className="px-2 py-1 text-xs bg-white hover:bg-blue-100 text-blue-700 rounded"
              >
                Cette Année
              </button>
            </div>
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
                  onClick={handleRetry}
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

        {/* Contenu principal */}
        {visibleMembers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-gray-200">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Aucune présence trouvée
            </h3>
            <p className="text-gray-500 mb-6">
              Aucune présence n'a été enregistrée sur cette période ou avec ces
              filtres.
              <br />
              Essayez d'ajuster la période ou utilisez les raccourcis ci-dessus.
            </p>
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                       text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Recharger les données
            </button>
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
