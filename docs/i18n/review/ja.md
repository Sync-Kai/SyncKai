# Japanese (`ja`) review log

Independent native-level review of `src/i18n/locales/ja.json` (878 keys: the 934 English keys with the `_other` form only) and `public/_locales/ja/messages.json`, 2026-10-14. Reference: `en.json`, with `fr.json` / `de.json` and the context note of every key (`docs/i18n/context.json`). Term sheet: `docs/i18n/glossary/ja.md` (updated, see below).

## Method

1. **Terminology audit**: every term-sheet decision checked against the shared glossary and the vocabulary of Japanese anime fans and trackers (Annict: 一時中断 / 視聴中止), Japanese Chrome (サイドパネル, 拡張機能), Firefox (`addon-manage-extensions-shortcuts` = 拡張機能のショートカットキーの管理, verified in mozilla-l10n) and Netflix Japan (「視聴履歴」, 「その他を表示」, verified on help.netflix.com/ja/node/101917). Then a concordance of every core concept over the whole catalog: series, season, episode, list, entry, sync, to check, to rate, score, comment, match, excluded, pending sync, credits, popup, side panel, Now playing, Schedule, On this page, preferred player, history import, backup, preview, rewatch, account / connect / session expired, release alerts, Settings and its categories, the six list statuses, Activity, Watching.
2. **Key-by-key review** of all 878 keys with their context notes (two full passes): meaning (back-translation against en / fr), grammar, register (です・ます sentences, short labels), naturalness, placeholders with realistic values, composed texts read in the code that assembles them (`shared/sync-feedback.ts`, `ui/feedback.ts`, `sidepanel/components/agenda.ts`, `content/ui/sync-toast.ts`, `content/lib/watch-session.ts`, `popup/components/onboarding.ts`, `popup/components/watching-screen.ts`, `ui/settings/page-data.ts`, `background/controls.ts`), cross-references (Settings › … paths, quoted tab and button names), length (CJK counted ≈ 2 Latin widths against the limits of the notes).
3. **Automated checks** (scratch scripts): half-width `( ) : ! ? ,` and `...` (none, except the URL `about:addons`), spaces between Japanese and Latin text or digits (only label / count separators and the English-format offset `+1 h` remain), final punctuation versus English, placeholder sets (identical to English in every key), あなた (none), だ / である (one, fixed), orthographic variants (すべて, すでに, または, ください: consistent; no full-width digits or Latin letters).
4. `npm run i18n:check -- ja`: 0 errors before and after; the 2 remaining warnings are justified below.

## Terminology audit

The term sheet is sound and was kept: 作品 (series), シーズン, 第N話 / N話 / 全N話, リスト, 作品ページ (entry), 視聴中 / 視聴完了 / 一時中断 / 視聴中止 / 視聴予定 / 再視聴中, 同期, 要確認 / 確認カード, 評価待ち, 評価, メモ (comment), 紐付け vs 〜に合わせる / 反映 (AniList ↔ MAL), 除外した作品 / 除外中, 保留中の同期, エンディング, ポップアップ, サイドパネル, 再生中, スケジュール, このページの作品, 優先配信サービス, 視聴履歴のインポート vs バックアップ (同期履歴), プレビュー, 再視聴, アカウント / 連携 / セッション切れ, 放送通知 vs 警告, 放送 vs 配信, 設定 and its categories, アクティビティ. Every concept uses one word across the catalog, and every quoted element matches its own key: 設定 › 再生と同期, 設定 › 除外した作品, 設定 › ヘルプ › 診断レポートをコピー, 「時刻を調整」, 「開く」, 「再生中」, 「視聴中」, 「視聴完了」, 「評価は？」, 「変更」 / 「割り当て」, 「要確認」, 「アクティビティ」, 「バックアップ」. The browser shortcut names in `messages.json` equal `settings.shortcuts.episode` / `settings.shortcuts.panel`.

Decisions added to the term sheet:

