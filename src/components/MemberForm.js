// 📄 MemberForm.js — Composant principal — Dossier : components — Date : 2025-07-24
// 🎯 Ajout du support mode sombre (classes Tailwind `dark:`) — Aucune autre modification
// 🔹 Partie 1

import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import Modal from "react-modal";
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
  FaChevronLeft,
  FaChevronRight,
  FaCircle,
} from "react-icons/fa";
import { supabase } from "../supabaseClient";

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
          className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
            error
              ? "border-red-300 bg-red-50 dark:bg-red-950"
              : "border-gray-200 dark:border-gray-600 hover:border-gray-300 focus:border-blue-500"
          }`}
        />
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
    </div>
  );
}
// 🔹 Partie 2

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
          className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
            error
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

function TabButton({ active, onClick, icon: Icon, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 sm:gap-3 px-3 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-medium transition-all duration-200 relative whitespace-nowrap text-sm ${
        active
          ? "bg-white bg-opacity-30 text-white shadow-lg"
          : "text-white text-opacity-80 hover:text-white hover:bg-white hover:bg-opacity-20"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden xs:inline sm:inline">{children}</span>
      {count !== undefined && count > 0 && (
        <span
          className={`ml-1 sm:ml-2 px-1.5 py-0.5 text-xs rounded-full ${
            active ? "bg-white bg-opacity-30" : "bg-white bg-opacity-20"
          }`}
        >
          {count}
        </span>
      )}
    </button>
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
// 🔹 Partie 3

function MemberForm({ member, onSave, onCancel }) {
  const [activeTab, setActiveTab] = useState("identity");
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

  const [webcamOpen, setWebcamOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({
    loading: false,
    error: null,
    success: null,
  });
  const [webcamReady, setWebcamReady] = useState(false);
  const webcamRef = useRef(null);

  // États pour la gestion du swipe
  const containerRef = useRef(null);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const [translateX, setTranslateX] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const tabs = [
    { id: "identity", label: "Identité", icon: FaUser },
    { id: "contact", label: "Contact", icon: FaHome },
    { id: "subscription", label: "Abonnement", icon: FaCreditCard },
    {
      id: "documents",
      label: "Documents",
      icon: FaFileAlt,
      count: form.files.length,
    },
    {
      id: "payments",
      label: "Paiements",
      icon: FaEuroSign,
      count: payments.length,
    },
  ];

  const currentTabIndex = tabs.findIndex((tab) => tab.id === activeTab);

  useEffect(() => {
    if (member) {
      setForm({
        ...member,
        files: Array.isArray(member.files)
          ? member.files
          : typeof member.files === "string"
          ? JSON.parse(member.files || "[]")
          : [],
        etudiant: !!member.etudiant,
      });

      if (member.id) {
        fetchPayments(member.id);
      }
    }
  }, [member]);
// 🔹 Partie 4

  // Gestion des événements tactiles pour le swipe - Version simplifiée
  const handleTouchStart = (e) => {
    if (isTransitioning) return;

    const touch = e.touches[0];
    containerRef.current.startX = touch.clientX;
    containerRef.current.startY = touch.clientY;
    containerRef.current.hasMoved = false;
    containerRef.current.isSwipeHorizontal = null;
  };

  const handleTouchMove = (e) => {
    if (isTransitioning) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - containerRef.current.startX;
    const deltaY = touch.clientY - containerRef.current.startY;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Déterminer le type de mouvement une seule fois
    if (
      containerRef.current.isSwipeHorizontal === null &&
      (absX > 10 || absY > 10)
    ) {
      containerRef.current.isSwipeHorizontal = absX > absY;
      containerRef.current.hasMoved = true;
    }

    // Si c'est un swipe horizontal
    if (containerRef.current.isSwipeHorizontal && absX > 15) {
      e.preventDefault();
      e.stopPropagation();

      // Calculer le feedback visuel
      let clampedDelta = deltaX;

      // Limiter aux bornes
      if (currentTabIndex === 0 && deltaX > 0) {
        clampedDelta = Math.min(deltaX * 0.3, 50); // Résistance au début
      } else if (currentTabIndex === tabs.length - 1 && deltaX < 0) {
        clampedDelta = Math.max(deltaX * 0.3, -50); // Résistance à la fin
      } else {
        clampedDelta = Math.max(-150, Math.min(150, deltaX)); // Mouvement libre
      }

      setTranslateX(clampedDelta);
      isDraggingRef.current = true;
    }
  };

  const handleTouchEnd = () => {
    if (
      !containerRef.current.hasMoved ||
      !containerRef.current.isSwipeHorizontal
    ) {
      // Animation de retour douce
      setTranslateX(0);
      isDraggingRef.current = false;
      return;
    }

    const threshold = 60; // Seuil pour changer d'onglet

    if (Math.abs(translateX) > threshold) {
      if (translateX > 0 && currentTabIndex > 0) {
        setTranslateX(window.innerWidth);
        setTimeout(() => goToTab(currentTabIndex - 1), 200);
      } else if (translateX < 0 && currentTabIndex < tabs.length - 1) {
        setTranslateX(-window.innerWidth);
        setTimeout(() => goToTab(currentTabIndex + 1), 200);
      } else {
        setTranslateX(0);
      }
    } else {
      setTranslateX(0);
    }

    isDraggingRef.current = false;
    containerRef.current.hasMoved = false;
    containerRef.current.isSwipeHorizontal = null;
  };

  const handleMouseDown = (e) => {
    return;
  };

  const goToTab = (tabIndex) => {
    if (tabIndex >= 0 && tabIndex < tabs.length && !isTransitioning) {
      setIsTransitioning(true);
      const direction = tabIndex > currentTabIndex ? -1 : 1;
      const transitionDistance = direction * 100;

      setTranslateX(transitionDistance);
      setTimeout(() => {
        setActiveTab(tabs[tabIndex].id);
        setTranslateX(-transitionDistance);
        setTimeout(() => {
          setTranslateX(0);
          setTimeout(() => setIsTransitioning(false), 300);
        }, 50);
      }, 150);
    }
  };
// 🔹 Partie 5 (chargement paiements, formulaires, etc.)

  const fetchPayments = async (memberId) => {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("member_id", memberId)
      .order("date_paiement", { ascending: false });

    if (error) {
      console.error("Erreur chargement paiements :", error.message);
      return;
    }

    setPayments(data);
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
// 🔹 Partie 6

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const age = form.birthdate
    ? Math.floor(
        (new Date() - new Date(form.birthdate)) / (365.25 * 24 * 3600 * 1000)
      )
    : null;

  const isExpired = form.endDate && new Date(form.endDate) < new Date();

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, files: JSON.stringify(form.files) }, true);
  };
// 🔹 Partie 7 (upload de fichiers)

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;

    setUploadStatus({ loading: true, error: null, success: null });

    try {
      for (const file of files) {
        const safeName = sanitizeFileName(file.name);
        const filePath = `certificats/${Date.now()}_${safeName}`;
        const { error } = await supabase.storage
          .from("documents")
          .upload(filePath, file);
        if (error) {
          throw new Error(`Erreur lors du téléversement : ${error.message}`);
        }
        const { data } = supabase.storage
          .from("documents")
          .getPublicUrl(filePath);
        setForm((f) => ({
          ...f,
          files: [...f.files, { name: safeName, url: data.publicUrl }],
        }));
      }
      setUploadStatus({
        loading: false,
        error: null,
        success: "Fichiers ajoutés avec succès !",
      });
      setTimeout(
        () => setUploadStatus({ loading: false, error: null, success: null }),
        3000
      );
    } catch (err) {
      console.error("Erreur lors du téléversement :", err);
      setUploadStatus({ loading: false, error: err.message, success: null });
    }
  };
// 🔹 Partie 8 — Gestion capture photo et document via webcam

  const capturePhoto = () => {
    try {
      if (!webcamRef.current || !webcamReady) {
        throw new Error("Webcam non disponible ou non prête");
      }

      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        throw new Error("Aucune image capturée.");
      }

      setForm((f) => ({ ...f, photo: imageSrc }));
      setUploadStatus({
        loading: false,
        error: null,
        success: "Photo capturée avec succès !",
      });
      setWebcamOpen(false);
      setTimeout(
        () => setUploadStatus({ loading: false, error: null, success: null }),
        3000
      );
    } catch (err) {
      console.error("Erreur lors de la capture :", err);
      setUploadStatus({ loading: false, error: err.message, success: null });
    }
  };

  const captureDocument = async () => {
    if (!webcamRef.current || !webcamReady) {
      setUploadStatus({
        loading: false,
        error: "Webcam non disponible ou non prête",
        success: null,
      });
      return;
    }

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setUploadStatus({
        loading: false,
        error: "Impossible de capturer le document",
        success: null,
      });
      return;
    }

    setUploadStatus({ loading: true, error: null, success: null });

    try {
      const blob = await (await fetch(imageSrc)).blob();
      const fileName = sanitizeFileName(`doc_${Date.now()}.jpg`);
      const filePath = `certificats/${fileName}`;
      const { error } = await supabase.storage
        .from("documents")
        .upload(filePath, blob);
      if (error) {
        throw new Error(
          `Erreur lors du téléversement du document : ${error.message}`
        );
      }

      const { data } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);
      setForm((f) => ({
        ...f,
        files: [...f.files, { name: fileName, url: data.publicUrl }],
      }));
      setUploadStatus({
        loading: false,
        error: null,
        success: "Document capturé avec succès !",
      });
      setWebcamOpen(false);

      await onSave(
        {
          ...form,
          files: JSON.stringify([
            ...form.files,
            { name: fileName, url: data.publicUrl },
          ]),
        },
        false
      );
      setTimeout(
        () => setUploadStatus({ loading: false, error: null, success: null }),
        3000
      );
    } catch (err) {
      console.error("Erreur lors de la capture du document :", err);
      setUploadStatus({
        loading: false,
        error: `Erreur lors de la capture du document : ${err.message}`,
        success: null,
      });
    }
  };
// 🔹 Partie 9 — Suppression des fichiers uploadés

  const removeFile = async (fileToRemove, event) => {
    event?.stopPropagation();
    event?.preventDefault();

    try {
      const url = fileToRemove.url;
      const fullPrefix = "/storage/v1/object/public/";
      const bucketIndex = url.indexOf(fullPrefix);
      if (bucketIndex === -1) throw new Error("URL invalide");

      const afterPrefix = url.substring(bucketIndex + fullPrefix.length);
      const [bucket, ...pathParts] = afterPrefix.split("/");
      const path = pathParts.join("/");

      const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove([path]);
      if (storageError)
        throw new Error(`Erreur de suppression : ${storageError.message}`);

      const newFiles = form.files.filter((f) => f.url !== fileToRemove.url);
      setForm((f) => ({ ...f, files: newFiles }));

      await onSave({ ...form, files: JSON.stringify(newFiles) }, false);
      setUploadStatus({
        loading: false,
        error: null,
        success: "Fichier supprimé avec succès !",
      });
      setTimeout(
        () => setUploadStatus({ loading: false, error: null, success: null }),
        3000
      );
    } catch (err) {
      console.error("Erreur suppression fichier :", err);
      setUploadStatus({ loading: false, error: err.message, success: null });
    }
  };
// 🔹 Partie 10 — Fonctions `renderIdentityTab`, `renderContactTab`, `renderSubscriptionTab`

  const renderIdentityTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 p-6 rounded-xl border border-blue-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <FaGraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-white">
                    Statut étudiant
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Bénéficiez de tarifs préférentiels
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, etudiant: !f.etudiant }))
                }
                className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  form.etudiant
                    ? "bg-gradient-to-r from-blue-500 to-purple-600"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-300 ${
                    form.etudiant ? "translate-x-7" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {age !== null && (
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <FaCalendarAlt className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <span className="text-gray-700 dark:text-gray-200 font-medium">
                  Âge : {age} ans
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            {form.photo ? (
              <img
                src={form.photo}
                alt="Photo du membre"
                className="w-40 h-40 object-cover rounded-2xl border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-40 h-40 flex items-center justify-center border-4 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl text-gray-400 bg-gray-50 dark:bg-gray-800">
                <div className="text-center">
                  <FaUser className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">Pas de photo</p>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setWebcamReady(false);
              setWebcamOpen("photo");
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <FaCamera className="w-4 h-4" />
            Prendre une photo
          </button>
        </div>
      </div>
    </div>
  );

  const renderContactTab = () => (
    <div className="space-y-6">
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
  );

  const renderSubscriptionTab = () => (
    <div className="space-y-6">
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
        <div className="bg-red-50 dark:bg-red-900 border-l-4 border-red-400 dark:border-red-700 p-4 rounded-r-xl">
          <div className="flex items-center">
            <FaTimes className="w-5 h-5 text-red-400 dark:text-red-300 mr-2" />
            <p className="text-red-800 dark:text-red-200 font-medium">
              Abonnement expiré le {new Date(form.endDate).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
// 🔹 Partie 11 — Fonctions `renderDocumentsTab()` et `renderPaymentsTab()`

  const renderDocumentsTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
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
          onClick={() => {
            setWebcamReady(false);
            setWebcamOpen("doc");
          }}
          className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <FaCamera className="w-4 h-4" />
          Photographier un document
        </button>
      </div>

      {form.files.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {form.files.map((file) => (
            <div
              key={file.name}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:shadow-md transition-shadow"
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
                      onClick={(e) => removeFile(file, e)}
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
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <FaFileAlt className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-300 text-lg font-medium">Aucun document</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            Importez des certificats, documents d'identité, etc.
          </p>
        </div>
      )}
    </div>
  );

  const renderPaymentsTab = () => (
    <div className="space-y-6">
      {/* ... contenu de renderPaymentsTab() (ajout + liste) ... */}
// 🔹 Partie 12 — Suite et fin de `renderPaymentsTab()`

      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 p-6 rounded-xl border border-green-200 dark:border-green-600">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-white mb-4">
          <FaEuroSign className="w-5 h-5 text-green-600 dark:text-green-300" />
          Nouveau paiement
        </h3>

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
                  setNewPayment((p) => ({ ...p, is_paid: e.target.checked }))
                }
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  newPayment.is_paid
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
// 🔹 Partie 13 — Affichage de l’historique des paiements (`renderPaymentsTab()`)

      {/* Liste des paiements */}
      {payments.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Historique des paiements
          </h3>
          {payments.map((pay) => (
            <div
              key={pay.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex-1 w-full sm:w-auto">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`p-2 rounded-lg ${
                        pay.is_paid ? "bg-green-100 dark:bg-green-900" : "bg-orange-100 dark:bg-orange-900"
                      }`}
                    >
                      <FaEuroSign
                        className={`w-4 h-4 ${
                          pay.is_paid ? "text-green-600 dark:text-green-300" : "text-orange-600 dark:text-orange-300"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-lg text-gray-800 dark:text-white">
                        {pay.amount.toFixed(2)} €
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {pay.method}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={pay.is_paid}
                      onChange={() => togglePaymentStatus(pay.id, !pay.is_paid)}
                      className="sr-only"
                    />
                    <button
                      onClick={() => togglePaymentStatus(pay.id, !pay.is_paid)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        pay.is_paid
                          ? "bg-green-500 border-green-500"
                          : "border-gray-300 dark:border-gray-500 hover:border-green-400"
                      }`}
                    >
                      {pay.is_paid && (
                        <FaCheck className="w-3 h-3 text-white" />
                      )}
                    </button>
                    <span
                      className={`text-sm font-medium ${
                        pay.is_paid ? "text-green-600 dark:text-green-300" : "text-orange-600 dark:text-orange-300"
                      }`}
                    >
                      {pay.is_paid ? "Encaissé" : "En attente"}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p>
                      Payé le {new Date(pay.date_paiement).toLocaleDateString()}
                    </p>
                    {pay.encaissement_prevu && (
                      <p className="text-blue-600 dark:text-blue-300">
                        Encaissement prévu :{" "}
                        {new Date(pay.encaissement_prevu).toLocaleDateString()}
                      </p>
                    )}
                    {pay.commentaire && (
                      <p className="italic text-gray-500 dark:text-gray-400">{pay.commentaire}</p>
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

          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Total des paiements :
              </span>
              <span className="text-2xl font-bold text-green-600 dark:text-green-300">
                {payments
                  .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
                  .toFixed(2)}{" "}
                €
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <FaEuroSign className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-300 text-lg font-medium">
            Aucun paiement enregistré
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            Ajoutez le premier paiement ci-dessus
          </p>
        </div>
      )}
    </div>
  );
// 🔹 Partie 14 — `renderCurrentTab()` et début du `return()` principal

  const renderCurrentTab = () => {
    switch (activeTab) {
      case "identity":
        return renderIdentityTab();
      case "contact":
        return renderContactTab();
      case "subscription":
        return renderSubscriptionTab();
      case "documents":
        return renderDocumentsTab();
      case "payments":
        return renderPaymentsTab();
      default:
        return renderIdentityTab();
    }
  };

  return (
    <Modal
      isOpen={true}
      onRequestClose={onCancel}
      shouldCloseOnOverlayClick={false}
      shouldCloseOnEsc={false}
      contentLabel="Fiche Membre"
      className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl mx-auto mt-2 sm:mt-4 outline-none relative flex flex-col max-h-[98vh] sm:max-h-[95vh]"
      overlayClassName="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-start z-50 p-2 sm:p-4"
    >
      {/* Header avec photo et infos principales */}
      <div className="bg-gradient-to-r from-blue-400 to-purple-500 dark:from-blue-800 dark:to-purple-800 text-white p-4 md:p-6 rounded-t-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center flex-shrink-0">
              {form.photo ? (
                <img
                  src={form.photo}
                  alt="Avatar"
                  className="w-10 h-10 sm:w-14 sm:h-14 rounded-full object-cover"
                />
              ) : (
                <FaUser className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold truncate">
                {form.firstName || form.name
                  ? `${form.firstName} ${form.name}`
                  : "Nouveau membre"}
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1">
                {form.badgeId && (
                  <span className="flex items-center gap-1 text-xs sm:text-sm bg-white bg-opacity-20 px-2 py-1 rounded-full self-start">
                    <FaIdCard className="w-3 h-3" />
                    Badge: {form.badgeId}
                  </span>
                )}
                <StatusBadge isExpired={isExpired} isStudent={form.etudiant} />
              </div>
            </div>
          </div>
// 🔹 Partie 15 — Navigation onglets, progression, notifications (suite du `return()`)

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white bg-opacity-20 text-white rounded-xl hover:bg-opacity-30 transition-all duration-200 flex-1 sm:flex-none text-sm"
            >
              <FaTimes className="w-4 h-4" />
              <span className="hidden sm:inline">Annuler</span>
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-white text-blue-600 rounded-xl hover:bg-gray-100 transition-all duration-200 font-semibold shadow-lg flex-1 sm:flex-none text-sm"
            >
              <FaCheck className="w-4 h-4" />
              Enregistrer
            </button>
          </div>
        </div>

        {/* Navigation par onglets avec scroll horizontal */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 sm:gap-2 min-w-max pb-2 sm:pb-0">
            {tabs.map((tab, index) => (
              <TabButton
                key={tab.id}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                icon={tab.icon}
                count={tab.count}
              >
                {tab.label}
              </TabButton>
            ))}
          </div>
        </div>

        {/* Indicateurs de progression et navigation (mobile) */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => goToTab(currentTabIndex - 1)}
            disabled={currentTabIndex === 0}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentTabIndex === 0
                ? "text-white text-opacity-40 cursor-not-allowed"
                : "text-white text-opacity-80 hover:text-white hover:bg-white hover:bg-opacity-20"
            }`}
          >
            <FaChevronLeft className="w-3 h-3" />
            <span className="hidden sm:inline">Précédent</span>
          </button>

          <div className="flex justify-center gap-2">
            {tabs.map((_, index) => (
              <button
                key={index}
                onClick={() => goToTab(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  currentTabIndex === index
                    ? "bg-white"
                    : "bg-white bg-opacity-40"
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => goToTab(currentTabIndex + 1)}
            disabled={currentTabIndex === tabs.length - 1}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentTabIndex === tabs.length - 1
                ? "text-white text-opacity-40 cursor-not-allowed"
                : "text-white text-opacity-80 hover:text-white hover:bg-white hover:bg-opacity-20"
            }`}
          >
            <span className="hidden sm:inline">Suivant</span>
            <FaChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="text-center mt-3 text-xs text-white text-opacity-70">
          💡 Glissez horizontalement ou utilisez les flèches pour naviguer
        </div>
      </div>

      {/* Notifications de statut */}
      {uploadStatus.loading && (
        <div className="bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-400 dark:border-blue-700 p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
            <p className="text-blue-700 dark:text-blue-300">Téléversement en cours...</p>
          </div>
        </div>
      )}

      {uploadStatus.error && (
        <div className="bg-red-50 dark:bg-red-900 border-l-4 border-red-400 dark:border-red-700 p-4">
          <div className="flex items-center">
            <FaTimes className="w-4 h-4 text-red-400 dark:text-red-300 mr-3" />
            <p className="text-red-700 dark:text-red-200">{uploadStatus.error}</p>
          </div>
        </div>
      )}

      {uploadStatus.success && (
        <div className="bg-green-50 dark:bg-green-900 border-l-4 border-green-400 dark:border-green-700 p-4">
          <div className="flex items-center">
            <FaCheck className="w-4 h-4 text-green-400 dark:text-green-200 mr-3" />
            <p className="text-green-700 dark:text-green-100">{uploadStatus.success}</p>
          </div>
        </div>
      )}
// 🔹 Partie 16 — Contenu des onglets avec formulaire et swipe (fin du `return()` principal)

      {/* Contenu des onglets avec gestion du swipe */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `translateX(${translateX}px)`,
            transition: isDraggingRef.current
              ? "none"
              : "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <div className="p-4 md:p-6 min-h-full">
            <form onSubmit={handleSubmit}>{renderCurrentTab()}</form>
          </div>
        </div>
      </div>
// 🔹 Partie 17 — Modal Webcam + export final

      {/* Modal Webcam */}
      {webcamOpen && (
        <Modal
          isOpen={true}
          onRequestClose={() => setWebcamOpen(false)}
          shouldCloseOnOverlayClick={false}
          shouldCloseOnEsc={false}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-2xl mx-auto mt-20 outline-none"
          overlayClassName="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-start z-[60] p-4"
        >
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              {webcamOpen === "photo"
                ? "Prendre une photo"
                : "Capturer un document"}
            </h2>

            <div className="relative inline-block mb-6">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  width: { ideal: 640 },
                  height: { ideal: 480 },
                  facingMode: "user",
                }}
                className="rounded-xl border-4 border-gray-200 dark:border-gray-600 shadow-lg"
                onUserMedia={() => {
                  console.log("Webcam activée avec succès");
                  setWebcamReady(true);
                }}
                onUserMediaError={(error) => {
                  console.error("Erreur d'accès à la webcam :", error);
                  setUploadStatus({
                    loading: false,
                    error: `Erreur d'accès à la webcam : ${error}`,
                    success: null,
                  });
                  setWebcamReady(false);
                }}
              />
              {!webcamReady && (
                <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
                </div>
              )}
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={webcamOpen === "doc" ? captureDocument : capturePhoto}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!webcamReady}
              >
                <FaCamera className="w-4 h-4" />
                Capturer
              </button>
              <button
                onClick={() => setWebcamOpen(false)}
                className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
              >
                <FaTimes className="w-4 h-4" />
                Annuler
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

export default MemberForm;

// ✅ FIN DU FICHIER
