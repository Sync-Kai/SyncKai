# Romanian (`ro`) review log

Independent native review of `src/i18n/locales/ro.json` (934 English keys, 990 Romanian entries with the `_one` / `_few` / `_other` plural variants) and `public/_locales/ro/messages.json`, 2026-10-14. Inputs: `docs/i18n/GLOSSARY.md`, `docs/i18n/glossary/ro.md`, `docs/i18n/context.json`, `en.json`, `fr.json`, `de.json`.

## Method

1. Terminology audit of the term sheet, then a catalog-wide concordance of every core term (series, season, episode, list, entry, sync, to check, to rate, score, comment, match, excluded, pending sync, credits, popup, side panel, Now playing, Schedule, On this page, preferred player, history import, backup, preview, rewatch, account / connect / session expired, release alerts, Settings and its categories, the six list statuses, Activity, Watching) to catch stray variants.
2. Key-by-key reading of all keys with their context notes (meaning against EN and FR, grammar, register, placeholders, composed texts, cross-references, lengths), then a second, Romanian-only continuous read for naturalness.
3. Composed texts checked once assembled, in the code where the note left a doubt: `{service}: {message}` fragments, `Ultima verificare: {relative} · …`, `{reason}. Dă clic…`, `Analiză făcută / Terminată {relative}`, `Reîncercare {when}`, `{title}: terminată · Dă-i o notă în Activitate.`, the settings home summaries, the `Setări › …` paths; the notification body shared by the single and the group notification (`src/background/airing-policy.ts`); the trigger of `sync.noServiceFollows` (`resolveTargets`, `src/background/controls.ts` / `engagement.ts`); the import chips (`src/import-cr/import-cr.ts`); the queue row and section title layouts (`src/popup/components/queue-section.ts`, `src/ui/kit.ts`).
4. Plurals rendered with `Intl.PluralRules('ro')` for 0, 1, 2, 3, 5, 11, 19, 20, 21, 22, 25, 101, 119, 120 in all 56 plural keys: every form is grammatical ("de" for 20–100 and from 120 up, not for 0–19 or 101–119; no "de" before a verb, "20 nu sunt pe MAL"; "de" before substantivized participles, "20 de excluse"). Fixed numbers checked too ("cel mult 20 în așteptare", "6000 de caractere").
5. Mechanical checks (scripts): comma-below ș / ț everywhere (no cedilla form), „…” quotes balanced (no ASCII or English quotes), single-character `…`, no double space or space before punctuation, final punctuation parity with English, register (tu everywhere, no plural/polite forms), every length limit of the notes measured with realistic placeholder values.
6. Units and formats against CLDR (`Intl`): "z" is the narrow day unit, "h", "min", "85 %", "acum 20 de zile", long date "13 octombrie 2026 la 21:09", list "Crunchyroll, ADN sau Netflix".
7. External names verified at the source:
   - Firefox ro, `addon-manage-extensions-shortcuts` = „Gestionează comenzile rapide ale extensiilor” (mozilla-l10n `firefox-l10n/ro/toolkit/toolkit/about/aboutAddons.ftl`): `settings.shortcut.manualFirefox` is exact.
   - Netflix Romanian help center (help.netflix.com/ro/node/101917): page „Activitate de vizionare”, button „Mai multe”.
8. Other languages' review logs (`cs`, `es`, `it`, `tr`) read for cross-language pitfalls; three of them also applied to Romanian (shared notification body, `sync.noServiceFollows`, the backup's "history").
9. `npm run i18n:check -- ro`: 0 errors.

Result: 38 entries changed in `ro.json` (36 keys, `airing.status.notified` counted with its three variants) and `extDescription` in `messages.json` (94 characters, limit 132); both command texts of `messages.json` are identical to `settings.shortcuts.episode` / `settings.shortcuts.panel`. The translation was already solid on diacritics, quotes, plurals and gender agreement (serie f., episod n., sincronizare f., services and platforms n.): no error of those kinds was found.

