# Ukrainian (`uk`) review log

Independent native review of `src/i18n/locales/uk.json` (934 keys, 1046 strings with the `_one` / `_few` / `_many` / `_other` variants) and `public/_locales/uk/messages.json`, 2026-10-14. Inputs: `docs/i18n/GLOSSARY.md`, `docs/i18n/glossary/uk.md`, `docs/i18n/context.json`, `en.json`, `fr.json`, `de.json`.

Method: terminology audit (every core term searched across the catalog, every quoted UI label and every `Налаштування › …` path checked against the key it names), key-by-key reading of all 934 keys with their context notes (meaning, grammar, case government, register, placeholders, composed texts such as `{service}: {message}` and the lowercased fragments, lengths), then a second reading of the Ukrainian alone for naturalness. Plurals rendered with `Intl.PluralRules('uk')` for 0, 1, 2, 3, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111, 112 and 1.5: all 56 plural keys correct. Scans: apostrophe (only U+2019), quotes («» only), ellipsis, dashes, colon spacing, mixed Latin/Cyrillic letters, formal «Ви», gendered past tense addressing the user (none), Russianisms (*за замовчуванням*, *співпадати*, *являтися*, comparative + genitive, *так як*, *в залежності*…), and every use of «запис» (reserved for the AniList/MAL entry).

External names re-checked: Firefox «Керувати комбінаціями клавіш розширень» (mozilla-l10n `firefox-l10n/uk/toolkit/toolkit/about/aboutAddons.ftl`), Netflix «Переглянуте» (Viewing activity) and «Показати більше» (Show more) (help.netflix.com/uk/node/101917), Hikka's list statuses (`hikka-io/hikka-next`, `apps/web/src/utils/labels/enum-labels.ts`).

Result: 41 strings changed in `uk.json` (38 keys, `crImport.preview.excluded` counts its 4 plural forms), `messages.json` unchanged (`extDescription` 78 characters, natural; both command texts identical to `settings.shortcuts.episode` / `settings.shortcuts.panel`). `npm run i18n:check -- uk`: 0 errors, 65 length warnings (see below).

