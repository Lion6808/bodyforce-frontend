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
} from 'recharts';

const COLORS = ['#3182ce', '#38a169', '#e53e3e', '#d69e2e', '#805ad5', '#dd6b20'];

export default function StatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [presences, setPresences] = useState([]);
  const [payments, setPayments] = useState([]);
  
  // Données calculées
  const [topMembers, setTopMembers] = useState([]);
  const [topHours, setTopHours] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [genderStats, setGenderStats] = useState([]);
  const [paymentStats, setPaymentStats] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Utiliser le service de statistiques du supabaseClient
      const data = await supabaseServices.getStatistics();
      
      setStats(data.stats);
      setMembers(data.members);
      setPresences(data.presences);
      setPayments(data.payments);

      console.log(`✅ Statistiques chargées: ${data.members.length} membres, ${data.presences.length} présences`);
    } catch (err) {
      console.error("❌ Erreur chargement statistiques:", err);
      setError("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (members.length && presences.length) {
      calculateStatistics();
    }
  }, [members, presences, payments]);

  const calculateStatistics = () => {
    // Top membres par présence
    const memberCount = {};
    const hourCount = {};
    const dailyCount = {};
    const monthlyCount = {};

    presences.forEach(p => {
      if (!p.timestamp || !p.badgeId) return;

      const date = new Date(p.timestamp);
      if (isNaN(date)) return;

      const member = members.find(m => m.badgeId === p.badgeId);
      if (!member) return;

      // Comptage par membre
      if (!memberCount[member.badgeId]) {
        memberCount[member.badgeId] = { ...member, count: 0 };
      }
      memberCount[member.badgeId].count += 1;

      // Comptage par heure
      const hour = date.getHours();
      hourCount[hour] = (hourCount[hour] || 0) + 1;

      // Comptage par jour (7 derniers jours)
      const dayKey = date.toLocaleDateString('fr-FR');
      dailyCount[dayKey] = (dailyCount[dayKey] || 0) + 1;

      // Comptage par mois (12 derniers mois)
      const monthKey = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' });
      monthlyCount[monthKey] = (monthlyCount[monthKey] || 0) + 1;
    });

    // Top membres
    setTopMembers(
      Object.values(memberCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    );

    // Top heures
    setTopHours(
      Object.entries(hourCount)
        .map(([hour, count]) => ({ 
          hour: `${hour}h-${(parseInt(hour) + 1)}h`, 
          hourNum: parseInt(hour),
          count 
        }))
        .sort((a, b) => a.hourNum - b.hourNum)
    );

    // Statistiques par jour (7 derniers jours)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toLocaleDateString('fr-FR');
    }).reverse();

    setDailyStats(
      last7Days.map(day => ({
        date: day,
        count: dailyCount[day] || 0
      }))
    );

    // Statistiques mensuelles (6 derniers mois)
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' });
    }).reverse();

    setMonthlyStats(
      last6Months.map(month => ({
        month,
        count: monthlyCount[month] || 0
      }))
    );

    // Statistiques par genre
    const genderCount = { 'Homme': 0, 'Femme': 0, 'Autre': 0 };
    members.forEach(m => {
      if (m.gender === 'Homme') genderCount['Homme']++;
      else if (m.gender === 'Femme') genderCount['Femme']++;
      else genderCount['Autre']++;
    });

    setGenderStats([
      { name: 'Hommes', value: genderCount['Homme'], color: '#3182ce' },
      { name: 'Femmes', value: genderCount['Femme'], color: '#e53e3e' },
      { name: 'Autre', value: genderCount['Autre'], color: '#d69e2e' }
    ].filter(item => item.value > 0));

    // Statistiques de paiements
    const paidAmount = payments.filter(p => p.is_paid).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const unpaidAmount = payments.filter(p => !p.is_paid).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    
    setPaymentStats([
      { name: 'Payé', value: paidAmount, color: '#38a169' },
      { name: 'En attente', value: unpaidAmount, color: '#e53e3e' }
    ]);
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-4 text-lg text-gray-600">Chargement des statistiques...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
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
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-blue-700">
          <FaChartBar className="inline mr-2" />
          Tableau de bord
        </h2>
        <button 
          onClick={fetchAllData}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          disabled={loading}
        >
          Actualiser
        </button>
      </div>

      {/* Cartes de statistiques principales */}
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

      {/* Cartes secondaires */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          icon={<FaGraduationCap className="text-yellow-500 text-3xl" />} 
          label="Étudiants" 
          value={stats?.etudiants || 0}
          subtitle="tarif réduit"
        />
        <StatCard 
          icon={<FaEuroSign className="text-green-600 text-3xl" />} 
          label="Revenus" 
          value={`${paymentStats.reduce((sum, p) => sum + p.value, 0).toFixed(0)}€`}
          subtitle="total des paiements"
        />
        <StatCard 
          icon={<FaMars className="text-blue-600 text-3xl" />} 
          label="Hommes" 
          value={stats?.hommes || 0}
          subtitle={`${((stats?.hommes / stats?.total * 100) || 0).toFixed(0)}%`}
        />
        <StatCard 
          icon={<FaVenus className="text-pink-500 text-3xl" />} 
          label="Femmes" 
          value={stats?.femmes || 0}
          subtitle={`${((stats?.femmes / stats?.total * 100) || 0).toFixed(0)}%`}
        />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Évolution des présences (7 derniers jours) */}
        <Section title="Présences - 7 derniers jours" icon={<FaCalendarAlt />}>
          {dailyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#3182ce" fill="#3182ce" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <NoDataMessage />
          )}
        </Section>

        {/* Répartition par genre */}
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
                  label={({name, value, percent}) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                >
                  {genderStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <NoDataMessage />
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Fréquentation par heure */}
        <Section title="Fréquentation par heure" icon={<FaClock />}>
          {topHours.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topHours}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3182ce" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <NoDataMessage />
          )}
        </Section>

        {/* Évolution mensuelle */}
        <Section title="Évolution mensuelle" icon={<FaChartBar />}>
          {monthlyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3182ce" 
                  strokeWidth={3}
                  dot={{ fill: '#3182ce', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <NoDataMessage />
          )}
        </Section>
      </div>

      {/* Listes détaillées */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 membres */}
        <Section title="Top 10 membres les plus présents" icon={<FaStar />}>
          {topMembers.length > 0 ? (
            <div className="space-y-2">
              {topMembers.map((member, index) => (
                <div key={member.id} className="flex justify-between items-center p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {index === 0 && "🥇"} 
                      {index === 1 && "🥈"} 
                      {index === 2 && "🥉"}
                      {index > 2 && `#${index + 1}`}
                    </span>
                    <div>
                      <div className="font-semibold">{member.firstName} {member.name}</div>
                      <div className="text-sm text-gray-500">Badge: {member.badgeId}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600">{member.count}</div>
                    <div className="text-sm text-gray-500">passages</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <NoDataMessage />
          )}
        </Section>

        {/* Abonnements expirés */}
        <Section 
          title="Abonnements expirés" 
          icon={<FaExclamationTriangle className="text-red-600" />}
          urgent={stats?.membresExpirés?.length > 0}
        >
          {stats?.membresExpirés?.length > 0 ? (
            <div className="space-y-2">
              {stats.membresExpirés.slice(0, 10).map((member) => (
                <div key={member.id} className="flex justify-between items-center p-3 bg-red-50 rounded border-l-4 border-red-400">
                  <div>
                    <div className="font-semibold text-red-800">{member.firstName} {member.name}</div>
                    <div className="text-sm text-red-600">Nécessite un renouvellement</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-red-700">Expiré le</div>
                    <div className="text-sm text-red-600">{new Date(member.endDate).toLocaleDateString('fr-FR')}</div>
                  </div>
                </div>
              ))}
              {stats.membresExpirés.length > 10 && (
                <div className="text-center text-sm text-gray-500 mt-3">
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

function StatCard({ icon, label, value, subtitle, className = "" }) {
  return (
    <div className={`bg-white shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-500 mb-1">{label}</div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
        </div>
        <div className="flex-shrink-0 ml-4">
          {icon}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children, urgent = false }) {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className={`px-6 py-4 border-b ${urgent ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
        <h3 className={`text-lg font-semibold flex items-center gap-2 ${urgent ? 'text-red-800' : 'text-gray-800'}`}>
          {icon} {title}
        </h3>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function NoDataMessage() {
  return (
    <div className="text-center py-8 text-gray-500">
      <FaChartBar className="text-4xl mx-auto mb-2 opacity-50" />
      <p>Aucune donnée disponible</p>
    </div>
  );
}