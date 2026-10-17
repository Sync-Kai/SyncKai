# SyncKai design charter

The graphic charter of the extension pages (popup, side panel, settings, import pages) and of the in-page toasts. It is the target of the UI redesign that moves the screens to Preact one by one. Until a screen is migrated, it keeps its current look: the tokens below exist in `src/ui/theme.css`. Migrated so far: the status bar of the popup and side panel with its account menu, and all of Settings: the shell (bar, home, navigation), Accounts, Sync (and its Matches and Excluded series pages), Platforms, Notifications, Display (and its Language and Shortcuts pages), My data (and its AniList ↔ MAL differences page, moved there from the popup's Activité) and Help & about; the popup shell (header, Watching / Activité tabs, host-access banner), the welcome screen, the « Mes séries » list with its sort menu and states, its row « ⋯ » menu, comment editor, the « Reprendre » card, the « Sur cette page » card and the Activité tab: nothing in the popup is vanilla any more (the side panel's cards and menus still are).

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
- Platform release delay (Réglages › Plateformes): − / + by 15 min, and the value stays editable with the keyboard (−1440…10080 min). A − / + click snaps to the next multiple of 15 in its direction (65 → 60 / 75); ↑ ↓ in the field do the same; Enter or leaving the field saves a typed value, Esc cancels it; an invalid value (empty, decimal, out of range) turns the pill `danger` with the range below it and is never saved (`shared/settings.ts` › `stepOffset`, `parseOffsetDraft`, `formatOffsetDraft`; `ui/settings/offset-field.tsx`).
- Platforms (Réglages › Plateformes): one row per site with its 28 px logo; Crunchyroll / ADN show « Inclus » (`mint`), or « Accès manquant » (`butter`) with a banner and « Autoriser l’accès » when the browser no longer grants the site access (Firefox); Netflix, Disney+ and Prime Video have a switch whose description is the help before / after activation, and the result of the last request (refused, error, turned off) under it. The preferred player is a `Select`: Netflix and Prime Video stay listed, greyed with « Activer d’abord », until turned on; Disney+ is never offered.
- Notifications: the three on-page styles are `flush` `ChoiceCards` inside one card, each with a drawing of a video and its notification (tokens only); the « Vérifier maintenant » row shows the last check status (`danger` on failure) and, while it runs, « Vérification en cours… » with a busy button.
- At 320 px (side panel), the settings home keeps the row labels and the accounts summary; row descriptions and summaries are dropped. Made by a container query in `SettingsRow` (`NARROW_HIDDEN`, `@max-[304px]:hidden` on the card): the card measures 322 px in the 360 px panel (6 px scrollbar included), 282 px at 320 px and 262 px in the 300 px Firefox sidebar. Other texts of a page (help under a choice, notes) stay visible.
- My data: one primary « Importer un historique ↗ » (the platform is chosen on the import page), the Backup card (Export: busy, « Exporté » for 2 s, or an alert; Import ↗ opens the Backup page), a « Comparer » row to the differences page with a `butter` count once analysed; with a single account the row stays, inert, with a « Comptes » button. A note sends matches and excluded series to Sync › Per series.
- AniList ↔ MAL differences: intro, then « Analyser » (primary) or the summary card (counts, breakdown, « Analysé il y a… », « Relancer »); filter chips with neutral selection (the chosen one stays shown even when empty); the « Aligner » zone shows the two bulk buttons (side by side above 352 px, stacked below), or in their place the confirmation (focus on « Annuler »), the running job (progress, pause line, « Arrêter », « Continue même si tu fermes cette page. ») or the summary (`mint` / `butter` / `danger`, failed series listed, « Réessayer les échecs », « OK »). A disabled « Garder … » button gets its reason under the row (info icon), not only in a tooltip; under 304 px of card the two « Garder … » buttons move under the title, right-aligned.
- Help & about: « Rapport de diagnostic » title and its button on one line (the button goes under it, right-aligned, when the line is too narrow), the description below; the error log row shows the count (`butter` with errors), unfolds the list (time · module, message) and has a `danger` « Effacer »; the About card is the only place with the version (and the dev build name in dev builds), with What's new, Privacy and Source code links. Dev builds add the foldable « Diagnostic des correspondances » and « Trace de débogage » sections.
- Navigation: home › category › second-level page (Sync › Matches, Sync › Excluded series, Display › Language, Display › Shortcuts, My data › AniList ↔ MAL differences). The back button names the parent (« ← Display », screen-reader label « Back to Display »); Esc goes back one level and the focus returns to the row of the page left.

