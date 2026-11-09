# Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** suggestions of series the user has not seen, from AniList community recommendations of their best-rated completed series, in a panel « Découvrir » tab, an Agenda empty-week link, the popup's empty « Mes séries » state and an « Dans le même esprit » section of En lecture; the 19 AniList genres translated everywhere.

**Architecture:** pure rules in `src/shared/recommendations.ts` (seeds, exclusions, unseen-prequel rule, score and reason, batch, weighted draw) and `src/shared/genres.ts`; the service worker builds an account-bound batch of 60 once a day (one full-list read per service + one or two batched recommendation reads, background lane) and answers the pages; draws are local; dismissed ids are a user-scoped list in the Backup.

**Tech Stack:** TypeScript, Preact, Tailwind 4 tokens, Vitest, Puppeteer e2e.

**Spec:** `docs/superpowers/specs/2026-11-09-recommendations-design.md`

## Global Constraints

- AniList is the only catalogue source; MAL is read only for the user's own full list (`fetchMalFullList`); MAL scores / mapped ids seed AniList queries (owner-accepted grey zone), no MAL catalogue content.
- Every request of the batch on the `'background'` lane; card fields exactly: `id idMal isAdult format status episodes duration averageScore genres tags { name rank isMediaSpoiler } title { userPreferred } coverImage { large medium color } bannerImage siteUrl startDate { year } season seasonYear externalLinks { url } relations { edges { relationType node { id } } }`.
- Seeds: COMPLETED / REPEATING scored ≥ 7/10 (via `shared/score.ts`), best first, ≤ 50, both accounts merged (higher score); fewer than 3 → unscored completed added with weight 6 until 3; cold start only with fewer than 3 completed series.
- Exclusions: every entry of every list (any status, AniList id and `idMal`), dismissed ids, `isAdult`, and a candidate with a PREQUEL whose prequel is not COMPLETED / CURRENT / REPEATING in the user's lists.
- Batch: top 60, `reco:batch` (`chrome.storage.local`, scope `account`), 24 h; local removal after an add or a dismiss; full recompute only when older than 24 h or on « Réessayer ».
- Dismissed: `reco:dismissed` (`chrome.storage.local`, scope `user`), ≤ 500, in the Backup (restore replaces).
- Cold start: 10 best-scored entries of the current season minus the lists.
- No new `addListener` in `background/`; Preact rules; charter `docs/design/README.md`; panel 320–360 px; popup 440 px content.
- Every UI string: en + context note + 20 translations (`docs/memory/i18n.md`); genres via `genre.<Name>` keys; tags stay English.
- Fixtures captured anonymously from the real API.
- Comments in French; no formatter; commits in English, author QuentinGeerts, no Claude mention, no `Co-Authored-By`. Checks through `synckai-verify`, `CI=1` for e2e and layout.

## Review Focus

1. A seed recommended by two seeds: one candidate, scores summed, reason = the larger contribution. Test in Task 1.
2. The user adds a suggestion from the panel then reopens the popup: it is never proposed again (local removal + list exclusion at next recompute). Test in Task 4.
3. A MAL-only user whose candidate has no `idMal`: no add button, « pas encore sur MyAnimeList ». Test in Task 6.
4. Sign-out then sign-in to another account: the old batch is never shown (account scope + epochs). Test in Task 4.
5. Draw exhausted (every candidate drawn / dismissed / added): « Plus rien à te proposer » with « Revoir les écartées ». Test in Task 6.

---

### Task 1: Pure rules (`src/shared/recommendations.ts`, `src/shared/genres.ts`) and fixture

**Files:** create `src/shared/recommendations.ts` (+ test), `src/shared/genres.ts` (+ test), `src/shared/__fixtures__/recommendations/seeds.json`

