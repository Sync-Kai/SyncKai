# Audit 7: folder and file architecture

Repo `/home/user/SyncKai`, branch `feature/match-signals`, HEAD `9a5d08c`. Read-only audit. Scope: structure, layering and dependencies only. Business logic, content-script internals, performance, UI and security are covered by other audits.

Measurement scripts (not part of the repo): `/tmp/claude-0/-home-user/d3b7fa96-95d6-59e4-903d-2a42a7d1a01e/scratchpad/audit-arch/` (`graph.mjs` uses the same import regex as `src/test/import-graph.ts`, `reach.mjs` computes value-reachable modules per runtime entry point, `path.mjs` finds the shortest path, `impact.mjs` estimates diff sizes). Raw graph: `graph.json` there (2,228 edges, 513 type-only).

Anything marked **UNVERIFIED** was inferred and not run.

---

## 0. Executive summary

- The codebase is in better shape than most MV3 extensions of its size (261 source modules, ~2.0 MB of TS, 207 test files). There are **no file-level import cycles**. Layer rules are **enforced by a test** (`src/architecture.test.ts` plus `i18n/content.test.ts` and `message-guards.test.ts`, all built on `src/test/import-graph.ts`), and bundle budgets are enforced by `scripts/verify-build.ts`. That test infrastructure is the most valuable thing to keep and extend.
- The primary axis today is the **runtime context**: `background/` (service worker), `content/` (isolated plus MAIN), and the screens `popup/`, `sidepanel/`, `import/`, `import-cr/`. That is the right primary axis for MV3. Bundles, budgets and available APIs all follow the runtime, so a textbook `domain/application/infrastructure/presentation` top level would fight it.
- The main structural debt is **`shared/` as a catch-all**: 79 modules and 420 KB of source in a flat folder. They mix six kinds of code: IPC contracts, domain types plus guards, pure rules, per-platform knowledge (reducers used by the MAIN-world bridges), `chrome.*` infrastructure (storage repositories, crypto, badge, permissions, side panel) and UI-ish text formatting. About 24 of the 79 make real browser-API calls. The rest is already pure, so most of the work is **subtraction** rather than a rewrite.
- Secondary issues:
  1. **Folder-level cycles**: `shared ↔ i18n`, and inside `background/` (`sync → api → sync`, `trackers ↔ sync`, `trackers → background root`) and `content/` (`lib ↔ adapters`, platform folders importing the root `start.ts`).
  2. **Domain logic depends on infrastructure**: `background/sync/resolver.ts` and `sync-service.ts` import `api/media` directly, and `matching.ts` calls `t()` 45 times.
  3. **Features are split across layers**: page-media spans 9 files in 5 folders, the history import 14 files in 5 folders.
  4. **Misleading names**: `import/` is the Backup page, `import-cr/` is the CR + ADN + Netflix history import, ~30 `Cr*` types are shared by three platforms, `netflix-access.ts` holds the preferred-player rules.
  5. **Unenforced rules that CLAUDE.md states**:
     - "decryption in the service worker only": the popup bundle reaches `shared/token-access.ts`;
     - MAIN bridges must have no `chrome.*`: no test checks it;
     - `content → ui/` is allowed without a list.
- Recommendation: a **minimum viable** program of 6 small move-only PRs plus 5 new boundary tests captures ~80 % of the value. The **full target** adds ports for the AniList catalog and trackers, a split of `storage.ts`, and feature folders in `background/`, for roughly 3× the churn. Two things should **not** change: entry-point paths (manifest, page URLs, `src/content/<platform>/*.iife.ts`) and persisted identifiers (`crImport:*` storage keys, `crImport.*` i18n keys).

---

## 1. Current map

### 1.1 Tree with responsibilities (non-test source / test files)

```
src/                                        (261 src modules ≈ 2.0 MB, 207 test files)
├── architecture.test.ts                    layer rules + content-script "heavy module" list (PERF-01)
├── env.d.ts                                __SYNCKAI_* defines
├── background/   23 src 204 KB | 20 tests  SERVICE WORKER. Flat root mixes:
│   │                                         - composition root + message router: background.ts, message-guards.ts, response-errors.ts
│   │                                         - use cases: controls, engagement, episode-completed, page-media(+rules), cr-import,
│   │                                           netflix-import, compare(+parse,+snapshot), airing(+policy), agenda, content-catalog
│   │                                         - browser infra: platform-access, platform-scripts, content-reinjection, side-panel,
│   │                                           job-resume, update-migrations
│   ├── api/       9 src  74 KB | 8          AniList GraphQL (client, media, list, viewer, watching, panel-media) + MAL REST (mal.ts)
│   │                                         + rate-limit, errors  ← two services mixed in one folder
│   ├── auth/      4 src  17 KB | 4          OAuth AniList (implicit) / MAL (PKCE), oauth-clients table
│   ├── jobs/      1 src  12 KB | 1          resumable job runner
│   ├── sync/     14 src 186 KB | 20 (+corpus, fixtures)
│   │                                         DOMAIN CORE: matching (76 KB, 1,379 lines), concordance, season-groups, rules, score,
│   │                                         queue-policy (pure) + resolver, sync-service, queue, mapping-purge, review-decision,
│   │                                         ignored-series, entry-lock, match-diagnostic (orchestration / IO)
│   └── trackers/  2 src   7 KB              TrackerService port (tracker.ts) + AniList/MAL adapters + comparison-invalidating decorator
├── build/         4 src  18 KB | 4          build-time helpers imported by vite.config (manifest-target, output-names, content-catalog,
│                                             build-stamp). Not runtime code; nothing at runtime imports it (verified)
├── content/       2 src   9 KB | 2          content.ts = Crunchyroll+ADN manifest entry; start.ts = common bootstrap
│   ├── adapters/  7 src 104 KB | 9          StreamingAdapter port (adapter.ts) + adn, crunchyroll, netflix, disney, prime adapters
│   │                                         + parsing.ts (generic DOM/JSON-LD helpers, not an adapter)
│   ├── crunchyroll/ 3 src 18 KB | 2         MAIN bridge (page-bridge.iife.ts) + bridge-client + bridge-protocol
│   ├── disney/    4 src  52 KB | 6          MAIN bridge + isolated entry (content-disney.iife.ts) + client + protocol (Disney reducers live HERE)
│   ├── netflix/   4 src  30 KB | 5          idem (reducers in shared/netflix-metadata.ts)
│   ├── prime/     4 src  34 KB | 5          idem (reducers in shared/prime-metadata.ts)
│   ├── lib/      16 src  81 KB | 8          tracking engine (watch-session, video-tracker, completion, live-stream, season-watch,
│   │                                         url-watcher, page-media, wait-for, find-video, instance-guard, extension-context, page-fetch)
│   │                                         + PLATFORM-SPECIFIC history readers (crunchyroll-history, cr-history-port, adn-history, history-port)
│   └── ui/        4 src  28 KB | 2          closed-shadow-DOM toast, sync toast, engagement prompt (imports ui/rating, ui/star-rating, ui/kai-small)
├── i18n/          7 src  37 KB | 7          engine (core), content subset (content, content-keys), full catalogs (index), locale-codes (leaf)
│   └── locales/   21 JSON (1.39 MB)
├── import/        1 src  15 KB | 0          BACKUP page ("Sauvegarde · SyncKai", ui/backup-download.ts › BACKUP_PAGE)
├── import-cr/     1 src  51 KB | 0          HISTORY IMPORT page for Crunchyroll, ADN AND Netflix (1,175-line single file)
├── popup/         3 src  43 KB | 0          popup.ts (856 lines), state.ts, timeouts.ts
│   ├── components/ 12 src 105 KB | 0        DOM rendering (watching-screen 34 KB)
│   └── controllers/ 5 src 37 KB | 4         chrome.storage listeners + messages
├── shared/       79 src 420 KB | 40 (+4 fixtures)   CATCH-ALL, see §1.4
├── sidepanel/     7 src  35 KB | 6          entry, presence (follow active tab), tabs, toggle, view models
│   └── components/ 4 src 67 KB | 0          agenda (29 KB), now-playing, live-progress, now-playing-controller
├── test/          7 src  22 KB | 1          fake-chrome, fake-document, import-graph, catalogs, memory-key-store, setup
└── ui/           28 src 159 KB | 12         page UI kit (kit, dom, alert, feedback, menu, icons…) AND cross-screen controllers
    │                                         (page-media-controller 27 KB uses chrome.*, accounts, page-media-request)
    │                                         AND content-safe pieces (rating, star-rating, kai-small, svg)
    └── settings/ 13 src 111 KB | 5          the Settings SCREEN (embedded in popup and side panel)

scripts/  (76 files)
├── *.ts (root, ~2.1 k lines)               build checks/budgets (build-checks, verify-build), package, i18n-check, generate-icons,
│                                             refresh-anilist-corpus, changelog-notes + repo-policy tests (store-permissions, listings,
│                                             browser-locales, brand-icons, i18n-context)
├── e2e/       17 ts, 4.4 k lines            Puppeteer page tests on mocked chrome + i18n layout probe
├── ext-e2e/   13 ts, 3.5 k lines            real-extension tests (fake AniList/MAL/sites over CDP)
└── screenshots/ 15 ts, 1.8 k lines          Store screenshots AND the shared page harness (mock-chrome, harness, params, demo-*)
                                              imported by e2e/ (21 imports): "screenshots" is really the page test harness
scripts/** → src/**: 129 import specifiers (i18n 22, storage-keys 12, sync.types 7, build 7, content/adapters 6…)
```

