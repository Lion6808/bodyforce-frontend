// src/serviceWorkerRegistration.js

export function register() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(registration => {
          console.log('✅ Service Worker enregistré avec succès :', registration);
        })
        .catch(error => {
          console.error('❌ Échec de l’enregistrement du Service Worker :', error);
        });
    });
  }
}
