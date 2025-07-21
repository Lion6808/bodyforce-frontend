import React, { useEffect, useState } from "react";
import { isAfter, isBefore, isToday, parseISO } from "date-fns";
import {
  FaUsers,
  FaUserCheck,
  FaUserTimes,
  FaMale,
  FaFemale,
  FaMoneyBillWave,
  FaCalendarAlt,
} from "react-icons/fa";
import { supabase } from "../supabaseClient";

function HomePage() {
  const [stats, setStats] = useState({
    total: 0,
    actifs: 0,
    expirés: 0,
    hommes: 0,
    femmes: 0,
    expirésNoms: [],
  });

  const [paiementsNonPayés, setPaiementsNonPayés] = useState([]);
  const [paiementsAVenir, setPaiementsAVenir] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      const { data: members, error } = await supabase.from("members").select("*");

      if (error) {
        console.error("Erreur chargement membres:", error.message);
        return;
      }

      const today = new Date();
      let actifs = 0;
      let expirés = 0;
      let hommes = 0;
      let femmes = 0;
      let expirésNoms = [];

      members.forEach((m) => {
        const end = m.endDate ? new Date(m.endDate) : null;
        if (end && isAfter(end, today)) {
          actifs++;
        } else {
          expirés++;
          if (expirésNoms.length < 5) {
            expirésNoms.push(`${m.firstName} ${m.name}`);
          }
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
        expirésNoms,
        autresExpirés: expirés - expirésNoms.length,
      });
    };

    const fetchPaiements = async () => {
      const { data, error } = await supabase.from("payments").select("*");

      if (error) {
        console.error("Erreur chargement paiements:", error.message);
        return;
      }

      const today = new Date();

      const nonPayés = data.filter((p) => !p.is_paid);
      const àVenir = data.filter(
        (p) => p.encaissement_prevu && isAfter(parseISO(p.encaissement_prevu), today)
      );

      setPaiementsNonPayés(nonPayés);
      setPaiementsAVenir(àVenir);
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
            <ul className="text-sm mt-2 text-gray-700 list-disc list-inside">
              {stats.expirésNoms.map((nom, i) => (
                <li key={i}>{nom}</li>
              ))}
              {stats.autresExpirés > 0 && (
                <li className="italic">et {stats.autresExpirés} autres...</li>
              )}
            </ul>
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

        <div className={cardStyle}>
          <FaMoneyBillWave className="text-4xl text-orange-500" />
          <div>
            <h2 className="text-lg font-semibold text-orange-500">Paiements non encaissés</h2>
            <p className="text-3xl font-bold">{paiementsNonPayés.length}</p>
          </div>
        </div>

        <div className={cardStyle}>
          <FaCalendarAlt className="text-4xl text-purple-600" />
          <div>
            <h2 className="text-lg font-semibold text-purple-600">Encaissements à venir</h2>
            <p className="text-3xl font-bold">{paiementsAVenir.length}</p>
            <ul className="text-sm mt-2 text-gray-700 list-disc list-inside max-h-32 overflow-y-auto">
              {paiementsAVenir.slice(0, 5).map((p) => {
                const date = parseISO(p.encaissement_prevu);
                const badge =
                  isToday(date) || isBefore(date, new Date()) ? (
                    <span className="text-red-600 font-bold ml-2">⚠</span>
                  ) : null;

                return (
                  <li key={p.id}>
                    {new Date(date).toLocaleDateString()}
                    {badge}
                  </li>
                );
              })}
              {paiementsAVenir.length > 5 && (
                <li className="italic">et {paiementsAVenir.length - 5} autres...</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
