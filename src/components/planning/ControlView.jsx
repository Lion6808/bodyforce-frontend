// ===================================================================
// Planning — vue « Contrôle » : anomalies des 30 derniers jours
// -------------------------------------------------------------------
// Expirés qui passent encore, badges non attribués, passages de nuit,
// badges utilisés hors de leur période. Chaque point peut être marqué
// « vu » (table planning_anomaly_seen) ; il se rouvre si un nouveau
// passage arrive ensuite.
// ===================================================================

import { useState } from "react";
import { toast } from "react-toastify";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { CONTROL_DAYS, markSeen, unmarkSeen } from "./planningData";

const cx = (...c) => c.filter(Boolean).join(" ");

const ICON_TONES = {
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

export default function ControlView({ control, loading, error, onSeenChange, onOpenMember, onOpenDay }) {
  const [busy, setBusy] = useState(null);

  const runAction = async (action) => {
    if (action.type === "member") onOpenMember(action.memberId);
    else if (action.type === "day") onOpenDay(new Date(action.day));
    else if (action.type === "copy") {
      try {
        await navigator.clipboard.writeText(action.value);
        toast.success(`N° de badge ${action.value} copié`);
      } catch {
        toast.info(`N° de badge : ${action.value}`);
      }
    }
  };

  const toggleSeen = async (item) => {
    setBusy(item.key);
    try {
      if (item.done) await unmarkSeen(item.key);
      else await markSeen(item.key);
      onSeenChange();
    } catch (e) {
      toast.error(`Impossible d'enregistrer : ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-4 text-sm text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!control) {
    return (
      <div className="max-w-xl mx-auto space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-40 rounded-3xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
        ))}
      </div>
    );
  }

  const { sections, remaining } = control;

  return (
    <div className={cx("max-w-xl mx-auto space-y-3", loading && "opacity-70")}>
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {remaining === 0 ? "Tout est en ordre" : `${remaining} point${remaining > 1 ? "s" : ""} à vérifier`}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Repérés automatiquement sur les {CONTROL_DAYS} derniers jours. Une fois traité, un point peut être marqué
          comme vu.
        </p>
      </div>

      {sections.map((s) => (
        <section
          key={s.id}
          className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3"
        >
          <div className="flex items-start gap-3">
            <span className={cx("w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center", ICON_TONES[s.tone])}>
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">{s.title}</h3>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{s.hint}</p>
            </div>
          </div>

          {s.items.map((it) => (
            <div
              key={it.key}
              className={cx(
                "rounded-2xl p-3 space-y-2.5",
                it.done ? "bg-green-50 dark:bg-green-900/20" : "bg-gray-50 dark:bg-gray-700/40"
              )}
            >
              <div>
                <div className="text-[15px] font-bold text-gray-900 dark:text-white break-words">{it.who}</div>
                <div className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{it.detail}</div>
              </div>
              {it.done ? (
                <div className="flex items-center justify-between text-sm font-semibold text-green-700 dark:text-green-400">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Marqué comme vu
                  </span>
                  <button
                    type="button"
                    disabled={busy === it.key}
                    onClick={() => toggleSeen(it)}
                    className="text-blue-700 dark:text-blue-400 px-1 py-2.5"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => runAction(it.action)}
                    className="flex-1 min-w-0 h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-2"
                  >
                    {it.action.label}
                  </button>
                  <button
                    type="button"
                    disabled={busy === it.key}
                    onClick={() => toggleSeen(it)}
                    className="h-11 px-3.5 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-semibold flex-shrink-0"
                  >
                    Marquer vu
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
