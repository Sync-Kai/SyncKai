# Italian (`it`) review log

Independent native review of `src/i18n/locales/it.json` (934 keys) and `public/_locales/it/messages.json`, 2026-10-14. Inputs: `docs/i18n/GLOSSARY.md`, `docs/i18n/glossary/it.md`, `docs/i18n/context.json`, `en.json`, `fr.json`, `de.json`.

Method: terminology audit (concordance of every core term across the catalog), key-by-key reading of all 934 keys with their context notes (meaning, grammar, register, placeholders, composed texts, cross-references, lengths, plurals for 0, 1, 2, 3, 5, 11, 21, 22, 25, 101), typography scan (apostrophes, quotes, ellipsis, colon spacing), an audit of every "scheda" (entry vs browser tab) and of every preposition or article placed before a placeholder. External names re-checked: Firefox "Gestisci scorciatoie da tastiera" (mozilla-l10n `aboutAddons.ftl`), Netflix "Attività di visione contenuti" and "Mostra altri" (help.netflix.com/it/node/101917).

Result: 28 keys changed in `it.json`, `messages.json` unchanged (`extDescription` 86 characters, both command texts identical to `settings.shortcuts.episode` / `settings.shortcuts.panel`). `npm run i18n:check -- it`: 0 errors.

## Changes

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `crImport.review.help` | Abbinamento incerto: non viene scritto nulla. Crea delle verifiche per scegliere la scheda nel popup (Attività). | Abbinamento incerto: non viene scritto nulla. Crea delle verifiche per scegliere la scheda AniList giusta nel popup (Attività). | terminology | "scegliere la scheda nel popup (Attività)" read as "pick the Activity tab in the popup"; the entry must be named as an AniList entry |
| `crImport.review.created_one` | {count} verifica creata: scegli la scheda nel popup (Attività). | {count} verifica creata: scegli la scheda AniList giusta nel popup (Attività). | terminology | Same tab/entry ambiguity |
| `crImport.review.created_other` | {count} verifiche create: scegli le schede nel popup (Attività). | {count} verifiche create: scegli le schede AniList giuste nel popup (Attività). | terminology | Same tab/entry ambiguity |
| `feedback.review.message` | {reason}. Clicca sull’icona di SyncKai per scegliere la scheda. | {reason}. Clicca sull’icona di SyncKai per scegliere la scheda AniList giusta. | terminology | Toast on the streaming page, among browser tabs: "scegliere la scheda" could mean choosing a tab |
| `panel.live.reviewHint` | Clicca sull’icona di SyncKai per scegliere la scheda. | Clicca sull’icona di SyncKai per scegliere la scheda AniList giusta. | terminology | Side panel with its own tabs (In riproduzione / Calendario): same ambiguity |
| `panel.nowPlaying.notFoundHint` | Per scegliere la scheda, finisci l’episodio: SyncKai te lo chiederà nel popup (“Da verificare”). | Per scegliere la scheda AniList giusta, finisci l’episodio: SyncKai te lo chiederà nel popup (“Da verificare”). | terminology | Same ambiguity, inside the panel's "In riproduzione" tab |
| `match.specialSeason` | Episodio speciale / OVA: scegli la scheda | Episodio speciale / OVA: scheda AniList da scegliere | terminology | Reason line also shown in toasts ("{reason}. Clicca…"): entry made explicit; reads as a reason, like FR « fiche à choisir » |
| `page.loading` | Caricamento della scheda: {title} | Caricamento della scheda AniList: {title} | terminology | Screen readers heard "loading the tab: Frieren" |
| `panel.nowPlaying.loading` | Caricamento della scheda… | Caricamento della scheda AniList… | terminology | Same, in the side panel (aria-label only, so the length warning is harmless) |
| `settings.entry.label` | Scheda predefinita | Scheda anime predefinita | terminology | "Scheda predefinita" reads as "default tab" (the panel settings have "Scheda all’apertura"); 24 characters, within the limit |
| `api.notAuthenticated` | Non hai effettuato l’accesso a {service}. | Non hai effettuato l’accesso con {service}. | grammar | "a AniList" needs the euphonic "ad", impossible before a placeholder that can also be MyAnimeList; "accedere con" is the usual Italian construction |
| `api.rateLimited` | Troppe richieste a {service}. Riprova tra un minuto. | Troppe richieste verso {service}. Riprova tra un minuto. | grammar | Same "a AniList" problem |
| `compare.bulk.empty` | Nessuna serie da allineare a {source} | Nessuna serie da allineare con {source} | grammar | Same "a AniList" problem; "allineare con" is standard |
| `compare.impact.question_one` | Allineare {count} serie a {source}? Su {target}: | Allineare {count} serie con {source}? Su {target}: | grammar | Same "a AniList" problem |
| `compare.impact.question_other` | Allineare {count} serie a {source}? Su {target}: | Allineare {count} serie con {source}? Su {target}: | grammar | Same "a AniList" problem |
| `compare.impact.created_one` | {count} serie verrà aggiunta a {target} | {count} serie verrà aggiunta su {target} | grammar | Same "a AniList" problem; "su" matches the "Su {target}:" heading above the bullet |
| `compare.impact.created_other` | {count} serie verranno aggiunte a {target} | {count} serie verranno aggiunte su {target} | grammar | Same |
| `crImport.connect.access` | SyncKai non ha più accesso a {platform}: autorizzalo per leggere la tua cronologia. | SyncKai non ha più accesso al sito di {platform}: autorizzalo per leggere la tua cronologia. | grammar | {platform} = ADN gives "a ADN" (needs "ad"); the permission is indeed for the site |
| `crImport.read.starting` | Connessione a {platform}… | Connessione alla scheda {platform}… | grammar | "a ADN" again; the note says SyncKai connects to the platform tab, now stated |
| `crImport.reason.numbering` | Posizione dell’episodio nella sua stagione sconosciuta (stagione rimossa dal catalogo?) | Posizione sconosciuta dell’episodio nella sua stagione (stagione rimossa dal catalogo?) | grammar | "stagione sconosciuta" attached the adjective to the season ("its unknown season") instead of the position |
| `compare.job.retryFailed` | Riprova le fallite | Riprova gli errori | meaning | "le (serie) fallite" means "the flop series"; "gli errori" echoes the banner count "· 1 errore", 18 characters |
| `onboarding.hint.anilist` | Consigliato per gli abbinamenti | Consigliato per riconoscere gli anime | meaning | On the welcome screen "abbinamenti" is unknown jargon (everyday sense: food or outfit pairings); the note means identifying the anime |
| `settings.crImport.help` | Crunchyroll, ADN o Netflix: recupera la tua cronologia, con anteprima prima dell’invio | Crunchyroll, ADN o Netflix: metti in pari le liste con la tua cronologia (anteprima prima dell’invio) | meaning | "recupera la tua cronologia" reads as "retrieve your history"; the English means bringing the lists up to date ("catch up") |
| `airing.unknownError` | Errore sconosciuto | causa sconosciuta | style | Only inserted after "errore: " (`airing.status.failed`): the status line read "errore: Errore sconosciuto" |
| `crImport.read.error.unavailable` | Importazione non disponibile: {platform} ha modificato il suo sito. La sincronizzazione durante la visione non è interessata. | Importazione non disponibile: {platform} ha modificato il suo sito. La sincronizzazione durante la visione non ne risente. | style | "non è interessata" is bureaucratic (and ambiguous: "not interested"); "non ne risente" is the natural phrasing |
| `settings.shortcuts.help` | Un tasto che hai cambiato viene mantenuto con gli aggiornamenti. Se un tasto manca … | Un tasto che hai cambiato viene mantenuto anche dopo gli aggiornamenti. Se un tasto manca … | style | "mantenuto con gli aggiornamenti" is unidiomatic (rest of the sentence unchanged) |
| `settings.notif.discreet.desc` | Piccolo avviso per 3 s in un angolo. Nulla a schermo intero: l’icona dell’estensione mostra una spunta. | Piccolo messaggio per 3 s in un angolo. Nulla a schermo intero: l’icona dell’estensione mostra una spunta. | consistency | "avviso" is the release-alert term, shown next to this level in the summary ("Discrete · avvisi puntuali") |
| `match.singleLaterSeason` | Stagione {season} ma una sola scheda AniList trovata | Stagione {season}, ma una sola scheda AniList trovata | typography | Comma before the adversative "ma" |

