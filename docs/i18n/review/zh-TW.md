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

## 2026-10-15 · Debug trace (development builds only)

New keys `settings.debugTrace.*` (Settings › Help & about, section shown only in development builds, never in the published extension, below the matching diagnostic): a timeline of what the extension did (pages, service worker, AniList and MyAnimeList requests), a verbose switch, a category filter (category names stay in English: technical identifiers), « Copy trace » (the whole trace as JSON) and the « Clear » button of the matching diagnostic (`settings.matchDiag.clear`, reused). `{count}` and `{max}` follow a label and a colon (no plural form) and arrive formatted for the language; `JSON` is a format name; `service worker` kept as the browser's technical term. New terms added to this language's term sheet (debug trace, event, verbose mode); other terms from it (account). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.debugTrace.title` | 偵錯追蹤 |
| `settings.debugTrace.text` | 僅限開發版本：依時間由新到舊記錄 SyncKai 在頁面、Service Worker 中，以及與 AniList、MyAnimeList 互動時的操作，保留到瀏覽器關閉為止。不會記錄任何權杖、Cookie 或帳號 ID。回報問題時，可將整個追蹤複製為 JSON 並分享。 |
| `settings.debugTrace.empty` | 尚未記錄任何事件 |
| `settings.debugTrace.copy` | 複製追蹤 |
| `settings.debugTrace.copied` | 已複製 |
| `settings.debugTrace.copyFailed` | 無法複製追蹤。 |
| `settings.debugTrace.verbose` | 詳細模式（所有記錄行） |
| `settings.debugTrace.count` | 事件：{count} / {max} |
| `settings.debugTrace.allCategories` | 所有類別 |
| `settings.debugTrace.filterAria` | 依類別篩選事件 |

## 2026-10-16 · Matching diagnostic: Copy all (development builds only)

New keys in the « Matching diagnostic » section (Settings › Help & about, development builds only, never in the published extension, now collapsed by default behind its title): « Copy all » copies every recorded decision as one JSON array, next to « Clear »; its label becomes « Copied » (`settings.matchDiag.copied`, reused) and a failure reuses `settings.matchDiag.copyFailed`. `JSON` is a format name. Same word for « decision » as `settings.matchDiag.copyTitle`, in the plural; other terms from this language's term sheet. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.copyAll` | 全部複製 |
| `settings.matchDiag.copyAllTitle` | 將所有判定複製為 JSON |

## 2026-10-16 · Episode guards (« To check » reasons)

New reasons on a « To check » card (`fix/episode-guards`, audit SEC-01): a sync that would jump straight to the last episode from far behind, and episodes reported as finished in a burst, now wait for the user instead of being written. Same « to check » term as `match.otherSeriesExcluded`, same episode wording as `sync.beyondEntry_*`; `{from}` and `{progress}` are episode numbers. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `sync.review.finaleJump` | 從第 {from} 集直接跳到最後一集（第 {progress} 集）：待確認 |
| `sync.review.burst` | 幾分鐘內看完了多集：待確認 |

## 2026-10-17 · Status bar (popup and side panel)

New texts of the status bar shown at the bottom of the popup and, now, of the side panel (`feature/ui-status-bar`): a synced episode or a count of synced episodes under the series title, shown until the user hides it (« Seen, hide », a × button label), and the history import running, ready to confirm and done. Same words as this language's term sheet: 已同步 (synced), 部 (series counter, as `crImport.preview.toUpdate`), 第 N 集 for the numbered episode and N 集 for the count, 匯入 (import, as `crImport.apply.done`), 待確認 (to confirm, common.confirm 確認); half-width spaces around digits and placeholders; « Seen, hide » is 知道了，隱藏 (usual dismiss wording); ` · ` and ` / ` kept; `{platform}` is a brand name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `footer.dismiss` | 知道了，隱藏 |
| `footer.importDone_other` | 匯入完成 · {count} 部已更新 |
| `footer.importProgress` | {platform} 匯入中 · {done} / {total} |
| `footer.importReady_other` | 匯入就緒 · {count} 部待確認 |
| `footer.syncedEpisode` | 第 {episode} 集已同步 |
| `footer.syncedEpisodes_other` | {count} 集已同步 |

