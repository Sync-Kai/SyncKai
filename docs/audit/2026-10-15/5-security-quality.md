# Audit 5: security, privacy, type safety, tests and maintainability

Scope: `/home/user/SyncKai`, branch `feature/match-signals`, HEAD `9a5d08c`. Read-only audit (no repo file changed).
Method: code reading with file:line evidence, plus measurements run from the scratchpad:

- `vitest run --coverage` (reports written to the scratchpad): 179 files, 2456 tests + 4 todo, 37 s, all green;
- `tsc --noEmit` with `--noUncheckedIndexedAccess` / `--exactOptionalPropertyTypes` (probe only, no config change);
- `eslint` with additional typed rules passed on the command line (probe only);
- TS compiler API script for function lengths, a regex script for import fan-in and fan-out (`scratchpad/audit/tools/`);
- inspection of the built manifests in `dist/` and `dist-firefox/` (they were rebuilt by another process during the audit).

Ratings: severity CRITICAL / HIGH / MEDIUM / LOW; effort S (< ½ day), M (1–3 days), L (> 3 days); regression risk
(RR) low / med / high. UNVERIFIED = inferred, not reproduced.

**Headline: no CRITICAL or HIGH finding.** The security fundamentals are solid: tokens are encrypted, senders are
allowlisted, payloads are guarded, URLs and images are filtered, the CSP is strict, backup import is defensive, and
there is no `any`. The main residual risks: integrity (any script running on a supported streaming page can steer
what gets written to AniList/MAL), supply chain in the release workflow, and test coverage gaps on several
write paths. The code would also benefit from a few large factory functions being split.

---

## 0. Controls verified as sound (no action)

| Control | Evidence |
|---|---|
| Tokens: AES-GCM 256, random 96-bit IV per write, the service bound as AAD, ciphertext bounded, version tag | `src/shared/token-crypto.ts:9-85` |
| Non-extractable key, origin-checked, created race-free (read and put in one readwrite tx) | `src/shared/token-key-store.ts:15-82` |
| Legacy plaintext tokens migrated under the lock; an unreadable token closes the session ("Session expirée") | `src/shared/token-access.ts:9-30`, `src/shared/storage.ts:129-160` |
| Token comparisons on decrypted values; renewed MAL token saved only if the epoch and the previous token still match | `src/shared/storage.ts:344-347, 422-430` |
| MAL: PKCE + `state` checked; refresh behind `navigator.locks` with a timeout | `src/background/auth/mal.ts:89-130, 164-193` |
| Message gate: `sender.id`, then type + payload guard (exhaustive record), then a per-type origin allowlist | `src/background/background.ts:183-198`, `src/background/message-guards.ts:38-186` |
| Content-side listeners check `sender.id` (+ extension URL for history ports) | `src/content/start.ts:73-74,129-131`, `src/content/lib/history-port.ts:9-34` |
| Log redaction (Bearer, OAuth params, JWT, JSON keys) before the error journal | `src/shared/error-journal.ts:35-80` |
| No HTML sinks (`innerHTML`, `insertAdjacentHTML`, `eval`) anywhere in `src/`; DOM built node by node | grep: 0 hits outside comments |
| External URLs: `toSafeUrl` (https only, host pinned for AniList), images restricted to `IMAGE_HOSTS` = CSP `img-src` | `src/shared/url.ts:1-51`, `manifest.json:36-38` |
| Backup: size checked before reading, strict validation, `__proto__` keys inert, mappings marked `unverified` | `src/import/import.ts:76-83`, `src/shared/backup.ts:85-115, 206-256` |
| Bridge decoders on the isolated side revalidate everything (Disney+ bounded, Crunchyroll read through `own()`) | `src/content/disney/bridge-protocol.ts:583-592`, `src/shared/crunchyroll-metadata.ts:255-261` |
| Production packages: no source maps, `key` stripped, dev-only diagnostic absent | `scripts/package.ts:156-204`; `grep debug:matchDiagnostic dist dist-firefox` → none |
| Progress written only if it is an integer ≥ 1 and ≤ episodes; never decreases (outside corrections) | `src/background/sync/matching.ts:490-492`, `src/background/sync/rules.ts:47-66` |