Changes per category: terminology 10, grammar 10, meaning 3, style 3, consistency 1, typography 1 (total 28).

Term sheet (`docs/i18n/glossary/it.md`) updated: entry/tab disambiguation rule ("scheda AniList", "scheda anime"), prepositions before placeholders ("con / verso / su / al sito di / alla scheda", never "a {service}"), small pill = "piccolo messaggio", onboarding "riconoscere gli anime", "Riprova gli errori", `airing.unknownError` = "causa sconosciuta", AnimeClick's "In visione" noted as a known alternative to "In corso", Firefox and Netflix names re-checked.

## Debatable, left unchanged

| Key(s) | Current text | Why it was kept |
|---|---|---|
| `nav.watching`, `page.status.CURRENT` (+ "In corso" in 10 other keys) | In corso | AnimeClick, the main Italian tracker, calls this list "In visione"; "In corso" can also suggest "still airing" ("serie in corso"). Kept: the term sheet's choice, consistent everywhere, and airing has its own words ("In onda", "Conclusa"). A native human reviewer should confirm |
| `crImport.title`, `crImport.pageTitle`, `settings.backup.crImport` | Importa una cronologia | Slight calque of FR « Importer un historique »; "Importa la cronologia di visione" is more idiomatic but 32 characters (h1 limit 30). Grammatical and clear with the platform buttons and the subtitle |
| `agenda.stale` | Calendario salvato in precedenza · {error} | "shown" is implicit ("previously saved schedule"); the alternatives ("Stai vedendo il calendario salvato") are longer for an 11 px line |
| `common.syncing`, `panel.live.syncing` | Sincronizzazione… | 17 characters for a ~12-character button; FR (16) and DE (15) are about as long, so the layout already copes. "Sync in corso…" would break the term sheet (full noun on busy labels). Worth a look in the popup's "Da verificare" card while confirming |
| `settings.autoSync.label` | Sincronizzazione automatica | 27 characters for a 25 limit; toggle rows wrap, the German is 29 |
| `panel.tab.nowPlaying` | In riproduzione | 15 characters for a 12 limit; standard Italian "now playing" (Spotify, YouTube Music); the 11 px segmented control in Settings has room for it |
| `compare.bulk.filtered.anilist` | Allinea filtro ad AniList | 25 characters for a 24 limit, no shorter natural wording |
| `compare.filter.missingAniList` | Assenti su AniList | 18 characters for a 16 limit (FR is 18 too) |
| `match.beyondSeason`, `match.beyondAniList`, `sync.beyondEntry` | … supera i {total} episodi … | Reads oddly when {total} is 1 ("supera i 1 episodi"); same limitation in EN/FR/DE, rare case |
| `feedback.service.error` | errore: {message} | Gives "errore: Errore imprevisto." when the message is `error.unexpected`; kept as the term-sheet convention for per-service results (rare case) |
| `page.action.PAUSED` | Pausa | A noun next to the imperatives "Abbandona" / "Completa"; "Metti in pausa" exceeds the 10-character limit and the tooltip carries it |
| `airing.status.notified_*` | {count} episodi notificati | "segnalati" would be slightly more natural, "notificati" ties the count to the browser notifications |
| `compare.pause.budget`, `compare.pause.budgetUnknown` | In attesa della quota AniList… | "quota" (API quota) is technical Italian; same choice as FR/DE |
| `crImport.read.lookups` | Verifica della numerazione degli episodi: stagioni {done} / {total} | "verifica" in its general sense, while a check card is also "verifica"; unambiguous in this progress line |
| `review.format.tvShort` | TV breve | AniList's "TV Short" has no settled Italian name; understandable |
| `settings.panel.live.help` | Posizione di riproduzione e conto alla rovescia della sincronizzazione nella scheda “In riproduzione” | Twice the English length, but a wrapping help text |
| `crImport.netflix.*`, `crImport.read.error.netflixLoggedOut` | “Mostra altri”, Attività di visione contenuti | Match the Italian Netflix Help Center; not checked on the live Italian netflix.com page |
| `page.status.COMPLETED` vs `crImport.skipReason.completed` | Completato / completata | Intended: the status name agrees with "stato", the fragments agree with "serie" (term sheet) |

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | Inverno / Primavera / Estate / Autunno | Inverno {year} / Primavera {year} / Estate {year} / Autunno {year} | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |
| `sync.noServiceFollows` | Nessun servizio collegato segue questa serie. | Nessun servizio collegato ha una scheda per questa serie. | Meaning: shown when no connected service has an entry for the anime (no AniList / MyAnimeList ID), not when none “tracks” it; English, French and German fixed the same way. Term sheet: entry = *scheda* |

