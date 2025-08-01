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
  FaClipboardList, // Nouvel icône pour les présences
} from "react-icons/fa";
import { supabase } from "./supabaseClient";
import { useAuth } from "./contexts/AuthContext";

// 🔄 Ajout récupération photo de profil (si disponible)
const fetchUserPhoto = async (userId) => {
  const { data, error } = await supabase
    .from("members")
    .select("photo")
    .eq("email", userId)
    .single();

  return error ? null : data?.photo || null;
};

// Import des pages
import HomePage from "./pages/HomePage";
import MembersPage from "./pages/MembersPage";
import PlanningPage from "./pages/PlanningPage";
import PaymentsPage from "./pages/PaymentsPage";
import StatisticsPage from "./pages/StatisticsPage";
import UserManagementPage from "./pages/UserManagementPage";
//import ProfilePage from "./pages/ProfilePage";
import MemberForm from "./components/MemberForm";
import UserProfilePage from "./pages/UserProfilePage";
import MyAttendancesPage from "./pages/MyAttendancesPage"; // ✅ Import de la nouvelle page
import InvitationsPage from "./pages/InvitationsPage";
import InvitationSignupPage from "./pages/InvitationSignupPage";

// Import des styles et notifications
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

// Configuration des pages pour la navigation swipe - DYNAMIQUE selon le rôle
const getSwipePages = (isAdmin) => {
  const basePage = [
    {
      name: "Accueil",
      path: "/",
      icon: <FaHome className="text-red-500 dark:text-red-400" />,
      component: "HomePage"
    }
  ];

  if (isAdmin) {
    return [
      ...basePage,
      {
        name: "Membres",
        path: "/members",
        icon: <FaUserFriends className="text-green-500 dark:text-green-400" />,
        component: "MembersPage"
      },
      //{
      //  name: "Invitations", // ✅ NOUVELLE PAGE
      //  path: "/invitations",
      //  icon: <FaUserPlus className="text-orange-500 dark:text-orange-400" />,
      //  component: "InvitationsPage"
      //},
      {
        name: "Planning",
        path: "/planning",
        icon: <FaCalendarAlt className="text-yellow-500 dark:text-yellow-400" />,
        component: "PlanningPage"
      },
      {
        name: "Paiements",
        path: "/payments",
        icon: <FaCreditCard className="text-purple-500 dark:text-purple-400" />,
        component: "PaymentsPage"
      },
      {
        name: "Statistiques",
        path: "/statistics",
        icon: <FaChartBar className="text-blue-500 dark:text-blue-400" />,
        component: "StatisticsPage"
      },
    ];
  } else {
    // Partie utilisateur reste identique
    return [
      ...basePage,
      {
        name: "Mes Présences",
        path: "/my-attendances",
        icon: <FaClipboardList className="text-green-500 dark:text-green-400" />,
        component: "MyAttendancesPage"
      },
      {
        name: "Mon Profil",
        path: "/profile",
        icon: <FaUser className="text-blue-500 dark:text-blue-400" />,
        component: "UserProfilePage"
      }
    ];
  }
};

