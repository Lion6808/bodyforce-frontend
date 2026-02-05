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

import React, { useEffect, useState, useMemo } from "react";
import { supabaseServices } from "../supabaseClient";
import {
  FaClock, FaUsers, FaStar, FaExclamationTriangle,
  FaChartBar, FaCalendarAlt, FaEuroSign, FaUserCheck,
  FaUserTimes, FaMars, FaVenus, FaGraduationCap,
  FaArrowUp, FaArrowDown, FaMinus, FaSync,
  FaCheckCircle, FaTimesCircle, FaInfoCircle,
  FaChartLine, FaUserFriends, FaTrophy, FaLightbulb
} from "react-icons/fa";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
  Area, AreaChart, Legend, ComposedChart, Line
} from "recharts";

// ============================================================
// SECTION 2 — Constants
// ============================================================

const CURRENT_YEAR = new Date().getFullYear();
const PREVIOUS_YEAR = CURRENT_YEAR - 1;
const CURRENT_MONTH = new Date().getMonth() + 1; // 1-12
const CURRENT_DAY = new Date().getDate(); // Jour du mois (1-31)

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

// Formate les dates avec le nom du jour (Lun, Mar, etc.)
function formatDailyStatsWithDayNames(dailyStats) {
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  return dailyStats.map(d => {
    const date = new Date(d.date);
    const dayName = dayNames[date.getDay()];
    const dayNum = date.getDate();
    return {
      ...d,
      dateLabel: `${dayName} ${dayNum}`,
    };
  });
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

// Merge hourly stats pour comparaison (double colonnes)
function mergeHourlyStats(currentHourly, previousHourly) {
  const hours = [];
  for (let h = 6; h <= 22; h++) { // Heures d'ouverture typiques
    const current = currentHourly.find(s => s.hour === h);
    const previous = previousHourly.find(s => s.hour === h);
    if ((current?.count || 0) > 0 || (previous?.count || 0) > 0) {
      hours.push({
        hour: `${h}h`,
        [CURRENT_YEAR]: current?.count || 0,
        [PREVIOUS_YEAR]: previous?.count || 0,
      });
    }
  }
  return hours;
}

// Calcule la moyenne mensuelle comparable (même période)
function getComparableAverage(currentPresences, previousPresences) {
  const currentAvg = currentPresences / CURRENT_MONTH;
  const previousAvg = previousPresences / CURRENT_MONTH; // Même période!
  return { currentAvg: Math.round(currentAvg), previousAvg: Math.round(previousAvg) };
}

// Génère un message d'insight basé sur les données
function generateInsight(type, data) {
  switch (type) {
    case "presence":
      const trend = calculateTrend(data.current, data.previous);
      if (trend.direction === "up") {
        return {
          type: "success",
          message: `Excellente progression ! +${trend.value}% de fréquentation par rapport à ${PREVIOUS_YEAR}.`
        };
      } else if (trend.direction === "down") {
        return {
          type: "warning",
          message: `Attention : -${trend.value}% de fréquentation par rapport à ${PREVIOUS_YEAR}. Pensez à relancer les membres inactifs.`
        };
      }
      return { type: "info", message: "Fréquentation stable par rapport à l'année dernière." };

    case "members":
      const activeRate = data.actifs / data.total * 100;
      if (activeRate > 80) {
        return { type: "success", message: `${activeRate.toFixed(0)}% de membres actifs - Excellent taux de rétention !` };
      } else if (activeRate > 60) {
        return { type: "info", message: `${activeRate.toFixed(0)}% de membres actifs - Bon niveau, mais ${data.expired} abonnements à renouveler.` };
      }
      return { type: "warning", message: `${activeRate.toFixed(0)}% de membres actifs - ${data.expired} abonnements expirés à relancer.` };

    case "gender":
      const ratio = data.hommes / (data.hommes + data.femmes) * 100;
      if (ratio > 70) {
        return { type: "info", message: `Clientèle majoritairement masculine (${ratio.toFixed(0)}%). Opportunité : attirer plus de femmes.` };
      } else if (ratio < 30) {
        return { type: "info", message: `Clientèle majoritairement féminine (${(100 - ratio).toFixed(0)}%).` };
      }
      return { type: "success", message: `Bonne mixité : ${ratio.toFixed(0)}% hommes / ${(100 - ratio).toFixed(0)}% femmes.` };

    case "peak":
      const peakHour = data.hourlyStats?.reduce((max, h) => h.count > (max?.count || 0) ? h : max, null);
      if (peakHour) {
        return { type: "info", message: `Heure de pointe : ${peakHour.hour}h avec ${peakHour.count} passages.` };
      }
      return null;

    default:
      return null;
  }
}

// ============================================================
// SECTION 4 — UI Components
// ============================================================

function TrendBadge({ current, previous, suffix = "", inverted = false }) {
  const trend = calculateTrend(current, previous);

  if (trend.direction === "neutral") {
    return (
      <span className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
        <FaMinus className="mr-1" /> stable
      </span>
    );
  }

  const isUp = trend.direction === "up";
  const isPositive = inverted ? !isUp : isUp;

  return (
    <span className={`inline-flex items-center text-xs font-medium ${
      isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
    }`}>
      {isUp ? <FaArrowUp className="mr-1" /> : <FaArrowDown className="mr-1" />}
      {trend.value}%{suffix}
    </span>
  );
}

function StatCard({ icon, label, value, previousValue, subtitle, showTrend = false, highlight = false }) {
  return (
    <div className={`bg-white dark:bg-gray-800 shadow-lg rounded-xl p-5 hover:shadow-xl transition-all duration-200 border ${
      highlight ? "border-blue-300 dark:border-blue-600 ring-2 ring-blue-100 dark:ring-blue-900" : "border-gray-100 dark:border-gray-700"
    }`}>
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

function SectionHeader({ title, icon, subtitle }) {
  return (
    <div className="mb-4">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
        {icon} {title}
      </h3>
      {subtitle && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-7">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function InsightBanner({ type, message, icon }) {
  const styles = {
    success: "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300",
    warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300",
    info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300",
    error: "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300"
  };

  const icons = {
    success: <FaCheckCircle className="text-green-500" />,
    warning: <FaExclamationTriangle className="text-amber-500" />,
    info: <FaInfoCircle className="text-blue-500" />,
    error: <FaTimesCircle className="text-red-500" />
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${styles[type]}`}>
      {icon || icons[type]}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

function SummaryBanner({ displayStats, stats, previousYearStats }) {
  // Calculer le score global de santé de la salle (comparaison sur même période)
  const presenceTrend = calculateTrend(displayStats?.currentPresences || 0, displayStats?.comparablePreviousPresences || 0);
  const activeRate = stats.total > 0 ? (stats.actifs / stats.total * 100) : 0;

  // Score: +1 pour tendance positive, +1 pour taux actif > 70%, +1 pour peu d'expirés
  let score = 0;
  let messages = [];

  if (presenceTrend.direction === "up") {
    score += 1;
    messages.push(`↑ Fréquentation en hausse (+${presenceTrend.value}%)`);
  } else if (presenceTrend.direction === "down") {
    messages.push(`↓ Fréquentation en baisse (-${presenceTrend.value}%)`);
  } else {
    score += 0.5;
    messages.push("→ Fréquentation stable");
  }

  if (activeRate > 70) {
    score += 1;
    messages.push(`${activeRate.toFixed(0)}% de membres actifs`);
  } else if (activeRate > 50) {
    score += 0.5;
    messages.push(`${activeRate.toFixed(0)}% de membres actifs`);
  } else {
    messages.push(`Seulement ${activeRate.toFixed(0)}% de membres actifs`);
  }

  const expiredRate = stats.total > 0 ? (stats.expirés / stats.total * 100) : 0;
  if (expiredRate < 20) {
    score += 1;
  } else if (expiredRate < 40) {
    score += 0.5;
  }

  // Déterminer le niveau global
  let level, levelColor, levelIcon, levelMessage;
  if (score >= 2.5) {
    level = "Excellent";
    levelColor = "from-green-500 to-emerald-600";
    levelIcon = <FaCheckCircle className="text-3xl" />;
    levelMessage = "La salle se porte très bien ! Continuez ainsi.";
  } else if (score >= 1.5) {
    level = "Bon";
    levelColor = "from-blue-500 to-cyan-600";
    levelIcon = <FaChartLine className="text-3xl" />;
    levelMessage = "Performance correcte avec des axes d'amélioration.";
  } else {
    level = "À améliorer";
    levelColor = "from-amber-500 to-orange-600";
    levelIcon = <FaExclamationTriangle className="text-3xl" />;
    levelMessage = "Des actions sont nécessaires pour relancer l'activité.";
  }

  return (
    <div className={`bg-gradient-to-r ${levelColor} rounded-2xl p-6 text-white shadow-xl mb-6`}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          {levelIcon}
          <div>
            <div className="text-sm opacity-90 uppercase tracking-wide">Bilan {CURRENT_YEAR}</div>
            <div className="text-2xl font-bold">{level}</div>
            <div className="text-sm opacity-90 mt-1">{levelMessage}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 lg:gap-4">
          {messages.map((msg, i) => (
            <div key={i} className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 text-sm font-medium">
              {msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children, action, className = "" }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700 ${className}`}>
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
// Composant RadialHeatmap - Heatmap circulaire 24h
// ============================================================
function RadialHeatmap({ data }) {
  if (!data || !data.matrix) return <NoDataMessage />;

  const { matrix, maxHourly } = data;
  // Réorganiser : commencer par Lundi (index 1 dans matrix) -> Dimanche (index 0)
  const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Lun, Mar, Mer, Jeu, Ven, Sam, Dim
  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // Couleurs de l'app (bleu -> cyan -> vert -> jaune -> orange -> rouge)
  const getHeatColor = (value, max) => {
    if (max === 0 || value === 0) return 'rgba(55, 65, 81, 0.3)';
    const ratio = value / max;
    if (ratio < 0.15) return 'rgba(59, 130, 246, 0.4)';
    if (ratio < 0.3) return 'rgba(59, 130, 246, 0.6)';
    if (ratio < 0.45) return 'rgba(6, 182, 212, 0.7)';
    if (ratio < 0.6) return 'rgba(16, 185, 129, 0.75)';
    if (ratio < 0.75) return 'rgba(234, 179, 8, 0.8)';
    if (ratio < 0.9) return 'rgba(249, 115, 22, 0.85)';
    return 'rgba(239, 68, 68, 0.9)';
  };

  const centerX = 280;
  const centerY = 260;
  const innerRadius = 60;
  const outerRadius = 220;
  const dayRingWidth = (outerRadius - innerRadius) / 7;

  // Générer les segments
  const segments = [];
  for (let ringIndex = 0; ringIndex < 7; ringIndex++) {
    const matrixDay = dayOrder[ringIndex];
    for (let hour = 0; hour < 24; hour++) {
      const value = matrix[matrixDay][hour];
      const startAngle = (hour / 24) * 360 - 90;
      const endAngle = ((hour + 1) / 24) * 360 - 90;
      const innerR = innerRadius + ringIndex * dayRingWidth;
      const outerR = innerR + dayRingWidth - 1;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = centerX + innerR * Math.cos(startRad);
      const y1 = centerY + innerR * Math.sin(startRad);
      const x2 = centerX + outerR * Math.cos(startRad);
      const y2 = centerY + outerR * Math.sin(startRad);
      const x3 = centerX + outerR * Math.cos(endRad);
      const y3 = centerY + outerR * Math.sin(endRad);
      const x4 = centerX + innerR * Math.cos(endRad);
      const y4 = centerY + innerR * Math.sin(endRad);

      const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

      const pathD = [
        `M ${x1} ${y1}`,
        `L ${x2} ${y2}`,
        `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${x3} ${y3}`,
        `L ${x4} ${y4}`,
        `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${x1} ${y1}`,
        'Z'
      ].join(' ');

      segments.push(
        <path
          key={`${ringIndex}-${hour}`}
          d={pathD}
          fill={getHeatColor(value, maxHourly)}
          stroke="rgba(17, 24, 39, 0.4)"
          strokeWidth="0.5"
        >
          <title>{dayNames[ringIndex]} {hour}h: {value} passages</title>
        </path>
      );
    }
  }

  // Labels des heures (toutes les 3h pour plus de lisibilité)
  const hourLabels = [0, 3, 6, 9, 12, 15, 18, 21].map(hour => {
    const angle = ((hour / 24) * 360 - 90) * Math.PI / 180;
    const labelR = outerRadius + 25;
    const x = centerX + labelR * Math.cos(angle);
    const y = centerY + labelR * Math.sin(angle);
    return (
      <text
        key={`hour-${hour}`}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: '14px', fontWeight: 600, fill: '#4B5563' }}
      >
        {hour}h
      </text>
    );
  });

  // Labels des jours à GAUCHE du cercle (sur une colonne)
  const dayLabels = dayNames.map((name, index) => {
    const r = innerRadius + (index + 0.5) * dayRingWidth;
    return (
      <text
        key={`day-${index}`}
        x={centerX - outerRadius - 30}
        y={centerY - outerRadius + 25 + index * (dayRingWidth + 4)}
        textAnchor="end"
        dominantBaseline="middle"
        style={{ fontSize: '13px', fontWeight: 500, fill: '#4B5563' }}
      >
        {name}
      </text>
    );
  });

  // Lignes de connexion entre labels et anneaux
  const dayConnectors = dayNames.map((name, index) => {
    const r = innerRadius + (index + 0.5) * dayRingWidth;
    const angle = Math.PI; // 180° = gauche
    const endX = centerX + r * Math.cos(angle);
    const endY = centerY + r * Math.sin(angle);
    const startX = centerX - outerRadius - 8;
    const startY = centerY - outerRadius + 25 + index * (dayRingWidth + 4);
    return (
      <path
        key={`connector-${index}`}
        d={`M ${startX} ${startY} Q ${startX + 20} ${startY} ${endX} ${endY}`}
        fill="none"
        stroke="rgba(107, 114, 128, 0.4)"
        strokeWidth="1.5"
        strokeDasharray="3,3"
      />
    );
  });

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 560 540" className="w-full max-w-[600px]">
        {dayConnectors}
        {segments}
        {hourLabels}
        {dayLabels}
        {/* Centre */}
        <circle cx={centerX} cy={centerY} r={innerRadius - 8} fill="rgba(17, 24, 39, 0.08)" />
        <text
          x={centerX}
          y={centerY - 8}
          textAnchor="middle"
          style={{ fontSize: '20px', fontWeight: 700, fill: '#374151' }}
        >
          24h
        </text>
        <text
          x={centerX}
          y={centerY + 14}
          textAnchor="middle"
          style={{ fontSize: '11px', fill: '#6B7280' }}
        >
          Fréquentation
        </text>
      </svg>
      {/* Légende */}
      <div className="flex items-center gap-3 mt-4">
        <span className="text-sm text-gray-500 dark:text-gray-400">Faible</span>
        <div className="flex gap-1">
          {['rgba(59, 130, 246, 0.4)', 'rgba(59, 130, 246, 0.6)', 'rgba(6, 182, 212, 0.7)', 'rgba(16, 185, 129, 0.75)', 'rgba(234, 179, 8, 0.8)', 'rgba(249, 115, 22, 0.85)', 'rgba(239, 68, 68, 0.9)'].map((color, i) => (
            <div key={i} className="w-8 h-4 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">Fort</span>
      </div>
    </div>
  );
}

// ============================================================
// Composant DayBars - Barres de fréquentation par jour
// ============================================================
function DayBars({ data }) {
  if (!data || !data.dayTotals) return <NoDataMessage />;

  const { dayTotals, maxDaily } = data;

  // Réorganiser pour commencer par Lundi (index 1)
  const orderedDays = [...dayTotals.slice(1), dayTotals[0]];

  // Couleurs par jour (gradient du bleu au violet)
  const dayColors = [
    { bg: 'from-blue-500 to-blue-600', text: 'text-blue-600 dark:text-blue-400' },
    { bg: 'from-cyan-500 to-cyan-600', text: 'text-cyan-600 dark:text-cyan-400' },
    { bg: 'from-teal-500 to-teal-600', text: 'text-teal-600 dark:text-teal-400' },
    { bg: 'from-green-500 to-green-600', text: 'text-green-600 dark:text-green-400' },
    { bg: 'from-yellow-500 to-amber-500', text: 'text-yellow-600 dark:text-yellow-400' },
    { bg: 'from-orange-500 to-orange-600', text: 'text-orange-600 dark:text-orange-400' },
    { bg: 'from-purple-500 to-purple-600', text: 'text-purple-600 dark:text-purple-400' },
  ];

  return (
    <div className="space-y-3">
      {orderedDays.map((day, index) => {
        const percentage = maxDaily > 0 ? (day.total / maxDaily) * 100 : 0;
        const colors = dayColors[index];

        return (
          <div key={day.day} className="flex items-center gap-3">
            <div className="w-12 text-sm font-medium text-gray-600 dark:text-gray-300 text-right">
              {day.day.substring(0, 3)}
            </div>
            <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative">
              <div
                className={`h-full bg-gradient-to-r ${colors.bg} rounded-lg transition-all duration-500 flex items-center justify-end pr-2`}
                style={{ width: `${Math.max(percentage, 5)}%` }}
              >
                {percentage > 25 && (
                  <span className="text-white text-sm font-semibold">{day.total}</span>
                )}
              </div>
              {percentage <= 25 && (
                <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-sm font-semibold ${colors.text}`}>
                  {day.total}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {/* Total */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-600">
        <div className="w-12 text-sm font-bold text-gray-700 dark:text-gray-200 text-right">
          Total
        </div>
        <div className="flex-1 text-lg font-bold text-blue-600 dark:text-blue-400">
          {data.totalPresences} passages
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Composant TopCreneaux - Top 5 des créneaux les plus fréquentés
// ============================================================
function TopCreneaux({ data }) {
  if (!data || !data.matrix) return <NoDataMessage />;

  const { matrix, maxHourly } = data;
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  // Extraire tous les créneaux avec leurs valeurs
  const allSlots = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const count = matrix[day][hour];
      if (count > 0) {
        allSlots.push({ day, hour, count, dayName: dayNames[day] });
      }
    }
  }

  // Trier par nombre de passages décroissant et prendre le top 5
  const topSlots = allSlots
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Couleurs des médailles
  const medalColors = [
    'from-yellow-400 to-amber-500',  // Or
    'from-gray-300 to-gray-400',      // Argent
    'from-orange-400 to-orange-600',  // Bronze
    'from-blue-400 to-blue-500',      // 4e
    'from-indigo-400 to-indigo-500',  // 5e
  ];

  const medalIcons = ['🥇', '🥈', '🥉', '4', '5'];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {topSlots.map((slot, index) => {
        const percentage = maxHourly > 0 ? (slot.count / maxHourly) * 100 : 0;

        return (
          <div
            key={`${slot.day}-${slot.hour}`}
            className={`relative overflow-hidden rounded-xl p-4 bg-gradient-to-br ${medalColors[index]} shadow-lg`}
          >
            {/* Badge de rang */}
            <div className="absolute top-2 right-2 text-2xl">
              {index < 3 ? medalIcons[index] : (
                <span className="bg-white/30 rounded-full w-8 h-8 flex items-center justify-center text-white font-bold text-sm">
                  {medalIcons[index]}
                </span>
              )}
            </div>

            {/* Contenu */}
            <div className="text-white">
              <div className="text-3xl font-bold mb-1">{slot.count}</div>
              <div className="text-white/90 text-sm font-medium">passages</div>
              <div className="mt-3 pt-3 border-t border-white/30">
                <div className="font-semibold">{slot.dayName}</div>
                <div className="text-white/80 text-lg">{slot.hour}h - {slot.hour + 1}h</div>
              </div>
            </div>

            {/* Barre de progression */}
            <div className="mt-3 h-1.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/70 rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Divider({ className = "" }) {
  return <div className={`border-t border-gray-200 dark:border-gray-700 my-8 ${className}`} />;
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
  const [topMembersCurrent, setTopMembersCurrent] = useState([]);
  const [topMembersPrevious, setTopMembersPrevious] = useState([]);
  const [championOfMonth, setChampionOfMonth] = useState(null);
  const [exactPreviousPresences, setExactPreviousPresences] = useState(0); // Présences N-1 même période exacte
  const [heatmapData, setHeatmapData] = useState(null); // Données pour la heatmap radiale

  // Fetch all data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // ✅ OPTIMISATION EGRESS : heatmapData inclus dans getYearlyPresenceStats (évite double fetch)
      const [baseResult, currentYear, previousYear, topCurrent, topPrevious, prevExact] = await Promise.all([
        supabaseServices.getDetailedStatistics(),
        supabaseServices.getYearlyPresenceStats(CURRENT_YEAR),
        supabaseServices.getYearlyPresenceStats(PREVIOUS_YEAR),
        supabaseServices.getTopMembersByYear(CURRENT_YEAR, 10),
        supabaseServices.getTopMembersByYear(PREVIOUS_YEAR, 10),
        // Récupérer présences N-1 jusqu'au même jour (comparaison équitable)
        supabaseServices.getPresenceCountUntilDate(PREVIOUS_YEAR, CURRENT_MONTH, CURRENT_DAY),
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
      const data = await supabaseServices.getTopMembersByPeriod(startDate, endDate, 1);

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
