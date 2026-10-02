// Navigation de l'application : barre du bas (mobile), barre latérale (desktop), menu mobile — extrait de App.js

import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  FaHome,
  FaUser,
  FaUserFriends,
  FaUsersCog,
  FaUserPlus,
  FaChartBar,
  FaCalendarAlt,
  FaTimes,
  FaUserCircle,
  FaSignOutAlt,
  FaCreditCard,
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
  FaClipboardList,
  FaPaperPlane,
  FaComments,
  FaEllipsisH,
  FaFilePdf,
} from "react-icons/fa";

/**
 * Retourne les onglets de la barre de navigation mobile selon le role.
 * Admin : Accueil, Membres, Planning, Paiements, Plus
 * Membre : Accueil, Messages, Presences, Profil
 */
export const getBottomNavTabs = (isAdmin) => {
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
export const getMoreMenuItems = () => [
  { id: "statistics", name: "Statistiques", path: "/statistics", icon: FaChartBar, color: "text-blue-500" },
  { id: "reports", name: "Rapports PDF", path: "/reports", icon: FaFilePdf, color: "text-red-500" },
  { id: "emails", name: "Emails", path: "/emails", icon: FaPaperPlane, color: "text-emerald-500" },
  { id: "messages", name: "Messages", path: "/messages", icon: FaComments, color: "text-sky-500" },
  { id: "invitations", name: "Invitations", path: "/invitations", icon: FaUserPlus, color: "text-orange-500" },
];

/**
 * Retourne les liens de navigation (sidebar desktop + menu mobile).
 * Factorise la liste dupliquee entre EnhancedSidebar et AnimatedMobileMenu.
 * @param {boolean} isDesktop - true pour la sidebar PC : ajoute les entrees
 *                              reservees au desktop (ex. Gestion des utilisateurs).
 */
export const getMenuItems = (isAdmin, isDesktop = false) => [
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
        // Reserve au desktop : absent du menu mobile
        ...(isDesktop
          ? [{ path: "/admin/users", icon: FaUsersCog, label: "Utilisateurs" }]
          : []),
      ]
    : [
        { path: "/messages", icon: FaComments, label: "Messages" },
        { path: "/my-attendances", icon: FaClipboardList, label: "Mes présences" },
        { path: "/profile", icon: FaUser, label: "Mon profil" },
      ]),
];

/** Barre de navigation fixee en bas sur mobile avec menu "Plus" pour admin */
export function BottomNavigationBar({ isAdmin, currentPath }) {
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

      {/* Menu "Plus" (overflow) — Glassmorphism style */}
      {showMoreMenu && (
        <div className="fixed bottom-24 left-0 right-0 z-50 mx-4 mb-2">
          <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/30 dark:border-gray-700/40 overflow-hidden">
            <div className="p-2">
              {moreMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleMoreItemClick(item)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive(item.path)
                        ? "bg-blue-500/15 dark:bg-blue-400/15"
                        : "hover:bg-gray-500/10 dark:hover:bg-gray-400/10"
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

      {/* Barre d'onglets — Floating pill iOS-style */}
      <nav className="mx-4 mb-3 rounded-full bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/20 dark:border-gray-700/40 shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="flex justify-around items-center h-16 px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.isMore ? showMoreMenu : isActive(tab.path);

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className="flex items-center justify-center flex-1 h-full py-2 transition-all"
              >
                <div
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300 ${
                    active
                      ? "bg-blue-500/15 dark:bg-blue-400/15"
                      : ""
                  }`}
                >
                  <Icon
                    className={`text-xl transition-colors duration-300 ${
                      active ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
                    }`}
                  />
                  {active && !tab.isMore && (
                    <span
                      className="text-sm font-semibold text-blue-600 dark:text-blue-400 transition-all duration-300"
                    >
                      {tab.name}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/** Sidebar retractable pour la navigation desktop */
export function EnhancedSidebar({
  user,
  isAdmin,
  onLogout,
  toggleDarkMode,
  getDarkModeIcon,
  getDarkModeLabel,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const menuItems = getMenuItems(isAdmin, true); // true = sidebar PC (inclut Utilisateurs)

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

/** Menu lateral anime (slide-in) pour mobile */
export function AnimatedMobileMenu({
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
