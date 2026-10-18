# Review log — Spanish (Spain), `es`

Independent review of `src/i18n/locales/es.json` (934 keys) and `public/_locales/es/messages.json`, against `en.json`, the reviewed `fr.json` / `de.json`, the context notes (`docs/i18n/context.json`), the shared glossary and the term sheet (`docs/i18n/glossary/es.md`).

## Method

1. Terminology audit of the term sheet, then a catalog-wide search of every core term (series, season, episode, list, entry, sync, to check, to rate, score, comment, match, excluded, pending sync, credits, popup, side panel, Now playing, Schedule, On this page, preferred player, history import, backup, preview, rewatch, account / session expired, release alerts, Settings and its categories, the six list statuses, Activity, Watching) for stray variants.
2. Key-by-key reading of all 934 keys with their context notes, then a second read of the Spanish alone for naturalness.
3. Composed texts checked once assembled: `{service}: {message}` fragments, `Última comprobación: {relative} · …` fragments, `{reason}. Haz clic…`, `Analizado / Completada {relative}`, `Próximo intento {when}`, `{title}: completada`, settings paths `Ajustes › …`.
4. Mechanical checks (script): `¿?` / `¡!` pairs, double spaces, space before punctuation, `...`, straight or English quotes, final punctuation parity with English, lowercase fragments, `%` spacing: no finding.
5. Length audit: every key whose note gives a limit (223 keys) measured with realistic placeholder values; the segmented control of *Settings › Reproducción y sincro › Panel lateral* checked in `src/ui/settings/page-sync.ts` / `src/ui/kit.ts`.
6. External names verified at the source:
   - Firefox es-ES, `addon-manage-extensions-shortcuts` = « Administrar atajos de extensiones » (mozilla-l10n `firefox-l10n/es-ES/toolkit/toolkit/about/aboutAddons.ftl`): `settings.shortcut.manualFirefox` is correct.
   - Netflix Spain help article « Cómo ver el historial de visionado y la actividad del dispositivo »: page « Actividad de visionado », button « Mostrar más »: the `crImport.netflix.*` and `crImport.read.error.netflixLoggedOut` texts are correct.
7. `npm run i18n:check -- es`: 0 errors; 49 informative length warnings (50 before), each compared with the limit of its context note.

## Changes

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `airing.skip.noSeries` | no hay series en curso en caché — abre la pestaña Viendo | no hay en caché ninguna serie que estés viendo — abre la pestaña Viendo | terminology | « en curso » reads as "currently airing" in Spain; the rest of the catalog says « series que estás viendo » for the Watching list |
| `airing.status.failed` | error: {error} | fallo: {error} | style | Avoids « error: Error desconocido » once `airing.unknownError` is inserted |
| `feedback.service.error` | error: {message} | fallo: {message} | style | Avoids « MyAnimeList: error: Error de MyAnimeList (503). »; same prefix as the airing status |
| `compare.bulk.filtered.anilist` | Igualar filtro a AniList | Igualar estas a AniList | style | One does not "equalize a filter"; the button acts on the series shown (≤ 24 chars kept) |
| `compare.bulk.filtered.mal` | Igualar filtro a MAL | Igualar estas a MAL | style | Same as above |
| `compare.intro` | … y series que faltan en un lado. … | … y series que faltan en una de las dos. … | style | « en un lado » is a calque of "on one side" |
| `crImport.connect.access` | … dale acceso para leer tu historial. | … dale acceso para que pueda leer tu historial. | grammar | The infinitive made "you" the reader; SyncKai reads the history |
| `crImport.read.error.unavailable` | … La sincro mientras ves no se ve afectada. | … Esto no afecta a la sincro mientras ves episodios. | style | « ves … se ve » clash and a dangling « mientras ves » |
| `crImport.analyze.hint` | … el análisis sigue en marcha y la página lo retomará. | … el análisis sigue en marcha y lo verás al volver a abrirla. | meaning | The page does not resume the analysis, it shows it again when reopened (EN "will pick it up", FR « la retrouvera ») |
| `crImport.reason.numbering` | Posición del episodio en su temporada desconocida (…) | Se desconoce la posición del episodio en su temporada (…) | grammar | Adjective stranded six words after its noun |
| `engagement.notCompleted` | Ficha no completada: sin revisionado | No está completada en tu lista: sin revisionado | meaning | *Ficha* is the anime's AniList page; what is not Completed is the user's list entry. Reads « AniList · no está completada en tu lista: … » once lowercased |
| `engagement.deferFailed` | No se ha podido guardar la nota para más tarde. | No se ha podido dejar la nota para más tarde. | meaning | Nothing is saved: the rating is postponed; « guardar la nota » means saving the score |
| `review.previousNote` | … (ahí se guardó el episodio {progress}). | … (ahí se ha guardado el episodio {progress}). | consistency | Spain present perfect used everywhere else for an event whose result is still current |
| `settings.help.text` | Los errores solo se guardan en este navegador. Solo se comparten si copias el informe. | Los errores se guardan únicamente en este navegador y solo se comparten si copias el informe. | style | « solo … Solo » repetition |
| `settings.mappings.count_one` | {count} serie memorizada | {count} serie guardada | style | *Memorizar* is unusual for software in Spain; *guardar* is the usual verb |
| `settings.mappings.count_other` | {count} series memorizadas | {count} series guardadas | style | Same as above |
| `settings.shortcuts.help` | … elige otra con «Cambiar» o «Asignar». | … elige una con «Cambiar» o «Asignar». | meaning | When a key is missing there is no "other" key to pick |
| `sync.recentNotFound` | Sincronización no encontrada. | Sincro no encontrada. | consistency | A single sync item is *sincro* everywhere else (« Esta sincro ya no existe. », « Últimas sincros ») |

