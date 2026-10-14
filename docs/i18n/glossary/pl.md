# Polish (`pl`) term sheet

Binding for every change to `src/i18n/locales/pl.json` and `public/_locales/pl/messages.json`. Shared rules: `docs/i18n/GLOSSARY.md`.

Target: standard Polish in the friendly tone of consumer apps (Spotify, Duolingo, Netflix in Polish), as an anime fan talks to another fan. Browser vocabulary follows Chrome and Firefox in Polish (`karta` = browser tab, `panel boczny`, `rozszerzenie`, `skrót klawiszowy`, `odśwież`). The user is addressed with **ty** (2nd person singular, imperatives such as “Spróbuj ponownie”, “Sprawdź”).

## 1. List statuses

AniList and MyAnimeList have no Polish interface. The names below follow the style of Polish anime list sites (such as Shinden) that Polish fans already know: first person for what the user is doing (“Oglądam”, “Planuję”), neuter participles (agreeing with “anime”, neuter) for the state of a title (“Obejrzane”, “Wstrzymane”, “Porzucone”).

| English | Polish | Reason |
|---|---|---|
| Watching (status, tab `nav.watching`) | Oglądam | What fans say; 7 characters, fits the tab. Quoted as „Oglądam” when used as a list name (“Dodaj do „Oglądam””, “otwórz zakładkę „Oglądam””) |
| Completed | Obejrzane (compact button: Obejrzane; action: Oznacz jako obejrzane; question: Obejrzane?) | Means the USER finished it. Kept away from “Zakończone”, which is the airing status (finished airing) |
| On hold | Wstrzymane (compact button: Wstrzymaj; action: Wstrzymaj oglądanie) | Standard tracker term. The airing hiatus uses “Zawieszone”, a paused video uses “Pauza” |
| Dropped | Porzucone (compact button: Porzuć; action: Porzuć serię; question: Porzucić?) | Standard term (“dropnąć” is slang). Never reads as “Anuluj” (Cancel) |
| Plan to watch | Planuję | Parallel to “Oglądam”; quoted as „Planuję” when used as a list name (“Dodaj do „Planuję””) |
| Rewatching | Oglądam ponownie | Parallel to “Oglądam”. The noun “rewatch” is “powtórka” (see below) |

Statuses are neuter, so composed texts use the neuter too: “{title}: obejrzane”, “{title}: porzucone”, “{title}: wstrzymane”, “„{title}” obejrzane!”.

## 2. Core terms

