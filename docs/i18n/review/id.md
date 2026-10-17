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

## 2026-10-14 · Matching diagnostic (development builds only)

New keys `settings.matchDiag.*` (Settings › Help & about, section shown only in development builds, never in the published extension): the last 50 AniList matching decisions, a « Copy » button per row (one decision as JSON, for the test corpus) and a « Clear » button. `{count}` follows a label and a colon (no plural form); `JSON` is a format name. Terms from this language's term sheet (match, entry). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.title` | Diagnostik pencocokan |
| `settings.matchDiag.text` | Hanya di build pengembangan: 50 keputusan pencocokan AniList terakhir, terbaru di atas, disimpan sampai browser ditutup. Salin satu sebagai JSON untuk menambahkannya ke korpus pengujian. |
| `settings.matchDiag.empty` | Belum ada keputusan yang tercatat |
| `settings.matchDiag.copy` | Salin |
| `settings.matchDiag.copyTitle` | Salin keputusan ini sebagai JSON |
| `settings.matchDiag.copied` | Disalin |
| `settings.matchDiag.copyFailed` | Gagal menyalin keputusan. |
| `settings.matchDiag.clear` | Hapus |
| `settings.matchDiag.candidates` | Kandidat: {count} |
| `settings.matchDiag.noEntry` | Tidak ada entri |

## 2026-10-15 · Debug trace (development builds only)

New keys `settings.debugTrace.*` (Settings › Help & about, section shown only in development builds, never in the published extension, below the matching diagnostic): a timeline of what the extension did (pages, service worker, AniList and MyAnimeList requests), a verbose switch, a category filter (category names stay in English: technical identifiers), « Copy trace » (the whole trace as JSON) and the « Clear » button of the matching diagnostic (`settings.matchDiag.clear`, reused). `{count}` and `{max}` follow a label and a colon (no plural form) and arrive formatted for the language; `JSON` is a format name; `service worker` kept as the browser's technical term. New terms added to this language's term sheet (debug trace, event, verbose mode); other terms from it (account). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.debugTrace.title` | Jejak debug |
| `settings.debugTrace.text` | Hanya di build pengembangan: linimasa tindakan SyncKai di halaman, di service worker, dan dengan AniList serta MyAnimeList, terbaru di atas, disimpan sampai browser ditutup. Tidak ada token, cookie, atau ID akun yang dicatat. Salin seluruh jejak sebagai JSON untuk membagikannya saat melaporkan masalah. |
| `settings.debugTrace.empty` | Belum ada peristiwa yang dicatat |
| `settings.debugTrace.copy` | Salin jejak |
| `settings.debugTrace.copied` | Disalin |
| `settings.debugTrace.copyFailed` | Jejak tidak dapat disalin. |
| `settings.debugTrace.verbose` | Mode terperinci (semua baris log) |
| `settings.debugTrace.count` | Peristiwa: {count} / {max} |
| `settings.debugTrace.allCategories` | Semua kategori |
| `settings.debugTrace.filterAria` | Saring peristiwa menurut kategori |

## 2026-10-16 · Matching diagnostic: Copy all (development builds only)

New keys in the « Matching diagnostic » section (Settings › Help & about, development builds only, never in the published extension, now collapsed by default behind its title): « Copy all » copies every recorded decision as one JSON array, next to « Clear »; its label becomes « Copied » (`settings.matchDiag.copied`, reused) and a failure reuses `settings.matchDiag.copyFailed`. `JSON` is a format name. Same word for « decision » as `settings.matchDiag.copyTitle`, in the plural; other terms from this language's term sheet. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.copyAll` | Salin semua |
| `settings.matchDiag.copyAllTitle` | Salin semua keputusan sebagai JSON |

## 2026-10-16 · Episode guards (« To check » reasons)

