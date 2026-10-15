# Italian (`it`) term sheet

Binding for every change to `src/i18n/locales/it.json` and `public/_locales/it/messages.json`. Shared rules: `docs/i18n/GLOSSARY.md`.

Target: standard Italian as used by Crunchyroll Italia and big Italian apps (Chrome, Firefox, Netflix, Spotify), with the vocabulary Italian anime fans use on trackers (AnimeClick, MyAnimeList, AniList). Users are addressed with **tu**.

## 1. Core terms

| English term | Italian | Reason |
|---|---|---|
| Watching (status, tab `nav.watching`) | In corso | Usual tracker status in Italian ("serie in corso"); short enough for the tab. Never used for airing (see "Airing"). Known alternative: AnimeClick labels this list "In visione" (kept "In corso", clearer outside AnimeClick; review 2026-10-14) |
| Completed (status) | Completato | Generic status name (masculine, like "stato"). Agrees with "serie" when it describes a series: "completata" (`inline.status.COMPLETED`, `ratings.completed`) |
| On hold (status) | In pausa | Usual tracker wording |
| Dropped (status) | Abbandonato | Standard Italian; "droppato" is fan slang, too informal for the UI. "abbandonata" for a series; actions "Abbandona" / "Abbandona la serie", never "Annulla" (Cancel) |
| Plan to watch (status) | Da vedere | What fans call the plan-to-watch list ("lista da vedere") |
| Rewatching (status) | In rewatch | "Rewatch" is the established fan loanword ("fare il rewatch"); "rivisione" is rare and close to "revisione" (revision). Questions use the verb "rivedere" ("Stai rivedendo…?", "Sì, lo rivedo") |
| rewatch (noun) | rewatch (m., invariable) | "il rewatch", "rewatch rifiutati" |
| series | serie (f., invariable) | "1 serie", "3 serie"; adjectives agree in the feminine ("serie esclusa / escluse") |
| season | stagione (f.) | |
| episode / Ep. | episodio (m.) / Ep. (mid-sentence: ep.) | "Ep. 5", "12 ep."; Italian uses the same abbreviation |
| arc | arco (m., pl. archi) | "l’arco di Wano", as Italian One Piece fans say |
| list | lista (f.) | "la tua lista" = the AniList / MyAnimeList list |
| entry | scheda (f.) | The anime's page on AniList / MAL, as on AnimeClick ("scheda anime"). See "tab" below. Whenever a verb also fits a browser tab (scegliere, caricare, aprire) or a tab is nearby, qualify it: "scheda AniList" ("scegli la scheda AniList giusta", "Caricamento della scheda AniList…"), "scheda anime" ("Scheda anime predefinita" = `settings.entry.label`) |
| sync (noun) | sincronizzazione (f.); short form **sync** (f., invariable) only where space is tight: chips, counters, status lines, category titles ("Sync automatica in pausa", "2 sync in attesa", "Riproduzione e sync") | Like FR "synchro" / DE "Sync" |
| to sync (verb) | sincronizzare ("Sincronizza su Netflix", "sincronizzato") | |
| Syncing… | Sincronizzazione… | |
| Auto sync | Sincronizzazione automatica (toggle) / Sync automatica (status lines) | |
| to check (`review.*`, `footer.toReview`) | da verificare; a check card = verifica (f.) | Uncertain match to confirm, never "recensione" |
| to rate (`ratings.*`, `footer.toRate`) | da votare; verb votare ("Vota {title}") | Italian fans give a "voto" out of 10 (AnimeClick, MAL) |
| score / rating / stars | voto (m.) / votare / stelle | "Il tuo voto?". AniList's community average is "punteggio medio" |
| comment (`notes.*`) | commento (m.) | AniList "notes", MAL "comments"; never "nota" (could be read as a grade) |
| match, mapping (`match.*`, Settings › Matches) | abbinamento (m.) / Abbinamenti | A remembered pairing platform season → AniList entry. The onboarding hint "Recommended for matching" (recognizing the anime) is "Consigliato per riconoscere gli anime": a new user does not know "abbinamenti" yet |
| match / align (AniList ↔ MAL `compare.*`) | allineare / allineamento | Copying values from one service to the other (FR « aligner »); different concept from the remembered match above. "allinea ad AniList / a MAL" in fixed texts, "allineare con {source}" before a placeholder (see Conventions › Prepositions). "Retry failed ones" = "Riprova gli errori" ("serie fallita" reads as "a flop") |
| difference (`compare.*`) | differenza | "Differenze AniList ↔ MAL" |
| Keep AniList / Keep MAL | Tieni AniList / Tieni MAL | |
| excluded series | serie esclusa / serie escluse | "Stop syncing" = "Non sincronizzare più" |
| pending sync, queue (`queue.*`) | sincronizzazione in attesa (short: sync in attesa), coda | "Abandon" a pending sync = "Scarta" (never "Abbandona", reserved for Dropped) |
| credits | titoli di coda | Standard Italian for end credits ("sigla finale" is only the ending song) |
| popup | popup (m.) | Usual word in Italian browser docs ("nel popup") |
| side panel | pannello laterale | Understood on Chrome (side panel) and Firefox (barra laterale) alike |
| Now playing (panel tab) | In riproduzione | Standard Italian "now playing" label (Spotify, YouTube Music) |
| Schedule (panel tab, `agenda.*`) | Calendario | "Calendario delle uscite"; reused in "Notifiche e calendario" and Settings › Calendario |
| On this page (`page.*`) | In questa pagina | |
| preferred player | lettore preferito | "Lettore" = player in Italian software UIs |
| history import (`crImport.*`) | importare una cronologia / importazione della cronologia ("Importa una cronologia") | "Cronologia" as on Crunchyroll and in browsers |
| SyncKai's own sync history (inside a backup) | storico delle sincronizzazioni | Kept apart from "cronologia" (streaming watch history) |
| backup (`settings.backup.*`, `backup.*`, `import.*`) | backup (m.) | Universal in Italian apps; never "cronologia". Backup modes: Unisci / Sostituisci |
| preview | anteprima | |
| account | account (m., invariable) | |
| connect / disconnect / reconnect | collegare / scollegare / ricollegare ("Collega AniList", "Scollega", "Ricollega") | |
| sign in / sign-ins (tokens) | accedere / accesso, accessi ("Accedi di nuovo", "i tuoi accessi AniList/MAL") | |
| session expired | sessione scaduta | |
| release alerts (`airing.*`, quick setting) | Avvisi nuovi episodi / avvisi | Avoids "avvisi di uscita" (uscita = also "exit") |
| "Alerts only" (in-page level, `settings.notif.alertsOnly.*`) | Solo importanti; "notifiche importanti" in the related help text | Different word from release alerts, as the shared glossary asks |
| Discreet / Detailed (in-page notifications) | Discrete / Dettagliate | Feminine plural, agree with "notifiche" |
| on-page notifications | notifiche nella pagina | Toast bubble = "riquadro"; small pill = "piccolo messaggio" (not "avviso": that word is reserved for release alerts, shown next to it in the summary "Discrete · avvisi puntuali") |
| release / out | uscita / uscire ("È uscito l’ep. 5 di …") | |
| airing / broadcast | messa in onda / trasmissione; status chip "In onda" | |
| Finished / Cancelled / On hiatus / Upcoming (airing of a series) | Conclusa / Cancellata / Sospesa / In arrivo | Feminine, agree with "serie"; "Sospesa" avoids a clash with the user's "In pausa" |
| offset, delay (`agenda.*`) | ritardo (delay to a platform); scarto (episode-number offset, `settings.mappings.offset`) | |
| shortcut | scorciatoia (da tastiera) | Chrome's and Firefox's Italian term |
| Shift key | Maiusc | As printed on Italian keyboards and shown by Chrome ("Alt+Maiusc+K") |
| tab (browser tab) | scheda | Chrome / Firefox Italian term ("nuova scheda"). Same word as "entry": the context must always tell them apart (a tab is opened, reloaded, closed, kept open; an entry belongs to AniList / MAL). A bare "scegli la scheda" is NOT enough near the popup/panel tabs ("scegli la scheda nel popup (Attività)" read as "pick the Activity tab"): write "scheda AniList" for entries. When a sentence could still be ambiguous, rephrase ("Controllo della pagina…", "Aggiorna la scheda dell’anime", "Connessione alla scheda {platform}…") |
| tab (popup / panel tab) | scheda ("la scheda In corso") | |
| card (Activity cards) | avoid "scheda": rephrase or use "riquadro" | Keeps "scheda" for entries and tabs only |
| Settings (`nav.settings`) | Impostazioni | |
| Settings categories | Riproduzione e sync · Notifiche e calendario · I miei dati · Scorciatoie · Aiuto e info | |
| Settings groups | Impostazioni rapide · Riproduzione e notifiche · Dati e aiuto | |
| Settings sections | Account · Lingua · Riproduzione · Sincronizzazione · Pannello laterale · Notifiche nella pagina · Nuovi episodi · Calendario · Abbinamenti · Serie escluse · Importa · Backup · Zona pericolosa · Aiuto · Informazioni | |
| Activity (tab) | Attività | |
| Stop (background job) / Stopping… | Interrompi / Interruzione… | Banners: "Allineamento interrotto", "Importazione interrotta" (+ ": reason" on error) |
| Recommended | Consigliato | |
| Tip | Consiglio | |
| platform | piattaforma | |
| anime | anime (m., invariable) | "l’anime", "gli anime" |
| movie / special / OVA / TV short | film / speciale / OVA / TV breve | |
| prequel / sequel / spin-off / side story / parent story | prequel / sequel / spin-off / storia parallela / storia principale | |

