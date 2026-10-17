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
2. `src/platforms/netflix/tab-op.ts` › `netflixTabOp` › `labels` has no Turkish entry: add `daha fazla göster` (Netflix TR "Daha Fazla Göster"), otherwise the Netflix import stops after the first rows on a Turkish profile.
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

## 2026-10-14 · Netflix import: unrecognized “Show more”

New key `crImport.netflix.moreUnrecognized` (import page, Netflix): shown instead of `crImport.read.partial` when no known “Show more” label was found on a full first page (Netflix profile in a language whose label is unknown); it suggests setting that profile to SyncKai's language. Button named as in this language's `crImport.netflix.rule`. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `crImport.netflix.moreUnrecognized` | “Daha Fazla Göster” düğmesi Netflix profilinin dilinde tanınmadı: Yalnızca en son bölümler okundu. Netflix'te bu profili SyncKai ile aynı dile ayarla, sonra tekrar oku. |

## 2026-10-14 · Prime Video (optional platform)

New keys `settings.prime.*` (Settings › Playback & sync, Prime Video toggle), modelled on the `settings.disney.*` keys of this catalog (helpOff: Prime Video’s anime filter; helpOn: SyncKai only reads what the page already receives); “Prime Video” untranslated. The two texts listing the optional platforms now include Prime Video. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.prime.section` | Prime Video (yalnızca anime) |
| `settings.prime.label` | Prime Video üzerinde eşitle |
| `settings.prime.helpOff` | Yalnızca animeler eşitlenir (anime türü ya da Japonca sesli veya AniList'teki başlıkla birebir aynı animasyon). Tarayıcın primevideo.com için erişim izni isteyecek |
| `settings.prime.helpOn` | SyncKai yalnızca Prime Video sayfasının zaten aldığı verileri okur. Zaten açık bir Prime Video sekmesinde takip sonraki bölümle başlar |
| `settings.prime.denied` | primevideo.com erişimi reddedildi: Prime Video kapalı kalıyor |
| `settings.prime.disabled` | Prime Video kapatıldı: Tamamen durdurmak için açık Prime Video sekmelerini yenile |
| `settings.prime.error` | Prime Video erişimi değiştirilemedi, tekrar dene |

| Key | Text |
|---|---|
| `onboarding.intro` | Animelerini Crunchyroll veya ADN üzerinde izle (Netflix, Disney+ ve Prime Video isteğe bağlı): SyncKai her bölümün sonunda listeni günceller. |
| `watching.tip` | Netflix, Disney+, Prime Video (isteğe bağlı) ve favori platformun şuradan ayarlanır: {path}. |

## 2026-10-14 · Match signals (reason lines)

New keys `match.signalsAgree`, `match.signalsContradict`, `match.yearRemake` and the six `match.signal.*` labels (reasons shown in 'To check' cards, the history import and logs): the AniList entry is confirmed, or contradicted, by data read on the streaming platform (release year, episode count, episode length, format, country of origin, original title). The labels are joined by the language's list format inside `{signals}`, after a colon so that nothing agrees with the list; `{year}` is a four-digit year. Terms from this language's term sheet (entry, platform, episode). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.signalsAgree` | Platformla eşleşiyor: {signals} |
| `match.signalsContradict` | Platformla eşleşmiyor: {signals} |
| `match.yearRemake` | Yeniden yapım, yayın yılından ayırt edildi ({year}) |
| `match.signal.year` | yayın yılı |
| `match.signal.episodes` | bölüm sayısı |
| `match.signal.duration` | bölüm süresi |
| `match.signal.format` | format (film veya dizi) |
| `match.signal.country` | yapım ülkesi |
| `match.signal.originalTitle` | orijinal ad |

## 2026-10-14 · Saved match contradicted by the platform

