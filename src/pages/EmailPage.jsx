// src/pages/EmailPage.jsx
// Page d'envoi d'emails aux membres du club

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import {
  FaEnvelope,
  FaPaperPlane,
  FaUsers,
  FaUserCheck,
  FaExclamationTriangle,
  FaSearch,
  FaTimes,
  FaCheckCircle,
  FaTimesCircle,
  FaSpinner,
  FaInfoCircle,
} from "react-icons/fa";
import { supabaseServices } from "../supabaseClient";
import { sendEmail, getEmailStatus } from "../services/emailService";

function EmailPage() {
  // État des membres
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // État de la sélection
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all"); // all, active, expiring, expired

  // État de l'email
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  // État du service email
  const [emailConfigured, setEmailConfigured] = useState(null);
  const [emailAddress, setEmailAddress] = useState(null);

  // Résultats d'envoi
  const [sendResult, setSendResult] = useState(null);

  // Chargement initial
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Charger les membres et le statut email en parallèle
      const [membersData, emailStatus] = await Promise.all([
        supabaseServices.getMembersWithoutPhotos(),
        getEmailStatus().catch(() => ({ configured: false })),
      ]);

      setMembers(membersData);
      setEmailConfigured(emailStatus.configured);
      setEmailAddress(emailStatus.email);
    } catch (error) {
      console.error("Erreur chargement:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  // Filtrage des membres
  const filteredMembers = useMemo(() => {
    const today = new Date();
    const in30Days = new Date();
    in30Days.setDate(today.getDate() + 30);

    let filtered = members.filter((m) => m.email); // Seulement ceux avec email

    // Filtre par type
    switch (filterType) {
      case "active":
        filtered = filtered.filter(
          (m) => m.endDate && new Date(m.endDate) >= today
        );
        break;
      case "expiring":
        filtered = filtered.filter((m) => {
          if (!m.endDate) return false;
          const endDate = new Date(m.endDate);
          return endDate >= today && endDate <= in30Days;
        });
        break;
      case "expired":
        filtered = filtered.filter(
          (m) => !m.endDate || new Date(m.endDate) < today
        );
        break;
      default:
        break;
    }

    // Filtre par recherche
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.name?.toLowerCase().includes(search) ||
          m.firstName?.toLowerCase().includes(search) ||
          m.email?.toLowerCase().includes(search)
      );
    }

    return filtered.sort((a, b) =>
      `${a.name} ${a.firstName}`.localeCompare(`${b.name} ${b.firstName}`)
    );
  }, [members, filterType, searchTerm]);

  // Sélection des membres
  const toggleMember = (memberId) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const selectAll = () => {
    setSelectedMembers(filteredMembers.map((m) => m.id));
  };

  const deselectAll = () => {
    setSelectedMembers([]);
  };

  const toggleSelectAll = () => {
    const allFilteredIds = filteredMembers.map((m) => m.id);
    const allSelected = allFilteredIds.every((id) =>
      selectedMembers.includes(id)
    );
    if (allSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  };

  // Envoi de l'email
  const handleSend = async () => {
    if (selectedMembers.length === 0) {
      toast.warning("Veuillez sélectionner au moins un destinataire");
      return;
    }
    if (!subject.trim()) {
      toast.warning("Veuillez saisir un sujet");
      return;
    }
    if (!body.trim()) {
      toast.warning("Veuillez saisir le contenu de l'email");
      return;
    }

    const recipients = members
      .filter((m) => selectedMembers.includes(m.id))
      .map((m) => ({
        email: m.email,
        firstName: m.firstName,
        name: m.name,
      }));

    setSending(true);
    setSendResult(null);

    try {
      const result = await sendEmail({
        recipients,
        subject: subject.trim(),
        body: body.trim(),
      });

      setSendResult(result);

      if (result.success) {
        toast.success(`${result.results.sent.length} email(s) envoyé(s)`);
        // Réinitialiser le formulaire
        setSubject("");
        setBody("");
        setSelectedMembers([]);
      } else {
        toast.warning(result.message);
      }
    } catch (error) {
      console.error("Erreur envoi:", error);
      toast.error(error.message || "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  // Statistiques
  const stats = useMemo(() => {
    const today = new Date();
    const withEmail = members.filter((m) => m.email);
    const active = withEmail.filter(
      (m) => m.endDate && new Date(m.endDate) >= today
    );
    const expired = withEmail.filter(
      (m) => !m.endDate || new Date(m.endDate) < today
    );

    return {
      total: withEmail.length,
      active: active.length,
      expired: expired.length,
      noEmail: members.length - withEmail.length,
    };
  }, [members]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FaSpinner className="animate-spin text-4xl text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <FaEnvelope className="text-2xl text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Envoi d'emails
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Communiquez avec les membres du club
            </p>
          </div>
        </div>

        {/* Statut du service email */}
        {emailConfigured === false && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
            <FaExclamationTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">
                Service email non configuré
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Les variables GMAIL_USER et GMAIL_APP_PASSWORD doivent être
                définies sur le serveur.
              </p>
            </div>
          </div>
        )}

        {emailConfigured && emailAddress && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
            <FaCheckCircle className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-300">
                Service email configuré
              </p>
              <p className="text-sm text-green-700 dark:text-green-400">
                Les emails seront envoyés depuis : {emailAddress}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panneau de sélection des membres */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FaUsers className="text-blue-600" />
            Sélection des destinataires
          </h2>

          {/* Stats rapides */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {stats.total}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Avec email
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                {stats.active}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Actifs</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-red-600 dark:text-red-400">
                {stats.expired}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Expirés
              </p>
            </div>
          </div>

          {/* Filtres */}
          <div className="space-y-3 mb-4">
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "Tous", count: stats.total },
                { value: "active", label: "Actifs", count: stats.active },
                { value: "expiring", label: "Expire bientôt", count: null },
                { value: "expired", label: "Expirés", count: stats.expired },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setFilterType(filter.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterType === filter.value
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {filter.label}
                  {filter.count !== null && (
                    <span className="ml-1 opacity-75">({filter.count})</span>
                  )}
                </button>
              ))}
            </div>

            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher un membre..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <FaTimes />
                </button>
              )}
            </div>
          </div>

          {/* Actions de sélection */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedMembers.length} sélectionné(s) sur {filteredMembers.length}
            </span>
            <button
              onClick={toggleSelectAll}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {filteredMembers.every((m) => selectedMembers.includes(m.id))
                ? "Tout désélectionner"
                : "Tout sélectionner"}
            </button>
          </div>

          {/* Liste des membres */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-80 overflow-y-auto">
            {filteredMembers.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                Aucun membre trouvé
              </div>
            ) : (
              filteredMembers.map((member) => (
                <label
                  key={member.id}
                  className={`flex items-center gap-3 p-3 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    selectedMembers.includes(member.id)
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(member.id)}
                    onChange={() => toggleMember(member.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {member.firstName} {member.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {member.email}
                    </p>
                  </div>
                  {member.endDate && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        new Date(member.endDate) >= new Date()
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                      }`}
                    >
                      {new Date(member.endDate) >= new Date()
                        ? "Actif"
                        : "Expiré"}
                    </span>
                  )}
                </label>
              ))
            )}
          </div>
        </div>

        {/* Panneau de composition */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FaPaperPlane className="text-blue-600" />
            Composer l'email
          </h2>

          <div className="space-y-4">
            {/* Sujet */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sujet
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Objet de votre email..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Corps */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Message
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Votre message..."
                rows={10}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <FaInfoCircle className="inline mr-1" />
                L'email commencera automatiquement par "Bonjour [Prénom],"
              </p>
            </div>

            {/* Aperçu des destinataires */}
            {selectedMembers.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Destinataires ({selectedMembers.length})
                </p>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {members
                    .filter((m) => selectedMembers.includes(m.id))
                    .slice(0, 10)
                    .map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs"
                      >
                        {m.firstName} {m.name}
                        <button
                          onClick={() => toggleMember(m.id)}
                          className="hover:text-red-600"
                        >
                          <FaTimes className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  {selectedMembers.length > 10 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                      +{selectedMembers.length - 10} autres
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Bouton d'envoi */}
            <button
              onClick={handleSend}
              disabled={
                sending ||
                !emailConfigured ||
                selectedMembers.length === 0 ||
                !subject.trim() ||
                !body.trim()
              }
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {sending ? (
                <>
                  <FaSpinner className="animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <FaPaperPlane />
                  Envoyer à {selectedMembers.length} membre(s)
                </>
              )}
            </button>
          </div>

          {/* Résultats d'envoi */}
          {sendResult && (
            <div className="mt-4 p-4 rounded-lg border">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                {sendResult.success ? (
                  <>
                    <FaCheckCircle className="text-green-600" />
                    <span className="text-green-700 dark:text-green-400">
                      Envoi réussi
                    </span>
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle className="text-amber-600" />
                    <span className="text-amber-700 dark:text-amber-400">
                      Envoi partiel
                    </span>
                  </>
                )}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {sendResult.message}
              </p>

              {sendResult.results?.failed?.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">
                    Échecs :
                  </p>
                  <ul className="text-sm text-gray-600 dark:text-gray-400">
                    {sendResult.results.failed.map((f, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <FaTimesCircle className="text-red-500 flex-shrink-0" />
                        {f.email}: {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmailPage;
