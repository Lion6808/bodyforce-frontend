// ===================================================================
// MemberStatusPills — étiquettes de statut d'un membre
// -------------------------------------------------------------------
// Abonnement (Maintenance / Expiré / Actif) + certificat (Docs OK /
// Manquant). Utilisé par la vue tableau et la vue mobile de MembersPage ;
// le conteneur (colonne ou ligne) reste fourni par l'appelant.
// ===================================================================

import { Pill } from "./ui";
import { isMaintenance } from "../utils/memberTypes";

/**
 * @param {object}  props
 * @param {object}  props.member
 * @param {boolean} props.isExpired - abonnement échu (utils/memberRules)
 * @param {boolean} props.hasFiles  - certificat / documents présents
 */
export default function MemberStatusPills({ member, isExpired, hasFiles }) {
  return (
    <>
      {isMaintenance(member) ? (
        <Pill tone="gray">Maintenance</Pill>
      ) : isExpired ? (
        <Pill tone="red">Expiré</Pill>
      ) : (
        <Pill tone="green">Actif</Pill>
      )}
      {hasFiles ? <Pill tone="blue">Docs OK</Pill> : <Pill tone="orange">Manquant</Pill>}
    </>
  );
}