Totals: style 9, meaning 4, grammar 2, consistency 2, terminology 1 (18 keys).

`public/_locales/es/messages.json`: reviewed, unchanged. `extDescription` is 84 characters (limit 132); `cmdCompleteEpisode` and `cmdOpenSidePanel` are identical to `settings.shortcuts.episode` and `settings.shortcuts.panel`.

## Term sheet updates (`docs/i18n/glossary/es.md`)

- **sync**: a single sync item is always *sincro* (« Sincro no encontrada. »); the full *sincronización* is kept only for the process in fixed formal phrases (« Error de sincronización », « excluida de la sincronización », section « Sincronización »).
- **Watching** in sentences: « series que estás viendo », never « en curso ».
- **match**: "remembered" = *guardada* (« 12 series guardadas »); filtered bulk buttons « Igualar estas a AniList / MAL ».
- **`{service}: {message}`**: failure prefix « fallo: », never « error: ».
- **Recent past**: example « (ahí se ha guardado el episodio 5) », no preterite for results still visible.

## Debatable, left unchanged

| Key(s) | Current text | Why it was kept |
|---|---|---|
| `common.actionFailed` | Algo ha fallado | Natural title of a Spanish error box; the message on the next line gives the cause. « Acción fallida » sounds like a calque |
| `onboarding.welcome` | ¡Te damos la bienvenida! | Gender-neutral standard (Google es-ES); « ¡Bienvenido! » is masculine only. 24 characters fit the 400 px heading |
| `panel.tab.nowPlaying` | Reproduciendo | Usual Spanish media label; 13 characters for a 12-character guide. In the *Pestaña al abrir* segmented control (11 px, `px-3`, wrapping row) the three options take about 280 px, which fits |
| `settings.help.report` | Informar de un problema | Chrome es-ES's own wording; 23 characters for a 22-character guide |
| `settings.help.copy` | Copiar informe de diagnóstico | 29 characters for 28 (French is 31); quoted in `help.issue.body` |
| `compare.breakdown.progress_*`, `compare.impact.progress_*` | 30 progresos / 30 progresos modificados | Plural of a mostly uncountable noun, but parallel to « 15 estados · 9 notas » and to French « progressions »; « 30 de progreso » would break the parallel |
| `page.airing.HIATUS` | En hiato | Fundéu prefers *hiato* to *hiatus*; many fans write « en hiatus » |
| `review.format.tvShort` | Corto de TV | No settled Spanish term; « Serie corta » would clash with *serie* = anime title |
| `popup.excludeFailed`, `popup.includeFailed` | Error al excluir, reinténtalo / Error al reactivar, reinténtalo | 29 / 31 characters in a truncated chip (~25); the key information comes first; French is longer |
| `compare.filter.missingAniList` | Faltan en AniList | 17 characters for 16 (French 18) |
| `agenda.notConnected`, `crImport.review.*`, `panel.nowPlaying.connectHint`, `panel.nowPlaying.notFoundHint` | … en la ventana emergente … | Term sheet choice, recommended by Fundéu over *pop-up*; some users say « el popup » |
| `settings.section.mappings` and related | Asociaciones | Can read as "organizations" out of context, but every occurrence is in context; *vínculo* would collide with *enlace / enlazada* (AniList external links) |
| `settings.cat.notifications` | Avisos y calendario | *Avisos* is also the release-alert term; « Notificaciones y calendario » (27) exceeds the 24-character limit |
| `onboarding.step3` | Tu lista, al día en los créditos | Telegraphic, but must fit two lines of a 110 px column |
| `airing.status.notified_*` | {count} episodios notificados | Correct (*notificar algo*), slightly administrative |
| `crImport.preview.add` | nueva | Chip « AL nueva → 12 »; agrees with *serie* |

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | Invierno / Primavera / Verano / Otoño | Invierno {year} / Primavera {year} / Verano {year} / Otoño {year} | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |
| `sync.noServiceFollows` | Ningún servicio conectado sigue esta serie. | Ningún servicio conectado tiene una ficha de esta serie. | Meaning: shown when no connected service has an entry for the anime (no AniList / MyAnimeList ID), not when none “tracks” it; English, French and German fixed the same way. Term sheet: entry = *ficha* |

Code fixes that change how this catalog is displayed:

- Netflix history import: the “Mostrar más” button of a Netflix profile in this language is recognized (label checked by the reviewer on Netflix’s help article 101917 in this language): such an import no longer stops after the first rows as if the history were complete.
- The signed delays of the Schedule tooltips (`agenda.estimate.*`) now use `time.countdown.*`: “+1 h 30 min”.
- Lists of names in `{services}` and `{titles}` use the language’s own conjunction (`Intl.ListFormat`) instead of “, ”.

Layout (`npm run test:i18n-layout`), fixed in the components without changing the text: `page.action.DROPPED`, `page.action.COMPLETED` (side panel at 320 px): the icons are hidden when the side panel is narrow.

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). The singular `_one` names the entry's only episode.