## Changes

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `agenda.empty.noSeries` | Încă nicio serie în curs. Începe una pe Crunchyroll sau ADN și episoadele ei noi vor apărea aici. | Încă nu urmărești nicio serie. Începe una pe Crunchyroll sau ADN și episoadele ei noi vor apărea aici. | terminology | "serie în curs" reads as "ongoing / still airing" (how Romanian anime sites label airing shows); the text means the user's Watching list, so it now uses the verb of the "Urmăresc" status |
| `agenda.empty.noSeriesPlatforms` | Încă nicio serie în curs. Începe una pe {platforms} și episoadele ei noi vor apărea aici. | Încă nu urmărești nicio serie. Începe una pe {platforms} și episoadele ei noi vor apărea aici. | terminology | Same as agenda.empty.noSeries |
| `agenda.empty.week` | Niciun episod săptămâna aceasta pentru seriile tale în curs. | Niciun episod săptămâna aceasta pentru seriile pe care le urmărești. | terminology | Same as agenda.empty.noSeries (in the Schedule, "în curs" is even closer to "airing") |
| `airing.notification.message` | Difuzat în Japonia · de obicei apare pe Crunchyroll/ADN în câteva ore | Difuzare în Japonia · de obicei pe Crunchyroll/ADN în câteva ore | grammar | Same body text is used under the group notification ("4 episoade noi: …", airing-policy.ts): singular "Difuzat … apare" did not agree with several episodes; number-neutral noun phrase now |
| `airing.status.notified_few` | {count} episoade notificate | {count} episoade anunțate | style | Same as _one |
| `airing.status.notified_one` | {count} episod notificat | {count} episod anunțat | style | "a notifica" is a formal/legal verb and an episode is not "notified"; "anunțat" matches "Anunță-mă când apare un episod" (settings.airing.label) |
| `airing.status.notified_other` | {count} de episoade notificate | {count} de episoade anunțate | style | Same as _one |
| `compare.intro` | Compară cele două liste complete ale tale: progres, status, notă și seriile care lipsesc într-o parte. Nimic nu se modifică fără acordul tău. | Compară cele două liste complete ale tale: progres, status, notă și seriile care lipsesc dintr-una dintre ele. Nimic nu se modifică fără acordul tău. | grammar | "lipsesc într-o parte" is not idiomatic ("a lipsi din"); "missing from one of them" is the intended meaning |
| `compare.skip.changed` | Modificată de la analiză: reia analiza înainte de a alinia această serie. | Modificată după analiză: reia analiza înainte de a alinia această serie. | meaning | "Modificată de la analiză" can be read as "changed by the analysis"; "după analiză" = changed since/after the analysis |
| `crImport.analyze.hint` | Încă nu se scrie nimic. Poți închide această pagină: analiza continuă, iar pagina o va regăsi. | Încă nu se scrie nimic. Poți închide această pagină: analiza continuă și o vei regăsi la redeschidere. | style | "pagina o va regăsi" personified the page (calque of FR « la page la retrouvera »); the user finds the analysis again when reopening the page |
| `crImport.error.noHistory` | Istoricul nu a fost găsit: citește-l din nou. | Istoricul nu a fost găsit: reia citirea. | consistency | Same "read again" instruction as the reading errors; "citește-l din nou" sounded like an order to the user to read it |
| `crImport.netflix.rule` | Netflix: SyncKai încarcă istoricul cu butonul de afișare a mai multor titluri de pe pagina „Activitate de vizionare” (nu apasă nimic altceva), păstrează titlurile anime găsite pe AniList și le citește progresul. | Netflix: SyncKai încarcă istoricul cu butonul „Mai multe” de pe pagina „Activitate de vizionare” (nu apasă nimic altceva), păstrează titlurile anime găsite pe AniList și le citește progresul. | cross-reference | The note asks for Netflix's own label: Netflix's Romanian help center names the button „Mai multe” on the „Activitate de vizionare” page (help.netflix.com/ro/node/101917) |
| `crImport.read.error.adnLoggedOut` | Deschide ADN în acea filă și conectează-te (reîncarcă pagina dacă te-ai conectat deja), apoi citește din nou. | Deschide ADN în acea filă și conectează-te (reîncarcă pagina dacă te-ai conectat deja), apoi reia citirea. | meaning | Same as crImport.read.error.logged-out |
| `crImport.read.error.logged-out` | Conectează-te la {platform} în acea filă, apoi citește din nou. | Conectează-te la {platform} în acea filă, apoi reia citirea. | meaning | "citește din nou" tells the user to read again; the action is restarting the reading with "Citește istoricul meu" (FR « relance la lecture ») |
| `crImport.read.error.netflixLoggedOut` | Conectează-te la Netflix în acea filă și alege-ți profilul, apoi redeschide pagina „Activitate de vizionare” și citește din nou. | Conectează-te la Netflix în acea filă și alege-ți profilul, apoi redeschide pagina „Activitate de vizionare” și reia citirea. | meaning | Same as crImport.read.error.logged-out |
| `engagement.deferFailed` | Nota nu a putut fi salvată pentru mai târziu. | Notarea nu a putut fi amânată. | meaning | No score exists yet: what failed is postponing the rating ("Later" card), not saving a score |
| extDescription (`public/_locales/ro/messages.json`) | Sincronizează automat episoadele anime pe care le urmărești (Crunchyroll, ADN) cu AniList și MyAnimeList. | Sincronizează automat episoadele anime văzute pe Crunchyroll și ADN cu AniList și MyAnimeList. | style | The bracketed platform list calqued the English and hung after "urmărești"; 94 characters (limit 132) |
| `import.intro` | Setări, asocieri, serii excluse și istoric. Datele tale de conectare AniList/MAL nu sunt incluse niciodată. | Setări, asocieri, serii excluse și istoricul sincronizărilor. Datele tale de conectare AniList/MAL nu sunt incluse niciodată. | terminology | The backup holds SyncKai's sync history (note); bare "istoric" read as the watch history of "Importă istoricul de vizionare", shown next to it in Datele mele |
| `import.replaceWarning` | Datele tale actuale (asocieri, serii excluse, istoric) vor fi șterse. Continui? | Datele tale actuale (asocieri, serii excluse, istoricul sincronizărilor) vor fi șterse. Continui? | terminology | Same as import.intro: the erased history is the sync history, not a streaming history |
| `import.subtitle` | Exportă sau importă setările, asocierile și istoricul tău. | Exportă sau importă setările tale, asocierile și istoricul sincronizărilor. | terminology | Same as import.intro |
| `onboarding.intro` | Urmărește anime pe Crunchyroll sau ADN (Netflix și Disney+ opțional): SyncKai îți actualizează lista la finalul fiecărui episod. | Urmărește anime pe Crunchyroll sau ADN (opțional și pe Netflix sau Disney+): SyncKai îți actualizează lista la finalul fiecărui episod. | grammar | "Netflix și Disney+ opțional" left the adjective without agreement (two subjects); adverbial "opțional și pe …" reads naturally |
| `onboarding.step3` | Lista ta e la zi până la generic | La generic, lista ta e deja la zi | meaning | "până la generic" means "until the credits" (as if it stops being up to date afterwards); the step says the list is already updated when the credits roll |
| `page.unavailable` | Fișă absentă pe acest serviciu | Nu există pe acest serviciu | grammar | "absentă pe" is not idiomatic (absent din / de pe); plain "Nu există pe acest serviciu" = "Not available on this service", shorter |
| `panel.live.unreachable` | Reîncarcă fila ca să urmărești redarea. | Reîncarcă fila ca SyncKai să poată urmări redarea. | meaning | "ca să urmărești redarea" made the user the one following the playback; the panel (SyncKai) is what lost contact with the tab ("a urmări" = track, term sheet) |
| `queue.failed` | Eșuată — abandonată | Eșec — reîncercări oprite | terminology | "abandonată" reads like the list status "Abandonat" (Dropped); the term sheet already avoids it for the queue ("Renunță"). Meaning: SyncKai stopped retrying automatically; 25 characters (note ≈ 25) |
| `ratings.ignoreAria` | Ignoră nota pentru {title} | Ignoră notarea pentru {title} | meaning | The button skips the act of rating ("notarea"), not an existing score ("nota") |
| `settings.backup.help` | Setări, asocieri, serii excluse și istoric. Niciodată datele tale de conectare AniList/MAL. | Setări, asocieri, serii excluse și istoricul sincronizărilor. Niciodată datele tale de conectare AniList/MAL. | terminology | Same as import.intro; this card sits right above the watch-history import card |
| `settings.crImport.help` | Crunchyroll, ADN sau Netflix: recuperează-ți istoricul, cu previzualizare înainte de trimitere | Crunchyroll, ADN sau Netflix: adu-ți listele la zi din istoric, cu previzualizare înainte de trimitere | meaning | "recuperează-ți istoricul" reads as "recover your history"; the feature brings the AniList/MAL lists up to date from the watch history |
| `settings.disney.helpOff` | Se sincronizează doar titlurile anime japoneze legate de Disney+ pe AniList. Browserul îți va cere acces la disneyplus.com | Se sincronizează doar titlurile anime japoneze legate de Disney+ pe AniList. Browserul îți va cere permisiunea de acces la disneyplus.com | meaning | Same as settings.netflix.helpOff |
| `settings.help.text` | Erorile sunt păstrate doar în acest browser. Sunt partajate doar dacă copiezi raportul. | Erorile sunt păstrate doar în acest browser și sunt partajate numai dacă copiezi raportul. | style | Repetition "doar … doar" in two short sentences |
| `settings.mappings.forgetAria` | Uită {label} | Uită asocierea pentru {label} | meaning | Screen readers heard "Uită One Piece · S2 (East Blue)" (forget the series); the button forgets the match |
| `settings.netflix.helpOff` | Se sincronizează doar titlurile anime legate de Netflix pe AniList. Browserul îți va cere acces la netflix.com | Se sincronizează doar titlurile anime legate de Netflix pe AniList. Browserul îți va cere permisiunea de acces la netflix.com | meaning | "îți va cere acces" = "will ask YOU for access" (inverted); the browser asks the user's permission for SyncKai to access the site |
| `settings.notif.discreet.desc` | O bulină mică timp de 3 s într-un colț. Nimic pe ecran complet; pictograma extensiei afișează o bifă. | O bulină mică timp de 3 s într-un colț. Nimic în modul ecran complet; pictograma extensiei afișează o bifă. | style | "pe ecran complet" reads as "on the whole screen"; the browser's term is the full-screen mode ("modul ecran complet") |
| `settings.ratingPrompt.help` | O bulă „Nota ta?” când o serie trece la Terminat | O bulă „Nota ta?” când o serie trece la „Terminat” | typography | List statuses are quoted inside sentences everywhere else („Urmăresc”, „De văzut”) |
| `settings.ratingPrompt.label` | Propune o notă la finalul unei serii | Cere o notă la finalul unei serii | meaning | "Propune o notă" = "suggest a score" (as if SyncKai picked one); the option asks the user for a score |
| `sync.noServiceFollows` | Niciun serviciu conectat nu urmărește această serie. | Niciun serviciu conectat nu are o fișă pentru această serie. | meaning | Raised when no connected service has an ID for the anime (`resolveTargets` empty in controls.ts / engagement.ts), as the note says; "nu urmărește" suggested the series was missing from the list, which points to the wrong fix |
| `watching.empty.title` | Încă nimic în curs | Încă nu urmărești nimic | terminology | Same as agenda.empty.noSeries; heading of the empty "Urmăresc" tab |
| `watching.noOther` | Nicio altă serie în curs. | Nu urmărești nicio altă serie. | terminology | Same as agenda.empty.noSeries |
| `watching.tip` | Netflix, Disney+ (opționale) și platforma ta preferată se setează din {path}. | Găsești Netflix, Disney+ (opționale) și platforma ta preferată în {path}. | style | With {path} = "Setări › Redare & sincronizare" the sentence read "se setează din Setări" (echo set/Setări) |

