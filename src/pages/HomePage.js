import React, { useEffect, useState } from "react";
import { isAfter, parseISO, format } from "date-fns";
import {
  FaUsers,
  FaUserCheck,
  FaUserTimes,
  FaMale,
  FaFemale,
  FaMoneyCheckAlt,
} from "react-icons/fa";

import { supabase } from "../supabaseClient";

function HomePage() {
  const [stats, setStats] = useState({
    total: 0,
    actifs: 0,
    expirés: 0,
    hommes: 0,
    femmes: 0,
    membresExpirés: [],
  });

  const [pendingPayments, setPendingPayments] = useState([]);
  const [showPayments, setShowPayments] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      const { data: members, error } = await supabase.from("members").select("*");
      if (error) return;

      const today = new Date();
      let actifs = 0;
      let expirés = 0;
      let hommes = 0;
      let femmes = 0;
      let membresExpirés = [];

      members.forEach((m) => {
        let end;
        try {
          end = typeof m.endDate === "string"
            ? m.endDate.includes("/") 
              ? parseISO(m.endDate.split("/").reverse().join("-"))
              : new Date(m.endDate)
            : m.endDate;
        } catch {
          end = null;
        }

        if (end && isAfter(end, today)) {
          actifs++;
        } else {
          expirés++;
          membresExpirés.push({ name: m.name, firstName: m.firstName });
        }

        const genre = (m.gender || "").toLowerCase();
        if (genre === "homme" || genre === "h") hommes++;
        else if (genre === "femme" || genre === "f") femmes++;
      });

      setStats({ total: members.length, actifs, expirés, hommes, femmes, membresExpirés });
    };

    const fetchPayments = async () => {
      const { data: payments, error } = await supabase
        .from("payments")
        .select("*, member:member_id (name, firstName)")
        .order("encaissement_prevu", { ascending: true });

      if (error) return;

      const today = new Date();
      const filtered = payments.filter(
        (p) => !p.is_paid || (p.encaissement_prevu && new Date(p.encaissement_prevu) >= today)
      );

      setPendingPayments(filtered);
    };

    fetchStats();
    fetchPayments();
  }, []);

  const cardStyle = "p-4 bg-white rounded-xl shadow flex items-center gap-4";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-blue-700">Bienvenue au Club de Musculation</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <div className={cardStyle}>
          <FaUsers className="text-4xl text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-blue-600">Nombre total de membres</h2>
            <p className="text-3xl font-bold">{stats.total}</p>
          </div>
        </div>

        <div className={cardStyle}>
          <FaUserCheck className="text-4xl text-green-600" />
          <div>
            <h2 className="text-lg font-semibold text-green-600">Inscriptions en cours</h2>
            <p className="text-3xl font-bold">{stats.actifs}</p>
          </div>
        </div>

        <div className={cardStyle}>
          <FaUserTimes className="text-4xl text-red-600" />
          <div>
            <h2 className="text-lg font-semibold text-red-600">Abonnements échus</h2>
            <p className="text-3xl font-bold">{stats.expirés}</p>
            {stats.membresExpirés.length > 0 && (
              <ul className="mt-2 list-disc list-inside text-sm text-gray-700 max-h-24 overflow-y-auto">
                {stats.membresExpirés.slice(0, 5).map((m, i) => (
                  <li key={i}>{m.firstName} {m.name}</li>
                ))}
                {stats.membresExpirés.length > 5 && (
                  <li className="italic text-gray-500">et {stats.membresExpirés.length - 5} autres…</li>
                )}
              </ul>
            )}
          </div>
        </div>

        <div className={cardStyle}>
          <FaMale className="text-4xl text-blue-500" />
          <div>
            <h2 className="text-lg font-semibold text-blue-500">Nombre d'hommes</h2>
            <p className="text-3xl font-bold">{stats.hommes}</p>
          </div>
        </div>

        <div className={cardStyle}>
          <FaFemale className="text-4xl text-pink-500" />
          <div>
            <h2 className="text-lg font-semibold text-pink-500">Nombre de femmes</h2>
            <p className="text-3xl font-bold">{stats.femmes}</p>
          </div>
        </div>

        <div className={`${cardStyle} col-span-1 sm:col-span-2 lg:col-span-1`}>
          <FaMoneyCheckAlt className="text-4xl text-yellow-600" />
          <div className="w-full">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-yellow-600">Paiements en attente</h2>
              <button
                onClick={() => setShowPayments(!showPayments)}
                className="text-sm text-blue-500 underline"
              >
                {showPayments ? "Masquer" : "Voir"}
              </button>
            </div>
            <p className="text-3xl font-bold">{pendingPayments.length}</p>

            {showPayments && (
              <ul className="mt-2 text-sm max-h-32 overflow-y-auto divide-y">
                {pendingPayments.map((p) => {
                  const overdue =
                    p.encaissement_prevu &&
                    new Date(p.encaissement_prevu).toDateString() <= new Date().toDateString();

                  return (
                    <li key={p.id} className="py-1 flex justify-between items-center">
                      <div>
                        {p.member?.firstName} {p.member?.name} – {p.amount.toFixed(2)} €
                        {p.encaissement_prevu && (
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded ${overdue ? "bg-red-500 text-white" : "bg-gray-200 text-gray-800"}`}>
                            {format(new Date(p.encaissement_prevu), "dd/MM/yyyy")}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
