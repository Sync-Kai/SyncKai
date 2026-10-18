# Swedish (`sv`) review log

Independent native review of `src/i18n/locales/sv.json` (934 keys) and `public/_locales/sv/messages.json`, 2026-10-14. Inputs: `docs/i18n/GLOSSARY.md`, `docs/i18n/glossary/sv.md`, `docs/i18n/context.json`, `en.json`, `fr.json`, `de.json`.

Method:

1. **Terminology audit**: concordance of every core term across the catalog (serie, säsong, avsnitt / Avs., lista, titel, synkning / synka, granska / granskning, betygsätta / betyg, kommentar, koppling, utesluten, väntande synkning, eftertexter, popup-fönstret, sidopanel, Spelas nu, Schema, På den här sidan, föredragen plattform, visningshistorik, säkerhetskopia / Säkerhetskopiering, förhandsvisning, omtittning, konto / ansluta / logga in / session, aviseringar vs varningar vs meddelanden på sidan, Inställningar and its categories, the six statuses, Aktivitet, Tittar på). Two collisions found and fixed: *kopplad* used both for a match (*koppling*) and for an AniList external link, and bare *historik* used both for the watch history import and for SyncKai's own sync history inside a backup.
2. **Key-by-key reading** of all 934 keys with their context notes: meaning against en/fr/de, grammar, register (*du*), naturalness, placeholders, composed texts (fragments lowercased after `{service}: `, relative times after "Färdigsedd" / "Analyserades" / "Senaste kontroll:", `{reason}` texts before ". Klicka på SyncKai-ikonen …", ` · ` joins, `{title}: {message}`), cross-references, lengths against the notes, plurals for 0, 1, 2, 3, 5, 11, 21, 22, 25, 101 (Swedish `_one` = 1 only; every `_one` / `_other` pair reads correctly, including participle agreement: *läst / lästa*, *sett / sedda*, *utesluten / uteslutna*, *överhoppad / överhoppade*).
3. **Mechanical scans**: särskrivning (every product name or placeholder followed by a word, every compound: no split compound found; hyphenated compounds such as *AniList-titel*, *{platform}-fliken*, *Disney+-flik*, *”Ditt betyg?”-bubbla* are correct), quotation marks (all ”…”, no straight or English quotes), apostrophes, `…` vs `...`, dashes, spaces before punctuation, percent spacing (`85 %`), Markdown structure of `help.issue.body` (17 lines, same as English).
4. **Cross-references** all verified after the changes: `Inställningar › Uppspelning & synkning` (`settings.cat.sync`), `Inställningar › Uteslutna serier` (`settings.section.exclusions`), `Inställningar › Hjälp › Kopiera diagnostikrapport`, ”Justera tid”, ”Tittar på”, ”Planerad”, ”Att granska”, ”Öppna”, ”Ditt betyg?” / Färdigsedd, ”Ändra” / ”Ställ in”, ”Spelas nu”, (Aktivitet), fliken Schema.
5. **External names re-checked**: Firefox sv-SE `addon-manage-extensions-shortcuts` = "Hantera genvägar för tillägg" (mozilla-l10n `aboutAddons.ftl`), as the catalog says; Netflix "Streamingaktivitet" (Viewing activity page) and "Visa mer" (Show more), help.netflix.com/sv/node/101917, as the catalog says.

Result: 47 keys changed in `sv.json` (8 meaning, 12 terminology, 3 grammar, 14 style, 3 consistency, 7 typography; no placeholder, plural or cross-reference error was found). `messages.json` reviewed and unchanged (`extDescription` 86 characters; both command texts identical to `settings.shortcuts.episode` / `settings.shortcuts.panel`). Term sheet `docs/i18n/glossary/sv.md` updated (see below). `npm run i18n:check -- sv`: 0 errors; the remaining warnings are the "more than 1.6× longer" heuristic, each checked against the length limit of its note.

