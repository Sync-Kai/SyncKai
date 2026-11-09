# Sequel alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** tell the user once when a series they finished, watch or rewatch gets a sequel on AniList, and let them add it to Planning from the notification, *Activité*, the side panel and the Agenda.

**Architecture:** pure rules in `src/shared/sequels.ts` (candidates, state store, pruning, date label, grouping); a daily pass in `src/background/sequels/` run from the existing hourly airing alarm (no new listener) that reads the user's full lists and the relations of their series by batches of 50, writes the account-bound store `sequels:state` under the session epochs and sends notifications; the screens read the store from storage and change it through one message.

**Tech Stack:** TypeScript, Preact, Tailwind 4 tokens, Vitest, Puppeteer e2e.

**Spec:** `docs/superpowers/specs/2026-11-09-sequel-alerts-design.md`

## Global Constraints

- AniList only for catalogue data; MAL API only for the user's own full list (`fetchMalFullList`), as today.
- Every AniList request of the pass on the `'background'` lane.
- Relations batch: 50 ids per request (measured 2026-11-09 on the real API: 50 popular ids, 366 edges, no complexity error, max 65 edges for one media).
- No new `addListener` in `background/` (counts frozen in `src/architecture.test.ts`), no `storage.onChanged` there.
- Store `sequels:state` scope `account` (`browser/storage/account-keys.ts`); `known` ≤ 2000 ids, `records` ≤ 200.
- Candidate: `relationType === 'SEQUEL'`, node `type === 'ANIME'`, `format` ∈ {TV, TV_SHORT, ONA, MOVIE}, `status` ∈ {NOT_YET_RELEASED, RELEASING}, id and `idMal` in no list of any connected account (any status).
- Source series: list status COMPLETED, CURRENT or REPEATING; excluded series ignored.
- At most one pass per 24 h; notifications id prefix `synckai-sequel:`; silent (`priority: 0`), Kai icon, Chrome buttons only (`__SYNCKAI_TARGET__ !== 'firefox'`).
- Every new UI string: en text, context note in `docs/i18n/context.json`, 20 translations following each `docs/i18n/glossary/<code>.md`, `npm run i18n:check` 0 errors (`docs/memory/i18n.md`). Dates and counts through placeholders and plurals, never concatenated.
- Code comments in French; no formatter; commits in English (Conventional Commits), author QuentinGeerts, no Claude mention, no `Co-Authored-By`.
- Checks through the `synckai-verify` skill; `CI=1` for e2e and layout in cloud sessions.

## Review Focus

1. A series on both accounts (AniList id and its `idMal`) and a sequel present only in the MAL list (matched by `idMal`): one source, sequel not a candidate. Test in Task 1.
2. The same sequel reached from two sources (TV season and a film both SEQUEL to it): one record, one notification. Test in Task 1.
3. A pass that fails halfway (429, network): no store write, `lastCheck` unchanged, no notification; the next hour retries. Test in Task 4.
4. A sign-out or account switch during the pass: nothing written, nothing notified. Test in Task 4.
5. Notifications blocked: records still created as `new` and shown in *Activité*, never notified later (they are in `known`). Test in Task 4.

---

### Task 1: Pure rules (`src/shared/sequels.ts`)

