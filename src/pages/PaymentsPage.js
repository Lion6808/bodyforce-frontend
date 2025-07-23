import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
    CreditCard,
    TrendingUp,
    TrendingDown,
    Users,
    AlertCircle,
    CheckCircle,
    Clock,
    DollarSign,
    Calendar,
    Search,
    Filter,
    Download,
    Eye,
    EyeOff,
    RefreshCw
} from 'lucide-react';
import { createClient } from "@supabase/supabase-js";

// ✅ Client Supabase direct
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_KEY
);

function PaymentsPage() {
    const [members, setMembers] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [expandedMember, setExpandedMember] = useState(null);
    const [isRetrying, setIsRetrying] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    // ✅ Chargement des données depuis Supabase avec votre structure
    const loadData = async (showRetryIndicator = false) => {
        try {
            if (showRetryIndicator) {
                setIsRetrying(true);
            }
            setLoading(true);
            setError('');

            console.log('🔄 Chargement des données de paiements...');

            // Chargement des membres
            const { data: membersData, error: membersError } = await supabase
                .from("members")
                .select("*")
                .order('name', { ascending: true });

            if (membersError) {
                console.error('❌ Erreur membres:', membersError);
                throw new Error(`Erreur membres: ${membersError.message}`);
            }

            console.log('✅ Membres chargés:', membersData?.length || 0);

            // ✅ Chargement des paiements avec votre structure exacte
            const { data: paymentsData, error: paymentsError } = await supabase
                .from("payments")
                .select(`
          *,
          members (
            id,
            badgeId,
            name,
            firstName,
            email,
            phone,
            photo
          )
        `)
                .order('date_paiement', { ascending: false });

            if (paymentsError) {
                console.error('❌ Erreur paiements:', paymentsError);
                throw new Error(`Erreur paiements: ${paymentsError.message}`);
            }

            console.log('✅ Paiements chargés:', paymentsData?.length || 0);

            setMembers(membersData || []);
            setPayments(paymentsData || []);
            setRetryCount(0);
            console.log('✅ Chargement terminé avec succès');

        } catch (error) {
            console.error('💥 Erreur lors du chargement:', error);
            setError(error.message || 'Erreur de connexion à la base de données');
        } finally {
            setLoading(false);
            setIsRetrying(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleRetry = () => {
        setRetryCount((prev) => prev + 1);
        loadData(true);
    };

    // ✅ Fonction pour déterminer si un paiement est en retard
    function isOverdue(payment) {
        if (payment.is_paid) return false;
        if (!payment.encaissement_prevu) return false;
        return new Date(payment.encaissement_prevu) < new Date();
    }



    // Fonction d'export PDF pour les paiements
    // À ajouter dans votre PaymentsPage.js

    // ✅ 1. D'abord, installez jsPDF et jsPDF-AutoTable :
    // npm install jspdf jspdf-autotable

    // ✅ 2. Ajoutez ces imports en haut de votre fichier PaymentsPage.js :
    import jsPDF from 'jspdf';
    import 'jspdf-autotable';

    // ✅ 3. Ajoutez cette fonction dans votre composant PaymentsPage :

    const exportToPDF = () => {
        try {
            // Créer un nouveau document PDF
            const doc = new jsPDF('landscape', 'mm', 'a4');

            // Configuration des couleurs
            const colors = {
                primary: [59, 130, 246], // Bleu
                success: [34, 197, 94],   // Vert
                warning: [251, 191, 36],  // Jaune
                danger: [239, 68, 68],    // Rouge
                gray: [107, 114, 128],    // Gris
                dark: [31, 41, 55]        // Gris foncé
            };

            // En-tête du document
            doc.setFillColor(...colors.primary);
            doc.rect(0, 0, 297, 25, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('CLUB BODY FORCE', 20, 12);

            doc.setFontSize(14);
            doc.setFont('helvetica', 'normal');
            doc.text('Rapport de Suivi des Paiements', 20, 20);

            // Date du rapport
            const today = new Date().toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            doc.setFontSize(10);
            doc.text(`Généré le ${today}`, 200, 20);

            // Réinitialiser la couleur du texte
            doc.setTextColor(...colors.dark);

            // Position Y courante
            let yPos = 40;

            // ✅ Section Statistiques Globales
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('📊 Statistiques Globales', 20, yPos);
            yPos += 10;

            // Créer le tableau des statistiques
            const statsData = [
                ['Total Attendu', `${stats.totalExpected.toLocaleString()} €`, `${payments.length} paiements`],
                ['Total Reçu', `${stats.totalReceived.toLocaleString()} €`, `${stats.collectionRate.toFixed(1)}% collecté`],
                ['En Attente', `${stats.totalPending.toLocaleString()} €`, `${stats.pendingCount} paiements`],
                ['En Retard', `${stats.totalOverdue.toLocaleString()} €`, `${stats.overdueCount} paiements`]
            ];

            doc.autoTable({
                startY: yPos,
                head: [['Catégorie', 'Montant', 'Détails']],
                body: statsData,
                theme: 'grid',
                headStyles: {
                    fillColor: colors.primary,
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                },
                styles: {
                    fontSize: 10,
                    cellPadding: 3
                },
                columnStyles: {
                    0: { fontStyle: 'bold' },
                    1: { halign: 'right', fontStyle: 'bold' },
                    2: { fontSize: 9, textColor: colors.gray }
                }
            });

            yPos = doc.lastAutoTable.finalY + 15;

            // ✅ Section Répartition par Méthode
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('💳 Répartition par Méthode de Paiement', 20, yPos);
            yPos += 10;

            const methodsData = ['carte', 'chèque', 'espèces', 'autre'].map(method => {
                const methodPayments = payments.filter(p => p.method === method && p.is_paid);
                const total = methodPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                const percentage = stats.totalReceived > 0 ? (total / stats.totalReceived) * 100 : 0;

                const icon = method === 'carte' ? '💳' :
                    method === 'chèque' ? '📝' :
                        method === 'espèces' ? '💵' : '🔄';

                return [
                    `${icon} ${method.charAt(0).toUpperCase() + method.slice(1)}`,
                    `${total.toFixed(2)} €`,
                    `${percentage.toFixed(1)}%`,
                    `${methodPayments.length} paiements`
                ];
            });

            doc.autoTable({
                startY: yPos,
                head: [['Méthode', 'Montant', 'Pourcentage', 'Nombre']],
                body: methodsData,
                theme: 'grid',
                headStyles: {
                    fillColor: colors.success,
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                },
                styles: {
                    fontSize: 10,
                    cellPadding: 3
                },
                columnStyles: {
                    1: { halign: 'right', fontStyle: 'bold' },
                    2: { halign: 'center', fontStyle: 'bold' },
                    3: { halign: 'center' }
                }
            });

            yPos = doc.lastAutoTable.finalY + 15;

            // ✅ Section Détail par Membre
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(`👥 Détail par Membre (${filteredMembers.length} membres)`, 20, yPos);
            yPos += 10;

            // Préparer les données des membres
            const membersData = filteredMembers.map(member => {
                const statusIcon = member.overallStatus === 'paid' ? '✅' :
                    member.overallStatus === 'pending' ? '⏳' :
                        member.overallStatus === 'overdue' ? '⚠️' : '❓';

                return [
                    `${member.firstName || ''} ${member.name || ''}`.trim(),
                    member.badgeId || 'N/A',
                    `${statusIcon} ${getStatusLabel(member.overallStatus)}`,
                    `${member.progressPercentage.toFixed(0)}%`,
                    `${member.totalPaid.toFixed(2)} € / ${member.totalDue.toFixed(2)} €`,
                    `${member.payments.length}`,
                    member.lastPaymentDate ? formatDate(member.lastPaymentDate) : 'Aucun'
                ];
            });

            doc.autoTable({
                startY: yPos,
                head: [['Nom', 'Badge', 'Statut', 'Progression', 'Montants', 'Nb Paiements', 'Dernier Paiement']],
                body: membersData,
                theme: 'striped',
                headStyles: {
                    fillColor: colors.dark,
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                },
                styles: {
                    fontSize: 8,
                    cellPadding: 2
                },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 35 },
                    1: { cellWidth: 25, halign: 'center' },
                    2: { cellWidth: 30, halign: 'center' },
                    3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
                    4: { cellWidth: 40, halign: 'right' },
                    5: { cellWidth: 15, halign: 'center' },
                    6: { cellWidth: 25, halign: 'center' }
                },
                // Colorier les lignes selon le statut
                didParseCell: function (data) {
                    if (data.column.index === 2 && data.section === 'body') {
                        const status = filteredMembers[data.row.index]?.overallStatus;
                        if (status === 'paid') {
                            data.cell.styles.textColor = colors.success;
                            data.cell.styles.fontStyle = 'bold';
                        } else if (status === 'overdue') {
                            data.cell.styles.textColor = colors.danger;
                            data.cell.styles.fontStyle = 'bold';
                        } else if (status === 'pending') {
                            data.cell.styles.textColor = colors.warning;
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                    if (data.column.index === 3 && data.section === 'body') {
                        const percentage = filteredMembers[data.row.index]?.progressPercentage || 0;
                        if (percentage === 100) {
                            data.cell.styles.textColor = colors.success;
                        } else if (percentage < 50) {
                            data.cell.styles.textColor = colors.danger;
                        }
                    }
                }
            });

            // Vérifier si on a besoin d'une nouvelle page
            yPos = doc.lastAutoTable.finalY + 15;
            if (yPos > 180) { // Si on approche du bas de la page
                doc.addPage();
                yPos = 20;
            }

            // ✅ Section Paiements Récents
            const recentPayments = payments
                .filter(p => p.is_paid)
                .slice(0, 10)
                .map(payment => [
                    `${payment.members?.firstName || ''} ${payment.members?.name || ''}`.trim(),
                    `${parseFloat(payment.amount).toFixed(2)} €`,
                    payment.method?.charAt(0).toUpperCase() + payment.method?.slice(1) || 'N/A',
                    formatDateTime(payment.date_paiement),
                    payment.commentaire || ''
                ]);

            if (recentPayments.length > 0) {
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.text('🕒 Paiements Récents (10 derniers)', 20, yPos);
                yPos += 10;

                doc.autoTable({
                    startY: yPos,
                    head: [['Membre', 'Montant', 'Méthode', 'Date', 'Commentaire']],
                    body: recentPayments,
                    theme: 'grid',
                    headStyles: {
                        fillColor: colors.warning,
                        textColor: [0, 0, 0],
                        fontStyle: 'bold'
                    },
                    styles: {
                        fontSize: 9,
                        cellPadding: 2
                    },
                    columnStyles: {
                        0: { cellWidth: 50 },
                        1: { cellWidth: 25, halign: 'right', fontStyle: 'bold', textColor: colors.success },
                        2: { cellWidth: 25, halign: 'center' },
                        3: { cellWidth: 35, halign: 'center' },
                        4: { cellWidth: 60, fontSize: 8 }
                    }
                });
            }

            // ✅ Pied de page avec informations
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);

                // Ligne de séparation
                doc.setDrawColor(...colors.gray);
                doc.line(20, 200, 277, 200);

                doc.setFontSize(8);
                doc.setTextColor(...colors.gray);
                doc.text('Club Body Force - Système de Gestion des Paiements', 20, 205);
                doc.text(`Page ${i} sur ${pageCount}`, 240, 205);
                doc.text(`Rapport généré automatiquement le ${new Date().toLocaleString('fr-FR')}`, 20, 210);
            }

            // ✅ Sauvegarder le PDF
            const fileName = `Rapport_Paiements_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);

            console.log('✅ Export PDF réussi:', fileName);

            // Optionnel : Afficher une notification de succès
            // Vous pouvez ajouter ici un toast de confirmation

        } catch (error) {
            console.error('❌ Erreur lors de l\'export PDF:', error);

            // Optionnel : Afficher une notification d'erreur
            alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
        }
    };

    // ✅ 4. Dans votre JSX, remplacez le bouton Export par :
    // <button 
    //   onClick={exportToPDF}
    //   className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
    // >
    //   <Download className="w-4 h-4" />
    //   Exporter PDF
    // </button>

    // ✅ 5. Code complet du bouton d'export à intégrer dans votre header :
    const ExportButton = () => (
        <button
            onClick={exportToPDF}
            disabled={loading || payments.length === 0}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 transition-colors flex items-center gap-2"
            title={payments.length === 0 ? "Aucune donnée à exporter" : "Exporter en PDF"}
        >
            <Download className="w-4 h-4" />
            Exporter PDF
        </button>
    );

    // ✅ 6. BONUS: Fonction d'export CSV (optionnelle)
    const exportToCSV = () => {
        try {
            // Préparer les données CSV des membres
            const csvData = filteredMembers.map(member => ({
                'Nom': member.name || '',
                'Prénom': member.firstName || '',
                'Badge': member.badgeId || '',
                'Email': member.email || '',
                'Téléphone': member.phone || '',
                'Statut': getStatusLabel(member.overallStatus),
                'Progression (%)': member.progressPercentage.toFixed(1),
                'Total Dû (€)': member.totalDue.toFixed(2),
                'Total Payé (€)': member.totalPaid.toFixed(2),
                'Reste à Payer (€)': (member.totalDue - member.totalPaid).toFixed(2),
                'Nombre de Paiements': member.payments.length,
                'Paiements Effectués': member.payments.filter(p => p.is_paid).length,
                'Paiements en Retard': member.payments.filter(p => !p.is_paid && isOverdue(p)).length,
                'Dernier Paiement': member.lastPaymentDate ? formatDate(member.lastPaymentDate) : 'Aucun'
            }));

            // Convertir en CSV
            const headers = Object.keys(csvData[0] || {});
            const csvContent = [
                headers.join(','), // En-têtes
                ...csvData.map(row =>
                    headers.map(header =>
                        `"${String(row[header]).replace(/"/g, '""')}"`
                    ).join(',')
                )
            ].join('\n');

            // Télécharger le fichier
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Paiements_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();

            console.log('✅ Export CSV réussi');
        } catch (error) {
            console.error('❌ Erreur lors de l\'export CSV:', error);
            alert('Erreur lors de la génération du CSV. Veuillez réessayer.');
        }
    };



    // ✅ Fonction pour obtenir le statut d'un paiement
    function getPaymentStatus(payment) {
        if (payment.is_paid) return 'paid';
        if (isOverdue(payment)) return 'overdue';
        return 'pending';
    }

    // ✅ Calculs des statistiques basés sur votre structure
    const stats = {
        totalMembers: members.length,
        totalExpected: payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
        totalReceived: payments.filter(p => p.is_paid).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
        totalPending: payments.filter(p => !p.is_paid && !isOverdue(p)).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
        totalOverdue: payments.filter(p => !p.is_paid && isOverdue(p)).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
        paidCount: payments.filter(p => p.is_paid).length,
        pendingCount: payments.filter(p => !p.is_paid && !isOverdue(p)).length,
        overdueCount: payments.filter(p => !p.is_paid && isOverdue(p)).length,
    };

    stats.collectionRate = stats.totalExpected > 0 ? (stats.totalReceived / stats.totalExpected) * 100 : 0;

    // ✅ Enrichissement des membres avec leurs paiements (basé sur member_id)
    const enrichedMembers = members.map(member => {
        const memberPayments = payments.filter(p => p.member_id === member.id);

        const totalDue = memberPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const totalPaid = memberPayments
            .filter(p => p.is_paid)
            .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

        const progressPercentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

        const hasOverdue = memberPayments.some(p => !p.is_paid && isOverdue(p));
        const hasPending = memberPayments.some(p => !p.is_paid && !isOverdue(p));

        let overallStatus = 'no_payments';
        if (memberPayments.length > 0) {
            if (hasOverdue) overallStatus = 'overdue';
            else if (hasPending) overallStatus = 'pending';
            else overallStatus = 'paid';
        }

        const lastPaymentDate = memberPayments
            .filter(p => p.is_paid)
            .sort((a, b) => new Date(b.date_paiement) - new Date(a.date_paiement))[0]?.date_paiement;

        return {
            ...member,
            payments: memberPayments,
            totalDue,
            totalPaid,
            progressPercentage,
            overallStatus,
            lastPaymentDate
        };
    });

    // ✅ Filtrage
    const filteredMembers = enrichedMembers.filter(member => {
        const matchesSearch =
            member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.badgeId?.includes(searchTerm);

        const matchesStatus = statusFilter === 'all' || member.overallStatus === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // ✅ Fonctions utilitaires pour l'affichage
    const getStatusColor = (status) => {
        switch (status) {
            case 'paid': return 'text-green-600 bg-green-100';
            case 'pending': return 'text-yellow-600 bg-yellow-100';
            case 'overdue': return 'text-red-600 bg-red-100';
            case 'no_payments': return 'text-gray-600 bg-gray-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'paid': return <CheckCircle className="w-4 h-4" />;
            case 'pending': return <Clock className="w-4 h-4" />;
            case 'overdue': return <AlertCircle className="w-4 h-4" />;
            case 'no_payments': return <CreditCard className="w-4 h-4" />;
            default: return <Clock className="w-4 h-4" />;
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'paid': return 'Payé';
            case 'pending': return 'En attente';
            case 'overdue': return 'En retard';
            case 'no_payments': return 'Aucun paiement';
            default: return 'Inconnu';
        }
    };

    const getPaymentMethodIcon = (method) => {
        switch (method) {
            case 'carte': return '💳';
            case 'chèque': return '📝';
            case 'espèces': return '💵';
            case 'autre': return '🔄';
            default: return '❓';
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Non définie';
        try {
            return new Date(dateString).toLocaleDateString('fr-FR');
        } catch (error) {
            return 'Date invalide';
        }
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'Non définie';
        try {
            return new Date(dateString).toLocaleString('fr-FR');
        } catch (error) {
            return 'Date invalide';
        }
    };

    // ✅ Écrans de chargement et d'erreur
    const renderConnectionError = () => (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center border border-gray-200">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Problème de connexion</h2>
                <p className="text-gray-600 mb-8 leading-relaxed">{error}</p>
                <button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                   disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-6 
                   rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-lg"
                >
                    {isRetrying ? (
                        <>
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            Reconnexion...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="w-5 h-5" />
                            Réessayer
                        </>
                    )}
                </button>
                {retryCount > 0 && (
                    <p className="text-sm text-gray-500 mt-4">Tentative {retryCount + 1}</p>
                )}
            </div>
        </div>
    );

    const renderLoading = () => (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <RefreshCw className="w-8 h-8 animate-spin text-white" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    {isRetrying ? "Reconnexion en cours..." : "Chargement des paiements..."}
                </h2>
                <p className="text-gray-600">Veuillez patienter</p>
            </div>
        </div>
    );

    if (loading) return renderLoading();
    if (error && !isRetrying) return renderConnectionError();

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900 mb-2">Suivi des Paiements</h1>
                            <p className="text-gray-600">Gérez et suivez les paiements de vos membres</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={exportToPDF}
                                disabled={loading || payments.length === 0}
                                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 transition-colors flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                Exporter PDF
                            </button>
                            <button
                                onClick={() => loadData(true)}
                                disabled={isRetrying}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                            >
                                <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                                Actualiser
                            </button>
                        </div>
                    </div>
                </div>

                {/* Widgets statistiques */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Total Attendu */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Attendu</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.totalExpected.toLocaleString()} €</p>
                                <p className="text-xs text-gray-500 mt-1">{payments.length} paiement(s)</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-full">
                                <DollarSign className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    {/* Total Reçu */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Reçu</p>
                                <p className="text-2xl font-bold text-green-600">{stats.totalReceived.toLocaleString()} €</p>
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    {stats.collectionRate.toFixed(1)}% collecté
                                </p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-full">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                        </div>
                    </div>

                    {/* En Attente */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">En Attente</p>
                                <p className="text-2xl font-bold text-yellow-600">{stats.totalPending.toLocaleString()} €</p>
                                <p className="text-xs text-gray-500 mt-1">{stats.pendingCount} paiement(s)</p>
                            </div>
                            <div className="p-3 bg-yellow-100 rounded-full">
                                <Clock className="w-6 h-6 text-yellow-600" />
                            </div>
                        </div>
                    </div>

                    {/* En Retard */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">En Retard</p>
                                <p className="text-2xl font-bold text-red-600">{stats.totalOverdue.toLocaleString()} €</p>
                                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                    <TrendingDown className="w-3 h-3" />
                                    {stats.overdueCount} paiement(s)
                                </p>
                            </div>
                            <div className="p-3 bg-red-100 rounded-full">
                                <AlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Barre de progression globale */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Progression Globale des Paiements</h3>
                        <span className="text-2xl font-bold text-blue-600">{stats.collectionRate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                        <div
                            className="bg-gradient-to-r from-blue-500 to-green-500 h-4 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${Math.min(stats.collectionRate, 100)}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mt-2">
                        <span>{stats.totalReceived.toLocaleString()} € reçus</span>
                        <span>{stats.totalExpected.toLocaleString()} € attendus</span>
                    </div>
                </div>

                {/* Filtres et recherche */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Rechercher par nom, prénom ou badge..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">Tous les statuts</option>
                            <option value="paid">Payé</option>
                            <option value="pending">En attente</option>
                            <option value="overdue">En retard</option>
                            <option value="no_payments">Aucun paiement</option>
                        </select>

                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${showFilters ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            <Filter className="w-4 h-4" />
                            Filtres
                        </button>
                    </div>

                    {showFilters && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Montant minimum</label>
                                    <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="0 €" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Méthode de paiement</label>
                                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                                        <option value="">Toutes les méthodes</option>
                                        <option value="carte">Carte</option>
                                        <option value="chèque">Chèque</option>
                                        <option value="espèces">Espèces</option>
                                        <option value="autre">Autre</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Période</label>
                                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                                        <option value="">Toutes les périodes</option>
                                        <option value="this_month">Ce mois</option>
                                        <option value="last_month">Mois dernier</option>
                                        <option value="this_year">Cette année</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tableau des membres */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">Détail par Membre ({filteredMembers.length})</h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Membre</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progression</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montants</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dernier Paiement</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredMembers.map((member) => (
                                    <React.Fragment key={member.id}>
                                        <tr className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-10 w-10">
                                                        {member.photo ? (
                                                            <img
                                                                src={member.photo}
                                                                alt="avatar"
                                                                className="h-10 w-10 rounded-full object-cover border border-gray-300"
                                                            />
                                                        ) : (
                                                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                                                                {member.firstName?.[0] || 'N'}{member.name?.[0] || 'N'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {member.firstName || 'Prénom'} {member.name || 'Nom'}
                                                        </div>
                                                        <div className="text-sm text-gray-500">Badge: {member.badgeId || 'N/A'}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(member.overallStatus)}`}>
                                                    {getStatusIcon(member.overallStatus)}
                                                    {getStatusLabel(member.overallStatus)}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="w-32">
                                                    <div className="flex items-center justify-between text-sm mb-1">
                                                        <span className="text-gray-600">{member.progressPercentage.toFixed(0)}%</span>
                                                        <span className="text-gray-500 text-xs">{member.totalPaid.toFixed(0)}€/{member.totalDue.toFixed(0)}€</span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className={`h-2 rounded-full transition-all duration-500 ${member.progressPercentage === 100
                                                                ? 'bg-gradient-to-r from-green-400 to-green-600'
                                                                : member.progressPercentage > 50
                                                                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-600'
                                                                    : 'bg-gradient-to-r from-red-400 to-red-600'
                                                                }`}
                                                            style={{ width: `${Math.min(member.progressPercentage, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm">
                                                    <div className="font-medium text-gray-900">{member.totalPaid.toFixed(2)} € / {member.totalDue.toFixed(2)} €</div>
                                                    <div className="text-gray-500">{member.payments.length} paiement(s)</div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {member.lastPaymentDate ? (
                                                        <div>
                                                            <div className="flex items-center gap-1">
                                                                <Calendar className="w-4 h-4 text-gray-400" />
                                                                {formatDate(member.lastPaymentDate)}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 italic">Aucun paiement</span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                                                    className="text-blue-600 hover:text-blue-900 transition-colors flex items-center gap-1"
                                                >
                                                    {expandedMember === member.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    {expandedMember === member.id ? 'Masquer' : 'Détails'}
                                                </button>
                                            </td>
                                        </tr>

                                        {/* Ligne étendue avec détails des paiements */}
                                        {expandedMember === member.id && (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-4 bg-gray-50">
                                                    <div className="space-y-4">
                                                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                                            <CreditCard className="w-4 h-4" />
                                                            Détail des paiements de {member.firstName} {member.name}
                                                        </h4>

                                                        {member.payments.length > 0 ? (
                                                            <div className="grid gap-3">
                                                                {member.payments.map((payment) => (
                                                                    <div key={payment.id} className="bg-white rounded-lg p-4 border border-gray-200">
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex-1">
                                                                                <div className="flex items-center gap-3">
                                                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(getPaymentStatus(payment))}`}>
                                                                                        {getStatusIcon(getPaymentStatus(payment))}
                                                                                        {getStatusLabel(getPaymentStatus(payment))}
                                                                                    </span>
                                                                                    <span className="font-medium text-gray-900">Paiement #{payment.id}</span>
                                                                                </div>

                                                                                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                                                    <div>
                                                                                        <span className="text-gray-500">Montant:</span>
                                                                                        <div className="font-medium">{parseFloat(payment.amount || 0).toFixed(2)} €</div>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-gray-500">Méthode:</span>
                                                                                        <div className="font-medium flex items-center gap-1">
                                                                                            <span>{getPaymentMethodIcon(payment.method)}</span>
                                                                                            <span className="capitalize">{payment.method}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-gray-500">Date de paiement:</span>
                                                                                        <div className="font-medium">
                                                                                            {payment.is_paid ? formatDateTime(payment.date_paiement) : 'Non payé'}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-gray-500">Encaissement prévu:</span>
                                                                                        <div className="font-medium">
                                                                                            {formatDate(payment.encaissement_prevu)}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>

                                                                                {payment.commentaire && (
                                                                                    <div className="mt-3 p-2 bg-gray-50 rounded">
                                                                                        <span className="text-gray-500 text-sm">Commentaire:</span>
                                                                                        <div className="text-gray-700 text-sm mt-1">{payment.commentaire}</div>
                                                                                    </div>
                                                                                )}

                                                                                {/* Indicateur visuel du statut */}
                                                                                <div className="mt-3 flex items-center gap-2">
                                                                                    {payment.is_paid ? (
                                                                                        <div className="flex items-center gap-1 text-green-600">
                                                                                            <CheckCircle className="w-4 h-4" />
                                                                                            <span className="text-sm font-medium">Paiement encaissé</span>
                                                                                        </div>
                                                                                    ) : isOverdue(payment) ? (
                                                                                        <div className="flex items-center gap-1 text-red-600">
                                                                                            <AlertCircle className="w-4 h-4" />
                                                                                            <span className="text-sm font-medium">
                                                                                                En retard depuis le {formatDate(payment.encaissement_prevu)}
                                                                                            </span>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="flex items-center gap-1 text-yellow-600">
                                                                                            <Clock className="w-4 h-4" />
                                                                                            <span className="text-sm font-medium">
                                                                                                Échéance: {formatDate(payment.encaissement_prevu)}
                                                                                            </span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-8">
                                                                <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                                                <p className="text-gray-500">Aucun paiement enregistré pour ce membre</p>
                                                            </div>
                                                        )}

                                                        {/* Contact info */}
                                                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                                                            <h5 className="font-medium text-blue-900 mb-2">Informations de contact</h5>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                                                <div className="text-blue-700">📧 {member.email || 'Email non renseigné'}</div>
                                                                <div className="text-blue-700">📞 {member.phone || 'Téléphone non renseigné'}</div>
                                                            </div>
                                                        </div>

                                                        {/* Résumé financier du membre */}
                                                        <div className="mt-4 p-3 bg-green-50 rounded-lg">
                                                            <h5 className="font-medium text-green-900 mb-2">Résumé financier</h5>
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                                <div>
                                                                    <div className="text-green-700 font-medium">{member.totalPaid.toFixed(2)} €</div>
                                                                    <div className="text-green-600">Total payé</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-yellow-700 font-medium">{(member.totalDue - member.totalPaid).toFixed(2)} €</div>
                                                                    <div className="text-yellow-600">Reste à payer</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-blue-700 font-medium">{member.payments.filter(p => p.is_paid).length}</div>
                                                                    <div className="text-blue-600">Paiements effectués</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-red-700 font-medium">{member.payments.filter(p => !p.is_paid && isOverdue(p)).length}</div>
                                                                    <div className="text-red-600">Paiements en retard</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredMembers.length === 0 && (
                        <div className="text-center py-12">
                            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun membre trouvé</h3>
                            <p className="text-gray-500">Essayez de modifier vos critères de recherche</p>
                        </div>
                    )}
                </div>

                {/* Statistiques détaillées par méthode de paiement */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition par Méthode de Paiement</h3>
                        <div className="space-y-3">
                            {['carte', 'chèque', 'espèces', 'autre'].map(method => {
                                const methodPayments = payments.filter(p => p.method === method && p.is_paid);
                                const total = methodPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                                const percentage = stats.totalReceived > 0 ? (total / stats.totalReceived) * 100 : 0;

                                return (
                                    <div key={method} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{getPaymentMethodIcon(method)}</span>
                                            <span className="font-medium capitalize">{method}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium">{total.toFixed(2)} €</div>
                                            <div className="text-sm text-gray-500">{percentage.toFixed(1)}%</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Paiements Récents</h3>
                        <div className="space-y-3">
                            {payments
                                .filter(p => p.is_paid)
                                .slice(0, 5)
                                .map(payment => (
                                    <div key={payment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                        <div className="flex items-center gap-2">
                                            <span>{getPaymentMethodIcon(payment.method)}</span>
                                            <div>
                                                <div className="font-medium text-sm">
                                                    {payment.members?.firstName} {payment.members?.name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {formatDate(payment.date_paiement)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium text-green-600">{parseFloat(payment.amount).toFixed(2)} €</div>
                                        </div>
                                    </div>
                                ))}
                            {payments.filter(p => p.is_paid).length === 0 && (
                                <div className="text-center py-4 text-gray-500">
                                    Aucun paiement récent
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PaymentsPage;