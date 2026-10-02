// Widgets de motivation admin de l'accueil — extraits de HomePage

import {
  FaUsers,
  FaFire,
  FaBullseye,
  FaRocket,
  FaDollarSign,
} from "react-icons/fa";

/**
 * Bandeau motivationnel affiche uniquement pour les admins.
 * Calcule des metriques (progression objectif membres, taux de paiement,
 * frequentation) et affiche des badges de performance.
 */
export const AdminMotivationWidgets = ({
  stats,
  paymentSummary,
  attendance7d,
  latestMembers,
}) => {
  // --- Calcul des metriques de motivation ---
  const calculateMotivationMetrics = () => {
    const memberGoal = 250;
    const currentMembers = stats?.total || 0;
    const goalProgress = (currentMembers / memberGoal) * 100;

    const newMembersThisMonth = latestMembers?.length || 0;
    const growthRate =
      currentMembers > 0
        ? Math.round((newMembersThisMonth / currentMembers) * 100)
        : 0;

    const totalAttendances =
      attendance7d?.reduce((sum, d) => sum + (d.count || 0), 0) || 0;
    const avgPerDay =
      attendance7d?.length > 0
        ? Math.round(totalAttendances / attendance7d.length)
        : 0;
    const maxPossibleDaily = currentMembers * 0.4;
    const attendanceRate =
      maxPossibleDaily > 0
        ? Math.min(Math.round((avgPerDay / maxPossibleDaily) * 100), 100)
        : 0;

    const paymentRate =
      paymentSummary?.totalAmount > 0
        ? Math.round(
            (paymentSummary.paidAmount / paymentSummary.totalAmount) * 100
          )
        : 0;

    return {
      currentMembers,
      memberGoal,
      goalProgress,
      newMembersThisMonth,
      growthRate,
      totalAttendances,
      avgPerDay,
      attendanceRate,
      paymentRate,
    };
  };

  const metrics = calculateMotivationMetrics();

  // --- Message motivationnel contextuel ---
  const getMotivationalMessage = () => {
    if (metrics.paymentRate >= 98 && metrics.attendanceRate >= 90) {
      return {
        emoji: "🏆",
        title: "Performance exceptionnelle !",
        desc: "Votre club affiche d'excellents résultats",
      };
    }
    if (metrics.goalProgress >= 90) {
      return {
        emoji: "🎯",
        title: "Objectif presque atteint !",
        desc: `Plus que ${metrics.memberGoal - metrics.currentMembers} membres pour atteindre 250`,
      };
    }
    if (metrics.newMembersThisMonth >= 5) {
      return {
        emoji: "📈",
        title: "Forte croissance !",
        desc: `${metrics.newMembersThisMonth} nouveaux membres récemment`,
      };
    }
    if (metrics.totalAttendances > 150) {
      return {
        emoji: "🔥",
        title: "Club très actif !",
        desc: `${metrics.totalAttendances} passages cette semaine`,
      };
    }
    return {
      emoji: "💪",
      title: "Continuez sur cette lancée !",
      desc: "Votre club progresse bien",
    };
  };

  const motivationMessage = getMotivationalMessage();

  // --- Badges de performance ---
  const getAdminBadges = () => {
    const badges = [];
    if (metrics.paymentRate >= 95)
      badges.push({
        icon: <FaDollarSign />,
        name: "Gestion parfaite",
        desc: `${metrics.paymentRate}% encaissés`,
        color: "from-emerald-500 to-green-600",
      });
    if (metrics.attendanceRate >= 80 || metrics.totalAttendances >= 150)
      badges.push({
        icon: <FaFire />,
        name: "Club actif",
        desc: `${metrics.totalAttendances} passages/sem`,
        color: "from-orange-500 to-red-600",
      });
    if (metrics.newMembersThisMonth >= 5)
      badges.push({
        icon: <FaRocket />,
        name: "Forte croissance",
        desc: `+${metrics.newMembersThisMonth} membres`,
        color: "from-purple-500 to-pink-600",
      });
    if (metrics.currentMembers >= 200)
      badges.push({
        icon: <FaUsers />,
        name: "Cap des 200",
        desc: `${metrics.currentMembers} membres`,
        color: "from-blue-500 to-indigo-600",
      });
    if (metrics.goalProgress >= 80)
      badges.push({
        icon: <FaBullseye />,
        name: "Objectif proche",
        desc: `${Math.round(metrics.goalProgress)}% atteint`,
        color: "from-cyan-500 to-blue-600",
      });
    return badges;
  };

  const adminBadges = getAdminBadges();

  // --- Rendu du bandeau ---
  return (
    <div className="space-y-6 mb-8">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 rounded-3xl p-6 text-white shadow-lg border border-blue-400/20">
        <div className="flex items-start gap-4">
          {/* Emoji principal */}
          <div className="text-5xl flex-shrink-0">
            {motivationMessage.emoji}
          </div>

          {/* Message + mini-stats */}
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl font-bold mb-1">
              {motivationMessage.title}
            </h3>
            <p className="text-blue-100 dark:text-blue-200 text-sm">
              {motivationMessage.desc}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="text-xs text-blue-100">Membres</div>
                <div className="text-lg font-bold">{stats?.total || 0}</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="text-xs text-blue-100">Passages/jour</div>
                <div className="text-lg font-bold">
                  {attendance7d?.length
                    ? Math.round(
                        attendance7d.reduce((s, d) => s + (d.count || 0), 0) /
                          attendance7d.length
                      )
                    : 0}
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="text-xs text-blue-100">Taux paiement</div>
                <div className="text-lg font-bold">
                  {paymentSummary?.totalAmount > 0
                    ? Math.round(
                        (paymentSummary.paidAmount /
                          paymentSummary.totalAmount) *
                          100
                      )
                    : 0}
                  %
                </div>
              </div>
            </div>
          </div>

          {/* Badges de performance (desktop uniquement) */}
          {adminBadges.length > 0 && (
            <div className="hidden lg:flex gap-2 flex-shrink-0">
              {adminBadges.slice(0, 3).map((badge, idx) => (
                <div
                  key={idx}
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${badge.color} flex items-center justify-center text-white text-xl shadow-lg transform hover:scale-110 transition-transform cursor-pointer`}
                  title={`${badge.name}: ${badge.desc}`}
                >
                  {badge.icon}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
