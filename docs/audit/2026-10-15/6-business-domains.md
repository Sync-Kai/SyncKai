# Audit 6: business domains outside sync and matching

Scope: history imports (Crunchyroll, ADN, Netflix), resumable jobs, Agenda, airing notifications, list and entry actions, AniList/MAL parity, auth and sessions, settings, exclusions, preferred player, optional platform access, backup, AniList↔MAL comparison and engagement prompts.
Repo `/home/user/SyncKai`, branch `feature/match-signals` @ 9a5d08c. Read-only audit. A throwaway test confirmed the findings marked "confirmed by test" (see Appendix):
`/tmp/claude-0/-home-user/d3b7fa96-95d6-59e4-903d-2a42a7d1a01e/scratchpad/audit-domains/domains.test.ts`.

Overall: these domains are in good shape. Concurrency is handled carefully: the storage lock, per-entry locks, session epochs, and jobs that resume with heartbeats. Pure rules are separated from I/O and well tested. I found **no CRITICAL issue**. The real defects are two MEDIUM bugs: score parity, and session binding of imported backups. The rest are LOW edge cases. The main structural risk is **rule duplication**: the "watched" predicates, the per-season reducers, list-update rules, MAL status maps, key lists purged at sign-out, retry classification and target resolution each have 2–4 copies.

Legend: severity CRITICAL / HIGH / MEDIUM / LOW · effort S / M / L · "UNVERIFIED" = inferred from reading the code, not reproduced.

---

## 1. Correctness bugs and rule violations

### B1 [MEDIUM, effort S] One SyncKai rating gives different AniList and MAL scores, and the comparison flags it as a gap (confirmed by test)

- `src/shared/score.ts:21-22` `toAniListScore(.., 'POINT_10')` = `Math.round(score)`, so 8.5 becomes **9**.
- `src/shared/score.ts:32-34` `toMalScore` = `Math.floor(score)`, so 8.5 becomes **8**.
- `src/shared/compare.ts:124-129` `scoresMatch(9, 8, 'POINT_10')` checks `malScoreFrom(9)=9 ≠ 8` and `toAniListScore(8)=8 ≠ 9`, so it returns **false**.
- Triggering input: an AniList profile in `POINT_10`. The user rates a finished series 8.5 from the « À noter » card (`engagement.ts:89` › `saveScore` on both services).
  - AniList stores 9 and MAL stores 8.
  - *Activité › Écarts* then lists a score gap the user never created.
  - "Align on AniList" writes MAL 9, above the user's own rating, which breaks the documented rule "jamais au-dessus de la note donnée".
  - "Align on MAL" writes AniList 8.
- The throwaway test finds 11 mismatching half-points: every `x.5` from 1.5 to 9.5 on `POINT_10`, plus 4.5 and 7.5 on `POINT_3`.
- Existing tests pin each side separately (`src/background/sync/score.test.ts:16` expects 7.5→8, `:38` expects 8.5→8) but never test parity.
- Fix options:
  - (a) make `scoresMatch` treat "same SyncKai score10 source" as equal by also accepting `|on10 − mal| < 1` when `format === 'POINT_10'`; or
  - (b) better, keep one rounding policy per target and add a parity property test: `∀ s ∈ 0.5..10 step 0.5, ∀ format: scoresMatch(toAniListScore(s,f), toMalScore(s), f)`.
- Protecting tests: `src/shared/compare.test.ts`, `src/background/sync/score.test.ts`. Regression risk: low. The comparison and the rating paths share these helpers only.

### B2 [MEDIUM, effort S] Backup imported before the accounts are connected: its « À noter » cards and corrections can never be applied (confirmed by test)

- `src/shared/backup-store.ts:37` binds the imported data to `getOpenSessions()`. With no account connected this is `{}`, so every imported `pendingRatings[i].epochs` and `recentSyncs[i].epochs` becomes `{}` (`src/shared/backup.ts:279-286`).
- Rating from the card:
  - `engagement.ts:92` computes `sessionsOf({}, open)`, which returns `{}`.
  - `onService` (`engagement.ts:68`) then calls `isSessionOpen(id, undefined)`, which is false, so every service answers « session fermée ».
  - `isRatingSettled` stays false and the card stays forever, until a sign-out purges it (`storage.ts:628`).