## Changes

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `crImport.read.progress` | Läser historik: sidor {pages}, avsnitt {items}… | Läser historik (sidor: {pages}, avsnitt: {items})… | meaning | "avsnitt 287" read as "episode no. 287" and "sidor 3" as "pages no. 3"; label: value counters work for every count (0, 1, 287) and match crImport.netflix.rows "(rader: {rows})" |
| `settings.crImport.help` | Crunchyroll, ADN eller Netflix: ta igen din historik, förhandsvisning innan något skickas | Crunchyroll, ADN eller Netflix: för över din historik, med förhandsvisning innan något skickas | meaning | "ta igen din historik" means "make up for your history"; "för över" (transfer) is what the import does |
| `onboarding.hint.anilist` | Rekommenderas för matchning | Rekommenderas för bästa igenkänning | meaning | "matchning" is opaque jargon on the welcome screen (dating, recruiting); the point is that AniList data lets SyncKai recognise the anime, echoing step 2 "SyncKai känner igen serien" (35 chars) |
| `compare.bulk.filtered.anilist` | Filtret som på AniList | Urvalet som på AniList | meaning | "Filtret som på AniList" read as changing the filter itself; the button copies AniList values to the filtered series ("urval" = the filtered selection) |
| `compare.bulk.filtered.mal` | Filtret som på MAL | Urvalet som på MAL | meaning | Same as compare.bulk.filtered.anilist |
| `import.invalid_one` | {count} ogiltigt objekt hoppades över | {count} ogiltigt objekt hoppas över | meaning | The warning is shown before the import: the items will be skipped (present), not "were skipped" |
| `import.invalid_other` | {count} ogiltiga objekt hoppades över | {count} ogiltiga objekt hoppas över | meaning | Same as import.invalid_one |
| `settings.summary.shortcutsNone` | Inga kortkommandon | Inga kortkommandon inställda | meaning | "Inga kortkommandon" said the extension has no shortcuts; the point is that no key is set (28 chars, DE is 29) |
| `settings.shortcuts.help` | En tangent som du har ändrat behålls vid uppdateringar. Om en tangent saknas eller redan används av webbläsaren eller ett annat tillägg väljer du en med ”Ändra” eller ”Ställ in”. | Ett kortkommando som du har ändrat behålls vid uppdateringar. Om ett kortkommando saknas eller redan används av webbläsaren eller ett annat tillägg väljer du ett nytt med ”Ändra” eller ”Ställ in”. | terminology | "tangent" is a physical key: "om en tangent saknas" read as a key missing from the keyboard; the shortcut is a "kortkommando" everywhere else |
| `import.intro` | Inställningar, kopplingar, uteslutna serier och historik. Dina inloggningar på AniList/MAL ingår aldrig. | Inställningar, kopplingar, uteslutna serier och synkhistorik. Dina inloggningar på AniList/MAL ingår aldrig. | terminology | "historik" is the term for the watch history import; the backup holds SyncKai's sync history |
| `import.replaceWarning` | Dina nuvarande kopplingar, uteslutna serier och din historik raderas. Fortsätta? | Dina nuvarande kopplingar, uteslutna serier och din synkhistorik raderas. Fortsätta? | terminology | Same: SyncKai's sync history, not the streaming history |
| `import.subtitle` | Exportera eller importera dina inställningar, kopplingar och din historik. | Exportera eller importera dina inställningar, kopplingar och din synkhistorik. | terminology | Same: SyncKai's sync history, not the streaming history |
| `settings.backup.help` | Inställningar, kopplingar, uteslutna serier och historik. Aldrig dina inloggningar på AniList/MAL. | Inställningar, kopplingar, uteslutna serier och synkhistorik. Aldrig dina inloggningar på AniList/MAL. | terminology | Same; this card sits right above the "Importera visningshistorik" card, where the ambiguity was strongest |
| `match.episodeLink` | AniList-titel kopplad till det här avsnittet | AniList-titel länkad till det här avsnittet | terminology | "kopplad" belongs to "koppling" (match, Settings › Kopplingar); an AniList external link is "länka", as in the sibling match.* keys |
| `match.platformSeasonsSingle` | Bara en kopplad AniList-titel, som inte täcker alla säsonger på {platform}: granska säsongen | Bara en länkad AniList-titel, som inte täcker alla säsonger på {platform}: granska säsongen | terminology | Same: AniList link, not a SyncKai match |
| `match.otherSeriesExcluded` | En titel kopplad till en annan serie på plattformen valdes bort: granska säsongen | En titel länkad till en annan serie på plattformen valdes bort: granska säsongen | terminology | Same: AniList link, not a SyncKai match |
| `settings.netflix.helpOff` | Bara anime som är kopplade till Netflix på AniList synkas. Webbläsaren ber om åtkomst till netflix.com | Bara anime som är länkade till Netflix på AniList synkas. Webbläsaren ber om åtkomst till netflix.com | terminology | Same: AniList link, not a SyncKai match |
| `settings.netflix.helpOn` | Bara anime som är kopplade till Netflix på AniList synkas, även i Netflix-flikar som redan är öppna | Bara anime som är länkade till Netflix på AniList synkas, även i Netflix-flikar som redan är öppna | terminology | Same: AniList link, not a SyncKai match |
| `settings.disney.helpOff` | Bara japanska anime som är kopplade till Disney+ på AniList synkas. Webbläsaren ber om åtkomst till disneyplus.com | Bara japanska anime som är länkade till Disney+ på AniList synkas. Webbläsaren ber om åtkomst till disneyplus.com | terminology | Same: AniList link, not a SyncKai match |
| `settings.disney.helpOn` | Bara japanska anime som är kopplade till Disney+ på AniList synkas. I en Disney+-flik som redan var öppen börjar spårningen vid nästa avsnitt | Bara japanska anime som är länkade till Disney+ på AniList synkas. I en Disney+-flik som redan var öppen börjar synkningen vid nästa avsnitt | terminology | Same AniList-link fix; "spårningen" has the surveillance sense of web tracking, the catalog's word for what starts is "synkningen" |
| `crImport.netflix.rule` | Netflix: SyncKai laddar historiken med knappen ”Visa mer” på sidan Streamingaktivitet (inget annat klickas), behåller de anime som hittas på AniList och läser deras framsteg. | Netflix: SyncKai laddar historiken med knappen ”Visa mer” på sidan Streamingaktivitet (inget annat klickas på), behåller de animetitlar som hittas på AniList och läser dina framsteg i dem. | grammar | "klicka" needs its particle ("inget annat klickas på"); "de anime som" is an awkward count plural; "deras framsteg" read as the titles' own progress |
| `page.platformOff` | Du har stängt av {platform}: SyncKai följer inget här. Slå på igen i Inställningar › Uppspelning & synkning. | Du har stängt av {platform}: SyncKai följer inget här. Slå på det igen i Inställningar › Uppspelning & synkning. | grammar | "Slå på igen" lacked its object |
| `onboarding.hint.mal` | Fungerar ensamt eller med AniList | Fungerar med eller utan AniList | grammar | "Fungerar ensamt" is unidiomatic and its agreement with "MyAnimeList" undefined; "med eller utan" is the set phrase (31 chars) |
| `agenda.empty.noSeries` | Inga pågående serier än. Starta en på Crunchyroll eller ADN så visas dess nya avsnitt här. | Inga pågående serier än. Börja titta på en serie på Crunchyroll eller ADN så visas dess nya avsnitt här. | style | One "startar" a video, not a series: "Starta en på Crunchyroll" read like creating one; "börja titta på" is what Swedes say |
| `agenda.empty.noSeriesPlatforms` | Inga pågående serier än. Starta en på {platforms} så visas dess nya avsnitt här. | Inga pågående serier än. Börja titta på en serie på {platforms} så visas dess nya avsnitt här. | style | Same as agenda.empty.noSeries |
| `crImport.read.error.logged-out` | Logga in på {platform} i den fliken och läs sedan igen. | Logga in på {platform} i den fliken och starta sedan läsningen igen. | style | "läs sedan igen" told the user to read; the action is restarting the reading ("Läs min historik") |
| `crImport.read.error.adnLoggedOut` | Öppna ADN i den fliken och logga in (ladda om sidan om du redan är inloggad), läs sedan igen. | Öppna ADN i den fliken och logga in (ladda om sidan om du redan är inloggad). Starta sedan läsningen igen. | style | Same "läs igen" fix; the long chain is split in two sentences |
| `crImport.read.error.netflixLoggedOut` | Logga in på Netflix i den fliken och välj din profil, öppna sedan sidan Streamingaktivitet igen och läs igen. | Logga in på Netflix i den fliken och välj din profil. Öppna sedan sidan Streamingaktivitet igen och starta läsningen på nytt. | style | Same "läs igen" fix; removes the "igen … igen" repetition |
| `crImport.error.noHistory` | Historiken hittades inte: läs den igen. | Historiken hittades inte: starta läsningen igen. | style | Same "läs den igen" fix |
| `crImport.review.createdLimited_one` | {count} granskning skapad (högst 20 åt gången): hantera dem och skapa sedan nästa. | {count} granskning skapad (högst 20 åt gången): hantera dem och skapa sedan fler. | style | "skapa sedan nästa" is cut short ("create then next"); "fler" = the next ones |
| `crImport.review.createdLimited_other` | {count} granskningar skapade (högst 20 åt gången): hantera dem och skapa sedan nästa. | {count} granskningar skapade (högst 20 åt gången): hantera dem och skapa sedan fler. | style | Same as crImport.review.createdLimited_one |
| `sync.correctionPending` | Rättelse väntar för den här säsongen: avsnittet tillämpas när du har bestämt dig på dess kort under Aktivitet | Rättelse väntar för den här säsongen: avsnittet tillämpas när du har gjort ditt val på kortet under Aktivitet | style | "när du har bestämt dig på dess kort" is clumsy; "gjort ditt val på kortet" is natural |
| `match.specialSeason` | Specialavsnitt / OVA: välj titel | Specialavsnitt / OVA: ingen titel kunde väljas automatiskt | style | Used as {reason} before ". Klicka på SyncKai-ikonen för att välja rätt titel.": the imperative "välj titel" repeated that instruction; now it states the reason (like FR « fiche à choisir ») |
| `feedback.ignored.message` | Ingen AniList-titel länkar till den här sidan på plattformen: det är troligen ingen anime. | Ingen AniList-titel länkar till den här sidan på plattformen, så det är troligen ingen anime. | style | Shown as "{title}: {message}": the inner colon gave two colons on one line |
| `settings.help.text` | Felen sparas bara i den här webbläsaren. De delas bara om du kopierar rapporten. | Felen sparas bara i den här webbläsaren och delas endast om du kopierar rapporten. | style | "bara … bara" repetition in two short sentences |
| `settings.notif.discreet.desc` | Liten ruta i 3 s i ett hörn. Inget i helskärm; tilläggets ikon visar en bock. | Liten ruta i ett hörn under 3 s. Inget i helskärm; tilläggets ikon visar en bock. | style | "i 3 s i ett hörn" stacked two "i"; a duration is "under 3 s" |
| `settings.cat.help` | Hjälp & om | Hjälp & info | style | In a category title the bare preposition "om" reads unfinished ("Help & if/about"); "Hjälp & info" is the usual Swedish pairing (DE "Hilfe & Info"); the "Om" section heading is kept |
| `common.actionFailed` | Åtgärd misslyckad | Åtgärden misslyckades | consistency | Aligned with every other failure title (Synkningen / Importen / Exporten misslyckades); "Åtgärd misslyckad" is telegraphic |
| `review.searchFailed` | Sökning misslyckad | Sökningen misslyckades | consistency | Same pattern as the other failure titles |
| `inline.updateFailed` | Uppdatering misslyckades | Uppdateringen misslyckades | consistency | Same pattern; 26 chars for a ~25 chip (DE is 29) |
| `airing.skip.noSeries` | inga pågående serier i cachen — öppna fliken ”Tittar på” | inga pågående serier i cachen – öppna fliken ”Tittar på” | typography | Swedish uses the spaced en dash (tankstreck), not the em dash |
| `footer.chip.expired` | {service}-kontot har gått ut — öppna inställningarna | {service}-kontot har gått ut – öppna inställningarna | typography | Spaced en dash |
| `footer.chip.ok` | {service}-kontot är anslutet — öppna inställningarna | {service}-kontot är anslutet – öppna inställningarna | typography | Spaced en dash |
| `footer.seeActivity` | {label} — öppna Aktivitet | {label} – öppna Aktivitet | typography | Spaced en dash |
| `page.seasonOption` | Säsong {season} — {title} | Säsong {season} – {title} | typography | Spaced en dash (same separator role, Swedish dash) |
| `page.seasonOptionPart` | Säsong {season} · del {part} — {title} | Säsong {season} · del {part} – {title} | typography | Spaced en dash |
| `queue.failed` | Fel — inga fler försök | Fel – inga fler försök | typography | Spaced en dash |

