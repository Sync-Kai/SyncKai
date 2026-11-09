# Watch order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a collapsible « Ordre de visionnage » section in the side panel's details card: the whole franchise in release order, the user's state for each entry, « N / M vus » and « Ensuite ».

**Architecture:** pure rules in `src/shared/franchise.ts` (graph walk step, main / extra classification, release order, « Ensuite », counts, title shortening, state merge); the service worker walks the franchise with a dedicated two-level relations query on the background lane and caches it 24 h in `chrome.storage.session`; a second message returns the user's list states (AniList read, MAL full list); the panel controller loads both after the details and the details card renders the section in place of the related rows.

**Tech Stack:** TypeScript, Preact, Tailwind 4 tokens, Vitest, Puppeteer e2e.

**Spec:** `docs/superpowers/specs/2026-11-09-watch-order-design.md`

## Global Constraints

- AniList is the only catalogue source; MAL is read only for the user's own full list (`fetchMalFullList`).
- Every request on the `'background'` lane, sharing the existing background budget (`rate-limit.ts`); the franchise query is public (`anilistPublicQuery`), list states use the authenticated client.
- Relations nested two levels per request (a third level returns nothing more, measured 2026-11-09).
- Main chain = PREQUEL / SEQUEL, any format, ANIME only, MUSIC excluded. « Tout » adds one hop of SIDE_STORY, SPIN_OFF, ALTERNATIVE, SUMMARY, PARENT; never OTHER, CHARACTER, SOURCE, ADAPTATION, COMPILATION, CONTAINS, MUSIC; entries with `duration` ≤ 5 min excluded.
- Caps: 50 main entries, 8 rounds, 40 extras.
- Cache: `chrome.storage.session`, 24 h, catalogue data only (never list states); complete component stored under every entry id it contains, capped graph under the start id only; one load in flight per franchise.
- States: watched = COMPLETED or REPEATING; in progress = CURRENT; planned = PLANNING; paused = PAUSED; dropped = DROPPED. `entryService` decides; unavailable → the other connected service; an entry without `idMal` has no MAL state (« pas sur MyAnimeList ») and is left out of MAL-driven counts and « Ensuite ».
- « Ensuite »: first released main entry (RELEASING counts as released) not watched after the furthest watched or in-progress main entry in release order; the first released main entry when nothing is watched; never an extra; none when every released main entry is watched (« Tout vu »).
- No new `addListener` in `background/`; Preact rules; charter `docs/design/README.md`; no new arbitrary colours / px font sizes.
- Every UI string: en + context note + 20 translations (`docs/memory/i18n.md`), `npm run i18n:check` 0 errors; counts through plurals.
- Fixtures captured anonymously from the real API (no token, header or account id).
- Code comments in French; no formatter; commits in English, author QuentinGeerts, no Claude mention, no `Co-Authored-By`. Checks through `synckai-verify`, `CI=1` for e2e and layout in cloud sessions.

## Review Focus

1. A cycle in AniList relations (A SEQUEL B, B PREQUEL A, plus a wrong back-edge): the walk terminates and each entry appears once. Test in Task 1.
2. The current entry is an extra (a side story page): the section still shows its franchise, « Ici » on the extra row in « Tout », counts from the main chain. Test in Task 1.
3. Two panel opens of entries of the same franchise at once: one load, both answered. Test in Task 3.
4. A list action from the panel (« + », status change) updates the states shown without reopening the panel. Test in Task 5.
5. Sign-out while the section is open: the states disappear (no stale list data from the old account). Test in Task 5.

---

### Task 1: Pure franchise rules (`src/shared/franchise.ts`) and real fixtures

**Files:**
- Create: `src/shared/franchise.ts`, `src/shared/franchise.test.ts`, fixtures `src/shared/__fixtures__/franchise/{aot,monogatari,mushoku,gundam}.json`

