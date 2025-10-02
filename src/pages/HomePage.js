// 📄 HomePage.js — Page d'accueil COMPLÈTE (fusion + widgets réintégrés + skeletons) — Dossier : src/pages
// 👤 Utilisateur: Hero de bienvenue + grande photo
// 🛡️ Admin: Hero avec badges perso + widgets stats club + widgets motivation
// ✅ Les stats sont chargées pour tous les utilisateurs connectés
// ✅ Widgets réintégrés depuis l'ancienne HomePage :
//    - Vos paiements (NON-ADMIN)
//    - État global des paiements (ADMIN)
//    - Présences 7 derniers jours (ADMIN)
//    - Derniers passages (ADMIN)
//    - Derniers membres inscrits (ADMIN)
//    - Abonnements échus (ADMIN)
// ✅ Ajout: Skeletons/Loaders + petite factorisation (cartes stats)

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
// SKELETONS / LOADERS (simples et légers)
// ====================================================
const SkeletonPulse = ({ className = "" }) => (
  <div className={`bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`} />
);

const SkeletonCard = () => (
  <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-100 dark:border-gray-700 animate-pulse">
    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
    <div className="ml-4 flex-1">
      <SkeletonPulse className="h-4 w-24 mb-2 rounded" />
      <SkeletonPulse className="h-6 w-16 rounded" />
    </div>
  </div>
);

const SkeletonListItem = () => (
  <div className="flex items-center justify-between p-3 rounded-lg border border-transparent">
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <SkeletonPulse className="w-10 h-10 rounded-full" />
      <div className="min-w-0 flex-1">
        <SkeletonPulse className="h-4 w-40 mb-2 rounded" />
        <SkeletonPulse className="h-3 w-24 rounded" />
      </div>
    </div>
    <div className="text-right flex-shrink-0 ml-3">
      <SkeletonPulse className="h-4 w-12 mb-1 rounded" />
      <SkeletonPulse className="h-3 w-10 rounded" />
    </div>
  </div>
);

