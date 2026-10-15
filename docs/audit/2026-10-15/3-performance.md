# SyncKai: performance audit (MV3)

- Branch `feature/match-signals`, HEAD `9a5d08c`, audited 2026-10-15. Read-only: no repo file was changed.
- Method: code reading with file:line evidence, production builds (`vite build`, Chrome target) measured from `dist/` and from a source-map build written to the scratchpad (`dist-map/`, per-module byte attribution from the maps), `scripts/verify-build.ts` budgets, and Node micro-benchmarks for parse and clone costs.
- No browser profiling: the parent session was running `npm run verify` / `test:e2e` / `test:ext` in the same working tree at the same time, so no Chromium measurement was taken. The latency figures (RTT, ms) are estimates and are marked as such.

> **Measurement caveat (shared `dist/`).** My first `npm run build` reported `script de contenu Crunchyroll/ADN : 83.6 Ko > budget 83.0 Ko` (✖). That `dist/` held `.map` files and `//# sourceMappingURL` comments (≈ 40 B × 15 files), most likely written by a build running at the same time in the same tree. A clean `npx vite build` then gave **83.0 / 83.0 KB on both targets (✔)**. So the budget is met, with **zero headroom**. Parallel builds in one checkout race on `dist/`: run audits and merges in separate worktrees.

---

## 1. Ranked findings

The ranking weighs impact (user-visible latency, battery and wake-ups, AniList rate limit) against effort (S/M/L) and risk. All items are *confirmed by code reading* unless marked UNVERIFIED.

| # | ID | Finding | Impact | Effort | Risk |
|---|----|---------|--------|--------|------|
| 1 | PERF-07 | After each sync, the tab's card is re-resolved in the background even when no screen shows it. The trigger is any `pageMedia:<tab>` entry, never checked for age, and the SW rewrites that entry itself (self-perpetuating) | **Med**: +3–4 API calls per episode, silent | S | Low |
| 2 | PERF-08 | Sync path fetches the same AniList media twice: `questionMapping` (AnimeByIds) then `getCatalogMedia` (AnimeById, uncached). New resolutions refetch a media they already hold | **Med**: +1 sequential AniList RTT before the sync toast, every episode | S | Low |
| 3 | PERF-09 | Catalog cache is keyed by the exact id set (`ids:1,2,3`), never per media. Search results never serve by-id lookups. The concordance re-check costs 1 by-id request per cached-mapping resolution (page view, sync, every mapped season of a Netflix import) | Med: rate-limit budget in imports, latency live | M | Low |
| 4 | PERF-10 | Crunchyroll/ADN history analysis does 1–4 single searches per season, never batched (the Netflix import already uses `searchAnimeBatch`, 10 per request). The background lane is capped at 20/min | **Med–High for imports**: 300 seasons ≈ 10–30 min, could be ~3–5 min | M | Med |
| 5 | PERF-11 | Series page: `seasonStatuses` reads up to 6 list entries **one after another**, then `readLists` reads the chosen one again | Med: up to 6–7 serial RTT (≈ 1.5–2 s, est.) on the first view of a series page | M | Low |
| 6 | PERF-12 | Every content-script start (any Crunchyroll/ADN/Netflix/Disney+/Prime page, watch page or not) asks the SW for the content catalog when the UI is not in English. Each full page load wakes the SW and loads the full locale (64 KB) | Low–Med: battery and wake-ups for 20 of 21 locales | S | Low |
| 7 | PERF-13 | The Crunchyroll/ADN content bundle (83.0/83 KB) statically loads import-only code (~10 KB) and sync-time UI (~13 KB) on every page | Med for maintainability (no budget left), low runtime | M | Med |
| 8 | PERF-14 | `writeWeekCache` reads **the whole `storage.local`** (`get(null)`) on every hourly airing check and every Agenda refresh | Low–Med: up to MBs cloned each hour with a large import plan | S | Low |
| 9 | PERF-15 | The popup builds the full Settings view at startup. It reads and sorts all mappings, the journal, airing, shortcuts and access, keeps a storage listener, and adds 79 KB of JS on every popup open. The panel already defers this | Low–Med: popup startup work | S | Low |
| 10 | PERF-16 | Job store write amplification: the whole job, `pending[]` included, is rewritten at every item start, every item end, every 10 s heartbeat and every budget wait. The plan (est. ≈ 1.2 MB for 2000 items) is rewritten every 20 items. Each write goes out with old+new values to every `storage.onChanged` context, SW included | Low–Med during big imports | M | Med |
| 11 | PERF-17 | The top-level `storage.local.onChanged` in the SW wakes it for **any** local write from another context (content-script journal warnings, panel last tab, popup prefs). It also receives large old/new values for every write | Low | S–M | Low |
| 12 | PERF-18 | `mediaMappings` lives in one key with no cap. Every learned or chosen mapping does a read-modify-write of the whole object (≈ 370 KB for 2000 mappings) and fans out to every listener | Low today, grows with imports | L | Med |
| 13 | PERF-19 | In-memory caches die with the SW (~30 s idle): `scoreFormatCache` (an extra Viewer query after each wake), page-media `details`/`resolutions` (10 min TTL in name only), catalog cache (5/10 min in name only) | Low–Med: extra requests at episode end | S | Low |
| 14 | PERF-20 | First panel view of a media: two `Media(id)` queries for the same media (`PageMedia` for the card, `PanelMedia` for the details) | Low | S–M | Low |
| 15 | PERF-21 | Background lane fixed at 20/min (`rate-limit.ts:40`) whatever `X-RateLimit-Limit` says (90 normally, 30 degraded) | Low–Med for imports | S | Med |
| 16 | PERF-22 | Package weight: `.woff` files next to `.woff2` (128 KB never used), 3 identical 44 KB Tailwind CSS files | Low (package size only) | S | Low |

