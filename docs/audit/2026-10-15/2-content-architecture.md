# Audit 2 — Content-script architecture (SyncKai, `feature/match-signals` @ 9a5d08c)

Scope: `src/content/**`, the four MAIN-world bridges, the shared reducers they use, `background/platform-access.ts` / `platform-scripts.ts` / `content-reinjection.ts`, and the build budgets. Read-only audit: no repo file was changed. I ran `npx vite build` (and once with `--sourcemap` for attribution) into `dist/`, then rebuilt `dist/` without source maps. Every other build went to the session scratchpad: standalone Vite IIFE builds of the real entries, plus a scratch copy of `src/` for the "what if" variants.

## 0. Measured baseline

`node scripts/verify-build.ts` (Chrome, identical on Firefox):

| Bundle | Size / budget |
|---|---|
| CR/ADN content script (loader + 14 ESM chunks) | **83.0 / 83.0 KB** |
| CR MAIN bridge | 7.3 / 9 KB |
| Netflix (content + bridge) | 60.4 / 65 KB |
| Disney+ (content + bridge) | 68.4 / 75 KB |
| Prime Video (content + bridge) | 72.1 / 75 KB |
| Unreferenced files shipped in the package | 9 files, **43.0 KB** (`assets/*.iife.ts-*.js`, `assets/bridge-protocol-*.js`, `assets/page-bridge.iife.ts-*.js`) |

Per-module attribution of the CR/ADN content script (source maps, minified bytes). The largest entries: `adapters/crunchyroll.ts` 7.8 KB, `lib/crunchyroll-history.ts` 6.9 KB, chunk glue / unmapped 6.7 KB, `watch-session.ts` 5.4 KB, `ui/toast.ts` 4.0 KB, `ui/kai-small.ts` 3.7 KB, `adapters/adn.ts` 3.6 KB, `i18n/content.ts` 3.2 KB (English catalog: 2.7 KB of JSON), `i18n/core.ts` 3.0 KB, `shared/settings.ts` 2.6 KB, `shared/error-journal.ts` 2.6 KB, `engagement-prompt` 2.5 KB, `lib/adn-history.ts` 2.5 KB, `ui/star-rating.ts` 2.4 KB.

**Key finding:** the CR/ADN script is the only one that crxjs builds as ESM chunks shared with the popup, the panel and the service worker. Rolldown tree-shakes each shared chunk for the union of its importers, so the content script loads code it never runs. Examples, as shipped vs. in a standalone build: `shared/sync.types` 1464 → 111 B, `shared/cr-history` 1553 → 168 B, `shared/live.types` 928 → 45 B, `page-media.types` / `episode.types` ~750 B → 0, `i18n/core` 2988 → 1773 B. It also pays about 2 KB of import/export glue across 15 files.

## 1. Duplication map

### 1.1 The four MAIN bridges

