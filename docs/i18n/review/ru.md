# Russian (`ru`) review log

Independent native review of `src/i18n/locales/ru.json` (934 English keys, 1046 Russian entries with the `_one` / `_few` / `_many` / `_other` plural variants) and `public/_locales/ru/messages.json`, 2026-10-14. Inputs: `docs/i18n/GLOSSARY.md`, `docs/i18n/glossary/ru.md`, `docs/i18n/context.json`, `en.json`, `fr.json`, `de.json`.

Method: terminology audit (concordance of every core term across the catalog: аниме, сезон, эпизод / эп., список, карточка, синхронизация, проверка / Проверить, оценка / Оценить, комментарий, сопоставление, выравнивание / сравнение, исключённое аниме, синхронизация в очереди, титры, окно расширения, боковая панель, Сейчас идёт, Расписание, На этой странице, предпочитаемый плеер, импорт истории просмотров, резервная копия, предпросмотр, пересмотр, аккаунт / подключить / войти / сессия истекла, оповещения о выходе vs уведомления на странице, Настройки and its categories, the six Shikimori statuses, Активность, Смотрю); key-by-key reading of all 878 key groups with their context notes (meaning against en/fr/de, grammar, register, placeholders with realistic values, composed texts, cross-references, lengths); a second, Russian-only read of the whole catalog for naturalness; plurals rendered with `Intl.PluralRules('ru')` for 0, 1, 2, 3, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111, 112 and 1.5 over all 56 plural keys; gender-neutrality scan (no second-person past tense, no *вы*); typography scans (only «ёлочки», no straight or English quotes, `…`, spaced em dashes, `85 %` as in fr.json; ё everywhere except the deliberate Netflix label «Показать еще»); EN ↔ RU comparison of symbols and final punctuation (→ ↑ ✓ · — ≈ … › ?). Compositions and layouts checked in the code where the note left a doubt: `src/shared/airing.types.ts` › `formatAiringStatus` (the `Последняя проверка: … · {fragment}` line), `src/background/controls.ts` and `engagement.ts` (`sync.noServiceFollows` fires when `resolveTargets` finds no service with an ID for the anime), `src/popup/components/footer.ts` (reconnect button `shrink-0`, status labels `truncate`), `watching-screen.ts` (Continue card header), `onboarding.ts` (hint line in a fixed 56 px button), `review-card.ts` (`common.actionFailed` is an alert title). External names verified: Netflix RU «История просмотра» and «Показать еще» (help.netflix.com/ru/node/101917, article «Как увидеть историю просмотра и активность устройств»), Firefox RU «Управление горячими клавишами расширений» (mozilla-l10n `ru/toolkit/toolkit/about/aboutAddons.ftl` › `addon-manage-extensions-shortcuts`).

Result: 24 keys changed in `ru.json` (style 10, meaning 5, grammar 4, consistency 2, typography 2, terminology 1); `messages.json` unchanged (`extDescription` 83 characters; both command texts identical to `settings.shortcuts.episode` / `settings.shortcuts.panel`). No plural, placeholder or gender-agreement error was found: the translation was already solid on those points, and the Shikimori status vocabulary is applied consistently. `npm run i18n:check -- ru`: 0 errors, 63 length warnings (reviewed below).

