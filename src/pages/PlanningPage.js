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
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
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
  addDays,
  fmtDayLong,
  sameDay,
} from "../components/planning/planningData";

const cx = (...c) => c.filter(Boolean).join(" ");

const VIEWS = [
  { id: "aujourdhui", label: "Aujourd'hui" },
  { id: "membre", label: "Membre" },
  { id: "controle", label: "Contrôle" },
];

const EXITS_KEY = "planning.showExits";
const REFRESH_MS = 5 * 60 * 1000; // egress : ~10 Ko par rafraîchissement

/** Vrai si la fenêtre fait au moins `px` de large (suivi en direct). */
function useMinWidth(px) {
  const query = `(min-width: ${px}px)`;
  const [ok, setOk] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setOk(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return ok;
}

function PlanningPage() {
  const { role } = useAuth();
  // ≥ 1024 px : mise en page ordinateur ; ≥ 1360 px : panneau d'assiduité à droite
  const isDesktop = useMinWidth(1024);
  const withAside = useMinWidth(1360);
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
    if (withAside) {
      setDesktopWho(row.who);
      return;
    }
    openMember(row.member_id);
  };

  const openDay = (d) => {
    setDesktopWho(null);
    setDay(d);
    setView("aujourdhui");
  };

  // Grand écran : sans clic, le panneau montre le dernier membre passé ce jour-là
  const firstMember = passages.find((p) => p.member_id);
  const effectiveWho = desktopWho || (firstMember ? `m${firstMember.member_id}` : null);
  const desktopMemberId = effectiveWho?.startsWith("m") ? Number(effectiveWho.slice(1)) : null;

  const changeDay = (d) => {
    setDesktopWho(null);
    setDay(d);
  };
  const isTodayShown = sameDay(day, new Date());
  // PC, vue Aujourd'hui : page à hauteur d'écran, seule la liste des passages défile
  const fixedLayout = isDesktop && view === "aujourdhui";

  return (
    <div className={fixedLayout ? "px-4 h-[calc(100vh-2rem)] flex flex-col" : "pb-4 lg:px-4"}>
      <div
        className={cx(
          "max-w-[1500px] w-full mx-auto",
          fixedLayout ? "flex-1 min-h-0 flex flex-col" : "space-y-4 lg:space-y-5"
        )}
      >
        {/* En-tête collé en haut de la zone qui défile */}
        <div className="sticky -top-4 z-30 -mx-4 -mt-4 px-4 pt-4 pb-3 lg:-mx-8 lg:px-8 lg:pt-5 lg:pb-5 bg-gray-100 dark:bg-gray-900">
        {/* En-tête */}
        <header className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3 lg:bg-transparent lg:dark:bg-transparent lg:border-0 lg:shadow-none lg:p-0 lg:space-y-0 lg:flex lg:items-center lg:gap-5">
          <div className="flex items-center justify-between lg:contents">
            <h1 className="text-2xl lg:text-[28px] font-bold tracking-tight text-gray-900 dark:text-white">Planning</h1>
            <button
              type="button"
              onClick={() => setToolsOpen(true)}
              aria-label="Outils (import, export, sorties)"
              className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-700 lg:bg-white lg:dark:bg-gray-800 lg:border lg:border-gray-200 lg:dark:border-gray-600 text-gray-700 dark:text-gray-200 flex items-center justify-center lg:order-last"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>
          <nav
            aria-label="Vues du planning"
            className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-700 lg:bg-gray-200/70 rounded-2xl p-1 lg:w-[420px] lg:flex-shrink-0"
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
          <div className="hidden lg:block lg:flex-1" />
          {isDesktop && view === "aujourdhui" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Jour précédent"
                onClick={() => changeDay(addDays(day, -1))}
                className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="min-w-[200px] text-center">
                <div className="text-[15px] font-semibold text-gray-900 dark:text-white">{fmtDayLong(day)}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {isTodayShown ? "Aujourd'hui" : (
                    <button type="button" onClick={() => changeDay(new Date())} className="text-blue-700 dark:text-blue-400 font-semibold hover:underline">
                      Revenir à aujourd'hui
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                aria-label="Jour suivant"
                disabled={isTodayShown}
                onClick={() => changeDay(addDays(day, 1))}
                className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 flex items-center justify-center disabled:text-gray-300 dark:disabled:text-gray-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </header>
        </div>

        {view === "aujourdhui" && (
          <div className={fixedLayout ? "flex-1 min-h-0 flex flex-col gap-3" : "space-y-3"}>
            {dayError && (
              <div className="bg-white dark:bg-gray-800 rounded-3xl border border-red-200 dark:border-red-800 p-4 text-sm text-red-600 dark:text-red-400">
                {dayError}
              </div>
            )}
            <TodayView
              day={day}
              onChangeDay={changeDay}
              passages={passages}
              loading={dayLoading}
              lastReceived={lastReceived}
              onRefresh={() => loadDay(day)}
              showExits={showExits}
              selectedWho={withAside ? effectiveWho : null}
              onSelectRow={onSelectRow}
              desktop={isDesktop}
              aside={
                !withAside ? null : desktopMemberId ? (
                  <MemberAttendance memberId={desktopMemberId} compact />
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                    Aucun membre passé ce jour-là.
                  </div>
                )
              }
            />
          </div>
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
