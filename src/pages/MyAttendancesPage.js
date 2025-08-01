// ✅ CORRECTIONS pour MyAttendancesPage.jsx

// 1. ✅ CORRECTION - Sélecteur de périodes inspiré de PlanningPage
const PeriodSelector = () => {
  const navigatePeriod = (direction) => {
    const amount = direction === 'prev' ? -1 : 1;
    let newStart;

    if (filters.dateRange === 'week') {
      newStart = addDays(new Date(), amount * 7);
    } else if (filters.dateRange === 'month') {
      newStart = new Date();
      newStart.setMonth(newStart.getMonth() + amount);
    } else if (filters.dateRange === 'year') {
      newStart = new Date();
      newStart.setFullYear(newStart.getFullYear() + amount);
    } else {
      return; // Pas de navigation pour les autres modes
    }

    if (filters.dateRange === 'month') {
      setFilters({
        ...filters,
        month: newStart.getMonth() + 1,
        year: newStart.getFullYear()
      });
    } else {
      // Pour les autres périodes, on peut mettre à jour timelineStartDate
      setTimelineStartDate(newStart);
    }
  };

  const getCurrentPeriodLabel = () => {
    const { startDate, endDate } = getDateRange();
    if (filters.dateRange === 'month') {
      return new Date(filters.year, filters.month - 1).toLocaleDateString('fr-FR', { 
        month: 'long', 
        year: 'numeric' 
      });
    }
    return `${formatDate(startDate, "dd/MM")} - ${formatDate(endDate, "dd/MM/yyyy")}`;
  };

  return (
    <div className={styles.periodSelectorContainer}>
      {/* Navigation période */}
      <div className={styles.periodNavigation}>
        <button
          onClick={() => navigatePeriod('prev')}
          className={styles.periodNavButton}
          disabled={!['week', 'month', 'year'].includes(filters.dateRange)}
        >
          ←
        </button>

        <div className={styles.periodInfo}>
          <div className={styles.periodLabel}>
            {getCurrentPeriodLabel()}
          </div>
          <div className={styles.periodSubLabel}>
            {(() => {
              const { startDate, endDate } = getDateRange();
              const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
              return `${days} jours`;
            })()}
          </div>
        </div>

        <button
          onClick={() => navigatePeriod('next')}
          className={styles.periodNavButton}
          disabled={!['week', 'month', 'year'].includes(filters.dateRange)}
        >
          →
        </button>
      </div>

      {/* Presets rapides - inspirés de PlanningPage */}
      <div className={styles.periodPresets}>
        <span className={styles.presetsLabel}>Raccourcis :</span>
        
        <button
          onClick={() => {
            const today = new Date();
            setFilters({...filters, dateRange: 'custom'});
            setCustomStartDate(formatDate(today, "yyyy-MM-dd"));
            setCustomEndDate(formatDate(today, "yyyy-MM-dd"));
          }}
          className={styles.presetButton}
        >
          Aujourd'hui
        </button>

        <button
          onClick={() => {
            const today = new Date();
            const weekAgo = addDays(today, -6);
            setFilters({...filters, dateRange: 'custom'});
            setCustomStartDate(formatDate(weekAgo, "yyyy-MM-dd"));
            setCustomEndDate(formatDate(today, "yyyy-MM-dd"));
          }}
          className={styles.presetButton}
        >
          7 derniers jours
        </button>

        <button
          onClick={() => {
            const today = new Date();
            const monthAgo = addDays(today, -29);
            setFilters({...filters, dateRange: 'custom'});
            setCustomStartDate(formatDate(monthAgo, "yyyy-MM-dd"));
            setCustomEndDate(formatDate(today, "yyyy-MM-dd"));
          }}
          className={styles.presetButton}
        >
          30 derniers jours
        </button>

        <button
          onClick={() => {
            const today = new Date();
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Lundi
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6); // Dimanche
            
            setFilters({...filters, dateRange: 'custom'});
            setCustomStartDate(formatDate(startOfWeek, "yyyy-MM-dd"));
            setCustomEndDate(formatDate(endOfWeek, "yyyy-MM-dd"));
          }}
          className={styles.presetButton}
        >
          Cette Semaine
        </button>

        <button
          onClick={() => {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            
            setFilters({...filters, dateRange: 'custom'});
            setCustomStartDate(formatDate(startOfMonth, "yyyy-MM-dd"));
            setCustomEndDate(formatDate(endOfMonth, "yyyy-MM-dd"));
          }}
          className={styles.presetButton}
        >
          Ce Mois
        </button>

        <button
          onClick={() => {
            const today = new Date();
            const startOfYear = new Date(today.getFullYear(), 0, 1);
            const endOfYear = new Date(today.getFullYear(), 11, 31);
            
            setFilters({...filters, dateRange: 'custom'});
            setCustomStartDate(formatDate(startOfYear, "yyyy-MM-dd"));
            setCustomEndDate(formatDate(endOfYear, "yyyy-MM-dd"));
          }}
          className={styles.presetButton}
        >
          Cette Année
        </button>
      </div>
    </div>
  );
};