- "Corriger" on an imported recent sync takes the same path: `sync-service.ts:486` passes `sessionsOf({}, …)` and `writeToService` skips every service (`sync-service.ts:118`).
- With only AniList connected at import time, MAL is silently never written for those cards.
- Triggering flow: fresh install → Settings › Backup › Import → connect AniList → rate a card from the backup.
- Nothing prevents this order: `src/import/import.ts:102` has no connection precondition.
- Fix options:
  - bind imported items lazily: leave `epochs` undefined, which `sessionsOf` already treats as "current session", and let the first sign-out purge apply; or
  - refuse or warn on import while no account is connected.
- Protecting tests: `src/shared/backup.test.ts`, `src/shared/backup-store.test.ts`, `src/background/engagement.test.ts`. Regression risk: low.

### B3 [LOW, effort S] Import preview: duplicate review keys keep the first season, not the most advanced one

- In `src/shared/cr-import.ts:372-374`, `uniqueReview` keeps the first occurrence of each `key`.
- Crunchyroll seasons with `season_number` null are split by `seasonId` (VO and VF) in `content/lib/crunchyroll-history.ts:319-320`. Both map to the same key `crunchyroll:{id}:s0` (`matching.ts:455`).
- The reducer sorts by `lastPlayedAt` desc, so the card suggests the most recently played version, which may be behind.
- The absolute-numbering merge (lines 316-327) handles this case correctly, but only when `isAbsoluteSeason`.
- Fix: merge any same-key review items with the highest `suggestion.progress` wins rule.

### B4 [LOW, effort S] Netflix import ignores the "percentage only" completion trigger

- `src/shared/netflix-import.ts` `isNetflixWatched` always uses the `watchedToEndOffset` / `creditsOffset` marks.
- Live sync honours `completionTrigger: 'percentage'` (`shared/settings.ts:30`).
- The import page passes only `completionPercentage` (`import-cr.ts:509`).
- A user who chose "percentage" gets a stricter or looser rule on import than in live sync. This divergence is not documented.

### B5 [LOW, effort S] Dead branch in `startRewatch`

- `src/background/engagement.ts:147-148`: the `progress > episodes` check (« au-delà de la fiche ») is unreachable, because `progress >= episodes` already returned on the line before.
- Harmless, but the intended "beyond the entry" message is never shown.

### B6 [LOW, effort S] Rating card keyed `mal:<id>` is not removed when rated through its AniList ref

- `rateMedia` looks the card up and removes it with `mediaRefId(media)` only (`engagement.ts:91,112`).
- A card created from the MAL list (`mediaId: null`) and later rated from a screen that knows the AniList id:
  - is not found, so no epoch gating is applied;
  - is not removed after a successful rating.
- `afterRemoval` already handles both ids (`engagement.ts:198`). The rating path should reuse that.

### B7 [LOW, effort S, UNVERIFIED] "Retirer de la liste" does not clear queued syncs or review cards for that series

- `removeFromList` (`engagement.ts:212-236`) clears page caches and the watching cache only.
- An offline sync queued before the removal (`SYNC_QUEUE_KEY`) or a « À vérifier » card is replayed later and re-adds the entry.
- The code documents re-adding as intended "for a later episode", but not for an item queued *before* the removal.

### B8 [LOW, effort S] Asymmetric sign-in hygiene between AniList and MAL

- `auth/anilist.ts:78` closes the previous session if a token is still stored (account may change). `auth/mal.ts:220` (`saveMalToken`) does not.
- The epoch is not bumped and the old account's cached profile, comparison and import plan are kept.
- It is reachable only if `LOGIN_MAL` is sent while a MAL token exists (stale second screen). UNVERIFIED in the UI, since `ui/accounts.ts:149` hides the button.
- Cheap fix: mirror the AniList branch: `if (await hasMalToken()) await clearMalSession()`.

### B9 [LOW, effort S] Background-classified work runs on the interactive AniList lane