New reasons on a « To check » card (`fix/episode-guards`, audit SEC-01): a sync that would jump straight to the last episode from far behind, and episodes reported as finished in a burst, now wait for the user instead of being written. Same « to check » term as `match.otherSeriesExcluded`, same episode wording as `sync.beyondEntry_*`; `{from}` and `{progress}` are episode numbers. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `sync.review.finaleJump` | Langsung ke episode terakhir ({progress}) dari episode {from}: perlu dicek |
| `sync.review.burst` | Banyak episode selesai dalam beberapa menit: perlu dicek |

## 2026-10-17 · Status bar (popup and side panel)

New texts of the status bar shown at the bottom of the popup and, now, of the side panel (`feature/ui-status-bar`): a synced episode or a count of synced episodes under the series title, shown until the user hides it (« Seen, hide », a × button label), and the history import running, ready to confirm and done. Same words as this language's term sheet: *tersinkron* (synced), *anime* (series), *Ep.* / *episode* (episode), *Impor* (import, as `crImport.apply.done` « Impor selesai »), *diperbarui* (updated), *perlu dikonfirmasi* (to confirm, parallel to *perlu dicek*) and *sembunyikan* (hide); « Seen, hide » became *Oke, sembunyikan* to stay short. ` · ` and ` / ` kept; `{platform}` is a brand name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `footer.dismiss` | Oke, sembunyikan |
| `footer.importDone_other` | Impor selesai · {count} anime diperbarui |
| `footer.importProgress` | Impor {platform} · {done} / {total} |
| `footer.importReady_other` | Impor siap · {count} anime perlu dikonfirmasi |
| `footer.syncedEpisode` | Ep. {episode} tersinkron |
| `footer.syncedEpisodes_other` | {count} episode tersinkron |

## 2026-10-17 · Account menu (status bar)

New texts of the account menu that opens above the AniList / MyAnimeList logo of the status bar (popup and side panel): the logo button's label (also when the session expired), the connection status line, three stat tiles (anime count, episodes watched, days watched, each number shown above its short label), the « Synced this week » row with its tooltip and value, and « View my profile ». Following this language's term sheet, used **akun**, **terhubung**, **sesi berakhir** (`common.sessionExpired`), **tersinkron**, **episode**; no plural forms; « day » stays the full word **hari**, as `time.countdown.days`. ` · ` kept; `{service}` is a brand name, `{name}` the user's AniList / MyAnimeList user name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `accountMenu.connected` | Terhubung |
| `accountMenu.connectedAs` | {name} · terhubung |
| `accountMenu.label` | Akun {service} |
| `accountMenu.labelExpired` | Akun {service}, sesi berakhir |
| `accountMenu.profile` | Lihat profil saya |
| `accountMenu.stats.anime_other` | anime |
| `accountMenu.stats.days_other` | ditonton |
| `accountMenu.stats.daysValue` | {days} hari |
| `accountMenu.stats.episodes_other` | episode |
| `accountMenu.week.label` | Tersinkron minggu ini |
| `accountMenu.week.title` | Episode yang disinkronkan SyncKai minggu ini |
| `accountMenu.week.value_other` | {count} episode |

## 2026-10-17 · Settings redesign (Preact): new and changed keys