## 2026-10-17 · Account menu (status bar)

New texts of the account menu that opens above the AniList / MyAnimeList logo of the status bar (popup and side panel): the logo button's label (also when the session expired), the connection status line, three stat tiles (anime count, episodes watched, days watched, each number shown above its short label), the « Synced this week » row with its tooltip and value, and « View my profile ». Following this language's term sheet, used 帳號, 已連結 (as `settings.account.connected`), 登入已過期 (`common.sessionExpired`), 同步, 集 / 集數, 動畫, 個人檔案 (as `settings.account.openProfile`); the days tile label is 觀看時間; « day » is 天, as `time.countdown.days`; full-width comma. ` · ` kept; `{service}` is a brand name, `{name}` the user's AniList / MyAnimeList user name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `accountMenu.connected` | 已連結 |
| `accountMenu.connectedAs` | {name} · 已連結 |
| `accountMenu.label` | {service} 帳號 |
| `accountMenu.labelExpired` | {service} 帳號，登入已過期 |
| `accountMenu.profile` | 查看我的個人檔案 |
| `accountMenu.stats.anime_other` | 動畫 |
| `accountMenu.stats.days_other` | 觀看時間 |
| `accountMenu.stats.daysValue` | {days} 天 |
| `accountMenu.stats.episodes_other` | 集數 |
| `accountMenu.week.label` | 本週已同步 |
| `accountMenu.week.title` | 本週由 SyncKai 同步的集數 |
| `accountMenu.week.value_other` | {count} 集 |

## 2026-10-17 · Settings redesign (Preact): new and changed keys

