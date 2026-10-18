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

The Netflix history import clicks only buttons whose text is in the `labels` list of `netflixTabOp` (`src/platforms/netflix/tab-op.ts`: French, English and German labels). Netflix shows “Meer weergeven” to Dutch profiles, so reading stops after the first rows and `readNetflixHistory` reports a complete (non-partial) history. Adding `'meer weergeven'` (and the labels of the other new locales) fixes it; the Dutch label still needs checking on the live site.

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

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video (alleen anime) |
| `settings.prime.label` | Synchroniseren op Prime Video |
| `settings.prime.helpOff` | Alleen anime worden gesynchroniseerd (genre anime, of animatie met Japanse audio of met de exacte AniList-titel). Je browser vraagt om toegang tot primevideo.com |
| `settings.prime.helpOn` | SyncKai leest alleen wat de Prime Video-pagina al ontvangt. In een Prime Video-tabblad dat al open was, begint het volgen bij de volgende aflevering |
| `settings.prime.denied` | Toegang tot primevideo.com geweigerd: Prime Video blijft uit |
| `settings.prime.disabled` | Prime Video uitgezet: laad open Prime Video-tabbladen opnieuw om het volledig te stoppen |
| `settings.prime.error` | Kon de toegang tot Prime Video niet wijzigen, probeer opnieuw |

| Key | Text |
|---|---|
| `onboarding.intro` | Kijk je anime op Crunchyroll of ADN (Netflix, Disney+ en Prime Video optioneel): SyncKai werkt je lijst bij aan het einde van elke aflevering. |
| `watching.tip` | Netflix, Disney+, Prime Video (optioneel) en je voorkeursplatform stel je in via {path}. |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | Komt overeen met het platform: {signals} |
| `match.signalsContradict` | Komt niet overeen met het platform: {signals} |
| `match.yearRemake` | Remake herkend aan het jaar van verschijnen ({year}) |
| `match.signal.year` | jaar van verschijnen |
| `match.signal.episodes` | aantal afleveringen |
| `match.signal.duration` | duur van de afleveringen |
| `match.signal.format` | formaat (film of serie) |
| `match.signal.country` | land van herkomst |
| `match.signal.originalTitle` | originele titel |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | De onthouden koppeling komt niet overeen met het platform: {signals} |

## 2026-10-14 · Matching diagnostic (development builds only)

New keys `settings.matchDiag.*` (Settings › Help & about, section shown only in development builds, never in the published extension): the last 50 AniList matching decisions, a « Copy » button per row (one decision as JSON, for the test corpus) and a « Clear » button. `{count}` follows a label and a colon (no plural form); `JSON` is a format name. Terms from this language's term sheet (match, entry). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.title` | Diagnose van koppelingen |
| `settings.matchDiag.text` | Alleen in ontwikkelbuilds: de laatste 50 koppelingsbeslissingen met AniList, nieuwste eerst, bewaard tot de browser sluit. Kopieer er een als JSON om hem aan het testcorpus toe te voegen. |
| `settings.matchDiag.empty` | Nog geen beslissing vastgelegd |
| `settings.matchDiag.copy` | Kopiëren |
| `settings.matchDiag.copyTitle` | Deze beslissing als JSON kopiëren |
| `settings.matchDiag.copied` | Gekopieerd |
| `settings.matchDiag.copyFailed` | Kon de beslissing niet kopiëren. |
| `settings.matchDiag.clear` | Wissen |
| `settings.matchDiag.candidates` | Kandidaten: {count} |
| `settings.matchDiag.noEntry` | Geen pagina |

## 2026-10-15 · Debug trace (development builds only)

