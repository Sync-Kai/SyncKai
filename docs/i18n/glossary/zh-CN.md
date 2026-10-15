# Simplified Chinese (`zh-CN`) term sheet

Binding for every change to `src/i18n/locales/zh-CN.json` and `public/_locales/zh_CN/messages.json`. Read `docs/i18n/GLOSSARY.md` first. Audience: mainland anime fans (Bilibili / Bangumi vocabulary), Simplified characters only.

## 1. Conventions

| Topic | Rule | Example |
|---|---|---|
| Register | Address the user with 你 (never 您). Friendly and short; 请 only in instructions and error advice, never stacked | 未保存，请重试 · 你打几分？ |
| Buttons, menu items | Verb or verb + object, no final punctuation | 保存 · 重试 · 从列表中移除 · 标为看过 |
| Status labels, chips, fragments | 已 + verb, or a short noun phrase; no final period | 已同步 · 已排除 · 未连接 · 已是最新 |
| Punctuation | Full-width in Chinese text: ，。：；！？（）、 — no space before or after them | 失败：{error} · 待确认（{count}） |
| Spaces | One half-width space between Chinese and Latin words, digits or placeholders (browser/OS convention: Chrome, Windows, macOS zh-CN). No space next to full-width punctuation. No space when the placeholder value itself ends in Chinese (`{relative}`, `{time}`, `{when}`, `{delay}`, `{message}`) | 在 {platform} 上打开 · 第 {episode} 集 · {relative}看完 · {when}重试 |
| Quotation marks | “ ” for interface labels, page names and season titles quoted in a sentence | 可在“设置”中修改 · 通过“调整时间” |
| Anime titles | Book-title marks 《》 around `{title}` when it is an anime title inside a sentence (Bilibili style: 你追的《…》更新了). Not used when `{title}` already carries extra text (`'Frieren · S1 E5'`, a tab title, an entry title with its year in a dropdown, a ` · `-separated list line) | 《{title}》已看完！ · 放弃同步：{title} · 第 {season} 季 — {title} |
| Ellipsis | Single character `…` for in-progress states and editors (GLOSSARY rule), attached | 正在同步… · 备注… |
| Em dash | Chinese double dash —— (no spaces) inside sentences | 缓存中没有在看的番剧——请打开“在看”标签页 |
| Separators | ` · ` and ` › ` kept exactly as in English | 设置 › 已排除的番剧 |
| Settings paths in a sentence | Quoted when the path sits inside the sentence; bare after a colon, inside parentheses, or when the path is a clickable link (`watching.tip`) | 可在“设置 › 已排除的番剧”中恢复同步 · 如需重新开启：设置 › 播放与同步。 |
| Percent | No space | 85% |
| Units | No abbreviations in Chinese (the words are already short): min → 分钟, h → 小时, d → 天, s → 秒; the live countdown uses 分 + 秒 | {count} 分钟 · {count} 小时 · {count} 天 · {min} 分 {sec} 秒 · {sec} 秒 |
| Relative time (`time.*`) | 刚刚 · {count} 分钟前 · {count} 小时前 · 昨天 · {count} 天前; host strings put `{relative}` after a colon or before the verb | 上次检查：{relative} · 上次分析：{relative} · {relative}看完 |
| Retry delays (`queue.until.*`) | {count} 分钟后 · {count} 小时后 · {count} 天后 · 即将; host `{when}重试` | 5 分钟后重试 · 即将重试 |
| Counts | Only the `_other` plural form. Measure words: 部 (series), 季 (seasons), 集 (episodes), 项 (syncs, items to handle or check), 个 (titles, errors, invalid items, check cards), 条 (matches, Netflix history rows) | {count} 部待评分 · {count} 项待同步 · 已记住 {count} 部番剧 · {rows} 条… |
| Progress (episodes watched) | A count, not an ordinal: `{progress} / {total} 集`, `已看 {progress} 集`, `进度已回退至 {progress} 集`. Never `第 {progress} 集` where the value can be 0 (Plan to watch entries, a new Watching entry, −1 from episode 1): “第 0 集” reads as an episode 0. `第 N 集` stays for a specific episode (the one playing, saved, released) | 想看 · 0 / 12 集 · 在看 · 已看 7 集 · 第 5 集已上线 |
| `{service}: {message}` | `{service}：{message}`; `{message}` is a short fragment (已保存第 5 集, 失败：…) | AniList：已保存第 5 集 · MyAnimeList：失败：… |
| `{title}: completed` | `《{title}》：已看过` (same pattern 已抛弃, 已搁置, 已从你的列表中移除) | 《Frieren》：已看过 · 可在“动态”中评分。 |
| `feedback.queuedSuffix` | ` · 稍后会自动重试` instead of a leading period: the preceding fragment often already ends with 。, and “。。” would show | AniList：失败：…。 · 稍后会自动重试 |
| Mark as watched | 标为已看 (episode); 标为看过 is only the list status Completed | 将当前剧集标记为已看 · 标为看过 |