New texts of the redesigned Settings (Preact): the Platforms and Display categories, the screen-reader names of the back button and of the category card, the row summaries of the Settings home, the Keyboard section of Display, the two sections of Shortcuts, and the section titles and notes of Accounts. Changed: `settings.cat.notifications` (now the single word: the Schedule options moved to Platforms), `settings.summary.connected` (a word instead of ✓), `settings.summary.paused` (now a standalone, capitalised summary), `settings.summary.version` (a word instead of « v »), `settings.entry.help` (the « both accounts connected » condition moved to `settings.entry.unavailable`). Summaries are joined with ` · ` by the code; `settings.account.expiredHelp` and `settings.account.otherStillSynced` are joined as two sentences. The Display summary reuses `settings.section.language`, `settings.section.panel` and `settings.shortcuts.pointer`; the My data summary the history import and backup words; the player summary `settings.player.label`. **disinkronkan** and **error** as in the rest of the catalog; player summary « pilihan: {player} » (*Platform pilihan*). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.cat.notifications` | Notifikasi |
| `settings.cat.platforms` | Platform |
| `settings.cat.display` | Tampilan |
| `settings.backToAria` | Kembali ke {page} |
| `settings.group.categories` | Kategori |
| `settings.summary.connected` | {service} terhubung |
| `settings.summary.notConnected` | {service} belum terhubung |
| `settings.summary.bothConnected` | AniList dan MyAnimeList terhubung |
| `settings.summary.auto` | Otomatis |
| `settings.summary.paused` | Dijeda |
| `settings.summary.platforms_other` | {count} dari {total} aktif |
| `settings.summary.player` | pilihan: {player} |
| `settings.summary.display` | Bahasa, panel samping, pintasan keyboard |
| `settings.summary.data` | Impor riwayat tontonan · cadangan |
| `settings.summary.version` | Versi {version} |
| `settings.summary.noErrors` | tidak ada error |
| `settings.display.keyboard` | Keyboard |
| `settings.display.shortcutsHelp` | Tombol untuk menandai episode atau membuka panel |
| `settings.shortcuts.duringPlayback` | Saat pemutaran |
| `settings.shortcuts.navigation` | Navigasi |
| `settings.accounts.lists` | Daftar yang disinkronkan |
| `settings.accounts.both` | Dengan kedua akun |
| `settings.accounts.privacy` | Kamu login di situs AniList atau MyAnimeList: SyncKai tidak pernah melihat kata sandimu. |
| `settings.account.expiredHelp` | Episodemu tidak dikirim lagi ke {service} sampai kamu menghubungkannya lagi. |
| `settings.account.otherStillSynced` | {service} tetap diperbarui. |
| `settings.entry.help` | Dibuka saat judul atau sampul anime diklik |
| `settings.entry.unavailable` | Tersedia jika AniList dan MyAnimeList sama-sama terhubung. |

## 2026-10-17 · Settings › Sync, Matches and Excluded series (Preact)

New texts of the redesigned Sync settings page and of its two sub-pages (Matches, Excluded series), moved out of My data: section titles « Automatic » / « Per series », the descriptions of the two « Episode counted as watched » cards, the « Per series » rows, the Matches intro, search, empty and no-result texts, « Show N more on {platform} », the four origin badges and their legend, the Excluded series section, note, empty hint and the « {year} series · excluded on {date} » fragments. Changed: `settings.trigger.legend` (« Episode counted as watched », where the old text was only « Episode watched »), `settings.trigger.credits` (« (recommended) » moved to `settings.trigger.creditsHelp`), and the paths of `popup.syncDisabledDetail` / `review.excludeTitle` (now nav.settings › settings.section.sync › settings.section.exclusions, built from this catalog's own titles). Removed: `settings.mappings.count_*`, `settings.mappings.help`, `settings.mappings.manage`. `{action}` is the « Re-enable » button (`settings.exclusions.help`) or the « Stop syncing this series » menu item (`settings.exclusions.emptyHelp`), so the quoted labels always match. The match / entry / excluded / re-enable words reuse this catalog's existing terms (`settings.section.mappings`, `settings.mappings.entryFallback`, `settings.section.exclusions`, `settings.exclusions.reactivate`). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.section.automatic` | Otomatis |
| `settings.section.perSeries` | Per anime |
| `settings.trigger.credits` | Saat kredit penutup mulai |
| `settings.trigger.creditsHelp` | Disarankan: momen tepat yang diberikan platform |
| `settings.trigger.percentageHelp` | Juga dipakai jika kredit penutup tidak diketahui |
| `settings.sync.mappingsRow` | Pencocokan yang diingat |
| `settings.sync.mappingsRowHelp` | Season AniList yang dipilih untuk tiap anime |
| `settings.sync.exclusionsRowHelp` | Tidak pernah disinkronkan, bisa diaktifkan lagi di sini |
| `settings.mappings.intro_other` | {count} anime diingat, per platform: season di platform → entri AniList tempat SyncKai menulis. Pencocokan yang dilupakan akan ditentukan ulang di episode berikutnya. |
| `settings.mappings.search` | Cari anime atau entri |
| `settings.mappings.noResult` | Tidak ada pencocokan untuk “{query}” |
| `settings.mappings.noResultHelp` | Cari berdasarkan judul anime atau entri AniList. |
| `settings.mappings.emptyHelp` | SyncKai mengingat satu untuk tiap season yang disinkronkan. |
| `settings.mappings.showMore_other` | Lihat {count} lagi di {platform} |
| `settings.mappings.origin.chosen` | Dipilih olehmu |
| `settings.mappings.origin.learned` | Dipelajari |
| `settings.mappings.origin.unmarked` | Lama |
| `settings.mappings.origin.unverified` | Diimpor · perlu dicek ulang |
| `settings.mappings.origin.chosenHelp` | Dikonfirmasi atau dipilih olehmu: tidak pernah dipertanyakan. |
| `settings.mappings.origin.learnedHelp` | Ditemukan SyncKai: ditentukan ulang jika platform bertentangan. |
| `settings.mappings.origin.unmarkedHelp` | Disimpan sebelum 2.4: dipertahankan, perlu dicek jika ada pertentangan. |
| `settings.mappings.origin.unverifiedHelp` | Dari cadangan: dicek ulang saat pertama kali dipakai. |
| `settings.mappings.originLegend` | Asal pencocokan |
| `settings.exclusions.section` | Tidak pernah disinkronkan |
| `settings.exclusions.help` | Anime yang dikecualikan tidak akan pernah disinkronkan lagi, di season mana pun. “{action}” membuatnya dilacak lagi mulai episode berikutnya. |
| `settings.exclusions.emptyHelp` | Untuk berhenti menyinkronkan anime, pilih “{action}” di menu “⋯”-nya. |
| `settings.exclusions.seriesYear` | anime tahun {year} |
| `settings.exclusions.excludedOn` | dikecualikan {date} |
| `popup.syncDisabledDetail` | Bisa diaktifkan lagi di Setelan › Sinkron › Anime yang dikecualikan |
| `review.excludeTitle` | Mengecualikan anime ini (semua season): bisa diaktifkan lagi di Setelan › Sinkron › Anime yang dikecualikan |

