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

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). Same text in every variant (the wording already avoided the noun agreement), `{total}` renamed `{count}`.

| Key | Text |
|---|---|
| `sync.beyondEntry_one` | Эпизод {progress} за пределами карточки (эпизодов: {count}) |
| `sync.beyondEntry_few` | Эпизод {progress} за пределами карточки (эпизодов: {count}) |
| `sync.beyondEntry_many` | Эпизод {progress} за пределами карточки (эпизодов: {count}) |
| `sync.beyondEntry_other` | Эпизод {progress} за пределами карточки (эпизодов: {count}) |

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | Кнопка «Показать еще» не распознана на языке твоего профиля Netflix: прочитаны только последние эпизоды. Установи для этого профиля на Netflix тот же язык, что и в SyncKai, и повтори чтение. |

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video (только аниме) |
| `settings.prime.label` | Синхронизация на Prime Video |
| `settings.prime.helpOff` | Синхронизируются только аниме (жанр «аниме» или анимация с японской аудиодорожкой либо с точным названием на AniList). Браузер запросит доступ к primevideo.com |
| `settings.prime.helpOn` | SyncKai читает только то, что страница Prime Video уже получает. В уже открытой вкладке Prime Video отслеживание начнётся со следующего эпизода |
| `settings.prime.denied` | Доступ к primevideo.com не предоставлен: синхронизация на Prime Video остаётся выключенной |
| `settings.prime.disabled` | Синхронизация на Prime Video выключена: перезагрузи открытые вкладки Prime Video, чтобы полностью остановить отслеживание |
| `settings.prime.error` | Не удалось изменить доступ к Prime Video, попробуй ещё раз |

| Key | Text |
|---|---|
| `onboarding.intro` | Смотри аниме на Crunchyroll или ADN (Netflix, Disney+ и Prime Video — по желанию): SyncKai обновляет твой список в конце каждого эпизода. |
| `watching.tip` | Netflix, Disney+, Prime Video (по желанию) и предпочитаемый плеер настраиваются в разделе {path}. |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | Совпадает с данными платформы: {signals} |
| `match.signalsContradict` | Не совпадает с данными платформы: {signals} |
| `match.yearRemake` | Ремейк определён по году выхода ({year}) |
| `match.signal.year` | год выхода |
| `match.signal.episodes` | число эпизодов |
| `match.signal.duration` | длительность эпизодов |
| `match.signal.format` | формат (фильм или сериал) |
| `match.signal.country` | страна производства |
| `match.signal.originalTitle` | оригинальное название |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | Сохранённое сопоставление не совпадает с данными платформы: {signals} |

## 2026-10-14 · Matching diagnostic (development builds only)

New keys `settings.matchDiag.*` (Settings › Help & about, section shown only in development builds, never in the published extension): the last 50 AniList matching decisions, a « Copy » button per row (one decision as JSON, for the test corpus) and a « Clear » button. `{count}` follows a label and a colon (no plural form); `JSON` is a format name. Terms from this language's term sheet (match, entry). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.title` | Диагностика сопоставлений |
| `settings.matchDiag.text` | Только в сборках для разработки: последние 50 решений о сопоставлении с AniList, от новых к старым, хранятся до закрытия браузера. Скопируй одно в JSON, чтобы добавить его в тестовый корпус. |
| `settings.matchDiag.empty` | Пока нет записанных решений |
| `settings.matchDiag.copy` | Копировать |
| `settings.matchDiag.copyTitle` | Скопировать это решение в JSON |
| `settings.matchDiag.copied` | Скопировано |
| `settings.matchDiag.copyFailed` | Не удалось скопировать решение. |
| `settings.matchDiag.clear` | Очистить |
| `settings.matchDiag.candidates` | Кандидаты: {count} |
| `settings.matchDiag.noEntry` | Нет карточки |

## 2026-10-15 · Debug trace (development builds only)