- **Reason lines** never end with a request (〜してください): the toast appends 「。SyncKaiのアイコンをクリックして作品ページを選んでください。」 after `{reason}`, so `match.specialSeason` asked the same thing twice. Use 〜が必要 (シーズンの確認が必要).
- **Progress that can be 0 is a count**: −1 from episode 1 showed 「第0話に戻しました」. Now 進捗を{progress}話に戻しました.
- **Naming a tab in a sentence**: ポップアップの「アクティビティ」タブで (not the calque ポップアップ（アクティビティ）), 設定で…連携してください (not …してください（設定）); open in a tab = 新しいタブで開く.
- **サービス is reserved** for AniList / MyAnimeList (and 配信サービス): the extension's own background is 拡張機能.
- **Credits** wording identical in the setting, its home summary and the live marker: エンディング開始時.
- **Spacing**: never a space before a particle (評価8.5/10を保存しました); a count followed by a verb belongs to its noun ({count}作品の進捗を変更).
- **Decorative kana labels** (ヨウコソ, ヒント…) sit next to some headings: the heading must not repeat them (explains SyncKaiへようこそ！ and 豆知識, kept).
- Netflix history rows counted with 件; reconnect button 「{service}と再連携する」 (same verb form as 「{service}と連携する」 on the same button); Matches card header N作品を紐付け済み; title fallback この作品.

