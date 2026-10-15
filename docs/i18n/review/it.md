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
