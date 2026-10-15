# Audit 4: UI architecture (popup, side panel, settings, import pages)

Repo `/home/user/SyncKai`, branch `feature/match-signals`, HEAD `9a5d08c`. This is a read-only audit: nothing was run (no `npm ci`, no tests). Every finding comes from reading the code. Items that depend on runtime or assistive-technology behaviour are marked **UNVERIFIED**.

Scope: `src/ui/**`, `src/popup/**`, `src/sidepanel/**`, `src/import/**`, `src/import-cr/**`, and how they use `src/i18n`.

Effort scale: **S** ≤ ½ day, **M** 1–3 days, **L** > 3 days (translations of new strings into 20 locales not included unless stated).

---

## 0. Ranked summary (value / risk)

| # | Item | Kind | Value | Risk | Effort | Protected by |
|---|------|------|-------|------|--------|--------------|
| 1 | Agenda "⋯" menu has no menu keyboard model; Cancel / Escape in the delay editor sends focus to the **next** series | a11y | High | Low | S | `sidepanel.e2e` UI-05 only (no keyboard test) |
| 2 | `media-action-requests.ts` uses its own cover-URL check, not `toSafeImageUrl` | bug in waiting | Med | Very low | S | `ui/media-actions.test.ts` (no case), `lists.ext` |
| 3 | Import page: connect-retry timer not cancelled → two ports can be opened on the same tab | race | Med | Low | S | `import-cr.e2e` "Arrêter" (does not cover it) |
| 4 | One shared, page-level **platform-access store** and **settings store** (6 readers, 4 permission listener sets, 3 hard-coded booleans in Settings) | duplication / state | High (HIDIVE next) | Med | M | `popup.e2e` Netflix/Disney+/Prime toggles, `sidepanel.e2e` UX-05, `summary.test`, `page-media-controller.test` (access) |
| 5 | Tone notice banner implemented 7 times | duplication | Med | Low | S | `popup.e2e` (+1 partial retry), `test:i18n-layout` |
| 6 | Menu primitives + menu state/focus controller (3 renderers, 3 orchestrations, agenda differs) | duplication / a11y | High | Med | M | `popup.e2e` menus, `sidepanel.e2e` remove, `lists.ext`, `menu.test` |
| 7 | Page-entry wiring (notes editor reset, confirm focus) copied between popup page card and panel | duplication | Med | Low | S | `popup.e2e` / `sidepanel.e2e` notes, `lists.ext` |
| 8 | Side panel re-renders whole tab panel synchronously on every change (no scheduler, no region memo) | state | Med | Med-High | M | `sidepanel.e2e`, `panel.ext`, `lists.ext`, `test:i18n-layout` |
| 9 | Split `popup.ts` (855), `import-cr.ts` (1174), `watching-screen.ts` (746), `agenda.ts` (718), `now-playing.ts` (490) | size | Med | Low-Med | M each | see §3 |
| 10 | Small kit gaps: brand header ×2, import page header ×2, section label ×5, `BTN_DANGER` ×2, status line ×4, external link ×13 | duplication | Low-Med | Very low | S | `test:i18n-layout`, screenshots |
| 11 | Service-worker call + "unreachable" fallback hand-written in 9 files | duplication | Low-Med | Low | S | `popup/controllers/*.test.ts`, `accounts.test` |
| 12 | i18n in UI: untranslated `S`/`E` episode labels (3 helpers), placeholder-splitting hacks ×3, platform names hard-coded in strings, locally produced messages stored as text | i18n | Med | Low | S code + translations | `i18n:check`, `test:i18n-layout`, `popup.e2e` locale change |
| 13 | Dead "soon" tab branch in `sidepanel.ts` (3 keys × 21 locales) | dead code | Low | None | S | `tabs.test` |
| 14 | Settings view writes the whole settings object without the storage lock | race, UNVERIFIED impact | Low-Med | Low | S | `popup.e2e` settings toggles |
| 15 | 39 `role="status"` nodes recreated on every render | a11y, UNVERIFIED | Med | Med | M | none (needs AT) |
| 16 | `popup/controllers/watching.ts` imports `entryKey` from a view module | layering | Low | None | S | `watching.test` |
| 17 | Import page decides "connected" from raw token presence (expired AniList counts as connected) | consistency | Low | Low | S | `import-cr.e2e` "session absente" |
| 18 | Firefox: side panel has no "Allow access" path when host access is removed, unlike the popup | consistency, UNVERIFIED | Low | Low | S | none |

---

## 1. Duplication between screens

### D1. "On this page" card (popup) vs "Now playing" tab (panel)

The state machine is already shared (`ui/page-media-controller.ts`), and so are the actions (`ui/media-actions.ts` › `renderMediaActions`, `ui/media-action-requests.ts`). The glue around them is still copied:

