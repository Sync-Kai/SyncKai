# Vietnamese (`vi`) term sheet

Binding for every change to `src/i18n/locales/vi.json` and `public/_locales/vi/messages.json`. Shared rules: `docs/i18n/GLOSSARY.md`.

## 1. Conventions

| Topic | Vietnamese convention | Example |
|---|---|---|
| Register | Address the user as **bạn**, friendly fan-to-fan tone. Full sentences use a soft imperative with **hãy**; buttons use the bare verb | "Hãy thử lại." / button "Thử lại" |
| Capitalisation | Sentence case: only the first word (and proper names) capitalised | "Nhập lịch sử xem" |
| Quotation marks | Curly double quotes “…” (inner: ‘…’) | “Chỉnh giờ” |
| Colon, ?, ! | No space before, one space after | "Lỗi AniList (503)." / "Đã xem xong?" |
| Ellipsis | The single character `…` | "Đang đồng bộ…" |
| Percent | No space: `85%` | "Đồng bộ khi đạt 85%" |
| Units | Full short words, never abbreviated: min → **phút**, h → **giờ**, d → **ngày**, s → **giây** | "5 phút trước", "Tập 5: còn 18 giờ" |
| "Ep." | **Tập** (already short, no abbreviation); lowercase "tập" mid-line | "Tập 12 / 24", "tập 5" |
| Plurals | No plural forms: only `_other`; nouns are invariable | "1 tập", "5 tập" |
| `{service}: {message}` | Kept as is; `{message}` fragments start lowercase | "AniList: đã lưu tập 5" |
| `{title}: completed` | `{title}: đã xem xong` | "Frieren: đã xem xong" |
| Fragments lowercased by code | Start with an ordinary word (never a product name or a placeholder) so the lowercased first letter still reads well | "Đã có trong danh sách của bạn" → "AniList: đã có trong danh sách của bạn" |
| Relative times | "vừa nãy", "{n} phút trước", "{n} giờ trước", "hôm qua", "{n} ngày trước"; they read well after "Đã xem xong", "Đã phân tích", "Kiểm tra lần cuối:" | "Đã phân tích vừa nãy" |
| Retry delays | Fragments with their preposition: "sau 5 phút", "sau 2 giờ", "sau 1 ngày", "trong giây lát" (under a minute; never "ngay", which reads "right now"), after "Tự thử lại" | "Tự thử lại sau 5 phút", "Tự thử lại trong giây lát" |
| Count summaries | Fragments joined with ` · ` start with the number | "48 mùa đã đọc · 12 bộ cần cập nhật · 3 cần kiểm tra" |
| Separators | ` › ` and ` · ` kept exactly | "Cài đặt › Xem & đồng bộ" |
| Browser vocabulary | Chrome's Vietnamese UI: tab = **thẻ**, extension = **tiện ích**, side panel = **bảng điều khiển bên** (Chrome help center: "Quản lý bảng điều khiển bên của Chrome"); Firefox gear-menu item "Manage Extension Shortcuts" = **Quản lý phím tắt tiện ích mở rộng** (mozilla-l10n vi, `aboutAddons.ftl` › `addon-manage-extensions-shortcuts`) | "Tải lại thẻ" |
| Product names | Never translated (SyncKai, AniList, MyAnimeList, MAL, Crunchyroll, ADN, Netflix, Disney+, Firefox, Chrome, Brave, Reddit, GitHub, Weblate), nor "Redirect URL" / "App Redirect URL", "AL", "MAL", "JP" (no catalog text uses it since 2026-10-17: `agenda.jp` writes "Nhật {time}"), "E" in "E30" | |

## 2. Core terms

