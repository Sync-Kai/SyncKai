# Polish (`pl`) review log

Independent native review of `src/i18n/locales/pl.json` (934 English keys, 1046 Polish entries with the `_one` / `_few` / `_many` / `_other` plural variants) and `public/_locales/pl/messages.json`, 2026-10-14. Inputs: `docs/i18n/GLOSSARY.md`, `docs/i18n/glossary/pl.md`, `docs/i18n/context.json`, `en.json`, `fr.json`, `de.json`.

Method: terminology audit (concordance of every core term across the catalog: seria, sezon, odcinek / odc., lista, wpis, synchronizacja / synchronizować, do sprawdzenia, do oceny, ocena, komentarz, dopasowanie, ujednolicić, wykluczona seria, oczekująca synchronizacja, napisy końcowe, okienko SyncKai, panel boczny, karta vs zakładka, Odtwarzane, Kalendarz, Na tej stronie, domyślna platforma, import historii oglądania, kopia zapasowa, podgląd, powtórka, konto / połącz / sesja wygasła, alerty o premierach, Ustawienia and its categories, the six statuses, Aktywność, Oglądam); key-by-key reading of all keys with their context notes (meaning, grammar, register, placeholders, composed texts, cross-references, lengths); a second, Polish-only read of the whole catalog for naturalness; every plural key rendered for 0, 1, 2, 3, 4, 5, 11, 12, 21, 22, 25, 101, 112, 122 and 1.5 with `Intl.PluralRules('pl')`; scans for gendered forms addressing the user, „…” quotes, `…`, `85%`, final periods, capitalisation of Twój / Ci / Cię / Ciebie. Compositions checked in the code where the note left a doubt: compare breakdown and result banners (`src/popup/components/compare-section.ts`, `src/import-cr/import-cr.ts`), footer widths (`src/popup/components/footer.ts`), import chips (`serviceChip`), airing status line (`src/shared/airing.types.ts`, wraps), per-service results (`src/shared/sync-feedback.ts`, `src/content/ui/sync-toast.ts`, `src/ui/feedback.ts`), the trigger of `sync.noServiceFollows` (`resolveTargets` in `src/background/controls.ts` and `engagement.ts`), Settings top bar and reset confirmation (`flex-wrap`). External names verified: Netflix PL „Historia oglądania” and „Pokaż więcej” (help.netflix.com/pl/node/101917), Firefox PL „Zarządzaj skrótami rozszerzeń” (mozilla-l10n `pl/toolkit/toolkit/about/aboutAddons.ftl`, `addon-manage-extensions-shortcuts`).

Result: 51 entries changed in `pl.json`, i.e. 45 distinct strings once plural variants are grouped (meaning 10, style 9, terminology 8, consistency 7, grammar 6, cross-reference 3, typography 2); `messages.json` unchanged. Plurals, placeholders, quotation marks and gender neutrality were already correct everywhere; the fixes are about meaning traps, term collisions and naturalness. `npm run i18n:check -- pl`: 0 errors, 65 length warnings (reviewed below).

