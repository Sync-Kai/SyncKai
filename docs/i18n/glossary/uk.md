# Ukrainian (`uk`) term sheet

Binding for every change to `src/i18n/locales/uk.json` and `public/_locales/uk/messages.json`. Shared rules: `docs/i18n/GLOSSARY.md`.

Target: modern standard Ukrainian (not a calque of Russian), in the friendly tone of consumer apps, as an anime fan talks to another fan. The user is addressed with **ти** (2nd person singular imperatives: «Спробуй ще раз», «Перевір», «Відкрий»). Buttons and menu items use the infinitive («Зберегти», «Скасувати», «Відкрити»). Browser vocabulary follows Chrome and Firefox in Ukrainian: `вкладка` (browser tab and UI tab), `бічна панель`, `розширення`, `значок` (toolbar icon), `перезавантажити` (reload).

## 1. List statuses

AniList and MyAnimeList have no Ukrainian interface. Ukrainian fans know the status names of Ukrainian-language tracker sites (such as Hikka) and their classic mix: first person for what the user is doing now («Дивлюся»), impersonal participles in -но/-то for the state of a title («Заплановано», «Відкладено», «Закинуто»). The impersonal forms never need gender agreement, so «{title}: переглянуто» works with any title.

Checked on 2026-10-14 against Hikka's own labels (`hikka-io/hikka-next`, `utils/labels/enum-labels.ts`): Заплановано / Дивлюсь / Завершено / Відкладено / Закинуто. SyncKai matches them except on purpose for Completed («Переглянуто», because Hikka's «Завершено» is also its airing status "Finished", and both appear on the same SyncKai card) and the written full form «Дивлюся».

| English | Ukrainian | Reason |
|---|---|---|
| Watching (status, tab `nav.watching`) | Дивлюся | What fans say (also seen as the short form «Дивлюсь»; the full form is preferred in writing). 7 characters: fits the tab. Quoted «Дивлюся» when used as a list name («Додати в «Дивлюся»») |
| Completed | Переглянуто | Means the USER watched it all. Deliberately not «Завершено», which is the airing status "Finished" (`page.airing.FINISHED`). Action: «Позначити переглянутим»; compact status button (≤ 10 chars): «Завершити»; confirmation: «Переглянуто?» |
| On hold | Відкладено | Standard tracker term. Action: «Відкласти». The airing hiatus is «Перерва», a paused video is «На паузі» |
| Dropped | Закинуто | Fan term («закинути аніме» = to drop an anime). Action: «Закинути», confirmation «Закинути?». Never reads as «Скасувати» (Cancel) |
| Plan to watch | Заплановано | Standard tracker term. Button: «Додати в «Заплановано»» |
| Rewatching | Передивляюся | Parallel to «Дивлюся»; «передивлятися» is the standard verb for watching again. Not «Переглядаю» («переглядати» also means simply "to watch") |

