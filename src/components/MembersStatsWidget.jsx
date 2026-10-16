// ===================================================================
// MembersStatsWidget — widget « Membres » de la page d'accueil
// -------------------------------------------------------------------
// Regroupe dans une seule carte la synthèse des adhérents actifs
// (ActiveMembersSummary) et le total (MembersOverview), avec un
// sélecteur Actifs / Total. Actifs est affiché par défaut.
// La page Membres garde les deux blocs séparés (tuiles = filtres).
// ===================================================================

import { useState } from "react";
import { Card } from "./ui";
import ActiveMembersSummary from "./ActiveMembersSummary";
import MembersOverview from "./MembersOverview";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const VIEWS = [
  ["actifs", "Actifs"],
  ["total", "Total"],
];

/**
 * @param {object} props
 * @param {object} props.stats    - { total, actifs, expires, hommes, femmes, etudiants }
 * @param {object} [props.synthese] - synthèse des adhérents actifs (get_statistics)
 * @param {string} [props.className]
 */
export default function MembersStatsWidget({
  stats,
  synthese,
  className = "",
}) {
  const [view, setView] = useState("actifs");
  // Sans synthèse (ancienne RPC), seul le total est disponible
  const current = synthese ? view : "total";

  return (
    <Card className={className}>
      {synthese && (
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Membres
          </h2>
          <div
            role="group"
            aria-label="Affichage des membres"
            className="grid grid-cols-2 gap-1 bg-gray-100 dark:bg-gray-700 rounded-2xl p-1 w-44 sm:w-56 flex-shrink-0"
          >
            {VIEWS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={current === id}
                onClick={() => setView(id)}
                className={cx(
                  "h-9 rounded-xl text-sm",
                  current === id
                    ? "bg-white dark:bg-gray-800 shadow-sm font-semibold text-gray-900 dark:text-white"
                    : "font-medium text-gray-600 dark:text-gray-300",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {current === "actifs" ? (
        <ActiveMembersSummary {...synthese} bare />
      ) : (
        <MembersOverview stats={stats} bare />
      )}
    </Card>
  );
}