### 1.2 Real dependency graph between folders (non-test, value + type edges)

Top level:

| from \ to | shared | i18n | ui | content | background |
|---|---|---|---|---|---|
| background | 275 | 27 | – | 6 (`?script` only) | – |
| content | 85 | 5 | **3** | – | – |
| ui | 102 | 28 | – | – | – |
| popup | 91 | 17 | 92 | – | – |
| sidepanel | 50 | 6 | 30 | – | – |
| import / import-cr | 3 / 17 | 1 / 1 | 6 / 6 | – | – |
| shared | – | **12** | – | – | – |
| i18n | **3** | – | – | – | – |
| build | – | 2 | – | – | – |

Runtime reach (value imports only, from `reach.mjs`):

| entry point | modules | source KB | composition |
|---|---|---|---|
| service worker `background/background.ts` (excluding `?script` URLs) | 119 | 871 | background 52, shared 62, i18n 5 |
| Crunchyroll/ADN content `content/content.ts` | 57 | 316 | content 27, shared 22, i18n 4, **ui 4** |
| Netflix / Disney+ / Prime isolated (`content-*.iife.ts`) | 52 / 49 / 49 | 265 / 292 / 281 | each with ui 4 |
| MAIN bridges (CR / Netflix / Disney+ / Prime) | 5 / 5 / 4 / 6 | 34 / 30 / 43 / 53 | `content/<p>/bridge-protocol` + `shared/{guards,match-signals,title,<p>-metadata}` |
| popup / side panel | 127 / 119 | 783 / 700 | ui ≈ 40, shared ≈ 62 |
| backup page / history import page | 52 / 54 | 278 / 368 | |

### 1.3 Cycles

- **File level: none.** The existing test `aucun cycle d'import` holds.
- **Folder level** (strongly connected components of the sub-folder graph, non-test):
  1. `shared ↔ i18n`:
     - `i18n/core.ts → shared/settings.ts, shared/logger.ts`;
     - `i18n/content.ts → shared/messages.ts`;
     - 12 `shared` files import `i18n`, five of them import the **full catalog entry** `i18n/index.ts` (`agenda-store`, `airing.types`, `backup`, `diagnostics`, `diagnostics-store`). None of the five is reached by content scripts, so this is legal today but contradicts the CLAUDE.md wording "shared modules import i18n/core".
  2. `background` sub-folders form one SCC:
     - `sync → api` (`resolver`, `sync-service`, `mapping-purge` → `api/media`; `sync-service → api/errors`);
     - `api → sync` (`api/list.ts → sync/score.ts`, type `sync/rules`);
     - `sync ↔ trackers` (`sync-service → trackers`; `trackers → sync/score, sync/rules`);
     - `trackers → background/compare-snapshot.ts` (root);
     - `auth ↔ api` (`auth/mal → api/errors`, `api/mal → auth/mal`);
     - `jobs → api`.
     The inversion that matters is **domain → infrastructure** (`sync → api/media`).
  3. `content` sub-folders form one SCC:
     - `lib ↔ adapters`: `lib/*` type-import `adapters/adapter.ts`, `lib/crunchyroll-history → adapters/parsing`, and adapters import `lib/find-video` and `lib/season-watch`;
     - `{netflix,disney,prime}/content-*.iife.ts → content/start.ts` and `→ adapters/*`.
  4. `popup ↔ popup/components ↔ popup/controllers` and `sidepanel ↔ sidepanel/components`: almost only type imports of `popup/state.ts` and the sidepanel view models. Harmless; a leaf `state.ts` and view models placed one level down would remove them.

### 1.4 `shared/`, classified

The real browser-API calls were counted on non-comment lines. 24 of the 79 modules make them.

