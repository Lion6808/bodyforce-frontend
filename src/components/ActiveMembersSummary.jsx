// ===================================================================
// ActiveMembersSummary — synthèse des adhérents actifs
// -------------------------------------------------------------------
// Affiché sur HomePage (chiffres de la RPC get_statistics) et sur
// MembersPage (chiffres calculés côté client). Maintenance exclue en
// amont ; « actif » = date de fin postérieure à aujourd'hui.
// ===================================================================

import { FaUserCheck, FaMale, FaFemale, FaGraduationCap } from "react-icons/fa";

const pct = (value, total) =>
  total > 0 ? Math.round((value / total) * 100) : 0;

function Tile({ icon: Icon, value, label, total, tone }) {
  return (
    <div className={`rounded-2xl p-4 text-center ${tone.bg}`}>
      <div
        className={`mx-auto w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${tone.iconBg}`}
      >
        <Icon className={tone.text} size={18} />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className={`text-xs font-medium mt-1 ${tone.text}`}>{label}</p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
        {pct(value, total)} % des actifs
      </p>
    </div>
  );
}

const TONES = {
  men: {
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
    iconBg: "bg-indigo-500/15",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  women: {
    bg: "bg-pink-50 dark:bg-pink-900/20",
    iconBg: "bg-pink-500/15",
    text: "text-pink-600 dark:text-pink-400",
  },
  student: {
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    iconBg: "bg-yellow-500/15",
    text: "text-yellow-600 dark:text-yellow-400",
  },
};

/**
 * @param {object} props
 * @param {number} props.actifs
 * @param {number} props.hommes
 * @param {number} props.femmes
 * @param {number} props.etudiantsHommes
 * @param {number} props.etudiantsFemmes
 */
export default function ActiveMembersSummary({
  actifs = 0,
  hommes = 0,
  femmes = 0,
  etudiantsHommes = 0,
  etudiantsFemmes = 0,
}) {
  const menShare = pct(hommes, hommes + femmes);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
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
        <Tile icon={FaMale} value={hommes} label="Hommes" total={actifs} tone={TONES.men} />
        <Tile icon={FaFemale} value={femmes} label="Femmes" total={actifs} tone={TONES.women} />
        <Tile
          icon={FaGraduationCap}
          value={etudiantsHommes}
          label="Étudiants hommes"
          total={actifs}
          tone={TONES.student}
        />
        <Tile
          icon={FaGraduationCap}
          value={etudiantsFemmes}
          label="Étudiantes"
          total={actifs}
          tone={TONES.student}
        />
      </div>
    </div>
  );
}