// 2. ✅ CORRECTION - Select de période amélioré
const EnhancedPeriodSelect = () => (
  <div className={styles.filterGroup}>
    <label className={styles.filterLabel}>
      <FaFilter className={styles.filterIcon} />
      Période
    </label>
    <select
      value={filters.dateRange}
      onChange={(e) => {
        const newRange = e.target.value;
        setFilters({...filters, dateRange: newRange});
        
        // Reset des dates custom quand on change de période
        if (newRange !== 'custom') {
          setCustomStartDate('');
          setCustomEndDate('');
        }
        
        // Reset timeline date pour les périodes timeline
        if (['7days', '14days', '30days'].includes(newRange)) {
          setTimelineStartDate(new Date());
        }
      }}
      className={styles.filterSelect}
    >
      {/* Périodes fixes */}
      <optgroup label="Périodes fixes">
        <option value="week">Semaine actuelle</option>
        <option value="month">Mois actuel</option>
        <option value="3months">3 derniers mois</option>
        <option value="year">Année actuelle</option>
      </optgroup>
      
      {/* Périodes timeline (pour vue timeline) */}
      {viewMode === 'timeline' && (
        <optgroup label="Timeline">
          <option value="7days">Timeline 7 jours</option>
          <option value="14days">Timeline 14 jours</option>
          <option value="30days">Timeline 30 jours</option>
        </optgroup>
      )}
      
      {/* Période personnalisée */}
      <optgroup label="Personnalisé">
        <option value="custom">Période personnalisée</option>
      </optgroup>
    </select>
  </div>
);