## Term sheet changes (`docs/i18n/glossary/sv.md`)

- New row **linked** → *länkad / länka* for an AniList entry's external link; *koppla / kopplad* stays reserved for *koppling* (match) and *koppla från* (disconnect).
- New row **matching** (welcome screen) → *igenkänning*.
- **Backup**: SyncKai's own sync history = *synkhistorik*, never bare *historik* (the watch history import).
- **History import**: restarting the reading = "starta läsningen igen", never "läs igen".
- **Compare**: filtered bulk buttons "Urvalet som på AniList / MAL".
- **Shortcut**: *kortkommando* also for "a key" meaning a key combination; *tangent* only for a physical key. Firefox string source recorded.
- **Settings categories**: "Hjälp & info" (was "Hjälp & om").
- Conventions added: spaced en dash ` – ` (never `—`); failure titles "<definite noun> misslyckades"; `{reason}` texts state a reason instead of repeating "välj titel"; running totals as "(sidor: {pages}, avsnitt: {items})".

## Debatable, left unchanged

| Key | Current | Why kept |
|---|---|---|
| `common.sessionExpired`, `settings.summary.expired` | Utgången session | Noun phrase used as a state label; the sentence form "Sessionen har gått ut" (21 characters) is over the ~18-character footer limit, and the term sheet keeps the sentence form for messages (`api.sessionExpired`) |
| `compare.breakdown.progress_*`, `compare.impact.progress_*`, `compare.filter.progress` | {count} framsteg / Framsteg | "30 framsteg" can momentarily read as "30 achievements", but it is the term-sheet word for progress and mirrors the elliptical EN/FR/DE breakdown ("30 progress"); "antal sedda avsnitt" does not fit a chip |
| `page.addCurrent`, `page.addPlanning` | Till ”Tittar på” / Till ”Planerad” | Verbless, like the German button (Zu „Schaue ich“); "Lägg till i ”Tittar på”" (23) exceeds the ~20-character button and the pair is clear next to the status chips |
| `page.action.COMPLETED` | Klar | Adjective among verbs (Pausa / Hoppa av), as EN "Done" among "Hold / Drop"; "Färdigsedd" (10) fits but reads as a status, and the tooltip "Markera som färdigsedd" plus the "Färdigsedd?" confirmation remove any doubt |
| `crImport.skipReason.beyond` | utanför titeln | Cryptic chip, like EN "beyond the entry" and FR « au-delà de la fiche »; consistent with `sync.beyondEntry` "ligger utanför titelns {total} avsnitt" |
| `settings.mappings.resetConfirm` | Glömma alla kopplingar? | Infinitive question, idiomatic in Swedish dialogs (cf. "Fortsätta?"); "Vill du glömma alla kopplingar?" (31) exceeds 28 characters |
| `settings.ratingPrompt.label` | Fråga efter betyg när en serie är slut | "är slut" could suggest the end of airing, but the help line right under it says "när en serie flyttas till Färdigsedd" |
| `panel.nowPlaying.relation.PREQUEL` | Föregångare | Fans also say "prequel"; *föregångare* matches AniList's actual use (the previous season) and pairs with *Uppföljare* |
| `airing.status.notified_*` | {count} avsnitt aviserat / aviserade | *Avisera* = notify (as in PostNord's *avisering*); correct, slightly formal |
| `feedback.service.completed` | avsnitt {progress}, animen färdigsedd | Follows EN "anime completed"; "serien färdigsedd" would match the `{title}: färdigsedd` fragments but the item can be a film |
| `crImport.netflix.rows` | Laddar din Netflix-historik (rader: {rows})… | No plural variants: "(rader: 240)" reads right for 0, 1 and 240 |
| `onboarding.step3` | Listan är uppdaterad vid eftertexterna | 38 characters for ≈ 35, but two lines are allowed; "Din lista …" would be 41 |
| `time.countdown.days` | {count} d | SI-style day symbol next to `h` and `min` in the same chips; "dgr" is also common in Swedish |
| `watching.sort.recent` | Senast uppdaterad | Singular label; "Senast uppdaterade" would be equally correct |
| `inline.updateFailed` | Uppdateringen misslyckades | 26 characters for a ~25-character chip (changed for consistency; DE is 29) |
| `backup.fileName` | synckai-säkerhetskopia-{date}.json | "ä" is valid in file names on every current OS; an ASCII spelling would look misspelled |
| `api.notAuthenticated` | Inte inloggad på {service}. | "inloggad på" and "inloggad i" are both current; "på" matches "Logga in på {platform}" |

## Code-level issue seen during the review (not fixable in the catalog)

- `src/shared/sync-feedback.ts` appends `feedback.queuedSuffix` (". Nytt automatiskt försök snart.") right after per-service results whose error message usually ends with a period, giving "… Kontrollera din anslutning.. Nytt automatiskt försök snart." (the same ".." exists in English). The key keeps its leading period as its note requires.

## For a native human reviewer

- **"titel" for entry** (term-sheet decision): reads naturally in "Öppna titeln på AniList", "Ingen AniList-titel hittades för ”Frieren”", but check the sentences that also need the anime's name (*namn*): `match.titleOnlyAbsolute`, `match.dedicatedSeries`, `match.platformTitleOnly`, `match.platformUnlinkedEntry`, `feedback.ignored.message` ("… länkar till den här sidan på plattformen").
- **Drop**: action "Hoppa av" / "Hoppa av serien" / "Hoppa av?" vs status "Avbruten": idiomatic, but confirm fans accept it on a button.
- **Plan to watch = "Planerad"** and **Completed = "Färdigsedd"**: clear, but not the wording of any Swedish tracker (AniList and MyAnimeList have no Swedish UI).
- **New wordings to check in the UI**: `onboarding.hint.anilist` "Rekommenderas för bästa igenkänning", `compare.bulk.filtered.*` "Urvalet som på AniList / MAL", `settings.cat.help` "Hjälp & info", `match.specialSeason` "Specialavsnitt / OVA: ingen titel kunde väljas automatiskt".
- **Netflix names** ("Streamingaktivitet", "Visa mer") come from the Swedish help center; not seen on a live Swedish Netflix profile.
- **Length warnings** to eyeball in the popup: `inline.updateFailed` (26), `settings.summary.shortcutsNone` (28), `content.shortcut.paused.title` / `panel.live.autoSyncOff` "Automatisk synkning pausad" (26).

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | Vinter / Vår / Sommar / Höst | Vinter {year} / Vår {year} / Sommar {year} / Höst {year} | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |
| `sync.noServiceFollows` | Ingen ansluten tjänst följer den här serien. | Ingen ansluten tjänst har en titel för den här serien. | Meaning: shown when no connected service has an entry for the anime (no AniList / MyAnimeList ID), not when none “tracks” it; English, French and German fixed the same way. Term sheet: entry = *titel* |

Code fixes that change how this catalog is displayed:

- `feedback.queuedSuffix` is appended through `appendSuffix` (`src/i18n/core.ts`): its leading period is dropped after a sentence that already ends with one, so no more “… anslutning.. Nytt automatiskt försök snart.”.
- Netflix history import: the “Visa mer” button of a Netflix profile in this language is recognized (label checked by the reviewer on Netflix’s help article 101917 in this language): such an import no longer stops after the first rows as if the history were complete.
- The signed delays of the Schedule tooltips (`agenda.estimate.*`) now use `time.countdown.*`: “+1 h 30 min”.
- Lists of names in `{services}` and `{titles}` use the language’s own conjunction (`Intl.ListFormat`) instead of “, ”.

Layout (`npm run test:i18n-layout`), fixed in the components without changing the text: the “–/10” value of the *To rate* stars: “Ignore” goes below the stars when they don’t fit.

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). The singular `_one` names the entry's only episode.

