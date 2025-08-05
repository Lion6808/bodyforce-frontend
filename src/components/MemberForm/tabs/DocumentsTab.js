// 📄 DocumentsTab.js — Onglet "Documents" du formulaire

import React from "react";
import { FaFileUpload, FaFileAlt, FaEye, FaDownload, FaTrash, FaCamera } from "react-icons/fa";

export function DocumentsTab({ form, handleFileUpload, removeFile, setShowCamera }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <label htmlFor="fileUpload" className="cursor-pointer flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
          <FaFileUpload className="w-4 h-4" />
          Importer des fichiers
        </label>
        <input type="file" id="fileUpload" className="hidden" multiple onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
        
        <button type="button" onClick={() => setShowCamera("document")} className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
          <FaCamera className="w-4 h-4" />
          📄 Photographier un document
        </button>
      </div>

      {form.files.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {form.files.map((file) => (
            <div key={file.name} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <FaFileAlt className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-800 dark:text-white truncate">{file.name}</h4>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {file.url && (
                      <>
                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 text-sm rounded-lg hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors">
                          <FaEye className="w-3 h-3" /> Voir
                        </a>
                        <a href={file.url} download={file.name} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 text-sm rounded-lg hover:bg-green-200 dark:hover:bg-green-700 transition-colors">
                          <FaDownload className="w-3 h-3" /> Télécharger
                        </a>
                      </>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); removeFile(file); }} className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 text-sm rounded-lg hover:bg-red-200 dark:hover:bg-red-700 transition-colors">
                      <FaTrash className="w-3 h-3" /> Supprimer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <FaFileAlt className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-300 text-lg font-medium">Aucun document</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">Importez des certificats, documents d'identité, etc.</p>
        </div>
      )}
    </div>
  );
}
