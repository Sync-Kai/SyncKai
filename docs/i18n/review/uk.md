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

- `src/shared/netflix-import.ts` › `netflixTabOp` recognizes Netflix's "Show more" button by its text among `['voir plus', 'afficher plus', 'show more', 'see more', 'load more', 'mehr anzeigen', 'weitere anzeigen', 'mehr laden']`. A Netflix profile set to Ukrainian shows **«Показати більше»** (help.netflix.com/uk/node/101917), which is not in the list: the Netflix history import would stop after the first ~20 rows (read as a short history). Adding `'показати більше'` (lowercase, as compared) fixes it for Ukrainian; the label depends on the Netflix profile language, not on SyncKai's. Not changed here: outside the files of this review.
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
