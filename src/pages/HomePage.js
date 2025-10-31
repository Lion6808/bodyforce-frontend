// 📄 HomePage.js — OPTIMISÉ EGRESS (photos lazy-load)
// ✅ NOUVEAU : Clic sur membres pour ouvrir leur fiche détaillée (comme MembersPage)
// ✅ Optimisations :
//    - latestMembers : chargés SANS photo, puis lazy-load
//    - recentPresences : membres chargés SANS photo, puis lazy-load
//    - Cache photos pour éviter rechargements
//    - Utilisation du composant Avatar
//    - Clic sur membre → Modal MemberForm (mobile) ou Navigation (desktop)

import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import MemberForm from "../components/MemberForm";

// ====================================================
// SKELETONS / LOADERS
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
// Widgets de Motivation Admin
// ====================================================
const AdminMotivationWidgets = ({
  stats,
  paymentSummary,
  attendance7d,
  latestMembers,
}) => {
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
  };

  const motivationMessage = getMotivationalMessage();

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
                <div className="text-lg font-bold">
                  {attendance7d?.length
                    ? Math.round(
                        attendance7d.reduce(
                          (sum, d) => sum + (d.count || 0),
                          0
                        ) / attendance7d.length
                      )
                    : 0}
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="text-xs text-blue-100">Objectif</div>
                <div className="text-lg font-bold">
                  {Math.round(metrics.goalProgress)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {adminBadges.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminBadges.map((badge, idx) => (
            <div
              key={idx}
              className={`bg-gradient-to-br ${badge.color} rounded-xl p-4 text-white shadow-lg transform hover:scale-105 transition-transform`}
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">{badge.icon}</div>
                <div>
                  <div className="font-bold text-lg">{badge.name}</div>
                  <div className="text-sm opacity-90">{badge.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ====================================================
// COMPOSANT PRINCIPAL
// ====================================================
function HomePage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === "admin";

  // ✅ NOUVEAUX ÉTATS pour la gestion du modal (comme MembersPage)
  const [selectedMember, setSelectedMember] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    actifs: 0,
    expirés: 0,
    hommes: 0,
    femmes: 0,
    etudiants: 0,
    membresExpirés: [],
  });

  const [attendance7d, setAttendance7d] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [latestMembers, setLatestMembers] = useState([]);
  const [recentPresences, setRecentPresences] = useState([]);
  const [photosCache, setPhotosCache] = useState({});

  const [loading, setLoading] = useState({
    stats: true,
    attendance: true,
    payments: true,
    latestMembers: true,
    recentPresences: true,
  });

  const photosLoadingRef = useRef(false);

  // ✅ Détection mobile (comme MembersPage)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Chargement données
  useEffect(() => {
    if (isAdmin) {
      Promise.all([
        loadStats(),
        loadAttendance7d(),
        loadPaymentSummary(),
        loadLatestMembers(),
        loadRecentPresences(),
      ]);
    }
  }, [isAdmin]);

  // Lazy-load photos
  useEffect(() => {
    if (photosLoadingRef.current) return;

    const allMemberIds = [
      ...latestMembers.map((m) => m.id),
      ...recentPresences.map((p) => p.memberId).filter(Boolean),
    ];

    const uniqueIds = [...new Set(allMemberIds)];
    const missingIds = uniqueIds.filter((id) => !(id in photosCache));

    if (missingIds.length === 0) return;

    const loadPhotos = async () => {
      photosLoadingRef.current = true;
      try {
        const newPhotos =
          (await supabaseServices.getMemberPhotos(missingIds)) || {};
        const nextCache = { ...photosCache, ...newPhotos };

        for (const id of missingIds) {
          if (!(id in newPhotos)) nextCache[id] = null;
        }

        setPhotosCache(nextCache);
      } catch (err) {
        console.error("Erreur chargement photos:", err);
      } finally {
        photosLoadingRef.current = false;
      }
    };

    loadPhotos();
  }, [latestMembers, recentPresences, photosCache]);

  // ✅ NOUVELLE FONCTION : Gérer le clic sur un membre (comme MembersPage)
  const handleMemberClick = async (member) => {
    try {
      // Charger les données complètes du membre depuis la DB
      const fullMember = await supabaseServices.getMemberById(member.id);
      
      if (isMobile) {
        // Mode mobile : ouvrir le modal
        setSelectedMember(fullMember || member);
        setShowForm(true);
      } else {
        // Mode desktop : naviguer vers la page d'édition
        navigate("/members/edit", {
          state: { 
            member: fullMember || member, 
            returnPath: "/", 
            memberId: member.id 
          },
        });
      }
    } catch (error) {
      console.error("Erreur lors du chargement du membre:", error);
      // Fallback : utiliser les données partielles
      if (isMobile) {
        setSelectedMember(member);
        setShowForm(true);
      } else {
        navigate("/members/edit", {
          state: { member, returnPath: "/", memberId: member.id },
        });
      }
    }
  };

  // ✅ NOUVELLE FONCTION : Fermer le modal
  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedMember(null);
  };

  // ✅ NOUVELLE FONCTION : Refresh après sauvegarde
  const handleSaveMember = async () => {
    await Promise.all([
      loadStats(),
      loadLatestMembers(),
      loadRecentPresences(),
    ]);
  };

  // Fonctions de chargement
  const loadStats = async () => {
    try {
      setLoading((prev) => ({ ...prev, stats: true }));
      const members = await supabaseServices.getMembersWithoutPhotos();

      const now = new Date();
      const actifs = members.filter((m) => {
        if (!m.endDate) return false;
        try {
          return !isBefore(parseISO(m.endDate), now);
        } catch {
          return false;
        }
      });

      const expirés = members.filter((m) => {
        if (!m.endDate) return true;
        try {
          return isBefore(parseISO(m.endDate), now);
        } catch {
          return true;
        }
      });

      setStats({
        total: members.length,
        actifs: actifs.length,
        expirés: expirés.length,
        hommes: members.filter((m) => m.gender === "Homme").length,
        femmes: members.filter((m) => m.gender === "Femme").length,
        etudiants: members.filter((m) => m.etudiant).length,
        membresExpirés: expirés.slice(0, 10),
      });
    } catch (error) {
      console.error("Erreur chargement stats:", error);
    } finally {
      setLoading((prev) => ({ ...prev, stats: false }));
    }
  };

  const loadAttendance7d = async () => {
    try {
      setLoading((prev) => ({ ...prev, attendance: true }));
      const { data, error } = await supabase.rpc("get_daily_attendance_7d");
      if (error) throw error;
      setAttendance7d(data || []);
    } catch (error) {
      console.error("Erreur chargement présences 7j:", error);
    } finally {
      setLoading((prev) => ({ ...prev, attendance: false }));
    }
  };

  const loadPaymentSummary = async () => {
    try {
      setLoading((prev) => ({ ...prev, payments: true }));
      const { data, error } = await supabase.rpc("get_payment_summary");
      if (error) throw error;
      setPaymentSummary(data?.[0] || null);
    } catch (error) {
      console.error("Erreur chargement paiements:", error);
    } finally {
      setLoading((prev) => ({ ...prev, payments: false }));
    }
  };

  const loadLatestMembers = async () => {
    try {
      setLoading((prev) => ({ ...prev, latestMembers: true }));
      const members = await supabaseServices.getMembersWithoutPhotos();

      const now = new Date();
      const recentActive = members
        .filter((m) => {
          if (!m.endDate) return false;
          try {
            return !isBefore(parseISO(m.endDate), now);
          } catch {
            return false;
          }
        })
        .sort((a, b) => {
          const dateA = a.last_subscription_date
            ? new Date(a.last_subscription_date)
            : new Date(0);
          const dateB = b.last_subscription_date
            ? new Date(b.last_subscription_date)
            : new Date(0);
          return dateB - dateA;
        })
        .slice(0, 7);

      setLatestMembers(recentActive);
    } catch (error) {
      console.error("Erreur chargement derniers membres:", error);
    } finally {
      setLoading((prev) => ({ ...prev, latestMembers: false }));
    }
  };

  const loadRecentPresences = async () => {
    try {
      setLoading((prev) => ({ ...prev, recentPresences: true }));

      const { data: presences, error } = await supabase
        .from("presences")
        .select("id, badgeId, timestamp, members(id, firstName, name)")
        .order("timestamp", { ascending: false })
        .limit(10);

      if (error) throw error;

      const formatted = (presences || [])
        .map((p) => ({
          id: p.id,
          badgeId: p.badgeId,
          timestamp: p.timestamp,
          memberId: p.members?.id,
          firstName: p.members?.firstName,
          name: p.members?.name,
        }))
        .filter((p) => p.memberId);

      setRecentPresences(formatted);
    } catch (error) {
      console.error("Erreur chargement passages récents:", error);
    } finally {
      setLoading((prev) => ({ ...prev, recentPresences: false }));
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Bienvenue sur BodyForce
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Accédez à votre profil et vos présences depuis le menu.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <AdminMotivationWidgets
        stats={stats}
        paymentSummary={paymentSummary}
        attendance7d={attendance7d}
        latestMembers={latestMembers}
      />

      {/* Statistiques générales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
              icon={<FaUsers className="text-blue-500" />}
              label="Total"
              value={stats.total}
            />
            <StatCard
              icon={<FaUserCheck className="text-green-500" />}
              label="Actifs"
              value={stats.actifs}
            />
            <StatCard
              icon={<FaUserTimes className="text-red-500" />}
              label="Expirés"
              value={stats.expirés}
            />
            <StatCard
              icon={<FaMale className="text-blue-600" />}
              label="Hommes"
              value={stats.hommes}
            />
            <StatCard
              icon={<FaFemale className="text-pink-500" />}
              label="Femmes"
              value={stats.femmes}
            />
            <StatCard
              icon={<FaGraduationCap className="text-yellow-500" />}
              label="Étudiants"
              value={stats.etudiants}
            />
          </>
        )}
      </div>

      {/* ✅ SECTION MODIFIÉE : Derniers passages - MAINTENANT CLIQUABLE */}
      {isAdmin && recentPresences.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FaCreditCard className="text-blue-500" />
              Derniers passages
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
              {loading.recentPresences
                ? "—"
                : `${recentPresences.length} / 10`}
            </span>
          </div>

          <div className="space-y-1">
            {loading.recentPresences ? (
              <>
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
              </>
            ) : recentPresences.length > 0 ? (
              <div className="space-y-1">
                {recentPresences.map((presence, index) => {
                  const displayName =
                    `${presence.firstName || ""} ${presence.name || ""}`.trim() ||
                    `Badge #${presence.badgeId}`;
                  const timestamp = presence.timestamp
                    ? format(new Date(presence.timestamp), "HH:mm", {
                        locale: fr,
                      })
                    : "";

                  return (
                    <div
                      key={presence.id}
                      onClick={() => handleMemberClick({ id: presence.memberId, firstName: presence.firstName, name: presence.name })}
                      className="flex items-center justify-between p-3 rounded-lg border border-transparent cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-700 transition-all"
                      title="Cliquer pour voir la fiche du membre"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar
                          photo={photosCache[presence.memberId] || null}
                          firstName={presence.firstName}
                          name={presence.name}
                          size={40}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {displayName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Badge #{presence.badgeId}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {timestamp}
                        </div>
                        {index === 0 && (
                          <div className="flex items-center justify-end gap-1 mt-1">
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

      {/* ✅ SECTION MODIFIÉE : Derniers membres inscrits - MAINTENANT CLIQUABLE */}
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
                    onClick={() => handleMemberClick(m)}
                    className="py-3 flex items-center justify-between cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors px-2"
                    title="Cliquer pour voir la fiche du membre"
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

      {/* Abonnements échus */}
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

      {/* ✅ NOUVEAU : Modal MemberForm (mobile uniquement) */}
      {showForm && isMobile && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-start justify-center overflow-auto">
          <div className="bg-white dark:bg-gray-800 mt-4 mb-4 rounded-xl shadow-xl w-full max-w-4xl mx-4">
            <MemberForm
              member={selectedMember}
              onSave={async (memberData, closeModal) => {
                try {
                  console.log("💾 Sauvegarde membre depuis HomePage");

                  if (selectedMember?.id) {
                    await supabaseServices.updateMember(
                      selectedMember.id,
                      memberData
                    );
                    console.log("✅ Membre modifié:", selectedMember.id);
                  } else {
                    const newMember = await supabaseServices.createMember(
                      memberData
                    );
                    console.log("✅ Nouveau membre créé:", newMember.id);
                  }

                  if (closeModal) {
                    handleCloseForm();
                  }

                  await handleSaveMember();
                } catch (error) {
                  console.error("❌ Erreur sauvegarde membre:", error);
                  alert(`Erreur lors de la sauvegarde: ${error.message}`);
                }
              }}
              onCancel={handleCloseForm}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Composant StatCard
function StatCard({ icon, label, value }) {
  return (
    <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow">
      <div className="text-3xl mr-3">{icon}</div>
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-xl font-bold text-gray-900 dark:text-white">
          {value}
        </div>
      </div>
    </div>
  );
}

export default HomePage;