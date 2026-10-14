# SyncKai translation glossary and style guide

Shared rules for every translation of the SyncKai interface. Each language also has its own term sheet in `docs/i18n/glossary/<code>.md`, written by its translator before translating and binding for every later change.

## 1. Sources and tools

- **Reference text**: `src/i18n/locales/en.json`. `fr.json` and `de.json` are reviewed, human-quality translations: read them when the English is ambiguous (French is the original language of the product).
- **Context notes**: `docs/i18n/context.json`, one note per key (where the text appears, what it means, placeholders, length). Read the note of every key before translating it.
- **Check**: `npm run i18n:check -- <code>` reports missing or extra keys, plural forms, placeholders and empty texts, and warns about short labels that became much longer.
- **The product**: a browser extension that syncs the anime episodes watched on Crunchyroll, ADN, Netflix and Disney+ to the user's AniList and MyAnimeList lists. Users are anime fans. The popup is 400 px wide, the side panel is narrow: space is tight everywhere.

## 2. Never translate

- Product and site names: SyncKai, AniList, MyAnimeList, MAL, Crunchyroll, ADN, Netflix, Disney+, Prime Video, HIDIVE, Firefox, Chrome, Brave, Reddit, GitHub, Weblate.
- Placeholders: `{title}`, `{count}`… are replaced at runtime; keep each one exactly once (unless the English uses it twice), spelled exactly, never translated. Move them where the grammar of your language needs them.
- Keyboard key names that come from the browser (`Alt`, `Shift`) are not in the catalogs; do not add any.

## 3. Core concepts

| English term (keys) | Meaning | French | German | Guidance |
|---|---|---|---|---|
| series | An anime title (often one season). Also the unit the user excludes or rates | série | Serie | Use the word your anime community uses for an anime title |
| season, episode, arc | Parts of a series. Arcs are named parts published as seasons (One Piece) | saison, épisode, arc | Staffel, Folge, Arc | "Ep." is the short form used before a number: use your usual abbreviation |
| list | The user's own list on AniList / MyAnimeList | liste | Liste | "Your list" = the user's tracking list, not a playlist |
| entry | The page of an anime on AniList or MyAnimeList (title, cover, episodes) | fiche | Eintrag | Not "post" or "record". It is what the user opens with "Open on AniList" |
| Watching / Completed / On hold / Dropped / Plan to watch / Rewatching | The six list statuses of AniList and MyAnimeList | En cours / Terminé / En pause / Abandonné / À regarder / Revisionnage | Schaue ich / Abgeschlossen / Pausiert / Abgebrochen / Geplant / Erneut schauen | Use the terms anime fans of your language already use for these tracker statuses. "Completed" means the USER finished the series; a series that stopped airing is "finished" (`page.airing.*`) |
| Watching (tab `nav.watching`) | Popup tab listing the series the user is watching now | En cours | Schaue ich | Same word as the status if it fits as a tab label |
| Activity (tab `nav.activity`) | Popup tab with recent syncs, items to check, series to rate, pending syncs | Activité | Aktivität | |
| sync, syncing, synced | Sending the watched episode to AniList / MyAnimeList | synchro(nisation), synchroniser | Synchronisierung, synchronisieren | Pick one short noun and one verb and keep them everywhere |
| to check (`review.*`, `footer.toReview`) | An uncertain match: SyncKai found possible entries and waits for the user to confirm the right one before writing anything | à vérifier | zu prüfen | Not "review" in the sense of a critique |
| to rate (`ratings.*`, `footer.toRate`) | A series the user completed, waiting for a score | à noter | zu bewerten | |
| score, rating, stars | The user's score of a series, shown as stars on 10 | note | Bewertung | Not to be confused with comments |
| comment (`notes.*`) | Free text the user attaches to a list entry (AniList "notes", MyAnimeList "comments") | commentaire | Kommentar | The key namespace is called `notes`, but the text means "comment", never "score" |
| match, mapping (`match.*`, settings "matches") | The AniList entry chosen for a season of a streaming platform, remembered for the next episodes | correspondance | Zuordnung | |
| excluded series | A series the user asked SyncKai never to sync | série exclue | ausgeschlossene Serie | |
| pending sync, queue (`queue.*`) | A sync that failed (offline, service down) and is retried automatically later | synchro en attente | ausstehende Synchronisierung | |
| credits | The end credits of an episode. SyncKai can sync "at the start of the credits" | générique (de fin) | Abspann | |
| popup | The small window opened from the extension icon | popup | Popup | Use your language's usual word for a browser extension popup |
| side panel | The browser side panel (Chrome) or sidebar (Firefox) that shows SyncKai next to the page | panneau latéral | Seitenleiste | |
| Now playing (panel tab) | Side panel tab about the episode being watched | En lecture | Läuft gerade | |
| Schedule (panel tab `panel.tab.agenda`, `agenda.*`) | Weekly calendar of upcoming episodes of the user's series | Agenda | Zeitplan | The settings category `settings.cat.notifications` reuses this word |
| On this page (`page.*`) | Card showing the AniList entry of what is open in the current tab | Sur cette page | Auf dieser Seite | |
| preferred player | The platform SyncKai opens episodes on by default | lecteur préféré | bevorzugter Player | |
| history import (`crImport.*`) | Reading the user's watch history on Crunchyroll / ADN / Netflix to bring their lists up to date, with a preview before writing | importer un historique | Verlauf importieren | |
| backup (`settings.backup.*`, `backup.*`, `import.*`) | Exporting / importing SyncKai's own settings and data as a JSON file (`import.*` is the backup import page) | sauvegarde | Sicherung | Different from the history import: never use the same word |
| preview (import) | The plan shown before anything is written | aperçu | Vorschau | |
| rewatch | Watching a completed series again (AniList "repeat") | revisionnage | erneutes Schauen | |
| account, connect, sign in, session expired | The user's AniList / MyAnimeList account, connected through OAuth | compte, connecter, session expirée | Konto, verbinden, Sitzung abgelaufen | |
| release alerts (`airing.*`, `settings.quick.airing.label`) | Browser notifications when an episode of a followed series is released | alertes de sortie | Folgen-Alarme | Different from the in-page "alerts only" notification level (`settings.notif.alertsOnly.*`): there an alert means a message that needs action |
| release, airing | When an episode comes out (in Japan, then on a platform) | sortie, diffusion | Veröffentlichung, Ausstrahlung | |
| offset, delay (`agenda.*`) | Hours between the Japanese broadcast and the release on a platform | décalage, délai | Versatz, Verzögerung | |
| shortcut | Keyboard shortcut of the browser extension | raccourci | Tastenkürzel | |
| Settings (`nav.settings`) and its categories | Settings screen shared by the popup and the side panel | Réglages | Einstellungen | Translate the category names once; see section 5 |

