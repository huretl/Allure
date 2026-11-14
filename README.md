# Allure

Appli Android perso pour planifier course à pied, muscu/renfo et courses officielles.

- Web : Vite (`src/`, `index.html`) — `npm run dev` pour travailler dans le navigateur.
- Android : Capacitor 8 (`android/`).
- Données : sur le téléphone ; synchro Firebase dès que `src/firebase-config.js` est rempli.
- APK : compilé par GitHub Actions à chaque push sur `main` (onglet **Releases** → `Allure.apk`).

## Récupérer le projet dans WSL

```bash
cd ~/projects/perso && git clone git@github.com:huretl/Allure.git && cd Allure && npm ci
```

## Signature

`android/app/allure.keystore` + `keystore.properties` signent toutes les versions avec la même clé
(nécessaire pour installer les mises à jour par-dessus). Ne pas les perdre, garder le dépôt privé.
