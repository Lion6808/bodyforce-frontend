import React, { useState } from "react";
import axios from "axios";
import { FaKey } from "react-icons/fa";

function ProfilePage({ user }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      await axios.put("/api/users/change-password", { oldPassword, newPassword });
      setMessage("Mot de passe modifié avec succès.");
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      setMessage("Erreur : mot de passe actuel incorrect.");
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <FaKey /> Modifier mon mot de passe
      </h2>
      <form onSubmit={handleChangePassword} className="space-y-3">
        <input
          type="password"
          placeholder="Mot de passe actuel"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          className="w-full border px-3 py-2 rounded"
          required
        />
        <input
          type="password"
          placeholder="Nouveau mot de passe"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border px-3 py-2 rounded"
          required
        />
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
          Modifier
        </button>
      </form>
      {message && <p className="mt-3 text-center text-sm">{message}</p>}
    </div>
  );
}

export default ProfilePage;