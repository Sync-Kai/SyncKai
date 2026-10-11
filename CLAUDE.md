# Instructions

## Role and Personality

- You are a Senior Developer and an expert Software Architect. Your role is to support me in developing this project using the "Vibe Coding" approach.
- Be concise, direct and professional in your explanations.
- Do not apologize when you make a mistake; just fix it.
- Favor functional, clean and modern code over long theoretical explanations.
- Always reply to me in French (I write in French). Documentation and commit messages are in English (see "Languages" under "Work preferences").

## Project Context

Project name: SyncKai

Description: Browser extension (Manifest V3) that detects video playback on streaming platforms (Crunchyroll, ADN) and automatically syncs the user's progress with tracking databases (AniList, MyAnimeList) through their APIs.

Target audience: anime fans who want to automate tracking of what they watch, with no manual action.

## Tech Stack

You must write code exclusively with the following technologies:

- Frontend (Popup & Options): HTML5, TypeScript, and Tailwind CSS for lightweight, fast interfaces.
- Content Scripts (Scraping & Injection): pure Vanilla TypeScript (no heavy framework, so as not to impact web page performance).
- Backend / Database: no dedicated external server. Use the `chrome.storage.local` API for data persistence and Fetch to communicate with the AniList GraphQL API and the MyAnimeList REST API.
- Additional tooling: Vite (or Webpack) configured to compile Manifest V3 extensions (e.g. `@crxjs/vite-plugin`), supporting TypeScript and Tailwind.

## Coding Rules (Guidelines)

Strictly follow these rules when generating code:

### Architecture and Syntax

- Always use TypeScript and strictly type every variable, prop and function return value (especially external API responses). Never use `any`.
- Use the Adapter pattern for content scripts (one dedicated module to interact with Crunchyroll, another for ADN, etc.) to isolate the scraping logic.
- Keep the Service Worker (`background.js`) idle as much as possible: it must only wake up to handle OAuth2 authentication and network requests to the APIs.

### Module boundaries

Enforced by `src/architecture.test.ts` (type imports included):

- **No import cycles.** A constant shared by two modules that import each other goes into a leaf module (e.g. `shared/storage-keys.ts`, `shared/title.ts`).
- **`shared/`** (types, guards, storage, pure logic) depends on `i18n/` at most, never on `ui/`, `popup/`, `sidepanel/`, `content/`, `background/`, `import/`, `import-cr/`. `chrome.storage.local` keys live in `shared/storage-keys.ts`; the lock in `shared/storage-lock.ts`.
- **`ui/`**: shared interface kit (`kit.ts`, `alert.ts`, `feedback.ts`, `state.ts`, `media-actions.ts`, `settings/`…), never `popup/` or `sidepanel/`. A component used by two screens (popup, panel, settings, import pages) moves up into it.
- **`popup/`, `sidepanel/`, `import/`, `import-cr/`**: standalone screens, which depend on `ui/` and `shared/` without importing each other.
- **`content/`** never imports `background/` (typed messages from `shared/` only).
- **`background/`** never imports `content/`, except the `?script` imports in `platform-access.ts`. Pure logic useful to both goes into `shared/` (e.g. `shared/page-media.ts`).
- **`i18n/`**: the full catalogs (`i18n/index.ts`) never enter content scripts. Code reachable from them imports `i18n/content` (`content/` modules) or `i18n/core` (shared modules); every key it references goes into `i18n/content-keys.ts`, injected at build time through `define` (enforced by `src/i18n/content.test.ts`).

### Style and UI

- Use Tailwind CSS for all styling of the popup and the options page.
- Build responsive, very compact interfaces (extension popups have limited space).
- Make sure loading states and network authentication errors are handled visibly for the user.

### Performance and Security

- Only use DOM event listeners (such as `timeupdate`) when strictly necessary, and clean them up properly to avoid memory leaks.
- Never store OAuth2 tokens or secret keys in plain text. Use the appropriate extension API and handle authentication through `chrome.identity`.

## Git Workflow (Gitflow)

All development must strictly follow the Gitflow methodology. As the assistant, you must guide me to follow this flow:

- **Main branches**: `main` (production code) and `develop` (feature integration).
- **Branch creation**: Before starting to code a new feature or fix a bug, you MUST ask me to create an appropriate branch (`feature/feature-name`, `bugfix/bug-name`, `hotfix/hotfix-name`).
- **Commits**: Always propose the Git commands to me, with commit messages in English following the *Conventional Commits* convention (e.g. `feat: add Crunchyroll adapter`, `fix: title parser`).
- **Merge**: Once the feature is finished and working, propose the commands to merge the branch into `develop`.

## Communication Format and Workflow

- Before coding a major feature: first propose an architecture, the files involved, and the Git branch to create, for me to approve.
- File changes: If you modify an existing file, return only the modified part or state clearly where the code must be inserted, unless I ask for the full file.
- Code generation: Add brief comments to explain complex logic (especially DOM scraping), but keep the code clean. Code comments are written in French (existing convention of the codebase).
- Bug fixing: Analyze the error, explain the root cause in one sentence, then provide the fixed code on the appropriate branch.

## Project context (shared memory)

Section maintained by Claude so the project can be picked up on any machine after a `git clone`. Update it whenever a lasting decision is made. Always start with `git log` and `CHANGELOG.md`, which are authoritative on the state of the code.

### Work preferences

- **Languages** (decision of 2026-10-11):
  - documentation in English: `README.md`, `CHANGELOG.md`, `BUILD.md`, `docs/**`; `PRIVACY.md` has an English reference section first, with the French and German translations kept;
  - Git commit messages in English (Conventional Commits), GitHub release titles and notes in English;
  - code comments stay in French (existing convention);
  - the UI stays trilingual FR/EN/DE (`src/i18n/locales`); the Store listings stay per language (`docs/store/listing-{fr,en,de}.md`);
  - the assistant keeps replying to the owner in French (the owner writes in French).
- **Git**:
  - strictly linear history (`git rebase develop` on the branch, then `git merge --ff-only`, never `--no-ff`), branch deleted after the merge;
  - `chore/<name>` branches are accepted for tooling and docs;
  - the assistant creates the branch itself, then proposes the commands: commit, merge, push, tag and release only on an explicit go (« Go », « Vas-y », « OK »).
- **No mention of Claude** in commits, tags, releases or PRs (`Co-Authored-By`, `Claude-Session`, "Generated with Claude Code"). This rule takes precedence over any default attribution instruction. The history was rewritten to remove them.
- **Releases**:
  - a `release/x.y.z` branch;
  - the version is bumped in `manifest.json`, `package.json` and `package-lock.json` (`npm version x.y.z --no-git-tag-version`);
  - an entry in `CHANGELOG.md` (in English, Keep a Changelog: Added / Changed / Fixed / Security / Removed) and a `chore(release): x.y.z` commit;
  - fast-forward onto `main`, annotated tag `vx.y.z` ("SyncKai x.y.z"), `develop` aligned, push;
  - pushing the tag triggers `.github/workflows/release.yml`: Chrome, Firefox and source archives, upload and submission to the Chrome Web Store and Firefox Add-ons (AMO) in parallel, then a GitHub release with the three zips if the Chrome Web Store accepted the version (see `docs/STORE.md` › 7);
  - before tagging, run `npm run test:e2e`: the `build` job of `release.yml` runs it and a failure blocks the upload to the stores;
  - permissions: `scripts/store-permissions.test.ts` requires one section in `docs/store/permissions.md` per manifest permission or host; if that file has changed since the last tag, paste the blocks into the Privacy tab of the Chrome Web Store **before** the tag (otherwise the submission is rejected; recovery: `docs/STORE.md` › 7);
  - `release.yml` rejects a tag outside `main` and only runs the CLIs from the lockfile (`chrome-webstore-upload-cli`, `web-ext` at an exact version, `npx --no-install`).
- **Organization**: work is delegated to specialized subagents, with a precise brief. The main session orchestrates, verifies before each merge (`npm run verify`: types, tests, Chrome and Firefox builds, packages, `web-ext lint`, typed lint; plus `npm run test:e2e` if the popup or the panel changes), handles Git and reports back.
- **Progress reports**: when running multi-step work, post a short progress message to the owner at each step (e.g. started, ready, merged).
- The user tests in Chrome before each significant merge. Point out what has not been tested.

