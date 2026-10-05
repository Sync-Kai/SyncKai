# Publication sur le Chrome Web Store

Procédure pas à pas pour publier SyncKai (première soumission puis mises à jour).

## 1. Générer l'archive

```bash
npm run package
```

Produit `release/synckai-<version>.zip` (contenu de `dist/` à la racine). Le script :

- vérifie que la version de `dist/manifest.json` = version de `package.json` ;
- **retire le champ `key`** du manifest (le Web Store le refuse : l'ID est attribué par le store) ;
- refuse l'archive si `dist/` contient des source maps (`*.map`), un fichier > 10 Mo, ou s'il manque `_locales/{en,fr,de}/messages.json`.

## 2. Premier dépôt (brouillon non répertorié)

1. Ouvrir le [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (frais d'inscription uniques de 5 $ si le compte n'est pas encore activé).
2. **New item** → déposer `release/synckai-<version>.zip`.
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

## 7. Publication automatique (GitHub Actions)

### Workflows

- **`.github/workflows/ci.yml`** : à chaque push sur `main`/`develop` et sur chaque pull request, vérifie les types (`src` et `scripts`), lance les tests et le build.
- **`.github/workflows/release.yml`** : à chaque tag `vx.y.z` poussé :
  1. vérifie que la version du tag = `package.json` = `manifest.json` ;
  2. tests, puis `npm run package` → `release/synckai-<version>.zip` ;
  3. envoie l'archive au Chrome Web Store et la **soumet pour examen** (`chrome-webstore-upload-cli`) : la version est mise en ligne automatiquement dès sa validation, sans action manuelle ;
  4. crée la release GitHub avec le zip et les notes extraites du `CHANGELOG.md` (`scripts/changelog-notes.ts`).

Le Store passe avant la release GitHub : en cas d'échec, aucune release n'annonce une version absente du Store. Après correction, supprimer le tag (`git push --delete origin vx.y.z`, `git tag -d vx.y.z`), le recréer et le repousser. Si l'envoi au Store a réussi mais pas la release GitHub, la créer à la main (`gh release create`) : relancer le workflow échouerait, le Store refusant une version déjà envoyée.

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

   Le workflow échoue avec un message explicite si l'un d'eux manque. L'ID de l'extension est une constante publique du workflow.

### Routine de release

```bash
git checkout -b release/x.y.z develop
npm version x.y.z --no-git-tag-version   # package.json + package-lock.json
# monter "version" dans manifest.json, ajouter la section ## [x.y.z] et son lien au CHANGELOG.md
git commit -am "chore(release): x.y.z"
git checkout main && git merge --ff-only release/x.y.z
git tag -a vx.y.z -m "SyncKai x.y.z"
git checkout develop && git merge --ff-only main
git branch -d release/x.y.z
git push origin main develop vx.y.z      # déclenche release.yml : Store puis release GitHub
```

Suivre l'exécution dans l'onglet **Actions** du dépôt. Le Store refuse un nouvel envoi tant qu'une version précédente est encore en cours d'examen.