- The hourly airing check `fetchAiring` → `anilistPublicQuery` defaults to `'interactive'` (`airing.ts:124`, `api/client.ts:123`). So does `refreshStaleWatching` → `getWatchingList`.
- Job writes reserve a *background* slot (`jobs/runner.ts:66-75`), then send the real `getEntry` / `save*` requests as **interactive** (`api/list.ts:112,149`).
- Consequences:
  - the hourly check (up to 3 pages × ⌈n/50⌉) bypasses the 20/min background budget;
  - each job request also arms `INTERACTIVE_GRACE_MS`, which pauses other background jobs.
- This is not a correctness bug, but the budget accounting is approximate. Pass `'background'` through `TrackerService.getEntry` / `save*`, and through `fetchAiring` when called from the alarm.

### B10 [LOW, effort S] Settings: two write strategies

- `ui/settings/settings-view.ts:136-146` writes its whole in-memory snapshot without the storage lock. It is refreshed through `onChanged`, line 366.
- `saveSeriesOffset` (`agenda-store.ts:55`) and `resetRevokedPlayer` (`netflix-access.ts:29`) do a locked read-modify-write.
- A settings change made while the panel's Agenda saves an offset, or while access is revoked, can overwrite the other write within the `onChanged` latency window.
- Fix: add one `updateSettings(patch)` under the lock and use it everywhere.

### B11 [LOW, info] Analysis job heartbeat during long list reads

- `compareServiceLists` (`compare.ts:188-225`) touches the job only once, after both full lists are fetched. Budget waits also touch it through `trackBudgetWaits`.
- Interactive-lane MAL pages are slow, with up to 20 pages and a timeout each. Without budget waits, more than 60 s would make the analysis look stale: a second analysis could start, and `resumeCompareJob` would delete the running one.
- It is unlikely with typical lists. A `withHeartbeat` wrapper as in `jobs/runner.ts:179` would close it.

### Checked and correct (no finding)

- **Time zones and DST**: Agenda weeks are built from local midnights (`shared/agenda.ts:91-115`); notification windows use absolute UNIX seconds (`airing-policy.ts:385-403`).
- **Duplicate notifications**: alarm and manual check share the `airingNotified` set under the lock, notification ids are per schedule id, and a failed notification is retried without being notified twice (`airing.ts:171-189, 241-288`).
- **Import idempotence**: every item is re-read under the entry lock before writing (`cr-import.ts:409-427`). `written[]` preserves partial success across retries, and re-applying the same plan only skips (`defaultSelection`).
- **Service-worker restart mid-job**: the stale job becomes « Reprise… »; lost resolution batches are recomputed in `finalize`; the alarm is recreated on update (`job-resume.ts`).
- **Sign-out during import or compare**:
  - `removeAniListSession` / `removeMalSession` delete `crImport:*` and `compare:*`, so the loops stop on the next read;
  - `savePlanIfSession` / `writeIfSessions` refuse to write for a stale account;
  - MAL token refresh is atomic with the epoch (`saveRefreshedMalToken`).
- **MAL rewatch mapping**: completed + `is_rewatching` maps to REPEATING (both directions). The rewatch counter is bumped on the final episode (`rules.ts:34-39`, `api/mal.ts:78-86`).

---

## 2. Duplicated business rules (divergence risk)

