import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";
import styles from "./PlanningPage.module.css";

// Client Supabase direct
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

// Utilitaires de date corrigés
const formatDate = (date, formatStr) => {
  const options = {
    "yyyy-MM-dd": { year: "numeric", month: "2-digit", day: "2-digit" },
    "dd/MM/yyyy": { day: "2-digit", month: "2-digit", year: "numeric" },
    "EEE dd/MM": { weekday: "short", day: "2-digit", month: "2-digit" },
    "EEE dd": { weekday: "short", day: "2-digit" },
    "HH:mm": { hour: "2-digit", minute: "2-digit", hour12: false },
  };

  if (formatStr === "yyyy-MM-dd") {
    return date.toISOString().split("T")[0];
  }

  return new Intl.DateTimeFormat("fr-FR", options[formatStr] || {}).format(date);
};

const parseTimestamp = (timestamp) => new Date(timestamp);

const toDateString = (date) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const isWithinInterval = (date, interval) => {
  return date >= interval.start && date <= interval.end;
};

const eachDayOfInterval = (interval) => {
  const days = [];
  const current = new Date(interval.start);

  while (current <= interval.end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
};

const startOfDay = (date) => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

const endOfDay = (date) => {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

const addWeeks = (date, weeks) => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + weeks * 7);
  return newDate;
};

const addMonths = (date, months) => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
};

const addYears = (date, years) => {
  const newDate = new Date(date);
  newDate.setFullYear(newDate.getFullYear() + years);
  return newDate;
};

const subWeeks = (date, weeks) => addWeeks(date, -weeks);