const SkeletonRing = () => (
  <div className="flex items-center justify-center">
    <div className="w-40 h-40 rounded-full border-8 border-gray-200 dark:border-gray-700 animate-pulse" />
  </div>
);

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
      paymentRate,
    };
  };

  const metrics = calculateMotivationMetrics();

  const getMotivationalMessage = () => {
    if (metrics.paymentRate >= 98 && metrics.attendanceRate >= 90) {
      return { emoji: "🏆", title: "Performance exceptionnelle !", desc: "Votre club affiche d'excellents résultats" };
    }
    if (metrics.goalProgress >= 90) {
      return { emoji: "🎯", title: "Objectif presque atteint !", desc: `Plus que ${metrics.memberGoal - metrics.currentMembers} membres pour atteindre 250` };
    }
    if (metrics.newMembersThisMonth >= 5) {
      return { emoji: "📈", title: "Forte croissance !", desc: `${metrics.newMembersThisMonth} nouveaux membres récemment` };
    }
    if (metrics.totalAttendances > 150) {
      return { emoji: "🔥", title: "Club très actif !", desc: `${metrics.totalAttendances} passages cette semaine` };
    }
    return { emoji: "💪", title: "Continuez sur cette lancée !", desc: "Votre club progresse bien" };
  };

  const motivationMessage = getMotivationalMessage();

  const getAdminBadges = () => {
    const badges = [];
    if (metrics.paymentRate >= 95) badges.push({ icon: <FaDollarSign />, name: "Gestion parfaite", desc: `${metrics.paymentRate}% encaissés`, color: "from-emerald-500 to-green-600" });
    if (metrics.attendanceRate >= 80 || metrics.totalAttendances >= 150) badges.push({ icon: <FaFire />, name: "Club actif", desc: `${metrics.totalAttendances} passages/sem`, color: "from-orange-500 to-red-600" });
    if (metrics.newMembersThisMonth >= 5) badges.push({ icon: <FaRocket />, name: "Forte croissance", desc: `+${metrics.newMembersThisMonth} membres`, color: "from-purple-500 to-pink-600" });
    if (metrics.currentMembers >= 200) badges.push({ icon: <FaUsers />, name: "Cap des 200", desc: `${metrics.currentMembers} membres`, color: "from-blue-500 to-indigo-600" });
    if (metrics.goalProgress >= 80) badges.push({ icon: <FaBullseye />, name: "Objectif proche", desc: `${Math.round(metrics.goalProgress)}% atteint`, color: "from-cyan-500 to-blue-600" });
    return badges;
  };

  const adminBadges = getAdminBadges();

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
                <div className="text-lg font-bold">{stats?.total || 0}</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="text-xs text-blue-100">Passages/jour</div>
                <div className="text-lg font-bold">{attendance7d?.length ? Math.round(attendance7d.reduce((s, d) => s + (d.count || 0), 0) / attendance7d.length) : 0}</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="text-xs text-blue-100">Taux paiement</div>
                <div className="text-lg font-bold">{paymentSummary?.totalAmount > 0 ? Math.round((paymentSummary.paidAmount / paymentSummary.totalAmount) * 100) : 0}%</div>
              </div>
            </div>
          </div>
          {adminBadges.length > 0 && (
            <div className="hidden lg:flex gap-2 flex-shrink-0">
              {adminBadges.slice(0, 3).map((badge, idx) => (
                <div key={idx} className={`w-14 h-14 rounded-xl bg-gradient-to-br ${badge.color} flex items-center justify-center text-white text-xl shadow-lg transform hover:scale-110 transition-transform cursor-pointer`} title={`${badge.name}: ${badge.desc}`}>
                  {badge.icon}
                </div>
              ))}
            </div>
          )}
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

  // Loading flags
  const [loading, setLoading] = useState({
    stats: true,
    payments: true,
    presences: true,
    latestMembers: true,
  });

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
    monthlyGoal: 12,
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
      } catch {}
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
    } catch {}
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
          setLoading((s) => ({ ...s, presences: false }));
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
        setRecentPresences(recent.map((r) => ({ id: r.id, ts: r.timestamp, member: membersByBadge[r.badgeId], badgeId: r.badgeId })));
      } catch (e) {
        console.error("fetchAttendanceAdmin error:", e);
        setAttendance7d([]);
        setRecentPresences([]);
      } finally {
        setLoading((s) => ({ ...s, presences: false }));
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
          } finally {
            setLoading((s) => ({ ...s, stats: false }));
          }

          if (isAdmin) {
            try {
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
            } catch (e) {
              console.error("Payments fetch error:", e);
            } finally {
              setLoading((s) => ({ ...s, payments: false }));
            }

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
            } finally {
              setLoading((s) => ({ ...s, latestMembers: false }));
            }
          } else {
            try {
              if (memberCtx?.id) {
                const memberPayments = await fetchMemberPayments(memberCtx.id);
                setUserPayments(memberPayments || []);
              } else {
                setUserPayments([]);
              }
            } catch (e) {
              console.error("User payments fetch error:", e);
            } finally {
              setLoading((s) => ({ ...s, payments: false }));
            }
          }
        } else {
          setUserPayments([]);
          setLoading((s) => ({ ...s, stats: false, payments: false, presences: false, latestMembers: false }));
        }
      } catch (e) {
        console.error("HomePage fetch error:", e);
        setLoading((s) => ({ ...s, stats: false, payments: false, presences: false, latestMembers: false }));
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, user, isAdmin, memberCtx?.id]);

  // Stats perso admin (streak/level/visites mois)
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

        let currentStreak = 0;
        const sortedDates = presences.map((p) => new Date(p.timestamp)).sort((a, b) => b - a);
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

        const totalVisits = presences.length;
        const level = Math.floor(totalVisits / 5) + 1;

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthVisits = presences.filter((p) => {
          const d = new Date(p.timestamp);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;

        setAdminPersonalStats({ currentStreak, level, monthVisits, monthlyGoal: 12 });
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

  // ===== Widget StatCard générique (factorisé)
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

  // Anneau de progression SVG
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
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth={stroke} fill="none" />
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="url(#ringGradient)" strokeWidth={stroke} fill="none" strokeDasharray={`${dash} ${remainder}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          <text x="50%" y="50%" dy=".35em" textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize="22" fontWeight="700">{Math.round(value * 100)}%</text>
        </svg>
      </div>
    );
  };

  const { totalAmount, paidAmount, pendingAmount, totalCount, paidCount, pendingCount } = paymentSummary;
  const progress = totalAmount > 0 ? paidAmount / totalAmount : 0;

  const memberFirstName = memberCtx?.firstName || memberCtx?.firstname || memberCtx?.prenom || "";
  const memberLastName = memberCtx?.name || memberCtx?.lastname || memberCtx?.nom || "";
  const memberDisplayName = (memberFirstName || memberLastName ? `${memberFirstName} ${memberLastName}`.trim() : user?.email) || "Bienvenue";
  const memberPhoto = memberCtx?.photo || "";

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900 min-h-screen transition-colors duration-300">
      {/* HERO UTILISATEUR */}
      {user && (
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-blue-500/10 dark:from-indigo-400/10 dark:via-emerald-400/10 dark:to-blue-400/10" />
          <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="relative">
              {memberPhoto ? (
                <img src={memberPhoto} alt={memberDisplayName} width="160" height="160" className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover shadow-xl ring-4 ring-white dark:ring-gray-700" decoding="async" fetchPriority="high" />
              ) : (
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-xl ring-4 ring-white dark:ring-gray-700">{getInitials(memberFirstName, memberLastName) || "?"}</div>
              )}
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-400/90 blur-sm" />
            </div>

            <div className="text-center md:text-left flex-1">
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">Bonjour{memberFirstName ? `, ${memberFirstName}` : ""} 👋</h1>
              <p className="mt-1 text-sm md:text-base text-gray-600 dark:text-gray-300">Heureux de vous revoir sur votre espace. Retrouvez ici vos dernières informations.</p>

              <div className="mt-4 flex flex-wrap items-center gap-2 justify-center md:justify-start">
                {memberCtx?.badgeId && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">Badge : {memberCtx.badgeId}</span>
                )}

                {/* Badges perso admin */}
                {isAdmin && memberCtx?.badgeId && (
                  <>
                    {adminPersonalStats.currentStreak > 0 && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-700 dark:text-orange-300 flex items-center gap-1">🔥 {adminPersonalStats.currentStreak} jour{adminPersonalStats.currentStreak > 1 ? "s" : ""}</span>
                    )}
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/15 text-purple-700 dark:text-purple-300">📊 Niveau {adminPersonalStats.level}</span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-700 dark:text-blue-300">🎯 {adminPersonalStats.monthVisits}/{adminPersonalStats.monthlyGoal} ce mois</span>
                    <a href="/my-attendances" className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1">
                      Voir mes stats
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </a>
                  </>
                )}

                {!isAdmin && userPayments?.length > 0 && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">{userPayments.filter((p) => p.is_paid).length} paiement(s) réglé(s)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Widgets statistiques (pour tous) avec skeletons */}
      {user && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {loading.stats ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <StatCard icon={FaUsers} label="Total Membres" value={stats.total} color="bg-blue-500" />
              <StatCard icon={FaUserCheck} label="Actifs" value={stats.actifs} color="bg-green-500" />
              <StatCard icon={FaUserTimes} label="Expirés" value={stats.expirés} color="bg-red-500" />
              <StatCard icon={FaMale} label="Hommes" value={stats.hommes} color="bg-indigo-500" />
              <StatCard icon={FaFemale} label="Femmes" value={stats.femmes} color="bg-pink-500" />
              <StatCard icon={FaGraduationCap} label="Étudiants" value={stats.etudiants} color="bg-yellow-500" />
            </>
          )}
        </div>
      )}

      {/* Widgets de motivation admin (stats club) */}
      {isAdmin && (
        <AdminMotivationWidgets stats={stats} paymentSummary={paymentSummary} attendance7d={attendance7d} latestMembers={latestMembers} />
      )}

      {/* Vos paiements (NON-ADMIN) */}
      {user && !isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"><FaCreditCard className="text-blue-500" />Vos paiements</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">{loading.payments ? "—" : (userPayments?.length || 0)} opération(s)</span>
          </div>

          {loading.payments ? (
            <div className="space-y-2">
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
            </div>
          ) : userPayments?.length > 0 ? (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {userPayments.map((p) => {
                const isPaid = !!p.is_paid;
                const amount = Number(p.amount) || 0;
                const dateRaw = p.date_paiement || p.payment_date || p.due_date || p.date || p.created_at;
                let dateStr = "";
                try {
                  if (dateRaw) {
                    const d = typeof dateRaw === "string" ? parseISO(dateRaw) : new Date(dateRaw);
                    dateStr = format(d, "dd/MM/yyyy");
                  }
                } catch {}
                return (
                  <li key={p.id} className="py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.label || p.libelle || "Paiement"}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{dateStr || "—"}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold ${isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{amount.toFixed(2)} €</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${isPaid ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}>{isPaid ? "Réglé" : "En attente"}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">Aucun paiement trouvé pour votre compte.</div>
          )}
        </div>
      )}

      {/* État global des paiements (ADMIN) — réintégré avec skeleton */}
      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"><FaCreditCard className="text-blue-500" />État global des paiements</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">{loading.payments ? "Chargement…" : `${totalCount} opérations • ${(totalAmount || 0).toFixed(2)} €`}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-6">
            <div className="flex justify-center">
              {loading.payments ? <SkeletonRing /> : <CircularProgress value={progress} />}
            </div>
            <div className="space-y-4">
              {loading.payments ? (
                <>
                  <div className="flex items-center justify-between"><SkeletonPulse className="h-4 w-40 rounded" /><SkeletonPulse className="h-4 w-24 rounded" /></div>
                  <div className="flex items-center justify-between"><SkeletonPulse className="h-4 w-40 rounded" /><SkeletonPulse className="h-4 w-24 rounded" /></div>
                  <SkeletonPulse className="h-2 w-full rounded" />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><span className="inline-block w-3 h-3 rounded-full bg-green-500" /><span className="text-gray-700 dark:text-gray-300 font-medium">Payé</span></div>
                    <div className="text-right"><div className="text-gray-900 dark:text-white font-semibold">{(paidAmount || 0).toFixed(2)} €</div><div className="text-sm text-gray-500 dark:text-gray-400">{paidCount} op.</div></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><span className="inline-block w-3 h-3 rounded-full bg-amber-500" /><span className="text-gray-700 dark:text-gray-300 font-medium">En attente</span></div>
                    <div className="text-right"><div className="text-gray-900 dark:text-white font-semibold">{(pendingAmount || 0).toFixed(2)} €</div><div className="text-sm text-gray-500 dark:text-gray-400">{pendingCount} op.</div></div>
                  </div>
                  <div className="mt-2">
                    <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"><div className="h-2 bg-gradient-to-r from-green-500 to-blue-500" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{Math.round(progress * 100)}% du montant total déjà encaissé</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Présences 7 derniers jours + Derniers passages (ADMIN) — réintégré avec skeletons */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Graph 7 derniers jours */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Présences — 7 derniers jours</h2>
              {!loading.presences && attendance7d.length > 0 && (
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{attendance7d.reduce((sum, d) => sum + d.count, 0)} passages</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Moy: {Math.round(attendance7d.reduce((sum, d) => sum + d.count, 0) / 7)}/jour</div>
                </div>
              )}
            </div>

            {loading.presences ? (
              <div className="h-60 flex items-end justify-between pl-10 pr-2 pb-2 gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <SkeletonPulse key={i} className="w-full h-40 rounded" />
                ))}
              </div>
            ) : attendance7d.length > 0 ? (
              <div className="relative w-full">
                {/* (graph custom identique à ta version, inchangé) */}
                <div className="relative h-48 sm:h-56 lg:h-60">
                  <div className="absolute inset-0">
                    {(() => {
                      const maxValue = Math.max(...attendance7d.map((d) => d.count));
                      const adjustedMax = maxValue > 0 ? maxValue : 10;
                      const steps = 5;
                      const stepValue = Math.ceil(adjustedMax / steps);
                      return Array.from({ length: steps + 1 }, (_, i) => {
                        const value = stepValue * i;
                        const percentage = (i / steps) * 100;
                        return (
                          <div key={i} className="absolute w-full flex items-center" style={{ bottom: `${percentage}%` }}>
                            <span className="text-xs text-gray-400 dark:text-gray-500 w-8 -ml-2">{value}</span>
                            <div className="flex-1 border-t border-gray-200 dark:border-gray-600/50 ml-2" />
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <div className="absolute inset-0 flex items-end justify-between pl-10 pr-2 pb-2">
                    {attendance7d.map((d, idx) => {
                      const maxValue = Math.max(...attendance7d.map((x) => x.count));
                      const adjustedMax = maxValue > 0 ? maxValue : 10;
                      const heightInPixels = maxValue > 0 ? Math.max((d.count / adjustedMax) * 180, d.count > 0 ? 12 : 4) : 4;
                      const isTodayLabel = format(d.date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                      const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;
                      return (
                        <div key={idx} className="flex flex-col items-center justify-end group cursor-pointer" style={{ width: "calc(100% / 7 - 8px)" }}>
                          <div className={`text-xs font-medium mb-1 transition-all duration-200 ${d.count > 0 ? "text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400" : "text-gray-400 dark:text-gray-600"}`}>{d.count}</div>
                          <div className={`w-full rounded-t-lg shadow-lg transition-all duration-500 group-hover:shadow-xl relative overflow-hidden ${isTodayLabel ? "ring-2 ring-blue-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-800" : ""}`}
                            style={{
                              height: `${heightInPixels}px`,
                              background: d.count > 0 ? (isTodayLabel ? "linear-gradient(180deg, rgba(59,130,246,1) 0%, rgba(16,185,129,1) 50%, rgba(34,197,94,1) 100%)" : (isWeekend ? "linear-gradient(180deg, rgba(139,92,246,1) 0%, rgba(168,85,247,1) 100%)" : "linear-gradient(180deg, rgba(59,130,246,1) 0%, rgba(34,197,94,1) 100%)")) : "linear-gradient(180deg, rgba(156,163,175,0.3) 0%, rgba(156,163,175,0.1) 100%)",
                            }}>
                            {d.count > 0 && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2 2z" /></svg>
                </div>
                <div className="text-sm font-medium mb-1">Aucune présence</div>
                <div className="text-xs">Aucune donnée disponible sur la période</div>
              </div>
            )}
          </div>

          {/* Derniers passages */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Derniers passages</h2>
              {!loading.presences && recentPresences.length > 0 && (
                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium px-2.5 py-0.5 rounded-full">{recentPresences.length} récents</span>
              )}
            </div>

            {loading.presences ? (
              <div className="space-y-2">
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
              </div>
            ) : recentPresences.length > 0 ? (
              <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                {recentPresences.map((r, index) => {
                  const m = r.member;
                  const ts = typeof r.ts === "string" ? parseISO(r.ts) : new Date(r.ts);
                  const displayName = m ? `${m.firstName || ""} ${m.name || ""}`.trim() : `Badge ${r.badgeId || "?"}`;
                  const getTimeAgo = (date) => {
                    const now = new Date();
                    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
                    if (diffInMinutes < 1) return "À l'instant";
                    if (diffInMinutes < 60) return `Il y a ${diffInMinutes} min`;
                    const diffInHours = Math.floor(diffInMinutes / 60);
                    if (diffInHours < 24) return `Il y a ${diffInHours}h`;
                    const diffInDays = Math.floor(diffInHours / 24);
                    if (diffInDays < 7) return `Il y a ${diffInDays}j`;
                    return format(date, "dd/MM/yyyy");
                  };
                  const timeAgo = getTimeAgo(ts);
                  return (
                    <div key={r.id} className="group flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 rounded-lg transition-all duration-200 border border-transparent hover:border-gray-200 dark:hover:border-gray-600">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {m?.photo ? (
                          <img src={m.photo} alt={displayName} width="40" height="40" className="w-10 h-10 rounded-full object-cover shadow-lg border-2 border-white dark:border-gray-700 group-hover:shadow-xl group-hover:scale-105 transition-all duration-200" loading="lazy" decoding="async" referrerPolicy="no-referrer" sizes="40px" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-semibold text-white shadow-lg border-2 border-white dark:border-gray-700 group-hover:shadow-xl group-hover:scale-105 transition-all duration-200">{getInitials(m?.firstName, m?.name)}</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{displayName}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{m?.badgeId && `Badge ${m.badgeId} • `}{timeAgo}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{format(ts, "HH:mm")}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{format(ts, "dd/MM")}</div>
                      </div>
                      {index < 3 && (
                        <div className="ml-2"><div className={`w-2 h-2 rounded-full ${index === 0 ? "bg-green-400 animate-pulse" : index === 1 ? "bg-yellow-400" : "bg-gray-400"}`} /></div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="text-sm font-medium mb-1">Aucun passage récent</div>
                <div className="text-xs">Les derniers passages apparaîtront ici</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Derniers membres inscrits (ADMIN) — réintégré avec skeletons */}
      {isAdmin && (
        <div className="block w-full bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Derniers membres inscrits</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">{loading.latestMembers ? "—" : `${latestMembers.length} / 3`}</span>
          </div>
          {loading.latestMembers ? (
            <div className="space-y-2">
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
            </div>
          ) : latestMembers.length > 0 ? (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {latestMembers.map((m) => {
                const displayName = `${m.firstName || ""} ${m.name || ""}`.trim() || `Membre #${m.id}`;
                return (
                  <li key={m.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {m.photo ? (
                        <img src={m.photo} alt={displayName} width="40" height="40" className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow" loading="lazy" decoding="async" referrerPolicy="no-referrer" sizes="40px" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-sm font-semibold text-white shadow">{getInitials(m.firstName, m.name)}</div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{displayName}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">ID #{m.id}</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Nouveau</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Aucun membre récent à afficher.</p>
          )}
        </div>
      )}

      {/* Abonnements échus (ADMIN) — réintégré (pas de skeleton spécifique) */}
      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Abonnements échus</h2>
          {stats.membresExpirés?.length > 0 ? (
            <>
              <ul className="space-y-2">
                {stats.membresExpirés.slice(0, 5).map((membre, idx) => (
                  <li key={membre.id ?? idx} className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                    <span className="truncate">{membre.firstName} {membre.name}</span>
                    <FaExclamationTriangle className="text-red-500 flex-shrink-0 ml-3" />
                  </li>
                ))}
              </ul>
              {stats.membresExpirés.length > 5 && (
                <div className="mt-4 text-center">
                  <a href="/members?filter=expired" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">Voir les {stats.membresExpirés.length - 5} autres...</a>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">Aucun membre avec un abonnement échu.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default HomePage;