New texts of the redesigned Settings (Preact): the Platforms and Display categories, the screen-reader names of the back button and of the category card, the row summaries of the Settings home, the Keyboard section of Display, the two sections of Shortcuts, and the section titles and notes of Accounts. Changed: `settings.cat.notifications` (now the single word: the Schedule options moved to Platforms), `settings.summary.connected` (a word instead of ✓), `settings.summary.paused` (now a standalone, capitalised summary), `settings.summary.version` (a word instead of « v »), `settings.entry.help` (the « both accounts connected » condition moved to `settings.entry.unavailable`). Summaries are joined with ` · ` by the code; `settings.account.expiredHelp` and `settings.account.otherStillSynced` are joined as two sentences. The Display summary reuses `settings.section.language`, `settings.section.panel` and `settings.shortcuts.pointer`; the My data summary the history import and backup words; the player summary `settings.player.label`. Half-width spaces around Latin names and placeholders; the back label quotes the page name (返回「{page}」). Platform count 已啟用 {count}/{total}; player summary 偏好 {player} (偏好播放平台); list = 清單. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.cat.notifications` | 通知 |
| `settings.cat.platforms` | 平台 |
| `settings.cat.display` | 顯示 |
| `settings.backToAria` | 返回「{page}」 |
| `settings.group.categories` | 類別 |
| `settings.summary.connected` | {service} 已連結 |
| `settings.summary.notConnected` | {service} 未連結 |
| `settings.summary.bothConnected` | AniList 和 MyAnimeList 皆已連結 |
| `settings.summary.auto` | 自動 |
| `settings.summary.paused` | 已暫停 |
| `settings.summary.platforms_other` | 已啟用 {count}/{total} |
| `settings.summary.player` | 偏好 {player} |
| `settings.summary.display` | 語言、側邊面板、鍵盤快速鍵 |
| `settings.summary.data` | 匯入觀看記錄 · 備份 |
| `settings.summary.version` | 版本 {version} |
| `settings.summary.noErrors` | 沒有錯誤 |
| `settings.display.keyboard` | 鍵盤 |
| `settings.display.shortcutsHelp` | 用來將集數標記為已看或開啟側邊面板的按鍵 |
| `settings.shortcuts.duringPlayback` | 播放時 |
| `settings.shortcuts.navigation` | 導覽 |
| `settings.accounts.lists` | 同步的清單 |
| `settings.accounts.both` | 兩個帳號都連結時 |
| `settings.accounts.privacy` | 登入是在 AniList 或 MyAnimeList 網站上完成，SyncKai 絕不會看到你的密碼。 |
| `settings.account.expiredHelp` | 重新連結之前，你的集數不會再傳送到 {service}。 |
| `settings.account.otherStillSynced` | {service} 仍會持續更新。 |
| `settings.entry.help` | 點選動畫標題或封面時開啟的頁面 |
| `settings.entry.unavailable` | AniList 和 MyAnimeList 都連結後才能使用。 |

## 2026-10-17 · Settings › Sync, Matches and Excluded series (Preact)

New texts of the redesigned Sync settings page and of its two sub-pages (Matches, Excluded series), moved out of My data: section titles « Automatic » / « Per series », the descriptions of the two « Episode counted as watched » cards, the « Per series » rows, the Matches intro, search, empty and no-result texts, « Show N more on {platform} », the four origin badges and their legend, the Excluded series section, note, empty hint and the « {year} series · excluded on {date} » fragments. Changed: `settings.trigger.legend` (« Episode counted as watched », where the old text was only « Episode watched »), `settings.trigger.credits` (« (recommended) » moved to `settings.trigger.creditsHelp`), and the paths of `popup.syncDisabledDetail` / `review.excludeTitle` (now nav.settings › settings.section.sync › settings.section.exclusions, built from this catalog's own titles). Removed: `settings.mappings.count_*`, `settings.mappings.help`, `settings.mappings.manage`. `{action}` is the « Re-enable » button (`settings.exclusions.help`) or the « Stop syncing this series » menu item (`settings.exclusions.emptyHelp`), so the quoted labels always match. The match / entry / excluded / re-enable words reuse this catalog's existing terms (`settings.section.mappings`, `settings.mappings.entryFallback`, `settings.section.exclusions`, `settings.exclusions.reactivate`). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.section.automatic` | 自動 |
| `settings.section.perSeries` | 依作品 |
| `settings.trigger.credits` | 片尾開始時 |
| `settings.trigger.creditsHelp` | 建議：平台提供的確切時間點 |
| `settings.trigger.percentageHelp` | 片尾時間不明時也會使用 |
| `settings.sync.mappingsRow` | 已記住的對應 |
| `settings.sync.mappingsRowHelp` | 為每部動畫選定的 AniList 季 |
| `settings.sync.exclusionsRowHelp` | 永不同步，可在這裡重新啟用 |
| `settings.mappings.intro_other` | 已記住 {count} 部動畫，依平台分組：平台上的季 → SyncKai 寫入的 AniList 條目。忘記對應後，看下一集時會重新判斷。 |
| `settings.mappings.search` | 搜尋動畫或條目 |
| `settings.mappings.noResult` | 沒有「{query}」的對應記錄 |
| `settings.mappings.noResultHelp` | 可依動畫名稱或 AniList 條目名稱搜尋。 |
| `settings.mappings.emptyHelp` | SyncKai 會為每個同步過的季記住一筆。 |
| `settings.mappings.showMore_other` | 查看 {platform} 上其餘 {count} 筆 |
| `settings.mappings.origin.chosen` | 你選擇的 |
| `settings.mappings.origin.learned` | 自動學習 |
| `settings.mappings.origin.unmarked` | 舊記錄 |
| `settings.mappings.origin.unverified` | 已匯入 · 待複查 |
| `settings.mappings.origin.chosenHelp` | 由你確認或選擇：不會再被質疑。 |
| `settings.mappings.origin.learnedHelp` | 由 SyncKai 找到：若與平台資訊矛盾會重新判斷。 |
| `settings.mappings.origin.unmarkedHelp` | 2.4 之前儲存：會保留，出現矛盾時需要確認。 |
| `settings.mappings.origin.unverifiedHelp` | 來自備份：第一次使用時會重新確認。 |
| `settings.mappings.originLegend` | 對應記錄的來源 |
| `settings.exclusions.section` | 永不同步 |
| `settings.exclusions.help` | 已排除的動畫不會再同步，所有季都一樣。按「{action}」後從下一集起重新追蹤。 |
| `settings.exclusions.emptyHelp` | 要停止同步某部動畫，請在它的「⋯」選單中選擇「{action}」。 |
| `settings.exclusions.seriesYear` | {year} 年的動畫 |
| `settings.exclusions.excludedOn` | {date} 排除 |
| `popup.syncDisabledDetail` | 可在「設定 › 同步 › 已排除的動畫」中重新啟用 |
| `review.excludeTitle` | 排除整部動畫（所有季）：可在「設定 › 同步 › 已排除的動畫」中重新啟用 |