- **Notes editor wiring**:
  - `src/popup/popup.ts` › `pageNotesFor` (l. 328–351): reset when `mediaId` changes, `update({ notes: primaryList(...).notes, unavailable: t('notes.notInList'), busy: actions.busy !== null || refreshing })`;
  - `src/sidepanel/components/now-playing.ts` › `followMedia` + `renderNotes` (l. 121–147): the same code.
- **Confirm focus**:
  - `popup.ts` › `setPageConfirm` (l. 772–777);
  - `now-playing.ts` › `setConfirm` (l. 150–155): same keys (`confirm-no-page`, `page-status-${status}`), same logic, a different focus function.
- **State rendering**:
  - `popup/components/page-media-card.ts` › `renderError` / `renderUntracked` / `renderSkeleton`;
  - `now-playing.ts` › `render()` cases `error` / `not-found` / `loading`;
  - both show "title + `renderAlert` with Retry" and the untracked "neutral line". The layouts differ on purpose (card vs. full tab), but the **decision table** (`untracked` → no Retry, no hint; `not-found` → Retry or hint) is duplicated and has already drifted: the popup offers Retry on `not-found`, the panel offers a hint.

**Move up**: `ui/page-entry-tools.ts` › `createPageEntryTools(ctl, { focus })` → `{ notesFor(view, refreshing), setConfirm(status), followMedia(id) }`. Optionally add a pure `pageContentNotice(content)` that returns `{ kind: 'alert' | 'neutral' | 'hint', message }`, which both views then lay out.

### D2. Drop-down menus (rendering and orchestration)

Panel chrome (`absolute top-full right-0 z-30 … shadow-pop`), trigger (`aria-haspopup`, `aria-expanded`, `aria-controls`, ArrowDown/ArrowUp opens), `onMenuKeyDown`:

- `popup/components/watching-screen.ts` › `renderRowMenu` (l. 157–263), `renderRowMenuControl` (l. 266–294), `renderSortMenu` / `renderSortControl` (l. 525–583);
- `ui/list-entry-tools.ts` › `renderCardMenu` (l. 87–141);
- `sidepanel/components/agenda.ts` › `renderMenu` + trigger (l. 492–559): a **third, weaker variant** (see §4 A1).

Open/close/confirm state and focus moves:

- `popup.ts` › `setSortMenu` / `setRowMenu` / `setRowConfirm` / `menuDismiss` (l. 222–371);
- `now-playing.ts` › `setMenu` / `setRemoveConfirm` / `menuDismiss` (l. 82–118);
- `agenda.ts` › `menuFor` + `menuDismiss` (onClick instead of onPointerDown, l. 125–131).

**Move up** into `ui/menu.ts`:

```ts
export function menuTrigger(p: { open: boolean; menuId: string; label: string; focusKey: string; className: string; onToggle(open: boolean): void }, ...children: Child[]): HTMLButtonElement;
export function menuPanel(p: { id: string; label: string; width?: 'row' | 'sort'; onClose(): void }, ...items: Child[]): HTMLElement;
export function menuItem(p: { focusKey: string; label: string; icon: SVGSVGElement; onClick(): void; disabled?: boolean; danger?: boolean }): HTMLElement;
/** Single open menu per screen + inline confirm, focus moves after the next render */
export function createMenuState<K extends string>(o: { afterRender(fn: () => void): void; root: () => HTMLElement }): {
  open: K | null; confirm: string | null; setOpen(key: K | null, restoreFocus?: boolean): void; setConfirm(c: string | null): void; dismiss: MenuDismiss;
};
```

### D3. Tone notice / feedback banner (7 copies)

`border px-2.5 py-2 text-[11px] font-bold ${TONE_CHIP[tone]}` + check/alert icon + text + optional Retry:

- `watching-screen.ts` › `renderNotice` (l. 657–667);
- `ui/media-actions.ts` › `renderActionFeedback` (l. 237–248);
- `popup/components/rating-section.ts` l. 81;
- `popup/components/queue-section.ts` l. 112;
- `popup/components/compare-section.ts` l. 212;
- `import-cr/import-cr.ts` › `renderApplySummary` (l. 862–876);
- `popup/components/review-card.ts` › `renderFeedback` with its own `TONE_CLASSES` (l. 45–50), byte-identical to `ui/feedback.ts` › `TONE_CHIP`.

**Move up**: `ui/feedback.ts` › `renderNotice({ tone, text, detail?, icon?: boolean, action?: { label, onClick, focusKey } })`.

### D4. Neutral status / empty / busy lines

- `sidepanel/sidepanel.ts` › `renderNotice` (l. 217–229);
- `now-playing.ts` › `renderStatus` (l. 164–172);
- `agenda.ts` › `message()` (l. 316–324);
- `popup/components/review-section.ts` empty block;
- `import/import.ts` "reading" line (l. 351);
- `import-cr.ts` › `statusLine` (l. 670–672).