New keys `settings.debugTrace.*` (Settings › Help & about, section shown only in development builds, never in the published extension, below the matching diagnostic): a timeline of what the extension did (pages, service worker, AniList and MyAnimeList requests), a verbose switch, a category filter (category names stay in English: technical identifiers), « Copy trace » (the whole trace as JSON) and the « Clear » button of the matching diagnostic (`settings.matchDiag.clear`, reused). `{count}` and `{max}` follow a label and a colon (no plural form) and arrive formatted for the language; `JSON` is a format name; `service worker` kept as the browser's technical term. New terms added to this language's term sheet (debug trace, event, verbose mode); other terms from it (account). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.debugTrace.title` | Отладочная трассировка |
| `settings.debugTrace.text` | Только в сборках для разработки: хронология того, что SyncKai делал на страницах, в service worker и с AniList и MyAnimeList, от новых событий к старым, хранится до закрытия браузера. Токены, cookie и идентификаторы аккаунтов не записываются. Скопируй всю трассировку в JSON, чтобы поделиться ею, когда сообщаешь о проблеме. |
| `settings.debugTrace.empty` | Пока нет записанных событий |
| `settings.debugTrace.copy` | Копировать трассировку |
| `settings.debugTrace.copied` | Скопировано |
| `settings.debugTrace.copyFailed` | Не удалось скопировать трассировку. |
| `settings.debugTrace.verbose` | Подробный режим (все строки журнала) |
| `settings.debugTrace.count` | События: {count} / {max} |
| `settings.debugTrace.allCategories` | Все категории |
| `settings.debugTrace.filterAria` | Фильтр событий по категории |

## 2026-10-16 · Matching diagnostic: Copy all (development builds only)

New keys in the « Matching diagnostic » section (Settings › Help & about, development builds only, never in the published extension, now collapsed by default behind its title): « Copy all » copies every recorded decision as one JSON array, next to « Clear »; its label becomes « Copied » (`settings.matchDiag.copied`, reused) and a failure reuses `settings.matchDiag.copyFailed`. `JSON` is a format name. Same word for « decision » as `settings.matchDiag.copyTitle`, in the plural; other terms from this language's term sheet. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.copyAll` | Копировать всё |
| `settings.matchDiag.copyAllTitle` | Скопировать все решения в JSON |

## 2026-10-16 · Episode guards (« To check » reasons)

New reasons on a « To check » card (`fix/episode-guards`, audit SEC-01): a sync that would jump straight to the last episode from far behind, and episodes reported as finished in a burst, now wait for the user instead of being written. Same « to check » term as `match.otherSeriesExcluded`, same episode wording as `sync.beyondEntry_*`; `{from}` and `{progress}` are episode numbers. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `sync.review.finaleJump` | Сразу последний эпизод ({progress}) после эпизода {from}: нужно проверить |
| `sync.review.burst` | Много эпизодов досмотрено за несколько минут: нужно проверить |

## 2026-10-17 · Status bar (popup and side panel)

New texts of the status bar shown at the bottom of the popup and, now, of the side panel (`feature/ui-status-bar`): a synced episode or a count of synced episodes under the series title, shown until the user hides it (« Seen, hide », a × button label), and the history import running, ready to confirm and done. Same words as this language's term sheet: « синхронизировать » (« синхронизирован »), « аниме » (neuter agreement, as in `compare.result.updated_*`), « эпизод » / « Эп. », « импорт » (« Импорт завершён » as in `crImport.apply.done`) and « к подтверждению » (from « Подтвердить »); ` · ` and ` / ` kept; `{platform}` is a brand name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `footer.dismiss` | Понятно, скрыть |
| `footer.importDone_one` | Импорт завершён · {count} аниме обновлено |
| `footer.importDone_few` | Импорт завершён · {count} аниме обновлены |
| `footer.importDone_many` | Импорт завершён · {count} аниме обновлено |
| `footer.importDone_other` | Импорт завершён · {count} аниме обновлено |
| `footer.importProgress` | Импорт из {platform} · {done} / {total} |
| `footer.importReady_one` | Импорт готов · {count} аниме к подтверждению |
| `footer.importReady_few` | Импорт готов · {count} аниме к подтверждению |
| `footer.importReady_many` | Импорт готов · {count} аниме к подтверждению |
| `footer.importReady_other` | Импорт готов · {count} аниме к подтверждению |
| `footer.syncedEpisode` | Эп. {episode} синхронизирован |
| `footer.syncedEpisodes_one` | {count} эпизод синхронизирован |
| `footer.syncedEpisodes_few` | {count} эпизода синхронизированы |
| `footer.syncedEpisodes_many` | {count} эпизодов синхронизировано |
| `footer.syncedEpisodes_other` | {count} эпизода синхронизировано |

