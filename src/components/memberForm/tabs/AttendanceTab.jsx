// Onglet « Présences » de la fiche membre — extrait de MemberFormPage

import {
  FaCalendarAlt,
  FaTimes,
  FaClipboardList,
  FaSync,
  FaChartLine,
  FaChartBar,
  FaClock,
} from "react-icons/fa";
import { formatDate, isWeekend, isToday } from "../../../utils/dateUtils";

/** Render the Attendance tab: filters, stats cards, charts, and visit history. */
export function AttendanceTab({ member, form, attendanceData, attendanceFilters, setAttendanceFilters, fetchMemberAttendance }) {
  const { presences, loading, error, stats } = attendanceData;

  if (!member?.id) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-center py-12">
          <FaClipboardList className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Membre non sauvegarde
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Veuillez d'abord enregistrer le membre pour voir ses presences
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <FaClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Suivi des presences
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Membre: {form.firstName} {form.name}{" "}
                {form.badgeId ? `(Badge: ${form.badgeId})` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <input
                type="date"
                value={attendanceFilters.startDate}
                onChange={(e) =>
                  setAttendanceFilters((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                className="min-w-0 w-full sm:w-auto border-2 border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <input
                type="date"
                value={attendanceFilters.endDate}
                onChange={(e) =>
                  setAttendanceFilters((prev) => ({
                    ...prev,
                    endDate: e.target.value,
                  }))
                }
                className="min-w-0 w-full sm:w-auto border-2 border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <button
              onClick={() => fetchMemberAttendance(member.id)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
            >
              <FaSync
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Actualiser
            </button>
          </div>
        </div>

        {/* Quick date range buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() =>
              setAttendanceFilters((prev) => ({
                ...prev,
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                endDate: new Date().toISOString().split("T")[0],
              }))
            }
            className="px-3 py-1 text-xs bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-600 transition-colors"
          >
            7 derniers jours
          </button>
          <button
            onClick={() =>
              setAttendanceFilters((prev) => ({
                ...prev,
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                endDate: new Date().toISOString().split("T")[0],
              }))
            }
            className="px-3 py-1 text-xs bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-600 transition-colors"
          >
            30 derniers jours
          </button>

          <button
            onClick={() =>
              setAttendanceFilters((prev) => ({
                ...prev,
                startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                endDate: new Date().toISOString().split("T")[0],
              }))
            }
            className="px-3 py-1 text-xs bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-600 transition-colors"
          >
            3 derniers mois
          </button>

          <button
            onClick={() => {
              const currentYear = new Date().getFullYear();
              setAttendanceFilters((prev) => ({
                ...prev,
                startDate: `${currentYear}-01-01`,
                endDate: new Date().toISOString().split("T")[0],
              }));
            }}
            className="px-3 py-1 text-xs bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900/50 dark:hover:to-purple-900/50 text-blue-700 dark:text-blue-400 rounded border-2 border-blue-300 dark:border-blue-600 transition-colors font-semibold"
          >
            Annee en cours
          </button>
        </div>
      </div>

      {/* Loading spinner */}
      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Chargement des presences...
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <FaTimes className="w-5 h-5 text-red-500" />
            <div>
              <h4 className="font-medium text-red-800 dark:text-red-200">
                Erreur de chargement
              </h4>
              <p className="text-red-600 dark:text-red-300 text-sm mt-1">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats summary cards */}
      {!loading && !error && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500 rounded-lg">
                <FaClipboardList className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
                  Total visites
                </p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {stats.totalVisits}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-6 border border-green-200 dark:border-green-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-500 rounded-lg">
                <FaCalendarAlt className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-green-700 dark:text-green-400">
                  Jours uniques
                </p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {stats.uniqueDays}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-6 border border-purple-200 dark:border-purple-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500 rounded-lg">
                <FaChartLine className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-purple-700 dark:text-purple-400">
                  Moyenne/jour
                </p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {stats.avgVisitsPerDay}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-6 border border-orange-200 dark:border-orange-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-500 rounded-lg">
                <FaClock className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-orange-700 dark:text-orange-400">
                  Heure favorite
                </p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {stats.peakHour}h
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weekly and hourly distribution charts */}
      {!loading && !error && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FaChartBar className="w-5 h-5 text-blue-600" />
              Repartition par jour de la semaine
            </h4>

            <div className="space-y-3">
              {[
                "Dimanche",
                "Lundi",
                "Mardi",
                "Mercredi",
                "Jeudi",
                "Vendredi",
                "Samedi",
              ].map((day, index) => {
                const count = stats.weeklyDistribution[index];
                const maxCount = Math.max(...stats.weeklyDistribution);
                const percentage =
                  maxCount > 0 ? (count / maxCount) * 100 : 0;

                return (
                  <div key={day} className="flex items-center gap-3">
                    <div className="w-20 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {day.slice(0, 3)}
                    </div>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          index === 0 || index === 6
                            ? "bg-gradient-to-r from-blue-400 to-blue-600"
                            : "bg-gradient-to-r from-green-400 to-green-600"
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800 dark:text-gray-200">
                        {count} visite{count > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {stats.peakDay && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Jour prefere:</strong> {stats.peakDay}
                </p>
              </div>
            )}
          </div>

          {/* Hourly distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FaClock className="w-5 h-5 text-purple-600" />
              Repartition par heure
            </h4>

            <div className="grid grid-cols-6 gap-1">
              {stats.hourlyDistribution.map((count, hour) => {
                const maxCount = Math.max(...stats.hourlyDistribution);
                const height =
                  maxCount > 0
                    ? Math.max((count / maxCount) * 80, count > 0 ? 10 : 0)
                    : 0;

                return (
                  <div key={hour} className="flex flex-col items-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {hour}h
                    </div>
                    <div
                      className="w-full bg-gray-200 dark:bg-gray-700 rounded-t flex items-end"
                      style={{ height: "80px" }}
                    >
                      {count > 0 && (
                        <div
                          className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t flex items-center justify-center text-white text-xs font-bold transition-all duration-500"
                          style={{ height: `${height}px` }}
                          title={`${hour}h: ${count} visite${
                            count > 1 ? "s" : ""
                          }`}
                        >
                          {count > 0 && height > 20 ? count : ""}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm text-purple-700 dark:text-purple-300">
                <strong>Heure de pointe:</strong> {stats.peakHour}h00 (
                {stats.hourlyDistribution[stats.peakHour]} visite
                {stats.hourlyDistribution[stats.peakHour] > 1 ? "s" : ""})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Daily visit history */}
      {!loading && !error && stats && stats.dailyStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FaCalendarAlt className="w-5 h-5 text-green-600" />
              Historique des visites ({stats.dailyStats.length} jours)
            </h4>

            {stats.firstVisit && stats.lastVisit && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Du {formatDate(stats.firstVisit, "dd/MM/yyyy")} au{" "}
                {formatDate(stats.lastVisit, "dd/MM/yyyy")}
              </div>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto space-y-3">
            {stats.dailyStats.map((day, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                  isToday(day.date)
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
                    : isWeekend(day.date)
                    ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700"
                    : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div
                      className={`text-lg font-bold ${
                        isToday(day.date)
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {day.date.getDate()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(day.date, "EEE dd/MM").split(" ")[0]}
                    </div>
                  </div>

                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {formatDate(day.date, "EEEE dd MMMM")}
                      {isToday(day.date) && (
                        <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full font-bold">
                          Aujourd'hui
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {day.count} visite{day.count > 1 ? "s" : ""}
                      {day.count > 1 && (
                        <span className="text-orange-600 dark:text-orange-400 font-medium ml-1">
                          (passages multiples)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex flex-wrap gap-1">
                    {day.hours.slice(0, 3).map((hour, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded border font-mono"
                      >
                        {hour}
                      </span>
                    ))}
                    {day.hours.length > 3 && (
                      <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 text-xs rounded">
                        +{day.hours.length - 3}
                      </span>
                    )}
                  </div>

                  <div
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      day.count === 1
                        ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                        : day.count <= 3
                        ? "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300"
                        : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {day.count}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && (!stats || stats.totalVisits === 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-center py-12">
            <FaClipboardList className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Aucune presence trouvee
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Aucune visite enregistree pour cette periode
              {form.badgeId ? ` avec le badge ${form.badgeId}` : ""}
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-700 dark:text-blue-300">
              Les presences apparaitront ici des que le membre utilisera son
              badge d'acces
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
