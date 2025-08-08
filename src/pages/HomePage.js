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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedPayments, setExpandedPayments] = useState(false);

  const togglePayments = () => {
    setExpandedPayments(!expandedPayments);
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await supabaseServices.getStatistics();
        if (data) {
          setStats(data);
        }
        // Paiements à venir
        const { data: paymentsData } = await supabase
          .from("payments")
          .select("*")
          .eq("status", "pending")
          .order("dueDate", { ascending: true });
        if (paymentsData) {
          setPendingPayments(paymentsData);
        }
        // Paiements de l'utilisateur connecté
        if (user) {
          const { data: memberData } = await supabase
            .from("members")
            .select("*")
            .eq("email", user.email)
            .single();
          if (memberData) {
            setUserMemberData(memberData);
            const { data: userPay } = await supabase
              .from("payments")
              .select("*")
              .eq("memberId", memberData.id);
            if (userPay) {
              setUserPayments(userPay);
            }
          }
        }
      } catch (err) {
        console.error("Erreur de récupération des stats :", err);
        setError("Impossible de charger les statistiques.");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user]);
  // ===== Utilitaires =====
  const isOverdue = (dateStr) => {
    if (!dateStr) return false;
    const d = typeof dateStr === "string" ? parseISO(dateStr) : dateStr;
    const today = new Date();
    // on compare à minuit local pour le badge rouge "aujourd'hui ou passé"
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return target.getTime() <= todayMidnight.getTime();
  };

  const formatDateFR = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = typeof dateStr === "string" ? parseISO(dateStr) : dateStr;
      return format(d, "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  // ===== Mini composant interne pour les widgets (inline pour respecter la charte) =====
  function StatCard({ icon: Icon, label, value, accent = "from-blue-500 to-cyan-500" }) {
    return (
      <div
        className="
          relative overflow-hidden rounded-2xl border bg-white shadow-sm
          border-gray-200
          dark:bg-neutral-900 dark:border-neutral-800
          focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500
          transition
        "
      >
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div
              className={`
                inline-flex h-10 w-10 items-center justify-center rounded-xl
                bg-gradient-to-br ${accent} text-white
                dark:opacity-95
              `}
              aria-hidden="true"
            >
              <Icon className="text-lg" />
            </div>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {value}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  // ===== Rendu =====
  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-gray-700 dark:text-gray-200">
        Chargement des statistiques…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="
          p-4 sm:p-6 lg:p-8 text-red-700 bg-red-50 border border-red-200 rounded-xl
          dark:bg-red-900/20 dark:text-red-300 dark:border-red-800
        "
        role="alert"
      >
        {error}
      </div>
    );
  }

  // Calcul "et N autres" pour abonnements échus
  const expirés = stats?.membresExpirés ?? [];
  const top5Expirés = expirés.slice(0, 5);
  const resteExpirés = Math.max(0, expirés.length - top5Expirés.length);

  return (
    <div
      className="
        p-4 sm:p-6 lg:p-8
        bg-gray-50 text-gray-900
        dark:bg-neutral-950 dark:text-gray-100
      "
    >
      {/* ===== En-tête simple ===== */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Bonjour{user?.email ? `, ${user.email}` : ""} — voici l’activité du club.
        </p>
      </div>

      {/* ===== Widgets Statistiques ===== */}
      <div
        className="
          grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 mb-8
        "
        aria-live="polite"
      >
        <StatCard icon={FaUsers} label="Membres" value={stats.total ?? 0} />
        <StatCard icon={FaUserCheck} label="Actifs" value={stats.actifs ?? 0} accent="from-emerald-500 to-green-500" />
        <StatCard icon={FaUserTimes} label="Expirés" value={stats.expirés ?? 0} accent="from-rose-500 to-red-500" />
        <StatCard icon={FaMale} label="Hommes" value={stats.hommes ?? 0} accent="from-indigo-500 to-blue-600" />
        <StatCard icon={FaFemale} label="Femmes" value={stats.femmes ?? 0} accent="from-fuchsia-500 to-pink-500" />
        <StatCard icon={FaGraduationCap} label="Étudiants" value={stats.etudiants ?? 0} accent="from-amber-500 to-yellow-500" />
      </div>

      {/* ===== Deux colonnes : Abonnements échus / Paiements à venir ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- Abonnements échus --- */}
        <section
          className="
            rounded-2xl border bg-white shadow-sm
            border-gray-200
            dark:bg-neutral-900 dark:border-neutral-800
          "
          aria-labelledby="expired-title"
        >
          <header className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <FaExclamationTriangle className="text-red-500" aria-hidden="true" />
              <h2 id="expired-title" className="font-semibold">Abonnements échus</h2>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {stats.expirés ?? 0} au total
            </span>
          </header>

          <div className="px-4 py-4 sm:px-5">
            {top5Expirés.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Aucun abonnement arrivé à échéance récemment.
              </div>
            ) : (
              <ul className="space-y-2">
                {top5Expirés.map((m, idx) => (
                  <li
                    key={m.id ?? idx}
                    className="
                      flex items-center justify-between gap-3 rounded-xl
                      border border-gray-200 bg-gray-50 px-3 py-2
                      dark:bg-neutral-800 dark:border-neutral-700
                    "
                  >
                    <span className="text-sm">
                      {m.lastName || m.name || "Membre"} {m.firstName ? ` ${m.firstName}` : ""}
                    </span>
                    <span
                      className="
                        inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-xs
                        border-red-200 text-red-700 bg-red-50
                        dark:bg-red-900/20 dark:text-red-300 dark:border-red-800
                      "
                      title={m.endDate ? `Fin: ${formatDateFR(m.endDate)}` : ""}
                    >
                      <FaClock aria-hidden="true" />
                      {m.endDate ? formatDateFR(m.endDate) : "Date inconnue"}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {resteExpirés > 0 && (
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                … et <strong>{resteExpirés}</strong> autres.
              </div>
            )}
          </div>
        </section>

        {/* --- Paiements à venir --- */}
        <section
          className="
            rounded-2xl border bg-white shadow-sm
            border-gray-200
            dark:bg-neutral-900 dark:border-neutral-800
          "
          aria-labelledby="payments-title"
        >
          <header className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <FaCreditCard className="text-blue-500" aria-hidden="true" />
              <h2 id="payments-title" className="font-semibold">Paiements à venir / non encaissés</h2>
            </div>

            <button
              type="button"
              onClick={togglePayments}
              className="
                inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm
                border-gray-300 text-gray-700 bg-white
                hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                dark:bg-neutral-900 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-800
              "
              aria-expanded={expandedPayments}
            >
              <FaSync className={expandedPayments ? "rotate-180 transition" : "transition"} aria-hidden="true" />
              {expandedPayments ? "Replier" : "Dérouler"}
            </button>
          </header>

          <div className="px-4 py-4 sm:px-5">
            {pendingPayments?.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">Aucun paiement en attente.</div>
            ) : (
              <div
                className={`
                  overflow-hidden transition-[max-height,opacity]
                  ${expandedPayments ? "max-h-[640px] opacity-100" : "max-h-20 opacity-100"}
                `}
              >
                <ul className="space-y-2">
                  {pendingPayments.slice(0, expandedPayments ? pendingPayments.length : 3).map((p, idx) => {
                    const overdue = isOverdue(p.dueDate);
                    return (
                      <li
                        key={p.id ?? idx}
                        className="
                          flex items-center justify-between gap-3 rounded-xl
                          border border-gray-200 bg-gray-50 px-3 py-2
                          dark:bg-neutral-800 dark:border-neutral-700
                        "
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {p.memberName || p.memberFullName || `Membre #${p.memberId ?? "?"}`}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {p.method ? `Mode: ${p.method}` : "Mode: n/d"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{p.amount ? `${p.amount} €` : "n/d"}</span>
                          <span
                            className={`
                              inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-xs
                              ${overdue
                                ? "border-red-200 text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                                : "border-amber-200 text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"}
                            `}
                            title={p.dueDate ? `Échéance: ${formatDateFR(p.dueDate)}` : ""}
                          >
                            <FaClock aria-hidden="true" />
                            {p.dueDate ? formatDateFR(p.dueDate) : "Date n/d"}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {pendingPayments?.length > 3 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={togglePayments}
                  className="
                    inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm
                    border-gray-300 text-gray-700 bg-white
                    hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                    dark:bg-neutral-900 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-800
                  "
                  aria-expanded={expandedPayments}
                >
                  {expandedPayments ? "Afficher moins" : `Afficher plus (${pendingPayments.length - 3})`}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ===== Paiements de l'utilisateur connecté (facultatif) ===== */}
      {user && userPayments?.length > 0 && (
        <section
          className="
            mt-6 rounded-2xl border bg-white shadow-sm
            border-gray-200
            dark:bg-neutral-900 dark:border-neutral-800
          "
          aria-labelledby="my-payments-title"
        >
          <header className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <FaMoneyCheckAlt className="text-emerald-500" aria-hidden="true" />
              <h2 id="my-payments-title" className="font-semibold">Mes paiements</h2>
            </div>
            {userMemberData?.subscriptionType && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Abonnement: {userMemberData.subscriptionType}
              </span>
            )}
          </header>

          <div className="px-4 py-4 sm:px-5">
            <ul className="space-y-2">
              {userPayments.map((p, idx) => (
                <li
                  key={p.id ?? idx}
                  className="
                    flex items-center justify-between gap-3 rounded-xl
                    border border-gray-200 bg-gray-50 px-3 py-2
                    dark:bg-neutral-800 dark:border-neutral-700
                  "
                >
                  <div className="text-sm">
                    {p.label || "Paiement"}
                    <span className="mx-2 text-gray-500 dark:text-gray-400">•</span>
                    {p.amount ? `${p.amount} €` : "Montant n/d"}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {p.dueDate ? `Échéance: ${formatDateFR(p.dueDate)}` : "Échéance n/d"}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

export default HomePage;