**Quick wins** (S effort, low risk, measurable): PERF-07, PERF-08, PERF-12, PERF-14, PERF-15, PERF-19. Together they remove ≈ 3–5 AniList/MAL requests and 1 sequential RTT per watched episode, one SW wake per page load (non-English users), and the hourly full-storage read.

---

## 2. Details by area

### 2.1 Service worker: wake-ups, startup, periodic work

**What wakes it** (`src/background/background.ts`):

| Source | Where | Frequency | Verdict |
|---|---|---|---|
| `runtime.onMessage` | `background.ts:183` | per user action; `EPISODE_COMPLETED` per episode; `GET_CONTENT_CATALOG` per content-script start (non-English, PERF-12) | ok, except PERF-12 |
| `alarms`: airing | `airing.ts:100` (`delayInMinutes: 1, periodInMinutes: 60`) | hourly, only if alerts are on and a service is connected | ok. Each run: 1 AniList request per 50 series per page (≤ 3), list refresh every 12 h, 4–5 local writes, plus PERF-14 |
| `alarms`: sync queue | `sync/queue.ts:41` | one-shot `when`, cleared when the queue is empty | ok |
| `alarms`: compare / CR import resume | `jobs/runner.ts:42-49` (`0.5` min) | only while a job runs, cleared at the end (`compare.ts:369`, `cr-import.ts:662`, `runner.ts:257`) | ok |
| `storage.local.onChanged` | `background.ts:260` (+ `i18n/core.ts:332`, registered late after an await, so it never wakes the SW by itself) | **every local write from any other context** | PERF-17 |
| `commands`, `notifications`, `permissions`, `onInstalled`, `onStartup` | `background.ts:223-288` | rare | ok |
| `tabs.onUpdated`, `webNavigation` | none in the SW (comment `background.ts:271-273`) | — | good |

**Startup work.** At every wake, `initI18n()` (`background.ts:55`) runs first, and **every message waits for it** (`background.ts:200-202`). It reads the settings and, for a non-English UI, fetches and parses `assets/locales/<code>.json`: `JSON.parse(de.json, 64 KB)` takes ≈ 0.3 ms in Node, so this is negligible. `onStartup` runs badge, purge flag, queue/airing alarms, side-panel reset and job resume, all cheap. `onInstalled` adds migrations, script re-registration and reinjection into open tabs (once per update, fine).

**Parse cost per wake.** `background.js` statically imports 16 modules, **299 KB raw / 96 KB gz**. By source-map attribution, `matching.ts` 19 KB, `cr-import.ts` 11 KB, `sync-service` 8 KB, `resolver` 7 KB, `page-media` 7 KB, `compare` 5.5 KB, and the English catalog inlined in `platform-access-*.js` (≈ 30 KB). Rarely used code (CR/ADN/Netflix import, compare) is parsed on every wake. Impact is low (V8 code cache, UNVERIFIED in ms). Lazy `import()` is **not** an option in the Chrome module SW (CLAUDE.md › i18n), so leave it as is.

