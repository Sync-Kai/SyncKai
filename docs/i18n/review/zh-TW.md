# zh-TW review log

Independent review of `src/i18n/locales/zh-TW.json` (878 keys) and `public/_locales/zh_TW/messages.json`, 2026-10-14, by a Traditional Chinese (Taiwan) reviewer. Inputs: `docs/i18n/GLOSSARY.md`, `docs/i18n/glossary/zh-TW.md`, `docs/i18n/context.json`, `en.json`, `fr.json`, `de.json`.

## Method

1. **Terminology audit**: every term-sheet decision checked against Taiwan anime-fan and tracker usage, then searched across the catalog for consistency (series, season, episode, list, entry, sync, to check, to rate, score, comment, match, excluded, pending sync, credits, popup, side panel, Now playing, Schedule, On this page, preferred player, history import, backup, preview, rewatch, account / connect / session expired, release alerts, Settings and its categories, the six list statuses, Activity, Watching).
2. **Key-by-key review** of all 878 keys against en and fr with their context notes: meaning, grammar, register, naturalness, placeholders, composed texts (`{service}：{message}`, `{title}：…`, relative times, `{when}重試`, `{time}後同步`, `{sort}排序`), cross-references, length.
3. **Automated checks** (scripts outside the repo): every Han code point checked against Simplified and Japanese variants (內, 說, 錄, 啟, 戶, 換, 閱, 為, 裡, 著, 查, 冊… all correct Traditional forms; no Simplified leftovers); half-width punctuation next to Han, missing CJK–Latin spacing, spaces next to full-width punctuation, `...`, straight or curly quotes, double spaces; mainland vocabulary list (设置-type terms, 點擊, 保存, 推薦…); every 「…」 quote matched against the catalog value of the element it names.
4. **External verification** of names the catalog quotes from other products:
   - Netflix Taiwan help center, [如何查看觀影記錄和裝置活動](https://help.netflix.com/zh-tw/node/101917): the Viewing activity page is 「觀影動態」, the button 「顯示更多」, profiles are 使用者 (the catalog said 「觀看記錄」 and 個人檔案).
   - Firefox zh-TW (`mozilla-l10n/firefox-l10n`, `aboutAddons.ftl`): `addon-manage-extensions-shortcuts = 管理擴充套件快速鍵`, as the catalog already says.
5. `npm run i18n:check -- zh-TW`: 0 errors, 0 warnings, before and after the fixes.

The translation was already of good quality: correct Traditional characters throughout, genuine Taiwan vocabulary (設定, 帳號, 登入, 影片, 檔案, 清單, 載入, 儲存, 搜尋, 匯入, 預設, 支援, 存取, 逾時, 快取, 權杖, 用戶端…), clean full-width typography and consistent core terms. The fixes below are mostly naturalness, three Netflix names, the mainland verb 點擊 and the "Recommended" convention.

## Changes

47 changes (46 catalog keys, 1 browser string): style 22, terminology 9, cross-reference 5, meaning 4, grammar 3, typography 3, consistency 1.

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `agenda.adjust.reset` | 預設 | 恢復預設 | meaning | A bare 預設 reads as the noun "default"; the button restores the platform default delay |
| `airing.notification.message` | 已在日本播出 · 通常幾小時內就會上架 Crunchyroll/ADN | 已在日本播出 · 通常幾小時內就會在 Crunchyroll/ADN 上架 | grammar | 上架 is intransitive: 在 X 上架, not 上架 X |
| `compare.result.failed_other` | {count} 部失敗 | 失敗 {count} 部 | style | Same banner reads 已更新 N 部 · 已略過 N 部: keep the fragments parallel |
| `content.shortcut.noPlayback.title` | 沒有正在播放的集數 | 目前沒有在播放 | style | 集數 means an episode number/count, not "an episode"; natural toast title |
| `content.shortcut.paused.message` | 請在「設定」重新開啟自動同步，然後再試一次。 | 請在「設定」中重新開啟「自動同步」，然後再試一次。 | cross-reference | Quote the toggle label (settings.autoSync.label) like every other UI label; 在…中 |
| `crImport.analyze.starting` | 正在開始分析… | 正在啟動分析… | style | 正在開始 is a calque of "Starting" |
| `crImport.analyze.running` | 分析：{done} / {total} 季 | 分析中：{done} / {total} 季 | style | Progress line of a running task: 分析中 reads naturally |
| `crImport.apply.running` | 匯入：{done} / {total} 部 | 匯入中：{done} / {total} 部 | style | Same as crImport.analyze.running |
| `crImport.preview.failed_other` | {count} 季找不到（錯誤） | {count} 季查詢失敗 | meaning | The AniList lookup failed because of an error; 找不到（錯誤） is a literal calque |
| `crImport.reason.numbering` | 不知道這一集在該季中的位置（該季已從片庫下架？） | 無法得知這一集在該季中的位置（該季已從片庫下架？） | style | 不知道 is too colloquial for a reason line saved on a card |
| `crImport.error.notConnected` | 請連結 AniList 或 MyAnimeList（設定），才能匯入你的觀看記錄。 | 請在「設定」中連結 AniList 或 MyAnimeList，才能匯入你的觀看記錄。 | style | Parenthetical （設定） is an English calque; name the place where it is done |
| `crImport.read.error.netflixLoggedOut` | 請在該分頁登入 Netflix 並選擇你的個人檔案，接著重新開啟「觀看記錄」頁面，然後重新讀取。 | 請在該分頁登入 Netflix 並選擇使用者，接著重新開啟「觀影動態」頁面，然後重新讀取。 | cross-reference | Netflix Taiwan names the page 「觀影動態」 and calls profiles 使用者 (help.netflix.com/zh-tw/node/101917) |
| `crImport.netflix.rule` | Netflix：SyncKai 只會點擊「觀看記錄」頁面的「顯示更多」按鈕來載入記錄（不會點擊其他任何東西），保留在 AniList 上找到的動畫，並讀取它們的進度。 | Netflix：SyncKai 只會點選「觀影動態」頁面的「顯示更多」按鈕來載入觀看記錄（不會點選其他任何東西），保留在 AniList 上找到的動畫，並讀取它們的進度。 | cross-reference | Netflix Taiwan page name 「觀影動態」 (button 「顯示更多」 confirmed); 點擊 → 點選 |
| `crImport.netflix.keepTab` | 請讓 Netflix 分頁停留在「觀看記錄」頁面：讀取可能需要幾分鐘。 | 請讓 Netflix 分頁停留在「觀影動態」頁面：讀取可能需要幾分鐘。 | cross-reference | Netflix Taiwan page name |
| `engagement.deferFailed` | 無法儲存「稍後評分」。 | 無法延後評分。 | meaning | Quoted a label that does not exist (the button is 「稍後」); plain statement |
| `feedback.ignored.message` | 沒有任何 AniList 條目連結到這個平台上的此作品：它可能不是動畫。 | AniList 上沒有條目連結到此平台的這部作品，很可能不是動畫。 | style | Shown as {title}：{message}, so the inner colon gave two colons; "probably" = 很可能 |
| `feedback.notConnected.message` | 點擊 SyncKai 圖示來連結 AniList 或 MyAnimeList。 | 點一下 SyncKai 圖示，即可連結 AniList 或 MyAnimeList。 | terminology | 點擊 is the mainland UI verb; Taiwan UIs say 點一下 / 點選 / 按一下 |
| `feedback.review.message` | {reason}。點擊 SyncKai 圖示來選擇條目。 | {reason}。點一下 SyncKai 圖示來選擇條目。 | terminology | 點擊 → 點一下 (Taiwan) |
| `panel.live.reviewHint` | 點擊 SyncKai 圖示來選擇條目。 | 點一下 SyncKai 圖示來選擇條目。 | terminology | 點擊 → 點一下 (Taiwan) |
| `settings.entry.help` | 兩個帳號都已連結時，點擊動畫標題或封面所開啟的頁面 | 兩個帳號都已連結時，點選動畫標題或封面所開啟的頁面 | terminology | 點擊 → 點選 (Taiwan) |
| `import.merge.title` | 合併（推薦） | 合併（建議） | terminology | Taiwan UI convention for "(recommended)" is （建議） (Windows, iOS zh-TW); 推薦 is for content |
| `onboarding.hint.anilist` | 推薦使用，作品辨識更準確 | 建議使用，作品辨識更準確 | terminology | Recommended = 建議 (term sheet updated) |
| `settings.recommended` | 推薦 | 建議 | terminology | Recommended = 建議 (term sheet updated) |
| `settings.trigger.credits` | 片尾開始時（推薦） | 片尾開始時（建議） | terminology | Recommended = 建議 (term sheet updated) |
| `match.undetermined` | 無法判斷對應的 AniList 季 | 無法判斷 AniList 上對應的是哪一季 | style | 「AniList 季」 is not idiomatic |
| `page.notTracked` | 這裡沒有可追蹤的內容：在 {platform} 上，SyncKai 只會追蹤 AniList 認得的動畫。 | 這裡沒有可追蹤的內容：在 {platform} 上，SyncKai 只會追蹤 AniList 有收錄的動畫。 | style | 認得 personifies the database; 收錄 is the usual word for "listed in a database" |
| `page.platformOff` | {platform} 已停用：SyncKai 不會在這裡追蹤任何內容。如要重新啟用：設定 › 播放與同步。 | {platform} 已停用：SyncKai 不會在這裡追蹤任何內容。如要重新啟用，請前往「設定 › 播放與同步」。 | typography | Settings paths in sentences are quoted (term sheet); the colon construction was clipped |
| `page.title` | 此頁面上 | 目前頁面 | style | A locative phrase as a card heading is translationese (term sheet updated) |
| `panel.offTargetEnable` | {platforms}：可在 {path} 中啟用。 | {platforms}：可在「{path}」中啟用。 | typography | {path} is plain text "設定 › 播放與同步": quote it like other settings paths, no stray spaces in CJK text |
| `watching.tip` | Netflix、Disney+（選用）和你的偏好播放平台，都可以在 {path} 調整。 | Netflix、Disney+（選用）和你的偏好播放平台，都可以在「{path}」中調整。 | typography | Same rule; the clickable path no longer sits between two ASCII spaces |
| `panel.nowPlaying.readMore` | 閱讀更多 | 展開 | style | Toggle paired with 收合 (Show less): 展開 / 收合 is the Taiwan UI pair |
| `panel.nowPlaying.score` | AniList 平均分數：{score}% | AniList 平均評分：{score}% | consistency | score = 評分 everywhere else |
| `prompt.rating.question` | 你的評分？ | 你給幾分？ | style | 你的評分？ is a calque; natural fan-to-fan question above the stars |
| `settings.ratingPrompt.help` | 動畫標記為「已看完」時，跳出「你的評分？」泡泡 | 動畫標記為「已看完」時，跳出「你給幾分？」泡泡 | cross-reference | Must quote prompt.rating.question exactly |
| `prompt.rewatch.failed` | 重看未儲存 | 重看狀態未儲存 | style | What failed is saving the Rewatching status; clearer bubble title |
| `prompt.rewatch.saving` | 正在開始重看… | 正在設為重看中… | style | Calque of "Rewatching…"; the step sets the list status to 重看中 |
| `review.noCandidates` | 沒有建議的條目：請使用搜尋。 | 沒有建議的條目：請改用搜尋。 | style | 請使用搜尋 is stiff; 改用 = "use … instead" |
| `review.results` | 結果（{count}） | 搜尋結果（{count}） | style | A bare 結果 heading is vague; these are search results |
| `recent.empty` | 還沒有任何同步。 | 還沒有同步記錄。 | style | More natural empty state; matches 同步記錄 used for SyncKai history |
| `sync.recentNotFound` | 找不到這筆同步。 | 找不到這筆同步記錄。 | style | 這筆同步 is incomplete without 記錄 |
| `sync.sessionClosed` | 帳號之後已登出或切換：未寫入任何資料 | 帳號在此期間已登出或切換：未寫入任何資料 | grammar | 之後已 does not express "since then" |
| `sync.correctionPending` | 這一季有待處理的更正：等你在「動態」中對它的卡片做出決定後，才會套用這一集 | 這一季有待處理的更正：等你在「動態」中處理對應的卡片後，才會套用這一集 | style | 對它的卡片做出決定 is clumsy |
| `settings.offsets.help` | 日本播出後的分鐘數，用於時間表（側邊面板）。個別動畫可在時間表中它那一列另外調整。 | 日本播出後的分鐘數，用於「時間表」（側邊面板）。個別動畫可在時間表的該列中單獨調整。 | grammar | 它那一列 is ungrammatical in writing; quote the tab name |
| `settings.help.text` | 錯誤只會保存在這個瀏覽器中。只有在你複製報告時才會分享出去。 | 錯誤記錄只會保留在這個瀏覽器中。只有在你複製報告時才會分享出去。 | terminology | 保存 has the mainland "save" flavour; 保留 = kept |
| `settings.ratingPrompt.label` | 看完一部動畫時邀請評分 | 看完一部動畫時詢問評分 | style | 邀請評分 is unnatural; 詢問評分 = ask for a score |
| `watching.nextWatched` | 下一集已看 | 將下一集標記為已看 | meaning | Tooltip of the +1 button describes the action, not a state (same wording as watching.plusOneAria) |
| `messages.json › extDescription` | 自動將你在 Crunchyroll、ADN 看的動畫同步到 AniList 和 MyAnimeList。 | 自動將你在 Crunchyroll、ADN 上看的動畫同步到 AniList 和 MyAnimeList。 | style | 在 X 上看 reads more smoothly |

Term sheet updated accordingly (`docs/i18n/glossary/zh-TW.md`): Recommended → 建議 / （建議）; On this page → 目前頁面; click instructions 點一下 / 點選, never 點擊; settings paths and `{path}` quoted in running text; average score → 平均評分; Read more / Show less → 展開 / 收合; section 4 rewritten with the verified Netflix names (觀影動態, 顯示更多, 使用者).

## Debatable, left unchanged

| Key | Text | Why it stays |
|---|---|---|
| `settings.notif.discreet.title` | 低調 | Colloquial but exactly "unobtrusive"; 精簡 / 簡潔 would describe length rather than discretion. Pairs well with 詳細 / 僅限警示 |
| `nav.activity` | 動態 | The usual Taiwan word for an activity feed (Facebook, Instagram, AniList's own Activity). 活動 would read as "event / promotion" |
| `panel.tab.agenda`, `settings.section.agenda` | 時間表 | Fans also say 新番時間表 or 播出表; 時間表 is neutral and short enough for the tab (≤ 12 chars) |
| `popup` (term) | 彈出視窗 | Chrome zh-TW writes 彈出式視窗 for page pop-ups; the shorter form is common and natural for an extension popup |
| `agenda.day.none` | 沒有播出 | Could be 沒有新集數 (wording of `agenda.empty.week`); "nothing airs" is accurate next to a day heading |
| `page.seasonPicker` | 季 | One-character label before a dropdown whose options already read 第 2 季 — …; 季別 or 季數 would not be better |
| `page.airing.CANCELLED` | 已取消 | 已停播 is also possible; 已取消 mirrors AniList's "Cancelled" and stays distinct from 停播中 (hiatus) |
| `watching.badge.upcoming` | 第 {episode} 集 {delay}後 | Two numbers side by side ("第 5 集 18 小時後") but 集 separates them; a full sentence would not fit the ≈ 22-character chip |
| `compare.chip.entry` | {service} {status} · 第 {progress} 集 | Progress shown as an episode ordinal, as the term sheet sets for "Ep. 5 / 12"; "{progress} 集" would read as the entry's episode count |
| `airing.notification.group_other` | {count} 集更新：{titles} | Short headline style suited to a truncated notification title; 有 {count} 集更新 would be one character longer |
| `settings.shortcuts.help` | …其他擴充功能占用… | 占用 is the Ministry of Education standard form; 佔用 is equally common in Taiwan |
| `backup.fileName` | synckai-備份-{date}.json | Han characters are valid in file names on every current OS; the note asks to translate "backup" |
| `settings.delay.label` | {hours} 小時 | "0 小時" ≈ 6 Latin characters, at the limit of the note (≤ 6); a bare 時 would read as a clock time |
| `settings.mappings.forget` | 忘記 | Literal but established (Windows zh-TW "忘記" a Wi-Fi network) and consistent with the help text 忘記對應後… |
| `平台` (9 keys) | 平台 | The MOE standard form is 平臺, but 平台 is what Taiwan apps and media overwhelmingly print |
| `feedback.queuedSuffix` | 。稍後會自動重試。 | Kept with its leading period as the note requires; see the code-level note below about the double 。。 |

## Code-level issues seen during the review (not fixable in the catalog)

- `src/shared/agenda.ts` › `formatOffset` hard-codes `h` and `min`, so the Schedule tooltips read 日本播出 +1 h / +45 min in every language (understandable in Taiwan, but not localized).
- `src/ui/platform-list.ts` uses `Intl.ListFormat`, which for zh-TW gives 「Crunchyroll、ADN或Netflix」 with no space between Latin names and 或 / 和, unlike the rest of the catalog (`agenda.empty.noSeriesPlatforms`, `watching.empty.textPlatforms`, `panel.offTargetPlatforms`, `panel.offTargetEnable`).
- `src/background/airing-policy.ts` joins the titles of `airing.notification.group` with an ASCII `, ` instead of the locale's list separator (、 in Chinese).
- `src/shared/sync-feedback.ts` appends `feedback.queuedSuffix` after a service message that usually ends with a period, giving 。。 in Chinese (and `..` in English) when the failing service is listed last.
- `src/sidepanel/sidepanel.ts` joins `panel.offTargetPlatforms` and `panel.offTargetEnable` with an ASCII space, which shows as 。 Netflix… in Chinese.

## For a native human reviewer

- The 47 changed strings, in particular 你給幾分？ (`prompt.rating.question`), 目前頁面 (`page.title`) and 展開 (`panel.nowPlaying.readMore`), in the real popup and side panel.
- The Netflix names (觀影動態, 顯示更多, 使用者) on the live netflix.com site in Traditional Chinese: they were checked in the help center, not on the page itself.
- Visual width of the tightest labels: `settings.delay.label`, `settings.panel.tab.last` (上次開啟), `agenda.adjust.reset` (恢復預設), the footer status texts.

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | 冬季 / 春季 / 夏季 / 秋季 | {year}年冬季 / {year}年春季 / {year}年夏季 / {year}年秋季 | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |
| `sync.noServiceFollows` | 沒有任何已連結的服務在追蹤這部動畫。 | 已連結的服務都沒有這部動畫的條目。 | Meaning: shown when no connected service has an entry for the anime (no AniList / MyAnimeList ID), not when none “tracks” it; English, French and German fixed the same way. Term sheet: entry = *條目* |

Code fixes that change how this catalog is displayed:

- `formatOffset` is localized: 日本播出 +1 小時 30 分鐘.
- Lists use `formatList` (`src/i18n/core.ts`): 「Crunchyroll、ADN 或 Netflix」, with a space between 或 / 和 and a Latin name.
- The titles of `airing.notification.group` are joined with 、.
- `feedback.queuedSuffix` no longer gives 。。: its leading 。 is dropped after a sentence that already ends with one.
- `panel.offTargetPlatforms` + `panel.offTargetEnable` are joined without a space after 。.
- Netflix history import: the “顯示更多” button of a Netflix profile in this language is recognized (label checked by the reviewer on Netflix’s help article 101917 in this language): such an import no longer stops after the first rows as if the history were complete.

Layout (`npm run test:i18n-layout`): no finding in this language.

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). No plural forms in this language: one `_other` variant with the same text, `{total}` renamed `{count}`.

| Key | Text |
|---|---|
| `sync.beyondEntry_other` | 第 {progress} 集超過條目的 {count} 集 |

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | 無法辨識你的 Netflix 使用者語言中的「顯示更多」按鈕：只讀取了最近的集數。請在 Netflix 將該使用者的語言設為與 SyncKai 相同，然後重新讀取。 |

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video（僅限動畫） |
| `settings.prime.label` | 在 Prime Video 上同步 |
| `settings.prime.helpOff` | 只會同步動畫（動漫類別，或有日語音軌、或標題與 AniList 完全相同的動畫作品）。瀏覽器會要求 primevideo.com 的存取權限 |
| `settings.prime.helpOn` | SyncKai 只會讀取 Prime Video 頁面本來就會收到的資訊。在已開啟的 Prime Video 分頁中，會從下一集開始追蹤 |
| `settings.prime.denied` | primevideo.com 的存取權限遭拒：Prime Video 維持停用 |
| `settings.prime.disabled` | 已停用 Prime Video：請重新載入已開啟的 Prime Video 分頁，才會完全停止 |
| `settings.prime.error` | 無法變更 Prime Video 存取權限，請再試一次 |

| Key | Text |
|---|---|
| `onboarding.intro` | 在 Crunchyroll 或 ADN 看動畫（Netflix、Disney+ 和 Prime Video 可選用）：每集看完時，SyncKai 都會更新你的清單。 |
| `watching.tip` | Netflix、Disney+、Prime Video（選用）和你的偏好播放平台，都可以在「{path}」中調整。 |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | 與平台資訊相符：{signals} |
| `match.signalsContradict` | 與平台資訊不符：{signals} |
| `match.yearRemake` | 以首播年份（{year} 年）區分重製版 |
| `match.signal.year` | 首播年份 |
| `match.signal.episodes` | 集數 |
| `match.signal.duration` | 單集長度 |
| `match.signal.format` | 類型（電影或影集） |
| `match.signal.country` | 製作國家 |
| `match.signal.originalTitle` | 原文標題 |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | 已儲存的對應記錄與平台資訊不符：{signals} |

## 2026-10-14 · Matching diagnostic (development builds only)

New keys `settings.matchDiag.*` (Settings › Help & about, section shown only in development builds, never in the published extension): the last 50 AniList matching decisions, a « Copy » button per row (one decision as JSON, for the test corpus) and a « Clear » button. `{count}` follows a label and a colon (no plural form); `JSON` is a format name. Terms from this language's term sheet (match, entry). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.title` | 對應診斷 |
| `settings.matchDiag.text` | 僅限開發版本：依時間由新到舊列出最近 50 筆 AniList 對應判定，保留到瀏覽器關閉為止。可將其中一筆複製為 JSON，加入測試語料庫。 |
| `settings.matchDiag.empty` | 尚未記錄任何判定 |
| `settings.matchDiag.copy` | 複製 |
| `settings.matchDiag.copyTitle` | 將這筆判定複製為 JSON |
| `settings.matchDiag.copied` | 已複製 |
| `settings.matchDiag.copyFailed` | 無法複製這筆判定。 |
| `settings.matchDiag.clear` | 清除 |
| `settings.matchDiag.candidates` | 候選：{count} |
| `settings.matchDiag.noEntry` | 無條目 |
