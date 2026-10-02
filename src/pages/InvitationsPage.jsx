// src/pages/InvitationsPage.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import MemberInvitationManager from '../components/MemberInvitationManager';
import useMemberPhotos from '../hooks/useMemberPhotos';
import { parseSearch, matchesSearch } from '../utils/memberSearch';

// Egress : jamais de select('*') sur members (photos ~50 Ko chacune) ;
// 30 fiches affichées à la fois, photos chargées pour celles-ci seulement.
const PAGE = 30;
const MEMBER_COLUMNS =
  'id, name, firstName, email, mobile, badgeId, badge_number, member_type, invitation_status, invited_at, account_created_at, user_id';
import { FaUserPlus, FaSearch, FaFilter, FaUsers } from 'react-icons/fa';

const InvitationsPage = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('members')
        .select(MEMBER_COLUMNS)
        .order('name', { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des membres:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMemberUpdate = (updatedMember) => {
    setMembers(prev =>
      prev.map(member =>
        member.id === updatedMember.id ? updatedMember : member
      )
    );
  };

  // Filtrer les membres : recherche commune (nom, prénom, e-mail, badge court ou long, jokers)
  const searchClauses = parseSearch(searchTerm);
  const filteredMembers = members.filter(member => {
    const matchesSearchQuery = matchesSearch(member, searchClauses);

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'not_invited' && (!member.invitation_status || member.invitation_status === 'not_invited')) ||
      (statusFilter === 'pending' && member.invitation_status === 'pending') ||
      (statusFilter === 'accepted' && member.user_id) ||
      (statusFilter === 'expired' && member.invitation_status === 'expired');

    return matchesSearchQuery && matchesStatus;
  });

  // Revenir aux 30 premières fiches quand la recherche ou le filtre change
  useEffect(() => setShown(PAGE), [searchTerm, statusFilter]);
  const visibleMembers = filteredMembers.slice(0, shown);
  const photos = useMemberPhotos(visibleMembers.map((m) => m.id));

  // Statistiques
  const stats = {
    total: members.length,
    notInvited: members.filter(m => !m.invitation_status || m.invitation_status === 'not_invited').length,
    pending: members.filter(m => m.invitation_status === 'pending').length,
    accepted: members.filter(m => m.user_id).length,
    expired: members.filter(m => m.invitation_status === 'expired').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
            <FaUserPlus className="text-2xl text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Gestion des Invitations
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Invitez vos membres à créer leur compte BodyForce
            </p>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{stats.notInvited}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Non invités</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{stats.pending}</div>
            <div className="text-sm text-yellow-700 dark:text-yellow-400">En attente</div>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.accepted}</div>
            <div className="text-sm text-green-700 dark:text-green-400">Acceptées</div>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.expired}</div>
            <div className="text-sm text-red-700 dark:text-red-400">Expirées</div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, email ou badge..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Filtre de statut */}
          <div className="relative">
            <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Tous les statuts</option>
              <option value="not_invited">Non invités</option>
              <option value="pending">En attente</option>
              <option value="accepted">Acceptées</option>
              <option value="expired">Expirées</option>
            </select>
          </div>
        </div>

        {/* Résultats de recherche */}
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          {filteredMembers.length} membre{filteredMembers.length > 1 ? 's' : ''}
          {searchTerm && ` correspondant${filteredMembers.length > 1 ? 's' : ''} à "${searchTerm}"`}
          {statusFilter !== 'all' && ` avec le statut "${statusFilter}"`}
        </div>
      </div>

      {/* Liste des membres */}
      <div className="space-y-4">
        {filteredMembers.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <FaUsers className="text-4xl text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Aucun membre trouvé
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm ? 'Essayez de modifier vos critères de recherche.' : 'Aucun membre ne correspond aux filtres sélectionnés.'}
            </p>
          </div>
        ) : (
          visibleMembers.map(member => (
            <MemberInvitationManager
              key={member.id}
              member={member}
              photo={photos[member.id] ?? null}
              onUpdate={handleMemberUpdate}
            />
          ))
        )}
        {filteredMembers.length > shown && (
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="w-full h-11 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
          >
            Afficher plus (encore {filteredMembers.length - shown})
          </button>
        )}
      </div>
    </div>
  );
};

export default InvitationsPage;