| Key | Text |
|---|---|
| `sync.beyondEntry_one` | El episodio {progress} supera el único episodio de la ficha |
| `sync.beyondEntry_other` | El episodio {progress} supera los {count} episodios de la ficha |

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | No se ha reconocido el botón «Mostrar más» en el idioma de tu perfil de Netflix: solo se han leído los episodios más recientes. Pon ese perfil en el mismo idioma que SyncKai en Netflix y vuelve a leer el historial. |

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video (solo anime) |
| `settings.prime.label` | Sincronizar en Prime Video |
| `settings.prime.helpOff` | Solo se sincronizan animes (género anime, o animación con audio japonés o con el título exacto de AniList). Tu navegador pedirá acceso a primevideo.com |
| `settings.prime.helpOn` | SyncKai solo lee lo que la página de Prime Video ya recibe. En una pestaña de Prime Video que ya estuviera abierta, el seguimiento empieza en el siguiente episodio |
| `settings.prime.denied` | Acceso a primevideo.com denegado: Prime Video sigue desactivado |
| `settings.prime.disabled` | Prime Video desactivado: recarga las pestañas de Prime Video abiertas para detenerlo del todo |
| `settings.prime.error` | No se ha podido cambiar el acceso a Prime Video, inténtalo de nuevo |

| Key | Text |
|---|---|
| `onboarding.intro` | Mira tus animes en Crunchyroll o ADN (Netflix, Disney+ y Prime Video opcionales): SyncKai actualiza tu lista al final de cada episodio. |
| `watching.tip` | Netflix, Disney+, Prime Video (opcionales) y tu plataforma preferida se configuran en {path}. |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | Coincide con la plataforma: {signals} |
| `match.signalsContradict` | No coincide con la plataforma: {signals} |
| `match.yearRemake` | Remake identificado por su año de estreno ({year}) |
| `match.signal.year` | año de estreno |
| `match.signal.episodes` | número de episodios |
| `match.signal.duration` | duración de los episodios |
| `match.signal.format` | formato (película o serie) |
| `match.signal.country` | país de origen |
| `match.signal.originalTitle` | título original |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | La asociación guardada no coincide con la plataforma: {signals} |

## 2026-10-14 · Matching diagnostic (development builds only)

New keys `settings.matchDiag.*` (Settings › Help & about, section shown only in development builds, never in the published extension): the last 50 AniList matching decisions, a « Copy » button per row (one decision as JSON, for the test corpus) and a « Clear » button. `{count}` follows a label and a colon (no plural form); `JSON` is a format name. Terms from this language's term sheet (match, entry). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.title` | Diagnóstico de asociaciones |
| `settings.matchDiag.text` | Solo en builds de desarrollo: las 50 últimas decisiones de asociación con AniList, de la más reciente a la más antigua, guardadas hasta cerrar el navegador. Copia una en JSON para añadirla al corpus de pruebas. |
| `settings.matchDiag.empty` | Aún no se ha registrado ninguna decisión |
| `settings.matchDiag.copy` | Copiar |
| `settings.matchDiag.copyTitle` | Copiar esta decisión en JSON |
| `settings.matchDiag.copied` | Copiada |
| `settings.matchDiag.copyFailed` | No se ha podido copiar la decisión. |
| `settings.matchDiag.clear` | Borrar |
| `settings.matchDiag.candidates` | Candidatos: {count} |
| `settings.matchDiag.noEntry` | Ninguna ficha |

## 2026-10-15 · Debug trace (development builds only)

New keys `settings.debugTrace.*` (Settings › Help & about, section shown only in development builds, never in the published extension, below the matching diagnostic): a timeline of what the extension did (pages, service worker, AniList and MyAnimeList requests), a verbose switch, a category filter (category names stay in English: technical identifiers), « Copy trace » (the whole trace as JSON) and the « Clear » button of the matching diagnostic (`settings.matchDiag.clear`, reused). `{count}` and `{max}` follow a label and a colon (no plural form) and arrive formatted for the language; `JSON` is a format name; `service worker` kept as the browser's technical term. New terms added to this language's term sheet (debug trace, event, verbose mode); other terms from it (account). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.debugTrace.title` | Traza de depuración |
| `settings.debugTrace.text` | Solo en builds de desarrollo: el recorrido de lo que hizo SyncKai en las páginas, en el service worker y con AniList y MyAnimeList, de lo más reciente a lo más antiguo, guardado hasta cerrar el navegador. No se registra ningún token, cookie ni identificador de cuenta. Copia toda la traza en JSON para compartirla al informar de un problema. |
| `settings.debugTrace.empty` | Aún no hay ningún evento registrado |
| `settings.debugTrace.copy` | Copiar traza |
| `settings.debugTrace.copied` | Copiada |
| `settings.debugTrace.copyFailed` | No se pudo copiar la traza. |
| `settings.debugTrace.verbose` | Modo detallado (todas las líneas del registro) |
| `settings.debugTrace.count` | Eventos: {count} / {max} |
| `settings.debugTrace.allCategories` | Todas las categorías |
| `settings.debugTrace.filterAria` | Filtrar eventos por categoría |

## 2026-10-16 · Matching diagnostic: Copy all (development builds only)

New keys in the « Matching diagnostic » section (Settings › Help & about, development builds only, never in the published extension, now collapsed by default behind its title): « Copy all » copies every recorded decision as one JSON array, next to « Clear »; its label becomes « Copied » (`settings.matchDiag.copied`, reused) and a failure reuses `settings.matchDiag.copyFailed`. `JSON` is a format name. Same word for « decision » as `settings.matchDiag.copyTitle`, in the plural; other terms from this language's term sheet. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.copyAll` | Copiar todo |
| `settings.matchDiag.copyAllTitle` | Copiar todas las decisiones en JSON |

## 2026-10-16 · Episode guards (« To check » reasons)

New reasons on a « To check » card (`fix/episode-guards`, audit SEC-01): a sync that would jump straight to the last episode from far behind, and episodes reported as finished in a burst, now wait for the user instead of being written. Same « to check » term as `match.otherSeriesExcluded`, same episode wording as `sync.beyondEntry_*`; `{from}` and `{progress}` are episode numbers. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `sync.review.finaleJump` | Salto directo al último episodio ({progress}) desde el episodio {from}: por revisar |
| `sync.review.burst` | Muchos episodios terminados en pocos minutos: por revisar |

