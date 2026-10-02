// Petits composants de la page Statistiques — extraits de StatisticsPage

import {
  FaExclamationTriangle,
  FaChartBar,
  FaArrowUp,
  FaArrowDown,
  FaMinus,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaChartLine,
} from "react-icons/fa";
import { calculateTrend } from "../../utils/statisticsUtils";
import { CURRENT_YEAR, PERIOD_OPTIONS } from "../../utils/statisticsPeriods";

export function TrendBadge({ current, previous, suffix = "", inverted = false }) {
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

export function StatCard({ icon, label, value, previousValue, subtitle, showTrend = false, highlight = false }) {
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

export function SectionHeader({ title, icon, subtitle }) {
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

export function InsightBanner({ type, message, icon }) {
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

export function SummaryBanner({ displayStats, stats, previousYearStats }) {
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

export function Section({ title, icon, children, action, className = "" }) {
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

export function PeriodSelector({ value, onChange }) {
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

// Interrupteur : inclure ou non les membres du comité dans les stats
export function ComiteToggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      title="Inclure les membres du comité dans les statistiques"
      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
        value
          ? "bg-purple-600 text-white shadow-md"
          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
      }`}
    >
      {value ? "Comité inclus" : "Comité exclu"}
    </button>
  );
}

export function NoDataMessage() {
  return (
    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
      <FaChartBar className="text-4xl mx-auto mb-2 opacity-50" />
      <p>Aucune donnée disponible</p>
    </div>
  );
}

export function Divider({ className = "" }) {
  return <div className={`border-t border-gray-200 dark:border-gray-700 my-8 ${className}`} />;
}
