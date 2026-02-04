/**
 * StatisticsPage.js — BODYFORCE
 *
 * Dashboard page displaying detailed gym statistics with year-over-year comparison.
 * Features:
 *  - Year selector (current year, previous year, all time)
 *  - KPI cards with trend indicators
 *  - Comparative charts (current vs previous year)
 *  - Top members by period
 *  - Expired subscriptions list
 */

// ============================================================
// SECTION 1 — Imports
// ============================================================

import React, { useEffect, useState, useMemo } from "react";
import { supabaseServices } from "../supabaseClient";
import {
  FaClock, FaUsers, FaStar, FaExclamationTriangle,
  FaChartBar, FaCalendarAlt, FaEuroSign, FaUserCheck,
  FaUserTimes, FaMars, FaVenus, FaGraduationCap,
  FaArrowUp, FaArrowDown, FaMinus, FaSync
} from "react-icons/fa";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell,
  Area, AreaChart, Legend, ComposedChart
} from "recharts";

// ============================================================
// SECTION 2 — Constants
// ============================================================

const CURRENT_YEAR = new Date().getFullYear();
const PREVIOUS_YEAR = CURRENT_YEAR - 1;

const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "#111827",
  border: "1px solid #374151",
  borderRadius: 8,
  padding: "8px 12px",
  color: "#e5e7eb",
};

const PERIOD_OPTIONS = [
  { value: "current", label: `${CURRENT_YEAR}`, year: CURRENT_YEAR },
  { value: "previous", label: `${PREVIOUS_YEAR}`, year: PREVIOUS_YEAR },
  { value: "comparison", label: "Comparaison" },
  { value: "all", label: "Tout" },
];

// ============================================================
// SECTION 3 — Helper functions
// ============================================================

function formatHourlyStats(hourlyStats) {
  return hourlyStats.map((h) => ({
    hour: `${Math.floor(h.hour)}h`,
    count: h.count,
  }));
}

function calculateTrend(current, previous) {
  if (!previous || previous === 0) return { value: 0, direction: "neutral" };
  const diff = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(diff).toFixed(1),
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "neutral"
  };
}

function mergeMonthlyStats(currentStats, previousStats) {
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  return monthNames.map((month, index) => {
    const current = currentStats.find(s => s.monthIndex === index);
    const previous = previousStats.find(s => s.monthIndex === index);
    return {
      month,
      [CURRENT_YEAR]: current?.count || 0,
      [PREVIOUS_YEAR]: previous?.count || 0,
    };
  });
}

// ============================================================
// SECTION 4 — UI Components
// ============================================================

function TrendBadge({ current, previous, suffix = "" }) {
  const trend = calculateTrend(current, previous);

  if (trend.direction === "neutral") {
    return (
      <span className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
        <FaMinus className="mr-1" /> stable
      </span>
    );
  }

  const isUp = trend.direction === "up";
  return (
    <span className={`inline-flex items-center text-xs font-medium ${
      isUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
    }`}>
      {isUp ? <FaArrowUp className="mr-1" /> : <FaArrowDown className="mr-1" />}
      {trend.value}%{suffix}
    </span>
  );
}

