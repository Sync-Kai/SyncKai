# Korean (`ko`) review log

Independent native-level review of `src/i18n/locales/ko.json` (878 keys) and `public/_locales/ko/messages.json`, 2026-10-14. Reference: `en.json`, with `fr.json` / `de.json` and the context note of every key (`docs/i18n/context.json`). Term sheet: `docs/i18n/glossary/ko.md`.

## Method

1. **Terminology audit**: every term-sheet decision checked against the shared glossary and the vocabulary of Korean anime fans; then each core concept searched in the whole catalog (series, season, episode, list, entry, sync, to check, to rate, score, comment, match, excluded, pending sync, credits, popup, side panel, Now playing, Schedule, On this page, preferred player, history import, backup, preview, rewatch, account / connect / session expired, release alerts, Settings and its categories, the six list statuses, Activity, Watching).
2. **Key-by-key review** of all 878 keys with their context notes: meaning (back-translation against en / fr), grammar, 띄어쓰기, punctuation, 해요체, placeholders with realistic values, composed texts (`{service}: {message}`, `{reason}. …`, settings summaries `<level> · <alerts>`, relative times), cross-references (Settings › … paths, quoted tab and button names), length (Hangul counted ≈ 1.85 Latin widths against the limits of the notes).
3. **Automated checks** (scratch scripts): sound-dependent particles after placeholders and closing quotes / parentheses (none left: only invariant particles 에, 에서, 의, 만, or particles on a fixed noun / counter: 화가, 개를…), particles after literal product names (all correct: Crunchyroll이나 / Crunchyroll과, ADN을 / ADN은, AniList나 / AniList와, MyAnimeList를, Netflix는, Disney+와, SyncKai가), final punctuation versus English (only the abbreviation dots of `ep.` differ, as intended), 합니다체 / 반말 / 당신 (none), ASCII `...` and straight quotes (none).
4. `npm run i18n:check -- ko`: 0 errors, 0 warnings after the fixes.

## Terminology audit

The term sheet is sound and was kept: 작품 (series), 항목 (entry), 시청 중 / 완료 / 보류 / 하차 / 시청 예정 / 재시청 중 (statuses), 동기화, 확인 필요 / 확인 요청, 평점, 메모, 매칭 vs 맞추기, 제외된 작품, 대기 중인 동기화, 엔딩, 팝업, 측면 패널, 재생 중, 편성표, 이 페이지, 선호 플랫폼, 시청 기록 가져오기 vs 백업, 미리보기, 재시청, 세션 만료, 방영 알림 vs 경고, settings categories. Every tab, button and Settings path quoted in another string matches its own key (설정 › 재생 및 동기화, 설정 › 제외된 작품, 설정 › 도움말 › 진단 보고서 복사, ‘시간 조정’, ‘재생 중’, ‘열기’, ‘완료’, ‘몇 점을 줄까요?’, ‘변경’ / ‘지정’, ‘확인 필요’, ‘시청 중’), and the browser shortcut names in `messages.json` equal `settings.shortcuts.episode` / `settings.shortcuts.panel`.

Inconsistencies found and fixed (term sheet updated):

- **기록 used for two concepts**: “history” (시청 기록, 동기화 기록) and “to write” (기록하다). On the history-import page this gave “시청 기록을 읽고 … 기록하기 전에”. Writing values to a list is now 반영 (import, AniList ↔ MAL alignment) or 저장 (sync); 기록 only means a history. 9 keys.
- **Bare 알림 for release alerts** in status / summary fragments: the settings summary is “<on-page level> · <alerts>”, so “간단 · 알림 꺼짐” read as “notifications off”. Now always 방영 알림 (as the ja / zh catalogs do). 5 keys.
- **Bare 제외** for an entry set aside by the matching (reserved for excluded series): now 후보에서 제외.
- **계정 만료** in the footer avatar label: now 세션 만료, the session-expired term.
- **엔딩에서** (summary, live marker) vs 엔딩 시작 시 (the setting it reflects): aligned on 엔딩 시작 시.
- **선택** vs **선택 사항** for “optional”: aligned on 선택 사항.
- **“팝업(활동)”** (calque of “popup (Activity)”): the tab is named as 팝업의 ‘활동’ 탭.

