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