## Changes

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `agenda.empty.noSeries` | Nie oglądasz jeszcze żadnej serii. Zacznij jakąś na Crunchyroll lub ADN, a jej nowe odcinki pojawią się tutaj. | Nie oglądasz jeszcze żadnej serii. Zacznij oglądać jakąś na Crunchyroll lub ADN, a jej nowe odcinki pojawią się tutaj. | style | “Zacznij jakąś” (start one) is elliptical and stilted; “zacznij oglądać” is what a Polish speaker says |
| `agenda.empty.noSeriesPlatforms` | Nie oglądasz jeszcze żadnej serii. Zacznij jakąś na {platforms}, a jej nowe odcinki pojawią się tutaj. | Nie oglądasz jeszcze żadnej serii. Zacznij oglądać jakąś na {platforms}, a jej nowe odcinki pojawią się tutaj. | style | Same fix as agenda.empty.noSeries |
| `agenda.empty.week` | Twoje oglądane serie nie mają w tym tygodniu nowych odcinków. | W tym tygodniu brak nowych odcinków serii, które oglądasz. | style | “Twoje oglądane serie nie mają…” is a calque; natural phrasing, same meaning |
| `agenda.estimate.title` | Szacowana premiera na {platform}: emisja w Japonii {offset}. Zmienisz to w Ustawieniach lub przez „Dostosuj godzinę”. | Szacowana premiera na {platform}: emisja w Japonii {offset}. Możesz to zmienić w Ustawieniach lub opcją „Dostosuj godzinę”. | style | “przez „Dostosuj godzinę”” is awkward with a quoted menu item; “opcją …” reads naturally (quote unchanged, matches agenda.adjust) |
| `airing.status.failed` | błąd: {error} | nie powiodło się: {error} | style | Appended to “Ostatnie sprawdzenie: … · ”: “błąd: Nieznany błąd” / “błąd: Błąd AniList (503).” repeated the noun; “nie powiodło się” agrees with “sprawdzenie” (neuter) |
| `api.notAuthenticated` | Nie zalogowano do {service}. | Nie zalogowano się do {service}. | grammar | Impersonal form of the reflexive verb needs “się” (“zalogowano się”); without it the verb has no object |
| `compare.bulk.filtered.anilist` | Filtr: jak na AniList | Widoczne jak na AniList | terminology | “Filtr: jak na AniList” reads as a filter label, not an action on the filtered series; “Widoczne jak na AniList” mirrors “Wszystko jak na AniList” (23 chars) |
| `compare.bulk.filtered.mal` | Filtr: jak na MAL | Widoczne jak na MAL | terminology | Same fix as compare.bulk.filtered.anilist |
| `compare.pause.budget` | Oczekiwanie na limit zapytań AniList: wznowienie za {seconds} s | Oczekiwanie na odnowienie limitu zapytań AniList: wznowienie za {seconds} s | meaning | “Oczekiwanie na limit zapytań” literally means waiting to reach the limit; the job waits for the quota to renew (line wraps, no truncation) |
| `compare.pause.budgetUnknown` | Oczekiwanie na limit zapytań AniList… | Oczekiwanie na odnowienie limitu zapytań AniList… | meaning | Same fix as compare.pause.budget |
| `compare.result.failed_one` | {count} nieudana | {count} błąd | meaning | “1 nieudana” agrees with “seria”: “nieudana seria” means a bad/flop series. Noun “błąd/błędy/błędów”, like FR “échec” and DE “Fehler” |
| `compare.result.failed_few` | {count} nieudane | {count} błędy | meaning | See compare.result.failed_one |
| `compare.result.failed_many` | {count} nieudanych | {count} błędów | meaning | See compare.result.failed_one |
| `compare.result.failed_other` | {count} nieudanej | {count} błędu | meaning | See compare.result.failed_one |
| `crImport.read.error.netflixLoggedOut` | Zaloguj się do Netflix w tej karcie i wybierz swój profil, a potem ponownie otwórz stronę historii oglądania i odczytaj historię jeszcze raz. | Zaloguj się do Netflix w tej karcie i wybierz swój profil, a potem ponownie otwórz stronę „Historia oglądania” i odczytaj historię jeszcze raz. | cross-reference | Netflix's Polish page name „Historia oglądania”, quoted |
| `crImport.netflix.rule` | Netflix: SyncKai wczytuje historię wyłącznie przyciskiem wyświetlającym więcej pozycji na stronie historii oglądania (nic innego nie jest klikane), zachowuje anime znalezione na AniList i odczytuje ich postęp. | Netflix: SyncKai wczytuje historię przyciskiem „Pokaż więcej” na stronie „Historia oglądania” (nic innego nie jest klikane), zachowuje anime znalezione na AniList i odczytuje ich postęp. | cross-reference | Uses Netflix's own Polish names (help.netflix.com/pl/node/101917: section „Historia oglądania”, button „Pokaż więcej”) instead of a paraphrase |
| `crImport.netflix.keepTab` | Zostaw kartę Netflix otwartą na stronie historii oglądania: odczytywanie może potrwać kilka minut. | Zostaw kartę Netflix otwartą na stronie „Historia oglądania”: odczytywanie może potrwać kilka minut. | cross-reference | Netflix's Polish page name „Historia oglądania”, quoted |
| `crImport.review.help` | Niepewne dopasowanie: nic nie zostanie zapisane. Dodaj sezony do sprawdzenia, aby wybrać wpis w okienku SyncKai (Aktywność). | Niepewne dopasowanie: nic nie zostanie zapisane. Dodaj sezony do sprawdzenia, aby wybrać wpis w okienku SyncKai, w zakładce Aktywność. | consistency | “(Aktywność)” calque; the tab is named “w zakładce Aktywność” everywhere else (inline.rateInActivity, sync.correctionPending) |
| `crImport.review.created_one` | Dodano {count} sezon do sprawdzenia: wybierz wpis w okienku SyncKai (Aktywność). | Dodano {count} sezon do sprawdzenia: wybierz wpis w okienku SyncKai, w zakładce Aktywność. | consistency | Same as crImport.review.help |
| `crImport.review.created_few` | Dodano {count} sezony do sprawdzenia: wybierz wpisy w okienku SyncKai (Aktywność). | Dodano {count} sezony do sprawdzenia: wybierz wpisy w okienku SyncKai, w zakładce Aktywność. | consistency | Same as crImport.review.help |
| `crImport.review.created_many` | Dodano {count} sezonów do sprawdzenia: wybierz wpisy w okienku SyncKai (Aktywność). | Dodano {count} sezonów do sprawdzenia: wybierz wpisy w okienku SyncKai, w zakładce Aktywność. | consistency | Same as crImport.review.help |
| `crImport.review.created_other` | Dodano {count} sezonu do sprawdzenia: wybierz wpisy w okienku SyncKai (Aktywność). | Dodano {count} sezonu do sprawdzenia: wybierz wpisy w okienku SyncKai, w zakładce Aktywność. | consistency | Same as crImport.review.help |
| `list.remove.yesAria` | Usuń serię {title} z Twojej listy | Usuń serię {title} ze swojej listy | grammar | Imperative addressed to the user: the possessive must be the reflexive “swój”; “z Twojej listy” is an English calque |
| `feedback.service.error` | błąd: {message} | nie zapisano: {message} | style | Per-service result of a write: “AniList: błąd: Błąd AniList (503).” repeated the noun; “nie zapisano” states the outcome (episode, rating, rewatch, list change not saved) |
| `footer.chip.expired` | Sesja {service} wygasła — otwórz ustawienia | Sesja {service} wygasła — otwórz Ustawienia | consistency | SyncKai's Settings screen is capitalised everywhere else (“w Ustawieniach”, “Ustawienia › …”); lowercase is kept for the browser's settings and the settings data |
| `footer.chip.ok` | Konto {service} połączone — otwórz ustawienia | Konto {service} połączone — otwórz Ustawienia | consistency | Same as footer.chip.expired |
| `import.intro` | Ustawienia, dopasowania, wykluczone serie i historia. Twoje dane logowania AniList/MAL nigdy nie są dołączane. | Ustawienia, dopasowania, wykluczone serie i historia synchronizacji. Twoje dane logowania AniList/MAL nigdy nie są dołączane. | terminology | The backup holds SyncKai's sync history (note: not a streaming history); bare “historia” reads as the watch history of “Import historii oglądania” |
| `import.replaceWarning` | Twoje obecne dopasowania, wykluczone serie i historia zostaną usunięte. Kontynuować? | Twoje obecne dopasowania, wykluczone serie i historia synchronizacji zostaną usunięte. Kontynuować? | terminology | Same as import.intro |
| `import.subtitle` | Eksportuj lub importuj swoje ustawienia, dopasowania i historię. | Eksportuj lub importuj swoje ustawienia, dopasowania i historię synchronizacji. | terminology | Same as import.intro |
| `match.specialSeason` | Odcinek specjalny / OVA: wybierz wpis | Odcinek specjalny / OVA: nie ustalono wpisu | consistency | Reasons are nominal fragments; in the toast “{reason}. Kliknij ikonę SyncKai, aby wybrać wpis.” the imperative “wybierz wpis” appeared twice |
| `page.platformOff` | Obsługa {platform} jest wyłączona: SyncKai niczego tu nie śledzi. Aby ją włączyć: Ustawienia › Oglądanie i synchronizacja. | Obsługa {platform} jest wyłączona: SyncKai niczego tu nie śledzi. Aby ją ponownie włączyć: Ustawienia › Oglądanie i synchronizacja. | meaning | “To turn it back on”: the user turned it off, “ponownie” was missing |
| `page.uncertain` | Sezon odgadnięty: sprawdź go poniżej | Niepewny sezon: sprawdź go poniżej | meaning | “odgadnięty” means guessed correctly/figured out (odgadnąć zagadkę), the opposite of the intended doubt |
| `panel.nowPlaying.notFoundHint` | Aby wybrać wpis, obejrzyj odcinek do końca: SyncKai zapyta Cię o to w swoim okienku („Do sprawdzenia”). | Aby wybrać wpis, obejrzyj odcinek do końca: SyncKai zapyta Cię o to w swoim okienku, w sekcji „Do sprawdzenia”. | style | Parenthesised section name is a calque of the English; Polish names the location (quote unchanged, matches review.title) |
| `panel.tab.nowPlaying` | Oglądasz | Odtwarzane | terminology | “Oglądasz” (panel tab) and “Oglądam” (popup tab / Watching status) differ by one letter for two different screens; “Odtwarzane” echoes the standard “Teraz odtwarzane” (Now playing) and fits 12 chars |
| `settings.airing.label` | Powiadom mnie o premierze odcinka | Powiadamiaj mnie o premierze odcinka | grammar | Persistent toggle = habitual action: imperfective “Powiadamiaj”, like “Pokazuj postęp na żywo” and “Proponuj ocenę…” |
| `settings.backup.exportTabTitle` | Otwiera stronę Kopia zapasowa w karcie i pobiera plik .json | Otwiera stronę „Kopia zapasowa” w nowej karcie i pobiera plik .json | typography | Page name quoted (unquoted it reads as plain words) and “w nowej karcie” (it is a new tab) |
| `settings.backup.help` | Ustawienia, dopasowania, wykluczone serie i historia. Nigdy Twoje dane logowania AniList/MAL. | Ustawienia, dopasowania, wykluczone serie i historia synchronizacji. Nigdy Twoje dane logowania AniList/MAL. | terminology | Same as import.intro |
| `settings.backup.importTitle` | Otwiera stronę Kopia zapasowa w karcie | Otwiera stronę „Kopia zapasowa” w nowej karcie | typography | Same fix as settings.backup.exportTabTitle |
| `settings.help.text` | Błędy są przechowywane tylko w tej przeglądarce. Udostępniasz je tylko wtedy, gdy skopiujesz raport. | Błędy są przechowywane wyłącznie w tej przeglądarce. Udostępniasz je tylko wtedy, gdy skopiujesz raport. | style | “tylko … tylko” repetition in two short sentences |
| `settings.mappings.forgetAria` | Zapomnij: {label} | Zapomnij o dopasowaniu: {label} | meaning | “Zapomnij: One Piece · S2 (East Blue)” sounds like forgetting the series; it forgets the match. “zapomnieć o czymś” is also the normative construction |
| `settings.mappings.resetConfirm` | Zapomnieć dopasowania? | Usunąć wszystkie dopasowania? | grammar | “Zapomnieć dopasowania?” dropped “all” and uses the colloquial accusative after “zapomnieć” (normative: genitive); also ambiguous singular/plural. Line wraps (flex-wrap), 29 chars is safe |
| `settings.notif.discreet.desc` | Mała plakietka w rogu przez 3 s. Nic w trybie pełnoekranowym; na ikonie rozszerzenia pojawia się ptaszek. | Mały komunikat w rogu przez 3 s. Nic w trybie pełnoekranowym; na ikonie rozszerzenia pojawia się ptaszek. | terminology | “plakietka” is a badge (Android: icon badge), easily confused with the check mark on the extension icon in the same sentence; the pill is a short on-page message |
| `settings.ratingPrompt.label` | Proponuj ocenę po zakończeniu serii | Proponuj ocenę po obejrzeniu serii | meaning | “po zakończeniu serii” also reads as “when the series ends airing” (Zakończone = airing status); the trigger is the user completing it (Obejrzane) |
| `settings.shortcuts.help` | Zmieniony przez Ciebie klawisz zostaje zachowany po aktualizacjach. Jeśli brakuje klawisza lub jest już zajęty przez przeglądarkę albo inne rozszerzenie, wybierz inny przyciskiem „Zmień” lub „Ustaw”. | Klawisz, który zmienisz, zostanie zachowany po aktualizacjach. Jeśli klawisza nie ustawiono albo zajęła go już przeglądarka lub inne rozszerzenie, ustaw go przyciskiem „Zmień” lub „Ustaw”. | grammar | “Jeśli brakuje klawisza lub jest już zajęty” mixed an impersonal genitive clause with a clause needing a nominative subject, and “wybierz inny” did not fit the “no key” case; the stilted “Zmieniony przez Ciebie klawisz” becomes a relative clause (still gender-neutral) |
| `sync.correctionPending` | Oczekuje poprawka tego sezonu: odcinek zostanie zapisany po Twojej decyzji w zakładce Aktywność | Ten sezon czeka na poprawkę: odcinek zostanie zapisany po Twojej decyzji w zakładce Aktywność | style | Verb-first “Oczekuje poprawka tego sezonu” sounds unnatural; same meaning |
| `sync.noServiceFollows` | Żaden połączony serwis nie śledzi tej serii. | Żaden połączony serwis nie ma wpisu tej serii. | meaning | Raised when no connected service has an ID (entry) for the anime (`resolveTargets`, background/controls.ts and engagement.ts); “nie śledzi tej serii” suggested it is missing from the list, which is engagement.notInList |
| `sync.sessionClosed` | Konto zostało wylogowane lub zmienione: nic nie zapisano | Konto zostało w międzyczasie wylogowane lub zmienione: nic nie zapisano | meaning | “since” (after the action started) was missing: without it the fragment reads as a permanent state |
| `settings.backHomeAria` | Wróć do ustawień | Wróć do Ustawień | consistency | Same as footer.chip.expired |
| `settings.mappings.resetHelp` | Zapomina wszystkie dopasowania; zostaną ustalone na nowo przy następnym odcinku. | Usuwa wszystkie dopasowania; zostaną ustalone na nowo przy następnym odcinku. | grammar | “Zapomina wszystkie dopasowania”: colloquial accusative after “zapominać”; “Usuwa” is correct and matches the confirmation |
| `settings.panel.live.help` | Pozycja odtwarzania i odliczanie do synchronizacji w zakładce „Oglądasz” | Pozycja odtwarzania i odliczanie do synchronizacji w zakładce „Odtwarzane” | consistency | Quotes the renamed panel tab (panel.tab.nowPlaying) |
| `settings.panel.tab.last` | Ostatnia | Jak ostatnio | meaning | Next to “Zakładka na start”, “Ostatnia” reads as the last (rightmost) tab; the option reopens the tab used last time. 12 chars |

