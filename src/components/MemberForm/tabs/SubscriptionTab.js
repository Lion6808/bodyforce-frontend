// 📄 SubscriptionTab.js — Onglet "Abonnement" du formulaire

import React from "react";
import { FaCreditCard, FaIdCard, FaCalendarAlt, FaTimes } from "react-icons/fa";
import { InputField, SelectField } from "../UIComponents";

const subscriptionDurations = {
  Mensuel: 1,
  Trimestriel: 3,
  Semestriel: 6,
  Annuel: 12,
  "Année civile": 12,
};

export function SubscriptionTab({ form, handleChange, isExpired }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SelectField label="Type d'abonnement" name="subscriptionType" value={form.subscriptionType} onChange={handleChange} options={Object.keys(subscriptionDurations)} icon={FaCreditCard} />
        <InputField label="ID Badge" name="badgeId" value={form.badgeId} onChange={handleChange} icon={FaIdCard} placeholder="Numéro du badge d'accès" />
        <InputField type="date" label="Date de début" name="startDate" value={form.startDate} onChange={handleChange} icon={FaCalendarAlt} />
        <InputField type="date" label="Date de fin" name="endDate" value={form.endDate} readOnly icon={FaCalendarAlt} />
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
}
