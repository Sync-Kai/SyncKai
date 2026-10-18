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

## 2026-10-16 · Matching diagnostic: Copy all (development builds only)

New keys in the « Matching diagnostic » section (Settings › Help & about, development builds only, never in the published extension, now collapsed by default behind its title): « Copy all » copies every recorded decision as one JSON array, next to « Clear »; its label becomes « Copied » (`settings.matchDiag.copied`, reused) and a failure reuses `settings.matchDiag.copyFailed`. `JSON` is a format name. Same word for « decision » as `settings.matchDiag.copyTitle`, in the plural; other terms from this language's term sheet. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.copyAll` | Kopírovat vše |
| `settings.matchDiag.copyAllTitle` | Zkopírovat všechna rozhodnutí jako JSON |

## 2026-10-16 · Episode guards (« To check » reasons)

New reasons on a « To check » card (`fix/episode-guards`, audit SEC-01): a sync that would jump straight to the last episode from far behind, and episodes reported as finished in a burst, now wait for the user instead of being written. Same « to check » term as `match.otherSeriesExcluded`, same episode wording as `sync.beyondEntry_*`; `{from}` and `{progress}` are episode numbers. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `sync.review.finaleJump` | Přímý skok na poslední epizodu ({progress}) z epizody {from}: je třeba ověřit |
| `sync.review.burst` | Mnoho epizod dokončeno během několika minut: je třeba ověřit |

## 2026-10-17 · Status bar (popup and side panel)

New texts of the status bar shown at the bottom of the popup and, now, of the side panel (`feature/ui-status-bar`): a synced episode or a count of synced episodes under the series title, shown until the user hides it (« Seen, hide », a × button label), and the history import running, ready to confirm and done. Same words as this language's term sheet: « synchronizace » (participle « synchronizována », feminine after « Ep. »), « seriál », « epizoda » / « Ep. », « import » (« Import dokončen » as in `crImport.apply.done`), « k potvrzení » (from « Potvrdit ») and « aktualizován » as in `compare.result.updated_*`; `{platform}` after « z platformy » as in `settings.crImport.openAria`; ` · ` and ` / ` kept; `{platform}` is a brand name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `footer.dismiss` | Přečteno, skrýt |
| `footer.importDone_one` | Import dokončen · {count} seriál aktualizován |
| `footer.importDone_few` | Import dokončen · {count} seriály aktualizovány |
| `footer.importDone_other` | Import dokončen · {count} seriálů aktualizováno |
| `footer.importProgress` | Import z platformy {platform} · {done} / {total} |
| `footer.importReady_one` | Import připraven · {count} seriál k potvrzení |
| `footer.importReady_few` | Import připraven · {count} seriály k potvrzení |
| `footer.importReady_other` | Import připraven · {count} seriálů k potvrzení |
| `footer.syncedEpisode` | Ep. {episode} synchronizována |
| `footer.syncedEpisodes_one` | {count} epizoda synchronizována |
| `footer.syncedEpisodes_few` | {count} epizody synchronizovány |
| `footer.syncedEpisodes_other` | {count} epizod synchronizováno |

## 2026-10-17 · Account menu (status bar)

New texts of the account menu that opens above the AniList / MyAnimeList logo of the status bar (popup and side panel): the logo button's label (also when the session expired), the connection status line, three stat tiles (anime count, episodes watched, days watched, each number shown above its short label), the « Synced this week » row with its tooltip and value, and « View my profile ». Following this language's term sheet, used **účet**, **připojeno** (as `settings.account.connected`), **relace vypršela** (`common.sessionExpired`), **synchronizovat** and **epizoda** with the plural forms of `footer.syncedEpisodes_*`; *anime* stays indeclinable; the days tile label is the noun **sledování** (watching), valid for every count; « day » is **d**, as `time.countdown.days`. ` · ` kept; `{service}` is a brand name, `{name}` the user's AniList / MyAnimeList user name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `accountMenu.connected` | Připojeno |
| `accountMenu.connectedAs` | {name} · připojeno |
| `accountMenu.label` | Účet {service} |
| `accountMenu.labelExpired` | Účet {service}, relace vypršela |
| `accountMenu.profile` | Zobrazit můj profil |
| `accountMenu.stats.anime_one` | anime |
| `accountMenu.stats.anime_few` | anime |
| `accountMenu.stats.anime_other` | anime |
| `accountMenu.stats.days_one` | sledování |
| `accountMenu.stats.days_few` | sledování |
| `accountMenu.stats.days_other` | sledování |
| `accountMenu.stats.daysValue` | {days} d |
| `accountMenu.stats.episodes_one` | epizoda |
| `accountMenu.stats.episodes_few` | epizody |
| `accountMenu.stats.episodes_other` | epizod |
| `accountMenu.week.label` | Synchronizováno tento týden |
| `accountMenu.week.title` | Epizody, které SyncKai tento týden synchronizoval |
| `accountMenu.week.value_one` | {count} epizoda |
| `accountMenu.week.value_few` | {count} epizody |
| `accountMenu.week.value_other` | {count} epizod |

