# Indonesian (`id`) review log

Independent native review of `src/i18n/locales/id.json` (878 keys: the 934 English keys minus the 56 `_one` variants Indonesian does not use) and `public/_locales/id/messages.json`, 2026-10-14. Inputs: `docs/i18n/GLOSSARY.md`, `docs/i18n/glossary/id.md`, `docs/i18n/context.json`, `en.json`, `fr.json`, `de.json`.

Method: terminology audit (concordance of every core term of the shared glossary across the catalog: series, season, episode, list, entry, sync, to check, to rate, score, comment, match, excluded, pending sync, credits, popup, side panel, Now playing, Schedule, On this page, preferred player, history import, backup, preview, rewatch, account / connect / session expired, release alerts, Settings and its categories, the six list statuses, Activity, Watching); key-by-key reading of every key with its context note (meaning against EN and FR, grammar and EYD spelling, register, placeholders filled with the realistic values of the notes, composed texts such as `{service}: {message}`, `gagal: {error}`, relative times after their labels and the `{text} · …` feedback lines, cross-references to tab, button and settings names, lengths against the limits of the notes and the actual layout of the popup footer, onboarding steps, Continue card and Settings rows); scans for `Anda`, `sebuah` calques, relative clauses without `yang`, `di-` prefix vs preposition, `tak` / `tidak`, quotes, ellipsis, final punctuation against English and mid-sentence capitals. External names re-checked live: Netflix “Aktivitas streaming” and “Tampilkan Lainnya” (help.netflix.com/id/node/101917), Firefox “Kelola Pintasan Ekstensi” (mozilla-l10n `id` `aboutAddons.ftl`, `addon-manage-extensions-shortcuts`), Chrome “panel samping”.

Result: 65 keys changed in `id.json`; `messages.json` unchanged (`extDescription` 92 characters, both command texts identical to `settings.shortcuts.episode` / `settings.shortcuts.panel`). `npm run i18n:check -- id`: 0 errors (the remaining length warnings are sentences, tooltips or aria-labels, or were checked against the layout; see the debatable list).

The translation was already good: correct `kamu` register everywhere (no `Anda`), consistent core terms, correct PUEBI forms (`di-drop`, `season-nya`, `ke-{index}`, `apa pun`, `kedaluwarsa`, `analisis`), Netflix and Firefox names right. The fixes are mostly grammar (relative clauses without `yang`, "akun keluar"), failure messages that read as prohibitions, calques of the English article (`sebuah`, `satu`), the ambiguous "sudah terbaru", and texts whose meaning drifted once composed or seen in place.