Totals: meaning 14, terminology 10, style 8 (7 in `ro.json`, 1 in `messages.json`), grammar 4, consistency 1, cross-reference 1, typography 1 (39 changes).

## Term sheet changes (`docs/i18n/glossary/ro.md`)

- Watching: in sentences, "seriile pe care le urmărești" / "Încă nu urmărești nicio serie", never "serii în curs" (Romanian anime sites use "în curs" for shows still airing); "în curs" kept for running jobs.
- Entry: `sync.noServiceFollows` = "Niciun serviciu conectat nu are o fișă pentru această serie".
- Pending sync: `queue.failed` = "Eșec — reîncercări oprite", never "abandonată" (same reason as "Renunță").
- Backup: the history it contains is "istoricul sincronizărilor", never bare "istoric".
- Release alerts: "episoade anunțate" (never "notificate"); the notification body stays number-neutral (shared by the single and the group notification).
- Track: SyncKai is named as the subject ("ca SyncKai să poată urmări redarea").
- Conventions: statuses always quoted in sentences; "reia citirea" for "read again"; "Browserul îți va cere permisiunea de acces la …"; "modul ecran complet"; "z" confirmed as the CLDR narrow day unit.
- Netflix: button „Mai multe” and page „Activitate de vizionare” confirmed (help center), with the code note below. New Firefox section: „Gestionează comenzile rapide ale extensiilor”.

## Length warnings (`i18n:check`)

44 informative warnings (43 before; the new one, `settings.mappings.forgetAria`, is a screen-reader label). Every key whose note gives a limit was measured with realistic values. Over their stated limit, kept on purpose:

- `common.stopSync` „Nu mai sincroniza” 17 / ~16, `common.stopSyncSeries` 31 / ≤ 240 px, `common.syncing` „Sincronizare…” 13 / ~12, `popup.hostAccessAllow` „Permite accesul” 15 / ~14, `popup.excludeFailed` 28 / ~25, `popup.includeFailed` 29 / ~25: French is as long or longer in each case (20, 32, 16, 17, 30, 33).
- `queue.sectionTitle` „Sincronizări în așteptare (2)” 29–30 / ≈ 25: an `h2` with no truncation on a full-width row (`ui/kit.ts` › `sectionTitle`); "În așteptare (2)" alone would not say what is waiting.
- `recent.pending` „De verificat ↑” 14 / ≈ 12: must repeat the "De verificat" section name.
- `watching.openOn` „Deschide pe Crunchyroll” 23 / ~20: French and German are 22.
- `panel.enablePlatform` only receives Netflix or Disney+ („Activează Netflix”, 17 / ≤ 20).

## Debatable, left unchanged

| Key(s) | Current text | Why it was kept |
|---|---|---|
| `nav.watching`, `page.status.CURRENT` | Urmăresc | First-person verb as tab and status (like DE "Schaue ich"); natural ("seriale pe care le urmăresc"). "În curs" is ruled out (reads as airing), "Vizionez" is stiffer. A native reviewer should confirm the status set (Urmăresc / Terminat / În pauză / Abandonat / De văzut / Revizionare) against what Romanian AniList/MAL users say |
| `page.status.REPEATING` and the rewatch keys | Revizionare, revizionezi | "a reviziona" is in DEX; fans often just say "rewatch" |
| `compare.breakdown.progress/score/status_*` | 30 la progres · 15 la status · 9 la notă | Elliptical ("[differences] in progress"), compact and clear under "Diferențe AniList ↔ MAL"; a label form ("progres: 30") would clash with "290 nu sunt pe MAL" in the same line |
| `compare.chip.missing*`, `compare.filter.missing*` | Lipsă pe AniList | Modeled on "lipsă pe stoc"; "Nu e pe AniList" is more colloquial for the chip, but the filter needs ≤ 16 characters |
| `compare.bulk.filtered.*` | Filtrul ca pe AniList | Could be taken for a filter control (Czech and Spanish rephrased theirs); kept like DE "Filter wie AniList", the confirmation box names the count and the services |
| `compare.keep.*` | Ca pe AniList | Mirrors the bulk buttons; "Păstrează AniList" is 17 characters for ≤ 16 |
| `footer.toReview_*` | {count} de verificat | No noun ("element"), compact for the footer; the aria-label adds "— vezi activitatea" |
| `panel.nowPlaying.watch` | Vezi | "Watch" as "see"; next to a platform logo it reads as watch; "Vizionează" is exactly at the 10-character limit |
| `panel.tab.nowPlaying` | În redare | Romanian media apps also say "Se redă acum" (12); shorter and clear |
| `settings.quick.airing.label`, `airing.*` | Alerte de lansare | "lansare" is slightly corporate; "Alerte episoade noi" would also work. Kept: term sheet, consistent with the summary fragments |
| `crImport.preview.completed` vs `crImport.skipReason.completed` | (terminat) / terminată | Same design as French ("(terminé)" = status name, "terminée" = the series) |
| `airing.status.failed` + `airing.unknownError` | eșec: Eroare necunoscută | No word repetition in Romanian (unlike "error: Error" in ES/IT) |
| `watching.resume` | Continuă | Card heading that could read as a button; "Continuă vizionarea" would wrap next to the platform pill (about 75 px left) |
| `popup.swTimeout` | … peste câteva momente | "peste câteva clipe" is more idiomatic; "câteva momente" is common in Romanian system messages |
| `import.merge.title` | Combină (recomandat) | "Îmbină" is the usual technical "merge" (Office, Git); both are natural |
| `settings.panel.tab.last` | Ultima filă | Inside "Fila la deschidere" it clearly means the last panel tab; "Ultima deschisă" exceeds 12 characters |
| `panel.nowPlaying.relations` | Titluri înrudite | Drops "sequels"; "Continuări și titluri înrudite" exceeds 26 characters |
| `time.countdown.days` | {count} z | CLDR's narrow day unit, less familiar than "zile", but the key is not plural-aware ("1 zile" impossible) |
| `crImport.netflix.rule` | butonul „Mai multe” | From Netflix's Romanian help center, not seen on a live Romanian profile |