function StatCard({ icon, label, value, previousValue, subtitle, showTrend = false }) {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-5 hover:shadow-xl transition-all duration-200 border border-gray-100 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            {label}
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {value}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {showTrend && previousValue !== undefined && (
              <TrendBadge current={value} previous={previousValue} />
            )}
            {subtitle && !showTrend && (
              <span className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</span>
            )}
          </div>
          {showTrend && previousValue !== undefined && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              vs {previousValue} l'an dernier
            </div>
          )}
        </div>
        <div className="flex-shrink-0 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          {icon}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children, action }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
      <div className="px-6 py-4 border-b bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-white">
          {icon} {title}
        </h3>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function PeriodSelector({ value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            value === option.value
              ? "bg-blue-600 text-white shadow-md"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function NoDataMessage() {
  return (
    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
      <FaChartBar className="text-4xl mx-auto mb-2 opacity-50" />
      <p>Aucune donnée disponible</p>
    </div>
  );
}

// ============================================================
// SECTION 5 — Main Component
// ============================================================

export default function StatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("comparison");

  // Data states
  const [baseData, setBaseData] = useState(null);
  const [currentYearStats, setCurrentYearStats] = useState(null);
  const [previousYearStats, setPreviousYearStats] = useState(null);

  // Fetch all data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch base stats and yearly comparison in parallel
      const [baseResult, currentYear, previousYear] = await Promise.all([
        supabaseServices.getDetailedStatistics(),
        supabaseServices.getYearlyPresenceStats(CURRENT_YEAR),
        supabaseServices.getYearlyPresenceStats(PREVIOUS_YEAR),
      ]);

      setBaseData(baseResult);
      setCurrentYearStats(currentYear);
      setPreviousYearStats(previousYear);
    } catch (err) {
      console.error("Erreur chargement statistiques:", err);
      setError(err?.message || "Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  // Computed data based on period
  const displayStats = useMemo(() => {
    if (!currentYearStats || !previousYearStats) return null;

    return {
      currentPresences: currentYearStats.totalPresences,
      previousPresences: previousYearStats.totalPresences,
      totalPresences: (currentYearStats.totalPresences || 0) + (previousYearStats.totalPresences || 0),
      currentMonthly: currentYearStats.monthlyStats,
      previousMonthly: previousYearStats.monthlyStats,
      currentHourly: currentYearStats.hourlyStats,
      previousHourly: previousYearStats.hourlyStats,
    };
  }, [currentYearStats, previousYearStats]);

  // Merged monthly data for comparison chart
  const comparisonMonthlyData = useMemo(() => {
    if (!displayStats) return [];
    return mergeMonthlyStats(displayStats.currentMonthly, displayStats.previousMonthly);
  }, [displayStats]);

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
  const topMembers = baseData?.topMembers || [];
  const dailyStats = baseData?.dailyStats || [];
  const genderStats = baseData?.genderStats || [];
  const paymentStats = baseData?.paymentStats || {};

  return (
    <div className="p-4 bg-gray-50 min-h-screen dark:bg-gray-900 dark:text-gray-100">

      {/* Header with period selector */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <FaChartBar />
          Tableau de bord
        </h2>
        <div className="flex items-center gap-4">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button
            onClick={fetchAllData}
            className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 transition-colors"
            title="Actualiser"
          >
            <FaSync className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* KPI Cards - Presences with comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<FaClock className="text-blue-500 text-2xl" />}
          label={`Présences ${CURRENT_YEAR}`}
          value={displayStats?.currentPresences || 0}
          previousValue={displayStats?.previousPresences}
          showTrend={true}
        />
        <StatCard
          icon={<FaClock className="text-purple-500 text-2xl" />}
          label={`Présences ${PREVIOUS_YEAR}`}
          value={displayStats?.previousPresences || 0}
          subtitle="année précédente"
        />
        <StatCard
          icon={<FaClock className="text-indigo-500 text-2xl" />}
          label="Total historique"
          value={baseData?.totalPresences || 0}
          subtitle="depuis le début"
        />
        <StatCard
          icon={<FaCalendarAlt className="text-cyan-500 text-2xl" />}
          label="Moyenne/mois"
          value={Math.round((displayStats?.currentPresences || 0) / new Date().getMonth() || 1)}
          previousValue={Math.round((displayStats?.previousPresences || 0) / 12)}
          showTrend={true}
        />
      </div>

      {/* KPI Cards - Members */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<FaUsers className="text-blue-500 text-2xl" />}
          label="Total Membres"
          value={stats.total || 0}
          subtitle="inscrits"
        />
        <StatCard
          icon={<FaUserCheck className="text-green-500 text-2xl" />}
          label="Abonnements Actifs"
          value={stats.actifs || 0}
          subtitle="en cours"
        />
        <StatCard
          icon={<FaUserTimes className="text-red-500 text-2xl" />}
          label="Expirés"
          value={stats.expirés || 0}
          subtitle="à renouveler"
        />
        <StatCard
          icon={<FaEuroSign className="text-green-500 text-2xl" />}
          label="Revenus"
          value={`${(paymentStats.total || 0).toFixed(0)}€`}
          subtitle="encaissés"
        />
      </div>

      {/* KPI Cards - Demographics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<FaMars className="text-blue-600 text-2xl" />}
          label="Hommes"
          value={stats.hommes || 0}
          subtitle={`${stats.total ? ((stats.hommes / stats.total) * 100).toFixed(0) : 0}% du total`}
        />
        <StatCard
          icon={<FaVenus className="text-pink-500 text-2xl" />}
          label="Femmes"
          value={stats.femmes || 0}
          subtitle={`${stats.total ? ((stats.femmes / stats.total) * 100).toFixed(0) : 0}% du total`}
        />
        <StatCard
          icon={<FaGraduationCap className="text-yellow-500 text-2xl" />}
          label="Étudiants"
          value={stats.etudiants || 0}
          subtitle="tarif réduit"
        />
        <StatCard
          icon={<FaStar className="text-orange-500 text-2xl" />}
          label="Top visiteur"
          value={topMembers[0]?.visit_count || 0}
          subtitle={topMembers[0] ? `${topMembers[0].firstName} ${topMembers[0].name}` : ""}
        />
      </div>

      {/* Charts Row 1: Monthly comparison + Gender */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section
          title={`Évolution mensuelle ${period === "comparison" ? "(comparaison)" : ""}`}
          icon={<FaChartBar />}
        >
          {comparisonMonthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              {period === "comparison" ? (
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
              ) : (
                <BarChart data={period === "current" ? displayStats?.currentMonthly : displayStats?.previousMonthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} />
                  <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          ) : (
            <NoDataMessage />
          )}
        </Section>

        <Section title="Répartition par genre" icon={<FaUsers />}>
          {genderStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={genderStats}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  innerRadius={60}
                  label={({ name, value, percent }) =>
                    `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                  }
                >
                  {genderStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <NoDataMessage />
          )}
        </Section>
      </div>

      {/* Charts Row 2: Daily + Hourly */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section title="Présences - 7 derniers jours (temps réel)" icon={<FaCalendarAlt />}>
          {dailyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <NoDataMessage />
          )}
        </Section>

        <Section
          title={`Fréquentation par heure ${period === "previous" ? `(${PREVIOUS_YEAR})` : period === "current" ? `(${CURRENT_YEAR})` : ""}`}
          icon={<FaClock />}
        >
          {(() => {
            const hourlyData = period === "previous"
              ? displayStats?.previousHourly
              : displayStats?.currentHourly;

            if (!hourlyData?.length) return <NoDataMessage />;

            return (
              <ResponsiveContainer width="100%" height={280}>
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
            );
          })()}
        </Section>
      </div>

      {/* Lists: Top members + Expired */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Top 10 membres les plus présents" icon={<FaStar className="text-yellow-500" />}>
          {topMembers.length > 0 ? (
            <div className="space-y-2">
              {topMembers.map((member, index) => (
                <div
                  key={member.id ?? member.badgeId ?? index}
                  className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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

        <Section
          title={`Abonnements expirés (${stats?.membresExpirés?.length || 0})`}
          icon={<FaExclamationTriangle className="text-red-500" />}
        >
          {stats?.membresExpirés?.length > 0 ? (
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
                      {member?.endDate ? new Date(member.endDate).toLocaleDateString("fr-FR") : "—"}
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
          ) : (
            <div className="text-center text-green-600 py-8">
              <FaUserCheck className="text-4xl mx-auto mb-2" />
              <p>Tous les abonnements sont à jour !</p>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
