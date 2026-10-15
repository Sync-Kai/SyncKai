# Dutch (`nl`) term sheet

Binding for every change to `src/i18n/locales/nl.json` and `public/_locales/nl/messages.json`. Shared rules: `docs/i18n/GLOSSARY.md`.

Target: standard Dutch that reads naturally in the Netherlands and in Flanders, in the friendly tone of consumer apps (Netflix, Spotify, YouTube in Dutch). Browser vocabulary follows Chrome and Firefox in Dutch (`tabblad`, `zijpaneel`, `sneltoets`, `pictogram`, `opnieuw laden`). Users are addressed with **je / jij** (`je` by default, `jij` only for emphasis, e.g. “Jouw score?”).

## 1. List statuses

AniList and MyAnimeList have no Dutch interface, and Dutch fans often keep the English names. The Dutch names below follow the shelf names Dutch readers and film fans already know (Hebban: “Aan het lezen”, “Wil ik lezen”; MovieMeter: “Wil ik zien”), so they read as statuses and also work as one-tap buttons.

| English | Dutch | Reason |
|---|---|---|
| Watching (status, tab `nav.watching`) | Aan het kijken | Natural Dutch, parallel to Hebban's “Aan het lezen”; 14 characters, fits the tab. Also the tab name, quoted as ‘Aan het kijken’ |
| Completed | Voltooid (status button: Voltooien; menu item: Als voltooid markeren; confirmation: Voltooid?) | Clear and neutral, means the USER finished it. Not “Afgelopen” (finished airing) and not “Uitgekeken” (also means “fed up with”). The button is an infinitive like “Pauzeren” and “Afhaken” next to it |
| On hold | Gepauzeerd (button: Pauzeren) | Standard Dutch; the airing hiatus uses another word (“Onderbroken”) |
| Dropped | Afgehaakt (button and question: Afhaken / Afhaken?) | What fans say (“na drie afleveringen afgehaakt”). “Gestopt / Stoppen” next to “Pauzeren” would look like player controls, and it must never read as “Annuleren” (Cancel) |
| Plan to watch | Wil ik zien | Established Dutch shelf name (MovieMeter, Hebban). Works as an add button (“+ Wil ik zien”) |
| Rewatching | Aan het herkijken | Parallel to “Aan het kijken”; “herkijken” is the everyday verb for rewatching |

The add buttons of the “On this page” card use the bare status names (`page.addPlanning` “Wil ik zien” with a plus icon, `page.addCurrent` “Aan het kijken” with a play icon), like the shelf buttons of Dutch sites; the confirmation quotes them: “Toegevoegd aan ‘Aan het kijken’”.

## 2. Core terms

