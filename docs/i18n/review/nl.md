# Dutch (`nl`) review log

Independent review of the Dutch interface, 2026-10-14.

- **Scope**: all 934 keys of `src/i18n/locales/nl.json` (each read with its note in `docs/i18n/context.json`, against `en.json`, `fr.json` and `de.json`), `public/_locales/nl/messages.json`, the term sheet `docs/i18n/glossary/nl.md`.
- **Target**: standard Dutch for the Netherlands and Flanders, informal `je`, anime fans.
- **Checks**: terminology audit of the core terms, key-by-key review (meaning, grammar, register, placeholders, composed fragments, cross-references, length, plurals for 0/1/2/3/5/11/21/22/25/101, leftover English), browser strings. Layout checked in the code for the doubtful lengths (`page-notifications.ts`, `media-actions.ts`, `compare-section.ts`, `footer.ts`, `review-card.ts`).
- **Result**: 48 changes in `nl.json`, none in `messages.json`. `npm run i18n:check -- nl`: 0 errors, 59 informative length warnings (all checked, see below).

## Terminology audit

The term sheet's choices hold up and are applied consistently: series *serie / series*, season *seizoen*, episode *aflevering / Afl.*, list *lijst*, sync *sync / synchroniseren*, to check *Te controleren / controle*, to rate *Te beoordelen*, score *score*, comment *notitie*, match *koppeling*, excluded *uitgesloten*, pending sync *wachtende sync*, credits *aftiteling*, popup *pop-up*, side panel *zijpaneel*, Now playing *Nu te zien*, Schedule *Kalender*, On this page *Op deze pagina*, preferred player *Voorkeursplatform*, history import *Kijkgeschiedenis importeren*, backup *back-up*, preview *voorbeeld*, rewatch *herkijken*, account / connect / session expired *account / verbinden / Sessie verlopen*, release alerts *Afleveringsmeldingen / meldingen*, Settings *Instellingen* and its categories, Activity *Activiteit*, statuses *Aan het kijken · Voltooid · Gepauzeerd · Afgehaakt · Wil ik zien · Aan het herkijken*. Every quoted UI label and Settings path matches its own key (‘Aan het kijken’, ‘Te controleren’, ‘Tijd aanpassen’, ‘Mijn geschiedenis lezen’, ‘Nu te zien’, ‘Openen’, ‘Wijzigen’, ‘Instellen’, ‘Jouw score?’, Instellingen › Afspelen & sync, Instellingen › Uitgesloten series, Instellingen › Hulp › Diagnoserapport kopiëren). Firefox's Dutch menu item “Extensiesneltoetsen beheren” was verified in mozilla-l10n (`aboutAddons.ftl`).

Problems found and fixed:

1. **“pagina” ambiguity**: 17 keys used bare “pagina” for an AniList entry in places where it reads as the web page (on-site toasts, side panel hints, To check cards). They now say “AniList-pagina” (the search placeholder says “Andere titel zoeken…”); bare “pagina” remains only when the service is named in the same phrase. The Settings label “Standaardpagina” read as the browser's start page: now “Pagina’s openen op”.
2. **“gekoppeld”** (reserved for matches, *Koppelingen*) was used for AniList's links to Netflix / Disney+ in 4 help texts: now “met een Netflix-link op AniList”.
3. **Screen and tab names** written in lowercase in 4 references (“open instellingen”, “bekijk activiteit”): now the exact labels “Instellingen”, “Activiteit”.
4. **“releasetijd”** (anglicism) replaced by “Geschatte tijd”, the wording of the Settings label.

