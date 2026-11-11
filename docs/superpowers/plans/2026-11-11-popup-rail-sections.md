# Popup rail sections (« Pour toi », Agenda, Stats) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the popup rail gets five sections (Mes séries, Activité, Pour toi, Agenda, Stats) with the side panel and Settings closer together at the bottom; « Pour toi » and the Agenda reuse the panel's controllers and views, and Stats shows the profile statistics of the existing viewer request plus a new local history of what SyncKai synced.

**Architecture:** the panel's `Discover` view and the whole Agenda (controller, load rule, view) move into `ui/` so that both screens mount them; the popup creates each section's controller on its first display, like `sidepanel.ts`. Stats reads two sources without any new request: the `Viewer` / `anime_statistics` responses already fetched for the account menu (enriched, reduced by pure functions in `shared/profile-stats.ts`), and a user-scoped per-day history (`shared/activity-history.ts`) written by the service worker where `weeklySyncs` is written.

**Tech Stack:** TypeScript, Preact (no `preact/compat`), Tailwind 4 tokens of `src/ui/theme.css`, Vitest (happy-dom for components), Puppeteer e2e (`scripts/e2e/`).

**Spec:** `docs/superpowers/specs/2026-11-11-popup-rail-sections-design.md` (binding, including « Calls after the builder check »).

## Global Constraints

- Popup 496 × 600: rail 56 px plus a 440 px content column, fixed-body layout of POP-01 kept; no clipping at 440 px or under zoom (e2e viewport 496 × 545 = 600 px at 110 %).
- Rail order and ids: `watching`, `activity`, `foryou` (`sparkles`), `agenda` (`calendar`), `stats` (new bar-chart icon); tooltip and accessible name = the section title. Bottom: side panel, then Settings, at half of today's gap (`gap-1` → `gap-0.5`), targets still 44 × 44. No badge on « Pour toi ».
- The side panel keeps its three tabs and its behaviour; no new panel section.
- Screens never import each other: a component or controller used by the popup and the panel lives in `ui/`. Pure moves are `git mv` + specifier rewrite only, in their own `refactor:` commit, whose hash then goes into `.git-blame-ignore-revs`.
- No server, no new host, no new permission, no new `addListener` in `src/background/`, no `storage.onChanged` there.
- AniList terms: no bulk read; the Stats profile data comes from the same `Viewer` request and cache as the account menu (re-read on opening only when older than `ACCOUNT_STATS_TTL_MS`, 1 h). « Pour toi » and the Agenda send nothing before their section is first shown.
- MAL rule: only the `anime_statistics` that `getMalViewer` already requests (`/users/@me?fields=picture,anime_statistics`); no other MAL call; MAL data never merged into AniList data. MAL has no genres, formats, scores, studios or decades: those blocks are hidden.
- Activity history (call 1): per local day, per service, with the account id; 400 days at most; scope `user`; kept when a session expires (token refused or unreadable), dropped for one service when a different account's profile is saved on it, dropped entirely at the last voluntary sign-out; in the Backup; written where `recordWeeklySyncs` is called, with the same exclusions (corrections are not counted).
- Stats service control (call 2): shown only when both accounts are connected; default `watching.activeService()`; the choice remembered in the popup preferences; it changes neither « Fiche ouverte par défaut » nor « Mes séries ».
- The Agenda's « Annoncées » view in the popup never marks sequels as seen (call 3); Activité's « Suites annoncées » and the rail dot stay as they are.
- Charts: plain HTML and CSS bars (heights and widths through the `style` object), no chart library; palette from the `dataviz` skill mapped to charter tokens (`TONE_BG`, `lavender`, `raised`); no raw hex, no arbitrary colour class (`src/ui/design-tokens.test.ts`).
- UI strings: en text + context note (`docs/i18n/context.json`) + 20 translations following each term sheet (`docs/i18n/glossary/<code>.md`) + a line in each review log (`docs/i18n/review/<code>.md`), in the task that introduces them; reuse first (`reco.title`, `panel.tab.agenda`, `panel.tab.discover`, `agenda.*`, `page.status.*`, `genre.*`, `panel.nowPlaying.genres`, `compare.filter.all`, `compare.filter.empty`, `accountMenu.stats.*`, `accountMenu.week.value`, `watching.remaining.total`, `common.*`).
- Tests first where `CLAUDE.md` asks (rules, reducers, controllers, storage); UI layout checked afterwards by e2e and `test:i18n-layout`. Fixtures captured from the real API without tokens, headers, names or account / profile ids.
- Checks through the `synckai-verify` skill: `npm run verify` on every task; `CI=1 npm run test:e2e` when a screen changes; `npm run i18n:check` and `CI=1 npm run test:i18n-layout` when strings change. Logs and screenshots go to the session scratchpad, never into the repository.
- Git: the controller creates each task branch; Conventional Commits in English, author `QuentinGeerts <geerts.quentin@gmail.com>`, no mention of Claude (no `Co-Authored-By`, no `Claude-Session`); no push, merge, stash or tag; no formatter; code comments in French; `CHANGELOG.md` only in Task 7.

## Review Focus

1. **A remembered genre filter that the new day's batch no longer contains:** the filter falls back to « Tous » and a card shows, never a permanent « Aucune série pour ce filtre ». Test in Task 2 (controller).
2. **A history part that belongs to another account** (a Backup from another account, or a reconnect to a different account before the next profile read): Stats shows no activity for that service, never the other account's numbers. Tests in Task 5 (summary) and Task 6 (screen).
3. **Local day boundaries:** a sync at 23:59 and one at 00:01 land on two days; the 7-day and 30-day windows are built by calendar steps, so a week across a DST change still has 7 bars. Test in Task 5.
4. **Zoom (POP-01):** at 496 × 545, the Agenda's sticky navigation spans the column and the last day is reachable; the long Stats screen scrolls to its last block; the status bar stays fully visible; no horizontal scrollbar. Tests in Tasks 3 and 6.
5. **A viewer cached before this version** (no `profile` field): the cache stays valid, Stats shows the totals it has, refreshes once and fills the blocks when the new profile arrives. Tests in Task 4 (guards) and Task 6 (controller).

---

## Task 1: Five rail sections, tighter footer, popup routing with placeholder screens

**Branch:** `feature/rail-five-sections`

**Files:**
- Modify: `src/popup/state.ts` (`Screen`), `src/popup/components/header.tsx` (comment), `src/popup/popup-app.tsx` (rail items, titles, screens), `src/popup/popup.ts` (`followShownScreen` hook), `src/ui/components/nav-rail.tsx` (footer gap), `src/ui/icons.ts` (`chart` icon), `docs/design/README.md` › Popup shell
- Strings: `nav.stats` (« Stats »)
- Test: `src/ui/components/nav-rail.test.tsx`, `scripts/e2e/popup.e2e.ts`