---

## 1. Security and privacy

### SEC-01 · MEDIUM · effort M · RR med — Any script on a supported page can steer list writes
- The synced episode comes entirely from the page: DOM/JSON-LD (`content/adapters/*`), the `<video>` element and,
  since this branch, MAIN-world bridge signals. Any script running on `*.crunchyroll.com` / ADN (third-party ad or
  analytics scripts, an XSS, or a network attacker on http: see SEC-02) can:
  - render a fake watch page;
  - play a short `<video>` to its end;
  - get `EPISODE_COMPLETED` sent for any title and number (`src/background/background.ts:122`,
    `src/background/episode-completed.ts:24-39`).
- The rules allow an entry missing from the list to be added (`entry === null` → `update`, `src/background/sync/rules.ts:59-66`) and an
  arbitrary forward jump, up to `COMPLETED` (`progressWrite`, `rules.ts:34-39`).
- New on this branch: signals can raise a title-only match to `high` (proof rule, `concordance.ts` + `matching.ts:826-963`).
  So forged signals (SEC-05) can turn a « À vérifier » card into a direct write to an entry the attacker picks among
  the candidates.
- Impact: integrity of the user's AniList/MAL list (reversible), no secret exposed.
- Fix:
  - an anomaly guard in `decideListUpdate`: an entry missing from the list, a jump > N episodes, or a jump straight to the last episode from far away → « À vérifier » card instead of a write;
  - rate-limit `EPISODE_COMPLETED` per tab / per series;
  - do not let signals alone upgrade to `high` when the page supplied the only proof (or only for signals from verified bridges).

### SEC-02 · MEDIUM · effort S · RR low — `*://` patterns inject on plain http
`manifest.json:24-26,32-34,46,56-58,71-73`: `host_permissions`, `content_scripts`, `optional_host_permissions` and
`web_accessible_resources` all use `*://`, so the content scripts (and the Crunchyroll MAIN bridge) also run on
`http://` pages. A network attacker on any non-HSTS subdomain can serve a fake page that drives SEC-01. Whether every
Crunchyroll / ADN subdomain is HSTS-preloaded is UNVERIFIED. The Crunchyroll bridge already requires https for the
requests it reads (`src/content/crunchyroll/bridge-protocol.ts:78`): keep the same rule for the pages. Fix: `https://*.crunchyroll.com/*`,
and the same for the other patterns. Narrowing permissions never triggers a new install warning. Update
`docs/store/permissions.md` and the test in `scripts/store-permissions.test.ts`.

### SEC-03 · MEDIUM · effort S · RR low — Release workflow runs actions pinned to mutable tags while holding store secrets
- `.github/workflows/release.yml` and `ci.yml` use `actions/checkout@v7`, `setup-node@v7`, `upload-artifact@v7`,
  `download-artifact@v8` (18 occurrences).
- The `chrome` and `firefox` jobs run with `environment: stores` (CWS refresh token, AMO JWT secret). A compromised or
  retagged action release would see these secrets.
- `setup-node` with `cache: npm` in the secret-holding jobs adds a (low) cache-poisoning surface.
- Fix:
  - pin by commit SHA (Dependabot `github-actions` already updates pins, `.github/dependabot.yml`);
  - drop `cache: npm` in the `chrome` / `firefox` / `github-release` jobs;
  - consider `step-security/harden-runner`, or at least `permissions: {}` per job (already done).

### SEC-04 · LOW · effort M · RR low — `chrome.storage.local` is a shared trust boundary but read guards are shallow
- Content scripts can read and write `storage.local` (they read settings: `src/content/lib/watch-session.ts:51`,
  `src/content/lib/cr-history-port.ts:3`). A compromised renderer of a streaming page can therefore:
  - read the whole SyncKai history: mappings, recent syncs on every platform, account names, error journal;
  - plant values.