## Outside the catalog (code, not changed)

`src/platforms/netflix/tab-op.ts` › `netflixTabOp` finds Netflix's "Show more" button by its text among `['voir plus', 'afficher plus', 'show more', 'see more', 'load more', 'mehr anzeigen', 'weitere anzeigen', 'mehr laden']`. A Netflix profile in Romanian shows „Mai multe”, so the Netflix history import would stop after the first rows (read as a short or partial history). The label follows the Netflix profile language, not SyncKai's: add "mai multe" (or use a language-independent selector). The row parser of the same file already accepts Romanian „…” episode quotes.

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | Iarnă / Primăvară / Vară / Toamnă | Iarnă {year} / Primăvară {year} / Vară {year} / Toamnă {year} | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |

Code fixes that change how this catalog is displayed:

- Netflix history import: the “Mai multe” button of a Netflix profile in this language is recognized (label checked by the reviewer on Netflix’s help article 101917 in this language): such an import no longer stops after the first rows as if the history were complete.
- The signed delays of the Schedule tooltips (`agenda.estimate.*`) now use `time.countdown.*`: “+1 h 30 min”.
- Lists of names in `{services}` and `{titles}` use the language’s own conjunction (`Intl.ListFormat`) instead of “, ”.

Layout (`npm run test:i18n-layout`): no finding in this language.

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). Same text in every variant (the wording already avoided the noun agreement), `{total}` renamed `{count}`.

| Key | Text |
|---|---|
| `sync.beyondEntry_one` | Episodul {progress} depășește numărul de episoade al fișei ({count}) |
| `sync.beyondEntry_few` | Episodul {progress} depășește numărul de episoade al fișei ({count}) |
| `sync.beyondEntry_other` | Episodul {progress} depășește numărul de episoade al fișei ({count}) |

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | Butonul „Mai multe” nu a fost recunoscut în limba profilului tău Netflix: au fost citite doar cele mai recente episoade. Setează pe Netflix acel profil în aceeași limbă ca SyncKai, apoi reia citirea. |

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video (doar anime) |
| `settings.prime.label` | Sincronizează pe Prime Video |
| `settings.prime.helpOff` | Se sincronizează doar titlurile anime (genul anime sau animație cu audio în japoneză ori cu titlul exact de pe AniList). Browserul îți va cere permisiunea de acces la primevideo.com |
| `settings.prime.helpOn` | SyncKai citește doar ce primește deja pagina Prime Video. Într-o filă Prime Video deja deschisă, urmărirea începe de la episodul următor |
| `settings.prime.denied` | Accesul la primevideo.com a fost refuzat: Prime Video rămâne dezactivat |
| `settings.prime.disabled` | Prime Video dezactivat: reîncarcă filele Prime Video deschise ca să-l oprești complet |
| `settings.prime.error` | Accesul la Prime Video nu a putut fi modificat, încearcă din nou |

| Key | Text |
|---|---|
| `onboarding.intro` | Urmărește anime pe Crunchyroll sau ADN (opțional și pe Netflix, Disney+ sau Prime Video): SyncKai îți actualizează lista la finalul fiecărui episod. |
| `watching.tip` | Găsești Netflix, Disney+, Prime Video (opționale) și platforma ta preferată în {path}. |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | Corespunde cu platforma: {signals} |
| `match.signalsContradict` | Nu corespunde cu platforma: {signals} |
| `match.yearRemake` | Remake deosebit după anul lansării ({year}) |
| `match.signal.year` | anul lansării |
| `match.signal.episodes` | numărul de episoade |
| `match.signal.duration` | durata episoadelor |
| `match.signal.format` | formatul (film sau serial) |
| `match.signal.country` | țara de origine |
| `match.signal.originalTitle` | titlul original |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | Asocierea memorată nu corespunde cu platforma: {signals} |

## 2026-10-14 · Matching diagnostic (development builds only)

New keys `settings.matchDiag.*` (Settings › Help & about, section shown only in development builds, never in the published extension): the last 50 AniList matching decisions, a « Copy » button per row (one decision as JSON, for the test corpus) and a « Clear » button. `{count}` follows a label and a colon (no plural form); `JSON` is a format name. Terms from this language's term sheet (match, entry). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.title` | Diagnosticul asocierilor |
| `settings.matchDiag.text` | Doar în build-urile de dezvoltare: ultimele 50 de decizii de asociere cu AniList, de la cea mai recentă, păstrate până la închiderea browserului. Copiază una ca JSON ca s-o adaugi în corpusul de teste. |
| `settings.matchDiag.empty` | Nicio decizie înregistrată încă |
| `settings.matchDiag.copy` | Copiază |
| `settings.matchDiag.copyTitle` | Copiază decizia ca JSON |
| `settings.matchDiag.copied` | Copiată |
| `settings.matchDiag.copyFailed` | Decizia nu a putut fi copiată. |
| `settings.matchDiag.clear` | Golește |
| `settings.matchDiag.candidates` | Candidați: {count} |
| `settings.matchDiag.noEntry` | Nicio fișă |

## 2026-10-15 · Debug trace (development builds only)