**Move up**: `ui/kit.ts` › `statusBlock({ icon, text, busy, tone, action, inset })` and `statusLine(text)`.

### D5. Shell pieces

- **Brand header**: `popup/components/header.ts` › `renderHeader` and `sidepanel/sidepanel.ts` › `renderHeader` (l. 105–118): same Kai tile + "SyncKai" + `シンカイ` + gear button. The gear's `aria-pressed` state is computed in two different ways, and the panel uses `<h1>` where the popup uses `<span>`. → `ui/brand-header.ts`.
- **Import pages**:
  - `import/import.ts` › `renderHeader` (l. 111–123) and `import-cr.ts` › `renderHeader` (l. 656–668) are identical;
  - the bootstrap is also the same (`initI18n`, `document.title`, `onLocaleChange` redraw);
  - → `ui/page-header.ts` + `ui/standalone-page.ts` › `bootPage({ titleKey, draw })`.
- **Section label**: `ui/kit.ts` › `sectionLabel` exists, but the same class string is re-typed in:
  - `import/import.ts` (`SECTION_TITLE`, l. 310, and the legend l. 252);
  - `import-cr.ts` › `sectionHeading` (l. 1009–1011);
  - `ui/settings/page-notifications.ts` l. 218;
  - `ui/settings/page-language.ts` l. 163.
- **`BTN_DANGER`**: exported from `ui/settings/rows.ts` l. 168 and redefined in `import/import.ts` l. 25 → `ui/kit.ts`.
- **External links** (`target=_blank rel=noopener noreferrer`): 13 hand-written sites, among them `now-playing.ts` › `externalLink` (local helper), `page-media-card.ts` › `renderLinks`, `watching-screen.ts` ×5 and `agenda.ts` ×2 → `ui/kit.ts` › `externalLink(href, attrs, ...children)`.

### D6. Platform lists and optional-platform access

The same fact, "which optional platforms are granted", is read independently in six places:

| Where | How | Listener |
|---|---|---|
| `popup/popup.ts` › `checkHostAccess` (l. 645–651) | `grantedOptionalPlatforms()` → `platformAccessStore` | `permissions.onAdded/onRemoved` (l. 832–833) |
| `sidepanel/sidepanel.ts` › `refreshOptionalPlatforms` (l. 291–298) | module `let optionalPlatforms` | own `onAdded/onRemoved` (l. 331–332) |
| `sidepanel/presence.ts` › `onAccessChange` | re-evaluates the tab | own listeners (l. 103–104) |
| `ui/page-media-controller.ts` › `onAccessChange` + `cachedView` | `hasPlatformAccess(platform)` | own listeners (l. 213–214) |
| `ui/settings/settings-view.ts` › `loadPlatformAccess` (l. 199–202) | **three hard-coded booleans** `netflixAccess` / `disneyAccess` / `primeAccess` (`ui/settings/context.ts` l. 42–54, `page-sync.ts` l. 100–102), with `grantedPlatforms()` re-implementing `grantedOptionalPlatforms()` | own listeners (l. 386–389) |
| `sidepanel/components/agenda.ts` › `loadWeek` (l. 189) and `now-playing-controller.ts` › `effectivePreferredPlayer` | re-read on every load | storage only |

In the panel this means up to 4 sets of permission listeners and several `permissions.contains` calls for one event. Adding HIDIVE (next on the roadmap) currently means editing `context.ts`, `settings-view.ts` and `page-sync.ts` by hand.

The "enable platform" action has the same shape in three places, each with the same "request in the click, no `await` first" constraint:

- `sidepanel.ts` › `renderEnableButton` (l. 273–288);
- `page-sync.ts` › `onAccessToggle`;
- `import-cr.ts` › `requestSourceAccess`.

**Move up**: `ui/platform-access-store.ts` › `createPlatformAccessStore(): Store<readonly StreamingPlatform[] | undefined>` (one per page, a single listener pair), plus `requestPlatformAccessFromClick(platform, store)`. Settings then holds `optional: readonly StreamingPlatform[] | undefined` instead of three booleans. See §2 for the companion settings store.

Related, i18n side: several English strings hard-code platform names that should be placeholders filled through `formatPlatformList` from the registry, as `panel.offTargetPlatforms` already is:

- `watching.tip` ("Netflix, Disney+, Prime Video (optional)…");
- `onboarding.intro`;
- `watching.empty.text`;
- `agenda.empty.noSeries`;
- `popup.hostAccessMissing`;
- `match.titleOnly`.

Each new platform otherwise means 21 retranslations.

### D7. Episode / service labels

- `popup/components/queue-section.ts` › `episodeLabel` (l. 32–38) builds `S{n} E{n}` and `servicesLabel` (l. 40–42) a hard-coded `'AniList · MyAnimeList'`;
- `popup/components/review-card.ts` › `episodeLabel` (l. 52–62) builds `S{n} · E{n} · displayed`;
- `popup/components/recent-syncs.ts` › `episodeNumber` (l. 24–27) builds `· E{n}`;
- `import-cr.ts` › `seasonPart` / `renderReviewItem`.