## Changes

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `agenda.empty.noSeries` | Je bent nog geen serie aan het kijken. Begin er een te kijken op Crunchyroll of ADN, dan verschijnen de nieuwe afleveringen hier. | Je bent nog geen serie aan het kijken. Begin aan een serie op Crunchyroll of ADN, dan verschijnen de nieuwe afleveringen hier. | style | “Begin er een te kijken op …” is clumsy; “aan een serie beginnen” is the idiomatic phrase. |
| `agenda.empty.noSeriesPlatforms` | Je bent nog geen serie aan het kijken. Begin er een te kijken op {platforms}, dan verschijnen de nieuwe afleveringen hier. | Je bent nog geen serie aan het kijken. Begin aan een serie op {platforms}, dan verschijnen de nieuwe afleveringen hier. | style | Same fix as agenda.empty.noSeries. |
| `agenda.estimate.custom` | Geschatte releasetijd: Japanse uitzending {offset} (ingesteld voor deze serie). | Geschatte tijd: Japanse uitzending {offset} (ingesteld voor deze serie). | terminology | Avoids the anglicism “releasetijd”; same wording as the Settings label “Geschatte tijd op de platforms”. |
| `agenda.estimate.title` | Geschatte releasetijd op {platform}: Japanse uitzending {offset}. Aan te passen in Instellingen of met ‘Tijd aanpassen’. | Geschatte tijd op {platform}: Japanse uitzending {offset}. Aan te passen in Instellingen of met ‘Tijd aanpassen’. | terminology | Same as agenda.estimate.custom. |
| `compare.job.retryFailed` | Mislukte opnieuw | Mislukte opnieuw proberen | meaning | “Mislukte opnieuw” reads as a past-tense sentence (“failed again”). 25 characters (DE 23): shrink-0 button in a banner whose text wraps. |
| `compare.skip.missingSource` | Niet op {service}: niets te kopiëren (SyncKai verwijdert nooit iets uit je lijsten). | Niet op {service}: niets te kopiëren (er wordt nooit iets verwijderd). | meaning | Overstatement: SyncKai can remove a series (“Uit lijst verwijderen”); the source only says this alignment never deletes entries. |
| `crImport.intro` | SyncKai leest je kijkgeschiedenis in je {platform}-tabblad, zoekt elk seizoen op AniList op en laat je zien wat er verandert voordat er iets wordt geschreven. | SyncKai leest je kijkgeschiedenis in je {platform}-tabblad, vindt elk seizoen op AniList en laat je zien wat er verandert voordat er iets wordt geschreven. | style | Double “op … op”; EN “finds”. |
| `crImport.netflix.rule` | Netflix: SyncKai laadt de geschiedenis met de knop die meer regels toont op de pagina Kijkactiviteit (er wordt verder nergens op geklikt), houdt alleen de titels over die als anime op AniList staan en leest hun voortgang. | Netflix: SyncKai laadt de geschiedenis met de knop ‘Meer weergeven’ op de pagina Kijkactiviteit (er wordt verder nergens op geklikt), houdt alleen de titels over die als anime op AniList staan en leest hun voortgang. | cross-reference | Netflix’s own Dutch label, confirmed in its Dutch help centre (help.netflix.com/nl/node/101917, step 4); the note asks for the site’s label. |
| `crImport.review.help` | Onzekere koppeling: er wordt niets geschreven. Maak controles aan om de juiste pagina te kiezen in de pop-up (Activiteit). | Onzekere koppeling: er wordt niets geschreven. Maak controles aan om de juiste AniList-pagina te kiezen in de pop-up (Activiteit). | terminology | Bare “pagina” is ambiguous (web page vs AniList entry); term sheet rule. |
| `crImport.review.created_one` | {count} controle aangemaakt: kies de juiste pagina in de pop-up (Activiteit). | {count} controle aangemaakt: kies de juiste AniList-pagina in de pop-up (Activiteit). | terminology | Same “pagina” ambiguity. |
| `crImport.review.created_other` | {count} controles aangemaakt: kies de juiste pagina’s in de pop-up (Activiteit). | {count} controles aangemaakt: kies de juiste AniList-pagina’s in de pop-up (Activiteit). | terminology | Same “pagina” ambiguity. |
| `crImport.skipReason.beyond` | boven het totaal | na de laatste afl. | meaning | “AL boven het totaal” is cryptic in the chip; the history episode comes after the entry’s last episode. 18 ≤ 20 characters. |
| `crImport.error.noHistory` | Geschiedenis niet gevonden: lees die opnieuw. | Geschiedenis niet gevonden: klik opnieuw op ‘Mijn geschiedenis lezen’. | cross-reference | “lees die opnieuw” is a literal calque; like the other import errors, quote the button (term sheet). |
| `feedback.review.message` | {reason}. Klik op het SyncKai-pictogram om de juiste pagina te kiezen. | {reason}. Klik op het SyncKai-pictogram om de juiste AniList-pagina te kiezen. | terminology | Shown on the streaming site, where “pagina” is read as the web page itself. |
| `footer.chip.expired` | {service}-account verlopen — open instellingen | {service}-account verlopen — open Instellingen | cross-reference | Names the Settings screen: exact label “Instellingen”. |
| `footer.chip.ok` | {service}-account verbonden — open instellingen | {service}-account verbonden — open Instellingen | cross-reference | Names the Settings screen: exact label “Instellingen”. |
| `footer.seeActivity` | {label} — bekijk activiteit | {label} — open Activiteit | cross-reference | Names the Activity tab: exact label “Activiteit”. |
| `match.titleOnlySeason` | Pagina ‘Seizoen {season}’ van de serie, absolute nummering klopt | AniList-pagina ‘Seizoen {season}’ van de serie, absolute nummering klopt | terminology | Bare “pagina” for an entry; term sheet rule. |
| `match.specialSeason` | Speciale aflevering / OVA: kies de pagina | Speciale aflevering / OVA: kies de AniList-pagina | terminology | Also shown in the on-site toast, where “de pagina” is the web page. |
| `match.dedicatedSeason` | Aparte pagina voor het seizoen ‘{title}’ | Aparte AniList-pagina voor het seizoen ‘{title}’ | terminology | Bare “pagina” for an entry. |
| `match.platformSeasonsSingle` | Maar één AniList-pagina met een link, en die dekt niet alle {platform}-seizoenen: seizoen te controleren | Slechts één AniList-pagina verwijst naar deze serie en die dekt niet alle {platform}-seizoenen: seizoen te controleren | style | “Maar één … met een link, en die …” is colloquial and clumsy; “verwijst naar” as in the other link reasons. |
| `match.otherSeriesExcluded` | Een pagina met een link naar een andere serie op het platform is genegeerd: seizoen te controleren | Een AniList-pagina met een link naar een andere serie op het platform is buiten beschouwing gelaten: seizoen te controleren | meaning | “set aside” is not “genegeerd” (the Ignore button / ignored titles); bare “pagina” for an entry. |
| `match.single` | Enige pagina | Enige AniList-pagina | terminology | Bare “pagina” for an entry. |
| `match.singleAbsolute` | Enige pagina, absolute nummering | Enige AniList-pagina, absolute nummering | terminology | Bare “pagina” for an entry. |
| `match.special` | Speciale aflevering (geen heel getal): niet gesynchroniseerd | Speciale aflevering (geen geheel getal): niet gesynchroniseerd | terminology | The standard term for an integer is “geheel getal”. |
| `onboarding.hint.anilist` | Aanbevolen voor de herkenning | Aanbevolen voor betere herkenning | style | “voor de herkenning” sounds unidiomatic (which recognition?). |
| `page.action.COMPLETED` | Voltooid | Voltooien | consistency | Action button next to “Pauzeren” and “Afhaken” (infinitives); the participle reads like the status chip. |
| `panel.live.reviewHint` | Klik op het SyncKai-pictogram om de juiste pagina te kiezen. | Klik op het SyncKai-pictogram om de juiste AniList-pagina te kiezen. | terminology | Side panel next to a streaming page: bare “pagina” is ambiguous. |
| `panel.live.waiting` | Wachten op de speler… | Wachten op de videospeler… | style | “speler” alone is ambiguous (also a person); 26 ≤ 30 characters. |
| `panel.nowPlaying.notFoundHint` | Kijk de aflevering uit om de juiste pagina te kiezen: SyncKai vraagt het je dan in de pop-up (‘Te controleren’). | Kijk de aflevering uit om de juiste AniList-pagina te kiezen: SyncKai vraagt het je dan in de pop-up (‘Te controleren’). | terminology | Bare “pagina” for an entry. |
| `review.candidatesAria` | Bijbehorende pagina | Bijbehorende AniList-pagina | terminology | Bare “pagina” for an entry. |
| `review.episodeOnEntry` | Aflevering op de pagina | Aflevering op de AniList-pagina | terminology | Bare “pagina” for an entry. |
| `review.invalidRange` | Tussen 1 en {max} voor deze pagina. | Tussen 1 en {max} voor deze AniList-pagina. | terminology | Bare “pagina” for an entry. |
| `review.noCandidates` | Geen pagina voorgesteld: gebruik de zoekfunctie. | Geen AniList-pagina voorgesteld: gebruik de zoekfunctie. | terminology | Bare “pagina” for an entry. |
| `review.searchPlaceholder` | Andere pagina… | Andere titel zoeken… | style | Placeholder of a search field where the user types a title; “Andere pagina…” reads as “another (web) page”. |
| `settings.backHomeAria` | Terug naar instellingen | Terug naar Instellingen | cross-reference | Names the Settings screen: exact label “Instellingen”. |
| `settings.crImport.help` | Crunchyroll, ADN of Netflix: haal je geschiedenis in, met een voorbeeld vóór het verzenden | Crunchyroll, ADN of Netflix: werk je lijsten bij met je geschiedenis (eerst een voorbeeld) | meaning | “je geschiedenis inhalen” is unidiomatic and says the history itself is caught up; the point is updating the lists from it. |
| `settings.entry.label` | Standaardpagina | Pagina’s openen op | meaning | “Standaardpagina” reads as the browser’s start/default page; the row picks AniList or MAL for anime pages. 18 ≤ 24. |
| `settings.entry.help` | Opent bij een klik op de titel of cover van een anime, als beide accounts verbonden zijn | Bij een klik op de titel of cover van een anime, als beide accounts verbonden zijn | consistency | Follows the new label (no subject-less “Opent”). |
| `settings.netflix.helpOff` | Alleen anime die op AniList aan Netflix gekoppeld zijn, worden gesynchroniseerd. Je browser vraagt om toegang tot netflix.com | Alleen anime met een Netflix-link op AniList worden gesynchroniseerd. Je browser vraagt om toegang tot netflix.com | terminology | “gekoppeld” is reserved for matches (Koppelingen); the AniList entry has a link to Netflix. |
| `settings.netflix.helpOn` | Alleen anime die op AniList aan Netflix gekoppeld zijn, worden gesynchroniseerd, ook in Netflix-tabbladen die al open zijn | Alleen anime met een Netflix-link op AniList worden gesynchroniseerd, ook in Netflix-tabbladen die al open zijn | terminology | Same as settings.netflix.helpOff. |
| `settings.disney.helpOff` | Alleen Japanse anime die op AniList aan Disney+ gekoppeld zijn, worden gesynchroniseerd. Je browser vraagt om toegang tot disneyplus.com | Alleen Japanse anime met een Disney+-link op AniList worden gesynchroniseerd. Je browser vraagt om toegang tot disneyplus.com | terminology | Same as settings.netflix.helpOff. |
| `settings.disney.helpOn` | Alleen Japanse anime die op AniList aan Disney+ gekoppeld zijn, worden gesynchroniseerd. In een Disney+-tabblad dat al open was, begint het volgen bij de volgende aflevering | Alleen Japanse anime met een Disney+-link op AniList worden gesynchroniseerd. In een Disney+-tabblad dat al open was, begint het volgen bij de volgende aflevering | terminology | Same as settings.netflix.helpOff. |
| `settings.notif.discreet.desc` | Klein balkje voor 3 s in een hoek. Niets in volledig scherm; het extensiepictogram toont een vinkje. | Een klein balkje in een hoek, 3 s lang. Niets in volledig scherm; het extensiepictogram toont een vinkje. | style | “voor 3 s” can be read as “before 3 s”. |
| `settings.ratingPrompt.help` | Een ballon ‘Jouw score?’ wanneer een serie op Voltooid komt | Een ballon ‘Jouw score?’ zodra een serie op ‘Voltooid’ staat | grammar | “op Voltooid komt” is unidiomatic; the status label is quoted like the other UI labels. |
| `sync.alreadyCompleted` | Al gemarkeerd als voltooid | Al als voltooid gemarkeerd | style | Natural word order (participle last), as in engagement.notCompleted. |
| `sync.correctionPending` | Correctie open voor dit seizoen: de aflevering wordt toegepast zodra je over de kaart in Activiteit hebt beslist | Openstaande correctie voor dit seizoen: de aflevering wordt toegepast zodra je in Activiteit over de kaart hebt beslist | style | “Correctie open” is telegraphic; smoother adverbial order. |
| `watching.status.COMPLETED` | Markeren als voltooid | Als voltooid markeren | consistency | Same pattern as “Huidige aflevering als bekeken markeren” and “Volgende aflevering als bekeken markeren”. |

