# Findings · audit of 2026-11-10

69 findings after deduplication of the 78 reported by the 17 auditors, on `4188b90` (`release/2.5.0`). **Paths and line numbers refer to `4188b90`.** Method and legend: `README.md`. Priorities and branch plan, in French: `0-synthese.md`.

How to read an entry:

- **ID**: the first auditor ID; merged duplicates are listed after it (« also … »).
- **Severity** and **verdict**: the verifier's final severity, verdict and corrected fix for verified findings (group V1 to V5); the auditor's severity and « unverified » for the low findings no verifier checked.
- **Since 2.5.0**: whether the faulty code is in `46942a2..4188b90`.
- **Test first**: the test that must fail before the fix (tests first, `CLAUDE.md`).
- IDs such as M6, I5, PERF-17, 2-R6 or « 2026-10-15 SEC-04 » point to the previous audit (`docs/audit/2026-10-15/`). UI labels are quoted from the French interface, as the owner sees it.

## Index

| ID | Severity | Verdict | Since 2.5.0 | Area | Title |
|---|---|---|---|---|---|
| TRK-01 (also PERF-01, SEQ-01, XB-01) | high | CONFIRMED | yes | Sequel alerts | The daily sequel pass dies in a silent budget wait and never completes for large lists |
| SEQ-05 | low | unverified | yes | Sequel alerts | MAL-only on Chrome: the notification's « + À regarder » always fails for a sequel without `idMal` |
| SEQ-04 | low | unverified | yes | Sequel alerts | Activité: a sequel just added jumps behind « N autres suites » and its result is hidden |
| SEQ-03 | low | unverified | yes | Sequel alerts | A failed add on a sequel row is not announced, and the button keeps its « Ajouter » name |
| ARCH-01 | medium | CONFIRMED | yes | Release and tooling | CI e2e red at the 2.5.0 head; `release.yml` runs the same suite before the store upload |
| ARCH-04 | low | unverified | no | Release and tooling | Prime Video expected-fail 2-R6 still open, while the previous audit is recorded as closed |
| ARCH-05 (also UI-07) | low | unverified | yes | Release and tooling | Seven dead translation keys, no unused-key check, a vacuous assertion, dead helpers |
| ARCH-06 | low | unverified | no | Release and tooling | The store packages bundle Preact without its MIT notice |
| SEC-01 (also TERMS-01) | medium | CONFIRMED | yes | Privacy and terms | 2.5.0 data flows are missing from `PRIVACY.md` and the Chrome Web Store privacy texts |
| TERMS-03 | low | unverified | yes | Privacy and terms | MyAnimeList titles are stored and shown in AniList recommendation cards |
| TERMS-04 | low | unverified | yes | Privacy and terms | Remaining time reads MAL's `average_episode_duration`, against « new features read AniList only » |
| PERF-02 | medium | CONFIRMED | yes | Popup and dormant series | « Tout mettre en pause » trips AniList's 429 from the 16th series and blocks AniList for a minute |
| POP-01 | medium | PLAUSIBLE | partly | Popup and dormant series | The popup is clipped and its status bar unreachable when zoomed |
| POP-04 | low | unverified | yes | Popup and dormant series | A series waiting for its first episode is flagged dormant, and the bulk pauses it |
| POP-02 | low | unverified | yes | Popup and dormant series | A single pause ending mid-bulk re-enables the rows; « Garder » is then overwritten |
| POP-03 | low | unverified | yes | Popup and dormant series | Dormant actions run on the cached list while it is revalidated or after it failed |
| POP-06 | low | unverified | partly | Popup and dormant series | Pause, drop and undo leave the worker's watching cache stale for up to 90 s |
| POP-08 | low | unverified | yes | Popup and dormant series | « Garder » marks of a MAL list change key when the AniList enrichment fails |
| POP-07 | low | unverified | yes | Popup and dormant series | « Moyenne des amis » is computed on a biased subset above 50 followed users |
| RECO-02 | medium | CONFIRMED | yes | Recommendations | During the dice turn, the buttons act on the next suggestion, not the one on screen |
| RECO-01 (also PERF-05) | medium | CONFIRMED | yes | Recommendations | MAL-only builds map every watched MAL entry: 22 AniList requests per batch for 1000 entries |
| RECO-05 | low | unverified | yes | Recommendations | « Dans À regarder » is shown even when MAL got nothing or nothing was written |
| RECO-03 | low | unverified | yes | Recommendations | MAL-only: a series written to MAL during a build ends up in the batch |
| RECO-06 | low | unverified | yes | Recommendations | Adult seeds can be named in the « Parce que tu as noté… » line |
| RECO-07 | low | unverified | yes | Recommendations | « Dans le même esprit » re-reads list states on every refresh of the same series |
| RECO-08 | low | unverified | yes | Recommendations | A dismissed suggestion shows up in « Déjà tirées » |
| UI-06 | low | unverified | yes | Recommendations | « Pour toi » card: raw AniList format, unlocalized average, low-contrast « Activer » chips |
| RECO-04 | low | unverified | yes | Recommendations | Label in name: the accessible names of « Pas intéressé » and « Autre » lack the visible label |
| UI-01 (also ORD-02) | medium | CONFIRMED | partly | Shared UI | The focus fallback misses removals rendered by a child: focus falls to `<body>`, then jumps |
| UI-03 | medium | CONFIRMED | no | Shared UI | `useId` restarts in every Preact root, so ARIA references point into another tree |
| UI-04 | medium | CONFIRMED | no | Shared UI | A rating changed with the arrow keys shows as the score but is never sent without Enter |
| UI-02 | low | CONFIRMED | no | Shared UI | A click after the hover delay closes the sub-menu it just opened |
| UI-05 | low | unverified | no | Shared UI | The status bar's live region re-announces the relative time and the import counters |
| SYNC-01 | medium | CONFIRMED | no | Sync and tracker writes | Fractional or missing episode numbers delete or corrupt the season mapping |
| SYNC-03 | low | unverified | no | Sync and tracker writes | A confirmed card is guarded again when the queue retries its failed write |
| TRK-02 | low | unverified | no | Sync and tracker writes | Session-bound AniList writes are still sent after a sign-out during a 429 penalty |
| CR-01 | medium | CONFIRMED | no | Security hardening | Crunchyroll bridge signals accept unknown keys: a page script can fill the 10 MB storage |
| SEC-02 | low | unverified | yes | Security hardening | `reco:batch` is served without revalidation |
| SEC-03 | low | unverified | no | Security hardening | The stored-URL revalidation is bypassed through `recentSyncs` and the profile URL |
| SEC-04 | low | unverified | no | Security hardening | Content-script rating and rewatch messages are not tied to a prompt nor rate-limited |
| SVOD-01 | medium | PLAUSIBLE | no | Streaming platforms | Prime Video films are probably never synced |
| CR-02 | low | unverified | no | Streaming platforms | Crunchyroll music videos and concerts are treated as episodes: false error toast |
| SVOD-02 | low | unverified | no | Streaming platforms | Prime: an episode resumed on another page of the same tab is never tracked |
| SVOD-03 | low | unverified | no | Streaming platforms | Prime: a script injected into an open tab takes the first page's data for the current one |
| ORD-01 | low | CONFIRMED | yes | Watch order | « Regarder » lost the learned (ADN) and history links of the 2.4.2 related rows |
| ORD-08 | low | unverified | yes | Watch order | `shortTitle` cuts « Overlord II » down to « II » and shows « Ensuite : I » |
| ORD-07 | low | unverified | yes | Watch order | A difference between the two services is hidden when the chosen one has no state |
| ORD-06 | low | unverified | yes | Watch order | MAL states come from the 5-minute memo after « Actualiser », popup actions and syncs |
| ORD-05 | low | unverified | yes | Watch order | An id AniList no longer returns makes 12 identical requests, never cached |
| ORD-04 | low | unverified | yes | Watch order | Extras of a cached franchise miss the cache and walk it again |
| PNL-01 | low | PLAUSIBLE | no | Side panel | Live progress stays on « Recharge l'onglet… » after a slow reload, and reloading never clears it |
| PNL-04 (also XB-03) | low | unverified | yes | Side panel | « Plus d'idées dans le panneau » is taken by another window's panel |
| PNL-03 | low | unverified | no | Side panel | Agenda: the answer for the week just left is shown for the new week |
| IMP-01 | low | CONFIRMED | no | Imports and backup | Backup « Fusionner » can drop this device's pending correction cards |
| IMP-02 | low | CONFIRMED | no | Imports and backup | Bulk requests above a message cap fail with a misleading error |
| IMP-03 | low | unverified | no | Imports and backup | The history import's apply ignores an exclusion made after the analysis |
| ORD-03 | medium | CONFIRMED (decision to revisit) | yes | Decisions | Recaps linked by PREQUEL / SEQUEL enter the main chain: « Ensuite » after the Gundam TV is its recap film |
| TERMS-02 | low | DELIBERATE (decision to revisit) | yes | Decisions | Users who had turned release alerts off get sequel alerts and notifications after the update |
| SEQ-02 | low | CONFIRMED (decision to revisit) | yes | Decisions | A sequel pruned while its source was paused never comes back |
| SYNC-02 | low | CONFIRMED (decision to revisit) | no | Decisions | Unmarked (pre-2.4.0) mappings are deleted when out of range, against three documents |
| XB-02 | low | unverified (decision to revisit) | yes | Decisions | The grouped sequel notification almost never opens Activité |
| POP-05 | low | unverified (decision to revisit) | yes | Decisions | The bulk pause runs in the popup: closing it stops the run and loses « Annuler » |
| PERF-03 | low | unverified (decision to revisit) | yes | Decisions | The panel re-downloads the whole MAL list for almost every new view |
| PERF-04 | low | unverified (decision to revisit) | yes | Decisions | Hourly worker wake-ups return for users with release alerts off |
| PNL-02 | low | unverified (decision to revisit) | no | Decisions | The Agenda week is never re-read while the panel stays open |
| STO-02 (also IMP-04) | low | unverified (decision to revisit) | yes | Decisions | Dismissed suggestions are invisible in the backup preview; « Remplacer » with an old file erases them |
| STO-01 | low | unverified (decision to revisit) | no | Decisions | Signing in over a stored token keeps the previous account's user-scoped data |
| ARCH-02 | low | unverified (decision to revisit) | no | Decisions | Content-script budgets are used up (262 bytes left on Crunchyroll) |
| ARCH-03 | low | unverified (decision to revisit) | no | Decisions | The coverage ratchet was never tightened (4.4 to 5.6 points of slack) |

---

## 1. Sequel alerts and the background budget

### TRK-01 (also PERF-01, SEQ-01, XB-01) · The daily sequel pass dies in a silent budget wait and never completes for large lists
- **Severity:** high · **Verdict:** CONFIRMED (V1) · **Since 2.5.0:** yes
- **Where:** `src/background/rate-limit.ts:141-142` (quota and reserve waits, up to about 60 s), `:211-229` (`waitBackgroundTurn`: 5 s `setTimeout` sleeps, no extension API call); `src/background/anilist/client.ts:48` (token read, the only API call) then `:59` (`acquire`); `src/background/sequels/check.ts:73-76` (6 h backoff needs a stored error), `:88-93` and `:139-141` (`lastCheck` and `sequels:lastResult` written only at the end); `src/background/sequels/fetch.ts:69-72`, `src/background/anilist/by-mal.ts:19-22` (one background request per 50 series, in sequence); `src/background/airing.ts:321-329`, `src/background/background.ts:299-301` (alarm-driven, the listener returns at once).
- **What happens:**
  - In AniList's degraded mode (`X-RateLimit-Limit: 30`, the project's last measure on 2026-10-15), the background lane gets 20 requests a minute; once AniList reports 10 or fewer remaining, background requests wait until 60 s after the last response.
  - The hourly alarm runs the airing check, then the daily pass: ⌈entries / 500⌉ list chunks, the MAL list, one `idMal_in` lookup per 50 MAL-only sources, one relations request per 50 sources. The 21st request of the wake waits about 60 s with no extension event or API call, and Chrome stops an idle worker after 30 s.
  - Nothing is written before the end, so the 6 h backoff never applies: every hourly alarm restarts from the first list chunk and dies at the same request.
  - For the user: no sequel is ever recorded or announced, Activité and the Agenda « Announced » view stay empty, Settings › Notifications says « never checked » (or keeps an older result), and no error shows anywhere. About 20 AniList requests and a full MAL list read are wasted every hour (about 480 AniList requests a day, against about 15 designed).
  - Thresholds reproduced by V1: AniList only, from about 750 to 900 completed, watching or rewatched series (lists of at most 1000 entries); MAL only, from about 460 to 510 sources. In normal mode (90/min), only above about 2000 and 1100.
  - Firefox (read in its sources): the same 30 s idle rule, and `storage.local` reads do not reset it, so a wake longer than 30 s can be cut even without a budget wait.
  - Hidden in testing: dev builds wake the worker every 30 s (`debug:dev-reload` alarm) and the `test:ext` fake AniList answers 90/89.
