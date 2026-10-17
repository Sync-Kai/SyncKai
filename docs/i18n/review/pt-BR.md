# Portuguese (Brazil) (`pt-BR`) review log

Independent native review of `src/i18n/locales/pt-BR.json` (934 keys) and `public/_locales/pt_BR/messages.json`, 2026-10-14. Inputs: `docs/i18n/GLOSSARY.md`, `docs/i18n/glossary/pt-BR.md`, `docs/i18n/context.json`, `en.json`, `fr.json`, `de.json`.

Method: terminology audit (for each core English term, every key whose translation does not use the term-sheet word), key-by-key reading of all 934 keys with their context notes (meaning, grammar, register, placeholders, composed texts, cross-references, lengths), plural rendering for 0, 1, 2, 3, 5, 11, 21, 22, 25 and 101, a typography scan (straight quotes, `...`, spacing before punctuation, European-Portuguese vocabulary, *estar a* + infinitive, *excluir*, leftover English), and an audit of every article or contraction placed before `{platform}`, `{platforms}`, `{service}`, `{source}`, `{target}` against the values each key can receive. External names re-checked: Netflix “O que foi assistido” and “Mostrar mais” (help.netflix.com/pt-br/node/101917), Firefox “Gerenciar atalhos de extensões” and “Exibir/ocultar o painel lateral” (mozilla-l10n `pt-BR/toolkit/toolkit/about/aboutAddons.ftl`).

Result: the translation was already solid (consistent terms, correct *você* register, Brazilian spelling and vocabulary, no *excluir*, correct crase and platform genders). 28 keys changed in `pt-BR.json`; `messages.json` unchanged (`extDescription` 88 characters, both command texts identical to `settings.shortcuts.episode` / `settings.shortcuts.panel`). `npm run i18n:check -- pt-BR`: 0 errors, 48 length warnings (3 new ones from this review: `watching.resume`, which wraps instead of overflowing; `prompt.rewatch.failed`, a wrapping bubble title; `ratings.ignoreAria`, screen readers only).

