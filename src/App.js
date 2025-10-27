// ✅ PARTIE 1/7 : IMPORTS ET CONFIGURATIONS

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
  FaChevronLeft,
  FaChevronRight,
  FaMoon,
  FaSun,
  FaAdjust,
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
  FaClipboardList,
  FaEnvelope,
  FaEllipsisH, // Pour le bouton "Plus"
} from "react-icons/fa";
import { supabase } from "./supabaseClient";
import { useAuth } from "./contexts/AuthContext";

// Messagerie et notifications
import MessagesPage from "./pages/MessagesPage";
import NotificationBell from "./components/NotificationBell";

// Import des pages
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

// Styles et notifications
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

// Récupération photo de profil
const fetchUserPhoto = async (userId) => {
  const { data, error } = await supabase
    .from("members")
    .select("photo")
    .eq("email", userId)
    .single();

  return error ? null : data?.photo || null;
};

// App version
const APP_VERSION = "2.0.3";


// ✅ Configuration des onglets Bottom Nav - DYNAMIQUE selon le rôle
const getBottomNavTabs = (isAdmin) => {
  if (isAdmin) {
    return [
      {
        id: "home",
        name: "Accueil",
        path: "/",
        icon: FaHome,
        color: "text-red-500",
      },
      {
        id: "members",
        name: "Membres",
        path: "/members",
        icon: FaUserFriends,
        color: "text-green-500",
      },
      {
        id: "planning",
        name: "Planning",
        path: "/planning",
        icon: FaCalendarAlt,
        color: "text-yellow-500",
      },
      {
        id: "payments",
        name: "Paiements",
        path: "/payments",
        icon: FaCreditCard,
        color: "text-purple-500",
      },
      {
        id: "more",
        name: "Plus",
        path: "/more",
        icon: FaEllipsisH,
        color: "text-gray-500",
        isMore: true,
      },
    ];
  } else {
    return [
      {
        id: "home",
        name: "Accueil",
        path: "/",
        icon: FaHome,
        color: "text-red-500",
      },
      {
        id: "messages",
        name: "Messages",
        path: "/messages",
        icon: FaEnvelope,
        color: "text-blue-500",
      },
      {
        id: "attendances",
        name: "Présences",
        path: "/my-attendances",
        icon: FaClipboardList,
        color: "text-green-500",
      },
      {
        id: "profile",
        name: "Profil",
        path: "/profile",
        icon: FaUser,
        color: "text-purple-500",
      },
    ];
  }
};

// ✅ Menu "Plus" pour admin
const getMoreMenuItems = () => [
  {
    id: "statistics",
    name: "Statistiques",
    path: "/statistics",
    icon: FaChartBar,
    color: "text-blue-500",
  },
  {
    id: "messages",
    name: "Messages",
    path: "/messages",
    icon: FaEnvelope,
    color: "text-sky-500",
  },
  {
    id: "invitations",
    name: "Invitations",
    path: "/invitations",
    icon: FaUserPlus,
    color: "text-orange-500",
  },
];

// ✅ PARTIE 2/7 : HOOK DARK MODE (Inchangé)

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

  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode") || "auto";
    const newActualMode = determineActualMode(savedMode);
    setDarkMode(savedMode);
    setActualDarkMode(newActualMode);
    applyTheme(newActualMode);
  }, []);

  useEffect(() => {
    const newActualMode = determineActualMode(darkMode);
    setActualDarkMode(newActualMode);
    applyTheme(newActualMode);
  }, [darkMode]);

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

// ✅ PARTIE 3/7 : HOOK SWIPE NAVIGATION (Adapté pour Bottom Nav)