- **Fix (V1):** in `src/background/sequels/check.ts` › `pass()`, call `void chrome.runtime.getPlatformInfo()` at the start, then every 20 s (`setInterval`, cleared in `finally`). It is Chrome's documented keep-alive, a parent-process call on Firefox, adds no listener and is bounded by the pass. Not a `storage.session` write (it fires `storage.onChanged` in open pages, `browser/panel-tab.ts` listens there). Pinging only during budget waits misses Firefox's long passes. A « pass started » marker is optional hardening: alone, the pass would still die, every 6 h. Add `runtime.getPlatformInfo` to `src/test/fake-chrome.ts`, which has none. Out of scope: message-driven builds under the same waits (`GET_RECOMMENDATIONS`, `GET_FRANCHISE`); whether a pending message keeps a worker alive is unverified, and RECO-01's fix removes the recommendations' exposure in practice.
- **Test first:** `check.test.ts`, fake timers, a `fetchSequelRelations` that resolves after 70 s (or the degraded repro: 950 completed series at 30/min): `chrome.runtime.getPlatformInfo` is called at the start and never more than 25 s apart until the pass resolves. Today it is never called.
- **Confidence:** high on the silent wait and the rerun loop (reproduced with the real client, budget and pass); medium on the stop itself (Chrome's documented rule, Firefox's source; not run in a browser).

