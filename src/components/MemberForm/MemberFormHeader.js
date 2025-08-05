// 📄 MemberFormHeader.js — En-tête du formulaire modal

import React from "react";
import { FaUser, FaIdCard, FaTimes, FaCheck, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { StatusBadge, TabButton } from "./UIComponents";

export function MemberFormHeader({
  form,
  isExpired,
  onCancel,
  handleSubmit,
  tabs,
  activeTab,
  setActiveTab,
  currentTabIndex,
  goToTab,
}) {
  return (
    <div className="bg-gradient-to-r from-blue-400 to-purple-500 dark:from-blue-800 dark:to-purple-800 text-white p-4 md:p-6 rounded-t-2xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center flex-shrink-0">
            {form.photo ? (
              <img src={form.photo} alt="Avatar" className="w-10 h-10 sm:w-14 sm:h-14 rounded-full object-cover" />
            ) : (
              <FaUser className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold truncate">
              {form.firstName || form.name ? `${form.firstName} ${form.name}` : "Nouveau membre"}
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
        <div className="flex gap-2 w-full sm:w-auto">
          <button type="button" onClick={onCancel} className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white bg-opacity-20 text-white rounded-xl hover:bg-opacity-30 transition-all duration-200 flex-1 sm:flex-none text-sm">
            <FaTimes className="w-4 h-4" />
            <span className="hidden sm:inline">Annuler</span>
          </button>
          <button type="button" onClick={handleSubmit} className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-white text-blue-600 rounded-xl hover:bg-gray-100 transition-all duration-200 font-semibold shadow-lg flex-1 sm:flex-none text-sm">
            <FaCheck className="w-4 h-4" />
            Enregistrer
          </button>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-1 sm:gap-2 min-w-max pb-2 sm:pb-0">
          {tabs.map((tab) => (
            <TabButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} icon={tab.icon} count={tab.count}>
              {tab.label}
            </TabButton>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between mt-4">
        <button onClick={() => goToTab(currentTabIndex - 1)} disabled={currentTabIndex === 0} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${currentTabIndex === 0 ? "text-white text-opacity-40 cursor-not-allowed" : "text-white text-opacity-80 hover:text-white hover:bg-white hover:bg-opacity-20"}`}>
          <FaChevronLeft className="w-3 h-3" />
          <span className="hidden sm:inline">Précédent</span>
        </button>
        <div className="flex justify-center gap-2">
          {tabs.map((_, index) => (
            <button key={index} onClick={() => goToTab(index)} className={`w-2 h-2 rounded-full transition-colors ${currentTabIndex === index ? "bg-white" : "bg-white bg-opacity-40"}`} />
          ))}
        </div>
        <button onClick={() => goToTab(currentTabIndex + 1)} disabled={currentTabIndex === tabs.length - 1} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${currentTabIndex === tabs.length - 1 ? "text-white text-opacity-40 cursor-not-allowed" : "text-white text-opacity-80 hover:text-white hover:bg-white hover:bg-opacity-20"}`}>
          <span className="hidden sm:inline">Suivant</span>
          <FaChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="text-center mt-3 text-xs text-white text-opacity-70">
        💡 Glissez horizontalement ou utilisez les flèches pour naviguer
      </div>
    </div>
  );
}
