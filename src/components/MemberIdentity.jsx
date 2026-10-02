// ===================================================================
// MemberIdentity — LA façon d'afficher une personne dans l'appli
// -------------------------------------------------------------------
// Photo (Avatar) + nom + étiquette de type (Comité / Maintenance)
// + ligne d'information facultative. La photo et le nom ouvrent la
// fiche du membre ; le retour revient à la page d'origine.
//
// Variantes sans fiche :
//   kind="unknown" : badge non rattaché  → pastille « ? » en pointillés
//   kind="exit"    : sortie bouton poussoir → pastille « BP »
//
// Egress : la photo est passée par la liste appelante (un seul
// chargement groupé, voir hooks/useMemberPhotos). À défaut, le
// composant la charge lui-même via le même cache.
// ===================================================================

import { useLocation, useNavigate } from "react-router-dom";
import Avatar from "./Avatar";
import useMemberPhotos from "../hooks/useMemberPhotos";
import { keyboardClickable } from "../utils/a11y";
import { MemberTypeTag } from "../utils/memberTypes";

const cx = (...c) => c.filter(Boolean).join(" ");

export default function MemberIdentity({
  member,
  photo,
  kind = "member",
  badgeId,
  subtitle,
  subtitleTone = "muted",
  size = 40,
  extra = null,
  className = "",
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasFile = kind === "member" && member?.id;
  const ownPhotos = useMemberPhotos(hasFile && photo === undefined ? [member.id] : []);
  const shownPhoto = photo !== undefined ? photo : hasFile ? ownPhotos[member.id] : null;

  const firstName = member?.firstName ?? member?.first_name ?? "";
  const name = member?.name ?? "";
  const displayName =
    kind === "exit"
      ? "BP (Sortie)"
      : kind === "unknown"
        ? `Badge ${badgeId || ""}`.trim()
        : `${firstName} ${name}`.trim() || `Membre #${member?.id}`;

  const openFile = (e) => {
    e?.stopPropagation?.();
    navigate("/members/edit", {
      state: {
        member: { id: member.id },
        returnPath: `${location.pathname}${location.search}`,
        memberId: member.id,
      },
    });
  };
  const clickable = hasFile ? keyboardClickable(openFile) : {};

  return (
    <div className={cx("flex items-center gap-3 min-w-0", className)}>
      <div
        {...clickable}
        className={cx("flex-shrink-0", hasFile && "cursor-pointer hover:opacity-75 hover:scale-105 transition-all")}
        title={hasFile ? "Voir la fiche du membre" : undefined}
      >
        {kind === "exit" ? (
          <div
            style={{ width: size, height: size }}
            className="rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-sm"
          >
            BP
          </div>
        ) : kind === "unknown" ? (
          <div
            style={{ width: size, height: size }}
            className="rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center text-gray-500 font-bold text-sm"
          >
            ?
          </div>
        ) : (
          <Avatar photo={shownPhoto} firstName={firstName} name={name} size={size} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            {...clickable}
            className={cx(
              "font-medium text-gray-900 dark:text-gray-100 truncate",
              hasFile && "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            )}
          >
            {displayName}
          </span>
          {hasFile && <MemberTypeTag type={member.member_type} className="flex-shrink-0" />}
          {kind === "unknown" && (
            <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">
              Inconnu
            </span>
          )}
          {extra}
        </div>
        {subtitle && (
          <div
            className={cx(
              "text-xs truncate",
              subtitleTone === "alert"
                ? "text-orange-700 dark:text-orange-400 font-semibold"
                : "text-gray-500 dark:text-gray-400"
            )}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
