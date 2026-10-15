# Publishing to the Chrome Web Store and Firefox Add-ons

Step-by-step procedure to publish SyncKai (first submission, then updates). Sections 1 to 6: Chrome Web Store; Firefox Add-ons (AMO): section 7 and [docs/store/amo.md](store/amo.md).

## 1. Build the archive

```bash
npm run package
```

Produces `release/synckai-<version>-chrome.zip` (contents of `dist/` at the root). The script:

- checks that the version in `dist/manifest.json` = the version in `package.json`;
- **removes the `key` field** from the manifest (the Web Store rejects it: the ID is assigned by the store);
- rejects the archive if `dist/` contains source maps (`*.map`), a file > 10 MB, or if `_locales/{en,fr,de}/messages.json` is missing.

## 2. First upload (unlisted draft)

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one-time $5 registration fee if the account is not activated yet).
2. **New item** → upload `release/synckai-<version>-chrome.zip`.
3. **Distribution** tab → visibility **Unlisted** for the first version: the extension is only reachable through its link while OAuth is validated in real conditions.
4. **Do not submit yet**: the OAuth redirects must be updated first (step 4).

## 3. Store listing

Fill in the **Store listing** and **Privacy** tabs with:

| Content | File |
| --- | --- |
| French listing | [docs/store/listing-fr.md](store/listing-fr.md) |
| English listing | [docs/store/listing-en.md](store/listing-en.md) |
| German listing | [docs/store/listing-de.md](store/listing-de.md) |
| Permission justifications | [docs/store/permissions.md](store/permissions.md) |

**Images** (**Store listing** tab; details and regeneration: [docs/store/screenshots.md](store/screenshots.md)):

| Dashboard field | File | Languages |
| --- | --- | --- |
| *Store icon* (128×128) | `docs/store/icon-128.png` | all |
| *Screenshots* (1280×800, 5 max, in order 01 → 05) | `docs/store/screenshots/<language>/0N-*.png` | one set per language (listing language selector) |
| *Graphic assets › Small promo tile* (440×280) | `docs/store/promo-440x280.png` | not localizable |
| *Graphic assets › Marquee promo tile* (1400×560) | `docs/store/promo-1400x560.png` | not localizable (English) |

Screenshots and the marquee tile are regenerated with `npm run screenshots` (the popup version is read from `manifest.json`: rerun after every version bump).

- **Privacy policy URL**: `https://github.com/Sync-Kai/SyncKai/blob/main/PRIVACY.md`
- Declare the data handled (Privacy tab) in line with `PRIVACY.md` and check the usual certifications (no sale of data, no use outside the feature).

## 4. ID change (AniList + MAL OAuth)

The ID assigned by the store differs from the local build's: the OAuth redirects (`https://<ID>.chromiumapp.org/`) must follow.