New keys `settings.debugTrace.*` (Settings › Help & about, section shown only in development builds, never in the published extension, below the matching diagnostic): a timeline of what the extension did (pages, service worker, AniList and MyAnimeList requests), a verbose switch, a category filter (category names stay in English: technical identifiers), « Copy trace » (the whole trace as JSON) and the « Clear » button of the matching diagnostic (`settings.matchDiag.clear`, reused). `{count}` and `{max}` follow a label and a colon (no plural form) and arrive formatted for the language; `JSON` is a format name; `service worker` kept as the browser's technical term. New terms added to this language's term sheet (debug trace, event, verbose mode); other terms from it (account). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.debugTrace.title` | Debugtrace |
| `settings.debugTrace.text` | Alleen in ontwikkelbuilds: een tijdlijn van wat SyncKai deed op de pagina’s, in de service worker en met AniList en MyAnimeList, nieuwste eerst, bewaard tot de browser sluit. Er worden geen tokens, cookies of account-ID’s vastgelegd. Kopieer de hele trace als JSON om hem te delen als je een probleem meldt. |
| `settings.debugTrace.empty` | Nog geen gebeurtenis vastgelegd |
| `settings.debugTrace.copy` | Trace kopiëren |
| `settings.debugTrace.copied` | Gekopieerd |
| `settings.debugTrace.copyFailed` | Kan de trace niet kopiëren. |
| `settings.debugTrace.verbose` | Uitgebreide modus (alle logregels) |
| `settings.debugTrace.count` | Gebeurtenissen: {count} / {max} |
| `settings.debugTrace.allCategories` | Alle categorieën |
| `settings.debugTrace.filterAria` | Gebeurtenissen filteren op categorie |

## 2026-10-16 · Matching diagnostic: Copy all (development builds only)

New keys in the « Matching diagnostic » section (Settings › Help & about, development builds only, never in the published extension, now collapsed by default behind its title): « Copy all » copies every recorded decision as one JSON array, next to « Clear »; its label becomes « Copied » (`settings.matchDiag.copied`, reused) and a failure reuses `settings.matchDiag.copyFailed`. `JSON` is a format name. Same word for « decision » as `settings.matchDiag.copyTitle`, in the plural; other terms from this language's term sheet. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.copyAll` | Alles kopiëren |
| `settings.matchDiag.copyAllTitle` | Alle beslissingen als JSON kopiëren |

## 2026-10-16 · Episode guards (« To check » reasons)

New reasons on a « To check » card (`fix/episode-guards`, audit SEC-01): a sync that would jump straight to the last episode from far behind, and episodes reported as finished in a burst, now wait for the user instead of being written. Same « to check » term as `match.otherSeriesExcluded`, same episode wording as `sync.beyondEntry_*`; `{from}` and `{progress}` are episode numbers. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `sync.review.finaleJump` | Rechtstreeks naar de laatste aflevering ({progress}) vanaf aflevering {from}: te controleren |
| `sync.review.burst` | Veel afleveringen binnen een paar minuten afgerond: te controleren |

## 2026-10-17 · Status bar (popup and side panel)

New texts of the status bar shown at the bottom of the popup and, now, of the side panel (`feature/ui-status-bar`): a synced episode or a count of synced episodes under the series title, shown until the user hides it (« Seen, hide », a × button label), and the history import running, ready to confirm and done. Same words as this language's term sheet: « sync » / « gesynchroniseerd » (`footer.allSynced`), « serie » / « series », « Afl. » / « afl. » (`agenda.episode`; the abbreviation also serves the plural, as the term sheet says, to keep the count line short), « import » and « Import klaar » (`crImport.apply.done`), and « voorbeeld » (preview) for the ready state, so it never reads like the finished « Import klaar »; « bevestigen » as `common.confirm`; ` · ` and ` / ` kept; `{platform}` is a brand name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `footer.dismiss` | Gezien, verbergen |
| `footer.importDone_one` | Import klaar · {count} serie bijgewerkt |
| `footer.importDone_other` | Import klaar · {count} series bijgewerkt |
| `footer.importProgress` | {platform}-import · {done} / {total} |
| `footer.importReady_one` | Voorbeeld klaar · {count} serie te bevestigen |
| `footer.importReady_other` | Voorbeeld klaar · {count} series te bevestigen |
| `footer.syncedEpisode` | Afl. {episode} gesynchroniseerd |
| `footer.syncedEpisodes_one` | {count} afl. gesynchroniseerd |
| `footer.syncedEpisodes_other` | {count} afl. gesynchroniseerd |

## 2026-10-17 · Account menu (status bar)

