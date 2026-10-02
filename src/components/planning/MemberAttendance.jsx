// ===================================================================
// Planning — assiduité d'un membre
// -------------------------------------------------------------------
// Carte membre (4 indicateurs), calendrier du mois (toucher un jour =
// horaires de passage), habitudes sur 90 jours, derniers passages.
// Utilisé par la vue Membre (mobile et grand écran) et par le panneau
// de droite de la vue Aujourd'hui sur grand écran (compact).
// ===================================================================

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MemberIdentity from "../MemberIdentity";
import useMemberPhotos from "../../hooks/useMemberPhotos";
import { isMemberActive } from "../../utils/memberRules";
import { toDateString } from "../../utils/dateUtils";
import {
  addDays,
  computeAttendance,
  dayKey,
  fetchMemberLite,
  fetchMemberTimestamps,
  fmtDate,
  fmtDayLong,
  fmtRelative,
  fmtTime,
  plural,
  startOfLocalDay,
} from "./planningData";

const cx = (...c) => c.filter(Boolean).join(" ");
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function StatTile({ label, value, tone, small }) {
  return (
    <div className={cx("rounded-2xl p-3", tone.bg)}>
      <div className={cx("text-xs font-semibold", tone.text)}>{label}</div>
      <div className={cx("font-bold text-gray-900 dark:text-white mt-1", small ? "text-base" : "text-xl")}>{value}</div>
    </div>
  );
}

