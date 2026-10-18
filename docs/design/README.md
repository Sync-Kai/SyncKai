# SyncKai design charter

The graphic charter of the extension pages (popup, side panel, settings, import pages) and of the in-page toasts. It is the target of the UI redesign that moves the screens to Preact one by one. Until a screen is migrated, it keeps its current look: the tokens below exist in `src/ui/theme.css`. Migrated so far: the status bar of the popup and side panel with its account menu, and all of Settings: the shell (bar, home, navigation), Accounts, Sync (and its Matches and Excluded series pages), Platforms, Notifications, Display (and its Language and Shortcuts pages), My data (and its AniList ↔ MAL differences page, moved there from the popup's Activité) and Help & about; the popup shell (header, Watching / Activité tabs, host-access banner), the welcome screen, the « Mes séries » list with its sort menu and states, its row « ⋯ » menu, comment editor, the « Reprendre » card, the « Sur cette page » card and the Activité tab: nothing in the popup is vanilla any more; the side panel: its shell (header, tabs, off-page notice), its « En lecture » tab and its Agenda with the week calendar: nothing in the panel is vanilla any more. The history import page (frame, step indicator, steps 1 to 5) and the Backup page: no extension page is vanilla any more.

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
- At 320 px (side panel), the settings home keeps the row labels and the accounts summary; row descriptions and summaries are dropped. Made by a container query in `SettingsRow` (`NARROW_HIDDEN`, `@max-[304px]:hidden` on the card): the panel's scroll area has 12 px side padding, so the card measures 330 px in the 360 px panel (6 px scrollbar included), 290 px at 320 px and 270 px in the 300 px Firefox sidebar. Other texts of a page (help under a choice, notes) stay visible.
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
- « Commentaire… » opens the comment editor under the row (`ui/components/notes-editor.tsx`, mockup PopupSeriesCommentaire): « COMMENTAIRE » title, text area (read-only while the comment is read), counter (`butter` from 90 % of 6000), « Annuler » (text) and « Enregistrer » (secondary, disabled until the text changes, spinning while sent, area locked and « Annuler » greyed meanwhile); Ctrl+Enter saves, Esc or « Annuler » closes without writing; saved: the editor closes, the row shows « Commentaire enregistré », the focus goes back to « ⋯ ». A series in no list shows « Ajoute la série à ta liste pour la commenter. » in place of the editor. The side panel opens the same editor from its comment row (see Side panel « En lecture »).
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

### Side panel shell

Mockups PanelOuverture, PanelReglages, PanelReglages320, PanelFirefox, PanelHorsPage, PanelHorsPageVariantes; `sidepanel/panel-app.tsx` (rendering), `sidepanel/sidepanel.ts` (state and logic: followed tab, automatic tab switch, Settings loaded on first opening). `presence.ts`, `tabs.ts` and `toggle.ts` keep their logic; the shortcut close path (`toggle.ts`) is registered before any render or await.

- Header, 52 px at least: the « En lecture » / « Agenda » `Tabs` (play and calendar icons) and the gear (`aria-pressed`). While the followed tab is checked on opening: Kai, « SyncKai », the kana and the gear, then a centred spinner and « Vérification de l'onglet… ». Settings open: their back bar (« ← Retour », title) takes the place of the tabs, the gear is pressed (sakura); closing them gives the focus back to the gear. Next to the gear the bar's title may take three lines (« ← Synchronisierung » + « Ausgeschlossene Serien » at 320 px): the bar then grows.
- One scroll area per screen, 12 px side padding: the tab panel (`#sk-tabpanel-<tab>`, the scroll position of each tab is kept), or the Settings view (kept in the DOM once loaded). The shared status bar is the last element of the panel.
- Automatic switch (`tabs.ts` › `followPageContext`): off a streaming page, « En lecture » gives way to the Agenda, and comes back on a streaming page if the panel chose the Agenda itself. A tab chosen by the user is stored as the last tab; an automatic choice never is.
- Off-page notice (« En lecture » chosen off a streaming page): monitor icon, « SyncKai fonctionne sur … » and a chip with logo per tracked platform, then, under a separator, « … : à activer dans Réglages › Plateformes. » (the path opens that page) and one « Activer {platform} » button with its logo per optional platform still off (the access request is sent in the click). All platforms on: the sentence and the chips only. No « Voir les prochaines sorties dans l'Agenda » link (mockup PanelHorsPage; the owner's preferred block has none).
- The Agenda tab (`components/agenda.tsx`) reads the snapshot of `agenda-controller.ts`, created and activated when the tab first becomes visible.

