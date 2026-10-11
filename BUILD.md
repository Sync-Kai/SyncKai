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
npm run lint:firefox # web-ext lint on dist-firefox/
npm run verify:build -- --target firefox  # checks on dist-firefox/: referenced files, web_accessible_resources, permissions, sizes
```
