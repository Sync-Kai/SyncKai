# Turkish (`tr`) term sheet

Binding for every change to `src/i18n/locales/tr.json` and `public/_locales/tr/messages.json`. Read with `docs/i18n/GLOSSARY.md`.

## 1. Core terms

| English term | Turkish | Reason |
|---|---|---|
| series | seri (pl. seriler) | What Turkish anime fans call a title ("seriyi bitirdim"). "dizi" sounds like live-action TV; "anime" stays the medium/genre word, needed in "probably not an anime". |
| season | sezon | Fan and streaming usage (Netflix/Disney+ TR). Label form "Sezon 2". |
| episode | bölüm | Universal Turkish term. |
| Ep. (before a number) | Bölüm 5 (label form); "5. bölüm" (ordinal) only when a case suffix is needed ("4. bölüme dönüldü") | Turkish has no common abbreviation of "bölüm"; the word is short. Label form also works when the value is "?". Counts: "12 bölüm" (noun stays singular after a number). |
| part (of a split season) | kısım | "bölüm" would read as "episode". |
| list | liste ("listen" = your list) | |
| entry | sayfa ("AniList sayfası", "anime sayfası") | Fans say "MAL sayfası". "kayıt" also means sign-up/recording; "girdi" sounds technical. Add "AniList"/"anime" when it could be read as a web page: always in in-page toasts, side panel hints and the To-check number field ("Doğru AniList sayfasını seç", "anime sayfasındaki 12 bölüm", "AniList'teki bölüm"). |
| Watching | İzleniyor | Six statuses use one impersonal form, as in Turkish tracker apps; short enough for chips. |
| Completed | Tamamlandı | The user finished it. Airing "finished" is "Yayını bitti" (different word). Compact status button "Tamamla" (imperative like "Beklet" / "Bırak"; never "Bitti", which echoes "Yayını bitti"). |
| On hold | Beklemede | Standard Turkish for "On hold"; action "Beklemeye al", compact action "Beklet". Airing hiatus is "Ara verildi". |
| Dropped | Bırakıldı | Fans: "animeyi bıraktım". Action "Seriyi bırak", compact "Bırak" (never "İptal" = Cancel). |
| Plan to watch | İzlenecek | Short, natural "to be watched". |
| Rewatching | Tekrar izleniyor | Parallel to "İzleniyor"; noun "tekrar izleme". |
| Watching tab (`nav.watching`) | İzleniyor | Same word as the status. |
| Activity tab (`nav.activity`) | Etkinlik | Standard Turkish UI word. |
| sync (noun / verb) | eşitleme / eşitlemek ("Eşitleniyor…", "Eşitlendi", "Eşitlenemedi") | Turkish Firefox ("Şimdi eşitle") and Windows use it; "senkronizasyon" (14 letters) does not fit chips and the footer. |
| Auto sync / paused | Otomatik eşitleme / kapalı ("Otomatik eşitleme kapalı", summary "eşitleme kapalı") | It is an on/off setting; "duraklatıldı" is kept for a paused video. Per-series exclusion uses "Eşitleme kapatıldı" / "Eşitleme açıldı". |
| to check (`review.*`) | Doğrulanacak; a check card = "doğrulama"; verb "doğrula" | The user verifies/confirms the right entry. Short enough for chips (12). |
| to rate | Puanlanacak; verb "puanla" | |
| score, rating, stars | puan | "not" also means "school grade", so it is never used. |
| comment (`notes.*`) | yorum | Never "not" (= grade/score in Turkish). |
| match, mapping | eşleşme; verb "eşleştirmek" | |
| AniList ↔ MAL alignment (`compare.*` "Match … to …", "Keep …") | "AniList kalsın" / "MAL kalsın" (keep that side), bulk "Tümünde AniList kalsın"; the running job = "aktarım" (transfer); "writes to {target}" = "{target} listene yazar" | Avoids "eşitle" (= sync) and "eşleş" (= match). Never "{target} üzerine yazar": "X üzerine yazmak" also reads "to write about X". |
| exclude / excluded series / re-enable | hariç tut / hariç tutulan seri / dahil et | Neutral; "dışla" sounds like social exclusion. "Dahil et" is the natural opposite. |
| pending sync, queue | bekleyen eşitleme | |
| credits | jenerik (end credits "bitiş jeneriği") | Turkish TV/anime term. |
| popup | açılır pencere | Turkish Firefox/Windows term. |
| side panel | yan panel | Chrome TR term. |
| Now playing (panel tab) | Oynatılıyor | ≤ 12 characters. |
| Schedule (`panel.tab.agenda`, `agenda.*`) | Takvim | Short and clear; also in "Bildirimler ve takvim". |
| On this page (`page.*`) | Bu sayfada | |
| preferred player | Favori platform | "oynatıcı" would mean a media player app; "Tercih edilen platform" is too long (≤ 20). |
| history import | izleme geçmişini içe aktar(ma) | "İçe aktar" = Import (Chrome/Windows TR). |
| backup | yedekleme (page/section), yedek (the file) | Never "geçmiş": backup history is called "eşitleme geçmişi". |
| preview | önizleme | |
| rewatch | tekrar izleme | |
| account / connect / sign in / disconnect / session expired | hesap / bağla / giriş yap / çıkış yap / oturum sona erdi | |
| release alerts | yayın bildirimleri (summary: "bildirim +3 sa", "bildirim kapalı") | "uyarı" is kept for the on-page "Alerts only" level ("Yalnızca uyarılar"). |
| release, airing | yayın ("yayınlandı", "çıktı", "Yayında") | |
| offset, delay | gecikme (Schedule delay), kaydırma (episode number offset of a match) | |
| shortcut | kısayol ("Klavye kısayolları"); Set = "Ata", Not set = "Atanmadı" | |
| Settings (`nav.settings`) | Ayarlar | |
| track (follow progress) | takip et | |
| tab (browser) | sekme | |
| reload | yenile ("Sayfayı yenile", "Sekmeyi yenile") | Firefox TR uses "Yenile". |
| Retry / Try again | Tekrar dene | |
| Ignore (dismiss a card) | Yoksay | |
| Abandon (pending sync) | Vazgeç | |
| Correct (verb, fix) | Düzelt | |
| diagnostic report / error log | tanılama raporu / hata günlüğü | Windows TR terms. |
| extension (the browser extension itself) | uzantı ("Uzantı yanıt vermiyor", "uzantı simgesi") | Chrome TR ("Uzantılar"), Firefox TR ("Uzantılar", "Uzantı kısayollarını yönet", quoted in `settings.shortcut.manualFirefox`) and Edge TR. "eklenti" (add-on/plug-in) is colloquial and no longer used, so the catalog matches the browser menus it quotes. |
| Continue (card label `watching.resume`) | İzlemeye devam | A heading, not a button ("Devam et" reads as a button); the usual streaming wording is "İzlemeye devam (et)". |
| AniList relations (panel) | Ana hikâye / Ön hikâye / Devamı / Yan hikâye / Spin-off; heading "Devamı ve ilgili yapımlar" | "Devam" alone reads as the button "Continue". |
| Later (postpone a rating) | Daha sonra | Usual Turkish postpone button. |

