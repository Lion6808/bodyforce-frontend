// src/pages/PlanningPage.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  format,
  isWithinInterval,
  isWeekend,
  eachDayOfInterval,
  startOfDay,
  endOfDay,
  parseISO,
  subWeeks,
  addWeeks,
  addMonths,
  addYears,
} from "date-fns";
import { fr } from "date-fns/locale";

const API = process.env.REACT_APP_API_URL;

function PlanningPage() {
  const [presences, setPresences] = useState([]);
  const [members, setMembers] = useState([]);
  const [period, setPeriod] = useState("week");
  const [startDate, setStartDate] = useState(startOfDay(subWeeks(new Date(), 1)));
  const [endDate, setEndDate] = useState(endOfDay(new Date()));
  const [filterBadge, setFilterBadge] = useState("");
  const [filterName, setFilterName] = useState("");
  const [showNightHours, setShowNightHours] = useState(false);
  const [role, setRole] = useState("");

  useEffect(() => {
    axios.get(`${API}/api/presences`).then((res) => {
      setPresences(Array.isArray(res.data) ? res.data : []);
    });
    axios.get(`${API}/api/members`).then((res) => {
      setMembers(Array.isArray(res.data) ? res.data : []);
    });
    const user = JSON.parse(localStorage.getItem("user"));
    if (user?.role) setRole(user.role);
  }, []);

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
    const d = parseISO(iso);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
  };

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
    console.log("Présences filtrées :", presences);
    console.log("Membres visibles :", visibleMembers);
  

  return (
    <div className="p-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
        <h1 className="text-2xl font-bold">Planning des présences</h1>
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={showNightHours}
              onChange={() => setShowNightHours(!showNightHours)}
            />
            Afficher 00h - 06h
          </label>
          {role === "admin" && (
          <button
            onClick={async () => {
              if (window.confirm("Importer les événements depuis Excel ?")) {
                try {
                  // Appel backend : import local via importExcelEntries.js
                  await axios.post(`${API}/api/import-events`);

                  // Rechargement des présences après import
                  const refreshed = await axios.get(`${API}/api/presences`);
                  setPresences(Array.isArray(refreshed.data) ? refreshed.data : []);

                  alert("Import terminé !");
                } catch (error) {
                  console.error("Erreur lors de l'import :", error);
                  alert("Erreur d'import !");
                }
              }
            }}
    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow text-sm"
  >
    Importer événements
  </button>
)}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select className="border rounded px-2 py-1" value={period} onChange={(e) => {
          const value = e.target.value;
          setPeriod(value);
          updateDateRange(value, startDate);
        }}>
          <option value="week">Semaine</option>
          <option value="month">Mois</option>
          <option value="year">Année</option>
        </select>
        <input type="date" value={format(startDate, "yyyy-MM-dd")} onChange={(e) => {
          const newStart = startOfDay(new Date(e.target.value));
          setStartDate(newStart);
          updateDateRange(period, newStart);
        }} className="border rounded px-2 py-1" />
        <input type="date" value={format(endDate, "yyyy-MM-dd")} onChange={(e) =>
          setEndDate(endOfDay(new Date(e.target.value)))
        } className="border rounded px-2 py-1" />
        <input type="text" placeholder="Badge" value={filterBadge} onChange={(e) => setFilterBadge(e.target.value)} className="border rounded px-2 py-1" />
        <input type="text" placeholder="Nom" value={filterName} onChange={(e) => setFilterName(e.target.value)} className="border rounded px-2 py-1" />
      </div>

      {visibleMembers.length === 0 && (
        <p className="text-gray-500 italic mt-4 text-center">Aucune présence sur cette période.</p>
      )}

      <div className="border max-h-[75vh] overflow-hidden">
  <div className="overflow-x-auto overflow-y-auto max-h-[75vh] w-full lg:max-w-[calc(100vw-360px)]">
    <div className="inline-block min-w-max">
      <div className="grid w-max" style={{ gridTemplateColumns: `200px repeat(${allDays.length * hours.length}, 40px)` }}>
        <div className="sticky top-0 left-0 bg-white z-20 h-12 border-b border-r flex items-center justify-center font-bold">
          Membres
        </div>
        {allDays.map((day, dIdx) =>
          hours.map((h, hIdx) => (
            <div
              key={`header-${dIdx}-${h}`}
              className={`text-[10px] border-b border-r flex flex-col items-center justify-center ${
                isWeekend(day) ? "bg-blue-100" : "bg-gray-100"
              }`}
            >
              {hIdx === 0 && <div className="font-semibold whitespace-nowrap">{format(day, "EEE dd/MM")}</div>}
              <div>{`${h.toString().padStart(2, "0")}:00`}</div>
            </div>
          ))
        )}
        {visibleMembers.map((member) => (
          <React.Fragment key={member.badgeId}>
            <div className="sticky left-0 bg-gray-100 z-10 px-2 py-1 border-r border-b h-14 flex items-center gap-2 whitespace-nowrap text-sm">
              {member.photo ? (
                <img src={member.photo} alt="avatar" className="w-10 h-10 object-cover rounded-full" />
              ) : (
                <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
              )}
              <div className="flex flex-col">
                <span>{member.name} {member.firstName}</span>
                <span className="text-xs text-gray-500">
                  {groupedByMember[member.badgeId]?.length || 0} présence(s)
                </span>
              </div>
            </div>
            {allDays.map((day) =>
              hours.map((h) => {
                const times = groupedByMember[member.badgeId] || [];
                const present = times.some((t) =>
                  t.getFullYear() === day.getFullYear() &&
                  t.getMonth() === day.getMonth() &&
                  t.getDate() === day.getDate() &&
                  t.getHours() === h
                );
                return (
                  <div
                    key={`${member.badgeId}-${day.toISOString()}-${h}`}
                    className={`h-14 border-b border-r relative group ${
                      present ? "bg-green-400 cursor-pointer" : isWeekend(day) ? "bg-blue-50" : "bg-white"
                    }`}
                  >
                    {present && (
                      <>
                        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center text-xs font-bold text-white">
                          ✓
                        </div>
                        <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-black text-white text-xs rounded-lg px-2 py-1 shadow-2xl animate-fade-in whitespace-nowrap">
                          {`${format(day, "EEEE dd/MM", { locale: fr })} à ${h}h — ${member.name} ${member.firstName}`}
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  </div>
</div>

    </div>
  );
}

export default PlanningPage;