**Interfaces — produces:**
```ts
export const ANILIST_GENRES = ['Action','Adventure','Comedy','Drama','Ecchi','Fantasy','Hentai','Horror','Mahou Shoujo','Mecha','Music','Mystery','Psychological','Romance','Sci-Fi','Slice of Life','Sports','Supernatural','Thriller'] as const;
export function genreKey(name: string): MessageKey | null; // genre.<camelCase>, null when unknown
export interface RecoCard { id: number; idMal: number | null; title: string; format: string | null; year: number | null; episodes: number | null; averageScore: number | null; genres: string[]; tags: string[]; coverUrl: string | null; coverLarge: string | null; color: string | null; bannerUrl: string | null; siteUrl: string; platforms: PlatformLink[] }
export interface RecoReason { seedId: number; seedTitle: string; seedScore: number; matched: string[] }
export interface RecoItem { card: RecoCard; score: number; reason: RecoReason | null }
export interface RecoBatch { items: RecoItem[]; computedAt: number; seedCount: number; cold: boolean }
export interface Seed { id: number; title: string; score10: number; genres: string[]; tags: string[] }
export function pickSeeds(entries: readonly { id: number; title: string; status: string; score10: number | null }[]): { seeds: Omit<Seed, 'genres' | 'tags'>[]; cold: boolean };
export function buildBatch(seeds: readonly Seed[], recs: ReadonlyMap<number, { rating: number; media: RawRecoMedia }[]>, exclude: { ids: ReadonlySet<number>; malIds: ReadonlySet<number>; dismissed: ReadonlySet<number>; watchedOrCurrent: ReadonlySet<number> }, now: number): RecoBatch;
export function drawNext(batch: RecoBatch, skip: ReadonlySet<number>, random: () => number): RecoItem | null;
export function withoutItem(batch: RecoBatch, id: number): RecoBatch;
export const BATCH_SIZE = 60; export const MAX_SEEDS = 50; export const MAX_DISMISSED = 500;
```
`RawRecoMedia` = the card fields of the Global Constraints as returned by AniList; `platforms` left `[]` (the worker fills them with `buildPlatforms`, which `shared/` cannot import).

- [ ] **Step 1: Capture** with an anonymous curl (header `X-Client: SyncKai (+https://synckai.app)`) the Task 4 query for 4 seeds (Frieren 154587, Mushoku Tensei 108465, Vinland Saga 101348, Spy x Family 140960) into `seeds.json` (`{ media: [...] }`).
- [ ] **Step 2: Failing tests:** `pickSeeds` (≥ 7 only, best first, ≤ 50, merged accounts keep the higher score, < 3 scored → unscored completed with weight 6 to reach 3, < 3 completed → `cold`); `buildBatch` on the fixture: no excluded id / idMal / dismissed / adult entry, a candidate whose PREQUEL is not watched or current is dropped, a candidate recommended by two seeds appears once with summed score and the larger-contribution reason (Review Focus 1), ≤ 60 items sorted by score, `matched` ≤ 4 entries (genres first); `drawNext` never returns an item in `skip`, returns null when exhausted, weighted by score (fixed `random`); `withoutItem` removes one id; `genreKey('Slice of Life') === 'genre.sliceOfLife'`, unknown → null.
- [ ] **Step 3: Run** `npx vitest run src/shared/recommendations.test.ts src/shared/genres.test.ts` → FAIL. **Step 4: Implement** (pure). **Step 5: Run** them + `src/architecture.test.ts` → PASS. **Step 6: Commit** `feat(reco): add the recommendation rules with real AniList fixtures`.

### Task 2: Texts in 21 languages

**Files:** `src/i18n/locales/*.json` (21), `docs/i18n/context.json`, `docs/i18n/review/<code>.md`

