// 📄 useMemberForm.js — Hook personnalisé pour la logique du formulaire
// Ce fichier contient toute la logique (états, fonctions) du formulaire.

import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";

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

export function useMemberForm(member, onSave) {
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

  const [uploadStatus, setUploadStatus] = useState({
    loading: false,
    error: null,
    success: null,
  });

  // Initialisation du formulaire avec les données du membre
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

  // Calcul automatique de la date de fin d'abonnement
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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

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
    setNewPayment({ amount: "", method: "espèces", encaissement_prevu: "", commentaire: "", is_paid: false });
    fetchPayments(member.id);
  };

  const handleDeletePayment = async (id) => {
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) console.error("Erreur suppression paiement :", error.message);
    else fetchPayments(member.id);
  };

  const togglePaymentStatus = async (paymentId, newStatus) => {
    const { error } = await supabase.from("payments").update({ is_paid: newStatus }).eq("id", paymentId);
    if (error) console.error("Erreur mise à jour du statut de paiement :", error.message);
    else fetchPayments(member.id);
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
        const { error } = await supabase.storage.from("documents").upload(filePath, file);
        if (error) throw new Error(`Erreur lors du téléversement : ${error.message}`);
        const { data } = supabase.storage.from("documents").getPublicUrl(filePath);
        newFiles.push({ name: safeName, url: data.publicUrl });
      }
      const updatedFiles = [...form.files, ...newFiles];
      setForm((f) => ({ ...f, files: updatedFiles }));
      setUploadStatus({ loading: false, success: `${newFiles.length} fichier(s) ajouté(s) !` });
    } catch (err) {
      setUploadStatus({ loading: false, error: err.message });
    }
    e.target.value = "";
  };
  
  const handleCameraCapture = (imageData) => {
    setForm((f) => ({ ...f, photo: imageData }));
    setUploadStatus({ success: "Photo capturée avec succès !" });
  };

  const captureDocument = async (imageData) => {
    setUploadStatus({ loading: true, error: null, success: null });
    try {
      const response = await fetch(imageData);
      const blob = await response.blob();
      const fileName = sanitizeFileName(`doc_${Date.now()}.jpg`);
      const filePath = `certificats/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, blob);
      if (uploadError) throw new Error(`Erreur lors du téléversement : ${uploadError.message}`);
      const { data } = supabase.storage.from("documents").getPublicUrl(filePath);
      const newFile = { name: fileName, url: data.publicUrl };
      setForm((f) => ({ ...f, files: [...f.files, newFile] }));
      setUploadStatus({ success: "Document capturé avec succès !" });
    } catch (err) {
      setUploadStatus({ loading: false, error: err.message });
    }
  };

  const removeFile = async (fileToRemove) => {
    try {
      const url = fileToRemove.url;
      const fullPrefix = "/storage/v1/object/public/";
      const bucketIndex = url.indexOf(fullPrefix);
      if (bucketIndex === -1) throw new Error("URL invalide");
      const afterPrefix = url.substring(bucketIndex + fullPrefix.length);
      const [bucket, ...pathParts] = afterPrefix.split("/");
      const path = pathParts.join("/");
      const { error: storageError } = await supabase.storage.from(bucket).remove([path]);
      if (storageError) throw new Error(`Erreur de suppression : ${storageError.message}`);
      setForm((f) => ({ ...f, files: f.files.filter((file) => file.url !== fileToRemove.url) }));
      setUploadStatus({ success: "Fichier supprimé !" });
    } catch (err) {
      setUploadStatus({ error: err.message });
    }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, files: JSON.stringify(form.files) }, true);
  };

  const age = form.birthdate ? Math.floor((new Date() - new Date(form.birthdate)) / (365.25 * 24 * 3600 * 1000)) : null;
  const isExpired = form.endDate && new Date(form.endDate) < new Date();

  return {
    form,
    setForm,
    payments,
    newPayment,
    setNewPayment,
    uploadStatus,
    handleChange,
    handleAddPayment,
    handleDeletePayment,
    togglePaymentStatus,
    handleFileUpload,
    handleCameraCapture,
    captureDocument,
    removeFile,
    handleSubmit,
    age,
    isExpired,
  };
}