## Changes

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `sync.noServiceFollows` | Ни один подключённый сервис не отслеживает это аниме. | Ни на одном подключённом сервисе нет карточки этого аниме. | meaning | Raised when no connected service has an entry ID for the anime (`resolveTargets` returns no target), not when the anime is missing from the list (that is `engagement.notInList`); «не отслеживает» sent users to add it to their list. |
| `airing.status.failed` | ошибка: {error} | не удалась: {error} | grammar | Appended to «Последняя проверка: … · »; produced «ошибка: Неизвестная ошибка». «не удалась» agrees with *проверка*. |
| `crImport.connect.access` | У SyncKai больше нет доступа к {platform}: разреши его, чтобы прочитать твою историю. | У SyncKai больше нет доступа к {platform}: разреши его для чтения истории. | grammar | In «разреши…, чтобы прочитать» the infinitive's subject is the user, contradicted by *твою* (SyncKai reads the history). |
| `settings.shortcuts.help` | Изменённая тобой клавиша сохраняется при обновлениях. Если клавиши нет или она уже занята браузером или другим расширением, назначь её через «Изменить» или «Назначить». | Если ты изменишь клавишу, она сохранится и после обновлений. А если клавиши нет или она уже занята браузером или другим расширением, назначь новую кнопкой «Изменить» или «Назначить». | meaning | «назначь её» told the user to assign the very key that is missing or taken; «Изменённая тобой» is stilted. New wording stays gender-neutral (future tense). |
| `settings.mappings.forgetAria` | Забыть: {label} | Забыть сопоставление: {label} | meaning | «Забыть: One Piece · S2 (East Blue)» sounded like forgetting the series; the button forgets the match (aria-label only). |
| `onboarding.hint.anilist` | Рекомендуется для сопоставления | Рекомендуется для распознавания аниме | meaning | Welcome screen: *сопоставление* is internal jargon a newcomer cannot decode; the note defines matching as identifying the anime, and step 2 already says «SyncKai распознаёт аниме». ~226 px of ~270 px available on one line. |
| `watching.nextWatched` | Отметить следующий эпизод | Отметить следующий эпизод просмотренным | meaning | Incomplete (mark it as what?); now matches `watching.plusOneAria`. Tooltip only. |
| `backup.error.corrupted` | Резервная копия неполная или повреждена. | Резервная копия неполная или повреждённая. | grammar | Homogeneous predicates mixed a long adjective and a short participle (a classic style error); both long now. |
| `common.actionFailed` | Действие не удалось | Действие не выполнено | grammar | *удаться* collocates with *попытка, план, операция*, not with *действие*; alert title in a wrapping box. |
| `agenda.empty.noSeries` | Пока ты ничего не смотришь. Начни любое аниме на Crunchyroll или ADN — его новые эпизоды появятся здесь. | Пока ты ничего не смотришь. Начни смотреть любое аниме на Crunchyroll или ADN — его новые эпизоды появятся здесь. | style | «Начни любое аниме» is a calque of "start one"; Russian says «начни смотреть». |
| `agenda.empty.noSeriesPlatforms` | Пока ты ничего не смотришь. Начни любое аниме на {platforms} — его новые эпизоды появятся здесь. | Пока ты ничего не смотришь. Начни смотреть любое аниме на {platforms} — его новые эпизоды появятся здесь. | style | Same as agenda.empty.noSeries. |
| `page.manualNotSaved` | Этого эпизода нет в этом сезоне: синхронизация не запомнит этот выбор. | Этого эпизода нет в выбранном сезоне: синхронизация не запомнит такой выбор. | style | Triple *этого / этом / этот*; *выбранном* also says which season is meant. |
| `crImport.rule.never` | Только вперёд: прогресс только растёт, а просмотренные и пересматриваемые аниме остаются как есть. | Только вперёд: прогресс никогда не уменьшается, а просмотренные и пересматриваемые аниме остаются как есть. | style | *только … только* repetition; «никогда не уменьшается» restates "never backwards". |
| `sync.correctionPending` | Для этого сезона ждёт исправление: эпизод будет применён после твоего решения во вкладке «Активность» | Исправление для этого сезона ждёт твоего решения во вкладке «Активность», затем эпизод будет применён | style | Intransitive «ждёт исправление» with the subject at the end read vaguely; reads well inside «{reason}. Нажми на значок SyncKai…». |
| `content.shortcut.noPlayback.message` | Открой эпизод, чтобы отметить его просмотренным горячей клавишей. | Открой эпизод, чтобы горячей клавишей отметить его просмотренным. | style | Two instrumentals in a row («просмотренным горячей клавишей») could be parsed as "watched by the hotkey". |
| `crImport.read.error.logged-out` | Войди в {platform} в той вкладке, затем запусти чтение снова. | В той вкладке войди в {platform}, затем запусти чтение снова. | style | Two stacked *в* phrases («в Crunchyroll в той вкладке»). |
| `crImport.read.error.netflixLoggedOut` | Войди в Netflix в той вкладке и выбери профиль, затем снова открой страницу «История просмотра» и повтори чтение. | В той вкладке войди в Netflix и выбери профиль, затем снова открой страницу «История просмотра» и повтори чтение. | style | Same as crImport.read.error.logged-out. |
| `import.includeSettings` | Импортировать и настройки | Также импортировать настройки | style | Checkbox label: the elliptical «и» (= "too") reads like a truncated list; «Также» is unambiguous. |
| `import.includeSettingsMissing` | Импортировать и настройки (их нет в файле) | Также импортировать настройки (их нет в файле) | style | Same as import.includeSettings. |
| `feedback.notConnected.title` | Нет подключённого аккаунта | Нет подключённых аккаунтов | consistency | Same English as `settings.summary.noAccount` / `airing.skip.notConnected` («нет подключённых аккаунтов»); same length in the footer. |
| `settings.help.noErrors` | Ошибок не записано | Ошибок в журнале нет | consistency | Pairs with `settings.help.errors` («{count} ошибка в журнале») in the same status line. |
| `agenda.adjust.label` | Задержка для {title} | Задержка для «{title}» | typography | Titles inside a phrase are quoted everywhere else (term sheet; «Оценить «{title}»», «Найти «{title}» на …»). |
| `common.stopSyncAria` | Не синхронизировать {title} | Не синхронизировать «{title}» | typography | Same as agenda.adjust.label (aria-label). |
| `auth.failed` | Ошибка авторизации: {message} | Ошибка входа: {message} | terminology | Sign-in is *вход* in every other auth string («Вход отменён», «Не удалось завершить вход»); *авторизация* appeared only here. |