## Term sheet changes (`docs/i18n/glossary/pl.md`)

- Now playing (side panel tab): **Odtwarzane** (was *Oglądasz*, one letter away from the popup tab and status *Oglądam*); quoted as „Odtwarzane”.
- Tab on opening: **Jak ostatnio / Odtwarzane / Kalendarz** (*Ostatnia* read as the rightmost tab).
- AniList ↔ MAL bulk buttons with a filter: **Widoczne jak na AniList / MAL** (was *Filtr: jak na …*); failed counts use the noun **błąd** (*1 błąd · 2 błędy · 5 błędów*), never *nieudana* (*nieudana seria* = a flop).
- Backup: the history it contains is **historia synchronizacji**, never bare *historia*; the page name is quoted („Kopia zapasowa”).
- Settings: capitalised whenever it names SyncKai's screen, aria-labels included (*otwórz Ustawienia*, *Wróć do Ustawień*).
- On-page notification levels: discreet = **mały komunikat**, detailed = **pełny dymek**; never *plakietka* (icon badge).
- Matches: aria label of the Forget button *Zapomnij o dopasowaniu: {label}*.
- Netflix: page **„Historia oglądania”** and button **„Pokaż więcej”** recorded with their source (was "unknown").
- New section 5 "Grammar points settled by the review": reflexive *swój* in imperatives; imperfective verbs for toggles; *zapomnieć* + genitive (sentences about all matches use *usunąć*); impersonal reflexive keeps *się*; *po obejrzeniu serii* vs *po zakończeniu serii*.
- Conventions: per-service failure *nie zapisano: {message}*, airing check *nie powiodło się: {error}*; reasons are nominal fragments (they precede *Kliknij ikonę SyncKai, aby wybrać wpis.*); UI places named *w zakładce Aktywność*, *w sekcji „Do sprawdzenia”*, not in English-style parentheses; gender-neutral example updated (*Klawisz, który zmienisz, zostanie zachowany*).

## Browser strings (`public/_locales/pl/messages.json`)

Unchanged. `extDescription` „Automatycznie synchronizuje Twoje anime (Crunchyroll, ADN) z AniList i MyAnimeList.” is 83 characters (limit 132) and natural; `cmdCompleteEpisode` and `cmdOpenSidePanel` are identical to `settings.shortcuts.episode` and `settings.shortcuts.panel`.

## Length warnings (`i18n:check`)

The 65 warnings compare characters (placeholders included) with short English texts. Checked against each context note and, where it mattered, the code: all fit their stated limits or sit in wrapping / screen-reader-only text, except these, kept on purpose:

- `settings.cat.sync` „Oglądanie i synchronizacja”: 26 characters for ≤ 24, and `settings.cat.notifications` „Powiadomienia i kalendarz” (no warning, 25 for ≤ 24). Both are also the second half of `Ustawienia › …` paths; the home rows have room, the sub-page title (`truncate`) may be cut in a narrow side panel. No shorter wording without the slang *sync* / *synchro*.
- `common.reconnect` „Połącz ponownie” (15 for ~12): checked in `footer.ts`, the `shrink-0` button and the truncating „Sesja wygasła” fit the 400 px popup footer.
- `recent.pending` „Do sprawdzenia ↑” (16 for ~12, no warning): must repeat the section name; small disabled button.
- `common.syncing` „Synchronizacja…” (15 for ~12) is the busy label of the Confirm button; the button grows a little while it is busy.
- New warnings from this review are harmless: `airing.status.failed` (status line, wraps), `settings.mappings.forgetAria` (screen readers only).

## Debatable, left unchanged

