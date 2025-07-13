import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { isAfter } from "date-fns";
import {
  FaUsers,
  FaUserCheck,
  FaUserTimes,
  FaMale,
  FaFemale,
} from "react-icons/fa";

// Initialise Supabase client
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

function HomePage() {
  const [stats, setStats] = useState({
    total: 0,
    actifs: 0,
    expirés: 0,
    hommes: 0,
    femmes: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const { data: members, error } = await supabase.from("members").select("*");

      if (error) {
        console.error("Erreur de chargement Supabase :", error.message);
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

    fetchStats();
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
    </div>
  );
}

export default HomePage;
