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

## 2026-10-15 · Debug trace (development builds only)

New keys `settings.debugTrace.*` (Settings › Help & about, section shown only in development builds, never in the published extension, below the matching diagnostic): a timeline of what the extension did (pages, service worker, AniList and MyAnimeList requests), a verbose switch, a category filter (category names stay in English: technical identifiers), « Copy trace » (the whole trace as JSON) and the « Clear » button of the matching diagnostic (`settings.matchDiag.clear`, reused). `{count}` and `{max}` follow a label and a colon (no plural form) and arrive formatted for the language; `JSON` is a format name; `service worker` kept as the browser's technical term. New terms added to this language's term sheet (debug trace, event, verbose mode); other terms from it (account). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.debugTrace.title` | Dấu vết gỡ lỗi |
| `settings.debugTrace.text` | Chỉ có trong bản build phát triển: dòng thời gian những gì SyncKai đã làm trên các trang, trong service worker và với AniList, MyAnimeList, mới nhất trước, được giữ đến khi đóng trình duyệt. Không ghi lại token, cookie hay ID tài khoản nào. Hãy sao chép toàn bộ dấu vết dạng JSON để chia sẻ khi báo lỗi. |
| `settings.debugTrace.empty` | Chưa ghi lại sự kiện nào |
| `settings.debugTrace.copy` | Sao chép dấu vết |
| `settings.debugTrace.copied` | Đã sao chép |
| `settings.debugTrace.copyFailed` | Không thể sao chép dấu vết. |
| `settings.debugTrace.verbose` | Chế độ chi tiết (mọi dòng nhật ký) |
| `settings.debugTrace.count` | Sự kiện: {count} / {max} |
| `settings.debugTrace.allCategories` | Tất cả danh mục |
| `settings.debugTrace.filterAria` | Lọc sự kiện theo danh mục |

## 2026-10-16 · Matching diagnostic: Copy all (development builds only)

New keys in the « Matching diagnostic » section (Settings › Help & about, development builds only, never in the published extension, now collapsed by default behind its title): « Copy all » copies every recorded decision as one JSON array, next to « Clear »; its label becomes « Copied » (`settings.matchDiag.copied`, reused) and a failure reuses `settings.matchDiag.copyFailed`. `JSON` is a format name. Same word for « decision » as `settings.matchDiag.copyTitle`, in the plural; other terms from this language's term sheet. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.copyAll` | Sao chép tất cả |
| `settings.matchDiag.copyAllTitle` | Sao chép tất cả quyết định dạng JSON |

## 2026-10-16 · Episode guards (« To check » reasons)

New reasons on a « To check » card (`fix/episode-guards`, audit SEC-01): a sync that would jump straight to the last episode from far behind, and episodes reported as finished in a burst, now wait for the user instead of being written. Same « to check » term as `match.otherSeriesExcluded`, same episode wording as `sync.beyondEntry_*`; `{from}` and `{progress}` are episode numbers. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `sync.review.finaleJump` | Nhảy thẳng tới tập cuối ({progress}) từ tập {from}: cần kiểm tra |
| `sync.review.burst` | Nhiều tập được xem xong trong vài phút: cần kiểm tra |

## 2026-10-17 · Status bar (popup and side panel)

New texts of the status bar shown at the bottom of the popup and, now, of the side panel (`feature/ui-status-bar`): a synced episode or a count of synced episodes under the series title, shown until the user hides it (« Seen, hide », a × button label), and the history import running, ready to confirm and done. Same words as this language's term sheet: *đã đồng bộ* (synced), *bộ* (series after a number), *Tập* / *tập* (episode), *nhập* (import, as `crImport.apply.done` « Đã nhập xong »), *đã cập nhật* (updated, the import result), *cần xác nhận* (to confirm, parallel to *cần kiểm tra*) and *ẩn* (hide); « Seen, hide » is *Đã biết, ẩn đi* (got it), since *Đã xem* would read as « watched ». ` · ` and ` / ` kept; `{platform}` is a brand name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `footer.dismiss` | Đã biết, ẩn đi |
| `footer.importDone_other` | Đã nhập xong · {count} bộ đã cập nhật |
| `footer.importProgress` | Đang nhập từ {platform} · {done} / {total} |
| `footer.importReady_other` | Sẵn sàng nhập · {count} bộ cần xác nhận |
| `footer.syncedEpisode` | Tập {episode} đã đồng bộ |
| `footer.syncedEpisodes_other` | {count} tập đã đồng bộ |

