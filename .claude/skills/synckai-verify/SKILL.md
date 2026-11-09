---
name: synckai-verify
description: >
  Run SyncKai's checks (verify, unit tests, e2e, i18n layout, real-extension tests, i18n catalogs) with the
  output kept out of the conversation: full logs go to a file, only the verdict and the failures come back.
  Use before every commit or merge, after a change, and whenever the owner asks to run tests, verify, lint,
  typecheck, e2e, test:ext or i18n checks.
argument-hint: "[verify|test|e2e|layout|ext|i18n|all] [vitest file filters]"
---

# SyncKai verify

Goal: a passing run costs one line in the conversation, a failing run only its failures.

## Which check

| Argument | Command | When |
|---|---|---|
| `test` (+ files) | `npx vitest run <files>` | while working: only the test files of the touched modules |
| `verify` (default) | `npm run verify` | before a commit that changes code; before a merge (types, unit tests, Chrome and Firefox builds, package checks, `web-ext lint`, ESLint) |
| `e2e` | `npm run test:e2e` | before a merge when the popup, the side panel, the import page or the Backup page changes; before a tag |
| `layout` | `npm run test:i18n-layout` | after a UI string or layout change |
| `ext` | `npm run test:ext` | sync, playback, accounts, panel, import, worker wake-ups |
| `i18n` | `npm run i18n:check` | after a catalog change |
| `all` | `verify`, then `e2e` | before a merge that touches a screen |

Cloud sessions (container as root, `CLAUDE_CODE_REMOTE=true`): prefix `e2e`, `layout` and `ext` with `CI=1`, and set `SYNCKAI_I18N_LAYOUT_DIR=<log dir>/layout` for `layout`. Local sessions on the owner's PC: no `CI=1`.

## How to run

1. Log directory: the session scratchpad named in the system prompt, else `${TMPDIR:-/tmp}`. Never next to the repository.
2. Run one command per Bash call, output to a file, nothing on screen:

   ```bash
   LOG="<log dir>/verify-$(date +%H%M%S).log"
   npm run verify > "$LOG" 2>&1; echo "exit $?"
   ```

   Give long runs a timeout of 600000 ms (`verify` ≈ 3–5 min, `ext` ≈ 3 min, `layout` ≈ 1 min).
3. Exit 0: read only the summary, then stop.

   ```bash
   grep -E "Test Files|Tests  " "$LOG" | tail -4
   ```

4. Exit ≠ 0: extract the failures, never print the whole log.

   ```bash
   grep -nE "error TS|FAIL |×|✖|AssertionError|Error:|problems? \(|errors? [0-9]|budget|exceeds" "$LOG" | head -40
   ```

   If that is empty or unclear, read the last 60 lines (`tail -60 "$LOG"`), then the lines around a match with the Read tool (`offset` / `limit`), never the whole file.

## How to report

- Pass: one line, e.g. « verify OK : 3858 tests, builds Chrome / Firefox, lint ». Name the checks that were NOT run (e2e, layout, ext, real sites).
- Fail: the failing check, the file and test or rule, the error in one or two lines, and the log path. Then fix the cause (systematic debugging) and re-run only the failing check first, then the full command.
- Never call a run green from an earlier run on another tree: re-run after the last edit.
