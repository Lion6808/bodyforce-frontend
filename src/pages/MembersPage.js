import React, { useEffect, useState } from "react";
import MemberForm from "../components/MemberForm";
import { format, isBefore, parseISO } from "date-fns";
import { FaEdit, FaTrash } from "react-icons/fa";
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
    try {
      const { data, error } = await supabase.from("members").select("*");
      if (error) {
        console.error("Erreur Supabase:", error.message, error.details, error.hint);
        return;
      }
      console.log("Données récupérées:", data);
      setMembers(data || []);
    } catch (err) {
      console.error("Erreur inattendue:", err);
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
    <div className="px-2 sm:px-4">
      <h1 className="text-2xl font-bold mb-4">Liste des Membres</h1>

      {/* Tableau des membres */}
      <table className="w-full mt-6 table-auto border border-gray-200 rounded-xl">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Nom</th>
            <th className="p-2">Prénom</th>
            <th className="p-2">Genre</th>
            <th className="p-2">Abonnement</th>
            <th className="p-2">Début</th>
            <th className="p-2">Fin</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredMembers.map((m) => (
            <tr key={m.id} className="border-t hover:bg-gray-50">
              <td className="p-2">{m.name}</td>
              <td className="p-2">{m.firstName}</td>
              <td className="p-2">{m.gender}</td>
              <td className="p-2">
                <span className={`px-2 py-1 rounded ${getBadgeColor(m.subscriptionType)}`}>
                  {m.subscriptionType}
                </span>
              </td>
              <td className="p-2">{format(new Date(m.startDate), "dd/MM/yyyy")}</td>
              <td className="p-2">{format(new Date(m.endDate), "dd/MM/yyyy")}</td>
              <td className="p-2 flex gap-2">
                <button
                  onClick={() => {
                    setSelectedMember(m);
                    setShowForm(true);
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <FaTrash />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Formulaire modal */}
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

export default MembersPage;