| Concern | Crunchyroll `crunchyroll/page-bridge.iife.ts` | Disney+ `disney/page-bridge.iife.ts` | Prime `prime/page-bridge.iife.ts` | Netflix `netflix/page-bridge.iife.ts` | Similarity |
|---|---|---|---|---|---|
| Frozen references (`Channel`, `CustomEventType`, `parseJson`, `postToWindow`) | l.43-46 | l.47-50 | l.43-46 | l.34-37 (no parseJson, has `MessageEventType`) | identical |
| `MAX_PORTS = 4` + `ports[]`, oldest closed | l.36, 53, 182-183 | l.42, 58, 211-212 | l.38, 53, 192-193 | **none** (one channel per handshake, never capped) | identical (3), missing (1) |
| `MAX_RESPONSE_LENGTH` + `parseText` | l.40, 113-120 (4 MB) | l.44, 132-139 (2 MB) | l.40, 114-121 (4 MB) | n/a (active fetch) | identical except the constant |
| `urlOf` / `observe(input)` | l.123-126 (inlined) | l.142-155 | l.124-136 | n/a | identical |
| `observeXhr` (open/send patch, WeakMap, `load` once, status 200, text/json) | l.129-158 | l.158-187 | l.139-168 | n/a | **byte-for-byte identical** |
| `observeFetch` (clone → text → parse) | l.161-174 | l.190-203 | l.171-184 | n/a | byte-for-byte identical |
| `onHandshake` (decode → channel → offer → snapshot) | l.177-186 | l.206-216 | l.187-196 | l.74-82 (no snapshot, request listener) | identical except the snapshot |
| Version guard `installXBridgeOnce` (+ `xBridgeFlag`) | `bridge-protocol.ts:44-55` | `bridge-protocol.ts:172-188` | `bridge-protocol.ts:114-125` | `bridge-protocol.ts:101-117` (v1 legacy key) | identical except the flag string |
| Bounded LRU `keep` / `trim` | l.56-60 | `trim` l.67-69 + manual delete/set | l.72-76 | client: `remember` `bridge-client.ts:112-120` | 4 variants of one helper (plus `prime/bridge-client.ts:93-97`) |
| `parseJson(detail, max)` | inline in `decodeCrunchyrollPush` (**no cap**) | `bridge-protocol.ts:544-551` | `bridge-protocol.ts:259-268` | `bridge-protocol.ts:190-197` | identical (3), divergent (1) |
| Handshake / offer codecs | compact string `"v:nonce"`, fixed-string offer (`bridge-protocol.ts:93-109`) | JSON `{v,nonce}` + `decodePortOffer` with `includes()` pre-filter (l.555-576) | same as Disney (l.270-290) | same as Disney (l.202-223) | 3 identical JSON codecs + 1 compact one |
| Push encoding + bounded revalidating decode | `decodeCrunchyrollPush` l.119-128 | `decodeDisneyPush` l.583-593 | `decodePrimePush` + `validList` l.297-315 | `decodeNetflixResponse` l.239-248 | same pattern, different shapes |

Minified duplicated "kit" code per bridge: CR 2126 B, Disney 2132 B, Prime 2316 B (`page-bridge.iife.ts` share of each IIFE). The rest is the platform's reducers.

### 1.2 The isolated clients (`*/bridge-client.ts`)

| Concern | Netflix | Disney+ | Prime | Crunchyroll | Similarity |
|---|---|---|---|---|---|
| Options `{target, messages, origin, isTrusted, newId, timeouts, log}` | l.22-42 | l.31-57 | l.25-43 | l.7-16 | same shape |
| `openChannel()`: nonce, `message` listener, trusted + origin + nonce check, first port, timeout | l.158-177 | l.142-161 | l.130-148 | l.43-53 (fixed-string compare, no timeout) | **near-identical (3)** |
| `connect()`: `port` / `opening` memo + `start()` | l.180-192 | l.164-179 | l.150-163 | inline | identical (3) |
| `onPortMessage`: `instanceof MessageEvent && isTrusted` then decode | l.147-151 | l.120-131 | l.103-128 | l.33-41 | identical guard |
| `until(get, signal, timeout)` with listeners Set | Netflix uses `untilAborted` l.83-93 | l.224-242 (`undefined` = keep waiting) | l.166-184 (`null` = keep waiting) | n/a | **two divergent copies** of one helper |
| Lazy singleton `bridge()` in the adapter | `adapters/netflix.ts:151-155` | `adapters/disney.ts:421-425` | `adapters/prime.ts:203-207` | `adapters/crunchyroll.ts:59-65` | identical |

### 1.3 The five adapters