## Changes

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `agenda.adjust.help` | 일본 방영 후 공개까지 걸리는 시간(분, {min}~{max}). | 일본 방영 후 공개까지 걸리는 시간(분 단위, {min}~{max}). | style | “분,” read as a stray noun; “분 단위” states the unit |
| `agenda.empty.week` | 이번 주에는 시청 중인 작품의 에피소드가 없어요. | 이 주에는 시청 중인 작품의 에피소드가 없어요. | meaning | the text is about the displayed week, which may be another week; 이번 주 only means the current week |
| `agenda.error` | 편성표를 불러올 수 없어요: {error} | 편성표를 불러올 수 없음: {error} | typography | a -요 sentence followed by a colon and a second full sentence reads badly; nominal head like 인증 실패: / 맞추기 중단: |
| `airing.skip.disabled` | 알림 꺼짐 | 방영 알림 꺼짐 | terminology | bare 알림 can be read as the on-page notifications; the switched-off setting is 방영 알림 (release alerts) |
| `airing.status.notified_other` | 에피소드 {count}개 알림 | 에피소드 {count}개 알림 보냄 | meaning | “N개 알림” reads as a noun label; the status says N episodes were announced |
| `api.rateLimited` | {service}에 요청이 너무 많아요. 1분 후에 다시 시도하세요. | {service}에 보낸 요청이 너무 많아요. 1분 후에 다시 시도하세요. | meaning | could be read as “{service} is overloaded”; it is SyncKai’s own requests that hit the limit |
| `compare.intro` | 두 목록 전체를 비교해요: 진행도, 상태, 평점, 한쪽에만 있는 작품. 승인하기 전에는 아무것도 바뀌지 않아요. | 두 목록 전체에서 진행도, 상태, 평점과 한쪽에만 있는 작품을 비교해요. 승인하기 전에는 아무것도 바뀌지 않아요. | style | colon + bare noun list after a 해요 sentence is a calque of EN/FR; one natural sentence |
| `compare.job.stopping` | 중지하는 중… | 중지 중… | consistency | other busy labels use the short “… 중…” form (연결 중…, 동기화 중…); shorter for the button |
| `compare.keepAria` | {title}: {source} 유지({target}에 기록) | {title}: {source} 유지({target}에 반영) | terminology | 기록 is reserved for history (시청 기록, 동기화 기록); writing values to a list = 반영, as in compare.result.updated (반영됨) |
| `compare.keepTitle` | {source} 값을 {target}에 기록해요 | {source} 값을 {target}에 반영해요 | terminology | same: write to a list = 반영 |
| `content.unreachable.full` | SyncKai에 연결할 수 없음. 페이지를 새로고침한 다음 다시 시도하세요. | SyncKai에 연결할 수 없어요. 페이지를 새로고침한 다음 다시 시도하세요. | grammar | nominal fragment + period mixed with a 해요 sentence in one message; full sentence, same content as title + message |
| `crImport.intro` | SyncKai가 {platform} 탭에서 시청 기록을 읽고 AniList에서 각 시즌을 찾은 다음, 기록하기 전에 무엇이 바뀌는지 보여 줘요. | SyncKai가 {platform} 탭에서 시청 기록을 읽고 AniList에서 각 시즌을 찾은 다음, 목록에 반영하기 전에 무엇이 바뀌는지 보여 줘요. | terminology | “기록하기 전에” right after “시청 기록” is ambiguous (history vs. write); write to the lists = 반영 |
| `crImport.connect.openFailed` | {platform} 열기에 실패했어요. 탭에서 {site}에 접속하세요. | {platform} 열기에 실패했어요. 새 탭에서 직접 {site}에 접속하세요. | meaning | the user has to open the site manually (직접); 새 탭에서 is the natural phrasing |
| `crImport.read.error.unavailable` | 가져오기를 사용할 수 없어요. {platform} 사이트가 바뀌었어요. 시청 중 동기화에는 영향이 없어요. | {platform} 사이트가 바뀌어서 가져오기를 사용할 수 없어요. 시청 중 동기화에는 영향이 없어요. | style | three choppy sentences; the cause–effect link reads naturally in one sentence |
| `crImport.netflix.rule` | Netflix: SyncKai는 ‘시청 기록’ 페이지의 ‘더 보기’ 버튼으로만 기록을 불러오고(다른 것은 클릭하지 않아요), AniList에서 찾은 애니만 남겨 진행도를 읽어요. | Netflix: SyncKai는 ‘시청 기록’ 페이지의 ‘더 보기’ 버튼만 눌러 기록을 불러오고, AniList에서 찾은 애니만 골라 진행도를 읽어요. | style | a full 해요 sentence in parentheses inside another sentence; “버튼만 눌러” already says nothing else is clicked |
| `crImport.netflix.rows` | Netflix 시청 기록 불러오는 중: {rows}줄… | Netflix 시청 기록 불러오는 중: {rows}건… | style | history records are counted with 건 (시청 기록 240건); 줄 (text lines) sounds technical |
| `crImport.analyze.hint` | 아직 아무것도 기록하지 않았어요. 이 페이지를 닫아도 분석은 계속되고, 다시 열면 진행 상황을 이어서 보여 줘요. | 아직 목록에는 아무것도 반영하지 않았어요. 이 페이지를 닫아도 분석은 계속되고, 다시 열면 진행 상황을 이어서 보여 줘요. | terminology | same 기록 ambiguity on the history-import page; says what is not written yet (the lists) |
| `crImport.preview.upToDate_other` | 이미 최신 {count}개 | 이미 최신 상태 {count}개 | grammar | 최신 cannot stand alone before a count; same wording as crImport.preview.upToDateTitle (이미 최신 상태) |
| `crImport.review.help` | 불확실한 매칭이라 아무것도 기록하지 않아요. 확인 요청을 만들어 팝업(활동)에서 항목을 고르세요. | 불확실한 매칭이라 아무것도 반영하지 않아요. 확인 요청을 만들어 팝업의 ‘활동’ 탭에서 항목을 고르세요. | cross-reference | “팝업(활동)” is a calque of “(Activity)”; the tab is quoted as ‘활동’ 탭 (term-sheet quoting rule); 기록 → 반영 |
| `crImport.review.created_other` | 확인 요청 {count}개를 만들었어요. 팝업(활동)에서 항목을 고르세요. | 확인 요청 {count}개를 만들었어요. 팝업의 ‘활동’ 탭에서 항목을 고르세요. | cross-reference | same: name the Activity tab as ‘활동’ 탭 |
| `crImport.skip.sessionClosed` | {service}: 가져오는 중 계정이 로그아웃되거나 바뀌어서 아무것도 기록하지 않음 | {service}: 가져오는 중 계정이 로그아웃되거나 바뀌어서 아무것도 반영하지 않음 | terminology | write to a list = 반영 (기록 = history) |
| `crImport.result.skipped` | 기록할 내용 없음 | 반영할 내용 없음 | terminology | write to a list = 반영 (기록 = history) |
| `crImport.error.notConnected` | 시청 기록을 가져오려면 AniList나 MyAnimeList를 연결하세요(설정). | 시청 기록을 가져오려면 설정에서 AniList나 MyAnimeList를 연결하세요. | style | trailing “(설정)” is a calque of “(Settings)”; Korean says where to do it inside the sentence |
| `footer.chip.expired` | {service} 계정 만료 — 설정 열기 | {service} 세션 만료 — 설정 열기 | terminology | 계정 만료 means the account itself expired; it is the sign-in session (세션 만료, as common.sessionExpired) |
| `match.specialSeason` | 특별편 / OVA: 항목을 선택하세요 | 특별편 / OVA: 항목 선택 필요 | consistency | reasons are nominal fragments; inside “{reason}. SyncKai 아이콘을 클릭해 항목을 선택하세요.” the same imperative appeared twice |
| `match.otherSeriesExcluded` | 플랫폼의 다른 작품에 연결된 항목을 제외함: 시즌 확인 필요 | 플랫폼의 다른 작품에 연결된 항목을 후보에서 제외함: 시즌 확인 필요 | terminology | bare 제외 is the “excluded series” term (user exclusion); here an entry is set aside from the candidates |
| `onboarding.intro` | Crunchyroll이나 ADN에서 애니를 보세요(Netflix, Disney+는 선택). 에피소드가 끝날 때마다 SyncKai가 내 목록을 업데이트해요. | Crunchyroll이나 ADN에서 애니를 보세요(Netflix, Disney+는 선택 사항). 에피소드가 끝날 때마다 SyncKai가 내 목록을 업데이트해요. | consistency | “optional” is 선택 사항 elsewhere (watching.tip, crImport.connect.netflixAccess); bare 선택 can read as “select” |
| `panel.live.pointCredits` | 엔딩에서 동기화 | 엔딩 시작 시 동기화 | consistency | same wording as the setting it reflects (settings.trigger.credits: 엔딩 시작 시); “엔딩에서” is vague |
| `panel.nowPlaying.notFoundHint` | 항목을 고르려면 에피소드를 끝까지 보세요. 그러면 SyncKai가 팝업(‘확인 필요’)에서 물어봐요. | 항목을 고르려면 에피소드를 끝까지 보세요. 그러면 SyncKai가 팝업의 ‘확인 필요’에서 물어봐요. | style | parenthesised section name is a calque; natural genitive phrasing |
| `popup.includeFailed` | 동기화 재개 실패, 다시 시도하세요 | 재개 실패, 다시 시도하세요 | length | chip limit (~25 chars) exceeded (≈31 Latin widths); shown right after 동기화 재개, parallel to popup.excludeFailed (제외 실패, …) |
| `queue.sessionClosed` | 그 후 로그아웃된 계정의 동기화라서 아무것도 기록하지 않고 삭제했어요. | 그 후 로그아웃된 계정의 동기화라서 아무것도 저장하지 않고 삭제했어요. | terminology | write verb of a sync = 저장 (feedback.service.updated: N화 저장됨); 기록 = history |
| `review.excludeTitle` | 작품 전체(모든 시즌)를 제외해요. 설정 › 제외된 작품에서 다시 켤 수 있어요 | 작품 전체(모든 시즌)를 동기화에서 제외해요. 설정 › 제외된 작품에서 다시 켤 수 있어요 | meaning | “제외해요” alone does not say from what (tooltip of 동기화 제외) |
| `settings.airing.enableFirst` | 확인하려면 먼저 알림을 켜세요 | 확인하려면 먼저 방영 알림을 켜세요 | terminology | the toggle to turn on is the release alert (방영 알림), not on-page notifications |
| `settings.backup.exportTabTitle` | ‘백업’ 페이지를 탭으로 열고 .json 파일을 다운로드해요 | ‘백업’ 페이지를 새 탭에서 열고 .json 파일을 다운로드해요 | style | “탭으로 열다” is a calque of “open in a tab”; Korean UIs say 새 탭에서 열기 |
| `settings.backup.importTitle` | ‘백업’ 페이지를 탭으로 열어요 | ‘백업’ 페이지를 새 탭에서 열어요 | style | same: 새 탭에서 열어요 |
| `settings.netflix.helpOff` | AniList에서 Netflix와 연결된 애니만 동기화해요. 브라우저가 netflix.com 접근 권한을 요청해요 | AniList에서 Netflix와 연결된 애니만 동기화해요. 켜면 브라우저가 netflix.com 접근 권한을 요청해요 | meaning | the plain present said the browser is asking now; the prompt appears when the toggle is turned on (EN “will ask”) |
| `settings.disney.helpOff` | AniList에서 Disney+와 연결된 일본 애니만 동기화해요. 브라우저가 disneyplus.com 접근 권한을 요청해요 | AniList에서 Disney+와 연결된 일본 애니만 동기화해요. 켜면 브라우저가 disneyplus.com 접근 권한을 요청해요 | meaning | same as settings.netflix.helpOff |
| `settings.panel.defaultTab` | 처음 열 탭 | 시작 탭 | style | “처음 열 탭” is an unidiomatic relative clause; 시작 탭 is the usual label (cf. 시작 페이지) |
| `settings.panel.tab.last` | 마지막 탭 | 최근에 연 탭 | meaning | next to the label 시작 탭, “마지막 탭” reads as “the last (rightmost) tab”; the option reopens the tab used last time |
| `settings.summary.airingDelay` | 알림 +{hours}시간 | 방영 알림 +{hours}시간 | terminology | follows the on-page level (“간단 · …”), so bare 알림 read as on-page notifications; ja/zh catalogs also repeat the full term |
| `settings.summary.airingOff` | 알림 꺼짐 | 방영 알림 꺼짐 | terminology | same: “간단 · 알림 꺼짐” looked like “notifications off” |
| `settings.summary.airingOnTime` | 정시 알림 | 방영 즉시 알림 | terminology | 정시 알림 reads as an on-the-hour alarm; the release alert is sent right at airing time |
| `settings.summary.credits` | 엔딩에서 | 엔딩 시작 시 | consistency | same wording as settings.trigger.credits (엔딩 시작 시) |
| `settings.summary.percentage` | {percent}에서 | {percent} 시청 시 | style | “ADN · 85%에서” leaves the verb implicit; “85% 시청 시” parallels “엔딩 시작 시” |
| `sync.noServiceFollows` | 연결된 서비스 중 이 작품을 추적하는 곳이 없어요. | 연결된 서비스 어디에도 이 작품의 항목이 없어요. | meaning | the error means no connected service has an entry (ID) for this anime; “추적하는 곳” is a literal calque of “tracking” |
| `sync.sessionClosed` | 그 사이 계정이 로그아웃되거나 바뀌어서 아무것도 기록하지 않음 | 그 사이 계정이 로그아웃되거나 바뀌어서 아무것도 저장하지 않음 | terminology | write verb of a sync = 저장; 기록 = history |
| `toast.pill.upToDate` | {episode}화 이미 최신 상태 | 이미 최신 상태({episode}화) | consistency | same structure as feedback.service.upToDate; “5화 이미 최신 상태” reads as broken word order |
| `watching.empty.text` | Crunchyroll이나 ADN에서 에피소드를 재생하세요. 다음 에피소드 날짜와 함께 여기에 표시돼요. | Crunchyroll이나 ADN에서 에피소드를 재생하세요. 작품이 다음 에피소드 날짜와 함께 여기에 표시돼요. | meaning | the second sentence had no subject, so it seemed the episode/date shows up; “it” is the series (작품) |
| `watching.empty.textPlatforms` | {platforms}에서 에피소드를 재생하세요. 다음 에피소드 날짜와 함께 여기에 표시돼요. | {platforms}에서 에피소드를 재생하세요. 작품이 다음 에피소드 날짜와 함께 여기에 표시돼요. | meaning | same as watching.empty.text |
| `import.replace.detail` | 이 데이터를 지우고 교체해요 | 이 데이터를 지우고 파일 내용으로 바꿔요 | style | “지우고 교체” is redundant and repeats the option title (교체); says what replaces the data |

