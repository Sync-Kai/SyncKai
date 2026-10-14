# Prime Video: technical exploration

Date: 2026-10-14. Branch `chore/prime-video-exploration`. Research only, no product code.

No Prime Video account was available. Each fact is tagged:

- **VERIFIED**: seen in a fetched page, an API response or a source file (URL or path given). Pages were fetched anonymously from a container that Amazon placed in the **US territory** (`"currentTerritory":"US"`, `marketplaceID ATVPDKIKX0DER`, `HomeRegion NA` in `dv-web-global-store-data`).
- **REPORTED**: from third-party code, documentation or search results, not checked against the live site.
- **UNKNOWN**: needs a signed-in account with an active Prime or Channels subscription.

Sources used:

- AniList GraphQL (`https://graphql.anilist.co`, reachable).
- `www.primevideo.com` and `www.amazon.{com,de,co.uk,co.jp}` detail pages (reachable; some requests got HTTP 503 "Website Temporarily Unavailable" and worked on retry with another URL form).
- Three open-source extensions, cloned to read the approach (facts only, no code copied):
  - **MAL-Sync** (GPL-3.0): Prime Video page `src/pages/PrimeVideo/main.ts`, added 2019, **removed on 2025-05-12** (commit `3ea22d9c7` "[TASK] Remove prime video", no reason given in the commit; the search found no issue explaining it).
  - **Universal Trakt Scrobbler** (MIT, `src/services/amazon-prime/`, maintained, release 0.9.4 on 2026-10-09).
  - **Netflix-Prime-Auto-Skip** (GPL-3.0, `src/content-script/amazon.ts`, updated 2026-10-04).
- The Kodi add-on `Sandmann79/xbmc` (GPL-3.0, `plugin.video.amazon-test`) for the playback API.

## 1. Domains, URL shapes, navigation

**Domains**

- Prime Video is served on two families of sites:
  - `www.primevideo.com`: worldwide, with an optional language prefix `/-/{lang}/` and an optional region path `/region/{na|eu|fe}/` (VERIFIED: `/-/fr/detail/{id}` returns 200; AniList stores `/region/fe/detail/…` and `/region/na/detail/…` links).
  - `www.amazon.com`, `amazon.co.uk`, `amazon.de` (Austria included, REPORTED) and `amazon.co.jp`: under `/gp/video/…` (VERIFIED: `/gp/video/storefront` returns 200 on .com, .de, .co.uk and .co.jp, but **404 on amazon.fr, .es and .it**, so French, Spanish and Italian users are on primevideo.com).
- Whether primevideo.com redirects a signed-in US, UK, DE or JP user to amazon.<tld>: UNKNOWN. Anonymously from the US it does not (VERIFIED, 200 with no redirect).

**Detail page**

- primevideo.com: `/detail/{id}[/ref=…][?…]` (VERIFIED).
- Amazon: `/gp/video/detail/{id}`, plus the retail forms `/dp/{ASIN}` and `/{Slug}/dp/{ASIN}`, which render the same Prime Video detail page for a video ASIN (VERIFIED: `amazon.com/gp/video/detail/B015O6OK4G` gives "Watch Tokyo Ghoul Season 1 | Prime Video"; the `/dp/` forms are REPORTED from AniList links and third-party code).
- `{id}` can be any of three forms:
  - a 10-character ASIN (`B0…`);
  - a 26-character *compact GTI* (`0TVO1JG449EFL5TZRWMN0DHHG0`);
  - a full GTI (`amzn1.dv.gti.<uuid>`).

  All three are accepted (VERIFIED in AniList links and the hydration data).
- The HTML embeds the full page state as JSON in `<script type="application/json" id="dv-web-page-hydration-data">` (VERIFIED), with:
  - `init.path`: the requested path;
  - `body.atf.state` (above the fold): `self`, `detail.headerDetail`, `seasons`, `pageContext`, `action`;
  - `body.btf.state` (below the fold): `detail.detail` for each episode, `episodeList`, `self`.

  A second script, `dv-web-global-store-data`, holds `RequestContext`, `HomeRegion` and `Profile.ageGroup`. There is no JSON-LD on detail pages (VERIFIED). MAL-Sync read an older format, `<script type="text/template">`, which no longer exists: this is a likely reason it broke (VERIFIED absent from the page; the cause is inferred).

**Playback**