### Side panel « En lecture »

Mockups PanelLecture, PanelLectureMenu, PanelLectureConfirm, PanelLectureDeplie, PanelCommentaire, PanelFicheDetails, PanelLectureEtats, PanelFicheEtats, PanelListeEtats, PanelSeriePage, PanelSaisonDevinee; `sidepanel/components/{now-playing,now-playing-hero,live-card,list-card,details-card,off-target}.tsx`. Data and actions stay in `components/now-playing-controller.ts` (on the shared page-media controller) and `components/live-progress.ts` (live port, render-free, a store read by the « Tu regardes » card only); `sidepanel.ts` publishes a snapshot for the tree. Cards: `surface`, `line` border, `radius-card`, 10 px apart.

- Before the entry: « Lecture de la page… » (spinner), the skeleton (banner, cover, the page's title as soon as it is known; `role="status"` `aria-busy`), « Ouvre une série ou un épisode… » (plus « Recharge l'onglet… » in `butter` when the content script stays silent), not found (magnifier, the message, then the « ヒント » hint; no « Réessayer »), not an anime (ban icon), platform turned off (power icon, « Réglages › Plateformes » as a link), error (series title and a `danger` `Alert` with « Réessayer »).
- Header card: AniList banner (or the cover colour gradient) with « Actualiser la fiche » over it (spins while the entry is read again; actions are greyed meanwhile), 64 × 90 cover (`Cover` size `hero`) and title link (fiche ouverte par défaut), info line, then average score, airing season, studio link, the next-episode pill (`mint` available, `lavender` upcoming, outlined finished / unknown) with its date, and the genres. « Détails AniList indisponibles » is a `danger` `Alert` with « Réessayer » under it.
- « Tu regardes » (episode pages): « Épisode 7 / 28 » on the right, then the live playback when the setting is on: `lavender` bar with the `butter` sync marker, « 14:40 / 23:40 » and the legend « Générique à 21:32 » / « Générique inconnu · synchro à 85 % », then the countdown as plain `muted` text (« Synchro dans 8 min 40 · au début du générique ») or the state with its icon (waiting, no video, paused + what the sync waits for, sync point passed, auto sync paused, syncing, synced, to check + reason, no account, failed + message, excluded, reload the tab). State changes only are announced.
- « Saison » (two choices or more): the `SeasonPicker` without frame (`framed={false}`), the guessed-season or manual-choice warning as a `butter` banner above it, « Changer de saison corrige la correspondance… » under it on a sure episode page.
- « Ta liste »: uppercase title, list status pill, the series « ⋯ » menu (`ui/series-menu.tsx`: statuses with the current one greyed, Abandonner / Terminé confirmed inline, « Ouvrir la fiche › », « Ne plus synchroniser cette série » / « Réactiver la synchro », « Retirer de la liste »), shown only when the series is in a list and replaced by a spinner while it is removed; « Progression » and the `Stepper` `pill`; one line per account (status, progress, « ★ 9/10 »); the action feedback (`FeedbackBanner`); « Ajouter à À regarder » / « Ajouter à En cours » where the series is missing. No account: the connect hint alone. The Pause / Abandon / Terminé button row is gone (menu).
- Foldable sections (`Collapsible` `row`, closed by default, state kept while the panel is open): « Note et commentaire » (`RatingBlock` without its title, then the comment row « ✎ Commentaire » with a one-line preview that opens the `NotesEditor`; saved, « Annuler » or Esc fold it back and give the focus to the row; in no list: row disabled and « Ajoute la série à ta liste pour la commenter. »), « Synopsis » (5 lines, « Lire la suite » / « Réduire »), « Suites et histoires liées » with its count (`agenda` cover, « SUITE · TV », title link, « Regarder » with the preferred player's logo), « Discussions » (episode thread search on Reddit, MAL forum, AniList).
- Not built from the mockups (no data or decision): « Saison 3 sur la page » next to the season title, two-line options in the season dropdown (native `<select>`), « Envoyée en 85 / 100 sur AniList… » under the stars, « Ajouter » on a sequel and its release date, the discussion rows with descriptions and the spoiler warning.

### Side panel Agenda

Mockups PanelAgenda, PanelAgendaSemaine, PanelAgendaAutreSemaine, PanelAgendaEtats, PanelAgendaMenu, PanelAgendaMenuRecherche, PanelAgendaHeure, PanelAgendaHeureEtats; `sidepanel/components/agenda.tsx` (rendering, « ⋯ » menu, delay editor) over the render-free `sidepanel/agenda-controller.ts` (week data, requests, cache), whose snapshot `sidepanel.ts` publishes for the tree.

- Days in chronological order, from the locale's first day of the week (Monday in most languages); the view scrolls to today once the week is shown (to the top after a change of week); past days are muted. The week navigation stays at the top of the scroll area (sticky).
- An empty day is a 24 px header with « Aucun épisode » right-aligned, no card. Today's header carries an outlined « Aujourd'hui » badge.
- Episode line: cover 32 × 44 (dimmed when seen), title (ellipsis, link to the entry) + « · Ép. N »; line 2: platform time in bold (`lavender` when the series has its own delay; another day than the broadcast: « dim. 00:30 ») · platform · « Japon HH:MM », the Japanese time cut first; without a platform nor a delay, « Japon **HH:MM** » alone. A seen episode starts with `mint` « ● Vu ». Then the `LogoButton` « Open » and « ⋯ ». Rows: 12 px left, 6 px right (the « ⋯ » has its own room), 10 px gaps, so the line keeps « 18:00 Crunchyroll » at 360 px.
- « ⋯ » menu (base `Menu`): « Ajuster l'heure » with a second line (`MenuItem` `description`: « 19:45 Netflix · réglé pour cette série » or « … · délai par défaut »), a separator, « Ouvrir la fiche › » (AniList / MyAnimeList of the connected accounts) and « Chercher sur… › » (active platforms with search and no known link, preferred player first), as in the series menu.
- Delay editor (« Ajuster l'heure », under the row): « Délai pour {title} », a numeric text field (↑ ↓ by 5 min, Enter saves, Esc cancels), « min », the preview « ≈ [logo] 19:45 » (`lavender` when it differs from the platform delay), the delay sentence and the range help. Out of range or empty: field and help `danger`, no preview, nothing saved. Saving: field and buttons greyed, spinner in « Enregistrer ». Failure: « Non enregistré, réessaie » (`danger`, alert icon). « Par défaut » only when the series has its own delay. Closing it (saved, Annuler, Esc) gives the focus back to the row's « ⋯ » (audit 4-A2).
- States: skeleton (3 cards, `aria-busy`); no account, no series in progress (with the optional platforms granted), empty week: a card with the calendar icon; error without a saved week: the same card with the alert icon and « Réessayer »; saved week shown after a failure: a `danger` `Alert` « Agenda enregistré affiché · {error} » with « Réessayer » above the days; refresh in the background: a spinner in the week button.

### Week picker

`ui/components/week-picker.tsx` (`WeekPicker`, unit-tested in happy-dom); mockups PanelAgendaSemaine, PanelAgendaAutreSemaine.

- Navigation ‹ [📅 dates ▾] ›, plus « Aujourd'hui » (small secondary button, the host's `trailing`) when another week is shown. Under 300 px of navigation with « Aujourd'hui » (under 240 px without), the dates use the short month and the calendar icon is hidden; the button's accessible name is always the full dates, announced on each change.
- The centre button opens a month calendar under the navigation (`raised`, `field` border, `radius-menu`, `shadow-pop`): month title between its ‹ ›, weekday initials, 6 fixed week rows of 36 px (the whole row clickable, the shown week outlined in `field`, the active week on `line`, days of other months muted), today ringed in `lavender`, a footer with the key hint and « Cette semaine » (disabled on the current week).
- Keys (the week list is a `role="listbox"` with `aria-activedescendant`, focused on open): ↑ ↓ week (the month follows), PgUp / PgDn month, Home this week, Enter / Space show it, Esc closes and gives the focus back to the button; Tab out or a pointer outside closes. Mouse wheel / trackpad over the calendar: previous / next month, one month per gesture (page scroll prevented).
- Data (`agenda-controller.ts`, unit-tested): browsing months sends nothing (the picker calls `onSelect` only for a chosen week, never for the one already shown); a chosen week (or « Aujourd'hui ») is loaded at once, one request; ‹ › are debounced 300 ms, one request for the final week; weeks received by the page (responses, even those arriving after the week was left, and fresh storage caches) are kept for its lifetime and shown again at once without a request while they cover the series in progress (« Réessayer » always asks again).

### History import page

Mockups ImportChoix, ImportChoixEtats, ImportLecture, ImportAnalyseFin, ImportErreurs, ImportApercu, ImportApercuVariantes, ImportApplication, ImportTermine; `import-cr/components/{import-app,steps,platform-choice,progress,preview}.tsx` over the page state (`import-cr/state.ts`, published to the tree by `publish()`), pure rules in `import-cr/view.ts` (screen shown, current step, platform state, reading and job texts) and `import-cr/preview.ts` (summary tiles, chips, row results, button hint, end-of-import banner, proposed entry). Reading, analysis and import logic stay in `import-cr.ts` and `import-cr/sources/`.

- Full tab: 52 px header (Kai, « SyncKai », the kana) with a bottom `line` border, then a 576 px column (16 px gutters in a narrow window): title (`text-stat`, display font), « Ton historique {platform} → AniList / MyAnimeList. », the step indicator, the page notice (`FeedbackBanner` `success`: partial history) and error, then the step.
- Step indicator: five numbered 20 px circles joined by flexible 1 px lines; current step `lavender` filled with `on-fill` digits and `ink` label (`aria-current="step"`), done steps a `mint` check on a `mint` tint with a `mint` line after them, next steps a `line` border. Under 34 rem of indicator only the current step keeps its label (the others stay for screen readers). Steps: 1 platform choice (and loading), 2 reading, 3 analysis starting / running / ended, 4 preview, 5 import running; an import finished marks all five done.
- Loading: one card with a spinner and « Chargement… »; no tile and no button until accounts, access and the stored job are read.
- Step 1: « PLATEFORME DE L'HISTORIQUE », three tiles (native radios in a fieldset, one tab stop; 3 columns from 30 rem, stacked below): 28 px logo, bold name, radio circle, then the state with its icon: « Onglet prêt » `mint` check, « Aucun onglet ouvert » `muted` tab icon, « En attente de l'onglet… » `lavender` spinner (after « Ouvrir … »), « Accès à autoriser » `butter` alert icon (Netflix optional access, or Crunchyroll / ADN access removed on Firefox). The chosen tile has a `raised` background and a `lavender` border. Then the message of the last reading (a `danger` `Alert` with « Afficher l'onglet » or « Recharger l'onglet »; an empty history is a `lavender` information banner), « COMMENT ÇA MARCHE » (intro, rules with tinted icons, the Netflix « Voir plus » rule), and the action bar: the tab state (title of the tab in full, wrapping) and one primary button: « Lire mon historique », « Ouvrir {platform} » (busy while waiting for the tab) or « Autoriser l'accès » (request sent in the click; the rules are hidden until access is granted). No connected account: the tiles and the `danger` alert only. Tabs are re-read every 2 s on this step and when the page is shown again; access too on return.
- Step 2: a card with the reading state (spinner, bold), « Arrêter » (`danger` `sm`), the bar once the total is known (« Vérification de la numérotation »), and « Garde l'onglet … ouvert ». Netflix: the logo and « Lecture de l'historique Netflix », then its three steps (done: `mint` check and the count; current: spinner, bold, bar indented under it; next: a small `field` circle, `muted`).
- Step 3: « Démarrage de l'analyse… » (no bar, no « Arrêter »), then the job card: « Analyse : 42 / 120 saisons », « Arrêter » (« Arrêt… » busy once asked), the bar (full while the lists are read last), the pause line (`butter` clock, countdown every second: rate limit, quota, AniList unreachable, resume) and « Rien n'est encore écrit… » with a shield. The import job of step 5 uses the same card. Analysis ended without a preview: `danger` alert (interrupted, with its reason) or `butter` (stopped by the user), and « Recommencer » (secondary, right).
- Step 4 (mockups ImportApercu, ImportApercuVariantes; `components/preview.tsx`, rules in `import-cr/preview.ts`): the summary card (« 214 saisons lues », then one tile per count: number in the display font over its label, « séries à mettre à jour » always (`lavender` tint, even at 0), « à vérifier » `butter`, « déjà à jour », « exclues », Netflix « titres ignorés » neutral `raised`, « introuvables » `danger`, only when not zero; 96 px tiles that wrap; « Seul AniList est connecté… » with a `lavender` info icon and the partial-history notice with a `butter` one). « À METTRE À JOUR » with « Tout cocher » / « Tout décocher » (secondary `sm`), then one card of rows separated by `line` rules: a native 18 px `Checkbox` (the whole row is its label), `agenda` cover, title, « Crunchyroll : Dandadan · S1 », one chip per account (16 px logo; `lavender`/14 when it moves forward « 3 → 6 », « ajout → 12 (terminé) »; `raised` and `muted` with a dimmed logo for the reason nothing is written: « déjà à jour », « revisionnage en cours »…). Under the card, the primary « Mettre à jour N séries » with a `muted` hint on its left only when it helps: a line left unchecked, none checked (button disabled). Nothing to update: a `mint` banner « Tes listes sont déjà à jour… » in place of the card. « À VÉRIFIER (N) » (`butter` section title, not foldable): an info line, the seasons grouped by series (dotted rules), each with its checkbox, « S2 · épisode 25 », « N saisons réunies » in `lavender` (seasons in a tooltip), the reason, and the entry its check card will propose (cover, title, « proposée » badge, « TV · 12 ép. · 2024 », « Aussi au choix : … » for up to three other entries, the match saved earlier included when the analysis contradicted it); « Créer N vérifications » (secondary) while some remain; a created one shows a `mint` frozen check and « · vérification créée ». « Déjà à jour (N) » is a foldable card row (`Collapsible` `row`, closed by default, kept open across renders), its rows without checkbox. « Recommencer » (secondary `sm`) under a dotted rule.
- Step 5 (mockups ImportApplication, ImportTermine): the job card of step 3 above the preview, which stays shown but locked (checkboxes, « Tout cocher », the buttons disabled; hint « Cases et boutons bloqués… »); the summary tiles are hidden while an import is shown. A written row gets a `mint` frozen check and « Mis à jour » in `mint`; a failed one its reason in `danger`; a skipped one its reason in `muted`. Ended: a banner above the list until « OK » (`radius-menu`, tinted border): finished = `mint` (or `butter` with failures, `danger` when nothing was written) with the head in `ink` and the failure reasons listed under it; stopped by the user = `butter` text; interrupted = `danger` text with the reason (role="alert"). Unwritten series stay checked, with the hint « Les séries pas encore écrites restent cochées » / « Les séries en échec restent cochées ». The step indicator stays on 5 after a stop and marks all five done when the import finished. The « N vérifications créées » notice is the frame's `mint` banner.

### Backup page

Mockups Sauvegarde, SauvegardeEtats; `src/import/components/backup-app.tsx` over `import.ts` (logic, a store) and `import/view.ts` (pure, tested: file contents, mode and settings rules).

- Same frame as the import page (`PageHeader`, 576 px column), title « Sauvegarde » and its subtitle, then two sections.
- « EXPORTER »: a card with a `lavender` download tile, « Télécharger un fichier .json » and its help, « Exporter » (secondary, busy while exporting); two boxes side by side from 26 rem of card (stacked below): « INCLUS » (`raised`, `mint` title and checks: settings, matches and excluded series, history) and « JAMAIS INCLUS » (`line` border, `danger` title and cross: the AniList / MyAnimeList sign-ins); then « Téléchargement lancé » (`mint` check) or a `danger` `Alert`.
- « IMPORTER »: before a file, the intro, the refusal (`danger` `Alert`: too large, unreadable, not JSON, not a backup, corrupted, unsupported version) and « Choisir un fichier… » (a label styled as a secondary button around the hidden file input, focus ring on the label); while reading, a spinner line. A file read: a dashed `field` box with the file icon, its name, « exportée le … (v2.3.1) » and « Choisir un autre fichier… » (`sm`); « CONTENU DU FICHIER », a `raised` table of label / value rows (« inclus » `mint` or « absents » `butter` for the settings), the invalid-items line in `butter`; « MODE D'IMPORT » as two `ChoiceCards` side by side (`columns`: « Fusionner (recommandé) », « Remplacer »); the « Importer aussi les réglages » `Checkbox` (disabled with « (absents du fichier) » when the file has none; checked by default in Replace); the failure `Alert`; under a rule, « Importer » (primary, « Import… » busy). Replace asks first: in place of the button, a `danger` tinted box with the warning, « Annuler » (focused) and « Effacer et importer » (`danger`), Esc cancels. While importing, the file contents are hidden and every control is disabled. Done: a `mint` check circle, « Import terminé », « Tu peux fermer cet onglet. » and « Fermer l'onglet ».

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
- **Focus**: Preact keeps nodes across renders; where a render removes the focused element, `useFocusFallback` moves the focus (same key, declared `data-focus-fallback`, given fallback, then neighbours: `ui/dom.ts` › `pickFocusKey`).

### Base components

Components in `src/ui/components/`, built from the tokens above. Every visible or accessible text is a prop that the caller fills with `t()`. The status bar is the first shipped screen that imports them, so `src/ui/theme.css` no longer keeps them out of the Tailwind scan (`components/scan.test.ts` enforces it both ways: the exclusion comes back only if no shipped module imports them). Dev-only gallery of every component in its states, at 400 and 360 px: `node scripts/screenshots/gallery.ts [--out <dir>]` (default `<tmp>/synckai-gallery`).

- **`Button`**: `primary` (one per surface), `secondary`, `ghost`, `danger`, `text`; `sm` / `md`; leading icon; `busy` (aria-busy, focus kept, clicks ignored); `<a>` when given `href`.
- **`IconButton`**: 28 px round icon button; `label` is required (aria-label and tooltip); optional line border, menu and pressed states.
- **`Stepper`**: « Ép. x / y » in tabular figures, then ghost − / + of 24 px; a reached bound disables its side; `busy` keeps both focusable (aria-disabled) and ignores clicks; `incrementHidden` drops the +. Variant `pill` (« Sur cette page »): − / text / + in a `raised` pill, 30 px buttons, + filled sakura.
- **`LogoButton`**: 32 px round « Open » link, neutral surface with a line border, 18 px platform logo.
- **`Switch`**: `role="switch"` button with `aria-checked`; Space and Enter toggle it.
- **`Checkbox`**: native 18 px checkbox (`appearance-none`, `radius-cover`): `field` border, `lavender` with an `on-fill` check when checked, dimmed when disabled; `done` = a frozen `mint` check on a tint (import row written, check created). Put it inside a `<label>` to make the whole row clickable.
- **`PageHeader`**: the 52 px header of the full tab pages (Kai, « SyncKai », the kana), aligned on the page's column.
- **`ServiceLogo`**: AniList / MAL / platform logo at 16, 18, 22 or 28 px (`tile`, Settings › Platforms rows) with an optional state badge (`ok`, `info`, `warn`, `error`, `expired` = greyed logo and red dot).
- **`Cover`**: `row` (42 × 57), `agenda` (32 × 44), `card` (44 × 62) or `hero` (64 × 90, side panel « En lecture ») cover, image or initials, optional 3 px lavender `progressbar` (none when the total is unknown).
- **`StatusText`**: 6 px dot and text in the tone colour, truncated with a tooltip.
- **`Section`**: uppercase `text-section` title naming its content; optional count aligned right (« CRUNCHYROLL ··· 61 ») or, with `countInline`, after the title (« ÉCHEC · 1 », Activité); tones `danger` (« Zone de danger », failed syncs), `info`, `warn`, `accent` (Activité sections).
- **`SettingsCard` / `SettingsRow`**: rows card (`@container`) and row with tinted icon (or a 28 px `leading` visual such as a platform logo), title, description, then summary + chevron or a `Switch`; under 304 px of card, description and summary are hidden (the description stays the tooltip and `aria-describedby`); a `warn` description (« En pause : aucun épisode n’est envoyé ») is `butter` with a pause icon; `href` + `external` opens a site in a new tab with ↗ instead of the chevron (Help & about links).
- **`Segmented`**: radio group in a pill (`ground` track, neutral selection), one tab stop, arrows / Home / End choose; `fill` gives equal-width options on the whole line, a long label wraps on two lines; `disabled` greys the whole group.
- **`ChoiceCards`**: exclusive choice as cards (Sync « Épisode compté comme vu », Notifications style): a legend, one native radio per card (one tab stop, arrows choose), bold title, `muted` description, optional badge (« Recommandé ») and visual; the chosen card has a `raised` background and a `lavender` border, the others a `line` border. `flush` drops the borders (cards inside a card, the chosen one on `raised`) and `legendHidden` keeps the legend for screen readers only (Notifications). `columns` puts two cards side by side from 26 rem of container (Backup page).
- **`Select`**: row-wide button (label left, chosen value with its logo right, chevron) opening a `role="listbox"` under it (menu surface); focus on the list with `aria-activedescendant`, ↑ ↓ Home End move, Enter / Space choose, Esc / Tab / outside pointer close; a disabled option stays listed, greyed, with a `butter` hint (« Activer d’abord »).
- **`Alert`**: error inside a card (`danger` border and text, alert icon), optional secondary action (« Réessayer », with its icon and `data-focus` key); `data-alert` feeds the page's live region. `tone="warn"` (with its own `icon`) for « nothing found ».
- **`AccountAvatar`**: profile picture or brand gradient with a person glyph, 16 px service logo in the corner; 36 px (account menu) or 44 px (Settings › Accounts); expired = dimmed, not connected = dashed circle.
- **`Collapsible`**: header button with `aria-expanded` / `aria-controls`, chevron and optional count; controlled or not; `variant="section"` makes the whole section foldable (uppercase section title in an `<h2>`, count pill, chevron on the right: developer tools of Help & about); `variant="row"` is a full-width row of a card of sections (bold title, `muted` count, chevron on the right, content under it: side panel « En lecture »).
- **`Tabs`**: pill tablist, neutral selection, roving tabindex, arrows / Home / End select; a tab may carry an icon, a count badge and its own accessible name; `controls` names the host's panels. Under 264 px of tablist (side panel at 320 px, Firefox sidebar), the labels go to 12 px and the icon gap to 4 px, so « Reproduciendo » or « Sedang diputar » fit next to the gear.
- **`Menu` / `MenuItem` / `SubMenu` / `MenuSeparator` / `MenuConfirm`**: the row « ⋯ » menu; ↓ / ↑ on the closed button opens it; roving focus, Tab / Esc / outside click close it (`useDismiss`); sub-menus open on hover after a short intent delay, on click, → or Enter, and close on ← or Esc; danger items; `tinted` colours the label with the icon tone; `keepOpen` keeps the menu open after the choice; `checked` makes exclusive choices (`menuitemradio`, check mark, focus opens on the checked one); `hint` adds a muted mention at the end (« Statut actuel »); `description` adds a muted second line that wraps without widening the menu (Agenda « Ajuster l'heure »); `MenuConfirm` is the inline confirmation (question, optional explanation, Oui / Non menu items, focus on Non, Esc cancels it before closing anything).
- **`WeekPicker`**: week navigation ‹ [📅 dates ▾] › with its month calendar (see Week picker); props only (labels, locale, first day of the week), `onStep` for ‹ ›, `onSelect` for a chosen week, never called while months are browsed.
- **`NotesEditor`**: the comment editor of a series (see « Mes séries » row above); `inline` variant for the card details.
- **`MediaHeader` / `ServiceLines` / `SeasonPicker` / `RatingBlock` / `StatusActions` / `AddToListButtons` / `FeedbackBanner` / `MediaDetails`**: the parts of the « Sur cette page » card (see above), props only, reused by the side panel's « En lecture » (`SeasonPicker` `framed={false}`: warning banner above the dropdown; `RatingBlock` `labelHidden` inside « Note et commentaire »).
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