function useSwipeNavigation(isAdmin) {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isSwipeEnabled, setIsSwipeEnabled] = useState(true);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipping, setIsSwipping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const MIN_SWIPE_DISTANCE = 100;
  const MAX_SWIPE_DISTANCE = 200;
  const SWIPE_ANIMATION_DELAY = 200;
  const SWIPE_RESET_DELAY = 50;

  // Utilise les mêmes pages que le bottom nav (sans "More")
  const SWIPE_PAGES = getBottomNavTabs(isAdmin).filter(tab => !tab.isMore);

  const getCurrentPageIndex = () => {
    return SWIPE_PAGES.findIndex((page) => page.path === location.pathname);
  };

  const navigateToPage = (direction) => {
    const currentIndex = getCurrentPageIndex();
    if (currentIndex === -1) return;

    let newIndex;
    if (direction === "left") {
      newIndex = currentIndex + 1;
      if (newIndex >= SWIPE_PAGES.length) newIndex = 0;
    } else {
      newIndex = currentIndex - 1;
      if (newIndex < 0) newIndex = SWIPE_PAGES.length - 1;
    }

    setIsSwipping(true);
    setSwipeOffset(
      direction === "left" ? -window.innerWidth : window.innerWidth
    );

    setTimeout(() => {
      navigate(SWIPE_PAGES[newIndex].path);
      setTimeout(() => {
        setSwipeOffset(0);
        setIsSwipping(false);
        setSwipeDirection(null);
      }, SWIPE_RESET_DELAY);
    }, SWIPE_ANIMATION_DELAY);
  };

  const onTouchStart = (e) => {
    if (!isSwipeEnabled) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsSwipping(true);
    setSwipeDirection(null);
  };

  const onTouchMove = (e) => {
    if (!isSwipeEnabled || !touchStart) return;

    const currentTouch = e.targetTouches[0].clientX;
    const distance = currentTouch - touchStart;
    const direction = distance > 0 ? "right" : "left";

    setSwipeDirection(direction);

    let offset = distance;
    const absDistance = Math.abs(distance);

    if (absDistance > MAX_SWIPE_DISTANCE) {
      const excess = absDistance - MAX_SWIPE_DISTANCE;
      const resistance = Math.log(excess / 50 + 1) * 50;
      offset =
        distance > 0
          ? MAX_SWIPE_DISTANCE + resistance
          : -MAX_SWIPE_DISTANCE - resistance;
    }

    setSwipeOffset(offset);
    setTouchEnd(currentTouch);
  };

  const onTouchEnd = () => {
    if (!isSwipeEnabled || !touchStart || !touchEnd) {
      setSwipeOffset(0);
      setIsSwipping(false);
      setSwipeDirection(null);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > MIN_SWIPE_DISTANCE;
    const isRightSwipe = distance < -MIN_SWIPE_DISTANCE;

    if (isLeftSwipe) {
      navigateToPage("left");
    } else if (isRightSwipe) {
      navigateToPage("right");
    } else {
      setSwipeOffset(0);
      setTimeout(() => {
        setIsSwipping(false);
        setSwipeDirection(null);
      }, SWIPE_ANIMATION_DELAY);
    }
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    getCurrentPageIndex,
    navigateToPage,
    isSwipeEnabled,
    setIsSwipeEnabled,
    totalPages: SWIPE_PAGES.length,
    swipeOffset,
    isSwipping,
    swipeDirection,
    SWIPE_PAGES,
  };
}

// ✅ PARTIE 4/7 : HOOK PWA (Inchangé)

function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [toast, setToast] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone
    ) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);

      setTimeout(() => {
        if (!localStorage.getItem("install_prompt_dismissed")) {
          setShowInstallPrompt(true);
        }
      }, 30000);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      showToast(
        "success",
        "Application installée !",
        "Body Force a été ajouté à votre écran d'accueil."
      );
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

  const showToast = (type, title, message) => {
    setToast({ type, title, message });
  };

  const installApp = async () => {
    if (!deferredPrompt) return;

    try {
      const result = await deferredPrompt.prompt();

      if (result.outcome === "accepted") {
        showToast(
          "success",
          "Installation en cours...",
          "Body Force va être ajouté à votre écran d'accueil."
        );
      } else {
        showToast(
          "info",
          "Installation annulée",
          "Vous pouvez toujours installer l'application plus tard."
        );
      }

      setDeferredPrompt(null);
      setIsInstallable(false);
      setShowInstallPrompt(false);
    } catch (error) {
      console.error("Erreur lors de l'installation PWA:", error);
      showToast(
        "error",
        "Erreur d'installation",
        "Une erreur s'est produite lors de l'installation."
      );
    }
  };

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    localStorage.setItem("install_prompt_dismissed", "true");
    setTimeout(() => {
      localStorage.removeItem("install_prompt_dismissed");
    }, 7 * 24 * 60 * 60 * 1000);
  };

  const closeToast = () => {
    setToast(null);
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

// ✅ PARTIE 5/7 : COMPOSANTS PWA ET UI

function PWAToast({ toast, onClose }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (toast) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 400);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className={`pwa-toast ${toast.type} ${show ? "show" : ""}`}>
      <div className="pwa-toast-header">
        <div className={`pwa-toast-icon ${toast.type}`}>
          {toast.type === "success" ? <FaCheck /> : <FaTimesIcon />}
        </div>
        <div className="pwa-toast-title">{toast.title}</div>
      </div>
      <div className="pwa-toast-message">{toast.message}</div>
    </div>
  );
}

