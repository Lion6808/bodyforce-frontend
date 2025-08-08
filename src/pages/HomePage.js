// 📄 HomePage.js — Page d'accueil — Dossier : src/pages — Date : 2025-08-08
// 🎯 Fusion : Logique d'origine conservée (supabaseServices), + améliorations visuelles et responsive
//    - Mode sombre Tailwind (`dark:`)
//    - Widgets modernisés (couleurs, ombres)
//    - Affichage "et N autres" pour abonnements échus
//    - Bloc paiements à venir avec badge rouge si échéance dépassée ou aujourd'hui

// 🔹 Partie 1 — Importations & Setup

import React, { useEffect, useState } from "react";
import { isAfter, parseISO, format, isToday, isBefore } from "date-fns";
import {
  FaUsers,
  FaUserCheck,
  FaUserTimes,
  FaMale,
  FaFemale,
  FaMoneyCheckAlt,
  FaGraduationCap,
  FaCreditCard,
  FaClock,
  FaExclamationTriangle
} from "react-icons/fa";

import { supabaseServices, supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";

function HomePage() {
  const { user, role } = useAuth();

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

  // ✅ Chargement des données à l'arrivée
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Récupération stats & membres via services internes
        const { stats: calculatedStats } = await supabaseServices.getStatistics();
        setStats(calculatedStats);

        const members = await supabaseServices.getMembers();

        // Paiements selon rôle utilisateur
        if (role === "admin") {
          const payments = await supabaseServices.getPayments();
          const filtered = payments.filter(
            (p) => !p.is_paid || p.is_paid === false
          );
          setPendingPayments(filtered);
        } else if (role === "user" && user) {
          // Associer compte à membre
          const { data: memberData } = await supabase
            .from("members")
            .select("*")
            .eq("email", user.email)
            .single();

          if (memberData) {
            setUserMemberData(memberData);

            const { data: memberPayments } = await supabase
              .from("payments")
              .select("*")
              .eq("member_id", memberData.id)
              .order("date_paiement", { ascending: false });

            setUserPayments(memberPayments || []);
          }
        }
      } catch (error) {
        console.error("Erreur récupération HomePage :", error);
      }
    };

    fetchData();
  }, [role, user]);

// 🔹 Partie 2 — Widgets Statistiques (UI améliorée)

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-colors duration-200">
      <div className={`p-3 rounded-full ${color} text-white`}>
        <Icon size={24} />
      </div>
      <div className="ml-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900 min-h-screen transition-colors duration-300">
      {/* Widgets statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={FaUsers} label="Total Membres" value={stats.total} color="bg-blue-500" />
        <StatCard icon={FaUserCheck} label="Actifs" value={stats.actifs} color="bg-green-500" />
        <StatCard icon={FaUserTimes} label="Expirés" value={stats.expirés} color="bg-red-500" />
        <StatCard icon={FaMale} label="Hommes" value={stats.hommes} color="bg-indigo-500" />
        <StatCard icon={FaFemale} label="Femmes" value={stats.femmes} color="bg-pink-500" />
        <StatCard icon={FaGraduationCap} label="Étudiants" value={stats.etudiants} color="bg-yellow-500" />
      </div>
// 🔹 Partie 3 — Listes détaillées : abonnements échus & paiements à venir

      {/* Bloc abonnements échus */}
      {role === "admin" && stats.membresExpirés && stats.membresExpirés.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Abonnements échus
          </h2>
          <ul className="space-y-2">
            {stats.membresExpirés.slice(0, 5).map((membre, idx) => (
              <li key={idx} className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                <span>{membre.firstName} {membre.name}</span>
                <FaExclamationTriangle className="text-red-500" />
              </li>
            ))}
            {stats.membresExpirés.length > 5 && (
              <li className="text-sm text-gray-500 dark:text-gray-400">
                et {stats.membresExpirés.length - 5} autres…
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Bloc paiements à venir */}
      {role === "admin" && pendingPayments && pendingPayments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Paiements à venir
          </h2>
          <ul className="space-y-2">
            {pendingPayments.map((payment) => {
              const isLate = payment.encaissement_prevu &&
                (isToday(parseISO(payment.encaissement_prevu)) || isBefore(parseISO(payment.encaissement_prevu), new Date()));

              return (
                <li key={payment.id} className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                  <span>
                    {payment.member_name || `Membre #${payment.member_id}`} — {payment.amount} €
                  </span>
                  {isLate && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                      Échéance dépassée
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Bloc paiements pour l'utilisateur connecté */}
      {role === "user" && userPayments && userPayments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Mes paiements
          </h2>
          <ul className="space-y-2">
            {userPayments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                <span>
                  {format(parseISO(payment.date_paiement), "dd/MM/yyyy")} — {payment.amount} €
                </span>
                {payment.is_paid ? (
                  <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">
                    Payé
                  </span>
                ) : (
                  <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded">
                    En attente
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default HomePage;

// ✅ FIN DU FICHIER