**Interfaces — produces:**
```ts
// src/popup/state.ts
export type Screen = 'watching' | 'activity' | 'foryou' | 'agenda' | 'stats' | 'settings';
// src/popup/components/header.tsx (unchanged definition)
export type PopupTab = Exclude<Screen, 'settings'>;
// src/popup/popup-app.tsx
const SCREEN_TITLES: Readonly<Record<PopupTab, MessageKey>> = { watching: 'nav.watching', activity: 'nav.activity', foryou: 'reco.title', agenda: 'panel.tab.agenda', stats: 'nav.stats' };
// src/popup/popup.ts : appelé à chaque changement d'écran affiché ; les tâches 2, 3 et 6 y créent leurs contrôleurs
function followShownScreen(): void;
```
- The shown section is `ui.screen === 'settings' ? ui.previous : ui.screen`; `useFocusFallback` uses `rail-${tab}`.
- New screen containers come **after** the four existing ones in `<main>` (`data-screen="foryou" | "agenda" | "stats"`), so the e2e helper `shownScreen` keeps indices 0–3 and the new screens are 4, 5, 6. In this task they hold nothing (placeholders filled by Tasks 2, 3, 6).

- [ ] **Step 1: Failing tests**
  - `nav-rail.test.tsx` › `'footer list is tighter than the section list (gap-0.5 vs gap-1), buttons keep size-rail-item'`.
  - `popup.e2e.ts`:
    - `'rail : cinq sections dans l’ordre puis panneau et Réglages, noms = titres'`: `[data-rail-section]` aria-labels equal `[fr('nav.watching'), fr('nav.activity'), fr('reco.title'), fr('panel.tab.agenda'), fr('nav.stats')]`, no badge on `rail-foryou`;
    - `'chaque section affiche son écran et son titre ; Réglages puis retour rend la section quittée'`: `rail-foryou` → `shownScreen` 4 and `h1` = `fr('reco.title')`, `rail-agenda` → 5, `rail-stats` → 6, `gear` twice → back on 6;
    - `'pied du rail resserré : 2 px entre panneau et Réglages, cibles 44 × 44'` (bounding boxes);
    - `'496 × 545 : les sept boutons du rail et la barre d’état restent visibles'`.
- [ ] **Step 2: Run** `npx vitest run src/ui/components/nav-rail.test.tsx` → FAIL; `CI=1 npm run test:e2e` → the four new cases FAIL.
- [ ] **Step 3: Implement** the `Screen` union, the rail items (`foryou` `sparkles`, `agenda` `calendar`, `stats` `chart`), `SCREEN_TITLES`, the three placeholder containers, the `chart` path in `ICON_PATHS` (24 × 24 stroke, three vertical bars on a baseline), the footer `gap-0.5`, `nav.stats` in 21 locales with its context note and review-log lines; update the « Popup shell » paragraph of the design charter (five sections, footer gap).
- [ ] **Step 4: Run** `npm run verify`, `CI=1 npm run test:e2e`, `npm run i18n:check`, `CI=1 npm run test:i18n-layout` → PASS (the existing `'navigue entre En cours, Activité et Réglages, et change de langue'` included).
- [ ] **Step 5: Commit** `feat(popup): add the Pour toi, Agenda and Stats sections to the rail`.

## Task 2: « Pour toi » in the popup, with genre and format filters

**Branch:** `feature/popup-for-you`

**Files:**
- Move: `src/sidepanel/components/discover.tsx` (+ `discover.test.tsx`) → `src/ui/components/discover.tsx` (`git mv`, specifiers of `src/sidepanel/panel-app.tsx` rewritten)
- Modify: `src/shared/recommendations.ts`, `src/ui/reco-controller.ts`, `src/ui/components/discover.tsx`, `src/ui/components/screen-title.tsx` (`subtitle`), `src/popup/popup-app.tsx`, `src/popup/popup.ts`, `src/popup/components/empty-reco.tsx`, `scripts/e2e/popup-frame.ts` (a MOVIE card in the reco batch if none), `scripts/e2e/i18n-layout.e2e.ts` (screen `popup/foryou`), `docs/design/README.md` (« Popup Pour toi »), `docs/memory/architecture.md` (Discover path)
- Create: `src/popup/components/foryou-screen.tsx` (+ test), `src/popup/controllers/section-prefs.ts` (+ test)
- Strings: `reco.basedOnScores` (« D’après tes notes »), `reco.filter.format` (« Format », group name), `reco.filter.series` (« Séries »), `reco.filter.movies` (« Films »), `reco.filter.clear` (« Retirer le filtre »), `reco.more` (« Plus d’idées »); `reco.morePanel` removed (catalogs and context note). Reused: `compare.filter.all` (« Tout », both groups), `panel.nowPlaying.genres` (genre group name), `genre.*`, `compare.filter.empty`.
- Test: `src/shared/recommendations.test.ts`, `src/ui/reco-controller.test.ts`, `src/ui/components/discover.test.tsx`, `src/popup/components/foryou-screen.test.tsx`, `src/popup/controllers/section-prefs.test.ts`, `src/popup/components/empty-reco.test.tsx`, `scripts/e2e/popup.e2e.ts`

