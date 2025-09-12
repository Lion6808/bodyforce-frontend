// 📄 Fichier : src/pages/UserProfilePage.jsx
// 🎯 "Mon profil" — design aligné onglet Admin, dark-mode & mobile OK
// 💳 Paiements : même logique que l’admin (colonnes FR supportées)

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../supabaseClient";
import {
  FaUser,
  FaIdCard,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaChild,
  FaBirthdayCake,
  FaGraduationCap,
  FaShieldAlt,
  FaCalendarAlt,
  FaEuroSign,
  FaExclamationTriangle,
  FaCalendarCheck,
  FaMoneyCheckAlt,
} from "react-icons/fa";

/* -------------------------------------------
   Helpers
-------------------------------------------- */

// Parse très tolérant : dd/MM/yyyy • yyyy-MM-dd • dd-MM-yyyy • ISO • timestamp
const parseFlexibleDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    // 1975-05-14 (ou 1975-05-14T..)
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const [, Y, M, D] = iso.map(Number);
      return new Date(Y, M - 1, D);
    }

    // 14/05/1975
    const fr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (fr) {
      const [, d, m, y] = fr.map(Number);
      return new Date(y, m - 1, d);
    }

    // 14-05-1975
    const frDash = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (frDash) {
      const [, d, m, y] = frDash.map(Number);
      return new Date(y, m - 1, d);
    }

    const t = Date.parse(s);
    if (!isNaN(t)) return new Date(t);
  }
  return null;
};

const formatIntl = (date, fmt) => {
  try {
    const map = {
      "yyyy-MM-dd": { year: "numeric", month: "2-digit", day: "2-digit" },
      "dd/MM/yyyy": { day: "2-digit", month: "2-digit", year: "numeric" },
      "MMMM yyyy": { month: "long", year: "numeric" },
      "EEEE dd MMMM": { weekday: "long", day: "numeric", month: "long" },
    };
    if (fmt === "yyyy-MM-dd") return date.toISOString().split("T")[0];
    return new Intl.DateTimeFormat("fr-FR", map[fmt] || {}).format(date);
  } catch {
    return "";
  }
};

const calcAge = (birthDate) => {
  if (!birthDate) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age < 0 ? null : age;
};

const getMembershipStatus = (start, end) => {
  const today = new Date();
  if (start && end) {
    if (today < start) return { label: "À venir", tone: "info" };
    if (today > end) return { label: "Expiré", tone: "danger" };
    return { label: "Actif", tone: "success" };
  }
  if (end) return today > end ? { label: "Expiré", tone: "danger" } : { label: "—", tone: "neutral" };
  return { label: "—", tone: "neutral" };
};

