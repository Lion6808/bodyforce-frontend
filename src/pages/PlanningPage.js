import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Calendar,
  Users,
  Filter,
  Grid,
  List,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

// Initialise Supabase
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

// Fonctions utilitaires (inchangées)
const formatDate = (date, format) => {
  const options = {
    'yyyy-MM-dd': { year: 'numeric', month: '2-digit', day: '2-digit' },
    'dd/MM/yyyy': { day: '2-digit', month: '2-digit', year: 'numeric' },
    'EEE dd/MM': { weekday: 'short', day: '2-digit', month: '2-digit' },
    'EEE dd': { weekday: 'short', day: '2-digit' },
    'HH:mm': { hour: '2-digit', minute: '2-digit', hour12: false },
  };
  if (format === 'yyyy-MM-dd') return date.toISOString().split('T')[0];
  return new Intl.DateTimeFormat('fr-FR', options[format] || {}).format(date);
};

const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const isWithinInterval = (date, interval) => {
  return date >= interval.start && date <= interval.end;
};

const eachDayOfInterval = (interval) => {
  const days = [];
  const current = new Date(interval.start);
  while (current <= interval.end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
};

const startOfDay = (date) => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

const endOfDay = (date) => {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

const addWeeks = (date, weeks) => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + (weeks * 7));
  return newDate;
};

const addMonths = (date, months) => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
};

const addYears = (date, years) => {
  const newDate = new Date(date);
  newDate.setFullYear(newDate.getFullYear() + years);
  return newDate;
};

const subWeeks = (date, weeks) => addWeeks(date, -weeks);

// Début du composant
function PlanningPage() {
  const [presences, setPresences] = useState([]);
  const [members, setMembers] = useState([]);
  const [period, setPeriod] = useState("week");
  const [startDate, setStartDate] = useState(startOfDay(subWeeks(new Date(), 1)));
  const [endDate, setEndDate] = useState(endOfDay(new Date()));
  const [filterBadge, setFilterBadge] = useState("");
  const [filterName, setFilterName] = useState("");
  const [showNightHours, setShowNightHours] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Chargement depuis Supabase
  useEffect(() => {
    const fetchData = async () => {
      const { data: membersData } = await supabase.from("members").select("*");
      const { data: presencesData } = await supabase.from("presences").select("*");

      setMembers(membersData || []);
      setPresences(
        (presencesData || []).map((p) => ({
          badgeId: p.badgeId,
          timestamp: p.timestamp,
        }))
      );
    };

    fetchData();
  }, []);

  // Détection mobile
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      if (width < 768) setViewMode("list");
      else if (width < 1200) setViewMode("compact");
      else setViewMode("grid");
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const daysInRange = eachDayOfInterval({ start: startDate, end: endDate });

  // Génération des présences filtrées
  const filteredMembers = members.filter((member) => {
    const fullName = `${(member.firstName || "").toLowerCase()} ${(member.name || "").toLowerCase()}`;
    const badgeMatch = filterBadge === "" || member.badgeId?.toLowerCase().includes(filterBadge.toLowerCase());
    const nameMatch = filterName === "" || fullName.includes(filterName.toLowerCase());
    return badgeMatch && nameMatch;
  });

  const getPresencesForMemberAndDay = (badgeId, day) => {
    return presences.filter(
      (p) =>
        p.badgeId === badgeId &&
        isWithinInterval(new Date(p.timestamp), {
          start: startOfDay(day),
          end: endOfDay(day),
        })
    );
  };

  const groupByDay = (list) => {
    const map = new Map();
    for (const p of list) {
      const d = formatDate(new Date(p.timestamp), "yyyy-MM-dd");
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(p);
    }
    return map;
  };
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h1 className="text-xl font-bold text-blue-700 flex items-center gap-2">
          <Calendar /> Planning des présences
        </h1>

        <div className="ml-auto flex gap-2">
          <button
            className="text-sm px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="inline w-4 h-4 mr-1" /> Filtres
          </button>
          <button
            className="text-sm px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
            onClick={() =>
              setViewMode((v) =>
                v === "list" ? "compact" : v === "compact" ? "grid" : "list"
              )
            }
          >
            {viewMode === "list" && <List className="inline w-4 h-4" />}
            {viewMode === "compact" && <Grid className="inline w-4 h-4" />}
            {viewMode === "grid" && <Users className="inline w-4 h-4" />}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-blue-50 p-4 rounded mb-4">
          <input
            type="text"
            placeholder="Filtrer par nom ou prénom"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="border p-2 rounded w-full"
          />
          <input
            type="text"
            placeholder="Filtrer par badge"
            value={filterBadge}
            onChange={(e) => setFilterBadge(e.target.value)}
            className="border p-2 rounded w-full"
          />
          <select
            value={period}
            onChange={(e) => {
              const p = e.target.value;
              setPeriod(p);
              const now = new Date();
              if (p === "week") {
                setStartDate(startOfDay(subWeeks(now, 1)));
                setEndDate(endOfDay(now));
              } else if (p === "month") {
                setStartDate(startOfDay(addMonths(now, -1)));
                setEndDate(endOfDay(now));
              } else if (p === "year") {
                setStartDate(startOfDay(addYears(now, -1)));
                setEndDate(endOfDay(now));
              }
            }}
            className="border p-2 rounded w-full"
          >
            <option value="week">Semaine</option>
            <option value="month">Mois</option>
            <option value="year">Année</option>
          </select>
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => {
            const factor = period === "month" ? 1 : period === "year" ? 12 : 1;
            setStartDate(addWeeks(startDate, -factor * 1));
            setEndDate(addWeeks(endDate, -factor * 1));
          }}
          className="text-sm px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
        >
          <ChevronLeft className="inline w-4 h-4" /> Précédent
        </button>

        <div className="text-sm font-medium text-gray-600">
          Du {formatDate(startDate, "dd/MM/yyyy")} au {formatDate(endDate, "dd/MM/yyyy")}
        </div>

        <button
          onClick={() => {
            const factor = period === "month" ? 1 : period === "year" ? 12 : 1;
            setStartDate(addWeeks(startDate, factor * 1));
            setEndDate(addWeeks(endDate, factor * 1));
          }}
          className="text-sm px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
        >
          Suivant <ChevronRight className="inline w-4 h-4" />
        </button>
      </div>

      <div className="overflow-x-auto mt-4">
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-blue-100">
              <th className="border px-2 py-1 text-left">Nom</th>
              {daysInRange.map((day) => (
                <th
                  key={day.toDateString()}
                  className={`border px-2 py-1 ${isWeekend(day) ? "bg-blue-50" : ""}`}
                >
                  {formatDate(day, "EEE dd/MM")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((member) => (
              <tr key={member.id}>
                <td className="border px-2 py-1 whitespace-nowrap font-semibold">
                  {member.firstName} {member.name}
                </td>
                {daysInRange.map((day) => {
                  const presence = getPresencesForMemberAndDay(member.badgeId, day);
                  return (
                    <td
                      key={day.toDateString()}
                      className={`border px-2 py-1 text-center ${
                        presence.length > 0 ? "bg-green-100" : ""
                      }`}
                    >
                      {presence.length > 0 &&
                        presence
                          .map((p) => formatDate(new Date(p.timestamp), "HH:mm"))
                          .join(", ")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PlanningPage;
