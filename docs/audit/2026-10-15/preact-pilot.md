# Preact pilot: evaluation (decision 12)

Decision support for `0-synthese.md` › §3 decision 12 and §6 (f), against the criteria set there: weight per page, `test:i18n-layout`, focus / aria, end-to-end tests unchanged, never in content scripts. Measured on 2026-10-16, Windows 11 (owner's PC), Node 24.20, branch `feature/ui-preact-pilot` rebased onto `develop` `26c94fb`. Items not measured are marked **UNVERIFIED**.

## 1. What the pilot changes

Scope: *Settings › Shortcuts* only (3 commits, 17 files, +551 / −156 lines, about half of it tests and lockfile).

| Area | Change |
|---|---|
| Dependencies | `preact` 11.0.0 (only runtime dependency of the project, exact pin); `happy-dom` 20.14.5 (dev, DOM for component tests, opted in per file) |
| Build | `tsconfig.json`: `jsx: react-jsx`, `jsxImportSource: preact` (read by Vite 8 and Vitest, no plugin); ESLint and Vitest include `.tsx`, same typed rules |
| Page | `ui/settings/page-shortcuts.tsx` (149 lines, was 115 in `page-shortcuts.ts`): function components, same DOM, classes, texts, roles, ids and `data-focus` keys as the `h()` version; `ui/settings/rows-card.tsx` (`RowsCard`, shares `ROWS_CARD` with `rowsCard()`); `ui/preact/hooks.ts` (`useStore` on `ui/state.ts` stores, `useLocale`; no `preact/compat`) |
| Settings view | `SettingsPageView` = `SettingsDomPage` (`render()`) or `SettingsMountedPage` (`mount(container)` → unmount); the view mounts a Preact page once per visit and unmounts it when another page is shown or when the view is disposed. Shortcut keys moved from `SettingsData` to a `ReadonlyStore<ShortcutKeys>` the page subscribes to, so a key re-read only redraws the home summary |
| Tests | `page-shortcuts-view.test.tsx` (5 tests, happy-dom: structure, in-place update keeps the focused node, locale change, manual-steps notice, mount / unmount releases subscriptions); import graph reads `.tsx`; architecture rule: no `.tsx` module and no `preact` import reachable from `src/content/` (type imports included) |

### Rebase onto `develop` (85 commits)

| Commit | Conflicts | Resolution |
|---|---|---|
| `build: add Preact 11 and TSX support` | none (`package-lock.json` merged automatically) | — |
| `feat(ui): render Settings > Shortcuts with Preact` | `context.ts`, `settings-view.ts` | `develop` replaced the three `netflixAccess` / `disneyAccess` / `primeAccess` fields and `grantedPlatforms()` by `platformAccess` (store of the host, 4-D6): kept, with the pilot's `ShortcutKeys` split on top. `develop` added `dispose()` (4-R6): it now also unmounts a mounted Preact page, otherwise its store and locale subscriptions would outlive a re-created view |
| `test: follow TSX modules in the import graph` | `architecture.test.ts`, `import-graph.ts` | kept every rule added on `develop` (MAIN bridges, tokens, content → `ui/` allow-list, frozen `shared/` → `browser/` links, listener freeze, `vi.mock` integrity) and added the Preact rule; `resolveImport` stays exported and also resolves `.tsx`; the architecture test's `isTestFile` also treats `.test.tsx` as a test |

## 2. Verification

| Check | `develop` `26c94fb` | Pilot |
|---|---|---|
| `npm run verify` (types, unit tests, Chrome and Firefox builds, `verify:build`, `web-ext lint`, ESLint) | green | green: 227 files, 3168 tests passed, 1 expected fail, 5 todo; ESLint 0 errors (same 12 `max-lines-per-function` warnings) |
| `npm run test:e2e` | green | green, 62 / 62, **no e2e test changed** |
| `npm run test:i18n-layout` (21 locales × 25 screens, `popup-settings-shortcuts` included) | 0 findings (1 allowlisted, 13 ignored) | 0 findings (1 allowlisted, 13 ignored) |
| `test:ext` (real Chromium, Chrome for Testing 155, real CSP) | not run | 41 / 41 green, plus a throwaway scenario opening *Shortcuts* in the popup and in the panel: no CSP violation (`expectCleanRun`) |
| `web-ext lint` (Firefox package) | 0 errors, 0 warnings | 0 errors, **1 warning** (see §4.3) |

## 3. Measurements

### 3.1 Content scripts and service worker: unchanged (proof)

`node scripts/dist-fingerprint.ts` (build stamp and chunk names normalized, every other byte compared), develop vs pilot, on both targets:

```
✖ chrome : différent
  - assets/CHUNK.js 05835f5e6f94 77593 o
  + assets/CHUNK.js 48455386e291 91566 o
✖ firefox : différent
  - assets/CHUNK.js 45c73dd5a36a 77599 o
  + assets/CHUNK.js e7f4370cedb2 91576 o
```

One file differs per target: the settings chunk (`assets/settings-view-*.js` on Chrome, named `assets/page-media-controller-*.js` on Firefox). The 10 manifest / registered scripts (`content-*.iife.js`, the 4 `page-bridge.iife.js`, `history.iife.js`), the service worker and its chunks, the CSS, HTML, manifest and catalogs are identical. The architecture test keeps it that way (no `.tsx` / `preact` reachable from `src/content/`).

### 3.2 Per page (Chrome production build)

Closure of the static imports of each page (`<script>` + `modulepreload`), sizes in bytes. gzip = sum of each chunk at level 9 (what is read from the package is uncompressed; gzip / brotli are given for comparison with web bundles).

| Page | develop raw | pilot raw | Δ raw | develop gzip | pilot gzip | Δ gzip | Δ brotli |
|---|---:|---:|---:|---:|---:|---:|---:|
| Popup | 337 381 | 351 354 | **+13 973 (+4.1 %)** | 108 443 | 114 422 | **+5 979 (+5.5 %)** | +5 441 |
| Side panel | 294 893 | 308 866 | **+13 973 (+4.7 %)** | 97 550 | 103 528 | **+5 978 (+6.1 %)** | +5 308 |
| Backup (`import.html`) | 143 009 | 143 009 | 0 | 47 773 | 47 773 | 0 | 0 |
| History import (`import-cr.html`) | 185 575 | 185 575 | 0 | 62 852 | 62 852 | 0 | 0 |
| Service worker | 338 234 | 338 234 | 0 | 108 920 | 108 920 | 0 | 0 |
| Content scripts | identical | identical | 0 | | | | |

Firefox: popup +13 977 raw / +6 172 gzip, panel +13 977 / +6 173, the other pages identical.

Settings chunk alone: 77 744 → 91 717 bytes (+18 %), gzip 23 342 → 29 321. Preact's runtime (`render`, `h`, hooks, `jsx-runtime`) bundled alone with the same minifier (rolldown 1.2.13): **13 319 bytes, 5 579 gzip**. So the Shortcuts page itself costs about +0.65 KB raw over its `h()` version (components, `hooks.ts`, `RowsCard`); the rest is the one-time runtime.

The settings chunk is a `modulepreload` of both the popup and the panel (both create the Settings view on demand, but import `settings-view.ts` statically), so the runtime is on their initial load path even when Settings is never opened. Loading the Settings view with a dynamic `import()` (allowed in pages, only the service worker forbids it) would take it off that path; UNVERIFIED (not tried).

### 3.3 Package

| | develop | pilot | Δ |
|---|---:|---:|---:|
| Chrome package, all files | 2 592 236 | 2 606 209 | +13 973 (+0.54 %) |
| Chrome JS | 947 600 | 961 573 | +13 973 |
| Chrome JS gzip (sum) | 317 201 | 323 179 | +5 978 |
| Firefox package, all files | 2 591 374 | 2 605 351 | +13 977 |

Store zip sizes: UNVERIFIED (`npm run package` not run).

### 3.4 Timing

| Measure | develop | pilot | Note |
|---|---:|---:|---|
| Click on the *Shortcuts* row → keys rendered (40 runs, in page) | median 0.4 ms, max 0.5 | median 0.4 ms, max 0.6 | e2e harness (Vite dev server, mocked `chrome`); Preact `render()` is synchronous on mount |
| Popup frame load to `footer` (6 runs) | 85–456 ms | 110–465 ms | same harness; first run is cold, noise dominates: no difference measurable |
| Preact runtime compile + evaluate, fresh page, no code cache (25 runs) | — | median 1.1 ms (1.0–1.7) | headless Chrome on this PC |

Popup first paint from the production package (real extension, code cache): UNVERIFIED (no timing harness for built pages). Expected cost: about 1 ms of evaluation plus 13 KB more to read from disk.

### 3.5 Focus and accessibility (Shortcuts page, popup, French)

Throwaway probe in the e2e harness, identical script on both builds:

| Behaviour | develop (vanilla, `preserveFocus`) | pilot (Preact) |
|---|---|---|
| Rendered HTML of the page | — | **byte-identical** to develop |
| Focus on opening | `h1` `settings-heading` | same |
| Tab order from the heading | `shortcut` → `panel-shortcut` → AniList chip → MAL chip → body → gear | same |
| Shift+Tab | same reverse order | same |
| Keys re-read (window `focus`) while `panel-shortcut` is focused | focus restored on a **new** button with the same `data-focus` | focus stays on the **same** node (no re-render of the row structure) |
| Language changed by another view while focused | focus restored on a new node, text « Change » | same node keeps focus, text « Change » |
| Escape | back to home, focus on `settings-cat-shortcuts` | same |
| `aria-label`, `aria-describedby`, `role="status"` notice | present | same (unit and e2e tests) |

Screen-reader behaviour (announcements): UNVERIFIED.

## 4. Risks

### 4.1 Bundle weight per page

A one-time 13.3 KB raw / 5.6 KB gzip per page that loads Preact (one shared chunk; popup and panel today). For the import pages (143 KB and 186 KB today) it would be +9 % and +7 % raw once migrated. Components should not be larger than the `h()` code they replace (pilot: +0.65 KB for 34 more source lines, mostly typed props); a full migration being size-neutral beyond the runtime is a projection, UNVERIFIED. `preact/compat` must stay out (about +4 KB gzip and it patches Preact globally): `hooks.ts` already avoids `useSyncExternalStore` for that reason.

### 4.2 Content scripts

Nil today, guarded by two tests: the content → `ui/` allow-list (only `ui/{rating,star-rating,kai-small,svg}.ts`) and the new rule (no `.tsx`, no `preact`, type imports included). Consequence for a migration: `ui/rating.ts` and `ui/star-rating.ts` are shared with content scripts and must stay vanilla; pages would wrap them in a small ref-mount component.

### 4.3 CSP and store review

- The built chunk contains no `eval`, `new Function` or `Function(` (searched in the pilot's settings chunk). Preact writes styles through the CSSOM (`style.setProperty`, `style.cssText`), which `default-src 'self'` (no `style-src 'unsafe-inline'`) does not block; the pilot sets no style at all. Real Chromium with the new strict CSP: no violation in `csp.ext` nor when opening *Shortcuts* in popup and panel. Firefox at runtime: UNVERIFIED (built and linted only).
- `web-ext lint` now reports `UNSAFE_VAR_ASSIGNMENT` (« Unsafe assignment to innerHTML ») in the Firefox settings chunk: Preact's `dangerouslySetInnerHTML` code path, unused by SyncKai. A warning, not an error (`lint:firefox` and `release.yml` still pass), but AMO reviewers see it. The ESLint rule that forbids `innerHTML` in shipped code (`SHIPPED_CODE_RESTRICTIONS`) matches member expressions only and would not catch a JSX `dangerouslySetInnerHTML` attribute: add `JSXAttribute[name.name="dangerouslySetInnerHTML"]` to it before adopting, and mention the library in the AMO review notes (kept short: 2.2.0 was rejected for long notes).
- Supply chain: first runtime dependency (exact pin, lockfile, `npm ci`). Preact 11's release maturity and changelog: UNVERIFIED (not checked online in this session).

### 4.4 Render timing

Measured costs are about 1 ms of evaluation and sub-millisecond mounts; nothing measurable in the harness. The popup's real first paint is UNVERIFIED (§3.4). The cost can be removed from the popup's critical path by lazy-loading Settings (§3.2).

### 4.5 i18n and the `preserveFocus` contract

- Locale: `useLocale()` re-renders the component on `onLocaleChange`; `t()` reads the active locale at render, as in the vanilla pages. Equivalent to the vanilla « redraw on locale change », with in-place updates.
- Focus: Preact's keyed diffing keeps nodes, so a re-render no longer destroys the focused element; `preserveFocus` is not needed for updates. What has no automatic equivalent is the fallback when the focused node itself disappears (`data-focus-fallback`, neighbour search in `ui/dom.ts` › `pickFocusKey`): a migrated screen must move focus explicitly (ref + effect) where an element is removed (4-A2, the Agenda delay editor, is exactly that case). A small `useFocusFallback` hook would be needed; not written.
- Mixed screens during a migration: the Settings view now has two page kinds and must unmount Preact pages on navigation and dispose (done). Every host that mixes both needs the same care; a forgotten `render(null, container)` leaks subscriptions (the R6 class of bug).
- Texts stored already translated (4-§2.4 step 7, `{ key, params }`) are not solved by Preact; they still need the planned change.

### 4.6 Test tooling

Works without new runners: Vitest compiles TSX from `tsconfig.json`, component tests opt into happy-dom per file (`// @vitest-environment happy-dom`), `preact/test-utils` `act()` flushes effects; the e2e and `test:ext` suites drive the real DOM and stayed unchanged; the import-graph, boundary and `vi.mock` integrity tests read `.tsx`; coverage includes `.tsx`. One more dev dependency (happy-dom 20.14.5, plus 5 transitive packages). The screenshot / e2e harness (Vite dev server) transforms TSX without configuration.

## 5. Estimated migration effort

Rough sizes (non-test source lines, `develop` `26c94fb`) and an estimate in focused working days for a subagent plus the owner's manual pass (popup and panel, Chrome and Firefox). The controllers (`popup/controllers/`, `agenda-controller.ts`, `now-playing-controller.ts`, `page-media-controller.ts`, `accounts.ts`, `platform-access-store.ts`) are already stores or render-free (f1 / f3) and are kept as is, read through `useStore`. Estimates, not measurements.

| Screen | Size today | What changes | Effort | Gain |
|---|---:|---|---|---|
| Settings, other 7 pages + shell (`ui/settings/`) | ≈ 2 300 lines (`settings-view` 420, `page-data` 328, `page-sync` 268, `page-notifications` 247, `rows` 238, `page-language` 171, `match-diagnostic` 170, `debug-trace` 163, `page-help` 154, `page-accounts` 149) | rows kit → components (`ToggleRow`, `ChoiceRow`, `CollapsibleSection`), one page at a time; the shell last; `notifications.drawAiring` partial redraw becomes state | M, 3–4 d | removes the `redraw(pages)` lists, simpler focus |
| Backup (`src/import/`) | ≈ 370 | one page | S, 0.5–1 d | small; adds the runtime to that page (+9 %) |
| History import views (`src/import-cr/import-cr.ts`) | ≈ 770 (+ state 66, sources unchanged) | split by step while migrating | M, 2–3 d | step views as components; `step.error` still needs `{ key, params }` |
| Agenda (`sidepanel/components/agenda.ts`) | ≈ 490 | full `draw()` → components; delay editor focus | M, 2 d | fixes 4-A2 by construction (explicit focus on close) |
| Now playing + « On this page » (`now-playing.ts` 457, `live-progress.ts` 235, `ui/media-actions.ts` 272, `page-media-view.ts` 109, `menu.ts`, `notes-editor.ts` 230) | ≈ 1 400 shared | one card component for D1, menu component (4-A1), persistent live region (4-A3) | L, 3–5 d | the D1…D5 duplications become components |
| Side panel shell (`sidepanel.ts` 306, `presence.ts`, `tabs.ts`, `toggle.ts`) | ≈ 520 | tabs and followed-tab context; must keep the synchronous `sidePanel.open()` gesture path out of any render | M, 2 d, riskiest (audit step 4) | fixes 4-R5 (no rebuild of the tab panel on each context change) |
| Popup shell and screens (`popup.ts` 745, `popup/components/` ≈ 2 260: `watching-screen` 697, `compare-section` 367, `review-card` 349…) | ≈ 3 000 | split the large views while migrating; `createRenderScheduler` / `createLocaleMemo` / `preserveFocus` regions disappear | L, 5–7 d | largest simplification, largest manual-test surface |
| Shared kit (`kit.ts`, `feedback.ts`, `alert.ts`, `dom.ts`) | ≈ 760 | class constants stay; `h()` and `preserveFocus` stay for content-safe UI and unmigrated screens | S, alongside | — |

Total: roughly 18–25 working days for the whole UI, spread over many small branches; each step keeps `test:e2e`, `test:i18n-layout`, `panel.ext` and `lists.ext` green. The vanilla alternative (4-§2.4 steps 1–7, then D1…D5 as kit functions) is not free either: it builds `page-context`, `screen` and `region` modules and touches the same screens; its cost was not estimated in the audit and is not estimated here.

## 6. Recommendation

**Adopt Preact for extension pages, incrementally, with guardrails; keep content scripts and the content-safe UI in vanilla.**

1. The decision-12 criteria are met: content scripts and service worker byte-identical, `test:i18n-layout` 0 → 0 findings, focus and tab order identical with a better in-place behaviour, e2e and `test:ext` unchanged and green under the strict CSP.
2. The cost is bounded and measured: one 5.6 KB gzip runtime per page that uses it (+6 % for popup and panel), about 1 ms of evaluation; it can be taken off the popup's critical path by lazy-loading Settings.
3. It addresses open audit findings structurally (4-A2 focus on removal, 4-A3 persistent live regions, 4-R5 panel rebuilds, D1…D5 duplications, the `preserveFocus` / `redraw(pages)` fragility) instead of adding three home-made modules to maintain.
4. Guardrails before the next migrated screen: ESLint ban on `dangerouslySetInnerHTML`, no `preact/compat`, a `useFocusFallback` hook, unmount on every host navigation and dispose, AMO review note for the innerHTML warning.
5. Stay vanilla instead if a runtime dependency and the AMO lint warning are unacceptable to the owner, or if the 18–25 days are better spent elsewhere: the vanilla code works, and the pilot can be dropped without trace (3 commits, nothing else depends on it).

Suggested order if adopted: Settings pages (low risk, already started) → Agenda (A2) → Now playing / « On this page » (D1, A1, A3) → side panel shell → popup → import pages and backup (they gain the least and pay the full runtime).