| Concern | Where | Similarity |
|---|---|---|
| `supportsHost` = `host === d \|\| host.endsWith('.'+d)` | `crunchyroll.ts:478`, `adn.ts:227`, `netflix.ts:163`, `disney.ts:472`, `prime.ts:282` (plus `shared/platforms.ts:45` `domainOrSubdomain`, `prime-metadata.ts:182`, the 3 protocol host checks) | identical, 10 copies |
| Strategy loop `for (strategy of STRATEGIES) { fields = run(id); labels.remember(); log.info(...); return {...} }` | `crunchyroll.ts:489-497`, `adn.ts:238-246` | identical |
| JSON-LD → DOM fallback with `LabelGuard` | `crunchyroll.ts:118-186`, `adn.ts:73-134` | same pattern (CR adds `isUnsettled`) |
| Series title chain JSON-LD → `<h1>` → `og:title` → slug | `crunchyroll.ts:452-456`, `adn.ts:212-216` | identical chain |
| `withSignals` = `signals ? { signals } : {}` | `netflix.ts:53`, `crunchyroll.ts:70`, `adn.ts:218`, `disney.ts:139/147/249`, `prime.ts:113/148`, `shared/netflix-import.ts:350/373` | 10 copies |
| Season menu watch | CR / Netflix / Disney+ through `lib/season-watch.ts › watchElementText` | already shared |
| Bridge-backed adapter skeleton: `extractEpisodeInfo` = peek + map, `loadEpisodeInfo` = load + map, `detectSeries` = peek page, `loadSeries` = load page, `quiet: true` | `netflix.ts:171-204`, `disney.ts:481-526`, `prime.ts:290-345` | same template, different id sources (Disney+ `since`, Prime has no URL id) |
| Debug "video chosen" reporter (`reportedVideo`) | `disney.ts:528-538`, `prime.ts:347-354` | identical |
| Signal building | `crunchyrollTableSignals` (bridge table), `netflixSignals`, Disney+ `playbackSignals`, `primeSignals`, `adnSeriesSignals`, all ending in `toPlatformSignals` | already centralized in `shared/*-metadata.ts` (good) |

## 2. Factorisation proposal

The hard constraints all hold here. Each `*.iife.ts` stays self-contained, because the kit is inlined by the IIFE build. The kit never reads `chrome.*`, request or response headers, cookies or tokens. Module boundaries are respected: DOM / XHR code stays in `content/`, and only pure helpers move to `shared/`.

### 2.1 Passive bridge kit (Template Method), `src/content/bridge/kit.ts`

```ts
// Kit des ponts passifs du monde MAIN : aucun chrome.*, aucun en-tête, aucun cookie lu
export interface PassiveBridgeSpec<R> {
  flag: symbol;                                   // garde par version (installOnce)
  handshakeEvent: string;
  decodeHandshake(detail: unknown): string | null; // → nonce
  encodeOffer(nonce: string): string;
  observe(url: string, base: string): R | null;    // seule porte d'entrée : toute autre requête n'est jamais lue
  onPayload(request: R, raw: unknown): void;       // réduction (shared/*-metadata.ts) + broadcast
  snapshot(port: MessagePort): void;               // instantané à l'ouverture du canal
  maxResponseLength: number;
  maxPorts?: number;                               // 4
}
export interface PassiveBridge { broadcast(message: string): void }
export function installPassiveBridge<R>(spec: PassiveBridgeSpec<R>): PassiveBridge;

// Netflix (pont actif) : seule la moitié « canal »
export function installBridgeChannel(spec: Pick<PassiveBridgeSpec<never>, 'flag' | 'handshakeEvent' | 'decodeHandshake' | 'encodeOffer' | 'maxPorts'> & { onPort(port: MessagePort): void }): void;
```

A platform bridge then contains only its state maps, `onPayload` and `snapshot`. I prototyped it on the CR bridge in the scratch copy (it also includes fix R1).

- **Measured:** CR bridge 7,478 → 7,703 B (**+225 B**). I expect about +0.2 KB on the Disney+ and Prime bridges (UNVERIFIED) and about +0.1 KB on Netflix. All stay well under budget (Prime is the tightest: 72.1 → ~72.3 / 75 KB).
- **Value:** one audited implementation of the XHR / fetch wrapping and the channel trust rules instead of three. Fixes such as R1, R3 and R4 then land once.
- **Effort:** M. **Risk:** low, behaviour-preserving.

The pure helpers move to `shared/`:

- `shared/lru.ts › keep(map, key, value, max)`: 4 bridge / client copies, plus Netflix `remember` and Disney+ `trim`.
- `shared/guards.ts › parseJsonBounded(text, max)`: 4 protocols plus 3 `parseText`.
- `shared/guards.ts › installOnce(global, flag, install)`: the 4 `installXBridgeOnce`. Netflix keeps its v1 legacy key through its flag function.

