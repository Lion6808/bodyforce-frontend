// =============================================================================
// App.js — Point d'entree principal BodyForce
// =============================================================================
//
// Responsabilites :
//   - Routing (React Router) avec protection par authentification
//   - Layout responsive : sidebar desktop, bottom nav + menu mobile
//   - Theme dark/light/auto (hook useDarkMode)
//   - Navigation par swipe (hook useSwipeNavigation)
//   - PWA : install prompt, toast, service worker
//   - Realtime : toast Supabase sur nouveau passage badge
//
// Sections :
//   1. Imports
//   2. Constants & Configuration
//   3. Hook useDarkMode
//   4. Hook useSwipeNavigation
//   5. LoginPage
//   6. BottomNavigationBar
//   7. EnhancedSidebar (desktop)
//   8. AnimatedMobileMenu
//   9. PWA (InstallPrompt, PWAToast, usePWA)
//  10. AppRoutes (layout principal authentifie)
//  11. App (racine)
// =============================================================================

// =============================================================================
// SECTION 1 — Imports
// =============================================================================

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
  FaUser,
  FaUserFriends,
  FaUserPlus,
  FaChartBar,
  FaCalendarAlt,
  FaBars,
  FaTimes,
  FaUserCircle,
  FaSignOutAlt,
  FaCreditCard,
  FaDownload,
  FaCheck,
  FaTimes as FaTimesIcon,
  FaMoon,
  FaSun,
  FaAdjust,
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
  FaClipboardList,
  FaEnvelope,
  FaPaperPlane,
  FaComments,
  FaEllipsisH,
  FaFilePdf,
} from "react-icons/fa";
import { supabase } from "./supabaseClient";
import { useAuth } from "./contexts/AuthContext";

// Pages
import MessagesPage from "./pages/MessagesPage";
import NotificationBell from "./components/NotificationBell";
import HomePage from "./pages/HomePage";
import MembersPage from "./pages/MembersPage";
import PlanningPage from "./pages/PlanningPage";
import PaymentsPage from "./pages/PaymentsPage";
import StatisticsPage from "./pages/StatisticsPage";
import UserManagementPage from "./pages/UserManagementPage";
import UserProfilePage from "./pages/UserProfilePage";
import MyAttendancesPage from "./pages/MyAttendancesPage";
import InvitationsPage from "./pages/InvitationsPage";
import InvitationSignupPage from "./pages/InvitationSignupPage";
import MemberFormPage from "./pages/MemberFormPage";
import ReportsPage from "./pages/ReportsPage";
import EmailPage from "./pages/EmailPage";

