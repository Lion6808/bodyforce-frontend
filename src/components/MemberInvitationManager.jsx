// src/components/MemberInvitationManager.jsx
import React, { useState } from 'react';
import { formatDateTimeFr } from "../utils/dateUtils";
import { toast } from 'react-toastify';
import { inviteMember, resendInvitation, cancelInvitation } from '../utils/invitationService';
import './MemberInvitationManager.css'; // On créera le CSS après

const MemberInvitationManager = ({ member, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(member.email || '');
  const [showEmailInput, setShowEmailInput] = useState(!member.email);

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.warning('Veuillez saisir un email');
      return;
    }

    setLoading(true);
    const result = await inviteMember(member.id, email);
    
    if (result.success) {
      toast.success(result.message);
      onUpdate?.(result.member);
      setShowEmailInput(false);
    } else {
      toast.error('Erreur : ' + result.error);
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setLoading(true);
    const result = await resendInvitation(member.id);
    
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error('Erreur : ' + result.error);
    }
    setLoading(false);
  };

  const handleCancel = async () => {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette invitation ?')) return;
    
    setLoading(true);
    const result = await cancelInvitation(member.id);
    
    if (result.success) {
      toast.success(result.message);
      onUpdate?.({...member, invitation_status: 'not_invited', invitation_token: null});
      setShowEmailInput(true);
    } else {
      toast.error('Erreur : ' + result.error);
    }
    setLoading(false);
  };

  const getStatusBadge = () => {
    const statusConfig = {
      'not_invited': { label: 'Non invité', class: 'status-not-invited' },
      'pending': { label: 'En attente', class: 'status-pending' },
      'accepted': { label: 'Acceptée', class: 'status-accepted' },
      'expired': { label: 'Expirée', class: 'status-expired' }
    };

    const config = statusConfig[member.invitation_status] || statusConfig['not_invited'];
    
    return (
      <span className={`status-badge ${config.class}`}>
        {config.label}
      </span>
    );
  };


  const renderActions = () => {
    if (member.user_id) {
      return (
        <div className="invitation-status">
          <span className="account-created">
            ✅ Compte créé le {formatDateTimeFr(member.account_created_at)}
          </span>
        </div>
      );
    }

    switch (member.invitation_status) {
      case 'not_invited':
        return (
          <div className="invitation-actions">
            {showEmailInput ? (
              <div className="email-input-group">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email du membre"
                  disabled={loading}
                  className="email-input"
                />
                <button
                  onClick={handleInvite}
                  disabled={loading || !email.trim()}
                  className="btn btn-primary"
                >
                  {loading ? '⏳' : '📧'} {loading ? 'Envoi...' : 'Inviter'}
                </button>
                {member.email && (
                  <button
                    onClick={() => {
                      setShowEmailInput(false);
                      setEmail(member.email);
                    }}
                    className="btn btn-secondary"
                    disabled={loading}
                  >
                    Annuler
                  </button>
                )}
              </div>
            ) : (
              <div className="email-display-group">
                <span className="email-display">{member.email}</span>
                <button
                  onClick={handleInvite}
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? '⏳ Envoi...' : '📧 Inviter'}
                </button>
                <button
                  onClick={() => setShowEmailInput(true)}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Modifier email
                </button>
              </div>
            )}
          </div>
        );

      case 'pending':
        return (
          <div className="invitation-actions">
            <div className="invitation-info">
              <span className="invited-date">
                📅 Invité le {formatDateTimeFr(member.invited_at)}
              </span>
              <span className="invited-email">
                📧 {member.email}
              </span>
            </div>
            <div className="action-buttons">
              <button
                onClick={handleResend}
                disabled={loading}
                className="btn btn-warning"
              >
                {loading ? '⏳' : '🔄'} {loading ? 'Envoi...' : 'Renvoyer'}
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="btn btn-danger"
              >
                {loading ? '⏳' : '❌'} {loading ? 'Annulation...' : 'Annuler'}
              </button>
            </div>
          </div>
        );

      case 'expired':
        return (
          <div className="invitation-actions">
            <div className="invitation-info">
              <span className="expired-info">
                ⚠️ Invitation expirée - Invité le {formatDateTimeFr(member.invited_at)}
              </span>
            </div>
            <button
              onClick={handleInvite}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? '⏳ Envoi...' : '🔄 Nouvelle invitation'}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="member-invitation-manager">
      <div className="member-header">
        <div className="member-info">
          <h4 className="member-name">
            {member.firstName} {member.name}
          </h4>
          <span className="member-badge">Badge: {member.badgeId}</span>
        </div>
        {getStatusBadge()}
      </div>
      
      <div className="invitation-content">
        {renderActions()}
      </div>
    </div>
  );
};

export default MemberInvitationManager;