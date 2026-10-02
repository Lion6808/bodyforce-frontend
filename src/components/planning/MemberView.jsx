// ===================================================================
// Planning — vue « Membre » : assiduité d'un membre précis
// -------------------------------------------------------------------
// Recherche (nom, prénom, n° de badge), membres consultés récemment
// (mémorisés dans ce navigateur), puis le bloc MemberAttendance.
// ===================================================================

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { MemberTypeTag } from "../../utils/memberTypes";
import { normalize } from "../../utils/memberSearch";
import MemberAttendance from "./MemberAttendance";
import { fetchMembersIndex } from "./planningData";

const cx = (...c) => c.filter(Boolean).join(" ");
const RECENTS_KEY = "planning.recentMembers";
const MAX_RECENTS = 5;

const readRecents = () => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const writeRecents = (list) => {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    /* stockage indisponible : sans conséquence */
  }
};

const label = (m) => [m.firstName, m.name].filter(Boolean).join(" ") || `Membre ${m.id}`;

export default function MemberView({ memberId, onSelectMember }) {
  const [index, setIndex] = useState([]);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState(readRecents);

  useEffect(() => {
    fetchMembersIndex()
      .then(setIndex)
      .catch(() => setIndex([]));
  }, []);

  // Mémoriser le membre affiché dans les récents
  useEffect(() => {
    if (!memberId || index.length === 0) return;
    const m = index.find((x) => x.id === memberId);
    if (!m) return;
    setRecents((prev) => {
      const next = [{ id: m.id, label: label(m) }, ...prev.filter((r) => r.id !== m.id)].slice(0, MAX_RECENTS);
      writeRecents(next);
      return next;
    });
  }, [memberId, index]);

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return index
      .filter((m) => {
        const hay = normalize(`${m.firstName || ""} ${m.name || ""} ${m.name || ""} ${m.firstName || ""}`);
        return (
          hay.includes(q) ||
          (m.badgeId || "").includes(query.trim()) ||
          String(m.badge_number ?? "") === query.trim()
        );
      })
      .slice(0, 8);
  }, [query, index]);

  const pick = (id) => {
    setQuery("");
    onSelectMember(id);
  };

  return (
    <div className="space-y-3 lg:space-y-5">
      <div className="lg:flex lg:items-start lg:gap-5">
      <div className="space-y-1.5 lg:w-[420px] lg:flex-shrink-0 relative">
        <label htmlFor="planningMemberSearch" className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          Rechercher un membre
        </label>
        <div className="relative">
          <Search className="w-[18px] h-[18px] text-gray-500 absolute left-3.5 top-[13px]" />
          <input
            id="planningMemberSearch"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, prénom ou n° de badge"
            className="w-full h-11 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 pl-10 pr-3.5 text-[15px] text-gray-900 dark:text-white"
          />
        </div>
        {query.trim() && (
          <ul className="lg:absolute lg:left-0 lg:right-0 lg:z-20 lg:shadow-lg bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
            {matches.length === 0 && (
              <li className="px-3.5 py-3 text-sm text-gray-500 dark:text-gray-400">Aucun membre trouvé.</li>
            )}
            {matches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => pick(m.id)}
                  className="w-full text-left px-3.5 min-h-[48px] flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <span className="flex-1 min-w-0 truncate text-[15px] font-medium text-gray-900 dark:text-white">
                    {label(m)}
                  </span>
                  <MemberTypeTag type={m.member_type} className="flex-shrink-0" />
                  {m.badge_number != null && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">n° {m.badge_number}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {recents.length > 0 && (
        <div role="group" aria-label="Membres consultés récemment" className="flex flex-wrap gap-2 mt-3 lg:mt-[22px]">
          {recents.map((r) => {
            const on = r.id === memberId;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                onClick={() => pick(r.id)}
                className={cx(
                  "h-10 px-3.5 rounded-full text-sm font-semibold border max-w-full truncate",
                  on
                    ? "bg-blue-700 border-blue-700 text-white"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      )}
      </div>

      {memberId ? (
        <MemberAttendance memberId={memberId} />
      ) : (
        <div className="text-center py-10 px-4 text-sm text-gray-500 dark:text-gray-400">
          Cherchez un membre, ou touchez un passage dans la vue Aujourd'hui.
        </div>
      )}
    </div>
  );
}
