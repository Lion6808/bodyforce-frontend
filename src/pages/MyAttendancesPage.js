// 📄 Fichier : src/pages/MyAttendancesPage.js
// 🎯 Objectif : Vue "Mes présences" avec PANNEAU DE MOTIVATION
// 🌓 Dark mode : Contrastes corrigés
// 📱 Mobile : Grilles et tailles adaptées

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import {
  FaCalendarAlt,
  FaIdCard,
  FaUser,
  FaRedoAlt,
  FaClock,
  FaFireAlt,
  FaChartBar,
  FaTrophy,
  FaFire,
  FaBullseye,
  FaChartLine,
  FaAward,
  FaBolt,
} from "react-icons/fa";

/* -------------------------------------------
   Helpers de date
-------------------------------------------- */
const formatIntl = (date, fmt) => {
  try {
    const map = {
      "yyyy-MM-dd": { year: "numeric", month: "2-digit", day: "2-digit" },
      "dd/MM/yyyy": { day: "2-digit", month: "2-digit", year: "numeric" },
      "HH:mm": { hour: "2-digit", minute: "2-digit", hour12: false },
      "MMMM yyyy": { month: "long", year: "numeric" },
      "EEEE dd MMMM": { weekday: "long", day: "numeric", month: "long" },
    };
    if (fmt === "yyyy-MM-dd") return date.toISOString().split("T")[0];
    return new Intl.DateTimeFormat("fr-FR", map[fmt] || {}).format(date);
  } catch {
    return "";
  }
};

const toDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseTimestamp = (ts) => new Date(ts);

/* ------------------------------------------------------
   Calcul des statistiques
------------------------------------------------------- */
const calculateAttendanceStats = (presences) => {
  if (!presences || !presences.length) {
    return {
      totalVisits: 0,
      uniqueDays: 0,
      avgVisitsPerDay: 0,
      peakHour: -1,
      peakDay: "",
      firstVisit: null,
      lastVisit: null,
      dailyStats: [],
      hourlyDistribution: new Array(24).fill(0),
      weeklyDistribution: new Array(7).fill(0),
    };
  }

  const dailyPresences = {};
  const hourlyDistribution = new Array(24).fill(0);
  const weeklyDistribution = new Array(7).fill(0);

  presences.forEach((p) => {
    const d = p.parsedDate;
    const dateKey = toDateString(d);
    (dailyPresences[dateKey] ||= []).push(p);
    hourlyDistribution[d.getHours()] += 1;
    weeklyDistribution[d.getDay()] += 1;
  });

  const totalVisits = presences.length;
  const uniqueDays = Object.keys(dailyPresences).length;
  const avgVisitsPerDay = uniqueDays ? Math.round((totalVisits / uniqueDays) * 10) / 10 : 0;

  const peakHour = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));
  const dayNames = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
  const peakDay = dayNames[weeklyDistribution.indexOf(Math.max(...weeklyDistribution))] || "";

  const dailyStats = Object.entries(dailyPresences)
    .map(([date, visits]) => ({
      date: new Date(date),
      visits: visits.length,
      first: visits[visits.length - 1]?.parsedDate,
      last: visits[0]?.parsedDate,
    }))
    .sort((a, b) => b.date - a.date);

  const firstVisit = presences[presences.length - 1]?.parsedDate || null;
  const lastVisit = presences[0]?.parsedDate || null;

  return {
    totalVisits,
    uniqueDays,
    avgVisitsPerDay,
    peakHour,
    peakDay,
    firstVisit,
    lastVisit,
    dailyStats,
    hourlyDistribution,
    weeklyDistribution,
  };
};

