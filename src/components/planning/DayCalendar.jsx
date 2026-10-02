// ===================================================================
// Planning — calendrier du mois pour choisir le jour (grand écran)
// -------------------------------------------------------------------
// Intensité de la case = nombre de passages comptés du jour
// (RPC existante get_attendance_by_day, jours à l'heure de Paris).
// ===================================================================

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { toDateString } from "../../utils/dateUtils";
import { plural } from "./planningData";

const cx = (...c) => c.filter(Boolean).join(" ");
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export default function DayCalendar({ day, onChangeDay }) {
  const [month, setMonth] = useState(() => new Date(day.getFullYear(), day.getMonth(), 1));
  const [counts, setCounts] = useState({});

  // Suivre le jour choisi ailleurs (flèches, Contrôle)
  useEffect(() => {
    setMonth((m) =>
      m.getFullYear() === day.getFullYear() && m.getMonth() === day.getMonth()
        ? m
        : new Date(day.getFullYear(), day.getMonth(), 1)
    );
  }, [day]);

  useEffect(() => {
    let cancelled = false;
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
    supabase
      .rpc("get_attendance_by_day", { p_start: month.toISOString(), p_end: end.toISOString() })
      .then(({ data }) => {
        if (cancelled) return;
        const map = {};
        (data || []).forEach((r) => {
          map[String(r.day).slice(0, 10)] = Number(r.count) || 0;
        });
        setCounts(map);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const y = month.getFullYear();
  const mo = month.getMonth();
  const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
  const nbDays = new Date(y, mo + 1, 0).getDate();
  const todayKey = toDateString(new Date());
  const selKey = toDateString(day);
  const max = Math.max(1, ...Object.values(counts));
  const isCurrentMonth = y === new Date().getFullYear() && mo === new Date().getMonth();

  return (
    <section className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Mois précédent"
          onClick={() => setMonth(new Date(y, mo - 1, 1))}
          className="w-9 h-9 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">
          {MONTHS[mo]} {y}
        </h2>
        <button
          type="button"
          aria-label="Mois suivant"
          disabled={isCurrentMonth}
          onClick={() => setMonth(new Date(y, mo + 1, 1))}
          className="w-9 h-9 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center disabled:text-gray-300 dark:disabled:text-gray-600 disabled:hover:bg-transparent"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400">
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }).map((_, i) => (
          <span key={`e${i}`} className="h-8" />
        ))}
        {Array.from({ length: nbDays }).map((_, i) => {
          const d = new Date(y, mo, i + 1);
          const k = toDateString(d);
          const n = counts[k] || 0;
          const future = k > todayKey;
          const on = k === selKey;
          return (
            <button
              key={k}
              type="button"
              disabled={future}
              title={future ? undefined : plural(n, "passage", "passages")}
              aria-label={`${i + 1} ${MONTHS[mo].toLowerCase()} : ${plural(n, "passage", "passages")}`}
              aria-pressed={on}
              onClick={() => onChangeDay(new Date(y, mo, i + 1, 12))}
              className={cx(
                "h-8 rounded-[10px] text-[13px] tabular-nums flex items-center justify-center",
                on
                  ? "bg-blue-700 text-white font-bold"
                  : future
                    ? "text-gray-300 dark:text-gray-600 cursor-default"
                    : n === 0
                      ? "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      : n / max > 0.6
                        ? "bg-blue-300 dark:bg-blue-500/70 text-gray-900 dark:text-white font-semibold hover:ring-2 hover:ring-blue-400"
                        : "bg-blue-100 dark:bg-blue-900/50 text-gray-900 dark:text-white hover:ring-2 hover:ring-blue-300",
                k === todayKey && !on && "ring-1 ring-blue-700"
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">Plus la case est foncée, plus il y a eu de passages.</p>
    </section>
  );
}
