/**
 * StatisticsPage.js — BODYFORCE
 *
 * Dashboard page displaying detailed gym statistics with year-over-year comparison.
 * Features:
 *  - Summary banner with overall assessment
 *  - Year selector (current year, previous year, all time)
 *  - KPI cards grouped by category with insights
 *  - Comparative charts (current vs previous year)
 *  - Top members by period
 *  - Expired subscriptions list
 */

// ============================================================
// SECTION 1 — Imports
// ============================================================

import { useEffect, useState, useMemo } from "react";
import { supabaseServices } from "../supabaseClient";
import {
  FaClock,
  FaUsers,
  FaStar,
  FaExclamationTriangle,
  FaChartBar,
  FaCalendarAlt,
  FaEuroSign,
  FaUserCheck,
  FaUserTimes,
  FaMars,
  FaVenus,
  FaGraduationCap,
  FaSync,
  FaCheckCircle,
  FaInfoCircle,
  FaChartLine,
  FaUserFriends,
  FaTrophy,
  FaLightbulb,
} from "react-icons/fa";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
  Area, AreaChart, Legend, ComposedChart, Line
} from "recharts";
import {
  formatHourlyStats,
  formatDailyStatsWithDayNames,
  mergeMonthlyStats,
  mergeHourlyStats,
  getComparableAverage,
  generateInsight,
} from "../utils/statisticsUtils";
import { StatCard, SectionHeader, InsightBanner, SummaryBanner, Section, PeriodSelector, ComiteToggle, NoDataMessage, Divider } from "../components/statistics/StatisticsWidgets";
import { RadialHeatmap, DayBars, TopCreneaux } from "../components/statistics/StatisticsCharts";
import { CURRENT_YEAR, PREVIOUS_YEAR, CURRENT_MONTH, CURRENT_DAY } from "../utils/statisticsPeriods";

// ============================================================
// SECTION 2 — Constants
// ============================================================

const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "#111827",
  border: "1px solid #374151",
  borderRadius: 8,
  padding: "8px 12px",
  color: "#e5e7eb",
};

// ============================================================
// SECTION 4 — UI Components
// ============================================================

const COMITE_STORAGE_KEY = "bodyforce_stats_includeComite";

// ============================================================
// SECTION 5 — Main Component
// ============================================================