## Changes

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `feedback.service.upToDate` | sudah terbaru (episode {progress}) | sudah tercatat (episode {progress}) | terminology | "sudah terbaru" means "already the latest"; next to an episode number it reads as "this is the newest episode" (fans say "episode terbaru"). "tercatat" = already recorded in the list |
| `toast.pill.alreadyUpToDate` | Sudah terbaru | Sudah tercatat | terminology | Same "terbaru" ambiguity, in the toast "… · {title}" right after an episode ends |
| `crImport.skipReason.up-to-date` | sudah terbaru | sudah tercatat | terminology | Same term change (chip "AL sudah tercatat", 14 chars ≤ 15) |
| `crImport.preview.upToDate_other` | {count} sudah terbaru | {count} sudah tercatat | terminology | Same term change in the preview summary line |
| `crImport.preview.upToDateTitle_other` | Sudah terbaru ({count}) | Sudah tercatat ({count}) | terminology | Same term change in the collapsible block title |
| `settings.section.exclusions` | Anime dikecualikan | Anime yang dikecualikan | terminology | A heading naming a list is a noun phrase: without "yang" it reads as the sentence "Anime is excluded". 23 chars ≤ 24 |
| `import.summary.excludedSeries_other` | anime dikecualikan | anime yang dikecualikan | terminology | Row label = same noun phrase as the section heading |
| `popup.syncDisabledDetail` | Bisa diaktifkan lagi di Setelan › Anime dikecualikan | Bisa diaktifkan lagi di Setelan › Anime yang dikecualikan | cross-reference | Path must match the renamed heading settings.section.exclusions |
| `review.excludeTitle` | Mengecualikan anime ini (semua season): bisa diaktifkan lagi di Setelan › Anime dikecualikan | Mengecualikan anime ini (semua season): bisa diaktifkan lagi di Setelan › Anime yang dikecualikan | cross-reference | Same path |
| `settings.ratingPrompt.help` | Gelembung “Nilaimu?” saat anime berstatus Selesai | Gelembung “Berapa nilaimu?” saat status anime menjadi Selesai | cross-reference | Quotes the new prompt.rating.question; "menjadi" renders "moves to Completed" (the transition), "berstatus" only meant "has the status" |
| `agenda.next` | Minggu depan | Minggu berikutnya | meaning | "Minggu depan" = the week after today; the arrow moves one week from the DISPLAYED week (FR « suivante ») |
| `agenda.prev` | Minggu lalu | Minggu sebelumnya | meaning | "Minggu lalu" = last week from today; same relative-navigation problem |
| `common.excludeFailed` | Anime ini tidak bisa dikecualikan. Coba lagi. | Gagal mengecualikan anime ini. Coba lagi. | meaning | "tidak bisa dikecualikan" reads as a rule ("this anime cannot be excluded"), not as a failure; "Gagal + verb" is the failure pattern already used by popup.excludeFailed |
| `popup.abandonFailed` | Sinkron tidak bisa dibatalkan. Coba lagi. | Gagal membatalkan sinkron. Coba lagi. | meaning | "Sinkron tidak bisa dibatalkan" reads as "the sync cannot be cancelled" (a prohibition) |
| `popup.ignoreFailed` | Anime ini tidak bisa dilewati. Coba lagi. | Gagal mengabaikan anime ini. Coba lagi. | meaning | "tidak bisa dilewati" reads as "can't be skipped" (a must-watch!) and did not echo the "Abaikan" button |
| `review.dismissFailed` | Pengecekan tidak bisa diabaikan. Coba lagi. | Gagal mengabaikan pengecekan ini. Coba lagi. | meaning | "tidak bisa diabaikan" reads as "must not be ignored" |
| `settings.exclusions.reactivateFailed` | Anime ini tidak bisa diaktifkan lagi. Coba lagi. | Gagal mengaktifkan ulang anime ini. Coba lagi. | meaning | "tidak bisa diaktifkan lagi" reads as "can no longer be enabled"; same "Gagal + verb" pattern |
| `settings.help.text` | Error hanya disimpan di browser ini. Error baru dibagikan kalau kamu menyalin laporannya. | Error hanya disimpan di browser ini dan tidak dibagikan kecuali kamu menyalin laporannya. | meaning | "Error baru dibagikan…" parses as "New errors are shared…" |
| `settings.mappings.hide` | Tutup | Sembunyikan | meaning | Collapses the list (opposite of "Kelola"): "Tutup" means "close"; 11 chars ≤ 12 |
| `watching.resume` | Lanjutkan | Lanjutkan menonton | meaning | Card heading "Continue watching", not a button; bare "Lanjutkan" is an imperative. Netflix ID row: "Lanjutkan Menonton" |
| `watching.nextWatched` | Episode berikutnya ditonton | Tandai episode berikutnya sudah ditonton | meaning | Tooltip of the +1 button: "Episode berikutnya ditonton" reads as a statement ("the next episode has been watched") |
| `footer.toRate_other` | {count} perlu dinilai | {count} anime perlu dinilai | meaning | "3 perlu dinilai" had no noun ("3 need rating"); 21 chars, the footer status has ~35 |
| `footer.toReview_other` | {count} perlu dicek | {count} item perlu dicek | meaning | Same missing noun; mirrors EN "items" and the Activity tab label "item perlu ditangani" |
| `onboarding.hint.anilist` | Disarankan untuk pencocokan | Disarankan untuk mengenali anime | meaning | "pencocokan" is jargon on the welcome screen; the note means identifying the anime |
| `onboarding.step3` | Daftarmu sudah terbaru saat kredit | Daftarmu diperbarui saat kredit mulai | meaning | "…sudah terbaru saat kredit" was elliptical ("at credits") and used "terbaru"; now matches settings.trigger.credits ("Saat kredit penutup mulai") |
| `settings.ratingPrompt.label` | Minta nilai saat anime selesai | Minta nilai saat anime selesai ditonton | meaning | "saat anime selesai" also means "when the anime finishes airing"; the trigger is the user completing it |
| `crImport.preview.oneService` | Hanya {service} yang terhubung: hanya itu yang diperbarui. | Hanya {service} yang terhubung: hanya itu yang akan diperbarui. | meaning | Preview shown before writing: future tense |
| `compare.error.busy` | Analisis atau penyamaan sedang berjalan. | Analisis atau penyamaan lain sedang berjalan. | meaning | "lain" renders "already running" (another job); same wording as crImport.error.busy |
| `agenda.adjust.reset` | Bawaan | Pakai bawaan | meaning | Button next to "Simpan" / "Batal": the bare noun "Bawaan" does not say it restores the default delay; 12 chars ≤ 12 |
| `content.shortcut.noPlayback.title` | Tidak ada episode diputar | Tidak ada episode yang diputar | grammar | Relative clause after "Tidak ada + noun" needs "yang" (cf. Chrome ID "Tidak ada file yang dipilih") |
| `crImport.connect.none` | Tidak ada tab {platform} terbuka. | Tidak ada tab {platform} yang terbuka. | grammar | Missing "yang" |
| `crImport.error.nothingSelected` | Tidak ada anime dicentang. | Tidak ada anime yang dicentang. | grammar | Missing "yang" |
| `crImport.error.noJob` | Tidak ada impor berjalan. | Tidak ada impor yang berjalan. | grammar | Missing "yang" |
| `settings.exclusions.empty` | Belum ada anime dikecualikan. | Belum ada anime yang dikecualikan. | grammar | Missing "yang" |
| `settings.help.noErrors` | Tidak ada error tercatat | Tidak ada error yang tercatat | grammar | Missing "yang" |
| `feedback.notConnected.title` | Tidak ada akun terhubung | Tidak ada akun yang terhubung | grammar | Missing "yang"; now identical to airing.skip.notConnected (29 chars, the footer status has room) |
| `settings.summary.noAccount` | Tidak ada akun terhubung | Tidak ada akun yang terhubung | grammar | Same fix (29 ≤ 30) |
| `panel.live.noVideo` | Tidak ada video terdeteksi | Video tidak terdeteksi | grammar | "Tidak ada video terdeteksi" lacked "yang"; the natural status is shorter (22 ≤ 30) |
| `crImport.skip.sessionClosed` | {service}: akun keluar atau berganti selama impor, tidak ada yang ditulis | {service}: akun terputus atau diganti selama impor, tidak ada yang ditulis | grammar | "akun keluar" = "the account exits"; one signs out OF an account. "terputus" matches crImport.skip.notConnected, "diganti" = replaced |
| `crImport.error.sessionClosed` | Akun keluar atau berganti selama analisis: jalankan analisis lagi. | Akun terputus atau diganti selama analisis: jalankan analisis lagi. | grammar | Same "akun keluar" problem |
| `sync.sessionClosed` | Akun sudah keluar atau berganti: tidak ada yang ditulis | Akun sudah terputus atau diganti: tidak ada yang ditulis | grammar | Same; also covers a session ended by the service, not only a voluntary sign-out |
| `queue.sessionClosed` | Sinkron dari akun yang sudah keluar: dihapus tanpa menulis apa pun. | Sinkron dari akun yang sudah terputus: dihapus tanpa menulis apa pun. | grammar | Same "akun yang sudah keluar" problem |
| `onboarding.hint.mal` | Bisa sendiri atau bersama AniList | Berfungsi sendiri atau dengan AniList | grammar | "Bisa sendiri atau bersama AniList" had no verb ("can alone or with AniList"); 37 chars, one line |
| `settings.entry.help` | Dibuka saat kamu klik judul atau sampul anime, jika kedua akun terhubung | Dibuka saat judul atau sampul anime diklik, jika kedua akun terhubung | grammar | "saat kamu klik" uses a bare non-standard verb (standard: "mengeklik"); the passive is the natural UI form |
| `settings.help.reportTitle` | Membuka formulir laporan di GitHub yang sudah terisi | Membuka formulir laporan yang sudah terisi di GitHub | grammar | "…di GitHub yang sudah terisi" attached "prefilled" to GitHub |
| `agenda.empty.noSeries` | Belum ada anime yang sedang ditonton. Mulai tonton satu di Crunchyroll atau ADN, nanti jadwal rilisnya muncul di sini. | Belum ada anime yang sedang ditonton. Mulai menonton anime di Crunchyroll atau ADN, nanti jadwal rilisnya muncul di sini. | style | "Mulai tonton satu" is a calque of "Start one" |
| `agenda.empty.noSeriesPlatforms` | Belum ada anime yang sedang ditonton. Mulai tonton satu di {platforms}, nanti jadwal rilisnya muncul di sini. | Belum ada anime yang sedang ditonton. Mulai menonton anime di {platforms}, nanti jadwal rilisnya muncul di sini. | style | Same calque |
| `content.shortcut.noPlayback.message` | Buka sebuah episode untuk menandainya sudah ditonton dengan pintasan. | Buka episode dulu untuk menandainya sudah ditonton lewat pintasan. | style | "Buka sebuah episode" calques the English article; "dulu" carries "first" |
| `crImport.connect.openFailed` | {platform} tidak bisa dibuka. Buka {site} di sebuah tab. | {platform} tidak bisa dibuka. Buka {site} di tab baru. | style | "di sebuah tab" calques "in a tab" |
| `onboarding.step1` | Putar sebuah episode | Putar episode | style | "Putar sebuah episode": "sebuah" calques "an" |
| `watching.empty.text` | Putar sebuah episode di Crunchyroll atau ADN: animenya akan muncul di sini beserta tanggal episode berikutnya. | Putar episode di Crunchyroll atau ADN: animenya akan muncul di sini beserta tanggal episode berikutnya. | style | Same "sebuah" calque |
| `watching.empty.textPlatforms` | Putar sebuah episode di {platforms}: animenya akan muncul di sini beserta tanggal episode berikutnya. | Putar episode di {platforms}: animenya akan muncul di sini beserta tanggal episode berikutnya. | style | Same "sebuah" calque |
| `panel.nowPlaying.noPage` | Buka sebuah anime atau episode untuk melihat entrinya di sini. | Buka halaman anime atau episode untuk melihat entrinya di sini. | style | "Buka sebuah anime" calque; it is a series PAGE that is opened |
| `panel.nowPlaying.notFoundHint` | Untuk memilih entrinya, selesaikan episodenya: SyncKai akan menanyakannya di popup (“Perlu dicek”). | Untuk memilih entrinya, tonton episode ini sampai selesai: SyncKai akan memintamu memilihnya di popup (“Perlu dicek”). | style | "selesaikan episodenya" is stiff and "akan menanyakannya" (will ask about it) left out who picks; now "will ask you to pick it" |
| `prompt.rating.question` | Nilaimu? | Berapa nilaimu? | style | "Nilaimu?" is a bare noun; an Indonesian question needs "Berapa" |
| `prompt.rewatch.title` | Menonton ulang “{title}”? | Sedang menonton ulang “{title}”? | style | Natural question form; pairs with the "Ya, menonton ulang" button |
| `airing.status.notified_other` | {count} episode diberitahukan | pengingat terkirim untuk {count} episode | style | "{count} episode diberitahukan" is stiff; reuses the release-alert term "pengingat" |
| `settings.notif.discreet.desc` | Label kecil selama 3 dtk di pojok. Tidak ada apa-apa saat layar penuh; ikon ekstensi menampilkan tanda centang. | Label kecil selama 3 dtk di pojok. Tidak muncul saat layar penuh; ikon ekstensi menampilkan tanda centang. | style | "Tidak ada apa-apa saat layar penuh" is clumsy |
| `settings.quick.airing.help` | Notifikasi saat episode baru dari anime yang kamu tonton rilis | Notifikasi saat ada episode baru dari anime yang kamu tonton | style | The verb "rilis" came last after a long relative clause; "saat ada episode baru" is the natural phrasing |
| `page.notTracked` | Tidak ada yang dilacak di sini: di {platform}, SyncKai hanya melacak anime yang dikenali AniList. | Tidak ada yang bisa dilacak di sini: di {platform}, SyncKai hanya melacak anime yang dikenali AniList. | style | "Nothing to track here" = "nothing that can be tracked" |
| `settings.section.danger` | Zona berbahaya | Zona bahaya | style | The idiomatic compound is "zona bahaya" (as in news "zona bahaya Merapi"); "zona berbahaya" = "a dangerous zone" |
| `compare.analyzedAt` | Dianalisis {relative} | Dianalisis: {relative} | style | "Dianalisis baru saja" puts "baru saja" after the verb (unnatural); the colon form reads naturally with every time.* value, like "Terakhir dicek: {relative}" |
| `ratings.completed` | Selesai {relative} | Selesai: {relative} | style | Same: "Selesai baru saja" → "Selesai: baru saja" |
| `airing.unknownError` | Error tak diketahui | penyebab tidak diketahui | style | Only inserted after "gagal: " (airing.status.failed): the line read "gagal: Error tak diketahui" (failure said twice, capital mid-line) |
| `prompt.rewatch.failed` | Tonton ulang tak tersimpan | Tonton ulang tidak tersimpan | consistency | Same bubble type as prompt.rating.failed "Nilai tidak tersimpan": "tidak", not "tak" |

