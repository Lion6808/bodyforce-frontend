// src/pages/InvitationSignupPage.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FaUser, FaLock, FaEye, FaEyeSlash, FaCheckCircle } from 'react-icons/fa';

const InvitationSignupPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // États du formulaire
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token d\'invitation manquant');
      setLoading(false);
      return;
    }
    
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      setLoading(true);
      
      // Vérifier le token et récupérer les données du membre
      const { data: member, error } = await supabase
        .from('members')
        .select('*')
        .eq('invitation_token', token)
        .eq('invitation_status', 'pending')
        .is('user_id', null)
        .single();

      if (error || !member) {
        throw new Error('Invitation invalide ou expirée');
      }

      // Vérifier si l'invitation n'est pas expirée (7 jours)
      const invitedAt = new Date(member.invited_at);
      const now = new Date();
      const daysDiff = (now - invitedAt) / (1000 * 60 * 60 * 24);

      if (daysDiff > 7) {
        // Marquer comme expirée
        await supabase
          .from('members')
          .update({ invitation_status: 'expired' })
          .eq('id', member.id);
        
        throw new Error('Cette invitation a expiré');
      }

      setMember(member);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // 1. Créer le compte utilisateur
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: member.email,
        password: password,
        options: {
          data: {
            firstName: member.firstName,
            lastName: member.name,
          }
        }
      });

      if (authError) throw authError;

      // 2. Mettre à jour le membre avec l'ID utilisateur
      const { error: updateError } = await supabase
        .from('members')
        .update({
          user_id: authData.user.id,
          invitation_status: 'accepted',
          invitation_token: null,
          account_created_at: new Date().toISOString()
        })
        .eq('id', member.id);

      if (updateError) throw updateError;

      setSuccess(true);
      
      // Rediriger vers la connexion après 3 secondes
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Vérification de votre invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 w-full max-w-md border border-red-200 dark:border-red-800">
          <div className="text-center">
            <div className="text-4xl text-red-500 mb-4">❌</div>
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
              Invitation invalide
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {error}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-lg transition duration-200"
            >
              Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 w-full max-w-md border border-green-200 dark:border-green-800">
          <div className="text-center">
            <FaCheckCircle className="text-5xl text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-4">
              Compte créé avec succès !
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Bienvenue chez BodyForce, {member?.firstName} ! Vous allez être redirigé vers la page de connexion.
            </p>
            <div className="animate-pulse text-blue-600">
              Redirection en cours...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 w-full max-w-md border border-gray-200 dark:border-gray-700">
        {/* En-tête */}
        <div className="text-center mb-6">
          <img
            src="/images/logo.png"
            alt="Logo BodyForce"
            className="h-16 w-auto mx-auto mb-4"
            onError={(e) => { e.target.style.display = "none"; }}
          />
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            Bienvenue chez BodyForce !
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Créez votre compte, {member?.firstName}
          </p>
        </div>

        {/* Infos membre */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
            Vos informations
          </h3>
          <div className="text-sm text-blue-600 dark:text-blue-400">
            <p><strong>Nom :</strong> {member?.firstName} {member?.name}</p>
            <p><strong>Email :</strong> {member?.email}</p>
            <p><strong>Badge :</strong> {member?.badgeId}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSignup} className="space-y-4">
          {/* Mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mot de passe
            </label>
            <div className="relative">
              <FaLock className="absolute left-3 top-3 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Choisissez un mot de passe"
                required
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          {/* Confirmation mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <FaLock className="absolute left-3 top-3 text-gray-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Confirmez votre mot de passe"
                required
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 px-4 rounded-lg transition duration-200 font-medium"
          >
            {submitting ? 'Création du compte...' : 'Créer mon compte'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Vous avez déjà un compte ?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Se connecter
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default InvitationSignupPage;