## 2026-10-17 · Settings › Platforms and Notifications (Preact)

Texts of the redesigned Platforms page (list of sites with « Included » / « Access missing » or a switch, preferred player dropdown, estimated release time per platform with − / + buttons, moved there from the Schedule card) and Notifications page (« On the playback page » style cards and « New episodes »). New: `settings.platforms.where`, `settings.platforms.allAnime`, `settings.platforms.included`, `settings.platforms.accessMissing`, `settings.platforms.note`, `settings.player.openOn`, `settings.player.enableFirst`, `settings.offsets.earlier`, `settings.offsets.later`, `settings.notif.legend`. Changed: `settings.player.help`, `settings.offsets.title`, `settings.offsets.help`, `page.platformOff`, `settings.section.notifications`, `settings.notif.discreet.desc`, `settings.notif.detailed.desc`, `settings.notif.alertsOnly.desc`, `settings.notif.alertsAlways`, `settings.delay.title`, `settings.airing.enableFirst` (the notification descriptions now describe the pill and the bubble, « Extra delay » replaces « Delay », the release-time help says the alerts use it too, « Turn on alerts… » is now visible text). `page.platformOff` keeps its sentence; only the path changed, from « Settings › Playback & sync » to nav.settings › settings.cat.platforms of this catalog. Removed: `settings.section.playback`, `settings.netflix.section`, `settings.netflix.label`, `settings.disney.section`, `settings.disney.label`, `settings.prime.section`, `settings.prime.label`, `settings.airing.label`, `settings.airing.help`, `settings.section.agenda`. The Schedule word, « Open », the release-alert name and the minute unit reuse this catalog's `panel.tab.agenda`, `common.open`, `settings.quick.airing.label` and `settings.offsets.unit`. Series = « anime » (« halaman anime », « anime yang perlu dicek »), as elsewhere in this catalog. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.platforms.where` | Tempat SyncKai melacak episodemu |
| `settings.platforms.allAnime` | Semua anime |
| `settings.platforms.included` | Bawaan |
| `settings.platforms.accessMissing` | Tanpa akses |
| `settings.platforms.note` | Mengaktifkan platform akan meminta akses ke situsnya. Hanya halaman pemutaran dan halaman anime yang dibaca. |
| `settings.player.openOn` | Buka episode di |
| `settings.player.enableFirst` | Aktifkan dulu |
| `settings.player.help` | Dipakai tombol “Buka” jika anime tersedia di beberapa platform aktif. |
| `settings.offsets.title` | Perkiraan waktu rilis |
| `settings.offsets.help` | Setelah tayang di Jepang. Dipakai oleh Jadwal dan pengingat; tiap anime bisa disesuaikan dari barisnya di Jadwal. |
| `settings.offsets.earlier` | {minutes} mnt lebih awal |
| `settings.offsets.later` | {minutes} mnt lebih lambat |
| `page.platformOff` | {platform} dinonaktifkan: SyncKai tidak melacak apa pun di sini. Untuk mengaktifkannya lagi: Setelan › Platform. |
| `settings.section.notifications` | Di halaman pemutaran |
| `settings.notif.legend` | Gaya notifikasi di halaman |
| `settings.notif.discreet.desc` | Label kecil selama beberapa detik di pojok video |
| `settings.notif.detailed.desc` | Gelembung berisi episode dan hasilnya di AniList dan MyAnimeList |
| `settings.notif.alertsOnly.desc` | Tidak ada apa-apa jika semua lancar; gelembung hanya saat ada error atau episode yang perlu dicek |
| `settings.notif.alertsAlways` | Error atau anime yang perlu dicek selalu muncul, apa pun gayanya. |
| `settings.delay.title` | Penundaan ekstra |
| `settings.airing.enableFirst` | Aktifkan pengingat untuk mengecek rilis |

