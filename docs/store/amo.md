# Fiche Firefox Add-ons (AMO)

Module : ID Gecko `synckai@sync-kai.github.io`, canal **listed**, licence MIT. Publication automatique : [docs/STORE.md](../STORE.md) › 7.

## Envoyé par le workflow

[`amo-metadata.json`](amo-metadata.json) est transmis à `web-ext sign --amo-metadata` (champs de l'[API AMO v5](https://mozilla.github.io/addons-server/topics/api/addons.html#create)) tant que le module n'est pas public :

| Champ | Contenu |
| --- | --- |
| `name`, `summary`, `description` | en-US, fr, de : description courte et détaillée de `listing-{en,fr,de}.md`, adaptées à Firefox (« notification du navigateur ») ; puces et intertitres convertis au [Markdown AMO](https://blog.mozilla.org/addons/2025/03/03/markdown/) (listes, gras) |
| `categories` | `games-entertainment` (Jeux et divertissement), `photos-music-videos` (Photos, musique et vidéos) : usage de loisir pendant le streaming, à l'image de la catégorie *Entertainment* du Chrome Web Store |
| `homepage`, `support_url` | dépôt GitHub, page des issues |
| `requires_payment` | `false` |
| `version.license` | `MIT` |
| `version.approval_notes` | instructions de build (`BUILD.md`) et de test pour les relecteurs ; envoyées à chaque version |

Une fois le module public, seul `version` est envoyé : les champs de fiche se modifient alors dans le Developer Hub (ou en changeant le fichier puis en le renvoyant à la main). Après une modification des textes `listing-*.md`, reporter les changements dans ce fichier pour garder les deux stores alignés.

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

- Le paquet est minifié par Vite : AMO exige les sources. Le workflow joint `release/synckai-<version>-source.zip` (`git archive` du tag + `.source-date-epoch`), à reconstruire avec `npm ci && npm run build:firefox` (voir `BUILD.md`).
- Le relecteur compare son build au paquet envoyé : les fichiers doivent être identiques (dépendances figées par `package-lock.json`, horodatage tiré de `.source-date-epoch`).
- Permissions de collecte (Firefox 140+) : `data_collection_permissions.required` = `websiteContent`, `websiteActivity` (ajoutées par le build Firefox, `src/build/manifest-target.ts`).