**Lock the security rules mechanically (S, high value).** Add a check in `scripts/build-checks.ts`: every `src/content/*/page-bridge.iife.js` must contain none of `chrome.`, `getResponseHeader`, `getAllResponseHeaders`, `setRequestHeader`, `.headers`, `document.cookie`, `localStorage`, `sessionStorage`. All four built bridges pass today (measured: 0 occurrences). Add to `src/architecture.test.ts` that `page-bridge.iife.ts` may import only its `bridge-protocol`, `content/bridge/kit`, and `shared/{guards,match-signals,title,*-metadata,lru}`.

### 2.2 Client channel kit, `src/content/bridge/client-kit.ts`

```ts
export interface ChannelEndpoints { target: EventTarget; messages: EventTarget; origin: string; isTrusted?: (e: Event) => boolean }
/** Premier port offert pour ce nonce, par un vrai postMessage de la même origine ; null après timeoutMs */
export function openBridgeChannel(ep: ChannelEndpoints, event: string, detail: string, isOffer: (data: unknown) => boolean, timeoutMs: number): Promise<MessagePort | null>;
/** connect() mémoïsé (port | ouverture en cours), port démarré avec onMessage filtré isTrusted */
export function createBridgeConnection(open: () => Promise<MessagePort | null>, onMessage: (data: unknown) => void): () => Promise<MessagePort | null>;
/** Attente relue à chaque nouveauté : valeur non `undefined`, null si annulé ou délai écoulé (timeout OBLIGATOIRE) */
export function createWaiters(): { notify(): void; until<T>(get: () => T | null | undefined, signal: AbortSignal, timeoutMs: number): Promise<T | null> };
export const pageEndpoints = (): ChannelEndpoints => ({ target: document, messages: window, origin: location.origin });
```

Netflix, Disney+ and Prime use all of it, which removes the two divergent `until` copies (the `undefined` sentinel vs. the `null` sentinel). Crunchyroll keeps its 642 B minimal client unless 2.4 A lands first; after that, using `openBridgeChannel` costs about +0.1 KB (estimate).

- **Bytes:** ≈ ±0.1 KB per bundle (each bundle contains only one client).
- **Value:** maintainability, plus one place for the "first trusted port for this nonce" rule. **Effort:** M. **Risk:** low.

The compact `"v:nonce"` codec of Crunchyroll could be adopted for all platforms (saves ~0.3 KB per bundle), but it changes the protocol and needs version bumps on 3 bridges. Optional, low value.

### 2.3 Adapters: keep the Strategy interface, add small helpers rather than a deep base class

`StreamingAdapter` is already a clean Strategy, with `start.ts` / `watch-session.ts` as the context. A full `BridgeAdapter<TMeta>` Template Method across Netflix, Disney+ and Prime looks attractive, but their identity models differ too much: Netflix uses the URL id, Disney+ the URL id plus `since` and the fallback entry, Prime has no URL id and uses the latest catalog plus the path. Forcing a shared base would add indirection for little gain. Recommended instead (all S):

- `shared/platform-ids.ts › domainOrSubdomain(...)`: move it there from `platforms.ts` (`platform-ids` is a leaf, so the content graph stays free of the descriptors). Used by the 5 `supportsHost`.
- `shared/match-signals.ts › withSignals(signals)`: 10 copies.
- `content/adapters/dom-strategies.ts › runStrategies(strategies, id, guard)` and `seriesTitleChain({ jsonLd, selectors, ogPlatform, slug })`: CR + ADN.
- `content/bridge/client-kit.ts › lazy(() => createXClient(pageEndpoints()))`: 4 singletons.
- Registry: once the manifest script is split per platform (2.4 D), each bundle starts exactly one adapter (`startContent(adapter)`), and `supportsHost` becomes a safety check only.

Bytes: ≈ −0.1 to −0.3 KB per bundle (estimate).

### 2.4 Effect on the bundles (measured with standalone IIFE builds of the real entries; my builds match crxjs's IIFE output within 40 B on Netflix)