**Interfaces — produces:**
```ts
// src/shared/recommendations.ts
export type RecoFormat = 'all' | 'series' | 'movies';
export interface RecoFilter { genre: string | null; format: RecoFormat }
export const ALL_RECO_FILTER: RecoFilter; // { genre: null, format: 'all' }
export function isRecoFilter(value: unknown): value is RecoFilter;
/** movies = MOVIE ; series = TV, TV_SHORT, ONA, OVA, SPECIAL ; format null ou MUSIC : seulement « all » */
export function matchesRecoFilter(card: RecoCard, filter: RecoFilter): boolean;
/** Genres du lot, du plus fréquent au moins fréquent, puis par nom */
export function recoGenres(batch: RecoBatch): string[];
// src/ui/reco-controller.ts
export type RecoView =
  | { status: 'loading' | 'error' | 'empty' | 'none'; message?: string }
  | { status: 'ready'; current: RecoItem; previous: RecoItem[]; cold: boolean; malOnly: boolean; added: boolean; dismissedTitle: string | null; addError?: string; filter: RecoFilter; genres: readonly string[] }
  /** Le filtre ne laisse aucune fiche à tirer */
  | { status: 'filtered'; filter: RecoFilter; genres: readonly string[] };
export function createRecoController(options?: { filter?: RecoFilter }): RecoController;
// RecoController gains:
setFilter(filter: RecoFilter): void;
// src/ui/components/discover.tsx — DiscoverProps gains:
onClearFilter?: () => void;
// src/ui/components/screen-title.tsx — ScreenTitleProps gains:
subtitle?: string;
// src/popup/controllers/section-prefs.ts (clé locale 'popupPrefs:sections', préférences d'affichage comme 'popupPrefs')
export interface SectionPrefs { recoFilter: RecoFilter }
export const SECTION_PREFS_KEY = 'popupPrefs:sections';
export const DEFAULT_SECTION_PREFS: SectionPrefs;
export function normalizeSectionPrefs(raw: unknown): SectionPrefs;
export function loadSectionPrefs(): Promise<SectionPrefs>;
/** Lecture, fusion, écriture : les champs absents du patch (et ceux d'une autre version) sont gardés */
export function saveSectionPrefs(patch: Partial<SectionPrefs>): Promise<void>;
// src/popup/components/foryou-screen.tsx
export const MAX_GENRE_CHIPS = 8;
export type ForYouScreenProps = Omit<DiscoverProps, 'onClearFilter'> & { onFilter: (filter: RecoFilter) => void };
```
- Controller rules: the draw pool is `batch.items.filter(matchesRecoFilter)` minus `drawn`; « Autre » and the end of the « Annuler » delay draw in it; `setFilter` keeps the current card when it matches, else draws; nothing left in the filter → `filtered`, without a filter → `empty` (as today). On every batch load, a `filter.genre` absent from `recoGenres(batch)` becomes `null` (Review Focus 1). The panel creates its controller without options: `ready` views carry `ALL_RECO_FILTER` and it never sees `filtered`.
- Screen: subtitle `reco.basedOnScores`; chips only for `ready` and `filtered`: a genre group (`role="group"` named `panel.nowPlaying.genres`, buttons with `aria-pressed`: « Tout » + the first `MAX_GENRE_CHIPS` genres + the chosen one when beyond) and a `Segmented` format control named `reco.filter.format` (`compare.filter.all`, `reco.filter.series`, `reco.filter.movies`); then `Discover` with `onClearFilter = () => onFilter(ALL_RECO_FILTER)`. `Discover`'s `filtered` case: `compare.filter.empty` and a `reco.filter.clear` button (`focusKey` `reco-clear-filter`).
- `popup.ts`: the section prefs are read once at boot (`loadSectionPrefs`); `recoController()` is created in `followShownScreen` on the first `foryou` display with `{ filter }` from them (`ALL_RECO_FILTER` if not read yet), mirrored into a store, disposed on `pagehide`; `onFilter` → `setFilter` + `saveSectionPrefs`. `watching.onOpenDiscover` → `navigate('foryou')`; `openPanelOnDiscover` and its `openPanelOn` import removed. `EmptyReco`: text `reco.more` ›, `focusKey` `reco-more`, icon `sparkles`.

- [ ] **Step 1: Move** `discover.tsx` and its test with `git mv`, rewrite the specifiers; `npx vitest run src/ui/components/discover.test.tsx src/architecture.test.ts` → PASS; commit `refactor: move the Discover view into ui/components (no code change)`; then add its hash to `.git-blame-ignore-revs` (comment line = the commit subject) and commit `chore: ignore the Discover move in git blame`.
- [ ] **Step 2: Failing tests**
  - `recommendations.test.ts` › `'matchesRecoFilter : genre, films = MOVIE, séries = TV / TV_SHORT / ONA / OVA / SPECIAL, format inconnu seulement avec « all »'`, `'recoGenres : du plus fréquent au moins fréquent, puis par nom, sans doublon'`, `'isRecoFilter'`.
  - `reco-controller.test.ts` › `'filtre Films : la fiche tirée et « Autre » restent des films'`, `'changer de filtre garde la fiche si elle correspond, sinon en tire une'`, `'filtre sans fiche : état filtered ; ALL_RECO_FILTER redonne une fiche'`, `'genre retenu absent du lot : filtre ramené à Tous, une fiche s’affiche'`, `'sans option : vue ready avec ALL_RECO_FILTER (panneau inchangé)'`.
  - `discover.test.tsx` › `'filtered : « Aucune série pour ce filtre. » et « Retirer le filtre » appelle onClearFilter'`.
  - `foryou-screen.test.tsx` › `'puces : Tout + 8 genres au plus, le genre choisi toujours présent, aria-pressed ; format Tout / Séries / Films ; onFilter reçoit le filtre complet'`, `'aucune puce pendant le chargement, l’erreur, sans compte'`.
  - `section-prefs.test.ts` › `'valeur illisible → défaut ; genre de plus de 40 caractères → null'`, `'saveSectionPrefs fusionne avec la valeur enregistrée'`.
  - `empty-reco.test.tsx` › `'« Plus d’idées » appelle onMore dans le clic'` (text `reco.more`).
  - `popup.e2e.ts`: `'Pour toi : aucun GET_RECOMMENDATIONS avant l’ouverture, un seul ensuite ; titre et sous-titre ; Autre'`, `'filtre Films : la fiche est un film ; popup rouvert, filtre retenu'`, `'Mes séries vide : « Plus d’idées » ouvre Pour toi dans le popup, sans panneau'` (replaces the `reco-more-panel` assertion of the empty-state test).
- [ ] **Step 3: Run** `npx vitest run src/shared/recommendations.test.ts src/ui/reco-controller.test.ts src/ui/components/discover.test.tsx src/popup` → FAIL.
- [ ] **Step 4: Implement** the signatures above, the strings in 21 locales (context notes, review logs), the design-charter paragraph and the architecture path.
- [ ] **Step 5: Run** `npm run verify`, `CI=1 npm run test:e2e` (sidepanel « Découvrir » tests included), `npm run i18n:check`, `CI=1 npm run test:i18n-layout` → PASS.
- [ ] **Step 6: Commit** `feat(popup): show Pour toi in the popup with genre and format filters`.

## Task 3: The Agenda shared through `ui/` and mounted in the popup

**Branch:** `feature/popup-agenda`