## Changes

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `agenda.empty.noSeries` | Ainda não há animes em andamento. Comece um na Crunchyroll ou na ADN e os lançamentos dele vão aparecer aqui. | Você ainda não está assistindo nenhum anime. Comece um na Crunchyroll ou na ADN e os lançamentos dele vão aparecer aqui. | meaning | “Animes em andamento” is the airing status on Brazilian anime sites (“currently airing anime”); the note means the user's Watching list is empty |
| `agenda.empty.noSeriesPlatforms` | Ainda não há animes em andamento. Comece um em {platforms} e os lançamentos dele vão aparecer aqui. | Você ainda não está assistindo nenhum anime. Comece um em {platforms} e os lançamentos dele vão aparecer aqui. | meaning | Same ambiguity |
| `agenda.empty.week` | Nenhum episódio dos seus animes em andamento nesta semana. | Nenhum episódio nesta semana dos animes que você está assistindo. | meaning | Same ambiguity; “nesta semana” moved so it cannot attach to “assistindo” |
| `airing.skip.noSeries` | nenhum anime em andamento no cache — abra a aba Assistindo | nenhum anime sendo assistido no cache — abra a aba Assistindo | meaning | The cached Watching list, not airing anime |
| `watching.noOther` | Nenhum outro anime em andamento. | Você não está assistindo nenhum outro anime. | meaning | Same ambiguity |
| `engagement.notCompleted` | Ficha não concluída: sem reassistir | Anime não concluído: sem reassistir | meaning | The user's list status is not Completed; “ficha não concluída” read as an unfinished record |
| `list.remove.detail` | Removido de todas as contas conectadas (AniList, MyAnimeList). | Será removido de todas as contas conectadas (AniList, MyAnimeList). | meaning | Tooltip of the confirmation box, before anything is removed: the bare participle read as already done |
| `watching.resume` | Continuar | Continuar assistindo | meaning | The note says heading, not a button; a bare “Continuar” reads as a button. Netflix Brasil row title. Small 11 px caption that wraps (no truncation) |
| `compare.job.retryFailed` | Repetir as falhas | Refazer os com falha | meaning | “Repetir as falhas” literally says “repeat the failures”; “com falha” is the Brazilian UI idiom (GitHub pt-BR); 20 characters (≤ 22) |
| `review.deferredNote` | Episódio {number} em espera, aplicado após a sua decisão | Episódio {number} em espera: será aplicado após sua decisão | meaning | The episode is applied later; the bare participle read as already applied |
| `crImport.read.error.logged-out` | Faça login na {platform} nessa aba e depois leia de novo. | Faça login na {platform} nessa aba e depois refaça a leitura. | style | “Leia de novo” tells the user to read something themselves; the meaning is “run the reading again”, parallel to “refaça a análise” |
| `crImport.read.error.adnLoggedOut` | Abra a ADN nessa aba e faça login (recarregue a página se já tiver feito login), depois leia de novo. | Abra a ADN nessa aba e faça login (recarregue a página se já tiver feito login), depois refaça a leitura. | style | Same |
| `crImport.read.error.netflixLoggedOut` | Faça login na Netflix nessa aba e escolha seu perfil, depois abra novamente a página “O que foi assistido” e leia de novo. | Faça login na Netflix nessa aba e escolha seu perfil, depois abra novamente a página “O que foi assistido” e refaça a leitura. | style | Same |
| `crImport.error.noHistory` | Histórico não encontrado: leia de novo. | Histórico não encontrado: refaça a leitura. | style | Same; parallel to `crImport.error.noPlan` “refaça a análise” |
| `panel.live.pointPassed` | Ponto de sincronização passou | Após o ponto de sincronização | style | Awkward predicate; natural status line, 29 characters (≤ 30) |
| `watching.seenOf_other` | {count} episódios assistidos de {total} | {count} de {total} episódios assistidos | style | Natural Brazilian word order (“5 de 12 episódios assistidos”) |
| `crImport.review.createdLimited_one` | {count} verificação criada (no máximo 20 pendentes): resolva essas e depois crie as próximas. | {count} verificação criada (no máximo 20 pendentes): resolva-as e depois crie as próximas. | style | “Resolva essas” is spoken shorthand; written UI uses the enclitic pronoun (cf. “recarregue-a” elsewhere) |
| `crImport.review.createdLimited_other` | {count} verificações criadas (no máximo 20 pendentes): resolva essas e depois crie as próximas. | {count} verificações criadas (no máximo 20 pendentes): resolva-as e depois crie as próximas. | style | Same |
| `settings.percentage.fallbackLabel` | Porcentagem de reserva | Porcentagem alternativa | style | “De reserva” suggests a reserve amount; the value is the alternative used when the credits are unknown (23 characters, ≤ 24) |
| `engagement.lastEpisode` | Episódio {progress} é o último: sem reassistir | O episódio {progress} é o último: sem reassistir | grammar | A full clause needs the article (“AniList · o episódio 12 é o último…” once lowercased) |
| `prompt.rewatch.failed` | Reassistindo não salvo | Status Reassistindo não salvo | grammar | A bare gerund cannot be the subject of “não salvo”; naming the status makes it grammatical and parallel to “Nota não salva” |
| `inline.ratingFailedOn` | Falhou no {services}, tente de novo | {services}: falhou, tente de novo | grammar | `{services}` can be “AniList, MyAnimeList” (both failed): a singular “no” before a list; the “{service}: …” pattern works for one or two names |
| `page.notTracked` | Nada para acompanhar aqui: em {platform}, o SyncKai só acompanha animes reconhecidos pelo AniList. | {platform}: nada para acompanhar aqui. Nesta plataforma, o SyncKai só acompanha animes reconhecidos pelo AniList. | grammar | “Em Netflix” without article is unnatural in a full sentence; a “{platform}:” prefix needs neither the article nor the Netflix/Disney+ gender |
| `page.platformOff` | A sincronização em {platform} está desativada: o SyncKai não acompanha nada aqui. Para reativar: Configurações › Reprodução e sincronização. | {platform}: sincronização desativada. O SyncKai não acompanha nada aqui. Para reativar: Configurações › Reprodução e sincronização. | grammar | Same article-less “em Netflix / em Disney+”; same prefix solution, path unchanged |
| `ratings.ignoreAria` | Pular a avaliação de {title} | Dispensar a avaliação de {title} | consistency | The visible button is “Dispensar” (`common.ignore`): the accessible name now contains it (voice control) and matches `review.dismissFailed` |
| `settings.exclusions.reactivateAria` | Voltar a sincronizar {title} | Reativar a sincronização de {title} | consistency | The visible button is “Reativar”: the accessible name now contains it, as in French |
| `watching.seenOf_one` | {count} episódio assistido de {total} | {count} de {total} episódios assistidos | plural | `_one` also serves 0: “0 de 12 episódios assistidos” and “1 de 12 episódios assistidos” both read naturally |
| `settings.cat.help` | Ajuda e sobre | Ajuda e informações | terminology | A dangling “sobre” is not idiomatic as a category name; 19 characters (≤ 22). The sections inside stay “Ajuda” and “Sobre”, so the GitHub template path is unchanged |

Changes per category: meaning 10, style 9, grammar 5, consistency 2, plural 1, terminology 1.

## Term sheet changes (`docs/i18n/glossary/pt-BR.md`)