New texts of the account menu that opens above the AniList / MyAnimeList logo of the status bar (popup and side panel): the logo button's label (also when the session expired), the connection status line, three stat tiles (anime count, episodes watched, days watched, each number shown above its short label), the « Synced this week » row with its tooltip and value, and « View my profile ». Following this language's term sheet, used **account**, **verbonden** (as `settings.account.connected`), **sessie verlopen**, the noun **sync** (plural *syncs*) of the term sheet, **aflevering** for the stat label and **afl.** for the row value (as `footer.syncedEpisodes_*`); « day » is **d**, as `time.countdown.days`. ` · ` kept; `{service}` is a brand name, `{name}` the user's AniList / MyAnimeList user name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `accountMenu.connected` | Verbonden |
| `accountMenu.connectedAs` | {name} · verbonden |
| `accountMenu.label` | {service}-account |
| `accountMenu.labelExpired` | {service}-account, sessie verlopen |
| `accountMenu.profile` | Mijn profiel bekijken |
| `accountMenu.stats.anime_one` | anime |
| `accountMenu.stats.anime_other` | anime |
| `accountMenu.stats.days_one` | bekeken |
| `accountMenu.stats.days_other` | bekeken |
| `accountMenu.stats.daysValue` | {days} d |
| `accountMenu.stats.episodes_one` | aflevering |
| `accountMenu.stats.episodes_other` | afleveringen |
| `accountMenu.week.label` | Syncs deze week |
| `accountMenu.week.title` | Afleveringen die SyncKai deze week heeft gesynchroniseerd |
| `accountMenu.week.value_one` | {count} afl. |
| `accountMenu.week.value_other` | {count} afl. |

## 2026-10-17 · Settings redesign (Preact): new and changed keys