**Files:**
- Create: `src/shared/sequels.ts`, `src/shared/sequels.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SequelFormat = 'TV' | 'TV_SHORT' | 'ONA' | 'MOVIE';
  export type SequelStatus = 'NOT_YET_RELEASED' | 'RELEASING';
  export type AniListSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
  export interface SequelSnapshot { id: number; idMal: number | null; title: string; format: SequelFormat; status: SequelStatus; coverUrl: string | null; siteUrl: string; year: number | null; month: number | null; day: number | null; season: AniListSeason | null; seasonYear: number | null; sourceId: number; sourceTitle: string }
  export type SequelState = 'new' | 'seen' | 'dismissed';
  export interface SequelRecord { snapshot: SequelSnapshot; state: SequelState; firstSeenAt: number }
  export interface SequelStore { records: SequelRecord[]; known: number[]; seeded: TrackerId[]; lastCheck: number | null }
  export interface RelationEdge { relationType: string; node: { id: number; idMal: number | null; type: string; format: string | null; status: string | null; title: string; coverUrl: string | null; siteUrl: string; year: number | null; month: number | null; day: number | null; season: string | null; seasonYear: number | null } }
  export interface SourceSeries { id: number; title: string; services: TrackerId[] }
  export interface InLists { ids: ReadonlySet<number>; malIds: ReadonlySet<number> }
  export const EMPTY_SEQUEL_STORE: SequelStore;
  export const MAX_SEQUEL_RECORDS = 200; export const MAX_KNOWN_SEQUELS = 2000;
  export function isSequelStore(value: unknown): value is SequelStore;
  export function sequelCandidates(sources: readonly { source: SourceSeries; edges: readonly RelationEdge[] }[], inLists: InLists): { snapshot: SequelSnapshot; services: TrackerId[] }[];
  export function mergeSequelPass(store: SequelStore, candidates: ReturnType<typeof sequelCandidates>, servicesThisPass: readonly TrackerId[], now: number): { store: SequelStore; toNotify: SequelSnapshot[] };
  export function visibleSequels(store: SequelStore): SequelRecord[]; // new + seen, by firstSeenAt desc
  export function setSequelStates(store: SequelStore, ids: readonly number[], state: SequelState | 'removed'): SequelStore;
  ```
  `TrackerId` from `src/shared/tracker.types.ts`.

- [ ] **Step 1: Write the failing tests** in `src/shared/sequels.test.ts`:
  - `sequelCandidates`: keeps SEQUEL/ANIME/TV NOT_YET_RELEASED; drops PREQUEL, SIDE_STORY, MANGA, OVA, SPECIAL, MUSIC, FINISHED, CANCELLED; drops a node whose `id` is in `inLists.ids` and one whose `idMal` is in `inLists.malIds`; two sources reaching the same sequel id → ONE candidate whose `services` is the union and `sourceId` the first source (Review Focus 2).
  - `mergeSequelPass` on `EMPTY_SEQUEL_STORE` with services `['anilist']`: records created `new`, `toNotify` empty (first pass), `seeded` becomes `['anilist']`, every id in `known`, `lastCheck === now`.
  - second pass (seeded `['anilist']`) with one new candidate from `anilist` → `toNotify` has it; a candidate coming only from `mal` while `seeded` is `['anilist']` → recorded `new`, NOT in `toNotify`, `seeded` becomes `['anilist','mal']`.
  - a known id never re-notified: record pruned (not candidate anymore), then candidate again → not in `toNotify`, not recreated as `new` (stays absent, id kept in `known`).
  - snapshot refresh: same id, new `month` → record updated, state unchanged, not in `toNotify`.
  - record whose id is no longer a candidate → removed from `records`, kept in `known`.
  - cap: 205 records (3 `dismissed`, 202 `seen`/`new`) → 200 kept, the `dismissed` ones dropped first, then oldest `seen`; `known` capped at 2000 keeping the newest ids.
  - `setSequelStates(store, [id], 'seen' | 'dismissed' | 'removed')`: `removed` drops the record but keeps `known`.
  - `isSequelStore` rejects a record with a non-number id, an unknown state, a `seeded` entry other than `anilist`/`mal`.

- [ ] **Step 2: Run** `npx vitest run src/shared/sequels.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the module (pure, no browser API: `src/architecture.test.ts` checks `shared/`). `sequelCandidates` iterates sources in the given order. `mergeSequelPass`: candidates in `known` but without a record are ignored (never recreated); unknown candidates become `new` records; `toNotify` = new records whose `services` contain a service already in `store.seeded` before the pass.
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sequels): add the sequel candidate and state rules`.