- **Status set** (*Oglądam*, *Obejrzane*, *Wstrzymane*, *Porzucone*, *Planuję*, *Oglądam ponownie*): first person for what the user does, neuter participles for the state of the anime, as on Polish list sites (Shinden). Consistent and gender-neutral. *dropnięte* is fan slang, kept out.
- **`page.action.COMPLETED` „Obejrzane”** next to the imperatives „Wstrzymaj” / „Porzuć”: a participle, like the status chip; *Ukończ* / *Zakończ* would be unnatural for anime (and *Zakończone* is the airing status). „Obejrzane” is what Polish media apps put on a "mark as watched" button.
- **Brand names undeclined** (*na Netflix*, *do Netflix*, *z Crunchyroll*): Polish speakers decline *Netflix* (*na Netfliksie*), but placeholders cannot be declined, so the catalog stays uniform. Acceptable UI style; a human reviewer may prefer declining the fixed occurrences.
- **„okienko SyncKai”** for the popup: friendly and clear; *okno rozszerzenia* would be more neutral.
- **`auth.denied` „{service} odmówił dostępu.”**: masculine agreement for AniList / MyAnimeList, natural for these names.
- **`airing.notification.single` „Wyszedł odc. {episode} serii {title}”**: colloquial *wyszedł*, the way fans talk about releases.
- **`crImport.read.error.adnLoggedOut` „(jeśli już to zrobiono, odśwież stronę)”**: a little impersonal; the natural *jeśli jesteś już zalogowany/a* would be gendered.
- **`crImport.connect.access` / `crImport.connect.netflixAccess` „zezwól na dostęp, aby odczytać Twoją historię”**: the purpose clause has the user as implied subject while SyncKai does the reading; common and understood, the strict alternative (*aby SyncKai mógł…*) is heavier.
- **`panel.live.unreachable` „Odśwież kartę, aby śledzić odtwarzanie.”**: same implied-subject looseness as above, mirrors the English.
- **`onboarding.step3` „Lista aktualna przed końcem odcinka”**: says "before the end of the episode" rather than "by the credits": *napisy końcowe* must keep *końcowe* (term sheet) and does not fit the ~35-character step.
- **`prompt.rewatch.yes` „Tak, oglądam”**: echo answer to „Oglądasz ponownie „{title}”?”, without *ponownie* (18-character button).
- **`compare.job.retryFailed` „Ponów nieudane”**: *nieudane* is safe here (you retry operations, not series); kept short for the banner.
- **`crImport.preview.add` „nowy”**: chip „AL nowy → 12 (obejrzane)” mixes masculine (*wpis*) and neuter (*anime*); both read naturally.
- **`review.format.special` „Specjalny”**: adjective standing for *odcinek specjalny* next to untranslated TV / ONA / OVA; Shinden shows *Special*.
- **`settings.summary.paused` „wstrzymana”** after the platform name („Crunchyroll · wstrzymana”): the feminine agrees with the implicit *autosynchronizacja*; same ellipsis as English.
- **`compare.breakdown.missingAniList/Mal` „290 brakujących na MAL”**: elliptical participle agreeing with *serie*; a label form (*brak na MAL: 290*) would be clearer but breaks the "number first" rhythm of the line.

## Outside the catalog (code)

`src/platforms/netflix/tab-op.ts` › `netflixTabOp` finds Netflix's "Show more" button by its text, among `['voir plus', 'afficher plus', 'show more', 'see more', 'load more', 'mehr anzeigen', 'weitere anzeigen', 'mehr laden']`. A Netflix profile in Polish shows **„Pokaż więcej”** (help.netflix.com/pl/node/101917), which is not in the list, so a Polish-profile Netflix history import stops after the first rows (read as a short or partial history). The label follows the Netflix profile language, not SyncKai's UI language. Not changed here: outside the files of this review.

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | Zima / Wiosna / Lato / Jesień | Zima {year} / Wiosna {year} / Lato {year} / Jesień {year} | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |

Code fixes that change how this catalog is displayed:

- Netflix history import: the “Pokaż więcej” button of a Netflix profile in this language is recognized (label checked by the reviewer on Netflix’s help article 101917 in this language): such an import no longer stops after the first rows as if the history were complete.
- The signed delays of the Schedule tooltips (`agenda.estimate.*`) now use `time.countdown.*`: “+1 h 30 min”.
- Lists of names in `{services}` and `{titles}` use the language’s own conjunction (`Intl.ListFormat`) instead of “, ”.

Layout (`npm run test:i18n-layout`), fixed in the components without changing the text: `page.action.PAUSED`, `page.action.COMPLETED` (side panel at 320 px): the icons are hidden when the side panel is narrow.

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). Same text in every variant (the wording already avoided the noun agreement), `{total}` renamed `{count}`.

| Key | Text |
|---|---|
| `sync.beyondEntry_one` | Odcinek {progress} wykracza poza liczbę odcinków wpisu ({count}) |
| `sync.beyondEntry_few` | Odcinek {progress} wykracza poza liczbę odcinków wpisu ({count}) |
| `sync.beyondEntry_many` | Odcinek {progress} wykracza poza liczbę odcinków wpisu ({count}) |
| `sync.beyondEntry_other` | Odcinek {progress} wykracza poza liczbę odcinków wpisu ({count}) |

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | Nie rozpoznano przycisku „Pokaż więcej” w języku profilu Netflix: odczytano tylko najnowsze odcinki. Ustaw w Netflix ten profil na ten sam język co SyncKai i odczytaj historię jeszcze raz. |

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video (tylko anime) |
| `settings.prime.label` | Synchronizuj na Prime Video |
| `settings.prime.helpOff` | Synchronizowane są tylko anime (gatunek anime albo animacja z japońską ścieżką dźwiękową lub z dokładnym tytułem z AniList). Przeglądarka poprosi o dostęp do primevideo.com |
| `settings.prime.helpOn` | SyncKai odczytuje tylko to, co strona Prime Video już otrzymuje. W już otwartej karcie Prime Video śledzenie zacznie się od następnego odcinka |
| `settings.prime.denied` | Odmówiono dostępu do primevideo.com: synchronizacja na Prime Video pozostaje wyłączona |
| `settings.prime.disabled` | Wyłączono Prime Video: odśwież otwarte karty Prime Video, aby całkowicie zatrzymać śledzenie |
| `settings.prime.error` | Nie udało się zmienić dostępu do Prime Video, spróbuj ponownie |

| Key | Text |
|---|---|
| `onboarding.intro` | Oglądaj anime na Crunchyroll lub ADN (Netflix, Disney+ i Prime Video opcjonalnie): SyncKai zaktualizuje Twoją listę pod koniec każdego odcinka. |
| `watching.tip` | Netflix, Disney+, Prime Video (opcjonalnie) i domyślną platformę ustawisz w sekcji {path}. |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | Zgodność z platformą: {signals} |
| `match.signalsContradict` | Niezgodność z platformą: {signals} |
| `match.yearRemake` | Remake rozpoznany po roku premiery ({year}) |
| `match.signal.year` | rok premiery |
| `match.signal.episodes` | liczba odcinków |
| `match.signal.duration` | długość odcinków |
| `match.signal.format` | format (film lub serial) |
| `match.signal.country` | kraj pochodzenia |
| `match.signal.originalTitle` | tytuł oryginalny |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | Zapamiętane dopasowanie niezgodne z platformą: {signals} |

## 2026-10-14 · Matching diagnostic (development builds only)

