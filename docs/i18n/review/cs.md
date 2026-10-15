# Czech (`cs`) review log

Independent native review of `src/i18n/locales/cs.json` (934 English keys, 990 Czech entries with the `_one` / `_few` / `_other` plural variants) and `public/_locales/cs/messages.json`, 2026-10-14. Inputs: `docs/i18n/GLOSSARY.md`, `docs/i18n/glossary/cs.md`, `docs/i18n/context.json`, `en.json`, `fr.json`, `de.json`.

Method: terminology audit (concordance of every core term across the catalog: seriál, řada, epizoda, seznam, záznam, synchronizace, ověření, hodnocení, komentář, přiřazení, sladit, vyloučený, čekající synchronizace, titulky, okno rozšíření, boční panel, karta, Právě běží, Kalendář, výchozí platforma, import historie sledování, záloha, náhled, opakované sledování, účet / připojit / relace, upozornění, Nastavení and its categories, the six statuses, Aktivita, Sleduji); key-by-key reading of all keys with their context notes (meaning, grammar, register, placeholders, composed texts, cross-references, lengths); a second, Czech-only read for naturalness; plurals rendered for 0, 1, 2, 3, 5, 11, 21, 22, 25, 101 with `Intl.PluralRules('cs')`; gender-neutrality scan (no participle or adjective agreeing with the user); typography scan („…“ quotes, `…`, `85 %`, dashes). Compositions checked in the code where the note left a doubt (`airing.status.failed` after `Poslední kontrola: … · `, `src/shared/airing.types.ts`; the trigger of `sync.noServiceFollows`, `resolveTargets` in `src/background/controls.ts` and `engagement.ts`). External names verified: Netflix CZ „Divácká historie“ and „Zobrazit více“ (help.netflix.com/cs/node/101917), Firefox CZ „Správa klávesových zkratek pro rozšíření“ (mozilla-l10n `cs/toolkit/toolkit/about/aboutAddons.ftl`).

Result: 34 keys changed in `cs.json` (meaning 6, terminology 5, style 8, grammar 4, cross-reference 4, placeholder 4, consistency 3); `messages.json` unchanged (`extDescription` 85 characters, both command texts identical to `settings.shortcuts.episode` / `settings.shortcuts.panel`). No plural, typography or gender-agreement error was found: the translation was already solid on those points. `npm run i18n:check -- cs`: 0 errors, 47 length warnings (reviewed below).