### Task 2: Texts in 21 languages

**Files:**
- Modify: `src/i18n/locales/*.json` (21), `docs/i18n/context.json`, `docs/i18n/review/<code>.md` (one log line each, where the file exists)

**Interfaces:**
- Produces these keys (en text; fr in brackets as the reference for translators):
  `sequel.heading` Announced sequels [Suites annoncées] · `sequel.add` + Plan to watch [+ À regarder] · `sequel.addLabel` Add {title} to Plan to watch · `sequel.dismissLabel` Hide {title} · `sequel.dateUnknown` Date to be announced [Date à venir] · `sequel.airing` Already airing [Déjà en diffusion] · `sequel.announced` Announced [Annoncée] · `sequel.inList` Already in your list · `sequel.added` Added to Plan to watch · `sequel.notOnMal` not on MyAnimeList yet · `sequel.new` New · `sequel.source` sequel to {source} · `sequel.more_*` {count} more announced sequels · `sequel.notification.single` Sequel announced: {title} · `sequel.notification.message` {date} · sequel to {source} · `sequel.notification.group_*` {count} sequels announced · `sequel.notification.open` Show in SyncKai · `sequel.notification.openEntry` Open entry · `agenda.view.week` Week · `agenda.view.announced` Announced · `agenda.announced.empty` No announced sequels for your series · `settings.section.sequels` Announced sequels · `settings.sequels.label` Sequel alerts · `settings.sequels.help` When a series you finished or are watching gets a sequel on AniList · `settings.sequels.browser` Browser notification · `settings.sequels.browserHelp` Otherwise, only in Activity · `settings.sequels.found_*` {count} sequels found · `settings.sequels.restore_*` Show {count} hidden sequels again · `nav.activityNewSequels` Activity, new sequels announced.
  Reused: `common.retry`, `common.open`, `panel.nowPlaying.season.{WINTER,SPRING,SUMMER,FALL}` (`{year}`), `airing.status.last`, `airing.status.never`, `airing.skip.*`.

- [ ] **Step 1:** add the en texts and one context note per key (where, meaning, placeholders, length; `+` prefix kept as a symbol in every language).
- [ ] **Step 2:** add the 20 translations, each language's term sheet respected (fr « tu », de « du »; « Plan to watch » = the term already used for the Planning status in that catalog).
- [ ] **Step 3: Run** `npm run i18n:check` (log to the scratchpad). Expected: 0 errors.
- [ ] **Step 4: Run** `npx vitest run src/i18n scripts/i18n-context.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(i18n): add the sequel alert texts in 21 languages`.

### Task 3: Settings, storage key and alarm condition

**Files:**
- Modify: `src/shared/settings.ts`, `src/shared/settings.test.ts`, `src/protocol/storage-keys.ts`, `src/browser/storage/account-keys.ts`, `src/browser/airing-alarm.ts` (+ its test)

**Interfaces:**
- Produces: `Settings.sequelAlerts: boolean` (default `true`), `Settings.sequelNotifications: boolean` (default `true`), normalized like `airingAlerts`; `STORAGE_KEYS.sequelsState = 'sequels:state'`, `STORAGE_KEYS.sequelsLastResult = 'sequels:lastResult'`, both in a new `ACCOUNT_STORES` entry `{ name: 'sequels', scope: { kind: 'account' }, keys: [...] }`; `ensureAiringAlarm()` keeps the alarm when `(airingAlerts || sequelAlerts) && connectedServices().length > 0`.