**Long tasks.** None found on the hot paths: matching runs on ≤ ~60 candidates. Large structured clones only happen around imports (PERF-16, PERF-18).

**PERF-17. Wake-up by `storage.local.onChanged`.** The handler only needs `settings`, `anilistToken` and `malToken` (`background.ts:260-264`), but Chrome wakes the SW for every local write made by pages or content scripts: the journal (`logger.ts` warn/error → `error-journal.ts`, also from content scripts), the panel's last tab (`sidepanel.ts:53`), popup prefs (`popup/controllers/watching.ts:199`). The SW also receives the old and new values of large keys it writes itself (mappings, CR plan, jobs).
- Fix option: have settings saves (and sign-in/out, which already run in the SW) call `ensureAiringAlarm` explicitly, or check the alarm's validity inside the alarm handler (`runCheck` already returns `disabled` / `not-connected`), then drop the listener.

### 2.2 Network (AniList / MAL)

**Request plumbing.**
- `api/client.ts`: shared budget `aniListBudget`. The interactive lane is never held back except during a 429 cooldown. The background lane gets 20 per sliding minute, a 10-request interactive reserve on `X-RateLimit-Remaining`, and a 1.5 s grace after interactive requests (`rate-limit.ts:40-46`). A 429 penalizes the shared budget and is retried once (`client.ts:83-94`).
- Each request also reads and decrypts the token (`token-access.ts:41`). The AES key is cached (`token-key-store.ts:13`), so this is negligible.
- MAL has no shared budget or cooldown (each request retries itself once after `Retry-After`, `mal.ts:137-145`). Background jobs space MAL writes 1 s apart (`runner.ts:61`). Acceptable.

**Catalog cache** (`api/media.ts:131-160`): an in-memory `Map`, TTL 5 min (interactive) / 10 min (background), at most 300 entries, one request in flight per key. Search keys are `search:<lower>`, by-id keys are `ids:<sorted set>` (`media.ts:213`). `getAnimeById` (`media.ts:228`) and `getPageMediaDetails` (`media.ts:255`) are **not cached**.

#### Requests per user action (estimates from code; AniList + MAL connected, Crunchyroll, signals present)

| Action | AniList | MAL | Notes |
|---|---|---|---|
| Playback start | 0 | 0 | content-only; plus `GET_CONTENT_CATALOG` (no network) when the UI is not English (PERF-12) |
| **Episode completed**, mapping cached (`learned`) | `AnimeByIds` (questionMapping, `resolver.ts:278`) → `AnimeById` (`sync-service.ts:298` → `getCatalogMedia` `:78`) **dup** → `MediaEntry` → `SaveMediaListEntry` = **4 sequential** | GET entry → PATCH (in parallel with the AniList write) | **+ PERF-07** when the tab ever had a card: `PageMedia` + `MediaEntry` (+ `Viewer` if scored, PERF-19) and MAL GET = 3–4 more, in the background |
| Episode completed, new season (no mapping) | search 1–4 (`resolver.ts:130-149`) + `AnimeByIds` relation rounds 0–2 (`:213`) + `AnimeById` **dup** (`sync-service.ts:331`) + entry + save | 2 | the media is already in `collected.media` |
| Popup/panel open on an episode page, no tab cache (cold SW) | `AnimeByIds` (questionMapping) + `PageMedia` + `MediaEntry` (+ `Viewer`) | 1 | the panel adds `PanelMedia` (6 h session cache, `panel-media.ts`) |
| Popup open, tab cache hit (< 10 min) | 0 | 0 | read straight from `storage.session`, no SW (`page-media-controller.ts:404-414`) |
| Popup list revalidation | `MediaListCollection` 1 if the cache is > 90 s old (`watching.ts:249`) | 1 | stale-while-revalidate, ok |
| Series page, first view, no mapping | search 1–4 + byIds 0–2 + **statuses 0–6 sequential** (`page-media.ts:123-133`) + `PageMedia` + `MediaEntry` (**dup** of one status read) | 1 | PERF-11 |
| Agenda (panel) | 1 per 50 series per page (≤ 8, `airing-policy.ts:90`), current-week TTL 1 h | 0 | hourly alarm shares the cache (`airing.ts:234`) |
| Hourly airing check | 1–3 | 0 | + list refresh every 12 h |
| Netflix import | 1 per 10 titles (`searchAnimeBatch`) + per season resolution (+1 `AnimeByIds` per **already mapped** season with signals, PERF-09) | — | background lane, 20/min |
| CR/ADN import analysis | 1–4 searches + 0–2 byIds **per season**, deduplicated only while the SW stays awake (cache) | — | PERF-10 |