New key `match.savedContradicted` (reason shown in 'To check' cards, the history import and logs): a match saved earlier for the season (season → AniList entry, possibly a choice of the user) is contradicted by data read on the streaming platform, so nothing is synced until the user confirms or picks the entry. Same structure as `match.signalsContradict` (colon before `{signals}`, no final period); terms from this language's term sheet (match, platform). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `match.savedContradicted` | Kayıtlı eşleşme platformla uyuşmuyor: {signals} |

## 2026-10-14 · Matching diagnostic (development builds only)

New keys `settings.matchDiag.*` (Settings › Help & about, section shown only in development builds, never in the published extension): the last 50 AniList matching decisions, a « Copy » button per row (one decision as JSON, for the test corpus) and a « Clear » button. `{count}` follows a label and a colon (no plural form); `JSON` is a format name. Terms from this language's term sheet (match, entry). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.title` | Eşleşme tanılaması |
| `settings.matchDiag.text` | Yalnızca geliştirme sürümlerinde: AniList eşleştirmesinin son 50 kararı, en yenisi önce, tarayıcı kapanana kadar tutulur. Birini JSON olarak kopyalayıp test derlemine ekleyebilirsin. |
| `settings.matchDiag.empty` | Henüz kaydedilmiş karar yok |
| `settings.matchDiag.copy` | Kopyala |
| `settings.matchDiag.copyTitle` | Bu kararı JSON olarak kopyala |
| `settings.matchDiag.copied` | Kopyalandı |
| `settings.matchDiag.copyFailed` | Karar kopyalanamadı. |
| `settings.matchDiag.clear` | Temizle |
| `settings.matchDiag.candidates` | Adaylar: {count} |
| `settings.matchDiag.noEntry` | Sayfa yok |

## 2026-10-15 · Debug trace (development builds only)

New keys `settings.debugTrace.*` (Settings › Help & about, section shown only in development builds, never in the published extension, below the matching diagnostic): a timeline of what the extension did (pages, service worker, AniList and MyAnimeList requests), a verbose switch, a category filter (category names stay in English: technical identifiers), « Copy trace » (the whole trace as JSON) and the « Clear » button of the matching diagnostic (`settings.matchDiag.clear`, reused). `{count}` and `{max}` follow a label and a colon (no plural form) and arrive formatted for the language; `JSON` is a format name; `service worker` kept as the browser's technical term. New terms added to this language's term sheet (debug trace, event, verbose mode); other terms from it (account). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.debugTrace.title` | Hata ayıklama izi |
| `settings.debugTrace.text` | Yalnızca geliştirme sürümlerinde: SyncKai'nin sayfalarda, service worker'da ve AniList ile MyAnimeList'te yaptıklarının zaman çizelgesi, en yenisi önce, tarayıcı kapanana kadar tutulur. Hiçbir token, çerez veya hesap kimliği kaydedilmez. Bir sorunu bildirirken paylaşmak için izin tamamını JSON olarak kopyala. |
| `settings.debugTrace.empty` | Henüz kaydedilmiş olay yok |
| `settings.debugTrace.copy` | İzi kopyala |
| `settings.debugTrace.copied` | Kopyalandı |
| `settings.debugTrace.copyFailed` | İz kopyalanamadı. |
| `settings.debugTrace.verbose` | Ayrıntılı mod (tüm günlük satırları) |
| `settings.debugTrace.count` | Olaylar: {count} / {max} |
| `settings.debugTrace.allCategories` | Tüm kategoriler |
| `settings.debugTrace.filterAria` | Olayları kategoriye göre filtrele |

## 2026-10-16 · Matching diagnostic: Copy all (development builds only)

New keys in the « Matching diagnostic » section (Settings › Help & about, development builds only, never in the published extension, now collapsed by default behind its title): « Copy all » copies every recorded decision as one JSON array, next to « Clear »; its label becomes « Copied » (`settings.matchDiag.copied`, reused) and a failure reuses `settings.matchDiag.copyFailed`. `JSON` is a format name. Same word for « decision » as `settings.matchDiag.copyTitle`, in the plural; other terms from this language's term sheet. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.matchDiag.copyAll` | Tümünü kopyala |
| `settings.matchDiag.copyAllTitle` | Tüm kararları JSON olarak kopyala |