## Changes

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `agenda.estimate.title` | Орієнтовний вихід на {platform}: показ у Японії {offset}. Регулюється в Налаштуваннях або через «Змінити час». | Орієнтовний вихід на {platform}: показ у Японії {offset}. Можна змінити в Налаштуваннях або через «Змінити час». | style | «Регулюється» sounds technical (a device setting); «Можна змінити» is the usual UI wording for 'Adjustable' |
| `airing.notification.message` | Показано в Японії · на Crunchyroll/ADN зазвичай за кілька годин | Показано в Японії · на Crunchyroll/ADN зазвичай виходить за кілька годин | grammar | The second half had no verb ('arrives'): added «виходить» (same root as the release term «вихід»; 72 chars, EN 71) |
| `airing.status.never` | Ще не перевірялося | Ще не перевірено | style | Reflexive passive in -ся is clumsy here; impersonal -но form matches the other status lines |
| `auth.exchangeFailed.mal` | MyAnimeList відмовився завершити вхід (код прострочено або App Redirect URL не збігається). Спробуй ще раз і перевір, що App Redirect URL має значення: {url} | MyAnimeList відмовився завершити вхід (термін дії коду минув або App Redirect URL не збігається). Спробуй ще раз і перевір, що App Redirect URL має значення: {url} | style | «прострочено» is said of deadlines and payments; an expired code is «термін дії коду минув» |
| `compare.keepAria` | {title}: лишити {source} (запис у {target}) | {title}: лишити {source} (записує в {target}) | terminology | «запис» is the reserved term for an AniList/MAL entry; here it meant 'writing', so the screen reader heard 'entry in MyAnimeList'. Verb form as in EN 'writes to' |
| `compare.skip.noScore` | Немає оцінки на {service}: наявну оцінку збережено. | Немає оцінки на {service}: наявна оцінка залишиться. | meaning | «наявну оцінку збережено» reads as 'the existing score was saved (written)'; the meaning is that it is kept untouched |
| `crImport.connect.access` | SyncKai більше не має доступу до {platform}: надай його, щоб прочитати твою історію. | SyncKai більше не має доступу до {platform}: дозволь йому прочитати твою історію. | grammar | «щоб прочитати твою історію» made the user the reader of their own history («твою» cannot refer to the subject); EN 'allow it to read your history' |
| `crImport.connect.netflixAccess` | Netflix — необов’язкова платформа: надай доступ до netflix.com, щоб прочитати твою історію. Також увімкнеться синхронізація під час перегляду на Netflix (її можна вимкнути в Налаштуваннях). | Netflix — необов’язкова платформа: надай доступ до netflix.com, щоб SyncKai прочитав твою історію. Також увімкнеться синхронізація під час перегляду на Netflix (її можна вимкнути в Налаштуваннях). | grammar | Same subject problem as crImport.connect.access: SyncKai reads the history, not the user |
| `crImport.netflix.keepTab` | Не закривай вкладку Netflix зі сторінкою історії переглядів: читання може тривати кілька хвилин. | Не закривай вкладку Netflix зі сторінкою «Переглянуте»: читання може тривати кілька хвилин. | cross-reference | Netflix's own Ukrainian page name, as the note asks |
| `crImport.netflix.rule` | Netflix: SyncKai завантажує історію кнопкою «Показати більше» на сторінці історії переглядів (більше нічого не натискає), залишає аніме, знайдені на AniList, і читає їхній прогрес. | Netflix: SyncKai завантажує історію кнопкою «Показати більше» на сторінці «Переглянуте» (більше нічого не натискає), відбирає аніме, знайдені на AniList, і читає їхній прогрес. | cross-reference | Netflix's Ukrainian page name «Переглянуте» (button «Показати більше» confirmed); «залишає» was ambiguous (keeps / leaves aside), «відбирає» = selects |
| `crImport.preview.excluded_few` | {count} виключені | {count} виключено | consistency | Same as _one |
| `crImport.preview.excluded_many` | {count} виключених | {count} виключено | consistency | Same as _one |
| `crImport.preview.excluded_one` | {count} виключений | {count} виключено | consistency | The masculine adjective implied «сезон» but read as dangling; the sibling fragments of the same ' · ' line use impersonal participles («пропущено», «не знайдено») |
| `crImport.preview.excluded_other` | {count} виключеного | {count} виключено | consistency | Same as _one |
| `crImport.read.error.adnLoggedOut` | Відкрий ADN у цій вкладці й увійди (якщо вхід уже виконано — перезавантаж сторінку), а потім прочитай історію знову. | Відкрий ADN у тій вкладці й увійди (якщо вхід уже виконано — перезавантаж сторінку), а потім прочитай історію знову. | meaning | Same as logged-out: the ADN tab, not the import page |
| `crImport.read.error.logged-out` | Увійди в {platform} у цій вкладці, а потім прочитай історію знову. | Увійди в {platform} у тій вкладці, а потім прочитай історію знову. | meaning | Shown on the import page: «у цій вкладці» points to the import tab itself; the platform tab is «та вкладка» (EN 'that tab') |
| `crImport.read.error.netflixLoggedOut` | Увійди в Netflix у цій вкладці й вибери профіль, потім знову відкрий сторінку історії переглядів і прочитай історію ще раз. | Увійди в Netflix у тій вкладці й вибери профіль, потім знову відкрий сторінку «Переглянуте» й прочитай історію ще раз. | cross-reference | Netflix's own Ukrainian name of the Viewing activity page is «Переглянуте» (help.netflix.com/uk/node/101917), as the note asks; also «у тій вкладці» (the Netflix tab) |
| `crImport.read.error.wrong-page` | Відкрий {site} у цій вкладці. | Відкрий {site} у тій вкладці. | meaning | The error box sits on the import page next to 'Show the tab': the address must be opened in the platform tab, not here |
| `crImport.review.help` | Неточна відповідність: нічого не записано. Створи перевірки, щоб вибрати запис у спливному вікні, на вкладці «Активність». | Непевна відповідність: нічого не записано. Створи перевірки, щоб вибрати запис у спливному вікні, на вкладці «Активність». | meaning | 'Uncertain' is «непевна»; «неточна» means 'inaccurate' |
| `crImport.rule.preview` | Попередній перегляд перед імпортом; якщо є сумнів, сезон іде на перевірку. | Попередній перегляд перед імпортом; у разі сумніву сезон іде на перевірку. | style | Idiomatic «у разі сумніву» ('when in doubt') |
| `error.unexpectedRewatch` | Неочікувана помилка під час початку повторного перегляду. | Неочікувана помилка під час запуску повторного перегляду. | style | «під час початку» is clumsy; «під час запуску» is the natural phrasing |
| `import.intro` | Налаштування, відповідності, виключені аніме та історія. Твої дані входу AniList/MAL ніколи не включаються. | Налаштування, відповідності, виключені аніме та історія. Твої дані входу AniList/MAL туди ніколи не потрапляють. | style | «не включаються» is ambiguous (also 'are not switched on'); natural «туди ніколи не потрапляють» |
| `import.summary.included` | включено | наявні | style | Next to the row «налаштування», «включено» reads as 'switched on'; «наявні» pairs with the opposite value «відсутні» and agrees with the plural |
| `inline.partial` | {text} · не вдалося на {services} | {text} · помилка на {services} | grammar | «не вдалося» needs an infinitive; elliptical «не вдалося на MyAnimeList» sounds broken. «помилка на» also fits removals and status changes |
| `inline.ratingFailedOn` | Не вдалося на {services}, спробуй ще раз | Помилка на {services}, спробуй ще раз | grammar | Same construction as inline.partial |
| `panel.nowPlaying.relations` | Сиквели та пов’язані | Сиквели та пов’язане | grammar | The plural adjective «пов’язані» lacked its noun; the neuter collective «пов’язане» is the heading Ukrainian trackers use (Hikka) |
| `popup.hostAccessDenied` | Доступ заборонено: SyncKai не може відстежувати твої епізоди на цих сайтах. | Доступ не надано: SyncKai не може відстежувати твої епізоди на цих сайтах. | meaning | The user declined the permission prompt; «заборонено» means 'forbidden' (by an authority) |
| `queue.sessionClosed` | Синхронізація для акаунта, з якого відтоді вийшли: видалено, нічого не записано. | Синхронізація акаунта, з якого відтоді вийшли: її видалено, нічого не записано. | grammar | «видалено» had no object after the colon; «її видалено» refers back to the sync |
| `review.format.tvShort` | Короткий TV | Короткий TV-серіал | style | An adjective agreeing with a bare Latin abbreviation is unnatural; «TV-серіал» is the format name Ukrainian trackers use |
| `review.invalidEpisode` | Неправильний епізод | Недійсний номер епізоду | meaning | The error is about the typed number; «Неправильний епізод» reads as 'wrong episode'. Same adjective as sync.invalidEpisode («недійсний») |
| `review.invalidMin` | Введи число не менше 1. | Введи число не менше ніж 1. | grammar | Comparative + genitive («не менше 1» = «одного») is a Russian construction; Ukrainian uses «ніж» / «за» |
| `settings.disney.denied` | Доступ до disneyplus.com заборонено: Disney+ лишається вимкненим | Доступ до disneyplus.com не надано: Disney+ лишається вимкненим | meaning | Same as popup.hostAccessDenied |
| `settings.disney.disabled` | Disney+ вимкнено: перезавантаж відкриті вкладки Disney+, щоб зупинити його повністю | Disney+ вимкнено: перезавантаж відкриті вкладки Disney+, щоб повністю зупинити відстеження | meaning | Same as settings.netflix.disabled |
| `settings.entry.help` | Відкривається кліком на назву чи обкладинку аніме, коли підключено обидва акаунти | Відкривається натисканням на назву чи обкладинку аніме, коли підключено обидва акаунти | style | Slang «кліком на» → «натисканням на», consistent with «Натисни значок SyncKai» elsewhere |
| `settings.entry.label` | Запис за замовчуванням | Типова сторінка запису | terminology | «за замовчуванням» is a calque of Russian «по умолчанию»; the catalog already uses «Типово» for Default (agenda.adjust.reset), as Mozilla Ukrainian does. 'entry page' kept |
| `settings.help.copyTitle` | Версія, браузер, налаштування й останні помилки. Без токенів і назв акаунтів. | Версія, браузер, налаштування й останні помилки. Без токенів та імен акаунтів. | style | Account (user) names are «імена», not «назви» |
| `settings.help.reportTitle` | Відкриває заповнене повідомлення про помилку на GitHub | Відкриває попередньо заповнене повідомлення про помилку на GitHub | meaning | 'prefilled' = «попередньо заповнене»; «заповнене» suggests a complete, ready-to-send report |
| `settings.netflix.denied` | Доступ до netflix.com заборонено: Netflix лишається вимкненим | Доступ до netflix.com не надано: Netflix лишається вимкненим | meaning | Same as popup.hostAccessDenied: the user refused the prompt |
| `settings.netflix.disabled` | Netflix вимкнено: перезавантаж відкриті вкладки Netflix, щоб зупинити його повністю | Netflix вимкнено: перезавантаж відкриті вкладки Netflix, щоб повністю зупинити відстеження | meaning | «зупинити його» read as 'stop Netflix' (the video); what stops is SyncKai's tracking |
| `settings.shortcut.manualFirefox` | Щоб змінити її: about:addons › значок шестерні › Керувати клавіатурними скороченнями розширень. | Щоб змінити її: about:addons › значок шестерні › Керувати комбінаціями клавіш розширень. | cross-reference | Firefox's actual Ukrainian menu item is «Керувати комбінаціями клавіш розширень» (mozilla-l10n uk aboutAddons.ftl, addon-manage-extensions-shortcuts) |
| `settings.summary.shortcutsNone` | Клавіші не задано | Комбінацій не задано | terminology | 'shortcut' = «комбінація клавіш» everywhere else (row title «Комбінації клавіш», «Не задано»); «клавіші» = keys |

