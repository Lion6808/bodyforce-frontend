/**
 * PlanningPage.js — v2.11.0
 *
 * Page Planning organisée autour des trois usages réels :
 *   - Aujourd'hui : qui est venu ce jour-là (fil chronologique)
 *   - Membre      : assiduité d'un membre précis (calendrier + horaires)
 *   - Contrôle    : anomalies des 30 derniers jours (expirés qui passent,
 *                   badges inconnus, passages de nuit, badges hors période)
 * Les outils (import Excel, export, sorties) sont dans la feuille « Outils ».
 *
 * Une vue = un fichier dans components/planning/.
 * Vue et membre sont dans l'URL (?vue=membre&membre=12) : le bouton retour
 * du téléphone et le retour depuis la fiche membre restent cohérents.
 *
 * Données : RPC get_planning_passages, get_planning_anomalies,
 * get_member_presences (lien présence → membre via badge_history daté).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import TodayView from "../components/planning/TodayView";
import MemberView from "../components/planning/MemberView";
import MemberAttendance from "../components/planning/MemberAttendance";
import ControlView from "../components/planning/ControlView";
import ToolsSheet from "../components/planning/ToolsSheet";
import {
  buildControlSections,
  fetchAnomalies,
  fetchDayPassages,
  fetchLastPassageTime,
  fetchSeen,
  sameDay,
} from "../components/planning/planningData";

const cx = (...c) => c.filter(Boolean).join(" ");

const VIEWS = [
  { id: "aujourdhui", label: "Aujourd'hui" },
  { id: "membre", label: "Membre" },
  { id: "controle", label: "Contrôle" },
];

const EXITS_KEY = "planning.showExits";
const REFRESH_MS = 2 * 60 * 1000;

/** Grand écran (≥ 1024 px) : panneau d'assiduité à droite du fil du jour. */
function useIsDesktop() {
  const query = "(min-width: 1024px)";
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return desktop;
}

