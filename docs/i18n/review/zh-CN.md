# Simplified Chinese (`zh-CN`) review log

Independent native-level review of `src/i18n/locales/zh-CN.json` (878 keys: the 934 English keys with the `_other` form only) and `public/_locales/zh_CN/messages.json`, against `en.json`, `fr.json`, `de.json`, `docs/i18n/context.json`, `docs/i18n/GLOSSARY.md` and the term sheet `docs/i18n/glossary/zh-CN.md`. Every key was read with its context note; composed texts were checked against the code that assembles them (`ui/feedback.ts`, `ui/page-media-view.ts`, `ui/media-actions.ts`, `content/ui/sync-toast.ts`, `shared/sync-feedback.ts`, `ui/platform-list.ts`, `background/controls.ts`).

## Summary

- 32 changes in `zh-CN.json`: 10 meaning, 4 grammar, 13 style, 5 terminology. No placeholder, plural or length problem was found (all within the limits of the notes, CJK counted as double width).
- `messages.json`: reviewed, unchanged (`extDescription` 53 characters, shortcut texts identical to `settings.shortcuts.episode` / `settings.shortcuts.panel`).
- Term sheet updated: progress-count rule, airing state “cancelled”, full term 更新提醒 (also for the `settings.section.airing` heading), pill = 小提示条, 条 for Netflix history rows.
- Mechanical checks: half-width spacing between Chinese and Latin text / digits / placeholders, full-width punctuation, `…`, `——`, ` · `, ` › `, `→`, `↔`, `−`, `✓` — all consistent (the only CJK-adjacent placeholders are the intended `{message}`, `{time}`, `{when}`, `{relative}`, `{delay}` cases). `npm run i18n:check -- zh-CN`: 0 errors, 0 warnings.

## Terminology audit

All core decisions of the term sheet were confirmed and are used consistently across the catalog: 在看 / 看过 / 搁置 / 抛弃 / 想看 / 重看 (Bangumi statuses), 番剧 (series), 季 / 集, 列表, 条目 (entry), 同步, 待确认 (to check), 待评分, 评分, 备注 (comment), 匹配 / 匹配记录, 已排除的番剧, 待同步 / 待同步项, 片尾 (credits), 弹出窗口, 侧边栏, 正在播放, 时间表, 当前页面, 首选播放平台, 导入观看记录 vs 备份, 预览, 账号 / 连接 / 登录已过期, 更新提醒 vs 重要提示, 设置 and its categories, 动态 (Activity). Every cross-reference (“设置”, “设置 › 播放与同步”, “设置 › 已排除的番剧”, “在看”, “动态”, “待确认”, “调整时间”, “打开”, “看过”, “你打几分？”, “正在播放”, “更改” / “设定”, “备份”, the GitHub template path 设置 › 帮助 › 复制诊断报告) matches the translation of the element it names.

Changes to the term sheet:

| Topic | Before | After | Reason |
|---|---|---|---|
| Watched-episodes count (`watching.heroProgress`, `.heroProgressNoTotal`, `.epShort`, `compare.chip.entry`, `inline.backTo`) | 第 {progress} 集 (ordinal) | {progress} / {total} 集 · 已看 {progress} 集 · 进度已回退至 {progress} 集 | Progress can be 0 (Plan to watch, new Watching entry, −1 from episode 1): “第 0 集” reads as an episode 0 |
| Airing state Cancelled | 已取消 | 已取消播出 | 已取消 alone reads as an action the user cancelled |
| Release alerts in summaries and section heading | 提醒 · 新剧集 | 更新提醒 everywhere | One term for one notion; 新剧集 also means “new TV series” |
| Pill (small toast) | 小标签 | 小提示条 | 标签 = tag / tab |
| Netflix history rows | 行 | 条 | Records are counted with 条 |