Per category: meaning 12, style 10, grammar 8, cross-reference 4, consistency 4 (one key, 4 plural forms), terminology 3 (41 strings, 38 keys).

## Term sheet changes (`docs/i18n/glossary/uk.md`)

- List statuses: checked against Hikka's own labels (Заплановано / Дивлюсь / Завершено / Відкладено / Закинуто); recorded why SyncKai keeps «Переглянуто» for Completed (Hikka's «Завершено» is also the airing status "Finished", and both appear on the same card) and the written form «Дивлюся».
- New rows: Default = «Типово» / «типовий» (never «за замовчуванням»); Access denied after the user refused the prompt = «доступ не надано»; failed on {services} = «помилка на {services}»; TV short = «Короткий TV-серіал»; no shortcut set = «Комбінацій не задано».
- New conventions: impersonal participles in the import preview line («2 виключено»); «у тій вкладці» for the platform tab seen from the import page; «щоб + infinitive» only when the user acts («дозволь йому прочитати…»); «не менше ніж 1» (no comparative + genitive); «запис» only for entries (verb «записує» for writing); backup summary values «наявні» / «відсутні».
- Firefox: «Керувати комбінаціями клавіш розширень» verified (was the unverified guess «Керувати клавіатурними скороченнями розширень»).
- Netflix: Viewing activity = «Переглянуте», Show more = «Показати більше», Download all = «Завантажити все», with the source (was "unknown" / described page).

## Length warnings (`i18n:check`)

The 65 warnings flag English texts of 24 characters or fewer translated more than 1.6× longer (Ukrainian words are long: *синхронізація*, *налаштування*). Checked against the explicit limits of the context notes: all fit except these, kept on purpose because they exceed by 1–2 characters, like French or German:

- `airing.notification.message` (72 for ≈ 70; English 71): system notification body, wraps.
- `common.stopSync` «Не синхронізувати» (17 for ~16; French 20).
- `common.syncing` «Синхронізація…» (14 for ~12; French 16).
- `footer.queuePending_*` «1 синхронізація в черзі» (23 for ≈ 22 with one digit; German is longer).
- `page.addPlanning` «Додати в «Заплановано»» (22 for ~20, truncated by design; the status name must stay whole).

## Debatable, left unchanged