1. After the first upload, copy the **Item ID** shown in the dashboard (32 letters a–p).
2. **AniList** → [Developer settings](https://anilist.co/settings/developer) → client **52346** → replace the **Redirect URL** with `https://<ID>.chromiumapp.org/`.
3. **MyAnimeList** → [API config](https://myanimelist.net/apiconfig) → app (Client ID `84d05521…`) → replace the **App Redirect URL** with the same URL `https://<ID>.chromiumapp.org/`.
4. Dashboard → **Package** tab → **Public key** → copy the key (without the `-----BEGIN/END PUBLIC KEY-----` lines, on a single line) into the `key` field of the project's `manifest.json`. The local build then gets the same ID as the store version (the field is removed automatically by `npm run package`).
5. `npm run build`, then `chrome://extensions` → **Reload** the unpacked extension; check that the displayed ID matches the Item ID.
6. **Log out, then log back in** to AniList and MyAnimeList in the settings to validate the new redirects.

### OAuth clients per browser

Each browser assigns its own extension ID, hence its own redirect URL. An AniList client accepts a single Redirect URL (and SyncKai never sends `redirect_uri`): you need **one AniList client and one MAL app per browser**. The ID → clients mapping lives in `src/background/trackers/oauth-clients.ts`; an ID missing from the table shows "Sign-in isn't configured for this browser" with the URL to register (also logged as a warning).

| Browser | Extension ID | Redirect URL | AniList client | MAL app |
| --- | --- | --- | --- | --- |
| Chrome (Web Store) | `khokcmigioggannjoojambdgioigdceb` | `https://khokcmigioggannjoojambdgioigdceb.chromiumapp.org/` | `52346` | `84d05521c007a529cc458421bd0940c5` |
| Firefox (AMO) | `synckai@sync-kai.github.io` | `https://01497c3a0de229567af456487a2af9d686551088.extensions.allizom.org/` (SHA-1 of the ID, checked with `chrome.identity.getRedirectURL()`) | `52509` ("SyncKai Firefox") | `1846238e6ea67a5109899f5311a51d15` |

## 5. Submission

1. Dashboard → **Submit for review**.
2. Typical review time: from a few hours to **1–3 business days**; longer (up to 1–2 weeks) for a first submission or when broad host permissions are requested.
3. Once approved and tested as unlisted, switch the visibility to **Public** if desired.

## 6. Updates

Updates are published automatically by GitHub Actions (section 7). Manual fallback procedure:

1. Bump the version in `package.json` **and** `manifest.json` (the script refuses if they differ).
2. `npm run package`.
3. Dashboard → **Package** → **Upload new package** → upload the new zip → **Submit for review**.

The ID no longer changes: no OAuth change is needed for updates.

### Crunchyroll client ID (history import)

The history import asks Crunchyroll for a temporary token (`POST /auth/v1/token`, `grant_type=etp_rt_cookie`, the site's session cookie) with the **public** client ID of Crunchyroll's website: `CR_WEB_CLIENT_ID` in `src/content/crunchyroll/history.ts`. It is not a secret (it appears in the site's code), but Crunchyroll may change it. Live sync does not depend on it.

**Symptom**: the import shows "Import unavailable" to a user signed in to Crunchyroll; in the Crunchyroll tab's console, `Lecture de l’historique impossible (unavailable)` (logged in French), and in the Network tab, `/auth/v1/token` returns 400 or 401 with `invalid_client`, `unauthorized_client` or `invalid_request`. (`invalid_grant` or a 401 with no reason means "signed out": that is not a rotation.)

**Update** (branch `hotfix/cr-client-id`, patch version):

1. Open `https://www.crunchyroll.com/` signed in, developer tools › **Network**, reload the page and filter on `auth/v1/token`.
2. In the site's POST request, read the `Authorization: Basic …` header and decode it (`atob('…')` in the console): the part before `:` is the new client ID (the secret is empty). Check that the body still uses `grant_type=etp_rt_cookie`.
3. Replace `CR_WEB_CLIENT_ID`, then `npx vitest run src/content/crunchyroll/history.test.ts`.
4. Test a real import in Chrome and Firefox (signed-in Crunchyroll tab), then publish the patch version.

No permission or store justification changes: `docs/store/permissions.md` and `PRIVACY.md` describe the public client ID without quoting it.

## 7. Automated publishing (GitHub Actions)

### Workflows

- **`.github/workflows/ci.yml`**: on every push to `main`/`develop` and on every pull request, type-checks (`src` and `scripts`), runs the tests, the Chrome and Firefox builds and `web-ext lint`.
- **`.github/workflows/release.yml`**: on every pushed `vx.y.z` tag, four jobs:

  ```text
  build ──┬── chrome ───┬── github-release
          └── firefox ──┘
  ```

  1. **build**: checks that the tagged commit is contained in `origin/main` (`git merge-base --is-ancestor`, otherwise nothing is uploaded) and that the tag version = `package.json` = `manifest.json`, installs the dependencies without install scripts (`npm ci --ignore-scripts`), runs the tests (including `scripts/store-permissions.test.ts`: every manifest permission has its justification in `docs/store/permissions.md`) and the end-to-end tests (headless Chrome at the version pinned by `puppeteer` in the lockfile: `chrome-headless-shell@pinned`), then `npm run package:all` → `release/synckai-<version>-chrome.zip`, `-firefox.zip` and `-source.zip` (`git archive` of the tag), `web-ext lint` and the notes extracted from `CHANGELOG.md` (`scripts/changelog-notes.ts`). Everything is passed to the next jobs (`release` artifact).
  2. **chrome**: uploads the Chrome archive to the Chrome Web Store and **submits it for review** (`chrome-webstore-upload-cli`): the version goes live automatically once approved.
  3. **firefox** (in parallel): `web-ext sign --channel listed` uploads the Firefox package **and the source archive** to AMO, then submits it for review without waiting (`--approval-timeout 0`): AMO publishes the version once approved. The full listing (`docs/store/amo-metadata.json`) is only sent while the add-on is not public; after that, only the version metadata (license, reviewer notes) is sent, so manual edits made on AMO are not overwritten. The add-on status is read from AMO's public API: 200 → public add-on; 401, 403 or 404 → missing or not public; any other code (5xx, 429, timeout, after 3 attempts) fails the job without uploading anything.
  4. **github-release**: if the Chrome Web Store accepted the version (even if AMO failed), creates the GitHub release with the three zips, the changelog notes and a status line ("Chrome Web Store: submitted for review · Firefox (AMO): …"). If the release already exists (created by hand, run restarted), it updates it (`gh release edit`, then `gh release upload --clobber`) instead of failing.

Each job only has the permissions it needs (`contents: write` only for the GitHub release). The **chrome** and **firefox** jobs run in the `stores` GitHub environment (store secrets restricted to `v*` tags, see *GitHub settings* below) and only run tools from the lockfile: `chrome-webstore-upload-cli` and `web-ext` are exact-version devDependencies, installed by `npm ci --ignore-scripts` and launched with `npx --no-install` (never resolved from the npm registry during the run). To update them: `npm install --save-dev --save-exact <package>@<version>`, on a `chore/…` branch. `package.json` › `overrides` forces `shell-quote` to 1.11.0 (critical vulnerability GHSA-pqg4-j6r4-53mv), because web-ext 10.7.0 pins `fx-runner` 1.6.0, which pins `shell-quote` 1.10.0. Remove the override as soon as a web-ext version ships `fx-runner` 1.7.0 or later. Still known and unpatched: `node-forge` (GHSA-86w9-cpqp-85rv, via `@devicefarmer/adbkit`), which is only used by `web-ext run` on Android and is never called by `lint` or `sign`. Each store checks its own secrets and fails with the list of missing names.

**If something fails**:

- **Secrets or transient outage**: fix it, then *Actions › run › Re-run failed jobs* (only reruns the failed jobs and those depending on them; a store that already accepted the version is not uploaded to again).
- **Code fix**: delete the tag (`git push --delete origin vx.y.z`, `git tag -d vx.y.z`), recreate it and push it again. If a store already accepted the version, it will reject this new upload (same number): prefer a new patch version.
- **Chrome Web Store failed**: no GitHub release, no announcement of a version missing from the Store. Do not create the release by hand with "Chrome Web Store: submitted for review" until the version has actually been submitted.
- **Chrome Web Store rejected: "Your submission does not meet the requirements to be published"**: a permission or host has no justification in the dashboard's **Privacy practices** tab (the case of 2.0.0 and 2.1.0). The package is uploaded but not submitted; AMO, in parallel, has usually already accepted the version. Recovery:
  1. Dashboard → **Privacy practices** tab → paste the blocks from [docs/store/permissions.md](store/permissions.md) (justification of each permission, single host field) → **Save draft**.
  2. **Either** *Actions › run › Re-run failed jobs*, without submitting anything in the dashboard: the `chrome` job uploads the same zip again (it replaces the unpublished draft, to be confirmed the first time this happens) and submits it, then `github-release` creates the release. AMO is not uploaded to again (job succeeded).
  3. **Or**, if this new upload is rejected or if the version was already submitted by hand (**Submit for review** in the dashboard; any upload is then rejected during the review): do not rerun, create the GitHub release from the run artifact:

     ```bash
     gh run download <run-id> --repo Sync-Kai/SyncKai -n release -D release-x.y.z
     printf '\n---\n\nChrome Web Store: submitted for review · Firefox (AMO): submitted for review\n' >> release-x.y.z/notes.md
     gh release create vx.y.z release-x.y.z/synckai-x.y.z-{chrome,firefox,source}.zip \
       --repo Sync-Kai/SyncKai --title "SyncKai x.y.z" --notes-file release-x.y.z/notes.md --verify-tag
     ```

     Adjust the AMO status to the result of the `firefox` job. A later *Re-run* of `github-release` would update this release instead of failing.
  4. Prevention: `scripts/store-permissions.test.ts` turns CI red as soon as a permission is added without a section in `permissions.md`; copy these blocks into the Privacy practices tab **before** the tag (see *Release routine*).
- **Tag not on `main`** (the `build` job reports that the tag is not on main): nothing is uploaded. Delete the tag (`git push --delete origin vx.y.z`, `git tag -d vx.y.z`), merge the release into `main` (`--ff-only`), tag the `main` commit again and push.
- **AMO status unknown** (HTTP 5xx, 429, timeout): transient AMO outage, nothing was sent to AMO; *Re-run failed jobs* later.
- **AMO rejects the metadata** ("Submission failed (2): Bad Request", for instance `approval_notes` over 3000 characters, the case of 2.2.0): a *Re-run* would send the tag's file again, hence the same error. Fix `docs/store/amo-metadata.json` on `develop` (`scripts/store-listing.test.ts` checks the limits), then upload the version by hand: Developer Hub › *Submit a New Version* › `synckai-x.y.z-firefox.zip` from the GitHub release (`gh release download vx.y.z --pattern "*.zip" --dir release`), **answer Yes to the source code question** and attach `synckai-x.y.z-source.zip`, paste the fixed reviewer notes (with the real tag instead of `vX.Y.Z`).
- **Only AMO failed**: the GitHub release is created with "Firefox (AMO): failed, will be resubmitted"; rerun the `firefox` job (*Re-run failed jobs*) or upload `release/synckai-<version>-firefox.zip` + `-source.zip` by hand on the [Developer Hub](https://addons.mozilla.org/developers/addons). Fix the release status line by hand (`gh release edit`).

### Setup (one time)

1. **Google Cloud project**: [console.cloud.google.com](https://console.cloud.google.com/) → create a project (e.g. "SyncKai Store") with the Google account that owns the Store developer account.
2. **API**: *APIs & Services › Library* → enable the **Chrome Web Store API**.
3. **OAuth consent screen**: user type **External**, fill in the app name and contact email, then set the publishing status to **In production**. In *Testing* mode, Google revokes refresh tokens after **7 days**: automated publishing would fail the following week. No Google verification is needed for personal use (only the "Google hasn't verified this app" warning shows during authorization).
4. **Credentials**: *APIs & Services › Credentials › Create credentials › OAuth client ID* → application type **Desktop app** → note the **Client ID** and the **Client secret**.
5. **Refresh token**: locally, `npx chrome-webstore-upload-keys`, enter the Client ID and Client secret, then allow access in the browser that opens (Store owner account); the tool prints the **refresh token**. Full guide: [fregante/chrome-webstore-upload-keys](https://github.com/fregante/chrome-webstore-upload-keys).
6. **Publisher ID**: the developer account ID (different from the extension ID), visible in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) URL once signed in (`…/devconsole/<publisher-id>`). Required by the Chrome Web Store API v2.
7. **GitHub secrets**: repository → *Settings › Secrets and variables › Actions › New repository secret*:

   | Secret | Value |
   | --- | --- |
   | `CWS_CLIENT_ID` | OAuth Client ID |
   | `CWS_CLIENT_SECRET` | OAuth Client secret |
   | `CWS_REFRESH_TOKEN` | Refresh token (step 5) |
   | `CWS_PUBLISHER_ID` | Publisher ID (step 6) |
   | `AMO_JWT_ISSUER` | Firefox Add-ons: *JWT issuer* (step 8) |
   | `AMO_JWT_SECRET` | Firefox Add-ons: *JWT secret* (step 8) |

   The workflow fails with an explicit message if any of them is missing. The extension ID (Chrome) and the Gecko ID (`synckai@sync-kai.github.io`, Firefox) are public constants of the workflow. Repository secrets can still be read by the jobs of the `stores` environment; moving them into the environment is recommended (*GitHub settings* below).
8. **AMO API keys**: sign in to [addons.mozilla.org](https://addons.mozilla.org/) with the Firefox developer account, then [Developer Hub › Manage API Keys](https://addons.mozilla.org/developers/addon/api/key/) → accept the distribution agreement if asked → **Generate new credentials**: copy the *JWT issuer* (`user:…`) into `AMO_JWT_ISSUER` and the *JWT secret* into `AMO_JWT_SECRET`. These keys do not expire but can be revoked and regenerated from the same page.

### GitHub settings (one time, by hand)

Applied on 2026-10-11 (checked through the GitHub API). The workflow would work without these settings (GitHub creates the `stores` environment on the first run, without restrictions), but they are what restricts the store secrets to version tags:

- [x] **`stores` environment**: *Settings › Environments › New environment* → `stores` → *Deployment branches and tags* → **Selected branches and tags** → *Add deployment branch or tag rule* → type **Tag**, pattern `v*`, no branch. Optional: *Required reviewers* (yourself) to approve each store upload.
- [x] **Secrets in the environment**: recreate the six secrets (`CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID`, `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`) in *Environments › stores › Environment secrets*, then delete the repository secrets (*Settings › Secrets and variables › Actions › Repository secrets*). As long as they are at repository level, any workflow can read them.
- [x] **Tag ruleset**: *Settings › Rules › Rulesets › New ruleset › New tag ruleset* → name "Tags de version" (the existing ruleset's name), *Enforcement status* **Active**, target *Include by pattern* `v*` → **Restrict creations**, **Restrict updates**, **Restrict deletions**, **Block force pushes** → *Bypass list*: **Repository admin** (the owner tags and can delete a broken tag).
- [x] **`main` ruleset** (recommended: the `merge-base` check relies on `main`): *New branch ruleset* → target `main` → **Restrict deletions**, **Block force pushes**, without requiring a pull request (the routine pushes as a fast-forward).
- [x] **Releases v2.0.0 and v2.1.0**: created by hand with the status line « Chrome Web Store : soumis pour examen » ("submitted for review") while the `chrome` job had failed. If these versions were not submitted afterwards from the dashboard, fix the status line (`gh release edit vx.y.z --notes-file …`).

### First Firefox submission (AMO)

The add-on does not exist on AMO yet: the first pushed tag creates it (*listed* channel, public listing after review).

1. The `firefox` job sends the listing from `docs/store/amo-metadata.json` (name, summary and description in en-US/fr/de, categories, MIT license, homepage, support, reviewer notes) with the package and the source archive.
2. Then complete the listing by hand in the Developer Hub (icon, screenshots, privacy policy, support email): see [docs/store/amo.md](store/amo.md).
3. **Review**: *listed* versions go through automatic validation then, depending on the case, a human review (often a few hours to a few days; longer for a new add-on or minified code). The reviewer rebuilds the package from the source archive with `BUILD.md` (`npm ci --ignore-scripts && npm run build:firefox`): the build must be identical, hence the `.source-date-epoch` added by `npm run package:source`.
4. Firefox OAuth redirects only depend on the Gecko ID: no AniList/MAL change after publishing (see *OAuth clients per browser*, section 4).

### Release routine

Before the tag: if the permissions changed since the previous version (`git diff vPREVIOUS -- manifest.json docs/store/permissions.md`), paste the changed blocks of `docs/store/permissions.md` into the **Privacy practices** tab of the Chrome Web Store dashboard and save. Otherwise, the Chrome submission is rejected while AMO has already received the version (see *If something fails*).

```bash
git checkout -b release/x.y.z develop
npm version x.y.z --no-git-tag-version   # package.json + package-lock.json
# bump "version" in manifest.json, add the ## [x.y.z] section and its link to CHANGELOG.md
git commit -am "chore(release): x.y.z"
git checkout main && git merge --ff-only release/x.y.z
git tag -a vx.y.z -m "SyncKai x.y.z"
git checkout develop && git merge --ff-only main
git branch -d release/x.y.z
git push origin main develop vx.y.z      # triggers release.yml: Chrome Web Store + AMO, then GitHub release
```

Follow the run in the repository's **Actions** tab. The Chrome Web Store rejects a new upload while a previous version is still under review; AMO accepts a new version while the previous one is under review, but rejects a version number that was already uploaded.
