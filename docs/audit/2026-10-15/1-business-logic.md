# SyncKai business-logic audit: sync, matching, resolution, mappings, review queue

Branch `feature/match-signals`, HEAD `9a5d08c`. Read-only audit. Scope: `src/background/sync/**`, `episode-completed.ts`,
`page-media.ts`, `page-media-rules.ts`, account/session guards on the sync path, the review queue (« À vérifier »), and
cached mappings. Imports, Agenda, lists/ratings, auth, exclusions/backup and MAL specifics are covered by the second
agent; they appear here only as cross-cutting notes.

Throwaway reproductions (outside the repo) live in
`/tmp/claude-0/-home-user/d3b7fa96-95d6-59e4-903d-2a42a7d1a01e/scratchpad/audit-logic/`:
`signals.audit.test.ts`, `prime.audit.test.ts`, `chosen.audit.test.ts`. Run them with
`cd /home/user/SyncKai && npx vitest run --config <that dir>/vitest.audit.config.ts --disableConsoleIntercept`.

Ranking: CRITICAL = data corruption, or a wrong entry synced on its own with nothing the user can see first. HIGH =
a wrong entry synced as `high` and learned in a realistic case. MEDIUM = a rule violation, a lost user decision or a
divergence that can change what the user sees or what gets synced. LOW = hardening.

I found no CRITICAL issue. Progress never goes backwards outside « Corriger »: `decideListUpdate` runs under
`withEntryLock`, after a fresh read. A changed session is checked twice before a write. Queue retries are limited to
the sessions they were created in (`restrictToSession`).

---

## 1. Correctness bugs and rule violations

### H1 (HIGH): Netflix title-only entry synced as `high` when the linked franchise is contradicted by the signals

- **Evidence:** `matching.ts:1360-1367` (`gateByPlatformLink`, `linked` verdict): `if (result.target.bySignals || …) return result;`.
  `bySignals` is accepted whatever the proven group is. `provenTarget` (`matching.ts:880-904`) takes the single kept
  group of `signalConcordance`. `signalConcordance` drops every franchise with no concording group "if another
  concords" (`matching.ts:839-842`). The kept group can therefore be a franchise that is only related by title, with no
  Netflix link and no relation to the linked entry.
- **Repro** (`signals.audit.test.ts`, T1): Netflix show "Foo". Entry A (TV, 2010) carries the AniList link to this
  Netflix `/title/{id}`. Entry B (TV, 2020) has the same title, no link and no relation to A. Signals: `seasonYear: 2020`,
  `seasonEpisodeCount: 12`. Result after the gate: `{"mediaId":2,"confidence":"high","reason":"Remake told apart by its release year (2020)","bySignals":true}`.
  `resolveEpisode` then saves it as `learned`.
- **Rule broken:** CLAUDE.md says « title-only match → À vérifier (never cached) » on Netflix. It also describes
  `bySignals` as "treated as linked" for the Mushoku Tensei case, where the proven group sits inside the linked
  franchise (« II Part 2 »). The code does not check that the proven group belongs to the linked franchise.
- **Impact:** a wrong entry is synced and learned when Netflix's season year differs from the linked entry. Netflix
  season years are verified for only a handful of shows. The learned mapping is dropped only if a later signal
  contradicts it.
- **Fix:** in the `linked` branch, accept `bySignals` only when the target's chain (the `SignalGroup.chain` of the proven
  group, exposed on the target) contains a candidate that `isLinked`. Otherwise lower it to `platformUnlinkedEntry`.
  Add a corpus case.
- **Effort:** S. **Protected by:** `matching-signals.test.ts` and corpus cases (Mushoku Tensei, Berserk) cover the
  intended path, but no test covers a contradicted linked franchise alongside a proven unlinked one.
- **Regression risk:** low. The Mushoku Tensei case stays green because « II Part 2 » shares the chain of « II », which is
  linked.

### H2 (HIGH): Disney+ / Prime Video, two same-title remakes that both carry a platform link become two "linked" seasons and the older one is synced as `high`