Changes per category: terminology 22 · style 10 · meaning 6 · cross-reference 6 · consistency 3 · grammar 1 (total 48).

## Term sheet updates (`docs/i18n/glossary/nl.md`)

- Completed: status button “Voltooien”, menu item “Als voltooid markeren”, confirmation “Voltooid?”.
- Entry: “AniList-pagina” by default, bare “pagina” only next to the service name or after “{service}: ”; search placeholder “Andere titel zoeken…”; “Default entry page” = “Pagina’s openen op”.
- New rows: link on an AniList entry (“met een Netflix-link op AniList”, “verwijst naar”, never “gekoppeld”); estimated time (“geschatte tijd”, not “releasetijd”); the site's video player (“videospeler”); Ignore / ignored (“Negeren”, “genegeerd”) vs “set aside” (“buiten beschouwing gelaten”); “Retry failed ones” = “Mislukte opnieuw proberen”.
- Conventions: screen and tab names keep their capital wherever they are referred to, screen-reader labels included.
- Netflix: the Dutch label of the “Show more” button is “Meer weergeven” (Netflix help centre, help.netflix.com/nl/node/101917, step 4), now quoted in `crImport.netflix.rule`; developer note on the button detection (below).

## Browser strings (`public/_locales/nl/messages.json`)

