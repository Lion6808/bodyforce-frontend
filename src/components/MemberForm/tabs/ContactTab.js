// 📄 ContactTab.js — Onglet "Contact" du formulaire

import React from "react";
import { FaHome, FaEnvelope, FaPhone } from "react-icons/fa";
import { InputField } from "../UIComponents";

export function ContactTab({ form, handleChange }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InputField label="Adresse complète" name="address" value={form.address} onChange={handleChange} icon={FaHome} placeholder="Numéro, rue, ville, code postal" />
        <InputField label="Email" name="email" type="email" value={form.email} onChange={handleChange} icon={FaEnvelope} placeholder="exemple@email.com" />
        <InputField label="Téléphone fixe" name="phone" value={form.phone} onChange={handleChange} icon={FaPhone} placeholder="01 23 45 67 89" />
        <InputField label="Téléphone portable" name="mobile" value={form.mobile} onChange={handleChange} icon={FaPhone} placeholder="06 12 34 56 78" />
      </div>
    </div>
  );
}