## 2. Settings and other UI names (reuse exactly)

| English | Turkish |
|---|---|
| Settings | Ayarlar |
| Playback & sync | Oynatma ve eşitleme |
| Notifications & schedule | Bildirimler ve takvim |
| Shortcuts | Kısayollar |
| My data | Verilerim |
| Help & about | Yardım ve hakkında |
| Language | Dil |
| Accounts | Hesaplar |
| Quick settings / Playback & alerts / Data & help | Hızlı ayarlar / Oynatma ve bildirimler / Veriler ve yardım |
| Excluded series | Hariç tutulan seriler |
| Matches | Eşleşmeler |
| Backup | Yedekleme |
| Help (section) | Yardım |
| Copy diagnostic report | Tanılama raporunu kopyala |
| On-page notifications: Discreet / Detailed / Alerts only | Sayfa içi bildirimler: Sade / Ayrıntılı / Yalnızca uyarılar |
| Open (`common.open`) | Aç |
| Adjust time | Saati ayarla |
| Change / Set (shortcuts) | Değiştir / Ata |
| Your rating? | Puanın kaç? |
| To check | Doğrulanacak |
| Netflix "Viewing activity" page | İzleme etkinliği |
| Firefox "Manage Extension Shortcuts" | Uzantı kısayollarını yönet |

## 3. Conventions