/* ------------------------------------------------------
   🎯 NOUVEAU : Calcul des données de motivation
------------------------------------------------------- */
const calculateMotivationData = (presences, userMemberData) => {
  if (!presences || !presences.length) {
    return {
      currentStreak: 0,
      maxStreak: 0,
      level: 1,
      levelProgress: 0,
      nextLevelVisits: 5,
      badges: [],
      monthVisits: 0,
      monthlyGoal: 12,
      monthProgress: 0,
      daysSinceMember: 0,
      estimatedHours: 0,
      estimatedCalories: 0,
      nextBadge: { visits: 5, name: "Débutant" },
      weeklyRegularity: 0,
    };
  }

  const sortedDates = presences
    .map(p => p.parsedDate)
    .sort((a, b) => b - a);

  // 1. Calcul des streaks
  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 1;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (sortedDates.length > 0) {
    const lastVisit = new Date(sortedDates[0]);
    lastVisit.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today - lastVisit) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 1) {
      currentStreak = 1;
      for (let i = 0; i < sortedDates.length - 1; i++) {
        const current = new Date(sortedDates[i]);
        const next = new Date(sortedDates[i + 1]);
        current.setHours(0, 0, 0, 0);
        next.setHours(0, 0, 0, 0);
        const diff = Math.floor((current - next) / (1000 * 60 * 60 * 24));
        if (diff === 1) currentStreak++;
        else break;
      }
    }
  }
  
  // Meilleure série
  for (let i = 0; i < sortedDates.length - 1; i++) {
    const current = new Date(sortedDates[i]);
    const next = new Date(sortedDates[i + 1]);
    current.setHours(0, 0, 0, 0);
    next.setHours(0, 0, 0, 0);
    const diff = Math.floor((current - next) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      tempStreak++;
    } else {
      maxStreak = Math.max(maxStreak, tempStreak);
      tempStreak = 1;
    }
  }
  maxStreak = Math.max(maxStreak, tempStreak);

  // 2. Niveau
  const totalVisits = presences.length;
  const level = Math.floor(totalVisits / 5) + 1;
  const nextLevelVisits = level * 5;
  const levelProgress = ((totalVisits % 5) / 5) * 100;

  // 3. Badges
  const badges = [];
  if (totalVisits >= 5) badges.push({ icon: "🥉", name: "Débutant", desc: "5 visites" });
  if (totalVisits >= 10) badges.push({ icon: "🥈", name: "Régulier", desc: "10 visites" });
  if (totalVisits >= 20) badges.push({ icon: "🥇", name: "Assidu", desc: "20 visites" });
  if (totalVisits >= 50) badges.push({ icon: "💎", name: "Expert", desc: "50 visites" });
  
  const morningVisits = presences.filter(p => p.parsedDate.getHours() < 9).length;
  if (morningVisits >= 5) badges.push({ icon: "🌅", name: "Lève-tôt", desc: "5 visites avant 9h" });
  
  if (maxStreak >= 7) badges.push({ icon: "🔥", name: "Warrior", desc: "7 jours consécutifs" });

  // 4. Objectif mensuel
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthVisits = presences.filter(p => {
    const d = p.parsedDate;
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;
  
  const monthlyGoal = 12;
  const monthProgress = (monthVisits / monthlyGoal) * 100;

  // 5. Ancienneté
  const memberSince = userMemberData?.createdAt 
    ? new Date(userMemberData.createdAt) 
    : new Date(sortedDates[sortedDates.length - 1]);
  const daysSinceMember = Math.floor((today - memberSince) / (1000 * 60 * 60 * 24));

  // 6. Estimations
  const estimatedHours = totalVisits * 1.5;
  const estimatedCalories = totalVisits * 300;

  // 7. Prochain badge
  const nextBadge = totalVisits < 10 ? { visits: 10, name: "Régulier" } :
                    totalVisits < 20 ? { visits: 20, name: "Assidu" } :
                    totalVisits < 50 ? { visits: 50, name: "Expert" } :
                    { visits: 100, name: "Légende" };

  // 8. Régularité hebdomadaire
  const weeklyRegularity = daysSinceMember > 0 
    ? Math.round((totalVisits / (daysSinceMember / 7)) * 10) / 10 
    : 0;

  return {
    currentStreak,
    maxStreak,
    level,
    levelProgress,
    nextLevelVisits,
    badges,
    monthVisits,
    monthlyGoal,
    monthProgress,
    daysSinceMember,
    estimatedHours,
    estimatedCalories,
    nextBadge,
    weeklyRegularity,
  };
};

/* -------------------------------------------
   🎯 NOUVEAU : Composant Panneau de Motivation
-------------------------------------------- */
function MotivationPanel({ motivationData, stats }) {
  const getLevelName = (level) => {
    if (level <= 2) return "Débutant";
    if (level <= 4) return "Intermédiaire";
    if (level <= 8) return "Confirmé";
    if (level <= 12) return "Expert";
    return "Maître";
  };

  const getMotivationalMessage = () => {
    const { currentStreak, monthProgress } = motivationData;
    if (currentStreak >= 5) return "🔥 Incroyable série ! Continuez comme ça !";
    if (currentStreak >= 3) return "💪 Vous êtes sur une belle lancée !";
    if (monthProgress >= 75) return "🎯 Objectif du mois presque atteint !";
    if (stats.totalVisits < 5) return "🌟 Continuez, chaque visite compte !";
    return "💪 Vous progressez bien, ne lâchez rien !";
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Message motivant */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <FaBolt className="text-3xl" />
          <div>
            <h3 className="text-xl font-bold">{getMotivationalMessage()}</h3>
            <p className="text-indigo-100 text-sm mt-1">
              Niveau {motivationData.level} • {getLevelName(motivationData.level)}
            </p>
          </div>
        </div>
      </div>

      {/* Série et Objectif du mois */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Série actuelle */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
              <FaFire className="text-orange-500 dark:text-orange-400 text-xl" />
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white font-bold text-lg">Série en cours</h4>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Jours consécutifs</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl font-bold text-orange-500 dark:text-orange-400">
                  {motivationData.currentStreak}
                </span>
                <span className="text-gray-500 dark:text-gray-400 text-sm">
                  jour{motivationData.currentStreak > 1 ? 's' : ''}
                </span>
              </div>
              {motivationData.currentStreak > 0 ? (
                <p className="text-green-600 dark:text-green-400 text-sm font-medium">
                  🔥 Continue ! Ne brise pas la série
                </p>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Venez aujourd'hui pour démarrer une série !
                </p>
              )}
            </div>
            
            <div className="pt-3 border-t dark:border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Meilleure série</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {motivationData.maxStreak} jours
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Objectif du mois */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <FaBullseye className="text-blue-500 dark:text-blue-400 text-xl" />
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white font-bold text-lg">Objectif du mois</h4>
              <p className="text-gray-500 dark:text-gray-400 text-sm">12 visites recommandées</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-4xl font-bold text-blue-500 dark:text-blue-400">
                  {motivationData.monthVisits}
                </span>
                <span className="text-gray-500 dark:text-gray-400 text-sm">
                  / {motivationData.monthlyGoal} visites
                </span>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(motivationData.monthProgress, 100)}%` }}
                />
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {motivationData.monthVisits >= motivationData.monthlyGoal ? (
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    🎉 Objectif atteint !
                  </span>
                ) : (
                  <span>
                    Plus que <strong>{motivationData.monthlyGoal - motivationData.monthVisits}</strong> visite{(motivationData.monthlyGoal - motivationData.monthVisits) > 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Niveau et progression */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
            <FaChartLine className="text-purple-500 dark:text-purple-400 text-xl" />
          </div>
          <div className="flex-1">
            <h4 className="text-gray-900 dark:text-white font-bold text-lg">
              Niveau {motivationData.level} • {getLevelName(motivationData.level)}
            </h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {stats.totalVisits} / {motivationData.nextLevelVisits} visites jusqu'au niveau {motivationData.level + 1}
            </p>
          </div>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-2">
          <div 
            className="bg-gradient-to-r from-purple-500 to-pink-500 dark:from-purple-400 dark:to-pink-400 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
            style={{ width: `${motivationData.levelProgress}%` }}
          >
            {motivationData.levelProgress > 15 && (
              <span className="text-white text-xs font-bold">
                {Math.round(motivationData.levelProgress)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Badges débloqués */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
            <FaAward className="text-yellow-600 dark:text-yellow-400 text-xl" />
          </div>
          <div className="flex-1">
            <h4 className="text-gray-900 dark:text-white font-bold text-lg">Vos Badges</h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {motivationData.badges.length} badge{motivationData.badges.length > 1 ? 's' : ''} débloqué{motivationData.badges.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        {motivationData.badges.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {motivationData.badges.map((badge, idx) => (
              <div 
                key={idx}
                className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border-2 border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-all hover:shadow-md"
              >
                <div className="text-4xl mb-2 text-center">{badge.icon}</div>
                <div className="text-center">
                  <p className="font-bold text-sm text-gray-900 dark:text-white">{badge.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{badge.desc}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>Continuez vos visites pour débloquer des badges !</p>
            <p className="text-sm mt-2">
              Prochain : <strong>{motivationData.nextBadge.name}</strong> à {motivationData.nextBadge.visits} visites
            </p>
          </div>
        )}
        
        {stats.totalVisits < motivationData.nextBadge.visits && (
          <div className="mt-4 pt-4 border-t dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              🎯 Prochain badge : <strong>{motivationData.nextBadge.name}</strong>
              <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                (+{motivationData.nextBadge.visits - stats.totalVisits} visite{(motivationData.nextBadge.visits - stats.totalVisits) > 1 ? 's' : ''})
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Statistiques motivantes */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 rounded-xl p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <FaClock className="text-green-600 dark:text-green-400" />
            <span className="text-xs font-medium text-green-700 dark:text-green-300">Temps total</span>
          </div>
          <p className="text-2xl font-bold text-green-900 dark:text-green-100">
            {motivationData.estimatedHours}h
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">Entraînement estimé</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/10 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2 mb-2">
            <FaFireAlt className="text-orange-600 dark:text-orange-400" />
            <span className="text-xs font-medium text-orange-700 dark:text-orange-300">Calories</span>
          </div>
          <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
            ~{motivationData.estimatedCalories}
          </p>
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Brûlées (estimé)</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/10 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-2">
            <FaTrophy className="text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Régularité</span>
          </div>
          <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
            {motivationData.weeklyRegularity}
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Visites/semaine</p>
        </div>
      </div>

      {/* Recommandation personnalisée */}
      {stats.peakDay && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-6 border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-indigo-500 dark:bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl">💡</span>
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white font-bold mb-2">Recommandation personnalisée</h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Votre meilleure performance : <strong>les {stats.peakDay}s{stats.peakHour >= 0 ? ` à ${stats.peakHour}h` : ''}</strong>.
                {motivationData.monthVisits < motivationData.monthlyGoal && (
                  <> Pour atteindre votre objectif, planifiez <strong>{Math.ceil((motivationData.monthlyGoal - motivationData.monthVisits) / 4)} visite{Math.ceil((motivationData.monthlyGoal - motivationData.monthVisits) / 4) > 1 ? 's' : ''} par semaine</strong>.</>
                )}
                {motivationData.currentStreak === 0 && motivationData.maxStreak > 0 && (
                  <> Vous avez déjà fait une série de <strong>{motivationData.maxStreak} jours</strong>, vous pouvez le refaire ! 💪</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------
   UI Subcomponents (inchangés)
-------------------------------------------- */
function StatTile({ icon: Icon, title, value, accent = "indigo" }) {
  const gradient =
    accent === "green"
      ? "from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/20"
      : accent === "purple"
      ? "from-purple-50 to-fuchsia-50 dark:from-purple-900/30 dark:to-fuchsia-900/20"
      : accent === "orange"
      ? "from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20"
      : "from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/20";

  const iconBg =
    accent === "green"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
      : accent === "purple"
      ? "bg-purple-500/15 text-purple-600 dark:text-purple-300"
      : accent === "orange"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
      : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300";

  return (
    <div className={`p-4 rounded-2xl border dark:border-gray-700 shadow-sm bg-gradient-to-br ${gradient}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className="text-lg" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">
            {title}
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
        </div>
      </div>
    </div>
  );
}

function BarRow({ label, value, max }) {
  const width = max ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="w-10 text-xs text-gray-600 dark:text-gray-300">{label}</div>
      <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="w-10 text-right text-xs text-gray-600 dark:text-gray-300">{value}</div>
    </div>
  );
}