const TONES = {
  blue: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-300" },
  green: { bg: "bg-green-50 dark:bg-green-900/20", text: "text-green-700 dark:text-green-300" },
  gray: { bg: "bg-gray-50 dark:bg-gray-700/40", text: "text-gray-600 dark:text-gray-300" },
  purple: { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-300" },
};

export default function MemberAttendance({ memberId, compact = false }) {
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [timestamps, setTimestamps] = useState([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selDay, setSelDay] = useState(null);
  const [scope, setScope] = useState("month"); // "month" | "year"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Nouveau membre : mois courant, pas de jour choisi
  useEffect(() => {
    const d = new Date();
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelDay(null);
  }, [memberId]);

  // Fiche (sans photo : voir useMemberPhotos) — une fois par membre
  useEffect(() => {
    if (!memberId) return undefined;
    let cancelled = false;
    fetchMemberLite(memberId)
      .then((m) => !cancelled && setMember(m))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  // Présences : 90 derniers jours + mois affiché (horodatages seuls)
  useEffect(() => {
    if (!memberId) return undefined;
    let cancelled = false;
    const now = new Date();
    const rangeStart = scope === "year" ? new Date(month.getFullYear(), 0, 1) : month;
    const rangeEnd =
      scope === "year"
        ? new Date(month.getFullYear(), 11, 31, 23, 59, 59, 999)
        : new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
    const from = new Date(Math.min(startOfLocalDay(addDays(now, -89)).getTime(), rangeStart.getTime()));
    const to = new Date(Math.max(now.getTime(), rangeEnd.getTime()));

    setLoading(true);
    setError("");
    fetchMemberTimestamps(memberId, from, to)
      .then((ts) => !cancelled && setTimestamps(ts))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [memberId, month, scope]);

  const photos = useMemberPhotos([memberId]);

  const stats = useMemo(() => computeAttendance(timestamps, member), [timestamps, member]);

  // Horaires par jour
  const byDay = useMemo(() => {
    const map = {};
    [...timestamps].reverse().forEach((t) => {
      const k = dayKey(t);
      (map[k] = map[k] || []).push(t);
    });
    return map;
  }, [timestamps]);

  if (!memberId) return null;
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-4 text-sm text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }
  if (!member) {
    return <div className="h-64 rounded-3xl bg-gray-200 dark:bg-gray-700 animate-pulse" />;
  }

  const active = isMemberActive(member);
  const isAdh = (member.member_type || "adherent") === "adherent";
  const endKey = member.endDate ? String(member.endDate).slice(0, 10) : null;
  const status =
    member.member_type === "maintenance"
      ? "Maintenance · hors statistiques"
      : active
        ? `Actif · jusqu'au ${fmtDate(member.endDate)}`
        : member.endDate
          ? `Expiré le ${fmtDate(member.endDate)}`
          : "Sans date de fin";

  // Calendrier du mois (semaine commençant lundi)
  const y = month.getFullYear();
  const mo = month.getMonth();
  const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
  const nbDays = new Date(y, mo + 1, 0).getDate();
  const monthDays = [];
  for (let d = 1; d <= nbDays; d++) monthDays.push(toDateString(new Date(y, mo, d)));
  const isYear = scope === "year";
  const yearPrefix = `${y}-`;
  const cameKeys = isYear
    ? Object.keys(byDay).filter((k) => k.startsWith(yearPrefix)).sort()
    : monthDays.filter((k) => byDay[k]);
  const invalidKey = (k) => isAdh && (!endKey || k >= endKey);
  const sel = selDay && byDay[selDay] ? selDay : cameKeys[cameKeys.length - 1] || null;
  const selTimes = sel ? byDay[sel] : [];
  const isCurrentMonth = isYear
    ? y === new Date().getFullYear()
    : y === new Date().getFullYear() && mo === new Date().getMonth();
  const shift = (dir) => {
    setSelDay(null);
    setMonth(isYear ? new Date(y + dir, mo, 1) : new Date(y, mo + dir, 1));
  };

  const maxWeek = Math.max(1, ...stats.week);
  const recent = timestamps.slice(0, compact ? 4 : 6);

  const openFile = () =>
    navigate("/members/edit", {
      state: { member: { id: member.id }, returnPath: "/planning", memberId: member.id },
    });

  const header = (
    <MemberIdentity
      member={member}
      photo={photos[member.id] ?? null}
      size={56}
      subtitle={status}
      subtitleTone={active || !isAdh ? "muted" : "alert"}
    />
  );

  const tiles = (
    <div className="grid grid-cols-2 gap-2">
      <StatTile label="Venues (30 jours)" value={stats.days30} tone={TONES.blue} />
      <StatTile label="Moyenne" value={stats.avg} tone={TONES.green} />
      <StatTile label="Dernier passage" value={stats.last} tone={TONES.gray} small />
      <StatTile label="Régularité" value={stats.regularity} tone={TONES.purple} small />
    </div>
  );

  // Panneau de droite de la vue Aujourd'hui (grand écran)
  if (compact) {
    const todayKey = toDateString(new Date());
    const monday = startOfLocalDay(new Date());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - 21);
    const grid = Array.from({ length: 28 }).map((_, i) => {
      const k = toDateString(addDays(monday, i));
      return { k, times: byDay[k], future: k > todayKey };
    });
    return (
      <div
        className={cx(
          "bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-4",
          loading && "opacity-70 transition-opacity"
        )}
      >
        {header}
        {tiles}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Jours de venue (4 dernières semaines)</h3>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
            {WEEKDAYS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map(({ k, times, future }) => (
              <span
                key={k}
                title={
                  times
                    ? `${fmtDayLong(new Date(`${k}T12:00:00`))} : ${times.map(fmtTime).join(", ")}`
                    : fmtDayLong(new Date(`${k}T12:00:00`))
                }
                className={cx(
                  "h-[22px] rounded-md",
                  times
                    ? invalidKey(k)
                      ? "bg-orange-300"
                      : "bg-blue-600"
                    : future
                      ? "bg-transparent border border-dashed border-gray-200 dark:border-gray-700"
                      : "bg-gray-100 dark:bg-gray-700"
                )}
              />
            ))}
          </div>
        </div>
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Créneau habituel : <strong>{stats.slot}</strong>
        </div>
        <button
          type="button"
          onClick={openFile}
          className="w-full h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
        >
          Ouvrir la fiche complète
        </button>
      </div>
    );
  }

  return (
    <div
      className={cx(
        "grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-5 lg:items-start",
        loading && "opacity-70 transition-opacity"
      )}
    >
      {/* Carte membre */}
      <section className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3.5 lg:col-start-1 lg:row-start-1">
        {header}
        {tiles}
      </section>

      {/* Calendrier du mois */}
      <section className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 lg:p-5 space-y-2.5 lg:col-start-2 lg:row-start-1 lg:row-span-4">
        <div role="group" aria-label="Affichage du calendrier" className="grid grid-cols-2 gap-1 bg-gray-100 dark:bg-gray-700 rounded-2xl p-1">
          {[
            ["month", "Mois"],
            ["year", "Année"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={scope === id}
              onClick={() => {
                setSelDay(null);
                setScope(id);
              }}
              className={cx(
                "h-9 rounded-xl text-sm",
                scope === id
                  ? "bg-white dark:bg-gray-800 shadow-sm font-semibold text-gray-900 dark:text-white"
                  : "font-medium text-gray-600 dark:text-gray-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label={isYear ? "Année précédente" : "Mois précédent"}
            onClick={() => shift(-1)}
            className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white text-center">
            {isYear ? y : `${MONTHS[mo]} ${y}`}
            {isYear && (
              <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                {plural(cameKeys.length, "jour de venue", "jours de venue")}
              </span>
            )}
          </h3>
          <button
            type="button"
            aria-label={isYear ? "Année suivante" : "Mois suivant"}
            disabled={isCurrentMonth}
            onClick={() => shift(1)}
            className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center disabled:text-gray-300 dark:disabled:text-gray-600"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        {isYear && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
            {MONTHS.map((name, m) => {
              const mLead = (new Date(y, m, 1).getDay() + 6) % 7;
              const mDays = new Date(y, m + 1, 0).getDate();
              const nCame = Array.from({ length: mDays }).filter((_, i) => byDay[toDateString(new Date(y, m, i + 1))]).length;
              return (
                <div key={name}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{name}</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">{nCame || ""}</span>
                  </div>
                  <div className="grid grid-cols-7 gap-[2px]">
                    {Array.from({ length: mLead }).map((_, i) => (
                      <span key={`e${i}`} className="h-[18px]" />
                    ))}
                    {Array.from({ length: mDays }).map((_, i) => {
                      const k = toDateString(new Date(y, m, i + 1));
                      const times = byDay[k];
                      if (!times) {
                        return <span key={k} className="h-[18px] rounded-[4px] bg-gray-100 dark:bg-gray-700/60" />;
                      }
                      const invalid = invalidKey(k);
                      const title = `${fmtDayLong(new Date(`${k}T12:00:00`))} : ${times.map(fmtTime).join(", ")}${
                        invalid ? " (sans abonnement valide)" : ""
                      }`;
                      return (
                        <button
                          key={k}
                          type="button"
                          title={title}
                          aria-label={title}
                          aria-pressed={k === sel}
                          onClick={() => setSelDay(k)}
                          className={cx(
                            "h-[18px] rounded-[4px]",
                            invalid ? "bg-orange-300" : "bg-blue-600",
                            k === sel && "ring-2 ring-offset-1 ring-blue-900 dark:ring-blue-300 dark:ring-offset-gray-800"
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!isYear && (<>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
          {WEEKDAYS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: lead }).map((_, i) => (
            <span key={`e${i}`} className="h-9 lg:h-11" />
          ))}
          {monthDays.map((k, i) => {
            const times = byDay[k];
            const label = i + 1;
            if (!times) {
              return (
                <span
                  key={k}
                  className="h-9 lg:h-11 lg:w-11 lg:mx-auto rounded-xl flex items-center justify-center text-sm tabular-nums text-gray-700 dark:text-gray-300"
                >
                  {label}
                </span>
              );
            }
            const invalid = invalidKey(k);
            const on = k === sel;
            const title = `${fmtDayLong(new Date(`${k}T12:00:00`))} : ${times.map(fmtTime).join(", ")}${
              invalid ? " (sans abonnement valide)" : ""
            }`;
            return (
              <button
                key={k}
                type="button"
                title={title}
                aria-label={title}
                aria-pressed={on}
                onClick={() => setSelDay(k)}
                className={cx(
                  "h-9 lg:h-11 lg:w-11 lg:mx-auto rounded-xl flex items-center justify-center text-sm font-bold tabular-nums",
                  invalid
                    ? "bg-orange-200 text-orange-900 dark:bg-orange-800/60 dark:text-orange-100"
                    : "bg-blue-600 text-white",
                  on && "ring-2 ring-offset-2 ring-blue-900 dark:ring-blue-300 dark:ring-offset-gray-800"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        </>)}

        {/* Horaires du jour choisi */}
        {sel ? (
          <div role="status" aria-live="polite" className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 px-3.5 py-3 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-blue-950 dark:text-blue-100">
                {fmtDayLong(new Date(`${sel}T12:00:00`))}
              </span>
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                {plural(selTimes.length, "passage", "passages")}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selTimes.map((t) => (
                <span
                  key={t}
                  className="h-8 px-3 rounded-xl bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 inline-flex items-center text-[15px] font-bold tabular-nums text-gray-900 dark:text-white"
                >
                  {fmtTime(t)}
                </span>
              ))}
            </div>
            {invalidKey(sel) && (
              <span className="block text-xs font-semibold text-orange-800 dark:text-orange-300">
                Abonnement non valide ce jour-là
              </span>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {isYear ? "Aucun passage cette année." : "Aucun passage ce mois-ci."}
          </div>
        )}

        <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-blue-600" />
            Venu(e)
          </span>
          {isAdh && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-orange-200" />
              Sans abonnement valide
            </span>
          )}
          <span>Touchez un jour pour voir les horaires.</span>
        </div>
      </section>

      {/* Habitudes (90 jours) */}
      <section className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3 lg:col-start-1">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Habitudes (90 jours)</h3>
        <div className="grid grid-cols-7 gap-1.5 items-end h-[72px]">
          {stats.week.map((n, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-gray-600 dark:text-gray-400">{n || ""}</span>
              <span
                className={cx("w-full rounded-md", n ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700")}
                style={{ height: `${Math.max(4, (n / maxWeek) * 48)}px` }}
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
          {WEEKDAYS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Créneau habituel : <strong>{stats.slot}</strong>
        </div>
      </section>

      {/* Derniers passages */}
      <section className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm px-4 py-2 lg:col-start-1">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mt-2 mb-1">Derniers passages</h3>
        {recent.length === 0 && (
          <div className="py-3 text-sm text-gray-500 dark:text-gray-400">Aucun passage sur la période.</div>
        )}
        {recent.map((t) => (
          <div
            key={t}
            className="flex justify-between items-center min-h-[44px] border-t border-gray-100 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200"
          >
            <span>{fmtRelative(t).split(",")[0]}</span>
            <span className="font-semibold tabular-nums">{fmtTime(t)}</span>
          </div>
        ))}
      </section>

      <button
        type="button"
        onClick={openFile}
        className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-[15px] font-semibold lg:col-start-1"
      >
        Ouvrir la fiche complète
      </button>
    </div>
  );
}