New keys `settings.debugTrace.*` (Settings › Help & about, section shown only in development builds, never in the published extension, below the matching diagnostic): a timeline of what the extension did (pages, service worker, AniList and MyAnimeList requests), a verbose switch, a category filter (category names stay in English: technical identifiers), « Copy trace » (the whole trace as JSON) and the « Clear » button of the matching diagnostic (`settings.matchDiag.clear`, reused). `{count}` and `{max}` follow a label and a colon (no plural form) and arrive formatted for the language; `JSON` is a format name; `service worker` kept as the browser's technical term. New terms added to this language's term sheet (debug trace, event, verbose mode); other terms from it (account). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.debugTrace.title` | Urmă de depanare |
| `settings.debugTrace.text` | Doar în build-urile de dezvoltare: desfășurarea a ceea ce a făcut SyncKai pe pagini, în service worker și cu AniList și MyAnimeList, de la cea mai recentă, păstrată până la închiderea browserului. Nu se înregistrează niciun token, cookie sau ID de cont. Copiază toată urma ca JSON ca s-o trimiți când raportezi o problemă. |
| `settings.debugTrace.empty` | Niciun eveniment înregistrat încă |
| `settings.debugTrace.copy` | Copiază urma |
| `settings.debugTrace.copied` | Copiată |
| `settings.debugTrace.copyFailed` | Urma nu a putut fi copiată. |
| `settings.debugTrace.verbose` | Mod detaliat (toate liniile din jurnal) |
| `settings.debugTrace.count` | Evenimente: {count} / {max} |
| `settings.debugTrace.allCategories` | Toate categoriile |
| `settings.debugTrace.filterAria` | Filtrează evenimentele după categorie |

## 2026-10-16 · Matching diagnostic: Copy all (development builds only)

New keys in the « Matching diagnostic » section (Settings › Help & about, development builds only, never in the published extension, now collapsed by default behind its title): « Copy all » copies every recorded decision as one JSON array, next to « Clear »; its label becomes « Copied » (`settings.matchDiag.copied`, reused) and a failure reuses `settings.matchDiag.copyFailed`. `JSON` is a format name. Same word for « decision » as `settings.matchDiag.copyTitle`, in the plural; other terms from this language's term sheet. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.copyAll` | Copiază tot |
| `settings.matchDiag.copyAllTitle` | Copiază toate deciziile ca JSON |

## 2026-10-16 · Episode guards (« To check » reasons)

New reasons on a « To check » card (`fix/episode-guards`, audit SEC-01): a sync that would jump straight to the last episode from far behind, and episodes reported as finished in a burst, now wait for the user instead of being written. Same « to check » term as `match.otherSeriesExcluded`, same episode wording as `sync.beyondEntry_*`; `{from}` and `{progress}` are episode numbers. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `sync.review.finaleJump` | Salt direct la ultimul episod ({progress}) de la episodul {from}: de verificat |
| `sync.review.burst` | Multe episoade terminate în câteva minute: de verificat |

## 2026-10-17 · Status bar (popup and side panel)

New texts of the status bar shown at the bottom of the popup and, now, of the side panel (`feature/ui-status-bar`): a synced episode or a count of synced episodes under the series title, shown until the user hides it (« Seen, hide », a × button label), and the history import running, ready to confirm and done. Same words as this language's term sheet: « sincronizat » (agreeing with *episod*), « serie / serii », « Ep. » (`agenda.episode`), « import » (`crImport.apply.done` « Import terminat »), « pregătit » as in `crImport.connect.found` and « de confirmat » as `common.confirm`; plurals `_one` / `_few` / `_other` with « de » in `_other`, like `footer.queueFailed_*`; ` · ` and ` / ` kept; `{platform}` is a brand name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `footer.dismiss` | Văzut, ascunde |
| `footer.importDone_one` | Import terminat · {count} serie actualizată |
| `footer.importDone_few` | Import terminat · {count} serii actualizate |
| `footer.importDone_other` | Import terminat · {count} de serii actualizate |
| `footer.importProgress` | Import {platform} · {done} / {total} |
| `footer.importReady_one` | Import pregătit · {count} serie de confirmat |
| `footer.importReady_few` | Import pregătit · {count} serii de confirmat |
| `footer.importReady_other` | Import pregătit · {count} de serii de confirmat |
| `footer.syncedEpisode` | Ep. {episode} sincronizat |
| `footer.syncedEpisodes_one` | {count} episod sincronizat |
| `footer.syncedEpisodes_few` | {count} episoade sincronizate |
| `footer.syncedEpisodes_other` | {count} de episoade sincronizate |

## 2026-10-17 · Account menu (status bar)

New texts of the account menu that opens above the AniList / MyAnimeList logo of the status bar (popup and side panel): the logo button's label (also when the session expired), the connection status line, three stat tiles (anime count, episodes watched, days watched, each number shown above its short label), the « Synced this week » row with its tooltip and value, and « View my profile ». Following this language's term sheet, used **contul**, **conectat** (as `settings.account.connected`), **sesiune expirată** (`common.sessionExpired`), **sincronizat**, **episod** with the forms of `footer.syncedEpisodes_*` (« de » only in the row value: the tile labels stand alone under the number); *anime* invariable; « vizionată / vizionate » agrees with *zi / zile*; « day » is **z**, as `time.countdown.days`. ` · ` kept; `{service}` is a brand name, `{name}` the user's AniList / MyAnimeList user name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `accountMenu.connected` | Conectat |
| `accountMenu.connectedAs` | {name} · conectat |
| `accountMenu.label` | Contul {service} |
| `accountMenu.labelExpired` | Contul {service}, sesiune expirată |
| `accountMenu.profile` | Vezi profilul meu |
| `accountMenu.stats.anime_one` | anime |
| `accountMenu.stats.anime_few` | anime |
| `accountMenu.stats.anime_other` | anime |
| `accountMenu.stats.days_one` | vizionată |
| `accountMenu.stats.days_few` | vizionate |
| `accountMenu.stats.days_other` | vizionate |
| `accountMenu.stats.daysValue` | {days} z |
| `accountMenu.stats.episodes_one` | episod |
| `accountMenu.stats.episodes_few` | episoade |
| `accountMenu.stats.episodes_other` | episoade |
| `accountMenu.week.label` | Sincronizate săptămâna asta |
| `accountMenu.week.title` | Episoade sincronizate de SyncKai săptămâna aceasta |
| `accountMenu.week.value_one` | {count} episod |
| `accountMenu.week.value_few` | {count} episoade |
| `accountMenu.week.value_other` | {count} de episoade |

## 2026-10-17 · Settings redesign (Preact): new and changed keys

