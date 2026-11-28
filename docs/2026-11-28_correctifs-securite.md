# Journal — Correctifs de sécurité des dépendances (28 novembre 2026)

> Session réalisée sur le **PC perso** de Lionel avec Claude Code.
> Ce document sert de passation : lundi, sur le **poste AT7**, demander à Claude de le lire
> et de faire les vérifications de la section 5 (« Pourquoi le poste AT7 ne montrait rien »).

---

## 1. Point de départ

- Le PC perso était en retard sur GitHub : **frontend −131 commits** (local au 19/01/2026,
  GitHub en v2.14.0 du 20/11/2026), **backend −5 commits**. Aucune modification locale,
  `git pull` simple, puis `npm install` dans les deux dossiers.
- `npm install` a alors affiché des avertissements de sécurité que le poste AT7 n'a jamais montrés :

| Dossier  | Avant                                              | Après      |
|----------|----------------------------------------------------|------------|
| frontend | **41** failles (1 critique, 18 hautes, 11 moyennes, 11 basses) | **0** |
| backend  | **13** failles (1 critique, 6 hautes, 4 moyennes, 2 basses)    | **0** |

---

## 2. Ce qui a été fait — BACKEND → v2.8.1 (branche `master`, commit `2beb5f3`)

| Paquet | Avant | Après | Remarque |
|---|---|---|---|
| sqlite3 | 5.1.7 | 6.x | Base testée (`select sqlite_version()` OK, SQLite 3.52) |
| xlsx | 0.18.5 (npm) | **0.20.3** | Version officielle SheetJS, distribuée **hors npm** : `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (le paquet npm `xlsx` est abandonné et vulnérable) |
| resend | 2.1.0 | 6.41.0 | Envoi d'emails |
| nodemailer | 6.9 | **supprimé** | N'était utilisé nulle part dans le code |
| @react-email/render | 0.0.9 | **supprimé** | Résidu de resend 2 resté dans `package-lock.json` (source des 4 dernières failles) |

**Changement de code** — `server.js`, route d'envoi d'emails groupés (~ligne 629) :
resend renvoie `{ data, error }` au lieu de lever une exception. Avant, un email **refusé** par Resend
était compté comme **envoyé**. Maintenant : `if (sendError) throw new Error(...)` → compté en échec.

Vérifications : `npm test` (2 tests OK), `node --check server.js`, `npm audit` = 0.

---

## 3. Ce qui a été fait — FRONTEND

### 3a. v2.14.1 (branche `master`, commit `0b14583`)

| Paquet | Avant | Après |
|---|---|---|
| jspdf | 3.0.4 | **4.2.1** (faille **critique** GHSA-f8cm-6447-x5h2) |
| xlsx | 0.18.5 (npm) | **0.20.3** (tarball officiel SheetJS, comme le backend) |
| divers | — | `npm audit fix` (sans changement de version majeure) |

Version affichée + changelog in-app mis à jour dans `src/App.js`.

### 3b. v2.15.0 (branche **`vite-migration`**, dernier commit de la branche) — ⚠️ PAS ENCORE FUSIONNÉE

La quasi-totalité des failles restantes (~30) venaient de **react-scripts** (Create React App),
abandonné et plus maintenu. Il a été remplacé par **Vite 7.3** :

- `vite.config.mjs` (nouveau) : sortie dans `build/`, port 3000, JSX autorisé dans les `.js`,
  `process.env.REACT_APP_*` remplacés au build → **noms de variables inchangés** (Render n'a rien à changer).
  Toute nouvelle variable `REACT_APP_*` doit être ajoutée à `KNOWN_KEYS` dans ce fichier.
- `index.html` déplacé de `public/` à la **racine** + `<script type="module" src="/src/index.js">`.
- Scripts : `npm start` = `vite` ; `npm run build` = `vite build && workbox injectManifest` (Workbox inchangé).
- **react-router-dom 6 → 7.18.7** : aucun changement de code (tous les liens sont absolus).
- `overrides` dans `package.json` : glob 14 (Workbox), tmp 0.2.7, uuid 11 (exceljs n'utilise que `v4()`).
- `engines.node >= 20.19.0` : exigé par Vite 7, et lu par Render pour choisir la version de Node.
- `CLAUDE.md` : nouvelle section « Build Vite ».
- Vite 8 a été écarté : conflit de dépendances Babel avec workbox-build.

**Vérifications faites** :
- `npm run build` OK, service worker généré (54 fichiers précachés).
- Appli compilée **et** serveur de dev chargés dans Edge (headless) : page de connexion affichée,
  **aucune erreur JavaScript**, y compris sur `/members`.
- jsPDF 4 + jspdf-autotable : PDF avec tableau généré correctement.
- exceljs (avec uuid forcé) + xlsx 0.20.3 : écriture puis relecture d'un fichier Excel (accents OK).

**Non vérifié** (pas de fichier `.env` ni d'identifiants sur le PC perso) : l'appli **connectée**
à Supabase. Voir la checklist de la section 6.

---

## 4. État des dépôts à la fin de la session

| Dépôt | Branche | Commits locaux | Poussé sur GitHub ? |
|---|---|---|---|
| backend  | master | `2beb5f3` v2.8.1 | ❌ **non** |
| frontend | master | `0b14583` v2.14.1 + ce journal | ❌ **non** |
| frontend | vite-migration | v2.15.0 (1 commit au-dessus de master) | ❌ **non** |

Le push a été bloqué par les permissions de Claude Code : **Render redéploie automatiquement à
chaque push sur `master`**, donc c'est Lionel qui pousse.

```
cd C:\BodyForce\backend
git push origin master