function InstallPrompt({ show, onInstall, onDismiss }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (show) {
      setTimeout(() => setAnimate(true), 100);
    }
  }, [show]);

  if (!show) return null;

  return (
    <div
      className={`discrete-install-prompt ${animate ? "show" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="discrete-install-content">
        <div className="discrete-install-info">
          <div className="discrete-install-icon">📱</div>
          <div className="discrete-install-text">
            <div className="discrete-install-title">Installer BodyForce</div>
            <div className="discrete-install-subtitle">
              Accès rapide depuis votre écran d'accueil
            </div>
          </div>
        </div>

        <div className="discrete-install-actions">
          <button
            onClick={onDismiss}
            className="discrete-btn discrete-btn-dismiss"
            title="Plus tard"
          >
            ✕
          </button>
          <button
            onClick={onInstall}
            className="discrete-btn discrete-btn-install"
          >
            Installer
          </button>
        </div>
      </div>

      <div className="discrete-install-progress"></div>
    </div>
  );
}

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
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 w-full max-w-md border border-gray-200 dark:border-gray-700">
        <div className="text-center mb-6">
          <img
            src="/images/logo.png"
            alt="Logo BodyForce"
            className="h-24 w-auto mx-auto mb-4"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            CLUB BODY FORCE
          </h1>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            Connexion
          </h2>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

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
              disabled={loading}
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
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-800 text-white py-2 px-4 rounded-lg transition duration-200 font-medium"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Besoin d'un compte ? Contactez l'administrateur
          </p>
        </div>
      </div>
    </div>
  );
}

// ✅ PARTIE 6/7 : BOTTOM NAVIGATION BAR + MORE MENU

function BottomNavigationBar({ isAdmin, currentPath }) {
  const navigate = useNavigate();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const tabs = getBottomNavTabs(isAdmin);
  const moreItems = getMoreMenuItems();

  // Vérifier si on est sur une page du menu "Plus"
  const isMorePageActive = moreItems.some(item => item.path === currentPath);

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

  return (
    <>
      {/* Menu "Plus" étendu */}
      {showMoreMenu && isAdmin && (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3 shadow-lg">
          <div className="grid grid-cols-3 gap-3">
            {moreItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleMoreItemClick(item)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${currentPath === item.path
                    ? 'bg-gray-100 dark:bg-gray-700'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${currentPath === item.path
                    ? 'bg-gray-200 dark:bg-gray-600'
                    : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                    <Icon className={`w-6 h-6 ${item.color}`} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Barre de navigation */}
      <nav className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.isMore
              ? (showMoreMenu || isMorePageActive)
              : currentPath === tab.path;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[60px] ${isActive
                  ? 'bg-gray-100 dark:bg-gray-700'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-6 h-6 transition-all ${isActive ? tab.color : 'text-gray-400 dark:text-gray-500'
                      }`}
                  />
                  {/* Badge notification pour Messages */}
                  {tab.id === 'messages' && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                      3
                    </span>
                  )}
                </div>
                <span
                  className={`text-xs font-medium transition-all ${isActive
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400'
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

// ✅ Sidebar Desktop (inchangée)
function EnhancedSidebar({
  user,
  isAdmin,
  onLogout,
  toggleDarkMode,
  getDarkModeIcon,
  getDarkModeLabel,
}) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  const menu = [
    {
      name: "Accueil",
      path: "/",
      icon: <FaHome className="text-red-500 dark:text-red-400" />,
    },
    ...(isAdmin
      ? [
        {
          name: "Membres",
          path: "/members",
          icon: (
            <FaUserFriends className="text-green-500 dark:text-green-400" />
          ),
        },
        {
          name: "Planning",
          path: "/planning",
          icon: (
            <FaCalendarAlt className="text-yellow-500 dark:text-yellow-400" />
          ),
        },
        //{
        //   name: "Paiements",
        //  path: "/payments",
        //  icon: (
        //     <FaCreditCard className="text-purple-500 dark:text-purple-400" />
        //   ),
        //},
        {
          name: "Statistiques",
          path: "/statistics",
          icon: <FaChartBar className="text-blue-500 dark:text-blue-400" />,
        },
        {
          name: "Messages",
          path: "/messages",
          icon: <FaEnvelope className="text-sky-500 dark:text-sky-400" />,
        },
        {
          name: "Invitations",
          path: "/invitations",
          icon: (
            <FaUserPlus className="text-orange-500 dark:text-orange-400" />
          ),
        },
      ]
      : [
        {
          name: "Messages",
          path: "/messages",
          icon: <FaEnvelope className="text-sky-500 dark:text-sky-400" />,
        },
        {
          name: "Mon Profil",
          path: "/profile",
          icon: <FaUser className="text-blue-500 dark:text-blue-400" />,
        },
        {
          name: "Mes Présences",
          path: "/my-attendances",
          icon: (
            <FaClipboardList className="text-green-500 dark:text-green-400" />
          ),
        },
      ]),
  ];

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", newState.toString());
  };

  return (
    <aside
      className={`enhanced-sidebar ${isCollapsed ? "collapsed" : "expanded"
        } flex-col items-center hidden lg:flex transition-all duration-400 ease-out`}
    >
      <button
        className="sidebar-toggle"
        onClick={toggleSidebar}
        aria-label={isCollapsed ? "Étendre le menu" : "Réduire le menu"}
      >
        <div className="toggle-icon">
          <FaAngleDoubleRight />
        </div>
      </button>

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

      <div
        className={`sidebar-user-info mb-4 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 px-4 ${isCollapsed ? "opacity-0" : "opacity-100"
          }`}
      >
        {user?.photo ? (
          <img
            src={user.photo}
            alt="Photo de profil"
            className="w-8 h-8 rounded-full object-cover border-2 border-green-500 dark:border-blue-400"
          />
        ) : (
          <FaUserCircle className="text-xl text-blue-600 dark:text-blue-400 flex-shrink-0" />
        )}

        <div className="flex flex-col min-w-0">
          <span className="font-medium truncate">{user?.email}</span>
          {isAdmin && (
            <span className="text-xs text-purple-600 dark:text-purple-400 font-bold">
              Admin
            </span>
          )}
        </div>

        <div className="ml-auto">
          <NotificationBell />
        </div>
      </div>

      <div className="sidebar-divider"></div>

      <ul className="w-full space-y-2 px-4 flex-1">
        {menu.map((item, index) => (
          <li
            key={item.path}
            className={`sidebar-menu-item sidebar-item-enter ${location.pathname === item.path ? "active" : ""
              }`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <Link to={item.path} className="menu-link">
              <div className="menu-link-icon">{item.icon}</div>
              <span className="menu-link-text">{item.name}</span>
              {isCollapsed && <div className="menu-tooltip">{item.name}</div>}
            </Link>
          </li>
        ))}

        {isAdmin && (
          <li
            className={`sidebar-menu-item sidebar-item-enter ${location.pathname === "/admin/users" ? "active" : ""
              }`}
            style={{ animationDelay: `${menu.length * 0.1}s` }}
          >
            <Link to="/admin/users" className="menu-link">
              <div className="menu-link-icon">
                <FaUserCircle className="text-purple-500 dark:text-purple-400" />
              </div>
              <span className="menu-link-text">Utilisateurs</span>
              {isCollapsed && <div className="menu-tooltip">Utilisateurs</div>}
            </Link>
          </li>
        )}
      </ul>

      <div className="sidebar-divider"></div>

      <div className="sidebar-footer w-full px-4 space-y-2">
        <div className="sidebar-menu-item">
          <button
            onClick={toggleDarkMode}
            className="menu-link w-full text-left"
            title={getDarkModeLabel()}
          >
            <div className="menu-link-icon text-gray-600 dark:text-gray-400">
              {getDarkModeIcon()}
            </div>
            <span className="menu-link-text">
              {isCollapsed ? "" : getDarkModeLabel()}
            </span>
            {isCollapsed && (
              <div className="menu-tooltip">{getDarkModeLabel()}</div>
            )}
          </button>
        </div>

        <div className="sidebar-menu-item">
          <button
            onClick={onLogout}
            className="menu-link w-full text-left text-red-600 dark:text-red-400"
          >
            <div className="menu-link-icon">
              <FaSignOutAlt />
            </div>
            <span className="menu-link-text">Déconnexion</span>
            {isCollapsed && <div className="menu-tooltip">Déconnexion</div>}
          </button>
        </div>
      </div>
    </aside>
  );
}

// Menu mobile hamburger (pour paramètres/déconnexion uniquement)
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
  const [animate, setAnimate] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  const ANIMATION_DELAY = 200;
  const CLOSING_DELAY = 400;

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      setTimeout(() => setAnimate(true), ANIMATION_DELAY);
    } else if (shouldRender) {
      setIsClosing(true);
      setAnimate(false);
      setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, CLOSING_DELAY);
    }
  }, [isOpen, shouldRender]);

  const handleLogout = () => {
    setAnimate(false);
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      if (typeof onLogout === "function") {
        onLogout();
      }
    }, ANIMATION_DELAY);
  };

  const handleOverlayClick = () => {
    setAnimate(false);
    setIsClosing(true);
    setTimeout(onClose, ANIMATION_DELAY);
  };

  if (!shouldRender) return null;

  return (
    <>
      <div
        className={`mobile-menu-overlay ${isOpen && !isClosing ? "open" : ""}`}
        onClick={handleOverlayClick}
      />

      <div
        className={`mobile-menu-container ${isOpen && !isClosing ? "open" : ""
          } ${isClosing ? "closing" : ""}`}
      >
        <div
          className={`menu-header ${animate ? "animate" : ""
            } p-6 border-b border-white/20`}
        >
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="mobile-header-logo-3d">
                <img
                  src="/images/logo.png"
                  alt="Logo BodyForce"
                  className="h-12 w-auto"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              </div>
              <h1 className="text-lg font-bold text-white">BODY FORCE</h1>
            </div>
            <button
              onClick={handleOverlayClick}
              className={`close-button ${animate ? "animate" : ""
                } text-white hover:text-gray-200 transition-colors p-2 hover:bg-white/10 rounded-lg`}
              aria-label="Fermer le menu"
            >
              <FaTimes className="text-xl" />
            </button>
          </div>
        </div>

        <div
          className={`user-profile ${animate ? "animate" : ""
            } p-6 border-b border-white/20`}
        >
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4">
            {user?.photo ? (
              <img
                src={user.photo}
                alt="Profil"
                className="w-10 h-10 rounded-full object-cover border-2 border-white"
              />
            ) : (
              <FaUserCircle className="text-2xl text-white" />
            )}

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

        <div className="p-6 space-y-3">
          <button
            onClick={toggleDarkMode}
            className={`menu-item ${animate ? "animate" : ""
              } flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 w-full text-left transition-all duration-200`}
          >
            <div className="text-xl text-gray-300">{getDarkModeIcon()}</div>
            <span className="font-medium">{getDarkModeLabel()}</span>
          </button>

          <button
            onClick={handleLogout}
            className={`menu-item ${animate ? "animate" : ""
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

// ✅ PARTIE 7/7 : COMPOSANT PRINCIPAL + APP

function AppRoutes() {
  const { user, role, setUser } = useAuth();
  const isAdmin = role === "admin";

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

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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

      <EnhancedSidebar
        user={user}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        toggleDarkMode={toggleDarkMode}
        getDarkModeIcon={getDarkModeIcon}
        getDarkModeLabel={getDarkModeLabel}
      />

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

      {/* Contenu principal */}
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
            <Routes>
              <Route path="/" element={<HomePage />} />

              {isAdmin && (
                <>
                  <Route path="/members" element={<MembersPage />} />
                  <Route path="/members/new" element={<MemberFormPage />} />
                  <Route path="/members/edit" element={<MemberFormPage />} />
                  <Route path="/planning" element={<PlanningPage />} />
                  <Route path="/payments" element={<PaymentsPage />} />
                  <Route path="/statistics" element={<StatisticsPage />} />
                  <Route path="/admin/users" element={<UserManagementPage />} />
                  <Route path="/invitations" element={<InvitationsPage />} />
                </>
              )}

              <Route path="/my-attendances" element={<MyAttendancesPage />} />
              <Route path="/profile" element={<UserProfilePage />} />
              <Route path="/messages" element={<MessagesPage />} />

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </div>
      </main>

      {/* Bottom Navigation Bar FIXED en bas (mobile uniquement) */}
      {isMobile && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
          <BottomNavigationBar isAdmin={isAdmin} currentPath={location.pathname} />
        </div>
      )}
    </div>
  );
}

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

  const handleInstallFromPrompt = () => {
    installApp();
    dismissInstallPrompt();
  };

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
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <LoginPage />}
        />
        <Route path="/invitation" element={<InvitationSignupPage />} />
        <Route path="/*" element={<AppRoutes />} />
      </Routes>

      <InstallPrompt
        show={showInstallPrompt && isInstallable && !isInstalled}
        onInstall={handleInstallFromPrompt}
        onDismiss={dismissInstallPrompt}
      />

      <PWAToast toast={toast} onClose={closeToast} />

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
      {/* Badge de version */}
      <div
        className="fixed bottom-3 right-3 z-50 px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg bg-gray-800 dark:bg-gray-700 text-gray-100 cursor-default"
        title={`Version de l'application : ${APP_VERSION}`}
      >
        v{APP_VERSION}
      </div>{/* Badge de version */}
      <div
        className="fixed bottom-3 right-3 z-50 px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg bg-gray-800 dark:bg-gray-700 text-gray-100 cursor-default"
        title={`Version de l'application : ${APP_VERSION}`}
      >
        v{APP_VERSION}
      </div>
    </Router>
  );
}

export default App;