## 4. Style

- **Tone**: friendly, short and direct, like a fan talking to a fan. French uses « tu », German « du ». Follow the register table below.
- **Length**: the interface is tiny. Prefer the shortest natural wording. Keep abbreviations where English abbreviates (`Ep.`, `min`, `h`, `d`) using your language's usual short forms. Buttons, tabs, chips and badges should stay close to the English length; the context notes give limits.
- **Capitalisation**: sentence case for buttons, labels and headings (only the first word capitalised), unless your language capitalises differently (German nouns).
- **Punctuation**: end a text with a period only if the English does. Use your language's quotation marks, colon and spacing rules (French puts a no-break space before « : »; most languages don't). Use the single character `…` for in-progress states ("Syncing…").
- **Separators**: keep ` › ` in settings paths and ` · ` between items exactly as in the English.
- **Composed texts**: some texts are inserted into others (`{service}: {message}`, `{title}: completed`, a relative time inside `Next try {when}`). Read the context note and make sure the result reads correctly in your language.
- **Mid-sentence lowercasing**: a few texts are inserted mid-sentence with their first letter lowercased automatically (except in German). Write them so that this still reads correctly.
- **Gender and agreement**: when a status or adjective refers to a series or an episode, agree with the word your language uses for it (French « terminée » for « série »).
- **Plurals**: give every plural form your language needs. `npm run i18n:check` lists the required ones (`_one`, `_few`, `_many`, `_other`…). Languages without plural forms only have `_other`.

### Register by language

| Language | Code | Address the user as | Notes |
|---|---|---|---|
| Spanish (Spain) | `es` | tú | Spain vocabulary |
| Spanish (Latin America) | `es-419` | tú | Neutral Latin American vocabulary, no Spain-only words |
| Portuguese (Brazil) | `pt-BR` | você | Brazilian vocabulary and spelling |
| Italian | `it` | tu | |
| Dutch | `nl` | je / jij | |
| Russian | `ru` | ты | Friendly app tone; `вы` only if a sentence sounds wrong otherwise |
| Ukrainian | `uk` | ти | |
| Polish | `pl` | ty (2nd person informal) | |
| Czech | `cs` | ty (2nd person informal) | |
| Romanian | `ro` | tu | |
| Swedish | `sv` | du | |
| Turkish | `tr` | sen | |
| Indonesian | `id` | kamu | |
| Vietnamese | `vi` | bạn | |
| Chinese (Simplified) | `zh-CN` | 你 | Simplified characters, mainland vocabulary, full-width punctuation |
| Chinese (Traditional) | `zh-TW` | 你 | Traditional characters, Taiwan vocabulary (not a character conversion of zh-CN), full-width punctuation |
| Korean | `ko` | 해요체 (polite informal); avoid 당신 | |
| Japanese | `ja` | です・ます for sentences, plain nouns or verbs for buttons; avoid あなた | |

## 5. Consistency across keys

- A text that names another part of the interface (for example `Settings › Excluded series`, `Settings › Accounts`, a tab name, a button name) must use **exactly** the translation of that part's own key (`nav.settings`, the settings category titles, the tab labels…). Search the catalog for the English label and reuse its translation.
- The same English word always gets the same translation, unless the context note says the meaning differs.
- Record every term decision in `docs/i18n/glossary/<code>.md` (English term → your term, with a short reason for non-obvious choices), especially the six list statuses, sync, entry, list, to check, to rate, match, excluded, side panel, popup, preferred player, credits, history import and backup.