## 2026-10-17 · Settings › Platforms and Notifications (Preact)

Texts of the redesigned Platforms page (list of sites with « Included » / « Access missing » or a switch, preferred player dropdown, estimated release time per platform with − / + buttons, moved there from the Schedule card) and Notifications page (« On the playback page » style cards and « New episodes »). New: `settings.platforms.where`, `settings.platforms.allAnime`, `settings.platforms.included`, `settings.platforms.accessMissing`, `settings.platforms.note`, `settings.player.openOn`, `settings.player.enableFirst`, `settings.offsets.earlier`, `settings.offsets.later`, `settings.notif.legend`. Changed: `settings.player.help`, `settings.offsets.title`, `settings.offsets.help`, `page.platformOff`, `settings.section.notifications`, `settings.notif.discreet.desc`, `settings.notif.detailed.desc`, `settings.notif.alertsOnly.desc`, `settings.notif.alertsAlways`, `settings.delay.title`, `settings.airing.enableFirst` (the notification descriptions now describe the pill and the bubble, « Extra delay » replaces « Delay », the release-time help says the alerts use it too, « Turn on alerts… » is now visible text). `page.platformOff` keeps its sentence; only the path changed, from « Settings › Playback & sync » to nav.settings › settings.cat.platforms of this catalog. Removed: `settings.section.playback`, `settings.netflix.section`, `settings.netflix.label`, `settings.disney.section`, `settings.disney.label`, `settings.prime.section`, `settings.prime.label`, `settings.airing.label`, `settings.airing.help`, `settings.section.agenda`. The Schedule word, « Open », the release-alert name and the minute unit reuse this catalog's `panel.tab.agenda`, `common.open`, `settings.quick.airing.label` and `settings.offsets.unit`. Settings path quoted as « 「設定 › 平台」 » in `page.platformOff`, per the term sheet. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.platforms.where` | SyncKai 追蹤你觀看的平台 |
| `settings.platforms.allAnime` | 所有動畫 |
| `settings.platforms.included` | 內建 |
| `settings.platforms.accessMissing` | 缺少權限 |
| `settings.platforms.note` | 啟用平台時會要求存取該網站。只會讀取播放頁面和作品頁面。 |
| `settings.player.openOn` | 開啟集數的平台 |
| `settings.player.enableFirst` | 請先啟用 |
| `settings.player.help` | 動畫在多個已啟用的平台上架時，「開啟」會使用這個平台。 |
| `settings.offsets.title` | 預估上架時間 |
| `settings.offsets.help` | 以日本播出後的時間計算，用於「時間表」和播出提醒。個別動畫可在時間表的該列中單獨調整。 |
| `settings.offsets.earlier` | 提早 {minutes} 分鐘 |
| `settings.offsets.later` | 延後 {minutes} 分鐘 |
| `page.platformOff` | {platform} 已停用：SyncKai 不會在這裡追蹤任何內容。如要重新啟用，請前往「設定 › 平台」。 |
| `settings.section.notifications` | 在播放頁面上 |
| `settings.notif.legend` | 頁面內通知樣式 |
| `settings.notif.discreet.desc` | 在影片角落顯示幾秒的小型通知 |
| `settings.notif.detailed.desc` | 顯示該集以及 AniList 和 MyAnimeList 結果的通知泡泡 |
| `settings.notif.alertsOnly.desc` | 一切正常時不顯示；只在出錯或有待確認的集數時顯示泡泡 |
| `settings.notif.alertsAlways` | 無論選擇哪種樣式，錯誤或待確認的動畫一律會顯示。 |
| `settings.delay.title` | 額外延遲 |
| `settings.airing.enableFirst` | 請先開啟播出提醒才能檢查新集數 |

