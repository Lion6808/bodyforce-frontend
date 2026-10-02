// Graphiques de la page Statistiques (heatmap radiale, jours, créneaux) — extraits de StatisticsPage

import { NoDataMessage } from "./StatisticsWidgets";

// ============================================================
// Composant RadialHeatmap - Heatmap circulaire 24h
// ============================================================
export function RadialHeatmap({ data }) {
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
export function DayBars({ data }) {
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
export function TopCreneaux({ data }) {
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