The `S` / `E` letters never go through `t()`, so ja / zh / ko users see Latin abbreviations. That may be intentional, but it is undocumented. **Move up**: `ui/episode-label.ts` (one helper with two variants), with keys `episode.short.season` / `episode.short.episode` if the owner wants them translated (context notes + 20 translations).

### D8. Service-worker call with the "unreachable" fallback

`try { await sendMessage(...) } catch { log.error(...); return { ok: false, code: 'NETWORK', message: t('popup.swUnreachable') } }` is hand-written in:

- `ui/accounts.ts`;
- `ui/media-action-requests.ts`;
- `ui/page-media-controller.ts`;
- `popup/popup.ts` (`reviewActions`);
- `popup/controllers/{watching,queue,ratings,compare}.ts`;
- `agenda.ts`, which uses `error.unexpected` instead, an inconsistent message.

**Move up**: `ui/worker-call.ts` › `callWorker(type, payload, fallback: (message) => MessageResponse<T>)`.

### D9. Same message, two payload builders

`SET_LIST_STATUS` is built in `popup/controllers/watching.ts` › `setStatus` (cover via `toSafeImageUrl`, l. 364) and again in `ui/media-action-requests.ts` › `send` (ad-hoc `startsWith('https://') && length <= 2000`, l. 53–57). The second check passes https covers from hosts outside `IMAGE_HOSTS`; `background/message-guards.ts` l. 122 (`isSafeImageUrl`) then rejects the **whole** message, so the status change fails. AniList covers are always on allowed hosts today, so this cannot happen yet. Fix: use `toSafeImageUrl` (S). The `mediaRef` builder (`title.slice(0, 300)`) also exists twice (`watching.ts` l. 289 and `media-action-requests.ts` l. 59–63) → export one `mediaRefOf(...)`.

---

## 2. State management

### 2.1 How each screen holds state today

| Screen | Holder | Re-render | Subscriptions |
|---|---|---|---|
| Popup (`popup/popup.ts`) | ~15 `Store<T>` (`ui/state.ts` › `createStore`), from the module itself (`uiStore`, `syncStore`, `settingsStore`, `pageCardStore`, `hostAccessStore`, `platformAccessStore`…) and from controllers (`watching`, `queue`, `ratings`, `compare`, `accounts`) | `createRenderScheduler(render)` (microtask), then per-region `createLocaleMemo()` + `replaceChildren` in `preserveFocus`. `focusInWatching` calls `renderer.flush()` before moving focus | 1 `storage.onChanged` in `popup.ts` + 1 per controller (4) + `accounts` + `page-media-controller`; `permissions.*` ×2 owners; `onLocaleChange` ×2; 60 s `setInterval` |
| Settings view (`ui/settings/settings-view.ts`) | Mutable `data: SettingsData` bag + `nav` reducer (`navigation.ts`, pure, tested) | Imperative `redraw(pages?)` with hand-maintained dependency lists (`redraw(['home','accounts','sync'])`, l. 158/167/177/195/201/375/392) | Own `storage.onChanged`, `permissions.*`, `onLocaleChange`, `window.focus`, 60 s `setInterval`; subscribes to `host.accounts` stores |
| Side panel shell (`sidepanel/sidepanel.ts`) | Module-level `let` (`context`, `selected`, `autoSelected`, `settingsOpen`, `optionalPlatforms`) | `render()` called **synchronously** from every mutator and from `createNowPlaying(() => render())`; no scheduler, no memo; the tab bar and tab content are rebuilt on each call | `permissions.*`, `onLocaleChange`, `watchPanelContext` |
| Now playing (`now-playing.ts` + `now-playing-controller.ts`) | Closures (`menu`, `shownMediaId`) + page-media-controller getters + `expanded` property | `onChange()` → shell `render()` (synchronous, so `focusPanel()` right after works by accident of timing) | Own `storage.onChanged` (settings), live port |
| Agenda (`agenda.ts`) | Closures (`status`, `settings`, `series`, `menuFor`, `editing`…) | `draw()` = full `replaceChildren` in `preserveFocus` | Own `storage.onChanged`, midnight timer |
| Import (`import/import.ts`) | Immutable `state` + `setState` | Full `draw()` | `onLocaleChange` |
| Import history (`import-cr/import-cr.ts`) | One mutable `state: PageState` object, mutated anywhere (`state.selected.add`…) + module `let port/netflixRun/pollTimer/tickTimer` | Full `draw()` (`replaceChildren`) on every port progress message | `storage.onChanged`, `visibilitychange`, `pagehide`, `onLocaleChange` |
| Review cards (`popup/components/review-card.ts`, `review-section.ts`) | Stateful components reconciled by key | Own `draw()` | none |

### 2.2 Inconsistencies that cost something