Code fixes that change how this catalog is displayed:

- Netflix history import: the “Mostra altri” button of a Netflix profile in this language is recognized (label checked by the reviewer on Netflix’s help article 101917 in this language): such an import no longer stops after the first rows as if the history were complete.
- The signed delays of the Schedule tooltips (`agenda.estimate.*`) now use `time.countdown.*`: “+1 h 30 min”.
- Lists of names in `{services}` and `{titles}` use the language’s own conjunction (`Intl.ListFormat`) instead of “, ”.

Layout (`npm run test:i18n-layout`), fixed in the components without changing the text: `page.action.DROPPED`, `page.action.COMPLETED` (side panel at 320 px): the icons are hidden when the side panel is narrow.

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). The singular `_one` names the entry's only episode.

| Key | Text |
|---|---|
| `sync.beyondEntry_one` | L’episodio {progress} supera l’unico episodio della scheda |
| `sync.beyondEntry_other` | L’episodio {progress} supera i {count} episodi della scheda |

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | Il pulsante “Mostra altri” non è stato riconosciuto nella lingua del tuo profilo Netflix: sono stati letti solo gli episodi più recenti. Imposta quel profilo nella stessa lingua di SyncKai su Netflix, poi leggi di nuovo la cronologia. |

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video (solo anime) |
| `settings.prime.label` | Sincronizza su Prime Video |
| `settings.prime.helpOff` | Vengono sincronizzati solo gli anime (genere anime, o animazione con audio giapponese o con il titolo esatto di AniList). Il browser chiederà l’accesso a primevideo.com |
| `settings.prime.helpOn` | SyncKai legge solo ciò che la pagina di Prime Video riceve già. In una scheda Prime Video già aperta, il monitoraggio inizia dall’episodio successivo |
| `settings.prime.denied` | Accesso a primevideo.com negato: Prime Video resta disattivato |
| `settings.prime.disabled` | Prime Video disattivato: ricarica le schede Prime Video aperte per fermarlo del tutto |
| `settings.prime.error` | Impossibile modificare l’accesso a Prime Video, riprova |