| Kind | Modules | Notes |
|---|---|---|
| **IPC contracts** (runtime ↔ runtime) | `messages` (only `sendMessage` is code), `content-messages`, `live.types`, `panel-toggle`, `commands`, `adn-history` (port protocol), `netflix-history` (hook symbol) | Cross-runtime protocol. Also `CR_HISTORY_PORT_NAME` / requests inside `cr-history.ts` |
| **Domain types + guards** | `episode.types`, `page-media.types`, `panel-media.types`, `sync.types`, `review.types`, `queue.types`, `watching.types`, `engagement.types`, `tracker.types`, `anilist.types`, `mal.types`, `auth.types`, `airing.types` (also **formats UI text via full i18n**), `result`, `guards` | `*.types.ts` files carry 1–5 runtime guards each: the suffix promises "types only" but the files hold validation code |
| **Pure domain rules** | `title`, `match-signals`, `session-epochs`, `score`, `list-notes`, `page-media`, `watching`, `agenda`, `compare`, `job`, `compare-job`, `backup` (pure but owns `BACKUP_STORAGE_KEYS`), `diagnostics`, `platform-links` (pure part), `match-diagnostic` (types), `cr-import` (types + plan, 26 KB), `exclusions` (rules + writes) | Mostly pure already. `compare`, `agenda`, `watching`, `sync-feedback`, `backup` call `t()` |
| **Per-platform knowledge** (runtime-agnostic reducers, reached by MAIN bridges) | `platforms` (registry), `platform-ids`, `target-pages` (uses `getManifest`), `crunchyroll-metadata`, `netflix-metadata`, `prime-metadata`, `cr-history`, `adn-import`, `netflix-import` (pure reducers **plus** `netflixTabOp`, a self-contained DOM function serialized into the Netflix tab) | Disney's equivalent lives in `content/disney/bridge-protocol.ts`, an inconsistency |
| **Browser infrastructure** | `storage` (33 KB, 44 API calls: tokens, viewer caches, mappings, reviews, recent syncs, sessions/epochs, watching cache, account-bound data), `storage-keys`, `storage-lock`, `storage-lock-core`, `session-cache`, `session-end`, `page-media-cache`, `error-journal`, `logger`, `settings` (normalisation + `getSettings`/`saveSettings`), `exclusions-core`, `*-store` (`agenda`, `backup`, `cr-import`, `diagnostics`, `engagement`, `platform-links`, `sync-queue`), `token-crypto`, `token-key-store`, `token-access`, `badge`, `side-panel` (Chrome/Firefox API switch), `platform-access` (permissions), `host-access`, `netflix-access` | The `-store` suffix is used on 7 of ~20 storage-backed modules |
| **UI-ish** | `entry-link` (pages only), `sync-feedback` (toast/popup text), `airing.types › formatAiringStatus`, `diagnostics-store` (popup report) | Presentation helpers; they sit in `shared` because content and pages both use some of them |

Notable consequences:

- **Rule drift on tokens.** CLAUDE.md says "decryption in the service worker only (`shared/token-access.ts`)". The popup bundle reaches it: `popup/popup.ts → ui/settings/settings-view.ts → ui/settings/page-help.ts → shared/diagnostics-store.ts → shared/token-access.ts › readTokenSecrets`. The tokens are decrypted to be redacted from the diagnostic report. Pages also bundle `token-crypto` / `token-key-store` through `shared/storage.ts`. No test encodes the rule. The security audit owns the verdict; structurally, the rule should be a reachability test.
- **The MAIN-world safety rule is unenforced.** The MAIN bridges currently reach only `content/<p>/bridge-protocol.ts` plus `shared/{guards, match-signals, title, *-metadata}`, all free of `chrome.*` and verified by the reachability scan. Nothing prevents a future import of `logger`, `settings` or `messages` from a metadata reducer.

### 1.5 Misplaced files

| File | Problem | Better home |
|---|---|---|
| `content/adapters/parsing.ts` | generic DOM / JSON-LD / label-guard helpers, imported by `content/lib/crunchyroll-history.ts` (lib → adapters inversion) | `content/lib/parsing.ts` |
| `content/adapters/adapter.ts` | the `StreamingAdapter` port, type-imported by 4 `content/lib` modules | `content/lib/adapter.ts` (port next to its consumer) |
| `content/lib/{crunchyroll-history, cr-history-port}.ts`, `content/lib/adn-history.ts` | platform-specific history readers in the generic engine folder | `content/crunchyroll/`, `content/adn/` |
| `content/adapters/{netflix,disney,prime,crunchyroll}.ts` | one platform split across `adapters/` and `content/<p>/` | `content/<p>/adapter.ts` |
| `content/disney/bridge-protocol.ts` (29 KB of reducers) vs `shared/{netflix,prime,crunchyroll}-metadata.ts` | same role, two conventions | one convention (see §2) |
| `background/compare.ts` › `fetchAniListFullList`, `fetchMalFullList` | tracker API adapters inside a use case; `background/cr-import.ts` imports them from `./compare` | `background/api/` (AniList) and MAL module |
| `background/trackers/index.ts → background/compare-snapshot.ts` | the comparison-invalidation decorator reaches up into the root | keep the decorator, move `compare-snapshot` next to compare |
| `background/api/list.ts → sync/score.ts` | API adapter pulls score conversion from the domain folder (legal direction, but `score` is shared by trackers + api + sync) | domain `score` module |
| `shared/netflix-access.ts` | holds the preferred-player rules for Netflix **and Prime** (`effectivePreferredPlayer`, `resetRevokedPlayer`) | `shared/preferred-player.ts` |
| `shared/diagnostics-store.ts`, `shared/backup-store.ts`, `shared/cr-import-store.ts` | used by pages only, but placed in shared | fine in a shared infra layer, but they are page-side repositories |
| `ui/page-media-controller.ts` (27 KB, `chrome.*`), `ui/accounts.ts`, `ui/page-media-request.ts` | application controllers in the "UI kit" | `ui/controllers/` (or `ui/features/`) |
| `ui/rating.ts`, `ui/star-rating.ts`, `ui/kai-small.ts`, `ui/svg.ts` | content-safe widgets mixed with page-only kit, only implicitly constrained by the "heavy" list | `ui/content-safe/` (or `ui/shared-widgets/`) with an allow-list test |
| `ui/settings/` | a full screen (13 modules, 111 KB) in the kit | acceptable (it is shared by popup and panel), but name it as a screen |
| `scripts/screenshots/{mock-chrome, harness, params, demo-*}` | the page test harness, used by `scripts/e2e` | `scripts/page-harness/` (or keep and document) |

### 1.6 Naming inconsistencies

