# Russian term sheet — `ru`

Binding for every change to `src/i18n/locales/ru.json` and `public/_locales/ru/messages.json`. Shared rules: [`../GLOSSARY.md`](../GLOSSARY.md).

Reference vocabulary: the list statuses of **Shikimori**, the main Russian-language anime tracker, which Russian AniList / MyAnimeList users already know. Russian has no official AniList / MyAnimeList localization, so these are the words fans read every day.

## 1. Core concepts

| English term | Russian | Reason / usage notes |
|---|---|---|
| Watching (status) | Смотрю | Shikimori status. First person, no agreement. Quoted as a list name: « Добавлено в «Смотрю» ». |
| Completed (status) | Просмотрено | Shikimori status. Neuter: agrees with *аниме* (« Frieren: просмотрено », « «Frieren» просмотрено! », « (просмотрено) », « Отметить как просмотренное »). Only the USER's status, never "finished airing" (that is *Вышло*, see release below). |
| On hold (status) | Отложено | Shikimori status. Action: *Отложить*. Not the airing hiatus (*Перерыв*), not a paused video (*Пауза*), not paused auto sync (*на паузе*). |
| Dropped (status) | Брошено | Shikimori status (« бросить аниме » is what fans say). Action: *Бросить*, confirmation « Бросить? ». Never used for cancelling anything. |
| Plan to watch (status) | Запланировано | Shikimori status. Buttons follow the classic Russian « В избранное » pattern: « В «Запланировано» », « В «Смотрю» » (with + / play icons). |
| Rewatching (status) | Пересматриваю | Shikimori status, same lowercase in import chips (« AL пересматриваю »). |
| Watching (popup tab `nav.watching`) | Смотрю | Same word as the status; quoted « вкладка «Смотрю» ». |
| Activity (popup tab `nav.activity`) | Активность | Referred to as « вкладка «Активность» » / « (вкладка «Активность») ». |
| series | аниме (n., indeclinable) | The word the Russian community uses for a title. *Серия* is NOT used: in Russian it means an episode; *сериал* would exclude films and OVAs. Every adjective / participle agrees in the neuter (*исключено, просмотрено, брошено, добавлено, удалено*); plural « исключённые аниме », « 5 аниме ». « Мои аниме » for *My series*. |
| season | сезон | « Сезон 2 », « часть 1/2 », short « S2 » kept where the English has it. |
| arc | арка | Community word (« арка Элбафа »). |
| episode | эпизод (m.); short form **эп.** | Shikimori uses *эпизоды* / *эп.* « Эп. 5 » at the start of a label, « эп. 5 » mid-line, « 12 эп. » for counts (abbreviation valid for any number). *Серия* avoided (clash with *series*). |
| list | список | « твой список », « твои списки »: the AniList / MAL tracking list. |
| entry | карточка (f.) | The anime's page on AniList / MAL, like FR *fiche* (Russian film databases say « карточка фильма »). « Открыть карточку на AniList », « Карточка AniList не найдена ». Not *запись* (record) nor *страница* (clashes with the web page / « На этой странице »). Keep « нет карточки » (no entry on the service, e.g. `sync.noServiceFollows`: « Ни на одном подключённом сервисе нет карточки этого аниме ») distinct from « нет в твоём списке » (the entry exists but is not in the user's list). UI cards of SyncKai itself (the 'To check' card…) are never *карточка*: say *проверка*. |
| sync (noun) | синхронизация | One noun everywhere, no slang clipping (*синк*, *синхра*). Short labels are rephrased instead of abbreviated. |
| to sync / synced / syncing | синхронизировать / синхронизировано / «Синхронизация…» | « Всё синхронизировано », « Синхронизировано », « Эпизод уже синхронизирован ». |
| Auto sync | Автосинхронизация | Same wording in Settings, the in-page toast and the side panel: « Автосинхронизация на паузе ». |
| Stop syncing / Resume syncing / Re-enable | Не синхронизировать / Возобновить синхронизацию / Включить | « Не синхронизировать это аниме » (menu); chips « Синхронизация выключена » / « Синхронизация включена ». |
| to check (`review.*`, `footer.toReview`) | проверить; the card is a *проверка* | Section and chips « Проверить (2) », « Проверить ↑ »; fragments « 3 на проверку », « уже на проверке », « 2 ждут проверки »; « Создать 3 проверки ». Means verify, never a critique (*рецензия*, *отзыв*). |
| to rate | оценить | Section « Оценить (2) », footer « 2 аниме ждут оценки », « Оцени его во вкладке «Активность» ». |
| score, rating | оценка | « Оценка 8,5/10 сохранена », « Твоя оценка? » (quoted identically in Settings), chip « Оценка AL 8 · MAL 7 ». |
| comment (`notes.*`) | комментарий | The private text of the list entry (AniList Notes / MAL Comments). Never *оценка*. |
| match, mapping (`match.*`, Settings › Matches) | сопоставление | « Сопоставления » (section), « Забыть все сопоставления? », « Неточное сопоставление », aria « Забыть сопоставление: One Piece · S2 » (never a bare « Забыть: … », which reads as forgetting the series). The remembered count reads « 12 аниме в памяти ». On the welcome screen, for newcomers, matching is described as *распознавание* (« Рекомендуется для распознавания аниме », echoing « SyncKai распознаёт аниме »). |
| match / align (AniList ↔ MAL, `compare.*`) | выровнять, выравнивание | Copying one service's values to the other (FR *aligner*): « Всё как в AniList », « По фильтру как в AniList », « Выровнять 12 аниме по AniList? », « Выравнивание завершено ». The comparison itself is *сравнение* (« Сравнить », « Сравнение списков… », « Сравнено 5 мин назад »); *анализ* is reserved for the history import. |
| excluded series | исключённое аниме | Section « Исключённые аниме », chip « Исключено », « Аниме исключено из синхронизации ». |
| pending sync, queue | синхронизация в очереди | Footer « 2 синхронизации в очереди », section « В очереди (2) », action « Отменить » (abandon), status « Сбой — повторы прекращены ». |
| credits | титры (финальные титры) | « В начале финальных титров (рекомендуется) », « Синхронизация на титрах », summary « на титрах ». Not *эндинг* (that is the song). |
| popup | окно расширения | The window opened from the SyncKai toolbar icon: « в окне расширения ». Not *попап* (slang) nor *всплывающее окно* (sounds like an ad). |
| side panel | боковая панель | Chrome's and Firefox's own Russian term (Firefox: « Показать/скрыть боковую панель »). |
| Now playing (panel tab) | Сейчас идёт | TV-guide wording, 11 characters; quoted « «Сейчас идёт» ». |
| Schedule (panel tab, `agenda.*`) | Расписание | Also the settings section and the category « Уведомления и расписание »; quoted « вкладкой «Расписание» ». |
| On this page | На этой странице | |
| preferred player | предпочитаемый плеер | Russian anime fans pick a *плеер* (video source) on streaming sites, so « плеер » for the platform reads naturally. |
| history import (`crImport.*`) | импорт истории просмотров | Title « Импорт истории просмотров »; the running steps are *чтение* (reading), *анализ* (analysis), *импорт* (writing). |
| backup (`backup.*`, `import.*`) | резервная копия | Never *импорт истории*. The Backup page sections are « Экспорт » / « Импорт »; file name `synckai-резервная-копия-{date}.json`. |
| preview (import) | предпросмотр | « Предпросмотр перед импортом ». |
| rewatch | пересмотр | « Пересмотр не сохранён », « Начинаем пересмотр… », « Пересматриваешь «{title}»? » / « Да, пересматриваю ». |
| account / connect / sign in / disconnect | аккаунт / подключить / войти / отключить | « Подключить AniList », « Не подключён », « Переподключить », « Отключить ». Sign-in failures use *вход*, never *авторизация*: « Вход отменён », « Не удалось завершить вход », « Ошибка входа: {message} ». « No account connected » is always « Нет подключённых аккаунтов » (footer, Settings, side panel). |
| session expired | сессия истекла | « Сессия AniList истекла. Войди снова. » |
| release alerts | оповещения о выходе | Browser notifications for new episodes; summaries « оповещения +3 ч », « оповещения выкл. », « оповещения сразу ». |
| alerts only (on-page level) | Только важное | A message that needs action (*важные сообщения*), distinct from release alerts. |
| release / airing / broadcast | выход / эфир | « Ближайший выход », « эфир в Японии », « 1 час после эфира ». AniList airing status of the anime: *Онгоинг* (releasing), *Вышло* (finished), *Анонс* (not yet released), *Перерыв* (hiatus), *Отменено* (cancelled): Shikimori's wording. Chip « Вышло полностью » = series finished airing. |
| offset, delay | задержка (Schedule delay); сдвиг (match offset) | « Задержка для {title} », « номер на платформе, сдвиг 24 ». |
| shortcut | горячая клавиша | Firefox's own Russian term (« Управление горячими клавишами расширений », mozilla-l10n `ru/toolkit/toolkit/about/aboutAddons.ftl` › `addon-manage-extensions-shortcuts`, verified 2026-10-14). « Не назначена », « Назначить », « Изменить ». The Shift key stays « Shift » (printed in Latin on Russian keyboards). |
| title (of a work) | название | « 312 названий », « Название пропущено » (a Netflix title that is not an anime); anime titles inside sentences go in «ёлочки». |

