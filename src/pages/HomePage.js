import React, { useEffect, useState } from "react";
import { isAfter, parseISO, format } from "date-fns";
import {
  FaUsers,
  FaUserCheck,
  FaUserTimes,
  FaMale,
  FaFemale,
  FaMoneyCheckAlt,
  FaGraduationCap,
  FaSync,
  FaCreditCard,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaUser,
  FaCalendarCheck,
  FaChartLine,
  FaUserPlus,
} from "react-icons/fa";

import { supabaseServices, supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";

function HomePage() {
  const { user, role, loading: authLoading } = useAuth();
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
  const [userMemberData, setUserMemberData] = useState(null);
  const [userPresences, setUserPresences] = useState([]);
  const [showPayments, setShowPayments] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = role === "admin";

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(
        "🔄 Début fetchData - User:",
        user?.email,
        "Role:",
        role,
        "IsAdmin:",
        isAdmin
      );

      // Récupérer les statistiques générales pour tous
      let members = [];
      try {
        const { stats: calculatedStats } =
          await supabaseServices.getStatistics();
        members = await supabaseServices.getMembers();
        console.log("✅ Membres récupérés:", members.length);
      } catch (statsError) {
        console.error("❌ Erreur récupération stats:", statsError);
      }

      const today = new Date();
      let actifs = 0;
      let expirés = 0;
      let hommes = 0;
      let femmes = 0;
      let etudiants = 0;
      let membresExpirés = [];

      members.forEach((m) => {
        let end;
        try {
          if (m.endDate) {
            if (typeof m.endDate === "string") {
              if (m.endDate.includes("/")) {
                const parts = m.endDate.split("/");
                end = new Date(parts[2], parts[1] - 1, parts[0]);
              } else {
                end = parseISO(m.endDate);
              }
            } else {
              end = new Date(m.endDate);
            }
          } else {
            end = null;
          }
        } catch (error) {
          console.warn("Erreur parsing date pour membre", m.id, ":", error);
          end = null;
        }

        if (end && isAfter(end, today)) {
          actifs++;
        } else {
          expirés++;
          membresExpirés.push({
            id: m.id,
            name: m.name,
            firstName: m.firstName,
            endDate: m.endDate,
          });
        }

        const genre = (m.gender || "").toLowerCase();
        if (genre === "homme" || genre === "h" || genre === "m") {
          hommes++;
        } else if (genre === "femme" || genre === "f") {
          femmes++;
        }

        if (m.etudiant) {
          etudiants++;
        }
      });

      setStats({
        total: members.length,
        actifs,
        expirés,
        hommes,
        femmes,
        etudiants,
        membresExpirés,
      });

      // Récupérer les paiements en attente (admin seulement)
      if (isAdmin) {
        console.log("👑 Admin - Récupération des paiements en attente...");
        try {
          const payments = await supabaseServices.getPayments();
          const today_start = new Date();
          today_start.setHours(0, 0, 0, 0);

          const filtered = payments.filter((p) => {
            return (
              !p.is_paid ||
              (p.encaissement_prevu &&
                new Date(p.encaissement_prevu) >= today_start)
            );
          });

          setPendingPayments(filtered);
          console.log("✅ Paiements en attente récupérés:", filtered.length);
        } catch (paymentsError) {
          console.error(
            "❌ Erreur récupération paiements admin:",
            paymentsError
          );
        }
      }

      // Récupérer les données du membre connecté (utilisateur non-admin)
      if (!isAdmin && user) {
        console.log("👤 Utilisateur - Récupération des données membre...");
        try {
          const { data: memberData, error: memberError } = await supabase
            .from("members")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();

          if (memberError) {
            console.error("❌ Erreur récupération membre:", memberError);
            throw memberError;
          }

          if (memberData) {
            console.log(
              "✅ Données membre trouvées:",
              memberData.firstName,
              memberData.name
            );
            setUserMemberData(memberData);

            // Récupérer les paiements de ce membre
            const { data: paymentsData, error: paymentsError } = await supabase
              .from("payments")
              .select("*")
              .eq("member_id", memberData.id)
              .order("date_paiement", { ascending: false });

            if (paymentsError) {
              console.error(
                "❌ Erreur récupération paiements utilisateur:",
                paymentsError
              );
            } else {
              console.log(
                "✅ Paiements utilisateur récupérés:",
                paymentsData?.length || 0
              );
              setUserPayments(paymentsData || []);
            }

            // Récupérer les présences récentes du membre - CORRIGÉ
            try {
              console.log(
                "🔍 Recherche présences pour membre:",
                memberData.id,
                "Badge:",
                memberData.badgeId
              );

              // ✅ CORRECTION : Utiliser badgeId comme dans PlanningPage
              const { data: presencesData, error: presencesError } =
                await supabase
                  .from("presences")
                  .select("*")
                  .eq("badgeId", memberData.badgeId) // ✅ Utiliser badgeId au lieu de member_id
                  .order("timestamp", { ascending: false }) // ✅ Utiliser timestamp au lieu de date
                  .limit(50); // ✅ Plus de données pour être sûr

              if (presencesError) {
                console.error(
                  "❌ Erreur récupération présences:",
                  presencesError
                );
                setUserPresences([]);
              } else {
                console.log(
                  "✅ Présences brutes récupérées:",
                  presencesData?.length || 0
                );

                // ✅ CORRECTION : Transformer les données comme dans PlanningPage
                const transformedPresences = (presencesData || []).map((p) => ({
                  id: p.id,
                  badgeId: p.badgeId,
                  timestamp: p.timestamp,
                  parsedDate: new Date(p.timestamp), // Parser la date
                  date: new Date(p.timestamp).toISOString().split("T")[0], // Format YYYY-MM-DD
                }));

                console.log(
                  "✅ Présences transformées:",
                  transformedPresences.length
                );
                setUserPresences(transformedPresences);
              }
            } catch (presencesError) {
              console.error("❌ Erreur présences:", presencesError);
              setUserPresences([]);
            }
          } else {
            console.log("⚠️ Aucun profil membre trouvé pour cet utilisateur");
            setUserMemberData(null);
            setUserPayments([]);
            setUserPresences([]);
          }
        } catch (userError) {
          console.error(
            "❌ Erreur récupération données utilisateur:",
            userError
          );
          setUserMemberData(null);
          setUserPayments([]);
          setUserPresences([]);
        }
      }

      console.log("✅ fetchData terminé avec succès");
    } catch (err) {
      console.error("❌ Erreur générale chargement données:", err);
      setError(`Erreur lors du chargement: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) {
      console.log("⏳ En attente de l'authentification...");
      return;
    }

    if (!user) {
      console.log("❌ Pas d'utilisateur connecté");
      setLoading(false);
      return;
    }

    console.log("🚀 Lancement fetchData - User:", user.email, "Role:", role);
    fetchData();
  }, [user, role, authLoading]);

  // Calculer les statistiques de paiement pour l'utilisateur
  const getUserPaymentStats = () => {
    if (!userPayments.length)
      return { total: 0, paid: 0, pending: 0, percentage: 0 };

    const total = userPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const paid = userPayments
      .filter((p) => p.is_paid)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const pending = total - paid;
    const percentage = total > 0 ? (paid / total) * 100 : 0;

    return { total, paid, pending, percentage };
  };

  // Calculer les statistiques de présence - CORRIGÉ
  const getUserPresenceStats = () => {
    if (!userPresences.length)
      return { thisMonth: 0, lastVisit: null, totalVisits: 0 };

    console.log(
      "🔍 Calcul stats présences:",
      userPresences.length,
      "présences trouvées"
    );

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // ✅ CORRECTION : Utiliser parsedDate au lieu de date
    const thisMonth = userPresences.filter((p) => {
      const presenceDate = p.parsedDate || new Date(p.timestamp);
      const isThisMonth = presenceDate >= thisMonthStart && presenceDate <= now;
      console.log(
        "📅 Présence:",
        presenceDate.toLocaleDateString(),
        "Ce mois?",
        isThisMonth
      );
      return isThisMonth;
    }).length;

    // ✅ Dernière visite = la plus récente (index 0 car trié par timestamp desc)
    const lastVisit =
      userPresences.length > 0
        ? userPresences[0].parsedDate || new Date(userPresences[0].timestamp)
        : null;

    const totalVisits = userPresences.length;

    console.log("📊 Stats calculées:", {
      thisMonth,
      totalVisits,
      lastVisit: lastVisit?.toLocaleDateString(),
    });

    return { thisMonth, lastVisit, totalVisits };
  };

  const paymentStats = getUserPaymentStats();
  const presenceStats = getUserPresenceStats();

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-300">
            {authLoading
              ? "Authentification..."
              : "Chargement des statistiques..."}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center p-8 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
        <div className="text-amber-600 dark:text-amber-400 mb-4">
          ⚠️ Non connecté
        </div>
        <p className="text-slate-700 dark:text-slate-300">
          Vous devez être connecté pour accéder à cette page.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
        <div className="text-red-600 dark:text-red-400 mb-4">⚠️ Erreur</div>
        <p className="text-slate-700 dark:text-slate-300 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <FaSync />
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 min-h-screen">
      {/* Header avec photo du membre */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Photo du membre pour utilisateurs non-admin */}
          { userMemberData && (
            <div className="flex-shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                {userMemberData.photo ? (
                  <img
                    src={userMemberData.photo}
                    alt="Photo de profil"
                    className="w-14 h-14 sm:w-18 sm:h-18 rounded-full object-cover"
                  />
                ) : (
                  <FaUser className="text-white text-2xl sm:text-3xl" />
                )}
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              {isAdmin
                ? "Tableau de bord - Club BodyForce"
                : "Mon espace membre"}
            </h1>
            <p className="text-slate-600 dark:text-slate-300 mt-2 break-words">
              {isAdmin
                ? "Vue d'ensemble des statistiques du club"
                : `Bienvenue ${userMemberData?.firstName || "Membre"}`}
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-6 py-3 rounded-xl transition-all duration-300 inline-flex items-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-xl flex-shrink-0"
        >
          <FaSync className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Actualiser</span>
        </button>
      </div>

      {/* Section présences utilisateur (non-admin seulement) */}
      {!isAdmin && userMemberData && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-700">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start space-x-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-xl flex-shrink-0">
                <FaCalendarCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Mes présences
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {presenceStats.thisMonth}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">
                Ce mois
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {presenceStats.totalVisits}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                Total visites
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {presenceStats.lastVisit
                  ? format(presenceStats.lastVisit, "dd/MM/yyyy")
                  : "Aucune"}
              </div>
              <div className="text-sm text-purple-700 dark:text-purple-300">
                Dernière visite
              </div>
            </div>
          </div>

          {userPresences.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
              <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-3">
                Dernières visites
              </h4>
              <div className="space-y-2">
                {userPresences.slice(0, 5).map((presence, index) => (
                  <div
                    key={presence.id || index}
                    className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-600 last:border-b-0"
                  >
                    <span className="text-sm text-slate-900 dark:text-white">
                      {/* ✅ CORRECTION : Utiliser parsedDate ou timestamp */}
                      {format(
                        presence.parsedDate || new Date(presence.timestamp),
                        "dd/MM/yyyy 'à' HH:mm"
                      )}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Badge: {presence.badgeId}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tuile Mes Paiements - utilisateur non-admin - CORRIGÉE */}
      {!isAdmin && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-700">
          {/* Header avec icône en haut */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start space-x-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex-shrink-0">
                <FaCreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                Mes Paiements
              </h3>
            </div>
            <div className="text-right">
              <div className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
                {paymentStats.paid.toFixed(2)} € /{" "}
                {paymentStats.total.toFixed(2)} €
              </div>
              <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {userPayments.filter((p) => p.is_paid).length} /{" "}
                {userPayments.length} paiements effectués
              </div>
            </div>
          </div>

          {/* Contenu principal utilise toute la largeur */}
          <div className="w-full space-y-4">
            {/* Barre de progression */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Progression Globale
                </span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {paymentStats.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${paymentStats.percentage}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>{paymentStats.paid.toFixed(2)} € reçus</span>
                <span>{paymentStats.pending.toFixed(2)} € attendus</span>
              </div>
            </div>

            {/* Détails des paiements */}
            {userPayments.length > 0 ? (
              <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Derniers paiements
                </h4>
                <div className="space-y-3">
                  {userPayments.slice(0, 4).map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600 last:border-b-0"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-shrink-0">
                          {payment.is_paid ? (
                            <FaCheckCircle className="text-emerald-500 text-sm" />
                          ) : payment.encaissement_prevu &&
                            new Date(payment.encaissement_prevu) <=
                              new Date() ? (
                            <FaExclamationTriangle className="text-red-500 text-sm" />
                          ) : (
                            <FaClock className="text-amber-500 text-sm" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm text-slate-900 dark:text-white">
                            {(payment.amount || 0).toFixed(2)} € -{" "}
                            {payment.method || "Non défini"}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {payment.created_at
                              ? format(
                                  new Date(payment.created_at),
                                  "dd/MM/yyyy"
                                )
                              : payment.date_paiement
                              ? format(
                                  new Date(payment.date_paiement),
                                  "dd/MM/yyyy"
                                )
                              : "Date inconnue"}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                          payment.is_paid
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"
                            : "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                        }`}
                      >
                        {payment.is_paid ? "Payé" : "En attente"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Résumé total */}
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-600">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Total des paiements :
                    </span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {paymentStats.total.toFixed(2)} €
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 dark:text-slate-400">
                      Reste à payer :
                    </span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {paymentStats.pending.toFixed(2)} €
                    </span>
                  </div>
                </div>
              </div>
            ) : userMemberData ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <FaCreditCard className="text-4xl mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucun paiement enregistré</p>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <FaExclamationTriangle className="text-4xl mx-auto mb-2 opacity-50" />
                <p className="text-sm">Profil membre non trouvé</p>
                <p className="text-xs mt-1">Contactez un administrateur</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Statistiques du club (pour tous) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Total des membres - visible par tous */}
        <div className="p-4 sm:p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 flex items-start gap-3 sm:gap-4 border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-600 hover:scale-105">
          <div className="p-3 sm:p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white flex-shrink-0">
            <FaUsers className="text-2xl sm:text-3xl" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-lg font-semibold text-blue-600 dark:text-blue-400">
              Total membres
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {stats.total}
            </p>
          </div>
        </div>

        {/* Cards admin seulement */}
        {isAdmin && (
          <>
            {/* Inscriptions actives */}
            <div className="p-4 sm:p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 flex items-start gap-3 sm:gap-4 border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-600 hover:scale-105">
              <div className="p-3 sm:p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl text-white flex-shrink-0">
                <FaUserCheck className="text-2xl sm:text-3xl" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  Abonnements actifs
                </h2>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                  {stats.actifs}
                </p>
              </div>
            </div>

            {/* Abonnements expirés */}
            <div className="p-4 sm:p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 flex items-start gap-3 sm:gap-4 border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-600 hover:scale-105 col-span-1 sm:col-span-2">
              <div className="p-3 sm:p-4 bg-gradient-to-br from-red-500 to-red-600 rounded-xl text-white flex-shrink-0">
                <FaUserTimes className="text-2xl sm:text-3xl" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-lg font-semibold text-red-600 dark:text-red-400">
                  Abonnements échus
                </h2>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                  {stats.expirés}
                </p>
                {stats.membresExpirés.length > 0 && (
                  <div className="max-h-24 overflow-y-auto">
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mb-1">
                      Membres concernés :
                    </p>
                    <ul className="list-disc list-inside text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-1">
                      {stats.membresExpirés.slice(0, 3).map((m) => (
                        <li key={m.id} className="break-words">
                          <span>
                            {m.firstName} {m.name}
                          </span>
                          {m.endDate && (
                            <span className="text-xs text-red-500 dark:text-red-400 ml-1 block sm:inline">
                              (exp.{" "}
                              {typeof m.endDate === "string"
                                ? m.endDate
                                : format(new Date(m.endDate), "dd/MM/yyyy")}
                              )
                            </span>
                          )}
                        </li>
                      ))}
                      {stats.membresExpirés.length > 3 && (
                        <li className="italic text-slate-500 dark:text-slate-400 text-xs">
                          et {stats.membresExpirés.length - 3} autre(s)...
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Paiements en attente - Admin seulement - CORRIGÉ */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-700 col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4">
              {/* Header avec icône en haut */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-xl flex-shrink-0">
                    <FaMoneyCheckAlt className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-amber-600 dark:text-amber-400">
                    Paiements en attente
                  </h3>
                </div>
                <button
                  onClick={() => setShowPayments(!showPayments)}
                  className="text-sm text-blue-500 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex-shrink-0"
                >
                  {showPayments ? "Masquer" : "Voir détails"}
                </button>
              </div>

              <p className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                {pendingPayments.length}
              </p>

              {/* Contenu principal utilise toute la largeur */}
              {showPayments && pendingPayments.length > 0 && (
                <div className="w-full space-y-4">
                  <div className="max-h-60 overflow-y-auto bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                    <div className="space-y-3">
                      {pendingPayments.map((p) => {
                        const isOverdue =
                          p.encaissement_prevu &&
                          new Date(p.encaissement_prevu) <= new Date();

                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-slate-600 last:border-b-0"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-slate-900 dark:text-white">
                                {p.member?.firstName} {p.member?.name}
                              </div>
                              <div className="flex items-center gap-3 text-sm">
                                <span className="text-amber-700 dark:text-amber-400 font-semibold">
                                  {(p.amount || 0).toFixed(2)} €
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">
                                  ({p.method})
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {!p.is_paid && (
                                <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs px-2 py-1 rounded-full">
                                  Non encaissé
                                </span>
                              )}
                              {p.encaissement_prevu && (
                                <span
                                  className={`text-xs px-2 py-1 rounded-full ${
                                    isOverdue
                                      ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                                  }`}
                                >
                                  {format(
                                    new Date(p.encaissement_prevu),
                                    "dd/MM/yyyy"
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Résumé des paiements */}
                  <div className="bg-white dark:bg-slate-800 p-4 rounded border border-slate-200 dark:border-slate-600">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">
                          Total à encaisser :
                        </span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">
                          {pendingPayments
                            .filter((p) => !p.is_paid)
                            .reduce((sum, p) => sum + (p.amount || 0), 0)
                            .toFixed(2)}{" "}
                          €
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">
                          Paiements en retard :
                        </span>
                        <span className="font-bold text-red-600 dark:text-red-400">
                          {
                            pendingPayments.filter(
                              (p) =>
                                !p.is_paid &&
                                p.encaissement_prevu &&
                                new Date(p.encaissement_prevu) <= new Date()
                            ).length
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showPayments && pendingPayments.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                  Aucun paiement en attente
                </p>
              )}
            </div>
          </>
        )}

        {/* Répartition Hommes/Femmes/Étudiants */}
        <div className="p-4 sm:p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 flex items-start gap-3 sm:gap-4 border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-600 hover:scale-105">
          <div className="p-3 sm:p-4 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl text-white flex-shrink-0">
            <FaMale className="text-2xl sm:text-3xl" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-lg font-semibold text-sky-600 dark:text-sky-400">
              Hommes
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {stats.hommes}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {stats.total > 0
                ? Math.round((stats.hommes / stats.total) * 100)
                : 0}
              %
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 flex items-start gap-3 sm:gap-4 border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-600 hover:scale-105">
          <div className="p-3 sm:p-4 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl text-white flex-shrink-0">
            <FaFemale className="text-2xl sm:text-3xl" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-lg font-semibold text-rose-600 dark:text-rose-400">
              Femmes
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {stats.femmes}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {stats.total > 0
                ? Math.round((stats.femmes / stats.total) * 100)
                : 0}
              %
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 flex items-start gap-3 sm:gap-4 border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-600 hover:scale-105">
          <div className="p-3 sm:p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white flex-shrink-0">
            <FaGraduationCap className="text-2xl sm:text-3xl" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-lg font-semibold text-indigo-600 dark:text-indigo-400">
              Étudiants
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {stats.etudiants}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {stats.total > 0
                ? Math.round((stats.etudiants / stats.total) * 100)
                : 0}
              %
            </p>
          </div>
        </div>
      </div>

      {/* Section informations système */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-lg">
        <h3 className="text-lg sm:text-xl font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
          📊 Informations système
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-sm">
          <div className="text-center p-3 sm:p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
            <div className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              ✓
            </div>
            <div className="text-slate-600 dark:text-slate-400 font-medium text-xs sm:text-sm mt-1">
              Base Supabase
            </div>
          </div>
          <div className="text-center p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
              {stats.total}
            </div>
            <div className="text-slate-600 dark:text-slate-400 font-medium text-xs sm:text-sm mt-1">
              Membres total
            </div>
          </div>
          <div className="text-center p-3 sm:p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl">
            <div className="text-2xl sm:text-3xl font-bold text-cyan-600 dark:text-cyan-400">
              {Math.round((stats.actifs / Math.max(stats.total, 1)) * 100)}%
            </div>
            <div className="text-slate-600 dark:text-slate-400 font-medium text-xs sm:text-sm mt-1">
              Taux d'activité
            </div>
          </div>
          <div className="text-center p-3 sm:p-4 bg-sky-50 dark:bg-sky-900/20 rounded-xl">
            <div className="text-base sm:text-2xl font-bold text-sky-600 dark:text-sky-400 break-words">
              {new Date().toLocaleDateString("fr-FR")}
            </div>
            <div className="text-slate-600 dark:text-slate-400 font-medium text-xs sm:text-sm mt-1">
              Dernière MAJ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
