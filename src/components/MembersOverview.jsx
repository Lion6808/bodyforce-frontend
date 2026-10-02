// ===================================================================
// MembersOverview — cartes « Total Membres » + « Répartition »
// -------------------------------------------------------------------
// Partagé par HomePage (lecture seule) et MembersPage (tuiles cliquables
// qui filtrent la liste). Chiffres : get_statistics (accueil) ou
// computeMemberStats (page Membres) — mêmes définitions.
// ===================================================================

import {
  FaUserCheck,
  FaUserTimes,
  FaMale,
  FaFemale,
  FaGraduationCap,
} from "react-icons/fa";
import { Card, MetricTile, StatBox } from "./ui";

/**
 * @param {object}   props
 * @param {object}   props.stats - { total, actifs, expires, hommes, femmes, etudiants }
 * @param {string}   [props.activeFilter] - filtre sélectionné (page Membres)
 * @param {Function} [props.onSelect] - si fourni, les tuiles deviennent des filtres
 * @param {string}   [props.className]
 */
export default function MembersOverview({ stats, activeFilter, onSelect, className = "" }) {
  const select = (filter) => (onSelect ? () => onSelect(filter) : undefined);
  const isActive = (filter) => Boolean(onSelect) && activeFilter === filter;

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {/* Total + Actifs / Expirés */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Total Membres</h2>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-4xl font-bold text-gray-900 dark:text-white">{stats.total}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MetricTile
            icon={FaUserCheck}
            label="Actifs"
            value={stats.actifs}
            tone="green"
            active={Boolean(onSelect) && (activeFilter === "Actifs" || !activeFilter)}
            onClick={select("Actifs")}
          />
          <MetricTile
            icon={FaUserTimes}
            label="Expirés"
            value={stats.expires}
            tone="red"
            active={isActive("Expiré")}
            onClick={select("Expiré")}
          />
        </div>
      </Card>

      {/* Répartition */}
      <Card title="Répartition">
        <div className="grid grid-cols-3 gap-3">
          <StatBox
            icon={FaMale}
            label="Hommes"
            value={stats.hommes}
            tone="indigo"
            active={isActive("Homme")}
            onClick={select("Homme")}
          />
          <StatBox
            icon={FaFemale}
            label="Femmes"
            value={stats.femmes}
            tone="pink"
            active={isActive("Femme")}
            onClick={select("Femme")}
          />
          <StatBox
            icon={FaGraduationCap}
            label="Étudiants"
            value={stats.etudiants}
            tone="yellow"
            active={isActive("Etudiant")}
            onClick={select("Etudiant")}
          />
        </div>
      </Card>
    </div>
  );
}