**50 changes**: terminology 15, style 12, meaning 11, consistency 6, grammar 2, cross-reference 2, typography 1, length 1. No placeholder error was found (all placeholders present and correctly spelled; checked automatically before and after the fixes). `public/_locales/ko/messages.json` needed no change: `extDescription` is natural and 58 characters long (≤ 132), the two shortcut names match the Settings rows.

## Debatable, left unchanged

| Key | Current text | Why it was kept |
|---|---|---|
| `page.episodes_other`, `review.episodes` | {count}화 | An episode total looks like an episode number (12화). Kept: it appears in metadata lines (2023 · 12화 · 방영 종료) as on Korean listing sites; 총 {count}화 would be unambiguous but longer. |
| `panel.nowPlaying.season.*` | 가을 (code appends “ 2024”) | Korean order is 2024년 가을 / 2024 가을, but the code appends the year after the word; needs a `{year}` placeholder in the code, not a catalog fix. |
| `settings.notif.discreet.title` | 간단 | “Discreet” means unobtrusive; 간단 (simple) pairs naturally with 상세 (detailed). 최소 or 조용히 were considered. |
| `queue.abandon` (+ `queue.abandonAria`, `popup.abandonFailed`) | 포기 | Literal “give up”, unusual on a button, but 삭제 / 취소 would collide with Remove / Cancel. Term-sheet decision. |
| `backup.fileName` | synckai-백업-{date}.json | Hangul file names work, but can show decomposed jamo when copied from macOS to Windows; synckai-backup-… would be safer. Kept because the note asks to translate the word. |
| `prompt.rating.question` | 몇 점을 줄까요? | Friendly and natural; the -ㄹ까요 form can also read as “shall I give…”. Alternatives: 몇 점 줄래요?, 평점을 매겨 주세요. Quoted identically in `settings.ratingPrompt.help`. |
| `onboarding.step3` | 엔딩 때 목록이 업데이트돼요 | EN “by the credits” (already done when they start); the fuller 엔딩이 나올 때면 목록이 이미 업데이트돼 있어요 does not fit the ≈ 35-char column. |
| `compare.bulk.filtered.anilist` / `.mal` | 필터만 AniList에 맞추기 | Literally “only the filter”, mirroring EN / FR; 필터 결과만 is clearer but exceeds the 24-char button. |
| `watching.confirm.COMPLETED` | 완료할까요? | 완료로 표시할까요? is more explicit but slightly over the ~14-char limit; the menu context makes it clear. |
| `settings.entry.label` | 기본 항목 페이지 | Consistent with 항목 = entry; 기본으로 열 페이지 would be plainer. |
| `page.notTracked`, `page.platformOff`, `popup.hostAccessDenied`, `settings.disney.helpOn` | 추적 | Usual app wording for “track”; 기록 is avoided because it means history. |
| `settings.help.cleared` | 로그 삭제됨 | Button says 로그 지우기; 삭제 / 지우기 are interchangeable in Korean UIs. |

