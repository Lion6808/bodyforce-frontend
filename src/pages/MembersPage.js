// ✅ MembersPage.js OPTIMISÉ EGRESS avec pagination + lazy photos (corrigé)

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabaseServices } from "../supabaseClient";
import MemberForm from "../components/MemberForm";
import { isBefore, parseISO } from "date-fns";
import {
  FaEdit,
  FaTrash,
  FaPlus,
  FaSync,
  FaExternalLinkAlt,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";

import Avatar from "../components/Avatar";

// ───────────────────────────────────────────────────────────────────────────────
// Utils recherche avancée (inchangés)
// ───────────────────────────────────────────────────────────────────────────────
const normalize = (s = "") =>
  s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const escapeForWildcard = (s) => s.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");

const tokenToRegex = (tokenRaw) => {
  if (!tokenRaw) return null;
  let t = tokenRaw.trim();
  const anchoredStart = t.startsWith("^");
  const anchoredEnd = t.endsWith("$");
  if (anchoredStart) t = t.slice(1);
  if (anchoredEnd) t = t.slice(0, -1);
  t = escapeForWildcard(t);
  t = t.replace(/\*/g, ".*").replace(/\?/g, ".");
  if (!anchoredStart) t = ".*" + t;
  if (!anchoredEnd) t = t + ".*";
  return new RegExp("^" + t + "$", "i");
};

const parseSearch = (search) => {
  const raw = (search || "").trim();
  if (!raw) return [];
  const orClauses = raw
    .split(/\s+OR\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);
  return orClauses
    .map((clause) =>
      clause
        .split(/\s+/)
        .map((tok) => tok.trim())
        .filter(Boolean)
        .map(tokenToRegex)
        .filter(Boolean)
    );
};

const matchesSearch = (member, compiledClauses) => {
  if (!compiledClauses.length) return true;
  const haystack = normalize(
    [member.name, member.firstName, member.badgeId, member.email, member.mobile]
      .filter(Boolean)
      .join(" ")
  );
  return compiledClauses.some((tokens) => tokens.every((rx) => rx.test(haystack)));
};

const analyzeSearch = (raw) => {
  const text = (raw || "").trim();
  if (!text)
    return { active: false, clauses: [], hasWildcards: false, hasAnchors: false };
  const orParts = text
    .split(/\s+OR\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const clauses = orParts
    .map((p) => p.split(/\s+/).map((t) => t.trim()).filter(Boolean));
  return {
    active: true,
    clauses,
    hasWildcards: /[*?]/.test(text),
    hasAnchors: /(\^|\$)/.test(text),
  };
};

function SearchHints({ search }) {
  const info = analyzeSearch(search);
  if (!info.active) return null;

  return (
    <div className="w-full sm:w-auto sm:max-w-[36rem] text-xs mt-1 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
          Recherche avancée
        </span>
        {info.hasWildcards && (
          <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
            Jokers * et ?
          </span>
        )}
        {info.hasAnchors && (
          <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
            Ancres ^ et $
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {info.clauses.map((tokens, i) => (
          <div
            key={i}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
            title="Tous les tokens d'un groupe = AND"
          >
            {tokens.map((t, j) => (
              <span
                key={j}
                className="px-1.5 py-0.5 rounded bg-white/70 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 font-mono"
              >
                {t}
              </span>
            ))}
            <span className="ml-1 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              AND
            </span>
          </div>
        ))}
        {info.clauses.length > 1 && (
          <span
            className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400"
            title="Groupes reliés par OR"
          >
            (Groupes reliés par OR)
          </span>
        )}
      </div>

      <div className="text-[11px] text-gray-500 dark:text-gray-400">
        Exemples : <code className="font-mono">b*</code> (commence par b),{" "}
        <code className="font-mono">*son</code> (finit par son),{" "}
        <code className="font-mono">mar?</code> (mar + 1 char),{" "}
        <code className="font-mono">homme mar*</code> (AND),{" "}
        <code className="font-mono">b* OR mar*</code> (OR),{" "}
        <code className="font-mono">^mar*</code> (ancré début),{" "}
        <code className="font-mono">*tin$</code> (ancré fin).
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Composant principal
// ───────────────────────────────────────────────────────────────────────────────
function MembersPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const returnedFromEdit = location.state?.returnedFromEdit;
  const editedMemberIdFromState = location.state?.memberId;

  // États
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [activeFilter, setActiveFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination + photos
  const [currentPage, setCurrentPage] = useState(1);
  const [photosCache, setPhotosCache] = useState({}); // { memberId: dataURL | null }
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const ITEMS_PER_PAGE = 20;

  // Modal mobile
  const [selectedMember, setSelectedMember] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Refs
  const memberRefs = useRef({});
  const restoreRef = useRef(null);
  const photosLoadingRef = useRef(false); // évite courses d’effets

  // Détection mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Scroll restoration
  useEffect(() => {
    const { history } = window;
    const prev = history.scrollRestoration;
    try {
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    } catch { }
    return () => {
      try {
        if ("scrollRestoration" in history)
          history.scrollRestoration = prev || "auto";
      } catch { }
    };
  }, []);

  // Lecture contexte sauvegardé
  useEffect(() => {
    const raw = sessionStorage.getItem("membersPageCtx");
    if (!raw) return;
    try {
      const ctx = JSON.parse(raw);
      if (typeof ctx.search === "string") setSearch(ctx.search);
      if (ctx.activeFilter !== undefined) setActiveFilter(ctx.activeFilter);
      if (typeof ctx.sortAsc === "boolean") setSortAsc(ctx.sortAsc);
      if (Array.isArray(ctx.selectedIds)) setSelectedIds(ctx.selectedIds);
      if (typeof ctx.currentPage === "number") setCurrentPage(ctx.currentPage);
      restoreRef.current = ctx;
    } catch { }
  }, []);

  // Repositionnement par memberId (retour depuis edit)
  useEffect(() => {
    if (!editedMemberIdFromState) return;
    if (loading || filteredMembers.length === 0) return;

    const t = setTimeout(() => {
      scrollToMember(editedMemberIdFromState);
      window.history.replaceState({}, "", location.pathname);
    }, 100);

    return () => clearTimeout(t);
  }, [editedMemberIdFromState, loading, filteredMembers, location.pathname]);

  // Repositionnement simple par id (depuis sessionStorage)
  useEffect(() => {
    if (loading || filteredMembers.length === 0) return;

    const lastId = sessionStorage.getItem("membersLastId");
    if (!lastId) return;

    let attempts = 0;
    const maxAttempts = 40;
    let done = false;

    const highlight = (el) => {
      el.style.transition = "all 0.3s ease";
      el.style.transform = "scale(1.02)";
      el.style.boxShadow = "0 8px 25px rgba(59,130,246,0.3)";
      el.style.borderColor = "#3B82F6";
      setTimeout(() => {
        el.style.transform = "";
        el.style.boxShadow = "";
        el.style.borderColor = "";
      }, 1000);
    };

    const tryScroll = () => {
      if (done) return;
      const sel = `[data-member-id="${CSS.escape(String(lastId))}"]`;
      const el = document.querySelector(sel);
      if (el) {
        el.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
        highlight(el);
        sessionStorage.removeItem("membersLastId");
        done = true;
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) {
        requestAnimationFrame(tryScroll);
      } else {
        sessionStorage.removeItem("membersLastId");
      }
    };

    requestAnimationFrame(tryScroll);
  }, [loading, filteredMembers]);

  // Scroll vers membre
  const scrollToMember = (memberId) => {
    const memberElement =
      memberRefs.current[memberId] ||
      document.querySelector(`[data-member-id="${CSS.escape(String(memberId))}"]`);
    if (memberElement) {
      memberElement.scrollIntoView({ behavior: "smooth", block: "center" });
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

  // Sauvegarde contexte
  const saveMembersPageContext = (extra = {}) => {
    const scrollEl = document.scrollingElement || document.documentElement;
    const ctx = {
      search,
      activeFilter,
      sortAsc,
      selectedIds,
      currentPage,
      scrollY: scrollEl ? scrollEl.scrollTop : window.scrollY || 0,
      savedAt: Date.now(),
      ...extra,
    };
    sessionStorage.setItem("membersPageCtx", JSON.stringify(ctx));
  };

  // Chargement membres (sans photos)
  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseServices.getMembersWithoutPhotos();
      setMembers(data || []);
      console.log(`✅ ${data?.length ?? 0} membres chargés (sans photos)`);
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

  // Filtrage liste
  useEffect(() => {
    const compiledClauses = parseSearch(search);

    // ✅ Fonction helper pour vérifier si un membre est expiré
    const isMemberExpired = (m) => {
      if (!m.endDate) return false;
      try {
        return isBefore(parseISO(m.endDate), new Date());
      } catch {
        return false;
      }
    };

    // Base : appliquer la recherche
    let result = members.filter((m) => matchesSearch(m, compiledClauses));

    if (activeFilter === "Homme") {
      result = result.filter((m) => m.gender === "Homme" && !isMemberExpired(m));
    } else if (activeFilter === "Femme") {
      result = result.filter((m) => m.gender === "Femme" && !isMemberExpired(m));
    } else if (activeFilter === "Etudiant") {
      result = result.filter((m) => m.etudiant && !isMemberExpired(m));
    } else if (activeFilter === "Expiré") {
      result = result.filter((m) => isMemberExpired(m));
    } else if (activeFilter === "Récent") {
      // 20 derniers inscrits/réinscrits par last_subscription_date, SANS les expirés
      result = [...members]
        .filter((m) => !isMemberExpired(m))
        .sort((a, b) => {
          const dateA = a.last_subscription_date ? new Date(a.last_subscription_date) : new Date(0);
          const dateB = b.last_subscription_date ? new Date(b.last_subscription_date) : new Date(0);
          return dateB - dateA; // Plus récent en premier
        })
        .slice(0, 20);
    } else if (activeFilter === "SansCertif") {
      result = result.filter((m) => {
        if (isMemberExpired(m)) return false; // ✅ Exclure expirés
        if (!m.files) return true;
        if (Array.isArray(m.files)) return m.files.length === 0;
        if (typeof m.files === "string") return m.files === "[]" || m.files === "";
        return Object.keys(m.files).length === 0;
      });
    } else if (activeFilter === "Actifs" || !activeFilter) {
      // ✅ NOUVEAU : Filtre "Total/Actifs" = Tous SAUF expirés
      result = result.filter((m) => !isMemberExpired(m));
    }

    // ✅ Conserver le tri par nom SAUF pour "Récent" (où on garde l'ordre par ID desc)
    if (activeFilter !== "Récent") {
      result.sort((a, b) => {
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
    }

    setFilteredMembers(result);
    setCurrentPage(1); // reset à la page 1 quand filtres changent
  }, [members, search, sortAsc, activeFilter]);

  // ── ✅ Pagination via useMemo (AVANT l'effet photos)
  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredMembers.slice(startIndex, endIndex);
  }, [filteredMembers, currentPage]);

  const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  // ── ✅ Chargement des photos pour la page courante (anti-boucles)
  useEffect(() => {
    if (loading || paginatedMembers.length === 0) return;
    if (photosLoadingRef.current) return; // évite courses

    const loadPhotosForCurrentPage = async () => {
      const memberIds = paginatedMembers.map((m) => m.id);

      // IMPORTANT : on considère qu'une entrée présente dans le cache (même null) = déjà vérifiée
      const missingIds = memberIds.filter((id) => !(id in photosCache));

      if (missingIds.length === 0) {
        console.log(`✅ Photos déjà en cache pour page ${currentPage}`);
        return;
      }

      try {
        photosLoadingRef.current = true;
        setLoadingPhotos(true);
        console.log(`📸 Chargement de ${missingIds.length} photos pour page ${currentPage}`);

        // => Doit renvoyer un objet { [id]: dataURL } uniquement pour ceux qui existent
        const newPhotos = (await supabaseServices.getMemberPhotos(missingIds)) || {};

        // Construire le prochain cache :
        const nextCache = { ...photosCache, ...newPhotos };

        // Pour chaque id demandé non retourné par l'API, on marque explicitement "pas de photo"
        for (const id of missingIds) {
          if (!(id in newPhotos)) nextCache[id] = null;
        }

        // N'update l'état QUE si le contenu change réellement (évite re-render et re-effets)
        let changed = false;
        const keys = new Set([...Object.keys(photosCache), ...Object.keys(nextCache)]);
        for (const k of keys) {
          if (photosCache[k] !== nextCache[k]) {
            changed = true;
            break;
          }
        }
        if (changed) setPhotosCache(nextCache);

        console.log(`✅ ${Object.keys(newPhotos).length} photos chargées`);
      } catch (err) {
        console.error("Erreur chargement photos:", err);
      } finally {
        setLoadingPhotos(false);
        photosLoadingRef.current = false;
      }
    };

    loadPhotosForCurrentPage();
  }, [currentPage, paginatedMembers, loading, photosCache]);

  // Navigation pagination
  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    saveMembersPageContext({ currentPage: page });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handlers
  const handleEditMember = (member) => {
    if (isMobile) {
      setSelectedMember(member);
      setShowForm(true);
    } else {
      sessionStorage.setItem("membersLastId", String(member.id));
      saveMembersPageContext({ editedMemberId: member.id });
      navigate("/members/edit", {
        state: { member, returnPath: "/members", memberId: member.id },
      });
    }
  };

  const handleAddMember = () => {
    if (isMobile) {
      setSelectedMember(null);
      setShowForm(true);
    } else {
      sessionStorage.removeItem("membersLastId");
      saveMembersPageContext({ editedMemberId: null });
      navigate("/members/new", { state: { member: null, returnPath: "/members" } });
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedMember(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Supprimer ce membre ? Cette action est irréversible.")) {
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

  const handleQuickRenew = async (member) => {
    const currentYear = new Date().getFullYear();
    const confirmMsg = `Réabonner ${member.firstName} ${member.name} pour l'année ${currentYear} ?\n\nAbonnement : Année civile\nDu 01/01/${currentYear} au 31/12/${currentYear}`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const updatedData = {
        subscriptionType: "Année civile",
        startDate: `${currentYear}-01-01`,
        endDate: `${currentYear}-12-31`,
        last_subscription_date: new Date().toISOString(), // ✨ LIGNE AJOUTÉE
      };

      await supabaseServices.updateMember(member.id, updatedData);
      await fetchMembers();

      alert(`✅ ${member.firstName} ${member.name} réabonné(e) avec succès !`);
      console.log(`✅ Membre ${member.id} réabonné pour ${currentYear}`);
    } catch (err) {
      console.error("Erreur réabonnement:", err);
      alert(`❌ Erreur lors du réabonnement: ${err.message}`);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedMembers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedMembers.map((m) => m.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Stats
  const total = filteredMembers.length;
  const maleCount = filteredMembers.filter((m) => m.gender === "Homme").length;
  const femaleCount = filteredMembers.filter((m) => m.gender === "Femme").length;
  const expiredCount = members.filter((m) => {
    if (!m.endDate) return true;
    try {
      return isBefore(parseISO(m.endDate), new Date());
    } catch {
      return true;
    }
  }).length;

  const noCertCount = filteredMembers.filter((m) => {
    if (!m.files) return true;
    if (Array.isArray(m.files)) return m.files.length === 0;
    if (typeof m.files === "string") return m.files === "[]" || m.files === "";
    return Object.keys(m.files).length === 0;
  }).length;

  // ✅ Le widget "Récents" affiche toujours min(20, total membres)
  const recentCount = Math.min(20, members.length);

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

  // UI état général
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            Chargement des membres optimisé...
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
            {members.length} membres • Mode optimisé egress
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

      {/* Widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-6">
        <Widget
          title="👥 Total"
          value={total - expiredCount}
          onClick={() => setActiveFilter("Actifs")}
          active={activeFilter === "Actifs" || !activeFilter}
        />
        <Widget title="👨 Hommes" value={maleCount} onClick={() => setActiveFilter("Homme")} active={activeFilter === "Homme"} />
        <Widget title="👩 Femmes" value={femaleCount} onClick={() => setActiveFilter("Femme")} active={activeFilter === "Femme"} />
        <Widget title="🎓 Étudiants" value={studentCount} onClick={() => setActiveFilter("Etudiant")} active={activeFilter === "Etudiant"} />
        <Widget title="📅 Expirés" value={expiredCount} onClick={() => setActiveFilter("Expiré")} active={activeFilter === "Expiré"} />
        <Widget title="✅ Récents" value={recentCount} onClick={() => setActiveFilter("Récent")} active={activeFilter === "Récent"} />
        <Widget title="📂 Sans certif" value={noCertCount} onClick={() => setActiveFilter("SansCertif")} active={activeFilter === "SansCertif"} />
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
          <SearchHints search={search} />
        </div>
      </div>

      {/* Pagination top */}
      {totalPages > 1 && (
        <div className="mb-4 flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage} sur {totalPages} • Affichage de {startIndex + 1}-{Math.min(endIndex, filteredMembers.length)} sur {filteredMembers.length} membres
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors inline-flex items-center gap-1"
            >
              <FaChevronLeft className="w-3 h-3" />
              <span className="hidden sm:inline">Précédent</span>
            </button>

            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                .map((page, idx, arr) => (
                  <React.Fragment key={page}>
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <span className="px-2 text-gray-400 dark:text-gray-600">...</span>
                    )}
                    <button
                      onClick={() => goToPage(page)}
                      className={`px-3 py-2 rounded-lg transition-colors ${page === currentPage
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                        }`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                ))}
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors inline-flex items-center gap-1"
            >
              <span className="hidden sm:inline">Suivant</span>
              <FaChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Vue tableau desktop */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          {search || activeFilter
            ? "Aucun membre ne correspond aux critères de recherche"
            : "Aucun membre trouvé dans la base de données"}
        </div>
      ) : (
        <>
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="p-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === paginatedMembers.length && paginatedMembers.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                    </th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Photo</th>
                    <th className="p-3 text-left">
                      <button
                        onClick={() => setSortAsc(!sortAsc)}
                        className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      >
                        Nom{" "}
                        <span className="text-gray-500 dark:text-gray-400">{sortAsc ? "▲" : "▼"}</span>
                      </button>
                    </th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Infos</th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Abonnement</th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Badge</th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Status</th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {paginatedMembers.map((member) => {
                    const isExpired = member.endDate
                      ? (() => {
                        try {
                          return isBefore(parseISO(member.endDate), new Date());
                        } catch {
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
                        data-member-id={member.id}
                        ref={(el) => {
                          if (el) memberRefs.current[member.id] = el;
                        }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-[1.01] hover:shadow-xl hover:border-blue-300 transition-all duration-400 transform-gpu member-row"
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
                          <Avatar
                            photo={photosCache[member.id] || null}
                            firstName={member.firstName}
                            name={member.name}
                            size={48}
                            onClick={() => handleEditMember(member)}
                            title="Cliquer pour modifier"
                          />
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
                          <div className="text-sm text-gray-500 dark:text-gray-400">ID: {member.id}</div>
                        </td>

                        <td className="p-3">
                          <div className="text-sm space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${member.gender === "Femme"
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
                              <div className="text-gray-600 dark:text-gray-400 text-xs">📱 {member.mobile}</div>
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
                                className={`text-xs ${isExpired
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
                          <div className="flex items-center gap-2">
                            {/* Bouton Réabonner (uniquement si expiré) */}
                            {isExpired && (
                              <button
                                onClick={() => handleQuickRenew(member)}
                                className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors p-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                                title="Réabonner pour l'année en cours"
                              >
                                <FaSync className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={() => handleEditMember(member)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                              title="Modifier"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => handleDelete(member.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                              title="Supprimer"
                            >
                              <FaTrash />
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

          {/* Vue cartes mobile */}
          <div className="lg:hidden space-y-4">
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.length === paginatedMembers.length && paginatedMembers.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Sélectionner la page</span>
              </label>
              <button onClick={() => setSortAsc(!sortAsc)}>
                <span className="text-gray-700 dark:text-gray-300">Nom</span>{" "}
                <span className="text-gray-500 dark:text-gray-400">{sortAsc ? "▲" : "▼"}</span>
              </button>
            </div>

            {paginatedMembers.map((member) => {
              const isExpired = member.endDate
                ? (() => {
                  try {
                    return isBefore(parseISO(member.endDate), new Date());
                  } catch {
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
                  data-member-id={member.id}
                  ref={(el) => {
                    if (el) memberRefs.current[member.id] = el;
                  }}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow duration-150 transform-gpu member-card"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(member.id)}
                        onChange={() => toggleSelect(member.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mt-1"
                      />
                      <Avatar
                        photo={photosCache[member.id] || null}
                        firstName={member.firstName}
                        name={member.name}
                        size={48}
                        onClick={() => handleEditMember(member)}
                        title="Cliquer pour modifier"
                      />

                      <div className="flex-1">
                        <div
                          className="font-semibold text-gray-900 dark:text-white text-lg cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-all duration-200"
                          onClick={() => handleEditMember(member)}
                          title="Cliquer pour modifier"
                        >
                          {member.name} {member.firstName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">ID: {member.id}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${member.gender === "Femme"
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
                            className={`text-xs ${isExpired
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

                  <div className="pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2">
                    {/* Bouton Réabonner - Pleine largeur en haut (si expiré) */}
                    {isExpired && (
                      <button
                        onClick={() => handleQuickRenew(member)}
                        className="w-full bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white px-3 py-2.5 rounded-lg inline-flex items-center justify-center gap-2 transition-colors font-medium"
                        title="Réabonner pour l'année en cours"
                      >
                        <FaSync className="w-4 h-4" />
                        🔄 Réabonner pour {new Date().getFullYear()}
                      </button>
                    )}

                    {/* Boutons Modifier et Supprimer - Côte à côte en dessous */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditMember(member)}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-3 py-2 rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
                      >
                        <FaEdit />
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="flex-1 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white px-3 py-2 rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
                      >
                        <FaTrash />
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

      {/* Pagination bottom */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage} sur {totalPages}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors inline-flex items-center gap-1"
            >
              <FaChevronLeft className="w-3 h-3" />
              <span className="hidden sm:inline">Précédent</span>
            </button>

            <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">
              {startIndex + 1}-{Math.min(endIndex, filteredMembers.length)} sur {filteredMembers.length}
            </span>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors inline-flex items-center gap-1"
            >
              <span className="hidden sm:inline">Suivant</span>
              <FaChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Résumé */}
      {filteredMembers.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center justify-between">
            <div>
              Affichage de {startIndex + 1}-{Math.min(endIndex, filteredMembers.length)} sur {filteredMembers.length} membre
              {filteredMembers.length !== 1 ? "s" : ""} filtrés • {members.length} total
            </div>
            {loadingPhotos && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                Chargement photos...
              </div>
            )}
          </div>
          {selectedIds.length > 0 && (
            <div className="mt-2 text-blue-600 dark:text-blue-400 font-medium">
              {selectedIds.length} sélectionné{selectedIds.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Modal mobile */}
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
                    await supabaseServices.updateMember(selectedMember.id, memberData);
                    memberId = selectedMember.id;
                    console.log("✅ Membre modifié:", selectedMember.id);
                  } else {
                    const newMember = await supabaseServices.createMember(memberData);
                    memberId = newMember.id;
                    console.log("✅ Nouveau membre créé:", newMember.id);
                  }

                  if (closeModal) {
                    setShowForm(false);
                    setSelectedMember(null);
                  }

                  await fetchMembers();

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

function Widget({ title, value, onClick, active = false }) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg text-center cursor-pointer transition-colors duration-150 border-2 transform-gpu ${active
        ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 shadow-md"
        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-700 shadow-sm"
        }`}
    >
      <div
        className={`text-sm ${active ? "text-blue-700 dark:text-blue-300 font-medium" : "text-gray-500 dark:text-gray-400"
          }`}
      >
        {title}
      </div>
      <div
        className={`text-xl font-bold ${active ? "text-blue-800 dark:text-blue-200" : "text-gray-800 dark:text-gray-200"
          }`}
      >
        {value}
      </div>
    </div>
  );
}

export default MembersPage;