## 2. Settings and its categories

| English | Russian |
|---|---|
| Settings (`nav.settings`) | Настройки |
| Quick settings | Быстрые настройки |
| Playback & alerts / Data & help (home groups) | Просмотр и оповещения / Данные и помощь |
| Playback & sync (`settings.cat.sync`) | Просмотр и синхронизация |
| Settings categories of the 2026-10-17 redesign: Platforms / Notifications (`settings.cat.notifications`, one word: the Schedule options moved to Platforms) / Display; Playback & sync (`settings.cat.sync`) was removed | **Платформы** / **Уведомления** / **Отображение** |
| Shortcuts | Горячие клавиши |
| My data | Мои данные |
| Help & about | Помощь и информация |
| Accounts / Language | Аккаунты / Язык |
| Sections: Playback, Sync, Side panel, New episodes, Schedule, On-page notifications | Просмотр, Синхронизация, Боковая панель, Новые эпизоды, Расписание, Уведомления на странице |
| Sections: Matches, Excluded series, Import, Backup, Danger zone, Help, About | Сопоставления, Исключённые аниме, Импорт, Резервная копия, Опасная зона, Помощь, О расширении |

Paths keep ` › ` and the exact labels: « Настройки › Просмотр и синхронизация », « Настройки › Исключённые аниме », « Настройки › Помощь › Копировать отчёт диагностики ». In a sentence a path or screen name is introduced by « в разделе » so it stays in the nominative: « в разделе Настройки › Исключённые аниме », « в разделе «Настройки» ».