## Changes

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `agenda.empty.week` | 你在看的番剧这周没有更新。 | 你在看的番剧这一周没有更新。 | meaning | 这周 means the current week; the card speaks about the week displayed, which can be another one (note) |
| `agenda.estimate.custom` | 预计上线：日本播出时间 {offset}（此番剧单独设置）。 | 预计上线：日本播出时间 {offset}（为此番剧单独设置）。 | grammar | Missing preposition: “set for this series” = 为此番剧单独设置 |
| `compare.chip.entry` | {service} {status} · 第 {progress} 集 | {service} {status} · 已看 {progress} 集 | meaning | {progress} is a count of watched episodes; a Plan to watch entry gave “想看 · 第 0 集” (an episode 0) |
| `compare.filter.empty` | 此筛选下没有番剧。 | 当前筛选条件下没有番剧。 | style | 此筛选下 is stilted; 当前筛选条件下 is the usual UI phrase (and matches 当前筛选 on the bulk buttons) |
| `compare.pause.resume` | 中断后正在恢复… | 正在从中断处继续… | style | Word order unnatural; 继续 also matches the other countdown lines (…秒后继续) |
| `crImport.analyze.starting` | 正在开始分析… | 正在启动分析… | style | 正在开始 is awkward for a starting step |
| `crImport.intro` | SyncKai 会读取你 {platform} 标签页中的观看记录，在 AniList 上找到对应的每一季，并在写入任何内容之前，先向你展示将会发生的变化。 | SyncKai 会读取你的 {platform} 标签页中的观看记录，在 AniList 上找到对应的每一季，并在写入任何内容之前，先向你展示将会发生的变化。 | grammar | Possessive 的 missing before a Latin name (你 Netflix 标签页) |
| `crImport.netflix.rows` | 正在加载你的 Netflix 观看记录：{rows} 行… | 正在加载你的 Netflix 观看记录：{rows} 条… | style | History records are counted with 条; 行 sounds like table/text lines |
| `crImport.read.error.netflixLoggedOut` | 请在该标签页中登录 Netflix 并选择你的个人资料，然后重新打开“观看记录”页面，再重新读取。 | 请在该标签页中登录 Netflix 并选择你的个人资料，再次打开“观看记录”页面后重新读取。 | style | Double 重新 and 然后…再… chain; tighter sequence |
| `feedback.ignored.message` | 没有 AniList 条目关联到此平台上的这个标题，它可能不是动画。 | 此平台上的这个标题没有关联任何 AniList 条目，可能不是动画。 | style | “没有 X 关联到 Y” is translationese; topic-first sentence reads naturally after “{title}：” |
| `import.summary.rewatchDeclined_other` | 已拒绝的重看 | 已拒绝的重看询问 | meaning | What was declined is the in-page question “在重看…吗？”, not a rewatch; the bare noun was unclear in the summary table |
| `import.tooLarge` | 文件大小超过 5 MB：它不是 SyncKai 备份。 | 文件大小超过 5 MB，不是 SyncKai 备份。 | style | 它不是 is a literal calque of “it isn't”; a comma clause is the natural conclusion |
| `inline.backTo` | 已退回第 {progress} 集 | 进度已回退至 {progress} 集 | meaning | 退回 means “send back / reject”; −1 from episode 1 also gave “第 0 集”. Progress is a count (glossary §1) |
| `match.platformTitleOnly` | 仅通过标题找到（没有 AniList 条目关联到此 {platform} 番剧） | 仅通过标题找到（此 {platform} 番剧没有关联任何 AniList 条目） | style | Same translationese as feedback.ignored.message; same wording for the same idea |
| `onboarding.step2` | SyncKai 识别番剧 | SyncKai 自动识别番剧 | style | The bare step read like a heading; 自动 carries the point of the step (no action needed) |
| `page.airing.CANCELLED` | 已取消 | 已取消播出 | meaning | At the end of the info line (… · 12 集 · 已取消) it reads as “cancelled (by you)”; the airing state needs 播出 (glossary §2) |
| `page.uncertain` | 季为推测结果，请在下方确认 | 此季为推测结果，请在下方确认 | grammar | A bare 季 cannot stand as the subject; 此季 = the season shown |
| `popup.ignoreFailed` | 无法忽略此番剧。请重试。 | 无法跳过此番剧的评分。请重试。 | meaning | The failed action is skipping the rating (To rate card); “忽略此番剧” suggests ignoring/excluding the series |
| `prompt.rewatch.saving` | 正在开始重看… | 正在标为重看… | style | 正在开始重看 is awkward; the action sets the Rewatching status (same 标为 verb as the other status actions) |
| `queue.gone` | 此同步已不存在。 | 该同步项已不存在。 | terminology | 同步 is not a count noun; a pending sync is a 待同步项 (glossary §2) |
| `settings.airing.enableFirst` | 请先开启更新提醒，才能检查 | 开启更新提醒后才能检查 | grammar | “请先…，才能…” mixes an order with a condition; “…后才能…” is the idiomatic condition |
| `settings.help.noErrors` | 没有记录到错误 | 暂无错误记录 | style | 暂无… is the standard empty-state wording |
| `settings.language.noResult` | 没有找到语言 | 未找到匹配的语言 | style | Search empty state: 未找到匹配的… is the usual phrasing |
| `settings.notif.discreet.desc` | 在角落显示小标签 3 秒。全屏时不显示，扩展图标上会出现对勾。 | 在角落显示小提示条 3 秒。全屏时不显示，扩展图标上会出现对勾。 | meaning | 标签 means tag/label (and 标签页 = tab); the pill is a small toast = 提示条 |
| `settings.section.airing` | 新剧集 | 更新提醒 | terminology | Heading of the release-alert settings: 新剧集 also reads as “new TV series”; 更新提醒 is the glossary term for release alerts (same setting as the quick toggle) |
| `settings.summary.airingDelay` | 提醒延迟 {hours} 小时 | 更新提醒延迟 {hours} 小时 | terminology | Summary follows the level name (仅重要提示 · …): the bare 提醒 blurred release alerts and on-page alerts; full term per glossary |
| `settings.summary.airingOff` | 提醒已关闭 | 更新提醒已关闭 | terminology | Same as airingDelay; now identical to airing.skip.disabled |
| `settings.summary.airingOnTime` | 准时提醒 | 准时更新提醒 | terminology | Same as airingDelay |
| `watching.badge.upcoming` | 第 {episode} 集：{delay}后 | {delay}后更新第 {episode} 集 | style | The colon form is clipped (“Ep. 5: after 18 h”); natural order “18 小时后更新第 5 集”, same verb as 下一集即将更新 |
| `watching.epShort` | 第 {progress} 集 | 已看 {progress} 集 | meaning | {progress} = episodes watched; a new Watching entry with unknown total showed “第 0 集” |
| `watching.heroProgress` | 第 {progress} / {total} 集 | {progress} / {total} 集 | meaning | Count, not ordinal: Plan to watch lines showed “想看 · 第 0 / 12 集”; “0 / 12 集” reads correctly for every value |
| `watching.heroProgressNoTotal` | 第 {progress} 集 | 已看 {progress} 集 | meaning | Same as heroProgress when the total is unknown (“想看 · 第 0 集”) |

## Debatable, left unchanged

