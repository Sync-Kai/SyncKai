# Manual tests (2.2.0 and later)

What the automated tests don't cover: run through in **Brave/Chrome** and **Firefox**, with the `dist/` build (`npm run build`, or `npm run dev`), extension reloaded, then tabs reopened. Tick items as you go; on failure, note the browser and attach the console (F12) of the page and of the service worker.

Tip to simulate a service outage: developer tools of the popup (right-click › Inspect) or of the service worker (`chrome://extensions` › SyncKai › "service worker") › **Network** tab › right-click a request › **Block request URL** (`api.myanimelist.net` or `graphql.anilist.co`). Unblock afterwards.

## 1. Update and accounts

- [ ] **Update from the Store version** (the most important one): install the published version, sign in to AniList and MAL, leave a Crunchyroll tab open, then load the new build (*Reload*). Expected: both accounts stay connected, the open tab keeps working without reloading it (Chrome), or shows *Reload the page* as soon as playback starts (Firefox).
- [ ] **Encrypted tokens**: service worker console → `chrome.storage.local.get(['anilistToken','malToken'], console.log)`. Expected: `{ v: 1, iv, data, expiresAt }`, never the plain-text token.
- [ ] **Expired session**: revoke SyncKai on anilist.co (Settings › Apps), start a sync. Expected: *Session expired* in red with *Reconnect* (not *Not connected*); *Reconnect* restores everything.
- [ ] **Account switch**: block AniList, finish an episode (it goes to *Pending syncs*), disconnect AniList, sign in with another account, unblock. Expected: nothing is written to the new account.

## 2. Sync and controls

- [ ] **Partial failure, then Retry**: block MAL, press *+1* on a series. Expected: banner *Ep. N watched · failed on MyAnimeList* with *Retry*; unblock, click: MAL catches up, AniList doesn't change.
- [ ] **Simultaneous +1**: *+1* on the same series in the side panel and in the popup, within the same second. Expected: +2 in total on AniList and MAL.
- [ ] **Rewatch** (if a series lends itself to it): series being rewatched at 11/12, *+1*. Expected: *Completed* with one more rewatch; MAL is no longer in *Re-watching*.
- [ ] **Correct**: Activity › *Recent syncs* › *Correct* on a series, then start the next episode without confirming. Expected: the card stays, nothing is written (after the batch 5 fix: the episode is remembered and applied after the decision).
- [ ] **No duplicate rating**: finish the last episode of an already rated series. Expected: no *Rate* bubble.
- [ ] **AniList ↔ MAL differences**: *Analyze*, press *+1* on a series with a difference, come back. Expected: *Changed since the analysis*, *Keep* buttons greyed out; an unchanged difference is matched normally.

## 3. Playback detection

- [ ] **Autoplay** on Crunchyroll (and Netflix): let the next episode start on its own. Expected: both episodes sync, the popup shows the right number.
- [ ] **Background tab**: open an episode in a background tab, wait more than a minute, then watch it. Expected: normal sync at the end.
- [ ] **Alt+Shift+K shortcut**: on a series page → *No episode playing*; on an already synced episode → *Episode already synced*; sync paused → explanatory message.
- [ ] **Page language**: Crunchyroll in a different language than SyncKai; page console → `document.documentElement.lang`. Expected: the site's language, not SyncKai's.
- [ ] **ADN**: an ADN episode is detected and synced; the entry shows in the popup and the side panel.

## 4. Netflix

- [ ] **Access removed**: Netflix turned on, Netflix tab open; remove the access in `brave://extensions` (Firefox: `about:addons` › Permissions) without reloading the tab, finish the episode. Expected: nothing is synced, popup/side panel show *Netflix is turned off*; the preferred player switches back to Crunchyroll.
- [ ] **Non-anime series**: nothing is shown, no error in Settings › Help.

## 5. Side panel and schedule

