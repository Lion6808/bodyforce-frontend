// =============================================================================
// App.js — Point d'entree principal BodyForce
// =============================================================================
//
// Responsabilites :
//   - Routing (React Router) avec protection par authentification
//   - Layout responsive : sidebar desktop, bottom nav + menu mobile
//   - Theme dark/light/auto (hook useDarkMode)
//   - PWA : install prompt, toast, service worker
//   - Realtime : toast Supabase sur nouveau passage badge
//
// Sections :
//   1. Imports
//   2. Constants & Configuration
//   3. Composants et hooks extraits (voir liste)
//   4. AppRoutes (layout principal authentifie)
//   5. App (racine)
// =============================================================================

// =============================================================================
// SECTION 1 — Imports
// =============================================================================

import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { FaBars, FaDownload } from "react-icons/fa";
import { supabase } from "./supabaseClient";
import { useAuth } from "./contexts/AuthContext";

// Composant de header (léger, chargé immédiatement)
import NotificationBell from "./components/NotificationBell";
import { BottomNavigationBar, EnhancedSidebar, AnimatedMobileMenu } from "./components/layout/Navigation";
import { InstallPrompt, PWAToast } from "./components/layout/PwaBanners";
import { usePWA } from "./hooks/usePWA";
import { useDarkMode } from "./hooks/useDarkMode";
import { LoginPage } from "./components/auth/LoginPage";
import { fetchUserPhoto } from "./utils/userPhoto";

// Pages chargées à la demande (code splitting) — allège fortement le bundle initial.
// Chaque page ne se télécharge que lorsqu'on la visite.
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const MembersPage = lazy(() => import("./pages/MembersPage"));
const PlanningPage = lazy(() => import("./pages/PlanningPage"));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage"));
const StatisticsPage = lazy(() => import("./pages/StatisticsPage"));
const UserManagementPage = lazy(() => import("./pages/UserManagementPage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const MyAttendancesPage = lazy(() => import("./pages/MyAttendancesPage"));
const InvitationsPage = lazy(() => import("./pages/InvitationsPage"));
const InvitationSignupPage = lazy(() => import("./pages/InvitationSignupPage"));
const MemberFormPage = lazy(() => import("./pages/MemberFormPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const EmailPage = lazy(() => import("./pages/EmailPage"));
const WorkoutEndPage = lazy(() => import("./pages/WorkoutEndPage"));

// Styles & notifications
import { ToastContainer, toast as showToast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

// =============================================================================
// SECTION 2 — Constants & Configuration
// =============================================================================

/** Indicateur affiché pendant le chargement paresseux d'une page (Suspense). */
function PageFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );
}

const APP_VERSION = "2.10.0";

const CHANGELOG = {
  version: "2.10.0",
  date: "Octobre 2026",
  changes: [
    "Fiche membre complète aussi sur mobile et depuis Paiements (type de membre, présences, messages)",
    "Fiche membre adaptée au mobile : onglets visibles d'un coup, sans défilement horizontal",
    "Recherche : les jokers * et ? fonctionnent sur Membres et Paiements",
    "Réabonnement « Année civile » : valable jusqu'à la permanence de janvier suivante",
    "Statut actif / expiré calculé de la même façon sur toutes les pages",
    "Application réorganisée pour plus de fiabilité (sans changement visuel)",
  ],
};

// =============================================================================
// SECTION 3 — Composants et hooks extraits (refacto UI, 2026-10)
// =============================================================================
//   - hooks/useDarkMode.js, hooks/usePWA.js
//   - components/auth/LoginPage.jsx
//   - components/layout/Navigation.jsx (barre du bas, sidebar, menu mobile)
//   - components/layout/PwaBanners.jsx (InstallPrompt, PWAToast)
//
// Navigation par swipe RETIRÉE (v2.8) : le décalage horizontal appliqué pendant
// le geste se déclenchait aussi sur les scrolls verticaux (tremblement latéral).
// Les classes CSS .swipe-container / .swipe-content sont conservées.

// =============================================================================
// SECTION 4 — AppRoutes (layout principal authentifie)
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

  // Detection mobile (breakpoint 768px)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
            className="text-xl text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg inline-flex items-center justify-center min-w-[44px] min-h-[44px]"
            title={getDarkModeLabel()}
            aria-label={getDarkModeLabel()}
          >
            {getDarkModeIcon()}
          </button>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="text-2xl text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg inline-flex items-center justify-center min-w-[44px] min-h-[44px]"
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
        <div className={isMobile ? "swipe-container pb-20" : ""}>
          <div className="swipe-content">
            {/* Definitions des routes */}
            <Suspense fallback={<PageFallback />}>
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
              <Route path="/workout-end" element={<WorkoutEndPage />} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
            </Suspense>
          </div>
        </div>
      </main>

      {/* Bottom nav mobile — floating bar */}
      {isMobile && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
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
// SECTION 5 — App (composant racine)
// =============================================================================

/** Composant racine : routing de premier niveau, realtime toasts, PWA, version */
function App() {
  const { user, loading } = useAuth();
  const [showChangelog, setShowChangelog] = useState(false);

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
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/" /> : <LoginPage />}
          />
          <Route path="/invitation" element={<InvitationSignupPage />} />
          <Route path="/*" element={<AppRoutes />} />
        </Routes>
      </Suspense>

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
      <div className="fixed bottom-20 lg:bottom-3 right-3 z-40">
        {showChangelog && (
          <div className="absolute bottom-9 right-0 w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 mb-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                Nouveautés v{CHANGELOG.version}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{CHANGELOG.date}</span>
            </div>
            <ul className="space-y-2">
              {CHANGELOG.changes.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
            <button
              onClick={() => setShowChangelog(false)}
              className="mt-3 w-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Fermer
            </button>
          </div>
        )}
        <button
          onClick={() => setShowChangelog((v) => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg bg-gray-800 dark:bg-gray-700 text-gray-100 hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          title="Voir les nouveautés"
        >
          v{APP_VERSION}
        </button>
      </div>
    </Router>
  );
}

export default App;
