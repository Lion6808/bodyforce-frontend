// 📄 MemberFormPage.js — COMPLET CORRIGÉ avec compression optimisée egress
// 🎯 Onglets réorganisés : Profil | Documents | Abonnement | Présence | Messages
// 🔒 Gestion complète des paiements alignée sur MemberForm
// ✅ Compression photos pour optimiser egress Supabase
// ✅ Retour intelligent avec repositionnement automatique

import MemberMessagesTab from "../components/MemberMessagesTab";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Camera,
  RotateCcw,
  Check,
  X,
  SwitchCamera,
  Upload,
  User,
  ArrowLeft,
} from "lucide-react";
import {
  FaCamera,
  FaFileUpload,
  FaTrash,
  FaDownload,
  FaUser,
  FaHome,
  FaCreditCard,
  FaFileAlt,
  FaEuroSign,
  FaCalendarAlt,
  FaIdCard,
  FaPhone,
  FaEnvelope,
  FaGraduationCap,
  FaCheck,
  FaTimes,
  FaEye,
  FaEdit,
  FaPaperPlane,
  FaComments,
  FaClipboardList,
  FaSync,
  FaChartLine,
  FaChartBar,
  FaFilter,
  FaClock,
} from "react-icons/fa";
import { supabase, supabaseServices } from "../supabaseClient";

// 🔧 Fonctions utilitaires
const formatDate = (date, fmt) => {
  const map = {
    "yyyy-MM-dd": { year: "numeric", month: "2-digit", day: "2-digit" },
    "dd/MM/yyyy": { day: "2-digit", month: "2-digit", year: "numeric" },
    "EEE dd/MM": { weekday: "short", day: "2-digit", month: "2-digit" },
    "EEE dd": { weekday: "short", day: "2-digit" },
    "HH:mm": { hour: "2-digit", minute: "2-digit", hour12: false },
    "MMMM yyyy": { month: "long", year: "numeric" },
    "EEEE dd MMMM": { weekday: "long", day: "numeric", month: "long" },
  };
  if (fmt === "yyyy-MM-dd") return date.toISOString().split("T")[0];
  return new Intl.DateTimeFormat("fr-FR", map[fmt] || {}).format(date);
};

const parseTimestamp = (ts) => new Date(ts);

const toDateString = (date) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const isWeekend = (date) => [0, 6].includes(date.getDay());
const isToday = (d) => d.toDateString() === new Date().toDateString();

const subscriptionDurations = {
  Mensuel: 1,
  Trimestriel: 3,
  Semestriel: 6,
  Annuel: 12,
  "Année civile": 12,
};

function sanitizeFileName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_.-]/g, "");
}

// ✅ NOUVELLE FONCTION : Compression d'image optimisée egress
const compressImageData = (imageData, maxSize = 256, quality = 0.6) => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = maxSize;
      canvas.height = maxSize;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, maxSize, maxSize);

      const compressed = canvas.toDataURL("image/jpeg", quality);

      // Log pour monitoring egress
      const sizeKB = Math.round((compressed.length * 0.75) / 1024);
      console.log(
        `📸 Photo optimisée: ${sizeKB} KB (${maxSize}x${maxSize} @ ${quality * 100
        }%)`
      );

      resolve(compressed);
    };

    img.onerror = reject;
    img.src = imageData;
  });
};

