# Japanese (`ja`) term sheet

Binding for every change to `src/i18n/locales/ja.json` and `public/_locales/ja/messages.json`. Shared rules: [`../GLOSSARY.md`](../GLOSSARY.md).

## 1. Conventions

| Topic | Rule |
|---|---|
| Register | です・ます for every full sentence (messages, help texts, errors, hints). Requests: 〜してください; "Try again" → もう一度お試しください |
| Addressing the user | Never あなた: the subject is omitted ("your list" → リスト, "your progress" → 視聴状況/進捗) |
| Buttons, menu items, tabs | Short nouns or verb phrases, no です/ます: 保存, 閉じる, 再試行, 削除, 同期から除外, 連携する |
| Fragments | Chips, badges, `{service}：…` details, reason lines, summaries: 体言止め (第5話を記録, すでに最新, 放送通知：オフ) or a polite statement (対応する作品ページがありません), never plain だ/である; no 。 unless the English ends with a period |
| Reason lines (`match.*`, `sync.correctionPending`, `crImport.reason.*`) | Never a request (〜してください): the toast appends `。SyncKaiのアイコンをクリックして作品ページを選んでください。` after `{reason}`. Use 〜が必要 (シーズンの確認が必要, 作品ページの選択が必要) |
| Help paragraphs and option descriptions | When the English has sentences with periods, every Japanese sentence is polite (画面の隅に3秒間、小さく表示します。); no noun-phrase sentence followed by polite ones |
| Quotation marks | 「」 around UI labels, page names and titles inside a sentence (「設定 › 除外した作品」, 「{title}」を評価); 『』 only if nested. No quotes when the title is followed by `：` |
| Colon | Full-width `：`, no space after: `{service}：{message}` → AniList：第5話を記録; `{title}: completed` → `{title}：視聴完了`; `{label}: {value}` → `{label}：{value}` |
| Other punctuation | Full-width 。、！？（）／; ` › ` and ` · ` kept exactly as in English; ellipsis = single `…`; `→`, `↔`, `≈`, `✓`, `−1` kept |
| Spacing | No space between Japanese and Latin words or digits (AniListと連携, 第5話, 5MB). A half-width space only between a label and its count (要確認 3件) and where English has a separator; never a space before a particle (評価8.5/10を保存しました, not 評価 8.5/10 を…). A count followed by a verb belongs to its noun: {count}作品の進捗を変更 (not 進捗 {count}件を変更) |
| Decorative kana labels | Some headings sit next to a decorative katakana label that is not translated (ヨウコソ, ヒント, ツヅキ, カクニン, ヒョウカ, クラベ, マチ, ページ, セッテイ). Never translate the heading into the same word: `onboarding.welcome` → SyncKaiへようこそ！ (under ヨウコソ), `watching.tipTitle` → 豆知識 (after ヒント) |
| Plurals | Japanese has no plural forms: only the `_other` variants exist |
| Episode numbers | 第N話 = one specific episode ("Ep. 5", "episode 5") → 第5話. N話 / 全N話 = a count: progress "5 / 12話", total "全12話", "−1話". A progress value that can be 0 is a count, never 第0話: `inline.backTo` → 進捗を{progress}話に戻しました |
| Naming another tab or page in a sentence | ポップアップの「アクティビティ」タブで…, サイドパネルの「スケジュール」で…, 設定でAniListと連携… (never a calque in parentheses such as ポップアップ（アクティビティ） or …してください（設定）) |
| Open in a tab | 新しいタブで開く (タブで開く alone is a calque of "in a tab") |
| Counters | 件 (items, cards, errors, differences, Netflix history rows), 作品 (series), シーズン (seasons), タイトル (Netflix titles), 話 (episode counts) |
| Units | min → 分, h → 時間, d → 日, s → 秒 (already short, no abbreviation), 85% (no space), 5MB |
| Relative times | たった今 / N分前 / N時間前 / 昨日 / N日前, always after a label and a colon (最終確認：5分前, 視聴完了：昨日, 最終分析：たった今): a particle (に) cannot follow every value |
| Retry delays | まもなく / N分後 / N時間後 / N日後 (次回の再試行：5分後) |
| Countdowns | 第5話まであと18時間; {time}後に同期 (2分10秒後に同期) |
| Mid-sentence lowercasing | No effect on Japanese; fragments never start with a Latin product name |
| `{service}: {message}` | `{service}：{message}` (AniList：第5話を記録 · MyAnimeList：失敗：…) |
| `{title}: completed` | `{title}：視聴完了` (also `{title}：視聴中止`, `{title}：一時中断`, `{title}：リストから削除しました`) |
| Settings paths in sentences | 設定 › 再生と同期, 設定 › 除外した作品, 設定 › ヘルプ › 診断レポートをコピー (exactly the labels of `nav.settings`, `settings.cat.sync`, `settings.section.exclusions`, `settings.section.help`, `settings.help.copy`) |

