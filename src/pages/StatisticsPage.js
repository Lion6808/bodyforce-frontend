// 📁 StatisticsPage.js — BODYFORCE (optimisé RPC)
// 🎯 Utilise get_detailed_statistics() pour tous les calculs côté serveur

import React, { useEffect, useState } from "react";
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
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await supabaseServices.getDetailedStatistics();
      setData(result);
      
      console.log("✅ Statistiques détaillées chargées via RPC");
    } catch (err) {
      console.error("❌ Erreur chargement statistiques:", err);
      setError(err?.message || "Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

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

  const stats = data?.stats || {};
  const topMembers = data?.topMembers || [];
  const hourlyStats = data?.hourlyStats || [];
  const dailyStats = data?.dailyStats || [];
  const monthlyStats = data?.monthlyStats || [];
  const genderStats = data?.genderStats || [];
  const paymentStats = data?.paymentStats || {};
  const totalPresences = data?.totalPresences || 0;

  // Formater les heures pour l'affichage
  const formattedHourlyStats = hourlyStats.map(h => ({
    hour: `${Math.floor(h.hour)}h-${Math.floor(h.hour) + 1}h`,
    count: h.count
  }));

  // Formater les stats de paiement pour le graphique
  const paymentChartData = [
    paymentStats.paid || { name: 'Payé', value: 0, color: '#38a169' },
    paymentStats.unpaid || { name: 'En attente', value: 0, color: '#e53e3e' }
  ].filter(p => p.value > 0);

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
          value={stats.total || 0}
          subtitle="membres inscrits"
        />
        <StatCard
          icon={<FaUserCheck className="text-green-500 text-3xl" />}
          label="Abonnements Actifs"
          value={stats.actifs || 0}
          subtitle="en cours de validité"
        />
        <StatCard
          icon={<FaUserTimes className="text-red-500 text-3xl" />}
          label="Expirés"
          value={stats.expirés || 0}
          subtitle="à renouveler"
        />
        <StatCard
          icon={<FaClock className="text-purple-500 text-3xl" />}
          label="Présences"
          value={totalPresences}
          subtitle="cette année"
        />
      </div>

      {/* 🔹 Cartes secondaires */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<FaGraduationCap className="text-yellow-500 text-3xl" />}
          label="Étudiants"
          value={stats.etudiants || 0}
          subtitle="tarif réduit"
        />
        <StatCard
          icon={<FaMars className="text-blue-600 text-3xl" />}
          label="Hommes"
          value={stats.hommes || 0}
          subtitle={`${stats.total ? ((stats.hommes / stats.total) * 100).toFixed(0) : 0}%`}
        />
        <StatCard
          icon={<FaVenus className="text-pink-500 text-3xl" />}
          label="Femmes"
          value={stats.femmes || 0}
          subtitle={`${stats.total ? ((stats.femmes / stats.total) * 100).toFixed(0) : 0}%`}
        />
        <StatCard
          icon={<FaEuroSign className="text-green-500 text-3xl" />}
          label="Revenus totaux"
          value={`${(paymentStats.total || 0).toFixed(0)}€`}
          subtitle="encaissés + en attente"
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
          {formattedHourlyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={formattedHourlyStats}>
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
                    <div className="font-bold text-blue-600">{member.visit_count}</div>
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