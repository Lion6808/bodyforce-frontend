// src/pages/UserProfilePage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaCalendarAlt,
  FaCreditCard,
  FaExclamationTriangle,
} from "react-icons/fa";

function UserProfilePage() {
  const { user, role } = useAuth();
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      fetchMemberData();
    }
  }, [user]);

  const fetchMemberData = async () => {
    try {
      setLoading(true);
      
      // Récupérer les données du membre lié à cet utilisateur
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (memberError && memberError.code !== 'PGRST116') { // PGRST116 = pas de résultat
        throw memberError;
      }

      setMemberData(memberData);
      
    } catch (err) {
      console.error("❌ Erreur récupération profil:", err);
      setError(`Impossible de récupérer votre profil: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">Chargement de votre profil...</span>
      </div>
    );
  }

  if (!memberData) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <FaExclamationTriangle className="text-yellow-600 dark:text-yellow-400 text-2xl" />
            <h2 className="text-xl font-bold text-yellow-800 dark:text-yellow-300">
              Profil non configuré
            </h2>
          </div>
          <p className="text-yellow-700 dark:text-yellow-400 mb-4">
            Votre compte utilisateur n'est pas encore lié à un profil de membre.
          </p>
          <p className="text-sm text-yellow-600 dark:text-yellow-500">
            Contactez un administrateur pour associer votre compte à votre profil de membre.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        {/* En-tête */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-600 rounded-t-xl">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <FaUser className="text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                {memberData.prenom} {memberData.nom}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Membre depuis {new Date(memberData.created_at).getFullYear()}
              </p>
            </div>
          </div>
        </div>

        {/* Contenu du profil */}
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Informations personnelles */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Informations personnelles
              </h2>
              
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <FaEnvelope className="text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                  <p className="font-medium text-gray-900 dark:text-white">{memberData.email}</p>
                </div>
              </div>

              {memberData.telephone && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <FaPhone className="text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Téléphone</p>
                    <p className="font-medium text-gray-900 dark:text-white">{memberData.telephone}</p>
                  </div>
                </div>
              )}

              {memberData.date_naissance && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <FaCalendarAlt className="text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Date de naissance</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(memberData.date_naissance).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              )}

              {memberData.adresse && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <FaUser className="text-gray-600 dark:text-gray-400 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Adresse</p>
                    <p className="font-medium text-gray-900 dark:text-white whitespace-pre-line">
                      {memberData.adresse}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Informations d'adhésion */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Informations d'adhésion
              </h2>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <FaCalendarAlt className="text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Date d'inscription</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(memberData.date_inscription).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              {memberData.fin_abonnement && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <FaCalendarAlt className="text-orange-600 dark:text-orange-400" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Fin d'abonnement</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(memberData.fin_abonnement).toLocaleDateString('fr-FR')}
                    </p>
                    <p className={`text-sm ${
                      new Date(memberData.fin_abonnement) > new Date() 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {new Date(memberData.fin_abonnement) > new Date() ? 'Actif' : 'Expiré'}
                    </p>
                  </div>
                </div>
              )}

              {memberData.type_abonnement && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <FaCreditCard className="text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Type d'abonnement</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {memberData.type_abonnement}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className={`w-3 h-3 rounded-full ${
                  memberData.actif ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Statut</p>
                  <p className={`font-medium ${
                    memberData.actif 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {memberData.actif ? 'Membre actif' : 'Membre inactif'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Notes personnelles */}
          {memberData.notes && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                Notes
              </h3>
              <p className="text-blue-700 dark:text-blue-400 whitespace-pre-line">
                {memberData.notes}
              </p>
            </div>
          )}

          {/* Message d'information */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>💡 Information :</strong> Pour modifier vos informations personnelles, 
              contactez la réception ou un administrateur du club.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserProfilePage;