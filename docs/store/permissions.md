# Privacy practices — Chrome Web Store dashboard

Answers for the **Privacy practices** tab (manifest v1.7.0). Copy each block into the matching field.

## Single purpose

```
SyncKai automatically updates the user's anime list on AniList and/or MyAnimeList with the episode they are watching on Crunchyroll or ADN (Animation Digital Network). All features (episode detection, list of series in progress, next-episode alerts, ratings, backup) serve this single purpose: keeping the user's anime tracking list in sync with what they watch.
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
Two alarms, both run by the service worker: (1) an hourly check of the AniList airing schedule for the series the user is watching, to notify new episodes (only when the user has turned alerts on); (2) a retry alarm that re-sends syncs that failed for a transient reason (network, rate limit, server error). The retry alarm only exists while the queue contains a pending item.
```

### notifications

```
Shows a Chrome notification when a new episode of a series the user is watching has aired (optional feature, "Notify me when an episode is out" in Settings). The notification has an "Open" button that opens the episode on the user's preferred platform.
```

### sidePanel

```
Shows SyncKai's companion side panel (episode being watched, release schedule) on Crunchyroll and ADN pages only. The panel is disabled by default and enabled per tab only on those sites; it opens only when the user clicks "Open the side panel" in the popup. It reads no browsing data and sends nothing anywhere.
```

### Host permissions

Declared in `host_permissions` (exactly as in manifest.json):

| Host pattern | Justification |
|---|---|
| `*://*.crunchyroll.com/*` | Content script on Crunchyroll episode pages. Also lets it fetch `static.crunchyroll.com/skip-events/production/…`, the public JSON that gives the credits start time (same source the Crunchyroll player uses), to detect the end of an episode. |
| `https://graphql.anilist.co/*` | AniList GraphQL API: find the matching entry (public catalog, also used when only MyAnimeList is connected), read the user's list, save progress, rating and rewatch, read the airing schedule for new-episode alerts. |
| `https://myanimelist.net/*` | MyAnimeList OAuth2 token endpoint (`/v1/oauth2/token`): exchange the authorization code and refresh the access token. |
| `https://api.myanimelist.net/*` | MyAnimeList REST API v2: read the user's list and profile, save progress, rating and rewatch status. |

Note: there is **no** host permission for ADN. `animationdigitalnetwork.com` is only covered by the content-script `matches` below; the ADN adapter reads the page and makes no network request.

```
crunchyroll.com: the content script detects the episode being played (JSON-LD on the page, video element) and fetches Crunchyroll's public skip-events JSON (static.crunchyroll.com) to know when the credits start. graphql.anilist.co: AniList API, to match the series and save the user's progress. myanimelist.net: MyAnimeList OAuth2 token endpoint (sign-in and token refresh). api.myanimelist.net: MyAnimeList API, to read the user's list and save progress. No other site is accessed.
```

### Content-script matches

| Pattern | Purpose |
|---|---|
| `*://*.crunchyroll.com/*` | Crunchyroll adapter (`src/content/content.ts`) |
| `*://animationdigitalnetwork.com/*` | ADN adapter |
| `*://*.animationdigitalnetwork.com/*` | ADN adapter (subdomains) |

The content script runs on these sites only. It reads the current episode page (series title, season, episode number and title, platform episode/series ID from the URL and JSON-LD) and listens to the `<video>` element's playback progress to detect the end of the episode. It also displays SyncKai's on-page notifications. It does not read anything else on the page and does not run on any other site.

## Remote code

**Are you using remote code? → No**

```
No. All JavaScript is bundled in the extension package. The extension only fetches JSON data (AniList GraphQL, MyAnimeList REST, Crunchyroll skip-events); it never loads or evaluates remote scripts.
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
| **Web history** | **Yes (conservative)** | Not browsing history: the extension never reads history or pages outside Crunchyroll/ADN. It keeps a local list of recently synced episodes (title, episode, platform link) and sends the watched episode's progress to the user's own AniList/MAL list. Checked so the disclosure covers this record of watched episodes. |
| User activity | No | Only the video's playback position on the episode page is checked to detect the credits; no clicks, keystrokes or scroll are recorded. |
| **Website content** | **Yes** | Reads the current episode page on Crunchyroll/ADN only (series title, season, episode number and title from JSON-LD / page heading). |

Suggested justification text (if a free-text field is shown):

```
SyncKai reads the current episode page on Crunchyroll or ADN (series title, season, episode number) and sends the watched episode to the user's own AniList and/or MyAnimeList list, using OAuth tokens the user grants via chrome.identity. Tokens, settings and history are stored only in chrome.storage.local on the user's device. SyncKai has no server: no data is sent to the developer or to any third party other than AniList and MyAnimeList.
```

### Certifications (check all three)

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases. — Data only goes to AniList / MyAnimeList, at the user's request, to perform the sync (the extension's single purpose).
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

### Privacy policy URL

Required because user data is disclosed. Point to a privacy page in the repository, e.g. `https://github.com/Sync-Kai/SyncKai/blob/main/PRIVACY.md` (to be created — content: the justification text above).