function PlanningPage() {
  const { role } = useAuth();
  const isDesktop = useIsDesktop();
  const [params, setParams] = useSearchParams();

  const view = VIEWS.some((v) => v.id === params.get("vue")) ? params.get("vue") : "aujourdhui";
  const memberId = Number(params.get("membre")) || null;

  const setView = (id, extra = {}) => {
    const next = new URLSearchParams(params);
    next.set("vue", id);
    Object.entries(extra).forEach(([k, v]) => (v == null ? next.delete(k) : next.set(k, String(v))));
    setParams(next, { replace: false });
  };

  // ------------------------------------------------------------------
  // Journée affichée
  // ------------------------------------------------------------------
  const [day, setDay] = useState(() => new Date());
  const [passages, setPassages] = useState([]);
  const [dayLoading, setDayLoading] = useState(true);
  const [dayError, setDayError] = useState("");
  const [lastReceived, setLastReceived] = useState(null);
  const [desktopWho, setDesktopWho] = useState(null);

  const [showExits, setShowExits] = useState(() => {
    try {
      return localStorage.getItem(EXITS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const loadDay = useCallback(async (d) => {
    setDayLoading(true);
    setDayError("");
    try {
      const [rows, last] = await Promise.all([fetchDayPassages(d), fetchLastPassageTime()]);
      setPassages(rows);
      setLastReceived(last);
    } catch (e) {
      setDayError(e.message);
    } finally {
      setDayLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDay(day);
  }, [day, loadDay]);

  // Rafraîchissement automatique quand on regarde aujourd'hui
  useEffect(() => {
    if (view !== "aujourdhui" || !sameDay(day, new Date())) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadDay(day);
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [view, day, loadDay]);

  // ------------------------------------------------------------------
  // Contrôle (chargé dès l'ouverture : la pastille du nombre de points)
  // ------------------------------------------------------------------
  const [anomalies, setAnomalies] = useState(null);
  const [seen, setSeen] = useState({});
  const [controlLoading, setControlLoading] = useState(false);
  const [controlError, setControlError] = useState("");

  const loadControl = useCallback(async () => {
    setControlLoading(true);
    setControlError("");
    try {
      const [a, s] = await Promise.all([fetchAnomalies(), fetchSeen()]);
      setAnomalies(a);
      setSeen(s);
    } catch (e) {
      setControlError(e.message);
    } finally {
      setControlLoading(false);
    }
  }, []);

  const reloadSeen = useCallback(async () => {
    try {
      setSeen(await fetchSeen());
    } catch (e) {
      setControlError(e.message);
    }
  }, []);

  useEffect(() => {
    loadControl();
  }, [loadControl]);

  const control = useMemo(() => (anomalies ? buildControlSections(anomalies, seen) : null), [anomalies, seen]);

  // ------------------------------------------------------------------
  // Navigation entre vues
  // ------------------------------------------------------------------
  const [toolsOpen, setToolsOpen] = useState(false);
  const closeTools = useCallback(() => setToolsOpen(false), []);

  const openMember = (id) => setView("membre", { membre: id });

  const onSelectRow = (row) => {
    if (row.kind === "inconnu") {
      setView("controle");
      return;
    }
    if (isDesktop) {
      setDesktopWho(row.who);
      return;
    }
    openMember(row.member_id);
  };

  const openDay = (d) => {
    setDay(d);
    setView("aujourdhui");
  };

  const desktopMemberId = desktopWho?.startsWith("m") ? Number(desktopWho.slice(1)) : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 pt-4 pb-28 lg:pb-8">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* En-tête */}
        <header className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3 lg:flex lg:items-center lg:gap-6 lg:space-y-0">
          <div className="flex items-center justify-between lg:justify-start lg:gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Planning</h1>
            <button
              type="button"
              onClick={() => setToolsOpen(true)}
              aria-label="Outils (import, export, sorties)"
              className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center lg:order-last"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>
          <nav
            aria-label="Vues du planning"
            className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-700 rounded-2xl p-1 lg:w-[460px]"
          >
            {VIEWS.map((v) => {
              const on = v.id === view;
              const badge = v.id === "controle" && control?.remaining ? control.remaining : 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-current={on ? "page" : undefined}
                  onClick={() => setView(v.id)}
                  className={cx(
                    "h-9 rounded-xl flex items-center justify-center gap-1.5 text-sm",
                    on
                      ? "bg-white dark:bg-gray-800 shadow-sm font-semibold text-gray-900 dark:text-white"
                      : "font-medium text-gray-600 dark:text-gray-300"
                  )}
                >
                  {v.label}
                  {badge > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-orange-600 text-white text-xs font-bold inline-flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </header>

        {view === "aujourdhui" && (
          <>
            {dayError && (
              <div className="bg-white dark:bg-gray-800 rounded-3xl border border-red-200 dark:border-red-800 p-4 text-sm text-red-600 dark:text-red-400">
                {dayError}
              </div>
            )}
            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6 lg:items-start">
              <TodayView
                day={day}
                onChangeDay={setDay}
                passages={passages}
                loading={dayLoading}
                lastReceived={lastReceived}
                onRefresh={() => loadDay(day)}
                showExits={showExits}
                selectedWho={isDesktop ? desktopWho : null}
                onSelectRow={onSelectRow}
              />
              {isDesktop && (
                <aside aria-label="Assiduité du membre sélectionné" className="lg:sticky lg:top-4">
                  {desktopMemberId ? (
                    <MemberAttendance memberId={desktopMemberId} compact />
                  ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                      Cliquez sur un passage pour voir l'assiduité du membre.
                    </div>
                  )}
                </aside>
              )}
            </div>
          </>
        )}

        {view === "membre" && <MemberView memberId={memberId} onSelectMember={openMember} />}

        {view === "controle" && (
          <ControlView
            control={control}
            loading={controlLoading}
            error={controlError}
            onSeenChange={reloadSeen}
            onOpenMember={openMember}
            onOpenDay={openDay}
          />
        )}
      </div>

      <ToolsSheet
        open={toolsOpen}
        onClose={closeTools}
        isAdmin={role === "admin"}
        day={day}
        passages={passages}
        lastReceived={lastReceived}
        showExits={showExits}
        onToggleExits={() =>
          setShowExits((v) => {
            try {
              localStorage.setItem(EXITS_KEY, v ? "0" : "1");
            } catch {
              /* stockage indisponible */
            }
            return !v;
          })
        }
        onImported={() => {
          loadDay(day);
          loadControl();
        }}
      />
    </div>
  );
}

export default PlanningPage;
