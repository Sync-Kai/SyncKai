# Fiche Firefox Add-ons (AMO)

Module : ID Gecko `synckai@sync-kai.github.io`, canal **listed**, licence MIT. Publication automatique : [docs/STORE.md](../STORE.md) › 7.

## Envoyé par le workflow

[`amo-metadata.json`](amo-metadata.json) est transmis à `web-ext sign --amo-metadata` (champs de l'[API AMO v5](https://mozilla.github.io/addons-server/topics/api/addons.html#create)) tant que le module n'est pas public :

| Champ | Contenu |
| --- | --- |
| `name`, `summary`, `description` | en-US, fr, de : description courte (Netflix en option ajouté, limite AMO de 250 caractères) et détaillée de `listing-{en,fr,de}.md`, adaptées à Firefox (« notification du navigateur ») ; puces et intertitres convertis au [Markdown AMO](https://blog.mozilla.org/addons/2025/03/03/markdown/) (listes, gras) |
| `categories` | `games-entertainment` (Jeux et divertissement), `photos-music-videos` (Photos, musique et vidéos) : usage de loisir pendant le streaming, à l'image de la catégorie *Entertainment* du Chrome Web Store |
| `homepage`, `support_url` | dépôt GitHub, page des issues |
| `requires_payment` | `false` |
| `version.license` | `MIT` |
| `version.approval_notes` | instructions de build (`BUILD.md`, `npm ci --ignore-scripts`) et de test, hôtes contactés (tableau « Connexions réseau » de `PRIVACY.md`), Netflix et `web_accessible_resources` pour les relecteurs ; envoyées à chaque version |

Tant que le module n'est pas public (examen de la première version en cours), la fiche complète repart avec chaque version : elle doit rester à jour. Une fois le module public, seul `version` est envoyé : les champs de fiche se modifient alors dans le Developer Hub (ou en changeant le fichier puis en le renvoyant à la main). Après une modification des textes `listing-*.md`, reporter les changements dans ce fichier pour garder les deux stores alignés.

## À compléter à la main (Developer Hub)

Après la première soumission : [Developer Hub](https://addons.mozilla.org/developers/addons) › SyncKai › **Edit Product Page**.

| Champ | Valeur |
| --- | --- |
| *Icon* | `docs/store/icon-128.png` (ou l'icône du manifest, reprise par défaut) |
| *Screenshots* | `docs/store/screenshots/<langue>/0N-*.png` (1280×800, ordre 01 → 05) ; AMO n'a qu'une série de captures, partagée par toutes les langues : utiliser la série `en/` |
| *Support email* | adresse de contact du compte développeur (facultatif, `support_url` suffit) |
| *Privacy Policy* | *Manage Privacy Policy* : SyncKai ne collecte rien côté serveur, mais coller le contenu de [PRIVACY.md](https://github.com/Sync-Kai/SyncKai/blob/main/PRIVACY.md) (ou un lien vers cette page) évite les questions des relecteurs |
| *Tags* | facultatif : `anime`, `anilist`, `myanimelist`, `crunchyroll` |

Les tuiles promo du Chrome Web Store n'ont pas d'équivalent sur AMO.

## Examen et code source

- Le paquet est minifié par Vite : AMO exige les sources. Le workflow joint `release/synckai-<version>-source.zip` (`git archive` du tag + `.source-date-epoch`), à reconstruire avec `npm ci --ignore-scripts && npm run build:firefox` (voir `BUILD.md` : sans `--ignore-scripts`, le postinstall de `puppeteer` télécharge Chrome).
- Le relecteur compare son build au paquet envoyé : les fichiers doivent être identiques (dépendances figées par `package-lock.json`, horodatage tiré de `.source-date-epoch`).
- **Netflix (2.1.0)** : à signaler au relecteur (paragraphe ajouté à `version.approval_notes`, envoyé à chaque version) :
  - accès `*://*.netflix.com/*` dans `optional_host_permissions` : demandé seulement quand l'utilisateur active « Synchroniser sur Netflix » (Réglages › Lecture & synchro), retiré à la désactivation ;
  - permission `scripting` : enregistre (`registerContentScripts`) les deux scripts Netflix du paquet après cet accord, et les exécute une fois dans les onglets Netflix déjà ouverts ; aucun script distant, aucun `eval` ;
  - script du monde `MAIN` (`src/content/netflix/page-bridge.iife.ts`) court et lisible, sans API `browser.*` : il interroge l'API de métadonnées de Netflix (même origine) et ne renvoie que titre, saisons, numéros d'épisode et générique (`reduceNetflixMetadata`) ;
  - `web_accessible_resources` : les scripts Netflix pour `*://*.netflix.com/*` seulement ; une seconde entrée, ajoutée par `@crxjs/vite-plugin`, expose les morceaux du script de contenu principal (`assets/*.js`) aux seuls sites Crunchyroll et ADN (voir `permissions.md` › Content-script matches) ;
  - `data_collection_permissions` inchangées : les données lues sur Netflix restent du contenu de page (`websiteContent`) et de l'activité de lecture (`websiteActivity`).
- Permissions de collecte (Firefox 142+ requis par AMO) : `data_collection_permissions.required` = `websiteContent`, `websiteActivity` (ajoutées par le build Firefox, `src/build/manifest-target.ts`).
