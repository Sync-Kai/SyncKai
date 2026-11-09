# Sequel alerts — design

Part of the single 2.5.0 release (branch `feature/sequel-alerts`, stacked on `feature/discover`). Owner's choices were made on the mockup page (2026-11-06) and confirmed on 2026-11-09; mockups and the UX study: options 2 + 3 + 4 of « Alerte de suite annoncée ».

## 1. Intent

A series the user finished, is watching or is rewatching gets a sequel on AniList. Today nothing tells them: they find out by chance, often months later. SyncKai already knows their lists and reads AniList daily for airing alerts, so it can tell them once, at the right time, and let them add the sequel to their Planning in one click. Success: the user learns about every sequel of the series they care about, once, without noise, and never has to open AniList to find it.

## 2. Goals, non-goals, anti-goals

Goals:
- Detect sequels of the user's series once a day, in the background.
- Tell the user once: a browser notification (single or grouped), then the decision waits in the popup's *Activité*.
- Show announced sequels where the user already looks: *Activité* section, a badge on the related entry in the side panel, and an « Annonces » view in the panel Agenda.
- « + À regarder » (add to Planning) from the notification (Chrome), from *Activité*, from the panel and from the Agenda view.
- Works for AniList accounts and for MAL-only accounts (AniList catalogue read for them: owner's decision of 2026-11-09, grey zone of AniList rule 5 accepted).

Non-goals:
- No season catalogue, no « upcoming anime » discovery beyond sequels of the user's own series (recommendations are a separate feature).
- No new status-bar state (owner kept only the panel part of option 4).
- No cover image in the notification (v1 uses the Kai icon: `s4.anilist.co` is not in `connect-src`).
- No MAL API data for this feature (MAL is only read for the user's own list, as today).

Anti-goals (a failure even if it technically works):
- A burst of notifications when the feature first runs or after an update.
- The same sequel notified twice (date change, status change, worker restart, two accounts).
- Proposing a sequel already in one of the user's lists.
- Hoarding AniList data (AniList terms rule 3) or a noticeable increase of requests on the interactive lane.

## 3. Constraints

- AniList terms (`docs/memory/auth-and-api-terms.md`): read only the relations of the user's own series, once a day, background lane; keep only the state of the sequels shown, account-bound, capped.
- Service worker: no new `addListener` (counts frozen by `src/architecture.test.ts`); no `storage.onChanged` in `background/`. The check rides the existing hourly airing alarm (`synckai:airing`) and the existing notification `onClicked` / `onButtonClicked` listeners, dispatched by id prefix.
- The alarm currently exists only when `airingAlerts` is on and a service is connected (`browser/airing-alarm.ts` › `ensureAiringAlarm`): it must also exist when `sequelAlerts` is on.
- Account-bound data: the state store follows the epochs rules (`writeIfSession(s)`, purge on sign-out, declared in `browser/storage/account-keys.ts`).
- Blocked notifications: reuse the `getPermissionLevel` check of `bugfix/blocked-notifications` (`background/airing.ts` › `notificationsBlocked`).
- Firefox: no notification buttons; a click opens the entry.
- UI: Preact, design charter `docs/design/README.md`, popup 496 px with 440 px content; every new string in 21 languages with its context note.
- Tests first for the pure rules (detection, state transitions, date label, grouping).

## 4. Approaches considered

1. **Daily pass on the existing hourly alarm** (chosen). Read the user's full lists, then the relations of their series in batches, keep a per-sequel state. ≈ 15 background requests a day for a 400-series list. Covers every series, no new listener.
2. Only the relations already loaded by the side panel (`PanelMedia`, 6 h cache). No extra request, but misses every series the user never opened in the panel: rejected.
3. Read AniList's upcoming-season catalogue and match it against the lists. Mass collection of catalogue data (AniList rule 3) and many more requests: rejected.

UI channels (owner's choice): option 2 (notification + *Activité*) + option 3 (Agenda « Annonces ») + the panel part of option 4. Option 1 (Activité only) rejected: whoever does not open the popup never learns.

## 5. Design

### 5.1 Detection (service worker, `background/sequels/`)

- **When**: in the hourly alarm handler, at most once per 24 h (`sequels:lastCheck`, account-bound), after the airing check, on the background lane. Skipped when `sequelAlerts` is off, no service is connected, or (for the notification step only) notifications are blocked.
- **Source series**: the full lists of the connected accounts.
  - AniList: `fetchAniListFullList` (existing, background lane).
  - MAL: `fetchMalFullList` (existing), then MAL ids → AniList ids with an `idMal_in` query (existing pattern `CATALOG_BY_MAL_QUERY` / `compare.ts` › `resolveMalOnly`).
  - Kept statuses: completed, current, repeating. Paused, dropped and planning are ignored. Excluded series (`getExcludedSeries`) are ignored.
- **Relations query** (new): `Page(perPage: N) { media(id_in: $ids) { id relations { edges { relationType node { id idMal type format status title { userPreferred } coverImage { medium } siteUrl startDate { year month day } season seasonYear } } } } }`, in batches. N = 50 if the real API's complexity allows it, else the largest size that stays under the limit (to measure before coding, on a real list; record the figure in the plan).
- **A sequel is a candidate** when: `relationType` SEQUEL, node type ANIME, format TV, TV_SHORT, ONA or MOVIE, status NOT_YET_RELEASED or RELEASING, and its AniList id (or its `idMal`) is in no list of any connected account (any status, planning included).
- **State store** (`sequels:state`, scope `account` in `browser/storage/account-keys.ts`: cleared when any session ends, so a sign-out or an account switch restarts with a silent first pass and the old account's dismissals never apply to the new one):
  - `records`: one per sequel id `{ sequelId, sourceId, firstSeenAt, state: 'new' | 'seen' | 'dismissed', snapshot }`, `snapshot` = the fields shown (title, format, status, date parts, season, cover, siteUrl, idMal, source title). Refreshed at each daily pass (date or status changes update the row, never re-notify).
  - `known`: ids of every sequel ever recorded (notified, seen, dismissed or added), at most 2000 numbers, oldest dropped first. A candidate whose id is in `known` never becomes `new` again, so pruning `records` can never re-notify.
  - `seeded`: the services (`anilist`, `mal`) whose list has already been through a pass.
  - Pruning: a record whose sequel is no longer a candidate (entered a list, or no longer NOT_YET_RELEASED / RELEASING) is removed (its id stays in `known`). Then at most 200 records: `dismissed` dropped first, then the oldest `seen`; `new` records beyond 200 are dropped oldest first (still in `known`, never notified: acceptable for a list that large).
- **New vs already known**: a candidate whose id is not in `known` becomes `new`. A candidate whose source series come only from services not in `seeded` (very first pass, or MAL connected later while AniList already ran) is recorded as `new` but **not notified** (no burst). A RELEASING sequel is shown with the label « Déjà en diffusion » (owner's choice: proposed once, like an announcement).
- **Request budget**: 1 AniList list request (+ chunks over 500 entries), MAL list pages + `idMal_in` batches, relations batches; all on the background lane, reserved slots like the other jobs; a failed pass leaves `sequels:lastCheck` unchanged (retried next hour, at most once per hour).

### 5.2 Notification

- New records of a pass (not the first pass), `sequelAlerts` and `sequelNotifications` on, notifications not blocked:
  - 1 new sequel → one notification, id `synckai-sequel:<sequelId>`, title « Suite annoncée : {title} », message « {date} · {source relation line} ». Chrome buttons: « + À regarder », « Ouvrir la fiche ». Click on the body: open the sequel's AniList page (`siteUrl`).
  - 2 or more → one grouped notification « {count} suites annoncées », id `synckai-sequel:group:<timestamp>`, button « Voir dans SyncKai »; click: open the popup on *Activité* (`openPopupOn('activity')`), falling back to the first sequel's page when the popup cannot be opened.
  - Silent (`priority: 0`, no `requireInteraction`), Kai icon.
- « + À regarder » from the notification: the existing `ADD_TO_LIST` path (`controls.ts` › `addToList`, guarded writes), status PLANNING, then the notification is updated with the outcome (« Ajoutée », « Déjà dans ta liste », or the failure) and the record is removed on success (its id stays in `known`).
- Routing: the existing `handleNotificationClick` / `handleNotificationButton` dispatch on the prefix (`synckai-airing:` → airing, `synckai-sequel:` → sequels).
- Notification failure: the record stays `new`; it is still shown in *Activité* (no retry of the notification itself).

### 5.3 Popup › *Activité*

- Section « Suites annoncées », between « À vérifier » and « Dernières synchros », shown only when it holds a `new` or `seen` record.
- One card, compact rows separated by rules (like the Agenda): cover 32×44, title, « ● {date} · {format} » (grey dot when the date is unknown), secondary `sm` button « + À regarder », × to dismiss. More than 3 rows: « N autres suites annoncées » collapse.
- Opening *Activité* marks every `new` record `seen`. While a record is `new`, the *Activité* rail item shows a dot (no number; decorative, the accessible name says it).
- × → `dismissed` (hidden everywhere). Focus moves to the neighbouring row (`useFocusFallback`).
- « + À regarder »: result per service, shown on the row until the popup closes. Any success removes the record from the store (« in a list of any connected account » ends the alert); a total failure keeps it with « Réessayer ». No `idMal` (sequel not yet on MAL) or a MAL failure next to an AniList success: the row says « pas encore sur MyAnimeList » / the error; catching MAL up is left to *Settings › My data › AniList ↔ MAL differences* (no per-service retry: `addToList` writes every connected service).

### 5.4 Side panel › related entries

- `PanelMedia` relation nodes gain `status` and `startDate { year month day }` (query change in `anilist/panel-media.ts`; the 6 h session cache key gets a new version so old entries are not read with the new shape).
- A SEQUEL relation that is NOT_YET_RELEASED gets a badge « Annoncée » + its date; RELEASING and not in the user's lists: « En diffusion ». Either gets a « + À regarder » action when the entry is in no list (same `ADD_TO_LIST` path). Works without the state store (data from `PanelMedia`).

### 5.5 Panel Agenda › « Annonces »

- A two-choice switch in the Agenda's sticky header: « Semaine » (today's view) / « Annonces ». The choice is kept for the page's lifetime (not stored).
- « Annonces » lists the `new` and `seen` records, grouped by release period: exact or month date → its anime season (« Hiver 2027 »), season only → that season, year only → « 2027 », nothing → « Date à venir » last. Within a group: by date, then title. `new` rows carry a « Nouveau » badge. Row actions: « + À regarder », ×, open the entry.
- No extra request: data from the state store (read through a message to the service worker or directly from storage, builder's call).
- Empty: one line « Aucune suite annoncée pour tes séries » (+ the reason when the feature is off or no account is connected).

### 5.6 Settings › Notifications

- New section « Suites annoncées » after « Nouveaux épisodes »:
  - toggle « Alertes de suite » (`sequelAlerts`, default on);
  - toggle « Notification du navigateur » (`sequelNotifications`, default on), disabled when the first is off; help « Sinon, seulement dans Activité »;
  - status line « Dernière vérification : il y a 3 h · 2 suites trouvées » (or the skip reason, `blocked` in red as for airing);
  - « Réafficher les N suites masquées » button when there are dismissed records (sets them back to `seen`).
- Both fields in `shared/settings.ts` (defaults, normalization, backup like the other settings). `ensureAiringAlarm` keeps the alarm when `airingAlerts || sequelAlerts`.

### 5.7 Date label

One pure function, all languages through placeholders (never concatenated):
- day known → localized date (« 10 janv. 2027 »);
- month known → « octobre 2027 »;
- season known → `panel.nowPlaying.season.*` with `{year}`;
- year only → « 2027 »;
- nothing → « Date à venir ».
RELEASING → « Déjà en diffusion » instead of the date (Activité, Agenda) or next to it (notification).

### 5.8 Texts (FR / EN, 21 languages)

`sequel.heading` Suites annoncées / Announced sequels · `sequel.add` + À regarder / + Plan to watch · `sequel.dateUnknown` Date à venir / Date to be announced · `sequel.airing` Déjà en diffusion / Already airing · `sequel.announced` Annoncée / Announced · `sequel.inList` Déjà dans ta liste / Already in your list · `sequel.notOnMal` pas encore sur MyAnimeList / not on MyAnimeList yet · `sequel.more_*` N autres suites annoncées · `sequel.notification.single` Suite annoncée : {title} · `sequel.notification.source` {date} · suite de {source} · `sequel.notification.group_*` {count} suites annoncées · `sequel.notification.open` Voir dans SyncKai · `sequel.notification.added` Ajoutée à À regarder · `agenda.view.week` Semaine · `agenda.view.announced` Annonces · `agenda.announced.empty` Aucune suite annoncée pour tes séries · `settings.sequels.*` (label, help, browser, browserHelp, status, restore_*). Final keys and wording: builder's call within the i18n rules (`docs/memory/i18n.md`).

## 6. Tests and checks

- Unit (tests first): candidate rule (relation, format, status, in-list by id and by `idMal`), state transitions (new → seen → dismissed, removal on add or when no longer a candidate, `known` preventing re-notify after pruning, snapshot refresh without re-notify, cap 200), no notification for an unseeded service (first pass, MAL connected later), grouping 1 vs N, date label in fr / en / ja, settings normalization, prefix routing of notification clicks, alarm kept when only `sequelAlerts` is on, account purge.
- Request-count test like `page-media/series-requests.test.ts`: a 400-series list → expected number of background requests.
- Components: Activité section (rows, collapse, ×, focus), panel badge, Agenda switch and grouping, Settings section.
- `npm run verify`, `CI=1 npm run test:e2e` (popup and panel change), `CI=1 npm run test:i18n-layout` with a seeded announced sequel in the popup and the panel; `npm run test:ext` for the alarm path if a scenario fits.
- Owner on the real browser: first pass (no burst), a real announced sequel, « + À regarder » from the notification and from Activité (AniList and MAL), Firefox click.

## 7. Left to the builder

- Module split inside `background/sequels/` and the message names.
- Relations batch size after measuring the real complexity.
- How the Agenda reads the store (message or storage read).
- Exact i18n keys within the list above.
- Whether the « Annonces » switch reuses an existing segmented component.

## 8. Calls made by the assistant (approved by the owner on 2026-11-09)

- Paused, dropped and planning series trigger nothing; formats TV, TV_SHORT, ONA, MOVIE only.
- Builder check of 2026-11-09 settled here: an add that succeeds on one service ends the alert (MAL catch-up through the differences page); `known` ids outside the 200-record cap so pruning never re-notifies; scope `account` plus a per-service `seeded` set, so a later MAL connection or an account switch never bursts.
- First pass: records created, no notification.
- Status bar unchanged; only the panel part of option 4.
- Two settings toggles, both on by default.
- Daily pass on the hourly alarm, background lane.
