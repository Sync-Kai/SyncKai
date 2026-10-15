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
