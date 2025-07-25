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

import HomePage from "./pages/HomePage";
import MembersPage from "./pages/MembersPage";
import PlanningPage from "./pages/PlanningPage";
import PaymentsPage from "./pages/PaymentsPage";
import StatisticsPage from "./pages/StatisticsPage";
import UserManagementPage from "./pages/UserManagementPage";
import ProfilePage from "./pages/ProfilePage";
import MemberForm from "./components/MemberForm";

// Configuration des pages pour la navigation swipe
const SWIPE_PAGES = [
  { name: "Accueil", path: "/", icon: <FaHome className="text-red-500 dark:text-red-400" />, component: "HomePage" },
  { name: "Membres", path: "/members", icon: <FaUserFriends className="text-green-500 dark:text-green-400" />, component: "MembersPage" },
  { name: "Planning", path: "/planning", icon: <FaCalendarAlt className="text-yellow-500 dark:text-yellow-400" />, component: "PlanningPage" },
  { name: "Paiements", path: "/payments", icon: <FaCreditCard className="text-purple-500 dark:text-purple-400" />, component: "PaymentsPage" },
  { name: "Statistiques", path: "/statistics", icon: <FaChartBar className="text-blue-500 dark:text-blue-400" />, component: "StatisticsPage" },
];

// Hook pour la gestion du mode sombre - VERSION CORRIGÉE
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

  /* ===== STYLES SIDEBAR DESKTOP AMÉLIORÉE ===== */
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

/* ✅ Nouvelle largeur optimisée */
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
  z-index: 9999;
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
  transform: rotate(180deg);
}

.enhanced-sidebar.collapsed .sidebar-toggle {
  right: -12px;
}