// ===== HOOK POUR LA GESTION DU MODE SOMBRE =====
function useDarkMode() {
  const [darkMode, setDarkMode] = useState('auto');
  const [actualDarkMode, setActualDarkMode] = useState(false);

  // ✅ Constantes pour les heures de basculement
  const NIGHT_START_HOUR = 19;
  const NIGHT_END_HOUR = 7;
  const AUTO_CHECK_INTERVAL = 60000; // 1 minute

  // Fonction pour vérifier si c'est la nuit
  const isNightTime = () => {
    const hour = new Date().getHours();
    return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
  };

  // Fonction pour déterminer le mode sombre actuel
  const determineActualMode = (mode) => {
    switch (mode) {
      case 'dark':
        return true;
      case 'light':
        return false;
      case 'auto':
      default:
        return isNightTime();
    }
  };

  // Fonction pour appliquer le thème au DOM
  const applyTheme = (isDark) => {
    const htmlElement = document.documentElement;

    if (isDark) {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }

    // ✅ Console log uniquement en développement
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎨 Mode appliqué: ${isDark ? 'Sombre' : 'Clair'}`, {
        classList: Array.from(htmlElement.classList),
        darkMode,
        actualDarkMode: isDark
      });
    }
  };

  // Charger les préférences au démarrage
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode') || 'auto';
    const newActualMode = determineActualMode(savedMode);

    setDarkMode(savedMode);
    setActualDarkMode(newActualMode);
    applyTheme(newActualMode);
  }, []);

  // Mettre à jour le thème quand le mode change
  useEffect(() => {
    const newActualMode = determineActualMode(darkMode);
    setActualDarkMode(newActualMode);
    applyTheme(newActualMode);
  }, [darkMode]);

  // Timer pour le mode automatique
  useEffect(() => {
    if (darkMode === 'auto') {
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
    const modes = ['auto', 'light', 'dark'];
    const currentIndex = modes.indexOf(darkMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];

    setDarkMode(nextMode);
    localStorage.setItem('darkMode', nextMode);
  };

  const getDarkModeIcon = () => {
    switch (darkMode) {
      case 'light':
        return <FaSun className="w-5 h-5" />;
      case 'dark':
        return <FaMoon className="w-5 h-5" />;
      case 'auto':
      default:
        return <FaAdjust className="w-5 h-5" />;
    }
  };

  const getDarkModeLabel = () => {
    switch (darkMode) {
      case 'light':
        return 'Mode clair';
      case 'dark':
        return 'Mode sombre';
      case 'auto':
      default:
        return `Mode auto ${actualDarkMode ? '🌙' : '☀️'}`;
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

// ===== HOOK POUR LA NAVIGATION PAR SWIPE =====
function useSwipeNavigation(isAdmin) {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isSwipeEnabled, setIsSwipeEnabled] = useState(true);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipping, setIsSwipping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Constantes pour le swipe
  const MIN_SWIPE_DISTANCE = 100;
  const MAX_SWIPE_DISTANCE = 200;
  const SWIPE_ANIMATION_DELAY = 200;
  const SWIPE_RESET_DELAY = 50;

  // Utilise les pages dynamiques selon le rôle
  const SWIPE_PAGES = getSwipePages(isAdmin);

  const getCurrentPageIndex = () => {
    return SWIPE_PAGES.findIndex(page => page.path === location.pathname);
  };

  const navigateToPage = (direction) => {
    const currentIndex = getCurrentPageIndex();
    if (currentIndex === -1) return;

    let newIndex;
    if (direction === 'left') {
      newIndex = currentIndex + 1;
      if (newIndex >= SWIPE_PAGES.length) newIndex = 0;
    } else {
      newIndex = currentIndex - 1;
      if (newIndex < 0) newIndex = SWIPE_PAGES.length - 1;
    }

    // Animation de sortie puis navigation
    setIsSwipping(true);
    setSwipeOffset(direction === 'left' ? -window.innerWidth : window.innerWidth);

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
    const direction = distance > 0 ? 'right' : 'left';

    setSwipeDirection(direction);

    // Appliquer une résistance progressive
    let offset = distance;
    const absDistance = Math.abs(distance);

    if (absDistance > MAX_SWIPE_DISTANCE) {
      const excess = absDistance - MAX_SWIPE_DISTANCE;
      const resistance = Math.log(excess / 50 + 1) * 50;
      offset = distance > 0 ? MAX_SWIPE_DISTANCE + resistance : -MAX_SWIPE_DISTANCE - resistance;
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
      navigateToPage('left');
    } else if (isRightSwipe) {
      navigateToPage('right');
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
    SWIPE_PAGES
  };
}

// ===== HOOK PWA =====
function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    // Vérifier si l'app est déjà installée
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      showToast('success', 'Application installée !', 'Body Force a été ajouté à votre écran d\'accueil.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const showToast = (type, title, message) => {
    setToast({ type, title, message });
  };

  const installApp = async () => {
    if (!deferredPrompt) return;

    try {
      const result = await deferredPrompt.prompt();

      if (result.outcome === 'accepted') {
        showToast('success', 'Installation en cours...', 'Body Force va être ajouté à votre écran d\'accueil.');
      } else {
        showToast('error', 'Installation annulée', 'Vous pouvez toujours installer l\'application plus tard.');
      }

      setDeferredPrompt(null);
      setIsInstallable(false);
    } catch (error) {
      console.error('Erreur lors de l\'installation PWA:', error);
      showToast('error', 'Erreur d\'installation', 'Une erreur s\'est produite lors de l\'installation.');
    }
  };

  const closeToast = () => {
    setToast(null);
  };

  return {
    isInstallable,
    isInstalled,
    installApp,
    toast,
    closeToast
  };
}

// ===== COMPOSANT TOAST PWA =====
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
    <div className={`pwa-toast ${toast.type} ${show ? 'show' : ''}`}>
      <div className="pwa-toast-header">
        <div className={`pwa-toast-icon ${toast.type}`}>
          {toast.type === 'success' ? <FaCheck /> : <FaTimesIcon />}
        </div>
        <div className="pwa-toast-title">{toast.title}</div>
      </div>
      <div className="pwa-toast-message">{toast.message}</div>
    </div>
  );
}

// ===== COMPOSANTS DE NAVIGATION SWIPE =====
function SwipePreview({ direction, swipeOffset, currentPageIndex, SWIPE_PAGES }) {
  if (!direction || Math.abs(swipeOffset) < 50) return null;

  const nextPageIndex = direction === 'right'
    ? (currentPageIndex - 1 + SWIPE_PAGES.length) % SWIPE_PAGES.length
    : (currentPageIndex + 1) % SWIPE_PAGES.length;

  const nextPage = SWIPE_PAGES[nextPageIndex];
  const opacity = Math.min(Math.abs(swipeOffset) / 150, 1);

  return (
    <div
      className={`swipe-preview ${Math.abs(swipeOffset) > 50 ? 'active' : ''}`}
      style={{ opacity }}
    >
      <div className="swipe-preview-content">
        <div className="swipe-preview-icon">
          {nextPage.icon}
        </div>
        <div className="swipe-preview-text">
          {nextPage.name}
        </div>
      </div>
    </div>
  );
}

function SwipeResistanceIndicator({ swipeOffset, direction }) {
  if (!direction || Math.abs(swipeOffset) < 100) return null;

  const resistance = Math.min((Math.abs(swipeOffset) - 100) / 100, 1);
  const height = `${resistance * 80}%`;

  return (
    <div
      className={`swipe-resistance-indicator ${direction} ${resistance > 0 ? 'active' : ''}`}
      style={{ height }}
    />
  );
}

function PageIndicator({ currentIndex, totalPages, isMobile, SWIPE_PAGES }) {
  if (!isMobile) return null;

  return (
    <div className="page-indicator">
      {SWIPE_PAGES.map((_, index) => (
        <div
          key={index}
          className={`page-indicator-dot ${index === currentIndex ? 'active' : ''}`}
        />
      ))}
    </div>
  );
}

function SwipeNavigationArrows({ onNavigate, isMobile }) {
  if (!isMobile) return null;

  return (
    <div className="swipe-navigation-arrows">
      <button
        className="swipe-arrow left"
        onClick={() => onNavigate('right')}
        aria-label="Page précédente"
      >
        <FaChevronLeft />
      </button>
      <button
        className="swipe-arrow right"
        onClick={() => onNavigate('left')}
        aria-label="Page suivante"
      >
        <FaChevronRight />
      </button>
    </div>
  );
}

function SwipeHint({ show }) {
  if (!show) return null;

  return (
    <div className="swipe-hint">
      ← Glissez pour naviguer →
    </div>
  );
}

// ===== PAGE DE CONNEXION =====
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

// ===== SIDEBAR DESKTOP =====
function EnhancedSidebar({ user, isAdmin, onLogout, toggleDarkMode, getDarkModeIcon, getDarkModeLabel }) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  // Menu conditionnel selon le rôle
  const menu = [
    {
      name: "Accueil",
      path: "/",
      icon: <FaHome className="text-red-500 dark:text-red-400" />
    },
    ...(isAdmin ? [
      {
        name: "Membres",
        path: "/members",
        icon: <FaUserFriends className="text-green-500 dark:text-green-400" />
      },
      {
        name: "Planning",
        path: "/planning",
        icon: <FaCalendarAlt className="text-yellow-500 dark:text-yellow-400" />
      },
      {
        name: "Paiements",
        path: "/payments",
        icon: <FaCreditCard className="text-purple-500 dark:text-purple-400" />
      },
      {
        name: "Statistiques",
        path: "/statistics",
        icon: <FaChartBar className="text-blue-500 dark:text-blue-400" />
      },
      {
        name: "Invitations",
        path: "/invitations",
        icon: <FaUserPlus className="text-orange-500 dark:text-orange-400" />
      },
    ] : [
      {
        name: "Mes Présences", // ✅ Nouveau menu pour les utilisateurs
        path: "/my-attendances",
        icon: <FaClipboardList className="text-green-500 dark:text-green-400" />
      },
      {
        name: "Mon Profil",
        path: "/profile",
        icon: <FaUser className="text-blue-500 dark:text-blue-400" />
      },
    ])
  ];

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', newState.toString());
  };

  return (
    <aside className={`enhanced-sidebar ${isCollapsed ? 'collapsed' : 'expanded'} flex-col items-center hidden lg:flex transition-all duration-400 ease-out`}>
      {/* Bouton toggle */}
      <button
        className="sidebar-toggle"
        onClick={toggleSidebar}
        aria-label={isCollapsed ? "Étendre le menu" : "Réduire le menu"}
      >
        <div className="toggle-icon">
          <FaAngleDoubleRight />
        </div>
      </button>

      {/* En-tête avec logo et titre */}
      <div className="sidebar-logo sidebar-logo-3d text-center p-4 pb-2">
        <h1 className={`sidebar-title text-center text-lg font-bold text-red-600 dark:text-red-400 mb-2 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
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

      {/* Informations utilisateur */}
      <div className={`sidebar-user-info mb-4 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 px-4 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
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
      </div>

      <div className="sidebar-divider"></div>

      {/* Menu principal */}
      <ul className="w-full space-y-2 px-4 flex-1">
        {menu.map((item, index) => (
          <li
            key={item.path}
            className={`sidebar-menu-item sidebar-item-enter ${location.pathname === item.path ? 'active' : ''}`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <Link to={item.path} className="menu-link">
              <div className="menu-link-icon">
                {item.icon}
              </div>
              <span className="menu-link-text">{item.name}</span>
              {isCollapsed && (
                <div className="menu-tooltip">
                  {item.name}
                </div>
              )}
            </Link>
          </li>
        ))}

        {/* Menu admin utilisateurs */}
        {isAdmin && (
          <li
            className={`sidebar-menu-item sidebar-item-enter ${location.pathname === "/admin/users" ? 'active' : ''}`}
            style={{ animationDelay: `${menu.length * 0.1}s` }}
          >
            <Link to="/admin/users" className="menu-link">
              <div className="menu-link-icon">
                <FaUserCircle className="text-purple-500 dark:text-purple-400" />
              </div>
              <span className="menu-link-text">Utilisateurs</span>
              {isCollapsed && (
                <div className="menu-tooltip">Utilisateurs</div>
              )}
            </Link>
          </li>
        )}
      </ul>

      <div className="sidebar-divider"></div>

      {/* Footer avec actions */}
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
              {isCollapsed ? '' : getDarkModeLabel()}
            </span>
            {isCollapsed && (
              <div className="menu-tooltip">
                {getDarkModeLabel()}
              </div>
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
            {isCollapsed && (
              <div className="menu-tooltip">Déconnexion</div>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

// ===== MENU MOBILE ANIMÉ =====
function AnimatedMobileMenu({
  isOpen,
  onClose,
  user,
  isAdmin,
  location,
  onLogout,
  toggleDarkMode,
  getDarkModeIcon,
  getDarkModeLabel,
}) {
  const [animate, setAnimate] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  // ✅ Constantes pour les animations
  const ANIMATION_DELAY = 200;
  const CLOSING_DELAY = 400;

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      setIsOpening(true);

      const openTimer = setTimeout(() => {
        setIsOpening(false);
      }, 10);

      const animateTimer = setTimeout(() => setAnimate(true), ANIMATION_DELAY);

      return () => {
        clearTimeout(openTimer);
        clearTimeout(animateTimer);
      };
    } else if (shouldRender) {
      setIsClosing(true);
      setAnimate(false);

      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
        setIsOpening(false);
      }, CLOSING_DELAY);

      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender]);

  // ✅ Handlers optimisés
  const handleItemClick = () => {
    setAnimate(false);
    setIsClosing(true);
    setTimeout(onClose, ANIMATION_DELAY);
  };

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

  const handleCloseClick = () => {
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
        className={`mobile-menu-container ${!isOpening && isOpen && !isClosing ? "open" : ""} ${isClosing ? "closing" : ""}`}
      >
        {/* Header */}
        <div className={`menu-header ${animate ? "animate" : ""} p-6 border-b border-white/20`}>
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
              onClick={handleCloseClick}
              className={`close-button ${animate ? "animate" : ""} text-white hover:text-gray-200 transition-colors p-2 hover:bg-white/10 rounded-lg`}
              aria-label="Fermer le menu"
            >
              <FaTimes className="text-xl" />
            </button>
          </div>
        </div>

        {/* User Profile */}
        <div className={`user-profile ${animate ? "animate" : ""} p-6 border-b border-white/20`}>
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

        {/* Navigation */}
        <div className="p-6 space-y-3">
          <Link
            to="/"
            onClick={handleItemClick}
            className={`menu-item ${animate ? "animate" : ""} flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${location.pathname === "/" ? "bg-white/20" : ""}`}
          >
            <FaHome className="text-xl text-red-300" />
            <span className="font-medium">Accueil</span>
          </Link>

          {/* Liens conditionnels pour admin */}
          {isAdmin && (
            <>
              <Link
                to="/members"
                onClick={handleItemClick}
                className={`menu-item ${animate ? "animate" : ""} flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${location.pathname === "/members" ? "bg-white/20" : ""}`}
              >
                <FaUserFriends className="text-xl text-green-300" />
                <span className="font-medium">Membres</span>
              </Link>

              <Link
                to="/invitations"
                onClick={handleItemClick}
                className={`menu-item ${animate ? "animate" : ""} flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${location.pathname === "/invitations" ? "bg-white/20" : ""}`}
              >
                <FaUserPlus className="text-xl text-orange-300" />
                <span className="font-medium">Invitations</span>
              </Link>

              <Link
                to="/planning"
                onClick={handleItemClick}
                className={`menu-item ${animate ? "animate" : ""} flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${location.pathname === "/planning" ? "bg-white/20" : ""}`}
              >
                <FaCalendarAlt className="text-xl text-yellow-300" />
                <span className="font-medium">Planning</span>
              </Link>

              <Link
                to="/payments"
                onClick={handleItemClick}
                className={`menu-item ${animate ? "animate" : ""} flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${location.pathname === "/payments" ? "bg-white/20" : ""}`}
              >
                <FaCreditCard className="text-xl text-purple-300" />
                <span className="font-medium">Paiements</span>
              </Link>

              <Link
                to="/statistics"
                onClick={handleItemClick}
                className={`menu-item ${animate ? "animate" : ""} flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${location.pathname === "/statistics" ? "bg-white/20" : ""}`}
              >
                <FaChartBar className="text-xl text-blue-300" />
                <span className="font-medium">Statistiques</span>
              </Link>

              <Link
                to="/admin/users"
                onClick={handleItemClick}
                className={`menu-item ${animate ? "animate" : ""} flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${location.pathname === "/admin/users" ? "bg-white/20" : ""}`}
              >
                <FaUserCircle className="text-xl text-purple-300" />
                <span className="font-medium">Utilisateurs</span>
              </Link>
            </>
          )}

          {/* Menu pour utilisateurs non-admin */}
          {!isAdmin && (
            <>
              <Link
                to="/my-attendances"
                onClick={handleItemClick}
                className={`menu-item ${animate ? "animate" : ""} flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${location.pathname === "/my-attendances" ? "bg-white/20" : ""}`}
              >
                <FaClipboardList className="text-xl text-green-300" />
                <span className="font-medium">Mes Présences</span>
              </Link>

              <Link
                to="/profile"
                onClick={handleItemClick}
                className={`menu-item ${animate ? "animate" : ""} flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${location.pathname === "/profile" ? "bg-white/20" : ""}`}
              >
                <FaUser className="text-xl text-blue-300" />
                <span className="font-medium">Mon Profil</span>
              </Link>
            </>
          )}

          {/* Actions */}
          <button
            onClick={toggleDarkMode}
            className={`menu-item ${animate ? "animate" : ""} flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 w-full text-left transition-all duration-200`}
          >
            <div className="text-xl text-gray-300">
              {getDarkModeIcon()}
            </div>
            <span className="font-medium">{getDarkModeLabel()}</span>
          </button>

          <button
            onClick={handleLogout}
            className={`menu-item ${animate ? "animate" : ""} flex items-center gap-4 text-red-300 hover:bg-red-500/20 rounded-xl p-4 w-full text-left transition-all duration-200`}
          >
            <FaSignOutAlt className="text-xl" />
            <span className="font-medium">Déconnexion</span>
          </button>
        </div>
      </div>
    </>
  );
}

// ===== COMPOSANT PRINCIPAL ROUTES =====
function AppRoutes() {
  const { user, role, setUser, userMemberData } = useAuth();
  const isAdmin = role === 'admin';

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

  // ✅ États locaux
  const [editingMember, setEditingMember] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Hooks personnalisés
  const { isInstallable, isInstalled, installApp, toast, closeToast } = usePWA();
  const { toggleDarkMode, getDarkModeIcon, getDarkModeLabel } = useDarkMode();
  const {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    getCurrentPageIndex,
    navigateToPage,
    isSwipeEnabled,
    setIsSwipeEnabled,
    totalPages,
    swipeOffset,
    isSwipping,
    swipeDirection,
    SWIPE_PAGES
  } = useSwipeNavigation(isAdmin);

  // ✅ Détection mobile et hint de swipe
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      // Afficher le hint seulement une fois
      if (mobile && !localStorage.getItem('swipe_hint_shown')) {
        setShowSwipeHint(true);
        setTimeout(() => {
          setShowSwipeHint(false);
          localStorage.setItem('swipe_hint_shown', 'true');
        }, 3000);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ✅ Désactiver le swipe selon l'état de l'UI
  useEffect(() => {
    setIsSwipeEnabled(!mobileMenuOpen && !showForm);
  }, [mobileMenuOpen, showForm, setIsSwipeEnabled]);

  // ✅ Handler de déconnexion
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      navigate("/login");
    } catch (error) {
      console.error("Erreur déconnexion:", error);
    }
  };

  // ✅ Handler pour l'édition des membres
  const handleEditMember = (member) => {
    setEditingMember(member);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingMember(null);
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

      {/* Menu mobile */}
      <AnimatedMobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        isAdmin={isAdmin}
        location={location}
        onLogout={handleLogout}
        toggleDarkMode={toggleDarkMode}
        getDarkModeIcon={getDarkModeIcon}
        getDarkModeLabel={getDarkModeLabel}
      />

      {/* Bouton installation PWA */}
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

      {/* Toast PWA */}
      <PWAToast toast={toast} onClose={closeToast} />

      {/* Indicateurs de navigation mobile */}
      <PageIndicator
        currentIndex={getCurrentPageIndex()}
        totalPages={totalPages}
        isMobile={isMobile}
        SWIPE_PAGES={SWIPE_PAGES}
      />

      <SwipeNavigationArrows
        onNavigate={navigateToPage}
        isMobile={isMobile}
      />

      <SwipeHint show={showSwipeHint} />

      {/* Contenu principal */}
      <main
        className={`flex-1 p-4 overflow-y-auto ${isMobile ? 'swipe-container' : ''}`}
        onTouchStart={isMobile ? onTouchStart : undefined}
        onTouchMove={isMobile ? onTouchMove : undefined}
        onTouchEnd={isMobile ? onTouchEnd : undefined}
      >
        {/* Contenu avec transformation swipe */}
        <div
          className={`swipe-content ${isSwipping ? 'swiping' : ''}`}
          style={{
            transform: isMobile && swipeOffset !== 0
              ? `translateX(${swipeOffset}px)`
              : 'translateX(0)',
          }}
        >
          {/* Routes conditionnelles selon le rôle */}
          <Routes>
            <Route path="/" element={<HomePage />} />

            {/* Routes réservées aux admins */}
            {isAdmin && (
              <>
                <Route
                  path="/members"
                  element={<MembersPage onEdit={handleEditMember} />}
                />
                <Route path="/planning" element={<PlanningPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/statistics" element={<StatisticsPage />} />
                <Route path="/admin/users" element={<UserManagementPage />} />
                <Route path="/invitations" element={<InvitationsPage />} />
              </>
            )}

            {/* Routes pour les utilisateurs non-admin */}
            {!isAdmin && (
              <Route path="/my-attendances" element={<MyAttendancesPage />} />
            )}

            {/* Route profil accessible à tous */}
            <Route path="/profile" element={<UserProfilePage />} />

            {/* Redirection par défaut */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>

        {/* Éléments d'interface swipe (mobile) */}
        {isMobile && (
          <>
            <SwipePreview
              direction={swipeDirection}
              swipeOffset={swipeOffset}
              currentPageIndex={getCurrentPageIndex()}
              SWIPE_PAGES={SWIPE_PAGES}
            />

            <SwipeResistanceIndicator
              swipeOffset={swipeOffset}
              direction={swipeDirection}
            />
          </>
        )}

        {/* Formulaire d'édition des membres */}
        {showForm && (
          <MemberForm
            member={editingMember}
            onSave={handleCloseForm}
            onCancel={handleCloseForm}
          />
        )}
      </main>
    </div>
  );
}

// ===== COMPOSANT PRINCIPAL APP =====
function App() {
  const { user, loading } = useAuth();

  // ✅ Écran de chargement
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
        <Route
          path="/invitation"
          element={<InvitationSignupPage />}
        />
        <Route path="/*" element={<AppRoutes />} />
      </Routes>
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
    </Router>
  );
}

export default App;