- **`import/`** is the Backup page, **`import-cr/`** is the history import for Crunchyroll, ADN and Netflix. The `Cr*` prefix covers ~30 types (`CrImportJob` 29 uses, `CrHistoryError` 32, `CrImportPlan` 26…) that are platform-neutral since 2.3.0. The names are persisted in some places: storage keys `crImport:*`, i18n keys `crImport.*` (21 catalogs plus `docs/i18n/context.json`), message types `CR_IMPORT_*`.
- **Same basename in several layers** (one feature split by layer):
  - `page-media.ts` in shared, content/lib and background;
  - `compare.ts` in shared, background and popup/controllers;
  - `agenda.ts` in shared, background and sidepanel/components;
  - `watching.ts` in shared, background/api and popup/controllers;
  - `match-diagnostic.ts` in shared, background/sync and ui/settings;
  - `platform-access.ts`, `side-panel.ts`, `cr-import.ts`, `netflix-import.ts`, `entry-link.ts`, `adn-history.ts`, `score.ts`, `panel-media.ts` twice each.

  The per-platform duplicates (`bridge-client`, `bridge-protocol`, `page-bridge.iife`) are a **good** convention. The cross-layer ones make stack traces and editor tabs ambiguous.
- **Suffixes**:
  - `.types.ts` modules contain guards and, in one case, i18n formatting;
  - `-store.ts` marks only some storage modules (`storage.ts`, `settings.ts`, `exclusions*.ts`, `session-cache.ts`, `page-media-cache.ts` and `error-journal.ts` are storage too);
  - `-core.ts` means "content-safe subset" (`exclusions-core`, `storage-lock-core`), while `i18n/core.ts` means "engine";
  - `content/content.ts` vs `i18n/content.ts`.
- **Feature scatter** (files per feature, folders):

  | Feature | Files | Folders |
  |---|---|---|
  | page media | 9 | 5 |
  | history import | 14 | 5 |
  | compare | 7 | 4 |
  | agenda | 5 | 4 |
  | airing | 5 | 3 |

### 1.7 Other structural observations

- **Domain ↔ i18n coupling.** `background/sync/matching.ts` (pure rules) makes 45 `t()` / `formatList` calls to build human reasons, and `sync-service.ts` makes 13. This ties the domain to the i18n engine (and to the active locale at resolution time). CLAUDE.md already names the complete fix as "carry key + params" (not done). That fix is a behaviour change, not a move.
- **Direct `chrome.storage` calls outside the storage modules**: 40 files. Most are `onChanged` listeners in popup / sidepanel / ui controllers, but `background/cr-import.ts` (9 calls), `background/sync/mapping-purge.ts`, `background/jobs/runner.ts`, `background/compare-snapshot.ts`, `sidepanel/sidepanel.ts` and `ui/settings/settings-view.ts` read and write keys directly.
- **Test seams**: 46 test files use `vi.mock('<relative path>')` (top targets: `api/media` 12, `trackers` 8, `shared/storage` 8, `shared/messages` 7, `shared/badge` 7) and 21 use `installFakeChrome`. Tests mock by **module path** rather than through ports. That works, but every file move must update these string specifiers, which neither `tsc` nor the import-graph test sees.
- **Paths are part of the build contract**:
  - `manifest.json`: `src/background/background.ts`, `src/content/content.ts`, `src/content/crunchyroll/page-bridge.iife.ts`, `src/popup/popup.html`;
  - Vite `input`: `src/import/import.html`, `src/import-cr/import-cr.html`, `src/sidepanel/sidepanel.html`;
  - constants: `SIDE_PANEL_PATH`, `BACKUP_PAGE`, `IMPORT_PAGE`;
  - `build/output-names.ts › registeredScriptDir`: regex `^src\/content\/([a-z0-9-]+)\/[^/]+\.iife\.js$` used to split `web_accessible_resources` per platform, which is a **security boundary**;
  - ~100 path strings in `scripts/e2e`, `scripts/ext-e2e`, `scripts/screenshots`, `scripts/build-checks*`;
  - ~43 path mentions in `CLAUDE.md` and 44 files under `docs/`.
- No path aliases. All imports are relative, and `import-graph.ts` only follows specifiers starting with `.`, so **adding aliases would silently drop edges from every boundary test**.

---

## 2. Target architecture (adapted to MV3)

### 2.1 Principles

1. **Runtime first, then layer inside the runtime.** Each runtime is a composition root with its own bundle, budget and API surface. Layering (domain → ports → adapters) applies mainly **inside the service worker**, where the business logic lives. Content scripts stay "adapter + small engine", and pages stay "screen + kit".
2. **Pure, runtime-agnostic code gets its own top-level folders**, with tested purity. Those are the only folders the MAIN-world bridges and the content scripts may reach freely.
3. **Entry-point paths are frozen.** The manifest, page URLs and `src/content/<platform>/*.iife.ts` do not move: they are public URLs, crxjs inputs and the regex key of the per-platform `web_accessible_resources` split.
4. **No barrels** (justified in §4). Relative imports stay, because the import-graph tests depend on them.
5. **Ports only where there is a second implementation or a real test seam**: trackers (exists), AniList catalog (12 `vi.mock`s), clock (optional). No generic `Repository<T>`: storage semantics (lock, session epochs, `writeIfSession`) are specific and already well named.

### 2.2 Target tree

