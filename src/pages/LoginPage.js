import React, { useState } from 'react';
// Import du client Supabase pour l'authentification
import { supabase } from '../supabaseClient';
import '../App.css';
import '../App.js';

function LoginPage() {
  // États pour gérer l'email, le mot de passe, l'utilisateur connecté et les erreurs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  // Fonction appelée lors de la soumission du formulaire de connexion
  const handleLogin = async (e) => {
    e.preventDefault();

    // Appel à Supabase pour se connecter avec email et mot de passe
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    // Gestion des erreurs ou de la connexion réussie
    if (error) {
      setError(error.message);
      setUser(null);
    } else {
      setError(null);
      setUser(data.user);
    }
  };

  return (
    // Conteneur principal avec fond dégradé et centrage
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 w-full max-w-md border border-gray-200 dark:border-gray-700">
        {/* Logo et titres */}
        <div className="text-center mb-6">
          <div className="sidebar-logo sidebar-logo-3d text-center p-4 pb-2">
            <h1
              className={`sidebar-title text-center text-lg font-bold text-red-600 dark:text-red-400 mb-2 ${isCollapsed ? "opacity-0" : "opacity-100"
                }`}
            >
              CLUB BODY FORCE
            </h1>
            <img
              src="/images/logo.png"
              alt="Logo"
              className="sidebar-logo-pulse h-32 w-auto mb-4 mx-auto transition-all duration-400"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </div>
      </div>

      {/* Affichage des erreurs de connexion */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
          Erreur : {error}
        </div>
      )}

      {/* Affichage de l'utilisateur connecté */}
      {user && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded mb-4">
          Connecté : {user.email}
        </div>
      )}

      {/* Formulaire de connexion */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            type="email"
            placeholder="votre@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Mot de passe
          </label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition duration-200 font-medium"
        >
          Se connecter
        </button>
      </form>

      {/* Message d'information en bas de page */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Besoin d'un compte ? Contactez l'administrateur
        </p>
      </div>
    </div>
    </div >
  );
}

export default LoginPage;