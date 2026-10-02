// Calculs de la page Statistiques (tendances, fusions N/N-1, messages) — extraits de StatisticsPage

import { CURRENT_YEAR, PREVIOUS_YEAR, CURRENT_MONTH } from "./statisticsPeriods";



export function formatHourlyStats(hourlyStats) {
  return hourlyStats.map((h) => ({
    hour: `${Math.floor(h.hour)}h`,
    count: h.count,
  }));
}

// Formate les dates avec le nom du jour (Lun, Mar, etc.)
export function formatDailyStatsWithDayNames(dailyStats) {
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

export function calculateTrend(current, previous) {
  if (!previous || previous === 0) return { value: 0, direction: "neutral" };
  const diff = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(diff).toFixed(1),
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "neutral"
  };
}

export function mergeMonthlyStats(currentStats, previousStats) {
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
export function mergeHourlyStats(currentHourly, previousHourly) {
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
export function getComparableAverage(currentPresences, previousPresences) {
  const currentAvg = currentPresences / CURRENT_MONTH;
  const previousAvg = previousPresences / CURRENT_MONTH; // Même période!
  return { currentAvg: Math.round(currentAvg), previousAvg: Math.round(previousAvg) };
}

// Génère un message d'insight basé sur les données
export function generateInsight(type, data) {
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