- The player is an overlay mounted on the detail page: `pageContext.playbackLaunchType = "EMBEDDED"` (VERIFIED).
- Trakt Scrobbler matches playback with the URL regex `/\/detail\//` and states that "the detail URL can name a season or an earlier episode, so it is not an active item ID" (REPORTED). Playback therefore does **not** give a URL per episode. Whether a query such as `?autoplay=1&t=…` is added: UNKNOWN.
- Autoplay to the next episode happens inside the same overlay with no URL change. Trakt Scrobbler pre-fetches the "next item" because "there's no way to get the next item ID when the user clicks Next episode or when it autoplays" (REPORTED). The "next up" card has classes matching `[class*=nextupcard-button]` and `[class*=nextupcard-episode]` (REPORTED, Auto-Skip).
- SPA navigation between detail pages (season selector, episode cards) is UNKNOWN: the season links are plain `href`s (`/gp/video/detail/{seasonASIN}?ref_=atv_dp_season_select_s2`, VERIFIED), but whether the site intercepts them client-side is not known.

**Implications**

| Option | Optional host patterns | Chrome prompt (REPORTED wording) | Coverage |
|---|---|---|---|
| A (recommended v1) | `*://*.primevideo.com/*` | "Read and change your data on all primevideo.com sites" | every country through primevideo.com (FR, BE, ES, IT, CA…), and US / UK / DE / JP users who use primevideo.com |
| B (later, separate toggle) | `+ *://*.amazon.com/*`, `*://*.amazon.co.uk/*`, `*://*.amazon.de/*`, `*://*.amazon.co.jp/*` | "Read and change your data on a number of websites" (amazon.com, …) | US / UK / DE / AT / JP users who watch on amazon.<tld> |

- Option B grants the **whole Amazon shopping site** (orders, account, cart). This is a hard sell in the Chrome Web Store justification and for users.
- `chrome.scripting.registerContentScripts` supports `matches` / `excludeMatches` but not `include_globs`. The scripts could be limited to `/gp/video/*`, but that misses the `/dp/{ASIN}` and `/{Slug}/dp/{ASIN}` video detail pages. Otherwise the scripts run on every Amazon page and exit early, and the MAIN bridge (at `document_start`) would hook XHR/fetch on shopping pages too.
- If B is ever done, the bridge must disable itself unless `location.pathname` is a video page, and the isolated script unless `#dv-web-page-hydration-data` exists.
- Everything stays in `optional_host_permissions`, never `host_permissions` or `content_scripts` (same reason as Netflix: Chrome disables the extension on an update that adds a host).

## 2. Episode identity

**Detail page data** (VERIFIED, `amazon.com/gp/video/detail/B015O6OK4G` and `primevideo.com/-/fr/detail/0TVO1JG449EFL5TZRWMN0DHHG0`)

- `atf.state.self[<pageTitleId>]` = `{ titleType: "season" | "episode" | "movie", gti, compactGTI, asins[] (6 aliases), sequenceNumber, link }`.
  - On amazon.com the key is an ASIN; on primevideo.com it is a GTI.
  - `pageContext.pageTitleId` names the canonical title.
- `atf.state.detail.headerDetail[<pageTitleId>]` holds:
  - `title`: "Tokyo Ghoul Season 1", or the localized catalog title (FR: "Dororo to Hyakkimaru");
  - `parentTitle`: "Tokyo Ghoul";
  - `seasonNumber`: 1;
  - `entityType`: "TV Show";
  - `titleType`: "season";
  - `catalogId`: GTI;
  - `genres[]`: `{ id: "av_genre_anime", text: "Anime" }`, …;
  - `releaseYear`, `audioTracks[]` (includes "日本語"), `studios[]`;
  - `isPrime`: false for a title reached through the Crunchyroll channel.
- `btf.state.detail.detail[<episodeKey>]` = `{ titleType: "episode", episodeNumber, title, duration (s), runtime }`, plus `btf.state.self[<episodeKey>]` with the episode GTI and its ASIN aliases.
  - Episode numbers run **per season**: 1…12 for Tokyo Ghoul S1, 1…24 for Dororo.
  - There is no `seasonNumber` on the episode itself.
- `atf.state.seasons[<pageTitleId>][]` = `{ seasonId, displayName, sequenceNumber, isSelected, seasonLink }`. The numbering is not clean: Tokyo Ghoul US lists "Tokyo Ghoul" (1), "Tokyo Ghoul: Root A" (2), "Season 2" (2), "Tokyo Ghoul: re" (3), "Season 4" (4). Two entries share sequence 2 (two catalog entries, probably two licensors or dub versions). VERIFIED.

**ID aliasing** (VERIFIED, important for matching)

- `amazon.com/gp/video/detail/B015O6OK4G` (the AniList link) renders page title `B0GVJKVD2M` (`<link rel="canonical">`); `B015O6OK4G` appears only in `init.path` and the sign-in return URL.
- `primevideo.com/detail/0TVO1JG449EFL5TZRWMN0DHHG0` (AniList, Dororo) renders canonical `0LONKPM6NF995K99X4MTNFMY2Z` / `amzn1.dv.gti.6e4885f6-…`.
- So the id in an AniList link often does **not** equal any id the page exposes as the current title. Each title also has about six ASIN aliases, probably per territory or offer.

**During playback**

