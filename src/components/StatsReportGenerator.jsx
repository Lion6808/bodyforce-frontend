import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Chart } from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';

const StatsReportGenerator = () => {
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateChartImage = (type, labels, data, title) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = type === 'horizontalBar' ? 600 : 400;
      const ctx = canvas.getContext('2d');
      
      const chart = new Chart(ctx, {
        type: type === 'horizontalBar' ? 'bar' : type,
        data: {
          labels: labels,
          datasets: [{
            label: title,
            data: data,
            backgroundColor: type === 'pie' ? 
              ['#3498DB', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C'] : '#3498DB',
            borderColor: '#2C3E50',
            borderWidth: 1
          }]
        },
        options: {
          indexAxis: type === 'horizontalBar' ? 'y' : 'x',
          responsive: false,
          plugins: {
            title: { display: true, text: title, font: { size: 16, weight: 'bold' } },
            legend: { display: type === 'pie', position: 'bottom' },
            datalabels: {
              anchor: type === 'horizontalBar' ? 'end' : 'end',
              align: type === 'horizontalBar' ? 'end' : 'top',
              formatter: (value) => value,
              font: { weight: 'bold', size: 11 },
              color: '#000'
            }
          },
          scales: type !== 'pie' ? {
            x: type === 'horizontalBar' ? { beginAtZero: true } : {},
            y: type !== 'horizontalBar' ? { beginAtZero: true } : {}
          } : {}
        },
        plugins: [ChartDataLabels]
      });

      setTimeout(() => {
        const imgData = canvas.toDataURL('image/png');
        chart.destroy();
        resolve(imgData);
      }, 100);
    });
  };

  const generatePDF = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: stats, error: rpcError } = await supabase.rpc('generate_stats_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (rpcError) throw rpcError;
      if (!stats || stats.length === 0) throw new Error('Aucune donnee recuperee');

      const statsData = stats[0];

      const { data: allMembers, error: membersError } = await supabase.rpc('get_all_members_presences', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (membersError) console.error('Erreur membres:', membersError);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 20;

      // PAGE DE GARDE
      doc.setFontSize(28);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(44, 62, 80);
      doc.text('BODYFORCE', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 15;
      doc.setFontSize(18);
      doc.text('Rapport Statistique de Frequentation', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 20;
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Periode : ${startDate} au ${endDate}`, pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 10;
      const dateGeneration = new Date().toLocaleDateString('fr-FR', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      doc.text(`Genere le : ${dateGeneration}`, pageWidth / 2, yPos, { align: 'center' });

      // VUE D'ENSEMBLE
      doc.addPage();
      yPos = 20;
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(52, 152, 219);
      doc.text('VUE D\'ENSEMBLE', 20, yPos);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [['Indicateur', 'Valeur']],
        body: [
          ['Total des presences', statsData.total_presences?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') || '0'],
          ['Membres actifs', statsData.membres_actifs?.toString() || '0'],
          ['Total membres inscrits', statsData.total_membres?.toString() || '0'],
          ['Taux d\'activation', `${statsData.taux_activation || 0}%`],
          ['Moyenne presences/membre', 
           statsData.membres_actifs > 0 ? (statsData.total_presences / statsData.membres_actifs).toFixed(1) : '0']
        ],
        theme: 'grid',
        headStyles: { fillColor: [52, 152, 219], fontSize: 11, fontStyle: 'bold' },
        styles: { fontSize: 10 },
        margin: { left: 20, right: 20 }
      });

      yPos = doc.lastAutoTable.finalY + 15;

      // TOP 10
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(46, 204, 113);
      doc.text('TOP 10 - MEMBRES LES PLUS ASSIDUS', 20, yPos);
      yPos += 10;

      if (statsData.top_10_assidus && statsData.top_10_assidus.length > 0) {
        const topMembersData = statsData.top_10_assidus.map((item, idx) => [
          (idx + 1).toString(),
          item.membre,
          item.presences.toString()
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Rang', 'Membre', 'Presences']],
          body: topMembersData,
          theme: 'grid',
          headStyles: { fillColor: [46, 204, 113], fontSize: 11, fontStyle: 'bold' },
          styles: { fontSize: 10 },
          columnStyles: {
            0: { cellWidth: 20, halign: 'center' },
            1: { cellWidth: 120 },
            2: { cellWidth: 30, halign: 'center' }
          },
          margin: { left: 20, right: 20 }
        });

        doc.addPage();
        yPos = 20;
        
        const topLabels = statsData.top_10_assidus.map(item => item.membre);
        const topData = statsData.top_10_assidus.map(item => item.presences);
        const topChartImg = await generateChartImage('horizontalBar', topLabels, topData, 
                                                      'Top 10 des membres les plus assidus');
        doc.addImage(topChartImg, 'PNG', 10, yPos, 190, 142);
      }

      // TOUS LES MEMBRES
      if (allMembers && allMembers.length > 0) {
        doc.addPage();
        yPos = 20;
        
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(52, 152, 219);
        doc.text('DETAIL DE TOUS LES MEMBRES', 20, yPos);
        yPos += 5;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Total: ${allMembers.length} membres`, 20, yPos);
        yPos += 10;

        const allMembersData = allMembers.map((item, idx) => [
          (idx + 1).toString(),
          item.member_name,
          item.presences.toString()
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['#', 'Membre', 'Presences']],
          body: allMembersData,
          theme: 'striped',
          headStyles: { fillColor: [52, 152, 219], fontSize: 10, fontStyle: 'bold' },
          styles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 130 },
            2: { cellWidth: 25, halign: 'center' }
          },
          margin: { left: 20, right: 20 },
          alternateRowStyles: { fillColor: [245, 245, 245] }
        });
      }

      // REPARTITION GENRE
      if (statsData.repartition_genre) {
        doc.addPage();
        yPos = 20;
        
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(52, 152, 219);
        doc.text('REPARTITION PAR GENRE', 20, yPos);
        yPos += 10;

        const genderLabels = Object.keys(statsData.repartition_genre);
        const genderData = Object.values(statsData.repartition_genre);
        const genderChartImg = await generateChartImage('pie', genderLabels, genderData, 
                                                        'Repartition Hommes / Femmes');
        doc.addImage(genderChartImg, 'PNG', 30, yPos, 150, 100);
        yPos += 110;
      }

      // REPARTITION ETUDIANTS
      if (statsData.repartition_etudiant) {
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(52, 152, 219);
        doc.text('REPARTITION ETUDIANTS / NON-ETUDIANTS', 20, yPos);
        yPos += 10;

        const studentLabels = Object.keys(statsData.repartition_etudiant);
        const studentData = Object.values(statsData.repartition_etudiant);
        const studentChartImg = await generateChartImage('pie', studentLabels, studentData, 
                                                         'Repartition Etudiants');
        doc.addImage(studentChartImg, 'PNG', 30, yPos, 150, 100);
      }

      // FREQUENTATION PAR JOUR
      if (statsData.frequentation_jours && statsData.frequentation_jours.length > 0) {
        doc.addPage();
        yPos = 20;

        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(52, 152, 219);
        doc.text('FREQUENTATION PAR JOUR DE LA SEMAINE', 20, yPos);
        yPos += 10;

        const dayLabels = statsData.frequentation_jours.map(item => item.jour.trim());
        const dayData = statsData.frequentation_jours.map(item => item.presences);
        const dayChartImg = await generateChartImage('bar', dayLabels, dayData, 
                                                     'Frequentation par jour');
        doc.addImage(dayChartImg, 'PNG', 10, yPos, 190, 113);
      }

      // FREQUENTATION PAR PLAGE HORAIRE
      if (statsData.frequentation_plages) {
        doc.addPage();
        yPos = 20;

        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(52, 152, 219);
        doc.text('FREQUENTATION PAR PLAGE HORAIRE', 20, yPos);
        yPos += 10;

        const timeOrder = [
          'Matin (5h-9h)', 'Matinée (9h-12h)', 'Midi (12h-14h)', 
          'Après-midi (14h-18h)', 'Soirée (18h-22h)', 'Nuit (22h-5h)'
        ];
        const timeLabels = timeOrder.filter(slot => statsData.frequentation_plages[slot]);
        const timeData = timeLabels.map(slot => statsData.frequentation_plages[slot]);
        const timeChartImg = await generateChartImage('bar', timeLabels, timeData, 
                                                      'Frequentation par plage horaire');
        doc.addImage(timeChartImg, 'PNG', 10, yPos, 190, 113);
      }

      // EVOLUTION MENSUELLE
      if (statsData.evolution_mensuelle) {
        doc.addPage();
        yPos = 20;

        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(52, 152, 219);
        doc.text('EVOLUTION MENSUELLE', 20, yPos);
        yPos += 10;

        const monthLabels = Object.keys(statsData.evolution_mensuelle).sort();
        const monthData = monthLabels.map(month => statsData.evolution_mensuelle[month]);
        const monthChartImg = await generateChartImage('line', monthLabels, monthData, 
                                                       'Evolution mensuelle des presences');
        doc.addImage(monthChartImg, 'PNG', 10, yPos, 190, 113);
      }

      const fileName = `BodyForce_Rapport_${startDate}_${endDate}.pdf`;
      doc.save(fileName);

      alert('Rapport PDF genere avec succes !');

    } catch (err) {
      console.error('Erreur:', err);
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto dark:bg-gray-800">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 dark:text-white">
        Generer un Rapport Statistique
      </h2>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
              Date de debut
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
              Date de fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              const now = new Date();
              setStartDate(`${now.getFullYear()}-01-01`);
              setEndDate(`${now.getFullYear()}-12-31`);
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Annee en cours
          </button>
          
          <button
            onClick={() => {
              const now = new Date();
              const lastYear = now.getFullYear() - 1;
              setStartDate(`${lastYear}-01-01`);
              setEndDate(`${lastYear}-12-31`);
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Annee derniere
          </button>
          
          <button
            onClick={() => {
              const now = new Date();
              const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
              const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              setStartDate(firstDay.toISOString().split('T')[0]);
              setEndDate(lastDay.toISOString().split('T')[0]);
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Mois en cours
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 dark:bg-blue-900/20 dark:border-blue-800">
          <h3 className="font-semibold text-blue-900 mb-2 dark:text-blue-300">Contenu du rapport :</h3>
          <ul className="text-sm text-blue-800 space-y-1 dark:text-blue-400">
            <li>• Vue d'ensemble et statistiques globales</li>
            <li>• Top 10 des membres les plus assidus</li>
            <li>• Detail de TOUS les membres avec presences</li>
            <li>• Repartition Hommes/Femmes et Etudiants</li>
            <li>• Frequentation par jour et plage horaire</li>
            <li>• Evolution mensuelle</li>
          </ul>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 dark:bg-red-900/20 dark:border-red-800">
            <p className="text-red-800 dark:text-red-400">
              Erreur : {error}
            </p>
          </div>
        )}

        <button
          onClick={generatePDF}
          disabled={loading}
          className={`w-full py-3 px-6 rounded-md font-semibold text-white transition-colors
            ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" 
                        stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generation en cours...
            </span>
          ) : (
            'Generer le rapport PDF'
          )}
        </button>
      </div>
    </div>
  );
};

export default StatsReportGenerator;
