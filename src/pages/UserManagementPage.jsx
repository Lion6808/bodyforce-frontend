// 📄 UserManagementPage.jsx — BODYFORCE
// 🎯 Interface interactive d'administration des utilisateurs Supabase
// 🔹 Partie 1 : Imports, état, récupération des utilisateurs et rôles

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
} from "react-icons/fa";
import { toast } from "react-toastify";

function UserManagementPage() {
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setRefreshing(true);
    try {
      // 1. Récupérer les utilisateurs Supabase (auth.users)
      const {
        data: { users: allUsers },
        error: usersError,
      } = await supabase.auth.admin.listUsers();

      if (usersError) throw usersError;

      // 2. Récupérer les rôles depuis la table `user_roles`
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // 3. Créer un dictionnaire id => role
      const roleMap = {};
      rolesData.forEach((entry) => {
        roleMap[entry.user_id] = entry.role;
      });

      setUsers(allUsers);
      setRoles(roleMap);
      setError(null);
    } catch (err) {
      console.error("Erreur récupération utilisateurs :", err);
      setError("Impossible de récupérer les utilisateurs.");
    }
    setRefreshing(false);
    setLoading(false);
  };
  const updateRole = async (userId, newRole) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: newRole }, { onConflict: ["user_id"] });

      if (error) throw error;

      toast.success("Rôle mis à jour !");
      fetchUsers();
    } catch (err) {
      console.error("Erreur mise à jour rôle :", err);
      toast.error("Échec mise à jour du rôle.");
    }
  };

  const deleteUser = async (userId) => {
    if (userId === user.id) {
      toast.warning("Vous ne pouvez pas supprimer votre propre compte.");
      return;
    }

    if (!window.confirm("Supprimer définitivement cet utilisateur ?")) return;

    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;

      toast.success("Utilisateur supprimé.");
      fetchUsers();
    } catch (err) {
      console.error("Erreur suppression :", err);
      toast.error("Échec suppression.");
    }
  };
  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
        <FaUserShield /> Gestion des utilisateurs
      </h2>

      <button
        onClick={fetchUsers}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
        disabled={refreshing}
      >
        <FaSyncAlt /> Actualiser
      </button>

      {loading ? (
        <p className="text-gray-600 dark:text-gray-300">Chargement...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200 dark:bg-gray-700 text-left text-sm">
                <th className="p-2">Email</th>
                <th className="p-2">Rôle</th>
                <th className="p-2">Confirmé</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-gray-300 dark:border-gray-600 text-sm">
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">
                    <select
                      value={roles[u.id] || "user"}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      className="border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:text-white"
                    >
                      <option value="admin">admin</option>
                      <option value="user">user</option>
                    </select>
                  </td>
                  <td className="p-2">
                    {u.confirmed_at ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <FaCheck /> Oui
                      </span>
                    ) : (
                      <span className="text-yellow-600 flex items-center gap-1">
                        <FaTimes /> Non
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="text-red-600 hover:text-red-800 flex items-center gap-1"
                    >
                      <FaTrash /> Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default UserManagementPage;
