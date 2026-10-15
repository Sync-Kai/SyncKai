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