## 2026-10-17 · Account menu (status bar)

New texts of the account menu that opens above the AniList / MyAnimeList logo of the status bar (popup and side panel): the logo button's label (also when the session expired), the connection status line, three stat tiles (anime count, episodes watched, days watched, each number shown above its short label), the « Synced this week » row with its tooltip and value, and « View my profile ». Following this language's term sheet, used **аккаунт**, **подключён** (as `settings.account.connected`), **сессия истекла** (`common.sessionExpired`), **синхронизировано** (no slang clipping), **эпизод** with the four plural forms of `footer.syncedEpisodes_*`; *аниме* indeclinable; the days tile label is the genitive noun **просмотра**, valid for every count; « day » is **дн.**, as `time.countdown.days`. ` · ` kept; `{service}` is a brand name, `{name}` the user's AniList / MyAnimeList user name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `accountMenu.connected` | Подключён |
| `accountMenu.connectedAs` | {name} · подключён |
| `accountMenu.label` | Аккаунт {service} |
| `accountMenu.labelExpired` | Аккаунт {service}, сессия истекла |
| `accountMenu.profile` | Открыть мой профиль |
| `accountMenu.stats.anime_one` | аниме |
| `accountMenu.stats.anime_few` | аниме |
| `accountMenu.stats.anime_many` | аниме |
| `accountMenu.stats.anime_other` | аниме |
| `accountMenu.stats.days_one` | просмотра |
| `accountMenu.stats.days_few` | просмотра |
| `accountMenu.stats.days_many` | просмотра |
| `accountMenu.stats.days_other` | просмотра |
| `accountMenu.stats.daysValue` | {days} дн. |
| `accountMenu.stats.episodes_one` | эпизод |
| `accountMenu.stats.episodes_few` | эпизода |
| `accountMenu.stats.episodes_many` | эпизодов |
| `accountMenu.stats.episodes_other` | эпизода |
| `accountMenu.week.label` | Синхронизировано за неделю |
| `accountMenu.week.title` | Эпизоды, синхронизированные SyncKai на этой неделе |
| `accountMenu.week.value_one` | {count} эпизод |
| `accountMenu.week.value_few` | {count} эпизода |
| `accountMenu.week.value_many` | {count} эпизодов |
| `accountMenu.week.value_other` | {count} эпизода |

## 2026-10-17 · Settings redesign (Preact): new and changed keys

