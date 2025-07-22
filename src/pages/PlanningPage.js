import React, { useState, useEffect } from 'react';
import { supabaseServices } from '../services/supabaseClient';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
         addDays, isSameDay, parseISO, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Users, Clock, TrendingUp, Filter, Grid, List, 
         RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

const PlanningPage = () => {
  const [presences, setPresences] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week');
  const [filterMember, setFilterMember] = useState('');
  const [displayMode, setDisplayMode] = useState('grid');
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const loadData = async (showRetryIndicator = false) => {
    try {
      if (showRetryIndicator) {
        setIsRetrying(true);
      }
      setLoading(true);
      setError('');

      // Test de connexion d'abord
      const connectionTest = await supabaseServices.testConnection();
      if (!connectionTest) {
        throw new Error('Impossible de se connecter à la base de données');
      }

      const [presencesData, membersData] = await Promise.all([
        supabaseServices.getPresencesWithMembers(),
        supabaseServices.getMembers()
      ]);

      setPresences(presencesData || []);
      setMembers(membersData || []);
      setRetryCount(0);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      setError(error.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    loadData(true);
  };

  const getDateRange = () => {
    const today = selectedDate;
    switch (viewMode) {
      case 'day':
        return { start: today, end: today };
      case 'week':
        return { 
          start: startOfWeek(today, { locale: fr }), 
          end: endOfWeek(today, { locale: fr }) 
        };
      case 'month':
        return { 
          start: startOfMonth(today), 
          end: endOfMonth(today) 
        };
      default:
        return { start: today, end: today };
    }
  };

  const getFilteredPresences = () => {
    const { start, end } = getDateRange();
    
    return presences.filter(presence => {
      const presenceDate = parseISO(presence.timestamp);
      const isInDateRange = isWithinInterval(presenceDate, { start, end });
      const matchesMember = !filterMember || 
        (presence.member && presence.member.id.toString() === filterMember);
      
      return isInDateRange && matchesMember;
    });
  };

  const getStatsByDate = () => {
    const filteredPresences = getFilteredPresences();
    const statsByDate = {};

    filteredPresences.forEach(presence => {
      const dateKey = format(parseISO(presence.timestamp), 'yyyy-MM-dd');
      if (!statsByDate[dateKey]) {
        statsByDate[dateKey] = {
          date: parseISO(presence.timestamp),
          count: 0,
          members: new Set(),
          presences: []
        };
      }
      statsByDate[dateKey].count++;
      if (presence.member) {
        statsByDate[dateKey].members.add(presence.member.id);
      }
      statsByDate[dateKey].presences.push(presence);
    });

    return Object.values(statsByDate).sort((a, b) => b.date - a.date);
  };

  const renderConnectionError = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          Problème de connexion
        </h2>
        <p className="text-gray-600 mb-6">
          {error}
        </p>
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 
                   text-white font-semibold py-2 px-4 rounded-lg transition-colors 
                   flex items-center justify-center gap-2"
        >
          {isRetrying ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Reconnexion...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </>
          )}
        </button>
        {retryCount > 0 && (
          <p className="text-sm text-gray-500 mt-3">
            Tentative {retryCount + 1}
          </p>
        )}
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">
          {isRetrying ? 'Reconnexion en cours...' : 'Chargement du planning...'}
        </p>
      </div>
    </div>
  );

  if (loading) return renderLoading();
  if (error && !isRetrying) return renderConnectionError();

  const stats = getStatsByDate();
  const totalPresences = getFilteredPresences().length;
  const uniqueMembers = new Set(
    getFilteredPresences()
      .filter(p => p.member)
      .map(p => p.member.id)
  ).size;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                Planning des présences
              </h1>
              <p className="text-gray-600 mt-1">
                {format(selectedDate, "MMMM yyyy", { locale: fr })}
              </p>
            </div>

            {/* Controls - Responsive */}
            <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3">
              {/* Date picker */}
              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm 
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />

              {/* View mode selector */}
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                {[
                  { mode: 'day', label: 'Jour', icon: Calendar },
                  { mode: 'week', label: 'Semaine', icon: Clock },
                  { mode: 'month', label: 'Mois', icon: TrendingUp }
                ].map(({ mode, label, icon: Icon }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-2 text-xs sm:text-sm font-medium transition-colors 
                              flex items-center gap-1 sm:gap-2 ${
                      viewMode === mode
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              {/* Display mode selector */}
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setDisplayMode('grid')}
                  className={`px-3 py-2 transition-colors flex items-center gap-2 ${
                    displayMode === 'grid'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">Grille</span>
                </button>
                <button
                  onClick={() => setDisplayMode('list')}
                  className={`px-3 py-2 transition-colors flex items-center gap-2 ${
                    displayMode === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">Liste</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700 font-medium">Filtres:</span>
            </div>
            <select
              value={filterMember}
              onChange={(e) => setFilterMember(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm 
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                       max-w-xs"
            >
              <option value="">Tous les membres</option>
              {members.map(member => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-3 py-2 text-sm text-gray-600 hover:text-blue-600 
                       flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total présences</p>
                <p className="text-2xl font-bold text-gray-900">{totalPresences}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Membres uniques</p>
                <p className="text-2xl font-bold text-gray-900">{uniqueMembers}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Moyenne/jour</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.length > 0 ? Math.round(totalPresences / stats.length) : 0}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Période</p>
                <p className="text-lg font-bold text-gray-900 capitalize">
                  {viewMode === 'day' ? 'Journée' : 
                   viewMode === 'week' ? 'Semaine' : 'Mois'}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Content */}
        {displayMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.map((dayStat, index) => (
              <div key={index} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">
                    {format(dayStat.date, "EEEE d MMMM", { locale: fr })}
                  </h3>
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                    {dayStat.count} passages
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    {dayStat.members.size} membres différents
                  </p>
                  <div className="max-h-32 overflow-y-auto">
                    {dayStat.presences.slice(0, 5).map((presence, i) => (
                      <div key={i} className="text-xs text-gray-500 flex items-center justify-between">
                        <span>
                          {presence.member ? 
                            `${presence.member.firstName} ${presence.member.name}` : 
                            `Badge ${presence.badgeId}`
                          }
                        </span>
                        <span>{format(parseISO(presence.timestamp), "HH:mm")}</span>
                      </div>
                    ))}
                    {dayStat.presences.length > 5 && (
                      <p className="text-xs text-gray-400 mt-1">
                        +{dayStat.presences.length - 5} autres...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Heure
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Membre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Badge
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getFilteredPresences().map((presence, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(parseISO(presence.timestamp), "dd/MM/yyyy", { locale: fr })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(parseISO(presence.timestamp), "HH:mm:ss")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {presence.member ? 
                          `${presence.member.firstName} ${presence.member.name}` : 
                          'Membre inconnu'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {presence.badgeId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {stats.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucune présence trouvée
            </h3>
            <p className="text-gray-500">
              Aucune présence n'a été enregistrée pour cette période.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanningPage;