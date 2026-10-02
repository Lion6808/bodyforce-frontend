// Hook mode sombre — extrait de App.js

import { useState, useEffect } from "react";
import { FaMoon, FaSun, FaAdjust } from "react-icons/fa";

/**
 * Gere le theme de l'application (clair / sombre / auto).
 * Le mode auto bascule automatiquement selon l'heure (19h-7h = sombre).
 */
export function useDarkMode() {
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
