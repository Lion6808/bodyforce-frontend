# 🦞 CLAUDE.md — BODYFORCE FRONTEND
> Fichier de contexte Claude Code pour le dossier `bodyforce-frontend/`.
> **Version** : 2.7.0 | **Mainteneur** : Lionel | **Mis à jour** : 18 février 2026
> ℹ️ Pour l'architecture globale et les règles BDD, consulter `../DOCS/ARCHITECTURE.md`

---

## 🎯 Ce dossier

Application React (PWA) de gestion de club de sport BodyForce.
- Interface **admin** : dashboard, membres, paiements, stats, messagerie, emails
- Interface **membre** : consultation données personnelles, présences, messages
- PWA mobile-first avec support offline (Workbox)

---

## 📁 Structure `src/`

```
src/
├── App.js                  # Router principal — 43KB, toutes les routes ici
├── App.css                 # Styles globaux — 28KB, safe-area bottom nav
├── index.js                # Point d'entrée React
├── supabaseClient.js       # ⭐ Fichier critique — tous les appels Supabase (15.8KB)
├── contexts/
│   ├── AuthContext.js      # Auth + rôles (admin/user) + données membre connecté
│   └── ThemeContext.js     # Gestion dark mode
├── pages/                  # 20 pages (voir liste ci-dessous)
├── components/             # Composants réutilisables
├── services/
│   └── messagesService.js  # API messagerie (15.5KB)
└── utils/
    └── invitationService.js # Génération tokens, envoi invitations
```

### Pages principales
| Page | Rôle |
|------|------|
| `HomePage.js` | Dashboard stats (RPC `get_statistics`) |
| `MembersPage.js` | Liste membres, filtres, import/export |
| `MemberFormPage.js` | Fiche membre + présences (RPC `get_member_presences`) |
| `StatisticsPage.js` | Stats avancées, heatmap, comparaison N vs N-1 |
| `PlanningPage.js` | Planning présences avec badge_history |
| `PaymentsPage.js` | Gestion paiements |
| `EmailPage.js` | Envoi emails groupés (Resend API) |
| `InvitationSignupPage.js` | Création compte membre via token |

---

## 🎨 Design system — Conventions UI

### Style général
- **Mobile-first** — toujours penser mobile avant desktop
- **Glassmorphism** : `bg-white/70 backdrop-blur-xl` pour les éléments flottants
- **Coins arrondis** : `rounded-3xl` pour tous les containers/widgets, `rounded-xl` pour éléments internes, `rounded-full` pour barres de recherche et pills
- **Couleurs** : définies dans `tailwind.config.js` — ne pas hardcoder de couleurs custom

### Navigation mobile (App.js)
- Barre flottante iOS floating pill : `bg-white/70 backdrop-blur-xl rounded-full`
- Capsule bleue sur l'onglet actif, label uniquement sur l'onglet sélectionné
- Safe-area iPhone dans `App.css` (notch / Dynamic Island) — ne pas supprimer
- Menu "Plus" flottant : `bg-white/60 backdrop-blur-2xl`

### Composants stats (widgets groupés)
- Widget "Total/Actifs/Expirés" : grand chiffre + sous-cartes colorées
- Widget "Répartition" : Hommes (indigo) / Femmes (rose) / Étudiants (jaune)
- État actif des filtres : `ring-2 ring-{couleur} shadow-md shadow-{couleur}/10`

### Dark mode
- Géré via `ThemeContext.js` — toujours prévoir les classes dark: Tailwind

---

## ⚙️ Conventions de code

- **Code complet et syntaxiquement correct uniquement** — jamais d'extraits partiels
- **Ne rien modifier** de ce qui est fonctionnel, du design, ou du code existant
- Seules les **nouvelles fonctionnalités** ou **corrections de bugs** sont autorisées
- Composants en **PascalCase**, fonctions utilitaires en **camelCase**
- Pas de `any` TypeScript (si migration future)
- Toujours utiliser `date-fns` pour la manipulation de dates — pas de `moment.js`
- Notifications via `react-toastify` — pas d'alert() natif
- Icônes via `lucide-react` en priorité

---

## 🔌 Supabase — Règles critiques (`supabaseClient.js`)

### Toujours utiliser les RPC pour les stats
```js
// ✅ FAIRE
await supabase.rpc('get_statistics')
await supabase.rpc('get_detailed_statistics')
await supabase.rpc('get_member_presences', { member_id })
await supabase.rpc('get_all_members_presences')
await supabase.rpc('generate_stats_report', { start_date, end_date })
await supabase.rpc('get_top_members_by_period', { p_start_date, p_end_date, p_limit })

// ❌ NE PAS charger toutes les présences côté client
await supabase.from('presences').select('*')  // 15 000 lignes = egress explosé
```

### Pagination obligatoire sur les grosses tables
```js
// ✅ Toujours paginer (batches de 1000) sur presences
// Exemple dans getYearlyPresenceStats() et getHourlyStatsByDayOfWeek()
```

### badge_history — TOUJOURS filtrer par date
```js
// ❌ DANGEREUX — badge réattribué contaminerait les stats
.from('badge_history').select('member_id, badge_real_id')

// ✅ CORRECT
// En SQL : date_attribution <= p.timestamp AND (date_fin IS NULL OR date_fin >= p.timestamp)
// En JS : trier ASC par date_attribution, ignorer entrées postérieures à endDate
```

### Jointure présences ↔ membres
```js
// ❌ NE JAMAIS FAIRE
.from('presences').select('*, members!inner(*)') // badgeId ≠ members.badgeId direct

// ✅ PASSER PAR badge_history avec filtres de dates
```

### Egress Supabase
- Limite plan gratuit : **5GB/mois** (~2-3GB consommés actuellement)
- Photos : stockées en base64 compressé (20-50KB), colonne `photo_compressed` = true
- ❌ Ne pas stocker les photos dans Supabase Storage

---

## 🔒 Sécurité

- RLS activé sur toutes les tables — ne jamais contourner
- Auth via `AuthContext.js` — ne jamais accéder à `auth.users` directement
- `ADMIN_SENTINEL = -1` dans la messagerie pour les broadcasts admin
- Rôles gérés dans `user_roles` — vérifier `is_disabled` avant d'accorder l'accès
- ❌ Vue `SECURITY DEFINER` interdite (supprimée en v2.3.7)

---

## 📋 Gestion de la documentation (RÈGLE CRITIQUE)

Après toute modification, demander confirmation à Lionel, puis :

1. Générer `CHANGELOG.md` et `ARCHITECTURE.md` mis à jour dans `/mnt/user-data/outputs/`
2. Présenter les fichiers avec `present_files`
3. Attendre que Lionel uploade dans le Project Knowledge
4. **Ne jamais dire "c'est à jour"** avant confirmation de l'upload

```
✅ Bon : "J'ai généré les fichiers. Télécharge-les et uploade-les dans le Project Knowledge."
❌ Mauvais : "La documentation est à jour."
```

---

## 🔮 Roadmap v2.8.0 (prochaine version)

- [ ] Amélioration système liens membres (universal link system)
- [ ] Domaine email personnalisé (@bodyforce.fr)
- [ ] Notifications push PWA
