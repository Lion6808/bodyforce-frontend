// ===================================================================
// Planning — qui est venu sur une période (semaine, mois, année)
// -------------------------------------------------------------------
// Une ligne par personne, du plus assidu au moins assidu : jours de
// venue (barre), passages hors abonnement valide, dernier passage.
// Egress : 30 lignes affichées à la fois (photos chargées pour les
// seules lignes visibles), « Afficher plus » pour la suite.
// ===================================================================

import { useEffect, useState } from "react";
import MemberIdentity from "../MemberIdentity";
import useMemberPhotos from "../../hooks/useMemberPhotos";
import { keyboardClickable } from "../../utils/a11y";
import { fmtRelative, plural } from "./planningData";

const cx = (...c) => c.filter(Boolean).join(" ");
const PAGE = 30;

export default function PeriodList({ rows, loading, selectedWho, onSelectRow, scrollable = false }) {
  const [shown, setShown] = useState(PAGE);
  useEffect(() => setShown(PAGE), [rows]);

  const visible = rows.slice(0, shown);
  const photos = useMemberPhotos(visible.map((r) => r.member_id));
  const max = Math.max(1, ...rows.map((r) => r.visit_days));

  if (loading && rows.length === 0) {
    return (
      <div className="space-y-2 p-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className="text-center py-10 px-4 text-sm text-gray-500 dark:text-gray-400">Personne sur cette période.</div>;
  }

  return (
    <div className={cx(scrollable && "flex-1 min-h-0 overflow-y-auto", "pb-3")}>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {visible.map((r) => {
          const selected = selectedWho && selectedWho === r.who;
          const subtitle = r.invalid_passages
            ? plural(r.invalid_passages, "passage sans abonnement valide", "passages sans abonnement valide")
            : `Dernier passage : ${fmtRelative(r.last_ts).toLowerCase()}`;
          return (
            <div
              key={r.who}
              {...keyboardClickable(() => onSelectRow(r))}
              aria-pressed={!!selected}
              className={cx(
                "flex items-center gap-3 px-3 py-2.5 min-h-[60px] cursor-pointer",
                selected
                  ? "bg-blue-50 dark:bg-blue-900/30"
                  : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
              )}
            >
              <MemberIdentity
                className="flex-1"
                kind={r.member_id ? "member" : "unknown"}
                member={r.member_id ? { id: r.member_id, name: r.name, first_name: r.first_name, member_type: r.member_type } : null}
                badgeId={r.badge_id}
                photo={r.member_id ? photos[r.member_id] ?? null : null}
                size={40}
                subtitle={subtitle}
                subtitleTone={r.invalid_passages ? "alert" : "muted"}
              />
              <div className="w-24 sm:w-32 flex-shrink-0 text-right">
                <div className="text-[15px] font-semibold tabular-nums text-gray-900 dark:text-white">
                  {plural(r.visit_days, "venue", "venues")}
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${Math.max(4, (r.visit_days / max) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {rows.length > shown && (
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="w-full h-11 rounded-2xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
          >
            Afficher plus (encore {rows.length - shown})
          </button>
        </div>
      )}
    </div>
  );
}