| # | Rule | Copies | Divergence already present |
|---|---|---|---|
| D1 | "Episode counts as watched" | `content/lib/crunchyroll-history.ts:312` `isWatched`, `shared/adn-import.ts:88` `isAdnWatched`, `shared/netflix-import.ts` `isNetflixWatched`, live tracker completion (`completionTrigger` + percentage) | Netflix ignores `completionTrigger` (B4) |
| D2 | "Best episode per season + watched count + lastPlayedAt" reducer | `crunchyroll-history.ts:333` `reduceHistory`, `adn-import.ts:100` `reduceAdnHistory`, `netflix-import.ts` `reduceNetflixShow` | Season keys differ: CR `series:sN` or `series:seasonId`; ADN `show:s(N??0)`; Netflix `showId-sSeq` |
| D3 | List update ("never go back", completed, rewatch) | `background/sync/rules.ts:53` `decideListUpdate` + `progressWrite`, `shared/cr-import.ts:192` `decideImport` | Import does not use `progressWrite`. It skips REPEATING and "beyond" where live sync updates (shown in the test). Intended, but encoded twice |
| D4 | Rating prompt after completion | `sync-service.ts:186` `shouldPromptRating` (excludes rewatch, checks catalog total), `controls.ts:176` `shouldQueueRating` (no rewatch check) | Marking a rewatch « Terminé » queues a rating, while finishing it through playback does not |
| D5 | Score conversion | `shared/score.ts` `toMalScore` (floor) vs `shared/compare.ts:114` `malScoreFrom` (floor + ε); `toAniListScore` rounding | B1 |
| D6 | MAL status maps | `api/mal.ts` `MAL_TO_LIST_STATUS`, `STATUS_CHANGE_TO_MAL`, `LIST_STATUS_TO_MAL`, `toMalStatus`, plus 3 `is_rewatching` builders (`malStatusBody`, `malProgressBody`, `malEntryBody`) | Each body decides `is_rewatching` differently (correct today) |
| D7 | Account-bound key lists purged at sign-out | `storage.ts:39` `CR_IMPORT_STORAGE_KEYS`, `storage.ts:333` / `:459` (AniList / MAL near-copies), `storage.ts:357-371` `removeUserSyncData`, `cr-import.ts:118` `purgeOrphanImportData`, `cr-import-store.ts:17` `resetCrImport` | A new `crImport:*` key must be added in 3–4 places |
| D8 | Retry classification | `jobs/runner.ts:119` `transientKind` (429; 500/502/503/504 or timeout; network), `sync/queue-policy.ts:27` `isRetryableError` (any 5xx, 429, network) | 501/505 are retried by the queue but not by jobs |
| D9 | Target resolution (service → id) | `controls.ts:71` (prefers catalog idMal), `engagement.ts:32` (trusts the `MediaRef` from the screen), `cr-import.ts:468`, `compare.ts:253-257`, `crImport.buildCrImportPlan:350` | Rating, rewatch and removal miss MAL when the screen's ref has `malId: null` but the catalog has one |
| D10 | Session gating before a write | `sync-service.ts:118` (before the lock), `engagement.ts:70,76` (before and inside), `cr-import.ts:417,423` (before and inside), `controls.ts` (none), `compare.ts processItem` (none, relies on job deletion) | Inconsistent; low impact |
| D11 | "AniList user id" helper | `compare.ts:95` and `api/watching.ts:113` (identical) | none yet |
| D12 | Job reservation ("if active keep it, else start") | `compare.ts:192-197`, `compare.ts:331-336`, `cr-import.ts:553-561` | none yet |
| D13 | "When is an episode available" | Agenda: `platformOffsets` / `seriesOffsets` (`shared/agenda.ts:285`); notifications: global `airingDelayHours` (`airing-policy.ts:385`) | A series set to +3 days in the Agenda is still notified at JP air time + global delay |

---

## 3. Over-complex modules and proposed decomposition

### P1 [effort M, high value] Unified history-import Strategy (D1, D2, B4)

`src/import-cr/import-cr.ts` (1174 lines) mixes three source readers (CR port, ADN port, Netflix page-driving), the page state machine (`Step` union) and rendering. The three reducers and watched rules live in three modules.

```ts
// shared/history-source.ts
export interface WatchEvent {
  seriesId: string; seriesTitle: string; seriesSlug: string | null;
  seasonKey: string;               // the source decides (CR dub merge, ADN s0, Netflix seq)
  seasonNumber: number | null; seasonTitle: string | null;
  episodeId: string; episodeTitle: string | null;
  displayed: number; inSeason: number | null;
  position: number; duration: number | null;   // seconds
  endMarks: number[];              // credits / watched-to-end, empty if unknown
  fullyWatched?: boolean; playedAt: number | null;
  extras?: Pick<HistorySeason, 'platformSeasons' | 'signals'>;
}
export function isEpisodeWatched(e: WatchEvent, s: Pick<SyncSettings, 'completionTrigger' | 'completionPercentage'>): boolean { /* one rule */ }
export function reduceWatchEvents(events: readonly WatchEvent[], s: …): HistorySeason[] { /* one reducer */ }

// import-cr/sources/*.ts
export interface HistorySource {
  id: ImportPlatform;
  hasAccess(): Promise<boolean>; requestAccess(): Promise<boolean>;
  findTab(): Promise<chrome.tabs.Tab | null>;
  read(tabId: number, ctx: { stopped(): boolean; progress(p: ReadProgress): void }): Promise<Result<WatchEvent[], CrHistoryErrorCode>>;
}
```