## Changes

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `airing.notification.message` | Odvysíláno v Japonsku · na Crunchyrollu/ADN obvykle vyjde do pár hodin | Odvysíláno v Japonsku · na Crunchyroll/ADN obvykle dorazí do pár hodin | grammar | The body is also shown under the multi-episode summary title; *vyjde* is singular-only and had no subject. *dorazí* is both 3sg and 3pl. |
| `airing.status.failed` | chyba: {error} | selhala: {error} | grammar | Appended to `Poslední kontrola: … · `; *selhala* agrees with *kontrola* and avoids *chyba: Neznámá chyba*. |
| `api.httpError` | Chyba {service} ({status}). | Chyba služby {service} ({status}). | placeholder | *Chyba AniList* puts an undeclinable name in a genitive slot; apposition after *služby* (term sheet rule). |
| `compare.bulk.filtered.anilist` | Filtr podle AniListu | Výběr podle AniListu | meaning | *Filtr podle AniListu* reads as one more filter control next to the filter chips; the button copies AniList values to the filtered series. |
| `compare.bulk.filtered.mal` | Filtr podle MAL | Výběr podle MAL | meaning | Same as compare.bulk.filtered.anilist. |
| `compare.filter.empty` | Žádný seriál pro tento filtr. | Tomuto filtru neodpovídá žádný seriál. | style | Calque (*pro tento filtr*); natural Czech says the filter matches nothing. |
| `compare.job.retryFailed` | Zkusit znovu neúspěšné | Zopakovat neúspěšné | style | *Zkusit znovu neúspěšné* is clumsy; *Zopakovat neúspěšné* is idiomatic and shorter. |
| `crImport.read.error.netflixLoggedOut` | Na té kartě se přihlas k Netflixu a vyber svůj profil, pak se vrať na stránku „Aktivita sledování“ a načti historii znovu. | Na té kartě se přihlas k Netflixu a vyber svůj profil, pak se vrať na stránku „Divácká historie“ a načti historii znovu. | cross-reference | Netflix CZ names the Viewing activity page *Divácká historie* (help.netflix.com/cs/node/101917); *Aktivita sledování* does not exist there. |
| `crImport.netflix.rule` | Netflix: SyncKai načte historii tlačítkem pro zobrazení dalších položek na stránce „Aktivita sledování“ (na nic jiného neklikne), ponechá anime nalezená na AniListu a přečte jejich postup. | Netflix: SyncKai načte historii tlačítkem „Zobrazit více“ na stránce „Divácká historie“ (na nic jiného neklikne), ponechá anime nalezená na AniListu a přečte jejich postup. | cross-reference | Real Netflix CZ page and button names (*Divácká historie*, *Zobrazit více*), as the note asks; the button was only paraphrased before. |
| `crImport.netflix.keepTab` | Nech kartu Netflixu otevřenou na stránce „Aktivita sledování“: čtení může trvat pár minut. | Nech kartu Netflixu otevřenou na stránce „Divácká historie“: čtení může trvat pár minut. | cross-reference | Netflix CZ page name *Divácká historie*. |
| `crImport.skip.sessionClosed` | {service}: účet se během importu odhlásil nebo změnil, nic se nezapsalo | {service}: během importu došlo k odhlášení nebo změně účtu, nic se nezapsalo | style | *účet se odhlásil* (an account signing itself out) is unnatural; impersonal, still gender-neutral. |
| `crImport.error.sessionClosed` | Účet se během analýzy odhlásil nebo změnil: spusť analýzu znovu. | Během analýzy došlo k odhlášení nebo změně účtu: spusť analýzu znovu. | style | Same as crImport.skip.sessionClosed. |
| `engagement.notCompleted` | Záznam není dokončený: opakované sledování nezačne | Není ve stavu Dokončeno: opakované sledování nezačne | meaning | *Záznam není dokončený* says the entry is unfinished; the reason is that the list status is not Completed. |
| `footer.chip.expired` | Relace účtu {service} vypršela – otevřít nastavení | Relace účtu {service} vypršela – otevřít Nastavení | consistency | *Nastavení* is capitalised when it names SyncKai's screen everywhere else (aria-label only). |
| `footer.chip.ok` | Účet {service} je připojený – otevřít nastavení | Účet {service} je připojený – otevřít Nastavení | consistency | Same as footer.chip.expired. |
| `import.intro` | Nastavení, přiřazení, vyloučené seriály a historie. Přihlašovací údaje AniList/MAL nikdy nejsou součástí zálohy. | Nastavení, přiřazení, vyloučené seriály a historie synchronizací. Přihlašovací údaje AniList/MAL nikdy nejsou součástí zálohy. | terminology | The backup holds SyncKai's sync history; bare *historie* read as the watch history of *Import historie sledování* (note: not a streaming history). |
| `import.replaceWarning` | Tvoje současná přiřazení, vyloučené seriály a historie budou vymazány. Pokračovat? | Tvoje současná přiřazení, vyloučené seriály a historie synchronizací budou vymazány. Pokračovat? | terminology | Same as import.intro. |
| `import.subtitle` | Exportuj nebo importuj svoje nastavení, přiřazení a historii. | Exportuj nebo importuj svoje nastavení, přiřazení a historii synchronizací. | terminology | Same as import.intro. |
| `onboarding.hint.anilist` | Doporučeno pro přiřazování | Doporučeno pro rozpoznávání anime | meaning | Welcome screen: *přiřazování* is jargon a newcomer cannot decode; the note defines matching as identifying the anime. |
| `panel.live.pointRatio` | Synchronizace u {percent} % | Synchronizace při {percent} % | grammar | *u 85 %* is unidiomatic for a threshold; *při 85 %*. |
| `panel.live.unreachable` | Pro sledování přehrávání obnov kartu. | Obnov kartu, aby SyncKai mohl hlídat přehrávání. | terminology | Tracking by SyncKai is *hlídat* (term sheet); *sledování přehrávání* read as the user watching. |
| `queue.abandonAria` | Odstranit synchronizaci {title} | Odstranit synchronizaci: {title} | placeholder | {title} = *Frieren · S1 E5* in a genitive slot; a colon keeps it nominative. |
| `queue.retryAria` | Zkusit znovu synchronizaci {title} | Zkusit znovu synchronizaci: {title} | placeholder | Same as queue.abandonAria. |
| `queue.sessionClosed` | Účet se mezitím odhlásil, synchronizace byla odstraněna bez zápisu. | Účet byl mezitím odhlášen: synchronizace byla odstraněna bez zápisu. | style | Same as crImport.skip.sessionClosed (passive *byl odhlášen*). |
| `ratings.ignoreAria` | Přeskočit hodnocení {title} | Přeskočit hodnocení seriálu {title} | placeholder | Title in a genitive slot; declined head noun *seriálu*. |
| `settings.backup.help` | Nastavení, přiřazení, vyloučené seriály a historie. Nikdy přihlašovací údaje AniList/MAL. | Nastavení, přiřazení, vyloučené seriály a historie synchronizací. Nikdy přihlašovací údaje AniList/MAL. | terminology | Same as import.intro. |
| `settings.mappings.forgetAria` | Zapomenout {label} | Zapomenout přiřazení: {label} | meaning | *Zapomenout One Piece · S2* sounded like forgetting the series; it forgets the match. |
| `settings.shortcut.manualFirefox` | Pro změnu: about:addons › ozubené kolečko › Spravovat klávesové zkratky rozšíření. | Pro změnu: about:addons › ozubené kolečko › Správa klávesových zkratek pro rozšíření. | cross-reference | Firefox CZ label of the gear-menu item (mozilla-l10n cs aboutAddons.ftl `addon-manage-extensions-shortcuts`). |
| `settings.shortcuts.help` | Tebou změněná klávesa se při aktualizacích zachová. Pokud klávesa chybí nebo ji už používá prohlížeč či jiné rozšíření, nastav jinou přes „Změnit“ nebo „Nastavit“. | Klávesa, kterou si změníš, se při aktualizacích zachová. Pokud klávesa chybí nebo ji už používá prohlížeč či jiné rozšíření, nastav jinou přes „Změnit“ nebo „Nastavit“. | style | *Tebou změněná klávesa* is stilted; a present-tense relative clause is natural and still gender-neutral. |
| `sync.noServiceFollows` | Žádná připojená služba nemá tento seriál v seznamu. | Žádná připojená služba nemá pro tento seriál záznam. | meaning | Raised when no connected service has an ID for the anime (`resolveTargets`), not when it is missing from the list (that is engagement.notInList); the old text pointed users to the wrong fix. |
| `sync.sessionClosed` | Účet se mezitím odhlásil nebo změnil: nic se nezapsalo | Mezitím došlo k odhlášení nebo změně účtu: nic se nezapsalo | style | Same as crImport.skip.sessionClosed; reads well once lowercased after `{service}: `. |
| `watching.tip` | Netflix, Disney+ (volitelně) a výchozí platformu nastavíš v {path}. | Netflix, Disney+ (volitelně) a výchozí platformu najdeš v {path}. | style | *nastavíš v Nastavení › …* echoes the same root; *najdeš v*. |
| `settings.backHomeAria` | Zpět do nastavení | Zpět do Nastavení | consistency | Same as footer.chip.expired. |
| `settings.summary.percentage` | u {percent} | při {percent} | grammar | Same as panel.live.pointRatio (*Crunchyroll · při 85 %*). |