| Key | Text |
|---|---|
| `sync.beyondEntry_one` | Avsnitt {progress} ligger utanför titelns enda avsnitt |
| `sync.beyondEntry_other` | Avsnitt {progress} ligger utanför titelns {count} avsnitt |

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | Knappen ”Visa mer” kändes inte igen på språket i din Netflix-profil: bara de senaste avsnitten lästes. Ställ in profilen på samma språk som SyncKai på Netflix och starta läsningen på nytt. |

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video (bara anime) |
| `settings.prime.label` | Synka på Prime Video |
| `settings.prime.helpOff` | Bara anime synkas (genren anime, eller animation med japanskt ljud eller med exakt AniList-titel). Webbläsaren ber om åtkomst till primevideo.com |
| `settings.prime.helpOn` | SyncKai läser bara det som Prime Video-sidan redan tar emot. I en Prime Video-flik som redan var öppen börjar synkningen vid nästa avsnitt |
| `settings.prime.denied` | Åtkomst till primevideo.com nekades: synkningen på Prime Video förblir avstängd |
| `settings.prime.disabled` | Prime Video har stängts av: ladda om öppna Prime Video-flikar för att stoppa synkningen helt |
| `settings.prime.error` | Det gick inte att ändra åtkomsten till Prime Video, försök igen |

| Key | Text |
|---|---|
| `onboarding.intro` | Titta på anime på Crunchyroll eller ADN (Netflix, Disney+ och Prime Video valfritt): SyncKai uppdaterar din lista när varje avsnitt är slut. |
| `watching.tip` | Netflix, Disney+, Prime Video (valfritt) och din föredragna plattform ställer du in i {path}. |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | Stämmer med plattformen: {signals} |
| `match.signalsContradict` | Stämmer inte med plattformen: {signals} |
| `match.yearRemake` | Remake urskild genom utgivningsåret ({year}) |
| `match.signal.year` | utgivningsår |
| `match.signal.episodes` | antal avsnitt |
| `match.signal.duration` | avsnittslängd |
| `match.signal.format` | format (film eller serie) |
| `match.signal.country` | ursprungsland |
| `match.signal.originalTitle` | originaltitel |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | Den sparade kopplingen stämmer inte med plattformen: {signals} |

## 2026-10-14 · Matching diagnostic (development builds only)

New keys `settings.matchDiag.*` (Settings › Help & about, section shown only in development builds, never in the published extension): the last 50 AniList matching decisions, a « Copy » button per row (one decision as JSON, for the test corpus) and a « Clear » button. `{count}` follows a label and a colon (no plural form); `JSON` is a format name. Terms from this language's term sheet (match, entry). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.title` | Diagnostik för kopplingar |
| `settings.matchDiag.text` | Endast i utvecklingsbyggen: de senaste 50 kopplingsbesluten mot AniList, nyaste först, sparade tills webbläsaren stängs. Kopiera ett som JSON för att lägga till det i testkorpusen. |
| `settings.matchDiag.empty` | Inga beslut registrerade än |
| `settings.matchDiag.copy` | Kopiera |
| `settings.matchDiag.copyTitle` | Kopiera det här beslutet som JSON |
| `settings.matchDiag.copied` | Kopierat |
| `settings.matchDiag.copyFailed` | Det gick inte att kopiera beslutet. |
| `settings.matchDiag.clear` | Rensa |
| `settings.matchDiag.candidates` | Kandidater: {count} |
| `settings.matchDiag.noEntry` | Ingen titel |

## 2026-10-15 · Debug trace (development builds only)

New keys `settings.debugTrace.*` (Settings › Help & about, section shown only in development builds, never in the published extension, below the matching diagnostic): a timeline of what the extension did (pages, service worker, AniList and MyAnimeList requests), a verbose switch, a category filter (category names stay in English: technical identifiers), « Copy trace » (the whole trace as JSON) and the « Clear » button of the matching diagnostic (`settings.matchDiag.clear`, reused). `{count}` and `{max}` follow a label and a colon (no plural form) and arrive formatted for the language; `JSON` is a format name; `service worker` kept as the browser's technical term. New terms added to this language's term sheet (debug trace, event, verbose mode); other terms from it (account). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.debugTrace.title` | Felsökningsspår |
| `settings.debugTrace.text` | Endast i utvecklingsbyggen: en tidslinje över vad SyncKai gjorde på sidorna, i service workern och med AniList och MyAnimeList, nyaste först, sparad tills webbläsaren stängs. Inga tokens, cookies eller konto-id:n sparas. Kopiera hela spåret som JSON för att dela det när du rapporterar ett problem. |
| `settings.debugTrace.empty` | Inga händelser sparade ännu |
| `settings.debugTrace.copy` | Kopiera spåret |
| `settings.debugTrace.copied` | Kopierat |
| `settings.debugTrace.copyFailed` | Det gick inte att kopiera spåret. |
| `settings.debugTrace.verbose` | Utförligt läge (alla loggrader) |
| `settings.debugTrace.count` | Händelser: {count} / {max} |
| `settings.debugTrace.allCategories` | Alla kategorier |
| `settings.debugTrace.filterAria` | Filtrera händelser efter kategori |

## 2026-10-16 · Matching diagnostic: Copy all (development builds only)

New keys in the « Matching diagnostic » section (Settings › Help & about, development builds only, never in the published extension, now collapsed by default behind its title): « Copy all » copies every recorded decision as one JSON array, next to « Clear »; its label becomes « Copied » (`settings.matchDiag.copied`, reused) and a failure reuses `settings.matchDiag.copyFailed`. `JSON` is a format name. Same word for « decision » as `settings.matchDiag.copyTitle`, in the plural; other terms from this language's term sheet. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.copyAll` | Kopiera alla |
| `settings.matchDiag.copyAllTitle` | Kopiera alla beslut som JSON |

