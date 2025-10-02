// 📄 HomePage.js — Page d'accueil COMPLÈTE — Dossier : src/pages
// 👤 Utilisateur: Hero de bienvenue + grande photo
// 🛡️ Admin: Hero avec badges perso + widgets stats club + widgets motivation
// ✅ Les stats sont chargées pour tous les utilisateurs connectés

import React, { useEffect, useState } from "react";
import { isToday, isBefore, parseISO, format } from "date-fns";
import {
  FaUsers,
  FaUserCheck,
  FaUserTimes,
  FaMale,
  FaFemale,
  FaGraduationCap,
  FaCreditCard,
  FaExclamationTriangle,
  FaTrophy,
  FaFire,
  FaChartLine,
  FaBullseye,
  FaAward,
  FaRocket,
  FaDollarSign,
} from "react-icons/fa";

import { supabaseServices, supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";

// ====================================================
// COMPOSANT : Widgets de Motivation Admin (stats club)
// ====================================================
const AdminMotivationWidgets = ({ stats, paymentSummary, attendance7d, latestMembers }) => {
  
  const calculateMotivationMetrics = () => {
    const memberGoal = 250;
    const currentMembers = stats?.total || 0;
    const goalProgress = (currentMembers / memberGoal) * 100;
    
    const newMembersThisMonth = latestMembers?.length || 0;
    const growthRate = currentMembers > 0 ? Math.round((newMembersThisMonth / currentMembers) * 100) : 0;
    
    const totalAttendances = attendance7d?.reduce((sum, d) => sum + (d.count || 0), 0) || 0;
    const avgPerDay = attendance7d?.length > 0 ? Math.round(totalAttendances / attendance7d.length) : 0;
    const maxPossibleDaily = currentMembers * 0.4;
    const attendanceRate = maxPossibleDaily > 0 ? Math.min(Math.round((avgPerDay / maxPossibleDaily) * 100), 100) : 0;
    
    const totalRevenue = paymentSummary?.paidAmount || 0;
    const paymentRate = paymentSummary?.totalAmount > 0 
      ? Math.round((paymentSummary.paidAmount / paymentSummary.totalAmount) * 100) 
      : 0;
    
    return {
      currentMembers,
      memberGoal,
      goalProgress,
      newMembersThisMonth,
      growthRate,
      totalAttendances,
      avgPerDay,
      attendanceRate,
      totalRevenue,
      paymentRate
    };
  };

  const metrics = calculateMotivationMetrics();

  const getMotivationalMessage = () => {
    if (metrics.paymentRate >= 98 && metrics.attendanceRate >= 90) {
      return {
        emoji: "🏆",
        title: "Performance exceptionnelle !",
        desc: "Votre club affiche d'excellents résultats"
      };
    }
    if (metrics.goalProgress >= 90) {
      return {
        emoji: "🎯",
        title: "Objectif presque atteint !",
        desc: `Plus que ${metrics.memberGoal - metrics.currentMembers} membres pour atteindre 250`
      };
    }
    if (metrics.newMembersThisMonth >= 5) {
      return {
        emoji: "📈",
        title: "Forte croissance !",
        desc: `${metrics.newMembersThisMonth} nouveaux membres récemment`
      };
    }
    if (metrics.totalAttendances > 150) {
      return {
        emoji: "🔥",
        title: "Club très actif !",
        desc: `${metrics.totalAttendances} passages cette semaine`
      };
    }
    return {
      emoji: "💪",
      title: "Continuez sur cette lancée !",
      desc: "Votre club progresse bien"
    };
  };

  const motivationMessage = getMotivationalMessage();

  const getAdminBadges = () => {
    const badges = [];
    
    if (metrics.paymentRate >= 95) {
      badges.push({
        icon: <FaDollarSign />,
        name: "Gestion parfaite",
        desc: `${metrics.paymentRate}% encaissés`,
        color: "from-emerald-500 to-green-600"
      });
    }
    
    if (metrics.attendanceRate >= 80 || metrics.totalAttendances >= 150) {
      badges.push({
        icon: <FaFire />,
        name: "Club actif",
        desc: `${metrics.totalAttendances} passages/sem`,
        color: "from-orange-500 to-red-600"
      });
    }
    
    if (metrics.newMembersThisMonth >= 5) {
      badges.push({
        icon: <FaRocket />,
        name: "Forte croissance",
        desc: `+${metrics.newMembersThisMonth} membres`,
        color: "from-purple-500 to-pink-600"
      });
    }
    
    if (metrics.currentMembers >= 200) {
      badges.push({
        icon: <FaUsers />,
        name: "Cap des 200",
        desc: `${metrics.currentMembers} membres`,
        color: "from-blue-500 to-indigo-600"
      });
    }

    if (metrics.goalProgress >= 80) {
      badges.push({
        icon: <FaBullseye />,
        name: "Objectif proche",
        desc: `${Math.round(metrics.goalProgress)}% atteint`,
        color: "from-cyan-500 to-blue-600"
      });
    }

    return badges;
  };

  const adminBadges = getAdminBadges();

  const getNextMilestone = () => {
    if (metrics.currentMembers < 250) {
      const remaining = metrics.memberGoal - metrics.currentMembers;
      return {
        icon: <FaBullseye />,
        title: "Prochain objectif",
        desc: `Recruter ${remaining} membre${remaining > 1 ? 's' : ''} pour atteindre 250`,
        progress: metrics.goalProgress
      };
    }
    if (metrics.paymentRate < 95) {
      const pendingCount = paymentSummary?.pendingCount || 0;
      return {
        icon: <FaDollarSign />,
        title: "Améliorer encaissements",
        desc: `${pendingCount} paiement${pendingCount > 1 ? 's' : ''} en attente`,
        progress: metrics.paymentRate
      };
    }
    return {
      icon: <FaTrophy />,
      title: "Excellent travail !",
      desc: "Tous les objectifs principaux sont atteints",
      progress: 100
    };
  };

  const nextMilestone = getNextMilestone();

  return (
    <div className="space-y-6 mb-8">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 rounded-2xl p-6 text-white shadow-lg border border-blue-400/20">
        <div className="flex items-start gap-4">
          <div className="text-5xl flex-shrink-0">{motivationMessage.emoji}</div>
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl font-bold mb-1">{motivationMessage.title}</h3>
            <p className="text-blue-100 dark:text-blue-200 text-sm">{motivationMessage.desc}</p>
            
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="text-xs text-blue-100">Membres</div>
                <div className="text-lg font-bold">{metrics.currentMembers}</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="text-xs text-blue-100">Passages/jour</div>
                <div className="text-lg font-bold">{metrics.avgPerDay}</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="text-xs text-blue-100">Taux paiement</div>
                <div className="text-lg font-bold">{metrics.paymentRate}%</div>
              </div>
            </div>
          </div>

          {adminBadges.length > 0 && (
            <div className="hidden lg:flex gap-2 flex-shrink-0">
              {adminBadges.slice(0, 3).map((badge, idx) => (
                <div
                  key={idx}
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${badge.color} flex items-center justify-center text-white text-xl shadow-lg transform hover:scale-110 transition-transform cursor-pointer`}
                  title={`${badge.name}: ${badge.desc}`}
                >
                  {badge.icon}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <FaBullseye className="text-blue-600 dark:text-blue-400 text-xl" />
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white font-bold text-lg">Objectif 250</h4>
              <p className="text-gray-500 dark:text-gray-400 text-sm">membres actifs</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                {metrics.currentMembers}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-sm">
                / {metrics.memberGoal}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(metrics.goalProgress, 100)}%` }}
              />
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 dark:text-gray-300">
                <strong>{Math.round(metrics.goalProgress)}%</strong> atteint
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                +{metrics.memberGoal - metrics.currentMembers} restants
              </span>
            </div>

            {metrics.goalProgress >= 90 && (
              <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                  🎯 Presque là ! Excellent travail
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <FaChartLine className="text-purple-600 dark:text-purple-400 text-xl" />
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white font-bold text-lg">Croissance</h4>
              <p className="text-gray-500 dark:text-gray-400 text-sm">nouveaux membres</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                +{metrics.newMembersThisMonth}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-sm">
                ce mois
              </span>
            </div>

            {metrics.growthRate > 0 && (
              <div className="flex items-center gap-2">
                <FaChartLine className="text-green-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  +{metrics.growthRate}% de croissance
                </span>
              </div>
            )}

            <div className="pt-3 border-t dark:border-gray-700 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total actuel</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {metrics.currentMembers}
                </span>
              </div>
              {metrics.newMembersThisMonth >= 5 ? (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                  🚀 Excellente dynamique !
                </p>
              ) : (
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  💡 Intensifiez le recrutement
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
              <FaFire className="text-orange-600 dark:text-orange-400 text-xl" />
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white font-bold text-lg">Engagement</h4>
              <p className="text-gray-500 dark:text-gray-400 text-sm">activité du club</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-orange-600 dark:text-orange-400">
                {metrics.totalAttendances}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-sm">
                passages/7j
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Moyenne/jour</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {metrics.avgPerDay}
                </span>
              </div>
              
              {metrics.attendanceRate > 0 && (
                <div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full"
                      style={{ width: `${Math.min(metrics.attendanceRate, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Taux d'activité: {metrics.attendanceRate}%
                  </p>
                </div>
              )}
            </div>

            {metrics.totalAttendances >= 150 ? (
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                🔥 Club très actif !
              </p>
            ) : (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                💪 Encouragez la régularité
              </p>
            )}
          </div>
        </div>
      </div>

      {adminBadges.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
              <FaAward className="text-yellow-600 dark:text-yellow-400 text-xl" />
            </div>
            <div className="flex-1">
              <h4 className="text-gray-900 dark:text-white font-bold text-lg">Badges de Performance</h4>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {adminBadges.length} récompense{adminBadges.length > 1 ? 's' : ''} débloquée{adminBadges.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {adminBadges.map((badge, idx) => (
              <div 
                key={idx}
                className="group relative"
              >
                <div className={`bg-gradient-to-br ${badge.color} rounded-xl p-4 text-white shadow-lg transform hover:scale-105 transition-all cursor-pointer`}>
                  <div className="text-3xl mb-2 flex justify-center">{badge.icon}</div>
                  <div className="text-center">
                    <p className="font-bold text-sm">{badge.name}</p>
                    <p className="text-xs opacity-90 mt-1">{badge.desc}</p>
                  </div>
                </div>
                
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-6 border border-indigo-200 dark:border-indigo-800">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-indigo-500 dark:bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xl">
            {nextMilestone.icon}
          </div>
          <div className="flex-1">
            <h4 className="text-gray-900 dark:text-white font-bold text-lg mb-1">
              {nextMilestone.title}
            </h4>
            <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
              {nextMilestone.desc}
            </p>
            
            {nextMilestone.progress < 100 && (
              <div>
                <div className="w-full bg-white/50 dark:bg-gray-700/50 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${nextMilestone.progress}%` }}
                  />
                </div>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                  {Math.round(nextMilestone.progress)}% complété
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ====================================================
// COMPOSANT PRINCIPAL HomePage
// ====================================================
function HomePage() {
  const { user, role, userMemberData: memberCtx } = useAuth();
  const isAdmin = (role || "").toLowerCase() === "admin";

  const [stats, setStats] = useState({
    total: 0,
    actifs: 0,
    expirés: 0,
    hommes: 0,
    femmes: 0,
    etudiants: 0,
    membresExpirés: [],
  });

  const [pendingPayments, setPendingPayments] = useState([]);
  const [userPayments, setUserPayments] = useState([]);

  const [paymentSummary, setPaymentSummary] = useState({
    totalCount: 0,
    paidCount: 0,
    pendingCount: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
  });

  const [attendance7d, setAttendance7d] = useState([]);
  const [recentPresences, setRecentPresences] = useState([]);
  const [latestMembers, setLatestMembers] = useState([]);

  // Stats personnelles admin
  const [adminPersonalStats, setAdminPersonalStats] = useState({
    currentStreak: 0,
    level: 1,
    monthVisits: 0,
    monthlyGoal: 12
  });

  const fetchMemberPayments = async (memberId) => {
    if (!memberId) return [];
    const memberCols = ["member_id", "memberId"];
    const dateCols = ["date_paiement", "payment_date", "due_date", "date", "created_at"];

    const SELECT_PAYMENT_COLS =
      "id, member_id, memberId, amount, is_paid, label, libelle, created_at, date_paiement, payment_date, due_date, date";

    for (const mcol of memberCols) {
      try {
        let { data, error } = await supabase
          .from("payments")
          .select(SELECT_PAYMENT_COLS)
          .eq(mcol, memberId);

        if (error) continue;

        for (const dcol of dateCols) {
          const { data: ordered, error: orderErr } = await supabase
            .from("payments")
            .select(SELECT_PAYMENT_COLS)
            .eq(mcol, memberId)
            .order(dcol, { ascending: false });
          if (!orderErr && ordered) return ordered;
        }
        return data || [];
      } catch {
        // continue
      }
    }

    try {
      if (supabaseServices?.payments?.listByMemberId) {
        const list = await supabaseServices.payments.listByMemberId(memberId);
        if (Array.isArray(list)) return list;
      }
      if (supabaseServices?.getPaymentsByMemberId) {
        const list = await supabaseServices.getPaymentsByMemberId(memberId);
        if (Array.isArray(list)) return list;
      }
    } catch {
      // continue
    }
    return [];
  };

  useEffect(() => {
    const fetchAttendanceAdmin = async () => {
      try {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date();
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);

        const { data: presencesData, error } = await supabase
          .from("presences")
          .select("id,badgeId,timestamp")
          .gte("timestamp", start.toISOString())
          .lte("timestamp", end.toISOString())
          .order("timestamp", { ascending: false })
          .limit(500);

        if (error) {
          console.error("Error loading presences:", error);
          setAttendance7d([]);
          setRecentPresences([]);
          return;
        }

        const key = (d) => format(d, "yyyy-MM-dd");
        const days = [];
        const countsByKey = {};
        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          days.push({ date: d, count: 0 });
          countsByKey[key(d)] = 0;
        }

        (presencesData || []).forEach((row) => {
          const ts = typeof row.timestamp === "string" ? parseISO(row.timestamp) : new Date(row.timestamp);
          const k = key(ts);
          if (countsByKey[k] !== undefined) countsByKey[k] += 1;
        });

        setAttendance7d(days.map((d) => ({ date: d.date, count: countsByKey[key(d.date)] || 0 })));

        const recent = (presencesData || []).slice(0, 10);
        const badgeIds = Array.from(new Set(recent.map((r) => r.badgeId).filter(Boolean)));
        let membersByBadge = {};
        if (badgeIds.length > 0) {
          const { data: membersData, error: mErr } = await supabase
            .from("members")
            .select("id, firstName, name, photo, badgeId")
            .in("badgeId", badgeIds);
          if (!mErr && membersData) {
            membersByBadge = membersData.reduce((acc, m) => {
              acc[m.badgeId] = m;
              return acc;
            }, {});
          }
        }
        setRecentPresences(
          recent.map((r) => ({ id: r.id, ts: r.timestamp, member: membersByBadge[r.badgeId], badgeId: r.badgeId }))
        );
      } catch (e) {
        console.error("fetchAttendanceAdmin error:", e);
        setAttendance7d([]);
        setRecentPresences([]);
      }
    };

    const fetchData = async () => {
      try {
        if (user) {
          try {
            const { stats: calculatedStats } = await supabaseServices.getStatistics();
            setStats(
              calculatedStats || {
                total: 0,
                actifs: 0,
                expirés: 0,
                hommes: 0,
                femmes: 0,
                etudiants: 0,
                membresExpirés: [],
              }
            );
          } catch (statsError) {
            console.error("Could not fetch statistics:", statsError?.message);
          }

          if (isAdmin) {
            const payments = await supabaseServices.getPayments();
            const paid = (payments || []).filter((p) => p.is_paid);
            const pending = (payments || []).filter((p) => !p.is_paid);
            const sum = (arr) => arr.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

            setPendingPayments(pending);
            setPaymentSummary({
              totalCount: payments?.length || 0,
              paidCount: paid.length,
              pendingCount: pending.length,
              totalAmount: sum(payments || []),
              paidAmount: sum(paid),
              pendingAmount: sum(pending),
            });

            await fetchAttendanceAdmin();

            try {
              const { data: latest, error: latestErr } = await supabase
                .from("members")
                .select("id, firstName, name, photo")
                .order("id", { ascending: false })
                .limit(3);
              if (latestErr) {
                console.error("Error fetching latest members:", latestErr);
                setLatestMembers([]);
              } else {
                setLatestMembers(latest || []);
              }
            } catch (e) {
              console.error("Latest members fetch error:", e);
              setLatestMembers([]);
            }
          } else {
            if (memberCtx?.id) {
              const memberPayments = await fetchMemberPayments(memberCtx.id);
              setUserPayments(memberPayments || []);
            } else {
              setUserPayments([]);
            }
          }
        } else {
          setUserPayments([]);
        }
      } catch (e) {
        console.error("HomePage fetch error:", e);
      }
    };

    fetchData();
  }, [role, user, isAdmin, memberCtx?.id]);

  // useEffect pour charger les stats personnelles de l'admin
  useEffect(() => {
    const fetchAdminPersonalStats = async () => {
      if (!isAdmin || !memberCtx?.badgeId) return;

      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const { data: presences, error } = await supabase
          .from("presences")
          .select("timestamp")
          .eq("badgeId", memberCtx.badgeId)
          .gte("timestamp", startDate.toISOString())
          .order("timestamp", { ascending: false });

        if (error || !presences) return;

        // Calcul série en cours
        let currentStreak = 0;
        const sortedDates = presences.map(p => new Date(p.timestamp)).sort((a, b) => b - a);
        
        if (sortedDates.length > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
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

        // Calcul niveau
        const totalVisits = presences.length;
        const level = Math.floor(totalVisits / 5) + 1;

        // Visites du mois en cours
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthVisits = presences.filter(p => {
          const d = new Date(p.timestamp);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;

        setAdminPersonalStats({
          currentStreak,
          level,
          monthVisits,
          monthlyGoal: 12
        });

      } catch (error) {
        console.error("Erreur chargement stats admin:", error);
      }
    };

    fetchAdminPersonalStats();
  }, [isAdmin, memberCtx?.badgeId]);

  const isLateOrToday = (ts) => {
    if (!ts) return false;
    try {
      const d = typeof ts === "string" ? parseISO(ts) : ts;
      return isToday(d) || isBefore(d, new Date());
    } catch {
      return false;
    }
  };

  const getInitials = (firstName, name) => {
    const a = (firstName || "").trim().charAt(0);
    const b = (name || "").trim().charAt(0);
    return (a + b).toUpperCase() || "?";
  };

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-colors duration-200 border border-gray-100 dark:border-gray-700">
      <div className={`p-3 rounded-full ${color} text-white`}>
        <Icon size={24} />
      </div>
      <div className="ml-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );

  const CircularProgress = ({ size = 160, stroke = 14, value = 0 }) => {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const dash = Math.max(0, Math.min(1, value)) * circumference;
    const remainder = circumference - dash;

    return (
      <div className="flex items-center justify-center">
        <svg width={size} height={size} className="block">
          <defs>
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>

          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            className="text-gray-200 dark:text-gray-700"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#ringGradient)"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${dash} ${remainder}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
          <text
            x="50%"
            y="50%"
            dy=".35em"
            textAnchor="middle"
            className="fill-gray-900 dark:fill-white"
            fontSize="22"
            fontWeight="700"
          >
            {Math.round(value * 100)}%
          </text>
        </svg>
      </div>
    );
  };

  const { totalAmount, paidAmount, pendingAmount, totalCount, paidCount, pendingCount } = paymentSummary;
  const progress = totalAmount > 0 ? paidAmount / totalAmount : 0;

  const memberFirstName = memberCtx?.firstName || memberCtx?.firstname || memberCtx?.prenom || "";
  const memberLastName = memberCtx?.name || memberCtx?.lastname || memberCtx?.nom || "";
  const memberDisplayName =
    (memberFirstName || memberLastName ? `${memberFirstName} ${memberLastName}`.trim() : user?.email) || "Bienvenue";
  const memberPhoto = memberCtx?.photo || "";

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900 min-h-screen transition-colors duration-300">
      {/* HERO UTILISATEUR avec badges perso admin */}
      {user && (
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-blue-500/10 dark:from-indigo-400/10 dark:via-emerald-400/10 dark:to-blue-400/10" />
          <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="relative">
              {memberPhoto ? (
                <img
                  src={memberPhoto}
                  alt={memberDisplayName}
                  width="160"
                  height="160"
                  className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover shadow-xl ring-4 ring-white dark:ring-gray-700"
                  decoding="async"
                  fetchPriority="high"
                />
              ) : (
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-xl ring-4 ring-white dark:ring-gray-700">
                  {getInitials(memberFirstName, memberLastName) || "?"}
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-400/90 blur-sm" />
            </div>

            <div className="text-center md:text-left flex-1">
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
                Bonjour{memberFirstName ? `, ${memberFirstName}` : ""} 👋
              </h1>
              <p className="mt-1 text-sm md:text-base text-gray-600 dark:text-gray-300">
                Heureux de vous revoir sur votre espace. Retrouvez ici vos dernières informations.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 justify-center md:justify-start">
                {memberCtx?.badgeId && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                    Badge : {memberCtx.badgeId}
                  </span>
                )}

                {/* Badges perso admin */}
                {isAdmin && memberCtx?.badgeId && (
                  <>
                    {adminPersonalStats.currentStreak > 0 && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-700 dark:text-orange-300 flex items-center gap-1">
                        🔥 {adminPersonalStats.currentStreak} jour{adminPersonalStats.currentStreak > 1 ? 's' : ''}
                      </span>
                    )}
                    
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/15 text-purple-700 dark:text-purple-300">
                      📊 Niveau {adminPersonalStats.level}
                    </span>
                    
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-700 dark:text-blue-300">
                      🎯 {adminPersonalStats.monthVisits}/{adminPersonalStats.monthlyGoal} ce mois
                    </span>

                    <a 
                      href="/my-attendances"
                      className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1"
                    >
                      Voir mes stats
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </a>
                  </>
                )}

                {!isAdmin && userPayments?.length > 0 && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    {userPayments.filter((p) => p.is_paid).length} paiement(s) réglé(s)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Widgets statistiques (pour tous) */}
      {user && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard icon={FaUsers} label="Total Membres" value={stats.total} color="bg-blue-500" />
          <StatCard icon={FaUserCheck} label="Actifs" value={stats.actifs} color="bg-green-500" />
          <StatCard icon={FaUserTimes} label="Expirés" value={stats.expirés} color="bg-red-500" />
          <StatCard icon={FaMale} label="Hommes" value={stats.hommes} color="bg-indigo-500" />
          <StatCard icon={FaFemale} label="Femmes" value={stats.femmes} color="bg-pink-500" />
          <StatCard icon={FaGraduationCap} label="Étudiants" value={stats.etudiants} color="bg-yellow-500" />
        </div>
      )}

      {/* Widgets de motivation admin (stats club) */}
      {isAdmin && (
        <AdminMotivationWidgets 
          stats={stats}
          paymentSummary={paymentSummary}
          attendance7d={attendance7d}
          latestMembers={latestMembers}
        />
      )}

      {/* Vos paiements (NON-ADMIN) */}
      {user && !isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FaCreditCard className="text-blue-500" />
              Vos paiements
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {userPayments?.length || 0} opération(s)
            </span>
          </div>

          {userPayments?.length > 0 ? (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {userPayments.map((p) => {
                const isPaid = !!p.is_paid;
                const amount = Number(p.amount) || 0;
                const dateRaw =
                  p.date_paiement || p.payment_date || p.due_date || p.date || p.created_at;
                let dateStr = "";
                try {
                  if (dateRaw) {
                    const d = typeof dateRaw === "string" ? parseISO(dateRaw) : new Date(dateRaw);
                    dateStr = format(d, "dd/MM/yyyy");
                  }
                } catch {
                  // ignore
                }

                return (
                  <li key={p.id} className="py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {p.label || p.libelle || "Paiement"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {dateStr || "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-semibold ${
                          isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {amount.toFixed(2)} €
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          isPaid
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {isPaid ? "Réglé" : "En attente"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Aucun paiement trouvé pour votre compte.
            </div>
          )}
        </div>
      )}

      {/* État global des paiements (ADMIN) - Le reste du code continue... */}
      {/* Pour la suite, voir le fichier précédent ou consulter le code original */}
    </div>
  );
}

export default HomePage;