## 2026-10-17 · Settings redesign (Preact): new and changed keys

New texts of the redesigned Settings (Preact): the Platforms and Display categories, the screen-reader names of the back button and of the category card, the row summaries of the Settings home, the Keyboard section of Display, the two sections of Shortcuts, and the section titles and notes of Accounts. Changed: `settings.cat.notifications` (now the single word: the Schedule options moved to Platforms), `settings.summary.connected` (a word instead of ✓), `settings.summary.paused` (now a standalone, capitalised summary), `settings.summary.version` (a word instead of « v »), `settings.entry.help` (the « both accounts connected » condition moved to `settings.entry.unavailable`). Summaries are joined with ` · ` by the code; `settings.account.expiredHelp` and `settings.account.otherStillSynced` are joined as two sentences. The Display summary reuses `settings.section.language`, `settings.section.panel` and `settings.shortcuts.pointer`; the My data summary the history import and backup words; the player summary `settings.player.label`. Platform count « Zapnuto: {count} z {total} » in every plural form (no agreement). Genitive slots get the head noun *služba* (« do služby {service} », « Služba {service} … »); « Připojeno: AniList a MyAnimeList » avoids the gender of the brands. Player summary « výchozí: {player} ». Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.cat.notifications` | Upozornění |
| `settings.cat.platforms` | Platformy |
| `settings.cat.display` | Zobrazení |
| `settings.backToAria` | Zpět na stránku {page} |
| `settings.group.categories` | Kategorie |
| `settings.summary.connected` | {service} připojeno |
| `settings.summary.notConnected` | {service} nepřipojeno |
| `settings.summary.bothConnected` | Připojeno: AniList a MyAnimeList |
| `settings.summary.auto` | Automaticky |
| `settings.summary.paused` | Pozastaveno |
| `settings.summary.platforms_one` | Zapnuto: {count} z {total} |
| `settings.summary.platforms_few` | Zapnuto: {count} z {total} |
| `settings.summary.platforms_other` | Zapnuto: {count} z {total} |
| `settings.summary.player` | výchozí: {player} |
| `settings.summary.display` | Jazyk, boční panel, klávesové zkratky |
| `settings.summary.data` | Import historie sledování · záloha |
| `settings.summary.version` | Verze {version} |
| `settings.summary.noErrors` | žádné chyby |
| `settings.display.keyboard` | Klávesnice |
| `settings.display.shortcutsHelp` | Klávesy pro označení epizody nebo otevření panelu |
| `settings.shortcuts.duringPlayback` | Při přehrávání |
| `settings.shortcuts.navigation` | Navigace |
| `settings.accounts.lists` | Synchronizované seznamy |
| `settings.accounts.both` | S oběma účty |
| `settings.accounts.privacy` | Přihlašuješ se na webu AniList nebo MyAnimeList: SyncKai tvoje heslo nikdy nevidí. |
| `settings.account.expiredHelp` | Tvoje epizody se do služby {service} neodesílají, dokud se znovu nepřipojíš. |
| `settings.account.otherStillSynced` | Služba {service} se dál aktualizuje. |
| `settings.entry.help` | Otevře se po kliknutí na název nebo obal anime |
| `settings.entry.unavailable` | Dostupné, když jsou připojené AniList i MyAnimeList. |

## 2026-10-17 · Settings › Sync, Matches and Excluded series (Preact)

New texts of the redesigned Sync settings page and of its two sub-pages (Matches, Excluded series), moved out of My data: section titles « Automatic » / « Per series », the descriptions of the two « Episode counted as watched » cards, the « Per series » rows, the Matches intro, search, empty and no-result texts, « Show N more on {platform} », the four origin badges and their legend, the Excluded series section, note, empty hint and the « {year} series · excluded on {date} » fragments. Changed: `settings.trigger.legend` (« Episode counted as watched », where the old text was only « Episode watched »), `settings.trigger.credits` (« (recommended) » moved to `settings.trigger.creditsHelp`), and the paths of `popup.syncDisabledDetail` / `review.excludeTitle` (now nav.settings › settings.section.sync › settings.section.exclusions, built from this catalog's own titles). Removed: `settings.mappings.count_*`, `settings.mappings.help`, `settings.mappings.manage`. `{action}` is the « Re-enable » button (`settings.exclusions.help`) or the « Stop syncing this series » menu item (`settings.exclusions.emptyHelp`), so the quoted labels always match. The match / entry / excluded / re-enable words reuse this catalog's existing terms (`settings.section.mappings`, `settings.mappings.entryFallback`, `settings.section.exclusions`, `settings.exclusions.reactivate`). Counts written « Zapamatované seriály: {count} » and « Zobrazit další na {platform} ({count}) » in every plural form (no agreement). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.section.automatic` | Automaticky |
| `settings.section.perSeries` | Pro jednotlivé seriály |
| `settings.trigger.legend` | Kdy se epizoda počítá jako zhlédnutá |
| `settings.trigger.credits` | Na začátku závěrečných titulků |
| `settings.trigger.creditsHelp` | Doporučeno: přesný okamžik, který udává platforma |
| `settings.trigger.percentageHelp` | Použije se i tehdy, když titulky nejsou známé |
| `settings.sync.mappingsRow` | Zapamatovaná přiřazení |
| `settings.sync.mappingsRowHelp` | Řada z AniList zvolená pro každý seriál |
| `settings.sync.exclusionsRowHelp` | Nikdy se nesynchronizují, tady je lze znovu zapnout |
| `settings.mappings.intro_one` | Zapamatované seriály: {count}, podle platformy: řada na platformě → záznam AniList, do kterého SyncKai zapisuje. Zapomenuté přiřazení se při další epizodě určí znovu. |
| `settings.mappings.intro_few` | Zapamatované seriály: {count}, podle platformy: řada na platformě → záznam AniList, do kterého SyncKai zapisuje. Zapomenuté přiřazení se při další epizodě určí znovu. |
| `settings.mappings.intro_other` | Zapamatované seriály: {count}, podle platformy: řada na platformě → záznam AniList, do kterého SyncKai zapisuje. Zapomenuté přiřazení se při další epizodě určí znovu. |
| `settings.mappings.search` | Hledat seriál nebo záznam |
| `settings.mappings.noResult` | Žádné přiřazení pro „{query}“ |
| `settings.mappings.noResultHelp` | Hledej podle názvu seriálu nebo záznamu AniList. |
| `settings.mappings.emptyHelp` | SyncKai si zapamatuje jedno pro každou synchronizovanou řadu. |
| `settings.mappings.showMore_one` | Zobrazit další na {platform} ({count}) |
| `settings.mappings.showMore_few` | Zobrazit další na {platform} ({count}) |
| `settings.mappings.showMore_other` | Zobrazit další na {platform} ({count}) |
| `settings.mappings.origin.chosen` | Zvoleno tebou |
| `settings.mappings.origin.learned` | Naučeno |
| `settings.mappings.origin.unmarked` | Starší |
| `settings.mappings.origin.unverified` | Importováno · ověřit |
| `settings.mappings.origin.chosenHelp` | Potvrzeno nebo zvoleno tebou: nikdy se nezpochybňuje. |
| `settings.mappings.origin.learnedHelp` | Nalezeno SyncKai: určí se znovu, když mu platforma odporuje. |
| `settings.mappings.origin.unmarkedHelp` | Uloženo před verzí 2.4: zůstává, při rozporu se nabídne k ověření. |
| `settings.mappings.origin.unverifiedHelp` | Ze zálohy: při prvním použití se znovu ověří. |
| `settings.mappings.originLegend` | Původ přiřazení |
| `settings.exclusions.section` | Nikdy se nesynchronizují |
| `settings.exclusions.help` | Vyloučený seriál se už nikdy nesynchronizuje, v žádné řadě. „{action}“ ho od další epizody znovu sleduje. |
| `settings.exclusions.emptyHelp` | Chceš-li seriál přestat synchronizovat, zvol „{action}“ v jeho nabídce „⋯“. |
| `settings.exclusions.seriesYear` | seriál z roku {year} |
| `settings.exclusions.excludedOn` | vyloučeno {date} |
| `popup.syncDisabledDetail` | Lze znovu zapnout v Nastavení › Synchronizace › Vyloučené seriály |
| `review.excludeTitle` | Vyloučí seriál (všechny řady): lze znovu zapnout v Nastavení › Synchronizace › Vyloučené seriály |

