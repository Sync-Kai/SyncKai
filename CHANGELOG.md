# Changelog

All notable changes to SyncKai are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added

- **Interface in 18 more languages**, 21 in all: Spanish (Spain), Latin American Spanish, Brazilian Portuguese, Italian, Dutch, Russian, Ukrainian, Polish, Czech, Romanian, Swedish, Turkish, Indonesian, Vietnamese, Simplified Chinese, Traditional Chinese, Korean and Japanese, besides English, French and German. The extension's description and the names of its shortcuts in the browser (`_locales`) follow the browser's language too. Each language was translated with a shared glossary and its own term sheet, then reviewed independently.
- *Automatic* language: the browser's language is matched to the closest one. An exact match wins (`pt-BR`, `es-419`, `zh-TW`…); Spanish from Spain or without a region → Spanish (Spain), any other Spanish (`es-MX`, `es-AR`, `es-US`…) → Latin American Spanish; any Portuguese, `pt-PT` included → Brazilian Portuguese; Chinese in Traditional script or from Taiwan, Hong Kong or Macao (`zh-HK`…) → Traditional Chinese, any other Chinese → Simplified Chinese; otherwise the base language (`fr-CA` → French), and English when the language isn't offered.
- *Settings › Language*: with 21 languages, the picker now shows its search field (a language's own name or its name in the interface language, accents and case ignored, language codes too).

### Changed

- *Settings › Language*: the language picker is now a list of radio buttons instead of a segmented control. *Automatic* stays first, with the language it resolves to ("Browser language · Français"), then every language in its own name, sorted alphabetically (Deutsch, English, Français) with its name in the interface language below. Language names come from the browser, so new languages need no translated names. Ready for more languages: a search field (accents and case ignored, also matches language codes) appears from 8 languages, and a *Help translate SyncKai* link can be turned on. Arrow keys move the selection; the group is a single tab stop.
- Translations are loaded on demand: the popup, the side panel, the import pages and the service worker only embed English (the fallback) and read the chosen language from the extension package when needed, so the 21 languages don't slow them down (about 110 KB less code to load than with the three languages embedded before).
- The scripts SyncKai loads into Crunchyroll, ADN, Netflix and Disney+ pages only embed their own texts in English and get them in another language from the service worker: they are smaller (Crunchyroll / ADN 81.4 → 78.2 KB, Netflix 62.7 → 58.4 KB, Disney+ 69.8 → 65.5 KB), whatever the number of languages.

### Fixed

- Anime with an accented localized title (Crunchyroll in French: « Moi, quand je me réincarne en Slime ») were not found on AniList, whose search misses accented alternative titles; on a series page the card could show the right entry, then "No AniList entry found" a second later, once the page's localized title was read. When nothing linked is found, SyncKai now also searches the title without accents, then the English title from the page address.
- Long translations with a wider system font (Linux, macOS without the display font): the *Settings* title is no longer cut in the side panel (Ukrainian, Swedish), the decorative « セッテイ » gives way first; in *Now playing*, a long live-sync message (Russian, 320 px panel) stays whole and the playback clock moves to the next line.
- *Settings › My data*: the Crunchyroll / ADN / Netflix import buttons wrap onto a new line in a narrow side panel instead of overflowing the card.
- Netflix history import with a Netflix profile in Italian, Spanish, Portuguese, Dutch, Swedish, Polish, Czech, Romanian, Russian, Ukrainian, Turkish, Indonesian, Vietnamese, Japanese or Traditional Chinese: the page's *Show more* button is now recognized in that language. Before, only the first ~20 rows of the history were read and the import reported them as the whole history. The label of other profile languages (Simplified Chinese, Korean…) is still unknown. Episode titles in the quotation marks of any language (« », „ “, 「 」…) are now recognized in the rows.
- Side panel, *Now playing*: the airing season and its year follow the order of the language (« 2024年秋 » in Japanese and Chinese, « 2024년 가을 » in Korean) instead of always putting the year last.
- *Schedule* tooltips: the delay after the Japanese broadcast uses the units and minus sign of the language (« +1 Std. 30 Min. », « +1時間30分 ») instead of English "h" and "min"; the range of the per-series delay editor is written in the language's number format (« -1,440 to 10,080 »).
- No more doubled punctuation (« .. », « 。。 ») when a sync failure is followed by *Retrying automatically soon*.
- Lists of names (services in sync messages, titles of a grouped new-episode notification) use the language's own separators and conjunction (« AniList and MyAnimeList », 、 in Japanese and Chinese) instead of commas, and two sentences shown together are no longer separated by a Latin space in Japanese and Chinese.
- The error shown when no connected account has an entry for the anime now says so (*No connected service has an entry for this series.*) instead of saying that no service tracks the series.
- Long translations: in *Activity › Pending syncs*, the buttons go below a long status instead of cutting it; in *To rate*, *Ignore* goes below the stars when they don't fit; in a narrow side panel, the *Hold* / *Drop* / *Done* buttons hide their icons so that their labels fit; in *Watching*, a next-episode chip that doesn't fit is cut, with its full text in a tooltip, instead of overlapping the progress.

## [2.3.1] - 2026-10-12

First published version of the 2.3 line: 2.3.0 was tagged but never published (the release workflow stopped at the tests, before any upload). Same extension code as 2.3.0.

### Fixed

- Popup controller tests now pin the French locale: they compared French texts and failed on an English machine (GitHub Actions), which blocked the 2.3.0 release.

## [2.3.0] - 2026-10-12

### Added

- **Keyboard shortcut** `Alt+Shift+1` (`Alt+Shift+&` on AZERTY, same key): opens or closes the side panel, on any page. On Firefox it shows or hides the SyncKai sidebar. Shown with its *Change* button in *Settings › Shortcuts*. Already installed: the browser doesn't assign new suggested shortcuts on update, set it in `chrome://extensions/shortcuts` (Firefox: `about:addons` › gear icon › *Manage Extension Shortcuts*).
- **Disney+ (optional, Japanese anime only)**: turn it on in *Settings › Playback & sync*; the browser then asks for access to disneyplus.com, and turning it off removes that access. Titles whose original language is not Japanese are ignored silently, in the page (nothing sent, no notification, neutral popup and panel). The English series title is matched against AniList and trusted only when that entry links to Disney+; a title-only match goes through *To check*. Per-season numbering, season 99 arcs (*Undead Unluck: Winter Arc*) matched to their own AniList entry, sync at the start of the end credits like on Netflix and Crunchyroll (the credits time comes from the response the player receives when an episode starts; without it, or with the percentage trigger, at the chosen percentage). SyncKai sends no request to Disney+: a small script reads the responses the player already receives, keeping only what it needs (never stream addresses or tokens), and the position comes from the player's progress bar. Side panel, page entry and live progress on Disney+ playback pages; Disney+ logo in the popup and the panel. In a Disney+ tab opened before turning it on or before an update, tracking starts with the next episode.
- *On this page* and the side panel's *Now playing* tab now also work on Netflix and Disney+ series pages (when turned on), not only on playback pages: on Netflix, a series page (`/title/…`) or the details window opened from the catalog or search; on Disney+, a series page (`/browse/entity-…`). The season shown is the one selected on the page when it can be read (Netflix: the only season, or the season menu of the details window; Disney+: the season menu, otherwise the season displayed on load), otherwise SyncKai picks it as on Crunchyroll. Same anime filter as playback: an AniList entry linked to that Netflix title or that Disney+ series page is certain; on Disney+, a series without the *Anime* genre is ignored silently unless AniList links to it; a title-only match is shown as a season to check. As for playback, SyncKai sends no request to Disney+ (it reads the page data the site already receives). On series pages (Crunchyroll included), the side panel follows the season chosen in the page's season menu by itself.
- Clicking an anime's title or cover opens its AniList or MyAnimeList entry in a new tab, wherever it appears: *On this page*, *Watching*, *Recent syncs*, *To rate*, *AniList ↔ MAL differences*, and in the side panel the *Now playing* entry, its sequels and prequels, and the *Schedule*. With a single account connected, it opens that service's entry; with both, the new *Default entry page* setting (*Settings › Accounts*, AniList by default) decides, and the other service takes over if the anime has no known entry there. *Open the entry* in the ⋯ menu of *Watching* follows the same rule and names the service.

- **Remove from list**: the ⋯ menu of *Watching* (popup) and a new ⋯ menu on the side panel's *Your progress* card remove an anime from your AniList and MyAnimeList lists, after an inline confirmation (*Remove from your list?*). It is removed from every connected account where it is listed; a service where it isn't is skipped, and a failure on one service is named. The match with the streaming series is kept: if you watch an episode later, the sync adds it back as usual.
- **Comment on an entry** (AniList notes, MyAnimeList comments): a *Comment* field in the side panel's *Your progress* card (collapsed to a one-line preview) and *Comment…* in the ⋯ menu of *Watching* open a small editor; nothing is sent while typing, only on *Save* (Ctrl+Enter), and Escape cancels. The comment is saved on every connected account where the anime is in the list (never added to a list just for a comment); the one shown is AniList's, or MyAnimeList's if the anime is only there. Up to 6,000 characters (AniList's limit).
- **ADN history import**: *Settings › My data › Import a watch history* now offers Crunchyroll and ADN (the import page also lets you switch). SyncKai reads your ADN watch history in your own ADN tab, with the same request as the ADN website and the session it keeps in that tab (the access token never leaves the tab and is never saved), then uses the same preview, analysis and review as the Crunchyroll import: one line per season, last finished episode, matched with the same rules as the live ADN sync. Only finished episodes count (marked as watched by ADN, or past your end-of-episode percentage); an episode you only started is never imported. Nothing is filtered by genre (ADN also has Chinese and Korean animation): an uncertain match is never written, it goes to *To check*. If ADN refuses the request (signed out or expired session), the page asks you to sign in on ADN and reload the page, then try again.
- **Netflix history import** (anime only): *Settings › My data › Import a watch history* now also offers Netflix (and the import page lets you switch to it). If Netflix isn't turned on yet, the import page asks for access to netflix.com, which also turns on syncing while you watch on Netflix (same access as *Settings › Playback & sync*). SyncKai reads the *Viewing activity* page of the profile open in your Netflix tab: it clicks that page's own *Show more* button until the end of the history (at most once per second, nothing else is ever clicked), then looks each distinct title up on AniList (10 titles per request) and keeps only the series an AniList entry links to Netflix, or with the same title. Only for those, it reads your last playback position on each episode: an episode counts as watched only if it was played to the end Netflix marks (or the credits), never one you only started; Netflix keeps only the last position of each episode, so the highest watched episode of each season sets the progress. Same numbering and matching as the live Netflix sync (absolute numbering of One Piece arcs, seasons linked to another Netflix title), then the usual preview: a title-only match goes to *To check*, other titles are only counted (*N titles skipped (not anime)*), never listed. Analysis progress is shown at each step and can be stopped.
- **Settings › Shortcuts**: a new settings category gathers the extension's keyboard shortcuts (*Mark the current episode as watched*, *Open or close the side panel*). Each one shows its current key, or *Not set*, with a *Change* / *Set* button that opens the browser's shortcuts page (if it can't open, the steps to follow are shown). The settings home shows both keys at a glance, in the popup and in the side panel; a key changed in the browser shows up as soon as you come back to an open side panel. The keys are no longer shown in *Playback & sync*, which links to the new category.

### Changed

- **Side panel on every page** (Chrome, Brave), like the Firefox sidebar: it is no longer limited to Crunchyroll, ADN, Netflix and Disney+ tabs. It still never opens by itself, only from the popup's *Open the side panel* button (now shown on any page), the `Alt+Shift+1` shortcut or Chrome's side panel menu. It is now one panel per window, shared by its tabs: it stays open when you switch tabs and follows the active one. On a streaming page it shows *Now playing* as before (or the tab set in *Tab on opening*); elsewhere it opens on *Schedule*, and *Now playing* lists the supported platforms with a button to turn Netflix or Disney+ on. When the active tab leaves a streaming page while *Now playing* is shown, the panel switches to *Schedule*, and back to *Now playing* on the next streaming page; a tab you picked yourself is kept.
- `PRIVACY.md`: the AniList catalog search that checks Netflix and Disney+ titles is no longer described as made “without your account”; it is read-only, but carries your AniList token when you are signed in, like every AniList request.
- ADN (`animationdigitalnetwork.com`) is now declared in `host_permissions`, like Crunchyroll, so the import page can find the open ADN tab. Same sites as before: no new install warning.
- **Default keyboard shortcuts** are now `Alt+Shift+K` (mark the current episode as watched) and `Alt+Shift+1` (side panel; `Alt+Shift+&` on AZERTY), the same on Chrome, Brave and Firefox: `Alt+Shift+S` and `Alt+Shift+P` opened Firefox menus (*History*, *Profiles*), and `Alt+Shift+P` is also Chrome's *New tab group* shortcut. Existing installs keep a key you changed yourself; a missing key can be set in *Settings › Shortcuts*. In French, the settings show `Alt+Maj+1 (touche &)`.
- On Crunchyroll and ADN, the script SyncKai loads into the page is almost half the size (15% smaller on Netflix): nothing changes in use.

### Fixed

- The side panel outside supported pages now also names the optional platforms that are still off (e.g. “Disney+: can be turned on in Settings › Playback & sync”), instead of listing only the active ones, with a button to turn each one on right away (same browser permission prompt as in Settings).
- Changing the language no longer makes the popup look zoomed in: it is re-translated in place instead of being reloaded, staying on the same screen.
- Crunchyroll series pages recognize named seasons (e.g. One Piece « HEROINES »), and a season that is a single movie/special never matches a TV season by its number.
- Crunchyroll One Piece series page: arcs shown with their episode range (*Elbaph (1156-current)*) now resolve to ONE PIECE with certainty, and MONSTERS (a 2024 one-shot AniList lists as a prequel, on Netflix only) is no longer offered as "Season 2". A prequel released after the series, or an entry available only on another platform, is never treated as one of its seasons.
- Netflix: on a One Piece arc page (the single AniList entry covering every arc), the entry is no longer marked *Season guessed*. *Season guessed: check it below* is now only shown when there is a season selector to check.
- Fewer AniList requests: the AniList catalog (search results, linked entries) is kept for 5 minutes, and a long series whose entry already covers the episode (One Piece) no longer looks up its related entries. Browsing One Piece arcs on Netflix with the side panel open no longer runs into *Too many requests to AniList*.
- Crunchyroll: on a series page showing a special season (*Special*, *OVA*, *Movie*…), *On this page* and the side panel now show that special's AniList entry instead of season 1 marked *Season guessed*.
- Choosing the season in *On this page* or in the side panel no longer makes the entry reload in a loop until AniList refuses requests (*Too many requests to AniList*). The popup and the panel now reload the entry by themselves at most once every 2 seconds and 5 times a minute, then wait for a page change or *Refresh*.
- Netflix: a series published in several seasons, whose first seasons AniList links to another Netflix title (Ranma1/2), no longer syncs season 1 episodes to the last season's entry. SyncKai now matches each Netflix season to the AniList entry of the same season of the franchise (sequels and prequels, checked against the number of episodes of each Netflix season). When this can't be confirmed, the match goes to *To check* instead of being written. Netflix matches pointing to a sequel are checked once on update and forgotten: they are recomputed at the next episode. Progress already written to the wrong entry has to be fixed by hand.
- Disney+: a series that Disney+ publishes separately from its prequel (BLEACH: Thousand-Year Blood War) is no longer matched to the prequel's entry (BLEACH) for its first season.
- Netflix: the player is found again when it appears without any visible playback event (*No video detected* in the panel, end of episode never synced); SyncKai now looks for it every second until it shows up.
- Matches saved before 2.2.0 that sent the progress of a sequel published separately on Crunchyroll or ADN to the previous series (Naruto Shippuden to Naruto, Bleach TYBW to Bleach…) are checked against AniList on update and forgotten: they are recomputed at the next episode. If AniList doesn't respond, the check is retried at the next browser startup. A match that SyncKai can't be certain is wrong is kept: if a sequel still receives the wrong series' progress, use *Settings › My data › Matches › Forget*. Progress already written to the wrong series has to be fixed by hand.
- An episode watched while a correction (*Correct*) awaits your decision is no longer lost: it is set aside on the card (*Episode N on hold, applied after your decision*), then synced as soon as you confirm or ignore the correction, without ever moving your progress backwards. No more manual +1. It only applies to the account that was connected when you watched it.
- After disconnecting an account, *On this page* and the *Now playing* panel no longer show that account's list status, even if the entry was still loading when you disconnected. After connecting an account, the entry is no longer taken from an earlier cache that lacked its list.
- After a SyncKai update, Netflix tabs that are already open (with access granted) are picked up automatically, in Chrome and Firefox, without reloading the page: previously, the current episode was no longer tracked there. In Firefox, Crunchyroll and ADN tabs already were.
- Side panel: an episode waiting for you to confirm its AniList entry (found by title only) is shown as *To check* in the live progress, with the reason and what to do, instead of *Sync failed* in red; with no account connected, it shows *No account connected*. A real failure still shows *Sync failed*.

## [2.2.1] - 2026-10-11

### Fixed

- Netflix: shows whose seasons are arcs numbered continuously (e.g. One Piece) no longer get the previous arcs' episodes added again (E1180 was synced as 1377). Shows whose seasons restart at episode 1 are numbered as before.

## [2.2.0] - 2026-10-11

Reliability release: after a full audit of the extension, your progress never goes backwards, each account keeps its own data, and sign-in tokens are encrypted.

### Added

- The season picked in the popup or panel selector, on a playback page, is remembered: the current episode and the following ones are synced to that entry. To go back to automatic selection: *Forget* in *Settings › My data*. If the episode doesn't exist in that season, the card says so and nothing is remembered.
- After a SyncKai update, Crunchyroll and ADN tabs that are already open are picked up automatically in Chrome, without reloading the page. Otherwise, the *Reload the page* warning shows as soon as the episode opens or playback starts, not only at the end.
- SyncKai unreachable at the end of an episode: the bubble offers *Retry* (sent only once, even after several clicks). The confirm shortcut (Alt+Shift+S) also resends an episode that wrote nothing, and always answers on screen: *No episode playing*, *Episode already synced*, *Auto sync paused* or *Series excluded from sync*.
- +1 / −1 succeeded on one service and failed on the other: a *Retry* button writes the same episode to the failed service only, instead of clicking +1 again and shifting the one that succeeded.
- Accessibility: after an action (*+1*, *Retry*, *Forget*, *Ignore*, *Close*…), keyboard focus stays on the button or moves to the neighboring element instead of jumping back to the top of the popup; a button whose action is in progress stays focusable and is announced as "unavailable"; error messages are read only once by screen readers (NVDA, VoiceOver, Narrator), and the per-series results of the import and of list alignment no longer are (the summary is).

### Changed

- Pending syncs, *To rate* cards, recent syncs and corrections are tied to the account connected when they were created and only apply to it: after disconnecting, even if you reconnect the same account, they are no longer written. On update, existing ones are attached to the connected account (for an imported backup, to the account connected at import time).
- AniList ↔ MAL differences: *Keep AniList*, *Keep MAL* and *Match all to…* re-read both lists right before writing. A series changed or synced since the analysis is marked *Changed since the analysis* and left as is, instead of being rewritten with old values: alignment no longer moves progress or status backwards.
- Writes to the same series run one after another (sync, pending syncs, +1/−1, status, rating, rewatch, import, alignment): two +1 clicked at the same time from the popup and the panel really count as two, and an old episode resent later no longer moves progress backwards.
- +1 / −1 no longer add the series at episode 1 on a service where it isn't in your list: that service is left as is and the feedback says so (*Ep. 8 watched · not in your MyAnimeList list*). Adding stays reserved for the *Add* buttons.
- Popup and panel share the same "On this page" entry: same states and same messages, the popup card updates when a sync rewrites the entry, and a failed refresh keeps the entry displayed with the error.
- Fewer requests and less background work: the profile is re-read at most every 6 hours and the *Watching* list is kept for 90 seconds (*Retry* and every sync still re-read it), the service worker is no longer woken up by the popup and panel caches, and the playback page scripts, up to three times lighter, no longer receive every write to SyncKai's data. A language change applies to on-page messages without reloading, at the latest at the next episode.
- Backup: the exported file is named in the interface language (*synckai-backup-…*, *synckai-sicherung-…*), and *Export* from the popup opens the *Backup* page, which starts the download: the *Save as* dialog no longer closes the popup mid-export.
- Text: Netflix is mentioned on the welcome screen, in *Nothing in progress yet* (with an *Open Netflix* button when it's enabled), in the empty Schedule and in the panel outside Crunchyroll / ADN; the *Nothing in progress yet* tip shows the real path *Settings › Playback & sync* and opens it in one click.
- Every release is verified before publishing: package rebuilt identically from source, permissions checked, code analysis and broader tests.

### Fixed

- End of episode detected again when the player replaces its video (autoplay on Crunchyroll or Netflix), when a trailer precedes the player, in a background tab, or when the player takes more than 30 seconds to appear (ad, content warning, slow connection). On Crunchyroll, with autoplay (One Piece E1180 then E1181), the new episode is no longer identified with the previous one's title and number.
- A prequel or sequel published as a separate series on the platform (Naruto for Naruto Shippuden, Bleach for Bleach TYBW…) is no longer counted as a season of the series being watched. **If you watch such a sequel on Crunchyroll, check in AniList and MAL that the previous series didn't receive your progress**, and use *Settings › My data › Matches › Forget* if a match is wrong.
- Accounts: nothing from an old account is written to a new one any more (pending syncs, *To rate* and *Correct* cards, Crunchyroll import in progress), nor saved again after disconnecting (profile, *Watching* list, AniList ↔ MAL comparison, schedule, release alerts). *Reconnect* AniList first clears the old account's data, and both the page entry and the side panel are emptied as soon as you disconnect.
- Access revoked while no other service is connected: your tracking data is cleared, as after disconnecting; conversely, disconnecting MyAnimeList while AniList has merely expired no longer clears it. Revoked access or a session that can't be renewed during a background sync shows *Session expired* with *Reconnect*, instead of *Not connected*.
- Connections: several rejected MyAnimeList requests renew the session only once (fewer unexpected sign-outs); gives up after 20 seconds if MyAnimeList doesn't respond; session kept when hitting the rate limit (429); no more ghost reconnection after disconnecting during a renewal, nor a reconnection wiped out by a late response; a rejected first MyAnimeList connection gives the cause and the expected redirect URL; a response that's too slow shows *timed out* instead of *unexpected response*, and background tasks retry.
- Crunchyroll history import: a network drop, a rate limit or a transient error no longer loses the reading (new attempt after a short wait, unreadable season moved to *To check*); an unexpected response to the access request shows *Import unavailable*; a series written to AniList while MyAnimeList was unavailable is no longer counted as failed (only MyAnimeList is retried).
- Crunchyroll import and AniList ↔ MAL alignment: a job running during an extension update resumes on its own; a large history is analyzed and applied much more lightly; the reduced history is no longer kept after the analysis is stopped or fails (one left by a previous version is cleared); the *Already up to date* and *To check* blocks stay expanded or collapsed; *Start over* no longer clears an analysis started from another tab.
- Rewatch: +1 on the last episode completes it the same way auto sync does (*Completed* with one more rewatch, MyAnimeList leaves *Re-watching*), and *Correct* keeps the series in rewatch. **Series left in *Re-watching* on MyAnimeList by the old behavior must be fixed by hand on MyAnimeList.**
- *Correct* is refused with a message if progress changed since the sync (a series completed in the meantime stays completed), and the next episode of the same season is flagged *To check* until the correction is confirmed or ignored. **Corrections imported from a backup become simple checks.**
- Cards: a *To rate* card stays in Activity until a service has saved the rating (or if the series is in none of your lists) and is no longer cleared by another series being completed; a *To check* card confirmed during a service outage puts the episode on hold instead of losing it. No more rating bubble if the series already has a rating, at the end of a rewatch, or when only the MyAnimeList entry gets completed.
- Matches: a season followed while airing is no longer stuck when AniList publishes the continuation as a *Part 2* entry; an entry that can't be found (deleted, merged, not on MyAnimeList) shows the error right away instead of being resent in a loop for 24 h; a match from another SyncKai version is no longer cleared. Those from an imported backup are rejected if they look suspicious and re-checked against AniList on first use, instead of sending wrong progress.
- Release alerts: the *Watching* list is reloaded every 12 hours even without opening the popup (series added elsewhere get alerts, completed or dropped series no longer do, an episode that was just synced is no longer announced); a notification that failed to show is retried; lowering the alert delay no longer skips episodes; recent releases are no longer lost with many daily series; an excluded series no longer appears in the schedule or in alerts.
- Schedule: a loading error stays displayed with *Retry* and the same week is no longer requested twice in a row; *Adjust time* with 200 delays already set keeps the new setting and removes the oldest one; *Enter* in an empty delay field no longer saves 0 minutes.
- *Now playing* panel: the entry no longer stays stuck loading or grayed out when the tab finishes loading during the lookup, and an action that finishes after switching tab or episode no longer shows on the new page.
- Netflix: a movie now takes priority over a TV series with the same title (an entry found by its title alone goes through *To check*), and matches saved by 2.1.0 are recomputed at the next episode. Netflix turned off (Settings, `chrome://extensions` or `about:addons`): a tab left open no longer syncs anything and shows *Netflix is turned off*, the preferred player switches back to Crunchyroll (also after importing a backup), and *Open*, the schedule and notifications no longer open Netflix.
- SyncKai no longer changes the language declared by Crunchyroll, ADN and Netflix pages: no more unwanted translation prompts, correct language for screen readers, and the Crunchyroll import gets titles in your Crunchyroll account's language.
- Interface: while an alignment or import is paused, only the countdown changes (hover and focus no longer jump); an account whose profile could never be loaded shows the error with *Retry* and *Disconnect* instead of loading forever; the *Backup* page no longer lets you pick another file during an import; on Firefox, *Change* next to the shortcut opens the shortcuts page (or shows the steps to follow); in English and German, no more space before colons.

### Security

- AniList and MyAnimeList sign-in tokens are encrypted (AES-GCM) with a non-exportable key that web pages and content scripts can't read. Tokens from previous versions are encrypted on update: you stay signed in. If the key is lost (extension data cleared), the account shows *Session expired* and you just need to reconnect.
- Images (covers, banners, avatars) are only loaded from AniList and MyAnimeList servers: any other address, for example from an imported backup, is replaced with the fallback poster and blocked by the extension pages' security policy.
- From Crunchyroll, ADN and Netflix pages, SyncKai now only accepts playback messages (end of episode, rating, rewatch, panel); everything else is reserved for the extension's own pages.

## [2.1.0] - 2026-10-10

Netflix joins Crunchyroll and ADN, as an option and for anime only.

### Added

- **Netflix (optional)**: turn it on in *Settings › Playback & sync*; the browser then asks for access to netflix.com, and Netflix tabs that are already open work without reloading. Turning Netflix off removes that access.
- Since Netflix doesn't tell anime apart, only series whose AniList entry contains a link to the Netflix title are synced; a series found by its title alone goes through a *To check* card, and other titles are silently ignored (no notification, no log, neutral popup and panel).
- Continuous episode numbering from one Netflix season to the next, sync at the start of the credits (percentage fallback, as on Crunchyroll).
- Side panel, page entry and live progress on Netflix playback pages; Netflix logo in the popup and the panel, Netflix offered as preferred player and in the schedule settings.

### Changed

- Fewer AniList requests on Netflix: a series identified as not being anime is remembered for 24 h.

### Fixed

- "Watching" list stuck loading: after 25 s, an error message and a *Retry* button appear; a late response is still displayed.
- Diagnostic report: local storage blocked for more than 10 s is now reported in recent errors.

## [2.0.0] - 2026-10-08

Side panel, Crunchyroll history import and redesigned settings.

### Added

- **Side panel** (Crunchyroll and ADN): *Now playing* tab with the full AniList entry (synopsis, genres, studio, sequels with a *Watch* button when they're on Crunchyroll / ADN), your progress and actions, and a link to the episode discussion.
- Live progress in the panel (position, sync at the credits in X min, synced); the entry updates after the sync.
- **Schedule** (side panel): this week's releases for the series you're watching, with the estimated time on Crunchyroll / ADN (adjustable) and the episodes already watched.
- **Crunchyroll history import** (Settings): reads your history in your browser and updates AniList / MyAnimeList (preview before importing, never goes backwards, review when in doubt).
- End-to-end popup tests in continuous integration (a failure blocks the release).
- Side panel settings: tab opened by default, live progress display.

### Changed

- **Reorganized settings**: home screen by category with a summary of each setting, quick toggles (sync, alerts), subpages and danger zones; also reachable from the side panel.
- Crunchyroll, ADN, AniList and MyAnimeList logos instead of the CR / ADN / AL / MAL text badges (popup, side panel), bundled with the extension.
- Firefox: minimum version 142 (removes the AMO validation warning about Firefox for Android).

### Fixed

- Page entry: popup and panel show the same entry for a tab, updated right after the sync; a playback page read before it has fully loaded no longer yields a season guessed from the title alone (e.g. *Black Butler -Public School Arc-* shown as *Kuroshitsuji* 2008).
- ADN preferred player: SyncKai remembers the ADN series pages you visit (AniList almost never lists them); otherwise "Open" stays on Crunchyroll and the ⋯ menu offers "Search on ADN".
- Season matching: special seasons (OVA, extras, season 0) are never confused with the Nth season (a single movie or OVA with the exact title is recognized, otherwise you pick the entry); the season number in the title ("Season 2") takes precedence; a Crunchyroll season split into a "Part 2" on AniList is recognized without a link; absolute numbering on a single entry (One Piece) is considered safe.
- AniList rate limit: background tasks (import, list comparison) limit themselves to ~20 requests/min and let the popup and sync go first; after a refusal, waits at least 5 s (no more "try again in 0 s").

## [1.9.0] - 2026-10-07

SyncKai comes to Firefox.

### Added

- **Firefox version** (Firefox 140 or later, desktop): same features as on Chrome, published on Firefox Add-ons (AMO).
- "Allow access" banner in the popup if access to Crunchyroll / ADN has been removed (Firefox).
- Automatic publishing to the Chrome Web Store and Firefox Add-ons for every release.

### Changed

- AniList / MyAnimeList sign-in configured per browser.
- Firefox: new episode notifications without buttons (a click opens the episode).

## [1.8.0] - 2026-10-05

### Added

- **Status from the popup**: *Put on hold*, *Drop* or *Mark as completed* a series from the "…" menu in *Watching*, on all connected services (confirmation for Drop and Completed; the end-of-series rating is offered after Completed).
- **On this page**: on a Crunchyroll / ADN series or episode page, the popup shows the matching AniList entry; add it to "Plan to watch" or "Watching" if it isn't in your list, otherwise edit its progress, status and rating.
- **Compare AniList ↔ MyAnimeList** (Activity): spots differences in progress, status and rating, and series missing on one side, then aligns one series or the whole list to the service of your choice (nothing is fixed automatically).
- **Diagnostic report** (Settings › Help): copies a technical report with no sensitive data (version, browser, settings, latest errors) and opens a prefilled GitHub issue. The last 50 errors are kept locally.

### Changed

- AniList / MyAnimeList requests capped at 20 s; transient MyAnimeList errors (502, 503, 504, timeout) retried automatically during an alignment.
- Refreshed Chrome Web Store visuals (page entry, statuses, comparison) and a 1400×560 promo tile.

### Fixed

- Seasons split into several AniList entries ("Part 2", "Cour 2"): the Crunchyroll season is matched to the right group of entries (page entry, and the sync fallback by season number).
- Special episode filed under a season of the series (e.g. *ONE PIECE HEROINES*, season 30 of One Piece on Crunchyroll): sync and the page entry find its dedicated AniList entry instead of counting episode 1 of the main series; the page entry's season picker no longer offers movies or specials.

## [1.7.3] - 2026-10-03

### Added

- Continuous integration (GitHub Actions) and automatic publishing to the Chrome Web Store on every version tag.

### Changed

- Quiet console in production: only warnings and errors are shown; detailed logs are reserved for development builds (`npm run build:dev`).

## [1.7.2] - 2026-10-01

### Fixed

- "To check" card: buttons wrap to the next line instead of overflowing (German interface).

### Changed

- "Source code" and "Report a problem" links point to the new repository [Sync-Kai/SyncKai](https://github.com/Sync-Kai/SyncKai).

## [1.7.1] - 2026-10-01

### Changed

- New identity: the mascot **Kai** replaces Mochi (extension icons, popup header, welcome screen, empty list, on-page bubbles, import tab).
- User-oriented README, MIT license and privacy policy (FR/EN/DE); groundwork for publishing on the Chrome Web Store.

## [1.7.0] - 2026-10-01

Backup and multilingual interface.

### Added

- **Export / import** (Settings › Backup): JSON file with settings, matches, excluded series, series to rate, declined rewatches, pending checks and history — never the AniList/MAL sign-ins. Import in a dedicated tab: full validation, preview, **Merge** mode (default) or **Replace** (with confirmation), "Also import settings" option.
- **Interface in French, English and German** (Settings › Language: Automatic, Français, English, Deutsch). Extension name and description translated (`_locales`). Localized plurals, dates and durations (`Intl`). English by default for other Chrome languages.

## [1.6.0] - 2026-10-01

Rating, rewatch and new episode alerts.

### Added

- **End-of-series rating**: when a series moves to Completed, a bubble offers a rating out of 10 (10 stars, half points). Converted to the AniList score format of your profile (out of 100, out of 10 with decimals, out of 10, out of 5, smileys); rounded down to a whole number for MyAnimeList. "Later" creates a card in Activity › To rate.
- **Rewatch**: an episode watched on an already completed series offers a rewatch (AniList REPEATING, MAL `is_rewatching`); the following episodes move progress forward and the rewatch count goes up at the end. "No": no more asking for 30 days. Not offered for the last episode alone.
- **New episode alerts**: hourly check (a single batched AniList request) and a Chrome notification with "Open" on the preferred player; adjustable delay (0, 1, 3, 6 h); status of the last check and a "Check now" button in Settings.

### Changed

- +1 / −1 keeps an ongoing rewatch.
- The icon badge also counts series to rate.

## [1.5.0] - 2026-10-01

Reliability and manual control.

### Added

- **Offline sync queue**: a sync that fails temporarily (network, rate limit, server error) is queued and retried automatically (1 min, 5 min, 15 min, 1 h, 6 h), and abandoned after ~24 h. "Pending syncs" section in Activity with "Retry" / "Abandon".
- **+1 / −1** on each series in "Watching", written to all connected services.
- **Keyboard shortcut** `Alt+Shift+S`: immediately marks the current episode as watched (can be changed in `chrome://extensions/shortcuts`).
- **Per-series exclusion** ("Stop syncing this series") from Watching, To check cards and recent syncs; managed in Settings › Excluded series.

### Changed

- Status bar: failed or pending syncs shown first.
- The icon badge also counts abandoned syncs.

## [1.4.0] - 2026-10-01

Complete popup redesign ("Yoru Mochi · Kotatsu" direction): everything is now managed from the popup.

### Added

- **Watching**: list of the anime you're watching (AniList or MyAnimeList, with a picker if both are connected), with a "Continue" card for the last synced series.
- **Next episode**: "Ep. 3 available", "Ep. 5 in 18 h", "Next episode soon" or "Series finished" (AniList catalog, MyAnimeList included).
- **Sorting** the list: next release (default), last updated, title, episodes left — choice remembered.
- **Open** each anime on its platform (Crunchyroll, ADN), with a **Preferred player** setting when it's available on both.
- **Status bar**: "Everything is synced · … ago", items to check, expired session with "Reconnect".
- **On-page notifications** with 3 levels: *Discreet* (default: small pill, nothing in fullscreen), *Detailed*, *Alerts only*. Alerts are always shown.
- Checkmark on the extension icon after each successful sync.
- First-launch and empty-list screens with the Mochi mascot.

### Changed

- The options page is removed: its settings are now in the popup's Settings tab (accounts, playback, sync, notifications, matches).
- New visual style: warm dark theme, bundled M PLUS Rounded 1c and Nunito fonts (Latin subsets), bubble-style toasts.
- The old "toasts on / off" setting is migrated to the equivalent notification level.

### Fixed

- The "Watching" list updates after a sync even while the popup is open.
- MyAnimeList: series rated for adults and lists of more than 100 series are included.
- A list's cache is cleared when the matching account is disconnected.

## [1.3.0] - 2026-09-30

### Added

- **MyAnimeList**: sign-in (OAuth2 + PKCE, no secret, automatic token renewal), account card in the popup, progress sync alongside AniList.
- Each account is optional: MyAnimeList works without an AniList account (public AniList catalog for matching, then `idMal`).
- Per-service result in the toast, and "Retry" limited to the services that failed.

### Changed

- Disconnect each service from its own card; checks and history are only cleared when the last account is disconnected.
- Tracking services behind a common interface (Adapter pattern, `src/background/trackers/`).

## [1.2.0] - 2026-09-30

### Added

- **ADN adapter** (animationdigitalnetwork.com): episode detection (JSON-LD, fallback to the video.js player), navigation between episodes without reloading, completion at the configured percentage (ADN doesn't provide the start of the credits).
- AniList matching via the ADN links on entries (`/video/{id}-{slug}`, old slug-based format).
- Automatic matching by title when a single AniList entry (series) has exactly that title and it's season 1; other cases without a platform link still need to be checked.

### Changed

- Playback helpers (JSON-LD, text, stale-data guard) shared between adapters.
- Explicit "to check" reason when the AniList entry was only found by its title (no link to the platform).

## [1.1.0] - 2026-09-30

### Added

- **Extension icons** (16 to 128 px), generated by `npm run icons`.
- **Options page** ("Options" link in the popup):
  - pause automatic sync;
  - trigger at the end credits or at an adjustable percentage (70–98%);
  - turn confirmation toasts on or off (alerts are still shown);
  - list of remembered matches, with "Forget" per season and a full reset.
- **"Retry" button** in the toast when a sync fails (network, AniList unavailable): the episode is no longer lost.

### Changed

- AniList rate limit (429): automatic retry if AniList asks for a short wait (≤ 20 s).
- Minimum Chrome version: 116.

### Fixed

- The next episode could be marked as watched as soon as you navigated to it (last moments of the previous episode were counted).
- A correction on the same AniList entry couldn't lower progress.
- A check arriving while a result was displayed only appeared when the popup was reopened.
- Concurrent storage writes (popup, options, sync) could overwrite each other.
- Alerts no longer appeared if the "Syncing…" toast had been closed.
- The Crunchyroll player didn't take priority over another `<video>` tag on the page.
- Silent errors: the service worker fallback response and failures to save settings or "Ignore" are now shown.

## [1.0.0] - 2026-09-30

First release: automatic Crunchyroll → AniList sync.

### Added

- **AniList sign-in** (OAuth2 Implicit Grant via `chrome.identity`), sign-out and profile display (avatar, username, link to the profile).
- **Crunchyroll adapter**: detection of playback pages (including SPA navigation), extraction of the anime, season and episode numbers (JSON-LD, DOM fallback with stale-data detection).
- **End-of-episode detection** at the start of the end credits (Crunchyroll "skip events" data), with a fallback at 85% of the video. Ads (videos under 2 min) are ignored.
- **AniList sync**:
  - entry lookup via the Crunchyroll links on AniList entries, then season order (sequels/prequels);
  - handling of absolute numbering (e.g. One Piece E1180) and per-season relative numbering, including seasons split into several entries;
  - update rules: never backwards, moves to "Watching" then "Completed", completed entries and rewatches left untouched;
  - matches remembered per season.
- **In-page toast** (works in fullscreen) showing the result of each sync.
- **Manual review** of uncertain matches from the popup (suggested entries, search, episode number), with a badge on the extension icon.
- **Recent syncs** in the popup, with after-the-fact correction of a match.

[2.3.1]: https://github.com/Sync-Kai/SyncKai/releases/tag/v2.3.1
[2.3.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v2.3.0
[2.2.1]: https://github.com/Sync-Kai/SyncKai/releases/tag/v2.2.1
[2.2.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v2.2.0
[2.1.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v2.1.0
[2.0.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v2.0.0
[1.9.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.9.0
[1.8.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.8.0
[1.7.3]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.7.3
[1.7.2]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.7.2
[1.7.1]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.7.1
[1.7.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.7.0
[1.6.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.6.0
[1.5.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.5.0
[1.4.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.4.0
[1.3.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.3.0
[1.2.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.2.0
[1.1.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.1.0
[1.0.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.0.0