## Residual doubts for a native human reviewer

- `crImport.netflix.rule`: Netflix Korea's label of the “Show more” button on the 시청 기록 page (더 보기 vs 더보기) was not verified on a Korean profile.
- `settings.shortcut.manualFirefox`: Firefox ko gear-menu item “확장 기능 단축키 관리” is believed to match mozilla-l10n but was not checked in a live Korean Firefox.
- `settings.panel.tab.last` (최근에 연 탭) and `settings.panel.defaultTab` (시작 탭): check the fit in the 3-button control of the side panel settings.
- `extDescription` keeps the app's 해요체; Korean store descriptions often use 합니다체 or a noun ending.
- The debatable strings above, in priority: 간단 (Discreet), {count}화 for totals, 포기, season / year order.

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | 겨울 / 봄 / 여름 / 가을 | {year}년 겨울 / {year}년 봄 / {year}년 여름 / {year}년 가을 | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |

Code fixes that change how this catalog is displayed:

- `panel.nowPlaying.season.*` take a `{year}` placeholder: “{year}년 가을” (the debatable season / year order above is resolved).
- Netflix history import: the Korean “Show more” label (더 보기 / 더보기) is still unverified and was NOT added; a Korean-profile import still reads only the first rows.
- The signed delays of the Schedule tooltips (`agenda.estimate.*`) now use `time.countdown.*`: “+1시간 30분”.
- Lists of names in `{services}` and `{titles}` use the language’s own conjunction (`Intl.ListFormat`) instead of “, ”.