**Typical evening** (3 episodes with autoplay, panel open, 2 popup opens, hourly check): ≈ **35–45 AniList and ≈ 12–15 MAL requests per hour**. That is far below the 90/min limit (30/min degraded), so rate limiting is not a live-sync risk. The real costs are **sync latency** (4 serial AniList round-trips before the toast, est. 1–2 s) and **silent extra calls** (PERF-07, PERF-08, PERF-19: ≈ 5 avoidable calls per episode, ≈ 40 % of the per-episode total).

**PERF-07. Background re-resolution with no viewer.**
- `episode-completed.ts:34-37` calls `refreshTabPageMedia` after every `synced`.
- `page-media.ts:431-437` returns early only if `readCachedPageMedia(tabId)` is null. That function checks shape and sessions only, never age (`page-media-cache.ts:88-95`). The age check lives in `matchCachedPageMedia` (`:57-62`), which is not used here.
- `refreshTabPageMedia` then writes a fresh `'sync'` entry (`:437`), so a tab that once showed a popup/panel card keeps triggering a full `resolvePageMedia` (details + both list reads + maybe Viewer) after every episode, for the life of the browser session. The purge only removes entries older than 10 min at the next session write, which `refreshTabPageMedia` itself performs after its check.
- Fix (S): skip unless `matchCachedPageMedia(entry, pageMediaFromEpisode(episode), now)` is non-null, i.e. fresh (< 10 min) and the same page.
- Better on Chrome: also check that a popup or side panel is open with `chrome.runtime.getContexts({ contextTypes: ['POPUP','SIDE_PANEL'] })`, available from Chrome 116 (= `minimum_chrome_version`). Firefox support UNVERIFIED, so keep the age check there.
- An open panel already re-resolves on its own when the live port sends `sync`.

**PERF-08. Duplicate catalog fetch in the sync path.**
- `resolveForSync` (`sync-service.ts:326-337`): for a cached target, `revalidateCachedTarget` calls `getCatalogMedia` → `getAnimeById` (uncached), right after `questionMapping` fetched the same media with `getAnimeByIds` (`resolver.ts:278`). `CatalogMedia` (`idMal`, `displayTitle`, `episodes`) is fully derivable from that `AniListMedia`.
- For a fresh target (`:331`), the media is already in `collectCandidates().media`.
- Fix: `getCatalogMedia` goes through `getAnimeByIds([id])` (cached), and an empty result counts as "not found", which keeps the 404 → delete-mapping rule at `:299-303`. Or `resolveEpisode` returns the target media.
- Saves 1 AniList request and 1 serial round-trip per synced episode.

**PERF-09. Per-media catalog cache.** `getAnimeByIds` caches by the exact id set, so `[2]` misses an earlier `[1,2,3]`, and search results never serve by-id lookups. Since the matching-signals branch, `questionMapping` adds one `AnimeByIds([id])` per resolution with a cached mapping and signals (`resolver.ts:276-283`): page views, syncs, and every mapped season of a Netflix import (in the background lane).
- Fix (M): store parsed media under `media:<id>` (from searches and by-id pages alike) and let `getAnimeByIds` fetch only the missing ids.
- Option: mirror single-media entries in `storage.session` for 5 min, like `panelMedia`, so the cache survives SW sleep between episode start and end.

**PERF-10. Unbatched searches in CR/ADN analysis.**
- `cr-import.ts:218-240` resolves season by season through `resolveEpisode(..., { lane: 'background' })`, so each distinct series costs 1–4 single `SearchAnime` requests.
- The Netflix import pre-fetches titles with `searchAnimeBatch` (`netflix-import.ts:29`, 10 aliases = complexity 350 of 500, `media.ts:177-186`).
- Fix (M): at analysis start, and after a resume, pre-fetch the distinct `animeTitle` values, the `seasonSearchQuery` variants and the accent-free titles in batches of 10 into the background cache. The per-season resolution then hits the cache. With `CATALOG_CACHE_TTL_MS.background` = 10 min, chunk the pre-fetch rather than doing it all up front.
- Estimate (UNVERIFIED): 120 series × ~2 searches = 240 requests (≈ 12 min at 20/min) becomes ~24 batched requests (≈ 1–2 min) plus relation rounds.