// 3. ✅ CORRECTION - Timeline avec débordement corrigé
const TimelineViewCorrected = () => {
  const navigateTimeline = (direction) => {
    const daysToMove = filters.dateRange === '7days' ? 7 : filters.dateRange === '14days' ? 14 : 30;
    const newDate = new Date(timelineStartDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? daysToMove : -daysToMove));
    setTimelineStartDate(newDate);
  };

  const canNavigateNext = () => {
    const today = new Date();
    return timelineStartDate < today;
  };

  const getPeriodLabel = () => {
    const endDate = new Date(timelineStartDate);
    const startDate = new Date(timelineStartDate);
    const daysCount = filters.dateRange === '7days' ? 7 : filters.dateRange === '14days' ? 14 : 30;
    startDate.setDate(startDate.getDate() - (daysCount - 1));
    
    return `${formatDate(startDate, "dd/MM")} - ${formatDate(endDate, "dd/MM/yyyy")}`;
  };

  const getCurrentPeriod = () => {
    return filters.dateRange === '7days' ? '7' : filters.dateRange === '14days' ? '14' : '30';
  };

  // ✅ CORRECTION - Calcul responsive de la largeur des barres
  const getBarWidth = () => {
    const daysCount = timelineData.length;
    if (daysCount <= 7) return '70%';
    if (daysCount <= 14) return '50%';
    return '35%'; // Pour 30 jours
  };

  // ✅ CORRECTION - Hauteur adaptative du conteneur
  const getTimelineHeight = () => {
    const daysCount = timelineData.length;
    if (daysCount <= 7) return '350px';
    if (daysCount <= 14) return '320px';
    return '280px'; // Pour 30 jours - plus compact
  };

  return (
    <div className={styles.timelineContainer}>
      <div className={styles.timelineHeader}>
        <h3 className={styles.timelineTitle}>
          Activité des {getCurrentPeriod()} derniers jours
        </h3>
        
        <div className={styles.timelineNavigation}>
          <button
            onClick={() => navigateTimeline('prev')}
            className={styles.timelineNavButton}
          >
            ← Précédent
          </button>
          
          <div className={styles.timelinePeriodInfo}>
            {getPeriodLabel()}
          </div>
          
          <button
            onClick={() => navigateTimeline('next')}
            disabled={!canNavigateNext()}
            className={styles.timelineNavButton}
          >
            Suivant →
          </button>
        </div>
      </div>

      <div className={styles.timelinePeriodControls}>
        <div className={styles.periodButtons}>
          {[
            { id: '7days', label: '7 jours' },
            { id: '14days', label: '14 jours' },
            { id: '30days', label: '30 jours' }
          ].map(period => (
            <button
              key={period.id}
              onClick={() => {
                setFilters({...filters, dateRange: period.id});
                setTimelineStartDate(new Date());
              }}
              className={`${styles.periodButton} ${filters.dateRange === period.id ? styles.activePeriod : ''}`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* ✅ CORRECTION - Timeline avec dimensions adaptatives */}
      <div 
        className={styles.timelineChart}
        style={{
          height: getTimelineHeight(),
          gap: timelineData.length > 14 ? '0.5rem' : timelineData.length > 7 ? '0.75rem' : '1rem'
        }}
      >
        {timelineData.map((day, index) => (
          <div key={index} className={styles.timelineDay}>
            <div className={styles.timelineDate}>
              <div className={`${styles.dateLabel} ${timelineData.length > 14 ? styles.compactLabel : ''}`}>
                {timelineData.length > 14 
                  ? formatDate(day.date, "dd/MM").split('/')[0] // Juste le jour pour 30j
                  : formatDate(day.date, "EEE dd")
                }
              </div>
              <div className={`${styles.countLabel} ${timelineData.length > 14 ? styles.compactCount : ''}`}>
                {day.count}
              </div>
            </div>
            
            <div className={styles.timelineBarContainer}>
              <div 
                className={styles.timelineBar}
                style={{
                  height: `${Math.max((day.count / Math.max(...timelineData.map(d => d.count))) * 100, 5)}%`,
                  width: getBarWidth() // ✅ Largeur adaptative
                }}
              >
                <div className={styles.barGradient}></div>
              </div>
            </div>
            
            {/* ✅ CORRECTION - Présences adaptatives selon la largeur */}
            <div className={styles.timelinePresences}>
              {timelineData.length <= 14 ? (
                // Mode normal pour 7-14 jours
                <>
                  {day.presences.slice(0, 3).map((presence, i) => (
                    <div key={i} className={styles.timelinePresenceTime}>
                      {presence.time}
                    </div>
                  ))}
                  {day.count > 3 && <div className={styles.moreTimes}>+{day.count - 3}</div>}
                </>
              ) : (
                // Mode compact pour 30 jours
                day.count > 0 && (
                  <div className={`${styles.timelinePresenceTime} ${styles.compactPresence}`}>
                    {day.presences[0]?.time}
                    {day.count > 1 && <span className={styles.plusIndicator}>+{day.count - 1}</span>}
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 4. ✅ CORRECTION - Contrôles mis à jour
const UpdatedControlsSection = () => (
  <div className={styles.controlsSection}>
    <div className={styles.viewControls}>
      <div className={styles.viewButtons}>
        {[
          { id: 'calendar', icon: FaCalendarAlt, label: 'Calendrier' },
          { id: 'heatmap', icon: FaTh, label: 'Heatmap' },
          { id: 'timeline', icon: FaChartBar, label: 'Timeline' },
          { id: 'list', icon: FaList, label: 'Liste' }
        ].map(view => (
          <button
            key={view.id}
            onClick={() => handleViewModeChange(view.id)}
            className={`${styles.viewButton} ${viewMode === view.id ? styles.active : ''}`}
          >
            <view.icon className={styles.viewIcon} />
            {view.label}
          </button>
        ))}
      </div>

      <div className={styles.filtersControls}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>
            <FaSearch className={styles.filterIcon} />
            Rechercher
          </label>
          <input
            type="text"
            placeholder="Date, heure, jour..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {/* ✅ Select de période amélioré */}
        <EnhancedPeriodSelect />

        {/* ✅ Dates personnalisées */}
        {filters.dateRange === 'custom' && (
          <>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Du</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className={styles.dateInput}
              />
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Au</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className={styles.dateInput}
              />
            </div>
          </>
        )}

        {/* ✅ Contrôles mois/année pour période mensuelle */}
        {filters.dateRange === 'month' && (
          <>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Mois</label>
              <select
                value={filters.month}
                onChange={(e) => setFilters({...filters, month: parseInt(e.target.value)})}
                className={styles.filterSelect}
              >
                {Array.from({length: 12}, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleDateString('fr-FR', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Année</label>
              <select
                value={filters.year}
                onChange={(e) => setFilters({...filters, year: parseInt(e.target.value)})}
                className={styles.filterSelect}
              >
                {Array.from({length: 5}, (_, i) => {
                  const year = new Date().getFullYear() - 2 + i;
                  return <option key={year} value={year}>{year}</option>;
                })}
              </select>
            </div>
          </>
        )}

        <div className={styles.actionButtons}>
          <button
            onClick={exportToText}
            className={styles.exportButton}
            title="Exporter en fichier texte"
            disabled={filteredPresences.length === 0}
          >
            <FaDownload className={styles.exportIcon} />
            Export
          </button>

          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className={styles.refreshButton}
            title="Actualiser"
          >
            <FaSyncAlt className={`${styles.refreshIcon} ${isRetrying ? styles.spinning : ''}`} />
            Actualiser
          </button>
        </div>
      </div>
    </div>

    {/* ✅ Sélecteur de période avec navigation */}
    <PeriodSelector />
  </div>
);