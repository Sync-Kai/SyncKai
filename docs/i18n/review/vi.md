# Vietnamese (`vi`) review log

Independent native review of `src/i18n/locales/vi.json` (878 keys: the 934 English keys minus the 56 `_one` variants, Vietnamese only has `_other`) and `public/_locales/vi/messages.json`, 2026-10-14. Inputs: `docs/i18n/GLOSSARY.md`, `docs/i18n/glossary/vi.md`, `docs/i18n/context.json`, `en.json`, `fr.json`, `de.json`.

## Method

- Key-by-key reading of every key with its context note, side by side with EN, FR and DE (meaning, grammar, register, placeholders, composed texts, cross-references, length limits), then a second pass reading the Vietnamese alone for naturalness.
- Mechanical scans: Unicode NFC (no decomposed tone marks), combining characters, straight quotes, `...` instead of `…`, double or edge spaces, spacing around punctuation, final punctuation against EN, tone-mark placement style (new style everywhere: hủy, tùy), word list of the whole catalog for typos.
- Concordance of every core term (series/bộ, entry/mục, tab/thẻ, sync/đồng bộ and its counted form lượt đồng bộ, to check/cần kiểm tra, to rate/cần chấm điểm, score/điểm, comment/ghi chú, match/ghép nối, excluded/loại trừ, pending sync/đồng bộ đang chờ, credits/ending, popup, side panel/bảng điều khiển bên, Now playing/Đang phát, Schedule/Lịch chiếu, On this page/Trên trang này, preferred player/nền tảng ưu tiên, history import/nhập lịch sử xem, backup/sao lưu, preview/xem trước, rewatch/xem lại, account/connect/session, release alerts/thông báo tập mới, the six list statuses, Activity, Watching, Settings and every category name).
- Composed texts checked with realistic values: `{service}: {message}` fragments, relative times after "Đã phân tích", "Đã xem xong", "Kiểm tra lần cuối:", retry delays after "Tự thử lại", `{platforms}` lists built by `Intl.ListFormat('vi')` ("Crunchyroll, ADN hoặc Netflix"), the long date of the backup page (`lúc 21:09 13 tháng 10, 2026`), decimals (`8,5`).
- External names re-checked: Netflix "Hoạt động xem" and "Hiển thị thêm" (help.netflix.com/vi/node/101917), Chrome "bảng điều khiển bên" (Chrome help center, "Quản lý bảng điều khiển bên của Chrome"), Firefox "Quản lý phím tắt tiện ích mở rộng" (mozilla-l10n `vi/toolkit/toolkit/about/aboutAddons.ftl`, `addon-manage-extensions-shortcuts`).

## Result

- 44 keys changed in `vi.json`: meaning 11, terminology 11, style 8, consistency 6, grammar 5, typography 2, length 1. No placeholder, plural or NFC error was found; the translation was already of good quality.
- `messages.json` unchanged: `extDescription` 76 characters, natural ("đồng bộ … lên AniList"); `cmdCompleteEpisode` and `cmdOpenSidePanel` identical to `settings.shortcuts.episode` / `settings.shortcuts.panel`.
- Every cross-reference verified identical to its target: “Chỉnh giờ”, “Mở”, “Thay đổi” / “Đặt phím”, “Đang phát”, “Bạn chấm mấy điểm?”, “Cần kiểm tra”, (Hoạt động), thẻ Đang xem, Cài đặt › Xem & đồng bộ, Cài đặt › Bộ anime bị loại trừ, Cài đặt › Trợ giúp › Sao chép báo cáo chẩn đoán, trang Sao lưu, `content.unreachable.full` = title + ". " + message.
- `npm run i18n:check -- vi`: 0 errors, 35 length warnings; each one was checked against the limit in its context note (all within it, e.g. `common.syncing` 13 characters where FR has 16, `settings.cat.help` 21 ≤ 22, `watching.confirm.DROPPED` 13 ≤ 14).