| Change | CR/ADN 83.0 | Netflix 60.4 | Disney+ 68.4 | Prime 72.1 | CR bridge 7.3 |
|---|---|---|---|---|---|
| A. `content.ts` as crxjs standalone IIFE | **−8.0 KB → 73.2** (measured 74,966 B) | — | — | — | — |
| B. Guard every `info`/`debug` log | −0.85 KB (measured) | ≈ −0.8 | ≈ −0.8 | ≈ −0.8 | — |
| E. Content-only "happy" mascot | −1.1 KB (measured) | ≈ −1.1 | ≈ −1.1 | ≈ −1.1 | — |
| B+E together on the optional bundles (measured, content IIFE) | — | −1.9 (58,604 → 56,682 B) | −1.7 (62,399 → 60,700) | −1.7 (64,348 → 62,647) | — |
| F. Journal writes delegated to the service worker | −2.2 KB (measured) | ≈ −2.2 | ≈ −2.2 | ≈ −2.2 | — |
| C. History readers out of the always-on script | −10.8 KB (measured on IIFE: 74,966 → 63,916 B) | — | — | — | — |
| D. Split the manifest script CR / ADN (IIFE) | CR page 66.8 KB, ADN page 56.2 KB (measured); with C: CR 58.5 KB | — | — | — | — |
| 2.1 bridge kit | — | ≈ +0.1 (bridge) | ≈ +0.2 | ≈ +0.2 | **+0.2 (measured)** |
| 2.2 client kit / 2.3 helpers | ≈ 0 / −0.2 | ≈ ±0.1 | ≈ ±0.1 | ≈ ±0.1 | — |

The combination A + B + E + F + C + D gives an estimated **CR page ≈ 55–56 KB, ADN page ≈ 45 KB**, against 83.0 today. The per-step numbers are measured; the total is additive and was not built in one go.

## 3. Correctness and robustness risks

| # | Risk | Evidence | Severity / effort |
|---|---|---|---|
| R1 | **XHR reuse misattribution.** The `load` listener captures the request seen at `send`. After `abort()` + `open(B)` + `send()` on the same XHR, the first listener (`once`, never fired) fires on B's response and calls `onPayload(kindA, idA, bodyB)`. The reducers revalidate the shape, but Disney+ `player` / Prime `catalog` entries are keyed by the request id, so wrong keying is possible. Fix: `if (observed.get(this) !== request) return;` in the listener (included in the 2.1 prototype). | `crunchyroll/page-bridge.iife.ts:143-157`, `disney/page-bridge.iife.ts:172-186`, `prime/page-bridge.iife.ts:153-167` | Low probability, S |
| R2 | Unhandled rejection: `getCreditsStart?.(…).then(…)` has no `.catch`. Today's adapters catch internally, but the contract does not require it. | `lib/watch-session.ts:448-450` | Low, S |
| R3 | Wrappers stack across extension updates without a page reload. Guards are per version, so each new bridge version wraps `fetch` / XHR on top of the previous one: N clones per observed response, and old wrappers keep pushing to dead ports. Mitigation (kit): install the wrapper once under a version-less symbol and swap a mutable handler slot that newer versions replace. Only effective from the first version that ships it. | `installXBridgeOnce` × 4; content-reinjection re-executes the CR bridge (`content-reinjection.ts:66-91`), platform-access the others | Low (bounded by updates while a tab stays open), M |
| R4 | The Netflix bridge has no `MAX_PORTS`: every handshake, including the client's retries after a 12 s timeout or a page script spamming the event, creates a MessageChannel whose `port1` keeps its listener forever. | `netflix/page-bridge.iife.ts:74-82` | Low, S (the kit fixes it) |
| R5 | `decodeCrunchyrollPush` runs `JSON.parse` with no length cap and no table-count cap; the other three decoders cap at 2 MB / 400 KB. | `crunchyroll/bridge-protocol.ts:119-128` | Low (private port), S |
| R6 | Prime: the current episode is `latestCatalog()` filtered by path. If the player requests the NEXT episode's `playerChromeResources` before the switch (the docs say `GetVodPlaybackResources` arrives about 1 s early), `watchEpisode` restarts the session before completion in ratio mode, and the episode is never synced. **UNVERIFIED**: the owner validated END_CREDITS + autoplay, not ratio mode with an early catalog. Add a `prime-session.test.ts` case. | `prime/bridge-client.ts:193-197`, `adapters/prime.ts:318-330`, `start.ts:63-66` | Medium if true, S to test |
| R7 | Firefox URL changes: `watchUrl` uses `window.navigation` whenever it exists and drops the 1 s polling fallback. If Firefox exposes the Navigation API to the content-script sandbox (Xray) without delivering page `pushState` events, SPA navigation is missed. **UNVERIFIED**; `test:ext` is Chromium-only. Cheap hardening: keep the 1 s `location.href` poll as a safety net in both branches. | `lib/url-watcher.ts:20-33` | Medium if true, S |
| R8 | **Extension presence is exposed to the sites.** The CR/ADN ESM chunks (14 files) are web-accessible to crunchyroll.com / ADN pages with `use_dynamic_url: false` and a fixed public extension ID, so a page can probe for SyncKai. The optional IIFE scripts are likewise exposed to Netflix, Disney+ and Prime pages. Registered and manifest content scripts do not need WAR. 2.4 A removes the CR/ADN entry. Dropping the optional-platform entries is **UNVERIFIED**: crxjs adds them for `?script`, and `checkWebAccessibleResources` currently requires them (`scripts/build-checks.ts:184-189`). | `dist/manifest.json › web_accessible_resources` | Privacy, S (A) / M (optional platforms) |
| R9 | `reportCompletion` does not check `signal.aborted` after `await loadSettings()` / `isSeriesExcluded()`: a session destroyed by autoplay during those awaits still sends and toasts. The episode really was completed, so this is probably intended. Document it, or check `isCurrentEpisode()` only for the toast. | `lib/watch-session.ts:199-221` | Low |
| R10 | Unbounded per-page sets: `ignoredSeries` and LabelGuard `owners` grow by one key per episode watched in the tab. Negligible; cap at ~200 for hygiene. | `lib/watch-session.ts:42`, `adapters/parsing.ts:59` | Very low, S |
| R11 | `until()` without a timeout in `loadPage` / `loadTitle` relies on the caller's signal. Today's callers bound it (`PAGE_MEDIA_ASYNC_TIMEOUT_MS`, `TITLE_WAIT_MS`); a future caller would leak listeners. The kit should make `timeoutMs` mandatory. | `disney/bridge-client.ts:256`, `prime/bridge-client.ts:226` | Low, S |
| R12 | A toast created in a hidden tab gets `visible` through `requestAnimationFrame`, which does not run while the tab is hidden, while the auto-hide timer keeps running. The background-tab result pill can disappear before it was ever shown. | `ui/toast.ts:331-333` | UX, low |
| R13 | The fetch wrapper reads `clone().text()` in full before applying the length cap. A huge observed body is fully buffered in MAIN. | 3 × `observeFetch` | Low |

