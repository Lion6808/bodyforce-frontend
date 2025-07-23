{/* Liste des membres en tuiles (remplace le tableau) */ }
<div className="bg-white rounded-xl shadow-lg border border-gray-200">
    <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Membres ({filteredMembers.length})</h3>
    </div>

    <div className="p-4 sm:p-6">
        {filteredMembers.length > 0 ? (
            <div className="grid gap-4">
                {filteredMembers.map((member) => (
                    <div key={member.id} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                        {/* En-tête de la tuile */}
                        <div className="p-4">
                            <div className="flex items-center justify-between">
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
                                <div className="flex flex-col items-end space-y-2">
                                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(member.overallStatus)}`}>
                                        {getStatusIcon(member.overallStatus)}
                                        {getStatusLabel(member.overallStatus)}
                                    </span>
                                    <button
                                        onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                                    >
                                        {expandedMember === member.id ? (
                                            <>
                                                <EyeOff className="w-4 h-4" />
                                                Masquer
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="w-4 h-4" />
                                                Détails
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Informations principales */}
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {/* Progression */}
                                <div className="bg-white p-3 rounded-lg border">
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

                                {/* Montants */}
                                <div className="bg-white p-3 rounded-lg border">
                                    <div className="text-sm font-medium text-gray-600 mb-1">Montants</div>
                                    <div className="text-sm">
                                        <div className="font-bold text-green-600">{member.totalPaid.toFixed(2)} €</div>
                                        <div className="text-gray-500">sur {member.totalDue.toFixed(2)} €</div>
                                    </div>
                                </div>

                                {/* Dernière activité */}
                                <div className="bg-white p-3 rounded-lg border">
                                    <div className="text-sm font-medium text-gray-600 mb-1">Dernier paiement</div>
                                    <div className="text-sm">
                                        {member.lastPaymentDate ? (
                                            <div>
                                                <div className="font-medium text-gray-900">{formatDate(member.lastPaymentDate)}</div>
                                                <div className="text-gray-500">{member.payments.filter(p => p.is_paid).length} paiement(s)</div>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 italic">Aucun paiement</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section détails (expansible) */}
                        {expandedMember === member.id && (
                            <div className="border-t border-gray-200 bg-white">
                                <div className="p-4">
                                    <h5 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                        <CreditCard className="w-4 h-4" />
                                        Détail des paiements de {member.firstName} {member.name}
                                    </h5>

                                    {member.payments.length > 0 ? (
                                        <div className="space-y-3">
                                            {member.payments.map((payment) => (
                                                <div key={payment.id} className="bg-gray-50 rounded-lg p-3 border">
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(getPaymentStatus(payment))}`}>
                                                                    {getStatusIcon(getPaymentStatus(payment))}
                                                                    {getStatusLabel(getPaymentStatus(payment))}
                                                                </span>
                                                                <span className="text-sm font-medium text-gray-900">#{payment.id}</span>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                                <div>
                                                                    <span className="text-gray-500">Date de paiement:</span>
                                                                    <div className="font-medium">
                                                                        {payment.is_paid ? formatDateTime(payment.date_paiement) : 'Non payé'}
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

                                                        {/* Indicateur de statut visuel */}
                                                        <div className="flex items-center justify-center">
                                                            {payment.is_paid ? (
                                                                <div className="flex flex-col items-center text-green-600">
                                                                    <CheckCircle className="w-6 h-6" />
                                                                    <span className="text-xs font-medium mt-1">Encaissé</span>
                                                                </div>
                                                            ) : isOverdue(payment) ? (
                                                                <div className="flex flex-col items-center text-red-600">
                                                                    <AlertCircle className="w-6 h-6" />
                                                                    <span className="text-xs font-medium mt-1">En retard</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col items-center text-yellow-600">
                                                                    <Clock className="w-6 h-6" />
                                                                    <span className="text-xs font-medium mt-1">En attente</span>
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
                                            <p className="text-gray-500">Aucun paiement enregistré</p>
                                        </div>
                                    )}

                                    {/* Informations de contact */}
                                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="bg-blue-50 p-3 rounded-lg">
                                            <h6 className="font-medium text-blue-900 mb-2">Contact</h6>
                                            <div className="space-y-1 text-sm">
                                                <div className="text-blue-700">📧 {member.email || 'Non renseigné'}</div>
                                                <div className="text-blue-700">📞 {member.phone || 'Non renseigné'}</div>
                                            </div>
                                        </div>

                                        <div className="bg-green-50 p-3 rounded-lg">
                                            <h6 className="font-medium text-green-900 mb-2">Résumé financier</h6>
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <div className="font-bold text-green-700">{member.totalPaid.toFixed(2)} €</div>
                                                    <div className="text-green-600">Payé</div>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-orange-700">{(member.totalDue - member.totalPaid).toFixed(2)} €</div>
                                                    <div className="text-orange-600">Restant</div>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-blue-700">{member.payments.filter(p => p.is_paid).length}</div>
                                                    <div className="text-blue-600">Effectués</div>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-red-700">{member.payments.filter(p => !p.is_paid && isOverdue(p)).length}</div>
                                                    <div className="text-red-600">En retard</div>
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
        ) : (
            <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun membre trouvé</h3>
                <p className="text-gray-500">Essayez de modifier vos critères de recherche</p>
            </div>
        )}
    </div>
</div>

{/* Statistiques par méthode de paiement - Version mobile responsive */ }
<div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition par Méthode</h3>
        <div className="space-y-3">
            {['carte', 'chèque', 'espèces', 'autre'].map(method => {
                const methodPayments = payments.filter(p => p.method === method && p.is_paid);
                const total = methodPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                const percentage = stats.totalReceived > 0 ? (total / stats.totalReceived) * 100 : 0;

                return (
                    <div key={method} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{getPaymentMethodIcon(method)}</span>
                            <span className="font-medium capitalize text-gray-900">{method}</span>
                        </div>
                        <div className="text-right">
                            <div className="font-bold text-gray-900">{total.toFixed(2)} €</div>
                            <div className="text-sm text-gray-500">{percentage.toFixed(1)}% • {methodPayments.length} paiement(s)</div>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>

    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Paiements Récents</h3>
        <div className="space-y-3">
            {payments
                .filter(p => p.is_paid)
                .slice(0, 5)
                .map(payment => (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-xl">{getPaymentMethodIcon(payment.method)}</span>
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
                            <div className="font-bold text-green-600">{parseFloat(payment.amount).toFixed(2)} €</div>
                        </div>
                    </div>
                ))}
            {payments.filter(p => p.is_paid).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Aucun paiement récent</p>
                </div>
            )}
        </div>
    </div>
</div>
            </div >
        </div >
    );
}

export default PaymentsPage;>
                                                                                    <span className="text-gray-500">Montant:</span>
                                                                                    <div className="font-bold text-gray-900">{parseFloat(payment.amount || 0).toFixed(2)} €</div>
                                                                                </div >
                                                                                <div>
                                                                                    <span className="text-gray-500">Méthode:</span>
                                                                                    <div className="font-medium flex items-center gap-1">
                                                                                        <span>{getPaymentMethodIcon(payment.method)}</span>
                                                                                        <span className="capitalize">{payment.method}</span>
                                                                                    </div>
                                                                                </div>
                                                                                <divimport React, { useState, useEffect } from 'react';
// ✅ Import alternatif pour éviter les problèmes avec autoTable
import jsPDF from 'jspdf';
// On utilisera une approche alternative pour créer les tableaux
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

    // ✅ Fonction d'export PDF simplifiée (sans autoTable pour éviter les erreurs)
    const exportToPDF = () => {
        try {
            // Créer un nouveau document PDF
            const doc = new jsPDF();

            // En-tête du document
            doc.setFillColor(59, 130, 246);
            doc.rect(0, 0, 210, 25, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('CLUB BODY FORCE - RAPPORT PAIEMENTS', 20, 15);

            // Date du rapport
            const today = new Date().toLocaleDateString('fr-FR');
            doc.setFontSize(10);
            doc.text(`Généré le ${today}`, 20, 22);

            // Réinitialiser la couleur du texte
            doc.setTextColor(0, 0, 0);
            let yPos = 40;

            // Statistiques globales
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('STATISTIQUES GLOBALES', 20, yPos);
            yPos += 10;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Total Attendu: ${stats.totalExpected.toLocaleString()} €`, 20, yPos);
            yPos += 6;
            doc.text(`Total Reçu: ${stats.totalReceived.toLocaleString()} € (${stats.collectionRate.toFixed(1)}%)`, 20, yPos);
            yPos += 6;
            doc.text(`En Attente: ${stats.totalPending.toLocaleString()} € (${stats.pendingCount} paiements)`, 20, yPos);
            yPos += 6;
            doc.text(`En Retard: ${stats.totalOverdue.toLocaleString()} € (${stats.overdueCount} paiements)`, 20, yPos);
            yPos += 15;

            // Liste des membres
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(`DÉTAIL DES MEMBRES (${filteredMembers.length})`, 20, yPos);
            yPos += 10;

            filteredMembers.forEach((member, index) => {
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(`${member.firstName || ''} ${member.name || ''}`.trim(), 20, yPos);

                doc.setFont('helvetica', 'normal');
                yPos += 5;
                doc.text(`Badge: ${member.badgeId || 'N/A'} | Statut: ${getStatusLabel(member.overallStatus)}`, 25, yPos);
                yPos += 5;
                doc.text(`Progression: ${member.progressPercentage.toFixed(0)}% | Payé: ${member.totalPaid.toFixed(2)}€/${member.totalDue.toFixed(2)}€`, 25, yPos);
                yPos += 8;
            });

            // Sauvegarder le PDF
            const fileName = `Rapport_Paiements_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);

            console.log('✅ Export PDF réussi:', fileName);

        } catch (error) {
            console.error('❌ Erreur lors de l\'export PDF:', error);
            alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
        }
    };

    // ✅ Fonction d'export CSV
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
        <div className="min-h-screen bg-gray-50 p-4">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Suivi des Paiements</h1>

            <div className="flex flex-col sm:flex-row sm:justify-end gap-4 mb-6">
                <button
                    onClick={exportToPDF}
                    disabled={loading || payments.length === 0}
                    className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 text-sm"
                >
                    Exporter PDF
                </button>
                <button
                    onClick={exportToCSV}
                    disabled={loading || payments.length === 0}
                    className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 text-sm"
                >
                    Exporter CSV
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded shadow border">
                    <p className="text-sm text-gray-500">Total Attendu</p>
                    <p className="text-xl font-semibold text-gray-800">{stats.totalExpected.toFixed(2)} €</p>
                </div>
                <div className="bg-white p-4 rounded shadow border">
                    <p className="text-sm text-gray-500">Total Reçu</p>
                    <p className="text-xl font-semibold text-green-600">{stats.totalReceived.toFixed(2)} €</p>
                </div>
                <div className="bg-white p-4 rounded shadow border">
                    <p className="text-sm text-gray-500">En Attente</p>
                    <p className="text-xl font-semibold text-yellow-600">{stats.totalPending.toFixed(2)} €</p>
                </div>
                <div className="bg-white p-4 rounded shadow border">
                    <p className="text-sm text-gray-500">En Retard</p>
                    <p className="text-xl font-semibold text-red-600">{stats.totalOverdue.toFixed(2)} €</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Rechercher un membre..."
                    className="flex-1 px-4 py-2 border rounded w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border rounded"
                >
                    <option value="all">Tous</option>
                    <option value="paid">Payé</option>
                    <option value="pending">En attente</option>
                    <option value="overdue">En retard</option>
                    <option value="no_payments">Aucun paiement</option>
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredMembers.map(member => (
                    <div key={member.id} className="bg-white p-4 rounded shadow border">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                {member.photo ? (
                                    <img src={member.photo} alt="photo" className="w-12 h-12 rounded-full object-cover border" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                                        {member.firstName?.[0]}{member.name?.[0]}
                                    </div>
                                )}
                                <div>
                                    <p className="font-semibold text-gray-800">{member.firstName} {member.name}</p>
                                    <p className="text-sm text-gray-500">Badge : {member.badgeId || 'N/A'}</p>
                                </div>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded ${getStatusColor(member.overallStatus)}`}>{getStatusLabel(member.overallStatus)}</span>
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm text-gray-600">
                                Total dû : <span className="font-medium text-gray-800">{member.totalDue.toFixed(2)} €</span>
                            </p>
                            <p className="text-sm text-gray-600">
                                Total payé : <span className="font-medium text-green-600">{member.totalPaid.toFixed(2)} €</span>
                            </p>
                            <p className="text-sm text-gray-600">
                                Progression : <span className="font-medium text-blue-600">{member.progressPercentage.toFixed(0)}%</span>
                            </p>
                            {member.lastPaymentDate && (
                                <p className="text-sm text-gray-600">
                                    Dernier paiement : <span className="font-medium">{formatDate(member.lastPaymentDate)}</span>
                                </p>
                            )}
                            <button
                                className="mt-2 text-blue-600 hover:underline text-sm"
                                onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                            >
                                {expandedMember === member.id ? 'Masquer les détails' : 'Voir les paiements'}
                            </button>
                        </div>

                        {expandedMember === member.id && (
                            <div className="mt-4 border-t pt-3">
                                <h4 className="font-semibold text-sm text-gray-700 mb-2">Détails des paiements :</h4>
                                {(member.payments || []).length > 0 ? (
                                    <ul className="space-y-2">
                                        {member.payments.map(payment => (
                                            <li key={payment.id} className="text-sm text-gray-600 flex justify-between border rounded px-2 py-1">
                                                <span>{formatDate(payment.encaissement_prevu)} - {payment.method}</span>
                                                <span className={payment.is_paid ? 'text-green-600' : isOverdue(payment) ? 'text-red-600' : 'text-yellow-600'}>
                                                    {payment.is_paid ? 'Payé' : isOverdue(payment) ? 'En retard' : 'En attente'}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm italic text-gray-400">Aucun paiement enregistré</p>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default PaymentsPage;