## 2026-10-17 · Settings › Platforms and Notifications (Preact)

Texts of the redesigned Platforms page (list of sites with « Included » / « Access missing » or a switch, preferred player dropdown, estimated release time per platform with − / + buttons, moved there from the Schedule card) and Notifications page (« On the playback page » style cards and « New episodes »). New: `settings.platforms.where`, `settings.platforms.allAnime`, `settings.platforms.included`, `settings.platforms.accessMissing`, `settings.platforms.note`, `settings.player.openOn`, `settings.player.enableFirst`, `settings.offsets.earlier`, `settings.offsets.later`, `settings.notif.legend`. Changed: `settings.player.help`, `settings.offsets.title`, `settings.offsets.help`, `page.platformOff`, `settings.section.notifications`, `settings.notif.discreet.desc`, `settings.notif.detailed.desc`, `settings.notif.alertsOnly.desc`, `settings.notif.alertsAlways`, `settings.delay.title`, `settings.airing.enableFirst` (the notification descriptions now describe the pill and the bubble, « Extra delay » replaces « Delay », the release-time help says the alerts use it too, « Turn on alerts… » is now visible text). `page.platformOff` keeps its sentence; only the path changed, from « Settings › Playback & sync » to nav.settings › settings.cat.platforms of this catalog. Removed: `settings.section.playback`, `settings.netflix.section`, `settings.netflix.label`, `settings.disney.section`, `settings.disney.label`, `settings.prime.section`, `settings.prime.label`, `settings.airing.label`, `settings.airing.help`, `settings.section.agenda`. The Schedule word, « Open », the release-alert name and the minute unit reuse this catalog's `panel.tab.agenda`, `common.open`, `settings.quick.airing.label` and `settings.offsets.unit`. Minute tooltips written « O 15 min dřív / později » (the − / + button moves the delay by that amount). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.platforms.where` | Kde SyncKai sleduje tvoje epizody |
| `settings.platforms.allAnime` | Všechna anime |
| `settings.platforms.included` | Zahrnuto |
| `settings.platforms.accessMissing` | Chybí přístup |
| `settings.platforms.note` | Zapnutí platformy si vyžádá přístup k jejímu webu. Čtou se jen stránky přehrávání a seriálů. |
| `settings.player.openOn` | Otevírat epizody na |
| `settings.player.enableFirst` | Nejdřív zapni |
| `settings.player.help` | Použije ho tlačítko „Otevřít“, když je anime na více zapnutých platformách. |
| `settings.offsets.title` | Odhadovaný čas vydání |
| `settings.offsets.help` | Po japonském vysílání. Používají ho Kalendář a upozornění; jednotlivý seriál upravíš v jeho řádku v Kalendáři. |
| `settings.offsets.earlier` | O {minutes} min dřív |
| `settings.offsets.later` | O {minutes} min později |
| `page.platformOff` | Platforma {platform} je vypnutá: SyncKai tu nic nehlídá. Zapnout ji můžeš v Nastavení › Platformy. |
| `settings.section.notifications` | Na stránce přehrávání |
| `settings.notif.legend` | Styl oznámení na stránce |
| `settings.notif.discreet.desc` | Malý štítek na pár sekund v rohu videa |
| `settings.notif.detailed.desc` | Bublina s epizodou a výsledkem na AniListu a MyAnimeListu |
| `settings.notif.alertsOnly.desc` | Nic, když je vše v pořádku; bublina jen při chybě nebo epizodě k ověření |
| `settings.notif.alertsAlways` | Chyba nebo seriál k ověření se zobrazí vždy, bez ohledu na styl. |
| `settings.delay.title` | Zpoždění navíc |
| `settings.airing.enableFirst` | Pro kontrolu nových epizod zapni upozornění |

