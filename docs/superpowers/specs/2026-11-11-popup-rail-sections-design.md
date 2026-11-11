# Popup rail: « Pour toi », Agenda and Stats (2.5.0)

**Status:** owner's answers of 2026-11-11, then autonomy granted (« je te laisserai travailler par agent pour toutes les features à monter »). Each call the assistant made in the owner's absence is marked « call »; the owner reviews them on return, before the tag.

**Mockups:** the « Maquettes SyncKai » page (rail with five sections: `img/status/option-*.webp`) and the « Largeur du popup SyncKai » page (`img/r56-foryou.webp`: the « Pour toi » screen in the R56 rail; « Stats » was marked as an illustrative entry). Both are claude.ai artifacts.

## Intent

The approved 2.5.0 design shipped a two-section rail (« En cours », « Activité ») and deferred « Pour toi », the Agenda and « Stats » to 2.6.0 (`2026-11-08-2.5.0-design.md:24`). The owner wants the release to wait until the rail matches the mockups: five sections, then the side-panel button and Settings at the bottom. The popup becomes a complete home: what to watch next, what airs this week, and what you have watched.

## Goals
- Three new rail sections, in this order: Mes séries, Activité, **Pour toi**, **Agenda**, **Stats**. The bottom keeps the side panel and Settings, with **less space between those two buttons** (owner).
- **Pour toi:** the « Découvrir » card of the panel, in the popup, plus a way to change the criterion (owner: « permettre de changer le critère »).
- **Agenda:** the panel's Schedule in the popup: the « Semaine » and « Annoncées » views, week navigation, « Ajuster l'heure », the « ⋯ » menu. It stays in the panel too.
- **Stats:** what you watch and what SyncKai did for you, with several filters, at no real extra cost.
- The empty « Mes séries » state's « Plus d'idées dans le panneau » becomes « Plus d'idées » and opens « Pour toi » in the popup.

## Non-goals
- No new section in the side panel; it keeps its three tabs.
- No badge on « Pour toi » (owner).
- No new MAL-backed feature beyond what the MAL rule allows (the user's own profile statistics, already read).
- No server, no new host, no new permission.

## Anti-goals
- **Bulk reading of AniList.** Stats must not read the whole list on every opening. AniList terms: fetch what is shown, cache briefly.
- **Duplicated code.** The popup sections reuse the panel's controllers and components (`ui/`), and screens never import each other.
- **Clipping** at 440 px or under zoom (the fixed-body layout from POP-01 stays).

## Constraints
- `CLAUDE.md`: Preact, Tailwind, the design charter, 21 languages, tests first, module boundaries (`src/architecture.test.ts`), no new `addListener` in `background/`.
- Popup 496 × 600: rail 56 px plus a 440 px content column, with the fixed-body layout.
- The rail is `ui/components/nav-rail.tsx`; adding a section is one item (2.5.0 design § 5.1).

## Approaches considered
1. **Reuse the panel's pieces, mount them in popup screens** (chosen). « Pour toi » mounts the existing reco controller and `RecoCard`. The Agenda mounts the agenda controller and component, moved to `ui/` where they are shared. Stats is a new screen with a new pure reducer. This is the least code, keeps a single behaviour, and keeps the screens from importing each other.
2. Open the side panel on the matching tab from the rail. Rejected: it is not what the mockups show, Firefox and the panel gesture rules make it fragile, and it changes window.
3. Copy the panel components into the popup. Rejected: the code would be duplicated and diverge.

## Design

### Rail
- Items: `watching`, `activity`, `foryou` (sparkles icon), `agenda` (calendar icon), `stats` (bar chart icon). Each has a tooltip and an accessible name equal to its title.
- Bottom group: the side panel and Settings, closer together. Call: half of today's gap, keeping 44 × 44 targets.

### Pour toi
- The panel's « Découvrir » card and states, through the same `ui/reco-controller.ts` with one batch and the same messages.
- Title « Pour toi » with the subtitle « D'après tes notes » (the mockup's wording adapted to MAL-only users).
- **Changing the criterion** (call): filter chips that filter the batch already built, with no request.
  - **Genre:** the batch's genres, translated with `genre.*`; one at a time, plus « Tous ».
  - **Format:** « Tous », « Séries », « Films ».
  - When a filter leaves nothing: an empty state and a « Retirer le filtre » action.
  - The filter lives in the popup's preferences (remembered) and does not affect the panel.
  - 🎲 draws within the filter.