| Key | Text |
|---|---|
| `onboarding.intro` | Guarda i tuoi anime su Crunchyroll o ADN (Netflix, Disney+ e Prime Video facoltativi): SyncKai aggiorna la tua lista alla fine di ogni episodio. |
| `watching.tip` | Netflix, Disney+, Prime Video (facoltativi) e il tuo lettore preferito si impostano in {path}. |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | Corrisponde alla piattaforma: {signals} |
| `match.signalsContradict` | Non corrisponde alla piattaforma: {signals} |
| `match.yearRemake` | Remake distinto dall’anno di uscita ({year}) |
| `match.signal.year` | anno di uscita |
| `match.signal.episodes` | numero di episodi |
| `match.signal.duration` | durata degli episodi |
| `match.signal.format` | formato (film o serie) |
| `match.signal.country` | paese d’origine |
| `match.signal.originalTitle` | titolo originale |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | L’abbinamento memorizzato non corrisponde alla piattaforma: {signals} |

## 2026-10-14 · Matching diagnostic (development builds only)

New keys `settings.matchDiag.*` (Settings › Help & about, section shown only in development builds, never in the published extension): the last 50 AniList matching decisions, a « Copy » button per row (one decision as JSON, for the test corpus) and a « Clear » button. `{count}` follows a label and a colon (no plural form); `JSON` is a format name. Terms from this language's term sheet (match, entry). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.title` | Diagnostica degli abbinamenti |
| `settings.matchDiag.text` | Solo nelle build di sviluppo: le ultime 50 decisioni di abbinamento con AniList, dalla più recente, conservate fino alla chiusura del browser. Copiane una in JSON per aggiungerla al corpus di test. |
| `settings.matchDiag.empty` | Ancora nessuna decisione registrata |
| `settings.matchDiag.copy` | Copia |
| `settings.matchDiag.copyTitle` | Copia questa decisione in JSON |
| `settings.matchDiag.copied` | Copiata |
| `settings.matchDiag.copyFailed` | Impossibile copiare la decisione. |
| `settings.matchDiag.clear` | Svuota |
| `settings.matchDiag.candidates` | Candidati: {count} |
| `settings.matchDiag.noEntry` | Nessuna scheda |

## 2026-10-15 · Debug trace (development builds only)

New keys `settings.debugTrace.*` (Settings › Help & about, section shown only in development builds, never in the published extension, below the matching diagnostic): a timeline of what the extension did (pages, service worker, AniList and MyAnimeList requests), a verbose switch, a category filter (category names stay in English: technical identifiers), « Copy trace » (the whole trace as JSON) and the « Clear » button of the matching diagnostic (`settings.matchDiag.clear`, reused). `{count}` and `{max}` follow a label and a colon (no plural form) and arrive formatted for the language; `JSON` is a format name; `service worker` kept as the browser's technical term. New terms added to this language's term sheet (debug trace, event, verbose mode); other terms from it (account). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.debugTrace.title` | Traccia di debug |
| `settings.debugTrace.text` | Solo nelle build di sviluppo: la cronologia di ciò che SyncKai ha fatto sulle pagine, nel service worker e con AniList e MyAnimeList, dalla più recente, conservata fino alla chiusura del browser. Non viene registrato nessun token, cookie o ID account. Copia l’intera traccia in JSON per condividerla quando segnali un problema. |
| `settings.debugTrace.empty` | Ancora nessun evento registrato |
| `settings.debugTrace.copy` | Copia traccia |
| `settings.debugTrace.copied` | Copiata |
| `settings.debugTrace.copyFailed` | Impossibile copiare la traccia. |
| `settings.debugTrace.verbose` | Modalità dettagliata (tutte le righe del registro) |
| `settings.debugTrace.count` | Eventi: {count} / {max} |
| `settings.debugTrace.allCategories` | Tutte le categorie |
| `settings.debugTrace.filterAria` | Filtra gli eventi per categoria |

## 2026-10-16 · Matching diagnostic: Copy all (development builds only)

New keys in the « Matching diagnostic » section (Settings › Help & about, development builds only, never in the published extension, now collapsed by default behind its title): « Copy all » copies every recorded decision as one JSON array, next to « Clear »; its label becomes « Copied » (`settings.matchDiag.copied`, reused) and a failure reuses `settings.matchDiag.copyFailed`. `JSON` is a format name. Same word for « decision » as `settings.matchDiag.copyTitle`, in the plural; other terms from this language's term sheet. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.copyAll` | Copia tutto |
| `settings.matchDiag.copyAllTitle` | Copia tutte le decisioni in JSON |

## 2026-10-16 · Episode guards (« To check » reasons)

New reasons on a « To check » card (`fix/episode-guards`, audit SEC-01): a sync that would jump straight to the last episode from far behind, and episodes reported as finished in a burst, now wait for the user instead of being written. Same « to check » term as `match.otherSeriesExcluded`, same episode wording as `sync.beyondEntry_*`; `{from}` and `{progress}` are episode numbers. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `sync.review.finaleJump` | Salto diretto all’ultimo episodio ({progress}) dall’episodio {from}: da verificare |
| `sync.review.burst` | Molti episodi completati in pochi minuti: da verificare |

