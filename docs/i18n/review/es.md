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