## 2026-10-17 · Settings › My data, AniList ↔ MAL differences, Help & about (Preact)

Texts of the redesigned My data page (one « Import a watch history » card, Backup card, « Compare » row opening the AniList ↔ MyAnimeList differences page, which moved there from the popup's Activity screen) and Help & about page (diagnostic report row, error log that unfolds, About card with What's new / Privacy / Source code links). New: `settings.import.title`, `settings.section.compare`, `settings.compare.title`, `settings.compare.help`, `settings.data.perSeries`, `compare.align`, `compare.bulk.help`, `compare.job.background`, `settings.help.diagnostic`, `settings.help.diagnosticHelp`, `settings.help.journalNote`, `settings.about.whatsNew`, `settings.about.privacy`. Changed: `settings.crImport.help`, `settings.backup.help`, `settings.backup.import`, `settings.help.copy`, `settings.about.source` (import help in two sentences, backup help « in one file », « Import » without ellipsis, « Copy the report » next to the new « Diagnostic report » title, « Source code » with « GitHub » on the right). `help.issue.body` keeps its text; only its last-line path changed, to nav.settings › settings.cat.help › settings.help.copy of this catalog. The compare.* texts are unchanged: their context notes now point to Settings › My data. Removed: `settings.section.import`, `settings.backup.crImportTitle`, `settings.crImport.openAria`, `settings.help.text`, `settings.help.copyTitle`, `settings.help.clearHelp`, `settings.help.reportTitle`. The version line reuses `settings.summary.version`, the « Clear » button `settings.matchDiag.clear`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.import.title` | 補上你看過的動畫 |
| `settings.crImport.help` | 支援 Crunchyroll、ADN 或 Netflix。寫入前會先顯示預覽。 |
| `settings.backup.help` | 設定、對應記錄、已排除的動畫和記錄，存成一個檔案。絕不包含你的 AniList 或 MyAnimeList 登入資訊。 |
| `settings.backup.import` | 匯入 |
| `settings.section.compare` | 比較 |
| `settings.compare.title` | AniList ↔ MyAnimeList 差異 |
| `settings.compare.help` | 比較你的兩份清單，並依你選擇的方向對齊 |
| `settings.data.perSeries` | 對應記錄和已排除的動畫在「{path}」中管理。 |
| `compare.align` | 對齊 |
| `compare.bulk.help` | 「{action}」會把 AniList 的內容寫到 MyAnimeList；執行前會先列出變更讓你確認。 |
| `compare.job.background` | 關閉此頁面也會繼續。 |
| `settings.help.diagnostic` | 診斷報告 |
| `settings.help.diagnosticHelp` | 貼到錯誤回報中：版本、瀏覽器、設定、最近的錯誤。不含權杖和帳號。 |
| `settings.help.copy` | 複製報告 |
| `settings.help.journalNote` | 最多保留最近 50 筆，最新的在前；權杖已遮蔽。 |
| `settings.about.whatsNew` | 新功能 |
| `settings.about.privacy` | 隱私權 |
| `settings.about.source` | 原始碼 |

## 2026-10-17 · Popup « My series » row menu (Preact)

The row « … » menu of the popup's « My series » list and of the « Continue » card now groups the entry links and the platform searches in two sub-menus. New: `watching.menu.openEntry` (sub-menu entry, its items are the bare AniList / MyAnimeList names; wording taken from `page.openOn` without « on {service} »), `watching.menu.searchOn` (sub-menu entry, its items are the bare platform names; wording taken from `watching.searchOn`, ending with « … »). Changed: `settings.entry.help`, which now also says that « Default entry page » picks the list shown in « My series » (quoted with the exact `watching.mySeries` of this catalog). The « −1 episode » item left the menu (the row has its own −), `watching.minusOne` stays for the « On this page » card. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `watching.menu.openEntry` | 開啟條目 |
| `watching.menu.searchOn` | 在平台上搜尋… |
| `settings.entry.help` | 點選動畫標題或封面時開啟的頁面，也決定「我的動畫」顯示哪份清單 |



## 2026-10-17 · Popup « On this page » card (Preact)

The popup's « On this page » card was redesigned: the Hold / Drop / Done row and the AniList / MAL links moved to the card's « … » menu (shared with « My series »), and the season dropdown, the star rating and the comment moved to a foldable « Details » section. New: `page.currentStatus` (grey mention at the end of the menu item of the series' current status), `page.details` (foldable button listing what the section holds, same nouns as `page.seasonPicker`, the rating words of `rating.*` and `notes.title`), `page.seasonOnAniList` (title above the season dropdown), `page.seasonHelp` (help under it on an episode page; the match word is the one of `settings.section.mappings`), `page.yourRating` (title above the stars). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `page.currentStatus` | 目前狀態 |
| `page.details` | 詳細資料：季、評分、備註 |
| `page.seasonOnAniList` | AniList 上的季 |
| `page.seasonHelp` | 更換季會修正之後各集的對應。 |
| `page.yourRating` | 我的評分 |


## 2026-10-17 · Popup « Activity » tab (Preact)

The popup's Activity tab was redesigned: failed and pending syncs are now two sections, and every section heading is an uppercase label followed by « · {count} » added by the code. New: `queue.failedHeading` (same failure word as `queue.failed`), `queue.pendingHeading` (syncs waiting for a retry, wording of the former `queue.sectionTitle`), `ratings.heading` (the former `ratings.sectionTitle` without its count). The « To check » heading now reuses `inline.toCheck`. Removed: `queue.section`, `queue.sectionTitle`, `ratings.section`, `ratings.sectionTitle`, `review.title`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `queue.failedHeading` | 失敗 |
| `queue.pendingHeading` | 待同步 |
| `ratings.heading` | 待評分 |


## 2026-10-17 · Side panel « Now playing » (Preact)

The side panel's « Now playing » tab was redesigned as cards: « You're watching » (live playback: bar, credits marker, countdown, sync state with an icon), « Your list » (status chip, « Progress » and the stepper, one line per account, the series « … » menu shared with the popup: Hold / Drop / Done moved there), then foldable sections « Rating and comment », Synopsis, related entries and Discussions. New: `panel.nowPlaying.watching` (heading of the live card, addresses the user), `panel.nowPlaying.list` (heading of the list card, same « your list » words as `page.notInList`), `panel.nowPlaying.ratingNotes` (section title, same nouns as `page.yourRating` and `notes.title`), `panel.live.creditsAt` and `panel.live.creditsUnknown` (legend of the yellow marker under the bar, credits word of `settings.trigger.credits`), `panel.live.countdownCredits` and `panel.live.countdownRatio` (countdown line, wording of the former `panel.live.countdown` plus what the sync waits for, as in `settings.trigger.credits` / `settings.summary.percentage`). Changed: `panel.live.synced` lost its trailing « ✓ » (a check icon now precedes it). The « Progress » label reuses `compare.filter.progress`. Removed: `page.action.COMPLETED`, `page.action.DROPPED`, `page.action.PAUSED` (the status button row is gone), `panel.live.countdown`, `panel.nowPlaying.progress`, `watching.nextWatched`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `panel.nowPlaying.watching` | 正在觀看 |
| `panel.nowPlaying.list` | 你的清單 |
| `panel.nowPlaying.ratingNotes` | 評分和備註 |
| `panel.live.creditsAt` | 片尾開始於 {time} |
| `panel.live.creditsUnknown` | 片尾未知 · 播到 {percent}% 時同步 |
| `panel.live.countdownCredits` | {time}後同步 · 片尾開始時 |
| `panel.live.countdownRatio` | {time}後同步 · 播到 {percent}% 時 |
| `panel.live.synced` | 已同步 |


## 2026-10-17 · Side panel Schedule (Preact) and week picker

The Schedule tab of the side panel was redesigned: days in order with « No episode » on empty days, episode lines « 18:00 Crunchyroll · Japan 17:00 » (the platform time first, the Japanese broadcast last and cut first), a « ⋯ » menu with « Adjust time » (its second line gives the time and whether the delay is the series' own or the default), « Open the entry › » and « Search on… › », and a week button that opens a month calendar. New: `agenda.adjust.custom` and `agenda.adjust.default` (second line of « Adjust time », lower case after « · »), `agenda.adjust.platform` (first sentence of `agenda.estimate.title`, shown in the delay editor), `agenda.picker.label`, `agenda.picker.prevMonth`, `agenda.picker.nextMonth`, `agenda.picker.thisWeek`, `agenda.picker.hint` (month calendar; the hint names the arrow keys and the Enter key). Changed: `agenda.jp` writes the country name instead of « JP » (unchanged where it already did: ja, ko, zh-CN, zh-TW). Removed: `watching.searchOn` (the search entries are now the platform names of the « Search on… › » sub-menu). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `agenda.adjust.custom` | 此動畫的自訂設定 |
| `agenda.adjust.default` | 預設延遲時間 |
| `agenda.adjust.platform` | 預估 {platform} 上架時間：日本播出 {offset}。 |
| `agenda.picker.label` | 選擇週次 |
| `agenda.picker.prevMonth` | 上個月 |
| `agenda.picker.nextMonth` | 下個月 |
| `agenda.picker.thisWeek` | 本週 |
| `agenda.picker.hint` | 按 ↑ ↓ 切換週次，按 Enter 顯示。 |

## 2026-10-18 · History import page, steps 1 to 3 (Preact)

The history import page (steps 1 to 3) was redesigned: a 5-step indicator under the title (Platform, Reading, Analysis, Preview, Import), one tile per platform with the state of its tab (ready, no tab open, waiting for the tab, access to grant), the rules in a « How it works » card (its title reuses `onboarding.howItWorks`), and the Netflix reading card listing its three steps (done with a check, current with a bar, next ones greyed). New: `crImport.steps` (screen readers only), `crImport.step.*` (one word each: the five steps share one line at 576 px), `crImport.tile.*` (status line of a tile, no platform name), `crImport.netflix.heading`, `crImport.netflix.rowsDone` (step done: same wording as `crImport.netflix.rows` without the ellipsis), `crImport.netflix.titlesNext` and `crImport.netflix.showsNext` (steps not started yet: same wording as `crImport.netflix.titles` / `.shows` without the counts). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.steps` | 步驟 |
| `crImport.step.platform` | 平台 |
| `crImport.step.reading` | 讀取 |
| `crImport.step.analysis` | 分析 |
| `crImport.step.preview` | 預覽 |
| `crImport.step.import` | 匯入 |
| `crImport.tile.ready` | 分頁已就緒 |
| `crImport.tile.none` | 沒有開啟中的分頁 |
| `crImport.tile.access` | 需要允許存取 |
| `crImport.tile.waiting` | 正在等待分頁… |
| `crImport.netflix.heading` | 正在讀取你的 Netflix 觀看記錄 |
| `crImport.netflix.rowsDone` | 已載入 Netflix 觀看記錄：{rows} 筆 |
| `crImport.netflix.titlesNext` | 在 AniList 上搜尋動畫 |
| `crImport.netflix.showsNext` | 讀取你的 Netflix 進度（保留的作品） |