## 2026-10-16 · Episode guards (« To check » reasons)

New reasons on a « To check » card (`fix/episode-guards`, audit SEC-01): a sync that would jump straight to the last episode from far behind, and episodes reported as finished in a burst, now wait for the user instead of being written. Same « to check » term as `match.otherSeriesExcluded`, same episode wording as `sync.beyondEntry_*`; `{from}` and `{progress}` are episode numbers. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `sync.review.finaleJump` | Direkt till sista avsnittet ({progress}) från avsnitt {from}: granska |
| `sync.review.burst` | Många avsnitt klara inom några minuter: granska |

## 2026-10-17 · Status bar (popup and side panel)

New texts of the status bar shown at the bottom of the popup and, now, of the side panel (`feature/ui-status-bar`): a synced episode or a count of synced episodes under the series title, shown until the user hides it (« Seen, hide », a × button label), and the history import running, ready to confirm and done. Same words as this language's term sheet: « synka » (« synkat » / « synkade », agreeing with *avsnitt*, neuter), « serie » / « serier », « Avs. » (`agenda.episode`), « importen » (`crImport.apply.done` « Importen är klar », shortened to « Importen klar ») and « redo » for the ready state, so it never reads like the finished « klar »; « bekräfta » as `common.confirm`; ` · ` and ` / ` kept; `{platform}` is a brand name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `footer.dismiss` | Sett, dölj |
| `footer.importDone_one` | Importen klar · {count} serie uppdaterad |
| `footer.importDone_other` | Importen klar · {count} serier uppdaterade |
| `footer.importProgress` | {platform}-import · {done} / {total} |
| `footer.importReady_one` | Importen redo · {count} serie att bekräfta |
| `footer.importReady_other` | Importen redo · {count} serier att bekräfta |
| `footer.syncedEpisode` | Avs. {episode} synkat |
| `footer.syncedEpisodes_one` | {count} avsnitt synkat |
| `footer.syncedEpisodes_other` | {count} avsnitt synkade |

## 2026-10-17 · Account menu (status bar)

New texts of the account menu that opens above the AniList / MyAnimeList logo of the status bar (popup and side panel): the logo button's label (also when the session expired), the connection status line, three stat tiles (anime count, episodes watched, days watched, each number shown above its short label), the « Synced this week » row with its tooltip and value, and « View my profile ». Following this language's term sheet, used **konto**, **ansluten** (as `settings.account.connected`), **utgången session** (`common.sessionExpired`), **synkat** (as `footer.syncedEpisodes_*`), **avsnitt**; the days tile label is **tittat**; « day » is **d**, as `time.countdown.days`. ` · ` kept; `{service}` is a brand name, `{name}` the user's AniList / MyAnimeList user name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `accountMenu.connected` | Ansluten |
| `accountMenu.connectedAs` | {name} · ansluten |
| `accountMenu.label` | {service}-konto |
| `accountMenu.labelExpired` | {service}-konto, utgången session |
| `accountMenu.profile` | Visa min profil |
| `accountMenu.stats.anime_one` | anime |
| `accountMenu.stats.anime_other` | anime |
| `accountMenu.stats.days_one` | tittat |
| `accountMenu.stats.days_other` | tittat |
| `accountMenu.stats.daysValue` | {days} d |
| `accountMenu.stats.episodes_one` | avsnitt |
| `accountMenu.stats.episodes_other` | avsnitt |
| `accountMenu.week.label` | Synkat den här veckan |
| `accountMenu.week.title` | Avsnitt som SyncKai har synkat den här veckan |
| `accountMenu.week.value_one` | {count} avsnitt |
| `accountMenu.week.value_other` | {count} avsnitt |

## 2026-10-17 · Settings redesign (Preact): new and changed keys

New texts of the redesigned Settings (Preact): the Platforms and Display categories, the screen-reader names of the back button and of the category card, the row summaries of the Settings home, the Keyboard section of Display, the two sections of Shortcuts, and the section titles and notes of Accounts. Changed: `settings.cat.notifications` (now the single word: the Schedule options moved to Platforms), `settings.summary.connected` (a word instead of ✓), `settings.summary.paused` (now a standalone, capitalised summary), `settings.summary.version` (a word instead of « v »), `settings.entry.help` (the « both accounts connected » condition moved to `settings.entry.unavailable`). Summaries are joined with ` · ` by the code; `settings.account.expiredHelp` and `settings.account.otherStillSynced` are joined as two sentences. The Display summary reuses `settings.section.language`, `settings.section.panel` and `settings.shortcuts.pointer`; the My data summary the history import and backup words; the player summary `settings.player.label`. Player summary « föredragen: {player} » (*Föredragen plattform*); the My data summary uses **säkerhetskopia** (the file) as the term sheet says. **aktiv / aktiva** agree with *plattformar*. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.cat.notifications` | Aviseringar |
| `settings.cat.platforms` | Plattformar |
| `settings.cat.display` | Visning |
| `settings.backToAria` | Tillbaka till {page} |
| `settings.group.categories` | Kategorier |
| `settings.summary.connected` | {service} ansluten |
| `settings.summary.notConnected` | {service} inte ansluten |
| `settings.summary.bothConnected` | AniList och MyAnimeList anslutna |
| `settings.summary.auto` | Automatisk |
| `settings.summary.paused` | Pausad |
| `settings.summary.platforms_one` | {count} av {total} aktiv |
| `settings.summary.platforms_other` | {count} av {total} aktiva |
| `settings.summary.player` | föredragen: {player} |
| `settings.summary.display` | Språk, sidopanel, kortkommandon |
| `settings.summary.data` | Importera visningshistorik · säkerhetskopia |
| `settings.summary.version` | Version {version} |
| `settings.summary.noErrors` | inga fel |
| `settings.display.keyboard` | Tangentbord |
| `settings.display.shortcutsHelp` | Markera ett avsnitt eller öppna sidopanelen |
| `settings.shortcuts.duringPlayback` | Under uppspelning |
| `settings.shortcuts.navigation` | Navigering |
| `settings.accounts.lists` | Synkade listor |
| `settings.accounts.both` | Med båda kontona |
| `settings.accounts.privacy` | Du loggar in på webbplatsen för AniList eller MyAnimeList: SyncKai ser aldrig ditt lösenord. |
| `settings.account.expiredHelp` | Dina avsnitt skickas inte längre till {service} förrän du återansluter. |
| `settings.account.otherStillSynced` | {service} uppdateras fortfarande. |
| `settings.entry.help` | Öppnas när du klickar på en animes titel eller omslag |
| `settings.entry.unavailable` | Tillgängligt när både AniList och MyAnimeList är anslutna. |

## 2026-10-17 · Settings › Sync, Matches and Excluded series (Preact)

New texts of the redesigned Sync settings page and of its two sub-pages (Matches, Excluded series), moved out of My data: section titles « Automatic » / « Per series », the descriptions of the two « Episode counted as watched » cards, the « Per series » rows, the Matches intro, search, empty and no-result texts, « Show N more on {platform} », the four origin badges and their legend, the Excluded series section, note, empty hint and the « {year} series · excluded on {date} » fragments. Changed: `settings.trigger.legend` (« Episode counted as watched », where the old text was only « Episode watched »), `settings.trigger.credits` (« (recommended) » moved to `settings.trigger.creditsHelp`), and the paths of `popup.syncDisabledDetail` / `review.excludeTitle` (now nav.settings › settings.section.sync › settings.section.exclusions, built from this catalog's own titles). Removed: `settings.mappings.count_*`, `settings.mappings.help`, `settings.mappings.manage`. `{action}` is the « Re-enable » button (`settings.exclusions.help`) or the « Stop syncing this series » menu item (`settings.exclusions.emptyHelp`), so the quoted labels always match. The match / entry / excluded / re-enable words reuse this catalog's existing terms (`settings.section.mappings`, `settings.mappings.entryFallback`, `settings.section.exclusions`, `settings.exclusions.reactivate`). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.section.automatic` | Automatiskt |
| `settings.section.perSeries` | Per serie |
| `settings.trigger.credits` | När eftertexterna börjar |
| `settings.trigger.creditsHelp` | Rekommenderas: den exakta tidpunkt som plattformen anger |
| `settings.trigger.percentageHelp` | Används också när eftertexterna är okända |
| `settings.sync.mappingsRow` | Sparade kopplingar |
| `settings.sync.mappingsRowHelp` | AniList-säsongen som valts för varje serie |
| `settings.sync.exclusionsRowHelp` | Synkas aldrig, kan återaktiveras här |
| `settings.mappings.intro_one` | {count} serie sparad, per plattform: plattformens säsong → AniList-titeln som SyncKai skriver till. Om du glömmer en koppling räknas den ut på nytt vid nästa avsnitt. |
| `settings.mappings.intro_other` | {count} serier sparade, per plattform: plattformens säsong → AniList-titeln som SyncKai skriver till. Om du glömmer en koppling räknas den ut på nytt vid nästa avsnitt. |
| `settings.mappings.search` | Sök en serie eller titel |
| `settings.mappings.noResult` | Ingen koppling för ”{query}” |
| `settings.mappings.noResultHelp` | Sök på seriens titel eller på AniList-titeln. |
| `settings.mappings.emptyHelp` | SyncKai sparar en för varje säsong som synkas. |
| `settings.mappings.showMore_one` | Visa {count} till på {platform} |
| `settings.mappings.showMore_other` | Visa {count} till på {platform} |
| `settings.mappings.origin.chosen` | Vald av dig |
| `settings.mappings.origin.learned` | Inlärd |
| `settings.mappings.origin.unmarked` | Äldre |
| `settings.mappings.origin.unverified` | Importerad · kontrolleras igen |
| `settings.mappings.origin.chosenHelp` | Bekräftad eller vald av dig: ifrågasätts aldrig. |
| `settings.mappings.origin.learnedHelp` | Hittad av SyncKai: räknas ut på nytt om plattformen motsäger den. |
| `settings.mappings.origin.unmarkedHelp` | Sparad före 2.4: behålls, kontrolleras om den motsägs. |
| `settings.mappings.origin.unverifiedHelp` | Från en säkerhetskopia: kontrolleras igen första gången den används. |
| `settings.mappings.originLegend` | Kopplingarnas ursprung |
| `settings.exclusions.section` | Synkas aldrig |
| `settings.exclusions.help` | En utesluten serie synkas aldrig mer, oavsett säsong. ”{action}” följer den igen från nästa avsnitt. |
| `settings.exclusions.emptyHelp` | Om du vill sluta synka en serie väljer du ”{action}” i dess meny ”⋯”. |
| `settings.exclusions.seriesYear` | serie från {year} |
| `settings.exclusions.excludedOn` | utesluten {date} |
| `popup.syncDisabledDetail` | Kan återaktiveras i Inställningar › Synkning › Uteslutna serier |
| `review.excludeTitle` | Utesluter serien (alla säsonger): kan återaktiveras i Inställningar › Synkning › Uteslutna serier |