New texts of the redesigned Settings (Preact): the Platforms and Display categories, the screen-reader names of the back button and of the category card, the row summaries of the Settings home, the Keyboard section of Display, the two sections of Shortcuts, and the section titles and notes of Accounts. Changed: `settings.cat.notifications` (now the single word: the Schedule options moved to Platforms), `settings.summary.connected` (a word instead of ✓), `settings.summary.paused` (now a standalone, capitalised summary), `settings.summary.version` (a word instead of « v »), `settings.entry.help` (the « both accounts connected » condition moved to `settings.entry.unavailable`). Summaries are joined with ` · ` by the code; `settings.account.expiredHelp` and `settings.account.otherStillSynced` are joined as two sentences. The Display summary reuses `settings.section.language`, `settings.section.panel` and `settings.shortcuts.pointer`; the My data summary the history import and backup words; the player summary `settings.player.label`. **activă / active** agree with *platforme* (`_few` and `_other` identical: « din {total} » never takes « de »). Player summary « preferată: {player} »; the Display summary uses **comenzi rapide** (category word) to stay within 45 characters. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.cat.notifications` | Notificări |
| `settings.cat.platforms` | Platforme |
| `settings.cat.display` | Afișare |
| `settings.backToAria` | Înapoi la {page} |
| `settings.group.categories` | Categorii |
| `settings.summary.connected` | {service} conectat |
| `settings.summary.notConnected` | {service} neconectat |
| `settings.summary.bothConnected` | AniList și MyAnimeList conectate |
| `settings.summary.auto` | Automată |
| `settings.summary.paused` | În pauză |
| `settings.summary.platforms_one` | {count} din {total} activă |
| `settings.summary.platforms_few` | {count} din {total} active |
| `settings.summary.platforms_other` | {count} din {total} active |
| `settings.summary.player` | preferată: {player} |
| `settings.summary.display` | Limbă, panou lateral, comenzi rapide |
| `settings.summary.data` | Importă istoricul de vizionare · backup |
| `settings.summary.version` | Versiunea {version} |
| `settings.summary.noErrors` | nicio eroare |
| `settings.display.keyboard` | Tastatură |
| `settings.display.shortcutsHelp` | Taste: marchează un episod, deschide panoul |
| `settings.shortcuts.duringPlayback` | În timpul redării |
| `settings.shortcuts.navigation` | Navigare |
| `settings.accounts.lists` | Liste sincronizate |
| `settings.accounts.both` | Cu ambele conturi |
| `settings.accounts.privacy` | Te conectezi pe site-ul AniList sau MyAnimeList: SyncKai nu îți vede niciodată parola. |
| `settings.account.expiredHelp` | Episoadele tale nu mai sunt trimise la {service} până te reconectezi. |
| `settings.account.otherStillSynced` | {service} este actualizat în continuare. |
| `settings.entry.help` | Se deschide la clic pe titlul sau coperta unui anime |
| `settings.entry.unavailable` | Disponibil când AniList și MyAnimeList sunt ambele conectate. |

## 2026-10-17 · Settings › Sync, Matches and Excluded series (Preact)

New texts of the redesigned Sync settings page and of its two sub-pages (Matches, Excluded series), moved out of My data: section titles « Automatic » / « Per series », the descriptions of the two « Episode counted as watched » cards, the « Per series » rows, the Matches intro, search, empty and no-result texts, « Show N more on {platform} », the four origin badges and their legend, the Excluded series section, note, empty hint and the « {year} series · excluded on {date} » fragments. Changed: `settings.trigger.legend` (« Episode counted as watched », where the old text was only « Episode watched »), `settings.trigger.credits` (« (recommended) » moved to `settings.trigger.creditsHelp`), and the paths of `popup.syncDisabledDetail` / `review.excludeTitle` (now nav.settings › settings.section.sync › settings.section.exclusions, built from this catalog's own titles). Removed: `settings.mappings.count_*`, `settings.mappings.help`, `settings.mappings.manage`. `{action}` is the « Re-enable » button (`settings.exclusions.help`) or the « Stop syncing this series » menu item (`settings.exclusions.emptyHelp`), so the quoted labels always match. The match / entry / excluded / re-enable words reuse this catalog's existing terms (`settings.section.mappings`, `settings.mappings.entryFallback`, `settings.section.exclusions`, `settings.exclusions.reactivate`). `_few` and `_other` of the intro differ only by « de » (« 20 de serii »), as `settings.mappings.count` did. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.section.automatic` | Automat |
| `settings.section.perSeries` | Pe serie |
| `settings.trigger.legend` | Episod considerat văzut |
| `settings.trigger.credits` | La începutul genericului |
| `settings.trigger.creditsHelp` | Recomandat: momentul exact indicat de platformă |
| `settings.trigger.percentageHelp` | Folosit și când genericul nu e cunoscut |
| `settings.sync.mappingsRow` | Asocieri memorate |
| `settings.sync.mappingsRowHelp` | Sezonul AniList ales pentru fiecare serie |
| `settings.sync.exclusionsRowHelp` | Nu se sincronizează niciodată, se pot reactiva aici |
| `settings.mappings.intro_one` | {count} serie memorată, pe platforme: sezonul de pe platformă → fișa AniList în care scrie SyncKai. O asociere uitată este recalculată la următorul episod. |
| `settings.mappings.intro_few` | {count} serii memorate, pe platforme: sezonul de pe platformă → fișa AniList în care scrie SyncKai. O asociere uitată este recalculată la următorul episod. |
| `settings.mappings.intro_other` | {count} de serii memorate, pe platforme: sezonul de pe platformă → fișa AniList în care scrie SyncKai. O asociere uitată este recalculată la următorul episod. |
| `settings.mappings.search` | Caută o serie sau o fișă |
| `settings.mappings.noResult` | Nicio asociere pentru „{query}” |
| `settings.mappings.noResultHelp` | Caută după titlul seriei sau al fișei AniList. |
| `settings.mappings.emptyHelp` | SyncKai memorează câte una pentru fiecare sezon sincronizat. |
| `settings.mappings.showMore_one` | Vezi încă {count} pe {platform} |
| `settings.mappings.showMore_few` | Vezi încă {count} pe {platform} |
| `settings.mappings.showMore_other` | Vezi încă {count} pe {platform} |
| `settings.mappings.origin.chosen` | Aleasă de tine |
| `settings.mappings.origin.learned` | Învățată |
| `settings.mappings.origin.unmarked` | Veche |
| `settings.mappings.origin.unverified` | Importată · de reverificat |
| `settings.mappings.origin.chosenHelp` | Confirmată sau aleasă de tine: nu e pusă niciodată la îndoială. |
| `settings.mappings.origin.learnedHelp` | Găsită de SyncKai: recalculată dacă platforma o contrazice. |
| `settings.mappings.origin.unmarkedHelp` | Salvată înainte de 2.4: păstrată, de verificat dacă e contrazisă. |
| `settings.mappings.origin.unverifiedHelp` | Dintr-un backup: reverificată la prima folosire. |
| `settings.mappings.originLegend` | Originea asocierilor |
| `settings.exclusions.section` | Nesincronizate niciodată |
| `settings.exclusions.help` | O serie exclusă nu mai e sincronizată niciodată, în niciun sezon. „{action}” o urmărește din nou de la următorul episod. |
| `settings.exclusions.emptyHelp` | Ca să nu mai sincronizezi o serie, alege „{action}” din meniul ei „⋯”. |
| `settings.exclusions.seriesYear` | serie din {year} |
| `settings.exclusions.excludedOn` | exclusă pe {date} |
| `popup.syncDisabledDetail` | Se poate reactiva din Setări › Sincronizare › Serii excluse |
| `review.excludeTitle` | Exclude seria (toate sezoanele): se poate reactiva din Setări › Sincronizare › Serii excluse |