## 2026-10-16 · Episode guards (« To check » reasons)

New reasons on a « To check » card (`fix/episode-guards`, audit SEC-01): a sync that would jump straight to the last episode from far behind, and episodes reported as finished in a burst, now wait for the user instead of being written. Same « to check » term as `match.otherSeriesExcluded`, same episode wording as `sync.beyondEntry_*`; `{from}` and `{progress}` are episode numbers. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `sync.review.finaleJump` | {from}. bölümden doğrudan son bölüme ({progress}): Doğrulanmalı |
| `sync.review.burst` | Birkaç dakikada çok sayıda bölüm bitirildi: Doğrulanmalı |

## 2026-10-17 · Status bar (popup and side panel)

New texts of the status bar shown at the bottom of the popup and, now, of the side panel (`feature/ui-status-bar`): a synced episode or a count of synced episodes under the series title, shown until the user hides it (« Seen, hide », a × button label), and the history import running, ready to confirm and done. Same words as this language's term sheet: *eşitlendi* (synced), *seri* (series, singular after a number), *Bölüm* (episode, label form), *içe aktarma* (import), *güncellendi* (updated), *onaylanacak* (to confirm, same pattern as *doğrulanacak* / *güncellenecek*) and *gizle* (hide); no suffix on `{platform}` or `{count}` (*{platform} içe aktarması*). ` · ` and ` / ` kept; `{platform}` is a brand name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `footer.dismiss` | Gördüm, gizle |
| `footer.importDone_one` | İçe aktarma bitti · {count} seri güncellendi |
| `footer.importDone_other` | İçe aktarma bitti · {count} seri güncellendi |
| `footer.importProgress` | {platform} içe aktarması · {done} / {total} |
| `footer.importReady_one` | İçe aktarma hazır · {count} seri onaylanacak |
| `footer.importReady_other` | İçe aktarma hazır · {count} seri onaylanacak |
| `footer.syncedEpisode` | Bölüm {episode} eşitlendi |
| `footer.syncedEpisodes_one` | {count} bölüm eşitlendi |
| `footer.syncedEpisodes_other` | {count} bölüm eşitlendi |

## 2026-10-17 · Account menu (status bar)

New texts of the account menu that opens above the AniList / MyAnimeList logo of the status bar (popup and side panel): the logo button's label (also when the session expired), the connection status line, three stat tiles (anime count, episodes watched, days watched, each number shown above its short label), the « Synced this week » row with its tooltip and value, and « View my profile ». Following this language's term sheet, used **hesap**, **bağlı** (as `settings.account.connected`), **oturum sona erdi** (`common.sessionExpired`), **eşitleme / eşitlendi**, **bölüm**; Turkish uses the singular after numbers, so both plural forms are identical; the days tile label is the noun **izleme**; « day » stays the full word **gün**, as `time.countdown.days`. ` · ` kept; `{service}` is a brand name, `{name}` the user's AniList / MyAnimeList user name. Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `accountMenu.connected` | Bağlı |
| `accountMenu.connectedAs` | {name} · bağlı |
| `accountMenu.label` | {service} hesabı |
| `accountMenu.labelExpired` | {service} hesabı, oturum sona erdi |
| `accountMenu.profile` | Profilimi görüntüle |
| `accountMenu.stats.anime_one` | anime |
| `accountMenu.stats.anime_other` | anime |
| `accountMenu.stats.days_one` | izleme |
| `accountMenu.stats.days_other` | izleme |
| `accountMenu.stats.daysValue` | {days} gün |
| `accountMenu.stats.episodes_one` | bölüm |
| `accountMenu.stats.episodes_other` | bölüm |
| `accountMenu.week.label` | Bu hafta eşitlenen |
| `accountMenu.week.title` | SyncKai'nin bu hafta eşitlediği bölümler |
| `accountMenu.week.value_one` | {count} bölüm |
| `accountMenu.week.value_other` | {count} bölüm |