## 2026-10-17 · Status bar (popup and side panel)

New texts of the status bar shown at the bottom of the popup and, now, of the side panel (`feature/ui-status-bar`): a synced episode or a count of synced episodes under the series title, shown until the user hides it (« Seen, hide », a × button label), and the history import running, ready to confirm and done. Same words as this language's term sheet: « sincronizzato » (agreeing with *episodio*, masculine), « serie » (invariable, « aggiornata / aggiornate » agreeing in the feminine), « Ep. » (`agenda.episode`), « importazione » (`crImport.apply.done` « Importazione completata », `crImport.apply.running`) and « conferma » as `common.confirm`; ` · ` and ` / ` kept; `{platform}` is a brand name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `footer.dismiss` | Visto, nascondi |
| `footer.importDone_one` | Importazione completata · {count} serie aggiornata |
| `footer.importDone_other` | Importazione completata · {count} serie aggiornate |
| `footer.importProgress` | Importazione {platform} · {done} / {total} |
| `footer.importReady_one` | Importazione pronta · {count} serie da confermare |
| `footer.importReady_other` | Importazione pronta · {count} serie da confermare |
| `footer.syncedEpisode` | Ep. {episode} sincronizzato |
| `footer.syncedEpisodes_one` | {count} episodio sincronizzato |
| `footer.syncedEpisodes_other` | {count} episodi sincronizzati |

## 2026-10-17 · Account menu (status bar)

New texts of the account menu that opens above the AniList / MyAnimeList logo of the status bar (popup and side panel): the logo button's label (also when the session expired), the connection status line, three stat tiles (anime count, episodes watched, days watched, each number shown above its short label), the « Synced this week » row with its tooltip and value, and « View my profile ». Following this language's term sheet, used **account**, **collegato** (as `settings.account.connected`), **sessione scaduta**, the short noun **sync** of the term sheet for the narrow row label, **episodio**; *anime* invariable; « visti » agrees with *giorni*; « day » is **g**, as `time.countdown.days`. ` · ` kept; `{service}` is a brand name, `{name}` the user's AniList / MyAnimeList user name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `accountMenu.connected` | Collegato |
| `accountMenu.connectedAs` | {name} · collegato |
| `accountMenu.label` | Account {service} |
| `accountMenu.labelExpired` | Account {service}, sessione scaduta |
| `accountMenu.profile` | Vedi il mio profilo |
| `accountMenu.stats.anime_one` | anime |
| `accountMenu.stats.anime_other` | anime |
| `accountMenu.stats.days_one` | visto |
| `accountMenu.stats.days_other` | visti |
| `accountMenu.stats.daysValue` | {days} g |
| `accountMenu.stats.episodes_one` | episodio |
| `accountMenu.stats.episodes_other` | episodi |
| `accountMenu.week.label` | Sync questa settimana |
| `accountMenu.week.title` | Episodi sincronizzati da SyncKai questa settimana |
| `accountMenu.week.value_one` | {count} episodio |
| `accountMenu.week.value_other` | {count} episodi |

## 2026-10-17 · Settings redesign (Preact): new and changed keys