## 2. Core terms (GLOSSARY.md › 3)

| English | Japanese | Reason |
|---|---|---|
| series | 作品 (counter: N作品) | The word Japanese trackers (Annict…) and fans use for an anime title; シリーズ means a whole franchise. "Series" row of the history import (no season) → 作品全体 |
| season | シーズン | As on Japanese streaming sites (シーズン2); 期 is colloquial. "part" → パート |
| arc | 〜編 | Arc names come from the platforms and are not translated |
| episode | エピソード (generic noun), 第N話 (numbered), N話 / 全N話 (count) | Ep. → 第N話; next episode in a badge → 次話 |
| Ep. (short form before a number) | 第N話 | Already shorter than "Ep. N" |
| list | リスト | "your list" → リスト; "not in your list" → リストにありません |
| entry | 作品ページ | The anime's page on AniList/MyAnimeList: AniList作品ページ, 作品ページを開く. エントリー is not natural Japanese here. "List entry" (the user's item) → リストの作品 |
| Watching | 視聴中 | Wording of MyAnimeList's Japanese UI and of Japanese trackers; also the popup tab |
| Completed | 視聴完了 | The user finished; never 放送終了 (finished airing) |
| On hold | 一時中断 | Annict / MyAnimeList Japanese wording. A paused video is 一時停止中 (different) |
| Dropped | 視聴中止 | Annict / MyAnimeList Japanese wording; never 中止 alone (would read as "Cancel") |
| Plan to watch | 視聴予定 | MyAnimeList Japanese wording |
| Rewatching | 再視聴中 | rewatch = 再視聴 |
| Watching (tab `nav.watching`) | 視聴中 | Same word as the status |
| Activity (tab `nav.activity`) | アクティビティ | |
| sync (noun / verb) | 同期 / 同期する | Syncing… → 同期中…; synced → 同期済み; auto sync → 自動同期 |
| to check | 要確認; a check card (review) → 確認カード | 要確認 is the usual "needs confirmation" label. Not a critique |
| to rate | 評価待ち; rate → 評価する | 評価待ち（2）, 評価待ち 3作品 |
| score, rating, stars | 評価 | AniList's community average is a different concept: AniList平均スコア |
| comment (`notes.*`) | メモ | A private note on a list entry; コメント suggests a public comment |
| match, mapping | 紐付け; forget → 解除 | Remembered season → AniList entry link. "Uncertain match" → 対応が不確か; "matching" (identifying the anime) → 照合 |
| match (AniList ↔ MAL alignment) | 〜に合わせる (button), 反映 (running job) | すべてAniListに合わせる, 反映中…, 反映が完了しました; Keep AniList → AniListを採用 |
| excluded series | 除外した作品; chip 除外中 | Stop syncing → 同期から除外; Resume syncing / Re-enable → 同期を再開. 除外 is never used for anything else |
| pending sync, queue | 保留中の同期; Abandon → 破棄 | Failed sync → 同期失敗 |
| credits | エンディング | The anime ED; "at the start of the credits" → エンディング開始時, also in the settings home summary (エンディング開始時, parallel to 85%視聴時) and the live marker (エンディング開始時に同期) |
| popup | ポップアップ | |
| side panel | サイドパネル | Chrome's Japanese name; also used for the Firefox sidebar in our UI |
| Now playing (panel tab) | 再生中 | |
| Schedule (`panel.tab.agenda`) | スケジュール | Reused in 通知とスケジュール and in the Schedule section |
| On this page | このページの作品 | |
| preferred player | 優先配信サービス | "player" = streaming service, not a media player app |
| history import (`crImport.*`) | 視聴履歴のインポート (title and button: 視聴履歴をインポート) | |
| backup (`backup.*`, `import.*`) | バックアップ | Its "history" is SyncKai's sync history → 同期履歴, never 視聴履歴 |
| preview | プレビュー | |
| rewatch | 再視聴 | |
| account | アカウント | |
| connect / connected / not connected | 連携する / 連携済み / 未連携 | Japanese apps say アカウント連携 for OAuth linking; Connecting… → 連携中…; Reconnect → 再連携 (footer button); Reconnect {service} → {service}と再連携する (same button as {service}と連携する, same verb form) |
| sign in / sign out | ログイン / ログアウト | The sign-in window and sessions |
| disconnect | 連携解除 | |
| session expired | セッション切れ | |
| release alerts | 放送通知 | The in-page "Alerts only" level uses 警告 (警告のみ): a different word |
| release, airing | 放送 (TV broadcast in Japan), 配信 (release on a streaming platform) | Airing statuses: 放送中, 放送終了, 放送前, 休止中, 放送中止 |
| offset, delay | 遅延 (配信遅延 for one series, 通知の遅延 for alerts) | Episode offset of a match → 補正値 |
| shortcut | ショートカット (キーボードショートカット) | Change → 変更; Set → 割り当て |
| Settings (`nav.settings`) | 設定 | |
| Settings categories | 再生と同期 · 通知とスケジュール · ショートカット · マイデータ · ヘルプと情報 · アカウント · 言語 | |
| Settings sections | 同期 · 再生 · サイドパネル · ページ内通知 · 新エピソード · スケジュール · 紐付け · 除外した作品 · インポート · バックアップ · ヘルプ · アプリ情報 · 危険な操作 | |

