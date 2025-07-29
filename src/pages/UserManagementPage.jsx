// UserManagementPage.jsx - Avec liaison aux membres
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import {
  FaUserShield,
  FaUserEdit,
  FaTrash,
  FaSyncAlt,
  FaCheck,
  FaTimes,
  FaExclamationTriangle,
  FaUserCircle,
  FaLink,
  FaUnlink,
} from "react-icons/fa";
import { toast } from "react-toastify";

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
      
      const { data: usersData, error: usersError } = await supabase
        .rpc('get_users_with_roles');

      if (usersError) {
        console.error("Erreur RPC:", usersError);
        throw usersError;
      }

      console.log("✅ Utilisateurs récupérés:", usersData);
      setUsers(usersData || []);
      
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
        .select('id, name, firstName, user_id')
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
      const { data, error } = await supabase
        .rpc('link_user_to_member', {
          target_user_id: userId,
          target_member_id: memberId
        });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Utilisateur lié au membre ${data.member_name}`);
        await fetchUsers();
        await fetchMembers();
      } else {
        throw new Error(data?.error || 'Erreur inconnue');
      }
    } catch (err) {
      toast.error(`Erreur liaison: ${err.message}`);
    }
  };

  const unlinkUserFromMember = async (memberId) => {
    try {
      const { data, error } = await supabase
        .rpc('unlink_user_from_member', {
          target_member_id: memberId
        });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Utilisateur délié du membre ${data.member_name}`);
        await fetchUsers();
        await fetchMembers();
      } else {
        throw new Error(data?.error || 'Erreur inconnue');
      }
    } catch (err) {
      toast.error(`Erreur délaison: ${err.message}`);
    }
  };

  const deleteUser = async (userId, userEmail) => {
    if (userId === user.id) {
      toast.warning("Vous ne pouvez pas désactiver votre propre compte.");
      return;
    }

    const confirmMessage = `Êtes-vous sûr de vouloir désactiver l'utilisateur "${userEmail}" ?\n\nL'utilisateur ne pourra plus se connecter.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      console.log(`🚫 Désactivation de l'utilisateur: ${userEmail}`);

      const { data, error } = await supabase
        .rpc('disable_user_admin', { target_user_id: userId });

      if (error) throw error;

      if (data?.success) {
        console.log("✅ Utilisateur désactivé avec succès");
        toast.success(`Utilisateur "${userEmail}" désactivé avec succès`);
        
        await fetchUsers();
      } else {
        throw new Error(data?.error || "Erreur inconnue lors de la désactivation");
      }
      
    } catch (err) {
      console.error("❌ Erreur désactivation:", err);
      toast.error(`Échec de la désactivation: ${err.message}`);
    }
  };

  // Obtenir le membre lié à un utilisateur
  const getLinkedMember = (userId) => {
    return members.find(member => member.user_id === userId);
  };

  // Obtenir les membres non liés
  const getUnlinkedMembers = () => {
    return members.filter(member => !member.user_id);
  };

  // Vérification des permissions
  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <FaExclamationTriangle className="text-red-600 dark:text-red-400 text-2xl" />
            <h2 className="text-xl font-bold text-red-800 dark:text-red-300">
              Accès refusé
            </h2>
          </div>
          <p className="text-red-700 dark:text-red-400 mb-4">
            Vous devez être administrateur pour accéder à cette page.
          </p>
          <p className="text-sm text-red-600 dark:text-red-500">
            Votre rôle actuel : <span className="font-mono bg-red-100 dark:bg-red-800 px-2 py-1 rounded">{role || 'user'}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        {/* En-tête */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaUserShield className="text-2xl text-blue-600 dark:text-blue-400" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                Gestion des utilisateurs
              </h2>
            </div>
            
            <button
              onClick={() => {
                fetchUsers();
                fetchMembers();
              }}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors duration-200"
            >
              <FaSyncAlt className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Actualisation...' : 'Actualiser'}
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-300">Chargement...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FaExclamationTriangle className="text-red-600 dark:text-red-400" />
                <span className="font-semibold text-red-800 dark:text-red-300">Erreur</span>
              </div>
              <p className="text-red-700 dark:text-red-400">{error}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                      Email
                    </th>
                    <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                      Rôle
                    </th>
                    <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                      Membre lié
                    </th>
                    <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                      Statut
                    </th>
                    <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, index) => {
                    const linkedMember = getLinkedMember(u.user_id || u.id);
                    return (
                      <tr 
                        key={u.user_id || u.id} 
                        className={`
                          ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}
                          hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors duration-150
                        `}
                      >
                        <td className="p-4 border-b border-gray-200 dark:border-gray-600">
                          <div className="flex items-center gap-2">
                            <FaUserCircle className="text-gray-400 dark:text-gray-500" />
                            <span className="font-medium text-gray-900 dark:text-white">
                              {u.user_email || u.email}
                            </span>
                            {(u.user_id || u.id) === user.id && (
                              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                Vous
                              </span>
                            )}
                            {u.is_disabled && (
                              <span className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded">
                                Désactivé
                              </span>
                            )}
                          </div>
                        </td>
                        
                        <td className="p-4 border-b border-gray-200 dark:border-gray-600">
                          <select
                            value={u.user_role || u.role || 'user'}
                            onChange={(e) => updateRole(u.user_id || u.id, e.target.value)}
                            className="border border-gray-300 dark:border-gray-600 rounded px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={(u.user_id || u.id) === user.id || u.is_disabled}
                          >
                            <option value="user">Utilisateur</option>
                            <option value="admin">Administrateur</option>
                          </select>
                        </td>

                        <td className="p-4 border-b border-gray-200 dark:border-gray-600">
                          {linkedMember ? (
                            <div className="flex items-center gap-2">
                              <span className="text-green-600 dark:text-green-400">
                                {linkedMember.firstName} {linkedMember.name}
                              </span>
                              <button
                                onClick={() => unlinkUserFromMember(linkedMember.id)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Délier"
                              >
                                <FaUnlink className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  linkUserToMember(u.user_id || u.id, parseInt(e.target.value));
                                  e.target.value = '';
                                }
                              }}
                              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              disabled={u.is_disabled}
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
                        
                        <td className="p-4 border-b border-gray-200 dark:border-gray-600">
                          {u.confirmed_at ? (
                            <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                              <FaCheck className="w-4 h-4" />
                              Confirmé
                            </span>
                          ) : (
                            <span className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                              <FaTimes className="w-4 h-4" />
                              En attente
                            </span>
                          )}
                        </td>
                        
                        <td className="p-4 border-b border-gray-200 dark:border-gray-600">
                          <button
                            onClick={() => deleteUser(u.user_id || u.id, u.user_email || u.email)}
                            disabled={(u.user_id || u.id) === user.id}
                            className="flex items-center gap-2 px-3 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={(u.user_id || u.id) === user.id ? "Vous ne pouvez pas supprimer votre propre compte" : "Désactiver cet utilisateur"}
                          >
                            <FaTrash className="w-4 h-4" />
                            {u.is_disabled ? 'Réactiver' : 'Désactiver'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {users.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <FaUserShield className="mx-auto text-4xl mb-4 opacity-50" />
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