import React, { useEffect, useState } from "react";
import axios from "axios";
import MemberForm from "../components/MemberForm";
import { format, isBefore, parseISO } from "date-fns";
import { FaEdit, FaTrash } from "react-icons/fa";

function MembersPage({ onEdit }) {
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null); // Ajout de l'état activeFilter

  const fetchMembers = async () => {
    try {
      const res = await axios.get("http://localhost:3001/api/members");
      setMembers(res.data);
    } catch (error) {
      console.error("Erreur lors de la récupération des membres:", error);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    let result = members.filter((m) =>
      `${m.name} ${m.firstName}`.toLowerCase().includes(search.toLowerCase())
    );

    // Appliquer les filtres en fonction de activeFilter
    if (activeFilter === "Homme" || activeFilter === "Femme") {
      result = result.filter((m) => m.gender === activeFilter);
    } else if (activeFilter === "Expiré") {
      result = result.filter((m) => isBefore(parseISO(m.endDate), new Date()));
    } else if (activeFilter === "Récent") {
      const now = new Date();
      result = result.filter((m) => {
        const date = parseISO(m.startDate);
        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      });
    } else if (activeFilter === "SansCertif") {
      result = result.filter(
        (m) => !m.files || m.files.length === 0 || m.files === "[]"
      );
    }

    result.sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

    setFilteredMembers(result);
  }, [members, search, sortAsc, activeFilter]);

  const handleDelete = async (id) => {
    if (window.confirm("Supprimer ce membre ?")) {
      await axios.delete(`http://localhost:3001/api/members/${id}`);
      fetchMembers();
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm("Supprimer les membres sélectionnés ?")) {
      await Promise.all(
        selectedIds.map((id) =>
          axios.delete(`http://localhost:3001/api/members/${id}`)
        )
      );
      setSelectedIds([]);
      fetchMembers();
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredMembers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMembers.map((m) => m.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const total = filteredMembers.length;
  const maleCount = filteredMembers.filter((m) => m.gender === "Homme").length;
  const femaleCount = filteredMembers.filter((m) => m.gender === "Femme").length;
  const expiredCount = filteredMembers.filter((m) =>
    isBefore(parseISO(m.endDate), new Date())
  ).length;
  const noCertCount = filteredMembers.filter(
    (m) => !m.files || m.files.length === 0 || m.files === "[]"
  ).length;
  const recentCount = filteredMembers.filter((m) => {
    const date = parseISO(m.startDate);
    const now = new Date();
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }).length;

  const getBadgeColor = (type) => {
    switch (type) {
      case проводится "Mensuel":
        return "bg-green-100 text-green-800";
      case "Trimestriel":
        return "bg-yellow-100 text-yellow-800";
      case "Semestriel":
        return "bg-blue-100 text-blue-800";
      case "Annuel":
      case "Année civile":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Liste des membres</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
        <Widget
          title="👥 Membres au total"
          value={total}
          onClick={() => setActiveFilter(null)} // Réinitialiser le filtre
        />
        <Widget
          title="👨 Hommes"
          value={maleCount}
          onClick={() => setActiveFilter("Homme")} // Filtrer par Homme
        />
        <Widget
          title="👩 Femmes"
          value={femaleCount}
          onClick={() => setActiveFilter("Femme")} // Filtrer par Femme
        />
        <Widget
          title="📅 Abonnements expirés"
          value={expiredCount}
          onClick={() => setActiveFilter("Expiré")} // Filtrer par Expiré
        />
        <Widget
          title="✅ Inscriptions récentes"
          value={recentCount}
          onClick={() => setActiveFilter("Récent")} // Filtrer par Récent
        />
        <Widget
          title="📂 Certificats manquants"
          value={noCertCount}
          onClick={() => setActiveFilter("SansCertif")} // Filtrer par SansCertif
        />
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
        <table className="w-full table-auto border-collapse bg-white shadow text-sm">
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
              <th
                className="p-2 border cursor-pointer select-none"
                onClick={() => setSortAsc(!sortAsc)}
              >
                Nom {sortAsc ? "▲" : "▼"}
              </th>
              <th className="p-2 border">Genre</th>
              <th className="p-2 border">Abonnement</th>
              <th className="p-2 border">Badge</th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="p-2 border text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.id)}
                    onChange={() => toggleSelect(m.id)}
                  />
                </td>
                <td className="p-2 border">
                  {m.photo ? (
                    <img
                      src={m.photo}
                      alt="membre"
                      className="w-10 h-10 object-cover rounded-full"
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td
                  className="p-2 border cursor-pointer"
                  onDoubleClick={() => {
                    setSelectedMember(m);
                    setShowForm(true);
                  }}
                >
                  {m.name} {m.firstName}
                </td>
                <td className="p-2 border">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      m.gender === "Femme"
                        ? "bg-pink-100 text-pink-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {m.gender}
                  </span>
                </td>
                <td className="p-2 border">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${getBadgeColor(
                      m.subscriptionType
                    )}`}
                  >
                    {m.subscriptionType}
                  </span>
                </td>
                <td className="p-2 border">{m.badgeId || "—"}</td>
                <td className="p-2 border space-x-2 flex">
                  <button
                    onClick={() => {
                      setSelectedMember(m);
                      setShowForm(true);
                    }}
                    className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                  >
                    <FaEdit />
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs"
                  >
                    <FaTrash />
                    Supprimer
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
              <button
                onClick={() => {
                  setShowForm(false);
                  setSelectedMember(null);
                }}
                className="text-gray-600 hover:text-black"
              >
                ✕
              </button>
            </div>
            <MemberForm
              member={selectedMember}
              onSave={async (member) => {
                if (member.id) {
                  await axios.put(
                    `http://localhost:3001/api/members/${member.id}`,
                    member
                  );
                } else {
                  await axios.post("http://localhost:3001/api/members", member);
                }
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
      className="p-3 bg-white rounded shadow text-center cursor-pointer hover:bg-gray-100"
      onClick={onClick}
    >
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

export default MembersPage;