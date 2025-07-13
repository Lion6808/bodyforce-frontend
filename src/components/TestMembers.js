// src/components/TestMembers.js
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function TestMembers() {
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*');

      if (error) {
        setError(error.message);
        console.error('Erreur Supabase:', error.message);
      } else {
        setMembers(data);
      }
    };

    fetchMembers();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Liste des membres (Supabase)</h2>
      {error && <p className="text-red-600">Erreur : {error}</p>}
      <ul className="list-disc ml-6">
        {members.map((m) => (
          <li key={m.id}>
            {m.prenom} {m.nom} — {m.abonnement}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TestMembers;
