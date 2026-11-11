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
- **`capRecords` sorts by `firstSeenAt` only** (`src/shared/sequels.ts`). A tie decides which records survive the 200 cap; nothing is displayed differently.
- **Restoring a 2.4.x backup with release alerts off leaves sequel alerts on.** TERMS-02's migration covers the update only.
- **The CWS `notifications` block** says the group button « shows them in SyncKai », but the fallback (the first sequel's entry) is the usual path until XB-02 is fixed.

## Privacy texts and tooling
- **The `PRIVACY.md` guard checks four hard-coded groups** (`scripts/store-permissions.test.ts`). Iterate the account-key groups instead, with an explicit exemption set (`status-bar`).
- **`README.md:145`** « `alarms` (release alerts, retries) » misses sequel alerts.
- **Firefox `data_collection_permissions`** was not reassessed for the 2.5.0 flows.
- **15 ESLint `max-lines-per-function` warnings** remain in files the fixes did not touch.
