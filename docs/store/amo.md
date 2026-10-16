# Firefox Add-ons (AMO) listing

Add-on: Gecko ID `synckai@sync-kai.github.io`, **listed** channel, MIT license. Automated publishing: [docs/STORE.md](../STORE.md) › 7.

## Sent by the workflow

[`amo-metadata.json`](amo-metadata.json) is passed to `web-ext sign --amo-metadata` (fields of the [AMO API v5](https://mozilla.github.io/addons-server/topics/api/addons.html#create)) as long as the add-on is not public:

| Field | Content |
| --- | --- |
| `name`, `summary`, `description` | en-US, fr, de: short description (optional Netflix added, AMO limit of 250 characters) and detailed description from `listing-{en,fr,de}.md`, adapted to Firefox ("browser notification"); bullets and subheadings converted to [AMO Markdown](https://blog.mozilla.org/addons/2025/03/03/markdown/) (lists, bold) |
| `categories` | `games-entertainment` (Games & Entertainment), `photos-music-videos` (Photos, Music & Videos): leisure use while streaming, like the *Entertainment* category of the Chrome Web Store |
| `homepage`, `support_url` | GitHub repository, issues page |
| `requires_payment` | `false` |
| `version.license` | `MIT` |
| `version.approval_notes` | build (`BUILD.md`, `npm ci --ignore-scripts`) and test instructions, contacted hosts ("Network connections" table in `PRIVACY.md`), Netflix, Disney+, Prime Video and `web_accessible_resources` for the reviewers; sent with every version |

As long as the add-on is not public (first version still under review), the full listing is sent again with every version: it must stay up to date. Once the add-on is public, only `version` is sent: the listing fields are then edited in the Developer Hub (or by changing the file and sending it again by hand). After changing the `listing-*.md` texts, carry the changes over to this file to keep both stores aligned.

## To complete by hand (Developer Hub)

After the first submission: [Developer Hub](https://addons.mozilla.org/developers/addons) › SyncKai › **Edit Product Page**.

| Field | Value |
| --- | --- |
| *Icon* | `docs/store/icon-128.png` (or the manifest icon, used by default) |
| *Screenshots* | `docs/store/screenshots/<language>/0N-*.png` (1280×800, order 01 → 05); AMO has a single set of screenshots, shared by all languages: use the `en/` set |
| *Support email* | contact address of the developer account (optional, `support_url` is enough) |
| *Privacy Policy* | *Manage Privacy Policy*: SyncKai collects nothing server-side, but pasting the content of [PRIVACY.md](https://github.com/Sync-Kai/SyncKai/blob/main/PRIVACY.md) (or a link to that page) heads off reviewer questions |
| *Tags* | optional: `anime`, `anilist`, `myanimelist`, `crunchyroll` |

The Chrome Web Store promo tiles have no equivalent on AMO.

## Review and source code

- The package is minified by Vite: AMO requires the sources. The workflow attaches `release/synckai-<version>-source.zip` (`git archive` of the tag + `.source-date-epoch`), to be rebuilt with `npm ci --ignore-scripts && npm run build:firefox` (see `BUILD.md`: without `--ignore-scripts`, the `puppeteer` postinstall downloads Chrome).
- The reviewer compares their build with the uploaded package: the files must be identical (dependencies locked by `package-lock.json`, timestamp taken from `.source-date-epoch`, file names independent of the build folder). `release.yml` checks this before every upload: source archive extracted to another folder, build without `SOURCE_DATE_EPOCH`, `diff -r` against the Firefox archive; any difference blocks the upload.
- **Netflix (2.1.0)**: to point out to the reviewer (paragraph added to `version.approval_notes`, sent with every version):
  - `https://*.netflix.com/*` access in `optional_host_permissions`: requested only when the user turns on "Sync on Netflix" (Settings › Playback & sync), removed when it is turned off;
  - `scripting` permission: registers (`registerContentScripts`) the package's two Netflix scripts after that consent, and runs them once in Netflix tabs that are already open; no remote script, no `eval`;
  - `MAIN` world script (`src/content/netflix/page-bridge.iife.ts`), short and readable, with no `browser.*` API: it queries Netflix's metadata API (same origin) and only returns title, seasons, episode numbers and credits (`reduceNetflixMetadata`);
  - `web_accessible_resources`: the Netflix scripts for `https://*.netflix.com/*` only (the Crunchyroll and ADN scripts are self-contained and expose nothing, see `permissions.md` › Content-script matches); every host pattern is `https://` only;
  - `data_collection_permissions` unchanged: the data read on Netflix remains page content (`websiteContent`) and playback activity (`websiteActivity`).
- **Disney+ (unreleased)**: same mechanism, also pointed out in `version.approval_notes`:
  - `https://*.disneyplus.com/*` in `optional_host_permissions`, requested only by "Sync on Disney+" (Settings › Playback & sync), removed when turned off; two scripts registered after that consent and run once in open Disney+ tabs;
  - `MAIN` world script (`src/content/disney/page-bridge.iife.ts`, `document_start`, no `browser.*` API, no `eval`): a passive observer that wraps `XMLHttpRequest.open/send` (and `fetch`) only to read the response of the player's own `…/explore/v1.x/playerExperience/{id}` request; it issues no request and reads no header, token or stream URL, and only passes title, season/episode, original language, runtime and the video's identifiers (incl. the episode id decoded from `infoBlock`) to the isolated script;
  - `web_accessible_resources`: each platform's two scripts for its own pattern only (split per platform at build time by `splitRegisteredScripts`, `src/build/output-names.ts`);
  - `data_collection_permissions` unchanged (`websiteContent`, `websiteActivity`).
- **Prime Video (unreleased)**: same mechanism as Disney+, in the same `version.approval_notes` paragraph (the notes are at 2996 of 3000 characters: shorten another paragraph before adding anything):
  - `https://*.primevideo.com/*` in `optional_host_permissions` (primevideo.com only, never the amazon.<tld> sites), requested only by "Sync on Prime Video" (Settings › Playback & sync), removed when turned off; two scripts (`src/content/prime/`) registered after that consent and run once in open Prime Video tabs;
  - `MAIN` world script (`src/content/prime/page-bridge.iife.ts`, `document_start`, no `browser.*` API, no `eval`): a passive observer of the site's own responses (title page data, the player's catalog metadata, and from its playback resources only the end-credits time and the total duration); it issues no request and reads no header, cookie, token, stream URL or licence;
  - anime only: titles Prime Video does not list as animation are dropped in the isolated script, before anything leaves the page;
  - `data_collection_permissions` unchanged (`websiteContent`, `websiteActivity`).
- **Crunchyroll page bridge (unreleased, `feature/match-signals`)**: in the same `version.approval_notes` paragraph:
  - `MAIN` world script declared in the manifest (`content_scripts`, `world: "MAIN"`, `document_start`, Firefox 128+; the add-on requires 142), for `https://*.crunchyroll.com/*` only, so no new permission: `src/content/crunchyroll/page-bridge.iife.ts`, no `browser.*` API, no `eval`;
  - passive: it reads the JSON bodies of the site's own `content/v2/cms/series/{id}`, `…/seasons`, `cms/seasons/{id}/episodes` and `discover/up_next/{id}` requests, never their headers (they carry the user's Crunchyroll token), cookies, account ids or stream URLs, and passes the isolated script only per-season matching signals (years, episode counts, runtimes, country) over a private `MessageChannel`;
  - `data_collection_permissions` unchanged (`websiteContent`).
- Data collection permissions (Firefox 142+ required by AMO): `data_collection_permissions.required` = `websiteContent`, `websiteActivity` (added by the Firefox build, `src/build/manifest-target.ts`).
