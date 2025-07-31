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
  FaEdit,
  FaEye,
  FaUserShield,
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
      
      // Récupérer les données complètes du membre lié à cet utilisateur
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (memberError && memberError.code !== 'PGRST116') { // PGRST116 = pas de résultat
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

  // Fonction pour déterminer le statut global du membre
  const getMemberStatus = () => {
    if (!memberData) return { text: 'Non défini', status: 'unknown' };
    
    const endDate = memberData.endDate ? new Date(memberData.endDate) : null;
    const now = new Date();
    const isActive = memberData.isActive;
    
    // Si le membre est marqué comme inactif, il est inactif
    if (!isActive) {
      return { text: 'Inactif', status: 'expired' };
    }
    
    // Si pas de date de fin, on se base uniquement sur isActive
    if (!endDate) {
      return isActive ? { text: 'Actif', status: 'active' } : { text: 'Inactif', status: 'expired' };
    }
    
    const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    
    // Si l'abonnement est expiré ET le membre actif, c'est une incohérence
    if (daysLeft < 0) {
      return { text: isActive ? 'Abonnement expiré' : 'Inactif', status: 'expired' };
    } else if (daysLeft <= 30) {
      return { text: `Expire dans ${daysLeft} jour(s)`, status: 'warning' };
    } else {
      return { text: 'Actif', status: 'active' };
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

  const memberStatus = getMemberStatus();
  const age = calculateAge(memberData.birthDate);

  return (
    <div className={styles.container}>
      <div className={styles.profileCard}>
        {/* En-tête avec photo et infos principales */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.avatar}>
              <FaUser className={styles.avatarIcon} />
            </div>
            <div className={styles.headerInfo}>
              <h1 className={styles.memberName}>
                {memberData.firstName} {memberData.name}
              </h1>
              <div className={styles.memberMeta}>
                <span className={styles.metaItem}>
                  <FaCalendarAlt className={styles.metaIcon} />
                  Membre depuis {formatDate(memberData.startDate)}
                </span>
                {role && (
                  <span className={`${styles.roleBadge} ${styles[`role${role.charAt(0).toUpperCase() + role.slice(1)}`]}`}>
                    <FaUserShield className={styles.roleIcon} />
                    {role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Statut d'abonnement unifié */}
          <div className={`${styles.subscriptionStatus} ${styles[memberStatus.status]}`}>
            <div className={styles.statusIndicator}></div>
            <span className={styles.statusText}>{memberStatus.text}</span>
          </div>
        </div>

        {/* Contenu principal */}
        <div className={styles.content}>
          <div className={styles.grid}>
            {/* Informations personnelles */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FaUser className={styles.sectionIcon} />
                Informations personnelles
              </h2>
              
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <FaEnvelope className={styles.infoIcon} />
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Email</span>
                    <span className={styles.infoValue}>{memberData.email || 'Non renseigné'}</span>
                  </div>
                </div>

                <div className={styles.infoItem}>
                  <FaPhone className={styles.infoIcon} />
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Téléphone</span>
                    <span className={styles.infoValue}>{memberData.phone || 'Non renseigné'}</span>
                  </div>
                </div>

                <div className={styles.infoItem}>
                  <FaMobile className={styles.infoIcon} />
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Mobile</span>
                    <span className={styles.infoValue}>{memberData.mobile || 'Non renseigné'}</span>
                  </div>
                </div>

                <div className={styles.infoItem}>
                  <FaBirthdayCake className={styles.infoIcon} />
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Date de naissance</span>
                    <span className={styles.infoValue}>
                      {memberData.birthDate ? (
                        <>
                          {formatDate(memberData.birthDate)}
                          {age && <span className={styles.ageInfo}> ({age} ans)</span>}
                        </>
                      ) : 'Non renseigné'}
                    </span>
                  </div>
                </div>

                <div className={styles.infoItem}>
                  <FaVenusMars className={styles.infoIcon} />
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Genre</span>
                    <span className={styles.infoValue}>
                      {memberData.gender === 'M' ? 'Masculin' : 
                       memberData.gender === 'F' ? 'Féminin' : 'Non renseigné'}
                    </span>
                  </div>
                </div>

                <div className={styles.infoItem}>
                  <FaMapMarkerAlt className={styles.infoIcon} />
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Adresse</span>
                    <span className={styles.infoValue}>
                      {memberData.address || 'Non renseigné'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Informations d'abonnement */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FaCreditCard className={styles.sectionIcon} />
                Abonnement
              </h2>
              
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <FaCalendarAlt className={styles.infoIcon} />
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Date de début</span>
                    <span className={styles.infoValue}>{formatDate(memberData.startDate)}</span>
                  </div>
                </div>

                <div className={styles.infoItem}>
                  <FaCalendarAlt className={styles.infoIcon} />
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Date de fin</span>
                    <span className={styles.infoValue}>{formatDate(memberData.endDate)}</span>
                  </div>
                </div>

                <div className={styles.infoItem}>
                  <FaCreditCard className={styles.infoIcon} />
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Type d'abonnement</span>
                    <span className={styles.infoValue}>{memberData.subscriptionType || 'Non défini'}</span>
                  </div>
                </div>

                <div className={styles.infoItem}>
                  <div className={`${styles.statusIndicator} ${memberStatus.status === 'active' ? styles.active : styles.inactive}`}></div>
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Statut du membre</span>
                    <span className={`${styles.infoValue} ${memberStatus.status === 'active' ? styles.activeText : styles.inactiveText}`}>
                      {memberStatus.text}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Informations de contact d'urgence */}
            {(memberData.emergencyContact || memberData.emergencyPhone) && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <FaUserFriends className={styles.sectionIcon} />
                  Contact d'urgence
                </h2>
                
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <FaUser className={styles.infoIcon} />
                    <div className={styles.infoContent}>
                      <span className={styles.infoLabel}>Nom du contact</span>
                      <span className={styles.infoValue}>{memberData.emergencyContact || 'Non renseigné'}</span>
                    </div>
                  </div>

                  <div className={styles.infoItem}>
                    <FaPhone className={styles.infoIcon} />
                    <div className={styles.infoContent}>
                      <span className={styles.infoLabel}>Téléphone d'urgence</span>
                      <span className={styles.infoValue}>{memberData.emergencyPhone || 'Non renseigné'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Informations médicales */}
            {(memberData.medicalInfo || memberData.allergies || memberData.medications) && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <FaNotesMedical className={styles.sectionIcon} />
                  Informations médicales
                </h2>
                
                <div className={styles.medicalInfo}>
                  {memberData.medicalInfo && (
                    <div className={styles.medicalItem}>
                      <h4 className={styles.medicalSubtitle}>Informations médicales</h4>
                      <p className={styles.medicalText}>{memberData.medicalInfo}</p>
                    </div>
                  )}
                  
                  {memberData.allergies && (
                    <div className={styles.medicalItem}>
                      <h4 className={styles.medicalSubtitle}>Allergies</h4>
                      <p className={styles.medicalText}>{memberData.allergies}</p>
                    </div>
                  )}
                  
                  {memberData.medications && (
                    <div className={styles.medicalItem}>
                      <h4 className={styles.medicalSubtitle}>Médicaments</h4>
                      <p className={styles.medicalText}>{memberData.medications}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {memberData.notes && (
            <div className={styles.notesSection}>
              <h3 className={styles.notesTitle}>
                <FaClipboardList className={styles.sectionIcon} />
                Notes
              </h3>
              <p className={styles.notesText}>{memberData.notes}</p>
            </div>
          )}

          {/* Informations administratives */}
          <div className={styles.adminInfo}>
            <h3 className={styles.adminTitle}>Informations administratives</h3>
            <div className={styles.adminGrid}>
              <div className={styles.adminItem}>
                <span className={styles.adminLabel}>ID Membre:</span>
                <span className={styles.adminValue}>{memberData.id}</span>
              </div>
              <div className={styles.adminItem}>
                <span className={styles.adminLabel}>Créé le:</span>
                <span className={styles.adminValue}>{formatDate(memberData.created_at)}</span>
              </div>
              <div className={styles.adminItem}>
                <span className={styles.adminLabel}>Modifié le:</span>
                <span className={styles.adminValue}>{formatDate(memberData.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Message d'information */}
          <div className={styles.infoMessage}>
            <p className={styles.infoMessageText}>
              <strong>💡 Information :</strong> Pour modifier vos informations personnelles, 
              contactez la réception ou un administrateur du club.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserProfilePage;