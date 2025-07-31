// src/pages/UserProfilePage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaMobile,
  FaCalendarAlt,
  FaCreditCard,
  FaExclamationTriangle,
  FaIdCard,
  FaMapMarkerAlt,
  FaUserFriends,
  FaVenusMars,
  FaBirthdayCake,
  FaNotesMedical,
  FaClipboardList,
  FaUserShield,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
} from "react-icons/fa";

function UserProfilePage() {
  const { user, role, loading: authLoading } = useAuth();
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Attendre que l'authentification soit terminée
    if (authLoading) {
      console.log("⏳ En attente de l'authentification...");
      return;
    }

    if (!user) {
      console.log("❌ Pas d'utilisateur connecté");
      setLoading(false);
      return;
    }

    console.log("🚀 Lancement fetchMemberData - User:", user.email);
    fetchMemberData();
  }, [user, authLoading]);

  const fetchMemberData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("🔄 Récupération profil pour user:", user?.id);

      // Récupérer les données complètes du membre lié à cet utilisateur
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberError) {
        console.error("❌ Erreur récupération membre:", memberError);
        throw memberError;
      }

      if (memberData) {
        console.log(
          "✅ Données membre trouvées:",
          memberData.firstName,
          memberData.name
        );
        console.log("🔍 Genre du membre:", {
          raw: memberData.gender,
          type: typeof memberData.gender,
          length: memberData.gender?.length,
        });
        setMemberData(memberData);
      } else {
        console.log("⚠️ Aucun profil membre trouvé pour cet utilisateur");
        setMemberData(null);
      }
    } catch (err) {
      console.error("❌ Erreur récupération profil:", err);
      setError(`Impossible de récupérer votre profil: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Non renseigné";
    try {
      return new Date(dateString).toLocaleDateString("fr-FR");
    } catch (error) {
      console.warn("Erreur formatage date:", error);
      return "Date invalide";
    }
  };

  // ✅ CORRECTION - Fonction pour déterminer le statut basé UNIQUEMENT sur les dates
  const getMemberStatus = () => {
    if (!memberData) return { text: "Non défini", status: "unknown" };

    // ✅ Se baser UNIQUEMENT sur les dates de début et fin
    const startDate = memberData.startDate
      ? new Date(memberData.startDate)
      : null;
    const endDate = memberData.endDate ? new Date(memberData.endDate) : null;
    const now = new Date();

    // Si pas de date de début, statut inconnu
    if (!startDate || isNaN(startDate.getTime())) {
      return { text: "Dates non définies", status: "unknown" };
    }

    // Si l'abonnement n'a pas encore commencé
    if (startDate > now) {
      const daysUntilStart = Math.ceil(
        (startDate - now) / (1000 * 60 * 60 * 24)
      );
      return {
        text: `Commence dans ${daysUntilStart} jour(s)`,
        status: "warning",
      };
    }

    // Si pas de date de fin, considéré comme actif (abonnement illimité)
    if (!endDate || isNaN(endDate.getTime())) {
      return { text: "Actif (illimité)", status: "active" };
    }

    const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

    // Si l'abonnement est expiré
    if (daysLeft < 0) {
      const daysExpired = Math.abs(daysLeft);
      return {
        text: `Expiré depuis ${daysExpired} jour(s)`,
        status: "expired",
      };
    }
    // Si l'abonnement expire bientôt (dans les 30 jours)
    else if (daysLeft <= 30) {
      return { text: `Expire dans ${daysLeft} jour(s)`, status: "warning" };
    }
    // Abonnement actif
    else {
      return { text: "Actif", status: "active" };
    }
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    try {
      const today = new Date();
      const birth = new Date(birthDate);
      if (isNaN(birth.getTime())) return null;

      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();

      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birth.getDate())
      ) {
        age--;
      }
      return age;
    } catch (error) {
      console.warn("Erreur calcul âge:", error);
      return null;
    }
  };

  // ✅ CORRECTION - Fonction pour formater le genre
  const formatGender = (gender) => {
    if (!gender) return "Non renseigné";

    const genderLower = gender.toString().toLowerCase().trim();

    // Masculin
    if (["m", "homme", "h", "masculin", "male", "man"].includes(genderLower)) {
      return "Masculin";
    }

    // Féminin
    if (
      ["f", "femme", "féminin", "feminine", "female", "woman"].includes(
        genderLower
      )
    ) {
      return "Féminin";
    }

    // Si format non reconnu, afficher tel quel avec première lettre en majuscule
    return gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
  };

  const InfoTile = ({
    icon: Icon,
    label,
    value,
    iconColor = "text-blue-600 dark:text-blue-400",
    bgColor = "bg-blue-50 dark:bg-blue-900/20",
  }) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-600 hover:scale-105">
      <div className="flex items-start gap-4">
        <div className={`p-3 ${bgColor} rounded-xl flex-shrink-0`}>
          <Icon className={`text-xl ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-base font-semibold text-slate-900 dark:text-white break-words">
            {value || "Non renseigné"}
          </p>
        </div>
      </div>
    </div>
  );

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-300">
            {authLoading
              ? "Authentification..."
              : "Chargement de votre profil..."}
          </p>
        </div>
      </div>
    );
  }

  // Pas d'utilisateur connecté
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl max-w-md w-full border border-amber-200 dark:border-amber-800">
          <div className="text-center">
            <div className="p-4 bg-amber-100 dark:bg-amber-900/20 rounded-xl mb-4 inline-block">
              <FaExclamationTriangle className="text-2xl text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Non connecté
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Vous devez être connecté pour accéder à votre profil.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl max-w-md w-full border border-red-200 dark:border-red-800">
          <div className="text-center">
            <div className="p-4 bg-red-100 dark:bg-red-900/20 rounded-xl mb-4 inline-block">
              <FaExclamationTriangle className="text-2xl text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Erreur
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">{error}</p>
            <button
              onClick={fetchMemberData}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl transition-colors font-medium"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!memberData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl max-w-md w-full border border-amber-200 dark:border-amber-800">
          <div className="text-center">
            <div className="p-4 bg-amber-100 dark:bg-amber-900/20 rounded-xl mb-4 inline-block">
              <FaExclamationTriangle className="text-2xl text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Profil non configuré
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Votre compte utilisateur n'est pas encore lié à un profil de
              membre.
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Contactez un administrateur pour associer votre compte à votre
              profil de membre.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const memberStatus = getMemberStatus();
  const age = calculateAge(memberData.birthDate);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header avec photo et infos principales */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-700 dark:to-cyan-700 text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-filter backdrop-blur-sm border-4 border-white border-opacity-30">
                {memberData.photo ? (
                  <img
                    src={memberData.photo}
                    alt="Photo de profil"
                    className="w-20 h-20 sm:w-28 sm:h-28 rounded-full object-cover"
                  />
                ) : (
                  <FaUser className="text-3xl sm:text-4xl text-white" />
                )}
              </div>
              {/* Badge statut */}
              <div
                className={`absolute -bottom-2 -right-2 p-2 rounded-full ${
                  memberStatus.status === "active"
                    ? "bg-emerald-500"
                    : memberStatus.status === "warning"
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
              >
                {memberStatus.status === "active" ? (
                  <FaCheckCircle className="text-white text-sm" />
                ) : memberStatus.status === "warning" ? (
                  <FaExclamationTriangle className="text-white text-sm" />
                ) : (
                  <FaTimesCircle className="text-white text-sm" />
                )}
              </div>
            </div>

            {/* Informations principales */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                {memberData.firstName || ""} {memberData.name || ""}
              </h1>

              <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                <div className="flex items-center gap-2 bg-white bg-opacity-20 px-3 py-1 rounded-full">
                  <FaCalendarAlt className="text-sm" />
                  <span className="text-sm">
                    Membre depuis {formatDate(memberData.startDate)}
                  </span>
                </div>

                {role && (
                  <div
                    className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                      role === "admin"
                        ? "bg-red-500 bg-opacity-20 border border-red-300 border-opacity-30"
                        : "bg-blue-500 bg-opacity-20 border border-blue-300 border-opacity-30"
                    }`}
                  >
                    <FaUserShield className="text-sm" />
                    <span className="text-sm font-medium">
                      {role === "admin" ? "Administrateur" : "Utilisateur"}
                    </span>
                  </div>
                )}
              </div>

              {/* Statut d'abonnement */}
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl backdrop-filter backdrop-blur-sm border border-white border-opacity-30 ${
                  memberStatus.status === "active"
                    ? "bg-emerald-500 bg-opacity-20"
                    : memberStatus.status === "warning"
                    ? "bg-amber-500 bg-opacity-20"
                    : "bg-red-500 bg-opacity-20"
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full animate-pulse ${
                    memberStatus.status === "active"
                      ? "bg-emerald-300"
                      : memberStatus.status === "warning"
                      ? "bg-amber-300"
                      : "bg-red-300"
                  }`}
                ></div>
                <span className="font-semibold">{memberStatus.text}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Grille d'informations */}
        <div className="space-y-8">
          {/* Informations personnelles */}
          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-xl">
                <FaUser className="text-blue-600 dark:text-blue-400" />
              </div>
              Informations personnelles
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoTile
                icon={FaEnvelope}
                label="Email"
                value={memberData.email}
                iconColor="text-purple-600 dark:text-purple-400"
                bgColor="bg-purple-50 dark:bg-purple-900/20"
              />
              <InfoTile
                icon={FaPhone}
                label="Téléphone"
                value={memberData.phone}
                iconColor="text-green-600 dark:text-green-400"
                bgColor="bg-green-50 dark:bg-green-900/20"
              />
              <InfoTile
                icon={FaMobile}
                label="Mobile"
                value={memberData.mobile}
                iconColor="text-emerald-600 dark:text-emerald-400"
                bgColor="bg-emerald-50 dark:bg-emerald-900/20"
              />
              <InfoTile
                icon={FaBirthdayCake}
                label="Date de naissance"
                value={
                  memberData.birthDate
                    ? `${formatDate(memberData.birthDate)}${
                        age ? ` (${age} ans)` : ""
                      }`
                    : null
                }
                iconColor="text-pink-600 dark:text-pink-400"
                bgColor="bg-pink-50 dark:bg-pink-900/20"
              />
              {/* ✅ CORRECTION - Affichage du genre corrigé */}
              <InfoTile
                icon={FaVenusMars}
                label="Genre"
                value={formatGender(memberData.gender)}
                iconColor="text-indigo-600 dark:text-indigo-400"
                bgColor="bg-indigo-50 dark:bg-indigo-900/20"
              />
              <InfoTile
                icon={FaMapMarkerAlt}
                label="Adresse"
                value={memberData.address}
                iconColor="text-orange-600 dark:text-orange-400"
                bgColor="bg-orange-50 dark:bg-orange-900/20"
              />
            </div>
          </section>

          {/* Informations d'abonnement */}
          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
              <div className="p-2 bg-cyan-100 dark:bg-cyan-900/20 rounded-xl">
                <FaCreditCard className="text-cyan-600 dark:text-cyan-400" />
              </div>
              Abonnement
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <InfoTile
                icon={FaCalendarAlt}
                label="Date de début"
                value={formatDate(memberData.startDate)}
                iconColor="text-blue-600 dark:text-blue-400"
                bgColor="bg-blue-50 dark:bg-blue-900/20"
              />
              <InfoTile
                icon={FaCalendarAlt}
                label="Date de fin"
                value={formatDate(memberData.endDate)}
                iconColor="text-sky-600 dark:text-sky-400"
                bgColor="bg-sky-50 dark:bg-sky-900/20"
              />
              <InfoTile
                icon={FaCreditCard}
                label="Type d'abonnement"
                value={memberData.subscriptionType}
                iconColor="text-violet-600 dark:text-violet-400"
                bgColor="bg-violet-50 dark:bg-violet-900/20"
              />
              <InfoTile
                icon={FaIdCard}
                label="ID Badge"
                value={memberData.badgeId}
                iconColor="text-slate-600 dark:text-slate-400"
                bgColor="bg-slate-50 dark:bg-slate-900/20"
              />
            </div>

            {/* Statut détaillé */}
            <div
              className={`mt-6 p-6 rounded-2xl border-2 ${
                memberStatus.status === "active"
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                  : memberStatus.status === "warning"
                  ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                  : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-xl ${
                    memberStatus.status === "active"
                      ? "bg-emerald-100 dark:bg-emerald-800"
                      : memberStatus.status === "warning"
                      ? "bg-amber-100 dark:bg-amber-800"
                      : "bg-red-100 dark:bg-red-800"
                  }`}
                >
                  {memberStatus.status === "active" ? (
                    <FaCheckCircle
                      className={`text-2xl text-emerald-600 dark:text-emerald-400`}
                    />
                  ) : memberStatus.status === "warning" ? (
                    <FaExclamationTriangle
                      className={`text-2xl text-amber-600 dark:text-amber-400`}
                    />
                  ) : (
                    <FaTimesCircle
                      className={`text-2xl text-red-600 dark:text-red-400`}
                    />
                  )}
                </div>
                <div>
                  <h3
                    className={`text-lg font-semibold ${
                      memberStatus.status === "active"
                        ? "text-emerald-800 dark:text-emerald-200"
                        : memberStatus.status === "warning"
                        ? "text-amber-800 dark:text-amber-200"
                        : "text-red-800 dark:text-red-200"
                    }`}
                  >
                    Statut d'abonnement
                  </h3>
                  <p
                    className={`${
                      memberStatus.status === "active"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : memberStatus.status === "warning"
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-red-700 dark:text-red-300"
                    }`}
                  >
                    {memberStatus.text}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Informations de contact d'urgence */}
          {(memberData.emergencyContact || memberData.emergencyPhone) && (
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-xl">
                  <FaUserFriends className="text-red-600 dark:text-red-400" />
                </div>
                Contact d'urgence
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoTile
                  icon={FaUser}
                  label="Nom du contact"
                  value={memberData.emergencyContact}
                  iconColor="text-red-600 dark:text-red-400"
                  bgColor="bg-red-50 dark:bg-red-900/20"
                />
                <InfoTile
                  icon={FaPhone}
                  label="Téléphone d'urgence"
                  value={memberData.emergencyPhone}
                  iconColor="text-red-600 dark:text-red-400"
                  bgColor="bg-red-50 dark:bg-red-900/20"
                />
              </div>
            </section>
          )}

          {/* Informations médicales */}
          {(memberData.medicalInfo ||
            memberData.allergies ||
            memberData.medications) && (
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <div className="p-2 bg-teal-100 dark:bg-teal-900/20 rounded-xl">
                  <FaNotesMedical className="text-teal-600 dark:text-teal-400" />
                </div>
                Informations médicales
              </h2>

              <div className="space-y-4">
                {memberData.medicalInfo && (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-700">
                    <h4 className="font-semibold text-teal-600 dark:text-teal-400 mb-3 flex items-center gap-2">
                      <FaNotesMedical className="text-sm" />
                      Informations médicales
                    </h4>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {memberData.medicalInfo}
                    </p>
                  </div>
                )}

                {memberData.allergies && (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-700">
                    <h4 className="font-semibold text-orange-600 dark:text-orange-400 mb-3 flex items-center gap-2">
                      <FaExclamationTriangle className="text-sm" />
                      Allergies
                    </h4>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {memberData.allergies}
                    </p>
                  </div>
                )}

                {memberData.medications && (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-700">
                    <h4 className="font-semibold text-purple-600 dark:text-purple-400 mb-3 flex items-center gap-2">
                      <FaCreditCard className="text-sm" />
                      Médicaments
                    </h4>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {memberData.medications}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Notes */}
          {memberData.notes && (
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-xl">
                  <FaClipboardList className="text-yellow-600 dark:text-yellow-400" />
                </div>
                Notes
              </h2>

              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-2xl p-6 border border-yellow-200 dark:border-yellow-800">
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {memberData.notes}
                </p>
              </div>
            </section>
          )}

          {/* Informations administratives */}
          <section className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-2xl p-6 border border-slate-200 dark:border-slate-600">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3">
              <FaInfoCircle className="text-slate-600 dark:text-slate-400" />
              Informations administratives
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  ID Membre:
                </span>
                <span className="text-slate-900 dark:text-white font-mono">
                  {memberData.id}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  Créé le:
                </span>
                <span className="text-slate-900 dark:text-white">
                  {formatDate(memberData.created_at)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  Modifié le:
                </span>
                <span className="text-slate-900 dark:text-white">
                  {formatDate(memberData.updated_at)}
                </span>
              </div>
            </div>
          </section>

          {/* Message d'information */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-xl flex-shrink-0">
                <FaInfoCircle className="text-blue-600 dark:text-blue-400 text-xl" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  💡 Informations importantes
                </h3>
                <p className="text-blue-700 dark:text-blue-300 leading-relaxed">
                  Pour modifier vos informations personnelles, contactez la
                  réception ou un administrateur du club. Vos données sont
                  sécurisées et ne sont accessibles qu'aux personnes autorisées.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserProfilePage;
