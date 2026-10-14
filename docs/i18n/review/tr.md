# Review log — Turkish, `tr`

Independent review of `src/i18n/locales/tr.json` (934 keys, `_one` / `_other`) and `public/_locales/tr/messages.json`, against `en.json`, the reviewed `fr.json` / `de.json`, the context notes (`docs/i18n/context.json`), the shared glossary and the term sheet (`docs/i18n/glossary/tr.md`).

## Method

1. Terminology audit of the term sheet, then a catalog-wide search of every core term (series, season, episode, list, entry, sync, to check, to rate, score, comment, match, excluded, pending sync, credits, popup, side panel, Now playing, Schedule, On this page, preferred player, history import, backup, preview, rewatch, account / connect / session expired, release alerts, Settings and its categories, the six list statuses, Activity, Watching) for stray variants. Found: "eklenti" (4 keys) next to the "Uzantı" quoted from Firefox for the same concept; bare "sayfa" where it can be read as the streaming web page.
2. Key-by-key reading of all 934 keys with their context notes, then a second read of the Turkish alone for naturalness.
3. Composed texts checked once assembled: `{service}: {message}` fragments, `Son denetim: {relative} · …`, `{reason}. … SyncKai simgesine tıkla.`, `Tamamlandı: {relative}`, `Son analiz: {relative}`, `Sonraki deneme: {when}`, `{title}: tamamlandı · Etkinlik sekmesinden puanla.`, `{time} sonra eşitleme` with each `panel.live.*` value, the settings home summaries, settings paths `Ayarlar › …`.
4. Suffix audit: every apostrophe form (AniList'te / 'ten / 'e / 'i / 'in, MyAnimeList'…, MAL'da, Netflix'te / 'e, GitHub'da, Japonya'da, Ayarlar'dan) is correct for the usual pronunciation; no case suffix is attached to a placeholder except `{service}'e` / `{service}'i` (4 keys), where the code only passes "AniList" or "MyAnimeList" (`TRACKER_LABELS`), which take the same suffixes. Ordinal dots ("{episode}. bölüm") only follow numbers.
5. Register: "sen" everywhere (no "siz" form found); "Lütfen yeniden giriş yap" is the only "lütfen".
6. Mechanical checks (script): `...`, straight or foreign quotes, double spaces, space before punctuation, final punctuation parity with English, plural pairs, TDK colon rule (capital after a colon only for a full sentence): two violations, fixed.
7. Length audit: every key whose note gives a limit measured (placeholders as 2 characters); layout checked in code for `common.excluded` (`shrink-0` chip) and `watching.resume` (label column next to the platform pill).
8. External names verified at the source:
   - Netflix Turkish Help Center, help.netflix.com/tr/node/101917, steps 3 and 4: « İzleme etkinliği öğesini açın », « Daha Fazla Göster düğmesini kullanın »: `crImport.netflix.rule`, `crImport.netflix.keepTab` and `crImport.read.error.netflixLoggedOut` are correct.
   - Firefox tr, `addon-manage-extensions-shortcuts` = « Uzantı kısayollarını yönet », `addon-category-extension` = « Uzantılar » (mozilla-l10n `firefox-l10n/tr/toolkit/toolkit/about/aboutAddons.ftl`): `settings.shortcut.manualFirefox` is correct, and "uzantı" is the browser term for an extension.
9. `npm run i18n:check -- tr`: 0 errors; 23 informative length warnings (20 before), each compared with the limit of its context note.

## Changes