## 2026-10-17 · Settings redesign (Preact): new and changed keys

New texts of the redesigned Settings (Preact): the Platforms and Display categories, the screen-reader names of the back button and of the category card, the row summaries of the Settings home, the Keyboard section of Display, the two sections of Shortcuts, and the section titles and notes of Accounts. Changed: `settings.cat.notifications` (now the single word: the Schedule options moved to Platforms), `settings.summary.connected` (a word instead of ✓), `settings.summary.paused` (now a standalone, capitalised summary), `settings.summary.version` (a word instead of « v »), `settings.entry.help` (the « both accounts connected » condition moved to `settings.entry.unavailable`). Summaries are joined with ` · ` by the code; `settings.account.expiredHelp` and `settings.account.otherStillSynced` are joined as two sentences. The Display summary reuses `settings.section.language`, `settings.section.panel` and `settings.shortcuts.pointer`; the My data summary the history import and backup words; the player summary `settings.player.label`. No case suffix on placeholders: « {page} sayfasına dön », « {service} hesabına ». Platform count « Açık: {count}/{total} » and **Kapalı** for the paused sync (as `settings.autoSync.helpOff`), so the Sync row reads « Otomatik · jenerikte » / « Kapalı ». Player summary « favori: {player} ». Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.cat.notifications` | Bildirimler |
| `settings.cat.platforms` | Platformlar |
| `settings.cat.display` | Görünüm |
| `settings.backToAria` | {page} sayfasına dön |
| `settings.group.categories` | Kategoriler |
| `settings.summary.connected` | {service} bağlı |
| `settings.summary.notConnected` | {service} bağlı değil |
| `settings.summary.bothConnected` | AniList ve MyAnimeList bağlı |
| `settings.summary.auto` | Otomatik |
| `settings.summary.paused` | Kapalı |
| `settings.summary.platforms_one` | Açık: {count}/{total} |
| `settings.summary.platforms_other` | Açık: {count}/{total} |
| `settings.summary.player` | favori: {player} |
| `settings.summary.display` | Dil, yan panel, klavye kısayolları |
| `settings.summary.data` | İzleme geçmişini içe aktar · yedekleme |
| `settings.summary.version` | Sürüm {version} |
| `settings.summary.noErrors` | hata yok |
| `settings.display.keyboard` | Klavye |
| `settings.display.shortcutsHelp` | Bölüm işaretleme ve paneli açma tuşları |
| `settings.shortcuts.duringPlayback` | Oynatma sırasında |
| `settings.shortcuts.navigation` | Gezinme |
| `settings.accounts.lists` | Eşitlenen listeler |
| `settings.accounts.both` | İki hesap bağlıyken |
| `settings.accounts.privacy` | Girişi AniList veya MyAnimeList sitesinde yaparsın: SyncKai şifreni asla görmez. |
| `settings.account.expiredHelp` | Yeniden bağlanana kadar bölümlerin {service} hesabına gönderilmez. |
| `settings.account.otherStillSynced` | {service} güncellenmeye devam ediyor. |
| `settings.entry.help` | Bir animenin başlığına veya kapağına tıklayınca açılır |
| `settings.entry.unavailable` | AniList ve MyAnimeList ikisi de bağlıyken kullanılabilir. |

## 2026-10-17 · Settings › Sync, Matches and Excluded series (Preact)

New texts of the redesigned Sync settings page and of its two sub-pages (Matches, Excluded series), moved out of My data: section titles « Automatic » / « Per series », the descriptions of the two « Episode counted as watched » cards, the « Per series » rows, the Matches intro, search, empty and no-result texts, « Show N more on {platform} », the four origin badges and their legend, the Excluded series section, note, empty hint and the « {year} series · excluded on {date} » fragments. Changed: `settings.trigger.legend` (« Episode counted as watched », where the old text was only « Episode watched »), `settings.trigger.credits` (« (recommended) » moved to `settings.trigger.creditsHelp`), and the paths of `popup.syncDisabledDetail` / `review.excludeTitle` (now nav.settings › settings.section.sync › settings.section.exclusions, built from this catalog's own titles). Removed: `settings.mappings.count_*`, `settings.mappings.help`, `settings.mappings.manage`. `{action}` is the « Re-enable » button (`settings.exclusions.help`) or the « Stop syncing this series » menu item (`settings.exclusions.emptyHelp`), so the quoted labels always match. The match / entry / excluded / re-enable words reuse this catalog's existing terms (`settings.section.mappings`, `settings.mappings.entryFallback`, `settings.section.exclusions`, `settings.exclusions.reactivate`). No case suffix on placeholders: « Kayıtlı seri: {count} », « {platform} üzerinde ». Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.section.automatic` | Otomatik |
| `settings.section.perSeries` | Seri bazında |
| `settings.trigger.credits` | Bitiş jeneriği başlayınca |
| `settings.trigger.creditsHelp` | Önerilen: platformun bildirdiği tam an |
| `settings.trigger.percentageHelp` | Jenerik bilinmediğinde de kullanılır |
| `settings.sync.mappingsRow` | Kayıtlı eşleşmeler |
| `settings.sync.mappingsRowHelp` | Her seri için seçilen AniList sezonu |
| `settings.sync.exclusionsRowHelp` | Hiç eşitlenmez, buradan yeniden dahil edilebilir |
| `settings.mappings.intro_one` | Kayıtlı seri: {count}, platforma göre: platformdaki sezon → SyncKai’ın yazdığı AniList sayfası. Bir eşleşmeyi unutursan bir sonraki bölümde yeniden hesaplanır. |
| `settings.mappings.intro_other` | Kayıtlı seri: {count}, platforma göre: platformdaki sezon → SyncKai’ın yazdığı AniList sayfası. Bir eşleşmeyi unutursan bir sonraki bölümde yeniden hesaplanır. |
| `settings.mappings.search` | Seri veya sayfa ara |
| `settings.mappings.noResult` | “{query}” için eşleşme yok |
| `settings.mappings.noResultHelp` | Seri adına veya AniList sayfasının adına göre ara. |
| `settings.mappings.emptyHelp` | SyncKai eşitlenen her sezon için bir tane kaydeder. |
| `settings.mappings.showMore_one` | {platform} üzerinde {count} tane daha göster |
| `settings.mappings.showMore_other` | {platform} üzerinde {count} tane daha göster |
| `settings.mappings.origin.chosen` | Senin seçtiğin |
| `settings.mappings.origin.learned` | Öğrenilen |
| `settings.mappings.origin.unmarked` | Eski |
| `settings.mappings.origin.unverified` | İçe aktarıldı · yeniden kontrol |
| `settings.mappings.origin.chosenHelp` | Senin onayladığın veya seçtiğin: hiç sorgulanmaz. |
| `settings.mappings.origin.learnedHelp` | SyncKai’ın bulduğu: platform çelişirse yeniden hesaplanır. |
| `settings.mappings.origin.unmarkedHelp` | 2.4’ten önce kaydedilen: korunur, çelişirse kontrole düşer. |
| `settings.mappings.origin.unverifiedHelp` | Bir yedekten gelen: ilk kullanımda yeniden kontrol edilir. |
| `settings.mappings.originLegend` | Eşleşmelerin kaynağı |
| `settings.exclusions.section` | Hiç eşitlenmeyenler |
| `settings.exclusions.help` | Hariç tutulan bir seri, hangi sezon olursa olsun bir daha asla eşitlenmez. “{action}” seriyi bir sonraki bölümden itibaren yeniden takip eder. |
| `settings.exclusions.emptyHelp` | Bir seriyi artık eşitlememek için “⋯” menüsünden “{action}” seçeneğini seç. |
| `settings.exclusions.seriesYear` | {year} serisi |
| `settings.exclusions.excludedOn` | hariç tutulma: {date} |
| `popup.syncDisabledDetail` | Yeniden dahil etmek için: Ayarlar › Eşitleme › Hariç tutulan seriler |
| `review.excludeTitle` | Seriyi hariç tutar (tüm sezonlar). Yeniden dahil etmek için: Ayarlar › Eşitleme › Hariç tutulan seriler |