| English term | Polish | Reason |
|---|---|---|
| series | seria (f.), pl. serie, gen. pl. serii | What fans call an anime title (“ta seria ma trzy sezony”). Adjectives agree in the feminine: “Seria wykluczona”, “Wykluczona” (chip) |
| season | sezon (m.) | |
| episode / Ep. | odcinek (m.) / Odc. (mid-line: odc.) | Standard abbreviation, also valid for plurals (“12 odc.”) |
| arc | arc | As Polish One Piece fans say (not used as a key term in the catalog) |
| list | lista | “Twoja lista” = the user's AniList / MyAnimeList list |
| entry | wpis (m.) | The anime's page on AniList / MAL (“Otwórz wpis na AniList”, “Wpis AniList #21”). Not “karta” (= browser tab in Polish browsers) and not “strona” (= web page) |
| sync (noun) | synchronizacja | Standard Polish UI noun (Chrome, Firefox, phones). No anglicism “sync” |
| to sync (verb) | synchronizować / zsynchronizować (participle: zsynchronizowany) | “Nie synchronizuj”, “Wznów synchronizację”, “Zsynchronizowano ✓” |
| Syncing… | Synchronizacja… | |
| Auto sync | Autosynchronizacja | Established compound (Samsung: “Autosynchronizacja danych”); fits the toggle and the 30-character status lines |
| to check (`review.*`, `footer.toReview`) | do sprawdzenia; a check card = “pozycja do sprawdzenia” | Section “Do sprawdzenia ({count})”. Creating cards = “Dodaj … do sprawdzenia”. Never “recenzja” (a critique) |
| to rate (`ratings.*`, `footer.toRate`) | do oceny; verb oceń / ocenić | “Do oceny ({count})”, “Serie do oceny” |
| score, rating, stars | ocena | “Twoja ocena?”, “Zapisano ocenę 8,5/10” |
| comment (`notes.*`) | komentarz | The private note on the list entry; never “ocena” |
| match, mapping (`match.*`, Settings › Matches) | dopasowanie, pl. dopasowania | Remembered link platform season → AniList entry. Section “Dopasowania”; screen-reader label of “Zapomnij”: “Zapomnij o dopasowaniu: {label}” (a bare “Zapomnij: One Piece · S2” sounds like forgetting the series) |
| match / align (AniList ↔ MAL, `compare.*`) | ujednolicić, ujednolicanie; bulk buttons “Wszystko jak na AniList / MAL”, with a filter on “Widoczne jak na AniList / MAL”; “Zachowaj AniList / MAL” | Copying values from one service to the other; a different concept from the remembered match. Results use the neutral “zaktualizowana” (also shown by the history import); failures are counted with the noun “błąd” (“1 błąd · 2 błędy · 5 błędów”), never “nieudana” (“nieudana seria” = a flop). Review 2026-10-14: “Filtr: jak na …” read as a filter label, not as an action on the filtered series |
| excluded series | wykluczona seria; Settings section “Wykluczone serie” | Quoted in paths: “Ustawienia › Wykluczone serie” |
| pending sync, queue (`queue.*`) | oczekująca synchronizacja; section “Oczekujące synchronizacje ({count})” | Footer (tight): “{count} do synchronizacji”, like “{count} do sprawdzenia”; a sync SyncKai gave up on: “błąd synchronizacji” (“{count} błędy synchronizacji”). Footer “Everything is synced” = “Wszystko aktualne”. The “Abandon” action is “Odrzuć” (not “Porzuć”, reserved for Dropped) |
| credits | napisy końcowe | Always with “końcowe”: “napisy” alone means subtitles to Polish anime fans. “Na początku napisów końcowych”, “Przy napisach końcowych”. The live sync points of the side panel drop the word “synchronizacja” (the block is about sync): “Przy napisach końcowych”, “Przy {percent}% odcinka” |
| popup | okienko SyncKai | The window opened from the toolbar icon: “w okienku SyncKai (Aktywność)”. Instructions say “Kliknij ikonę SyncKai” |
| side panel | panel boczny | Chrome's Polish name; also used for the Firefox sidebar |
| Now playing (panel tab) | Odtwarzane | Short form of the standard “Teraz odtwarzane” (Spotify, Windows, Android); 10 characters, fits the 3-option control of Settings (“Ostatnia / Odtwarzane / Kalendarz”). Quoted as „Odtwarzane”. Review 2026-10-14: the first choice “Oglądasz” differed by one letter from the popup tab and status “Oglądam”, for a different screen |
| Schedule (`panel.tab.agenda`, `agenda.*`, `settings.section.agenda`) | Kalendarz | Weekly calendar of new episodes; same word in “Powiadomienia i kalendarz” |
| On this page (`page.*`) | Na tej stronie | |
| preferred player | Domyślna platforma | The streaming platform “Otwórz” opens by default. “Odtwarzacz” would read as a media player app |
| history import (`crImport.*`) | import historii oglądania; verb importować historię | Title “Import historii oglądania”. Never “kopia zapasowa” |
| backup (`settings.backup.*`, `backup.*`, `import.*`) | kopia zapasowa | Page title “Kopia zapasowa” (quoted when named in a sentence: “Otwiera stronę „Kopia zapasowa” w nowej karcie”); file name `synckai-kopia-zapasowa-{date}.json`. The history a backup contains is “historia synchronizacji”, never bare “historia” (it would read as the watch history of the history import) |
| preview (import) | podgląd | |
| rewatch | powtórka (noun); oglądać ponownie (verb) | “Nie zapisano powtórki”, “Oglądasz ponownie „{title}”?”, “Tak, oglądam” |
| account | konto | |
| connect / disconnect | połącz / rozłącz (“Połącz z AniList”, “Połącz ponownie”) | Sign-in / sign-out wording: “zaloguj się”, “wylogowane” |
| session expired | Sesja wygasła | |
| release alerts | Alerty o premierach | Browser notifications for new episodes. Distinct from the on-page level “Tylko ostrzeżenia” (`settings.notif.alertsOnly.*`, warnings that need action) |
| release / airing | premiera (episode released on a platform) / emisja (broadcast in Japan) | “Szacowana premiera”, “Alerty o premierach”, “emisja w Japonii”, airing status “W emisji”. Sort option “Next release” = “Następny odcinek” |
| airing statuses (`page.airing.*`) | W emisji, Zakończone, Zawieszone, Zapowiedziane, Anulowane | Neuter (the anime). “Emisja zakończona” on the series chip (`watching.badge.finished`) |
| offset / delay | przesunięcie / opóźnienie | “przesunięcie o 24”, “Opóźnienie dla {title}” |
| shortcut | skrót klawiszowy | Settings category “Skróty klawiszowe”. The Shift key stays “Shift” (as printed on Polish keyboards) |
| Settings (`nav.settings`) | Ustawienia | Declined in running text (“w Ustawieniach”, “Wróć do Ustawień”, “otwórz Ustawienia”); in paths always the nominative: “Ustawienia › …”. Capitalised whenever it names SyncKai's screen, aria-labels included; lowercase for the browser's settings and for the settings data (“ustawienia przeglądarki”, “Importuj też ustawienia”) |
| tab of the extension UI | zakładka | “zakładka „Oglądam””, “w zakładce Aktywność”. A browser tab is always “karta” |
| Activity (tab `nav.activity`) | Aktywność | |
| absolute numbering | numeracja ciągła | How Polish fans describe One Piece-style numbering |
| Special / OVA / Movie / TV short | Specjalny / OVA / Film / Krótka seria TV | |
| Retry / Ignore (dismiss a card) / Correct / Forget / Re-enable / Stop | Ponów / Pomiń / Popraw / Zapomnij / Przywróć / Zatrzymaj | Button verbs, imperative. “Pomiń” (skip) because the card is dismissed, nothing is excluded. “Resume syncing” = “Wznów synchronizację” |
| Loading… / Reading… | Wczytywanie… / Odczytywanie… | Gerunds for in-progress states (exception kept short: “Zatrzymuję…” for Stopping…) |