## 3. Conventions

- **Register**: *ты*, friendly and direct (« Попробуй ещё раз », « Подключи AniList »). No second-person past tense (gendered in Russian: *вошёл/вошла*); use present, future, imperative or impersonal forms (« Если ты изменишь клавишу, она сохранится и после обновлений », « если вход уже выполнен »), and avoid stilted participles with *тобой* (« Изменённая тобой клавиша »).
- **Infinitive clauses**: in « …, чтобы + infinitive » the infinitive's subject is the user (the subject of the imperative). When SyncKai does the action, use a noun (« разреши его для чтения истории ») rather than « разреши его, чтобы прочитать твою историю » (*твою* betrays that someone else reads it).
- **Buttons**: infinitive (« Сохранить », « Подключить », « Повторить »), except the standard noun buttons « Отмена », « Экспорт », « Импорт… ».
- **Progress states**: a noun with « … » (« Загрузка… », « Синхронизация… », « Сравнение списков… »); waiting states in the friendly first person plural (« Ждём вкладку Netflix… », « Ждём плеер… »).
- **Quotation marks**: «ёлочки»; nested „лапки“. UI names, statuses used as list names and work titles inside sentences are quoted, also in labels and aria-labels where the title is part of the phrase (« Задержка для «{title}» », « Не синхронизировать «{title}» », « Оценить «{title}» »). Label-colon forms (« Действия: {title} », « Комментарий: {title} ») and ` · ` / `{title}: …` compositions take no quotes.
- **Colon / spacing**: no space before « : », « ? », « ! ». Percent with a space, as CLDR formats it: « 85 % ». Em dash with spaces « — ».
- **Ellipsis**: the single character « … ».
- **Letter ё**: always written (*ещё, всё, отключён, исключённые*), except inside a quoted site label that is spelled with *е* (Netflix « Показать еще »).
- **Abbreviations**: *эп.* (episode), *мин* (minutes), *ч* (hours), *с* (seconds), *дн.* (days), *МБ*, *№*; unit symbols without a period as in GOST (« 5 мин », « 2 ч », « 45 с »), except *дн.* and *эп.*
- **Plurals**: `_one` (1, 21, 31, 101…), `_few` (2–4, 22–24…), `_many` (0, 5–20, 25–30, 11–14, 100…), `_other` (fractions only: genitive singular, « 1,5 эпизода »). When a sentence would need agreement that the text cannot provide (no plural variants, or a number in a separate column), use a label-value form: « Чтение истории: страниц — 3, эпизодов — 287… », « Просмотрено эпизодов: 5 из 12 », « Анализ: сезоны 12 / 48 ».
- **`{service}: {message}`**: « AniList: эпизод 5 сохранён » — the fragments start in lowercase and have no final period.
- **`{title}: completed`**: « Frieren: просмотрено » (neuter, agrees with the implied *аниме*, not with the title).
- **Relative times** fit after a label or a participle: « Последняя проверка: 5 мин назад », « Сравнено вчера », « Просмотрено 3 дня назад », « Следующая попытка через 2 ч ».
- **New-episode check line** (`airing.*`, built as « Последняя проверка: {relative} · {fragment} »): fragments are lowercase and agree with *проверка*; a failure reads « не удалась: {error} » (never « ошибка: Неизвестная ошибка »).
- **Homogeneous predicates** keep one form: « неполная или повреждённая » (both long), never « неполная или повреждена ».
- **Platform names** after prepositions stay invariable: « на Crunchyroll », « к ADN », « вкладка Netflix ».