## 2026-10-17 · Settings › Platforms and Notifications (Preact)

Texts of the redesigned Platforms page (list of sites with « Included » / « Access missing » or a switch, preferred player dropdown, estimated release time per platform with − / + buttons, moved there from the Schedule card) and Notifications page (« On the playback page » style cards and « New episodes »). New: `settings.platforms.where`, `settings.platforms.allAnime`, `settings.platforms.included`, `settings.platforms.accessMissing`, `settings.platforms.note`, `settings.player.openOn`, `settings.player.enableFirst`, `settings.offsets.earlier`, `settings.offsets.later`, `settings.notif.legend`. Changed: `settings.player.help`, `settings.offsets.title`, `settings.offsets.help`, `page.platformOff`, `settings.section.notifications`, `settings.notif.discreet.desc`, `settings.notif.detailed.desc`, `settings.notif.alertsOnly.desc`, `settings.notif.alertsAlways`, `settings.delay.title`, `settings.airing.enableFirst` (the notification descriptions now describe the pill and the bubble, « Extra delay » replaces « Delay », the release-time help says the alerts use it too, « Turn on alerts… » is now visible text). `page.platformOff` keeps its sentence; only the path changed, from « Settings › Playback & sync » to nav.settings › settings.cat.platforms of this catalog. Removed: `settings.section.playback`, `settings.netflix.section`, `settings.netflix.label`, `settings.disney.section`, `settings.disney.label`, `settings.prime.section`, `settings.prime.label`, `settings.airing.label`, `settings.airing.help`, `settings.section.agenda`. The Schedule word, « Open », the release-alert name and the minute unit reuse this catalog's `panel.tab.agenda`, `common.open`, `settings.quick.airing.label` and `settings.offsets.unit`. `settings.platforms.where` drops « your » (« Unde urmărește SyncKai episoadele », 33 chars) to stay under 36. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.platforms.where` | Unde urmărește SyncKai episoadele |
| `settings.platforms.allAnime` | Toate titlurile anime |
| `settings.platforms.included` | Inclusă |
| `settings.platforms.accessMissing` | Fără acces |
| `settings.platforms.note` | Activarea unei platforme cere acces la site-ul ei. Se citesc doar paginile de redare și de serii. |
| `settings.player.openOn` | Deschide episoadele pe |
| `settings.player.enableFirst` | Activeaz-o întâi |
| `settings.player.help` | Folosită de „Deschide” când un titlu e pe mai multe platforme active. |
| `settings.offsets.title` | Ora estimată a lansării |
| `settings.offsets.help` | După difuzarea din Japonia. Folosită de Calendar și de alerte; o serie se ajustează din rândul ei din Calendar. |
| `settings.offsets.earlier` | Cu {minutes} min mai devreme |
| `settings.offsets.later` | Cu {minutes} min mai târziu |
| `page.platformOff` | {platform} este dezactivat: SyncKai nu urmărește nimic aici. Pentru reactivare: Setări › Platforme. |
| `settings.section.notifications` | Pe pagina de redare |
| `settings.notif.legend` | Stilul notificărilor pe pagină |
| `settings.notif.discreet.desc` | O bulină mică timp de câteva secunde, într-un colț al videoclipului |
| `settings.notif.detailed.desc` | O bulă cu episodul și rezultatul pe AniList și MyAnimeList |
| `settings.notif.alertsOnly.desc` | Nimic când totul e în regulă; o bulă doar la o eroare sau un episod de verificat |
| `settings.notif.alertsAlways` | O eroare sau o serie de verificat apare mereu, indiferent de stil. |
| `settings.delay.title` | Întârziere extra |
| `settings.airing.enableFirst` | Activează alertele ca să verifici lansările |

## 2026-10-17 · Settings › My data, AniList ↔ MAL differences, Help & about (Preact)

