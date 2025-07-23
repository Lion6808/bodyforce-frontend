// src/App.js
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  Link,
} from "react-router-dom";
import {
  FaHome,
  FaUserFriends,
  FaChartBar,
  FaCalendarAlt,
  FaBars,
  FaTimes,
  FaUserCircle,
  FaSignOutAlt,
  FaCreditCard, // ✅ Nouvel icône pour les paiements
} from "react-icons/fa";
import { supabase } from "./supabaseClient";

import HomePage from "./pages/HomePage";
import MembersPage from "./pages/MembersPage";
import PlanningPage from "./pages/PlanningPage";
import PaymentsPage from "./pages/PaymentsPage"; // ✅ Import de la nouvelle page
import StatisticsPage from "./pages/StatisticsPage";
import UserManagementPage from "./pages/UserManagementPage";
import ProfilePage from "./pages/ProfilePage";
import MemberForm from "./components/MemberForm";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        console.log("Connexion réussie:", data.user);
        navigate("/");
      }
    } catch (err) {
      setError("Erreur de connexion");
      console.error("Erreur login:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md border border-gray-200">
        <div className="text-center mb-6">
          <img 
            src="/images/logo.png" 
            alt="Logo BodyForce" 
            className="h-24 w-auto mx-auto mb-4"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <h1 className="text-2xl font-bold text-blue-600 mb-2">CLUB BODY FORCE</h1>
          <h2 className="text-lg font-semibold text-gray-700">Connexion</h2>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 px-4 rounded-lg transition duration-200 font-medium"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Besoin d'un compte ? Contactez l'administrateur
          </p>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ user, onLogout }) {
  const location = useLocation();
  // ✅ Menu mis à jour avec la page Paiements
  const menu = [
    { name: "Accueil", path: "/", icon: <FaHome className="text-red-500" /> },
    { name: "Membres", path: "/members", icon: <FaUserFriends className="text-green-500" /> },
    { name: "Planning", path: "/planning", icon: <FaCalendarAlt className="text-yellow-500" /> },
    { name: "Paiements", path: "/payments", icon: <FaCreditCard className="text-purple-500" /> }, // ✅ Nouvelle entrée
    { name: "Statistiques", path: "/statistics", icon: <FaChartBar className="text-blue-500" /> },
  ];

  // Vérifier si l'utilisateur est admin basé sur les métadonnées ou l'email
  const isAdmin = user?.user_metadata?.role === "admin" || 
                  user?.email === "admin@bodyforce.com" || 
                  user?.app_metadata?.role === "admin";

  return (
    <aside className="w-64 bg-white shadow-md p-4 flex-col items-center hidden lg:flex">
      <h1 className="text-center text-lg font-bold text-red-600 mb-2">CLUB BODY FORCE</h1>
      <img 
        src="/images/logo.png" 
        alt="Logo" 
        className="mt-4 h-44 w-auto mb-6"
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
      <div className="mb-4 text-sm text-gray-600 flex items-center gap-2">
        <FaUserCircle className="text-xl text-blue-600" />
        <div className="flex flex-col">
          <span className="font-medium">{user?.email}</span>
          {isAdmin && <span className="text-xs text-purple-600 font-bold">Admin</span>}
        </div>
      </div>
      <ul className="w-full space-y-2">
        {menu.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 hover:bg-blue-100 transition duration-200 ${
                location.pathname === item.path ? "bg-blue-200" : ""
              }`}
            >
              {item.icon} {item.name}
            </Link>
          </li>
        ))}
        {isAdmin && (
          <li>
            <Link
              to="/admin/users"
              className={`flex items-center gap-2 rounded-lg px-4 py-2 hover:bg-purple-100 transition duration-200 ${
                location.pathname === "/admin/users" ? "bg-purple-200" : ""
              }`}
            >
              <FaUserCircle className="text-purple-500" /> Utilisateurs
            </Link>
          </li>
        )}
        <li>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 rounded-lg px-4 py-2 w-full text-left text-red-600 hover:bg-red-100 transition duration-200"
          >
            <FaSignOutAlt /> Déconnexion
          </button>
        </li>
      </ul>
    </aside>
  );
}

function AppRoutes({ user, setUser }) {
  const [editingMember, setEditingMember] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      navigate("/login");
    } catch (error) {
      console.error("Erreur déconnexion:", error);
    }
  };

  const isAdmin = user?.user_metadata?.role === "admin" || 
                  user?.email === "admin@bodyforce.com" || 
                  user?.app_metadata?.role === "admin";

  return user ? (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-100">
      {/* Header mobile */}
      <div className="lg:hidden p-2 bg-white shadow-md flex justify-between items-center">
        <button onClick={() => setMobileMenuOpen(true)} className="text-2xl">
          <FaBars />
        </button>
        <h1 className="text-lg font-bold text-red-600">CLUB BODY FORCE</h1>
        <div className="w-8"></div> {/* Spacer pour centrer le titre */}
      </div>

      <Sidebar user={user} onLogout={handleLogout} />

      {/* Menu mobile */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-white z-50 p-6 flex flex-col lg:hidden">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <img 
                src="/images/logo.png" 
                alt="Logo BodyForce" 
                className="h-16 w-auto"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <h1 className="text-lg font-bold text-red-600">CLUB BODY FORCE</h1>
            </div>
            <button onClick={() => setMobileMenuOpen(false)}>
              <FaTimes className="text-2xl text-gray-700" />
            </button>
          </div>
          
          <div className="flex items-center gap-2 mb-6 p-3 bg-gray-100 rounded-lg">
            <FaUserCircle className="text-xl text-blue-600" />
            <div className="flex flex-col">
              <span className="font-medium text-sm">{user?.email}</span>
              {isAdmin && <span className="text-xs text-purple-600 font-bold">Administrateur</span>}
            </div>
          </div>

          <div className="space-y-4">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-lg">
              <FaHome className="text-red-500" /> Accueil
            </Link>
            <Link to="/members" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-lg">
              <FaUserFriends className="text-green-500" /> Membres
            </Link>
            <Link to="/planning" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-lg">
              <FaCalendarAlt className="text-yellow-500" /> Planning
            </Link>
            {/* ✅ Nouvel élément du menu mobile */}
            <Link to="/payments" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-lg">
              <FaCreditCard className="text-purple-500" /> Paiements
            </Link>
            <Link to="/statistics" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-lg">
              <FaChartBar className="text-blue-500" /> Statistiques
            </Link>
            {isAdmin && (
              <Link to="/admin/users" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-lg">
                <FaUserCircle className="text-purple-500" /> Utilisateurs
              </Link>
            )}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="flex items-center gap-2 text-red-600 text-lg"
            >
              <FaSignOutAlt /> Déconnexion
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 p-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/members"
            element={
              <MembersPage
                onEdit={(member) => {
                  setEditingMember(member);
                  setShowForm(true);
                }}
              />
            }
          />
          <Route path="/planning" element={<PlanningPage />} />
          {/* ✅ Nouvelle route pour la page des paiements */}
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/admin/users" element={isAdmin ? <UserManagementPage /> : <Navigate to="/" />} />
          <Route path="/profile" element={<ProfilePage user={user} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>

        {showForm && (
          <MemberForm
            member={editingMember}
            onSave={() => {
              setShowForm(false);
              setEditingMember(null);
            }}
            onCancel={() => {
              setShowForm(false);
              setEditingMember(null);
            }}
          />
        )}
      </main>
    </div>
  ) : (
    <Navigate to="/login" />
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifier la session actuelle
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Erreur récupération session:", error);
        } else {
          setUser(session?.user || null);
        }
      } catch (error) {
        console.error("Erreur session:", error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event, session?.user?.email);
        setUser(session?.user || null);
        setLoading(false);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/*" element={<AppRoutes user={user} setUser={setUser} />} />
      </Routes>
    </Router>
  );
}

export default App;