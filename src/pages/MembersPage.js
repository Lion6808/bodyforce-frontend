import React, { useEffect, useState } from "react";
import { supabaseServices } from "../supabaseClient";
import MemberForm from "../components/MemberForm";
import { format, isBefore, parseISO } from "date-fns";
import { FaEdit, FaTrash, FaPlus, FaSync  } from "react-icons/fa";

function MembersPage() {
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseServices.getMembers();
      setMembers(data);
      console.log(`✅ ${data.length} membres chargés depuis Supabase`);
    } catch (err) {
      console.error("Erreur récupération membres :", err);
      setError(`Erreur lors du chargement: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    let result = members.filter((m) =>
      `${m.name || ''} ${m.firstName || ''}`.toLowerCase().includes(search.toLowerCase())
    );

    // Appliquer les filtres
    if (activeFilter === "Homme") {
      result = result.filter((m) => m.gender === "Homme");
    } else if (activeFilter === "Femme") {
      result = result.filter((m) => m.gender === "Femme");
    } else if (activeFilter === "Etudiant") {
      result = result.filter((m) => m.etudiant);
    } else if (activeFilter === "Expiré") {
      result = result.filter((m) => {
        if (!m.endDate) return true; // Pas de date = expiré
        try {
          return isBefore(parseISO(m.endDate), new Date());
        } catch (e) {
          return true; // Date invalide = expiré
        }
      });
    } else if (activeFilter === "Récent") {
      const now = new Date();
      result = result.filter((m) => {
        if (!m.startDate) return false;
        try {
          const date = parseISO(m.startDate);
          return (
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear()
          );
        } catch (e) {
          return false;
        }
      });
    } else if (activeFilter === "SansCertif") {
      result = result.filter((m) => {
        if (!m.files) return true;
        if (Array.isArray(m.files)) return m.files.length === 0;
        if (typeof m.files === 'string') return m.files === '[]' || m.files === '';
        return Object.keys(m.files).length === 0;
      });
    }

    // Tri par nom
    result.sort((a, b) => {
      const nameA = (a.name || "").toLowerCase();
      const nameB = (b.name || "").toLowerCase();
      return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

    setFilteredMembers(result);
  }, [members, search, sortAsc, activeFilter]);

  const handleDelete = async (id) => {
    if (window.confirm("Supprimer ce membre ? Cette action est irréversible.")) {
      try {
        await supabaseServices.deleteMember(id);
        await fetchMembers(); // Recharger la liste
        console.log(`✅ Membre ${id} supprimé`);
      } catch (err) {
        console.error("Erreur suppression:", err);
        alert(`Erreur lors de la suppression: ${err.message}`);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Supprimer les ${selectedIds.length} membres sélectionnés ? Cette action est irréversible.`)) {
      try {
        for (const id of selectedIds) {
          await supabaseServices.deleteMember(id);
        }
        setSelectedIds([]);
        await fetchMembers();
        console.log(`✅ ${selectedIds.length} membres supprimés`);
      } catch (err) {
        console.error("Erreur suppression multiple:", err);
        alert(`Erreur lors de la suppression: ${err.message}`);
      }
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

  // Calculer les statistiques
  const total = filteredMembers.length;
  const maleCount = filteredMembers.filter((m) => m.gender === "Homme").length;
  const femaleCount = filteredMembers.filter((m) => m.gender === "Femme").length;
  const expiredCount = filteredMembers.filter((m) => {
    if (!m.endDate) return true;
    try {
      return isBefore(parseISO(m.endDate), new Date());
    } catch (e) {
      return true;
    }
  }).length;
  
  const noCertCount = filteredMembers.filter((m) => {
    if (!m.files) return true;
    if (Array.isArray(m.files)) return m.files.length === 0;
    if (typeof m.files === 'string') return m.files === '[]' || m.files === '';
    return Object.keys(m.files).length === 0;
  }).length;
  
  const recentCount = filteredMembers.filter((m) => {
    if (!m.startDate) return false;
    try {
      const date = parseISO(m.startDate);
      const now = new Date();
      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    } catch (e) {
      return false;
    }
  }).length;

  const studentCount = filteredMembers.filter((m) => m.etudiant).length;

  const getBadgeColor = (type) => {
    switch (type) {
      case "Mensuel":
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des membres depuis Supabase...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-50 rounded-xl border border-red-200">
        <div className="text-red-600 mb-4">⚠️ Erreur</div>
        <p className="text-gray-700 mb-4">{error}</p>
        <button
          onClick={fetchMembers}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
        >
          <Fasync />
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">Liste des membres</h1>
          <p className="text-gray-600">
            {members.length} membres dans la base Supabase
          </p>
        </div>
        <button
          onClick={fetchMembers}
          disabled={loading}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors inline-flex items-center gap-2 disabled:opacity-50"
          title="Actualiser la liste"
        >
          <FaSync className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {activeFilter && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex justify-between items-center">
            <span className="text-blue-700">
              Filtre actif : <strong>{activeFilter}</strong> ({filteredMembers.length} résultat{filteredMembers.length !== 1 ? 's' : ''})
            </span>
            <button
              onClick={() => setActiveFilter(null)}
              className="text-blue-500 hover:text-blue-700 underline text-sm"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      )}

      {/* Widgets de statistiques */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-6">
        <Widget title="👥 Total" value={total} onClick={() => setActiveFilter(null)} active={!activeFilter} />
        <Widget title="👨 Hommes" value={maleCount} onClick={() => setActiveFilter("Homme")} active={activeFilter === "Homme"} />
        <Widget title="👩 Femmes" value={femaleCount} onClick={() => setActiveFilter("Femme")} active={activeFilter === "Femme"} />
        <Widget title="🎓 Étudiants" value={studentCount} onClick={() => setActiveFilter("Etudiant")} active={activeFilter === "Etudiant"} />
        <Widget title="📅 Expirés" value={expiredCount} onClick={() => setActiveFilter("Expiré")} active={activeFilter === "Expiré"} />
        <Widget title="✅ Récents" value={recentCount} onClick={() => setActiveFilter("Récent")} active={activeFilter === "Récent"} />
        <Widget title="📂 Sans certif" value={noCertCount} onClick={() => setActiveFilter("SansCertif")} active={activeFilter === "SansCertif"} />
      </div>

      {/* Barre d'actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 p-4 bg-white rounded-lg shadow-sm border">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg w-full sm:w-auto inline-flex items-center justify-center gap-2 transition-colors"
            onClick={() => {
              setSelectedMember(null);
              setShowForm(true);
            }}
          >
            <FaPlus />
            Ajouter un membre
          </button>
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg w-full sm:w-auto inline-flex items-center justify-center gap-2 transition-colors"
            >
              <FaTrash />
              Supprimer ({selectedIds.length})
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <input
            type="text"
            placeholder="🔍 Rechercher nom, prénom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 px-4 py-2 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tableau des membres */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredMembers.length && filteredMembers.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </th>
                <th className="p-3 text-left">Photo</th>
                <th className="p-3 text-left">
                  <button
                    onClick={() => setSortAsc(!sortAsc)}
                    className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                  >
                    Nom {sortAsc ? "▲" : "▼"}
                  </button>
                </th>
                <th className="p-3 text-left">Infos</th>
                <th className="p-3 text-left">Abonnement</th>
                <th className="p-3 text-left">Badge</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-gray-500">
                    {search || activeFilter 
                      ? "Aucun membre ne correspond aux critères de recherche"
                      : "Aucun membre trouvé dans la base de données"
                    }
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const isExpired = member.endDate ? (() => {
                    try {
                      return isBefore(parseISO(member.endDate), new Date());
                    } catch (e) {
                      return true;
                    }
                  })() : true;

                  const hasFiles = member.files && (
                    Array.isArray(member.files) ? member.files.length > 0 :
                    typeof member.files === 'string' ? member.files !== '[]' && member.files !== '' :
                    Object.keys(member.files).length > 0
                  );

                  return (
                    <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(member.id)}
                          onChange={() => toggleSelect(member.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                      </td>
                      
                      <td className="p-3">
                        <img
                          src={
                            member.photo ||
                            (member.gender === "Femme"
                              ? "/images/default_female.png"
                              : "/images/default_male.png")
                          }
                          alt="avatar"
                          className="w-12 h-12 object-cover rounded-full border border-gray-200"
                          onError={(e) => {
                            e.target.src = member.gender === "Femme" 
                              ? "https://via.placeholder.com/48/FF69B4/FFFFFF?text=F"
                              : "https://via.placeholder.com/48/4169E1/FFFFFF?text=H";
                          }}
                        />
                      </td>
                      
                      <td
                        className="p-3 cursor-pointer hover:text-blue-600 transition-colors"
                        onDoubleClick={() => {
                          setSelectedMember(member);
                          setShowForm(true);
                        }}
                        title="Double-clic pour modifier"
                      >
                        <div className="font-medium text-gray-900">
                          {member.name} {member.firstName}
                        </div>
                        <div className="text-sm text-gray-500">ID: {member.id}</div>
                      </td>
                      
                      <td className="p-3">
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              member.gender === "Femme"
                                ? "bg-pink-100 text-pink-700"
                                : "bg-blue-100 text-blue-700"
                            }`}>
                              {member.gender}
                            </span>
                            {member.etudiant && (
                              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-medium">
                                🎓 Étudiant
                              </span>
                            )}
                          </div>
                          {member.email && (
                            <div className="text-gray-600 text-xs truncate max-w-[200px]" title={member.email}>
                              📧 {member.email}
                            </div>
                          )}
                          {member.mobile && (
                            <div className="text-gray-600 text-xs">📱 {member.mobile}</div>
                          )}
                        </div>
                      </td>
                      
                      <td className="p-3">
                        <div className="space-y-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBadgeColor(member.subscriptionType)}`}>
                            {member.subscriptionType || "Non défini"}
                          </span>
                          {member.startDate && (
                            <div className="text-xs text-gray-500">
                              Début: {member.startDate}
                            </div>
                          )}
                          {member.endDate && (
                            <div className={`text-xs ${isExpired ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                              Fin: {member.endDate}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      <td className="p-3">
                        <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm font-mono">
                          {member.badgeId || "—"}
                        </span>
                      </td>
                      
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          {isExpired ? (
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                              ⚠️ Expiré
                            </span>
                          ) : (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                              ✅ Actif
                            </span>
                          )}
                          {hasFiles ? (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                              📄 Docs OK
                            </span>
                          ) : (
                            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                              📄 Manquant
                            </span>
                          )}
                        </div>
                      </td>
                      
                      <td className="p-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => {
                              setSelectedMember(member);
                              setShowForm(true);
                            }}
                            className="flex items-center gap-1 bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded text-sm transition-colors"
                            title="Modifier ce membre"
                          >
                            <FaEdit className="w-3 h-3" />
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDelete(member.id)}
                            className="flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm transition-colors"
                            title="Supprimer ce membre"
                          >
                            <FaTrash className="w-3 h-3" />
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Résumé en bas */}
      {filteredMembers.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
          Affichage de {filteredMembers.length} membre{filteredMembers.length !== 1 ? 's' : ''} sur {members.length} total
          {selectedIds.length > 0 && (
            <span className="ml-4 text-blue-600 font-medium">
              • {selectedIds.length} sélectionné{selectedIds.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Modal du formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-start justify-center overflow-auto">
          <div className="bg-white mt-4 mb-4 rounded-xl shadow-xl w-full max-w-4xl mx-4">
            <MemberForm
              member={selectedMember}
              onSave={async (memberData, closeModal) => {
                try {
                  console.log("💾 Sauvegarde membre:", selectedMember ? "Modification" : "Création");
                  
                  if (selectedMember?.id) {
                    // Modification d'un membre existant
                    await supabaseServices.updateMember(selectedMember.id, memberData);
                    console.log("✅ Membre modifié:", selectedMember.id);
                  } else {
                    // Création d'un nouveau membre
                    const newMember = await supabaseServices.createMember(memberData);
                    console.log("✅ Nouveau membre créé:", newMember.id);
                  }
                  
                  // Fermer le modal si demandé
                  if (closeModal) {
                    setShowForm(false);
                    setSelectedMember(null);
                  }
                  
                  // Recharger la liste
                  await fetchMembers();
                } catch (error) {
                  console.error("❌ Erreur sauvegarde membre:", error);
                  alert(`Erreur lors de la sauvegarde: ${error.message}`);
                }
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

// Composant Widget pour les statistiques
function Widget({ title, value, onClick, active = false }) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg text-center cursor-pointer transition-all hover:scale-105 border-2 ${
        active
          ? 'bg-blue-100 border-blue-300 shadow-md'
          : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200 shadow-sm'
      }`}
    >
      <div className={`text-sm ${active ? 'text-blue-700 font-medium' : 'text-gray-500'}`}>
        {title}
      </div>
      <div className={`text-xl font-bold ${active ? 'text-blue-800' : 'text-gray-800'}`}>
        {value}
      </div>
    </div>
  );
}

export default MembersPage;