## 2026-10-17 · Settings › Platforms and Notifications (Preact)

Texts of the redesigned Platforms page (list of sites with « Included » / « Access missing » or a switch, preferred player dropdown, estimated release time per platform with − / + buttons, moved there from the Schedule card) and Notifications page (« On the playback page » style cards and « New episodes »). New: `settings.platforms.where`, `settings.platforms.allAnime`, `settings.platforms.included`, `settings.platforms.accessMissing`, `settings.platforms.note`, `settings.player.openOn`, `settings.player.enableFirst`, `settings.offsets.earlier`, `settings.offsets.later`, `settings.notif.legend`. Changed: `settings.player.help`, `settings.offsets.title`, `settings.offsets.help`, `page.platformOff`, `settings.section.notifications`, `settings.notif.discreet.desc`, `settings.notif.detailed.desc`, `settings.notif.alertsOnly.desc`, `settings.notif.alertsAlways`, `settings.delay.title`, `settings.airing.enableFirst` (the notification descriptions now describe the pill and the bubble, « Extra delay » replaces « Delay », the release-time help says the alerts use it too, « Turn on alerts… » is now visible text). `page.platformOff` keeps its sentence; only the path changed, from « Settings › Playback & sync » to nav.settings › settings.cat.platforms of this catalog. Removed: `settings.section.playback`, `settings.netflix.section`, `settings.netflix.label`, `settings.disney.section`, `settings.disney.label`, `settings.prime.section`, `settings.prime.label`, `settings.airing.label`, `settings.airing.help`, `settings.section.agenda`. The Schedule word, « Open », the release-alert name and the minute unit reuse this catalog's `panel.tab.agenda`, `common.open`, `settings.quick.airing.label` and `settings.offsets.unit`. No case suffix on placeholders; `settings.platforms.where` rephrased « Bölümlerinin takip edildiği yerler » (34 chars). Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.platforms.where` | Bölümlerinin takip edildiği yerler |
| `settings.platforms.allAnime` | Tüm animeler |
| `settings.platforms.included` | Dahil |
| `settings.platforms.accessMissing` | Erişim yok |
| `settings.platforms.note` | Bir platformu açmak, sitesi için erişim izni ister. Yalnızca oynatma ve seri sayfaları okunur. |
| `settings.player.openOn` | Bölümleri şurada aç |
| `settings.player.enableFirst` | Önce aç |
| `settings.player.help` | Anime birden fazla etkin platformdayken “Aç” bunu kullanır. |
| `settings.offsets.title` | Tahmini çıkış saati |
| `settings.offsets.help` | Japonya yayınından sonra. Takvim ve bildirimler bunu kullanır; bir seri, Takvim'deki kendi satırından ayarlanır. |
| `settings.offsets.earlier` | {minutes} dk daha erken |
| `settings.offsets.later` | {minutes} dk daha geç |
| `page.platformOff` | {platform} kapalı: SyncKai burada hiçbir şeyi takip etmiyor. Yeniden açmak için: Ayarlar › Platformlar. |
| `settings.section.notifications` | Oynatma sayfasında |
| `settings.notif.legend` | Sayfa içi bildirim stili |
| `settings.notif.discreet.desc` | Videonun bir köşesinde birkaç saniyelik küçük bir etiket |
| `settings.notif.detailed.desc` | Bölümü ve AniList ile MyAnimeList sonucunu gösteren bir balon |
| `settings.notif.alertsOnly.desc` | Her şey yolundayken hiçbir şey; yalnızca hata ya da doğrulanacak bir bölüm olunca balon |
| `settings.notif.alertsAlways` | Hata ya da doğrulanacak bir seri, stil ne olursa olsun her zaman gösterilir. |
| `settings.delay.title` | Ek gecikme |
| `settings.airing.enableFirst` | Yeni bölümleri denetlemek için bildirimleri aç |

