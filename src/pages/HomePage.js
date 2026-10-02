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

import { useEffect, useState, useRef, useCallback } from "react";
import { parseISO, format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  FaCreditCard,
  FaExclamationTriangle,
  FaArrowRight,
  FaBell,
  FaChartBar,
} from "react-icons/fa";
import { isMaintenance, MemberTypeTag } from "../utils/memberTypes";
import ActiveMembersSummary from "../components/ActiveMembersSummary";
import MembersOverview from "../components/MembersOverview";
import { SkeletonPulse, SkeletonListItem } from "../components/home/HomeSkeletons";
import { AdminMotivationWidgets } from "../components/home/AdminMotivationWidgets";

const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY || "BFm-sjydQw6LfYtniSytrr9K7WU_WHzgWvj95tw7YWfchRokgQXjTwbETOWrlSJhXe9c5ohTr0Z_d4hm2JADVec";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import { supabaseServices, supabase } from "../supabaseClient";
import { keyboardClickable } from "../utils/a11y";
import { useAuth } from "../contexts/AuthContext";
import Avatar from "../components/Avatar";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

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
// SECTION 5 — Composant principal HomePage
// =============================================================================

function HomePage() {
  const { user, role, userMemberData: memberCtx } = useAuth();
  const isAdmin = (role || "").toLowerCase() === "admin";
  const navigate = useNavigate();

  // ---------------------------------------------------------------------------
  // 5.1 — State
  // ---------------------------------------------------------------------------

  // Push notifications
  const [pushStatus, setPushStatus]   = useState("loading");
  const [pushLoading, setPushLoading] = useState(false);

  const memberId = memberCtx?.id ?? null;

  const checkPushStatus = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC_KEY) {
      setPushStatus("unsupported"); return;
    }
    if (Notification.permission === "denied") { setPushStatus("denied"); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushStatus(sub ? "active" : "inactive");
    } catch { setPushStatus("inactive"); }
  }, []);

  useEffect(() => { checkPushStatus(); }, [checkPushStatus]);

  const handleActivatePush = async () => {
    if (!memberId || !user?.id) return;
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setPushStatus("denied"); return; }
      const reg = await navigator.serviceWorker.ready;

      // Désinscrire toute subscription existante pour éviter les conflits
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const appKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appKey,
      });
      const { endpoint, keys } = sub.toJSON();
      const { error: supaErr } = await supabase
        .from("push_subscriptions")
        .upsert(
          { member_id: memberId, user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
          { onConflict: "endpoint" }
        );
      if (supaErr) throw supaErr;
      setPushStatus("active");
    } catch (err) {
      if (err.name === "AbortError") {
        toast.error("Activation impossible. Sur Brave : brave://settings/privacy → activer 'Use Google services for push messaging'. Sinon, utilise l'appli mobile.", { autoClose: 8000 });
      } else {
        console.error("Push activation:", err);
      }
    } finally {
      setPushLoading(false);
    }
  };

  const handleDeactivatePush = async () => {
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setPushStatus("inactive");
    } catch (err) {
      console.error("Push deactivation:", err);
    } finally {
      setPushLoading(false);
    }
  };

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

  /** Ouvre la fiche d'un membre (meme page sur mobile et desktop) */
  const handleEditMember = (member) => {
    if (!member || !member.id) return;
    navigate("/members/edit", {
      state: { member, returnPath: "/", memberId: member.id },
    });
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

        // Comptage par jour cote serveur (hors maintenance, 'Residents', sorties BP)
        // et 10 derniers passages (journal : maintenance etiquetee, sorties BP exclues)
        const [dailyCounts, recentRes] = await Promise.all([
          supabaseServices.getAttendanceByDay(
            start.toISOString(),
            end.toISOString()
          ),
          supabase
            .from("presences")
            .select("id,badgeId,timestamp")
            .gte("timestamp", start.toISOString())
            .lte("timestamp", end.toISOString())
            .not("badgeId", "is", null)
            .neq("badgeId", "")
            .order("timestamp", { ascending: false })
            .limit(10),
        ]);

        if (recentRes.error) {
          console.error("Error loading presences:", recentRes.error);
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

        (dailyCounts || []).forEach((row) => {
          if (countsByKey[row.day] !== undefined) {
            countsByKey[row.day] = Number(row.count) || 0;
          }
        });

        setAttendance7d(
          days.map((d) => ({
            date: d.date,
            count: countsByKey[key(d.date)] || 0,
          }))
        );

        // 10 derniers passages avec resolution des membres (sans photo)
        const recent = recentRes.data || [];
        const badgeIds = Array.from(
          new Set(recent.map((r) => r.badgeId).filter(Boolean))
        );
        let membersByBadge = {};

        if (badgeIds.length > 0) {
          const { data: membersData, error: mErr } = await supabase
            .from("members")
            .select("id, firstName, name, badgeId, member_type")
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
              .neq("member_type", "maintenance")
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
          .not("badgeId", "is", null)
          .neq("badgeId", "")
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
            .select("id, firstName, name, badgeId, member_type")
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

          {/* Zone haute : identité + infos */}
          <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
            {/* Photo ou initiales */}
            <div className="relative flex-shrink-0">
              {memberPhoto ? (
                <img
                  src={memberPhoto}
                  alt={memberDisplayName}
                  width="160"
                  height="160"
                  className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover shadow-xl ring-4 ring-white dark:ring-gray-700 cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-200"
                  decoding="async"
                  fetchPriority="high"
                  {...keyboardClickable(() => memberCtx && handleEditMember(memberCtx))}
                  title="Voir ma fiche"
                />
              ) : (
                <div
                  className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-xl ring-4 ring-white dark:ring-gray-700 cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-200"
                  {...keyboardClickable(() => memberCtx && handleEditMember(memberCtx))}
                  title="Voir ma fiche"
                >
                  {getInitials(memberFirstName, memberLastName)}
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-400/90 blur-sm" />
            </div>

            {/* Texte de bienvenue + pills infos */}
            <div className="text-center md:text-left flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
                Bonjour{memberFirstName ? `, ${memberFirstName}` : ""} 👋
              </h1>
              <p className="mt-1 text-sm md:text-base text-gray-600 dark:text-gray-300">
                Heureux de vous revoir sur votre espace. Retrouvez ici vos
                dernières informations.
              </p>

              {/* Pills d'info uniquement */}
              <div className="mt-3 flex flex-wrap items-center gap-2 justify-center md:justify-start">
                {memberCtx?.badgeId && (
                  <span
                    className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 underline underline-offset-2 decoration-dotted cursor-pointer hover:bg-indigo-500/25 transition-colors"
                    onClick={() => memberCtx && handleEditMember(memberCtx)}
                    title="Voir ma fiche"
                  >
                    Badge {memberCtx.badgeId}
                  </span>
                )}
                {isAdmin && memberCtx?.badgeId && (
                  <>
                    {adminPersonalStats.currentStreak > 0 && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-700 dark:text-orange-300">
                        🔥 {adminPersonalStats.currentStreak} jour{adminPersonalStats.currentStreak > 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/15 text-purple-700 dark:text-purple-300">
                      📊 Niveau {adminPersonalStats.level}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-700 dark:text-blue-300">
                      🎯 {adminPersonalStats.monthVisits}/{adminPersonalStats.monthlyGoal} ce mois
                    </span>
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

          {/* Zone basse : actions */}
          {(memberId || (isAdmin && memberCtx?.badgeId)) && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-6 md:px-8 py-3 flex items-center justify-center md:justify-between gap-3 flex-wrap">
              {memberCtx?.badgeId && (
                <a
                  href="/my-attendances"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors shadow-sm"
                >
                  <FaChartBar className="text-xs" />
                  Voir mes stats
                </a>
              )}

              {/* Toggle rappels push */}
              {memberId && pushStatus !== "loading" && (
                <div className="flex items-center gap-2 md:ml-auto">
                  {pushStatus === "active" && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Rappels actifs
                    </span>
                  )}
                  {pushStatus === "inactive" && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Rappels désactivés
                    </span>
                  )}
                  <button
                    onClick={pushStatus === "active" ? handleDeactivatePush : handleActivatePush}
                    disabled={pushLoading}
                    title={pushStatus === "active" ? "Désactiver les rappels" : "Activer les rappels"}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 ${
                      pushStatus === "active"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-indigo-500/15 hover:text-indigo-600 dark:hover:text-indigo-400"
                    }`}
                  >
                    <FaBell className="text-sm" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 6.2 — Widgets statistiques groupés                                 */}
      {/* ------------------------------------------------------------------ */}
      {user && (
        loading.stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 animate-pulse">
              <SkeletonPulse className="h-6 w-32 mb-4 rounded" />
              <SkeletonPulse className="h-10 w-20 mb-4 rounded" />
              <div className="grid grid-cols-2 gap-3">
                <SkeletonPulse className="h-20 rounded-2xl" />
                <SkeletonPulse className="h-20 rounded-2xl" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 animate-pulse">
              <SkeletonPulse className="h-6 w-32 mb-4 rounded" />
              <div className="grid grid-cols-3 gap-3">
                <SkeletonPulse className="h-20 rounded-2xl" />
                <SkeletonPulse className="h-20 rounded-2xl" />
                <SkeletonPulse className="h-20 rounded-2xl" />
              </div>
            </div>
          </div>
        ) : (
          <MembersOverview
            className="mb-8"
            stats={{
              total: stats.total,
              actifs: stats.actifs,
              expires: stats.expirés,
              hommes: stats.hommes,
              femmes: stats.femmes,
              etudiants: stats.etudiants,
            }}
          />
        )
      )}

      {/* Synthèse des adhérents actifs (H / F / étudiants H / étudiantes F) */}
      {user && !loading.stats && stats.synthese && (
        <ActiveMembersSummary {...stats.synthese} />
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
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm p-6 mb-8 border border-gray-100 dark:border-gray-700">
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
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
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
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={attendance7d.map((d) => ({
                      ...d,
                      dayName: format(d.date, "EEE", { locale: fr }).substring(0, 3),
                      isWeekend: d.date.getDay() === 0 || d.date.getDay() === 6,
                    }))}
                    margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                  >
                    <XAxis
                      dataKey="dayName"
                      tick={{ fontSize: 12, fill: "#9CA3AF" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#9CA3AF" }}
                      axisLine={false}
                      tickLine={false}
                      width={35}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1F2937",
                        border: "none",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                      formatter={(value) => [`${value} passages`, "Total"]}
                      labelFormatter={(label) => `${label}`}
                      cursor={{ fill: "rgba(59, 130, 246, 0.1)" }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={50}>
                      {attendance7d.map((entry, index) => {
                        const maxCount = Math.max(...attendance7d.map((d) => d.count), 1);
                        const color =
                          entry.count > maxCount * 0.7
                            ? "#10B981"
                            : entry.count > maxCount * 0.4
                              ? "#06B6D4"
                              : "#6366F1";
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
                <div className="text-sm">Aucune présence</div>
              </div>
            )}
          </div>

          {/* --- Liste des derniers passages (Realtime) --- */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Derniers passages
              </h2>
              <div className="flex items-center gap-2">
                {!loading.presences && recentPresences.length > 0 && (
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {recentPresences.length} récents
                  </span>
                )}
                <a
                  href="/planning"
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  Voir tout
                  <FaArrowRight className="text-[10px]" />
                </a>
              </div>
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
                          {...(m ? keyboardClickable(() => handleEditMember(m)) : {})}
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
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {displayName}
                            </span>
                            {isMaintenance(m) && (
                              <MemberTypeTag type="maintenance" className="flex-shrink-0" />
                            )}
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
        <div className="block w-full bg-white dark:bg-gray-800 rounded-3xl shadow-sm p-6 mb-8 border border-gray-100 dark:border-gray-700">
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
                        {...keyboardClickable(() => handleEditMember(m))}
                        className="cursor-pointer hover:opacity-75 hover:scale-105 transition-all"
                        title="Voir les détails du membre"
                      >
                        <Avatar
                          photo={photosCache[m.id] || null}
                          firstName={m.firstName}
                          name={m.name}
                          size={40}
                        />
                      </div>
                      <div className="min-w-0">
                        <div
                          className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          {...keyboardClickable(() => handleEditMember(m))}
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
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm p-6 mb-8 border border-gray-100 dark:border-gray-700">
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