## 2026-10-18 · History import page, steps 4 and 5, and Backup page (Preact)

Steps 4 and 5 of the history import page and the Backup page were redesigned. The preview summary is now a row of tiles, each with its number above a label: `crImport.summary.*` are those labels without the number (they replace `crImport.preview.toUpdate`, `.review`, `.upToDate`, `.excluded`, `.ignored` and `.failed`, removed; same wording without `{count}`). The « Update N series » button has a muted hint on its left (`crImport.preview.hint.*`: a line left unchecked, none checked, locked during the import, what stays checked after a stopped or failed import). Each « To check » season shows the entry its check card will propose (`crImport.review.proposed`, a small badge) and the other entries to choose from (`crImport.review.alternatives`, `{titles}` = a localized list). The Backup page's Export card lists what the file contains and never contains (`import.included`, `import.neverIncluded`, `import.includes.*`, reusing the words of `import.summary.*` and `import.intro`); the Import card titles the file table (`import.fileContents`) and shows the export date under the file name (`import.exportedAt`, replaces `import.exportedOn`, removed: same text without the leading ` · `). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.summary.toUpdate_other` | 待更新 |
| `crImport.summary.review_other` | 待確認 |
| `crImport.summary.upToDate_other` | 已是最新 |
| `crImport.summary.excluded_other` | 已排除 |
| `crImport.summary.ignored_other` | 已略過的作品（非動畫） |
| `crImport.summary.failed_other` | 查詢失敗 |
| `crImport.preview.hint.unchecked` | 未勾選的列不會寫入。 |
| `crImport.preview.hint.none` | 請至少勾選一部動畫。 |
| `crImport.preview.hint.locked` | 匯入結束前，核取方塊和按鈕都會鎖定。 |
| `crImport.preview.hint.stopped` | 尚未寫入的動畫會保持勾選。 |
| `crImport.preview.hint.failed` | 失敗的動畫會保持勾選。 |
| `crImport.review.proposed` | 建議 |
| `crImport.review.alternatives` | 其他可選：{titles} |
| `import.included` | 包含 |
| `import.neverIncluded` | 絕不包含 |
| `import.includes.settings` | 設定 |
| `import.includes.matches` | 對應記錄和已排除的動畫 |
| `import.includes.history` | 記錄：最近同步、待確認的集數、待評分的動畫、已拒絕的重看詢問 |
| `import.includes.signIns` | 你的 AniList / MyAnimeList 登入資訊 |
| `import.fileContents` | 檔案內容 |
| `import.exportedAt` | 匯出於 {date}（v{version}） |

