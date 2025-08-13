// 📄 HomePage.js — Page d'accueil — Dossier : src/pages — Date : 2025-08-13
// 🎯 Ajouts (ADMIN uniquement) :
//    1) Widget "État global des paiements" (anneau de progression)
//    2) Mini-graph "Présences — 7 derniers jours" (bar chart sans dépendance)
//    3) "Derniers passages" (nom, photo, date/heure) à partir de la table `presences` (liaison par `badgeId`)
//
// ⚙️ Hypothèses structure:
//    - Table `presences`: { id, badgeId, timestamp }
//    - Table `members`: { id, firstName, name, photo, badgeId }
//    - Liaison par `badgeId` (déjà utilisée ailleurs dans le projet)
//
// 🌓 Dark mode: classes Tailwind `dark:`
// 🧩 Dépendances: aucune nouvelle (SVG/Divs uniquement)

import React, { useEffect, useState } from "react";
import { isToday, isBefore, parseISO, format } from "date-fns";
import {
  FaUsers,
  FaUserCheck,
  FaUserTimes,
  FaMale,
  FaFemale,
  FaGraduationCap,
  FaCreditCard,
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

  // ✅ Résumé global des paiements
  const [paymentSummary, setPaymentSummary] = useState({
    totalCount: 0,
    paidCount: 0,
    pendingCount: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
  });

  // ✅ Présences (ADMIN)
  const [attendance7d, setAttendance7d] = useState([]); // [{date: Date, count: number}]
  const [recentPresences, setRecentPresences] = useState([]); // [{id, ts, member?}]

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Stats via services internes (logique d'origine)
        const { stats: calculatedStats } = await supabaseServices.getStatistics();
        setStats(calculatedStats || { ...stats, membresExpirés: [] });

        // Paiements / profils selon rôle
        if (role === "admin") {
          const payments = await supabaseServices.getPayments();

          // Liste "Paiements à venir" (non payés)
          const filtered = (payments || []).filter((p) => !p.is_paid);
          setPendingPayments(filtered);

          // ✅ Calcul du résumé global (montants)
          const totalCount = payments?.length || 0;
          const paid = (payments || []).filter((p) => p.is_paid);
          const pending = (payments || []).filter((p) => !p.is_paid);
          const sum = (arr) => arr.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

          setPaymentSummary({
            totalCount,
            paidCount: paid.length,
            pendingCount: pending.length,
            totalAmount: sum(payments || []),
            paidAmount: sum(paid),
            pendingAmount: sum(pending),
          });

          // ✅ Présences: 7 derniers jours + derniers passages
          await fetchAttendanceAdmin();
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

    // === Helper interne: charge présences (ADMIN) ===
    const fetchAttendanceAdmin = async () => {
      try {
        // Fenêtre: aujourd'hui (23:59:59) et 6 jours en arrière (00:00:00)
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date();
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);

        // Récupération des présences (limite raisonnable)
        const { data: presencesData, error: presencesError } = await supabase
          .from("presences")
          .select("*")
          .gte("timestamp", start.toISOString())
          .lte("timestamp", end.toISOString())
          .order("timestamp", { ascending: false })
          .limit(500);

        if (presencesError) {
          console.error("Error loading presences:", presencesError);
          setAttendance7d([]);
          setRecentPresences([]);
          return;
        }

        // 7 jours init
        const key = (d) => format(d, "yyyy-MM-dd");
        const days = [];
        const countsByKey = {};
        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          days.push({ date: d, count: 0 });
          countsByKey[key(d)] = 0;
        }

        // Comptage
        (presencesData || []).forEach((row) => {
          const ts = typeof row.timestamp === "string" ? parseISO(row.timestamp) : new Date(row.timestamp);
          const k = key(ts);
          if (countsByKey[k] !== undefined) countsByKey[k] += 1;
        });

        const sevenDays = days.map((d) => ({ date: d.date, count: countsByKey[key(d.date)] || 0 }));
        setAttendance7d(sevenDays);

        // Derniers passages (top 10 récents) + jointure members par badgeId
        const recent = (presencesData || []).slice(0, 10);
        const badgeIds = Array.from(
          new Set(recent.map((r) => r.badgeId).filter((b) => !!b))
        );

        let membersByBadge = {};
        if (badgeIds.length > 0) {
          const { data: membersData, error: membersErr } = await supabase
            .from("members")
            .select("id, firstName, name, photo, badgeId")
            .in("badgeId", badgeIds);

          if (!membersErr && membersData) {
            membersByBadge = membersData.reduce((acc, m) => {
              acc[m.badgeId] = m;
              return acc;
            }, {});
          }
        }

        const enriched = recent.map((r) => ({
          id: r.id,
          ts: r.timestamp,
          member: membersByBadge[r.badgeId],
          badgeId: r.badgeId,
        }));

        setRecentPresences(enriched);
      } catch (e) {
        console.error("fetchAttendanceAdmin error:", e);
        setAttendance7d([]);
        setRecentPresences([]);
      }
    };

    fetchData();
  }, [role, user]);

  // ===== Widget stat générique
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

  // ===== Helpers
  const isLateOrToday = (ts) => {
    if (!ts) return false;
    try {
      const d = typeof ts === "string" ? parseISO(ts) : ts;
      return isToday(d) || isBefore(d, new Date());
    } catch {
      return false;
    }
  };

  const getInitials = (firstName, name) => {
    const a = (firstName || "").trim().charAt(0);
    const b = (name || "").trim().charAt(0);
    return (a + b).toUpperCase() || "?" ;
  };

  // ===== Composant : Anneau de progression SVG (montant payé / total)
  const CircularProgress = ({
    size = 160,
    stroke = 14,
    value = 0, // 0..1
  }) => {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const dash = Math.max(0, Math.min(1, value)) * circumference;
    const remainder = circumference - dash;

    return (
      <div className="flex items-center justify-center">
        <svg width={size} height={size} className="block">
          <defs>
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          {/* fond */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            className="text-gray-200 dark:text-gray-700"
            strokeWidth={stroke}
            fill="none"
          />
          {/* progression */}
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
          {/* centre : % */}
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-gray-900 dark:fill-white"
            fontSize="22"
            fontWeight="700"
          >
            {Math.round(value * 100)}%
          </text>
        </svg>
      </div>
    );
  };

  // ===== Dérivés paiements
  const {
    totalAmount,
    paidAmount,
    pendingAmount,
    totalCount,
    paidCount,
    pendingCount,
  } = paymentSummary;

  const progress = totalAmount > 0 ? paidAmount / totalAmount : 0;

  // ===== Dérivés présences
  const maxCount = Math.max(1, ...attendance7d.map((d) => d.count));

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

      {/* 🔹 Partie 1bis — État global des paiements (ADMIN) */}
      {role === "admin" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FaCreditCard className="text-blue-500" />
              État global des paiements
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {totalCount} opérations • {(totalAmount || 0).toFixed(2)} €
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-6">
            {/* Anneau */}
            <div className="flex justify-center">
              <CircularProgress value={progress} />
            </div>

            {/* Légendes et détails */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Payé</span>
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
                  <span className="text-gray-700 dark:text-gray-300 font-medium">En attente</span>
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

              {/* Barre linéaire fine (lecture rapide) */}
              <div className="mt-2">
                <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-2 bg-gradient-to-r from-green-500 to-blue-500"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {Math.round(progress * 100)}% du montant total déjà encaissé
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔹 Partie 1ter — Présences 7 derniers jours + Derniers passages (ADMIN) */}
      {role === "admin" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Mini graph: 7 derniers jours */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Présences — 7 derniers jours
            </h2>
            {attendance7d.length > 0 ? (
              <div className="h-32 flex items-end gap-3">
                {attendance7d.map((d, idx) => {
                  const pct = Math.round((d.count / maxCount) * 100);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end">
                      <div
                        className="w-6 max-w-[24px] rounded-t bg-blue-500 dark:bg-blue-400 transition-all"
                        style={{
                          height: `${pct}%`,
                          minHeight: d.count > 0 ? "8px" : "2px",
                        }}
                        title={`${format(d.date, "dd/MM")} • ${d.count} passages`}
                      />
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {format(d.date, "dd/MM")}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Aucune présence enregistrée sur la période.
              </div>
            )}
          </div>

          {/* Derniers passages */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Derniers passages
            </h2>
            {recentPresences.length > 0 ? (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {recentPresences.map((r) => {
                  const m = r.member;
                  const ts = typeof r.ts === "string" ? parseISO(r.ts) : new Date(r.ts);
                  const displayName = m
                    ? `${m.firstName || ""} ${m.name || ""}`.trim()
                    : `Badge ${r.badgeId || "?"}`;
                  return (
                    <li key={r.id} className="py-2 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        {m?.photo ? (
                          <img
                            src={m.photo}
                            alt={displayName}
                            className="w-9 h-9 rounded-full object-cover ring-2 ring-white dark:ring-gray-700 shadow"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-gray-200">
                            {getInitials(m?.firstName, m?.name)}
                          </div>
                        )}
                        {/* Nom */}
                        <span className="truncate text-gray-900 dark:text-gray-100">{displayName}</span>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap ml-3">
                        {format(ts, "dd/MM/yyyy HH:mm")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Aucun passage récent.
              </div>
            )}
          </div>
        </div>
      )}

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
                          late ? "bg-red-500 text-white" : "bg-amber-500 text-white"
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