- [ ] **Step 1: Write the failing tests:** normalization of the two fields (missing → `true`, non-boolean → `true`, `false` kept); `ensureAiringAlarm` creates the alarm with `airingAlerts: false, sequelAlerts: true` and one service, clears it with both off; `account-keys.test.ts` passes with the new keys (it requires every `STORAGE_KEYS` value to be declared).
- [ ] **Step 2: Run** `npx vitest run src/shared/settings.test.ts src/browser/airing-alarm.test.ts src/browser/storage/account-keys.test.ts`. Expected: FAIL on the new cases.
- [ ] **Step 3: Implement.** `handleAiringAlarm` (`background/airing.ts`) must re-run `ensureAiringAlarm` only when the alarm's reason disappears: keep its current rule for airing, Task 4 adds the sequel pass.
- [ ] **Step 4: Run** the same tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sequels): add the sequel settings and keep the hourly alarm for them`.

### Task 4: Daily pass in the service worker

**Files:**
- Create: `src/background/sequels/fetch.ts`, `src/background/sequels/check.ts`, `src/background/sequels/check.test.ts`, `src/background/sequels/fetch.test.ts`
- Modify: `src/background/airing.ts` (`handleAiringAlarm` calls the pass after the airing check; `notificationsBlocked` exported), `src/shared/airing.types.ts` only if a shared skip type is reused

**Interfaces:**
- Consumes: Task 1 (`sequelCandidates`, `mergeSequelPass`, `isSequelStore`, `EMPTY_SEQUEL_STORE`), Task 3 keys and settings, `fetchAniListFullList`, `fetchMalFullList`, `anilistPublicQuery(query, guard, vars, 'background')`, `getExcludedSeries`, `getOpenSessions`, `writeIfSessions`, `connectedServices`.
- Produces:
  ```ts
  // fetch.ts
  export async function readSourceSeries(services: readonly TrackerId[]): Promise<{ sources: SourceSeries[]; inLists: InLists }>;
  export async function fetchSequelRelations(ids: readonly number[]): Promise<Map<number, RelationEdge[]>>; // batches of 50, 'background'
  // check.ts
  export interface SequelCheckResult { checkedAt: number; found: number; notified: number; skipped: 'disabled' | 'not-connected' | 'not-due' | 'blocked' | null; error: string | null } // 'blocked': records written, nothing notified
  export const SEQUEL_CHECK_INTERVAL_MS = 24 * 3_600_000;
  export async function checkSequels(now?: number, force?: boolean): Promise<SequelCheckResult>;
  export const SEQUEL_NOTIFICATION_PREFIX = 'synckai-sequel:';
  ```
  `readSourceSeries`: AniList entries by `mediaId`; MAL entries mapped to AniList ids with the `idMal_in` query of `compare.ts` (move `CATALOG_BY_MAL_QUERY` / the mapping loop into `fetch.ts` and import it from `compare.ts` instead of duplicating); statuses COMPLETED, CURRENT, REPEATING; `inLists` = every entry of every status. `sequelsLastResult` stores the `SequelCheckResult`.

- [ ] **Step 1: Write the failing tests** (`check.test.ts`, with `installFakeChrome` and mocked `anilist/client`, `anilist/full-list`, `mal/full-list` like `background/airing.test.ts`):
  - first pass: records written as `new`, no `notifications.create`, `lastCheck` set.
  - second pass 25 h later with one new sequel → one notification `synckai-sequel:<id>`, buttons `[+ Plan to watch, Open entry]` on Chrome; 3 new → one notification `synckai-sequel:group:<now>` with `sequel.notification.group_other`.
  - pass less than 24 h after `lastCheck` → `skipped: 'not-due'`, no request; `force: true` runs it.
  - `sequelAlerts: false` → `skipped: 'disabled'`, no request; `sequelNotifications: false` → records `new`, no notification.
  - Review Focus 3: relations request rejects with RATE_LIMITED on the 2nd batch → store unchanged, `lastCheck` unchanged, no notification, `error` set.
  - Review Focus 4: `getOpenSessions` epochs bumped between the read and the write → nothing written, nothing notified.
  - Review Focus 5: `notificationsBlocked()` true → records `new`, no `create`, `skipped: 'blocked'`; the next pass does not notify them.
  - `fetch.test.ts`: 120 source ids → 3 relations requests of 50/50/20, all with lane `'background'`; a MAL-only entry is matched by `idMal` and its sequel found in the MAL list (by `idMal`) is not a candidate.
- [ ] **Step 2: Run** `npx vitest run src/background/sequels`. Expected: FAIL.
- [ ] **Step 3: Implement.** Relations query: `query SequelRelations($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids) { id relations { edges { relationType node { id idMal type format status title { userPreferred } coverImage { medium } siteUrl startDate { year month day } season seasonYear } } } } } }`. Store read, merge and write in one `withStorageLock` with `writeIfSessions(epochs, …)` (epochs read before the first request). Notifications after the write; a `create` failure is logged, the record stays `new`. `handleAiringAlarm`: `await checkSequels()` after `checkNewEpisodes`, errors caught; the alarm is cleared only when both checks report `disabled` / `not-connected`.
- [ ] **Step 4: Run** `npx vitest run src/background/sequels src/background/airing.test.ts src/background/compare src/architecture.test.ts`. Expected: PASS (listener counts unchanged).
- [ ] **Step 5: Commit** `feat(sequels): run a daily sequel check from the hourly alarm`.

### Task 5: Notification actions and the store message

**Files:**
- Modify: `src/background/airing.ts` (`handleNotificationClick` / `handleNotificationButton` dispatch on the prefix), `src/background/sequels/check.ts` (or a new `actions.ts`), `src/protocol/messages.ts`, `src/background/message-guards.ts` (`MESSAGE_ORIGINS`: `'extension'`), the message router in `src/background/background.ts`
- Test: `src/background/sequels/actions.test.ts`

**Interfaces:**
- Consumes: Task 1 `setSequelStates`, `controls.ts` › `addToList({ mediaId, malId, status: 'PLANNING' })` (returns `SyncOutcome`), `openPopupOn('activity')`.
- Produces: message `UPDATE_SEQUELS: { payload: { ids: number[]; state: 'seen' | 'dismissed' | 'removed' | 'restore' }; response: boolean }` (`restore` = dismissed → seen; written under the lock with the current epochs, `false` when no session is open); `CHECK_SEQUELS: { payload: null; response: SequelCheckResult }` (« Vérifier maintenant », `force: true`).

- [ ] **Step 1: Write the failing tests:** body click on `synckai-sequel:<id>` opens `snapshot.siteUrl` and clears the notification; button 0 calls `addToList` with `{ mediaId: id, malId: snapshot.idMal, status: 'PLANNING' }`, then on an outcome with at least one success sets the record `removed` and updates the notification message to `sequel.added`; button 1 opens the entry; group click calls `openPopupOn('activity')` and falls back to the first visible record's `siteUrl` when it returns `false`; an airing id still goes to the airing handler; `UPDATE_SEQUELS` with `restore` turns `dismissed` into `seen`.
- [ ] **Step 2: Run** `npx vitest run src/background/sequels src/background/message-guards.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** (no new listener: the existing `onClicked` / `onButtonClicked` handlers branch on the id prefix).
- [ ] **Step 4: Run** the same tests and `src/architecture.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sequels): add to Planning from the notification and update the sequel store`.