Reviewed, unchanged: `extDescription` is natural and 84 characters (≤ 132); `cmdCompleteEpisode` and `cmdOpenSidePanel` are identical to `settings.shortcuts.episode` and `settings.shortcuts.panel`.

## Debatable, left unchanged

| Key(s) | Current text | Why it was kept |
|---|---|---|
| `page.addCurrent`, `page.addPlanning` | Aan het kijken / Wil ik zien | Bare status names as add buttons (term sheet decision, like the shelf buttons of Dutch sites; the note requires the status name). The icons carry “add”; a native tester should confirm users read them as actions. |
| `compare.breakdown.progress_*` | {count} voortgang | As elliptical as EN “30 progress”; “voortgangsverschillen” would be heavy in the ` · ` line; the filter chip “Voortgang 30” explains it. |
| `panel.nowPlaying.relations` | Vervolgen en meer | “vervolgen” is also a verb (to prosecute), but the heading sits above sequel cards; alternative “Vervolg en gerelateerd”. |
| `content.shortcut.alreadySynced` | Al gesynchroniseerd | Drops “Aflevering”: the pill continues with “· {title} · aflevering {n}”, repeating it would be heavier. |
| `settings.summary.airingOnTime` | meldingen op tijd | Mirrors EN / FR / DE; “meldingen direct” would say “no delay” more explicitly. |
| `settings.panel.tab.last` | Laatste | “Laatst geopend” (14) exceeds the 12-character limit of the 3-button control. |
| `compare.bulk.filtered.*` | Filter zoals AniList / MAL | “Filter” could be read as a verb; mirrors DE, shown next to the active filter chips (term sheet). |
| `crImport.preview.upToDate*`, `feedback.service.upToDate`, `toast.pill.alreadyUpToDate`, `toast.pill.upToDate` | al bijgewerkt | Term sheet choice for “already up to date”; “al” keeps it apart from the success word “bijgewerkt”. |
| 9 keys with “schrijven / geschreven” | er wordt niets geschreven, Niets te schrijven… | Same verb as FR “écrire” / DE “schreiben”; “opslaan / wijzigen” would be more everyday Dutch, but consistency was preferred. |
| `crImport.skip.sessionClosed`, `crImport.error.sessionClosed`, `sync.sessionClosed`, `queue.sessionClosed` | account uitgelogd of gewisseld | Telegraphic (a user logs out, not an account) but common in Dutch UIs and parallel to DE. |
| `settings.help.reportTitle` | melding op GitHub | “melding” otherwise means a release alert; the GitHub context is clear. |
| Settings › Hulp, Hulp & info | Hulp | Correct Dutch; Chrome and Firefox say “Help” in Dutch menus. Term sheet decision. |
| `watching.confirm.COMPLETED` | Voltooid? | Kept after the button became “Voltooien”: reads as “(mark as) completed?”. |
| `crImport.read.progress` | Geschiedenis lezen: pagina {pages}, {items} afleveringen… | No plural variant: wrong only when exactly 1 episode was read. |