## 3. Other recurring words

| English | Japanese |
|---|---|
| platform (streaming) | 配信サービス |
| service (AniList / MyAnimeList) | サービス (reserved for AniList / MyAnimeList and streaming 配信サービス; the extension's own background process is 拡張機能: 拡張機能が応答しません) |
| Open / Close / Save / Cancel / Confirm | 開く / 閉じる / 保存 / キャンセル / 確定 |
| Retry / Try again | 再試行 / もう一度お試しください |
| Ignore (a card) | スキップ |
| Remove (from the list) | 削除 |
| Correct (fix a sync) | 修正 |
| Recommended | おすすめ |
| up to date / already saved | 最新の状態, すでに最新 / 記録済み |
| episode saved (written to the list) | 第N話を記録 |
| track (follow viewing) | 記録する |
| Analysis / Import / Export | 分析 / インポート / エクスポート |
| diagnostic report / error log | 診断レポート / エラーログ |
| Special / Movie / TV short | 特別編 / 劇場版 / TVショート (TV, ONA, OVA kept) |
| Parent story / Prequel / Sequel / Side story / Spin-off | 本編 / 前作 / 続編 / 外伝 / スピンオフ |
| Fall / Spring / Summer / Winter (airing season) | 秋 / 春 / 夏 / 冬, with the year first: `{year}年秋` (2024年秋) |
| absolute numbering | 通し番号 |
| Only (AniList) entry with this title | このタイトルのAniList作品ページは1件のみ (not 〜を持つ唯一の…, a calque) |
| N series remembered (Matches card header) | N作品を紐付け済み |
| Next episode soon (badge) | 次話は近日放送 (近日 alone is an incomplete set phrase) |
| Series title fallback (`sync.seriesFallback`) | この作品 (inserted as {title}: この作品：一時中断) |
| Netflix "Viewing activity" page | 「視聴履歴」 (Netflix's own Japanese name) |
| Firefox "Manage Extension Shortcuts" | 拡張機能のショートカットキーの管理 (Firefox's own Japanese label, `aboutAddons.ftl`) |
| Show or hide the side panel (Firefox) | サイドパネルの表示を切り替え (same verb as Firefox's サイドバーの表示を切り替え) |

## 4. Netflix

「その他を表示」 (Netflix Japanese help center, help.netflix.com/ja/node/101917: 「履歴がすべて表示されていない場合は、[その他を表示]ボタンを押します。」, the English page says "use the Show More button"; the page itself is 「視聴履歴」)
