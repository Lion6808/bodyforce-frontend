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
  FaCreditCard,
} from "react-icons/fa";
import { supabase } from "./supabaseClient";

import HomePage from "./pages/HomePage";
import MembersPage from "./pages/MembersPage";
import PlanningPage from "./pages/PlanningPage";
import PaymentsPage from "./pages/PaymentsPage";
import StatisticsPage from "./pages/StatisticsPage";
import UserManagementPage from "./pages/UserManagementPage";
import ProfilePage from "./pages/ProfilePage";
import MemberForm from "./components/MemberForm";

// Styles CSS pour les animations
const mobileMenuStyles = `
  .mobile-menu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 40;
    opacity: 0;
    transition: opacity 0.3s ease-out;
  }
  
  .mobile-menu-overlay.open {
    opacity: 1;
  }
  
  .mobile-menu-container {
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    width: 280px;
    max-width: 80vw;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: -10px 0 25px rgba(0, 0, 0, 0.15);
    z-index: 50;
    transform: translateX(100%);
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    overflow-y: auto;
  }
  
  .mobile-menu-container.open {
    transform: translateX(0);
  }
  
  .menu-item {
    opacity: 0;
    transform: translateX(20px);
    transition: all 0.3s ease-out;
  }
  
  .menu-item.animate {
    opacity: 1;
    transform: translateX(0);
  }
  
  .menu-item:nth-child(1) { transition-delay: 0.1s; }
  .menu-item:nth-child(2) { transition-delay: 0.15s; }
  .menu-item:nth-child(3) { transition-delay: 0.2s; }
  .menu-item:nth-child(4) { transition-delay: 0.25s; }
  .menu-item:nth-child(5) { transition-delay: 0.3s; }
  .menu-item:nth-child(6) { transition-delay: 0.35s; }
  .menu-item:nth-child(7) { transition-delay: 0.4s; }
  
  .menu-header {
    opacity: 0;
    transform: translateY(-20px);
    transition: all 0.4s ease-out 0.2s;
  }
  
  .menu-header.animate {
    opacity: 1;
    transform: translateY(0);
  }
  
  .user-profile {
    opacity: 0;
    transform: scale(0.8);
    transition: all 0.3s ease-out 0.3s;
  }
  
  .user-profile.animate {
    opacity: 1;
    transform: scale(1);
  }
  
  .close-button {
    transform: rotate(-180deg);
    transition: transform 0.3s ease-out;
  }
  
  .close-button.animate {
    transform: rotate(0deg);
  }
`;

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
              e.target.style.display = "none";
            }}
          />
          <h1 className="text-2xl font-bold text-blue-600 mb-2">
            CLUB BODY FORCE
          </h1>
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
  const menu = [
    { name: "Accueil", path: "/", icon: <FaHome className="text-red-500" /> },
    {
      name: "Membres",
      path: "/members",
      icon: <FaUserFriends className="text-green-500" />,
    },
    {
      name: "Planning",
      path: "/planning",
      icon: <FaCalendarAlt className="text-yellow-500" />,
    },
    {
      name: "Paiements",
      path: "/payments",
      icon: <FaCreditCard className="text-purple-500" />,
    },
    {
      name: "Statistiques",
      path: "/statistics",
      icon: <FaChartBar className="text-blue-500" />,
    },
  ];

  const isAdmin =
    user?.user_metadata?.role === "admin" ||
    user?.email === "admin@bodyforce.com" ||
    user?.app_metadata?.role === "admin";

  return (
    <aside className="w-64 bg-white shadow-md p-4 flex-col items-center hidden lg:flex">
      <h1 className="text-center text-lg font-bold text-red-600 mb-2">
        CLUB BODY FORCE
      </h1>
      <img
        src="/images/logo.png"
        alt="Logo"
        className="mt-4 h-44 w-auto mb-6"
        onError={(e) => {
          e.target.style.display = "none";
        }}
      />
      <div className="mb-4 text-sm text-gray-600 flex items-center gap-2">
        <FaUserCircle className="text-xl text-blue-600" />
        <div className="flex flex-col">
          <span className="font-medium">{user?.email}</span>
          {isAdmin && (
            <span className="text-xs text-purple-600 font-bold">Admin</span>
          )}
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

// Composant pour le menu mobile animé
function AnimatedMobileMenu({ isOpen, onClose, user, isAdmin, location }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Petit délai pour permettre au menu d'apparaître avant d'animer les éléments
      const timer = setTimeout(() => setAnimate(true), 50);
      return () => clearTimeout(timer);
    } else {
      setAnimate(false);
    }
  }, [isOpen]);

  const handleItemClick = () => {
    setAnimate(false);
    setTimeout(onClose, 200); // Délai pour l'animation de sortie
  };

  const handleLogout = () => {
    setAnimate(false);
    setTimeout(() => {
      onClose();
      // Le logout sera géré par le parent
    }, 200);
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{mobileMenuStyles}</style>

      {/* Overlay */}
      <div
        className={`mobile-menu-overlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />

      {/* Menu Container */}
      <div className={`mobile-menu-container ${isOpen ? "open" : ""}`}>
        {/* Header */}
        <div
          className={`menu-header ${
            animate ? "animate" : ""
          } p-6 border-b border-white/20`}
        >
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <img
                src="/images/logo.png"
                alt="Logo BodyForce"
                className="h-12 w-auto"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
              <h1 className="text-lg font-bold text-white">BODY FORCE</h1>
            </div>
            <button
              onClick={onClose}
              className={`close-button ${
                animate ? "animate" : ""
              } text-white hover:text-gray-200 transition-colors p-2`}
            >
              <FaTimes className="text-xl" />
            </button>
          </div>
        </div>

        {/* User Profile */}
        <div
          className={`user-profile ${
            animate ? "animate" : ""
          } p-6 border-b border-white/20`}
        >
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <FaUserCircle className="text-2xl text-white" />
            <div className="flex flex-col">
              <span className="font-medium text-white text-sm">
                {user?.email}
              </span>
              {isAdmin && (
                <span className="text-xs text-yellow-300 font-bold">
                  Administrateur
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="p-6 space-y-3">
          <Link
            to="/"
            onClick={handleItemClick}
            className={`menu-item ${
              animate ? "animate" : ""
            } flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${
              location.pathname === "/" ? "bg-white/20" : ""
            }`}
          >
            <FaHome className="text-xl text-red-300" />
            <span className="font-medium">Accueil</span>
          </Link>

          <Link
            to="/members"
            onClick={handleItemClick}
            className={`menu-item ${
              animate ? "animate" : ""
            } flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${
              location.pathname === "/members" ? "bg-white/20" : ""
            }`}
          >
            <FaUserFriends className="text-xl text-green-300" />
            <span className="font-medium">Membres</span>
          </Link>

          <Link
            to="/planning"
            onClick={handleItemClick}
            className={`menu-item ${
              animate ? "animate" : ""
            } flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${
              location.pathname === "/planning" ? "bg-white/20" : ""
            }`}
          >
            <FaCalendarAlt className="text-xl text-yellow-300" />
            <span className="font-medium">Planning</span>
          </Link>

          <Link
            to="/payments"
            onClick={handleItemClick}
            className={`menu-item ${
              animate ? "animate" : ""
            } flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${
              location.pathname === "/payments" ? "bg-white/20" : ""
            }`}
          >
            <FaCreditCard className="text-xl text-purple-300" />
            <span className="font-medium">Paiements</span>
          </Link>

          <Link
            to="/statistics"
            onClick={handleItemClick}
            className={`menu-item ${
              animate ? "animate" : ""
            } flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${
              location.pathname === "/statistics" ? "bg-white/20" : ""
            }`}
          >
            <FaChartBar className="text-xl text-blue-300" />
            <span className="font-medium">Statistiques</span>
          </Link>

          {isAdmin && (
            <Link
              to="/admin/users"
              onClick={handleItemClick}
              className={`menu-item ${
                animate ? "animate" : ""
              } flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${
                location.pathname === "/admin/users" ? "bg-white/20" : ""
              }`}
            >
              <FaUserCircle className="text-xl text-purple-300" />
              <span className="font-medium">Utilisateurs</span>
            </Link>
          )}

          <button
            onClick={handleLogout}
            className={`menu-item ${
              animate ? "animate" : ""
            } flex items-center gap-4 text-red-300 hover:bg-red-500/20 rounded-xl p-4 w-full text-left transition-all duration-200`}
          >
            <FaSignOutAlt className="text-xl" />
            <span className="font-medium">Déconnexion</span>
          </button>
        </div>
      </div>
    </>
  );
}

function AppRoutes({ user, setUser }) {
  const [editingMember, setEditingMember] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      navigate("/login");
    } catch (error) {
      console.error("Erreur déconnexion:", error);
    }
  };

  const isAdmin =
    user?.user_metadata?.role === "admin" ||
    user?.email === "admin@bodyforce.com" ||
    user?.app_metadata?.role === "admin";

  return user ? (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-100">
      {/* Header mobile */}
      <div className="lg:hidden p-4 bg-white shadow-md flex justify-between items-center">
        <div className="flex items-center gap-2">
          <img
            src="/images/logo.png"
            alt="Logo BodyForce"
            className="h-8 w-auto"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
          <h1 className="text-lg font-bold text-red-600">BODY FORCE</h1>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="text-2xl text-gray-700 hover:text-blue-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
        >
          <FaBars />
        </button>
      </div>

      <Sidebar user={user} onLogout={handleLogout} />

      {/* Menu mobile animé */}
      <AnimatedMobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        isAdmin={isAdmin}
        location={location}
      />

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
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route
            path="/admin/users"
            element={isAdmin ? <UserManagementPage /> : <Navigate to="/" />}
          />
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
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.email);
      setUser(session?.user || null);
      setLoading(false);
    });

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
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <LoginPage />}
        />
        <Route
          path="/*"
          element={<AppRoutes user={user} setUser={setUser} />}
        />
      </Routes>
    </Router>
  );
}

export default App;
