// =============================================================================
// HomePage.js — Page d'accueil BodyForce
// =============================================================================
//
// Affiche un tableau de bord different selon le role :
//   - Admin  : stats globales, widgets motivation, graphique presences 7j,
//              derniers passages (realtime), derniers badges, abonnements echus
//   - Membre : informations personnelles, liste de ses paiements
//
// Optimisations egress :
//   - Les membres sont charges SANS photo (select minimal)
//   - Les photos sont chargees en lazy-load une fois les listes pretes
//   - Un cache local (photosCache) evite les rechargements inutiles
//   - Composant Avatar reutilisable pour l'affichage des photos/initiales
// =============================================================================

import React, { useEffect, useState, useRef } from "react";
import { parseISO, format } from "date-fns";
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
  FaFire,
  FaBullseye,
  FaRocket,
  FaDollarSign,
} from "react-icons/fa";

import { supabaseServices, supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import Avatar from "../components/Avatar";
import MemberForm from "../components/MemberForm";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

// =============================================================================
// SECTION 1 — Composants Skeleton (placeholders de chargement)
// =============================================================================

/** Barre pulsante generique pour les etats de chargement */
const SkeletonPulse = ({ className = "" }) => (
  <div
    className={`bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`}
  />
);

/** Skeleton d'une carte de statistique (StatCard) */
const SkeletonCard = () => (
  <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-100 dark:border-gray-700 animate-pulse">
    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
    <div className="ml-4 flex-1">
      <SkeletonPulse className="h-4 w-24 mb-2 rounded" />
      <SkeletonPulse className="h-6 w-16 rounded" />
    </div>
  </div>
);

/** Skeleton d'un element de liste (passages, membres, paiements) */
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

// =============================================================================
// SECTION 2 — Widgets de motivation admin (bandeau en haut du dashboard)
// =============================================================================

/**
 * Bandeau motivationnel affiche uniquement pour les admins.
 * Calcule des metriques (progression objectif membres, taux de paiement,
 * frequentation) et affiche des badges de performance.
 */
const AdminMotivationWidgets = ({
  stats,
  paymentSummary,
  attendance7d,
  latestMembers,
}) => {
  // --- Calcul des metriques de motivation ---
  const calculateMotivationMetrics = () => {
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
  };

  const metrics = calculateMotivationMetrics();

  // --- Message motivationnel contextuel ---
  const getMotivationalMessage = () => {
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
        desc: `Plus que ${metrics.memberGoal - metrics.currentMembers} membres pour atteindre 250`,
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
  };

  const motivationMessage = getMotivationalMessage();

  // --- Badges de performance ---
  const getAdminBadges = () => {
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
  };

  const adminBadges = getAdminBadges();

  // --- Rendu du bandeau ---
  return (
    <div className="space-y-6 mb-8">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 rounded-2xl p-6 text-white shadow-lg border border-blue-400/20">
        <div className="flex items-start gap-4">
          {/* Emoji principal */}
          <div className="text-5xl flex-shrink-0">
            {motivationMessage.emoji}
          </div>

          {/* Message + mini-stats */}
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
                <div className="text-lg font-bold">
                  {attendance7d?.length
                    ? Math.round(
                        attendance7d.reduce((s, d) => s + (d.count || 0), 0) /
                          attendance7d.length
                      )
                    : 0}
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="text-xs text-blue-100">Taux paiement</div>
                <div className="text-lg font-bold">
                  {paymentSummary?.totalAmount > 0
                    ? Math.round(
                        (paymentSummary.paidAmount /
                          paymentSummary.totalAmount) *
                          100
                      )
                    : 0}
                  %
                </div>
              </div>
            </div>
          </div>

          {/* Badges de performance (desktop uniquement) */}
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
};

// =============================================================================
// SECTION 3 — Utilitaires
// =============================================================================

/** Retourne les initiales (2 lettres max) a partir du prenom et du nom */
const getInitials = (firstName, name) => {
  const a = (firstName || "").trim().charAt(0);
  const b = (name || "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
};

/**
 * Retourne un texte relatif ("A l'instant", "Il y a 5 min", etc.)
 * a partir d'un objet Date.
 */
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

// =============================================================================
// SECTION 4 — Sous-composants de presentation
// =============================================================================

/** Carte de statistique avec icone, label et valeur */
const StatCard = ({ icon: Icon, label, value, color }) => (
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
);

// =============================================================================
// SECTION 5 — Composant principal HomePage
// =============================================================================

function HomePage() {
  const { user, role, userMemberData: memberCtx } = useAuth();
  const isAdmin = (role || "").toLowerCase() === "admin";
  const navigate = useNavigate();

  // ---------------------------------------------------------------------------
  // 5.1 — State
  // ---------------------------------------------------------------------------

  const [isMobile, setIsMobile] = useState(false);

  // Flags de chargement par section
  const [loading, setLoading] = useState({
    stats: true,
    payments: true,
    presences: true,
    latestMembers: true,
  });

  // Statistiques globales des membres
  const [stats, setStats] = useState({
    total: 0,
    actifs: 0,
    expirés: 0,
    hommes: 0,
    femmes: 0,
    etudiants: 0,
    membresExpirés: [],
  });

  // Paiements (admin : en attente / membre : ses propres paiements)
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

  // Presences et frequentation
  const [attendance7d, setAttendance7d] = useState([]);
  const [recentPresences, setRecentPresences] = useState([]);

  // Derniers membres inscrits
  const [latestMembers, setLatestMembers] = useState([]);

  // Cache des photos (lazy-load)
  const [photosCache, setPhotosCache] = useState({});
  const photosLoadingRef = useRef(false);

  // Modal de detail/edition d'un membre (mobile)
  const [selectedMember, setSelectedMember] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Stats personnelles de l'admin (streak, niveau, etc.)
  const [adminPersonalStats, setAdminPersonalStats] = useState({
    currentStreak: 0,
    level: 1,
    monthVisits: 0,
    monthlyGoal: 12,
  });

  // ---------------------------------------------------------------------------
  // 5.2 — Handlers d'interaction
  // ---------------------------------------------------------------------------

  /** Ouvre le detail d'un membre (modal mobile / navigation desktop) */
  const handleEditMember = async (member) => {
    if (!member || !member.id) return;

    if (isMobile) {
      try {
        const fullMember = await supabaseServices.getMemberById(member.id);
        setSelectedMember(fullMember || member);
        setShowForm(true);
      } catch (err) {
        console.error("Erreur chargement membre:", err);
        setSelectedMember(member);
        setShowForm(true);
      }
    } else {
      navigate("/members/edit", {
        state: { member, returnPath: "/", memberId: member.id },
      });
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedMember(null);
  };

  const handleSaveMember = async () => {
    setShowForm(false);
    setSelectedMember(null);
  };

  // ---------------------------------------------------------------------------
  // 5.3 — Fonctions de chargement de donnees
  // ---------------------------------------------------------------------------

  /**
   * Charge les paiements d'un membre en essayant differentes colonnes
   * de liaison (member_id / memberId) et de tri (date_paiement, etc.).
   * Fallback sur les services Supabase si la requete directe echoue.
   */
  const fetchMemberPayments = async (memberId) => {
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
        const { data, error } = await supabase
          .from("payments")
          .select(SELECT_PAYMENT_COLS)
          .eq(mcol, memberId);
        if (error) continue;

        // Essai de tri par chaque colonne de date possible
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

    // Fallback : utilisation des services
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
  };

  // ---------------------------------------------------------------------------
  // 5.4 — Effects : chargement initial des donnees
  // ---------------------------------------------------------------------------

  /**
   * Effect principal : charge les stats, paiements, presences et derniers
   * membres au montage du composant et quand le role/user change.
   */
  useEffect(() => {
    // --- Sous-fonction : charger les presences des 7 derniers jours (admin) ---
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

        // Construction du tableau jour par jour
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

        setAttendance7d(
          days.map((d) => ({
            date: d.date,
            count: countsByKey[key(d.date)] || 0,
          }))
        );

        // 10 derniers passages avec resolution des membres (sans photo)
        const recent = (presencesData || []).slice(0, 10);
        const badgeIds = Array.from(
          new Set(recent.map((r) => r.badgeId).filter(Boolean))
        );
        let membersByBadge = {};

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

        setRecentPresences(
          recent.map((r) => ({
            id: r.id,
            ts: r.timestamp,
            member: membersByBadge[r.badgeId],
            badgeId: r.badgeId,
          }))
        );
      } catch (e) {
        console.error("fetchAttendanceAdmin error:", e);
        setAttendance7d([]);
        setRecentPresences([]);
      } finally {
        setLoading((s) => ({ ...s, presences: false }));
      }
    };

    // --- Fonction principale de chargement ---
    const fetchData = async () => {
      try {
        if (!user) {
          setUserPayments([]);
          setLoading({
            stats: false,
            payments: false,
            presences: false,
            latestMembers: false,
          });
          return;
        }

        // 1) Statistiques globales
        try {
          const { stats: calculatedStats } =
            await supabaseServices.getStatisticsLight();
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
          // 2a) Paiements globaux (admin)
          try {
            const payments = await supabaseServices.getPayments();
            const paid = (payments || []).filter((p) => p.is_paid);
            const pending = (payments || []).filter((p) => !p.is_paid);
            const sum = (arr) =>
              arr.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

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

          // 3) Presences 7 jours
          await fetchAttendanceAdmin();

          // 4) Derniers membres inscrits (par badge_number desc, sans photo)
          try {
            const { data: latest, error: latestErr } = await supabase
              .from("members")
              .select("id, firstName, name, badge_number")
              .not("badge_number", "is", null)
              .order("badge_number", { ascending: false })
              .limit(10);
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
          // 2b) Paiements du membre connecte
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
      } catch (e) {
        console.error("HomePage fetch error:", e);
        setLoading({
          stats: false,
          payments: false,
          presences: false,
          latestMembers: false,
        });
      }
    };

    fetchData();
  }, [role, user, isAdmin, memberCtx?.id]);

  // ---------------------------------------------------------------------------
  // 5.5 — Effect : abonnement Realtime sur les nouvelles presences (admin)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isAdmin) return;

    /** Rafraichit la liste des 10 derniers passages */
    const refreshRecentPresences = async () => {
      try {
        const { data: presencesData } = await supabase
          .from("presences")
          .select("id,badgeId,timestamp")
          .order("timestamp", { ascending: false })
          .limit(10);

        if (!presencesData) return;

        const badgeIds = Array.from(
          new Set(presencesData.map((r) => r.badgeId).filter(Boolean))
        );
        let membersByBadge = {};

        if (badgeIds.length > 0) {
          const { data: membersData } = await supabase
            .from("members")
            .select("id, firstName, name, badgeId")
            .in("badgeId", badgeIds);
          if (membersData) {
            membersByBadge = membersData.reduce((acc, m) => {
              acc[m.badgeId] = m;
              return acc;
            }, {});
          }
        }

        setRecentPresences(
          presencesData.map((r) => ({
            id: r.id,
            ts: r.timestamp,
            member: membersByBadge[r.badgeId],
            badgeId: r.badgeId,
          }))
        );
      } catch (e) {
        console.error("Realtime refresh error:", e);
      }
    };

    const channel = supabase
      .channel("homepage-presences")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "presences" },
        () => refreshRecentPresences()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  // ---------------------------------------------------------------------------
  // 5.6 — Effect : lazy-load des photos pour les membres affiches
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const loadPhotosForDisplayedMembers = async () => {
      if (photosLoadingRef.current) return;

      // Collecter tous les IDs de membres visibles
      const memberIds = new Set();
      latestMembers.forEach((m) => {
        if (m.id) memberIds.add(m.id);
      });
      recentPresences.forEach((r) => {
        if (r.member?.id) memberIds.add(r.member.id);
      });

      // Ne charger que les photos manquantes du cache
      const missingIds = Array.from(memberIds).filter(
        (id) => !(id in photosCache)
      );
      if (missingIds.length === 0) return;

      try {
        photosLoadingRef.current = true;

        const newPhotos =
          (await supabaseServices.getMemberPhotos(missingIds)) || {};
        const nextCache = { ...photosCache, ...newPhotos };

        // Marquer les IDs sans photo comme null pour eviter de re-charger
        for (const id of missingIds) {
          if (!(id in newPhotos)) nextCache[id] = null;
        }

        // Ne mettre a jour le state que si le cache a reellement change
        const hasChanged = missingIds.some(
          (id) => photosCache[id] !== nextCache[id]
        );
        if (hasChanged) setPhotosCache(nextCache);
      } catch (err) {
        console.error("Erreur chargement photos:", err);
      } finally {
        photosLoadingRef.current = false;
      }
    };

    if (
      !loading.latestMembers &&
      !loading.presences &&
      (latestMembers.length > 0 || recentPresences.length > 0)
    ) {
      loadPhotosForDisplayedMembers();
    }
  }, [
    latestMembers,
    recentPresences,
    loading.latestMembers,
    loading.presences,
    photosCache,
  ]);

  // ---------------------------------------------------------------------------
  // 5.7 — Effect : toast de notification pour les nouveaux membres (admin)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isAdmin || loading.latestMembers || latestMembers.length === 0) return;

    const STORAGE_KEY = "bodyforce_lastSeenBadgeNumber";
    const lastSeenBadgeNumber = parseInt(
      localStorage.getItem(STORAGE_KEY) || "0",
      10
    );

    const currentMaxBadge = Math.max(
      ...latestMembers.map((m) => m.badge_number || 0)
    );

    if (currentMaxBadge > lastSeenBadgeNumber) {
      const newMembers = latestMembers.filter(
        (m) => m.badge_number > lastSeenBadgeNumber
      );

      if (newMembers.length === 1) {
        const m = newMembers[0];
        toast.info(
          `🎉 Nouveau membre !\n${m.firstName} ${m.name} (Badge ${m.badge_number})`,
          { autoClose: 6000, icon: false }
        );
      } else if (newMembers.length > 1) {
        const names = newMembers
          .slice(0, 3)
          .map((m) => `${m.firstName} ${m.name}`)
          .join(", ");
        const extra =
          newMembers.length > 3
            ? ` +${newMembers.length - 3} autre(s)`
            : "";
        toast.info(
          `🎉 ${newMembers.length} nouveaux membres !\n${names}${extra}`,
          { autoClose: 6000, icon: false }
        );
      }

      localStorage.setItem(STORAGE_KEY, currentMaxBadge.toString());
    }
  }, [isAdmin, loading.latestMembers, latestMembers]);

  // ---------------------------------------------------------------------------
  // 5.8 — Effect : stats personnelles de l'admin (streak, niveau)
  // ---------------------------------------------------------------------------

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

        // Calcul du streak (jours consecutifs de visite)
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
              const diff = Math.floor(
                (current - next) / (1000 * 60 * 60 * 24)
              );
              if (diff === 1) currentStreak++;
              else break;
            }
          }
        }

        // Niveau = 1 palier tous les 5 passages
        const totalVisits = presences.length;
        const level = Math.floor(totalVisits / 5) + 1;

        // Visites du mois en cours
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

  // ---------------------------------------------------------------------------
  // 5.9 — Effect : detection mobile (breakpoint 1024px)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ---------------------------------------------------------------------------
  // 5.10 — Variables derivees pour le rendu
  // ---------------------------------------------------------------------------

  const memberFirstName =
    memberCtx?.firstName || memberCtx?.firstname || memberCtx?.prenom || "";
  const memberLastName =
    memberCtx?.name || memberCtx?.lastname || memberCtx?.nom || "";
  const memberDisplayName =
    (memberFirstName || memberLastName
      ? `${memberFirstName} ${memberLastName}`.trim()
      : user?.email) || "Bienvenue";
  const memberPhoto = memberCtx?.photo || "";

  // ===========================================================================
  // SECTION 6 — Rendu JSX
  // ===========================================================================

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900 min-h-screen transition-colors duration-300">

      {/* ------------------------------------------------------------------ */}
      {/* 6.1 — Bandeau d'accueil utilisateur (photo, nom, badges perso)     */}
      {/* ------------------------------------------------------------------ */}
      {user && (
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-blue-500/10 dark:from-indigo-400/10 dark:via-emerald-400/10 dark:to-blue-400/10" />
          <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
            {/* Photo ou initiales */}
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
                  {getInitials(memberFirstName, memberLastName)}
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-400/90 blur-sm" />
            </div>

            {/* Texte de bienvenue + tags */}
            <div className="text-center md:text-left flex-1">
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
                Bonjour{memberFirstName ? `, ${memberFirstName}` : ""} 👋
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

                {/* Tags admin : streak, niveau, objectif mensuel */}
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

                {/* Tag membre : nombre de paiements regles */}
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

      {/* ------------------------------------------------------------------ */}
      {/* 6.2 — Grille de statistiques (6 cartes)                            */}
      {/* ------------------------------------------------------------------ */}
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

      {/* ------------------------------------------------------------------ */}
      {/* 6.3 — Widgets de motivation (admin uniquement)                     */}
      {/* ------------------------------------------------------------------ */}
      {isAdmin && (
        <AdminMotivationWidgets
          stats={stats}
          paymentSummary={paymentSummary}
          attendance7d={attendance7d}
          latestMembers={latestMembers}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 6.4 — Liste des paiements du membre connecte (non-admin)           */}
      {/* ------------------------------------------------------------------ */}
      {user && !isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FaCreditCard className="text-blue-500" />
              Vos paiements
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {loading.payments
                ? "—"
                : userPayments?.length || 0}{" "}
              opération(s)
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

      {/* ------------------------------------------------------------------ */}
      {/* 6.5 — Graphique presences 7j + Derniers passages (admin)           */}
      {/* ------------------------------------------------------------------ */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

          {/* --- Graphique en barres : presences sur 7 jours --- */}
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
                {/* Echelle verticale */}
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

                {/* Barres */}
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

                    // Couleur selon le niveau de frequentation
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
                          style={{
                            height: `${Math.max(heightPercent, 2)}%`,
                          }}
                        >
                          {/* Tooltip au survol */}
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

          {/* --- Liste des derniers passages (Realtime) --- */}
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
                    typeof r.ts === "string"
                      ? parseISO(r.ts)
                      : new Date(r.ts);
                  const isBP = !r.badgeId;
                  const displayName = isBP
                    ? "BP (Sortie)"
                    : m
                      ? `${m.firstName || ""} ${m.name || ""}`.trim()
                      : `Badge ${r.badgeId}`;
                  const timeAgo = getTimeAgo(ts);

                  return (
                    <div
                      key={r.id}
                      className="group flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 rounded-lg transition-all duration-200 border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Avatar ou indicateur BP */}
                        <div
                          onClick={() => m && handleEditMember(m)}
                          className={`${m ? "cursor-pointer hover:opacity-75 hover:scale-105" : ""} transition-all`}
                          title={
                            isBP
                              ? "Bouton Poussoir"
                              : m
                                ? "Voir les détails du membre"
                                : "Membre inconnu"
                          }
                        >
                          {isBP ? (
                            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-sm">
                              BP
                            </div>
                          ) : (
                            <Avatar
                              photo={photosCache[m?.id] || null}
                              firstName={m?.firstName}
                              name={m?.name}
                              size={40}
                              onClick={
                                m ? () => handleEditMember(m) : undefined
                              }
                              title={
                                m
                                  ? "Voir les détails du membre"
                                  : "Membre inconnu"
                              }
                            />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {displayName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {isBP
                              ? "Bouton Poussoir • "
                              : m?.badgeId
                                ? `Badge ${m.badgeId} • `
                                : ""}
                            {timeAgo}
                          </div>
                        </div>
                      </div>

                      {/* Heure + date */}
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {format(ts, "HH:mm")}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {format(ts, "dd/MM")}
                        </div>
                      </div>

                      {/* Indicateur de recence (vert/jaune/gris) */}
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

      {/* ------------------------------------------------------------------ */}
      {/* 6.6 — Derniers badges attribues (admin)                            */}
      {/* ------------------------------------------------------------------ */}
      {isAdmin && (
        <div className="block w-full bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Derniers badges attribués
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
              {loading.latestMembers ? "—" : `${latestMembers.length} / 10`}
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
                      <div
                        onClick={() => handleEditMember(m)}
                        className="cursor-pointer hover:opacity-75 hover:scale-105 transition-all"
                        title="Voir les détails du membre"
                      >
                        <Avatar
                          photo={photosCache[m.id] || null}
                          firstName={m.firstName}
                          name={m.name}
                          size={40}
                          onClick={() => handleEditMember(m)}
                          title="Voir les détails du membre"
                        />
                      </div>
                      <div className="min-w-0">
                        <div
                          className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          onClick={() => handleEditMember(m)}
                        >
                          {displayName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {m.badge_number
                            ? `Badge ${m.badge_number}`
                            : `ID #${m.id}`}
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

      {/* ------------------------------------------------------------------ */}
      {/* 6.7 — Abonnements echus (admin)                                    */}
      {/* ------------------------------------------------------------------ */}
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

      {/* ------------------------------------------------------------------ */}
      {/* 6.8 — Modal d'edition d'un membre (mobile)                         */}
      {/* ------------------------------------------------------------------ */}
      {showForm && selectedMember && (
        <MemberForm
          member={selectedMember}
          onSave={handleSaveMember}
          onCancel={handleCloseForm}
        />
      )}
    </div>
  );
}

export default HomePage;
