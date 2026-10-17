# Romanian (`ro`) term sheet

Binding for every change to `src/i18n/locales/ro.json` and `public/_locales/ro/messages.json`. Shared rules: `docs/i18n/GLOSSARY.md`.

Target: standard Romanian as used by Chrome, Netflix and big Romanian apps, with the words Romanian anime fans use when they talk about their lists. AniList and MyAnimeList have no Romanian interface, so fans often know the English statuses: the Romanian statuses below are short, natural and easy to map back to them. Users are addressed with **tu** (imperative "Conectează", "Încearcă din nou"; possessive "ta / tău").

## 1. Core terms

| English term | Romanian | Reason |
|---|---|---|
| Watching (status, tab `nav.watching`) | Urmăresc | First person "I'm watching", the way Romanians talk about shows they follow ("seriale pe care le urmăresc"); short enough for the tab and the chips. Quoted as „Urmăresc” inside sentences ("Adaugă la „Urmăresc”", "fila „Urmăresc”"). In sentences, the user's series in progress are "seriile pe care le urmărești" / "Încă nu urmărești nicio serie", never "serii în curs": Romanian anime sites use "în curs" for shows still airing. "În curs" stays for running jobs ("O analiză … este deja în curs") |
| Completed (status) | Terminat | Status label in the neutral form ("Terminat · Ep. 12 / 12"). In sentences about a series it agrees with "serie": "terminată" (`inline.status.COMPLETED`, `crImport.skipReason.completed`) |
| On hold (status) | În pauză | Invariable |
| Dropped (status) | Abandonat | Status label; "abandonată" for a series. Verb "Abandonează", question "O abandonezi?", compact button "Abandon" (noun) |
| Plan to watch (status) | De văzut | Natural "to watch" list name, as short as the French « À regarder » |
| Rewatching (status) | Revizionare | Noun status label, like FR « Revisionnage ». Verb "a reviziona" (DEX: to watch a film again): "Revizionezi „…”?", "Da, revizionez"; reason chip "în revizionare" |
| rewatch (noun) | revizionare (f., pl. revizionări) | "fără revizionare", "revizionări refuzate" |
| series | serie (f., pl. serii) | Adjectives and participles agree in the feminine: "serie exclusă", "seria a fost exclusă" |
| anime | anime (n., invariable in the UI) | "un anime", "titluri anime" for the plural; the colloquial plural "anime-uri" is avoided in the interface |
| season | sezon (n., pl. sezoane) | "Sezonul 2" |
| episode / Ep. | episod (n., pl. episoade) / Ep. (mid-sentence: ep.) | "Ep. 5", "episodul 1180" |
| arc | arc (n., pl. arcuri) | As fans say ("arcul Wano") |
| list | listă | "lista ta" = the AniList / MyAnimeList list |
| entry | fișă (f., pl. fișe) | The anime's page on AniList / MAL, like Cinemagia's "fișa filmului". An item inside the user's list (only `compare.skip.missingSource`) is an "intrare din listă". No entry on any connected service (`sync.noServiceFollows`): "Niciun serviciu conectat nu are o fișă pentru această serie" (not "nu urmărește", which suggests the series is missing from the list) |
| sync (noun) | sincronizare (f., pl. sincronizări) | Same word everywhere, also in tight spots ("Sincronizare în 2 min") |
| to sync (verb) | a sincroniza ("Sincronizează pe Netflix", "sincronizat") | |
| Syncing… | Sincronizare… | |
| to check (`review.*`, `footer.toReview`) | de verificat; a review card = verificare (pl. verificări) | Uncertain match to confirm. Never "recenzie" |
| to rate (`ratings.*`, `footer.toRate`) | de notat; to rate = a nota ("Notează") | Romanians give a "notă" out of 10 |
| score / rating / stars | notă (f., pl. note) / stele | "Nota ta?", "Nota 8,5/10 salvată" |
| comment (`notes.*`) | comentariu (n., pl. comentarii) | AniList "notes", MAL "comments"; never "notă" (that is the score) |
| match, mapping (`match.*`, Settings › Matches) | asociere (f., pl. asocieri) / Asocieri | A remembered link platform season → AniList entry ("Asociere incertă", "Uită asocierea") |
| match / align (AniList ↔ MAL `compare.*`) | a alinia / aliniere | Copying values from one service to the other (FR « aligner »). Buttons: "Totul ca pe AniList", "Filtrul ca pe MAL", per series "Ca pe AniList" ("like on AniList", as DE « Alle wie AniList ») |
| difference (`compare.*`) | diferență (pl. diferențe) | "Diferențe AniList ↔ MAL" |
| excluded series | serie exclusă / serii excluse | Settings section "Serii excluse" |
| pending sync, queue (`queue.*`) | sincronizare în așteptare | Section "Sincronizări în așteptare". "Abandon" (give up a queued sync) = "Renunță", so it never reads like the status "Abandonat"; likewise a sync SyncKai stopped retrying (`queue.failed`) is "Eșec — reîncercări oprite", never "abandonată" |
| credits | generic (genericul de final) | "La începutul genericului", "Sincronizare la generic" |
| popup | pop-up (n.) | "în pop-up", "din pop-up" (no article needed after a preposition) |
| side panel | panou lateral ("panoul lateral") | Chrome's Romanian term; also used on Firefox (where the browser says "bară laterală") for one consistent name |
| Now playing (panel tab) | În redare | "Redare" = playback in Romanian media apps; quoted as "fila „În redare”" |
| Schedule (panel tab, `agenda.*`, `settings.section.agenda`) | Calendar | Weekly calendar of releases; reused in the category "Notificări & calendar". AniList's own airing schedule (`settings.airing.checkTitle`) is "programul de difuzare" |
| On this page (`page.*`) | Pe această pagină | |
| preferred player | platformă preferată | The setting picks a streaming platform, not a media player app; "player" alone would mislead |
| history import (`crImport.*`) | importul istoricului de vizionare; title "Importă istoricul de vizionare" | "Istoric" as in browsers ("istoricul de navigare") |
| backup (`settings.backup.*`, `backup.*`, `import.*`) | backup (n.) | Common in Romanian apps; used without article where possible ("un backup SyncKai", "pagina Backup"). Never "istoric". The history a backup contains (SyncKai's sync history) is "istoricul sincronizărilor", never bare "istoric", which reads as the watch history of the history import |
| preview | previzualizare | |
| account | cont (n., pl. conturi) | "Contul AniList" |
| connect / disconnect | a conecta / a deconecta ("Conectează AniList", "Deconectează") | |
| sign in / sign-ins | a se conecta ("conectează-te"); sign-ins (tokens) = datele de conectare | |
| session expired | sesiune expirată ("Sesiunea AniList a expirat") | |
| release alerts (`airing.*`, quick setting) | alerte de lansare; summary fragments "alerte +3 h", "alerte imediate", "alerte oprite" | Browser notifications for new episodes. Episodes announced by a notification (`airing.status.notified`): "3 episoade anunțate" (as in "Anunță-mă când apare un episod"), never "notificate" (formal/legal verb). The notification body is shared by the single and the group notification: keep it number-neutral ("Difuzare în Japonia · de obicei pe Crunchyroll/ADN în câteva ore") |
| "Alerts only" (in-page level, `settings.notif.alertsOnly.*`) | Doar avertizări | Different word from release alerts, as the shared glossary asks: an "avertizare" needs an action |
| release / out | lansare / a apărea ("când apare un episod", "A apărut") | |
| airing / broadcast | difuzare ("difuzarea din Japonia") | |
| Airing / Finished / Cancelled / On hiatus / Upcoming (airing status of a series) | În difuzare / Încheiată / Anulată / Suspendată / Anunțată | Feminine, agree with "serie". "Încheiată" (finished airing) never reuses the user's "Terminat"; "Suspendată" never reuses "În pauză" |
| offset, delay | decalaj (episode-number offset, `settings.mappings.offset`); întârziere (broadcast → platform delay, `agenda.*`, Settings › Delay) | |
| shortcut | comandă rapidă (pl. comenzi rapide) | Chrome's Romanian term ("Comenzi rapide de la tastatură") |
| key / not set | tastă / "Nicio tastă" | A shortcut without a key shows "Nicio tastă" |
| tab (browser, popup, panel) | filă (pl. file) | Chrome's Romanian term ("filă nouă"); "fila „Urmăresc”", "fila Netflix" |
| track (follow progress) | a urmări | "SyncKai urmărește doar titlurile anime recunoscute de AniList". When SyncKai or the panel tracks, name it as the subject ("ca SyncKai să poată urmări redarea"): "ca să urmărești" makes the user the one tracking |
| icon / click | pictogramă / a da clic ("Dă clic pe pictograma SyncKai") | |
| reload / retry | reîncarcă / Reîncearcă, "Încearcă din nou" | |
| correct (verb, `recent.correct`) / correction | Corectează / corecție | |
| ignore / forget / re-enable | Ignoră / Uită / Reactivează | |
| Stop syncing / Resume syncing | Nu mai sincroniza / Reia sincronizarea | |
| Settings (`nav.settings`) | Setări | |
| Activity (`nav.activity`) | Activitate | Quoted as "(Activitate)" / "în Activitate" |

## 2. Settings names

| English | Romanian |
|---|---|
| Settings › Playback & sync (`settings.cat.sync`) | Setări › Redare & sincronizare |
| Settings categories of the 2026-10-17 redesign: Platforms / Notifications (`settings.cat.notifications`, one word: the Schedule options moved to Platforms) / Display; Playback & sync (`settings.cat.sync`) was removed | **Platforme** / **Notificări** / **Afișare** |
| Shortcuts (`settings.cat.shortcuts`) | Comenzi rapide |
| My data (`settings.cat.data`) | Datele mele |
| Help & about (`settings.cat.help`) | Ajutor & informații |
| Accounts / Language | Conturi / Limbă |
| Quick settings / Playback & alerts / Data & help (groups) | Setări rapide / Redare & alerte / Date & ajutor |
| Sections: Playback / Sync / Side panel / New episodes / On-page notifications / Schedule / Matches / Excluded series / Backup / Import / Help / About / Danger zone | Redare / Sincronizare / Panou lateral / Episoade noi / Notificări pe pagină / Calendar / Asocieri / Serii excluse / Backup / Import / Ajutor / Despre / Zonă periculoasă |
| Discreet / Detailed / Alerts only (in-page levels) | Discrete / Detaliate / Doar avertizări (agree with "notificări", f. pl.) |
| Auto sync / Release alerts | Sincronizare automată / Alerte de lansare |
| Preferred player / Default entry page | Platformă preferată / Fișa deschisă implicit |
| Episode watched: At the start of the credits / At a fixed percentage | Episod văzut: La începutul genericului / La un procent fix |
| Tab on opening: Last opened / Now playing / Schedule | Fila la deschidere: Ultima filă / În redare / Calendar |
| Copy diagnostic report / Report a problem | Copiază raportul diagnostic / Raportează o problemă (a GitHub issue = "raport de eroare", never just "raport", which is the diagnostic report) |
| Shortcut buttons Change / Set | Modifică / Setează |

## 3. Conventions

- **Register**: tu, friendly and direct. Avoid participles that agree with the user's gender ("conectat"): prefer "Contul {service} nu este conectat", "dacă te-ai conectat deja".
- **Diacritics**: ș and ț with comma below (U+0219, U+021B), never the cedilla forms (s / t with cedilla, U+015F, U+0163); ă, â, î.
- **Quotation marks**: „…” (U+201E … U+201D); nested «…».
- **Punctuation and spacing**: no space before ":", "?", "!". Percent follows CLDR for Romanian with a space: "85 %". Decimal comma comes from the locale ("8,5").
- **Ellipsis**: the single character "…" ("Sincronizare…", "Se încarcă…").
- **Abbreviations**: "min" (minutes), "h" (hours), "z" (days, `time.countdown.days`: "2 z", the CLDR narrow unit for Romanian), "s" (seconds), "Ep." / "ep." (episode, also plural: "12 ep."), "nr." (number), "MB".
- **Statuses inside sentences**: always quoted with „…”: "Adaugă la „De văzut”", "când o serie trece la „Terminat”".
- **History import, "read again"**: errors that send the user back to "Citește istoricul meu" end with "reia citirea" (never "citește din nou", which tells the user to read).
- **Browser permission prompts**: "Browserul îți va cere permisiunea de acces la netflix.com" (never "îți va cere acces", which inverts who asks whom).
- **Full screen**: "modul ecran complet" (the browser's term), not "pe ecran complet".
- **Plurals**: Romanian needs `_one` (1), `_few` (0, 2–19, 101–119…) and `_other` (20–100, 120…, with "de"): "1 episod", "3 episoade", "20 de episoade". Elided nouns keep the "de" before substantivized adjectives ("20 de excluse"), not before verbs ("20 nu sunt pe MAL"). Texts that are not plural-aware put the number after a label so any number reads correctly ("Analiză — sezoane: 4 / 37", "Se citește istoricul — pagini: 3, episoade: 287…").
- **"{service}: {message}"**: "AniList: episodul 5 salvat" (fragments start in lowercase; the code lowercases reasons inserted after the colon).
- **"{title}: completed"**: "{title}: terminată" (agrees with "serie"), likewise "{title}: abandonată", "{title}: în pauză", "{title}: eliminată din lista ta".
- **Relative times** (inserted after "Ultima verificare:", "Analiză făcută", "Terminată", "Totul e sincronizat ·"): "chiar acum", "acum 5 min", "acum 2 h", "ieri", "acum 3 zile". Retry delays after "Reîncercare": "în 5 min", "în 2 h", "în 3 zile", "în curând".
- **Gender of names**: services and platforms are neuter ("AniList este inaccesibil", "Netflix rămâne dezactivat").
- **Kept in English**: product names, "Redirect URL", "App Redirect URL", "JSON", "OVA", "TV", "Spin-off", "Prequel", "AL" / "MAL", "JP".
- **Shift key**: "Shift" (printed as such on Romanian keyboards).

## 4. Netflix

- "Show more" button at the bottom of netflix.com/viewingactivity in Romanian: **„Mai multe”**, quoted in `crImport.netflix.rule`. Source: Netflix's Romanian help center (help.netflix.com/ro/node/101917, "folosește butonul Mai multe"), checked 2026-10-14; not seen on a live Romanian profile.
- Viewing activity page: **„Activitate de vizionare”** (same help page: "Deschide Activitate de vizionare").
- Code note: `src/platforms/netflix/tab-op.ts` › `netflixTabOp` finds that button by its text; "mai multe" was added to its labels in the final pass of 2026-10-14, so the Netflix import reads the whole history on a Romanian profile.

## 5. Firefox

- Gear menu item of about:addons "Manage Extension Shortcuts": **„Gestionează comenzile rapide ale extensiilor”** (mozilla-l10n `ro/toolkit/toolkit/about/aboutAddons.ftl`, `addon-manage-extensions-shortcuts`, checked 2026-10-14), quoted in `settings.shortcut.manualFirefox`.

## Development builds only

Settings › Help & about sections that exist only in development builds (2026-10-15, `settings.debugTrace.*`).

| English | Term |
|---|---|
| debug trace | urmă de depanare |
| event (one line of the trace) | eveniment |
| verbose mode | mod detaliat |

## Settings › Sync (2026-10-17)

| English | Term |
|---|---|
| Automatic (Sync section) | Automat |
| Per series (Sync section) | Pe serie |
| Never synced (Excluded series section) | Nesincronizate niciodată |
| Match origins: chosen / learned / legacy / imported · to recheck | Aleasă de tine / Învățată / Veche / Importată · de reverificat |

## Settings › Platforms and Notifications (2026-10-17)

| English | Term |
|---|---|
| Where SyncKai follows your episodes (section) | Unde urmărește SyncKai episoadele |
| Included (built-in platform) | Inclusă |
| Access missing | Fără acces |
| Turn on first (preferred player option) | Activeaz-o întâi |
| Estimated release time | Ora estimată a lansării |
| Extra delay (release alerts) | Întârziere extra |
| On the playback page (Notifications section) | Pe pagina de redare |

## Settings › My data and Help & about (2026-10-17)

| English | Term |
|---|---|
| Compare (My data section) | Comparare |
| AniList ↔ MyAnimeList differences (row title) | Diferențe AniList ↔ MyAnimeList |
| Align (differences section) | Aliniere |
| Diagnostic report (row title) | Raport diagnostic |
| Copy the report (button) | Copiază raportul |
| What's new (About link) | Noutăți |
| Privacy (About link) | Confidențialitate |