## 2026-10-18 · In-page toasts redesigned

The in-page toasts on the player were redesigned (top-right corner, Kai with a state badge, title = what happened, subtitle = series · episode, one line per service, identical results merged). New titles `toast.title.*` (saved, series completed, partial sync, failed on a service, not saved, excluded), per-service results `toast.line.completed` / `toast.line.upToDate`, partial results of a rating or a rewatch (`prompt.rating.partial`, `prompt.rewatch.partial`) and the explanation under the rewatch question (`prompt.rewatch.message`). Two services with the same result share one line, labelled `toast.line.both`. The end-of-series rating bubble title `prompt.rating.title` is now « Series completed! Your rating? » (`toast.title.completed` and the former question joined; the series title moved to the subtitle): `prompt.rating.question` was removed. `content.episodeShort` is now the bubbles' subtitle and uses the short form of « episode » before the number where the language has one. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `toast.title.saved` | 第 {episode} 集已儲存 |
| `toast.title.completed` | 動畫已看完！ |
| `toast.title.partial` | 部分同步 |
| `toast.title.failedOn` | {service} 同步失敗 |
| `toast.title.notSaved` | 本集未儲存 |
| `toast.title.excluded` | 此動畫已排除，未傳送任何內容 |
| `toast.line.completed` | 狀態：已看完 |
| `toast.line.upToDate` | 已是最新 |
| `prompt.rating.partial` | 評分僅部分儲存 |
| `prompt.rewatch.partial` | 重看狀態僅部分儲存 |
| `prompt.rewatch.message` | 清單中已看完：進度將從第 {progress} 集重新開始。 |
| `toast.line.both` | AniList 和 MyAnimeList |
| `prompt.rating.title` | 動畫已看完！你給幾分？ |