Checked and fine:

- Every tracker / session / toast listener uses `AbortSignal`s (`video-tracker.ts:99,113-122`, `watch-session.ts:396-411`, `toast.ts:328`).
- `waitFor` always disconnects (`wait-for.ts:22-27`). `watchElementText` disconnects and clears its interval.
- Season watch stops on the last panel (via `port.onDisconnect` → `onPeersChange`). The live-stream interval stops with the last peer. Orphan instances abort their page signal (`start.ts:110-121`).
- The Netflix in-flight map, Disney+ / Prime bounded maps, and the CR bridge maps are all bounded. The Disney+ `urlSeenAt` map is capped at 20.

## 4. Bundle-size optimizations for the CR/ADN script (no behaviour change)

Ranked by value / risk:

1. **A. Build `content.ts` as a standalone IIFE** with the crxjs option `contentScripts: { standaloneFiles: ['src/content/content.ts'] }`, or by renaming it `content.iife.ts`. crxjs supports both for manifest scripts (`node_modules/@crxjs/vite-plugin/dist/index.mjs:1360-1450`), and the CR MAIN bridge already uses this path.
   - Gain: **−8.0 KB** (83.0 → 73.2 KB), no async loader (`import(getURL)`), no WAR entry (R8). There is no dynamic `import()` in content code.
   - To update: `scripts/build-checks.test.ts` fixtures name `content.ts-loader`; `src/build/output-names.test.ts:38`.
   - Dev mode (`npm run dev`): crxjs uses its IIFE dev loader, so HMR becomes reload-based. UNVERIFIED on this project.
   - Effort S, risk low.