Changes per category: meaning 19, style 19, grammar 16, terminology 7, cross-reference 3, consistency 1 (total 65). No placeholder, length or typography error was found: every placeholder was present and correctly spelled, and the quotes (“…”), ellipsis (…), colons and separators already followed the term sheet.

## Term sheet updates (`docs/i18n/glossary/id.md`)

- **Already up to date** → **sudah tercatat** (was "sudah terbaru"): "terbaru" means "latest", and next to an episode number anime fans read "episode terbaru" (the newest episode). "terbaru" now only means "latest / recent" (Sinkron terbaru, error terbaru).
- **Excluded series** heading and path → **Anime yang dikecualikan** (status lines keep "Anime dikecualikan", a sentence).
- **Danger zone** → **Zona bahaya** (idiomatic compound).
- New rows: "Pakai bawaan" (button restoring the default), "Lanjutkan menonton" (Continue card), "Berapa nilaimu?" (rating bubble), "Minggu sebelumnya / berikutnya" (week arrows), "akun terputus atau diganti" (account signed out or changed).
- New conventions: relative clauses take `yang`; failures of a user action use "Gagal + verb", never "X tidak bisa dibatalkan / diabaikan / dikecualikan" (reads as a prohibition); labels followed by a relative time end with a colon ("Selesai: …", "Dianalisis: …"); no `sebuah` / `satu` calques of the English article.