| Key(s) | Current | Why it stays |
|---|---|---|
| `nav.activity` and every “(动态)” reference | 动态 | 记录 or 消息 would fit only part of the tab; 动态 is how Chinese fans name AniList's Activity, and 活动 means an event / campaign |
| `settings.notif.discreet.title` | 简洁 | Literal 低调 is rare in UI; 简洁 reads as the natural opposite of 详细 |
| `page.seasonPicker` | 选择季 | A bare 季 before a dropdown looks truncated; 选择季 is slightly verb-like but clear |
| `sync.seriesFallback` | 未知番剧 | Inserted into 《{title}》 templates (《未知番剧》：已搁置) and stored as a rating-card title; the least odd fallback |
| `backup.fileName` | synckai-备份-{date}.json | The note asks to translate “backup”; a Chinese file name is valid on every OS. An all-ASCII name would also be acceptable |
| `api.invalidResponse.*`, `api.invalidAfterUpdate.*` | 返回了意外的响应 | Calque of “unexpected response”, but it is the standard Microsoft zh-CN wording; 异常响应 would be equally fine |
| `cmdCompleteEpisode`, `settings.shortcuts.episode` | 将当前剧集标记为已看 | 剧集 can also mean “TV series”; in this context (marking as watched while playing) it reads as the episode. 将当前这一集标记为已看 would be unambiguous |
| `inline.ratingSaved` | 已保存评分 {stars}/10 · 《{title}》 | 《》 after ` · ` is unusual, but {title} is a pure series title, as the term sheet requires |
| `feedback.queuedSuffix` | ` · 稍后会自动重试` | Deliberate departure from the English “. ” (term sheet): the preceding error already ends with 。 |
| `panel.enablePlatform` / `page.platformOff` | 启用 {platform} / 如需重新开启 | Near-synonyms; 启用 is natural on a button, 开启/关闭 on toggles |
| `watching.openOn` / `agenda.openTitle` | 去 {platform} 观看 / 在 {platform} 上打开 | Same English, different places (inviting pill vs tooltip); both natural |
| `prompt.rewatch.title` | 在重看《{title}》吗？ | Subject dropped, as in speech; 你在重看…吗？ would also work |
| `panel.nowPlaying.relation.*` | 前作 · 续作 · 正篇 · 外传 · 衍生作品 | Bangumi uses 前传 · 续集 · 主线故事 · 番外篇 · 衍生; both sets are idiomatic |
| `crImport.netflix.rule` | “显示更多” | Netflix zh-Hans label of the “Show more” button not verified on the real page (already flagged in the term sheet) |
| `settings.shortcut.manualFirefox` | 管理扩展快捷键 | Believed to be Firefox zh-CN's gear-menu wording; not verified on a zh-CN Firefox |

## Code-side notes (not fixable in the catalog)

- `{services}` is joined with `", "` (`ui/feedback.ts`, `ui/media-actions.ts`) and `{titles}` in `airing.notification.group_other` with `", "` (`background/airing-policy.ts`): Chinese would use 、.
- `panel.offTargetPlatforms` + `panel.offTargetEnable` are joined with a space, and `panel.nowPlaying.detailsError` is followed by a space and the error sentence: a half-width space after 。 in Chinese.
- `formatOffset` (`shared/agenda.ts`) is not localized: `agenda.estimate.*` show “日本播出时间 +1 h”.

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | 冬季 / 春季 / 夏季 / 秋季 | {year}年冬季 / {year}年春季 / {year}年夏季 / {year}年秋季 | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |
| `sync.noServiceFollows` | 没有已连接的服务在追踪此番剧。 | 已连接的服务中都没有此番剧的条目。 | Meaning: shown when no connected service has an entry for the anime (no AniList / MyAnimeList ID), not when none “tracks” it; English, French and German fixed the same way. Term sheet: entry = *条目* |
| `watching.badge.upcoming` | {delay}后更新第 {episode} 集 | 第 {episode} 集 {delay}后 | Layout: in a Watching row (400 px popup) with a 4-digit episode and no total (One Piece, « 已看 1122 集 »), the chip is cut at its end and lost the episode number (« 4 天后更新第 112… »). Episode first, without 更新, it fits (« 第 1123 集 4 天后 »); same structure as zh-TW; `第 N 集` and no space after `{delay}` per the term sheet |

Code fixes that change how this catalog is displayed:

- `{services}` and `{titles}` are joined with `Intl.ListFormat`: 、 between names, and a space between 和 / 或 and a Latin name (AniList 和 MyAnimeList), as the term sheet requires.
- Sentences are joined without a space after 。 (`joinSentences`).
- `formatOffset` is localized: 日本播出时间 +1 小时 30 分钟.
- `panel.nowPlaying.season.*` take a `{year}` placeholder: 2024年秋季.
- Netflix history import: the zh-CN “Show more” label is still unverified and was NOT added; a zh-CN-profile import still reads only the first rows.

Layout (`npm run test:i18n-layout`): `watching.badge.upcoming` (table above) was the only finding. The chip is now also truncated, with its full text in a tooltip, if a longer text ever overflows.

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). No plural forms in this language: one `_other` variant with the same text, `{total}` renamed `{count}`.

| Key | Text |
|---|---|
| `sync.beyondEntry_other` | 第 {progress} 集超出了条目的 {count} 集 |

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | 无法识别你的 Netflix 个人资料语言中的“显示更多”按钮：只读取了最近的剧集。请在 Netflix 上将该个人资料的语言设为与 SyncKai 相同，然后重新读取。 |