## 2026-10-17 · Account menu (status bar)

New texts of the account menu that opens above the AniList / MyAnimeList logo of the status bar (popup and side panel): the logo button's label (also when the session expired), the connection status line, three stat tiles (anime count, episodes watched, days watched, each number shown above its short label), the « Synced this week » row with its tooltip and value, and « View my profile ». Following this language's term sheet, used **tài khoản**, **đã kết nối** (as `settings.account.connected`), **phiên đã hết hạn** (`common.sessionExpired`), **đồng bộ**, **tập**; no plural forms; « day » stays the full word **ngày**, as `time.countdown.days`. ` · ` kept; `{service}` is a brand name, `{name}` the user's AniList / MyAnimeList user name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `accountMenu.connected` | Đã kết nối |
| `accountMenu.connectedAs` | {name} · đã kết nối |
| `accountMenu.label` | Tài khoản {service} |
| `accountMenu.labelExpired` | Tài khoản {service}, phiên đã hết hạn |
| `accountMenu.profile` | Xem hồ sơ của tôi |
| `accountMenu.stats.anime_other` | anime |
| `accountMenu.stats.days_other` | đã xem |
| `accountMenu.stats.daysValue` | {days} ngày |
| `accountMenu.stats.episodes_other` | tập |
| `accountMenu.week.label` | Đã đồng bộ tuần này |
| `accountMenu.week.title` | Số tập SyncKai đã đồng bộ trong tuần này |
| `accountMenu.week.value_other` | {count} tập |

## 2026-10-17 · Settings redesign (Preact): new and changed keys

New texts of the redesigned Settings (Preact): the Platforms and Display categories, the screen-reader names of the back button and of the category card, the row summaries of the Settings home, the Keyboard section of Display, the two sections of Shortcuts, and the section titles and notes of Accounts. Changed: `settings.cat.notifications` (now the single word: the Schedule options moved to Platforms), `settings.summary.connected` (a word instead of ✓), `settings.summary.paused` (now a standalone, capitalised summary), `settings.summary.version` (a word instead of « v »), `settings.entry.help` (the « both accounts connected » condition moved to `settings.entry.unavailable`). Summaries are joined with ` · ` by the code; `settings.account.expiredHelp` and `settings.account.otherStillSynced` are joined as two sentences. The Display summary reuses `settings.section.language`, `settings.section.panel` and `settings.shortcuts.pointer`; the My data summary the history import and backup words; the player summary `settings.player.label`. Platform count « Đang bật {count}/{total} »; player summary « ưu tiên {player} » (*Nền tảng ưu tiên*); the panel is **bảng điều khiển** (term of `settings.section.panel`). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.cat.notifications` | Thông báo |
| `settings.cat.platforms` | Nền tảng |
| `settings.cat.display` | Hiển thị |
| `settings.backToAria` | Quay lại {page} |
| `settings.group.categories` | Danh mục |
| `settings.summary.connected` | {service} đã kết nối |
| `settings.summary.notConnected` | {service} chưa kết nối |
| `settings.summary.bothConnected` | Đã kết nối AniList và MyAnimeList |
| `settings.summary.auto` | Tự động |
| `settings.summary.paused` | Tạm dừng |
| `settings.summary.platforms_other` | Đang bật {count}/{total} |
| `settings.summary.player` | ưu tiên {player} |
| `settings.summary.display` | Ngôn ngữ, bảng điều khiển bên, phím tắt |
| `settings.summary.data` | Nhập lịch sử xem · sao lưu |
| `settings.summary.version` | Phiên bản {version} |
| `settings.summary.noErrors` | không có lỗi |
| `settings.display.keyboard` | Bàn phím |
| `settings.display.shortcutsHelp` | Phím đánh dấu tập đã xem hoặc mở bảng điều khiển |
| `settings.shortcuts.duringPlayback` | Khi đang xem |
| `settings.shortcuts.navigation` | Điều hướng |
| `settings.accounts.lists` | Danh sách được đồng bộ |
| `settings.accounts.both` | Khi có cả hai tài khoản |
| `settings.accounts.privacy` | Bạn đăng nhập ngay trên trang AniList hoặc MyAnimeList: SyncKai không bao giờ thấy mật khẩu của bạn. |
| `settings.account.expiredHelp` | Các tập bạn xem sẽ không được gửi đến {service} cho đến khi bạn kết nối lại. |
| `settings.account.otherStillSynced` | {service} vẫn được cập nhật. |
| `settings.entry.help` | Khi nhấn vào tên hoặc ảnh bìa của anime |
| `settings.entry.unavailable` | Chỉ dùng được khi đã kết nối cả AniList và MyAnimeList. |

## 2026-10-17 · Settings › Sync, Matches and Excluded series (Preact)

New texts of the redesigned Sync settings page and of its two sub-pages (Matches, Excluded series), moved out of My data: section titles « Automatic » / « Per series », the descriptions of the two « Episode counted as watched » cards, the « Per series » rows, the Matches intro, search, empty and no-result texts, « Show N more on {platform} », the four origin badges and their legend, the Excluded series section, note, empty hint and the « {year} series · excluded on {date} » fragments. Changed: `settings.trigger.legend` (« Episode counted as watched », where the old text was only « Episode watched »), `settings.trigger.credits` (« (recommended) » moved to `settings.trigger.creditsHelp`), and the paths of `popup.syncDisabledDetail` / `review.excludeTitle` (now nav.settings › settings.section.sync › settings.section.exclusions, built from this catalog's own titles). Removed: `settings.mappings.count_*`, `settings.mappings.help`, `settings.mappings.manage`. `{action}` is the « Re-enable » button (`settings.exclusions.help`) or the « Stop syncing this series » menu item (`settings.exclusions.emptyHelp`), so the quoted labels always match. The match / entry / excluded / re-enable words reuse this catalog's existing terms (`settings.section.mappings`, `settings.mappings.entryFallback`, `settings.section.exclusions`, `settings.exclusions.reactivate`). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.section.automatic` | Tự động |
| `settings.section.perSeries` | Theo từng bộ |
| `settings.trigger.credits` | Khi bắt đầu ending |
| `settings.trigger.creditsHelp` | Khuyên dùng: đúng thời điểm do nền tảng cung cấp |
| `settings.trigger.percentageHelp` | Cũng dùng khi không biết thời điểm ending |
| `settings.sync.mappingsRow` | Ghép nối đã ghi nhớ |
| `settings.sync.mappingsRowHelp` | Mùa trên AniList được chọn cho từng bộ |
| `settings.sync.exclusionsRowHelp` | Không bao giờ đồng bộ, có thể bật lại ở đây |
| `settings.mappings.intro_other` | Đã ghi nhớ {count} bộ, theo nền tảng: mùa trên nền tảng → mục AniList mà SyncKai ghi vào. Quên một ghép nối sẽ khiến nó được tính lại ở tập tiếp theo. |
| `settings.mappings.search` | Tìm bộ anime hoặc mục |
| `settings.mappings.noResult` | Không có ghép nối nào cho “{query}” |
| `settings.mappings.noResultHelp` | Tìm theo tên bộ anime hoặc tên mục AniList. |
| `settings.mappings.emptyHelp` | SyncKai ghi nhớ một ghép nối cho mỗi mùa được đồng bộ. |
| `settings.mappings.showMore_other` | Xem thêm {count} trên {platform} |
| `settings.mappings.origin.chosen` | Do bạn chọn |
| `settings.mappings.origin.learned` | Tự học |
| `settings.mappings.origin.unmarked` | Cũ |
| `settings.mappings.origin.unverified` | Đã nhập · cần kiểm tra lại |
| `settings.mappings.origin.chosenHelp` | Do bạn xác nhận hoặc chọn: không bao giờ bị xét lại. |
| `settings.mappings.origin.learnedHelp` | SyncKai tự tìm: được tính lại nếu nền tảng cho thông tin trái ngược. |
| `settings.mappings.origin.unmarkedHelp` | Lưu trước bản 2.4: được giữ, cần kiểm tra nếu có mâu thuẫn. |
| `settings.mappings.origin.unverifiedHelp` | Từ bản sao lưu: được kiểm tra lại ở lần dùng đầu tiên. |
| `settings.mappings.originLegend` | Nguồn gốc ghép nối |
| `settings.exclusions.section` | Không bao giờ đồng bộ |
| `settings.exclusions.help` | Bộ anime bị loại trừ sẽ không bao giờ được đồng bộ nữa, ở mọi mùa. “{action}” sẽ theo dõi lại từ tập tiếp theo. |
| `settings.exclusions.emptyHelp` | Để ngừng đồng bộ một bộ anime, chọn “{action}” trong menu “⋯” của bộ đó. |
| `settings.exclusions.seriesYear` | bộ năm {year} |
| `settings.exclusions.excludedOn` | loại trừ ngày {date} |
| `popup.syncDisabledDetail` | Có thể bật lại trong Cài đặt › Đồng bộ › Bộ anime bị loại trừ |
| `review.excludeTitle` | Loại trừ bộ này (mọi mùa): có thể bật lại trong Cài đặt › Đồng bộ › Bộ anime bị loại trừ |