**Interfaces:**
- Produces:
  ```ts
  export type FranchiseRelation = 'PREQUEL' | 'SEQUEL' | 'SIDE_STORY' | 'SPIN_OFF' | 'ALTERNATIVE' | 'SUMMARY' | 'PARENT';
  export interface FranchiseNode { id: number; idMal: number | null; title: string; format: string | null; status: string | null; episodes: number | null; duration: number | null; coverUrl: string | null; siteUrl: string; year: number | null; month: number | null; day: number | null; season: AniListSeason | null; seasonYear: number | null; platforms: PlatformLink[] }
  export interface FranchiseGraph { startId: number; nodes: Record<number, FranchiseNode>; main: number[]; extras: { id: number; relation: FranchiseRelation; from: number }[]; capped: boolean }
  export interface RawMedia { id: number; type: string; duration: number | null; …node fields; relations: { relationType: string; node: RawMedia }[] }
  export const MAX_MAIN = 50; export const MAX_ROUNDS = 8; export const MAX_EXTRAS = 40;
  export function mergeRound(graph: FranchiseGraph, page: readonly RawMedia[]): { graph: FranchiseGraph; frontier: number[] };
  export function releaseOrder(graph: FranchiseGraph, mode: 'main' | 'all'): FranchiseNode[];
  export type ListState = { kind: 'watched' | 'inProgress' | 'planned' | 'paused' | 'dropped'; progress: number | null } | null;
  export function franchiseProgress(main: readonly FranchiseNode[], states: ReadonlyMap<number, ListState | 'notOnMal'>): { watched: number; total: number; next: FranchiseNode | null; allWatched: boolean };
  export function shortTitle(rootTitle: string, title: string): string;
  ```
  `AniListSeason` from `src/shared/sequels.ts`; `PlatformLink` and the external-link → platform rule exactly as `PanelMedia` builds `platforms` (reuse its helper, do not duplicate).

- [ ] **Step 1: Capture fixtures** with anonymous `curl` POSTs to `https://graphql.anilist.co` (header `X-Client: SyncKai (+https://synckai.app)`) of the Task 3 query, round by round, for AoT S1 (16498), Bakemonogatari (5081), Mushoku Tensei S1 (108465) and Mobile Suit Gundam (80); save each round's `Page.media` array in the fixture file (`{ rounds: RawMedia[][] }`).
- [ ] **Step 2: Write the failing tests:** walking the fixtures round by round (`mergeRound`) gives the main chain in release order (AoT: *No Regrets* before S1 by date, S1 → … → *Final Chapters*); Monogatari never contains *Nisekoi* (OTHER); Gundam stops at `MAX_MAIN` with `capped: true` and keeps only the component of the start; the frontier is empty when the chain closes; a synthetic cycle terminates with unique ids (Review Focus 1); a start that is a SIDE_STORY of the main chain yields that chain with the start in `extras` (Review Focus 2); MUSIC and ≤ 5 min entries never appear; `releaseOrder` puts unknown dates last and NOT_YET_RELEASED at their announced date; `franchiseProgress`: nothing watched → first released main; skipped prequel OVA behind the furthest watched entry is not « next »; RELEASING counts as released; all released watched → `allWatched` and `next` = the announced entry or null; `notOnMal` entries out of `total`; `shortTitle('Shingeki no Kyojin', 'Shingeki no Kyojin Season 2') === 'Season 2'`, unchanged when not a prefix (Mushoku Tensei).
- [ ] **Step 3: Run** `npx vitest run src/shared/franchise.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement** (pure, no browser API).
- [ ] **Step 5: Run** the test and `src/architecture.test.ts`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(franchise): add the watch order rules with real AniList fixtures`.

### Task 2: Texts in 21 languages

**Files:** `src/i18n/locales/*.json` (21), `docs/i18n/context.json`, `docs/i18n/review/<code>.md`