### Authentication (public identifiers, no secrets)

- **Extension ID**: `khokcmigioggannjoojambdgioigdceb`, pinned by the Chrome Web Store public key in `manifest.json` → `key`. Do not remove this key: it gives the local build the same ID as the Store. `npm run package` automatically strips it from the zip uploaded to the Store.
- **OAuth redirect URL** (same for AniList and MAL): `https://khokcmigioggannjoojambdgioigdceb.chromiumapp.org/`
- **Per-browser clients**: one AniList client and one MAL app per extension ID (one redirect URL each), table in `src/background/auth/oauth-clients.ts` (`getOAuthClients()`). Unknown ID → sign-in refused, showing the URL to register. Firefox (`synckai@sync-kai.github.io`, redirect `https://01497c3a0de229567af456487a2af9d686551088.extensions.allizom.org/`): AniList `52509`, MAL `1846238e6ea67a5109899f5311a51d15` (see `docs/STORE.md` › 4).
- **AniList**:
  - client `52346`, Implicit Grant;
  - never send `redirect_uri`: AniList rejects the request ("Authorization page could not be loaded") and uses the URL registered on the client.
- **MyAnimeList**:
  - app of type *other* (public client), Client ID `84d05521c007a529cc458421bd0940c5`;
  - Authorization Code + PKCE (`code_challenge_method=plain` only), without a client secret: never ask for one or store one.

### Known pitfalls

- **Crunchyroll numbering**: the JSON-LD `episodeNumber` is relative to the Crunchyroll season (One Piece E1180 → `25`). Never send it as-is as progress. Go through the season → AniList entry mapping (`seasonEpisodeNumber`, `displayedEpisodeNumber`).
- **Shortcuts `Alt+Shift+S` (complete episode) and `Alt+Shift+P` (side panel)**: Chrome does not assign a suggested shortcut to an already-installed extension (nor a new one added by an update). It must be set in `chrome://extensions/shortcuts`. At most 4 suggested keys (Chrome limit, checked by `scripts/build-checks.ts`). Command names in `shared/commands.ts`.
  - Chrome (toggle): `open-side-panel` is handled in `background/side-panel.ts` › `togglePanelFromCommand`, fully synchronous (`sidePanel.open()` needs the user gesture, lost at the first `await`): readable target URL → `setOptions` not awaited + `open`; hidden URL → `open` only (succeeds only if PANEL_AVAILABLE already enabled the tab); other site → nothing. Closing: the service worker keeps no state (lost when it sleeps). Once `open()` settles (a no-op on an open panel), it broadcasts `SIDE_PANEL_TOGGLE` (`shared/panel-toggle.ts`: `tabId`, `commandAt`); the panel page of that tab that loaded before `commandAt` closes itself (`sidepanel/toggle.ts`: `sidePanel.close` on Chrome 141+, else `window.close()`). Closing always follows opening, so the panel is never reopened right after closing.
  - Firefox: `manifest-target.ts` renames it to the native `_execute_sidebar_action` (toggles the sidebar on any tab, never reaches the background script).