## 2026-10-17 · Status bar (popup and side panel)

New texts of the status bar shown at the bottom of the popup and, now, of the side panel (`feature/ui-status-bar`): a synced episode or a count of synced episodes under the series title, shown until the user hides it (« Seen, hide », a × button label), and the history import running, ready to confirm and done. Same words as this language's term sheet: *sincronizado* (sync), *serie* (series, feminine agreement: *actualizada*), *Ep.* / *episodio* (episode), *Importación* (import, as `crImport.apply.done` « Importación terminada »), *por confirmar* (preview to confirm, parallel to *por revisar*) and *Ocultar* (hide, as `settings.mappings.hide`). ` · ` and ` / ` kept; `{platform}` is a brand name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `footer.dismiss` | Visto, ocultar |
| `footer.importDone_one` | Importación terminada · {count} serie actualizada |
| `footer.importDone_other` | Importación terminada · {count} series actualizadas |
| `footer.importProgress` | Importación de {platform} · {done} / {total} |
| `footer.importReady_one` | Importación lista · {count} serie por confirmar |
| `footer.importReady_other` | Importación lista · {count} series por confirmar |
| `footer.syncedEpisode` | Ep. {episode} sincronizado |
| `footer.syncedEpisodes_one` | {count} episodio sincronizado |
| `footer.syncedEpisodes_other` | {count} episodios sincronizados |

## 2026-10-17 · Account menu (status bar)

New texts of the account menu that opens above the AniList / MyAnimeList logo of the status bar (popup and side panel): the logo button's label (also when the session expired), the connection status line, three stat tiles (anime count, episodes watched, days watched, each number shown above its short label), the « Synced this week » row with its tooltip and value, and « View my profile ». Following this language's term sheet, used **cuenta**, **conectada** (as `settings.account.connected`), **sesión caducada** (`common.sessionExpired`), the short noun **sincros** of the term sheet for the narrow row label, **episodio**; plural **animes**; « vistos » agrees with *días*; « day » is **d**, as `time.countdown.days`. ` · ` kept; `{service}` is a brand name, `{name}` the user's AniList / MyAnimeList user name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `accountMenu.connected` | Conectada |
| `accountMenu.connectedAs` | {name} · conectada |
| `accountMenu.label` | Cuenta de {service} |
| `accountMenu.labelExpired` | Cuenta de {service}, sesión caducada |
| `accountMenu.profile` | Ver mi perfil |
| `accountMenu.stats.anime_one` | anime |
| `accountMenu.stats.anime_other` | animes |
| `accountMenu.stats.days_one` | visto |
| `accountMenu.stats.days_other` | vistos |
| `accountMenu.stats.daysValue` | {days} d |
| `accountMenu.stats.episodes_one` | episodio |
| `accountMenu.stats.episodes_other` | episodios |
| `accountMenu.week.label` | Sincros esta semana |
| `accountMenu.week.title` | Episodios sincronizados por SyncKai esta semana |
| `accountMenu.week.value_one` | {count} episodio |
| `accountMenu.week.value_other` | {count} episodios |

## 2026-10-17 · Settings redesign (Preact): new and changed keys