1. **Four render disciplines**:
   - microtask-scheduled with memo (popup);
   - imperative partial redraw lists (settings);
   - synchronous full rebuild (panel);
   - full page redraw (imports).
   
   Focus code depends on the discipline: the popup must `flush()`, the panel relies on synchronous `onChange`, and the agenda calls `.focus()` after `draw()`. Moving a component from one host to another (the stated rule for `ui/`) silently breaks focus.
2. **The same fact read in many places**: settings in the popup, settings view, `now-playing-controller`, agenda (on every load) and import (`getSettings()` on demand); optional access (see D6); "connected" from three sources (the accounts store in popup and settings, `hasValidAniListToken` / `hasMalToken` in the agenda, raw token presence in import-cr l. 171).
3. **Settings dependency lists are manual** (`redraw([...])`). A page that starts reading a new field must remember to be added to the lists at l. 375 / 392.
4. **Side effects inside render functions**: `now-playing.ts` › `renderProgress` calls `followMedia()` (resets the menu and the notes draft), and `popup.ts` › `pageNotesFor` resets the editor while rendering. It works because the renders are deterministic, but any memoised re-render would skip the reset.
5. **Messages stored as translated text** in UI state, so they keep the old language after a locale change:
   - `syncStore.recentError`;
   - `import-cr` `state.error` / `state.notice` / `step.error`;
   - settings `mappingsError`;
   - feedback texts.
   
   `page-media-controller` special-cases only `error` / `not-found`.

### 2.3 Proposed pattern: per-page context + controller/view split + region memo

This keeps the existing primitives (`createStore`, `createMemo`, `createRenderScheduler`, `preserveFocus`). It adds no framework, only three small modules.

```ts
// ui/page-context.ts : ONE per page (popup, panel, import pages), created at boot
export interface PageContext {
  readonly locale: Store<Locale>;                                   // fed by onLocaleChange
  readonly clock: Store<number>;                                    // minute tick (popup, settings, agenda midnight)
  readonly settings: Store<SettingsState>;                          // getSettings + storage.onChanged(SETTINGS_STORAGE_KEY)
  readonly platformAccess: Store<readonly StreamingPlatform[] | undefined>; // permissions.onAdded/onRemoved, once
  accounts(): AccountsController;                                   // lazy (panel creates it on first Settings open)
}
export function createPageContext(): PageContext;

// ui/screen.ts : one scheduler per page, with post-render effects (replaces flush-then-querySelector)
export interface Screen {
  schedule(): void;
  flush(): void;
  /** Runs after the next render (focus moves, scrollIntoView) */
  afterRender(effect: () => void): void;
  watch(...stores: Store<unknown>[]): void;  // subscribe → schedule
}
export function createScreen(render: () => void): Screen;

// ui/region.ts : memoised slot (generalises popup's createLocaleMemo + replaceChildren + preserveFocus)
export function createRegion(slot: HTMLElement): (inputs: readonly unknown[], draw: () => Child | Child[]) => void;
```

Screen recipe:

- **Controller** (`createXController(deps)` → `{ stores…, actions…, dispose() }`): no DOM, unit-testable with the fake chrome of `src/test/setup.ts`. The popup controllers and `page-media-controller` already follow it.
- **View functions**: `renderX(props): Node`, pure, no side effects. Resets such as `followMedia` move into the controller's `onPageChange` / `onContent`.
- **Shell**: one `Screen`; one `createRegion` per slot; focus moves only through `screen.afterRender`.

Example (panel menu, behaviour unchanged):

```ts
const menu = createStore({ open: false, confirming: false });
screen.watch(menu);
function setMenu(open: boolean, restoreFocus = true): void {
  if (menu.get().open === open) return;
  menu.set({ open, confirming: false });
  menuDismiss.setOpen(open);
  screen.afterRender(() => focusKey(root, open ? 'REMOVE-panel' : restoreFocus ? 'more-panel' : null));
}
```

### 2.4 Migration steps (behaviour kept identical; run the listed tests after each)

1. **Add** `ui/page-context.ts`, `ui/screen.ts` and `ui/region.ts` with unit tests (fake `chrome.storage.onChanged` / `permissions.onAdded`). No consumers yet. Tests: new unit tests.
2. **Popup** (already store-based, mechanical):
   - replace `settingsStore`, `platformAccessStore`, the `permissions` listeners, `createLocaleMemo` and the clock `setInterval` with `ctx.*`;
   - replace `renderer` with `createScreen` and the `focusInWatching` / `flush` calls with `afterRender`.
   
   Tests: `popup.e2e` (all), `lists.ext`, `panel.ext` › "Clavier", `test:i18n-layout`.
