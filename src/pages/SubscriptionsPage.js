import React from "react";

function SubscriptionsPage() {
  const abonnements = [
    { id: 1, membre: "Jean Dupont", type: "Mensuel", statut: "Actif" },
    { id: 2, membre: "Sophie Martin", type: "Annuel", statut: "Expiré" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-blue-700 mb-4">Abonnements</h1>
      <ul className="space-y-2">
        {abonnements.map((ab) => (
          <li key={ab.id} className="bg-white p-4 rounded shadow">
            <div className="font-semibold">{ab.membre}</div>
            <div>Type: {ab.type}</div>
            <div>Statut: {ab.statut}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SubscriptionsPage;