- New row “series in progress”: *animes que você está assistindo* / *anime sendo assistido*, never *animes em andamento* (kept for running jobs and the empty-state heading).
- Settings category *Ajuda e informações* (was *Ajuda e sobre*).
- Rewatch phrasing *Status Reassistindo não salvo*.
- *entry* row: the user's list status is phrased with *anime* (*Anime não concluído*).
- New rows: *Refazer os com falha*, *refaça a leitura*, *Porcentagem alternativa*; screen-reader labels contain the visible button word.
- Conventions: *{platform}:* prefix in prominent full sentences where the platform can be Netflix or Disney+; `{services}` lists before a colon; number-neutral `_one` wording when possible.

## Debatable, left unchanged

- `settings.summary.mappings_one`, `settings.summary.excluded_one`, `settings.delay.aria_one`, `watching.seen_one`: pt-BR plural rules send 0 to `_one`, so a new user sees “0 correspondência · 0 ignorado” on the Settings home. Kept: the term sheet documents the choice, `{count}` is mandatory and there is no `_zero` form; many natives would still write the plural with zero.
- `compare.breakdown.progress_other`, `compare.impact.progress_other`: “30 progressos”, “30 progressos alterados” (countable *progresso* is unusual). Alternatives (“30 de progresso”, “Progresso alterado em 30 animes”) break the parallel with *status* and *notas*.
- `panel.tab.nowPlaying` “Em reprodução” (13 for ≤ 12) and `settings.panel.tab.last` “Última aberta” (13 for ≤ 12): no shorter natural label; the translator measured the space.
- `settings.cat.sync` “Reprodução e sincronização” (26 for ≤ 24), `settings.airing.checkNow` “Verificar agora” (15 for ≤ 14), `common.retry` “Tentar de novo” (14 for about 12): natural, slightly over the hints.
- `review.format.tvShort` “TV curta”: fans read “TV Short” in English on AniList; kept as a readable translation.
- `panel.nowPlaying.relation.PREQUEL` “Prequela”: used in Brazil (translations, Skoob), though the pop-culture press often keeps “prequel”; pairs with “Sequência”.
- `common.excludedTitle`, `feedback.excluded` “Anime ignorado pela sincronização”: understandable and tied to the “Ignorado” chip; “Sincronização desativada para este anime” would be smoother but breaks the term.
- `page.addCurrent` “Estou assistindo”: the note asks for the status name; the button pair “Quero assistir / Estou assistindo” is idiomatic and the feedback “Adicionado a Assistindo” names the status.
- `compare.job.cancelled`, `crImport.apply.cancelled`, `crImport.analyze.cancelled` “cancelado/cancelada” for a user stop with partial results: the usual Brazilian UI word; “interrompido” is reserved for the error variants.
- `match.platformSeasonsSingle`, `match.platformTitleOnly`, `match.platformUnlinkedEntry`, `agenda.estimate.title`, `panel.offTargetPlatforms`, `watching.empty.textPlatforms`, `agenda.empty.noSeriesPlatforms`: article-less “em/de {platform(s)}” kept in reason lines, labels and name lists (Netflix/Disney+ genders differ).
- `watching.empty.title` “Nada em andamento ainda”: no *anime* noun and shown inside the Watching tab, so it does not read as airing.
- `import.summary.rewatchDeclined_*` “recusa(s) de reassistir”, `crImport.skipReason.beyond` “além da ficha”, `settings.mappings.count_*` “animes memorizados”: terse but understandable; no better natural noun.
- `settings.help.reportTitle` “relato” for a GitHub issue (GitHub pt-BR says “problema”): kept per the term sheet.
- `popup.hostAccessMissing` “acessar Crunchyroll / ADN” without article: acceptable in a banner title.

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | Inverno / Primavera / Verão / Outono | Inverno {year} / Primavera {year} / Verão {year} / Outono {year} | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |
| `sync.noServiceFollows` | Nenhum serviço conectado acompanha este anime. | Nenhum serviço conectado tem uma ficha deste anime. | Meaning: shown when no connected service has an entry for the anime (no AniList / MyAnimeList ID), not when none “tracks” it; English, French and German fixed the same way. Term sheet: entry = *ficha* |

Code fixes that change how this catalog is displayed:

- Netflix history import: the “Mostrar mais” button of a Netflix profile in this language is recognized (label checked by the reviewer on Netflix’s help article 101917 in this language): such an import no longer stops after the first rows as if the history were complete.
- The signed delays of the Schedule tooltips (`agenda.estimate.*`) now use `time.countdown.*`: “+1 h 30 min”.
- Lists of names in `{services}` and `{titles}` use the language’s own conjunction (`Intl.ListFormat`) instead of “, ”.

Layout (`npm run test:i18n-layout`), fixed in the components without changing the text: `queue.nextAttempt` (Activity › pending syncs): the buttons go below the status when it is long; `page.action.DROPPED` (side panel at 320 px): the icons are hidden when the side panel is narrow.

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). The singular `_one` names the entry's only episode.