### Task 6: Shared row, popup *Activité* section and rail dot

**Files:**
- Create: `src/shared/sequel-date.ts` (+ test), `src/ui/components/sequel-row.tsx`, `src/ui/sequels-store.ts` (storage read + `storage.onChanged` on `sequels:state` for the page), `src/popup/components/sequels-section.tsx` (+ test)
- Modify: `src/popup/components/activity-screen.tsx` (section between `ReviewList` and `RecentSection`), `src/popup/popup.ts` (store wiring, mark `seen` on opening *Activité*), `src/ui/components/nav-rail.tsx` (`dot?: boolean` on `NavRailItem`, rendered when `badge` is absent; accessible name from `ariaLabel`)

**Interfaces:**
- Consumes: Task 1 types and `visibleSequels`, Task 2 keys, Task 5 `UPDATE_SEQUELS`, `ADD_TO_LIST` through `ui/media-action-requests.ts`.
- Produces: `formatSequelDate(snapshot: SequelSnapshot, locale: string): string` (day → `Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })`; month → `{ month: 'long', year: 'numeric' }`; season → `panel.nowPlaying.season.<SEASON>` with `{year}`; year → `Intl.NumberFormat`-free plain year; nothing → `sequel.dateUnknown`; RELEASING → `sequel.airing`); `SequelRow` props `{ record: SequelRecord; onAdd(): void; onDismiss(): void; busy: boolean; outcome: SyncOutcome | null }` (cover 32×44 through `toImageSrc`, title, « ● {date} · {format} » with a grey dot when the date is unknown, `Button size="sm"` secondary « + Plan to watch », × icon button, `aria-label` from `sequel.addLabel` / `sequel.dismissLabel`); `createSequelsStore(): ReadonlyStore<SequelRecord[]>` + `dispose()`.

