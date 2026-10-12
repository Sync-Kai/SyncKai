# Privacy practices — Chrome Web Store dashboard

Answers for the **Privacy practices** tab, for the permissions declared in `manifest.json`. Copy each block into the matching field.

`scripts/store-permissions.test.ts` (run by `npx vitest run`, so by CI and by `release.yml`) fails when an entry of `permissions`, `optional_permissions`, `host_permissions` or `optional_host_permissions` has no section or table row here, when a section has no matching permission, when the host block does not name a host, or when a block exceeds 1000 characters. Whenever this file changes, paste the changed blocks into the dashboard **before** pushing the next tag, otherwise the Chrome Web Store refuses the submission (see `docs/STORE.md` › 7).

## Single purpose

```
SyncKai automatically updates the user's anime list on AniList and/or MyAnimeList with the episode they are watching on Crunchyroll, ADN (Animation Digital Network) or, if the user turns them on, Netflix and Disney+ (anime only). All features (episode detection, list of series in progress, companion side panel with the episode's entry and the week's releases, next-episode alerts, ratings, Crunchyroll, ADN and Netflix history import, backup) serve this single purpose: keeping the user's anime tracking list in sync with what they watch.
```

## Permission justifications

### storage

```
Stores the user's settings, the remembered matches between streaming series and AniList/MyAnimeList entries, excluded series, recent syncs, links to series pages the user visited on the streaming sites, the last AniList/MyAnimeList comparison and history import preview, the retry queue for failed syncs, the last 50 technical errors (redacted, no tokens or account names; only shared if the user copies the diagnostic report), and the AniList/MyAnimeList OAuth tokens, encrypted with AES-GCM (non-extractable key kept in the extension's IndexedDB, out of reach of content scripts). Everything is kept in chrome.storage.local on the user's device, except short-lived caches (the entry shown for the current page, the side panel data, Netflix and Disney+ series recognized as not anime) kept in chrome.storage.session, in memory and cleared when the browser closes. Nothing is sent to the developer.
```

### identity

```
Used only for chrome.identity.launchWebAuthFlow to let the user sign in to AniList (OAuth2) and MyAnimeList (OAuth2 + PKCE, no client secret). The redirect URL is the extension's chromiumapp.org URL. No Google account data is accessed.
```

### alarms

```
Alarms run by the service worker: (1) an hourly check of the AniList airing schedule for the series the user is watching, to notify new episodes (only when the user has turned alerts on) and refresh the week's release schedule shown in the side panel; (2) a retry alarm that re-sends syncs that failed for a transient reason (network, rate limit, server error), which only exists while the queue contains a pending item; (3) a resume alarm for a background task the user started (Crunchyroll, ADN or Netflix history import, AniList ↔ MyAnimeList comparison), which only exists while that task is running, so it resumes if the browser stops the service worker.
```

### notifications

```
Shows a Chrome notification when a new episode of a series the user is watching has aired (optional feature, "Notify me when an episode is out" in Settings). The notification has an "Open" button that opens the episode on the user's preferred platform.
```

### sidePanel

Chrome only: the Firefox build has no `sidePanel` permission (it declares a `sidebar_action` instead).

```
Shows SyncKai's companion side panel (episode being watched, release schedule) on Crunchyroll and ADN pages only (and on Netflix or Disney+ pages, only if the user has turned that platform on). The panel is disabled by default and enabled per tab only on those sites; it opens only when the user clicks "Open the side panel" in the popup. It reads no browsing data and sends nothing anywhere.
```

### scripting

```
Runs only SyncKai's own code, files of the extension package; no remote code is loaded. 1) When SyncKai is installed or updated, its Crunchyroll/ADN content script is run once with chrome.scripting.executeScript in Crunchyroll and ADN tabs that are already open, so the episode is still detected without reloading the tab. 2) Optional Netflix and Disney+ support, each only after the user turns it on in Settings and grants access to that site: the service worker registers SyncKai's two scripts for that site with chrome.scripting.registerContentScripts and runs them once in its open tabs (then and on update); turning it off or removing the access unregisters them. 3) Netflix history import, only when the user starts it: the import page runs one function of the package with executeScript in the user's Netflix tab (Viewing activity page) to read the rows, click that page's own "Show more" button until the end and get the playback positions of the anime found.
```

