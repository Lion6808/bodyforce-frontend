// 📄 Fichier : src/pages/UserProfilePage.jsx
// 🧩 Type   : React Page
// 📁 Dossier: src/pages
// 📆 Date   : 2025-09-12
//
// ✅ Ce fichier est complet et autonome.
//    - Design aligné sur MyAttendancesPage (tuiles, cartes, ombres, dark mode)
//    - Affiche : Nom, Photo, Email, Badge, Téléphone (si dispo), Adresse (si dispo)
//    - Ajouts demandés : Anniversaire, Âge (calculé), Statut Étudiant
//    - Statut d’abonnement basé sur startDate/endDate (sans isActive)
//    - Responsive mobile (grilles adaptatives, textes, espacements)
//
// ⚠️ Champs membres utilisés (si existants) :
//    userMemberData: {
//      firstname, lastname, email, photo, badgeId,
//      phone, address, city, zip, // optionnels
//      birthDate | birthday | dateOfBirth,
//      student | etudiant (booléen),
//      startDate, endDate
//    }
//    → Le code gère l’absence de champs en affichant “—”.

import React, { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
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
} from "react-icons/fa";

/* -------------------------------------------
   Helpers
-------------------------------------------- */
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

const parseMaybeDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
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
      return {
        badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        dot: "bg-emerald-500",
      };
    case "danger":
      return {
        badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
        dot: "bg-rose-500",
      };
    case "info":
      return {
        badge: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
        dot: "bg-indigo-500",
      };
    default:
      return {
        badge: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
        dot: "bg-gray-500",
      };
  }
};

/* -------------------------------------------
   Tuiles & éléments UI
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
          <div className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">
            {title}
          </div>
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
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
          {value || "—"}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------
   Page
-------------------------------------------- */
export default function UserProfilePage() {
  const { user, userMemberData } = useAuth();

  // Nom & identité
  const firstname = userMemberData?.firstname || "";
  const lastname = userMemberData?.lastname || "";
  const displayName = (firstname || lastname)
    ? `${firstname} ${lastname}`.trim()
    : (user?.email || "Utilisateur");

  const email = user?.email || userMemberData?.email || "—";
  const badgeId = userMemberData?.badgeId || "—";
  const photo = userMemberData?.photo || "";

  // Coordonnées (optionnelles)
  const phone = userMemberData?.phone || userMemberData?.telephone || "";
  const address = userMemberData?.address || "";
  const city = userMemberData?.city || "";
  const zip = userMemberData?.zip || userMemberData?.postalCode || "";

  // Anniversaire / âge
  const birthRaw =
    userMemberData?.birthDate ||
    userMemberData?.birthday ||
    userMemberData?.dateOfBirth ||
    null;
  const birthDate = parseMaybeDate(birthRaw);
  const age = useMemo(() => calcAge(birthDate), [birthDate]);
  const birthStr = birthDate ? formatIntl(birthDate, "dd/MM/yyyy") : "—";

  // Étudiant ?
  const isStudent = !!(userMemberData?.student ?? userMemberData?.etudiant ?? false);

  // Abonnement (statut depuis dates)
  const startDate = parseMaybeDate(userMemberData?.startDate);
  const endDate = parseMaybeDate(userMemberData?.endDate);
  const subscription = getMembershipStatus(startDate, endDate);
  const tone = toneClasses(subscription.tone);

  const startStr = startDate ? formatIntl(startDate, "dd/MM/yyyy") : "—";
  const endStr = endDate ? formatIntl(endDate, "dd/MM/yyyy") : "—";

  return (
    <div className="p-4 md:p-6 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Mon profil</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Consultez vos informations personnelles et l’état de votre abonnement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium">{displayName}</div>
            <div className="text-xs text-gray-600 dark:text-gray-300">Badge : {badgeId}</div>
          </div>
          <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-white dark:ring-gray-700 shadow-lg flex-shrink-0">
            {photo ? (
              <img
                src={photo}
                alt="avatar"
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-400">
                <FaUser />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bandeau "Identité" avec statut d’abonnement */}
      <div className="rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm mb-6">
        <div className="px-4 md:px-6 py-4 border-b dark:border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
              <FaShieldAlt />
            </div>
            <div>
              <div className="text-sm font-semibold">Identité & abonnement</div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                {displayName} {badgeId && badgeId !== "—" ? `(Badge : ${badgeId})` : ""}
              </div>
            </div>
          </div>

          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${tone.badge}`}>
            <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
            {subscription.label}
          </div>
        </div>

        {/* Tuiles récap : Étudiant, Anniversaire, Âge, Période abonnement */}
        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          <StatTile icon={FaGraduationCap} title="Statut étudiant" value={isStudent ? "Oui" : "Non"} accent="purple" />
          <StatTile icon={FaBirthdayCake} title="Anniversaire" value={birthStr} accent="orange" />
          <StatTile icon={FaChild} title="Âge" value={age ?? "—"} accent="green" />
          <StatTile icon={FaCalendarAlt} title="Abonnement" value={`${startStr} → ${endStr}`} accent="indigo" />
        </div>
      </div>

      {/* Détails de contact & adresse */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 md:p-6 rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
          <div className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Coordonnées</div>
          <div className="divide-y dark:divide-gray-700">
            <InfoRow icon={FaEnvelope} label="Email" value={email} />
            <InfoRow icon={FaPhone} label="Téléphone" value={phone || "—"} />
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
    </div>
  );
}

// ✅ FIN DU FICHIER
