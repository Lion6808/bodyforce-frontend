@echo off
echo === Suppression des modules et du cache ===
rmdir /s /q node_modules
del package-lock.json

echo === Nettoyage du cache npm ===
npm cache clean --force

echo === Réinstallation des dépendances ===
npm install --legacy-peer-deps

echo.
echo ✅ Réinstallation terminée. Tu peux maintenant faire "npm start"
pause
