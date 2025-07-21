import React, { useEffect, useState } from "react";
import { isAfter, isBefore, parseISO, isToday } from "date-fns";
import {
  FaUsers,
  FaUserCheck,
  FaUserTimes,
  FaMale,
  FaFemale,
  FaMoneyBillAlt,
} from "react-icons/fa";

import { supabase } from "../supabaseClient";

function HomePage() {
  const [stats, setStats] = useState({
    total: 0,
    actifs: 0,
    expirés: 0,
    hommes: 0,
    femmes: 0,
  });

  const [paiementsAttente, setPaiementsAttente] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      const { data: members, error } = await supabase.from("members").select("*");

      if (error) {
        console.error("Erreur chargement membres :", error.message);
        return;
      }

      const today = new Date();
      let actifs = 0;
      let expirés = 0;
      let hommes = 0;
      let femmes = 0;

      members.forEach((m) => {
        const end = m.endDate ? new Date(m.endDate) : null;
        if (end && isAfter(end, today)) {
          actifs++;
        } else {
          expirés++;
        }

        const genre = (m.gender || "").toLowerCase();
        if (genre === "homme" || genre === "h") {
          hommes++;
        } else if (genre === "femme" || genre === "f") {
          femmes++;
        }
      });

      setStats({
        total: members.length,
        actifs,
        expirés,
        hommes,
        femmes,
      });
    };

    const fetchPaiements = async () => {
      const { data: payments, error } = await supabase
        .from("payments")
        .select("*, members(name)")
        .eq("is_paid", false)
        .order("encaissement_prevu", { ascending: true });

      if (error) {
        console.error("Erreur chargement paiements :", error.message);
        return;
      }

      setPaiementsAttente(payments);
    };

    fetchStats();
    fetchPaiements();
  }, []);

  const cardStyle = "p-4 bg-white rounded-xl shadow flex items-center gap-4";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-blue-700">
        Bienvenue au Club de Musculation
      </h1>
      <p className="text-gray-700">
        Notre club vous accueille toute l'année avec des équipements modernes,
        des coachs certifiés, et une ambiance conviviale.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <div className={cardStyle}>
          <FaUsers className="text-4xl text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-blue-600">
              Nombre total de membres
            </h2>
            <p className="text-3xl font-bold">{stats.total}</p>
          </div>
        </div>

        <div className={cardStyle}>
          <FaUserCheck className="text-4xl text-green-600" />
          <div>
            <h2 className="text-lg font-semibold text-green-600">
              Inscriptions en cours
            </h2>
            <p className="text-3xl font-bold">{stats.actifs}</p>
          </div>
        </div>

        <div className={cardStyle}>
          <FaUserTimes className="text-4xl text-red-600" />
          <div>
            <h2 className="text-lg font-semibold text-red-600">
              Abonnements échus
            </h2>
            <p className="text-3xl font-bold">{stats.expirés}</p>
          </div>
        </div>

        <div className={cardStyle}>
          <FaMale className="text-4xl text-blue-500" />
          <div>
            <h2 className="text-lg font-semibold text-blue-500">
              Nombre d'hommes
            </h2>
            <p className="text-3xl font-bold">{stats.hommes}</p>
          </div>
        </div>

        <div className={cardStyle}>
          <FaFemale className="text-4xl text-pink-500" />
          <div>
            <h2 className="text-lg font-semibold text-pink-500">
              Nombre de femmes
            </h2>
            <p className="text-3xl font-bold">{stats.femmes}</p>
          </div>
        </div>
      </div>

      {/* Paiements à venir */}
      <div className="mt-8 bg-white p-6 rounded-xl shadow">
        <div className="flex items-center gap-3 mb-4">
          <FaMoneyBillAlt className="text-3xl text-orange-500" />
          <h2 className="text-xl font-bold text-orange-600">Paiements en attente</h2>
        </div>

        {paiementsAttente.length === 0 ? (
          <p className="text-gray-600 italic">Aucun paiement en attente</p>
        ) : (
          <ul className="space-y-2">
            {paiementsAttente.map((p) => {
              const date = p.encaissement_prevu ? new Date(p.encaissement_prevu) : null;
              const badge =
                date && (isToday(date) || isBefore(date, new Date())) ? (
                  <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-xs ml-2">
                    ⚠ Échéance !
                  </span>
                ) : null;

              return (
                <li key={p.id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <span className="font-semibold">{p.members?.name || "Membre"}</span> - {p.amount.toFixed(2)} € ({p.method})
                    {date && (
                      <span className="ml-2 text-sm text-gray-600">
                        Encaissement prévu :{" "}
                        {new Date(date).toLocaleDateString()}
                      </span>
                    )}
                    {badge}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default HomePage;