- Tokens are protected (ciphertext, key unreachable from content scripts). Other cached data is validated only
  shallowly: `isWatchingList` checks `title/progress/totalEpisodes/platforms` but not `platforms[].url`, `siteUrl`,
  `lastSync.episodeUrl` (`src/shared/watching.types.ts:65-80`, "volontairement superficielle"). Those URLs become `href`
  in the popup (`src/popup/components/watching-screen.ts:242,369,473` via `choosePlatformLink`, `src/shared/watching.ts:148-156`)
  and are passed to `chrome.tabs.create` from airing notifications (`src/background/airing.ts:316-336`).
- The CSP blocks `javascript:` execution in extension pages, so the impact is an open redirect or phishing link.
- Fix:
  - revalidate link URLs on read (`toSafeUrl` + the platform host allowlist of `platformFromHost`) in `isWatchingList` or at render;
  - longer term, serve settings to content scripts through a message so storage could be restricted (whether `setAccessLevel` is available for `local` on Chrome and Firefox is UNVERIFIED).

### SEC-05 · LOW · effort S · RR low — Bridge handshake: guarantees are weaker than the comments say
- The nonce travels in a `CustomEvent` dispatched on `document` (`src/content/crunchyroll/bridge-client.ts:181`), so any
  page listener reads it. `window.postMessage` from the page is always `isTrusted`, so the `isTrusted` check
  (`bridge-client.ts:162,173`) does not protect against page scripts.
- The real guarantee is ordering: the bridge's capture listener is installed at `document_start`. This holds for the
  manifest-declared Crunchyroll bridge. It does not hold for re-injected bridges (`content-reinjection.ts`,
  `platform-access.ts` › `executeScript` after the page has loaded), where a page listener can post a forged offer
  first. The Netflix comment admits this (`src/content/netflix/page-bridge.iife.ts:12-16`); the Crunchyroll one does not.
- `page-bridge.iife.ts:42-46` (Crunchyroll) says « une redéfinition ultérieure par la page ne détourne pas le canal », but only
  `MessageChannel`, `CustomEvent`, `JSON.parse` and `postMessage` are captured:
  - `JSON.stringify`, `Map`, `Array.prototype.*` and `MessagePort.prototype.postMessage` stay page-controlled;
  - the MAIN reducers read inherited properties, so `Object.prototype` pollution by the page feeds values.
- Impact: forged matching signals (feeds SEC-01); nothing secret crosses the channel.
- Fix:
  - state explicitly in the 4 bridge headers that MAIN data equals page-authored data;
  - use `Object.hasOwn` in the MAIN reducers (cheap);
  - never let bridge-only data be the sole proof for `high` (see SEC-01).

### SEC-06 · LOW · effort S · RR low — Tokens are decrypted in an extension page, against the documented invariant
`CLAUDE.md` › Encrypted OAuth tokens says "Decryption in the service worker only". But `src/shared/diagnostics-store.ts:12,24`
calls `readTokenSecrets()` (`src/shared/token-access.ts:39-52`), which decrypts both tokens. It is imported by the
settings Help page (`src/ui/settings/page-help.ts:5`). Same origin, so this is not an escalation, but the invariant is
not enforced. Fix:
- build the diagnostic report (or only the masking step) in the service worker through a message;
- add an architecture rule: `shared/token-access.ts` may be imported only from `background/`.

### SEC-07 · LOW (informational) · effort S · RR none — State the threat model of encryption at rest
- The non-extractable key lives in the same profile's IndexedDB. It defeats:
  - content-script reads of `storage.local`;
  - accidental leaks (backups, diagnostic report, devtools copy).
- It does not defeat an attacker who can read the profile directory.
- `expiresAt` is in plaintext and outside the AAD (`token-crypto.ts:16-20,55`): tampering only affects the UI
  (`hasValidAniListToken`), since `getValidToken` uses the decrypted copy.
- Fix: document both points in `PRIVACY.md` / `CLAUDE.md`; optionally add `expiresAt` to the AAD.