## 2026-10-17 · Settings › My data, AniList ↔ MAL differences, Help & about (Preact)

Texts of the redesigned My data page (one « Import a watch history » card, Backup card, « Compare » row opening the AniList ↔ MyAnimeList differences page, which moved there from the popup's Activity screen) and Help & about page (diagnostic report row, error log that unfolds, About card with What's new / Privacy / Source code links). New: `settings.import.title`, `settings.section.compare`, `settings.compare.title`, `settings.compare.help`, `settings.data.perSeries`, `compare.align`, `compare.bulk.help`, `compare.job.background`, `settings.help.diagnostic`, `settings.help.diagnosticHelp`, `settings.help.journalNote`, `settings.about.whatsNew`, `settings.about.privacy`. Changed: `settings.crImport.help`, `settings.backup.help`, `settings.backup.import`, `settings.help.copy`, `settings.about.source` (import help in two sentences, backup help « in one file », « Import » without ellipsis, « Copy the report » next to the new « Diagnostic report » title, « Source code » with « GitHub » on the right). `help.issue.body` keeps its text; only its last-line path changed, to nav.settings › settings.cat.help › settings.help.copy of this catalog. The compare.* texts are unchanged: their context notes now point to Settings › My data. Removed: `settings.section.import`, `settings.backup.crImportTitle`, `settings.crImport.openAria`, `settings.help.text`, `settings.help.copyTitle`, `settings.help.clearHelp`, `settings.help.reportTitle`. The version line reuses `settings.summary.version`, the « Clear » button `settings.matchDiag.clear`. `settings.help.diagnostic` « Diagnostika » and `settings.help.copy` « Kopírovat » stay short like the catalog's existing « Kopírovat diagnostiku » / « Zkopírováno » (Czech 320 px panel). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.import.title` | Doplň, co už máš zhlédnuté |
| `settings.crImport.help` | Crunchyroll, ADN nebo Netflix. Než se cokoli zapíše, uvidíš náhled. |
| `settings.backup.help` | Nastavení, přiřazení, vyloučené seriály a historie v jednom souboru. Nikdy tvoje přihlášení k AniListu ani MyAnimeListu. |
| `settings.backup.import` | Importovat |
| `settings.section.compare` | Porovnání |
| `settings.compare.title` | Rozdíly AniList ↔ MyAnimeList |
| `settings.compare.help` | Porovná tvoje dva seznamy a sladí je směrem, který zvolíš |
| `settings.data.perSeries` | Přiřazení a vyloučené seriály spravuješ v {path}. |
| `compare.align` | Sladit |
| `compare.bulk.help` | „{action}“ přenese AniList na MyAnimeList; nejdřív potvrzení vypíše změny. |
| `compare.job.background` | Pokračuje, i když tuto stránku zavřeš. |
| `settings.help.diagnostic` | Diagnostika |
| `settings.help.diagnosticHelp` | K vložení do hlášení chyby: verze, prohlížeč, nastavení, poslední chyby. Žádné tokeny ani účty. |
| `settings.help.copy` | Kopírovat |
| `settings.help.journalNote` | Nanejvýš posledních 50, od nejnovější; tokeny už skryté. |
| `settings.about.whatsNew` | Novinky |
| `settings.about.privacy` | Soukromí |
| `settings.about.source` | Zdrojový kód |

