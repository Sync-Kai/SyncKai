# Korean (`ko`) term sheet

Binding for every change to `src/i18n/locales/ko.json` and `public/_locales/ko/messages.json`. Read `docs/i18n/GLOSSARY.md` first.

## 1. Conventions

| Topic | Rule | Example |
|---|---|---|
| Register | 해요체 for sentences (statements `~해요`, requests `~하세요`); never 당신, the subject is omitted; "your" is rendered 내 (the user's own view) | 저장하지 못했어요. 다시 시도하세요. · 내 목록 |
| Buttons, menu items | Short noun or noun + verb stem, no ending | 저장, 취소, 다시 시도, 목록에서 삭제, 하차하기 |
| Status labels, chips, fragments | Nominal style (`~됨`, `~음`, `~ 중`, `없음`), no final period. Busy labels on buttons use the short noun + `중…` form | 동기화됨, 연결 안 됨, 불러오는 중…, 중지 중…, 내 목록에 없음 |
| Reason fragments (`match.*`, `sync.*`, `{reason}`) | Nominal, never an imperative: they are inserted before “. SyncKai 아이콘을 클릭해 항목을 선택하세요.” | 특별편 / OVA: 항목 선택 필요 · 제목으로만 찾음(…) |
| Messages with a colon | The part before the colon is nominal (no `-요` sentence before a colon followed by another sentence) | 편성표를 불러올 수 없음: {error} · 맞추기 중단: {message} |
| Particles after placeholders | Never attach a particle that depends on the last sound (이/가, 을/를, 은/는, 와/과, 로/으로, 이나/나) to `{title}`, `{platform}`, `{service}`, `{site}`, `{season}`… Use invariant particles (에, 에서, 의, 도, 만, 까지) or put the particle on a fixed noun: `{title} 항목을`, `{service} 세션이`, `{episode}화가` | {service}에 로그인되어 있지 않아요 · {platform} 탭이 응답하지 않아요 |
| Particles after literal product names | Allowed, read as pronounced: AniList/MyAnimeList/Netflix/Disney+/SyncKai end in a vowel (가, 를, 는, 와, 로); Crunchyroll and MAL end in ㄹ (이, 을, 은, 과, 로); ADN ends in ㄴ (이, 을, 은, 과, 으로) | AniList나 MyAnimeList를 연결하세요 · Crunchyroll이나 ADN에서 |
| Quotation marks | ‘ ’ for interface labels quoted in a sentence (buttons, tabs, Netflix page names); “ ” for anime titles and quoted entry titles. A popup tab named in a sentence is ‘활동’ 탭 / 팝업의 ‘활동’ 탭, never the calque 팝업(활동) | ‘시간 조정’에서 바꿀 수 있어요 · “{title}” 시청 완료! · 팝업의 ‘활동’ 탭에서 항목을 고르세요 |
| Colon | No space before, one space after (same as English) | 실패: {error} |
| Parentheses | Attached to the preceding word, no space; one space only after an ellipsis | 확인 필요({count}) · 병합(추천) · 기다리는 중… (필요하면 로그인하세요) |
| Ellipsis | Single character `…`, attached | 동기화 중… |
| Separators | ` · ` and ` › ` kept exactly as in English | 설정 › 제외된 작품 |
| Percent | No space | 85% |
| Units | min → 분, h → 시간, d (days) → 일, s → 초 (Korean words are already short; no abbreviation). The minutes + seconds countdown shows both units | {count}분 · {count}시간 · {count}일 · {min}분 {sec}초 |
| Relative time | Fragments that read naturally before a noun: 방금 전, {count}분 전, {count}시간 전, 어제, {count}일 전; host strings put `{relative}` first or after a colon | {relative} 시청 완료 · 마지막 확인: {relative} · 마지막 분석: {relative} |
| Retry delays | {count}분 후, {count}시간 후, {count}일 후, 곧; host string `{when} 다시 시도` | 5분 후 다시 시도 |
| Counts | No plural forms (only `_other`). Counter 개 for series, seasons, titles, errors; 건 for syncs, differences, items to handle and history records (Netflix rows); {n}화 for episode numbers and episode totals | 평가할 작품 {count}개 · 동기화 대기 {count}건 · 시청 기록 {rows}건 · 12화 |
| `{service}: {message}` | `{service}: {message}`; `{message}` is a nominal fragment | AniList: 5화 저장됨 · MyAnimeList: 실패: … |
| Already up to date (with an episode) | 이미 최신 상태({n}화), same order in toasts and details | 이미 최신 상태(5화) · Frieren |
| `{title}: completed` | `{title}: 완료` (same for 하차, 보류) | Frieren: 완료 · 활동 탭에서 평가하세요. |
| Mark as watched | 시청함으로 표시 (episode); 완료로 표시 is only the list status Completed | 현재 에피소드를 시청함으로 표시 |

## 2. Core terms

| English term | Korean | Reason |
|---|---|---|
| Watching (status, popup tab `nav.watching`) | 시청 중 | Standard tracker wording; same word for the tab |
| Completed | 완료 (sentences: 시청 완료) | The user finished the series; never 완결 / 방영 종료, which describe the anime |
| On hold | 보류 | Usual Korean rendering of On hold |
| Dropped | 하차 | The word Korean fans use for dropping a show ("3화에서 하차"); cannot be read as "Cancel" |
| Plan to watch | 시청 예정 | Pairs with 시청 중 |
| Rewatching | 재시청 중 | 다시보기 means TV catch-up in Korean, so it is avoided |
| Put on hold / Drop / Mark as completed (actions) | 보류하기 / 하차하기 / 완료로 표시 | Compact buttons: 보류 / 하차 / 완료 |
| series | 작품 | Korean fans call an anime title a 작품; 시리즈 suggests a whole franchise |
| anime | 애니 | The fans' everyday word; 애니메이션 is not used in the UI |
| season | 시즌 | Wording of the streaming platforms (시즌 2) |
| episode | 에피소드 | Standalone noun |
| Ep. N (short form before a number) | N화 | How Korean anime fans number episodes ("12화") |
| N eps. (episode total) | N화 | As in Korean listings ("2023 · 12화 · 방영 종료") |
| part (of a season on AniList) | 파트 | |
| arc / absolute numbering | 연속 번호 (absolute numbering) | Numbering that continues across seasons (One Piece 1180화) |
| list / your list | 목록 / 내 목록 | |
| entry | 항목 (AniList 항목) | Database entry of an anime on AniList / MyAnimeList; not 게시물 |
| sync (noun) / to sync | 동기화 / 동기화하다 | One noun and one verb everywhere |
| write (values to a list) | 반영 / 반영하다 (history import, AniList ↔ MAL alignment); 저장 / 저장하다 (live sync, rating, comment, pending syncs) | 기록 means a history (시청 기록, 동기화 기록): never use it for “write”, it made “시청 기록을 읽고 … 기록하기 전에” ambiguous. Decision of the 2026-10-14 review |
| synced / syncing | 동기화됨 / 동기화 중… | |
| auto sync | 자동 동기화 | |
| Stop syncing (exclude the series) | 동기화 제외 | Means excluding the series, not stopping the current sync |
| Resume syncing / Re-enable | 동기화 재개 / 다시 켜기 | |
| to check (section, chips) | 확인 필요 | Verify the match before anything is written |
| review (a "To check" card) | 확인 요청 | Never 리뷰 / 검토 (a critique) |
| to rate / Rate (verb) | 평가 대기 (section), 평가할 작품 / 평가 | |
| score, rating | 평점 | The user's score out of 10; AniList's community average is 평균 점수 |
| Your rating? (rating bubble) | 몇 점을 줄까요? | Quoted identically in `settings.ratingPrompt.help` |
| comment (`notes.*`) | 메모 | Private text on the list entry (AniList Notes, MAL Comments); never 평점 |
| match (season → AniList entry, settings "Matches") | 매칭 | Usual Korean loanword; "Forget" = 삭제 (recomputed at the next episode) |
| match / matching (AniList ↔ MAL alignment) | 맞추기 / 맞추다 | Different meaning from 매칭: copying values to the other service |
| excluded series | 제외된 작품 | Chip: 제외됨. Bare 제외 is reserved for this; an entry set aside by the matching is 후보에서 제외 |
| pending sync / queue | 대기 중인 동기화 | Footer: 동기화 대기 {count}건 |
| Abandon (a pending sync) | 포기 | |
| credits | 엔딩 | The ED, as Korean anime fans say it ("엔딩 시작 시"); the same 엔딩 시작 시 in the settings summary and the live marker (엔딩 시작 시 동기화), never the vague 엔딩에서 |
| Episode watched (sync trigger) / percentage / fallback percentage | 에피소드 시청 기준 / 시청 비율 / 대체 시청 비율 | Options: 엔딩 시작 시(추천), 고정 비율 도달 시; settings summary: 엔딩 시작 시 / {percent} 시청 시 |
| popup | 팝업 | |
| side panel | 측면 패널 | Chrome's Korean name |
| Now playing (panel tab) | 재생 중 | |
| Schedule (panel tab, `agenda.*`, settings) | 편성표 | Korean term for a broadcast schedule; settings category 알림 및 편성표 |
| On this page | 이 페이지 | |
| preferred player | 선호 플랫폼 | It is a streaming platform, not a media player app |
| history import (`crImport.*`) | 시청 기록 가져오기 | Netflix's Korean name of the Viewing activity page is also 시청 기록 |
| backup (`backup.*`, `import.*`, settings) | 백업 | Export = 내보내기, import of a backup = 가져오기; the history import always says 시청 기록 |
| history (in backups) | 동기화 기록 | SyncKai's sync history, not a streaming history |
| preview | 미리보기 | |
| rewatch | 재시청 | |
| account / connect / disconnect | 계정 / 연결 / 연결 해제 | |
| sign in / sign-in / signed out | 로그인 / 로그인 / 로그아웃 | |
| session expired | 세션 만료 | Also in the footer avatar label (세션 만료 — 설정 열기); never 계정 만료, which means the account itself expired |
| release alerts (`airing.*`, quick settings) | 방영 알림 | Browser notifications for new episodes. Status and summary fragments always say 방영 알림 (방영 알림 꺼짐, 방영 알림 +3시간, 방영 즉시 알림): the summary follows the on-page level (간단 · …), where a bare 알림 reads as the on-page notifications |
| Alerts only (in-page level), alerts that need action | 경고만 / 경고 | Different word from 알림 on purpose |
| On-page notifications | 페이지 내 알림 | Levels: 간단 (Discreet), 상세 (Detailed), 경고만 (Alerts only) |
| release (on a platform) / airing (in Japan) | 공개 / 방영 | |
| Airing statuses (`page.airing.*`) | 방영 중, 방영 종료, 방영 예정, 방영 취소, 휴방 중 | Describe the anime; never the user's statuses |
| offset, delay (`agenda.*`, settings) | 지연 시간 (minutes after the Japanese broadcast); 알림 지연 (release alert delay); 오프셋 (episode numbering offset in Matches) | |
| Adjust time | 시간 조정 | Quoted identically in `agenda.estimate.title` |
| shortcut | 단축키 | Shift key stays "Shift" (printed in English on Korean keyboards) |
| movie / special / TV short / OVA | 극장판 / 특별편 / TV 단편 / OVA | |
| Prequel / Sequel / Parent story / Side story / Spin-off | 전편 / 속편 / 본편 / 외전 / 스핀오프 | |
| tab (browser) | 탭 | |
| extension | 확장 프로그램 | Chrome's Korean term |
| Reload | 새로고침 | |
| Retry / Try again | 다시 시도 / 다시 시도하세요 | |
| Ignore (dismiss a card) | 건너뛰기 | It only skips the card; never 제외 |
| Correct (fix a sync) | 수정 | |
| Settings (`nav.settings`) | 설정 | |
| Settings categories | 계정 (Accounts), 재생 및 동기화 (Playback & sync), 알림 및 편성표 (Notifications & schedule), 단축키 (Shortcuts), 내 데이터 (My data), 언어 (Language), 도움말 및 정보 (Help & about) | Groups: 빠른 설정, 재생 및 알림, 데이터 및 도움말 |
| Settings categories of the 2026-10-17 redesign | Platforms = **플랫폼** · Notifications (`settings.cat.notifications`, one word: the Schedule options moved to Platforms) = **알림** · Display = **표시** | Playback & sync (`settings.cat.sync`) was removed |
| Settings sections | 제외된 작품, 매칭, 백업, 가져오기, 새 에피소드, 편성표, 재생, 동기화, 측면 패널, 도움말, 정보, 위험 구역 | |
| Activity (popup tab) | 활동 | Quoted as 활동 탭 / 팝업의 ‘활동’ 탭 |
| Continue (card) | 이어 보기 | |
| My series | 내 작품 | |
| optional (Netflix, Disney+) | 선택 사항 | Bare 선택 can read as “select” |
| Tab on opening / Last opened (side panel settings) | 시작 탭 / 최근에 연 탭 | 마지막 탭 next to 시작 탭 read as “the rightmost tab” |
| open in a (new) tab | 새 탭에서 열기 | Chrome's wording; not the calque 탭으로 열기 |

## 3. Netflix

- Viewing activity page (netflix.com/viewingactivity): ‘시청 기록’.
- "Show more" button at the bottom of that page: unknown

  Probable candidate, not verified on a Korean profile: “더 보기” (spacing not confirmed: “더보기” is also possible). The UI text `crImport.netflix.rule` uses ‘더 보기’.

## Development builds only

Settings › Help & about sections that exist only in development builds (2026-10-15, `settings.debugTrace.*`).

| English | Term |
|---|---|
| debug trace | 디버그 추적 |
| event (one line of the trace) | 이벤트 |
| verbose mode | 상세 모드 |

## Settings › Sync (2026-10-17)

| English | Term |
|---|---|
| Automatic (Sync section) | 자동 |
| Per series (Sync section) | 작품별 |
| Never synced (Excluded series section) | 동기화하지 않음 |
| Match origins: chosen / learned / legacy / imported · to recheck | 직접 선택 / 자동 학습 / 이전 방식 / 가져옴 · 다시 확인 |

## Settings › Platforms and Notifications (2026-10-17)

| English | Term |
|---|---|
| Where SyncKai follows your episodes (section) | SyncKai가 에피소드를 추적하는 곳 |
| Included (built-in platform) | 기본 포함 |
| Access missing | 접근 권한 없음 |
| Turn on first (preferred player option) | 먼저 켜기 |
| Estimated release time | 예상 공개 시각 |
| Extra delay (release alerts) | 추가 지연 |
| On the playback page (Notifications section) | 재생 페이지에서 |

## Settings › My data and Help & about (2026-10-17)

| English | Term |
|---|---|
| Compare (My data section) | 비교 |
| AniList ↔ MyAnimeList differences (row title) | AniList ↔ MyAnimeList 차이 |
| Align (differences section) | 맞추기 |
| Diagnostic report (row title) | 진단 보고서 |
| Copy the report (button) | 보고서 복사 |
| What's new (About link) | 새로운 기능 |
| Privacy (About link) | 개인정보 |
