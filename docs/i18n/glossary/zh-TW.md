# Chinese, Traditional (Taiwan) (`zh-TW`) term sheet

Binding for every change to `src/i18n/locales/zh-TW.json` and `public/_locales/zh_TW/messages.json`. Read `docs/i18n/GLOSSARY.md` first.

This is a Taiwan localization written from the English/French source, not a character conversion of `zh-CN`: Taiwan vocabulary throughout (設定, 帳號, 登入, 影片, 檔案, 資料, 清單, 分頁, 載入, 儲存, 搜尋, 匯入/匯出, 預設, 支援, 存取, 網路, 介面, 選單, 圖示, 原始碼, 逾時, 用戶端…), never mainland forms (设置, 账户, 视频, 文件, 列表, 加载, 保存, 搜索, 导入, 默认, 支持, 界面, 菜单, 图标, 源代码, 超时, 客户端…).

## 1. Conventions

| Topic | Rule | Example |
|---|---|---|
| Register | Address the user with 你 (never 您), friendly fan-to-fan tone. Requests start with 請 only where a polite imperative reads better; short buttons are bare verbs | 請再試一次 · 你的清單 · 儲存 |
| Buttons, menu items, chips | Bare verb or short noun phrase, no final punctuation | 重試 · 從清單移除 · 已排除 |
| Punctuation | Full-width in Chinese text: ，。：；？！、（） and quotes 「」 (nested 『』). A final 。 only where the English ends with a period | 無法讀取設定。請關閉後重新開啟 SyncKai。 |
| Quotation marks | 「」 for UI labels quoted in a sentence (tabs, buttons, settings paths, Netflix page names) and for anime/entry titles embedded mid-sentence; no quotes when the title starts the text before a colon | 可在「設定 › 已排除的動畫」中重新啟用 · 停止同步「{title}」 · {title}：已看完 |
| Colon | Full-width `：`, no space before or after | 失敗：{error} |
| Spacing | One half-width space between Chinese and Latin words, digits or placeholders; no space next to full-width punctuation | 在 {platform} 開啟 · 第 {episode} 集 · {service}：{message} |
| Parentheses | Full-width （）, no surrounding spaces | 待確認（{count}） · 合併（建議） |
| Ellipsis | Single character `…`, attached | 同步中… · 載入中… |
| Separators | ` · ` and ` › ` kept exactly as in English; `→`, `↔`, `↑`, `✓`, `≈`, `−1` kept | 設定 › 播放與同步 |
| Percent | No space | 85% · 播到 {percent}% 時同步 |
| Units | min → 分鐘, h → 小時, d (days) → 天, s → 秒 (Chinese words are already short; 時/分 alone would read as a clock time or a score). Minutes + seconds countdown shows both units | {count} 分鐘 · {count} 小時 · {count} 天 · {min} 分 {sec} 秒 |
| Relative time | Fragments that work before a verb and after a colon: 剛剛, {count} 分鐘前, {count} 小時前, 昨天, {count} 天前. Host strings put `{relative}` first or after a colon | {relative}看完 · 上次檢查：{relative} · 上次分析：{relative} |
| Retry delays | `queue.until.*` = 即將, {count} 分鐘後, {count} 小時後, {count} 天後; host `queue.nextAttempt` = `{when}重試` | 5 分鐘後重試 · 即將重試 |
| Counts | No plural forms (only `_other`). Measure words: 部 (series/anime), 季 (seasons, no measure word), 集 (episodes), 筆 (syncs, matches, history rows), 項 (items to check/handle), 個 (titles, errors, invalid items, check cards) | {count} 部待評分 · {count} 筆待同步 · {count} 項待確認 |
| `{service}: {message}` | `{service}：{message}`; `{message}` fragments start with a Chinese character, so the automatic first-letter lowercasing never touches a product name | AniList：第 5 集已儲存 · MyAnimeList：失敗：… |
| `{title}: completed` | `{title}：已看完` (same pattern: `{title}：已棄番`, `{title}：擱置中`, `{title}：已從你的清單移除`) | Frieren：已看完 · 可在「動態」中評分。 |
| Mark as watched | Episode: 標記為已看 / 已看; series status: 已看完. Never 完成 for the user's status | 將目前這一集標記為已看 · 標記為已看完 |
| Click instructions | 點一下 when telling the user to click something; 點選 for choosing an item or for SyncKai's own clicks. Never 點擊 (mainland UI verb) | 點一下 SyncKai 圖示 · 點選動畫標題 |
| Settings paths and UI labels in a sentence | Quoted in running text, including the `{path}` placeholder, so no ASCII spaces sit around a path in CJK text. A path that stands alone inside full-width parentheses stays unquoted (help.issue.body) | 可在「{path}」中啟用 · 請前往「設定 › 播放與同步」 · （設定 › 說明 › 複製診斷報告） |
| Product names, URLs, field names | Untranslated: SyncKai, AniList, MyAnimeList, MAL, AL, Crunchyroll, ADN, Netflix, Disney+, Firefox, Chrome, Brave, Reddit, GitHub, Weblate, JSON, .json, `Redirect URL`, `App Redirect URL`, about:addons, chrome://extensions/shortcuts | — |
| Keys | `Shift` stays `Shift` (printed so on Taiwan keyboards) | Alt+Shift+K |

