# Audit of 2026-11-10

Seventeen read-only audits of the code about to ship as 2.5.0, an adversarial verification of every medium and high finding, and the consolidated synthesis.

**Base:** `chore/audit-2026-11-10`, identical to `release/2.5.0` at `4188b90` (« chore(release): 2.5.0 »). The last published version is 2.4.2 = `46942a2`; « since 2.5.0 » means that the faulty code is in `46942a2..4188b90`. **All paths and line numbers in this folder refer to `4188b90`.** Throwaway repro tests (`zz-audit-*`) were deleted right after each run; none was kept.

| File | Content |
|---|---|
| `0-synthese.md` | The owner's working document, in French: verdict for 2.5.0 (blockers, fixes recommended before the tag, the rest), owner decisions, ordered branch plan, manual checks, counts. |
| `findings.md` | Every finding after deduplication (69, from 78 reported), grouped by area, most severe first: severity, verdict, since 2.5.0, where, what the user sees, fix sketch, test to write first, confidence. Decisions to revisit have their own section. |
| `README.md` | This file: scope, method, legend. |

The 17 auditor reports and the 5 verdict files were working documents and are not kept; `findings.md` carries their content.

## Scope: 17 lenses

Each auditor read the 2.5.0 diff of its area, the relevant `docs/memory/` files, the 2.5.0 specs (`docs/superpowers/specs/2026-11-0*-design.md`) and the previous audit (`docs/audit/2026-10-15/`) before judging.

| Id | Lens | What it covered |
|---|---|---|
| SYNC | Sync and matching core | What is written to AniList / MAL when an episode is watched: resolver, matching stages, mapping store, judge, queue, guards, review cards, list rules; the write step of every 2.5.0 writer. |
| TRK | Tracker clients, sign-in, sessions, tokens | AniList and MAL clients, OAuth flows, refresh, rate-limit budget, token encryption, session epochs of the 2.5.0 reads. |
| CR | Crunchyroll, ADN and shared content infrastructure | Adapters, watch session, player detection, SPA navigation, completion, MAIN bridge and kits, in-page toasts, history readers. |
| SVOD | Netflix, Disney+, Prime Video | Adapters, bridges, link gates, numbering, hover previews, and the optional-permission lifecycle (grant, update, revoke, preferred player). |
| SEQ | Sequel alerts (new) | Daily pass, dedup, sessions, scheduling, notifications, Activité and Agenda « Announced » rows, Firefox paths. |
| ORD | Watch order (new) | Franchise walk and caps on the four real captures, release order, « Ensuite », state merge, cache, panel timeline and its accessibility. |
| RECO | Recommendations (new) | Seed selection, score formats, exclusions, batch building and storage, Discover tab, popup empty state, « Dans le même esprit », dismissed ids in the backup. |
| POP | Popup and its 2.5.0 features | Navigation rail, 496 × 600 layout, remaining time, dormant series and bulk pause, friends, sorts, loading and error states. |
| PNL | Side panel and new-episode alerts | Now playing, Schedule, tabs, presence, live progress, airing alerts and the blocked-notifications state. |
| IMP | Imports, jobs, comparison, backup | Crunchyroll, ADN and Netflix history imports, the job runner, AniList ↔ MAL comparison and alignment, backup export and import. |
| STO | Storage, settings, protocol, wiring | Storage keys and scopes, settings normalization, message protocol and guards, update migrations, service-worker listeners. |
| SEC | Security and privacy (cross-cutting) | Message gate, HTML and URL sinks, stored-data revalidation, token boundary, bridges, disclosures, `npm audit`. |
| PERF | Performance and request budgets | Requests per user action and per periodic job, service-worker wake-ups and lifecycle, caches, bundle sizes. |
| TERMS | API terms, store policies, privacy disclosures | AniList terms, MyAnimeList API agreement, Chrome Web Store and AMO policies, `PRIVACY.md`, `docs/store/permissions.md`. |
| UI | Shared UI, accessibility, i18n | Preact components and hooks, focus, ARIA, live regions, contrast, the 21 catalogs and their plurals. |
| ARCH | Architecture, tests, tooling, CI | Layer rules and import graph, test suite and coverage, CI and release workflows (CI logs read through the GitHub API), budgets, dependencies, licences. |
| XB | Cross-browser parity and MV3 lifecycle | Chrome, Brave and Firefox: Firefox manifest, minimum versions, alarms, events, notifications, per-window panels (Firefox sources and browser-compat-data read). |