New texts of the redesigned Settings (Preact): the Platforms and Display categories, the screen-reader names of the back button and of the category card, the row summaries of the Settings home, the Keyboard section of Display, the two sections of Shortcuts, and the section titles and notes of Accounts. Changed: `settings.cat.notifications` (now the single word: the Schedule options moved to Platforms), `settings.summary.connected` (a word instead of ✓), `settings.summary.paused` (now a standalone, capitalised summary), `settings.summary.version` (a word instead of « v »), `settings.entry.help` (the « both accounts connected » condition moved to `settings.entry.unavailable`). Summaries are joined with ` · ` by the code; `settings.account.expiredHelp` and `settings.account.otherStillSynced` are joined as two sentences. The Display summary reuses `settings.section.language`, `settings.section.panel` and `settings.shortcuts.pointer`; the My data summary the history import and backup words; the player summary `settings.player.label`. Category **Avisos**: the umbrella word of the old « Avisos y calendario » (on-page *notificaciones* and *avisos de estreno*). **conectada** agrees with *cuenta*, as `settings.account.connected`; **activa / activas** agree with *plataformas*; the player summary is « preferida: {player} » (term sheet: *plataforma preferida*). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.cat.notifications` | Avisos |
| `settings.cat.platforms` | Plataformas |
| `settings.cat.display` | Visualización |
| `settings.backToAria` | Volver a {page} |
| `settings.group.categories` | Categorías |
| `settings.summary.connected` | {service} conectada |
| `settings.summary.notConnected` | {service} sin conectar |
| `settings.summary.bothConnected` | AniList y MyAnimeList conectadas |
| `settings.summary.auto` | Automática |
| `settings.summary.paused` | En pausa |
| `settings.summary.platforms_one` | {count} de {total} activa |
| `settings.summary.platforms_other` | {count} de {total} activas |
| `settings.summary.player` | preferida: {player} |
| `settings.summary.display` | Idioma, panel lateral, atajos de teclado |
| `settings.summary.data` | Importar un historial · copia de seguridad |
| `settings.summary.version` | Versión {version} |
| `settings.summary.noErrors` | sin errores |
| `settings.display.keyboard` | Teclado |
| `settings.display.shortcutsHelp` | Teclas para marcar un episodio o abrir el panel |
| `settings.shortcuts.duringPlayback` | Durante la reproducción |
| `settings.shortcuts.navigation` | Navegación |
| `settings.accounts.lists` | Listas sincronizadas |
| `settings.accounts.both` | Con las dos cuentas |
| `settings.accounts.privacy` | Inicias sesión en la web de AniList o MyAnimeList: SyncKai nunca ve tu contraseña. |
| `settings.account.expiredHelp` | Tus episodios ya no se envían a {service} hasta que vuelvas a conectarte. |
| `settings.account.otherStillSynced` | {service} se sigue actualizando. |
| `settings.entry.help` | Se abre al hacer clic en el título o la portada de un anime |
| `settings.entry.unavailable` | Disponible cuando las cuentas de AniList y MyAnimeList están conectadas. |

## 2026-10-17 · Settings › Sync, Matches and Excluded series (Preact)

New texts of the redesigned Sync settings page and of its two sub-pages (Matches, Excluded series), moved out of My data: section titles « Automatic » / « Per series », the descriptions of the two « Episode counted as watched » cards, the « Per series » rows, the Matches intro, search, empty and no-result texts, « Show N more on {platform} », the four origin badges and their legend, the Excluded series section, note, empty hint and the « {year} series · excluded on {date} » fragments. Changed: `settings.trigger.legend` (« Episode counted as watched », where the old text was only « Episode watched »), `settings.trigger.credits` (« (recommended) » moved to `settings.trigger.creditsHelp`), and the paths of `popup.syncDisabledDetail` / `review.excludeTitle` (now nav.settings › settings.section.sync › settings.section.exclusions, built from this catalog's own titles). Removed: `settings.mappings.count_*`, `settings.mappings.help`, `settings.mappings.manage`. `{action}` is the « Re-enable » button (`settings.exclusions.help`) or the « Stop syncing this series » menu item (`settings.exclusions.emptyHelp`), so the quoted labels always match. The match / entry / excluded / re-enable words reuse this catalog's existing terms (`settings.section.mappings`, `settings.mappings.entryFallback`, `settings.section.exclusions`, `settings.exclusions.reactivate`). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.section.automatic` | Automática |
| `settings.section.perSeries` | Por serie |
| `settings.trigger.legend` | Episodio contado como visto |
| `settings.trigger.credits` | Al empezar los créditos |
| `settings.trigger.creditsHelp` | Recomendado: el momento exacto que indica la plataforma |
| `settings.trigger.percentageHelp` | También se usa cuando no se conocen los créditos |
| `settings.sync.mappingsRow` | Asociaciones guardadas |
| `settings.sync.mappingsRowHelp` | La temporada de AniList elegida para cada serie |
| `settings.sync.exclusionsRowHelp` | Nunca se sincronizan, se pueden reactivar aquí |
| `settings.mappings.intro_one` | {count} serie guardada, ordenada por plataforma: la temporada de la plataforma → la ficha de AniList donde escribe SyncKai. Al olvidar una asociación, se recalcula en el próximo episodio. |
| `settings.mappings.intro_other` | {count} series guardadas, ordenadas por plataforma: la temporada de la plataforma → la ficha de AniList donde escribe SyncKai. Al olvidar una asociación, se recalcula en el próximo episodio. |
| `settings.mappings.search` | Buscar una serie o una ficha |
| `settings.mappings.noResult` | Ninguna asociación para «{query}» |
| `settings.mappings.noResultHelp` | Busca por título de la serie o de la ficha de AniList. |
| `settings.mappings.emptyHelp` | SyncKai guarda una por cada temporada sincronizada. |
| `settings.mappings.showMore_one` | Ver {count} más en {platform} |
| `settings.mappings.showMore_other` | Ver {count} más en {platform} |
| `settings.mappings.origin.chosen` | Elegida por ti |
| `settings.mappings.origin.learned` | Aprendida |
| `settings.mappings.origin.unmarked` | Antigua |
| `settings.mappings.origin.unverified` | Importada · por revisar |
| `settings.mappings.origin.chosenHelp` | Confirmada o elegida por ti: nunca se cuestiona. |
| `settings.mappings.origin.learnedHelp` | Encontrada por SyncKai: se recalcula si la plataforma la contradice. |
| `settings.mappings.origin.unmarkedHelp` | Guardada antes de la 2.4: se conserva y se revisa si se contradice. |
| `settings.mappings.origin.unverifiedHelp` | Viene de una copia de seguridad: se revisa la primera vez que se usa. |
| `settings.mappings.originLegend` | Origen de las asociaciones |
| `settings.exclusions.section` | Nunca sincronizadas |
| `settings.exclusions.help` | Una serie excluida no se vuelve a sincronizar nunca, en ninguna temporada. «{action}» la vuelve a seguir desde el próximo episodio. |
| `settings.exclusions.emptyHelp` | Para dejar de sincronizar una serie, elige «{action}» en su menú «⋯». |
| `settings.exclusions.seriesYear` | serie de {year} |
| `settings.exclusions.excludedOn` | excluida el {date} |
| `popup.syncDisabledDetail` | Se puede reactivar en Ajustes › Sincronización › Series excluidas |
| `review.excludeTitle` | Excluye la serie (todas las temporadas): se puede reactivar en Ajustes › Sincronización › Series excluidas |

## 2026-10-17 · Settings › Platforms and Notifications (Preact)

