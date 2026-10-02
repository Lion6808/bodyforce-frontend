// ===================================================================
// Briques UI communes BodyForce
// -------------------------------------------------------------------
// Card        : conteneur blanc arrondi (rounded-3xl) avec titre optionnel
// MetricTile  : tuile horizontale icône + libellé + valeur (cliquable ou non)
// StatBox     : tuile verticale centrée icône / valeur / libellé
// Pill        : petite étiquette arrondie (statut)
// Skeleton    : bloc de chargement animé
// EmptyState  : message « aucune donnée »
//
// Design repris à l'identique des pages existantes (voir tones.js).
// Les tuiles cliquables sont accessibles au clavier (Entrée / Espace).
// ===================================================================

import { keyboardClickable } from "../../utils/a11y";
import { getTone } from "./tones";

const cx = (...classes) => classes.filter(Boolean).join(" ");

/** Props d'interaction : cliquable au clavier seulement si onClick est fourni. */
const interactive = (onClick) => (onClick ? keyboardClickable(onClick) : {});

// -------------------------------------------------------------------
// Card
// -------------------------------------------------------------------
export function Card({ title, children, className = "" }) {
  return (
    <div
      className={cx(
        "bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-6",
        className
      )}
    >
      {title && (
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>
      )}
      {children}
    </div>
  );
}

// -------------------------------------------------------------------
// MetricTile
// variant "soft"  : fond coloré, à l'intérieur d'une Card (Actifs / Expirés)
// variant "plain" : carte blanche autonome (filtres Badges récents, Comité…)
// -------------------------------------------------------------------
export function MetricTile({
  icon: Icon,
  label,
  value,
  tone = "gray",
  variant = "soft",
  active = false,
  onClick,
  className = "",
}) {
  const t = getTone(tone);
  const base =
    variant === "plain"
      ? cx(
          "rounded-3xl p-4 flex items-center gap-3",
          active
            ? t.active
            : cx("bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700", onClick && t.plainHover)
        )
      : cx("rounded-2xl p-4 flex items-center gap-3", active ? t.active : cx(t.soft, onClick && t.softHover));

  return (
    <div
      className={cx(base, onClick && "cursor-pointer transition-all duration-200", className)}
      {...interactive(onClick)}
      aria-pressed={onClick ? active : undefined}
    >
      <div className={cx("p-2 rounded-xl", t.iconBg)}>
        {Icon && <Icon className={t.text} size={18} />}
      </div>
      <div>
        <p className={cx("text-xs font-medium", t.text)}>{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// StatBox — tuile verticale (Hommes / Femmes / Étudiants…)
// -------------------------------------------------------------------
export function StatBox({
  icon: Icon,
  label,
  value,
  subtitle,
  tone = "gray",
  active = false,
  onClick,
  className = "",
}) {
  const t = getTone(tone);
  return (
    <div
      className={cx(
        "rounded-2xl p-4 text-center",
        active ? t.active : cx(t.soft, onClick && t.softHover),
        onClick && "cursor-pointer transition-all duration-200",
        className
      )}
      {...interactive(onClick)}
      aria-pressed={onClick ? active : undefined}
    >
      <div
        className={cx("mx-auto w-10 h-10 rounded-xl flex items-center justify-center mb-2", t.iconBg)}
      >
        {Icon && <Icon className={t.text} size={18} />}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className={cx("text-xs font-medium mt-1", t.text)}>{label}</p>
      {subtitle && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

// -------------------------------------------------------------------
// Pill — étiquette de statut
// -------------------------------------------------------------------
const PILL_TONES = {
  green: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  red: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300",
  purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  gray: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
};

export function Pill({ tone = "gray", children, className = "" }) {
  return (
    <span
      className={cx(
        "px-2 py-1 rounded-full text-xs font-medium",
        PILL_TONES[tone] || PILL_TONES.gray,
        className
      )}
    >
      {children}
    </span>
  );
}

// -------------------------------------------------------------------
// Skeleton & EmptyState
// -------------------------------------------------------------------
export function Skeleton({ className = "" }) {
  return <div className={cx("bg-gray-200 dark:bg-gray-700 animate-pulse rounded", className)} />;
}

export function EmptyState({ icon: Icon, title = "Aucune donnée", children, className = "" }) {
  return (
    <div className={cx("text-center py-8 text-gray-500 dark:text-gray-400", className)}>
      {Icon && <Icon className="text-4xl mx-auto mb-2 opacity-50" />}
      <p className="font-medium">{title}</p>
      {children && <div className="text-sm mt-1">{children}</div>}
    </div>
  );
}
