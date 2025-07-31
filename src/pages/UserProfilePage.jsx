// src/pages/UserProfilePage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import {
  FaUser, FaEnvelope, FaPhone, FaMobile, FaCalendarAlt,
  FaCreditCard, FaExclamationTriangle, FaIdCard, FaMapMarkerAlt,
  FaUserFriends, FaVenusMars, FaBirthdayCake, FaNotesMedical,
  FaClipboardList, FaUserShield, FaClock
} from "react-icons/fa";
import styles from "./UserProfilePage.module.css";

function UserProfilePage() {
  const { user, role } = useAuth();
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      fetchMemberData();
    }
  }, [user]);

  const fetchMemberData = async () => {
    try {
      setLoading(true);
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (memberError && memberError.code !== 'PGRST116') {
        throw memberError;
      }
      setMemberData(memberData);
    } catch (err) {
      console.error("❌ Erreur récupération profil:", err);
      setError(`Impossible de récupérer votre profil: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Non renseigné';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getMemberStatus = () => {
    if (!memberData?.startDate || !memberData?.endDate) {
      return { text: 'Inconnu', status: 'unknown', icon: <FaClock />, color: '#CBD5E0' };
    }

    const now = new Date();
    const end = new Date(memberData.endDate);
    const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: 'Abonnement expiré', status: 'expired', icon: <FaExclamationTriangle />, color: '#E53E3E' };
    } else if (diffDays <= 30) {
      return { text: `Expire dans ${diffDays} jours`, status: 'warning', icon: <FaClock />, color: '#ED8936' };
    } else {
      return { text: 'Abonnement actif', status: 'active', icon: <FaCreditCard />, color: '#38A169' };
    }
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const memberStatus = getMemberStatus();
  const age = calculateAge(memberData?.birthDate);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <span className={styles.loadingText}>Chargement de votre profil...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <div className={styles.errorHeader}>
            <FaExclamationTriangle className={styles.errorIcon} />
            <h2 className={styles.errorTitle}>Erreur</h2>
          </div>
          <p className={styles.errorMessage}>{error}</p>
        </div>
      </div>
    );
  }

  if (!memberData) {
    return (
      <div className={styles.container}>
        <div className={styles.warningCard}>
          <div className={styles.warningHeader}>
            <FaExclamationTriangle className={styles.warningIcon} />
            <h2 className={styles.warningTitle}>Profil non configuré</h2>
          </div>
          <p className={styles.warningMessage}>
            Votre compte utilisateur n'est pas encore lié à un profil de membre.
          </p>
          <p className={styles.warningSubMessage}>
            Contactez un administrateur pour associer votre compte à votre profil de membre.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Mon Profil</h1>

      {/* Statut d’abonnement */}
      <div className={styles.statusCard}>
        <div
          className={styles.statCard}
          style={{ backgroundColor: memberStatus.color }}
        >
          <div className={styles.statIcon}>{memberStatus.icon}</div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Statut</span>
            <span className={styles.statValue}>{memberStatus.text}</span>
          </div>
        </div>
      </div>

      {/* Informations membre */}
      <div className={styles.profileCard}>
        <div className={styles.section}>
          <h2><FaUser /> Identité</h2>
          <p><strong>Nom :</strong> {memberData.name}</p>
          <p><strong>Prénom :</strong> {memberData.firstName}</p>
          <p><strong>Sexe :</strong> {memberData.gender}</p>
          <p><strong>Date de naissance :</strong> {formatDate(memberData.birthDate)} ({age ? `${age} ans` : 'Âge inconnu'})</p>
          <p><strong>Étudiant :</strong> {memberData.etudiant ? 'Oui' : 'Non'}</p>
        </div>

        <div className={styles.section}>
          <h2><FaMapMarkerAlt /> Coordonnées</h2>
          <p><strong>Adresse :</strong> {memberData.address || 'Non renseignée'}</p>
          <p><strong>Téléphone :</strong> {memberData.phone || 'Non renseigné'}</p>
          <p><strong>Portable :</strong> {memberData.mobile || 'Non renseigné'}</p>
          <p><strong>Email :</strong> {memberData.email || 'Non renseigné'}</p>
        </div>

        <div className={styles.section}>
          <h2><FaCreditCard /> Abonnement</h2>
          <p><strong>Type :</strong> {memberData.subscriptionType || 'Non défini'}</p>
          <p><strong>Date début :</strong> {formatDate(memberData.startDate)}</p>
          <p><strong>Date fin :</strong> {formatDate(memberData.endDate)}</p>
          <p><strong>Badge :</strong> {memberData.badgeId || 'Non attribué'}</p>
        </div>

        <div className={styles.section}>
          <h2><FaClipboardList /> Documents</h2>
          {memberData.files && memberData.files.length > 0 ? (
            <ul>
              {memberData.files.map((file, index) => (
                <li key={index}>
                  <a href={file.url} target="_blank" rel="noopener noreferrer">
                    📄 {file.name}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p>Aucun document fourni</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserProfilePage;