function PlanningPage() {
  const [presences, setPresences] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const [period, setPeriod] = useState("week");
  const [startDate, setStartDate] = useState(startOfDay(subWeeks(new Date(), 1)));
  const [endDate, setEndDate] = useState(endOfDay(new Date()));

  const [filterBadge, setFilterBadge] = useState("");
  const [filterName, setFilterName] = useState("");
  const [showNightHours, setShowNightHours] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const loadData = async (showRetryIndicator = false) => {
    try {
      if (showRetryIndicator) {
        setIsRetrying(true);
      }
      setLoading(true);
      setError("");

      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("*");

      if (membersError) throw new Error(`Erreur membres: ${membersError.message}`);
      setMembers(Array.isArray(membersData) ? membersData : []);

      let allPresences = [];
      let from = 0;
      const pageSize = 1000;
      let done = false;

      while (!done) {
        const { data, error: presencesError } = await supabase
          .from("presences")
          .select("*")
          .gte("timestamp", startDate.toISOString())
          .lte("timestamp", endDate.toISOString())
          .order("timestamp", { ascending: false })
          .range(from, from + pageSize - 1);

        if (presencesError) throw new Error(`Erreur présences: ${presencesError.message}`);
        
        if (data && data.length > 0) {
          allPresences = [...allPresences, ...data];
          from += pageSize;
        } else {
          done = true;
        }
      }

      const transformedPresences = allPresences.map((p) => ({
        badgeId: p.badgeId,
        timestamp: p.timestamp,
        parsedDate: parseTimestamp(p.timestamp),
      }));

      setPresences(transformedPresences);
      setRetryCount(0);
    } catch (err) {
      console.error("💥 Erreur lors du chargement des données:", err);
      setError(err.message || "Erreur de connexion à la base de données");
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    loadData(true);
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const updateDateRange = (value, base = new Date()) => {
    const start = startOfDay(base);
    let end = endOfDay(base);
    if (value === "week") end = endOfDay(addWeeks(start, 1));
    if (value === "month") end = endOfDay(addMonths(start, 1));
    if (value === "year") end = endOfDay(addYears(start, 1));
    setStartDate(start);
    setEndDate(end);
  };

  const navigatePeriod = (direction) => {
    const amount = direction === "prev" ? -1 : 1;
    let newStart;
    if (period === "week") newStart = addWeeks(startDate, amount);
    else if (period === "month") newStart = addMonths(startDate, amount);
    else newStart = addYears(startDate, amount);
    updateDateRange(period, newStart);
  };

  const toLocalDate = (timestamp) => parseTimestamp(timestamp);

  const renderConnectionError = () => (
    <div className={styles.statusPageContainer}>
      <div className={styles.statusCard}>
        <AlertCircle className={styles.errorIcon} />
        <h2 className={styles.statusCardTitle}>Problème de connexion</h2>
        <p className={styles.statusCardText}>{error}</p>
        <button onClick={handleRetry} disabled={isRetrying} className={styles.statusButton}>
          {isRetrying ? (
            <>
              <RefreshCw className={`${styles.statusButtonIcon} ${styles.statusButtonIconSpin}`} />
              Reconnexion...
            </>
          ) : (
            <>
              <RefreshCw className={styles.statusButtonIcon} />
              Réessayer
            </>
          )}
        </button>
        {retryCount > 0 && (
          <p className={styles.retryCountText}>Tentative {retryCount + 1}</p>
        )}
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingContent}>
        <div className={styles.loadingSpinnerContainer}>
          <RefreshCw className={styles.loadingSpinner} />
        </div>
        <h2 className={styles.loadingTitle}>
          {isRetrying ? "Reconnexion en cours..." : "Chargement du planning..."}
        </h2>
        <p className={styles.loadingSubtitle}>
          Période: {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
        </p>
      </div>
    </div>
  );

  if (loading) return renderLoading();
  if (error && !isRetrying) return renderConnectionError();

  const filteredPresences = presences.filter((p) =>
    isWithinInterval(toLocalDate(p.timestamp), { start: startDate, end: endDate })
  );

  const groupedByMember = {};
  filteredPresences.forEach((p) => {
    const key = p.badgeId;
    if (!groupedByMember[key]) groupedByMember[key] = [];
    groupedByMember[key].push(toLocalDate(p.timestamp));
  });

  const allDays = eachDayOfInterval({ start: startDate, end: endDate });
  const fullHours = Array.from({ length: 24 }, (_, i) => i);
  const hours = showNightHours ? fullHours : fullHours.slice(6);

  const getMemberInfo = (badgeId) => members.find((m) => m.badgeId === badgeId) || {};

  const visibleMembers = Object.keys(groupedByMember)
    .map((badgeId) => getMemberInfo(badgeId))
    .filter(
      (m) =>
        (!filterName || `${m.name} ${m.firstName}`.toLowerCase().includes(filterName.toLowerCase())) &&
        (!filterBadge || m.badgeId?.includes(filterBadge))
    );

  const ListView = () => (
    <div className={styles.listViewContainer}>
      {visibleMembers.map((member) => {
        const memberPresences = groupedByMember[member.badgeId] || [];
        const dailyPresences = {};
        memberPresences.forEach((timestamp) => {
          const dayKey = toDateString(timestamp);
          if (!dailyPresences[dayKey]) dailyPresences[dayKey] = [];
          dailyPresences[dayKey].push(timestamp);
        });
        const totalPresencesInPeriod = memberPresences.length;

        return (
          <div key={member.badgeId} className={styles.memberCardList}>
            <div className={styles.memberHeaderList}>
              {member.photo ? (
                <img src={member.photo} alt="avatar" className={styles.memberAvatar} />
              ) : (
                <div className={styles.memberInitials}>
                  {member.firstName?.[0]}
                  {member.name?.[0]}
                </div>
              )}
              <div className={styles.memberInfoList}>
                <h3 className={styles.memberNameList}>{member.name} {member.firstName}</h3>
                <div className={styles.memberMetaList}>
                  <span className={styles.memberBadgeId}>Badge: {member.badgeId}</span>
                  <span className={styles.memberPresenceCount}>{totalPresencesInPeriod} présence(s)</span>
                </div>
              </div>
            </div>

            <div className={styles.daysGridList}>
              {allDays.map((day) => {
                const dayKey = toDateString(day);
                const dayPresences = dailyPresences[dayKey] || [];
                const hasPresences = dayPresences.length > 0;

                return (
                  <div key={dayKey} className={styles.dayCellList}>
                    <div
                      className={`${styles.dayCellContent} ${
                        hasPresences
                          ? styles.dayCellPresent
                          : isWeekend(day)
                          ? styles.dayCellWeekend
                          : styles.dayCellNormal
                      }`}
                    >
                      <div className={styles.dayCellDate}>{formatDate(day, "EEE dd").split(" ")[1]}</div>
                      {hasPresences && <div className={styles.dayCellPresenceCount}>{dayPresences.length}</div>}
                    </div>

                    {hasPresences && (
                      <div className={styles.tooltip}>
                        <div className={styles.tooltipContent}>
                          <div className={styles.tooltipHeader}>{formatDate(day, "EEE dd/MM")}</div>
                          <div className={styles.tooltipBody}>
                            {dayPresences.slice(0, 3).map((p, idx) => (
                              <div key={idx} className={styles.tooltipTime}>{formatDate(p, "HH:mm")}</div>
                            ))}
                            {dayPresences.length > 3 && (
                              <div className={styles.tooltipMore}>+{dayPresences.length - 3} autres</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const CompactView = () => (
    <div className={styles.compactViewContainer}>
      <div className={styles.compactViewScroll}>
        <div className={styles.compactViewGrid}>
          <div className={styles.compactViewGridInner} style={{ gridTemplateColumns: `180px repeat(${allDays.length}, minmax(100px, 1fr))` }}>
            <div className={styles.compactHeaderCell}>
              <Users className={styles.compactHeaderIcon} />
              Membres
            </div>
            {allDays.map((day) => (
              <div
                key={day.toISOString()}
                className={`${styles.compactDayHeader} ${
                  isWeekend(day) ? styles.compactDayHeaderWeekend : styles.compactDayHeaderNormal
                }`}
              >
                <div className={styles.compactDayDate}>{formatDate(day, "EEE dd")}</div>
                <div className={styles.compactDayMonth}>{formatDate(day, "dd/MM").split("/")[1]}</div>
              </div>
            ))}
            {visibleMembers.map((member, idx) => (
              <React.Fragment key={member.badgeId}>
                <div
                  className={`${styles.compactMemberCell} ${
                    idx % 2 === 0 ? styles.compactMemberCellEven : styles.compactMemberCellOdd
                  }`}
                >
                  {member.photo ? (
                    <img src={member.photo} alt="avatar" className={styles.compactMemberAvatar} />
                  ) : (
                    <div className={styles.compactMemberInitials}>
                      {member.firstName?.[0]}
                      {member.name?.[0]}
                    </div>
                  )}
                  <div className={styles.compactMemberInfo}>
                    <div className={styles.compactMemberName}>{member.name}</div>
                    <div className={styles.compactMemberFirstName}>{member.firstName}</div>
                  </div>
                </div>
                {allDays.map((day) => {
                  const times = groupedByMember[member.badgeId] || [];
                  const dayPresences = times.filter((t) => toDateString(t) === toDateString(day));

                  return (
                    <div
                      key={`${member.badgeId}-${day.toISOString()}`}
                      className={`${styles.compactDataCell} ${
                        dayPresences.length > 0
                          ? styles.compactDataCellPresent
                          : isWeekend(day)
                          ? styles.compactDataCellWeekend
                          : idx % 2 === 0
                          ? styles.compactDataCellEven
                          : styles.compactDataCellOdd
                      }`}
                    >
                      {dayPresences.length > 0 && (
                        <div className={styles.presenceTimesContainer}>
                          {dayPresences.slice(0, 3).map((time, tidx) => (
                            <div key={tidx} className={styles.presenceTimeChip}>
                              {formatDate(time, "HH:mm")}
                            </div>
                          ))}
                          {dayPresences.length > 3 && (
                            <div className={styles.presenceMoreChip}>+{dayPresences.length - 3}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const GridView = () => (
    <div className={styles.gridViewContainer}>
      <div className={styles.gridViewScroll}>
        <div className={styles.gridViewGrid}>
          <div className={styles.gridViewGridInner} style={{ gridTemplateColumns: `220px repeat(${allDays.length * hours.length}, 45px)` }}>
            <div className={styles.gridHeaderCell}>
              <div className={styles.gridHeaderContent}>
                <Users className={styles.gridHeaderIcon} />
                <div className={styles.gridHeaderText}>Membres</div>
              </div>
            </div>
            {allDays.map((day, dIdx) =>
              hours.map((h, hIdx) => (
                <div
                  key={`header-${dIdx}-${h}`}
                  className={`${styles.gridTimeHeader} ${
                    isWeekend(day) ? styles.gridTimeHeaderWeekend : styles.gridTimeHeaderNormal
                  }`}
                >
                  {hIdx === 0 && <div className={styles.gridTimeHeaderDate}>{formatDate(day, "EEE dd/MM")}</div>}
                  <div className={styles.gridTimeHeaderHour}>{`${h.toString().padStart(2, "0")}h`}</div>
                </div>
              ))
            )}
            {visibleMembers.map((member, idx) => (
              <React.Fragment key={member.badgeId}>
                <div
                  className={`${styles.gridMemberCell} ${
                    idx % 2 === 0 ? styles.gridMemberCellEven : styles.gridMemberCellOdd
                  }`}
                >
                  {member.photo ? (
                    <img src={member.photo} alt="avatar" className={styles.gridMemberAvatar} />
                  ) : (
                    <div className={styles.gridMemberInitials}>
                      {member.firstName?.[0]}
                      {member.name?.[0]}
                    </div>
                  )}
                  <div className={styles.gridMemberInfo}>
                    <span className={styles.gridMemberName}>{member.name} {member.firstName}</span>
                    <span className={styles.gridMemberPresenceCount}>
                      {groupedByMember[member.badgeId]?.length || 0} présence(s)
                    </span>
                  </div>
                </div>
                {allDays.map((day) =>
                  hours.map((h) => {
                    const times = groupedByMember[member.badgeId] || [];
                    const present = times.some(
                      (t) => toDateString(t) === toDateString(day) && t.getHours() === h
                    );
                    return (
                      <div
                        key={`${member.badgeId}-${day.toISOString()}-${h}`}
                        className={`${styles.gridDataCell} ${
                          present
                            ? styles.gridDataCellPresent
                            : isWeekend(day)
                            ? styles.gridDataCellWeekend
                            : idx % 2 === 0
                            ? styles.gridDataCellEven
                            : styles.gridDataCellOdd
                        }`}
                      >
                        {present && (
                          <>
                            <div className={styles.presenceIndicatorContainer}>
                              <div className={styles.presenceIndicator}>
                                <span className={styles.presenceIndicatorCheck}>✓</span>
                              </div>
                            </div>
                            <div className={styles.gridTooltip}>
                              <div className={styles.gridTooltipHeader}>{formatDate(day, "EEE dd/MM")} à {h}h</div>
                              <div className={styles.gridTooltipBody}>{member.name} {member.firstName}</div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.pageContainer}>
      <div className={styles.maxWidthWrapper}>
        <div className={styles.headerCard}>
          <div className={styles.headerContent}>
            <div className={styles.headerTitleGroup}>
              <div className={styles.headerIconContainer}>
                <Calendar className={styles.headerIcon} />
              </div>
              <div>
                <h1 className={styles.headerTitle}>Planning des présences</h1>
                <p className={styles.headerSubtitle}>Visualisez les présences des membres</p>
              </div>
            </div>
            <div className={styles.viewFilterControls}>
              <button onClick={() => setViewMode("list")} className={`${styles.viewButton} ${viewMode === "list" ? styles.viewButtonActive : styles.viewButtonInactive}`} title="Vue liste">
                <List className={styles.viewButtonIcon} />
              </button>
              <button onClick={() => setViewMode("compact")} className={`${styles.viewButton} ${viewMode === "compact" ? styles.viewButtonActive : styles.viewButtonInactive}`} title="Vue compacte">
                <Users className={styles.viewButtonIcon} />
              </button>
              <button onClick={() => setViewMode("grid")} className={`${styles.viewButton} ${viewMode === "grid" ? styles.viewButtonActive : styles.viewButtonInactive}`} title="Vue grille">
                <Grid className={styles.viewButtonIcon} />
              </button>
              <button onClick={() => setShowFilters(!showFilters)} className={`${styles.filterButton} ${showFilters ? styles.filterButtonActive : styles.filterButtonInactive}`} title="Afficher les filtres">
                <Filter className={styles.viewButtonIcon} />
              </button>
            </div>
          </div>
          <div className={styles.periodNav}>
            <button onClick={() => navigatePeriod("prev")} className={styles.navButton}>
              <ChevronLeft className={styles.navButtonIcon} />
            </button>
            <div className={styles.periodControls}>
              <div className={styles.dateInputGroup}>
                <label className={styles.dateLabel}>Début:</label>
                <input
                  type="date"
                  value={formatDate(startDate, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const newStartDate = new Date(e.target.value);
                    setStartDate(startOfDay(newStartDate));
                    if (period === "week") setEndDate(endOfDay(addWeeks(newStartDate, 1)));
                    else if (period === "month") setEndDate(endOfDay(addMonths(newStartDate, 1)));
                    else setEndDate(endOfDay(addYears(newStartDate, 1)));
                  }}
                  className={styles.dateInput}
                />
              </div>
              <select
                className={styles.periodSelect}
                value={period}
                onChange={(e) => {
                  const value = e.target.value;
                  setPeriod(value);
                  updateDateRange(value, startDate);
                }}
              >
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
                <option value="year">Année</option>
              </select>
              <div className={styles.periodDisplay}>
                <div className={styles.periodDateRange}>
                  {formatDate(startDate, "dd/MM/yyyy")} - {formatDate(endDate, "dd/MM/yyyy")}
                </div>
                <div className={styles.periodDaysCount}>{allDays.length} jours</div>
              </div>
            </div>
            <button onClick={() => navigatePeriod("next")} className={styles.navButton}>
              <ChevronRight className={styles.navButtonIcon} />
            </button>
          </div>
          <div className={styles.presetsContainer}>
            <div className={styles.presetsContent}>
              <span className={styles.presetsLabel}>Raccourcis :</span>
              <button onClick={() => { const today = new Date(); setStartDate(startOfDay(today)); setEndDate(endOfDay(today)); }} className={styles.presetButton}>Aujourd'hui</button>
              <button onClick={() => { const today = new Date(); setStartDate(startOfDay(new Date(today.setDate(today.getDate() - 6)))); setEndDate(endOfDay(new Date())); }} className={styles.presetButton}>7 derniers jours</button>
              <button onClick={() => { const today = new Date(); setStartDate(startOfDay(new Date(today.setDate(today.getDate() - 29)))); setEndDate(endOfDay(new Date())); }} className={styles.presetButton}>30 derniers jours</button>
              <button onClick={() => { setStartDate(startOfDay(startOfWeek(new Date(), { weekStartsOn: 1 }))); setEndDate(endOfDay(endOfWeek(new Date(), { weekStartsOn: 1 }))); }} className={styles.presetButton}>Cette Semaine</button>
              <button onClick={() => { setStartDate(startOfDay(startOfMonth(new Date()))); setEndDate(endOfDay(endOfMonth(new Date()))); }} className={styles.presetButton}>Ce Mois</button>
              <button onClick={() => { setStartDate(startOfDay(startOfYear(new Date()))); setEndDate(endOfDay(endOfYear(new Date()))); }} className={styles.presetButton}>Cette Année</button>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className={styles.filtersContainer}>
            <div className={styles.filtersGrid}>
              <div>
                <label className={styles.filterInputLabel}>Rechercher par nom</label>
                <input type="text" placeholder="Nom ou prénom..." value={filterName} onChange={(e) => setFilterName(e.target.value)} className={styles.filterInput} />
              </div>
              <div>
                <label className={styles.filterInputLabel}>Filtrer par badge</label>
                <input type="text" placeholder="Numéro de badge..." value={filterBadge} onChange={(e) => setFilterBadge(e.target.value)} className={styles.filterInput} />
              </div>
              <div className={styles.checkboxContainer}>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" checked={showNightHours} onChange={() => setShowNightHours(!showNightHours)} className={styles.checkboxInput} />
                  <span className={styles.checkboxText}>Afficher 00h - 06h</span>
                </label>
              </div>
              <div className={styles.refreshButtonContainer}>
                <button onClick={handleRetry} disabled={isRetrying} className={styles.refreshButton}>
                  <RefreshCw className={`${styles.refreshButtonIcon} ${isRetrying ? styles.refreshButtonIconSpin : ""}`} />
                  Actualiser
                </button>
              </div>
            </div>
          </div>
        )}

        {visibleMembers.length === 0 ? (
          <div className={styles.emptyStateContainer}>
            <div className={styles.emptyStateIconContainer}>
              <Users className={styles.emptyStateIcon} />
            </div>
            <h3 className={styles.emptyStateTitle}>Aucune présence trouvée</h3>
            <p className={styles.emptyStateText}>
              Aucune présence n'a été enregistrée sur cette période ou avec ces filtres.<br />
              Essayez d'ajuster la période ou utilisez les raccourcis ci-dessus.
            </p>
            <button onClick={handleRetry} className={styles.emptyStateButton}>
              <RefreshCw className={styles.refreshButtonIcon} />
              Recharger les données
            </button>
          </div>
        ) : (
          <>
            {viewMode === "list" && <ListView />}
            {viewMode === "compact" && <CompactView />}
            {viewMode === "grid" && <GridView />}
          </>
        )}
      </div>
    </div>
  );
}

export default PlanningPage;