### Host permissions

Declared in `host_permissions` (exactly as in manifest.json):

| Host pattern | Justification |
|---|---|
| `*://*.crunchyroll.com/*` | Content script on Crunchyroll episode pages. Also lets it fetch `static.crunchyroll.com/skip-events/production/…`, the public JSON that gives the credits start time (same source the Crunchyroll player uses), to detect the end of an episode. On explicit request only (Settings › Import a watch history › Crunchyroll), the content script running in the user's own Crunchyroll tab reads their watch history from Crunchyroll's API (same origin, the site's own session) so the user can bring AniList/MyAnimeList up to date after a preview. To do so, it requests a short-lived token from Crunchyroll's token endpoint (`/auth/v1/token`) with the public client ID of Crunchyroll's own website, exactly as the site does, using the user's existing session cookie (no password, no secret); the token never leaves the tab and is never stored. The reduced history is kept in `chrome.storage.local` only during the analysis and erased once the preview is built, or if the analysis is stopped or fails. |
| `*://animationdigitalnetwork.com/*` | ADN adapter (also a content-script match). The host permission lets the import page find the user's open ADN tab by its URL (`chrome.tabs.query`): without it, Chrome hides the URL of tabs the extension may only script, and the ADN history import could not locate the tab. No request is made with it from the extension pages; the ADN history import runs in the ADN tab (see the content-script matches below). |
| `*://*.animationdigitalnetwork.com/*` | Same as above (`www.` and subdomains). |
| `https://graphql.anilist.co/*` | AniList GraphQL API: find the matching entry (public catalog, also used when only MyAnimeList is connected), read the user's list, save progress, rating, rewatch and the entry's comment, remove an anime from the list when the user asks (confirmed in the popup or the side panel), read the airing schedule for new-episode alerts. |
| `https://myanimelist.net/*` | MyAnimeList OAuth2 token endpoint (`/v1/oauth2/token`): exchange the authorization code and refresh the access token. |
| `https://api.myanimelist.net/*` | MyAnimeList REST API v2: read the user's list and profile, save progress, rating, rewatch status and the entry's comment, remove an anime from the list when the user asks (confirmed in the popup or the side panel). |

Declared in `optional_host_permissions` (requested at runtime, never at install):

| Host pattern | Justification |
|---|---|
| `*://*.netflix.com/*` | Optional Netflix support (anime only). Requested only when the user turns on Settings › Playback & sync › "Sync on Netflix", from that click; turning it off removes the access. On a Netflix player page, SyncKai reads the video being played (series title, season, episode number, credits start time) through Netflix's own episode metadata endpoint, same origin, from the user's own tab, plus the `<video>` element's playback position. No Netflix account or profile data is read or sent. Viewing history is read only when the user starts the Netflix history import (Settings › Import a watch history › Netflix), in their own tab on the Viewing activity page: SyncKai clicks that page's own "Show more" button until the end (never any other button), keeps only each line's title and video ID, looks the titles up on AniList to keep anime only (other titles are only counted), then requests, with the same metadata endpoint, the series of the anime found with the user's last playback position on each episode. Only episode numbers, runtimes and positions leave the tab, never account data, tokens or viewing dates. Only series linked to Netflix on AniList are synced; any other title is ignored silently. |
| `*://*.disneyplus.com/*` | Optional Disney+ support (Japanese anime only). Requested only when the user turns on Settings › Playback & sync › "Sync on Disney+", from that click; turning it off removes the access. On a Disney+ player page, a small script in the page passively reads the response of the request the Disney+ player itself sends for the current video (`…/explore/v1.x/playerExperience/{id}`), keeping only the title, season and episode number, original language, runtime and the video's identifiers. It never sends a request of its own and never reads headers, tokens, stream URLs or account data. The playback position is read from the player's progress bar. Titles whose original language is not Japanese are ignored without being sent anywhere; only series linked to Disney+ on AniList are synced. |


The dashboard has a single "Host permission justification" field (1000 characters max), covering both `host_permissions` and `optional_host_permissions`: paste this block.

```
crunchyroll.com, animationdigitalnetwork.com: detect the episode being played (page data, video element); Crunchyroll's public skip-events JSON gives the credits start. graphql.anilist.co: AniList API (match the series, save progress). myanimelist.net: MyAnimeList OAuth2 token endpoint. api.myanimelist.net: MyAnimeList API (read the list, save progress). netflix.com, disneyplus.com (optional, requested only when the user turns each on in Settings, removed when turned off): on a player page, read the video's title, season, episode number and playback position (Netflix: same-origin metadata request; Disney+: the player's own response). Only when the user starts a history import (Crunchyroll, ADN, Netflix): read their watch history in their own tab, with the site's session or token (never stored). No account data is read or sent. Only anime linked to the platform on AniList are synced. No other site is accessed.
```

### Content-script matches

| Pattern | Purpose |
|---|---|
| `*://*.crunchyroll.com/*` | Crunchyroll adapter (`src/content/content.ts`) |
| `*://animationdigitalnetwork.com/*` | ADN adapter. On explicit request only (Settings › Import a watch history › ADN), the content script in the user's own ADN tab reads their watch history from ADN's API (`gw.api.animationdigitalnetwork.com/viewing/history`), with the access token the ADN site keeps in its own page storage, exactly like the site's request (no cookies, same headers); the token never leaves the tab and is never stored. Only the episodes go to the import page; the reduced history is kept in `chrome.storage.local` only during the analysis, as for Crunchyroll. |
| `*://*.animationdigitalnetwork.com/*` | ADN adapter (subdomains) |

Netflix history import: no extra script is registered. Only when the user starts it, the import page runs one self-contained function of the package (`netflixTabOp`, `src/shared/netflix-import.ts`) with `chrome.scripting.executeScript` in the user's Netflix tab, in the extension's isolated world: it reads the Viewing activity rows (title and video ID), clicks that page's own "Show more" button, and asks the Netflix content script for a series' playback positions.

Netflix is **not** in `content_scripts`: its two scripts are registered at runtime (`chrome.scripting.registerContentScripts`, `*://*.netflix.com/*`) only once the user has granted the optional access:

| Script | World | Purpose |
|---|---|---|
| `src/content/netflix/content-netflix.iife.ts` | isolated | Netflix adapter: detects the episode and the end of the credits, shows on-page notifications. For the history import only, answers the import page's request for a series' playback positions (through the bridge below) |
| `src/content/netflix/page-bridge.iife.ts` | `MAIN` | Short bridge with no `chrome.*` API: fetches Netflix's metadata for the current video (`/nq/website/memberapi/release/metadata`, same origin) and returns only title, seasons, episode numbers and credits timing to the isolated script; for a history-import request only, also each episode's last playback position and Netflix's "watched to the end" mark (never the viewing date) |

Disney+ is **not** in `content_scripts` either: its two scripts are registered the same way (`*://*.disneyplus.com/*`) only once the user has granted that optional access:

| Script | World | Purpose |
|---|---|---|
| `src/content/disney/content-disney.iife.ts` | isolated | Disney+ adapter: identifies the episode (Japanese originals only), reads the playback position from the player's progress bar, shows on-page notifications |
| `src/content/disney/page-bridge.iife.ts` | `MAIN` | Passive observer with no `chrome.*` API, registered at `document_start`: reads the response of the Disney+ player's own `playerExperience` request (XMLHttpRequest) and passes only title, season/episode, original language, runtime and the video's identifiers to the isolated script. It sends no request and reads no header, token or stream URL |

`web_accessible_resources` has three entries in the built manifest (`dist/manifest.json`, `dist-firefox/manifest.json`), each limited to the sites where SyncKai runs a content script:

| Matches | Resources | Origin |
|---|---|---|
| `*://*.netflix.com/*` | the two Netflix scripts above (`src/content/netflix/*.iife.js`) | `manifest.json` (`<dynamic_resource>`, filled in at build time, then split per platform by `vite.config.ts`) |
| `*://*.disneyplus.com/*` | the two Disney+ scripts above (`src/content/disney/*.iife.js`) | same |
| `*://*.crunchyroll.com/*`, `*://animationdigitalnetwork.com/*`, `*://*.animationdigitalnetwork.com/*` | the chunks of the main content script (`assets/*.js`) | added by `@crxjs/vite-plugin`: the content script declared in the manifest is a small loader that imports the bundled script as an ES module (`import(chrome.runtime.getURL(…))`) |

All entries expose only the extension's own code, never user data. In the Chrome build they use a fixed URL (`use_dynamic_url: false`): a page on those sites can request one of these files at `chrome-extension://khokcmigioggannjoojambdgioigdceb/…` and so tell that SyncKai is installed. Firefox serves them from a `moz-extension://` UUID drawn at random for each installation.

The content script runs on these sites only. It reads the current episode page (series title, season, episode number and title, platform episode/series ID from the URL and JSON-LD) and listens to the `<video>` element's playback progress to detect the end of the episode. It also displays SyncKai's on-page notifications. It does not read anything else on the page and does not run on any other site.

## Remote code

**Are you using remote code? → No**

```
No. All JavaScript is bundled in the extension package. The extension only fetches JSON data (AniList GraphQL, MyAnimeList REST, Crunchyroll skip-events, the user's Crunchyroll or ADN watch history only when they start a history import, Netflix episode metadata when the user has turned Netflix on, and, for a Netflix history import they start, the rows of their Viewing activity page loaded by that page's own "Show more" button); on Disney+, when turned on, it only reads the response of the player's own request, without sending any. It never loads or evaluates remote scripts. The optional Netflix and Disney+ scripts are files of the package, registered with chrome.scripting.
```

## Data usage disclosure

"What user data do you plan to collect from users now or in the future?"

| Category | Check? | Details |
|---|---|---|
| Personally identifiable information | No | No name, email, address or ID is requested. The AniList/MAL username and avatar returned by those services are only cached locally to display the connected account. |
| Health information | No | — |
| Financial and payment information | No | — |
| **Authentication information** | **Yes** | AniList and MyAnimeList OAuth access tokens (and MAL refresh token), obtained via `chrome.identity`, stored encrypted (AES-GCM) in `chrome.storage.local` on the device and sent only to AniList / MyAnimeList to authorize API calls. No password is ever seen by the extension. |
| Personal communications | No | — |
| Location | No | — |
| **Web history** | **Yes (conservative)** | Not browsing history: the extension never reads history or pages outside Crunchyroll/ADN (and Netflix or Disney+ player pages, only if the user turns that platform on). It keeps a local list of recently synced episodes (title, episode, platform link) and sends the watched episode's progress to the user's own AniList/MAL list. Only when the user starts a history import, it reads their Crunchyroll, ADN or Netflix watch history in their own tab of that site to update their lists (Netflix: anime only, other titles are only counted) (the reduced history is kept only until the analysis ends; afterwards only the import preview is kept). Checked so the disclosure covers these records of watched episodes. |
| User activity | No | Only the video's playback position on the episode page is checked to detect the credits; no clicks, keystrokes or scroll are recorded. |
| **Website content** | **Yes** | Reads the current episode page on Crunchyroll/ADN only (series title, season, episode number and title from JSON-LD / page heading), and on Netflix or Disney+ only if the user turns them on (title, season and episode number of the video being played). On explicit request (history import), the user's Crunchyroll, ADN or Netflix watch history, read in their own tab (Netflix: Viewing activity page and the playback positions of the anime found). |

Suggested justification text (if a free-text field is shown):

```
SyncKai reads the current episode page on Crunchyroll or ADN, and on Netflix or Disney+ only if the user turns them on (series title, season, episode number), and sends the watched episode to the user's own AniList and/or MyAnimeList list (and, only when the user starts a history import, reads their Crunchyroll, ADN or Netflix watch history in their own tab to bring those lists up to date), using OAuth tokens the user grants via chrome.identity. Tokens, settings and history are stored only in chrome.storage.local on the user's device. SyncKai has no server: no data is sent to the developer or to any third party other than AniList and MyAnimeList.
```

### Certifications (check all three)

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases. — Data only goes to AniList / MyAnimeList, at the user's request, to perform the sync (the extension's single purpose).
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

### Privacy policy URL

Required because user data is disclosed. `https://github.com/Sync-Kai/SyncKai/blob/main/PRIVACY.md` (English reference with French and German translations, kept in sync with this file).