| Key | Text |
|---|---|
| `sync.beyondEntry_one` | Episódio {progress} ultrapassa o único episódio da ficha |
| `sync.beyondEntry_other` | Episódio {progress} ultrapassa os {count} episódios da ficha |

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | O botão “Mostrar mais” não foi reconhecido no idioma do seu perfil da Netflix: só os episódios mais recentes foram lidos. Coloque esse perfil no mesmo idioma do SyncKai na Netflix e refaça a leitura. |

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video (só animes) |
| `settings.prime.label` | Sincronizar no Prime Video |
| `settings.prime.helpOff` | Só animes são sincronizados (gênero anime, ou animação com áudio japonês ou com o título exato do AniList). Seu navegador vai pedir acesso a primevideo.com |
| `settings.prime.helpOn` | O SyncKai só lê o que a página do Prime Video já recebe. Em uma aba do Prime Video que já estava aberta, o acompanhamento começa no próximo episódio |
| `settings.prime.denied` | Acesso a primevideo.com negado: o Prime Video continua desativado |
| `settings.prime.disabled` | Prime Video desativado: recarregue as abas do Prime Video abertas para parar de vez |
| `settings.prime.error` | Não foi possível alterar o acesso ao Prime Video, tente de novo |

| Key | Text |
|---|---|
| `onboarding.intro` | Assista aos seus animes na Crunchyroll ou na ADN (Netflix, Disney+ e Prime Video opcionais): o SyncKai atualiza sua lista no fim de cada episódio. |
| `watching.tip` | Configure a Netflix, o Disney+, o Prime Video (opcionais) e sua plataforma preferida em {path}. |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | Confere com a plataforma: {signals} |
| `match.signalsContradict` | Não confere com a plataforma: {signals} |
| `match.yearRemake` | Remake identificado pelo ano de lançamento ({year}) |
| `match.signal.year` | ano de lançamento |
| `match.signal.episodes` | número de episódios |
| `match.signal.duration` | duração dos episódios |
| `match.signal.format` | formato (filme ou série) |
| `match.signal.country` | país de origem |
| `match.signal.originalTitle` | título original |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | A correspondência memorizada não confere com a plataforma: {signals} |

## 2026-10-14 · Matching diagnostic (development builds only)

New keys `settings.matchDiag.*` (Settings › Help & about, section shown only in development builds, never in the published extension): the last 50 AniList matching decisions, a « Copy » button per row (one decision as JSON, for the test corpus) and a « Clear » button. `{count}` follows a label and a colon (no plural form); `JSON` is a format name. Terms from this language's term sheet (match, entry). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.title` | Diagnóstico de correspondências |
| `settings.matchDiag.text` | Só em builds de desenvolvimento: as últimas 50 decisões de correspondência com o AniList, da mais recente para a mais antiga, guardadas até fechar o navegador. Copie uma em JSON para adicioná-la ao corpus de testes. |
| `settings.matchDiag.empty` | Nenhuma decisão registrada ainda |
| `settings.matchDiag.copy` | Copiar |
| `settings.matchDiag.copyTitle` | Copiar esta decisão em JSON |
| `settings.matchDiag.copied` | Copiada |
| `settings.matchDiag.copyFailed` | Não foi possível copiar a decisão. |
| `settings.matchDiag.clear` | Limpar |
| `settings.matchDiag.candidates` | Candidatos: {count} |
| `settings.matchDiag.noEntry` | Nenhuma ficha |

## 2026-10-15 · Debug trace (development builds only)

New keys `settings.debugTrace.*` (Settings › Help & about, section shown only in development builds, never in the published extension, below the matching diagnostic): a timeline of what the extension did (pages, service worker, AniList and MyAnimeList requests), a verbose switch, a category filter (category names stay in English: technical identifiers), « Copy trace » (the whole trace as JSON) and the « Clear » button of the matching diagnostic (`settings.matchDiag.clear`, reused). `{count}` and `{max}` follow a label and a colon (no plural form) and arrive formatted for the language; `JSON` is a format name; `service worker` kept as the browser's technical term. New terms added to this language's term sheet (debug trace, event, verbose mode); other terms from it (account). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.debugTrace.title` | Rastreamento de depuração |
| `settings.debugTrace.text` | Só em builds de desenvolvimento: a sequência do que o SyncKai fez nas páginas, no service worker e com o AniList e o MyAnimeList, do mais recente para o mais antigo, guardada até fechar o navegador. Nenhum token, cookie ou ID de conta é registrado. Copie o rastreamento inteiro em JSON para compartilhá-lo ao relatar um problema. |
| `settings.debugTrace.empty` | Nenhum evento registrado ainda |
| `settings.debugTrace.copy` | Copiar rastreamento |
| `settings.debugTrace.copied` | Copiado |
| `settings.debugTrace.copyFailed` | Não foi possível copiar o rastreamento. |
| `settings.debugTrace.verbose` | Modo detalhado (todas as linhas do registro) |
| `settings.debugTrace.count` | Eventos: {count} / {max} |
| `settings.debugTrace.allCategories` | Todas as categorias |
| `settings.debugTrace.filterAria` | Filtrar eventos por categoria |

## 2026-10-16 · Matching diagnostic: Copy all (development builds only)

New keys in the « Matching diagnostic » section (Settings › Help & about, development builds only, never in the published extension, now collapsed by default behind its title): « Copy all » copies every recorded decision as one JSON array, next to « Clear »; its label becomes « Copied » (`settings.matchDiag.copied`, reused) and a failure reuses `settings.matchDiag.copyFailed`. `JSON` is a format name. Same word for « decision » as `settings.matchDiag.copyTitle`, in the plural; other terms from this language's term sheet. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.copyAll` | Copiar tudo |
| `settings.matchDiag.copyAllTitle` | Copiar todas as decisões em JSON |