## Changes

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `agenda.empty.noSeries` | `Chưa có bộ anime nào đang xem. Hãy bắt đầu xem một bộ trên Crunchyroll hoặc ADN, lịch ra tập của bộ đó sẽ hiện ở đây.` | `Chưa có bộ anime nào đang xem. Hãy bắt đầu xem một bộ trên Crunchyroll hoặc ADN: lịch ra tập của bộ đó sẽ hiện ở đây.` | typography | Comma splice; colon as in watching.empty.text (and required by the {platforms} variant) |
| `agenda.empty.noSeriesPlatforms` | `Chưa có bộ anime nào đang xem. Hãy bắt đầu xem một bộ trên {platforms}, lịch ra tập của bộ đó sẽ hiện ở đây.` | `Chưa có bộ anime nào đang xem. Hãy bắt đầu xem một bộ trên {platforms}: lịch ra tập của bộ đó sẽ hiện ở đây.` | typography | With {platforms} = “Crunchyroll, ADN hoặc Netflix” the comma made the clause read as one more list item |
| `agenda.error` | `Lịch chiếu không khả dụng: {error}` | `Không tải được lịch chiếu: {error}` | style | “không khả dụng” is a stiff calque of “unavailable”; same pattern as panel.nowPlaying.detailsError “Không tải được …” |
| `agenda.menu` | `Thêm thao tác cho {title}` | `Thao tác khác cho {title}` | meaning | “Thêm thao tác” reads as “Add an action”; “More actions” is “Thao tác khác” (Google/Chrome Vietnamese UI) |
| `airing.notification.single` | `{title} đã ra tập {episode}` | `Đã ra tập {episode} của {title}` | length | The browser truncates long notification titles: the episode number must come before the (often long) title, as in EN/FR/DE |
| `auth.exchangeFailed.mal` | `MyAnimeList từ chối hoàn tất đăng nhập (mã đã hết hạn hoặc App Redirect URL khác). Hãy thử lại và kiểm tra xem App Redirect URL có đúng là: {url}` | `MyAnimeList từ chối hoàn tất đăng nhập (mã đã hết hạn hoặc App Redirect URL không khớp). Hãy thử lại và đảm bảo App Redirect URL là: {url}` | grammar | “kiểm tra xem … có đúng là” needs a closing “không”, impossible with {url} last; “khác” → “không khớp” (does not match the registered URL) |
| `auth.rejected.anilist` | `AniList đã từ chối yêu cầu. Hãy kiểm tra xem Redirect URL của client có đúng là: {url}` | `AniList đã từ chối yêu cầu. Hãy đảm bảo Redirect URL của client là: {url}` | grammar | Unfinished “kiểm tra xem … có đúng là” question; {url} must stay last |
| `auth.rejected.mal` | `MyAnimeList đã từ chối yêu cầu. Hãy kiểm tra xem App Redirect URL có đúng là: {url}` | `MyAnimeList đã từ chối yêu cầu. Hãy đảm bảo App Redirect URL là: {url}` | grammar | Same unfinished question as auth.rejected.anilist |
| `crImport.platform` | `Nền tảng có lịch sử` | `Nền tảng lấy lịch sử` | meaning | “Nền tảng có lịch sử” = “platform that has a history”; the group picks the platform the history is read from |
| `crImport.reason.numbering` | `Không rõ vị trí của tập trong mùa (mùa đã bị gỡ khỏi danh mục?)` | `Không rõ vị trí của tập trong mùa (mùa đã bị gỡ khỏi nền tảng?)` | meaning | “danh mục” means category/list, not a streaming catalog; “gỡ khỏi nền tảng” says what happened |
| `crImport.review.created_other` | `Đã tạo {count} yêu cầu kiểm tra: hãy chọn mục trong popup (Hoạt động).` | `Đã tạo {count} yêu cầu kiểm tra: hãy chọn mục AniList trong popup (Hoạt động).` | terminology | Same as crImport.review.help |
| `crImport.review.help` | `Ghép nối chưa chắc chắn: chưa ghi gì cả. Hãy tạo yêu cầu kiểm tra để chọn mục trong popup (Hoạt động).` | `Ghép nối chưa chắc chắn: chưa ghi gì cả. Hãy tạo yêu cầu kiểm tra để chọn mục AniList trong popup (Hoạt động).` | terminology | “chọn mục trong popup (Hoạt động)” could read as picking a menu item of the popup; entry named as an AniList entry |
| `engagement.lastEpisode` | `Tập {progress} là tập cuối: không xem lại` | `Tập {progress} là tập cuối: không chuyển sang xem lại` | meaning | “không xem lại” reads as “don’t rewatch”; the line reports that the status was not switched to Rewatching |
| `engagement.notCompleted` | `Chưa đánh dấu xem xong: không xem lại` | `Chưa đánh dấu xem xong: không chuyển sang xem lại` | meaning | Same as engagement.lastEpisode |
| `feedback.notConnected.message` | `Nhấn vào biểu tượng SyncKai để kết nối AniList hoặc MyAnimeList.` | `Hãy nhấn vào biểu tượng SyncKai để kết nối AniList hoặc MyAnimeList.` | consistency | Full-sentence imperatives use the soft “Hãy” everywhere else (term sheet register) |
| `feedback.review.message` | `{reason}. Nhấn vào biểu tượng SyncKai để chọn mục.` | `{reason}. Hãy nhấn vào biểu tượng SyncKai để chọn đúng mục AniList.` | consistency | Soft “Hãy” as in every other full-sentence imperative; “chọn mục” alone is vague (“mục” is also any item or section): the user picks the right AniList entry |
| `feedback.service.upToDate` | `đã mới nhất (tập {progress})` | `đã lưu từ trước (tập {progress})` | terminology | “đã mới nhất” (“already newest”) is a software-update phrase; on-site results now match the pill “Tập 5 đã lưu từ trước” |
| `footer.chip.expired` | `Tài khoản {service} đã hết hạn — mở cài đặt` | `Phiên đăng nhập {service} đã hết hạn — mở cài đặt` | meaning | “Tài khoản … đã hết hạn” reads as the AniList/MAL account (subscription) expiring; it is the sign-in session (common.sessionExpired “Phiên đã hết hạn”) |
| `footer.toReview_other` | `{count} cần kiểm tra` | `{count} mục cần kiểm tra` | style | Standalone footer button needs a noun (“3 cần kiểm tra” has none), like “3 bộ cần chấm điểm” beside it |
| `import.summary.recentSyncs_other` | `đồng bộ gần đây` | `lượt đồng bộ gần đây` | terminology | Counted syncs take the classifier “lượt” (term sheet), as in recent.empty / queue.gone |
| `inline.excluded` | `Bộ đã bị loại trừ` | `Bộ này đã bị loại trừ` | style | Bare “Bộ” as a subject sounds clipped; term sheet: “bộ” after a number or demonstrative |
| `match.absoluteSplit` | `Đánh số liên tục trải trên {count} mục` | `Đánh số liên tục được chia thành {count} mục` | style | “trải trên” is unidiomatic; aligned with match.seasonSplit “được chia thành nhiều mục” |
| `match.special` | `Tập đặc biệt (số tập không nguyên): không đồng bộ` | `Tập đặc biệt (số tập không nguyên): không được đồng bộ` | meaning | “không đồng bộ” is the usual word for “asynchronous / out of sync”; “không được đồng bộ” = “not synced” |
| `match.specialSeason` | `Tập đặc biệt / OVA: hãy chọn mục` | `Tập đặc biệt / OVA: cần chọn mục AniList` | terminology | Reason line, followed in toasts by “Hãy nhấn … để chọn đúng mục AniList”: a reason (“cần chọn”, FR « fiche à choisir ») instead of a second imperative; entry made explicit |
| `onboarding.intro` | `Xem anime trên Crunchyroll hoặc ADN (Netflix và Disney+ là tùy chọn): SyncKai cập nhật danh sách của bạn khi hết mỗi tập.` | `Bạn cứ xem anime trên Crunchyroll hoặc ADN (Netflix và Disney+ là tùy chọn): SyncKai sẽ cập nhật danh sách của bạn vào cuối mỗi tập.` | style | Bare “Xem anime …” reads like a feature list; “Bạn cứ xem …, SyncKai sẽ …” is the friendly fan-to-fan welcome |
| `page.loading` | `Đang tải mục: {title}` | `Đang tải mục AniList: {title}` | terminology | Screen readers heard “loading item: Frieren”; entry made explicit |
| `page.uncertain` | `Mùa được đoán: hãy kiểm tra bên dưới` | `Mùa chỉ là phỏng đoán: hãy kiểm tra bên dưới` | style | Passive “được đoán” is a calque; “chỉ là phỏng đoán” is the natural way to say “this is a guess” |
| `panel.live.excluded` | `Bộ đã bị loại trừ` | `Bộ này đã bị loại trừ` | consistency | Same status as inline.excluded |
| `panel.live.pointRatio` | `Đồng bộ ở {percent}%` | `Đồng bộ khi đạt {percent}%` | consistency | Parallel with panel.live.pointCredits “Đồng bộ khi vào ending” and the settings summary “khi đạt 85%”; “ở 85%” reads as a location |
| `panel.live.reviewHint` | `Nhấn vào biểu tượng SyncKai để chọn mục.` | `Hãy nhấn vào biểu tượng SyncKai để chọn đúng mục AniList.` | consistency | Same as feedback.review.message |
| `panel.live.unreachable` | `Hãy tải lại thẻ để theo dõi việc phát.` | `Hãy tải lại thẻ để theo dõi tập đang phát.` | style | “theo dõi việc phát” is a literal calque of “follow playback” |
| `panel.nowPlaying.aria` | `Mục của bộ đang mở` | `Mục AniList của bộ đang mở` | terminology | Same: the card is the AniList entry |
| `panel.nowPlaying.loading` | `Đang tải mục…` | `Đang tải mục AniList…` | terminology | Same as page.loading |
| `panel.nowPlaying.noPage` | `Hãy mở một bộ anime hoặc một tập để xem mục của nó ở đây.` | `Hãy mở một bộ anime hoặc một tập để xem mục AniList của nó ở đây.` | terminology | Same: entry made explicit |
| `panel.nowPlaying.notFoundHint` | `Để chọn mục, hãy xem hết tập: SyncKai sẽ hỏi bạn trong popup (“Cần kiểm tra”).` | `Để chọn mục AniList, hãy xem hết tập: SyncKai sẽ hỏi bạn trong popup (“Cần kiểm tra”).` | terminology | Bare “mục” is any item or section; the term sheet form is “mục AniList” |
| `panel.nowPlaying.refresh` | `Làm mới mục` | `Làm mới mục AniList` | terminology | “Làm mới mục” (refresh item) is vague on an icon-only button |
| `popup.queueReadFailed` | `Không đọc được các đồng bộ đang chờ.` | `Không đọc được danh sách đồng bộ đang chờ.` | style | “các đồng bộ” has no classifier and sounds broken; the error is about the pending-sync list |
| `queue.retryFailed` | `Thử lại không thành công. Hãy thử lại sau.` | `Lần thử lại không thành công. Hãy thử lại sau.` | grammar | Subject missing: “Thử lại không thành công” reads as an imperative; “Lần thử lại” = the retry |
| `queue.until.imminent` | `ngay` | `trong giây lát` | meaning | “Tự thử lại ngay” = “retrying right now”, wrong for a retry up to a minute away; “trong giây lát” = shortly |
| `settings.entry.help` | `Khi nhấn vào tên hoặc ảnh bìa của anime, lúc cả hai tài khoản đều được kết nối` | `Khi nhấn vào tên hoặc ảnh bìa của anime, nếu cả hai tài khoản đều đã kết nối` | grammar | Two stacked time clauses (“Khi …, lúc …”); the second is a condition |
| `settings.shortcuts.help` | `Phím bạn đã đổi sẽ được giữ lại khi cập nhật. Nếu thiếu phím hoặc phím đã bị trình duyệt hay tiện ích khác dùng, hãy chọn phím khác bằng “Thay đổi” hoặc “Đặt phím”.` | `Phím bạn đã đổi sẽ được giữ lại qua các lần cập nhật. Nếu thiếu phím hoặc phím đã bị trình duyệt hay tiện ích khác dùng, hãy chọn một phím bằng “Thay đổi” hoặc “Đặt phím”.` | meaning | “khi cập nhật” could mean when the user edits the key (it is extension updates); “chọn phím khác” (another key) does not fit the missing-key case |
| `settings.summary.airingOff` | `tắt thông báo` | `thông báo đang tắt` | meaning | “tắt thông báo” reads as the imperative “turn off notifications”; summary states a state, like airing.skip.disabled |
| `toast.pill.alreadyUpToDate` | `Đã mới nhất` | `Đã lưu từ trước` | consistency | Same on-site pill family as toast.pill.upToDate “Tập {episode} đã lưu từ trước” |
| `watching.moreActions` | `Thêm thao tác: {title}` | `Thao tác khác: {title}` | meaning | Same ambiguity as agenda.menu (“Thêm” = add) |

