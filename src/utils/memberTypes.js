// ===================================================================
// Types de membre (colonne members.member_type)
// -------------------------------------------------------------------
// - adherent    : membre standard (valeur par défaut)
// - comite      : membre du comité, inclus ou non dans les stats (interrupteur)
// - maintenance : concierge, ménage, prestataires — exclus des stats,
//                 compteurs et relances, mais visibles dans les journaux
//                 de passages avec une étiquette grise.
// ===================================================================

export const MEMBER_TYPES = [
  { value: "adherent", label: "Adhérent" },
  { value: "comite", label: "Comité" },
  { value: "maintenance", label: "Maintenance" },
];

export const DEFAULT_MEMBER_TYPE = "adherent";

/** Classes Tailwind de l'étiquette par type (adhérent : pas d'étiquette). */
const TAG_CLASSES = {
  comite:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  maintenance:
    "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

export const getMemberTypeLabel = (type) =>
  MEMBER_TYPES.find((t) => t.value === type)?.label || "Adhérent";

export const getMemberTypeTagClass = (type) => TAG_CLASSES[type] || null;

export const isMaintenance = (m) => m?.member_type === "maintenance";

/** Un membre entre-t-il dans les compteurs / relances ? */
export const isCountedMember = (m) => !isMaintenance(m);

/**
 * Étiquette compacte à afficher à côté d'un nom (rien pour un adhérent).
 * @param {{ type: string, className?: string }} props
 */
export function MemberTypeTag({ type, className = "" }) {
  const tagClass = getMemberTypeTagClass(type);
  if (!tagClass) return null;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tagClass} ${className}`}
    >
      {getMemberTypeLabel(type)}
    </span>
  );
}
