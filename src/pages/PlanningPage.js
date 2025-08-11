import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext"; // si ce n'est pas déjà présent
import { supabase } from "../supabaseClient"; // ✅ vrai client Supabase
import * as XLSX from "xlsx";

import {
  Calendar,
  Users,
  Filter,
  Grid,
  List,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Clock,
  Search,
} from "lucide-react";

// === Utilitaires de formatage ===
const formatDate = (date, formatString) => {
  const options = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

  const locales = {
    "dd/MM/yyyy": { day: "2-digit", month: "2-digit", year: "numeric" },
    "dd/MM": { day: "2-digit", month: "2-digit" },
    "EEEE dd/MM/yyyy": { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" },
    "EEE dd": { weekday: "short", day: "2-digit" },
  };

  const opt = locales[formatString] || options;
  return new Intl.DateTimeFormat("fr-FR", opt).format(date);
};

const isWeekend = (date) => {
  const day = date.getDay(); // 0: dimanche, 6: samedi
  return day === 0 || day === 6;
};

// === Composant principal ===
const PlanningPage = () => {
  const { role } = useAuth();

  const [period, setPeriod] = useState("week"); // day | week | month | year
  const [startD, setStartD] = useState(new Date(new Date().setHours(0, 0, 0, 0)));
  const [endD, setEndD] = useState(new Date(new Date().setHours(23, 59, 59, 999)));

  const [members, setMembers] = useState([]);
  const [presences, setPresences] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState("");

  const [filterName, setFilterName] = useState("");
  const [filterBadge, setFilterBadge] = useState("");

  const [viewMode, setViewMode] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // =========================
  //  Chargement via Supabase
  // =========================
  const loadData = async (showRetryIndicator = false) => {
    try {
      if (showRetryIndicator) setIsRetrying(true);
      setLoading(true);
      setError("");

      // 1) Membres (pour noms & photos)
      const { data: mData, error: mErr } = await supabase
        .from("members")
        .select("id, name, firstName, badgeId, photo");
      if (mErr) throw mErr;
      setMembers(mData || []);

      // 2) Présences dans la plage
      const { data: pData, error: pErr } = await supabase
        .from("presences")
        .select("id, badgeId, timestamp")
        .gte("timestamp", startD.toISOString())
        .lt("timestamp", endD.toISOString())
        .order("timestamp", { ascending: false });
      if (pErr) throw pErr;
      setPresences(pData || []);
    } catch (err) {
      console.error("Erreur au chargement :", err);
      setError(err.message || "Erreur inattendue");
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    // Détection mobile
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    loadData();
  }, [startD, endD, period]);

  // Helpers de période
  const updateRange = (mode, base = startD) => {
    const d = new Date(base);
    if (mode === "day") {
      const s = new Date(d.setHours(0, 0, 0, 0));
      const e = new Date(d.setHours(23, 59, 59, 999));
      setStartD(s);
      setEndD(e);
    } else if (mode === "week") {
      const s = new Date(d);
      const day = s.getDay();
      const diff = (day === 0 ? -6 : 1) - day; // Lundi
      s.setDate(s.getDate() + diff);
      s.setHours(0, 0, 0, 0);
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      e.setHours(23, 59, 59, 999);
      setStartD(s);
      setEndD(e);
    } else if (mode === "month") {
      const s = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      setStartD(s);
      setEndD(e);
    } else {
      const s = new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
      const e = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
      setStartD(s);
      setEndD(e);
    }
  };

  const goPrev = () => {
    const base = new Date(startD);
    if (period === "day") base.setDate(base.getDate() - 1);
    else if (period === "week") base.setDate(base.getDate() - 7);
    else if (period === "month") base.setMonth(base.getMonth() - 1);
    else base.setFullYear(base.getFullYear() - 1);
    updateRange(period, base);
  };

  const goNext = () => {
    const base = new Date(startD);
    if (period === "day") base.setDate(base.getDate() + 1);
    else if (period === "week") base.setDate(base.getDate() + 7);
    else if (period === "month") base.setMonth(base.getMonth() + 1);
    else base.setFullYear(base.getFullYear() + 1);
    updateRange(period, base);
  };

  // Groupement par badge
  const groupedByMember = presences.reduce((acc, p) => {
    const key = p.badgeId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(new Date(p.timestamp));
    return acc;
  }, {});

  const getMemberInfo = (badgeId) =>
    members.find((m) => m.badgeId === badgeId) || {};

  const filteredMembers = Object.keys(groupedByMember)
    .map((badgeId) => getMemberInfo(badgeId))
    .filter((m) => {
      const fullName = `${m.firstName || ""} ${m.name || ""}`.toLowerCase();
      return (
        (!filterName || fullName.includes(filterName.toLowerCase())) &&
        (!filterBadge || m.badgeId?.includes(filterBadge))
      );
    })
    .sort((a, b) => `${a.firstName || ""} ${a.name || ""}`.localeCompare(`${b.firstName || ""} ${b.name || ""}`, "fr"));

  // ==================
  //  Import Excel (XLSX)
  // ==================
  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsRetrying(true);
      setError("");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const header = (rows[0] || []).map((h) => String(h || "").trim().toLowerCase());
      const idxBadge = header.findIndex((h) => ["badgeid", "badge", "badge_id", "id"].includes(h));
      const idxTs = header.findIndex((h) => ["timestamp", "datetime", "date"].includes(h));
      const body = rows.slice(1);
      const payload = [];
      for (const r of body) {
        const badgeId = String(r[idxBadge] || "").trim();
        if (!badgeId) continue;
        let ts = r[idxTs];
        if (header.includes("date") && header.includes("heure")) {
          const iD = header.indexOf("date");
          const iH = header.indexOf("heure");
          ts = `${r[iD]}T${r[iH] || "00:00"}`;
        }
        const d = new Date(ts);
        if (!isNaN(d)) payload.push({ badgeId, timestamp: d.toISOString() });
      }
      if (payload.length) {
        const { error: iErr } = await supabase.from("presences").insert(payload);
        if (iErr) throw iErr;
        await loadData();
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Échec import XLSX");
    } finally {
      setIsRetrying(false);
      e.target.value = "";
    }
  };

  // === RENDUS ===
  const HeaderCard = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 grid place-items-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Planning des présences</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Visualisez les présences des membres</p>
          </div>
        </div>

        {/* Boutons de vue + filtre */}
        <div className="flex flex-wrap justify-center sm:justify-end bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1 w-full sm:w-auto">
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-md transition-all min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ${viewMode === "list"
              ? "bg-white dark:bg-gray-600 shadow-md text-blue-600 dark:text-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            title="Vue liste"
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode("compact")}
            className={`p-2 rounded-md transition-all min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ${viewMode === "compact"
              ? "bg-white dark:bg-gray-600 shadow-md text-blue-600 dark:text-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            title="Vue compacte"
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-md transition-all min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ${viewMode === "grid"
              ? "bg-white dark:bg-gray-600 shadow-md text-blue-600 dark:text-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            title="Vue grille"
          >
            <Grid className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-lg transition-all min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ${showFilters
              ? "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            title="Afficher les filtres"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {role === "admin" && (
          <div className="w-full sm:w-auto">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 text-white font-semibold rounded-lg transition hover:brightness-[1.05] active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 min-h-[44px]">
              <input type="file" accept=".xlsx" onChange={handleImportExcel} className="hidden" />
              <Upload className="w-4 h-4" /> 📁 Importer fichier Excel (.xlsx)
            </label>
          </div>
        )}
      </div>

      {/* Navigation période */}
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={goPrev}
            className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors shadow-sm flex-shrink-0 min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ring-offset-2 ring-offset-white dark:ring-offset-gray-900"
            title="Période précédente"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 overflow-x-auto">
            {(() => {
              const days = [];
              const d = new Date(startD);
              while (d <= endD) {
                days.push(new Date(d));
                d.setDate(d.getDate() + 1);
              }
              return days.map((day, idx) => (
                <div
                  key={idx}
                  className={`p-2 border-b border-r border-gray-200 dark:border-gray-600 ${isWeekend(day)
                    ? "bg-blue-50 dark:bg-gray-700 text-blue-700 dark:text-blue-300"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                    }`}
                >
                  <div className="text-xs font-medium">{formatDate(day, "EEE dd").split(" ")[0]}</div>
                  <div className="text-sm font-semibold">{formatDate(day, "EEE dd").split(" ")[1]}</div>
                </div>
              ));
            })()}
          </div>

          <button
            onClick={goNext}
            className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors shadow-sm flex-shrink-0 min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ring-offset-2 ring-offset-white dark:ring-offset-gray-900"
            title="Période suivante"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Période</div>
            <div className="text-sm font-semibold">
              {formatDate(startD, "dd/MM/yyyy")} → {formatDate(endD, "dd/MM/yyyy")}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Vue</div>
            <div className="text-sm font-semibold">{isMobile ? "Liste (mobile)" : viewMode}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Membres visibles</div>
            <div className="text-sm font-semibold">{filteredMembers.length}</div>
          </div>
        </div>

        {/* Filtres */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-semibold mb-2">Filtrer par nom</div>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-500" />
                <input
                  type="search"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                  placeholder="Nom, prénom..."
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-semibold mb-2">Filtrer par badge</div>
              <input
                type="search"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                placeholder="Numéro de badge..."
                value={filterBadge}
                onChange={(e) => setFilterBadge(e.target.value)}
              />
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-semibold mb-2">Vue rapide</div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: "day", label: "Jour" },
                  { key: "week", label: "Semaine" },
                  { key: "month", label: "Mois" },
                  { key: "year", label: "Année" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setPeriod(opt.key);
                      updateRange(opt.key, startD);
                    }}
                    className={`px-3 py-2 rounded-md border ${period === opt.key
                      ? "bg-white dark:bg-gray-900 border-blue-300 dark:border-blue-700"
                      : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-white/60 dark:hover:bg-gray-900/60"
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const ListView = () => (
    <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="hidden md:grid grid-cols-[auto,1fr,120px,160px] bg-gray-50 dark:bg-gray-900 text-xs font-medium uppercase tracking-wide px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div />
        <div>Nom</div>
        <div>Heure</div>
        <div>Date</div>
      </div>
      {filteredMembers.map((member) => {
        const memberPresences = groupedByMember[member.badgeId] || [];
        return (
          <div
            key={member.badgeId}
            className="grid grid-cols-[auto,1fr,100px,110px] md:grid-cols-[auto,1fr,120px,160px] items-center gap-3 px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm"
          >
            {member.photo ? (
              <img
                src={member.photo}
                alt="avatar"
                className="w-10 h-10 object-cover rounded-full border border-blue-200 dark:border-blue-600 ring-2 ring-blue-500/40 dark:ring-blue-400/30"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full flex items-center justify-center font-semibold text-sm shadow-sm ring-2 ring-blue-500/40 dark:ring-blue-400/30">
                <ImageIcon className="w-4 h-4" />
              </div>
            )}

            <div className="truncate">
              <div className="font-medium">{member.firstName} {member.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <Users className="inline w-3 h-3 mr-1" /> Badge: {member.badgeId}
              </div>
            </div>

            <div className="text-gray-600 dark:text-gray-400">
              {memberPresences[0] ? (
                <>
                  <Clock className="inline w-3 h-3 mr-1" />
                  {new Date(memberPresences[0]).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </>
              ) : (
                "—"
              )}
            </div>

            <div className="text-gray-500 dark:text-gray-400">
              {memberPresences[0] ? formatDate(memberPresences[0], "dd/MM/yyyy") : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );

  const GridView = () => {
    const days = [];
    const d = new Date(startD);
    while (d <= endD) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }

    return (
      <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map((member) => {
          const memberPresences = groupedByMember[member.badgeId] || [];
          const totalPresencesInPeriod = memberPresences.length;

          return (
            <div
              key={member.badgeId}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-3">
                {member.photo ? (
                  <img
                    src={member.photo}
                    alt="avatar"
                    className="w-10 h-10 object-cover rounded-full border border-blue-200 dark:border-blue-600 ring-2 ring-blue-500/40 dark:ring-blue-400/30"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full flex items-center justify-center font-semibold text-sm shadow-sm ring-2 ring-blue-500/40 dark:ring-blue-400/30">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                )}
                <div className="truncate">
                  <div className="font-semibold">{member.firstName} {member.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Badge: {member.badgeId}
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-[11px] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                      {totalPresencesInPeriod} présence(s)
                    </span>
                  </div>
                </div>
              </div>

              {/* Pastilles par jour */}
              <div className="overflow-x-auto">
                <div className="flex items-center gap-2 min-w-[640px]">
                  {days.map((day) => {
                    const key = day.toISOString().slice(0, 10);
                    const dayPresences = memberPresences.filter((ts) => ts.toISOString().slice(0, 10) === key);
                    const hasPresences = dayPresences.length > 0;
                    return (
                      <div
                        key={`${member.badgeId}-${day.toISOString()}`}
                        className={`p-1.5 rounded text-center h-10 min-w-[48px] text-xs transition-all hover:scale-105 cursor-pointer ${hasPresences
                          ? isWeekend(day)
                            ? "bg-green-600 text-white shadow-sm"
                            : "bg-green-500 text-white shadow-sm"
                          : isWeekend(day)
                            ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                          }`}
                        title={`${formatDate(day, "EEE dd")} — ${hasPresences ? "Présent" : "—"}`}
                      >
                        <div className="font-medium text-xs">
                          {formatDate(day, "EEE dd").split(" ")[1]}
                        </div>
                        {hasPresences && (
                          <div className="text-[10px] font-bold mt-0.5">{dayPresences.length}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-full mx-auto">
        <HeaderCard />

        {error ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 justify-center text-red-600 dark:text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span className="font-semibold">Problème de connexion</span>
            </div>
            <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">{error}</div>
            <button
              onClick={() => loadData(true)}
              className="mt-4 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ring-offset-2 ring-offset-white dark:ring-offset-gray-900"
            >
              Réessayer
            </button>
          </div>
        ) : loading ? (
          <div className="min-h-[40vh] flex items-center justify-center">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Chargement…</span>
            </div>
          </div>
        ) : isMobile || viewMode === "list" ? (
          <ListView />
        ) : (
          <GridView />
        )}
      </div>
    </div>
  );
};

export default PlanningPage;