| English term | Dutch | Reason |
|---|---|---|
| series | serie (de), plural series | “1 serie”, “3 series”. Avoid pronouns for it (“hij” in the Netherlands, “ze” in Flanders): repeat “de serie” or rephrase |
| season | seizoen (het), plural seizoenen | |
| episode / Ep. | aflevering (de) / Afl. (mid-line: afl.) | Standard Dutch TV abbreviation; “afl.” also serves the plural (“12 afl.”) |
| arc | arc | As Dutch One Piece fans say |
| list | lijst | “je lijst” = the user's AniList / MyAnimeList list |
| entry | pagina (AniList-pagina, MAL-pagina) | The anime's page on AniList / MAL. Write “AniList-pagina” by default (cards, reasons, hints, toasts on the streaming site: there “pagina” alone is the web page open in the tab). Bare “pagina” only when the service is named in the same phrase (“Pagina openen op {service}”, “Pagina niet gevonden op MyAnimeList”) or right after “{service}: ”. Search field placeholder: “Andere titel zoeken…”. “Default entry page” (Settings › Accounts) = “Pagina’s openen op” (“Standaardpagina” reads as the browser's start page) |
| link on an AniList entry (to Netflix, Disney+, Crunchyroll…) | link; “met een Netflix-link op AniList”, “verwijst naar” | Never “gekoppeld”: koppelen / koppeling is reserved for matches |
| sync (noun) | sync (de), plural syncs | Short and common in Dutch tech language; used everywhere as the noun (“Sync mislukt”, “Wachtende syncs”, “Automatische sync”) |
| to sync (verb) | synchroniseren (gesynchroniseerd) | Standard verb; never “syncen” |
| Syncing… | Synchroniseren… | |
| to check (`review.*`, `footer.toReview`) | controleren; section “Te controleren”; a check card = “controle” | Not “nakijken”: too close to “kijken” (to watch) in a watching app (“na te kijken” could read as “still to watch”) |
| to rate (`ratings.*`, `footer.toRate`) | beoordelen; “Te beoordelen” | |
| score, rating, stars | score, sterren | AniList and MAL call it “Score”; Dutch uses “score” natively (“Jouw score?”) |
| comment (`notes.*`) | notitie | A private note on the list entry (AniList even calls it “Notes”); cannot be confused with the score |
| match, mapping (`match.*`, Settings › Matches) | koppeling, plural koppelingen | Remembered link platform season → AniList page |
| match / align (AniList ↔ MAL `compare.*`) | afstemmen, afstemming; bulk buttons “Alles zoals AniList / MAL”, “Filter zoals AniList / MAL” | Copying values from one service to the other; a different concept from the remembered match. The results use the neutral “bijgewerkt” (also shown by the history import) |
| difference | verschil | |
| excluded series | uitgesloten serie / uitgesloten series | Button that excludes: “Uitsluiten”; long form “Serie niet meer synchroniseren” |
| pending sync, queue (`queue.*`) | wachtende sync, wachtende syncs | Footer: “1 sync wacht”, “2 syncs wachten” |
| to abandon (a pending sync) | opgeven | “Mislukt — opgegeven” |
| credits | aftiteling | Standard Dutch for end credits |
| popup | pop-up (de) | Dutch spelling (Van Dale) |
| side panel | zijpaneel (het) | Chrome's Dutch name; also used on Firefox for consistency inside SyncKai |
| Now playing (panel tab) | Nu te zien | Short (≤ 12), covers episode and series pages; “Nu kijken” would read as an order (“watch now”) |
| Schedule (panel tab, `agenda.*`) | Kalender | Weekly calendar of releases; reused in “Meldingen & kalender” |
| On this page | Op deze pagina | |
| preferred player | Voorkeursplatform | “player” means the streaming service; “speler” would read as a media player or a sports player |
| history import (`crImport.*`) | kijkgeschiedenis importeren; the running job = de import | “Kijkgeschiedenis” is YouTube's Dutch word |
| backup (`settings.backup.*`, `backup.*`, `import.*`) | back-up (de) | Dutch spelling. File name: `synckai-back-up-{date}.json`. Never used for the history import |
| history (inside a backup) | sync-geschiedenis | Makes clear it is SyncKai's own sync history, not a streaming history |
| preview | voorbeeld | |
| Read my history (import button) | Mijn geschiedenis lezen | Error messages that say “read again” quote this button: “klik daarna opnieuw op ‘Mijn geschiedenis lezen’” |
| already up to date | al bijgewerkt | Import chip after a service abbreviation (`crImport.skipReason.up-to-date`): “up-to-date”, so it never reads “AL al bijgewerkt” |
| Retry / Run again | Opnieuw proberen / Opnieuw; “Retry failed ones” = Mislukte opnieuw proberen | Never “Mislukte opnieuw”: it reads as a past-tense sentence (“failed again”) |
| Ignore (button), ignored (title) | Negeren, genegeerd | “set aside” in a match reason = “buiten beschouwing gelaten”, not “genegeerd” |
| rewatch | herkijken (noun: het herkijken); offer declined = afgewezen herkijkvoorstel | |
| account | account (het) | |
| connect / connected / not connected | verbinden / verbonden / niet verbonden | Not “koppelen”, reserved for matches |
| reconnect | opnieuw verbinden | |
| sign in / sign out, Disconnect | inloggen / uitloggen; button “Uitloggen” | “Aanmelden” means “sign up” to many readers in the Netherlands |
| session expired | Sessie verlopen | |
| sign-ins (tokens in a backup) | inloggegevens | |
| release alerts (`airing.*`, `settings.quick.airing.label`) | Afleveringsmeldingen; short form “meldingen” (summaries, fragments) | Browser notifications are “meldingen” in Dutch |
| on-page notifications (`settings.section.notifications`) | Berichten op de pagina | Keeps “meldingen” for release alerts |
| alerts (level “Alerts only”, `settings.notif.alertsOnly.*`) | waarschuwingen; “Alleen waarschuwingen” | Messages that need action, not release alerts |
| release, airing; Japanese broadcast | verschijnen, uit zijn (“Afl. 5 van Frieren is uit”), uitzending; Japanse uitzending | |
| airing status (`page.airing.*`) | Lopend · Afgelopen · Binnenkort · Geannuleerd · Onderbroken | “Afgelopen” = finished airing, never the user's “Voltooid” |
| offset, delay | vertraging (Schedule, alerts); verschuiving (episode offset of a match) | |
| estimated release time (Schedule tooltips, Settings › Kalender) | geschatte tijd | Not “releasetijd” (anglicism); same words as “Geschatte tijd op de platforms” |
| player (the streaming site's video player, panel status) | videospeler | “speler” alone is ambiguous; the preferred “player” is a platform (Voorkeursplatform) |
| shortcut | sneltoets | Chrome's Dutch word |
| Settings (`nav.settings`) | Instellingen | |
| Activity (`nav.activity`) | Activiteit | |
| tab (browser and panel) | tabblad | |
| icon (toolbar) | pictogram (“het SyncKai-pictogram”) | |
| to reload | opnieuw laden | Chrome's Dutch wording |
| Settings categories | Afspelen & sync · Meldingen & kalender · Sneltoetsen · Accounts · Mijn gegevens · Taal · Hulp & info | Groups on the home: Snelle instellingen · Afspelen & meldingen · Gegevens & hulp |
| Settings sections | Afspelen · Sync · Zijpaneel · Netflix (alleen anime) · Nieuwe afleveringen · Berichten op de pagina · Kalender · Koppelingen · Uitgesloten series · Back-up · Importeren · Gevarenzone · Hulp · Over | |
| Settings paths quoted in sentences | Instellingen › Afspelen & sync · Instellingen › Uitgesloten series · Instellingen › Hulp › Diagnoserapport kopiëren | Always the exact labels above |

## 3. Conventions

- **Register**: informal `je`; imperatives in the singular (“Probeer het opnieuw”, “Controleer je verbinding”). Buttons use the infinitive (“Opslaan”, “Annuleren”, “Opnieuw proberen”, “Bestand kiezen…”).
- **Capitalisation**: sentence case. Compounds with a product name take a hyphen (“AniList-pagina”, “Netflix-tabblad”, “{service}-account”, “Disney+-tabblad”).
- **Quotation marks**: single curly quotes ‘…’ for quoted titles and UI labels (‘Frieren’, ‘Tijd aanpassen’, ‘Voltooid’); the apostrophe is ’ (pagina’s).
- **Screen and tab names** keep their capital wherever they are referred to, screen-reader labels included: “open Instellingen”, “Terug naar Instellingen”, “open Activiteit”, “in Activiteit”, “gebruikt door de Kalender”.
- **Colon and spacing**: no space before a colon, question mark or exclamation mark; “85%” without a space.
- **Ellipsis**: the single character `…`.
- **Abbreviations**: `min` (minutes), `u` (uur, hours), `d` (dagen, days), `s` (seconds), `Afl.` / `afl.` (aflevering), `nr.` (number). Example: “Afl. 5 over 18 u”, “2 u geleden”, “over 3 d”. The Schedule offset (“+1 h”, “+45 min”) is formatted by the code (`formatOffset`), not by the catalog.
- **Relative times** are inserted after a colon so every value reads well: “Laatst gecontroleerd: zojuist”, “Voltooid: 2 dagen geleden”, “Laatste analyse: gisteren”.
- **“{service}: {message}”** stays “{service}: {message}” (“AniList: aflevering 5 opgeslagen”); the message is a lowercase fragment without a final period. Fragments that the code lowercases never start with a product name or with “IJ”.
- **“{title}: completed”** → “{title}: voltooid” (also “{title}: gepauzeerd”, “{title}: afgehaakt”).
- **Progress counters without plural variants** put the noun first so every number works: “Analyse: seizoen {done} / {total}”, “Geschiedenis lezen: pagina {pages}, …”.
- **Plurals**: Dutch has `_one` (1) and `_other` (0, 2, 3…). “uur” does not change after a number (“3 uur”).

## 4. Netflix

- Name of the Viewing activity page in Dutch: Kijkactiviteit.
- Label of the “Show more” button at the bottom of netflix.com/viewingactivity in Dutch: **Meer weergeven** (Netflix's Dutch help centre, help.netflix.com/nl/node/101917, step 4: “Gebruik de knop Meer weergeven als je een lijst met beperkte titels ziet”; English page: “use the Show More button”). `crImport.netflix.rule` quotes it: “met de knop ‘Meer weergeven’”. Not verified on the live site with a Dutch profile.
- Developer note (review of 2026-10-14): the import only clicks buttons whose text is in the list of `netflixTabOp` (`src/platforms/netflix/tab-op.ts`); “meer weergeven” was added to it in the final pass of 2026-10-14, so a Dutch Netflix profile reads the whole history.

## Development builds only

Settings › Help & about sections that exist only in development builds (2026-10-15, `settings.debugTrace.*`).

| English | Term |
|---|---|
| debug trace | debugtrace (de trace) |
| event (one line of the trace) | gebeurtenis |
| verbose mode | uitgebreide modus |