## 2026-10-17 · Settings › My data, AniList ↔ MAL differences, Help & about (Preact)

Texts of the redesigned My data page (one « Import a watch history » card, Backup card, « Compare » row opening the AniList ↔ MyAnimeList differences page, which moved there from the popup's Activity screen) and Help & about page (diagnostic report row, error log that unfolds, About card with What's new / Privacy / Source code links). New: `settings.import.title`, `settings.section.compare`, `settings.compare.title`, `settings.compare.help`, `settings.data.perSeries`, `compare.align`, `compare.bulk.help`, `compare.job.background`, `settings.help.diagnostic`, `settings.help.diagnosticHelp`, `settings.help.journalNote`, `settings.about.whatsNew`, `settings.about.privacy`. Changed: `settings.crImport.help`, `settings.backup.help`, `settings.backup.import`, `settings.help.copy`, `settings.about.source` (import help in two sentences, backup help « in one file », « Import » without ellipsis, « Copy the report » next to the new « Diagnostic report » title, « Source code » with « GitHub » on the right). `help.issue.body` keeps its text; only its last-line path changed, to nav.settings › settings.cat.help › settings.help.copy of this catalog. The compare.* texts are unchanged: their context notes now point to Settings › My data. Removed: `settings.section.import`, `settings.backup.crImportTitle`, `settings.crImport.openAria`, `settings.help.text`, `settings.help.copyTitle`, `settings.help.clearHelp`, `settings.help.reportTitle`. The version line reuses `settings.summary.version`, the « Clear » button `settings.matchDiag.clear`. `compare.align` reuses the catalog's « Aktar » family (« Aktarım tamamlandı »), not a literal « hizala ». Not yet reviewed by a native speaker.

