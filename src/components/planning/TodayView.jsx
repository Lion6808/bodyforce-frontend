// ===================================================================
// Planning — vue « Aujourd'hui » : qui est venu ce jour-là
// -------------------------------------------------------------------
// Fil chronologique groupé par heure, résumé de la journée, filtres
// par type de passage. Sur grand écran : colonne de gauche (jour,
// résumé, filtres) + fil au centre ; le panneau d'assiduité est posé
// à droite par PlanningPage.
// ===================================================================

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import MemberIdentity from "../MemberIdentity";
import { keyboardClickable } from "../../utils/a11y";
import DayCalendar from "./DayCalendar";
import PeriodList from "./PeriodList";
import useMemberPhotos from "../../hooks/useMemberPhotos";
import { toDateString } from "../../utils/dateUtils";
import {
  FILTERS,
  addDays,
  fmtDate,
  fmtDayLong,
  fmtTime,
  isInvalidPassage,
  passageKind,
  plural,
  sameDay,
  PERIODS,
  periodIncludesToday,
  periodLabel,
  shiftPeriod,
} from "./planningData";

const cx = (...c) => c.filter(Boolean).join(" ");

const FIRST_HOUR = 6;
const LAST_HOUR = 23;

/** Ligne du fil enrichie : catégorie, alerte, sous-titre, 2ᵉ passage. */
function decorate(passages) {
  const seenBefore = new Set();
  // Les passages arrivent du plus récent au plus ancien : on parcourt à l'envers
  const rows = [...passages].reverse().map((p) => {
    const kind = passageKind(p);
    const who = p.member_id ? `m${p.member_id}` : `b${p.badge_id}`;
    const repeat = kind !== "exit" && seenBefore.has(who);
    if (kind !== "exit") seenBefore.add(who);

    let alert = null;
    let sub = "";
    if (kind === "inconnu") alert = "Badge non rattaché à une fiche";
    else if (kind === "exit") sub = "Sortie (bouton poussoir)";
    else if (kind === "maintenance") sub = "Ne compte pas dans les stats";
    else if (kind === "comite") sub = "Membre du comité";
    else if (isInvalidPassage(p))
      alert = p.end_date ? `Abonnement expiré le ${fmtDate(p.end_date)}` : "Aucune date de fin d'abonnement";
    else sub = `Abonnement jusqu'au ${fmtDate(p.end_date)}`;

    return { ...p, kind, who, repeat, alert, sub, hour: new Date(p.ts).getHours() };
  });
  return rows.reverse();
}

/** Identité d'un passage : membre (photo → fiche), badge inconnu ou sortie BP. */
function PassageIdentity({ r, photos, size }) {
  return (
    <MemberIdentity
      className="flex-1"
      kind={r.kind === "inconnu" ? "unknown" : r.kind === "exit" ? "exit" : "member"}
      badgeId={r.badge_id}
      member={r.member_id ? { id: r.member_id, name: r.name, first_name: r.first_name, member_type: r.member_type } : null}
      photo={r.member_id ? photos[r.member_id] ?? null : null}
      size={size}
      subtitle={r.alert || r.sub}
      subtitleTone={r.alert ? "alert" : "muted"}
      extra={
        r.repeat ? <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">nouveau passage</span> : null
      }
    />
  );
}