## 2026-10-16 · Episode guards (« To check » reasons)

New reasons on a « To check » card (`fix/episode-guards`, audit SEC-01): a sync that would jump straight to the last episode from far behind, and episodes reported as finished in a burst, now wait for the user instead of being written. Same « to check » term as `match.otherSeriesExcluded`, same episode wording as `sync.beyondEntry_*`; `{from}` and `{progress}` are episode numbers. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `sync.review.finaleJump` | Salto direto para o último episódio ({progress}) a partir do episódio {from}: a verificar |
| `sync.review.burst` | Muitos episódios concluídos em poucos minutos: a verificar |

## 2026-10-17 · Status bar (popup and side panel)

New texts of the status bar shown at the bottom of the popup and, now, of the side panel (`feature/ui-status-bar`): a synced episode or a count of synced episodes under the series title, shown until the user hides it (« Seen, hide », a × button label), and the history import running, ready to confirm and done. Same words as this language's term sheet: *sincronizado* (sync), *anime* (series, masculine agreement: *atualizado*), *Ep.* / *episódio* (episode), *Importação* (import, as `crImport.apply.done` « Importação concluída »), *a confirmar* (preview to confirm, label form like *a verificar*) and *ocultar* (hide); *da {platform}* as in `crImport.preview.nothing` (Crunchyroll, ADN and Netflix are feminine). ` · ` and ` / ` kept; `{platform}` is a brand name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `footer.dismiss` | Visto, ocultar |
| `footer.importDone_one` | Importação concluída · {count} anime atualizado |
| `footer.importDone_other` | Importação concluída · {count} animes atualizados |
| `footer.importProgress` | Importação da {platform} · {done} / {total} |
| `footer.importReady_one` | Importação pronta · {count} anime a confirmar |
| `footer.importReady_other` | Importação pronta · {count} animes a confirmar |
| `footer.syncedEpisode` | Ep. {episode} sincronizado |
| `footer.syncedEpisodes_one` | {count} episódio sincronizado |
| `footer.syncedEpisodes_other` | {count} episódios sincronizados |

## 2026-10-17 · Account menu (status bar)

New texts of the account menu that opens above the AniList / MyAnimeList logo of the status bar (popup and side panel): the logo button's label (also when the session expired), the connection status line, three stat tiles (anime count, episodes watched, days watched, each number shown above its short label), the « Synced this week » row with its tooltip and value, and « View my profile ». Following this language's term sheet, used **conta do {service}**, **conectado** (as `settings.account.connected`), **sessão expirada** (`common.sessionExpired`), **sincronizar**, **episódio**, **assistido** (agrees with *dias*); plural **animes**; « day » is **d**, as `time.countdown.days`. ` · ` kept; `{service}` is a brand name, `{name}` the user's AniList / MyAnimeList user name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `accountMenu.connected` | Conectado |
| `accountMenu.connectedAs` | {name} · conectado |
| `accountMenu.label` | Conta do {service} |
| `accountMenu.labelExpired` | Conta do {service}, sessão expirada |
| `accountMenu.profile` | Ver meu perfil |
| `accountMenu.stats.anime_one` | anime |
| `accountMenu.stats.anime_other` | animes |
| `accountMenu.stats.days_one` | assistido |
| `accountMenu.stats.days_other` | assistidos |
| `accountMenu.stats.daysValue` | {days} d |
| `accountMenu.stats.episodes_one` | episódio |
| `accountMenu.stats.episodes_other` | episódios |
| `accountMenu.week.label` | Sincronizados esta semana |
| `accountMenu.week.title` | Episódios sincronizados pelo SyncKai esta semana |
| `accountMenu.week.value_one` | {count} episódio |
| `accountMenu.week.value_other` | {count} episódios |

