// src/App.js
import React, { useState, useEffect, Suspense, lazy } from "react";
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
} from "react-icons/fa";
import { supabase } from "./supabaseClient";

// Lazy load pages for better performance
const HomePage = lazy(() => import("./pages/HomePage"));
const MembersPage = lazy(() => import("./pages/MembersPage"));
const PlanningPage = lazy(() => import("./pages/PlanningPage"));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage"));
const StatisticsPage = lazy(() => import("./pages/StatisticsPage"));
const UserManagementPage = lazy(() => import("./pages/UserManagementPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const MemberForm = lazy(() => import("./components/MemberForm"));

// Configuration des pages pour la navigation swipe
const SWIPE_PAGES = [
  { name: "Accueil", path: "/", icon: <FaHome className="text-red-500 dark:text-red-400" />, component: "HomePage" },
  { name: "Membres", path: "/members", icon: <FaUserFriends className="text-green-500 dark:text-green-400" />, component: "MembersPage" },
  { name: "Planning", path: "/planning", icon: <FaCalendarAlt className="text-yellow-500 dark:text-yellow-400" />, component: "PlanningPage" },
  { name: "Paiements", path: "/payments", icon: <FaCreditCard className="text-purple-500 dark:text-purple-400" />, component: "PaymentsPage" },
  { name: "Statistiques", path: "/statistics", icon: <FaChartBar className="text-blue-500 dark:text-blue-400" />, component: "StatisticsPage" },
];

// Hook pour la gestion du mode sombre
function useDarkMode() {
  const [darkMode, setDarkMode] = useState('auto');
  const [actualDarkMode, setActualDarkMode] = useState(false);

  // Fonction pour vérifier si c'est la nuit (19h-7h)
  const isNightTime = () => {
    const hour = new Date().getHours();
    return hour >= 19 || hour < 7;
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

    console.log(`🎨 Mode appliqué: ${isDark ? 'Sombre' : 'Clair'}`, {
      classList: Array.from(htmlElement.classList),
      darkMode,
      actualDarkMode: isDark
    });
  };

  // Charger les préférences au démarrage
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode') || 'auto';
    const newActualMode = determineActualMode(savedMode);

    console.log('🚀 Initialisation mode sombre:', { savedMode, newActualMode });

    setDarkMode(savedMode);
    setActualDarkMode(newActualMode);
    applyTheme(newActualMode);
  }, []);

  // Mettre à jour le thème quand le mode change
  useEffect(() => {
    const newActualMode = determineActualMode(darkMode);
    setActualDarkMode(newActualMode);
    applyTheme(newActualMode);

    console.log('🔄 Changement de mode:', { darkMode, newActualMode });
  }, [darkMode]);

  // Timer pour le mode automatique
  useEffect(() => {
    if (darkMode === 'auto') {
      const interval = setInterval(() => {
        const shouldBeDark = isNightTime();
        if (shouldBeDark !== actualDarkMode) {
          console.log('⏰ Basculement automatique:', { shouldBeDark, actualDarkMode });
          setActualDarkMode(shouldBeDark);
          applyTheme(shouldBeDark);
        }
      }, 60000); // Vérifier chaque minute

      return () => clearInterval(interval);
    }
  }, [darkMode, actualDarkMode]);

  const toggleDarkMode = () => {
    const modes = ['auto', 'light', 'dark'];
    const currentIndex = modes.indexOf(darkMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];

    console.log('👆 Toggle mode:', { current: darkMode, next: nextMode });

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

// Hook personnalisé pour la navigation par swipe avec animation
function useSwipeNavigation() {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isSwipeEnabled, setIsSwipeEnabled] = useState(true);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipping, setIsSwipping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Distance minimum pour déclencher un swipe (en pixels)
  const minSwipeDistance = 100;
  // Distance maximum pour l'effet de résistance
  const maxSwipeDistance = 200;

  const getCurrentPageIndex = () => {
    return SWIPE_PAGES.findIndex(page => page.path === location.pathname);
  };

  const navigateToPage = (direction) => {
    const currentIndex = getCurrentPageIndex();
    if (currentIndex === -1) return;

    let newIndex;
    if (direction === 'left') {
      // Swipe gauche = page suivante
      newIndex = currentIndex + 1;
      if (newIndex >= SWIPE_PAGES.length) newIndex = 0; // Boucle au début
    } else {
      // Swipe droite = page précédente
      newIndex = currentIndex - 1;
      if (newIndex < 0) newIndex = SWIPE_PAGES.length - 1; // Boucle à la fin
    }

    // Animation de sortie puis navigation
    setIsSwipping(true);
    setSwipeOffset(direction === 'left' ? -window.innerWidth : window.innerWidth);

    setTimeout(() => {
      navigate(SWIPE_PAGES[newIndex].path);
      // Reset après navigation
      setTimeout(() => {
        setSwipeOffset(0);
        setIsSwipping(false);
        setSwipeDirection(null);
      }, 50);
    }, 200);
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

    // Déterminer la direction
    const direction = distance > 0 ? 'right' : 'left';
    setSwipeDirection(direction);

    // Appliquer une résistance progressive
    let offset = distance;
    const absDistance = Math.abs(distance);

    if (absDistance > maxSwipeDistance) {
      // Résistance exponentielle au-delà de maxSwipeDistance
      const excess = absDistance - maxSwipeDistance;
      const resistance = Math.log(excess / 50 + 1) * 50;
      offset = distance > 0 ? maxSwipeDistance + resistance : -maxSwipeDistance - resistance;
    }

    setSwipeOffset(offset);
    setTouchEnd(currentTouch);
  };

  const onTouchEnd = () => {
    if (!isSwipeEnabled || !touchStart || !touchEnd) {
      // Reset si pas de swipe valide
      setSwipeOffset(0);
      setIsSwipping(false);
      setSwipeDirection(null);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      navigateToPage('left');
    } else if (isRightSwipe) {
      navigateToPage('right');
    } else {
      // Retour à la position initiale avec animation
      setSwipeOffset(0);
      setTimeout(() => {
        setIsSwipping(false);
        setSwipeDirection(null);
      }, 200);
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
    swipeDirection
  };
}

// Styles CSS pour les animations, swipe et mode sombre + Sidebar améliorée
const mobileMenuStyles = `
  .mobile-menu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0);
    z-index: 40;
    transition: background-color 0.4s ease-out;
    pointer-events: none;
  }
  
  .mobile-menu-overlay.open {
    background-color: rgba(0, 0, 0, 0.6);
    pointer-events: auto;
  }
  
  .dark .mobile-menu-overlay.open {
    background-color: rgba(0, 0, 0, 0.8);
  }
  
  .mobile-menu-container {
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    width: 320px;
    max-width: 85vw;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: -15px 0 30px rgba(0, 0, 0, 0.2);
    z-index: 50;
    transform: translateX(100%);
    transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    overflow-y: auto;
    border-radius: 20px 0 0 20px;
  }
  
  .dark .mobile-menu-container {
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    box-shadow: -15px 0 30px rgba(0, 0, 0, 0.5);
  }
  
  .mobile-menu-container.open {
    transform: translateX(0);
  }
  
  .mobile-menu-container.closing {
    transform: translateX(100%);
    transition: transform 0.4s cubic-bezier(0.55, 0.085, 0.68, 0.53);
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
  .menu-item:nth-child(8) { transition-delay: 0.45s; }
  
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

  /* STYLES SIDEBAR DESKTOP AMÉLIORÉE */
  .enhanced-sidebar {
    background: linear-gradient(180deg, 
      rgba(255, 255, 255, 0.95) 0%, 
      rgba(249, 250, 251, 0.95) 100%
    );
    backdrop-filter: blur(20px);
    border-right: 1px solid rgba(229, 231, 235, 0.8);
    box-shadow: 0 0 30px rgba(0, 0, 0, 0.05);
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    position: relative;
    overflow: hidden;
  }

  .dark .enhanced-sidebar {
    background: linear-gradient(180deg, 
      rgba(31, 41, 55, 0.95) 0%, 
      rgba(17, 24, 39, 0.95) 100%
    );
    border-right: 1px solid rgba(75, 85, 99, 0.3);
    box-shadow: 0 0 30px rgba(0, 0, 0, 0.2);
  }

.enhanced-sidebar.collapsed {
  width: 64px !important;
}

.enhanced-sidebar.expanded {
  width: 280px !important;
}

.sidebar-toggle {
  position: fixed;
  top: 50vh;
  right: -12px;
  transform: translateY(-50%);
  width: 24px;
  height: 48px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border: none;
  border-radius: 0 12px 12px 0;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  z-index: 9999; /* Ensure high z-index for visibility */
}

.enhanced-sidebar .sidebar-toggle {
  display: flex !important;
  visibility: visible !important;
  pointer-events: auto !important;
}

.dark .sidebar-toggle {
  background: linear-gradient(135deg, #1e40af, #7c3aed);
  box-shadow: 0 4px 15px rgba(30, 64, 175, 0.4);
}

.sidebar-toggle:hover {
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

.sidebar-toggle .toggle-icon {
  transition: transform 0.3s ease;
  transform: rotate(0deg);
}

.enhanced-sidebar.collapsed .sidebar-toggle {
  right: -12px;
}

.enhanced-sidebar.collapsed .sidebar-toggle .toggle-icon {
  transform: rotate(180deg);
}

  .sidebar-logo {
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    transform-origin: center;
  }

.enhanced-sidebar.collapsed .sidebar-logo {
  padding: 8px 4px !important;
}

.enhanced-sidebar.collapsed .sidebar-logo img {
  height: 32px !important;
  width: 32px !important;
}

  .sidebar-title {
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    opacity: 1;
    transform: translateX(0);
  }

.enhanced-sidebar.collapsed .sidebar-title {
  display: none !important;
}

  .sidebar-user-info {
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    opacity: 1;
    transform: translateX(0);
  }

.enhanced-sidebar.collapsed .sidebar-user-info {
  display: none !important;
}

  .sidebar-menu-item {
    position: relative;
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    border-radius: 12px;
    margin: 4px 0;
    overflow: hidden;
  }

  .sidebar-menu-item::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, 
      rgba(59, 130, 246, 0.1) 0%, 
      rgba(139, 92, 246, 0.1) 100%
    );
    opacity: 0;
    transition: opacity 0.3s ease;
    border-radius: 12px;
  }

  .sidebar-menu-item:hover::before {
    opacity: 1;
  }

  .sidebar-menu-item.active::before {
    opacity: 1;
    background: linear-gradient(135deg, 
      rgba(59, 130, 246, 0.2) 0%, 
      rgba(139, 92, 246, 0.2) 100%
    );
  }

  .dark .sidebar-menu-item::before {
    background: linear-gradient(135deg, 
      rgba(96, 165, 250, 0.1) 0%, 
      rgba(167, 139, 250, 0.1) 100%
    );
  }

  .dark .sidebar-menu-item.active::before {
    background: linear-gradient(135deg, 
      rgba(96, 165, 250, 0.2) 0%, 
      rgba(167, 139, 250, 0.2) 100%
    );
  }

  .sidebar-menu-item .menu-link {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 12px;
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    text-decoration: none;
  }

.enhanced-sidebar.collapsed .sidebar-menu-item .menu-link {
  justify-content: center;
  padding: 12px 8px;
}

  .menu-link-icon {
    font-size: 20px;
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    min-width: 20px;
  }

  .sidebar-menu-item:hover .menu-link-icon {
    transform: scale(1.1);
  }

  .sidebar-menu-item.active .menu-link-icon {
    transform: scale(1.15);
    filter: drop-shadow(0 0 8px currentColor);
  }

  .menu-link-text {
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    opacity: 1;
    transform: translateX(0);
    font-weight: 500;
    color: #374151;
  }

  .dark .menu-link-text {
    color: #d1d5db;
  }

.enhanced-sidebar.collapsed .menu-link {
  padding: 12px 8px !important;
  justify-content: center !important;
}

.enhanced-sidebar.collapsed .menu-link-text {
  display: none !important;
}

  .menu-tooltip {
    position: absolute;
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    margin-left: 8px;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 14px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    z-index: 1000;
  }

  .dark .menu-tooltip {
    background: rgba(255, 255, 255, 0.9);
    color: #111827;
  }

  .enhanced-sidebar.collapsed .sidebar-menu-item:hover .menu-tooltip {
    opacity: 1;
    transform: translateY(-50%) translateX(4px);
  }

  .menu-tooltip::before {
    content: '';
    position: absolute;
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    border: 6px solid transparent;
    border-right-color: rgba(0, 0, 0, 0.9);
  }

  .dark .menu-tooltip::before {
    border-right-color: rgba(255, 255, 255, 0.9);
  }

  .sidebar-divider {
    height: 1px;
    background: linear-gradient(90deg, 
      transparent 0%, 
      rgba(229, 231, 235, 0.5) 20%, 
      rgba(229, 231, 235, 0.8) 50%, 
      rgba(229, 231, 235, 0.5) 80%, 
      transparent 100%
    );
    margin: 16px 0;
    transition: all 0.4s ease;
  }

  .dark .sidebar-divider {
    background: linear-gradient(90deg, 
      transparent 0%, 
      rgba(75, 85, 99, 0.3) 20%, 
      rgba(75, 85, 99, 0.6) 50%, 
      rgba(75, 85, 99, 0.3) 80%, 
      transparent 100%
    );
  }

.enhanced-sidebar.collapsed .sidebar-divider {
  display: none !important;
}

  .sidebar-footer {
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    margin-top: auto;
    padding-top: 16px;
  }

  .enhanced-sidebar.collapsed .sidebar-footer {
    padding-top: 8px;
  }

  /* Animation d'entrée pour les éléments du menu */
  .sidebar-menu-item {
    animation: slideInFromLeft 0.5s ease-out forwards;
  }

  .sidebar-menu-item:nth-child(1) { animation-delay: 0.1s; }
  .sidebar-menu-item:nth-child(2) { animation-delay: 0.15s; }
  .sidebar-menu-item:nth-child(3) { animation-delay: 0.2s; }
  .sidebar-menu-item:nth-child(4) { animation-delay: 0.25s; }
  .sidebar-menu-item:nth-child(5) { animation-delay: 0.3s; }
  .sidebar-menu-item:nth-child(6) { animation-delay: 0.35s; }
  .sidebar-menu-item:nth-child(7) { animation-delay: 0.4s; }

  @keyframes slideInFromLeft {
    from {
      opacity: 0;
      transform: translateX(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* Effet de survol avancé */
  .sidebar-menu-item:hover {
    transform: translateX(4px);
  }

  .enhanced-sidebar.collapsed .sidebar-menu-item:hover {
    transform: translateX(0) scale(1.05);
  }

  /* Indicateur actif */
  .sidebar-menu-item.active::after {
    content: '';
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 70%;
    background: linear-gradient(180deg, #3b82f6, #8b5cf6);
    border-radius: 2px 0 0 2px;
    transition: all 0.3s ease;
  }

  .enhanced-sidebar.collapsed .sidebar-menu-item.active::after {
    right: 8px;
    width: 3px;
    height: 50%;
    border-radius: 2px;
  }

  /* Styles PWA */
  .pwa-install-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 50px;
    padding: 15px 20px;
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
    cursor: pointer;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    font-size: 14px;
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    animation: pulse-install 2s infinite;
  }

  .dark .pwa-install-button {
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
  }

  .pwa-install-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 35px rgba(102, 126, 234, 0.4);
  }

  .dark .pwa-install-button:hover {
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.6);
  }

  @keyframes pulse-install {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  .pwa-toast {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    padding: 20px;
    z-index: 1001;
    max-width: 350px;
    border-left: 4px solid;
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    transform: translateX(400px);
  }

  .dark .pwa-toast {
    background: #1f2937;
    color: white;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  }

  .pwa-toast.show {
    transform: translateX(0);
  }

  .pwa-toast.success {
    border-left-color: #10b981;
  }

  .pwa-toast.error {
    border-left-color: #ef4444;
  }

  .pwa-toast-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .pwa-toast-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: white;
  }

  .pwa-toast-icon.success {
    background-color: #10b981;
  }

  .pwa-toast-icon.error {
    background-color: #ef4444;
  }

  .pwa-toast-title {
    font-weight: 600;
    color: #1f2937;
    font-size: 16px;
  }

  .dark .pwa-toast-title {
    color: #f9fafb;
  }

  .pwa-toast-message {
    color: #6b7280;
    font-size: 14px;
    line-height: 1.4;
  }

  .dark .pwa-toast-message {
    color: #d1d5db;
  }

  /* Styles pour la navigation swipe */
  .swipe-container {
    touch-action: pan-y;
    user-select: none;
    position: relative;
    overflow: hidden;
  }

  .swipe-content {
    transition: transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    will-change: transform;
  }

  .swipe-content.swiping {
    transition: none;
  }

  .swipe-preview {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 1;
    background: rgba(0, 0, 0, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .dark .swipe-preview {
    background: rgba(255, 255, 255, 0.05);
  }

  .swipe-preview.active {
    opacity: 1;
  }

  .swipe-preview-content {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    gap: 12px;
    transform: scale(0.9);
    transition: transform 0.2s ease;
  }

  .dark .swipe-preview-content {
    background: rgba(31, 41, 55, 0.95);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .swipe-preview.active .swipe-preview-content {
    transform: scale(1);
  }

  .swipe-preview-icon {
    font-size: 24px;
  }

  .swipe-preview-text {
    font-weight: 600;
    color: #1f2937;
    font-size: 16px;
  }

  .dark .swipe-preview-text {
    color: #f9fafb;
  }

  .swipe-resistance-indicator {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
    border-radius: 2px;
    opacity: 0;
    transition: opacity 0.2s ease;
    z-index: 2;
  }

  .dark .swipe-resistance-indicator {
    background: linear-gradient(to bottom, #60a5fa, #a78bfa);
  }

  .swipe-resistance-indicator.left {
    right: 10px;
  }

  .swipe-resistance-indicator.right {
    left: 10px;
  }

  .swipe-resistance-indicator.active {
    opacity: 0.7;
  }

  .swipe-hint {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    z-index: 1000;
    animation: swipe-hint-pulse 2s infinite;
    pointer-events: none;
  }

  .dark .swipe-hint {
    background: rgba(255, 255, 255, 0.9);
    color: #1f2937;
  }

  @keyframes swipe-hint-pulse {
    0%, 100% { opacity: 0.7; transform: translateX(-50%) scale(1); }
    50% { opacity: 1; transform: translateX(-50%) scale(1.05); }
  }

  .page-indicator {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    padding: 8px 16px;
    border-radius: 20px;
    z-index: 1000;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }

  .dark .page-indicator {
    background: rgba(31, 41, 55, 0.9);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  }

  .page-indicator-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #d1d5db;
    transition: all 0.3s ease;
  }

  .dark .page-indicator-dot {
    background: #6b7280;
  }

  .page-indicator-dot.active {
    background: #3b82f6;
    transform: scale(1.2);
  }

  .dark .page-indicator-dot.active {
    background: #60a5fa;
  }

  .swipe-navigation-arrows {
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1000;
    pointer-events: none;
  }

  .swipe-arrow {
    position: absolute;
    background: rgba(59, 130, 246, 0.9);
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
  }

  .dark .swipe-arrow {
    background: rgba(96, 165, 250, 0.9);
    box-shadow: 0 4px 15px rgba(96, 165, 250, 0.3);
  }

  .swipe-arrow:hover {
    background: rgba(59, 130, 246, 1);
    transform: scale(1.1);
  }

  .dark .swipe-arrow:hover {
    background: rgba(96, 165, 250, 1);
  }

  .swipe-arrow.left {
    left: 10px;
  }

  .swipe-arrow.right {
    right: 10px;
  }

  @media (max-width: 640px) {
    .pwa-install-button {
      bottom: 80px;
      right: 15px;
      padding: 12px 16px;
      font-size: 13px;
    }
    .pwa-toast {
      right: 15px;
      left: 15px;
      max-width: none;
    }
    .page-indicator {
      bottom: 60px;
    }
    .swipe-hint {
      bottom: 120px;
    }
  }

  /* Animations additionnelles pour la sidebar */
  .sidebar-item-enter {
    animation: slideInFade 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  }

  @keyframes slideInFade {
    from {
      opacity: 0;
      transform: translateX(-30px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
  }

  .sidebar-logo-pulse {
    animation: logoPulse 3s ease-in-out infinite;
  }

  @keyframes logoPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.02); }
  }
`;

// Composant Toast PWA
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

// Hook PWA
function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
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

  return { isInstallable, isInstalled, installApp, toast, closeToast };
}

// Composant pour l'aperçu de la page suivante/précédente
function SwipePreview({ direction, swipeOffset, currentPageIndex }) {
  if (!direction || Math.abs(swipeOffset) < 50) return null;

  const nextPageIndex = direction === 'right' ? (currentPageIndex - 1 + SWIPE_PAGES.length) % SWIPE_PAGES.length : (currentPageIndex + 1) % SWIPE_PAGES.length;
  const nextPage = SWIPE_PAGES[nextPageIndex];
  const opacity = Math.min(Math.abs(swipeOffset) / 150, 1);

  return (
    <div className={`swipe-preview ${Math.abs(swipeOffset) > 50 ? 'active' : ''}`} style={{ opacity }} >
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

// Composant indicateur de résistance
function SwipeResistanceIndicator({ swipeOffset, direction }) {
  if (!direction || Math.abs(swipeOffset) < 100) return null;

  const resistance = Math.min((Math.abs(swipeOffset) - 100) / 100, 1);
  const height = `${resistance * 80}%`;

  return (
    <div className={`swipe-resistance-indicator ${direction} ${resistance > 0 ? 'active' : ''}`} style={{ height }} />
  );
}

// Composant indicateur de pages
function PageIndicator({ currentIndex, totalPages, isMobile }) {
  if (!isMobile) return null;

  return (
    <div className="page-indicator">
      {SWIPE_PAGES.map((_, index) => (
        <div key={index} className={`page-indicator-dot ${index === currentIndex ? 'active' : ''}`} />
      ))}
    </div>
  );
}

// Composant flèches de navigation
function SwipeNavigationArrows({ onNavigate, isMobile }) {
  if (!isMobile) return null;

  return (
    <div className="swipe-navigation-arrows">
      <button className="swipe-arrow left" onClick={() => onNavigate('right')} aria-label="Page précédente" >
        <FaChevronLeft />
      </button>
      <button className="swipe-arrow right" onClick={() => onNavigate('left')} aria-label="Page suivante" >
        <FaChevronRight />
      </button>
    </div>
  );
}

// Composant hint de swipe
function SwipeHint({ show }) {
  if (!show) return null;
  return (
    <div className="swipe-hint">
      ← Glissez pour naviguer →
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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password, });
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
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 w-full max-w-md border border-gray-200 dark:border-gray-700">
        <div className="text-center mb-6">
          <img src="/images/logo.png" alt="Logo BodyForce" className="h-24 w-auto mx-auto mb-4" onError={(e) => { e.target.style.display = "none"; }} />
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2"> CLUB BODY FORCE </h1>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Connexion</h2>
        </div>
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"> Email </label>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"> Mot de passe </label>
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
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 px-4 rounded-lg hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition duration-200 ease-in-out font-semibold flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading && (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            Connexion
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(
    () => localStorage.getItem('isSidebarExpanded') === 'true'
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isInstallable, isInstalled, installApp, toast, closeToast } = usePWA();
  const {
    darkMode,
    actualDarkMode,
    toggleDarkMode,
    getDarkModeIcon,
    getDarkModeLabel,
  } = useDarkMode();

  const isMobile = window.innerWidth <= 768; // Adjust breakpoint as needed

  // Custom hook for swipe navigation
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
    swipeDirection
  } = useSwipeNavigation();

  const location = useLocation();
  const navigate = useNavigate();

  const currentPageName = SWIPE_PAGES.find(
    (page) => page.path === location.pathname
  )?.name;

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

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Erreur déconnexion:", error.message);
      } else {
        setUser(null);
        navigate("/login");
      }
    } catch (error) {
      console.error("Erreur déconnexion inattendue:", error);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarExpanded((prev) => {
      const newState = !prev;
      localStorage.setItem('isSidebarExpanded', newState);
      return newState;
    });
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const renderPage = (Component) => {
    // Dynamically import the component based on its name
    const PageComponent = lazy(() => import(`./pages/${Component}`));
    return (
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Chargement de la page...</p>
          </div>
        </div>
      }>
        <PageComponent user={user} />
      </Suspense>
    );
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
      <style>{mobileMenuStyles}</style> {/* Inject global styles */}
      {user ? (
        <div className={`main-layout-container flex flex-1 h-screen overflow-hidden ${isSidebarExpanded ? '' : 'collapsed-sidebar'}`}>
          {/* Desktop Sidebar */}
          {!isMobile && (
            <aside className={`enhanced-sidebar flex flex-col p-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-lg relative z-30
              ${isSidebarExpanded ? 'expanded' : 'collapsed'}`}>
              <div className={`sidebar-logo flex ${isSidebarExpanded ? 'justify-start px-2' : 'justify-center px-0'} items-center mb-6`}>
                <img src="/images/logo.png" alt="Logo" className={`h-10 w-10 ${isSidebarExpanded ? '' : 'mx-auto'} sidebar-logo-pulse`} />
                <h1 className={`text-xl font-bold ml-3 text-blue-600 dark:text-blue-400 whitespace-nowrap overflow-hidden sidebar-title ${isSidebarExpanded ? '' : 'hidden'}`}>
                  Body Force
                </h1>
              </div>

              <div className={`sidebar-user-info flex items-center ${isSidebarExpanded ? 'px-2' : 'justify-center'} py-4 mb-6 border-b border-gray-200 dark:border-gray-700 transition-all duration-300`}>
                <FaUserCircle className="text-gray-500 dark:text-gray-400 text-3xl flex-shrink-0" />
                <div className={`ml-3 overflow-hidden whitespace-nowrap sidebar-user-info ${isSidebarExpanded ? '' : 'hidden'}`}>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{user.email}</p>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Membre</span>
                </div>
              </div>

              <nav className="flex-1">
                {SWIPE_PAGES.map((page, index) => (
                  <div key={index} className={`sidebar-menu-item ${location.pathname === page.path ? 'active' : ''}`}>
                    <Link to={page.path} className="menu-link text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                      <span className="menu-link-icon">{page.icon}</span>
                      <span className="menu-link-text">{page.name}</span>
                      {!isSidebarExpanded && <span className="menu-tooltip">{page.name}</span>}
                    </Link>
                  </div>
                ))}
                <div className="sidebar-divider"></div>
                <div className="sidebar-menu-item">
                  <Link to="/profile" className="menu-link text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                    <span className="menu-link-icon"><FaUserCircle /></span>
                    <span className="menu-link-text">Mon Profil</span>
                    {!isSidebarExpanded && <span className="menu-tooltip">Mon Profil</span>}
                  </Link>
                </div>
                {user.user_metadata.role === 'admin' && (
                  <div className="sidebar-menu-item">
                    <Link to="/users" className="menu-link text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                      <span className="menu-link-icon"><FaUserFriends /></span>
                      <span className="menu-link-text">Gestion Utilisateurs</span>
                      {!isSidebarExpanded && <span className="menu-tooltip">Gestion Utilisateurs</span>}
                    </Link>
                  </div>
                )}
              </nav>

              <div className="sidebar-footer pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-col items-center">
                <button
                  onClick={toggleDarkMode}
                  className="w-full flex items-center justify-center p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 mb-2"
                >
                  <span className="mr-2">{getDarkModeIcon()}</span>
                  {isSidebarExpanded && <span>{getDarkModeLabel()}</span>}
                  {!isSidebarExpanded && <span className="menu-tooltip">{getDarkModeLabel()}</span>}
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 transition-colors duration-200"
                >
                  <span className="mr-2"><FaSignOutAlt /></span>
                  {isSidebarExpanded && <span>Déconnexion</span>}
                  {!isSidebarExpanded && <span className="menu-tooltip">Déconnexion</span>}
                </button>
              </div>

              {/* Sidebar toggle button - Now fixed and visible */}
              <button
                className="sidebar-toggle"
                onClick={toggleSidebar}
                aria-label={isSidebarExpanded ? "Réduire la sidebar" : "Étendre la sidebar"}
              >
                <FaAngleDoubleLeft className={`toggle-icon ${isSidebarExpanded ? '' : 'rotate-180'}`} />
              </button>
            </aside>
          )}

          {/* Main content area */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header for both desktop (collapsed) and mobile */}
            <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex items-center justify-between z-20 sticky top-0">
              {isMobile ? (
                <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-600 dark:text-gray-300 text-2xl">
                  <FaBars />
                </button>
              ) : (
                <div className="flex items-center">
                  <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                    {currentPageName || "Tableau de bord"}
                  </h1>
                </div>
              )}
              <div className="flex items-center space-x-4">
                {isInstallable && !isInstalled && (
                  <button
                    onClick={installApp}
                    className="pwa-install-button hidden md:flex" // Hide on mobile, show on desktop
                  >
                    <FaDownload />
                    <span>Installer l'application</span>
                  </button>
                )}
                <div className="relative">
                  <button onClick={toggleDarkMode} className="text-gray-600 dark:text-gray-300 text-xl p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                    {getDarkModeIcon()}
                  </button>
                </div>
                {/* User dropdown - simplified for brevity */}
              </div>
            </header>

            {/* Mobile Menu */}
            {isMobile && (
              <>
                <div
                  className={`mobile-menu-overlay ${isMobileMenuOpen ? 'open' : ''}`}
                  onClick={closeMobileMenu}
                ></div>
                <div className={`mobile-menu-container ${isMobileMenuOpen ? 'open' : 'closing'}`}>
                  <div className="p-6 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-8 menu-header animate">
                      <h2 className="text-2xl font-bold text-white">Menu</h2>
                      <button onClick={closeMobileMenu} className="text-white text-2xl close-button animate">
                        <FaTimes />
                      </button>
                    </div>
                    <div className="flex items-center mb-8 text-white user-profile animate">
                      <FaUserCircle className="text-4xl" />
                      <div className="ml-4">
                        <p className="font-semibold text-lg">{user.email}</p>
                        <span className="text-sm opacity-80">Membre</span>
                      </div>
                    </div>
                    <nav className="flex-1">
                      {SWIPE_PAGES.map((page, index) => (
                        <Link
                          key={index}
                          to={page.path}
                          className={`flex items-center p-4 text-white text-lg rounded-lg mb-3 hover:bg-white hover:bg-opacity-20 transition-colors menu-item animate`}
                          onClick={closeMobileMenu}
                          style={{ transitionDelay: `${0.1 + index * 0.05}s` }}
                        >
                          <span className="mr-4">{page.icon}</span>
                          {page.name}
                        </Link>
                      ))}
                      <Link
                        to="/profile"
                        className={`flex items-center p-4 text-white text-lg rounded-lg mb-3 hover:bg-white hover:bg-opacity-20 transition-colors menu-item animate`}
                        onClick={closeMobileMenu}
                        style={{ transitionDelay: `${0.1 + SWIPE_PAGES.length * 0.05}s` }}
                      >
                        <span className="mr-4"><FaUserCircle /></span>
                        Mon Profil
                      </Link>
                      {user.user_metadata.role === 'admin' && (
                        <Link
                          to="/users"
                          className={`flex items-center p-4 text-white text-lg rounded-lg mb-3 hover:bg-white hover:bg-opacity-20 transition-colors menu-item animate`}
                          onClick={closeMobileMenu}
                          style={{ transitionDelay: `${0.1 + (SWIPE_PAGES.length + 1) * 0.05}s` }}
                        >
                          <span className="mr-4"><FaUserFriends /></span>
                          Gestion Utilisateurs
                        </Link>
                      )}
                    </nav>
                    <div className="mt-auto pt-6 border-t border-white border-opacity-20">
                      <button
                        onClick={() => { toggleDarkMode(); closeMobileMenu(); }}
                        className="flex items-center p-4 text-white text-lg rounded-lg mb-3 hover:bg-white hover:bg-opacity-20 transition-colors w-full text-left menu-item animate"
                        style={{ transitionDelay: `${0.1 + (SWIPE_PAGES.length + (user.user_metadata.role === 'admin' ? 2 : 1)) * 0.05}s` }}
                      >
                        <span className="mr-4">{getDarkModeIcon()}</span>
                        {getDarkModeLabel()}
                      </button>
                      <button
                        onClick={() => { handleLogout(); closeMobileMenu(); }}
                        className="flex items-center p-4 text-white text-lg rounded-lg hover:bg-white hover:bg-opacity-20 transition-colors w-full text-left menu-item animate"
                        style={{ transitionDelay: `${0.1 + (SWIPE_PAGES.length + (user.user_metadata.role === 'admin' ? 3 : 2)) * 0.05}s` }}
                      >
                        <span className="mr-4"><FaSignOutAlt /></span>
                        Déconnexion
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Main content with swipe functionality */}
            <div
              className="flex-1 relative overflow-hidden" // Ensure container for swipe is relative
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div
                className={`swipe-content flex flex-col min-h-full transition-transform duration-200 ${isSwipping ? 'swiping' : ''}`}
                style={{ transform: `translateX(${swipeOffset}px)` }}
              >
                <Routes>
                  <Route path="/" element={renderPage('HomePage')} />
                  <Route path="/members" element={renderPage('MembersPage')} />
                  <Route path="/planning" element={renderPage('PlanningPage')} />
                  <Route path="/payments" element={renderPage('PaymentsPage')} />
                  <Route path="/statistics" element={renderPage('StatisticsPage')} />
                  <Route path="/profile" element={renderPage('ProfilePage')} />
                  {user.user_metadata.role === 'admin' && (
                    <>
                      <Route path="/users" element={renderPage('UserManagementPage')} />
                      <Route path="/members/new" element={renderPage('MemberForm')} />
                      <Route path="/members/edit/:id" element={renderPage('MemberForm')} />
                    </>
                  )}
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </div>

              {/* Swipe Preview and Resistance Indicator rendered outside the swipe-content but within the swipe-container's flow */}
              <SwipePreview
                direction={swipeDirection}
                swipeOffset={swipeOffset}
                currentPageIndex={getCurrentPageIndex()}
              />
              <SwipeResistanceIndicator
                swipeOffset={swipeOffset}
                direction={swipeDirection}
              />
            </div>

            {isMobile && <PageIndicator currentIndex={getCurrentPageIndex()} totalPages={totalPages} isMobile={isMobile} />}
            {isMobile && <SwipeNavigationArrows onNavigate={navigateToPage} isMobile={isMobile} />}
            {isMobile && SWIPE_PAGES.some(page => page.path === location.pathname) && (
              <SwipeHint show={!isSwipping && Math.abs(swipeOffset) < 10 && !isMobileMenuOpen} />
            )}
          </div>
          <PWAToast toast={toast} onClose={closeToast} />
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      )}
    </Router>
  );
}

export default App;