### SEQ-05 · MAL-only on Chrome: the notification's « + À regarder » always fails for a sequel without `idMal`
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/background/sequels/check.ts:48` (buttons always added on Chrome), `src/background/sequels/actions.ts:80`, `src/background/controls.ts:244-245`; the rows avoid it: `src/ui/sequel-actions.ts:20-23` (`noMalEntry`), `src/ui/components/sequel-row.tsx:37`, `:65`.
- **What happens:** a MyAnimeList-only user gets « Suite annoncée : X » for a sequel AniList lists without `idMal`, which is common at announcement time. « + À regarder » finds no MAL target, and the notification text becomes « Aucun service connecté n'a de fiche pour cette série. ». Activité shows the same record with « pas encore sur MyAnimeList » and no button.
- **Fix:** give `notify` the pass's `services`; when `noMalEntry(services, idMal)`, show only « Ouvrir la fiche » (button 0 opens). Or check at click time in `addToPlanning` and open the entry.
- **Test first:** `check.test.ts`: MAL-only seed, sequel with `idMal: null` → the notification is created without the « + À regarder » button.
- **Confidence:** high (traced by reading; the synthesis re-read `notify` and `addToPlanning`).

### SEQ-04 · Activité: a sequel just added jumps behind « N autres suites annoncées » and its result is hidden
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/ui/preact/use-sequel-actions.ts:55-58` (`all = [...records, ...kept]`), `src/popup/components/sequels-section.tsx:27-28` (first 3 rows shown).
- **What happens:** with 4 or more announced sequels (common after the silent seeding pass), « + À regarder » on one of the first 3 rows removes its record and appends the finished row after the store's rows, in the collapsed part. The row the user acted on disappears; its « Ajoutée à À regarder » or « pas encore sur MyAnimeList » result, which spec §5.3 wants « on the row until the popup closes », is never seen.
- **Fix:** keep finished rows in place: sort `all` by `firstSeenAt` descending, as `visibleSequels` does, or reinsert them at their previous index.
- **Test first:** `sequels-section.test.tsx`: 4 records, add the first with AniList ok and MAL failing → the row stays among the shown rows with its notice (today: rows 2, 3, 4 and « 1 autre suite annoncée »).
- **Confidence:** high (auditor's throwaway repro).

### SEQ-03 · A failed add on a sequel row is not announced, and the button keeps its « Ajouter » name while showing « Réessayer »
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/ui/components/sequel-row.tsx:63` (failure text without `alertAttrs`), `:66-67` (fixed `ariaLabel`); the same in `src/sidepanel/components/watch-order.tsx:140`, `:142-143`.
- **What happens:** a screen-reader user's add fails (AniList 429, network, expired session): the red text has no `data-alert`, so the page's live region never announces it, and focus stays on a button named « Ajouter X à À regarder » that now reads « Réessayer » (WCAG 4.1.3 and 2.5.3). The same screen announces rating errors (`activity-screen.tsx:213`), and the recommendation card announces its add error (`reco-card.tsx:220`).
- **Fix:** spread `alertAttrs(result.message)` on both failure spans; give the failed button an accessible name that contains « Réessayer » (a new string in 21 languages, or a label built around the visible text).
- **Test first:** render `SequelRow` with a failed outcome → a `[data-alert]` with the message and an accessible name containing « Réessayer ».
- **Confidence:** high.

## 2. Release gate, CI and tooling

### ARCH-01 · CI e2e red at the 2.5.0 head; `release.yml` runs the same suite before the store upload
- **Severity:** medium · **Verdict:** CONFIRMED (V2), cause corrected: a race in two tests, not a product bug · **Since 2.5.0:** yes
- **Where:** `scripts/e2e/popup.e2e.ts:1862`, `scripts/e2e/sidepanel.e2e.ts:520`; `.github/workflows/release.yml:83-84` (`npm run test:e2e` in the `build` job, which the store jobs need); `.github/workflows/ci.yml:3-6` (pushes to `main` / `develop` and PRs only). Focus set later by `src/popup/after-render.ts:15-18` (`setTimeout(0)`) and `src/ui/components/friends-summary.tsx:34-41` (`requestAnimationFrame`).
- **What happens:** CI run 207 (`develop` at `443c461`, the last 2.5.0 push) failed « Tests de bout en bout (popup) » with 2 failed and 116 passed: `expected null to be 'watching-undo'` (dormant « Annuler ») and `expected null to be 'panel-section-friends'` (friends header). No CI run exists since: `release/2.5.0` never went through CI. Pushing the `v2.5.0` tag runs the same suite in `release.yml`, where a failure stops the upload to both stores; nothing is uploaded, so the gate fails safe, but a re-run may pass, which makes it a coin toss. Cause: both tests read `document.activeElement` once, before the focus the product sets one tick or one frame later. The focus always lands (40/40 probe runs, also with the CPU slowed 4×); the friends test fails about 1 run in 15 locally.
- **Fix (V2, test-only):** replace the two one-shot reads with `await page.waitForFunction(() => document.activeElement?.getAttribute('data-focus') === '<key>')`, the form already used at `popup.e2e.ts:1872`, `:1919`, `:1937` and `:2077-2082`. Then get one green CI e2e run on the exact release tree before pushing the tag (push `main` and wait for `ci.yml`, or open a PR from the release branch). Adding `release/**` to `ci.yml` is optional. The other one-shot focus checks sampled (`popup.e2e.ts:578`, `:1880`) follow focus set in the same render and are safe.
- **Test first:** `CI=1 npx vitest run -c vitest.e2e.config.ts scripts/e2e/sidepanel.e2e.ts -t "ouvre la section des amis" --repeats 14` fails about 1 run in 15 today and must pass 15 / 15; same check for the dormant test of `popup.e2e.ts`.
- **Confidence:** high (CI log read through the GitHub API; local repro and probes).

### ARCH-04 · The Prime Video expected-fail 2-R6 is still open, while the previous audit is recorded as closed
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** no
- **Where:** `src/content/prime/session.test.ts:143-165` (`it.fails`); `docs/audit/2026-10-15/0-synthese.md:62`, `:325`; `docs/audit/2026-10-15/README.md:54` (« Nothing is open any more »).
- **What happens:** in ratio mode, with no credits marker, if the player requests the next episode's metadata before the switch, tracking moves to the next episode and the current one is never synced. CI reports it as « 1 expected fail », and nobody checked the real site, so a possibly lost Prime Video sync stays hidden behind a green test.
- **Fix:** the owner checks on Prime Video whether the next episode's catalog arrives before the switch. If it does: switch only on a playback change, or keep the catalog per episode id, then remove `.fails`. If not: record the decision and delete the test.
- **Test first:** the existing `it.fails` (it turns green with the fix).
- **Confidence:** medium (code behaviour proven; site behaviour unverified).

### ARCH-05 (also UI-07) · Seven dead translation keys, no unused-key check, a vacuous assertion and dead helpers
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes (6 of the 7 keys, and `withoutItem`)
- **Where:** `src/i18n/locales/en.json:683-687` (`panel.nowPlaying.relation.*`, left by `4ce84f3`), `:857` (`sequel.source`, never rendered), `:1108` (`watching.minusOne`); `docs/i18n/context.json`; `src/ui/series-menu.test.tsx:85`; `src/shared/recommendations.ts:173` (`withoutItem`), `src/ui/icons.ts:135`, `:142` (`playIcon`, `sparkIcon`), `src/sidepanel/tabs.ts:15`, `:35` (test-only helpers).
- **What happens:** 7 keys × 21 catalogs = 147 strings, plus context notes, are kept in sync and retranslated at every wording pass for nothing; `i18n:check` still warns on one of them. The assertion at `series-menu.test.tsx:85` checks the absence of a key no production code uses, so it can never fail.
- **Fix:** delete the 7 keys from the 21 catalogs and `context.json`, the vacuous assertion and the dead helpers; add a test that fails on any `en.json` key with no literal reference in `src/` (allowlist of dynamic prefixes: `genre.`, `friends.status.`, `page.airing.`, `panel.nowPlaying.season.`, `compare.pause.`…).
- **Test first:** the new unused-key test fails on exactly these 7 keys.
- **Confidence:** high (parser scan of `src/` and `scripts/`).

### ARCH-06 · The store packages bundle Preact without its MIT notice
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** no
- **Where:** `dist/assets/hooks-*.js` (the Preact runtime), zipped by `scripts/package.ts:190-200`; `scripts/build-checks.ts:328-333` (`checkUnreferencedFiles`).
- **What happens:** the MIT licence requires its notice in all copies; the Chrome and Firefox zips ship the minified runtime with none (Tailwind keeps its banner, the fonts carry their OFL notice). A notice file dropped in `public/` would be refused by `verify:build` as unreferenced.
- **Fix:** ship `THIRD_PARTY_NOTICES.txt` with Preact's MIT text and allow it in `checkUnreferencedFiles` (or link it from « Aide et infos »).
- **Test first:** a build-checks test that fails while the notice is missing from the package.
- **Confidence:** high on the fact; low practical risk.

## 3. Privacy, store policies and API terms

### SEC-01 (also TERMS-01) · 2.5.0 data flows are missing from `PRIVACY.md` and the Chrome Web Store privacy texts
- **Severity:** medium (TERMS rated it high) · **Verdict:** CONFIRMED (V2), not deliberate · **Since 2.5.0:** yes · **Release blocker, docs only**
- **Where:** `PRIVACY.md:3`, `:17`, `:44-55`, `:60`, `:69` (FR `:100`, `:127-138`, `:143`, `:152`; DE `:183`, `:210-221`, `:226`, `:235`); `docs/store/permissions.md:10`, `:18`, `:30`, `:36`, `:80`, `:140`, `:153`, `:158`. Behaviour: `src/shared/settings.ts:72-74`, `src/browser/airing-alarm.ts:32`, `src/background/sequels/fetch.ts:89-92`, `:105-106`, `src/background/anilist/by-mal.ts:19-22`, `src/background/mal/full-list.ts:12`, `src/background/anilist/friends.ts:17-29`, `src/background/recommendations/batch.ts:120-157`, `:247`, `src/browser/storage/session-cache.ts:24-30`.
- **What happens:**
  - With the default settings, 2.5.0 reads the full AniList and MAL lists once a day for sequel alerts, sends the MAL ids of every watched, watching or rewatched entry missing from the AniList list to AniList's catalogue (for a MAL-only user, the whole watched history, without a token), reads the relations, and shows notifications whose button writes to the lists.
  - Recommendations do the same reads, keep up to 60 AniList cards with seed titles and scores for 24 h (`reco:batch`) and keep dismissed ids (`reco:dismissed`, also in the backup file).
  - Each series card reads the AniList entries of the people the user follows (name, avatar, status, progress, score), kept 10 minutes in worker memory.
  - New stores: `sequels:state`, `sequels:lastResult`, `reco:batch`, `reco:dismissed`, `watching:keptDormant` locally; `franchise:v1:*` (24 h) and `panelTab` in session storage.
  - `PRIVACY.md` (EN, FR, DE) mentions none of this, and « only sent to AniList and/or MyAnimeList, solely to update your list » becomes false by default. The CWS single-purpose, `alarms`, `notifications`, `storage` and host texts describe less than the extension does.
  - Chrome Web Store policy: privacy fields that contradict the policy or the extension's behaviour can lead to removal, and data practices that change after installation must be prominently disclosed. No automatic rejection: no permission or host changed. `PRIVACY.md` is also the AMO policy (`docs/store/amo.md:29`).
  - Not deliberate: the 2.5.0 spec's « no Store Privacy change » (`2026-11-08-2.5.0-design.md:21`, `:164`) was written while recommendations were a non-goal and before the sequel and recommendation specs, which never revisit it.
  - Corrections (V2): 2.4.2 already sent CURRENT MAL ids to AniList for the Watching list and the Agenda, and all MAL-only entries in the user-started comparison; `permissions.md:158` is an internal note, not a dashboard field. The data-usage checkboxes and certifications still hold, except the pre-existing PII « No » (usernames count as PII).
- **Fix (V2, docs only, before the tag):** the exact change list is in `0-synthese.md` › 1.1. `PRIVACY.md` EN, then FR and DE: effective date, « In short », four new paragraphs (sequel alerts, suggestions, watch order, friends), stored data, session caches, tokens, the `graphql.anilist.co` row. `permissions.md`: single purpose, `alarms`, `notifications`, `storage` (to condense: 912 / 1000 characters now) and the host field (962 / 1000), then paste the changed blocks into the CWS Privacy tab before the tag. If the AMO Developer Hub holds a pasted copy of the policy, paste it again. Mention the change in the 2.5.0 release notes. Should, owner's call: PII « Yes (conservative) » with a rewritten note, the free-text block (`:153`) and the internal note (`:158`). The policy must be on `main` at the tag: its URL is `blob/main/PRIVACY.md`.
- **Test first:** no unit test fits. `npx vitest run scripts/store-permissions.test.ts` keeps the 1000-character limit. Optional guard (TERMS): a line in `scripts/store-permissions.test.ts` that requires each account-scoped group of `account-keys.ts` (sequels, recommendation batch, dismissed suggestions, keep marks) to be named in the English section of `PRIVACY.md`; it fails today.
- **Confidence:** high on the gaps; medium on how a store reviewer would react.

### TERMS-03 · MyAnimeList titles are stored and shown in AniList recommendation cards
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/background/recommendations/batch.ts:39-40` (seed node reads `id genres tags` only), `:142-154` (MAL `e.title`), `:213-216`, `:247`; `src/shared/recommendations.ts:76`, `:154` (`reason.seedTitle`); `src/ui/components/reco-card.tsx:165`, `:249`.
- **What happens:** for seeds taken from the MAL list, `reason.seedTitle` is MAL's own title, stored 24 h in `reco:batch` and shown as « Parce que tu as noté <MAL title> ★ 9/10 » on an AniList card, with no attribution. This contradicts the recommendations spec §8 (no MAL catalogue content), the memory rule « MAL data never merged into AniList data » (`docs/memory/auth-and-api-terms.md:22`), and the sequel feature, which deliberately shows AniList titles for MAL sources.
- **Fix:** add `title { userPreferred }` to the seed node of `SEEDS_QUERY` and use it in `readSeeds`; fall back to the AniList list title, else `#id`. Same query change as RECO-06.
- **Test first:** MAL-only seeds → `reason.seedTitle` is the AniList title (the auditor's repro, inverted).
- **Confidence:** high on the behaviour; medium on its weight under the MAL agreement.

### TERMS-04 · Remaining time reads MAL's `average_episode_duration`, against « new features read AniList only »
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes · **Needs an owner decision (exception or code change)**
- **Where:** `src/background/anilist/watching.ts:163-164` (field added to `MAL_WATCHING_PATH`), `:225`, `:237-238`, `:168-181` (`CATALOG_BY_MAL_QUERY`, without `duration`); `src/shared/remaining-time.ts:19-24`; rule: `docs/memory/auth-and-api-terms.md:22`.
- **What happens:** every MAL watching-list read now asks MAL for a catalogue field to feed a new display feature (remaining time, the « Temps restant » sort). The rule, recorded six hours after this code (`55d2c93`, then `b8f351d`) and never applied back, says new features read AniList only and any new MAL-backed feature needs the owner's decision. The same entries already go through the AniList catalogue lookup, which can return `duration` at no extra request.
- **Fix:** add `duration` to `CATALOG_BY_MAL_QUERY`, take `episodeMinutes` from it, drop `average_episode_duration` from `MAL_WATCHING_PATH`; or record an explicit owner exception in `auth-and-api-terms.md`.
- **Test first:** invert the existing « MAL_WATCHING_PATH requests average_episode_duration » test; « a MAL entry's minutes come from the AniList catalogue node ».
- **Confidence:** medium (the owner approved the spec containing this field before writing the rule).

## 4. Popup, « Mes séries » and dormant series

### PERF-02 · « Tout mettre en pause » trips AniList's 429 from the 16th series and blocks every AniList call for about a minute
- **Severity:** medium · **Verdict:** CONFIRMED (V1) · **Since 2.5.0:** yes
- **Where:** `src/popup/controllers/dormant.ts:234-252` (`writeAll`: one `SET_LIST_STATUS` per series, back to back), `:257`, `:320`, `:348-368`; `src/background/entry-commands.ts:53-62`; `src/background/trackers/index.ts:120-123`; `src/background/anilist/list.ts:118`, `:168-170` (interactive lane); `src/background/rate-limit.ts:175-186` (`acquire('interactive')` only counts); `src/background/anilist/client.ts:52-55`, `:114-115`.
- **What happens:** each series costs a fresh read and a write per connected service, on AniList's interactive lane, with no spacing. At 30/min the 16th series' read gets a 429 (at 90/min, the 46th). The client sets a 60 s penalty and the bulk stops with a partial result and « Réessayer ». For about 60 s every interactive AniList request then fails at once: the popup and the panel show the rate-limit error, and an episode finished in that minute is queued and retried (nothing lost). « Réessayer » and « Annuler » run the same loop; pausing 8 or more series and pressing « Annuler » within the minute trips it too. MAL gets the same unpaced requests, while jobs space MAL writes by 1 s.
- **Fix (V1):** pace bulk runs only: in `writeAll`, when `items.length > 1`, wait about 6 s between series (at most 20 AniList requests a minute, the background quota at 30/min; it covers MAL too). Make the delay injectable so unit and e2e tests do not wait. Do not choose the lane from `onlyFrom`: a single « Pause » sends it too. Alternative: a worker-side bulk flag on the background lane with reserved slots (`saveStatus` would need a lane parameter). Pacing lengthens the run (20 series ≈ 2 min), which widens POP-02's window and POP-05's exposure: fix POP-02 in the same branch and show the progress (« n / N », a new string).
- **Test first:** `pauseAllDormant` over 20 or more entries with a fake clock never starts more than 20 AniList requests (10 `SET_LIST_STATUS`) in any 60 s window; today 30 requests in about 15 s, then a 429.
- **Confidence:** high (reproduced against a fake AniList enforcing 30/min).

### POP-01 · The popup is clipped and its status bar unreachable when zoomed
- **Severity:** medium · **Verdict:** PLAUSIBLE (V4) · **Since 2.5.0:** partly (the 600 px height is new; the fixed height with `overflow: hidden` was there at 580 px)
- **Where:** `src/popup/popup.css:5-10` (`html, body { width: 496px; height: 600px; overflow: hidden }`), `src/popup/popup.html:11` (`#app` is `h-full overflow-hidden`), `src/popup/popup-app.tsx:126`, `:140` (status bar after the scrolling `main`).
- **What happens:** Chrome caps action popups at 800 × 600 DIP. At 100 % the 2.5.0 popup sits exactly at the cap (2.4.2: 400 × 580, 20 px to spare). With page zoom applied to the popup (default zoom 110 % or 125 %, or Ctrl + « + » inside it), 55 to 120 CSS px are cut at the bottom and nothing at the root can scroll: the 48 px status bar goes first (account logos, account menu, « Session expirée · Reconnecter », sync and import state), then the end of every scrolled list. Condition: that Chrome zooms the popup and keeps the 600 DIP cap; not observed. The « short screens » part is not established. The 496 × 600 size is the owner's choice; the clipping comes from the CSS.
- **Fix:** `overflow-y: auto; overflow-x: hidden` on `html`, keep the fixed 600 px, never `vh` units (auto-sized popups collapse with them).
- **Test first:** an e2e that opens `popup.html` in a 496 × 545 viewport and asserts that the status bar can be scrolled fully into view (fails today).
- **Confidence:** medium; the owner's manual check decides (`0-synthese.md` › 4).

### POP-04 · A series waiting for its first episode is flagged dormant, and « Tout mettre en pause » pauses it
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/shared/remaining-time.ts:12-16` (`episodesToCatchUp` returns null when nothing has aired), `src/shared/dormant.ts:37-38` (null read as « unknown », hence eligible).
- **What happens:** the user added an upcoming anime to « En cours »; AniList gives episode 1 in 3 days, progress 0. After 30 days without activity it shows in the dormant group (« Rien vu depuis plus de 30 jours ») and is included in « Tout mettre en pause »; once paused it leaves « Mes séries », the Agenda and the episode-1 airing alert. Spec §5.3: « a series up to date on an airing schedule is never dormant »; the owner's « unknown = eligible » decision lists hiatus, airing without a date, unknown total and MAL without AniList data, not a dated premiere.
- **Fix:** in `isDormant`, return false when the next episode is dated in the future and nothing has aired yet (or a dormant-side count that gives 0 instead of null when `released === 0`).
- **Test first:** `isDormant` for episode 1 in 3 days, progress 0, 40 days inactive → false (true today; the same series one episode later is already false).
- **Confidence:** high (auditor's throwaway test; the synthesis re-read the rule against spec §5.3).

### POP-02 · A single pause ending during « Tout mettre en pause » re-enables the rows; « Garder » on a queued row is then overwritten
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/popup/controllers/dormant.ts:274-285` (`run` clears `bulk` unconditionally), `:348-367` (`undoDormant`), `:257` (retry closure); `src/popup/components/dormant-section.tsx:60`; `src/ui/components/dormant-group.tsx:88-91`.
- **What happens:** « Pause » on A is in flight when the user starts the bulk. A's run ends with `patch({ bulk: false })` although it never set it, so every row is enabled while the bulk runs. « Garder » on B, still queued, stores the mark; then the bulk sends B `PAUSED onlyFrom CURRENT` and B is paused against the user's last choice. Same root cause: « Réessayer » leaves « Annuler » clickable while it runs, so undo and retry can write the same series at the same time; an undo that finishes after a newer single pause replaces its banner and drops its « Annuler ».
- **Fix:** clear `bulk` only in the run that set it (or use a counter); mark every queued entry busy when a run starts and release each one after its write; hide the banner's buttons, or set them busy, while a retry or an undo runs.
- **Test first:** the auditor's repro: a single pause resolved mid-bulk → `bulk` still true, and no `PAUSED` for a row kept meanwhile.
- **Confidence:** high on the mechanism; it needs quick clicks today, much less once PERF-02's pacing makes a run last minutes.

### POP-03 · The dormant group and its write buttons use the cached list while it is revalidated, or after the revalidation failed
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/popup/controllers/dormant.ts:176-184`; `src/popup/controllers/watching.ts:127-129`, `:162`; `src/popup/components/watching-screen.tsx:549`, `:576`; `src/background/sync/rules.ts:110` (the worker only checks `status === onlyFrom`).
- **What happens:** the user resumed series X on another device; the next popup open shows the cached list, where X is still dormant. A « Pause » or the bulk before `GET_WATCHING` returns, or after it failed (the cached list stays with an alert), pauses X: the fresh read sees CURRENT, which is all it checks. X then leaves the list, the Agenda and the alerts (« Annuler » for 10 s).
- **Fix:** keep the dormant actions disabled while `state.refreshing` or `state.error`; better, send the activity time the user saw and let the worker skip when the fresh entry is newer.
- **Test first:** a dormant controller or `DormantSection` test with a cached list and `GET_WATCHING` pending: « Pause » sends nothing (today it sends `SET_LIST_STATUS`).
- **Confidence:** medium.

### POP-06 · Pause, drop and undo leave the worker's watching cache stale for up to 90 s
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** partly (the « ⋯ » menu statuses had the same gap; the dormant actions and « Annuler » are new users of it)
- **Where:** `src/background/controls.ts:187-212` (`setListStatus` never touches the cache; compare `src/background/engagement.ts:211`); `src/popup/controllers/watching.ts:32`, `:188-195`; `src/background/anilist/watching.ts:257-262`.
- **What happens:** the user pauses X and closes the popup within a second, before the 1 s revalidation. Reopening within 90 s shows X dormant again, and pausing it again answers « Rien n'a été modifié ». After « Annuler », the restored series is missing from « Mes séries » for up to 90 s.
- **Fix:** in `setListStatus`, for each service whose outcome is `updated`, drop the entry from that service's cached list for PAUSED, DROPPED and COMPLETED, and invalidate the cached list for CURRENT, under the epoch, as `afterRemoval` does.
- **Test first:** `setListStatus({ status: 'PAUSED', onlyFrom: 'CURRENT' })`, then `getCachedWatching('anilist')` no longer contains the entry.
- **Confidence:** high.

### POP-08 · « Garder » marks of a MAL list change key when the AniList catalogue enrichment fails
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/shared/dormant.ts:21-23`, `:53` (`dormantKey`); `src/popup/controllers/dormant.ts:325`, `:332`; `src/background/anilist/watching.ts:189-204`, `:219`.
- **What happens:** on the MAL list, a mark is keyed by the AniList id when the catalogue enrichment worked and by `mal:<id>` when it failed (outage, degraded mode). On a load where AniList fails, every kept series falls back into the dormant group; a mark set during such a load stops matching once AniList answers again.
- **Fix:** key the marks by the shown service's own id: `malId` for the MAL list, `mediaId` for AniList.
- **Test first:** a mark kept for an entry with `mediaId` set; the same entry with `mediaId: null` is still kept.
- **Confidence:** high.

### POP-07 · « Moyenne des amis » is computed on a biased subset when more than 50 followed users have the series
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/background/anilist/friends.ts:17-29` (one page of 50, `sort: [STATUS, SCORE_DESC]`), `src/shared/friends.ts:82-86`, `src/ui/components/friends-summary.tsx:69-75`, `src/ui/components/friends-section.tsx:127-131`.
- **What happens:** with 120 followed users on the series, the summary shows « 120 amis · ★ 8,6 », but the average covers the first status groups and the best scores of the group that was cut. The spec's goal is « every new number is honest »; only a code comment acknowledges it.
- **Fix:** `averageScore: null`, or a « 50 sur 120 » qualifier, when `total > friends.length`.
- **Test first:** `reduceFriends` with `pageInfo.total: 57` and 50 entries → `averageScore` is null.
- **Confidence:** high on the code; the size of the bias depends on AniList's status order.

## 5. Recommendations

### RECO-02 · During the dice turn, « + À regarder » and « Pas intéressé » act on the next suggestion, not the one on screen
- **Severity:** medium · **Verdict:** CONFIRMED (V4) · **Since 2.5.0:** yes
- **Where:** `src/ui/components/reco-card.tsx:109-124` (old card held 360 ms), `:197-211` (buttons rendered from it, no `held` check); `src/ui/reco-controller.ts:116-122` (`another()` draws at once), `:123-159`; callers `src/popup/components/empty-reco.tsx:36-37`, `src/sidepanel/components/discover.tsx:76`.
- **What happens:** the user clicks « 🎲 Autre » (motion not reduced); the card keeps showing the previous suggestion for 360 ms while the controller has already drawn the next one. « + À regarder » or « Pas intéressé » in that window acts on the new draw: a series the user never saw is added to « À regarder » on AniList and / or MAL (with a public AniList activity), or written to the dismissed list. Two quick clicks are enough, or Shift+Tab then Enter, since focus stays on « Autre ». No bug with reduced motion. The existing test never checks which card is acted on.
- **Fix:** smallest: in `RecoCard`, ignore `onAdd` and `onDismiss` while `held` is set, with the same guard as « Autre » (or render them `aria-disabled` during the turn). More robust: pass the shown card's id and act only when it equals `current.card.id`.
- **Test first:** the real controller with `RecoCard` in happy-dom: « Autre » then « + À regarder » within 360 ms → no `ADD_TO_LIST` for an id never shown.
- **Confidence:** high (reproduced).

### RECO-01 (also PERF-05) · MAL-only builds map every watched MAL entry to AniList: 22 AniList requests per batch for 1000 entries
- **Severity:** medium · **Verdict:** CONFIRMED (V5) · **Since 2.5.0:** yes
- **Where:** `src/background/recommendations/batch.ts:146-147`, `:34` (relation nodes carry `id` only); `src/background/anilist/by-mal.ts:13`, `:19-26`; `src/shared/recommendations.ts:6`, `:58`, `:62-85`, `:133`.
- **What happens:** a MAL-only user (or a user whose AniList list is nearly empty) opens Découvrir or the popup's empty state: 20 `idMal_in` requests for 1000 watched entries, then 2 seed reads, all on the background lane. In degraded mode (20 a minute) the 21st waits about 60 s, so « Analyse de tes goûts… » stays about 70 s and holds back other background work; whether the worker survives that wait inside a pending message is unverified (TRK-01). The full volume comes back every 24 h, after any session change, on « Réessayer », after a restore, and from zero after any failure. Only the 50 seeds at most need AniList ids; the rest only feeds the unseen-prequel rule. The spec's request-count test does not exist (`batch.test.ts:19` mocks `by-mal`, `:291` freezes the full mapping). No AniList rule is broken as written, but it is about ten times what the feature needs.
- **Fix (V5):** map only seed candidates (COMPLETED / REPEATING, best MAL score first, `MAX_SEEDS` plus a margin for unmapped ids and the unscored fillers): 1 or 2 requests. Add `idMal` to the relation nodes of `CARD_FIELDS` (`relations { edges { relationType node { id idMal } } }`, as `panel-media.ts:48` does) and count a prequel as seen when its id is watched or its `idMal` is a watched MAL id (precedent `prequelMalIds`, `src/shared/similar.ts:15`, `:36`). Measure the seeds query complexity on the real API first (spec §8).
- **Test first:** MAL-only with 1000 watched entries → at most 4 AniList requests (22 today); adapt `batch.test.ts:291`.
- **Confidence:** high (reproduced with the real `by-mal`).

### RECO-05 · « + À regarder » in Découvrir always ends on « Dans À regarder », even when MAL got nothing or nothing was written
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/ui/reco-controller.ts:129-139`; `src/ui/components/reco-card.tsx:190-194`; `src/ui/sequel-actions.ts:27-37`; `src/background/controls.ts:249-251`.
- **What happens:** (a) both accounts and a suggestion without `idMal`: AniList is written, MAL skipped, yet the card never says « pas encore sur MyAnimeList » (the sequel rows and « Dans le même esprit » do). (b) a suggestion put in a list outside SyncKai after the batch was built: nothing is written (`already-in-list`), yet the card says it is in « À regarder » while it may be Completed or Dropped.
- **Fix:** keep `notOnMal` and `inList` from `sequelAddResult` in the view and render `t(sequelEndedKey(result))`, as `similar.tsx` does (existing strings).
- **Test first:** controller test: `ADD_TO_LIST` answers `[anilist updated, mal skipped]` → the « pas encore sur MyAnimeList » label; `[anilist skipped already-in-list]` → the in-list label.
- **Confidence:** high.

### RECO-03 · MAL-only: a series SyncKai writes to MAL while a batch is being built ends up in that batch
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/background/recommendations/messages.ts:63-64` (`noteTouched` for AniList only); `src/background/recommendations/touched.ts:15-17`; `src/background/recommendations/batch.ts:243-256`.
- **What happens:** during a build (long for these users, RECO-01), an episode sync or a « + À regarder » elsewhere creates a MAL entry for a candidate. `dropSuggestion('mal', idMal)` marks only AniList ids as touched, so the series is served for 24 h in the popup and Découvrir although it is in the user's list: the spec's first anti-goal.
- **Fix:** record touched MAL ids too (`noteTouched(service, id)`) and filter `i.card.idMal` against them before and after `writeIfSessions`.
- **Test first:** the auditor's repro: a gated build, `dropSuggestion('mal', 500)` during it → the served batch does not contain it.
- **Confidence:** high.

### RECO-06 · Adult seeds can be named in the « Parce que tu as noté… » line
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/background/recommendations/batch.ts:36-45`, `:198-216`; `src/shared/recommendations.ts:128-154`; `src/background/mal/full-list.ts:8-12` (`nsfw=true`); `src/ui/components/reco-card.tsx:165`, `:249`.
- **What happens:** the `isAdult` filter applies to candidates only. A hentai rated 7 or more in the user's list becomes a seed, its non-adult recommendations pass, and the card says « Parce que tu as noté <adult title> ★ 9/10 », also in the popup's empty state and its live announcement. Spec §8: the feature shows no adult content. Depends on AniList returning adult media for `id_in` / `idMal_in` without an `isAdult` argument (not verified).
- **Fix:** request `isAdult` on the seed node and drop adult seeds in `readSeeds`, or at least never show them as the reason. Same query change as TERMS-03.
- **Test first:** `readSeeds` with a seed node `isAdult: true` → no item carries that `seedId`.
- **Confidence:** medium.

### RECO-07 · « Dans le même esprit » re-reads list states on every refresh of the same series
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/sidepanel/components/similar-loader.ts:79-89` (keyed on the `content.view` object); `src/ui/page-media-controller.ts:345-360`; `src/background/franchise/states.ts:31-36`.
- **What happens:** every resolve of the same series gives a new view object (next episode, the « synced » event, +1 / −1, status actions, « Actualiser »), and each sends `GET_LIST_STATES` for unchanged recommendations: one authenticated AniList request, plus a full MAL list read when the memo has expired; about 2 extra AniList requests per episode during a binge. Overlaps PERF-03.
- **Fix:** key the loader on `view.media.mediaId`; re-filter on `force` (account change) and after a list action.
- **Test first:** 5 refreshes of media 1 → one `GET_LIST_STATES`; another media → a second one.
- **Confidence:** high (auditor's repro).

### RECO-08 · A dismissed suggestion shows up in « Déjà tirées » when « Autre » is clicked during the undo window
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/ui/reco-controller.ts:116-122` (against the comment at `:151`); `src/ui/components/reco-card.tsx:203-206`.
- **What happens:** after « Pas intéressé » on A, « Autre » pushes A into `previous`, so the panel's « Déjà tirées » strip lists A with its link. Cosmetic: the dismissal itself is saved.
- **Fix:** `if (view.dismissedTitle === null) previous = [view.current, ...previous]…`.
- **Test first:** dismiss, then `another()` → `previous` excludes the dismissed id.
- **Confidence:** high.

### UI-06 · « Pour toi » card: raw AniList format, unlocalized average score, low-contrast « Activer » chips
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/ui/components/reco-card.tsx:132`, `:157` (raw `card.format`), `:158` (`toFixed(1)`), `:67` (`opacity-55`); compare `src/ui/review-view.ts:9-13`, `src/ui/components/sequel-row.tsx:28-31`.
- **What happens:** in French a TV short shows « TV_SHORT · 2018 · 24 ép. » and « ★ 8.4 », next to « ★ 8,5/10 » in the reason line of the same card. An optional platform without access shows an active « Activer {plateforme} » chip at about 3.0:1 contrast, under the 4.5:1 of WCAG 1.4.3.
- **Fix:** export `formatLabel` from `review-view.ts` and use it; format the average with `formatStarValue`; mark access-needed chips with token colours (a dashed `field` border or a lock icon) instead of the opacity.
- **Test first:** fr, `format: 'TV_SHORT'`, `averageScore: 84` → `t('review.format.tvShort')` and « 8,4 ».
- **Confidence:** high (auditor's repro).

### RECO-04 · Label in name: the accessible names of « Pas intéressé » (21 languages) and « Autre » (12) do not contain the visible label
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/ui/components/reco-card.tsx:203`, `:208`; `reco.anotherAria` and `reco.dismissAria` in `src/i18n/locales/*.json`.
- **What happens:** a speech-input user (Voice Control, Dragon) who says « clique sur Pas intéressé » gets no match, because the name is « Ne plus suggérer {title} » (WCAG 2.5.3). The visible label is in the name in 0 of 21 locales for dismiss and 9 of 21 for « Autre ». The same release's `sequel.addLabel` complies everywhere.
- **Fix:** names that start with the visible label (« Pas intéressé : {title} »); for « Autre », drop the `ariaLabel` (the live region already announces the new draw) or reword it. 21 catalogs.
- **Test first:** a catalog test: `reco.dismissAria` contains `reco.dismiss` (same for « Autre ») in every locale.
- **Confidence:** high (static check).

## 6. Shared UI, accessibility and i18n

### UI-01 (also ORD-02) · The focus fallback misses removals rendered by a child: focus falls to `<body>`, then jumps away later
- **Severity:** medium · **Verdict:** CONFIRMED (V4) · **Since 2.5.0:** partly (the hook predates 2.5.0; the watch-order, dormant-group and « Réafficher » cases are new)
- **Where:** `src/ui/preact/hooks.ts:106-165` (`useFocusFallback` acts only in its host's `useLayoutEffect`); hosts `src/popup/popup-app.tsx:103-105`, `src/sidepanel/panel-app.tsx:89-91`, `src/ui/review-card.tsx:317-319`; children that re-render on their own: `src/sidepanel/components/watch-order.tsx:285`, `:299`, `:392` (ORD-02), `src/ui/components/dormant-group.tsx:116-119`, `src/ui/review-card.tsx:150-162`, `src/popup/components/watching-screen.tsx:481-492`, `src/sidepanel/components/now-playing.tsx:222`, the Settings page roots.
- **What happens:** a keyboard or screen-reader user triggers an action that removes the focused control: « Confirmer » on an « À vérifier » card (the charter promises focus on « Fermer », `docs/design/README.md:194`, `:308`), dormant « Abandonner » then « Oui », « Ajouter à En cours », « Se déconnecter », « Réafficher N suggestions ignorées », and in the watch order « Afficher N de plus », « N vus » and « Réessayer ». Only the child re-renders, so focus stays on `<body>` and the screen reader loses its place. At the host's next render the focus jumps with no user action: in the popup within 60 s (clock tick) to the rail or the gear, in the panel to the « En lecture » tab.
- **Fix (V4):** make the hook independent of its host's render: a `MutationObserver` on the container, or a microtask re-check when the tracked node is disconnected. That alone fixes the review card, whose « Fermer » is already the declared fallback. Not enough for the others: `pickFocusKey` tries the hook's fallback before any neighbour (`src/ui/dom.ts:67-76`), so also add local targets: the first revealed row for « Afficher N de plus » and « N vus », `data-focus-fallback="panel-section-order"` for « Réessayer », a declared fallback on the dormant row and group, and the stepper for the add buttons.
- **Test first:** a child with its own state removes the focused button → focus on the host's fallback, never `body`; `ReviewList` with the store re-read before the reply → « Fermer »; `Timeline`, « Afficher N de plus » → `order-entry-<first revealed>`.
- **Confidence:** high (reproduced in happy-dom; the review-card case depends on timing, and the failing order is the likely one).

### UI-03 · `useId` restarts at `P0-0` in every Preact root, so ARIA references point at another tree's element
- **Severity:** medium · **Verdict:** CONFIRMED (V4) · **Since 2.5.0:** no (2.5.0 adds users)
- **Where:** Preact 11.1.0, `node_modules/preact/hooks/src/index.js:429-444`, `:51-56`; roots `src/popup/popup-app.tsx:148`, `src/ui/status-bar-host.tsx:216`, `src/ui/settings/settings-view.tsx:173`, `:344`, `src/ui/settings/preact-page.tsx:18`; references `src/ui/account-menu.tsx:123`, `:205`, `:209`, `src/ui/settings/page-notifications.tsx:164`, `src/ui/settings/page-platforms.tsx:139`, `src/ui/settings/page-display.tsx:37`, the `Section` component.
- **What happens:** the popup shell keeps Activité mounted but hidden, and its « Dernières synchros » heading takes `P0-0`, first in document order. The first id of every other root resolves to it: in Settings › Notifications the « Délai » radio group is named « Dernières synchros »; the preferred-player help and the display tab label point to it; the account menu's description (« AniList · connecté, 120 anime… ») is announced as that hidden heading. The `NotifArt` gradient ids can collide too, and the fill is lost. No data at stake.
- **Fix:** a per-root id prefix through a small provider at each render site (shell, status bar, Settings bar and body, Settings page), a `usePageId()` hook, and an ESLint ban on the bare `useId`; the single-root import pages can stay.
- **Test first:** two roots, each rendering a `Section` → distinct ids, each section named by its own title.
- **Confidence:** high for the collision; medium for which element wins on each screen.

### UI-04 · A rating changed with the arrow keys shows as the score but is never sent without Enter
- **Severity:** medium · **Verdict:** CONFIRMED (V4) · **Since 2.5.0:** no
- **Where:** `src/ui/components/star-rating.tsx:82-93` (arrows call `onChange`, Enter confirms), `:107`, `:127`; `src/ui/components/rating-block.tsx:26-31`, `:41-43` (`chosen` reset only when `value` or `disabled` changes); the same pattern in `src/popup/components/activity-screen.tsx:166`, `:189-200`.
- **What happens:** in « Sur cette page » or the panel's rating section, a keyboard user moves from 8 to 7 with ←, sees and hears « 7/10 », then tabs on: nothing is sent, yet the card keeps showing 7/10 until the page closes, and AniList or MAL keep 8. Enter-to-confirm is deliberate (`docs/design/README.md:345`), but the charter keeps a chosen value only « while it is sent » (`:183`), and nothing tells the user that this `role="slider"` needs Enter.
- **Fix:** on a `focusout` that leaves the slider with an unconfirmed value, reset it to the saved score. An `aria-describedby` hint « Entrée pour enregistrer » is the owner's call (a new string); confirming on blur would change the documented rule.
- **Test first:** saved 8, ← twice, focus moved away → « 8/10 » shown and `onRate` not called.
- **Confidence:** high (reproduced).

### UI-02 · Sub-menu entry: a click after the hover delay closes the sub-menu it just opened
- **Severity:** low (auditor: medium) · **Verdict:** CONFIRMED (V4) · **Since 2.5.0:** no
- **Where:** `src/ui/components/menu.tsx:203-205` (hover opens after 150 ms), `:426`, `:437` (the click toggles on `open` only); used by « Ouvrir la fiche › » and « Chercher sur… › » (`src/ui/series-menu.tsx:134`, `:143`) and the Agenda « ⋯ » menu (`src/sidepanel/components/agenda.tsx:237`, `:246`).
- **What happens:** a mouse user points at « Ouvrir la fiche › » and clicks: the hover timer has already opened the sub-menu, so the click closes it, and hovering does not reopen it until the pointer leaves and returns. Pointer only; a second click reopens it.
- **Fix:** a click always opens (`api.showSub(id, false)`); ←, Esc and pointer leave close. This changes the toggle assertion at `menu.test.tsx:196-199`.
- **Test first:** hover, advance 250 ms, click → sub-menu open.
- **Confidence:** high (reproduced).

### UI-05 · The status bar's live region re-announces the relative time every minute and every import step
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** no (the sequel status line in Settings › Notifications is a new instance)
- **Where:** `src/ui/components/status-bar.tsx:155-158`; `src/ui/status-bar-host.tsx:23`, `:99`, `:103`, `:155-160`, `:169-173`; `src/ui/settings/page-notifications.tsx:247`, `:275`.
- **What happens:** in the side panel, a screen-reader user hears « Tout est synchronisé · il y a 7 min » every minute for an hour after each sync, and an import or alignment counter about once a second. The panel's live card already announces state changes only.
- **Fix:** keep the visible message out of the live region; add an sr-only region whose text depends only on the state kind and the series; in Settings › Notifications, announce only when a check starts or ends.
- **Test first:** `status-bar-host.test.tsx`: `ok` state, clock + 60 s → the `role="status"` text is unchanged; import 42 → 43 / 120 → unchanged.
- **Confidence:** high on the code; the verbosity depends on the screen reader.

## 7. Sync, matching and tracker writes

### SYNC-01 · Fractional or missing episode numbers delete or corrupt the season mapping, and their « À vérifier » card cannot be validated
- **Severity:** medium · **Verdict:** CONFIRMED (V3) · **Since 2.5.0:** no
- **Where:** `src/background/sync/resolver.ts:291`, `:372-375`; `src/background/sync/matching/mapping.ts:20-25`, `:42-45`; `src/background/sync/sync-service.ts:526-537`; `src/browser/storage/mappings.ts:64-69`; `src/shared/sync.types.ts:50`.
- **What happens:** real inputs: Crunchyroll keeps decimal numbers (`content/crunchyroll/adapter.ts:41`; Slime S2 E48.5, S3 E65.5, `docs/memory/matching.md:11`), and the ADN player fallback sends no number for films and OAVs (`content/adn/adapter.ts:104-119`).
  1. Watching E12.5 of a season with a learned or unmarked mapping deletes that mapping: the position is not null, so it is not « unknown », the opposite of the M6 rule. The next episode is resolved from scratch.
  2. A card with no number can never be validated: picking the entry and typing 1 answers « Épisode 1 invalide pour « X » (1 épisodes). »; the card can only be dismissed.
  3. Validating a fractional card writes a non-integer offset over the season key, which `isMediaMapping` then rejects: the previous mapping, a `chosen` one included, reads as absent, and the next episode can be auto-resolved to the entry the user had corrected away from.
- **Fix (V3):** (a) `unknownPosition = cached !== null && !Number.isInteger(seasonPosition(…))`, which covers null too; (b) `mappingFromManualChoice` returns null when the number it would use is not an integer; (c) `resolveReview` checks `isValidProgress(progress, catalog.episodes)` first and reports only that as the error, calls `saveChosen` only when a mapping was derived, and writes the chosen progress either way.
- **Test first:** resolver: learned mapping + E12.5 → not forgotten; sync-service: a card with no number validated with 1 → `synced`; a fractional card validated over a `chosen` mapping → the previous mapping is still readable.
- **Confidence:** high on the code path (reproduced); how often the sites send such numbers is not verified.

### SYNC-03 · A confirmed « À vérifier » card is guarded again when the queue retries its failed write
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** no
- **Where:** `src/background/sync/review-decision.ts:43`; `src/background/sync/sync-service.ts:297` (`guardFinale` when `confirmed` is undefined), `:543`; `src/background/sync/queue.ts:115`.
- **What happens:** a 24-episode season, AniList at 23, the MAL entry absent: the live sync of E24 writes AniList, skips MAL (finale jump from 0) and creates a card. The user confirms it and MAL answers 504 (frequent). The queue retry calls `syncEpisode` without `confirmed`, so the guard applies again: MAL is skipped, a new card replaces the validated one, and the queue item is dropped as `needs-review`. The user must validate twice, against `docs/memory/security.md:7` (« a confirmed card … is never guarded »).
- **Fix:** mark the queue item created by `confirmReview` as confirmed (`unguarded: true` on `SyncQueueItem`) and pass it through `syncEpisode` to `writeToServices`.
- **Test first:** the auditor's repro: the retry must write MAL 24.
- **Confidence:** high (auditor's repro).

### TRK-02 · AniList session-bound writes are still sent after their session closed when they wait out a 429 penalty
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** no
- **Where:** `src/background/anilist/client.ts:48` (token read), `:52-57` (cooldown sleep), `:59` (`acquire`), `:63-75` (fetch with the token read earlier); `src/background/rate-limit.ts:203-208`, `:211-233`.
- **What happens:** an import or a list alignment on account A reads A's token, then waits out a 429 penalty (about 60 s on the background lane, up to 20 s interactive). The user signs out meanwhile; when the wait ends, the write goes out with A's token and changes A's list after the sign-out. No cross-account write, but `security.md`'s « checked right before the write » no longer holds after an unbounded wait.
- **Fix:** read the session token after the cooldown sleep and after `acquire` (call `release()` if it throws).
- **Test first:** a 15 s penalty, the session closed 1 s into the wait → `SessionChangedError` and zero fetches.
- **Confidence:** high on the mechanism (auditor's repro); narrow impact.

## 8. Security hardening: hostile pages and stored data

### CR-01 · Crunchyroll bridge signals accept unknown keys, so a page script can fill the 10 MB local storage
- **Severity:** medium · **Verdict:** CONFIRMED (V3) · **Since 2.5.0:** no
- **Where:** `src/platforms/crunchyroll/metadata.ts:255-261` (returns the page's own object), `src/shared/match-signals.ts:48-61` (`isPlatformSignals` checks known fields only); `src/content/crunchyroll/adapter.ts:65`, `:447`, `:467`; `src/content/crunchyroll/bridge-protocol.ts:36`, `:126` (pushes up to 400,000 characters); sinks `src/browser/storage/reviews.ts:27-43`, `:99-110`, `src/browser/storage/sync-queue-store.ts:32-46`.
- **What happens:** a script in Crunchyroll's top frame (the hostile-page threat model of 2026-10-15 SEC-01 / SEC-05) forges a bridge push whose signals carry an extra key of about 390 KB. `isPlatformSignals`, `isEpisodeInfo` and the read-back guards accept it, so each stored card, recent sync or queue item carries it: about 400 KB in ASCII, about 1.2 MB in UTF-8 with non-ASCII text, so about nine cards exceed Chrome's 10 MB quota (no `unlimitedStorage`). Then every write that grows storage fails: a sync that learns a new mapping errors before any tracker write, and new mappings, queue items, the journal and new cards fail. This contradicts the module header and `docs/memory/platforms.md:6` (« revalidated by `toPlatformSignals` »). The other platforms rebuild their signals with `toPlatformSignals`. No wrong tracker write; dismissing the cards recovers. (The page-media session cache is not a sink: it keeps no signals.)
- **Fix (V3):** make `isEpisodeInfo` and `isPageMediaInfo` refuse signals with unknown keys (`Object.keys(signals).every(known)`); these guards live in the worker, so the Crunchyroll script's budget is untouched, and stored junk cards fail the read-back guard and drop out at the next write. Optionally, return `toPlatformSignals(signals)` from `crunchyrollTableSignals` (size effect not measured; 262 bytes left, ARCH-02).
- **Test first:** `isEpisodeInfo` with `signals: { seriesYear: 2020, junk: 'x' }` → false.
- **Confidence:** high on the mechanism (reproduced); low likelihood (needs hostile page code).

### SEC-02 · `reco:batch` is served from storage without revalidation: foreign links in Découvrir, and a corrupt batch breaks it for up to 24 h
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/shared/recommendations.ts:178` (`isRecoBatch` checks the shape only), `:102` (`toCard` keeps the raw `siteUrl`); `src/background/recommendations/batch.ts:271-274`; `src/ui/components/reco-card.tsx:63`, `:131`, `:230`; `src/ui/reco-controller.ts:67` (« Réessayer » never forces a rebuild).
- **What happens:** content scripts can write `chrome.storage.local` (the threat model adopted for 2026-10-15 SEC-04). A compromised streaming renderer plants a batch with the current epochs whose links point to any https host: they become the title link, « Ouvrir sur AniList », the platform chips and « Déjà tirées » in Découvrir and the popup's empty state, and « + À regarder » adds whatever id the planted card carries. A `null` item makes every request fail, and since « Réessayer » sends no `force`, Découvrir stays broken until the batch expires or a sign-out. The stored-URL rule of `watching.types.ts:76-80` is not applied to this new store.
- **Fix:** a deep `isRecoBatch`: positive integer ids, `siteUrl` through `toSafeUrl(…, 'anilist.co')`, platforms through the watching `isPlatformLink`, images `isSafeImageUrl` or null; a failing batch is refused whole and recomputed; validate `siteUrl` in `toCard` too.
- **Test first:** a stored batch with a foreign `siteUrl` is recomputed (`fetchAniListFullList` called), not served.
- **Confidence:** high (auditor's repro).

### SEC-03 · The stored-URL revalidation of 2026-10-15 SEC-04 is bypassed through `recentSyncs` and the stored AniList profile URL
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** no
- **Where:** `src/background/anilist/watching.ts:63-73` (`buildPlatforms`: any https host), `:263-274` (fresh list returned without `isWatchingList`); `src/shared/review.types.ts:126-139`; `src/shared/episode.types.ts:114`; `src/shared/anilist.types.ts:22-31` → `src/ui/account-menu-model.ts:36-38`, `src/ui/account-menu.tsx:189`, `src/ui/settings/page-accounts.tsx:125`, `src/ui/accounts.ts:177`.
- **What happens:** under the same threat model, a planted recent sync (or a forged `EPISODE_COMPLETED`) whose `episode.url` is on a foreign https host becomes the series' Crunchyroll link whenever AniList and the learned links have none; the fresh list is returned as built, so « Ouvrir » and « Reprendre » lead there at every popup open. Same for `anilistViewer.siteUrl` (account menu, Settings › Comptes, even live from `storage.onChanged`). `javascript:` is blocked by the CSP: the impact is a phishing link.
- **Fix:** in `buildPlatforms`, keep a history link only if its host belongs to `sync.episode.platform` (the `isPlatformUrl` rule, Prime through `primeIdInLink`); `isAniListViewer` requires `toSafeUrl(siteUrl, 'anilist.co')`.
- **Test first:** `buildPlatforms` drops a foreign history link; `isAniListViewer` refuses a foreign `siteUrl`.
- **Confidence:** high (auditor's repro).

### SEC-04 · Content-script engagement messages (rating, rewatch) are not tied to a prompt and not rate-limited
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** no
- **Where:** `src/background/message-guards.ts:54`, `:59-61`; `src/background/background.ts:176`, `:185-187` (sender ignored); `src/background/engagement.ts:89-125`, `:128-138`, `:141-160`; `src/background/episode-completed.ts:46-47` (only `EPISODE_COMPLETED` is rate-limited).
- **What happens:** under the same threat model, a hostile page script can send `RATE_MEDIA` for every media id it can read from `storage.local`, overwriting the user's whole rating history on AniList and MAL at API pace with no cap, or send `START_REWATCH` for every COMPLETED entry. A real content script only sends these after the worker returned a prompt, but the worker never checks that.
- **Fix:** the worker records each prompt it returns in `storage.session` (`{ tabId, mediaRefId, kind, at }`, a TTL of a few minutes, covering « Réessayer »); content-origin engagement messages are accepted only for an outstanding prompt of `sender.tab.id` with the same media, consumed on success.
- **Test first:** a content-origin `RATE_MEDIA` without a prior prompt for the tab is refused and writes nothing; with a recorded prompt it is written.
- **Confidence:** medium (needs a renderer compromise).

## 9. Streaming platforms (content scripts)

### SVOD-01 · Prime Video films are probably never synced: the playing film is never matched to its own page
- **Severity:** medium · **Verdict:** PLAUSIBLE (V3) · **Since 2.5.0:** no
- **Where:** `src/content/prime/adapter.ts:84-107` (`titleForEpisode`: `listing` `:92`, `bySeason` `:93`, `sameShow` `:97-103`), `:129-130`; `src/platforms/prime/metadata.ts:336`, `:370` (`primeTitleHas`, never used here).
- **What happens:** the user plays an anime film on Prime Video. « Sur cette page » shows the film, but if the player's catalog entry has neither a series title nor a season (the expected film shape, never captured), no page is found, `episodeInfoFromPrime` returns null, and nothing is synced; Prime is a quiet platform, so no toast says so. Never worked since the first version; films are listed as untested (`docs/memory/platforms.md:42`) and were never promised to users. The only film test passes the title directly (`adapter.test.ts:123-133`). Condition: the real film catalog shape; if it carries a series title equal to the page title, the film is found.
- **Fix (V3):** one line: `listing = newest.find((title) => aliases.some((id) => primeTitleHas(title, id)))`, safe for episodes (a season page's own GTIs never equal an episode id). If the film's `entityId` proves different from its page GTI, add a fallback with a title check (`entry.type === 'movie' && pageTitle?.titleType === 'movie' && titleKey(entry.title) === titleKey(pageTitle.seriesTitle)`), never the type alone.
- **Test first:** `adapter.test.ts`: a `MOVIE` catalog without series title plus the film page → the page is returned, and `episodeInfoFromPrime` gives episode 1 with `format: 'movie'`.
- **Confidence:** medium; the owner's check on a real Prime anime film decides.

### CR-02 · Crunchyroll music video and concert pages are treated as episodes: false « Épisode non identifié » error
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** no
- **Where:** `src/content/crunchyroll/adapter.ts:31` (`WATCH_PATH_REGEX`), `:458-460`, `:488-492`; `src/content/start.ts:61-68`; `src/content/lib/watch-session.ts:199-216`, `:382`.
- **What happens:** `/watch/musicvideo/{MV…}/…` and `/watch/concert/{MC…}/…` give the episode id « musicvideo » or « concert ». A session starts, a skip-events request is wasted, and at 85 % of a video of 3 minutes or more the user gets the « Épisode non identifié » error toast and a journal error; every music video shares the same id, so it repeats on each one. No tracker write.
- **Fix:** `/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?watch\/(?!(?:musicvideo|concert)\/)([A-Z0-9]+)(?:\/|$)/i`; mind the Crunchyroll budget (262 bytes left, ARCH-02).
- **Test first:** `getEpisodeId` returns null for `/de/watch/musicvideo/MV5B02C79/x` and `/watch/concert/MC2E2AC135/x`.
- **Confidence:** medium (URL shape from yt-dlp's Crunchyroll extractors; the page itself was not checked).

### SVOD-02 · Prime: an episode played again on another page of the same tab is never tracked
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** no
- **Where:** `src/content/prime/bridge-client.ts:86-89` (first-reception path kept); `src/content/prime/adapter.ts:60-62`, `:246-248`, `:287-289`; frozen by `src/content/prime/bridge-client.test.ts:134-145`.
- **What happens:** autoplay into the next season keeps the previous season's URL (documented). The user stops in S2E1, later opens `/detail/{S2}` in the same tab and resumes it: the client keeps the first path for that entry, so no session starts, S2E1 is never synced, and Alt+Shift+K answers that nothing is playing. Same with an alias path (first played from the URL « Ouvrir » builds from AniList's links).
- **Fix:** keep the old path only for a replay: `path: known && known.seenAt >= entry.seenAt ? known.path : path`.
- **Test first:** an entry re-received with a newer `seenAt` on another path takes the new path; the existing same-`seenAt` test stays green.
- **Confidence:** medium (auditor's repro).

### SVOD-03 · Prime: a script injected into an already-open tab gives the first page's data to the current page
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** no
- **Where:** `src/content/prime/adapter.ts:216-228` (path from `location.pathname` at the first read, `:225`), `:231-238` (`:237`), `:319-322`; injection by `src/background/platform-access.ts:61-73` and `src/background/platform-scripts.ts:106-132`.
- **What happens:** the user loaded detail page A, moved in the SPA to page B, then turned Prime Video on (Settings, the panel's « Activer », or the 2.5.0 suggestion chip). The injected script records A's hydration data under B's path: « Sur cette page » shows A while the user is on B, its actions target A's entry, and B's episodes are not tracked in that tab. The same happens in every open tab after any future bridge version bump.
- **Fix:** take the hydration's path from the document's initial navigation (`performance.getEntriesByType('navigation')[0]?.name`) instead of `location.pathname` at script start.
- **Test first:** a content script started on page B with a hydration node for A → `detectSeries(B)` is not A; `detectSeries(A)` still is.
- **Confidence:** medium (auditor's repro).

## 10. Side panel: watch order

### ORD-01 · « Regarder » in the timeline lost the learned (ADN) and history links of the related rows it replaced
- **Severity:** low (auditor: medium) · **Verdict:** CONFIRMED (V5) · **Since 2.5.0:** yes
- **Where:** `src/background/franchise/load.ts:71` (`buildPlatforms(links.get(node.id), [])`), `src/background/background.ts:199`, `src/sidepanel/components/watch-order.tsx:167`; the 2.4.2 path, still computed but no longer rendered: `src/background/anilist/panel-media.ts:226-261`; `src/platforms/links.ts:193-199`.
- **What happens:** the related rows of 2.4.2 completed AniList's links with the series links learned while browsing or syncing and with the last synced episode; the 2.5.0 timeline uses AniList `externalLinks` only. AniList almost never lists ADN, so an entry the user watched on ADN loses its ADN « Regarder »: the button falls back to another platform or disappears. Narrower than reported: 2.4.2 only added platforms AniList does not list, and a learned link exists only for entries already synced or visited, rarely the « Ensuite » one. No effect on data.
- **Fix (V5):** in the `GET_FRANCHISE` handler after `loadFranchise`, on a copy of the nodes (never the graph itself: `inFlight` shares it and it is cached), merge `buildPlatforms([], syncs of the node, learnedLinksFor(learned, id))` after the AniList links, exactly like `withHistoryLinks`. The cache stays catalogue-only.
- **Test first:** a learned ADN link for a graph entry is returned by `choosePlatformLink(node, 'adn')` from a fresh walk and from the cache, and the `storage.session` record contains no ADN URL.
- **Confidence:** high (reproduced).

### ORD-08 · `shortTitle` cuts numbered titles down to a bare numeral: « Overlord II » → « II », « Ensuite : I »
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/shared/franchise.ts:245-253` (`/^\p{L}/u.test(short) ? short : title`); used at `src/sidepanel/components/watch-order.tsx:170`, `:339`.
- **What happens:** the rule keeps the whole title when the remainder does not start with a letter (« 2 », « 5 (ONA) »), but Roman numerals and single letters are letters: « Overlord II » shows « II », « Mob Psycho 100 III » « III », « Toaru Kagaku no Railgun S » « S ». On the Gundam capture the rows read « Kidou Senshi Gundam | I | II: Ai Senshi-hen » and the folded header says « Ensuite : I ». The full title stays in the tooltip and the link's `aria-label`.
- **Fix:** also keep the whole title when the remainder is a Roman numeral or a single letter, alone or followed by « : » or a space.
- **Test first:** `shortTitle('Overlord', 'Overlord II')` → « Overlord II »; `shortTitle('Kidou Senshi Gundam', 'Kidou Senshi Gundam I')` → the full title; « Shingeki no Kyojin Season 2 » still → « Season 2 ».
- **Confidence:** high (auditor's repro; the synthesis re-read the rule).

### ORD-07 · A difference between the two services is not shown when the chosen service has no state for the entry
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/sidepanel/components/watch-order.tsx:162-165`, `:197-201` (state span rendered only with a state text); `src/shared/franchise.ts:302-305`.
- **What happens:** both services connected, AniList chosen; S2 is missing from the AniList list but Completed on MAL. No state span is rendered, so the « MyAnimeList : Vu » tooltip never exists: S2 looks unwatched, and the count and « Ensuite » point at it with no hint.
- **Fix:** when the chosen service has no state and the other one has, show the other's text (« MyAnimeList : Vu ») as the muted visible state.
- **Test first:** AniList `{2: null}`, MAL `{20: watched}` → row 2 shows « MyAnimeList : Vu ».
- **Confidence:** high (auditor's repro).

### ORD-06 · MAL states come from the 5-minute memo after « Actualiser », popup actions and syncs, against the approved « refreshed on redetect » rule
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/background/franchise/states.ts:45-58`, `:83`; `src/sidepanel/components/now-playing-controller.ts:96-97`, `:321`; frozen by `now-playing-controller.test.ts:197-205` and `states.test.ts:109`.
- **What happens:** within 5 minutes of a MAL read, a status change from the popup, a sync, or a fix on myanimelist.net followed by « Actualiser » leaves the row on the old state (« Ép. 11 »), « Ensuite » does not move, or a false « MyAnimeList : Ép. 11 » tooltip appears next to AniList's « Vu ». Tracker writes do not forget the memo. Spec §5.2 and §8 (approved): the MAL list is re-read on redetect and Refresh. PERF-03 is the opposite failure on the same memo; one design should settle both (Decisions › PERF-03).
- **Fix:** send `fresh: true` on a forced refresh and on a page redetect; forget the memo on MAL writes, next to `forgettingEntries`.
- **Test first:** controller: « Actualiser » → `GET_LIST_STATES` with `fresh: true`; background: a MAL tracker write → the next `loadListStates` reads the list again.
- **Confidence:** high (existing tests freeze the behaviour).

### ORD-05 · An id AniList no longer returns makes 12 identical requests, and the result is never cached
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/background/franchise/load.ts:57-70`; `src/shared/franchise.ts:53-54`, `:155-157`, `:178`; `src/browser/storage/session-cache.ts:89-90`; `src/sidepanel/components/now-playing-controller.ts:176`.
- **What happens:** the view carries an AniList id that `Page.media(id_in:)` no longer returns (a mapping to a deleted or merged entry). `GET_PANEL_MEDIA` fails, the order still loads, and every round asks for the same id until `MAX_ROUNDS`: 12 background requests, more than half of the degraded budget, then « Franchise trop longue ». The record has no node for the start, so it is rejected on read and every reopen repeats the 12 requests.
- **Fix:** in `walk`, stop when a round expands nothing (or count requested ids missing from the page as read); with no node for the start, return `{ ok: false }`.
- **Test first:** an empty page → 1 request and no second walk.
- **Confidence:** high on the mechanism (auditor's repro); rare trigger.

### ORD-04 · Extras of a cached franchise miss the cache, so each side story or OVA opened walks the franchise again
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/background/franchise/load.ts:80-81` (pointers for the start and main entries only); spec §5.1, §8.
- **What happens:** AoT loaded from S1 is cached under its 9 main entries. Opening an AoT OVA (an extra that lists its PARENT in the chain) misses the cache and walks again: about 9 background requests, once per extra per 24 h, against the spec's « opening another entry of the same franchise costs nothing ». Pointing every extra to the graph would be wrong for an extra with its own chain (Gundam SEED).
- **Fix:** in `walk`, after round 1, if the start has no shown chain relation and its shown PARENT points to a complete cached graph that already lists the start as an extra, return that graph and write the start's pointer: 1 request.
- **Test first:** serve AoT, load S1, then `loadFranchise(<extra id>)` with the extra's page → 1 request.
- **Confidence:** medium (the exact count depends on each extra's own relations, absent from the fixtures).

## 11. Side panel: live progress, Agenda and tabs

### PNL-01 · Live progress stays on « Recharge l'onglet pour suivre la lecture. » after a slow page load, and reloading never clears it
- **Severity:** low (auditor: medium) · **Verdict:** PLAUSIBLE (V3) · **Since 2.5.0:** no
- **Where:** `src/sidepanel/components/live-progress.ts:23-25`, `:97-106`, `:131-139`, `:144-156`, `:183`, `:190`; `src/ui/page-media-controller.ts:331`, `:485`; `src/sidepanel/components/now-playing-controller.ts:216-219`; `src/sidepanel/presence.ts:94-97`.
- **What happens:** the user reloads (F5) a Crunchyroll, ADN or Prime Video episode with the panel open. The panel reconnects at +1 s, +1.8 s and +3.8 s; if the content script (injected at `document_idle`) is not ready by then, `unreachable` is set and the live block says « Recharge l'onglet… ». Nothing calls `follow` again for the same stable page, and `unreachable` blocks every same-tab follow, so reloading again changes nothing, for this and the following episodes. A tab switch, the panel's refresh button or the live setting bring it back. Sync, toasts and the « En lecture » card are unaffected. Condition: more than about 3.8 s to `document_idle` on the real site. `live-progress.ts` has no unit test.
- **Fix (V3), both parts needed:** in `follow`, a same-tab follow while `unreachable` restarts (`failures = 0; unreachable = false; connect()`); in the now-playing controller's `setTab`, call `live.follow(liveTarget())` after `ctl.setTab(next)`.
- **Test first:** live-progress: 3 refused connects → `unreachable` → `follow` on the same tab → a new `tabs.connect`; controller: `setTab(same tab)` after `unreachable` → the port is retried.
- **Confidence:** high on the code path (reproduced); medium on frequency.

### PNL-04 (also XB-03) · « Plus d'idées dans le panneau » carries no window: another window's panel takes the request
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** yes
- **Where:** `src/browser/panel-tab.ts:28-46`, `:52-65` (request `{ tab, at }`, consumed by the first panel that reads it); `src/sidepanel/sidepanel.ts:261-270`, `:283-286` (`requestedTabState` also closes Settings); `src/popup/popup.ts:489-497` (the popup knows `panelTarget.windowId`).
- **What happens:** the panel is open in window B; in window A, « Mes séries » is empty and the user clicks « Plus d'idées dans le panneau ». Panel B consumes the request within milliseconds, jumps to Découvrir and loses its open Settings view; A's new panel finds nothing and opens on its usual tab. Chrome's side panel and Firefox's sidebar are both per window.
- **Fix:** store `windowId` in the request; `takePanelTab(windowId)` and `watchPanelTab` consume only a request for their own window (`chrome.windows.getCurrent()`, already read by `presence.ts` and `toggle.ts`) and leave the others in place.
- **Test first:** two watchers (windows 7 and 3), `openPanelOn('discover', { windowId: 3 })` → only window 3 switches; `takePanelTab(2)` returns null and keeps the request.
- **Confidence:** high (XB's throwaway repro); narrow scenario.

### PNL-03 · Agenda: the answer for the week just left is shown for the newly selected week
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** no
- **Where:** `src/sidepanel/agenda-controller.ts:124-135` (`goTo` changes `range`, not `run`), `:245-248` (status applied without comparing the target week).
- **What happens:** a click on ‹ or › while a week's load is in flight: the old week's answer arrives inside the 300 ms debounce and is shown, filtered to the new week, as « Aucun épisode cette semaine… » or an error card, until the new week's own load runs; repeated clicks keep it going.
- **Fix:** in `loadWeek`, return before touching `status` when `target !== range` (keep `remember()`).
- **Test first:** after `choose(-8)` then `step(-1)`, the −8 answer → status stays `loading`.
- **Confidence:** high (transient, cosmetic).

## 12. History imports and backup

### IMP-01 · Backup « Fusionner » can drop this device's pending correction cards
- **Severity:** low (auditor: medium) · **Verdict:** CONFIRMED (V5) · **Since 2.5.0:** no
- **Where:** `src/shared/backup.ts:347` (with `mergeByKey` `:316-319` and `sortDesc` `:151-153`); called by `src/browser/storage/backup-store.ts:38`.
- **What happens:** Merge keeps the 20 newest cards of current ∪ incoming by `createdAt`, whatever their kind. A pending correction opened with « Corriger », possibly holding a deferred episode, is dropped: the contested write is never corrected and the deferred episode never replayed. This breaks invariant I5, which `savePendingReview` enforces (a correction is never evicted). Wider than reported: a device near the cap (1 old correction + 18 newer cards) loses it to a file with only 2 newer cards. A simple card pushed out by newer simple cards is not a defect (the live rule).
- **Fix (V5):** in merge mode, keep every correction, then fill the remaining slots with the newest simple cards, current or incoming (the `savePendingReview` rule); « current cards first » is as small and matches « Ajoute sans écraser ».
- **Test first:** `backup.test.ts` › merge keeps a current correction (and its `deferred`) against 20 newer incoming cards.
- **Confidence:** high (reproduced, also with 2 incoming cards).

### IMP-02 · Bulk requests over a message cap fail with a misleading error: « Tout aligner » above 2000 series, « Créer les vérifications » above 200 cards
- **Severity:** low (auditor: medium) · **Verdict:** CONFIRMED (V5) · **Since 2.5.0:** no
- **Where:** alignment `src/ui/settings/page-compare.tsx:370` → `src/ui/compare-controller.ts:111`, against `src/shared/compare.ts:109`, `:403` (`MAX_APPLY_ITEMS` 2000); review cards `src/import-cr/state.ts:98` (all selected by default) → `src/import-cr/import-cr.ts:281`, against `src/shared/cr-import.ts:555`, `:561` (`MAX_REVIEW_KEYS` 200); `src/background/background.ts:242` (invalid payload: no answer).
- **What happens:** moving a list of more than 2000 entries to a nearly empty account: « Tout aligner » shows « Impossible de contacter l'extension. Réessaie. » and every retry fails the same way. A Netflix history with more than 200 title-only seasons: « Créer N vérifications » shows « Erreur inattendue pendant l'import de l'historique. », and the user has to uncheck rows one by one with no hint why (that section has no « tout décocher »). A clean refusal: nothing is written or lost. Rare tails.
- **Fix (V5), page side only:** send at most `MAX_REVIEW_KEYS` keys (the worker already reports `limited`, and only creates the free slots anyway); send the first `MAX_APPLY_ITEMS` applicable diffs with a note to run « Tout aligner » again (aligned diffs leave the stored comparison, so the second click sends the rest; the note is a new string).
- **Test first:** `compare-controller.test.ts` › `apply()` with 2001 diffs sends a payload `isApplyDiffsPayload` accepts; an import-page test › `createReviews` with 201 selected sends a payload `isCrImportReviewsPayload` accepts.
- **Confidence:** high (reproduced).

### IMP-03 · The history import's apply ignores an exclusion made after the analysis
- **Severity:** low · **Verdict:** unverified · **Since 2.5.0:** no
- **Where:** `src/background/history-import/apply.ts:92-118`, `:134-195` (no exclusion check); exclusions are checked only during the analysis, `src/background/history-import/analyze.ts:95`, `:100`, `:263-264`.
- **What happens:** the user analyses a history (the preview persists until « Recommencer » or a sign-out), excludes a series from the popup (« never sync it »), then clicks « Mettre à jour »: the series' progress, and maybe « Terminé », is written to AniList and MAL anyway. Live sync and the queue re-check exclusions at write time.
- **Fix:** in `applyItem`, skip the item when `isExcluded({ mediaId: item.mediaId })`, with a « série exclue » skip reason; ideally also check its seasons' platform keys (carried in `CrPlanItem`).
- **Test first:** `cr-import.test.ts` › application: an exclusion added after the plan → nothing written, item `skipped`.
- **Confidence:** high (auditor's repro).

## 13. Decisions to revisit

Behaviour that follows a recorded decision, or a design choice nobody recorded, and carries a risk the decision did not weigh. Each needs the owner's call; options and recommendations are in `0-synthese.md` › 2.

### ORD-03 · Recaps that AniList links by PREQUEL / SEQUEL enter the main chain, so « Ensuite » after the Gundam TV is its recap film
- **Severity:** medium · **Verdict:** CONFIRMED (decision to revisit, V5) · **Since 2.5.0:** yes
- **Where:** `src/shared/franchise.ts:89`, `:173` (any PREQUEL / SEQUEL edge adds to the main chain), `:224-242` (`franchiseProgress`); `src/sidepanel/components/watch-order.tsx:339`; data `src/shared/__fixtures__/franchise/gundam.json`; frozen by `src/shared/franchise.test.ts:138` (23 main entries, « Ensuite » never checked); rule: `docs/superpowers/specs/2026-11-09-watch-order-design.md:47`, `:101`; anti-goal `:25`.
- **What happens:** the approved rule « main chain = PREQUEL / SEQUEL, any format » produces the spec's own anti-goal, « a wrong Ensuite pointing backwards », on its Gundam reference capture: THE ORIGIN declares `SEQUEL → 1090` and Ζ Gundam / 0083 declare `PREQUEL → 1092`, so the three compilation films are main entries. With the 0079 TV watched the header reads « 1 / 22 vus » and « Ensuite : Gundam I » (shown « I », ORD-08); after UC, « Ensuite » is the recap special « Akai Shouzou ». Recaps also inflate the count. Format, length and tags cannot tell recaps from real sequel films (V5 checked the four captures).
- **Options (V5):** (a) after the walk, move entries that a main entry declares SUMMARY or COMPILATION to the extras, outside `MAX_EXTRAS`, still shown under « Tout »: exact on the four captures (Gundam main 23 → 19 and « Ensuite » = Ζ Gundam; AoT, Monogatari, Mushoku Tensei unchanged); re-edits linked only by ALTERNATIVE (Ζ A New Translation, Unicorn RE:0096) stay. (b) Also ALTERNATIVE, as the auditor sketched: wrong, AniList declares it on both sides, so it would demote Ζ Gundam, UC and THE ORIGIN themselves. (c) Keep.
- **Test first (a):** Gundam with 80 watched → `next.id` 85, and main is 19 entries without 1090-1092 and 14007; AoT, Monogatari and Mushoku Tensei keep their main entries.
- **Confidence:** high on the data; the fix is a rule change.

### TERMS-02 · Users who had turned release alerts off get sequel alerts, daily list reads and notifications after the update, with no notice
- **Severity:** low (auditor: medium) · **Verdict:** DELIBERATE (decision to revisit, V1) · **Since 2.5.0:** yes · **To decide before the tag**
- **Where:** `src/shared/settings.ts:73`, `:211` (absent `sequelAlerts` → true); `src/browser/airing-alarm.ts:32` (alarm kept when `airingAlerts || sequelAlerts`; 2.4.2 cleared it, 2026-10-15 PERF-17); `src/background/background.ts:312-314`; `src/background/airing.ts:321-329`; `src/background/update-migrations.ts:51-79` (no 2.5.0 step); decision: sequel spec `:101-102`, `:143` (« both on by default »), anti-goal `:25`.
- **What happens:** a 2.4.2 user with « Alertes de sortie » off had no alarm and no background request. The update recreates the hourly alarm; the first pass seeds silently, then each new sequel shows an OS notification, and the full lists are read every day (for MAL-only users, their MAL ids go to AniList, SEC-01). The default is recorded; its anti-goal covers a burst after the update, not users who had opted out of SyncKai's only alert feature. Low: the notifications are rare and relevant, one toggle turns them off, and the CHANGELOG points to the setting.
- **Options:** (a) a 2.5.0 step in `runUpdateMigrations`: raw stored settings (key absent, not the normalized ones) with `airingAlerts === false` → `sequelAlerts: false`; the first tick then clears the alarm through `skipped === 'disabled'`. (b) `sequelNotifications: false` only (keeps Activité, the hourly wake and the daily reads). (c) Keep. The migration only applies on the 2.4.2 → 2.5.0 update, hence before the tag.
- **Test first (a):** `update-migrations.test.ts`: from 2.4.2 with `airingAlerts: false` and no sequel keys → `sequelAlerts: false`; with `airingAlerts: true`, or coming from 2.5.0 → unchanged.
- **Confidence:** high on the behaviour (repro by TERMS); medium on the policy reading.

### SEQ-02 · A sequel pruned because its source was paused, dropped or excluded never comes back once the source is resumed
- **Severity:** low (auditor: medium) · **Verdict:** CONFIRMED (decision to revisit, V1) · **Since 2.5.0:** yes
- **Where:** `src/shared/sequels.ts:216-221` (200-record cap), `:236-239` (a record lives only while it is a candidate), `:244` (a `known` id is never recreated); `src/background/sequels/fetch.ts:16`, `:102`, `:105`, `:111`; `src/ui/sequels-store.ts:28`; `src/sidepanel/components/watch-order.tsx:141`; frozen by `src/shared/sequels.test.ts:116-125`.
- **What happens:** pausing X (one click away with the 2.5.0 bulk pause) prunes its sequel Y at the next pass. Resuming or finishing X never brings Y back in Activité, the Agenda « Announced » view, or as the panel's « + À regarder » (the badge stays); only a sign-out resets it. Display only: nothing is written, and Y was announced or seeded once. The spec prunes on terminal reasons only and meant `known` to stop re-notification; « never recreated » is the builder's stricter choice.
- **Options:** (a) keep an `ended` set (dismissed + added + capped-out ids, capped like `known`) and recreate the other known candidates as `seen`, never notified; the capped-out ids must stay out, or every pass recreates them and churns the 200 cap. Changes `sequels.test.ts:116`. (b) Keep and document.
- **Test first (a):** seen → source paused → source resumed brings Y back as `seen` and not notified; a capped-out id stays out.
- **Confidence:** high (logic).

### SYNC-02 · Unmarked mappings (every manual choice saved before 2.4.0) are deleted when an episode falls outside them, against three documents
- **Severity:** low (auditor: medium) · **Verdict:** CONFIRMED (decision to revisit, V3) · **Since 2.5.0:** no
- **Where:** `src/background/sync/resolver.ts:372-375`; `src/background/sync/sync-service.ts:378` (`revalidateCachedTarget`); the documents that say the opposite: `docs/memory/matching.md:18`, `src/shared/sync.types.ts:37-39`, `src/background/sync/__corpus__/README.md:26-28`; deliberate only in commit `d95ff02`, frozen by `resolver.test.ts:233-240`.
- **What happens:** origin flags exist since 2.4.0, with no migration, so a validated card or a « Corriger » choice from 2.3.1 or earlier is unmarked. Rewatching S2 E3 under a « Part 2 » choice, or a smaller AniList total, deletes it, and the next episode is resolved again, usually giving one more « À vérifier » card. Recoverable; most unmarked mappings are automatic, and dropping those is intended.
- **Options:** (a) align the three documents: « unmarked: never deleted when the signals contradict it (« À vérifier » instead); dropped like a learned mapping when an episode falls outside it or the total drops below it ». (b) Protect unmarked mappings like `chosen` ones: pre-2.4.0 automatic mappings would never be replaced, and every out-of-range episode would be resolved again without caching (more AniList searches).
- **Test first:** (a) none; (b) an unmarked `{ offset: 12 }` mapping with S2 E3 → `forgetIfUnchanged` not called.
- **Confidence:** high.

### XB-02 · The grouped sequel notification almost never opens Activité
- **Severity:** low · **Verdict:** unverified (decision to revisit) · **Since 2.5.0:** yes
- **Where:** `src/background/sequels/actions.ts:53-57`, `:86-99` (comment at `:88`), `:103`; `src/browser/popup-screen.ts:34-44`; `src/background/sequels/check.ts:52-58`; spec `docs/superpowers/specs/2026-11-09-sequel-alerts-design.md:72`.
- **What happens:** a click on « N suites annoncées » (or « Afficher dans SyncKai ») calls `chrome.action.openPopup()` with no window and no focus step. Firefox 142 to 148 always refuses it (no user gesture from `notifications.onClicked`, read in Firefox's source); Chrome and Firefox 149+ refuse it for an inactive window, likely when the user clicks an OS notification from another app. The fallback opens only the first sequel's AniList page, without focusing the window. The spec presents the fallback as the exception; in practice it is the usual path.
- **Options:** (a) `windows.getLastFocused({ windowTypes: ['normal'] })`, `windows.update(id, { focused: true })`, then `openPopup({ windowId: id })`; keep the fallback for Firefox < 149 and focus the created tab's window there; correct the comment. (b) Keep the fallback as the normal path and say so.
- **Test first (a):** `sequels/actions.test.ts`: a fake `action.openPopup` that rejects unless `windows.update({ focused: true })` was called first; a group click ends in `openPopup`, not `tabs.create`.
- **Confidence:** high for Firefox 142-148; medium elsewhere (window state at click time not observed).

### POP-05 · « Tout mettre en pause » runs inside the popup: closing it mid-run stops the run and loses the promised « Annuler »
- **Severity:** low · **Verdict:** unverified (decision to revisit) · **Since 2.5.0:** yes
- **Where:** `src/popup/controllers/dormant.ts:168` (`undoable` in page memory), `:234-252`; `src/popup/components/dormant-section.tsx:84-87`.
- **What happens:** 15 series take 15 to 30 s today (about 1.5 to 2 minutes once PERF-02's pacing is in), with only a spinner. A click outside closes the popup, the loop dies with the page, the remaining series are not paused, no result is shown, and « Annuler » for the series already paused is gone, although the confirmation promised « Tu pourras annuler juste après ». Neither the spec nor `docs/memory/` acknowledges the popup's lifetime.
- **Options:** (a) run the bulk as a service-worker job, like the list alignment (heartbeat, resume, stored undo set); (b) keep it in the popup, show « n / N » and persist the undo set briefly in `storage.session` so the next open still offers it; (c) keep.
- **Test first:** an ext-e2e scenario that closes the popup mid-bulk, then checks the remaining entries and whether « Annuler » is offered.
- **Confidence:** high.

### PERF-03 · The panel downloads the whole MAL list again for almost every new view, including single-entry franchises
- **Severity:** low · **Verdict:** unverified (decision to revisit) · **Since 2.5.0:** yes
- **Where:** `src/background/franchise/states.ts:45-65`, `:77-88` (memo in worker memory, 5 min); `src/sidepanel/components/now-playing-controller.ts:81-106`, `:131-136`, `:168-194`; `src/sidepanel/components/similar-loader.ts:55-73`; `src/sidepanel/components/watch-order.tsx:375-381`; `src/background/mal/full-list.ts:9-24`.
- **What happens:** a MAL user (MAL-only or both services) watches with the panel open. The memo dies when the worker sleeps during an episode; each episode's new view sends `GET_LIST_STATES` from the watch order and from « Dans le même esprit » (RECO-07), so a full MAL list read (about 350 KB per 1000 entries) runs once or twice per episode, plus once per panel action. A franchise with fewer than 2 entries (section not drawn) still fetches. Spec §5.2: the list is read once per panel page and kept for the page's lifetime, re-read on URL change, Refresh or a list action. ORD-06 is the opposite failure (stale after « Actualiser »).
- **Options:** (a) keep the MAL list in the panel page, as the spec says, re-read on redetect, Refresh and list actions (also settles ORD-06); (b) `storage.session` keyed by session epoch for about 10 minutes; (c) keep. In every case: skip `GET_LIST_STATES` for graphs with fewer than 2 entries, and ask MAL only for `list_status{status,num_episodes_watched}`.
- **Test first:** `states.test.ts`: two `loadListStates` within 10 minutes across a module reload → one `fetchMalFullList`; controller: a single-entry graph sends no `GET_LIST_STATES`.
- **Confidence:** high on the mechanism; medium on the per-episode frequency.

### PERF-04 · Hourly worker wake-ups return for users who turned release alerts off
- **Severity:** low · **Verdict:** unverified (decision to revisit) · **Since 2.5.0:** yes
- **Where:** `src/browser/airing-alarm.ts:15`, `:32` (2.4.2: cleared when release alerts were off, 2026-10-15 PERF-17); `src/shared/settings.ts:73`; `src/background/airing.ts:321-329`; `src/background/sequels/check.ts:70-71`.
- **What happens:** sequel alerts (on by default) keep the 60-minute alarm, so the worker starts 24 times a day; 23 of these wakes only read the settings, the tokens, the whole `sequels:state` and the locale catalogue to answer « not due », against `CLAUDE.md`'s « keep the service worker idle ». TERMS-02 option (a) removes them for the upgraded users who had turned release alerts off; this finding covers everyone else with sequel alerts on and release alerts off.
- **Options:** (a) a one-shot alarm `synckai:sequels` at `lastCheck` + 24 h (+ 6 h after a failure), dispatched by name in the existing `onAlarm` listener (no new `addListener`), and the 60-minute alarm only with release alerts on; (b) keep.
- **Test first (a):** `airing-alarm.test.ts` with release alerts off and sequel alerts on → no 60-minute alarm.
- **Confidence:** high.

### PNL-02 · Agenda: the week on screen is never re-read while the panel stays open, unless the hourly alarm rewrites it
- **Severity:** low · **Verdict:** unverified (decision to revisit) · **Since 2.5.0:** no (widened by 2.5.0)
- **Where:** `src/sidepanel/agenda-controller.ts:200-208` (the remembered week wins whenever it is at least as recent as the cache); `src/background/airing.ts:191` (2.5.0 blocked skip), `:230`; `docs/memory/architecture.md:10` (« weeks received kept for the page's lifetime »).
- **What happens:** with the panel left open for hours, every load serves the remembered week: the 1 h and 6 h TTLs never apply to it. Only the alarm's week-cache write beats it, and that write does not run with release alerts off nor, since 2.5.0, when the browser blocks notifications. Postponed or newly scheduled episodes keep their old day and time in « Aujourd'hui » until the panel is reopened.
- **Options:** (a) apply the week TTL to remembered current and future weeks, keeping the 60 s refetch guard and the past-week rule; (b) keep and document.
- **Test first (a):** a fresh current week remembered, 5 h later a settings change and `activate()` → one `GET_AGENDA` (zero today).
- **Confidence:** high (auditor's repro).

### STO-02 (also IMP-04) · Backup: dismissed suggestions are invisible in the preview, and « Remplacer » with a pre-2.5.0 file erases them
- **Severity:** low · **Verdict:** unverified (decision to revisit) · **Since 2.5.0:** yes
- **Where:** `src/shared/backup.ts:69-77`, `:282-293` (`BackupSummary` has no `recoDismissed`), `:121-132` (absent section → `[]`), `:329` (`replace` takes the file whole); `src/browser/storage/backup-store.ts:52`; `src/import/view.ts:28-35` (`SUMMARY_LABELS`); `src/i18n/locales/fr.json` › `import.replaceWarning`.
- **What happens:** a 2.5.0 user who dismissed many suggestions (up to 500) restores a 2.4.x backup in « Remplacer » mode, for example to get mappings back. The missing section is read as empty and written: every « Pas intéressé » series comes back in Découvrir and « Dans le même esprit ». Nothing warns: « Contenu du fichier » has no row for the section, and the confirmation names only « correspondances, séries exclues et historique ». A file holding only dismissed ids looks empty. The design says « a restore replaces it » without weighing older files.
- **Options:** (a) absent ≠ empty: carry the section's presence (`recoDismissed: number[] | null`), keep the current list on « Remplacer » when the file has none, and add the summary row (a new string); (b) only the row and the warning text.
- **Test first (a):** `backup-store.test.ts` › « Remplacer » with a file without `recoDismissed` keeps the stored list; `view.test.ts` expects the new row.
- **Confidence:** high.

### STO-01 · Signing in over a stored (expired) token keeps the previous account's user-scoped data
- **Severity:** low · **Verdict:** unverified (decision to revisit) · **Since 2.5.0:** no (2.5.0 adds `reco:dismissed` to what carries over)
- **Where:** `src/background/anilist/auth.ts:87-90`; `src/background/mal/auth.ts:151-152`; `src/browser/storage/account-data.ts:41-54` (`removeAniListSession` never reaches `removeUserSyncData`); `src/browser/storage/account-keys.ts:14` (scope `user`).
- **What happens:** account A's AniList token has expired and the popup offers « Reconnecter »; someone signs in with account B. The old session is closed, but the « last account signed out » purge never runs, so B inherits A's simple « À vérifier » cards (confirming one writes A's episode into B's list), dismissed suggestions, declined rewatches, airing state, learned platform links and badge count.
- **Options:** (a) finish the close like a sign-out: `clearUserSyncDataIfNoSession()` between `clear*Session()` and `save*Token()`, in one lock-ordered helper of `session-end.ts`; (b) purge only when the new viewer id differs from the cached one (read before the clear), so the same person keeps their data across a reconnect.
- **Test first:** seed an expired AniList token, a simple pending review and `reco:dismissed`, run the login storage sequence → both gone (with (b): only for another viewer id).
- **Confidence:** high on the mechanism; the impact needs a different person on the same browser profile.

### ARCH-02 · Content-script budgets are used up, while decision 13 assumed about 10 % margin
- **Severity:** low · **Verdict:** unverified (decision to revisit) · **Since 2.5.0:** no
- **Where:** `scripts/build-checks.ts:32`, `:35`, `:60`; `docs/audit/2026-10-15/README.md:52` (decision 13); `.github/workflows/release.yml:96-97`.
- **What happens:** measured on the 2.5.0 `dist/`: Crunchyroll 61,178 / 61,440 bytes (262 left), ADN 54,784 / 55,296 (512), Prime Video 75,909 / 76,800 (891). A site change that needs a few hundred bytes (a new selector strategy, CR-02's regex) fails `verify:build`, which `release.yml` runs before the upload, so a hotfix waits until code is trimmed under pressure or a budget is raised. Decision 13 dropped c7 on the premise of « about 10 % margin ».
- **Options:** (a) trim back to a 5-10 % margin before the next content-script fix (c7 or another cut, which reopens decision 13); (b) write down a hotfix rule for raising a budget; both.
- **Test first:** none (`npm run verify:build` measures it).
- **Confidence:** high (measured).

### ARCH-03 · The coverage ratchet was never tightened: thresholds sit 4.4 to 5.6 points under the measured coverage
- **Severity:** low · **Verdict:** unverified (decision to revisit) · **Since 2.5.0:** no
- **Where:** `vitest.config.ts:20-22`, `:29`; `.github/workflows/ci.yml:142-157`.
- **What happens:** CI at the 2.5.0 head measures 90.37 / 85.89 / 90.01 / 92.18 % (statements, branches, functions, lines) against thresholds of 85.8 / 80.3 / 85.6 / 87.4: about 900 statements or 1,000 branches can lose coverage with CI still green, so decision 5's ratchet only catches a collapse.
- **Options:** (a) set the thresholds to the measured floor (90.3 / 85.8 / 90.0 / 92.1) and make the job warn when the slack exceeds 1 point, so it is tightened at each release; (b) keep.
- **Test first:** none (the CI coverage job).
- **Confidence:** high (CI measurement).

## 14. Refuted findings and corrected claims

No finding was refuted. The verifiers corrected these claims, and the entries above already use the corrected version:

- **ARCH-01:** not a product focus bug; the focus always lands, the two assertions race (V2).
- **SEC-01:** 2.4.2 already sent CURRENT MAL ids to AniList (Watching list, Agenda) and, in the user-started comparison, all MAL-only entries; `permissions.md:158` is an internal note, not a dashboard field; TERMS' « high » becomes medium (V2).
- **TRK-01:** pinging only during budget waits misses Firefox's long passes; a `storage.session` write fires `storage.onChanged` in open pages; the « pass started » marker alone fixes nothing (V1).
- **PERF-02:** choosing the lane from `onlyFrom` would also slow single « Pause » clicks (V1).
- **CR-01:** the page-media session cache is not a sink; the size reaches about 1.2 MB per card in UTF-8 (V3).
- **UI-01:** fixing the hook alone would send the focus to the rail or the tab; local targets are still needed (V4).
- **ORD-01:** narrower than reported, only platforms AniList does not list, on entries already watched or visited (V5).
- **ORD-03:** the auditor's ALTERNATIVE rule would demote Ζ Gundam, UC and THE ORIGIN (V5).
- **IMP-01:** case (b), a simple card pushed out by newer ones, follows the live rule; case (a) is wider than reported (V5).
- **IMP-02:** no new error path is needed in the worker (V5).
- **PNL-01:** the `follow` reset alone misses F5, where `follow` is never called (V3).
- **SEQ-02:** the fix must keep capped-out ids out (V1).
- **SYNC-02:** protecting unmarked mappings has a cost the auditor did not name (V3).
