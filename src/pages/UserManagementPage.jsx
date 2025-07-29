// UserManagementPage.jsx - Version avec CSS Module
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import {
  FaUserShield,
  FaTrash,
  FaSyncAlt,
  FaCheck,
  FaTimes,
  FaExclamationTriangle,
  FaUserCircle,
  FaUnlink,
} from "react-icons/fa";
import { toast } from "react-toastify";
import styles from "./UserManagementPage.module.css";

function UserManagementPage() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchMembers();
    } else {
      setError("Accès refusé : Vous devez être administrateur pour accéder à cette page.");
      setLoading(false);
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setRefreshing(true);
    setError(null);

    try {
      console.log("🔍 Récupération des utilisateurs...");

      const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();

      if (usersError) {
        throw usersError;
      }

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        console.warn("Attention: impossible de récupérer les rôles:", rolesError);
      }

      const usersWithRoles = usersData.users.map(u => {
        const userRole = rolesData?.find(r => r.user_id === u.id);
        return {
          id: u.id,
          email: u.email,
          role: userRole?.role || 'user',
          confirmed_at: u.confirmed_at,
          created_at: u.created_at,
          is_disabled: false
        };
      });

      console.log("✅ Utilisateurs récupérés:", usersWithRoles);
      setUsers(usersWithRoles || []);

    } catch (err) {
      console.error("❌ Erreur récupération utilisateurs:", err);
      setError(`Impossible de récupérer les utilisateurs: ${err.message}`);
      toast.error("Erreur lors de la récupération des utilisateurs");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('id,name,firstName,user_id,email,phone,mobile,subscriptionType,startDate,endDate')
        .order('name', { ascending: true });

      if (membersError) throw membersError;

      setMembers(membersData || []);
    } catch (err) {
      console.error("❌ Erreur récupération membres:", err);
    }
  };

  const updateRole = async (userId, newRole) => {
    try {
      console.log(`🔄 Mise à jour du rôle pour ${userId}: ${newRole}`);

      const { error } = await supabase
        .from("user_roles")
        .upsert(
          { user_id: userId, role: newRole },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      console.log("✅ Rôle mis à jour avec succès");
      toast.success(`Rôle mis à jour vers: ${newRole}`);

      await fetchUsers();

    } catch (err) {
      console.error("❌ Erreur mise à jour rôle:", err);
      toast.error(`Échec de la mise à jour: ${err.message}`);
    }
  };

  const linkUserToMember = async (userId, memberId) => {
    try {
      const { data: existingMember } = await supabase
        .from('members')
        .select('user_id, firstName, name')
        .eq('id', memberId)
        .single();

      if (existingMember?.user_id) {
        toast.error('Ce membre est déjà lié à un utilisateur');
        return;
      }

      await supabase
        .from('members')
        .update({ user_id: null })
        .eq('user_id', userId);

      const { error } = await supabase
        .from('members')
        .update({ user_id: userId })
        .eq('id', memberId);

      if (error) throw error;

      toast.success(`Utilisateur lié au membre ${existingMember.firstName} ${existingMember.name}`);
      await fetchUsers();
      await fetchMembers();

    } catch (err) {
      console.error("❌ Erreur liaison:", err);
      toast.error(`Erreur liaison: ${err.message}`);
    }
  };

  const unlinkUserFromMember = async (memberId) => {
    try {
      const { data: memberData } = await supabase
        .from('members')
        .select('firstName, name')
        .eq('id', memberId)
        .single();

      const { error } = await supabase
        .from('members')
        .update({ user_id: null })
        .eq('id', memberId);

      if (error) throw error;

      toast.success(`Utilisateur délié du membre ${memberData?.firstName} ${memberData?.name}`);
      await fetchUsers();
      await fetchMembers();

    } catch (err) {
      console.error("❌ Erreur délaison:", err);
      toast.error(`Erreur délaison: ${err.message}`);
    }
  };

  const deleteUser = async (userId, userEmail) => {
    if (userId === user.id) {
      toast.warning("Vous ne pouvez pas supprimer votre propre compte.");
      return;
    }

    const confirmMessage = `Êtes-vous sûr de vouloir supprimer l'utilisateur "${userEmail}" ?\n\nCette action est irréversible.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      console.log(`🚫 Suppression de l'utilisateur: ${userEmail}`);

      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      await supabase
        .from('members')
        .update({ user_id: null })
        .eq('user_id', userId);

      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) throw error;

      console.log("✅ Utilisateur supprimé avec succès");
      toast.success(`Utilisateur "${userEmail}" supprimé avec succès`);

      await fetchUsers();
      await fetchMembers();

    } catch (err) {
      console.error("❌ Erreur suppression:", err);
      toast.error(`Échec de la suppression: ${err.message}`);
    }
  };

  const getLinkedMember = (userId) => {
    return members.find(member => member.user_id === userId);
  };

  const getUnlinkedMembers = () => {
    return members.filter(member => !member.user_id);
  };

  // Vérification des permissions
  if (!isAdmin) {
    return (
      <div className={styles.accessDeniedContainer}>
        <div className={styles.accessDeniedCard}>
          <div className={styles.accessDeniedHeader}>
            <FaExclamationTriangle className={styles.accessDeniedIcon} />
            <h2 className={styles.accessDeniedTitle}>
              Accès refusé
            </h2>
          </div>
          <p className={styles.accessDeniedText}>
            Vous devez être administrateur pour accéder à cette page.
          </p>
          <p className={styles.roleDisplay}>
            Votre rôle actuel : <span className={styles.roleDisplayCode}>{role || 'user'}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* En-tête */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <FaUserShield className={styles.headerIcon} />
            <h2 className={styles.headerTitle}>
              Gestion des utilisateurs
            </h2>
          </div>

          <button
            onClick={() => {
              fetchUsers();
              fetchMembers();
            }}
            disabled={refreshing}
            className={styles.refreshButton}
          >
            <FaSyncAlt className={`${styles.refreshIcon} ${refreshing ? styles.spinning : ''}`} />
            {refreshing ? 'Actualisation...' : 'Actualiser'}
          </button>
        </div>

        {/* Contenu */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <span className={styles.loadingText}>Chargement...</span>
            </div>
          ) : error ? (
            <div className={styles.errorContainer}>
              <div className={styles.errorHeader}>
                <FaExclamationTriangle className={styles.errorIcon} />
                <span className={styles.errorTitle}>Erreur</span>
              </div>
              <p className={styles.errorMessage}>{error}</p>
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead className={styles.tableHeader}>
                  <tr>
                    <th className={styles.tableHeaderCell}>Email</th>
                    <th className={styles.tableHeaderCell}>Rôle</th>
                    <th className={styles.tableHeaderCell}>Membre lié</th>
                    <th className={styles.tableHeaderCell}>Statut</th>
                    <th className={styles.tableHeaderCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, index) => {
                    const linkedMember = getLinkedMember(u.id);
                    const rowClass = `${styles.tableRow} ${
                      index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd
                    }`;

                    return (
                      <tr key={u.id} className={rowClass}>
                        <td className={styles.tableCell}>
                          <div className={styles.userInfo}>
                            <FaUserCircle className={styles.userIcon} />
                            <span className={styles.userEmail}>
                              {u.email}
                            </span>
                            {u.id === user.id && (
                              <span className={`${styles.userBadge} ${styles.userBadgeYou}`}>
                                Vous
                              </span>
                            )}
                          </div>
                        </td>

                        <td className={styles.tableCell}>
                          <select
                            value={u.role || 'user'}
                            onChange={(e) => updateRole(u.id, e.target.value)}
                            className={styles.roleSelect}
                            disabled={u.id === user.id}
                          >
                            <option value="user">Utilisateur</option>
                            <option value="admin">Administrateur</option>
                          </select>
                        </td>

                        <td className={styles.tableCell}>
                          {linkedMember ? (
                            <div className={styles.linkedMember}>
                              <span className={styles.linkedMemberName}>
                                {linkedMember.firstName} {linkedMember.name}
                              </span>
                              <button
                                onClick={() => unlinkUserFromMember(linkedMember.id)}
                                className={styles.unlinkButton}
                                title="Délier"
                              >
                                <FaUnlink className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  linkUserToMember(u.id, parseInt(e.target.value));
                                  e.target.value = '';
                                }
                              }}
                              className={styles.memberSelect}
                            >
                              <option value="">Sélectionner un membre</option>
                              {getUnlinkedMembers().map(member => (
                                <option key={member.id} value={member.id}>
                                  {member.firstName} {member.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>

                        <td className={styles.tableCell}>
                          {u.confirmed_at ? (
                            <span className={styles.statusConfirmed}>
                              <FaCheck className={styles.statusIcon} />
                              Confirmé
                            </span>
                          ) : (
                            <span className={styles.statusPending}>
                              <FaTimes className={styles.statusIcon} />
                              En attente
                            </span>
                          )}
                        </td>

                        <td className={styles.tableCell}>
                          <button
                            onClick={() => deleteUser(u.id, u.email)}
                            disabled={u.id === user.id}
                            className={styles.deleteButton}
                            title={u.id === user.id ? "Vous ne pouvez pas supprimer votre propre compte" : "Supprimer cet utilisateur"}
                          >
                            <FaTrash className={styles.deleteButtonIcon} />
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {users.length === 0 && (
                <div className={styles.emptyState}>
                  <FaUserShield className={styles.emptyStateIcon} />
                  <p>Aucun utilisateur trouvé</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserManagementPage;