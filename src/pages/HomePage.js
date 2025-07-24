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
  FaSync
} from "react-icons/fa";

import { supabaseServices } from "../supabaseClient";

function HomePage() {
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
  const [showPayments, setShowPayments] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer les données depuis Supabase
      const { stats: calculatedStats } = await supabaseServices.getStatistics();
      
      // Récupérer les membres pour calculs supplémentaires
      const members = await supabaseServices.getMembers();
      
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
        if (genre === "homme" || genre === "h") {
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

      // Récupérer les paiements en attente
      const payments = await supabaseServices.getPayments();
      const today_start = new Date();
      today_start.setHours(0, 0, 0, 0);
      
      const filtered = payments.filter(p => {
        // Paiements non encaissés OU avec encaissement futur
        return !p.is_paid || (p.encaissement_prevu && new Date(p.encaissement_prevu) >= today_start);
      });

      setPendingPayments(filtered);

    } catch (err) {
      console.error("Erreur chargement données:", err);
      setError(`Erreur lors du chargement: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const cardStyle = "p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl dark:hover:shadow-2xl transition-shadow duration-300 flex items-center gap-4 border border-gray-100 dark:border-gray-700";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
        <div className="text-red-600 dark:text-red-400 mb-4">⚠️ Erreur</div>
        <p className="text-gray-700 dark:text-gray-300 mb-4">{error}</p>
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">Tableau de bord - Club BodyForce</h1>
        <button
          onClick={fetchData}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-2 disabled:opacity-50"
        >
          <FaSync className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Total des membres */}
        <div className={cardStyle}>
          <FaUsers className="text-4xl text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400">Total membres</h2>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
          </div>
        </div>

        {/* Inscriptions actives */}
        <div className={cardStyle}>
          <FaUserCheck className="text-4xl text-green-600 dark:text-green-400" />
          <div>
            <h2 className="text-lg font-semibold text-green-600 dark:text-green-400">Abonnements actifs</h2>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.actifs}</p>
          </div>
        </div>

        {/* Abonnements expirés */}
        <div className={cardStyle}>
          <FaUserTimes className="text-4xl text-red-600 dark:text-red-400" />
          <div>
            <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Abonnements échus</h2>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.expirés}</p>
            {stats.membresExpirés.length > 0 && (
              <div className="mt-2 max-h-24 overflow-y-auto">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-1">Membres concernés :</p>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
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
                    <li className="italic text-gray-500 dark:text-gray-400 text-xs">
                      et {stats.membresExpirés.length - 3} autre(s)...
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Hommes */}
        <div className={cardStyle}>
          <FaMale className="text-4xl text-blue-500 dark:text-blue-400" />
          <div>
            <h2 className="text-lg font-semibold text-blue-500 dark:text-blue-400">Hommes</h2>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.hommes}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stats.total > 0 ? Math.round((stats.hommes / stats.total) * 100) : 0}%
            </p>
          </div>
        </div>

        {/* Femmes */}
        <div className={cardStyle}>
          <FaFemale className="text-4xl text-pink-500 dark:text-pink-400" />
          <div>
            <h2 className="text-lg font-semibold text-pink-500 dark:text-pink-400">Femmes</h2>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.femmes}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stats.total > 0 ? Math.round((stats.femmes / stats.total) * 100) : 0}%
            </p>
          </div>
        </div>

        {/* Étudiants */}
        <div className={cardStyle}>
          <FaGraduationCap className="text-4xl text-purple-500 dark:text-purple-400" />
          <div>
            <h2 className="text-lg font-semibold text-purple-500 dark:text-purple-400">Étudiants</h2>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.etudiants}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stats.total > 0 ? Math.round((stats.etudiants / stats.total) * 100) : 0}%
            </p>
          </div>
        </div>

        {/* Paiements en attente */}
        <div className={`${cardStyle} sm:col-span-2`}>
          <FaMoneyCheckAlt className="text-4xl text-yellow-600 dark:text-yellow-400" />
          <div className="w-full">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">Paiements en attente</h2>
              <button
                onClick={() => setShowPayments(!showPayments)}
                className="text-sm text-blue-500 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                {showPayments ? "Masquer" : "Voir détails"}
              </button>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{pendingPayments.length}</p>

            {showPayments && pendingPayments.length > 0 && (
              <div className="mt-3">
                <div className="max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <ul className="space-y-2 text-sm">
                    {pendingPayments.map((p) => {
                      const isOverdue = p.encaissement_prevu && 
                                       new Date(p.encaissement_prevu) <= new Date();
                      
                      return (
                        <li key={p.id} className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-600 last:border-b-0">
                          <div>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {p.member?.firstName} {p.member?.name}
                            </span>
                            <span className="ml-2 text-yellow-700 dark:text-yellow-400 font-semibold">
                              {p.amount.toFixed(2)} €
                            </span>
                            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
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
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between">
                    <span>Total à encaisser :</span>
                    <span className="font-bold text-yellow-700 dark:text-yellow-400">
                      {pendingPayments
                        .filter(p => !p.is_paid)
                        .reduce((sum, p) => sum + p.amount, 0)
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
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 italic">
                Aucun paiement en attente
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section informations système */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          📊 Informations système
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">✓</div>
            <div className="text-gray-600 dark:text-gray-400">Base Supabase</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
            <div className="text-gray-600 dark:text-gray-400">Membres total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {Math.round((stats.actifs / Math.max(stats.total, 1)) * 100)}%
            </div>
            <div className="text-gray-600 dark:text-gray-400">Taux d'activité</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {new Date().toLocaleDateString('fr-FR')}
            </div>
            <div className="text-gray-600 dark:text-gray-400">Dernière MAJ</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;