## Changes

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `compare.impact.progress_other` | 進捗 {count}件を変更 | {count}作品の進捗を変更 | grammar | “label + count + を変更” is broken; the count is the number of series whose progress changes |
| `compare.impact.score_other` | 評価 {count}件を変更 | {count}作品の評価を変更 | grammar | same |
| `compare.impact.status_other` | ステータス {count}件を変更 | {count}作品のステータスを変更 | grammar | same |
| `crImport.read.progressAria` | 履歴の読み取りの進捗 | 履歴読み取りの進捗 | style | double の |
| `crImport.netflix.keepTab` | Netflixのタブは「視聴履歴」ページを開いたままにしてください。… | Netflixのタブで「視聴履歴」ページを開いたままにしてください。… | grammar | は made the tab the thing to keep open “on” the page; the page stays open in the tab (で) |
| `inline.ratingSaved` | 評価 {stars}/10 を保存しました · {title} | 評価{stars}/10を保存しました · {title} | typography | spaces around a number and before a particle |
| `prompt.rating.saved` | 評価 {score} を保存しました | 評価{score}を保存しました | typography | same |
| `match.specialSeason` | 特別編 / OVA：作品ページを選んでください | 特別編 / OVA：作品ページの選択が必要 | style | in the toast “{reason}。SyncKaiのアイコンをクリックして作品ページを選んでください。” the request appeared twice; reasons are fragments like シーズンの確認が必要 |
| `match.singleLaterSeason` | シーズン{season}だが、AniList作品ページは1件のみ | シーズン{season}ですが、AniList作品ページは1件しか見つかりません | grammar | だが is plain written style, the only one in a polite UI |
| `match.titleOnlyAbsolute` | このタイトルを持つ唯一のAniList作品ページ（通し番号） | このタイトルのAniList作品ページは1件のみ（通し番号） | style | 〜を持つ唯一の is a calque of “only … with” |
| `match.titleOnlyTrusted` | このタイトルを持つ唯一のAniList作品ページ（シーズン1） | このタイトルのAniList作品ページは1件のみ（シーズン1） | style | same |
| `match.specialTitle` | このタイトルを持つ唯一の特別編の作品ページ（OVA、劇場版） | このタイトルの特別編（OVA、劇場版）の作品ページは1件のみ | style | same |
| `match.dedicatedSeries` | 作品名を持つ唯一のAniList作品ページ | 作品名が一致するAniList作品ページは1件のみ | style | same; 作品名を持つ says nothing |
| `onboarding.step3` | エンディングにはリストが最新に | エンディングまでにリストを更新 | grammar | dangling に; parallel to step 2 「SyncKaiが作品を認識」 |
| `page.platformOff` | …オンに戻すには：設定 › 再生と同期。 | …オンに戻すには「設定 › 再生と同期」を開いてください。 | style | 「〜には：path。」 is not a sentence; path quoted (term sheet) |
| `settings.shortcut.manualFirefox` | 変更するには：about:addons › 歯車アイコン › 拡張機能のショートカットキーの管理。 | 変更するには、about:addons › 歯車アイコン › 「拡張機能のショートカットキーの管理」を開いてください。 | style | same; Firefox's own label quoted |
| `panel.nowPlaying.notFoundHint` | …SyncKaiがポップアップ（「要確認」）でお尋ねします。 | …SyncKaiがポップアップの「要確認」で選択を求めます。 | style | humble お尋ねします breaks the register; quoted name inside parentheses is a calque |
| `review.noCandidates` | 候補の作品ページがありません。検索を使ってください。 | 候補の作品ページがありません。下の検索欄から探してください。 | style | 検索を使って is a calque of “use the search”; the field is below (note) |
| `settings.mappings.count_other` | {count}作品を記憶中 | {count}作品を紐付け済み | terminology | 記憶中 = “being memorized”; the card is about matches (紐付け) |
| `settings.mappings.resetConfirm` | すべての紐付けを解除しますか？ | 紐付けをすべて解除しますか？ | length | 15 CJK ≈ 30 widths for a ≤ 28 limit |
| `settings.airing.unavailable` | サービスを利用できません。もう一度お試しください | 拡張機能が応答しません。もう一度お試しください | meaning | サービス means AniList / MyAnimeList in this UI; what failed is the extension's background (note), as in popup.swTimeout |
| `common.reconnectService` | {service}と再連携 | {service}と再連携する | consistency | same welcome-screen button as 「{service}と連携する」 |
| `watching.badge.soon` | 次話は近日 | 次話は近日放送 | grammar | 近日 alone is an incomplete set phrase (近日放送 / 近日公開) |
| `watching.nextWatched` | 次のエピソードを視聴済みに | 次のエピソードを視聴済みにする | grammar | dangling に; same wording as watching.plusOneAria |
| `settings.notif.discreet.desc` | 画面の隅に小さな表示を3秒間。全画面表示中は… | 画面の隅に3秒間、小さく表示します。全画面表示中は… | style | noun-phrase “sentence” followed by a polite one; sibling cards are polite |
| `settings.notif.alertsOnly.desc` | 対応が必要なときだけ：要確認、エラー、再連携。 | 対応が必要なときだけ表示します（要確認、エラー、再連携）。 | consistency | same polite style as the two sibling level cards |
| `settings.help.reportTitle` | GitHubで入力済みの報告（Issue）を開きます | GitHubのIssue作成画面を入力済みの状態で開きます | style | 入力済みの報告 is unidiomatic; Issue is GitHub's own Japanese UI term |
| `settings.offsets.help` | 日本での放送から何分後か。スケジュール（サイドパネル）で使われます。… | 日本での放送から何分後に配信されるかを指定します。サイドパネルの「スケジュール」で使われます。… | style | noun clause + 。 followed by polite sentences; the tab is named as a tab |
| `agenda.adjust.help` | 日本での放送から何分後か（{min}〜{max}）。 | 日本での放送から何分後に配信されるかを指定します（{min}〜{max}）。 | consistency | same wording as settings.offsets.help; a noun clause ending in 。 |
| `crImport.read.error.network` | {platform}に接続できません。接続を確認して、… | {platform}に接続できません。ネットワーク接続を確認して、… | consistency | same advice as api.network; a bare 接続 right after 「{platform}に接続できません」 was ambiguous |
| `crImport.connect.openFailed` | …タブで{site}を開いてください。 | …新しいタブで{site}を開いてください。 | style | タブで is a calque of “in a tab” |
| `crImport.read.error.unavailable` | インポートできません：{platform}のサイトが変更されました。… | {platform}のサイトが変更されたため、インポートできません。… | style | polite sentence + colon + sentence; cause and effect read naturally in one sentence |
| `crImport.netflix.rule` | …ボタンで履歴を読み込み（ほかには何もクリックしません）、… | …ボタンだけを押して履歴を読み込み、… | style | a polite sentence in parentheses inside another sentence; だけを押して already says nothing else is clicked |
| `crImport.netflix.rows` | Netflixの視聴履歴を読み込み中：{rows}行… | Netflixの視聴履歴を読み込み中：{rows}件… | style | history entries are counted with 件; 行 = text lines |
| `crImport.review.help` | …ポップアップ（アクティビティ）で作品ページを選んでください。 | …ポップアップの「アクティビティ」タブで作品ページを選んでください。 | cross-reference | parenthesised tab name is a calque of “(Activity)”; tab quoted |
| `crImport.review.created_other` | …ポップアップ（アクティビティ）で作品ページを選んでください。 | …ポップアップの「アクティビティ」タブで作品ページを選んでください。 | cross-reference | same |
| `crImport.error.notConnected` | 視聴履歴をインポートするには、AniListかMyAnimeListと連携してください（設定）。 | 視聴履歴をインポートするには、設定でAniListかMyAnimeListと連携してください。 | style | trailing （設定） is a calque of “(Settings)” |
| `panel.live.pointCredits` | エンディングで同期 | エンディング開始時に同期 | consistency | same wording as the setting it reflects (settings.trigger.credits) |
| `settings.summary.credits` | エンディング時 | エンディング開始時 | consistency | same |
| `settings.summary.percentage` | {percent}時点 | {percent}視聴時 | consistency | parallel to エンディング開始時 in the same summary slot; says what reaches 85 % |
| `settings.backup.exportTabTitle` | 「バックアップ」ページをタブで開き、… | 「バックアップ」ページを新しいタブで開き、… | style | タブで開く is a calque |
| `settings.backup.importTitle` | 「バックアップ」ページをタブで開きます | 「バックアップ」ページを新しいタブで開きます | style | same |
| `settings.netflix.helpOff` | …。ブラウザがnetflix.comへのアクセス許可を求めます | …。オンにすると、ブラウザがnetflix.comへのアクセス許可を求めます | meaning | the present tense read as “the browser is asking now”; the prompt appears when the toggle is turned on (EN “will ask”) |
| `settings.disney.helpOff` | …。ブラウザがdisneyplus.comへのアクセス許可を求めます | …。オンにすると、ブラウザがdisneyplus.comへのアクセス許可を求めます | meaning | same |
| `sync.noServiceFollows` | 連携中のどのサービスでも、この作品を記録できません。 | 連携中のどのサービスにも、この作品に対応する作品ページがありません。 | meaning | the error means no connected service has an entry for the anime (note); same wording as sync.noEquivalent |
| `watching.empty.text` | …再生すると、次のエピソードの日付と一緒にここに表示されます。 | …再生すると、その作品が次のエピソードの日付と一緒にここに表示されます。 | meaning | without a subject the episode seemed to be what shows up; “it” is the series |
| `watching.empty.textPlatforms` | …再生すると、次のエピソードの日付と一緒にここに表示されます。 | …再生すると、その作品が次のエピソードの日付と一緒にここに表示されます。 | meaning | same |
| `import.replace.detail` | このデータを消去して置き換えます | 現在のデータを消去して、ファイルの内容に置き換えます | meaning | このデータ was vague and 置き換えます repeated the option title without saying by what |
| `popup.ignoreFailed` | スキップできませんでした。もう一度お試しください。 | 評価をスキップできませんでした。もう一度お試しください。 | meaning | what failed is skipping the rating (To rate card), not the series |
| `inline.backTo` | 第{progress}話に戻しました | 進捗を{progress}話に戻しました | meaning | progress is a count and can be 0 (−1 from episode 1): 第0話 is not an episode |
| `sync.seriesFallback` | 作品 | この作品 | style | inserted as {title} when the title is unknown: 「作品：一時中断」 → 「この作品：一時中断」 |

