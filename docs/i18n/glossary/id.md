# Indonesian (`id`) term sheet

Binding for every change to `src/i18n/locales/id.json` and `public/_locales/id/messages.json`. Shared rules are in `docs/i18n/GLOSSARY.md`.

## 1. Core terms

| English term | Indonesian | Reason |
|---|---|---|
| series | **anime** (plural unchanged: "3 anime") | Indonesian fans call a title simply "anime" ("anime ini", "anime yang di-drop"). "Seri" sounds formal and suggests a whole franchise. |
| series that may not be an anime (Netflix/Disney+ titles, `feedback.ignored.title`, `match.platform*`) | **judul** | "Anime diabaikan (bukan anime)" would contradict itself. "Judul" (title) stays neutral. |
| season | **season** ("Season 2" in labels, lowercase mid-sentence, "season-nya") | Established fan loanword ("nunggu season 3"). *Musim* is kept for airing seasons (Musim gugur 2024), so the two never mix. |
| airing season (Fall, Spring…) | **Musim gugur / Musim semi / Musim panas / Musim dingin** | Indonesian fan media wording ("anime musim gugur 2024"). Written with the year after the season: `Musim gugur {year}`. |
| episode / "Ep." before a number | **episode / Ep.** ("Ep. 5", counts "12 ep.") | Same word in Indonesian. Indonesian has no plural, so "ep." works for every count. |
| arc | **arc** | Fan usage. |
| part (of a split season) | **bagian** | "Season 2 · bagian 1/2". |
| list (the user's tracking list) | **daftar** ("daftarmu") | Standard UI word (Netflix "Daftar Saya"). |
| entry (anime page on AniList/MAL) | **entri** ("entrinya") | KBBI word for a record in a reference work. Never "postingan". |
| title | **judul** | |
| **Watching** (status) | **Menonton** | Short (fits the 14-char tab and chips) and mirrors "Watching". Same word as Netflix "Lanjutkan Menonton". |
| **Completed** (status) | **Selesai** | The user finished the series. Airing "finished" is **Tamat**, so the two never collide. |
| **On hold** (status) | **Ditunda** | Natural Indonesian for "put on hold". Video pause is **dijeda** and airing hiatus is **Hiatus**, so all three stay distinct. |
| **Dropped** (status) | **Di-drop** (action: **Drop**, "Drop anime ini") | The fan term ("anime yang gue drop"). *Dihentikan* would read like "cancelled by the studio". |
| **Plan to watch** (status) | **Rencana** | Direct equivalent of AniList's "Planning". It keeps "Tambah ke Rencana" within the ~20-char add button ("Rencana menonton" would be truncated). |
| **Rewatching** (status) | **Menonton ulang** | Pairs with "Menonton". |
| Watching tab (`nav.watching`) | **Menonton** | Same as the status. |
| Activity tab (`nav.activity`) | **Aktivitas** | |
| sync (noun) | **sinkron** ("Sinkron gagal", "3 sinkron tertunda", "Sinkron terbaru") | One short noun everywhere, common in casual tech Indonesian. *Sinkronisasi* is too long for chips. |
| sync (verb) / synced | **menyinkronkan, disinkronkan, sinkronkan** / **tersinkron** | "Menyinkronkan…" (in progress), "Tersinkron". |
| Stop syncing / Resume syncing (exclude a series) | **Jangan sinkronkan (anime ini)** / **Sinkronkan lagi** | "Don't sync": a lasting choice, not "stop the current sync". |
| to check (`review.*`) | **perlu dicek** (section: "Perlu dicek"); a check card: **pengecekan** | *Cek* is the everyday Indonesian verb for "check, verify". It never means a critique. |
| to rate | **perlu dinilai** | |
| score / rating / stars | **nilai** (verb: **beri nilai**, **menilai**) | "Berapa nilaimu?" asks "Your rating?". Data values in `compare.keepTitle` use **data**, so "nilai" always means the score. |
| comment (`notes.*`) | **catatan** | Private free text (AniList "Notes"). *Komentar* suggests public comments in Indonesian. Never means a score. |
| match, mapping (Settings › Matches) | **pencocokan** | Remembered season → entry link; uncertain match = "pencocokan belum pasti". |
| match / align (AniList ↔ MAL differences) | **samakan / penyamaan**; Keep = **Pakai** ("Pakai AniList", "Semua pakai AniList") | Copying values between services is a different concept from mapping. |
| excluded series | **anime yang dikecualikan** (heading and path: **Anime yang dikecualikan**, chip: **Dikecualikan**; status lines keep the sentence form "Anime dikecualikan") | A heading that names a list is a noun phrase and needs "yang"; without it, "Anime dikecualikan" reads as the sentence "the anime is excluded" (review 2026-10-14). |
| pending sync / queue | **sinkron tertunda** | *Tertunda* is the usual UI word for "pending" (transaksi tertunda). |
| credits | **kredit penutup** (short: **kredit**) | End credits. |
| popup | **popup** | Common word for an extension popup. |
| side panel | **panel samping** | Chrome Indonesian term. Firefox's "bilah samping" is the same feature. |
| Now playing (panel tab) | **Sedang diputar** | Spotify/YouTube Music Indonesian wording. |
| Schedule (`panel.tab.agenda`, `agenda.*`) | **Jadwal** | Reused in "Notifikasi & jadwal". |
| On this page | **Di halaman ini** | |
| preferred player | **Platform pilihan** ("platform pilihanmu") | It is a streaming site, not a media-player app, and *pemutar* would suggest one. |
| history import | **impor riwayat tontonan** | *Riwayat* = history (Google, streaming apps). |
| backup | **cadangan** (file: `synckai-cadangan-{date}.json`) | Never the same word as the history import. *Pengganti* is used for "fallback" so *cadangan* stays unambiguous. |
| SyncKai's sync history (backup content) | **riwayat sinkron** | Distinguishes it from the streaming watch history. |
| preview | **pratinjau** | Standard Google/Microsoft term. |
| rewatch (noun/verb) | **tonton ulang** | "Tonton ulang tidak tersimpan", "tanpa tonton ulang". |
| account | **akun** | |
| connect / reconnect / disconnect | **hubungkan / hubungkan lagi / keluar** | "Keluar" (sign out, Google wording). *Putuskan* could also be read as "decide". |
| sign in, sign-in | **login** ("Silakan login lagi", "data login") | Ubiquitous loanword. *Masuk* does not work as a noun ("Login dibatalkan"). |
| session expired | **sesi berakhir** | |
| connected / not connected | **terhubung / belum terhubung** | |
| release alerts (`airing.*`, `settings.quick.airing.label`) | **pengingat rilis** ("pengingat mati", "pengingat +3 jam") | Indonesian streaming apps use "Ingatkan saya" for release notifications. Kept apart from in-page alerts. |
| alerts only (in-page messages needing action) | **Peringatan saja** / **peringatan** | Warnings, not release alerts. |
| on-page notifications | **notifikasi di halaman** | |
| release / out | **rilis** ("sudah rilis", "Rilis berikutnya") | |
| airing / broadcast | **tayang / penayangan** ("tayang di Jepang") | Airing statuses: Sedang tayang, Tamat, Akan tayang, Dibatalkan, Hiatus. |
| offset / delay (`agenda.*`, `settings.mappings.offset`) | **selisih (waktu)** | Works for negative values ("before" the broadcast). |
| delay of release alerts (`settings.delay.*`) | **penundaan** | Always positive (0–6 h). |
| shortcut | **pintasan** ("Pintasan keyboard") | Chrome and Firefox Indonesian wording. |
| Settings (`nav.settings`) | **Setelan** | Chrome/Android/WhatsApp Indonesian, shorter than *Pengaturan*. |
| Settings categories | **Pemutaran & sinkron** (Playback & sync), **Notifikasi & jadwal** (Notifications & schedule), **Pintasan** (Shortcuts), **Data saya** (My data), **Bantuan & tentang** (Help & about) | Paths: "Setelan › Pemutaran & sinkron", "Setelan › Anime yang dikecualikan". |
| Settings categories of the 2026-10-17 redesign | Platforms = **Platform** · Notifications (`settings.cat.notifications`, one word: the Schedule options moved to Platforms) = **Notifikasi** · Display = **Tampilan** | Playback & sync (`settings.cat.sync`) was removed |
| Settings sections | Akun, Bahasa, Episode baru, Cadangan, Anime yang dikecualikan, Bantuan, Tentang, Pencocokan, Notifikasi di halaman, Pemutaran, Sinkron, Jadwal, Zona bahaya, Impor, Panel samping | "Zona bahaya" is the idiomatic compound (news: "zona bahaya Merapi"); "zona berbahaya" means "a dangerous zone". |
| error | **error** ("Error tak terduga", "Log error") | Everyday loanword, shorter than *kesalahan*. |
| progress | **progres** ("progresmu") | KBBI loanword used by fans. |
| update / updated | **perbarui / diperbarui** | |
| already up to date (the list already has this episode or a later one: sync results, import preview) | **sudah tercatat** ("AniList: sudah tercatat (episode 5)", "Sudah tercatat (30)") | Changed from "sudah terbaru" in the 2026-10-14 review: "terbaru" means "latest", and next to an episode number fans read "episode terbaru" (the newest episode). "terbaru" is kept only for "latest / recent" (Sinkron terbaru, error terbaru). |
| track (follow viewing) | **melacak** | |
| Open / Retry / Cancel / Close / Confirm / Ignore / Save | Buka / Coba lagi / Batal / Tutup / Konfirmasi / Abaikan / Simpan | |
| Abandon (pending sync) | **Batalkan** | Removes the queued sync. |
| Default | **Bawaan** (button restoring it: **Pakai bawaan**) | |
| Correct (fix a sync) | **Perbaiki** | Always a verb. |
| Continue (card of the series to keep watching) | **Lanjutkan menonton** | Card heading, not a button (Netflix ID row "Lanjutkan Menonton"). |
| Your rating? (rating bubble) | **Berapa nilaimu?** | Quoted in `settings.ratingPrompt.help`. |
| Previous / Next week (Schedule arrows) | **Minggu sebelumnya / Minggu berikutnya** | Relative to the displayed week; "minggu lalu / depan" are relative to today. |
| account signed out or changed (during a job) | **akun terputus atau diganti** | One signs out OF an account ("keluar dari akun"); "akun keluar" reads as "the account leaves". |

## 2. Conventions

- **Register**: friendly app Indonesian, the user is **kamu**, and possessives take **-mu** (daftarmu, riwayatmu, progresmu). After a placeholder or a foreign word the text says "kamu" or rephrases ("riwayatmu di {platform}"), never "{platform}-mu". First-person labels use **saya** ("Anime saya", "Data saya", "Baca riwayat saya"). Imperatives are bare verbs ("Buka", "Coba lagi"), and the text never uses *Anda*.
- **Quotation marks**: “…” (U+201C/U+201D).
- **Colon**: no space before ("Jadwal tidak tersedia: …").
- **Ellipsis**: the single character `…` ("Memuat…", "Menyinkronkan…").
- **Units**: min → **mnt**, h → **jam** (never "h"/"hr", which read as English hours), d → **hari** (written out because "h"/"hr" are ambiguous), s → **dtk**. Percent is "85%" with no space (PUEBI). Size "5 MB".
- **Relative time**: "baru saja", "5 mnt lalu", "2 jam lalu", "kemarin", "3 hari lalu". Retry delays: "dalam 5 mnt", "dalam 2 jam", "dalam 3 hari", "segera". Labels that take a relative time end with a colon ("Terakhir dicek: …", "Selesai: …", "Dianalisis: …"): "Selesai baru saja" puts the adverb after the verb, "Selesai: baru saja" reads naturally with every value. Retry delays follow "Dicoba lagi" directly.
- **Relative clauses**: a verb phrase describing a noun takes "yang" ("Tidak ada episode yang diputar", "Belum ada anime yang dikecualikan", cf. Chrome "Tidak ada file yang dipilih"). Status lines that are sentences keep the short form ("Anime dikecualikan", "Video tidak terdeteksi").
- **Failures of a user action**: "Gagal + verb" ("Gagal membatalkan sinkron. Coba lagi.", "Gagal mengecualikan anime ini."). Never "X tidak bisa dibatalkan / diabaikan / dikecualikan", which reads as a prohibition ("cannot be cancelled") rather than a failure. "X tidak bisa dihubungi / dibaca" stays for unreachable services and unreadable files.
- **No article calques**: no "sebuah" / "satu" for the English "a / an / one" ("Putar episode", "Buka {site} di tab baru", "Mulai menonton anime di …").
- **`{service}: {message}`** → `{service}: {message}`. Fragments start lowercase ("AniList: episode 5 tersimpan"). Texts that the code lowercases start with a common word, never with a product name.
- **`{title}: completed`** → `{title}: selesai` (also "{title}: di-drop", "{title}: ditunda"). Indonesian has no gender agreement.
- **Plurals**: Indonesian only has `_other`. Nouns do not change after numbers ("1 episode", "12 episode").
- **Capitalisation**: sentence case. Status and tab names keep their capital when quoted inside a sentence ("Tambah ke Rencana", "buka tab Menonton", "(Aktivitas)").
- **Separators**: ` › ` and ` · ` kept exactly.

## 3. Netflix

- "Show more" button at the bottom of netflix.com/viewingactivity: **Tampilkan Lainnya**. Source: Netflix Help Center in Indonesian, article "Cara melihat riwayat streaming dan aktivitas perangkat" (help.netflix.com/id/node/101917), which tells users to "gunakan tombol Tampilkan Lainnya". The English article uses "Show More" at the same step.
- The "Viewing activity" page is named **Aktivitas streaming** in Netflix's Indonesian UI (same article: "Buka Aktivitas streaming."). The catalog quotes it as halaman “Aktivitas streaming”.
- Firefox (for `settings.shortcut.manualFirefox`): "Manage Extension Shortcuts" = **Kelola Pintasan Ekstensi** (mozilla-l10n `id` aboutAddons.ftl, message `addon-manage-extensions-shortcuts`).
- All three names re-checked against the live sources in the 2026-10-14 review.

## Development builds only

Settings › Help & about sections that exist only in development builds (2026-10-15, `settings.debugTrace.*`).

| English | Term |
|---|---|
| debug trace | jejak debug |
| event (one line of the trace) | peristiwa |
| verbose mode | mode terperinci |

## Settings › Sync (2026-10-17)

| English | Term |
|---|---|
| Automatic (Sync section) | Otomatis |
| Per series (Sync section) | Per anime |
| Never synced (Excluded series section) | Tidak pernah disinkronkan |
| Match origins: chosen / learned / legacy / imported · to recheck | Dipilih olehmu / Dipelajari / Lama / Diimpor · perlu dicek ulang |

## Settings › Platforms and Notifications (2026-10-17)

| English | Term |
|---|---|
| Where SyncKai follows your episodes (section) | Tempat SyncKai melacak episodemu |
| Included (built-in platform) | Bawaan |
| Access missing | Tanpa akses |
| Turn on first (preferred player option) | Aktifkan dulu |
| Estimated release time | Perkiraan waktu rilis |
| Extra delay (release alerts) | Penundaan ekstra |
| On the playback page (Notifications section) | Di halaman pemutaran |

## Settings › My data and Help & about (2026-10-17)

| English | Term |
|---|---|
| Compare (My data section) | Bandingkan |
| AniList ↔ MyAnimeList differences (row title) | Perbedaan AniList ↔ MyAnimeList |
| Align (differences section) | Samakan |
| Diagnostic report (row title) | Laporan diagnostik |
| Copy the report (button) | Salin laporan |
| What's new (About link) | Yang baru |
| Privacy (About link) | Privasi |
