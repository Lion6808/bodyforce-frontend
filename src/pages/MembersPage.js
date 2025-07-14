// src/pages/MembersPage.js

import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import MemberForm from "../components/MemberForm";
import { format, isBefore, parseISO } from "date-fns";
import { FaEdit, FaTrash } from "react-icons/fa";

function MembersPage() {
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);

  const fetchMembers = async () => {
    const { data, error } = await supabase.from("members").select("*");
    if (error) {
      console.error("Erreur récupération membres :", error.message);
    } else {
      setMembers(data || []);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    let result = members.filter((m) =>
      `${m.name} ${m.firstName}`.toLowerCase().includes(search.toLowerCase())
    );

    if (activeFilter === "Homme") result = result.filter((m) => m.gender === "Homme");
    else if (activeFilter === "Femme") result = result.filter((m) => m.gender === "Femme");
    else if (activeFilter === "Expiré") result = result.filter((m) => isBefore(parseISO(m.endDate), new Date()));
    else if (activeFilter === "Récent") {
      const now = new Date();
      result = result.filter((m) => {
        const date = parseISO(m.startDate);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      });
    }
    else if (activeFilter === "SansCertif") result = result.filter((m) => !m.files || m.files.length === 0 || m.files === "[]");

    result.sort((a, b) => {
      const nameA = a.name?.toLowerCase() || "";
      const nameB = b.name?.toLowerCase() || "";
      return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

    setFilteredMembers(result);
  }, [members, search, sortAsc, activeFilter]);

  const handleDelete = async (id) => {
    if (window.confirm("Supprimer ce membre ?")) {
      await supabase.from("members").delete().eq("id", id);
      fetchMembers();
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredMembers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMembers.map((m) => m.id));
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm("Supprimer les membres sélectionnés ?")) {
      for (const id of selectedIds) {
        await supabase.from("members").delete().eq("id", id);
      }
      setSelectedIds([]);
      fetchMembers();
    }
  };

  const getBadgeColor = (type) => {
    switch (type) {
      case "Mensuel": return "bg-green-100 text-green-800";
      case "Trimestriel": return "bg-yellow-100 text-yellow-800";
      case "Semestriel": return "bg-blue-100 text-blue-800";
      case "Annuel":
      case "Année civile": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const total = members.length;
  const maleCount = members.filter((m) => m.gender === "Homme").length;
  const femaleCount = members.filter((m) => m.gender === "Femme").length;
  const expiredCount = members.filter((m) => isBefore(parseISO(m.endDate), new Date())).length;
  const noCertCount = members.filter((m) => !m.files || m.files.length === 0 || m.files === "[]").length;
  const recentCount = members.filter((m) => {
    const date = parseISO(m.startDate);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Liste des membres</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <Widget title="👥 Membres au total" value={total} onClick={() => setActiveFilter(null)} />
        <Widget title="👨 Hommes" value={maleCount} onClick={() => setActiveFilter("Homme")} />
        <Widget title="👩 Femmes" value={femaleCount} onClick={() => setActiveFilter("Femme")} />
        <Widget title="📅 Abonnements expirés" value={expiredCount} onClick={() => setActiveFilter("Expiré")} />
        <Widget title="✅ Inscriptions récentes" value={recentCount} onClick={() => setActiveFilter("Récent")} />
        <Widget title="📂 Certificats manquants" value={noCertCount} onClick={() => setActiveFilter("SansCertif")} />
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mb-4">
        <div className="flex gap-2">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={() => {
              setSelectedMember(null);
              setShowForm(true);
            }}
          >
            + Ajouter un membre
          </button>
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              Supprimer ({selectedIds.length})
            </button>
          )}
        </div>
        <input
          type="text"
          placeholder="Recherche nom..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-2 rounded w-full sm:w-64"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full table-auto bg-white border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredMembers.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="p-2 border">Photo</th>
              <th className="p-2 border cursor-pointer" onClick={() => setSortAsc(!sortAsc)}>
                Nom {sortAsc ? "↑" : "↓"}
              </th>
              <th className="p-2 border">Prénom</th>
              <th className="p-2 border">Genre</th>
              <th className="p-2 border">Type</th>
              <th className="p-2 border">Début</th>
              <th className="p-2 border">Fin</th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((m) => (
              <tr
                key={m.id}
                onDoubleClick={() => {
                  setSelectedMember(m);
                  setShowForm(true);
                }}
                className="hover:bg-gray-50"
              >
                <td className="p-2 border text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.id)}
                    onChange={() => toggleSelect(m.id)}
                  />
                </td>
                <td className="p-2 border text-center">
                  {m.photo ? (
                    <img src={m.photo} alt="membre" className="w-10 h-10 rounded-full object-cover mx-auto" />
                  ) : "—"}
                </td>
                <td className="p-2 border">{m.name}</td>
                <td className="p-2 border">{m.firstName}</td>
                <td className="p-2 border">{m.gender}</td>
                <td className="p-2 border">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getBadgeColor(m.type)}`}>
                    {m.type}
                  </span>
                </td>
                <td className="p-2 border">{format(parseISO(m.startDate), "dd/MM/yyyy")}</td>
                <td className="p-2 border">{format(parseISO(m.endDate), "dd/MM/yyyy")}</td>
                <td className="p-2 border space-x-2 flex justify-center">
                  <button onClick={() => { setSelectedMember(m); setShowForm(true); }}
                          className="text-blue-600 hover:text-blue-800">
                    <FaEdit />
                  </button>
                  <button onClick={() => handleDelete(m.id)}
                          className="text-red-600 hover:text-red-800">
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-start justify-center overflow-auto">
          <div className="bg-white mt-10 rounded-xl p-4 max-w-4xl w-full shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Saisie Membre</h2>
              <button onClick={() => { setShowForm(false); setSelectedMember(null); }}
                      className="text-gray-600 hover:text-black">✕</button>
            </div>
            <MemberForm
              member={selectedMember}
              onSave={() => {
                setShowForm(false);
                setSelectedMember(null);
                fetchMembers();
              }}
              onCancel={() => {
                setShowForm(false);
                setSelectedMember(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Widget({ title, value, onClick }) {
  return (
    <div
      className="p-3 bg-white rounded shadow text-center cursor-pointer hover:bg-blue-50"
      onClick={onClick}
    >
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

export default MembersPage;