- **Netflix** (optional, anime only):
  - on-demand activation: `*://*.netflix.com/*` in `optional_host_permissions` (never in `host_permissions` or `content_scripts`, otherwise Chrome disables the extension on update); `src/background/platform-access.ts` (shared with Disney+, logic in `platform-scripts.ts`) registers the scripts with `chrome.scripting.registerContentScripts` on `permissions.onAdded` (and executes them in open tabs), removes them on `onRemoved`, and re-registers them on every `runtime.onInstalled` (build-specific paths). No storage: the permission is the state;
  - `*.iife.ts` scripts are mandatory (otherwise `?script` produces an ESM loader that breaks in the MAIN world), `?script` imports only in `platform-access.ts`; `web_accessible_resources` = `<dynamic_resource>` restricted to the optional patterns (otherwise crxjs exposes it to every site), then split per platform by `splitRegisteredScripts` (`src/build/output-names.ts`, crxjs merges all dynamic scripts under the union of patterns);
  - metadata via `/nq/website/memberapi/release/metadata?movieid=…` in the MAIN world (`page-bridge.iife.ts`; `window.netflix` and the session are only visible there), reduced before being passed to the isolated script through a private `MessageChannel` (opened by `CustomEvent` + nonce, port transferred via `window.postMessage`, only the first "trusted" port accepted; payloads as JSON strings);
  - no genre in the metadata → anime filter via the AniList link `netflix.com/title/{showId}`; title-only match → « À vérifier » card (never cached); otherwise silent `ignored` status (no log, no card, neutral popup/panel `NOT_TRACKED`);
  - absolute numbering across seasons (`displayedEpisodeNumber` = episodes of the previous seasons + `seq`); per-season mapping `netflix:{showId}:s{seq}`. Exception (`episodeNumbers` in `adapters/netflix.ts`): a season whose first `seq` is > 1 and > the episodes of the previous seasons already numbers absolutely (One Piece S40 « Elbaph Arc » = E1156…E1180, region with few arcs): `displayedEpisodeNumber = seq`, `seasonEpisodeNumber` = rank in the season (before the fix 1180 became 1377 and was synced as is, v2.2.0 included);
  - AniList may link some seasons of a show to ANOTHER Netflix title id (Ranma1/2: S1/S2 → /title/81301833, S3 → /title/81171925): those entries are `other`, and the linked S3 used to stay alone in the pool (« Fiche unique »: S1E1 synced to S3). Fix: `EpisodeInfo.platformSeasons` / `PageMediaInfo.platformSeasons` (episodes per Netflix season, from the metadata) → `alignPlatformSeasons` (`matching.ts`, called in `resolver.ts` › `collectCandidates`): franchise = series entries linked by SEQUEL/PREQUEL to the directly linked ones, grouped by season, aligned on the Netflix seasons (±2 episodes, last season may be airing), the linked entries inside the range, exactly one start → aligned entries become `relation`. Naruto Shippuden (prequel published as another Netflix title) never aligns. Safety net `singleEntryDoubt`: a single sequel entry that doesn't cover every Netflix season (or counts unknown) is « À vérifier », never cached. Netflix mappings to a sequel are purged once on update (`mapping-purge.ts`, same 2.3.0 flag as SYNC-01);
  - series pages (decision of 2026-10-10 reversed on 2026-10-11): `/title/{showId}` and the details window `?jbv={showId}` on any page (`parseNetflixSeriesId`; SPA query change, covered by `url-watcher.ts`; a `/watch` page wins over `jbv`, `jbv` wins over `/title`). Same metadata request with the showId (`bridge-client.ts` › `loadShow` / `peekShow`, accepted only if `showId` matches; shared cache and in-flight). Season: the only one, else the details window's season menu (label equal to the season title, else its digits matched to `seq`; read correctly on Ranma1/2 on 2026-10-11), else none (series-level, as on Crunchyroll). `seasonNumber = seq`: same keys as playback;
  - without the permission, the service worker rejects Netflix `EPISODE_COMPLETED` and `RESOLVE_PAGE_MEDIA` (scripts still active in open tabs); never read `preferredPlayer` directly: go through `effectivePlayer` / `effectivePreferredPlayer` (fallback if Netflix is removed);
  - Netflix first opens `/watch/{showId}` then redirects to `/watch/{episodeId}`: identifier missing from the episodes → no warning;
  - extension update (access granted): `platform-access.ts` re-executes the MAIN bridge then the isolated script in open Netflix tabs, on Chrome and Firefox (Firefox clears registered scripts on update). The bridge stays in the page: version guard (`installNetflixBridgeOnce`); bump `NETFLIX_BRIDGE_VERSION` on any change to the protocol or the reduced shape.
