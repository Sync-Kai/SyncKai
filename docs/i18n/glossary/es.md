# Spanish (Spain) term sheet — `es`

Binding for every change to `src/i18n/locales/es.json` and `public/_locales/es/messages.json`. Spain Spanish, not neutral: Latin American Spanish lives in `es-419` and has its own sheet. Shared rules: [`../GLOSSARY.md`](../GLOSSARY.md).

## 1. Core concepts

| English term | Spanish (Spain) | Reason / usage notes |
|---|---|---|
| Watching (status) | Viendo | What Spanish-speaking AniList / MyAnimeList users write for the status. Gerund, no gender agreement. In sentences, "series in progress / being watched" = « series que estás viendo » (« Aún no estás viendo ninguna serie »), never « en curso », which reads as "currently airing". |
| Completed (status) | Completado | Tracker term (« lo tengo en completados »). Status chips use the masculine label; a participle that describes the series agrees with *serie*: « Frieren: completada », « (completada) », « Marcar como completada ». Never used for a series that stopped airing (that is *Finalizada*). |
| On hold (status) | En pausa | AniList "Paused" / MAL "On-Hold". Not used for the airing hiatus (*En hiato*) nor for a paused video (*Vídeo en pausa*). |
| Dropped (status) | Abandonado | Standard term (fans also say *dropeado*, too slangy). Participle for the series: *abandonada*. The verb *abandonar* is reserved for dropping a series: a pending sync is *descartada*, never *abandonada*. |
| Plan to watch (status) | Pendiente | The Spain word for a watchlist (« mis pendientes »). Quoted as a list name in buttons: Añadir a «Pendiente», Añadida a «Viendo». Because of it, a pending sync is *en espera*, never *pendiente*. |
| Rewatching (status) | Reviendo | Parallel to *Viendo*; understood by every fan. |
| Watching (popup tab `nav.watching`) | Viendo | Same word as the status. |
| Activity (popup tab `nav.activity`) | Actividad | Quoted as « (Actividad) », « en Actividad ». |
| series | serie (f.), pl. series | Feminine: every adjective / participle about a series agrees (*excluida, completada, abandonada, añadida, quitada, omitida, actualizada*). « anime » (m., pl. *animes*) is used only where the English says *anime*. |
| season | temporada | « Temporada 2 », « parte 1/2 ». |
| arc | arco | |
| episode | episodio (m.) | Short form before a number: « Ep. 5 » at the start of a label, « ep. 5 » inside a line; plural count chip « 12 eps. »; « 12 ep. » where the text is not plural-aware. |
| list | lista | « tu lista », « tus listas » (the user's AniList / MAL list, never a playlist). |
| entry | ficha (f.) | The anime's page on AniList / MyAnimeList (« la ficha de AniList »). « Abrir la ficha en AniList ». |
| sync (noun) | sincronización; short form *sincro* (f., pl. *sincros*) | *sincro* is the everyday Spain clipping and fits the tiny UI: chips, footer, status lines, headings of lists (« Sincros en espera », « Últimas sincros », « Sincro en 2 min »). A single sync item is always *sincro*: « Esta sincro ya no existe. », « Sincro no encontrada. », « Descartar la sincro de… ». The full word is kept only for the process in fixed formal phrases: « Error de sincronización », « excluida de la sincronización », « Error inesperado durante la sincronización », settings section « Sincronización ». |
| to sync / synced / syncing | sincronizar / sincronizado / Sincronizando… | « Todo sincronizado », « Sincronizado ✓ ». |
| Auto sync | Sincro automática | Same wording in Settings, the in-page toast and the side panel (« Sincro automática en pausa »). |
| Stop syncing / Resume syncing | No sincronizar / Volver a sincronizar | « No sincronizar esta serie » (menu), « Dejar de sincronizar {title} » (screen readers), « Reactivar » for the excluded-series button. |
| to check (`review.*`, `footer.toReview`) | por revisar | « Por revisar (2) », « 2 por revisar ». *Revisar* = verify, never a critique (*reseña*). The card itself is a *revisión*: « Crear 3 revisiones », « revisión creada ». |
| to rate | por puntuar; verb *puntuar* | « Por puntuar (2) », « Puntúala en Actividad. ». |
| score, rating | nota | Spain says « ¿qué nota le das? ». « Nota 8,5/10 guardada », chip « Nota AL 8 · MAL 7 ». The prompt question is « ¿Qué nota le das? » (quoted identically in Settings). |
| comment (`notes.*`) | comentario | Never *nota* (that is the score). |
| match, mapping (Settings "Matches") | asociación (f.) | Remembered season → AniList entry link: « Asociaciones », « 12 asociaciones », « Olvidar la asociación ». *Correspondencia* reads as "mail" first. Uncertain match = « asociación dudosa ». "Remembered" = *guardada* (« 12 series guardadas »), not *memorizada*. |
| match / matching (AniList ↔ MAL differences) | igualar / igualación | Copying one service's values to the other: « Igualar todo a AniList », filtered list « Igualar estas a AniList » (the series shown), « Igualando… 12 / 40 », « Igualación terminada ». Not *sincronizar* (reserved for episode sync). Per-series buttons: « Mantener AniList / MAL ». |
| excluded series | serie excluida | Settings section « Series excluidas »; chip « Excluida ». |
| pending sync, queue | sincro en espera | « Sincros en espera (2) », footer « 2 sincros en espera ». *Pendiente* is the Plan to watch status. Give up a queued sync: « Descartar ». |
| credits | créditos | End credits: « Al empezar los créditos (recomendado) », « Sincro en los créditos », summary « en los créditos ». |
| popup | ventana emergente | The window opened from the extension icon: « en la ventana emergente (Actividad) ». |
| side panel | panel lateral | Chrome's own Spanish term; also used for Firefox's sidebar. |
| Now playing (panel tab) | Reproduciendo | Usual Spanish media label for "Now playing" (13 characters, fits the tab). Quoted « Reproduciendo » in Settings. |
| Schedule (panel tab, `agenda.*`) | Calendario | « calendario de estrenos ». Also in the category « Avisos y calendario » and the section « Calendario ». |
| On this page (`page.*`) | En esta página | |
| preferred player | plataforma preferida | It is the streaming platform, not a media player app (*reproductor* would mislead); fits the 20-character limit. |
| history import (`crImport.*`) | importar un historial / importación | « Importar un historial », « Importación terminada ». Netflix's own page name is « Actividad de visionado », so the full form is *historial de visionado*. |
| backup (`backup.*`, `import.*`, Settings) | copia de seguridad | Standard Spain term; never *importación* (that is the history import). File name `synckai-copia-de-seguridad-{date}.json`. |
| preview | vista previa | « con vista previa », « Vista previa no encontrada ». |
| rewatch (noun) | revisionado | Spain word for watching something again (« hacer un revisionado »). The status is *Reviendo*. « Revisionado no guardado », « sin revisionado ». |
| account / connect / disconnect | cuenta / conectar / desconectar | « Conectar AniList », « Desconectar », « Sin conectar ». |
| sign in / sign-ins (tokens) | iniciar sesión / sesiones | « Inicia sesión en Netflix », « Tus sesiones de AniList/MAL nunca se incluyen ». |
| session expired | sesión caducada | Spain says *caducar* for sessions: « Sesión caducada », « La sesión de MAL ha caducado ». |
| release alerts (`airing.*`, Quick settings) | avisos de estreno | Browser notifications about new episodes: « Avisos de estreno », summaries « avisos +3 h », « sin avisos », « avisos sin retraso ». |
| alerts (in-page level `settings.notif.alertsOnly.*`) | alertas | Messages that need action: « Solo alertas ». Kept distinct from *avisos* (release alerts). |
| on-page notifications | notificaciones en la página | Levels « Discretas », « Detalladas », « Solo alertas » (agree with *notificaciones*). |
| release, airing | estreno (release on a platform), emisión (broadcast in Japan); verb *salir* | « Próximo estreno », « Emisión en Japón », « En emisión » (airing status), « cuando salga un episodio ». |
| offset, delay | retraso (alert / platform delay), desfase (episode-number offset) | « Retraso de Dandadan », Delay control « Retraso »; matches list « número mostrado, desfase de 24 ». |
| shortcut | atajo (de teclado) | « Atajos » (category), « Atajos de teclado ». Firefox's own es-ES menu item: « Administrar atajos de extensiones ». Shift key = « Mayús » (as on Spanish keyboards and in Chrome). |
| track (follow progress) | seguir | « SyncKai solo sigue los animes que reconoce AniList ». |
| Settings (`nav.settings`) | Ajustes | Short, usual in Spain. Paths: « Ajustes › Reproducción y sincro », « Ajustes › Series excluidas », « Ajustes › Ayuda ». |

### Settings structure

| English | Spanish |
|---|---|
| Quick settings | Ajustes rápidos |
| Playback & alerts (group) | Reproducción y avisos |
| Data & help (group) | Datos y ayuda |
| Accounts | Cuentas |
| Playback & sync | Reproducción y sincro |
| Settings categories of the 2026-10-17 redesign: Platforms / Notifications (`settings.cat.notifications`, one word: the Schedule options moved to Platforms) / Display; Playback & sync (`settings.cat.sync`) was removed | **Plataformas** / **Avisos** / **Visualización** |
| Shortcuts | Atajos |
| My data | Mis datos |
| Language | Idioma |
| Help & about | Ayuda e información |
| Sections: Playback / Sync / Side panel | Reproducción / Sincronización / Panel lateral |
| Sections: On-page notifications / New episodes / Schedule | Notificaciones en la página / Nuevos episodios / Calendario |
| Sections: Matches / Excluded series / Backup / Import / Danger zone | Asociaciones / Series excluidas / Copia de seguridad / Importar / Zona de peligro |
| Sections: Help / About | Ayuda / Acerca de |

## 2. Conventions

- **Register**: *tú*, friendly and direct. Imperatives in *tú* (« Inténtalo de nuevo », « Recarga la página », « Haz clic en el icono de SyncKai »).
- **Recent past**: Spain present perfect: « No se ha podido guardar… », « SyncKai se ha actualizado », « (ahí se ha guardado el episodio 5) »; no preterite (*se guardó*) for events the user still sees the effect of.
- **Retry phrasing**: standalone « Inténtalo de nuevo. »; after another action « … y vuelve a intentarlo »; tight chips « reinténtalo ».
- **Quotation marks**: Spanish angle quotes « » (Chrome's es convention, RAE first choice), no inner spaces: « Ajustar la hora », «{title}».
- **Questions and exclamations**: always opening ¿ and ¡ (« ¿Quitar de tu lista? », « ¡Has completado «Frieren»! »).
- **Colon and spacing**: no space before « : »; percentages with a space, as RAE recommends: « 85 % ».
- **Ellipsis**: the single character « … » for in-progress states and items that open something (« Sincronizando… », « Comentario… »).
- **Separators**: ` › ` and ` · ` kept exactly; « — » kept where the English has it.
- **Abbreviations**: « min », « h », « s », « d » (days, CLDR short form: « en 2 d »); « ep. »/« Ep. », « eps. »; « MB »; ordinal « n.º ».
- **Relative times**: « ahora mismo », « hace 5 min », « hace 2 h », « ayer », « hace 3 días ». They follow participles without a preposition: « Analizado hace 5 min », « Completada ayer ».
- **`{service}: {message}`**: `{service}: {message}` with lowercase fragments: « AniList: episodio 5 guardado · MyAnimeList: fallo: … ». A failure prefix before an error sentence is « fallo: » (`feedback.service.error`, `airing.status.failed`), never « error: », which would print « error: Error de MyAnimeList (503). » or « error: Error desconocido ».
- **`{title}: completed`**: « {title}: completada » (agrees with *serie*, not with the title); likewise « {title}: abandonada / en pausa / quitada de tu lista ».
- **Spain vocabulary**: *vídeo*, *archivo*, *pestaña*, *web*, *hacer clic*, *icono*, *ajustes*, *gestionar*, *introducir*, *caché*.
- **Untranslated**: product names, `JSON`, `.json`, `Redirect URL`, `App Redirect URL`, `AL`, `MAL`, `JP`, `E5`, `OVA`, `TV`, `Spin-off`.

## 3. Netflix

- "Show more" button at the bottom of netflix.com/viewingactivity: **Mostrar más** (Netflix Help Center, es-ES article on viewing activity: « Si ves una lista limitada, usa el botón Mostrar más. »).
- "Viewing activity" page: **Actividad de visionado** (same article: « Abre Actividad de visionado »).

## Development builds only

Settings › Help & about sections that exist only in development builds (2026-10-15, `settings.debugTrace.*`).

| English | Term |
|---|---|
| debug trace | traza de depuración |
| event (one line of the trace) | evento |
| verbose mode | modo detallado |

## Settings › Sync (2026-10-17)

| English | Term |
|---|---|
| Automatic (Sync section) | Automática |
| Per series (Sync section) | Por serie |
| Never synced (Excluded series section) | Nunca sincronizadas |
| Match origins: chosen / learned / legacy / imported · to recheck | Elegida por ti / Aprendida / Antigua / Importada · por revisar |

## Settings › Platforms and Notifications (2026-10-17)

| English | Term |
|---|---|
| Where SyncKai follows your episodes (section) | Dónde sigue SyncKai tus episodios |
| Included (built-in platform) | Incluida |
| Access missing | Sin acceso |
| Turn on first (preferred player option) | Actívala primero |
| Estimated release time | Hora de estreno estimada |
| Extra delay (release alerts) | Retraso extra |
| On the playback page (Notifications section) | En la página de reproducción |

## Settings › My data and Help & about (2026-10-17)

| English | Term |
|---|---|
| Compare (My data section) | Comparar |
| AniList ↔ MyAnimeList differences (row title) | Diferencias AniList ↔ MyAnimeList |
| Align (differences section) | Igualar |
| Diagnostic report (row title) | Informe de diagnóstico |
| Copy the report (button) | Copiar informe |
| What's new (About link) | Novedades |
| Privacy (About link) | Privacidad |