Texts of the redesigned Platforms page (list of sites with « Included » / « Access missing » or a switch, preferred player dropdown, estimated release time per platform with − / + buttons, moved there from the Schedule card) and Notifications page (« On the playback page » style cards and « New episodes »). New: `settings.platforms.where`, `settings.platforms.allAnime`, `settings.platforms.included`, `settings.platforms.accessMissing`, `settings.platforms.note`, `settings.player.openOn`, `settings.player.enableFirst`, `settings.offsets.earlier`, `settings.offsets.later`, `settings.notif.legend`. Changed: `settings.player.help`, `settings.offsets.title`, `settings.offsets.help`, `page.platformOff`, `settings.section.notifications`, `settings.notif.discreet.desc`, `settings.notif.detailed.desc`, `settings.notif.alertsOnly.desc`, `settings.notif.alertsAlways`, `settings.delay.title`, `settings.airing.enableFirst` (the notification descriptions now describe the pill and the bubble, « Extra delay » replaces « Delay », the release-time help says the alerts use it too, « Turn on alerts… » is now visible text). `page.platformOff` keeps its sentence; only the path changed, from « Settings › Playback & sync » to nav.settings › settings.cat.platforms of this catalog. Removed: `settings.section.playback`, `settings.netflix.section`, `settings.netflix.label`, `settings.disney.section`, `settings.disney.label`, `settings.prime.section`, `settings.prime.label`, `settings.airing.label`, `settings.airing.help`, `settings.section.agenda`. The Schedule word, « Open », the release-alert name and the minute unit reuse this catalog's `panel.tab.agenda`, `common.open`, `settings.quick.airing.label` and `settings.offsets.unit`. « Incluida » agrees with « plataforma »; the discreet pill keeps « notificación », as before. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.platforms.where` | Dónde sigue SyncKai tus episodios |
| `settings.platforms.allAnime` | Todos los animes |
| `settings.platforms.included` | Incluida |
| `settings.platforms.accessMissing` | Sin acceso |
| `settings.platforms.note` | Al activar una plataforma se pide acceso a su web. Solo se leen las páginas de reproducción y de series. |
| `settings.player.openOn` | Abrir episodios en |
| `settings.player.enableFirst` | Actívala primero |
| `settings.player.help` | Se usa en «Abrir» cuando un anime está en varias plataformas activas. |
| `settings.offsets.title` | Hora de estreno estimada |
| `settings.offsets.help` | Tras la emisión en Japón. La usan el Calendario y los avisos; cada serie se ajusta desde su fila en el Calendario. |
| `settings.offsets.earlier` | {minutes} min antes |
| `settings.offsets.later` | {minutes} min después |
| `page.platformOff` | {platform} está desactivado: SyncKai no sigue nada aquí. Para reactivarlo: Ajustes › Plataformas. |
| `settings.section.notifications` | En la página de reproducción |
| `settings.notif.legend` | Estilo de las notificaciones en la página |
| `settings.notif.discreet.desc` | Una pequeña notificación durante unos segundos, en una esquina del vídeo |
| `settings.notif.detailed.desc` | Una burbuja con el episodio y el resultado en AniList y MyAnimeList |
| `settings.notif.alertsOnly.desc` | Nada si todo va bien; una burbuja solo ante un error o un episodio por revisar |
| `settings.notif.alertsAlways` | Un error o una serie por revisar se muestran siempre, sea cual sea el estilo. |
| `settings.delay.title` | Retraso extra |
| `settings.airing.enableFirst` | Activa los avisos para comprobar los estrenos |

## 2026-10-17 · Settings › My data, AniList ↔ MAL differences, Help & about (Preact)

