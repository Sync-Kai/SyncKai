# SyncKai design charter

The graphic charter of the extension pages (popup, side panel, settings, import pages) and of the in-page toasts. It is the target of the UI redesign that moves the screens to Preact one by one. Until a screen is migrated, it keeps its current look: the tokens below exist in `src/ui/theme.css`, but no component has been restyled to use them yet.

Sources: the owner's decisions on the UX mockups (2026-10-16 / 17) and the mockups themselves (see [Mockups](#mockups)). Anything they leave open is marked *to be decided during the migration*.

## Principles

- **Compact.** Extension surfaces are small: popup and settings 400 px wide, side panel 360 px (down to 320 px), full tab pages 720 px. Layout on a 4 px grid.
- **Dark « Kotatsu » theme.** One dark theme only: ground, surface and raised layers in violet greys, light ink, pastel accents.
- **One primary action per surface.** The primary action is filled sakura with `on-fill` text; there is at most one per view (one per toast). Secondary actions are outlined with the `field` border or plain text.
- **Neutral selection.** A selected tab or segment is neutral (`field` border, `raised` background), never sakura.
- **Tone by icon or dot.** A state (success, upcoming, to check, error) is carried by an icon, a coloured dot or a badge, never by the colour of the text alone. Status texts stay `muted`.
- **Long languages.** The UI ships in 21 languages: secondary text goes under the label, or to the right with wrapping, never cut. Single-line titles truncate with « … » and carry the full text in a tooltip.

## Tokens

All tokens live in the `@theme` block of `src/ui/theme.css` (Tailwind v4 namespaces, so each one has utilities). Tailwind only emits the variables a build uses: an unused token costs nothing.

### Colours

| Token | Value | Purpose |
| --- | --- | --- |
| `--color-ground` | `#16131f` | Page background |
| `--color-surface` | `#211c2e` | Cards, status bar, neutral « Open » logo button |
| `--color-raised` | `#2c2640` | Menus, popovers, selected tab, hover background |
| `--color-line` | `#3d3554` | Separators and card borders (decoration) |
| `--color-field` | `#7a7098` | Borders of fields, menus and secondary buttons; selected tab border |
| `--color-ink` | `#f4effa` | Main text, series titles |
| `--color-muted` | `#b3a9c9` | Secondary text, section titles, status messages |
| `--color-sakura` | `#ff8fb8` | The primary action (filled) |
| `--color-lavender` | `#b9a4ff` | Information, in progress, upcoming, progress bars, focus ring, adjusted times |
| `--color-butter` | `#ffd37a` | To check, attention |
| `--color-mint` | `#7ee0c3` | Success, available, seen |
| `--color-danger` | `#ff8a8a` | Errors, destructive actions |
| `--color-on-fill` | `#1a0f1c` | Text and glyphs on a filled accent |
| `--color-anilist` | `#3db4f2` | AniList brand |
| `--color-mal` | `#5a7fd6` | MyAnimeList brand |

### Radii

| Token | Value | Purpose |
| --- | --- | --- |
| `--radius-pill` | 999px | Buttons, chips, toggles, round logo button, compact toast |
| `--radius-card` | 14px | Cards, toasts |
| `--radius-menu` | 12px | Menus and popovers |
| `--radius-panel` | 10px | Panels inside a card; fields (the mockups use 10–12 px) |
| `--radius-control` | 8px | Small controls |
| `--radius-cover` | 6px | Covers, 22 px service logos |
| `--radius-logo` | 4px | 16 / 18 px platform and service logos |

### Elevation

| Token | Value | Purpose |
| --- | --- | --- |
| `--shadow-pop` | `2px 2px 0 rgba(0, 0, 0, 0.45)` | « Sticker » shadow of what floats over the page: menus and popovers (`raised`, `field` border, `radius-menu`), toasts, filled sakura buttons. Cards in the flow stay flat. |

### Sizes

`--spacing` stays Tailwind's default grid. Named sizes use the `--spacing-*` namespace (`h-*`, `w-*`, `size-*`).

| Token | Value | Purpose |
| --- | --- | --- |
| `--spacing-stepper` | 24px | Borderless ghost − / + of a progress stepper |
| `--spacing-icon-button` | 28px | Icon buttons |
| `--spacing-logo-button` | 32px | Round « Open » button holding a platform logo |
| `--spacing-menu-item` | 36px | Menu item height (several mockups use a 34 px minimum: to be decided during the migration) |
| `--spacing-status-bar` | 48px | Status bar height |
| `--spacing-series-row` | 80px | Popup « Mes séries » row height |
| `--spacing-cover-row-w` / `-h` | 42 × 57px | Cover in a popup series row |
| `--spacing-cover-agenda-w` / `-h` | 32 × 44px | Cover in an Agenda line |
| `--spacing-logo-sm` | 16px | Service logos in toasts and in the account menu |
| `--spacing-logo-md` | 18px | Platform logos in rows and in the « Open » button |
| `--spacing-logo-lg` | 22px | Service logos in the status bar |