New texts of the redesigned Settings (Preact): the Platforms and Display categories, the screen-reader names of the back button and of the category card, the row summaries of the Settings home, the Keyboard section of Display, the two sections of Shortcuts, and the section titles and notes of Accounts. Changed: `settings.cat.notifications` (now the single word: the Schedule options moved to Platforms), `settings.summary.connected` (a word instead of ✓), `settings.summary.paused` (now a standalone, capitalised summary), `settings.summary.version` (a word instead of « v »), `settings.entry.help` (the « both accounts connected » condition moved to `settings.entry.unavailable`). Summaries are joined with ` · ` by the code; `settings.account.expiredHelp` and `settings.account.otherStillSynced` are joined as two sentences. The Display summary reuses `settings.section.language`, `settings.section.panel` and `settings.shortcuts.pointer`; the My data summary the history import and backup words; the player summary `settings.player.label`. Back label « Torna alla pagina {page} » and « Finché non ricolleghi {service}, … »: no « a {service} / a {page} » (rule on prepositions before placeholders). **attiva / attive** agree with *piattaforme*; player summary « lettore {player} » (*Lettore preferito*). The Display summary uses **scorciatoie** (category word) instead of « scorciatoie da tastiera » to stay within 45 characters. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.cat.notifications` | Notifiche |
| `settings.cat.platforms` | Piattaforme |
| `settings.cat.display` | Visualizzazione |
| `settings.backToAria` | Torna alla pagina {page} |
| `settings.group.categories` | Categorie |
| `settings.summary.connected` | {service} collegato |
| `settings.summary.notConnected` | {service} non collegato |
| `settings.summary.bothConnected` | AniList e MyAnimeList collegati |
| `settings.summary.auto` | Automatica |
| `settings.summary.paused` | In pausa |
| `settings.summary.platforms_one` | {count} su {total} attiva |
| `settings.summary.platforms_other` | {count} su {total} attive |
| `settings.summary.player` | lettore {player} |
| `settings.summary.display` | Lingua, pannello laterale, scorciatoie |
| `settings.summary.data` | Importa una cronologia · backup |
| `settings.summary.version` | Versione {version} |
| `settings.summary.noErrors` | nessun errore |
| `settings.display.keyboard` | Tastiera |
| `settings.display.shortcutsHelp` | Tasti per segnare un episodio o aprire il pannello |
| `settings.shortcuts.duringPlayback` | Durante la riproduzione |
| `settings.shortcuts.navigation` | Navigazione |
| `settings.accounts.lists` | Liste sincronizzate |
| `settings.accounts.both` | Con entrambi gli account |
| `settings.accounts.privacy` | Accedi sul sito di AniList o MyAnimeList: SyncKai non vede mai la tua password. |
| `settings.account.expiredHelp` | Finché non ricolleghi {service}, i tuoi episodi non vengono più inviati. |
| `settings.account.otherStillSynced` | {service} continua a essere aggiornato. |
| `settings.entry.help` | Si apre cliccando sul titolo o sulla copertina di un anime |
| `settings.entry.unavailable` | Disponibile quando AniList e MyAnimeList sono entrambi collegati. |

## 2026-10-17 · Settings › Sync, Matches and Excluded series (Preact)

New texts of the redesigned Sync settings page and of its two sub-pages (Matches, Excluded series), moved out of My data: section titles « Automatic » / « Per series », the descriptions of the two « Episode counted as watched » cards, the « Per series » rows, the Matches intro, search, empty and no-result texts, « Show N more on {platform} », the four origin badges and their legend, the Excluded series section, note, empty hint and the « {year} series · excluded on {date} » fragments. Changed: `settings.trigger.legend` (« Episode counted as watched », where the old text was only « Episode watched »), `settings.trigger.credits` (« (recommended) » moved to `settings.trigger.creditsHelp`), and the paths of `popup.syncDisabledDetail` / `review.excludeTitle` (now nav.settings › settings.section.sync › settings.section.exclusions, built from this catalog's own titles). Removed: `settings.mappings.count_*`, `settings.mappings.help`, `settings.mappings.manage`. `{action}` is the « Re-enable » button (`settings.exclusions.help`) or the « Stop syncing this series » menu item (`settings.exclusions.emptyHelp`), so the quoted labels always match. The match / entry / excluded / re-enable words reuse this catalog's existing terms (`settings.section.mappings`, `settings.mappings.entryFallback`, `settings.section.exclusions`, `settings.exclusions.reactivate`). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.section.automatic` | Automatica |
| `settings.section.perSeries` | Per serie |
| `settings.trigger.legend` | Episodio contato come visto |
| `settings.trigger.credits` | All’inizio dei titoli di coda |
| `settings.trigger.creditsHelp` | Consigliato: il momento esatto indicato dalla piattaforma |
| `settings.trigger.percentageHelp` | Usata anche quando i titoli di coda non sono noti |
| `settings.sync.mappingsRow` | Abbinamenti memorizzati |
| `settings.sync.mappingsRowHelp` | La stagione AniList scelta per ogni serie |
| `settings.sync.exclusionsRowHelp` | Mai sincronizzate, riattivabili qui |
| `settings.mappings.intro_one` | {count} serie memorizzata, per piattaforma: la stagione della piattaforma → la scheda AniList in cui scrive SyncKai. Se dimentichi un abbinamento, verrà ricalcolato al prossimo episodio. |
| `settings.mappings.intro_other` | {count} serie memorizzate, per piattaforma: la stagione della piattaforma → la scheda AniList in cui scrive SyncKai. Se dimentichi un abbinamento, verrà ricalcolato al prossimo episodio. |
| `settings.mappings.search` | Cerca una serie o una scheda |
| `settings.mappings.noResult` | Nessun abbinamento per “{query}” |
| `settings.mappings.noResultHelp` | Cerca per titolo della serie o della scheda AniList. |
| `settings.mappings.emptyHelp` | SyncKai ne memorizza uno per ogni stagione sincronizzata. |
| `settings.mappings.showMore_one` | Mostra {count} altro su {platform} |
| `settings.mappings.showMore_other` | Mostra altri {count} su {platform} |
| `settings.mappings.origin.chosen` | Scelto da te |
| `settings.mappings.origin.learned` | Appreso |
| `settings.mappings.origin.unmarked` | Vecchio |
| `settings.mappings.origin.unverified` | Importato · da ricontrollare |
| `settings.mappings.origin.chosenHelp` | Confermato o scelto da te: mai rimesso in discussione. |
| `settings.mappings.origin.learnedHelp` | Trovato da SyncKai: ricalcolato se la piattaforma lo contraddice. |
| `settings.mappings.origin.unmarkedHelp` | Salvato prima della 2.4: mantenuto, da controllare se contraddetto. |
| `settings.mappings.origin.unverifiedHelp` | Da un backup: ricontrollato al primo utilizzo. |
| `settings.mappings.originLegend` | Origine degli abbinamenti |
| `settings.exclusions.section` | Mai sincronizzate |
| `settings.exclusions.help` | Una serie esclusa non viene più sincronizzata, in nessuna stagione. “{action}” la fa seguire di nuovo dal prossimo episodio. |
| `settings.exclusions.emptyHelp` | Per non sincronizzare più una serie, scegli “{action}” nel suo menu “⋯”. |
| `settings.exclusions.seriesYear` | serie del {year} |
| `settings.exclusions.excludedOn` | esclusa il {date} |
| `popup.syncDisabledDetail` | Riattivabile in Impostazioni › Sincronizzazione › Serie escluse |
| `review.excludeTitle` | Esclude la serie (tutte le stagioni): riattivabile in Impostazioni › Sincronizzazione › Serie escluse |