| Key | Text |
|---|---|
| `settings.import.title` | Daha önce izlediklerini tamamla |
| `settings.crImport.help` | Crunchyroll, ADN veya Netflix. Bir şey yazılmadan önce önizlemeyi görürsün. |
| `settings.backup.help` | Ayarlar, eşleşmeler, hariç tutulan seriler ve geçmiş tek bir dosyada. AniList veya MyAnimeList oturum bilgilerin asla dahil edilmez. |
| `settings.backup.import` | İçe aktar |
| `settings.section.compare` | Karşılaştır |
| `settings.compare.title` | AniList ↔ MyAnimeList farkları |
| `settings.compare.help` | İki listeni karşılaştırır ve seçtiğin yönde eşitler |
| `settings.data.perSeries` | Eşleşmeler ve hariç tutulan seriler {path} bölümünden yönetilir. |
| `compare.align` | Aktar |
| `compare.bulk.help` | “{action}”, AniList’i MyAnimeList’e aktarır; önce bir onay değişiklikleri listeler. |
| `compare.job.background` | Bu sayfayı kapatsan da devam eder. |
| `settings.help.diagnostic` | Tanılama raporu |
| `settings.help.diagnosticHelp` | Hata bildirimine yapıştırmak için: sürüm, tarayıcı, ayarlar, son hatalar. Token yok, hesap yok. |
| `settings.help.copy` | Raporu kopyala |
| `settings.help.journalNote` | En fazla son 50, en yeni önce; token’lar zaten gizlendi. |
| `settings.about.whatsNew` | Yenilikler |
| `settings.about.privacy` | Gizlilik |
| `settings.about.source` | Kaynak kodu |