- **Evidence:** `resolver.ts:105-112` (`linkOf`). On title-bound platforms, any Disney+ / Prime link on an entry that
  carries the series title becomes `id`: `matchPrimeLink` returns `id` for any Prime URL (`matching.ts:257-259`), and
  `matchDisneyLink` returns `id` on a playback page (`matching.ts:229-239`). In `resolveByRules`, `linked.length > 0`
  turns off the remake guard (`isSoleSeason` / `isTrustedTitleMatch`, `matching.ts:1004-1007`). The pool holds both
  remakes in airing order, and season 1 becomes the first one. `settleTitleBoundLinks` (`resolver.ts:159-171`) does
  nothing here, because both entries are `id`.
- **Repro** (`prime.audit.test.ts`): "Foo" 1997 and "Foo" 2016, both TV, each with a Prime link (`amazon.com/dp/B0…`) or
  a Disney+ link (`/series/foo/{id}`), no signals. Result: `mediaId 1 (1997), confidence high, "Season 1 = AniList entry no. 1"`.
  It is saved as `learned` under `prime:title:foo:s1` / `disney:title:foo:s1`. The same pair without platform links
  stays `low` (corpus `pv-berserk-*`).
- **Impact:** a wrong entry is synced and learned whenever the year signal is absent: a tab opened before the bridge, or
  any Disney+ playback, which never sends a season year. The year-less key is shared by both remakes, so the wrong
  mapping is reused.
- **Fix:** give links that only prove "on the platform" a separate `LinkKind` (`platform`), distinct from `id`. Let it
  reach `level()` only when the linked entries form one connected SEQUEL/PREQUEL chain. Two disconnected chains with the
  series title → `low`.
- **Effort:** M. **Protected by:** `matching-prime.test.ts`, `matching-disney.test.ts`, corpus Prime cases (Berserk has no
  Prime link in the snapshot, so it never hits this path).
- **Regression risk:** medium. Check Tokyo Ghoul (several Prime links, one chain) and BLEACH TYBW.

### M1 (MEDIUM): a `chosen` mapping is deleted as soon as one episode falls outside it

- **Evidence:** `resolver.ts:433-452`. When `applyMapping` returns `null`, `if (stored && persist) await deleteMediaMapping(key)`
  runs without regard to `chosen`. The same happens in `sync-service.ts:305-308` (`revalidateCachedTarget`). A
  `MediaMapping` is `{mediaId, offset}` per platform season, so it cannot represent a platform season split across
  AniList parts.
- **Repro** (`chosen.audit.test.ts`): the stored mapping is `{mediaId 2, season, offset 12, episodes 12, chosen: true}`
  (the user picked « Part 2 » for S2 E13+). Opening S2 E3 deletes `crunchyroll:S:s2`.
- **Impact:** CLAUDE.md says `chosen` is "never questioned". Rewatching an earlier episode destroys the user's
  correction. The next automatic resolution can bring back the wrong entry at `high`.
- **Fix:** never delete a `chosen` (or unmarked) mapping on "does not apply". Fall through to a resolution without
  persisting. Longer term, allow a mapping to hold the parts of a split season (`parts: [{mediaId, episodes}]`).
- **Effort:** S (guard) / L (multi-part mapping). **Protected by:** `sync-service.test.ts` › SYNC-05/06, which asserts
  deletion for the « Part 2 published » case. Keep that test for `learned` mappings only.
- **Regression risk:** low with the guard.

### M2 (MEDIUM): lost update on the mapping store: an older `learned` value can overwrite a fresh user choice

- **Evidence:** `saveMediaMapping` replaces the entry unconditionally (`shared/storage.ts:191-196`). Two writers build
  their value from a read made before network calls:
  - `resolver.ts:484-488` saves `learned` after `collectCandidates` (several AniList requests, possibly seconds under
    rate limiting);
  - `sync-service.ts:310-321` (`revalidateCachedTarget`) rewrites the cached target read before `getCatalogMedia`.
  If the user picks a season in the selector (`page-media.ts:329`, `chosen: true`) or validates a card
  (`sync-service.ts:447`) during that window, the `chosen` value is overwritten by the stale one.
- **Impact:** the user's choice is silently lost, and the next episode syncs on the entry the user rejected (`high`).
  The window is realistic: choosing a season in the panel while the credits trigger the completion sync.
- **Fix:** add `saveMediaMappingIf(key, expected, next)` (compare-and-set under `withStorageLock`). The resolver writes
  only if the key is still absent or unchanged since its read. `revalidateCachedTarget` only patches `episodes` when
  `mediaId`/`offset` are unchanged. A `learned` write never replaces a `chosen` mapping.
  `deleteMediaMappingsIfUnchanged` already shows the pattern.