New texts of the redesigned Settings (Preact): the Platforms and Display categories, the screen-reader names of the back button and of the category card, the row summaries of the Settings home, the Keyboard section of Display, the two sections of Shortcuts, and the section titles and notes of Accounts. Changed: `settings.cat.notifications` (now the single word: the Schedule options moved to Platforms), `settings.summary.connected` (a word instead of ✓), `settings.summary.paused` (now a standalone, capitalised summary), `settings.summary.version` (a word instead of « v »), `settings.entry.help` (the « both accounts connected » condition moved to `settings.entry.unavailable`). Summaries are joined with ` · ` by the code; `settings.account.expiredHelp` and `settings.account.otherStillSynced` are joined as two sentences. The Display summary reuses `settings.section.language`, `settings.section.panel` and `settings.shortcuts.pointer`; the My data summary the history import and backup words; the player summary `settings.player.label`. Player summary « voorkeur: {player} » (*Voorkeursplatform*). `settings.display.shortcutsHelp` rephrased as two actions to fit 50 characters. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.cat.notifications` | Meldingen |
| `settings.cat.platforms` | Platforms |
| `settings.cat.display` | Weergave |
| `settings.backToAria` | Terug naar {page} |
| `settings.group.categories` | Categorieën |
| `settings.summary.connected` | {service} verbonden |
| `settings.summary.notConnected` | {service} niet verbonden |
| `settings.summary.bothConnected` | AniList en MyAnimeList verbonden |
| `settings.summary.auto` | Automatisch |
| `settings.summary.paused` | Gepauzeerd |
| `settings.summary.platforms_one` | {count} van {total} actief |
| `settings.summary.platforms_other` | {count} van {total} actief |
| `settings.summary.player` | voorkeur: {player} |
| `settings.summary.display` | Taal, zijpaneel, sneltoetsen |
| `settings.summary.data` | Kijkgeschiedenis importeren · back-up |
| `settings.summary.version` | Versie {version} |
| `settings.summary.noErrors` | geen fouten |
| `settings.display.keyboard` | Toetsenbord |
| `settings.display.shortcutsHelp` | Aflevering markeren of zijpaneel openen |
| `settings.shortcuts.duringPlayback` | Tijdens het afspelen |
| `settings.shortcuts.navigation` | Navigatie |
| `settings.accounts.lists` | Gesynchroniseerde lijsten |
| `settings.accounts.both` | Met beide accounts |
| `settings.accounts.privacy` | Je logt in op de website van AniList of MyAnimeList: SyncKai ziet je wachtwoord nooit. |
| `settings.account.expiredHelp` | Je afleveringen worden niet meer naar {service} gestuurd tot je opnieuw verbinding maakt. |
| `settings.account.otherStillSynced` | {service} wordt nog steeds bijgewerkt. |
| `settings.entry.help` | Bij een klik op de titel of cover van een anime |
| `settings.entry.unavailable` | Beschikbaar als AniList en MyAnimeList allebei verbonden zijn. |

## 2026-10-17 · Settings › Sync, Matches and Excluded series (Preact)

New texts of the redesigned Sync settings page and of its two sub-pages (Matches, Excluded series), moved out of My data: section titles « Automatic » / « Per series », the descriptions of the two « Episode counted as watched » cards, the « Per series » rows, the Matches intro, search, empty and no-result texts, « Show N more on {platform} », the four origin badges and their legend, the Excluded series section, note, empty hint and the « {year} series · excluded on {date} » fragments. Changed: `settings.trigger.legend` (« Episode counted as watched », where the old text was only « Episode watched »), `settings.trigger.credits` (« (recommended) » moved to `settings.trigger.creditsHelp`), and the paths of `popup.syncDisabledDetail` / `review.excludeTitle` (now nav.settings › settings.section.sync › settings.section.exclusions, built from this catalog's own titles). Removed: `settings.mappings.count_*`, `settings.mappings.help`, `settings.mappings.manage`. `{action}` is the « Re-enable » button (`settings.exclusions.help`) or the « Stop syncing this series » menu item (`settings.exclusions.emptyHelp`), so the quoted labels always match. The match / entry / excluded / re-enable words reuse this catalog's existing terms (`settings.section.mappings`, `settings.mappings.entryFallback`, `settings.section.exclusions`, `settings.exclusions.reactivate`). `settings.mappings.origin.unverified` shortened to « Geïmporteerd · te controleren » after the 320 px layout check (the badge overflowed the legend). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.section.automatic` | Automatisch |
| `settings.section.perSeries` | Per serie |
| `settings.trigger.legend` | Aflevering telt als bekeken |
| `settings.trigger.credits` | Bij het begin van de aftiteling |
| `settings.trigger.creditsHelp` | Aanbevolen: het exacte moment dat het platform doorgeeft |
| `settings.trigger.percentageHelp` | Ook gebruikt als de aftiteling onbekend is |
| `settings.sync.mappingsRow` | Onthouden koppelingen |
| `settings.sync.mappingsRowHelp` | Het AniList-seizoen dat voor elke serie is gekozen |
| `settings.sync.exclusionsRowHelp` | Nooit gesynchroniseerd, hier weer in te schakelen |
| `settings.mappings.intro_one` | {count} serie onthouden, per platform: het seizoen op het platform → de AniList-pagina waarin SyncKai schrijft. Een vergeten koppeling wordt bij de volgende aflevering opnieuw bepaald. |
| `settings.mappings.intro_other` | {count} series onthouden, per platform: het seizoen op het platform → de AniList-pagina waarin SyncKai schrijft. Een vergeten koppeling wordt bij de volgende aflevering opnieuw bepaald. |
| `settings.mappings.search` | Zoek een serie of pagina |
| `settings.mappings.noResult` | Geen koppeling voor ‘{query}’ |
| `settings.mappings.noResultHelp` | Zoek op de titel van de serie of van de AniList-pagina. |
| `settings.mappings.emptyHelp` | SyncKai onthoudt er een voor elk gesynchroniseerd seizoen. |
| `settings.mappings.showMore_one` | Nog {count} op {platform} tonen |
| `settings.mappings.showMore_other` | Nog {count} op {platform} tonen |
| `settings.mappings.origin.chosen` | Door jou gekozen |
| `settings.mappings.origin.learned` | Geleerd |
| `settings.mappings.origin.unmarked` | Oud |
| `settings.mappings.origin.unverified` | Geïmporteerd · te controleren |
| `settings.mappings.origin.chosenHelp` | Door jou bevestigd of gekozen: wordt nooit betwijfeld. |
| `settings.mappings.origin.learnedHelp` | Door SyncKai gevonden: opnieuw bepaald als het platform het tegenspreekt. |
| `settings.mappings.origin.unmarkedHelp` | Opgeslagen vóór 2.4: blijft staan, te controleren als het wordt tegengesproken. |
| `settings.mappings.origin.unverifiedHelp` | Uit een back-up: bij het eerste gebruik opnieuw gecontroleerd. |
| `settings.mappings.originLegend` | Herkomst van de koppelingen |
| `settings.exclusions.section` | Nooit gesynchroniseerd |
| `settings.exclusions.help` | Een uitgesloten serie wordt nooit meer gesynchroniseerd, in geen enkel seizoen. ‘{action}’ volgt haar weer vanaf de volgende aflevering. |
| `settings.exclusions.emptyHelp` | Wil je een serie niet meer synchroniseren, kies dan ‘{action}’ in het menu ‘⋯’ ervan. |
| `settings.exclusions.seriesYear` | serie uit {year} |
| `settings.exclusions.excludedOn` | uitgesloten op {date} |
| `popup.syncDisabledDetail` | Weer in te schakelen via Instellingen › Sync › Uitgesloten series |
| `review.excludeTitle` | Sluit de serie uit (alle seizoenen): weer in te schakelen via Instellingen › Sync › Uitgesloten series |

## 2026-10-17 · Settings › Platforms and Notifications (Preact)