3. **Settings view**:
   - `SettingsHost` receives `ctx`; drop its own `getSettings` / settings echo listener / `permissions` listeners;
   - `SettingsData.settings` becomes a read of `ctx.settings`, and the three access booleans become `ctx.platformAccess`;
   - replace the `redraw([...])` lists with one region per page, memoised on the inputs it reads;
   - keep `update()`, but write through a locked `saveSettingsPatch(patch)` (`withStorageLock`, re-read then merge), which fixes §4 R4.
   
   Tests: `popup.e2e` (Settings › Notifications / Sync / Netflix / Disney+ / Prime / Shortcuts / Help), `sidepanel.e2e` › shortcuts, `ui/settings/*.test.ts`.
4. **Side panel shell**:
   - move the module `let`s into a `Store<PanelShellState>`;
   - give `createNowPlaying` the `Screen` instead of `() => render()`;
   - convert `focusPanel` / `setConfirm` focus calls to `afterRender`;
   - one region each for the header, tab bar and tab panel (memo on `selected`, `context.status`, now-playing content/actions, locale).
   
   This is the highest-risk step, because every focus move after `onChange` today relies on a synchronous render. Tests: `sidepanel.e2e` (all, UI-01..05), `panel.ext`, `lists.ext` (panel notes and remove), `test:i18n-layout` (panel 360 / 320).
5. **Agenda and now-playing controller**: consume `ctx.settings` / `ctx.platformAccess` / `ctx.clock` instead of their own listeners and `getSettings()` per load. Keep `decideAgendaLoad` unchanged. Tests: `agenda-load.test`, `sidepanel.e2e` UI-03 / UI-05, `panel.ext` › Agenda.
6. **Import pages** (optional, lowest value): wrap `state` in a store, keep full redraws (they are simple pages), add `bootPage()`. Tests: `import-cr.e2e`, `import.ext`.
7. **Messages as thunks** (incremental): UI-produced messages stored as `() => string` (or `{ key, params }`) instead of text, rendered at draw time; service-worker texts stay as today. Tests: `popup.e2e` › locale change.

---

## 3. Large modules and functions to split