- **Effort:** S. **Protected by:** nothing covers the concurrency.
- **Regression risk:** low.

### M3 (MEDIUM): « À vérifier » cards are evicted silently, including corrections that hold a deferred episode

- **Evidence:** `savePendingReview` keeps `[review, ...others].slice(0, MAX_PENDING_REVIEWS)` (20)
  (`shared/storage.ts:266-270`). Live sync (`sync-service.ts:385`) and « Corriger » (`:478`) do not check for free
  space. The import does (`cr-import.ts:629`), but it replaces any existing card of the same key, a correction included
  (`cr-import.ts:633-637`).
- **Impact:** the 21st card drops the oldest one. A dropped correction loses its `deferred` episode (SYNC-07), which is
  never replayed, and the contested write is never corrected. Twenty cards is reachable for a Netflix-heavy user,
  because every title-only Netflix season gets a card.
- **Fix:** never evict a card with `previous !== null`; evict the oldest simple card instead. If only corrections are
  left, refuse the new simple card and keep the episode in the queue as `needs-review`. The import should skip a key
  that holds a correction.
- **Effort:** S. **Protected by:** `storage.test.ts` asserts the cap, not the eviction policy.
- **Regression risk:** low.

### M4 (MEDIUM): the series-page resolution re-implements `gateByPlatformLink` and misses the "unlinked entry next to a linked one" rule

- **Evidence:** `page-media.ts:211-236` calls `resolveTarget` directly. It then rebuilds the gate with
  `seriesPageGate` + `singleEntryDoubt` + `representsWholeShow` + `isUnmatchedNamedSeason`. The `linked` branch of
  `gateByPlatformLink` (`matching.ts:1366-1367`, lower to `platformUnlinkedEntry` when the chosen entry is not itself
  linked) has no counterpart there.
- **Repro** (`signals.audit.test.ts`, T3): Netflix "Bubble": the film is linked, and a TV series with the same title has
  no link. `resolveTarget` → TV entry `high`; `gateByPlatformLink` → `low`. On the series page,
  `pageMatch.confident = true` → « certain ».
- **Impact:** the card shows the wrong entry as certain. `learnableSeriesLink` then records the Netflix URL on the wrong
  `mediaId` (« Ouvrir » points elsewhere), and the panel's +1 / add-to-list act on it.
- **Fix:** run the series page through the same gate. Extract a pure `judgeTarget(query, candidates, result) →
  {result, doubts}` used by `resolveEpisode`, `doubtedMapping` and `pickSeriesSeason` (see §4).
- **Effort:** M. **Protected by:** `page-media.test.ts`, corpus `kind: 'page'` cases (none covers a linked film next to a
  homonymous TV series).
- **Regression risk:** medium (One Piece Netflix arcs, through `representsWholeShow`).

### M5 (MEDIUM): the "anime" verdict of Disney+ / Prime Video series pages is not shared with playback

- **Evidence:** `page-media.ts:168` builds `{ platform, seriesId: page.seriesId, animeTitle }`. On Disney+ and Prime
  series pages `seriesId` is the entity uuid / compact GTI (`content/adapters/disney.ts:245`, `prime.ts:149`), so
  `platformSeriesKey` gives `disney:{uuid}`. Playback has `seriesId: null` (`disney.ts:134`, `prime.ts:127`), which
  gives `disney:title:{title}`. CLAUDE.md states the verdict is « shared with playback ».
- **Impact:** extra AniList searches, and the content script's `ignoredSeries` set is never fed from the series page. It
  never causes a wrong sync.
- **Fix:** build the ignored key with the same rule as `seriesMappingPrefix`, a title key on Disney+ and Prime (see D1).
- **Effort:** S. **Protected by:** `page-media.test.ts` (Netflix only shares the key for real).

### M6 (MEDIUM, partly UNVERIFIED): `season` numbering silently falls back to the displayed (possibly absolute) number