- `compare.bulk.*` «Усе як на AniList», «Фільтр як на MAL»: verbless buttons, but short and transparent (German does the same, *Alle wie AniList*); a verb form («Узгодити фільтр з AniList») exceeds 24 characters.
- `page.action.COMPLETED` «Завершити»: the ≤ 10-character action next to «Відкласти» / «Закинути»; «Переглянуто» is 11 and is a state, not an action. Its tooltip and confirmation use «Позначити переглянутим» / «Переглянуто?».
- `page.airing.HIATUS` «Перерва» and `page.airing.CANCELLED` «Скасовано»: Hikka says «Призупинено» / «Припинено»; both pairs are natural, the current ones are shorter and never clash with the user's «Відкладено».
- «Перевірити» as a section and status label (`review.title`, `crImport.review.title`, `inline.toCheck`, `panel.live.review`, `recent.pending`): works like a to-do heading («Зробити»); in the side panel status line «Потрібна перевірка» would read more like a state, but the notes require the same wording as the section.
- `agenda.adjust.reset` «Типово»: Mozilla's word for Default, an adverb on a button; «Скинути» (Reset) would be a clearer action but drifts from the label.
- `popup.excludeFailed` / `popup.includeFailed` «Не виключено, спробуй ще»: colloquial clipping of «спробуй ще раз» to fit a ~25-character chip.
- `engagement.lastEpisode` / `engagement.notCompleted` «…: повторного перегляду немає»: literal "no rewatch"; «повторний перегляд не розпочато» is more explicit but longer for a toast line.
- `panel.nowPlaying.detailsError` «Деталі з AniList недоступні.»: «Деталі» is common in UIs; «Відомості» would be more formal.
- `crImport.review.series` «Аніме» ("Series · episode 12" when the history gives no season): follows the term sheet; «Без сезону» would say more but changes the label.
- `watching.resume` «Продовжити»: infinitive as a card label; «Продовжити перегляд» (Netflix's row title) is clearer but 19 characters for a short label.
- `agenda.jp` «JP {time}» and `watching.sort.title` «Назва (A → Z)»: Latin kept (no established Cyrillic abbreviation for Japan; AniList titles are Latin-script).
- `compare.summary.notComparable` «3 неможливо порівняти»: fronted object of «порівняти», grammatical but terse.
- `settings.panel.tab.last` «Остання» (agrees with «вкладка»): ≤ 12 characters; «Остання відкрита» does not fit.
- `common.reconnectService` «Увійти в {service} знову»: «Знову увійти в {service}» is equally correct; kept parallel to `common.reconnect` «Увійти знову».

## Outside the catalog (code)

- `src/platforms/netflix/tab-op.ts` › `netflixTabOp` recognizes Netflix's "Show more" button by its text among `['voir plus', 'afficher plus', 'show more', 'see more', 'load more', 'mehr anzeigen', 'weitere anzeigen', 'mehr laden']`. A Netflix profile set to Ukrainian shows **«Показати більше»** (help.netflix.com/uk/node/101917), which is not in the list: the Netflix history import would stop after the first ~20 rows (read as a short history). Adding `'показати більше'` (lowercase, as compared) fixes it for Ukrainian; the label depends on the Netflix profile language, not on SyncKai's. Not changed here: outside the files of this review.
- Netflix history rows are split on the episode title in quotes (FR/EN/DE quotes handled); a Ukrainian profile probably uses «…» like French, but this is untested.

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | Зима / Весна / Літо / Осінь | Зима {year} / Весна {year} / Літо {year} / Осінь {year} | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |
| `sync.noServiceFollows` | Жоден підключений сервіс не відстежує це аніме. | Жоден підключений сервіс не має запису цього аніме. | Meaning: shown when no connected service has an entry for the anime (no AniList / MyAnimeList ID), not when none “tracks” it; English, French and German fixed the same way. Term sheet: entry = *запис* |

Code fixes that change how this catalog is displayed:

- The Netflix row parser accepts every quote style, «…» included; the Ukrainian row format itself is still unverified.
- Netflix history import: the “Показати більше” button of a Netflix profile in this language is recognized (label checked by the reviewer on Netflix’s help article 101917 in this language): such an import no longer stops after the first rows as if the history were complete.
- The signed delays of the Schedule tooltips (`agenda.estimate.*`) now use `time.countdown.*`: “+1 год 30 хв”.
- Lists of names in `{services}` and `{titles}` use the language’s own conjunction (`Intl.ListFormat`) instead of “, ”.

Layout (`npm run test:i18n-layout`), fixed in the components without changing the text: `queue.nextAttempt`, `queue.failed` (Activity › pending syncs): the buttons go below the status when it is long; the “–/10” value of the *To rate* stars: “Ignore” goes below the stars when they don’t fit; `page.action.PAUSED`, `page.action.DROPPED`, `page.action.COMPLETED` (side panel at 320 px): the icons are hidden when the side panel is narrow.

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). Same text in every variant (the wording already avoided the noun agreement), `{total}` renamed `{count}`.

| Key | Text |
|---|---|
| `sync.beyondEntry_one` | Епізод {progress} виходить за межі запису ({count} еп.) |
| `sync.beyondEntry_few` | Епізод {progress} виходить за межі запису ({count} еп.) |
| `sync.beyondEntry_many` | Епізод {progress} виходить за межі запису ({count} еп.) |
| `sync.beyondEntry_other` | Епізод {progress} виходить за межі запису ({count} еп.) |

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | Кнопку «Показати більше» не розпізнано мовою твого профілю Netflix: прочитано лише найновіші епізоди. Встанови для цього профілю на Netflix ту саму мову, що й у SyncKai, і прочитай історію ще раз. |

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video (лише аніме) |
| `settings.prime.label` | Синхронізувати на Prime Video |
| `settings.prime.helpOff` | Синхронізуються лише аніме (жанр «аніме» або анімація з японською аудіодоріжкою чи з точною назвою на AniList). Браузер попросить доступ до primevideo.com |
| `settings.prime.helpOn` | SyncKai читає лише те, що сторінка Prime Video вже отримує. У вже відкритій вкладці Prime Video відстеження почнеться з наступного епізоду |
| `settings.prime.denied` | Доступ до primevideo.com не надано: синхронізація на Prime Video лишається вимкненою |
| `settings.prime.disabled` | Prime Video вимкнено: перезавантаж відкриті вкладки Prime Video, щоб повністю зупинити відстеження |
| `settings.prime.error` | Не вдалося змінити доступ до Prime Video, спробуй ще раз |

| Key | Text |
|---|---|
| `onboarding.intro` | Дивись аніме на Crunchyroll або ADN (Netflix, Disney+ і Prime Video — за бажанням): SyncKai оновлює твій список наприкінці кожного епізоду. |
| `watching.tip` | Netflix, Disney+, Prime Video (необов’язково) і бажаний плеєр налаштовуються в розділі {path}. |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | Збігається з даними платформи: {signals} |
| `match.signalsContradict` | Не збігається з даними платформи: {signals} |
| `match.yearRemake` | Ремейк визначено за роком виходу ({year}) |
| `match.signal.year` | рік виходу |
| `match.signal.episodes` | кількість епізодів |
| `match.signal.duration` | тривалість епізодів |
| `match.signal.format` | формат (фільм або серіал) |
| `match.signal.country` | країна виробництва |
| `match.signal.originalTitle` | оригінальна назва |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | Збережена відповідність не збігається з даними платформи: {signals} |

## 2026-10-14 · Matching diagnostic (development builds only)

