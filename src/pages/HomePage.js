// 📄 HomePage.js — Page d'accueil — Dossier : src/pages — Date : 2025-08-13
// 🎯 Ajouts & refonte UI (ADMIN uniquement) :
//    - Widget anneau paiements (déjà présent)
//    - ✅ Nouveau design "Présences — 7 derniers jours" (bar chart responsive, gradient, grid-lines)
//    - ✅ Nouveau design "Derniers passages" (avatar + hover + meilleure lisibilité)
// 🌓 Dark mode: Tailwind `dark:`
// 🧩 Zéro nouvelle dépendance
// 🆕 Utilisateur : Hero de bienvenue + photo grand format

import React, { useEffect, useState, useMemo } from "react";
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
  FaUser,
  FaIdCard,
  FaSmile,
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
  const [attendance7d, setAttendance7d] = useState([]); // [{date, count}]
  const [recentPresences, setRecentPresences] = useState([]); // [{id, ts, member?, badgeId}]

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Stats via services internes (logique d'origine)
        const { stats: calculatedStats } = await supabaseServices.getStatistics();
        setStats(calculatedStats || { ...stats, membresExpirés: [] });

        if (role === "admin") {
          // Paiements
          const payments = await supabaseServices.getPayments();

          const filtered = (payments || []).filter((p) => !p.is_paid);
          setPendingPayments(filtered);

          const paid = (payments || []).filter((p) => p.is_paid);
          const pending = (payments || []).filter((p) => !p.is_paid);
          const sum = (arr) => arr.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

          setPaymentSummary({
            totalCount: payments?.length || 0,
            paidCount: paid.length,
            pendingCount: pending.length,
            totalAmount: sum(payments || []),
            paidAmount: sum(paid),
            pendingAmount: sum(pending),
          });

          // Présences: 7 derniers jours + derniers passages
          await fetchAttendanceAdmin();
        } else if (role === "user" && user) {
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

    // Charge présences (ADMIN)
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

        const sevenDays = days.map((d) => ({
          date: d.date,
          count: countsByKey[key(d.date)] || 0,
        }));
        setAttendance7d(sevenDays);

        // Derniers passages (10) + jointure members par badgeId
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
  const CircularProgress = ({ size = 160, stroke = 14, value = 0 }) =>