```
src/
├── domain/                 PURE. No chrome.*, fetch, DOM, indexedDB, crypto.subtle; no i18n except type MessageKey (phase 2: none)
│   ├── episode.ts            EpisodeInfo, PageMediaInfo, SeriesPageInfo, numbering helpers   (episode.types, page-media.types, page-media)
│   ├── matching/             matching, concordance, season-groups, signals (match-signals), title          (from background/sync + shared)
│   ├── tracking/             list rules (rules), score formats + conversions (shared/score + sync/score), queue-policy,
│   │                         list-notes, session-epochs, sync.types, review.types, queue.types, tracker.types, engagement.types
│   ├── catalog/              anilist.types, mal.types, auth.types (normalized shapes), watching(.types), panel-media(.types)
│   ├── agenda.ts, compare.ts, compare-job.ts, job.ts, backup.ts, diagnostics.ts, exclusions-rules.ts, preferred-player rules
│   ├── history/              import plan (cr-import → history-import), HistorySeason (cr-history types)
│   └── guards.ts, result.ts
├── platforms/              PURE, MAIN-world-safe per-platform knowledge (registry + reducers + signals), imports domain/ only
│   ├── registry.ts           platforms.ts + platform-ids.ts (+ target-pages minus getManifest)
│   ├── crunchyroll/metadata.ts   history.ts (row reduction)
│   ├── adn/history.ts
│   ├── netflix/metadata.ts   history.ts (reducers)   tab-op.ts (netflixTabOp: serialized, zero imports, own test)
│   ├── disney/metadata.ts    (reducers moved out of content/disney/bridge-protocol.ts; protocol encoding stays there)
│   └── prime/metadata.ts
├── protocol/               cross-runtime contracts: messages.ts (types + sendMessage), content-messages.ts, live.ts, panel-toggle.ts,
│                           commands.ts, history-ports.ts (CR/ADN port names + requests), storage-keys.ts (keys are a contract
│                           between SW and pages; leaf module)
├── browser/                chrome.* infrastructure shared by SW and pages (content-safe subset listed explicitly)
│   ├── storage/              split storage.ts: tokens.ts, mappings.ts, reviews.ts, sessions.ts (epochs, writeIfSession), viewer-cache.ts,
│   │                         watching-cache.ts, account-data.ts + lock.ts, lock-core.ts, session-cache.ts, page-media-cache.ts,
│   │                         settings-store.ts, exclusions-store.ts (+ exclusions-read.ts content-safe), *-store.ts as today
│   ├── tokens/               crypto.ts, key-store.ts, access.ts (SW-only by test)
│   ├── permissions.ts        platform-access + host-access
│   ├── side-panel.ts, badge.ts, logger.ts, error-journal.ts
├── i18n/                   unchanged (core / content / index / locale-codes), but core no longer imports browser/settings directly
│                           (language setting read through an injected reader, which breaks the shared↔i18n folder cycle)
├── background/             SERVICE WORKER composition root (background.ts stays: manifest path)
│   ├── messaging/            router (extracted from background.ts), message-guards, response-errors
│   ├── ports/                tracker.ts (moved from trackers/tracker.ts), catalog.ts (searchAnime, getAnimeByIds…)
│   ├── anilist/              client, media (CatalogPort impl), list, viewer, watching, panel-media, full-list, auth (OAuth implicit)
│   ├── mal/                  client (mal.ts), full-list, auth (PKCE), pkce
│   ├── trackers/             index.ts (adapters + invalidation decorator), oauth-clients
│   ├── sync/                 resolver, sync-service, queue, review-decision, mapping-purge, ignored-series, entry-lock, match-diagnostic
│   ├── features/             page-media(+rules), controls, engagement, episode-completed, history-import (cr-import, netflix-import),
│   │                         compare (+parse, +snapshot), airing (+policy), agenda, content-catalog
│   ├── jobs/runner.ts, rate-limit.ts, errors.ts (ApiError shared by anilist/mal/auth)
│   └── platform-scripts/     platform-access (?script imports: the ONLY background→content edge), platform-scripts, content-reinjection,
│                             side-panel, update-migrations, job-resume
├── content/                CONTENT SCRIPTS (entry paths frozen)
│   ├── content.ts, start.ts  (manifest entry, common bootstrap)
│   ├── lib/                  engine + adapter.ts (port) + parsing.ts + history-port.ts (generic)
│   ├── ui/                   toast, sync-toast, engagement-prompt, notification-policy
│   ├── crunchyroll/          adapter.ts, history.ts, history-port.ts, page-bridge.iife.ts, bridge-client.ts, bridge-protocol.ts
│   ├── adn/                  adapter.ts, history.ts
│   ├── netflix/ disney/ prime/   adapter.ts + content-<p>.iife.ts + page-bridge.iife.ts + bridge-client.ts + bridge-protocol.ts
├── ui/                     page kit (kit, dom, alert, feedback, menu, icons, live-region…)
│   ├── content-safe/         rating, star-rating, kai-small, svg (allow-listed for content/)
│   ├── controllers/          page-media-controller, page-media-request, accounts, media-action-requests
│   └── settings/             Settings screen (shared by popup and panel)
├── popup/  sidepanel/  import/  import-cr/     screens (paths frozen; optional late rename, see §3 step 10)
├── build/  test/
```

`shared/` disappears by subtraction. **Minimum-viable variant**: `shared/` stays and simply ends up holding only `domain/` content, enforced pure by test (see §3, "MV").

### 2.3 Mapping table (current → target)

| Current | Target | Kind of change |
|---|---|---|
| `shared/messages, content-messages, live.types, panel-toggle, commands, adn-history, netflix-history`, port parts of `cr-history` | `protocol/` | move |
| `shared/storage-keys` | `protocol/storage-keys` | move (leaf; contract between SW and pages) |
| `shared/platforms, platform-ids, target-pages` | `platforms/registry` (+ `getManifest` part stays in `browser/`) | move (+ 1 small split) |
| `shared/{crunchyroll,netflix,prime}-metadata`, `cr-history` (rows), `adn-import`, `netflix-import` (reducers) | `platforms/<p>/{metadata,history}` | move |
| `shared/netflix-import › netflixTabOp` | `platforms/netflix/tab-op.ts` | split out (same code) |
| `content/disney/bridge-protocol.ts` reducers (`reduceDisney*`) | `platforms/disney/metadata.ts` | split (optional; protocol encoding stays) |
| `shared/storage` | `browser/storage/{tokens,mappings,reviews,sessions,viewer-cache,watching-cache,account-data}` | split (function moves, no logic change) |
| `shared/*-store, storage-lock*, session-cache, session-end, page-media-cache, error-journal, logger, badge, side-panel, platform-access, host-access` | `browser/…` | move |
| `shared/token-crypto, token-key-store, token-access` | `browser/tokens/` | move |
| `shared/settings` | `domain/settings` (types, defaults, normalize, effectivePlayer) + `browser/storage/settings-store` (get/save) | split |
| `shared/netflix-access` | `domain/preferred-player` (rules) + `browser/permissions` (access read) | rename (+ optional split) |
| `shared/*.types`, `guards`, `result`, `title`, `match-signals`, `session-epochs`, `score`, `list-notes`, `page-media`, `watching`, `agenda`, `compare`, `job`, `compare-job`, `backup`, `diagnostics`, `platform-links`, `cr-import`, `exclusions` (rules) | `domain/…` | move |
| `shared/entry-link`, `sync-feedback`, `airing.types › formatAiringStatus` | `ui/` (pages) or `content/ui` + `ui` (sync-feedback is used by both) | move; `sync-feedback` → `ui/content-safe/` |
| `background/sync/{matching, concordance, season-groups, rules, score, queue-policy}` | `domain/matching/`, `domain/tracking/` | move |
| `background/sync/{resolver, sync-service, queue, …}` | stays `background/sync/` | none |
| `background/api/*` (AniList), `auth/anilist` | `background/anilist/` | move |
| `background/api/mal`, `auth/mal`, `auth/pkce` | `background/mal/` | move |
| `background/compare.ts › fetch*FullList` | `background/anilist/full-list`, `background/mal/full-list` | extract (same code) |
| `background/trackers/tracker.ts` | `background/ports/tracker.ts` | move |
| background root use cases | `background/features/*` | move (optional) |
| `background/{platform-access, platform-scripts, content-reinjection, side-panel, update-migrations, job-resume}` | `background/platform-scripts/` or `background/lifecycle/` | move (optional; `platform-access` path appears in `architecture.test.ts`) |
| `content/adapters/<p>.ts` | `content/<p>/adapter.ts` (`content/adn/` new) | move |
| `content/adapters/{adapter,parsing}.ts` | `content/lib/` | move |
| `content/lib/{crunchyroll-history, cr-history-port}`, `adn-history` | `content/crunchyroll/`, `content/adn/` | move |
| `ui/{rating, star-rating, kai-small, svg}` | `ui/content-safe/` | move |
| `ui/{page-media-controller, page-media-request, accounts, media-action-requests}` | `ui/controllers/` | move |
| `popup/state.ts`, sidepanel view models | unchanged (or `popup/model/`) | optional |
| `import/`, `import-cr/` | unchanged, or late rename to `backup/`, `history-import/` | URL change (§3 step 10) |
| `scripts/screenshots/{mock-chrome, harness, params, demo-*}` | `scripts/page-harness/` | move (optional) |