## Debatable, left unchanged

| Key(s) | Current text | Why it was kept |
|---|---|---|
| "sinkron" as a noun (41 keys: `feedback.error.title`, `footer.queuePending_other`, `recent.title`, `settings.section.sync`, `settings.autoSync.label`…) | Sinkron gagal, {count} sinkron tertunda, Sinkron terbaru, Sinkron | KBBI lists "sinkron" as an adjective, and Google, Samsung and Microsoft UIs say "sinkronisasi". Kept: the term sheet's decision for a casual fan-to-fan tone and the tight chips and footer ("3 sinkronisasi tertunda" would crowd the footer); used consistently everywhere. A native human reviewer should confirm before any switch, which would touch every sync key |
| `page.status.PLANNING`, `page.addPlanning`, `page.added.PLANNING` | Rencana, Tambah ke Rencana, Ditambahkan ke Rencana | Bare "Rencana" ("Plan") mirrors AniList's "Planning"; "Rencana ditonton" is clearer but the add button holds ~20 characters |
| `page.status.DROPPED`, `page.action.DROPPED`, `watching.status.DROPPED`, `inline.status.DROPPED` | Di-drop, Drop, Drop anime ini, {title}: di-drop | Fan slang, correctly hyphenated (PUEBI: Indonesian prefix + foreign word). "Dihentikan" would read as "cancelled by the studio" |
| `common.reconnect` | Hubungkan lagi | 14 characters for a ~12 limit; measured against the footer (~250 px left for "Sesi berakhir" + this button), it fits. "Login lagi" is shorter but breaks the connect / reconnect pair |
| `panel.tab.nowPlaying` | Sedang diputar | 14 characters for a 12 limit; Spotify / YouTube Music Indonesian wording, and each of the two panel tabs has ~165 px. Worth a look in the 3-option "Tab saat dibuka" control of Settings |
| `common.syncing`, `panel.live.syncing` | Menyinkronkan… | 14 characters for ~12; the correct in-progress verb, FR is 16 |
| `common.stopSync` | Jangan sinkronkan | 17 characters for ~16; no shorter wording keeps the "lasting choice" sense without suggesting "stop the current sync" |
| `compare.filter.missingAniList` | Tak ada di AniList | 18 characters for a 16 limit (FR is 18 too); identical to the chip, which allows 18 |
| `settings.notif.discreet.title` | Ringkas | "Concise" rather than "discreet", but it pairs naturally with "Detail" and "Peringatan saja"; "Minimal" / "Senyap" are the alternatives |
| `settings.panel.live.label` | Tampilkan progres langsung | "langsung" = live (siaran langsung) but can also read "directly"; the help line right under it removes the doubt; "real-time" would be the loanword alternative |
| `settings.mappings.reset` | Reset semua | Loanword used by Chrome Indonesian ("Reset setelan"); "Setel ulang semua" is the formal alternative |
| `crImport.review.series` | Tanpa season | Adaptation of "Series" (the history gives no season, so the row covers the whole series); clearer than a bare "Anime" at the start of the row |
| `controls.nothingToRemove` | Belum ada episode yang ditonton | States the reason (progress is 0) instead of "nothing to remove"; clearer after "AniList: " |
| `panel.live.pointCredits` | Sinkron di kredit penutup | "saat kredit penutup" would be more natural but is 27 characters for a 26 limit |
| `footer.toReview_other` | {count} item perlu dicek | "item" is a loanword; "pencocokan" would be more specific but less clear to a new user |
| `airing.notification.single` | Ep. {episode} {title} sudah rilis | No preposition between the number and the title ("Ep. 5 Frieren sudah rilis"), the usual Indonesian headline order; the system truncates notification titles, so no "dari" |

