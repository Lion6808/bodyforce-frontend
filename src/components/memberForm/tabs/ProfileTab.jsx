// Onglet « Profil » de la fiche membre — extrait de MemberFormPage

import {
  FaUser,
  FaHome,
  FaCalendarAlt,
  FaPhone,
  FaEnvelope,
  FaGraduationCap,
} from "react-icons/fa";
import { MEMBER_TYPES, DEFAULT_MEMBER_TYPE } from "../../../utils/memberTypes";
import { InputField, SelectField } from "../../ui/FormFields";

/** Render the Profile tab: personal info, contact fields, student toggle. */
export function ProfileTab({ form, setForm, handleChange, age }) {
  return (
  <div className="space-y-8">
    {/* Personal information card */}
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
          label="Prenom"
          name="firstName"
          value={form.firstName}
          onChange={handleChange}
          icon={FaUser}
          placeholder="Prenom"
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
        <SelectField
          label="Type de membre"
          name="member_type"
          value={form.member_type || DEFAULT_MEMBER_TYPE}
          onChange={handleChange}
          options={MEMBER_TYPES}
          icon={FaUser}
        />
      </div>
      {form.member_type === "maintenance" && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Personnel de maintenance : exclu des statistiques, des compteurs
          et des relances. Ses passages restent visibles sur cette fiche.
        </p>
      )}
      {age !== null && (
        <div className="mt-6 bg-gray-50 dark:bg-gray-700 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <FaCalendarAlt className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-200 font-medium">
              Age : {age} ans
            </span>
          </div>
        </div>
      )}

      {/* Student status toggle */}
      <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-600 p-6 rounded-xl border border-blue-200 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <FaGraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-white">
                Statut etudiant
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Beneficiez de tarifs preferentiels
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, etudiant: !f.etudiant }))}
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
    </div>

    {/* Contact information card */}
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <FaHome className="w-5 h-5 text-green-600 dark:text-green-400" />
        Contact
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InputField
          label="Adresse complete"
          name="address"
          value={form.address}
          onChange={handleChange}
          icon={FaHome}
          placeholder="Numero, rue, ville, code postal"
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
          label="Telephone fixe"
          name="phone"
          value={form.phone}
          onChange={handleChange}
          icon={FaPhone}
          placeholder="01 23 45 67 89"
        />
        <InputField
          label="Telephone portable"
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
}