- **Disney+** (optional, Japanese anime only), same mechanism as Netflix (`platform-access.ts`, `*://*.disneyplus.com/*` in `optional_host_permissions` only, `synckai-disney-*` script IDs):
  - passive MAIN bridge (`src/content/disney/page-bridge.iife.ts`, `document_start`): wraps `XMLHttpRequest.prototype.open/send` (and `fetch`) only to read the JSON response of the site's own `…/explore/v1.x/playerExperience/{id}` request (and the series-page and playback requests below); never issues a request, never reads headers, tokens or stream URLs. Reduced to `{ ids, seenAt, title, subtitle, internalTitle, originalLanguage, runtimeMs, programType, editorial }`, last 20 kept, pushed over the private `MessageChannel` (snapshot on connect, then each new entry). Version guard `installDisneyBridgeOnce`; bump `DISNEY_BRIDGE_VERSION` on any protocol or shape change;
  - ids: the `/play/{id}` URL carries the EPISODE id (deeplinkId), not the response `availId` (S1E1: URL 539f8e74-…, availId eaccaafa-…); the request path id is either. Each entry carries all of them: request path id, `availId`, and the episode entity decoded from `infoBlock` (base64 protobuf, `urn:ds:cmp:eva:episode/{id}`; only the ids leave MAIN). The URL id is matched against any of them; no match within 5 s → the single entry received since the URL change (`seenAt`, 2 s margin; whole page for the first URL), several → not tracked (`bridge-client.ts`). Never assume URL id == availId;
  - only requests sent after the bridge is installed are seen: a tab opened before activation or an update does not track the current episode (debug log only), the next navigation does. No DOM-only fallback (it would flag non-anime);
  - identity: `internalTitle` `"<English series title> - s<S>e<E> - mediaId:<uuid>"` (anchored at the end, title may contain " - "), never the localized `title`; season 99 = arc published inside the series: arc title from `subtitle` (text before ` : E<n>`) in `seasonTitle`, mapping key `disney:title:<normalized arc>:s99` (`mappingKey`, `DISNEY_ARC_SEASON`); unreadable arc → special season 0. Per-season numbering (`displayedEpisodeNumber` = episode in season). Movies (`programType` movie, internalTitle without sXeY) → episode 1, like Netflix (untested on the real site);
  - anime filter in the content script: `originalLanguage` `ja` only, everything else returns no episode (silent, nothing sent, popup/panel neutral "no page" state);
  - matching: no series ID on the play page, so a Disney+ AniList link (any URL shape) counts as a series link only for an entry carrying the series (or arc) title (`isTitleBoundLink`, `hasSeriesTitle` in `resolver.ts`); then `gateByPlatformLink` as for Netflix (title-only → "À vérifier", unrelated → ignored). An entry linked to Disney+ but rejected by the title rule, whose Disney+ series key (`disneySeriesKey`: `series:{id}` of /series/{slug}/{id}, or `entity:{uuid}`) differs from the accepted entries' keys of the same form, is `other` (BLEACH for BLEACH: Thousand-Year Blood War: otherwise it became season 1 by relation); same key → `id` (`settleTitleBoundLinks`);
  - series pages `/{locale}/browse/entity-{uuid}` (protocol v3): the bridge also reads `explore/v1.*/page/entity-{uuid}` (title, first raw `internalTitle`, genres, `focus.seasonId`, seasons with `pagination.totalCount` and the number from `sNeM` / `visuals.seasonNumber`; never the `set` suggestions) and `explore/v1.*/season/{id}` (response shape NOT observed, parsed tolerantly; marks the season as selected). Pages keyed by entity uuid (10 kept), pushed in the same message (`pages`). `seriesId` = entity uuid: an AniList link `browse/entity-{uuid}` is certain without the title condition (`isDisneyEntityLink`), a link to another entity does not bind (not `other` either); otherwise the playback rules. No *Anime* genre (`catalogAnime: false`) → ignored unless linked to the entity. Mapping keys stay title-based like playback (`seriesMappingPrefix`). Selected season, re-read on every `GET_PAGE_MEDIA`: the season menu button `button[data-testid="dropdown-button"][aria-haspopup="listbox"]` (light DOM, verified 2026-10-11; its rendered text is the selected season's `visuals.name`, compared case/space-insensitively), else a VISIBLE `button[aria-haspopup]` / `[role=combobox]` naming exactly one season, else the last `season/{id}` request, else `focus` (`seasonFromMenu`); arc (s99) → arc name, season without episodes read → name / generic number. Not done: using the entity uuid as `seriesId` on playback (it would switch mapping, exclusion and ignored keys from title to uuid);
  - time source: `<video>.duration` is Infinity/NaN; position/duration come from the player's open Shadow DOM (`progress-bar` → `.progress-bar__seekable-range` `aria-valuenow`/`aria-valuemax`, `runtimeMs` fallback) through `StreamingAdapter.readPlayback` (frozen bar → extrapolated from the video's own time delta), re-read every second by the tracker (the tracked `<video>` may never fire `timeupdate`);
  - credits (protocol v4): from the playback response `stream.editorial` FFEC. The bridge also observes the player's POST `…bamgrid.com/…/playback/…` (path containing `/playback/`, exact version/scenario not recorded; other requests of that host, e.g. DRM licences, never read) and reduces it IN THE MAIN WORLD to `{ ids: [stream.playbackRights.externalIds.availId, tracking.qoe.entityId (= /play URL id), tracking.telemetry.mediaId], creditsStartMs (FFEC), upNextMs (up_next) }` (`reduceDisneyPlayback`): signed stream URLs (`stream.sources`, `insertion`) and rights JWTs (`playbackRightsContext`) are never read, relayed or put in fixtures. Joined to the entry of the same video (an id in common, or the mediaId ending its `internalTitle`) in either arrival order (`withDisneyPlayback`, last 10 playback responses kept, entry re-pushed with `editorial`). `getCreditsStart` = `loadEditorial` (entry, then its `editorial` within `waitMs`, 20 s) → FFEC/1000, else null (ratio fallback). Timeline assumption: FFEC is on the program timeline, like the progress bar (`aria-valuemax` = `runtimeMs`/1000, e.g. 2913 for 2913000; the SGAI preroll bumper `INT-0`, 5 s, is an interstitial outside the program timeline): no offset correction. Observed: Synduality Noir S1E1 FFEC 1429.8 s / up_next 1434.8 / LFEC 1441.0 / runtime 1460.1 s, so FFEC marks the final credit roll, late in the episode (≈ 98 %);
  - player: `video.hive-video` (playing, duration Infinity, `currentTime` is NOT the program position); the page also keeps a dead `video.btm-media-client-element` (paused, NaN, no frames): never pick it by default (`chooseDisneyVideo`, then the playing `<video>`);
  - dev build (`npm run build:dev`): `[disney]` debug logs at each step (script start, bridge connected or absent, entries received with their ids, URL id, match / fallback / no match, anime filter, progress bar and video found or not);
  - Disney+ is never offered as preferred player (`isPreferredPlayerOption`); its AniList links still serve as "Open" fallback.
