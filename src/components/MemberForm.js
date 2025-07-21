import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import Modal from "react-modal";
import { FaCamera, FaFileUpload, FaTrash, FaDownload } from "react-icons/fa";
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

function InputField({ label, ...props }) {
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <input {...props} className="w-full border p-2 rounded" />
    </div>
  );
}

function SelectField({ label, options, ...props }) {
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <select {...props} className="w-full border p-2 rounded">
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

  const [payments, setPayments] = useState([]);
  const [newPayment, setNewPayment] = useState({
    amount: "",
    method: "espèces",
    encaissement_prevu: "",
    commentaire: "",
  });

  useEffect(() => {
    if (member?.id) {
      fetchPayments(member.id);
    }
  }, [member]);

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

  <div className="bg-blue-50 p-4 rounded">
  <h2 className="text-xl font-semibold mb-4">Paiements</h2>

  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
    <InputField
      label="Montant (€)"
      type="number"
      name="amount"
      value={newPayment.amount}
      onChange={(e) => setNewPayment((p) => ({ ...p, amount: e.target.value }))}
    />
    <SelectField
      label="Méthode"
      name="method"
      value={newPayment.method}
      onChange={(e) => setNewPayment((p) => ({ ...p, method: e.target.value }))}
      options={["espèces", "chèque", "carte", "autre"]}
    />
    <InputField
      label="Encaissement prévu"
      type="date"
      name="encaissement_prevu"
      value={newPayment.encaissement_prevu}
      onChange={(e) => setNewPayment((p) => ({ ...p, encaissement_prevu: e.target.value }))}
    />
    <button
      type="button"
      onClick={handleAddPayment}
      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
    >
      ➕ Ajouter Paiement
    </button>
  </div>

  <InputField
    label="Commentaire"
    name="commentaire"
    value={newPayment.commentaire}
    onChange={(e) => setNewPayment((p) => ({ ...p, commentaire: e.target.value }))}
  />

  <ul className="mt-4 divide-y">
    {payments.length === 0 && <li className="text-gray-500 italic">Aucun paiement enregistré.</li>}
    {payments.map((pay) => (
      <li key={pay.id} className="flex justify-between items-center py-2">
        <div className="flex flex-col text-sm">
          <span className="font-semibold">{pay.amount.toFixed(2)} € - {pay.method}</span>
          <span className="text-gray-600">Payé le {new Date(pay.date_paiement).toLocaleDateString()}</span>
          {pay.encaissement_prevu && (
            <span className="text-blue-600">Encaissement prévu : {new Date(pay.encaissement_prevu).toLocaleDateString()}</span>
          )}
          {pay.commentaire && <span className="text-gray-500 italic">{pay.commentaire}</span>}
        </div>
        <button
          onClick={() => handleDeletePayment(pay.id)}
          className="text-red-600 hover:text-red-800 flex items-center gap-1 text-sm"
        >
          <FaTrash /> Supprimer
        </button>
      </li>
    ))}
  </ul>
</div>