New texts of the redesigned Settings (Preact): the Platforms and Display categories, the screen-reader names of the back button and of the category card, the row summaries of the Settings home, the Keyboard section of Display, the two sections of Shortcuts, and the section titles and notes of Accounts. Changed: `settings.cat.notifications` (now the single word: the Schedule options moved to Platforms), `settings.summary.connected` (a word instead of ✓), `settings.summary.paused` (now a standalone, capitalised summary), `settings.summary.version` (a word instead of « v »), `settings.entry.help` (the « both accounts connected » condition moved to `settings.entry.unavailable`). Summaries are joined with ` · ` by the code; `settings.account.expiredHelp` and `settings.account.otherStillSynced` are joined as two sentences. The Display summary reuses `settings.section.language`, `settings.section.panel` and `settings.shortcuts.pointer`; the My data summary the history import and backup words; the player summary `settings.player.label`. Platform count « Включено: {count} из {total} » in every plural form (as « Включить {platform} »). Back label « Назад в раздел {page} » keeps the label in the nominative. Player summary « плеер {player} » (*Предпочитаемый плеер*). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.cat.notifications` | Уведомления |
| `settings.cat.platforms` | Платформы |
| `settings.cat.display` | Отображение |
| `settings.backToAria` | Назад в раздел {page} |
| `settings.group.categories` | Категории |
| `settings.summary.connected` | {service} подключён |
| `settings.summary.notConnected` | {service} не подключён |
| `settings.summary.bothConnected` | AniList и MyAnimeList подключены |
| `settings.summary.auto` | Автоматически |
| `settings.summary.paused` | На паузе |
| `settings.summary.platforms_one` | Включено: {count} из {total} |
| `settings.summary.platforms_few` | Включено: {count} из {total} |
| `settings.summary.platforms_many` | Включено: {count} из {total} |
| `settings.summary.platforms_other` | Включено: {count} из {total} |
| `settings.summary.player` | плеер {player} |
| `settings.summary.display` | Язык, боковая панель, горячие клавиши |
| `settings.summary.data` | Импорт истории просмотров · резервная копия |
| `settings.summary.version` | Версия {version} |
| `settings.summary.noErrors` | ошибок нет |
| `settings.display.keyboard` | Клавиатура |
| `settings.display.shortcutsHelp` | Клавиши, чтобы отметить эпизод или открыть панель |
| `settings.shortcuts.duringPlayback` | Во время просмотра |
| `settings.shortcuts.navigation` | Навигация |
| `settings.accounts.lists` | Синхронизируемые списки |
| `settings.accounts.both` | С обоими аккаунтами |
| `settings.accounts.privacy` | Вход выполняется на сайте AniList или MyAnimeList: SyncKai никогда не видит твой пароль. |
| `settings.account.expiredHelp` | Эпизоды больше не отправляются в {service}, пока ты не переподключишь аккаунт. |
| `settings.account.otherStillSynced` | {service} по-прежнему обновляется. |
| `settings.entry.help` | Открывается по клику на название или обложку аниме |
| `settings.entry.unavailable` | Доступно, когда подключены и AniList, и MyAnimeList. |

## 2026-10-17 · Settings › Sync, Matches and Excluded series (Preact)

New texts of the redesigned Sync settings page and of its two sub-pages (Matches, Excluded series), moved out of My data: section titles « Automatic » / « Per series », the descriptions of the two « Episode counted as watched » cards, the « Per series » rows, the Matches intro, search, empty and no-result texts, « Show N more on {platform} », the four origin badges and their legend, the Excluded series section, note, empty hint and the « {year} series · excluded on {date} » fragments. Changed: `settings.trigger.legend` (« Episode counted as watched », where the old text was only « Episode watched »), `settings.trigger.credits` (« (recommended) » moved to `settings.trigger.creditsHelp`), and the paths of `popup.syncDisabledDetail` / `review.excludeTitle` (now nav.settings › settings.section.sync › settings.section.exclusions, built from this catalog's own titles). Removed: `settings.mappings.count_*`, `settings.mappings.help`, `settings.mappings.manage`. `{action}` is the « Re-enable » button (`settings.exclusions.help`) or the « Stop syncing this series » menu item (`settings.exclusions.emptyHelp`), so the quoted labels always match. The match / entry / excluded / re-enable words reuse this catalog's existing terms (`settings.section.mappings`, `settings.mappings.entryFallback`, `settings.section.exclusions`, `settings.exclusions.reactivate`). Counts written « Аниме в памяти: {count} » and « Показать ещё на {platform} ({count}) » in every plural form (no agreement). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.section.automatic` | Автоматически |
| `settings.section.perSeries` | По аниме |
| `settings.trigger.legend` | Когда эпизод считается просмотренным |
| `settings.trigger.credits` | В начале финальных титров |
| `settings.trigger.creditsHelp` | Рекомендуется: точный момент, который сообщает платформа |
| `settings.trigger.percentageHelp` | Используется и тогда, когда титры неизвестны |
| `settings.sync.mappingsRow` | Сохранённые сопоставления |
| `settings.sync.mappingsRowHelp` | Сезон AniList, выбранный для каждого аниме |
| `settings.sync.exclusionsRowHelp` | Никогда не синхронизируются, можно снова включить здесь |
| `settings.mappings.intro_one` | Аниме в памяти: {count}, по платформам: сезон на платформе → карточка AniList, куда пишет SyncKai. Забытое сопоставление определяется заново при следующем эпизоде. |
| `settings.mappings.intro_few` | Аниме в памяти: {count}, по платформам: сезон на платформе → карточка AniList, куда пишет SyncKai. Забытое сопоставление определяется заново при следующем эпизоде. |
| `settings.mappings.intro_many` | Аниме в памяти: {count}, по платформам: сезон на платформе → карточка AniList, куда пишет SyncKai. Забытое сопоставление определяется заново при следующем эпизоде. |
| `settings.mappings.intro_other` | Аниме в памяти: {count}, по платформам: сезон на платформе → карточка AniList, куда пишет SyncKai. Забытое сопоставление определяется заново при следующем эпизоде. |
| `settings.mappings.search` | Найти аниме или карточку |
| `settings.mappings.noResult` | Нет сопоставлений для «{query}» |
| `settings.mappings.noResultHelp` | Ищи по названию аниме или карточки AniList. |
| `settings.mappings.emptyHelp` | SyncKai запоминает одно для каждого синхронизированного сезона. |
| `settings.mappings.showMore_one` | Показать ещё на {platform} ({count}) |
| `settings.mappings.showMore_few` | Показать ещё на {platform} ({count}) |
| `settings.mappings.showMore_many` | Показать ещё на {platform} ({count}) |
| `settings.mappings.showMore_other` | Показать ещё на {platform} ({count}) |
| `settings.mappings.origin.chosen` | Выбрано тобой |
| `settings.mappings.origin.learned` | Найдено |
| `settings.mappings.origin.unmarked` | Старое |
| `settings.mappings.origin.unverified` | Импортировано · проверить |
| `settings.mappings.origin.chosenHelp` | Подтверждено или выбрано тобой: никогда не пересматривается. |
| `settings.mappings.origin.learnedHelp` | Найдено SyncKai: определяется заново, если платформа ему противоречит. |
| `settings.mappings.origin.unmarkedHelp` | Сохранено до версии 2.4: остаётся, при противоречии — на проверку. |
| `settings.mappings.origin.unverifiedHelp` | Из резервной копии: проверяется заново при первом использовании. |
| `settings.mappings.originLegend` | Происхождение сопоставлений |
| `settings.exclusions.section` | Никогда не синхронизируются |
| `settings.exclusions.help` | Исключённое аниме больше никогда не синхронизируется, ни в одном сезоне. «{action}» снова отслеживает его со следующего эпизода. |
| `settings.exclusions.emptyHelp` | Чтобы перестать синхронизировать аниме, выбери «{action}» в его меню «⋯». |
| `settings.exclusions.seriesYear` | аниме {year} года |
| `settings.exclusions.excludedOn` | исключено {date} |
| `popup.syncDisabledDetail` | Можно снова включить в разделе Настройки › Синхронизация › Исключённые аниме |
| `review.excludeTitle` | Исключает аниме (все сезоны): можно снова включить в разделе Настройки › Синхронизация › Исключённые аниме |