**Files:**
- Move: `src/sidepanel/agenda-controller.ts` (+ test) → `src/ui/agenda-controller.ts`; `src/sidepanel/agenda-load.ts` (+ test) → `src/ui/agenda-load.ts`; `src/sidepanel/components/agenda.tsx` (+ test) → `src/ui/components/agenda.tsx` (`git mv`; specifiers of the moved files, `src/sidepanel/sidepanel.ts`, `src/sidepanel/panel-app.tsx` and every `vi.mock` path rewritten)
- Modify: `src/ui/components/agenda.tsx` (scroll root, `inset`), `src/sidepanel/panel-app.tsx` (`data-scroll-root` on the tab panel), `src/popup/popup-app.tsx`, `src/popup/popup.ts`, `scripts/e2e/popup-frame.ts` (GET_AGENDA through `scripts/screenshots/demo-panel.ts` › `agendaWeek`, sequels in storage), `scripts/e2e/i18n-layout.e2e.ts` (screens `popup/agenda`, `popup/agenda-announced`), `docs/memory/architecture.md`, `docs/design/README.md` › Side panel Agenda (paths, popup host)
- Strings: none.
- Test: `src/ui/components/agenda.test.tsx`, `scripts/e2e/popup.e2e.ts`, `scripts/e2e/sidepanel.e2e.ts` (unchanged, must pass)

**Interfaces:**
- Consumes: Task 1's `followShownScreen`, the `agenda` screen container; Task 2's `navigate('foryou')`.
- Produces:
```ts
// src/ui/agenda-controller.ts : inchangé (createAgendaController, AgendaController, AgendaStatus, NAV_DEBOUNCE_MS, STORAGE_DEBOUNCE_MS)
// src/ui/components/agenda.tsx — AgendaProps gains:
/** Marge de la colonne de l'hôte : la navigation collante en couvre toute la largeur (panneau px-3, popup px-4) */
inset?: 'panel' | 'popup';
// Défilement remis en haut après un changement de semaine : closest('[data-scroll-root]') (popup : <main>, panneau : le tabpanel)
```
- `popup.ts`: `agenda` controller created on the first `agenda` display (`createAgendaController({ platformAccess: platformAccessStore, onChange })`, snapshot store as in `sidepanel.ts`), `activate()` on every display, `dispose()` on `pagehide`; props: `sequels: sequelsStore`, `granted` from `platformAccessStore`, `onDiscover: () => navigate('foryou')`. The screen is mounted only after its first display. `markSequelsSeen` stays tied to `activity` (call 3).

- [ ] **Step 1: Move** the three modules and their tests with `git mv`, rewrite the specifiers; `npx vitest run src/ui/agenda-controller.test.ts src/ui/agenda-load.test.ts src/ui/components/agenda.test.tsx src/architecture.test.ts` → PASS; commit `refactor: move the Agenda controller and view into ui/ (no code change)`; add the hash to `.git-blame-ignore-revs`, commit `chore: ignore the Agenda move in git blame`.
- [ ] **Step 2: Failing tests**
  - `agenda.test.tsx` › `'changement de semaine : la zone [data-scroll-root] revient en haut'`, `'inset popup : navigation collante en -mx-4 px-4 ; défaut panneau en -mx-3 px-3'`.
  - `popup.e2e.ts`: `'Agenda : aucun GET_AGENDA avant l’ouverture, une requête ensuite ; Semaine puis Annoncées ; ‹ › regroupés'`, `'Ajuster l’heure : enregistré, focus rendu au ⋯ de la série'`, `'Annoncées ne marque aucune suite comme vue (aucun UPDATE_SEQUELS « seen »), le point du rail sur Activité reste'`, `'440 px : heure du Japon jamais tronquée ([data-agenda-jp] scrollWidth ≤ clientWidth)'`, `'semaine vide : « Une idée ? » ouvre Pour toi'`, `'496 × 545 : navigation collante sur toute la largeur de la colonne, dernier jour atteignable, barre d’état visible'` (Review Focus 4).
- [ ] **Step 3: Run** `npx vitest run src/ui/components/agenda.test.tsx` and `CI=1 npm run test:e2e` → the new cases FAIL.
- [ ] **Step 4: Implement** the scroll root, `inset`, the popup wiring and the harness handlers; update the architecture memory and the design charter.
- [ ] **Step 5: Mockup** — a `popup.e2e.ts` case `'maquette Agenda'` that, when `SYNCKAI_MOCKUP_DIR` is set, saves `agenda-week.png`, `agenda-announced.png` and `agenda-week-zoom110.png` (496 × 545) there (no file written otherwise). Run: `SYNCKAI_MOCKUP_DIR=/tmp/claude-0/-home-user/d3b7fa96-95d6-59e4-903d-2a42a7d1a01e/scratchpad/mockups CI=1 npx vitest run -c vitest.e2e.config.ts scripts/e2e/popup.e2e.ts -t "maquette"`; the report lists the three paths.
- [ ] **Step 6: Run** `npm run verify`, `CI=1 npm run test:e2e`, `CI=1 npm run test:i18n-layout` → PASS.
- [ ] **Step 7: Commit** `feat(popup): show the Agenda in the popup`.

## Task 4: Stats profile data from the existing viewer requests

**Branch:** `feature/stats-profile-data`

**Files:**
- Create: `src/shared/profile-stats.ts` (+ test); fixtures `src/shared/__fixtures__/profile-stats/anilist-point-10.json`, `anilist-point-10-decimal.json`, `anilist-point-3.json` (and `anilist-point-5.json`, `anilist-point-100.json` if a public profile is found)
- Modify: `src/shared/anilist.types.ts`, `src/shared/mal.types.ts` (field + guards), `src/background/anilist/viewer.ts` (query, reducer), `src/background/mal/client.ts` (reducer of the same `anime_statistics`), `src/ui/account-menu-model.ts` (exported `typedViewerState`, moved from `account-menu.tsx`)
- Test: `src/shared/profile-stats.test.ts`, `src/background/anilist/viewer.test.ts`, `src/background/mal/client.test.ts`, `src/ui/account-menu-model.test.ts`