- **Series pages of bridge platforms (Netflix, Disney+)**: `GET_PAGE_MEDIA` answers asynchronously (`return true`, optional `StreamingAdapter.loadSeries`) when the metadata is not cached yet, bounded by `PAGE_MEDIA_ASYNC_TIMEOUT_MS` (3 s, then `null`); the popup / panel wait `PAGE_MEDIA_TIMEOUT_MS` (+0.5 s) per attempt. Crunchyroll / ADN stay synchronous. The service worker applies the playback anime filter to these series pages (`seriesPageGate`, `isSeriesIgnored` verdict shared with playback). The season is re-read on every request. Season menu changes without a URL change (Crunchyroll, Netflix, Disney+): `StreamingAdapter.watchSeason` (`lib/season-watch.ts` › `watchElementText`: MutationObserver on the menu button only, re-attached if replaced, 1 s check) is attached only on a series page AND while a side panel port is connected (`createSeasonWatch`, 300 ms debounce, stopped on navigation / last panel gone); it sends `{ type: 'season' }` on the live port and the panel redetects (`shouldRedetect`). The panel opens the live port on series pages too (`LiveTarget.episodeId: null`), whatever the live-progress setting. The content side notifies only when the season retained by the adapter (`detectSeries`: number + title) changes, never on raw text (Crunchyroll: the label element found in selector priority order, never the `erc-season-with-navigation` container, whose text includes the lazy-loaded episode list). Panel / popup (`ui/page-media-controller.ts`): automatic redetects (cache rewritten elsewhere, live events) are capped at 1 per 2 s (bursts coalesced) and 5 per minute, then suspended until `refresh` (URL change, Refresh button). Anti-echo of the tab cache: the screen's own write timestamp is chosen BEFORE `storeCachedPageMedia` (`now` parameter), because `storage.onChanged` fires during the write; recording it afterwards made every own write look foreign, and after a season pick (cache bypassed) each echo re-ran `RESOLVE_PAGE_MEDIA` → AniList rate limit. Content-script info/debug logs (`watch-session.ts`, Disney+) are wrapped in `if (__SYNCKAI_DEBUG__)` so their strings leave the published bundles. Disney+ debug logs are wrapped in `if (__SYNCKAI_DEBUG__)` so their strings leave the published bundle (70 KB budget for both scripts, 69.96 KB on 2026-10-11 after the credits feature: almost no margin, trim before adding Disney+ code or raise it in `scripts/build-checks.ts`).
- **Single entry spanning a multi-season Netflix show** (One Piece arcs): on a series page, `representsWholeShow` (`matching.ts`) makes the single directly linked entry certain when it covers every Netflix season (enough episodes, or airing with no earlier series entry); otherwise « Saison N mais une seule fiche » stays a doubt. UI (`ui/media-actions.ts` › `renderSeasonPicker`): no « Saison devinée » warning without a selector (fewer than 2 choices).
- **Crunchyroll arcs with an episode range** (One Piece « Elbaph (1156-current) », also « 1086-1155 », « 1156–actuel », « 1156- »): `parseCrunchyrollSeasonLabel` returns the title and `firstEpisode`, sent as `PageMediaInfo.seasonFirstEpisode` and used as the absolute number in the series-page resolution. Relation propagation (`resolver.ts` › `isSeasonRelation`): a PREQUEL released after its source (or a SEQUEL released before), or an entry linked only to another supported platform, never becomes a season by relation (MONSTERS, ONA 2024, « prequel » of One Piece, Netflix only).
- **AniList catalog cache** (`api/media.ts` › `cachedPage`): search and by-id results cached 5 min (interactive) / 10 min (background), one request in flight per key; user lists are never cached. `collectCandidates` skips fetching missing sequels/prequels when the episode is numbered absolutely and a directly linked series entry covers it (airing or enough episodes: One Piece). Netflix One Piece page view or playback start: 2 searches (series + arc), no relation fetch.
- **Player detection** (all platforms): `watch-session.ts` re-reads `findVideo()` every second while no connected `<video>` is tracked: a player created detached and inserted later (Netflix) fires no media event visible from `document`.
- **Update, open tabs**: Chrome leaves an orphaned script, `content-reinjection.ts` re-executes Crunchyroll / ADN; Firefox destroys the old script and re-executes the manifest ones itself (no reinjection).
- **Account-bound data**: the sync queue, « À noter » cards, recent syncs and corrections carry the `epochs` of the sessions open when they were created (`getOpenSessions`); nothing is written to a service whose session has changed (checked right before the write), and `clear*Session` purges the disconnected service's share. Manual end of session: `endSession(service)`; token rejected by the API: `endSessionIfToken(service, token)` (a reconnection in the meantime is preserved). Any account-bound write after a network request (profile, comparison, Agenda week, renewed MAL token) captures the generation BEFORE the request and goes through `writeIfSession` / `writeIfSessions` (or `saveRefreshedMalToken`) under the storage lock. A rejected token (`endSessionIfToken`) sets `sessionExpired:<service>` (« Session expirée » in the UI), cleared by a voluntary sign-out or a sign-in.
- **Encrypted OAuth tokens** (since 2.2.0): `anilistToken` / `malToken` are `{ v: 1, iv, data, expiresAt }` (AES-GCM, `src/shared/token-crypto.ts`), with a non-extractable key in the `synckai-vault` IndexedDB of the extension's origin (`token-key-store.ts`, in memory in tests via `src/test/setup.ts`). Decryption in the service worker only (`shared/token-access.ts`: `getValidToken`, `getMalToken`, never under the storage lock); pages read presence without decrypting (`hasValidAniListToken`, `hasMalToken`, `getOpenSessions`). A legacy plaintext token is encrypted on first access and on update; an undecryptable token (lost key) closes the session with « Session expirée ». Compare decrypted tokens, never encrypted ones (fresh IV on every write).
- **Images and messages**: every displayed image goes through `toImageSrc` / `toSafeImageUrl` (`shared/url.ts`, `IMAGE_HOSTS` hosts), which must stay identical to `img-src` in `content_security_policy.extension_pages` (test). Each message type declares its senders in `MESSAGE_ORIGINS` (`background/message-guards.ts`); a new message sent by a content script must be `content` or `both` there (static test).
- **Debugging**:
  - after reloading the extension, reopen the tab, otherwise the orphaned content script stays active;
  - the content script prints its build timestamp in the console;
  - the service worker writes `[SyncKai:sync]` lines;
  - info/debug logs are visible only with `npm run build:dev` (or `npm run dev`); `npm run build`/`package` keep only warn/error;
  - end-to-end tests of the popup, the side panel and the import page: `npm run test:e2e` (Vitest + Puppeteer, headless Chrome; `scripts/e2e/`, panel records in `window.__e2ePanel`). The real popup runs on the mocked chrome API of the screenshots (`scripts/screenshots/mock-chrome.ts`); messages sent to the service worker, access requests and the clipboard are recorded in `window.__e2e`. CI `e2e` job; locally, Chrome via `npx puppeteer browsers install chrome-headless-shell` if missing.