- Benefit: one watched rule and one reducer, and a new platform (HIDIVE is planned) means one file.
- Risk: the content bundle is at 83.0/83 KB, so the CR reducer must stay out of the content script. Emit raw events over the port; the import page reduces them, as ADN already does.
- Protecting tests: `content/adapters/netflix-import-parity.test.ts`, `shared/adn-import.test.ts`, `shared/netflix-import.test.ts`, the CR history tests, and `scripts/ext-e2e/import.ext.ts`.

### P2 [effort M] Complete the Tracker Strategy with codecs (D5, D6, D9, B1)

`TrackerService` already exists (`trackers/tracker.ts`). Callers still branch on `service === 'anilist'` for ids, scores, full lists and status maps (`cr-import.ts:323,350,468`, `compare.ts:257`, `shared/compare.ts:253,326`).

```ts
interface ScoreCodec { toService(s: Score10): Promise<number>; toTen(raw: number): number | null; equivalent(raw: number | null, otherTen: number | null): boolean }
interface TrackerService {
  // …existing
  readonly scores: ScoreCodec;
  fullList(lane: RequestLane): Promise<{ id: number; state: ListEntryState }[]>;   // moves out of compare.ts (cr-import imports it today)
  targetId(ref: { mediaId: number | null; malId: number | null }, catalog?: CatalogMedia): number | null;
}
```

- Benefit: one place per service for status and score rules; the parity property test from B1 becomes a contract test run on both codecs.
- Risk: medium. It touches every write path, but behind the same interface.
- Protecting tests: `api/mal.test.ts`, `api/list.test.ts`, `compare-parse.test.ts`, `shared/compare.test.ts`, `sync-service.test.ts`.

### P3 [effort M] Command pattern for entry actions (D9, D10, B6, optional undo)

`controls.ts` (+1/−1, status, add) and `engagement.ts` (rate, rewatch, notes, remove) repeat the same skeleton four to six times: resolve targets → per service: session check → entry lock → fresh read → pure decision → session re-check → write → outcome.

```ts
interface EntryCommand<D> {
  readonly name: string;
  decide(entry: TrackerEntry, svc: TrackerId): D | Skip;           // pure, already exists (decideAdjustment, decideStatusChange…)
  execute(tracker: TrackerService, id: number, d: D): Promise<ServiceOutcome>;
  snapshot?(entry: TrackerEntry): EntrySnapshot;                    // enables « Annuler » (remove, status)
}
async function runOnServices<D>(ref: MediaRef, cmd: EntryCommand<D>, opts: { epochs: SessionEpochs | null }): Promise<ServiceResult[]>;
```

- Benefit:
  - one consistent epoch gating (fixes D10);
  - one target resolution (fixes D9);
  - an undo is possible for "Retirer de la liste", the only destructive action, by replaying the snapshot through `saveEntry`.
- Risk: low to medium. The pure decision functions are kept as they are.
- Protecting tests: `controls.test.ts`, `engagement.test.ts`, `scripts/ext-e2e/lists.ext.ts`.

### P4 [effort S–M] Registry of account-bound stores (Repository + Observer) (D7)

`shared/storage.ts` (656 lines) holds tokens, epochs, mappings, reviews, watching cache, sign-out and migrations.

```ts
interface AccountBoundStore { keys: readonly string[]; scope: 'per-service' | 'user'; purge?(open: SessionEpochs): Promise<void> }
export const ACCOUNT_STORES: AccountBoundStore[] = [crImportStore, compareStore, airingStore, queueStore, ratingsStore, …];
// removeSession(service) and removeUserSyncData iterate the registry instead of literal key lists
```

- Benefit: adding a key means one declaration, and a test can assert that every `STORAGE_KEYS` entry is classified as global or account-bound.
- Risk: low.
- Protecting tests: `shared/storage.test.ts`, `scripts/ext-e2e/accounts.ext.ts`.

### P5 [effort L, optional] Explicit import-session state machine