New keys `settings.matchDiag.*` (Settings › Help & about, section shown only in development builds, never in the published extension): the last 50 AniList matching decisions, a « Copy » button per row (one decision as JSON, for the test corpus) and a « Clear » button. `{count}` follows a label and a colon (no plural form); `JSON` is a format name. Terms from this language's term sheet (match, entry). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.title` | Diagnostyka dopasowań |
| `settings.matchDiag.text` | Tylko w wersjach deweloperskich: ostatnie 50 decyzji dopasowania z AniList, od najnowszej, przechowywanych do zamknięcia przeglądarki. Skopiuj jedną jako JSON, aby dodać ją do korpusu testów. |
| `settings.matchDiag.empty` | Nie zapisano jeszcze żadnej decyzji |
| `settings.matchDiag.copy` | Kopiuj |
| `settings.matchDiag.copyTitle` | Kopiuj tę decyzję jako JSON |
| `settings.matchDiag.copied` | Skopiowano |
| `settings.matchDiag.copyFailed` | Nie udało się skopiować decyzji. |
| `settings.matchDiag.clear` | Wyczyść |
| `settings.matchDiag.candidates` | Kandydaci: {count} |
| `settings.matchDiag.noEntry` | Brak wpisu |

## 2026-10-15 · Debug trace (development builds only)

New keys `settings.debugTrace.*` (Settings › Help & about, section shown only in development builds, never in the published extension, below the matching diagnostic): a timeline of what the extension did (pages, service worker, AniList and MyAnimeList requests), a verbose switch, a category filter (category names stay in English: technical identifiers), « Copy trace » (the whole trace as JSON) and the « Clear » button of the matching diagnostic (`settings.matchDiag.clear`, reused). `{count}` and `{max}` follow a label and a colon (no plural form) and arrive formatted for the language; `JSON` is a format name; `service worker` kept as the browser's technical term. New terms added to this language's term sheet (debug trace, event, verbose mode); other terms from it (account). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.debugTrace.title` | Ślad debugowania |
| `settings.debugTrace.text` | Tylko w wersjach deweloperskich: przebieg tego, co SyncKai robił na stronach, w service workerze oraz z AniList i MyAnimeList, od najnowszego, przechowywany do zamknięcia przeglądarki. Nie zapisuje się żadnych tokenów, plików cookie ani identyfikatorów kont. Skopiuj cały ślad jako JSON, aby udostępnić go przy zgłaszaniu problemu. |
| `settings.debugTrace.empty` | Nie zapisano jeszcze żadnego zdarzenia |
| `settings.debugTrace.copy` | Kopiuj ślad |
| `settings.debugTrace.copied` | Skopiowano |
| `settings.debugTrace.copyFailed` | Nie udało się skopiować śladu. |
| `settings.debugTrace.verbose` | Tryb szczegółowy (wszystkie wiersze dziennika) |
| `settings.debugTrace.count` | Zdarzenia: {count} / {max} |
| `settings.debugTrace.allCategories` | Wszystkie kategorie |
| `settings.debugTrace.filterAria` | Filtruj zdarzenia według kategorii |

## 2026-10-16 · Matching diagnostic: Copy all (development builds only)

New keys in the « Matching diagnostic » section (Settings › Help & about, development builds only, never in the published extension, now collapsed by default behind its title): « Copy all » copies every recorded decision as one JSON array, next to « Clear »; its label becomes « Copied » (`settings.matchDiag.copied`, reused) and a failure reuses `settings.matchDiag.copyFailed`. `JSON` is a format name. Same word for « decision » as `settings.matchDiag.copyTitle`, in the plural; other terms from this language's term sheet. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.copyAll` | Kopiuj wszystko |
| `settings.matchDiag.copyAllTitle` | Kopiuj wszystkie decyzje jako JSON |

## 2026-10-16 · Episode guards (« To check » reasons)

New reasons on a « To check » card (`fix/episode-guards`, audit SEC-01): a sync that would jump straight to the last episode from far behind, and episodes reported as finished in a burst, now wait for the user instead of being written. Same « to check » term as `match.otherSeriesExcluded`, same episode wording as `sync.beyondEntry_*`; `{from}` and `{progress}` are episode numbers. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `sync.review.finaleJump` | Bezpośredni skok do ostatniego odcinka ({progress}) z odcinka {from}: do sprawdzenia |
| `sync.review.burst` | Wiele odcinków ukończonych w kilka minut: do sprawdzenia |

## 2026-10-17 · Status bar (popup and side panel)

New texts of the status bar shown at the bottom of the popup and, now, of the side panel (`feature/ui-status-bar`): a synced episode or a count of synced episodes under the series title, shown until the user hides it (« Seen, hide », a × button label), and the history import running, ready to confirm and done. Same words as this language's term sheet: « synchronizacja » (participle « zsynchronizowany »), « seria », « odcinek » / « Odc. », « import » and « do potwierdzenia » (from « Potwierdź »), « zaktualizowana » as in `compare.result.updated_*`; ` · ` and ` / ` kept; `{platform}` is a brand name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `footer.dismiss` | Widzę, ukryj |
| `footer.importDone_one` | Import zakończony · {count} seria zaktualizowana |
| `footer.importDone_few` | Import zakończony · {count} serie zaktualizowane |
| `footer.importDone_many` | Import zakończony · {count} serii zaktualizowanych |
| `footer.importDone_other` | Import zakończony · {count} serii zaktualizowanej |
| `footer.importProgress` | Import z {platform} · {done} / {total} |
| `footer.importReady_one` | Import gotowy · {count} seria do potwierdzenia |
| `footer.importReady_few` | Import gotowy · {count} serie do potwierdzenia |
| `footer.importReady_many` | Import gotowy · {count} serii do potwierdzenia |
| `footer.importReady_other` | Import gotowy · {count} serii do potwierdzenia |
| `footer.syncedEpisode` | Odc. {episode} zsynchronizowany |
| `footer.syncedEpisodes_one` | {count} odcinek zsynchronizowany |
| `footer.syncedEpisodes_few` | {count} odcinki zsynchronizowane |
| `footer.syncedEpisodes_many` | {count} odcinków zsynchronizowanych |
| `footer.syncedEpisodes_other` | {count} odcinka zsynchronizowanego |

## 2026-10-17 · Account menu (status bar)

New texts of the account menu that opens above the AniList / MyAnimeList logo of the status bar (popup and side panel): the logo button's label (also when the session expired), the connection status line, three stat tiles (anime count, episodes watched, days watched, each number shown above its short label), the « Synced this week » row with its tooltip and value, and « View my profile ». Following this language's term sheet, used **konto**, **połączone** (as `settings.account.connected`), **sesja wygasła** (`common.sessionExpired`), **synchronizacja**, **odcinek** with the four plural forms of `footer.syncedEpisodes_*`; *anime* indeclinable; the days tile label is the genitive noun **oglądania** (of watching), valid for every count; « day » is **d**, as `time.countdown.days`. ` · ` kept; `{service}` is a brand name, `{name}` the user's AniList / MyAnimeList user name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `accountMenu.connected` | Połączone |
| `accountMenu.connectedAs` | {name} · połączone |
| `accountMenu.label` | Konto {service} |
| `accountMenu.labelExpired` | Konto {service}, sesja wygasła |
| `accountMenu.profile` | Zobacz mój profil |
| `accountMenu.stats.anime_one` | anime |
| `accountMenu.stats.anime_few` | anime |
| `accountMenu.stats.anime_many` | anime |
| `accountMenu.stats.anime_other` | anime |
| `accountMenu.stats.days_one` | oglądania |
| `accountMenu.stats.days_few` | oglądania |
| `accountMenu.stats.days_many` | oglądania |
| `accountMenu.stats.days_other` | oglądania |
| `accountMenu.stats.daysValue` | {days} d |
| `accountMenu.stats.episodes_one` | odcinek |
| `accountMenu.stats.episodes_few` | odcinki |
| `accountMenu.stats.episodes_many` | odcinków |
| `accountMenu.stats.episodes_other` | odcinka |
| `accountMenu.week.label` | Synchronizacja w tym tygodniu |
| `accountMenu.week.title` | Odcinki zsynchronizowane przez SyncKai w tym tygodniu |
| `accountMenu.week.value_one` | {count} odcinek |
| `accountMenu.week.value_few` | {count} odcinki |
| `accountMenu.week.value_many` | {count} odcinków |
| `accountMenu.week.value_other` | {count} odcinka |

