import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaPlus, FaEdit, FaTrash } from "react-icons/fa";

const API = process.env.REACT_APP_API_URL;

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ username: "", password: "", role: "user" });
  const [editingUserId, setEditingUserId] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const rawUser = localStorage.getItem("user");
      const res = await axios.get(`${API}/api/users`, {
        headers: { Authorization: rawUser },
      });
      setUsers(res.data);
    } catch (err) {
      setError("Erreur lors du chargement des utilisateurs");
    }
  };

  const handleSave = async () => {
    try {
      const rawUser = localStorage.getItem("user");

      if (editingUserId) {
        await axios.put(`${API}/api/users/${editingUserId}`, form, {
          headers: { Authorization: rawUser },
        });
      } else {
        await axios.post(`${API}/api/users`, form, {
          headers: { Authorization: rawUser },
        });
      }

      setForm({ username: "", password: "", role: "user" });
      setEditingUserId(null);
      fetchUsers();
    } catch (err) {
      setError("Erreur lors de l'enregistrement");
    }
  };

  const handleEdit = (user) => {
    setForm({ username: user.username, password: "", role: user.role });
    setEditingUserId(user.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Confirmer la suppression ?")) return;
    try {
      const rawUser = localStorage.getItem("user");
      await axios.delete(`${API}/api/users/${id}`, {
        headers: { Authorization: rawUser },
      });
      fetchUsers();
    } catch (err) {
      setError("Erreur lors de la suppression");
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Gestion des utilisateurs</h2>

      {error && <div className="text-red-500 mb-2">{error}</div>}

      <div className="mb-6 bg-white shadow rounded p-4">
        <h3 className="font-bold mb-2">{editingUserId ? "Modifier" : "Ajouter"} un utilisateur</h3>
        <input
          type="text"
          placeholder="Nom d'utilisateur"
          className="border rounded px-3 py-2 mr-2 mb-2"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <input
          type="password"
          placeholder="Mot de passe"
          className="border rounded px-3 py-2 mr-2 mb-2"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="border rounded px-3 py-2 mr-2 mb-2"
        >
          <option value="user">Utilisateur</option>
          <option value="admin">Administrateur</option>
        </select>
        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-4 py-2 rounded mr-2"
        >
          <FaPlus className="inline mr-1" />
          {editingUserId ? "Mettre à jour" : "Ajouter"}
        </button>
        {editingUserId && (
          <button
            onClick={() => {
              setForm({ username: "", password: "", role: "user" });
              setEditingUserId(null);
            }}
            className="bg-gray-500 text-white px-4 py-2 rounded"
          >
            Annuler
          </button>
        )}
      </div>

      <table className="min-w-full bg-white border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2">ID</th>
            <th className="border px-4 py-2">Nom</th>
            <th className="border px-4 py-2">Rôle</th>
            <th className="border px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="border px-4 py-2">{u.id}</td>
              <td className="border px-4 py-2">{u.username}</td>
              <td className="border px-4 py-2">{u.role}</td>
              <td className="border px-4 py-2 space-x-2">
                <button
                  onClick={() => handleEdit(u)}
                  className="text-yellow-600 hover:underline"
                >
                  <FaEdit className="inline" />
                </button>
                <button
                  onClick={() => handleDelete(u.id)}
                  className="text-red-600 hover:underline"
                >
                  <FaTrash className="inline" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
