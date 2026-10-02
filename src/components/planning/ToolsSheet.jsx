// ===================================================================
// Planning — feuille « Outils »
// -------------------------------------------------------------------
// État de la synchronisation Intratone (automatique, CRON Render),
// import d'un export Excel (admin), export Excel de la journée
// affichée, affichage des sorties (bouton poussoir).
// Feuille du bas sur mobile, fenêtre centrée sur grand écran.
// ===================================================================

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { Download, RefreshCw, Upload, X } from "lucide-react";
import { toDateString } from "../../utils/dateUtils";
import { importPresencesFromExcel } from "./importPresences";
import { fmtDayLong, fmtRelative, fmtTime, fullName, passageKind, isInvalidPassage } from "./planningData";

const KIND_LABELS = {
  adherent: "Adhérent",
  comite: "Comité",
  maintenance: "Maintenance",
  inconnu: "Badge inconnu",
  exit: "Sortie",
};

function exportDay(day, passages) {
  const rows = [...passages].reverse().map((p) => {
    const kind = passageKind(p);
    return {
      Heure: fmtTime(p.ts),
      Nom: kind === "inconnu" || kind === "exit" ? "" : fullName(p),
      Badge: p.badge_id,
      Type: KIND_LABELS[kind] || kind,
      "Abonnement valide": kind === "adherent" ? (isInvalidPassage(p) ? "Non" : "Oui") : "",
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Passages");
  XLSX.writeFile(wb, `passages_${toDateString(day)}.xlsx`);
}

export default function ToolsSheet({ open, onClose, isAdmin, day, passages, lastReceived, showExits, onToggleExits, onImported }) {
  const fileRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const fresh = lastReceived && Date.now() - new Date(lastReceived).getTime() < 24 * 3600 * 1000;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center">
      <button type="button" aria-label="Fermer les outils" onClick={onClose} className="absolute inset-0 bg-gray-900/45" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Outils du planning"
        className="relative w-full lg:max-w-md bg-white dark:bg-gray-800 rounded-t-[28px] lg:rounded-3xl px-4 pt-2.5 pb-[calc(1.75rem+env(safe-area-inset-bottom))] lg:pb-5 shadow-2xl space-y-1.5 max-h-[90vh] overflow-y-auto"
      >
        <span className="block mx-auto w-10 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mb-2 lg:hidden" />
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Outils</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Synchronisation */}
        <div className="rounded-2xl bg-gray-50 dark:bg-gray-700/40 p-3.5 flex items-center gap-2.5">
          <span
            className={
              fresh
                ? "w-10 h-10 rounded-2xl bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 flex items-center justify-center flex-shrink-0"
                : "w-10 h-10 rounded-2xl bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 flex items-center justify-center flex-shrink-0"
            }
          >
            <RefreshCw className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-gray-900 dark:text-white">Synchronisation Intratone</div>
            <div
              className={
                fresh
                  ? "text-sm font-semibold text-green-700 dark:text-green-400"
                  : "text-sm font-semibold text-orange-700 dark:text-orange-400"
              }
            >
              {lastReceived
                ? `Automatique · dernier passage reçu : ${fmtRelative(lastReceived).toLowerCase()}`
                : "Aucun passage reçu"}
            </div>
          </div>
        </div>

        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full text-left flex items-center gap-3 min-h-[60px] px-1 py-2 border-b border-gray-100 dark:border-gray-700"
            >
              <span className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
                <Upload className="w-5 h-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-gray-900 dark:text-white">Importer des passages</span>
                <span className="block text-sm text-gray-600 dark:text-gray-400">Fichier Excel exporté d'Intratone</span>
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => importPresencesFromExcel(e, onImported)}
            />
          </>
        )}

        <button
          type="button"
          disabled={passages.length === 0}
          onClick={() => exportDay(day, passages)}
          className="w-full text-left flex items-center gap-3 min-h-[60px] px-1 py-2 border-b border-gray-100 dark:border-gray-700 disabled:opacity-50"
        >
          <span className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-gray-900 dark:text-white">Exporter la journée</span>
            <span className="block text-sm text-gray-600 dark:text-gray-400">
              {fmtDayLong(day)} · passages en Excel
            </span>
          </span>
        </button>

        <div className="flex items-center gap-3 min-h-[60px] px-1 py-2">
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold text-gray-900 dark:text-white">Afficher les sorties</span>
            <span className="block text-sm text-gray-600 dark:text-gray-400">
              Appuis sur le bouton poussoir (non comptés)
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={showExits}
            aria-label="Afficher les sorties"
            onClick={onToggleExits}
            className={`flex-shrink-0 w-[52px] h-8 rounded-full p-[3px] flex transition-colors ${
              showExits ? "bg-blue-600 justify-end" : "bg-gray-300 dark:bg-gray-600 justify-start"
            }`}
          >
            <span className="w-[26px] h-[26px] rounded-full bg-white shadow" />
          </button>
        </div>
      </section>
    </div>
  ,
    document.body
  );
}
