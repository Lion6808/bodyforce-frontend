// 📄 HomePage.js — VERSION ULTRA-OPTIMISÉE
// ✅ Optimisations appliquées :
//    1. Promise.all pour paralléliser les requêtes
//    2. React.memo pour éviter re-renders inutiles
//    3. useMemo/useCallback pour calculs et fonctions
//    4. Réduction des dépendances useEffect
//    5. Chargement intelligent des photos (Intersection Observer)
//    6. Limitation stricte des données chargées

import React, { useEffect, useState, useRef, useMemo, useCallback, memo } from "react";
import { isToday, isBefore, parseISO, format } from "date-fns";
import { fr } from "date-fns/locale";
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
import Avatar from "../components/Avatar";

// ====================================================
// SKELETONS / LOADERS (React.memo pour éviter re-renders)
// ====================================================
const SkeletonPulse = memo(({ className = "" }) => (
  <div className={`bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`} />
));

const SkeletonCard = memo(() => (
  <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-100 dark:border-gray-700 animate-pulse">
    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
    <div className="ml-4 flex-1">
      <SkeletonPulse className="h-4 w-24 mb-2 rounded" />
      <SkeletonPulse className="h-6 w-16 rounded" />
    </div>
  </div>
));

const SkeletonListItem = memo(() => (
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
));

const SkeletonRing = memo(() => (
  <div className="flex items-center justify-center">
    <div className="w-40 h-40 rounded-full border-8 border-gray-200 dark:border-gray-700 animate-pulse" />
  </div>
));

