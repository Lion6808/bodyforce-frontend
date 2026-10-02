// Onglet « Abonnement » de la fiche membre — extrait de MemberFormPage

import {
  FaTrash,
  FaCreditCard,
  FaEuroSign,
  FaCalendarAlt,
  FaIdCard,
  FaCheck,
  FaTimes,
} from "react-icons/fa";
import { InputField, SelectField } from "../../ui/FormFields";
import { subscriptionDurations } from "../../../utils/subscription";

/** Render the Subscription tab: subscription config, badge, payments. */
export function SubscriptionTab({ member, form, handleChange, handleBadgeNumberChange, isExpired, payments, newPayment, setNewPayment, handleAddPayment, handleDeletePayment, togglePaymentStatus, formatPrice }) {
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

      {/* Subscription type, badge, and dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SelectField
          label="Type d'abonnement"
          name="subscriptionType"
          value={form.subscriptionType}
          onChange={handleChange}
          options={Object.keys(subscriptionDurations)}
          icon={FaCreditCard}
        />
        <div>
          <InputField
            label="Numéro de badge"
            name="badge_number"
            type="number"
            value={form.badge_number}
            onChange={handleBadgeNumberChange}
            icon={FaIdCard}
            placeholder="Ex: 16"
          />

          {form.badgeId && (
            <div className="mt-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
              <div className="text-xs text-green-600 dark:text-green-400 mb-1">
                Badge ID (automatique)
              </div>
              <div className="font-mono text-sm font-semibold text-green-700 dark:text-green-300">
                {form.badgeId}
              </div>
            </div>
          )}

          {form.badge_number && !form.badgeId && (
            <div className="mt-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-xs text-yellow-700 dark:text-yellow-300">
              Badge non trouve dans la base
            </div>
          )}
        </div>
        <InputField
          type="date"
          label="Date de debut"
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

      {/* Expiry warning */}
      {isExpired && (
        <div className="mt-6 bg-red-50 dark:bg-red-900 border-l-4 border-red-400 dark:border-red-700 p-4 rounded-r-xl">
          <div className="flex items-center">
            <FaTimes className="w-5 h-5 text-red-400 dark:text-red-300 mr-2" />
            <p className="text-red-800 dark:text-red-200 font-medium">
              Abonnement expire le{" "}
              {new Date(form.endDate).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      {/* New payment form (only for existing members) */}
      {member?.id && (
        <div className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 p-6 rounded-xl border border-green-200 dark:border-green-600">
          <h4 className="flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-white mb-4">
            <FaEuroSign className="w-5 h-5 text-green-600 dark:text-green-300" />
            Nouveau paiement
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <InputField
              label="Montant (EUR)"
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
              options={["especes", "cheque", "carte", "virement", "autre"]}
              icon={FaCreditCard}
            />
            <InputField
              label="Encaissement prevu"
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
      )}

      {/* Payment history */}
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
                  Total encaisse
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
                    {/* Amount and method */}
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`p-2 rounded-lg ${
                          pay.is_paid
                            ? "bg-green-100 dark:bg-green-900"
                            : "bg-orange-100 dark:bg-orange-900"
                        }`}
                      >
                        <FaEuroSign
                          className={`w-4 h-4 ${
                            pay.is_paid
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

                    {/* Payment status toggle */}
                    <div className="flex items-center gap-3 mb-3">
                      <button
                        onClick={() =>
                          togglePaymentStatus(pay.id, !pay.is_paid)
                        }
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
                          pay.is_paid
                            ? "text-green-600 dark:text-green-300"
                            : "text-orange-600 dark:text-orange-300"
                        }`}
                      >
                        {pay.is_paid ? "Encaisse" : "En attente"}
                      </span>
                    </div>

                    {/* Payment dates and comment */}
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <p>
                        Paye le{" "}
                        {new Date(pay.date_paiement).toLocaleDateString()}
                      </p>
                      {pay.encaissement_prevu && (
                        <p className="text-blue-600 dark:text-blue-300">
                          Encaissement prevu :{" "}
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

            {/* Payment summary */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {payments.length} paiement{payments.length > 1 ? "s" : ""}{" "}
                    enregistre{payments.length > 1 ? "s" : ""}
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
              Aucun paiement enregistre
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm">
              L'historique des paiements apparaitra ici
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
