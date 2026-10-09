# Privacy practices — Chrome Web Store dashboard

Answers for the **Privacy practices** tab (manifest v2.1.0). Copy each block into the matching field.

## Single purpose

```
SyncKai automatically updates the user's anime list on AniList and/or MyAnimeList with the episode they are watching on Crunchyroll, ADN (Animation Digital Network) or, if the user turns it on, Netflix (anime only). All features (episode detection, list of series in progress, companion side panel with the episode's entry and the week's releases, next-episode alerts, ratings, Crunchyroll history import, backup) serve this single purpose: keeping the user's anime tracking list in sync with what they watch.
```

## Permission justifications

### storage

```
Stores the user's settings, the remembered matches between streaming series and AniList/MyAnimeList entries, excluded series, recent syncs, the retry queue for failed syncs, the last 50 technical errors (redacted, no tokens or account names; only shared if the user copies the diagnostic report), and the AniList/MyAnimeList OAuth tokens. Everything is kept in chrome.storage.local on the user's device; nothing is sent to the developer.
```

### identity

```
Used only for chrome.identity.launchWebAuthFlow to let the user sign in to AniList (OAuth2) and MyAnimeList (OAuth2 + PKCE, no client secret). The redirect URL is the extension's chromiumapp.org URL. No Google account data is accessed.
```

### alarms

```
Alarms run by the service worker: (1) an hourly check of the AniList airing schedule for the series the user is watching, to notify new episodes (only when the user has turned alerts on) and refresh the week's release schedule shown in the side panel; (2) a retry alarm that re-sends syncs that failed for a transient reason (network, rate limit, server error), which only exists while the queue contains a pending item; (3) a resume alarm for a background task the user started (Crunchyroll history import, AniList ↔ MyAnimeList comparison), which only exists while that task is running, so it resumes if the browser stops the service worker.
```

### notifications

```
Shows a Chrome notification when a new episode of a series the user is watching has aired (optional feature, "Notify me when an episode is out" in Settings). The notification has an "Open" button that opens the episode on the user's preferred platform.
```

### sidePanel

Chrome only: the Firefox build has no `sidePanel` permission (it declares a `sidebar_action` instead).

```
Shows SyncKai's companion side panel (episode being watched, release schedule) on Crunchyroll and ADN pages only (and on Netflix pages, only if the user has turned Netflix on). The panel is disabled by default and enabled per tab only on those sites; it opens only when the user clicks "Open the side panel" in the popup. It reads no browsing data and sends nothing anywhere.
```

### scripting

```
Used only for the optional Netflix support, and only after the user turns it on in Settings and grants access to netflix.com (optional host permission). The service worker then registers SyncKai's two Netflix content scripts with chrome.scripting.registerContentScripts, and runs them once with chrome.scripting.executeScript in Netflix tabs that are already open, so the user does not have to reload them. Both scripts are files of the extension package; no remote code is loaded. If the user turns Netflix off or removes the access, the scripts are unregistered. Without that consent, the scripting API is never used and nothing runs on Netflix.
```

### Host permissions

Declared in `host_permissions` (exactly as in manifest.json):