**Interfaces — produces** (en [fr]): `genre.action` … `genre.thriller` (19 keys; AniList names in en, each catalog's usual word for the genre) · `panel.tab.discover` Discover [Découvrir] · `reco.title` For you [Pour toi] · `reco.because` Because you rated {title} ★ {score}/10 [Parce que tu as noté {title} ★ {score}/10] · `reco.where` Where to watch [Où regarder] · `reco.another` Another [Autre] · `reco.anotherAria` Draw another suggestion · `reco.rolling` Drawing… · `reco.inPlanning` In Plan to watch [use the PLANNING term] · `reco.dismiss` Not interested [Pas intéressé] · `reco.dismissAria` Don't suggest {title} again · `reco.dismissed` Won't suggest again: {title} · `reco.undo` Undo [Annuler] · `reco.previous` Earlier draws [Déjà tirées] · `reco.loading` Looking through your taste… · `reco.cold.title` Score a few series first · `reco.cold.text` Suggestions start from your completed series scored 7/10 or more. · `reco.cold.meanwhile` Meanwhile: the season's top rated · `reco.malOnly` AniList catalogue, read without an account: your MyAnimeList scores guide the draw. · `reco.error` Suggestions unavailable · {error} · `reco.empty.title` Nothing left to suggest · `reco.empty.action` Review skipped · `reco.announce` New suggestion: {title}, because you rated {seed} · `reco.notOnMal` not on MyAnimeList yet · `reco.idea` 🎲 An idea? [🎲 Une idée ?] · `reco.morePanel` More ideas in the panel [Plus d'idées dans le panneau] · `panel.similar.title` In the same spirit [Dans le même esprit] · `panel.similar.fans_*` {count} fans of {title} · `settings.reco.restore_*` Show {count} skipped suggestions again. Reused: `common.retry`, `page.addPlanning`, `sequel.add`, `panel.nowPlaying.genres`.

- [ ] **Step 1:** en + context notes; **Step 2:** 20 translations (term sheets; genres: the catalog's usual word, AniList's own localized names when they exist); **Step 3:** `npm run i18n:check` → 0 errors; **Step 4:** `npx vitest run src/i18n scripts/i18n-context.test.ts` → PASS; **Step 5: Commit** `feat(i18n): add the recommendation texts and the AniList genres in 21 languages`.

### Task 3: Storage keys, Backup and genre labels in the panel

**Files:** `src/protocol/storage-keys.ts` (`recoBatch: 'reco:batch'`, `recoDismissed: 'reco:dismissed'`), `src/browser/storage/account-keys.ts` (scopes `account` / `user`), `src/shared/backup.ts` + `src/browser/storage/backup-store.ts` (new optional section `recoDismissed`, restore replaces; keep `BACKUP_VERSION` 1 if the section is optional and validated, else bump with a migration), `src/sidepanel/components/now-playing-hero.tsx` (genre chips through `genreKey` → `t()`, unknown → AniList name)

- [ ] **Step 1: Failing tests:** `account-keys.test.ts` classifies the two keys; backup round trip keeps `recoDismissed` (≤ 500 positive ints, invalid entries dropped) and a backup without the section still restores; the hero shows « Tranche de vie » for `Slice of Life` in fr and an unknown genre as is.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/shared src/browser src/sidepanel` → PASS. **Step 5: Commit** `feat(reco): store the suggestions and skipped ids, translate the genre chips`.

### Task 4: Batch in the service worker

**Files:** create `src/background/recommendations/{batch,messages}.ts` (+ tests); modify `src/protocol/messages.ts`, `src/background/message-guards.ts`, `src/background/background.ts`

**Interfaces — produces:** `GET_RECOMMENDATIONS { force?: boolean } → RecoResult` (`{ ok: true; batch: RecoBatch; malOnly: boolean } | { ok: false; message: string }`), `UPDATE_RECOMMENDATION { id: number; action: 'added' | 'dismissed' | 'undo' } → boolean` (`added` / `dismissed` remove the id from the stored batch locally; `dismissed` also adds it to `reco:dismissed`; `undo` takes it back out of `reco:dismissed` and re-inserts the item if still in memory of the page — the page re-sends nothing else), `RESTORE_RECOMMENDATIONS → boolean`; origins `extension`.

- [ ] **Step 1: Failing tests** (mock the AniList client with the Task 1 fixture, the full lists and `aniListIdsByMal`): a batch is built from both lists in ≤ 1 list read per service + ⌈seeds / 25⌉ recommendation reads (+ the MAL id mapping), all lane `'background'`; served from `reco:batch` when younger than 24 h (0 requests), recomputed when older or `force`; written with `writeIfSessions` (epochs read before the requests) so a sign-out during the build writes nothing; Review Focus 4: after another account signs in, the stored batch (account scope) is gone and a new one is built; Review Focus 2: `UPDATE_RECOMMENDATION added` removes the id and a later `GET_RECOMMENDATIONS` (cached) never returns it; dismissed list capped at 500 (oldest dropped); cold start query when `pickSeeds` says `cold`; `isAdult` never in the batch; platforms filled by `buildPlatforms`.
- [ ] **Step 2: Run** `npx vitest run src/background/recommendations` → FAIL. **Step 3: Implement** — query `query RecoSeeds($ids: [Int]) { Page(perPage: 25) { media(id_in: $ids) { id genres tags { name rank isMediaSpoiler } recommendations(sort: RATING_DESC, perPage: 10) { nodes { rating mediaRecommendation { <card fields> } } } } } }` (check the complexity once on the real API with 25 ids and the `relations` field; drop to `perPage: 8` recommendations if refused and note it); cold start `query RecoSeason($season: MediaSeason, $year: Int) { Page(perPage: 20) { media(type: ANIME, season: $season, seasonYear: $year, sort: SCORE_DESC, isAdult: false) { <card fields> } } }`.
- [ ] **Step 4: Run** the tests + `src/architecture.test.ts src/background/message-guards.test.ts` → PASS. **Step 5: Commit** `feat(reco): build and cache the suggestions in the service worker`.

### Task 5: Shared suggestion card and controller

**Files:** create `src/ui/components/reco-card.tsx` (+ test), `src/ui/reco-controller.ts` (+ test), `src/ui/icons.ts` (`dice` icon, 2 px stroke, Lucide style)

**Interfaces — produces:** `createRecoController(): { store: ReadonlyStore<RecoView>; another(): void; add(): Promise<void>; dismiss(): Promise<void>; undo(): Promise<void>; retry(): void; restore(): Promise<void>; dispose(): void }` with `RecoView = { status: 'loading' | 'error' | 'empty' | 'none'; message?: string } | { status: 'ready'; current: RecoItem; previous: RecoItem[]; cold: boolean; malOnly: boolean; added: boolean; dismissedTitle: string | null }` (`none` = no account); `RecoCard` component `{ item, compact?: boolean, view, onAnother, onAdd, onDismiss, onUndo, granted }`.

- [ ] **Step 1: Failing tests:** controller loads once, draws locally (`drawNext` with the page's skip set), « Autre » never repeats within the page, « Déjà tirées » keeps the last 8, add → `ADD_TO_LIST` PLANNING then `UPDATE_RECOMMENDATION added`, the button becomes « In Plan to watch »; dismiss → `UPDATE_RECOMMENDATION dismissed`, a 5 s « Undo » then the next draw; undo → `undo`; exhausted → `empty` (Review Focus 5); card: why box (translated genres, ≤ 4 chips), platform chips greyed with « Enable » for an optional platform without access, MAL-only without `idMal` → no add button + `reco.notOnMal` (Review Focus 3), polite live region text `reco.announce`, focus stays on « Another ».
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (dice turn 360 ms then a cross-fade; reduced motion: fade only). **Step 4: Run** `npx vitest run src/ui` → PASS. **Step 5: Commit** `feat(reco): add the suggestion card and its controller`.

### Task 6: Panel « Découvrir » tab

**Files:** `src/sidepanel/tabs.ts` (`PANEL_TABS` gains `'discover'`, never chosen by `followPageContext`), `src/shared/settings.ts` (`PanelDefaultTab` accepts `'discover'`? — no: keep the default-tab setting to its current values), `src/sidepanel/panel-app.tsx`, `src/sidepanel/sidepanel.ts` (controller created lazily on first show, like the Agenda), `src/ui/components/tabs.tsx` (an unselected tab whose label does not fit shows its icon only, accessible name and tooltip kept), `src/browser/panel-tab.ts` (`openPanelOn('discover')` / `takePanelTab()` on a session key with a 10 s TTL, same pattern as `browser/popup-screen.ts`)

- [ ] **Step 1: Failing tests:** three tabs, « Discover » lazy-loads the controller on first selection, `followPageContext` never selects it, a stored last tab `discover` is restored, `takePanelTab()` opens it once within the TTL, icon-only fallback keeps the accessible name; states rendered (loading, cold with « Meanwhile », MAL-only note, error + Retry, empty + « Review skipped », no account).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/sidepanel src/ui src/browser` → PASS. **Step 5: Commit** `feat(reco): add the Discover tab to the side panel`.

### Task 7: Agenda link and popup empty-state suggestion

**Files:** `src/sidepanel/components/agenda.tsx` (empty-week `StateCard` gains « 🎲 An idea? › » switching to Discover), `src/popup/components/watching-screen.tsx` (`EmptyWatching` shows a compact `RecoCard` + « More ideas in the panel › », which calls `openPanelOn('discover')` and the popup's `openPanel()` in the same click, no `await` before), `src/popup/popup.ts` / `popup-app.tsx` wiring

- [ ] **Step 1: Failing tests:** Agenda empty week shows the link and selecting it switches the panel tab; popup empty list reads `reco:batch` and shows one suggestion, sends `GET_RECOMMENDATIONS` once when no batch is stored, nothing when the list is not empty; the link sets the panel hint and opens the panel synchronously in the click.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/sidepanel src/popup src/ui` → PASS. **Step 5: Commit** `feat(reco): suggest from the empty Agenda week and the empty watching list`.

### Task 8: « Dans le même esprit » in En lecture

**Files:** `src/background/anilist/panel-media.ts` (`recommendations(sort: RATING_DESC, perPage: 8) { nodes { rating mediaRecommendation { id idMal isAdult title { userPreferred } coverImage { medium } siteUrl format startDate { year } externalLinks { url } relations { edges { relationType node { id } } } } } }`, `PANEL_MEDIA_CACHE_VERSION` + 1), `src/shared/panel-media.types.ts`, `src/sidepanel/components/similar.tsx` (+ test), `src/sidepanel/components/details-card.tsx` (section after the watch order, in `PANEL_SECTIONS`), the now-playing controller (list states for the recommended ids through `GET_LIST_STATES`, dismissed ids from storage)

- [ ] **Step 1: Failing tests:** `parsePanelMedia` keeps up to 8 recommendations, drops `isAdult`; the section shows at most 5 rows: not in the user's lists (states), not dismissed, unseen-prequel rule applied; each row: cover, title, `panel.similar.fans_*` with the rating and the current title, entry link, « Regarder » when a platform link exists, « + Plan to watch »; hidden when empty; an old cache entry is not read.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/sidepanel src/background/anilist src/shared` → PASS. **Step 5: Commit** `feat(reco): show similar series in the side panel`.

### Task 9: Settings restore button

**Files:** `src/ui/settings/page-data.tsx` (+ test), `src/ui/settings/settings-view.tsx` / `context.ts` (dismissed count from `reco:dismissed`, followed like `sequelsDismissed`)

- [ ] **Step 1: Failing test:** « Show 3 skipped suggestions again » only when the list is not empty, sends `RESTORE_RECOMMENDATIONS`. **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/ui/settings` → PASS. **Step 5: Commit** `feat(reco): restore skipped suggestions from Settings`.

### Task 10: Demo, e2e, extension and layout checks

**Files:** `scripts/screenshots/{mock-chrome,demo-panel}.ts` (a stored `reco:batch` of ~8 items with real-looking AniList recommendation titles of the demo series, one cold variant), `scripts/e2e/*` (panel Discover tab: draw « Another », dismiss + undo; popup empty list suggestion), `scripts/ext-e2e/fake-anilist.ts` (answers `RecoSeeds` / `RecoSeason`)

- [ ] **Step 1:** seed and add the scenarios. **Step 2:** `CI=1 npm run test:e2e` → PASS. **Step 3:** `CI=1 SYNCKAI_I18N_LAYOUT_DIR=<scratchpad>/reco-layout npm run test:i18n-layout` → 0 findings (three tabs at 320 px in de / ru / ja). **Step 4:** `npm run test:ext` → PASS. **Step 5:** `npm run verify` → exit 0. **Step 6: Commit** `test(reco): cover the suggestions in e2e, extension and layout checks`.