## 2026-10-17 · Settings › Platforms and Notifications (Preact)

Texts of the redesigned Platforms page (list of sites with « Included » / « Access missing » or a switch, preferred player dropdown, estimated release time per platform with − / + buttons, moved there from the Schedule card) and Notifications page (« On the playback page » style cards and « New episodes »). New: `settings.platforms.where`, `settings.platforms.allAnime`, `settings.platforms.included`, `settings.platforms.accessMissing`, `settings.platforms.note`, `settings.player.openOn`, `settings.player.enableFirst`, `settings.offsets.earlier`, `settings.offsets.later`, `settings.notif.legend`. Changed: `settings.player.help`, `settings.offsets.title`, `settings.offsets.help`, `page.platformOff`, `settings.section.notifications`, `settings.notif.discreet.desc`, `settings.notif.detailed.desc`, `settings.notif.alertsOnly.desc`, `settings.notif.alertsAlways`, `settings.delay.title`, `settings.airing.enableFirst` (the notification descriptions now describe the pill and the bubble, « Extra delay » replaces « Delay », the release-time help says the alerts use it too, « Turn on alerts… » is now visible text). `page.platformOff` keeps its sentence; only the path changed, from « Settings › Playback & sync » to nav.settings › settings.cat.platforms of this catalog. Removed: `settings.section.playback`, `settings.netflix.section`, `settings.netflix.label`, `settings.disney.section`, `settings.disney.label`, `settings.prime.section`, `settings.prime.label`, `settings.airing.label`, `settings.airing.help`, `settings.section.agenda`. The Schedule word, « Open », the release-alert name and the minute unit reuse this catalog's `panel.tab.agenda`, `common.open`, `settings.quick.airing.label` and `settings.offsets.unit`. Series = « bộ »; the minute tooltips put the amount after the comparative (« Sớm hơn 15 phút »). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.platforms.where` | Nơi SyncKai theo dõi tập bạn xem |
| `settings.platforms.allAnime` | Mọi anime |
| `settings.platforms.included` | Có sẵn |
| `settings.platforms.accessMissing` | Thiếu quyền |
| `settings.platforms.note` | Bật một nền tảng sẽ cần quyền truy cập trang web của nền tảng đó. Chỉ đọc trang xem và trang của bộ anime. |
| `settings.player.openOn` | Mở tập trên |
| `settings.player.enableFirst` | Hãy bật trước |
| `settings.player.help` | Dùng cho nút “Mở” khi anime có trên nhiều nền tảng đang bật. |
| `settings.offsets.title` | Giờ ra mắt dự kiến |
| `settings.offsets.help` | Tính từ lúc phát sóng tại Nhật. Dùng cho Lịch chiếu và thông báo; có thể chỉnh riêng từng bộ trên dòng của bộ đó trong Lịch chiếu. |
| `settings.offsets.earlier` | Sớm hơn {minutes} phút |
| `settings.offsets.later` | Muộn hơn {minutes} phút |
| `page.platformOff` | {platform} đang tắt: SyncKai không theo dõi gì ở đây. Để bật lại: Cài đặt › Nền tảng. |
| `settings.section.notifications` | Trên trang xem |
| `settings.notif.legend` | Kiểu thông báo trên trang |
| `settings.notif.discreet.desc` | Một nhãn nhỏ hiện vài giây ở góc video |
| `settings.notif.detailed.desc` | Bong bóng hiện tập phim và kết quả trên AniList và MyAnimeList |
| `settings.notif.alertsOnly.desc` | Không hiện gì khi mọi thứ ổn; chỉ hiện bong bóng khi có lỗi hoặc tập cần kiểm tra |
| `settings.notif.alertsAlways` | Lỗi hoặc bộ cần kiểm tra luôn được hiển thị, dù chọn kiểu nào. |
| `settings.delay.title` | Trễ thêm |
| `settings.airing.enableFirst` | Hãy bật thông báo tập mới để kiểm tra |