## 2026-10-17 · Settings redesign (Preact): new and changed keys

New texts of the redesigned Settings (Preact): the Platforms and Display categories, the screen-reader names of the back button and of the category card, the row summaries of the Settings home, the Keyboard section of Display, the two sections of Shortcuts, and the section titles and notes of Accounts. Changed: `settings.cat.notifications` (now the single word: the Schedule options moved to Platforms), `settings.summary.connected` (a word instead of ✓), `settings.summary.paused` (now a standalone, capitalised summary), `settings.summary.version` (a word instead of « v »), `settings.entry.help` (the « both accounts connected » condition moved to `settings.entry.unavailable`). Summaries are joined with ` · ` by the code; `settings.account.expiredHelp` and `settings.account.otherStillSynced` are joined as two sentences. The Display summary reuses `settings.section.language`, `settings.section.panel` and `settings.shortcuts.pointer`; the My data summary the history import and backup words; the player summary `settings.player.label`. Platform count written « Włączone: {count} z {total} » in every plural form, so no agreement with the count is needed (as « Włącz {platform} »). « Lista {service} jest nadal aktualizowana »: rephrased so the brand needs no gender. **Twojego** capitalised as in the rest of the catalog; player summary « domyślnie {player} » (*Domyślna platforma*). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.cat.notifications` | Powiadomienia |
| `settings.cat.platforms` | Platformy |
| `settings.cat.display` | Wyświetlanie |
| `settings.backToAria` | Wróć do sekcji {page} |
| `settings.group.categories` | Kategorie |
| `settings.summary.connected` | {service} połączone |
| `settings.summary.notConnected` | {service} niepołączone |
| `settings.summary.bothConnected` | AniList i MyAnimeList połączone |
| `settings.summary.auto` | Automatyczna |
| `settings.summary.paused` | Wstrzymana |
| `settings.summary.platforms_one` | Włączone: {count} z {total} |
| `settings.summary.platforms_few` | Włączone: {count} z {total} |
| `settings.summary.platforms_many` | Włączone: {count} z {total} |
| `settings.summary.platforms_other` | Włączone: {count} z {total} |
| `settings.summary.player` | domyślnie {player} |
| `settings.summary.display` | Język, panel boczny, skróty klawiszowe |
| `settings.summary.data` | Import historii oglądania · kopia zapasowa |
| `settings.summary.version` | Wersja {version} |
| `settings.summary.noErrors` | brak błędów |
| `settings.display.keyboard` | Klawiatura |
| `settings.display.shortcutsHelp` | Klawisze do oznaczania odcinka i otwierania panelu |
| `settings.shortcuts.duringPlayback` | Podczas oglądania |
| `settings.shortcuts.navigation` | Nawigacja |
| `settings.accounts.lists` | Synchronizowane listy |
| `settings.accounts.both` | Z oboma kontami |
| `settings.accounts.privacy` | Logujesz się na stronie AniList lub MyAnimeList: SyncKai nigdy nie widzi Twojego hasła. |
| `settings.account.expiredHelp` | Twoje odcinki nie są wysyłane do {service}, dopóki nie połączysz się ponownie. |
| `settings.account.otherStillSynced` | Lista {service} jest nadal aktualizowana. |
| `settings.entry.help` | Otwierana po kliknięciu tytułu lub okładki anime |
| `settings.entry.unavailable` | Dostępne, gdy połączone są oba konta: AniList i MyAnimeList. |

## 2026-10-17 · Settings › Sync, Matches and Excluded series (Preact)

New texts of the redesigned Sync settings page and of its two sub-pages (Matches, Excluded series), moved out of My data: section titles « Automatic » / « Per series », the descriptions of the two « Episode counted as watched » cards, the « Per series » rows, the Matches intro, search, empty and no-result texts, « Show N more on {platform} », the four origin badges and their legend, the Excluded series section, note, empty hint and the « {year} series · excluded on {date} » fragments. Changed: `settings.trigger.legend` (« Episode counted as watched », where the old text was only « Episode watched »), `settings.trigger.credits` (« (recommended) » moved to `settings.trigger.creditsHelp`), and the paths of `popup.syncDisabledDetail` / `review.excludeTitle` (now nav.settings › settings.section.sync › settings.section.exclusions, built from this catalog's own titles). Removed: `settings.mappings.count_*`, `settings.mappings.help`, `settings.mappings.manage`. `{action}` is the « Re-enable » button (`settings.exclusions.help`) or the « Stop syncing this series » menu item (`settings.exclusions.emptyHelp`), so the quoted labels always match. The match / entry / excluded / re-enable words reuse this catalog's existing terms (`settings.section.mappings`, `settings.mappings.entryFallback`, `settings.section.exclusions`, `settings.exclusions.reactivate`). Counts written « Zapamiętane serie: {count} » and « Pokaż więcej na {platform} ({count}) » in every plural form, so no agreement with the number is needed. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.section.automatic` | Automatycznie |
| `settings.section.perSeries` | Dla każdej serii |
| `settings.trigger.legend` | Kiedy odcinek liczy się jako obejrzany |
| `settings.trigger.credits` | Na początku napisów końcowych |
| `settings.trigger.creditsHelp` | Zalecane: dokładny moment podany przez platformę |
| `settings.trigger.percentageHelp` | Używane też, gdy napisy końcowe są nieznane |
| `settings.sync.mappingsRow` | Zapamiętane dopasowania |
| `settings.sync.mappingsRowHelp` | Sezon z AniList wybrany dla każdej serii |
| `settings.sync.exclusionsRowHelp` | Nigdy niesynchronizowane, możesz je tu przywrócić |
| `settings.mappings.intro_one` | Zapamiętane serie: {count}, według platform: sezon na platformie → wpis AniList, do którego zapisuje SyncKai. Zapomniane dopasowanie zostanie ustalone na nowo przy następnym odcinku. |
| `settings.mappings.intro_few` | Zapamiętane serie: {count}, według platform: sezon na platformie → wpis AniList, do którego zapisuje SyncKai. Zapomniane dopasowanie zostanie ustalone na nowo przy następnym odcinku. |
| `settings.mappings.intro_many` | Zapamiętane serie: {count}, według platform: sezon na platformie → wpis AniList, do którego zapisuje SyncKai. Zapomniane dopasowanie zostanie ustalone na nowo przy następnym odcinku. |
| `settings.mappings.intro_other` | Zapamiętane serie: {count}, według platform: sezon na platformie → wpis AniList, do którego zapisuje SyncKai. Zapomniane dopasowanie zostanie ustalone na nowo przy następnym odcinku. |
| `settings.mappings.search` | Szukaj serii lub wpisu |
| `settings.mappings.noResult` | Brak dopasowań dla „{query}” |
| `settings.mappings.noResultHelp` | Szukaj po tytule serii lub wpisu AniList. |
| `settings.mappings.emptyHelp` | SyncKai zapamiętuje jedno dla każdego synchronizowanego sezonu. |
| `settings.mappings.showMore_one` | Pokaż więcej na {platform} ({count}) |
| `settings.mappings.showMore_few` | Pokaż więcej na {platform} ({count}) |
| `settings.mappings.showMore_many` | Pokaż więcej na {platform} ({count}) |
| `settings.mappings.showMore_other` | Pokaż więcej na {platform} ({count}) |
| `settings.mappings.origin.chosen` | Wybrane przez ciebie |
| `settings.mappings.origin.learned` | Wyuczone |
| `settings.mappings.origin.unmarked` | Stare |
| `settings.mappings.origin.unverified` | Zaimportowane · do sprawdzenia |
| `settings.mappings.origin.chosenHelp` | Potwierdzone lub wybrane przez ciebie: nigdy nie są podważane. |
| `settings.mappings.origin.learnedHelp` | Znalezione przez SyncKai: ustalane na nowo, gdy platforma im przeczy. |
| `settings.mappings.origin.unmarkedHelp` | Zapisane przed 2.4: zachowane, do sprawdzenia, gdy coś im przeczy. |
| `settings.mappings.origin.unverifiedHelp` | Z kopii zapasowej: sprawdzane ponownie przy pierwszym użyciu. |
| `settings.mappings.originLegend` | Pochodzenie dopasowań |
| `settings.exclusions.section` | Nigdy niesynchronizowane |
| `settings.exclusions.help` | Wykluczona seria nie jest już nigdy synchronizowana, w żadnym sezonie. „{action}” przywraca jej śledzenie od następnego odcinka. |
| `settings.exclusions.emptyHelp` | Aby przestać synchronizować serię, wybierz „{action}” w jej menu „⋯”. |
| `settings.exclusions.seriesYear` | seria z {year} |
| `settings.exclusions.excludedOn` | wykluczona {date} |
| `popup.syncDisabledDetail` | Możesz ją przywrócić w sekcji Ustawienia › Synchronizacja › Wykluczone serie |
| `review.excludeTitle` | Wyklucza serię (wszystkie sezony): możesz to cofnąć w sekcji Ustawienia › Synchronizacja › Wykluczone serie |

