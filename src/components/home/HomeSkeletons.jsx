// Squelettes de chargement de l'accueil — extraits de HomePage



/** Barre pulsante generique pour les etats de chargement */
export const SkeletonPulse = ({ className = "" }) => (
  <div
    className={`bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`}
  />
);

/** Skeleton d'une carte de statistique (StatCard) */
export const SkeletonCard = () => (
  <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-100 dark:border-gray-700 animate-pulse">
    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
    <div className="ml-4 flex-1">
      <SkeletonPulse className="h-4 w-24 mb-2 rounded" />
      <SkeletonPulse className="h-6 w-16 rounded" />
    </div>
  </div>
);

/** Skeleton d'un element de liste (passages, membres, paiements) */
export const SkeletonListItem = () => (
  <div className="flex items-center justify-between p-3 rounded-lg border border-transparent">
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <SkeletonPulse className="w-10 h-10 rounded-full" />
      <div className="min-w-0 flex-1">
        <SkeletonPulse className="h-4 w-40 mb-2 rounded" />
        <SkeletonPulse className="h-3 w-24 rounded" />
      </div>
    </div>
    <div className="text-right flex-shrink-0 ml-3">
      <SkeletonPulse className="h-4 w-12 mb-1 rounded" />
      <SkeletonPulse className="h-3 w-10 rounded" />
    </div>
  </div>
);