New keys `settings.matchDiag.*` (Settings › Help & about, section shown only in development builds, never in the published extension): the last 50 AniList matching decisions, a « Copy » button per row (one decision as JSON, for the test corpus) and a « Clear » button. `{count}` follows a label and a colon (no plural form); `JSON` is a format name. Terms from this language's term sheet (match, entry). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.title` | Діагностика відповідностей |
| `settings.matchDiag.text` | Лише у збірках для розробки: останні 50 рішень про відповідність з AniList, від нових до старих, зберігаються до закриття браузера. Скопіюй одне в JSON, щоб додати його до тестового корпусу. |
| `settings.matchDiag.empty` | Ще немає записаних рішень |
| `settings.matchDiag.copy` | Копіювати |
| `settings.matchDiag.copyTitle` | Скопіювати це рішення в JSON |
| `settings.matchDiag.copied` | Скопійовано |
| `settings.matchDiag.copyFailed` | Не вдалося скопіювати рішення. |
| `settings.matchDiag.clear` | Очистити |
| `settings.matchDiag.candidates` | Кандидати: {count} |
| `settings.matchDiag.noEntry` | Немає запису |

## 2026-10-15 · Debug trace (development builds only)

New keys `settings.debugTrace.*` (Settings › Help & about, section shown only in development builds, never in the published extension, below the matching diagnostic): a timeline of what the extension did (pages, service worker, AniList and MyAnimeList requests), a verbose switch, a category filter (category names stay in English: technical identifiers), « Copy trace » (the whole trace as JSON) and the « Clear » button of the matching diagnostic (`settings.matchDiag.clear`, reused). `{count}` and `{max}` follow a label and a colon (no plural form) and arrive formatted for the language; `JSON` is a format name; `service worker` kept as the browser's technical term. New terms added to this language's term sheet (debug trace, event, verbose mode); other terms from it (account). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.debugTrace.title` | Налагоджувальне трасування |
| `settings.debugTrace.text` | Лише у збірках для розробки: хронологія того, що SyncKai робив на сторінках, у service worker і з AniList та MyAnimeList, від нових подій до старих, зберігається до закриття браузера. Токени, cookie та ідентифікатори акаунтів не записуються. Скопіюй усе трасування в JSON, щоб поділитися ним, коли повідомляєш про проблему. |
| `settings.debugTrace.empty` | Поки немає записаних подій |
| `settings.debugTrace.copy` | Копіювати трасування |
| `settings.debugTrace.copied` | Скопійовано |
| `settings.debugTrace.copyFailed` | Не вдалося скопіювати трасування. |
| `settings.debugTrace.verbose` | Докладний режим (усі рядки журналу) |
| `settings.debugTrace.count` | Події: {count} / {max} |
| `settings.debugTrace.allCategories` | Усі категорії |
| `settings.debugTrace.filterAria` | Фільтр подій за категорією |

## 2026-10-16 · Matching diagnostic: Copy all (development builds only)

New keys in the « Matching diagnostic » section (Settings › Help & about, development builds only, never in the published extension, now collapsed by default behind its title): « Copy all » copies every recorded decision as one JSON array, next to « Clear »; its label becomes « Copied » (`settings.matchDiag.copied`, reused) and a failure reuses `settings.matchDiag.copyFailed`. `JSON` is a format name. Same word for « decision » as `settings.matchDiag.copyTitle`, in the plural; other terms from this language's term sheet. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.copyAll` | Копіювати все |
| `settings.matchDiag.copyAllTitle` | Скопіювати всі рішення в JSON |

## 2026-10-16 · Episode guards (« To check » reasons)

New reasons on a « To check » card (`fix/episode-guards`, audit SEC-01): a sync that would jump straight to the last episode from far behind, and episodes reported as finished in a burst, now wait for the user instead of being written. Same « to check » term as `match.otherSeriesExcluded`, same episode wording as `sync.beyondEntry_*`; `{from}` and `{progress}` are episode numbers. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `sync.review.finaleJump` | Одразу останній епізод ({progress}) після епізоду {from}: треба перевірити |
| `sync.review.burst` | Багато епізодів переглянуто за кілька хвилин: треба перевірити |

## 2026-10-17 · Status bar (popup and side panel)

New texts of the status bar shown at the bottom of the popup and, now, of the side panel (`feature/ui-status-bar`): a synced episode or a count of synced episodes under the series title, shown until the user hides it (« Seen, hide », a × button label), and the history import running, ready to confirm and done. Same words as this language's term sheet: « синхронізовано », « аніме » (impersonal participles, as in `compare.result.updated_*`), « епізод » / « Еп. », « імпорт » (« Імпорт завершено » as in `crImport.apply.done`) and « для підтвердження » (from « Підтвердити »); ` · ` and ` / ` kept; `{platform}` is a brand name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `footer.dismiss` | Ясно, сховати |
| `footer.importDone_one` | Імпорт завершено · {count} аніме оновлено |
| `footer.importDone_few` | Імпорт завершено · {count} аніме оновлено |
| `footer.importDone_many` | Імпорт завершено · {count} аніме оновлено |
| `footer.importDone_other` | Імпорт завершено · {count} аніме оновлено |
| `footer.importProgress` | Імпорт з {platform} · {done} / {total} |
| `footer.importReady_one` | Імпорт готовий · {count} аніме для підтвердження |
| `footer.importReady_few` | Імпорт готовий · {count} аніме для підтвердження |
| `footer.importReady_many` | Імпорт готовий · {count} аніме для підтвердження |
| `footer.importReady_other` | Імпорт готовий · {count} аніме для підтвердження |
| `footer.syncedEpisode` | Еп. {episode} синхронізовано |
| `footer.syncedEpisodes_one` | {count} епізод синхронізовано |
| `footer.syncedEpisodes_few` | {count} епізоди синхронізовано |
| `footer.syncedEpisodes_many` | {count} епізодів синхронізовано |
| `footer.syncedEpisodes_other` | {count} епізоду синхронізовано |

## 2026-10-17 · Account menu (status bar)