| Host pattern | Justification |
|---|---|
| `*://*.crunchyroll.com/*` | Content script on Crunchyroll episode pages. Also lets it fetch `static.crunchyroll.com/skip-events/production/…`, the public JSON that gives the credits start time (same source the Crunchyroll player uses), to detect the end of an episode. On explicit request only (Settings › Import from Crunchyroll), the content script running in the user's own Crunchyroll tab reads their watch history from Crunchyroll's API (same origin, the site's own session) so the user can bring AniList/MyAnimeList up to date after a preview; the short-lived Crunchyroll token never leaves the tab and is never stored. |
| `https://graphql.anilist.co/*` | AniList GraphQL API: find the matching entry (public catalog, also used when only MyAnimeList is connected), read the user's list, save progress, rating and rewatch, read the airing schedule for new-episode alerts. |
| `https://myanimelist.net/*` | MyAnimeList OAuth2 token endpoint (`/v1/oauth2/token`): exchange the authorization code and refresh the access token. |
| `https://api.myanimelist.net/*` | MyAnimeList REST API v2: read the user's list and profile, save progress, rating and rewatch status. |

Declared in `optional_host_permissions` (requested at runtime, never at install):

| Host pattern | Justification |
|---|---|
| `*://*.netflix.com/*` | Optional Netflix support (anime only). Requested only when the user turns on Settings › Playback & sync › "Sync on Netflix", from that click; turning it off removes the access. On a Netflix player page, SyncKai reads the video being played (series title, season, episode number, credits start time) through Netflix's own episode metadata endpoint, same origin, from the user's own tab, plus the `<video>` element's playback position. No Netflix account, profile or viewing-history data is read or sent. Only series linked to Netflix on AniList are synced; any other title is ignored silently. |

```
netflix.com (optional, requested only when the user turns on Netflix in Settings): on a Netflix player page, the extension reads the series title, season and episode number of the video being played (same-origin request to Netflix's episode metadata, from the user's own tab) and the video's playback position to detect the credits. No Netflix account or profile data is read or sent anywhere. Only anime linked to Netflix on AniList are synced to the user's AniList/MyAnimeList list; any other title is ignored.
```

Note: there is **no** host permission for ADN. `animationdigitalnetwork.com` is only covered by the content-script `matches` below; the ADN adapter reads the page and makes no network request.

```
crunchyroll.com: the content script detects the episode being played (JSON-LD on the page, video element) and fetches Crunchyroll's public skip-events JSON (static.crunchyroll.com) to know when the credits start; only when the user starts "Import from Crunchyroll", it also reads the user's watch history in their own Crunchyroll tab. graphql.anilist.co: AniList API, to match the series and save the user's progress. myanimelist.net: MyAnimeList OAuth2 token endpoint (sign-in and token refresh). api.myanimelist.net: MyAnimeList API, to read the user's list and save progress. No other site is accessed.
```

### Content-script matches

| Pattern | Purpose |
|---|---|
| `*://*.crunchyroll.com/*` | Crunchyroll adapter (`src/content/content.ts`) |
| `*://animationdigitalnetwork.com/*` | ADN adapter |
| `*://*.animationdigitalnetwork.com/*` | ADN adapter (subdomains) |

Netflix is **not** in `content_scripts`: its two scripts are registered at runtime (`chrome.scripting.registerContentScripts`, `*://*.netflix.com/*`) only once the user has granted the optional access:

| Script | World | Purpose |
|---|---|---|
| `src/content/netflix/content-netflix.iife.ts` | isolated | Netflix adapter: detects the episode and the end of the credits, shows on-page notifications |
| `src/content/netflix/page-bridge.iife.ts` | `MAIN` | Short bridge with no `chrome.*` API: fetches Netflix's metadata for the current video (`/nq/website/memberapi/release/metadata`, same origin) and returns only title, seasons, episode numbers and credits timing to the isolated script |

`web_accessible_resources` exposes these scripts to `*://*.netflix.com/*` only.

The content script runs on these sites only. It reads the current episode page (series title, season, episode number and title, platform episode/series ID from the URL and JSON-LD) and listens to the `<video>` element's playback progress to detect the end of the episode. It also displays SyncKai's on-page notifications. It does not read anything else on the page and does not run on any other site.

## Remote code

**Are you using remote code? → No**

```
No. All JavaScript is bundled in the extension package. The extension only fetches JSON data (AniList GraphQL, MyAnimeList REST, Crunchyroll skip-events, Netflix episode metadata when the user has turned Netflix on); it never loads or evaluates remote scripts. The optional Netflix scripts are files of the package, registered with chrome.scripting.
```

## Data usage disclosure

"What user data do you plan to collect from users now or in the future?"

| Category | Check? | Details |
|---|---|---|
| Personally identifiable information | No | No name, email, address or ID is requested. The AniList/MAL username and avatar returned by those services are only cached locally to display the connected account. |
| Health information | No | — |
| Financial and payment information | No | — |
| **Authentication information** | **Yes** | AniList and MyAnimeList OAuth access tokens (and MAL refresh token), obtained via `chrome.identity`, stored in `chrome.storage.local` on the device and sent only to AniList / MyAnimeList to authorize API calls. No password is ever seen by the extension. |
| Personal communications | No | — |
| Location | No | — |
| **Web history** | **Yes (conservative)** | Not browsing history: the extension never reads history or pages outside Crunchyroll/ADN (and Netflix player pages, only if the user turns Netflix on). It keeps a local list of recently synced episodes (title, episode, platform link) and sends the watched episode's progress to the user's own AniList/MAL list. Checked so the disclosure covers this record of watched episodes. |
| User activity | No | Only the video's playback position on the episode page is checked to detect the credits; no clicks, keystrokes or scroll are recorded. |
| **Website content** | **Yes** | Reads the current episode page on Crunchyroll/ADN only (series title, season, episode number and title from JSON-LD / page heading), and on Netflix only if the user turns it on (title, season and episode number of the video being played). |

Suggested justification text (if a free-text field is shown):

```
SyncKai reads the current episode page on Crunchyroll or ADN, and on Netflix only if the user turns it on (series title, season, episode number), and sends the watched episode to the user's own AniList and/or MyAnimeList list, using OAuth tokens the user grants via chrome.identity. Tokens, settings and history are stored only in chrome.storage.local on the user's device. SyncKai has no server: no data is sent to the developer or to any third party other than AniList and MyAnimeList.
```

### Certifications (check all three)

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases. — Data only goes to AniList / MyAnimeList, at the user's request, to perform the sync (the extension's single purpose).
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

### Privacy policy URL

Required because user data is disclosed. Point to a privacy page in the repository, e.g. `https://github.com/Sync-Kai/SyncKai/blob/main/PRIVACY.md` (to be created — content: the justification text above).