### Publication

- **Repository**: https://github.com/Sync-Kai/SyncKai (organization `Sync-Kai`).
- **Chrome Web Store**: item `khokcmigioggannjoojambdgioigdceb`. Latest published version: 2.1.0; 2.2.0 submitted on 2026-10-11 by `release.yml`, under review; visibility "Public" since 2026-10-03: https://chromewebstore.google.com/detail/synckai/khokcmigioggannjoojambdgioigdceb
  - Listing texts: `docs/store/listing-{fr,en,de}.md`.
  - Privacy tab: `docs/store/permissions.md`.
  - Procedure: `docs/STORE.md`.
  - Any new permission (`permissions` / `optional_host_permissions` in the manifest) must be justified in the Privacy tab BEFORE pushing the tag, otherwise the automatic upload is rejected ("does not meet the requirements"): this happened with `sidePanel` in 2.0.0.
- **Firefox Add-ons (AMO)**: Gecko ID `synckai@sync-kai.github.io`, listed channel. 1.9.0 (submitted on 2026-10-07 by `release.yml`, add-on created with `docs/store/amo-metadata.json`, secrets `AMO_JWT_ISSUER` / `AMO_JWT_SECRET`), 2.0.0 (submitted on 2026-10-09), 2.1.0 (submitted on 2026-10-10) and 2.2.0 (uploaded manually with its sources on 2026-10-11: the workflow had been rejected because of `approval_notes` that were too long) all still awaiting review; listing to be completed manually (`docs/store/amo.md`). As long as the add-on is not public, `release.yml` resends the full listing from `amo-metadata.json` with each version: keep it up to date; once the add-on is public, only `version` (license, review notes `approval_notes`) is sent and the listing is edited manually.
- **Store screenshots**: `npm run screenshots` → `docs/store/screenshots/{fr,en,de}/`, at 1280×800. The popup, the side panel and the import page are rendered from `src/` (Vite server) with a fake chrome API (`scripts/screenshots/demo-panel.ts` for the panel and the import page); the displayed version comes from `manifest.json`: regenerate after every version bump. Promo tiles: `docs/store/promo-440x280.png` (`npm run icons`) and `docs/store/promo-1400x560.png` (`npm run screenshots`), in English (shared by all languages).
- **Next steps** (as of 2026-10-11): 2.2.0 (audit: data integrity, accounts, security, tooling) published on 2026-10-11 (tag `v2.2.0`), under review on both stores; Store screenshots to be replaced manually. UX-04 (Agenda outside streaming sites) dropped by decision: the extension stays non-intrusive, panel reserved for Crunchyroll, ADN and Netflix. Netflix and Disney+ series pages (*On this page*, panel): the 2026-10-10 exclusion was reversed on 2026-10-11 (`feature/series-pages`). Then: Disney+ adapter (`feature/disney-adapter`, optional like Netflix); Prime Video (technical exploration first); HIDIVE (anime only, through the platform registry `src/shared/platforms.ts`, as an optional host permission like Netflix); ADN history import (exploration done: `/viewing/history` API, feasible in 2-3 days, low priority); no Edge (decision of 2026-10-07). Store listing (description, screenshots, tiles) to be updated manually: the API only handles the package.
