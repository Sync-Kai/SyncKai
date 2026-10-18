<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/kai-lockup-dark.svg">
    <img src="assets/brand/kai-lockup-light.svg" alt="SyncKai" width="420">
  </picture>
</p>

<p align="center"><strong>Watch anime on Crunchyroll, ADN, Netflix, Disney+ or Prime Video. Your AniList and MyAnimeList lists update themselves when the credits roll.</strong></p>

<p align="center"><a href="https://synckai.app/en/">synckai.app</a> · <a href="https://synckai.app/en/changelog">What's new</a></p>

<p align="center">
  <a href="https://github.com/Sync-Kai/SyncKai/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/Sync-Kai/SyncKai?label=release"></a>
  <a href="https://chromewebstore.google.com/detail/synckai/khokcmigioggannjoojambdgioigdceb"><img alt="Chrome Web Store" src="https://img.shields.io/chrome-web-store/v/khokcmigioggannjoojambdgioigdceb?label=chrome%20web%20store"></a>
  <a href="https://addons.mozilla.org/firefox/addon/synckai/"><img alt="Firefox Add-ons" src="https://img.shields.io/badge/firefox-add--ons-FF7139?logo=firefoxbrowser&logoColor=white"></a>
  <a href="https://github.com/Sync-Kai/SyncKai/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Sync-Kai/SyncKai/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
</p>

<p align="center">
  <img src="docs/store/screenshots/en/01-sync-at-credits.png" alt="SyncKai saving an episode to AniList and MyAnimeList as the credits start" width="800">
</p>

**SyncKai** is a browser extension for Chrome and Firefox that keeps your anime list up to date without any manual input. Start an episode on Crunchyroll, ADN or (optionally) Netflix, Disney+ and Prime Video: SyncKai recognizes the series, finds the right entry, and saves your progress to AniList and/or MyAnimeList as soon as the ending credits start. It runs entirely in your browser, with no account of its own and no server.

## Contents