### 2.4 Boundaries `architecture.test.ts` should enforce

Existing rules stay. Add, in this order of value:

1. **MAIN-world safety.** `reachableFrom(['content/*/page-bridge.iife.ts'], { valuesOnly: true })` ⊆ `content/<same p>/{page-bridge.iife,bridge-protocol}.ts ∪ platforms/** ∪ domain/{guards,title,matching/signals}`. No module in that set contains `chrome.` (raw-source scan, as `i18n/content.test.ts` already reads sources). Today this would pass; it prevents a regression that would break the bridge at runtime (no `chrome.runtime` in MAIN).
2. **Domain and platforms purity** (raw-source scan on non-comment lines): no `chrome.`, `browser.`, `fetch(`, `indexedDB`, `navigator.locks`, `document.`, `window.`. `netflixTabOp` sits in its own file on an explicit allow-list (its DOM code runs in the tab). `domain/` imports only `domain/` (+ `i18n/core` type-only during the transition). `platforms/` imports only `domain/` and `platforms/`.
3. **Token decryption reachability.** `browser/tokens/access.ts` (today `shared/token-access.ts`) is reachable only from `background/background.ts`, or, if the diagnostics redaction stays in pages, from an explicit one-entry allow-list with a comment. This turns a CLAUDE.md sentence into a test.
4. **content → ui allow-list.** `content/**` may import only `ui/content-safe/**` (today `ui/{rating,star-rating,kai-small,svg}`), never the rest of `ui/`. This replaces the ad-hoc "heavy" entry `ui/icons.ts`.
5. **Background inner layering** (after step 7): `background/sync/**` and `background/features/**` never import `background/anilist/**` or `background/mal/**` except through `background/ports/**`, with an allow-list that shrinks to zero. `background/anilist` and `background/mal` never import `background/sync` or `background/features`.
6. **protocol/ is a leaf-ish layer.** It imports only `domain/` and `platforms/` types and `i18n/locale-codes` / `i18n/content-keys` types. `messages.ts` keeps "type imports only" (existing rule, retargeted).
7. **No folder-level cycle among top-level layers** (domain, platforms, protocol, browser, i18n, background, content, ui, screens). This is cheap to compute on the existing `EDGES`.
8. **Test-seam integrity**: every `vi.mock('<relative>')` specifier in `*.test.ts` resolves to an existing file. Without it, a move can leave a mock that targets nothing. Whether Vitest errors on such a mock is **UNVERIFIED**; the assumption is it does not, and the real module is then used silently.

### 2.5 Content-script size constraints and MAIN-world IIFEs

- **Bundle size.** A pure move does not change what is bundled: the value-reachable set is the same, and crxjs/Rolldown name chunks after entries (`jsFileNames`), not internal paths. The proof per step is `npm run verify:build` (budgets: CR/ADN 83 KB at 83.0, Netflix 65, Disney+ 75, Prime 75, CR bridge 9) plus a **dist diff** (§3 step 0). Byte-identical output after moves is **UNVERIFIED**, although identical module graphs make it likely.
- **Real risk is new edges, not moves.** Moving `parsing.ts` into `content/lib` changes nothing. Introducing a port module that drags a registry into the content graph would. Keep `content-safe` subsets explicit (`exclusions-core`, `storage-lock-core`, `platform-ids`, `i18n/content`); the "heavy modules" test stays and is retargeted to the new paths.
- **MAIN IIFEs** (`*.iife.ts`) are bundled self-contained by crxjs `?script` (manifest entry for Crunchyroll, `registerContentScripts` for the others). They may import any **pure** module: the bundler inlines it. Hence the `platforms/` layer: per-platform reducers must run in MAIN, isolated, SW and pages alike, so their home is neither `content/` nor `background/`. The Disney reducers currently in `content/disney/bridge-protocol.ts` are fine while only content uses them; move them only if SW or pages need them, or for consistency.
- **Serialized functions** (`netflixTabOp`, run via `chrome.scripting.executeScript({ func })`): no imports and no free identifiers. A dedicated file plus a test that the file has zero `import` statements makes the rule structural.
- **i18n**: no change. `i18n/content` stays the only i18n entry reachable from content code; the `content-keys` mechanism is unaffected by moves (keys, not paths), but `i18n/content.test.ts` hard-codes 14 module paths to update.

---

## 3. Migration plan (behaviour-preserving, PR-sized)

### Conventions for every step

- Branch `chore/arch-<n>-<slug>` off `develop` (CLAUDE.md accepts `chore/*`). `git rebase develop`, then `git merge --ff-only`, then delete the branch.
- **One commit per step**: `git mv` plus import rewrite **in the same commit**, so no broken intermediate commit and bisect stays green. Do not edit file bodies beyond import specifiers in a move commit. Rename detection keeps high similarity, so `git log --follow` and `git blame -C` keep working. Add each move commit's SHA to a new `.git-blame-ignore-revs` (GitHub honours it; locally `git config blame.ignoreRevsFile .git-blame-ignore-revs`).
- **Timing**: moves conflict badly with in-flight branches (`feature/match-signals` touches `matching.ts`, `resolver.ts`, `shared/*-metadata.ts`, all four bridges). Start after `feature/match-signals` is merged. Ideally do it after `release/2.4.0` is cut, so a 2.4.x hotfix on `main` does not have to be rebased across moved files. A hotfix rebase still works through rename detection, but it is the place where the cherry-pick incident of 2.2.1 could repeat.
- **Codemod, not hand edits**: a ~60-line Node script, run from the scratchpad and not committed (or committed as `scripts/move-modules.ts` if reused). It takes an `old → new` map, runs `git mv`, and rewrites:
  1. relative `import` / `export` / `import()` specifiers (same regex as `import-graph.ts`);
  2. `vi.mock('…')` specifiers;
  3. `?raw` / `?script` specifiers;
  4. src-relative path strings in `architecture.test.ts`, `i18n/content.test.ts`, `ui/settings/summary.test.ts`, `shared/engagement-store.test.ts`.

  It prints the remaining `git grep` hits for the old paths in `scripts/`, `docs/`, `CLAUDE.md` and `README.md` for manual review. No formatter (project rule): the script only replaces string literals.