### Status bar (popup and side panel)

- One shared component, 48 px high, at the bottom of the popup and of the side panel: service logos on the left, message on the right.
- Message: always `text-secondary` (12 px, 600), `muted`, never underlined. The tone is carried by the icon only. A clickable message ends with « › ».
- A message naming a series takes two lines: the series title in `ink` on line 1 (truncated with « … »), the status with its icon on line 2.
- One state at a time, by priority (`src/ui/status-bar-model.ts`): failed syncs › to check (with the pending retries after it: « 2 à vérifier · 1 en attente ») › pending › session expired › no account › import or list alignment running › import ready › sync done › import done › to rate › sync in progress › all synced. While the accounts are being read, the bar shows no message (no flash of « Aucun compte connecté »).
- « Synchro terminée » / « Import terminé » stays until the user has seen it (× « J'ai vu, masquer » or a click on the text), 24 h at most; a new sync adds to the count (« 2 épisodes synchronisés », every episode counted, earlier episodes of the same season included). The mark lives in `storage.local` (`statusBar:syncsSeenAt`, `statusBar:importSeenAt`), so it is shared by the popup and the panel and survives a closed popup. A click on « Synchro terminée » opens Activité; on an import message, the import page of its platform.
- Import running (« Import Crunchyroll · 42 / 120 », analysis or writing) and alignment running (« Alignement… 3 / 10 », opens Settings › My data › AniList ↔ MAL differences) show the 2 px progress line. « Import prêt · N séries à valider » shows for 24 h after the analysis ends (it is not dismissible: the import page has « Recommencer »). A stopped or cancelled job shows nothing.
- « Synchro… »: a `{ startedAt }` signal written by the service worker in `storage.session` around the tracker reads and writes of a sync, ignored by the pages after one minute.
- Session expired: greyed logo with a red dot, « Session expirée » (the logo names the service) and a « Reconnecter » button. No account: no logo, a grey dot, the message on the left, nothing clickable.
- The account logos open the account menu (below). The version is no longer in the bar (Settings › Help & about).
- Side panel: it has no Activité, so a message that leads there opens the popup on Activité (`chrome.action.openPopup`, Chrome 127+ and Firefox; the screen is passed through a one-shot `storage.session` request). Without that API the message is plain text; × still works.

### Account menu

- Opened by a click on the AniList / MAL logo of the status bar (`ui/account-menu.tsx`, mounted by `ui/status-bar-host.tsx`); a second click, Esc, Tab or a pointer down outside the logos closes it. The logo carries `aria-haspopup="menu"` and `aria-expanded`; on open the focus goes to the first item, Esc and a chosen item give it back to the logo; ↑ ↓ Home End move between the items (base `Menu`'s `MenuPopup`, placed above the bar, 12 px from the left edge, 8 px above the bar).
- Connected: avatar (the profile picture, else a brand gradient with a person glyph) with the 16 px service logo in its corner, service name, « {name} · connecté » after a `mint` dot, a separator, three stat tiles (`surface`, value in the display font `text-stat` with tabular figures, label in `muted`): anime in the list (« Plan to watch » excluded on both services), episodes watched, days watched (« 54 j », one decimal under 10 days), then one « Synchro cette semaine … 9 épisodes » label / value row: a `mint` check, the label truncates with a tooltip giving the full meaning, the value never wraps; a separator, « Voir mon profil ↗ » (new tab) and « Déconnecter » (danger, same direct sign-out as Settings › Accounts, no confirmation).
- Expired session: greyed avatar, red dot « Session expirée », a separator, then « Reconnecter » highlighted (`line` background, 800, sakura icon), « Voir mon profil » when the profile is still cached, « Déconnecter ». No stats.
- The header and stats are the menu's description (`aria-describedby`), not items. While the profile or stats load, the texts are replaced by blocks of the same height (no layout jump); stats that cannot be read hide the tiles and keep the rest.
- Data: the stats come with the profile (same request and cache), re-read once when the menu opens if older than one hour; « this week » = Monday to Sunday, local time.
- Width `max-content` between 288 and 376 px, so translations fit, and never wider than the page minus 24 px (side panel at 320 px).
- Logo button hover: `raised` background, `muted` border; open: `field` border; keyboard focus adds the focus ring.

### Popup « Mes séries » row

- Fixed 80 px row. Cover 42 × 57 with a 3 px `lavender` progress bar under it (none when the total is unknown).
- Line 1: title, 14 px, ellipsis, full title in a tooltip.
- Line 2: status as a coloured dot + text: `mint` available, `lavender` upcoming, `muted` finished or unknown.
- Line 3: « Ép. x / y » in tabular figures, with borderless ghost − / + of 24 px.
- Right: « Open » = the platform logo in a neutral 32 px circle (`surface`, `line` border), then « ⋯ ».
- No AniList / MAL selector: the list follows « Fiche ouverte par défaut » (Réglages › Comptes). A `source` stored in `popupPrefs` by an earlier version is ignored.
- Line 2 shows, in place of the release status for about 3 s, the result of a − / + or menu action (« Ép. 5 vu », « Rien n’a été modifié »…, tone by the dot, detail per service in the tooltip) and « Mise à jour… » while it is sent; a partial failure also opens the banner above the list with « Réessayer ». An excluded series shows « Exclue » after the status and no +.
- Sort: « Prochaine sortie ▾ » to the right of « Mes séries マイシリーズ » (shown from two rows), a menu of exclusive choices with an icon each, the active one checked; focus opens on it.
- Off streaming pages, the « Reprendre » card takes the place of « Sur cette page » (`popup/components/resume-card.tsx`): overline « Reprendre ツヅキ » (kana in sakura), the row cover with its progress bar, the title link, the release status (or the result of an action) as in a row, then « {platform} · il y a … » (platform of « Open », else of the last sync, and the last sync time), « Ouvrir sur {platform} » (secondary button: platform logo, sakura ▸) and the stepper on one line, « ⋯ » at the top right. Its menu is the row menu.
- « Commentaire… » opens the comment editor under the row (`ui/components/notes-editor.tsx`, mockup PopupSeriesCommentaire): « COMMENTAIRE » title, text area (read-only while the comment is read), counter (`butter` from 90 % of 6000), « Annuler » (text) and « Enregistrer » (secondary, disabled until the text changes, spinning while sent, area locked and « Annuler » greyed meanwhile); Ctrl+Enter saves, Esc or « Annuler » closes without writing; saved: the editor closes, the row shows « Commentaire enregistré », the focus goes back to « ⋯ ». A series in no list shows « Ajoute la série à ta liste pour la commenter. » in place of the editor. The side panel keeps the foldable vanilla editor (`ui/notes-editor.ts`) until its migration.
- The rows do not expand: the « Détails : saison, note, commentaire » section of mockup PopupSeriesDeplie belongs to the « Sur cette page » card.

### Popup « Sur cette page » card

Mockups PopupPageEtats, PopupPageMenu, PopupPageRetours, PopupSeriesDeplie; `popup/components/page-media-card.tsx`, built from shared parts ready for the side panel's « En lecture » card (`ui/components/{media-header,service-lines,season-picker,rating-block,status-actions,feedback-banner,media-details}.tsx`). Data and actions stay in the page-media controller (`ui/page-media-controller.ts`).

- Card: `surface`, `line` border, `radius-card`, 12 px padding, 10 px between parts. It replaces « Reprendre » while the active tab shows a recognised series or episode.
- Header: cover 44 × 62 (`Cover` size `card`) and title link to the entry (two lines at most, tooltip), « SUR CETTE PAGE » overline, info line (season, year, episodes, airing state, then the platform; « Pas dans ta liste » when no connected account has the series), then the next-episode pill (`mint` available, `lavender` upcoming) with its date; « ⋯ » at the top right.
- States: loading (grey cover and blocks, page title in `muted`); not found = `butter` `Alert` with a magnifier and « Réessayer »; network error or AniList limit = `danger` `Alert` with « Réessayer »; not an anime = muted title and a `muted` sentence, nothing to retry; platform turned off = the same sentence with « Réglages › Plateformes » as a link.
- Season guessed (or chosen outside the episode): the warning, « SAISON » and the dropdown in a `butter` frame above the progress. Otherwise the dropdown is in the details (« SAISON SUR ANILIST », plus « Changer de saison corrige la correspondance… » on an episode page). Fewer than two choices: no dropdown, no warning.
- Per-service lines (16 px logo with a `mint` dot in the list, red on a read error): shown with two accounts, hidden when a single account follows the series and has it in its list, or when no account has it (the info line says so).
- Action feedback: a tinted banner above the actions (`mint` done, `lavender` info, `butter` nothing changed, `danger` failed, role="alert"), the detail per service as its tooltip, « Réessayer » after a partial − / + failure. The popup's own results (exclusion, re-enable) use the same banner.
- In a list: status pill (`lavender` tint) on the left, `Stepper` `pill` on the right (− / « Ép. x / y » / + in a `raised` pill, 30 px buttons, the + filled sakura: the card's primary action). Missing from a list: « Ajouter à À regarder » (secondary) and « Ajouter à En cours » (primary, secondary when the stepper is shown).
- « Détails : saison, note, commentaire » folds the season dropdown, « TA NOTE » (`RatingBlock`: the 10 half stars, the chosen value kept while it is sent) and « COMMENTAIRE » (`NotesEditor` `inline`: no frame, no « Annuler », no focus on open, Esc restores the saved text). Shown when the series is in a list or the dropdown belongs there.
- Its « ⋯ » menu is the series menu: the current status greyed with « Statut actuel » (`MenuItem` `hint`), « Ouvrir la fiche › », then « Ne plus synchroniser cette série » / « Réactiver la synchro » (page key and AniList entry, like an exclusion from a check card) and « Retirer de la liste ». No « Commentaire… » (it is in the details) and no « Chercher sur… » (the series is on the page). A series in no list keeps only the entry links and the exclusion.

### Popup « Activité » tab

Mockups PopupActivite, PopupActiviteEtats, PopupActiviteNoter, PopupVerification; `popup/components/activity-screen.tsx` (pure texts in `activity-view.ts`), the « À vérifier » section and card in `ui/review-card.tsx` (pure rules in `ui/review-view.ts`), ready for the side panel. Data and actions stay in the render-free controllers (`popup/controllers/queue.ts`, `ratings.ts`) and `popup.ts`.

- Order: « Échec », « En attente », « À noter », « À vérifier », « Dernières synchros », then the « Écarts AniList ↔ MyAnimeList » row (both accounts connected; `butter` count once analysed; opens Settings › My data › Differences). The first three appear only with an item, a result or an error to show; « À vérifier » and « Dernières synchros » are always there, with their empty card. Without a connected account, only the last two show (and no card).
- Section titles: `Section` with `countInline` and the section tone: « ÉCHEC · 1 » `danger`, « EN ATTENTE · 1 » `lavender`, « À NOTER · 1 » `sakura`, « À VÉRIFIER · 1 » `butter`, « DERNIÈRES SYNCHROS » `muted`. The count is added by the code after « · », not translated.
- Failed and pending syncs: card (`danger`/30 border when failed), x-circle or clock icon, « Série · S1 E4 », « Crunchyroll → AniList · MyAnimeList », the last error (two lines at most, full text in a tooltip), then « Échec — abandonné » (`danger`) or « Nouvel essai dans 5 min » (`lavender`) and « Abandonner » (ghost) + « Réessayer » (primary when failed, secondary when pending; busy spinner, « Abandonner » greyed). The retry result (`FeedbackBanner`) and read or remove errors (`Alert`) sit under the first section title, or alone when the queue is empty.
- « À noter »: row cover, title link, « Terminé il y a 2 h », the 10 half stars (`StarRating` `sm`; the chosen value stays shown while it is sent and after a failure), « Ignorer » (a spinner with « Enregistrement de la note… » in its place while sending), the failure under the card (« Échec sur MyAnimeList, réessaie », « Rien n’a été enregistré »). A saved score removes the card and shows the banner « Note 8,5/10 enregistrée · Berserk (2016) » for a few seconds.
- « À vérifier » card (`ReviewCard`, mockup PopupVerification): `butter`/30 border; title « Mushoku Tensei · S2 · E5 · (affiché E30) · Netflix » (one line, tooltip), the reason in `butter` with a triangle icon (wraps), the deferred episode of a correction; the candidates as toggle buttons (cover 32 × 44, title, « TV · 12 ép. · 2023 », lavender ring and check when chosen; the suggestion chosen at first), « Aucune fiche proposée : utilise la recherche. » without any; search field + magnifier (spinner while searching), « RÉSULTATS (n) » under the candidates (those already proposed removed); « Épisode sur la fiche » [5] « / 12 »; the feedback box (`danger` invalid episode, search failed, action failed; the sync result in its tone, partial failures and an expired session included) above the buttons; « Ne plus synchroniser » (ban icon, tooltip about Settings › Sync › Excluded series), « Ignorer », « Confirmer » (primary, disabled without a chosen entry, « Synchronisation… » while sent). Synced: the result and « Fermer », closing alone after 5 s, or staying until « Fermer » when a note must be read (correction to another entry: « Pense à corriger … »). A card being sent or showing its result stays after its check leaves the storage; a closed card whose check still exists starts again; a new check of the same season resets the card. The focus goes to « Fermer » when the buttons disappear, and to the section title when a card is removed.
- « Dernières synchros »: rows (`line` border, `radius-panel`), `mint` check, title link « Frieren · E6 » (wraps), « → Frieren: Beyond Journey’s End · épisode 6 », « Corriger » (`sakura` text; spinner on the row being reopened, the others greyed; « À vérifier ↑ » greyed when a card is already open), ⊘ « Ne plus synchroniser cette série » or the « Exclue » pill. No sync time and no « Tout voir » (mockup PopupActivite): not stored per view, left out.
- Tab badge: checks + abandoned syncs + series to rate (not the pending retries), none without a connected account.

### Row menus

- « ⋯ » opens a menu (`raised`, `field` border, `radius-menu`, `shadow-pop`), as wide as its longest item (240 to 320 px), brought into view when it opens near the bottom of the list.
- Series menu (`ui/series-menu.tsx`, shared with the « Reprendre » card, ready for the side panel; mockups PopupSeriesMenu, PopupSeriesMenuConfirm): « Mettre en pause » (butter icon), « Abandonner » (danger icon), « Marquer comme terminé » (mint check), separator, « Commentaire… », « Ouvrir la fiche › » (AniList / MyAnimeList, one per connected account that knows the anime, the « Fiche ouverte par défaut » one first), « Chercher sur… › » (active platforms with search and no known link, preferred player first; absent when there is none), separator, « Ne plus synchroniser cette série » (greyed without an AniList entry) or, for an excluded series, « Réactiver la synchro » in `mint`, « Retirer de la liste » (danger). No « −1 épisode »: the row has its own −.
- While a − / + or a status change is sent, the statuses, « Commentaire… » and « Retirer de la liste » are greyed; the links and the exclusion stay available.
- « Ouvrir la fiche › » and « Chercher sur… › » open a sub-menu on hover, and also on click, → or Enter; their items are the bare service / platform names with their logo (accessible name « Ouvrir la fiche sur AniList », « Chercher Dandadan sur ADN »).
- « Abandonner », « Marquer comme terminé » and « Retirer de la liste » confirm inline (base `MenuConfirm`): the menu line becomes the question (« Abandonner ? » `danger` Oui, « Terminé ? » `mint` Oui, « Retirer de ta liste ? » with the explanation « Retirée de chaque compte connecté… » under it and `danger` « Retirer »), focus on « Non » / « Annuler »; Esc, « Non » or « Annuler » cancel (the menu stays open, the focus returns to the item); a closed menu forgets the confirmation.

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
- **No `preact/compat`**, no `react` / `react-dom` (ESLint `no-restricted-imports`): only `preact` and `preact/hooks`. Shared hooks live in `src/ui/preact/hooks.ts` (`useStore`, `useLocale`, `useNow`, `useFocusFallback`, `useDismiss`).
- **No `dangerouslySetInnerHTML`** (ESLint, with the `innerHTML` ban): build the nodes in JSX.
- **Styles through classes or the `style` object.** Preact writes the `style` object through the CSSOM, which the CSP allows; it has no `style-src`, so an inline style attribute in markup is refused.
- **Content-safe modules stay vanilla**: `ui/{rating,star-rating,kai-small,svg}.ts` are shared with content scripts. A page wraps them in a small component that mounts the vanilla node into a ref.
- **Every mounted tree is unmounted on dispose** (`render(null, container)`), and on host navigation when the host mixes Preact and vanilla screens: a tree left mounted keeps its store and locale subscriptions.
- **Texts through `t()`**, with `useLocale()` in the component so it re-renders when the language changes.
- **Focus**: Preact keeps nodes across renders; where a render removes the focused element, `useFocusFallback` moves the focus as `preserveFocus` does (same key, declared `data-focus-fallback`, given fallback, then neighbours).

### Base components

Components in `src/ui/components/`, built from the tokens above. Every visible or accessible text is a prop that the caller fills with `t()`. The status bar is the first shipped screen that imports them, so `src/ui/theme.css` no longer keeps them out of the Tailwind scan (`components/scan.test.ts` enforces it both ways: the exclusion comes back only if no shipped module imports them). Dev-only gallery of every component in its states, at 400 and 360 px: `node scripts/screenshots/gallery.ts [--out <dir>]` (default `<tmp>/synckai-gallery`).

- **`Button`**: `primary` (one per surface), `secondary`, `ghost`, `danger`, `text`; `sm` / `md`; leading icon; `busy` (aria-busy, focus kept, clicks ignored); `<a>` when given `href`.
- **`IconButton`**: 28 px round icon button; `label` is required (aria-label and tooltip); optional line border, menu and pressed states.
- **`Stepper`**: « Ép. x / y » in tabular figures, then ghost − / + of 24 px; a reached bound disables its side; `busy` keeps both focusable (aria-disabled) and ignores clicks; `incrementHidden` drops the +. Variant `pill` (« Sur cette page »): − / text / + in a `raised` pill, 30 px buttons, + filled sakura.
- **`LogoButton`**: 32 px round « Open » link, neutral surface with a line border, 18 px platform logo.
- **`Switch`**: `role="switch"` button with `aria-checked`; Space and Enter toggle it.
- **`ServiceLogo`**: AniList / MAL / platform logo at 16, 18, 22 or 28 px (`tile`, Settings › Platforms rows) with an optional state badge (`ok`, `info`, `warn`, `error`, `expired` = greyed logo and red dot).
- **`Cover`**: `row` (42 × 57), `agenda` (32 × 44) or `card` (44 × 62) cover, image or initials, optional 3 px lavender `progressbar` (none when the total is unknown).
- **`StatusText`**: 6 px dot and text in the tone colour, truncated with a tooltip.
- **`Section`**: uppercase `text-section` title naming its content; optional count aligned right (« CRUNCHYROLL ··· 61 ») or, with `countInline`, after the title (« ÉCHEC · 1 », Activité); tones `danger` (« Zone de danger », failed syncs), `info`, `warn`, `accent` (Activité sections).
- **`SettingsCard` / `SettingsRow`**: rows card (`@container`) and row with tinted icon (or a 28 px `leading` visual such as a platform logo), title, description, then summary + chevron or a `Switch`; under 304 px of card, description and summary are hidden (the description stays the tooltip and `aria-describedby`); a `warn` description (« En pause : aucun épisode n’est envoyé ») is `butter` with a pause icon; `href` + `external` opens a site in a new tab with ↗ instead of the chevron (Help & about links).
- **`Segmented`**: radio group in a pill (`ground` track, neutral selection), one tab stop, arrows / Home / End choose; `fill` gives equal-width options on the whole line, a long label wraps on two lines; `disabled` greys the whole group.
- **`ChoiceCards`**: exclusive choice as cards (Sync « Épisode compté comme vu », Notifications style): a legend, one native radio per card (one tab stop, arrows choose), bold title, `muted` description, optional badge (« Recommandé ») and visual; the chosen card has a `raised` background and a `lavender` border, the others a `line` border. `flush` drops the borders (cards inside a card, the chosen one on `raised`) and `legendHidden` keeps the legend for screen readers only (Notifications).
- **`Select`**: row-wide button (label left, chosen value with its logo right, chevron) opening a `role="listbox"` under it (menu surface); focus on the list with `aria-activedescendant`, ↑ ↓ Home End move, Enter / Space choose, Esc / Tab / outside pointer close; a disabled option stays listed, greyed, with a `butter` hint (« Activer d’abord »).
- **`Alert`**: error inside a card (`danger` border and text, alert icon), optional secondary action (« Réessayer »); `data-alert` feeds the page's live region. `tone="warn"` (with its own `icon`) for « nothing found ».
- **`AccountAvatar`**: profile picture or brand gradient with a person glyph, 16 px service logo in the corner; 36 px (account menu) or 44 px (Settings › Accounts); expired = dimmed, not connected = dashed circle.
- **`Collapsible`**: header button with `aria-expanded` / `aria-controls`, chevron and optional count; controlled or not; `variant="section"` makes the whole section foldable (uppercase section title in an `<h2>`, count pill, chevron on the right: developer tools of Help & about).
- **`Tabs`**: pill tablist, neutral selection, roving tabindex, arrows / Home / End select; a tab may carry a count badge and its own accessible name.
- **`Menu` / `MenuItem` / `SubMenu` / `MenuSeparator` / `MenuConfirm`**: the row « ⋯ » menu; ↓ / ↑ on the closed button opens it; roving focus, Tab / Esc / outside click close it (`useDismiss`); sub-menus open on hover after a short intent delay, on click, → or Enter, and close on ← or Esc; danger items; `tinted` colours the label with the icon tone; `keepOpen` keeps the menu open after the choice; `checked` makes exclusive choices (`menuitemradio`, check mark, focus opens on the checked one); `hint` adds a muted mention at the end (« Statut actuel »); `MenuConfirm` is the inline confirmation (question, optional explanation, Oui / Non menu items, focus on Non, Esc cancels it before closing anything).
- **`NotesEditor`**: the comment editor of a series (see « Mes séries » row above); `inline` variant for the card details.
- **`MediaHeader` / `ServiceLines` / `SeasonPicker` / `RatingBlock` / `StatusActions` / `AddToListButtons` / `FeedbackBanner` / `MediaDetails`**: the parts of the « Sur cette page » card (see above), props only, for the side panel's « En lecture » card too.
- **`StatusBar`**: the 48 px footer, props only: account logo buttons (none when never connected, greyed with a red dot when expired; `aria-haspopup` only when they open a menu), message with its tone icon (or a muted dot), two lines when it names a series, a button with a trailing chevron when clickable, an optional accessible name, trailing slot, import progress line. Mounted with its data by `src/ui/status-bar-host.tsx` (`mountStatusBar`).
- **`SeriesRow`**: the 80 px series row (cover with its progress bar, title link with tooltip, status dot + text with an optional tag, `Stepper`, `LogoButton`, then the host's actions); `SeriesTitle` and `SeriesStatusLine` are exported for the side panel.
- **`ReviewCard` / `ReviewList`** (`src/ui/review-card.tsx`, texts through `t()`): the « À vérifier » card and its section (see Activité above); the host gives the actions (search, confirm, dismiss, exclude).
- **`StarRating`**: 10 stars with halves as one `role="slider"` (← → ±0.5, Home / End, Enter confirms), half-star click, hover preview, read-only mode. Pages only: the content-safe `ui/star-rating.ts` (end-of-series toast) is unchanged until the toasts are redesigned.

## Mockups

The owner keeps the reference mockups in a private Claude Design artifact (not linked from this repository). Each screen migrated to Preact is checked against its view there. Decisions recorded on the mockups are summarised above.

## Ratchet

`src/ui/design-tokens.test.ts` scans `src/**/*.{ts,tsx}` (`*.test.ts` / `*.test.tsx`, test helpers and test data excluded; `.tsx` modules parsed as JSX, attribute strings included) and freezes, per file, in `src/ui/design-tokens.baseline.json`:

- **`arbitraryColors`**: Tailwind arbitrary values carrying a colour (`bg-[#…]`, `text-[rgb(…)]`, `shadow-[…_rgba(…)]`, `text-[color:…]`, `[text-shadow:…]`);
- **`hexColors`**: raw `#rgb` / `#rrggbb` / `#rrggbbaa` colours in string literals (comments ignored, colours already counted as arbitrary classes not counted twice). The Kai mascot drawings are exempt: `src/ui/kai-small.ts` and the large Kai drawing at the end of `src/ui/icons.ts`;
- **`pxFontSizes`**: arbitrary pixel font sizes, `text-[NNpx]`.

A count may only go down. A file above its frozen value fails (a new file starts at 0): use a token instead. A file below its frozen value also fails until the baseline is lowered (or the file removed from it at 0), so the ratchet tightens with every clean-up. Arbitrary pixel spacings are not counted: they go away during the Preact migration.