New texts of the account menu that opens above the AniList / MyAnimeList logo of the status bar (popup and side panel): the logo button's label (also when the session expired), the connection status line, three stat tiles (anime count, episodes watched, days watched, each number shown above its short label), the « Synced this week » row with its tooltip and value, and « View my profile ». Following this language's term sheet, used **акаунт**, **підключено** (as `settings.account.connected`), **сеанс закінчився** (`common.sessionExpired`), **синхронізовано**, **епізод** with the four plural forms of `footer.syncedEpisodes_*`; *аніме* indeclinable; the days tile label is the genitive noun **перегляду**, valid for every count; « day » is **дн.**, as `time.countdown.days`. ` · ` kept; `{service}` is a brand name, `{name}` the user's AniList / MyAnimeList user name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `accountMenu.connected` | Підключено |
| `accountMenu.connectedAs` | {name} · підключено |
| `accountMenu.label` | Акаунт {service} |
| `accountMenu.labelExpired` | Акаунт {service}, сеанс закінчився |
| `accountMenu.profile` | Відкрити мій профіль |
| `accountMenu.stats.anime_one` | аніме |
| `accountMenu.stats.anime_few` | аніме |
| `accountMenu.stats.anime_many` | аніме |
| `accountMenu.stats.anime_other` | аніме |
| `accountMenu.stats.days_one` | перегляду |
| `accountMenu.stats.days_few` | перегляду |
| `accountMenu.stats.days_many` | перегляду |
| `accountMenu.stats.days_other` | перегляду |
| `accountMenu.stats.daysValue` | {days} дн. |
| `accountMenu.stats.episodes_one` | епізод |
| `accountMenu.stats.episodes_few` | епізоди |
| `accountMenu.stats.episodes_many` | епізодів |
| `accountMenu.stats.episodes_other` | епізоду |
| `accountMenu.week.label` | Синхронізовано за тиждень |
| `accountMenu.week.title` | Епізоди, синхронізовані SyncKai цього тижня |
| `accountMenu.week.value_one` | {count} епізод |
| `accountMenu.week.value_few` | {count} епізоди |
| `accountMenu.week.value_many` | {count} епізодів |
| `accountMenu.week.value_other` | {count} епізоду |

## 2026-10-17 · Settings redesign (Preact): new and changed keys