**Interfaces — produces:**
```ts
// src/shared/profile-stats.ts (pur)
export interface ProfileStats {
  /** Format des notes de l'utilisateur (MAL : 'POINT_10') */
  scoreFormat: AniListScoreFormat;
  /** Note moyenne sur 100 (AniList meanScore, toujours sur 100 ; MAL mean_score × 10) ; null sans note */
  meanScore100: number | null;
  statuses: { status: ListStatus; count: number }[];
  formats: { format: string; count: number }[];          // AniList seulement
  genres: { genre: string; count: number; meanScore100: number | null }[]; // 6 au plus
  /** Répartition des notes dans le format de l'utilisateur (POINT_10_DECIMAL : 65 reçu → 6,5) */
  scores: { score: number; count: number }[];
  studios: { name: string; count: number }[];            // 5 au plus
  decades: { decade: number; count: number }[];          // 1990, 2000… triées
  /** MAL num_times_rewatched ; null sur AniList */
  rewatched: number | null;
}
export function aniListProfileStats(raw: unknown, scoreFormat: unknown): ProfileStats | null;
export function malProfileStats(raw: unknown): ProfileStats | null;
export function isProfileStats(value: unknown): value is ProfileStats;
/** Moyenne affichée dans le format de l'utilisateur : POINT_100 → entier /100 ; POINT_10, POINT_10_DECIMAL → 1 décimale /10 ; POINT_5 → /5 ; POINT_3 → /10 */
export function meanInFormat(mean100: number, format: AniListScoreFormat): { value: number; max: number };
// src/shared/anilist.types.ts, src/shared/mal.types.ts — AniListViewer / MalViewer gain:
/** Statistiques détaillées (écran Stats) ; null : illisibles ; absentes : profil enregistré avant elles */
profile?: ProfileStats | null;
// src/ui/account-menu-model.ts
export function typedViewerState(state: AccountState<unknown>): AccountState<AniListViewer | MalViewer>;
```
- AniList query (same `Viewer` request): `mediaListOptions { scoreFormat }` and `statistics { anime { count episodesWatched minutesWatched meanScore statuses { status count } formats { format count } genres(limit: 6, sort: COUNT_DESC) { genre count meanScore } scores(sort: MEAN_SCORE) { score count } studios(limit: 5, sort: COUNT_DESC) { studio { name } count } releaseYears { releaseYear count } } }`. `stats` (account menu) is unchanged and still built by `aniListStats`.
- MAL fields (API v2 docs, the example already in `account-stats.test.ts`): `num_items_watching` → CURRENT, `num_items_completed` → COMPLETED, `num_items_on_hold` → PAUSED, `num_items_dropped` → DROPPED, `num_items_plan_to_watch` → PLANNING, `num_times_rewatched`, `mean_score` (0 → null); formats, genres, scores, studios and decades empty.
- Each block is read on its own: an unreadable block is empty, the others stay (only a non-object `raw` gives `null`).
- Measured on 2026-11-11 (public profiles, no token): `meanScore` is on 100 for every format (POINT_3 profile: 83.83); `scores[].score` follows the user's format (POINT_10: 1–10, POINT_3: 1–3) except POINT_10_DECIMAL, which returns 100-point buckets (65, 70…). Step 1 confirms POINT_5 and POINT_100 when a public profile is found; otherwise they are kept as received.

- [ ] **Step 1: Capture** with anonymous POSTs to `https://graphql.anilist.co` (header `X-Client: SyncKai (+https://synckai.app)`), `Page(perPage: 25) { users(search: "…") { mediaListOptions { scoreFormat } statistics { anime { … the fields above … } } } }`, a few requests at most; keep one profile per score format with more than 20 entries, saving only `mediaListOptions` and `statistics` (never a name, id or avatar).
- [ ] **Step 2: Failing tests**
  - `profile-stats.test.ts` › `'AniList POINT_10 (fixture) : statuts, formats, 6 genres, notes 1–10, 5 studios, décennies regroupées'`, `'POINT_10_DECIMAL : 65 → 6,5'`, `'POINT_3 : notes 1–3, moyenne sur 100'`, `'bloc illisible vide, les autres gardés ; raw non objet → null'`, `'MAL anime_statistics : statuts, revisionnages, moyenne × 10 ; formats, genres, notes, studios, décennies vides'`, `'meanInFormat pour les cinq formats'`, `'isProfileStats refuse les compteurs négatifs ou non entiers'`.
  - `viewer.test.ts` › the regex of `'une seule requête Viewer…'` replaced by assertions on each field of the query above, `mediaListOptions { scoreFormat }` included; `'profil enregistré avec profile (statistiques détaillées), stats du menu inchangées'`; `'profil en cache sans profile (avant cette version) : toujours valide'` (Review Focus 5).
  - `client.test.ts` › `'getMalViewer : profile tiré des mêmes anime_statistics, même requête'`.
  - `account-menu-model.test.ts` › `'typedViewerState : profil invalide → viewer null'`.
- [ ] **Step 3: Run** `npx vitest run src/shared/profile-stats.test.ts src/background/anilist/viewer.test.ts src/background/mal/client.test.ts src/ui/account-menu-model.test.ts` → FAIL.
- [ ] **Step 4: Implement** the reducers, the guards, the query and `typedViewerState` (the account menu imports it).
- [ ] **Step 5: Run** `npm run verify` → PASS.
- [ ] **Step 6: Commit** `feat(stats): read the detailed profile statistics with the viewer request`.

## Task 5: Local activity history (per day, per service, per account)

**Branch:** `feature/activity-history`

**Files:**
- Create: `src/shared/activity-history.ts` (+ test), `src/browser/storage/activity-history.ts` (+ test)
- Modify: `src/protocol/storage-keys.ts` (`activityHistory: 'stats:activityHistory'`), `src/browser/storage/account-keys.ts` (store + `keepOnExpiry`), `src/browser/storage/account-data.ts` (`clearUserSyncDataIfNoSession(reason)`), `src/browser/storage/session-end.ts` (`afterSessionEnd(reason)`), `src/background/ports/tracker.ts` (`CatalogMedia.duration`), `src/background/sync/sync-service.ts` (`getCatalogMedia`, `countActivity` next to `countWeeklySyncs`), `src/background/page-media/page-media.ts` (`duration` of the catalog it builds), `src/background/anilist/viewer.ts` and `src/background/mal/client.ts` (drop on a saved profile), `src/shared/backup.ts`, `src/browser/storage/backup-store.ts`
- Test: `src/shared/activity-history.test.ts`, `src/browser/storage/activity-history.test.ts`, `src/browser/storage/account-keys.test.ts`, `src/browser/storage/storage.test.ts` (session end, where `endSessionIfToken` is already tested), `src/background/sync/sync-service.test.ts`, `src/background/anilist/viewer.test.ts`, `src/shared/backup.test.ts`, `src/browser/storage/backup-store.test.ts`