| English term | Vietnamese | Reason |
|---|---|---|
| Watching (status) | **Đang xem** | What Vietnamese fans say ("bộ đang xem") |
| Completed (status) | **Đã xem xong** (compact button: "Xem xong") | The user finished it. "Hoàn thành" avoided: Vietnamese anime sites use it for a show that finished airing |
| On hold (status) | **Tạm dừng** | |
| Dropped (status) | **Bỏ dở** | Usual word for a dropped show; never reads as Cancel ("Hủy") |
| Plan to watch (status) | **Dự định xem** | Usual tracker wording |
| Rewatching (status) | **Đang xem lại** | Progressive form, parallel to "Đang xem" |
| Watching (popup tab `nav.watching`) | **Đang xem** | Same word as the status |
| Activity (popup tab `nav.activity`) | **Hoạt động** | |
| series | **bộ anime**; **bộ** after a number or a demonstrative ("3 bộ", "bộ này"); **anime** right after "đồng bộ" ("Ngừng đồng bộ anime này") | Fans say "bộ"; avoids the clash "đồng bộ bộ" |
| title (of a show, Netflix import) | **tựa** | "250 tựa bị bỏ qua" |
| season | **mùa** | Netflix's Vietnamese UI ("Mùa 1") |
| part (split season) | **phần** | Kept distinct from season |
| episode / "Ep." | **tập** / **Tập N** | "Tập" is already short |
| arc | **arc** | Fans use the English word |
| list | **danh sách** | "danh sách của bạn" = the tracking list |
| entry (AniList / MyAnimeList page of an anime) | **mục** ("mục AniList", "mục MyAnimeList") | Standard word for a database entry; "trang" is kept for web pages ("Trên trang này"). Bare "mục" is also any item or section: in instructions and loading/aria texts outside a card that lists entries, write "mục AniList" ("Hãy nhấn vào biểu tượng SyncKai để chọn đúng mục AniList", "Đang tải mục AniList…") |
| sync (noun) | **đồng bộ**; counted: **lượt đồng bộ** | |
| sync (verb) / syncing… / synced | **đồng bộ** / **Đang đồng bộ…** / **Đã đồng bộ** | |
| not synced | **không được đồng bộ** | Never "không đồng bộ": it is the usual word for "asynchronous / out of sync" |
| auto sync | **Tự động đồng bộ** | |
| to check (`review.*`, `footer.toReview`) | **cần kiểm tra**; heading "Cần kiểm tra" | "Kiểm tra" = verify, never a critique |
| review (a to-check card) | **yêu cầu kiểm tra** | "Tạo 3 yêu cầu kiểm tra" |
| items to check (footer count) | **mục cần kiểm tra** ("3 mục cần kiểm tra") | A standalone count needs a noun; "mục" is also the generic word for an item |
| to rate | **cần chấm điểm** | |
| score, rating, stars | **điểm**; verb **chấm điểm** | "đánh giá" avoided (also means a written review) |
| comment (`notes.*`) | **ghi chú** | Private note (AniList Notes / MAL Comments); "bình luận" means a public comment |
| match, mapping (`match.*`, Settings › Matches) | **ghép nối** | "liên kết" is reserved for AniList's links to streaming pages |
| align (`compare.*`: "Match all to AniList") | **đồng nhất** ("Tất cả theo AniList") | Copying values to the other service; kept distinct from sync |
| excluded series | **bộ anime bị loại trừ**; chip **Đã loại trừ** | |
| pending sync, queue | **đồng bộ đang chờ** | |
| credits | **ending** | Anime fans' word for the end-credits sequence ("vào ending") |
| popup | **popup** | Common loanword; "cửa sổ bật lên" is too long |
| side panel | **bảng điều khiển bên** (short form: **bảng bên**) | Chrome's Vietnamese term (also Chrome's developer docs) |
| Now playing (panel tab) | **Đang phát** | Usual media wording |
| Schedule (panel tab, `agenda.*`) | **Lịch chiếu** | Vietnamese anime sites' word for the release calendar; reused in "Thông báo & lịch chiếu" |
| On this page | **Trên trang này** | |
| preferred player | **nền tảng ưu tiên** | The "player" is a streaming platform, not a media player app |
| history import | **nhập lịch sử xem** | |
| backup | **sao lưu** / **bản sao lưu** | Import/export of backups: "nhập" / "xuất"; never "nhập lịch sử" |
| preview | **xem trước** / **bản xem trước** | |
| rewatch | **xem lại** | Result fragments "no rewatch" (rewatch not started): **không chuyển sang xem lại**, never "không xem lại" (reads "don't rewatch") |
| account | **tài khoản** | |
| connect / disconnect / reconnect | **kết nối** / **ngắt kết nối** / **kết nối lại** | |
| sign in / sign out | **đăng nhập** / **đăng xuất** | |
| session expired | **phiên đã hết hạn** / **Phiên đăng nhập {service} đã hết hạn** | Never "Tài khoản … đã hết hạn": it reads as the AniList/MAL account itself expiring |
| release alerts | **thông báo tập mới** | |
| alerts (on-page level "Alerts only") | **cảnh báo** ("Chỉ cảnh báo") | Messages that need action; distinct from release alerts |
| release / airing | **ra tập** / **phát sóng** | "phát sóng tại Nhật" = Japanese broadcast; "Tập 5: còn 18 giờ" |
| airing statuses (`page.airing.*`): Airing / Upcoming / On hiatus / Finished / Cancelled | **Đang chiếu** / **Sắp chiếu** / **Hoãn chiếu** / **Đã kết thúc** / **Đã bị hủy**; badge "Series finished" = **Bộ đã kết thúc** | Vietnamese anime sites' wording; never "Đã xem xong" (user status) nor "Tạm dừng" (On hold) |
| offset, delay | **độ trễ** (agenda delay), **độ lệch** (episode-number offset) | |
| shortcut | **phím tắt** | |
| progress | **tiến độ** | |
| up to date | Sync results and on-site pills: **đã lưu từ trước** ("Tập 5 đã lưu từ trước", "AniList: đã lưu từ trước (tập 5)", pill "Đã lưu từ trước"); history-import chip only: **đã mới nhất** ("AL đã mới nhất", ≤ 15 chars); in counts **không cần cập nhật** | "đã cập nhật" avoided: it reads as "was updated" and is the import result "Đã cập nhật" |
| default entry page (`settings.entry.label`) | **Mở mục trên** (followed by the AniList / MAL control) | |
| no equivalent (MAL chip) | **không có mục** ("MAL không có mục") | |
| Netflix "Viewing activity" page | **trang Hoạt động xem** | Netflix's Vietnamese name (section 4) |
| absolute numbering | **đánh số liên tục** | Clearer than "tuyệt đối" |
| special / movie (formats) | **Đặc biệt** / **Movie** | Fans say "movie", "OVA" |
| unexpected error | **lỗi không mong muốn** | |
| More actions (menu button) | **Thao tác khác** ("Thao tác khác: {title}") | Never "Thêm thao tác", which reads "Add an action" |
| could not load (X unavailable) | **Không tải được …** ("Không tải được lịch chiếu", "Không tải được thông tin AniList") | "không khả dụng" kept only for a service ("dịch vụ không khả dụng") |
| Settings (`nav.settings`) | **Cài đặt** | Chrome's Vietnamese UI |