## Term sheet changes (`docs/i18n/glossary/cs.md`)

- Netflix: the Viewing activity page is **„Divácká historie“** (was the unconfirmed guess „Aktivita sledování“) and its button **„Zobrazit více“** (was unknown); sources recorded.
- Firefox: gear-menu item **Správa klávesových zkratek pro rozšíření** recorded.
- match to (`compare.*`): the filtered set of the bulk buttons is **výběr** (*Výběr podle MAL*), never *Filtr podle…*.
- backup: the history a backup contains is **historie synchronizací**, never bare *historie*.
- tracking: *hlídat* example added (*Obnov kartu, aby SyncKai mohl hlídat přehrávání*).
- match: the welcome screen describes matching as *rozpoznávání anime*.
- Conventions: gender-neutral patterns updated (*Klávesa, kterou si změníš*, *došlo k odhlášení nebo změně účtu*, never *účet se odhlásil*); thresholds take *při* (*při 85 %*); composition `Poslední kontrola: … · selhala: {error}`; a placeholder in a genitive slot gets a declined head noun or a colon; capitalisation rule aligned with the catalog (*ve stavu Dokončeno*, *na kartě Aktivita*, *v Nastavení* vs *nastavení prohlížeče*).

## Length warnings (`i18n:check`)

The 47 warnings compare characters, placeholders included. Checked against each context note: all fit their stated limits except the four below, kept on purpose.

