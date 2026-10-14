# Building SyncKai from source

These instructions reproduce the exact extension package submitted to addons.mozilla.org (AMO) from this source archive.

## Requirements

- Node.js 24 (see `.nvmrc`) and npm 11
- Any OS (Windows, macOS, Linux); no other tool is needed

## Build

```sh
npm ci --ignore-scripts
npm run build:firefox
```

`--ignore-scripts` skips the install scripts of the dependencies. The build needs none of them, and the release workflow (`.github/workflows/release.yml`) builds the submitted package exactly this way. Without it, `npm ci` runs the install script of `puppeteer` (a dev dependency used only by the end-to-end tests), which downloads Chrome and Chrome Headless Shell (several hundred MB) into `~/.cache/puppeteer`.

To keep the other install scripts and only skip that download, use instead:

```sh
PUPPETEER_SKIP_DOWNLOAD=true npm ci                 # macOS, Linux, Git Bash
```

```powershell
$env:PUPPETEER_SKIP_DOWNLOAD = 'true'; npm ci       # Windows PowerShell
```

The Firefox extension is written to `dist-firefox/`. Its contents are the AMO package (`npm run package:firefox` zips the same folder into `release/synckai-<version>-firefox.zip`).

The Chrome build uses `npm run build` (output in `dist/`).

## Reproducibility

Building this archive produces a `dist-firefox/` folder identical, file for file, to the submitted package, whatever folder the archive is extracted to:

- Dependencies are pinned by `package-lock.json` (`npm ci`).
- The only build-time value is the build timestamp. It comes from `SOURCE_DATE_EPOCH` if set, otherwise from the `.source-date-epoch` file shipped in the source archive, otherwise from the last git commit date. Do not set `SOURCE_DATE_EPOCH`: `.source-date-epoch` holds the commit date used for the submitted package.
- Output file names do not depend on the build folder (`vite.config.ts`, `src/build/output-names.ts`).
- Before each submission, the release workflow extracts this archive to another folder, builds it exactly as above, and compares the result with the submitted package (`diff -r`); any difference blocks the submission.
- The code is bundled and minified by Vite 8 (Rolldown) from the TypeScript sources in `src/`; no code is obfuscated or downloaded at build time.

To compare with the submitted package (`synckai-<version>-firefox.zip`), from the extracted archive:

```sh
unzip -q synckai-<version>-firefox.zip -d submitted
diff -r submitted dist-firefox      # no output: identical
```

## Checks (optional)

```sh
npx tsc --noEmit     # type check
npx vitest run       # unit tests
npm run coverage     # unit tests with a coverage report (coverage/index.html), no threshold
npm run lint         # typed lint (typescript-eslint) on src/ and scripts/
npm run lint:firefox # web-ext lint on dist-firefox/
npm run verify:build -- --target firefox  # checks on dist-firefox/: referenced files, web_accessible_resources, permissions, sizes
```

## Extension end-to-end tests (optional)

```sh
npm run test:ext     # builds dist/, then runs scripts/ext-e2e/*.ext.ts
```

These tests load the real built extension (`dist/`) in a real Chromium and drive it through its own pages (popup, a bare extension page for messages and `chrome.storage.local`, a fake Crunchyroll tab for content-script messages). The service worker's network is intercepted with the DevTools `Fetch` domain and answered by stateful fakes of the AniList GraphQL API and the MyAnimeList v2 API (`scripts/ext-e2e/fake-anilist.ts`, `fake-mal.ts`), which check the `Authorization: Bearer` token. Nothing reaches the real network: unexpected requests are refused and fail the test, and DNS resolution is disabled in the browser. Accounts are signed in without OAuth by writing legacy plaintext tokens, which the extension encrypts on first access (`scripts/ext-e2e/seed.ts`).

- **Browser**: a full Chromium or Chrome build is required (`chrome-headless-shell`, used by `test:e2e`, cannot load extensions). Set `SYNCKAI_EXT_CHROME` to its executable; by default the tests use `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` when it exists, otherwise Puppeteer's own Chrome. Running as root adds `--no-sandbox` automatically.
- **Output**: profiles, the copy of the extension under test and failure screenshots go to `SYNCKAI_EXT_E2E_DIR` (default: `synckai-ext-e2e` in the system temp directory), never into the repository. They are deleted after a passing test, kept after a failure (or with `SYNCKAI_EXT_E2E_KEEP=1`).
- **Other build**: `SYNCKAI_EXT_DIST=<dir>` tests another Chrome build directory (the script still rebuilds `dist/`).
- **Extension update**: `chrome.runtime.reload()` leaves an extension loaded with `--load-extension` unloaded in headless Chromium, so the update test relaunches the browser on the same profile with a newer manifest version.
- **Playback** (`playback.ext.ts`): fake Crunchyroll and ADN watch pages (`scripts/ext-e2e/fake-sites.ts`, built from the adapter fixtures in `src/content/adapters/__fixtures__`) are served at their real URLs, so the manifest content script injects for real and tracks a real `<video>`: `scripts/ext-e2e/assets/episode-600s.webm` (600 s, 32×18, 1 frame/s, VP8, no audio, 22 KB; the `ffmpeg` command that produced it is in `fake-sites.ts`), served as a `data:` URL. The test plays it and seeks past the completion point (Crunchyroll credits start served as `static.crunchyroll.com/skip-events`, or the 85 % fallback), like a user clicking the progress bar. The tracker's view is read through the side panel's live port (`synckai:live`), toasts through CDP (closed Shadow DOM). The `Alt+Shift+K` command cannot be pressed (CDP key events never reach `chrome.commands`), so its `FORCE_COMPLETE` message is sent to the tab from an extension page. The background-tab test really waits for the 30 s player timeout (`VIDEO_WAIT_TIMEOUT_MS`).
- **Side panel, import, backup** (`panel.ext.ts`, `import.ext.ts`): the side panel page is opened in a tab of the same window and follows the active tab, like the real panel (Puppeteer cannot open the browser's side panel). History imports run the real import page against fake Crunchyroll and ADN history APIs served in the platform tab (`scripts/ext-e2e/fake-history.ts`). The backup test downloads the real export file (DevTools `Browser.setDownloadBehavior`, temp directory) and imports it into a second, fresh profile.
- **Lists** (`lists.ext.ts`): links to the entry, removal from the list and comments, from the popup and the side panel, against the fakes only. A link click opens a new tab whose URL is checked, then closed before anything loads. For the popup's *On this page* card, the popup page is opened in a background tab so the streaming tab stays the active one.

The tests are not part of `npm run verify` (which only type-checks them) nor of `npm run test:e2e`.
