// Bannière d'installation PWA et toast PWA — extrait de App.js

import { FaTimes, FaDownload, FaCheck, FaTimes as FaTimesIcon } from "react-icons/fa";

/** Banniere d'invitation a installer la PWA */
export function InstallPrompt({ show, onInstall, onDismiss }) {
  if (!show) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 z-50 border border-gray-200 dark:border-gray-700 animate-slide-up">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <img
            src="/images/logo.png"
            alt="Logo"
            className="w-12 h-12 rounded-xl"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 dark:text-white mb-1">
            Installer Body Force
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Accédez rapidement à l'application depuis votre écran d'accueil
          </p>
          <div className="flex gap-2">
            <button
              onClick={onInstall}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Installer
            </button>
            <button
              onClick={onDismiss}
              className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Plus tard
            </button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Fermer"
        >
          <FaTimes />
        </button>
      </div>
    </div>
  );
}

/** Toast de feedback PWA (install success, etc.) */
export function PWAToast({ toast, onClose }) {
  if (!toast) return null;

  const bgColor = toast.type === "success" ? "bg-green-500" : "bg-blue-500";

  return (
    <div
      className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-4 rounded-lg shadow-lg z-50 animate-slide-down flex items-center gap-3`}
    >
      {toast.type === "success" ? <FaCheck /> : <FaDownload />}
      <span>{toast.message}</span>
      <button
        onClick={onClose}
        className="ml-2 hover:bg-white/20 rounded p-1 transition-colors"
        aria-label="Fermer"
      >
        <FaTimesIcon />
      </button>
    </div>
  );
}