## 2026-10-17 · Settings › My data, AniList ↔ MAL differences, Help & about (Preact)

Texts of the redesigned My data page (one « Import a watch history » card, Backup card, « Compare » row opening the AniList ↔ MyAnimeList differences page, which moved there from the popup's Activity screen) and Help & about page (diagnostic report row, error log that unfolds, About card with What's new / Privacy / Source code links). New: `settings.import.title`, `settings.section.compare`, `settings.compare.title`, `settings.compare.help`, `settings.data.perSeries`, `compare.align`, `compare.bulk.help`, `compare.job.background`, `settings.help.diagnostic`, `settings.help.diagnosticHelp`, `settings.help.journalNote`, `settings.about.whatsNew`, `settings.about.privacy`. Changed: `settings.crImport.help`, `settings.backup.help`, `settings.backup.import`, `settings.help.copy`, `settings.about.source` (import help in two sentences, backup help « in one file », « Import » without ellipsis, « Copy the report » next to the new « Diagnostic report » title, « Source code » with « GitHub » on the right). `help.issue.body` keeps its text; only its last-line path changed, to nav.settings › settings.cat.help › settings.help.copy of this catalog. The compare.* texts are unchanged: their context notes now point to Settings › My data. Removed: `settings.section.import`, `settings.backup.crImportTitle`, `settings.crImport.openAria`, `settings.help.text`, `settings.help.copyTitle`, `settings.help.clearHelp`, `settings.help.reportTitle`. The version line reuses `settings.summary.version`, the « Clear » button `settings.matchDiag.clear`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.import.title` | Kejar tontonan yang sudah kamu tonton |
| `settings.crImport.help` | Crunchyroll, ADN, atau Netflix. Kamu melihat pratinjau sebelum ada yang ditulis. |
| `settings.backup.help` | Setelan, pencocokan, anime yang dikecualikan, dan riwayat dalam satu file. Data login AniList atau MyAnimeList kamu tidak pernah disertakan. |
| `settings.backup.import` | Impor |
| `settings.section.compare` | Bandingkan |
| `settings.compare.title` | Perbedaan AniList ↔ MyAnimeList |
| `settings.compare.help` | Bandingkan kedua daftarmu dan samakan ke arah yang kamu pilih |
| `settings.data.perSeries` | Pencocokan dan anime yang dikecualikan diatur di {path}. |
| `compare.align` | Samakan |
| `compare.bulk.help` | “{action}” menyalin AniList ke MyAnimeList; konfirmasi akan menampilkan perubahannya dulu. |
| `compare.job.background` | Tetap berjalan meski halaman ini kamu tutup. |
| `settings.help.diagnostic` | Laporan diagnostik |
| `settings.help.diagnosticHelp` | Untuk ditempel di laporan bug: versi, browser, setelan, error terbaru. Tanpa token dan akun. |
| `settings.help.copy` | Salin laporan |
| `settings.help.journalNote` | Paling banyak 50 terakhir, terbaru dulu; token sudah disamarkan. |
| `settings.about.whatsNew` | Yang baru |
| `settings.about.privacy` | Privasi |
| `settings.about.source` | Kode sumber |

## 2026-10-17 · Popup « My series » row menu (Preact)

The row « … » menu of the popup's « My series » list and of the « Continue » card now groups the entry links and the platform searches in two sub-menus. New: `watching.menu.openEntry` (sub-menu entry, its items are the bare AniList / MyAnimeList names; wording taken from `page.openOn` without « on {service} »), `watching.menu.searchOn` (sub-menu entry, its items are the bare platform names; wording taken from `watching.searchOn`, ending with « … »). Changed: `settings.entry.help`, which now also says that « Default entry page » picks the list shown in « My series » (quoted with the exact `watching.mySeries` of this catalog). The « −1 episode » item left the menu (the row has its own −), `watching.minusOne` stays for the « On this page » card. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `watching.menu.openEntry` | Buka entri |
| `watching.menu.searchOn` | Cari di… |
| `settings.entry.help` | Dibuka saat judul atau sampul anime diklik; juga menentukan daftar “Anime saya” |



## 2026-10-17 · Popup « On this page » card (Preact)

The popup's « On this page » card was redesigned: the Hold / Drop / Done row and the AniList / MAL links moved to the card's « … » menu (shared with « My series »), and the season dropdown, the star rating and the comment moved to a foldable « Details » section. New: `page.currentStatus` (grey mention at the end of the menu item of the series' current status), `page.details` (foldable button listing what the section holds, same nouns as `page.seasonPicker`, the rating words of `rating.*` and `notes.title`), `page.seasonOnAniList` (title above the season dropdown), `page.seasonHelp` (help under it on an episode page; the match word is the one of `settings.section.mappings`), `page.yourRating` (title above the stars). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `page.currentStatus` | Status saat ini |
| `page.details` | Detail: season, nilai, catatan |
| `page.seasonOnAniList` | Season di AniList |
| `page.seasonHelp` | Mengganti season memperbaiki pencocokan untuk episode berikutnya. |
| `page.yourRating` | Nilaimu |


## 2026-10-17 · Popup « Activity » tab (Preact)

The popup's Activity tab was redesigned: failed and pending syncs are now two sections, and every section heading is an uppercase label followed by « · {count} » added by the code. New: `queue.failedHeading` (same failure word as `queue.failed`), `queue.pendingHeading` (syncs waiting for a retry, wording of the former `queue.sectionTitle`), `ratings.heading` (the former `ratings.sectionTitle` without its count). The « To check » heading now reuses `inline.toCheck`. Removed: `queue.section`, `queue.sectionTitle`, `ratings.section`, `ratings.sectionTitle`, `review.title`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `queue.failedHeading` | Gagal |
| `queue.pendingHeading` | Tertunda |
| `ratings.heading` | Perlu dinilai |


## 2026-10-17 · Side panel « Now playing » (Preact)

The side panel's « Now playing » tab was redesigned as cards: « You're watching » (live playback: bar, credits marker, countdown, sync state with an icon), « Your list » (status chip, « Progress » and the stepper, one line per account, the series « … » menu shared with the popup: Hold / Drop / Done moved there), then foldable sections « Rating and comment », Synopsis, related entries and Discussions. New: `panel.nowPlaying.watching` (heading of the live card, addresses the user), `panel.nowPlaying.list` (heading of the list card, same « your list » words as `page.notInList`), `panel.nowPlaying.ratingNotes` (section title, same nouns as `page.yourRating` and `notes.title`), `panel.live.creditsAt` and `panel.live.creditsUnknown` (legend of the yellow marker under the bar, credits word of `settings.trigger.credits`), `panel.live.countdownCredits` and `panel.live.countdownRatio` (countdown line, wording of the former `panel.live.countdown` plus what the sync waits for, as in `settings.trigger.credits` / `settings.summary.percentage`). Changed: `panel.live.synced` lost its trailing « ✓ » (a check icon now precedes it). The « Progress » label reuses `compare.filter.progress`. Removed: `page.action.COMPLETED`, `page.action.DROPPED`, `page.action.PAUSED` (the status button row is gone), `panel.live.countdown`, `panel.nowPlaying.progress`, `watching.nextWatched`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `panel.nowPlaying.watching` | Kamu menonton |
| `panel.nowPlaying.list` | Daftarmu |
| `panel.nowPlaying.ratingNotes` | Nilai dan catatan |
| `panel.live.creditsAt` | Kredit penutup di {time} |
| `panel.live.creditsUnknown` | Kredit penutup tak diketahui · sinkron di {percent}% |
| `panel.live.countdownCredits` | Sinkron dalam {time} · saat kredit penutup mulai |
| `panel.live.countdownRatio` | Sinkron dalam {time} · pada {percent}% episode |
| `panel.live.synced` | Tersinkron |


## 2026-10-17 · Side panel Schedule (Preact) and week picker

The Schedule tab of the side panel was redesigned: days in order with « No episode » on empty days, episode lines « 18:00 Crunchyroll · Japan 17:00 » (the platform time first, the Japanese broadcast last and cut first), a « ⋯ » menu with « Adjust time » (its second line gives the time and whether the delay is the series' own or the default), « Open the entry › » and « Search on… › », and a week button that opens a month calendar. New: `agenda.adjust.custom` and `agenda.adjust.default` (second line of « Adjust time », lower case after « · »), `agenda.adjust.platform` (first sentence of `agenda.estimate.title`, shown in the delay editor), `agenda.picker.label`, `agenda.picker.prevMonth`, `agenda.picker.nextMonth`, `agenda.picker.thisWeek`, `agenda.picker.hint` (month calendar; the hint names the arrow keys and the Enter key). Changed: `agenda.jp` writes the country name instead of « JP » (unchanged where it already did: ja, ko, zh-CN, zh-TW). Removed: `watching.searchOn` (the search entries are now the platform names of the « Search on… › » sub-menu). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `agenda.jp` | Jepang {time} |
| `agenda.adjust.custom` | diatur untuk anime ini |
| `agenda.adjust.default` | selisih waktu bawaan |
| `agenda.adjust.platform` | Perkiraan rilis di {platform}: tayang di Jepang {offset}. |
| `agenda.picker.label` | Pilih minggu |
| `agenda.picker.prevMonth` | Bulan sebelumnya |
| `agenda.picker.nextMonth` | Bulan berikutnya |
| `agenda.picker.thisWeek` | Minggu ini |
| `agenda.picker.hint` | ↑ ↓ untuk ganti minggu, Enter untuk menampilkannya. |