function HourCell({ hour, count, max }) {
  const alpha = max ? 0.15 + (count / max) * 0.6 : 0.15;
  return (
    <div className="flex flex-col items-center">
      <div className="text-[10px] text-gray-600 dark:text-gray-300 mb-1">{hour}h</div>
      <div
        className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center shadow-sm"
        style={{ background: `rgba(99,102,241,${alpha})` }}
        title={`${count} visite${count > 1 ? "s" : ""}`}
      >
        <span className="text-xs font-semibold text-gray-900 dark:text-white">{count || ""}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------
   PAGE PRINCIPALE
-------------------------------------------- */
export default function MyAttendancesPage() {
  const { user, userMemberData } = useAuth();

  const [range, setRange] = useState(() => {
    const today = new Date();
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return {
      start: formatIntl(monthAgo, "yyyy-MM-dd"),
      end: formatIntl(today, "yyyy-MM-dd"),
    };
  });
  const [loading, setLoading] = useState(false);
  const [presences, setPresences] = useState([]);

  const stats = useMemo(() => calculateAttendanceStats(presences), [presences]);
  
  // 🎯 NOUVEAU : Calcul des données de motivation
  const motivationData = useMemo(
    () => calculateMotivationData(presences, userMemberData),
    [presences, userMemberData]
  );

  const badgeId = userMemberData?.badgeId || null;
  const memberName =
    userMemberData?.firstname || userMemberData?.lastname
      ? `${userMemberData?.firstname || ""} ${userMemberData?.lastname || ""}`.trim()
      : user?.email || "Utilisateur";

  const memberPhoto = userMemberData?.photo || "";

  useEffect(() => {
    const fetchPresences = async () => {
      if (!user || !badgeId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("presences")
          .select("*")
          .eq("badgeId", badgeId)
          .gte("timestamp", `${range.start}T00:00:00`)
          .lte("timestamp", `${range.end}T23:59:59`)
          .order("timestamp", { ascending: false });

        if (error) {
          console.error("[MyAttendances] Supabase error:", error);
          setPresences([]);
        } else {
          const list = (data || []).map((p) => ({
            ...p,
            parsedDate: parseTimestamp(p.timestamp),
          }));
          setPresences(list);
        }
      } catch (e) {
        console.error("[MyAttendances] fetchPresences exception:", e);
        setPresences([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPresences();
  }, [user, badgeId, range.start, range.end]);

  const setDays = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    setRange({ start: formatIntl(start, "yyyy-MM-dd"), end: formatIntl(end, "yyyy-MM-dd") });
  };

  const setMonths = (months) => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    setRange({ start: formatIntl(start, "yyyy-MM-dd"), end: formatIntl(end, "yyyy-MM-dd") });
  };

  const setCurrentYear = () => {
    const end = new Date();
    const start = new Date(end.getFullYear(), 0, 1); // 1er janvier de l'année en cours
    setRange({ start: formatIntl(start, "yyyy-MM-dd"), end: formatIntl(end, "yyyy-MM-dd") });
  };

  const dayLabels = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];

  return (
    <div className="p-4 md:p-6 text-gray-900 dark:text-gray-100">
      {/* 1️⃣ HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Mes présences</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Consultez vos statistiques et l'historique de vos visites.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium">{memberName}</div>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Badge : {badgeId || "—"}
            </div>
          </div>
          <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-white dark:ring-gray-700 shadow-lg flex-shrink-0">
            {memberPhoto ? (
              <img
                src={memberPhoto}
                alt="avatar"
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-400">
                <FaUser />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2️⃣ ÉTATS D'ERREUR */}
      {!user && (
        <div className="p-4 rounded-2xl border dark:border-gray-700 bg-yellow-50 text-yellow-900 mb-6">
          Vous devez être connecté pour voir vos présences.
        </div>
      )}
      {user && !userMemberData && (
        <div className="p-4 rounded-2xl border dark:border-gray-700 bg-yellow-50 text-yellow-900 mb-6">
          Aucun profil membre lié à votre compte. Contactez un administrateur.
        </div>
      )}
      {user && userMemberData && !badgeId && (
        <div className="p-4 rounded-2xl border dark:border-gray-700 bg-yellow-50 text-yellow-900 mb-6">
          Aucun badge n'est associé à votre profil. Contactez un administrateur.
        </div>
      )}

      {/* 3️⃣ LOADER */}
      {loading && (
        <div className="my-6 text-sm text-gray-600 dark:text-gray-300">Chargement…</div>
      )}

      {/* 4️⃣ BLOC "SUIVI DES PRÉSENCES" - EN PREMIER */}
      {!loading && user && userMemberData && badgeId && (
        <>
          <div className="rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm mb-6">
            <div className="px-4 md:px-6 py-4 border-b dark:border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                  <FaChartBar />
                </div>
                <div>
                  <div className="text-sm font-semibold">Suivi des présences</div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    Membre : {memberName} {badgeId ? `(Badge : ${badgeId})` : ""}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <button
                  className="text-xs px-3 py-1.5 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 dark:text-gray-100"
                  onClick={() => setDays(7)}
                >
                  7 derniers jours
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 dark:text-gray-100"
                  onClick={() => setDays(30)}
                >
                  30 derniers jours
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 dark:text-gray-100"
                  onClick={() => setMonths(3)}
                >
                  3 derniers mois
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 dark:text-gray-100"
                  onClick={setCurrentYear}
                >
                  Année en cours
                </button>

                <div className="flex items-end gap-2">
                  <div className="flex flex-col">
                    <label className="text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                      Début
                    </label>
                    <input
                      type="date"
                      value={range.start}
                      onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
                      className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                      Fin
                    </label>
                    <input
                      type="date"
                      value={range.end}
                      onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
                      className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <button
                    onClick={() => setRange((r) => ({ ...r }))}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    title="Actualiser"
                  >
                    <FaRedoAlt /> Actualiser
                  </button>
                </div>
              </div>
            </div>

            {/* Tuiles récap */}
            <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-4 gap-3">
              <StatTile icon={FaCalendarAlt} title="Total visites" value={stats.totalVisits} accent="indigo" />
              <StatTile icon={FaIdCard} title="Jours uniques" value={stats.uniqueDays} accent="green" />
              <StatTile icon={FaClock} title="Moyenne / jour" value={stats.avgVisitsPerDay} accent="purple" />
              <StatTile icon={FaFireAlt} title="Heure favorite" value={stats.peakHour >= 0 ? `${stats.peakHour}h` : "-"} accent="orange" />
            </div>
          </div>

          {/* 5️⃣ GRAPHIQUES DE RÉPARTITION */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="p-4 md:p-6 rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
              <div className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Répartition par jour de la semaine
              </div>
              {(() => {
                const max = Math.max(...stats.weeklyDistribution);
                return dayLabels.map((lbl, idx) => (
                  <BarRow key={lbl} label={lbl} value={stats.weeklyDistribution[idx] || 0} max={max} />
                ));
              })()}
              {stats.peakDay && (
                <div className="mt-4 text-sm text-indigo-700 dark:text-indigo-300">
                  Jour préféré : {stats.peakDay}
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
              <div className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Répartition par heure
              </div>
              <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
                {Array.from({ length: 24 }).map((_, h) => (
                  <HourCell
                    key={h}
                    hour={h}
                    count={stats.hourlyDistribution[h] || 0}
                    max={Math.max(...stats.hourlyDistribution)}
                  />
                ))}
              </div>
              {stats.peakHour >= 0 && (
                <div className="mt-4 text-sm text-purple-700 dark:text-purple-300">
                  Heure de pointe : {stats.peakHour}h
                </div>
              )}
            </div>
          </div>

          {/* 6️⃣ PANNEAU DE MOTIVATION */}
          {presences.length > 0 && (
            <MotivationPanel motivationData={motivationData} stats={stats} />
          )}

          {/* 7️⃣ HISTORIQUE DÉTAILLÉ */}
          {stats.dailyStats.length > 0 && (
            <div className="p-4 md:p-6 rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
              <div className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Historique détaillé des visites
              </div>
              <ul className="divide-y dark:divide-gray-700">
                {stats.dailyStats.map((d) => {
                  const k = d.date.toISOString();
                  return (
                    <li key={k} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100 flex-shrink-0">
                          {formatIntl(d.date, "dd/MM/yyyy")}
                        </div>
                        <div className="text-sm min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {formatIntl(d.date, "EEEE dd MMMM")}
                          </div>
                          <div className="text-gray-600 dark:text-gray-300 text-xs">
                            {d.visits} visite{d.visits > 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-800 dark:text-gray-200 flex-shrink-0">
                        {d.first && `Arrivée : ${formatIntl(d.first, "HH:mm")}`}
                        {d.last && d.first !== d.last && ` — Dernier badge : ${formatIntl(d.last, "HH:mm")}`}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ✅ FIN DU FICHIER