### Settings categories and sections

| English | Polish |
|---|---|
| Accounts | Konta |
| Playback & sync | Oglądanie i synchronizacja |
| Notifications & schedule | Powiadomienia i kalendarz |
| Shortcuts | Skróty klawiszowe |
| My data | Moje dane |
| Language | Język |
| Help & about | Pomoc i informacje |
| Quick settings / Playback & alerts / Data & help (groups) | Szybkie ustawienia / Oglądanie i powiadomienia / Dane i pomoc |
| Playback / Sync / Side panel (sections) | Oglądanie / Synchronizacja / Panel boczny |
| New episodes / On-page notifications / Schedule | Nowe odcinki / Powiadomienia na stronie / Kalendarz |
| Matches / Excluded series / Backup / Import / Danger zone | Dopasowania / Wykluczone serie / Kopia zapasowa / Import / Strefa zagrożenia |
| Help / About | Pomoc / O SyncKai |
| Discreet / Detailed / Alerts only | Dyskretne / Szczegółowe / Tylko ostrzeżenia (the discreet pill is a “mały komunikat”, the detailed bubble a “pełny dymek”; never “plakietka”, which is an icon badge) |
| Tab on opening: Last opened / Now playing / Schedule | Zakładka na start: Jak ostatnio / Odtwarzane / Kalendarz (“Ostatnia” read as the rightmost tab) |

## 3. Conventions