## 2026-10-17 · Settings redesign (Preact): new and changed keys

New texts of the redesigned Settings (Preact): the Platforms and Display categories, the screen-reader names of the back button and of the category card, the row summaries of the Settings home, the Keyboard section of Display, the two sections of Shortcuts, and the section titles and notes of Accounts. Changed: `settings.cat.notifications` (now the single word: the Schedule options moved to Platforms), `settings.summary.connected` (a word instead of ✓), `settings.summary.paused` (now a standalone, capitalised summary), `settings.summary.version` (a word instead of « v »), `settings.entry.help` (the « both accounts connected » condition moved to `settings.entry.unavailable`). Summaries are joined with ` · ` by the code; `settings.account.expiredHelp` and `settings.account.otherStillSynced` are joined as two sentences. The Display summary reuses `settings.section.language`, `settings.section.panel` and `settings.shortcuts.pointer`; the My data summary the history import and backup words; the player summary `settings.player.label`. Articles with the masculine service names (*ao {service}*, *O {service}*, *o AniList e o MyAnimeList*). **ativa / ativas** agree with *plataformas*; player summary « preferida: {player} » (*Plataforma preferida*). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.cat.notifications` | Notificações |
| `settings.cat.platforms` | Plataformas |
| `settings.cat.display` | Exibição |
| `settings.backToAria` | Voltar para {page} |
| `settings.group.categories` | Categorias |
| `settings.summary.connected` | {service} conectado |
| `settings.summary.notConnected` | {service} não conectado |
| `settings.summary.bothConnected` | AniList e MyAnimeList conectados |
| `settings.summary.auto` | Automática |
| `settings.summary.paused` | Em pausa |
| `settings.summary.platforms_one` | {count} de {total} ativa |
| `settings.summary.platforms_other` | {count} de {total} ativas |
| `settings.summary.player` | preferida: {player} |
| `settings.summary.display` | Idioma, painel lateral, atalhos de teclado |
| `settings.summary.data` | Importar histórico · backup |
| `settings.summary.version` | Versão {version} |
| `settings.summary.noErrors` | nenhum erro |
| `settings.display.keyboard` | Teclado |
| `settings.display.shortcutsHelp` | Teclas para marcar um episódio ou abrir o painel |
| `settings.shortcuts.duringPlayback` | Durante a reprodução |
| `settings.shortcuts.navigation` | Navegação |
| `settings.accounts.lists` | Listas sincronizadas |
| `settings.accounts.both` | Com as duas contas |
| `settings.accounts.privacy` | Você faz login no site do AniList ou do MyAnimeList: o SyncKai nunca vê sua senha. |
| `settings.account.expiredHelp` | Seus episódios não são mais enviados ao {service} até você reconectar. |
| `settings.account.otherStillSynced` | O {service} continua sendo atualizado. |
| `settings.entry.help` | Aberta ao clicar no título ou na capa de um anime |
| `settings.entry.unavailable` | Disponível quando o AniList e o MyAnimeList estão conectados. |

## 2026-10-17 · Settings › Sync, Matches and Excluded series (Preact)

New texts of the redesigned Sync settings page and of its two sub-pages (Matches, Excluded series), moved out of My data: section titles « Automatic » / « Per series », the descriptions of the two « Episode counted as watched » cards, the « Per series » rows, the Matches intro, search, empty and no-result texts, « Show N more on {platform} », the four origin badges and their legend, the Excluded series section, note, empty hint and the « {year} series · excluded on {date} » fragments. Changed: `settings.trigger.legend` (« Episode counted as watched », where the old text was only « Episode watched »), `settings.trigger.credits` (« (recommended) » moved to `settings.trigger.creditsHelp`), and the paths of `popup.syncDisabledDetail` / `review.excludeTitle` (now nav.settings › settings.section.sync › settings.section.exclusions, built from this catalog's own titles). Removed: `settings.mappings.count_*`, `settings.mappings.help`, `settings.mappings.manage`. `{action}` is the « Re-enable » button (`settings.exclusions.help`) or the « Stop syncing this series » menu item (`settings.exclusions.emptyHelp`), so the quoted labels always match. The match / entry / excluded / re-enable words reuse this catalog's existing terms (`settings.section.mappings`, `settings.mappings.entryFallback`, `settings.section.exclusions`, `settings.exclusions.reactivate`). No article before {platform} (« em {platform} »): platform names take different genders. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.section.automatic` | Automática |
| `settings.section.perSeries` | Por anime |
| `settings.trigger.legend` | Episódio contado como assistido |
| `settings.trigger.credits` | No início dos créditos |
| `settings.trigger.creditsHelp` | Recomendado: o momento exato informado pela plataforma |
| `settings.trigger.percentageHelp` | Também usada quando os créditos são desconhecidos |
| `settings.sync.mappingsRow` | Correspondências memorizadas |
| `settings.sync.mappingsRowHelp` | A temporada do AniList escolhida para cada anime |
| `settings.sync.exclusionsRowHelp` | Nunca sincronizados, podem ser reativados aqui |
| `settings.mappings.intro_one` | {count} anime memorizado, por plataforma: a temporada da plataforma → a ficha do AniList onde o SyncKai escreve. Esquecer uma correspondência faz o SyncKai recalculá-la no próximo episódio. |
| `settings.mappings.intro_other` | {count} animes memorizados, por plataforma: a temporada da plataforma → a ficha do AniList onde o SyncKai escreve. Esquecer uma correspondência faz o SyncKai recalculá-la no próximo episódio. |
| `settings.mappings.search` | Buscar um anime ou uma ficha |
| `settings.mappings.noResult` | Nenhuma correspondência para “{query}” |
| `settings.mappings.noResultHelp` | Busque pelo título do anime ou da ficha do AniList. |
| `settings.mappings.emptyHelp` | O SyncKai memoriza uma para cada temporada sincronizada. |
| `settings.mappings.showMore_one` | Ver mais {count} em {platform} |
| `settings.mappings.showMore_other` | Ver mais {count} em {platform} |
| `settings.mappings.origin.chosen` | Escolhida por você |
| `settings.mappings.origin.learned` | Aprendida |
| `settings.mappings.origin.unmarked` | Antiga |
| `settings.mappings.origin.unverified` | Importada · a verificar |
| `settings.mappings.origin.chosenHelp` | Confirmada ou escolhida por você: nunca é questionada. |
| `settings.mappings.origin.learnedHelp` | Encontrada pelo SyncKai: recalculada se a plataforma a contradisser. |
| `settings.mappings.origin.unmarkedHelp` | Salva antes da 2.4: mantida, a verificar se for contradita. |
| `settings.mappings.origin.unverifiedHelp` | Veio de um backup: verificada de novo no primeiro uso. |
| `settings.mappings.originLegend` | Origem das correspondências |
| `settings.exclusions.section` | Nunca sincronizados |
| `settings.exclusions.help` | Um anime ignorado nunca mais é sincronizado, em nenhuma temporada. “{action}” volta a acompanhá-lo a partir do próximo episódio. |
| `settings.exclusions.emptyHelp` | Para parar de sincronizar um anime, escolha “{action}” no menu “⋯” dele. |
| `settings.exclusions.seriesYear` | anime de {year} |
| `settings.exclusions.excludedOn` | ignorado em {date} |
| `popup.syncDisabledDetail` | Reative em Configurações › Sincronização › Animes ignorados |
| `review.excludeTitle` | Ignora o anime (todas as temporadas): reative em Configurações › Sincronização › Animes ignorados |