- `settings.cat.sync` „Přehrávání a synchronizace“: 26 characters for a ≤ 24 limit. It is also the second half of every `Nastavení › …` path; no shorter wording without the *sync* slang the term sheet bans. The home row has room; the sub-page top bar may truncate it.
- `compare.filter.missingAniList` „Chybí na AniListu“: 17 for ≤ 16 (German is 17 too); kept identical to the row chip.
- `settings.mappings.resetConfirm` „Zapomenout všechna přiřazení?“: 29 for ≤ 28 (French is 36).
- `common.stopSync` „Už nesynchronizovat“: 19 for about 16; *Vyloučit* would be shorter but loses the friendly wording chosen for the action.
- New warnings from this review are harmless: `ratings.ignoreAria` and `settings.mappings.forgetAria` are screen-reader labels; `panel.live.pointRatio` renders as „Synchronizace při 85 %“ (22 characters).

## Debatable, left unchanged

- Status set: first person for Watching / Plan to watch / Rewatching (*Sleduji*, *Chci vidět*, *Znovu sleduji*) and neuter participles for Completed / On hold / Dropped (*Dokončeno*, *Pozastaveno*, *Zahozeno*). Consistent with the term sheet and gender-neutral; fans also say *dropnuto*, kept out as slang.
- *Pozastaveno* is both the On hold status and the paused auto sync (`settings.summary.paused`, `settings.autoSync.helpOff`); English shares "paused" the same way and the contexts never meet.
- Colloquial *dokoukaná* / *dokoukej* (`crImport.netflix.noAnime_*`, `crImport.error.empty`, `panel.nowPlaying.notFoundHint`): fits the fan-to-fan tone; *celá zhlédnutá* would be the neutral alternative.
- *u titulků* (`onboarding.step3`, `panel.live.pointCredits`, `settings.summary.credits`): always with a timing word, so it cannot read as subtitles; *u závěrečných titulků* does not fit those slots.
- `panel.nowPlaying.watch` *Sledovat*: on social sites it also means "Follow"; next to a platform logo it reads as "Watch", the JustWatch CZ convention (*Sledovat nyní*). *Přehrát* would promise immediate playback.
- `prompt.rating.title` `„{title}“ dokončeno!`: neuter agreement with a quoted title is normal Czech; `feedback.completedTitle` uses the colon form.
- `crImport.read.error.adnLoggedOut` *(pokud už přihlášení proběhlo, obnov stránku)*: a little stiff, but the natural *pokud už jsi přihlášený/á* would be gendered.
- `compare.breakdown.progress/score/status` use a label form (*postup: 30*) next to *290 chybí na MAL*: a count of "differences" has no elliptical noun in Czech.
- `content.unreachable.title` *SyncKai nereaguje* ("not responding") rather than *není dostupný*: closer to what the user experiences, and `content.unreachable.full` matches it.
- `page.openOn` *Otevřít záznam {service}* and `settings.mappings.entryFallback` *Záznam AniList #{id}*: brand-name apposition like *účet Google*, accepted in Czech UI.
- `review.format.tvShort` *Krátký TV seriál* (16 characters): no established short Czech term for TV_SHORT.
- `settings.help.copyTitle` *názvy účtů*: *uživatelská jména* would be more precise but longer.