- **Register**: “ty”, imperative 2nd person singular for actions (“Zapisz”, “Spróbuj ponownie”). Possessive and personal pronouns addressing the user are capitalised, as in Polish app copy (“Twoja lista”, “Twój postęp”, “zapyta Cię”); the reflexive “swój” stays lowercase.
- **No gendered forms for the user**: Polish past tense and many adjectives mark gender (“zalogowałeś / zalogowałaś”). Use the present or future tense (“Klawisz, który zmienisz, zostanie zachowany”), impersonal forms (“Zapisano”, “Nie udało się…”, “Odczytano 3 tytuły”) or participles agreeing with a noun.
- **Brand names** stay undeclined after prepositions: “na AniList”, “na Crunchyroll”, “na Netflix”, “z MyAnimeList” (placeholders `{platform}` / `{service}` cannot be declined either). When a gender would be needed, rephrase (“Obsługa {platform} jest wyłączona”, “Rozłączono {service}”).
- **Quotation marks**: „…” (U+201E … U+201D).
- **Colon and spacing**: no space before “:”, “?” or “!”. Percent without a space, as CLDR Polish: “85%”.
- **Ellipsis**: the single character “…”, used for in-progress states (“Wczytywanie…”, “Synchronizacja…”).
- **Abbreviations**: “Odc.” / “odc.” (episode), “min” (minutes), “h” (hours, as in the agenda offsets “+1 h” formatted by the code), “d” (days, compact countdown “za 2 d”; full form “za 2 dni” where plurals exist), “s” (seconds), “nr” (number), “MB”.
- **“{service}: {message}”**: kept as is; the fragments start lowercase after the colon (“AniList: zapisano odcinek 5”, “MyAnimeList: nie zapisano: …”). A failed write is “nie zapisano: {message}” and a failed new-episode check “nie powiodło się: {error}” (agrees with “sprawdzenie”): “błąd: Błąd AniList (503).” repeated the noun.
- **Reasons** (`match.*`, `sync.correctionPending`…) are nominal fragments without an imperative: they are followed by “Kliknij ikonę SyncKai, aby wybrać wpis.” in the on-page toast (“Odcinek specjalny / OVA: nie ustalono wpisu”).
- **Naming a place in the UI**: “w zakładce Aktywność”, “w sekcji „Do sprawdzenia””, “w sekcji Ustawienia › …”, rather than an English-style parenthesis (“(Aktywność)”).
- **“{title}: completed”**: “{title}: obejrzane” (neuter, like the status).
- **Plurals**: Polish needs `_one` (1), `_few` (2–4, 22–24, …), `_many` (0, 5–21, 25–31, …, 101) and `_other` (fractions, genitive singular: “1,5 odcinka”). Where a sentence cannot carry a plural (no plural variants), use the “label: number” pattern (“strony: {pages}, odcinki: {items}”). Counting nouns used: odcinek (odcinki / odcinków / odcinka), seria (serie / serii / serii), sezon (sezony / sezonów / sezonu), tytuł, błąd, dzień (dni), godzina, dopasowanie, synchronizacja, różnica.
- **Separators**: ` › ` and ` · ` exactly as in English.

## 4. Netflix

- Page netflix.com/viewingactivity: **„Historia oglądania”**; button at the bottom of the list: **„Pokaż więcej”**. Source: Netflix Help Center in Polish (help.netflix.com/pl/node/101917: “Otwórz sekcję Historia oglądania”, “kliknij przycisk Pokaż więcej”), checked 2026-10-14 during the review; not yet seen on a live Polish profile. Used in `crImport.netflix.rule`, `crImport.netflix.keepTab`, `crImport.read.error.netflixLoggedOut`.

## 5. Grammar points settled by the review (2026-10-14)

- **Reflexive possessive**: in a clause whose subject is the user (imperative), use “swój”, not “Twój” (“Usuń serię {title} ze swojej listy”, “Dodaj serię do swojej listy”); “Twój” stays where the subject is SyncKai or a thing (“SyncKai odczytuje Twoją historię”, “Twoje listy są zgodne”).
- **Toggles** describe a standing behaviour: imperfective imperative (“Powiadamiaj mnie o premierze odcinka”, “Pokazuj postęp na żywo”, “Proponuj ocenę po obejrzeniu serii”, “Synchronizuj na Netflix”). One-off buttons stay perfective (“Zapisz”, “Usuń”, “Sprawdź teraz”), except the established imperfective software verbs “Importuj”, “Eksportuj”, “Kopiuj”, “Resetuj”, “Analizuj”.
- **“zapomnieć”** governs the genitive (“zapomnieć czegoś”); the accusative is colloquial. The per-item button stays “Zapomnij”; sentences about all matches use “usunąć/usuwa wszystkie dopasowania”.
- **Impersonal forms of reflexive verbs** keep “się”: “Nie zalogowano się do {service}”.
- **“Completed” vs “finished airing”** in running text: “po obejrzeniu serii” (the user finished it), never “po zakończeniu serii” (reads as the end of the broadcast).