## 2. Core terms

| English term | zh-TW | Reason |
|---|---|---|
| Watching (status `page.status.CURRENT`, popup tab `nav.watching`) | 觀看中 | Neutral, clear chip/tab label; same word for the tab and the status, as in EN/FR/DE |
| Completed | 已看完 (action button: 看完; question: 看完了嗎？) | The USER finished it; kept apart from 已完結 (finished airing) |
| On hold | 擱置中 (action: 擱置) | 擱置 is the On hold term of Chinese-language trackers (Bangumi); kept apart from 已暫停 (video or auto sync paused) and 停播中 (airing hiatus) |
| Dropped | 已棄番 (action: 棄番; question: 要棄番嗎？) | 棄番 is what Taiwan fans say for dropping a show; cannot be misread as 取消 (Cancel) |
| Plan to watch | 想看 | Usual fan/tracker term (Bangumi 想看) |
| Rewatching / rewatch | 重看中 / 重看 | Plain and immediately clear |
| Add to Watching / Plan to watch | 加入「觀看中」/ 加入「想看」 | Status name quoted, identical to the chip |
| series | 動畫 (measure word 部) | What Taiwan fans call an anime title; 系列 would suggest a whole franchise. Exception: 作品 where the title may NOT be an anime (Netflix/Disney+ filter: 已略過此作品, 個作品, 非動畫) |
| anime | 動畫 | Standard Taiwan word |
| season | 季 (第 {n} 季) | Wording of streaming platforms in Taiwan |
| episode | 集; short form before a number: 第 {n} 集; after a count: {n} 集; a single episode: 這一集 / 一集; episodes as a list or a number: 集數 | Taiwan streaming wording (集數 = episodes tab / episode number). Progress "Ep. 5 / 12" = 第 5 / 12 集 |
| arc | 篇 | Fan usage (…篇) |
| absolute numbering | 總集數編號 | Fans call One Piece's running count 總集數 |
| list | 清單 | Taiwan word (列表 is mainland) |
| entry | 條目 | The anime's page on AniList/MAL; 條目 is the database-entry word used by Chinese trackers and wikis |
| sync (noun / verb) | 同步 / 同步 | One word for both; 同步中…, 已同步, 同步失敗 |
| to check (`review.*`, `inline.toCheck`) / a check card ("review") | 待確認 / 待確認項目 | The user confirms the right entry; never 評論 (a critique) |
| to rate | 待評分 | |
| score, rating | 評分 (stars: 星; AniList users' average: 平均評分) | Rating prompt question: 你給幾分？ (natural fan-to-fan question, quoted as such in settings.ratingPrompt.help) |
| comment (`notes.*`) | 備註 | Private note on the list entry (AniList Notes / MAL Comments); 評論 = public review, 留言 = posted message, both avoided |
| match, mapping (`match.*`, Settings › Matches) | 對應 / 對應記錄 (count: {n} 筆對應) | The remembered season → AniList entry link |
| match / align (AniList ↔ MAL differences job) | 對齊; bulk buttons 以 {source} 為準 | FR « aligner »; "Match all to AniList" = 全部以 AniList 為準 |
| Excluded series | 已排除的動畫 (exclude: 排除; chip: 已排除) | |
| Stop syncing / Resume syncing / Re-enable | 停止同步 / 恢復同步 / 重新啟用 | |
| pending sync, queue | 待同步 (count: {n} 筆待同步; section: 待同步項目) | |
| credits | 片尾 | Taiwan word for the end credits (片尾曲 = the ED song) |
| popup | 彈出視窗 | Usual Taiwan word for a pop-up window |
| side panel | 側邊面板 | Chrome zh-TW term; also used on Firefox for one consistent name |
| Now playing (panel tab) | 正在播放 | |
| Schedule (`panel.tab.agenda`, `agenda.*`) | 時間表 | Weekly timetable of upcoming episodes; reused in 通知與時間表 |
| On this page (`page.title`) | 目前頁面 | Card heading; a locative phrase (此頁面上) reads as translationese in a heading |
| preferred player | 偏好播放平台 | "Player" = streaming service, not a media player |
| history import | 匯入觀看記錄 (watch history: 觀看記錄) | 觀看記錄 follows YouTube Taiwan wording and covers every platform; Netflix's own pages are quoted with Netflix's names (section 4) |
| backup | 備份 (export/import: 匯出/匯入) | Never 記錄: the history import uses 觀看記錄 |
| history inside a backup (SyncKai's own) | 同步記錄 | Kept apart from the streaming watch history |
| preview | 預覽 | |
| account / connect / disconnect / reconnect | 帳號 / 連結 / 解除連結 / 重新連結 | 連結帳號 is the usual Taiwan phrase for linking an account |
| sign in / sign out / session expired | 登入 / 登出 / 登入已過期 | |
| OAuth authorization code / token / API client / sign-ins (in a backup) | 授權碼 / 權杖 / 用戶端 / 登入資訊 | Taiwan technical wording; `Redirect URL` and `App Redirect URL` stay in English (form field names) |
| release alerts (`airing.*`, `settings.quick.airing.label`) | 播出提醒 | Browser notifications for new episodes |
| alerts (notification level "Alerts only") | 警示 (僅限警示) | Messages needing action; kept apart from 提醒 |
| New episodes (section) | 新集數 | |
| release / airing | 播出 (Japan, TV); 上架 (arrival on a platform); first Japanese broadcast: 日本播出 | 上架 is the Taiwan streaming word for a title becoming available |
| airing statuses | 播出中 · 已完結 · 停播中 · 即將播出 · 已取消 | 已完結 = finished airing, never 已看完 |
| offset, delay (`agenda.*`, `settings.delay.*`) | 延遲 | |
| offset (Settings › Matches episode offset) | 偏移 | Different concept: number subtracted from the episode number |
| shortcut | 快速鍵 (keyboard shortcuts: 鍵盤快速鍵) | Same word as Chrome zh-TW (鍵盤快速鍵) and Firefox zh-TW (管理擴充套件快速鍵) |
| Activity (popup tab) | 動態 | |
| Ignore / skip | 略過 | Dismiss without acting |
| Abandon (pending sync) | 放棄 | Kept apart from 棄番 (Dropped) |
| Correct / correction | 更正 | Verb "fix" |
| Retry | 重試 | |
| tab (browser) | 分頁 | |
| extension | 擴充功能 | Chrome zh-TW word |
| Recommended | 建議 (in parentheses: （建議）) | Taiwan UI convention for a recommended option (Windows, iOS zh-TW); 推薦 is for recommending content |
| Read more / Show less (toggle) | 展開 / 收合 | The usual Taiwan UI pair |
| Movie / Special / TV short | 劇場版 / 特別篇 / TV 短篇 | Usual Taiwan anime format names |
| Relations: Parent / Prequel / Sequel / Side story / Spin-off | 本篇 / 前作 / 續作 / 外傳 / 衍生作品 | |

## 3. Settings

| English | zh-TW |
|---|---|
| Settings (`nav.settings`) | 設定 |
| Quick settings | 快速設定 |
| Playback & alerts / Data & help (home groups) | 播放與通知 / 資料與說明 |
| Accounts | 帳號 |
| Playback & sync (`settings.cat.sync`) | 播放與同步 |
| Notifications & schedule | 通知與時間表 |
| Shortcuts | 快速鍵 |
| My data | 我的資料 |
| Language | 語言 |
| Help & about | 說明與關於 |
| Sections: Playback / Sync / Side panel / On-page notifications / New episodes / Schedule / Matches / Excluded series / Import / Backup / Danger zone / Help / About | 播放 / 同步 / 側邊面板 / 頁面內通知 / 新集數 / 時間表 / 對應記錄 / 已排除的動畫 / 匯入 / 備份 / 危險區域 / 說明 / 關於 |
| Notification levels: Discreet / Detailed / Alerts only | 低調 / 詳細 / 僅限警示 |
| Shortcut buttons: Change / Set | 變更 / 指定 (指定, not 設定, which is the Settings screen) |
| Paths used in sentences | 設定 › 播放與同步 · 設定 › 已排除的動畫 · 設定 › 說明 › 複製診斷報告 |

## 4. Netflix

Verified on 2026-10-14 in Netflix's Taiwan help center ([如何查看觀影記錄和裝置活動](https://help.netflix.com/zh-tw/node/101917): 「選取 [使用者]，再選擇一位使用者。開啟 [觀影動態]。…請使用 [顯示更多] 按鈕」):

- "Viewing activity" page (netflix.com/viewingactivity): **「觀影動態」**.
- "Show more" button at the bottom of that page: **「顯示更多」**.
- Netflix profiles: **使用者** (the profile picker and the account menu use 使用者, not 個人檔案, which stays the AniList/MyAnimeList profile).
- Netflix calls the history itself 觀影記錄; the catalog keeps 觀看記錄 as the one generic word for every platform's watch history (history import), and quotes Netflix's names only where it points at Netflix's own page or button.