## 4. Netflix

- « Show more » button of netflix.com/viewingactivity: **Показать еще** (spelled with *е*, as quoted in Netflix's Russian help article *Как увидеть историю просмотра и активность устройств*, help.netflix.com/ru/node/101917: « нажмите кнопку Показать еще »). Code that matches the label should also accept « Показать ещё ».
- « Viewing activity » page: **История просмотра** (name of the profile section in the same Russian help article).
- Both names re-checked against help.netflix.com/ru/node/101917 on 2026-10-14 (button « Показать еще », section « История просмотра »).

## Development builds only

Settings › Help & about sections that exist only in development builds (2026-10-15, `settings.debugTrace.*`).

| English | Term |
|---|---|
| debug trace | отладочная трассировка |
| event (one line of the trace) | событие |
| verbose mode | подробный режим |

## Settings › Sync (2026-10-17)

| English | Term |
|---|---|
| Automatic (Sync section) | Автоматически |
| Per series (Sync section) | По аниме |
| Never synced (Excluded series section) | Никогда не синхронизируются |
| Match origins: chosen / learned / legacy / imported · to recheck | Выбрано тобой / Найдено / Старое / Импортировано · проверить |

## Settings › Platforms and Notifications (2026-10-17)

| English | Term |
|---|---|
| Where SyncKai follows your episodes (section) | Где SyncKai отслеживает эпизоды |
| Included (built-in platform) | Встроено |
| Access missing | Нет доступа |
| Turn on first (preferred player option) | Сначала включи |
| Estimated release time | Примерное время выхода |
| Extra delay (release alerts) | Запас времени |
| On the playback page (Notifications section) | На странице просмотра |

## Settings › My data and Help & about (2026-10-17)

| English | Term |
|---|---|
| Compare (My data section) | Сравнение |
| AniList ↔ MyAnimeList differences (row title) | Расхождения AniList ↔ MyAnimeList |
| Align (differences section) | Выравнивание |
| Diagnostic report (row title) | Отчёт диагностики |
| Copy the report (button) | Копировать отчёт |
| What's new (About link) | Что нового |
| Privacy (About link) | Конфиденциальность |
