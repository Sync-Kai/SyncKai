# Fix roadmap (2026-10-10 audit)

Plan for handling the 131 cases of the [2.1.0 audit](AUDIT-2026-10-10.md). Each batch maps to one Gitflow branch (rebase on `develop`, `merge --ff-only`, branch deleted afterwards). Cases duplicated across themes are attached to a single main ID; the others are listed in "[Grouped / dropped](#grouped--dropped)".

Priority order within each version: 1) data corruption (wrong entry, progress going backwards, wrong account); 2) broken core feature; 3) everything else.

Checks before each merge (main session): `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npm run test:e2e` if the popup or the side panel changes. From batch 11 on, `npm run verify` replaces this list.

## Progress (as of 2026-10-11)

Batches 1 to 26, 28 and 29 done and released in 2.2.0 (one commit per batch), then leftovers fixed on `develop` for 2.3.0: one-time purge of matches pointing to another series (batch 1), episode remembered while a correction is pending (batch 5), page cache tied to sessions (batch 18), Netflix tabs picked up again after an update and versioned bridge (batch 26; Firefox reinjects Crunchyroll and ADN itself), content script down to 76 KB (batch 29), web-ext 10 (audit 13 → 3). **Batch 27 dropped**: the Schedule outside streaming sites contradicts the 2026-10-07 decision (non-intrusive extension); UX-04 stays open. Still out of our hands: TypeScript 6.1 (waiting on typescript-eslint), skewed coverage on Windows (@vitest/coverage-v8 bug), `node-forge` with no fix (web-ext run, unused). Manual tests: `docs/audit/MANUAL-TESTS.md`.

## Summary

| Order | Version | Branch | Cases | Effort |
|---|---|---|---|---|
| 1 | 2.1.1 | `bugfix/relation-autre-serie` | 3 | M |
| 2 | 2.1.1 | `bugfix/alignement-instantane-perime` | 2 | S |
| 3 | 2.1.1 | `bugfix/verrou-par-fiche` | 2 | S |
| 4 | 2.1.1 | `bugfix/controles-revisionnage` | 5 | M |
| 5 | 2.1.1 | `bugfix/cartes-verification` | 6 | M |
| 6 | 2.1.1 | `bugfix/panneau-en-lecture` | 3 | M |
| 7 | 2.1.1 | `bugfix/netflix-retrait-acces` | 2 | S |
| 8 | no version | `chore/garde-permissions-release` | 3 | S |
| 9 | no version | `chore/docs-stores` | 5 | S |
| 10 | no version | `chore/build-reproductible` | 3 | M |
| 11 | no version | `chore/verification-locale-ci` | 3 | S |
| 12 | 2.2.0 | `bugfix/liaison-compte` | 5 | M |
| 13 | 2.2.0 | `bugfix/ecritures-sous-session` | 6 | M |
| 14 | 2.2.0 | `bugfix/auth-erreurs` | 7 | M |
| 15 | 2.2.0 | `chore/tests-orchestration` | 4 | M |
| 16 | 2.2.0 | `bugfix/import-crunchyroll` | 8 | L |
| 17 | 2.2.0 | `bugfix/alertes-sortie` | 6 | M |
| 18 | 2.2.0 | `bugfix/stockage-local` | 6 | M |
| 19 | 2.2.0 | `bugfix/extraction-episode` | 4 | M |
| 20 | 2.2.0 | `chore/frontieres-modules` | 2 | M |
| 21 | 2.2.0 | `feature/controleur-fiche-page` | 2 | M |
| 22 | 2.2.0 | `feature/accessibilite` | 3 | M |
| 23 | 2.2.0 | `bugfix/finitions-ui` | 8 | M |
| 24 | 2.2.0 | `feature/durcissement-securite` | 3 | M |
| 25 | 2.3.0 | `chore/registre-plateformes` | 1 | S |
| 26 | 2.3.0 | `bugfix/reattachement-video` | 7 | L |
| 27 | 2.3.0 | `feature/agenda-hors-cible` (dropped) | 1 | M |
| 28 | later | `chore/popup-controleurs` | 1 | L |
| 29 | later | `chore/i18n-contenu-leger` | 1 | M |

Total: 112 cases assigned to a batch, 19 grouped, none dropped.

## Where to start