Tried and reverted: `watching.resume` «Продолжить» → «Продолжить просмотр» (the usual Russian streaming label for "Continue watching"): in the Continue card the label shares a row with the `shrink-0` pill «Открыть на Crunchyroll» (~180 px), leaving ~280 px for ~300 px of content, so it would wrap onto two lines. Kept «Продолжить» (the kana ツヅキ above it already marks it as a heading).

## Term sheet changes (`docs/i18n/glossary/ru.md`)

- entry: «нет карточки» (no entry on a service, `sync.noServiceFollows`) is kept distinct from «нет в твоём списке»; SyncKai's own UI cards are never *карточка* (*проверка*).
- match: aria form «Забыть сопоставление: …», never a bare «Забыть: …»; on the welcome screen matching is described as *распознавание* («Рекомендуется для распознавания аниме»).
- account / sign in: sign-in failures use *вход*, never *авторизация* («Ошибка входа: {message}»); "No account connected" is always «Нет подключённых аккаунтов».
- shortcut: Firefox source recorded (`addon-manage-extensions-shortcuts`, verified 2026-10-14).
- Netflix: «Показать еще» and «История просмотра» re-checked against help.netflix.com/ru/node/101917 on 2026-10-14.
- Conventions: gender-neutral pattern «Если ты изменишь клавишу, она сохранится…» and no stilted *…тобой* participles; «чтобы + infinitive» only when the user is the agent (else a noun: «для чтения истории»); quotes around titles inside labels and aria-labels too, not in colon or ` · ` compositions; the new-episode check line «Последняя проверка: … · не удалась: {error}»; homogeneous predicates keep one form («неполная или повреждённая»).

## Length warnings (`i18n:check`)

The 63 warnings compare characters with short English texts. Checked against each context note and, where it mattered, the rendering code:

- Within the limit given by the note: `agenda.adjust.save`, `notes.save`, `common.retry`, `settings.status.saved`, `settings.shortcut.set` (≤ 12); `common.ignore`, `compare.job.stop`, `page.action.DROPPED`, `page.action.PAUSED`, `watching.status.DROPPED` (≤ 10); `common.open` (≤ 8); `crImport.preview.add` (≤ 8); `crImport.review.series`, `import.import` (≤ 15); `import.closeTab`, `import.title`, `settings.help.clear`, `settings.cat.shortcuts` (≤ 20); `settings.autoSync.label` (≤ 25); `settings.backup.exported` (14 ≤ 14); `settings.shortcuts.unset` (≤ 16); `panel.nowPlaying.relation.SEQUEL` (≤ 18); `popup.syncEnabled`, `watching.resumeSync` (chip / menu, ≈ 25–30); the panel status lines `panel.live.autoSyncOff`, `.countdown` (28 with «2 мин 10»), `.error`, `.pointPassed`, `.synced`, `.syncing` (≤ 30).
- Text that wraps or is not a button: `onboarding.welcome` (large heading), `content.shortcut.paused.title`, `feedback.error.title`, `prompt.rewatch.saving` (bubble titles, 280 px, wrap), `common.actionFailed` (alert title), `inline.rateInActivity` (sentence appended to a wrapping banner), `crImport.review.merged_one` (small wrapping line), `recent.empty`, `recent.title`, `match.single`, `sync.noEquivalent`, `sync.recentNotFound`, `toast.line.saved`, `review.format.tvShort` (details line), `settings.section.about` / `.backup` / `.mappings` / `.sync` (section headings), `import.summary.*` (table row labels), `settings.summary.mappings_one` (truncated summary line, same pattern as fr/de).
- Not visible: `agenda.next`, `watching.nextWatched` (tooltips), `queue.section`, `settings.mappings.forgetAria` (aria-labels).
- `common.syncing` (14 for a ~12 busy label of the Confirm button) is shorter than the reviewed French «Synchronisation…» (16); `watching.tipTitle` «Совет» (5) is fine.

Not verified visually (no build or e2e run in this review): the e2e layout probe (`scripts/e2e/layout-probe.ts`) should be run for `ru`, with attention to `footer.queuePending` and `common.reconnect` (see below).

## Debatable strings left unchanged