| Key | Before | After | Category | Reason |
|---|---|---|---|---|
| `compare.keepTitle` | {source} değerlerini {target} üzerine yazar | {source} değerlerini {target} listene yazar | meaning | "X üzerine yazmak" also means "to write about X" |
| `compare.keepAria` | {title}: {source} kalsın ({target} üzerine yazar) | {title}: {source} kalsın ({target} listene yazılır) | meaning | Same ambiguity |
| `review.episodeOnEntry` | Sayfadaki bölüm | AniList'teki bölüm | meaning | "Sayfadaki" reads as the streaming page's number, the opposite of what the field holds (the episode on the AniList entry) |
| `panel.nowPlaying.relation.SEQUEL` | Devam | Devamı | meaning | "DEVAM" alone reads as the button "Continue"; "Devamı" = its sequel |
| `watching.resume` | Devam et | İzlemeye devam | meaning | Heading of the Continue card, not a button (context note); "Devam et" reads as a command; usual streaming wording "İzlemeye devam (et)" |
| `compare.skip.missingSource` | {service} listende yok: Kopyalanacak bir şey yok (kayıtlar asla silinmez). | {service} listende yok: Kopyalanacak bir şey yok (listeden hiçbir şey silinmez). | terminology | "kayıt" is excluded by the term sheet; now says plainly that nothing leaves the list |
| `panel.nowPlaying.notFoundHint` | Sayfayı seçmek için bölümü bitir: SyncKai sana açılır pencerede soracak (“Doğrulanacak”). | Doğru AniList sayfasını seçmek için bölümü bitir: SyncKai sana açılır pencerede soracak (“Doğrulanacak”). | terminology | Bare "sayfa" next to a streaming page reads as the web page |
| `feedback.review.message` | {reason}. Doğru sayfayı seçmek için SyncKai simgesine tıkla. | {reason}. Doğru AniList sayfasını seçmek için SyncKai simgesine tıkla. | terminology | Toast shown on the streaming page itself |
| `panel.live.reviewHint` | Doğru sayfayı seçmek için SyncKai simgesine tıkla. | Doğru AniList sayfasını seçmek için SyncKai simgesine tıkla. | terminology | Same, side panel next to the page |
| `sync.beyondEntry` | Bölüm {progress}, sayfadaki {total} bölümü aşıyor | Bölüm {progress}, anime sayfasındaki {total} bölümü aşıyor | terminology | In-page toast: "sayfadaki" read as "on this page" |
| `popup.swTimeout` | Eklenti yanıt vermiyor. Birazdan tekrar dene. | Uzantı yanıt vermiyor. Birazdan tekrar dene. | terminology | Browser term (Chrome / Firefox / Edge TR "Uzantılar") |
| `popup.swUnreachable` | Eklentiye ulaşılamadı. Tekrar dene. | Uzantıya ulaşılamadı. Tekrar dene. | terminology | Same |
| `settings.notif.discreet.desc` | …; eklenti simgesinde onay işareti görünür. | …; uzantı simgesinde onay işareti görünür. | terminology | Same |
| `settings.shortcuts.help` | … başka bir eklenti tarafından kullanılıyorsa … | … başka bir uzantı tarafından kullanılıyorsa … | terminology | Same; the catalog quotes Firefox's "Uzantı kısayollarını yönet" |
| `compare.impact.addWarning` | Eksik seriler, {source} üzerindeki durum, ilerleme ve puanla {target} listene eklenecek. | Eksik seriler, {source} üzerindeki durum, ilerleme ve puan bilgileriyle {target} listene eklenecek. | grammar | "puanla" (with the score) is spelled like the imperative "puanla" (rate) |
| `panel.live.minutesSeconds` | {min} dk {sec} | {min} dk {sec} sn | grammar | Inserted into "{time} sonra eşitleme": "2 dk 05 sonra" does not parse, "2 dk 05 sn sonra" does (only used there) |
| `review.previousNote` | … (orada bölüm {progress} kaydedildi). | … (oraya bölüm {progress} kaydedildi). | grammar | "kaydetmek" takes the dative for the destination |
| `page.action.COMPLETED` | Bitti | Tamamla | consistency | Its siblings are imperatives ("Beklet", "Bırak"); "Bitti" echoes the airing status "Yayını bitti" shown in the same card |
| `panel.nowPlaying.relations` | Devam ve ilgili yapımlar | Devamı ve ilgili yapımlar | consistency | Aligned with the Sequel label |
| `match.specialSeason` | Özel bölüm / OVA: Sayfayı seç | Özel bölüm / OVA: Sayfa seçilmeli | consistency | Other reasons say "Sezon doğrulanmalı"; avoids two imperatives in a row in "{reason}. Doğru AniList sayfasını seçmek için … tıkla." |
| `settings.autoSync.helpOff` | Kapalı: hiçbir bölüm gönderilmiyor | Kapalı: Hiçbir bölüm gönderilmiyor | typography | Full sentence after a colon: capital (TDK, term-sheet rule) |
| `sync.correctionReason` | Düzeltme: şu an “{title}” ile eşitleniyor | Düzeltme: Şu an “{title}” ile eşitleniyor | typography | Same rule |
| `prompt.rating.later` | Sonra | Daha sonra | style | Usual Turkish postpone button (10 characters, limit ≈ 12) |
| `extDescription` (`messages.json`) | Animelerini (Crunchyroll, ADN) otomatik olarak AniList ve MyAnimeList ile eşitler. | Crunchyroll ve ADN üzerinde izlediğin animeleri AniList ve MyAnimeList ile otomatik olarak eşitler. | style | The parenthesis calques the English and reads oddly; 99 characters (≤ 132) |

