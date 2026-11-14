# Allure : contexte pour Claude Code

Appli Android perso de Thomas (Lille) pour **programmer et suivre son sport** : courses à pied, séances de muscu/renfo, courses officielles. Interface en **français**. Thomas l'utilise sur son téléphone Android.

Projet démarré dans une conversation claude.ai le 14/11/2026, puis repris ici. Dépôt : `git@github.com:huretl/Allure.git` (privé), cloné dans `~/projects/perso/Allure` (WSL Ubuntu 20.04, Windows).

## Stack

- **Web** : HTML/CSS/JS vanilla (pas de framework), bundlé par **Vite 8**. Entrée `index.html` → `src/main.js`, styles `src/style.css`, police `src/fonts.css` (Inter Variable via `@fontsource-variable/inter`, embarquée pour marcher hors ligne).
- **Android** : **Capacitor 8** (`android/`), appId `fr.thomas.allure`, minSdk 24, target/compile 36.
  - Plugins : `@capacitor/app` (bouton retour, resume), `@capacitor/local-notifications` (rappels). `SystemBars` du core pour la couleur des barres système.
  - `capacitor.config.json` : `SystemBars.insetsHandling: "css"` + `viewport-fit=cover`. Les marges utilisent `--sat` / `--sab` (définies dans `:root`, qui combinent `env(safe-area-inset-*)` et `--safe-area-inset-*` injectées par Capacitor).
- **Node** : il faut **Node ≥ 22** (Capacitor 8 + Vite 8). Sur Ubuntu 20.04, vérifier `node -v`, sinon installer via nvm.
- Commandes : `npm ci`, `npm run dev` (navigateur), `npm run build`, `npm run sync` (build + `cap sync android`).

## Compilation de l'APK

