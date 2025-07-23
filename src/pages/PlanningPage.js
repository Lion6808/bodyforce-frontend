import React, { useEffect, useState } from "react";
import {
  format,
  isWithinInterval,
  isWeekend,
  eachDayOfInterval,
  startOfDay,
  endOfDay,
  parseISO,
  subWeeks,
  addWeeks,
  addMonths,
  addYears,
} from "date-fns";
import { fr } from "date-fns/locale";
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
  Settings,
} from "lucide-react";
import { supabaseServices } from "../supabaseClient";

function PlanningPage() {
  const [presences, setPresences] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const [period, setPeriod] = useState("month");
  // ✅ Initialisation avec une plage plus large par défaut
  const [startDate, setStartDate] = useState(startOfDay(new Date('2025-01-01')));
  const [endDate, setEndDate] = useState(endOfDay(new Date('2025-12-31')));
  
  const [filterBadge, setFilterBadge] = useState("");
  const [filterName, setFilterName] = useState("");
  const [showNightHours, setShowNightHours] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // ✅ Presets de périodes communes
  const quickPeriods = [
    { label: "Janvier 2025", start: new Date('2025-01-01'), end: new Date('2025-01-31') },
    { label: "Février 2025", start: new Date('2025-02-01'), end: new Date('2025-02-28') },
    { label: "Mars 2025", start: new Date('2025-03-01'), end: new Date('2025-03-31') },
    { label: "Avril 2025", start: new Date('2025-04-01'), end: new Date('2025-04-30') },
    { label: "Mai 2025", start: new Date('2025-05-01'), end: new Date('2025-05-31') },
    { label: "Juin 2025", start: new Date('2025-06-01'), end: new Date('2025-06-30') },
    { label: "Premier semestre", start: new Date('2025-01-01'), end: new Date('2025-06-30') },
    { label: "Cette semaine", start: startOfDay(subWeeks(new Date(), 0)), end: endOfDay(new Date()) }
  ];

  // ✅ Chargement des données FILTRÉ par période (comme votre ancien code)
  const loadData = async (showRetryIndicator = false) => {
    try {
      if (showRetryIndicator) {
        setIsRetrying(true);
      }
      setLoading(true);
      setError("");

      console.log("🔄 Chargement des données pour la période:", {
        début: startDate.toLocaleDateString(),
        fin: endDate.toLocaleDateString()
      });

      // Chargement des membres
      let membersData = [];
      try {
        membersData = await supabaseServices.getMembers();
        console.log("✅ Membres chargés:", membersData?.length || 0);
      } catch (memberError) {
        console.error("❌ Erreur membres:", memberError);
        throw new Error(`Erreur membres: ${memberError.message}`);
      }

      // ✅ Chargement des présences FILTRÉ par période (comme votre ancien code)
      let allPresences = [];
      try {
        // Utiliser la même logique que votre ancien code qui fonctionne
        let from = 0;
        const pageSize = 1000;
        let done = false;

        while (!done) {
          const { data, error } = await supabaseServices.supabase
            .from("presences")
            .select("*")
            .gte("timestamp", startDate.toISOString())
            .lte("timestamp", endDate.toISOString())
            .order("timestamp", { ascending: false })
            .range(from, from + pageSize - 1);

          if (error) {
            console.error("Erreur chargement présences :", error.message);
            throw error;
          }

          if (data && data.length > 0) {
            allPresences = [...allPresences, ...data];
            from += pageSize;
          }

          if (!data || data.length < pageSize) {
            done = true;
          }
        }

        console.log("✅ Présences chargées pour la période:", allPresences.length);
      } catch (presenceError) {
        console.error("❌ Erreur présences:", presenceError);
        throw new Error(`Erreur présences: ${presenceError.message}`);
      }

      // Transformation des données
      const transformedMembers = (membersData || []).map((m) => ({
        badgeId: m.badgeId,
        name: m.name,
        firstName: m.firstName,
        photo: m.photo || null,
      }));

      setPresences(allPresences);
      setMembers(transformedMembers);
      setRetryCount(0);

      console.log("✅ Chargement terminé avec succès");
    } catch (error) {
      console.error("💥 Erreur lors du chargement des données:", error);
      let errorMessage = "Erreur de connexion à la base de données";
      
      if (error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")) {
        errorMessage = "Problème de réseau - Vérifiez votre connexion internet";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  // ✅ Recharger les données quand la période change
  useEffect(() => {
    loadData();
  }, [startDate, endDate]); // ✅ Recharger quand les dates changent

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

  // ✅ Fonction pour ajuster à toutes les données disponibles
  const adjustToAllData = async () => {
    try {
      console.log("🔍 Recherche de toutes les données...");
      
      // Charger quelques échantillons pour trouver la plage réelle
      const { data: sampleData, error } = await supabaseServices.supabase
        .from("presences")
        .select("timestamp")
        .order("timestamp", { ascending: true })
        .limit(1);

      const { data: sampleDataDesc, error: errorDesc } = await supabaseServices.supabase
        .from("presences")
        .select("timestamp")
        .order("timestamp", { ascending: false })
        .limit(1);

      if (!error && !errorDesc && sampleData?.[0] && sampleDataDesc?.[0]) {
        const minDate = parseISO(sampleData[0].timestamp);
        const maxDate = parseISO(sampleDataDesc[0].timestamp);
        
        setStartDate(startOfDay(minDate));
        setEndDate(endOfDay(maxDate));
        
        console.log(`✅ Période ajustée: ${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`);
      }
    } catch (error) {
      console.error("Erreur lors de l'ajustement:", error);
    }
  };

  // ✅ Fonction de conversion (même que votre ancien code)
  const toLocalDate = (iso) => {
    if (!iso) return new Date();
    return parseISO(iso);
  };

  // Affichage des écrans de chargement et d'erreur
  const renderConnectionError = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center border border-gray-200">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Problème de connexion</h2>
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
          <p className="text-sm text-gray-500 mt-4">Tentative {retryCount + 1}</p>
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
        <p className="text-gray-600">Période: {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}</p>
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
    members.find((m) => m.badgeId === badgeId) || { badgeId, name: "Inconnu", firstName: "" };

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

  // ✅ Vue grille (comme votre ancien code mais avec design amélioré)
  const GridView = () => (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      <div className="overflow-auto max-h-[75vh]">
        <div className="min-w-max">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `220px repeat(${allDays.length * hours.length}, 45px)`,
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
                      {format(day, "EEE dd/MM", { locale: fr })}
                    </div>
                  )}
                  <div className="font-semibold">{`${h.toString().padStart(2, "0")}h`}</div>
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
                      {member.firstName?.[0]}{member.name?.[0]}
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
                                <span className="text-white font-bold text-lg">✓</span>
                              </div>
                            </div>
                            <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                              <div className="font-semibold">
                                {format(day, "EEEE dd/MM", { locale: fr })} à {h}h
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

              <div className="bg-gray-100 rounded-lg px-4 py-2 text-center">
                <div className="text-2xl font-bold text-green-600">{filteredPresences.length}</div>
                <div className="text-xs text-gray-600">Présences</div>
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
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Début:</label>
                <input
                  type="date"
                  value={format(startDate, "yyyy-MM-dd")}
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
                  {format(startDate, "dd/MM/yyyy")} - {format(endDate, "dd/MM/yyyy")}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">{allDays.length} jours</div>
              </div>

              {/* Bouton pour ajuster automatiquement */}
              <button
                onClick={adjustToAllData}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 
                         text-white font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 text-sm whitespace-nowrap"
                title="Ajuster à toutes les données"
              >
                <Settings className="w-4 h-4" />
                Toutes les données
              </button>
            </div>

            <button
              onClick={() => navigatePeriod("next")}
              className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm flex-shrink-0"
            >
              <ChevronRight className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          {/* Presets de périodes rapides */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="text-sm font-medium text-blue-800 whitespace-nowrap">Périodes rapides:</span>
              <div className="flex flex-wrap gap-2">
                {quickPeriods.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setStartDate(startOfDay(preset.start));
                      setEndDate(endOfDay(preset.end));
                    }}
                    className="px-3 py-1 text-sm bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300 rounded-lg transition-all duration-200 hover:shadow-sm"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
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
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                           disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-lg transition-all 
                           duration-200 flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`} />
                  Actualiser
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Message d'information si aucune donnée */}
        {visibleMembers.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-gray-200">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucune présence trouvée</h3>
            <p className="text-gray-500 mb-6">
              {presences.length === 0 
                ? "Aucune présence n'a été enregistrée dans cette période."
                : "Aucune présence n'a été trouvée avec ces filtres."
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={adjustToAllData}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 
                         text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Voir toutes les données
              </button>
              <button
                onClick={handleRetry}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                         text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Recharger les données
              </button>
            </div>
          </div>
        )}

        {/* Contenu principal */}
        {visibleMembers.length > 0 && <GridView />}
      </div>
    </div>
  );
}

export default PlanningPage;