- **Evidence:** `applyMapping` (`matching.ts:460-466`) and `resolveByRules` (`:1010`) use
  `seasonEpisodeNumber ?? displayedEpisodeNumber`. For an airing entry (`episodes: null`), `isValidProgress` accepts any
  value. `writeEntry` checks only `progress > current.episodes`, which is `null` when the entry is airing. The import
  guards this case explicitly (`cr-import.ts:228`, `numbersKnown`); live sync does not.
- **Impact:** if a Crunchyroll page ever gives `displayedEpisodeNumber: 1160` with `seasonEpisodeNumber: null` on an
  arc mapped `season/offset 0` to an airing entry, progress 1160 is written. UNVERIFIED that live adapters emit this
  shape. The import authors considered it possible (« saison retirée du catalogue »).
- **Fix:** in `applyMapping`, a `season` mapping requires `seasonEpisodeNumber !== null`, unless the episode is not
  absolutely numbered (`displayed <= …` is unknowable, so simply return `null` and re-resolve). Share one helper,
  `seasonPosition(episode)`, with the import.
- **Effort:** S. **Regression risk:** low (Netflix and ADN always send both numbers; check the Disney+ films path).

### L1 (LOW): `bySignals` bypasses the "other-slug" cap

- **Evidence:** `matching.ts:1075-1080`: `provenTarget` returns its own result, not through `target()`, whose
  `isCapped` (`:1035`) would lower it. Repro T2: an entry with `other-slug` is present, no signals → `low`;
  `seasonYear` agrees with S2 → `high`.
- **Assessment:** arguably intended, since the year places the episode without relying on season rank. Document it, or
  apply the cap when the proof is only the episode count (`episodeCount` does not rule out a shifted season of the
  same length).
- **Effort:** S.

### L2 (LOW): session check and write are not atomic on the sync path

- **Evidence:** `writeEntry` calls `isSessionOpen` (`sync-service.ts:175`), then `tracker.saveProgress`, which decrypts
  the token at request time (`trackers/index.ts`). Other account-bound writes use `writeIfSessions` under the storage
  lock. Here the lock cannot be held across the network call, so a sign-out followed by a sign-in to another account
  between the check and the token read, a window of milliseconds, would write to the new account. Not exploitable in
  practice.
- **Fix (hardening):** pass the expected epoch down to the API client (`getValidToken(service, epoch)` refuses a token
  from another generation).
- **Effort:** M.

### L3 (LOW): recent syncs can be recreated for a closed session

- **Evidence:** `writeToServices` calls `addRecentSync({… epochs: options.epochs })` (`sync-service.ts:247`) after the
  network writes, without a session check. A sign-out during the writes runs `purgeClosedSessions` first, and then the
  entry reappears. « Corriger » then writes nothing (its epochs are closed), but the new account sees the previous
  account's entry in *Activity* until the next purge.
- **Fix:** `addRecentSyncIfSessions(epochs, …)` under the lock, like `writeIfSessions`.
- **Effort:** S.

### L4 (LOW): page-resolution memory cache not invalidated by mapping changes made outside the service worker

- **Evidence:** `forgetPageResolutions()` runs only after `EPISODE_COMPLETED`, `RESOLVE_REVIEW`, `DISMISS_REVIEW` and
  `REMOVE_FROM_LIST` (`background.ts:129-147`). « Oublier » (Settings), a backup restore and `deleteMediaMappingsByPrefix`
  write storage without it. Stale `remembered` cards can last up to 10 min (`page-media.ts:68`).
- **Fix:** listen to `storage.onChanged` on `mediaMappings` in the service worker and clear `resolutions`.
- **Effort:** S.

### L5 (LOW): `seriesMappingPrefix` misses Disney+ arc mappings

- **Evidence:** arcs are keyed `disney:title:<arc>:s99` (`matching.ts:452-455`). The page prefix is built from the series
  title (`page-media-rules.ts:22-25`), so `rememberedSeason` never sees arc choices. Display only.

### Cross-cutting notes (for the second agent)

- `decideImport` (`shared/cr-import.ts:192`) is a second rulebook next to `decideListUpdate`. REPEATING is skipped in the
  import but advanced live; « beyond » is checked inside the decision there and in `writeEntry` here. The import path
  does not run `revalidateCachedTarget` (404 / Part 2 published) on cached mappings.
- Exclusions (`platformSeriesKey`) on Disney+ / Prime have no year: excluding « Berserk » (1997) also excludes Berserk
  2016, while their mappings are now year-keyed.