/** Jour / Semaine / Mois / Année */
function PeriodTabs({ period, onChange }) {
  return (
    <div role="group" aria-label="Période" className="grid grid-cols-4 gap-1 bg-gray-100 dark:bg-gray-700 lg:bg-gray-200/70 rounded-2xl p-1">
      {PERIODS.map((p) => {
        const on = p.id === period;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(p.id)}
            className={cx(
              "h-9 rounded-xl text-sm",
              on
                ? "bg-white dark:bg-gray-800 shadow-sm font-semibold text-gray-900 dark:text-white"
                : "font-medium text-gray-600 dark:text-gray-300"
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

export default function TodayView({
  day,
  onChangeDay,
  passages,
  loading,
  lastReceived,
  onRefresh,
  showExits,
  selectedWho,
  onSelectRow,
  desktop = false,
  aside = null,
  period = "day",
  onChangePeriod = () => {},
  attendance = [],
  attendanceLoading = false,
}) {
  const [filter, setFilter] = useState("all");
  const isTodayView = sameDay(day, new Date());

  const rows = useMemo(() => decorate(passages), [passages]);
  const photos = useMemberPhotos(passages.map((p) => p.member_id));
  const entries = rows.filter((r) => r.kind !== "exit");
  const visible = rows.filter((r) => {
    if (r.kind === "exit") return showExits && filter === "all";
    return filter === "all" || r.kind === filter;
  });

  const people = new Set(entries.map((r) => r.who)).size;
  const toCheck = entries.filter((r) => r.alert).length;

  // Affluence par heure (passages d'entrée)
  const nowHour = new Date().getHours();
  const hours = [];
  for (let h = FIRST_HOUR; h <= LAST_HOUR; h++) {
    hours.push({ h, n: entries.filter((r) => r.hour === h).length });
  }
  const maxHour = Math.max(1, ...hours.map((x) => x.n));

  // Groupes par heure, du plus récent au plus ancien
  const groups = [];
  visible.forEach((r) => {
    const last = groups[groups.length - 1];
    if (last && last.hour === r.hour) last.rows.push(r);
    else groups.push({ hour: r.hour, rows: [r] });
  });

  const lastTodayTs = isTodayView && entries[0] ? entries[0].ts : lastReceived;

  // Période (semaine, mois, année) : une ligne par personne
  const isDay = period === "day";
  const periodRows = useMemo(
    () =>
      attendance.map((r) => ({
        ...r,
        who: r.member_id ? `m${r.member_id}` : `b${r.badge_id}`,
        kind: r.member_id ? r.member_type || "adherent" : "inconnu",
      })),
    [attendance]
  );
  const periodVisible = periodRows.filter((r) => filter === "all" || r.kind === filter);
  const totalPassages = isDay ? entries.length : periodRows.reduce((n, r) => n + Number(r.passages || 0), 0);
  const totalPeople = isDay ? people : periodRows.length;
  const totalToCheck = isDay ? toCheck : periodRows.filter((r) => r.invalid_passages > 0 || !r.member_id).length;
  const countFor = (id) => {
    const list = isDay ? entries : periodRows;
    return id === "all" ? list.length : list.filter((r) => r.kind === id).length;
  };
  const atPresent = periodIncludesToday(period, day);

  if (desktop) {
    return (
      <div className={cx("grid gap-5 flex-1 min-h-0 h-full", aside ? "grid-cols-[260px_minmax(0,1fr)_320px]" : "grid-cols-[260px_minmax(0,1fr)]")}>
        {/* Colonne 1 : calendrier, résumé, filtres (fixe ; défile seulement si l'écran est trop bas) */}
        <div className="min-h-0 overflow-y-auto space-y-4 pb-1">
          <PeriodTabs period={period} onChange={onChangePeriod} />
          <DayCalendar
            day={day}
            onChangeDay={(d) => {
              onChangePeriod("day");
              onChangeDay(d);
            }}
          />

          <section
            aria-label="Résumé de la période"
            aria-busy={!isDay && attendanceLoading}
            className={cx("bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3 transition-opacity", !isDay && attendanceLoading && "opacity-40")}
          >
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalPassages}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">passages</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalPeople}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">personnes</div>
              </div>
              <div className={totalToCheck ? "text-orange-700 dark:text-orange-400" : "text-gray-900 dark:text-white"}>
                <div className="text-2xl font-bold">{totalToCheck}</div>
                <div className="text-xs font-semibold">à vérifier</div>
              </div>
            </div>
            {isDay && (<div>
              <div className="flex items-end gap-[3px] h-8">
                {hours.map(({ h, n }) => (
                  <div
                    key={h}
                    title={`${h} h : ${plural(n, "passage", "passages")}`}
                    className={cx(
                      "flex-1 rounded-sm",
                      isTodayView && h === nowHour
                        ? "bg-blue-700"
                        : !isTodayView || h < nowHour
                          ? "bg-blue-300 dark:bg-blue-500/60"
                          : "bg-gray-200 dark:bg-gray-700"
                    )}
                    style={{ height: `${Math.max(3, (n / maxHour) * 32)}px` }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                <span>6 h</span>
                <span>12 h</span>
                <span>18 h</span>
                <span>23 h</span>
              </div>
            </div>)}
          </section>

          <section
            role="group"
            aria-label="Filtrer les passages"
            className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-2 flex flex-col gap-0.5"
          >
            {FILTERS.map((f) => {
              const n = countFor(f.id);
              const on = f.id === filter;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(f.id)}
                  className={cx(
                    "h-10 rounded-xl px-3 flex items-center justify-between text-sm",
                    on
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold"
                      : "text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  )}
                >
                  <span>{f.label}</span>
                  <span className="tabular-nums">{n}</span>
                </button>
              );
            })}
          </section>
        </div>

        {/* Colonne 2 : fil du jour */}
        <section
          aria-label="Passages du jour"
          className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm px-2 pt-2 min-w-0 min-h-0 flex flex-col"
        >
          <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300">
            <span className={cx("w-2 h-2 rounded-full flex-shrink-0", lastReceived ? "bg-green-600" : "bg-gray-400")} />
            <span className="flex-1 min-w-0 truncate">
              {!isDay && attendanceLoading
                ? `${periodLabel(period, day)} · chargement…`
                : !isDay
                ? `${periodLabel(period, day)} · ${plural(totalPeople, "personne", "personnes")}, du plus assidu au moins assidu`
                : isTodayView
                  ? lastTodayTs
                    ? `À jour · reçu à ${fmtTime(lastTodayTs)}`
                    : "Aucun passage reçu pour l'instant"
                  : `${fmtDayLong(day)} · ${plural(entries.length, "passage", "passages")}`}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              className="flex items-center gap-1 text-blue-700 dark:text-blue-400 font-semibold px-2 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30"
            >
              <RefreshCw className={cx("w-4 h-4", (loading || attendanceLoading) && "animate-spin")} />
              Actualiser
            </button>
          </div>

          {!isDay && (
            <PeriodList
              rows={periodVisible}
              loading={attendanceLoading}
              selectedWho={selectedWho}
              onSelectRow={onSelectRow}
              scrollable
            />
          )}

          {/* Seule la liste défile */}
          {isDay && (
          <div className="flex-1 min-h-0 overflow-y-auto pb-3">
          {loading && rows.length === 0 && (
            <div className="space-y-2 px-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 animate-pulse" />
              ))}
            </div>
          )}

          {groups.map((g) => (
            <div key={g.hour}>
              <h3 className="mx-3 mt-2.5 mb-1 text-sm font-semibold text-gray-500 dark:text-gray-400">
                {String(g.hour).padStart(2, "0")} h · {plural(g.rows.length, "passage", "passages")}
              </h3>
              {g.rows.map((r) => {
                const selected = selectedWho && selectedWho === r.who;
                const clickable = r.kind !== "exit";
                return (
                  <div
                    key={r.presence_id}
                    {...(clickable ? keyboardClickable(() => onSelectRow(r)) : {})}
                    aria-pressed={clickable ? !!selected : undefined}
                    className={cx(
                      "w-full text-left rounded-2xl px-3 py-2 min-h-[56px] flex items-center gap-3",
                      clickable && "cursor-pointer",
                      selected
                        ? "bg-blue-50 dark:bg-blue-900/30 ring-2 ring-inset ring-blue-300 dark:ring-blue-700"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    )}
                  >
                    <span className="w-12 flex-shrink-0 text-[15px] font-semibold tabular-nums text-gray-900 dark:text-white">
                      {fmtTime(r.ts)}
                    </span>
                    <PassageIdentity r={r} photos={photos} size={40} />
                  </div>
                );
              })}
            </div>
          ))}

          {!loading && groups.length === 0 && (
            <div className="text-center py-10 px-4 text-sm text-gray-500 dark:text-gray-400">
              {rows.length === 0 ? "Aucun passage ce jour-là." : "Aucun passage pour ce filtre."}
            </div>
          )}
          </div>
          )}
        </section>

        {/* Colonne 3 : assiduité du membre sélectionné (écran large) */}
        {aside && (
          <aside aria-label="Assiduité du membre sélectionné" className="min-h-0 overflow-y-auto pb-1">
            {aside}
          </aside>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Colonne jour / résumé / filtres */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={isDay ? "Jour précédent" : "Période précédente"}
            onClick={() => onChangeDay(shiftPeriod(period, day, -1))}
            className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <label className="flex-1 min-w-0 text-center relative cursor-pointer">
            <span className="block text-base font-semibold text-gray-900 dark:text-white truncate">
              {periodLabel(period, day)}
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {isDay ? (isTodayView ? "Aujourd'hui" : "Toucher pour choisir une date") : atPresent ? "En cours" : "\u00a0"}
            </span>
            {isDay && <input
              type="date"
              aria-label="Choisir une date"
              value={toDateString(day)}
              max={toDateString(new Date())}
              onChange={(e) => e.target.value && onChangeDay(new Date(`${e.target.value}T12:00:00`))}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />}
          </label>
          <button
            type="button"
            aria-label={isDay ? "Jour suivant" : "Période suivante"}
            disabled={atPresent}
            onClick={() => onChangeDay(shiftPeriod(period, day, 1))}
            className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center flex-shrink-0 disabled:text-gray-300 dark:disabled:text-gray-600"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <PeriodTabs period={period} onChange={onChangePeriod} />

        {/* Fraîcheur des données */}
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <span className={cx("w-2 h-2 rounded-full flex-shrink-0", lastReceived ? "bg-green-600" : "bg-gray-400")} />
          <span className="flex-1 min-w-0 truncate">
            {!isDay && attendanceLoading
              ? "Chargement…"
              : !isDay
              ? `${plural(totalPeople, "personne", "personnes")}, du plus assidu au moins assidu`
              : lastTodayTs
                ? isTodayView
                  ? `À jour · reçu à ${fmtTime(lastTodayTs)}`
                  : `${plural(entries.length, "passage", "passages")} ce jour-là`
                : "Aucun passage reçu pour l'instant"}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1 text-blue-700 dark:text-blue-400 font-semibold px-1 py-2"
          >
            <RefreshCw className={cx("w-4 h-4", loading && "animate-spin")} />
            Actualiser
          </button>
        </div>

        {/* Résumé */}
        <section
          aria-label="Résumé de la période"
            aria-busy={!isDay && attendanceLoading}
          className={cx("bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-4 transition-opacity", !isDay && attendanceLoading && "opacity-40")}
        >
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{totalPassages}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">passages</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{totalPeople}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">personnes</div>
            </div>
            <div className={totalToCheck ? "text-orange-700 dark:text-orange-400" : "text-gray-900 dark:text-white"}>
              <div className="text-2xl font-bold leading-none">{totalToCheck}</div>
              <div className="text-xs mt-1 font-semibold">à vérifier</div>
            </div>
          </div>
          {isDay && (<div>
            <div className="flex items-end gap-[3px] h-9">
              {hours.map(({ h, n }) => (
                <div
                  key={h}
                  title={`${h} h : ${plural(n, "passage", "passages")}`}
                  className={cx(
                    "flex-1 rounded-sm",
                    isTodayView && h === nowHour
                      ? "bg-blue-700"
                      : !isTodayView || h < nowHour
                        ? "bg-blue-300 dark:bg-blue-500/60"
                        : "bg-gray-200 dark:bg-gray-700"
                  )}
                  style={{ height: `${Math.max(3, (n / maxHour) * 36)}px` }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              <span>6 h</span>
              <span>12 h</span>
              <span>18 h</span>
              <span>23 h</span>
            </div>
          </div>)}
        </section>

        {/* Filtres */}
        <div role="group" aria-label="Filtrer les passages" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const n = countFor(f.id);
            const on = f.id === filter;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f.id)}
                className={cx(
                  "h-10 px-3.5 rounded-full text-sm font-semibold border",
                  on
                    ? "bg-blue-700 border-blue-700 text-white"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                )}
              >
                {f.label} <span className="opacity-75">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!isDay && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <PeriodList rows={periodVisible} loading={attendanceLoading} selectedWho={null} onSelectRow={onSelectRow} />
        </div>
      )}

      {/* Fil des passages */}
      {isDay && (
      <div className="space-y-3">
        {loading && rows.length === 0 && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
            ))}
          </div>
        )}

        {groups.map((g) => (
          <section key={g.hour} className="space-y-1.5">
            <h2 className="mx-1 text-sm font-semibold text-gray-500 dark:text-gray-400 flex justify-between">
              <span>{String(g.hour).padStart(2, "0")} h</span>
              <span>{plural(g.rows.length, "passage", "passages")}</span>
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
              {g.rows.map((r) => {
                const clickable = r.kind !== "exit";
                return (
                  <div
                    key={r.presence_id}
                    {...(clickable ? keyboardClickable(() => onSelectRow(r)) : {})}
                    className={cx(
                      "w-full text-left flex items-center gap-3 px-3.5 py-2.5 min-h-[60px]",
                      clickable && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    )}
                  >
                    <PassageIdentity r={r} photos={photos} size={40} />
                    <span className="text-right flex-shrink-0">
                      <span className="block text-[15px] font-semibold tabular-nums text-gray-900 dark:text-white">
                        {fmtTime(r.ts)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {!loading && groups.length === 0 && (
          <div className="text-center py-8 px-4 text-sm text-gray-500 dark:text-gray-400">
            {rows.length === 0 ? "Aucun passage ce jour-là." : "Aucun passage pour ce filtre."}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