**Interfaces — produces:**
```ts
// src/shared/activity-history.ts (pur ; jours = date locale AAAA-MM-JJ de shared/agenda.ts › dateKey)
export const ACTIVITY_DAYS = 400;
export const MAX_DAY_EPISODES = 10_000;
/** [épisodes, minutes] du jour */
export type ActivityDay = readonly [episodes: number, minutes: number];
export interface ActivityPart { accountId: number; days: Readonly<Record<string, ActivityDay>> }
export type ActivityHistory = Partial<Record<TrackerId, ActivityPart>>;
export type StatsPeriod = '7d' | '30d' | '12m' | 'all';
export interface ActivityBar { key: string; episodes: number; minutes: number }
export interface ActivitySummary { episodes: number; minutes: number; firstDay: string | null; unit: 'day' | 'month'; bars: ActivityBar[] }
/** Valeur du stockage : parts et jours illisibles ignorés */
export function readActivityHistory(raw: unknown): ActivityHistory;
/** Sauvegarde : comme readActivityHistory, avec le nombre de parts et de jours ignorés */
export function parseActivityHistory(raw: unknown): { value: ActivityHistory; invalid: number };
/** +1 épisode et +minutes au jour de `now` pour chaque écriture ; part d'un autre compte remplacée ; jours de plus de 400 jours retirés */
export function addActivity(raw: unknown, writes: readonly { service: TrackerId; accountId: number }[], minutes: number, now: number): ActivityHistory;
/** Part de `service` retirée si elle appartient à un autre compte ; null si rien ne change */
export function withoutOtherAccount(raw: unknown, service: TrackerId, accountId: number): ActivityHistory | null;
/** replace : l'entrant ; merge : même compte → maximum par jour et par champ, autre compte → l'existant l'emporte, part absente → l'entrant */
export function mergeActivityHistory(current: ActivityHistory, incoming: ActivityHistory, mode: 'merge' | 'replace'): ActivityHistory; // pas d'import de backup.ts (cycle)
/** Part d'un autre compte (ou accountId null) : résumé vide. 7d / 30d : une barre par jour ; 12m : par mois ; all : par mois depuis le premier jour enregistré. Jours futurs ignorés */
export function activitySummary(history: ActivityHistory, service: TrackerId, accountId: number | null, period: StatsPeriod, now: number): ActivitySummary;
// src/browser/storage/activity-history.ts
/** Sous le verrou : services aux sessions relevées et toujours ouvertes, identifiant du compte lu dans le profil en cache (absent : service ignoré). false : rien d'écrit */
export function recordActivity(services: readonly TrackerId[], epochs: SessionEpochs, minutes: number, now?: number): Promise<boolean>;
export function getActivityHistory(): Promise<ActivityHistory>;
export function dropOtherAccountActivity(service: TrackerId, accountId: number): Promise<void>;
// src/browser/storage/account-keys.ts
export interface AccountBoundStore { /* … */ keepOnExpiry?: true }
export type SessionEndReason = 'sign-out' | 'expired';
export function keysClearedOnLastSession(reason?: SessionEndReason): string[]; // défaut 'sign-out'
// src/browser/storage/account-data.ts
export function clearUserSyncDataIfNoSession(reason: SessionEndReason): Promise<boolean>;
// src/background/ports/tracker.ts — CatalogMedia gains:
/** Durée d'un épisode (minutes, AniList duration) ; absente ou null : inconnue (0 minute comptée) */
duration?: number | null;
// src/shared/backup.ts — BackupData gains (section facultative, absente de BackupSummary) :
activityHistory: ActivityHistory;
```
- Windows are built by calendar steps (`new Date(y, m, d - i)` then `dateKey`), never by subtracting multiples of 86 400 000 ms (Review Focus 3). Pruning keeps the 400 days ending today.
- `ACCOUNT_STORES` entry: `{ name: 'activity-history', scope: { kind: 'user' }, keys: [STORAGE_KEYS.activityHistory], keepOnExpiry: true }`. `endSession` → `afterSessionEnd('sign-out')`; `endSessionIfToken` / `endSessionIfUnreadable` → `afterSessionEnd('expired')`; `removeUserSyncData` removes `keysClearedOnLastSession(reason)`. `purgeClosedSessions` leaves the history alone (it is keyed by account id, not by session).
- `sync-service.ts`: after `countWeeklySyncs(updated, options.epochs)`, under the same `correctionFrom === null` condition, `countActivity(updated, options.epochs, catalog.duration ?? 0)`, which logs and swallows any failure (never fails a sync).
- `getViewer` / `getMalViewer`: after a successful `saveCached…Viewer`, `dropOtherAccountActivity(service, viewer.id)` in a try / catch.
- Backup: `BACKUP_STORAGE_KEYS.activityHistory = STORAGE_KEYS.activityHistory` (comment « les 9 seules clés »), validated by `parseActivityHistory`, merged by `mergeActivityHistory`, written by `applyBackup`; no session binding.

- [ ] **Step 1: Failing tests**
  - `shared/activity-history.test.ts` › `'un épisode et ses minutes au jour local, par service'`, `'23:59 puis 00:01 : deux jours'`, `'7d sur une semaine de changement d’heure : 7 barres consécutives, jours vides à zéro'`, `'12m : 12 barres mensuelles ; all : par mois depuis le premier jour, firstDay renseigné'`, `'autre compte sur le service : part remplacée à l’écriture, résumé vide à la lecture'` (Review Focus 2), `'400 jours au plus ; jours futurs gardés mais hors des résumés'`, `'plafond MAX_DAY_EPISODES'`, `'mergeActivityHistory : maximum par jour pour le même compte, l’existant gagne contre un autre compte'`, `'parseActivityHistory compte les parts et jours illisibles'`.
  - `browser/storage/activity-history.test.ts` › `'écrit seulement pour les sessions relevées et toujours ouvertes'`, `'profil absent du cache : service ignoré'`, `'dropOtherAccountActivity : part d’un autre compte retirée, même compte gardé'`.
  - `account-keys.test.ts` › `'activity-history : scope user, gardée quand la dernière session expire, effacée à la dernière déconnexion'`; the registry test (every `STORAGE_KEYS` key classified) passes once the key is declared.
  - `storage.test.ts` › `'jeton refusé du dernier compte : historique d’activité gardé ; déconnexion du dernier compte : effacé'`.
  - `sync-service.test.ts` › `'synchro réussie : épisode et durée de la fiche dans l’historique ; correction : rien'`, `'échec de l’historique : synchro réussie quand même'`.
  - `viewer.test.ts` › `'profil enregistré : part d’activité d’un autre compte AniList retirée'`.
  - `backup.test.ts` › `'activityHistory : aller-retour, section absente = vide, invalides comptés, fusion par compte'`; `backup-store.test.ts` › `'applyBackup écrit activityHistory'`.