**Interfaces:** produces (en [fr]): `panel.order.title` Watch order [Ordre de visionnage] · `panel.order.watched_*` {count} / {total} watched [{count} / {total} vus] · `panel.order.next` Next: {title} [Ensuite : {title}] · `panel.order.allWatched` All watched [Tout vu] · `panel.order.here` Here [Ici] · `panel.order.main` Main series [Série principale] · `panel.order.all` All [Tout] · `panel.order.releaseNote` Release order, not story order [Ordre de sortie, pas l'ordre de l'histoire] · `panel.order.watchedRun_*` {count} watched [{count} vus] · `panel.order.more_*` Show {count} more [Afficher {count} de plus] · `panel.order.tooLong` Long franchise: only the first {count} entries are shown [Franchise trop longue : seules les {count} premières entrées sont affichées] · `panel.order.state.watched` Watched [Vu] · `panel.order.state.inProgress` Ep. {progress} [Ép. {progress}] · `panel.order.state.planned` Planned [À regarder: use the catalog's PLANNING term] · `panel.order.state.paused` Paused · `panel.order.state.dropped` Dropped · `panel.order.state.notOnMal` not on MyAnimeList · `panel.order.otherService` {service}: {state} · `panel.order.error` The watch order could not be loaded [L'ordre de visionnage n'a pas pu être chargé]. Reused: `common.retry`, `sequel.announced`, `sequel.airing`, `panel.nowPlaying.season.*`.

- [ ] **Step 1:** en texts + context notes; **Step 2:** 20 translations following each term sheet (reuse each catalog's existing status terms for the states); **Step 3:** `npm run i18n:check` → 0 errors; **Step 4:** `npx vitest run src/i18n scripts/i18n-context.test.ts` → PASS; **Step 5: Commit** `feat(i18n): add the watch order texts in 21 languages`.

### Task 3: Franchise loader in the service worker

**Files:**
- Create: `src/background/franchise/load.ts`, `src/background/franchise/load.test.ts`
- Modify: `src/protocol/messages.ts`, `src/background/message-guards.ts` (`MESSAGE_ORIGINS`: `'extension'`), the router in `src/background/background.ts`, `src/browser/storage/session-cache.ts` (prefix + TTL)

**Interfaces:**
- Consumes: Task 1 (`mergeRound`, caps, types).
- Produces: `GET_FRANCHISE: { payload: { mediaId: number }; response: FranchiseResult }`, `type FranchiseResult = { ok: true; graph: FranchiseGraph } | { ok: false; message: string }` (in `src/shared/franchise.ts`); `FRANCHISE_CACHE_PREFIX = 'franchise:v1:'`, `FRANCHISE_CACHE_TTL_MS = 24 * 3_600_000`; `loadFranchise(mediaId: number): Promise<FranchiseResult>`.

- [ ] **Step 1: Write the failing tests** (mock `anilistPublicQuery` serving the Task 1 fixtures by round): AoT loads in as many requests as fixture rounds, all with lane `'background'`; a second `loadFranchise` for another AoT entry hits the cache (0 requests); a capped Gundam graph is cached under the start id only; two concurrent calls for entries of the same franchise make one walk (Review Focus 3: key the in-flight map by start id AND reuse any in-flight walk whose read ids contain the requested id); a rejected request → `{ ok: false }`, nothing cached; an expired cache entry is re-read.
- [ ] **Step 2: Run** `npx vitest run src/background/franchise`. Expected: FAIL.
- [ ] **Step 3: Implement.** Query: `query Franchise($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids) { …NODE relations { edges { relationType node { …NODE relations { edges { relationType node { id type } } } } } } } } }` with NODE = `id idMal type format status episodes duration title { userPreferred } coverImage { medium } siteUrl startDate { year month day } season seasonYear externalLinks { url }`; check the complexity on the real API once with a 50-id frontier and lower `perPage` if refused (note the figure in the report). `siteUrl` through `toSafeUrl(…, 'anilist.co')` with the `https://anilist.co/anime/<id>` fallback.
- [ ] **Step 4: Run** the tests plus `src/architecture.test.ts src/background/message-guards.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(franchise): load and cache the franchise graph in the service worker`.

### Task 4: List states message

**Files:**
- Create: `src/background/franchise/states.ts`, `src/background/franchise/states.test.ts`
- Modify: `src/protocol/messages.ts`, `src/background/message-guards.ts`, `src/background/background.ts`

**Interfaces:**
- Produces: `GET_LIST_STATES: { payload: { mediaIds: number[]; malIds: number[] }; response: ListStates }`, `interface ListStates { anilist: Record<number, ListState> | null; mal: Record<number, ListState> | null }` (null = service not connected or read failed; in `src/shared/franchise.ts`). AniList: one authenticated `Page(id_in: $ids, perPage: 50) { media { id mediaListEntry { status progress } } }` read per 50 ids, lane `'background'`; MAL: `fetchMalFullList()` matched by `malId`. Nothing stored.

- [ ] **Step 1: Write the failing tests:** AniList only → `mal: null`; MAL only → `anilist: null`, states keyed by MAL id; status mapping (COMPLETED and REPEATING → watched, CURRENT → inProgress with progress, PLANNING → planned, PAUSED → paused, DROPPED → dropped); a MAL read failure → `mal: null` while AniList is returned; ids capped at 90 (50 main + 40 extras).
- [ ] **Step 2: Run** `npx vitest run src/background/franchise`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests plus `src/architecture.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(franchise): read the user's list states for a franchise`.

### Task 5: Panel controller wiring and state merge

**Files:**
- Modify: `src/shared/franchise.ts` (+ test), `src/sidepanel/components/now-playing-controller.ts` (+ test)

**Interfaces:**
- Consumes: Tasks 3–4 messages.
- Produces: `mergeStates(states: ListStates, entryService: TrackerId, nodes: readonly FranchiseNode[]): { byId: ReadonlyMap<number, ListState | 'notOnMal'>; other: ReadonlyMap<number, { service: TrackerId; state: ListState }> }` (chosen service, fallback to the other when null; `notOnMal` when MAL drives and `idMal` is null; `other` only where the two services differ); controller state `order: { status: 'idle' | 'loading' | 'error'; message?: string } | { status: 'ready'; graph: FranchiseGraph; states: ListStates }` published with the details; `retryOrder()`.

- [ ] **Step 1: Write the failing tests:** `mergeStates` cases (choice, fallback, notOnMal, differing services); controller: after `GET_PANEL_MEDIA` resolves, sends `GET_FRANCHISE` then `GET_LIST_STATES` with the graph's ids; on a page change to another franchise reloads; Review Focus 4: after a list action answered by the worker, `GET_LIST_STATES` is sent again; a panel redetect (URL change, Refresh) re-sends `GET_LIST_STATES` without re-reading the cached graph; Review Focus 5: on an accounts change with no session left, `states` becomes `{ anilist: null, mal: null }` without a request; `retryOrder` after an error re-sends `GET_FRANCHISE`.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement** (states kept in controller memory only; follow how the controller already reacts to list actions and account changes).
- [ ] **Step 4: Run** `npx vitest run src/sidepanel src/shared`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(franchise): load the watch order with the panel details`.

### Task 6: « Ordre de visionnage » section

**Files:**
- Create: `src/sidepanel/components/watch-order.tsx` (+ test)
- Modify: `src/sidepanel/components/details-card.tsx` (`PANEL_SECTIONS`: `relations` → `order`, `CLOSED_SECTIONS`; the section replaces the related rows; the sequel badge / « + À regarder » gating with `unlistedSequels` moves to the timeline rows), `src/sidepanel/components/now-playing.tsx`, `src/ui/components/collapsible.tsx` only if a header variant is needed

**Interfaces:**
- Consumes: Task 1 (`releaseOrder`, `franchiseProgress`, `shortTitle`), Task 5 (`order`, `mergeStates`, `retryOrder`), `entryLink`, `choosePlatformLink`, Task 2 keys.

- [ ] **Step 1: Write the failing tests:** folded header shows « 3 / 8 watched », one bar cell per released main entry with the state classes, « Next: <title> »; no section for a single-entry franchise; unfolded `<ol>` in release order, `aria-current` + « Here » on the page's entry; switch « Main series / All » adds the extras; 3+ consecutive watched rows collapse into « N watched » (expandable); « Show N more » after 5 rows; release note shown; loading (`aria-busy`), error with « Retry » calling `retryOrder`; no account → no counts, no « Next »; NOT_YET_RELEASED sequel row shows « Announced · date » and « + Plan to watch » only when unlisted (same rules as before); `capped` → `panel.order.tooLong`; tooltip with the other service's state.
- [ ] **Step 2: Run** `npx vitest run src/sidepanel/components`. Expected: FAIL.
- [ ] **Step 3: Implement** (state = node shape + icon, never colour alone; long titles on 2 lines with a tooltip; 320–360 px).
- [ ] **Step 4: Run** `npx vitest run src/sidepanel src/ui src/ui/design-tokens.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(franchise): show the watch order in the side panel`.

### Task 7: Demo data, e2e, layout and verify

**Files:** `scripts/screenshots/demo-panel.ts` (a seeded franchise of ~8 entries with mixed states), `scripts/e2e/*` (one panel scenario: fold header, unfold, switch « All »)

- [ ] **Step 1:** seed the demo and add the scenario.
- [ ] **Step 2: Run** `CI=1 npm run test:e2e`. Expected: PASS.
- [ ] **Step 3: Run** `CI=1 SYNCKAI_I18N_LAYOUT_DIR=<scratchpad>/layout npm run test:i18n-layout`. Expected: 0 findings (component fix first, then a shorter translation logged in its review log).
- [ ] **Step 4: Run** `npm run verify`. Expected: exit 0.
- [ ] **Step 5: Commit** `test(franchise): cover the watch order in e2e and layout checks`.