- The empty « Mes séries » link opens this section.

### Agenda
- The panel Schedule's component and controller (`sidepanel/agenda-controller.ts`, `sidepanel/components/agenda.tsx`) move to `ui/`, or get a `ui/` wrapper, so both screens use them. The behaviour is identical: the « Semaine » and « Annoncées » views, the 10-minute check of announced sequels, alerts and offsets.
- The 440 px width gives the rows more room: no truncation where the panel truncated.

### Stats
Two sources, both without real extra cost:
1. **The profile statistics, all time.** These are the request already made for the account menu, cached as today, with more fields and no extra request:
   - **AniList** (`Viewer.statistics.anime`):
     - `count`, `episodesWatched`, `minutesWatched`, `meanScore`;
     - `statuses { status count }`;
     - `formats { format count }`;
     - `genres(limit: 6, sort: COUNT_DESC) { genre count meanScore }`;
     - `scores(sort: MEAN_SCORE) { score count }`, in the user's score format;
     - `studios(limit: 5, sort: COUNT_DESC) { studio { name } count }`;
     - `releaseYears { releaseYear count }`, grouped by decade.
   - **MAL** (`anime_statistics`, already requested):
     - the items per status;
     - days, episodes;
     - times rewatched;
     - mean score.
     MAL has no genres, formats, scores or studios: those blocks are hidden.
2. **SyncKai's activity, filterable by period.** A new small local history counts the episodes SyncKai synced and their minutes per day, per service. It covers 400 days at most, a few kilobytes, and is written where `weeklySyncs` is written today.
   - It is account-bound and cleared with the user's data at sign-out.
   - It is in the Backup: call, consistent with `recentSyncs`.
   - It is described in `PRIVACY.md`.
   - Before 2.5.0 there is no history, so the screen says « depuis le … » with the first recorded day.

**Filters** (owner: « plusieurs filtres, sans réel coût »):
- **Service:** AniList or MAL, following the switch of « Mes séries ».
- **Period, for SyncKai's activity:** 7 days, 30 days, 12 months, everything.
- The profile blocks are labelled « Depuis le début », because AniList and MAL only give all-time totals.

**Screen, top to bottom** (call, to confirm with the mockup before the code):
- SyncKai's activity for the period: episodes synced, time, and a small bar chart per day or per month;
- in progress: series and time to catch up (`remaining-time`);
- the profile totals;
- the status breakdown;
- the mean score and the score distribution;
- the top genres;
- the formats;
- the top studios;
- the decades.

**Loading and errors:** the cached profile shows at once, with a refresh on opening. « Session expirée » and errors use the usual paths.

**Charts:** plain HTML and CSS bars, no chart library. The `dataviz` skill gives the palette, mapped to the charter tokens.

## Privacy and store
- New stored data: the per-day sync counters.
- New fields read: AniList statistics.
- `PRIVACY.md` (EN, FR, DE), the CWS `storage` block and the data notes are updated by the last task; the owner pastes them before the tag.

## Left to the builder
- The exact component moves (agenda to `ui/`) and the props.
- The chart markup.
- The empty states.
- The translations of the new strings: 21 languages, context notes, term sheets.
- The mockups of Stats and of the popup Agenda, to show the owner on return.

## Calls after the builder check (owner away, to review on return)

1. **Lifetime of the activity history.** User-scoped, stored per service with the account id. It survives session expiry and a reconnect to the same account. A service's part is dropped when a different account signs in on that service, and everything is dropped with the user's data at the last sign-out (the `user` scope of `ACCOUNT_STORES`). Why: an expired token must not erase up to 400 days of statistics.
2. **Service filter in Stats.** Stats has its own AniList / MAL segmented control, shown only when both accounts are connected.
   - Default: the « Fiche ouverte par défaut » service (`activeService()`).
   - The choice is remembered in the popup preferences. It changes neither that setting nor « Mes séries ».
   - Both profiles are already cached by the account menu.
3. **Announced sequels in the popup.** The Activité section « Suites annoncées » and the rail's dot on Activité stay as they are. The Agenda's « Annoncées » view is the calendar view, identical to the panel's: it does not mark sequels as seen. The panel already shows both, so this adds no new duplicate.
4. **Order of work.** The Stats screen is built right after its mockup, without waiting for the owner, who reviews everything before the tag.