**PERF-11. Serial list reads on series pages.** `seasonStatuses` (`page-media.ts:123-133`) awaits `tracker.getEntry` once per season until the first unfinished one (≤ 6), then `readLists` (`:357-379`) reads the chosen entry again.
- Fix (M): one AniList `Page { mediaList(userId, mediaId_in: [...]) }` query (UNVERIFIED query shape, the viewer id is cached) or the cached "Watching"/full list, then reuse the status in `readLists`.

**PERF-21. Fixed background quota.** `BACKGROUND_PER_MINUTE = 20` (`rate-limit.ts:40`) ignores `X-RateLimit-Limit`, which `readRateLimitHeaders` already parses. Adaptive option: `min(limit − reserve − margin, 45)` when the limit reads 90, and 20 when it reads 30 (degraded). Medium risk: AniList degraded mode. Only worth it with PERF-10.

### 2.3 Storage

**Writes per synced episode (local):** `addRecentSync` (5 entries), `learnPlatformLink` (written only if changed, `platform-links.ts:170`), `markSeriesStale` ×2 (comparison snapshot), queue read-modify-write (`recordSyncOutcome`), review card check, maybe one mapping write; plus 1 `storage.session` write (`pageMedia:<tab>`, PERF-07). All of them go through `navigator.locks` (`shared/storage-lock.ts`), and each is small except the mapping write.

**PERF-14. Full-storage read.** `agenda-store.ts:48`: `chrome.storage.local.get(null)` just to list `airingWeek:*` keys. It runs on the hourly alarm (`airing.ts:234`) and on every `GET_AGENDA` (`agenda.ts:35`), and clones *everything*: mappings, CR plan and input, journal, watching cache, comparison.
- Fix (S): `chrome.storage.local.getKeys()` (Chrome 130+; Firefox UNVERIFIED, keep `get(null)` as the fallback), or keep the week keys in a small index key.
- `storage.ts:356` (sign-out) has the same pattern, which is acceptable since it is rare.

**PERF-16. Job write amplification.** `jobs/runner.ts:22-38` rewrites the whole job under the lock on `item-start`, `item`, `touch` every 10 s (`:100-104`, `:180-183`), every pause slice (`:200-205`) and budget waits (`:84-95`). `pending` holds every remaining item: CR apply ≤ 2000 ids (`cr-import.ts:67`), compare apply = `ApplyDiffItem[]`.
- The total bytes written are O(n²): a 2000-item apply means ≈ 1000 ids on average × ~3 writes/item × 2000 items, ≈ tens of MB of clone + IPC + LevelDB in all (UNVERIFIED estimate).
- The plan is rewritten every 20 items / 10 s (`cr-import.ts:128-130`, `:196-205`). Its size is UNVERIFIED: a synthetic 2000-item plan is 1.16 MB JSON, and `structuredClone` takes 14 ms in Node.
- Every write fans out its old+new values to the SW's own `storage.local.onChanged`, the import page (`import-cr.ts:193`) and the popup/panel listeners.
- Fix (M): keep `pending` in a separate key written only on item completion (or a cursor into the stored input), and keep the heartbeat as a tiny `{updatedAt}` key.

**PERF-18. `mediaMappings` single key.**
- Every save is a read-modify-write of the whole record (`storage.ts:191-219`), there is no cap, and `getMediaMapping` re-reads and re-filters everything on every resolution (`:186-188`).
- 2000 synthetic mappings = 367 KB JSON, `structuredClone` ≈ 3 ms in Node.
- Fine today. Shard (`mapping:<key>`) only if imports routinely create thousands. Large effort: migration, backups, Settings › Mappings.
- **Quota:** `storage.local` is capped at 10 MB without `unlimitedStorage`. Largest keys: CR plan (≲ 1.5 MB est.), mappings (≲ 0.5 MB), `ignoredSeries` in session (≤ 200), platform links (≤ 500), journal (≤ 50 × 500 chars). No quota risk found; the CR plan size is UNVERIFIED on a real 2000-season history.

**Fan-out to popup/panel.** Popup: 8 `storage.onChanged` listeners (`ui/accounts.ts:181`, `settings-view.ts:366`, `page-media-controller.ts:189`, `controllers/{compare,queue,watching,ratings}.ts`, `popup.ts:814`). Panel: agenda, now-playing, page-media controller, accounts and settings (lazy). They all filter by key. Automatic redetects are capped at 1 per 2 s and 5 per minute, with anti-echo (`page-media-controller.ts:106-114`, `:221-254`): verified, no loop found. The only cost left is the per-context deserialization of large old+new values (PERF-16, PERF-18).

