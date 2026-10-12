# Privacy Policy · Politique de confidentialité · Datenschutzerklärung

**SyncKai** · Effective date / Date d’effet / Gültig ab: **2026-10-12**

English is the reference version; the French and German translations follow.

- [English](#english)
- [Français](#français)
- [Deutsch](#deutsch)

---

## English

### In short

SyncKai has **no server**. Your data stays in your browser and is only sent to AniList and/or MyAnimeList, solely to update your list. No analytics, no ads, no selling or sharing.

### Data read from pages

The content script runs only on **crunchyroll.com** and **animationdigitalnetwork.com** (and on **netflix.com** or **disneyplus.com** if you turn them on, see below). On an episode page, it reads:

- the series title, season and episode number;
- the video playback position and duration (to detect the end of the episode).

It does not read your Crunchyroll/ADN credentials or your browsing history (except, for the ADN history import below, the access token the ADN site keeps in your tab, used there and never saved).

**Netflix** (Settings, optional): only if you turn it on, your browser asks you for access to **netflix.com**; turning it off removes that access. On the Netflix player page, SyncKai reads the same information (series title, season, episode number, credits start) by requesting the current video’s metadata from your tab, using that site’s session, plus the playback position. It does not read your Netflix account or profile, nor your viewing history (except for the Netflix history import below, only when you start it), and nothing is sent to anyone but AniList / MyAnimeList. Only anime linked to Netflix on AniList are synced: to check this, the series title is looked up in AniList’s public catalog (without your account). Other titles are ignored: nothing is written to your lists, and only the Netflix series ID is kept for 24 h in session memory (cleared when the browser closes) to avoid searching again.

**Disney+** (Settings, optional): only if you turn it on, your browser asks you for access to **disneyplus.com**; turning it off removes that access. On the Disney+ player page, SyncKai sends no request: it only reads, in your tab, the responses the Disney+ player itself receives for the current video (series title, season, episode number, original language, runtime, and the time the end credits start), plus the playback position shown by the player. None of this is stored: the credits time is only used in your tab to sync at the start of the credits. It never reads your Disney+ account, profile or viewing history, your sign-in tokens or the video stream addresses. Titles whose original language is not Japanese are ignored right away in your tab: nothing about them leaves the page. For Japanese titles, only anime linked to Disney+ on AniList are synced, with the same check as for Netflix (series title looked up in AniList’s public catalog, without your account); other titles are ignored and only the series title is kept for 24 h in session memory (cleared when the browser closes).

**Import from Crunchyroll** (Settings, optional): only when you start it, SyncKai reads your Crunchyroll watch history in your own Crunchyroll tab, using that site’s session. To do so, it asks Crunchyroll for a temporary token, with the public client ID used by Crunchyroll’s own website (no password, no secret); the token stays in the tab and is never saved. During the analysis, the reduced history (one line per season: series, last episode watched, date) is kept in the extension’s storage, then erased as soon as the preview is ready, or if the analysis is stopped or fails. After that, nothing is kept except the import preview (series, episodes, planned progress); nothing is sent to anyone but AniList / MyAnimeList.

**Import from ADN** (Settings, optional): only when you start it, SyncKai reads your ADN watch history in your own ADN tab, with the same request the ADN website makes (`gw.api.animationdigitalnetwork.com`), using the access token the site keeps in that tab’s storage (no password; the renewal token is never read). The token stays in the tab: it is never saved, logged or sent to the rest of the extension. Only the episodes of the history (series, season, episode number, position, date) are passed to the import page, which reduces them to one line per season; the rest works as for Crunchyroll (reduced history erased once the preview is ready, only the preview kept, nothing sent to anyone but AniList / MyAnimeList).

**Import from Netflix** (Settings, optional; uses the Netflix access above, which the import page asks for if it is not turned on yet): only when you start it, SyncKai reads the viewing history of the profile open in your own Netflix tab, on its Viewing activity page (`netflix.com/viewingactivity`). To load the whole history, it clicks that page’s own “Show more” button until the end, at most once per second; nothing else on the page is clicked (never “Hide from viewing history” or “Report a problem”) and SyncKai sends no request of its own for this. Only the title and the video ID of each line are passed to the import page. To keep anime only, each distinct title is looked up in AniList’s public catalog (several titles per request); titles that are not anime are only counted, never listed, logged or kept. For the anime found (an AniList entry linked to that Netflix series, or with the same title), SyncKai requests the series metadata from your tab, using that site’s session, together with your last playback position on each episode; only episode numbers, runtimes and positions are passed on, never your Netflix account, profile, tokens or the dates you watched. An episode counts as watched only if its last position reached the end marked by Netflix (or the credits); progress is never moved backwards. The rest works as for Crunchyroll (reduced history erased once the preview is ready, only the preview kept, nothing sent to anyone but AniList / MyAnimeList).

### Stored data

Stored **locally** on your device, in the extension storage (`chrome.storage.local`):

- your settings (trigger, notifications, preferred player, language…);
- remembered matches between series and AniList/MAL entries, excluded series;
- the links to the series pages you watched or visited on the streaming sites, to open them from the “Watching” list;
- recent sync history, episodes to review, series to rate, declined rewatches;
- the queue of pending syncs (offline retry);
- the last AniList ↔ MyAnimeList comparison and the history import preview (Crunchyroll, ADN or Netflix);
- caches (“Watching” list, profile, airing schedule);
- the last 50 technical errors (without tokens or account names), to help diagnose problems: they never leave your browser unless you copy the diagnostic report yourself (Settings › Help).

A few short-lived caches are kept in memory, in the extension’s session storage (`chrome.storage.session`): the entry shown for the current page, the side panel data (the episode’s AniList entry, sequels) and the Netflix and Disney+ series recognized as not anime. They are never written to disk: stale entries are removed along the way, the current page entry and the side panel data are cleared as soon as you log out of an account, and the rest when the browser closes.

### AniList and MyAnimeList accounts

- Sign-in uses the official AniList or MyAnimeList authorization window (`chrome.identity`). SyncKai never sees your password.
- Access tokens (OAuth) are stored locally, **encrypted** (AES-GCM, with a non-exportable key specific to the extension that web pages cannot read), and used **only** to call the corresponding service’s API (read your list, update your progress, score or rewatch).
- MyAnimeList uses the OAuth2 flow with **PKCE**, with no client secret embedded in the extension.

### Network connections

SyncKai only contacts these hosts:

| Host | Purpose |
| --- | --- |
| `graphql.anilist.co` | AniList API: entry lookup, list, updates, airing schedule |
| `anilist.co` | AniList OAuth sign-in |
| `myanimelist.net`, `api.myanimelist.net` | MyAnimeList OAuth sign-in and API |
| `static.crunchyroll.com` | End-credits markers for an episode (no cookies) |
| `www.crunchyroll.com` | History import, only when you start it, from your Crunchyroll tab |
| `gw.api.animationdigitalnetwork.com` | History import, only when you start it, from your ADN tab |
| `www.netflix.com` | Current episode metadata (title, season, number), only if Netflix is turned on, from your Netflix tab; history import (Viewing activity page, then the series metadata and playback positions of the anime found), only when you start it, from your Netflix tab |

The popup and the side panel also display images (covers, banners) and avatars provided by AniList and MyAnimeList, loaded from their image servers (`s4.anilist.co`, `cdn.myanimelist.net`, `api-cdn.myanimelist.net`); any other image address is blocked, even from an imported backup file.

### Backup (export / import)

The export file is a JSON file downloaded to your device. It is not sent anywhere and **never** contains your tokens or AniList/MAL connections.

### Deleting your data

- **Log out** of an account in Settings › Accounts to delete its token and profile, along with the AniList ↔ MyAnimeList comparison and the history import data; logging out of the last account also clears history, reviews, the pending queue and the `chrome.storage.local` caches. Any logout also clears the current page entry and the side panel data kept in `chrome.storage.session`.
- Settings › Matches › “Reset all” clears the remembered matches.
- **Uninstalling the extension** deletes all stored data.
- Data saved on AniList or MyAnimeList (your list) is managed directly on those services.

### Contact

Questions or requests: [GitHub Issues](https://github.com/Sync-Kai/SyncKai/issues).

---

## Français

### En bref

SyncKai n’a **aucun serveur**. Tes données restent dans ton navigateur et ne sont envoyées qu’à AniList et/ou MyAnimeList, uniquement pour mettre ta liste à jour. Aucune statistique d’usage, aucune publicité, aucune revente ni aucun partage.

### Données lues sur les pages

Le content script s’exécute uniquement sur **crunchyroll.com** et **animationdigitalnetwork.com** (et sur **netflix.com** ou **disneyplus.com** si tu les actives, voir plus bas). Sur une page d’épisode, il lit :

- le titre de la série, la saison et le numéro d’épisode ;
- la position et la durée de lecture de la vidéo (pour détecter la fin de l’épisode).

Il ne lit ni tes identifiants Crunchyroll/ADN, ni ton historique de navigation (sauf, pour l’import de l’historique ADN ci-dessous, le jeton d’accès que le site ADN garde dans ton onglet, utilisé sur place et jamais enregistré).

**Netflix** (Réglages, facultatif) : seulement si tu l’actives, ton navigateur te demande l’accès à **netflix.com** ; le désactiver retire cet accès. Sur la page de lecture Netflix, SyncKai lit les mêmes informations (titre de la série, saison, numéro d’épisode, début du générique) en interrogeant, depuis ton onglet et avec la session de ce site, les métadonnées de la vidéo en cours, ainsi que la position de lecture. Il ne lit ni ton compte ni ton profil, ni ton historique Netflix (sauf pour l’import de l’historique Netflix ci-dessous, uniquement quand tu le lances), et rien n’est envoyé à quiconque d’autre qu’AniList / MyAnimeList. Seuls les animes liés à Netflix sur AniList sont synchronisés : pour le vérifier, le titre de la série est recherché dans le catalogue public d’AniList (sans ton compte). Les autres titres sont ignorés : rien n’est écrit dans tes listes, et seul l’identifiant Netflix de la série est retenu 24 h en mémoire de session (effacé à la fermeture du navigateur) pour ne pas refaire la recherche.

**Disney+** (Réglages, facultatif) : seulement si tu l’actives, ton navigateur te demande l’accès à **disneyplus.com** ; le désactiver retire cet accès. Sur la page de lecture Disney+, SyncKai n’envoie aucune requête : il lit seulement, dans ton onglet, les réponses que le lecteur Disney+ reçoit lui-même pour la vidéo en cours (titre de la série, saison, numéro d’épisode, langue originale, durée, et le moment où commence le générique de fin), ainsi que la position de lecture affichée par le lecteur. Rien de tout cela n’est enregistré : le moment du générique sert seulement, dans ton onglet, à synchroniser au début du générique. Il ne lit ni ton compte, ni ton profil, ni ton historique Disney+, ni tes jetons de connexion, ni les adresses du flux vidéo. Les titres dont la langue originale n’est pas le japonais sont ignorés aussitôt dans ton onglet : rien à leur sujet ne quitte la page. Pour les titres japonais, seuls les animes liés à Disney+ sur AniList sont synchronisés, avec la même vérification que pour Netflix (titre de la série recherché dans le catalogue public d’AniList, sans ton compte) ; les autres titres sont ignorés et seul le titre de la série est retenu 24 h en mémoire de session (effacé à la fermeture du navigateur).

**Import depuis Crunchyroll** (Réglages, facultatif) : seulement quand tu le lances, SyncKai lit ton historique de visionnage Crunchyroll dans ton propre onglet Crunchyroll, avec la session de ce site. Pour cela, il demande à Crunchyroll un jeton temporaire, avec l’identifiant public qu’utilise le site web de Crunchyroll (aucun mot de passe, aucun secret) ; ce jeton reste dans l’onglet et n’est jamais enregistré. Pendant l’analyse, l’historique réduit (une ligne par saison : série, dernier épisode vu, date) est gardé dans le stockage de l’extension, puis effacé dès que l’aperçu est prêt, ou si l’analyse est arrêtée ou échoue. Ensuite, rien n’est conservé hormis l’aperçu de l’import (séries, épisodes, progression prévue) ; rien n’est envoyé à quiconque d’autre qu’AniList / MyAnimeList.

**Import depuis ADN** (Réglages, facultatif) : seulement quand tu le lances, SyncKai lit ton historique de visionnage ADN dans ton propre onglet ADN, avec la même requête que le site web d’ADN (`gw.api.animationdigitalnetwork.com`), au moyen du jeton d’accès que le site garde dans le stockage de cet onglet (aucun mot de passe ; le jeton de renouvellement n’est jamais lu). Ce jeton reste dans l’onglet : il n’est jamais enregistré, journalisé ni transmis au reste de l’extension. Seuls les épisodes de l’historique (série, saison, numéro d’épisode, position, date) sont passés à la page d’import, qui les réduit à une ligne par saison ; la suite se passe comme pour Crunchyroll (historique réduit effacé dès que l’aperçu est prêt, seul l’aperçu est conservé, rien n’est envoyé à quiconque d’autre qu’AniList / MyAnimeList).

**Import depuis Netflix** (Réglages, facultatif ; utilise l’accès Netflix ci-dessus, que la page d’import demande s’il n’est pas encore activé) : seulement quand tu le lances, SyncKai lit l’historique de visionnage du profil ouvert dans ton propre onglet Netflix, sur sa page Activité de visionnage (`netflix.com/viewingactivity`). Pour charger tout l’historique, il clique sur le bouton « Voir plus » de cette page jusqu’à la fin, au plus une fois par seconde ; rien d’autre n’est cliqué sur la page (jamais « Masquer dans l’historique » ni « Signaler un problème ») et SyncKai n’envoie pour cela aucune requête de son côté. Seuls le titre et l’identifiant de la vidéo de chaque ligne sont passés à la page d’import. Pour ne garder que les animes, chaque titre distinct est recherché dans le catalogue public d’AniList (plusieurs titres par requête) ; les titres qui ne sont pas des animes sont seulement comptés, jamais listés, journalisés ni conservés. Pour les animes trouvés (fiche AniList liée à cette série Netflix, ou au même titre), SyncKai demande depuis ton onglet, avec la session de ce site, les métadonnées de la série avec ta dernière position de lecture sur chaque épisode ; seuls les numéros d’épisode, durées et positions sont transmis, jamais ton compte, ton profil, tes jetons Netflix ni les dates de visionnage. Un épisode n’est compté comme vu que si sa dernière position a atteint la fin indiquée par Netflix (ou le générique) ; une progression ne recule jamais. La suite se passe comme pour Crunchyroll (historique réduit effacé dès que l’aperçu est prêt, seul l’aperçu est conservé, rien n’est envoyé à quiconque d’autre qu’AniList / MyAnimeList).

### Données stockées

Sont enregistrés **localement** sur ton appareil, dans le stockage de l’extension (`chrome.storage.local`) :

- tes réglages (déclenchement, notifications, lecteur préféré, langue…) ;
- les correspondances mémorisées entre séries et fiches AniList/MAL, les séries exclues ;
- les liens vers les pages des séries regardées ou visitées sur les sites de streaming, pour les ouvrir depuis la liste « En cours » ;
- l’historique des dernières synchros, les épisodes à vérifier, les séries à noter, les refus de revisionnage ;
- la file des synchros en attente (nouvel essai hors ligne) ;
- la dernière comparaison AniList ↔ MyAnimeList et l’aperçu de l’import d’historique (Crunchyroll, ADN ou Netflix) ;
- des caches (liste « En cours », profil, calendrier des sorties) ;
- les 50 dernières erreurs techniques (sans jetons ni noms de compte), pour aider à diagnostiquer un problème : elles ne quittent jamais le navigateur, sauf si tu copies toi-même le rapport de diagnostic (Réglages › Aide).

Quelques caches de courte durée sont gardés en mémoire, dans le stockage de session de l’extension (`chrome.storage.session`) : la fiche affichée pour la page en cours, les données du panneau latéral (fiche AniList de l’épisode, suites) et les séries Netflix et Disney+ reconnues comme non-animes. Ils ne sont jamais écrits sur le disque : les entrées périmées sont retirées au fil de l’eau, la fiche de la page et les données du panneau sont effacées dès la déconnexion d’un compte, et le reste à la fermeture du navigateur.

### Comptes AniList et MyAnimeList

- La connexion passe par la fenêtre d’authentification officielle d’AniList ou de MyAnimeList (`chrome.identity`). SyncKai ne voit jamais ton mot de passe.
- Les jetons d’accès (tokens OAuth) sont stockés localement, **chiffrés** (AES-GCM, avec une clé non exportable propre à l’extension, que les pages web ne peuvent pas lire), et servent **uniquement** à appeler l’API du service concerné (lire ta liste, mettre à jour ta progression, ta note ou ton revisionnage).
- MyAnimeList utilise le flux OAuth2 avec **PKCE**, sans secret client embarqué dans l’extension.

### Connexions réseau

SyncKai ne contacte que ces adresses :

| Hôte | Usage |
| --- | --- |
| `graphql.anilist.co` | API AniList : recherche des fiches, liste, mise à jour, calendrier des sorties |
| `anilist.co` | Connexion OAuth AniList |
| `myanimelist.net`, `api.myanimelist.net` | Connexion OAuth et API MyAnimeList |
| `static.crunchyroll.com` | Repères du générique de fin d’un épisode (sans cookies) |
| `www.crunchyroll.com` | Import de l’historique, uniquement quand tu le lances, depuis ton onglet Crunchyroll |
| `gw.api.animationdigitalnetwork.com` | Import de l’historique, uniquement quand tu le lances, depuis ton onglet ADN |
| `www.netflix.com` | Métadonnées de l’épisode en cours (titre, saison, numéro), uniquement si Netflix est activé, depuis ton onglet Netflix ; import de l’historique (page Activité de visionnage, puis métadonnées et positions de lecture des animes trouvés), uniquement quand tu le lances, depuis ton onglet Netflix |

Le popup et le panneau latéral affichent aussi les images (couvertures, bannières) et les avatars fournis par AniList et MyAnimeList, chargés depuis leurs serveurs d’images (`s4.anilist.co`, `cdn.myanimelist.net`, `api-cdn.myanimelist.net`) ; toute autre adresse d’image est bloquée, même venant d’un fichier de sauvegarde importé.

### Sauvegarde (export / import)

Le fichier d’export est un fichier JSON téléchargé sur ton appareil. Il n’est envoyé nulle part et ne contient **jamais** tes jetons ni tes connexions AniList/MAL.

### Supprimer tes données

- **Déconnecter** un compte dans Réglages › Comptes supprime son jeton et son profil, ainsi que la comparaison AniList ↔ MyAnimeList et les données de l’import d’historique ; à la déconnexion du dernier compte, l’historique, les vérifications, la file d’attente et les caches de `chrome.storage.local` sont effacés. Toute déconnexion efface aussi la fiche de la page et les données du panneau gardées dans `chrome.storage.session`.
- Réglages › Correspondances › « Tout réinitialiser » efface les correspondances mémorisées.
- **Désinstaller l’extension** supprime toutes les données stockées.
- Les données enregistrées sur AniList ou MyAnimeList (ta liste) se gèrent directement sur ces services.

### Contact

Questions ou demandes : [GitHub Issues](https://github.com/Sync-Kai/SyncKai/issues).

---

## Deutsch

### Kurz gesagt

SyncKai hat **keinen eigenen Server**. Deine Daten bleiben in deinem Browser und werden nur an AniList und/oder MyAnimeList gesendet, ausschließlich um deine Liste zu aktualisieren. Keine Analyse, keine Werbung, kein Verkauf und keine Weitergabe.

### Von Seiten gelesene Daten

Das Content-Script läuft nur auf **crunchyroll.com** und **animationdigitalnetwork.com** (und auf **netflix.com** oder **disneyplus.com**, wenn du sie aktivierst, siehe unten). Auf einer Episodenseite liest es:

- den Serientitel, die Staffel und die Episodennummer;
- die Wiedergabeposition und Dauer des Videos (um das Ende der Episode zu erkennen).

Es liest weder deine Crunchyroll-/ADN-Zugangsdaten noch deinen Browserverlauf (außer, für den ADN-Verlaufsimport unten, dem Zugriffstoken, das die ADN-Website in deinem Tab hält; es wird dort verwendet und nie gespeichert).

**Netflix** (Einstellungen, optional): nur wenn du es aktivierst, fragt dein Browser nach Zugriff auf **netflix.com**; beim Deaktivieren wird dieser Zugriff entfernt. Auf der Netflix-Wiedergabeseite liest SyncKai dieselben Informationen (Serientitel, Staffel, Episodennummer, Beginn des Abspanns), indem es aus deinem Tab, mit der Sitzung dieser Website, die Metadaten des laufenden Videos abfragt, sowie die Wiedergabeposition. Es liest weder dein Netflix-Konto noch dein Profil, und deinen Netflix-Verlauf nur für den Netflix-Verlaufsimport unten, wenn du ihn startest; gesendet wird nur an AniList / MyAnimeList. Synchronisiert werden nur Animes, die auf AniList mit Netflix verknüpft sind: zur Prüfung wird der Serientitel im öffentlichen Katalog von AniList gesucht (ohne dein Konto). Andere Titel werden ignoriert: In deine Listen wird nichts geschrieben, und nur die Netflix-Serien-ID wird 24 Std. im Sitzungsspeicher gehalten (beim Schließen des Browsers gelöscht), damit die Suche nicht wiederholt wird.

**Disney+** (Einstellungen, optional): nur wenn du es aktivierst, fragt dein Browser nach Zugriff auf **disneyplus.com**; beim Deaktivieren wird dieser Zugriff entfernt. Auf der Disney+-Wiedergabeseite sendet SyncKai keine Anfrage: Es liest in deinem Tab nur die Antworten, die der Disney+-Player selbst für das laufende Video erhält (Serientitel, Staffel, Episodennummer, Originalsprache, Laufzeit und den Beginn des Abspanns), sowie die vom Player angezeigte Wiedergabeposition. Nichts davon wird gespeichert: Der Beginn des Abspanns dient nur in deinem Tab dazu, zu Beginn des Abspanns zu synchronisieren. Es liest weder dein Disney+-Konto noch dein Profil, deinen Disney+-Verlauf, deine Anmelde-Token oder die Adressen des Videostreams. Titel, deren Originalsprache nicht Japanisch ist, werden sofort in deinem Tab ignoriert: Nichts darüber verlässt die Seite. Bei japanischen Titeln werden nur Animes synchronisiert, die auf AniList mit Disney+ verknüpft sind, mit derselben Prüfung wie bei Netflix (Serientitel im öffentlichen Katalog von AniList gesucht, ohne dein Konto); andere Titel werden ignoriert, und nur der Serientitel wird 24 Std. im Sitzungsspeicher gehalten (beim Schließen des Browsers gelöscht).

**Import von Crunchyroll** (Einstellungen, optional): nur wenn du ihn startest, liest SyncKai deinen Crunchyroll-Wiedergabeverlauf in deinem eigenen Crunchyroll-Tab, mit der Sitzung dieser Website. Dazu fordert es bei Crunchyroll ein temporäres Token an, mit der öffentlichen Client-ID, die die Crunchyroll-Website selbst verwendet (kein Passwort, kein Geheimnis); das Token bleibt im Tab und wird nie gespeichert. Während der Analyse wird der reduzierte Verlauf (eine Zeile pro Staffel: Serie, zuletzt gesehene Folge, Datum) im Speicher der Erweiterung gehalten und gelöscht, sobald die Vorschau fertig ist oder wenn die Analyse abgebrochen wird oder fehlschlägt. Danach wird nur die Import-Vorschau (Serien, Folgen, geplanter Fortschritt) gespeichert; gesendet wird nur an AniList / MyAnimeList.

**Import von ADN** (Einstellungen, optional): nur wenn du ihn startest, liest SyncKai deinen ADN-Wiedergabeverlauf in deinem eigenen ADN-Tab, mit derselben Anfrage wie die ADN-Website (`gw.api.animationdigitalnetwork.com`), mithilfe des Zugriffstokens, das die Website im Speicher dieses Tabs hält (kein Passwort; das Erneuerungstoken wird nie gelesen). Das Token bleibt im Tab: Es wird nie gespeichert, protokolliert oder an den Rest der Erweiterung weitergegeben. Nur die Folgen des Verlaufs (Serie, Staffel, Folgennummer, Position, Datum) gehen an die Importseite, die sie auf eine Zeile pro Staffel reduziert; der Rest läuft wie bei Crunchyroll (reduzierter Verlauf gelöscht, sobald die Vorschau fertig ist, nur die Vorschau bleibt, gesendet wird nur an AniList / MyAnimeList).

**Import von Netflix** (Einstellungen, optional; nutzt den Netflix-Zugriff oben, den die Importseite anfragt, falls er noch nicht aktiviert ist): nur wenn du ihn startest, liest SyncKai den Wiedergabeverlauf des in deinem eigenen Netflix-Tab geöffneten Profils auf dessen Aktivitätsseite (`netflix.com/viewingactivity`). Um den ganzen Verlauf zu laden, klickt es bis zum Ende auf die Schaltfläche „Mehr anzeigen“ dieser Seite, höchstens einmal pro Sekunde; sonst wird auf der Seite nichts angeklickt (nie „Im Verlauf ausblenden“ oder „Problem melden“), und SyncKai sendet dafür keine eigene Anfrage. Nur Titel und Video-ID jeder Zeile gehen an die Importseite. Um nur Animes zu behalten, wird jeder einzelne Titel im öffentlichen Katalog von AniList gesucht (mehrere Titel pro Anfrage); Titel, die keine Animes sind, werden nur gezählt, nie aufgelistet, protokolliert oder gespeichert. Für die gefundenen Animes (AniList-Eintrag mit dieser Netflix-Serie verknüpft oder mit gleichem Titel) fragt SyncKai aus deinem Tab, mit der Sitzung dieser Website, die Metadaten der Serie mit deiner letzten Wiedergabeposition jeder Folge ab; weitergegeben werden nur Folgennummern, Laufzeiten und Positionen, nie dein Netflix-Konto, dein Profil, deine Token oder die Daten deiner Wiedergaben. Eine Folge gilt nur als gesehen, wenn ihre letzte Position das von Netflix markierte Ende (oder den Abspann) erreicht hat; ein Fortschritt geht nie zurück. Der Rest läuft wie bei Crunchyroll (reduzierter Verlauf gelöscht, sobald die Vorschau fertig ist, nur die Vorschau bleibt, gesendet wird nur an AniList / MyAnimeList).

### Gespeicherte Daten

**Lokal** auf deinem Gerät gespeichert, im Erweiterungsspeicher (`chrome.storage.local`):

- deine Einstellungen (Auslöser, Benachrichtigungen, bevorzugter Player, Sprache…);
- gespeicherte Zuordnungen zwischen Serien und AniList-/MAL-Einträgen, ausgeschlossene Serien;
- die Links zu den Serienseiten, die du auf den Streaming-Seiten angesehen oder besucht hast, um sie aus der Liste „Schaue ich“ zu öffnen;
- Verlauf der letzten Synchronisierungen, zu prüfende Episoden, zu bewertende Serien, abgelehnte Rewatches;
- die Warteschlange ausstehender Synchronisierungen (Offline-Wiederholung);
- der letzte Vergleich AniList ↔ MyAnimeList und die Vorschau des Verlaufsimports (Crunchyroll, ADN oder Netflix);
- Caches (Liste „Schaue ich“, Profil, Ausstrahlungsplan);
- die letzten 50 technischen Fehler (ohne Tokens und Kontonamen) zur Fehlerdiagnose: Sie verlassen den Browser nie, außer du kopierst selbst den Diagnosebericht (Einstellungen › Hilfe).

Einige kurzlebige Caches werden im Arbeitsspeicher gehalten, im Sitzungsspeicher der Erweiterung (`chrome.storage.session`): der für die aktuelle Seite angezeigte Eintrag, die Daten der Seitenleiste (AniList-Eintrag der Folge, Fortsetzungen) und die als Nicht-Anime erkannten Netflix- und Disney+-Serien. Sie werden nie auf die Festplatte geschrieben: veraltete Einträge werden laufend entfernt, der Eintrag der aktuellen Seite und die Daten der Seitenleiste sofort beim Abmelden eines Kontos gelöscht, der Rest beim Schließen des Browsers.

### AniList- und MyAnimeList-Konten

- Die Anmeldung erfolgt über das offizielle Autorisierungsfenster von AniList bzw. MyAnimeList (`chrome.identity`). SyncKai sieht dein Passwort nie.
- Zugriffstoken (OAuth) werden lokal **verschlüsselt** gespeichert (AES-GCM, mit einem nicht exportierbaren Schlüssel der Erweiterung, den Webseiten nicht lesen können) und **nur** verwendet, um die API des jeweiligen Dienstes aufzurufen (Liste lesen, Fortschritt, Bewertung oder Rewatch aktualisieren).
- MyAnimeList nutzt den OAuth2-Ablauf mit **PKCE**, ohne in der Erweiterung eingebettetes Client-Secret.

### Netzwerkverbindungen

SyncKai kontaktiert nur diese Hosts:

| Host | Zweck |
| --- | --- |
| `graphql.anilist.co` | AniList-API: Eintragssuche, Liste, Aktualisierungen, Ausstrahlungsplan |
| `anilist.co` | AniList-OAuth-Anmeldung |
| `myanimelist.net`, `api.myanimelist.net` | MyAnimeList-OAuth-Anmeldung und API |
| `static.crunchyroll.com` | Abspann-Markierungen einer Episode (ohne Cookies) |
| `www.crunchyroll.com` | Verlaufsimport, nur wenn du ihn startest, aus deinem Crunchyroll-Tab |
| `gw.api.animationdigitalnetwork.com` | Verlaufsimport, nur wenn du ihn startest, aus deinem ADN-Tab |
| `www.netflix.com` | Metadaten der aktuellen Episode (Titel, Staffel, Nummer), nur wenn Netflix aktiviert ist, aus deinem Netflix-Tab; Verlaufsimport (Aktivitätsseite, dann Metadaten und Wiedergabepositionen der gefundenen Animes), nur wenn du ihn startest, aus deinem Netflix-Tab |

Das Popup und die Seitenleiste zeigen außerdem Bilder (Cover, Banner) und Avatare von AniList und MyAnimeList an, die von deren Bildservern geladen werden (`s4.anilist.co`, `cdn.myanimelist.net`, `api-cdn.myanimelist.net`); jede andere Bildadresse wird blockiert, auch aus einer importierten Sicherungsdatei.

### Sicherung (Export / Import)

Die Exportdatei ist eine JSON-Datei, die auf dein Gerät heruntergeladen wird. Sie wird nirgendwohin gesendet und enthält **niemals** deine Token oder AniList-/MAL-Verbindungen.

### Daten löschen

- **Abmelden** eines Kontos unter Einstellungen › Konten löscht dessen Token und Profil sowie den Vergleich AniList ↔ MyAnimeList und die Daten des Verlaufsimports; beim Abmelden des letzten Kontos werden auch Verlauf, Prüfungen, Warteschlange und die Caches in `chrome.storage.local` gelöscht. Jedes Abmelden löscht außerdem den Eintrag der aktuellen Seite und die Daten der Seitenleiste in `chrome.storage.session`.
- Einstellungen › Zuordnungen › „Alles zurücksetzen“ löscht die gespeicherten Zuordnungen.
- **Deinstallieren der Erweiterung** löscht alle gespeicherten Daten.
- Auf AniList oder MyAnimeList gespeicherte Daten (deine Liste) verwaltest du direkt bei diesen Diensten.

### Kontakt

Fragen oder Anfragen: [GitHub Issues](https://github.com/Sync-Kai/SyncKai/issues).