cd C:\BodyForce\frontend
git push origin master
git push -u origin vite-migration     (sauvegarde la branche, ne déclenche PAS Render)
```

> À surveiller dans le journal de déploiement Render du backend : l'installation de **sqlite3 6**
> (module natif) et le téléchargement de xlsx depuis `cdn.sheetjs.com`.

Après un changement de branche dans `frontend`, toujours relancer `npm install`
(react-scripts sur `master`, Vite sur `vite-migration`).

---

## 5. Pourquoi le poste AT7 ne montrait rien — À VÉRIFIER LUNDI

Les failles existent forcément aussi sur le poste AT7 (mêmes paquets, même `package-lock.json`).
Seul l'**affichage** de l'audit manquait. Hypothèses, de la plus à la moins probable :

1. **Proxy / miroir npm d'entreprise** (Artifactory, Nexus…) qui ne répond pas à l'API d'audit
   de npm → `npm install` n'affiche jamais le résumé.
2. **Audit désactivé** : `audit=false` dans un `.npmrc` (utilisateur, global, ou déployé par la DSI).
3. **`npm install` jamais lancé** : les scripts `resync-git*.bat` ne font que `git pull` / `git reset`.
4. **Failles publiées récemment** : les avis de sécurité sont ajoutés en continu.

**Commandes à lancer sur le poste AT7** (dans `C:\BodyForce\frontend`, avec `npm.cmd` si PowerShell
bloque les scripts) :

```
npm.cmd config get audit          # "false" → hypothèse 2
npm.cmd config get registry       # autre chose que https://registry.npmjs.org/ → hypothèse 1
npm.cmd config list -l | findstr /i "audit registry proxy"
npm.cmd audit                     # erreur / timeout → hypothèse 1
```

Et chercher les fichiers `.npmrc` : `%USERPROFILE%\.npmrc`, le dossier du projet, et
`npm.cmd config get globalconfig`.

---

## 6. Checklist de validation (avant de fusionner `vite-migration` dans `master`)

Sur un poste avec le `.env` (Supabase) :

```
cd C:\BodyForce\frontend
git switch vite-migration
npm.cmd install
npm.cmd start                      (ouvre http://localhost:3000)
```

- [ ] Connexion admin + connexion membre
- [ ] Accueil, Membres, Planning, Paiements, Statistiques s'affichent
- [ ] **PDF** : page Paiements + rapport de statistiques
- [ ] **Excel** : export et import (page Membres), export des passages (Planning → Outils)
- [ ] Photo membre (caméra)
- [ ] Envoi d'un email de test (backend v2.8.1 + Resend)
- [ ] `npm.cmd run build` puis `node tour-bf.mjs http://localhost:3000 ...` (cf. CLAUDE.md)

Si tout est bon :

```
git switch master
git merge vite-migration
git push origin master             (→ Render redéploie le frontend en v2.15.0)
```

Si Render échoue : vérifier que la commande de build est `npm run build`, le dossier publié `build`,
et la version de Node (≥ 20.19). Retour arrière possible : `git revert` du merge, puis push.

---

## 7. Points en suspens (non bloquants)

- `index.html` : 3 balises `<meta>` placées **avant** `<head>` (déjà le cas avant). Vite affiche un
  avertissement `misplaced-start-tag-for-head-element`, sans conséquence. Correction possible plus tard.
- `eslint-config-react-app` n'est plus installé (il venait de react-scripts) : la vérification
  ESLint `no-undef` décrite dans CLAUDE.md demande de l'installer ponctuellement.
- Le dossier `cert/` (cert.pem / key.pem) n'est référencé par aucune configuration : rôle à confirmer.
- npm 12 est disponible (10.9.2 installé) : mise à jour facultative.