Airing statuses (`page.airing.*`): Airing «Виходить», Finished «Завершено», On hiatus «Перерва», Upcoming «Анонс» (fan-site term for announced titles), Cancelled «Скасовано». Badge "Series finished" (`watching.badge.finished`) = «Показ завершено» (airing, not the user's status).

## 2. Core terms

| English term | Ukrainian | Reason |
|---|---|---|
| series | аніме (neuter, indeclinable) | The word Ukrainian fans and trackers use for an anime title. «серія» means "episode" in Ukrainian and «серіал» excludes movies/OVA. Indeclinable, so counts never change it: «1 аніме», «3 аніме», «5 аніме»; agreement goes through adjectives/verbs: «виключене аніме», «виключені аніме», «Мої аніме» |
| season | сезон | Standard |
| episode / Ep. | епізод / еп. («Еп.» at the start of a label) | «епізод» is the usual tracker term and has a clear short form; «серія» has none («с.» is unreadable) |
| arc | арка | Fan term |
| list | список | "Your list" = «твій список» |
| entry | запис (gen. запису) | The anime's record on AniList/MAL: «запис AniList», «Відкрити запис на AniList», «вибери запис». Not «сторінка» (clashes with the web page: «На цій сторінці», «Перезавантаж сторінку»), not «картка» (clashes with the UI cards in Activity) |
| sync (noun / verb) | синхронізація / синхронізувати; synced = синхронізовано | One noun, one verb everywhere. Auto sync = «Автосинхронізація» |
| to check (`review.*`, `footer.toReview`) | Перевірити (labels, headings: «Перевірити ({count})»); «на перевірку» in counts; the check card = «перевірка» (Create reviews = «Створити перевірки») | Never «рецензія» (a critique) |
| to rate | Оцінити (heading «Оцінити ({count})»); «для оцінки» in counts («3 аніме для оцінки») | |
| score, rating, stars | оцінка | «Твоя оцінка?», «Оцінку 8,5/10 збережено» |
| comment (`notes.*`) | коментар | Private note on the list entry; never «оцінка» |
| match, mapping (`match.*`, Settings › Matches) | відповідність (pl. відповідності, gen. pl. відповідностей) | The remembered season → AniList entry link. Onboarding "Recommended for matching" (identifying the anime) = «для розпізнавання» |
| match / align (AniList ↔ MAL differences, `compare.*`) | узгодити / узгодження | Different meaning (copy values to the other service), so a different word: «Усе як на AniList», «Узгодження завершено» |
| excluded series | виключене аніме (pl. виключені аніме); exclude = виключити; re-enable / resume syncing = відновити / відновити синхронізацію | Settings section «Виключені аніме» |
| pending sync, queue | синхронізація в черзі; section «Синхронізації в черзі», heading «У черзі ({count})»; Abandon = «Відкинути» | |
| credits | титри | "At the start of the credits" = «На початку титрів»; "at the credits" = «на титрах» |
| popup | спливне вікно | Firefox's Ukrainian term («спливні вікна»); always the window opened from the SyncKai icon |
| side panel | бічна панель | Chrome and Firefox Ukrainian term |
| Now playing (panel tab) | Відтворення | ≤ 12 chars; "Playback position" = «Позиція відтворення». Kept distinct from the settings word «Перегляд» (Playback & sync) |
| Schedule (`panel.tab.agenda`, `agenda.*`) | Розклад | Also in «Сповіщення й розклад» and Settings section «Розклад» |
| On this page | На цій сторінці | |
| Activity (popup tab) | Активність | |
| preferred player | бажаний плеєр | "player" = streaming platform |
| history import | імпорт історії переглядів; title «Імпорт історії переглядів» | "watch history" = «історія переглядів» (YouTube/Netflix wording) |
| backup | резервна копія; page title «Резервна копія» | Never «імпорт»/«історія», which belong to the history import |
| preview | попередній перегляд | |
| rewatch (noun) | повторний перегляд | Verb: «передивлятися» |
| account / connect / sign in / disconnect | акаунт (gen. акаунта) / підключити / увійти / відключити | «акаунт», not «обліковий запис», to keep «запис» for entries. Reconnect (≤ 12 chars) = «Увійти знову». Sign-ins (tokens, in backups) = «дані входу» |
| session expired | сеанс закінчився | «сеанс» as in Google/Microsoft Ukrainian UIs |
| release alerts (`airing.*`, `settings.quick.airing.label`) | сповіщення про вихід | Browser notifications about new episodes. Summaries: «сповіщення +3 год», «без сповіщень», «сповіщення одразу» |
| alert (level "Alerts only", `settings.notif.alertsOnly.*`) | попередження («Лише попередження») | A message that needs action; kept apart from release alerts |
| release, airing | вихід (release on a platform), показ у Японії (Japanese TV broadcast) | "is out" = «вийшов» |
| offset, delay (`agenda.*`, alerts) | затримка | Episode-numbering offset in Settings › Matches (`settings.mappings.offset`) = «зсув» |
| shortcut | комбінація клавіш | Chrome's Ukrainian name of chrome://extensions/shortcuts («Комбінації клавіш») and Firefox's («Керувати комбінаціями клавіш розширень»). No shortcut set = «Комбінацій не задано»; never «клавіші» (keys) for a shortcut |
| Default (button, setting) | Типово / типовий («Типова сторінка запису») | As in Mozilla Ukrainian. Never «за замовчуванням», a calque of Russian «по умолчанию» |
| Access denied (the user refused the browser prompt) | доступ не надано | «заборонено» means forbidden by an authority |
| failed on {services} | помилка на {services} | «не вдалося» needs an infinitive, never «не вдалося на MyAnimeList» |
| TV short (format) | Короткий TV-серіал | «TV-серіал» is the format name Ukrainian trackers use |
| Settings (`nav.settings`) | Налаштування | |
| Ignore (dismiss a card) | Пропустити | It never excludes the series |
| Correct (verb) | Виправити | |
| Retry | Повторити | |
| Reload | перезавантажити | |
| paused (auto sync) / paused (video) | на паузі («Автосинхронізація на паузі») / «На паузі» | Short and natural; the auto-sync status always names auto sync, so it never reads as the video state |
| Allow access | Надати доступ | |
| Report a problem | Повідомити про помилку | Standard phrase, fits ≤ 22 chars |
| Sync failed (title) | Помилка синхронізації | Failed syncs given up on (footer) = «збій синхронізації» |
| absolute numbering | наскрізна нумерація | |
| special (format) / movie | спецвипуск / фільм | |
| up to date | актуально; preview counts use «без змін» | |

## 3. Settings names

| English | Ukrainian |
|---|---|
| Settings home groups: Quick settings / Playback & alerts / Data & help | Швидкі налаштування / Перегляд і сповіщення / Дані й допомога |
| Categories: Playback & sync / Notifications & schedule / Shortcuts / My data / Language / Help & about / Accounts | Перегляд і синхронізація / Сповіщення й розклад / Комбінації клавіш / Мої дані / Мова / Допомога й інформація / Акаунти |
| Settings categories of the 2026-10-17 redesign: Platforms / Notifications (`settings.cat.notifications`, one word: the Schedule options moved to Platforms) / Display; Playback & sync (`settings.cat.sync`) was removed | **Платформи** / **Сповіщення** / **Відображення** |
| Sections: Playback / Sync / Side panel / New episodes / On-page notifications / Schedule / Matches / Excluded series / Backup / Import / Help / About / Danger zone | Перегляд / Синхронізація / Бічна панель / Нові епізоди / Сповіщення на сторінці / Розклад / Відповідності / Виключені аніме / Резервна копія / Імпорт / Допомога / Про розширення / Небезпечна зона |
| Notification levels: Discreet / Detailed / Alerts only | Ненав’язливі / Докладні / Лише попередження (adjectives agree with «сповіщення») |

## 4. Conventions

- **Register**: ти; short, direct, friendly. «Будь ласка» is not used.
- **Quotation marks**: «ялинки», nested „лапки“: «Додати в «Заплановано»» stays with «» because the outer text is not quoted.
- **Colon and spacing**: no space before «:», «?», «!», «%». Percent: «85%» (CLDR `uk`), decimal comma comes from the code («8,5»).
- **Ellipsis**: the single character `…` («Синхронізація…»). **Dash**: « — » with spaces. **Apostrophe**: ’ (U+2019): «з’явиться», «пов’язаний».
- **Abbreviations**: min = «хв», h = «год», d (days) = «дн.», s = «с», episode = «еп.», pages = «стор.», MB = «МБ». No pluralisation needed after them.
- **«{service}: {message}»**: same pattern, no space before the colon; the fragments start in lowercase and are written to follow it: «AniList: епізод 5 збережено · MyAnimeList: помилка: …», «MyAnimeList: уже актуально (епізод 5)». Fragments that the code lowercases («Уже…», «Немає…») read correctly lowercased.
- **«{title}: completed»** = «{title}: переглянуто» (also «{title}: закинуто», «{title}: відкладено»): impersonal participles, no agreement with the title.
- **UI paths**: labels with ` › ` stay in the nominative, after «у розділі» or a colon: «Можна відновити: Налаштування › Виключені аніме», «у розділі Налаштування › Перегляд і синхронізація». A plain mention of the Settings screen inside a sentence is inflected and capitalised («у Налаштуваннях») or put in parentheses («(Налаштування)»). UI tab names are quoted after «вкладка» with «на»: «на вкладці «Активність»», «відкрий вкладку «Дивлюся»»; a browser tab takes «у»: «у вкладці {platform}».
- **Punctuation**: a subordinate clause before a dash keeps its comma («аніме, які ти дивишся, — відкрий…»).
- **Platforms and services**: AniList/MyAnimeList take masculine agreement (сервіс): «AniList недоступний». For {platform} placeholders gendered past forms are avoided («сайт {platform} змінився», «{platform} вимкнено»).
- **Plurals**: `_one` (1, 21, 101…), `_few` (2–4, 22–24…), `_many` (0, 5–20, 25…), `_other` (fractions only, genitive singular: «1,5 епізоду»). Counts of «аніме» use the same text in every form.
- **Counts without plural variants** (`{done} / {total}`, `{pages}`): label before the numbers («Аналіз: сезони 12 / 48») or an abbreviation («{pages} стор., {items} еп.»).
- **Fragments of the import preview line** (`crImport.preview.*`, joined with ` · `) use impersonal participles after the number («2 пропущено», «2 виключено», «2 не знайдено (помилка)»), never an adjective whose implied noun the reader cannot see.
- **"That tab"**: on the import page, the platform tab is «та вкладка» («Увійди в Crunchyroll у тій вкладці»); «ця вкладка» would point to the import page itself.
- **Infinitive clauses**: «щоб + infinitive» only when the user does the action. When SyncKai does it, say so («дозволь йому прочитати твою історію», «щоб SyncKai прочитав твою історію»); «щоб прочитати твою історію» makes the user the reader and clashes with «твою».
- **Comparatives**: «не менше ніж 1», «більший за 5 МБ», never comparative + genitive («не менше 1»), a Russian construction.
- **«запис»** is reserved for an AniList/MAL entry: for the act of writing use the verb («записує в MyAnimeList»).
- **Backup summary values**: «наявні» / «відсутні» (settings present / missing); not «включено», which also reads 'switched on'.

## 5. Browser names quoted in the UI

- Chrome shortcuts page: chrome://extensions/shortcuts («Комбінації клавіш»).
- Firefox gear-menu item "Manage Extension Shortcuts": «Керувати комбінаціями клавіш розширень» (verified 2026-10-14 in mozilla-l10n `firefox-l10n/uk/toolkit/toolkit/about/aboutAddons.ftl`, `addon-manage-extensions-shortcuts`; same text as the page heading `shortcuts-heading`).

## 6. Netflix

Verified 2026-10-14 in Netflix's Ukrainian help (help.netflix.com/uk/node/101917, "Як подивитись історію перегляду й дії на пристрої"):

- "Viewing activity" (profile section, netflix.com/viewingactivity) = «Переглянуте». Quoted as «сторінка «Переглянуте»» / «на сторінці «Переглянуте»».
- "Show more" button = «Показати більше»; "Download all" = «Завантажити все».

## Development builds only

Settings › Help & about sections that exist only in development builds (2026-10-15, `settings.debugTrace.*`).

| English | Term |
|---|---|
| debug trace | налагоджувальне трасування |
| event (one line of the trace) | подія |
| verbose mode | докладний режим |

## Settings › Sync (2026-10-17)

| English | Term |
|---|---|
| Automatic (Sync section) | Автоматично |
| Per series (Sync section) | Для кожного аніме |
| Never synced (Excluded series section) | Ніколи не синхронізуються |
| Match origins: chosen / learned / legacy / imported · to recheck | Вибрано тобою / Знайдено / Стара / Імпортовано · перевірити |

## Settings › Platforms and Notifications (2026-10-17)

| English | Term |
|---|---|
| Where SyncKai follows your episodes (section) | Де SyncKai відстежує твої епізоди |
| Included (built-in platform) | Вбудовано |
| Access missing | Немає доступу |
| Turn on first (preferred player option) | Спершу увімкни |
| Estimated release time | Орієнтовний час виходу |
| Extra delay (release alerts) | Запас часу |
| On the playback page (Notifications section) | На сторінці перегляду |

## Settings › My data and Help & about (2026-10-17)

| English | Term |
|---|---|
| Compare (My data section) | Порівняння |
| AniList ↔ MyAnimeList differences (row title) | Розбіжності AniList ↔ MyAnimeList |
| Align (differences section) | Узгодження |
| Diagnostic report (row title) | Діагностичний звіт |
| Copy the report (button) | Копіювати звіт |
| What's new (About link) | Що нового |
| Privacy (About link) | Конфіденційність |
