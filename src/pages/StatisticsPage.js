import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  FaUser, FaClock, FaUsers, FaStar, FaExclamationTriangle
} from "react-icons/fa";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';

// Initialise Supabase client
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

export default function StatisticsPage() {
  const [members, setMembers] = useState([]);
  const [presences, setPresences] = useState([]);
  const [topMembers, setTopMembers] = useState([]);
  const [topHours, setTopHours] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("*");

      const { data: presencesData, error: presencesError } = await supabase
        .from("presences")
        .select("*")
        .limit(500000); // ou .range(0, 9999)

      if (membersError || presencesError) {
        console.error("Erreur chargement Supabase :", membersError || presencesError);
        return;
      }

      setMembers(Array.isArray(membersData) ? membersData : []);
      setPresences(Array.isArray(presencesData) ? presencesData : []);
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (members.length && presences.length) {
      const memberCount = {};
      const hourCount = {};

      for (const p of presences) {
        if (!p.timestamp || !p.badgeId) continue;

        const parsedDate = new Date(p.timestamp);
        if (isNaN(parsedDate)) continue;

        const hour = parsedDate.getHours(); // valeur de 0 à 23
        const member = members.find((m) => m.badgeId === p.badgeId);
        if (!member) continue;

        if (!memberCount[member.badgeId]) {
          memberCount[member.badgeId] = { ...member, count: 0 };
        }
        memberCount[member.badgeId].count += 1;


        hourCount[hour] = (hourCount[hour] || 0) + 1;
      }

      setTopMembers(
        Object.values(memberCount)
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      );


      setTopHours(
        Object.entries(hourCount)
          .map(([hour, count]) => ({ hour: `${hour}h`, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      );
    }
  }, [members, presences]);

  const abonnementsExpirés = members.filter(
    (m) => m.endDate && new Date(m.endDate) < new Date()
  );

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-6 text-blue-700">Statistiques de fréquentation</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<FaUsers className="text-green-500 text-3xl" />} label="Total Membres" value={members.length} />
        <StatCard icon={<FaClock className="text-yellow-500 text-3xl" />} label="Présences enregistrées" value={presences.length} />
        <StatCard icon={<FaStar className="text-purple-500 text-3xl" />} label="Top membres" value={topMembers.length} />
        <StatCard icon={<FaClock className="text-blue-500 text-3xl" />} label="Plages horaires populaires" value={topHours.length} />
      </div>

      <Section title="Top 10 membres les plus présents">
        {topMembers.length > 0 ? (
          <ul>
            {topMembers.map((m, index) => (
              <li key={m.id} className="flex justify-between border-b py-1 items-center">
                <span className="flex items-center gap-2">
                  {index === 0 && "🥇"} {index === 1 && "🥈"} {index === 2 && "🥉"}
                  {m.firstName} {m.name}
                </span>
                <span className="text-gray-600">{m.count} passages</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">Aucune donnée disponible</p>
        )}
      </Section>

      <Section title="Plages horaires les plus fréquentées">
        {topHours.length > 0 ? (
          <ul>
            {topHours.map((h, idx) => (
              <li key={idx} className="flex justify-between border-b py-1">
                <span>{h.hour}</span>
                <span className="text-gray-600">{h.count} passages</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">Aucune donnée disponible</p>
        )}
      </Section>

      <Section title="Présences par heure">
        {topHours.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topHours}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3182ce" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500">Aucune donnée disponible</p>
        )}
      </Section>

      <Section title="Abonnements expirés" icon={<FaExclamationTriangle className="text-red-600" />}>
        {abonnementsExpirés.length > 0 ? (
          <ul>
            {abonnementsExpirés.map((m) => (
              <li key={m.id} className="flex justify-between border-b py-1">
                <span>{m.firstName} {m.name}</span>
                <span className="text-gray-600">Fin : {m.endDate}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">Aucun abonnement expiré</p>
        )}
      </Section>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-white shadow rounded p-4 flex items-center gap-4">
      {icon}
      <div>
        <div className="text-sm text-gray-500">{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        {icon} {title}
      </h3>
      <div className="bg-white shadow rounded p-4">{children}</div>
    </div>
  );
}