### SEC-08 · LOW · effort S · RR low — AniList implicit grant without `state`
`src/background/auth/anilist.ts:24-28`: no `state` parameter is sent or checked (MAL does it, `mal.ts:90,128`).
`launchWebAuthFlow` makes response injection hard, so this is defense in depth only. Whether AniList echoes `state` in
the fragment is UNVERIFIED.

### SEC-09 · LOW · effort S · RR med — Extension fingerprinting by streaming sites
Built manifest: content-script chunks are web-accessible to `*.crunchyroll.com` / ADN with `use_dynamic_url: false`
(`dist/manifest.json` › `web_accessible_resources[0]`). Any page on those sites can probe
`chrome-extension://khokcmigioggannjoojambdgioigdceb/assets/…` to detect SyncKai (the ID is public). The toast host
element in the page DOM gives the same signal. `use_dynamic_url: true` would mitigate this on Chrome; its compatibility
with the crxjs ESM loader is UNVERIFIED (hence RR med).

### SEC-10 · LOW · effort S · RR low — `isEpisodeInfo` accepts unbounded strings and non-finite numbers
`src/shared/episode.types.ts:85-106`: `animeTitle`, `episodeId`, `url`, `seriesSlug`, `seasonTitle` and `episodeTitle`
have no length bound, and `isNullableNumber` accepts NaN, ±Infinity, negatives and decimals (Firefox messaging uses
structured clone and keeps NaN/Infinity). `isPageMediaInfo` bounds the same fields (`isShortString`,
`src/shared/page-media.types.ts:65-85`). Progress is still protected downstream (`isValidProgress`), but these strings
are persisted in the queue, review cards and recent syncs: storage quota pressure (10 MB, no `unlimitedStorage`).
Fix: reuse `isShortString` / finite-integer guards in `isEpisodeInfo`.

### SEC-11 · LOW · effort S · RR low · UNVERIFIED — Crunchyroll import device registration and ToS exposure
`src/content/lib/crunchyroll-history.ts:17,151-158`: the import mints a Crunchyroll token with the site's public web
client id, `device_type: 'SyncKai'` and a fresh `crypto.randomUUID()` device id on each import
(`src/content/lib/cr-history-port.ts:30`). This may list a new "SyncKai" device on the user's account at every import.
Fix: a stable per-install device id; mention it in `PRIVACY.md`.

