// 📄 src/pages/WorkoutEndPage.jsx
// Validation de la durée d'entraînement après notification push

import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { FaClock, FaCheck, FaEdit } from "react-icons/fa";

function urlToDatetimeLocal(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function WorkoutEndPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const badgeId   = searchParams.get("badgeId");
  const timestamp = searchParams.get("ts");

  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState(null);
  const [showEdit, setShowEdit]   = useState(false);
  const [customTime, setCustomTime] = useState("");

  const entryTime     = timestamp ? new Date(timestamp) : null;
  const defaultEndTime = entryTime ? new Date(entryTime.getTime() + 90 * 60 * 1000) : null;

  useEffect(() => {
    setCustomTime(urlToDatetimeLocal(defaultEndTime ? defaultEndTime.toISOString() : new Date().toISOString()));
  }, []);

  const saveEndTime = async (endTime) => {
    if (!badgeId || !timestamp) { setError("Paramètres manquants"); return; }
    setSaving(true);
    setError(null);
    try {
      const { error: supaErr } = await supabase
        .from("presences")
        .update({ end_time: endTime.toISOString() })
        .eq("badgeId", badgeId)
        .eq("timestamp", timestamp);
      if (supaErr) throw supaErr;
      setSaved(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = () => saveEndTime(defaultEndTime || new Date());

  const handleCustom = () => {
    const d = new Date(customTime);
    if (isNaN(d.getTime())) { setError("Heure invalide"); return; }
    saveEndTime(d);
  };

  const fmtTime = (d) =>
    d
      ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      : "—";

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-300 text-3xl">
          <FaCheck />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Enregistré !</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">Durée d'entraînement sauvegardée.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-6 max-w-sm mx-auto">
      <div className="w-16 h-16 rounded-full bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-300 text-3xl">
        <FaClock />
      </div>

      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
          Fin d'entraînement ?
        </h2>
        {entryTime && (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Entrée à {fmtTime(entryTime)}
          </p>
        )}
        {defaultEndTime && (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Fin estimée : {fmtTime(defaultEndTime)} (1h30)
          </p>
        )}
      </div>

      {error && (
        <div className="w-full px-4 py-3 rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300 text-sm text-center">
          {error}
        </div>
      )}

      <div className="w-full flex flex-col gap-3">
        <button
          onClick={handleConfirm}
          disabled={saving}
          className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "OK — Confirmer 1h30"}
        </button>

        <button
          onClick={() => setShowEdit(!showEdit)}
          className="w-full py-3 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium flex items-center justify-center gap-2 transition-colors hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <FaEdit /> Modifier l'heure de fin
        </button>

        {showEdit && (
          <div className="w-full flex flex-col gap-2">
            <input
              type="datetime-local"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <button
              onClick={handleCustom}
              disabled={saving}
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Valider cette heure"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