## 2026-10-17 · Settings › Platforms and Notifications (Preact)

Texts of the redesigned Platforms page (list of sites with « Included » / « Access missing » or a switch, preferred player dropdown, estimated release time per platform with − / + buttons, moved there from the Schedule card) and Notifications page (« On the playback page » style cards and « New episodes »). New: `settings.platforms.where`, `settings.platforms.allAnime`, `settings.platforms.included`, `settings.platforms.accessMissing`, `settings.platforms.note`, `settings.player.openOn`, `settings.player.enableFirst`, `settings.offsets.earlier`, `settings.offsets.later`, `settings.notif.legend`. Changed: `settings.player.help`, `settings.offsets.title`, `settings.offsets.help`, `page.platformOff`, `settings.section.notifications`, `settings.notif.discreet.desc`, `settings.notif.detailed.desc`, `settings.notif.alertsOnly.desc`, `settings.notif.alertsAlways`, `settings.delay.title`, `settings.airing.enableFirst` (the notification descriptions now describe the pill and the bubble, « Extra delay » replaces « Delay », the release-time help says the alerts use it too, « Turn on alerts… » is now visible text). `page.platformOff` keeps its sentence; only the path changed, from « Settings › Playback & sync » to nav.settings › settings.cat.platforms of this catalog. Removed: `settings.section.playback`, `settings.netflix.section`, `settings.netflix.label`, `settings.disney.section`, `settings.disney.label`, `settings.prime.section`, `settings.prime.label`, `settings.airing.label`, `settings.airing.help`, `settings.section.agenda`. The Schedule word, « Open », the release-alert name and the minute unit reuse this catalog's `panel.tab.agenda`, `common.open`, `settings.quick.airing.label` and `settings.offsets.unit`. `settings.delay.title` « Запас времени » (time margin) instead of a longer « Дополнительная задержка ». Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.platforms.where` | Где SyncKai отслеживает эпизоды |
| `settings.platforms.allAnime` | Все аниме |
| `settings.platforms.included` | Встроено |
| `settings.platforms.accessMissing` | Нет доступа |
| `settings.platforms.note` | При включении платформы запрашивается доступ к её сайту. Читаются только страницы просмотра и страницы аниме. |
| `settings.player.openOn` | Открывать эпизоды на |
| `settings.player.enableFirst` | Сначала включи |
| `settings.player.help` | Используется кнопкой «Открыть», если аниме есть на нескольких включённых платформах. |
| `settings.offsets.title` | Примерное время выхода |
| `settings.offsets.help` | После эфира в Японии. Используется вкладкой «Расписание» и оповещениями; время отдельного аниме меняется в его строке в «Расписании». |
| `settings.offsets.earlier` | На {minutes} мин раньше |
| `settings.offsets.later` | На {minutes} мин позже |
| `page.platformOff` | {platform} выключен: SyncKai здесь ничего не отслеживает. Включить снова: Настройки › Платформы. |
| `settings.section.notifications` | На странице просмотра |
| `settings.notif.legend` | Стиль уведомлений на странице |
| `settings.notif.discreet.desc` | Маленькая плашка на несколько секунд в углу видео |
| `settings.notif.detailed.desc` | Сообщение с эпизодом и результатом на AniList и MyAnimeList |
| `settings.notif.alertsOnly.desc` | Ничего, если всё в порядке; сообщение только при ошибке или эпизоде, который нужно проверить |
| `settings.notif.alertsAlways` | Ошибка или аниме, которое нужно проверить, показываются всегда, при любом стиле. |
| `settings.delay.title` | Запас времени |
| `settings.airing.enableFirst` | Включи оповещения, чтобы проверять новые эпизоды |