### SEC-12 · LOW · effort S · RR med — CSP could be tightened
`manifest.json:36-38`: `script-src 'self'; object-src 'self'; img-src …`. There is no `default-src`, `connect-src`,
`base-uri`, `form-action` or `frame-ancestors`. Add `default-src 'self'; connect-src 'self' https://graphql.anilist.co https://api.myanimelist.net https://myanimelist.net;
base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. RR med: the service worker shares this CSP and fetches
the lazy locale catalogs (`'self'`); a test like the one for `img-src` should keep it in sync.

### SEC-13 · LOW · effort S · RR low — Dev-only stripping is checked by hand only
`CLAUDE.md` asks for a manual `grep -rl debug:matchDiagnostic dist`. `scripts/verify-build.ts` checks budgets and
dynamic `import()` (`:104-128`) but not:
- the absence of dev-only markers (`debug:matchDiagnostic`, `[disney]` debug strings, `settings.matchDiag` UI code);
- that `chrome.` and `fetch(` stay out of the MAIN-world bundles (an IIFE bridge must never touch `chrome.*`).

Add both to `verify-build`. 113 `log.debug/info` calls are not wrapped in `if (__SYNCKAI_DEBUG__)`: they are no-ops in
production, but their template strings are still evaluated and shipped.

### SEC-14 · LOW · effort S · RR low · UNVERIFIED — `LOGIN_MAL` does not close an open MAL session first
AniList clears the previous session before saving a new token (`src/background/auth/anilist.ts:78`); MAL saves it
directly (`src/background/auth/mal.ts:132-134`, `src/shared/storage.ts:412-415`), with no epoch bump. The UI only offers MAL
login when the session is closed, so this is probably unreachable today. The service worker does not enforce it,
though (two pages or a double click). The two token writes `saveToken` / `saveMalToken` also skip the storage lock.

### SEC-15 · LOW · effort S · RR low — Dev-tool advisories in the release job
`npm audit`: 3 high (node-forge via `web-ext` → `@devicefarmer/adbkit`). Nothing is shipped, but `web-ext sign` runs
with the AMO secrets. Track the `web-ext` upgrade (major update blocked in `dependabot.yml`).

---

## 2. Type safety and validation

| Item | Finding | Rating |
|---|---|---|
| `any`, `@ts-ignore`, `eslint-disable` | 0 / 0 / 0 in `src` and `scripts`; ~15 type assertions in `src`, each behind a guard (e.g. `src/background/api/list.ts:73-74`, `src/background/api/mal.ts:31-33`) | — (good) |
| Implicit `any` | `Array.isArray(unknown)` narrows to `any[]`: `src/content/adapters/adn.ts:192`, `src/content/lib/crunchyroll-history.ts:230` (spread of `any[]` into `items`). Caught by `no-unsafe-*` (probe: 10 hits, 4 of them in `src`) | LOW · S |
| `noUncheckedIndexedAccess` | Probe: 130 errors, 78 outside tests (47 in `matching.ts`, then adn.ts, page-media-rules.ts, target-pages.ts). Mostly regex groups and `[0]` after a length check. Worth enabling progressively (start with `shared/`, `content/`) | MEDIUM · M · RR low |
| `exactOptionalPropertyTypes` | Probe: 16 errors: cheap, catches `prop: undefined` vs. absent mismatches in the stored shapes | LOW · S |
| External API validation | AniList: every query passes a guard to `request()` (`src/background/api/client.ts:97-101`); MAL token response checked (`auth/mal.ts:22-27`). Minor: `parseEntry` accepts any number for `progress`/`repeat`/`score` (no `Number.isFinite`/integer check, `api/list.ts:72-78`) | LOW · S |
| Stored data guards | Deep for settings, mappings, backups. Shallow for `WatchingList` (see SEC-04) | LOW · S |
| Message guards | Exhaustive and typed; branch coverage 49% (`message-guards.ts`): many negative paths untested | LOW · S |
| `afterI18n` | `void i18nReady.then(run)` with `run: () => unknown` (`src/background/background.ts:58-60`) hides a returned promise from `no-floating-promises`. `processSyncQueue` catches internally (`queue.ts:124-127`), so this is latent only | LOW · S |

---

## 3. Tests and tooling

### 3.1 Numbers
- Unit: 179 files, 2456 tests, 37 s; coverage 82.9% statements, **77.7% branches**, 84.4% lines (v8, `include: src/**`).
- Coverage is report-only (`vitest.config.ts:20-26`, no thresholds) and is not run in CI.
- The popup / panel e2e (Puppeteer on a mocked chrome) and `test:ext` (real extension, 32 scenarios) are not counted in these numbers.

### 3.2 Coverage gaps on critical paths (unit lines %)
| File | Lines | Why it matters |
|---|---|---|
| `src/background/controls.ts` | 37.9% | `ADJUST_PROGRESS` / `SET_LIST_STATUS`: direct list writes (+1/−1, status) |
| `src/background/auth/anilist.ts` | 57.5% (2 tests) | sign-in error branches, replacing an expired session |
| `src/background/compare.ts` | 50% | alignment job that writes to both services |
| `src/background/api/panel-media.ts`, `api/viewer.ts` | 46% / 15% | response parsing of untrusted API data |
| `src/sidepanel/presence.ts` | 8.2% | panel follow-tab / off-target logic (regressions seen in CLAUDE.md history) |
| `src/popup/components/watching-screen.ts`, `compare-section.ts` | 5.6% / 10% | covered partly by `popup.e2e.ts` only |
| `src/ui/media-actions.ts`, `ui/star-rating.ts`, `ui/settings/page-sync.ts`, `page-accounts.ts` | 4–17% | shared UI kit |
| `src/content/netflix/page-bridge.iife.ts` | 44.8% | MAIN bridge: request and error paths |
| `src/shared/token-key-store.ts` | mocked globally (`src/test/setup.ts:9`) | the real IndexedDB path (origin check, race, unavailable IDB) is only exercised by `test:ext`, which is not in CI |
| MAL refresh end to end | not covered | `scripts/ext-e2e/seed.ts:15`: no fake `oauth2/token`, expiry set far away |
| `launchWebAuthFlow` flows | not covered end to end | CDP cannot drive the identity window; the unit tests mock it |
| Firefox runtime | not covered | only `web-ext lint`; `content.fetch`, Xray wrappers, sidebar, structured-clone messaging never execute in a test |

### 3.3 Flaky patterns
Rating: MEDIUM · effort S · RR low.
- Bridge tests depend on real time:
  - `src/content/disney/bridge-client.test.ts:143-279` uses `delay(5…80)` and asserts `Date.now() - started >= 35` (`:170`);
  - `flush = setTimeout(10)` relies on real `MessageChannel` delivery (`crunchyroll/page-bridge.test.ts:106`, `disney/page-bridge.test.ts:98`, `prime/page-bridge.test.ts:81`, 8 files in all);
  - `content/lib/page-media.test.ts:46` waits a real 1 s.
- These fail on a loaded CI runner. Use `vi.useFakeTimers()` with `advanceTimersByTimeAsync`, or await a port message
  instead of a timer (25 files already use fake timers).

### 3.4 Duplication
- Small helpers redefined per file: `flush` (8), `episode` builders (16), `media` / `candidate` (10).
- The matching tests are split across 8 `matching-*.test.ts` files with their own fixtures.
- A shared `src/test/builders.ts` (episode, candidate, AniList media) would cut drift when `EpisodeInfo` grows
  (as with `signals`). LOW · S.

### 3.5 Matching corpus (`src/background/sync/__corpus__`)
- Strong points:
  - 63 real cases on 5 platforms, the real resolver against AniList snapshots;
  - the request budget is frozen too (`searches`);
  - `ideal`/`gap` todos (4);
  - `MEDIA_FIELDS` parity with `api/media.ts` is tested.
- Weaknesses:
  - `expected` = "what the current code returns" (README): a golden master. A snapshot refresh followed by
    "accept the diff" can bless a regression. Ask for a one-line `why` per case and keep the `ideal` set growing;
  - 14 signal blocks are « SUPPOSÉ » (assumed). ADN has 5 cases and no real signals (ADN playback sends none);
  - no adversarial case (forged / contradictory signals, see SEC-01/05) and no import-path case (CR / ADN / Netflix
    history plans);
  - all snapshots date from 2026-10-14 (`fetchedAt`): plan a periodic refresh with review, since catalog drift is the
    expected failure mode.

### 3.6 Architecture test (`src/architecture.test.ts`)
- Good: cycles, layers, the PERF-01 content weight list, `messages.ts` type-only.
- Missing rules (LOW · S each):
  1. importers of `shared/token-access.ts` (decryption) limited to `background/` (SEC-06);
  2. the values-reachable graph of `content/*/page-bridge.iife.ts` must not contain any module that touches `chrome.*` or `storage`;
  3. `shared/diagnostics-store.ts` imports the full catalog `i18n` index: allowed by the rule, but it is the only
     `shared/` module doing it. Check whether that is intended.

### 3.7 Lint rules worth adding
Probed with the current config plus CLI rules; counts are outside tests.

| Rule | Hits | Value |
|---|---|---|
| `no-unsafe-assignment/-argument/-return/-member-access/-call` | 4 in `src` (the rest in `scripts/`) | closes the implicit-`any` hole that `no-explicit-any` leaves open (`JSON.parse`, `res.json()`, `Array.isArray`) |
| `no-unnecessary-condition` | 161 in `src` (`import-cr.ts` 14, `popup.ts` 12, `matching.ts` 10…) | dead guards, stale `?.` after type changes; noisy, enable per directory |
| `no-unnecessary-type-assertion` | 7 | cheap |
| `no-deprecated` | 4 (puppeteer `postData`, `setCookie` in `scripts/ext-e2e`) | catches chrome/puppeteer API deprecations before they break |
| `require-await` | 154, all in tests | tests only, optional |
| `no-restricted-syntax` / `no-restricted-properties` | n/a | ban `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`; `localStorage` outside `content/lib/adn-history.ts`; `console.*` outside `shared/logger.ts` |
| `max-lines-per-function` (warn, ~200) | 11 functions above it | stops the factory functions from growing further |

### 3.8 CI gaps (`.github/workflows/ci.yml`, `release.yml`)
Severity, effort and fix:
1. `npm run test:ext` (32 real-extension scenarios: token encryption, account switch, playback, imports) runs in
   neither CI nor `release.yml`. **MEDIUM · S**: a non-blocking job on `develop` first, then required before tagging.
   It needs a full Chromium (`SYNCKAI_EXT_CHROME`).
2. Actions pinned by tag (SEC-03). **MEDIUM · S**.
3. No coverage job: add `vitest --coverage` with a ratchet on branches (current 77%). **LOW · S**.
4. No SAST or secret scanning (CodeQL for JS/TS is free for public repos). **LOW · S**.
5. No Firefox runtime smoke test (only `web-ext lint`): `web-ext run` + Playwright Firefox, or a minimal Marionette
   check. **LOW · L**.
6. `i18n-layout` is informative by design (OK).

---

## 4. Maintainability hotspots (top 15)

Measured on `src/` (269 non-test files, 43.2 k lines). Long functions are mostly closure "factories" (`createX`) that
hold state, render and handlers together. Fan-out = distinct relative imports.

| # | File (lines · longest function) | Problem | Split proposal (one line) |
|---|---|---|---|
| 1 | `src/sidepanel/components/agenda.ts` (719 · `createAgenda` **623**) | one closure: state, week loading, rendering, editor, keyboard | `agenda-state.ts` (store + `loadWeek`), `agenda-view.ts` (pure render of a week), `agenda-editor.ts` (`renderEditor`) |
| 2 | `src/background/sync/matching.ts` (1379 · `resolveByRules` 190; 56 exports) | platform link parsing, mapping keys, season titles, signal groups and rule engine in one module | `platform-link-match.ts` (matchXLink, `*InLink`), `mapping.ts` (`mappingKey`/`applyMapping`), `season-titles.ts`, `signal-groups.ts` (signalGroups/provenTarget), `rules-engine.ts` (`resolveByRules`, split into numbered/absolute/title-only branches) |
| 3 | `src/import-cr/import-cr.ts` (1175 · `renderPreview` 107; 24 imports) | one screen file for 3 platforms (CR, ADN, Netflix readers) + preview + apply | `readers/{crunchyroll,adn,netflix}.ts` (port/tab drivers), `preview-view.ts`, `import-state.ts` |
| 4 | `src/ui/page-media-controller.ts` (573 · `createPageMediaController` **424**) | rate limiting, anti-echo, cache, live events, locale reload in one closure | `redetect-limiter.ts` (1/2 s, 5/min, `navigated()`), `tab-cache-echo.ts` (own-write stamps), controller kept as glue |
| 5 | `src/sidepanel/components/now-playing.ts` (491 · `createNowPlaying` **415**) | render + live progress + relations + actions | `now-playing-header.ts`, `relations-list.ts`, reuse `ui/media-actions.ts` for actions |
| 6 | `src/popup/controllers/watching.ts` (486 · `createWatchingController` **393**) | fetch, sort, optimistic updates, row menu actions | `watching-store.ts` (fetch/cache/sort), `watching-actions.ts` (+1, status, remove) |
| 7 | `src/content/lib/watch-session.ts` (466 · `startWatchSession` **367**) | video discovery, tracker, completion, toasts, live port, settings in one function (content budget-sensitive) | `session-video.ts` (findVideo polling), `session-sync.ts` (`syncWithFeedback`); keep it tree-shake-friendly for the 83 KB budget |
| 8 | `src/ui/settings/settings-view.ts` (431 · `createSettingsView` **373**) | router + every page wiring | one route table `{ id, create }` + a lazy page factory per route |
| 9 | `src/popup/popup.ts` (856 · `render` 90; **fan-out 46**) | composition root that also owns state transitions | `popup-state.ts` (reducer), `popup-routes.ts`; `popup.ts` stays the bootstrap |
| 10 | `src/popup/components/watching-screen.ts` (747 · `renderRowMenu` 107) | hero, rows, menus, search links | `row-menu.ts`, `resume-hero.ts`, `watching-row.ts` |
| 11 | `src/shared/storage.ts` (657 · 51 exports, fan-in 36) | tokens, sessions/epochs, viewers, mappings, reviews, recent syncs, cleanup | `token-store.ts`, `session-store.ts` (epochs, `clear*Session`, `writeIfSession`), `mapping-store.ts`, `review-store.ts`; `storage.ts` re-exports during migration |
| 12 | `src/background/cr-import.ts` (666 · `applyItem` 76) + `src/shared/cr-import.ts` (550 · `buildCrImportPlan` 100, 57 exports) | analysis, plan, apply and reviews for 3 platforms | `import/analyze.ts`, `import/apply.ts`, `import/plan.ts` (pure), with the platform reducers already separate |
| 13 | `src/background/sync/resolver.ts` (496 · `collectCandidates` 149) | candidate gathering = searches + relations + alignment + gates | `candidate-search.ts` (searches with diacritics/slug fallbacks), `candidate-relations.ts` (sequel/prequel fetch rules), keep `collectCandidates` as a pipeline |
| 14 | `src/background/sync/sync-service.ts` (504 · `syncEpisode` 63; fan-out 26) | resolve + per-service write + queue + feedback | `service-writer.ts` (per-tracker write + error mapping), `sync-service.ts` orchestration only |
| 15 | Bridges: `content/{netflix,disney,prime}/bridge-client.ts` (254/260/244 · factories 160–178) + 4 `bridge-protocol.ts` | handshake / port offer / install-once / timeouts reimplemented 4 times | shared `content/lib/bridge-channel.ts` (handshake, offer, version guard, request/response with timeout); Crunchyroll keeps its minimal client for the budget |

Coupling notes:
- No cycles (enforced). Hubs to watch: `shared/storage.ts` (fan-in 36, mixed concerns), `shared/messages.ts` (fan-out
  20, types only: fine), `background/background.ts` (fan-out 34: an expected composition root).
- `ui/` → `shared/diagnostics-store.ts` → `token-access` is the one path where a screen reaches decryption (SEC-06).

---

## 5. Suggested order

1. SEC-02 (https patterns), SEC-03 (SHA-pin actions, no npm cache in secret jobs), SEC-10 (bound `isEpisodeInfo`): S each, low RR.
2. SEC-01 anomaly guard (missing entry / big jump → « À vérifier ») + a rule that bridge-only signals never make a
   title-only match `high`: M, med RR; add corpus cases for it.
3. CI: `test:ext` job, coverage ratchet, de-flake the bridge tests (fake timers).
4. Lint: `no-unsafe-*`, `no-unnecessary-type-assertion`, `no-deprecated`, the restricted-syntax bans; architecture
   rules for `token-access` and the MAIN bundles; `verify-build` checks for dev markers and `chrome.` in MAIN.
5. Unit tests for `background/controls.ts`, `auth/anilist.ts`, `sidepanel/presence.ts`, MAL refresh (fake
   `oauth2/token` in `test:ext`).
6. Refactors 1, 4, 2, 11 of the hotspot table (largest closures and the storage hub first), each behind the existing
   tests; `noUncheckedIndexedAccess` per directory.
