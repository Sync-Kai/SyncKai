# Building SyncKai from source

These instructions reproduce the exact extension package submitted to addons.mozilla.org (AMO) from this source archive.

## Requirements

- Node.js 24 (see `.nvmrc`) and npm 11
- Any OS (Windows, macOS, Linux); no other tool is needed

## Build

```sh
npm ci
npm run build:firefox
```

The Firefox extension is written to `dist-firefox/`. Its contents are the AMO package (`npm run package:firefox` zips the same folder into `release/synckai-<version>-firefox.zip`).

The Chrome build uses `npm run build` (output in `dist/`).

## Reproducibility

- Dependencies are pinned by `package-lock.json` (`npm ci`).
- The only build-time value is the build timestamp. It comes from `SOURCE_DATE_EPOCH` if set, otherwise from the `.source-date-epoch` file shipped in the source archive, otherwise from the last git commit date. Two builds of the same source therefore produce identical files.
- The code is bundled and minified by Vite 8 (Rolldown) from the TypeScript sources in `src/`; no code is obfuscated or downloaded at build time.

## Checks (optional)

```sh
npx tsc --noEmit     # type check
npx vitest run       # unit tests
npm run lint:firefox # web-ext lint on dist-firefox/
```