**51 changes**: style 21, meaning 9, grammar 8, consistency 7, typography 2, cross-reference 2, terminology 1, length 1. No placeholder error was found (every key has exactly the English placeholder set, checked automatically before and after). `public/_locales/ja/messages.json` needed no change: `extDescription` is natural and 52 characters long (≤ 132), and the two shortcut names are identical to the Settings rows.

## Debatable, left unchanged

| Key | Current text | Why it was kept |
|---|---|---|
| `onboarding.welcome` | SyncKaiへようこそ！ | i18n:check warning (13 vs 8). The decorative label ヨウコソ sits right above this heading, so a bare ようこそ！ would repeat it; 20 px heading in a 400 px popup, no overflow. |
| `watching.status.DROPPED` | 視聴中止にする | i18n:check warning (7 vs 4). Menu item and tooltip, not a fixed-width button; parallel to 視聴完了にする / 一時中断にする. The compact button is page.action.DROPPED (視聴中止). |
| `watching.tipTitle` | 豆知識 | Literally “trivia”. ヒント would duplicate the decorative label ヒント shown just before it; ワンポイント is the alternative. |
| `agenda.today` | 今週 | The button jumps back to the week containing today: 今週 is precise next to the week range; Google Calendar's Japanese button says 今日. The day badge (agenda.day.today) is 今日. |
| `feedback.queuedSuffix` | ` · まもなく自動で再試行します` | Deliberate departure from the English “. ”: the preceding error already ends with 。, and the suffix may follow either service. |
| `backup.fileName` | synckai-バックアップ-{date}.json | Japanese file names work everywhere, but an ASCII name is safer to share; kept because the note asks to translate the word. |
| `popup.excludeFailed`, `popup.includeFailed` | 除外に失敗。もう一度お試しください / 再開に失敗。… | ≈ 34 widths for a ~25-char truncated chip; FR (30) and DE (47) are as long; shortening would drop “try again”. |
| `settings.backup.exported` | エクスポート完了 | ≈ 16 widths for ≤ 14; transient green status shown 2 s next to the button. |
| `content.shortcut.alreadySynced` | このエピソードは同期済みです | ≈ 28 widths for ≈ 25, but the pill is never truncated. |
| `settings.section.about` | アプリ情報 | It is an extension: バージョン情報 or SyncKaiについて would be more exact; term-sheet decision. |
| `panel.nowPlaying.discussion` | ディスカッション | Katakana-heavy; 感想・話題 is the fan alternative (the Reddit chip already says エピソードの感想). |
| `import.summary.rewatchDeclined_other` | 見送った再視聴 | What was declined is the in-page question; 断った再視聴の確認 is clearer but long for a table row. |
| `prompt.rating.question` | 評価は？ | Terse but friendly under 「{title}」視聴完了！; quoted identically in settings.ratingPrompt.help. |
| `settings.percentage.fallbackLabel` | 予備の視聴割合 | “Fallback”: 代替の視聴割合 is equally possible. |
| `agenda.error`, `auth.failed`, `*.stopped` | 〜できません：{error} / 〜が中断されました：{message} | Polite statement + colon + error sentence; standard in Japanese software messages. |
| Reason fragments (`sync.*`, `controls.*`, `engagement.*`) | すでに最終話です, 対応する作品ページがありません… | Polite statements next to 体言止め results (第5話を記録) in the same `{service}：…` line; natural in Japanese UIs, documented in the term sheet. |
| `panel.live.minutesSeconds` | {min}分{sec}秒 | The code pads seconds (2分05秒), unusual in running text but common on timers. |