| Module (lines) | Hot spots | Proposed split | Tests |
|---|---|---|---|
| `src/popup/popup.ts` (855) | `render()` ~90 lines touching 10 slots; `renderWatching()` builds a 30-field props object; menu orchestration l. 218–371; page card l. 706–777; activity actions l. 667–704 / 779–808; `footerStatus` / `footerChips` (pure but untested) | `popup/layout.ts` (slots + `render`), `popup/watching-menus.ts` (sort / row menu + confirm + notes focus, on top of D2's `createMenuState`), `popup/page-card.ts` (`activeTab`, `pageCtl`, `startPageMedia`, page notes, `setPageConfirm`), `popup/activity.ts` (`reviewActions`, `handleCorrect`, `excludeRecent`, `isRecentExcluded`, `loadSyncData`), `popup/footer-status.ts` (pure, unit-tested) | `popup.e2e`, `lists.ext`, `import.ext` (backup from popup) |
| `src/import-cr/import-cr.ts` (1174) | `readNetflix` ~95 lines; `renderPreview` ~105; `renderConnect` ~80; transport, Netflix driving, state and views in one module | `import-cr/sources.ts` (`SOURCES`, access), `import-cr/port-reader.ts` (`startReading` / `readEvent` / `stopReading`), `import-cr/netflix-reader.ts` (`readNetflix`, `checkTitles`, `loadNetflixShow`: pure apart from the `NetflixTab` handle, so unit-testable), `import-cr/views/{connect,reading,job,preview}.ts`, `import-cr/state.ts` | `import-cr.e2e` (CR, ADN, Netflix, Stop), `import.ext` |
| `src/popup/components/watching-screen.ts` (746) | `renderRowMenu` ~105 lines; hero and row share 70 % of their logic | `watching-row-menu.ts` (on D2 primitives), `watching-entry.ts` (cover / title / progress bar / chips shared by hero and row), `watching-empty.ts` | `popup.e2e` menus, +1, empty state |
| `src/sidepanel/components/agenda.ts` (718) | `loadWeek` ~80 lines; `renderTimes` uses a NUL-marker split of a translated string; editor and menu inline | `agenda-controller.ts` (load, cache, in-flight, `lastFetch` / `lastError`: testable), `agenda-row.ts`, `agenda-editor.ts`, `agenda-times.ts` | `agenda-load.test`, `sidepanel.e2e` UI-03 / UI-05, `panel.ext` › Agenda, `lists.ext` (agenda links) |
| `src/sidepanel/components/now-playing.ts` (490) | One 410-line closure: hero, progress, synopsis, discussion, relations, menu, notes | `now-playing/hero.ts`, `now-playing/relations.ts`, `now-playing/synopsis.ts`, `now-playing/discussion.ts` (pure views); menu and notes → D1 / D2 helpers | `sidepanel.e2e`, `now-playing-view.test`, `lists.ext` |
| `src/ui/page-media-controller.ts` (572) | Well covered (782-line test). Extractable pure pieces: auto-redetect limiter (`autoRedetect` / `resetAutoRedetect` / `navigated`, l. 226–257 + 545–549) and own-writes echo filter (`ownWrite`, l. 217–223) | `ui/rate-limiter.ts` (`createAutoLimiter({ minIntervalMs, maxPerMinute })`), `ui/own-writes.ts`. Keep the core as is | `page-media-controller.test` (plafond, anti-écho suites) |
| `src/ui/settings/settings-view.ts` (430) | Loaders (l. 136–227) mixed with shell and nav | `settings-data.ts` (loaders → stores, step 3 of §2.4) | `ui/settings/*.test.ts`, `popup.e2e` settings |

---

## 4. Robustness

### Accessibility (clearly broken)

- **A1. Agenda "⋯" menu has no menu keyboard model** (`agenda.ts` l. 492–559), unlike the other three menus:
  - the trigger has `aria-haspopup="menu"` but no `aria-controls`, and opening does not move focus into the menu;
  - items are `role="menuitem"` without `tabindex="-1"` and without `onMenuKeyDown`, so arrow keys and Home / End do nothing and the items sit in the Tab order;
  - Escape works only with focus inside the menu; Tab does not close it.
  
  Fix with the D2 primitives (S). No test today.
- **A2. Agenda delay editor: Cancel / Escape send focus to the next series.** `editing = null; draw()` removes the focused input. `preserveFocus` has no `data-focus-fallback` and falls back to the next `data-focus` in the old DOM order, which is the next row's `agenda-entry-*` title link, not this row's `agenda-menu-${id}`. On save success the code does focus the trigger explicitly (l. 591), so the two paths disagree. Fix: `data-focus-fallback: agenda-menu-${scheduleId}` on the editor container (S). Confirmed by code reading (`ui/dom.ts` › `pickFocusKey`), not run.
- **A3. Recreated live regions, UNVERIFIED** (depends on the screen reader). 39 `role="status"` elements, plus the `aria-live` stepper value (`media-actions.ts` l. 173) and the agenda week heading (l. 299), are re-created on every render. A newly inserted live region is often not announced, so after "+1" the new progress may stay silent, especially in the panel, which rebuilds everything. Alerts already use one persistent region (`ui/live-region.ts`); the same pattern for status messages (`statusAttrs(message)` → one polite region per page) would make it consistent (M).

### Races and timers

- **R1. Import page connect retry not cancelled** (`import-cr.ts` l. 371–373). After an unanswered port, `setTimeout(startReading(tabId, attempt + 1), 1–3 s)` is not stored. If the user clicks Stop then Read on the same tab within that window, the timer's guard (`state.step.kind === 'reading' && tabId` matches) passes and a second port opens. The first port is neither disconnected nor tracked, so the content script reads the history twice. Fix: keep the timer handle and clear it in `backToConnect` / `stopReading` (S).
- **R2. Concurrent permission re-reads, last-resolved wins**: `popup.ts` › `checkHostAccess` (two awaits), `sidepanel.ts` › `refreshOptionalPlatforms`, `settings-view.ts` › `loadPlatformAccess`. An `onAdded` + `onRemoved` pair, or boot + event, can apply the older answer last. Harmless in practice; D6's single store with a run counter removes it.
- **R3. Agenda across a week boundary**: the midnight timer redraws, but `range` stays on the previous week, so a panel left open on Monday shows last week without "today". Low (S).
- **R4. Settings write without lock, UNVERIFIED impact**. `settings-view.ts` › `update()` (l. 136–148) saves its in-memory copy of the whole settings object. The other writers (`agenda-store.ts` › `saveSeriesOffset`, `netflix-access.ts` l. 33) do a locked read-modify-write. A write landing between another writer's save and its echo is overwritten; two quick toggles also flash the first echo back before the second (the echo comparison at l. 372 overwrites `data.settings`). Fix: locked `saveSettingsPatch` (S).
- **R5. Side panel background work**: `setContext` always forwards the followed tab to `nowPlaying`, so resolutions and `GET_PANEL_MEDIA` run while the Agenda tab is shown, and each `onChange` rebuilds the tab panel (including re-attaching the agenda element and re-creating the banner `<img>`). This works today thanks to `preserveFocus`. It is wasted work and a source of flicker (UNVERIFIED visually) that §2.4 step 4 removes.
- **R6. Global listeners without dispose**: `page-media-controller`, `accounts`, `settings-view`, `now-playing-controller` and `agenda` register `chrome.*` / `window` listeners that are never removed. Today each is created once per page, so nothing leaks. They will leak as soon as a host creates two instances (for example a re-created Settings view). Expose `dispose()`, as `popup/controllers/watching.ts` already does, when adopting §2.3.

### Locale and permission changes

- A locale change re-requests only `error` / `not-found` page cards (documented). Locally produced texts kept in state stay in the old language: import-cr `step.error` / `notice`, popup `recentError`, settings `mappingsError` (see §2.4 step 7).
- Firefox (UNVERIFIED): when Crunchyroll / ADN host access is withdrawn, the popup shows "Allow access" (`host-access-banner.ts`). The panel's `presence.ts` sees a hidden URL and an unreachable script and shows the generic off-target line, with no way to re-grant access.

### Architecture nits with a cost

- `popup/controllers/watching.ts` l. 21 imports `entryKey` from `../components/watching-screen` (controller → view). Move `entryKey` to `popup/state.ts` or `shared/watching.ts` (S).
- `sidepanel.ts` l. 26–35 / 192–198: the "soon" branch is unreachable (`PanelTab` = `'nowPlaying' | 'agenda'`). It keeps `panel.soon`, `panel.nowPlaying.soon` and `panel.agenda.soon` alive in 21 catalogs plus `docs/i18n/context.json` (S, also delete the keys).
- Placeholder-splitting hacks: `watching-screen.ts` l. 605 (`t('watching.tip').split('{path}')`), `agenda.ts` l. 430–431 (`'\u0000'` marker), `import-cr.ts` l. 902 (`t('common.labelValue', { label }).split('{value}')`). All work today with the 21 catalogs (checked: `{label}` always precedes `{value}`). → one `tSlots(key, params, slots): (string | Node)[]` helper in `i18n/core.ts`, with a test over all catalogs (S).
- `agenda.ts` l. 389: `label.charAt(0).toUpperCase()` is locale-insensitive, while `lowerFirst` uses `toLocaleLowerCase(locale)`. Add `upperFirst(locale)` for symmetry (S).

---

## 5. Test map per area

| Area | Unit | e2e (`scripts/e2e`) | Real extension (`scripts/ext-e2e`) | Layout |
|---|---|---|---|---|
| Page media controller (shared) | `ui/page-media-controller.test.ts` (states, season, anti-echo, auto-redetect cap, late answers, UI-01 / 02, access removed, SPA) | `popup.e2e` "Sur cette page" ×5, `sidepanel.e2e` UI-01 / UI-02 | `panel.ext` (slow load, +1 then SPA, autoplay, season pick) | — |
| Media actions / feedback | `ui/media-actions.test.ts`, `ui/feedback.test.ts`, `ui/rating.test.ts` | `popup.e2e` +1 / partial retry / keyboard, page card add / controls | `sync.ext`, `lists.ext` | popup, panel |
| Menus / confirm / remove / notes | `ui/menu.test.ts`, `ui/dom.test.ts` (`pickFocusKey`) | `popup.e2e` "menu ⋯" ×3, `sidepanel.e2e` remove + notes | `lists.ext` (remove, notes popup / panel) | — |
| Popup controllers | `popup/controllers/{watching,queue,ratings,compare}.test.ts` | `popup.e2e` GET_WATCHING timeouts, compare, pause tick | `accounts.ext`, `sync.ext` | popup |
| Popup shell (`popup.ts`) | none | `popup.e2e` navigation, locale change, host-access banner, panel button | `lists.ext`, `panel.ext` › Clavier | popup (all locales) |
| Settings view and pages | `ui/settings/{navigation,summary,page-accounts,page-language,page-shortcuts}.test.ts`, `ui/shortcut-settings.test.ts` | `popup.e2e` Settings (notifications, sync platform toggles, shortcuts, help, backup, import buttons), `sidepanel.e2e` shortcuts | `import.ext` › Sauvegarde | popup settings, panel settings |
| Side panel shell / presence / toggle | `sidepanel/{tabs,presence,toggle}.test.ts` | `sidepanel.e2e` off-target, UX-05 | `panel.ext` | panel 360 / 320 |
| Now playing / live | `sidepanel/{now-playing-view,live-view}.test.ts` | `sidepanel.e2e` entry links, notes | `panel.ext`, `playback.ext` (live port), `lists.ext` | panel |
| Agenda | `sidepanel/agenda-load.test.ts` | `sidepanel.e2e` UI-03, UI-05 | `panel.ext` › Agenda, `lists.ext` (agenda links) | panel |
| Import history | none | `import-cr.e2e` (CR, ADN, Netflix, Stop, UX-07) | `import.ext` (network cut, resume, ADN 401) | import page |
| Backup page | none | `popup.e2e` BAK-05 | `import.ext` › Sauvegarde | — |
| Accounts | `ui/accounts.test.ts` | `popup.e2e` UI-04 | `accounts.ext` | — |

**Gaps to fill before refactoring**:

1. Agenda menu keyboard and editor Cancel / Escape focus (A1, A2).
2. A unit test for `media-action-requests` › `send` cover handling (D9).
3. Import-cr Stop → Read within the retry window (R1).
4. Unit tests for `now-playing-controller.ts` and `footerStatus` once extracted.
5. A settings-view test for concurrent `update()` calls (R4).