Texts of the redesigned My data page (one « Import a watch history » card, Backup card, « Compare » row opening the AniList ↔ MyAnimeList differences page, which moved there from the popup's Activity screen) and Help & about page (diagnostic report row, error log that unfolds, About card with What's new / Privacy / Source code links). New: `settings.import.title`, `settings.section.compare`, `settings.compare.title`, `settings.compare.help`, `settings.data.perSeries`, `compare.align`, `compare.bulk.help`, `compare.job.background`, `settings.help.diagnostic`, `settings.help.diagnosticHelp`, `settings.help.journalNote`, `settings.about.whatsNew`, `settings.about.privacy`. Changed: `settings.crImport.help`, `settings.backup.help`, `settings.backup.import`, `settings.help.copy`, `settings.about.source` (import help in two sentences, backup help « in one file », « Import » without ellipsis, « Copy the report » next to the new « Diagnostic report » title, « Source code » with « GitHub » on the right). `help.issue.body` keeps its text; only its last-line path changed, to nav.settings › settings.cat.help › settings.help.copy of this catalog. The compare.* texts are unchanged: their context notes now point to Settings › My data. Removed: `settings.section.import`, `settings.backup.crImportTitle`, `settings.crImport.openAria`, `settings.help.text`, `settings.help.copyTitle`, `settings.help.clearHelp`, `settings.help.reportTitle`. The version line reuses `settings.summary.version`, the « Clear » button `settings.matchDiag.clear`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.import.title` | Ponte al día con lo que ya has visto |
| `settings.crImport.help` | Crunchyroll, ADN o Netflix. Verás una vista previa antes de que se escriba nada. |
| `settings.backup.help` | Ajustes, asociaciones, series excluidas e historial en un archivo. Nunca tus sesiones de AniList o MyAnimeList. |
| `settings.backup.import` | Importar |
| `settings.section.compare` | Comparar |
| `settings.compare.title` | Diferencias AniList ↔ MyAnimeList |
| `settings.compare.help` | Compara tus dos listas e iguálalas en el sentido que elijas |
| `settings.data.perSeries` | Las asociaciones y las series excluidas se gestionan en {path}. |
| `compare.align` | Igualar |
| `compare.bulk.help` | «{action}» copia AniList en MyAnimeList; antes, una confirmación detalla los cambios. |
| `compare.job.background` | Sigue aunque cierres esta página. |
| `settings.help.diagnostic` | Informe de diagnóstico |
| `settings.help.diagnosticHelp` | Para pegarlo en un aviso de error: versión, navegador, ajustes, últimos errores. Sin tokens ni cuentas. |
| `settings.help.copy` | Copiar informe |
| `settings.help.journalNote` | Los 50 últimos como máximo, del más reciente al más antiguo; tokens ya ocultos. |
| `settings.about.whatsNew` | Novedades |
| `settings.about.privacy` | Privacidad |
| `settings.about.source` | Código fuente |

## 2026-10-17 · Popup « My series » row menu (Preact)

The row « … » menu of the popup's « My series » list and of the « Continue » card now groups the entry links and the platform searches in two sub-menus. New: `watching.menu.openEntry` (sub-menu entry, its items are the bare AniList / MyAnimeList names; wording taken from `page.openOn` without « on {service} »), `watching.menu.searchOn` (sub-menu entry, its items are the bare platform names; wording taken from `watching.searchOn`, ending with « … »). Changed: `settings.entry.help`, which now also says that « Default entry page » picks the list shown in « My series » (quoted with the exact `watching.mySeries` of this catalog). The « −1 episode » item left the menu (the row has its own −), `watching.minusOne` stays for the « On this page » card. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `watching.menu.openEntry` | Abrir la ficha |
| `watching.menu.searchOn` | Buscar en… |
| `settings.entry.help` | Se abre al hacer clic en el título o la portada de un anime; también elige la lista de «Mis series» |



## 2026-10-17 · Popup « On this page » card (Preact)

The popup's « On this page » card was redesigned: the Hold / Drop / Done row and the AniList / MAL links moved to the card's « … » menu (shared with « My series »), and the season dropdown, the star rating and the comment moved to a foldable « Details » section. New: `page.currentStatus` (grey mention at the end of the menu item of the series' current status), `page.details` (foldable button listing what the section holds, same nouns as `page.seasonPicker`, the rating words of `rating.*` and `notes.title`), `page.seasonOnAniList` (title above the season dropdown), `page.seasonHelp` (help under it on an episode page; the match word is the one of `settings.section.mappings`), `page.yourRating` (title above the stars). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `page.currentStatus` | Estado actual |
| `page.details` | Detalles: temporada, nota, comentario |
| `page.seasonOnAniList` | Temporada en AniList |
| `page.seasonHelp` | Cambiar de temporada corrige la asociación para los próximos episodios. |
| `page.yourRating` | Tu nota |


## 2026-10-17 · Popup « Activity » tab (Preact)

The popup's Activity tab was redesigned: failed and pending syncs are now two sections, and every section heading is an uppercase label followed by « · {count} » added by the code. New: `queue.failedHeading` (same failure word as `queue.failed`), `queue.pendingHeading` (syncs waiting for a retry, wording of the former `queue.sectionTitle`), `ratings.heading` (the former `ratings.sectionTitle` without its count). The « To check » heading now reuses `inline.toCheck`. Removed: `queue.section`, `queue.sectionTitle`, `ratings.section`, `ratings.sectionTitle`, `review.title`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `queue.failedHeading` | Fallidas |
| `queue.pendingHeading` | En espera |
| `ratings.heading` | Por puntuar |


## 2026-10-17 · Side panel « Now playing » (Preact)

The side panel's « Now playing » tab was redesigned as cards: « You're watching » (live playback: bar, credits marker, countdown, sync state with an icon), « Your list » (status chip, « Progress » and the stepper, one line per account, the series « … » menu shared with the popup: Hold / Drop / Done moved there), then foldable sections « Rating and comment », Synopsis, related entries and Discussions. New: `panel.nowPlaying.watching` (heading of the live card, addresses the user), `panel.nowPlaying.list` (heading of the list card, same « your list » words as `page.notInList`), `panel.nowPlaying.ratingNotes` (section title, same nouns as `page.yourRating` and `notes.title`), `panel.live.creditsAt` and `panel.live.creditsUnknown` (legend of the yellow marker under the bar, credits word of `settings.trigger.credits`), `panel.live.countdownCredits` and `panel.live.countdownRatio` (countdown line, wording of the former `panel.live.countdown` plus what the sync waits for, as in `settings.trigger.credits` / `settings.summary.percentage`). Changed: `panel.live.synced` lost its trailing « ✓ » (a check icon now precedes it). The « Progress » label reuses `compare.filter.progress`. Removed: `page.action.COMPLETED`, `page.action.DROPPED`, `page.action.PAUSED` (the status button row is gone), `panel.live.countdown`, `panel.nowPlaying.progress`, `watching.nextWatched`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `panel.nowPlaying.watching` | Estás viendo |
| `panel.nowPlaying.list` | Tu lista |
| `panel.nowPlaying.ratingNotes` | Nota y comentario |
| `panel.live.creditsAt` | Créditos en {time} |
| `panel.live.creditsUnknown` | Créditos desconocidos · sincro al {percent} % |
| `panel.live.countdownCredits` | Sincro en {time} · al empezar los créditos |
| `panel.live.countdownRatio` | Sincro en {time} · al {percent} % del episodio |
| `panel.live.synced` | Sincronizado |


## 2026-10-17 · Side panel Schedule (Preact) and week picker

The Schedule tab of the side panel was redesigned: days in order with « No episode » on empty days, episode lines « 18:00 Crunchyroll · Japan 17:00 » (the platform time first, the Japanese broadcast last and cut first), a « ⋯ » menu with « Adjust time » (its second line gives the time and whether the delay is the series' own or the default), « Open the entry › » and « Search on… › », and a week button that opens a month calendar. New: `agenda.adjust.custom` and `agenda.adjust.default` (second line of « Adjust time », lower case after « · »), `agenda.adjust.platform` (first sentence of `agenda.estimate.title`, shown in the delay editor), `agenda.picker.label`, `agenda.picker.prevMonth`, `agenda.picker.nextMonth`, `agenda.picker.thisWeek`, `agenda.picker.hint` (month calendar; the hint names the arrow keys and the Enter key). Changed: `agenda.jp` writes the country name instead of « JP » (unchanged where it already did: ja, ko, zh-CN, zh-TW). Removed: `watching.searchOn` (the search entries are now the platform names of the « Search on… › » sub-menu). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `agenda.jp` | Japón {time} |
| `agenda.adjust.custom` | ajustado para esta serie |
| `agenda.adjust.default` | retraso por defecto |
| `agenda.adjust.platform` | Estreno estimado en {platform}: emisión en Japón {offset}. |
| `agenda.picker.label` | Elegir una semana |
| `agenda.picker.prevMonth` | Mes anterior |
| `agenda.picker.nextMonth` | Mes siguiente |
| `agenda.picker.thisWeek` | Esta semana |
| `agenda.picker.hint` | ↑ ↓ para cambiar de semana, Intro para mostrarla. |

## 2026-10-18 · History import page, steps 1 to 3 (Preact)

The history import page (steps 1 to 3) was redesigned: a 5-step indicator under the title (Platform, Reading, Analysis, Preview, Import), one tile per platform with the state of its tab (ready, no tab open, waiting for the tab, access to grant), the rules in a « How it works » card (its title reuses `onboarding.howItWorks`), and the Netflix reading card listing its three steps (done with a check, current with a bar, next ones greyed). New: `crImport.steps` (screen readers only), `crImport.step.*` (one word each: the five steps share one line at 576 px), `crImport.tile.*` (status line of a tile, no platform name), `crImport.netflix.heading`, `crImport.netflix.rowsDone` (step done: same wording as `crImport.netflix.rows` without the ellipsis), `crImport.netflix.titlesNext` and `crImport.netflix.showsNext` (steps not started yet: same wording as `crImport.netflix.titles` / `.shows` without the counts). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.steps` | Pasos |
| `crImport.step.platform` | Plataforma |
| `crImport.step.reading` | Lectura |
| `crImport.step.analysis` | Análisis |
| `crImport.step.preview` | Vista previa |
| `crImport.step.import` | Importación |
| `crImport.tile.ready` | Pestaña lista |
| `crImport.tile.none` | Ninguna pestaña abierta |
| `crImport.tile.access` | Acceso por permitir |
| `crImport.tile.waiting` | Esperando a la pestaña… |
| `crImport.netflix.heading` | Leyendo tu historial de Netflix |
| `crImport.netflix.rowsDone` | Historial de Netflix cargado (filas: {rows}) |
| `crImport.netflix.titlesNext` | Buscar animes en AniList |
| `crImport.netflix.showsNext` | Leer tu progreso en Netflix (series conservadas) |