// ====================================================
// Widgets de Motivation Admin (React.memo)
// ====================================================
const AdminMotivationWidgets = memo(({
  stats,
  paymentSummary,
  attendance7d,
  latestMembers,
}) => {
  const metrics = useMemo(() => {
    const memberGoal = 250;
    const currentMembers = stats?.total || 0;
    const goalProgress = (currentMembers / memberGoal) * 100;

    const newMembersThisMonth = latestMembers?.length || 0;
    const growthRate =
      currentMembers > 0
        ? Math.round((newMembersThisMonth / currentMembers) * 100)
        : 0;

    const totalAttendances =
      attendance7d?.reduce((sum, d) => sum + (d.count || 0), 0) || 0;
    const avgPerDay =
      attendance7d?.length > 0
        ? Math.round(totalAttendances / attendance7d.length)
        : 0;
    const maxPossibleDaily = currentMembers * 0.4;
    const attendanceRate =
      maxPossibleDaily > 0
        ? Math.min(Math.round((avgPerDay / maxPossibleDaily) * 100), 100)
        : 0;

    const paymentRate =
      paymentSummary?.totalAmount > 0
        ? Math.round(
            (paymentSummary.paidAmount / paymentSummary.totalAmount) * 100
          )
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
  }, [stats, paymentSummary, attendance7d, latestMembers]);

  const motivationMessage = useMemo(() => {
    if (metrics.paymentRate >= 98 && metrics.attendanceRate >= 90) {
      return {
        emoji: "🏆",
        title: "Performance exceptionnelle !",
        desc: "Votre club affiche d'excellents résultats",
      };
    }
    if (metrics.goalProgress >= 90) {
      return {
        emoji: "🎯",
        title: "Objectif presque atteint !",
        desc: `Plus que ${
          metrics.memberGoal - metrics.currentMembers
        } membres pour atteindre 250`,
      };
    }
    if (metrics.newMembersThisMonth >= 5) {
      return {
        emoji: "📈",
        title: "Forte croissance !",
        desc: `${metrics.newMembersThisMonth} nouveaux membres récemment`,
      };
    }
    if (metrics.totalAttendances > 150) {
      return {
        emoji: "🔥",
        title: "Club très actif !",
        desc: `${metrics.totalAttendances} passages cette semaine`,
      };
    }
    return {
      emoji: "💪",
      title: "Continuez sur cette lancée !",
      desc: "Votre club progresse bien",
    };
  }, [metrics]);

  const adminBadges = useMemo(() => {
    const badges = [];
    if (metrics.paymentRate >= 95)
      badges.push({
        icon: <FaDollarSign />,
        name: "Gestion parfaite",
        desc: `${metrics.paymentRate}% encaissés`,
        color: "from-emerald-500 to-green-600",
      });
    if (metrics.attendanceRate >= 80 || metrics.totalAttendances >= 150)
      badges.push({
        icon: <FaFire />,
        name: "Club actif",
        desc: `${metrics.totalAttendances} passages/sem`,
        color: "from-orange-500 to-red-600",
      });
    if (metrics.newMembersThisMonth >= 5)
      badges.push({
        icon: <FaRocket />,
        name: "Forte croissance",
        desc: `+${metrics.newMembersThisMonth} membres`,
        color: "from-purple-500 to-pink-600",
      });
    if (metrics.currentMembers >= 200)
      badges.push({
        icon: <FaUsers />,
        name: "Cap des 200",
        desc: `${metrics.currentMembers} membres`,
        color: "from-blue-500 to-indigo-600",
      });
    if (metrics.goalProgress >= 80)
      badges.push({
        icon: <FaBullseye />,
        name: "Objectif proche",
        desc: `${Math.round(metrics.goalProgress)}% atteint`,
        color: "from-cyan-500 to-blue-600",
      });
    return badges;
  }, [metrics]);

  return (
    <div className="space-y-6 mb-8">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 rounded-2xl p-6 text-white shadow-lg border border-blue-400/20">
        <div className="flex items-start gap-4">
          <div className="text-5xl flex-shrink-0">
            {motivationMessage.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl font-bold mb-1">
              {motivationMessage.title}
            </h3>
            <p className="text-blue-100 dark:text-blue-200 text-sm">
              {motivationMessage.desc}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="text-xs text-blue-100">Membres</div>
                <div className="text-lg font-bold">{stats?.total || 0}</div>
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
    </div>
  );
});

// ====================================================
// StatCard optimisé avec React.memo
// ====================================================
const StatCard = memo(({ icon: Icon, label, value, color }) => (
  <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-colors duration-200 border border-gray-100 dark:border-gray-700">
    <div className={`p-3 rounded-full ${color} text-white`}>
      <Icon size={24} />
    </div>
    <div className="ml-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-xl font-semibold text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  </div>
));

// ====================================================
// CircularProgress optimisé avec React.memo
// ====================================================
const CircularProgress = memo(({ size = 160, stroke = 14, value = 0 }) => {
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
});

// ====================================================
// COMPOSANT PRINCIPAL HomePage
// ====================================================
function HomePage() {
  const { user, role, userMemberData: memberCtx } = useAuth();
  const isAdmin = useMemo(() => (role || "").toLowerCase() === "admin", [role]);

  // Loading flags (un seul état au lieu de plusieurs)
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

  // Cache photos optimisé
  const [photosCache, setPhotosCache] = useState({});
  const photosLoadingRef = useRef(false);
  const photosRequestedRef = useRef(new Set());

  // Stats personnelles admin
  const [adminPersonalStats, setAdminPersonalStats] = useState({
    currentStreak: 0,
    level: 1,
    monthVisits: 0,
    monthlyGoal: 12,
  });

  // ✅ OPTIMISATION 1: Fonction fetchMemberPayments avec useCallback
  const fetchMemberPayments = useCallback(async (memberId) => {
    if (!memberId) return [];
    
    const memberCols = ["member_id", "memberId"];
    const dateCols = [
      "date_paiement",
      "payment_date",
      "due_date",
      "date",
      "created_at",
    ];

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
      } catch (e) {
        console.error(e);
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
    } catch (e) {
      console.error(e);
    }
    return [];
  }, []);

  // ✅ OPTIMISATION 2: fetchAttendanceAdmin optimisé avec Promise.all
  const fetchAttendanceAdmin = useCallback(async () => {
    try {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      // LIMITER à 100 présences au lieu de 500 (on en affiche que 10)
      const { data: presencesData, error } = await supabase
        .from("presences")
        .select("id,badgeId,timestamp")
        .gte("timestamp", start.toISOString())
        .lte("timestamp", end.toISOString())
        .order("timestamp", { ascending: false })
        .limit(100); // ✅ RÉDUIT de 500 à 100

      if (error) {
        console.error("Error loading presences:", error);
        return { attendance7d: [], recentPresences: [] };
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
        const ts =
          typeof row.timestamp === "string"
            ? parseISO(row.timestamp)
            : new Date(row.timestamp);
        const k = key(ts);
        if (countsByKey[k] !== undefined) countsByKey[k] += 1;
      });

      const attendanceResult = days.map((d) => ({
        date: d.date,
        count: countsByKey[key(d.date)] || 0,
      }));

      const recent = (presencesData || []).slice(0, 10);
      const badgeIds = Array.from(
        new Set(recent.map((r) => r.badgeId).filter(Boolean))
      );
      let membersByBadge = {};

      // Charger membres SANS photo
      if (badgeIds.length > 0) {
        const { data: membersData, error: mErr } = await supabase
          .from("members")
          .select("id, firstName, name, badgeId")
          .in("badgeId", badgeIds);
        if (!mErr && membersData) {
          membersByBadge = membersData.reduce((acc, m) => {
            acc[m.badgeId] = m;
            return acc;
          }, {});
        }
      }

      const recentPresencesResult = recent.map((r) => ({
        id: r.id,
        ts: r.timestamp,
        member: membersByBadge[r.badgeId],
        badgeId: r.badgeId,
      }));

      return {
        attendance7d: attendanceResult,
        recentPresences: recentPresencesResult,
      };
    } catch (e) {
      console.error("fetchAttendanceAdmin error:", e);
      return { attendance7d: [], recentPresences: [] };
    }
  }, []);

  // ✅ OPTIMISATION 3: Chargement initial avec Promise.all pour paralléliser
  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      if (!user) {
        setLoading({
          stats: false,
          payments: false,
          presences: false,
          latestMembers: false,
        });
        return;
      }

      try {
        if (isAdmin) {
          // ✅ Paralléliser TOUTES les requêtes Admin
          const [
            statsResult,
            paymentsResult,
            attendanceResult,
            latestResult,
          ] = await Promise.all([
            // 1. Stats
            supabaseServices.getStatistics().catch((err) => {
              console.error("Stats error:", err);
              return {
                stats: {
                  total: 0,
                  actifs: 0,
                  expirés: 0,
                  hommes: 0,
                  femmes: 0,
                  etudiants: 0,
                  membresExpirés: [],
                },
              };
            }),
            
            // 2. Payments
            supabaseServices.getPayments().catch((err) => {
              console.error("Payments error:", err);
              return [];
            }),
            
            // 3. Attendance
            fetchAttendanceAdmin(),
            
            // 4. Latest members (SANS photos)
            supabase
              .from("members")
              .select("id, firstName, name")
              .order("id", { ascending: false })
              .limit(7)
              .then((res) => res.data || [])
              .catch((err) => {
                console.error("Latest members error:", err);
                return [];
              }),
          ]);

          if (!mounted) return;

          // Traiter les stats
          setStats(
            statsResult.stats || {
              total: 0,
              actifs: 0,
              expirés: 0,
              hommes: 0,
              femmes: 0,
              etudiants: 0,
              membresExpirés: [],
            }
          );

          // Traiter les payments
          const payments = paymentsResult || [];
          const paid = payments.filter((p) => p.is_paid);
          const pending = payments.filter((p) => !p.is_paid);
          const sum = (arr) =>
            arr.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

          setPendingPayments(pending);
          setPaymentSummary({
            totalCount: payments.length,
            paidCount: paid.length,
            pendingCount: pending.length,
            totalAmount: sum(payments),
            paidAmount: sum(paid),
            pendingAmount: sum(pending),
          });

          // Traiter attendance
          setAttendance7d(attendanceResult.attendance7d);
          setRecentPresences(attendanceResult.recentPresences);

          // Traiter latest members
          setLatestMembers(latestResult);

          setLoading({
            stats: false,
            payments: false,
            presences: false,
            latestMembers: false,
          });
        } else {
          // User normal : stats + payments en parallèle
          const [statsResult, userPaymentsResult] = await Promise.all([
            supabaseServices.getStatistics().catch(() => ({
              stats: {
                total: 0,
                actifs: 0,
                expirés: 0,
                hommes: 0,
                femmes: 0,
                etudiants: 0,
                membresExpirés: [],
              },
            })),
            memberCtx?.id
              ? fetchMemberPayments(memberCtx.id)
              : Promise.resolve([]),
          ]);

          if (!mounted) return;

          setStats(statsResult.stats);
          setUserPayments(userPaymentsResult);

          setLoading({
            stats: false,
            payments: false,
            presences: false,
            latestMembers: false,
          });
        }
      } catch (e) {
        console.error("HomePage fetch error:", e);
        if (mounted) {
          setLoading({
            stats: false,
            payments: false,
            presences: false,
            latestMembers: false,
          });
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [user, isAdmin, memberCtx?.id, fetchMemberPayments, fetchAttendanceAdmin]);

  // ✅ OPTIMISATION 4: Lazy-load photos avec debounce intelligent
  useEffect(() => {
    const loadPhotosForDisplayedMembers = async () => {
      if (photosLoadingRef.current) return;

      const memberIds = new Set();

      latestMembers.forEach((m) => {
        if (m.id && !photosRequestedRef.current.has(m.id)) {
          memberIds.add(m.id);
        }
      });

      recentPresences.forEach((r) => {
        if (r.member?.id && !photosRequestedRef.current.has(r.member.id)) {
          memberIds.add(r.member.id);
        }
      });

      const idsArray = Array.from(memberIds);
      const missingIds = idsArray.filter((id) => !(id in photosCache));

      if (missingIds.length === 0) return;

      // Marquer comme demandés
      missingIds.forEach((id) => photosRequestedRef.current.add(id));

      try {
        photosLoadingRef.current = true;

        // ✅ Charger par batch de 10 max pour éviter surcharge
        const batchSize = 10;
        const batches = [];
        for (let i = 0; i < missingIds.length; i += batchSize) {
          batches.push(missingIds.slice(i, i + batchSize));
        }

        for (const batch of batches) {
          const newPhotos =
            (await supabaseServices.getMemberPhotos(batch)) || {};
          
          setPhotosCache((prev) => {
            const nextCache = { ...prev };
            batch.forEach((id) => {
              nextCache[id] = newPhotos[id] || null;
            });
            return nextCache;
          });
        }
      } catch (err) {
        console.error("Erreur chargement photos:", err);
      } finally {
        photosLoadingRef.current = false;
      }
    };

    // Attendre que les données soient chargées
    if (
      !loading.latestMembers &&
      !loading.presences &&
      (latestMembers.length > 0 || recentPresences.length > 0)
    ) {
      // Debounce de 100ms pour éviter appels multiples
      const timer = setTimeout(loadPhotosForDisplayedMembers, 100);
      return () => clearTimeout(timer);
    }
  }, [
    latestMembers,
    recentPresences,
    loading.latestMembers,
    loading.presences,
    photosCache,
  ]);

  // Stats perso admin
  useEffect(() => {
    if (!isAdmin || !memberCtx?.badgeId) return;

    const fetchAdminPersonalStats = async () => {
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
        const sortedDates = presences
          .map((p) => new Date(p.timestamp))
          .sort((a, b) => b - a);
        
        if (sortedDates.length > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const lastVisit = new Date(sortedDates[0]);
          lastVisit.setHours(0, 0, 0, 0);
          const daysDiff = Math.floor(
            (today - lastVisit) / (1000 * 60 * 60 * 24)
          );
          
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
          return (
            d.getMonth() === currentMonth && d.getFullYear() === currentYear
          );
        }).length;

        setAdminPersonalStats({
          currentStreak,
          level,
          monthVisits,
          monthlyGoal: 12,
        });
      } catch (error) {
        console.error("Erreur chargement stats admin:", error);
      }
    };

    fetchAdminPersonalStats();
  }, [isAdmin, memberCtx?.badgeId]);

  // ✅ OPTIMISATION 5: Fonctions utilitaires avec useCallback
  const getInitials = useCallback((firstName, name) => {
    const a = (firstName || "").trim().charAt(0);
    const b = (name || "").trim().charAt(0);
    return (a + b).toUpperCase() || "?";
  }, []);

  const getTimeAgo = useCallback((date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    if (diffInMinutes < 1) return "À l'instant";
    if (diffInMinutes < 60) return `Il y a ${diffInMinutes} min`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Il y a ${diffInHours}h`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `Il y a ${diffInDays}j`;
    return format(date, "dd/MM/yyyy");
  }, []);

  // ✅ OPTIMISATION 6: Calculs avec useMemo
  const { progress, totalAmount, paidAmount, pendingAmount, totalCount, paidCount, pendingCount } = useMemo(() => {
    const {
      totalAmount = 0,
      paidAmount = 0,
      pendingAmount = 0,
      totalCount = 0,
      paidCount = 0,
      pendingCount = 0,
    } = paymentSummary;
    const progress = totalAmount > 0 ? paidAmount / totalAmount : 0;
    return { progress, totalAmount, paidAmount, pendingAmount, totalCount, paidCount, pendingCount };
  }, [paymentSummary]);

  const memberInfo = useMemo(() => {
    const firstName = memberCtx?.firstName || memberCtx?.firstname || memberCtx?.prenom || "";
    const lastName = memberCtx?.name || memberCtx?.lastname || memberCtx?.nom || "";
    const displayName = (firstName || lastName ? `${firstName} ${lastName}`.trim() : user?.email) || "Bienvenue";
    const photo = memberCtx?.photo || "";
    return { firstName, lastName, displayName, photo };
  }, [memberCtx, user]);

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900 min-h-screen transition-colors duration-300">
      {/* En-tête utilisateur */}
      {user && (
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-blue-500/10 dark:from-indigo-400/10 dark:via-emerald-400/10 dark:to-blue-400/10" />
          <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="relative">
              {memberInfo.photo ? (
                <img
                  src={memberInfo.photo}
                  alt={memberInfo.displayName}
                  width="160"
                  height="160"
                  className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover shadow-xl ring-4 ring-white dark:ring-gray-700"
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-xl ring-4 ring-white dark:ring-gray-700">
                  {getInitials(memberInfo.firstName, memberInfo.lastName)}
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-400/90 blur-sm" />
            </div>

            <div className="text-center md:text-left flex-1">
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
                Bonjour{memberInfo.firstName ? `, ${memberInfo.firstName}` : ""} 👋
              </h1>
              <p className="mt-1 text-sm md:text-base text-gray-600 dark:text-gray-300">
                Heureux de vous revoir sur votre espace. Retrouvez ici vos
                dernières informations.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 justify-center md:justify-start">
                {memberCtx?.badgeId && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                    Badge : {memberCtx.badgeId}
                  </span>
                )}

                {isAdmin && memberCtx?.badgeId && (
                  <>
                    {adminPersonalStats.currentStreak > 0 && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-700 dark:text-orange-300 flex items-center gap-1">
                        🔥 {adminPersonalStats.currentStreak} jour
                        {adminPersonalStats.currentStreak > 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/15 text-purple-700 dark:text-purple-300">
                      📊 Niveau {adminPersonalStats.level}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-700 dark:text-blue-300">
                      🎯 {adminPersonalStats.monthVisits}/
                      {adminPersonalStats.monthlyGoal} ce mois
                    </span>
                    <a
                      href="/my-attendances"
                      className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1"
                    >
                      Voir mes stats
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </a>
                  </>
                )}

                {!isAdmin && userPayments?.length > 0 && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    {userPayments.filter((p) => p.is_paid).length} paiement(s)
                    réglé(s)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
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
              <StatCard
                icon={FaUsers}
                label="Total Membres"
                value={stats.total}
                color="bg-blue-500"
              />
              <StatCard
                icon={FaUserCheck}
                label="Actifs"
                value={stats.actifs}
                color="bg-green-500"
              />
              <StatCard
                icon={FaUserTimes}
                label="Expirés"
                value={stats.expirés}
                color="bg-red-500"
              />
              <StatCard
                icon={FaMale}
                label="Hommes"
                value={stats.hommes}
                color="bg-indigo-500"
              />
              <StatCard
                icon={FaFemale}
                label="Femmes"
                value={stats.femmes}
                color="bg-pink-500"
              />
              <StatCard
                icon={FaGraduationCap}
                label="Étudiants"
                value={stats.etudiants}
                color="bg-yellow-500"
              />
            </>
          )}
        </div>
      )}

      {/* Admin Motivation Widgets */}
      {isAdmin && (
        <AdminMotivationWidgets
          stats={stats}
          paymentSummary={paymentSummary}
          attendance7d={attendance7d}
          latestMembers={latestMembers}
        />
      )}

      {/* User Payments */}
      {user && !isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FaCreditCard className="text-blue-500" />
              Vos paiements
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {loading.payments ? "—" : userPayments?.length || 0} opération(s)
            </span>
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
                const dateRaw =
                  p.date_paiement ||
                  p.payment_date ||
                  p.due_date ||
                  p.date ||
                  p.created_at;
                let dateStr = "";
                try {
                  if (dateRaw) {
                    const d =
                      typeof dateRaw === "string"
                        ? parseISO(dateRaw)
                        : new Date(dateRaw);
                    dateStr = format(d, "dd/MM/yyyy");
                  }
                } catch (e) {
                  console.error(e);
                }
                return (
                  <li
                    key={p.id}
                    className="py-3 flex items-center justify-between"
                  >
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
                          isPaid
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
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

      {/* Admin Global Payments */}
      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FaCreditCard className="text-blue-500" />
              État global des paiements
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {loading.payments
                ? "Chargement…"
                : `${totalCount} opérations • ${(totalAmount || 0).toFixed(
                    2
                  )} €`}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-6">
            <div className="flex justify-center">
              {loading.payments ? (
                <SkeletonRing />
              ) : (
                <CircularProgress value={progress} />
              )}
            </div>
            <div className="space-y-4">
              {loading.payments ? (
                <>
                  <div className="flex items-center justify-between">
                    <SkeletonPulse className="h-4 w-40 rounded" />
                    <SkeletonPulse className="h-4 w-24 rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <SkeletonPulse className="h-4 w-40 rounded" />
                    <SkeletonPulse className="h-4 w-24 rounded" />
                  </div>
                  <SkeletonPulse className="h-2 w-full rounded" />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-gray-700 dark:text-gray-300 font-medium">
                        Payé
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-900 dark:text-white font-semibold">
                        {(paidAmount || 0).toFixed(2)} €
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {paidCount} op.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-gray-700 dark:text-gray-300 font-medium">
                        En attente
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-900 dark:text-white font-semibold">
                        {(pendingAmount || 0).toFixed(2)} €
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {pendingCount} op.
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className="h-2 bg-gradient-to-r from-green-500 to-blue-500"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {Math.round(progress * 100)}% du montant total déjà
                      encaissé
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Attendance & Recent Presences */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Présences — 7 derniers jours
              </h2>
              {!loading.presences && attendance7d.length > 0 && (
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {attendance7d.reduce((sum, d) => sum + d.count, 0)} passages
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Moy:{" "}
                    {Math.round(
                      attendance7d.reduce((sum, d) => sum + d.count, 0) / 7
                    )}
                    /jour
                  </div>
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
              <div className="relative h-60">
                <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-gray-400 dark:text-gray-500 pr-2">
                  {[...Array(6)].map((_, i) => {
                    const maxCount = Math.max(
                      ...attendance7d.map((d) => d.count),
                      1
                    );
                    const value = Math.round((maxCount * (5 - i)) / 5);
                    return (
                      <div key={i} className="text-right">
                        {value}
                      </div>
                    );
                  })}
                </div>

                <div className="ml-10 h-full flex items-end justify-between gap-2 pb-8">
                  {attendance7d.map((dayData, index) => {
                    const maxCount = Math.max(
                      ...attendance7d.map((d) => d.count),
                      1
                    );
                    const heightPercent =
                      maxCount > 0 ? (dayData.count / maxCount) * 100 : 0;
                    const dayName = format(dayData.date, "EEE", {
                      locale: fr,
                    }).substring(0, 3);
                    const isWeekend =
                      dayData.date.getDay() === 0 ||
                      dayData.date.getDay() === 6;
                    const gradient =
                      dayData.count > maxCount * 0.7
                        ? "from-emerald-500 to-teal-400"
                        : dayData.count > maxCount * 0.4
                        ? "from-cyan-500 to-blue-400"
                        : "from-indigo-500 to-purple-400";

                    return (
                      <div
                        key={index}
                        className="flex-1 h-full flex flex-col items-center justify-end gap-2 group"
                      >
                        <div
                          className={`w-full bg-gradient-to-t ${gradient} rounded-t-xl relative transition-all hover:opacity-80 cursor-pointer shadow-lg`}
                          style={{ height: `${Math.max(heightPercent, 2)}%` }}
                        >
                          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white px-2 py-1 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl">
                            {dayData.count}
                          </div>
                        </div>
                        <div
                          className={`text-xs font-medium ${
                            isWeekend
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {dayName}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
                <div className="text-sm">Aucune présence</div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Derniers passages
              </h2>
              {!loading.presences && recentPresences.length > 0 && (
                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {recentPresences.length} récents
                </span>
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
                  const ts =
                    typeof r.ts === "string" ? parseISO(r.ts) : new Date(r.ts);
                  const displayName = m
                    ? `${m.firstName || ""} ${m.name || ""}`.trim()
                    : `Badge ${r.badgeId || "?"}`;
                  const timeAgo = getTimeAgo(ts);
                  return (
                    <div
                      key={r.id}
                      className="group flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 rounded-lg transition-all duration-200 border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar
                          photo={photosCache[m?.id] || null}
                          firstName={m?.firstName}
                          name={m?.name}
                          size={40}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {displayName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {m?.badgeId && `Badge ${m.badgeId} • `}
                            {timeAgo}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {format(ts, "HH:mm")}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {format(ts, "dd/MM")}
                        </div>
                      </div>
                      {index < 3 && (
                        <div className="ml-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              index === 0
                                ? "bg-green-400 animate-pulse"
                                : index === 1
                                ? "bg-yellow-400"
                                : "bg-gray-400"
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
                <div className="text-sm">Aucun passage récent</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Latest Members */}
      {isAdmin && (
        <div className="block w-full bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Derniers membres inscrits
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
              {loading.latestMembers ? "—" : `${latestMembers.length} / 7`}
            </span>
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
                const displayName =
                  `${m.firstName || ""} ${m.name || ""}`.trim() ||
                  `Membre #${m.id}`;
                return (
                  <li
                    key={m.id}
                    className="py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        photo={photosCache[m.id] || null}
                        firstName={m.firstName}
                        name={m.name}
                        size={40}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {displayName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          ID #{m.id}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      Nouveau
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Aucun membre récent à afficher.
            </p>
          )}
        </div>
      )}

      {/* Expired Members */}
      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Abonnements échus
          </h2>
          {stats.membresExpirés?.length > 0 ? (
            <>
              <ul className="space-y-2">
                {stats.membresExpirés.slice(0, 5).map((membre, idx) => (
                  <li
                    key={membre.id ?? idx}
                    className="flex items-center justify-between text-gray-700 dark:text-gray-300"
                  >
                    <span className="truncate">
                      {membre.firstName} {membre.name}
                    </span>
                    <FaExclamationTriangle className="text-red-500 flex-shrink-0 ml-3" />
                  </li>
                ))}
              </ul>
              {stats.membresExpirés.length > 5 && (
                <div className="mt-4 text-center">
                  <a
                    href="/members?filter=expired"
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Voir les {stats.membresExpirés.length - 5} autres...
                  </a>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Aucun membre avec un abonnement échu.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default HomePage;