Texts of the redesigned Platforms page (list of sites with « Included » / « Access missing » or a switch, preferred player dropdown, estimated release time per platform with − / + buttons, moved there from the Schedule card) and Notifications page (« On the playback page » style cards and « New episodes »). New: `settings.platforms.where`, `settings.platforms.allAnime`, `settings.platforms.included`, `settings.platforms.accessMissing`, `settings.platforms.note`, `settings.player.openOn`, `settings.player.enableFirst`, `settings.offsets.earlier`, `settings.offsets.later`, `settings.notif.legend`. Changed: `settings.player.help`, `settings.offsets.title`, `settings.offsets.help`, `page.platformOff`, `settings.section.notifications`, `settings.notif.discreet.desc`, `settings.notif.detailed.desc`, `settings.notif.alertsOnly.desc`, `settings.notif.alertsAlways`, `settings.delay.title`, `settings.airing.enableFirst` (the notification descriptions now describe the pill and the bubble, « Extra delay » replaces « Delay », the release-time help says the alerts use it too, « Turn on alerts… » is now visible text). `page.platformOff` keeps its sentence; only the path changed, from « Settings › Playback & sync » to nav.settings › settings.cat.platforms of this catalog. Removed: `settings.section.playback`, `settings.netflix.section`, `settings.netflix.label`, `settings.disney.section`, `settings.disney.label`, `settings.prime.section`, `settings.prime.label`, `settings.airing.label`, `settings.airing.help`, `settings.section.agenda`. The Schedule word, « Open », the release-alert name and the minute unit reuse this catalog's `panel.tab.agenda`, `common.open`, `settings.quick.airing.label` and `settings.offsets.unit`. `settings.offsets.title` keeps « Geschatte tijd op de platforms » (term sheet: never « releasetijd »), exactly 30 chars. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.platforms.where` | Waar SyncKai je afleveringen volgt |
| `settings.platforms.allAnime` | Alle anime |
| `settings.platforms.included` | Inbegrepen |
| `settings.platforms.accessMissing` | Geen toegang |
| `settings.platforms.note` | Een platform aanzetten vraagt om toegang tot de site. Alleen afspeel- en seriepagina’s worden gelezen. |
| `settings.player.openOn` | Afleveringen openen op |
| `settings.player.enableFirst` | Eerst aanzetten |
| `settings.player.help` | Gebruikt door ‘Openen’ als een anime op meerdere actieve platforms staat. |
| `settings.offsets.title` | Geschatte tijd op de platforms |
| `settings.offsets.help` | Na de Japanse uitzending. Gebruikt door de Kalender en de meldingen; een serie pas je aan via haar rij in de Kalender. |
| `settings.offsets.earlier` | {minutes} min eerder |
| `settings.offsets.later` | {minutes} min later |
| `page.platformOff` | {platform} staat uit: SyncKai volgt hier niets. Weer aanzetten: Instellingen › Platforms. |
| `settings.section.notifications` | Op de afspeelpagina |
| `settings.notif.legend` | Stijl van de berichten op de pagina |
| `settings.notif.discreet.desc` | Een klein balkje, een paar seconden lang, in een hoek van de video |
| `settings.notif.detailed.desc` | Een ballon met de aflevering en het resultaat op AniList en MyAnimeList |
| `settings.notif.alertsOnly.desc` | Niets als alles goed gaat; alleen een ballon bij een fout of een te controleren aflevering |
| `settings.notif.alertsAlways` | Een fout of een te controleren serie verschijnt altijd, welke stijl je ook kiest. |
| `settings.delay.title` | Extra vertraging |
| `settings.airing.enableFirst` | Zet de meldingen aan om op nieuwe afleveringen te controleren |

## 2026-10-17 · Settings › My data, AniList ↔ MAL differences, Help & about (Preact)