- [ ] **Step 1: Write the failing tests:** `formatSequelDate` in fr, en and ja for each case (day 2027-01-10 → « 10 janv. 2027 » in fr; month 2027-10 → « octobre 2027 »; season WINTER 2027 → « Hiver 2027 »; year only → « 2027 »; nothing → « Date à venir »; RELEASING → « Déjà en diffusion »); `SequelsSection` renders nothing with no visible record, 3 rows plus « 2 more announced sequels » collapse with 5, × sends `UPDATE_SEQUELS dismissed` and moves focus to the neighbouring row, « + Plan to watch » sends `ADD_TO_LIST` then `UPDATE_SEQUELS removed` on success and shows `sequel.notOnMal` when the MAL outcome failed and AniList succeeded.
- [ ] **Step 2: Run** `npx vitest run src/shared/sequel-date.test.ts src/popup/components/sequels-section.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** The rail item `activity` gets `dot: true` and `ariaLabel: t('nav.activityNewSequels')` while a record is `new` and no badge is shown; opening *Activité* sends `UPDATE_SEQUELS seen` for the `new` ids.
- [ ] **Step 4: Run** the tests plus `npx vitest run src/popup src/ui/components src/ui/design-tokens.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sequels): show announced sequels in the popup Activity tab`.

### Task 7: Side panel badge on related entries

**Files:**
- Modify: `src/background/anilist/panel-media.ts` (relation node gains `status startDate { year month day } season seasonYear`), `src/shared/panel-media.types.ts` (`PanelRelation.status`, `startYear`, `startMonth`, `startDay`, `season`, `seasonYear`, all nullable), `src/browser/storage/session-cache.ts` (`PANEL_MEDIA_CACHE_VERSION` + 1), `src/sidepanel/components/details-card.tsx` (`Relation`)
- Test: `src/background/anilist/panel-media.test.ts`, `src/sidepanel/components/details-card.test.tsx`

**Interfaces:**
- Consumes: Task 6 `formatSequelDate` (called with a snapshot built from the relation), `ADD_TO_LIST`.

- [ ] **Step 1: Write the failing tests:** `parsePanelMedia` keeps the new fields (null when absent); a SEQUEL relation NOT_YET_RELEASED renders « Announced · {date} » and a « + Plan to watch » button when it is in no list; RELEASING and in no list → « Already airing » + the button; in a list → no badge, no button; an old cache entry (previous version) is not read.
- [ ] **Step 2: Run** the two test files. Expected: FAIL.
- [ ] **Step 3: Implement.** « In a list » = the relation's id among the panel's known list entries (the same source the panel already uses for the current entry's list status); the button sends `ADD_TO_LIST` and, on success, `UPDATE_SEQUELS removed` for that id.
- [ ] **Step 4: Run** the tests plus `npx vitest run src/sidepanel`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sequels): mark announced sequels in the side panel's related entries`.