### 2.4 UI (popup, side panel, import pages)

Static JS graph per page (production, sum of module files):

| Entry | Modules | Raw | gzip | Largest |
|---|---|---|---|---|
| popup | 19 | **316 KB** | 100 KB | `settings-view` 79 KB, `popup.html` 75 KB, `platform-access` (en catalog + platforms) 65 KB, `kit` 18 KB, `badge`/storage 17.5 KB |
| side panel | 18 | 279 KB | 92 KB | `settings-view` 79 KB, `platform-access` 65 KB, `sidepanel.html` 40 KB |
| import (backup) | 10 | 141 KB | 46 KB | — |
| import-cr | 17 | 170 KB | 57 KB | `import-cr` 28 KB |

CSS: 44 KB raw / 8.8 KB gz per page. These are local `chrome-extension://` loads with code caching, so startup is likely dominated by the storage reads and the first SW round-trip (UNVERIFIED in ms, no tracing done).

**PERF-15. Settings view created at popup start.**
- `popup.ts:178` calls `createSettingsView()` at module scope.
- Its constructor (`settings-view.ts:401-415`) loads settings, **all mappings, sorted** (`:150-158`), exclusions, the journal, airing, `commands.getAll()` and platform access, renders hidden pages, and starts a 60 s interval.
- The side panel already creates it lazily (`sidepanel.ts:63-75`, « Créée à la première ouverture »).
- Fix (S): copy the panel's lazy getter. Then (M) a dynamic `import()` of `settings-view` in both pages, allowed by the `script-src 'self'` CSP, takes 79 KB (≈ 25 %) off the popup's eager JS.

**Rendering and timers.** The render scheduler (`ui/dom.ts:138-153`), memoized slots (`popup.ts:549+`) and 60 s clock ticks (`popup.ts:55`, `settings-view.ts:32`) are fine. The import page ticks at 1 Hz only while paused (`import-cr.ts:636`). The live region's MutationObserver on `body` (`ui/live-region.ts:47`) runs `querySelectorAll('[data-alert]')` on each mutation batch: cheap, though it fires about once per second while live progress is shown. Listeners are singletons (agenda `start()`, now-playing, controllers): no leak found.

**Images.** Covers go through `toImageSrc` with `loading: 'lazy'` and `decoding: 'async'` (`ui/kit.ts:115-121`). The panel banner is async-decoded. AniList `medium` covers in lists, `large` in the card: fine.

**PERF-20.** On the first panel view of a media, `getPageMediaDetails` (`media.ts:255`, `PageMedia`) and `GET_PANEL_MEDIA` (`PanelMedia`, cached 6 h) both query `Media(id)`. Option: derive `PageMediaDetails` from a cached `panelMedia` entry when present.

### 2.5 Content scripts

**Timers and observers:**

| Component | Mechanism | When active | Cost |
|---|---|---|---|
| watch session | `setInterval` 1 s doing `video?.isConnected` (`watch-session.ts:399-403`), `findVideo()` only while no player is attached; capture listeners `loadstart, loadedmetadata, play, playing` (`:33`, `:396`) | watch pages | negligible |
| video tracker | `timeupdate` (~4 Hz) until completion, then removed and re-armed on `loadstart` (`video-tracker.ts:89-122`); 1 Hz poll only with `readPlayback` (Disney+/Prime) | during playback | negligible |
| URL watcher | Navigation API (`url-watcher.ts:20-24`), 1 s `location.href` fallback | always | negligible (Firefox: Navigation API availability UNVERIFIED, fallback cheap) |
| `waitFor` | throttled (200 ms) MutationObserver on `documentElement` subtree, time-boxed (`wait-for.ts:12-45`) | metadata wait (≤ 15 s) | ok |
| live stream | 1 Hz, only while a panel port is connected; sends only diffs (`live-stream.ts:110-125`) | panel open | ok |
| season watch | MutationObserver on the menu button + 1 s re-attach, series page **and** panel port only (`season-watch.ts:77-108`) | narrow | ok |
| bridges (MAIN) | wrap `fetch`/XHR, URL-filtered, responses capped at 2–4 MB, bounded maps (Crunchyroll 40 seasons / `CRUNCHYROLL_MAX_SERIES`; Disney 20 / 10; Prime / Netflix LRU) | always | ok. Prime/Disney re-parse large SPA JSON already parsed by the site (UNVERIFIED size) |
| `LabelGuard.owners` | Map grows by 1 key per episode, per tab (`parsing.ts:59`) | binge | negligible |