Netflix history import: the “显示更多” button of a Netflix profile in Simplified Chinese is now recognized (label from Netflix's help article 101917 in this language, same text as `crImport.netflix.rule`).

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video（仅限动画） |
| `settings.prime.label` | 在 Prime Video 上同步 |
| `settings.prime.helpOff` | 只同步动画（动漫类型，或带日语音轨、或标题与 AniList 完全一致的动画作品）。浏览器会请求访问 primevideo.com 的权限 |
| `settings.prime.helpOn` | SyncKai 只读取 Prime Video 页面本来就会收到的信息。在之前已打开的 Prime Video 标签页中，将从下一集开始追踪 |
| `settings.prime.denied` | 访问 primevideo.com 的请求被拒绝：Prime Video 保持关闭 |
| `settings.prime.disabled` | Prime Video 已关闭：请刷新所有已打开的 Prime Video 标签页以完全停止 |
| `settings.prime.error` | 无法更改 Prime Video 访问权限，请重试 |

| Key | Text |
|---|---|
| `onboarding.intro` | 在 Crunchyroll 或 ADN（Netflix、Disney+ 和 Prime Video 可选）上看番：每集看完时，SyncKai 都会更新你的列表。 |
| `watching.tip` | Netflix、Disney+、Prime Video（可选）以及你的首选播放平台，都可以在 {path} 中调整。 |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | 与平台信息一致：{signals} |
| `match.signalsContradict` | 与平台信息不符：{signals} |
| `match.yearRemake` | 通过首播年份（{year} 年）区分重制版 |
| `match.signal.year` | 首播年份 |
| `match.signal.episodes` | 集数 |
| `match.signal.duration` | 单集时长 |
| `match.signal.format` | 类型（剧场版或剧集） |
| `match.signal.country` | 制作国家 |
| `match.signal.originalTitle` | 原标题 |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | 已保存的匹配记录与平台信息不符：{signals} |

## 2026-10-14 · Matching diagnostic (development builds only)

New keys `settings.matchDiag.*` (Settings › Help & about, section shown only in development builds, never in the published extension): the last 50 AniList matching decisions, a « Copy » button per row (one decision as JSON, for the test corpus) and a « Clear » button. `{count}` follows a label and a colon (no plural form); `JSON` is a format name. Terms from this language's term sheet (match, entry). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.title` | 匹配诊断 |
| `settings.matchDiag.text` | 仅限开发版本：按时间倒序列出最近 50 条 AniList 匹配决策，保留到浏览器关闭。可将其中一条复制为 JSON，加入测试语料库。 |
| `settings.matchDiag.empty` | 尚未记录任何决策 |
| `settings.matchDiag.copy` | 复制 |
| `settings.matchDiag.copyTitle` | 将此决策复制为 JSON |
| `settings.matchDiag.copied` | 已复制 |
| `settings.matchDiag.copyFailed` | 无法复制此决策。 |
| `settings.matchDiag.clear` | 清空 |
| `settings.matchDiag.candidates` | 候选：{count} |
| `settings.matchDiag.noEntry` | 无条目 |

## 2026-10-15 · Debug trace (development builds only)

New keys `settings.debugTrace.*` (Settings › Help & about, section shown only in development builds, never in the published extension, below the matching diagnostic): a timeline of what the extension did (pages, service worker, AniList and MyAnimeList requests), a verbose switch, a category filter (category names stay in English: technical identifiers), « Copy trace » (the whole trace as JSON) and the « Clear » button of the matching diagnostic (`settings.matchDiag.clear`, reused). `{count}` and `{max}` follow a label and a colon (no plural form) and arrive formatted for the language; `JSON` is a format name; `service worker` kept as the browser's technical term. New terms added to this language's term sheet (debug trace, event, verbose mode); other terms from it (account). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.debugTrace.title` | 调试跟踪 |
| `settings.debugTrace.text` | 仅限开发版本：按时间倒序记录 SyncKai 在页面、Service Worker 中以及与 AniList、MyAnimeList 交互时的操作，保留到浏览器关闭。不会记录任何令牌、Cookie 或账号 ID。报告问题时，可将整个跟踪复制为 JSON 并分享。 |
| `settings.debugTrace.empty` | 尚未记录任何事件 |
| `settings.debugTrace.copy` | 复制跟踪 |
| `settings.debugTrace.copied` | 已复制 |
| `settings.debugTrace.copyFailed` | 无法复制跟踪。 |
| `settings.debugTrace.verbose` | 详细模式（所有日志行） |
| `settings.debugTrace.count` | 事件：{count} / {max} |
| `settings.debugTrace.allCategories` | 所有类别 |
| `settings.debugTrace.filterAria` | 按类别筛选事件 |

## 2026-10-16 · Matching diagnostic: Copy all (development builds only)

New keys in the « Matching diagnostic » section (Settings › Help & about, development builds only, never in the published extension, now collapsed by default behind its title): « Copy all » copies every recorded decision as one JSON array, next to « Clear »; its label becomes « Copied » (`settings.matchDiag.copied`, reused) and a failure reuses `settings.matchDiag.copyFailed`. `JSON` is a format name. Same word for « decision » as `settings.matchDiag.copyTitle`, in the plural; other terms from this language's term sheet. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.copyAll` | 全部复制 |
| `settings.matchDiag.copyAllTitle` | 将所有决策复制为 JSON |

## 2026-10-16 · Episode guards (« To check » reasons)

New reasons on a « To check » card (`fix/episode-guards`, audit SEC-01): a sync that would jump straight to the last episode from far behind, and episodes reported as finished in a burst, now wait for the user instead of being written. Same « to check » term as `match.otherSeriesExcluded`, same episode wording as `sync.beyondEntry_*`; `{from}` and `{progress}` are episode numbers. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `sync.review.finaleJump` | 从第 {from} 集直接跳到最后一集（第 {progress} 集）：待确认 |
| `sync.review.burst` | 几分钟内看完了多集：待确认 |

## 2026-10-17 · Status bar (popup and side panel)

New texts of the status bar shown at the bottom of the popup and, now, of the side panel (`feature/ui-status-bar`): a synced episode or a count of synced episodes under the series title, shown until the user hides it (« Seen, hide », a × button label), and the history import running, ready to confirm and done. Same words as this language's term sheet: 已同步 (synced), 部 (series counter, as `crImport.preview.toUpdate`), 第 N 集 for the numbered episode and N 集 for the count, 导入 (import, as `crImport.apply.done`), 待确认 (to confirm, common.confirm 确认); half-width spaces around digits and placeholders; « Seen, hide » is 知道了，隐藏 (usual dismiss wording); ` · ` and ` / ` kept; `{platform}` is a brand name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `footer.dismiss` | 知道了，隐藏 |
| `footer.importDone_other` | 导入完成 · {count} 部已更新 |
| `footer.importProgress` | {platform} 导入中 · {done} / {total} |
| `footer.importReady_other` | 导入就绪 · {count} 部待确认 |
| `footer.syncedEpisode` | 第 {episode} 集已同步 |
| `footer.syncedEpisodes_other` | {count} 集已同步 |

## 2026-10-17 · Account menu (status bar)

New texts of the account menu that opens above the AniList / MyAnimeList logo of the status bar (popup and side panel): the logo button's label (also when the session expired), the connection status line, three stat tiles (anime count, episodes watched, days watched, each number shown above its short label), the « Synced this week » row with its tooltip and value, and « View my profile ». Following this language's term sheet, used 账号, 已连接 (as `settings.account.connected`), 登录已过期 (`common.sessionExpired`), 同步, 集 / 集数, 动画, 个人主页 (as `settings.account.openProfile`); the days tile label is 观看时长; « day » is 天, as `time.countdown.days`; full-width comma. ` · ` kept; `{service}` is a brand name, `{name}` the user's AniList / MyAnimeList user name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `accountMenu.connected` | 已连接 |
| `accountMenu.connectedAs` | {name} · 已连接 |
| `accountMenu.label` | {service} 账号 |
| `accountMenu.labelExpired` | {service} 账号，登录已过期 |
| `accountMenu.profile` | 查看我的个人主页 |
| `accountMenu.stats.anime_other` | 动画 |
| `accountMenu.stats.days_other` | 观看时长 |
| `accountMenu.stats.daysValue` | {days} 天 |
| `accountMenu.stats.episodes_other` | 集数 |
| `accountMenu.week.label` | 本周已同步 |
| `accountMenu.week.title` | 本周由 SyncKai 同步的剧集 |
| `accountMenu.week.value_other` | {count} 集 |

## 2026-10-17 · Settings redesign (Preact): new and changed keys

New texts of the redesigned Settings (Preact): the Platforms and Display categories, the screen-reader names of the back button and of the category card, the row summaries of the Settings home, the Keyboard section of Display, the two sections of Shortcuts, and the section titles and notes of Accounts. Changed: `settings.cat.notifications` (now the single word: the Schedule options moved to Platforms), `settings.summary.connected` (a word instead of ✓), `settings.summary.paused` (now a standalone, capitalised summary), `settings.summary.version` (a word instead of « v »), `settings.entry.help` (the « both accounts connected » condition moved to `settings.entry.unavailable`). Summaries are joined with ` · ` by the code; `settings.account.expiredHelp` and `settings.account.otherStillSynced` are joined as two sentences. The Display summary reuses `settings.section.language`, `settings.section.panel` and `settings.shortcuts.pointer`; the My data summary the history import and backup words; the player summary `settings.player.label`. Half-width spaces around Latin names and placeholders, none next to full-width punctuation; the back label quotes the page name (返回“{page}”). Platform count 已启用 {count}/{total}; player summary 首选 {player} (首选播放平台). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.cat.notifications` | 通知 |
| `settings.cat.platforms` | 平台 |
| `settings.cat.display` | 显示 |
| `settings.backToAria` | 返回“{page}” |
| `settings.group.categories` | 分类 |
| `settings.summary.connected` | {service} 已连接 |
| `settings.summary.notConnected` | {service} 未连接 |
| `settings.summary.bothConnected` | AniList 和 MyAnimeList 均已连接 |
| `settings.summary.auto` | 自动 |
| `settings.summary.paused` | 已暂停 |
| `settings.summary.platforms_other` | 已启用 {count}/{total} |
| `settings.summary.player` | 首选 {player} |
| `settings.summary.display` | 语言、侧边栏、键盘快捷键 |
| `settings.summary.data` | 导入观看记录 · 备份 |
| `settings.summary.version` | 版本 {version} |
| `settings.summary.noErrors` | 无错误 |
| `settings.display.keyboard` | 键盘 |
| `settings.display.shortcutsHelp` | 用于将剧集标为已看或打开侧边栏的按键 |
| `settings.shortcuts.duringPlayback` | 播放时 |
| `settings.shortcuts.navigation` | 导航 |
| `settings.accounts.lists` | 同步的列表 |
| `settings.accounts.both` | 两个账号都连接时 |
| `settings.accounts.privacy` | 登录在 AniList 或 MyAnimeList 官网完成，SyncKai 永远看不到你的密码。 |
| `settings.account.expiredHelp` | 重新连接前，你的剧集不会再发送到 {service}。 |
| `settings.account.otherStillSynced` | {service} 仍会继续更新。 |
| `settings.entry.help` | 点击番剧标题或封面时打开的页面 |
| `settings.entry.unavailable` | AniList 和 MyAnimeList 都连接后才能使用。 |

## 2026-10-17 · Settings › Sync, Matches and Excluded series (Preact)

New texts of the redesigned Sync settings page and of its two sub-pages (Matches, Excluded series), moved out of My data: section titles « Automatic » / « Per series », the descriptions of the two « Episode counted as watched » cards, the « Per series » rows, the Matches intro, search, empty and no-result texts, « Show N more on {platform} », the four origin badges and their legend, the Excluded series section, note, empty hint and the « {year} series · excluded on {date} » fragments. Changed: `settings.trigger.legend` (« Episode counted as watched », where the old text was only « Episode watched »), `settings.trigger.credits` (« (recommended) » moved to `settings.trigger.creditsHelp`), and the paths of `popup.syncDisabledDetail` / `review.excludeTitle` (now nav.settings › settings.section.sync › settings.section.exclusions, built from this catalog's own titles). Removed: `settings.mappings.count_*`, `settings.mappings.help`, `settings.mappings.manage`. `{action}` is the « Re-enable » button (`settings.exclusions.help`) or the « Stop syncing this series » menu item (`settings.exclusions.emptyHelp`), so the quoted labels always match. The match / entry / excluded / re-enable words reuse this catalog's existing terms (`settings.section.mappings`, `settings.mappings.entryFallback`, `settings.section.exclusions`, `settings.exclusions.reactivate`). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.section.automatic` | 自动 |
| `settings.section.perSeries` | 按番剧 |
| `settings.trigger.credits` | 片尾开始时 |
| `settings.trigger.creditsHelp` | 推荐：平台给出的准确时间点 |
| `settings.trigger.percentageHelp` | 片尾位置未知时也会使用 |
| `settings.sync.mappingsRow` | 已记住的匹配 |
| `settings.sync.mappingsRowHelp` | 为每部番剧选定的 AniList 季 |
| `settings.sync.exclusionsRowHelp` | 永不同步，可在此恢复 |
| `settings.mappings.intro_other` | 已记住 {count} 部番剧，按平台分组：平台上的季 → SyncKai 写入的 AniList 条目。忘记某条匹配后，下一集时会重新计算。 |
| `settings.mappings.search` | 搜索番剧或条目 |
| `settings.mappings.noResult` | 没有与“{query}”对应的匹配记录 |
| `settings.mappings.noResultHelp` | 可按番剧名或 AniList 条目名搜索。 |
| `settings.mappings.emptyHelp` | SyncKai 会为每个同步过的季记住一条。 |
| `settings.mappings.showMore_other` | 查看 {platform} 上的其余 {count} 条 |
| `settings.mappings.origin.chosen` | 你选择的 |
| `settings.mappings.origin.learned` | 自动学习 |
| `settings.mappings.origin.unmarked` | 旧记录 |
| `settings.mappings.origin.unverified` | 已导入 · 待复核 |
| `settings.mappings.origin.chosenHelp` | 由你确认或选择：不会再被质疑。 |
| `settings.mappings.origin.learnedHelp` | 由 SyncKai 找到：若与平台信息矛盾会重新计算。 |
| `settings.mappings.origin.unmarkedHelp` | 2.4 之前保存：会保留，出现矛盾时需要核对。 |
| `settings.mappings.origin.unverifiedHelp` | 来自备份：首次使用时会重新核对。 |
| `settings.mappings.originLegend` | 匹配记录的来源 |
| `settings.exclusions.section` | 永不同步 |
| `settings.exclusions.help` | 已排除的番剧不会再同步，所有季都一样。点“{action}”后从下一集起重新追踪。 |
| `settings.exclusions.emptyHelp` | 要停止同步某部番剧，请在它的“⋯”菜单中选择“{action}”。 |
| `settings.exclusions.seriesYear` | {year} 年的番剧 |
| `settings.exclusions.excludedOn` | {date}排除 |
| `popup.syncDisabledDetail` | 可在“设置 › 同步 › 已排除的番剧”中恢复同步 |
| `review.excludeTitle` | 排除此番剧（所有季）：可在“设置 › 同步 › 已排除的番剧”中恢复同步 |

## 2026-10-17 · Settings › Platforms and Notifications (Preact)

Texts of the redesigned Platforms page (list of sites with « Included » / « Access missing » or a switch, preferred player dropdown, estimated release time per platform with − / + buttons, moved there from the Schedule card) and Notifications page (« On the playback page » style cards and « New episodes »). New: `settings.platforms.where`, `settings.platforms.allAnime`, `settings.platforms.included`, `settings.platforms.accessMissing`, `settings.platforms.note`, `settings.player.openOn`, `settings.player.enableFirst`, `settings.offsets.earlier`, `settings.offsets.later`, `settings.notif.legend`. Changed: `settings.player.help`, `settings.offsets.title`, `settings.offsets.help`, `page.platformOff`, `settings.section.notifications`, `settings.notif.discreet.desc`, `settings.notif.detailed.desc`, `settings.notif.alertsOnly.desc`, `settings.notif.alertsAlways`, `settings.delay.title`, `settings.airing.enableFirst` (the notification descriptions now describe the pill and the bubble, « Extra delay » replaces « Delay », the release-time help says the alerts use it too, « Turn on alerts… » is now visible text). `page.platformOff` keeps its sentence; only the path changed, from « Settings › Playback & sync » to nav.settings › settings.cat.platforms of this catalog. Removed: `settings.section.playback`, `settings.netflix.section`, `settings.netflix.label`, `settings.disney.section`, `settings.disney.label`, `settings.prime.section`, `settings.prime.label`, `settings.airing.label`, `settings.airing.help`, `settings.section.agenda`. The Schedule word, « Open », the release-alert name and the minute unit reuse this catalog's `panel.tab.agenda`, `common.open`, `settings.quick.airing.label` and `settings.offsets.unit`. Half-width spaces around `{minutes}` and Latin names; « episode » in the alerts-only text is « 一集 ». Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.platforms.where` | SyncKai 追踪你看番的平台 |
| `settings.platforms.allAnime` | 所有动画 |
| `settings.platforms.included` | 已内置 |
| `settings.platforms.accessMissing` | 缺少权限 |
| `settings.platforms.note` | 开启平台时会请求访问其网站。只读取播放页和番剧页。 |
| `settings.player.openOn` | 打开剧集的平台 |
| `settings.player.enableFirst` | 请先开启 |
| `settings.player.help` | 番剧在多个已开启的平台上都有时，“打开”会使用此平台。 |
| `settings.offsets.title` | 预计上线时间 |
| `settings.offsets.help` | 以日本播出后的时间计算。用于“时间表”和更新提醒；单部番剧可在时间表的所在行中单独调整。 |
| `settings.offsets.earlier` | 提前 {minutes} 分钟 |
| `settings.offsets.later` | 推迟 {minutes} 分钟 |
| `page.platformOff` | {platform} 已关闭：SyncKai 不会在这里追踪任何内容。如需重新开启：设置 › 平台。 |
| `settings.section.notifications` | 在播放页面上 |
| `settings.notif.legend` | 页面内通知样式 |
| `settings.notif.discreet.desc` | 在视频角落显示小提示条几秒钟 |
| `settings.notif.detailed.desc` | 显示该集以及 AniList 和 MyAnimeList 同步结果的气泡 |
| `settings.notif.alertsOnly.desc` | 一切正常时不显示；仅在出错或有待确认的一集时显示气泡 |
| `settings.notif.alertsAlways` | 无论选择哪种样式，出错或待确认的番剧都会显示。 |
| `settings.delay.title` | 额外延迟 |
| `settings.airing.enableFirst` | 开启更新提醒以检查新的一集 |

## 2026-10-17 · Settings › My data, AniList ↔ MAL differences, Help & about (Preact)

Texts of the redesigned My data page (one « Import a watch history » card, Backup card, « Compare » row opening the AniList ↔ MyAnimeList differences page, which moved there from the popup's Activity screen) and Help & about page (diagnostic report row, error log that unfolds, About card with What's new / Privacy / Source code links). New: `settings.import.title`, `settings.section.compare`, `settings.compare.title`, `settings.compare.help`, `settings.data.perSeries`, `compare.align`, `compare.bulk.help`, `compare.job.background`, `settings.help.diagnostic`, `settings.help.diagnosticHelp`, `settings.help.journalNote`, `settings.about.whatsNew`, `settings.about.privacy`. Changed: `settings.crImport.help`, `settings.backup.help`, `settings.backup.import`, `settings.help.copy`, `settings.about.source` (import help in two sentences, backup help « in one file », « Import » without ellipsis, « Copy the report » next to the new « Diagnostic report » title, « Source code » with « GitHub » on the right). `help.issue.body` keeps its text; only its last-line path changed, to nav.settings › settings.cat.help › settings.help.copy of this catalog. The compare.* texts are unchanged: their context notes now point to Settings › My data. Removed: `settings.section.import`, `settings.backup.crImportTitle`, `settings.crImport.openAria`, `settings.help.text`, `settings.help.copyTitle`, `settings.help.clearHelp`, `settings.help.reportTitle`. The version line reuses `settings.summary.version`, the « Clear » button `settings.matchDiag.clear`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.import.title` | 补录你看过的番剧 |
| `settings.crImport.help` | 支持 Crunchyroll、ADN 或 Netflix。写入前会先显示预览。 |
| `settings.backup.help` | 设置、匹配记录、已排除的番剧和记录，保存在一个文件里。绝不包含你的 AniList 或 MyAnimeList 登录信息。 |
| `settings.backup.import` | 导入 |
| `settings.section.compare` | 比较 |
| `settings.compare.title` | AniList ↔ MyAnimeList 差异 |
| `settings.compare.help` | 比较你的两个列表，并按你选择的方向对齐 |
| `settings.data.perSeries` | 匹配记录和已排除的番剧在“{path}”中管理。 |
| `compare.align` | 对齐 |
| `compare.bulk.help` | “{action}”会把 AniList 的内容写到 MyAnimeList；执行前会先列出改动并请你确认。 |
| `compare.job.background` | 关闭此页面也会继续。 |
| `settings.help.diagnostic` | 诊断报告 |
| `settings.help.diagnosticHelp` | 粘贴到错误报告中：版本、浏览器、设置、最近的错误。不含令牌和账号。 |
| `settings.help.copy` | 复制报告 |
| `settings.help.journalNote` | 最多保留最近 50 条，最新的在前；令牌已隐去。 |
| `settings.about.whatsNew` | 新功能 |
| `settings.about.privacy` | 隐私 |
| `settings.about.source` | 源代码 |

## 2026-10-17 · Popup « My series » row menu (Preact)

The row « … » menu of the popup's « My series » list and of the « Continue » card now groups the entry links and the platform searches in two sub-menus. New: `watching.menu.openEntry` (sub-menu entry, its items are the bare AniList / MyAnimeList names; wording taken from `page.openOn` without « on {service} »), `watching.menu.searchOn` (sub-menu entry, its items are the bare platform names; wording taken from `watching.searchOn`, ending with « … »). Changed: `settings.entry.help`, which now also says that « Default entry page » picks the list shown in « My series » (quoted with the exact `watching.mySeries` of this catalog). The « −1 episode » item left the menu (the row has its own −), `watching.minusOne` stays for the « On this page » card. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `watching.menu.openEntry` | 打开条目 |
| `watching.menu.searchOn` | 在平台上搜索… |
| `settings.entry.help` | 点击番剧标题或封面时打开的页面，也决定“我的番剧”显示哪份列表 |



## 2026-10-17 · Popup « On this page » card (Preact)

The popup's « On this page » card was redesigned: the Hold / Drop / Done row and the AniList / MAL links moved to the card's « … » menu (shared with « My series »), and the season dropdown, the star rating and the comment moved to a foldable « Details » section. New: `page.currentStatus` (grey mention at the end of the menu item of the series' current status), `page.details` (foldable button listing what the section holds, same nouns as `page.seasonPicker`, the rating words of `rating.*` and `notes.title`), `page.seasonOnAniList` (title above the season dropdown), `page.seasonHelp` (help under it on an episode page; the match word is the one of `settings.section.mappings`), `page.yourRating` (title above the stars). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `page.currentStatus` | 当前状态 |
| `page.details` | 详情：季、评分、备注 |
| `page.seasonOnAniList` | AniList 上的季 |
| `page.seasonHelp` | 更换季会修正之后各集的匹配。 |
| `page.yourRating` | 我的评分 |


## 2026-10-17 · Popup « Activity » tab (Preact)

The popup's Activity tab was redesigned: failed and pending syncs are now two sections, and every section heading is an uppercase label followed by « · {count} » added by the code. New: `queue.failedHeading` (same failure word as `queue.failed`), `queue.pendingHeading` (syncs waiting for a retry, wording of the former `queue.sectionTitle`), `ratings.heading` (the former `ratings.sectionTitle` without its count). The « To check » heading now reuses `inline.toCheck`. Removed: `queue.section`, `queue.sectionTitle`, `ratings.section`, `ratings.sectionTitle`, `review.title`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `queue.failedHeading` | 失败 |
| `queue.pendingHeading` | 待同步 |
| `ratings.heading` | 待评分 |


## 2026-10-17 · Side panel « Now playing » (Preact)

The side panel's « Now playing » tab was redesigned as cards: « You're watching » (live playback: bar, credits marker, countdown, sync state with an icon), « Your list » (status chip, « Progress » and the stepper, one line per account, the series « … » menu shared with the popup: Hold / Drop / Done moved there), then foldable sections « Rating and comment », Synopsis, related entries and Discussions. New: `panel.nowPlaying.watching` (heading of the live card, addresses the user), `panel.nowPlaying.list` (heading of the list card, same « your list » words as `page.notInList`), `panel.nowPlaying.ratingNotes` (section title, same nouns as `page.yourRating` and `notes.title`), `panel.live.creditsAt` and `panel.live.creditsUnknown` (legend of the yellow marker under the bar, credits word of `settings.trigger.credits`), `panel.live.countdownCredits` and `panel.live.countdownRatio` (countdown line, wording of the former `panel.live.countdown` plus what the sync waits for, as in `settings.trigger.credits` / `settings.summary.percentage`). Changed: `panel.live.synced` lost its trailing « ✓ » (a check icon now precedes it). The « Progress » label reuses `compare.filter.progress`. Removed: `page.action.COMPLETED`, `page.action.DROPPED`, `page.action.PAUSED` (the status button row is gone), `panel.live.countdown`, `panel.nowPlaying.progress`, `watching.nextWatched`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `panel.nowPlaying.watching` | 正在观看 |
| `panel.nowPlaying.list` | 你的列表 |
| `panel.nowPlaying.ratingNotes` | 评分和备注 |
| `panel.live.creditsAt` | 片尾开始于 {time} |
| `panel.live.creditsUnknown` | 片尾未知 · 播放到 {percent}% 时同步 |
| `panel.live.countdownCredits` | {time}后同步 · 片尾开始时 |
| `panel.live.countdownRatio` | {time}后同步 · 播放到 {percent}% 时 |
| `panel.live.synced` | 已同步 |


## 2026-10-17 · Side panel Schedule (Preact) and week picker

The Schedule tab of the side panel was redesigned: days in order with « No episode » on empty days, episode lines « 18:00 Crunchyroll · Japan 17:00 » (the platform time first, the Japanese broadcast last and cut first), a « ⋯ » menu with « Adjust time » (its second line gives the time and whether the delay is the series' own or the default), « Open the entry › » and « Search on… › », and a week button that opens a month calendar. New: `agenda.adjust.custom` and `agenda.adjust.default` (second line of « Adjust time », lower case after « · »), `agenda.adjust.platform` (first sentence of `agenda.estimate.title`, shown in the delay editor), `agenda.picker.label`, `agenda.picker.prevMonth`, `agenda.picker.nextMonth`, `agenda.picker.thisWeek`, `agenda.picker.hint` (month calendar; the hint names the arrow keys and the Enter key). Changed: `agenda.jp` writes the country name instead of « JP » (unchanged where it already did: ja, ko, zh-CN, zh-TW). Removed: `watching.searchOn` (the search entries are now the platform names of the « Search on… › » sub-menu). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `agenda.adjust.custom` | 为此番剧单独设置 |
| `agenda.adjust.default` | 默认延迟 |
| `agenda.adjust.platform` | 预计在 {platform} 上线：日本播出时间 {offset}。 |
| `agenda.picker.label` | 选择一周 |
| `agenda.picker.prevMonth` | 上个月 |
| `agenda.picker.nextMonth` | 下个月 |
| `agenda.picker.thisWeek` | 本周 |
| `agenda.picker.hint` | 按 ↑ ↓ 切换周，按 Enter 显示。 |

## 2026-10-18 · History import page, steps 1 to 3 (Preact)

The history import page (steps 1 to 3) was redesigned: a 5-step indicator under the title (Platform, Reading, Analysis, Preview, Import), one tile per platform with the state of its tab (ready, no tab open, waiting for the tab, access to grant), the rules in a « How it works » card (its title reuses `onboarding.howItWorks`), and the Netflix reading card listing its three steps (done with a check, current with a bar, next ones greyed). New: `crImport.steps` (screen readers only), `crImport.step.*` (one word each: the five steps share one line at 576 px), `crImport.tile.*` (status line of a tile, no platform name), `crImport.netflix.heading`, `crImport.netflix.rowsDone` (step done: same wording as `crImport.netflix.rows` without the ellipsis), `crImport.netflix.titlesNext` and `crImport.netflix.showsNext` (steps not started yet: same wording as `crImport.netflix.titles` / `.shows` without the counts). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.steps` | 步骤 |
| `crImport.step.platform` | 平台 |
| `crImport.step.reading` | 读取 |
| `crImport.step.analysis` | 分析 |
| `crImport.step.preview` | 预览 |
| `crImport.step.import` | 导入 |
| `crImport.tile.ready` | 标签页已就绪 |
| `crImport.tile.none` | 没有打开的标签页 |
| `crImport.tile.access` | 需要允许访问 |
| `crImport.tile.waiting` | 正在等待标签页… |
| `crImport.netflix.heading` | 正在读取你的 Netflix 观看记录 |
| `crImport.netflix.rowsDone` | 已加载 Netflix 观看记录：{rows} 条 |
| `crImport.netflix.titlesNext` | 在 AniList 上查找动画 |
| `crImport.netflix.showsNext` | 读取你的 Netflix 观看进度（保留的作品） |

## 2026-10-18 · History import page, steps 4 and 5, and Backup page (Preact)

Steps 4 and 5 of the history import page and the Backup page were redesigned. The preview summary is now a row of tiles, each with its number above a label: `crImport.summary.*` are those labels without the number (they replace `crImport.preview.toUpdate`, `.review`, `.upToDate`, `.excluded`, `.ignored` and `.failed`, removed; same wording without `{count}`). The « Update N series » button has a muted hint on its left (`crImport.preview.hint.*`: a line left unchecked, none checked, locked during the import, what stays checked after a stopped or failed import). Each « To check » season shows the entry its check card will propose (`crImport.review.proposed`, a small badge) and the other entries to choose from (`crImport.review.alternatives`, `{titles}` = a localized list). The Backup page's Export card lists what the file contains and never contains (`import.included`, `import.neverIncluded`, `import.includes.*`, reusing the words of `import.summary.*` and `import.intro`); the Import card titles the file table (`import.fileContents`) and shows the export date under the file name (`import.exportedAt`, replaces `import.exportedOn`, removed: same text without the leading ` · `). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.summary.toUpdate_other` | 待更新 |
| `crImport.summary.review_other` | 待确认 |
| `crImport.summary.upToDate_other` | 已是最新 |
| `crImport.summary.excluded_other` | 已排除 |
| `crImport.summary.ignored_other` | 已跳过的标题（非动画） |
| `crImport.summary.failed_other` | 未找到（出错） |
| `crImport.preview.hint.unchecked` | 未勾选的行不会写入。 |
| `crImport.preview.hint.none` | 请至少勾选一部番剧。 |
| `crImport.preview.hint.locked` | 导入结束前，复选框和按钮均已锁定。 |
| `crImport.preview.hint.stopped` | 尚未写入的番剧保持勾选。 |
| `crImport.preview.hint.failed` | 失败的番剧保持勾选。 |
| `crImport.review.proposed` | 推荐 |
| `crImport.review.alternatives` | 其他可选：{titles} |
| `import.included` | 包含 |
| `import.neverIncluded` | 绝不包含 |
| `import.includes.settings` | 设置 |
| `import.includes.matches` | 匹配记录和已排除的番剧 |
| `import.includes.history` | 记录：最近同步、待确认的剧集、待评分的番剧、已拒绝的重看询问 |
| `import.includes.signIns` | 你的 AniList / MyAnimeList 登录信息 |
| `import.fileContents` | 文件内容 |
| `import.exportedAt` | 导出于 {date}（v{version}） |
