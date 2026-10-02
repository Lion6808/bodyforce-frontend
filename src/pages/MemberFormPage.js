/**
 * MemberFormPage.js
 *
 * Full-featured member creation and editing page for the BodyForce gym management app.
 * Organized into five tabs: Profil | Documents | Abonnement | Presence | Messages.
 *
 * Responsibilities:
 *  - Create or update a member (personal info, photo, badge, subscription)
 *  - Manage document uploads and camera captures with image compression
 *  - Record and display payment history
 *  - Display attendance statistics with charts
 *  - Show the member messages tab
 *
 * Navigation: receives { member, returnPath } via location.state and returns
 * to the calling page with optional scroll-restoration data.
 */

// ===================================================================
// SECTION 1 -- Imports
// ===================================================================

import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Camera,
  Check,
  X,
  Upload,
  User,
  ArrowLeft,
} from "lucide-react";
import {
  FaUser,
  FaCreditCard,
  FaFileAlt,
  FaIdCard,
  FaPhone,
  FaEnvelope,
  FaCheck,
  FaTimes,
  FaPaperPlane,
  FaComments,
  FaClipboardList,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { supabase, supabaseServices } from "../supabaseClient";
import MemberMessagesTab from "../components/MemberMessagesTab";
import { DEFAULT_MEMBER_TYPE, MemberTypeTag } from "../utils/memberTypes";
import { isMemberExpired } from "../utils/memberRules";
import { CameraModal } from "../components/memberForm/CameraModal";
import { StatusBadge, ConfirmDialog } from "../components/memberForm/MemberFormParts";
import { sanitizeFileName, compressImageData } from "../utils/imageUtils";
import { formatDate, parseTimestamp, toDateString } from "../utils/dateUtils";
import { subscriptionDurations, getSubscriptionEndDate, formatIsoDateFr } from "../utils/subscription";
import { ProfileTab } from "../components/memberForm/tabs/ProfileTab";
import { DocumentsTab } from "../components/memberForm/tabs/DocumentsTab";
import { SubscriptionTab } from "../components/memberForm/tabs/SubscriptionTab";
import { AttendanceTab } from "../components/memberForm/tabs/AttendanceTab";

// ===================================================================
// SECTION 9 -- Main Component: MemberFormPage
// ===================================================================

/**
 * MemberFormPage is the main page component. It reads the member data from
 * navigation state, provides a sidebar with photo / quick info, and a tabbed
 * content area for editing all member-related data.
 */
function MemberFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { member, returnPath } = location.state || {};

  // -----------------------------------------------------------------
  // 9.1 -- State declarations
  // -----------------------------------------------------------------

  const [activeTab, setActiveTab] = useState("profile");
  const [form, setForm] = useState({
    name: "",
    firstName: "",
    birthdate: "",
    gender: "Homme",
    address: "",
    phone: "",
    mobile: "",
    email: "",
    subscriptionType: "Mensuel",
    startDate: "",
    endDate: "",
    badgeId: "",
    badge_number: "",
    files: [],
    photo: null,
    etudiant: false,
    member_type: DEFAULT_MEMBER_TYPE,
  });

  const [payments, setPayments] = useState([]);

  const [newPayment, setNewPayment] = useState({
    amount: "",
    method: "especes",
    encaissement_prevu: "",
    commentaire: "",
    is_paid: false,
  });

  const [showCamera, setShowCamera] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({
    loading: false,
    error: null,
    success: null,
  });

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: "",
    item: null,
  });

  const [attendanceData, setAttendanceData] = useState({
    presences: [],
    loading: false,
    error: null,
    stats: null,
  });

  const [attendanceFilters, setAttendanceFilters] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    showHourlyGraph: false,
  });

  // Tab definitions for the navigation bar
  const tabs = [
    { id: "profile", label: "Profil", icon: FaUser },
    {
      id: "documents",
      label: "Documents",
      icon: FaFileAlt,
      count: form.files.length,
    },
    { id: "subscription", label: "Abonnement", icon: FaCreditCard },
    {
      id: "attendance",
      label: "Présence",
      icon: FaClipboardList,
      count: attendanceData.stats?.totalVisits || 0,
    },
    { id: "messages", label: "Messages", icon: FaComments },
  ];

  // -----------------------------------------------------------------
  // 9.2 -- Effects
  // -----------------------------------------------------------------

  // Watch for dark mode class on <html>
  useEffect(() => {
    const checkDarkMode = () =>
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // Load member data from Supabase when editing an existing member
  useEffect(() => {
    const loadMemberData = async () => {
      if (!member?.id) {
        return;
      }

      if (!form.name && !form.firstName) {
        try {
          const fullMember = await supabaseServices.getMemberById(member.id);
          if (fullMember) {
            setForm({
              ...fullMember,
              badge_number: fullMember.badge_number || "",
              files: Array.isArray(fullMember.files)
                ? fullMember.files
                : typeof fullMember.files === "string"
                ? JSON.parse(fullMember.files || "[]")
                : [],
              etudiant: !!fullMember.etudiant,
            });
            fetchPayments(fullMember.id);
          }
        } catch (error) {
          console.error("Erreur chargement membre complet:", error);
          // Fallback: use partial data passed via navigation state
          setForm({
            ...member,
            badge_number: member.badge_number || "",
            files: Array.isArray(member.files)
              ? member.files
              : typeof member.files === "string"
              ? JSON.parse(member.files || "[]")
              : [],
            etudiant: !!member.etudiant,
          });
          if (member.id) fetchPayments(member.id);
        }
      }
    };

    loadMemberData();
  }, [member?.id, form.name, form.firstName]);

  // Recalculate subscription end date when type or start date changes
  useEffect(() => {
    if (!form.startDate) return;

    if (form.subscriptionType === "Année civile") {
      const year = new Date(form.startDate).getFullYear();
      setForm((f) => ({
        ...f,
        startDate: `${year}-01-01`,
        endDate: getSubscriptionEndDate(year),
      }));
    } else {
      const start = new Date(form.startDate);
      const months = subscriptionDurations[form.subscriptionType] || 1;
      const end = new Date(start);
      end.setMonth(start.getMonth() + months);
      end.setDate(end.getDate() - 1);
      setForm((f) => ({ ...f, endDate: end.toISOString().slice(0, 10) }));
    }
  }, [form.subscriptionType, form.startDate]);

  // Fetch attendance data when the attendance tab is selected
  useEffect(() => {
    if (member?.id && activeTab === "attendance") {
      fetchMemberAttendance(member.id);
    }
  }, [
    member?.id,
    activeTab,
    attendanceFilters.startDate,
    attendanceFilters.endDate,
  ]);

  // -----------------------------------------------------------------
  // 9.3 -- Derived values
  // -----------------------------------------------------------------

  const age = form.birthdate
    ? Math.floor(
        (new Date() - new Date(form.birthdate)) / (365.25 * 24 * 3600 * 1000)
      )
    : null;

  const isExpired = isMemberExpired(form);

  // -----------------------------------------------------------------
  // 9.4 -- Event handlers
  // -----------------------------------------------------------------

  /** Generic handler for text / checkbox / select changes on the form. */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  /**
   * When the badge number input changes, look up the corresponding
   * badge_real_id from the badge_mapping table.
   */
  const handleBadgeNumberChange = async (e) => {
    const badgeNumber = e.target.value;

    setForm((f) => ({ ...f, badge_number: badgeNumber }));

    if (!badgeNumber || badgeNumber === "") {
      setForm((f) => ({ ...f, badgeId: "" }));
      return;
    }

    try {
      const { data, error } = await supabase
        .from("badge_mapping")
        .select("badge_real_id")
        .eq("badge_number", parseInt(badgeNumber))
        .single();

      if (error) {
        setForm((f) => ({ ...f, badgeId: "" }));
        return;
      }

      if (data) {
        setForm((f) => ({ ...f, badgeId: data.badge_real_id }));
      }
    } catch (err) {
      console.error("Erreur recherche badge:", err);
      setForm((f) => ({ ...f, badgeId: "" }));
    }
  };

  /**
   * Navigate back to the previous page. If returnPath is set, pass along
   * the edited member ID so the list can restore scroll position.
   */
  const handleBack = (editedMemberId = null) => {
    if (returnPath) {
      if (editedMemberId) {
        navigate(returnPath, {
          state: {
            returnedFromEdit: true,
            editedMemberId: editedMemberId,
          },
        });
      } else {
        navigate(returnPath);
      }
    } else {
      navigate(-1);
    }
  };

  /** Save the member (create or update) then navigate back after a delay. */
  const handleSave = async () => {
    try {
      setUploadStatus({ loading: true, error: null, success: null });

      // Prepare data: convert badge_number to integer or null if empty
      const preparedForm = {
        ...form,
        badge_number: form.badge_number ? parseInt(form.badge_number, 10) : null,
        badgeId: form.badgeId || null,
      };

      let savedMemberId;

      if (member?.id) {
        // Check if badge was reassigned
        if (preparedForm.badgeId && preparedForm.badgeId !== member.badgeId) {

          await supabaseServices.reassignBadge(preparedForm.badgeId, member.id);

          const { badgeId, ...formWithoutBadge } = preparedForm;
          await supabaseServices.updateMember(member.id, {
            ...formWithoutBadge,
            files: JSON.stringify(formWithoutBadge.files),
          });
        } else {
          await supabaseServices.updateMember(member.id, {
            ...preparedForm,
            files: JSON.stringify(preparedForm.files),
          });
        }

        savedMemberId = member.id;
        setUploadStatus({
          loading: false,
          error: null,
          success: "Membre modifié avec succès !",
        });
      } else {
        const newMember = await supabaseServices.createMember({
          ...preparedForm,
          files: JSON.stringify(preparedForm.files),
        });
        savedMemberId = newMember.id;
        setUploadStatus({
          loading: false,
          error: null,
          success: "Nouveau membre créé avec succès !",
        });
      }

      setTimeout(() => handleBack(savedMemberId), 1500);
    } catch (error) {
      setUploadStatus({
        loading: false,
        error: `Erreur lors de la sauvegarde: ${error.message}`,
        success: null,
      });
    }
  };

  // -----------------------------------------------------------------
  // 9.5 -- Payment handlers
  // -----------------------------------------------------------------

  /** Fetch all payments for the given member, ordered by date descending. */
  const fetchPayments = async (memberId) => {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("member_id", memberId)
      .order("date_paiement", { ascending: false });

    if (error) {
      console.error("Erreur chargement paiements :", error.message);
      toast.error(`Erreur lors du chargement des paiements : ${error.message}`);
      return;
    }
    setPayments(data);
  };

  /** Insert a new payment row, then refresh the payments list. */
  const handleAddPayment = async () => {
    if (!member?.id || !newPayment.amount) return;

    const { error } = await supabase.from("payments").insert([
      {
        member_id: member.id,
        amount: parseFloat(newPayment.amount),
        method: newPayment.method,
        encaissement_prevu: newPayment.encaissement_prevu || null,
        commentaire: newPayment.commentaire || "",
        is_paid: newPayment.is_paid || false,
      },
    ]);

    if (error) {
      console.error("Erreur ajout paiement :", error.message);
      toast.error(`Erreur lors de l'ajout du paiement : ${error.message}`);
      return;
    }

    setNewPayment({
      amount: "",
      method: "especes",
      encaissement_prevu: "",
      commentaire: "",
      is_paid: false,
    });

    fetchPayments(member.id);
  };

  /** Delete a payment by ID, then refresh the list. */
  const handleDeletePayment = async (id) => {
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) {
      console.error("Erreur suppression paiement :", error.message);
      toast.error(`Erreur lors de la suppression du paiement : ${error.message}`);
      return;
    }
    fetchPayments(member.id);
  };

  /** Toggle the is_paid flag on a payment. */
  const togglePaymentStatus = async (paymentId, newStatus) => {
    const { error } = await supabase
      .from("payments")
      .update({ is_paid: newStatus })
      .eq("id", paymentId);

    if (error) {
      console.error(
        "Erreur mise a jour du statut de paiement :",
        error.message
      );
      toast.error(`Erreur lors de la mise à jour du statut : ${error.message}`);
      return;
    }

    fetchPayments(member.id);
  };

  /** Format a numeric amount as a French-locale currency string. */
  const formatPrice = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return "0,00 \u20AC";
    }

    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  // -----------------------------------------------------------------
  // 9.6 -- File & photo handlers
  // -----------------------------------------------------------------

  /** Upload one or more files to Supabase Storage, then add them to form.files. */
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;

    setUploadStatus({ loading: true, error: null, success: null });

    try {
      const newFiles = [];
      for (const file of files) {
        const safeName = sanitizeFileName(file.name);
        const filePath = `certificats/${Date.now()}_${safeName}`;
        const { error } = await supabase.storage
          .from("documents")
          .upload(filePath, file);
        if (error)
          throw new Error(`Erreur lors du televersement : ${error.message}`);
        const { data } = supabase.storage
          .from("documents")
          .getPublicUrl(filePath);
        newFiles.push({ name: safeName, url: data.publicUrl });
      }

      setForm((f) => ({ ...f, files: [...f.files, ...newFiles] }));
      setUploadStatus({
        loading: false,
        error: null,
        success: `${newFiles.length} fichier(s) ajouté(s) !`,
      });
      setTimeout(
        () => setUploadStatus({ loading: false, error: null, success: null }),
        3000
      );
    } catch (err) {
      setUploadStatus({ loading: false, error: err.message, success: null });
    }
    e.target.value = "";
  };

  /** Compress a camera-captured image and set it as the member photo. */
  const handleCameraCapture = async (imageData) => {
    try {
      const compressed = await compressImageData(imageData, 256, 0.6);

      setForm((f) => ({ ...f, photo: compressed }));
      setUploadStatus({
        loading: false,
        error: null,
        success: "Photo capturée et optimisée !",
      });
    } catch (err) {
      setUploadStatus({
        loading: false,
        error: "Erreur lors de la compression",
        success: null,
      });
    }

    setTimeout(
      () => setUploadStatus({ loading: false, error: null, success: null }),
      3000
    );
  };

  /**
   * Compress a camera-captured document image (larger max size),
   * upload it to storage, and add it to form.files.
   */
  const captureDocument = async (imageData) => {
    setUploadStatus({ loading: true, error: null, success: null });
    try {
      const compressed = await compressImageData(imageData, 800, 0.75);

      const response = await fetch(compressed);
      const blob = await response.blob();
      const fileName = sanitizeFileName(`doc_${Date.now()}.jpg`);
      const filePath = `certificats/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, blob);

      if (uploadError)
        throw new Error(
          `Erreur lors du televersement du document : ${uploadError.message}`
        );

      const { data } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      const newFile = { name: fileName, url: data.publicUrl };
      setForm((f) => ({ ...f, files: [...f.files, newFile] }));

      setUploadStatus({
        loading: false,
        error: null,
        success: "Document capturé et optimisé !",
      });

      setTimeout(
        () => setUploadStatus({ loading: false, error: null, success: null }),
        3000
      );
    } catch (err) {
      setUploadStatus({
        loading: false,
        error: `Erreur lors de la capture du document : ${err.message}`,
        success: null,
      });
    }
  };

  /** Prompt for confirmation before removing the member photo. */
  const handleRemovePhoto = () => {
    setConfirmDialog({
      isOpen: true,
      type: "photo",
      item: null,
    });
  };

  /** Prompt for confirmation before removing a file. */
  const handleRemoveFile = (fileToRemove) => {
    setConfirmDialog({
      isOpen: true,
      type: "file",
      item: fileToRemove,
    });
  };

  /** Execute the confirmed deletion (photo or file). */
  const handleConfirmDelete = async () => {
    const { type, item } = confirmDialog;

    try {
      if (type === "photo") {
        setForm((f) => ({ ...f, photo: null }));
        setUploadStatus({
          loading: false,
          error: null,
          success: "Photo supprimée !",
        });
      } else if (type === "file" && item) {
        const url = item.url;
        const fullPrefix = "/storage/v1/object/public/";
        const bucketIndex = url.indexOf(fullPrefix);
        if (bucketIndex !== -1) {
          const afterPrefix = url.substring(bucketIndex + fullPrefix.length);
          const [bucket, ...pathParts] = afterPrefix.split("/");
          const path = pathParts.join("/");
          const { error: storageError } = await supabase.storage
            .from(bucket)
            .remove([path]);
          if (storageError)
            throw new Error(`Erreur de suppression : ${storageError.message}`);
        }

        setForm((f) => ({
          ...f,
          files: f.files.filter((file) => file.url !== item.url),
        }));
        setUploadStatus({
          loading: false,
          error: null,
          success: "Fichier supprimé !",
        });
      }

      setTimeout(
        () => setUploadStatus({ loading: false, error: null, success: null }),
        3000
      );
    } catch (err) {
      setUploadStatus({ loading: false, error: err.message, success: null });
    }

    setConfirmDialog({ isOpen: false, type: "", item: null });
  };

  /** Cancel the pending deletion dialog. */
  const handleCancelDelete = () => {
    setConfirmDialog({ isOpen: false, type: "", item: null });
  };

  // -----------------------------------------------------------------
  // 9.7 -- Attendance data loading & statistics
  // -----------------------------------------------------------------

  /**
   * Fetch attendance records for the member using the get_member_presences RPC,
   * filtered by the current date range.
   */
  const fetchMemberAttendance = async (memberId) => {
    if (!memberId) return;

    setAttendanceData((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await supabase
        .rpc("get_member_presences", { p_member_id: memberId })
        .gte("timestamp", attendanceFilters.startDate + "T00:00:00")
        .lte("timestamp", attendanceFilters.endDate + "T23:59:59")
        .order("timestamp", { ascending: false });

      if (error)
        throw new Error(
          `Erreur lors du chargement des presences: ${error.message}`
        );

      const presences = (data || []).map((p) => ({
        ...p,
        parsedDate: parseTimestamp(p.timestamp),
      }));

      const stats = calculateAttendanceStats(presences);

      setAttendanceData({
        presences,
        loading: false,
        error: null,
        stats,
      });
    } catch (err) {
      setAttendanceData((prev) => ({
        ...prev,
        loading: false,
        error: err.message,
      }));
    }
  };

  /**
   * Compute attendance statistics from an array of presence records:
   * total visits, unique days, daily breakdown, hourly and weekly distributions.
   * @param {Array} presences - Presence records with parsedDate field.
   * @returns {Object|null} Stats object or null if no data.
   */
  const calculateAttendanceStats = (presences) => {
    if (!presences.length) return null;

    const dailyPresences = {};
    const hourlyDistribution = new Array(24).fill(0);
    const weeklyDistribution = new Array(7).fill(0);

    presences.forEach((p) => {
      const date = toDateString(p.parsedDate);
      const hour = p.parsedDate.getHours();
      const dayOfWeek = p.parsedDate.getDay();

      if (!dailyPresences[date]) {
        dailyPresences[date] = [];
      }
      dailyPresences[date].push(p);

      hourlyDistribution[hour]++;
      weeklyDistribution[dayOfWeek]++;
    });

    const dailyStats = Object.entries(dailyPresences).map(
      ([date, dayPresences]) => ({
        date: new Date(date + "T00:00:00"),
        count: dayPresences.length,
        hours: dayPresences
          .map((p) => formatDate(p.parsedDate, "HH:mm"))
          .sort(),
      })
    );

    const totalVisits = presences.length;
    const uniqueDays = Object.keys(dailyPresences).length;
    const avgVisitsPerDay = totalVisits / Math.max(uniqueDays, 1);

    const peakHour = hourlyDistribution.indexOf(
      Math.max(...hourlyDistribution)
    );

    const dayNames = [
      "Dimanche",
      "Lundi",
      "Mardi",
      "Mercredi",
      "Jeudi",
      "Vendredi",
      "Samedi",
    ];
    const peakDay =
      dayNames[weeklyDistribution.indexOf(Math.max(...weeklyDistribution))];

    const firstVisit = presences[presences.length - 1]?.parsedDate;
    const lastVisit = presences[0]?.parsedDate;

    return {
      totalVisits,
      uniqueDays,
      avgVisitsPerDay: Math.round(avgVisitsPerDay * 10) / 10,
      peakHour,
      peakDay,
      firstVisit,
      lastVisit,
      dailyStats: dailyStats.sort((a, b) => b.date - a.date),
      hourlyDistribution,
      weeklyDistribution,
    };
  };

  // -----------------------------------------------------------------
  // 9.8 -- Tab renderers
  // -----------------------------------------------------------------

  /** Render the Messages tab with the MemberMessagesTab sub-component. */
  const renderMessagesTab = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="text-center py-12">
        <FaComments className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Journal des messages
        </h3>
        {member?.id && <MemberMessagesTab memberId={member.id} />}
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Cette fonctionnalite sera bientot disponible
        </p>
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-sm text-green-700 dark:text-green-300">
          Notes, communications, historique des echanges
        </div>
      </div>
    </div>
  );

  /** Route to the correct tab renderer based on activeTab state. */
  const renderCurrentTab = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileTab form={form} setForm={setForm} handleChange={handleChange} age={age} />;
      case "documents":
        return <DocumentsTab form={form} payments={payments} handleFileUpload={handleFileUpload} handleRemoveFile={handleRemoveFile} setShowCamera={setShowCamera} />;
      case "subscription":
        return <SubscriptionTab member={member} form={form} handleChange={handleChange} handleBadgeNumberChange={handleBadgeNumberChange} isExpired={isExpired} payments={payments} newPayment={newPayment} setNewPayment={setNewPayment} handleAddPayment={handleAddPayment} handleDeletePayment={handleDeletePayment} togglePaymentStatus={togglePaymentStatus} formatPrice={formatPrice} />;
      case "attendance":
        return <AttendanceTab member={member} form={form} attendanceData={attendanceData} attendanceFilters={attendanceFilters} setAttendanceFilters={setAttendanceFilters} fetchMemberAttendance={fetchMemberAttendance} />;
      case "messages":
        return renderMessagesTab();
      default:
        return <ProfileTab form={form} setForm={setForm} handleChange={handleChange} age={age} />;
    }
  };

  // -----------------------------------------------------------------
  // 9.9 -- Main JSX render
  // -----------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col lg:flex-row">
      {/* ============ Left sidebar (stacked header on mobile) ============ */}
      <div className="w-full lg:w-80 lg:flex-shrink-0 bg-white dark:bg-gray-800 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Sidebar header: back button + member photo + name */}
        <div className="p-4 lg:p-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => handleBack()}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la liste
          </button>

          <div className="flex items-center gap-4 lg:block lg:text-center">
            <div className="relative flex-shrink-0 lg:mx-auto lg:mb-4">
              {form.photo ? (
                <div className="relative">
                  <img
                    src={form.photo}
                    alt="Photo du membre"
                    className="w-20 h-20 lg:w-32 lg:h-32 object-cover rounded-full border-4 border-gray-200 dark:border-gray-600 shadow-lg mx-auto"
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 lg:w-32 lg:h-32 flex items-center justify-center border-4 border-dashed border-gray-300 dark:border-gray-600 rounded-full text-gray-400 bg-gray-50 dark:bg-gray-700 mx-auto">
                  <div className="text-center">
                    <User className="w-8 h-8 lg:w-12 lg:h-12 mx-auto lg:mb-2" />
                    <p className="text-xs hidden lg:block">Pas de photo</p>
                  </div>
                </div>
              )}
            </div>

            <div className="min-w-0">
            <h1 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white mb-1 lg:mb-2">
              {form.firstName || form.name
                ? `${form.firstName} ${form.name}`
                : "Nouveau membre"}
            </h1>

            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2 lg:mb-4">
              {!member?.id
                ? "Nouveau membre"
                : form.startDate
                  ? `Abonnement depuis le ${formatIsoDateFr(form.startDate)}`
                  : ""}
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:block">
              <StatusBadge isExpired={isExpired} isStudent={form.etudiant} />
              {form.member_type && form.member_type !== DEFAULT_MEMBER_TYPE && (
                <div className="lg:mt-2">
                  <MemberTypeTag type={form.member_type} className="text-sm px-3 py-1" />
                </div>
              )}
            </div>
            </div>
          </div>
        </div>

        {/* Photo capture / upload buttons */}
        <div className="p-4 lg:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => setShowCamera("photo")}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Camera className="w-4 h-4" />
              Prendre une photo
            </button>

            <label className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              Choisir un fichier
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (file) {
                    try {
                      setUploadStatus({
                        loading: true,
                        error: null,
                        success: null,
                      });

                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        try {
                          const compressed = await compressImageData(
                            event.target.result,
                            256,
                            0.6
                          );
                          setForm((prev) => ({ ...prev, photo: compressed }));
                          setUploadStatus({
                            loading: false,
                            error: null,
                            success: "Photo optimisée et ajoutée",
                          });
                          setTimeout(
                            () =>
                              setUploadStatus({
                                loading: false,
                                error: null,
                                success: null,
                              }),
                            3000
                          );
                        } catch (err) {
                          setUploadStatus({
                            loading: false,
                            error: "Erreur lors de la compression",
                            success: null,
                          });
                        }
                      };
                      reader.readAsDataURL(file);
                    } catch (err) {
                      setUploadStatus({
                        loading: false,
                        error: "Erreur lors du chargement",
                        success: null,
                      });
                    }
                  }
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Sidebar: personal details summary (desktop only, duplicates the form) */}
        <div className="hidden lg:block p-6 space-y-4 flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wide">
            Détails personnels
          </h3>

          <div className="space-y-3">
            {form.birthdate && (
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Anniversaire
                </dt>
                <dd className="text-sm text-gray-900 dark:text-white">
                  {new Date(form.birthdate).toLocaleDateString()}
                  {age && ` (${age} ans)`}
                </dd>
              </div>
            )}

            {form.phone && (
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Téléphone
                </dt>
                <dd className="text-sm text-gray-900 dark:text-white">
                  {form.phone}
                </dd>
              </div>
            )}

            {form.email && (
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Email
                </dt>
                <dd className="text-sm text-gray-900 dark:text-white break-all">
                  {form.email}
                </dd>
              </div>
            )}

            {form.badgeId && (
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Badge
                </dt>
                <dd className="text-sm text-gray-900 dark:text-white font-mono">
                  {form.badgeId}
                </dd>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: quick action buttons (desktop only) */}
        <div className="hidden lg:block p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-4 gap-2">
            <button className="p-3 text-gray-600 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex flex-col items-center gap-1">
              <FaPaperPlane className="w-4 h-4" />
              <span className="text-xs">Envoyer acces</span>
            </button>
            <button className="p-3 text-gray-600 dark:text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors flex flex-col items-center gap-1">
              <FaPhone className="w-4 h-4" />
              <span className="text-xs">Appeler</span>
            </button>
            <button className="p-3 text-gray-600 dark:text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors flex flex-col items-center gap-1">
              <FaEnvelope className="w-4 h-4" />
              <span className="text-xs">Email</span>
            </button>
            <button className="p-3 text-gray-600 dark:text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors flex flex-col items-center gap-1">
              <FaIdCard className="w-4 h-4" />
              <span className="text-xs">Carte</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============ Main content area ============ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Page header with save / cancel buttons */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
                {member?.id ? "Modifier le membre" : "Nouveau membre"}
              </h1>
              <p className="hidden sm:block text-gray-600 dark:text-gray-400 mt-1">
                Gerez les informations et documents du membre
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleBack()}
                className="flex-1 sm:flex-none px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={uploadStatus.loading}
                className="flex-1 sm:flex-none px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {uploadStatus.loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <FaCheck className="w-4 h-4" />
                    Enregistrer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          {/* Mobile: 5 equal columns (icon above label) — no horizontal scroll.
              Desktop (lg): original inline tabs. */}
          <nav className="grid grid-cols-5 lg:flex lg:space-x-8 lg:px-6" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={`relative min-w-0 py-2 lg:py-4 lg:px-1 border-b-2 font-medium text-[11px] lg:text-sm transition-colors flex flex-col lg:flex-row items-center justify-center gap-1 lg:gap-2 ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                <tab.icon className="w-5 h-5 lg:w-4 lg:h-4" />
                <span className="max-w-full truncate">{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="absolute top-1 right-2 lg:static lg:ml-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-1.5 lg:px-2 rounded-full text-[10px] lg:text-xs leading-none lg:leading-normal">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Status banners */}
        {uploadStatus.loading && (
          <div className="bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-400 dark:border-blue-700 p-4">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
              <p className="text-blue-700 dark:text-blue-300">
                Sauvegarde en cours...
              </p>
            </div>
          </div>
        )}

        {uploadStatus.error && (
          <div className="bg-red-50 dark:bg-red-900 border-l-4 border-red-400 dark:border-red-700 p-4">
            <div className="flex items-center">
              <FaTimes className="w-4 h-4 text-red-400 dark:text-red-300 mr-3" />
              <p className="text-red-700 dark:text-red-200">
                {uploadStatus.error}
              </p>
            </div>
          </div>
        )}

        {uploadStatus.success && (
          <div className="bg-green-50 dark:bg-green-900 border-l-4 border-green-400 dark:border-green-700 p-4">
            <div className="flex items-center">
              <FaCheck className="w-4 h-4 text-green-400 dark:text-green-200 mr-3" />
              <p className="text-green-700 dark:text-green-100">
                {uploadStatus.success}
              </p>
            </div>
          </div>
        )}

        {/* Active tab content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {/* pb-28 on mobile: keep the end of the form above the floating bottom nav */}
          <div className="p-4 pb-28 lg:p-6">{renderCurrentTab()}</div>
        </div>
      </div>

      {/* ============ Modals ============ */}
      {showCamera && (
        <CameraModal
          key={showCamera}
          isOpen={!!showCamera}
          onClose={() => setShowCamera(null)}
          onCapture={async (imageData) => {
            setShowCamera(null);
            if (showCamera === "document") {
              await captureDocument(imageData);
            } else {
              await handleCameraCapture(imageData);
            }
          }}
          isDarkMode={isDarkMode}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        title={
          confirmDialog.type === "photo"
            ? "Supprimer la photo"
            : "Supprimer le document"
        }
        message={
          confirmDialog.type === "photo"
            ? "Êtes-vous sûr de vouloir supprimer cette photo ? Cette action est irréversible."
            : `Êtes-vous sûr de vouloir supprimer le document "${confirmDialog.item?.name}" ? Cette action est irréversible.`
        }
        type="danger"
      />
    </div>
  );
}

// ===================================================================
// SECTION 10 -- Export
// ===================================================================

export default MemberFormPage;