## Residual doubts for a native human reviewer

- Status vocabulary: 視聴中 / 視聴完了 / 一時中断 / 視聴中止 / 視聴予定 / 再視聴中 is clear and consistent; Annict users may expect 見てる / 見た / 見たい. The term sheet's claim that these are “MyAnimeList's Japanese wording” could not be verified (no Japanese MAL interface found).
- `crImport.netflix.rule`, `crImport.netflix.keepTab`, `crImport.read.error.netflixLoggedOut`: 「視聴履歴」 and 「その他を表示」 come from Netflix's Japanese help center, not from a live Japanese profile page.
- Fit in the UI, to check on screen: the 3 status buttons (一時中断 · 視聴中止 · 視聴完了), the two bulk buttons side by side (すべてAniListに合わせる / すべてMALに合わせる), the footer (保留中の同期 2件 next to the avatars), the 3-option tab control (前回のタブ · 再生中 · スケジュール), the onboarding step columns (≈ 110 px).
- Schedule = スケジュール (放送予定 would be more idiomatic for an anime calendar, but would ripple through 通知とスケジュール and the Settings section).
- The debatable strings above, in priority: 豆知識, 今週, アプリ情報, ディスカッション.

## Code-side notes (not fixable in the catalog)

- `{services}` (`ui/feedback.ts`, `ui/media-actions.ts`) and `{titles}` of `airing.notification.group_other` are joined with `", "`: Japanese would use 、.
- `panel.offTargetPlatforms` + `panel.offTargetEnable`, and `panel.nowPlaying.detailsError` + the error sentence, are joined with a half-width space after 。.
- `formatOffset` (`shared/agenda.ts`) is not localized: `agenda.estimate.*` show 日本での放送 +1 h 30.
- `panel.nowPlaying.season.*`: the code appends ` {year}` (秋 2024); Japanese order is 2024年秋.
- The aria-label of the agenda estimate appends `". "` after `agenda.estimate` (`sidepanel/components/agenda.ts`).

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | 冬 / 春 / 夏 / 秋 | {year}年冬 / {year}年春 / {year}年夏 / {year}年秋 | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |

Code fixes that change how this catalog is displayed:

- `{services}` and `{titles}` are joined with `Intl.ListFormat` (`formatList` in `src/i18n/core.ts`): AniList、MyAnimeList.
- `panel.offTargetPlatforms` + `panel.offTargetEnable`, `panel.nowPlaying.detailsError` + the error sentence, and the host-access banner are joined by `joinSentences`: no space after 。 in Japanese and Chinese.
- `formatOffset` is localized: 日本での放送 +1時間30分.
- `panel.nowPlaying.season.*` take a `{year}` placeholder: 2024年秋.
- The aria-label of the Schedule estimate joins its two sentences with 。 instead of “. ”.
- Netflix history import: the “その他を表示” button of a Netflix profile in this language is recognized (label checked by the reviewer on Netflix’s help article 101917 in this language): such an import no longer stops after the first rows as if the history were complete.

Layout (`npm run test:i18n-layout`): no finding in this language.

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). No plural forms in this language: one `_other` variant with the same text, `{total}` renamed `{count}`.

| Key | Text |
|---|---|
| `sync.beyondEntry_other` | 第{progress}話が、作品ページの全{count}話を超えています |

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | Netflixのプロフィールの言語では「その他を表示」ボタンを認識できなかったため、最近のエピソードのみ読み取りました。Netflixでそのプロフィールの言語をSyncKaiと同じにしてから、もう一度読み取ってください。 |

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video（アニメのみ） |
| `settings.prime.label` | Prime Videoで同期 |
| `settings.prime.helpOff` | アニメのみ同期します（アニメジャンル、または日本語音声があるかAniListとタイトルが完全一致するアニメーション）。オンにすると、ブラウザがprimevideo.comへのアクセス許可を求めます |
| `settings.prime.helpOn` | SyncKaiが読み取るのは、Prime Videoのページがすでに受信している情報だけです。すでに開いているPrime Videoのタブでは、次のエピソードから記録を開始します |
| `settings.prime.denied` | primevideo.comへのアクセスが拒否されたため、Prime Videoはオフのままです |
| `settings.prime.disabled` | Prime Videoをオフにしました。完全に停止するには、開いているPrime Videoのタブを再読み込みしてください |
| `settings.prime.error` | Prime Videoへのアクセスを変更できませんでした。もう一度お試しください |

| Key | Text |
|---|---|
| `onboarding.intro` | CrunchyrollやADN（Netflix、Disney+、Prime Videoはオプション）でアニメを見るだけで、各エピソードの終わりにSyncKaiがリストを更新します。 |
| `watching.tip` | Netflix、Disney+、Prime Video（オプション）と優先配信サービスは{path}で設定できます。 |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | 配信サービスの情報と一致：{signals} |
| `match.signalsContradict` | 配信サービスの情報と不一致：{signals} |
| `match.yearRemake` | リメイク版を放送開始年（{year}年）で判別 |
| `match.signal.year` | 放送開始年 |
| `match.signal.episodes` | 話数 |
| `match.signal.duration` | 1話の長さ |
| `match.signal.format` | 形式（劇場版またはTVアニメ） |
| `match.signal.country` | 制作国 |
| `match.signal.originalTitle` | 原題 |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | 保存した紐付けが配信サービスの情報と不一致：{signals} |
