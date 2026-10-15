# Audit of 2026-10-15

Seven expert audits of the whole extension, run read-only on `develop` at `9a5d08c` (after `feature/match-signals`), and their consolidated synthesis.

| File | Scope |
|---|---|
| `0-synthese.md` | Consolidated synthesis: deduplicated findings, owner decisions, design patterns, target folder tree, ordered branch plan. Kept in French: it is the owner's working document. |
| `1-business-logic.md` | Sync and matching core (resolver, concordance, mappings, queue) |
| `2-content-architecture.md` | Content scripts, adapters and MAIN-world bridges, bundle sizes |
| `3-performance.md` | Requests per user action, caches, service worker wake-ups, bundles |
| `4-ui-architecture.md` | Popup, side panel, settings and import pages, rendering and focus |
| `5-security-quality.md` | Security, privacy, typing, tests and tooling |
| `6-business-domains.md` | Imports, Agenda, list actions, AniList / MAL parity, sessions, settings, backup |
| `7-folder-architecture.md` | Folder structure and target architecture |

These are snapshots: file paths and line numbers refer to `9a5d08c`, before the folder restructuring (`refactor/structure`, see `CLAUDE.md` › Module boundaries for the current layout). Absolute `/tmp/...` paths point to throwaway repro tests that were not kept.

Done since (see `git log` and `CHANGELOG.md`, which are authoritative):

- bug fixes: matching H1, H2, M1, M2, M3, L5; B1, B2, B3, B4, B6, Settings write lock, `SET_LIST_STATUS` cover; bridges R1, R2, R4, R5; SEC-04;
- phase (a) safety nets a1–a4, a6 and part of a5; phase (b) folder moves b1–b7b;
- performance d1, d2, d3 (`144cddb`), d4, d5 (`10770a0`), d6 (`b131953`: grouped season reads on series pages; PERF-20 and the MAL-only serial statuses left for later, low gain), d7 (`perf/import-batching`: PERF-10 batched searches in the Crunchyroll / ADN analysis, B9 job reads and writes on the background lane, PERF-21), plus the hourly airing check on the background lane and the language listener no longer waking the service worker (`47986bf`);
- decision 14 (PERF-21, adaptive background quota): yes (owner, 2026-10-15), done in d7;
- also on 2026-10-15: dev-only debug trace (`855a292`), complete-episode shortcut able to resend an episode already synced (`cfbb808`);
- refactors e9, e12, f0, f2;
- phase (c) bundle wins c1–c6 and c8 (2026-10-15: the shared Crunchyroll / ADN script went from 83.0 KB to 54.5 KB on Crunchyroll and 49.0 KB on ADN; package without crxjs intermediates nor `.woff` fonts). c7 dropped (decision 13: no, every content script now has about 10 % margin, and warnings must still reach the journal when the service worker is unreachable).

Still open: d8, the business refactors e1–e8, e10, e11, the remaining fixes s1–s3, s5, s6, the Preact decision (`feature/ui-preact-pilot`) and the owner decisions listed in section 3 of the synthesis.
