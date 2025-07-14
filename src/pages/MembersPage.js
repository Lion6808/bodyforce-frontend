import React, { useEffect, useState } from "react";
import MemberForm from "../components/MemberForm";
import { format, isBefore, parseISO } from "date-fns";
import {
  FaEdit,
  FaTrash,
  FaUser,
  FaUserGraduate,
  FaCalendarTimes,
  FaUserClock,
  FaUserPlus,
} from "react-icons/fa";
import { supabase } from "../supabaseClient";

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
      console.error("Erreur Supabase:", error.message);
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

    if (activeFilter === "Homme" || activeFilter === "Femme") {
      result = result.filter((m) => m.gender === activeFilter);
    } else if (activeFilter === "Etudiant") {
      result = result.filter((m) => m.student);
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
      await supabase.from("members").delete().eq("id", id);
      fetchMembers();
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
  const studentCount = filteredMembers.filter((m) => m.student).length;

  const getBadgeColor = (type) => {
    switch (type) {
      case "Mensuel":
        return "bg-green-100 text-green-800";
      case "Trimestriel":
        return "bg-yellow-100 text-yellow-800";
      case "Semestriel":
        return "bg-blue-100 text-blue-800";
      case "Annuel":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={<FaUser />} label="Total" value={total} />
        <StatCard icon={<FaUserClock />} label="Expirés" value={expiredCount} />
        <StatCard icon={<FaUserPlus />} label="Récents" value={recentCount} />
        <StatCard icon={<FaUserGraduate />} label="Étudiants" value={studentCount} />
        <StatCard icon={<FaCalendarTimes />} label="Sans Certif" value={noCertCount} />
        <StatCard icon={<FaUser />} label="Femmes" value={femaleCount} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Recherche..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded"
        />
        <button onClick={() => setSortAsc(!sortAsc)} className="btn">
          {sortAsc ? "A-Z" : "Z-A"}
        </button>
        {["Homme", "Femme", "Etudiant", "Expiré", "Récent", "SansCertif"].map(
          (f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`btn ${
                activeFilter === f ? "bg-blue-500 text-white" : "bg-gray-100"
              }`}
            >
              {f}
            </button>
          )
        )}
        <button onClick={() => setActiveFilter(null)} className="btn bg-gray-300">
          Réinitialiser
        </button>
        <button
          onClick={() => setShowForm(true)}
          className="btn bg-green-500 text-white ml-auto"
        >
          Ajouter un membre
        </button>
        {selectedIds.length > 0 && (
          <button onClick={handleBulkDelete} className="btn bg-red-500 text-white">
            Supprimer sélection
          </button>
        )}
      </div>

      <table className="w-full table-auto border">
        <thead>
          <tr className="bg-gray-200">
            <th>
              <input
                type="checkbox"
                onChange={toggleSelectAll}
                checked={selectedIds.length === filteredMembers.length}
              />
            </th>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Sexe</th>
            <th>Abonnement</th>
            <th>Début</th>
            <th>Fin</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredMembers.map((m) => (
            <tr key={m.id} className="border-b hover:bg-gray-50">
              <td>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(m.id)}
                  onChange={() => toggleSelect(m.id)}
                />
              </td>
              <td>{m.name}</td>
              <td>{m.firstName}</td>
              <td>{m.gender}</td>
              <td>
                <span
                  className={`px-2 py-1 text-sm rounded ${getBadgeColor(
                    m.subscriptionType
                  )}`}
                >
                  {m.subscriptionType}
                </span>
              </td>
              <td>{m.startDate && format(parseISO(m.startDate), "dd/MM/yyyy")}</td>
              <td>{m.endDate && format(parseISO(m.endDate), "dd/MM/yyyy")}</td>
              <td className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedMember(m);
                    setShowForm(true);
                  }}
                  className="btn bg-blue-500 text-white"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="btn bg-red-500 text-white"
                >
                  <FaTrash />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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

function StatCard({ icon, label, value }) {
  return (
    <div className="p-4 bg-white rounded shadow flex items-center gap-4">
      <div className="text-3xl text-blue-500">{icon}</div>
      <div>
        <h3 className="text-sm text-gray-500">{label}</h3>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

export default MembersPage;