## 2026-10-17 · Settings › Platforms and Notifications (Preact)

Texts of the redesigned Platforms page (list of sites with « Included » / « Access missing » or a switch, preferred player dropdown, estimated release time per platform with − / + buttons, moved there from the Schedule card) and Notifications page (« On the playback page » style cards and « New episodes »). New: `settings.platforms.where`, `settings.platforms.allAnime`, `settings.platforms.included`, `settings.platforms.accessMissing`, `settings.platforms.note`, `settings.player.openOn`, `settings.player.enableFirst`, `settings.offsets.earlier`, `settings.offsets.later`, `settings.notif.legend`. Changed: `settings.player.help`, `settings.offsets.title`, `settings.offsets.help`, `page.platformOff`, `settings.section.notifications`, `settings.notif.discreet.desc`, `settings.notif.detailed.desc`, `settings.notif.alertsOnly.desc`, `settings.notif.alertsAlways`, `settings.delay.title`, `settings.airing.enableFirst` (the notification descriptions now describe the pill and the bubble, « Extra delay » replaces « Delay », the release-time help says the alerts use it too, « Turn on alerts… » is now visible text). `page.platformOff` keeps its sentence; only the path changed, from « Settings › Playback & sync » to nav.settings › settings.cat.platforms of this catalog. Removed: `settings.section.playback`, `settings.netflix.section`, `settings.netflix.label`, `settings.disney.section`, `settings.disney.label`, `settings.prime.section`, `settings.prime.label`, `settings.airing.label`, `settings.airing.help`, `settings.section.agenda`. The Schedule word, « Open », the release-alert name and the minute unit reuse this catalog's `panel.tab.agenda`, `common.open`, `settings.quick.airing.label` and `settings.offsets.unit`. `settings.delay.title` is « Extra väntetid » (« Extra fördröjning » is 17 chars, over the 16-char limit). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.platforms.where` | Där SyncKai följer dina avsnitt |
| `settings.platforms.allAnime` | All anime |
| `settings.platforms.included` | Ingår |
| `settings.platforms.accessMissing` | Åtkomst saknas |
| `settings.platforms.note` | När du aktiverar en plattform ber webbläsaren om åtkomst till dess webbplats. Bara uppspelnings- och seriesidor läses. |
| `settings.player.openOn` | Öppna avsnitt på |
| `settings.player.enableFirst` | Aktivera först |
| `settings.player.help` | Används av ”Öppna” när en anime finns på flera aktiva plattformar. |
| `settings.offsets.title` | Beräknad publiceringstid |
| `settings.offsets.help` | Efter sändningen i Japan. Används av Schema och aviseringarna; en enskild serie justeras från sin rad i Schema. |
| `settings.offsets.earlier` | {minutes} min tidigare |
| `settings.offsets.later` | {minutes} min senare |
| `page.platformOff` | Du har stängt av {platform}: SyncKai följer inget här. Slå på det igen i Inställningar › Plattformar. |
| `settings.section.notifications` | På uppspelningssidan |
| `settings.notif.legend` | Stil för meddelanden på sidan |
| `settings.notif.discreet.desc` | En liten ruta i några sekunder, i ett hörn av videon |
| `settings.notif.detailed.desc` | En bubbla med avsnittet och resultatet på AniList och MyAnimeList |
| `settings.notif.alertsOnly.desc` | Inget när allt går bra; en bubbla bara vid ett fel eller ett avsnitt att granska |
| `settings.notif.alertsAlways` | Ett fel eller en serie att granska visas alltid, oavsett stil. |
| `settings.delay.title` | Extra väntetid |
| `settings.airing.enableFirst` | Slå på aviseringarna för att leta efter nya avsnitt |

## 2026-10-17 · Settings › My data, AniList ↔ MAL differences, Help & about (Preact)

