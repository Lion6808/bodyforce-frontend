// 📁 StatisticsPage.js — BODYFORCE (optimisé)
// 🎨 Mode sombre (classes `dark:`), calculs mémoïsés, matching presences->members O(1)

import React, { useEffect, useMemo, useState } from "react";
import { supabaseServices } from "../supabaseClient";
import {
  FaUser, FaClock, FaUsers, FaStar, FaExclamationTriangle,
  FaChartBar, FaCalendarAlt, FaEuroSign, FaUserCheck,
  FaUserTimes, FaMars, FaVenus, FaGraduationCap
} from "react-icons/fa";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell,
  Area, AreaChart
} from "recharts";

const COLORS = ["#3182ce", "#38a169", "#e53e3e", "#d69e2e", "#805ad5", "#dd6b20"];

export default function StatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Données brutes
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [presences, setPresences] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseServices.getStatistics();
      setStats(data?.stats || {});
      setMembers(Array.isArray(data?.members) ? data.members : []);
      setPresences(Array.isArray(data?.presences) ? data.presences : []);
      setPayments(Array.isArray(data?.payments) ? data.payments : []);
      console.log(
        `✅ Statistiques chargées: ${data?.members?.length || 0} membres, ${data?.presences?.length || 0} présences`
      );
    } catch (err) {
      console.error("❌ Erreur chargement statistiques:", err);
      setError(err?.message || "Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  // ========= Calculs dérivés (mémoïsés) =========
  const {
    topMembers,
    topHours,
    dailyStats,
    monthlyStats,
    genderStats,
    paymentStats,
    revenueTotal,
  } = useMemo(() => {
    // Map pour lookups O(1) par badgeId
    const membersByBadge = new Map();
    for (const m of members) {
      if (m?.badgeId != null) membersByBadge.set(m.badgeId, m);
    }

    const memberCount = new Map(); // badgeId -> {member, count}
    const hourCount = new Map();   // hour -> count
    const dailyCount = new Map();  // "dd/mm/yyyy" -> count
    const monthlyCount = new Map();// "mmm yyyy" -> count

    for (const p of presences) {
      const ts = p?.timestamp ? new Date(p.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) continue;
      const member = membersByBadge.get(p.badgeId);
      if (!member) continue;

      // Compteur membre
      const existing = memberCount.get(member.badgeId) || { ...member, count: 0 };
      existing.count += 1;
      memberCount.set(member.badgeId, existing);

      // Heures
      const h = ts.getHours();
      hourCount.set(h, (hourCount.get(h) || 0) + 1);

      // Jours (fr-FR)
      const dayKey = ts.toLocaleDateString("fr-FR");
      dailyCount.set(dayKey, (dailyCount.get(dayKey) || 0) + 1);

      // Mois (fr-FR short)
      const monthKey = ts.toLocaleDateString("fr-FR", { year: "numeric", month: "short" });
      monthlyCount.set(monthKey, (monthlyCount.get(monthKey) || 0) + 1);
    }

    // Top 10 membres
    const topMembersArr = Array.from(memberCount.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Heures triées 0..23
    const topHoursArr = Array.from(hourCount.entries())
      .map(([hourNum, count]) => ({
        hour: `${hourNum}h-${(hourNum + 1)}h`,
        hourNum,
        count,
      }))
      .sort((a, b) => a.hourNum - b.hourNum);

    // 7 derniers jours (chronologique)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i)); // il y a 6..0 jours
      return d.toLocaleDateString("fr-FR");
    });

    const dailyStatsArr = last7Days.map((k) => ({
      date: k,
      count: dailyCount.get(k) || 0,
    }));

    // 6 derniers mois (chronologique)
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return d.toLocaleDateString("fr-FR", { year: "numeric", month: "short" });
    });

    const monthlyStatsArr = last6Months.map((k) => ({
      month: k,
      count: monthlyCount.get(k) || 0,
    }));

    // Genres
    const g = { Homme: 0, Femme: 0, Autre: 0 };
    for (const m of members) {
      if (m?.gender === "Homme") g.Homme += 1;
      else if (m?.gender === "Femme") g.Femme += 1;
      else g.Autre += 1;
    }
    const genderStatsArr = [
      { name: "Hommes", value: g.Homme, color: "#3182ce" },
      { name: "Femmes", value: g.Femme, color: "#e53e3e" },
      { name: "Autre", value: g.Autre, color: "#d69e2e" },
    ].filter((x) => x.value > 0);

    // Paiements
    let paidAmount = 0;
    let unpaidAmount = 0;
    for (const p of payments) {
      const val = Number(p?.amount) || 0;
      if (p?.is_paid) paidAmount += val;
      else unpaidAmount += val;
    }
    const paymentStatsArr = [
      { name: "Payé", value: paidAmount, color: "#38a169" },
      { name: "En attente", value: unpaidAmount, color: "#e53e3e" },
    ];
    const revenueTotalVal = paidAmount + unpaidAmount;

    return {
      topMembers: topMembersArr,
      topHours: topHoursArr,
      dailyStats: dailyStatsArr,
      monthlyStats: monthlyStatsArr,
      genderStats: genderStatsArr,
      paymentStats: paymentStatsArr,
      revenueTotal: revenueTotalVal,
    };
  }, [members, presences, payments]);

  // ========= Rendu =========
  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          <span className="ml-4 text-lg text-gray-600 dark:text-gray-300">
            Chargement des statistiques...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded dark:bg-red-900 dark:border-red-600 dark:text-red-100">
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

  return (
    <div className="p-4 bg-gray-50 min-h-screen dark:bg-gray-900 dark:text-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300">
          <FaChartBar className="inline mr-2" />
          Tableau de bord
        </h2>
        <button
          onClick={fetchAllData}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-60"
          disabled={loading}
          aria-label="Actualiser les statistiques"
        >
          {loading && (
            <div className="animate-spin h-5 w-5 border-2 border-white rounded-full" />
          )}
          Actualiser
        </button>
      </div>

      {/* 🔹 Cartes principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<FaUsers className="text-blue-500 text-3xl" />}
          label="Total Membres"
          value={stats?.total || 0}
          subtitle="membres inscrits"
        />
        <StatCard
          icon={<FaUserCheck className="text-green-500 text-3xl" />}
          label="Abonnements Actifs"
          value={stats?.actifs || 0}
          subtitle="en cours de validité"
        />
        <StatCard
          icon={<FaUserTimes className="text-red-500 text-3xl" />}
          label="Expirés"
          value={stats?.expirés || 0}
          subtitle="à renouveler"
        />
        <StatCard
          icon={<FaClock className="text-purple-500 text-3xl" />}
          label="Présences"
          value={presences.length}
          subtitle="cette année"
        />
      </div>

      {/* 🔹 Cartes secondaires */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<FaGraduationCap className="text-yellow-500 text-3xl" />}
          label="Étudiants"
          value={stats?.etudiants || 0}
          subtitle="tarif réduit"
        />
        <StatCard
          icon={<FaMars className="text-blue-600 text-3xl" />}
          label="Hommes"
          value={stats?.hommes || 0}
          subtitle={`${stats?.total ? ((stats.hommes / stats.total) * 100).toFixed(0) : 0}%`}
        />
        <StatCard
          icon={<FaVenus className="text-pink-500 text-3xl" />}
          label="Femmes"
          value={stats?.femmes || 0}
          subtitle={`${stats?.total ? ((stats.femmes / stats.total) * 100).toFixed(0) : 0}%`}
        />
       
      </div>

      {/* 🔹 Graphiques : Présences / Genre */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Section title="Présences - 7 derniers jours" icon={<FaCalendarAlt />}>
          {dailyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  wrapperStyle={{ zIndex: 40 }}
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    padding: "8px 10px",
                    color: "#e5e7eb",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3182ce"
                  fill="#3182ce"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <NoDataMessage />
          )}
        </Section>

        <Section title="Répartition par genre" icon={<FaUsers />}>
          {genderStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={genderStats}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, value, percent }) =>
                    `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                  }
                >
                  {genderStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  wrapperStyle={{ zIndex: 50 }}
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    padding: "8px 10px",
                    color: "#e5e7eb",
                  }}
                  cursor={{ fill: "rgba(59,130,246,0.08)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <NoDataMessage />
          )}
        </Section>
      </div>

      {/* 🔹 Graphiques : Fréquentation / Mensuel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Section title="Fréquentation par heure" icon={<FaClock />}>
          {topHours.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topHours}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip
                  wrapperStyle={{ zIndex: 40 }}
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    padding: "8px 10px",
                    color: "#e5e7eb",
                  }}
                />
                <Bar dataKey="count" fill="#3182ce" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <NoDataMessage />
          )}
        </Section>

        <Section title="Évolution mensuelle" icon={<FaChartBar />}>
          {monthlyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  wrapperStyle={{ zIndex: 40 }}
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    padding: "8px 10px",
                    color: "#e5e7eb",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3182ce"
                  strokeWidth={3}
                  dot={{ fill: "#3182ce", strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <NoDataMessage />
          )}
        </Section>
      </div>

      {/* 🔹 Listes détaillées */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Top 10 membres les plus présents" icon={<FaStar />}>
          {topMembers.length > 0 ? (
            <div className="space-y-2">
              {topMembers.map((member, index) => (
                <div
                  key={member.id ?? member.badgeId ?? index}
                  className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {index === 0 && "🥇"}
                      {index === 1 && "🥈"}
                      {index === 2 && "🥉"}
                      {index > 2 && `#${index + 1}`}
                    </span>
                    <div>
                      <div className="font-semibold dark:text-white">
                        {member.firstName} {member.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Badge: {member.badgeId}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600">{member.count}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">passages</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <NoDataMessage />
          )}
        </Section>

        <Section
          title="Abonnements expirés"
          icon={<FaExclamationTriangle className="text-red-600" />}
          urgent={Boolean(stats?.membresExpirés?.length)}
        >
          {stats?.membresExpirés?.length > 0 ? (
            <div className="space-y-2">
              {stats.membresExpirés.slice(0, 10).map((member, i) => (
                <div
                  key={member.id ?? i}
                  className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-100/20 rounded border-l-4 border-red-400"
                >
                  <div>
                    <div className="font-semibold text-red-800 dark:text-red-300">
                      {member.firstName} {member.name}
                    </div>
                    <div className="text-sm text-red-600 dark:text-red-400">
                      Nécessite un renouvellement
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-red-700 dark:text-red-400">
                      Expiré le
                    </div>
                    <div className="text-sm text-red-600 dark:text-red-300">
                      {member?.endDate ? new Date(member.endDate).toLocaleDateString("fr-FR") : "—"}
                    </div>
                  </div>
                </div>
              ))}
              {stats.membresExpirés.length > 10 && (
                <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-3">
                  ... et {stats.membresExpirés.length - 10} autres membres
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

// ========= UI helpers =========
function StatCard({ icon, label, value, subtitle, className = "" }) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            {label}
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
          {subtitle && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</div>
          )}
        </div>
        <div className="flex-shrink-0 ml-4">{icon}</div>
      </div>
    </div>
  );
}

function Section({ title, icon, children, urgent = false }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <div
        className={`px-6 py-4 border-b ${
          urgent
            ? "bg-red-50 border-red-200 dark:bg-red-100/10 dark:border-red-400/40"
            : "bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700"
        }`}
      >
        <h3
          className={`text-lg font-semibold flex items-center gap-2 ${
            urgent ? "text-red-800 dark:text-red-400" : "text-gray-800 dark:text-white"
          }`}
        >
          {icon} {title}
        </h3>
      </div>
      <div className="p-6">{children}</div>
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
