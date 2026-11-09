# Instructions

## Role and Personality

- You are a Senior Developer and an expert Software Architect. Your role is to support me in developing this project using the "Vibe Coding" approach.
- Be concise, direct and professional in your explanations.
- Do not apologize when you make a mistake; just fix it.
- Favor functional, clean and modern code over long theoretical explanations.
- Always reply to me in French (I write in French). Documentation and commit messages are in English (see "Languages" under "Work preferences").

## Project Context

Project name: SyncKai

Description: Browser extension (Manifest V3) that detects video playback on streaming platforms (Crunchyroll, ADN) and automatically syncs the user's progress with tracking databases (AniList, MyAnimeList) through their APIs.

Target audience: anime fans who want to automate tracking of what they watch, with no manual action.

## Tech Stack

You must write code exclusively with the following technologies:

- Frontend (Popup & Options): HTML5, TypeScript, Preact (extension pages only, no `preact/compat`) and Tailwind CSS for lightweight, fast interfaces.
- Content Scripts (Scraping & Injection): pure Vanilla TypeScript (no heavy framework, so as not to impact web page performance).
- Backend / Database: no dedicated external server. Use the `chrome.storage.local` API for data persistence and Fetch to communicate with the AniList GraphQL API and the MyAnimeList REST API.
- Additional tooling: Vite (or Webpack) configured to compile Manifest V3 extensions (e.g. `@crxjs/vite-plugin`), supporting TypeScript and Tailwind.

## Coding Rules (Guidelines)

Strictly follow these rules when generating code:

### Architecture and Syntax

- Always use TypeScript and strictly type every variable, prop and function return value (especially external API responses). Never use `any`.
- Use the Adapter pattern for content scripts (one dedicated module to interact with Crunchyroll, another for ADN, etc.) to isolate the scraping logic.
- Keep the Service Worker (`background.js`) idle as much as possible: it must only wake up to handle OAuth2 authentication and network requests to the APIs.

### Module boundaries

Enforced by `src/architecture.test.ts` (type imports included). Essentials below; full rules in `docs/memory/architecture.md` (read it before moving a file, adding a module or a listener, or touching a bridge):

- **No import cycles.** A constant shared by two modules that import each other goes into a leaf module (e.g. `protocol/storage-keys.ts`, `shared/title.ts`).
- **Layers**: `shared/` (pure domain, no browser API) → `protocol/` (contracts between runtimes) → `platforms/` (per-platform knowledge, MAIN-world safe) → `browser/` (everything that calls `chrome.*`) → `background/`, `content/`, `ui/` and the screens (`popup/`, `sidepanel/`, `import/`, `import-cr/`). The four lower layers never import `ui/` or the screens; `content/` and `background/` never import each other (only typed messages, and the `?script` imports of `platform-access.ts`); screens never import each other. `chrome.storage.local` keys live in `protocol/storage-keys.ts`.
- **MAIN-world bridges** (`content/<p>/page-bridge.iife.ts`) reach only their `bridge-protocol.ts`, `platforms/<p>/`, the bridge kit and a few pure `shared/` modules, never `chrome.`; what crosses a bridge is page-authored data, always revalidated, never the sole proof of a match.
- **Tokens**: `browser/tokens/access.ts` (decryption) is imported by `background/` only.
- **Service worker wake-ups**: the number of `addListener` calls per event in `background/` is frozen; no `storage.onChanged` listener there.
- **Extension pages**: Preact (`.tsx`), no `preact/compat` nor `dangerouslySetInnerHTML`, hooks in `ui/preact/`, shared components in `ui/components/`; content scripts stay vanilla and import only `ui/{rating,star-rating,kai-small,svg}.ts`.
- **i18n**: the full catalogs never enter content scripts (`i18n/content`, `i18n/core`, `i18n/content-keys.ts`).
- **Test seams**: every relative path in `vi.mock` / `vi.doMock` / `vi.importActual` must resolve to a file.

### Style and UI