New texts of the redesigned Settings (Preact): the Platforms and Display categories, the screen-reader names of the back button and of the category card, the row summaries of the Settings home, the Keyboard section of Display, the two sections of Shortcuts, and the section titles and notes of Accounts. Changed: `settings.cat.notifications` (now the single word: the Schedule options moved to Platforms), `settings.summary.connected` (a word instead of ✓), `settings.summary.paused` (now a standalone, capitalised summary), `settings.summary.version` (a word instead of « v »), `settings.entry.help` (the « both accounts connected » condition moved to `settings.entry.unavailable`). Summaries are joined with ` · ` by the code; `settings.account.expiredHelp` and `settings.account.otherStillSynced` are joined as two sentences. The Display summary reuses `settings.section.language`, `settings.section.panel` and `settings.shortcuts.pointer`; the My data summary the history import and backup words; the player summary `settings.player.label`. Platform count « Увімкнено: {count} з {total} » in every plural form. « доки ти не ввійдеш знову » follows `common.reconnect` (*Увійти знову*). Back label « Назад до розділу {page} ». Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.cat.notifications` | Сповіщення |
| `settings.cat.platforms` | Платформи |
| `settings.cat.display` | Відображення |
| `settings.backToAria` | Назад до розділу {page} |
| `settings.group.categories` | Категорії |
| `settings.summary.connected` | {service} підключено |
| `settings.summary.notConnected` | {service} не підключено |
| `settings.summary.bothConnected` | AniList і MyAnimeList підключено |
| `settings.summary.auto` | Автоматично |
| `settings.summary.paused` | На паузі |
| `settings.summary.platforms_one` | Увімкнено: {count} з {total} |
| `settings.summary.platforms_few` | Увімкнено: {count} з {total} |
| `settings.summary.platforms_many` | Увімкнено: {count} з {total} |
| `settings.summary.platforms_other` | Увімкнено: {count} з {total} |
| `settings.summary.player` | плеєр {player} |
| `settings.summary.display` | Мова, бічна панель, комбінації клавіш |
| `settings.summary.data` | Імпорт історії переглядів · резервна копія |
| `settings.summary.version` | Версія {version} |
| `settings.summary.noErrors` | помилок немає |
| `settings.display.keyboard` | Клавіатура |
| `settings.display.shortcutsHelp` | Клавіші, щоб позначити епізод або відкрити панель |
| `settings.shortcuts.duringPlayback` | Під час перегляду |
| `settings.shortcuts.navigation` | Навігація |
| `settings.accounts.lists` | Синхронізовані списки |
| `settings.accounts.both` | З обома акаунтами |
| `settings.accounts.privacy` | Вхід відбувається на сайті AniList або MyAnimeList: SyncKai ніколи не бачить твого пароля. |
| `settings.account.expiredHelp` | Епізоди більше не надсилаються до {service}, доки ти не ввійдеш знову. |
| `settings.account.otherStillSynced` | {service} і далі оновлюється. |
| `settings.entry.help` | Відкривається натисканням на назву чи обкладинку аніме |
| `settings.entry.unavailable` | Доступно, коли підключено і AniList, і MyAnimeList. |

## 2026-10-17 · Settings › Sync, Matches and Excluded series (Preact)

New texts of the redesigned Sync settings page and of its two sub-pages (Matches, Excluded series), moved out of My data: section titles « Automatic » / « Per series », the descriptions of the two « Episode counted as watched » cards, the « Per series » rows, the Matches intro, search, empty and no-result texts, « Show N more on {platform} », the four origin badges and their legend, the Excluded series section, note, empty hint and the « {year} series · excluded on {date} » fragments. Changed: `settings.trigger.legend` (« Episode counted as watched », where the old text was only « Episode watched »), `settings.trigger.credits` (« (recommended) » moved to `settings.trigger.creditsHelp`), and the paths of `popup.syncDisabledDetail` / `review.excludeTitle` (now nav.settings › settings.section.sync › settings.section.exclusions, built from this catalog's own titles). Removed: `settings.mappings.count_*`, `settings.mappings.help`, `settings.mappings.manage`. `{action}` is the « Re-enable » button (`settings.exclusions.help`) or the « Stop syncing this series » menu item (`settings.exclusions.emptyHelp`), so the quoted labels always match. The match / entry / excluded / re-enable words reuse this catalog's existing terms (`settings.section.mappings`, `settings.mappings.entryFallback`, `settings.section.exclusions`, `settings.exclusions.reactivate`). Counts written « Запам’ятовано аніме: {count} » and « Показати ще на {platform} ({count}) » in every plural form (no agreement). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.section.automatic` | Автоматично |
| `settings.section.perSeries` | Для кожного аніме |
| `settings.trigger.legend` | Коли епізод вважається переглянутим |
| `settings.trigger.credits` | На початку титрів |
| `settings.trigger.creditsHelp` | Рекомендовано: точний момент, який повідомляє платформа |
| `settings.trigger.percentageHelp` | Використовується й тоді, коли титри невідомі |
| `settings.sync.mappingsRow` | Збережені відповідності |
| `settings.sync.mappingsRowHelp` | Сезон AniList, вибраний для кожного аніме |
| `settings.sync.exclusionsRowHelp` | Ніколи не синхронізуються, можна відновити тут |
| `settings.mappings.intro_one` | Запам’ятовано аніме: {count}, за платформами: сезон на платформі → запис AniList, у який пише SyncKai. Якщо забути відповідність, її буде визначено заново на наступному епізоді. |
| `settings.mappings.intro_few` | Запам’ятовано аніме: {count}, за платформами: сезон на платформі → запис AniList, у який пише SyncKai. Якщо забути відповідність, її буде визначено заново на наступному епізоді. |
| `settings.mappings.intro_many` | Запам’ятовано аніме: {count}, за платформами: сезон на платформі → запис AniList, у який пише SyncKai. Якщо забути відповідність, її буде визначено заново на наступному епізоді. |
| `settings.mappings.intro_other` | Запам’ятовано аніме: {count}, за платформами: сезон на платформі → запис AniList, у який пише SyncKai. Якщо забути відповідність, її буде визначено заново на наступному епізоді. |
| `settings.mappings.search` | Шукати аніме або запис |
| `settings.mappings.noResult` | Немає відповідностей для «{query}» |
| `settings.mappings.noResultHelp` | Шукай за назвою аніме або запису AniList. |
| `settings.mappings.emptyHelp` | SyncKai запам’ятовує одну для кожного синхронізованого сезону. |
| `settings.mappings.showMore_one` | Показати ще на {platform} ({count}) |
| `settings.mappings.showMore_few` | Показати ще на {platform} ({count}) |
| `settings.mappings.showMore_many` | Показати ще на {platform} ({count}) |
| `settings.mappings.showMore_other` | Показати ще на {platform} ({count}) |
| `settings.mappings.origin.chosen` | Вибрано тобою |
| `settings.mappings.origin.learned` | Знайдено |
| `settings.mappings.origin.unmarked` | Стара |
| `settings.mappings.origin.unverified` | Імпортовано · перевірити |
| `settings.mappings.origin.chosenHelp` | Підтверджено або вибрано тобою: ніколи не переглядається. |
| `settings.mappings.origin.learnedHelp` | Знайдено SyncKai: визначається заново, якщо платформа їй суперечить. |
| `settings.mappings.origin.unmarkedHelp` | Збережено до версії 2.4: лишається, у разі суперечності — на перевірку. |
| `settings.mappings.origin.unverifiedHelp` | З резервної копії: перевіряється заново під час першого використання. |
| `settings.mappings.originLegend` | Походження відповідностей |
| `settings.exclusions.section` | Ніколи не синхронізуються |
| `settings.exclusions.help` | Виключене аніме більше ніколи не синхронізується, у жодному сезоні. «{action}» знову відстежує його з наступного епізоду. |
| `settings.exclusions.emptyHelp` | Щоб більше не синхронізувати аніме, вибери «{action}» у його меню «⋯». |
| `settings.exclusions.seriesYear` | аніме {year} року |
| `settings.exclusions.excludedOn` | виключено {date} |
| `popup.syncDisabledDetail` | Можна відновити: Налаштування › Синхронізація › Виключені аніме |
| `review.excludeTitle` | Виключає аніме (усі сезони): відновити можна в розділі Налаштування › Синхронізація › Виключені аніме |

## 2026-10-17 · Settings › Platforms and Notifications (Preact)