## Term sheet changes (`docs/i18n/glossary/vi.md`)

- Retry delay under a minute: **trong giây lát** (was "ngay", which reads "right now").
- Up to date: sync results and on-site pills use **đã lưu từ trước**; **đã mới nhất** is kept only for the history-import chip (≤ 15 characters); counts keep **không cần cập nhật**.
- Entry: bare "mục" is also any item or section, so instructions and loading/aria texts outside a card that lists entries say **mục AniList**.
- New rows: not synced = **không được đồng bộ** (never "không đồng bộ", which means asynchronous / out of sync); items to check (footer count) = **mục cần kiểm tra**; rewatch not started = **không chuyển sang xem lại**; session expired = **Phiên đăng nhập {service} đã hết hạn** (never "Tài khoản … đã hết hạn"); More actions = **Thao tác khác** (never "Thêm thao tác" = add an action); could not load = **Không tải được …**.
- Browser vocabulary row: sources added for "bảng điều khiển bên" (Chrome help center) and "Quản lý phím tắt tiện ích mở rộng" (mozilla-l10n). Percent example updated to "Đồng bộ khi đạt 85%".

## Debatable, left unchanged

| Key(s) | Text | Why it stays |
|---|---|---|
| `compare.bulk.filtered.anilist`, `compare.bulk.filtered.mal` | Kết quả lọc theo AniList / MAL | Alone it could be read as "results filtered by AniList". No clearer wording fits the 24-character button; the pair "Tất cả theo AniList" (filter All) and the confirmation question ("Đồng nhất 12 bộ theo AniList? Trên MyAnimeList:") make the action clear before anything is written. |
| `queue.abandon`, `queue.abandonAria`, `popup.abandonFailed` | Từ bỏ | "Give up" is a little dramatic, but Hủy (Cancel), Bỏ qua (Ignore), Xóa (Remove from list) and Loại trừ (exclude) are all taken; "Từ bỏ" next to "Thử lại" is unambiguous. |
| `page.airing.HIATUS` | Hoãn chiếu | Vietnamese anime sites use both "hoãn chiếu" and "tạm ngưng (chiếu)" for a hiatus; kept the translator's choice, which never collides with the list status "Tạm dừng" (On hold). |
| `settings.notif.discreet.title` | Kín đáo | Slightly literary for a notification level ("Tối giản" would be the other option), but it says exactly "unobtrusive" and is consistent with the home summary. |
| `crImport.skipReason.up-to-date` | đã mới nhất | Software-update wording, but the only ≤ 15-character option that clashes neither with the import result "Đã cập nhật" nor with "khớp" (used by the AniList ↔ MAL comparison). |
| `footer.queueFailed_other`, `footer.queuePending_other` | {count} đồng bộ thất bại / đang chờ | Without the classifier "lượt" (the term sheet's counted form) because the footer line holds ≈ 22 characters; "3 đồng bộ đang chờ" still reads naturally as a status. |
| `airing.skip.noSeries` | bộ nhớ đệm chưa có bộ nào đang xem — hãy mở thẻ Đang xem | Repeats "bộ" (cache = "bộ nhớ đệm", series = "bộ"); readable, and every rewording either loses "cache" or repeats it too. |
| `time.justNow` | vừa nãy | "Vừa xong" (Facebook's term) would give "Đã xem xong vừa xong" in `ratings.completed`. |
| `settings.summary.paused` | tạm dừng | Same word as the On hold status, but placed after the preferred platform in the Playback & sync summary it can only mean auto sync. |
| `panel.nowPlaying.season.*` | Mùa xuân / Mùa hè / Mùa thu / Mùa đông | "Mùa" also means season of a series ("Mùa 2"), but "Mùa thu 2024" is how Vietnamese anime sites name airing seasons. |
| `review.format.movie`, `match.specialTitle`, `match.linkedEntry` | Movie / movie | English loanword kept on purpose: fans say "movie" (and "OVA"); "phim điện ảnh" would look out of place next to TV, ONA, OVA. |
| credits (`panel.live.pointCredits`, `settings.trigger.credits`, `settings.summary.credits`, `onboarding.step3`…) | ending | Fan word for the end-credits sequence, chosen by the term sheet; a non-fan might expect "đoạn kết" or "phần credit". |
| match (`settings.section.mappings`, `settings.mappings.*`, `import.*`) | ghép nối | Also used for Bluetooth "pairing"; understandable for a remembered season → entry link, and "liên kết" is reserved for AniList's streaming links. |
| tabs (`airing.skip.noSeries`, `settings.panel.defaultTab`) | thẻ | Chrome's word for browser tabs is reused for the popup and panel tabs; the tab names ("thẻ Đang xem") disambiguate. |
| `compare.result.updated_other` | {count} bộ đã cập nhật | "matched" rendered as "updated", which is what happened to those series; reads better than "đã đồng nhất" in the result banner. |

## Residual doubts for a native human reviewer

- `compare.bulk.filtered.anilist` / `.mal`: check in the popup that "Kết quả lọc theo AniList" is understood as an action, not as a filter label.
- `airing.notification.single` (new order "Đã ra tập 5 của Frieren"): check a real Chrome / Windows notification with a long title.
- `page.airing.HIATUS` "Hoãn chiếu" vs "Tạm ngưng chiếu", and `settings.notif.discreet.title` "Kín đáo" vs "Tối giản": community preference.
- `queue.abandon` "Từ bỏ": tone of the button.
- Fan vocabulary acceptance across regions: "ending" for credits, "movie", "vừa nãy" (Northern-leaning; "hồi nãy" in the South).

## Outside the catalog (for the maintainers)

- `formatOffset` in `src/shared/agenda.ts` builds the `{offset}` of `agenda.estimate.title` / `agenda.estimate.custom` with hard-coded English units ("+1 h", "+45 min", "+1 h 30"). Vietnamese tooltips therefore read "giờ phát sóng tại Nhật +1 h" while the catalog everywhere else writes "giờ" / "phút". Localizing it needs code (unit keys such as `panel.live.minutes`), not a translation change.

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | Mùa đông / Mùa xuân / Mùa hè / Mùa thu | Mùa đông {year} / Mùa xuân {year} / Mùa hè {year} / Mùa thu {year} | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |
| `sync.noServiceFollows` | Không có dịch vụ đã kết nối nào theo dõi bộ này. | Không có dịch vụ đã kết nối nào có mục cho bộ này. | Meaning: shown when no connected service has an entry for the anime (no AniList / MyAnimeList ID), not when none “tracks” it; English, French and German fixed the same way. Term sheet: entry = *mục* |

Code fixes that change how this catalog is displayed:

- `formatOffset` is localized: “giờ phát sóng tại Nhật +1 giờ 30 phút”.
- Netflix history import: the “Hiển thị thêm” button of a Netflix profile in this language is recognized (label checked by the reviewer on Netflix’s help article 101917 in this language): such an import no longer stops after the first rows as if the history were complete.
- Lists of names in `{services}` and `{titles}` use the language’s own conjunction (`Intl.ListFormat`) instead of “, ”.

Layout (`npm run test:i18n-layout`), fixed in the components without changing the text: `page.action.PAUSED`, `page.action.COMPLETED` (side panel at 320 px): the icons are hidden when the side panel is narrow.

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). No plural forms in this language: one `_other` variant with the same text, `{total}` renamed `{count}`.

| Key | Text |
|---|---|
| `sync.beyondEntry_other` | Tập {progress} vượt quá {count} tập của mục |

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | Không nhận ra nút “Hiển thị thêm” trong ngôn ngữ của hồ sơ Netflix: chỉ đọc được các tập gần đây nhất. Hãy đặt hồ sơ đó trên Netflix sang cùng ngôn ngữ với SyncKai, rồi đọc lại. |

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video (chỉ anime) |
| `settings.prime.label` | Đồng bộ trên Prime Video |
| `settings.prime.helpOff` | Chỉ đồng bộ anime (thể loại anime, hoặc hoạt hình có âm thanh tiếng Nhật hay có tên trùng khớp chính xác trên AniList). Trình duyệt sẽ hỏi quyền truy cập primevideo.com |
| `settings.prime.helpOn` | SyncKai chỉ đọc những gì trang Prime Video vốn đã nhận. Trong thẻ Prime Video đã mở từ trước, việc theo dõi bắt đầu từ tập tiếp theo |
| `settings.prime.denied` | Quyền truy cập primevideo.com bị từ chối: Prime Video vẫn tắt |
| `settings.prime.disabled` | Đã tắt Prime Video: hãy tải lại các thẻ Prime Video đang mở để dừng hẳn |
| `settings.prime.error` | Không thể thay đổi quyền truy cập Prime Video, hãy thử lại |

| Key | Text |
|---|---|
| `onboarding.intro` | Bạn cứ xem anime trên Crunchyroll hoặc ADN (Netflix, Disney+ và Prime Video là tùy chọn): SyncKai sẽ cập nhật danh sách của bạn vào cuối mỗi tập. |
| `watching.tip` | Netflix, Disney+, Prime Video (tùy chọn) và nền tảng ưu tiên của bạn được thiết lập trong {path}. |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | Khớp với nền tảng: {signals} |
| `match.signalsContradict` | Không khớp với nền tảng: {signals} |
| `match.yearRemake` | Phân biệt bản làm lại nhờ năm phát hành ({year}) |
| `match.signal.year` | năm phát hành |
| `match.signal.episodes` | số tập |
| `match.signal.duration` | thời lượng tập |
| `match.signal.format` | định dạng (phim điện ảnh hay phim bộ) |
| `match.signal.country` | quốc gia sản xuất |
| `match.signal.originalTitle` | tên gốc |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | Ghép nối đã lưu không khớp với nền tảng: {signals} |

## 2026-10-14 · Matching diagnostic (development builds only)

New keys `settings.matchDiag.*` (Settings › Help & about, section shown only in development builds, never in the published extension): the last 50 AniList matching decisions, a « Copy » button per row (one decision as JSON, for the test corpus) and a « Clear » button. `{count}` follows a label and a colon (no plural form); `JSON` is a format name. Terms from this language's term sheet (match, entry). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.title` | Chẩn đoán ghép nối |
| `settings.matchDiag.text` | Chỉ có trong bản build phát triển: 50 quyết định ghép nối AniList gần nhất, mới nhất trước, được giữ đến khi đóng trình duyệt. Hãy sao chép một quyết định dạng JSON để thêm vào bộ dữ liệu kiểm thử. |
| `settings.matchDiag.empty` | Chưa có quyết định nào được ghi lại |
| `settings.matchDiag.copy` | Sao chép |
| `settings.matchDiag.copyTitle` | Sao chép quyết định này dạng JSON |
| `settings.matchDiag.copied` | Đã sao chép |
| `settings.matchDiag.copyFailed` | Không sao chép được quyết định. |
| `settings.matchDiag.clear` | Xóa |
| `settings.matchDiag.candidates` | Ứng viên: {count} |
| `settings.matchDiag.noEntry` | Không có mục |
