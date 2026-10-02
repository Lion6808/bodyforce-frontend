// ===================================================================
// Planning — import des passages depuis un export Excel Intratone
// -------------------------------------------------------------------
// Logique reprise à l'identique de l'ancienne PlanningPage :
// colonnes "Quand" / "Quoi" / "Qui", types "Badges ou Telecommandes"
// et "CleMobil" seulement, UPSERT par paquets de 500
// (onConflict: badgeId,timestamp).
// ===================================================================

import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import { supabase } from "../../supabaseClient";

/**
 * @param {Event} event  - change d'un <input type="file">
 * @param {Function} onDone - appelé après un import réussi
 */
export async function importPresencesFromExcel(event, onDone) {
  const file = event.target.files[0];
  if (!file) return;

  // Verify authentication (needed for RLS)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Vous devez être connecté pour importer des présences.");
      return;
    }
  } catch (e) {
    console.error("Auth check error:", e);
  }

  // Date parsing helpers
  const excelSerialToDate = (serial) => {
    const base = new Date(Date.UTC(1899, 11, 30));
    const ms = Math.round(Number(serial) * 86400) * 1000;
    return new Date(base.getTime() + ms);
  };

  const tryParseFR = (s) => {
    const str = String(s).trim();
    // dd/MM/yy HH:mm
    let m = str.match(/^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
    if (m) {
      const [, dd, mm, yy, HH, MI] = m;
      return new Date(`20${yy}-${mm}-${dd}T${HH}:${MI}:00`);
    }
    // dd/MM/yyyy HH:mm
    m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
    if (m) {
      const [, dd, mm, yyyy, HH, MI] = m;
      return new Date(`${yyyy}-${mm}-${dd}T${HH}:${MI}:00`);
    }
    const d = new Date(str);
    return isNaN(d) ? null : d;
  };

  const toJsDate = (val) => {
    if (val instanceof Date) return val;
    if (typeof val === "number") return excelSerialToDate(val);
    if (typeof val === "string") return tryParseFR(val);
    return null;
  };

  // Read and process the file
  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });

      // Import statistics
      let totalRows = 0;
      let kept = 0;
      let filteredOtherType = 0;
      let skippedNoBadge = 0;
      let skippedNoDate = 0;
      let unparsableDate = 0;

      const allowedTypes = new Set(["Badges ou Telecommandes", "CleMobil"]);
      const payload = [];

      for (const row of rows) {
        totalRows++;

        const quoi = (row["Quoi"] ?? "").toString().trim();
        const quiRaw = row["Qui"];
        const quandRaw = row["Quand"];

        // Filter by type (ignore "BP", empty lines, etc.)
        if (!allowedTypes.has(quoi)) {
          filteredOtherType++;
          continue;
        }

        // Badge ID is required
        const badgeId = (quiRaw ?? "").toString().trim();
        if (!badgeId) {
          skippedNoBadge++;
          continue;
        }

        // Date is required
        if (quandRaw == null) {
          skippedNoDate++;
          continue;
        }

        const dt = toJsDate(quandRaw);
        if (!dt || isNaN(dt)) {
          unparsableDate++;
          continue;
        }

        payload.push({ badgeId, timestamp: dt.toISOString() });
        kept++;
      }

      if (payload.length === 0) {
        console.info("Import présences — détail:", {
          totalRows, kept, filteredOtherType, skippedNoBadge, skippedNoDate, unparsableDate,
        });
        toast.error(
          `Aucune ligne importée sur ${totalRows} lue(s) — détail dans la console.`
        );
        return;
      }

      // Upsert in chunks of 500
      const chunkSize = 500;
      let affected = 0;

      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { data: upserted, error } = await supabase
          .from("presences")
          .upsert(chunk, { onConflict: "badgeId,timestamp" })
          .select("badgeId");

        if (error) {
          console.error("Upsert error:", error);
          toast.error("Erreur lors de l'upsert : " + (error.message || "inconnue"));
          return;
        }

        affected += Array.isArray(upserted) ? upserted.length : 0;
      }

      console.info("Import présences — détail:", {
        totalRows, kept, affected, filteredOtherType, skippedNoBadge, skippedNoDate, unparsableDate,
      });
      toast.success(
        `Import terminé : ${affected} présence(s) importée(s) sur ${totalRows} ligne(s) lue(s).`
      );

      onDone?.();
    };

    reader.readAsArrayBuffer(file);
  } catch (err) {
    console.error("Erreur import Excel:", err);
    toast.error("Erreur lors de l'import.");
  } finally {
    // Allow re-importing the same file without page reload
    try { event.target.value = ""; } catch { }
  }
}