.enhanced-sidebar.collapsed .sidebar-toggle .toggle-icon {
  transform: rotate(0deg);
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

 /* ✅ Masquer complètement le titre */
.enhanced-sidebar.collapsed .sidebar-title {
  display: none !important;
}

  .sidebar-user-info {
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    opacity: 1;
    transform: translateX(0);
  }

  /* ✅ Masquer complètement les infos utilisateur */
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

/* ✅ Centrer les liens du menu */
.enhanced-sidebar.collapsed .menu-link {
  padding: 12px 8px !important;
  justify-content: center !important;
}

/* ✅ Masquer complètement le texte */
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

 /* ✅ Masquer les séparateurs */
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
    /* overflow: hidden;  <-- LA LIGNE FAUTIVE A ÉTÉ SUPPRIMÉE ICI */
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

/* ANIMATION 3D LOGO - ROTATION ÉLÉGANTE */
.sidebar-logo-3d {
  perspective: 1000px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sidebar-logo-3d img {
  transform-style: preserve-3d;
  animation: rotate3DElegant 8s linear infinite;
  filter: drop-shadow(0 10px 20px rgba(0,0,0,0.3));
  transition: animation-play-state 0.3s ease;
  border-radius: 15px;
}

.sidebar-logo-3d:hover img {
  animation-play-state: paused;
}

.enhanced-sidebar.collapsed .sidebar-logo-3d img {
  animation-duration: 6s;
}

.dark .sidebar-logo-3d img {
  filter: drop-shadow(0 10px 20px rgba(0,0,0,0.5));
}

@keyframes rotate3DElegant {
  0% { transform: rotateY(0deg) rotateX(0deg); }
  25% { transform: rotateY(90deg) rotateX(5deg); }
  50% { transform: rotateY(180deg) rotateX(0deg); }
  75% { transform: rotateY(270deg) rotateX(-5deg); }
  100% { transform: rotateY(360deg) rotateX(0deg); }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-logo-3d img {
    animation: none;
    transform: none;
    filter: drop-shadow(0 5px 15px rgba(0,0,0,0.2));
  }
}

@media (max-width: 1024px) {
  .sidebar-logo-3d {
    perspective: 800px;
  }
  
  .sidebar-logo-3d img {
    animation-duration: 10s;
  }
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

  return {
    isInstallable,
    isInstalled,
    installApp,
    toast,
    closeToast
  };
}

// Composant pour l'aperçu de la page suivante/précédente
function SwipePreview({ direction, swipeOffset, currentPageIndex }) {
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

// Composant indicateur de résistance
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

// Composant indicateur de pages
function PageIndicator({ currentIndex, totalPages, isMobile }) {
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

// Composant flèches de navigation
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
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Connexion</h2>
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

// ===== SIDEBAR DESKTOP AMÉLIORÉE =====
function EnhancedSidebar({ user, onLogout, toggleDarkMode, getDarkModeIcon, getDarkModeLabel }) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const menu = [
    { name: "Accueil", path: "/", icon: <FaHome className="text-red-500 dark:text-red-400" /> },
    {
      name: "Membres",
      path: "/members",
      icon: <FaUserFriends className="text-green-500 dark:text-green-400" />,
    },
    {
      name: "Planning",
      path: "/planning",
      icon: <FaCalendarAlt className="text-yellow-500 dark:text-yellow-400" />,
    },
    {
      name: "Paiements",
      path: "/payments",
      icon: <FaCreditCard className="text-purple-500 dark:text-purple-400" />,
    },
    {
      name: "Statistiques",
      path: "/statistics",
      icon: <FaChartBar className="text-blue-500 dark:text-blue-400" />,
    },
  ];

  const isAdmin =
    user?.user_metadata?.role === "admin" ||
    user?.email === "admin@bodyforce.com" ||
    user?.app_metadata?.role === "admin";

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
        {/* ✅ Nouveau JSX avec icônes inversées */}
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
        <FaUserCircle className="text-xl text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="font-medium truncate">{user?.email}</span>
          {isAdmin && (
            <span className="text-xs text-purple-600 dark:text-purple-400 font-bold">Admin</span>
          )}
        </div>
      </div>

      <div className="sidebar-divider"></div>

      {/* Menu principal */}
      <ul className="w-full space-y-2 px-4 flex-1">
        {menu.map((item, index) => (
          <li key={item.path} className={`sidebar-menu-item sidebar-item-enter ${location.pathname === item.path ? 'active' : ''}`} style={{ animationDelay: `${index * 0.1}s` }}>
            <Link
              to={item.path}
              className="menu-link"
            >
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

        {/* Menu admin */}
        {isAdmin && (
          <li className={`sidebar-menu-item sidebar-item-enter ${location.pathname === "/admin/users" ? 'active' : ''}`} style={{ animationDelay: `${menu.length * 0.1}s` }}>
            <Link
              to="/admin/users"
              className="menu-link"
            >
              <div className="menu-link-icon">
                <FaUserCircle className="text-purple-500 dark:text-purple-400" />
              </div>
              <span className="menu-link-text">Utilisateurs</span>
              {isCollapsed && (
                <div className="menu-tooltip">
                  Utilisateurs
                </div>
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
            <span className="menu-link-text">{isCollapsed ? '' : getDarkModeLabel()}</span>
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
              <div className="menu-tooltip">
                Déconnexion
              </div>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

// Composant pour le menu mobile animé
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

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      setIsOpening(true);
      const openTimer = setTimeout(() => {
        setIsOpening(false);
      }, 10);
      const animateTimer = setTimeout(() => setAnimate(true), 200);
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
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender]);

  const handleItemClick = () => {
    setAnimate(false);
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  const handleLogout = () => {
    setAnimate(false);
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      if (typeof onLogout === "function") {
        onLogout();
      }
    }, 200);
  };

  const handleOverlayClick = () => {
    setAnimate(false);
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  const handleCloseClick = () => {
    setAnimate(false);
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  const handleDarkModeToggle = () => {
    toggleDarkMode();
  };

  if (!shouldRender) return null;

  return (
    <>
      <style>{mobileMenuStyles}</style>

      <div
        className={`mobile-menu-overlay ${isOpen && !isClosing ? "open" : ""}`}
        onClick={handleOverlayClick}
      />

      <div
        className={`mobile-menu-container ${!isOpening && isOpen && !isClosing ? "open" : ""
          } ${isClosing ? "closing" : ""}`}
      >
        <div
          className={`menu-header ${animate ? "animate" : ""
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
              onClick={handleCloseClick}
              className={`close-button ${animate ? "animate" : ""
                } text-white hover:text-gray-200 transition-colors p-2 hover:bg-white/10 rounded-lg`}
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

        <div className="p-6 space-y-3">
          <Link
            to="/"
            onClick={handleItemClick}
            className={`menu-item ${animate ? "animate" : ""
              } flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${location.pathname === "/" ? "bg-white/20" : ""
              }`}
          >
            <FaHome className="text-xl text-red-300" />
            <span className="font-medium">Accueil</span>
          </Link>

          <Link
            to="/members"
            onClick={handleItemClick}
            className={`menu-item ${animate ? "animate" : ""
              } flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${location.pathname === "/members" ? "bg-white/20" : ""
              }`}
          >
            <FaUserFriends className="text-xl text-green-300" />
            <span className="font-medium">Membres</span>
          </Link>

          <Link
            to="/planning"
            onClick={handleItemClick}
            className={`menu-item ${animate ? "animate" : ""
              } flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${location.pathname === "/planning" ? "bg-white/20" : ""
              }`}
          >
            <FaCalendarAlt className="text-xl text-yellow-300" />
            <span className="font-medium">Planning</span>
          </Link>

          <Link
            to="/payments"
            onClick={handleItemClick}
            className={`menu-item ${animate ? "animate" : ""
              } flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${location.pathname === "/payments" ? "bg-white/20" : ""
              }`}
          >
            <FaCreditCard className="text-xl text-purple-300" />
            <span className="font-medium">Paiements</span>
          </Link>

          <Link
            to="/statistics"
            onClick={handleItemClick}
            className={`menu-item ${animate ? "animate" : ""
              } flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${location.pathname === "/statistics" ? "bg-white/20" : ""
              }`}
          >
            <FaChartBar className="text-xl text-blue-300" />
            <span className="font-medium">Statistiques</span>
          </Link>

          {isAdmin && (
            <Link
              to="/admin/users"
              onClick={handleItemClick}
              className={`menu-item ${animate ? "animate" : ""
                } flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 transition-all duration-200 ${location.pathname === "/admin/users" ? "bg-white/20" : ""
                }`}
            >
              <FaUserCircle className="text-xl text-purple-300" />
              <span className="font-medium">Utilisateurs</span>
            </Link>
          )}

          <button
            onClick={handleDarkModeToggle}
            className={`menu-item ${animate ? "animate" : ""
              } flex items-center gap-4 text-white hover:bg-white/10 rounded-xl p-4 w-full text-left transition-all duration-200`}
          >
            <div className="text-xl text-gray-300">
              {getDarkModeIcon()}
            </div>
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

// ============== COMPOSANT CORRIGÉ CI-DESSOUS ==============
function AppRoutes({ user, setUser }) {
  const [editingMember, setEditingMember] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Hook PWA
  const { isInstallable, isInstalled, installApp, toast, closeToast } = usePWA();

  // Hook Dark Mode
  const { darkMode, actualDarkMode, toggleDarkMode, getDarkModeIcon, getDarkModeLabel } = useDarkMode();

  // Hook Swipe Navigation avec animation
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

  // Détecter mobile et afficher hint au premier chargement
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      // Montrer le hint seulement sur mobile et au premier chargement
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

  // Désactiver le swipe quand le menu mobile est ouvert
  useEffect(() => {
    setIsSwipeEnabled(!mobileMenuOpen && !showForm);
  }, [mobileMenuOpen, showForm, setIsSwipeEnabled]);

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
    <div className="flex flex-col lg:flex-row h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-200 overflow-hidden">
      <style>{mobileMenuStyles}</style>

      {/* Header mobile */}
      <div className="lg:hidden p-4 bg-white dark:bg-gray-800 shadow-md flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <img
            src="/images/logo.png"
            alt="Logo BodyForce"
            className="h-8 w-auto"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
          <h1 className="text-lg font-bold text-red-600 dark:text-red-400">BODY FORCE</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDarkMode}
            className="text-xl text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title={getDarkModeLabel()}
          >
            {getDarkModeIcon()}
          </button>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="text-2xl text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <FaBars />
          </button>
        </div>
      </div>

      {/* Sidebar desktop améliorée */}
      <EnhancedSidebar
        user={user}
        onLogout={handleLogout}
        toggleDarkMode={toggleDarkMode}
        getDarkModeIcon={getDarkModeIcon}
        getDarkModeLabel={getDarkModeLabel}
      />

      {/* Menu mobile animé */}
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

      {/* Bouton d'installation PWA */}
      {isInstallable && !isInstalled && (
        <button
          onClick={installApp}
          className="pwa-install-button"
          title="Installer Body Force"
        >
          <FaDownload />
          <span className="hidden sm:inline">Installer l'app</span>
        </button>
      )}

      {/* Toast PWA */}
      <PWAToast toast={toast} onClose={closeToast} />

      {/* Indicateur de pages (mobile uniquement) */}
      <PageIndicator
        currentIndex={getCurrentPageIndex()}
        totalPages={totalPages}
        isMobile={isMobile}
      />

      {/* Flèches de navigation swipe (mobile uniquement) */}
      <SwipeNavigationArrows
        onNavigate={navigateToPage}
        isMobile={isMobile}
      />

      {/* Hint de swipe */}
      <SwipeHint show={showSwipeHint} />

      {/* Main content avec support du swipe et animation */}
      <main
        className={`flex-1 p-4 overflow-y-auto ${isMobile ? 'swipe-container' : ''}`}
        onTouchStart={isMobile ? onTouchStart : undefined}
        onTouchMove={isMobile ? onTouchMove : undefined}
        onTouchEnd={isMobile ? onTouchEnd : undefined}
      >
        {/* Contenu principal avec transformation */}
        <div
          className={`swipe-content ${isSwipping ? 'swiping' : ''}`}
          style={{
            transform: isMobile && swipeOffset !== 0
              ? `translateX(${swipeOffset}px)`
              : 'translateX(0)',
          }}
        >
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
        </div>

        {/* Aperçu de la page suivante/précédente */}
        {isMobile && (
          <SwipePreview
            direction={swipeDirection}
            swipeOffset={swipeOffset}
            currentPageIndex={getCurrentPageIndex()}
          />
        )}

        {/* Indicateur de résistance */}
        {isMobile && (
          <SwipeResistanceIndicator
            swipeOffset={swipeOffset}
            direction={swipeDirection}
          />
        )}

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
// ============== FIN DU COMPOSANT CORRIGÉ ==============


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
          path="/*"
          element={<AppRoutes user={user} setUser={setUser} />}
        />
      </Routes>
    </Router>
  );
}

export default App;