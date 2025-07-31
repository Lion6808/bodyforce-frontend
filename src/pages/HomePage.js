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
  FaExclamationTriangle
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
  const [showPayments, setShowPayments] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = role === 'admin';

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Début fetchData - User:', user?.email, 'Role:', role, 'IsAdmin:', isAdmin);

      // Récupérer les statistiques générales pour tous
      let members = [];
      try {
        const { stats: calculatedStats } = await supabaseServices.getStatistics();
        members = await supabaseServices.getMembers();
        console.log('✅ Membres récupérés:', members.length);
      } catch (statsError) {
        console.error('❌ Erreur récupération stats:', statsError);
        // Continuer même si les stats échouent
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
            // Gérer les différents formats de date
            if (typeof m.endDate === 'string') {
              if (m.endDate.includes('/')) {
                // Format DD/MM/YYYY
                const parts = m.endDate.split('/');
                end = new Date(parts[2], parts[1] - 1, parts[0]);
              } else {
                // Format ISO ou autre
                end = parseISO(m.endDate);
              }
            } else {
              end = new Date(m.endDate);
            }
          } else {
            end = null;
          }
        } catch (error) {
          console.warn('Erreur parsing date pour membre', m.id, ':', error);
          end = null;
        }

        // Statut d'abonnement
        if (end && isAfter(end, today)) {
          actifs++;
        } else {
          expirés++;
          membresExpirés.push({ 
            id: m.id,
            name: m.name, 
            firstName: m.firstName,
            endDate: m.endDate
          });
        }

        // Genre
        const genre = (m.gender || "").toLowerCase();
        if (genre === "homme" || genre === "h" || genre === "m") {
          hommes++;
        } else if (genre === "femme" || genre === "f") {
          femmes++;
        }

        // Statut étudiant
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
        membresExpirés 
      });

      // Récupérer les paiements en attente (admin seulement)
      if (isAdmin) {
        console.log('👑 Admin - Récupération des paiements en attente...');
        try {
          const payments = await supabaseServices.getPayments();
          const today_start = new Date();
          today_start.setHours(0, 0, 0, 0);
          
          const filtered = payments.filter(p => {
            // Paiements non encaissés OU avec encaissement futur
            return !p.is_paid || (p.encaissement_prevu && new Date(p.encaissement_prevu) >= today_start);
          });

          setPendingPayments(filtered);
          console.log('✅ Paiements en attente récupérés:', filtered.length);
        } catch (paymentsError) {
          console.error('❌ Erreur récupération paiements admin:', paymentsError);
        }
      }

      // Récupérer les données du membre connecté (utilisateur non-admin)
      if (!isAdmin && user) {
        console.log('👤 Utilisateur - Récupération des données membre...');
        try {
          // Récupérer les données du membre lié à cet utilisateur
          const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle(); // ✅ Utilise maybeSingle() au lieu de single()

          if (memberError) {
            console.error('❌ Erreur récupération membre:', memberError);
            throw memberError;
          }

          if (memberData) {
            console.log('✅ Données membre trouvées:', memberData.firstName, memberData.name);
            setUserMemberData(memberData);
            
            // Récupérer les paiements de ce membre
            const { data: paymentsData, error: paymentsError } = await supabase
              .from('payments')
              .select('*')
              .eq('member_id', memberData.id)
              .order('created_at', { ascending: false });

            if (paymentsError) {
              console.error('❌ Erreur récupération paiements utilisateur:', paymentsError);
            } else {
              console.log('✅ Paiements utilisateur récupérés:', paymentsData?.length || 0);
              setUserPayments(paymentsData || []);
            }
          } else {
            console.log('⚠️ Aucun profil membre trouvé pour cet utilisateur');
            setUserMemberData(null);
            setUserPayments([]);
          }
        } catch (userError) {
          console.error('❌ Erreur récupération données utilisateur:', userError);
          // Ne pas faire échouer toute la page pour cette erreur
          setUserMemberData(null);
          setUserPayments([]);
        }
      }

      console.log('✅ fetchData terminé avec succès');

    } catch (err) {
      console.error("❌ Erreur générale chargement données:", err);
      setError(`Erreur lors du chargement: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Effect avec dépendances optimisées
  useEffect(() => {
    // Attendre que l'authentification soit terminée
    if (authLoading) {
      console.log('⏳ En attente de l\'authentification...');
      return;
    }

    if (!user) {
      console.log('❌ Pas d\'utilisateur connecté');
      setLoading(false);
      return;
    }

    console.log('🚀 Lancement fetchData - User:', user.email, 'Role:', role);
    fetchData();
  }, [user, role, authLoading]); // ✅ Ajout de authLoading

  // Calculer les statistiques de paiement pour l'utilisateur
  const getUserPaymentStats = () => {
    if (!userPayments.length) return { total: 0, paid: 0, pending: 0, percentage: 0 };

    const total = userPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const paid = userPayments.filter(p => p.is_paid).reduce((sum, p) => sum + (p.amount || 0), 0);
    const pending = total - paid;
    const percentage = total > 0 ? (paid / total) * 100 : 0;

    return { total, paid, pending, percentage };
  };

  const paymentStats = getUserPaymentStats();

  const cardStyle = "p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl dark:hover:shadow-2xl transition-all duration-500 flex items-center gap-4 border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-600 hover:scale-105";

  // Loading state - tenir compte du loading auth aussi
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-300">
            {authLoading ? 'Authentification...' : 'Chargement des statistiques...'}
          </p>
        </div>
      </div>
    );
  }

  // Pas d'utilisateur connecté
  if (!user) {
    return (
      <div className="text-center p-8 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
        <div className="text-amber-600 dark:text-amber-400 mb-4">⚠️ Non connecté</div>
        <p className="text-slate-700 dark:text-slate-300">Vous devez être connecté pour accéder à cette page.</p>
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            {isAdmin ? 'Tableau de bord - Club BodyForce' : 'Mon espace membre'}
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-2">
            {isAdmin ? 'Vue d\'ensemble des statistiques du club' : `Bienvenue ${userMemberData?.firstName || 'Membre'}`}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-6 py-3 rounded-xl transition-all duration-300 inline-flex items-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-xl"
        >
          <FaSync className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {/* Total des membres - visible par tous */}
        <div className={cardStyle}>
          <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white">
            <FaUsers className="text-3xl" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400">Total membres</h2>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
          </div>
        </div>

        {/* Cards visibles uniquement pour les admins */}
        {isAdmin && (
          <>
            {/* Inscriptions actives */}
            <div className={cardStyle}>
              <div className="p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl text-white">
                <FaUserCheck className="text-3xl" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">Abonnements actifs</h2>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.actifs}</p>
              </div>
            </div>

            {/* Abonnements expirés */}
            <div className={cardStyle}>
              <div className="p-4 bg-gradient-to-br from-red-500 to-red-600 rounded-xl text-white">
                <FaUserTimes className="text-3xl" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Abonnements échus</h2>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.expirés}</p>
                {stats.membresExpirés.length > 0 && (
                  <div className="mt-2 max-h-24 overflow-y-auto">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mb-1">Membres concernés :</p>
                    <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-300 space-y-1">
                      {stats.membresExpirés.slice(0, 3).map((m) => (
                        <li key={m.id} className="truncate">
                          {m.firstName} {m.name}
                          {m.endDate && (
                            <span className="text-xs text-red-500 dark:text-red-400 ml-1">
                              (exp. {typeof m.endDate === 'string' ? m.endDate : format(new Date(m.endDate), 'dd/MM/yyyy')})
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

            {/* Paiements en attente - Admin seulement */}
            <div className={`${cardStyle} sm:col-span-2`}>
              <div className="p-4 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl text-white">
                <FaMoneyCheckAlt className="text-3xl" />
              </div>
              <div className="w-full">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-amber-600 dark:text-amber-400">Paiements en attente</h2>
                  <button
                    onClick={() => setShowPayments(!showPayments)}
                    className="text-sm text-blue-500 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    {showPayments ? "Masquer" : "Voir détails"}
                  </button>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{pendingPayments.length}</p>

                {showPayments && pendingPayments.length > 0 && (
                  <div className="mt-3">
                    <div className="max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
                      <ul className="space-y-2 text-sm">
                        {pendingPayments.map((p) => {
                          const isOverdue = p.encaissement_prevu && 
                                           new Date(p.encaissement_prevu) <= new Date();
                          
                          return (
                            <li key={p.id} className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-600 last:border-b-0">
                              <div>
                                <span className="font-medium text-slate-900 dark:text-white">
                                  {p.member?.firstName} {p.member?.name}
                                </span>
                                <span className="ml-2 text-amber-700 dark:text-amber-400 font-semibold">
                                  {(p.amount || 0).toFixed(2)} €
                                </span>
                                <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                                  ({p.method})
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {!p.is_paid && (
                                  <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs px-2 py-1 rounded-full">
                                    Non encaissé
                                  </span>
                                )}
                                {p.encaissement_prevu && (
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    isOverdue 
                                      ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300" 
                                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                                  }`}>
                                    {format(new Date(p.encaissement_prevu), "dd/MM/yyyy")}
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    
                    {/* Résumé des paiements */}
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-600">
                      <div className="flex justify-between">
                        <span>Total à encaisser :</span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">
                          {pendingPayments
                            .filter(p => !p.is_paid)
                            .reduce((sum, p) => sum + (p.amount || 0), 0)
                            .toFixed(2)} €
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Paiements en retard :</span>
                        <span className="font-bold text-red-600 dark:text-red-400">
                          {pendingPayments.filter(p => 
                            !p.is_paid && p.encaissement_prevu && new Date(p.encaissement_prevu) <= new Date()
                          ).length}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {showPayments && pendingPayments.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 italic">
                    Aucun paiement en attente
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tuile Mes Paiements - visible uniquement pour les utilisateurs non-admin */}
        {!isAdmin && (
          <div className={`${cardStyle} sm:col-span-2 lg:col-span-3`}>
            <div className="p-4 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl text-white">
              <FaCreditCard className="text-3xl" />
            </div>
            <div className="w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-blue-600 dark:text-blue-400">Mes Paiements</h2>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {paymentStats.paid.toFixed(2)} € / {paymentStats.total.toFixed(2)} €
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {userPayments.filter(p => p.is_paid).length} / {userPayments.length} paiements
                  </div>
                </div>
              </div>

              {/* Barre de progression */}
              <div className="mb-4">
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

              {/* Détails des paiements récents */}
              {userPayments.length > 0 ? (
                <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                  <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-3">Derniers paiements</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {userPayments.slice(0, 4).map((payment) => (
                      <div key={payment.id} className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-600 last:border-b-0">
                        <div className="flex items-center gap-3">
                          {payment.is_paid ? (
                            <FaCheckCircle className="text-emerald-500 text-sm" />
                          ) : payment.encaissement_prevu && new Date(payment.encaissement_prevu) <= new Date() ? (
                            <FaExclamationTriangle className="text-red-500 text-sm" />
                          ) : (
                            <FaClock className="text-amber-500 text-sm" />
                          )}
                          <div>
                            <div className="font-medium text-sm text-slate-900 dark:text-white">
                              {(payment.amount || 0).toFixed(2)} € - {payment.method || 'Non défini'}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {payment.created_at && format(new Date(payment.created_at), 'dd/MM/yyyy')}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            payment.is_paid 
                              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"
                              : payment.encaissement_prevu && new Date(payment.encaissement_prevu) <= new Date()
                              ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                              : "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                          }`}>
                            {payment.is_paid ? 'Payé' : 'En attente'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : userMemberData ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <FaCreditCard className="text-4xl mx-auto mb-2 opacity-50" />
                  <p>Aucun paiement enregistré</p>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <FaExclamationTriangle className="text-4xl mx-auto mb-2 opacity-50" />
                  <p>Profil membre non trouvé</p>
                  <p className="text-xs mt-1">Contactez un administrateur</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hommes */}
        <div className={cardStyle}>
          <div className="p-4 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl text-white">
            <FaMale className="text-3xl" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-sky-600 dark:text-sky-400">Hommes</h2>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.hommes}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {stats.total > 0 ? Math.round((stats.hommes / stats.total) * 100) : 0}%
            </p>
          </div>
        </div>

        {/* Femmes */}
        <div className={cardStyle}>
          <div className="p-4 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl text-white">
            <FaFemale className="text-3xl" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-rose-600 dark:text-rose-400">Femmes</h2>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.femmes}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {stats.total > 0 ? Math.round((stats.femmes / stats.total) * 100) : 0}%
            </p>
          </div>
        </div>

        {/* Étudiants */}
        <div className={cardStyle}>
          <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white">
            <FaGraduationCap className="text-3xl" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">Étudiants</h2>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.etudiants}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {stats.total > 0 ? Math.round((stats.etudiants / stats.total) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Section informations système */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-lg">
        <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
          📊 Informations système
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">✓</div>
            <div className="text-slate-600 dark:text-slate-400 font-medium">Base Supabase</div>
          </div>
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
            <div className="text-slate-600 dark:text-slate-400 font-medium">Membres total</div>
          </div>
          <div className="text-center p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl">
            <div className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
              {Math.round((stats.actifs / Math.max(stats.total, 1)) * 100)}%
            </div>
            <div className="text-slate-600 dark:text-slate-400 font-medium">Taux d'activité</div>
          </div>
          <div className="text-center p-4 bg-sky-50 dark:bg-sky-900/20 rounded-xl">
            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              {new Date().toLocaleDateString('fr-FR')}
            </div>
            <div className="text-slate-600 dark:text-slate-400 font-medium">Dernière MAJ</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;