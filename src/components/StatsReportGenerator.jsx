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

  // Logo BodyForce en base64 (haltère stylisé)
  const LOGO_BASE64 = 'data:image/png;base64,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';

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
              ['#3498DB', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C'] : 
              type === 'line' ? 'rgba(52, 152, 219, 0.2)' : '#3498DB',
            borderColor: type === 'line' ? '#3498DB' : '#2C3E50',
            borderWidth: type === 'line' ? 3 : 1,
            fill: type === 'line',
            tension: type === 'line' ? 0.4 : 0
          }]
        },
        options: {
          indexAxis: type === 'horizontalBar' ? 'y' : 'x',
          responsive: false,
          plugins: {
            title: { display: true, text: title, font: { size: 16, weight: 'bold' } },
            legend: { display: type === 'pie', position: 'bottom' },
            datalabels: {
              anchor: type === 'horizontalBar' ? 'end' : type === 'line' ? 'top' : 'end',
              align: type === 'horizontalBar' ? 'end' : type === 'line' ? 'top' : 'top',
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

  const addFooter = (doc) => {
    const pageCount = doc.internal.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Ligne de séparation
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);
      
      // Numéro de page
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${i} / ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      // Informations
      doc.setFontSize(8);
      doc.text('Club BodyForce', 20, pageHeight - 10);
      doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
    }
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
      if (!stats || stats.length === 0) throw new Error('Aucune donnée récupérée');

      const statsData = stats[0];

      const { data: allMembers, error: membersError } = await supabase.rpc('get_all_members_presences', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (membersError) console.error('Erreur membres:', membersError);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 40;

      // ============= PAGE DE GARDE =============
      // Logo centré en haut
      const logoSize = 30;
      doc.addImage(LOGO_BASE64, 'PNG', (pageWidth - logoSize) / 2, 20, logoSize, logoSize);
      
      yPos = 60;
      
      // Titre principal
      doc.setFontSize(32);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('BODYFORCE', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 20;
      doc.setFontSize(20);
      doc.setTextColor(52, 73, 94);
      doc.text('Rapport Statistique', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 10;
      doc.setFontSize(16);
      doc.text('de Fréquentation', pageWidth / 2, yPos, { align: 'center' });
      
      // Cadre avec période
      yPos += 30;
      doc.setDrawColor(52, 152, 219);
      doc.setLineWidth(0.5);
      doc.roundedRect(30, yPos - 10, pageWidth - 60, 30, 3, 3);
      
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(52, 152, 219);
      doc.text('PÉRIODE ANALYSÉE', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 10;
      doc.setFontSize(16);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(44, 62, 80);
      const startFormatted = new Date(startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      const endFormatted = new Date(endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.text(`Du ${startFormatted} au ${endFormatted}`, pageWidth / 2, yPos, { align: 'center' });
      
      // Date de génération
      yPos = pageHeight - 40;
      doc.setFontSize(10);
      doc.setTextColor(127, 140, 141);
      const dateGeneration = new Date().toLocaleDateString('fr-FR', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      doc.text(`Document généré le ${dateGeneration}`, pageWidth / 2, yPos, { align: 'center' });

      // ============= VUE D'ENSEMBLE =============
      doc.addPage();
      yPos = 20;
      
      // En-tête de section
      doc.setFillColor(52, 152, 219);
      doc.roundedRect(15, yPos - 5, pageWidth - 30, 12, 2, 2, 'F');
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('📊  VUE D\'ENSEMBLE', 20, yPos + 3);
      yPos += 15;

      // Calculs pour les statistiques avancées
      const totalPresences = statsData.total_presences || 0;
      const membresActifs = statsData.membres_actifs || 0;
      const totalMembres = statsData.total_membres || 0;
      const moyennePresences = membresActifs > 0 ? (totalPresences / membresActifs).toFixed(1) : 0;
      const tauxActivation = statsData.taux_activation || 0;

      // Calcul des pourcentages H/F/Étudiants
      const repartitionGenre = statsData.repartition_genre || {};
      const totalGenre = Object.values(repartitionGenre).reduce((a, b) => a + b, 0);
      const pourcentageHommes = totalGenre > 0 ? ((repartitionGenre['Homme'] || 0) / totalGenre * 100).toFixed(1) : 0;
      const pourcentageFemmes = totalGenre > 0 ? ((repartitionGenre['Femme'] || 0) / totalGenre * 100).toFixed(1) : 0;
      
      const repartitionEtudiant = statsData.repartition_etudiant || {};
      const totalEtudiants = Object.values(repartitionEtudiant).reduce((a, b) => a + b, 0);
      const pourcentageEtudiant = totalEtudiants > 0 ? ((repartitionEtudiant[true] || 0) / totalEtudiants * 100).toFixed(1) : 0;

      autoTable(doc, {
        startY: yPos,
        head: [['Indicateur', 'Valeur']],
        body: [
          ['📈 Total des présences', totalPresences.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')],
          ['✅ Membres actifs', `${membresActifs} membres`],
          ['👥 Total membres inscrits', `${totalMembres} membres`],
          ['🎯 Taux d\'activation', `${tauxActivation}%`],
          ['📊 Moyenne présences/membre actif', `${moyennePresences} visites`]
        ],
        theme: 'striped',
        headStyles: { fillColor: [52, 152, 219], fontSize: 11, fontStyle: 'bold', textColor: [255, 255, 255] },
        styles: { fontSize: 10, cellPadding: 5 },
        margin: { left: 20, right: 20 },
        alternateRowStyles: { fillColor: [245, 247, 250] }
      });

      yPos = doc.lastAutoTable.finalY + 20;

      // ============= RÉPARTITION DÉMOGRAPHIQUE =============
      doc.setFillColor(46, 204, 113);
      doc.roundedRect(15, yPos - 5, pageWidth - 30, 12, 2, 2, 'F');
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('👥  RÉPARTITION DÉMOGRAPHIQUE', 20, yPos + 3);
      yPos += 15;

      autoTable(doc, {
        startY: yPos,
        head: [['Catégorie', 'Nombre', 'Pourcentage']],
        body: [
          ['👨 Hommes', (repartitionGenre['Homme'] || 0).toString(), `${pourcentageHommes}%`],
          ['👩 Femmes', (repartitionGenre['Femme'] || 0).toString(), `${pourcentageFemmes}%`],
          ['🎓 Étudiants', (repartitionEtudiant[true] || 0).toString(), `${pourcentageEtudiant}%`],
          ['💼 Non-étudiants', (repartitionEtudiant[false] || 0).toString(), `${(100 - pourcentageEtudiant).toFixed(1)}%`]
        ],
        theme: 'striped',
        headStyles: { fillColor: [46, 204, 113], fontSize: 11, fontStyle: 'bold', textColor: [255, 255, 255] },
        styles: { fontSize: 10, cellPadding: 5 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 50, halign: 'center' },
          2: { cellWidth: 50, halign: 'center' }
        },
        margin: { left: 20, right: 20 },
        alternateRowStyles: { fillColor: [245, 247, 250] }
      });

      // ============= TOP 10 MEMBRES =============
      doc.addPage();
      yPos = 20;
      
      doc.setFillColor(241, 196, 15);
      doc.roundedRect(15, yPos - 5, pageWidth - 30, 12, 2, 2, 'F');
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('🏆  TOP 10 - MEMBRES LES PLUS ASSIDUS', 20, yPos + 3);
      yPos += 15;

      if (statsData.top_10_assidus && statsData.top_10_assidus.length > 0) {
        const topMembersData = statsData.top_10_assidus.map((item, idx) => {
          const medals = ['🥇', '🥈', '🥉'];
          const rank = idx < 3 ? medals[idx] : `${idx + 1}`;
          return [rank, item.membre, item.presences.toString()];
        });

        autoTable(doc, {
          startY: yPos,
          head: [['Rang', 'Membre', 'Présences']],
          body: topMembersData,
          theme: 'striped',
          headStyles: { fillColor: [241, 196, 15], fontSize: 11, fontStyle: 'bold', textColor: [255, 255, 255] },
          styles: { fontSize: 10, cellPadding: 5 },
          columnStyles: {
            0: { cellWidth: 25, halign: 'center', fontSize: 12 },
            1: { cellWidth: 115 },
            2: { cellWidth: 30, halign: 'center', fontStyle: 'bold' }
          },
          margin: { left: 20, right: 20 },
          alternateRowStyles: { fillColor: [255, 248, 220] }
        });

        doc.addPage();
        yPos = 20;
        
        const topLabels = statsData.top_10_assidus.map(item => item.membre);
        const topData = statsData.top_10_assidus.map(item => item.presences);
        const topChartImg = await generateChartImage('horizontalBar', topLabels, topData, 
                                                      'Top 10 des membres les plus assidus');
        doc.addImage(topChartImg, 'PNG', 10, yPos, 190, 142);
      }

      // ============= TOUS LES MEMBRES =============
      if (allMembers && allMembers.length > 0) {
        doc.addPage();
        yPos = 20;
        
        doc.setFillColor(155, 89, 182);
        doc.roundedRect(15, yPos - 5, pageWidth - 30, 12, 2, 2, 'F');
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(`📋  DÉTAIL DE TOUS LES MEMBRES (${allMembers.length})`, 20, yPos + 3);
        yPos += 15;

        const allMembersData = allMembers.map((item, idx) => [
          (idx + 1).toString(),
          item.member_name,
          item.presences.toString()
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['#', 'Membre', 'Présences']],
          body: allMembersData,
          theme: 'grid',
          headStyles: { fillColor: [155, 89, 182], fontSize: 10, fontStyle: 'bold', textColor: [255, 255, 255] },
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 120 },
            2: { cellWidth: 30, halign: 'center' }
          },
          margin: { left: 20, right: 20 },
          alternateRowStyles: { fillColor: [245, 245, 250] }
        });
      }

      // ============= RÉPARTITION PAR GENRE (GRAPHIQUE) =============
      if (statsData.repartition_genre) {
        doc.addPage();
        yPos = 20;

        doc.setFillColor(52, 152, 219);
        doc.roundedRect(15, yPos - 5, pageWidth - 30, 12, 2, 2, 'F');
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('👥  RÉPARTITION PAR GENRE', 20, yPos + 3);
        yPos += 15;

        const genderLabels = Object.keys(statsData.repartition_genre);
        const genderData = Object.values(statsData.repartition_genre);
        const genderChartImg = await generateChartImage('pie', genderLabels, genderData, 
                                                        'Répartition Hommes / Femmes');
        doc.addImage(genderChartImg, 'PNG', 30, yPos, 150, 100);
        yPos += 110;
      }

      // ============= RÉPARTITION ÉTUDIANTS (GRAPHIQUE) =============
      if (statsData.repartition_etudiant) {
        doc.setFillColor(46, 204, 113);
        doc.roundedRect(15, yPos - 5, pageWidth - 30, 12, 2, 2, 'F');
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('🎓  RÉPARTITION ÉTUDIANTS', 20, yPos + 3);
        yPos += 15;

        const studentLabels = Object.keys(statsData.repartition_etudiant).map(k => k === 'true' ? 'Étudiant' : 'Non-étudiant');
        const studentData = Object.values(statsData.repartition_etudiant);
        const studentChartImg = await generateChartImage('pie', studentLabels, studentData, 
                                                         'Répartition Étudiants');
        doc.addImage(studentChartImg, 'PNG', 30, yPos, 150, 100);
      }

      // ============= FRÉQUENTATION PAR JOUR =============
      if (statsData.frequentation_jours && statsData.frequentation_jours.length > 0) {
        doc.addPage();
        yPos = 20;

        doc.setFillColor(230, 126, 34);
        doc.roundedRect(15, yPos - 5, pageWidth - 30, 12, 2, 2, 'F');
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('📅  FRÉQUENTATION PAR JOUR', 20, yPos + 3);
        yPos += 15;

        const dayLabels = statsData.frequentation_jours.map(item => item.jour.trim());
        const dayData = statsData.frequentation_jours.map(item => item.presences);
        const dayChartImg = await generateChartImage('bar', dayLabels, dayData, 
                                                     'Fréquentation par jour de la semaine');
        doc.addImage(dayChartImg, 'PNG', 10, yPos, 190, 113);
      }

      // ============= FRÉQUENTATION PAR PLAGE HORAIRE =============
      if (statsData.frequentation_plages) {
        doc.addPage();
        yPos = 20;

        doc.setFillColor(231, 76, 60);
        doc.roundedRect(15, yPos - 5, pageWidth - 30, 12, 2, 2, 'F');
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('⏰  FRÉQUENTATION PAR PLAGE HORAIRE', 20, yPos + 3);
        yPos += 15;

        const timeOrder = [
          'Matin (5h-9h)', 'Matinée (9h-12h)', 'Midi (12h-14h)', 
          'Après-midi (14h-18h)', 'Soirée (18h-22h)', 'Nuit (22h-5h)'
        ];
        const timeLabels = timeOrder.filter(slot => statsData.frequentation_plages[slot]);
        const timeData = timeLabels.map(slot => statsData.frequentation_plages[slot]);
        const timeChartImg = await generateChartImage('bar', timeLabels, timeData, 
                                                      'Fréquentation par plage horaire');
        doc.addImage(timeChartImg, 'PNG', 10, yPos, 190, 113);
      }

      // ============= ÉVOLUTION MENSUELLE =============
      if (statsData.evolution_mensuelle) {
        doc.addPage();
        yPos = 20;

        doc.setFillColor(52, 73, 94);
        doc.roundedRect(15, yPos - 5, pageWidth - 30, 12, 2, 2, 'F');
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('📈  ÉVOLUTION MENSUELLE DES PRÉSENCES', 20, yPos + 3);
        yPos += 15;

        const monthLabels = Object.keys(statsData.evolution_mensuelle).sort();
        const monthData = monthLabels.map(month => statsData.evolution_mensuelle[month]);
        const monthChartImg = await generateChartImage('line', monthLabels, monthData, 
                                                       'Évolution mensuelle des présences');
        doc.addImage(monthChartImg, 'PNG', 10, yPos, 190, 113);
      }

      // Ajouter les pieds de page avec numérotation
      addFooter(doc);

      const fileName = `BodyForce_Rapport_${startDate}_${endDate}.pdf`;
      doc.save(fileName);

      alert('✅ Rapport PDF généré avec succès !');

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
        📊 Générer un Rapport Statistique
      </h2>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
              Date de début
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
            Année en cours
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
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Mois en cours
          </button>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-md p-4 dark:from-blue-900/20 dark:to-cyan-900/20 dark:border-blue-800">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2 dark:text-blue-300">
            <span className="text-xl">📋</span>
            Contenu du rapport professionnel :
          </h3>
          <ul className="text-sm text-blue-800 space-y-2 dark:text-blue-400">
            <li className="flex items-start gap-2">
              <span className="mt-0.5">✅</span>
              <span><strong>Page de garde</strong> avec logo et période analysée</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">📊</span>
              <span><strong>Vue d'ensemble</strong> avec statistiques clés et moyenne présences/membre</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">👥</span>
              <span><strong>Répartition démographique</strong> avec pourcentages détaillés (H/F/Étudiants)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">🏆</span>
              <span><strong>Top 10</strong> des membres les plus assidus avec graphique</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">📋</span>
              <span><strong>Détail de TOUS les membres</strong> avec leur nombre de présences</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">📊</span>
              <span><strong>Graphiques en camembert</strong> pour la répartition genre et étudiants</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">📅</span>
              <span><strong>Fréquentation par jour</strong> et par plage horaire</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">📈</span>
              <span><strong>Évolution mensuelle</strong> des présences (graphique ligne)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">📄</span>
              <span><strong>Numérotation des pages</strong> et pied de page professionnel</span>
            </li>
          </ul>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 dark:bg-red-900/20 dark:border-red-800">
            <p className="text-red-800 dark:text-red-400">
              ❌ Erreur : {error}
            </p>
          </div>
        )}

        <button
          onClick={generatePDF}
          disabled={loading}
          className={`w-full py-3 px-6 rounded-md font-semibold text-white transition-colors shadow-lg
            ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700'}`}
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
            <>
              <span className="text-lg">📄</span> Générer le rapport PDF professionnel
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default StatsReportGenerator;
