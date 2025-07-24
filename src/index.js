// Supprime l'erreur "ResizeObserver loop..." dans la console (optionnel mais utile)
const observerError = "ResizeObserver loop completed with undelivered notifications.";
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === "string" && args[0].includes(observerError)) return;
  originalError(...args);
};

import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css"; // <-- ton fichier CSS avec Tailwind
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
import { register } from './serviceWorkerRegistration';
register();