Totals: 24 changes (23 in `tr.json`, 1 in `messages.json`): meaning 5, terminology 9, grammar 3, consistency 3, typography 2, style 2.

Term sheet updated: entry ("AniList sayfası" / "anime sayfası" wherever bare "sayfa" could be the web page), compact Completed button "Tamamla", "{target} listene yazar", new rows for extension ("uzantı"), Continue ("İzlemeye devam"), AniList relations, Later ("Daha sonra"); colon rule exception for "{service}: …" fragments; "2 dk 05 sn"; Netflix names confirmed.

## Debatable, left unchanged

- **sync = "eşitleme"**: Mozilla and Microsoft TR use it ("Şimdi eşitle"); Google TR and many fans say "senkronizasyon / senkronize et". Kept: shorter (chips, footer) and used consistently in 65 strings.
- **Preferred player = "Favori platform"**: literally "favorite"; "Tercih edilen platform" exceeds the 20-character limit, "Varsayılan platform" (19) would be closer to the actual behaviour ("default"). Kept per the term sheet.
- **Comment = "yorum"**: usually a public comment, but it matches MAL's "Comments" field; "not" is excluded (school grade = score).
- **Discreet = "Sade"** ("plain"): acceptable as a level name next to "Ayrıntılı" / "Yalnızca uyarılar".
- **New-episode check = "denetle / denetim"** (Microsoft TR, "Şimdi denetle"), while other checks use "kontrol et": "Şimdi kontrol et" exceeds the 14-character limit; the airing group is consistent within itself.
- **`common.stopSync*` "Artık eşitleme"**: negative imperative on the model of "Bir daha gösterme"; a hurried reader may parse "eşitleme" as the noun.
- **`compare.bulk.*` "Tümünde AniList kalsın" / "Filtrede AniList kalsın"**: terse but idiomatic; the confirmation box ("… değerleri kalsın mı?") makes the action explicit.
- **Label form "Bölüm 5"** rather than "5. bölüm" in chips and badges (term sheet): natural in UI labels.
- **`airing.notification.message`**: telegraphic, without a verb ("… genelde birkaç saat sonra"), acceptable in a system notification; 74 characters for ≈ 70.
- **`feedback.review.title` "SyncKai ile doğrula"** ("verify with SyncKai"): "SyncKai'de" is avoided because the suffix depends on an uncertain reading of the name.
- **`settings.loadError`, `settings.status.failedTitle`**: "bu ekranı kapatıp yeniden aç" instead of naming SyncKai (avoids "SyncKai'yi").
- **`watching.confirm.COMPLETED` "Tamamlandı mı?"** next to `DROPPED` "Bırakılsın mı?": different moods, both natural as Yes / No prompts.
- **`engagement.lastEpisode`, `engagement.notCompleted`**: lowercase sentence after the second colon, in the lowercase fragment style of per-service lines.
- **Slight length overruns, natural wording kept**: `common.excluded` 13 / ~12 (chip is `shrink-0`), `compare.job.stopping` 13 / ≤ 12, `crImport.review.done` 21 / ≤ 20, `import.importing` 16 / ≤ 15, `popup.hostAccessAllow` 16 / ~14, `prompt.rewatch.yes` 22 / ≈ 18, `recent.pending` 14 / ≈ 12, `page.addCurrent` / `page.addPlanning` 21 / ~20.
- **`nav.sections` "Sekmeler"** (screen readers only): "sekme" is also the browser tab.

