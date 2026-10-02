// ===================================================================
// ActiveMembersSummary — synthèse des adhérents actifs
// -------------------------------------------------------------------
// Affiché sur HomePage (get_statistics → stats.synthese) et sur
// MembersPage (computeMemberStats → synthese). Compte uniquement les
// adhérents (member_type = 'adherent') ; le comité actif est indiqué à
// part, la maintenance est exclue. « Actif » = date de fin > aujourd'hui.
// ===================================================================

import { FaUserCheck, FaMale, FaFemale, FaGraduationCap } from "react-icons/fa";
import { Card, StatBox } from "./ui";

const pct = (value, total) =>
  total > 0 ? Math.round((value / total) * 100) : 0;

/**
 * @param {object} props
 * @param {number} props.actifs
 * @param {number} props.hommes
 * @param {number} props.femmes
 * @param {number} props.etudiantsHommes
 * @param {number} props.etudiantsFemmes
 * @param {number} props.comite - membres du comité actifs (hors synthèse)
 */
export default function ActiveMembersSummary({
  actifs = 0,
  hommes = 0,
  femmes = 0,
  etudiantsHommes = 0,
  etudiantsFemmes = 0,
  comite = 0,
}) {
  const menShare = pct(hommes, hommes + femmes);
  const ofActive = (value) => `${pct(value, actifs)} % des actifs`;

  return (
    <Card className="mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-green-500/15">
          <FaUserCheck className="text-green-600 dark:text-green-400" size={18} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Synthèse des adhérents actifs
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <span className="text-2xl font-bold text-gray-900 dark:text-white mr-1">
              {actifs}
            </span>
            adhérents actifs
          </p>
          {comite > 0 && (
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
              + {comite} membre{comite > 1 ? "s" : ""} du comité (compté{comite > 1 ? "s" : ""} à part)
            </p>
          )}
        </div>
      </div>

      {/* Proportion hommes / femmes */}
      {hommes + femmes > 0 && (
        <div className="mb-4">
          <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
            <div className="bg-indigo-500" style={{ width: `${menShare}%` }} />
            <div className="bg-pink-500" style={{ width: `${100 - menShare}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Hommes {menShare} %</span>
            <span>Femmes {100 - menShare} %</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox icon={FaMale} label="Hommes" value={hommes} subtitle={ofActive(hommes)} tone="indigo" />
        <StatBox icon={FaFemale} label="Femmes" value={femmes} subtitle={ofActive(femmes)} tone="pink" />
        <StatBox
          icon={FaGraduationCap}
          label="Étudiants hommes"
          value={etudiantsHommes}
          subtitle={ofActive(etudiantsHommes)}
          tone="yellow"
        />
        <StatBox
          icon={FaGraduationCap}
          label="Étudiantes"
          value={etudiantsFemmes}
          subtitle={ofActive(etudiantsFemmes)}
          tone="yellow"
        />
      </div>
    </Card>
  );
}