### Motion

| Token | Value | Purpose |
| --- | --- | --- |
| `--motion-enter` | 160ms | Entrance (toasts: fade + 6 px) |
| `--motion-exit` | 120ms | Exit |

Plain custom properties (Tailwind v4 has no duration namespace): use them as `duration-(--motion-enter)`. Easing curves are not specified by the mockups: to be decided during the migration.

## Typography

Two fonts: `font-body` (Nunito) for everything, `font-display` (M PLUS Rounded 1c) for screen titles, stats and the overline. The page default (`body`) stays 12 px / 600 until the screens are migrated.

| Token | Size / line-height | Weight | Use |
| --- | --- | --- | --- |
| `--text-overline` | 10 / 12px, tracking 1px | 700 | Overline (display font) |
| `--text-section` | 11px / normal, tracking 0.06em | 800 | Section titles, uppercase, `muted` |
| `--text-secondary` | 12 / 16px | 600 | Secondary text, status bar message |
| `--text-body` | 13px / 1.4 | (inherited) | Body text |
| `--text-row-title` | 14 / 18px | 700 | Row titles (series, settings rows) |
| `--text-stat` | 15 / 19px | 800 | Stats and screen titles (display font) |

The weight of a size token is a default; a `font-*` weight utility overrides it. Uppercase (`uppercase`) and the display font (`font-display`) are separate utilities. Numbers that line up (episodes, counts) use `tabular-nums`.

## Accessibility

- **Focus ring**: 2 px `lavender` outline, 2 px offset, on `:focus-visible` (already global in `theme.css`), in addition to any hover style.
- **Live regions**: toasts and status messages are `role="status"`; errors are `role="alert"`. A toast never takes the focus.
- **Reduced motion**: under `prefers-reduced-motion: reduce`, transitions become fades only; nothing loops except the sync dots.
- **Keyboard**: row sub-menus open on hover, click, → or Enter; an inline confirmation puts the focus on « Non » and Esc cancels it; the week calendar is fully keyboard-driven (see Agenda).
- **Contrast**: no target is written down yet (to be decided during the migration). Measured ratios: `ink` 12.7–16.2 and `muted` 6.5–8.2 on ground / surface / raised; accents 6.3–12.9 on the same; `on-fill` on `sakura` 8.7; `field` 3.2–4.0 (control borders); `line` 1.3–1.6 (decoration only).

## Components

### Settings

- Header (SyncKai), a back line « ← parent » with the view title centred, sections = uppercase section title + card, the status bar as footer.
- Keyboard shortcuts get their own sub-view (Affichage › Raccourcis clavier); the row shows a short description, not the keys.
- The version appears only in « À propos » (no separate copy button: the diagnostic report contains it).
- Platform release delay (Réglages › Plateformes): − / + by 15 min, and the value stays editable with the keyboard (−1440…10080 min).
- At 320 px (side panel), the settings home keeps the row labels and the accounts summary; row descriptions and summaries are dropped. How the switch is made (container query or other) is to be decided during the migration.

### Status bar (popup and side panel)

- One shared component, 48 px high, at the bottom of the popup and of the side panel: service logos on the left, message on the right.
- Message: always `text-secondary` (12 px, 600), `muted`, never underlined. The tone is carried by the icon only. A clickable message ends with « › ».
- A message naming a series takes two lines: the series title in `ink` on line 1 (truncated with « … »), the status with its icon on line 2.
- One state at a time, by priority: failed syncs › to check › pending › session expired › no account › to rate › all synced.
- « Synchro terminée » / « Import terminé » stays until the user has seen it (× or a click on the text, which opens Activité), 24 h at most; a new sync adds to the count (« 2 épisodes synchronisés »). It comes after failed / to check and before to rate / sync in progress / idle. Its place relative to pending and session expired is to be decided during the migration.

### Account menu

- Opened by a click on the AniList / MAL logo of the status bar.
- Avatar, profile stats (count / episodes / days), one « Synchro cette semaine … 9 épisodes » label / value row: the label truncates with a tooltip, the value never wraps.
- Width `max-content` between 288 and 376 px, so translations fit.
- Logo button hover: `raised` background, `muted` border; keyboard focus adds the focus ring.