- **Register**: "sen". Imperatives in the 2nd person singular ("Tekrar dene", "Bağla", "Seç"), possessives in -(I)n ("listen", "geçmişin", "puanın"). "Hoş geldin!".
- **Capitalisation**: sentence case. Capital dotted "İ" (İzleniyor, İptal, İçe aktar). `lowerFirst` lowercases with Turkish rules (I → ı, İ → i), so fragments shown after "{service}: " start with an ordinary word, never with a product name.
- **Colon**: no space before, one space after. TDK rule: after the colon, a full sentence starts with a capital letter ("Analiz bulunamadı: Yeniden çalıştır.", "Kapalı: Hiçbir bölüm gönderilmiyor", "Düzeltme: Şu an “{title}” ile eşitleniyor"); a fragment or list stays lowercase ("doğrulama, hata, yeniden bağlanma"). Exception: texts built as "{service}: …" (or shown after "AniList · ") keep the lowercase fragment style of the per-service messages.
- **Quotation marks**: “…”.
- **Ellipsis**: the single character "…".
- **Abbreviations**: minutes "dk", hours "sa", seconds "sn" (no period, as in Turkish apps: "5 dk önce", "2 sa", "45 sn"); days use the full word "gün" (three letters). Unlike EN/FR/DE, the seconds unit is kept in "2 dk 05 sn" (the countdown reads "2 dk 05 sn sonra eşitleme"; a bare "2 dk 05 sonra" does not). Percent sign before the number: "%85". "5 MB". "v2.3.1" unchanged.
- **Relative times**: "az önce", "5 dk önce", "2 sa önce", "dün", "3 gün önce"; hosts are written "Son analiz: {relative}", "Son denetim: {relative}", "Tamamlandı: {relative}". Retry delays: "5 dk sonra", "2 sa sonra", "3 gün sonra", "birazdan", shown as "Sonraki deneme: {when}".
- **"{service}: {message}"**: unchanged ("AniList: bölüm 5 kaydedildi"); messages are lowercase fragments.
- **"{title}: completed"**: "{title}: tamamlandı" (also "bırakıldı", "beklemede").
- **Suffixes and placeholders** (vowel harmony): no case suffix is ever attached to `{title}`, `{platform}`, `{platforms}`, `{count}`, `{episode}`, `{source}`, `{target}`, `{label}`… Rephrase with a helper noun or a postposition: "{title} serisini", "{platform} sekmesi", "{platform} sitesini", "{platform} üzerinde/üzerinden", "{service} hesabı", "{service} için", "{target} listesine", "{count} seride", "{date} tarihinde". Exception: when `{service}` can only be AniList or MyAnimeList, the apostrophe forms are identical for both ("{service}'e", "{service}'i"), so they are allowed.
- **Fixed product names**: AniList'te / AniList'e / AniList'in, MyAnimeList'te, Netflix'te, Crunchyroll'da, GitHub'da, Japonya'da. MAL is read as the word "mal": "MAL'da". No suffix on SyncKai, ADN or Disney+ (their reading is unclear): use "SyncKai simgesine", "ADN sitesini", "Disney+ üzerinde". UI names take an apostrophe when a suffix is needed ("Ayarlar'dan"); a settings path stays at the end of the sentence ("Yeniden dahil etmek için: Ayarlar › Hariç tutulan seriler").
- **Plurals**: Turkish uses `_one` and `_other`; the noun stays singular after a number, so both variants are usually identical ("1 bölüm", "3 bölüm"). Row labels without a visible number use the plural in `_other` ("hariç tutulan seriler").
- **Separators**: " › " and " · " kept as in English.

## 4. Netflix

- Page name: "İzleme etkinliği" and button "Daha Fazla Göster" (Netflix's own title case), both confirmed by Netflix's Turkish Help Center on 2026-10-14 (help.netflix.com/tr/node/101917, steps 3 and 4: "İzleme etkinliği öğesini açın", "Daha Fazla Göster düğmesini kullanın"). `crImport.netflix.rule`, `crImport.netflix.keepTab` and `crImport.read.error.netflixLoggedOut` quote them.
- Not yet checked on the live page with a Turkish profile. The importer's button label list (`labels` in `src/platforms/netflix/tab-op.ts` › `netflixTabOp`) has had `daha fazla göster` since the final pass of 2026-10-14.

## Development builds only

Settings › Help & about sections that exist only in development builds (2026-10-15, `settings.debugTrace.*`).

| English | Term |
|---|---|
| debug trace | hata ayıklama izi |
| event (one line of the trace) | olay |
| verbose mode | ayrıntılı mod |