There is no `storage.onChanged` in content code (PERF-03 holds: `i18n/core.ts:308-332` uses `follow: false`, and `start.ts:37` passes it).

**PERF-12. Catalog request at every script start.**
- `start.ts:37` calls `initI18n({ follow: false })`, then `core.applyLanguageSetting` (`i18n/core.ts:126-135`), then `loadLocale` and the content loader, which sends `GET_CONTENT_CATALOG` (`i18n/content.ts:27-39`).
- This happens on every full page load, including home and browse pages where no toast is ever shown. Each one wakes the SW, which then loads its own full locale (`content-catalog.ts:9-13`).
- `watch-session › loadSettings` (`watch-session.ts:49-58`) already awaits the language before any toast.
- Fix (S): at start, register the English catalog only and resolve the setting without loading (or drop the call). Load on demand from `loadSettings` and the shortcut toast path (`start.ts:83-86`, which would need to await it).

**PERF-13. Content bundle composition.** Crunchyroll/ADN entry = 14 modules, 82.6 KB raw / 32 KB gz (measured on the snapshot; the budget check counts 83.0 KB incl. the loader).
- `src-content-content.ts` 24.3 KB: `crunchyroll.ts` 7.7, **`crunchyroll-history.ts` 6.7**, `adn.ts` 3.5, **`adn-history.ts` 2.4**, parsing 1.4, **history ports 1.2**.
- `start-*.js` 24.7 KB: `watch-session` 5.3, **`toast` 4.0**, i18n/content 3.1, **`engagement-prompt` 2.4**, **`sync-toast` 2.0**.
- Separate chunks `star-rating` 3.3, `kai-small` 4.0, `sync.types` 12.6 (i18n core, settings, error journal).
- About 10 KB serve only the history import (port opened from the import page) and about 13–16 KB only run when a toast or prompt shows.
- The loader already imports the entry dynamically through `chrome.runtime.getURL` (`assets/content.ts-loader-*.js`), so lazy `import()` of the import readers and of the toast/engagement UI should work on both browsers. Risk M: crxjs must list the new chunks in `web_accessible_resources`; Firefox content dynamic import is already relied on.
- Gain: ≈ 20 KB of budget headroom and less parse per page.

### 2.6 Build

- Bundles are built with crxjs + Vite 8 (Rolldown), with `__SYNCKAI_DEBUG__` code removed: `grep -rl debug:matchDiagnostic dist` finds nothing, and the `matchDiag` code is absent from `settings-view` in production.
- Budgets (clean build, both targets): CR/ADN 83.0/83.0 KB (**0 headroom**), CR bridge 7.3/9 KB, Netflix 60.5/65, Disney+ 68.5/75, Prime 72.2/75.
- i18n: English is inlined in `platform-access-*.js` (shared by every page and the SW). The 20 other catalogs load on demand (`assets/locales/`, 1.3 MB on disk, read only for the active locale): good.
- **Duplicates:** `import-*.css`, `popup-*.css` and `sidepanel-*.css` are 44.33 KB each and identical (one page loads one, so package only). Fonts ship `.woff` next to `.woff2` (4 × ~20–31 KB = 128 KB never used by Chrome 116+ / Firefox 115+, PERF-22). The `bridge-protocol-*`, `page-bridge.iife.ts-*` and `content-*.iife.ts-*` chunks are emitted but unreferenced (`verify-build` lists 9 on both targets): crxjs leftovers, package size only.
- Dead code at runtime: import/compare modules in `background.js` (≈ 20 KB min) are parsed on each wake. Not splittable in the module SW (no `import()`), so accept it.

---

## 3. Tests protecting each area