Texts of the redesigned My data page (one « Import a watch history » card, Backup card, « Compare » row opening the AniList ↔ MyAnimeList differences page, which moved there from the popup's Activity screen) and Help & about page (diagnostic report row, error log that unfolds, About card with What's new / Privacy / Source code links). New: `settings.import.title`, `settings.section.compare`, `settings.compare.title`, `settings.compare.help`, `settings.data.perSeries`, `compare.align`, `compare.bulk.help`, `compare.job.background`, `settings.help.diagnostic`, `settings.help.diagnosticHelp`, `settings.help.journalNote`, `settings.about.whatsNew`, `settings.about.privacy`. Changed: `settings.crImport.help`, `settings.backup.help`, `settings.backup.import`, `settings.help.copy`, `settings.about.source` (import help in two sentences, backup help « in one file », « Import » without ellipsis, « Copy the report » next to the new « Diagnostic report » title, « Source code » with « GitHub » on the right). `help.issue.body` keeps its text; only its last-line path changed, to nav.settings › settings.cat.help › settings.help.copy of this catalog. The compare.* texts are unchanged: their context notes now point to Settings › My data. Removed: `settings.section.import`, `settings.backup.crImportTitle`, `settings.crImport.openAria`, `settings.help.text`, `settings.help.copyTitle`, `settings.help.clearHelp`, `settings.help.reportTitle`. The version line reuses `settings.summary.version`, the « Clear » button `settings.matchDiag.clear`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.import.title` | Ta igen det du redan har sett |
| `settings.crImport.help` | Crunchyroll, ADN eller Netflix. Du ser en förhandsvisning innan något skrivs. |
| `settings.backup.help` | Inställningar, kopplingar, uteslutna serier och historik i en fil. Aldrig dina inloggningar på AniList eller MyAnimeList. |
| `settings.backup.import` | Importera |
| `settings.section.compare` | Jämför |
| `settings.compare.title` | Skillnader AniList ↔ MyAnimeList |
| `settings.compare.help` | Jämför dina två listor och anpassa dem åt det håll du väljer |
| `settings.data.perSeries` | Kopplingar och uteslutna serier hanteras under {path}. |
| `compare.align` | Anpassa |
| `compare.bulk.help` | ”{action}” för över AniList till MyAnimeList; först visar en bekräftelse ändringarna. |
| `compare.job.background` | Fortsätter även om du stänger sidan. |
| `settings.help.diagnostic` | Diagnostikrapport |
| `settings.help.diagnosticHelp` | Att klistra in i en felrapport: version, webbläsare, inställningar, senaste fel. Inga tokens, inga konton. |
| `settings.help.copy` | Kopiera rapporten |
| `settings.help.journalNote` | Högst de 50 senaste, nyaste först; tokens redan dolda. |
| `settings.about.whatsNew` | Nyheter |
| `settings.about.privacy` | Integritet |
| `settings.about.source` | Källkod |

## 2026-10-17 · Popup « My series » row menu (Preact)

The row « … » menu of the popup's « My series » list and of the « Continue » card now groups the entry links and the platform searches in two sub-menus. New: `watching.menu.openEntry` (sub-menu entry, its items are the bare AniList / MyAnimeList names; wording taken from `page.openOn` without « on {service} »), `watching.menu.searchOn` (sub-menu entry, its items are the bare platform names; wording taken from `watching.searchOn`, ending with « … »). Changed: `settings.entry.help`, which now also says that « Default entry page » picks the list shown in « My series » (quoted with the exact `watching.mySeries` of this catalog). The « −1 episode » item left the menu (the row has its own −), `watching.minusOne` stays for the « On this page » card. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `watching.menu.openEntry` | Öppna titeln |
| `watching.menu.searchOn` | Sök på… |
| `settings.entry.help` | Öppnas när du klickar på en animes titel eller omslag; väljer även listan i ”Mina serier” |



## 2026-10-17 · Popup « On this page » card (Preact)

The popup's « On this page » card was redesigned: the Hold / Drop / Done row and the AniList / MAL links moved to the card's « … » menu (shared with « My series »), and the season dropdown, the star rating and the comment moved to a foldable « Details » section. New: `page.currentStatus` (grey mention at the end of the menu item of the series' current status), `page.details` (foldable button listing what the section holds, same nouns as `page.seasonPicker`, the rating words of `rating.*` and `notes.title`), `page.seasonOnAniList` (title above the season dropdown), `page.seasonHelp` (help under it on an episode page; the match word is the one of `settings.section.mappings`), `page.yourRating` (title above the stars). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `page.currentStatus` | Nuvarande status |
| `page.details` | Detaljer: säsong, betyg, kommentar |
| `page.seasonOnAniList` | Säsong på AniList |
| `page.seasonHelp` | Byter du säsong rättas kopplingen för kommande avsnitt. |
| `page.yourRating` | Ditt betyg |


## 2026-10-17 · Popup « Activity » tab (Preact)

The popup's Activity tab was redesigned: failed and pending syncs are now two sections, and every section heading is an uppercase label followed by « · {count} » added by the code. New: `queue.failedHeading` (same failure word as `queue.failed`), `queue.pendingHeading` (syncs waiting for a retry, wording of the former `queue.sectionTitle`), `ratings.heading` (the former `ratings.sectionTitle` without its count). The « To check » heading now reuses `inline.toCheck`. Removed: `queue.section`, `queue.sectionTitle`, `ratings.section`, `ratings.sectionTitle`, `review.title`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `queue.failedHeading` | Fel |
| `queue.pendingHeading` | Väntande |
| `ratings.heading` | Att betygsätta |


## 2026-10-17 · Side panel « Now playing » (Preact)

The side panel's « Now playing » tab was redesigned as cards: « You're watching » (live playback: bar, credits marker, countdown, sync state with an icon), « Your list » (status chip, « Progress » and the stepper, one line per account, the series « … » menu shared with the popup: Hold / Drop / Done moved there), then foldable sections « Rating and comment », Synopsis, related entries and Discussions. New: `panel.nowPlaying.watching` (heading of the live card, addresses the user), `panel.nowPlaying.list` (heading of the list card, same « your list » words as `page.notInList`), `panel.nowPlaying.ratingNotes` (section title, same nouns as `page.yourRating` and `notes.title`), `panel.live.creditsAt` and `panel.live.creditsUnknown` (legend of the yellow marker under the bar, credits word of `settings.trigger.credits`), `panel.live.countdownCredits` and `panel.live.countdownRatio` (countdown line, wording of the former `panel.live.countdown` plus what the sync waits for, as in `settings.trigger.credits` / `settings.summary.percentage`). Changed: `panel.live.synced` lost its trailing « ✓ » (a check icon now precedes it). The « Progress » label reuses `compare.filter.progress`. Removed: `page.action.COMPLETED`, `page.action.DROPPED`, `page.action.PAUSED` (the status button row is gone), `panel.live.countdown`, `panel.nowPlaying.progress`, `watching.nextWatched`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `panel.nowPlaying.watching` | Du tittar |
| `panel.nowPlaying.list` | Din lista |
| `panel.nowPlaying.ratingNotes` | Betyg och kommentar |
| `panel.live.creditsAt` | Eftertexter vid {time} |
| `panel.live.creditsUnknown` | Eftertexter okända · synkas vid {percent} % |
| `panel.live.countdownCredits` | Synkas om {time} · när eftertexterna börjar |
| `panel.live.countdownRatio` | Synkas om {time} · vid {percent} % av avsnittet |
| `panel.live.synced` | Synkat |


## 2026-10-17 · Side panel Schedule (Preact) and week picker

The Schedule tab of the side panel was redesigned: days in order with « No episode » on empty days, episode lines « 18:00 Crunchyroll · Japan 17:00 » (the platform time first, the Japanese broadcast last and cut first), a « ⋯ » menu with « Adjust time » (its second line gives the time and whether the delay is the series' own or the default), « Open the entry › » and « Search on… › », and a week button that opens a month calendar. New: `agenda.adjust.custom` and `agenda.adjust.default` (second line of « Adjust time », lower case after « · »), `agenda.adjust.platform` (first sentence of `agenda.estimate.title`, shown in the delay editor), `agenda.picker.label`, `agenda.picker.prevMonth`, `agenda.picker.nextMonth`, `agenda.picker.thisWeek`, `agenda.picker.hint` (month calendar; the hint names the arrow keys and the Enter key). Changed: `agenda.jp` writes the country name instead of « JP » (unchanged where it already did: ja, ko, zh-CN, zh-TW). Removed: `watching.searchOn` (the search entries are now the platform names of the « Search on… › » sub-menu). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `agenda.jp` | Japan {time} |
| `agenda.adjust.custom` | egen inställning för den här serien |
| `agenda.adjust.default` | standardfördröjning |
| `agenda.adjust.platform` | Beräknad tid på {platform}: sändningen i Japan {offset}. |
| `agenda.picker.label` | Välj en vecka |
| `agenda.picker.prevMonth` | Föregående månad |
| `agenda.picker.nextMonth` | Nästa månad |
| `agenda.picker.thisWeek` | Den här veckan |
| `agenda.picker.hint` | ↑ ↓ byter vecka, Retur visar den. |

## 2026-10-18 · History import page, steps 1 to 3 (Preact)

The history import page (steps 1 to 3) was redesigned: a 5-step indicator under the title (Platform, Reading, Analysis, Preview, Import), one tile per platform with the state of its tab (ready, no tab open, waiting for the tab, access to grant), the rules in a « How it works » card (its title reuses `onboarding.howItWorks`), and the Netflix reading card listing its three steps (done with a check, current with a bar, next ones greyed). New: `crImport.steps` (screen readers only), `crImport.step.*` (one word each: the five steps share one line at 576 px), `crImport.tile.*` (status line of a tile, no platform name), `crImport.netflix.heading`, `crImport.netflix.rowsDone` (step done: same wording as `crImport.netflix.rows` without the ellipsis), `crImport.netflix.titlesNext` and `crImport.netflix.showsNext` (steps not started yet: same wording as `crImport.netflix.titles` / `.shows` without the counts). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.steps` | Steg |
| `crImport.step.platform` | Plattform |
| `crImport.step.reading` | Läsning |
| `crImport.step.analysis` | Analys |
| `crImport.step.preview` | Förhandsvisning |
| `crImport.step.import` | Import |
| `crImport.tile.ready` | Fliken är redo |
| `crImport.tile.none` | Ingen flik öppen |
| `crImport.tile.access` | Åtkomst krävs |
| `crImport.tile.waiting` | Väntar på fliken… |
| `crImport.netflix.heading` | Läser din Netflix-historik |
| `crImport.netflix.rowsDone` | Netflix-historiken laddad (rader: {rows}) |
| `crImport.netflix.titlesNext` | Söka anime på AniList |
| `crImport.netflix.showsNext` | Läsa dina framsteg på Netflix (behållna serier) |