- **GitHub Actions** (`.github/workflows/apk.yml`), à chaque push sur `main` : Node 22, Java 21 (Temurin), Android SDK, puis `assembleRelease`. L'APK est publié en **Release** `v1.0.<run>` sous le nom `Allure.apk`. Thomas le télécharge depuis son téléphone.
- Inutile de compiler en local (pas besoin d'Android SDK dans WSL), sauf demande explicite.
- `versionCode` = `GITHUB_RUN_NUMBER`, donc chaque build s'installe par-dessus le précédent.
- **Signature** : `android/app/allure.keystore` + `android/app/keystore.properties` sont **commités volontairement** (dépôt privé, usage perso). Même clé pour toutes les versions, sinon les mises à jour ne s'installent pas. **Ne jamais régénérer ni supprimer.**

## Fonctionnalités actuelles (v1)

- **Planning** : vue semaine (lun→dim, navigation ‹ ›, bouton Aujourd'hui). Carte « prochaine course » avec compte à rebours J-x. Stats de la semaine (km faits/prévus, séances, muscu). Cocher « fait » d'un tap.
- **Course à pied** : type (Footing, Fractionné, Sortie longue, Seuil / tempo, Côtes, Récupération), distance, durée, allure calculée, contenu (texte libre). Résultat : distance réelle, temps, ressenti RPE 1-10.
- **Muscu / renfo** : modèles (Renfo coureur, Haut du corps, Bas du corps, Full body), éditeur d'exercices (nom, séries, répétitions, charge). Pendant la séance, une bulle par série à cocher ; la séance passe en « faite » quand tout est coché. Minuteur de repos (1:00 / 1:30 / 2:00 / 3:00, +30 s, vibration à la fin).
- **Courses officielles** : nom, lieu, distance (5 km / 10 km / Semi / Marathon / Trail + D+), objectif → allure, statut (Inscrit / À s'inscrire / Intéressé), dossard, retrait du dossard, lien. Résultat : chrono, classement, comparaison avec l'objectif.
- **Répéter chaque semaine** (1 à 12 semaines), Dupliquer, Supprimer (confirmation dans la page, jamais `confirm()`).
- **Bilan** : km du mois et de l'année, nombre de courses dans l'année, graphique km/semaine sur 10 semaines (SVG maison), répartition des séances du mois, séances manquées sur 4 semaines.
- **Rappels** (natif uniquement) : la veille à 20 h et/ou 1 h avant (si une heure est renseignée), activables dans ⚙️ Réglages (stockés dans `localStorage` sous `allure.settings`). Fonction `doSchedule()` : annule tout puis replanifie au max 60 rappels sur 45 jours. Un tap sur la notification ouvre la séance.
- Bouton retour Android : ferme le minuteur, puis la feuille ouverte, puis revient à l'onglet Planning, puis quitte l'appli.

## Données

- Modèle d'un élément (`S.items[id]`) :
  ```
  { id, kind: 'run'|'gym'|'race', date:'YYYY-MM-DD', time:'HH:MM'|'', title, notes, done, updatedAt,
    run:  { type, distKm, durS, struct },
    gym:  { focus, durMin, ex:[{ name, sets, reps, load, done }] },   // done = nb de séries faites
    race: { place, distKm, elev, goalS, status, bib, pick, url, trail },
    result: { distKm, timeS, rpe, rank } }
  ```
  Seule la sous-clé du `kind` est conservée (`saveForm` supprime les autres).
- **Pour l'instant : stockage local seulement** (`localStorage`, clé `allure.v1`), dans la WebView. Les fonctions `persist(it)` et `removeItem(id)` sont les seuls points d'écriture.
- **Firebase est déjà codé mais inactif** : `src/firebase-config.js` exporte `null`. Il suffit d'y mettre l'objet `firebaseConfig` pour activer :
  - Auth e-mail/mot de passe (`initializeAuth` + `indexedDBLocalPersistence`, écran de connexion intégré, messages d'erreur en français).
  - Firestore avec cache persistant (`persistentLocalCache`) : l'appli marche hors ligne et resynchronise toute seule. Chemin : `users/{uid}/items/{itemId}`.
  - À la première connexion, les éléments locaux absents de Firestore sont envoyés (marqueur `allure.migrated.<uid>`).
  - Le SDK est chargé en `import()` dynamique, donc rien n'est chargé tant que la config est `null`.
- **Choix validé avec Thomas** : Firebase, offre gratuite Spark. Supabase a été écarté parce que les projets gratuits se mettent en pause après 7 jours d'inactivité. Thomas n'a pas de serveur chez lui.
- **Reste à faire côté Thomas** (dans la console Firebase) : créer le projet « allure », activer Authentication › E-mail/Mot de passe, créer Firestore en `europe-west9` en mode production, publier ces règles :
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{uid}/{doc=**} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
  ```
  puis récupérer la config d'une appli **Web** pour la coller dans `src/firebase-config.js`. Cette config n'est pas secrète, elle peut être commitée.

## Identité visuelle (préférence de Thomas)

Toutes ses applis partagent la **DA de son appli Nexet** : on reprend ses couleurs, sans copier son style. **Une seule police** (Inter). **Pas de phrases explicatives** à l'écran. Thème sombre par défaut, thème clair automatique via `prefers-color-scheme`. Tokens dans `:root` de `src/style.css` :

| Jeton | Sombre | Clair |
|---|---|---|
| bg | #0B0C0D | #F2F2EE |
| s1 / s2 / s3 | #101214 / #15181C / #1C2026 | #FFFFFF / #F7F7F3 / #E9E9E3 |
| line | #22262B | #DCDCD4 |
| ink / ink2 / ink3 | #E7EAED / #C3C9D0 / #949BA3 | #14161A / #3C4249 / #5C636B |
| acc (accent) | #D8F547 | #CFE83C (accink #5C7606) |
| info (muscu) | #8AB4F8 | #2457B8 |
| att (courses officielles) | #FF9B52 | #9C4A0A |
| bad | #F0776C | #A32A20 |

Couleur par type : course à pied = accent vert-jaune, muscu = bleu `info`, course officielle = orange `att`. Icône : coureur sombre sur fond `#D8F547`. Splash : fond `#0B0C0D`.

## Architecture de `src/main.js`

Un seul fichier, organisé en sections :
- **Utilitaires** : dates, formats `fmtDur` / `fmtPace` / `fmtKm`, `parseDur` (accepte `45`, `45:30`, `1:45:00`, `1h45`).
- **Données** : stockage local, Firebase, connexion.
- **Rappels**.
- **Calculs**.
- **Vues** : `vPlan`, `vRaces`, `vStats`. `render()` reconstruit tout le `#main`.
- **Feuilles** : feuille du bas pour le formulaire, le détail et les réglages.
- **Minuteur**.
- **Actions** : délégation de clic via `data-act` → objet `ACT`.
- **Démarrage**.

## Pistes évoquées pour la suite

- Brancher Firebase dès que Thomas fournit la config.
- Accès depuis le PC : même build web, par exemple sur Firebase Hosting gratuit. À proposer, pas encore décidé.
- GPS pendant les sorties : évoqué, pas demandé ferme.

## Façon de travailler avec Thomas

- Il répond en français, de façon directe. Il préfère qu'on avance plutôt qu'une longue liste d'options.
- Commits en français. Pousser sur `main` déclenche une release APK : grouper les changements plutôt que pousser chaque petite modif.
- Tester dans le navigateur (`npm run dev`) avant de pousser. Ne pas casser le reste de son environnement WSL (il y a aussi des projets pro sous `/var/www/apps`).