## Outside the catalog (code)

`src/platforms/netflix/tab-op.ts` › `netflixTabOp` finds Netflix's "Show more" button by its text, among `['voir plus', 'afficher plus', 'show more', 'see more', 'load more', 'mehr anzeigen', 'weitere anzeigen', 'mehr laden']`. A Netflix profile set to Czech shows **„Zobrazit více“**, which is not in the list, so a Czech-profile Netflix history import would stop after the first rows (read as a short or partial history). The label depends on the Netflix profile language, not on SyncKai's UI language, so every Netflix UI language needs its label (or a language-independent selector). Not changed here: outside the files of this review.

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | Zima / Jaro / Léto / Podzim | Zima {year} / Jaro {year} / Léto {year} / Podzim {year} | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |

Code fixes that change how this catalog is displayed:

- Netflix history import: the “Zobrazit více” button of a Netflix profile in this language is recognized (label checked by the reviewer on Netflix’s help article 101917 in this language): such an import no longer stops after the first rows as if the history were complete.
- The signed delays of the Schedule tooltips (`agenda.estimate.*`) now use `time.countdown.*`: “+1 h 30 min”.
- Lists of names in `{services}` and `{titles}` use the language’s own conjunction (`Intl.ListFormat`) instead of “, ”.

Layout (`npm run test:i18n-layout`), fixed in the components without changing the text: `queue.failed` (Activity › pending syncs): the buttons go below the status when it is long; `page.action.PAUSED` (side panel at 320 px): the icons are hidden when the side panel is narrow.

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). Same text in every variant (the wording already avoided the noun agreement), `{total}` renamed `{count}`.

| Key | Text |
|---|---|
| `sync.beyondEntry_one` | Epizoda {progress} přesahuje počet epizod záznamu ({count}) |
| `sync.beyondEntry_few` | Epizoda {progress} přesahuje počet epizod záznamu ({count}) |
| `sync.beyondEntry_other` | Epizoda {progress} přesahuje počet epizod záznamu ({count}) |

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | Tlačítko „Zobrazit více“ se v jazyce tvého profilu Netflix nepodařilo rozpoznat: načetly se jen nejnovější epizody. Nastav na Netflixu tomuto profilu stejný jazyk jako v SyncKai a načti historii znovu. |

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video (jen anime) |
| `settings.prime.label` | Synchronizovat na Prime Video |
| `settings.prime.helpOff` | Synchronizují se jen anime (žánr anime nebo animace s japonským zvukem či s přesným názvem z AniListu). Prohlížeč si vyžádá přístup k primevideo.com |
| `settings.prime.helpOn` | SyncKai čte jen to, co stránka Prime Video už dostává. Na už otevřené kartě Prime Video začne hlídání od další epizody |
| `settings.prime.denied` | Přístup k primevideo.com byl odepřen: synchronizace na Prime Video zůstává vypnutá |
| `settings.prime.disabled` | Prime Video vypnuto: pro úplné zastavení obnov otevřené karty Prime Video |
| `settings.prime.error` | Přístup k Prime Video se nepodařilo změnit, zkus to znovu |

