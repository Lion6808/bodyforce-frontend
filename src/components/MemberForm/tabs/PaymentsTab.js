// 📄 PaymentsTab.js — Onglet "Paiements" du formulaire

import React from "react";
import { FaEuroSign, FaCreditCard, FaCalendarAlt, FaCheck, FaTrash } from "react-icons/fa";
import { InputField, SelectField, Checkbox } from "../UIComponents";

export function PaymentsTab({
  payments,
  newPayment,
  setNewPayment,
  handleAddPayment,
  handleDeletePayment,
  togglePaymentStatus,
}) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 p-6 rounded-xl border border-green-200 dark:border-green-600">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-white mb-4">
          <FaEuroSign className="w-5 h-5 text-green-600 dark:text-green-300" />
          Nouveau paiement
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <InputField label="Montant (€)" type="number" name="amount" value={newPayment.amount} onChange={(e) => setNewPayment((p) => ({ ...p, amount: e.target.value }))} icon={FaEuroSign} placeholder="0.00" step="0.01" />
          <SelectField label="Méthode de paiement" name="method" value={newPayment.method} onChange={(e) => setNewPayment((p) => ({ ...p, method: e.target.value }))} options={["espèces", "chèque", "carte", "virement", "autre"]} icon={FaCreditCard} />
          <InputField label="Encaissement prévu" type="date" name="encaissement_prevu" value={newPayment.encaissement_prevu} onChange={(e) => setNewPayment((p) => ({ ...p, encaissement_prevu: e.target.value }))} icon={FaCalendarAlt} />
        </div>
        <div className="mb-4">
          <InputField label="Commentaire" name="commentaire" value={newPayment.commentaire} onChange={(e) => setNewPayment((p) => ({ ...p, commentaire: e.target.value }))} placeholder="Note ou commentaire sur ce paiement" />
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-0 sm:justify-between">
          <Checkbox checked={newPayment.is_paid} onChange={(e) => setNewPayment((p) => ({ ...p, is_paid: e.target.checked }))} label="Paiement déjà encaissé" />
          <button type="button" onClick={handleAddPayment} disabled={!newPayment.amount} className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none w-full sm:w-auto">
            <FaEuroSign className="w-4 h-4" />
            Ajouter le paiement
          </button>
        </div>
      </div>

      {payments.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Historique des paiements</h3>
          {payments.map((pay) => (
            <div key={pay.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex-1 w-full sm:w-auto">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${pay.is_paid ? "bg-green-100 dark:bg-green-900" : "bg-orange-100 dark:bg-orange-900"}`}>
                      <FaEuroSign className={`w-4 h-4 ${pay.is_paid ? "text-green-600 dark:text-green-300" : "text-orange-600 dark:text-orange-300"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-lg text-gray-800 dark:text-white">{pay.amount.toFixed(2)} €</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{pay.method}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <Checkbox checked={pay.is_paid} onChange={() => togglePaymentStatus(pay.id, !pay.is_paid)} label={pay.is_paid ? "Encaissé" : "En attente"} />
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p>Payé le {new Date(pay.date_paiement).toLocaleDateString()}</p>
                    {pay.encaissement_prevu && <p className="text-blue-600 dark:text-blue-300">Encaissement prévu : {new Date(pay.encaissement_prevu).toLocaleDateString()}</p>}
                    {pay.commentaire && <p className="italic text-gray-500 dark:text-gray-400">{pay.commentaire}</p>}
                  </div>
                </div>
                <button onClick={() => handleDeletePayment(pay.id)} className="flex items-center justify-center gap-2 px-3 py-2 text-red-600 dark:text-red-300 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors w-full sm:w-auto">
                  <FaTrash className="w-3 h-3" />
                  <span className="sm:hidden">Supprimer</span>
                </button>
              </div>
            </div>
          ))}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700 dark:text-gray-300">Total des paiements :</span>
              <span className="text-2xl font-bold text-green-600 dark:text-green-300">
                {payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0).toFixed(2)} €
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <FaEuroSign className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-300 text-lg font-medium">Aucun paiement enregistré</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">Ajoutez le premier paiement ci-dessus</p>
        </div>
      )}
    </div>
  );
}