- [ ] **Step 2: Run** `npx vitest run src/shared/activity-history.test.ts src/browser/storage src/background/sync src/background/anilist/viewer.test.ts src/shared/backup.test.ts` → FAIL.
- [ ] **Step 3: Implement** the signatures above.
- [ ] **Step 4: Run** `npm run verify` (`architecture.test.ts`: no new `addListener` in `background/`) → PASS.
- [ ] **Step 5: Commit** `feat(stats): keep a local per-day history of the episodes SyncKai synced`.

## Task 6: The Stats screen (mockup first)

**Branch:** `feature/popup-stats`

**Files:**
- Create: `src/popup/components/stats-screen.tsx` (+ test), `src/popup/components/stats-bars.tsx` (`BarColumns`, `BarRows`), `src/popup/controllers/stats.ts` (+ test), `src/ui/components/stat-tiles.tsx` (the account menu's `StatTiles`, extracted unchanged)
- Modify: `src/popup/controllers/section-prefs.ts` (`statsService`), `src/popup/popup-app.tsx`, `src/popup/popup.ts` (lazy controller, `STORAGE_KEYS.activityHistory` in the existing `storage.onChanged` listener → `stats.reloadActivity()`), `src/ui/account-menu.tsx` (imports `StatTiles`), `src/ui/review-view.ts` (export `formatLabel`), `scripts/e2e/popup-frame.ts` (param `stats=both|anilist|mal|empty|foreign`: viewers with `profile`, a history in storage), `scripts/e2e/i18n-layout.e2e.ts` (screens `popup/stats`, `popup/stats-mal`), `docs/design/README.md` (« Popup Stats »)
- Strings: `stats.activity` (« Activité de SyncKai »), `stats.period` (« Période », control name), `stats.period.week` (« 7 j »), `stats.period.month` (« 30 j »), `stats.period.year` (« 12 mois »), `stats.since` (« depuis le {date} »), `stats.activity.empty` (« Aucun épisode synchronisé sur cette période »), `stats.allTime` (« Depuis le début »), `stats.service` (« Service affiché »), `stats.statuses` (« Statuts »), `stats.meanScore` (« Note moyenne »), `stats.scores` (« Notes »), `stats.formats` (« Formats »), `stats.studios` (« Studios »), `stats.decades` (« Décennies »), `stats.decade` (« années {decade} »), `stats.rewatched_*` (« {count} revisionnage(s) »). Reused: `compare.filter.all` (period « Tout »), `accountMenu.week.value` (episodes), `nav.watching` + `watching.remaining.total` (in progress), `accountMenu.stats.*` (tiles), `page.status.*`, `genre.*`, `panel.nowPlaying.genres`, `review.format.*`, `common.sessionExpired`, `common.reconnect`, `common.retry`, `settings.summary.noAccount`, `common.connect`.
- Test: `src/popup/controllers/stats.test.ts`, `src/popup/components/stats-screen.test.tsx`, `src/popup/controllers/section-prefs.test.ts`, `src/ui/account-menu.test.tsx` (unchanged, must pass), `scripts/e2e/popup.e2e.ts`

**Interfaces:**
- Consumes: Task 4's `ProfileStats`, `meanInFormat`, `typedViewerState`; Task 5's `ActivitySummary`, `StatsPeriod`, `activitySummary`, `getActivityHistory`; `formatRemainingTotal` (`shared/remaining-time.ts`), `getCachedWatching`, `menuNeedsRefresh`, `getViewerFetchedAt`.
- Produces:
```ts
// src/popup/controllers/section-prefs.ts — SectionPrefs gains:
statsService: TrackerId | null;
// src/popup/controllers/stats.ts
export const DEFAULT_STATS_PERIOD: StatsPeriod; // '30d'
export interface StatsView {
  /** null : aucun compte connecté */
  service: TrackerId | null;
  /** Comptes connectés : le contrôle AniList / MAL s'affiche quand il y en a deux */
  services: readonly TrackerId[];
  period: StatsPeriod;
  account: AccountState<AniListViewer | MalViewer>;
  refreshing: boolean;
  activity: ActivitySummary;
  /** « ≈ 3 h à rattraper · 4 séries » (cache « En cours » du service), null sans série */
  remaining: string | null;
}
export interface StatsController {
  readonly store: ReadonlyStore<StatsView>;
  /** Écran affiché : historique et cache relus, profil relu s'il date de plus d'une heure (menuNeedsRefresh) */
  show(): void;
  setService(service: TrackerId): void; // retenu dans les préférences du popup
  setPeriod(period: StatsPeriod): void; // non retenu
  reloadActivity(): void;
  dispose(): void;
}
export function createStatsController(deps: {
  accounts: Pick<AccountsController, 'store' | 'refresh'>;
  /** Service par défaut : watching.activeService() */
  defaultService: () => TrackerId | null;
  prefs: { load(): Promise<SectionPrefs>; save(patch: Partial<SectionPrefs>): Promise<void> };
  now?: () => number;
}): StatsController;
// src/popup/components/stats-screen.tsx (props seulement)
export interface StatsScreenProps { state: ReadonlyStore<StatsView>; now: number; onService: (service: TrackerId) => void; onPeriod: (period: StatsPeriod) => void; onReconnect: (service: TrackerId) => void; onRetry: () => void; onOpenAccounts: () => void }
// src/popup/components/stats-bars.tsx
export function BarColumns(props: { bars: readonly { key: string; label: string; value: number; title: string }[]; tone?: Tone }): JSX.Element;
export function BarRows(props: { rows: readonly { key: string; label: string; value: number; display: string; tone?: Tone }[] }): JSX.Element;
```
- Screen, top to bottom (spec): service control (`Segmented`, `stats.service`, only with two accounts); « Activité de SyncKai » with the period control (`stats.period`: `stats.period.week`, `stats.period.month`, `stats.period.year`, `compare.filter.all`), episodes (`accountMenu.week.value`), time (`formatDuration(minutes).text`, hidden at 0), `BarColumns` per day or per month, « depuis le {date} » from `firstDay` when the period starts before it, `stats.activity.empty` when nothing; « En cours » (`nav.watching`) with `remaining`; then the profile blocks under « Depuis le début »: `StatTiles`, statuses (`BarRows`, tone per status from `TONE_BG`), mean score (`meanInFormat`) and `scores`, top genres (`genre.*`, raw name when unknown), formats (`formatLabel`), studios, decades (`stats.decade`), MAL `stats.rewatched`. Empty blocks are not rendered.
- States: no account → `settings.summary.noAccount` + `common.connect` (Settings › Accounts); expired → `common.sessionExpired` + `common.reconnect` (activity still shown: it is local); profile error with nothing cached → `Alert` + `common.retry`; profile loading → the account menu's placeholders.
- Bars: `BarColumns` heights and `BarRows` widths in % of the largest value through `style`; each bar has a `title` and the block a text equivalent for screen readers (values listed, chart `aria-hidden`).

- [ ] **Step 1: Mockup.** Build `StatsScreen`, `BarColumns`, `BarRows` and `StatTiles` as props-only components (load the `dataviz` skill first for the palette); add `stats=…` to `popup-frame.ts` with a fixed `StatsView` behind a temporary store; add the `popup.e2e.ts` case `'maquette Stats'` that, when `SYNCKAI_MOCKUP_DIR` is set, saves `stats-anilist.png`, `stats-mal.png`, `stats-empty.png` and `stats-anilist-zoom110.png` (496 × 545, scrolled to the end as a second shot `stats-anilist-zoom110-end.png`). Run: `SYNCKAI_MOCKUP_DIR=/tmp/claude-0/-home-user/d3b7fa96-95d6-59e4-903d-2a42a7d1a01e/scratchpad/mockups CI=1 npx vitest run -c vitest.e2e.config.ts scripts/e2e/popup.e2e.ts -t "maquette"`. Do not wait for the owner (call 4); the report lists the paths.
- [ ] **Step 2: Failing tests**
  - `stats.test.ts` › `'service : préférence retenue si connectée, sinon defaultService ; setService enregistre statsService'`, `'un seul compte : services de longueur 1'`, `'show : profil relu une fois s’il date de plus d’une heure, jamais sinon'`, `'profil en cache sans profile : totaux affichés, une relecture, blocs remplis à l’arrivée'` (Review Focus 5), `'période par défaut 30d, setPeriod recalcule sans relire le stockage'`, `'reloadActivity relit l’historique'`, `'part d’un autre compte : activité vide'` (Review Focus 2), `'remaining : formatRemainingTotal du cache du service affiché'`.
  - `stats-screen.test.tsx` › `'contrôle AniList / MAL seulement avec deux comptes'`, `'MAL : ni genres, ni formats, ni notes, ni studios, ni décennies ; revisionnages affichés'`, `'« depuis le … » quand la période commence avant le premier jour'`, `'session expirée : Reconnecter, activité locale toujours affichée'`, `'aucun compte : Connecter'`, `'barres : aria-hidden, valeurs lisibles en texte'`.
  - `section-prefs.test.ts` › `'statsService : anilist | mal | null, autre valeur → null'`.
  - `popup.e2e.ts` › `'Stats : aucune requête à l’ouverture si le profil a moins d’une heure ; période 7 j → 7 barres ; service MAL retenu au rouvrir, « Mes séries » inchangé'`, `'part d’un autre compte : aucune activité affichée'`, `'496 × 545 : dernier bloc atteignable, barre d’état visible, pas de défilement horizontal'` (Review Focus 4).
- [ ] **Step 3: Run** `npx vitest run src/popup` and `CI=1 npm run test:e2e` → the new cases FAIL.
- [ ] **Step 4: Implement** the controller, the prefs field, the wiring in `popup.ts` / `popup-app.tsx` (controller created on the first `stats` display, `show()` on every display, `dispose()` on `pagehide`), the strings in 21 locales (context notes, review logs), the design-charter paragraph; replace the mockup store by the controller's.
- [ ] **Step 5: Run** `npm run verify`, `CI=1 npm run test:e2e`, `npm run i18n:check`, `CI=1 npm run test:i18n-layout` → PASS; re-run the mockup command so the screenshots show the final screen.
- [ ] **Step 6: Commit** `feat(popup): add the Stats screen`.

## Task 7: Privacy policy, store answers and changelog

**Branch:** `chore/rail-sections-docs`

**Files:**
- Modify: `PRIVACY.md` (EN, FR, DE: the « Stored locally » list, the log-out paragraph, the AniList / MAL data read), `docs/store/permissions.md` (`storage` block; the data notes), `CHANGELOG.md` (`[2.5.0]`), `docs/memory/features.md` (Stats and the activity history rules, one short entry), `CLAUDE.md` › Project context only if the memory table needs a pointer (no new rule otherwise)
- Test: none (docs); `npm run verify` still runs.

**Content (decided, wording left to the writer):**
- Stored locally: per day and per service, the number of episodes SyncKai synced and their minutes, with the account's ID, for 400 days at most; kept when a session expires, removed for a service when another account signs in on it, removed with the rest at the last log-out; included in the Backup. « Pour toi » filter and the Stats service choice: popup display preferences.
- Read from AniList, in the same profile request as before: list statistics (statuses, formats, top genres, score distribution, top studios, release years, mean score, score format). From MyAnimeList: the same profile statistics already read (no new request).
- `CHANGELOG.md` › `[2.5.0]` › Added: « Pour toi », Agenda and Stats in the popup rail (filters, periods, the local history since 2.5.0); Changed: the rail has five sections and a tighter footer, « Plus d'idées » opens « Pour toi » in the popup, and the existing « Privacy policy updated » line gains the new stored counters and statistics.

- [ ] **Step 1: Write** the three privacy languages, the store block and the changelog lines; check that `docs/store/permissions.md` stays pasteable (the owner pastes it into the Chrome Web Store Privacy tab before the tag).
- [ ] **Step 2: Run** `npm run verify` → PASS; `git diff --stat` shows only these files.
- [ ] **Step 3: Commit** `docs: describe the popup sections and the activity history in the privacy policy and changelog`.

---

## Order and dependencies

The suggested order holds: Task 1 gives the routing every later screen needs; Tasks 2 and 3 only need Task 1 and could swap; Tasks 4 and 5 are independent of the screens (Task 5 touches `viewer.ts` and `mal/client.ts` after Task 4, so it goes second); Task 6 needs 4 and 5; Task 7 describes the final state. Two adjustments from the code: Task 2 also moves `Discover` to `ui/components/` (the popup cannot import the panel's view), and each move gets its own `refactor:` commit plus a `.git-blame-ignore-revs` commit, as `CLAUDE.md` requires. The popup preferences go to a new key `popupPrefs:sections` because `popup/controllers/watching.ts` rewrites `popupPrefs` whole on every sort change and would erase other fields.

## Not checked by this plan

- Real sites and the real extension: the owner's pass in Chrome before the merge (side panel unchanged, popup at 110 % and 125 % zoom, a real sync adding a day to Stats).
- AniList POINT_5 and POINT_100 score buckets, unless Task 4 Step 1 finds a public profile in each format.