## Verification: 5 groups

| Group | Theme | Findings verified |
|---|---|---|
| V1 | Background jobs and lifecycle | TRK-01 (= PERF-01, SEQ-01, XB-01), PERF-02, TERMS-02, SEQ-02 |
| V2 | Release readiness and disclosures | ARCH-01, SEC-01 (= TERMS-01); three local e2e runs allowed (`CI=1`, the pinned `chrome-headless-shell` that CI uses) |
| V3 | Content scripts and sync | CR-01, SVOD-01, SYNC-01, SYNC-02, PNL-01 |
| V4 | UI interaction and accessibility | UI-01 (= ORD-02), UI-02, UI-03, UI-04, POP-01, RECO-02 |
| V5 | Data, backup, watch order, recommendations | IMP-01, IMP-02, ORD-01, ORD-03, RECO-01 (= PERF-05) |

## Method

- **Read-only auditors, one lens each, in parallel.** No edit, commit, checkout, stash, reset or switch. No build, `tsc`, full suite, e2e or `test:ext` (four CPUs were shared by 17 auditors); single test files only. Every claim was traced from a real caller or input to the failure, with `file:line` evidence; at most 15 findings each, most severe first.
- **Throwaway repro tests.** To prove a suspicion, an auditor or a verifier could write one test at a time (`zz-audit-<ID>-<n>.test.ts` next to the module), run it alone with `npx vitest run`, delete it and check `git status --short`. A failing repro is the strongest evidence; a passing one usually refutes.
- **Privacy.** No token, cookie, HTTP header or account / profile id was read or copied. AniList, MyAnimeList and the streaming sites were never contacted; public documentation (Chrome and MDN docs, Firefox sources, store policies, API terms) was allowed. The real-site behaviour that the findings depend on is listed as a manual check in `0-synthese.md`.
- **Documented decisions are not bugs**, unless the code contradicts them or they carry a risk the document does not acknowledge. Such findings are « decisions to revisit », severity at most medium.
- **Adversarial verification of medium and above.** Every finding an auditor rated medium or high went to a separate verifier who tried to refute it: re-read the code at and around the cited lines, traced the path from a real caller, looked for a recorded decision, checked the existing tests, reproduced it with a throwaway test when cheap, then set the final severity and corrected the fix sketch.
- **Low findings are unverified**, except those a verifier downgraded from medium (they are verified). They keep the auditor's severity and are marked « unverified »; many were still reproduced by their auditor, which each entry says.
- **Deduplication.** 78 findings were reported (4 high, 23 medium, 51 low). Duplicates were merged into one finding, which keeps the first ID and lists the others: 69 findings remain.

## Legend

Severity (the scale of the auditors' brief):

| Level | Meaning |
|---|---|
| critical | data corruption, a wrong write, or a security hole reachable in normal use |
| high | a core feature broken, or a wrong write in a plausible case |
| medium | real but narrow or recoverable |
| low | minor but real |

Verdicts:

- **CONFIRMED**: reproduced by a throwaway test, or traced end to end with no missing step.
- **PLAUSIBLE**: the path exists but depends on a condition that could not be confirmed (browser behaviour, real-site data, timing); the entry names the condition.
- **REFUTED**: the failure needs an unrealistic or impossible state, or a guard prevents it. No finding was refuted in this audit; the claims the verifiers corrected are listed at the end of `findings.md`.
- **DELIBERATE / decision to revisit**: the behaviour follows a recorded decision (a spec, `docs/memory/`, the previous audit) that carries a risk the decision did not weigh. « CONFIRMED (decision to revisit) » means the behaviour is verified and its fix is an owner decision.
- **unverified**: a low finding checked by its auditor only.

## Status

Nothing was fixed at the time of writing. `git log` and `CHANGELOG.md` are authoritative on what has been done since.