## 2. Conventions

- **Register**: informal **tu** everywhere; imperative 2nd person singular on buttons and in instructions ("Riprova", "Collega", "Apri"). Buttons are verbs in the imperative, never the infinitive.
- **Gender-neutral address**: avoid adjectives agreeing with the user ("Ti diamo il benvenuto!", "Hai completato {title}!", not "Benvenuto!" / "{title} completato!").
- **Capitalisation**: sentence case (only the first word and proper names capitalised).
- **Quotation marks**: curly double quotes “ ” with no inner spaces, as in Italian app UIs (Apple, Netflix Italia). Apostrophe: typographic ’ ("l’episodio").
- **Colon**: no space before, one space after ("Calendario non disponibile: …").
- **Ellipsis**: the single character …, attached to the word ("Sincronizzazione…").
- **Separators**: ` › ` in settings paths and ` · ` between items, exactly as in English.
- **Abbreviations**: Ep. / ep. (episode), min (minutes), h (hours: "3 h fa", "tra 5 h"), g (days: "tra 2 g"), s (seconds), MB (megabytes).
- **Percent**: "85%" (no space), as Intl formats Italian. Avoid an article before a variable percentage ("al 85%" should be "all’85%"): "Sync: 85%", "soglia 85%".
- **Relative times**: lowercase fragments that read after "Ultima analisi:", "Completata", "Ultimo controllo:": "proprio ora", "5 min fa", "2 h fa", "ieri", "3 giorni fa". Delays include "tra": "tra 5 min", "tra 2 giorni", "a breve".
- **Counters without plural variants**: put the number after a label ("pagine 3, episodi 287", "stagioni 4 / 37") or use an invariable noun ("4 / 37 serie").
- **"{service}: {message}"**: "{service}: {message}", the message being a lowercase fragment ("AniList: episodio 5 salvato · MyAnimeList: errore: …"). Fragments lowercased by the code start with a common word ("già…", "l’episodio…", "nessuna…"). The new-episode check fallback `airing.unknownError` is "causa sconosciuta", so that "errore: {error}" never reads "errore: Errore sconosciuto".
- **Prepositions before placeholders**: `{service}`, `{source}`, `{target}` and `{platform}` can start with "A" (AniList, ADN), where Italian wants the euphonic "ad" ("ad AniList"), which would be wrong before MyAnimeList or Crunchyroll. Never write "a {service}" / "a {platform}": use "con {service}" ("accedere con", "allineare con"), "verso {service}" (requests), "su {target}", "al sito di {platform}", "alla scheda {platform}". Fixed texts keep "ad AniList" ("Allinea tutto ad AniList", "inviata solo ad AniList").
- **"{title}: completed"**: "{title}: completata" (the participle agrees with "serie", feminine); likewise "abbandonata", "rimossa dalla tua lista". "Already up to date" = "già aggiornata" (the series / the list).
- **Plurals**: Italian needs `_one` (1) and `_other` (0, 2, 3…); `_many` (millions) is optional and falls back to `_other`, so it is not provided. "serie" is invariable, so only the agreeing words change ("1 serie esclusa" / "2 serie escluse").
- **Product names** stay in English: SyncKai, AniList, MyAnimeList, MAL, Crunchyroll, ADN, Netflix, Disney+, Firefox, Chrome, Brave, Reddit, GitHub, Weblate; English field names "Redirect URL" and "App Redirect URL" are kept (masculine: "il Redirect URL").
- **Firefox shortcuts menu item** (`settings.shortcut.manualFirefox`): "Gestisci scorciatoie da tastiera" (Firefox Italian localization, message `addon-manage-extensions-shortcuts`; re-checked in mozilla-l10n/firefox-l10n `it/toolkit/toolkit/about/aboutAddons.ftl` on 2026-10-14).

## 3. Netflix

- "Show more" button at the bottom of netflix.com/viewingactivity: **Mostra altri** (Netflix Help Center, Italian article "Come visualizzare l'attività di visione e del dispositivo", help.netflix.com/it/node/101917: "usa il pulsante Mostra altri"; the same article says "Show More" in English and "Voir plus" in French).
- "Viewing activity" page: **Attività di visione contenuti** (same article: "Apri Attività di visione contenuti").
- Both names re-checked against help.netflix.com/it/node/101917 on 2026-10-14 (review). Not checked on the live Italian netflix.com page itself.

## Development builds only

Settings › Help & about sections that exist only in development builds (2026-10-15, `settings.debugTrace.*`).

| English | Term |
|---|---|
| debug trace | traccia di debug |
| event (one line of the trace) | evento |
| verbose mode | modalità dettagliata |
