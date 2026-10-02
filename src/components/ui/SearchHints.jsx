// Aide visuelle de la recherche avancée — commune aux pages Membres et Paiements

import { analyzeSearch } from "../../utils/memberSearch";

/**
 * Inline component that renders contextual hints about the current search query.
 * @param {{ search: string }} props
 */
export function SearchHints({ search }) {
  const info = analyzeSearch(search);
  if (!info.active) return null;

  return (
    <div className="w-full sm:w-auto sm:max-w-[36rem] text-xs mt-1 space-y-1">
      {/* Active-mode badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
          Recherche avancée
        </span>
        {info.hasWildcards && (
          <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
            Jokers * et ?
          </span>
        )}
        {info.hasAnchors && (
          <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
            Ancres ^ et $
          </span>
        )}
      </div>

      {/* Clause visualisation */}
      <div className="flex flex-wrap items-center gap-2">
        {info.clauses.map((tokens, i) => (
          <div
            key={i}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
            title="Tous les tokens d'un groupe = AND"
          >
            {tokens.map((t, j) => (
              <span
                key={j}
                className="px-1.5 py-0.5 rounded bg-white/70 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 font-mono"
              >
                {t}
              </span>
            ))}
            <span className="ml-1 text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-300">
              AND
            </span>
          </div>
        ))}
        {info.clauses.length > 1 && (
          <span
            className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-300"
            title="Groupes reliés par OR"
          >
            (Groupes reliés par OR)
          </span>
        )}
      </div>

      {/* Usage examples */}
      <div className="text-[11px] text-gray-500 dark:text-gray-400">
        Exemples : <code className="font-mono">b*</code> (commence par b),{" "}
        <code className="font-mono">*son</code> (finit par son),{" "}
        <code className="font-mono">mar?</code> (mar + 1 char),{" "}
        <code className="font-mono">homme mar*</code> (AND),{" "}
        <code className="font-mono">b* OR mar*</code> (OR),{" "}
        <code className="font-mono">^mar*</code> (ancré début),{" "}
        <code className="font-mono">*tin$</code> (ancré fin).
      </div>
    </div>
  );
}