### Popup « Mes séries » row

- Fixed 80 px row. Cover 42 × 57 with a 3 px `lavender` progress bar under it (none when the total is unknown).
- Line 1: title, 14 px, ellipsis, full title in a tooltip.
- Line 2: status as a coloured dot + text: `mint` available, `lavender` upcoming, `muted` finished or unknown.
- Line 3: « Ép. x / y » in tabular figures, with borderless ghost − / + of 24 px.
- Right: « Open » = the platform logo in a neutral 32 px circle (`surface`, `line` border), then « ⋯ ».
- No AniList / MAL selector: the list follows « Fiche ouverte par défaut » (Réglages › Comptes).
- Off streaming pages, the « Reprendre » card takes the place of « Sur cette page », with « Ouvrir sur {platform} » and the stepper.

### Row menus

- « ⋯ » opens a menu (`raised`, `field` border, `radius-menu`, `shadow-pop`).
- « Ouvrir la fiche › » and « Chercher sur… › » open a sub-menu on hover, and also on click, → or Enter.
- A destructive item (« Abandonner ») confirms inline: the menu line becomes the question, focus on « Non », Esc cancels.

### Ratings

- 10 stars with halves (scores 0.5 to 10 in steps of 0.5). In the end-of-series toast, ← → change the value by 0.5 and Enter sends it.

### Side panel Agenda

- Days in chronological order, Monday to Sunday; the view scrolls to today on open; past days are muted.
- An empty day is a 24 px header with « Aucun épisode » right-aligned, no card.
- Episode line: cover 32 × 44, title (ellipsis) + « · ép. N »; line 2: platform time in bold (`lavender` when adjusted) · platform · « Japon HH:MM » (truncated first). A seen episode shows `mint` « ● Vu » and is dimmed. Then the logo « Open » button and « ⋯ ».
- Week navigation: ‹ [📅 dates ▾] ›. The centre button opens a month calendar: 6 fixed week rows of 36 px, the whole row clickable, today ringed in `lavender`, a « Cette semaine » footer. Keys: ↑ ↓ week, PgUp / PgDn month, Home, Enter, Esc.
- Data: month navigation is free; one request per chosen week; ‹ › debounced 300 ms; weeks cached per page.

### In-page toasts (on the player)

- Position: top-right corner, 24 px from the edge and 72 px from the top (56 px when the window is under 600 px high), inside the fullscreen element. The bottom-right corner is left to the platforms' « Next episode » / « Skip credits » cards. No tail; at most 304 px wide.
- Anatomy: Kai with a state badge in its corner (no « SYNCKAI » overline); title = what happened (« Épisode 6 enregistré »); subtitle = series · episode; one line per service with 16 px AniList / MAL logos, merged into one line with both logos when the result is the same.
- Durations unchanged (3 / 5 / 9 / 15 / 20 s), counted only while the tab is visible; the timer pauses on hover and focus; toasts with a button show a 2 px timer bar.
- One toast at a time, replaced in place; a toast waiting for a click is never replaced by a plain information.
- One sakura action, on the right; the secondary one as text; × at the top right.
- Motion: enter 160 ms, exit 120 ms; reduced motion: fades only.
- The top-right position is still to be checked on the real sites.

## Preact

Extension pages move to Preact one screen at a time (decision 12, 2026-10-17); content scripts and the in-page toasts stay vanilla. Rules for every migrated screen:

- **`.tsx` for pages only.** No `.tsx` module and no `preact` import is reachable from `src/content/` (`src/architecture.test.ts`).
- **No `preact/compat`**, no `react` / `react-dom` (ESLint `no-restricted-imports`): only `preact` and `preact/hooks`. Shared hooks live in `src/ui/preact/hooks.ts` (`useStore`, `useLocale`, `useFocusFallback`, `useDismiss`).
- **No `dangerouslySetInnerHTML`** (ESLint, with the `innerHTML` ban): build the nodes in JSX.
- **Styles through classes or the `style` object.** Preact writes the `style` object through the CSSOM, which the CSP allows; it has no `style-src`, so an inline style attribute in markup is refused.
- **Content-safe modules stay vanilla**: `ui/{rating,star-rating,kai-small,svg}.ts` are shared with content scripts. A page wraps them in a small component that mounts the vanilla node into a ref.
- **Every mounted tree is unmounted on dispose** (`render(null, container)`), and on host navigation when the host mixes Preact and vanilla screens: a tree left mounted keeps its store and locale subscriptions.
- **Texts through `t()`**, with `useLocale()` in the component so it re-renders when the language changes.
- **Focus**: Preact keeps nodes across renders; where a render removes the focused element, `useFocusFallback` moves the focus as `preserveFocus` does (same key, declared `data-focus-fallback`, given fallback, then neighbours).