- [ ] **Panel while loading**: open the side panel while an episode is loading. Expected: the entry shows (no endless skeleton).
- [ ] **Action, then episode change**: *+1* in the side panel, then immediately start another episode. Expected: the new episode's entry stays displayed.
- [ ] **Schedule error**: block AniList, open the Schedule. Expected: the error message and *Retry* stay visible.
- [ ] **Alt+Shift+1 shortcut** (Alt+Shift+& on AZERTY; if *Settings › Shortcuts* shows it as *Not set*, set it first): on a Crunchyroll or ADN episode → the panel opens, even right after the page loads, and a second press closes it (also after leaving the panel open for more than a minute: service worker asleep); with two windows each showing a panel, only the focused window's panel closes; on another site → nothing (Brave/Chrome); Firefox → the sidebar shows, a second press hides it.
- [ ] **Settings › Shortcuts** (popup and side panel): the home row shows both keys (French: *Alt+Maj+K · Alt+Maj+1 (touche &)*; English and German without the AZERTY hint); the page shows each key or *Not set*; *Change* / *Set* opens `chrome://extensions/shortcuts` (Brave: `brave://extensions/shortcuts`) or Firefox's *Manage Extension Shortcuts*. Change a key there, come back to the side panel (still open): the new key shows without reopening it. *Playback & sync* shows no key any more, only the *Keyboard shortcuts* link.
- [ ] **Default keys** (Chrome, Brave, Firefox): on a fresh install (new profile), Alt+Shift+K marks the episode as watched and Alt+Shift+1 (AZERTY: Alt+Shift+&) toggles the panel, without opening any browser menu (Firefox in French, English and German; Firefox with the new profile manager on, whose *Profiles* menu took Alt+Shift+P) and without creating a tab group (Chrome). Update an existing install: a key changed by hand is kept; note whether an untouched Alt+Shift+S / Alt+Shift+P switched to the new keys or stayed (expected from the browsers' source: switches when the new key is free).
- [ ] **Season choice**: on an episode of a series with split seasons, pick another season in the side panel, finish the episode. Expected: the progress goes to the chosen season; Settings › My data lists the match.

## 6. Alerts, import, backup

- [ ] **Alerts without the popup**: leave the popup closed for more than 12 h with a series in progress that airs. Expected: the notification arrives.
- [ ] **Crunchyroll import**: Settings › My data › Import a watch history › Crunchyroll; turn Wi-Fi off for 5 s during "Checking episode numbering". Expected: reading resumes and completes. Reload the extension while applying: it resumes on its own.
- [ ] **ADN import** (Brave and Firefox, signed in on ADN): *Settings › My data › Import a watch history › ADN* (or the *ADN* switch on the import page). Expected: "ADN tab ready", *Read my history* shows the pages read, then the analysis and the preview; series labelled "ADN: …"; an episode only started (a few seconds) never raises the progress; a donghua / manhwa (e.g. *The Girl Downstairs*) is either matched with certainty or listed in *To check*, never written blindly. ⚠️ *Update N series* writes to the real AniList / MyAnimeList lists: check the preview first, uncheck what you don't want, or stop at the preview and *Start over*.
- [ ] **ADN import, signed out**: sign out of ADN (or wait for an expired session), read again. Expected: "Open ADN in that tab and sign in (reload the page if you already are)", no analysis. Sign in, reload the ADN tab, read again: it works.
- [ ] **ADN import, privacy**: DevTools of the ADN tab › Network: one `viewing/history?offset=…&limit=100&onlyNext=false` request per 100 episodes, no cookies sent, the same headers as the site; Console: no token printed. DevTools of the import page: the port messages carry episodes only.
- [ ] **Netflix import, access not granted** (Brave and Firefox, Netflix turned off in *Settings › Playback & sync*): *Settings › My data › Import a watch history › Netflix*. Expected: the page explains that Netflix is optional and *Allow access* asks for netflix.com; once granted, *Settings › Playback & sync* shows Netflix on, and an already open Netflix tab is tracked without reloading (Firefox: reload it if not).
- [ ] **Netflix import** (Brave and Firefox, signed in, profile chosen): open *Account › Viewing activity* (`netflix.com/viewingactivity`) or use *Open Netflix* on the import page, then *Read my history*. Expected: the Netflix tab's *Show more* button is clicked about once per second until it disappears (watch the tab: nothing else is clicked, no row is hidden), "Loading your Netflix history: N rows…", then "Looking for anime on AniList: x / y titles", then "Reading your Netflix progress: x / y series", then the analysis and the preview ("Netflix: …", *N titles skipped (not anime)*). Ranma ½ S1 shows progress 5 (E6 stopped before the end is not counted); One Piece Elbaph Arc E1162 (5 s) and E1180 (partial) never raise the progress; films and western series are never listed. ⚠️ *Update N series* writes to the real AniList / MyAnimeList lists: check the preview first, uncheck what you don't want, or stop at the preview and *Start over*.
- [ ] **Netflix import, stop and errors**: *Stop* while rows load → back to the start, no AniList request. Netflix tab on another page (e.g. `/browse`) → "Open netflix.com/viewingactivity in that tab"; signed out or profile gate → sign-in message. Tab opened before an extension update (old bridge) → "The Netflix tab doesn't respond: reload it", after ~20 s at most.
- [ ] **Netflix import, privacy**: DevTools of the Netflix tab › Network: only Netflix's own requests after each *Show more* click (`pathEvaluator`), then one `metadata?movieid=…&languages=en-US` per anime kept (never per non-anime title); Console: no title printed. DevTools of the service worker: `Filtre Netflix : k / 10 titres gardés` lines with counts only.
- [ ] **Backup**: *Export* from the popup (opens the *Backup* page, file name in the interface language), then import it again. Expected: settings and matches are kept.

## 7. Accessibility (quick)

- [ ] **Keyboard**: in *Watching*, Tab to *+1*, Enter. Expected: focus stays on the button during and after sending.
- [ ] **Screen reader** (NVDA/Narrator, optional): an error is announced only once.

## 8. Link to the entry (in development)

- [ ] Title and poster open the entry from the popup (*On this page*, *Watching*, *Recent syncs*, *To rate*, *Differences*) and the side panel (*Now playing*, sequels, *Schedule*).
- [ ] Settings › Accounts › *Default entry page* set to MAL: links open myanimelist.net; with only one account connected, the row disappears and the link follows that account.

## 9. Remove from list and comment (in development)

**These checks write to your real AniList and MyAnimeList lists.** Use a throwaway anime that is in both lists (add it first with *On this page* › *Add to Plan to watch*, or on the sites), never a series you track.

- [ ] **Remove from the popup**: *Watching* › ⋯ on the throwaway series › *Remove from list*. Expected: inline *Remove from your list?* with focus on *Cancel*; *Cancel* (or Escape) sends nothing. *Remove*: the row disappears, banner *{title}: removed from your list*; anilist.co and myanimelist.net no longer list it. Reopen the popup within 90 s: it doesn't come back.
- [ ] **Remove from the side panel**: on a playback page of the throwaway series, *Your progress* › ⋯ › *Remove from list* › *Remove*. Expected: the card switches to *Add to Plan to watch / Watching*, no ⋯ button, *Comment* disabled with *Add the series to your list to comment on it.*
- [ ] **Only on one service**: remove the series on myanimelist.net only, then *Remove from list* in SyncKai. Expected: removed from AniList, MAL skipped (no error).
- [ ] **Failure**: block `api.myanimelist.net`, *Remove from list*. Expected: banner *… removed from your list · failed MyAnimeList* (AniList removed, MAL kept); unblock and remove again: MAL is removed.
- [ ] **Watched again later**: after removing, finish an episode of that series. Expected: the sync adds it back to both lists (same AniList entry, the match was kept).
- [ ] **Comment in the side panel**: *Your progress* › *Comment* › type a few lines › *Save* (or Ctrl+Enter). Expected: nothing is sent while typing; *Comment saved*; the collapsed row previews the first line; anilist.co (entry › Notes) and myanimelist.net (Edit › Comments) show the text. Clear the text and save: *Comment cleared* on both sites.
- [ ] **Comment in the popup**: ⋯ › *Comment…*. Expected: editor under the row, focus in the text box, existing comment loaded (AniList's when the series is on AniList, else MAL's); Escape closes without saving; the counter stops at 6000 characters.
- [ ] **Not in the list**: on a series in neither list, the panel's *Comment* is disabled with its explanation; in the popup (MAL-only series with AniList connected, or removed meanwhile), saving shows *Add the series to your list to comment on it.* and nothing is added.
- [ ] **Firefox**: same remove and comment checks in the sidebar and the popup.