Start with **batch 1**: [SYNC-01](AUDIT-2026-10-10.md#sync-01) is the only confirmed high-severity case that corrupts lists. A prequel or sequel published as a separate Crunchyroll series (Naruto for Naruto Shippuden, Bleach for Bleach TYBW) receives the progress with "high" confidence, and the wrong match is cached for the whole season. Follow right away with **batch 2** ([SYNC-02](AUDIT-2026-10-10.md#sync-02)): "Match" rewrites a stale snapshot and can move hundreds of series backwards in one click. Both batches are short, touch separate files (`resolver.ts`/`matching.ts` versus `compare.ts`) and can be reviewed the same day. Then do batch 3 (per-entry lock), which batches 4 and 5 depend on. Batch 8 (permission guard and publishing pipeline) must be merged before the `v2.1.1` tag.

---

## 2.1.1: urgent fixes (data integrity and side panel)

### Batch 1 · `bugfix/relation-autre-serie`

**Goal:** stop writing progress to an AniList entry linked to another series on the platform, or to a TV series sharing its name with a Netflix movie.

| Cases | Severity | Subject |
|---|---|---|
| [SYNC-01](AUDIT-2026-10-10.md#sync-01) | high | Prequel/sequel of another Crunchyroll series counted as a season (Naruto ← Shippuden) |
| [BRW-01](AUDIT-2026-10-10.md#brw-01) | medium | Netflix movie: the TV series with the same name wins with high confidence |
| [TEST-08](AUDIT-2026-10-10.md#test-08) | medium | "Cached match" path and SEQUEL/PREQUEL propagation not tested |

- **Effort:** M.
- **Dependencies:** none.
- **Tests:**
  - `matching.test.ts`: Shippuden S1 E5 with Naruto as a PREQUEL linked to another `seriesId` gives Shippuden (or a check), never Naruto; same for S2 E35; LinkKind `'other'` excluded from `seasonPool` and never propagated.
  - `matching-netflix.test.ts`: "Jujutsu Kaisen 0" gives the linked MOVIE; "Bubble" gives the linked MOVIE, and the unlinked TV series with the same name falls back to `low` confidence.
  - `resolver.test.ts`: "cache" block (valid mapping: no `searchAnime`; beyond the entry with `persist:true`: deletion then new resolution; `persist:false`: neither deletion nor write); SEQUEL relation fetched by `getAnimeByIds` and marked `'relation'`.
- **Manual check (Chrome or Brave):** Naruto Shippuden S1 E1 on Crunchyroll, popup open: the suggested entry is Shippuden (1735), not Naruto (20). A One Piece episode stays correct (no regression in absolute numbering). Firefox: a Netflix movie linked on AniList (Netflix turned on).
- **Migration and purge:**
  - Revalidation on first use of a cached match: if the cached entry has its own link to another series on the same platform, delete the match and run the resolution again.
  - On update to 2.1.1 (`onInstalled`, `reason === 'update'`), delete all `netflix:*` matches (created since 2.1.0, a few days ago, they recompute on their own).
  - Progress already written to the wrong entry cannot be undone automatically. CHANGELOG (Fixed): "If you watch a sequel published separately on Crunchyroll (Naruto Shippuden, Bleach TYBW…), check on AniList and MAL that the previous series did not receive your progress, and use *Settings › My data › Matches › Forget* if a match is wrong."

### Batch 2 · `bugfix/alignement-instantane-perime`

**Goal:** the AniList ↔ MAL alignment rereads the actual state before writing and never moves a list backwards.

| Cases | Severity | Subject |
|---|---|---|
| [SYNC-02](AUDIT-2026-10-10.md#sync-02) | medium | "Match" writes the `compare:last` snapshot without rereading |
| [ARCH-21](AUDIT-2026-10-10.md#arch-21) | medium | `compare:last` never invalidated after a sync or a manual control |

- **Effort:** S.
- **Dependencies:** none. If batch 3 is already merged, do the reread under `withEntryLock`.
- **Tests:** `src/background/compare.test.ts`: a reread target with progress different from `diff[target]` gives a skipped item "changed since the analysis"; a write lower than the target's current progress is refused; `compare:last` is marked "needs re-analysis" (or the entry's differences removed) after a successful sync of the same entry.
- **Manual check (Chrome):** run an analysis with a difference, watch an episode of that series, then click "Match": the series is skipped with the message, and no progress goes backwards on AniList or MAL.
- **Migration:** none. CHANGELOG: the alignment skips series changed since the analysis.

### Batch 3 · `bugfix/verrou-par-fiche`

**Goal:** serialize the read → decide → write sequence per entry, so that no concurrent path moves progress backwards.

| Cases | Severity | Subject |
|---|---|---|
| [ARCH-12](AUDIT-2026-10-10.md#arch-12) | medium | No per-entry lock between live sync, queue, controls, import, alignment |
| [CRI-02](AUDIT-2026-10-10.md#cri-02) | low | `applyItem`: waiting for the budget between read and write |

- **Effort:** S.
- **Dependencies:** none. Batches 4, 5 and 16 build on the helper.
- **Tests:** new `src/background/sync/entry-lock.test.ts` modeled on `watching-race.test.ts`: two concurrent `syncEpisode` calls (E5 from the queue, E7 live) on the same entry give a final progress of 7; two `ADJUST_PROGRESS` +1 give +2; in `applyItem`, the write slot (`waitWriteSlot`) is taken before the reread.
- **Manual check (Chrome):** +1 from the side panel and from the popup's "Watching" in the same second: +2 in total on AniList.
- **Migration:** none.

### Batch 4 · `bugfix/controles-revisionnage`

**Goal:** manual controls (+1/−1, rating, correction) consistent with automatic sync, rewatching included.

| Cases | Severity | Subject |
|---|---|---|
| [CTRL-02](AUDIT-2026-10-10.md#ctrl-02) | medium | +1 creates the entry at episode 1 on the service where the series is missing |
| [CTRL-03](AUDIT-2026-10-10.md#ctrl-03) | medium | +1 with partial failure: clicking again shifts the service that had succeeded |
| [CTRL-01](AUDIT-2026-10-10.md#ctrl-01) | medium | +1 on the last episode of a rewatch: counter and `is_rewatching` |
| [CTRL-04](AUDIT-2026-10-10.md#ctrl-04) | medium | "To rate" card deleted despite a failed service |
| [SYNC-08](AUDIT-2026-10-10.md#sync-08) | low | "Correct" on a rewatch takes it out of rewatching |

- **Effort:** M.
- **Dependencies:** batch 3 (`adjustOnService` and `statusOnService` under the lock).
- **Tests:**
  - `controls.test.ts`: `entry === null` gives a `notInList` skip; REPEATING 11/12 then +1 gives COMPLETED with `repeat+1`; after a partial failure, the retry writes an absolute progress to the failed service only.
  - `rules.test.ts`: a correction on REPEATING stays REPEATING, with `repeat+1` on the last episode, and MAL receives an explicit `is_rewatching`.
  - `engagement-store.test.ts`: the card is kept as long as a service is in error or all are `skipped`.
- **Manual check (Chrome + Firefox):** a series present on AniList and missing from MAL, +1: MAL is not created. A series being rewatched at 11/12, +1: AniList COMPLETED with one more rewatch, MAL is no longer "Re-watching". Rate with MAL offline (network cut in the developer tools): the card stays after reopening the popup.
- **Migration:** none. MAL entries left with `is_rewatching` must be fixed by hand; mention it in the CHANGELOG.

### Batch 5 · `bugfix/cartes-verification`

**Goal:** the "To check" and "Correct" cards no longer lose failures, no longer move progress backwards and no longer stay stuck on an obsolete match.

| Cases | Severity | Subject |
|---|---|---|
| [BAK-01](AUDIT-2026-10-10.md#bak-01) | low | Imported correction card: progress can go backwards |
| [SYNC-07](AUDIT-2026-10-10.md#sync-07) | low | The next sync deletes the "Correct" card and writes again to the disputed entry |
| [SYNC-03](AUDIT-2026-10-10.md#sync-03) | medium | Manual check: a transient MAL failure is lost |
| [SYNC-04](AUDIT-2026-10-10.md#sync-04) | medium | Rating request although the series is already rated |
| [SYNC-05](AUDIT-2026-10-10.md#sync-05) | medium | Cached match with `episodes:null` never revalidated |
| [SYNC-06](AUDIT-2026-10-10.md#sync-06) | low | 404 and deleted entry classified as "transient", cache never invalidated |

- **Effort:** M.
- **Dependencies:** batch 3.
- **Tests:** create `src/background/sync/sync-service.test.ts` (mocks of `../trackers`, `../api/media`, `./resolver`, `../../shared/storage`) with this batch's scenarios: `resolveReview` with MAL returning 504 goes through `recordSyncOutcome` (item queued); a correction is accepted only if the current progress equals `previous.progress`; a card with `previous !== null` is not deleted by the next sync; no rating request if a service already has a rating or if the entry was REPEATING; a match with `episodes:null` is revalidated with `catalog.episodes`. `queue-policy.test.ts`: `API_ERROR` 404 gives `failed` without retry, 503 gives `retry`.
- **Manual check (Chrome):** open "Correct" on a sync, start the next episode without confirming: the card stays. Finale of a series that is already rated: no "Rate" bubble.
- **Migration:** when importing a backup, force `previous` to `null` on `pendingReviews` (`backup.ts`). `episodes:null` matches: revalidated on first use, no global purge. CHANGELOG: state that corrections imported from a backup become plain checks.

### Batch 6 · `bugfix/panneau-en-lecture`

**Goal:** the "Now playing" side panel no longer stays stuck loading and no longer shows the entry of a page that was left; the Schedule no longer throws away its responses.

| Cases | Severity | Subject |
|---|---|---|
| [UI-01](AUDIT-2026-10-10.md#ui-01) | high | Side panel stuck loading if the tab updates during resolution |
| [UI-02](AUDIT-2026-10-10.md#ui-02) | medium | An action's response reloads the old page after a tab switch |
| [UI-03](AUDIT-2026-10-10.md#ui-03) | medium | Schedule: each render reruns `load()` and throws away `GET_AGENDA`, errors included |

- **Effort:** M.
- **Dependencies:** none.
- **Tests:** `src/sidepanel/now-playing-view.test.ts` (or a new `now-playing.test.ts` with a fake `sendMessage`): `refresh(false)` on the same page during an in-flight `resolve` ends in `ready`; an action whose response arrives after a change of `tabId` or `pageKey` touches neither the entry nor `actions`. `src/sidepanel/tabs.test.ts`: `activate()` is called only when switching to the Schedule tab; a `GET_AGENDA` error shows "stale data" and the Retry button. Add a side panel e2e scenario if the harness allows it.
- **Manual check (Chrome + Brave, then Firefox for the tab switch):** open the side panel while a Crunchyroll episode is loading: the entry shows up. Click "+1" then switch tabs right away: the new tab's entry stays displayed. Schedule open with AniList blocked (developer tools): the error message stays visible.
- **Migration:** none.

### Batch 7 · `bugfix/netflix-retrait-acces`

**Goal:** removing Netflix access really stops sync and the Netflix preferred player.

| Cases | Severity | Subject |
|---|---|---|
| [CONT-03](AUDIT-2026-10-10.md#cont-03) | medium | Netflix tabs already open: sync continues after removal |
| [BRW-04](AUDIT-2026-10-10.md#brw-04) | low | "Netflix" preferred player still used after access is removed |

- **Effort:** S.
- **Dependencies:** none.
- **Tests:** `src/background/netflix-scripts.test.ts` (or a new routing test): `EPISODE_COMPLETED` `platform:'netflix'` without permission gives `ignored`, with no write. `src/ui/settings/summary.test.ts`: a single helper `effectivePlayer(preferred, netflixGranted)` is used by the popup, the side panel, the Schedule and `airing.ts`; on `permissions.onRemoved`, `preferredPlayer` goes back to the default value.
- **Manual check (Chrome + Firefox):** with a Netflix tab open, remove access in `chrome://extensions` (Firefox: `about:addons`) without reloading the tab, finish a linked episode: nothing is written. Release notification and resume button: they open Crunchyroll.
- **Migration:** on startup, if `preferredPlayer === 'netflix'` without permission, reset it to the default value.

---

## Tooling and publishing (no version)

`chore/…` branches merged into `develop` outside of a release. Batch 8 must come before the `v2.1.1` tag.

### Batch 8 · `chore/garde-permissions-release`

**Goal:** never again a Chrome Web Store submission rejected for an unjustified permission, and a locked-down publishing pipeline.

| Cases | Severity | Subject |
|---|---|---|
| [ARCH-24](AUDIT-2026-10-10.md#arch-24) | high | Manifest ↔ `permissions.md` test, idempotent GitHub release, AMO codes |
| [ARCH-23](AUDIT-2026-10-10.md#arch-23) | high | Publishing CLIs not pinned, secrets outside an environment, tag not on `main` |
| [ARCH-32](AUDIT-2026-10-10.md#arch-32) | medium | Headless Chrome not pinned in the release |

- **Effort:** S.
- **Dependencies:** none.
- **Tests:** `scripts/store-permissions.test.ts`: every entry of `permissions`, `host_permissions` and `optional_host_permissions` in `manifest.json` has its section in `docs/store/permissions.md`, and the version header there matches. The test must fail on a manifest where a fake permission has been added.
- **Manual check:** run `release.yml` as a dry-run `workflow_dispatch` (or a test tag on a fork): `npx --no-install` resolves the lockfile versions, `gh release` switches to `edit`/`upload --clobber` if the release exists, and the AMO step fails on any code other than 200, 401, 403 or 404. On GitHub: `stores` environment restricted to `v*` tags, tag ruleset, `merge-base --is-ancestor` check against `main`.
- **Migration:** document the recovery in `docs/STORE.md` › 7 (Privacy tab, then "Re-run failed jobs"). Fix the hand-written v2.0.0 and v2.1.0 releases if their text is wrong.

### Batch 9 · `chore/docs-stores`

**Goal:** listings and review notes faithful to the code (AMO, privacy, reviewer build).

| Cases | Severity | Subject |
|---|---|---|
| [REL-02](AUDIT-2026-10-10.md#rel-02) | medium | AMO listing without Netflix, resent with every version |
| [REL-03](AUDIT-2026-10-10.md#rel-03) | low | Inaccurate `approval_notes` about the contacted hosts |
| [REL-04](AUDIT-2026-10-10.md#rel-04) | low | `npm ci` downloads Chrome for the AMO reviewer |
| [REL-06](AUDIT-2026-10-10.md#rel-06) | low | `PRIVACY.md` effective date not updated, `storage.session` missing |
| [SEC-04](AUDIT-2026-10-10.md#sec-04) | low | `permissions.md`: `web_accessible_resources` described as limited to Netflix |

- **Effort:** S.
- **Dependencies:** none.
- **Tests:** Vitest test: every platform mentioned in `docs/store/listing-*.md` appears in the `description` of `amo-metadata.json` (en-US, fr, de).
- **Manual check:** proofread `amo-metadata.json`, `PRIVACY.md` (3 languages) and `BUILD.md` (`PUPPETEER_SKIP_DOWNLOAD=true npm ci`, PowerShell variant); run that command in a clean clone. Fix the line in `CLAUDE.md` saying that only `approval_notes` are resent.
- **Migration:** none.

### Batch 10 · `chore/build-reproductible`

**Goal:** an identical Firefox build whatever the folder, and an automatic check of the built package.

| Cases | Severity | Subject |
|---|---|---|
| [ARCH-22](AUDIT-2026-10-10.md#arch-22) | high | Background chunk name depends on the absolute path |
| [ARCH-31](AUDIT-2026-10-10.md#arch-31) | medium | CI timestamp (`git log`) versus the reviewer's `.source-date-epoch` |
| [ARCH-27](AUDIT-2026-10-10.md#arch-27) | medium | No check of the generated manifest and no size budget |

- **Effort:** M.
- **Dependencies:** batch 9 (`BUILD.md`).
- **Tests:** `scripts/verify-build.ts` run in CI after `build` and `build:firefox`: the Netflix entry of `web_accessible_resources` is limited to `*://*.netflix.com/*`, all referenced files exist, the `*.iife.js` files have no top-level `import` or `export`, the permissions are identical to the source manifest, and the content script budget fits in 300 KB. CI step: unzip the source archive into `/tmp/repro`, build without forcing `SOURCE_DATE_EPOCH`, then `diff -r` against the Firefox zip.
- **Manual check:** Firefox build in two different folders on Windows: same chunk name. Load `dist/` in Chrome and `dist-firefox/` in Firefox: popup, side panel and syncing an episode work (the renamed chunk does not break the crxjs loader).
- **Migration:** none.

### Batch 11 · `chore/verification-locale-ci`

**Goal:** the CI checks run locally before each merge, on cleaned-up tooling.

| Cases | Severity | Subject |
|---|---|---|
| [ARCH-28](AUDIT-2026-10-10.md#arch-28) | medium | CI only runs after the merge; incomplete local checklist |
| [ARCH-29](AUDIT-2026-10-10.md#arch-29) | low | Unused `@tailwindcss/cli`, `npm audit`, Dependabot alerts |
| [ARCH-30](AUDIT-2026-10-10.md#arch-30) | low | No type-aware linter (`no-floating-promises`) |

- **Effort:** S (web-ext 10 separately, not urgent).
- **Dependencies:** none; ideally after batch 10 to include `verify-build` in `verify`.
- **Tests:** `npm run verify` (`tsc --noEmit`, `tsc -p scripts`, `tsc -p scripts/screenshots`, `vitest run`, `build`, `build:firefox`, `lint:firefox`) passes; type-aware lint limited to `no-floating-promises`, `no-misused-promises`, `switch-exhaustiveness-check` and `no-explicit-any`, after checking compatibility with TypeScript 6.
- **Manual check:** `npm run verify` on a clean copy; update the checklist in `CLAUDE.md`. Dependabot security alerts, with monthly grouped updates.
- **Migration:** none.

---

## 2.2.0: foundations (account binding, orchestration tests, module boundaries, accessibility)

### Batch 12 · `bugfix/liaison-compte`

**Goal:** an account's queue, cards and ratings are never replayed on another account.

| Cases | Severity | Subject |
|---|---|---|
| [DATA-01](AUDIT-2026-10-10.md#data-01) | medium | Queue, ratings and recent syncs replayed on another account |
| [CRI-03](AUDIT-2026-10-10.md#cri-03) | low | Account change while the import is being applied |
| [AUTH-06](AUDIT-2026-10-10.md#auth-06) | low | Expired AniList token never purged: old account's data kept |
| [DATA-06](AUDIT-2026-10-10.md#data-06) | low | Expired AniList token treated as "no service": data erased |
| [TEST-10](AUDIT-2026-10-10.md#test-10) | low | Session clearing and `storage.ts` caps not tested |

- **Effort:** M.
- **Dependencies:** batch 3; to be done before batch 13 (same `storage.ts` module).
- **Tests:** new `src/shared/storage.test.ts` (fake `chrome.storage.local` as a Map, immediate lock): exact list of keys cleared by `clearUserSyncData`, `clearAniListSession` and `clearMalSession`; `mediaMappings` and `sessionEpoch` kept; caps of `savePendingReview` (20) and `addRecentSync` (5). `queue.test.ts`: an item recorded with epoch A and retried under epoch B is removed without a write. `cr-import`: an epoch changed between `getEntry` and `saveProgress` drops the item.
- **Manual check (Chrome):** take MAL offline to fill the queue, sign out of AniList, connect another AniList account: the old account's queue disappears and nothing is written to the new one.
- **Migration:** existing items in `syncQueue`, `pendingRatings` and `recentSyncs` have no epoch. On update, assign them the current epoch (the account connected at update time is the most likely one). CHANGELOG: the queue and the cards are now tied to the account.

### Batch 13 · `bugfix/ecritures-sous-session`

**Goal:** no late network write recreates the session or the data of a disconnected account.

| Cases | Severity | Subject |
|---|---|---|
| [AUTH-01](AUDIT-2026-10-10.md#auth-01) | medium | An in-flight MAL refresh revives the session after sign-out |
| [AUTH-02](AUDIT-2026-10-10.md#auth-02) | medium | Clearing on 401 without checking it is the rejected token |
| [AUTH-04](AUDIT-2026-10-10.md#auth-04) | medium | Cached profile without an epoch: old account's "Watching" list |
| [AUTH-08](AUDIT-2026-10-10.md#auth-08) | low | Forced refresh compared with the reread token: cascading refreshes |
| [DATA-05](AUDIT-2026-10-10.md#data-05) | low | Import preview, comparison and Schedule week rewritten after sign-out |
| [ALRT-05](AUDIT-2026-10-10.md#alrt-05) | low | `airing*` keys not cleared, Schedule rewritten for the disconnected account |

- **Effort:** M.
- **Dependencies:** batch 12.
- **Tests:** `storage.test.ts`: `writeIfSession(service, epoch, entries)` writes nothing if the epoch has changed; `clearAniListSessionIfToken` and `clearMalSessionIfToken` only clear the rejected token. New `src/background/auth/mal.test.ts` (shared with batch 14): sign-out during `requestToken` gives a dropped token; three concurrent 401s with the same token give a single refresh.
- **Manual check (Chrome):** MAL token close to expiry (edit it in storage), open the popup then disconnect from MAL right away: the account stays disconnected. Disconnect during a release check: the Schedule is empty.
- **Migration:** add `airingNotified`, `airingTargets`, `airingLastCheck` and `airingLastResult` to `clearUserSyncData`. No purge of existing data.

### Batch 14 · `bugfix/auth-erreurs`

**Goal:** accurate authentication errors and bounded, tested MAL refreshes.

| Cases | Severity | Subject |
|---|---|---|
| [AUTH-03](AUDIT-2026-10-10.md#auth-03) | medium | Session invalidated in the background shown as "Not connected" |
| [AUTH-05](AUDIT-2026-10-10.md#auth-05) | low | No timeout on the MAL token endpoint called under the lock |
| [AUTH-07](AUDIT-2026-10-10.md#auth-07) | low | Refresh 5xx and 429 without HTTP status: jobs stopped |
| [AUTH-09](AUDIT-2026-10-10.md#auth-09) | low | Timeout while reading the body reported as "invalid response" |
| [AUTH-10](AUDIT-2026-10-10.md#auth-10) | low | MAL code exchange failure shown as "Session expired" |
| [TEST-02](AUDIT-2026-10-10.md#test-02) | medium | MAL token refresh not tested |
| [TEST-03](AUDIT-2026-10-10.md#test-03) | medium | AniList "Invalid token" and `malRequest` 401/429 not tested |

- **Effort:** M.
- **Dependencies:** batch 13 (same `auth/mal.ts`).
- **Tests:** `src/background/auth/mal.test.ts`: two concurrent calls give a single POST; 400 clears the session; 503 throws an `httpStatus` 503 error with the session intact; 429 gives `RATE_LIMITED`; the timeout is honored; a different `state` gives `INVALID_RESPONSE`. `src/background/api/client.test.ts`: "Invalid token" in public mode gives a replay without `Authorization`, in `required` mode `TOKEN_INVALID`, 200 with `errors` `API_ERROR`. `src/background/api/mal.test.ts`: 401 then refresh then success; 429 with `Retry-After`; timeout during `json()` gives `NETWORK` with `timedOut`. `src/ui/accounts`: the `sessionExpired:<service>` flag gives `expired: true`.
- **Manual check (Chrome + Firefox):** revoke SyncKai's access on AniList, wait for a sync, open the popup: "Session expired" in red. Firefox: first MAL sign-in with a wrong redirect URL shows the dedicated message with the expected URL.
- **Migration:** none.

### Batch 15 · `chore/tests-orchestration`

**Goal:** cover the service worker's write path with a decision table and a few integration scenarios.

| Cases | Severity | Subject |
|---|---|---|
| [TEST-01](AUDIT-2026-10-10.md#test-01) | medium | `sync-service.ts` without tests |
| [TEST-07](AUDIT-2026-10-10.md#test-07) | medium | `queue.ts` without tests |
| [TEST-06](AUDIT-2026-10-10.md#test-06) | medium | `createJobLoop` without tests |
| [ARCH-25](AUDIT-2026-10-10.md#arch-25) | medium | Shared fake chrome API and coverage measurement |

- **Effort:** M.
- **Dependencies:** batches 3 and 5 (the `sync-service.test.ts` file already exists).
- **Tests:** `src/test/fake-chrome.ts` (`storage.local`/`session` with `onChanged`, `alarms`, `navigator.locks` with `ifAvailable`, scriptable `fetch`). Extend `sync-service.test.ts` with the TEST-01 decision table (exclusions, `ignored`, low confidence, null `idMal`, "beyond the entry" guard). `src/background/sync/queue.test.ts`: network failure gives an entry and the alarm; later success empties the queue and clears the alarm; partial success `only=['mal']`; two simultaneous `processSyncQueue` calls give a single `syncEpisode`. `src/background/jobs/runner.test.ts`: fake timers, `cancel` during the pause, `ensure()` on a loop silent for longer than `JOB_STALE_MS`, `step.stop`. `@vitest/coverage-v8` as a report only, with no blocking threshold.
- **Manual check:** none (tests only).
- **Migration:** none.

### Batch 16 · `bugfix/import-crunchyroll`

**Goal:** a history import that is robust to transient errors, linear in cost and compliant with the privacy policy.

| Cases | Severity | Subject |
|---|---|---|
| [CRI-05](AUDIT-2026-10-10.md#cri-05) | low | Retry: successful write reported as a failure, match not learned |
| [CRI-01](AUDIT-2026-10-10.md#cri-01) | medium | A transient error loses the whole history read |
| [ARCH-14](AUDIT-2026-10-10.md#arch-14) | medium | Background jobs not resumed after an update |
| [CRI-04](AUDIT-2026-10-10.md#cri-04) | low | Reduced history kept after a stop or a failure |
| [CRI-06](AUDIT-2026-10-10.md#cri-06) | low | 400 without `invalid_client` classified as "disconnected"; Store justification |
| [PERF-02](AUDIT-2026-10-10.md#perf-02) | low | Full reread and rewrite for each season (quadratic cost) |
| [UI-06](AUDIT-2026-10-10.md#ui-06) | low | "Already up to date" / "To check" blocks collapsed on every progress update |
| [TEST-05](AUDIT-2026-10-10.md#test-05) | medium | `background/cr-import.ts` without tests |

- **Effort:** L (split into two commits if review requires it: robustness, then performance).
- **Dependencies:** batches 3, 12 and 15 (fake chrome API).
- **Tests:** new `src/background/cr-import.test.ts` (TEST-05 scenarios): season with no known number, so to check; `persist:false`; AniList OK then MAL 503: only MAL is retried and AniList counted as "updated" with the match learned; stop gives `input` and `resolutions` cleared; resolutions written in batches. `src/content/lib/crunchyroll-history.test.ts`: 429 with `Retry-After` then success; persistent failure of a season lookup gives an unknown position, not an abort; 400 `invalid_request` gives `unavailable`. `src/background`: `onInstalled` calls `resumeCompareJob` and `resumeCrImport`. `scripts/e2e/import-cr.e2e.ts`: the open state of the `<details>` survives a `draw()`.
- **Manual check (Chrome):** import a real history with a brief Wi-Fi outage during season lookups; reload the extension while the import is being applied, then check that it resumes without restarting the browser.
- **Migration:** on startup, delete orphaned `crImport:input` and `crImport:resolutions` (job missing or finished). Update `PRIVACY.md` and `docs/store/permissions.md` (temporary token requested from Crunchyroll with the site's public identifier) and document the rotation of `CR_WEB_CLIENT_ID` in `docs/STORE.md`.

### Batch 17 · `bugfix/alertes-sortie`

**Goal:** accurate airing alerts without opening the popup, with no gaps and no losses.

| Cases | Severity | Subject |
|---|---|---|
| [ALRT-01](AUDIT-2026-10-10.md#alrt-01) | medium | Alerts based on a "Watching" cache that only the popup refreshes |
| [ALRT-04](AUDIT-2026-10-10.md#alrt-04) | low | `airingNotified` committed before the notifications are created |
| [ALRT-02](AUDIT-2026-10-10.md#alrt-02) | low | Delay lowered: episodes in the interval never notified |
| [ALRT-06](AUDIT-2026-10-10.md#alrt-06) | low | Pagination silently truncated: recent releases are lost |
| [ALRT-03](AUDIT-2026-10-10.md#alrt-03) | low | Excluded series without `mediaId` still notified |
| [PERF-04](AUDIT-2026-10-10.md#perf-04) | low | Profiles and "Watching" list reloaded on every open |

- **Effort:** M.
- **Dependencies:** batch 13 (epoch in `runCheck`).
- **Tests:** `airing-policy.test.ts`: window resumed from the last covered bound when the delay goes from 6 h to 0 h. New `src/background/airing.test.ts` (fake chrome API): a cache older than 12 h is refreshed before the computation; a notification that fails is removed from `airingNotified`; truncation gives a week cache marked incomplete. `agenda.test.ts`: exclusion by `platformKey`. `src/shared/watching.test.ts`: `GET_WATCHING` without `force` and less than 90 s old does not send a new request.
- **Manual check (Chrome):** popup closed for more than 12 h, then a followed series airs: the alert arrives. Exclude a series from Crunchyroll before the entry is resolved: it disappears from the Schedule.
- **Migration:** none.

### Batch 18 · `bugfix/stockage-local`

**Goal:** storage writes that are locked, non-destructive and bounded.

| Cases | Severity | Subject |
|---|---|---|
| [BAK-02](AUDIT-2026-10-10.md#bak-02) | low | Imported matches poorly validated, used with high confidence |
| [ARCH-15](AUDIT-2026-10-10.md#arch-15) | low | Destructive rewrites of `mediaMappings` (write to the raw object) |
| [DATA-02](AUDIT-2026-10-10.md#data-02) | low | "Ignore" on a rating rewrites `pendingRatings` without a lock |
| [ARCH-18](AUDIT-2026-10-10.md#arch-18) | low | Unlocked writes in `import-cr.ts`, wake-ups caused by `storage.session` |
| [DATA-03](AUDIT-2026-10-10.md#data-03) | low | Pruning of per-series delays: smallest `mediaId`, not oldest |
| [DATA-04](AUDIT-2026-10-10.md#data-04) | low | `storage.session` caches never purged nor cleared on sign-out |

- **Effort:** M.
- **Dependencies:** batch 12.
- **Tests:** `backup.test.ts`: `mediaId` 1.5 or -3, offset -500, key not matching `^(crunchyroll|adn|netflix):.+:s\d+$` are rejected. `storage.test.ts`: an unreadable `mediaMappings` entry survives `saveMediaMapping`. `engagement-store.test.ts`: a single `isPendingRating` guard; `popup/pending-ratings.ts` and its test deleted. `settings.test.ts`: 200 delays plus a setting on id 21 keep id 21 (out-of-order insertion). `page-media-cache.test.ts`: purge of expired `pageMedia:*` and `panelMedia:*`, cleared on sign-out.
- **Manual check (Chrome):** import a forged backup with an absurd offset: the match is refused. "Ignore" a rating in the popup while a finale ends in another tab: the new card stays.
- **Migration:** per-series delays move to the `{ minutes, at }` format; convert the old ones keeping everything (`at` = update date). Imported matches marked "to recheck" on first use.

### Batch 19 · `bugfix/extraction-episode`

**Goal:** Crunchyroll and ADN episode extraction tested on real data, with no side effects on host pages.

| Cases | Severity | Subject |
|---|---|---|
| [CONT-04](AUDIT-2026-10-10.md#cont-04) | medium | Stale JSON-LD accepted if it has neither `url` nor `@id` |
| [TEST-04](AUDIT-2026-10-10.md#test-04) | medium | Crunchyroll and ADN watch page extraction not tested |
| [ARCH-01](AUDIT-2026-10-10.md#arch-01) | medium | The content script rewrites the sites' `<html lang>` |
| [PERF-03](AUDIT-2026-10-10.md#perf-03) | low | Every streaming tab listens to `storage.onChanged` |

- **Effort:** M.
- **Dependencies:** none.
- **Tests:** real, anonymized and dated fixtures in `src/content/adapters/__fixtures__/` (One Piece: `episodeNumber` 25, name "Elbaph | E1180 - …"; ADN). `crunchyroll.test.ts`: `episodeFromJsonLdNodes` separates `seasonEpisodeNumber` and `displayedEpisodeNumber`; a node without `url` still on E1180 is rejected when the `<h1>` announces E1181. `adn.test.ts`: watch page extraction. `src/i18n`: `initI18n({ setDocumentLang: false, follow: false })` leaves `document.documentElement.lang` untouched and sets no listener.
- **Manual check (Chrome + Firefox):** autoplay One Piece E1180 to E1181: the popup shows E1181. Crunchyroll in Spanish with SyncKai in English: `document.documentElement.lang` stays `es-419`, and the import fetches the Spanish titles.
- **Migration:** none.

### Batch 20 · `chore/frontieres-modules`

**Goal:** break the import cycles and move the UI kit out of `popup/`.

| Cases | Severity | Subject |
|---|---|---|
| [ARCH-04](AUDIT-2026-10-10.md#arch-04) | medium | `ui/` imports `popup/`, two import cycles |
| [ARCH-11](AUDIT-2026-10-10.md#arch-11) | medium | `STORAGE_KEYS` imported from `storage.ts` by type modules |

- **Effort:** M (mechanical renames).
- **Dependencies:** to be done after batches 6 and 18 to limit conflicts; before batch 21.
- **Tests:** minimal `src/architecture.test.ts`: no cycles, `shared ↛ ui/popup/sidepanel/content`, `ui ↛ popup/sidepanel`. New leaf `src/shared/storage-keys.ts`, `normalizeTitle` moved out of `matching.ts`.
- **Manual check (Chrome):** popup, side panel, settings, backup import and Crunchyroll import open without console errors; `npm run test:e2e` passes.
- **Migration:** none. Boundary rules described in 10 lines in `CLAUDE.md`.

### Batch 21 · `feature/controleur-fiche-page`

**Goal:** a single "page entry" state machine for the popup and the side panel, and a season choice that counts for sync.

| Cases | Severity | Subject |
|---|---|---|
| [ARCH-20](AUDIT-2026-10-10.md#arch-20) | medium | Season chosen in the side panel ignored by sync |
| [ARCH-05](AUDIT-2026-10-10.md#arch-05) | medium | "Page entry" controller duplicated between popup and side panel |

- **Effort:** M.
- **Dependencies:** batches 6 and 20.
- **Tests:** `src/ui/page-media-controller.test.ts`: `detecting`, `loading`, `ready`, `not-found` and `error` states aligned; anti-echo; late response after a page change ignored. `page-media.test.ts`: a manual season choice records the match (`mediaMappings`), and `EPISODE_COMPLETED` uses it.
- **Manual check (Chrome + Firefox):** choose another season in the side panel then finish the episode: the progress goes to the chosen season. Same page in the popup and the side panel: same states and same messages.
- **Migration:** none. CHANGELOG: the season chosen in the side panel is remembered as a match ("Forget" to undo).

### Batch 22 · `feature/accessibilite`

**Goal:** stable keyboard focus and screen reader announcements that are not repeated.

| Cases | Severity | Subject |
|---|---|---|
| [UX-01](AUDIT-2026-10-10.md#ux-01) | medium | Focus lost when the active button is disabled or removed |
| [UX-02](AUDIT-2026-10-10.md#ux-02) | medium | `role="alert"` regions recreated on every render |
| [PERF-06](AUDIT-2026-10-10.md#perf-06) | low | Full popup render every second, with no batching |

- **Effort:** M.
- **Dependencies:** batch 20 (UI kit moved).
- **Tests:** test of `src/ui/dom.ts`: a button in `aria-disabled` keeps the focus; a removed element gives the focus to `data-focus-fallback`. `scripts/e2e/popup.e2e.ts`: Tab to the +1, Enter, `document.activeElement` is still the +1; the `role="alert"` node of the access banner is the same object between two renders; `scheduleRender()` triggers only one render per tick.
- **Manual check (Firefox + NVDA, Chrome with the keyboard):** +1, "Retry" and "Forget" with the keyboard; access banner removed in Firefox: a single announcement.
- **Migration:** none.

### Batch 23 · `bugfix/finitions-ui`

**Goal:** small interface and text errors (3 languages).

| Cases | Severity | Subject |
|---|---|---|
| [UI-04](AUDIT-2026-10-10.md#ui-04) | low | Account card stuck on the skeleton with no error |
| [UI-05](AUDIT-2026-10-10.md#ui-05) | low | Enter on an empty delay saves 0 minutes |
| [UI-07](AUDIT-2026-10-10.md#ui-07) | low | Backup import: another file chosen during the import overwrites the state |
| [BRW-02](AUDIT-2026-10-10.md#brw-02) | low | Firefox: the shortcut's "Change" button opens a `chrome://` URL |
| [UX-05](AUDIT-2026-10-10.md#ux-05) | low | Netflix missing from the welcome screen, the empty state and the off-target side panel |
| [UX-06](AUDIT-2026-10-10.md#ux-06) | low | "Settings › Playback" tip with no matching entry |
| [UX-07](AUDIT-2026-10-10.md#ux-07) | low | Hardcoded French punctuation on the import page |
| [BAK-05](AUDIT-2026-10-10.md#bak-05) | low | Export file name always in French, blob export from the popup |

- **Effort:** M (many but small).
- **Dependencies:** batch 20 preferably.
- **Tests:** `src/i18n/locales.test.ts`: `crImport.labelValue` keys present in all 3 languages. `src/ui/settings/navigation.test.ts`: tip path built from `settings.cat.sync`. Unit tests for reading the delay field (empty gives NaN) and for `page-accounts` (null viewer with an error gives an alert with Retry). Regenerate the screenshots (`npm run screenshots`) if the displayed texts change.
- **Manual check:** Firefox: shortcut button (opens `browser.commands.openShortcutSettings()` or shows the help). Export from the popup with "Always ask where to save files" in Firefox and Chrome. Import page in English and German.
- **Migration:** none.

### Batch 24 · `feature/durcissement-securite`

**Goal:** comply with the `CLAUDE.md` rule on tokens, restrict images and messages.

| Cases | Severity | Subject |
|---|---|---|
| [SEC-01](AUDIT-2026-10-10.md#sec-01) | low | OAuth tokens in plain text in `storage.local`, readable by content scripts |
| [SEC-02](AUDIT-2026-10-10.md#sec-02) | low | Cover URLs not validated, no `img-src` CSP |
| [ARCH-07](AUDIT-2026-10-10.md#arch-07) | low | Message denylist instead of an allowlist |

- **Effort:** M.
- **Dependencies:** batches 13 and 14 (same token code).
- **Tests:** `storage.test.ts`: token encrypted with AES-GCM using a non-extractable key kept in IndexedDB; an old plain-text token is migrated on first access. `messages.test.ts`: exhaustive `MESSAGE_ORIGINS`, and the `content` types match exactly what `src/content` sends. `engagement-store.test.ts` and `backup.test.ts`: `coverUrl` outside the host list rejected.
- **Manual check (Chrome + Firefox):** after the update, AniList and MAL stay connected (token migration); covers are displayed; no CSP error in the console in the popup, the side panel or the import pages.
- **Migration:** encryption of existing tokens on update; on failure, clean disconnect with "Session expired". The `extension_pages` CSP changes the manifest: check it in Firefox, and check that the Chrome Web Store listing has nothing to justify (it is not a permission).

---

## 2.3.0: platforms

### Batch 25 · `chore/registre-plateformes`

**Goal:** a single descriptor per platform (label, hosts, `linkRequired`, URLs), a prerequisite for any new platform.

| Cases | Severity | Subject |
|---|---|---|
| [ARCH-02](AUDIT-2026-10-10.md#arch-02) | medium | Platform registry (reduced scope: `shared/platforms.ts` only) |

- **Effort:** S.
- **Dependencies:** batches 1 and 20.
- **Tests:** `src/shared/platforms.test.ts`: exhaustive `Record<StreamingPlatform, …>`; `matchPlatformLink`, `platform-links.ts` and the labels go through the registry. No regression with `matching-netflix.test.ts` and `platform-links.test.ts`.
- **Manual check (Chrome):** "Open" links and platform icons in the popup, the side panel and the Schedule.
- **Migration:** none. Extracting `optional-platforms.ts` and `main-bridge.ts` waits for a second optional platform.

The HIDIVE adapter (`feature/hidive-adapter`, outside the audit) plugs into this registry. A new host in `host_permissions` or `content_scripts` triggers a permission warning in Chrome, and the extension is disabled until the user accepts: go through `optional_host_permissions` like Netflix, or accept it explicitly. In both cases, justify the permission in the Chrome Web Store Privacy tab before the tag.

### Batch 26 · `bugfix/reattachement-video`

**Goal:** the playback session follows the right `<video>` to the end and no longer silently loses an episode.

| Cases | Severity | Subject |
|---|---|---|
| [CONT-01](AUDIT-2026-10-10.md#cont-01) | medium | `<video>` fixed at startup: completion missed if the player is replaced |
| [CONT-02](AUDIT-2026-10-10.md#cont-02) | medium | Wait for the player limited to 30 s with no retry |
| [CONT-06](AUDIT-2026-10-10.md#cont-06) | low | Orphaned script after an update: only warns at the end |
| [CONT-05](AUDIT-2026-10-10.md#cont-05) | low | Send failure without "Retry", completion disarmed |
| [CONT-07](AUDIT-2026-10-10.md#cont-07) | low | Netflix: "Retry" stays active during sending (duplicates) |
| [CTRL-07](AUDIT-2026-10-10.md#ctrl-07) | low | "Mark the episode as watched" shortcut gives no feedback when it does nothing |
| [TEST-09](AUDIT-2026-10-10.md#test-09) | low | `trackVideoProgress` never run in tests |

- **Effort:** L.
- **Dependencies:** batch 19 (fixtures and content i18n), batch 15 for the fake timers.
- **Tests:** new `src/content/lib/video-tracker.test.ts` (fake video based on `EventTarget`): a single `onCompleted`; rearming on `loadstart`; duration under 120 s ignored; no more calls after `abort`. `watch-session.test.ts`: `<video>` detached then replaced, so tracker recreated; player appearing after 35 s (`play` captured on `document`); `sendMessage` throwing gives a toast with Retry; sync paused, then `forceComplete` resends the episode; double click on Retry gives a single send; invalidated context detected at session start. Test of the `onInstalled` reinjection with the `STARTED_FLAG` guard.
- **Manual check (Chrome + Brave + Firefox):** Crunchyroll and Netflix autoplay through to the next episode; episode opened in a background tab then watched more than a minute later; reload the extension with a Crunchyroll tab open: immediate warning or reinjected script; Alt+Shift+S on an already synced episode shows a toast.
- **Migration:** none. Reinjection uses the `scripting` permission already declared (2.1.0): no new justification.

### Batch 27 · `feature/agenda-hors-cible`

**Goal:** the Schedule and the side panel are reachable outside a streaming tab.

| Cases | Severity | Subject |
|---|---|---|
| [UX-04](AUDIT-2026-10-10.md#ux-04) | low | Schedule unreachable outside a Crunchyroll, ADN or Netflix tab |

- **Effort:** M.
- **Dependencies:** batches 6 and 21.
- **Tests:** `src/sidepanel/tabs.test.ts` and `presence.test.ts`: off target, Schedule and Settings tabs available, Schedule by default; "Now playing" reserved for the tracked tab. e2e: "Open the side panel" button visible off target.
- **Manual check (Chrome + Firefox):** open the side panel on any site: the Schedule shows and the side panel does not close (Chrome, `presence.ts`).
- **Migration:** none.

---

## Later

### Batch 28 · `chore/popup-controleurs`

**Goal:** split `popup.ts` into controllers gradually, whenever a feature touches it.

| Cases | Severity | Subject |
|---|---|---|
| [ARCH-08](AUDIT-2026-10-10.md#arch-08) | low | 1,382-line `popup.ts`, three state conventions, duplicated menus |

- **Effort:** L (through small extractions: `compare`, `ratings`, `queue`, then `watching`).
- **Dependencies:** batches 21 and 22 (render batching already done).
- **Tests:** each extracted controller gets its unit test with the fake chrome API; `npm run test:e2e` at each extraction.
- **Manual check:** full popup in Chrome and Firefox after each extraction.
- **Migration:** none.

### Batch 29 · `chore/i18n-contenu-leger`

**Goal:** load into content scripts only the keys that are needed, or only the active language.

| Cases | Severity | Subject |
|---|---|---|
| [PERF-01](AUDIT-2026-10-10.md#perf-01) | low | 3 full i18n catalogs in every content script (~255 KB) |

- **Effort:** M.
- **Dependencies:** batches 10 (size budget) and 19.
- **Tests:** `verify-build.ts`: budget tightened to 80 KB for the content loader; `locales.test.ts`: all `content.*` keys in use exist in the reduced catalog.
- **Manual check (Chrome + Firefox):** content script toasts and bubbles in all 3 languages, language change applied at the next session.
- **Migration:** none.

---

## Grouped / dropped

Each row points to the main case that carries the fix. No case is dropped: oversized recommendations are scaled down in the batch of their main case (ARCH-02, ARCH-15, ARCH-19, ARCH-25).

| Cases | Attached to | Reason |
|---|---|---|
| [ARCH-13](AUDIT-2026-10-10.md#arch-13) | [SYNC-02](AUDIT-2026-10-10.md#sync-02) (batch 2) | Same defect: reread before the alignment |
| [CTRL-05](AUDIT-2026-10-10.md#ctrl-05) | [UI-02](AUDIT-2026-10-10.md#ui-02) (batch 6) | Same `runAction` scenario in `now-playing.ts:347` |
| [CTRL-06](AUDIT-2026-10-10.md#ctrl-06) | [ARCH-12](AUDIT-2026-10-10.md#arch-12) (batch 3) | Per-entry lock around `adjustOnService` |
| [BRW-03](AUDIT-2026-10-10.md#brw-03) | [CONT-03](AUDIT-2026-10-10.md#cont-03) (batch 7) | Same case: Netflix tab open after removal |
| [BAK-03](AUDIT-2026-10-10.md#bak-03) | [BRW-04](AUDIT-2026-10-10.md#brw-04) (batch 7) | Same fix: centralized effective preferred player |
| [UX-03](AUDIT-2026-10-10.md#ux-03) | [BRW-02](AUDIT-2026-10-10.md#brw-02) (batch 23) | Same shortcut button in Firefox |
| [BAK-04](AUDIT-2026-10-10.md#bak-04) | [DATA-03](AUDIT-2026-10-10.md#data-03) (batch 18) | Same pruning of `seriesOffsets` |
| [PERF-05](AUDIT-2026-10-10.md#perf-05) | [DATA-04](AUDIT-2026-10-10.md#data-04) (batch 18) | Same unpurged `storage.session` caches |
| [SEC-03](AUDIT-2026-10-10.md#sec-03) | [DATA-04](AUDIT-2026-10-10.md#data-04) (batch 18) | Clearing `pageMedia:*` on sign-out, included in DATA-04 |
| [ARCH-06](AUDIT-2026-10-10.md#arch-06) | [DATA-02](AUDIT-2026-10-10.md#data-02) (batch 18) | Removal of the second, unlocked "To rate" store |
| [ARCH-16](AUDIT-2026-10-10.md#arch-16) | [ALRT-01](AUDIT-2026-10-10.md#alrt-01) (batch 17) | Same unrefreshed "Watching" cache |
| [ARCH-17](AUDIT-2026-10-10.md#arch-17) | [AUTH-01](AUDIT-2026-10-10.md#auth-01) (batch 13) | `writeIfSession` helper applied to AUTH-01, AUTH-04, DATA-05 and ALRT-05 |
| [ARCH-19](AUDIT-2026-10-10.md#arch-19) | [PERF-02](AUDIT-2026-10-10.md#perf-02) (batch 16) | Only point kept: batched `writeResolution`; LRU and key index deemed speculative |
| [ARCH-09](AUDIT-2026-10-10.md#arch-09) | [TEST-01](AUDIT-2026-10-10.md#test-01) (batch 15) | Same decision table on `syncEpisode` |
| [ARCH-26](AUDIT-2026-10-10.md#arch-26) | [TEST-04](AUDIT-2026-10-10.md#test-04) (batch 19) | Real dated fixtures; happy-dom only if a DOM fallback requires it |
| [ARCH-03](AUDIT-2026-10-10.md#arch-03) | [PERF-01](AUDIT-2026-10-10.md#perf-01) (batch 29) | Real gain only on the i18n side; splitting `messages.ts` has no effect; budget in batch 10 |
| [ARCH-10](AUDIT-2026-10-10.md#arch-10) | [PERF-01](AUDIT-2026-10-10.md#perf-01) (batch 29) | Complementary finding on the same i18n weight |
| [REL-01](AUDIT-2026-10-10.md#rel-01) | [ARCH-24](AUDIT-2026-10-10.md#arch-24) (batch 8) | Same CWS failure; ARCH-24 carries the automatic guard |
| [REL-05](AUDIT-2026-10-10.md#rel-05) | [ARCH-23](AUDIT-2026-10-10.md#arch-23) (batch 8) | Same pinning of the publishing CLIs |

---

## Reminder: release checklist

Common to every version (see `CLAUDE.md` and `docs/STORE.md`):

1. `release/x.y.z` branch from `develop`.
2. `npm version x.y.z --no-git-tag-version` (`manifest.json`, `package.json`, `package-lock.json`), then grep for the old version (popup footer, screenshot harness).
3. `CHANGELOG.md` entry (FR, Keep a Changelog), `chore(release): x.y.z` commit.
4. **Permissions**: if `permissions`, `host_permissions` or `optional_host_permissions` change, update `docs/store/permissions.md` **and** the Privacy tab of the Chrome Web Store dashboard **before the tag**. The 2.0.0 and 2.1.0 submissions failed for lack of justification. Also carry the change over to `amo-metadata.json` and the listings.
5. `npm run verify` (after batch 11) and `npm run test:e2e` before the tag: the `build` job of `release.yml` reruns them, and a failure blocks the upload to the stores.
6. `npm run screenshots` if the interface or the displayed version changes.
7. Fast-forward on `main`, annotated tag `vx.y.z` ("SyncKai x.y.z"), `develop` aligned, push: only after an explicit go.

Points specific to each version:

- **2.1.1**: no new permission expected (the batch 8 test confirms it). Batch 8 merged before the tag. CHANGELOG: note on wrong matches (batch 1: check previous series, "Forget" in *Settings › My data*), purge of `netflix:*` matches, alignment that skips modified series. Full manual test in Chrome and Firefox (batches 1, 6 and 7).
- **2.2.0**: migrations on update (queue epoch, per-series delay format, token encryption) tested by installing 2.1.1 then updating to the local build. The batch 24 CSP changes the manifest: check `web-ext lint` and that there is no CSP error. CHANGELOG: account binding, remembered season choice.
- **2.3.0**: any new platform (HIDIVE, Prime Video, Disney+) adds a host. Prefer `optional_host_permissions` to avoid the extension being disabled on update in Chrome, and justify the permission in the Privacy tab before the tag. Update `PRIVACY.md` (effective date), `permissions.md`, the listings and `amo-metadata.json`.