## 2. Core terms

| English term | zh-CN | Reason |
|---|---|---|
| Watching (status; popup tab `nav.watching`) | 在看 | Bangumi status, known to every Chinese tracker user; also the tab label |
| Completed | 看过 (sentences: 已看过 / 已看完) | Bangumi status; the USER finished it. Never 已完结, which is the airing state |
| On hold | 搁置 | Bangumi status |
| Dropped | 抛弃 | Bangumi status; cannot be read as “Cancel” (取消) |
| Plan to watch | 想看 | Bangumi status |
| Rewatching | 重看 (chip in progress: 重看中) | Pairs with 在看; 二刷 / 重刷 are too slangy for a status |
| Status actions (Hold / Drop / Done buttons) | 搁置 / 抛弃 / 看过 | Like Bangumi's collection buttons, which carry the status names |
| Status actions (menu: Put on hold / Drop / Mark as completed) | 标为搁置 / 标为抛弃 / 标为看过 | Imperative form of the same words; confirmations 标为看过？ / 标为抛弃？ |
| Add to Watching / Plan to watch | 加入“在看” / 加入“想看” | Status names quoted, identical to the chips |
| series | 番剧 | What Bilibili and fans call an anime title; 作品 only for a title that is probably not an anime (`feedback.ignored.title`) |
| anime (generic) | 动画 | Neutral word in descriptions (仅限动画, 非动画) |
| season | 季 (第 N 季) | Wording of every Chinese platform |
| episode | 集 (standalone noun: 剧集 / 本集 / 这一集) | 集 works both as an ordinal and a count; 话 (Bilibili) does not count well (“3 话”) |
| Ep. N (short form before a number) | 第 N 集 | Already short; no Latin abbreviation. Only for a specific episode: a watched-episodes count (`watching.heroProgress`, `watching.epShort`, `compare.chip.entry`, `inline.backTo`) follows the Progress rule in §1 |
| N eps. (episode total) | N 集 / 共 N 集 | |
| arc | 篇章 | One Piece arcs (和之国篇) |
| absolute numbering | 连续编号 | Numbering continued across seasons (One Piece 第 1180 集); clearer than 绝对编号 |
| part (season split on AniList) | 第 N 部分 | |
| list / your list | 列表 / 你的列表 | The tracking list on AniList / MyAnimeList, never 片单 (playlist) |
| entry | 条目 | Bangumi / wiki word for the page of an anime in a database; what “Open on AniList” opens |
| sync (noun and verb) | 同步 | One word everywhere |
| syncing / synced | 正在同步… / 已同步 | |
| auto sync | 自动同步 | |
| Stop syncing (exclude the series) | 不再同步 | Means excluding the series, not stopping the current sync |
| Resume syncing / Re-enable | 恢复同步 | Same wording for the menu item, the Settings button and the paths that point to it |
| excluded series / Excluded (chip) | 已排除的番剧 / 已排除 | |
| to check (`review.*`, `footer.toReview`, chips) | 待确认 | SyncKai waits for the user to confirm the entry; not 待检查 / 审核 |
| review (a “To check” card) | 待确认项 | Never 评论 / 评测 (a critique) |
| to rate | 待评分 | |
| score, rating, stars | 评分 (verb: 评分 / 打分) | The user's score out of 10, Bangumi wording |
| comment (`notes.*`) | 备注 | Private text on the list entry (AniList Notes, MAL Comments); 评论 would suggest a public review |
| match, mapping (`match.*`, Settings “Matches”) | 匹配 / 匹配记录 | Remembered season → AniList entry link. “Forget” = 忘记 (recomputed at the next episode) |
| match / matching (AniList ↔ MAL alignment, `compare.*`) | 以 … 为准 / 对齐 | Different meaning: copying one service's values to the other. Keep AniList = 以 AniList 为准 |
| pending sync, queue (`queue.*`) | 待同步 / 待同步项 | Failed syncs waiting for an automatic retry |
| credits | 片尾 | Sync “at the start of the credits” = 片尾开始时 |
| popup | 弹出窗口 | Neutral (弹窗 sounds like an ad pop-up) |
| side panel (Chrome) / sidebar (Firefox) | 侧边栏 | Chrome zh-CN wording; Firefox's 侧栏 is close enough for one shared word |
| Now playing (panel tab) | 正在播放 | |
| Schedule (panel tab, `agenda.*`, `settings.section.agenda`) | 时间表 | Bilibili's 新番时间表; reused in 通知与时间表 |
| On this page (`page.*`) | 当前页面 | Card about the active tab |
| preferred player | 首选播放平台 | The player is a streaming platform, not a media player app (播放器) |
| history import (`crImport.*`) | 导入观看记录 | Watch history on a streaming site = 观看记录 (Netflix's own page name) |
| SyncKai's sync history (backup contents) | 同步记录 | Must not be confused with 观看记录 |
| backup (`settings.backup.*`, `backup.*`, `import.*`) | 备份 (export 导出, import 导入) | Never the history-import wording |
| preview (import) | 预览 | |
| rewatch | 重看 | AniList “repeat” |
| account | 账号 | Mainland spelling (not 帐号 / 账户) |
| connect / disconnect | 连接 / 断开连接 | Linking the AniList / MyAnimeList account |
| sign in | 登录 | |
| session expired | 登录已过期 | 会话 is too technical for users |
| release alerts (`airing.*`, `settings.quick.airing.label`, section `settings.section.airing`) | 更新提醒 | Bilibili's 追番更新提醒. Always the full term, also in the home summary fragments (更新提醒已关闭 · 更新提醒延迟 3 小时 · 准时更新提醒): a bare 提醒 next to the level name 仅重要提示 blurs the two notions |
| alerts in “Alerts only” (`settings.notif.alertsOnly.*`) | 重要提示 | Messages that need an action; must differ from 更新提醒 |
| release, airing | 播出 (Japanese broadcast), 上线 (on a platform), 更新 (a new episode came out), 连载中 (airing state) | |
| finished airing / cancelled / hiatus / upcoming | 已完结 / 已取消播出 / 暂停播出 / 未开播 | Airing states, never the user's statuses. 已取消 alone, at the end of the info line (第 2 季 · 2023 · 12 集 · 已取消), reads as an action the user cancelled |
| pill (small in-page toast, `settings.notif.discreet.desc`) | 小提示条 | 标签 is reserved for tabs (标签页) |
| offset, delay (`agenda.*`) | 延迟 (per-series delay), 偏移 (mapping offset) | |
| shortcut | 快捷键 (heading: 键盘快捷键) | “Change” 更改, “Set” 设定, “Not set” 未设定 (设置 is the Settings screen) |
| Settings (`nav.settings`) | 设置 | |
| Activity (popup tab) | 动态 | Short tab label; 活动 means an event / campaign in Chinese apps |
| Matches (settings section) | 匹配记录 | |
| relations | 前作 · 续作 · 正篇 · 外传 · 衍生作品 | AniList Prequel, Sequel, Parent, Side story, Spin-off |
| formats | 剧场版 (Movie) · 特别篇 (Special) · TV 短篇 (TV short); TV, ONA, OVA unchanged | |

## 3. Settings and navigation labels

| Key | English | zh-CN |
|---|---|---|
| `nav.settings` | Settings | 设置 |
| `settings.cat.sync` | Playback & sync | 播放与同步 |
| `settings.cat.notifications` | Notifications & schedule | 通知与时间表 |
| `settings.cat.shortcuts` | Shortcuts | 快捷键 |
| `settings.cat.data` | My data | 我的数据 |
| `settings.cat.help` | Help & about | 帮助与关于 |
| `settings.section.accounts` | Accounts | 账号 |
| `settings.section.exclusions` | Excluded series | 已排除的番剧 |
| `settings.section.mappings` | Matches | 匹配记录 |
| `settings.section.backup` | Backup | 备份 |
| `settings.section.import` | Import | 导入 |
| `settings.section.airing` | New episodes | 更新提醒 (heading of the release-alert settings; 新剧集 also reads as “new TV series”) |
| `settings.section.notifications` | On-page notifications | 页面内通知 |
| `settings.section.agenda` | Schedule | 时间表 |
| `settings.section.panel` | Side panel | 侧边栏 |
| `settings.section.playback` / `.sync` | Playback / Sync | 播放 / 同步 |
| `settings.section.help` / `.about` | Help / About | 帮助 / 关于 |
| `settings.section.language` | Language | 语言 |
| `settings.section.danger` | Danger zone | 危险操作 |
| `settings.notif.*.title` | Discreet / Detailed / Alerts only | 简洁 / 详细 / 仅重要提示 |
| `panel.tab.nowPlaying` / `panel.tab.agenda` | Now playing / Schedule | 正在播放 / 时间表 |
| `nav.watching` / `nav.activity` | Watching / Activity | 在看 / 动态 |
| `common.open` | Open | 打开 |
| `settings.help.copy` | Copy diagnostic report | 复制诊断报告 |
| `settings.group.quick` | Quick settings | 快速设置 (not 快捷设置, too close to 快捷键) |
| `watching.sort.recent` | Last updated | 最近修改 (更新 is kept for new episodes) |
| `compare.job.dismiss` | OK | 确定 |
| Paths | Settings › Playback & sync · Settings › Excluded series · Settings › Help › Copy diagnostic report | 设置 › 播放与同步 · 设置 › 已排除的番剧 · 设置 › 帮助 › 复制诊断报告 |

## 4. Browser strings (`public/_locales/zh_CN/messages.json`)

| Message | zh-CN |
|---|---|
| `cmdCompleteEpisode` | 将当前剧集标记为已看 (same text as `settings.shortcuts.episode`) |
| `cmdOpenSidePanel` | 打开或关闭侧边栏 (same text as `settings.shortcuts.panel`) |
| Firefox gear-menu item “Manage Extension Shortcuts” | 管理扩展快捷键 (Firefox zh-CN wording, used in `settings.shortcut.manualFirefox`) |

## 5. Netflix

- “Viewing activity” page: 观看记录 (Netflix zh-Hans account page name, used in `crImport.*`).
- “Show more” button at the bottom of netflix.com/viewingactivity: **unknown**. Not verified on the real page with high confidence; the catalog text (`crImport.netflix.rule`) uses the generic “显示更多”, to be checked before relying on it in code.

## Development builds only

Settings › Help & about sections that exist only in development builds (2026-10-15, `settings.debugTrace.*`).

| English | Term |
|---|---|
| debug trace | 调试跟踪 |
| event (one line of the trace) | 事件 |
| verbose mode | 详细模式 |