## 2026-10-17 · Settings › Platforms and Notifications (Preact)

Texts of the redesigned Platforms page (list of sites with « Included » / « Access missing » or a switch, preferred player dropdown, estimated release time per platform with − / + buttons, moved there from the Schedule card) and Notifications page (« On the playback page » style cards and « New episodes »). New: `settings.platforms.where`, `settings.platforms.allAnime`, `settings.platforms.included`, `settings.platforms.accessMissing`, `settings.platforms.note`, `settings.player.openOn`, `settings.player.enableFirst`, `settings.offsets.earlier`, `settings.offsets.later`, `settings.notif.legend`. Changed: `settings.player.help`, `settings.offsets.title`, `settings.offsets.help`, `page.platformOff`, `settings.section.notifications`, `settings.notif.discreet.desc`, `settings.notif.detailed.desc`, `settings.notif.alertsOnly.desc`, `settings.notif.alertsAlways`, `settings.delay.title`, `settings.airing.enableFirst` (the notification descriptions now describe the pill and the bubble, « Extra delay » replaces « Delay », the release-time help says the alerts use it too, « Turn on alerts… » is now visible text). `page.platformOff` keeps its sentence; only the path changed, from « Settings › Playback & sync » to nav.settings › settings.cat.platforms of this catalog. Removed: `settings.section.playback`, `settings.netflix.section`, `settings.netflix.label`, `settings.disney.section`, `settings.disney.label`, `settings.prime.section`, `settings.prime.label`, `settings.airing.label`, `settings.airing.help`, `settings.section.agenda`. The Schedule word, « Open », the release-alert name and the minute unit reuse this catalog's `panel.tab.agenda`, `common.open`, `settings.quick.airing.label` and `settings.offsets.unit`. « Inclusa » agrees with « piattaforma »; the pill stays « piccolo messaggio » and the bubble « riquadro » (term sheet). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.platforms.where` | Dove SyncKai segue i tuoi episodi |
| `settings.platforms.allAnime` | Tutti gli anime |
| `settings.platforms.included` | Inclusa |
| `settings.platforms.accessMissing` | Accesso mancante |
| `settings.platforms.note` | Attivare una piattaforma richiede l’accesso al suo sito. Vengono lette solo le pagine di riproduzione e delle serie. |
| `settings.player.openOn` | Apri gli episodi su |
| `settings.player.enableFirst` | Attivala prima |
| `settings.player.help` | Usato da “Apri” quando un anime è su più piattaforme attive. |
| `settings.offsets.title` | Orario di uscita stimato |
| `settings.offsets.help` | Dopo la trasmissione giapponese. Usato dal Calendario e dagli avvisi; una serie si regola dalla sua riga nel Calendario. |
| `settings.offsets.earlier` | {minutes} min prima |
| `settings.offsets.later` | {minutes} min dopo |
| `page.platformOff` | {platform} è disattivato: qui SyncKai non segue nulla. Per riattivarlo: Impostazioni › Piattaforme. |
| `settings.section.notifications` | Nella pagina di riproduzione |
| `settings.notif.legend` | Stile delle notifiche nella pagina |
| `settings.notif.discreet.desc` | Un piccolo messaggio per qualche secondo, in un angolo del video |
| `settings.notif.detailed.desc` | Un riquadro con l’episodio e il risultato su AniList e MyAnimeList |
| `settings.notif.alertsOnly.desc` | Niente se va tutto bene; un riquadro solo per un errore o un episodio da verificare |
| `settings.notif.alertsAlways` | Un errore o una serie da verificare compare sempre, qualunque sia lo stile. |
| `settings.delay.title` | Ritardo extra |
| `settings.airing.enableFirst` | Attiva gli avvisi per controllare le uscite |

## 2026-10-17 · Settings › My data, AniList ↔ MAL differences, Help & about (Preact)