// ✅ COMPOSANT CAMÉRA (INCHANGÉ - gestion streams préservée)
function CameraModal({ isOpen, onClose, onCapture, isDarkMode }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [facingMode, setFacingMode] = useState("user");

  const cleanupStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const currentStream = videoRef.current.srcObject;
      currentStream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setStream(null);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      cleanupStream();
      return;
    }

    let isMounted = true;

    const initializeCamera = async () => {
      cleanupStream();
      if (!isMounted) return;

      setIsLoading(true);
      setError(null);
      setCapturedPhoto(null);

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(
          (device) => device.kind === "videoinput"
        );
        if (isMounted) setAvailableCameras(videoDevices);

        const constraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const newStream = await navigator.mediaDevices.getUserMedia(
          constraints
        );
        if (isMounted && videoRef.current) {
          videoRef.current.srcObject = newStream;
          await videoRef.current.play();
          setStream(newStream);
        }
      } catch (err) {
        let errorMessage = "Impossible d'accéder à la caméra.";
        if (err.name === "NotReadableError") {
          errorMessage = "La caméra est déjà utilisée.";
        } else if (err.name === "NotAllowedError") {
          errorMessage = "L'accès à la caméra a été refusé.";
        }
        if (isMounted) setError(errorMessage);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initializeCamera();
    return () => {
      isMounted = false;
      cleanupStream();
    };
  }, [isOpen, facingMode]);

  const switchCamera = () => {
    if (availableCameras.length > 1 && !isLoading) {
      setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const targetSize = 256;
    canvas.width = targetSize;
    canvas.height = targetSize;

    if (facingMode === "user") {
      context.save();
      context.scale(-1, 1);
      context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      context.restore();
    } else {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    const imageData = canvas.toDataURL("image/jpeg", 0.6);
    setCapturedPhoto(imageData);
    cleanupStream();
  };

  const confirmPhoto = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      onClose();
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setIsLoading(true);
    const currentMode = facingMode;
    setFacingMode("");
    setTimeout(() => setFacingMode(currentMode), 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      <div
        className={`${isDarkMode ? "bg-gray-800" : "bg-white"
          } rounded-xl overflow-hidden max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col`}
      >
        <div
          className={`p-4 border-b ${isDarkMode ? "border-gray-700" : "border-gray-200"
            } flex items-center justify-between`}
        >
          <h3
            className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-900"
              }`}
          >
            📸 Prendre une photo
          </h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isDarkMode ? "text-gray-300" : "text-gray-600"
              }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-center max-w-md">
              <p className="font-medium mb-2">⚠ Erreur caméra</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!error && (
            <div className="relative bg-black rounded-xl overflow-hidden max-w-md w-full aspect-[4/3]">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <p>Démarrage de la caméra...</p>
                  </div>
                </div>
              )}

              {!capturedPhoto && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"
                    }`}
                  style={{
                    transform: facingMode === "user" ? "scaleX(-1)" : "none",
                  }}
                />
              )}

              {capturedPhoto && (
                <img
                  src={capturedPhoto}
                  alt="Photo capturée"
                  className="w-full h-full object-cover"
                />
              )}

              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {!error && (
            <div className="mt-6 flex items-center gap-4 h-16">
              {!isLoading && !capturedPhoto ? (
                <>
                  {availableCameras.length > 1 && (
                    <button
                      onClick={switchCamera}
                      className={`p-3 rounded-full border-2 ${isDarkMode
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-100"
                        } transition-colors`}
                    >
                      <SwitchCamera className="w-6 h-6" />
                    </button>
                  )}
                  <button
                    onClick={capturePhoto}
                    disabled={!stream}
                    className="w-16 h-16 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-full flex items-center justify-center transition-colors shadow-lg"
                  >
                    <Camera className="w-8 h-8" />
                  </button>
                  <button
                    onClick={onClose}
                    className={`p-3 rounded-full border-2 ${isDarkMode
                        ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                        : "border-gray-300 text-gray-600 hover:bg-gray-100"
                      } transition-colors`}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </>
              ) : (
                capturedPhoto && (
                  <>
                    <button
                      onClick={retakePhoto}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Reprendre
                    </button>
                    <button
                      onClick={confirmPhoto}
                      className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                      <Check className="w-5 h-5" />
                      Confirmer
                    </button>
                  </>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ✅ COMPOSANTS UTILITAIRES
function InputField({ label, icon: Icon, error, ...props }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {Icon && <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${error
              ? "border-red-300 bg-red-50 dark:bg-red-950"
              : "border-gray-200 dark:border-gray-600 hover:border-gray-300 focus:border-blue-500"
            }`}
        />
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
    </div>
  );
}

function SelectField({ label, options, icon: Icon, error, ...props }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {Icon && <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
        {label}
      </label>
      <div className="relative">
        <select
          {...props}
          className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${error
              ? "border-red-300 bg-red-50 dark:bg-red-950"
              : "border-gray-200 dark:border-gray-600 hover:border-gray-300 focus:border-blue-500"
            }`}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ isExpired, isStudent }) {
  return (
    <div className="flex gap-2">
      {isExpired && (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300">
          <FaTimes className="w-3 h-3 mr-1" />
          Expiré
        </span>
      )}
      {isStudent && (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300">
          <FaGraduationCap className="w-3 h-3 mr-1" />
          Étudiant
        </span>
      )}
    </div>
  );
}

// ✅ MODAL DE CONFIRMATION
function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  type = "danger",
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div
              className={`p-3 rounded-full ${type === "danger"
                  ? "bg-red-100 dark:bg-red-900/30"
                  : "bg-orange-100 dark:bg-orange-900/30"
                }`}
            >
              {type === "danger" ? (
                <FaTrash className="w-6 h-6 text-red-600 dark:text-red-400" />
              ) : (
                <FaTimes className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
            </div>
          </div>

          <p className="text-gray-600 dark:text-gray-300 mb-6">{message}</p>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-white rounded-lg transition-colors ${type === "danger"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-orange-600 hover:bg-orange-700"
                }`}
            >
              {type === "danger" ? "Supprimer" : "Confirmer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ COMPOSANT PRINCIPAL
function MemberFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { member, returnPath } = location.state || {};

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
    files: [],
    photo: null,
    etudiant: false,
  });

  const [payments, setPayments] = useState([]);

  const [newPayment, setNewPayment] = useState({
    amount: "",
    method: "espèces",
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

  useEffect(() => {
    const loadMemberData = async () => {
      if (!member?.id) {
        // Nouveau membre - initialiser le formulaire vide si nécessaire
        if (!form.name && !form.firstName) {
          // Le formulaire est déjà vide par défaut
        }
        return;
      }

      // Membre existant - recharger depuis Supabase avec la photo
      if (!form.name && !form.firstName) {
        try {
          const fullMember = await supabaseServices.getMemberById(member.id);
          if (fullMember) {
            setForm({
              ...fullMember,
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
          // Fallback sur les données partielles
          setForm({
            ...member,
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

  useEffect(() => {
    if (!form.startDate) return;
    if (form.subscriptionType === "Année civile") {
      const year = new Date(form.startDate).getFullYear();
      setForm((f) => ({
        ...f,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
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

  const age = form.birthdate
    ? Math.floor(
      (new Date() - new Date(form.birthdate)) / (365.25 * 24 * 3600 * 1000)
    )
    : null;
  const isExpired = form.endDate && new Date(form.endDate) < new Date();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

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

  const handleSave = async () => {
    try {
      setUploadStatus({ loading: true, error: null, success: null });

      let savedMemberId;

      if (member?.id) {
        await supabaseServices.updateMember(member.id, {
          ...form,
          files: JSON.stringify(form.files),
        });
        savedMemberId = member.id;
        setUploadStatus({
          loading: false,
          error: null,
          success: "Membre modifié avec succès !",
        });
      } else {
        const newMember = await supabaseServices.createMember({
          ...form,
          files: JSON.stringify(form.files),
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

  const fetchPayments = async (memberId) => {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("member_id", memberId)
      .order("date_paiement", { ascending: false });

    if (!error) setPayments(data);
  };

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
      return;
    }

    setNewPayment({
      amount: "",
      method: "espèces",
      encaissement_prevu: "",
      commentaire: "",
      is_paid: false,
    });

    fetchPayments(member.id);
  };

  const handleDeletePayment = async (id) => {
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) {
      console.error("Erreur suppression paiement :", error.message);
      return;
    }
    fetchPayments(member.id);
  };

  const togglePaymentStatus = async (paymentId, newStatus) => {
    const { error } = await supabase
      .from("payments")
      .update({ is_paid: newStatus })
      .eq("id", paymentId);

    if (error) {
      console.error(
        "Erreur mise à jour du statut de paiement :",
        error.message
      );
      return;
    }

    fetchPayments(member.id);
  };

  const formatPrice = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return "0,00 €";
    }

    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

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
          throw new Error(`Erreur lors du téléversement : ${error.message}`);
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

  // ✅ MODIFIÉ : Compression après capture caméra
  const handleCameraCapture = async (imageData) => {
    try {
      // Compression du dataURL reçu de la caméra
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

  // ✅ MODIFIÉ : Compression pour documents capturés
  const captureDocument = async (imageData) => {
    setUploadStatus({ loading: true, error: null, success: null });
    try {
      // Compression avant conversion en blob (documents: taille plus grande)
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
          `Erreur lors du téléversement du document : ${uploadError.message}`
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

  const handleRemovePhoto = () => {
    setConfirmDialog({
      isOpen: true,
      type: "photo",
      item: null,
    });
  };

  const handleRemoveFile = (fileToRemove) => {
    setConfirmDialog({
      isOpen: true,
      type: "file",
      item: fileToRemove,
    });
  };

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

  const handleCancelDelete = () => {
    setConfirmDialog({ isOpen: false, type: "", item: null });
  };

  const fetchMemberAttendance = async (memberId) => {
    if (!memberId) return;

    setAttendanceData((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await supabase
        .from("presences")
        .select("*")
        .eq("badgeId", form.badgeId || memberId)
        .gte("timestamp", attendanceFilters.startDate + "T00:00:00")
        .lte("timestamp", attendanceFilters.endDate + "T23:59:59")
        .order("timestamp", { ascending: false });

      if (error)
        throw new Error(
          `Erreur lors du chargement des présences: ${error.message}`
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

  const renderProfileTab = () => (
    <div className="space-y-8">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <FaUser className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Informations personnelles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField
            label="Nom"
            name="name"
            value={form.name}
            onChange={handleChange}
            icon={FaUser}
            placeholder="Nom de famille"
          />
          <InputField
            label="Prénom"
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            icon={FaUser}
            placeholder="Prénom"
          />
          <InputField
            type="date"
            label="Date de naissance"
            name="birthdate"
            value={form.birthdate}
            onChange={handleChange}
            icon={FaCalendarAlt}
          />
          <SelectField
            label="Sexe"
            name="gender"
            value={form.gender}
            onChange={handleChange}
            options={["Homme", "Femme"]}
            icon={FaUser}
          />
        </div>
        {age !== null && (
          <div className="mt-6 bg-gray-50 dark:bg-gray-700 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <FaCalendarAlt className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <span className="text-gray-700 dark:text-gray-200 font-medium">
                Âge : {age} ans
              </span>
            </div>
          </div>
        )}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-600 p-6 rounded-xl border border-blue-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <FaGraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 dark:text-white">
                  Statut étudiant
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Bénéficiez de tarifs préférentiels
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, etudiant: !f.etudiant }))}
              className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${form.etudiant
                  ? "bg-gradient-to-r from-blue-500 to-purple-600"
                  : "bg-gray-300 dark:bg-gray-600"
                }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-300 ${form.etudiant ? "translate-x-7" : ""
                  }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <FaHome className="w-5 h-5 text-green-600 dark:text-green-400" />
          Contact
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField
            label="Adresse complète"
            name="address"
            value={form.address}
            onChange={handleChange}
            icon={FaHome}
            placeholder="Numéro, rue, ville, code postal"
          />
          <InputField
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            icon={FaEnvelope}
            placeholder="exemple@email.com"
          />
          <InputField
            label="Téléphone fixe"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            icon={FaPhone}
            placeholder="01 23 45 67 89"
          />
          <InputField
            label="Téléphone portable"
            name="mobile"
            value={form.mobile}
            onChange={handleChange}
            icon={FaPhone}
            placeholder="06 12 34 56 78"
          />
        </div>
      </div>
    </div>
  );

  const renderDocumentsTab = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <FaFileAlt className="w-5 h-5 text-orange-600 dark:text-orange-400" />
        Gestion des documents
      </h3>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <label
          htmlFor="fileUpload"
          className="cursor-pointer flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <FaFileUpload className="w-4 h-4" />
          Importer des fichiers
        </label>
        <input
          type="file"
          id="fileUpload"
          className="hidden"
          multiple
          onChange={handleFileUpload}
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        />

        <button
          type="button"
          onClick={() => setShowCamera("document")}
          className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <Camera className="w-4 h-4" />
          Photographier un document
        </button>
      </div>

      {form.files.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {form.files.map((file) => (
            <div
              key={file.name}
              className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <FaFileAlt className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-800 dark:text-white truncate">
                    {file.name}
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {file.url && (
                      <>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 text-sm rounded-lg hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
                        >
                          <FaEye className="w-3 h-3" />
                          Voir
                        </a>
                        <a
                          href={file.url}
                          download={file.name}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 text-sm rounded-lg hover:bg-green-200 dark:hover:bg-green-700 transition-colors"
                        >
                          <FaDownload className="w-3 h-3" />
                          Télécharger
                        </a>
                      </>
                    )}
                    <button
                      onClick={() => handleRemoveFile(file)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 text-sm rounded-lg hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
                    >
                      <FaTrash className="w-3 h-3" />
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-700 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <FaFileAlt className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-300 text-lg font-medium">
            Aucun document
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            Importez des certificats, documents d'identité, etc.
          </p>
        </div>
      )}
    </div>
  );
  const renderSubscriptionTab = () => {
    const totalPayments = payments.reduce((sum, payment) => {
      const amount = parseFloat(payment.amount) || 0;
      return sum + amount;
    }, 0);

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <FaCreditCard className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          Gestion de l'abonnement
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SelectField
            label="Type d'abonnement"
            name="subscriptionType"
            value={form.subscriptionType}
            onChange={handleChange}
            options={Object.keys(subscriptionDurations)}
            icon={FaCreditCard}
          />
          <InputField
            label="ID Badge"
            name="badgeId"
            value={form.badgeId}
            onChange={handleChange}
            icon={FaIdCard}
            placeholder="Numéro du badge d'accès"
          />
          <InputField
            type="date"
            label="Date de début"
            name="startDate"
            value={form.startDate}
            onChange={handleChange}
            icon={FaCalendarAlt}
          />
          <InputField
            type="date"
            label="Date de fin"
            name="endDate"
            value={form.endDate}
            readOnly
            icon={FaCalendarAlt}
          />
        </div>

        {isExpired && (
          <div className="mt-6 bg-red-50 dark:bg-red-900 border-l-4 border-red-400 dark:border-red-700 p-4 rounded-r-xl">
            <div className="flex items-center">
              <FaTimes className="w-5 h-5 text-red-400 dark:text-red-300 mr-2" />
              <p className="text-red-800 dark:text-red-200 font-medium">
                Abonnement expiré le{" "}
                {new Date(form.endDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}

        {member?.id && (
          <div className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 p-6 rounded-xl border border-green-200 dark:border-green-600">
            <h4 className="flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-white mb-4">
              <FaEuroSign className="w-5 h-5 text-green-600 dark:text-green-300" />
              Nouveau paiement
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <InputField
                label="Montant (€)"
                type="number"
                name="amount"
                value={newPayment.amount}
                onChange={(e) =>
                  setNewPayment((p) => ({ ...p, amount: e.target.value }))
                }
                icon={FaEuroSign}
                placeholder="0.00"
                step="0.01"
              />
              <SelectField
                label="Méthode de paiement"
                name="method"
                value={newPayment.method}
                onChange={(e) =>
                  setNewPayment((p) => ({ ...p, method: e.target.value }))
                }
                options={["espèces", "chèque", "carte", "virement", "autre"]}
                icon={FaCreditCard}
              />
              <InputField
                label="Encaissement prévu"
                type="date"
                name="encaissement_prevu"
                value={newPayment.encaissement_prevu}
                onChange={(e) =>
                  setNewPayment((p) => ({
                    ...p,
                    encaissement_prevu: e.target.value,
                  }))
                }
                icon={FaCalendarAlt}
              />
            </div>

            <div className="mb-4">
              <InputField
                label="Commentaire"
                name="commentaire"
                value={newPayment.commentaire}
                onChange={(e) =>
                  setNewPayment((p) => ({ ...p, commentaire: e.target.value }))
                }
                placeholder="Note ou commentaire sur ce paiement"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-0 sm:justify-between">
              <label className="flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={newPayment.is_paid}
                    onChange={(e) =>
                      setNewPayment((p) => ({
                        ...p,
                        is_paid: e.target.checked,
                      }))
                    }
                    className="sr-only"
                  />
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${newPayment.is_paid
                        ? "bg-green-500 border-green-500"
                        : "border-gray-300 dark:border-gray-500"
                      }`}
                  >
                    {newPayment.is_paid && (
                      <FaCheck className="w-3 h-3 text-white" />
                    )}
                  </div>
                </div>
                Paiement déjà encaissé
              </label>

              <button
                type="button"
                onClick={handleAddPayment}
                disabled={!newPayment.amount}
                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none w-full sm:w-auto"
              >
                <FaEuroSign className="w-4 h-4" />
                Ajouter le paiement
              </button>
            </div>
          </div>
        )}

        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FaEuroSign className="w-4 h-4 text-green-600 dark:text-green-400" />
              Historique des paiements
            </h4>

            {payments.length > 0 && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 px-4 py-2 rounded-lg border border-green-200 dark:border-green-700">
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Total encaissé
                  </p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatPrice(totalPayments)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {payments.length > 0 ? (
            <div className="space-y-4">
              {payments.map((pay) => (
                <div
                  key={pay.id}
                  className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 w-full sm:w-auto">
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className={`p-2 rounded-lg ${pay.is_paid
                              ? "bg-green-100 dark:bg-green-900"
                              : "bg-orange-100 dark:bg-orange-900"
                            }`}
                        >
                          <FaEuroSign
                            className={`w-4 h-4 ${pay.is_paid
                                ? "text-green-600 dark:text-green-300"
                                : "text-orange-600 dark:text-orange-300"
                              }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-lg text-gray-800 dark:text-white">
                            {formatPrice(parseFloat(pay.amount) || 0)}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                            {pay.method}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mb-3">
                        <button
                          onClick={() =>
                            togglePaymentStatus(pay.id, !pay.is_paid)
                          }
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${pay.is_paid
                              ? "bg-green-500 border-green-500"
                              : "border-gray-300 dark:border-gray-500 hover:border-green-400"
                            }`}
                        >
                          {pay.is_paid && (
                            <FaCheck className="w-3 h-3 text-white" />
                          )}
                        </button>
                        <span
                          className={`text-sm font-medium ${pay.is_paid
                              ? "text-green-600 dark:text-green-300"
                              : "text-orange-600 dark:text-orange-300"
                            }`}
                        >
                          {pay.is_paid ? "Encaissé" : "En attente"}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <p>
                          Payé le{" "}
                          {new Date(pay.date_paiement).toLocaleDateString()}
                        </p>
                        {pay.encaissement_prevu && (
                          <p className="text-blue-600 dark:text-blue-300">
                            Encaissement prévu :{" "}
                            {new Date(
                              pay.encaissement_prevu
                            ).toLocaleDateString()}
                          </p>
                        )}
                        {pay.commentaire && (
                          <p className="italic text-gray-500 dark:text-gray-400">
                            {pay.commentaire}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeletePayment(pay.id)}
                      className="flex items-center justify-center gap-2 px-3 py-2 text-red-600 dark:text-red-300 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors w-full sm:w-auto"
                    >
                      <FaTrash className="w-3 h-3" />
                      <span className="sm:hidden">Supprimer</span>
                    </button>
                  </div>
                </div>
              ))}

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {payments.length} paiement{payments.length > 1 ? "s" : ""}{" "}
                      enregistré{payments.length > 1 ? "s" : ""}
                    </p>
                    {payments.length > 1 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Du{" "}
                        {new Date(
                          Math.min(
                            ...payments.map((p) => new Date(p.date_paiement))
                          )
                        ).toLocaleDateString()}
                        au{" "}
                        {new Date(
                          Math.max(
                            ...payments.map((p) => new Date(p.date_paiement))
                          )
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Total
                    </p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatPrice(totalPayments)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
              <FaEuroSign className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-300 font-medium">
                Aucun paiement enregistré
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                L'historique des paiements apparaîtra ici
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAttendanceTab = () => {
    const { presences, loading, error, stats } = attendanceData;

    if (!member?.id) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-center py-12">
            <FaClipboardList className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Membre non sauvegardé
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Veuillez d'abord enregistrer le membre pour voir ses présences
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <FaClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Suivi des présences
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Membre: {form.firstName} {form.name}{" "}
                  {form.badgeId ? `(Badge: ${form.badgeId})` : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={attendanceFilters.startDate}
                  onChange={(e) =>
                    setAttendanceFilters((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="date"
                  value={attendanceFilters.endDate}
                  onChange={(e) =>
                    setAttendanceFilters((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                  className="border-2 border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <button
                onClick={() => fetchMemberAttendance(member.id)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
              >
                <FaSync
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                Actualiser
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() =>
                setAttendanceFilters((prev) => ({
                  ...prev,
                  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0],
                  endDate: new Date().toISOString().split("T")[0],
                }))
              }
              className="px-3 py-1 text-xs bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-600 transition-colors"
            >
              7 derniers jours
            </button>
            <button
              onClick={() =>
                setAttendanceFilters((prev) => ({
                  ...prev,
                  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0],
                  endDate: new Date().toISOString().split("T")[0],
                }))
              }
              className="px-3 py-1 text-xs bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-600 transition-colors"
            >
              30 derniers jours
            </button>

            <button
              onClick={() =>
                setAttendanceFilters((prev) => ({
                  ...prev,
                  startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0],
                  endDate: new Date().toISOString().split("T")[0],
                }))
              }
              className="px-3 py-1 text-xs bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-600 transition-colors"
            >
              3 derniers mois
            </button>

            <button
              onClick={() => {
                const currentYear = new Date().getFullYear();
                setAttendanceFilters((prev) => ({
                  ...prev,
                  startDate: `${currentYear}-01-01`,
                  endDate: new Date().toISOString().split("T")[0],
                }));
              }}
              className="px-3 py-1 text-xs bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900/50 dark:hover:to-purple-900/50 text-blue-700 dark:text-blue-400 rounded border-2 border-blue-300 dark:border-blue-600 transition-colors font-semibold"
            >
              Année en cours
            </button>
          </div>
        </div>

        {loading && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              <p className="text-gray-600 dark:text-gray-400">
                Chargement des présences...
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <FaTimes className="w-5 h-5 text-red-500" />
              <div>
                <h4 className="font-medium text-red-800 dark:text-red-200">
                  Erreur de chargement
                </h4>
                <p className="text-red-600 dark:text-red-300 text-sm mt-1">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <FaClipboardList className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
                    Total visites
                  </p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {stats.totalVisits}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-6 border border-green-200 dark:border-green-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-500 rounded-lg">
                  <FaCalendarAlt className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-green-700 dark:text-green-400">
                    Jours uniques
                  </p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {stats.uniqueDays}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-6 border border-purple-200 dark:border-purple-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <FaChartLine className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-purple-700 dark:text-purple-400">
                    Moyenne/jour
                  </p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {stats.avgVisitsPerDay}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-6 border border-orange-200 dark:border-orange-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-500 rounded-lg">
                  <FaClock className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-400">
                    Heure favorite
                  </p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {stats.peakHour}h
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FaChartBar className="w-5 h-5 text-blue-600" />
                Répartition par jour de la semaine
              </h4>

              <div className="space-y-3">
                {[
                  "Dimanche",
                  "Lundi",
                  "Mardi",
                  "Mercredi",
                  "Jeudi",
                  "Vendredi",
                  "Samedi",
                ].map((day, index) => {
                  const count = stats.weeklyDistribution[index];
                  const maxCount = Math.max(...stats.weeklyDistribution);
                  const percentage =
                    maxCount > 0 ? (count / maxCount) * 100 : 0;

                  return (
                    <div key={day} className="flex items-center gap-3">
                      <div className="w-20 text-sm font-medium text-gray-700 dark:text-gray-300">
                        {day.slice(0, 3)}
                      </div>
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${index === 0 || index === 6
                              ? "bg-gradient-to-r from-blue-400 to-blue-600"
                              : "bg-gradient-to-r from-green-400 to-green-600"
                            }`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800 dark:text-gray-200">
                          {count} visite{count > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {stats.peakDay && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Jour préféré:</strong> {stats.peakDay}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FaClock className="w-5 h-5 text-purple-600" />
                Répartition par heure
              </h4>

              <div className="grid grid-cols-6 gap-1">
                {stats.hourlyDistribution.map((count, hour) => {
                  const maxCount = Math.max(...stats.hourlyDistribution);
                  const height =
                    maxCount > 0
                      ? Math.max((count / maxCount) * 80, count > 0 ? 10 : 0)
                      : 0;

                  return (
                    <div key={hour} className="flex flex-col items-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {hour}h
                      </div>
                      <div
                        className="w-full bg-gray-200 dark:bg-gray-700 rounded-t flex items-end"
                        style={{ height: "80px" }}
                      >
                        {count > 0 && (
                          <div
                            className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t flex items-center justify-center text-white text-xs font-bold transition-all duration-500"
                            style={{ height: `${height}px` }}
                            title={`${hour}h: ${count} visite${count > 1 ? "s" : ""
                              }`}
                          >
                            {count > 0 && height > 20 ? count : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  <strong>Heure de pointe:</strong> {stats.peakHour}h00 (
                  {stats.hourlyDistribution[stats.peakHour]} visite
                  {stats.hourlyDistribution[stats.peakHour] > 1 ? "s" : ""})
                </p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && stats && stats.dailyStats.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FaCalendarAlt className="w-5 h-5 text-green-600" />
                Historique des visites ({stats.dailyStats.length} jours)
              </h4>

              {stats.firstVisit && stats.lastVisit && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Du {formatDate(stats.firstVisit, "dd/MM/yyyy")} au{" "}
                  {formatDate(stats.lastVisit, "dd/MM/yyyy")}
                </div>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto space-y-3">
              {stats.dailyStats.map((day, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${isToday(day.date)
                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
                      : isWeekend(day.date)
                        ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700"
                        : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div
                        className={`text-lg font-bold ${isToday(day.date)
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-900 dark:text-white"
                          }`}
                      >
                        {day.date.getDate()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(day.date, "EEE dd/MM").split(" ")[0]}
                      </div>
                    </div>

                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {formatDate(day.date, "EEEE dd MMMM")}
                        {isToday(day.date) && (
                          <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full font-bold">
                            Aujourd'hui
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {day.count} visite{day.count > 1 ? "s" : ""}
                        {day.count > 1 && (
                          <span className="text-orange-600 dark:text-orange-400 font-medium ml-1">
                            (passages multiples)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap gap-1">
                      {day.hours.slice(0, 3).map((hour, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded border font-mono"
                        >
                          {hour}
                        </span>
                      ))}
                      {day.hours.length > 3 && (
                        <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 text-xs rounded">
                          +{day.hours.length - 3}
                        </span>
                      )}
                    </div>

                    <div
                      className={`px-3 py-1 rounded-full text-xs font-bold ${day.count === 1
                          ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                          : day.count <= 3
                            ? "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300"
                            : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                        }`}
                    >
                      {day.count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && (!stats || stats.totalVisits === 0) && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-center py-12">
              <FaClipboardList className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Aucune présence trouvée
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Aucune visite enregistrée pour cette période
                {form.badgeId ? ` avec le badge ${form.badgeId}` : ""}
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                Les présences apparaîtront ici dès que le membre utilisera son
                badge d'accès
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMessagesTab = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="text-center py-12">
        <FaComments className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Journal des messages
        </h3>
        {member?.id && <MemberMessagesTab memberId={member.id} />}
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Cette fonctionnalité sera bientôt disponible
        </p>
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-sm text-green-700 dark:text-green-300">
          Notes, communications, historique des échanges
        </div>
      </div>
    </div>
  );

  const renderCurrentTab = () => {
    switch (activeTab) {
      case "profile":
        return renderProfileTab();
      case "documents":
        return renderDocumentsTab();
      case "subscription":
        return renderSubscriptionTab();
      case "attendance":
        return renderAttendanceTab();
      case "messages":
        return renderMessagesTab();
      default:
        return renderProfileTab();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => handleBack()}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la liste
          </button>

          <div className="text-center">
            <div className="relative mx-auto mb-4">
              {form.photo ? (
                <div className="relative">
                  <img
                    src={form.photo}
                    alt="Photo du membre"
                    className="w-32 h-32 object-cover rounded-full border-4 border-gray-200 dark:border-gray-600 shadow-lg mx-auto"
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
                <div className="w-32 h-32 flex items-center justify-center border-4 border-dashed border-gray-300 dark:border-gray-600 rounded-full text-gray-400 bg-gray-50 dark:bg-gray-700 mx-auto">
                  <div className="text-center">
                    <User className="w-12 h-12 mx-auto mb-2" />
                    <p className="text-xs">Pas de photo</p>
                  </div>
                </div>
              )}
            </div>

            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {form.firstName || form.name
                ? `${form.firstName} ${form.name}`
                : "Nouveau membre"}
            </h1>

            <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {member?.id
                ? `Membre depuis ${new Date().toLocaleDateString()}`
                : "Nouveau membre"}
            </div>

            <StatusBadge isExpired={isExpired} isStudent={form.etudiant} />
          </div>
        </div>

        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="space-y-3">
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

        <div className="p-6 space-y-4 flex-1">
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

        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-4 gap-2">
            <button className="p-3 text-gray-600 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex flex-col items-center gap-1">
              <FaPaperPlane className="w-4 h-4" />
              <span className="text-xs">Envoyer accès</span>
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

      <div className="flex-1 flex flex-col">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {member?.id ? "Modifier le membre" : "Nouveau membre"}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Gérez les informations et documents du membre
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleBack()}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={uploadStatus.loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center gap-2"
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

        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === tab.id
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

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

        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="p-6">{renderCurrentTab()}</div>
        </div>
      </div>

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

export default MemberFormPage;