- Today, 4 keys (`crImport:job`, `:input`, `:resolutions`, `:plan`) plus in-memory `analyzeMemory` / `applyMemory` (`background/cr-import.ts:132-165`) are kept consistent by ad-hoc guards: `purgeOrphanImportData`, `savePlanIfSession`, `resetCrImport`, `builtAt` checks.
- Proposal: one discriminated union `ImportSession = { phase: 'analyzing'; input; resolutions; job } | { phase: 'preview'; plan } | { phase: 'applying'; plan; job }` persisted under one key, with a pure `reduceImport(session, event)` like `reduceJob`.
- Splitting `background/cr-import.ts` into `analyze.ts`, `apply.ts` and a generic `BatchWriter<T>` (the batching logic is written twice, lines 172-207) is a cheaper first step (effort S).
- Benefit: impossible states become unrepresentable, and resume is simpler.
- Risk: medium (storage migration of an in-flight import). Do it only together with P1.

### P6 [effort S] Small extractions

- `getAniListUserId` → `api/viewer.ts` (D11).
- `reserveJob(store, start)` → `jobs/runner.ts` (D12).
- One `isRetryable(error)` shared by `queue-policy.ts` and `runner.ts` (D8).
- `updateSettings(patch)` under the lock (B10).
- Optionally make notifications use `estimateRelease` (D13): owner decision.

---

## 4. Ranked summary

| Id | Severity | Effort | Area | Protecting tests | Regression risk |
|---|---|---|---|---|---|
| B1 score parity | MEDIUM | S | ratings / comparison | `score.test.ts`, `shared/compare.test.ts` (+ property test) | low |
| B2 backup epochs `{}` | MEDIUM | S | backup / engagement | `backup*.test.ts`, `engagement.test.ts` | low |
| D7 / P4 key lists | MEDIUM (maintainability) | S–M | sessions | `storage.test.ts`, `accounts.ext.ts` | low |
| D1–D2 / P1 import strategy | MEDIUM (maintainability) | M | imports | parity / import tests, `import.ext.ts` | medium (bundle budget) |
| P2 tracker codecs | MEDIUM (maintainability) | M | AniList / MAL parity | `api/*.test.ts`, `compare*.test.ts` | medium |
| P3 entry commands | LOW–MEDIUM | M | list actions | `controls` / `engagement` tests, `lists.ext.ts` | low–medium |
| B3 review dedupe | LOW | S | import preview | `shared/cr-import.test.ts` | low |
| B4 Netflix trigger | LOW | S | Netflix import | `netflix-import.test.ts` | low |
| B5 dead branch | LOW | S | rewatch | `engagement.test.ts` | none |
| B6 rating card id | LOW | S | engagement | `engagement.test.ts` | low |
| B7 removal vs queue | LOW (UNVERIFIED) | S | list actions | `queue.test.ts` | low |
| B8 MAL re-login | LOW (UNVERIFIED reachability) | S | auth | `auth/mal.test.ts` | low |
| B9 request lanes | LOW | S | rate budget | `rate-limit.test.ts`, `runner.test.ts` | low |
| B10 settings write | LOW | S | settings | `settings.test.ts` | low |
| B11 compare heartbeat | LOW | S | comparison | `compare.test.ts` | low |
| D4, D8, D9, D10, D13 | LOW | S | various | see table §2 | low |

Not tested in a real browser during this audit: none of the items above were reproduced on the real sites. B1 and B2 are confirmed by unit-level execution of the real functions.

---

## Appendix: throwaway test (scratchpad only)

`/tmp/claude-0/-home-user/d3b7fa96-95d6-59e4-903d-2a42a7d1a01e/scratchpad/audit-domains/domains.test.ts`, run with its own config `…/audit-domains/vitest.config.ts`:

- `scoresMatch(toAniListScore(s,f), toMalScore(s), f)` fails for:
  - `POINT_10`: every half-point from 1.5 to 9.5 (AniList rounds up, MAL floors);
  - `POINT_3`: 4.5 (AniList 2 vs MAL 4) and 7.5 (AniList 3 vs MAL 7).
- `bindBackupToSession(data, {})` returns ratings with `epochs: {}`; `sessionsOf({}, {anilist: 3, mal: 1})` returns `{}`; `liveServices({}, …)` returns `[]`.
- `decideListUpdate` vs `decideImport` on a REPEATING entry and on progress beyond the total: live sync updates, the import skips.