Texts of the redesigned My data page (one « Import a watch history » card, Backup card, « Compare » row opening the AniList ↔ MyAnimeList differences page, which moved there from the popup's Activity screen) and Help & about page (diagnostic report row, error log that unfolds, About card with What's new / Privacy / Source code links). New: `settings.import.title`, `settings.section.compare`, `settings.compare.title`, `settings.compare.help`, `settings.data.perSeries`, `compare.align`, `compare.bulk.help`, `compare.job.background`, `settings.help.diagnostic`, `settings.help.diagnosticHelp`, `settings.help.journalNote`, `settings.about.whatsNew`, `settings.about.privacy`. Changed: `settings.crImport.help`, `settings.backup.help`, `settings.backup.import`, `settings.help.copy`, `settings.about.source` (import help in two sentences, backup help « in one file », « Import » without ellipsis, « Copy the report » next to the new « Diagnostic report » title, « Source code » with « GitHub » on the right). `help.issue.body` keeps its text; only its last-line path changed, to nav.settings › settings.cat.help › settings.help.copy of this catalog. The compare.* texts are unchanged: their context notes now point to Settings › My data. Removed: `settings.section.import`, `settings.backup.crImportTitle`, `settings.crImport.openAria`, `settings.help.text`, `settings.help.copyTitle`, `settings.help.clearHelp`, `settings.help.reportTitle`. The version line reuses `settings.summary.version`, the « Clear » button `settings.matchDiag.clear`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.import.title` | Recuperează ce ai văzut deja |
| `settings.crImport.help` | Crunchyroll, ADN sau Netflix. Vezi o previzualizare înainte să se scrie ceva. |
| `settings.backup.help` | Setări, asocieri, serii excluse și istoric într-un fișier. Niciodată datele tale de conectare AniList sau MyAnimeList. |
| `settings.backup.import` | Importă |
| `settings.section.compare` | Comparare |
| `settings.compare.title` | Diferențe AniList ↔ MyAnimeList |
| `settings.compare.help` | Compară cele două liste și aliniază-le în direcția pe care o alegi |
| `settings.data.perSeries` | Asocierile și seriile excluse se gestionează în {path}. |
| `compare.align` | Aliniere |
| `compare.bulk.help` | „{action}” copiază AniList pe MyAnimeList; mai întâi, o confirmare arată modificările. |
| `compare.job.background` | Continuă chiar dacă închizi pagina. |
| `settings.help.diagnostic` | Raport diagnostic |
| `settings.help.diagnosticHelp` | De lipit într-un raport de eroare: versiune, browser, setări, ultimele erori. Fără tokenuri, fără conturi. |
| `settings.help.copy` | Copiază raportul |
| `settings.help.journalNote` | Cel mult ultimele 50, cele mai noi primele; tokenurile sunt deja mascate. |
| `settings.about.whatsNew` | Noutăți |
| `settings.about.privacy` | Confidențialitate |
| `settings.about.source` | Cod sursă |

## 2026-10-17 · Popup « My series » row menu (Preact)

The row « … » menu of the popup's « My series » list and of the « Continue » card now groups the entry links and the platform searches in two sub-menus. New: `watching.menu.openEntry` (sub-menu entry, its items are the bare AniList / MyAnimeList names; wording taken from `page.openOn` without « on {service} »), `watching.menu.searchOn` (sub-menu entry, its items are the bare platform names; wording taken from `watching.searchOn`, ending with « … »). Changed: `settings.entry.help`, which now also says that « Default entry page » picks the list shown in « My series » (quoted with the exact `watching.mySeries` of this catalog). The « −1 episode » item left the menu (the row has its own −), `watching.minusOne` stays for the « On this page » card. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `watching.menu.openEntry` | Deschide fișa |
| `watching.menu.searchOn` | Caută pe… |
| `settings.entry.help` | Se deschide la clic pe titlul sau coperta unui anime; alege și lista din „Seriile mele” |



## 2026-10-17 · Popup « On this page » card (Preact)

The popup's « On this page » card was redesigned: the Hold / Drop / Done row and the AniList / MAL links moved to the card's « … » menu (shared with « My series »), and the season dropdown, the star rating and the comment moved to a foldable « Details » section. New: `page.currentStatus` (grey mention at the end of the menu item of the series' current status), `page.details` (foldable button listing what the section holds, same nouns as `page.seasonPicker`, the rating words of `rating.*` and `notes.title`), `page.seasonOnAniList` (title above the season dropdown), `page.seasonHelp` (help under it on an episode page; the match word is the one of `settings.section.mappings`), `page.yourRating` (title above the stars). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `page.currentStatus` | Status actual |
| `page.details` | Detalii: sezon, notă, comentariu |
| `page.seasonOnAniList` | Sezon pe AniList |
| `page.seasonHelp` | Schimbarea sezonului corectează asocierea pentru episoadele următoare. |
| `page.yourRating` | Nota ta |


## 2026-10-17 · Popup « Activity » tab (Preact)

The popup's Activity tab was redesigned: failed and pending syncs are now two sections, and every section heading is an uppercase label followed by « · {count} » added by the code. New: `queue.failedHeading` (same failure word as `queue.failed`), `queue.pendingHeading` (syncs waiting for a retry, wording of the former `queue.sectionTitle`), `ratings.heading` (the former `ratings.sectionTitle` without its count). The « To check » heading now reuses `inline.toCheck`. Removed: `queue.section`, `queue.sectionTitle`, `ratings.section`, `ratings.sectionTitle`, `review.title`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `queue.failedHeading` | Eșec |
| `queue.pendingHeading` | În așteptare |
| `ratings.heading` | De notat |


## 2026-10-17 · Side panel « Now playing » (Preact)

The side panel's « Now playing » tab was redesigned as cards: « You're watching » (live playback: bar, credits marker, countdown, sync state with an icon), « Your list » (status chip, « Progress » and the stepper, one line per account, the series « … » menu shared with the popup: Hold / Drop / Done moved there), then foldable sections « Rating and comment », Synopsis, related entries and Discussions. New: `panel.nowPlaying.watching` (heading of the live card, addresses the user), `panel.nowPlaying.list` (heading of the list card, same « your list » words as `page.notInList`), `panel.nowPlaying.ratingNotes` (section title, same nouns as `page.yourRating` and `notes.title`), `panel.live.creditsAt` and `panel.live.creditsUnknown` (legend of the yellow marker under the bar, credits word of `settings.trigger.credits`), `panel.live.countdownCredits` and `panel.live.countdownRatio` (countdown line, wording of the former `panel.live.countdown` plus what the sync waits for, as in `settings.trigger.credits` / `settings.summary.percentage`). Changed: `panel.live.synced` lost its trailing « ✓ » (a check icon now precedes it). The « Progress » label reuses `compare.filter.progress`. Removed: `page.action.COMPLETED`, `page.action.DROPPED`, `page.action.PAUSED` (the status button row is gone), `panel.live.countdown`, `panel.nowPlaying.progress`, `watching.nextWatched`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `panel.nowPlaying.watching` | Urmărești |
| `panel.nowPlaying.list` | Lista ta |
| `panel.nowPlaying.ratingNotes` | Notă și comentariu |
| `panel.live.creditsAt` | Generic la {time} |
| `panel.live.creditsUnknown` | Generic necunoscut · sincronizare la {percent} % |
| `panel.live.countdownCredits` | Sincronizare în {time} · la începutul genericului |
| `panel.live.countdownRatio` | Sincronizare în {time} · la {percent} % din episod |
| `panel.live.synced` | Sincronizat |


## 2026-10-17 · Side panel Schedule (Preact) and week picker

The Schedule tab of the side panel was redesigned: days in order with « No episode » on empty days, episode lines « 18:00 Crunchyroll · Japan 17:00 » (the platform time first, the Japanese broadcast last and cut first), a « ⋯ » menu with « Adjust time » (its second line gives the time and whether the delay is the series' own or the default), « Open the entry › » and « Search on… › », and a week button that opens a month calendar. New: `agenda.adjust.custom` and `agenda.adjust.default` (second line of « Adjust time », lower case after « · »), `agenda.adjust.platform` (first sentence of `agenda.estimate.title`, shown in the delay editor), `agenda.picker.label`, `agenda.picker.prevMonth`, `agenda.picker.nextMonth`, `agenda.picker.thisWeek`, `agenda.picker.hint` (month calendar; the hint names the arrow keys and the Enter key). Changed: `agenda.jp` writes the country name instead of « JP » (unchanged where it already did: ja, ko, zh-CN, zh-TW). Removed: `watching.searchOn` (the search entries are now the platform names of the « Search on… › » sub-menu). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `agenda.jp` | Japonia {time} |
| `agenda.adjust.custom` | setat pentru această serie |
| `agenda.adjust.default` | întârziere implicită |
| `agenda.adjust.platform` | Lansare estimată pe {platform}: difuzarea din Japonia {offset}. |
| `agenda.picker.label` | Alege o săptămână |
| `agenda.picker.prevMonth` | Luna anterioară |
| `agenda.picker.nextMonth` | Luna următoare |
| `agenda.picker.thisWeek` | Săptămâna aceasta |
| `agenda.picker.hint` | ↑ ↓ pentru a schimba săptămâna, Enter pentru a o afișa. |