2. **B. Guard every content `info`/`debug` call** with `if (__SYNCKAI_DEBUG__)`. `noop` loggers keep their string arguments in the bundle (confirmed by grep in `dist/`).
   - Calls to guard: `start.ts:44,47,93,114`, `lib/video-tracker.ts:74,80,85,116`, `ui/engagement-prompt.ts:52,98`, `adapters/crunchyroll.ts:493,523,528`, `adapters/adn.ts:242`, `adapters/netflix.ts:181,213`.
   - Add an ESLint `no-restricted-syntax` rule that flags `.info(` / `.debug(` calls outside `IfStatement[test.name="__SYNCKAI_DEBUG__"]` under `src/content`.
   - Gain −0.85 KB (measured). Effort S, risk none.
3. **E. Content-only mascot**: `toast.ts:163` only uses `smallKai('', { expression: 'happy' })`, but the content bundle ships every expression, the tile and `sleepZ`. Export a `happyKai()` from `ui/kai-small.ts`. Gain −1.1 KB (measured), the same in every content bundle. Effort S, risk none: the popup and panel keep `smallKai`.
4. **C. Load the import readers on demand.** `crunchyroll-history`, `cr-history-port`, `history-port`, `adn-history`, `shared/cr-history` and `page-fetch` run only when the import page connects, yet every CR/ADN page parses them.
   - Make them a separate IIFE (`content/history/history.iife.ts`, standalone 16.0 KB), injected by the import page with `chrome.scripting.executeScript({ files, world: 'ISOLATED' })`. The port protocol is unchanged, and Netflix import already uses `executeScript`.
   - `?script` imports are allowed only in `platform-access.ts`. Either add a whitelisted `background/history-scripts.ts` behind a message (`INJECT_HISTORY_READER`, origin `extension` in `MESSAGE_ORIGINS`), or have the service worker inject on the import page's request.
   - Gain **−10.8 KB** (measured on the IIFE baseline). Effort M, risk medium.
   - Tests to adapt: `scripts/ext-e2e/import.ext.ts` (CR + ADN, `cutNetworkAt`), `src/content/lib/crunchyroll-history.test.ts`, `adn-history.test.ts`.
5. **D. Split the manifest script per platform**: two `content_scripts` entries, CR → `content-cr.iife.ts` (with the MAIN bridge before it) and ADN → `content-adn.iife.ts`. The hosts are unchanged, so no new permission warning (UNVERIFIED on the store review). `content-reinjection.ts` is already generic over manifest entries.
   - Measured: CR page 66.8 KB, ADN page 56.2 KB (IIFE baseline).
   - Budgets become per script. `checkAccessDeclarations` compares matches with the source manifest, which stays consistent.
   - Effort S–M, risk low.
6. **F. Delegate the error journal to the service worker**: the content logger's `warn` / `error` send a `RECORD_LOG` message (redaction stays in the SW before storage); the console output is unchanged.
   - Gain −2.2 KB (measured), the same in every content bundle.
   - Trade-off: wakes the SW on warn / error (rare), and warns are lost when the SW is unreachable (which already breaks sync). Needs a `MESSAGE_ORIGINS` entry `content`.
   - Effort M, risk low.
7. **G. Content-specific settings reader**: `getContentSettings()` normalizes only `autoSync`, `completionTrigger`, `completionPercentage`, `notificationLevel` and `language`. `normalizeSettings` also pulls in `normalizeSeriesOffsets` / `normalizePlatformOffsets` / `AIRING_DELAYS`, which content never reads. Estimated ≈ −1 KB (UNVERIFIED, not built). `i18n/core.ts:2` also imports `getSettings`, so route it through the same reader. Effort S.
8. **H. Package hygiene** (no runtime effect): the 9 unreferenced files (43.0 KB), crxjs intermediates, are shipped and reviewed by AMO. Either drop them in a `generateBundle` (enforce post) plugin, or make `scripts/package.ts` reuse `reachableFiles` and refuse unreferenced files (verify-build already lists them). Effort S.

Budget rule after A–D: re-baseline `CONTENT_SCRIPT_BUDGET_BYTES` per script at the measured size + 10 %, so the reclaimed room is not silently consumed.

## 5. Ranking (value / risk, effort)

