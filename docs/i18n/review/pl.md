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