## Outside the catalog

- `src/shared/agenda.ts` › `formatOffset` builds the `{offset}` of `agenda.estimate.title` / `agenda.estimate.custom` with hard-coded "h" and "min" ("tayang di Jepang +1 h"). Indonesian uses "jam" / "mnt" (`panel.live.minutes`, `time.countdown.*`): the units should come from the catalogs.

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | Musim dingin / Musim semi / Musim panas / Musim gugur | Musim dingin {year} / Musim semi {year} / Musim panas {year} / Musim gugur {year} | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |
| `sync.noServiceFollows` | Tidak ada layanan terhubung yang melacak anime ini. | Tidak ada layanan terhubung yang punya entri untuk anime ini. | Meaning: shown when no connected service has an entry for the anime (no AniList / MyAnimeList ID), not when none “tracks” it; English, French and German fixed the same way. Term sheet: entry = *entri* |

Code fixes that change how this catalog is displayed:

- `formatOffset` (`src/shared/agenda.ts`) now builds `{offset}` from `time.countdown.hours` / `time.countdown.minutes`: “tayang di Jepang +1 jam 30 mnt”.
- Netflix history import: the “Tampilkan lainnya” button of a Netflix profile in this language is recognized (label checked by the reviewer on Netflix’s help article 101917 in this language): such an import no longer stops after the first rows as if the history were complete.
- Lists of names in `{services}` and `{titles}` use the language’s own conjunction (`Intl.ListFormat`) instead of “, ”.

