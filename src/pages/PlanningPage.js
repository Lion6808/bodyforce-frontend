// PlanningPage.js - Partie 1/6

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Calendar, Users, Filter, Grid, List, ChevronLeft, ChevronRight
} from "lucide-react";

// Initialise Supabase client
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

// Utilitaires de date
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
// PlanningPage.js - Partie 2/6

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

  // --- Charger les membres et présences depuis Supabase ---
  useEffect(() => {
    const fetchData = async () => {
      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("*");

      if (membersError) {
        console.error("Erreur chargement membres:", membersError);
        return;
      }
      setMembers(membersData);

      // Charger toutes les présences avec pagination
      let allPresences = [];
      let from = 0;
      const limit = 1000;
      while (true) {
        const { data: presencesBatch, error: presencesError } = await supabase
          .from("presences")
          .select("*")
          .order("timestamp", { ascending: true })
          .range(from, from + limit - 1);

        if (presencesError) {
          console.error("Erreur chargement présences:", presencesError);
          break;
        }

        allPresences = [...allPresences, ...presencesBatch];
        if (presencesBatch.length < limit) break;
        from += limit;
      }

      setPresences(allPresences);
    };

    fetchData();
  }, []);
// PlanningPage.js - Partie 3/6

  // --- Gestion de la période ---
  const updateDateRange = (value, base = new Date()) => {
    const start = startOfDay(base);
    let end = endOfDay(base);
    if (value === "week") end = endOfDay(addWeeks(start, 1));
    if (value === "month") end = endOfDay(addMonths(start, 1));
    if (value === "year") end = endOfDay(addYears(start, 1));
    setStartDate(start);
    setEndDate(end);
  };

  const toLocalDate = (iso) => {
    if (!iso) return new Date();
    const d = new Date(iso);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
  };

  // --- Filtrage des présences ---
  const filteredPresences = presences.filter((p) => {
    const d = toLocalDate(p.timestamp);
    return isWithinInterval(d, { start: startDate, end: endDate });
  });

  const groupedByMember = {};
  filteredPresences.forEach((p) => {
    const key = p.badgeId;
    if (!groupedByMember[key]) groupedByMember[key] = [];
    groupedByMember[key].push(toLocalDate(p.timestamp));
  });

  const allDays = eachDayOfInterval({ start: startDate, end: endDate });
  const fullHours = Array.from({ length: 24 }, (_, i) => i);
  const hours = showNightHours ? fullHours : fullHours.slice(6);

  const getMemberInfo = (badgeId) => members.find((m) => m.badgeId === badgeId) || {};

  const visibleMembers = Object.keys(groupedByMember)
    .map((badgeId) => getMemberInfo(badgeId))
    .filter(
      (m) =>
        (!filterName || `${m.name} ${m.firstName}`.toLowerCase().includes(filterName.toLowerCase())) &&
        (!filterBadge || m.badgeId?.includes(filterBadge))
    );
// PlanningPage.js - Partie 4/6

  // --- Gestion de la réactivité mobile ---
  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth < 640);
    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);
    return () => window.removeEventListener("resize", updateIsMobile);
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4 text-blue-700 flex items-center gap-2">
        <Calendar size={20} /> Planning des présences
      </h2>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <select
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value);
            updateDateRange(e.target.value, startDate);
          }}
          className="border p-2 rounded"
        >
          <option value="week">Semaine</option>
          <option value="month">Mois</option>
          <option value="year">Année</option>
        </select>

        <input
          type="date"
          value={formatDate(startDate, "yyyy-MM-dd")}
          onChange={(e) => {
            const d = new Date(e.target.value);
            updateDateRange(period, d);
          }}
          className="border p-2 rounded"
        />

        <button
          onClick={() => updateDateRange(period, subWeeks(startDate, 1))}
          className="bg-blue-100 px-2 py-1 rounded flex items-center"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => updateDateRange(period, addWeeks(startDate, 1))}
          className="bg-blue-100 px-2 py-1 rounded flex items-center"
        >
          <ChevronRight size={16} />
        </button>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="ml-auto bg-gray-100 px-3 py-1 rounded flex items-center gap-1 text-sm"
        >
          <Filter size={16} /> Filtres
        </button>
      </div>

      {showFilters && (
        <div className="mb-4 grid sm:grid-cols-3 gap-2">
          <input
            placeholder="Nom/Prénom"
            className="border p-2 rounded"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
          />
          <input
            placeholder="Badge ID"
            className="border p-2 rounded"
            value={filterBadge}
            onChange={(e) => setFilterBadge(e.target.value)}
          />
          <label className="flex gap-2 items-center">
            <input
              type="checkbox"
              checked={showNightHours}
              onChange={(e) => setShowNightHours(e.target.checked)}
            />
            Afficher la nuit
          </label>
        </div>
      )}
// PlanningPage.js - Partie 5/6

      <div className="flex justify-end gap-2 mb-2">
        <button
          onClick={() => setViewMode("list")}
          className={`px-3 py-1 rounded ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
        >
          <List size={16} />
        </button>
        <button
          onClick={() => setViewMode("grid")}
          className={`px-3 py-1 rounded ${viewMode === "grid" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
        >
          <Grid size={16} />
        </button>
      </div>

      {viewMode === "grid" ? (
        <div className="overflow-auto border rounded">
          <table className="min-w-full table-auto text-sm">
            <thead>
              <tr className="bg-blue-100">
                <th className="p-2 border">Nom</th>
                {allDays.map((day, i) => (
                  <th key={i} className={`p-2 border ${isWeekend(day) ? "bg-red-100" : ""}`}>
                    {formatDate(day, "EEE dd")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleMembers.map((member) => (
                <tr key={member.id}>
                  <td className="p-2 border whitespace-nowrap font-medium">
                    {member.name} {member.firstName}
                  </td>
                  {allDays.map((day, i) => {
                    const dayStart = startOfDay(day).getTime();
                    const dayEnd = endOfDay(day).getTime();
                    const hasPresence = groupedByMember[member.badgeId]?.some(
                      (ts) => ts.getTime() >= dayStart && ts.getTime() <= dayEnd
                    );
                    return (
                      <td
                        key={i}
                        className={`p-2 border text-center ${hasPresence ? "bg-green-200" : ""}`}
                      >
                        {hasPresence ? "✔️" : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleMembers.map((member) => (
            <div key={member.id} className="border rounded p-2">
              <h3 className="font-semibold text-blue-700">
                {member.name} {member.firstName} ({member.badgeId})
              </h3>
              <ul className="flex flex-wrap gap-2 mt-1 text-sm">
                {groupedByMember[member.badgeId]
                  ?.filter((ts) => isWithinInterval(ts, { start: startDate, end: endDate }))
                  .map((ts, i) => (
                    <li key={i} className="bg-green-100 px-2 py-1 rounded">
                      {formatDate(ts, "dd/MM/yyyy")} {formatDate(ts, "HH:mm")}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PlanningPage;