const toneClasses = (tone) => {
  switch (tone) {
    case "success":
      return { badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" };
    case "danger":
      return { badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300", dot: "bg-rose-500" };
    case "info":
      return { badge: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500" };
    default:
      return { badge: "bg-gray-500/15 text-gray-700 dark:text-gray-300", dot: "bg-gray-500" };
  }
};

const formatCurrency = (n) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n || 0));

const ordinal = (i) => (i === 1 ? "1er" : `${i}ème`);

/* -------------------------------------------
   UI Subcomponents (mêmes styles que Présences)
-------------------------------------------- */

function StatTile({ icon: Icon, title, value, accent = "indigo" }) {
  const gradient =
    accent === "green"
      ? "from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/20"
      : accent === "orange"
      ? "from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20"
      : accent === "purple"
      ? "from-purple-50 to-fuchsia-50 dark:from-purple-900/30 dark:to-fuchsia-900/20"
      : "from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/20";

  const iconBg =
    accent === "green"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
      : accent === "orange"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
      : accent === "purple"
      ? "bg-purple-500/15 text-purple-600 dark:text-purple-300"
      : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300";

  return (
    <div className={`p-4 rounded-2xl border dark:border-gray-700 shadow-sm bg-gradient-to-br ${gradient}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className="text-lg" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">{title}</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center flex-shrink-0">
        <Icon />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-gray-600 dark:text-gray-300">{label}</div>
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{value || "—"}</div>
      </div>
    </div>
  );
}

function PaymentLine({ p }) {
  return (
    <li className="py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 flex-shrink-0
          ${p.overdue ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
            : p.isPaid ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}
        >
          {p.isPaid ? <FaMoneyCheckAlt /> : p.overdue ? <FaExclamationTriangle /> : <FaCalendarCheck />}
          {p.isPaid ? "Payé" : p.overdue ? "En retard" : "À venir"}
        </div>
        <div className="text-sm min-w-0">
          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {p.isPaid
              ? `Payé le ${p.paidAt ? formatIntl(p.paidAt, "dd/MM/yyyy") : "—"}`
              : `Échéance ${p.dueDate ? formatIntl(p.dueDate, "dd/MM/yyyy") : "—"}`}
          </div>
          <div className="text-gray-600 dark:text-gray-300 text-xs truncate">
            {p.method ? `Mode: ${p.method}` : ""} {p.note ? `• ${p.note}` : ""}
          </div>
          {p.rank ? (
            <div className="text-xs text-gray-500 dark:text-gray-400 italic">{ordinal(p.rank)}</div>
          ) : null}
        </div>
      </div>
      <div
        className={`text-sm font-semibold flex-shrink-0
        ${p.isPaid ? "text-emerald-700 dark:text-emerald-300"
          : p.overdue ? "text-rose-700 dark:text-rose-300"
          : "text-amber-700 dark:text-amber-300"}`}
      >
        {formatCurrency(p.amount)}
      </div>
    </li>
  );
}

/* -------------------------------------------
   Page
-------------------------------------------- */
export default function UserProfilePage() {
  const { user, userMemberData } = useAuth();

  // --- Identité
  const firstname = userMemberData?.firstname || "";
  const lastname = userMemberData?.lastname || "";
  const displayName =
    firstname || lastname ? `${firstname} ${lastname}`.trim() : user?.email || "Utilisateur";

  const email = user?.email || userMemberData?.email || "—";
  const badgeId = userMemberData?.badgeId || "—";
  const photo = userMemberData?.photo || "";

  // --- Coordonnées
  const phone = userMemberData?.phone ?? userMemberData?.telephone ?? "";
  const mobile =
    userMemberData?.mobile ?? userMemberData?.phoneMobile ?? userMemberData?.portable ?? "";
  const address = userMemberData?.address || "";
  const city = userMemberData?.city || "";
  const zip = userMemberData?.zip ?? userMemberData?.postalCode ?? "";

  // --- Anniversaire / âge (robuste)
  const birthRaw =
    userMemberData?.birthDate ??
    userMemberData?.birthdate ??
    userMemberData?.birthday ??
    userMemberData?.dateOfBirth ??
    userMemberData?.date_naissance ??
    null;
  const birthDate = parseFlexibleDate(birthRaw);
  const birthStr = birthDate ? formatIntl(birthDate, "dd/MM/yyyy") : "—";
  const age = useMemo(() => calcAge(birthDate), [birthDate]);

  // --- Étudiant ?
  const isStudent = !!(userMemberData?.student ?? userMemberData?.etudiant ?? false);

  // --- Abonnement
  const startDate = parseFlexibleDate(userMemberData?.startDate);
  const endDate = parseFlexibleDate(userMemberData?.endDate);
  const subscription = getMembershipStatus(startDate, endDate);
  const tone = toneClasses(subscription.tone);
  const startStr = startDate ? formatIntl(startDate, "dd/MM/yyyy") : "—";
  const endStr = endDate ? formatIntl(endDate, "dd/MM/yyyy") : "—";

  // --- Paiements
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const memberId = userMemberData?.id ?? userMemberData?.memberId ?? null;

  // Normalisation alignée sur l'onglet admin
  const normalizePayment = (row) => {
    const amount = Number(row?.amount ?? row?.montant ?? row?.total ?? 0);

    const dueDate =
      parseFlexibleDate(row?.encaissement_prevu) || // ✅ admin
      parseFlexibleDate(row?.dueDate) ||
      parseFlexibleDate(row?.due_date) ||
      parseFlexibleDate(row?.expectedDate) ||
      parseFlexibleDate(row?.date) ||
      null;

    const paidAt =
      parseFlexibleDate(row?.date_paiement) ||       // ✅ admin
      parseFlexibleDate(row?.paidAt) ||
      parseFlexibleDate(row?.paid_at) ||
      parseFlexibleDate(row?.paymentDate) ||
      null;

    const status = (row?.status || "").toString().toLowerCase();
    const paidFlag = row?.is_paid ?? row?.paid ?? row?.isPaid ?? row?.encaisse ?? null; // ✅ admin: is_paid
    const isPaid = (typeof paidFlag === "boolean" && paidFlag) || status === "paid" || !!paidAt;

    const method = row?.methode || row?.method || row?.type || row?.paymentMethod || ""; // ✅ admin: methode
    const note = row?.commentaire || row?.note || row?.description || ""; // ✅ admin: commentaire

    const today = new Date();
    const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const overdue = !isPaid && dueDate && dueDate < midnight;
    const upcoming = !isPaid && dueDate && dueDate >= midnight;

    const rank = row?.rang ?? row?.rank ?? row?.sequence ?? row?.index ?? null;

    return {
      id: row?.id ?? Math.random().toString(36).slice(2),
      amount,
      dueDate,
      paidAt,
      isPaid,
      method,
      note,
      overdue,
      upcoming,
      rank: rank ? Number(rank) : null,
    };
  };

  useEffect(() => {
    if (!memberId) return;

    const fetchPayments = async () => {
      setLoadingPayments(true);
      try {
        // 1er essai : colonne admin canonique
        let { data, error } = await supabase
          .from("payments")
          .select("*")
          .eq("member_id", memberId); // ✅ pas d'OR, évite l'erreur 42703

        // Fallback si la colonne n’existe pas
        if (error && error.code === "42703") {
          ({ data, error } = await supabase
            .from("payments")
            .select("*")
            .eq("memberId", memberId));
        }

        if (error) {
          console.error("[UserProfilePage] payments error:", error);
          setPayments([]);
          return;
        }

        const list = (data || []).map(normalizePayment);

        // Tri identique à l’admin :
        // - payés d’abord (du plus récent au plus ancien)
        // - puis non payés (échéance la plus proche d’abord)
        list.sort((a, b) => {
          if (a.isPaid !== b.isPaid) return a.isPaid ? -1 : 1;
          if (a.isPaid && b.isPaid)
            return (b.paidAt?.getTime?.() ?? 0) - (a.paidAt?.getTime?.() ?? 0);
          return (a.dueDate?.getTime?.() ?? Infinity) - (b.dueDate?.getTime?.() ?? Infinity);
        });

        setPayments(list);
      } catch (e) {
        console.error("[UserProfilePage] payments exception:", e);
        setPayments([]);
      } finally {
        setLoadingPayments(false);
      }
    };

    fetchPayments();
  }, [memberId]);

  const paymentsStats = useMemo(() => {
    const today = new Date();
    const startYear = new Date(today.getFullYear(), 0, 1);
    const unpaid = payments.filter((p) => !p.isPaid);
    const overdue = unpaid.filter((p) => p.overdue);
    const upcoming = unpaid.filter((p) => p.upcoming);
    const outstanding = unpaid.reduce((s, p) => s + (p.amount || 0), 0);
    const paidThisYear = payments
      .filter((p) => p.isPaid && p.paidAt && p.paidAt >= startYear)
      .reduce((s, p) => s + (p.amount || 0), 0);

    return {
      upcomingCount: upcoming.length,
      overdueCount: overdue.length,
      outstanding,
      paidThisYear,
      upcomingList: [...upcoming, ...overdue],
      historyPaid: payments.filter((p) => p.isPaid),
    };
  }, [payments]);

  return (
    <div className="p-4 md:p-6 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Mon profil</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Consultez vos informations personnelles, l’état de votre abonnement et vos paiements.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium">{displayName}</div>
            <div className="text-xs text-gray-600 dark:text-gray-300">Badge : {badgeId}</div>
          </div>
          <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-white dark:ring-gray-700 shadow-lg flex-shrink-0">
            {photo ? (
              <img src={photo} alt="avatar" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-400">
                <FaUser />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Identité & abonnement */}
      <div className="rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm mb-6">
        <div className="px-4 md:px-6 py-4 border-b dark:border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
              <FaShieldAlt />
            </div>
            <div>
              <div className="text-sm font-semibold">Identité & abonnement</div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                {email} {badgeId && badgeId !== "—" ? `(Badge : ${badgeId})` : ""}
              </div>
            </div>
          </div>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${tone.badge}`}>
            <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
            {subscription.label}
          </div>
        </div>

        {/* Tuiles : Étudiant / Anniversaire / Âge / Période */}
        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          <StatTile icon={FaGraduationCap} title="Statut étudiant" value={isStudent ? "Oui" : "Non"} accent="purple" />
          <StatTile icon={FaBirthdayCake} title="Anniversaire" value={birthStr} accent="orange" />
          <StatTile icon={FaChild} title="Âge" value={age ?? "—"} accent="green" />
          <StatTile icon={FaCalendarAlt} title="Abonnement" value={`${startStr} → ${endStr}`} accent="indigo" />
        </div>
      </div>

      {/* Coordonnées & Adresse */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="p-4 md:p-6 rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
          <div className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Coordonnées</div>
          <div className="divide-y dark:divide-gray-700">
            <InfoRow icon={FaEnvelope} label="Email" value={email} />
            <InfoRow icon={FaPhone} label="Téléphone" value={phone || "—"} />
            <InfoRow icon={FaPhone} label="Téléphone portable" value={mobile || "—"} />
            <InfoRow icon={FaIdCard} label="Badge" value={badgeId} />
          </div>
        </div>

        <div className="p-4 md:p-6 rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
          <div className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Adresse</div>
          <div className="divide-y dark:divide-gray-700">
            <InfoRow icon={FaMapMarkerAlt} label="Adresse" value={address || "—"} />
            <InfoRow icon={FaMapMarkerAlt} label="Ville" value={city || "—"} />
            <InfoRow icon={FaMapMarkerAlt} label="Code postal" value={zip || "—"} />
          </div>
        </div>
      </div>

      {/* Paiements */}
      <div className="rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 md:px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
              <FaEuroSign />
            </div>
            <div>
              <div className="text-sm font-semibold">Paiements</div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                Échéances, retards et historique d’encaissement
              </div>
            </div>
          </div>
          {loadingPayments && <div className="text-xs text-gray-600 dark:text-gray-300">Chargement…</div>}
        </div>

        {/* Tuiles résumé */}
        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          <StatTile icon={FaCalendarCheck} title="Échéances à venir" value={paymentsStats.upcomingCount} accent="indigo" />
          <StatTile icon={FaExclamationTriangle} title="Échéances en retard" value={paymentsStats.overdueCount} accent="orange" />
          <StatTile icon={FaMoneyCheckAlt} title="Total restant" value={formatCurrency(paymentsStats.outstanding)} accent="purple" />
          <StatTile icon={FaEuroSign} title="Payé cette année" value={formatCurrency(paymentsStats.paidThisYear)} accent="green" />
        </div>

        {/* Listes */}
        <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Échéances */}
          <div className="rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <div className="px-4 py-3 border-b dark:border-gray-700 font-semibold text-gray-900 dark:text-gray-100">
              Échéances à venir / en retard
            </div>
            <div className="p-4">
              {paymentsStats.upcomingList.length === 0 ? (
                <div className="text-sm text-gray-600 dark:text-gray-300">Aucune échéance à afficher.</div>
              ) : (
                <ul className="divide-y dark:divide-gray-700">
                  {paymentsStats.upcomingList.map((p) => (
                    <PaymentLine key={p.id} p={p} />
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Historique des paiements */}
          <div className="rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <div className="px-4 py-3 border-b dark:border-gray-700 font-semibold text-gray-900 dark:text-gray-100">
              Historique des paiements
            </div>
            <div className="p-4">
              {paymentsStats.historyPaid.length === 0 ? (
                <div className="text-sm text-gray-600 dark:text-gray-300">Aucun paiement enregistré.</div>
              ) : (
                <ul className="divide-y dark:divide-gray-700">
                  {paymentsStats.historyPaid.map((p) => (
                    <PaymentLine key={p.id} p={p} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ FIN DU FICHIER
