import React from 'react';
import StatsReportGenerator from '../components/StatsReportGenerator';

const ReportsPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            📊 Rapports et Statistiques
          </h1>
          <p className="text-gray-600 mt-2">
            Générez des rapports PDF détaillés sur la fréquentation du club
          </p>
        </div>
        
        <StatsReportGenerator />
      </div>
    </div>
  );
};

export default ReportsPage;