Layout (`npm run test:i18n-layout`): no finding in this language.

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). No plural forms in this language: one `_other` variant with the same text, `{total}` renamed `{count}`.

| Key | Text |
|---|---|
| `sync.beyondEntry_other` | {progress}화가 항목의 전체 {count}화를 넘음 |

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | Netflix 프로필 언어에서 ‘더 보기’ 버튼을 인식하지 못해 최근 에피소드만 읽었어요. Netflix에서 그 프로필의 언어를 SyncKai와 같게 바꾼 다음 다시 읽으세요. |

Netflix history import: the “더 보기” button of a Netflix profile in Korean is now recognized (label from Netflix's help article 101917 in this language, same text as `crImport.netflix.rule`).

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video(애니만) |
| `settings.prime.label` | Prime Video에서 동기화 |
| `settings.prime.helpOff` | 애니만 동기화해요(애니 장르, 또는 일본어 음성이 있거나 AniList 제목과 정확히 같은 애니메이션). 켜면 브라우저가 primevideo.com 접근 권한을 요청해요 |
| `settings.prime.helpOn` | SyncKai는 Prime Video 페이지가 이미 받는 정보만 읽어요. 이미 열려 있던 Prime Video 탭에서는 다음 에피소드부터 추적해요 |
| `settings.prime.denied` | primevideo.com 접근이 거부되어 Prime Video는 꺼진 상태로 유지돼요 |
| `settings.prime.disabled` | Prime Video 꺼짐: 완전히 멈추려면 열려 있는 Prime Video 탭을 새로고침하세요 |
| `settings.prime.error` | Prime Video 접근 권한을 변경하지 못했어요. 다시 시도하세요 |

| Key | Text |
|---|---|
| `onboarding.intro` | Crunchyroll이나 ADN에서 애니를 보세요(Netflix, Disney+, Prime Video는 선택 사항). 에피소드가 끝날 때마다 SyncKai가 내 목록을 업데이트해요. |
| `watching.tip` | Netflix, Disney+, Prime Video(선택 사항), 선호 플랫폼은 {path}에서 설정해요. |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | 플랫폼 정보와 일치: {signals} |
| `match.signalsContradict` | 플랫폼 정보와 불일치: {signals} |
| `match.yearRemake` | 방영 연도({year}년)로 리메이크작 구분 |
| `match.signal.year` | 방영 연도 |
| `match.signal.episodes` | 에피소드 수 |
| `match.signal.duration` | 에피소드 길이 |
| `match.signal.format` | 형식(극장판 또는 시리즈) |
| `match.signal.country` | 제작 국가 |
| `match.signal.originalTitle` | 원제 |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | 저장된 매칭이 플랫폼 정보와 불일치: {signals} |
