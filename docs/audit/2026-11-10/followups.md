# Follow-ups for 2.5.1 from the fix reviews

The 2.5.0 audit fixes (plan `docs/superpowers/plans/2026-11-11-2.5.0-audit-fixes.md`, `676ce90..698849f`) were reviewed task by task, then as a whole branch. These are the points the reviewers raised that were deferred to 2.5.1. They complement the 2.5.1 plan in `0-synthese.md` › 3.4, which covers the audit findings themselves. Paths and lines are at `698849f`.

## Dormant series (with POP-03, POP-05, POP-06, POP-08)
- **Concurrent paced runs add up.** A new « Tout mettre en pause » started within the previous banner's 10 s, followed by that banner's « Annuler », can reach about 40 AniList requests a minute. A 429 then only stops the undo with « Réessayer ».
- **The last result wins.** A run's result banner replaces a newer banner shown during a paced run (`src/popup/controllers/dormant.ts` › `showResult`). During a bulk, only a +1 failure banner can appear.
- **`undoDormant` does not skip busy series**, unlike `run`. The first run to finish a shared series also clears the other run's busy mark.
- **The « Garder » skip in `writeAll` also applies to undo writes back to CURRENT.** It is unreachable from the UI. Fix: also require `status(item) !== 'CURRENT'`.
- **`undoable` is cleared implicitly** by the banner replacement during a pause retry. Clear it explicitly.
- **`writeAll` never reads `disposed`.** `dispose()` is not called in production.
- **Coverage gaps.** The account-change exit does not assert that unsent series are released. There is no POP-04 boundary test for an airing series that has aired, unwatched episodes and a future-dated next one.
- **`createDormantController` is at 198 lines**, just under the lint limit. Move `writeAll` out.
- **A test for a throwing pass** would pin that the sequel keep-alive interval is cleared (`src/background/sequels/check.ts` › `withKeepAlive`). `finally` already guarantees it.

## Recommendations
- **`onUndo` is unguarded during the dice turn** (`src/ui/components/reco-card.tsx`). Likely benign: the held view is the dismissed card.
- **A reduced-motion test is missing:** « Autre », then « + À regarder », must act at once.

## Watch order
- **A round-capped graph skips `demoteRecaps`.** This only happens beyond 12 rounds; Gundam needs 9.
- **A stale `from`.** A recap declared by an entry that is itself demoted keeps a stale `from`. Two entries declaring each other could both leave main.
- **`recaps` is persisted in the cached graph**, though it is only needed during the walk.
- **A request that joins a walk running from a recap film** gets that walk's graph. This is display only and never cached for other entries.
- **Recap film pages miss the franchise cache**, about 9 background requests once per 24 h. Same class as ORD-04.
- **The specs still state the old rules.** The watch-order spec (`docs/superpowers/specs/2026-11-09-watch-order-design.md:47`, `:101`) and the sequel-alerts spec (`docs/superpowers/specs/2026-11-09-sequel-alerts-design.md:143`) predate ORD-03 (a) and TERMS-02 (a).

## Sequel alerts
- **Restoring a 2.4.x backup with release alerts off leaves sequel alerts on.** TERMS-02's migration covers the update only.

## Privacy texts and tooling
- **The `PRIVACY.md` guard checks four hard-coded groups** (`scripts/store-permissions.test.ts`). Iterate the account-key groups instead, with an explicit exemption set (`status-bar`).
- **`README.md:145`** « `alarms` (release alerts, retries) » misses sequel alerts.
- **Firefox `data_collection_permissions`** was not reassessed for the 2.5.0 flows.
- **15 ESLint `max-lines-per-function` warnings** remain in files the fixes did not touch.

## From the tester-feedback reviews (2026-11-11)

