import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Chart } from 'chart.js/auto';

/**
 * Composant pour générer des rapports statistiques PDF
 * Permet de sélectionner une période et génère un rapport complet
 */
const StatsReportGenerator = () => {
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fonction pour générer un graphique en base64
  const generateChartImage = (type, labels, data, title) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 400;
      
      const ctx = canvas.getContext('2d');
      
      const chart = new Chart(ctx, {
        type: type,
        data: {
          labels: labels,
          datasets: [{
            label: title,
            data: data,
            backgroundColor: type === 'pie' ? [
              '#3498DB', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C'
            ] : '#3498DB',
            borderColor: '#2C3E50',
            borderWidth: 1
          }]
        },
        options: {
          responsive: false,
          plugins: {
            title: {
              display: true,
              text: title,
              font: { size: 16, weight: 'bold' }
            },
            legend: {
              display: type === 'pie',
              position: 'bottom'
            }
          },
          scales: type !== 'pie' ? {
            y: { beginAtZero: true }
          } : {}
        }
      });

      setTimeout(() => {
        const imgData = canvas.toDataURL('image/png');
        chart.destroy();
        resolve(imgData);
      }, 100);
    });
  };

  // Fonction principale pour générer le PDF
  const generatePDF = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Récupérer les statistiques via la fonction RPC
      const { data: stats, error: rpcError } = await supabase
        .rpc('generate_stats_report', {
          p_start_date: startDate,
          p_end_date: endDate
        });

      if (rpcError) throw rpcError;
      if (!stats || stats.length === 0) throw new Error('Aucune donnée récupérée');

      const statsData = stats[0];

      // 2. Créer le document PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;

      // === PAGE DE GARDE ===
      doc.setFontSize(28);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(44, 62, 80);
      doc.text('BODYFORCE', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 15;
      doc.setFontSize(18);
      doc.text('Rapport Statistique de Fréquentation', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 20;
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Période : ${startDate} au ${endDate}`, pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 10;
      const dateGeneration = new Date().toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(`Généré le : ${dateGeneration}`, pageWidth / 2, yPos, { align: 'center' });

      // === NOUVELLE PAGE - STATISTIQUES GLOBALES ===
      doc.addPage();
      yPos = 20;

      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(52, 152, 219);
      doc.text('📊 Vue d\'ensemble', 20, yPos);
      yPos += 10;

      // Tableau des statistiques globales
      doc.autoTable({
        startY: yPos,
        head: [['Indicateur', 'Valeur']],
        body: [
          ['Total des présences', statsData.total_presences?.toLocaleString() || '0'],
          ['Membres actifs', statsData.membres_actifs?.toString() || '0'],
          ['Total membres inscrits', statsData.total_membres?.toString() || '0'],
          ['Taux d\'activation', `${statsData.taux_activation || 0}%`],
          ['Moyenne présences/membre', 
           statsData.membres_actifs > 0 
             ? (statsData.total_presences / statsData.membres_actifs).toFixed(1)
             : '0'
          ]
        ],
        theme: 'grid',
        headStyles: { fillColor: [52, 152, 219], fontSize: 11, fontStyle: 'bold' },
        styles: { fontSize: 10 },
        margin: { left: 20, right: 20 }
      });

      yPos = doc.lastAutoTable.finalY + 15;

      // === TOP 10 MEMBRES LES PLUS ASSIDUS ===
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(46, 204, 113);
      doc.text('🏆 Top 10 - Membres les plus assidus', 20, yPos);
      yPos += 10;

      if (statsData.top_10_assidus && statsData.top_10_assidus.length > 0) {
        const topMembersData = statsData.top_10_assidus.map((item, idx) => [
          (idx + 1).toString(),
          item.membre,
          item.presences.toString()
        ]);

        doc.autoTable({
          startY: yPos,
          head: [['Rang', 'Membre', 'Présences']],
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

        // Graphique Top 10
        doc.addPage();
        yPos = 20;
        
        const topLabels = statsData.top_10_assidus.map(item => item.membre);
        const topData = statsData.top_10_assidus.map(item => item.presences);
        const topChartImg = await generateChartImage('bar', topLabels, topData, 
                                                      'Top 10 des membres les plus assidus');
        doc.addImage(topChartImg, 'PNG', 20, yPos, 170, 113);
        yPos += 120;
      }

      // === RÉPARTITION PAR GENRE ===
      if (statsData.repartition_genre) {
        doc.addPage();
        yPos = 20;
        
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(52, 152, 219);
        doc.text('👥 Répartition par genre', 20, yPos);
        yPos += 10;

        const genderLabels = Object.keys(statsData.repartition_genre);
        const genderData = Object.values(statsData.repartition_genre);
        const genderChartImg = await generateChartImage('pie', genderLabels, genderData, 
                                                        'Répartition Hommes / Femmes');
        doc.addImage(genderChartImg, 'PNG', 30, yPos, 150, 100);
        yPos += 110;
      }

      // === RÉPARTITION ÉTUDIANTS ===
      if (statsData.repartition_etudiant) {
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(52, 152, 219);
        doc.text('🎓 Répartition Étudiants / Non-étudiants', 20, yPos);
        yPos += 10;

        const studentLabels = Object.keys(statsData.repartition_etudiant);
        const studentData = Object.values(statsData.repartition_etudiant);
        const studentChartImg = await generateChartImage('pie', studentLabels, studentData, 
                                                         'Répartition Étudiants');
        doc.addImage(studentChartImg, 'PNG', 30, yPos, 150, 100);
      }

      // === FRÉQUENTATION PAR JOUR ===
      if (statsData.frequentation_jours && statsData.frequentation_jours.length > 0) {
        doc.addPage();
        yPos = 20;

        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(52, 152, 219);
        doc.text('📅 Fréquentation par jour de la semaine', 20, yPos);
        yPos += 10;

        const dayLabels = statsData.frequentation_jours.map(item => item.jour.trim());
        const dayData = statsData.frequentation_jours.map(item => item.presences);
        const dayChartImg = await generateChartImage('bar', dayLabels, dayData, 
                                                     'Fréquentation par jour');
        doc.addImage(dayChartImg, 'PNG', 20, yPos, 170, 113);
        yPos += 120;
      }

      // === FRÉQUENTATION PAR PLAGE HORAIRE ===
      if (statsData.frequentation_plages) {
        doc.addPage();
        yPos = 20;

        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(52, 152, 219);
        doc.text('⏰ Fréquentation par plage horaire', 20, yPos);
        yPos += 10;

        const timeOrder = [
          'Matin (5h-9h)', 'Matinée (9h-12h)', 'Midi (12h-14h)', 
          'Après-midi (14h-18h)', 'Soirée (18h-22h)', 'Nuit (22h-5h)'
        ];
        const timeLabels = timeOrder.filter(slot => statsData.frequentation_plages[slot]);
        const timeData = timeLabels.map(slot => statsData.frequentation_plages[slot]);
        const timeChartImg = await generateChartImage('bar', timeLabels, timeData, 
                                                      'Fréquentation par plage horaire');
        doc.addImage(timeChartImg, 'PNG', 20, yPos, 170, 113);
      }

      // === ÉVOLUTION MENSUELLE ===
      if (statsData.evolution_mensuelle) {
        doc.addPage();
        yPos = 20;

        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(52, 152, 219);
        doc.text('📈 Évolution mensuelle', 20, yPos);
        yPos += 10;

        const monthLabels = Object.keys(statsData.evolution_mensuelle).sort();
        const monthData = monthLabels.map(month => statsData.evolution_mensuelle[month]);
        const monthChartImg = await generateChartImage('line', monthLabels, monthData, 
                                                       'Évolution mensuelle des présences');
        doc.addImage(monthChartImg, 'PNG', 20, yPos, 170, 113);
      }

      // 3. Sauvegarder le PDF
      const fileName = `BodyForce_Rapport_${startDate}_${endDate}.pdf`;
      doc.save(fileName);

      alert('✅ Rapport PDF généré avec succès !');

    } catch (err) {
      console.error('Erreur lors de la génération du rapport:', err);
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        📊 Générer un Rapport Statistique
      </h2>

      <div className="space-y-4">
        {/* Sélection des dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date de début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date de fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Boutons raccourcis */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              const now = new Date();
              setStartDate(`${now.getFullYear()}-01-01`);
              setEndDate(`${now.getFullYear()}-12-31`);
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
          >
            Année en cours
          </button>
          
          <button
            onClick={() => {
              const now = new Date();
              const lastYear = now.getFullYear() - 1;
              setStartDate(`${lastYear}-01-01`);
              setEndDate(`${lastYear}-12-31`);
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
          >
            Année dernière
          </button>
          
          <button
            onClick={() => {
              const now = new Date();
              const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
              const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              setStartDate(firstDay.toISOString().split('T')[0]);
              setEndDate(lastDay.toISOString().split('T')[0]);
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
          >
            Mois en cours
          </button>
        </div>

        {/* Informations sur le contenu */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="font-semibold text-blue-900 mb-2">📋 Contenu du rapport :</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Vue d'ensemble et statistiques globales</li>
            <li>• Top 10 des membres les plus assidus</li>
            <li>• Répartition Hommes/Femmes et Étudiants</li>
            <li>• Fréquentation par jour et plage horaire</li>
            <li>• Heures de pointe et évolution mensuelle</li>
            <li>• Graphiques et tableaux détaillés</li>
          </ul>
        </div>

        {/* Affichage des erreurs */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">
              ❌ Erreur : {error}
            </p>
          </div>
        )}

        {/* Bouton de génération */}
        <button
          onClick={generatePDF}
          disabled={loading}
          className={`w-full py-3 px-6 rounded-md font-semibold text-white transition-colors
            ${loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" 
                        stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Génération en cours...
            </span>
          ) : (
            '📄 Générer le rapport PDF'
          )}
        </button>
      </div>
    </div>
  );
};

export default StatsReportGenerator;