## 2026-10-17 · Popup « My series » row menu (Preact)

The row « … » menu of the popup's « My series » list and of the « Continue » card now groups the entry links and the platform searches in two sub-menus. New: `watching.menu.openEntry` (sub-menu entry, its items are the bare AniList / MyAnimeList names; wording taken from `page.openOn` without « on {service} »), `watching.menu.searchOn` (sub-menu entry, its items are the bare platform names; wording taken from `watching.searchOn`, ending with « … »). Changed: `settings.entry.help`, which now also says that « Default entry page » picks the list shown in « My series » (quoted with the exact `watching.mySeries` of this catalog). The « −1 episode » item left the menu (the row has its own −), `watching.minusOne` stays for the « On this page » card. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `watching.menu.openEntry` | Otevřít záznam |
| `watching.menu.searchOn` | Hledat na webu… |
| `settings.entry.help` | Otevře se po kliknutí na název nebo obal anime; určuje také seznam v „Moje seriály“ |



## 2026-10-17 · Popup « On this page » card (Preact)

The popup's « On this page » card was redesigned: the Hold / Drop / Done row and the AniList / MAL links moved to the card's « … » menu (shared with « My series »), and the season dropdown, the star rating and the comment moved to a foldable « Details » section. New: `page.currentStatus` (grey mention at the end of the menu item of the series' current status), `page.details` (foldable button listing what the section holds, same nouns as `page.seasonPicker`, the rating words of `rating.*` and `notes.title`), `page.seasonOnAniList` (title above the season dropdown), `page.seasonHelp` (help under it on an episode page; the match word is the one of `settings.section.mappings`), `page.yourRating` (title above the stars). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `page.currentStatus` | Aktuální stav |
| `page.details` | Podrobnosti: řada, hodnocení, komentář |
| `page.seasonOnAniList` | Řada na AniListu |
| `page.seasonHelp` | Změna řady opraví přiřazení pro další epizody. |
| `page.yourRating` | Tvoje hodnocení |


## 2026-10-17 · Popup « Activity » tab (Preact)

The popup's Activity tab was redesigned: failed and pending syncs are now two sections, and every section heading is an uppercase label followed by « · {count} » added by the code. New: `queue.failedHeading` (same failure word as `queue.failed`), `queue.pendingHeading` (syncs waiting for a retry, wording of the former `queue.sectionTitle`), `ratings.heading` (the former `ratings.sectionTitle` without its count). The « To check » heading now reuses `inline.toCheck`. Removed: `queue.section`, `queue.sectionTitle`, `ratings.section`, `ratings.sectionTitle`, `review.title`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `queue.failedHeading` | Selhalo |
| `queue.pendingHeading` | Čekající |
| `ratings.heading` | K hodnocení |


## 2026-10-17 · Side panel « Now playing » (Preact)

The side panel's « Now playing » tab was redesigned as cards: « You're watching » (live playback: bar, credits marker, countdown, sync state with an icon), « Your list » (status chip, « Progress » and the stepper, one line per account, the series « … » menu shared with the popup: Hold / Drop / Done moved there), then foldable sections « Rating and comment », Synopsis, related entries and Discussions. New: `panel.nowPlaying.watching` (heading of the live card, addresses the user), `panel.nowPlaying.list` (heading of the list card, same « your list » words as `page.notInList`), `panel.nowPlaying.ratingNotes` (section title, same nouns as `page.yourRating` and `notes.title`), `panel.live.creditsAt` and `panel.live.creditsUnknown` (legend of the yellow marker under the bar, credits word of `settings.trigger.credits`), `panel.live.countdownCredits` and `panel.live.countdownRatio` (countdown line, wording of the former `panel.live.countdown` plus what the sync waits for, as in `settings.trigger.credits` / `settings.summary.percentage`). Changed: `panel.live.synced` lost its trailing « ✓ » (a check icon now precedes it). The « Progress » label reuses `compare.filter.progress`. Removed: `page.action.COMPLETED`, `page.action.DROPPED`, `page.action.PAUSED` (the status button row is gone), `panel.live.countdown`, `panel.nowPlaying.progress`, `watching.nextWatched`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `panel.nowPlaying.watching` | Sleduješ |
| `panel.nowPlaying.list` | Tvůj seznam |
| `panel.nowPlaying.ratingNotes` | Hodnocení a komentář |
| `panel.live.creditsAt` | Závěrečné titulky v {time} |
| `panel.live.creditsUnknown` | Začátek titulků neznámý · synchronizace při {percent} % |
| `panel.live.countdownCredits` | Synchronizace za {time} · na začátku závěrečných titulků |
| `panel.live.countdownRatio` | Synchronizace za {time} · při {percent} % epizody |
| `panel.live.synced` | Synchronizováno |


## 2026-10-17 · Side panel Schedule (Preact) and week picker

The Schedule tab of the side panel was redesigned: days in order with « No episode » on empty days, episode lines « 18:00 Crunchyroll · Japan 17:00 » (the platform time first, the Japanese broadcast last and cut first), a « ⋯ » menu with « Adjust time » (its second line gives the time and whether the delay is the series' own or the default), « Open the entry › » and « Search on… › », and a week button that opens a month calendar. New: `agenda.adjust.custom` and `agenda.adjust.default` (second line of « Adjust time », lower case after « · »), `agenda.adjust.platform` (first sentence of `agenda.estimate.title`, shown in the delay editor), `agenda.picker.label`, `agenda.picker.prevMonth`, `agenda.picker.nextMonth`, `agenda.picker.thisWeek`, `agenda.picker.hint` (month calendar; the hint names the arrow keys and the Enter key). Changed: `agenda.jp` writes the country name instead of « JP » (unchanged where it already did: ja, ko, zh-CN, zh-TW). Removed: `watching.searchOn` (the search entries are now the platform names of the « Search on… › » sub-menu). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `agenda.jp` | Japonsko {time} |
| `agenda.adjust.custom` | nastaveno pro tento seriál |
| `agenda.adjust.default` | výchozí zpoždění |
| `agenda.adjust.platform` | Odhadované vydání na platformě {platform}: japonské vysílání {offset}. |
| `agenda.picker.label` | Vybrat týden |
| `agenda.picker.prevMonth` | Předchozí měsíc |
| `agenda.picker.nextMonth` | Další měsíc |
| `agenda.picker.thisWeek` | Tento týden |
| `agenda.picker.hint` | ↑ ↓ mění týden, Enter ho zobrazí. |

## 2026-10-18 · History import page, steps 1 to 3 (Preact)

The history import page (steps 1 to 3) was redesigned: a 5-step indicator under the title (Platform, Reading, Analysis, Preview, Import), one tile per platform with the state of its tab (ready, no tab open, waiting for the tab, access to grant), the rules in a « How it works » card (its title reuses `onboarding.howItWorks`), and the Netflix reading card listing its three steps (done with a check, current with a bar, next ones greyed). New: `crImport.steps` (screen readers only), `crImport.step.*` (one word each: the five steps share one line at 576 px), `crImport.tile.*` (status line of a tile, no platform name), `crImport.netflix.heading`, `crImport.netflix.rowsDone` (step done: same wording as `crImport.netflix.rows` without the ellipsis), `crImport.netflix.titlesNext` and `crImport.netflix.showsNext` (steps not started yet: same wording as `crImport.netflix.titles` / `.shows` without the counts). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.steps` | Kroky |
| `crImport.step.platform` | Platforma |
| `crImport.step.reading` | Čtení |
| `crImport.step.analysis` | Analýza |
| `crImport.step.preview` | Náhled |
| `crImport.step.import` | Import |
| `crImport.tile.ready` | Karta připravená |
| `crImport.tile.none` | Žádná otevřená karta |
| `crImport.tile.access` | Je třeba povolit přístup |
| `crImport.tile.waiting` | Čekám na kartu… |
| `crImport.netflix.heading` | Čtu tvoji historii na Netflixu |
| `crImport.netflix.rowsDone` | Historie na Netflixu načtena – řádků: {rows} |
| `crImport.netflix.titlesNext` | Hledání anime na AniListu |
| `crImport.netflix.showsNext` | Čtení tvého postupu na Netflixu (ponechané seriály) |

## 2026-10-18 · History import page, steps 4 and 5, and Backup page (Preact)

Steps 4 and 5 of the history import page and the Backup page were redesigned. The preview summary is now a row of tiles, each with its number above a label: `crImport.summary.*` are those labels without the number (they replace `crImport.preview.toUpdate`, `.review`, `.upToDate`, `.excluded`, `.ignored` and `.failed`, removed; same wording without `{count}`). The « Update N series » button has a muted hint on its left (`crImport.preview.hint.*`: a line left unchecked, none checked, locked during the import, what stays checked after a stopped or failed import). Each « To check » season shows the entry its check card will propose (`crImport.review.proposed`, a small badge) and the other entries to choose from (`crImport.review.alternatives`, `{titles}` = a localized list). The Backup page's Export card lists what the file contains and never contains (`import.included`, `import.neverIncluded`, `import.includes.*`, reusing the words of `import.summary.*` and `import.intro`); the Import card titles the file table (`import.fileContents`) and shows the export date under the file name (`import.exportedAt`, replaces `import.exportedOn`, removed: same text without the leading ` · `). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.summary.toUpdate_one` | seriál k aktualizaci |
| `crImport.summary.toUpdate_few` | seriály k aktualizaci |
| `crImport.summary.toUpdate_other` | seriálů k aktualizaci |
| `crImport.summary.review_one` | k ověření |
| `crImport.summary.review_few` | k ověření |
| `crImport.summary.review_other` | k ověření |
| `crImport.summary.upToDate_one` | už aktuální |
| `crImport.summary.upToDate_few` | už aktuální |
| `crImport.summary.upToDate_other` | už aktuální |
| `crImport.summary.excluded_one` | vyloučena |
| `crImport.summary.excluded_few` | vyloučeny |
| `crImport.summary.excluded_other` | vyloučeno |
| `crImport.summary.ignored_one` | titul přeskočen (nejde o anime) |
| `crImport.summary.ignored_few` | tituly přeskočeny (nejde o anime) |
| `crImport.summary.ignored_other` | titulů přeskočeno (nejde o anime) |
| `crImport.summary.failed_one` | nenalezena (chyba) |
| `crImport.summary.failed_few` | nenalezeny (chyba) |
| `crImport.summary.failed_other` | nenalezeno (chyba) |
| `crImport.preview.hint.unchecked` | Nezaškrtnutý řádek se nezapíše. |
| `crImport.preview.hint.none` | Zaškrtni aspoň jeden seriál. |
| `crImport.preview.hint.locked` | Políčka a tlačítka jsou zamčená až do konce importu. |
| `crImport.preview.hint.stopped` | Seriály, které ještě nebyly zapsány, zůstávají zaškrtnuté. |
| `crImport.preview.hint.failed` | Seriály, které selhaly, zůstávají zaškrtnuté. |
| `crImport.review.proposed` | navrženo |
| `crImport.review.alternatives` | Na výběr také: {titles} |
| `import.included` | Zahrnuto |
| `import.neverIncluded` | Nikdy nezahrnuto |
| `import.includes.settings` | Nastavení |
| `import.includes.matches` | Přiřazení a vyloučené seriály |
| `import.includes.history` | Historie: nedávné synchronizace, epizody k ověření, seriály k hodnocení, odmítnutá opakovaná sledování |
| `import.includes.signIns` | Tvoje přihlašovací údaje AniList / MyAnimeList |
| `import.fileContents` | Obsah souboru |
| `import.exportedAt` | exportováno {date} (v{version}) |

## 2026-10-18 · In-page toasts redesigned

The in-page toasts on the player were redesigned (top-right corner, Kai with a state badge, title = what happened, subtitle = series · episode, one line per service, identical results merged). New titles `toast.title.*` (saved, series completed, partial sync, failed on a service, not saved, excluded), per-service results `toast.line.completed` / `toast.line.upToDate`, partial results of a rating or a rewatch (`prompt.rating.partial`, `prompt.rewatch.partial`) and the explanation under the rewatch question (`prompt.rewatch.message`). Two services with the same result share one line, labelled `toast.line.both`. The end-of-series rating bubble title `prompt.rating.title` is now « Series completed! Your rating? » (`toast.title.completed` and the former question joined; the series title moved to the subtitle): `prompt.rating.question` was removed. `content.episodeShort` is now the bubbles' subtitle and uses the short form of « episode » before the number where the language has one. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `toast.title.saved` | Epizoda {episode} uložena |
| `toast.title.completed` | Seriál dokončen! |
| `toast.title.partial` | Částečná synchronizace |
| `toast.title.failedOn` | Chyba: {service} |
| `toast.title.notSaved` | Epizoda neuložena |
| `toast.title.excluded` | Seriál vyloučen, nic neodesláno |
| `toast.line.completed` | stav Dokončeno |
| `toast.line.upToDate` | už aktuální |
| `prompt.rating.partial` | Hodnocení uloženo jen zčásti |
| `prompt.rewatch.partial` | Opakované sledování uloženo jen zčásti |
| `prompt.rewatch.message` | Na tvém seznamu už dokončeno: postup začne znovu od epizody {progress}. |
| `content.episodeShort` | {title} · ep. {number} |
| `toast.line.both` | AniList a MyAnimeList |
| `prompt.rating.title` | Seriál dokončen! Tvoje hodnocení? |
