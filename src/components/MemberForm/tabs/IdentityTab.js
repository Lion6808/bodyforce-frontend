// 📄 IdentityTab.js — Onglet "Identité" du formulaire

import React from "react";
import { User, Camera, Upload, X } from "lucide-react";
import { FaUser, FaCalendarAlt, FaGraduationCap } from "react-icons/fa";
import { InputField, SelectField } from "../UIComponents";

export function IdentityTab({ form, setForm, handleChange, age, setShowCamera }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Nom" name="name" value={form.name} onChange={handleChange} icon={FaUser} placeholder="Nom de famille" />
            <InputField label="Prénom" name="firstName" value={form.firstName} onChange={handleChange} icon={FaUser} placeholder="Prénom" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField type="date" label="Date de naissance" name="birthdate" value={form.birthdate} onChange={handleChange} icon={FaCalendarAlt} />
            <SelectField label="Sexe" name="gender" value={form.gender} onChange={handleChange} options={["Homme", "Femme"]} icon={FaUser} />
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 p-6 rounded-xl border border-blue-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg"><FaGraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-300" /></div>
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-white">Statut étudiant</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Bénéficiez de tarifs préférentiels</p>
                </div>
              </div>
              <button type="button" onClick={() => setForm((f) => ({ ...f, etudiant: !f.etudiant }))} className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${form.etudiant ? "bg-gradient-to-r from-blue-500 to-purple-600" : "bg-gray-300 dark:bg-gray-600"}`}>
                <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-300 ${form.etudiant ? "translate-x-7" : ""}`} />
              </button>
            </div>
          </div>
          {age !== null && (
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <FaCalendarAlt className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <span className="text-gray-700 dark:text-gray-200 font-medium">Âge : {age} ans</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            {form.photo ? (
              <div className="relative">
                <img src={form.photo} alt="Photo du membre" className="w-40 h-40 object-cover rounded-2xl border-4 border-white shadow-lg" />
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, photo: null }))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="w-40 h-40 flex items-center justify-center border-4 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl text-gray-400 bg-gray-50 dark:bg-gray-800">
                <div className="text-center">
                  <User className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">Pas de photo</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button type="button" onClick={() => setShowCamera("photo")} className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
              <Camera className="w-4 h-4" />
              📱 Prendre une photo
            </button>
            <label className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              Choisir un fichier
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => setForm((prev) => ({ ...prev, photo: ev.target.result }));
                    reader.readAsDataURL(file);
                  }
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