## Issues outside the catalogs (code, not changed)

1. `src/shared/agenda.ts` › `formatOffset` hard-codes English units ("+1 h", "+45 min", "+1 h 30"): the Turkish tooltips `agenda.estimate.title` / `agenda.estimate.custom` show "Japonya yayını +1 h". Turkish units are "sa" and "dk".
2. `src/shared/netflix-import.ts` › `netflixTabOp` › `labels` has no Turkish entry: add `daha fazla göster` (Netflix TR "Daha Fazla Göster"), otherwise the Netflix import stops after the first rows on a Turkish profile.
3. The Netflix viewing-activity row parser splits titles on FR/EN/DE quote styles; the Turkish row format is unverified.
4. `compare.pause.network` / `.server` / `.rate-limit` with an empty fallback service (popup compare section) would render "'e ulaşılamıyor…" in Turkish; the job runner always sets a service for these reasons (only `resume` uses none), so the apostrophe form was kept.

## Final pass (2026-10-14)

Last changes before the release, made with the code fixes of the same pass.

| Key | Before | After | Reason |
|---|---|---|---|
| `panel.nowPlaying.season.WINTER` / `SPRING` / `SUMMER` / `FALL` | Kış / İlkbahar / Yaz / Sonbahar | Kış {year} / İlkbahar {year} / Yaz {year} / Sonbahar {year} | The code no longer appends “ {year}”: the year is a placeholder, placed where the language writes it |
| `sync.noServiceFollows` | Bağlı hiçbir servis bu seriyi takip etmiyor. | Bağlı hiçbir serviste bu serinin sayfası yok. | Meaning: shown when no connected service has an entry for the anime (no AniList / MyAnimeList ID), not when none “tracks” it; English, French and German fixed the same way. Term sheet: entry = *sayfa* |

Code fixes that change how this catalog is displayed:

- `formatOffset` is localized: “Japonya yayını +1 sa 30 dk”.
- Netflix history import: the “Daha Fazla Göster” button is recognized.
- The Netflix row parser accepts every quote style (« » „ “ ” ‚ ‘ ’ " 「 」 『 』 ‹ ›); the Turkish row format itself is still unverified.
- Lists of names in `{services}` and `{titles}` use the language’s own conjunction (`Intl.ListFormat`) instead of “, ”.

Layout (`npm run test:i18n-layout`): `queue.nextAttempt` (Activity › pending syncs) is fixed in the component (the buttons go below the status when it is long). `watching.badge.upcoming` is now truncated with its full text in a tooltip instead of overlapping the progress: only « Bölüm 1123: 4 gün sonra » next to « bölüm 1122 » (One Piece, 4-digit episode, no total) is cut. No shorter natural wording exists (no abbreviation for « bölüm », « gün » kept in full), so this case is allowlisted in `scripts/e2e/i18n-layout.allowlist.json`.

## 2026-10-14 · `sync.beyondEntry` becomes a plural key

The count of the entry's episodes now chooses the plural form (before: « 1 episodes » in English). The singular `_one` names the entry's only episode.

| Key | Text |
|---|---|
| `sync.beyondEntry_one` | Bölüm {progress}, anime sayfasındaki tek bölümü aşıyor |
| `sync.beyondEntry_other` | Bölüm {progress}, anime sayfasındaki {count} bölümü aşıyor |