Texts of the redesigned Platforms page (list of sites with « Included » / « Access missing » or a switch, preferred player dropdown, estimated release time per platform with − / + buttons, moved there from the Schedule card) and Notifications page (« On the playback page » style cards and « New episodes »). New: `settings.platforms.where`, `settings.platforms.allAnime`, `settings.platforms.included`, `settings.platforms.accessMissing`, `settings.platforms.note`, `settings.player.openOn`, `settings.player.enableFirst`, `settings.offsets.earlier`, `settings.offsets.later`, `settings.notif.legend`. Changed: `settings.player.help`, `settings.offsets.title`, `settings.offsets.help`, `page.platformOff`, `settings.section.notifications`, `settings.notif.discreet.desc`, `settings.notif.detailed.desc`, `settings.notif.alertsOnly.desc`, `settings.notif.alertsAlways`, `settings.delay.title`, `settings.airing.enableFirst` (the notification descriptions now describe the pill and the bubble, « Extra delay » replaces « Delay », the release-time help says the alerts use it too, « Turn on alerts… » is now visible text). `page.platformOff` keeps its sentence; only the path changed, from « Settings › Playback & sync » to nav.settings › settings.cat.platforms of this catalog. Removed: `settings.section.playback`, `settings.netflix.section`, `settings.netflix.label`, `settings.disney.section`, `settings.disney.label`, `settings.prime.section`, `settings.prime.label`, `settings.airing.label`, `settings.airing.help`, `settings.section.agenda`. The Schedule word, « Open », the release-alert name and the minute unit reuse this catalog's `panel.tab.agenda`, `common.open`, `settings.quick.airing.label` and `settings.offsets.unit`. `settings.delay.title` « Запас часу » (time margin), short enough for the control row. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.platforms.where` | Де SyncKai відстежує твої епізоди |
| `settings.platforms.allAnime` | Усі аніме |
| `settings.platforms.included` | Вбудовано |
| `settings.platforms.accessMissing` | Немає доступу |
| `settings.platforms.note` | Увімкнення платформи запитує доступ до її сайту. Читаються лише сторінки перегляду та сторінки аніме. |
| `settings.player.openOn` | Відкривати епізоди на |
| `settings.player.enableFirst` | Спершу увімкни |
| `settings.player.help` | Використовується кнопкою «Відкрити», коли аніме є на кількох увімкнених платформах. |
| `settings.offsets.title` | Орієнтовний час виходу |
| `settings.offsets.help` | Після показу в Японії. Використовується на вкладці «Розклад» і в сповіщеннях; окреме аніме можна налаштувати в його рядку в «Розкладі». |
| `settings.offsets.earlier` | На {minutes} хв раніше |
| `settings.offsets.later` | На {minutes} хв пізніше |
| `page.platformOff` | {platform} вимкнено: SyncKai тут нічого не відстежує. Щоб увімкнути знову: Налаштування › Платформи. |
| `settings.section.notifications` | На сторінці перегляду |
| `settings.notif.legend` | Стиль сповіщень на сторінці |
| `settings.notif.discreet.desc` | Невелика плашка на кілька секунд у кутку відео |
| `settings.notif.detailed.desc` | Повідомлення з епізодом і результатом на AniList і MyAnimeList |
| `settings.notif.alertsOnly.desc` | Нічого, якщо все гаразд; повідомлення лише при помилці або епізоді, який треба перевірити |
| `settings.notif.alertsAlways` | Помилка або аніме, яке треба перевірити, показуються завжди, за будь-якого стилю. |
| `settings.delay.title` | Запас часу |
| `settings.airing.enableFirst` | Увімкни сповіщення, щоб перевіряти нові епізоди |

## 2026-10-17 · Settings › My data, AniList ↔ MAL differences, Help & about (Preact)

Texts of the redesigned My data page (one « Import a watch history » card, Backup card, « Compare » row opening the AniList ↔ MyAnimeList differences page, which moved there from the popup's Activity screen) and Help & about page (diagnostic report row, error log that unfolds, About card with What's new / Privacy / Source code links). New: `settings.import.title`, `settings.section.compare`, `settings.compare.title`, `settings.compare.help`, `settings.data.perSeries`, `compare.align`, `compare.bulk.help`, `compare.job.background`, `settings.help.diagnostic`, `settings.help.diagnosticHelp`, `settings.help.journalNote`, `settings.about.whatsNew`, `settings.about.privacy`. Changed: `settings.crImport.help`, `settings.backup.help`, `settings.backup.import`, `settings.help.copy`, `settings.about.source` (import help in two sentences, backup help « in one file », « Import » without ellipsis, « Copy the report » next to the new « Diagnostic report » title, « Source code » with « GitHub » on the right). `help.issue.body` keeps its text; only its last-line path changed, to nav.settings › settings.cat.help › settings.help.copy of this catalog. The compare.* texts are unchanged: their context notes now point to Settings › My data. Removed: `settings.section.import`, `settings.backup.crImportTitle`, `settings.crImport.openAria`, `settings.help.text`, `settings.help.copyTitle`, `settings.help.clearHelp`, `settings.help.reportTitle`. The version line reuses `settings.summary.version`, the « Clear » button `settings.matchDiag.clear`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.import.title` | Перенеси вже переглянуте |
| `settings.crImport.help` | Crunchyroll, ADN або Netflix. Перед записом ти побачиш попередній перегляд. |
| `settings.backup.help` | Налаштування, відповідності, виключені аніме та історія в одному файлі. Твої дані входу AniList чи MyAnimeList — ніколи. |
| `settings.backup.import` | Імпорт |
| `settings.section.compare` | Порівняння |
| `settings.compare.title` | Розбіжності AniList ↔ MyAnimeList |
| `settings.compare.help` | Порівнює обидва твої списки й узгоджує їх у вибраний бік |
| `settings.data.perSeries` | Відповідностями та виключеними аніме керуй у розділі {path}. |
| `compare.align` | Узгодження |
| `compare.bulk.help` | «{action}» переносить AniList у MyAnimeList; спершу підтвердження покаже зміни. |
| `compare.job.background` | Триває, навіть якщо закрити цю сторінку. |
| `settings.help.diagnostic` | Діагностичний звіт |
| `settings.help.diagnosticHelp` | Для повідомлення про помилку: версія, браузер, налаштування, останні помилки. Без токенів і акаунтів. |
| `settings.help.copy` | Копіювати звіт |
| `settings.help.journalNote` | Щонайбільше 50 останніх, спершу нові; токени вже приховано. |
| `settings.about.whatsNew` | Що нового |
| `settings.about.privacy` | Конфіденційність |
| `settings.about.source` | Вихідний код |

## 2026-10-17 · Popup « My series » row menu (Preact)

The row « … » menu of the popup's « My series » list and of the « Continue » card now groups the entry links and the platform searches in two sub-menus. New: `watching.menu.openEntry` (sub-menu entry, its items are the bare AniList / MyAnimeList names; wording taken from `page.openOn` without « on {service} »), `watching.menu.searchOn` (sub-menu entry, its items are the bare platform names; wording taken from `watching.searchOn`, ending with « … »). Changed: `settings.entry.help`, which now also says that « Default entry page » picks the list shown in « My series » (quoted with the exact `watching.mySeries` of this catalog). The « −1 episode » item left the menu (the row has its own −), `watching.minusOne` stays for the « On this page » card. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `watching.menu.openEntry` | Відкрити запис |
| `watching.menu.searchOn` | Шукати на… |
| `settings.entry.help` | Відкривається натисканням на назву чи обкладинку аніме; також визначає список у «Мої аніме» |