## 2026-10-17 · Settings › Platforms and Notifications (Preact)

Texts of the redesigned Platforms page (list of sites with « Included » / « Access missing » or a switch, preferred player dropdown, estimated release time per platform with − / + buttons, moved there from the Schedule card) and Notifications page (« On the playback page » style cards and « New episodes »). New: `settings.platforms.where`, `settings.platforms.allAnime`, `settings.platforms.included`, `settings.platforms.accessMissing`, `settings.platforms.note`, `settings.player.openOn`, `settings.player.enableFirst`, `settings.offsets.earlier`, `settings.offsets.later`, `settings.notif.legend`. Changed: `settings.player.help`, `settings.offsets.title`, `settings.offsets.help`, `page.platformOff`, `settings.section.notifications`, `settings.notif.discreet.desc`, `settings.notif.detailed.desc`, `settings.notif.alertsOnly.desc`, `settings.notif.alertsAlways`, `settings.delay.title`, `settings.airing.enableFirst` (the notification descriptions now describe the pill and the bubble, « Extra delay » replaces « Delay », the release-time help says the alerts use it too, « Turn on alerts… » is now visible text). `page.platformOff` keeps its sentence; only the path changed, from « Settings › Playback & sync » to nav.settings › settings.cat.platforms of this catalog. Removed: `settings.section.playback`, `settings.netflix.section`, `settings.netflix.label`, `settings.disney.section`, `settings.disney.label`, `settings.prime.section`, `settings.prime.label`, `settings.airing.label`, `settings.airing.help`, `settings.section.agenda`. The Schedule word, « Open », the release-alert name and the minute unit reuse this catalog's `panel.tab.agenda`, `common.open`, `settings.quick.airing.label` and `settings.offsets.unit`. Series = « anime », as everywhere in this catalog (« um anime a verificar », « páginas de animes »). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.platforms.where` | Onde o SyncKai segue seus episódios |
| `settings.platforms.allAnime` | Todos os animes |
| `settings.platforms.included` | Incluída |
| `settings.platforms.accessMissing` | Sem acesso |
| `settings.platforms.note` | Ativar uma plataforma pede acesso ao site dela. Só as páginas de reprodução e de animes são lidas. |
| `settings.player.openOn` | Abrir episódios em |
| `settings.player.enableFirst` | Ative antes |
| `settings.player.help` | Usada por “Abrir” quando um anime está em várias plataformas ativas. |
| `settings.offsets.title` | Horário estimado de lançamento |
| `settings.offsets.help` | Após a exibição no Japão. Usado pela Agenda e pelos alertas; cada anime é ajustado na própria linha da Agenda. |
| `settings.offsets.earlier` | {minutes} min antes |
| `settings.offsets.later` | {minutes} min depois |
| `page.platformOff` | {platform}: sincronização desativada. O SyncKai não acompanha nada aqui. Para reativar: Configurações › Plataformas. |
| `settings.section.notifications` | Na página de reprodução |
| `settings.notif.legend` | Estilo das notificações na página |
| `settings.notif.discreet.desc` | Um pequeno balão por alguns segundos, em um canto do vídeo |
| `settings.notif.detailed.desc` | Um balão com o episódio e o resultado no AniList e no MyAnimeList |
| `settings.notif.alertsOnly.desc` | Nada quando está tudo bem; um balão só em caso de erro ou de episódio a verificar |
| `settings.notif.alertsAlways` | Um erro ou um anime a verificar sempre aparece, seja qual for o estilo. |
| `settings.delay.title` | Atraso extra |
| `settings.airing.enableFirst` | Ative os alertas para verificar os lançamentos |