| Key | Text |
|---|---|
| `onboarding.intro` | Sleduj anime na Crunchyrollu nebo ADN (Netflix, Disney+ a Prime Video volitelně): SyncKai na konci každé epizody aktualizuje tvůj seznam. |
| `watching.tip` | Netflix, Disney+, Prime Video (volitelně) a výchozí platformu najdeš v {path}. |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | Odpovídá platformě: {signals} |
| `match.signalsContradict` | Neodpovídá platformě: {signals} |
| `match.yearRemake` | Remake rozlišený podle roku vydání ({year}) |
| `match.signal.year` | rok vydání |
| `match.signal.episodes` | počet epizod |
| `match.signal.duration` | délka epizod |
| `match.signal.format` | formát (film nebo seriál) |
| `match.signal.country` | země původu |
| `match.signal.originalTitle` | původní název |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | Zapamatované přiřazení neodpovídá platformě: {signals} |

## 2026-10-14 · Matching diagnostic (development builds only)

New keys `settings.matchDiag.*` (Settings › Help & about, section shown only in development builds, never in the published extension): the last 50 AniList matching decisions, a « Copy » button per row (one decision as JSON, for the test corpus) and a « Clear » button. `{count}` follows a label and a colon (no plural form); `JSON` is a format name. Terms from this language's term sheet (match, entry). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.title` | Diagnostika přiřazení |
| `settings.matchDiag.text` | Jen ve vývojových buildech: posledních 50 rozhodnutí o přiřazení na AniListu, od nejnovějšího, uložených do zavření prohlížeče. Zkopíruj jedno jako JSON a přidej ho do testovacího korpusu. |
| `settings.matchDiag.empty` | Zatím žádné zaznamenané rozhodnutí |
| `settings.matchDiag.copy` | Kopírovat |
| `settings.matchDiag.copyTitle` | Zkopírovat toto rozhodnutí jako JSON |
| `settings.matchDiag.copied` | Zkopírováno |
| `settings.matchDiag.copyFailed` | Rozhodnutí se nepodařilo zkopírovat. |
| `settings.matchDiag.clear` | Vymazat |
| `settings.matchDiag.candidates` | Kandidáti: {count} |
| `settings.matchDiag.noEntry` | Žádný záznam |

## 2026-10-15 · Debug trace (development builds only)

New keys `settings.debugTrace.*` (Settings › Help & about, section shown only in development builds, never in the published extension, below the matching diagnostic): a timeline of what the extension did (pages, service worker, AniList and MyAnimeList requests), a verbose switch, a category filter (category names stay in English: technical identifiers), « Copy trace » (the whole trace as JSON) and the « Clear » button of the matching diagnostic (`settings.matchDiag.clear`, reused). `{count}` and `{max}` follow a label and a colon (no plural form) and arrive formatted for the language; `JSON` is a format name; `service worker` kept as the browser's technical term. New terms added to this language's term sheet (debug trace, event, verbose mode); other terms from it (account). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.debugTrace.title` | Ladicí záznam |
| `settings.debugTrace.text` | Jen ve vývojových buildech: průběh toho, co SyncKai dělal na stránkách, v service workeru a s AniListem a MyAnimeListem, od nejnovějšího, uložený do zavření prohlížeče. Neukládají se žádné tokeny, cookies ani ID účtů. Zkopíruj celý záznam jako JSON a sdílej ho při hlášení problému. |
| `settings.debugTrace.empty` | Zatím se nezaznamenala žádná událost |
| `settings.debugTrace.copy` | Kopírovat záznam |
| `settings.debugTrace.copied` | Zkopírováno |
| `settings.debugTrace.copyFailed` | Záznam se nepodařilo zkopírovat. |
| `settings.debugTrace.verbose` | Podrobný režim (všechny řádky protokolu) |
| `settings.debugTrace.count` | Události: {count} / {max} |
| `settings.debugTrace.allCategories` | Všechny kategorie |
| `settings.debugTrace.filterAria` | Filtrovat události podle kategorie |
