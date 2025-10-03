import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
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
  Search as SearchIcon,
  Filter,
  Download,
  Eye,
  EyeOff,
  Edit,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import Avatar from "../components/Avatar";
import MemberForm from "../components/MemberForm";
import { supabase, supabaseServices } from "../supabaseClient";

// ──────────────────────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 20;

// ──────────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────────
function PaymentsPage() {
  // Device / thème
  const [isMobile, setIsMobile] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    onResize();
    window.addEventListener("resize", onResize);
    const obs = new MutationObserver(() =>
      setIsDarkMode(document.documentElement.classList.contains("dark"))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      window.removeEventListener("resize", onResize);
      obs.disconnect();
    };
  }, []);

  // Données
  const [members, setMembers] = useState([]);      // sans photos
  const [payments, setPayments] = useState([]);    // tous les paiements
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // UI
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedMember, setExpandedMember] = useState(null);

  // Edition mobile
  const [showForm, setShowForm] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Photos (cache)
  // undefined => jamais tenté, null => NEGATIVE CACHE (pas de photo), string => dataURL
  const [photosCache, setPhotosCache] = useState({});
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────────
  // Fetch de base
  // ──────────────────────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");

      // 1) Membres (sans photo) pour réduire l'egress
      const m = await supabaseServices.getMembersWithoutPhotos();

      // 2) Paiements
      const { data: pays, error: e2 } = await supabase
        .from("payments")
        .select("*")
        .order("date_paiement", { ascending: false });

      if (e2) throw e2;
      setMembers(m || []);
      setPayments(pays || []);
    } catch (e) {
      console.error("fetchAll error:", e);
      setError(e.message || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // ──────────────────────────────────────────────────────────────────────────────
  // Enrichissement: rattacher les paiements aux membres
  // ──────────────────────────────────────────────────────────────────────────────
  const enrichedMembers = useMemo(() => {
    if (!members.length) return [];
    const byMember = new Map();
    for (const p of payments) {
      const key = p.member_id ?? p.memberId ?? p.user_id ?? p.memberID;
      if (!key) continue;
      const arr = byMember.get(key) || [];
      arr.push(p);
      byMember.set(key, arr);
    }
    return members.map((m) => {
      const list = byMember.get(m.id) || [];
      const totalPaid = list.reduce((s, p) => s + (Number(p.montant) || 0), 0);
      const lastDate = list.length
        ? list
            .map((p) => new Date(p.date_paiement || p.created_at || p.date || 0))
            .sort((a, b) => b - a)[0]
            .toISOString()
            .slice(0, 10)
        : null;
      const now = new Date();
      const paidThisMonth = list.some((p) => {
        const d = new Date(p.date_paiement || p.created_at || p.date || 0);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      const overallStatus = paidThisMonth ? "paid" : list.length ? "pending" : "no_payments";
      return { ...m, payments: list, totalPaid, lastPaymentDate: lastDate, overallStatus };
    });
  }, [members, payments]);

  // ──────────────────────────────────────────────────────────────────────────────
  // Filtre + recherche
  // ──────────────────────────────────────────────────────────────────────────────
  const filteredMembers = useMemo(() => {
    const q = (searchTerm || "").toLowerCase().trim();
    return enrichedMembers.filter((m) => {
      const hay = [m.name, m.firstName, m.badgeId, m.email, m.mobile, m.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const okSearch = !q || hay.includes(q);
      const okStatus = statusFilter === "all" || m.overallStatus === statusFilter;
      return okSearch && okStatus;
    });
  }, [enrichedMembers, searchTerm, statusFilter]);

  // ──────────────────────────────────────────────────────────────────────────────
  // Pagination (AVANT le useEffect des photos)
  // ──────────────────────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMembers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMembers, currentPage]);

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // Chargement lazy des photos pour la page courante
  // ──────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !paginatedMembers.length) return;
    const idsToLoad = paginatedMembers.map((m) => m.id).filter((id) => photosCache[id] === undefined);
    if (!idsToLoad.length) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingPhotos(true);
        const map = await supabaseServices.getMemberPhotos(idsToLoad);
        if (cancelled) return;
        setPhotosCache((prev) => {
          const next = { ...prev };
          for (const id of idsToLoad) {
            next[id] = map[id] || null; // null => negative cache
          }
          return next;
        });
      } catch (e) {
        console.error("Erreur chargement photos:", e);
      } finally {
        !cancelled && setLoadingPhotos(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, paginatedMembers, photosCache]);

  // ──────────────────────────────────────────────────────────────────────────────
  // Helpers UI
  // ──────────────────────────────────────────────────────────────────────────────
  const pill = (status) => {
    const theme = isDarkMode
      ? {
          paid: "text-green-400 bg-green-900/30",
          pending: "text-yellow-400 bg-yellow-900/30",
          overdue: "text-red-400 bg-red-900/30",
          no_payments: "text-gray-300 bg-gray-700/60",
        }
      : {
          paid: "text-green-700 bg-green-100",
          pending: "text-yellow-700 bg-yellow-100",
          overdue: "text-red-700 bg-red-100",
          no_payments: "text-gray-700 bg-gray-100",
        };
    return theme[status] || theme.no_payments;
  };

  const euros = (n) => `${(Number(n) || 0).toFixed(2)} €`;

  // ──────────────────────────────────────────────────────────────────────────────
  // Export CSV / PDF
  // ──────────────────────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ["ID", "Nom", "Prénom", "Badge", "Total payé", "Dernier paiement", "Statut"],
      ...filteredMembers.map((m) => [
        m.id,
        m.name || "",
        m.firstName || "",
        m.badgeId || "",
        String(m.totalPaid || 0).replace(".", ","),
        m.lastPaymentDate || "",
        m.overallStatus || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paiements_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF("landscape", "mm", "a4");
      const primary = [59, 130, 246];
      const white = [255, 255, 255];
      const black = [0, 0, 0];

      // Header
      doc.setFillColor(...primary);
      doc.rect(0, 0, 297, 20, "F");
      doc.setTextColor(...white);
      doc.setFontSize(16);
      doc.text("CLUB BODY FORCE — RAPPORT PAIEMENTS", 148.5, 12.5, { align: "center" });

      // Sous-titre
      doc.setTextColor(...black);
      doc.setFontSize(10);
      const now = new Date();
      const info = `Généré le ${now.toLocaleDateString("fr-FR")} • Membres filtrés: ${filteredMembers.length}`;
      doc.text(info, 148.5, 28, { align: "center" });

      // Colonnes
      const headers = ["ID", "Nom", "Prénom", "Badge", "Dernier paiement", "Total payé", "Statut"];
      const colX = [10, 25, 90, 155, 185, 225, 265];

      doc.setFontSize(9);
      doc.setFillColor(240);
      doc.rect(8, 32, 281, 8, "F");
      headers.forEach((h, i) => doc.text(h, colX[i], 38));

      // Lignes
      let y = 46;
      for (const m of filteredMembers) {
        if (y > 190) {
          doc.addPage("a4", "landscape");
          y = 20;
        }
        const row = [
          String(m.id),
          `${m.name || ""}`,
          `${m.firstName || ""}`,
          `${m.badgeId || ""}`,
          m.lastPaymentDate || "—",
          euros(m.totalPaid),
          m.overallStatus === "paid" ? "Payé (mois)" : m.overallStatus === "pending" ? "En attente" : "Aucun",
        ];
        row.forEach((cell, i) => doc.text(String(cell), colX[i], y));
        y += 7;
      }

      doc.save(`paiements_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error("exportToPDF error:", e);
      alert("Erreur lors de la génération du PDF.");
    }
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // Rendu
  // ──────────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border-b-2 border-blue-600 animate-spin" />
          <p className={isDarkMode ? "text-gray-300" : "text-gray-600"}>Chargement des paiements…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-xl border ${isDarkMode ? "bg-red-900/20 border-red-800 text-red-200" : "bg-red-50 border-red-200 text-red-700"}`}>
        <div className="font-semibold mb-2">Erreur</div>
        <div className="mb-4">{error}</div>
        <button
          onClick={fetchAll}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
        >
          Recharger
        </button>
      </div>
    );
  }

  const SummaryCard = ({ title, value, icon: Icon, accent }) => (
    <div className={`p-4 rounded-lg border flex items-center gap-3 ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
      <div className={`p-2 rounded-lg ${accent}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className={isDarkMode ? "text-gray-400 text-sm" : "text-gray-500 text-sm"}>{title}</div>
        <div className={isDarkMode ? "text-white text-xl font-bold" : "text-gray-900 text-xl font-bold"}>{value}</div>
      </div>
    </div>
  );

  const totalPaidAll = filteredMembers.reduce((s, m) => s + (m.totalPaid || 0), 0);

  return (
    <div className="px-2 sm:px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className={isDarkMode ? "text-white text-2xl font-bold" : "text-gray-900 text-2xl font-bold"}>Paiements</h1>
          <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
            {members.length} membres • {payments.length} paiements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${isDarkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
          >
            Actualiser
          </button>
          <button onClick={exportCSV} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button onClick={exportToPDF} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <SummaryCard title="Membres filtrés" value={filteredMembers.length} icon={Users} accent="bg-blue-100 text-blue-700" />
        <SummaryCard title="Total payé (filtré)" value={euros(totalPaidAll)} icon={DollarSign} accent="bg-green-100 text-green-700" />
        <SummaryCard title="Pages" value={`${currentPage} / ${Math.max(1, Math.ceil(filteredMembers.length / ITEMS_PER_PAGE))}`} icon={Calendar} accent="bg-purple-100 text-purple-700" />
      </div>

      {/* Barre d'actions */}
      <div className={`p-4 rounded-lg border mb-6 ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
          <div className="relative w-full lg:w-80">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Rechercher nom, prénom, badge…"
              className={`w-full pl-9 pr-3 py-2 rounded-lg border outline-none ${isDarkMode ? "bg-gray-700 border-gray-600 text-white placeholder-gray-300" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"}`}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${isDarkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            >
              <Filter className="w-4 h-4" />
              Filtres
            </button>

            {showFilters && (
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className={`px-3 py-2 rounded-lg border ${isDarkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"}`}
              >
                <option value="all">Tous les statuts</option>
                <option value="paid">Payé ce mois</option>
                <option value="pending">En attente</option>
                <option value="no_payments">Aucun paiement</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Pagination TOP */}
      {Math.ceil(filteredMembers.length / ITEMS_PER_PAGE) > 1 && (
        <PaginationBar currentPage={currentPage} totalPages={totalPages} onPage={goToPage} className="mb-4" />
      )}

      {/* Table Desktop */}
      <div className="hidden lg:block">
        <div className={`rounded-lg border overflow-hidden ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
          <table className="w-full">
            <thead className={isDarkMode ? "bg-gray-700" : "bg-gray-50"}>
              <tr>
                <th className="px-4 py-3 text-left">Membre</th>
                <th className="px-4 py-3 text-left">Badge</th>
                <th className="px-4 py-3 text-left">Dernier paiement</th>
                <th className="px-4 py-3 text-left">Total payé</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className={isDarkMode ? "divide-y divide-gray-700" : "divide-y divide-gray-200"}>
              {paginatedMembers.map((m) => (
                <React.Fragment key={m.id}>
                  <tr className={isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-50"}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar photo={photosCache[m.id] || null} firstName={m.firstName} name={m.name} size={40} />
                        <div>
                          <div className={isDarkMode ? "text-white font-medium" : "text-gray-900 font-medium"}>
                            {m.name} {m.firstName}
                          </div>
                          <div className={isDarkMode ? "text-gray-400 text-sm" : "text-gray-500 text-sm"}>{m.email || "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono">{m.badgeId || "—"}</td>
                    <td className="px-4 py-3">{m.lastPaymentDate || "—"}</td>
                    <td className="px-4 py-3">{euros(m.totalPaid)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${pill(m.overallStatus)}`}>
                        {m.overallStatus === "paid" ? "✅ Payé (mois)" : m.overallStatus === "pending" ? "⏳ En attente" : "— Aucun"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedMember((x) => (x === m.id ? null : m.id))}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded ${isDarkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-800"}`}
                        >
                          {expandedMember === m.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          Détails
                        </button>
                        <button
                          onClick={() => { setSelectedMember(m); setShowForm(true); }}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded ${isDarkMode ? "bg-blue-900/30 hover:bg-blue-900/50 text-blue-200" : "bg-blue-100 hover:bg-blue-200 text-blue-700"}`}
                        >
                          <Edit className="w-4 h-4" />
                          Modifier
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expandedMember === m.id && (
                    <tr>
                      <td colSpan={6} className={isDarkMode ? "bg-gray-900/30" : "bg-gray-50"}>
                        <div className="p-4">
                          <div className="font-medium mb-2">Historique des paiements</div>
                          {m.payments && m.payments.length ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className={isDarkMode ? "bg-gray-800" : "bg-white"}>
                                  <tr>
                                    <th className="px-3 py-2 text-left">Date</th>
                                    <th className="px-3 py-2 text-left">Montant</th>
                                    <th className="px-3 py-2 text-left">Moyen</th>
                                    <th className="px-3 py-2 text-left">Référence</th>
                                  </tr>
                                </thead>
                                <tbody className={isDarkMode ? "divide-y divide-gray-800" : "divide-y divide-gray-200"}>
                                  {m.payments.map((p) => (
                                    <tr key={p.id}>
                                      <td className="px-3 py-2">{new Date(p.date_paiement || p.created_at || p.date).toLocaleDateString("fr-FR")}</td>
                                      <td className="px-3 py-2">{euros(p.montant)}</td>
                                      <td className="px-3 py-2">{p.moyen || p.method || "—"}</td>
                                      <td className="px-3 py-2">{p.reference || p.ref || "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-sm opacity-60">Aucun paiement enregistré.</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards Mobile */}
      <div className="lg:hidden space-y-3">
        {paginatedMembers.map((m) => (
          <div key={m.id} className={`p-4 rounded-lg border ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
            <div className="flex items-start gap-3">
              <Avatar photo={photosCache[m.id] || null} firstName={m.firstName} name={m.name} size={48} />
              <div className="flex-1">
                <div className="font-semibold">{m.name} {m.firstName}</div>
                <div className="text-sm opacity-70">{m.email || "—"}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div><span className="opacity-60">Badge:</span> <span className="font-mono">{m.badgeId || "—"}</span></div>
                  <div><span className="opacity-60">Total:</span> {euros(m.totalPaid)}</div>
                  <div><span className="opacity-60">Dernier:</span> {m.lastPaymentDate || "—"}</div>
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${pill(m.overallStatus)}`}>
                      {m.overallStatus === "paid" ? "✅ Payé (mois)" : m.overallStatus === "pending" ? "⏳ En attente" : "— Aucun"}
                    </span>
                  </div>
                </div>

                {expandedMember === m.id && (
                  <div className="mt-3">
                    <div className="font-medium mb-2">Historique des paiements</div>
                    {m.payments && m.payments.length ? (
                      <div className="text-sm space-y-1">
                        {m.payments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between">
                            <span>{new Date(p.date_paiement || p.created_at || p.date).toLocaleDateString("fr-FR")}</span>
                            <span className="font-mono">{euros(p.montant)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm opacity-60">Aucun paiement enregistré.</div>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => setExpandedMember((x) => (x === m.id ? null : m.id))}
                    className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg ${isDarkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-800"}`}
                  >
                    {expandedMember === m.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    Détails
                  </button>
                  <button
                    onClick={() => { setSelectedMember(m); setShowForm(true); }}
                    className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg ${isDarkMode ? "bg-blue-900/30 hover:bg-blue-900/50 text-blue-200" : "bg-blue-100 hover:bg-blue-200 text-blue-700"}`}
                  >
                    <Edit className="w-4 h-4" />
                    Modifier
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination BOTTOM */}
      {Math.ceil(filteredMembers.length / ITEMS_PER_PAGE) > 1 && (
        <PaginationBar currentPage={currentPage} totalPages={totalPages} onPage={goToPage} className="mt-4" />
      )}

      {/* Résumé */}
      <div className={`mt-4 p-4 rounded-lg border text-sm ${isDarkMode ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
        <div className="flex items-center justify-between">
          <div>
            Affichage de {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredMembers.length)}
            {" "}sur {filteredMembers.length} membres filtrés • {members.length} total
          </div>
          {loadingPhotos && <div className="italic">Chargement des photos…</div>}
        </div>
      </div>

      {/* Modal d'édition mobile */}
      {showForm && isMobile && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-auto">
          <div className={`mt-6 mb-6 w-full max-w-3xl mx-4 rounded-xl shadow-xl ${isDarkMode ? "bg-gray-800" : "bg-white"}`}>
            <MemberForm
              member={selectedMember}
              onSave={async () => {
                setShowForm(false);
                setSelectedMember(null);
                await fetchAll();
              }}
              onCancel={() => { setShowForm(false); setSelectedMember(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Pagination (numéros + ellipses) — même UX que MembersPage
// ──────────────────────────────────────────────────────────────────────────────
function PaginationBar({ currentPage, totalPages, onPage, className = "" }) {
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) pages.push(i);
  }
  const withEllipsis = [];
  for (let i = 0; i < pages.length; i++) {
    withEllipsis.push(pages[i]);
    if (i < pages.length - 1 && pages[i + 1] !== pages[i] + 1) withEllipsis.push("…");
  }

  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border ${className} bg-white/50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700`}>
      <div className="text-sm opacity-70">Page {currentPage} sur {totalPages}</div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Précédent</span>
        </button>
        <div className="hidden sm:flex items-center gap-1">
          {withEllipsis.map((p, idx) =>
            p === "…" ? (
              <span key={`e-${idx}`} className="px-2 opacity-60">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p)}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  p === currentPage
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                }`}
              >
                {p}
              </button>
            )
          )}
        </div>
        <button
          onClick={() => onPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
        >
          <span className="hidden sm:inline">Suivant</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default PaymentsPage;