| Key | Current | Why kept | Alternative |
|---|---|---|---|
| `page.action.COMPLETED` | Готово | 10-character button next to «Отложить» / «Бросить»; «Просмотрено» (11) matches the status and the confirmation «Просмотрено?» but risks truncation in the narrow side panel. «Готово» can read as "close / done with this dialog", softened by the confirmation step and the tooltip «Отметить как просмотренное». | Просмотрено |
| `compare.bulk.anilist` / `.mal`, `compare.bulk.filtered.anilist` / `.mal` | Всё как в AniList · По фильтру как в AniList | Term sheet decision; compact (≤ 24) and backed by the confirmation box «Выровнять 12 аниме по AniList? Изменения в MyAnimeList:». Elliptical, especially the filtered pair. | Выровнять всё по AniList (fits only the unfiltered pair) |
| `page.airing.RELEASING` | Онгоинг | Shikimori's own status word, which tracker users read daily; it sits in an info line next to «Вышло», «Анонс», «Перерыв». Slang, but natural for this audience. | Выходит |
| `panel.tab.nowPlaying` | Сейчас идёт | Term sheet decision (TV-guide wording, 11 characters). Next to «Расписание» it could suggest "currently airing"; the tab content removes the doubt at once. | Сейчас смотрю (clashes with the «Смотрю» tab) |
| `crImport.skipReason.repeating` | пересматриваю | The note asks for the status term; consistent with chips «AL Смотрю». As a reason («AniList: пересматриваю») a neutral form would read better. | пересматривается |
| `review.format.tvShort` | Короткий сериал | Understood next to TV / OVA / Фильм, but «короткий сериал» can also mean "few episodes". | Короткометражный сериал (long for the details line) |
| `crImport.preview.add` | новое | ≤ 8 characters inside «AL новое → 12»; elliptical but clear in the arrow chip. | нет (→ 12) is more ambiguous |
| `crImport.skipReason.beyond` | вне карточки | ≤ 20 characters; «за пределами карточки» (21) is used in full sentences. | больше, чем в карточке |
| `import.exportedOn` | · экспортировано {date} | Impersonal neuter, like «Изменено» / «Создано» in Russian file managers. | экспортирован (agrees with *файл*) |
| `airing.notification.message` | Показано в Японии · на Crunchyroll/ADN обычно через несколько часов | Number-neutral (also under the multi-episode title), acceptable elliptical notification style. | Вышло в эфир в Японии · на Crunchyroll/ADN обычно появляется через несколько часов (longer than ≈ 70) |
| `inline.backTo` | Назад к эп. {progress} | Mirrors the English; could look like a navigation link in a feedback chip. | Возврат к эп. {progress} |
| `footer.queuePending` | {count} синхронизация в очереди | Term sheet pattern; «12 синхронизаций в очереди» (26) exceeds the ≈ 22 footer budget and truncates. | В очереди: {count} |
| `common.reconnect` | Переподключить | 14 for ≈ 12; the button is `shrink-0` and «Сессия истекла» truncates instead (~215 px of ~250 px by estimate). | Войти снова |
| `footer.toReview` | {count} ждёт проверки | Elliptical subject in a status button with a warning icon; consistent with «аниме ждут оценки». | — |
| `crImport.netflix.rule` | «Показать еще» | Spelled with *е* exactly as on Netflix RU (verified); the code should accept «Показать ещё» too. | — |
| `crImport.preview.oneService` | Подключён только {service}: обновится только он. | Emphatic repetition of *только*, natural in speech. | …, поэтому обновится лишь он. |
| `crImport.review.created` | …: сделай выбор в окне расширения… | Vaguer than "pick the entry" but avoids singular/plural mismatch with several checks. | выбери карточку |

## Residual doubts for a native human reviewer

- `page.action.COMPLETED` «Готово» vs «Просмотрено» (button semantics vs width).
- `compare.bulk.*` elliptical button labels.
- `page.airing.RELEASING` «Онгоинг» (slang acceptance in the app) and `panel.tab.nowPlaying` «Сейчас идёт» (possible "airing now" reading).
- `crImport.skipReason.repeating` «пересматриваю» as a reason fragment.
- `review.format.tvShort` «Короткий сериал».
- Layout: `footer.queuePending` (≥ 10 pending syncs), `common.reconnect` and `watching.resume` should be looked at in the e2e layout probe or the real popup.

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | Зима / Весна / Лето / Осень | Зима {year} / Весна {year} / Лето {year} / Осень {year} | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |

Code fixes that change how this catalog is displayed:

- Netflix history import: the “Показать ещё / Показать еще” button of a Netflix profile in this language is recognized (label checked by the reviewer on Netflix’s help article 101917 in this language): such an import no longer stops after the first rows as if the history were complete.
- The signed delays of the Schedule tooltips (`agenda.estimate.*`) now use `time.countdown.*`: “+1 ч 30 мин”.
- Lists of names in `{services}` and `{titles}` use the language’s own conjunction (`Intl.ListFormat`) instead of “, ”.

Layout (`npm run test:i18n-layout`), fixed in the components without changing the text: `queue.nextAttempt`, `queue.failed` (Activity › pending syncs): the buttons go below the status when it is long; the “–/10” value of the *To rate* stars: “Ignore” goes below the stars when they don’t fit; `page.action.PAUSED` (side panel at 320 px): the icons are hidden when the side panel is narrow.