### Base components

Components in `src/ui/components/`, built from the tokens above. Every visible or accessible text is a prop that the caller fills with `t()`. Until a screen imports them, `src/ui/theme.css` keeps them out of the Tailwind scan (`@source not "./components"`), so the published CSS is unchanged; the first screen that uses one removes that line (`components/scan.test.ts` enforces both ways). Dev-only gallery of every component in its states, at 400 and 360 px: `node scripts/screenshots/gallery.ts [--out <dir>]` (default `<tmp>/synckai-gallery`).

- **`Button`**: `primary` (one per surface), `secondary`, `ghost`, `danger`, `text`; `sm` / `md`; leading icon; `busy` (aria-busy, focus kept, clicks ignored); `<a>` when given `href`.
- **`IconButton`**: 28 px round icon button; `label` is required (aria-label and tooltip); optional line border, menu and pressed states.
- **`Stepper`**: « Ép. x / y » in tabular figures, then ghost − / + of 24 px; a reached bound disables its side.
- **`LogoButton`**: 32 px round « Open » link, neutral surface with a line border, 18 px platform logo.
- **`Switch`**: `role="switch"` button with `aria-checked`; Space and Enter toggle it.
- **`ServiceLogo`**: AniList / MAL / platform logo at 16, 18 or 22 px with an optional state badge (`ok`, `info`, `warn`, `error`, `expired` = greyed logo and red dot).
- **`Cover`**: `row` (42 × 57) or `agenda` (32 × 44) cover, image or initials, optional 3 px lavender `progressbar` (none when the total is unknown).
- **`StatusText`**: 6 px dot and text in the tone colour, truncated with a tooltip.
- **`Section`**: uppercase `text-section` title naming its content.
- **`SettingsCard` / `SettingsRow`**: rows card (`@container`) and row with tinted icon, title, description, then summary + chevron or a `Switch`; under 340 px of card, description and summary are hidden (the description stays the tooltip and `aria-describedby`).
- **`Collapsible`**: header button with `aria-expanded` / `aria-controls`, chevron and optional count; controlled or not.
- **`Tabs`**: pill tablist, neutral selection, roving tabindex, arrows / Home / End select.
- **`Menu` / `MenuItem` / `SubMenu` / `MenuSeparator`**: the row « ⋯ » menu; roving focus, Tab / Esc / outside click close it (`useDismiss`); sub-menus open on hover after a short intent delay, on click, → or Enter, and close on ← or Esc; danger items.
- **`StatusBar`**: the 48 px footer, props only: account logo buttons (none when never connected, greyed with a red dot when expired), message with its tone icon, two lines when it names a series, a button with a trailing chevron when clickable, trailing slot, import progress line.
- **`StarRating`**: 10 stars with halves as one `role="slider"` (← → ±0.5, Home / End, Enter confirms), half-star click, hover preview, read-only mode. Pages only: the content-safe `ui/star-rating.ts` (end-of-series toast) is unchanged until the toasts are redesigned.

## Mockups

The owner keeps the reference mockups in a private Claude Design artifact (not linked from this repository). Each screen migrated to Preact is checked against its view there. Decisions recorded on the mockups are summarised above.

## Ratchet

`src/ui/design-tokens.test.ts` scans `src/**/*.{ts,tsx}` (`*.test.ts` / `*.test.tsx`, test helpers and test data excluded; `.tsx` modules parsed as JSX, attribute strings included) and freezes, per file, in `src/ui/design-tokens.baseline.json`:

- **`arbitraryColors`**: Tailwind arbitrary values carrying a colour (`bg-[#…]`, `text-[rgb(…)]`, `shadow-[…_rgba(…)]`, `text-[color:…]`, `[text-shadow:…]`);
- **`hexColors`**: raw `#rgb` / `#rrggbb` / `#rrggbbaa` colours in string literals (comments ignored, colours already counted as arbitrary classes not counted twice). The Kai mascot drawings are exempt: `src/ui/kai-small.ts` and the large Kai drawing at the end of `src/ui/icons.ts`;
- **`pxFontSizes`**: arbitrary pixel font sizes, `text-[NNpx]`.

A count may only go down. A file above its frozen value fails (a new file starts at 0): use a token instead. A file below its frozen value also fails until the baseline is lowered (or the file removed from it at 0), so the ratchet tightens with every clean-up. Arbitrary pixel spacings are not counted: they go away during the Preact migration.