- **Player DOM** (REPORTED, Trakt Scrobbler 2026-10, MAL-Sync 2022):
  - container `[id^="dv-web-player"]`, class `.dv-player-fullscreen` while playing;
  - show title `.atvwebplayersdk-title-text`;
  - episode line `.atvwebplayersdk-subtitle-text` or `.atvwebplayersdk-episode-info`, text or `aria-label` "S1 E3 Title" or "Season 1, Ep. 3 Title";
  - on the detail page: play button `[data-testid="dp-atf-play-button"]` (its aria-label carries "Season N, Ep. M"), episode cards `[id^="av-ep-episode-"]` containing `[data-testid="episodes-playbutton"]` and an `a[href^="primevideo://detail?gti=…"]`.
  - These texts are **localized** (the parsers seen handle English only), and Prime unmounts the controls while they are hidden.
- **Playback API** (REPORTED: Trakt Scrobbler, Kodi add-on): `GET https://atv-ps[-eu|-fe].{primevideo.com|amazon.<tld>}/cdp/catalog/GetPlaybackResources?asin={id}&desiredResources=…`.
  - With `CatalogMetadata` it returns:
    - `catalogMetadata.catalog = { id, title, episodeNumber, entityType: "TV Show" | "Movie" | "Trailer" | "Bonus Content" }`;
    - `catalogMetadata.family.tvAncestors = [{ catalog: { seasonNumber } }, { catalog: { title /* show */ } }]`.
  - With `TransitionTimecodes` it returns `transitionTimecodes.skipElements[] = { elementType: "INTRO" | "RECAP" | "INTRO_RECAP" | "SHOW", startTimecodeMs, endTimecodeMs }`.
  - Titles may end with a version tag such as ` [OV/OmU]` (Trakt Scrobbler, issue #342).
  - Whether the **current web player** still calls this endpoint, or a newer one (`/playback/prs/GetVodPlaybackResources`, POST, from memory and not confirmed), is UNKNOWN. This is the key item to verify, because it would carry the identity of each episode, including after autoplay.
- **Region**: the catalog, titles (localized), ids and season splits vary by territory (VERIFIED for titles and aliases; per-region season numbering REPORTED). Anime on Prime come from Prime itself and from **Channels** (Crunchyroll channel on Prime US, VERIFIED: "Watch with Crunchyroll, 7-day free trial" on Tokyo Ghoul).

## 3. Anime filter and AniList links

**Prime's own genre**

- `genres[].id = "av_genre_anime"` is present on both anime pages fetched (VERIFIED). MAL-Sync filtered on exactly this id (VERIFIED in its source).
- It is a reliable, locale-independent first gate, available on the detail page and so before playback. Combined with `audioTracks` containing Japanese, it is close to Disney+'s `originalLanguage: ja` filter.
- Whether the genre is also exposed during playback without the detail page is UNKNOWN (`GetPlaybackResources` `CatalogMetadata` does not seem to include genres; REPORTED shape).

**AniList links** (VERIFIED, full scan of AniList on 2026-10-14)

- AniList has two sources: id 21 "Amazon Prime Video" (438 anime entries) and id 261 "Prime Video" (20), so **454 distinct entries**. For comparison, Netflix (id 10) has 973 and Disney Plus (id 118) has 72.
  - By origin: JP 444, CN 6, KR 4.
  - Most entries are old: 89 entries since 2022.
  - Overlap: 233 also have a Crunchyroll link, 106 a Netflix link.
- URL hosts:
  - `www.amazon.com`: 357 + 1 (`amazon.com`);
  - `www.primevideo.com`: 87;
  - `www.amazon.co.jp`: 15;
  - `amazon.de`: 3;
  - `amazon.co.uk`: 1.
- URL shapes:
  - `/dp/{ASIN}[/]`: 193;
  - `/gp/video/detail/{ASIN}[/][ref=…]`: about 110;
  - `/{Slug}/dp/{ASIN}…`: about 15;
  - `/-/dp/{ASIN}`, `/-/en/dp/{ASIN}` (JP);
  - `primevideo.com[/region/{r}|/-/es]/detail/{compactGTI}[/ref=…][?…]`;
  - `amazon.de/gp/video/detail/amzn1.dv.gti.{uuid}?…`;
  - with tracking queries (`?tag=techblast0f-20`, `?sr=…&pageTypeId=B0…`).
- `language` is always null. Links are almost all US-store ASINs; one season link per entry (445 of 454 have a single Prime link).
- Many well-known Prime anime have **no** Prime link at all: Vinland Saga, Classroom of the Elite, Re:ZERO, SPY×FAMILY, [Oshi no Ko], Blue Lock, Mushoku Tensei, One Piece, Dandadan (VERIFIED: their `externalLinks` list Netflix, Crunchyroll, HIDIVE…, never Prime). Made in Abyss and the Tokyo Ghoul seasons do have one.
- Combined with the aliasing above (the page's canonical id differs from the AniList id), **an AniList link cannot reliably identify a Prime series**. At best it is a hint that an entry "is on Prime".

**Consequence**

- The Netflix rule (`linkRequired: true`: no link means title-only, so « À vérifier » or ignored) would reject most Prime anime.
- Recommended gate:
  1. `av_genre_anime` (or a Japanese audio track plus the Animation genre) is required, else the title is ignored silently;
  2. then the **Crunchyroll / ADN title resolution** (`linkRequired: false`), with the season and per-season episode number;
  3. a Prime AniList link whose id equals one of the page's ids (`pageTitleId`, `self[*].gti`, `compactGTI` or `asins[]`, all available in the hydration data) upgrades the match to certain.
- The doubt rules (« À vérifier ») stay as for title-only matches.

## 4. Player, time, ads, credits

- **Video element**: Trakt Scrobbler uses `.dv-player-fullscreen video:not(.tst-video-overlay-player-html5)` (REPORTED). A second `<video>` exists for hover or overlay previews, and `pageContext.features.activateAutoPlayingInHovers = "true"` (VERIFIED) confirms autoplaying previews on the page. SyncKai must never pick the preview video (same need as Disney+'s `chooseDisneyVideo`).
- **Ads**: ads (Prime with ads in the US, UK, DE, FR and more since 2024; the old Freevee) are **stitched into the same `<video>`**. Auto-Skip skips an ad by adding the remaining ad time to `video.currentTime` (capped at 90 s "before crashing"), reading the remaining time in `.dv-player-fullscreen .atvwebplayersdk-ad-timer-remaining-time` (REPORTED). So `video.currentTime` and `video.duration` include ad breaks and are **not program time** when ads play. Is `duration` the program plus all ads, or does it change per break? UNKNOWN.
  - The 85 % ratio fallback would fire early or late, and positions would be wrong during breaks.
  - A `readPlayback` implementation (as for Disney+) must read the program position from the player UI, for example the time indicator next to the seek bar, which is not identified yet (UNKNOWN), or subtract the ad breaks.
  - While an ad plays (the ad timer is visible), progress must be ignored.
- **Obfuscated classes**: the player mixes stable `atvwebplayersdk-*` classes with hashed ones (`.fu4rd6c.f1cw2swo` for the "self-ad" skip button, REPORTED). Only the `atvwebplayersdk-*`, `data-testid` and `id` hooks should be used.
- **Credits**:
  - `transitionTimecodes.skipElements` covers intro and recap (REPORTED). An end-credits timecode is UNKNOWN; there is no evidence either way.
  - The reliable signal is the **"Next episode" card** (`[class*=nextupcard-button]`), which appears at the outro or credits. Its appearance time is a good completion point: SyncKai's `getCreditsStart` could resolve on its first appearance, with the ratio on program time as the fallback.
  - The card does not exist on the last episode of a season or on films (ratio fallback there).
  - X-Ray (`isXRay: true`, VERIFIED) is an overlay with cast and trivia, not useful for timing.

## 5. Login, profiles, regions, fragility

- Login and an entitlement (Prime or Channels) are required to play. Detail pages are public (VERIFIED anonymously). SyncKai needs no account or profile data. `Profile.ageGroup` / `isChild` and `customerID` are in the global store (null anonymously) and must not be read.
- Profiles: the hydration data is per profile (watchlist and progress). Not needed.
- Regions: titles are localized per UI language (FR page: French episode titles, catalog title "Dororo to Hyakkimaru"), the catalog and ids vary by territory, and the same season can exist twice (licensor, dub). Matching on `parentTitle` plus the season number is safer than on the season `title` ("Tokyo Ghoul Season 1").
- Fragility (high):
  - three third-party projects maintain Prime selectors, and one (MAL-Sync) dropped Prime in 2025;
  - the page state format changed at least once (`text/template` → `dv-web-page-hydration-data`);
  - the player's DOM texts are localized;
  - playback has no URL per episode;
  - ads distort time.
  - Mitigation: read **data** (hydration JSON, the player's own catalog response) rather than DOM text, and keep the DOM as a fallback.
- Cross-origin APIs: playback calls go to `atv-ps[-eu|-fe].*` (REPORTED), another origin. A passive MAIN-world bridge sees those responses anyway (they are the page's own XHR/fetch), with **no extra host permission**. SyncKai never calls them itself.

## 6. Store and policy

- **Permissions**: one optional host pattern `*://*.primevideo.com/*` (option A), toggled in Settings › Playback & sync like Netflix and Disney+. No new API permission: `scripting` is already declared.
- **`docs/store/permissions.md`** (to add when implementing; the test requires one table row per host). Draft row:

  > `*://*.primevideo.com/*` — Optional Prime Video support (anime only). Requested only when the user turns on Settings › Playback & sync › "Sync on Prime Video", from that click; turning it off removes the access. On a Prime Video title page and its player, SyncKai reads the title's page data already present in the page (title, season, episode numbers, genres) and, through a small passive script, the response of the request the Prime Video player itself sends for the video being played (title, season and episode number, identifiers), plus the playback position shown by the player. It never sends a request of its own and never reads headers, tokens, stream URLs, licences or account data. Titles Prime Video does not classify as anime are ignored without being sent anywhere.

  Also needed: the host block (1000 characters) gains "primevideo.com", and the single-purpose, scripting, website-content and web-history texts, `PRIVACY.md` (fr / en / de), the listings, `amo-metadata.json` and the content-script table get a Prime Video mention. Paste the changed blocks into the Privacy tab before the tag.
- **Amazon terms**:
  - The Prime Video Terms of Use (fetched, `primevideo.com/help?nodeId=202095490`) contain no clause on scraping, robots or browser extensions. Section 4(k) forbids circumventing DRM and section 3 forbids disguising the location (VERIFIED through the fetch tool's summary).
  - Amazon's general Conditions of Use exclude "data mining, robots, or similar data gathering and extraction tools" (REPORTED; the page returned 503).
  - SyncKai's design (passive read of what the page already received, no own requests, no DRM interaction, no stream URLs) keeps clear of these. The trademark rule stays as for the other platforms: label "Prime Video" and a logo in `public/brands/` per the existing practice.
- **Firefox**:
  - `optional_host_permissions` and `scripting.registerContentScripts` with `world: 'MAIN'` already work for Netflix and Disney+.
  - Firefox clears registered scripts on update, which `platform-access.ts` already handles.
  - The Firefox prompt reads "Access your data for sites in the primevideo.com domain" (REPORTED wording).
  - Firefox plays Prime Video in lower quality (Widevine L3), which does not matter here.
  - Whether a MAIN-world XHR/fetch wrapper works in Firefox on Prime is UNKNOWN; it did on Disney+.

## 7. Recommended design

Reuse the Disney+ blueprint end to end:

1. **Registry**:
   - `prime` in `STREAMING_PLATFORMS` (`src/shared/platform-ids.ts`);
   - descriptor in `src/shared/platforms.ts`:
     - `matchesHost('primevideo.com')`; later also `amazon.com|co.uk|de|co.jp`, but only for **link parsing**, never for scripts;
     - `linkRequired: false` with the genre gate below, `searchable: false`;
     - `optionalMatches: ['*://*.primevideo.com/*']`;
     - `seriesIdInPath` = `/^\/(?:region\/[a-z]{2}\/)?(?:-\/[a-z]{2}(?:-[a-z]{2})?\/)?detail\/([A-Z0-9]{10}|[0-9A-Z]{26}|amzn1\.dv\.gti\.[0-9a-f-]{36})(?:\/|$)/i`;
     - `seriesUrl` → `https://www.primevideo.com/detail/{id}`.
   - Add `prime` to `SCRIPTED_PLATFORMS`, with paths in `platform-access.ts` (`synckai-prime-*` script ids).
2. **Content side** (`src/content/prime/`, `*.iife.ts`, budget about 75 KB like Disney+):
   - **Page data, isolated world**: parse `#dv-web-page-hydration-data` (a `<script type="application/json">` the isolated world can read without MAIN). Reduce it to:
     - `{ pageTitleId, ids[] (gti, compactGTI, asins of the title and of each episode), titleType, parentTitle, title, seasonNumber, seasons[] (displayName, sequenceNumber, isSelected), genres[] ids, japaneseAudio, episodes[] { ids[], episodeNumber, title, duration } }`.
     - This gives the series pages (*On this page*, panel) at once, and the episode list of the current season.
     - Re-read it on URL change (SPA) and when the script node is replaced.
   - **Passive MAIN bridge** (`page-bridge.iife.ts`, `document_start`, version guard `installPrimeBridgeOnce`, private `MessageChannel` as on Disney+): wrap `XMLHttpRequest` / `fetch` only to read the JSON response of the player's catalog request (`GetPlaybackResources` with `CatalogMetadata`, or its successor). Reduce it **in MAIN** to:
     - `{ ids: [catalog.id, request asin], entityType, episodeNumber, seasonNumber, showTitle (version tag stripped), skipElements[] (type, start/end ms), endCredits? }`.
     - Never read or relay `PlaybackUrls`, licences, headers, tokens or `playbackUrls` / `audioVideoUrls`.
     - This is what identifies the episode actually playing, including after autoplay (each new episode triggers a new request).
   - **Adapter** `adapters/prime.ts`:
     - `getEpisodeId`: no per-episode URL. Use the episode id from the last bridge entry (the request asin), falling back to the play button or episode card ids on the detail page.
     - `extractEpisodeInfo` and `loadEpisodeInfo`: the bridge entry, joined to the hydration episode list by id for the title and duration. Fallback: parse `.atvwebplayersdk-subtitle-text` with localized patterns (S1 E3, Season/Saison/Staffel/シーズン… + Ep./ép./Folge/エピソード).
     - Gate: `av_genre_anime` from the hydration data, else nothing is sent (silent, `quiet: true`).
     - `findVideo`: `.dv-player-fullscreen video` excluding `.tst-video-overlay-player-html5`, preferring a playing, connected video.
     - `readPlayback`: program position from the player UI, ignored while `.atvwebplayersdk-ad-timer-remaining-time` is visible.
     - `getCreditsStart`: the bridge's end-credits timecode if one exists; else the first appearance of `[class*=nextupcard-button]` (a one-shot MutationObserver scoped to the player, only while tracking); else the ratio.
     - `detectSeries` / `loadSeries` / `watchSeason`: from the hydration data (`seasons[].isSelected`) and the season selector.
3. **Background**:
   - `seriesPageGate` and `gateByPlatformLink` adapted: genre gate rather than link-required.
   - A new `matchPrimeLink(url, pageIds)` in `matching.ts`: an AniList Prime link is certain when its id (ASIN, compact GTI or GTI, any host among primevideo.com and amazon.<tld>) is one of the page's ids. Otherwise the link only proves the entry is on Prime, and binds only if a title of the entry equals `parentTitle` (Disney+'s `isTitleBoundLink`).
   - Mapping key `prime:title:{normalized parentTitle}:s{seasonNumber}`. Title-based, because ids alias per region; the canonical `pageTitleId` could be stored as a secondary key.
   - `MESSAGE_ORIGINS` and `GET_PAGE_MEDIA` unchanged.
4. **Not in v1**: amazon.<tld> sites (option B), history import (Trakt Scrobbler uses `…/api/getWatchHistorySettingsPage` and `enrichItemMetadata`, REPORTED; feasible later, as for ADN), and Prime as preferred player.
5. **UI and i18n**: a Settings toggle "Sync on Prime Video" and an off-target « Activer Prime Video » button. Each new string needs its context note and 20 translations, then `npm run test:i18n-layout`.

### Effort estimate

- **Spike with the owner's DevTools captures** (checklist below): 0.5 day for the owner, then 0.5 day to turn the captures into fixtures.
- **v1, primevideo.com only**:
  - registry and permission plumbing: 0.5 day (`platform-access` and the registry are generic now);
  - hydration parser, bridge, adapter, playback time and credits with tests and fixtures: 3–4 days;
  - matching and gate in the background, with tests: 1–1.5 days;
  - settings UI, i18n (21 locales), store and privacy docs, e2e: 1–1.5 days.
  - **Total about 6–8 working days** of agent work, plus 2–3 owner test sessions on the real site (ads tier, autoplay, Firefox).
- **Option B** (amazon.<tld>): +2 days, plus a store-justification risk.

### Main risks

1. The player's catalog request is not observable or has changed: identity after autoplay would then rely on localized DOM text.
2. Ads distort `currentTime`: program time must come from the UI, which is fragile.
3. No end-credits data: completion relies on the next-up card or the ratio.
4. Matching quality: there are few usable AniList links, so title resolution with localized catalog titles (FR "Dororo to Hyakkimaru") often ends on « À vérifier ».
5. DOM and format churn: one competitor gave up in 2025.

## Verification checklist for the owner

Use Chrome or Brave, signed in to Prime Video, on **www.primevideo.com** in French, with an anime you are entitled to (several seasons if possible, for example Tokyo Ghoul or Dororo), and ideally an account that has ads. Open DevTools **before** opening the title, with *Preserve log* on. **Never paste cookies, `Authorization` / `x-amz-*` headers, `playbackUrls`, licence responses or `customerID` values**: copy only the fields listed.

1. **Detail page data**: Console → `JSON.parse(document.getElementById('dv-web-page-hydration-data').textContent).init.preparations.body.atf.state`.
   - Copy `pageContext.pageTitleId`, `self`, `seasons` and `detail.headerDetail[<id>]`, keeping only `title`, `parentTitle`, `seasonNumber`, `titleType`, `entityType`, `genres[].id` and `audioTracks`.
   - Repeat with `.btf.state.detail.detail`, keeping only `episodeNumber`, `title`, `duration` and `titleType`.
   - Then click another season in the selector: does the URL change? Does the page reload (Network › *Doc*), or does the hydration script's content change without a reload? Run the same command again.
2. **Playback start**: Network, filter `Fetch/XHR`, search `GetPlaybackResources` (also try `PlaybackResources`, `playback`, `prs`, `catalog`).
   - Click Play and note the request URL path, host, method and the **names** of the query parameters (not their values for `deviceID` / tokens).
   - In the response (Preview), expand `catalogMetadata` and copy `catalog` (id, title, episodeNumber, entityType) and `family.tvAncestors[*].catalog` (seasonNumber, title).
   - Expand `transitionTimecodes` and copy it in full (element types and ms values). Note whether an end-credits field exists (`endCredits…`, `outro`, `credits`).
   - Do **not** expand `playbackUrls`, `audioVideoUrls` or licence-related objects.
3. **URL during playback**: copy `location.href` before Play, during playback and after the player is closed.
4. **Player DOM**: Elements, with the player open (move the mouse so the controls show).
   - Run `document.querySelectorAll('video')` and note each video's classes, `paused`, `currentTime`, `duration` and `isConnected`.
   - Copy the `outerHTML` (text only) of `.atvwebplayersdk-title-text` and `.atvwebplayersdk-subtitle-text`, or of whatever shows "Saison 1, ép. 3".
   - Identify the element that shows the elapsed or remaining time next to the seek bar: its class and text, and whether it has an `aria-valuenow` / `aria-valuemax` slider.
5. **Ads** (ads tier): during an ad break, log `v = document.querySelector('.dv-player-fullscreen video'); [v.currentTime, v.duration]` every few seconds, and note the on-screen program time and the ad timer text (`.atvwebplayersdk-ad-timer-remaining-time`). Repeat after the break: does `duration` include the ads? By how much does `currentTime` jump compared to the program time?
6. **Credits and autoplay**:
   - Seek to about 1 minute before the end.
   - Note the program time when the "Épisode suivant" card appears (class containing `nextupcard`), and copy its `outerHTML` text.
   - Let it autoplay: does a new playback-resources request fire (copy its `catalog` fields again)? Does the URL change? Does the title or subtitle text update?
7. **Firefox**: repeat steps 2 and 6 (whether the request is visible, and the URL behaviour).
8. **Amazon site (optional, option B)**: if you sometimes watch on amazon.fr or amazon.de, note the URLs of a detail page and of the player, and whether primevideo.com redirects you to amazon.<tld> when signed in.

Save the copied JSON fragments into a text file (no tokens) and share it: it becomes the fixtures (`src/content/prime/fixtures.ts`).

## Owner captures (2026-10-14, Chrome, primevideo.com/region/eu, English UI)

Read-only console probe (fetch/XHR responses reduced to whitelisted leaf fields, no headers, cookies, tokens or URLs). Title: *A Star Brighter Than the Sun* S1 (entitled, 12 episodes), E1 seeked near the end, then autoplay into E2 for 30 s. Tokyo Ghoul S1–S3 (not entitled) for the detail pages.

- **No URL per episode, even on autoplay** (VERIFIED): the player is embedded in the detail page (`pageContext.playbackLaunchType: EMBEDDED`); `location` stayed on `/detail/<season compactGTI>` for E1 and E2. Identity must come from the bridge.
- **Detail pages** (VERIFIED): hydration `atf/btf.state` holds the season (`pageTitleId`, `self.<gti>.compactGTI`, `titleType: season`, `seasonNumber`, `sequenceNumber`), `headerDetail.parentTitle` (series title; `title` can be "Tokyo Ghoul Season 1"), `metadata.episodeCount` ("12 episodes"), and every episode in `btf.state.detail.detail.<episode gti>` (`title`, `episodeNumber`, `duration` in s, `titleType: episode`). SPA navigation fetches `GET /region/eu/detail/<id>?dvWebAppClientVersion=…` as JSON with the same shape; **the `#dv-web-page-hydration-data` node is NOT updated on SPA navigation**, so the bridge must read those responses (the node is only the first page).
- **Playing episode** (VERIFIED, after autoplay): `GET atv-ps-eu.primevideo.com/cdp/lumina/playerChromeResources/v1?entityId=…&desiredResources=…` answered 0.1 s into E2 with `resources.catalogMetadataV2.catalog = { type: EPISODE, title: "Call My Name", seriesTitle, seasonNumber: 1, episodeNumber: 2 }`. Another call returns `resources.nextUpV3.card.carouselItems[] = { titleId, isLogicalNextEpisode, catalog { title, seriesTitle, seasonNumber, episodeNumber } }` (the episode AFTER the playing one). No id inside `catalogMetadataV2` was captured: join by the request's `entityId` (assumed to be the playing episode's gti, UNKNOWN).
- **Same-origin widgets** on autoplay: `GET /region/eu/api/getDetailWidgets?titleID=…&widgets=…` gives `buybox.bestSelf { gti, compactGTI, sequenceNumber, titleType: episode }` of the playing episode and `episodeList.episodes[] { titleID, self.gti, compactGTI, detail.episodeNumber, title, duration }`.
- **Playback resources** (VERIFIED for E2): `GET atv-ps-eu…/playback/prs/GetVodPlaybackResources?titleId=…`:
  - `transitionTimecodes.result.events[] = { eventType, startTimeMs, endTimeMs?, intervals[] }`: `SKIP_INTRO` 87000–172000, `NEXT_UP` 1443000 (of 1448000, 99.7 %). No separate credits marker. In this episode the story goes on after the ending song (owner, 2026-10-14), so `NEXT_UP` at the very end may simply be right here: whether Amazon places it at the ending song when nothing follows is UNKNOWN (second title to capture).
  - `vodPlaylistedPlaybackUrls.result.playbackUrls.fullTitleDurationMs` = 1448000 and `intraTitlePlaylist[] { type: Main, startMs, endMs }` = 0–787453–1134508–1448000 (probably ad-break slots; no ad played). The bridge reads only `transitionTimecodes` and `fullTitleDurationMs`, never the URL fields of `playbackUrls`.
  - Also fetched: `pes/StartSession|UpdateSession|StopSession` (heartbeats, nothing useful), `drm-vod/GetWidevineLicense` (never read).
- **Video** (VERIFIED, no ads): one main `<video>` without class, **reused across episodes** (on autoplay: `currentTime` 0, `duration` NaN and 0×0 for about 2 s, then 1448). Its `currentTime` equals program time and `duration` = `fullTitleDurationMs`/1000. A second `<video>` (trailer preview, 43 or 63 s) stays paused on the page: pick the playing video whose duration matches the episode.
- **Next-up card**: an element with `nextup` in its class became visible at 1426.6 s (21 s before the end) and disappeared when E2 started.
- **Genre** (VERIFIED in the hydration data of the detail page): the anime has `"genres"` with `av_genre_anime` (label "Anime", search link `/region/eu/search?phrase=Anime`); a non-anime series has `av_genre_action` / `av_genre_comedy` / `av_genre_drama` plus `categorizedGenres` / `primaryGenre` / `secondaryGenres`. Gate = `av_genre_anime` present. Not checked: the same field in the SPA `/detail/` JSON responses, and playback started outside a detail page (home row, *Continue watching*), where no genre may be in the page.
- **Second title** (*From Old Country Bumpkin to Master Swordsman* S1, E1 → E4 by autoplay, ending song with nothing after it):
  - `transitionTimecodes` carries **`END_CREDITS`** (no end time) besides `NEXT_UP` and `SKIP_INTRO`: E2 1311000 / 1417000 of 1440000, E3 1312000 / 1417000 of 1441000, E4 1312000 / 1417000 of 1441000. The owner saw E3's ending song start at about 21:52 (1312 s) and the next-up card at about 23:37 (1417 s): `END_CREDITS` is the credits start (91 %), `NEXT_UP` the card. *A Star Brighter Than the Sun* E2 had no `END_CREDITS` (the story goes on after its ending song).
  - The next episode's `GetVodPlaybackResources` is fetched about 1 s **before** the switch (at the next-up card, while the old episode still plays); its `catalogMetadataV2` and `getDetailWidgets` arrive 0.1–0.3 s after the switch. Entries must be keyed by the request's `titleId` / `entityId`, never taken as "the latest response".
  - `intraTitlePlaylist` has one split per episode (695361, 961377, 1155445 ms): probably the ad slot.
- **Still UNKNOWN**: ads tier (time shift, `duration`), `titleId` / `entityId` = playing episode gti (consistent with `nextUpV3.carouselItems[].titleId` then `bestSelf.gti`, values not recorded), a first play from the home page or *Continue watching* (genre), Firefox.

Consequences for the design (§7): identity from `catalogMetadataV2` keyed by `entityId`, series pages from the `/detail/` JSON responses (not the hydration node after SPA navigation), credits start = `END_CREDITS` of the playing episode's `GetVodPlaybackResources` (keyed by `titleId`), else the ratio of `fullTitleDurationMs`; `NEXT_UP` and `SKIP_INTRO` ignored. Points (a) and (b) of the go / no-go: (a) VERIFIED; (b) open (no ads seen).

## Go / no-go

**Conditional go for a v1 limited to `www.primevideo.com`**, after the checklist confirms two points:

- (a) the player's own catalog response, or an equivalent, is observable and identifies the playing episode (show title, season, episode number), including after autoplay;
- (b) program time can be read when ads play.

If (a) fails, Prime is **no-go** for now. A DOM-text-only implementation (localized, controls unmounted, no URL per episode) would be as fragile as the one MAL-Sync removed in 2025.

Do not plan amazon.<tld> support (option B) unless users ask for it: it needs the whole Amazon shopping origins.

Expected value is moderate. AniList barely links Prime (454 entries, mostly old US ASINs, missing most current Prime anime), so matching relies on Prime's `av_genre_anime` genre plus title resolution, and more cards will show « À vérifier » than on Netflix.