- **The refresh flag stays stuck after the worker timeout.** After `popupTimeouts.watchingMs` (`src/popup/controllers/watching.ts`), the error shows with `refreshing: false`, but `refreshInFlight` stays `true` until the late answer arrives. « Actualiser » then looks active and does nothing. « Réessayer » still works.
- **The busy icon is dimmed** by `aria-disabled:opacity-50` while it spins. `watching.refresh` also sits between `watching.sortMenu` and `watching.sortTrigger` in the catalogs, out of alphabetical order.
- **The announced-sequels check** (`src/background/sequels/listed.ts`):
  - with both services connected, only AniList is checked, so a sequel added on MyAnimeList only stays until the daily pass;
  - the throttle key is not cleared at logout, which the session epochs make harmless;
  - no assertion checks that the removed ids stay in `known`;
  - there is no unit test of the popup's `visible` wiring;
  - the MAL memo lasts 5 min while the throttle lasts 10.
- **No reduced-height e2e covers Activité** or the refresh button: only « Mes séries » is tested at 545 px.

## From the popup rail sections reviews (2026-11-11)

**Pour toi**
- No test of a filter change during the dice turn.
- The empty-list card and « Pour toi » can each show a card that the other has just added or dismissed. Nothing is written twice.
- « vide » versus « filtré » when every card has been drawn.
- The genre fallback is not saved.
- The e2e title still says « Plus d'idées dans le panneau » (`scripts/e2e/popup.e2e.ts`).

**Popup Agenda**
- « Annoncées » stays selected across visits, while the code comment says « Semaine » at each opening.
- `agendaShownBefore` is misnamed: it also drives Stats. Rename it `lastShown`.
- The panel has a 4 px gap above its sticky nav; it existed before.

**Stats**
- After a Backup import made while the session had already expired and no viewer was cached, the `stats.ts` fallback can show another account's part. Either soften the PRIVACY sentence or use only the cached ids.
- « depuis le {today} » shows for a foreign part.
- Settings → back to Stats does not call `show()`.
- `ensureFresh` runs on every update (bounded by `checked`).
- The day can be off by one past midnight while the popup stays open.

**Activity history**
- Mixed last-session endings: the owner should confirm the behaviour.
- The `console.warn` spy restore in `viewer.test`.
- No test for `endSessionIfUnreadable`.
- `prefixesClearedOnLastSession` ignores `keepOnExpiry`.
- « Remplacer » with a pre-2.5.0 Backup erases the local history.

**Profile stats**
- `ListStatus` is duplicated; add a type equality test.
- Round-trip all five fixtures through `isProfileStats`.
- `expect.anything` in `mal/client.test`.

**Docs and store**
- The CWS `storage` block is condensed (it drops « the last sequel check »).
- The PRIVACY › Backup paragraph could mention the 400-day prune and the foreign-part drop on import.
- The store listings (`docs/store/listing-*.md`) need a 2.5.0 refresh at release.

## From the « Annoncées » calendar (2026-11-12)

- **The 200-record cap.** A sequel that left a list comes back as `'seen'` with `firstSeenAt: 0`, and `capRecords` prunes it first. A dismissed sequel pruned by the cap in an earlier pass is known without a record, so it can come back as `'seen'` once the store drops below 200: the hide is lost. Only beyond 200 records.
- **« Déjà dans ta liste » is stored as PLANNING** (`'listed'`). The real status (CURRENT, PAUSED…) is only corrected by the next shown-sequels check or the daily pass.
- **A listed entry that leaves the list** disappears at the next check, and comes back as a sequel only at the next daily pass (no source series kept in `listed`).
- **The new AniList fields** (full-list `release`, the MAL-only `idMal_in` + `status_in` query) were tested against fakes only; the owner's real account shows 18 listed entries (2026-11-12).

**Dead code**
- ~~The panel-tab request path no longer has a popup caller: `openPanelOn`, `takePanelTab` / `watchPanelTab`, `requestedTabState`, `PANEL_TAB_KEY`.~~ Removed in `bugfix/panel-follow-ups` (it also closes PNL-04).