## Length warnings (59, informative)

- Within the limit given by the note: `agenda.adjust.save`, `compare.job.stop`, `crImport.preview.all`, `crImport.preview.add`, `crImport.skipReason.repeating`, `list.remove.yes`, `notes.save`, `import.closeTab`, `import.import`, `import.section.*`, `nav.watching` (14 = limit), `page.action.*` (≤ 10), `settings.autoSync.label`, `settings.backup.export`, `settings.delay.title`, `settings.mappings.hide`, `settings.netflix.label` / `settings.disney.label` (25 ≤ 26), `settings.shortcut.set`, `settings.shortcuts.unset`, `settings.status.saved`, `settings.cat.data`, `panel.live.autoSyncOff` (28 ≤ 30), `panel.live.synced`.
- Screen readers only: `crImport.platform`, `inline.retryOn`, `panel.tabs`, `ratings.ignoreAria`, `review.candidatesAria`, `watching.sortAria.remaining`.
- Wrapping texts, tooltips and bubble titles: `settings.airing.enableFirst`, `prompt.rewatch.title`, `prompt.rewatch.saving`, `content.shortcut.paused.title`, `page.added.CURRENT`, `match.single`.
- Same length as German: `common.retry` (16), `common.syncing` (15), `common.reconnect` (17, DE 16).
- Checked in the layout code: `settings.notif.alertsOnly.title` (21 > 18) sits in full-width stacked cards; `page.status.REPEATING` (17) is a truncating chip with enough room; `review.searchPlaceholder` (20) fills a flex-1 field; `compare.job.retryFailed` (25, not flagged) is a shrink-0 button next to wrapping text.
- To look at in the UI: `common.reconnect` “Opnieuw verbinden” in the 52 px popup footer next to “Sessie verlopen”; `settings.summary.episodeUnset` / `panelUnset` in the truncated home summary.