## 2026-10-17 · Settings › My data, AniList ↔ MAL differences, Help & about (Preact)

Texts of the redesigned My data page (one « Import a watch history » card, Backup card, « Compare » row opening the AniList ↔ MyAnimeList differences page, which moved there from the popup's Activity screen) and Help & about page (diagnostic report row, error log that unfolds, About card with What's new / Privacy / Source code links). New: `settings.import.title`, `settings.section.compare`, `settings.compare.title`, `settings.compare.help`, `settings.data.perSeries`, `compare.align`, `compare.bulk.help`, `compare.job.background`, `settings.help.diagnostic`, `settings.help.diagnosticHelp`, `settings.help.journalNote`, `settings.about.whatsNew`, `settings.about.privacy`. Changed: `settings.crImport.help`, `settings.backup.help`, `settings.backup.import`, `settings.help.copy`, `settings.about.source` (import help in two sentences, backup help « in one file », « Import » without ellipsis, « Copy the report » next to the new « Diagnostic report » title, « Source code » with « GitHub » on the right). `help.issue.body` keeps its text; only its last-line path changed, to nav.settings › settings.cat.help › settings.help.copy of this catalog. The compare.* texts are unchanged: their context notes now point to Settings › My data. Removed: `settings.section.import`, `settings.backup.crImportTitle`, `settings.crImport.openAria`, `settings.help.text`, `settings.help.copyTitle`, `settings.help.clearHelp`, `settings.help.reportTitle`. The version line reuses `settings.summary.version`, the « Clear » button `settings.matchDiag.clear`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.import.title` | Cập nhật những gì bạn đã xem |
| `settings.crImport.help` | Crunchyroll, ADN hoặc Netflix. Bạn xem trước trước khi có gì được ghi. |
| `settings.backup.help` | Cài đặt, ghép nối, bộ anime bị loại trừ và lịch sử trong một tệp. Không bao giờ chứa thông tin đăng nhập AniList hay MyAnimeList. |
| `settings.backup.import` | Nhập |
| `settings.section.compare` | So sánh |
| `settings.compare.title` | Khác biệt AniList ↔ MyAnimeList |
| `settings.compare.help` | So sánh hai danh sách của bạn và đồng nhất theo hướng bạn chọn |
| `settings.data.perSeries` | Ghép nối và bộ anime bị loại trừ được quản lý trong {path}. |
| `compare.align` | Đồng nhất |
| `compare.bulk.help` | “{action}” chép AniList sang MyAnimeList; trước đó, một bước xác nhận liệt kê các thay đổi. |
| `compare.job.background` | Vẫn tiếp tục dù bạn đóng trang này. |
| `settings.help.diagnostic` | Báo cáo chẩn đoán |
| `settings.help.diagnosticHelp` | Để dán vào báo cáo lỗi: phiên bản, trình duyệt, cài đặt, lỗi gần đây. Không có token hay tài khoản. |
| `settings.help.copy` | Sao chép báo cáo |
| `settings.help.journalNote` | Tối đa 50 lỗi gần nhất, mới nhất trước; token đã được che. |
| `settings.about.whatsNew` | Có gì mới |
| `settings.about.privacy` | Quyền riêng tư |
| `settings.about.source` | Mã nguồn |

## 2026-10-17 · Popup « My series » row menu (Preact)

The row « … » menu of the popup's « My series » list and of the « Continue » card now groups the entry links and the platform searches in two sub-menus. New: `watching.menu.openEntry` (sub-menu entry, its items are the bare AniList / MyAnimeList names; wording taken from `page.openOn` without « on {service} »), `watching.menu.searchOn` (sub-menu entry, its items are the bare platform names; wording taken from `watching.searchOn`, ending with « … »). Changed: `settings.entry.help`, which now also says that « Default entry page » picks the list shown in « My series » (quoted with the exact `watching.mySeries` of this catalog). The « −1 episode » item left the menu (the row has its own −), `watching.minusOne` stays for the « On this page » card. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `watching.menu.openEntry` | Mở mục |
| `watching.menu.searchOn` | Tìm trên… |
| `settings.entry.help` | Khi nhấn vào tên hoặc ảnh bìa của anime; cũng chọn danh sách trong “Bộ của tôi” |



## 2026-10-17 · Popup « On this page » card (Preact)

The popup's « On this page » card was redesigned: the Hold / Drop / Done row and the AniList / MAL links moved to the card's « … » menu (shared with « My series »), and the season dropdown, the star rating and the comment moved to a foldable « Details » section. New: `page.currentStatus` (grey mention at the end of the menu item of the series' current status), `page.details` (foldable button listing what the section holds, same nouns as `page.seasonPicker`, the rating words of `rating.*` and `notes.title`), `page.seasonOnAniList` (title above the season dropdown), `page.seasonHelp` (help under it on an episode page; the match word is the one of `settings.section.mappings`), `page.yourRating` (title above the stars). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `page.currentStatus` | Trạng thái hiện tại |
| `page.details` | Chi tiết: mùa, điểm, ghi chú |
| `page.seasonOnAniList` | Mùa trên AniList |
| `page.seasonHelp` | Đổi mùa sẽ sửa ghép nối cho các tập tiếp theo. |
| `page.yourRating` | Điểm của bạn |


## 2026-10-17 · Popup « Activity » tab (Preact)

The popup's Activity tab was redesigned: failed and pending syncs are now two sections, and every section heading is an uppercase label followed by « · {count} » added by the code. New: `queue.failedHeading` (same failure word as `queue.failed`), `queue.pendingHeading` (syncs waiting for a retry, wording of the former `queue.sectionTitle`), `ratings.heading` (the former `ratings.sectionTitle` without its count). The « To check » heading now reuses `inline.toCheck`. Removed: `queue.section`, `queue.sectionTitle`, `ratings.section`, `ratings.sectionTitle`, `review.title`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `queue.failedHeading` | Thất bại |
| `queue.pendingHeading` | Đang chờ |
| `ratings.heading` | Cần chấm điểm |


## 2026-10-17 · Side panel « Now playing » (Preact)

The side panel's « Now playing » tab was redesigned as cards: « You're watching » (live playback: bar, credits marker, countdown, sync state with an icon), « Your list » (status chip, « Progress » and the stepper, one line per account, the series « … » menu shared with the popup: Hold / Drop / Done moved there), then foldable sections « Rating and comment », Synopsis, related entries and Discussions. New: `panel.nowPlaying.watching` (heading of the live card, addresses the user), `panel.nowPlaying.list` (heading of the list card, same « your list » words as `page.notInList`), `panel.nowPlaying.ratingNotes` (section title, same nouns as `page.yourRating` and `notes.title`), `panel.live.creditsAt` and `panel.live.creditsUnknown` (legend of the yellow marker under the bar, credits word of `settings.trigger.credits`), `panel.live.countdownCredits` and `panel.live.countdownRatio` (countdown line, wording of the former `panel.live.countdown` plus what the sync waits for, as in `settings.trigger.credits` / `settings.summary.percentage`). Changed: `panel.live.synced` lost its trailing « ✓ » (a check icon now precedes it). The « Progress » label reuses `compare.filter.progress`. Removed: `page.action.COMPLETED`, `page.action.DROPPED`, `page.action.PAUSED` (the status button row is gone), `panel.live.countdown`, `panel.nowPlaying.progress`, `watching.nextWatched`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `panel.nowPlaying.watching` | Bạn đang xem |
| `panel.nowPlaying.list` | Danh sách của bạn |
| `panel.nowPlaying.ratingNotes` | Điểm và ghi chú |
| `panel.live.creditsAt` | Ending lúc {time} |
| `panel.live.creditsUnknown` | Chưa rõ ending · đồng bộ khi đạt {percent}% |
| `panel.live.countdownCredits` | Đồng bộ sau {time} · khi bắt đầu ending |
| `panel.live.countdownRatio` | Đồng bộ sau {time} · khi đạt {percent}% tập |
| `panel.live.synced` | Đã đồng bộ |


## 2026-10-17 · Side panel Schedule (Preact) and week picker

The Schedule tab of the side panel was redesigned: days in order with « No episode » on empty days, episode lines « 18:00 Crunchyroll · Japan 17:00 » (the platform time first, the Japanese broadcast last and cut first), a « ⋯ » menu with « Adjust time » (its second line gives the time and whether the delay is the series' own or the default), « Open the entry › » and « Search on… › », and a week button that opens a month calendar. New: `agenda.adjust.custom` and `agenda.adjust.default` (second line of « Adjust time », lower case after « · »), `agenda.adjust.platform` (first sentence of `agenda.estimate.title`, shown in the delay editor), `agenda.picker.label`, `agenda.picker.prevMonth`, `agenda.picker.nextMonth`, `agenda.picker.thisWeek`, `agenda.picker.hint` (month calendar; the hint names the arrow keys and the Enter key). Changed: `agenda.jp` writes the country name instead of « JP » (unchanged where it already did: ja, ko, zh-CN, zh-TW). Removed: `watching.searchOn` (the search entries are now the platform names of the « Search on… › » sub-menu). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `agenda.jp` | Nhật {time} |
| `agenda.adjust.custom` | đặt riêng cho bộ này |
| `agenda.adjust.default` | độ trễ mặc định |
| `agenda.adjust.platform` | Dự kiến có trên {platform}: giờ phát sóng tại Nhật {offset}. |
| `agenda.picker.label` | Chọn tuần |
| `agenda.picker.prevMonth` | Tháng trước |
| `agenda.picker.nextMonth` | Tháng sau |
| `agenda.picker.thisWeek` | Tuần này |
| `agenda.picker.hint` | ↑ ↓ để đổi tuần, Enter để hiển thị. |
