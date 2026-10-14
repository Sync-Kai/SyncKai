# SyncKai term sheet: Czech, `cs`

Binding for every change to `src/i18n/locales/cs.json` and `public/_locales/cs/messages.json`. Shared rules: `docs/i18n/GLOSSARY.md`.

Target: natural Czech as used by Czech anime fans and by the Czech versions of Netflix, Disney+ and Chrome. Friendly app tone (informal *ty*, as in Spotify or Duolingo Czech), short wording, standard spelling (*zhlédnout*, not *shlédnout*).

## 1. Core concepts (GLOSSARY.md section 3)

| English term | Czech | Reason |
|---|---|---|
| series | **seriál** (m.), pl. **seriály**, gen. pl. **seriálů** | Usual word for an anime title (*anime seriál*). Not *série*: in Czech TV usage *série* often means a season. Adjectives and participles agree with *seriál* (masculine): *Seriál vyloučen*, *Vyloučené seriály*, *{count} vyloučených*. |
| anime | **anime** (n., indeclinable; pl. agreement neuter: *japonská anime, která…*) | |
| season | **řada** (f.): *Řada 2*, *{count} řady*, *{count} řad* | Term used by Netflix CZ and Disney+ CZ (*Řada 1*). *sezóna* would clash with airing seasons (podzim 2024). |
| episode / Ep. | **epizoda** (f.); before a number **Ep.** / **ep.** (*Ep. 5*, *Zpět na ep. 4*) | Netflix CZ term. The abbreviation *ep.* works for any number, so non-plural-aware counts (`review.episodes`, `page.episodes_*`) use **{count} ep.**. Participles after *Ep.* are feminine: *Ep. 5 zhlédnuta*, *Ep. 5 uložena*. Not *díl*: no clean abbreviation for counts. |
| part (season split on AniList) | **část** (*Řada 2 · část 1/2*) | Distinct from episode. |
| arc | **arc** | What Czech fans say (*Elbaph arc*); only appears in context notes. |
| list | **seznam** (m.): *tvůj seznam*, *v tvém seznamu*, *do seznamu {target}* | The user's tracking list. |
| entry | **záznam** (m.): *Otevřít záznam {service}*, *Jediný záznam*, *záznam na AniListu* | Database entry of the anime on AniList/MyAnimeList. Not *stránka* (ambiguous with web page) nor *karta* (= browser tab in Czech Chrome). |
| Watching (status and popup tab `nav.watching`) | **Sleduji** | First person, like German *Schaue ich*; short tab label. |
| Completed | **Dokončeno** | Status labels are neuter impersonal participles (Czech UI convention): *{title}: dokončeno*, *(dokončeno)*. Action: **Označit jako dokončené**, compact button **Dokončit**, confirmation **Dokončit?**. Not the airing status (*Odvysíláno*). |
| On hold | **Pozastaveno** | AniList Paused / MAL On-Hold. Action: **Pozastavit** (button and menu). Not the airing hiatus (*Přerušeno*). |
| Dropped | **Zahozeno** | Fan wording (*zahodil jsem to po třech epizodách*). Action: **Zahodit**, confirmation **Zahodit?** (never reads as *Zrušit* = Cancel). |
| Plan to watch | **Chci vidět** | The Czech watchlist phrase everyone knows from ČSFD. Buttons: **Přidat do Chci vidět**, feedback **Přidáno do Chci vidět**. |
| Rewatching | **Znovu sleduji** | Parallel to *Sleduji*. Lowercase in chips: *znovu sleduji*. |
| rewatch (noun) | **opakované sledování** | *Opakované sledování neuloženo*, *opakované sledování nezačne*. The bubble button is **Ano, sleduji znovu**; the question **Sleduješ „{title}“ znovu?**. |
| Activity (tab) | **Aktivita** | Cross-references keep the nominative: *na kartě Aktivita*, *(Aktivita)*. |
| sync (noun) / to sync | **synchronizace** (f., pl. *synchronizace*, gen. pl. *synchronizací*) / **synchronizovat**; **synchronizováno**, **Synchronizuji…** | One noun and one verb everywhere, no *sync*/*synchro* slang, even where it is long. |
| to check (`review.*`, `footer.toReview`, `inline.toCheck`) | **k ověření**; a to-check card = **ověření** (n., same form in sg./pl.: *Vytvořit 3 ověření*, *ověření vytvořeno*); verb **ověřit** (*Ověř v SyncKai*) | Same root for label and card, like French *à vérifier / vérification*. Other "check" senses (check your connection, Check now, checking the tab) use **zkontrolovat / kontrola**, never *ověřit*. |
| to rate | **k hodnocení**; verb **ohodnotit** (*Ohodnotit {title}*, *Ohodnoť ho…*) | |
| score / rating / stars | **hodnocení** (n., same form in sg./pl.) | The user's score; AniList average: *Průměrné hodnocení na AniListu*. |
| comment (`notes.*`) | **komentář** (m.) | AniList Notes / MAL Comments. Never *poznámka* or *hodnocení*. |
| match, mapping (`match.*`, Settings) | **přiřazení** (n., same form in sg./pl.: *{count} přiřazení*, section **Přiřazení**) | Remembered season → AniList entry link. Verb: *přiřadit*; *přiřazování* = the matching process. On the welcome screen (`onboarding.hint.anilist`) the process is described for newcomers as *rozpoznávání anime*. |
| match to (AniList ↔ MAL alignment, `compare.*`) | **sladit** / **slaďovat**; job = **slaďování** (*Slaďování dokončeno*); result *Už sladěno* | Different concept from matches. Bulk buttons: *Vše podle AniListu* / *Výběr podle MAL* (filtered set = **výběr**; never *Filtr podle…*, which reads as one more filter chip). |
| excluded series | **vyloučený seriál**; chip **Vyloučeno**; section **Vyloučené seriály** | Action **Už nesynchronizovat** (*… tento seriál*); undo **Obnovit synchronizaci** (menu), **Znovu zapnout** (Settings button, *Lze znovu zapnout v Nastavení › Vyloučené seriály*). |
| pending sync, queue | **čekající synchronizace** (*Čekající synchronizace ({count})*) | Discarding a queued sync = **Odstranit** (not *Zahodit*, which is the Dropped action). SyncKai giving up = *Selhalo – bez dalších pokusů*. |
| credits | **závěrečné titulky**; in short timing contexts **titulky** (*Synchronizace u titulků*, *u titulků*) | Standard Czech film term. Always with a timing word (*u*, *na začátku*), because bare *titulky* also means subtitles. |
| popup | **okno rozšíření** (*v okně rozšíření*) | The only window of the extension; clear and shorter than *vyskakovací okno*. Toolbar icon: *ikona SyncKai*. |
| side panel | **boční panel** | Chrome CZ term; also used for the Firefox sidebar. |
| browser tab | **karta** (*na kartě*, *nová karta*, *Obnovit kartu*) | Chrome CZ term (*Otevřít na nové kartě*). Also used for the UI tabs (*karta Sleduji*, *na kartě Aktivita*). Reload = **obnovit**. |
| Now playing (panel tab) | **Právě běží** | Usual Czech TV wording ("currently on"). |
| Schedule (panel tab, `agenda.*`, Settings) | **Kalendář** | Weekly release calendar; reused in *Upozornění a kalendář* and section *Kalendář*. Not *Program* (= software). |
| On this page | **Na této stránce** | |
| preferred player | **výchozí platforma** (label **Výchozí platforma**) | The note says "player" = streaming service; *přehrávač* stays for the video player (*Čekám na přehrávač…*). |
| history import | **import historie sledování**; title **Import historie sledování**; verb **importovat**, read = **načíst** (*Načíst moji historii*, *načti historii znovu*) | |
| backup | **záloha** (*Záloha · SyncKai*, file *synckai-zaloha-{date}.json*, ASCII file name) | Never used for the history import. The *history* a backup contains is SyncKai's own sync log: **historie synchronizací**, never bare *historie* (it would read as the watch history of *Import historie sledování*). |
| preview | **náhled** | |
| account / connect / disconnect / sign in / sign out | **účet** / **připojit** / **odpojit** / **přihlásit se** / **odhlásit se** | Reconnect = **Znovu připojit**. Stored sign-ins in backups = **přihlašovací údaje**. |
| session expired | **Relace vypršela** (*{service}: relace vypršela*) | Standard Czech UI wording, as short as English in the footer. |
| release alerts | **upozornění na epizody** (toggle **Upozornění na epizody**; summaries *upozornění ihned*, *upozornění +3 h*, *bez upozornění*) | Browser notifications about new episodes. |
| in-page notifications / "alerts only" level | **oznámení na stránce**; levels **Nenápadně**, **Podrobně**, **Jen důležité** | Different word from release alerts (*upozornění*). "Alerts" there = **důležitá oznámení**. |
| release / airing | **vydání** (on a platform) / **vysílání** (TV broadcast in Japan; *japonské vysílání*) | Airing statuses: **Vysílá se**, **Odvysíláno**, **Zrušeno**, **Přerušeno** (hiatus), **Chystá se** (upcoming). Chip *Seriál skončil*. |
| offset / delay | **posun** (episode-number offset, *posun o 24*) / **zpoždění** (Japanese broadcast → platform, *Zpoždění pro {title}*) | |
| shortcut | **klávesová zkratka**, short **zkratka** | Settings category **Zkratky**, link row *Klávesové zkratky*. Shift key: **Shift** (printed on Czech keyboards). |
| tracking (SyncKai follows playback) | **hlídat** (*SyncKai tu nic nehlídá*, *Obnov kartu, aby SyncKai mohl hlídat přehrávání*) | Keeps *sledovat* for the user watching (*Sleduji*). |
| progress | **postup** (*Tvůj postup*, filter *Postup*) | |
| status | **stav** (*Stav v tvých seznamech*, filter *Stav*) | |

## 2. Settings (`nav.settings`) and its categories

| English | Czech |
|---|---|
| Settings | **Nastavení** (indeclinable: *v Nastavení*) |
| Quick settings / Playback & alerts / Data & help (groups) | **Rychlé nastavení** / **Přehrávání a upozornění** / **Data a nápověda** |
| Playback & sync | **Přehrávání a synchronizace** (path *Nastavení › Přehrávání a synchronizace*) |
| Notifications & schedule | **Upozornění a kalendář** |
| Shortcuts | **Zkratky** |
| Accounts | **Účty** |
| My data | **Moje data** |
| Language | **Jazyk** |
| Help & about | **Nápověda a informace** |
| Sections: Playback / Sync / Side panel / New episodes / On-page notifications / Schedule / Matches / Excluded series / Backup / Import / Help / About / Danger zone | **Přehrávání** / **Synchronizace** / **Boční panel** / **Nové epizody** / **Oznámení na stránce** / **Kalendář** / **Přiřazení** / **Vyloučené seriály** / **Záloha** / **Import** / **Nápověda** / **O rozšíření** / **Nebezpečná zóna** |
| Copy diagnostic report | **Kopírovat diagnostiku** (path *Nastavení › Nápověda › Kopírovat diagnostiku*) |

## 3. Conventions

- **Register**: informal *ty*. Imperatives in 2nd person singular (*Zkus to znovu*, *Připoj*, *Obnov stránku*), possessive *tvůj/tvoje*. Buttons and menu items use the infinitive (*Uložit*, *Zkusit znovu*); in-progress states use the 1st person present (*Načítám…*, *Synchronizuji…*, *Čekám na přehrávač…*).
- **Gender-neutral address**: never a past participle or adjective that agrees with the user (*jsi přihlášený/á*, *zrušil(a) jsi*). Use the present tense (*Klávesa, kterou si změníš, …*), impersonal reflexive forms (*nic se nezapsalo*, *Seriál se nepodařilo vyloučit*), neuter participles (*Neuloženo*) or nouns (*během importu došlo k odhlášení nebo změně účtu*; not *účet se odhlásil*, an account does not sign itself out; the passive *Účet byl mezitím odhlášen* is fine).
- **Quotation marks**: „…“ (U+201E, U+201C). UI names quoted in sentences keep their exact nominative label: *přes „Upravit čas“*, *na kartě „Právě běží“*, *(„K ověření“)*.
- **Colon**: no space before it (*{label}: {value}*). **Percent**: space before % (*85 %*, *{value} %*); a threshold takes *při* (*Synchronizace při 85 %*, summary *při 85 %*), never *u 85 %*; the credits keep *u titulků*. **Ellipsis**: the single character `…`. **Dash**: spaced en dash `–` inside sentences (EN em dash); the `—` separator of the season dropdown is kept as is.
- **Abbreviations**: *min* (minutes), *h* (hours), *d* (days, compact countdown only), *s* (seconds), *Ep./ep.*, *MB*. Relative times: *před 5 min*, *před 2 h*, *před 3 dny*, *včera*, *právě teď*; future: *za 5 min*, *za 2 h*, *za 1 den / 2 dny / 5 dní*, *brzy*.
- **Plural forms**: `_one` (1), `_few` (2–4), `_other` (0, 5+, including 21, 22: Czech uses the genitive plural for all of them). `_many` (decimals only) is not provided: every count here is an integer. Verb agreement: 1 → singular (*1 seriál se přidá*), 2–4 → plural (*3 seriály se přidají*), 0/5+ → neuter singular (*5 seriálů se přidá*). Running counters with no plural variants use a label (*řady 4 / 37*, *stránek: 3*) or the abbreviation *ep.*.
- **Composed texts**: `{service}: {message}` → *AniList: epizoda 5 uložena* (fragments start lowercase, no final period). `{title}: completed` → *{title}: dokončeno* (also *{title}: zahozeno*, *{title}: pozastaveno*, *{title}: odebráno z tvého seznamu*). `Next try {when}` → *Další pokus za 5 min / brzy*. `Last checked: {relative} · failed: {error}` → *Poslední kontrola: před 5 min · selhala: {error}* (*selhala* agrees with *kontrola*; *chyba: Neznámá chyba* was redundant). Fragments lowercased by the code never start with a product name.
- **Product names and placeholders**: names are never declined inside a placeholder, so a placeholder only appears where the nominative/accusative fits (a genitive slot gets a declined head noun, *Chyba služby {service}*, *Přeskočit hodnocení seriálu {title}*, or a colon, *Odstranit synchronizaci: {title}*): as a subject (*{service} neodpovídá*), as an object (*Připojit {service}*, *SyncKai podporuje {platforms}*), after *na/přes* + accusative of direction (*požadavků na {service}*, *Přejít na {platform}*, *Pusť si epizodu přes {platforms}*), or as an apposition after a declined noun (*ve službě {service}*, *na platformě {platform}*, *na webu {platform}*, *karta {platform}*, *účet {service}*, *seznamu {services}*). When the name is literal text it is declined normally: *na AniListu*, *od MyAnimeListu*, *na Netflixu*, *ke Crunchyrollu*, *s AniListem*; abbreviations (*MAL*, *ADN*) and *Disney+* stay undeclined. Gendered agreement with a name subject is limited to AniList/MyAnimeList/Netflix (masculine); otherwise *Platforma {platform} je vypnutá*.
- **Capitalisation**: sentence case. A status or tab name used as a label keeps its capital, in quotes or after a classifier noun (*ve stavu Dokončeno*, *na kartě Aktivita*, *Přidat do Chci vidět*); used as a plain word inside a fragment it is lowercase (*{title}: dokončeno*, chip *AL znovu sleduji*). *Nastavení* is capitalised when it names SyncKai's screen (*v Nastavení*), lowercase for the browser's settings (*nastavení prohlížeče*).

## 4. Netflix and browser UI names

- *Viewing activity* page (used in `crImport.read.error.netflixLoggedOut`, `crImport.netflix.rule`, `crImport.netflix.keepTab`): **„Divácká historie“**. Confirmed on 2026-10-14 in Netflix's Czech help center (help.netflix.com/cs/node/101917: *Otevřete sekci Divácká historie*); the earlier guess *Aktivita sledování* was wrong.
- "Show more" button at the bottom of netflix.com/viewingactivity: **„Zobrazit více“** (same article: *použijte tlačítko Zobrazit více*), quoted in `crImport.netflix.rule`.
- Firefox gear-menu item *Manage Extension Shortcuts* (`settings.shortcut.manualFirefox`): **Správa klávesových zkratek pro rozšíření** (mozilla-l10n `cs/toolkit/toolkit/about/aboutAddons.ftl`, `addon-manage-extensions-shortcuts`, checked 2026-10-14). Firefox calls its sidebar *postranní lišta*; SyncKai keeps *boční panel* for both browsers.