## 2026-10-18 · History import page, steps 4 and 5, and Backup page (Preact)

Steps 4 and 5 of the history import page and the Backup page were redesigned. The preview summary is now a row of tiles, each with its number above a label: `crImport.summary.*` are those labels without the number (they replace `crImport.preview.toUpdate`, `.review`, `.upToDate`, `.excluded`, `.ignored` and `.failed`, removed; same wording without `{count}`). The « Update N series » button has a muted hint on its left (`crImport.preview.hint.*`: a line left unchecked, none checked, locked during the import, what stays checked after a stopped or failed import). Each « To check » season shows the entry its check card will propose (`crImport.review.proposed`, a small badge) and the other entries to choose from (`crImport.review.alternatives`, `{titles}` = a localized list). The Backup page's Export card lists what the file contains and never contains (`import.included`, `import.neverIncluded`, `import.includes.*`, reusing the words of `import.summary.*` and `import.intro`); the Import card titles the file table (`import.fileContents`) and shows the export date under the file name (`import.exportedAt`, replaces `import.exportedOn`, removed: same text without the leading ` · `). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.summary.toUpdate_one` | serie por actualizar |
| `crImport.summary.toUpdate_other` | series por actualizar |
| `crImport.summary.review_one` | por revisar |
| `crImport.summary.review_other` | por revisar |
| `crImport.summary.upToDate_one` | ya al día |
| `crImport.summary.upToDate_other` | ya al día |
| `crImport.summary.excluded_one` | excluida |
| `crImport.summary.excluded_other` | excluidas |
| `crImport.summary.ignored_one` | título omitido (no es anime) |
| `crImport.summary.ignored_other` | títulos omitidos (no son animes) |
| `crImport.summary.failed_one` | no encontrada (error) |
| `crImport.summary.failed_other` | no encontradas (error) |
| `crImport.preview.hint.unchecked` | Una línea desmarcada no se escribe. |
| `crImport.preview.hint.none` | Marca al menos una serie. |
| `crImport.preview.hint.locked` | Casillas y botones bloqueados hasta que termine la importación. |
| `crImport.preview.hint.stopped` | Las series aún no escritas siguen marcadas. |
| `crImport.preview.hint.failed` | Las series fallidas siguen marcadas. |
| `crImport.review.proposed` | propuesta |
| `crImport.review.alternatives` | También a elegir: {titles} |
| `import.included` | Incluido |
| `import.neverIncluded` | Nunca incluido |
| `import.includes.settings` | Ajustes |
| `import.includes.matches` | Asociaciones y series excluidas |
| `import.includes.history` | Historial: sincros recientes, episodios por revisar, series por puntuar, revisionados rechazados |
| `import.includes.signIns` | Tus sesiones de AniList / MyAnimeList |
| `import.fileContents` | Contenido del archivo |
| `import.exportedAt` | exportado el {date} (v{version}) |