Texts of the redesigned My data page (one « Import a watch history » card, Backup card, « Compare » row opening the AniList ↔ MyAnimeList differences page, which moved there from the popup's Activity screen) and Help & about page (diagnostic report row, error log that unfolds, About card with What's new / Privacy / Source code links). New: `settings.import.title`, `settings.section.compare`, `settings.compare.title`, `settings.compare.help`, `settings.data.perSeries`, `compare.align`, `compare.bulk.help`, `compare.job.background`, `settings.help.diagnostic`, `settings.help.diagnosticHelp`, `settings.help.journalNote`, `settings.about.whatsNew`, `settings.about.privacy`. Changed: `settings.crImport.help`, `settings.backup.help`, `settings.backup.import`, `settings.help.copy`, `settings.about.source` (import help in two sentences, backup help « in one file », « Import » without ellipsis, « Copy the report » next to the new « Diagnostic report » title, « Source code » with « GitHub » on the right). `help.issue.body` keeps its text; only its last-line path changed, to nav.settings › settings.cat.help › settings.help.copy of this catalog. The compare.* texts are unchanged: their context notes now point to Settings › My data. Removed: `settings.section.import`, `settings.backup.crImportTitle`, `settings.crImport.openAria`, `settings.help.text`, `settings.help.copyTitle`, `settings.help.clearHelp`, `settings.help.reportTitle`. The version line reuses `settings.summary.version`, the « Clear » button `settings.matchDiag.clear`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.import.title` | Haal in wat je al hebt gekeken |
| `settings.crImport.help` | Crunchyroll, ADN of Netflix. Je ziet eerst een voorbeeld voordat er iets wordt opgeslagen. |
| `settings.backup.help` | Instellingen, koppelingen, uitgesloten series en geschiedenis in één bestand. Nooit je inloggegevens voor AniList of MyAnimeList. |
| `settings.backup.import` | Importeren |
| `settings.section.compare` | Vergelijken |
| `settings.compare.title` | Verschillen AniList ↔ MyAnimeList |
| `settings.compare.help` | Vergelijkt je twee lijsten en stemt ze af in de richting die jij kiest |
| `settings.data.perSeries` | Koppelingen en uitgesloten series beheer je in {path}. |
| `compare.align` | Afstemmen |
| `compare.bulk.help` | ‘{action}’ neemt AniList over op MyAnimeList; eerst toont een bevestiging de wijzigingen. |
| `compare.job.background` | Gaat door, ook als je deze pagina sluit. |
| `settings.help.diagnostic` | Diagnoserapport |
| `settings.help.diagnosticHelp` | Om in een foutmelding te plakken: versie, browser, instellingen, recente fouten. Geen tokens, geen accounts. |
| `settings.help.copy` | Rapport kopiëren |
| `settings.help.journalNote` | Hooguit de laatste 50, nieuwste eerst; tokens al afgeschermd. |
| `settings.about.whatsNew` | Nieuw |
| `settings.about.privacy` | Privacy |
| `settings.about.source` | Broncode |

## 2026-10-17 · Popup « My series » row menu (Preact)

The row « … » menu of the popup's « My series » list and of the « Continue » card now groups the entry links and the platform searches in two sub-menus. New: `watching.menu.openEntry` (sub-menu entry, its items are the bare AniList / MyAnimeList names; wording taken from `page.openOn` without « on {service} »), `watching.menu.searchOn` (sub-menu entry, its items are the bare platform names; wording taken from `watching.searchOn`, ending with « … »). Changed: `settings.entry.help`, which now also says that « Default entry page » picks the list shown in « My series » (quoted with the exact `watching.mySeries` of this catalog). The « −1 episode » item left the menu (the row has its own −), `watching.minusOne` stays for the « On this page » card. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `watching.menu.openEntry` | Pagina openen |
| `watching.menu.searchOn` | Zoeken op… |
| `settings.entry.help` | Bij een klik op de titel of cover van een anime; bepaalt ook de lijst in ‘Mijn series’ |



## 2026-10-17 · Popup « On this page » card (Preact)

The popup's « On this page » card was redesigned: the Hold / Drop / Done row and the AniList / MAL links moved to the card's « … » menu (shared with « My series »), and the season dropdown, the star rating and the comment moved to a foldable « Details » section. New: `page.currentStatus` (grey mention at the end of the menu item of the series' current status), `page.details` (foldable button listing what the section holds, same nouns as `page.seasonPicker`, the rating words of `rating.*` and `notes.title`), `page.seasonOnAniList` (title above the season dropdown), `page.seasonHelp` (help under it on an episode page; the match word is the one of `settings.section.mappings`), `page.yourRating` (title above the stars). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `page.currentStatus` | Huidige status |
| `page.details` | Details: seizoen, score, notitie |
| `page.seasonOnAniList` | Seizoen op AniList |
| `page.seasonHelp` | Een ander seizoen kiezen corrigeert de koppeling voor de volgende afleveringen. |
| `page.yourRating` | Jouw score |


## 2026-10-17 · Popup « Activity » tab (Preact)

The popup's Activity tab was redesigned: failed and pending syncs are now two sections, and every section heading is an uppercase label followed by « · {count} » added by the code. New: `queue.failedHeading` (same failure word as `queue.failed`), `queue.pendingHeading` (syncs waiting for a retry, wording of the former `queue.sectionTitle`), `ratings.heading` (the former `ratings.sectionTitle` without its count). The « To check » heading now reuses `inline.toCheck`. Removed: `queue.section`, `queue.sectionTitle`, `ratings.section`, `ratings.sectionTitle`, `review.title`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `queue.failedHeading` | Mislukt |
| `queue.pendingHeading` | Wachtend |
| `ratings.heading` | Te beoordelen |


## 2026-10-17 · Side panel « Now playing » (Preact)

The side panel's « Now playing » tab was redesigned as cards: « You're watching » (live playback: bar, credits marker, countdown, sync state with an icon), « Your list » (status chip, « Progress » and the stepper, one line per account, the series « … » menu shared with the popup: Hold / Drop / Done moved there), then foldable sections « Rating and comment », Synopsis, related entries and Discussions. New: `panel.nowPlaying.watching` (heading of the live card, addresses the user), `panel.nowPlaying.list` (heading of the list card, same « your list » words as `page.notInList`), `panel.nowPlaying.ratingNotes` (section title, same nouns as `page.yourRating` and `notes.title`), `panel.live.creditsAt` and `panel.live.creditsUnknown` (legend of the yellow marker under the bar, credits word of `settings.trigger.credits`), `panel.live.countdownCredits` and `panel.live.countdownRatio` (countdown line, wording of the former `panel.live.countdown` plus what the sync waits for, as in `settings.trigger.credits` / `settings.summary.percentage`). Changed: `panel.live.synced` lost its trailing « ✓ » (a check icon now precedes it). The « Progress » label reuses `compare.filter.progress`. Removed: `page.action.COMPLETED`, `page.action.DROPPED`, `page.action.PAUSED` (the status button row is gone), `panel.live.countdown`, `panel.nowPlaying.progress`, `watching.nextWatched`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `panel.nowPlaying.watching` | Je kijkt |
| `panel.nowPlaying.list` | Je lijst |
| `panel.nowPlaying.ratingNotes` | Score en notitie |
| `panel.live.creditsAt` | Aftiteling op {time} |
| `panel.live.creditsUnknown` | Aftiteling onbekend · sync bij {percent}% |
| `panel.live.countdownCredits` | Sync over {time} · bij het begin van de aftiteling |
| `panel.live.countdownRatio` | Sync over {time} · bij {percent}% van de aflevering |
| `panel.live.synced` | Gesynchroniseerd |


## 2026-10-17 · Side panel Schedule (Preact) and week picker

The Schedule tab of the side panel was redesigned: days in order with « No episode » on empty days, episode lines « 18:00 Crunchyroll · Japan 17:00 » (the platform time first, the Japanese broadcast last and cut first), a « ⋯ » menu with « Adjust time » (its second line gives the time and whether the delay is the series' own or the default), « Open the entry › » and « Search on… › », and a week button that opens a month calendar. New: `agenda.adjust.custom` and `agenda.adjust.default` (second line of « Adjust time », lower case after « · »), `agenda.adjust.platform` (first sentence of `agenda.estimate.title`, shown in the delay editor), `agenda.picker.label`, `agenda.picker.prevMonth`, `agenda.picker.nextMonth`, `agenda.picker.thisWeek`, `agenda.picker.hint` (month calendar; the hint names the arrow keys and the Enter key). Changed: `agenda.jp` writes the country name instead of « JP » (unchanged where it already did: ja, ko, zh-CN, zh-TW). Removed: `watching.searchOn` (the search entries are now the platform names of the « Search on… › » sub-menu). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `agenda.jp` | Japan {time} |
| `agenda.adjust.custom` | ingesteld voor deze serie |
| `agenda.adjust.default` | standaardvertraging |
| `agenda.adjust.platform` | Geschatte tijd op {platform}: Japanse uitzending {offset}. |
| `agenda.picker.label` | Kies een week |
| `agenda.picker.prevMonth` | Vorige maand |
| `agenda.picker.nextMonth` | Volgende maand |
| `agenda.picker.thisWeek` | Deze week |
| `agenda.picker.hint` | ↑ ↓ om van week te wisselen, Enter om die te tonen. |

## 2026-10-18 · History import page, steps 1 to 3 (Preact)

The history import page (steps 1 to 3) was redesigned: a 5-step indicator under the title (Platform, Reading, Analysis, Preview, Import), one tile per platform with the state of its tab (ready, no tab open, waiting for the tab, access to grant), the rules in a « How it works » card (its title reuses `onboarding.howItWorks`), and the Netflix reading card listing its three steps (done with a check, current with a bar, next ones greyed). New: `crImport.steps` (screen readers only), `crImport.step.*` (one word each: the five steps share one line at 576 px), `crImport.tile.*` (status line of a tile, no platform name), `crImport.netflix.heading`, `crImport.netflix.rowsDone` (step done: same wording as `crImport.netflix.rows` without the ellipsis), `crImport.netflix.titlesNext` and `crImport.netflix.showsNext` (steps not started yet: same wording as `crImport.netflix.titles` / `.shows` without the counts). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.steps` | Stappen |
| `crImport.step.platform` | Platform |
| `crImport.step.reading` | Lezen |
| `crImport.step.analysis` | Analyse |
| `crImport.step.preview` | Voorbeeld |
| `crImport.step.import` | Import |
| `crImport.tile.ready` | Tabblad klaar |
| `crImport.tile.none` | Geen tabblad open |
| `crImport.tile.access` | Toegang nodig |
| `crImport.tile.waiting` | Wachten op het tabblad… |
| `crImport.netflix.heading` | Je Netflix-geschiedenis lezen |
| `crImport.netflix.rowsDone` | Netflix-geschiedenis geladen: {rows} regels |
| `crImport.netflix.titlesNext` | Anime zoeken op AniList |
| `crImport.netflix.showsNext` | Je Netflix-voortgang lezen (behouden series) |

