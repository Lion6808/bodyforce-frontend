// ✅ PaymentsPage.js OPTIMISÉ EGRESS avec pagination + lazy photos

import React, { useState, useEffect, useMemo, useRef } from "react";
import jsPDF from "jspdf";
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Calendar,
  Search,
  Filter,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  Edit,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import Avatar from "../components/Avatar";
import { supabase, supabaseServices } from "../supabaseClient";
import MemberForm from "../components/MemberForm";

function PaymentsPage() {
  // ✅ Détection mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkIfMobile = () => setIsMobile(window.innerWidth < 1024);
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  // ✅ Dark mode
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // ✅ Données
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState("");

  // ✅ Filtres / recherche
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // ✅ UI
  const [expandedMember, setExpandedMember] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // ✅ Pagination + lazy photos (OPTIMISÉ comme MembersPage)
  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [photosCache, setPhotosCache] = useState({}); // { [memberId]: dataURL/null }
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const photosLoadingRef = useRef(false); // ✅ Anti-courses d'effets

  // ====== Chargement (egress friendly) ======
  const loadData = async (showRetryIndicator = false) => {
    try {
      if (showRetryIndicator) setIsRetrying(true);
      setLoading(true);
      setError("");

      // 1) Membres SANS photos (egress optimisé)
      const membersData = await supabaseServices.getMembersWithoutPhotos();

      // 2) Paiements + relation membre (sans photo dans la relation)
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select(
          `
            *,
            members (id, badgeId, name, firstName, email, phone, mobile)
          `
        )
        .order("date_paiement", { ascending: false });

      if (paymentsError) throw new Error(`Erreur paiements: ${paymentsError.message}`);

      setMembers(membersData || []);
      setPayments(paymentsData || []);
      setRetryCount(0);
      console.log(`✅ ${membersData?.length ?? 0} membres chargés (sans photos)`);
    } catch (e) {
      setError(e.message || "Erreur de connexion à la base de données");
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    loadData(true);
  };

  // ====== Helpers paiements ======
  function isOverdue(payment) {
    if (payment.is_paid) return false;
    if (!payment.encaissement_prevu) return false;
    return new Date(payment.encaissement_prevu) < new Date();
  }

  function getPaymentStatus(payment) {
    if (payment.is_paid) return "paid";
    if (isOverdue(payment)) return "overdue";
    return "pending";
  }

  const stats = {
    totalMembers: members.length,
    totalExpected: payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    totalReceived: payments.filter((p) => p.is_paid).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    totalPending: payments.filter((p) => !p.is_paid && !isOverdue(p)).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    totalOverdue: payments.filter((p) => !p.is_paid && isOverdue(p)).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    paidCount: payments.filter((p) => p.is_paid).length,
    pendingCount: payments.filter((p) => !p.is_paid && !isOverdue(p)).length,
    overdueCount: payments.filter((p) => !p.is_paid && isOverdue(p)).length,
  };
  stats.collectionRate = stats.totalExpected > 0 ? (stats.totalReceived / stats.totalExpected) * 100 : 0;

  // ====== Enrichissement membres (statuts / agrégats paiements) ======
  const enrichedMembers = useMemo(() => {
    return members.map((member) => {
      const memberPayments = payments.filter((p) => p.member_id === member.id);
      const totalDue = memberPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const totalPaid = memberPayments.filter((p) => p.is_paid).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const progressPercentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;
      const hasOverdue = memberPayments.some((p) => !p.is_paid && isOverdue(p));
      const hasPending = memberPayments.some((p) => !p.is_paid && !isOverdue(p));

      let overallStatus = "no_payments";
      if (memberPayments.length > 0) {
        if (hasOverdue) overallStatus = "overdue";
        else if (hasPending) overallStatus = "pending";
        else overallStatus = "paid";
      }

      const lastPaymentDate = memberPayments
        .filter((p) => p.is_paid)
        .sort((a, b) => new Date(b.date_paiement) - new Date(a.date_paiement))[0]?.date_paiement;

      return {
        ...member,
        payments: memberPayments,
        totalDue,
        totalPaid,
        progressPercentage,
        overallStatus,
        lastPaymentDate,
      };
    });
  }, [members, payments]);

  // ====== Filtrage + Recherche ======
  const filteredMembers = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return enrichedMembers.filter((member) => {
      const matchesSearch =
        member.name?.toLowerCase().includes(query) ||
        member.firstName?.toLowerCase().includes(query) ||
        member.badgeId?.toString().toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || member.overallStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [enrichedMembers, searchTerm, statusFilter]);

  // ✅ Pagination (20) - Calcul dans useMemo comme MembersPage
  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredMembers.slice(startIndex, endIndex);
  }, [filteredMembers, currentPage]);

  const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  // Reset page quand filtres/recherche changent
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // ✅ Lazy-load des photos pour la page courante (OPTIMISÉ comme MembersPage)
  useEffect(() => {
    if (loading || paginatedMembers.length === 0) return;
    if (photosLoadingRef.current) return; // ✅ évite courses d'effets

    const loadPhotosForCurrentPage = async () => {
      const memberIds = paginatedMembers.map((m) => m.id);

      // ✅ IMPORTANT : une entrée présente dans le cache (même null) = déjà vérifiée
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

        // ✅ Construire le prochain cache
        const nextCache = { ...photosCache, ...newPhotos };

        // ✅ Pour chaque id demandé non retourné par l'API, marquer explicitement "pas de photo"
        for (const id of missingIds) {
          if (!(id in newPhotos)) nextCache[id] = null;
        }

        // ✅ N'update l'état QUE si le contenu change réellement (évite re-render et re-effets)
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ====== UI helpers ======
  const getStatusColor = (status) => {
    const baseClasses = isDarkMode
      ? {
          paid: "text-green-400 bg-green-900/30",
          pending: "text-yellow-400 bg-yellow-900/30",
          overdue: "text-red-400 bg-red-900/30",
          no_payments: "text-gray-400 bg-gray-800/30",
        }
      : {
          paid: "text-green-600 bg-green-100",
          pending: "text-yellow-600 bg-yellow-100",
          overdue: "text-red-600 bg-red-100",
          no_payments: "text-gray-600 bg-gray-100",
        };
    return baseClasses[status] || baseClasses.no_payments;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="w-4 h-4" />;
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "overdue":
        return <AlertCircle className="w-4 h-4" />;
      case "no_payments":
        return <CreditCard className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "paid":
        return "Payé";
      case "pending":
        return "En attente";
      case "overdue":
        return "En retard";
      case "no_payments":
        return "Aucun paiement";
      default:
        return "Inconnu";
    }
  };

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case "carte":
        return "💳";
      case "chèque":
      case "cheque":
        return "📝";
      case "espèces":
      case "especes":
        return "💵";
      case "autre":
        return "🔄";
      default:
        return "❓";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Non définie";
    try {
      return new Date(dateString).toLocaleDateString("fr-FR");
    } catch {
      return "Date invalide";
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "Non définie";
    try {
      return new Date(dateString).toLocaleString("fr-FR");
    } catch {
      return "Date invalide";
    }
  };

  // ====== Export PDF / CSV (inchangé, sauf qu'on s'appuie sur filteredMembers) ======
  const exportToPDF = () => {
    try {
      const doc = new jsPDF("landscape", "mm", "a4");

      const primaryColor = [59, 130, 246];
      const textColor = [0, 0, 0];
      const whiteColor = [255, 255, 255];

      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 297, 25, "F");
      doc.setTextColor(...whiteColor);
      doc.setFontSize(18);
      doc.text("CLUB BODY FORCE - RAPPORT PAIEMENTS", 148, 15, { align: "center" });

      const now = new Date();
      const dateStr = now.toLocaleDateString("fr-FR");
      doc.setFontSize(10);
      doc.text(`Genere le ${dateStr}`, 148, 22, { align: "center" });

      doc.setTextColor(...textColor);
      let yPos = 35;

      // Stats globales
      doc.setFontSize(14);
      doc.text("STATISTIQUES GLOBALES", 20, yPos);
      yPos += 10;
      doc.setDrawColor(200, 200, 200);
      doc.rect(15, yPos - 2, 267, 35);
      doc.setFontSize(10);
      doc.text(`Total Attendu: ${stats.totalExpected.toLocaleString("fr-FR")} €`, 20, yPos + 5);
      doc.text(`Total Recu: ${stats.totalReceived.toLocaleString("fr-FR")} € (${stats.collectionRate.toFixed(1)}%)`, 150, yPos + 5);
      doc.text(`En Attente: ${stats.totalPending.toLocaleString("fr-FR")} € (${stats.pendingCount} paiements)`, 20, yPos + 15);
      doc.text(`En Retard: ${stats.totalOverdue.toLocaleString("fr-FR")} € (${stats.overdueCount} paiements)`, 150, yPos + 15);
      doc.text(`Nombre de membres: ${stats.totalMembers}`, 20, yPos + 25);
      doc.text(`Paiements effectues: ${stats.paidCount}`, 150, yPos + 25);
      yPos += 45;

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i}/${pageCount}`, 148, 205, { align: "center" });
        doc.text("Club Body Force - Rapport genere automatiquement", 148, 210, { align: "center" });
      }

      const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "_");
      const fileName = `Rapport_Paiements_${timestamp}.pdf`;
      doc.save(fileName);
      console.log("✅ Export PDF réussi:", fileName);
    } catch (error) {
      console.error("❌ Erreur lors de l'export PDF:", error);
      alert("Erreur lors de la génération du PDF. Veuillez réessayer.");
    }
  };

  const exportToCSV = () => {
    try {
      const csvData = filteredMembers.map((member) => ({
        Nom: member.name || "",
        Prénom: member.firstName || "",
        Badge: member.badgeId || "",
        Email: member.email || "",
        Téléphone: member.phone ?? member.mobile ?? "",
        Statut: getStatusLabel(member.overallStatus),
        "Progression (%)": member.progressPercentage.toFixed(1),
        "Total Dû (€)": member.totalDue.toFixed(2),
        "Total Payé (€)": member.totalPaid.toFixed(2),
        "Reste à Payer (€)": (member.totalDue - member.totalPaid).toFixed(2),
        "Nombre de Paiements": member.payments.length,
        "Paiements Effectués": member.payments.filter((p) => p.is_paid).length,
        "Paiements en Retard": member.payments.filter((p) => !p.is_paid && isOverdue(p)).length,
        "Dernier Paiement": member.lastPaymentDate ? formatDate(member.lastPaymentDate) : "Aucun",
      }));

      const headers = Object.keys(csvData[0] || {});
      const csvContent = [
        headers.join(","),
        ...csvData.map((row) => headers.map((h) => `"${String(row[h]).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Paiements_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
    } catch (error) {
      console.error("❌ Erreur lors de l'export CSV:", error);
      alert("Erreur lors de la génération du CSV. Veuillez réessayer.");
    }
  };

  // ====== Rendus ======
  const renderConnectionError = () => (
    <div
      className={`min-h-screen ${isDarkMode ? "bg-gradient-to-br from-gray-900 to-black" : "bg-gradient-to-br from-blue-50 to-purple-50"
        } flex items-center justify-center p-4`}
    >
      <div
        className={`${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          } rounded-xl shadow-lg p-8 max-w-md w-full text-center border`}
      >
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
        <h2 className={`text-2xl font-bold ${isDarkMode ? "text-white" : "text-gray-800"} mb-4`}>
          Problème de connexion
        </h2>
        <p className={`${isDarkMode ? "text-gray-300" : "text-gray-600"} mb-8 leading-relaxed`}>{error}</p>
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                     disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-6 
                     rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-lg"
        >
          {isRetrying ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Reconnexion...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              Réessayer
            </>
          )}
        </button>
        {retryCount > 0 && (
          <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"} mt-4`}>Tentative {retryCount + 1}</p>
        )}
      </div>
    </div>
  );

  const renderLoading = () => (
    <div
      className={`min-h-screen ${isDarkMode ? "bg-gradient-to-br from-gray-900 to-black" : "bg-gradient-to-br from-blue-50 to-purple-50"
        } flex items-center justify-center`}
    >
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <RefreshCw className="w-8 h-8 animate-spin text-white" />
        </div>
        <h2 className={`text-xl font-semibold ${isDarkMode ? "text-white" : "text-gray-800"} mb-2`}>
          {isRetrying ? "Reconnexion en cours..." : "Chargement optimisé egress..."}
        </h2>
        <p className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>Veuillez patienter</p>
      </div>
    </div>
  );

  // ====== Édition membre (robuste phone/mobile) ======
  const handleEditMember = (member) => {
    const memberOnlyData = {
      id: member.id,
      name: member.name,
      firstName: member.firstName,
      email: member.email,
      phone: member.phone ?? member.mobile ?? "",
      mobile: member.mobile ?? member.phone ?? "",
      badgeId: member.badgeId,
      photo: photosCache[member.id] || null, // ✅ on passe la photo si elle est en cache
      dateOfBirth: member.dateOfBirth,
      address: member.address,
      subscriptionType: member.subscriptionType || member.membershipType || "Mensuel",
      membershipType: member.membershipType,
      startDate: member.startDate,
      endDate: member.endDate,
      status: member.status,
      emergencyContact: member.emergencyContact,
      emergencyPhone: member.emergencyPhone,
      medicalInfo: member.medicalInfo,
      files: member.files,
    };
    setSelectedMember(memberOnlyData);
    setShowForm(true);
  };

  if (loading) return renderLoading();
  if (error && !isRetrying) return renderConnectionError();

  // ====== Pagination UI ======
  const PaginationBar = ({ position = "top" }) =>
    totalPages > 1 ? (
      <div
        className={`${position === "top" ? "mb-4" : "mt-4"
          } flex items-center justify-between ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          } rounded-lg p-3 border`}
      >
        <div className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          Page {currentPage} sur {totalPages} • Affichage de{" "}
          {filteredMembers.length === 0 ? 0 : startIndex + 1}-{Math.min(endIndex, filteredMembers.length)} sur{" "}
          {filteredMembers.length} membres
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className={`px-3 py-2 rounded-lg inline-flex items-center gap-1 ${isDarkMode ? "bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800" : "bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100"
              } disabled:opacity-50`}
            title="Précédent"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Précédent</span>
          </button>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`px-3 py-2 rounded-lg inline-flex items-center gap-1 ${isDarkMode ? "bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800" : "bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100"
              } disabled:opacity-50`}
            title="Suivant"
          >
            <span className="hidden sm:inline">Suivant</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    ) : null;

  // ====== Vue mobile (utilise paginatedMembers + photosCache) ======
  const renderMobileView = () => (
    <div className="space-y-4">
      {paginatedMembers.map((member) => (
        <div
          key={member.id}
          className={`${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            } rounded-lg shadow border overflow-hidden`}
        >
          <div className="p-4">
            {/* En-tête */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  <Avatar
                    photo={photosCache[member.id] || null}
                    firstName={member.firstName}
                    name={member.name}
                    size={48}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-900"} truncate`}>
                    {member.firstName || "Prénom"} {member.name || "Nom"}
                  </h4>
                  <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                    Badge: {member.badgeId || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0 ml-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                    member.overallStatus
                  )}`}
                >
                  {getStatusIcon(member.overallStatus)}
                  <span className="hidden sm:inline">{getStatusLabel(member.overallStatus)}</span>
                </span>
              </div>
            </div>

            {/* Infos */}
            <div className="grid grid-cols-1 gap-3">
              <div className={`${isDarkMode ? "bg-gray-700" : "bg-gray-50"} p-3 rounded-lg`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                    Progression
                  </span>
                  <span className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                    {member.progressPercentage.toFixed(0)}%
                  </span>
                </div>
                <div className={`w-full ${isDarkMode ? "bg-gray-600" : "bg-gray-200"} rounded-full h-2`}>
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${member.progressPercentage === 100
                      ? "bg-gradient-to-r from-green-400 to-green-600"
                      : member.progressPercentage > 50
                        ? "bg-gradient-to-r from-yellow-400 to-yellow-600"
                        : "bg-gradient-to-r from-red-400 to-red-600"
                      }`}
                    style={{ width: `${Math.min(member.progressPercentage, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={`${isDarkMode ? "bg-gray-700" : "bg-gray-50"} p-3 rounded-lg`}>
                  <div className={`text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-600"} mb-1`}>
                    Montants
                  </div>
                  <div className="text-sm">
                    <div className="font-bold text-green-600">{member.totalPaid.toFixed(2)} €</div>
                    <div className={`${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                      sur {member.totalDue.toFixed(2)} €
                    </div>
                  </div>
                </div>

                <div className={`${isDarkMode ? "bg-gray-700" : "bg-gray-50"} p-3 rounded-lg`}>
                  <div className={`text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-600"} mb-1`}>
                    Paiements
                  </div>
                  <div className="text-sm">
                    <div className="font-bold text-blue-600">
                      {member.payments.filter((p) => p.is_paid).length}
                    </div>
                    <div className={`${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                      sur {member.payments.length}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                className={`flex-1 text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center justify-center gap-1 py-2 border ${isDarkMode ? "border-blue-500 hover:bg-blue-900/20" : "border-blue-200 hover:bg-blue-50"
                  } rounded-lg transition-colors`}
              >
                {expandedMember === member.id ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Masquer les détails
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Voir les détails
                  </>
                )}
              </button>

              <button
                onClick={() => handleEditMember(member)}
                className={`flex-1 sm:flex-none text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center justify-center gap-1 py-2 px-4 border ${isDarkMode ? "border-orange-500 hover:bg-orange-900/20" : "border-orange-200 hover:bg-orange-50"
                  } rounded-lg transition-colors`}
              >
                <Edit className="w-4 h-4" />
                Modifier
              </button>
            </div>
          </div>

          {expandedMember === member.id && (
            <div
              className={`border-t ${isDarkMode ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-gray-50"}`}
            >
              <div className="p-4 space-y-4">
                <h5
                  className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-900"
                    } flex items-center gap-2`}
                >
                  <CreditCard className="w-4 h-4" />
                  Détail des paiements
                </h5>

                {member.payments.length > 0 ? (
                  <div className="space-y-3">
                    {member.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className={`${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border"
                          } rounded-lg p-3`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              getPaymentStatus(payment)
                            )}`}
                          >
                            {getStatusIcon(getPaymentStatus(payment))}
                            {getStatusLabel(getPaymentStatus(payment))}
                          </span>
                          <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                            #{payment.id}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className={`${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Montant:</span>
                            <div className="font-bold">{parseFloat(payment.amount || 0).toFixed(2)} €</div>
                          </div>
                          <div>
                            <span className={`${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Méthode:</span>
                            <div className="flex items-center gap-1">
                              <span>{getPaymentMethodIcon(payment.method)}</span>
                              <span className="capitalize">{payment.method}</span>
                            </div>
                          </div>
                          <div>
                            <span className={`${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Date paiement:</span>
                            <div className="font-medium">
                              {payment.is_paid ? formatDate(payment.date_paiement) : "Non payé"}
                            </div>
                          </div>
                          <div>
                            <span className={`${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Échéance:</span>
                            <div className="font-medium">{formatDate(payment.encaissement_prevu)}</div>
                          </div>
                        </div>

                        {payment.commentaire && (
                          <div
                            className={`mt-2 p-2 ${isDarkMode ? "bg-gray-700" : "bg-gray-100"} rounded text-sm`}
                          >
                            <span className={`${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Commentaire:</span>
                            <div className={`${isDarkMode ? "text-gray-300" : "text-gray-700"} mt-1`}>
                              {payment.commentaire}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <CreditCard
                      className={`w-8 h-8 ${isDarkMode ? "text-gray-500" : "text-gray-400"} mx-auto mb-2`}
                    />
                    <p className={`${isDarkMode ? "text-gray-400" : "text-gray-500"} text-sm`}>
                      Aucun paiement enregistré
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // ====== Rendu principal ======
  return (
    <div
      className={`min-h-screen ${isDarkMode ? "bg-gradient-to-br from-gray-900 to-black" : "bg-gradient-to-br from-blue-50 to-purple-50"
        } p-4 lg:p-6`}
    >
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className={`text-2xl lg:text-4xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"} mb-2`}>
                Suivi des Paiements
              </h1>
              <p className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                Mode optimisé egress • {members.length} membres • Pagination {ITEMS_PER_PAGE}/page
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 lg:gap-3">
              <button
                onClick={exportToCSV}
                disabled={loading || filteredMembers.length === 0}
                className={`flex items-center justify-center gap-2 px-4 py-2 ${isDarkMode
                  ? "bg-gray-800 border-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:text-gray-500 text-white"
                  : "bg-white border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                  } border rounded-lg transition-colors text-sm font-medium`}
              >
                <Download className="w-4 h-4" />
                Exporter CSV
              </button>
              <button
                onClick={exportToPDF}
                disabled={loading || filteredMembers.length === 0}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Exporter PDF
              </button>
              <button
                onClick={() => loadData(true)}
                disabled={isRetrying}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
              >
                <RefreshCw className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`} />
                Actualiser
              </button>
            </div>
          </div>
        </div>

        {/* Widgets stats (inchangé) ... */}
        {/* Progression globale (inchangé) ... */}

        {/* Filtres */}
        <div
          className={`${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            } rounded-xl shadow-lg p-4 lg:p-6 mb-4 border`}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search
                  className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDarkMode ? "text-gray-500" : "text-gray-400"
                    } w-5 h-5`}
                />
                <input
                  type="text"
                  placeholder="Rechercher par nom, prénom ou badge..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 border ${isDarkMode
                    ? "border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                    : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    } rounded-lg`}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`px-4 py-2 border ${isDarkMode
                  ? "border-gray-600 bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"
                  : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  } rounded-lg sm:w-48`}
              >
                <option value="all">Tous les statuts</option>
                <option value="paid">Payé</option>
                <option value="pending">En attente</option>
                <option value="overdue">En retard</option>
                <option value="no_payments">Aucun paiement</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                {filteredMembers.length} membre(s) affiché(s) sur {members.length}
                {loadingPhotos && (
                  <span className="ml-2 text-blue-500">
                    • 📸 Chargement photos page {currentPage}...
                  </span>
                )}
              </p>
              {(searchTerm || statusFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium self-start sm:self-auto"
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ✅ Pagination TOP */}
        <PaginationBar position="top" />

        {/* Contenu principal */}
        {isMobile ? (
          // Vue mobile
          <div
            className={`${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              } rounded-xl shadow-lg border`}
          >
            <div className={`px-4 py-4 border-b ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
              <h3 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                Membres ({filteredMembers.length})
              </h3>
            </div>
            <div className="p-4">
              {paginatedMembers.length > 0 ? (
                renderMobileView()
              ) : (
                <div className="text-center py-12">
                  <Users className={`w-16 h-16 ${isDarkMode ? "text-gray-500" : "text-gray-400"} mx-auto mb-4`} />
                  <h3 className={`text-lg font-medium ${isDarkMode ? "text-white" : "text-gray-900"} mb-2`}>
                    Aucun membre trouvé
                  </h3>
                  <p className={`${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                    Essayez de modifier vos critères de recherche
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Vue desktop (tableau) - À COMPLÉTER avec tableau similaire
          <div
            className={`${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              } rounded-xl shadow-lg overflow-hidden border`}
          >
            <div className={`px-6 py-4 border-b ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
              <h3 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                Détail par Membre ({filteredMembers.length})
              </h3>
            </div>
            {/* ... Suite du tableau desktop ... */}
          </div>
        )}

        {/* ✅ Pagination BOTTOM */}
        <PaginationBar position="bottom" />

        {/* Résumé */}
        {paginatedMembers.length > 0 && (
          <div
            className={`mt-4 p-4 ${isDarkMode ? "bg-gray-800" : "bg-gray-50"
              } rounded-lg text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}
          >
            <div className="flex items-center justify-between">
              <div>
                Affichage de {startIndex + 1}-{Math.min(endIndex, filteredMembers.length)} sur{" "}
                {filteredMembers.length} membre
                {filteredMembers.length !== 1 ? "s" : ""} filtrés • {members.length} total
              </div>
              {loadingPhotos && (
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                  Chargement photos...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats par méthode & paiements récents (inchangé) ... */}

      </div>

      {/* ✅ Modal MemberForm */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-start justify-center overflow-auto">
          <div
            className={`${isDarkMode ? "bg-gray-800" : "bg-white"
              } mt-4 mb-4 rounded-xl shadow-xl w-full max-w-4xl mx-4`}
          >
            <MemberForm
              member={selectedMember}
              onSave={async (memberData, closeModal) => {
                try {
                  console.log(
                    "💾 Sauvegarde membre depuis PaymentsPage:",
                    selectedMember ? "Modification" : "Création"
                  );

                  if (selectedMember?.id) {
                    const { error } = await supabase
                      .from("members")
                      .update(memberData)
                      .eq("id", selectedMember.id);
                    if (error) throw error;
                    console.log("✅ Membre modifié:", selectedMember.id);
                  } else {
                    const { data, error } = await supabase.from("members").insert([memberData]).select();
                    if (error) throw error;
                    console.log("✅ Nouveau membre créé:", data[0]?.id);
                  }

                  if (closeModal) {
                    setShowForm(false);
                    setSelectedMember(null);
                  }
                  await loadData();
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

export default PaymentsPage;