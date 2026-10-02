// Petits composants de la fiche membre (badge de statut, confirmation) — extraits de MemberFormPage

import { FaTrash, FaGraduationCap, FaTimes } from "react-icons/fa";

/**
 * Inline badge showing subscription expiry and/or student status.
 */
export function StatusBadge({ isExpired, isStudent }) {
  return (
    <div className="flex gap-2">
      {isExpired && (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300">
          <FaTimes className="w-3 h-3 mr-1" />
          Expire
        </span>
      )}
      {isStudent && (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300">
          <FaGraduationCap className="w-3 h-3 mr-1" />
          Etudiant
        </span>
      )}
    </div>
  );
}

/**
 * Generic confirmation dialog for destructive actions (delete photo, file, etc.).
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onConfirm
 * @param {Function} props.onCancel
 * @param {string} props.title
 * @param {string} props.message
 * @param {"danger"|"warning"} [props.type="danger"]
 */
export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  type = "danger",
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6">
          {/* Icon and title */}
          <div className="flex items-center gap-4 mb-4">
            <div
              className={`p-3 rounded-full ${
                type === "danger"
                  ? "bg-red-100 dark:bg-red-900/30"
                  : "bg-orange-100 dark:bg-orange-900/30"
              }`}
            >
              {type === "danger" ? (
                <FaTrash className="w-6 h-6 text-red-600 dark:text-red-400" />
              ) : (
                <FaTimes className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
            </div>
          </div>

          <p className="text-gray-600 dark:text-gray-300 mb-6">{message}</p>

          {/* Action buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-white rounded-lg transition-colors ${
                type === "danger"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-orange-600 hover:bg-orange-700"
              }`}
            >
              {type === "danger" ? "Supprimer" : "Confirmer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
