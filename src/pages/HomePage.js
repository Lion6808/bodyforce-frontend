// 📄 HomePage.js — Page d'accueil — Dossier : src/pages — Date : 2025-08-13
// 👤 Utilisateur: Hero de bienvenue + grande photo (affiché dès qu'un user est connecté)
// 🛡️ Admin: widgets stats/paiements/présences réservés à role === "admin"

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
  const isAdmin = (role || "").toLowerCase() === "admin";

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

  // Résumé global des paiements (admin)
  const [paymentSummary, setPaymentSummary] = useState({
    totalCount: 0,
    paidCount: 0,
    pendingCount: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
  });

  // Présences (admin)
  const [attendance7d, setAttendance7d] = useState([]);
  const [recentPresences, setRecentPresences] = useState([]);

  useEffect(() => {
    // --- ADMIN: présences 7j + derniers passages
    const fetchAttendanceAdmin = async () => {
      try {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date();
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);

        const { data: presencesData, error } = await supabase
          .from("presences")
          .select("*")
          .gte("timestamp", start.toISOString())
          .lte("timestamp", end.toISOString())
          .order("timestamp", { ascending: false })
          .limit(500);

        if (error) {
          console.error("Error loading presences:", error);
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

        setAttendance7d(days.map((d) => ({ date: d.date, count: countsByKey[key(d.date)] || 0 })));

        // Derniers passages enrichis
        const recent = (presencesData || []).slice(0, 10);
        const badgeIds = Array.from(new Set(recent.map((r) => r.badgeId).filter(Boolean)));
        let membersByBadge = {};
        if (badgeIds.length > 0) {
          const { data: membersData, error: mErr } = await supabase
            .from("members")
            .select("id, firstName, name, photo, badgeId")
            .in("badgeId", badgeIds);
          if (!mErr && membersData) {
            membersByBadge = membersData.reduce((acc, m) => {
              acc[m.badgeId] = m;
              return acc;
            }, {});
          }
        }
        setRecentPresences(
          recent.map((r) => ({ id: r.id, ts: r.timestamp, member: membersByBadge[r.badgeId], badgeId: r.badgeId }))
        );
      } catch (e) {
        console.error("fetchAttendanceAdmin error:", e);
        setAttendance7d([]);
        setRecentPresences([]);
      }
    };

    const fetchData = async () => {
      try {
        if (isAdmin) {
          // Stats globales (admin seulement)
          const { stats: calculatedStats } = await supabaseServices.getStatistics();
          setStats(calculatedStats || { ...stats, membresExpirés: [] });

          // Paiements (admin)
          const payments = await supabaseServices.getPayments();
          const paid = (payments || []).filter((p) => p.is_paid);
          const pending = (payments || []).filter((p) => !p.is_paid);
          const sum = (arr) => arr.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

          setPendingPayments(pending);
          setPaymentSummary({
            totalCount: payments?.length || 0,
            paidCount: paid.length,
            pendingCount: pending.length,
            totalAmount: sum(payments || []),
            paidAmount: sum(paid),
            pendingAmount: sum(pending),
          });

          await fetchAttendanceAdmin();
        } else if (user) {
          // 🔐 Utilisateur connecté (quel que soit le rôle ≠ admin) : récup member + paiements
          // 1) membre par user_id, fallback email
          let memberData = null;
          let { data: m1, error: e1 } = await supabase
            .from("members")
            .select("*")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

          if (!e1 && m1) memberData = m1;
          else {
            const { data: m2, error: e2 } = await supabase
              .from("members")
              .select("*")
              .eq("email", user.email)
              .limit(1)
              .maybeSingle();
            if (!e2 && m2) memberData = m2;
          }

          setUserMemberData(memberData || null);

          // 2) paiements du membre
          if (memberData?.id) {
            // d'abord member_id (schéma FR)
            let { data: memberPayments, error: pErr } = await supabase
              .from("payments")
              .select("*")
              .eq("member_id", memberData.id)
              .order("date_paiement", { ascending: false });

            // fallback si colonnes différentes
            if (pErr && pErr.code === "42703") {
              const { data: alt } = await supabase.from("payments").select("*").eq("memberId", memberData.id);
              memberPayments = alt || [];
            }
            setUserPayments(memberPayments || []);
          } else {
            setUserPayments([]);
          }
        } else {
          // pas connecté
          setUserMemberData(null);
          setUserPayments([]);
        }
      } catch (e) {
        console.error("HomePage fetch error:", e);
      }
    };

    fetchData();
  }, [role, user, isAdmin]);

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
    return (a + b).toUpperCase() || "?";
  };

  // ===== Widget StatCard générique
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

  // ===== Anneau de progression SVG (montant payé / total)
  const CircularProgress = ({ size = 160, stroke = 14, value = 0 }) => {
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

          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            className="text-gray-200 dark:text-gray-700"
            strokeWidth={stroke}
            fill="none"
          />
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
          {/* Pour centrer verticalement le label sans propriété exotique */}
          <text
            x="50%"
            y="50%"
            dy=".35em"
            textAnchor="middle"
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

  // ===== Dérivés paiements (admin)
  const { totalAmount, paidAmount, pendingAmount, totalCount, paidCount, pendingCount } = paymentSummary;
  const progress = totalAmount > 0 ? paidAmount / totalAmount : 0;

  // ===== Données affichage utilisateur
  const memberFirstName =
    userMemberData?.firstName || userMemberData?.firstname || userMemberData?.prenom || "";
  const memberLastName = userMemberData?.name || userMemberData?.lastname || userMemberData?.nom || "";
  const memberDisplayName =
    (memberFirstName || memberLastName ? `${memberFirstName} ${memberLastName}`.trim() : user?.email) ||
    "Bienvenue";
  const memberPhoto = userMemberData?.photo || "";

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900 min-h-screen transition-colors duration-300">
      {/* 🔷 HERO UTILISATEUR : message de bienvenue + grande photo (affiché dès qu'il y a un user) */}
      {user && (
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-blue-500/10 dark:from-indigo-400/10 dark:via-emerald-400/10 dark:to-blue-400/10" />
          <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
            {/* Avatar large */}
            <div className="relative">
              {memberPhoto ? (
                <img
                  src={memberPhoto}
                  alt={memberDisplayName}
                  className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover shadow-xl ring-4 ring-white dark:ring-gray-700"
                  loading="lazy"
                />
              ) : (
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-xl ring-4 ring-white dark:ring-gray-700">
                  {getInitials(memberFirstName, memberLastName) || "?"}
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-400/90 blur-sm" />
            </div>

            {/* Texte de bienvenue */}
            <div className="text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
                Bonjour{memberFirstName ? `, ${memberFirstName}` : ""} 👋
              </h1>
              <p className="mt-1 text-sm md:text-base text-gray-600 dark:text-gray-300">
                Heureux de vous revoir sur votre espace. Retrouvez ici vos dernières informations et vos paiements.
              </p>

              {/* Badges d’info rapides */}
              <div className="mt-4 flex flex-wrap items-center gap-2 justify-center md:justify-start">
                {userMemberData?.badgeId && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                    Badge : {userMemberData.badgeId}
                  </span>
                )}
                {userPayments?.length > 0 && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    {userPayments.filter((p) => p.is_paid).length} paiement(s) réglé(s)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔹 Widgets statistiques (ADMIN uniquement) */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard icon={FaUsers} label="Total Membres" value={stats.total} color="bg-blue-500" />
          <StatCard icon={FaUserCheck} label="Actifs" value={stats.actifs} color="bg-green-500" />
          <StatCard icon={FaUserTimes} label="Expirés" value={stats.expirés} color="bg-red-500" />
          <StatCard icon={FaMale} label="Hommes" value={stats.hommes} color="bg-indigo-500" />
          <StatCard icon={FaFemale} label="Femmes" value={stats.femmes} color="bg-pink-500" />
          <StatCard icon={FaGraduationCap} label="Étudiants" value={stats.etudiants} color="bg-yellow-500" />
        </div>
      )}

      {/* 🔹 État global des paiements (ADMIN) */}
      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FaCreditCard className="text-blue-500" />
              État global des paiements
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {paymentSummary.totalCount} opérations • {(paymentSummary.totalAmount || 0).toFixed(2)} €
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-6">
            <div className="flex justify-center">
              <CircularProgress value={progress} />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Payé</span>
                </div>
                <div className="text-right">
                  <div className="text-gray-900 dark:text-white font-semibold">
                    {(paymentSummary.paidAmount || 0).toFixed(2)} €
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{paymentSummary.paidCount} op.</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">En attente</span>
                </div>
                <div className="text-right">
                  <div className="text-gray-900 dark:text-white font-semibold">
                    {(paymentSummary.pendingAmount || 0).toFixed(2)} €
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{paymentSummary.pendingCount} op.</div>
                </div>
              </div>

              <div className="mt-2">
                <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-green-500 to-blue-500" style={{ width: `${Math.round(progress * 100)}%` }} />
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
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* ✅ Mini graph: 7 derniers jours — design amélioré */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Présences — 7 derniers jours</h2>
              {attendance7d.length > 0 && (
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {attendance7d.reduce((sum, d) => sum + d.count, 0)} passages
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Moy: {Math.round(attendance7d.reduce((sum, d) => sum + d.count, 0) / 7)}/jour
                  </div>
                </div>
              )}
            </div>

            {attendance7d.length > 0 ? (
              <div className="relative w-full">
                {/* Zone des barres - Hauteur augmentée */}
                <div className="relative h-48 sm:h-56 lg:h-60">
                  {/* Lignes de grille avec labels */}
                  <div className="absolute inset-0">
                    {(() => {
                      const maxValue = Math.max(...attendance7d.map((d) => d.count));
                      const adjustedMax = maxValue > 0 ? maxValue : 10;
                      const steps = 5;
                      const stepValue = Math.ceil(adjustedMax / steps);

                      return Array.from({ length: steps + 1 }, (_, i) => {
                        const value = stepValue * i;
                        const percentage = (i / steps) * 100;

                        return (
                          <div key={i} className="absolute w-full flex items-center" style={{ bottom: `${percentage}%` }}>
                            <span className="text-xs text-gray-400 dark:text-gray-500 w-8 -ml-2">{value}</span>
                            <div className="flex-1 border-t border-gray-200 dark:border-gray-600/50 ml-2" />
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Barres avec échelle corrigée */}
                  <div className="absolute inset-0 flex items-end justify-between pl-10 pr-2 pb-2">
                    {attendance7d.map((d, idx) => {
                      const maxValue = Math.max(...attendance7d.map((d) => d.count));
                      const adjustedMax = maxValue > 0 ? maxValue : 10;
                      const heightInPixels =
                        maxValue > 0 ? Math.max((d.count / adjustedMax) * 180, d.count > 0 ? 12 : 4) : 4;
                      const isTodayLabel = format(d.date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                      const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;

                      return (
                        <div
                          key={idx}
                          className="flex flex-col items-center justify-end group cursor-pointer"
                          style={{ width: "calc(100% / 7 - 8px)" }}
                        >
                          {/* Valeur au-dessus de la barre */}
                          <div
                            className={`text-xs font-medium mb-1 transition-all duration-200 ${
                              d.count > 0
                                ? "text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                                : "text-gray-400 dark:text-gray-600"
                            }`}
                          >
                            {d.count}
                          </div>

                          {/* Barre */}
                          <div
                            className={`w-full rounded-t-lg shadow-lg transition-all duration-500 group-hover:shadow-xl relative overflow-hidden ${
                              isTodayLabel
                                ? "ring-2 ring-blue-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-800"
                                : ""
                            }`}
                            style={{
                              height: `${heightInPixels}px`,
                              background:
                                d.count > 0
                                  ? isTodayLabel
                                    ? "linear-gradient(180deg, rgba(59,130,246,1) 0%, rgba(16,185,129,1) 50%, rgba(34,197,94,1) 100%)"
                                    : isWeekend
                                    ? "linear-gradient(180deg, rgba(139,92,246,1) 0%, rgba(168,85,247,1) 100%)"
                                    : "linear-gradient(180deg, rgba(59,130,246,1) 0%, rgba(34,197,94,1) 100%)"
                                  : "linear-gradient(180deg, rgba(156,163,175,0.3) 0%, rgba(156,163,175,0.1) 100%)",
                            }}
                          >
                            {/* Effet brillant */}
                            {d.count > 0 && (
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            )}
                          </div>

                          {/* Tooltip au survol */}
                          <div className="absolute bottom-full mb-8 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-xs px-3 py-2 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-10">
                            <div className="font-medium">{format(d.date, "EEEE dd/MM")}</div>
                            <div className="text-gray-300 dark:text-gray-400">
                              {d.count} passage{d.count > 1 ? "s" : ""}
                              {isTodayLabel && " (Aujourd'hui)"}
                              {isWeekend && " (Week-end)"}
                            </div>
                            {/* Flèche */}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Labels dates améliorés */}
                <div className="mt-4 flex justify-between pl-10 pr-2">
                  {attendance7d.map((d, idx) => {
                    const isTodayLabel = format(d.date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                    const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;

                    return (
                      <div key={idx} className="flex flex-col items-center" style={{ width: "calc(100% / 7 - 8px)" }}>
                        <span
                          className={`text-xs font-medium ${
                            isTodayLabel
                              ? "text-blue-600 dark:text-blue-400 font-bold"
                              : isWeekend
                              ? "text-purple-600 dark:text-purple-400"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {format(d.date, "dd/MM")}
                        </span>
                        <span
                          className={`text-[10px] ${
                            isTodayLabel ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
                          }`}
                        >
                          {format(d.date, "EEE").substring(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Légende */}
                <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-gradient-to-b from-blue-500 to-green-500" />
                    <span className="text-gray-600 dark:text-gray-400">Jours ouvrés</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-gradient-to-b from-purple-500 to-purple-600" />
                    <span className="text-gray-600 dark:text-gray-400">Week-end</span>
                  </div>
                  {attendance7d.some((d) => format(d.date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")) && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400 ring-2 ring-blue-400 ring-opacity-50" />
                      <span className="text-gray-600 dark:text-gray-400">Aujourd'hui</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div className="text-sm font-medium mb-1">Aucune présence</div>
                <div className="text-xs">Aucune donnée disponible sur la période</div>
              </div>
            )}
          </div>

          {/* ✅ Derniers passages — design amélioré */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Derniers passages</h2>
              {recentPresences.length > 0 && (
                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {recentPresences.length} récents
                </span>
              )}
            </div>

            {recentPresences.length > 0 ? (
              <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                {recentPresences.map((r, index) => {
                  const m = r.member;
                  const ts = typeof r.ts === "string" ? parseISO(r.ts) : new Date(r.ts);
                  const displayName = m ? `${m.firstName || ""} ${m.name || ""}`.trim() : `Badge ${r.badgeId || "?"}`;

                  // Fonction simple pour calculer le temps écoulé
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

                  const timeAgo = getTimeAgo(ts);

                  return (
                    <div
                      key={r.id}
                      className="group flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 rounded-lg transition-all duration-200 border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Avatar avec effet amélioré */}
                        {m?.photo ? (
                          <img
                            src={m.photo}
                            alt={displayName}
                            className="w-10 h-10 rounded-full object-cover shadow-lg border-2 border-white dark:border-gray-700 group-hover:shadow-xl group-hover:scale-105 transition-all duration-200"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-semibold text-white shadow-lg border-2 border-white dark:border-gray-700 group-hover:shadow-xl group-hover:scale-105 transition-all duration-200">
                            {getInitials(m?.firstName, m?.name)}
                          </div>
                        )}

                        {/* Informations membre */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {displayName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {m?.badgeId && `Badge ${m.badgeId} • `}
                            {timeAgo}
                          </div>
                        </div>
                      </div>

                      {/* Horodatage */}
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{format(ts, "HH:mm")}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{format(ts, "dd/MM")}</div>
                      </div>

                      {/* Indicateur de fraîcheur */}
                      {index < 3 && (
                        <div className="ml-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              index === 0 ? "bg-green-400 animate-pulse" : index === 1 ? "bg-yellow-400" : "bg-gray-400"
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
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="text-sm font-medium mb-1">Aucun passage récent</div>
                <div className="text-xs">Les derniers passages apparaîtront ici</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🔹 Partie 2 — Listes détaillées : abonnements échus & paiements à venir */}

      {/* Abonnements échus — visible aux admins même si vide */}
      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Abonnements échus</h2>

          {stats.membresExpirés?.length > 0 ? (
            <>
              <ul className="space-y-2">
                {stats.membresExpirés.slice(0, 5).map((membre, idx) => (
                  <li key={membre.id ?? idx} className="flex items-center justify-between text-gray-700 dark:text-gray-300">
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
            <div className="text-sm text-gray-500 dark:text-gray-400">Aucun abonnement échu</div>
          )}
        </div>
      )}

      {/* Paiements à venir — visible aux admins même si vide */}
      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Paiements à venir</h2>

          {pendingPayments?.length > 0 ? (
            <ul className="space-y-2">
              {pendingPayments.map((p) => {
                const late = isLateOrToday(p.encaissement_prevu);
                return (
                  <li key={p.id} className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                    <span className="truncate">
                      {p.member?.firstName && p.member?.name
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
            <div className="text-sm text-gray-500 dark:text-gray-400">Aucun paiement en attente</div>
          )}
        </div>
      )}

      {/* Mes paiements — pour tout utilisateur NON admin */}
      {!isAdmin && user && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Mes paiements</h2>

          {userPayments?.length > 0 ? (
            <ul className="space-y-2">
              {userPayments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                  <span className="truncate">
                    {payment.date_paiement ? format(parseISO(payment.date_paiement), "dd/MM/yyyy") : "Date n/d"} —{" "}
                    {(payment.amount || 0).toFixed(2)} € {payment.method ? `(${payment.method})` : ""}
                  </span>
                  {payment.is_paid ? (
                    <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">Payé</span>
                  ) : (
                    <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded">En attente</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">Aucune opération pour le moment.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default HomePage;

// ✅ FIN DU FICHIER
