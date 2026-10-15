# Swedish (`sv`) term sheet

Binding for every change to `src/i18n/locales/sv.json` and `public/_locales/sv/messages.json`. Shared rules: `docs/i18n/GLOSSARY.md`.

Target: standard Swedish as used by Chrome, Firefox, Netflix and YouTube in Swedish, with the words Swedish anime fans use about AniList / MyAnimeList. The user is addressed with **du** (friendly, short, fan to fan). Browser terms follow the browsers' own Swedish UI: *flik* (tab), *tillägg* (extension), *sidopanel* (Chrome's side panel), *kortkommando* (keyboard shortcut).

## 1. Core terms

| English term | Swedish | Reason |
|---|---|---|
| Watching (status, tab `nav.watching`) | Tittar på | What a fan says about a series in progress ("jag tittar på Frieren"); short enough for the tab, so status and tab use the same words |
| Completed (status) | Färdigsedd | The user finished watching the series. Distinct from a series that stopped airing (*Avslutad*). Agrees with *serie*: "färdigsedd"; with *avsnitt*: "färdigsett" |
| On hold (status) | Pausad | Usual app wording; agrees with *serie*. The airing "hiatus" is *Uppehåll* (never *pausad*) |
| Dropped (status) | Avbruten | Standard Swedish, mirrors German *Abgebrochen*; "droppad" is fan slang. The ACTION "Drop" is **Hoppa av** (*Hoppa av serien*, *Hoppa av?*) because *Avbryt* is the Cancel button and the notes forbid a Drop button that reads as Cancel; "hoppa av en serie" is idiomatic for giving up on it |
| Plan to watch (status) | Planerad | Clear status adjective like German *Geplant*; works in "Till ”Planerad”" / "Tillagd i ”Planerad”" |
| Rewatching (status) | Tittar om | Same pattern as *Tittar på*; "titta om" = rewatch |
| rewatch (noun) | omtittning | Idiomatic ("värd en omtittning"); "avböjd omtittning", "ingen omtittning" |
| series | serie (en; serien, serier) | Adjectives in the common gender: *utesluten / uteslutna*, *färdigsedd*, *pausad*, *avbruten* |
| season | säsong (en; säsonger) | |
| episode / Ep. | avsnitt (ett; plural avsnitt) / **Avs.** (mid-line *avs.*) | "Avs. 5", "12 avs." Same form for every number. `review.displayed` keeps the untranslated "E" of the "S2 · E5" header |
| arc | arc | Fans keep the loanword ("Wano-arcen"); no UI string needs it today |
| list | lista (din lista) | The user's AniList / MyAnimeList list, never a playlist |
| entry | titel (AniList-titel, MyAnimeList-titel; titeln, titlar) | Swedish streaming UIs call catalogue items *titlar* (Netflix: "den här titeln"); *post* reads as a database record, which the shared glossary rules out. When a sentence also needs the anime's title (name), the name is *namnet* ("Enda AniList-titeln med det här namnet"). Menu "Open the entry on {service}" = *Öppna titeln på {service}* |
| sync (noun) | synkning (synkningen, synkningar) | One noun everywhere; compounds use *synk-*: *synkfel* (failed sync, footer), *synkpunkt*, *synkhistorik* (backup content) |
| to sync (verb) | synka (synkar, synkas, synkad / synkat / synkade) | Everyday Swedish IT verb ("Synka på Netflix", "Synkar…", "Synkat ✓") |
| Auto sync | Automatisk synkning | |
| to check (`review.*`, `footer.toReview`) | att granska; card = **granskning** (granskningar) | *Granska* is the standard Swedish UI verb for "review" (Word's *Granska* tab): examine, never a critique (*recension*). Short enough for chips ("Att granska", "3 att granska"). Plain verb "check" elsewhere = *kontrollera* ("Kontrollera din anslutning") |
| to rate (`ratings.*`, `footer.toRate`) | att betygsätta / betygsätt | |
| score / rating / stars | betyg (ett; plural betyg) / betygsätta / stjärnor | "Ditt betyg?", "Betyg 8,5/10 sparat" |
| comment (`notes.*`) | kommentar | AniList "notes", MAL "comments"; never a score |
| match, mapping (`match.*`, Settings › Matches) | koppling (kopplingar) / Kopplingar | A remembered link platform season → AniList entry. *Koppla / kopplad* is reserved for this sense (and *koppla från* = disconnect) |
| linked (an AniList entry's external link to a platform page or episode) | länkad / länka ("anime som är länkade till Netflix på AniList", "AniList-titel länkad till det här avsnittet") | Never *kopplad*: a user would look for it under Settings › Kopplingar (review 2026-10-14) |
| matching (welcome screen, "Recommended for matching") | igenkänning ("Rekommenderas för bästa igenkänning") | *Matchning* is opaque outside tracker jargon; echoes step 2 "SyncKai känner igen serien" |
| match / align (AniList ↔ MAL, `compare.*`) | anpassa (efter) / anpassning | Copying values from one service to the other (FR *aligner*); a different concept from *koppling*. Bulk buttons "Alla som på AniList" (= make every series as on AniList); with a filter active "Urvalet som på AniList" (*urval* = the filtered series; "Filtret som på…" read as changing the filter) |
| difference | skillnad | |
| excluded series | utesluten serie / uteslutna serier | Section "Uteslutna serier" |
| pending sync, queue (`queue.*`) | väntande synkning / kö | Footer: "{count} synkning väntar", "{count} synkfel" |
| credits | eftertexter (eftertexterna) | Standard Swedish for end credits |
| popup | popup-fönstret | Usual Swedish for an extension popup ("i popup-fönstret") |
| side panel | sidopanel (sidopanelen) | Chrome's Swedish term; also used for Firefox's sidebar (*sidofält*) so the UI keeps one word |
| Now playing (panel tab) | Spelas nu | Standard Swedish media label (Spotify, music apps) |
| Schedule (panel tab, `agenda.*`) | Schema | Short, reused in "Aviseringar & schema" and Settings › Schema |
| On this page (`page.*`) | På den här sidan | |
| preferred player | föredragen plattform | The note says the "player" is a streaming service; *spelare* would suggest a media-player app, and the help text speaks of *plattformar* |
| history import (`crImport.*`) | importera visningshistorik / importen | *Visningshistorik* is YouTube's Swedish word for watch history; short form *historik*. Restarting the reading = "starta läsningen igen" (never "läs igen": the user does not read, SyncKai does) |
| backup (`settings.backup.*`, `backup.*`, `import.*`) | säkerhetskopia (the file) / **Säkerhetskopiering** (page and section name) | Standard Swedish; never *historik* (that is the history import). SyncKai's own sync history stored in a backup = **synkhistorik** ("Inställningar, kopplingar, uteslutna serier och synkhistorik") |
| preview | förhandsvisning | |
| account | konto (ett; kontot) | "inget konto anslutet" |
| connect / disconnect | ansluta ("Anslut AniList") / koppla från | Swedish UI pair (Windows, Chrome) |
| sign in / sign out | logga in / logga ut | |
| session expired | Utgången session (label) / Sessionen har gått ut (sentence) | Label kept short for the footer |
| release alerts (`airing.*`, quick setting) | avsnittsaviseringar / aviseringar | *Avisering* = browser notification (Chrome, Android, Windows Swedish) |
| "Alerts only" (in-page level) | Bara varningar | Messages that need action are *varningar*, a different word from the release *aviseringar*, as the shared glossary asks |
| on-page notifications | meddelanden på sidan | SyncKai's bubbles in the page, distinct from browser *aviseringar*. Levels *Diskreta / Detaljerade / Bara varningar* (plural, agreeing with *meddelanden*) |
| release / out (an episode on a platform) | släppas / är ute ("Avs. 5 av Frieren är ute") | |
| airing / broadcast (Japan) | sändning / sänds ("sändningen i Japan"); status chip *Sänds nu* | |
| Finished / Cancelled / On hiatus / Upcoming (airing of a series) | Avslutad / Nedlagd / Uppehåll / Kommande | Never the user's *Färdigsedd* / *Pausad* |
| offset, delay (`agenda.*`) | fördröjning (delay); förskjutning (episode-number offset, `settings.mappings.offset`) | |
| progress (episodes watched) | framsteg (same form singular / plural) | Swedish app word for progress; descriptive sentences may say *antal sedda avsnitt*. Playback progress (live bar) = *förlopp* |
| shortcut | kortkommando (kortkommandon) | Chrome's Swedish term, also for "a key" meaning a key combination ("Ett kortkommando som du har ändrat…"); *tangent* only for a physical key ("&-tangenten"). Firefox's own menu item is quoted as Firefox writes it: *Hantera genvägar för tillägg* (mozilla-l10n sv-SE `aboutAddons.ftl`, checked 2026-10-14) |
| Shift key | Skift | Name on Swedish keyboards and in Windows / Chrome Swedish |
| tab (browser or panel) | flik (fliken) | |
| extension | tillägg (tillägget) | Chrome and Firefox Swedish |
| platform / service | plattform (streaming site) / tjänst (AniList, MyAnimeList) | |
| Settings (`nav.settings`) | Inställningar | |
| Settings categories | Konton · Uppspelning & synkning · Aviseringar & schema · Kortkommandon · Mina data · Språk · Hjälp & info | Section names: Uppspelning, Synkning, Sidopanel, Nya avsnitt, Meddelanden på sidan, Schema, Kopplingar, Uteslutna serier, Säkerhetskopiering, Importera, Farozon, Hjälp, Om. "Hjälp & info" rather than "Hjälp & om": a bare *om* reads unfinished in a title (review 2026-10-14) |
| Activity (popup tab) | Aktivitet | |
| Continue (card) | Fortsätt titta | Netflix Swedish wording |
| Open / Retry / Cancel / Confirm / Ignore (card) | Öppna / Försök igen / Avbryt / Bekräfta / Hoppa över | "Hoppa över" for Ignore: the card is skipped, the series is not ignored |

## 2. Conventions

- **Register**: *du*, imperatives ("Försök igen", "Ladda om sidan"). "Couldn't …" becomes "Det gick inte att …" or "<subject> kunde inte …" ("Filen kunde inte läsas"); "Unexpected error while …" becomes "Oväntat fel när …".
- **Fragments after "{service}: "**: the code lowercases their first letter, so they never start with a name or an abbreviation ("redan i din lista", "avsnitt 5 sparat").
- **Quotation marks**: ”…” (U+201D at both ends), as in Swedish typography; ’ for the apostrophe.
- **Colon and spacing**: no space before a colon, "?" or "!". Lowercase after a colon unless a full sentence follows (as in the English).
- **Ellipsis**: the single character `…` ("Synkar…", "Laddar…").
- **Dash**: the Swedish *tankstreck* is the spaced en dash ` – `, in sentences and as a separator ("{service}-kontot har gått ut – öppna inställningarna", "Säsong {season} – {title}"); never the em dash `—`.
- **Failure titles**: definite noun + *misslyckades* ("Synkningen misslyckades", "Åtgärden misslyckades", "Sökningen misslyckades", "Uppdateringen misslyckades"), not the telegraphic "X misslyckad".
- **{reason} texts** (`match.*`, `sync.correctionPending`) are followed by ". Klicka på SyncKai-ikonen för att välja rätt titel.": state the reason, do not repeat the instruction to pick the entry.
- **Abbreviations**: *min* (minutes), *s* (seconds), *h* (hours), *d* (days, countdown chip only); "om 5 min", "för 2 h sedan", "om 3 dagar". Percent with a space: "85 %". Megabytes: "MB".
- **Relative times**: "nyss", "för 5 min sedan", "för 2 h sedan", "i går", "för 3 dagar sedan"; they read after "Färdigsedd …", "Analyserades …", "Senaste kontroll: …".
- **{service}: {message}**: "AniList: avsnitt 5 sparat" (no space before the colon, fragment in lowercase).
- **{title}: completed**: "{title}: färdigsedd" (participle agrees with *serie*, not with the title); likewise "{title}: pausad", "{title}: avbruten", "{title}: borttagen från din lista".
- **Placeholders before a suffix**: hyphenate as Swedish compounds do: "{platform}-fliken", "{target}-lista", "{service}-kontot".
- **Counters without plural variants**: for progress "{done} / {total}" the noun goes before the numbers ("Analys: säsong {done} / {total}"); for running totals use label: value in parentheses ("Läser historik (sidor: {pages}, avsnitt: {items})…", "(rader: {rows})"), never "avsnitt {items}", which reads as an episode number.
- **Sort order**: "Titel (A → Ö)": Ö is the last letter of the Swedish alphabet.
- **Capitalisation**: sentence case; quoted UI names keep their own capital ("fliken ”Tittar på”", "under ”Att granska”").

## 3. Netflix

- "Show more" button at the bottom of netflix.com/viewingactivity in Swedish: **Visa mer**. Source: Netflix's Swedish help article "Visa streaming- och enhetsaktivitet" (help.netflix.com/sv/node/101917, step 4: "använder du knappen Visa mer"; re-checked 2026-10-14). Not checked on the live page with a Swedish profile.
- The page itself is called **Streamingaktivitet** in Swedish (same article, step 3; also help.netflix.com/sv/node/22205); the catalog uses that name.

## Development builds only

Settings › Help & about sections that exist only in development builds (2026-10-15, `settings.debugTrace.*`).

| English | Term |
|---|---|
| debug trace | felsökningsspår (spåret) |
| event (one line of the trace) | händelse |
| verbose mode | utförligt läge |