## 2026-10-17 · Settings › Platforms and Notifications (Preact)

Texts of the redesigned Platforms page (list of sites with « Included » / « Access missing » or a switch, preferred player dropdown, estimated release time per platform with − / + buttons, moved there from the Schedule card) and Notifications page (« On the playback page » style cards and « New episodes »). New: `settings.platforms.where`, `settings.platforms.allAnime`, `settings.platforms.included`, `settings.platforms.accessMissing`, `settings.platforms.note`, `settings.player.openOn`, `settings.player.enableFirst`, `settings.offsets.earlier`, `settings.offsets.later`, `settings.notif.legend`. Changed: `settings.player.help`, `settings.offsets.title`, `settings.offsets.help`, `page.platformOff`, `settings.section.notifications`, `settings.notif.discreet.desc`, `settings.notif.detailed.desc`, `settings.notif.alertsOnly.desc`, `settings.notif.alertsAlways`, `settings.delay.title`, `settings.airing.enableFirst` (the notification descriptions now describe the pill and the bubble, « Extra delay » replaces « Delay », the release-time help says the alerts use it too, « Turn on alerts… » is now visible text). `page.platformOff` keeps its sentence; only the path changed, from « Settings › Playback & sync » to nav.settings › settings.cat.platforms of this catalog. Removed: `settings.section.playback`, `settings.netflix.section`, `settings.netflix.label`, `settings.disney.section`, `settings.disney.label`, `settings.prime.section`, `settings.prime.label`, `settings.airing.label`, `settings.airing.help`, `settings.section.agenda`. The Schedule word, « Open », the release-alert name and the minute unit reuse this catalog's `panel.tab.agenda`, `common.open`, `settings.quick.airing.label` and `settings.offsets.unit`. « Wbudowana » agrees with « platforma »; `settings.delay.title` « Dodatkowy czas » (≤ 16 chars, « Dodatkowe opóźnienie » too long). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.platforms.where` | Gdzie SyncKai śledzi Twoje odcinki |
| `settings.platforms.allAnime` | Wszystkie anime |
| `settings.platforms.included` | Wbudowana |
| `settings.platforms.accessMissing` | Brak dostępu |
| `settings.platforms.note` | Włączenie platformy wymaga dostępu do jej strony. Odczytywane są tylko strony odtwarzania i serii. |
| `settings.player.openOn` | Otwieraj odcinki na |
| `settings.player.enableFirst` | Najpierw włącz |
| `settings.player.help` | Używana przez „Otwórz”, gdy anime jest na kilku aktywnych platformach. |
| `settings.offsets.title` | Szacowana godzina premiery |
| `settings.offsets.help` | Po emisji w Japonii. Używana przez Kalendarz i alerty; pojedynczą serię dostosujesz w jej wierszu w Kalendarzu. |
| `settings.offsets.earlier` | {minutes} min wcześniej |
| `settings.offsets.later` | {minutes} min później |
| `page.platformOff` | Obsługa {platform} jest wyłączona: SyncKai niczego tu nie śledzi. Aby ją ponownie włączyć: Ustawienia › Platformy. |
| `settings.section.notifications` | Na stronie odtwarzania |
| `settings.notif.legend` | Styl powiadomień na stronie |
| `settings.notif.discreet.desc` | Mały komunikat przez kilka sekund w rogu filmu |
| `settings.notif.detailed.desc` | Dymek z odcinkiem i wynikiem w AniList i MyAnimeList |
| `settings.notif.alertsOnly.desc` | Nic, gdy wszystko jest w porządku; dymek tylko przy błędzie lub odcinku do sprawdzenia |
| `settings.notif.alertsAlways` | Błąd lub seria do sprawdzenia wyświetla się zawsze, niezależnie od stylu. |
| `settings.delay.title` | Dodatkowy czas |
| `settings.airing.enableFirst` | Włącz alerty, aby sprawdzać premiery |

## 2026-10-17 · Settings › My data, AniList ↔ MAL differences, Help & about (Preact)

