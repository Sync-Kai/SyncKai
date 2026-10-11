# Publication sur le Chrome Web Store et Firefox Add-ons

Procédure pas à pas pour publier SyncKai (première soumission puis mises à jour). Sections 1 à 6 : Chrome Web Store ; Firefox Add-ons (AMO) : section 7 et [docs/store/amo.md](store/amo.md).

## 1. Générer l'archive

```bash
npm run package
```

Produit `release/synckai-<version>-chrome.zip` (contenu de `dist/` à la racine). Le script :

- vérifie que la version de `dist/manifest.json` = version de `package.json` ;
- **retire le champ `key`** du manifest (le Web Store le refuse : l'ID est attribué par le store) ;
- refuse l'archive si `dist/` contient des source maps (`*.map`), un fichier > 10 Mo, ou s'il manque `_locales/{en,fr,de}/messages.json`.

## 2. Premier dépôt (brouillon non répertorié)

1. Ouvrir le [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (frais d'inscription uniques de 5 $ si le compte n'est pas encore activé).
2. **New item** → déposer `release/synckai-<version>-chrome.zip`.
3. Onglet **Distribution** → visibilité **Unlisted** (non répertorié) pour la première version : l'extension n'est accessible que via son lien, le temps de valider OAuth en conditions réelles.
4. **Ne pas encore soumettre** : il faut d'abord mettre à jour les redirections OAuth (étape 4).

## 3. Fiche du store

Remplir les onglets **Store listing** et **Privacy** avec :

| Contenu | Fichier |
| --- | --- |
| Fiche française | [docs/store/listing-fr.md](store/listing-fr.md) |
| Fiche anglaise | [docs/store/listing-en.md](store/listing-en.md) |
| Fiche allemande | [docs/store/listing-de.md](store/listing-de.md) |
| Justification des permissions | [docs/store/permissions.md](store/permissions.md) |

**Visuels** (onglet **Store listing**, détail et régénération : [docs/store/screenshots.md](store/screenshots.md)) :

| Champ du dashboard | Fichier | Langues |
| --- | --- | --- |
| *Store icon* (128×128) | `docs/store/icon-128.png` | toutes |
| *Screenshots* (1280×800, 5 max, dans l'ordre 01 → 05) | `docs/store/screenshots/<langue>/0N-*.png` | une série par langue (sélecteur de langue de la fiche) |
| *Graphic assets › Small promo tile* (440×280) | `docs/store/promo-440x280.png` | non localisable |
| *Graphic assets › Marquee promo tile* (1400×560) | `docs/store/promo-1400x560.png` | non localisable (anglais) |

Les captures et la tuile marquee se régénèrent avec `npm run screenshots` (version du popup lue dans `manifest.json` : relancer après chaque montée de version).

- **Privacy policy URL** : `https://github.com/Sync-Kai/SyncKai/blob/main/PRIVACY.md`
- Déclarer les données traitées (onglet Privacy) conformément à `PRIVACY.md` et cocher les certifications d'usage (pas de vente de données, pas d'usage hors fonctionnalité).

## 4. Changement d'ID (OAuth AniList + MAL)

L'ID attribué par le store diffère de celui du build local : les redirections OAuth (`https://<ID>.chromiumapp.org/`) doivent suivre.

1. Après le premier dépôt, copier l'**Item ID** affiché dans le dashboard (32 lettres a–p).
2. **AniList** → [Developer settings](https://anilist.co/settings/developer) → client **52346** → remplacer le **Redirect URL** par `https://<ID>.chromiumapp.org/`.
3. **MyAnimeList** → [API config](https://myanimelist.net/apiconfig) → app (Client ID `84d05521…`) → remplacer l'**App Redirect URL** par la même URL `https://<ID>.chromiumapp.org/`.
4. Dashboard → onglet **Package** → **Public key** → copier la clé (sans les lignes `-----BEGIN/END PUBLIC KEY-----`, sur une seule ligne) dans le champ `key` de `manifest.json` du projet. Le build local aura ainsi le même ID que la version du store (le champ est retiré automatiquement par `npm run package`).
5. `npm run build`, puis `chrome://extensions` → **Recharger** l'extension non empaquetée ; vérifier que l'ID affiché correspond à l'Item ID.
6. Se **déconnecter puis reconnecter** AniList et MyAnimeList dans les options pour valider les nouvelles redirections.

### Clients OAuth par navigateur

Chaque navigateur attribue son propre ID d'extension, donc sa propre URL de redirection. Un client AniList n'accepte qu'une seule Redirect URL (et SyncKai n'envoie jamais `redirect_uri`) : il faut **un client AniList et une app MAL par navigateur**. La correspondance ID → clients est dans `src/background/auth/oauth-clients.ts` ; un ID absent de la table affiche « Connexion non configurée pour ce navigateur » avec l'URL à enregistrer (aussi journalisée en warn).

| Navigateur | ID d'extension | URL de redirection | Client AniList | App MAL |
| --- | --- | --- | --- | --- |
| Chrome (Web Store) | `khokcmigioggannjoojambdgioigdceb` | `https://khokcmigioggannjoojambdgioigdceb.chromiumapp.org/` | `52346` | `84d05521c007a529cc458421bd0940c5` |
| Firefox (AMO) | `synckai@sync-kai.github.io` | `https://01497c3a0de229567af456487a2af9d686551088.extensions.allizom.org/` (SHA-1 de l'ID, vérifiée via `chrome.identity.getRedirectURL()`) | `52509` (« SyncKai Firefox ») | `1846238e6ea67a5109899f5311a51d15` |

## 5. Soumission

1. Dashboard → **Submit for review**.
2. Délai de revue typique : de quelques heures à **1–3 jours ouvrés** ; plus long (jusqu'à 1–2 semaines) pour une première soumission ou lorsque des permissions d'hôte larges sont demandées.
3. Une fois validée et testée en non répertorié, passer la visibilité à **Public** si souhaité.

## 6. Mises à jour

Les mises à jour sont publiées automatiquement par GitHub Actions (section 7). Procédure manuelle de secours :

1. Incrémenter la version dans `package.json` **et** `manifest.json` (le script refuse si elles diffèrent).
2. `npm run package`.
3. Dashboard → **Package** → **Upload new package** → déposer le nouveau zip → **Submit for review**.

L'ID ne change plus : aucune modification OAuth n'est nécessaire pour les mises à jour.

### Identifiant client Crunchyroll (import de l'historique)

L'import de l'historique demande à Crunchyroll un jeton temporaire (`POST /auth/v1/token`, `grant_type=etp_rt_cookie`, cookie de session du site) avec l'identifiant client **public** du site web de Crunchyroll : `CR_WEB_CLIENT_ID` dans `src/content/lib/crunchyroll-history.ts`. Ce n'est pas un secret (il figure dans le code du site), mais Crunchyroll peut le changer. La synchro en direct n'en dépend pas.

**Symptôme** : l'import affiche « Import indisponible » à un utilisateur connecté à Crunchyroll ; dans la console de l'onglet Crunchyroll, `Lecture de l’historique impossible (unavailable)`, et dans l'onglet Réseau, `/auth/v1/token` répond 400 ou 401 avec `invalid_client`, `unauthorized_client` ou `invalid_request`. (`invalid_grant` ou un 401 sans motif signifient « déconnecté » : ce n'est pas une rotation.)

**Mise à jour** (branche `hotfix/cr-client-id`, version corrective) :

1. Ouvrir `https://www.crunchyroll.com/` connecté, outils de développement › **Réseau**, recharger la page et filtrer sur `auth/v1/token`.
2. Dans la requête POST du site, lire l'en-tête `Authorization: Basic …` et le décoder (`atob('…')` dans la console) : la partie avant `:` est le nouvel identifiant (le secret est vide). Vérifier que le corps utilise toujours `grant_type=etp_rt_cookie`.
3. Remplacer `CR_WEB_CLIENT_ID`, puis `npx vitest run src/content/lib/crunchyroll-history.test.ts`.
4. Tester un import réel dans Chrome et Firefox (onglet Crunchyroll connecté), puis publier la version corrective.

Aucune permission ni justification du Store ne change : `docs/store/permissions.md` et `PRIVACY.md` décrivent l'identifiant public sans le citer.

## 7. Publication automatique (GitHub Actions)

### Workflows

- **`.github/workflows/ci.yml`** : à chaque push sur `main`/`develop` et sur chaque pull request, vérifie les types (`src` et `scripts`), lance les tests, les builds Chrome et Firefox et `web-ext lint`.
- **`.github/workflows/release.yml`** : à chaque tag `vx.y.z` poussé, quatre jobs :

  ```text
  build ──┬── chrome ───┬── github-release
          └── firefox ──┘
  ```

  1. **build** : vérifie que le commit du tag est contenu dans `origin/main` (`git merge-base --is-ancestor`, sinon aucun envoi) et que la version du tag = `package.json` = `manifest.json`, installe les dépendances sans scripts d'installation (`npm ci --ignore-scripts`), lance les tests (dont `scripts/store-permissions.test.ts` : chaque permission du manifeste a sa justification dans `docs/store/permissions.md`) et les tests de bout en bout (Chrome headless à la version épinglée par `puppeteer` dans le lockfile : `chrome-headless-shell@pinned`), puis `npm run package:all` → `release/synckai-<version>-chrome.zip`, `-firefox.zip` et `-source.zip` (`git archive` du tag), `web-ext lint` et les notes extraites du `CHANGELOG.md` (`scripts/changelog-notes.ts`). Le tout est transmis aux jobs suivants (artefact `release`).
  2. **chrome** : envoie l'archive Chrome au Chrome Web Store et la **soumet pour examen** (`chrome-webstore-upload-cli`) : la version est mise en ligne automatiquement dès sa validation.
  3. **firefox** (en parallèle) : `web-ext sign --channel listed` envoie le paquet Firefox **et l'archive des sources** à AMO, puis le soumet pour examen sans attendre (`--approval-timeout 0`) : AMO publie la version une fois approuvée. La fiche complète (`docs/store/amo-metadata.json`) n'est envoyée que tant que le module n'est pas public ; ensuite, seules les métadonnées de version (licence, notes pour les relecteurs) partent, pour ne pas écraser les modifications faites à la main sur AMO. Le statut du module est lu sur l'API publique d'AMO : 200 → module public ; 401, 403 ou 404 → absent ou non public ; tout autre code (5xx, 429, délai dépassé, après 3 essais) fait échouer le job, sans rien envoyer.
  4. **github-release** : si le Chrome Web Store a accepté la version (même si AMO a échoué), crée la release GitHub avec les trois zips, les notes du changelog et une ligne de statut (« Chrome Web Store : soumis pour examen · Firefox (AMO) : … »). Si la release existe déjà (créée à la main, run relancé), il la met à jour (`gh release edit`, puis `gh release upload --clobber`) au lieu d'échouer.

Chaque job n'a que les droits nécessaires (`contents: write` uniquement pour la release GitHub). Les jobs **chrome** et **firefox** tournent dans l'environnement GitHub `stores` (secrets des stores réservés aux tags `v*`, voir *Réglages GitHub* ci-dessous) et n'exécutent que les outils du lockfile : `chrome-webstore-upload-cli` et `web-ext` sont des devDependencies à version exacte, installées par `npm ci --ignore-scripts` et lancées par `npx --no-install` (jamais résolues sur le registre npm pendant le run). Pour les mettre à jour : `npm install --save-dev --save-exact <paquet>@<version>`, sur une branche `chore/…`. Chaque store vérifie ses propres secrets et échoue avec la liste des noms manquants.

**En cas d'échec** :

- **Secrets ou panne passagère** : corriger, puis *Actions › run › Re-run failed jobs* (ne relance que les jobs échoués et ceux qui en dépendent ; un store qui a déjà accepté la version n'est pas renvoyé).
- **Correction de code** : supprimer le tag (`git push --delete origin vx.y.z`, `git tag -d vx.y.z`), le recréer et le repousser. Si un store a déjà accepté la version, il refusera ce nouvel envoi (même numéro) : préférer une nouvelle version de correctif.
- **Chrome Web Store en échec** : pas de release GitHub, aucune annonce d'une version absente du Store. Ne pas créer la release à la main avec « Chrome Web Store : soumis pour examen » tant que la version n'est pas réellement soumise.
- **Chrome Web Store refusé : « Your submission does not meet the requirements to be published »** : une permission ou un hôte n'a pas sa justification dans l'onglet **Confidentialité** du tableau de bord (cas des 2.0.0 et 2.1.0). Le paquet est envoyé mais pas soumis ; AMO, en parallèle, a en général déjà accepté la version. Reprise :
  1. Tableau de bord → onglet **Confidentialité** (*Privacy practices*) → coller les blocs de [docs/store/permissions.md](store/permissions.md) (justification de chaque permission, champ unique des hôtes) → **Enregistrer le brouillon**.
  2. **Soit** *Actions › run › Re-run failed jobs*, sans rien soumettre dans le tableau de bord : le job `chrome` renvoie le même zip (il remplace le brouillon non publié, à confirmer à la première occurrence) et le soumet, puis `github-release` crée la release. AMO n'est pas renvoyé (job réussi).
  3. **Soit**, si ce nouvel envoi est refusé ou si la version a déjà été soumise à la main (**Submit for review** dans le tableau de bord ; tout envoi est alors refusé pendant l'examen) : ne pas relancer, créer la release GitHub depuis l'artefact du run :

     ```bash
     gh run download <run-id> --repo Sync-Kai/SyncKai -n release -D release-x.y.z
     printf '\n---\n\nChrome Web Store : soumis pour examen · Firefox (AMO) : soumis pour examen\n' >> release-x.y.z/notes.md
     gh release create vx.y.z release-x.y.z/synckai-x.y.z-{chrome,firefox,source}.zip \
       --repo Sync-Kai/SyncKai --title "SyncKai x.y.z" --notes-file release-x.y.z/notes.md --verify-tag
     ```

     Adapter le statut AMO au résultat du job `firefox`. Un *Re-run* ultérieur de `github-release` mettrait cette release à jour au lieu d'échouer.
  4. Prévention : `scripts/store-permissions.test.ts` rougit la CI dès qu'une permission est ajoutée sans section dans `permissions.md` ; reporter ces blocs dans l'onglet Confidentialité **avant** le tag (voir *Routine de release*).
- **Tag hors de `main`** (« n'est pas sur main ») : rien n'est envoyé. Supprimer le tag (`git push --delete origin vx.y.z`, `git tag -d vx.y.z`), fusionner la release dans `main` (`--ff-only`), retaguer le commit de `main` et repousser.
- **Statut AMO indéterminé** (HTTP 5xx, 429, délai dépassé) : panne passagère d'AMO, rien n'a été envoyé à AMO ; *Re-run failed jobs* plus tard.
- **Seul AMO en échec** : la release GitHub est créée avec « Firefox (AMO) : échec » ; relancer le job `firefox` (*Re-run failed jobs*) ou envoyer `release/synckai-<version>-firefox.zip` + `-source.zip` à la main sur le [Developer Hub](https://addons.mozilla.org/developers/addons). La ligne de statut de la release se corrige à la main (`gh release edit`).

### Configuration (une seule fois)

1. **Projet Google Cloud** : [console.cloud.google.com](https://console.cloud.google.com/) → créer un projet (ex. « SyncKai Store ») avec le compte Google propriétaire du compte développeur du Store.
2. **API** : *API et services › Bibliothèque* → activer **Chrome Web Store API**.
3. **Écran de consentement OAuth** : type **Externe**, renseigner le nom et l'e-mail de contact, puis passer le statut de publication sur **En production**. En mode *Test*, Google révoque les refresh tokens après **7 jours** : la publication automatique échouerait la semaine suivante. Aucune validation Google n'est nécessaire pour un usage personnel (seul l'avertissement « application non validée » s'affiche lors de l'autorisation).
4. **Identifiants** : *API et services › Identifiants › Créer des identifiants › ID client OAuth* → type **Application de bureau** → noter le **Client ID** et le **Client secret**.
5. **Refresh token** : en local, `npx chrome-webstore-upload-keys`, saisir le Client ID et le Client secret, puis autoriser l'accès dans le navigateur qui s'ouvre (compte propriétaire du Store) ; l'outil affiche le **refresh token**. Guide complet : [fregante/chrome-webstore-upload-keys](https://github.com/fregante/chrome-webstore-upload-keys).
6. **Publisher ID** : identifiant du compte développeur (différent de l'ID de l'extension), visible dans l'URL du [Developer Dashboard](https://chrome.google.com/webstore/devconsole) une fois connecté (`…/devconsole/<publisher-id>`). Requis par l'API Chrome Web Store v2.
7. **Secrets GitHub** : dépôt → *Settings › Secrets and variables › Actions › New repository secret* :

   | Secret | Valeur |
   | --- | --- |
   | `CWS_CLIENT_ID` | Client ID OAuth |
   | `CWS_CLIENT_SECRET` | Client secret OAuth |
   | `CWS_REFRESH_TOKEN` | Refresh token (étape 5) |
   | `CWS_PUBLISHER_ID` | Publisher ID (étape 6) |
   | `AMO_JWT_ISSUER` | Firefox Add-ons : *JWT issuer* (étape 8) |
   | `AMO_JWT_SECRET` | Firefox Add-ons : *JWT secret* (étape 8) |

   Le workflow échoue avec un message explicite si l'un d'eux manque. L'ID de l'extension (Chrome) et l'ID Gecko (`synckai@sync-kai.github.io`, Firefox) sont des constantes publiques du workflow. Les secrets de dépôt restent lus par les jobs de l'environnement `stores` ; les déplacer dans l'environnement est recommandé (*Réglages GitHub* ci-dessous).
8. **Clés API AMO** : se connecter à [addons.mozilla.org](https://addons.mozilla.org/) avec le compte développeur Firefox, puis [Developer Hub › Manage API Keys](https://addons.mozilla.org/developers/addon/api/key/) → accepter le contrat de distribution si demandé → **Generate new credentials** : copier le *JWT issuer* (`user:…`) dans `AMO_JWT_ISSUER` et le *JWT secret* dans `AMO_JWT_SECRET`. Ces clés n'expirent pas mais peuvent être révoquées et régénérées depuis la même page.

### Réglages GitHub (une seule fois, à la main)

Le workflow fonctionne sans ces réglages (GitHub crée l'environnement `stores` au premier run, sans restriction), mais ce sont eux qui réservent les secrets des stores aux tags de version :

- [ ] **Environnement `stores`** : *Settings › Environments › New environment* → `stores` → *Deployment branches and tags* → **Selected branches and tags** → *Add deployment branch or tag rule* → type **Tag**, motif `v*`, aucune branche. Facultatif : *Required reviewers* (soi-même) pour approuver chaque envoi aux stores.
- [ ] **Secrets dans l'environnement** : recréer les six secrets (`CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID`, `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`) dans *Environments › stores › Environment secrets*, puis supprimer les secrets de dépôt (*Settings › Secrets and variables › Actions › Repository secrets*). Tant qu'ils sont au niveau du dépôt, n'importe quel workflow peut les lire.
- [ ] **Ruleset sur les tags** : *Settings › Rules › Rulesets › New ruleset › New tag ruleset* → nom « Tags de version », *Enforcement status* **Active**, cible *Include by pattern* `v*` → **Restrict creations**, **Restrict updates**, **Restrict deletions**, **Block force pushes** → *Bypass list* : **Repository admin** (le propriétaire tague et peut supprimer un tag raté).
- [ ] **Ruleset sur `main`** (recommandé : le contrôle `merge-base` s'appuie sur `main`) : *New branch ruleset* → cible `main` → **Restrict deletions**, **Block force pushes**, sans exiger de pull request (la routine pousse en fast-forward).
- [ ] **Releases v2.0.0 et v2.1.0** : créées à la main avec « Chrome Web Store : soumis pour examen » alors que le job `chrome` avait échoué. Si ces versions n'ont pas été soumises ensuite depuis le tableau de bord, corriger la ligne de statut (`gh release edit vx.y.z --notes-file …`).

### Première soumission Firefox (AMO)

Le module n'existe pas encore sur AMO : c'est le premier tag poussé qui le crée (canal *listed*, fiche publique après examen).

1. Le job `firefox` envoie la fiche de `docs/store/amo-metadata.json` (nom, résumé et description en en-US/fr/de, catégories, licence MIT, page d'accueil, support, notes pour les relecteurs) avec le paquet et l'archive des sources.
2. Compléter ensuite la fiche à la main dans le Developer Hub (icône, captures, politique de confidentialité, e-mail de support) : voir [docs/store/amo.md](store/amo.md).
3. **Examen** : les versions *listed* passent une validation automatique puis, selon le cas, un examen humain (souvent quelques heures à quelques jours ; plus long pour un nouveau module ou un code minifié). Le relecteur reconstruit le paquet depuis l'archive des sources avec `BUILD.md` (`npm ci --ignore-scripts && npm run build:firefox`) : le build doit être identique, d'où le `.source-date-epoch` ajouté par `npm run package:source`.
4. Les redirections OAuth Firefox ne dépendent que de l'ID Gecko : aucune modification AniList/MAL après la publication (voir *Clients OAuth par navigateur*, section 4).

### Routine de release

Avant le tag : si les permissions ont changé depuis la version précédente (`git diff vPRÉCÉDENTE -- manifest.json docs/store/permissions.md`), coller les blocs modifiés de `docs/store/permissions.md` dans l'onglet **Confidentialité** du tableau de bord du Chrome Web Store et enregistrer. Sinon, la soumission Chrome est refusée alors qu'AMO a déjà reçu la version (voir *En cas d'échec*).

```bash
git checkout -b release/x.y.z develop
npm version x.y.z --no-git-tag-version   # package.json + package-lock.json
# monter "version" dans manifest.json, ajouter la section ## [x.y.z] et son lien au CHANGELOG.md
git commit -am "chore(release): x.y.z"
git checkout main && git merge --ff-only release/x.y.z
git tag -a vx.y.z -m "SyncKai x.y.z"
git checkout develop && git merge --ff-only main
git branch -d release/x.y.z
git push origin main develop vx.y.z      # déclenche release.yml : Chrome Web Store + AMO, puis release GitHub
```

Suivre l'exécution dans l'onglet **Actions** du dépôt. Le Chrome Web Store refuse un nouvel envoi tant qu'une version précédente est encore en cours d'examen ; AMO accepte une nouvelle version pendant l'examen de la précédente, mais refuse un numéro de version déjà envoyé.