## 2026-10-17 · Settings › My data, AniList ↔ MAL differences, Help & about (Preact)

Texts of the redesigned My data page (one « Import a watch history » card, Backup card, « Compare » row opening the AniList ↔ MyAnimeList differences page, which moved there from the popup's Activity screen) and Help & about page (diagnostic report row, error log that unfolds, About card with What's new / Privacy / Source code links). New: `settings.import.title`, `settings.section.compare`, `settings.compare.title`, `settings.compare.help`, `settings.data.perSeries`, `compare.align`, `compare.bulk.help`, `compare.job.background`, `settings.help.diagnostic`, `settings.help.diagnosticHelp`, `settings.help.journalNote`, `settings.about.whatsNew`, `settings.about.privacy`. Changed: `settings.crImport.help`, `settings.backup.help`, `settings.backup.import`, `settings.help.copy`, `settings.about.source` (import help in two sentences, backup help « in one file », « Import » without ellipsis, « Copy the report » next to the new « Diagnostic report » title, « Source code » with « GitHub » on the right). `help.issue.body` keeps its text; only its last-line path changed, to nav.settings › settings.cat.help › settings.help.copy of this catalog. The compare.* texts are unchanged: their context notes now point to Settings › My data. Removed: `settings.section.import`, `settings.backup.crImportTitle`, `settings.crImport.openAria`, `settings.help.text`, `settings.help.copyTitle`, `settings.help.clearHelp`, `settings.help.reportTitle`. The version line reuses `settings.summary.version`, the « Clear » button `settings.matchDiag.clear`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.import.title` | Перенеси уже просмотренное |
| `settings.crImport.help` | Crunchyroll, ADN или Netflix. Перед записью ты увидишь предпросмотр. |
| `settings.backup.help` | Настройки, сопоставления, исключённые аниме и история в одном файле. Без данных входа в AniList и MyAnimeList. |
| `settings.backup.import` | Импорт |
| `settings.section.compare` | Сравнение |
| `settings.compare.title` | Расхождения AniList ↔ MyAnimeList |
| `settings.compare.help` | Сравнивает два твоих списка и выравнивает их в выбранную сторону |
| `settings.data.perSeries` | Сопоставления и исключённые аниме настраиваются в разделе {path}. |
| `compare.align` | Выравнивание |
| `compare.bulk.help` | «{action}» переносит AniList в MyAnimeList; сначала подтверждение покажет изменения. |
| `compare.job.background` | Продолжается, даже если закрыть эту страницу. |
| `settings.help.diagnostic` | Отчёт диагностики |
| `settings.help.diagnosticHelp` | Для сообщения об ошибке: версия, браузер, настройки, последние ошибки. Без токенов и аккаунтов. |
| `settings.help.copy` | Копировать отчёт |
| `settings.help.journalNote` | Не более 50 последних, сначала новые; токены уже скрыты. |
| `settings.about.whatsNew` | Что нового |
| `settings.about.privacy` | Конфиденциальность |
| `settings.about.source` | Исходный код |

## 2026-10-17 · Popup « My series » row menu (Preact)

The row « … » menu of the popup's « My series » list and of the « Continue » card now groups the entry links and the platform searches in two sub-menus. New: `watching.menu.openEntry` (sub-menu entry, its items are the bare AniList / MyAnimeList names; wording taken from `page.openOn` without « on {service} »), `watching.menu.searchOn` (sub-menu entry, its items are the bare platform names; wording taken from `watching.searchOn`, ending with « … »). Changed: `settings.entry.help`, which now also says that « Default entry page » picks the list shown in « My series » (quoted with the exact `watching.mySeries` of this catalog). The « −1 episode » item left the menu (the row has its own −), `watching.minusOne` stays for the « On this page » card. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `watching.menu.openEntry` | Открыть карточку |
| `watching.menu.searchOn` | Найти на… |
| `settings.entry.help` | Открывается по клику на название или обложку аниме; также задаёт список в «Мои аниме» |



## 2026-10-17 · Popup « On this page » card (Preact)

The popup's « On this page » card was redesigned: the Hold / Drop / Done row and the AniList / MAL links moved to the card's « … » menu (shared with « My series »), and the season dropdown, the star rating and the comment moved to a foldable « Details » section. New: `page.currentStatus` (grey mention at the end of the menu item of the series' current status), `page.details` (foldable button listing what the section holds, same nouns as `page.seasonPicker`, the rating words of `rating.*` and `notes.title`), `page.seasonOnAniList` (title above the season dropdown), `page.seasonHelp` (help under it on an episode page; the match word is the one of `settings.section.mappings`), `page.yourRating` (title above the stars). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `page.currentStatus` | Текущий статус |
| `page.details` | Подробнее: сезон, оценка, комментарий |
| `page.seasonOnAniList` | Сезон на AniList |
| `page.seasonHelp` | Смена сезона исправит сопоставление для следующих эпизодов. |
| `page.yourRating` | Твоя оценка |


## 2026-10-17 · Popup « Activity » tab (Preact)

The popup's Activity tab was redesigned: failed and pending syncs are now two sections, and every section heading is an uppercase label followed by « · {count} » added by the code. New: `queue.failedHeading` (same failure word as `queue.failed`), `queue.pendingHeading` (syncs waiting for a retry, wording of the former `queue.sectionTitle`), `ratings.heading` (the former `ratings.sectionTitle` without its count). The « To check » heading now reuses `inline.toCheck`. Removed: `queue.section`, `queue.sectionTitle`, `ratings.section`, `ratings.sectionTitle`, `review.title`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `queue.failedHeading` | Сбой |
| `queue.pendingHeading` | В очереди |
| `ratings.heading` | Оценить |


## 2026-10-17 · Side panel « Now playing » (Preact)

The side panel's « Now playing » tab was redesigned as cards: « You're watching » (live playback: bar, credits marker, countdown, sync state with an icon), « Your list » (status chip, « Progress » and the stepper, one line per account, the series « … » menu shared with the popup: Hold / Drop / Done moved there), then foldable sections « Rating and comment », Synopsis, related entries and Discussions. New: `panel.nowPlaying.watching` (heading of the live card, addresses the user), `panel.nowPlaying.list` (heading of the list card, same « your list » words as `page.notInList`), `panel.nowPlaying.ratingNotes` (section title, same nouns as `page.yourRating` and `notes.title`), `panel.live.creditsAt` and `panel.live.creditsUnknown` (legend of the yellow marker under the bar, credits word of `settings.trigger.credits`), `panel.live.countdownCredits` and `panel.live.countdownRatio` (countdown line, wording of the former `panel.live.countdown` plus what the sync waits for, as in `settings.trigger.credits` / `settings.summary.percentage`). Changed: `panel.live.synced` lost its trailing « ✓ » (a check icon now precedes it). The « Progress » label reuses `compare.filter.progress`. Removed: `page.action.COMPLETED`, `page.action.DROPPED`, `page.action.PAUSED` (the status button row is gone), `panel.live.countdown`, `panel.nowPlaying.progress`, `watching.nextWatched`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `panel.nowPlaying.watching` | Ты смотришь |
| `panel.nowPlaying.list` | Твой список |
| `panel.nowPlaying.ratingNotes` | Оценка и комментарий |
| `panel.live.creditsAt` | Титры в {time} |
| `panel.live.creditsUnknown` | Титры неизвестны · синхронизация на {percent} % |
| `panel.live.countdownCredits` | Синхронизация через {time} · в начале финальных титров |
| `panel.live.countdownRatio` | Синхронизация через {time} · на {percent} % эпизода |
| `panel.live.synced` | Синхронизировано |


## 2026-10-17 · Side panel Schedule (Preact) and week picker

The Schedule tab of the side panel was redesigned: days in order with « No episode » on empty days, episode lines « 18:00 Crunchyroll · Japan 17:00 » (the platform time first, the Japanese broadcast last and cut first), a « ⋯ » menu with « Adjust time » (its second line gives the time and whether the delay is the series' own or the default), « Open the entry › » and « Search on… › », and a week button that opens a month calendar. New: `agenda.adjust.custom` and `agenda.adjust.default` (second line of « Adjust time », lower case after « · »), `agenda.adjust.platform` (first sentence of `agenda.estimate.title`, shown in the delay editor), `agenda.picker.label`, `agenda.picker.prevMonth`, `agenda.picker.nextMonth`, `agenda.picker.thisWeek`, `agenda.picker.hint` (month calendar; the hint names the arrow keys and the Enter key). Changed: `agenda.jp` writes the country name instead of « JP » (unchanged where it already did: ja, ko, zh-CN, zh-TW). Removed: `watching.searchOn` (the search entries are now the platform names of the « Search on… › » sub-menu). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `agenda.jp` | Япония {time} |
| `agenda.adjust.custom` | задано для этого аниме |
| `agenda.adjust.default` | задержка по умолчанию |
| `agenda.adjust.platform` | Примерный выход на {platform}: эфир в Японии {offset}. |
| `agenda.picker.label` | Выбрать неделю |
| `agenda.picker.prevMonth` | Предыдущий месяц |
| `agenda.picker.nextMonth` | Следующий месяц |
| `agenda.picker.thisWeek` | Эта неделя |
| `agenda.picker.hint` | ↑ ↓ — сменить неделю, Enter — показать её. |