Layout (`npm run test:i18n-layout`): no finding in this language.

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). No plural forms in this language: one `_other` variant with the same text, `{total}` renamed `{count}`.

| Key | Text |
|---|---|
| `sync.beyondEntry_other` | Episode {progress} melebihi {count} episode di entri ini |

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | Tombol “Tampilkan Lainnya” tidak dikenali dalam bahasa profil Netflix-mu: hanya episode terbaru yang dibaca. Atur profil itu di Netflix ke bahasa yang sama dengan SyncKai, lalu baca lagi. |

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video (khusus anime) |
| `settings.prime.label` | Sinkron di Prime Video |
| `settings.prime.helpOff` | Hanya anime yang disinkronkan (genre anime, atau animasi dengan audio Jepang atau judul AniList yang sama persis). Browser akan meminta akses ke primevideo.com |
| `settings.prime.helpOn` | SyncKai hanya membaca data yang sudah diterima halaman Prime Video. Di tab Prime Video yang sudah terbuka, pelacakan dimulai dari episode berikutnya |
| `settings.prime.denied` | Akses ke primevideo.com ditolak: Prime Video tetap nonaktif |
| `settings.prime.disabled` | Prime Video dinonaktifkan: muat ulang tab Prime Video yang terbuka untuk menghentikannya sepenuhnya |
| `settings.prime.error` | Gagal mengubah akses Prime Video, coba lagi |

| Key | Text |
|---|---|
| `onboarding.intro` | Tonton anime di Crunchyroll atau ADN (Netflix, Disney+, dan Prime Video opsional): SyncKai memperbarui daftarmu di akhir setiap episode. |
| `watching.tip` | Netflix, Disney+, Prime Video (opsional), dan platform pilihanmu diatur di {path}. |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | Cocok dengan platform: {signals} |
| `match.signalsContradict` | Tidak cocok dengan platform: {signals} |
| `match.yearRemake` | Remake dibedakan dari tahun rilisnya ({year}) |
| `match.signal.year` | tahun rilis |
| `match.signal.episodes` | jumlah episode |
| `match.signal.duration` | durasi episode |
| `match.signal.format` | format (film atau serial) |
| `match.signal.country` | negara asal |
| `match.signal.originalTitle` | judul asli |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | Pencocokan tersimpan tidak cocok dengan platform: {signals} |