## 3. Settings names

| English | Vietnamese |
|---|---|
| Settings | Cài đặt |
| Quick settings / Playback & alerts / Data & help (groups) | Cài đặt nhanh / Xem & thông báo / Dữ liệu & trợ giúp |
| Accounts | Tài khoản |
| Playback & sync | Xem & đồng bộ |
| Settings categories of the 2026-10-17 redesign: Platforms / Notifications (`settings.cat.notifications`, one word: the Schedule options moved to Platforms) / Display; Playback & sync (`settings.cat.sync`) was removed | **Nền tảng** / **Thông báo** / **Hiển thị** |
| Shortcuts | Phím tắt |
| My data | Dữ liệu của tôi |
| Language | Ngôn ngữ |
| Help & about | Trợ giúp & giới thiệu |
| Sections: Playback / Sync / Side panel / Netflix (anime only) | Xem anime / Đồng bộ / Bảng điều khiển bên / Netflix (chỉ anime) |
| Sections: New episodes / On-page notifications / Schedule | Tập mới / Thông báo trên trang / Lịch chiếu |
| Sections: Matches / Excluded series / Backup / Import / Danger zone | Ghép nối / Bộ anime bị loại trừ / Sao lưu / Nhập / Vùng nguy hiểm |
| Sections: Help / About | Trợ giúp / Giới thiệu |
| Notification levels: Discreet / Detailed / Alerts only | Kín đáo / Chi tiết / Chỉ cảnh báo |

## 4. Netflix

- "Viewing activity" page: **Hoạt động xem** (Netflix's Vietnamese help center: "Mở Hoạt động xem.").
- "Show more" button at the bottom of netflix.com/viewingactivity: **Hiển thị thêm** (Netflix's Vietnamese help center, article "Viewing activity": "hãy sử dụng nút Hiển thị thêm"; the French and German versions of the same article give "Voir plus" and "Mehr anzeigen", the labels already validated on the real site).

## Development builds only

Settings › Help & about sections that exist only in development builds (2026-10-15, `settings.debugTrace.*`).

| English | Term |
|---|---|
| debug trace | dấu vết gỡ lỗi |
| event (one line of the trace) | sự kiện |
| verbose mode | chế độ chi tiết |

## Settings › Sync (2026-10-17)

| English | Term |
|---|---|
| Automatic (Sync section) | Tự động |
| Per series (Sync section) | Theo từng bộ |
| Never synced (Excluded series section) | Không bao giờ đồng bộ |
| Match origins: chosen / learned / legacy / imported · to recheck | Do bạn chọn / Tự học / Cũ / Đã nhập · cần kiểm tra lại |

## Settings › Platforms and Notifications (2026-10-17)

| English | Term |
|---|---|
| Where SyncKai follows your episodes (section) | Nơi SyncKai theo dõi tập bạn xem |
| Included (built-in platform) | Có sẵn |
| Access missing | Thiếu quyền |
| Turn on first (preferred player option) | Hãy bật trước |
| Estimated release time | Giờ ra mắt dự kiến |
| Extra delay (release alerts) | Trễ thêm |
| On the playback page (Notifications section) | Trên trang xem |

## Settings › My data and Help & about (2026-10-17)

| English | Term |
|---|---|
| Compare (My data section) | So sánh |
| AniList ↔ MyAnimeList differences (row title) | Khác biệt AniList ↔ MyAnimeList |
| Align (differences section) | Đồng nhất |
| Diagnostic report (row title) | Báo cáo chẩn đoán |
| Copy the report (button) | Sao chép báo cáo |
| What's new (About link) | Có gì mới |
| Privacy (About link) | Quyền riêng tư |
