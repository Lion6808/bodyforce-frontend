// Hook PWA : installation, mise à jour du service worker — extrait de App.js

import { useState, useEffect } from "react";

/** Hook de gestion PWA : detecte installabilite, affiche prompt, gere install */
export function usePWA() {
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