## For developers (outside the catalogs)

The Netflix history import clicks only buttons whose text is in the `labels` list of `netflixTabOp` (`src/shared/netflix-import.ts`: French, English and German labels). Netflix shows “Meer weergeven” to Dutch profiles, so reading stops after the first rows and `readNetflixHistory` reports a complete (non-partial) history. Adding `'meer weergeven'` (and the labels of the other new locales) fixes it; the Dutch label still needs checking on the live site.

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | Winter / Lente / Zomer / Herfst | Winter {year} / Lente {year} / Zomer {year} / Herfst {year} | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |
| `sync.noServiceFollows` | Geen enkele verbonden dienst volgt deze serie. | Geen enkele verbonden dienst heeft een pagina voor deze serie. | Meaning: shown when no connected service has an entry for the anime (no AniList / MyAnimeList ID), not when none “tracks” it; English, French and German fixed the same way. Term sheet: entry = *pagina* |

Code fixes that change how this catalog is displayed:

- Netflix history import: the “Meer weergeven” button of a Netflix profile in this language is recognized (label checked by the reviewer on Netflix’s help article 101917 in this language): such an import no longer stops after the first rows as if the history were complete.
- The signed delays of the Schedule tooltips (`agenda.estimate.*`) now use `time.countdown.*`: “+1 u 30 min”.
- Lists of names in `{services}` and `{titles}` use the language’s own conjunction (`Intl.ListFormat`) instead of “, ”.

Layout (`npm run test:i18n-layout`), fixed in the components without changing the text: `queue.nextAttempt`, `queue.failed` (Activity › pending syncs): the buttons go below the status when it is long.

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). The singular `_one` names the entry's only episode.

| Key | Text |
|---|---|
| `sync.beyondEntry_one` | Aflevering {progress} valt buiten de enige aflevering van de pagina |
| `sync.beyondEntry_other` | Aflevering {progress} valt buiten de {count} afleveringen van de pagina |

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | De knop ‘Meer weergeven’ is niet herkend in de taal van je Netflix-profiel: alleen de recentste afleveringen zijn gelezen. Zet dat profiel op Netflix in dezelfde taal als SyncKai en lees de geschiedenis opnieuw. |