| Area | Unit / integration | E2E / real extension |
|---|---|---|
| Rate limit, lanes, 429 | `src/background/api/rate-limit.test.ts`, `api/client.test.ts`, `api/mal.test.ts` | `scripts/ext-e2e/sync.ext.ts` (fake 429/500), `accounts.ext.ts` (request count after sign-out, `:121`) |
| Catalog cache / batching | `src/background/api/media-cache.test.ts` (dedupe, TTL, batch of 10) | — |
| Resolver, concordance, cached-mapping verdicts | `sync/resolver.test.ts`, `resolver-named-season.test.ts`, `matching*.test.ts`, `concordance.test.ts`, `season-groups.test.ts`, `__corpus__` | `playback.ext.ts`, `panel.ext.ts` |
| Sync path, queue, locks | `sync/sync-service.test.ts`, `queue.test.ts`, `queue-policy.test.ts`, `entry-lock.test.ts`, `episode-completed.test.ts` | `sync.ext.ts`, `playback.ext.ts` |
| Page media (SW), tab cache, redetect caps | `background/page-media.test.ts`, `page-media-rules.test.ts`, `shared/page-media-cache.test.ts`, `ui/page-media-controller.test.ts` | `scripts/e2e/popup.e2e.ts`, `sidepanel.e2e.ts`, `panel.ext.ts` |
| Airing / Agenda | `airing.test.ts`, `airing-policy.test.ts`, `shared/agenda.test.ts` | `panel.ext.ts` (Agenda) |
| Jobs, imports | `jobs/runner.test.ts`, `job-resume.test.ts`, `cr-import.test.ts`, `netflix-import.test.ts`, `compare.test.ts`, `shared/job.test.ts`, `shared/cr-import-store.test.ts` | `import.ext.ts`, `scripts/e2e/import-cr.e2e.ts` |
| Storage, session caches, journal | `shared/storage.test.ts`, `storage-lock.test.ts`, `panel-media.test.ts`, `error-journal.test.ts`, `logger.test.ts` | — |
| Content timers, trackers, live port | `content/lib/video-tracker.test.ts`, `watch-session.test.ts`, `live-stream.test.ts`, `season-watch.test.ts`, `content/start.test.ts`, bridge `*.test.ts` | `playback.ext.ts` (background tab, 30 s wait, autoplay) |
| i18n loading (content / SW) | `src/i18n/content.test.ts`, `background/content-catalog.test.ts`, `build/content-catalog.test.ts`, `i18n/locales.test.ts` | — |
| Bundle budgets, boundaries | `scripts/build-checks.test.ts`, `scripts/verify-build.ts` (in `verify`), `src/architecture.test.ts` | — |

**Gaps:**
- No test asserts the **number of AniList requests per action**. Add one in `sync.ext.ts` with `FakeAniList.requests` (operations per `EPISODE_COMPLETED`: expect `AnimeByIds, MediaEntry, SaveMediaListEntry`, with no `AnimeById` after PERF-08 and no `PageMedia` with no open view after PERF-07). Add a series-page variant for PERF-11.
- No test covers SW wake sources: a static test could forbid new top-level `storage.*.onChanged` / `tabs.onUpdated` in `background/`, in the spirit of `message-guards.test.ts`.

---

## 4. UNVERIFIED items

- All latency figures (RTT ≈ 300–500 ms to AniList, 1–2 s sync toast, series-page delay); no tracing was run.
- CR plan and job sizes on a real large history (synthetic figures only); quota headroom.
- Firefox support for `runtime.getContexts`, `storage.local.getKeys`, and the Navigation API (fallbacks exist or are proposed).
- The AniList `mediaList(mediaId_in)` query shape for PERF-11.
- The parse cost of the 299 KB SW graph and the 316 KB popup graph on low-end hardware.
- Prime/Disney+ SPA JSON sizes re-parsed in the MAIN bridges.
- The cause of the source maps in the first `dist/` (concurrent build assumed).

## 5. Verified healthy (no action)

- Earlier audit items are fixed: PERF-01 (content catalogs reduced to `CONTENT_KEYS`), PERF-02 (batched resolutions), PERF-03 (no `storage.onChanged` in content), PERF-04 (profile refetched only when absent, `ui/accounts.ts:115`; list revalidated after 90 s), PERF-05 (session purge, `session-cache.ts:52-58`), PERF-06 (render scheduler).
- The SW registers no `tabs.onUpdated`. Job and queue alarms are cleared when idle. The airing alarm exists only when alerts are on and a service is connected.
- Auto-redetect caps and anti-echo stop request loops. In-flight dedupe exists for the catalog, Agenda weeks and Netflix metadata.
- Content listeners are tied to `AbortSignal`s, `timeupdate` is removed after completion, bridge caches are bounded, and live/season watchers run only while a panel port is connected.