- [Install](#install)
- [Features](#features)
- [Supported platforms and trackers](#supported-platforms-and-trackers)
- [How it works](#how-it-works)
- [Privacy](#privacy)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Install

| Browser | Store | Minimum version |
| --- | --- | --- |
| Chrome | [Chrome Web Store](https://chromewebstore.google.com/detail/synckai/khokcmigioggannjoojambdgioigdceb) | Chrome 116 |
| Firefox (desktop) | [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/synckai/) | Firefox 142 |

Other Chromium-based browsers (Edge, Brave, Opera…) install SyncKai from the Chrome Web Store. Chrome is the primary test target.

Then click the SyncKai icon, connect AniList and/or MyAnimeList (each account is optional), and watch an episode as usual.

> [!NOTE]
> AniList and MyAnimeList sign-in is only allowed for the official extension IDs. Store installs and local builds of this repository work. The Chrome zip attached to a GitHub release has no `key`: loaded by hand, it gets a different ID and cannot sign in.

## Features

**Sync**

- Automatic sync at the start of the credits (Crunchyroll, Netflix, Prime Video), or at an adjustable percentage of the episode (70–98%, 85% by default).
- AniList and MyAnimeList, together or separately.
- Season matching that handles absolute numbering (One Piece episode 1180) as well as seasons split across several entries.
- *To check* cards: when a match is uncertain, you pick the right entry once and SyncKai remembers it. Nothing is sent blindly.
- Safeguards against forged pages: a burst of finished episodes or a jump straight to the last episode asks for a check instead of writing.
- Netflix support, off by default and limited to anime: only series linked to their Netflix title on AniList are synced.
- Disney+ support, off by default and limited to Japanese anime: only series whose AniList entry carries the same title and a Disney+ link are synced.
- Prime Video support (primevideo.com), off by default and limited to anime: titles Prime Video labels anime, or animation offered with Japanese audio; other animation only on an exact AniList title match.

**Your lists**

- *My series* (popup, *Watching* tab): series in progress with a progress bar, the next episode ("Ep. 5 in 18 h"), sorting, discreet −/+ and your preferred player's logo to resume the series. The list follows the *Default entry page* account (*Settings › Accounts*).
- *Resume*: off the streaming sites, the series you watched last, ready to reopen.
- *On this page*: the AniList entry of the series or episode you are on; change progress, status, season, score or your comment without leaving the page.
- The ⋯ menu of each series: on hold, dropped, completed (confirmed first), comment, *Open entry ›* and *Search on… ›* (hover sub-menus), stop syncing the series, remove it from your list.
- Click a title or cover to open its AniList or MyAnimeList page.
- Status bar at the bottom of the popup and the side panel: the series and episode just synced ("2 episodes synced" during autoplay), a running import or alignment with its progress, a session to reconnect.
- Account menu (click an account's logo): avatar, profile stats (anime, episodes, days watched) and the episodes synced this week.
- Compare AniList and MyAnimeList: spots differences in progress, status, score and missing series, and aligns them on demand, never automatically (*Settings › My data*).
- End-of-series rating with 10 stars (half stars included), converted to your AniList score format, and rewatch detection.

**Side panel and schedule**

- Side panel (sidebar on Firefox) available on any page, opened only by you: from the popup or with <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>1</kbd> (press again to close). On Chrome and Brave it stays open across tabs and follows the active tab.
- Off the streaming sites it opens on *Schedule*; *Now playing* shows the supported platforms and turns Netflix, Disney+ or Prime Video on in one click.
- *Now playing* (Crunchyroll, ADN, Netflix, Disney+, Prime Video): the episode's AniList entry, live progress with the credits marker ("Sync in 2 min 10"), *Your list* with its actions, then folding sections for rating and comment, synopsis, sequels with a *Watch* button and the episode discussion.
- *Schedule*: this week's releases for the series you're watching, Monday to Sunday, at the estimated time on your platform and with watched episodes ticked off. *Adjust time* sets a delay per series; *Settings › Platforms* sets one per platform (−/+ by 15 min or typed). A month calendar jumps to any week, one request per week chosen.
- New episode alerts as browser notifications, at the time the Schedule shows (plus an optional extra delay).

**Import and backup**

- History import from Crunchyroll, ADN or Netflix (*Settings › My data › Import a watch history*, then pick the platform): reads your history in your own browser tab, shows a preview, then updates AniList and MyAnimeList in the background. It never moves progress backwards, only counts finished episodes, and asks for a review when in doubt. On Netflix, it loads the *Viewing activity* page with the site's own *Show more* button and keeps only anime (series linked to Netflix on AniList, or with the same title, which go to *To check*).
- Backup: export and import your settings, matches and history (never your sign-ins).

**Privacy and reliability**

- No server, no analytics: data only goes to AniList and MyAnimeList.
- Offline queue: if the network or a service is down, pending syncs are retried automatically.
- On-page notifications over the player, in the top-right corner and fullscreen-friendly: what happened ("Episode 6 saved"), the series and episode, one line per service with its logo. Three styles (Discreet, Detailed, Alerts only); the timer pauses while you hover them.
- Keyboard shortcuts, the same on Chrome, Brave and Firefox: <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> to mark the current episode as watched, <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>1</kbd> to open or close the side panel (<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>&</kbd> on AZERTY: same key). *Settings › Display › Shortcuts* shows the current keys and opens the browser's shortcuts page to change them (`chrome://extensions/shortcuts`; Firefox: `about:addons` › gear icon › *Manage Extension Shortcuts*). Already installed? A key you changed is kept on update; if a key is missing, set it there.
- Per-series exclusion (*Settings › Sync › Excluded series*). Settings in seven categories (Accounts, Sync, Platforms, Notifications, Display, My data, Help & about) with quick toggles, in the popup and the side panel.
- Interface in 21 languages: English, French, German, Spanish (Spain and Latin America), Brazilian Portuguese, Italian, Dutch, Russian, Ukrainian, Polish, Czech, Romanian, Swedish, Turkish, Indonesian, Vietnamese, Chinese (Simplified and Traditional), Korean and Japanese; the browser language is used by default, or the one chosen in *Settings › Display › Language*.

<table>
  <tr>
    <td><img src="docs/store/screenshots/en/02-side-panel.png" alt="Side panel, Now playing tab"></td>
    <td><img src="docs/store/screenshots/en/03-agenda.png" alt="Side panel, Schedule tab"></td>
  </tr>
  <tr>
    <td><img src="docs/store/screenshots/en/04-page-media.png" alt="On this page: the AniList entry of the current series"></td>
    <td><img src="docs/store/screenshots/en/05-cr-import.png" alt="Crunchyroll history import preview"></td>
  </tr>
</table>

## Supported platforms and trackers

| Streaming platform | End of episode detected at | Notes |
| --- | --- | --- |
| [Crunchyroll](https://www.crunchyroll.com) | Start of the credits (percentage fallback) | History import available |
| [ADN](https://animationdigitalnetwork.com) | Adjustable percentage | History import available |
| [Netflix](https://www.netflix.com) | Start of the credits (percentage fallback) | Optional, anime only; history import available |
| [Disney+](https://www.disneyplus.com) | Adjustable percentage | Optional, Japanese anime only |
| [Prime Video](https://www.primevideo.com) | Start of the credits (percentage fallback) | Optional, anime only, primevideo.com only |

| Tracker | Sign-in |
| --- | --- |
| [AniList](https://anilist.co) | OAuth2 (implicit grant) |
| [MyAnimeList](https://myanimelist.net) | OAuth2 with PKCE, no client secret |

**Netflix** is off by default. Turn it on in *Settings › Platforms*: the browser then asks for access to netflix.com, and turning it off removes that access. Since Netflix does not label anime, only series whose AniList entry links to the Netflix title are synced. A series found by title alone goes through a *To check* card, and other titles are silently ignored.

**Disney+** is off by default too (*Settings › Platforms*, access to disneyplus.com). Only titles whose original language is Japanese are considered; the others are ignored in the page without being sent anywhere. Disney+ gives no series ID on its player page, so the English series title (season 99 arcs by their own title) is matched against AniList, and a match is trusted only if that entry links to Disney+; otherwise it goes through *To check*. SyncKai sends no request to Disney+: it reads the response the player already receives, and the position from the player's progress bar. In a Disney+ tab opened before turning it on (or before an update), tracking starts with the next episode.

**Prime Video** is off by default too (*Settings › Platforms*, access to primevideo.com; the amazon.<tld> sites are not supported). SyncKai reads the title's data the page already holds (genres, Japanese audio track, season and episode list) and, through a passive script, the responses the player already receives (episode playing, end-credits time); it sends no request to Prime Video. Titles Prime Video labels anime, or animation offered with Japanese audio, are matched against AniList as usual; other animation is synced only when an AniList anime has exactly the same title, and anything else is ignored in the page without being sent anywhere.

## How it works

1. A content script, with one adapter per platform (`src/content/<platform>/adapter.ts`), reads the series, season and episode number from the playback page and watches the video position.
2. The service worker matches the episode to an AniList entry, mapping platform seasons to AniList entries and converting per-season or absolute numbering. The MyAnimeList entry is resolved from the AniList one.
3. When the credits start (or the threshold is reached), the new progress is written to each connected service. It never goes backwards, and failed writes wait in a retry queue.
4. If the match is uncertain, nothing is written: a *To check* card lets you choose the entry, and the choice is remembered.

## Privacy

SyncKai has no server and collects no usage data.

- Settings, matches and history stay in the extension's local storage.
- OAuth tokens are stored encrypted (AES-GCM, non-exportable key) and only sent back to the service that issued them.
- The extension only contacts AniList, MyAnimeList and the streaming sites you use (Crunchyroll credit markers, your Crunchyroll, ADN or Netflix history when you start an import, Netflix episode metadata when Netflix is turned on). On Disney+ and Prime Video, nothing is requested: SyncKai only reads what the page and the player already receive. The same goes for the Crunchyroll season data (year, episode count, runtime) used to tell same-title series apart: read from the site's own responses, never its request headers or your token.

Permissions: `storage`, `identity` (sign-in), `alarms` (release alerts, retries), `notifications`, `sidePanel`, `scripting`, host access to Crunchyroll, ADN, AniList and MyAnimeList, and optional access to Netflix, Disney+ and Prime Video.

Full details in [PRIVACY.md](PRIVACY.md).

## Development

**Requirements**: Node.js 24 (see [`.nvmrc`](.nvmrc)) and npm 11.

```sh
npm ci                  # install dependencies
npm run dev             # development build with hot reload (Vite + @crxjs/vite-plugin)
npm run build           # production build for Chrome, in dist/
npm run build:firefox   # production build for Firefox, in dist-firefox/
npm run build:dev       # Chrome build with info/debug logs in the console
npm test                # unit tests (Vitest)
npm run test:e2e        # end-to-end tests of the popup, side panel, import and backup pages (Puppeteer, headless Chrome)
npm run test:i18n-layout # layout check of every screen in the 21 languages
npm run test:ext        # end-to-end tests of the built extension in Chromium, fake AniList / MAL (see BUILD.md)
npm run verify          # type check, tests, both builds, build checks and lint
```

`npm ci` downloads a headless Chrome for the end-to-end tests. To skip it, see [BUILD.md](BUILD.md). If `npm run test:e2e` cannot find a browser, run `npx puppeteer browsers install chrome-headless-shell`.

**Load the extension**

- Chrome: open `chrome://extensions`, enable *Developer mode*, click *Load unpacked* and select `dist/`.
- Firefox: open `about:debugging#/runtime/this-firefox`, click *Load Temporary Add-on* and select `dist-firefox/manifest.json`.

The repository manifest keeps the Chrome Web Store public key and the Firefox add-on ID, so local builds get the official extension IDs and can sign in to AniList and MyAnimeList. After reloading the extension, reopen the player tab.

**Project structure**

```
src/
├── background/   service worker: OAuth, AniList/MAL clients (anilist/, mal/), matching (sync/), sync queue, imports, alerts
├── content/      content scripts: one folder per platform (crunchyroll/, adn/, netflix/, disney/, prime/) with its adapter and, for the bridged ones, its page bridge
├── popup/        extension popup (Preact)
├── sidepanel/    side panel: Now playing, Schedule (Preact)
├── import-cr/    history import page: Crunchyroll, ADN, Netflix (Preact)
├── import/       backup page (Preact)
├── ui/           shared interface: Preact components (components/), Settings (settings/), hooks, controllers
├── shared/       types, guards and pure logic shared by all contexts (no browser API)
├── protocol/     contracts between contexts (messages, ports, storage keys)
├── platforms/    what is known about each platform (registry, links, metadata reducers)
├── browser/      everything that calls chrome.* (storage/, tokens/, permissions, side panel, logger)
└── i18n/         translations (locales/en.json, fr.json, de.json…)
```

The extension pages use Preact and Tailwind CSS, following the graphic charter in [docs/design/README.md](docs/design/README.md); content scripts stay plain TypeScript. Store names and descriptions live in `public/_locales/`.

- [BUILD.md](BUILD.md): reproducible build of the Firefox package.
- [docs/STORE.md](docs/STORE.md): packaging and release process (Chrome Web Store, Firefox Add-ons, GitHub Actions).
- [CHANGELOG.md](CHANGELOG.md): release history.

## Contributing

Bug reports and suggestions are welcome in [GitHub Issues](https://github.com/Sync-Kai/SyncKai/issues). When reporting a bug, attach the diagnostic report (*Settings › Help & about › Copy the report*). It contains no sensitive data.

Pull requests are welcome too, including translations (`src/i18n/locales/`). Please run `npm run verify` before opening one.

## License

[MIT](LICENSE) © 2026 Quentin Geerts

SyncKai is not affiliated with Crunchyroll, ADN, Netflix, Disney+, Prime Video, Amazon, AniList or MyAnimeList.
