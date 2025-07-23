import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
    CreditCard, TrendingUp, TrendingDown, Users, AlertCircle, CheckCircle,
    Clock, DollarSign, Calendar, Search, Filter, Download, Eye, EyeOff, RefreshCw
} from 'lucide-react';
import { createClient } from "@supabase/supabase-js";

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
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const loadData = async (showRetryIndicator = false) => {
        try {
            if (showRetryIndicator) setIsRetrying(true);
            setLoading(true);
            setError('');

            const { data: membersData, error: membersError } = await supabase
                .from("members")
                .select("*")
                .order('name', { ascending: true });

            if (membersError) throw new Error(`Erreur membres: ${membersError.message}`);

            const { data: paymentsData, error: paymentsError } = await supabase
                .from("payments")
                .select(`
                    *,
                    members (id, badgeId, name, firstName, email, phone, photo)
                `)
                .order('date_paiement', { ascending: false });

            if (paymentsError) throw new Error(`Erreur paiements: ${paymentsError.message}`);

            setMembers(membersData || []);
            setPayments(paymentsData || []);
            setRetryCount(0);
        } catch (error) {
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

    function isOverdue(payment) {
        if (payment.is_paid) return false;
        if (!payment.encaissement_prevu) return false;
        return new Date(payment.encaissement_prevu) < new Date();
    }

    function getPaymentStatus(payment) {
        if (payment.is_paid) return 'paid';
        if (isOverdue(payment)) return 'overdue';
        return 'pending';
    }

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
    const enrichedMembers = members.map(member => {
        const memberPayments = payments.filter(p => p.member_id === member.id);
        const totalDue = memberPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const totalPaid = memberPayments.filter(p => p.is_paid).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
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

    const filteredMembers = enrichedMembers.filter(member => {
        const matchesSearch =
            member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.badgeId?.includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || member.overallStatus === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const exportToPDF = () => {
        try {
            const doc = new jsPDF('landscape', 'mm', 'a4');
            const colors = {
                primary: [59, 130, 246],
                success: [34, 197, 94],
                warning: [251, 191, 36],
                danger: [239, 68, 68],
                gray: [107, 114, 128],
                dark: [31, 41, 55]
            };

            doc.setFillColor(...colors.primary);
            doc.rect(0, 0, 297, 25, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.text('CLUB BODY FORCE', 20, 12);
            doc.setFontSize(14);
            doc.text('Rapport de Suivi des Paiements', 20, 20);

            const today = new Date().toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            doc.setFontSize(10);
            doc.text(`Genere le ${today}`, 200, 20);

            doc.setTextColor(...colors.dark);
            let yPos = 40;

            doc.setFontSize(16);
            doc.text('Statistiques Globales', 20, yPos);
            yPos += 10;

            const statsData = [
                ['Total Attendu', `${stats.totalExpected.toLocaleString()} €`, `${payments.length} paiements`],
                ['Total Recu', `${stats.totalReceived.toLocaleString()} €`, `${stats.collectionRate.toFixed(1)}% collecte`],
                ['En Attente', `${stats.totalPending.toLocaleString()} €`, `${stats.pendingCount} paiements`],
                ['En Retard', `${stats.totalOverdue.toLocaleString()} €`, `${stats.overdueCount} paiements`]
            ];

            doc.autoTable({
                startY: yPos,
                head: [['Categorie', 'Montant', 'Details']],
                body: statsData,
                theme: 'grid',
                headStyles: { fillColor: colors.primary, textColor: [255, 255, 255] },
                styles: { fontSize: 10, cellPadding: 3 },
                columnStyles: {
                    0: { fontStyle: 'bold' },
                    1: { halign: 'right', fontStyle: 'bold' },
                    2: { fontSize: 9, textColor: colors.gray }
                }
            });

            yPos = doc.lastAutoTable.finalY + 15;

            doc.setFontSize(16);
            doc.text('Repartition par Methode de Paiement', 20, yPos);
            yPos += 10;

            const methodsData = ['carte', 'cheque', 'especes', 'autre'].map(method => {
                const methodPayments = payments.filter(p => p.method === method && p.is_paid);
                const total = methodPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                const percentage = stats.totalReceived > 0 ? (total / stats.totalReceived) * 100 : 0;
                const icon = method === 'carte' ? 'Carte' : method === 'cheque' ? 'Cheque' : method === 'especes' ? 'Especes' : 'Autre';
                return [icon, `${total.toFixed(2)} €`, `${percentage.toFixed(1)}%`, `${methodPayments.length} paiements`];
            });

            doc.autoTable({
                startY: yPos,
                head: [['Methode', 'Montant', 'Pourcentage', 'Nombre']],
                body: methodsData,
                theme: 'grid',
                headStyles: { fillColor: colors.success, textColor: [255, 255, 255] },
                styles: { fontSize: 10, cellPadding: 3 },
                columnStyles: {
                    1: { halign: 'right', fontStyle: 'bold' },
                    2: { halign: 'center', fontStyle: 'bold' },
                    3: { halign: 'center' }
                }
            });

            yPos = doc.lastAutoTable.finalY + 15;

            doc.setFontSize(16);
            doc.text(`Detail par Membre (${filteredMembers.length} membres)`, 20, yPos);
            yPos += 10;

            const membersData = filteredMembers.map(member => {
                const statusIcon = member.overallStatus === 'paid' ? 'Paye' : member.overallStatus === 'pending' ? 'En attente' : member.overallStatus === 'overdue' ? 'En retard' : 'Aucun';
                return [
                    `${member.firstName || ''} ${member.name || ''}`.trim(),
                    member.badgeId || 'N/A',
                    statusIcon,
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
                headStyles: { fillColor: colors.dark, textColor: [255, 255, 255] },
                styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 35 },
                    1: { cellWidth: 25, halign: 'center' },
                    2: { cellWidth: 30, halign: 'center' },
                    3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
                    4: { cellWidth: 40, halign: 'right' },
                    5: { cellWidth: 15, halign: 'center' },
                    6: { cellWidth: 25, halign: 'center' }
                }
            });

            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setDrawColor(...colors.gray);
                doc.line(20, 200, 277, 200);
                doc.setFontSize(8);
                doc.setTextColor(...colors.gray);
                doc.text('Club Body Force - Systeme de Gestion des Paiements', 20, 205);
                doc.text(`Page ${i} sur ${pageCount}`, 240, 205);
                doc.text(`Rapport genere automatiquement le ${new Date().toLocaleString('fr-FR')}`, 20, 210);
            }

            const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '_');
            const fileName = `Rapport_Paiements_${timestamp}.pdf`;
            doc.save(fileName);
        } catch (error) {
            console.error('❌ Erreur lors de l\'export PDF:', error);
            alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
        }
    };
    const exportToCSV = () => {
        try {
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

            const headers = Object.keys(csvData[0] || {});
            const csvContent = [
                headers.join(','),
                ...csvData.map(row =>
                    headers.map(header =>
                        `"${String(row[header]).replace(/"/g, '""')}"`
                    ).join(',')
                )
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Paiements_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
        } catch (error) {
            console.error('❌ Erreur lors de l\'export CSV:', error);
            alert('Erreur lors de la génération du CSV. Veuillez réessayer.');
        }
    };

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

    const renderMobileView = () => (
        <div className="space-y-4">
            {filteredMembers.map((member) => (
                <div key={member.id} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                    {member.photo ? (
                                        <img
                                            src={member.photo}
                                            alt="avatar"
                                            className="h-12 w-12 rounded-full object-cover border-2 border-gray-300"
                                        />
                                    ) : (
                                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                                            {member.firstName?.[0] || 'N'}{member.name?.[0] || 'N'}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-lg font-semibold text-gray-900 truncate">
                                        {member.firstName || 'Prénom'} {member.name || 'Nom'}
                                    </h4>
                                    <p className="text-sm text-gray-500">Badge: {member.badgeId || 'N/A'}</p>
                                </div>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(member.overallStatus)}`}>
                                {getStatusIcon(member.overallStatus)}
                                {getStatusLabel(member.overallStatus)}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-600">Progression</span>
                                    <span className="text-sm font-bold text-gray-900">{member.progressPercentage.toFixed(0)}%</span>
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

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <div className="text-sm font-medium text-gray-600 mb-1">Montants</div>
                                    <div className="text-sm">
                                        <div className="font-bold text-green-600">{member.totalPaid.toFixed(2)} €</div>
                                        <div className="text-gray-500">sur {member.totalDue.toFixed(2)} €</div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <div className="text-sm font-medium text-gray-600 mb-1">Paiements</div>
                                    <div className="text-sm">
                                        <div className="font-bold text-blue-600">{member.payments.filter(p => p.is_paid).length}</div>
                                        <div className="text-gray-500">sur {member.payments.length}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                            className="mt-3 w-full text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center justify-center gap-1 py-2 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                            {expandedMember === member.id ? (
                                <>
                                    <EyeOff className="w-4 h-4" />
                                    Masquer les détails
                                </>
                            ) : (
                                <>
                                    <Eye className="w-4 h-4" />
                                    Voir les détails
                                </>
                            )}
                        </button>
                    </div>
                    {expandedMember === member.id && (
                        <div className="border-t border-gray-200 bg-gray-50">
                            <div className="p-4 space-y-4">
                                <h5 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <CreditCard className="w-4 h-4" />
                                    Détail des paiements
                                </h5>

                                {member.payments.length > 0 ? (
                                    <div className="space-y-3">
                                        {member.payments.map((payment) => (
                                            <div key={payment.id} className="bg-white rounded-lg p-3 border">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(getPaymentStatus(payment))}`}>
                                                        {getStatusIcon(getPaymentStatus(payment))}
                                                        {getStatusLabel(getPaymentStatus(payment))}
                                                    </span>
                                                    <span className="text-sm font-medium text-gray-900">#{payment.id}</span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div>
                                                        <span className="text-gray-500">Montant:</span>
                                                        <div className="font-bold">{parseFloat(payment.amount || 0).toFixed(2)} €</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Méthode:</span>
                                                        <div className="flex items-center gap-1">
                                                            <span>{getPaymentMethodIcon(payment.method)}</span>
                                                            <span className="capitalize">{payment.method}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Date paiement:</span>
                                                        <div className="font-medium">
                                                            {payment.is_paid ? formatDate(payment.date_paiement) : 'Non payé'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Échéance:</span>
                                                        <div className="font-medium">
                                                            {formatDate(payment.encaissement_prevu)}
                                                        </div>
                                                    </div>
                                                </div>

                                                {payment.commentaire && (
                                                    <div className="mt-2 p-2 bg-gray-100 rounded text-sm">
                                                        <span className="text-gray-500">Commentaire:</span>
                                                        <div className="text-gray-700 mt-1">{payment.commentaire}</div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <CreditCard className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                        <p className="text-gray-500 text-sm">Aucun paiement enregistré</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-3">
                                    <div className="bg-blue-50 p-3 rounded-lg">
                                        <h6 className="font-medium text-blue-900 mb-2">Contact</h6>
                                        <div className="space-y-1 text-sm">
                                            <div className="text-blue-700">📧 {member.email || 'Non renseigné'}</div>
                                            <div className="text-blue-700">📞 {member.phone || 'Non renseigné'}</div>
                                        </div>
                                    </div>

                                    <div className="bg-green-50 p-3 rounded-lg">
                                        <h6 className="font-medium text-green-900 mb-2">Résumé financier</h6>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <div className="font-bold text-green-700">{member.totalPaid.toFixed(2)} €</div>
                                                <div className="text-green-600">Payé</div>
                                            </div>
                                            <div>
                                                <div className="font-bold text-orange-700">{(member.totalDue - member.totalPaid).toFixed(2)} €</div>
                                                <div className="text-orange-600">Restant</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );

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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 lg:p-6">
            <div className="max-w-7xl mx-auto">

                {/* Header - Responsive */}
                <div className="mb-6 lg:mb-8">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl lg:text-4xl font-bold text-gray-900 mb-2">Suivi des Paiements</h1>
                            <p className="text-gray-600">Gérez et suivez les paiements de vos membres</p>
                        </div>

                        {/* Boutons d'action - Responsive */}
                        <div className="flex flex-col sm:flex-row gap-2 lg:gap-3">
                            <button
                                onClick={exportToCSV}
                                disabled={loading || filteredMembers.length === 0}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 transition-colors text-sm font-medium"
                            >
                                <Download className="w-4 h-4" />
                                Exporter CSV
                            </button>
                            <button
                                onClick={exportToPDF}
                                disabled={loading || filteredMembers.length === 0}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
                            >
                                <Download className="w-4 h-4" />
                                Exporter PDF
                            </button>
                            <button
                                onClick={() => loadData(true)}
                                disabled={isRetrying}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
                            >
                                <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                                Actualiser
                            </button>
                        </div>
                    </div>
                </div>

                {/* Widgets statistiques - Responsive */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6 lg:mb-8">
                    {/* Total Attendu */}
                    <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border border-gray-200">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex-1">
                                <p className="text-xs lg:text-sm font-medium text-gray-600">Total Attendu</p>
                                <p className="text-lg lg:text-2xl font-bold text-gray-900">{stats.totalExpected.toLocaleString()} €</p>
                                <p className="text-xs text-gray-500 mt-1">{payments.length} paiement(s)</p>
                            </div>
                            <div className="hidden lg:block p-3 bg-blue-100 rounded-full">
                                <DollarSign className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    {/* Total Reçu */}
                    <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border border-gray-200">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex-1">
                                <p className="text-xs lg:text-sm font-medium text-gray-600">Total Reçu</p>
                                <p className="text-lg lg:text-2xl font-bold text-green-600">{stats.totalReceived.toLocaleString()} €</p>
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    {stats.collectionRate.toFixed(1)}%
                                </p>
                            </div>
                            <div className="hidden lg:block p-3 bg-green-100 rounded-full">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                        </div>
                    </div>

                    {/* En Attente */}
                    <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border border-gray-200">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex-1">
                                <p className="text-xs lg:text-sm font-medium text-gray-600">En Attente</p>
                                <p className="text-lg lg:text-2xl font-bold text-yellow-600">{stats.totalPending.toLocaleString()} €</p>
                                <p className="text-xs text-gray-500 mt-1">{stats.pendingCount} paiement(s)</p>
                            </div>
                            <div className="hidden lg:block p-3 bg-yellow-100 rounded-full">
                                <Clock className="w-6 h-6 text-yellow-600" />
                            </div>
                        </div>
                    </div>

                    {/* En Retard */}
                    <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border border-gray-200">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex-1">
                                <p className="text-xs lg:text-sm font-medium text-gray-600">En Retard</p>
                                <p className="text-lg lg:text-2xl font-bold text-red-600">{stats.totalOverdue.toLocaleString()} €</p>
                                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                    <TrendingDown className="w-3 h-3" />
                                    {stats.overdueCount} paiement(s)
                                </p>
                            </div>
                            <div className="hidden lg:block p-3 bg-red-100 rounded-full">
                                <AlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Barre de progression globale */}
                <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 mb-6 lg:mb-8 border border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">Progression Globale</h3>
                        <span className="text-xl lg:text-2xl font-bold text-blue-600">{stats.collectionRate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 lg:h-4">
                        <div
                            className="bg-gradient-to-r from-blue-500 to-green-500 h-3 lg:h-4 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${Math.min(stats.collectionRate, 100)}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mt-2">
                        <span>{stats.totalReceived.toLocaleString()} € reçus</span>
                        <span>{stats.totalExpected.toLocaleString()} € attendus</span>
                    </div>
                </div>

                {/* Filtres et recherche - Responsive */}
                <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 mb-6 border border-gray-200">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row gap-3">
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
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:w-48"
                            >
                                <option value="all">Tous les statuts</option>
                                <option value="paid">Payé</option>
                                <option value="pending">En attente</option>
                                <option value="overdue">En retard</option>
                                <option value="no_payments">Aucun paiement</option>
                            </select>

                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 sm:w-auto ${showFilters ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                <Filter className="w-4 h-4" />
                                <span className="hidden sm:inline">Filtres</span>
                            </button>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <p className="text-sm text-gray-600">
                                {filteredMembers.length} membre(s) affiché(s) sur {members.length}
                            </p>
                            {(searchTerm || statusFilter !== 'all') && (
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setStatusFilter('all');
                                    }}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium self-start sm:self-auto"
                                >
                                    Réinitialiser les filtres
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Contenu principal - Basculement entre vue mobile et desktop */}
                {isMobile ? (
                    // Vue mobile avec tuiles
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200">
                        <div className="px-4 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Membres ({filteredMembers.length})</h3>
                        </div>
                        <div className="p-4">
                            {filteredMembers.length > 0 ? (
                                renderMobileView()
                            ) : (
                                <div className="text-center py-12">
                                    <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun membre trouvé</h3>
                                    <p className="text-gray-500">Essayez de modifier vos critères de recherche</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // Vue desktop avec tableau
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

                                                            {/* Contact et résumé */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div className="bg-blue-50 p-3 rounded-lg">
                                                                    <h5 className="font-medium text-blue-900 mb-2">Informations de contact</h5>
                                                                    <div className="space-y-1 text-sm">
                                                                        <div className="text-blue-700">📧 {member.email || 'Email non renseigné'}</div>
                                                                        <div className="text-blue-700">📞 {member.phone || 'Téléphone non renseigné'}</div>
                                                                    </div>
                                                                </div>

                                                                <div className="bg-green-50 p-3 rounded-lg">
                                                                    <h5 className="font-medium text-green-900 mb-2">Résumé financier</h5>
                                                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                                                        <div>
                                                                            <div className="text-green-700 font-medium">{member.totalPaid.toFixed(2)} €</div>
                                                                            <div className="text-green-600">Total payé</div>
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-yellow-700 font-medium">{(member.totalDue - member.totalPaid).toFixed(2)} €</div>
                                                                            <div className="text-yellow-600">Reste à payer</div>
                                                                        </div>
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
                )}
                {/* Statistiques détaillées par méthode de paiement - Responsive */}
                <div className="mt-6 lg:mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                    <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition par Méthode</h3>
                        <div className="space-y-3">
                            {['carte', 'chèque', 'espèces', 'autre'].map(method => {
                                const methodPayments = payments.filter(p => p.method === method && p.is_paid);
                                const total = methodPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                                const percentage = stats.totalReceived > 0 ? (total / stats.totalReceived) * 100 : 0;

                                return (
                                    <div key={method} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg lg:text-xl">{getPaymentMethodIcon(method)}</span>
                                            <span className="font-medium capitalize text-gray-900">{method}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium text-sm lg:text-base">{total.toFixed(2)} €</div>
                                            <div className="text-xs lg:text-sm text-gray-500">{percentage.toFixed(1)}% • {methodPayments.length} paiement(s)</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Paiements Récents</h3>
                        <div className="space-y-3">
                            {payments
                                .filter(p => p.is_paid)
                                .slice(0, 5)
                                .map(payment => (
                                    <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="text-lg">{getPaymentMethodIcon(payment.method)}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm text-gray-900 truncate">
                                                    {payment.members?.firstName} {payment.members?.name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {formatDate(payment.date_paiement)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="font-medium text-sm lg:text-base text-green-600">{parseFloat(payment.amount).toFixed(2)} €</div>
                                        </div>
                                    </div>
                                ))}
                            {payments.filter(p => p.is_paid).length === 0 && (
                                <div className="text-center py-6 lg:py-8 text-gray-500">
                                    <Clock className="w-8 lg:w-12 h-8 lg:h-12 mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm">Aucun paiement récent</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Résumé global en pied de page */}
                <div className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-4 lg:p-6 text-white">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-2xl lg:text-3xl font-bold">{stats.totalMembers}</div>
                            <div className="text-sm lg:text-base text-blue-100">Membres total</div>
                        </div>
                        <div>
                            <div className="text-2xl lg:text-3xl font-bold">{stats.collectionRate.toFixed(1)}%</div>
                            <div className="text-sm lg:text-base text-blue-100">Taux de collecte</div>
                        </div>
                        <div>
                            <div className="text-2xl lg:text-3xl font-bold">{stats.paidCount + stats.pendingCount + stats.overdueCount}</div>
                            <div className="text-sm lg:text-base text-blue-100">Total paiements</div>
                        </div>
                    </div>
                </div>

                {/* Pied de page avec informations */}
                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-500">
                        Dernière mise à jour : {new Date().toLocaleString('fr-FR')}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        Club Body Force - Système de Gestion des Paiements v2.0
                    </p>
                </div>
            </div>
        </div>
    );
}

export default PaymentsPage;