- **Checks per step (baseline)**:
  1. `npm run verify`: typecheck of src and all script tsconfigs, unit tests including architecture, corpus and i18n content, both builds, budgets, `web-ext lint`, ESLint;
  2. dist diff;
  3. `git grep -n '<old path>'` returns nothing outside `CHANGELOG.md`;
  4. `git diff --stat -M` shows renames (R0xx) plus one-line import changes only.

  Add `CI=1 npm run test:e2e` when popup, sidepanel, ui or import pages are touched, and `npm run test:ext` when content, background, entry points or `build/` are touched. The corpus (`src/background/sync/__corpus__/corpus.test.ts`) runs inside `verify`; it also reads `../../api/media.ts?raw` and `scripts/refresh-anilist-corpus.ts?raw`, so it breaks loudly if `api/media` moves without an update.

### Step 0: safety net (no moves) · value high · risk none · ~150 lines

- Add the boundary tests from §2.4 that pass **today**:
  - MAIN-world safety (#1);
  - token-access reachability (#3), with the current diagnostics path as an explicit, commented exception;
  - content → ui allow-list (#4);
  - vi.mock integrity (#8);
  - `shared/` purity as a **ratchet**: the list of the 24 current browser-API modules is frozen, and adding one fails.
- Add a "dist diff" helper, e.g. `scripts/dist-fingerprint.ts`, or a documented command: build with `SOURCE_DATE_EPOCH` fixed, hash every file of `dist/` and `dist-firefox/`, compare to the previous run.
- Add `.git-blame-ignore-revs` (empty).
- Checks: `npm run verify`.

### Step 1: quick renames inside existing folders · value medium · risk very low · 3 files moved (+2 tests), ~38 specifiers, ~27 files

- `shared/netflix-access.ts` → `shared/preferred-player.ts`;
- `content/adapters/parsing.ts` → `content/lib/parsing.ts`;
- `content/adapters/adapter.ts` → `content/lib/adapter.ts`.

This removes the `content/lib ↔ content/adapters` folder cycle. Checks: baseline + `test:ext` (content).

### Step 2: one folder per platform in `content/` · value high · risk low · 8 files moved (+7 tests), ~87 specifiers, ~22 files

- `content/adapters/{crunchyroll,netflix,disney,prime}.ts` → `content/<p>/adapter.ts`;
- `content/adapters/adn.ts` → `content/adn/adapter.ts`;
- `content/lib/{crunchyroll-history,cr-history-port}.ts` → `content/crunchyroll/{history,history-port}.ts`;
- `content/lib/adn-history.ts` → `content/adn/history.ts`;
- the adapter fixtures follow.

`*.iife.ts` stay put, so the `output-names` regex is unaffected; `content/adn/` holds no IIFE, which is fine. Update `scripts/ext-e2e/fake-sites.ts` and `scripts/e2e` imports of `content/adapters` (6 specifiers). Checks: baseline + `test:ext` (playback batch) + `verify:build` budgets unchanged.

### Step 3: `protocol/` out of `shared/` · value high · risk low · 7 files (+2 tests), ~81 specifiers, ~52 files

- `messages`, `content-messages`, `live.types` → `live`, `panel-toggle`, `commands`, `adn-history` → `history-ports` (merged with the port part of `cr-history` only in a later, non-move PR), `netflix-history`, optionally `storage-keys`.
- Retarget `architecture.test.ts` (`shared/messages.ts` rules) and `message-guards.test.ts`.

Checks: baseline + `test:e2e` (the pages import messages) + `test:ext`.

### Step 4: `platforms/` out of `shared/` · value high · risk low–medium · 10 files (+7 tests), ~127 specifiers, ~88 files

- Moves:
  - `platforms` + `platform-ids` → `platforms/registry*.ts`;
  - `target-pages`;
  - `{crunchyroll,netflix,prime}-metadata` → `platforms/<p>/metadata.ts`;
  - `cr-history` → `platforms/crunchyroll/history.ts`;
  - `adn-import` → `platforms/adn/history.ts`;
  - `netflix-import` → `platforms/netflix/history.ts`;
  - `platform-links` (pure link matching) → `platforms/links.ts`.
- Then, in a **separate PR**, split `netflixTabOp` into `platforms/netflix/tab-op.ts` with its zero-import test.
- Update the "heavy" list (`shared/platforms.ts`, `shared/platform-links.ts`, `shared/adn-import.ts`) and `scripts/refresh-anilist-corpus.ts` / corpus imports.

Checks: baseline + `test:e2e` + `test:ext` + MAIN-world test (#1) green + budgets unchanged.

### Step 5: `browser/` infrastructure out of `shared/` · value medium · risk medium · 28 files (+15 tests), ≤ 393 specifiers, ~156 files

- Two PRs to keep the diff reviewable:
  - **5a** tokens + storage modules (`storage*`, `session-*`, `*-store`, `page-media-cache`, `error-journal`, `token-*`);
  - **5b** browser APIs (`badge`, `side-panel`, `platform-access`, `host-access`, `logger`).
- Watch the `vi.mock('../shared/token-key-store')` in `src/test/setup.ts`: a silent miss here would make tests hit IndexedDB. Test #8 catches it.

Checks: baseline + `test:e2e` + `test:ext` (accounts batch: encrypted tokens).

### Step 6: what remains of `shared/` is the domain · value medium · risk low · decision point

After steps 3–5, `shared/` holds ~35 pure modules. Two options:

- **MV**: keep the name `shared/`, flip the ratchet from step 0 to "zero browser-API modules", forbid `shared → browser/protocol` value imports. No churn.
- **Full**: `git mv shared domain` plus `background/sync/{matching,concordance,season-groups,rules,score,queue-policy}` → `domain/matching|tracking`. Up to ~730 specifiers and ~260 files: an upper bound, since intra-folder `./x` imports survive a whole-folder move. This is the largest diff of the program for a name. Do it only if the team really reads `domain/` as a contract.

Two items in this step are code splits, not moves; land them as separate PRs with their own tests:

- `settings.ts`: domain part vs `getSettings` / `saveSettings`;
- `airing.types › formatAiringStatus` → `ui/`.

### Step 7: service-worker internal layering · value medium · risk medium · ~40 files

- **7a**: `api/` + `auth/` → `background/anilist/`, `background/mal/`; `errors`, `rate-limit` to `background/`; extract `fetchAniListFullList` / `fetchMalFullList` out of `background/compare.ts` (same code, new file).
- **7b**: `trackers/tracker.ts` → `background/ports/tracker.ts`. Introduce `background/ports/catalog.ts`, an interface for `searchAnime`, `getAnimeByIds`, `getAnimeById`, `getPageMediaDetails`, implemented by `background/anilist/media.ts`. It is consumed by `resolver`, `sync-service`, `page-media`, `mapping-purge` and `cr-import` through a default parameter or a module-level `setCatalog` (no DI container). This is the **first step that changes signatures**. Behaviour is unchanged, but it is a refactor: review it as such, and expect the 12 `vi.mock('api/media')` to become plain fakes.
- **7c (optional)**: root use cases → `background/features/*`.

Checks: baseline + full corpus + `test:ext` (all batches). Corpus results must be identical: strict `expected` asserted, `gap` todos unchanged.

### Step 8: `ui/` sub-folders · value low–medium · risk low · ~10 files

`ui/content-safe/` (rating, star-rating, kai-small, svg, and sync-feedback from shared) and `ui/controllers/` (page-media-controller, page-media-request, accounts, media-action-requests). Checks: baseline + `test:e2e` + `test:i18n-layout` (sanity only) + `test:ext` (toasts).

### Step 9: break the `shared ↔ i18n` folder cycle · value low · risk medium · small but not a pure move

`i18n/core.ts` reads the language through an injected reader instead of importing `shared/settings`. `i18n/content.ts` sends `GET_CONTENT_CATALOG` through an injected `send`, or imports `protocol/messages` once step 3 is done; either way the edge then goes to `protocol/`, not `shared/`. Do it only if test #7 (no top-level folder cycle) is adopted.

### Step 10 (optional, last or never): rename screens and `Cr*`

- `import/` → `backup/`, `import-cr/` → `history-import/`. This changes extension page URLs (`src/import-cr/import-cr.html`): update the Vite `input`, `BACKUP_PAGE`, `IMPORT_PAGE`, `scripts/e2e/import-cr*`, `scripts/screenshots/import-cr*`, `scripts/ext-e2e/import.ext.ts` and the docs. Extension pages are closed on update, so no user impact is expected. Whether Chrome persists any page URL across updates for these pages is **UNVERIFIED**; the side panel path is a separate constant and must not move.
- TS type names `Cr*` → `History*`: compile-time only, safe, ~250 occurrences.
- **Do not** rename the `crImport:*` storage keys (persisted jobs and plans; would need a migration), the `crImport.*` i18n keys (21 catalogs, `context.json`, review logs) or the `CR_IMPORT_*` message types (low value; they appear in `MESSAGE_ORIGINS` and e2e recordings).

### 3.1 Cost and benefit

| Variant | Steps | Files touched (≈) | Value |
|---|---|---|---|
| **Minimum viable** | 0, 1, 2, 3, 4, 6-MV (+ 5a if storage churn is acceptable) | ~200 | Enforced MAIN-world safety, token reachability and content → ui list; one folder per platform; contracts and platform knowledge identifiable; `shared/` shrinks to pure code with a ratchet |
| **Full** | MV + 5, 6-full, 7, 8, 9, (10) | ~600 + doc updates | Domain explicit, catalog port (tests without `vi.mock` of `api/media`), SW navigable by feature, no folder-level cycles |

Costs that are easy to underestimate:

1. CLAUDE.md "Known pitfalls" contains ~43 path references and `docs/` 44 files. Stale paths in the shared memory mislead future sessions more than a messy tree does, so each step must update them in the same PR.
2. Every in-flight branch must rebase across the moves.
3. Review fatigue on 100+-file diffs. Hence the codemod plus the "renames only" `git diff --stat -M` check.

### 3.2 What NOT to do

- No `application/` use-case classes for each of the ~70 message types, no DI container, no command bus: `background.ts`'s typed dispatch table is already the use-case registry.
- No generic `StoragePort` / `Repository<T>`. `chrome.storage` semantics here (Web Locks, session epochs, `writeIfSession`, `storage.session` caches) are specific; the existing fake chrome (`src/test/fake-chrome.ts`, used by 21 test files) is already the test seam.
- No `ClockPort` / `NotificationPort` unless a test needs one: functions already take `now` parameters where it matters (`createLabelGuard(now)`, `migrateLegacySeriesOffsets(now)`).
- No npm workspaces or packages, no monorepo split: one bundler, one manifest, budgets measured per entry.
- No path aliases (`@domain/*`) unless `src/test/import-graph.ts` learns them first. Otherwise every boundary test silently loses edges.
- Do not move entry points (manifest scripts, `*.iife.ts`, page HTML, service worker) and do not rename persisted identifiers.
- Do not force "hexagonal" onto content scripts. The adapter pattern (`StreamingAdapter`) and the engine in `content/lib` are already the right shape, and every extra indirection costs bytes in an 83.0 / 83 KB budget.
- Do not chase the `popup ↔ popup/components` type-only cycles: no runtime effect.

---

## 4. Quick wins

1. **Boundary tests from step 0.** About half a day, no moves, and they lock in rules CLAUDE.md states but nothing enforces: MAIN-world safety, token-access reachability, content → ui allow-list, vi.mock integrity, `shared/` browser-API ratchet. Highest value per line in this report.
2. **`shared/netflix-access.ts` → `preferred-player.ts`**: 3 importers; the current name is wrong since Prime became a preferred player.
3. **`content/adapters/{adapter,parsing}.ts` → `content/lib/`**: removes the only lib → adapters edges and a folder cycle.
4. **One folder per platform in `content/`** (step 2): the biggest navigability gain for the smallest risk (`*.iife.ts` paths unchanged).
5. **Extract `fetchAniListFullList` / `fetchMalFullList` from `background/compare.ts`** into the API folder: `background/cr-import.ts` then stops importing a sibling use case for an API call.
6. **Move `compare-snapshot.ts` next to compare** (or into `background/trackers/`) so `trackers/` stops importing the background root.
7. **Split `storage.ts` (33 KB, 7 concerns)** along its existing `// ───` section headers (tokens, viewer cache, mappings, reviews and recent syncs, MAL session, watching cache, session generation, account-bound data): pure function moves, mechanical.
8. **Name the content-safe subsets.** `ui/content-safe/` for the 4 widgets, and a one-line header on each `*-core.ts` explaining "content-safe subset". Or rename them `*-read.ts` (`exclusions-read.ts`) to free `core` for `i18n/core`.
9. **`scripts/screenshots/` harness**: move `mock-chrome.ts`, `harness.ts`, `params.ts`, `demo-*.ts` to `scripts/page-harness/` (21 importers in `scripts/e2e`), or at least document that `screenshots/` is the shared harness.
10. **Do not add barrels.**
    - `reachableFrom` follows edges file by file: a barrel `index.ts` makes every module behind it "reachable" from content scripts, so the PERF-01 "heavy modules" test would produce false positives, or force loosening.
    - Bundlers tree-shake barrels only when they are side-effect free. Several modules here have import-time work (`i18n/index.ts` eagerly globs the catalog URLs; entry modules register listeners). Whether Rolldown would fully drop an unused barrel branch in every case is **UNVERIFIED**. One barrel import in a content script could pull them into an 83 KB-budget bundle.
    - Barrels hide the real dependency in reviews and in the import graph, which this project uses as an architectural tool.

    The two existing `index.ts` files (`i18n/index.ts`, `background/trackers/index.ts`) are real modules, not re-export barrels, and are fine.