## 2026-10-18 · History import page, steps 4 and 5, and Backup page (Preact)

Steps 4 and 5 of the history import page and the Backup page were redesigned. The preview summary is now a row of tiles, each with its number above a label: `crImport.summary.*` are those labels without the number (they replace `crImport.preview.toUpdate`, `.review`, `.upToDate`, `.excluded`, `.ignored` and `.failed`, removed; same wording without `{count}`). The « Update N series » button has a muted hint on its left (`crImport.preview.hint.*`: a line left unchecked, none checked, locked during the import, what stays checked after a stopped or failed import). Each « To check » season shows the entry its check card will propose (`crImport.review.proposed`, a small badge) and the other entries to choose from (`crImport.review.alternatives`, `{titles}` = a localized list). The Backup page's Export card lists what the file contains and never contains (`import.included`, `import.neverIncluded`, `import.includes.*`, reusing the words of `import.summary.*` and `import.intro`); the Import card titles the file table (`import.fileContents`) and shows the export date under the file name (`import.exportedAt`, replaces `import.exportedOn`, removed: same text without the leading ` · `). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.summary.toUpdate_one` | serie att uppdatera |
| `crImport.summary.toUpdate_other` | serier att uppdatera |
| `crImport.summary.review_one` | att granska |
| `crImport.summary.review_other` | att granska |
| `crImport.summary.upToDate_one` | redan aktuell |
| `crImport.summary.upToDate_other` | redan aktuella |
| `crImport.summary.excluded_one` | utesluten |
| `crImport.summary.excluded_other` | uteslutna |
| `crImport.summary.ignored_one` | titel överhoppad (inte anime) |
| `crImport.summary.ignored_other` | titlar överhoppade (inte anime) |
| `crImport.summary.failed_one` | hittades inte (fel) |
| `crImport.summary.failed_other` | hittades inte (fel) |
| `crImport.preview.hint.unchecked` | En avmarkerad rad skrivs inte. |
| `crImport.preview.hint.none` | Markera minst en serie. |
| `crImport.preview.hint.locked` | Rutor och knappar är låsta tills importen är klar. |
| `crImport.preview.hint.stopped` | Serier som inte har skrivits än förblir markerade. |
| `crImport.preview.hint.failed` | Misslyckade serier förblir markerade. |
| `crImport.review.proposed` | föreslagen |
| `crImport.review.alternatives` | Också att välja: {titles} |
| `import.included` | Ingår |
| `import.neverIncluded` | Ingår aldrig |
| `import.includes.settings` | Inställningar |
| `import.includes.matches` | Kopplingar och uteslutna serier |
| `import.includes.history` | Historik: nyliga synkningar, avsnitt att granska, serier att betygsätta, avböjda omtittningar |
| `import.includes.signIns` | Dina inloggningar på AniList / MyAnimeList |
| `import.fileContents` | Filens innehåll |
| `import.exportedAt` | exporterad den {date} (v{version}) |

## 2026-10-18 · In-page toasts redesigned

The in-page toasts on the player were redesigned (top-right corner, Kai with a state badge, title = what happened, subtitle = series · episode, one line per service, identical results merged). New titles `toast.title.*` (saved, series completed, partial sync, failed on a service, not saved, excluded), per-service results `toast.line.completed` / `toast.line.upToDate`, partial results of a rating or a rewatch (`prompt.rating.partial`, `prompt.rewatch.partial`) and the explanation under the rewatch question (`prompt.rewatch.message`). Two services with the same result share one line, labelled `toast.line.both`. The end-of-series rating bubble title `prompt.rating.title` is now « Series completed! Your rating? » (`toast.title.completed` and the former question joined; the series title moved to the subtitle): `prompt.rating.question` was removed. `content.episodeShort` is now the bubbles' subtitle and uses the short form of « episode » before the number where the language has one. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `toast.title.saved` | Avsnitt {episode} sparat |
| `toast.title.completed` | Serien färdigsedd! |
| `toast.title.partial` | Delvis synkad |
| `toast.title.failedOn` | Misslyckades på {service} |
| `toast.title.notSaved` | Avsnittet sparades inte |
| `toast.title.excluded` | Serien utesluten, inget skickat |
| `toast.line.completed` | status Färdigsedd |
| `toast.line.upToDate` | redan aktuell |
| `prompt.rating.partial` | Betyget sparades delvis |
| `prompt.rewatch.partial` | Omtittningen sparades delvis |
| `prompt.rewatch.message` | Redan färdigsedd i din lista: dina framsteg börjar om vid avsnitt {progress}. |
| `content.episodeShort` | {title} · avs. {number} |
| `toast.line.both` | AniList och MyAnimeList |
| `prompt.rating.title` | Serien färdigsedd! Ditt betyg? |
