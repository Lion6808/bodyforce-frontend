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
} from "react-icons/fa";
import { supabase } from "./supabaseClient";

import HomePage from "./pages/HomePage";
import MembersPage from "./pages/MembersPage";
import PlanningPage from "./pages/PlanningPage";
import StatisticsPage from "./pages/StatisticsPage";
import UserManagementPage from "./pages/UserManagementPage";
import ProfilePage from "./pages/ProfilePage";
import MemberForm from "./components/MemberForm";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Erreur : " + error.message);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-blue-50">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded shadow w-80">
        <h2 className="text-xl font-bold mb-4 text-blue-600">Connexion</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-2 px-3 py-2 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 px-3 py-2 border rounded"
          required
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded"
        >
          Se connecter
        </button>
      </form>
    </div>
  );
}

function Sidebar({ user, onLogout }) {
  const location = useLocation();
  const menu = [
    { name: "Accueil", path: "/", icon: <FaHome className="text-red-500" /> },
    { name: "Membres", path: "/members", icon: <FaUserFriends className="text-green-500" /> },
    { name: "Planning", path: "/planning", icon: <FaCalendarAlt className="text-yellow-500" /> },
    { name: "Statistique", path: "/statistics", icon: <FaChartBar className="text-blue-500" /> },
  ];

  return (
    <aside className="w-64 bg-white shadow-md p-4 flex-col items-center hidden lg:flex">
      <h1 className="text-center text-lg font-bold text-red-600 mb-2">CLUB BODY FORCE</h1>
      <img src="/images/logo.png" alt="Logo" className="mt-4 h-44 w-auto mb-6" />
      <div className="mb-4 text-sm text-gray-600 flex items-center gap-2">
        <FaUserCircle className="text-xl text-blue-600" />
        {user?.email}
      </div>
      <ul className="w-full space-y-2">
        {menu.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 hover:bg-blue-100 ${location.pathname === item.path ? "bg-blue-200" : ""}`}
            >
              {item.icon} {item.name}
            </Link>
          </li>
        ))}
        {user?.user_metadata?.role === "admin" && (
          <li>
            <Link
              to="/admin/users"
              className={`flex items-center gap-2 rounded-lg px-4 py-2 hover:bg-purple-100 ${location.pathname === "/admin/users" ? "bg-purple-200" : ""}`}
            >
              <FaUserCircle className="text-purple-500" /> Utilisateurs
            </Link>
          </li>
        )}
        <li>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 rounded-lg px-4 py-2 w-full text-left text-red-600 hover:bg-red-100"
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
    await supabase.auth.signOut();
    setUser(null);
    navigate("/login");
  };

  return user ? (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-100">
      <div className="lg:hidden p-2 bg-white shadow-md flex justify-between items-center">
        <button onClick={() => setMobileMenuOpen(true)} className="text-2xl">
          <FaBars />
        </button>
        <h1 className="text-lg font-bold text-red-600">CLUB BODY FORCE</h1>
      </div>

      <Sidebar user={user} onLogout={handleLogout} />

      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-white z-50 p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-lg font-bold text-red-600">CLUB BODY FORCE</h1>
            <button onClick={() => setMobileMenuOpen(false)}>
              <FaTimes className="text-2xl text-gray-700" />
            </button>
          </div>
          <Sidebar user={user} onLogout={handleLogout} />
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
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/admin/users" element={user?.user_metadata?.role === "admin" ? <UserManagementPage /> : <Navigate to="/" />} />
          <Route path="/profile" element={<ProfilePage />} />
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

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) setUser(data.user);
    };
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<AppRoutes user={user} setUser={setUser} />} />
      </Routes>
    </Router>
  );
}

export default App;