| Rank | Item | Value | Risk | Effort |
|---|---|---|---|---|
| 1 | A — CR/ADN as IIFE (−8 KB, removes WAR exposure) | High | Low | S |
| 2 | Bridge security build check (tokens + import whitelist) | High | None | S |
| 3 | B — log guards + lint rule | Medium | None | S |
| 4 | E — happy-only mascot | Medium | None | S |
| 5 | R1 XHR reuse fix, R2 `.catch`, R4 Netflix `MAX_PORTS`, R5 push cap | Medium | None | S |
| 6 | R7 Firefox URL poll safety net + R6 Prime early-catalog test | Medium | Low | S |
| 7 | D — split CR / ADN scripts | High | Low | S–M |
| 8 | C — history readers on demand (−10.8 KB) | High | Medium | M |
| 9 | 2.1 bridge kit (+0.2 KB per bridge, one audited wrapper) | Medium | Low | M |
| 10 | F — journal via SW (−2.2 KB per bundle) | Medium | Low | M |
| 11 | 2.2 client kit, 2.3 adapter helpers | Low–Medium | Low | M / S |
| 12 | H — prune dead package files; G — content settings reader | Low | None | S |
| 13 | R3 single wrapper across versions; R8 drop optional WAR entries (UNVERIFIED) | Low | Medium | M |

## 6. Tests protecting each area

| Area | Unit (`vitest`) | `test:e2e` | `test:ext` |
|---|---|---|---|
| MAIN bridges (wrapping, guards, handshake) | `src/content/{crunchyroll,netflix,disney,prime}/page-bridge.test.ts`, `*/bridge-protocol.test.ts` | — | `playback.ext.ts` › "Crunchyroll : pont du monde MAIN (manifeste)… jamais son jeton" (CR only; Netflix / Disney+ / Prime are not automatable: native permission dialog) |
| Isolated clients | `*/bridge-client.test.ts` (4) | — | CR bridge scenario above |
| Adapters | `adapters/{crunchyroll,adn,netflix,disney,disney-credits,prime,prime-session,parsing}.test.ts`, `netflix-import-parity.test.ts`, `disney/series-page.test.ts` | — | `playback.ext.ts` CR (credits, absolute 1180), ADN (85 %), localized accented title |
| Session / tracker / SPA / autoplay | `lib/{watch-session,video-tracker,completion,live-stream,season-watch,page-media}.test.ts` (`wait-for.ts` has no dedicated test), `start.test.ts`, `content.test.ts` | — | `playback.ext.ts` autoplay 1180 → 1181, background tab 30 s, short watch (no write), shortcut; `panel.ext.ts` CR autoplay render delay |
| Toasts / UI | `ui/sync-toast.test.ts`, `ui/notification-policy.test.ts` | popup / panel only | toasts via CDP in `playback.ext.ts` (language kept) |
| Registration / reinjection | `background/{platform-access,platform-scripts,content-reinjection}.test.ts` | — | update relaunch scenarios (batch 1) |
| History import | `lib/{crunchyroll-history,adn-history}.test.ts` | `import-cr.e2e.ts` | `import.ext.ts` (CR, ADN, Wi-Fi cut) |
| i18n in content | `src/i18n/content.test.ts` (content-key graph, no full catalogs) | — | language scenario |
| Bundles / manifest | `scripts/build-checks.test.ts`, `src/build/output-names.test.ts`, `src/architecture.test.ts` | — | — |

Not covered by any automated test: Firefox runtime behaviour (R7, Xray, `content.fetch`), and live Netflix / Disney+ / Prime sites (manual only). Prime ratio-mode completion with an early catalog (R6) has no test case yet.

## 7. Reproduction (scratchpad only)

- `scratchpad/standalone.ts <entry> <outDir>`: Vite library IIFE build with the project's `define` (production, English content catalog). Calibrated against crxjs output: Netflix 58,613 B vs. 58,653 B in `dist`.
- `scratchpad/attrib.ts <files…>`: per-source byte attribution from the source maps.
- `scratchpad/entries/*.ts`: CR-only, ADN-only and no-history entries. `scratchpad/copy/`: patched `src` copy (log guards, happy mascot, kit prototype, journal stub).
