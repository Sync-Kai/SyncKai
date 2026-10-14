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
