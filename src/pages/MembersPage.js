// ✅ MembersPage.js COMPLET avec repositionnement automatique
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabaseServices } from "../supabaseClient";
import MemberForm from "../components/MemberForm";
import { format, isBefore, parseISO } from "date-fns";
import {
  FaEdit,
  FaTrash,
  FaPlus,
  FaSync,
  FaUser,
  FaExternalLinkAlt,
} from "react-icons/fa";

function MembersPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ NOUVEAU : Récupérer l'ID du membre depuis l'état de navigation
  const returnedFromEdit = location.state?.returnedFromEdit;
  const editedMemberId = location.state?.editedMemberId;

  // ✅ États existants
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [activeFilter, setActiveFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageErrors, setImageErrors] = useState(new Set());

  // ✅ États pour l'approche hybride
  const [selectedMember, setSelectedMember] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // ✅ NOUVEAU : Ref pour les éléments membres
  const memberRefs = useRef({});

  // ✅ Détection de la taille d'écran
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ✅ NOUVEAU : Effet pour le repositionnement après retour d'édition
  useEffect(() => {
    if (
      returnedFromEdit &&
      editedMemberId &&
      !loading &&
      filteredMembers.length > 0
    ) {
      // Petit délai pour s'assurer que le DOM est mis à jour
      setTimeout(() => {
        scrollToMember(editedMemberId);
        // Nettoyer l'état de navigation
        window.history.replaceState({}, "", location.pathname);
      }, 100);
    }
  }, [returnedFromEdit, editedMemberId, loading, filteredMembers]);

  // ✅ NOUVELLE FONCTION : Scroll vers un membre spécifique
  const scrollToMember = (memberId) => {
    const memberElement = memberRefs.current[memberId];
    if (memberElement) {
      // Scroll avec animation douce
      memberElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      // Effet visuel temporaire pour mettre en évidence
      memberElement.style.transition = "all 0.3s ease";
      memberElement.style.transform = "scale(1.02)";
      memberElement.style.boxShadow = "0 8px 25px rgba(59, 130, 246, 0.3)";
      memberElement.style.borderColor = "#3B82F6";

      setTimeout(() => {
        memberElement.style.transform = "";
        memberElement.style.boxShadow = "";
        memberElement.style.borderColor = "";
      }, 1000);
    }
  };

  // ✅ HANDLER HYBRIDE pour l'édition (MODIFIÉ)
  const handleEditMember = (member) => {
    if (isMobile) {
      setSelectedMember(member);
      setShowForm(true);
    } else {
      // Mode desktop : naviguer vers MemberFormPage avec l'ID du membre
      navigate("/members/edit", {
        state: {
          member: member,
          returnPath: "/members",
          memberId: member.id, // ✅ AJOUT : Passer l'ID pour le retour
        },
      });
    }
  };

  // ✅ HANDLER HYBRIDE pour l'ajout
  const handleAddMember = () => {
    if (isMobile) {
      setSelectedMember(null);
      setShowForm(true);
    } else {
      navigate("/members/new", {
        state: {
          member: null,
          returnPath: "/members",
        },
      });
    }
  };

  // ✅ HANDLER pour fermer le modal (mobile uniquement)
  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedMember(null);
  };

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
      `${m.name || ""} ${m.firstName || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
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
        if (!m.endDate) return true;
        try {
          return isBefore(parseISO(m.endDate), new Date());
        } catch (e) {
          return true;
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
        if (typeof m.files === "string")
          return m.files === "[]" || m.files === "";
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
    if (
      window.confirm("Supprimer ce membre ? Cette action est irréversible.")
    ) {
      try {
        await supabaseServices.deleteMember(id);
        await fetchMembers();
        console.log(`✅ Membre ${id} supprimé`);
      } catch (err) {
        console.error("Erreur suppression:", err);
        alert(`Erreur lors de la suppression: ${err.message}`);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (
      window.confirm(
        `Supprimer les ${selectedIds.length} membres sélectionnés ? Cette action est irréversible.`
      )
    ) {
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

  const handleImageError = (memberId, e) => {
    setImageErrors((prev) => new Set([...prev, memberId]));
    e.target.style.display = "none";
  };

  // Calculer les statistiques
  const total = filteredMembers.length;
  const maleCount = filteredMembers.filter((m) => m.gender === "Homme").length;
  const femaleCount = filteredMembers.filter(
    (m) => m.gender === "Femme"
  ).length;
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
    if (typeof m.files === "string") return m.files === "[]" || m.files === "";
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
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
      case "Trimestriel":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300";
      case "Semestriel":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
      case "Annuel":
      case "Année civile":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300";
    }
  };

  // Component for avatar with fallback
// Component for avatar with fallback + magnifier on hover
const MemberAvatar = ({ member }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(imageErrors.has(member.id));

  // --- Loupe ---
  const [showLens, setShowLens] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const lensSize = 240;      // ⬅️ diamètre de la loupe en px
  const zoom = 2.5;          // ⬅️ facteur de zoom (2 à 3 est généralement agréable)

  // Désactiver la loupe sur tactile / mobile
  const isTouch =
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0);

  const shouldShowFallback = !member.photo || imageFailed;

  // Gestion du survol
  const handleMouseEnter = () => {
    if (!isTouch) setShowLens(true);
  };
  const handleMouseLeave = () => setShowLens(false);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left; // position de la souris dans le conteneur
    const y = e.clientY - rect.top;

    setLensPos({ x, y });
  };

  if (shouldShowFallback) {
    return (
      <div className="w-12 h-12 rounded-full border border-gray-200 dark:border-gray-600 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
        <FaUser
          className={`text-xl ${
            member.gender === "Femme"
              ? "text-pink-500 dark:text-pink-400"
              : "text-blue-500 dark:text-blue-400"
          }`}
        />
      </div>
    );
  }

  // Taille de l’avatar (gardé à 48px pour coller à ta table)
  const avatarSize = 48; // = 12 * 4 (w-12 h-12)

  // Calculs pour la texture de fond de la loupe
  const bgSize = `${avatarSize * zoom}px ${avatarSize * zoom}px`;

  // Position de fond : on centre la zone autour du pointeur
  // Convertir pos curseur (dans le conteneur) vers la zone zoomée
  const bgPosX = -(lensPos.x * zoom - lensSize / 2);
  const bgPosY = -(lensPos.y * zoom - lensSize / 2);

  return (
    <div
      ref={containerRef}
      className="relative w-12 h-12 transform-gpu group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      style={{ cursor: isTouch ? "default" : "zoom-in" }}
    >
      {/* Placeholder (icône) pendant le chargement */}
      <div
        className={`absolute inset-0 rounded-full border border-gray-200 dark:border-gray-600 flex items-center justify-center bg-gray-100 dark:bg-gray-700 transition-opacity duration-300 ${
          imageLoaded ? "opacity-0" : "opacity-100"
        }`}
      >
        <FaUser
          className={`text-xl ${
            member.gender === "Femme"
              ? "text-pink-500 dark:text-pink-400"
              : "text-blue-500 dark:text-blue-400"
          }`}
        />
      </div>

      {/* Avatar avec ombre existante (accentuée) */}
      <div className="relative w-12 h-12 rounded-full shadow-[0_10px_24px_rgba(0,0,0,0.65)]">
        <img
          src={member.photo}
          alt="avatar"
          className={`w-full h-full object-cover rounded-full border border-gray-200 dark:border-gray-600 transition-opacity duration-300 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageFailed(true);
            setImageErrors((prev) => new Set([...prev, member.id]));
          }}
          loading="lazy"
          draggable={false}
        />
      </div>

      {/* Loupe (affichée au survol, desktop only) */}
      {showLens && imageLoaded && (
        <div
          className="pointer-events-none absolute rounded-full ring-2 ring-white dark:ring-gray-800 shadow-xl"
          style={{
            width: `${lensSize}px`,
            height: `${lensSize}px`,
            // Positionner le centre de la loupe sous le pointeur
            left: `${lensPos.x - lensSize / 2}px`,
            top: `${lensPos.y - lensSize / 2}px`,
            backgroundImage: `url(${member.photo})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: bgSize,
            backgroundPosition: `${bgPosX}px ${bgPosY}px`,
            // Légère vignette pour relief
            boxShadow:
              "0 14px 30px rgba(0,0,0,0.35), inset 0 0 20px rgba(0,0,0,0.25)",
            // Un peu de blur en périphérie pour effet verre
            backdropFilter: "blur(0.5px)",
          }}
        />
      )}
    </div>
  );
};


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            Chargement des membres depuis Supabase...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
        <div className="text-red-600 dark:text-red-400 mb-4">⚠️ Erreur</div>
        <p className="text-gray-700 dark:text-gray-300 mb-4">{error}</p>
        <button
          onClick={fetchMembers}
          className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <FaSync />
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-4 members-container">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
            Liste des membres
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {members.length} membres dans la base Supabase
          </p>
        </div>
        <button
          onClick={fetchMembers}
          disabled={loading}
          className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg transition-colors inline-flex items-center gap-2 disabled:opacity-50"
          title="Actualiser la liste"
        >
          <FaSync className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {activeFilter && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex justify-between items-center">
            <span className="text-blue-700 dark:text-blue-300">
              Filtre actif : <strong>{activeFilter}</strong> (
              {filteredMembers.length} résultat
              {filteredMembers.length !== 1 ? "s" : ""})
            </span>
            <button
              onClick={() => setActiveFilter(null)}
              className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline text-sm"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      )}

      {/* Widgets de statistiques */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-6">
        <Widget
          title="👥 Total"
          value={total}
          onClick={() => setActiveFilter(null)}
          active={!activeFilter}
        />
        <Widget
          title="👨 Hommes"
          value={maleCount}
          onClick={() => setActiveFilter("Homme")}
          active={activeFilter === "Homme"}
        />
        <Widget
          title="👩 Femmes"
          value={femaleCount}
          onClick={() => setActiveFilter("Femme")}
          active={activeFilter === "Femme"}
        />
        <Widget
          title="🎓 Étudiants"
          value={studentCount}
          onClick={() => setActiveFilter("Etudiant")}
          active={activeFilter === "Etudiant"}
        />
        <Widget
          title="📅 Expirés"
          value={expiredCount}
          onClick={() => setActiveFilter("Expiré")}
          active={activeFilter === "Expiré"}
        />
        <Widget
          title="✅ Récents"
          value={recentCount}
          onClick={() => setActiveFilter("Récent")}
          active={activeFilter === "Récent"}
        />
        <Widget
          title="📂 Sans certif"
          value={noCertCount}
          onClick={() => setActiveFilter("SansCertif")}
          active={activeFilter === "SansCertif"}
        />
      </div>

      {/* Barre d'actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg w-full sm:w-auto inline-flex items-center justify-center gap-2 transition-colors"
            onClick={handleAddMember}
          >
            <FaPlus />
            Ajouter un membre
          </button>
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white px-4 py-2 rounded-lg w-full sm:w-auto inline-flex items-center justify-center gap-2 transition-colors"
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
            className="border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>
      </div>

      {/* Contrôles de tri en mode desktop */}
      <div className="hidden lg:flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={
                selectedIds.length === filteredMembers.length &&
                filteredMembers.length > 0
              }
              onChange={toggleSelectAll}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Sélectionner tout
            </span>
          </label>
        </div>
        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Trier par nom
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {sortAsc ? "▲" : "▼"}
          </span>
        </button>
      </div>

      {filteredMembers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          {search || activeFilter
            ? "Aucun membre ne correspond aux critères de recherche"
            : "Aucun membre trouvé dans la base de données"}
        </div>
      ) : (
        <>
          {/* Vue tableau pour desktop */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="p-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.length === filteredMembers.length &&
                          filteredMembers.length > 0
                        }
                        onChange={toggleSelectAll}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                    </th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">
                      Photo
                    </th>
                    <th className="p-3 text-left">
                      <button
                        onClick={() => setSortAsc(!sortAsc)}
                        className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      >
                        Nom{" "}
                        <span className="text-gray-500 dark:text-gray-400">
                          {sortAsc ? "▲" : "▼"}
                        </span>
                      </button>
                    </th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">
                      Infos
                    </th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">
                      Abonnement
                    </th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">
                      Badge
                    </th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">
                      Status
                    </th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {filteredMembers.map((member) => {
                    const isExpired = member.endDate
                      ? (() => {
                          try {
                            return isBefore(
                              parseISO(member.endDate),
                              new Date()
                            );
                          } catch (e) {
                            return true;
                          }
                        })()
                      : true;

                    const hasFiles =
                      member.files &&
                      (Array.isArray(member.files)
                        ? member.files.length > 0
                        : typeof member.files === "string"
                        ? member.files !== "[]" && member.files !== ""
                        : Object.keys(member.files).length > 0);

                    return (
                      <tr
                        key={member.id}
                        // ✅ AJOUT : Ref pour le repositionnement
                        ref={(el) => {
                          if (el) memberRefs.current[member.id] = el;
                        }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 transform-gpu member-row"
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(member.id)}
                            onChange={() => toggleSelect(member.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                        </td>

                        <td className="p-3">
                          <MemberAvatar member={member} />
                        </td>

                        <td className="p-3">
                          <div
                            className="font-medium text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-all duration-200 flex items-center gap-2 group"
                            onClick={() => handleEditMember(member)}
                            title="Cliquer pour modifier"
                          >
                            <span>
                              {member.name} {member.firstName}
                            </span>
                            <FaExternalLinkAlt className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity duration-200" />
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            ID: {member.id}
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="text-sm space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  member.gender === "Femme"
                                    ? "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300"
                                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                }`}
                              >
                                {member.gender}
                              </span>
                              {member.etudiant && (
                                <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full text-xs font-medium">
                                  🎓 Étudiant
                                </span>
                              )}
                            </div>
                            {member.email && (
                              <div
                                className="text-gray-600 dark:text-gray-400 text-xs truncate max-w-[200px]"
                                title={member.email}
                              >
                                📧 {member.email}
                              </div>
                            )}
                            {member.mobile && (
                              <div className="text-gray-600 dark:text-gray-400 text-xs">
                                📱 {member.mobile}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="space-y-1">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getBadgeColor(
                                member.subscriptionType
                              )}`}
                            >
                              {member.subscriptionType || "Non défini"}
                            </span>
                            {member.startDate && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Début: {member.startDate}
                              </div>
                            )}
                            {member.endDate && (
                              <div
                                className={`text-xs ${
                                  isExpired
                                    ? "text-red-600 dark:text-red-400 font-medium"
                                    : "text-gray-500 dark:text-gray-400"
                                }`}
                              >
                                Fin: {member.endDate}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="p-3">
                          <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 px-2 py-1 rounded text-sm font-mono">
                            {member.badgeId || "—"}
                          </span>
                        </td>

                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            {isExpired ? (
                              <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-2 py-1 rounded-full text-xs font-medium">
                                ⚠️ Expiré
                              </span>
                            ) : (
                              <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded-full text-xs font-medium">
                                ✅ Actif
                              </span>
                            )}
                            {hasFiles ? (
                              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full text-xs font-medium">
                                📄 Docs OK
                              </span>
                            ) : (
                              <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 px-2 py-1 rounded-full text-xs font-medium">
                                📄 Manquant
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleEditMember(member)}
                              className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-3 py-1 rounded text-sm transition-colors"
                              title="Modifier ce membre"
                            >
                              <FaEdit className="w-3 h-3" />
                              Modifier
                            </button>
                            <button
                              onClick={() => handleDelete(member.id)}
                              className="flex items-center gap-1 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 px-3 py-1 rounded text-sm transition-colors"
                              title="Supprimer ce membre"
                            >
                              <FaTrash className="w-3 h-3" />
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vue cartes pour mobile/tablette */}
          <div className="lg:hidden space-y-4">
            {/* Contrôles de tri mobile */}
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={
                    selectedIds.length === filteredMembers.length &&
                    filteredMembers.length > 0
                  }
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Tout sélectionner
                </span>
              </label>
              <button onClick={() => setSortAsc(!sortAsc)}>
                <span className="text-gray-700 dark:text-gray-300">Nom</span>{" "}
                <span className="text-gray-500 dark:text-gray-400">
                  {sortAsc ? "▲" : "▼"}
                </span>
              </button>
            </div>

            {filteredMembers.map((member) => {
              const isExpired = member.endDate
                ? (() => {
                    try {
                      return isBefore(parseISO(member.endDate), new Date());
                    } catch (e) {
                      return true;
                    }
                  })()
                : true;

              const hasFiles =
                member.files &&
                (Array.isArray(member.files)
                  ? member.files.length > 0
                  : typeof member.files === "string"
                  ? member.files !== "[]" && member.files !== ""
                  : Object.keys(member.files).length > 0);

              return (
                <div
                  key={member.id}
                  // ✅ AJOUT : Ref pour le repositionnement mobile
                  ref={(el) => {
                    if (el) memberRefs.current[member.id] = el;
                  }}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow duration-150 transform-gpu member-card"
                >
                  {/* En-tête de la carte */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(member.id)}
                        onChange={() => toggleSelect(member.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mt-1"
                      />
                      <MemberAvatar member={member} />
                      <div className="flex-1">
                        <div
                          className="font-semibold text-gray-900 dark:text-white text-lg cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-all duration-200"
                          onClick={() => handleEditMember(member)}
                          title="Cliquer pour modifier"
                        >
                          {member.name} {member.firstName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          ID: {member.id}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Informations personnelles */}
                  <div className="mb-3">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          member.gender === "Femme"
                            ? "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300"
                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        }`}
                      >
                        {member.gender}
                      </span>
                      {member.etudiant && (
                        <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full text-xs font-medium">
                          🎓 Étudiant
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getBadgeColor(
                          member.subscriptionType
                        )}`}
                      >
                        {member.subscriptionType || "Non défini"}
                      </span>
                    </div>

                    {/* Contact */}
                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      {member.email && (
                        <div className="flex items-center gap-2">
                          <span>📧</span>
                          <span className="truncate">{member.email}</span>
                        </div>
                      )}
                      {member.mobile && (
                        <div className="flex items-center gap-2">
                          <span>📱</span>
                          <span>{member.mobile}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Abonnement et Badge */}
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        ABONNEMENT
                      </div>
                      <div className="space-y-1">
                        {member.startDate && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Début: {member.startDate}
                          </div>
                        )}
                        {member.endDate && (
                          <div
                            className={`text-xs ${
                              isExpired
                                ? "text-red-600 dark:text-red-400 font-medium"
                                : "text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            Fin: {member.endDate}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        BADGE
                      </div>
                      <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 px-2 py-1 rounded text-sm font-mono">
                        {member.badgeId || "—"}
                      </span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {isExpired ? (
                      <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-2 py-1 rounded-full text-xs font-medium">
                        ⚠️ Expiré
                      </span>
                    ) : (
                      <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded-full text-xs font-medium">
                        ✅ Actif
                      </span>
                    )}
                    {hasFiles ? (
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full text-xs font-medium">
                        📄 Docs OK
                      </span>
                    ) : (
                      <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 px-2 py-1 rounded-full text-xs font-medium">
                        📄 Manquant
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-600">
                    <button
                      onClick={() => handleEditMember(member)}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-3 py-2 rounded-lg text-sm transition-colors"
                    >
                      <FaEdit className="w-3 h-3" />
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(member.id)}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm transition-colors"
                    >
                      <FaTrash className="w-3 h-3" />
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Résumé en bas */}
      {filteredMembers.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
          Affichage de {filteredMembers.length} membre
          {filteredMembers.length !== 1 ? "s" : ""} sur {members.length} total
          {selectedIds.length > 0 && (
            <span className="ml-4 text-blue-600 dark:text-blue-400 font-medium">
              • {selectedIds.length} sélectionné
              {selectedIds.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* ✅ MODAL CONDITIONNEL - Affiché uniquement en mobile */}
      {showForm && isMobile && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-start justify-center overflow-auto">
          <div className="bg-white dark:bg-gray-800 mt-4 mb-4 rounded-xl shadow-xl w-full max-w-4xl mx-4">
            <MemberForm
              member={selectedMember}
              onSave={async (memberData, closeModal) => {
                try {
                  console.log(
                    "💾 Sauvegarde membre:",
                    selectedMember ? "Modification" : "Création"
                  );

                  let memberId;
                  if (selectedMember?.id) {
                    await supabaseServices.updateMember(
                      selectedMember.id,
                      memberData
                    );
                    memberId = selectedMember.id;
                    console.log("✅ Membre modifié:", selectedMember.id);
                  } else {
                    const newMember = await supabaseServices.createMember(
                      memberData
                    );
                    memberId = newMember.id;
                    console.log("✅ Nouveau membre créé:", newMember.id);
                  }

                  if (closeModal) {
                    setShowForm(false);
                    setSelectedMember(null);
                  }

                  await fetchMembers();

                  // ✅ Repositionnement après sauvegarde mobile
                  if (memberId) {
                    setTimeout(() => scrollToMember(memberId), 200);
                  }
                } catch (error) {
                  console.error("❌ Erreur sauvegarde membre:", error);
                  alert(`Erreur lors de la sauvegarde: ${error.message}`);
                }
              }}
              onCancel={handleCloseForm}
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
      className={`p-3 rounded-lg text-center cursor-pointer transition-colors duration-150 border-2 transform-gpu ${
        active
          ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 shadow-md"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-700 shadow-sm"
      }`}
    >
      <div
        className={`text-sm ${
          active
            ? "text-blue-700 dark:text-blue-300 font-medium"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        {title}
      </div>
      <div
        className={`text-xl font-bold ${
          active
            ? "text-blue-800 dark:text-blue-200"
            : "text-gray-800 dark:text-gray-200"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export default MembersPage;