export default function StatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("comparison");
  const [includeComite, setIncludeComite] = useState(() => {
    try {
      return localStorage.getItem(COMITE_STORAGE_KEY) !== "false";
    } catch {
      return true;
    }
  });

  // Data states
  const [baseData, setBaseData] = useState(null);
  const [currentYearStats, setCurrentYearStats] = useState(null);
  const [previousYearStats, setPreviousYearStats] = useState(null);
  const [topMembersCurrent, setTopMembersCurrent] = useState([]);
  const [topMembersPrevious, setTopMembersPrevious] = useState([]);
  const [championOfMonth, setChampionOfMonth] = useState(null);
  const [exactPreviousPresences, setExactPreviousPresences] = useState(0); // Présences N-1 même période exacte
  const [heatmapData, setHeatmapData] = useState(null); // Données pour la heatmap radiale

  // Fetch all data on mount and when the committee toggle changes
  useEffect(() => {
    try {
      localStorage.setItem(COMITE_STORAGE_KEY, String(includeComite));
    } catch {
      // stockage indisponible (navigation privée) : on garde l'état en mémoire
    }
    fetchAllData();
  }, [includeComite]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // ✅ OPTIMISATION EGRESS : heatmapData inclus dans getYearlyPresenceStats (évite double fetch)
      const [baseResult, currentYear, previousYear, topCurrent, topPrevious, prevExact] = await Promise.all([
        supabaseServices.getDetailedStatistics(includeComite),
        supabaseServices.getYearlyPresenceStats(CURRENT_YEAR, includeComite),
        supabaseServices.getYearlyPresenceStats(PREVIOUS_YEAR, includeComite),
        supabaseServices.getTopMembersByYear(CURRENT_YEAR, 10, includeComite),
        supabaseServices.getTopMembersByYear(PREVIOUS_YEAR, 10, includeComite),
        // Récupérer présences N-1 jusqu'au même jour (comparaison équitable)
        supabaseServices.getPresenceCountUntilDate(PREVIOUS_YEAR, CURRENT_MONTH, CURRENT_DAY, includeComite),
      ]);

      setBaseData(baseResult);
      setCurrentYearStats(currentYear);
      setPreviousYearStats(previousYear);
      setExactPreviousPresences(prevExact);
      // Utilise les données heatmap déjà calculées (0 egress supplémentaire)
      setHeatmapData(currentYear.heatmapData);

      // Filtrer les membres sans badge valide
      const filterValidMembers = (members) => members.filter(m =>
        m.badge_number || m.badgeId
      );

      // Utiliser les données RPC si disponibles, sinon fallback sur baseResult.topMembers
      const topCurrentFiltered = filterValidMembers(topCurrent || []);
      const topPreviousFiltered = filterValidMembers(topPrevious || []);
      const fallbackTopMembers = filterValidMembers(baseResult?.topMembers || []);

      setTopMembersCurrent(topCurrentFiltered.length > 0 ? topCurrentFiltered : fallbackTopMembers);
      setTopMembersPrevious(topPreviousFiltered.length > 0 ? topPreviousFiltered : fallbackTopMembers);

      // Champion du mois : utiliser le premier du fallback si RPC échoue
      if (fallbackTopMembers.length > 0) {
        setChampionOfMonth(fallbackTopMembers[0]);
      }
      // Tenter quand même de récupérer le vrai champion du mois via RPC
      await fetchChampionOfMonth();
    } catch (err) {
      console.error("Erreur chargement statistiques:", err);
      setError(err?.message || "Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  // Récupère le champion du mois courant (via calcul côté client)
  const fetchChampionOfMonth = async () => {
    try {
      const startDate = `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, '0')}-01T00:00:00`;
      const lastDay = new Date(CURRENT_YEAR, CURRENT_MONTH, 0).getDate();
      const endDate = `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, '0')}-${lastDay}T23:59:59`;

      // Utiliser la fonction côté client qui passe par badge_history
      const data = await supabaseServices.getTopMembersByPeriod(startDate, endDate, 1, includeComite);

      if (data && data.length > 0 && (data[0].badge_number || data[0].badgeId)) {
        setChampionOfMonth(data[0]);
      }
    } catch (err) {
      console.warn("Erreur fetchChampionOfMonth:", err);
    }
  };

  // Computed data based on period
  const displayStats = useMemo(() => {
    if (!currentYearStats || !previousYearStats) return null;

    // Utiliser exactPreviousPresences pour une comparaison équitable jour par jour
    // (présences du 1er janvier au même jour/mois de l'année précédente)
    return {
      currentPresences: currentYearStats.totalPresences,
      previousPresences: previousYearStats.totalPresences, // Total année complète
      comparablePreviousPresences: exactPreviousPresences, // Même période EXACTE (même jour)
      totalPresences: (currentYearStats.totalPresences || 0) + (previousYearStats.totalPresences || 0),
      currentMonthly: currentYearStats.monthlyStats,
      previousMonthly: previousYearStats.monthlyStats,
      currentHourly: currentYearStats.hourlyStats,
      previousHourly: previousYearStats.hourlyStats,
    };
  }, [currentYearStats, previousYearStats, exactPreviousPresences]);

  // Merged monthly data for comparison chart
  const comparisonMonthlyData = useMemo(() => {
    if (!displayStats) return [];
    return mergeMonthlyStats(displayStats.currentMonthly, displayStats.previousMonthly);
  }, [displayStats]);

  // Top members selon la période sélectionnée
  const displayTopMembers = useMemo(() => {
    if (period === "previous") {
      return topMembersPrevious;
    }
    // Pour "current" et "comparison", afficher l'année en cours
    return topMembersCurrent;
  }, [period, topMembersCurrent, topMembersPrevious]);

  // Insights
  const insights = useMemo(() => {
    if (!displayStats || !baseData) return {};
    const stats = baseData.stats || {};
    return {
      presence: generateInsight("presence", {
        current: displayStats.currentPresences,
        previous: displayStats.comparablePreviousPresences // Même période pour comparaison équitable
      }),
      members: generateInsight("members", {
        total: stats.total || 0,
        actifs: stats.actifs || 0,
        expired: stats.expirés || 0
      }),
      gender: generateInsight("gender", {
        hommes: stats.hommes || 0,
        femmes: stats.femmes || 0
      }),
      peak: generateInsight("peak", {
        hourlyStats: displayStats.currentHourly
      })
    };
  }, [displayStats, baseData]);

  // Loading state
  if (loading) {
    return (
      <div className="p-4 bg-gray-50 min-h-screen dark:bg-gray-900">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          <span className="ml-4 text-lg text-gray-600 dark:text-gray-300">
            Chargement des statistiques...
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 bg-gray-50 min-h-screen dark:bg-gray-900">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg dark:bg-red-900 dark:border-red-600 dark:text-red-100">
          <strong>Erreur:</strong> {error}
          <button
            onClick={fetchAllData}
            className="ml-4 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Destructure base data
  const stats = baseData?.stats || {};
  const dailyStats = baseData?.dailyStats || [];
  const paymentStats = baseData?.paymentStats || {};

  // Calculs comparatifs (même période pour comparaison équitable)
  const { currentAvg, previousAvg } = getComparableAverage(
    displayStats?.currentPresences || 0,
    displayStats?.comparablePreviousPresences || 0
  );

  return (
    <div className="p-4 bg-gray-50 min-h-screen dark:bg-gray-900 dark:text-gray-100">

      {/* Header with period selector */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <FaChartBar />
          Tableau de bord
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <PeriodSelector value={period} onChange={setPeriod} />
          <ComiteToggle value={includeComite} onChange={setIncludeComite} />
          <button
            onClick={fetchAllData}
            className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 transition-colors"
            title="Actualiser"
          >
            <FaSync className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <SummaryBanner
        displayStats={displayStats}
        stats={stats}
        previousYearStats={previousYearStats}
      />

      {/* ================================================== */}
      {/* SECTION: FRÉQUENTATION */}
      {/* ================================================== */}
      <SectionHeader
        title="Fréquentation"
        icon={<FaClock className="text-blue-500" />}
        subtitle={`Analyse des passages ${CURRENT_YEAR} vs ${PREVIOUS_YEAR}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          icon={<FaClock className="text-blue-500 text-2xl" />}
          label={`Passages ${CURRENT_YEAR}`}
          value={displayStats?.currentPresences || 0}
          previousValue={displayStats?.comparablePreviousPresences}
          showTrend={true}
          highlight={true}
        />
        <StatCard
          icon={<FaClock className="text-purple-500 text-2xl" />}
          label={`Passages ${PREVIOUS_YEAR} (même période)`}
          value={displayStats?.comparablePreviousPresences || 0}
          subtitle={`1 Jan - ${CURRENT_DAY} ${['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'][CURRENT_MONTH - 1]} ${PREVIOUS_YEAR}`}
        />
        <StatCard
          icon={<FaCalendarAlt className="text-cyan-500 text-2xl" />}
          label="Moyenne mensuelle"
          value={currentAvg}
          previousValue={previousAvg}
          showTrend={true}
        />
        <StatCard
          icon={<FaChartLine className="text-indigo-500 text-2xl" />}
          label="Total historique"
          value={baseData?.totalPresences || 0}
          subtitle="depuis l'ouverture"
        />
      </div>

      {/* Insight fréquentation */}
      {insights.presence && (
        <div className="mb-6">
          <InsightBanner
            type={insights.presence.type}
            message={insights.presence.message}
            icon={<FaLightbulb className={insights.presence.type === "success" ? "text-green-500" : insights.presence.type === "warning" ? "text-amber-500" : "text-blue-500"} />}
          />
        </div>
      )}

      {/* Graphiques fréquentation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
        <Section
          title={`Évolution mensuelle ${period === "comparison" ? "(comparaison)" : period === "current" ? `(${CURRENT_YEAR})` : period === "previous" ? `(${PREVIOUS_YEAR})` : ""}`}
          icon={<FaChartBar />}
        >
          {(() => {
            let monthlyData;

            if (period === "current") {
              monthlyData = displayStats?.currentMonthly;
            } else if (period === "previous") {
              monthlyData = displayStats?.previousMonthly;
            } else {
              monthlyData = comparisonMonthlyData;
            }

            if (period === "comparison") {
              if (!comparisonMonthlyData?.length) return <NoDataMessage />;
              return (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={comparisonMonthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      wrapperStyle={{ zIndex: 40 }}
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                    />
                    <Legend />
                    <Bar
                      dataKey={CURRENT_YEAR}
                      fill="#3B82F6"
                      radius={[4, 4, 0, 0]}
                      name={`${CURRENT_YEAR}`}
                    />
                    <Line
                      type="monotone"
                      dataKey={PREVIOUS_YEAR}
                      stroke="#9333EA"
                      strokeWidth={3}
                      dot={{ fill: "#9333EA", r: 4 }}
                      name={`${PREVIOUS_YEAR}`}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              );
            }

            if (!monthlyData?.length) return <NoDataMessage />;

            return (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} />
                  <Bar dataKey="count" fill={period === "previous" ? "#9333EA" : "#3B82F6"} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
        </Section>

        <Section
          title={`Créneaux horaires ${period === "comparison" ? "(comparaison)" : period === "previous" ? `(${PREVIOUS_YEAR})` : `(${CURRENT_YEAR})`}`}
          icon={<FaClock />}
        >
          {(() => {
            // Mode comparaison : double colonnes
            if (period === "comparison") {
              const comparisonHourlyData = mergeHourlyStats(
                displayStats?.currentHourly || [],
                displayStats?.previousHourly || []
              );
              if (!comparisonHourlyData?.length) return <NoDataMessage />;

              return (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={comparisonHourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="hour" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} />
                    <Legend />
                    <Bar
                      dataKey={CURRENT_YEAR}
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                      name={`${CURRENT_YEAR}`}
                    />
                    <Bar
                      dataKey={PREVIOUS_YEAR}
                      fill="#9333EA"
                      radius={[4, 4, 0, 0]}
                      name={`${PREVIOUS_YEAR}`}
                    />
                  </BarChart>
                </ResponsiveContainer>
              );
            }

            // Mode simple : une seule année
            const hourlyData = period === "previous"
              ? displayStats?.previousHourly
              : displayStats?.currentHourly;

            if (!hourlyData?.length) return <NoDataMessage />;

            // Trouver le pic
            const peak = hourlyData.reduce((max, h) => h.count > (max?.count || 0) ? h : max, null);

            return (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={formatHourlyStats(hourlyData)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="hour" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} />
                    <Bar
                      dataKey="count"
                      fill={period === "previous" ? "#9333EA" : "#10B981"}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                {peak && (
                  <div className="mt-3 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <FaInfoCircle className="text-blue-500" />
                    Pic de fréquentation à <strong>{peak.hour}h</strong> ({peak.count} passages)
                  </div>
                )}
              </>
            );
          })()}
        </Section>
      </div>

      {/* Heatmap radiale - pleine largeur */}
      <Section
        title={`Heatmap horaire ${CURRENT_YEAR}`}
        icon={<FaClock />}
        className="mb-6"
      >
        <RadialHeatmap data={heatmapData} />
      </Section>

      {/* Barres par jour */}
      <Section
        title={`Fréquentation par jour ${CURRENT_YEAR}`}
        icon={<FaCalendarAlt />}
        className="mb-6"
      >
        <DayBars data={heatmapData} />
      </Section>

      {/* Top créneaux */}
      <Section
        title={`Top 5 créneaux les plus fréquentés ${CURRENT_YEAR}`}
        icon={<FaTrophy className="text-yellow-500" />}
        className="mb-6"
      >
        <TopCreneaux data={heatmapData} />
      </Section>

      {/* 7 derniers jours */}
      <Section title="Activité récente (7 derniers jours)" icon={<FaCalendarAlt />} className="mb-6">
        {dailyStats.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={formatDailyStatsWithDayNames(dailyStats)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="dateLabel" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE}
                labelFormatter={(label) => `${label}`}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.3}
                name="Passages"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <NoDataMessage />
        )}
      </Section>

      <Divider />

      {/* ================================================== */}
      {/* SECTION: MEMBRES */}
      {/* ================================================== */}
      <SectionHeader
        title="Membres"
        icon={<FaUsers className="text-green-500" />}
        subtitle="État des inscriptions et abonnements"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          icon={<FaUsers className="text-blue-500 text-2xl" />}
          label="Total Membres"
          value={stats.total || 0}
          subtitle="inscrits dans la base"
        />
        <StatCard
          icon={<FaUserCheck className="text-green-500 text-2xl" />}
          label="Abonnements Actifs"
          value={stats.actifs || 0}
          subtitle={stats.total ? `${((stats.actifs / stats.total) * 100).toFixed(0)}% du total` : ""}
          highlight={true}
        />
        <StatCard
          icon={<FaUserTimes className="text-red-500 text-2xl" />}
          label="Expirés"
          value={stats.expirés || 0}
          subtitle="à renouveler"
        />
        <StatCard
          icon={<FaEuroSign className="text-emerald-500 text-2xl" />}
          label="Revenus encaissés"
          value={`${(paymentStats.total || 0).toFixed(0)}€`}
          subtitle="total enregistré"
        />
      </div>

      {/* Insight membres */}
      {insights.members && (
        <div className="mb-6">
          <InsightBanner
            type={insights.members.type}
            message={insights.members.message}
          />
        </div>
      )}

      <Divider />

      {/* ================================================== */}
      {/* SECTION: DÉMOGRAPHIE */}
      {/* ================================================== */}
      <SectionHeader
        title="Profil des membres"
        icon={<FaUserFriends className="text-purple-500" />}
        subtitle="Répartition par genre et statut"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          icon={<FaMars className="text-blue-600 text-2xl" />}
          label="Hommes"
          value={stats.hommes || 0}
          subtitle={`${stats.actifs ? ((stats.hommes / stats.actifs) * 100).toFixed(0) : 0}% des actifs`}
        />
        <StatCard
          icon={<FaVenus className="text-pink-500 text-2xl" />}
          label="Femmes"
          value={stats.femmes || 0}
          subtitle={`${stats.actifs ? ((stats.femmes / stats.actifs) * 100).toFixed(0) : 0}% des actifs`}
        />
        <StatCard
          icon={<FaGraduationCap className="text-yellow-500 text-2xl" />}
          label="Étudiants"
          value={stats.etudiants || 0}
          subtitle="tarif réduit"
        />
        <StatCard
          icon={<FaStar className="text-orange-500 text-2xl" />}
          label="Champion du mois"
          value={championOfMonth?.visit_count || 0}
          subtitle={championOfMonth ? `${championOfMonth.firstName} ${championOfMonth.name}` : "Pas de données"}
        />
      </div>

      {/* Insight genre */}
      {insights.gender && (
        <div className="mb-6">
          <InsightBanner
            type={insights.gender.type}
            message={insights.gender.message}
          />
        </div>
      )}

      {/* Top members podium */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top members podium */}
        <Section
          title={`Podium - Top visiteurs ${period === "previous" ? PREVIOUS_YEAR : CURRENT_YEAR}`}
          icon={<FaTrophy className="text-yellow-500" />}
        >
          {displayTopMembers.length > 0 ? (
            <div className="space-y-3">
              {displayTopMembers.slice(0, 10).map((member, index) => (
                <div
                  key={member.id ?? member.badgeId ?? index}
                  className={`flex justify-between items-center p-3 rounded-lg transition-colors ${
                    index < 3
                      ? "bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800"
                      : "bg-gray-50 dark:bg-gray-700/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl w-10 text-center">
                      {index === 0 && "🥇"}
                      {index === 1 && "🥈"}
                      {index === 2 && "🥉"}
                      {index > 2 && <span className="text-lg text-gray-400">#{index + 1}</span>}
                    </span>
                    <div>
                      <div className="font-semibold dark:text-white">
                        {member.firstName} {member.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Badge: {member.badge_number || member.badgeId}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {member.visit_count}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">passages</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <NoDataMessage />
          )}
        </Section>
      </div>

      <Divider />

      {/* ================================================== */}
      {/* SECTION: ALERTES */}
      {/* ================================================== */}
      <SectionHeader
        title="Alertes & Actions"
        icon={<FaExclamationTriangle className="text-red-500" />}
        subtitle="Abonnements à renouveler"
      />

      <Section
        title={`Abonnements expirés (${stats?.membresExpirés?.length || 0})`}
        icon={<FaUserTimes className="text-red-500" />}
      >
        {stats?.membresExpirés?.length > 0 ? (
          <>
            <div className="mb-4">
              <InsightBanner
                type="warning"
                message={`${stats.membresExpirés.length} membre${stats.membresExpirés.length > 1 ? 's ont' : ' a'} un abonnement expiré. Pensez à les contacter pour renouvellement.`}
              />
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {stats.membresExpirés.slice(0, 15).map((member, i) => (
                <div
                  key={member.id ?? i}
                  className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-400"
                >
                  <div>
                    <div className="font-semibold text-red-800 dark:text-red-300">
                      {member.firstName} {member.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-red-600 dark:text-red-400">
                      Expiré le {member?.endDate ? new Date(member.endDate).toLocaleDateString("fr-FR") : "—"}
                    </div>
                  </div>
                </div>
              ))}
              {stats.membresExpirés.length > 15 && (
                <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
                  ... et {stats.membresExpirés.length - 15} autres
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <FaCheckCircle className="text-5xl text-green-500 mx-auto mb-3" />
            <p className="text-lg font-medium text-green-600 dark:text-green-400">
              Tous les abonnements sont à jour !
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Aucune action requise
            </p>
          </div>
        )}
      </Section>
    </div>
  );
}