## 2026-10-18 · History import page, steps 4 and 5, and Backup page (Preact)

Steps 4 and 5 of the history import page and the Backup page were redesigned. The preview summary is now a row of tiles, each with its number above a label: `crImport.summary.*` are those labels without the number (they replace `crImport.preview.toUpdate`, `.review`, `.upToDate`, `.excluded`, `.ignored` and `.failed`, removed; same wording without `{count}`). The « Update N series » button has a muted hint on its left (`crImport.preview.hint.*`: a line left unchecked, none checked, locked during the import, what stays checked after a stopped or failed import). Each « To check » season shows the entry its check card will propose (`crImport.review.proposed`, a small badge) and the other entries to choose from (`crImport.review.alternatives`, `{titles}` = a localized list). The Backup page's Export card lists what the file contains and never contains (`import.included`, `import.neverIncluded`, `import.includes.*`, reusing the words of `import.summary.*` and `import.intro`); the Import card titles the file table (`import.fileContents`) and shows the export date under the file name (`import.exportedAt`, replaces `import.exportedOn`, removed: same text without the leading ` · `). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.summary.toUpdate_one` | serie bij te werken |
| `crImport.summary.toUpdate_other` | series bij te werken |
| `crImport.summary.review_one` | te controleren |
| `crImport.summary.review_other` | te controleren |
| `crImport.summary.upToDate_one` | al bijgewerkt |
| `crImport.summary.upToDate_other` | al bijgewerkt |
| `crImport.summary.excluded_one` | uitgesloten |
| `crImport.summary.excluded_other` | uitgesloten |
| `crImport.summary.ignored_one` | titel overgeslagen (geen anime) |
| `crImport.summary.ignored_other` | titels overgeslagen (geen anime) |
| `crImport.summary.failed_one` | niet gevonden (fout) |
| `crImport.summary.failed_other` | niet gevonden (fout) |
| `crImport.preview.hint.unchecked` | Een niet-aangevinkte regel wordt niet geschreven. |
| `crImport.preview.hint.none` | Vink minstens één serie aan. |
| `crImport.preview.hint.locked` | Vakjes en knoppen zijn vergrendeld tot de import klaar is. |
| `crImport.preview.hint.stopped` | Series die nog niet geschreven zijn, blijven aangevinkt. |
| `crImport.preview.hint.failed` | Mislukte series blijven aangevinkt. |
| `crImport.review.proposed` | voorgesteld |
| `crImport.review.alternatives` | Ook te kiezen: {titles} |
| `import.included` | Inbegrepen |
| `import.neverIncluded` | Nooit inbegrepen |
| `import.includes.settings` | Instellingen |
| `import.includes.matches` | Koppelingen en uitgesloten series |
| `import.includes.history` | Geschiedenis: recente syncs, afleveringen te controleren, series te beoordelen, afgewezen herkijkvoorstellen |
| `import.includes.signIns` | Je inloggegevens voor AniList / MyAnimeList |
| `import.fileContents` | Inhoud van het bestand |
| `import.exportedAt` | geëxporteerd op {date} (v{version}) |
