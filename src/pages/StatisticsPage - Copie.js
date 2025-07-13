
import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaUser, FaClock, FaUsers, FaStar } from "react-icons/fa";
import { format, parseISO } from "date-fns";

export default function StatisticsPage() {
  const [members, setMembers] = useState([]);
  const [presences, setPresences] = useState([]);
  const [topMembers, setTopMembers] = useState([]);
  const [topHours, setTopHours] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [mRes, pRes] = await Promise.all([
          axios.get(`${process.env.REACT_APP_API_URL}/api/members`),
          axios.get(`${process.env.REACT_APP_API_URL}/api/presences`),
        ]);
        setMembers(Array.isArray(mRes.data) ? mRes.data : []);
        setPresences(Array.isArray(pRes.data) ? pRes.data : []);
      } catch (err) {
        console.error("Erreur lors du chargement des données :", err);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (members.length && presences.length) {
      const memberCount = {};
      const hourCount = {};

      for (const p of presences) {
        if (!p.timestamp || !p.badgeId) continue;

        const parsedDate = parseISO(p.timestamp);
        if (isNaN(parsedDate)) {
          console.warn("Date invalide ignorée :", p.timestamp);
          continue;
        }

        const hour = format(parsedDate, "HH");
        const member = members.find((m) => m.badgeId === p.badgeId);
        if (!member) continue;

        memberCount[member.id] = (memberCount[member.id] || { ...member, count: 0 });
        memberCount[member.id].count += 1;

        hourCount[hour] = (hourCount[hour] || 0) + 1;
      }

      const top10Members = Object.values(memberCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const top5Hours = Object.entries(hourCount)
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setTopMembers(top10Members);
      setTopHours(top5Hours);
    }
  }, [members, presences]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-6 text-blue-700">Statistiques de fréquentation</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white shadow rounded p-4 flex items-center gap-4">
          <FaUsers className="text-green-500 text-3xl" />
          <div>
            <div className="text-sm text-gray-500">Total Membres</div>
            <div className="text-xl font-bold">{members.length}</div>
          </div>
        </div>
        <div className="bg-white shadow rounded p-4 flex items-center gap-4">
          <FaClock className="text-yellow-500 text-3xl" />
          <div>
            <div className="text-sm text-gray-500">Présences enregistrées</div>
            <div className="text-xl font-bold">{presences.length}</div>
          </div>
        </div>
        <div className="bg-white shadow rounded p-4 flex items-center gap-4">
          <FaStar className="text-purple-500 text-3xl" />
          <div>
            <div className="text-sm text-gray-500">Top membres</div>
            <div className="text-xl font-bold">{topMembers.length}</div>
          </div>
        </div>
        <div className="bg-white shadow rounded p-4 flex items-center gap-4">
          <FaClock className="text-blue-500 text-3xl" />
          <div>
            <div className="text-sm text-gray-500">Plages horaires populaires</div>
            <div className="text-xl font-bold">{topHours.length}</div>
          </div>
        </div>
      </div>

      {/* Liste des top membres */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Top 10 membres les plus présents</h3>
        <ul className="bg-white shadow rounded p-4">
          {topMembers.length > 0 ? (
            topMembers.map((m, index) => {
              const medalIcons = [
                <span key="gold" title="1er" className="text-yellow-500 text-xl">🥇</span>,
                <span key="silver" title="2ème" className="text-gray-400 text-xl">🥈</span>,
                <span key="bronze" title="3ème" className="text-orange-500 text-xl">🥉</span>
              ];
              return (
                <li key={m.id} className="flex justify-between border-b py-1 items-center">
                  <span className="flex items-center gap-2">
                    {index < 3 && medalIcons[index]}
                    {m.prenom || m.firstName || "?"} {m.nom || m.name || ""}
                  </span>
                  <span className="text-gray-600">{m.count} passages</span>
                </li>
              );
            })
          ) : (
            <li className="text-gray-500">Aucune donnée disponible</li>
          )}
        </ul>
      </div>

      {/* Liste des plages horaires */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Plages horaires les plus fréquentées</h3>
        <ul className="bg-white shadow rounded p-4">
          {topHours.length > 0 ? (
            topHours.map((h, idx) => (
              <li key={idx} className="flex justify-between border-b py-1">
                <span>{h.hour}h</span>
                <span className="text-gray-600">{h.count} passages</span>
              </li>
            ))
          ) : (
            <li className="text-gray-500">Aucune donnée disponible</li>
          )}
        </ul>
      </div>
    </div>
  );
}
