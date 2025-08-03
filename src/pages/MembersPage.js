import React, { useEffect, useState } from "react";
import { supabaseServices } from "../supabaseClient";
import MemberForm from "../components/MemberForm";
import { format, isBefore, parseISO } from "date-fns";
import { FaEdit, FaTrash, FaPlus, FaSync, FaUser } from "react-icons/fa";

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
  const [imageErrors, setImageErrors] = useState(new Set());

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
  // Fonction pour calculer les badges d'un membre
  const getMemberBadges = (member) => {
    const badges = [];

    // Badge force (exemple basé sur l'abonnement)
    if (
      member.subscriptionType === "Annuel" ||
      member.subscriptionType === "Année civile"
    ) {
      badges.push({ type: "strength", emoji: "💪", title: "Force" });
    }

    // Badge endurance (exemple basé sur la durée d'adhésion)
    if (member.startDate) {
      try {
        const startDate = parseISO(member.startDate);
        const monthsDiff =
          (new Date().getTime() - startDate.getTime()) /
          (1000 * 60 * 60 * 24 * 30);
        if (monthsDiff > 6) {
          badges.push({ type: "endurance", emoji: "🏃", title: "Endurance" });
        }
      } catch (e) {}
    }

    // Badge consistance (pour les étudiants par exemple)
    if (member.etudiant) {
      badges.push({ type: "consistency", emoji: "🔥", title: "Consistance" });
    }

    return badges.slice(0, 3); // Max 3 badges
  };

  // Fonction pour calculer le streak d'un membre
  const getMemberStreak = (member) => {
    // Calcul simple basé sur la date de début
    if (!member.startDate) return 0;

    try {
      const startDate = parseISO(member.startDate);
      const daysDiff = Math.floor(
        (new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return Math.max(0, Math.min(daysDiff, 99)); // Limité à 99 jours
    } catch (e) {
      return 0;
    }
  };

  // Fonction pour calculer le pourcentage de progression
  const getMemberProgress = (member) => {
    if (!member.startDate || !member.endDate) return 0;

    try {
      const startDate = parseISO(member.startDate);
      const endDate = parseISO(member.endDate);
      const now = new Date();

      const totalDuration = endDate.getTime() - startDate.getTime();
      const elapsed = now.getTime() - startDate.getTime();

      const percentage = Math.round((elapsed / totalDuration) * 100);
      return Math.max(0, Math.min(100, percentage));
    } catch (e) {
      return 0;
    }
  };

  // Composant Avatar amélioré
  const MemberAvatar = ({
    member,
    size = "w-12 h-12",
    showProgress = false,
  }) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageFailed, setImageFailed] = useState(imageErrors.has(member.id));

    const shouldShowFallback = !member.photo || imageFailed;
    const progress = getMemberProgress(member);

    if (shouldShowFallback) {
      if (showProgress) {
        return (
          <div className="relative">
            {/* Progress Ring */}
            <svg className="absolute -top-1 -left-1 w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="3"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#E91C4C"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            <div
              className={`${size} rounded-full border-2 border-white shadow-lg flex items-center justify-center bg-gradient-to-br ${
                member.gender === "Femme"
                  ? "from-pink-400 to-red-500"
                  : "from-blue-400 to-purple-500"
              } relative z-10`}
            >
              <FaUser className="text-white text-lg" />
            </div>

            {/* Progress percentage */}
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
              {progress}%
            </div>
          </div>
        );
      }

      return (
        <div
          className={`${size} rounded-full border-2 border-white shadow-lg flex items-center justify-center bg-gradient-to-br ${
            member.gender === "Femme"
              ? "from-pink-400 to-red-500"
              : "from-blue-400 to-purple-500"
          }`}
        >
          <FaUser
            className={`text-white ${
              size.includes("20") ? "text-3xl" : "text-lg"
            }`}
          />
        </div>
      );
    }

    if (showProgress) {
      return (
        <div className="relative">
          {/* Progress Ring */}
          <svg className="absolute -top-1 -left-1 w-16 h-16 transform -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="3"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="#E91C4C"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          <div className="relative z-10">
            <img
              src={member.photo}
              alt="avatar"
              className={`${size} object-cover rounded-full border-2 border-white shadow-lg transition-opacity duration-300 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageFailed(true);
                setImageErrors((prev) => new Set([...prev, member.id]));
              }}
              loading="lazy"
            />

            {!imageLoaded && (
              <div
                className={`absolute inset-0 ${size} rounded-full border-2 border-white shadow-lg flex items-center justify-center bg-gradient-to-br ${
                  member.gender === "Femme"
                    ? "from-pink-400 to-red-500"
                    : "from-blue-400 to-purple-500"
                }`}
              >
                <FaUser className="text-white text-lg" />
              </div>
            )}
          </div>

          {/* Progress percentage */}
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
            {progress}%
          </div>
        </div>
      );
    }

    return (
      <div className="relative">
        <img
          src={member.photo}
          alt="avatar"
          className={`${size} object-cover rounded-full border-2 border-white shadow-lg transition-opacity duration-300 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageFailed(true);
            setImageErrors((prev) => new Set([...prev, member.id]));
          }}
          loading="lazy"
        />

        {!imageLoaded && (
          <div
            className={`absolute inset-0 ${size} rounded-full border-2 border-white shadow-lg flex items-center justify-center bg-gradient-to-br ${
              member.gender === "Femme"
                ? "from-pink-400 to-red-500"
                : "from-blue-400 to-purple-500"
            }`}
          >
            <FaUser
              className={`text-white ${
                size.includes("20") ? "text-3xl" : "text-lg"
              }`}
            />
          </div>
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
            🏋️ BodyForce - Membres
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
      {filteredMembers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          {search || activeFilter
            ? "Aucun membre ne correspond aux critères de recherche"
            : "Aucun membre trouvé dans la base de données"}
        </div>
      ) : (
        <>
          {/* Contrôles de sélection et tri */}
          <div className="flex items-center justify-between mb-6">
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
                Sélectionner tout ({filteredMembers.length})
              </span>
            </label>
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

          {/* Nouvelles tuiles stylées */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredMembers.map((member, index) => {
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

              const badges = getMemberBadges(member);
              const streak = getMemberStreak(member);
              const progress = getMemberProgress(member);

              // Alterner entre les 3 styles de tuiles
              const tileType = index % 3;

              return (
                <div
                  key={member.id}
                  className={`
                    relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 
                    rounded-3xl shadow-xl hover:shadow-2xl 
                    transition-all duration-500 ease-out
                    border border-gray-200 dark:border-gray-700
                    hover:scale-105 hover:-translate-y-2
                    overflow-visible cursor-pointer group
                    transform-gpu
                    ${tileType === 0 ? "border-l-8 border-l-red-500" : ""}
                    ${tileType === 1 ? "border-l-8 border-l-blue-500" : ""}
                    ${tileType === 2 ? "border-l-8 border-l-cyan-400" : ""}
                  `}
                  onClick={() => {
                    setSelectedMember(member);
                    setShowForm(true);
                  }}
                >
                  {/* Checkbox de sélection */}
                  <div
                    className="absolute top-4 left-4 z-20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(member.id)}
                      onChange={() => toggleSelect(member.id)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 shadow-lg"
                    />
                  </div>

                  {/* Badges pour le style 1 (Progress Ring) */}
                  {tileType === 0 && (
                    <div className="absolute top-4 right-4 z-10">
                      <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-pulse">
                        {progress}%
                      </div>
                    </div>
                  )}

                  {/* Badges d'achievement pour le style 2 */}
                  {tileType === 1 && badges.length > 0 && (
                    <div className="absolute -top-3 right-6 flex gap-2 z-10">
                      {badges.map((badge, idx) => (
                        <div
                          key={idx}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-lg animate-bounce ${
                            badge.type === "strength"
                              ? "bg-gradient-to-br from-red-500 to-red-600"
                              : badge.type === "endurance"
                              ? "bg-gradient-to-br from-blue-500 to-blue-600"
                              : "bg-gradient-to-br from-green-500 to-green-600"
                          }`}
                          title={badge.title}
                          style={{ animationDelay: `${idx * 0.2}s` }}
                        >
                          {badge.emoji}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Streak pour le style 3 */}
                  {tileType === 2 && streak > 0 && (
                    <div className="absolute -top-2 right-6 bg-gradient-to-r from-cyan-400 to-blue-500 text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-lg animate-pulse z-10">
                      <span className="animate-bounce inline-block">🔥</span>{" "}
                      {streak} jours
                    </div>
                  )}

                  <div className="p-6">
                    {/* Avatar avec ou sans progress ring */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className="relative">
                        {tileType === 0 ? (
                          <MemberAvatar
                            member={member}
                            size="w-20 h-20"
                            showProgress={true}
                          />
                        ) : (
                          <MemberAvatar member={member} size="w-20 h-20" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 truncate bg-gradient-to-r from-red-500 via-blue-500 to-cyan-400 bg-clip-text text-transparent">
                          {member.name} {member.firstName}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                          ID: {member.id}
                        </p>

                        {/* Badges de statut */}
                        <div className="flex flex-wrap gap-2">
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
                              🎓
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Statistiques en grille */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl p-3 text-center border border-red-200 dark:border-red-800/30">
                        <div className="text-lg font-bold text-red-600 dark:text-red-400">
                          {member.badgeId || "—"}
                        </div>
                        <div className="text-xs text-red-500 dark:text-red-400 font-medium uppercase tracking-wide">
                          Badge
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-3 text-center border border-blue-200 dark:border-blue-800/30">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {member.subscriptionType === "Mensuel"
                            ? "1M"
                            : member.subscriptionType === "Trimestriel"
                            ? "3M"
                            : member.subscriptionType === "Semestriel"
                            ? "6M"
                            : member.subscriptionType === "Annuel" ||
                              member.subscriptionType === "Année civile"
                            ? "1A"
                            : "—"}
                        </div>
                        <div className="text-xs text-blue-500 dark:text-blue-400 font-medium uppercase tracking-wide">
                          Abonnement
                        </div>
                      </div>

                      {member.startDate && (
                        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-3 text-center border border-green-200 dark:border-green-800/30">
                          <div className="text-lg font-bold text-green-600 dark:text-green-400">
                            {member.startDate.split("-")[2]}/
                            {member.startDate.split("-")[1]}
                          </div>
                          <div className="text-xs text-green-500 dark:text-green-400 font-medium uppercase tracking-wide">
                            Début
                          </div>
                        </div>
                      )}

                      {member.endDate && (
                        <div
                          className={`bg-gradient-to-br rounded-xl p-3 text-center border ${
                            isExpired
                              ? "from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800/30"
                              : "from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 border-cyan-200 dark:border-cyan-800/30"
                          }`}
                        >
                          <div
                            className={`text-lg font-bold ${
                              isExpired
                                ? "text-red-600 dark:text-red-400"
                                : "text-cyan-600 dark:text-cyan-400"
                            }`}
                          >
                            {member.endDate.split("-")[2]}/
                            {member.endDate.split("-")[1]}
                          </div>
                          <div
                            className={`text-xs font-medium uppercase tracking-wide ${
                              isExpired
                                ? "text-red-500 dark:text-red-400"
                                : "text-cyan-500 dark:text-cyan-400"
                            }`}
                          >
                            Fin {isExpired ? "⚠️" : "✅"}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Informations de contact */}
                    {(member.email || member.mobile) && (
                      <div className="mb-4 space-y-1">
                        {member.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <span>📧</span>
                            <span className="truncate">{member.email}</span>
                          </div>
                        )}
                        {member.mobile && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <span>📱</span>
                            <span>{member.mobile}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Statut global */}
                    <div className="flex items-center justify-between gap-2 p-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {isExpired ? "Membre expiré" : "Membre actif"} •{" "}
                          {hasFiles ? "Docs OK" : "Docs manquants"}
                        </span>
                      </div>
                    </div>

                    {/* Boutons d'action */}
                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMember(member);
                          setShowForm(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 transform hover:scale-105 shadow-lg"
                      >
                        <FaEdit className="w-3 h-3" />
                        Modifier
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(member.id);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 transform hover:scale-105 shadow-lg"
                      >
                        <FaTrash className="w-3 h-3" />
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Résumé en bas */}
      {filteredMembers.length > 0 && (
        <div className="mt-8 p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>
              Affichage de{" "}
              <strong className="text-blue-600 dark:text-blue-400">
                {filteredMembers.length}
              </strong>{" "}
              membre
              {filteredMembers.length !== 1 ? "s" : ""} sur{" "}
              <strong className="text-gray-800 dark:text-gray-200">
                {members.length}
              </strong>{" "}
              total
            </span>
            {selectedIds.length > 0 && (
              <span className="text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                🗹 {selectedIds.length} sélectionné
                {selectedIds.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Modal du formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center overflow-auto backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 mt-4 mb-4 rounded-xl shadow-2xl w-full max-w-4xl mx-4 border border-gray-200 dark:border-gray-600">
            <MemberForm
              member={selectedMember}
              onSave={async (memberData, closeModal) => {
                try {
                  console.log(
                    "💾 Sauvegarde membre:",
                    selectedMember ? "Modification" : "Création"
                  );

                  if (selectedMember?.id) {
                    await supabaseServices.updateMember(
                      selectedMember.id,
                      memberData
                    );
                    console.log("✅ Membre modifié:", selectedMember.id);
                  } else {
                    const newMember = await supabaseServices.createMember(
                      memberData
                    );
                    console.log("✅ Nouveau membre créé:", newMember.id);
                  }

                  if (closeModal) {
                    setShowForm(false);
                    setSelectedMember(null);
                  }

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

// Composant Widget pour les statistiques amélioré
function Widget({ title, value, onClick, active = false }) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl text-center cursor-pointer transition-all duration-300 border-2 transform hover:scale-105 shadow-lg ${
        active
          ? "bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400 text-white shadow-blue-200 dark:shadow-blue-900/50"
          : "bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-gray-200 dark:border-gray-600 hover:border-blue-200 dark:hover:border-blue-700 shadow-gray-200 dark:shadow-gray-900/50"
      }`}
    >
      <div
        className={`text-sm font-medium mb-1 ${
          active ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
        }`}
      >
        {title}
      </div>
      <div
        className={`text-2xl font-bold ${
          active ? "text-white" : "text-gray-800 dark:text-gray-200"
        }`}
      >
        {value}
      </div>
      {active && (
        <div className="w-full h-1 bg-white/30 rounded-full mt-2">
          <div className="h-full bg-white rounded-full animate-pulse"></div>
        </div>
      )}
    </div>
  );
}

export default MembersPage;