Texts of the redesigned My data page (one « Import a watch history » card, Backup card, « Compare » row opening the AniList ↔ MyAnimeList differences page, which moved there from the popup's Activity screen) and Help & about page (diagnostic report row, error log that unfolds, About card with What's new / Privacy / Source code links). New: `settings.import.title`, `settings.section.compare`, `settings.compare.title`, `settings.compare.help`, `settings.data.perSeries`, `compare.align`, `compare.bulk.help`, `compare.job.background`, `settings.help.diagnostic`, `settings.help.diagnosticHelp`, `settings.help.journalNote`, `settings.about.whatsNew`, `settings.about.privacy`. Changed: `settings.crImport.help`, `settings.backup.help`, `settings.backup.import`, `settings.help.copy`, `settings.about.source` (import help in two sentences, backup help « in one file », « Import » without ellipsis, « Copy the report » next to the new « Diagnostic report » title, « Source code » with « GitHub » on the right). `help.issue.body` keeps its text; only its last-line path changed, to nav.settings › settings.cat.help › settings.help.copy of this catalog. The compare.* texts are unchanged: their context notes now point to Settings › My data. Removed: `settings.section.import`, `settings.backup.crImportTitle`, `settings.crImport.openAria`, `settings.help.text`, `settings.help.copyTitle`, `settings.help.clearHelp`, `settings.help.reportTitle`. The version line reuses `settings.summary.version`, the « Clear » button `settings.matchDiag.clear`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.import.title` | Recupera ciò che hai già guardato |
| `settings.crImport.help` | Crunchyroll, ADN o Netflix. Vedi un’anteprima prima che venga scritto qualcosa. |
| `settings.backup.help` | Impostazioni, abbinamenti, serie escluse e cronologia in un file. Mai i tuoi accessi AniList o MyAnimeList. |
| `settings.backup.import` | Importa |
| `settings.section.compare` | Confronta |
| `settings.compare.title` | Differenze AniList ↔ MyAnimeList |
| `settings.compare.help` | Confronta le tue due liste e allineale nel verso che scegli |
| `settings.data.perSeries` | Abbinamenti e serie escluse si gestiscono in {path}. |
| `compare.align` | Allinea |
| `compare.bulk.help` | “{action}” copia AniList su MyAnimeList; prima una conferma elenca le modifiche. |
| `compare.job.background` | Continua anche se chiudi questa pagina. |
| `settings.help.diagnostic` | Report diagnostico |
| `settings.help.diagnosticHelp` | Da incollare in una segnalazione di bug: versione, browser, impostazioni, ultimi errori. Nessun token né account. |
| `settings.help.copy` | Copia il report |
| `settings.help.journalNote` | Al massimo gli ultimi 50, dal più recente; token già oscurati. |
| `settings.about.whatsNew` | Novità |
| `settings.about.privacy` | Privacy |
| `settings.about.source` | Codice sorgente |

## 2026-10-17 · Popup « My series » row menu (Preact)

The row « … » menu of the popup's « My series » list and of the « Continue » card now groups the entry links and the platform searches in two sub-menus. New: `watching.menu.openEntry` (sub-menu entry, its items are the bare AniList / MyAnimeList names; wording taken from `page.openOn` without « on {service} »), `watching.menu.searchOn` (sub-menu entry, its items are the bare platform names; wording taken from `watching.searchOn`, ending with « … »). Changed: `settings.entry.help`, which now also says that « Default entry page » picks the list shown in « My series » (quoted with the exact `watching.mySeries` of this catalog). The « −1 episode » item left the menu (the row has its own −), `watching.minusOne` stays for the « On this page » card. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `watching.menu.openEntry` | Apri la scheda |
| `watching.menu.searchOn` | Cerca su… |
| `settings.entry.help` | Si apre cliccando sul titolo o sulla copertina di un anime; sceglie anche l’elenco di “Le mie serie” |



## 2026-10-17 · Popup « On this page » card (Preact)

The popup's « On this page » card was redesigned: the Hold / Drop / Done row and the AniList / MAL links moved to the card's « … » menu (shared with « My series »), and the season dropdown, the star rating and the comment moved to a foldable « Details » section. New: `page.currentStatus` (grey mention at the end of the menu item of the series' current status), `page.details` (foldable button listing what the section holds, same nouns as `page.seasonPicker`, the rating words of `rating.*` and `notes.title`), `page.seasonOnAniList` (title above the season dropdown), `page.seasonHelp` (help under it on an episode page; the match word is the one of `settings.section.mappings`), `page.yourRating` (title above the stars). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `page.currentStatus` | Stato attuale |
| `page.details` | Dettagli: stagione, voto, commento |
| `page.seasonOnAniList` | Stagione su AniList |
| `page.seasonHelp` | Cambiare stagione corregge l’abbinamento per i prossimi episodi. |
| `page.yourRating` | Il tuo voto |


## 2026-10-17 · Popup « Activity » tab (Preact)

The popup's Activity tab was redesigned: failed and pending syncs are now two sections, and every section heading is an uppercase label followed by « · {count} » added by the code. New: `queue.failedHeading` (same failure word as `queue.failed`), `queue.pendingHeading` (syncs waiting for a retry, wording of the former `queue.sectionTitle`), `ratings.heading` (the former `ratings.sectionTitle` without its count). The « To check » heading now reuses `inline.toCheck`. Removed: `queue.section`, `queue.sectionTitle`, `ratings.section`, `ratings.sectionTitle`, `review.title`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `queue.failedHeading` | Fallite |
| `queue.pendingHeading` | In attesa |
| `ratings.heading` | Da votare |