## 2026-10-17 · Settings › My data, AniList ↔ MAL differences, Help & about (Preact)

Texts of the redesigned My data page (one « Import a watch history » card, Backup card, « Compare » row opening the AniList ↔ MyAnimeList differences page, which moved there from the popup's Activity screen) and Help & about page (diagnostic report row, error log that unfolds, About card with What's new / Privacy / Source code links). New: `settings.import.title`, `settings.section.compare`, `settings.compare.title`, `settings.compare.help`, `settings.data.perSeries`, `compare.align`, `compare.bulk.help`, `compare.job.background`, `settings.help.diagnostic`, `settings.help.diagnosticHelp`, `settings.help.journalNote`, `settings.about.whatsNew`, `settings.about.privacy`. Changed: `settings.crImport.help`, `settings.backup.help`, `settings.backup.import`, `settings.help.copy`, `settings.about.source` (import help in two sentences, backup help « in one file », « Import » without ellipsis, « Copy the report » next to the new « Diagnostic report » title, « Source code » with « GitHub » on the right). `help.issue.body` keeps its text; only its last-line path changed, to nav.settings › settings.cat.help › settings.help.copy of this catalog. The compare.* texts are unchanged: their context notes now point to Settings › My data. Removed: `settings.section.import`, `settings.backup.crImportTitle`, `settings.crImport.openAria`, `settings.help.text`, `settings.help.copyTitle`, `settings.help.clearHelp`, `settings.help.reportTitle`. The version line reuses `settings.summary.version`, the « Clear » button `settings.matchDiag.clear`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.import.title` | Recupere o que você já assistiu |
| `settings.crImport.help` | Crunchyroll, ADN ou Netflix. Você vê uma prévia antes de qualquer coisa ser gravada. |
| `settings.backup.help` | Configurações, correspondências, animes ignorados e histórico em um arquivo. Nunca seus logins do AniList ou MyAnimeList. |
| `settings.backup.import` | Importar |
| `settings.section.compare` | Comparar |
| `settings.compare.title` | Diferenças AniList ↔ MyAnimeList |
| `settings.compare.help` | Compara suas duas listas e as alinha no sentido que você escolher |
| `settings.data.perSeries` | Correspondências e animes ignorados ficam em {path}. |
| `compare.align` | Alinhar |
| `compare.bulk.help` | “{action}” copia o AniList para o MyAnimeList; antes, uma confirmação mostra as mudanças. |
| `compare.job.background` | Continua mesmo se você fechar esta página. |
| `settings.help.diagnostic` | Relatório de diagnóstico |
| `settings.help.diagnosticHelp` | Para colar em um relato de bug: versão, navegador, configurações, erros recentes. Sem tokens nem contas. |
| `settings.help.copy` | Copiar relatório |
| `settings.help.journalNote` | No máximo os 50 últimos, do mais recente ao mais antigo; tokens já ocultos. |
| `settings.about.whatsNew` | Novidades |
| `settings.about.privacy` | Privacidade |
| `settings.about.source` | Código-fonte |