- Title-keyed mapping keys depend on whether `signals.seasonYear` arrived (`matching.ts:454`). One Prime season can
  therefore live under two keys (`…:y2016:s1` and `…:s1`). A choice saved under one is invisible under the other, and
  the year-less key stays shared by remakes (this is H2's carrier).

---

## 2. Implicit invariants worth enforcing

| # | Invariant (today only implicit) | Where it is assumed | Proposal |
|---|---|---|---|
| I1 | A `chosen` mapping is never deleted or overwritten by an automatic path | `resolver.ts:452,487`, `sync-service.ts:302-321`, `cachedMappingVerdict` | A `MappingStore` API with `saveLearned` (refuses over `chosen`), `saveChosen`, `forgetIfUnchanged`. Type the origin as a union `{ origin: 'learned' \| 'chosen' \| 'unmarked' }` instead of two optional booleans (both `true` today is representable and meaningless). |
| I2 | A `bySignals` target on a `linkRequired` platform belongs to a linked franchise | `gateByPlatformLink` | Carry `chain` / `linkedChain: boolean` on `SyncTarget`; assert in the gate (H1). |
| I3 | `confidence: 'high'` from a title-bound link implies one connected chain | `linkOf`, `level()` | Distinct `LinkKind` (H2). |
| I4 | `numbering: 'season'` requires `seasonEpisodeNumber !== null` | `applyMapping`, `mappingFromManualChoice`, import `numbersKnown` | Shared `seasonPosition()` helper (M6). |
| I5 | A correction card (`previous !== null`) is never evicted or replaced by a simple card | `savePendingReview`, `createCrReviews` | Enforce in `savePendingReview` (M3); a type split `SimpleReview \| CorrectionReview` would make `epochs` / `deferred` mandatory on corrections (today optional on both). |
| I6 | Every write to a tracker happens under `withEntryLock`, after a fresh read and with a session check right before it | `writeEntry`, `importOnService`, controls, engagement, compare | Wrap `TrackerService.saveProgress` in a guarded write `writeGuarded(tracker, id, epoch, decide)` so a new path cannot forget a step. Today each caller repeats lock → read → decide → `isSessionOpen` → write. |
| I7 | Mapping keys, exclusion keys, ignored-series keys and series prefixes describe the same series | `mappingKey`, `platformSeriesKey`, `seriesMappingPrefix`, `resolveSeriesPage` | One `SeriesIdentity` module (D1); a property test checking that playback and series-page keys of the same show agree. |
| I8 | Lock order: queue item → entry → MAL refresh → storage | comment in `entry-lock.ts` only | A dev-only assertion (track held lock names in `withStorageLock`; throw if an entry lock is requested inside it). |
| I9 | `EpisodeNumbers.displayedEpisodeNumber > seasonEpisodeNumber` means absolute numbering | three copies (D2) | A single exported predicate. |

---

## 3. Duplicated business rules (divergence risk)

| ID | Rule | Copies | Divergence today |
|---|---|---|---|
| D1 | Series identity / key | `mappingKey` (`matching.ts:449`, arc and year), `platformSeriesKey` (`exclusions-core.ts:38`, neither), `seriesMappingPrefix` (`page-media-rules.ts:22`, forces `seriesId: null` on Disney+/Prime), ignored key in `resolveSeriesPage` (`page-media.ts:168`, keeps the uuid / GTI), `queueItemId` | M5, L5, and exclusions without year |
| D2 | Absolute numbering | `isAbsoluteNumbering` (`matching.ts:823`), `isAbsolute` in `resolveByRules` (`:1016`), `isAbsolute` in `collectCandidates` (`resolver.ts:178`) | Same today (different null handling) |
| D3 | Platform anime gate / final confidence | `gateByPlatformLink` (`matching.ts:1353`), `seriesPageGate` + `pickSeriesSeason` (`page-media.ts:181-236`, `page-media-rules.ts:36`), `doubtedMapping` (re-runs gate + `provenBySignals`) | M4 |
| D4 | "Own platform link" detection | `resolver.ts:103-104` (Prime: series, episode and URL ids), `page-media.ts:178-179` (Prime: `seriesId` only) | Series page ignores episode / URL ids |
| D5 | Relation counts only in airing order | `isSeasonRelation` (`resolver.ts:309`, plus `linksElsewhereOnly`), `neighbors` in `signalGroups` (`matching.ts:777-783`) | `signalGroups` does not apply `linksElsewhereOnly`: an in-order sequel linked only to another platform can join a concordance chain while never becoming a pool season (MONSTERS itself is excluded by both, as out of order). UNVERIFIED on a real case |
| D6 | Exact-title keys | `exactTitleKeys` (`matching.ts:1307`), `titleKeys` (`concordance.ts:175`) | Identical code |
| D7 | Series formats | `SERIES_FORMATS` (`matching.ts:27`), `SERIES` (`concordance.ts:77`) | Identical |
| D8 | ±2 episode tolerance | `SEASON_COUNT_TOLERANCE` (`matching.ts:75`), `COUNT_TOLERANCE` (`concordance.ts:72`), `EPISODE_COUNT_TOLERANCE` (`page-media-rules.ts:174`) | Identical |
| D9 | Group episode total | `total` in `alignPlatformSeasons`, `totalEpisodes` (concordance), `provenTarget:884`, `groupTotal` at `matching.ts:1137` (∞ if unknown) and `:1160` (unknown counted as 0) | Two semantics inside `resolveByRules` |
| D10 | Cached mapping validated against the catalog | `confirmImportedMapping` (`resolver.ts:374`, via `applyMapping`), `revalidateCachedTarget` (`sync-service.ts:295`, `progress > episodes`, 404) | Import path runs neither |
| D11 | Season number in a title | `seasonMarker` (normalized, end-anchored, no `temporada`), `seasonNumberFromTitle` (raw, with `temporada`) | Spanish « Temporada 2 » read on the platform side only |
| D12 | Special markers | `SPECIAL_TITLE_END` (`ova/oad/special/recap`), `SPECIAL_SEASON` (adds `extra/speciaux/movie/film`) | Intentional? Not documented |
| D13 | Read → decide → session check → write | `writeEntry`, `importOnService`, `controls.ts` ×3, `engagement.ts`, `compare.ts` | See I6 |
| D14 | List update rules | `decideListUpdate` (`rules.ts`), `decideImport` (`shared/cr-import.ts`) | REPEATING handled differently |
| D15 | Netflix `/title/{id}` regex | `matchNetflixLink` (`matching.ts:173`), `netflixShowIdInLink` (`:341`) | Identical; the first could call the second |

---

## 4. Complexity hotspots and decomposition

Measured with ESLint `complexity` / `max-lines-per-function` (scratch config):

| Function | Cyclomatic | Lines |
|---|---|---|
| `resolveByRules` (`matching.ts:994`) | **88** | 138 |
| `collectCandidates` (`resolver.ts:94`) | **50** | 105 |
| `pickSeriesSeason` (`page-media.ts:203`) | **43** | ~60 |
| `resolveEpisode` (`resolver.ts:422`) | 38 | ~70 |
| `dedicatedEntry` (`matching.ts:677`) | 23 | ~60 |
| `syncEpisode` (`sync-service.ts:345`) | 21 | ~60 |
| `checkedBySignals` | 18 | — |
| `legacySeriesSlugInLink` | 18 | — |

### 4.1 `resolveByRules`: Chain of Responsibility of pure "stages"

Today it is one closure-heavy function that returns early at about ten points. The `target()` closure applies three
cross-cutting rules: the other-slug cap, the title-only reason and the Prime label. Some stages bypass it (`bySignals`,
`noEntry`), which is how L1 happens.

```ts
interface Ctx { episode; candidates; pool; linked; groups; relative; displayed; isAbsolute; seasonNumber; concordance }
type Stage = (ctx: Ctx) => Proposal | 'next' | Failure;           // Proposal = { candidate, base, progress, numbering, confident, reason, flags }
const STAGES: Stage[] = [specialSeason, dedicated, provenBySignals, single, absoluteSplit, seasonByTitle, displayedBeyondSeason, seasonByNumber];
function resolveByRules(ctx: Ctx): ResolveResult {
  for (const stage of STAGES) { const r = stage(ctx); if (r !== 'next') return finalize(ctx, r); }   // finalize = cap, reasons, level()
  return undetermined;
}
```

Each stage becomes a unit-testable function. `finalize` is the only place that turns a proposal into a confidence,
which removes the L1 class of bug.

**Risk:** stage order is load-bearing (dedicated before `bySignals` before single). Freeze it with the corpus, which
already asserts entry, confidence and progress for 63 cases, plus `matching*.test.ts`. Port one stage at a time with
the corpus green.

### 4.2 Platform rules: Strategy per platform

The platform branches are scattered: `isTitleBoundLink`, `isOwnLink`, `settleTitleBoundLinks` (Disney+ only),
`linksElsewhereOnly` (ignores Prime), `primeAnimeGate`, `filtersAnime`, `LINK_MATCHERS`, `seriesIdInLink`,
`legacySeriesSlugInLink`, `mappingKey` (arc / year), the reason labels and `seriesMappingPrefix`. Group them in
`PlatformMatchPolicy`, next to `PLATFORMS`:

```ts
interface PlatformMatchPolicy {
  linkOf(url, query): LinkKind;            // includes own-link + title-bound semantics
  otherSeries(url, query): 'id' | 'slug' | null;
  settleLinks?(media, links): void;        // Disney+
  animeGate(query, candidates): 'open' | 'linked' | 'title' | 'none';
  seriesKey(query): SeriesIdentity;        // mapping / exclusion / ignored / prefix (D1)
  countsAsPresence: boolean;               // linksElsewhereOnly
}
```

This removes D1 and D4 by construction and makes H2's fix local to the Disney+ / Prime policies. Adding HIDIVE, which
is planned, becomes one file instead of a dozen `switch` statements.

**Risk:** medium, a broad mechanical move. Do it after 4.1, behind the existing per-platform matching tests.

### 4.3 `collectCandidates`: pipeline of pure steps over a `CandidateSet`

The steps are: search plan → link classification → Disney+ settle → relation propagation with bounded fetch rounds →
platform-season alignment. Separate the I/O (search, fetch by ids, injected as a `Catalog` port) from pure reducers
`classify`, `propagate` and `align`. The fixpoint loop becomes testable without mocks. The fetch budget
(`MAX_FETCH_ROUNDS`, `coveredByLinkedEntry`) stays in the orchestrator.

**Risk:** low to medium. The request budget is frozen by the corpus `searches`.

### 4.4 `resolveEpisode`, `doubtedMapping`, `pickSeriesSeason`: one judge, several callers

Introduce `judge(query, candidates, rulesResult) → { result, doubts: ('singleEntry' | 'unmatchedName' | 'wholeShow' |
'countMismatch')[] }` as a Specification-style list of named predicates. Each caller maps `doubts` to its own vocabulary
(`low` for sync, `uncertain` for the page). This fixes M4 and removes D3.

Split `resolveEpisode` into `fromCache()` (import confirmation → question → apply), `ignoredShortcut()` and
`fresh()`, around a `MappingStore` (I1) that owns the compare-and-set writes (M1, M2).

### 4.5 `syncEpisode`

The guards are already in a reasonable order: connected → excluded → resolve → ignored → correction pending →
uncertain → excluded target → write. A small decision table (`decideSyncAction(state) → 'not-connected' | 'excluded' |
'ignored' | 'defer' | 'review' | 'write'`), pure and fed by the async reads, would make the TEST-01 ordering tests pure
too. Low priority.

---

## 5. Suggested order

1. H1 (S), M1 guard (S), M2 compare-and-set (S), M3 eviction policy (S). Each comes with a regression test, and H1 also
   gets a corpus case.
2. H2 (M) with corpus cases for two linked remakes (Prime, Disney+).
3. M4 / D3 through `judge()` (M), then M5 / D1 through a shared `SeriesIdentity`.
4. Refactors 4.1, 4.3 and 4.2, in that order, each behind a green corpus.

## 6. Not verified

- Whether live adapters ever emit `seasonEpisodeNumber: null` with an absolute `displayedEpisodeNumber` (M6).
- Real AniList pairs of same-title remakes that both carry Disney+ / Prime links (H2). The code path is confirmed; how
  often it happens is not.
- How often Netflix `seasons[].year` disagrees with the linked entry (H1 trigger).
- How often MAL and AniList split a season differently. With the beyond guard and the never-backwards rule, progress
  stalls instead of being corrupted (`writeEntry:146`), so it stays a known limitation, not a bug.
