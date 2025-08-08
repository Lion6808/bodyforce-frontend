// 📄 HomePage.js — Page d'accueil — Dossier : src/pages — Date : 2025-08-08
// 🎯 Fusion : Logique d'origine conservée (supabaseServices) + améliorations visuelles et responsive
//    - Mode sombre Tailwind (`dark:`)
//    - Widgets modernisés (couleurs, ombres)
//    - Affichage "et N autres" pour abonnements échus
//    - Bloc paiements à venir (badge rouge si échéance dépassée/aujourd'hui)
//    - Commentaires convertis en commentaires JSX (ne s'affichent plus)

import React, { useEffect, useState } from "react";
import { isToday, isBefore, parseISO, format } from "date-fns";
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
  FaExclamationTriangle,
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Stats via services internes (logique d'origine)
        const { stats: calculatedStats } = await supabaseServices.getStatistics();
        setStats(calculatedStats || { ...stats, membresExpirés: [] });

        // Paiements / profils selon rôle
        if (role === "admin") {
          const payments = await supabaseServices.getPayments();
          const filtered = (payments || []).filter((p) => !p.is_paid);
          setPendingPayments(filtered);
        } else if (role === "user" && user) {
          // Associer compte à membre (comme avant)
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
          } else {
            setUserMemberData(null);
            setUserPayments([]);
          }
        }
      } catch (e) {
        console.error("HomePage fetch error:", e);
      }
    };

    fetchData();
  }, [role, user]);

  // ===== Composant Widget (UI simple + dark mode)
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

  // ===== Helpers dates
  const isLateOrToday = (ts) => {
    if (!ts) return false;
    try {
      const d = typeof ts === "string" ? parseISO(ts) : ts;
      return isToday(d) || isBefore(d, new Date());
    } catch {
      return false;
    }
  };

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900 min-h-screen transition-colors duration-300">
      {/* 🔹 Partie 1 — Widgets statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={FaUsers} label="Total Membres" value={stats.total} color="bg-blue-500" />
        <StatCard icon={FaUserCheck} label="Actifs" value={stats.actifs} color="bg-green-500" />
        <StatCard icon={FaUserTimes} label="Expirés" value={stats.expirés} color="bg-red-500" />
        <StatCard icon={FaMale} label="Hommes" value={stats.hommes} color="bg-indigo-500" />
        <StatCard icon={FaFemale} label="Femmes" value={stats.femmes} color="bg-pink-500" />
        <StatCard icon={FaGraduationCap} label="Étudiants" value={stats.etudiants} color="bg-yellow-500" />
      </div>

      {/* 🔹 Partie 2 — Listes détaillées : abonnements échus & paiements à venir */}

      {/* Abonnements échus — visible aux admins même si vide */}
      {role === "admin" && (
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
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  et {stats.membresExpirés.length - 5} autres…
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Aucun abonnement échu
            </div>
          )}
        </div>
      )}

      {/* Paiements à venir — visible aux admins même si vide */}
      {role === "admin" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Paiements à venir
          </h2>

          {pendingPayments?.length > 0 ? (
            <ul className="space-y-2">
              {pendingPayments.map((p) => {
                const late = isLateOrToday(p.encaissement_prevu);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between text-gray-700 dark:text-gray-300"
                  >
                    <span className="truncate">
                      {(p.member?.firstName && p.member?.name)
                        ? `${p.member.firstName} ${p.member.name}`
                        : `Membre #${p.member_id}`}{" "}
                      — {(p.amount || 0).toFixed(2)} € {p.method ? `(${p.method})` : ""}
                    </span>
                    {p.encaissement_prevu && (
                      <span
                        className={`text-xs px-2 py-1 rounded ml-3 whitespace-nowrap ${
                          late
                            ? "bg-red-500 text-white"
                            : "bg-amber-500 text-white"
                        }`}
                        title={`Échéance: ${format(parseISO(p.encaissement_prevu), "dd/MM/yyyy")}`}
                      >
                        {format(parseISO(p.encaissement_prevu), "dd/MM/yyyy")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Aucun paiement en attente
            </div>
          )}
        </div>
      )}

      {/* Mes paiements — pour l'utilisateur connecté (on conserve le comportement d'origine) */}
      {role === "user" && userPayments?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Mes paiements
          </h2>
          <ul className="space-y-2">
            {userPayments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between text-gray-700 dark:text-gray-300"
              >
                <span className="truncate">
                  {payment.date_paiement
                    ? format(parseISO(payment.date_paiement), "dd/MM/yyyy")
                    : "Date n/d"}{" "}
                  — {(payment.amount || 0).toFixed(2)} € {payment.method ? `(${payment.method})` : ""}
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