- Use Tailwind CSS for all styling of the popup and the options page.
- Build responsive, very compact interfaces (extension popups have limited space).
- Make sure loading states and network authentication errors are handled visibly for the user.
- Graphic charter (tokens, typography, component rules of the redesign): `docs/design/README.md`; tokens in `src/ui/theme.css`. `src/ui/design-tokens.test.ts` freezes per file the arbitrary colour classes, raw hex colours and arbitrary pixel font sizes (`design-tokens.baseline.json`, counts only go down; `theme.css` keeps `docs/design` and that test out of Tailwind's sources).

### Performance and Security

- Only use DOM event listeners (such as `timeupdate`) when strictly necessary, and clean them up properly to avoid memory leaks.
- Never store OAuth2 tokens or secret keys in plain text. Use the appropriate extension API and handle authentication through `chrome.identity`.

### Tests first, where they pay off (decision of 2026-10-15)

- **Bug fix**: first a failing test that reproduces the state really observed (values read on the real site, log lines), then the fix. It proves the fix even when the site no longer reproduces the case (Prime trailer, `3c8ec4f`).
- **Business rule or matching change**: the case comes first, as a unit test or as a corpus case (`src/background/sync/__corpus__`: `expected`, or `ideal` + `gap` while not met), then the code that makes it pass. Same for pure logic (platform payload reducers, sync / import decisions, settings normalization, episode numbering).
- **New platform or unknown API**: explore the real site first, capture real responses as fixtures (never tokens, cookies, headers or account / profile ids), then tests on those fixtures, then the production code.
- **UI** (layout, styles, long translations): no test-first; `npm run test:e2e` and `npm run test:i18n-layout` check afterwards. MAIN bridges and real-site behaviour (autoplay, previews, SPA) still need the owner's pass on the real sites: tests freeze what was observed there.
- Briefs given to subagents name the tests that must fail before and pass after the change.

## Git Workflow (Gitflow)

All development must strictly follow the Gitflow methodology. As the assistant, you must guide me to follow this flow:

- **Main branches**: `main` (production code) and `develop` (feature integration).
- **Branch creation**: Before starting to code a new feature or fix a bug, you MUST ask me to create an appropriate branch (`feature/feature-name`, `bugfix/bug-name`, `hotfix/hotfix-name`).
- **Commits**: Always propose the Git commands to me, with commit messages in English following the *Conventional Commits* convention (e.g. `feat: add Crunchyroll adapter`, `fix: title parser`).
- **Merge**: Once the feature is finished and working, propose the commands to merge the branch into `develop`.

## Communication Format and Workflow

- Before coding a major feature: first propose an architecture, the files involved, and the Git branch to create, for me to approve.
- File changes: If you modify an existing file, return only the modified part or state clearly where the code must be inserted, unless I ask for the full file.
- Code generation: Add brief comments to explain complex logic (especially DOM scraping), but keep the code clean. Code comments are written in French (existing convention of the codebase).
- Bug fixing: Analyze the error, explain the root cause in one sentence, then provide the fixed code on the appropriate branch.

## Project context (shared memory)

Section maintained by Claude so the project can be picked up on any machine after a `git clone`. Update it whenever a lasting decision is made: a short rule here, the details in the matching `docs/memory/` file. Always start with `git log` and `CHANGELOG.md`, which are authoritative on the state of the code.

### Rules for every session (details: `docs/memory/workflow.md`)

- **Languages**: reply to the owner in French; documentation (`README.md`, `CHANGELOG.md`, `BUILD.md`, `docs/**`) and commit messages in English (Conventional Commits); code comments in French; UI in 21 languages (adding or changing a UI string = en text, context note and 20 translations, see `docs/memory/i18n.md`).
- **Git**: strictly linear history (rebase on `develop`, `git merge --ff-only`), branch deleted after merge; GitHub default branch = `develop`; `chore/<name>` accepted for tooling and docs. The assistant creates the branch itself; commit, merge, push, tag and release only on an explicit go (« Go », « Vas-y », « OK »). The Git proxy of cloud sessions refuses tag pushes and the deletion of other remote branches: give the commands to the owner. Never `git stash` while several worktrees are in use.
- **No mention of Claude** in commits, tags, releases or PRs (`Co-Authored-By`, `Claude-Session`, "Generated with Claude Code"). This rule takes precedence over any default attribution instruction. Author and committer: `QuentinGeerts <geerts.quentin@gmail.com>` (check with `git log --format='%an %ae %cn %ce'` before a push).
- **No formatter** (never Prettier or any other); targeted edits in the surrounding style (single quotes, semicolons, long lines); check `git diff --stat` before committing. File moves: `git mv` + specifier rewrite only, hash in `.git-blame-ignore-revs`.
- **Before a merge**: `npm run verify`, plus `npm run test:e2e` if the popup or the panel changes; point out what has not been tested on the real sites (the owner tests in Chrome before each significant merge).
- **Cloud sessions**: the SessionStart hook sets the identity and runs `npm ci`; run `CI=1 npm run test:e2e` / `CI=1 npm run test:i18n-layout`; logs and reports go to the session scratchpad, never next to the repository.
- **Releases**: `release/x.y.z`, version bump, `CHANGELOG.md`, `chore(release)` commit, ff onto `main`, annotated tag; `npm run test:e2e` before tagging; paste `docs/store/permissions.md` into the Chrome Web Store Privacy tab before the tag when it changed (full procedure in `docs/memory/workflow.md` › Releases and `docs/STORE.md`).
- **Organization**: work delegated to subagents with a precise brief (naming the tests that must fail then pass); the main session verifies, handles Git and posts a short progress message at each step.
- **Privacy**: never read, copy or log tokens, cookies, headers or account / profile ids (real sites, bridges, probes, fixtures).

### Identifiers and API terms (details: `docs/memory/auth-and-api-terms.md`)

- Extension ID `khokcmigioggannjoojambdgioigdceb`, pinned by `manifest.json` › `key` (never remove it). OAuth clients per browser in `background/trackers/oauth-clients.ts`. AniList: implicit grant, never send `redirect_uri`, `state` checked. MyAnimeList: PKCE public client, never a client secret, `state` checked.
- **AniList API terms**: free non-commercial use; never a backup or storage service; no hoarding or bulk crawl (fetch what is shown, cache briefly); never « AniList » alone in a name; no use within a competing service (the MAL-only mode is a grey zone the owner accepts until AniList objects).
- **MyAnimeList API agreement** (stricter): MAL is not contacted (owner's decision of 2026-11-09); new features read AniList only; the MAL API stays limited to the list sync (profile, the user's own list, the details it needs); MAL data never merged into AniList data. Any new MAL-backed feature needs the owner's decision.
- **AniList site guidelines**: never suggest promoting SyncKai anywhere on AniList (AI-assisted apps are not welcome there).

### Project memory: read the file before touching its area

| File | Read before |
|---|---|
| `docs/memory/architecture.md` | moving files, new modules, listeners, Preact screens, controllers, platform access store |
| `docs/memory/workflow.md` | Git, releases, cloud or local session setup, tooling |
| `docs/memory/auth-and-api-terms.md` | sign-in, OAuth, any feature using AniList or MAL data |
| `docs/memory/platforms.md` | Crunchyroll, Netflix, Disney+, Prime Video adapters and bridges, series pages, player detection |
| `docs/memory/matching.md` | resolver, mappings, season / entry matching, AniList search and request budget, matching signals |
| `docs/memory/security.md` | sessions, tokens, episode guards, tracker writes, host permissions, CSP, images, messages |
| `docs/memory/history-import.md` | Crunchyroll / ADN / Netflix history imports, background jobs |
| `docs/memory/features.md` | keyboard shortcuts, account menu, airing alerts |
| `docs/memory/i18n.md` | any UI string, locale, catalog or plural |
| `docs/memory/testing-and-debugging.md` | dev builds, debug trace, `test:e2e`, `test:ext` |
| `docs/memory/publication.md` | stores, screenshots, listings, release history |