### Task 8: Agenda « Annonces » view

**Files:**
- Modify: `src/sidepanel/components/agenda.tsx` (switch in the sticky header next to `WeekPicker`, `Segmented` of `src/ui/components/segmented.tsx`), `src/shared/sequels.ts` (+ grouping), `src/sidepanel/sidepanel.ts` (store wiring)
- Test: `src/shared/sequels.test.ts`, `src/sidepanel/components/agenda.test.tsx`

**Interfaces:**
- Consumes: Task 6 `createSequelsStore`, `SequelRow`, `formatSequelDate`.
- Produces: `groupSequelsByPeriod(records: readonly SequelRecord[]): { key: string; season: AniListSeason | null; year: number | null; records: SequelRecord[] }[]` — exact or month date → its anime season (Jan–Mar WINTER, Apr–Jun SPRING, Jul–Sep SUMMER, Oct–Dec FALL); season only → that season; year only → year group; nothing → last group (`season` and `year` null). Groups in chronological order; inside a group by date then title.

- [ ] **Step 1: Write the failing tests:** grouping (2027-01-10 and WINTER 2027 in one group; 2027 alone after FALL 2027? → year-only groups sort after the seasons of that year; unknown last); the switch shows « Week » by default, « Announced » lists the groups with `panel.nowPlaying.season.*` headings, « New » badge on `new` rows, empty state `agenda.announced.empty`; switching back keeps the week.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement** (the choice lives in component state, never stored).
- [ ] **Step 4: Run** the tests plus `npx vitest run src/sidepanel`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sequels): add the Announced view to the panel Agenda`.

### Task 9: Settings › Notifications section

**Files:**
- Modify: `src/ui/settings/page-notifications.tsx` (+ test), `src/ui/settings/settings-view.tsx` (read `sequels:lastResult` and the store like `airingLastResult`)

**Interfaces:**
- Consumes: Task 3 settings, Task 4 `SequelCheckResult`, Task 5 `CHECK_SEQUELS` / `UPDATE_SEQUELS restore`.

- [ ] **Step 1: Write the failing tests:** section « Announced sequels » after « New episodes »; toggle `sequelAlerts`; toggle `sequelNotifications` disabled when the first is off; status line « Last checked: 3 h ago · 2 sequels found » (`airing.status.last` + `settings.sequels.found_*`), skip reasons through `airing.skip.*` (`blocked` in red, like the airing line); « Show 2 hidden sequels again » visible only with dismissed records, sends `UPDATE_SEQUELS restore`.
- [ ] **Step 2: Run** `npx vitest run src/ui/settings/page-notifications.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the test plus `npx vitest run src/ui/settings`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sequels): add the sequel alert settings`.

### Task 10: Demo data, e2e and layout checks

**Files:**
- Modify: `scripts/screenshots/mock-chrome.ts` / `scripts/screenshots/demo-panel.ts` (a `sequels:state` with 4 visible records: day date, month date, unknown date, RELEASING), `scripts/e2e/*` (one popup scenario: Activité section, dismiss; one panel scenario: Agenda switch)

- [ ] **Step 1:** seed the demo store and add the two e2e scenarios (dismiss sends `UPDATE_SEQUELS`, recorded in `window.__e2e`).
- [ ] **Step 2: Run** `CI=1 npm run test:e2e` through `synckai-verify`. Expected: PASS.
- [ ] **Step 3: Run** `CI=1 SYNCKAI_I18N_LAYOUT_DIR=<scratchpad>/layout npm run test:i18n-layout`. Expected: 0 findings (a finding is fixed in the component first, then by shortening that translation, logged in its review log).
- [ ] **Step 4: Run** `npm run verify`. Expected: exit 0.
- [ ] **Step 5: Commit** `test(sequels): cover the sequel views in e2e and layout checks`.