// Styles & notifications
import { ToastContainer, toast as showToast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

// =============================================================================
// SECTION 2 — Constants & Configuration
// =============================================================================

const APP_VERSION = "2.5.1";

/** Recupere la photo de profil d'un utilisateur par son email */
const fetchUserPhoto = async (userId) => {
  const { data, error } = await supabase
    .from("members")
    .select("photo")
    .eq("email", userId)
    .single();
  return error ? null : data?.photo || null;
};

/**
 * Retourne les onglets de la barre de navigation mobile selon le role.
 * Admin : Accueil, Membres, Planning, Paiements, Plus
 * Membre : Accueil, Messages, Presences, Profil
 */
const getBottomNavTabs = (isAdmin) => {
  if (isAdmin) {
    return [
      { id: "home", name: "Accueil", path: "/", icon: FaHome, color: "text-red-500" },
      { id: "members", name: "Membres", path: "/members", icon: FaUserFriends, color: "text-green-500" },
      { id: "planning", name: "Planning", path: "/planning", icon: FaCalendarAlt, color: "text-yellow-500" },
      { id: "payments", name: "Paiements", path: "/payments", icon: FaCreditCard, color: "text-purple-500" },
      { id: "more", name: "Plus", path: "/more", icon: FaEllipsisH, color: "text-gray-500", isMore: true },
    ];
  }
  return [
    { id: "home", name: "Accueil", path: "/", icon: FaHome, color: "text-red-500" },
    { id: "messages", name: "Messages", path: "/messages", icon: FaComments, color: "text-blue-500" },
    { id: "attendances", name: "Présences", path: "/my-attendances", icon: FaClipboardList, color: "text-green-500" },
    { id: "profile", name: "Profil", path: "/profile", icon: FaUser, color: "text-purple-500" },
  ];
};

/** Elements du menu "Plus" (admin, mobile) */
const getMoreMenuItems = () => [
  { id: "statistics", name: "Statistiques", path: "/statistics", icon: FaChartBar, color: "text-blue-500" },
  { id: "reports", name: "Rapports PDF", path: "/reports", icon: FaFilePdf, color: "text-red-500" },
  { id: "emails", name: "Emails", path: "/emails", icon: FaPaperPlane, color: "text-emerald-500" },
  { id: "messages", name: "Messages", path: "/messages", icon: FaComments, color: "text-sky-500" },
  { id: "invitations", name: "Invitations", path: "/invitations", icon: FaUserPlus, color: "text-orange-500" },
];

/**
 * Retourne les liens de navigation (sidebar desktop + menu mobile).
 * Factorise la liste dupliquee entre EnhancedSidebar et AnimatedMobileMenu.
 */
const getMenuItems = (isAdmin) => [
  { path: "/", icon: FaHome, label: "Accueil" },
  ...(isAdmin
    ? [
        { path: "/members", icon: FaUserFriends, label: "Membres" },
        { path: "/planning", icon: FaCalendarAlt, label: "Planning" },
        { path: "/payments", icon: FaCreditCard, label: "Paiements" },
        { path: "/statistics", icon: FaChartBar, label: "Statistiques" },
        { path: "/reports", icon: FaFilePdf, label: "Rapports PDF" },
        { path: "/emails", icon: FaPaperPlane, label: "Emails" },
        { path: "/invitations", icon: FaUserPlus, label: "Invitations" },
        { path: "/messages", icon: FaComments, label: "Messages" },
      ]
    : [
        { path: "/messages", icon: FaComments, label: "Messages" },
        { path: "/my-attendances", icon: FaClipboardList, label: "Mes présences" },
        { path: "/profile", icon: FaUser, label: "Mon profil" },
      ]),
];

// =============================================================================
// SECTION 3 — Hook useDarkMode
// =============================================================================

/**
 * Gere le theme de l'application (clair / sombre / auto).
 * Le mode auto bascule automatiquement selon l'heure (19h-7h = sombre).
 */
function useDarkMode() {
  const [darkMode, setDarkMode] = useState("auto");
  const [actualDarkMode, setActualDarkMode] = useState(false);

  const NIGHT_START_HOUR = 19;
  const NIGHT_END_HOUR = 7;
  const AUTO_CHECK_INTERVAL = 60000;

  const isNightTime = () => {
    const hour = new Date().getHours();
    return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
  };

  const determineActualMode = (mode) => {
    switch (mode) {
      case "dark":
        return true;
      case "light":
        return false;
      case "auto":
      default:
        return isNightTime();
    }
  };

  const applyTheme = (isDark) => {
    const htmlElement = document.documentElement;
    if (isDark) {
      htmlElement.classList.add("dark");
    } else {
      htmlElement.classList.remove("dark");
    }
  };

  // Initialisation depuis localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode") || "auto";
    const newActualMode = determineActualMode(savedMode);
    setDarkMode(savedMode);
    setActualDarkMode(newActualMode);
    applyTheme(newActualMode);
  }, []);

  // Reagir au changement de mode
  useEffect(() => {
    const newActualMode = determineActualMode(darkMode);
    setActualDarkMode(newActualMode);
    applyTheme(newActualMode);
  }, [darkMode]);

  // En mode auto, verifier periodiquement l'heure
  useEffect(() => {
    if (darkMode === "auto") {
      const interval = setInterval(() => {
        const shouldBeDark = isNightTime();
        if (shouldBeDark !== actualDarkMode) {
          setActualDarkMode(shouldBeDark);
          applyTheme(shouldBeDark);
        }
      }, AUTO_CHECK_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [darkMode, actualDarkMode]);

  const toggleDarkMode = () => {
    const modes = ["auto", "light", "dark"];
    const currentIndex = modes.indexOf(darkMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setDarkMode(nextMode);
    localStorage.setItem("darkMode", nextMode);
  };

  const getDarkModeIcon = () => {
    switch (darkMode) {
      case "light":
        return <FaSun className="w-5 h-5" />;
      case "dark":
        return <FaMoon className="w-5 h-5" />;
      case "auto":
      default:
        return <FaAdjust className="w-5 h-5" />;
    }
  };

  const getDarkModeLabel = () => {
    switch (darkMode) {
      case "light":
        return "Mode clair";
      case "dark":
        return "Mode sombre";
      case "auto":
      default:
        return `Mode auto ${actualDarkMode ? "🌙" : "☀️"}`;
    }
  };

  return {
    darkMode,
    actualDarkMode,
    toggleDarkMode,
    getDarkModeIcon,
    getDarkModeLabel,
  };
}

// =============================================================================
// SECTION 4 — Hook useSwipeNavigation
// =============================================================================

/**
 * Gere la navigation par swipe horizontal sur mobile.
 * Permet de changer d'onglet en glissant le doigt.
 */
function useSwipeNavigation(isAdmin) {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isSwipeEnabled, setIsSwipeEnabled] = useState(true);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipping, setIsSwipping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  const minSwipeDistance = 50;
  const maxVerticalDistance = 100;
  const tabs = getBottomNavTabs(isAdmin);

  const getCurrentTabIndex = () => {
    const currentPath = location.pathname;
    const index = tabs.findIndex((tab) => tab.path === currentPath);
    return index !== -1 ? index : 0;
  };

  const onTouchStart = (e) => {
    if (!isSwipeEnabled) return;
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
    setIsSwipping(false);
    setSwipeDirection(null);
  };

  const onTouchMove = (e) => {
    if (!isSwipeEnabled || !touchStart) return;

    const currentTouch = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    };

    const diffX = touchStart.x - currentTouch.x;
    const diffY = Math.abs(touchStart.y - currentTouch.y);

    if (Math.abs(diffX) > 10 && diffY < maxVerticalDistance) {
      setIsSwipping(true);
      setSwipeDirection(diffX > 0 ? "left" : "right");
      const offset = Math.max(Math.min(-diffX, 100), -100);
      setSwipeOffset(offset);
    }

    setTouchEnd(currentTouch);
  };

  const onTouchEnd = () => {
    if (!isSwipeEnabled || !touchStart || !touchEnd) {
      setSwipeOffset(0);
      setIsSwipping(false);
      setSwipeDirection(null);
      return;
    }

    const diffX = touchStart.x - touchEnd.x;
    const diffY = Math.abs(touchStart.y - touchEnd.y);

    const isHorizontalSwipe =
      Math.abs(diffX) > minSwipeDistance && diffY < maxVerticalDistance;

    if (isHorizontalSwipe) {
      const currentIndex = getCurrentTabIndex();
      let newIndex = currentIndex;

      if (diffX > 0 && currentIndex < tabs.length - 1) {
        newIndex = currentIndex + 1;
      } else if (diffX < 0 && currentIndex > 0) {
        newIndex = currentIndex - 1;
      }

      if (newIndex !== currentIndex && tabs[newIndex]) {
        navigate(tabs[newIndex].path);
      }
    }

    setTimeout(() => {
      setSwipeOffset(0);
      setIsSwipping(false);
      setSwipeDirection(null);
    }, 100);

    setTouchStart(null);
    setTouchEnd(null);
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    isSwipeEnabled,
    setIsSwipeEnabled,
    swipeOffset,
    isSwipping,
    swipeDirection,
  };
}

// =============================================================================
// SECTION 5 — LoginPage
// =============================================================================

/** Page de connexion (email + mot de passe) */
function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (authError) throw authError;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role, is_disabled")
        .eq("user_id", authData.user.id)
        .single();

      if (roleData?.is_disabled) {
        await supabase.auth.signOut();
        throw new Error(
          "Votre compte a été désactivé. Contactez l'administrateur."
        );
      }

      const photoUrl = await fetchUserPhoto(email);

      setUser({
        email: authData.user.email,
        id: authData.user.id,
        role: roleData?.role || "user",
        photo: photoUrl,
      });

      navigate("/");
    } catch (err) {
      setError(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo & titre */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="/images/logo.png"
              alt="Logo BodyForce"
              className="h-20 w-auto"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            BODY FORCE
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Connectez-vous à votre espace
          </p>
        </div>

        {/* Formulaire de connexion */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-all"
              placeholder="votre@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Connexion...
              </span>
            ) : (
              "Se connecter"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// SECTION 6 — BottomNavigationBar (mobile)
// =============================================================================

/** Barre de navigation fixee en bas sur mobile avec menu "Plus" pour admin */
function BottomNavigationBar({ isAdmin, currentPath }) {
  const tabs = getBottomNavTabs(isAdmin);
  const navigate = useNavigate();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuItems = getMoreMenuItems();

  const handleTabClick = (tab) => {
    if (tab.isMore) {
      setShowMoreMenu(!showMoreMenu);
    } else {
      navigate(tab.path);
      setShowMoreMenu(false);
    }
  };

  const handleMoreItemClick = (item) => {
    navigate(item.path);
    setShowMoreMenu(false);
  };

  const isActive = (path) => {
    if (path === "/") return currentPath === "/";
    return currentPath.startsWith(path);
  };

  return (
    <>
      {/* Backdrop du menu "Plus" */}
      {showMoreMenu && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setShowMoreMenu(false)}
        />
      )}

      {/* Menu "Plus" (overflow) */}
      {showMoreMenu && (
        <div className="fixed bottom-20 left-0 right-0 z-50 mx-4 mb-2">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-2">
              {moreMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleMoreItemClick(item)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive(item.path)
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                  >
                    <Icon
                      className={`text-xl ${
                        isActive(item.path)
                          ? "text-blue-600 dark:text-blue-400"
                          : item.color
                      }`}
                    />
                    <span
                      className={`font-medium ${
                        isActive(item.path)
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Barre d'onglets */}
      <nav className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="flex justify-around items-center h-16 px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.isMore ? showMoreMenu : isActive(tab.path);

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-all ${
                  active ? "scale-110" : "scale-100"
                }`}
              >
                <Icon
                  className={`text-2xl mb-1 transition-colors ${
                    active ? "text-blue-600 dark:text-blue-400" : tab.color
                  }`}
                />
                <span
                  className={`text-xs font-medium transition-colors ${
                    active
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {tab.name}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

// =============================================================================
// SECTION 7 — EnhancedSidebar (desktop)
// =============================================================================

/** Sidebar retractable pour la navigation desktop */
function EnhancedSidebar({
  user,
  isAdmin,
  onLogout,
  toggleDarkMode,
  getDarkModeIcon,
  getDarkModeLabel,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const menuItems = getMenuItems(isAdmin);

  return (
    <aside
      className={`hidden lg:flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Header : logo + bouton collapse */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <img
                src="/images/logo.png"
                alt="Logo"
                className="h-8 w-auto"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
              <h1 className="text-lg font-bold text-red-600 dark:text-red-400">
                BODY FORCE
              </h1>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label={isCollapsed ? "Étendre le menu" : "Réduire le menu"}
          >
            {isCollapsed ? (
              <FaAngleDoubleRight className="text-gray-600 dark:text-gray-400" />
            ) : (
              <FaAngleDoubleLeft className="text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Liens de navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                title={isCollapsed ? item.label : ""}
              >
                <Icon className="text-xl flex-shrink-0" />
                {!isCollapsed && (
                  <span className="font-medium">{item.label}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer : user info, dark mode, deconnexion */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div
          className={`flex items-center gap-3 mb-4 ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          {user?.photo ? (
            <img
              src={user.photo}
              alt="Profil"
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <FaUserCircle className="w-10 h-10 text-gray-400" />
          )}
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isAdmin ? "Administrateur" : "Membre"}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 mb-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title={getDarkModeLabel()}
        >
          {getDarkModeIcon()}
          {!isCollapsed && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {getDarkModeLabel()}
            </span>
          )}
        </button>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
        >
          <FaSignOutAlt />
          {!isCollapsed && (
            <span className="text-sm font-medium">Déconnexion</span>
          )}
        </button>
      </div>
    </aside>
  );
}

// =============================================================================
// SECTION 8 — AnimatedMobileMenu (panneau lateral mobile)
// =============================================================================

/** Menu lateral anime (slide-in) pour mobile */
function AnimatedMobileMenu({
  isOpen,
  onClose,
  user,
  isAdmin,
  onLogout,
  toggleDarkMode,
  getDarkModeIcon,
  getDarkModeLabel,
}) {
  const location = useLocation();
  const menuItems = getMenuItems(isAdmin);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panneau lateral */}
      <div
        className={`lg:hidden fixed top-0 right-0 h-full w-80 max-w-full bg-white dark:bg-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header du panneau */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Menu
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Fermer le menu"
            >
              <FaTimes className="text-xl text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Infos utilisateur + navigation */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center gap-3 p-4 mb-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              {user?.photo ? (
                <img
                  src={user.photo}
                  alt="Profil"
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <FaUserCircle className="w-12 h-12 text-gray-400" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isAdmin ? "Administrateur" : "Membre"}
                </p>
              </div>
            </div>

            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.path === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <Icon className="text-xl" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer : dark mode + deconnexion */}
          <div className="p-4 pb-24 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {getDarkModeIcon()}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {getDarkModeLabel()}
              </span>
            </button>

            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <FaSignOutAlt />
              <span className="text-sm font-medium">Déconnexion</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// =============================================================================
// SECTION 9 — PWA (InstallPrompt, PWAToast, usePWA)
// =============================================================================

/** Banniere d'invitation a installer la PWA */
function InstallPrompt({ show, onInstall, onDismiss }) {
  if (!show) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 z-50 border border-gray-200 dark:border-gray-700 animate-slide-up">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <img
            src="/images/logo.png"
            alt="Logo"
            className="w-12 h-12 rounded-xl"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 dark:text-white mb-1">
            Installer Body Force
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Accédez rapidement à l'application depuis votre écran d'accueil
          </p>
          <div className="flex gap-2">
            <button
              onClick={onInstall}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Installer
            </button>
            <button
              onClick={onDismiss}
              className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Plus tard
            </button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Fermer"
        >
          <FaTimes />
        </button>
      </div>
    </div>
  );
}

/** Toast de feedback PWA (install success, etc.) */
function PWAToast({ toast, onClose }) {
  if (!toast) return null;

  const bgColor = toast.type === "success" ? "bg-green-500" : "bg-blue-500";

  return (
    <div
      className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-4 rounded-lg shadow-lg z-50 animate-slide-down flex items-center gap-3`}
    >
      {toast.type === "success" ? <FaCheck /> : <FaDownload />}
      <span>{toast.message}</span>
      <button
        onClick={onClose}
        className="ml-2 hover:bg-white/20 rounded p-1 transition-colors"
        aria-label="Fermer"
      >
        <FaTimesIcon />
      </button>
    </div>
  );
}

/** Hook de gestion PWA : detecte installabilite, affiche prompt, gere install */
function usePWA() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [toast, setToast] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia(
      "(display-mode: standalone)"
    ).matches;
    setIsInstalled(isStandalone || window.navigator.standalone);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);

      const lastDismissed = localStorage.getItem("pwa-prompt-dismissed");
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      if (!lastDismissed || parseInt(lastDismissed) < oneDayAgo) {
        setTimeout(() => setShowInstallPrompt(true), 5000);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setShowInstallPrompt(false);
      showPWAToast("Application installée avec succès !", "success");
      localStorage.removeItem("pwa-prompt-dismissed");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) {
      showPWAToast("Installation non disponible", "info");
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        showPWAToast("Installation en cours...", "info");
      }

      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } catch (error) {
      console.error("Erreur installation PWA:", error);
      showPWAToast("Erreur lors de l'installation", "info");
    }
  };

  /** Toast interne PWA (distinct du toast react-toastify importe en tant que showToast) */
  const showPWAToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const closeToast = () => {
    setToast(null);
  };

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    localStorage.setItem("pwa-prompt-dismissed", Date.now().toString());
  };

  return {
    isInstallable,
    isInstalled,
    installApp,
    toast,
    closeToast,
    showInstallPrompt,
    dismissInstallPrompt,
  };
}

// =============================================================================
// SECTION 10 — AppRoutes (layout principal authentifie)
// =============================================================================

/** Layout principal avec sidebar, header mobile, routes protegees et bottom nav */
function AppRoutes() {
  const { user, role, setUser } = useAuth();
  const isAdmin = role === "admin";

  // Charger la photo utilisateur si manquante
  useEffect(() => {
    const updateUserPhoto = async () => {
      if (user && !user.photo) {
        const photoUrl = await fetchUserPhoto(user.email);
        if (photoUrl) {
          setUser((prev) => ({ ...prev, photo: photoUrl }));
        }
      }
    };
    updateUserPhoto();
  }, [user, setUser]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const {
    isInstallable,
    isInstalled,
    installApp,
    toast,
    closeToast,
    showInstallPrompt,
    dismissInstallPrompt,
  } = usePWA();

  const handleInstallFromPrompt = () => {
    installApp();
    dismissInstallPrompt();
  };

  const { toggleDarkMode, getDarkModeIcon, getDarkModeLabel } = useDarkMode();

  const {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    isSwipeEnabled,
    setIsSwipeEnabled,
    swipeOffset,
    isSwipping,
    swipeDirection,
  } = useSwipeNavigation(isAdmin);

  // Detection mobile (breakpoint 768px)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Desactiver le swipe quand le menu mobile est ouvert
  useEffect(() => {
    setIsSwipeEnabled(!mobileMenuOpen);
  }, [mobileMenuOpen, setIsSwipeEnabled]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      navigate("/login");
    } catch (error) {
      console.error("Erreur déconnexion:", error);
    }
  };

  // Redirection si non connecte
  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-200 overflow-hidden">
      {/* Header mobile */}
      <div className="lg:hidden p-4 bg-white dark:bg-gray-800 shadow-md flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="mobile-header-logo-3d">
            <img
              src="/images/logo.png"
              alt="Logo BodyForce"
              className="h-8 w-auto"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </div>
          <h1 className="text-lg font-bold text-red-600 dark:text-red-400">
            BODY FORCE
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={toggleDarkMode}
            className="text-xl text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title={getDarkModeLabel()}
            aria-label={getDarkModeLabel()}
          >
            {getDarkModeIcon()}
          </button>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="text-2xl text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Ouvrir le menu"
          >
            <FaBars />
          </button>
        </div>
      </div>

      {/* Sidebar desktop */}
      <EnhancedSidebar
        user={user}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        toggleDarkMode={toggleDarkMode}
        getDarkModeIcon={getDarkModeIcon}
        getDarkModeLabel={getDarkModeLabel}
      />

      {/* Menu mobile (slide-in) */}
      <AnimatedMobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        toggleDarkMode={toggleDarkMode}
        getDarkModeIcon={getDarkModeIcon}
        getDarkModeLabel={getDarkModeLabel}
      />

      {/* Bouton install PWA */}
      {isInstallable && !isInstalled && (
        <button
          onClick={installApp}
          className="pwa-install-button"
          title="Installer Body Force"
          aria-label="Installer l'application"
        >
          <FaDownload />
          <span className="hidden sm:inline">Installer l'app</span>
        </button>
      )}

      <PWAToast toast={toast} onClose={closeToast} />

      {/* Zone de contenu principal */}
      <main className="flex-1 overflow-y-auto p-4">
        <div
          className={isMobile ? "swipe-container pb-20" : ""}
          onTouchStart={isMobile ? onTouchStart : undefined}
          onTouchMove={isMobile ? onTouchMove : undefined}
          onTouchEnd={isMobile ? onTouchEnd : undefined}
        >
          <div
            className={`swipe-content ${isSwipping ? "swiping" : ""}`}
            style={{
              transform:
                isMobile && swipeOffset !== 0
                  ? `translateX(${swipeOffset}px)`
                  : "translateX(0)",
            }}
          >
            {/* Definitions des routes */}
            <Routes>
              <Route path="/" element={<HomePage />} />

              {/* Routes admin uniquement */}
              {isAdmin && (
                <>
                  <Route path="/members" element={<MembersPage />} />
                  <Route path="/members/new" element={<MemberFormPage />} />
                  <Route path="/members/edit" element={<MemberFormPage />} />
                  <Route path="/planning" element={<PlanningPage />} />
                  <Route path="/payments" element={<PaymentsPage />} />
                  <Route path="/statistics" element={<StatisticsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/emails" element={<EmailPage />} />
                  <Route path="/admin/users" element={<UserManagementPage />} />
                  <Route path="/invitations" element={<InvitationsPage />} />
                </>
              )}

              {/* Routes partagees */}
              <Route path="/my-attendances" element={<MyAttendancesPage />} />
              <Route path="/profile" element={<UserProfilePage />} />
              <Route path="/messages" element={<MessagesPage />} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </div>
      </main>

      {/* Bottom nav mobile */}
      {isMobile && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
          <BottomNavigationBar
            isAdmin={isAdmin}
            currentPath={location.pathname}
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SECTION 11 — App (composant racine)
// =============================================================================

/** Composant racine : routing de premier niveau, realtime toasts, PWA, version */
function App() {
  const { user, loading } = useAuth();

  const {
    isInstallable,
    isInstalled,
    installApp,
    toast,
    closeToast,
    showInstallPrompt,
    dismissInstallPrompt,
  } = usePWA();

  // Realtime : toast sur chaque nouveau passage badge
  useEffect(() => {
    const channel = supabase
      .channel("presences-inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "presences" },
        async (payload) => {
          try {
            const { badgeId, timestamp } = payload.new;
            const time = new Date(timestamp).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            });

            // Bouton Poussoir (pas de badgeId)
            if (!badgeId) {
              showToast.info(`BP (Sortie) — ${time}`, { autoClose: 5000 });
              return;
            }

            // Chercher le membre par badgeId
            let memberName = badgeId;
            const { data: member } = await supabase
              .from("members")
              .select("name, firstName")
              .eq("badgeId", badgeId)
              .maybeSingle();

            if (member) {
              memberName = `${member.firstName || ""} ${member.name || ""}`.trim();
            } else {
              // Fallback : chercher dans badge_history
              const { data: bh } = await supabase
                .from("badge_history")
                .select("member_id")
                .eq("badge_real_id", badgeId)
                .order("date_attribution", { ascending: false })
                .limit(1)
                .maybeSingle();
              if (bh?.member_id) {
                const { data: m } = await supabase
                  .from("members")
                  .select("name, firstName")
                  .eq("id", bh.member_id)
                  .maybeSingle();
                if (m) {
                  memberName = `${m.firstName || ""} ${m.name || ""}`.trim();
                }
              }
            }

            showToast.info(`Passage : ${memberName} — ${time}`, {
              autoClose: 5000,
            });
          } catch (err) {
            console.error("Erreur toast presence:", err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleInstallFromPrompt = () => {
    installApp();
    dismissInstallPrompt();
  };

  // Ecran de chargement initial
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      {/* Routes de premier niveau */}
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <LoginPage />}
        />
        <Route path="/invitation" element={<InvitationSignupPage />} />
        <Route path="/*" element={<AppRoutes />} />
      </Routes>

      {/* Banniere d'installation PWA */}
      <InstallPrompt
        show={showInstallPrompt && isInstallable && !isInstalled}
        onInstall={handleInstallFromPrompt}
        onDismiss={dismissInstallPrompt}
      />

      {/* Toast PWA */}
      <PWAToast toast={toast} onClose={closeToast} />

      {/* Container global des toasts react-toastify */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />

      {/* Badge de version - positionné plus haut sur mobile pour éviter la bottom nav */}
      <div
        className="fixed bottom-20 lg:bottom-3 right-3 z-40 px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg bg-gray-800 dark:bg-gray-700 text-gray-100 cursor-default"
        title={`Version de l'application : ${APP_VERSION}`}
      >
        v{APP_VERSION}
      </div>
    </Router>
  );
}

export default App;