Texts of the redesigned My data page (one « Import a watch history » card, Backup card, « Compare » row opening the AniList ↔ MyAnimeList differences page, which moved there from the popup's Activity screen) and Help & about page (diagnostic report row, error log that unfolds, About card with What's new / Privacy / Source code links). New: `settings.import.title`, `settings.section.compare`, `settings.compare.title`, `settings.compare.help`, `settings.data.perSeries`, `compare.align`, `compare.bulk.help`, `compare.job.background`, `settings.help.diagnostic`, `settings.help.diagnosticHelp`, `settings.help.journalNote`, `settings.about.whatsNew`, `settings.about.privacy`. Changed: `settings.crImport.help`, `settings.backup.help`, `settings.backup.import`, `settings.help.copy`, `settings.about.source` (import help in two sentences, backup help « in one file », « Import » without ellipsis, « Copy the report » next to the new « Diagnostic report » title, « Source code » with « GitHub » on the right). `help.issue.body` keeps its text; only its last-line path changed, to nav.settings › settings.cat.help › settings.help.copy of this catalog. The compare.* texts are unchanged: their context notes now point to Settings › My data. Removed: `settings.section.import`, `settings.backup.crImportTitle`, `settings.crImport.openAria`, `settings.help.text`, `settings.help.copyTitle`, `settings.help.clearHelp`, `settings.help.reportTitle`. The version line reuses `settings.summary.version`, the « Clear » button `settings.matchDiag.clear`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.import.title` | Uzupełnij listy o to, co już obejrzane |
| `settings.crImport.help` | Crunchyroll, ADN lub Netflix. Zobaczysz podgląd, zanim cokolwiek zostanie zapisane. |
| `settings.backup.help` | Ustawienia, dopasowania, wykluczone serie i historia w jednym pliku. Nigdy Twoje dane logowania AniList ani MyAnimeList. |
| `settings.backup.import` | Importuj |
| `settings.section.compare` | Porównanie |
| `settings.compare.title` | Różnice AniList ↔ MyAnimeList |
| `settings.compare.help` | Porównuje Twoje dwie listy i ujednolica je w wybranym kierunku |
| `settings.data.perSeries` | Dopasowaniami i wykluczonymi seriami zarządzasz w {path}. |
| `compare.align` | Ujednolić |
| `compare.bulk.help` | „{action}” przenosi dane z AniList na MyAnimeList; najpierw potwierdzenie pokaże zmiany. |
| `compare.job.background` | Trwa dalej, nawet jeśli zamkniesz tę stronę. |
| `settings.help.diagnostic` | Raport diagnostyczny |
| `settings.help.diagnosticHelp` | Do wklejenia w zgłoszeniu błędu: wersja, przeglądarka, ustawienia, ostatnie błędy. Bez tokenów i kont. |
| `settings.help.copy` | Kopiuj raport |
| `settings.help.journalNote` | Najwyżej 50 ostatnich, od najnowszego; tokeny już ukryte. |
| `settings.about.whatsNew` | Nowości |
| `settings.about.privacy` | Prywatność |
| `settings.about.source` | Kod źródłowy |

## 2026-10-17 · Popup « My series » row menu (Preact)

The row « … » menu of the popup's « My series » list and of the « Continue » card now groups the entry links and the platform searches in two sub-menus. New: `watching.menu.openEntry` (sub-menu entry, its items are the bare AniList / MyAnimeList names; wording taken from `page.openOn` without « on {service} »), `watching.menu.searchOn` (sub-menu entry, its items are the bare platform names; wording taken from `watching.searchOn`, ending with « … »). Changed: `settings.entry.help`, which now also says that « Default entry page » picks the list shown in « My series » (quoted with the exact `watching.mySeries` of this catalog). The « −1 episode » item left the menu (the row has its own −), `watching.minusOne` stays for the « On this page » card. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `watching.menu.openEntry` | Otwórz wpis |
| `watching.menu.searchOn` | Szukaj na… |
| `settings.entry.help` | Otwierana po kliknięciu tytułu lub okładki anime; wybiera też listę w „Moje serie” |



## 2026-10-17 · Popup « On this page » card (Preact)

The popup's « On this page » card was redesigned: the Hold / Drop / Done row and the AniList / MAL links moved to the card's « … » menu (shared with « My series »), and the season dropdown, the star rating and the comment moved to a foldable « Details » section. New: `page.currentStatus` (grey mention at the end of the menu item of the series' current status), `page.details` (foldable button listing what the section holds, same nouns as `page.seasonPicker`, the rating words of `rating.*` and `notes.title`), `page.seasonOnAniList` (title above the season dropdown), `page.seasonHelp` (help under it on an episode page; the match word is the one of `settings.section.mappings`), `page.yourRating` (title above the stars). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `page.currentStatus` | Obecny status |
| `page.details` | Szczegóły: sezon, ocena, komentarz |
| `page.seasonOnAniList` | Sezon w AniList |
| `page.seasonHelp` | Zmiana sezonu poprawia dopasowanie dla kolejnych odcinków. |
| `page.yourRating` | Twoja ocena |


## 2026-10-17 · Popup « Activity » tab (Preact)

The popup's Activity tab was redesigned: failed and pending syncs are now two sections, and every section heading is an uppercase label followed by « · {count} » added by the code. New: `queue.failedHeading` (same failure word as `queue.failed`), `queue.pendingHeading` (syncs waiting for a retry, wording of the former `queue.sectionTitle`), `ratings.heading` (the former `ratings.sectionTitle` without its count). The « To check » heading now reuses `inline.toCheck`. Removed: `queue.section`, `queue.sectionTitle`, `ratings.section`, `ratings.sectionTitle`, `review.title`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `queue.failedHeading` | Błąd |
| `queue.pendingHeading` | Oczekujące |
| `ratings.heading` | Do oceny |


## 2026-10-17 · Side panel « Now playing » (Preact)

The side panel's « Now playing » tab was redesigned as cards: « You're watching » (live playback: bar, credits marker, countdown, sync state with an icon), « Your list » (status chip, « Progress » and the stepper, one line per account, the series « … » menu shared with the popup: Hold / Drop / Done moved there), then foldable sections « Rating and comment », Synopsis, related entries and Discussions. New: `panel.nowPlaying.watching` (heading of the live card, addresses the user), `panel.nowPlaying.list` (heading of the list card, same « your list » words as `page.notInList`), `panel.nowPlaying.ratingNotes` (section title, same nouns as `page.yourRating` and `notes.title`), `panel.live.creditsAt` and `panel.live.creditsUnknown` (legend of the yellow marker under the bar, credits word of `settings.trigger.credits`), `panel.live.countdownCredits` and `panel.live.countdownRatio` (countdown line, wording of the former `panel.live.countdown` plus what the sync waits for, as in `settings.trigger.credits` / `settings.summary.percentage`). Changed: `panel.live.synced` lost its trailing « ✓ » (a check icon now precedes it). The « Progress » label reuses `compare.filter.progress`. Removed: `page.action.COMPLETED`, `page.action.DROPPED`, `page.action.PAUSED` (the status button row is gone), `panel.live.countdown`, `panel.nowPlaying.progress`, `watching.nextWatched`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `panel.nowPlaying.watching` | Oglądasz |
| `panel.nowPlaying.list` | Twoja lista |
| `panel.nowPlaying.ratingNotes` | Ocena i komentarz |
| `panel.live.creditsAt` | Napisy końcowe od {time} |
| `panel.live.creditsUnknown` | Napisy końcowe nieznane · przy {percent}% odcinka |
| `panel.live.countdownCredits` | Synchronizacja za {time} · na początku napisów końcowych |
| `panel.live.countdownRatio` | Synchronizacja za {time} · przy {percent}% odcinka |
| `panel.live.synced` | Zsynchronizowano |


## 2026-10-17 · Side panel Schedule (Preact) and week picker

The Schedule tab of the side panel was redesigned: days in order with « No episode » on empty days, episode lines « 18:00 Crunchyroll · Japan 17:00 » (the platform time first, the Japanese broadcast last and cut first), a « ⋯ » menu with « Adjust time » (its second line gives the time and whether the delay is the series' own or the default), « Open the entry › » and « Search on… › », and a week button that opens a month calendar. New: `agenda.adjust.custom` and `agenda.adjust.default` (second line of « Adjust time », lower case after « · »), `agenda.adjust.platform` (first sentence of `agenda.estimate.title`, shown in the delay editor), `agenda.picker.label`, `agenda.picker.prevMonth`, `agenda.picker.nextMonth`, `agenda.picker.thisWeek`, `agenda.picker.hint` (month calendar; the hint names the arrow keys and the Enter key). Changed: `agenda.jp` writes the country name instead of « JP » (unchanged where it already did: ja, ko, zh-CN, zh-TW). Removed: `watching.searchOn` (the search entries are now the platform names of the « Search on… › » sub-menu). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `agenda.jp` | Japonia {time} |
| `agenda.adjust.custom` | ustawione dla tej serii |
| `agenda.adjust.default` | domyślne opóźnienie |
| `agenda.adjust.platform` | Szacowana premiera na {platform}: emisja w Japonii {offset}. |
| `agenda.picker.label` | Wybierz tydzień |
| `agenda.picker.prevMonth` | Poprzedni miesiąc |
| `agenda.picker.nextMonth` | Następny miesiąc |
| `agenda.picker.thisWeek` | Ten tydzień |
| `agenda.picker.hint` | ↑ ↓ zmienia tydzień, Enter go pokazuje. |
