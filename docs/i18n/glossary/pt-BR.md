# SyncKai term sheet: Portuguese (Brazil), `pt-BR`

Binding for every change to `src/i18n/locales/pt-BR.json` and `public/_locales/pt_BR/messages.json`. Shared rules: `docs/i18n/GLOSSARY.md`.

Target: natural Brazilian Portuguese as used by Crunchyroll Brasil, Netflix Brasil and the big Brazilian apps, written for anime fans. Portuguese users (and every other `pt-*` browser) also get this locale: no Portugal-only words or constructions (*ecrã*, *guardar* for save, *estar a + infinitive*…).

## 1. Core concepts (GLOSSARY.md section 3)

| English term | pt-BR | Reason |
|---|---|---|
| series | **anime** (masc.), plural **animes** | Brazilian fans call an anime title *anime* (*meus animes*, *Comece um anime*); *série* sounds like live-action TV. Every participle about a series is masculine: *Anime ignorado*, *{title}: concluído*, *{title}: removido da sua lista*, *Adicionado a Assistindo*. Two context exceptions: `feedback.ignored.title` → **Título não reconhecido** (the title is probably *not* an anime, so "Anime ignorado" would contradict the message) and `crImport.review.series` → **Anime inteiro** (whole series, no season label). |
| season / episode / arc | **temporada** / **episódio** / **arco** | Crunchyroll Brasil wording. Season parts: **parte** (*Temporada 2 · parte 1*). |
| Ep. (before a number) | **Ep.** / **ep.**; plural-aware count **{count} ep.** / **{count} eps.** | Usual Brazilian abbreviation. Non-plural-aware counts (`review.episodes`) keep **ep.**, valid for any number. The **E{number}** of `review.displayed` stays as is. |
| list | **lista** (*sua lista*, *suas listas*, *sua lista do AniList*) | The user's tracking list, never a playlist. |
| entry | **ficha** (fem.) | The anime's page on AniList/MyAnimeList (*Abrir a ficha no AniList*, *Ficha única*, *2ª ficha do AniList*). *página* is avoided: it collides with the streaming page (*Nesta página*, *Recarregue a página*, *Lendo a página…*); *entrada* and *registro* are literal/record-like. When "entry" means the user's list status rather than the page, say **anime**: *Anime não concluído: sem reassistir* (`engagement.notCompleted`). |
| Watching (status and popup tab) | **Assistindo** | Universal Brazilian term, same word for the tab (`nav.watching`) and the status. |
| series in progress (the user's Watching list) | **animes que você está assistindo** / fragment **anime sendo assistido** | Never *animes em andamento*: Brazilian anime sites use *Em andamento* as the airing status, so it reads "currently airing anime" (review 2026-10-14). *Em andamento* stays for running jobs only (*Uma análise ou importação já está em andamento*) and for the empty-state heading *Nada em andamento ainda*. |
| Completed | **Concluído** | The user finished the series. Action **Marcar como concluído**, compact button **Concluir**, confirmation **Concluir?**. *Completo* is avoided: Brazilian anime sites use it for "finished airing". |
| On hold (AniList Paused / MAL On-Hold) | **Pausado** | Mirrors AniList, common on Brazilian trackers. Action **Pausar**. The airing hiatus is **Em hiato**; an episode held while a correction is pending is **em espera**. |
| Dropped | **Abandonado** | Standard (the slang *dropado* is avoided). Action **Abandonar**, confirmation **Abandonar?**; never reads as *Cancelar*. |
| Plan to watch (AniList Planning) | **Quero assistir** | Idiomatic Brazilian tracker wording (cf. *Quero ler* on Skoob, *Quero ver* on Filmow), short enough for chips. The add button is the status name itself, **Quero assistir**, next to **Estou assistindo** (both buttons carry an icon); feedback: *Adicionado a Quero assistir*, *Adicionado a Assistindo*. |
| Rewatching (AniList REPEATING) | **Reassistindo** | *reassistir* is the fan verb (*vou reassistir Naruto*). |
| rewatch (noun) | phrased with the verb **reassistir** | No natural noun (*reexibição* is a TV rerun, *revisão* a review). Phrasing: *começar a reassistir*, *sem reassistir*, *recusa de reassistir*, *Status Reassistindo não salvo* (review 2026-10-14: a bare gerund cannot be the subject of *não salvo*). |
| Watching / Activity (tabs) | **Assistindo** / **Atividade** | |
| sync (noun) / to sync | **sincronização** / **sincronizar**; **sincronizado**, **Sincronizando…** | One noun and one verb everywhere, no *sinc.* or *sync*. |
| to check (`review.*`, `footer.toReview`) | **a verificar**; a to-check card = **verificação** (*Criar 3 verificações*, *verificação criada*) | Label form of Brazilian accounting/shopping UIs (*Contas a pagar*). *A verificar ({count})*, *{count} itens a verificar*. Never *está a verificar* (European progressive). Imperatives about checking also use **verificar** (*Verifique no SyncKai*, *verifique abaixo*). |
| to rate | **a avaliar** | Same label form (Shopee Brasil tab *A avaliar*): *A avaliar ({count})*, *{count} animes a avaliar*. |
| score / rating / stars | **nota**; verb **avaliar** / **dar nota** | *Sua nota?*, *Nota 8,5/10 salva*, *Nota média no AniList*. |
| comment (`notes.*`) | **comentário** | Matches MyAnimeList "Comments". Never *nota* (that is the score). |
| match, mapping (`match.*`, Settings) | **correspondência** (*Correspondências*, *{count} correspondências*, *Correspondência incerta*) | Standard Brazilian software term (*Nenhuma correspondência encontrada*). |
| match to (AniList ↔ MAL alignment, `compare.*`) | verb **alinhar**, noun **alinhamento** (*Alinhar tudo ao AniList*, *Alinhamento concluído*) | Different concept from remembered matches (FR *aligner*). Result counts use the neutral **atualizado** because the import reuses them. |
| excluded series | **anime ignorado**; chip **Ignorado**; section **Animes ignorados** | In Brazilian software *excluir* / *excluído* means **delete** (*Excluir conta*): *Animes excluídos* would read "deleted anime". Action button **Não sincronizar**, menu **Não sincronizar este anime**; undo **Voltar a sincronizar** / **Reativar**; toast **Anime ignorado pela sincronização**. |
| pending sync, queue | **sincronização pendente** (*Sincronizações pendentes ({count})*) | Give up a queued sync = **Descartar** (not *Abandonar*, which is the Dropped status). A sync SyncKai stopped retrying ("Failed — abandoned"): **Tentativas esgotadas** (red alert icon; the row also holds two buttons). |
| credits | **créditos** (*No início dos créditos*, *Sincronização nos créditos*) | Netflix Brasil wording; *encerramento* is the ending song. |
| popup | **pop-up** (masc., *no pop-up*) | Chrome pt-BR spelling. |
| side panel | **painel lateral** | Chrome pt-BR "Painel lateral" and Firefox pt-BR (*Exibir/ocultar o painel lateral*). |
| Now playing (panel tab) | **Em reprodução** | Classic Brazilian "Now Playing" (Windows Media Player). 13 characters for the ≤ 12 hint: it fits the measured space; *Assistindo agora* collides with the status and is longer, *Tocando agora* is for music. |
| Schedule (panel tab, `agenda.*`) | **Agenda** | Short and natural (*agenda da semana*). Reused in *Notificações e agenda* and the *Agenda* settings section. AniList's own airing schedule (a different thing) is **programação**. |
| On this page | **Nesta página** | |
| preferred player | **Plataforma preferida** | The context note says "player" means the streaming service. The site's video player stays **player** (*Aguardando o player…*), as Brazilians say. |
| history import (`crImport.*`) | **importar histórico**, **importação** (*Importar histórico*, *Importação concluída*) | Never *backup*. |
| backup (`settings.backup.*`, `backup.*`, `import.*`) | **backup** (masc.) | Adopted Brazilian word (Google, Windows pt-BR). File name *synckai-backup-{date}.json*. Page title *Backup*. |
| preview (import) | **prévia** | *Prévia antes de importar*. |
| rewatch | see "rewatch (noun)" above | |
| account, connect, sign in, sign out, session expired | **conta**, **conectar**, **fazer login**, **desconectar**, **sessão expirada** | *Login cancelado*, *Faça login novamente*, *conta desconectada ou trocada*. Wording that would gender the user is avoided (*Você não fez login no {service}*, *se já tiver feito login*). |
| release alerts (`airing.*`, `settings.quick.airing.label`) | **alertas de lançamento** (*Alertas de lançamento*, *alertas +3 h*, *alertas desativados*) | **alerta** is kept for release alerts only. The on-page "Alerts only" level is **Só avisos** (*Os avisos sempre aparecem…*), a different concept as the glossary asks. |
| release, airing | **lançamento** (on a platform), **exibição** (TV broadcast in Japan) | *exibição no Japão*, *Lançamento estimado*, airing status *Em exibição*. |
| offset, delay (`agenda.*`) | **atraso** | *Atraso para {title}*, *Atraso* (alert delay). The episode-number offset of a match (`settings.mappings.offset`) is **diferença** (*número exibido, diferença de 24*). |
| shortcut | **atalho** / **atalho de teclado** | Shift key: **Shift** (printed name on Brazilian keyboards and in Chrome/Firefox pt-BR). |
| Settings (`nav.settings`) | **Configurações** | Chrome and Android pt-BR. |
| Settings categories | **Contas** · **Reprodução e sincronização** · **Notificações e agenda** · **Atalhos** · **Meus dados** · **Idioma** · **Ajuda e informações** | Brazilian UIs join with *e*, not *&*. *Reprodução e sincronização* is 26 characters for the ≤ 24 hint, kept: it is the natural noun pair and every shorter option was unnatural (*Assistir e sincronizar*) or an anglicism. *Ajuda e informações* (review 2026-10-14, was *Ajuda e sobre*: a dangling *sobre* is not idiomatic as a category name); the sections inside stay **Ajuda** and **Sobre**, and the GitHub template path is *Configurações › Ajuda › Copiar relatório de diagnóstico*. |
| Settings home groups | **Configurações rápidas** · **Reprodução e alertas** · **Dados e ajuda** | |

## 2. Other recurring terms

| English | pt-BR | Note |
|---|---|---|
| airing status: Finished / Airing / Upcoming / On hiatus / Cancelled | **Finalizado** / **Em exibição** / **Em breve** / **Em hiato** / **Cancelado** | About the anime (masc.). "Series finished" chip: **Anime finalizado**. Never *Concluído*, which is the user's status. |
| Ignore (dismiss a to-check / to-rate card) | **Dispensar** | Android pt-BR "dismiss". Keeps *ignorar* for excluded series. Screen-reader labels of a button contain its visible word (voice control): *Dispensar a avaliação de {title}*, *Reativar a sincronização de {title}*. |
| Retry failed ones (AniList ↔ MAL result banner) | **Refazer os com falha** | *Repetir as falhas* literally means "repeat the failures"; *com falha* is the Brazilian UI idiom (GitHub pt-BR). |
| read again (history import) | **refaça a leitura** | Parallel to *refaça a análise*; *leia de novo* sounded like an instruction to read something yourself. |
| Fallback percentage | **Porcentagem alternativa** | *de reserva* suggested a reserve amount. |
| skipped / invalid item skipped / set aside | **pulado** / **descartado** / **descartada** | *{count} títulos pulados (não são animes)*, *{count} itens inválidos descartados*. |
| Retry / Try again | button **Tentar de novo**; in sentences **Tente de novo.** | |
| Save / saved | **Salvar** / **salvo** | Never *guardar* (Portugal). Writing to a list: **gravar** (*nada é gravado*). |
| up to date | **atualizado** (*Já atualizado*, *Ep. 5 já atualizado*, *{count} já atualizados*) | *em dia* only in *Suas listas já estão em dia com seu histórico…*. |
| Auto sync / Auto sync paused | **Sincronização automática** / **Sincronização pausada** | The paused status is shortened (≤ 30 characters in the side panel, next to the clock) and is identical in the side panel and the on-page toast, as the context note requires; the toast message names *sincronização automática*. |
| Open / Watch / Search on {platform} | **Abrir em {platform}** / **Assistir em {platform}** / **Buscar em {platform}** | No article, see section 3. |
| tab (browser) | **aba** | |
| Remove from list / −1 episode | **Remover da lista** / **Desmarcar** (*Desmarcar um episódio assistido*) | |
| watched | **assistido** (*Ep. 5 assistido*, *Marcar como assistido*) | |
| log (error log) | **registro** (*Registro de erros*, *Limpar registro*) | |
| report (diagnostic) / issue (GitHub) | **relatório** / **relato** | *Copiar relatório de diagnóstico*, *Relatar um problema*. |
| Default | **Padrão** | |
| Tip / Welcome | **Dica** / **Boas-vindas!** | Gender-neutral greeting used by Brazilian apps. |
| relations: Parent story / Prequel / Sequel / Side story / Spin-off | **História principal** / **Prequela** / **Sequência** / **História paralela** / **Spin-off** | |
| anime seasons (AniList) | **Inverno** / **Primavera** / **Verão** / **Outono** | Japanese season names, as Brazilian fans use them (*temporada de outono 2024*). |
| AniList format TV short / Special / Movie | **TV curta** / **Especial** / **Filme** | |

## 3. Conventions

- **Register**: *você*, standard Brazilian written imperative (*Abra*, *Verifique*, *Recarregue*, *Tente de novo*), possessives *seu/sua*. Friendly fan tone (*Dê play em um episódio*). No adjective agreeing with the user's gender.
- **Quotation marks**: “…” (nested ‘…’).
- **Colon and spacing**: no space before *:*, *?* or *!*; a fragment after a colon starts in lowercase.
- **Ellipsis**: the single character `…`.
- **Abbreviations**: **min** (minutes), **h** (hours), **d** (days), **s** (seconds), **Ep.**/**ep.**/**eps.**, **MB**. Countdowns: *em 5 min*, *em 2 h*, *em instantes*; relative times: *há 5 min*, *há 2 h*, *há 3 dias*, *ontem*, *agora mesmo*.
- **Percent**: `85%`, no space (Brazilian usage).
- **Separators**: ` › ` and ` · ` kept exactly; *&* in English labels becomes *e*.
- **Articles with names**: SyncKai, AniList, MyAnimeList and MAL are masculine (*o SyncKai*, *no AniList*, *do MAL*); Crunchyroll, ADN and Netflix are feminine (*na Crunchyroll*, *da Netflix*); Disney+ is masculine (*no Disney+*). When `{platform}` can be Disney+, no article: *em {platform}*, *de {platform}* in labels and short phrases (*Abrir em {platform}*, *Assistir em {platform}*); in a full sentence shown prominently, prefer a *{platform}:* prefix, which needs neither article nor agreement (*{platform}: nada para acompanhar aqui. Nesta plataforma, …*, *{platform}: sincronização desativada.*; review 2026-10-14). When `{platform}` is only Crunchyroll, ADN or Netflix (history import, its settings buttons), the feminine article is used: *Seu histórico da {platform}*, *Aba da {platform} pronta*. A `{services}` value can be a list (*AniList, MyAnimeList*): put it before a colon (*{services}: falhou, tente de novo*) rather than after a singular article.
- **`{service}: {message}`** stays `{service}: {message}`; the fragments read in lowercase after it (*AniList: episódio 5 salvo*, *MyAnimeList: falhou: …*, *AniList: já está na sua lista*).
- **`{title}: completed`** → `{title}: concluído` (masculine, agrees with *anime*); likewise *{title}: abandonado*, *{title}: pausado*, *{title}: removido da sua lista*.
- **Plurals**: pt-BR uses `_one` for 0 **and** 1, `_other` for everything else (2, 3, 5, 11, 21…). Every `_one` text reads correctly with 0 (*0 correspondência*, *0 ignorado*, *0 hora após a exibição*: zero takes the singular in Brazilian usage, e.g. *carro zero quilômetro*). Where the sentence allows it, prefer a wording that is the same for every number, so 0 never shows a singular noun: *{count} de {total} episódios assistidos* (review 2026-10-14). `_many` (compact millions) is not provided and falls back to `_other`.
- **Untranslated**: product names, *Redirect URL*, *App Redirect URL*, *chrome://extensions/shortcuts*, *about:addons*, domains, *JSON*, *OVA*, *TV*, *AL*/*MAL* chips.
- **Labels quoted from other screens** reuse the exact translation of their key: *Configurações › Animes ignorados*, *Configurações › Reprodução e sincronização*, *Configurações › Ajuda › Copiar relatório de diagnóstico*, “Ajustar horário”, “Abrir”, “Sua nota?”, “A verificar”, “Em reprodução”, “Alterar” / “Definir”, *(Atividade)*.

## 4. Netflix

- *Show more* button at the bottom of netflix.com/viewingactivity in pt-BR: **“Mostrar mais”**. Source: the official Netflix help article in Brazilian Portuguese (help.netflix.com/pt-br/node/101917), consistent with Brazilian press articles describing the page; the French and German versions of the same article give « Voir plus » and « Mehr anzeigen », the labels already handled by the import.
- The *Viewing activity* page is named **“O que foi assistido”** in Brazilian Portuguese (same sources).
- Firefox pt-BR gear-menu item *Manage Extension Shortcuts*: **Gerenciar atalhos de extensões** (mozilla-l10n `aboutAddons.ftl`, `addon-manage-extensions-shortcuts`).

## Development builds only

Settings › Help & about sections that exist only in development builds (2026-10-15, `settings.debugTrace.*`).

| English | Term |
|---|---|
| debug trace | rastreamento de depuração |
| event (one line of the trace) | evento |
| verbose mode | modo detalhado |
