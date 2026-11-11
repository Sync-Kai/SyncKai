# Privacy Policy · Politique de confidentialité · Datenschutzerklärung

**SyncKai** · Effective date / Date d’effet / Gültig ab: **2026-11-11**

English is the reference version; the French and German translations follow.

- [English](#english)
- [Français](#français)
- [Deutsch](#deutsch)

---

## English

### In short

SyncKai has **no server**. Your data stays in your browser and is only sent to AniList and/or MyAnimeList, to update your list and to show you information about your series (new episodes, sequels, watch order, suggestions, the people you follow on AniList). No analytics, no ads, no selling or sharing.

### Data read from pages

The content script runs only on **crunchyroll.com** and **animationdigitalnetwork.com** (and on **netflix.com**, **disneyplus.com** or **primevideo.com** if you turn them on, see below). On an episode page, it reads:

- the series title, season and episode number;
- the video playback position and duration (to detect the end of the episode).

It does not read your Crunchyroll/ADN credentials or your browsing history (except, for the ADN history import below, the access token the ADN site keeps in your tab, used there and never saved).

**Crunchyroll series data**: to tell apart series with the same title (remakes, sequels), a passive script in the Crunchyroll page reads, in your tab, the series, season and episode data the Crunchyroll site itself already receives (launch year, number of episodes per season, episode air dates and runtimes, audio language of each season). It sends no request, and never reads the headers of the site’s requests (which carry your Crunchyroll sign-in token), your cookies, your account or profile, your watch progress or the video stream addresses. Only the year, the number of episodes, the episode length and the country (Japan, for a Japanese original version) of the season being watched are passed on, with the episode, to the matching of the AniList entry; nothing of this is stored.

**Netflix** (Settings, optional): only if you turn it on, your browser asks you for access to **netflix.com**; turning it off removes that access. On the Netflix player page, SyncKai reads the same information (series title, season, episode number, credits start) by requesting the current video’s metadata from your tab, using that site’s session, plus the playback position. It does not read your Netflix account or profile, nor your viewing history (except for the Netflix history import below, only when you start it), and nothing is sent to anyone but AniList / MyAnimeList. Only anime linked to Netflix on AniList are synced: to check this, the series title is looked up in AniList’s public catalog (a read-only search that changes nothing in your lists; if you are signed in to AniList, the request carries your AniList token, like every AniList request made by SyncKai). Other titles are ignored: nothing is written to your lists, and only the Netflix series ID is kept for 24 h in session memory (cleared when the browser closes) to avoid searching again.

**Disney+** (Settings, optional): only if you turn it on, your browser asks you for access to **disneyplus.com**; turning it off removes that access. On the Disney+ player page, SyncKai sends no request: it only reads, in your tab, the responses the Disney+ player itself receives for the current video (series title, season, episode number, original language, runtime, and the time the end credits start), plus the playback position shown by the player. None of this is stored: the credits time is only used in your tab to sync at the start of the credits. It never reads your Disney+ account, profile or viewing history, your sign-in tokens or the video stream addresses. Titles whose original language is not Japanese are ignored right away in your tab: nothing about them leaves the page. For Japanese titles, only anime linked to Disney+ on AniList are synced, with the same check as for Netflix (series title looked up in AniList’s public catalog, read-only); other titles are ignored and only the series title is kept for 24 h in session memory (cleared when the browser closes).

**Prime Video** (Settings, optional): only if you turn it on, your browser asks you for access to **primevideo.com** (the Amazon store sites are not used); turning it off removes that access. On a Prime Video title page and its player, SyncKai sends no request: it only reads, in your tab, what the Prime Video site itself receives: the title’s page data (title, season, episode list, genres, audio track names), the catalog data the player receives for the current video (series title, season, episode number) and, from its playback data, only the time the end credits start and the total duration; plus the playback position of the video. None of this is stored: the credits time is only used in your tab to sync at the start of the credits. It never reads your Amazon or Prime Video account, profile or viewing history, your cookies or sign-in tokens, the video stream addresses or licences. Titles Prime Video does not list as animation are ignored right away in your tab: nothing about them leaves the page. Animation titles are looked up in AniList’s public catalog (read-only, as for Netflix); a title that Prime Video neither labels anime nor offers with Japanese audio is synced only if an AniList anime has exactly the same title. Other titles are ignored and only the series title is kept for 24 h in session memory (cleared when the browser closes).

**Import from Crunchyroll** (Settings, optional): only when you start it, SyncKai reads your Crunchyroll watch history in your own Crunchyroll tab, using that site’s session. To do so, it asks Crunchyroll for a temporary token, with the public client ID used by Crunchyroll’s own website (no password, no secret); the token stays in the tab and is never saved. Crunchyroll lists this access as a device named « SyncKai » in your account’s device management (one entry, tied to your browser session, not one per import); you can deactivate it there at any time. During the analysis, the reduced history (one line per season: series, last episode watched, date) is kept in the extension’s storage, then erased as soon as the preview is ready, or if the analysis is stopped or fails. After that, nothing is kept except the import preview (series, episodes, planned progress); nothing is sent to anyone but AniList / MyAnimeList.

**Import from ADN** (Settings, optional): only when you start it, SyncKai reads your ADN watch history in your own ADN tab, with the same request the ADN website makes (`gw.api.animationdigitalnetwork.com`), using the access token the site keeps in that tab’s storage (no password; the renewal token is never read). The token stays in the tab: it is never saved, logged or sent to the rest of the extension. Only the episodes of the history (series, season, episode number, position, date) are passed to the import page, which reduces them to one line per season; the rest works as for Crunchyroll (reduced history erased once the preview is ready, only the preview kept, nothing sent to anyone but AniList / MyAnimeList).

**Import from Netflix** (Settings, optional; uses the Netflix access above, which the import page asks for if it is not turned on yet): only when you start it, SyncKai reads the viewing history of the profile open in your own Netflix tab, on its Viewing activity page (`netflix.com/viewingactivity`). To load the whole history, it clicks that page’s own “Show more” button until the end, at most once per second; nothing else on the page is clicked (never “Hide from viewing history” or “Report a problem”) and SyncKai sends no request of its own for this. Only the title and the video ID of each line are passed to the import page. To keep anime only, each distinct title is looked up in AniList’s public catalog (several titles per request); titles that are not anime are only counted, never listed, logged or kept. For the anime found (an AniList entry linked to that Netflix series, or with the same title), SyncKai requests the series metadata from your tab, using that site’s session, together with your last playback position on each episode; only episode numbers, runtimes and positions are passed on, never your Netflix account, profile, tokens or the dates you watched. An episode counts as watched only if its last position reached the end marked by Netflix (or the credits); progress is never moved backwards. The rest works as for Crunchyroll (reduced history erased once the preview is ready, only the preview kept, nothing sent to anyone but AniList / MyAnimeList).

### Data read from AniList and MyAnimeList

Besides syncing your episodes, SyncKai reads your lists and AniList’s public catalog for the features below. Catalog requests carry your AniList token if you are signed in to AniList, and no token otherwise. Nothing of this is sent to anyone but AniList / MyAnimeList.

**Sequel alerts** (Settings › Notifications › Sequel alerts; on by default, but they stay off after the update to 2.5.0 if you had turned release alerts off): once a day (or 6 hours after a check that failed), and when you press “Check now”, SyncKai reads your whole AniList and/or MyAnimeList list. It looks up on AniList, by their MyAnimeList ID, the series you completed, are watching or rewatching on MyAnimeList that are not in your AniList list (without any token if you only use MyAnimeList), then reads in AniList’s public catalog the relations of the series you completed, are watching or rewatching, excluded series aside. A sequel that is announced or airing and in none of your lists shows in the popup’s “Activity” tab and in the side panel’s “Schedule” (“Announced” view) and, unless you turned the browser notification off, in a notification (one for several sequels found at once; the first check only records the sequels it finds, without notifying them). Clicking a sequel’s notification opens its AniList entry. On Chrome, it also has two buttons: “+ Plan to watch” adds the sequel to Plan to watch on your connected accounts (an entry already in your list is never changed) and “Open entry” opens it; there are no buttons when no connected account has an entry for that sequel (MyAnimeList only, sequel not on MyAnimeList yet). Firefox shows no buttons.

**Suggestions** (side panel › “Discover”, and the popup when “My series” is empty): when one of these opens, unless suggestions computed in the last 24 hours are kept, SyncKai reads the same lists (with the same MyAnimeList ID lookup on AniList) and, in AniList’s public catalog, the recommendations for the series you rated highly or watched (or, without enough of them, the season’s top series). “+ Plan to watch” adds a suggestion to your lists as for a sequel. The last suggestions are reused for 24 hours and kept until they are computed again or you log out; the suggestions you turned down (“Not interested”, 500 at most) are kept and included in the backup file, and Settings › My data can show them again. The “In the same spirit” section of the side panel shows the AniList recommendations of the entry shown in “Now playing”, minus the series already in your lists (read as for the watch order) and the ones you turned down.

**Watch order** (side panel › “Now playing”): to list the franchise of the series shown in release order, SyncKai reads its relations in AniList’s public catalog, kept for 24 h in session memory (cleared when the browser closes). To tick off what you watched, it reads your status and progress for these entries: from AniList for these entries only, from MyAnimeList with your whole list, kept in the extension’s memory for 5 minutes at most. Your statuses are not stored.

**Friends on AniList** (the popup’s “On this page” card and the side panel’s “Now playing”, with an AniList account only): SyncKai asks AniList which of the people you follow have the series shown in their list, with their name, avatar, status, progress and score, to show them with their average score. The answer is kept in the extension’s memory for 10 minutes at most: it is never stored, nor included in the backup file or the diagnostic report.

### Stored data

Stored **locally** on your device, in the extension storage (`chrome.storage.local`):

- your settings (trigger, notifications, preferred player, language…);
- remembered matches between series and AniList/MAL entries, excluded series;
- the links to the series pages you watched or visited on the streaming sites, to open them from the “Watching” list;
- recent sync history, episodes to review, series to rate, declined rewatches;
- the queue of pending syncs (offline retry);
- the last AniList ↔ MyAnimeList comparison and the history import preview (Crunchyroll, ADN or Netflix);
- the sequels found by sequel alerts (AniList entry, title, cover, dates, the series they follow) with their state (new, seen, hidden), the IDs of the sequels already found and the result of the last check;
- the last suggestions (up to 60 AniList entries, with the series of your list they come from and your scores for them), until they are computed again or you log out, and the suggestions you turned down;
- the series you chose to keep (“Keep”) out of the “Dormant series” group of “My series”;
- caches (“Watching” list, profile with its statistics: number of anime, episodes and days watched, airing schedule) and the number of episodes synced this week to each account;
- the last 50 technical errors (without tokens or account names), to help diagnose problems: they never leave your browser unless you copy the diagnostic report yourself (Settings › Help & about).

A few short-lived caches are kept in memory, in the extension’s session storage (`chrome.storage.session`): the entry shown for the current page, the side panel data (the episode’s AniList entry, sequels), the watch order of the franchises shown (24 h) and the Netflix, Disney+ and Prime Video series recognized as not anime. They are never written to disk: stale entries are removed along the way, the current page entry, the side panel data and the watch orders are cleared as soon as you log out of an account, and the rest when the browser closes.

### AniList and MyAnimeList accounts

- Sign-in uses the official AniList or MyAnimeList authorization window (`chrome.identity`). SyncKai never sees your password.
- Access tokens (OAuth) are stored locally, **encrypted** (AES-GCM, with a non-exportable key specific to the extension that web pages cannot read), and used **only** to call the corresponding service’s API (read your list, add or remove a series, update your progress, status, score, rewatch or comment; on AniList, also read the entries of the people you follow).
- MyAnimeList uses the OAuth2 flow with **PKCE**, with no client secret embedded in the extension.

### Network connections

SyncKai only contacts these hosts:

| Host | Purpose |
| --- | --- |
| `graphql.anilist.co` | AniList API: entry lookup, list, updates, airing schedule, sequels, watch order, suggestions, people you follow |
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

- **Log out** of an account in Settings › Accounts to delete its token, its profile and the series you kept out of “Dormant series” for it, along with the AniList ↔ MyAnimeList comparison, the history import data, the sequels found and the last suggestions; logging out of the last account also clears history, reviews, the suggestions you turned down, the pending queue and the `chrome.storage.local` caches. Any logout also clears the current page entry, the side panel data and the watch orders kept in `chrome.storage.session`.
- Settings › Sync › Matches › “Reset all” clears the remembered matches.
- **Uninstalling the extension** deletes all stored data.
- Data saved on AniList or MyAnimeList (your list) is managed directly on those services.

### Contact

Questions or requests: [GitHub Issues](https://github.com/Sync-Kai/SyncKai/issues).

---

## Français

### En bref

SyncKai n’a **aucun serveur**. Tes données restent dans ton navigateur et ne sont envoyées qu’à AniList et/ou MyAnimeList, pour mettre ta liste à jour et t’afficher des informations sur tes séries (sorties, suites, ordre de visionnage, suggestions, personnes que tu suis sur AniList). Aucune statistique d’usage, aucune publicité, aucune revente ni aucun partage.

### Données lues sur les pages

Le content script s’exécute uniquement sur **crunchyroll.com** et **animationdigitalnetwork.com** (et sur **netflix.com**, **disneyplus.com** ou **primevideo.com** si tu les actives, voir plus bas). Sur une page d’épisode, il lit :

- le titre de la série, la saison et le numéro d’épisode ;
- la position et la durée de lecture de la vidéo (pour détecter la fin de l’épisode).

Il ne lit ni tes identifiants Crunchyroll/ADN, ni ton historique de navigation (sauf, pour l’import de l’historique ADN ci-dessous, le jeton d’accès que le site ADN garde dans ton onglet, utilisé sur place et jamais enregistré).

**Données de série Crunchyroll** : pour distinguer des séries au même titre (remakes, suites), un script passif de la page Crunchyroll lit, dans ton onglet, les données de série, de saison et d’épisode que le site Crunchyroll reçoit déjà lui-même (année de lancement, nombre d’épisodes par saison, dates de diffusion et durées des épisodes, langue audio de chaque saison). Il n’envoie aucune requête et ne lit jamais les en-têtes des requêtes du site (qui portent ton jeton de connexion Crunchyroll), tes cookies, ton compte ou ton profil, ta progression ni les adresses des flux vidéo. Seuls l’année, le nombre d’épisodes, la durée d’un épisode et le pays (Japon, pour une version originale japonaise) de la saison regardée sont transmis, avec l’épisode, à la recherche de la fiche AniList ; rien de tout cela n’est enregistré.

**Netflix** (Réglages, facultatif) : seulement si tu l’actives, ton navigateur te demande l’accès à **netflix.com** ; le désactiver retire cet accès. Sur la page de lecture Netflix, SyncKai lit les mêmes informations (titre de la série, saison, numéro d’épisode, début du générique) en interrogeant, depuis ton onglet et avec la session de ce site, les métadonnées de la vidéo en cours, ainsi que la position de lecture. Il ne lit ni ton compte ni ton profil, ni ton historique Netflix (sauf pour l’import de l’historique Netflix ci-dessous, uniquement quand tu le lances), et rien n’est envoyé à quiconque d’autre qu’AniList / MyAnimeList. Seuls les animes liés à Netflix sur AniList sont synchronisés : pour le vérifier, le titre de la série est recherché dans le catalogue public d’AniList (une simple recherche, qui ne modifie rien dans tes listes ; si tu es connecté à AniList, la requête porte ton jeton AniList, comme toute requête AniList de SyncKai). Les autres titres sont ignorés : rien n’est écrit dans tes listes, et seul l’identifiant Netflix de la série est retenu 24 h en mémoire de session (effacé à la fermeture du navigateur) pour ne pas refaire la recherche.

**Disney+** (Réglages, facultatif) : seulement si tu l’actives, ton navigateur te demande l’accès à **disneyplus.com** ; le désactiver retire cet accès. Sur la page de lecture Disney+, SyncKai n’envoie aucune requête : il lit seulement, dans ton onglet, les réponses que le lecteur Disney+ reçoit lui-même pour la vidéo en cours (titre de la série, saison, numéro d’épisode, langue originale, durée, et le moment où commence le générique de fin), ainsi que la position de lecture affichée par le lecteur. Rien de tout cela n’est enregistré : le moment du générique sert seulement, dans ton onglet, à synchroniser au début du générique. Il ne lit ni ton compte, ni ton profil, ni ton historique Disney+, ni tes jetons de connexion, ni les adresses du flux vidéo. Les titres dont la langue originale n’est pas le japonais sont ignorés aussitôt dans ton onglet : rien à leur sujet ne quitte la page. Pour les titres japonais, seuls les animes liés à Disney+ sur AniList sont synchronisés, avec la même vérification que pour Netflix (titre de la série recherché dans le catalogue public d’AniList, en lecture seule) ; les autres titres sont ignorés et seul le titre de la série est retenu 24 h en mémoire de session (effacé à la fermeture du navigateur).

**Prime Video** (Réglages, facultatif) : seulement si tu l’actives, ton navigateur te demande l’accès à **primevideo.com** (les sites marchands d’Amazon ne sont pas utilisés) ; le désactiver retire cet accès. Sur une page de titre Prime Video et son lecteur, SyncKai n’envoie aucune requête : il lit seulement, dans ton onglet, ce que le site Prime Video reçoit lui-même : les données de la page du titre (titre, saison, liste des épisodes, genres, noms des pistes audio), les données de catalogue que le lecteur reçoit pour la vidéo en cours (titre de la série, saison, numéro d’épisode) et, parmi ses données de lecture, seulement le moment où commence le générique de fin et la durée totale ; ainsi que la position de lecture de la vidéo. Rien de tout cela n’est enregistré : le moment du générique sert seulement, dans ton onglet, à synchroniser au début du générique. Il ne lit ni ton compte Amazon ou Prime Video, ni ton profil, ni ton historique, ni tes cookies ou jetons de connexion, ni les adresses du flux vidéo ou les licences. Les titres que Prime Video ne classe pas en animation sont ignorés aussitôt dans ton onglet : rien à leur sujet ne quitte la page. Les titres d’animation sont recherchés dans le catalogue public d’AniList (en lecture seule, comme pour Netflix) ; un titre que Prime Video ne classe pas en anime et ne propose pas en audio japonais n’est synchronisé que si un anime AniList porte exactement le même titre. Les autres titres sont ignorés et seul le titre de la série est retenu 24 h en mémoire de session (effacé à la fermeture du navigateur).

**Import depuis Crunchyroll** (Réglages, facultatif) : seulement quand tu le lances, SyncKai lit ton historique de visionnage Crunchyroll dans ton propre onglet Crunchyroll, avec la session de ce site. Pour cela, il demande à Crunchyroll un jeton temporaire, avec l’identifiant public qu’utilise le site web de Crunchyroll (aucun mot de passe, aucun secret) ; ce jeton reste dans l’onglet et n’est jamais enregistré. Crunchyroll affiche cet accès comme un appareil nommé « SyncKai » dans la gestion des appareils de ton compte (une seule entrée, liée à la session de ton navigateur, pas une par import) ; tu peux l’y désactiver à tout moment. Pendant l’analyse, l’historique réduit (une ligne par saison : série, dernier épisode vu, date) est gardé dans le stockage de l’extension, puis effacé dès que l’aperçu est prêt, ou si l’analyse est arrêtée ou échoue. Ensuite, rien n’est conservé hormis l’aperçu de l’import (séries, épisodes, progression prévue) ; rien n’est envoyé à quiconque d’autre qu’AniList / MyAnimeList.

**Import depuis ADN** (Réglages, facultatif) : seulement quand tu le lances, SyncKai lit ton historique de visionnage ADN dans ton propre onglet ADN, avec la même requête que le site web d’ADN (`gw.api.animationdigitalnetwork.com`), au moyen du jeton d’accès que le site garde dans le stockage de cet onglet (aucun mot de passe ; le jeton de renouvellement n’est jamais lu). Ce jeton reste dans l’onglet : il n’est jamais enregistré, journalisé ni transmis au reste de l’extension. Seuls les épisodes de l’historique (série, saison, numéro d’épisode, position, date) sont passés à la page d’import, qui les réduit à une ligne par saison ; la suite se passe comme pour Crunchyroll (historique réduit effacé dès que l’aperçu est prêt, seul l’aperçu est conservé, rien n’est envoyé à quiconque d’autre qu’AniList / MyAnimeList).

**Import depuis Netflix** (Réglages, facultatif ; utilise l’accès Netflix ci-dessus, que la page d’import demande s’il n’est pas encore activé) : seulement quand tu le lances, SyncKai lit l’historique de visionnage du profil ouvert dans ton propre onglet Netflix, sur sa page Activité de visionnage (`netflix.com/viewingactivity`). Pour charger tout l’historique, il clique sur le bouton « Voir plus » de cette page jusqu’à la fin, au plus une fois par seconde ; rien d’autre n’est cliqué sur la page (jamais « Masquer dans l’historique » ni « Signaler un problème ») et SyncKai n’envoie pour cela aucune requête de son côté. Seuls le titre et l’identifiant de la vidéo de chaque ligne sont passés à la page d’import. Pour ne garder que les animes, chaque titre distinct est recherché dans le catalogue public d’AniList (plusieurs titres par requête) ; les titres qui ne sont pas des animes sont seulement comptés, jamais listés, journalisés ni conservés. Pour les animes trouvés (fiche AniList liée à cette série Netflix, ou au même titre), SyncKai demande depuis ton onglet, avec la session de ce site, les métadonnées de la série avec ta dernière position de lecture sur chaque épisode ; seuls les numéros d’épisode, durées et positions sont transmis, jamais ton compte, ton profil, tes jetons Netflix ni les dates de visionnage. Un épisode n’est compté comme vu que si sa dernière position a atteint la fin indiquée par Netflix (ou le générique) ; une progression ne recule jamais. La suite se passe comme pour Crunchyroll (historique réduit effacé dès que l’aperçu est prêt, seul l’aperçu est conservé, rien n’est envoyé à quiconque d’autre qu’AniList / MyAnimeList).

### Données lues sur AniList et MyAnimeList

En plus de synchroniser tes épisodes, SyncKai lit tes listes et le catalogue public d’AniList pour les fonctions ci-dessous. Les requêtes au catalogue portent ton jeton AniList si tu es connecté à AniList, et aucun jeton sinon. Rien de tout cela n’est envoyé à quiconque d’autre qu’AniList / MyAnimeList.

**Alertes de suite** (Réglages › Notifications › Alertes de suite ; activées par défaut, mais elles restent coupées après la mise à jour vers la 2.5.0 si tu avais coupé les alertes de sortie) : une fois par jour (ou 6 h après une vérification en échec), et quand tu appuies sur « Vérifier maintenant », SyncKai lit ta liste AniList et/ou MyAnimeList entière. Il recherche sur AniList, par leur identifiant MyAnimeList, les séries que tu as terminées, que tu regardes ou que tu revois sur MyAnimeList et qui ne sont pas dans ta liste AniList (sans aucun jeton si tu n’utilises que MyAnimeList), puis lit dans le catalogue public d’AniList les relations des séries que tu as terminées, que tu regardes ou que tu revois, hors séries exclues. Une suite annoncée ou en cours de diffusion, absente de toutes tes listes, apparaît dans l’onglet « Activité » du popup et dans l’« Agenda » du panneau latéral (vue « Annoncées ») et, sauf si tu as coupé la notification du navigateur, dans une notification (une seule pour plusieurs suites trouvées en même temps ; la première vérification enregistre seulement les suites trouvées, sans les notifier). Un clic sur la notification d’une suite ouvre sa fiche AniList. Sous Chrome, elle a aussi deux boutons : « + À regarder » ajoute la suite à « À regarder » sur tes comptes connectés (une fiche déjà dans ta liste n’est jamais modifiée) et « Ouvrir la fiche » l’ouvre ; elle n’a aucun bouton quand aucun compte connecté n’a de fiche pour cette suite (MyAnimeList seul, suite pas encore sur MyAnimeList). Firefox n’affiche aucun bouton.

**Suggestions** (panneau latéral › « Découvrir », et le popup quand « Mes séries » est vide) : quand l’un des deux s’ouvre, sauf si des suggestions calculées dans les dernières 24 h sont gardées, SyncKai lit les mêmes listes (avec la même recherche des identifiants MyAnimeList sur AniList) et, dans le catalogue public d’AniList, les recommandations des séries que tu as bien notées ou vues (ou, s’il n’y en a pas assez, les meilleures séries de la saison). « + À regarder » ajoute une suggestion à tes listes comme pour une suite. Les dernières suggestions sont réutilisées pendant 24 h et gardées jusqu’à leur prochain calcul ou ta déconnexion ; les suggestions que tu as écartées (« Pas intéressé », 500 au plus) sont gardées et incluses dans le fichier de sauvegarde, et Réglages › Mes données peut les réafficher. La section « Dans le même esprit » du panneau latéral montre les recommandations AniList de la fiche affichée dans « En lecture », sans les séries déjà dans tes listes (lues comme pour l’ordre de visionnage) ni celles que tu as écartées.

**Ordre de visionnage** (panneau latéral › « En lecture ») : pour présenter la franchise de la série affichée dans l’ordre de sortie, SyncKai lit ses relations dans le catalogue public d’AniList, gardées 24 h en mémoire de session (effacées à la fermeture du navigateur). Pour cocher ce que tu as vu, il lit ton statut et ta progression pour ces fiches : sur AniList pour ces fiches seulement, sur MyAnimeList avec ta liste entière, gardée 5 minutes au plus dans la mémoire de l’extension. Tes statuts ne sont pas enregistrés.

**Amis sur AniList** (fiche « Sur cette page » du popup et « En lecture » du panneau latéral, avec un compte AniList seulement) : SyncKai demande à AniList lesquelles des personnes que tu suis ont la série affichée dans leur liste, avec leur nom, leur avatar, leur statut, leur progression et leur note, pour les afficher avec leur note moyenne. La réponse est gardée 10 minutes au plus dans la mémoire de l’extension : elle n’est jamais enregistrée, ni incluse dans le fichier de sauvegarde ou le rapport de diagnostic.

### Données stockées

Sont enregistrés **localement** sur ton appareil, dans le stockage de l’extension (`chrome.storage.local`) :

- tes réglages (déclenchement, notifications, lecteur préféré, langue…) ;
- les correspondances mémorisées entre séries et fiches AniList/MAL, les séries exclues ;
- les liens vers les pages des séries regardées ou visitées sur les sites de streaming, pour les ouvrir depuis la liste « En cours » ;
- l’historique des dernières synchros, les épisodes à vérifier, les séries à noter, les refus de revisionnage ;
- la file des synchros en attente (nouvel essai hors ligne) ;
- la dernière comparaison AniList ↔ MyAnimeList et l’aperçu de l’import d’historique (Crunchyroll, ADN ou Netflix) ;
- les suites trouvées par les alertes de suite (fiche AniList, titre, couverture, dates, série qu’elles suivent) avec leur état (nouvelle, vue, masquée), les identifiants des suites déjà trouvées et le résultat de la dernière vérification ;
- les dernières suggestions (60 fiches AniList au plus, avec les séries de ta liste dont elles viennent et tes notes pour celles-ci), jusqu’à leur prochain calcul ou ta déconnexion, et les suggestions que tu as écartées ;
- les séries que tu as choisi de garder (« Garder ») hors du groupe « Séries en sommeil » de « Mes séries » ;
- des caches (liste « En cours », profil avec ses statistiques : nombre d’animes, d’épisodes et de jours visionnés, calendrier des sorties) et le nombre d’épisodes synchronisés cette semaine vers chaque compte ;
- les 50 dernières erreurs techniques (sans jetons ni noms de compte), pour aider à diagnostiquer un problème : elles ne quittent jamais le navigateur, sauf si tu copies toi-même le rapport de diagnostic (Réglages › Aide & à propos).

Quelques caches de courte durée sont gardés en mémoire, dans le stockage de session de l’extension (`chrome.storage.session`) : la fiche affichée pour la page en cours, les données du panneau latéral (fiche AniList de l’épisode, suites), l’ordre de visionnage des franchises affichées (24 h) et les séries Netflix, Disney+ et Prime Video reconnues comme non-animes. Ils ne sont jamais écrits sur le disque : les entrées périmées sont retirées au fil de l’eau, la fiche de la page, les données du panneau et les ordres de visionnage sont effacés dès la déconnexion d’un compte, et le reste à la fermeture du navigateur.

### Comptes AniList et MyAnimeList

- La connexion passe par la fenêtre d’authentification officielle d’AniList ou de MyAnimeList (`chrome.identity`). SyncKai ne voit jamais ton mot de passe.
- Les jetons d’accès (tokens OAuth) sont stockés localement, **chiffrés** (AES-GCM, avec une clé non exportable propre à l’extension, que les pages web ne peuvent pas lire), et servent **uniquement** à appeler l’API du service concerné (lire ta liste, y ajouter ou en retirer une série, mettre à jour ta progression, ton statut, ta note, ton revisionnage ou ton commentaire ; sur AniList, lire aussi les entrées des personnes que tu suis).
- MyAnimeList utilise le flux OAuth2 avec **PKCE**, sans secret client embarqué dans l’extension.

### Connexions réseau

SyncKai ne contacte que ces adresses :

| Hôte | Usage |
| --- | --- |
| `graphql.anilist.co` | API AniList : recherche des fiches, liste, mise à jour, calendrier des sorties, suites, ordre de visionnage, suggestions, personnes suivies |
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

- **Déconnecter** un compte dans Réglages › Comptes supprime son jeton, son profil et les séries que tu as gardées hors de « Séries en sommeil » pour ce compte, ainsi que la comparaison AniList ↔ MyAnimeList, les données de l’import d’historique, les suites trouvées et les dernières suggestions ; à la déconnexion du dernier compte, l’historique, les vérifications, les suggestions écartées, la file d’attente et les caches de `chrome.storage.local` sont effacés. Toute déconnexion efface aussi la fiche de la page, les données du panneau et les ordres de visionnage gardés dans `chrome.storage.session`.
- Réglages › Synchronisation › Correspondances › « Tout réinitialiser » efface les correspondances mémorisées.
- **Désinstaller l’extension** supprime toutes les données stockées.
- Les données enregistrées sur AniList ou MyAnimeList (ta liste) se gèrent directement sur ces services.

### Contact

Questions ou demandes : [GitHub Issues](https://github.com/Sync-Kai/SyncKai/issues).

---

## Deutsch

### Kurz gesagt

SyncKai hat **keinen eigenen Server**. Deine Daten bleiben in deinem Browser und werden nur an AniList und/oder MyAnimeList gesendet, um deine Liste zu aktualisieren und dir Informationen zu deinen Serien anzuzeigen (neue Folgen, Fortsetzungen, Schaureihenfolge, Vorschläge, Personen, denen du auf AniList folgst). Keine Analyse, keine Werbung, kein Verkauf und keine Weitergabe.

### Von Seiten gelesene Daten

Das Content-Script läuft nur auf **crunchyroll.com** und **animationdigitalnetwork.com** (und auf **netflix.com**, **disneyplus.com** oder **primevideo.com**, wenn du sie aktivierst, siehe unten). Auf einer Episodenseite liest es:

- den Serientitel, die Staffel und die Episodennummer;
- die Wiedergabeposition und Dauer des Videos (um das Ende der Episode zu erkennen).

Es liest weder deine Crunchyroll-/ADN-Zugangsdaten noch deinen Browserverlauf (außer, für den ADN-Verlaufsimport unten, dem Zugriffstoken, das die ADN-Website in deinem Tab hält; es wird dort verwendet und nie gespeichert).

**Crunchyroll-Seriendaten**: Um Serien mit gleichem Titel (Remakes, Fortsetzungen) zu unterscheiden, liest ein passives Script der Crunchyroll-Seite in deinem Tab die Serien-, Staffel- und Folgendaten, die die Crunchyroll-Website selbst bereits erhält (Startjahr, Anzahl der Folgen pro Staffel, Ausstrahlungsdaten und Laufzeiten der Folgen, Audiosprache jeder Staffel). Es sendet keine Anfrage und liest nie die Header der Anfragen der Website (die dein Crunchyroll-Anmeldetoken tragen), deine Cookies, dein Konto oder Profil, deinen Wiedergabefortschritt oder die Adressen der Videostreams. Weitergegeben werden nur Jahr, Anzahl der Folgen, Folgenlänge und Land (Japan, bei einer japanischen Originalfassung) der angesehenen Staffel, zusammen mit der Folge, an die Suche des AniList-Eintrags; nichts davon wird gespeichert.

**Netflix** (Einstellungen, optional): nur wenn du es aktivierst, fragt dein Browser nach Zugriff auf **netflix.com**; beim Deaktivieren wird dieser Zugriff entfernt. Auf der Netflix-Wiedergabeseite liest SyncKai dieselben Informationen (Serientitel, Staffel, Episodennummer, Beginn des Abspanns), indem es aus deinem Tab, mit der Sitzung dieser Website, die Metadaten des laufenden Videos abfragt, sowie die Wiedergabeposition. Es liest weder dein Netflix-Konto noch dein Profil, und deinen Netflix-Verlauf nur für den Netflix-Verlaufsimport unten, wenn du ihn startest; gesendet wird nur an AniList / MyAnimeList. Synchronisiert werden nur Animes, die auf AniList mit Netflix verknüpft sind: zur Prüfung wird der Serientitel im öffentlichen Katalog von AniList gesucht (eine reine Suche, die nichts an deinen Listen ändert; bist du bei AniList angemeldet, trägt die Anfrage dein AniList-Token, wie jede AniList-Anfrage von SyncKai). Andere Titel werden ignoriert: In deine Listen wird nichts geschrieben, und nur die Netflix-Serien-ID wird 24 Std. im Sitzungsspeicher gehalten (beim Schließen des Browsers gelöscht), damit die Suche nicht wiederholt wird.

**Disney+** (Einstellungen, optional): nur wenn du es aktivierst, fragt dein Browser nach Zugriff auf **disneyplus.com**; beim Deaktivieren wird dieser Zugriff entfernt. Auf der Disney+-Wiedergabeseite sendet SyncKai keine Anfrage: Es liest in deinem Tab nur die Antworten, die der Disney+-Player selbst für das laufende Video erhält (Serientitel, Staffel, Episodennummer, Originalsprache, Laufzeit und den Beginn des Abspanns), sowie die vom Player angezeigte Wiedergabeposition. Nichts davon wird gespeichert: Der Beginn des Abspanns dient nur in deinem Tab dazu, zu Beginn des Abspanns zu synchronisieren. Es liest weder dein Disney+-Konto noch dein Profil, deinen Disney+-Verlauf, deine Anmelde-Token oder die Adressen des Videostreams. Titel, deren Originalsprache nicht Japanisch ist, werden sofort in deinem Tab ignoriert: Nichts darüber verlässt die Seite. Bei japanischen Titeln werden nur Animes synchronisiert, die auf AniList mit Disney+ verknüpft sind, mit derselben Prüfung wie bei Netflix (Serientitel im öffentlichen Katalog von AniList gesucht, nur lesend); andere Titel werden ignoriert, und nur der Serientitel wird 24 Std. im Sitzungsspeicher gehalten (beim Schließen des Browsers gelöscht).

**Prime Video** (Einstellungen, optional): nur wenn du es aktivierst, fragt dein Browser nach Zugriff auf **primevideo.com** (die Amazon-Shopseiten werden nicht genutzt); beim Deaktivieren wird dieser Zugriff entfernt. Auf einer Prime-Video-Titelseite und ihrem Player sendet SyncKai keine Anfrage: Es liest in deinem Tab nur, was die Prime-Video-Website selbst erhält: die Daten der Titelseite (Titel, Staffel, Folgenliste, Genres, Namen der Tonspuren), die Katalogdaten, die der Player für das laufende Video erhält (Serientitel, Staffel, Episodennummer), und aus seinen Wiedergabedaten nur den Beginn des Abspanns und die Gesamtdauer; dazu die Wiedergabeposition des Videos. Nichts davon wird gespeichert: Der Beginn des Abspanns dient nur in deinem Tab dazu, zu Beginn des Abspanns zu synchronisieren. Es liest weder dein Amazon- oder Prime-Video-Konto noch dein Profil, deinen Verlauf, deine Cookies oder Anmelde-Token, die Adressen des Videostreams oder Lizenzen. Titel, die Prime Video nicht als Animation einordnet, werden sofort in deinem Tab ignoriert: Nichts darüber verlässt die Seite. Animationstitel werden im öffentlichen Katalog von AniList gesucht (nur lesend, wie bei Netflix); ein Titel, den Prime Video weder als Anime einordnet noch mit japanischer Tonspur anbietet, wird nur synchronisiert, wenn ein AniList-Anime genau denselben Titel trägt. Andere Titel werden ignoriert, und nur der Serientitel wird 24 Std. im Sitzungsspeicher gehalten (beim Schließen des Browsers gelöscht).

**Import von Crunchyroll** (Einstellungen, optional): nur wenn du ihn startest, liest SyncKai deinen Crunchyroll-Wiedergabeverlauf in deinem eigenen Crunchyroll-Tab, mit der Sitzung dieser Website. Dazu fordert es bei Crunchyroll ein temporäres Token an, mit der öffentlichen Client-ID, die die Crunchyroll-Website selbst verwendet (kein Passwort, kein Geheimnis); das Token bleibt im Tab und wird nie gespeichert. Crunchyroll zeigt diesen Zugriff in der Geräteverwaltung deines Kontos als Gerät namens „SyncKai“ an (ein einziger Eintrag, an die Sitzung deines Browsers gebunden, nicht einer pro Import); du kannst ihn dort jederzeit deaktivieren. Während der Analyse wird der reduzierte Verlauf (eine Zeile pro Staffel: Serie, zuletzt gesehene Folge, Datum) im Speicher der Erweiterung gehalten und gelöscht, sobald die Vorschau fertig ist oder wenn die Analyse abgebrochen wird oder fehlschlägt. Danach wird nur die Import-Vorschau (Serien, Folgen, geplanter Fortschritt) gespeichert; gesendet wird nur an AniList / MyAnimeList.

**Import von ADN** (Einstellungen, optional): nur wenn du ihn startest, liest SyncKai deinen ADN-Wiedergabeverlauf in deinem eigenen ADN-Tab, mit derselben Anfrage wie die ADN-Website (`gw.api.animationdigitalnetwork.com`), mithilfe des Zugriffstokens, das die Website im Speicher dieses Tabs hält (kein Passwort; das Erneuerungstoken wird nie gelesen). Das Token bleibt im Tab: Es wird nie gespeichert, protokolliert oder an den Rest der Erweiterung weitergegeben. Nur die Folgen des Verlaufs (Serie, Staffel, Folgennummer, Position, Datum) gehen an die Importseite, die sie auf eine Zeile pro Staffel reduziert; der Rest läuft wie bei Crunchyroll (reduzierter Verlauf gelöscht, sobald die Vorschau fertig ist, nur die Vorschau bleibt, gesendet wird nur an AniList / MyAnimeList).

**Import von Netflix** (Einstellungen, optional; nutzt den Netflix-Zugriff oben, den die Importseite anfragt, falls er noch nicht aktiviert ist): nur wenn du ihn startest, liest SyncKai den Wiedergabeverlauf des in deinem eigenen Netflix-Tab geöffneten Profils auf dessen Aktivitätsseite (`netflix.com/viewingactivity`). Um den ganzen Verlauf zu laden, klickt es bis zum Ende auf die Schaltfläche „Mehr anzeigen“ dieser Seite, höchstens einmal pro Sekunde; sonst wird auf der Seite nichts angeklickt (nie „Im Verlauf ausblenden“ oder „Problem melden“), und SyncKai sendet dafür keine eigene Anfrage. Nur Titel und Video-ID jeder Zeile gehen an die Importseite. Um nur Animes zu behalten, wird jeder einzelne Titel im öffentlichen Katalog von AniList gesucht (mehrere Titel pro Anfrage); Titel, die keine Animes sind, werden nur gezählt, nie aufgelistet, protokolliert oder gespeichert. Für die gefundenen Animes (AniList-Eintrag mit dieser Netflix-Serie verknüpft oder mit gleichem Titel) fragt SyncKai aus deinem Tab, mit der Sitzung dieser Website, die Metadaten der Serie mit deiner letzten Wiedergabeposition jeder Folge ab; weitergegeben werden nur Folgennummern, Laufzeiten und Positionen, nie dein Netflix-Konto, dein Profil, deine Token oder die Daten deiner Wiedergaben. Eine Folge gilt nur als gesehen, wenn ihre letzte Position das von Netflix markierte Ende (oder den Abspann) erreicht hat; ein Fortschritt geht nie zurück. Der Rest läuft wie bei Crunchyroll (reduzierter Verlauf gelöscht, sobald die Vorschau fertig ist, nur die Vorschau bleibt, gesendet wird nur an AniList / MyAnimeList).

### Von AniList und MyAnimeList gelesene Daten

Neben der Synchronisierung deiner Folgen liest SyncKai für die folgenden Funktionen deine Listen und den öffentlichen Katalog von AniList. Anfragen an den Katalog tragen dein AniList-Token, wenn du bei AniList angemeldet bist, sonst kein Token. Gesendet wird davon nur an AniList / MyAnimeList.

**Fortsetzungs-Alarme** (Einstellungen › Benachrichtigungen › Fortsetzungs-Alarme; standardmäßig aktiviert, aber sie bleiben nach dem Update auf 2.5.0 ausgeschaltet, wenn du die Folgen-Alarme ausgeschaltet hattest): einmal am Tag (oder 6 Std. nach einer fehlgeschlagenen Prüfung) und wenn du auf „Jetzt prüfen“ klickst, liest SyncKai deine ganze AniList- und/oder MyAnimeList-Liste. Die Serien, die du auf MyAnimeList abgeschlossen hast, gerade schaust oder erneut schaust und die nicht in deiner AniList-Liste sind, sucht es über ihre MyAnimeList-ID auf AniList (ganz ohne Token, wenn du nur MyAnimeList nutzt); dann liest es im öffentlichen Katalog von AniList die Beziehungen der Serien, die du abgeschlossen hast, gerade schaust oder erneut schaust, ausgeschlossene Serien ausgenommen. Eine angekündigte oder laufende Fortsetzung, die in keiner deiner Listen ist, erscheint im Popup unter „Aktivität“ und in der Seitenleiste im „Zeitplan“ (Ansicht „Angekündigt“) und, außer du hast die Browser-Benachrichtigung ausgeschaltet, in einer Benachrichtigung (eine einzige für mehrere gleichzeitig gefundene Fortsetzungen; die erste Prüfung speichert die gefundenen Fortsetzungen nur, ohne zu benachrichtigen). Ein Klick auf die Benachrichtigung einer Fortsetzung öffnet ihren AniList-Eintrag. Unter Chrome hat sie außerdem zwei Schaltflächen: „+ Geplant“ fügt die Fortsetzung auf deinen verbundenen Konten zu „Geplant“ hinzu (ein Eintrag, der schon in deiner Liste ist, wird nie geändert), und „Eintrag öffnen“ öffnet sie; sie hat keine Schaltflächen, wenn kein verbundenes Konto einen Eintrag für diese Fortsetzung hat (nur MyAnimeList, Fortsetzung noch nicht auf MyAnimeList). Firefox zeigt keine Schaltflächen.

**Vorschläge** (Seitenleiste › „Entdecken“, und das Popup, wenn „Meine Serien“ leer ist): Wenn eines davon geöffnet wird und keine in den letzten 24 Std. berechneten Vorschläge gespeichert sind, liest SyncKai dieselben Listen (mit derselben Suche der MyAnimeList-IDs auf AniList) und im öffentlichen Katalog von AniList die Empfehlungen zu den Serien, die du gut bewertet oder gesehen hast (oder, wenn es davon zu wenige gibt, die besten Serien der Saison). „+ Geplant“ fügt einen Vorschlag wie bei einer Fortsetzung zu deinen Listen hinzu. Die letzten Vorschläge werden 24 Std. lang wiederverwendet und gespeichert, bis sie neu berechnet werden oder du dich abmeldest; die Vorschläge, die du abgelehnt hast („Kein Interesse“, höchstens 500), werden gespeichert und in die Sicherungsdatei aufgenommen, und unter Einstellungen › Meine Daten kannst du sie wieder anzeigen. Der Bereich „Im gleichen Geist“ der Seitenleiste zeigt die AniList-Empfehlungen des unter „Läuft gerade“ angezeigten Eintrags, ohne die Serien, die schon in deinen Listen sind (gelesen wie bei der Schaureihenfolge), und ohne die, die du abgelehnt hast.

**Schaureihenfolge** (Seitenleiste › „Läuft gerade“): Um die Franchise der angezeigten Serie in der Reihenfolge der Veröffentlichung aufzulisten, liest SyncKai ihre Beziehungen im öffentlichen Katalog von AniList, 24 Std. im Sitzungsspeicher gehalten (beim Schließen des Browsers gelöscht). Um abzuhaken, was du gesehen hast, liest es deinen Status und Fortschritt für diese Einträge: bei AniList nur für diese Einträge, bei MyAnimeList mit deiner ganzen Liste, höchstens 5 Minuten im Arbeitsspeicher der Erweiterung gehalten. Deine Status werden nicht gespeichert.

**Freunde auf AniList** (Karte „Auf dieser Seite“ im Popup und „Läuft gerade“ in der Seitenleiste, nur mit AniList-Konto): SyncKai fragt AniList, welche der Personen, denen du folgst, die angezeigte Serie in ihrer Liste haben, mit Name, Avatar, Status, Fortschritt und Bewertung, um sie mit ihrer Durchschnittsbewertung anzuzeigen. Die Antwort wird höchstens 10 Minuten im Arbeitsspeicher der Erweiterung gehalten: Sie wird nie gespeichert und nie in die Sicherungsdatei oder den Diagnosebericht aufgenommen.

### Gespeicherte Daten

**Lokal** auf deinem Gerät gespeichert, im Erweiterungsspeicher (`chrome.storage.local`):

- deine Einstellungen (Auslöser, Benachrichtigungen, bevorzugter Player, Sprache…);
- gespeicherte Zuordnungen zwischen Serien und AniList-/MAL-Einträgen, ausgeschlossene Serien;
- die Links zu den Serienseiten, die du auf den Streaming-Seiten angesehen oder besucht hast, um sie aus der Liste „Schaue ich“ zu öffnen;
- Verlauf der letzten Synchronisierungen, zu prüfende Episoden, zu bewertende Serien, abgelehnte Rewatches;
- die Warteschlange ausstehender Synchronisierungen (Offline-Wiederholung);
- der letzte Vergleich AniList ↔ MyAnimeList und die Vorschau des Verlaufsimports (Crunchyroll, ADN oder Netflix);
- die von den Fortsetzungs-Alarmen gefundenen Fortsetzungen (AniList-Eintrag, Titel, Cover, Daten, die Serie, auf die sie folgen) mit ihrem Zustand (neu, gesehen, ausgeblendet), die IDs der bereits gefundenen Fortsetzungen und das Ergebnis der letzten Prüfung;
- die letzten Vorschläge (höchstens 60 AniList-Einträge, mit den Serien deiner Liste, aus denen sie stammen, und deinen Bewertungen dafür), bis sie neu berechnet werden oder du dich abmeldest, und die Vorschläge, die du abgelehnt hast;
- die Serien, die du außerhalb der Gruppe „Ruhende Serien“ von „Meine Serien“ behalten hast („Behalten“);
- Caches (Liste „Schaue ich“, Profil mit seinen Statistiken: Anzahl der Anime, Folgen und Tage, Ausstrahlungsplan) sowie die Zahl der diese Woche zu jedem Konto synchronisierten Folgen;
- die letzten 50 technischen Fehler (ohne Tokens und Kontonamen) zur Fehlerdiagnose: Sie verlassen den Browser nie, außer du kopierst selbst den Diagnosebericht (Einstellungen › Hilfe & Info).

Einige kurzlebige Caches werden im Arbeitsspeicher gehalten, im Sitzungsspeicher der Erweiterung (`chrome.storage.session`): der für die aktuelle Seite angezeigte Eintrag, die Daten der Seitenleiste (AniList-Eintrag der Folge, Fortsetzungen), die Schaureihenfolge der angezeigten Franchises (24 Std.) und die als Nicht-Anime erkannten Netflix-, Disney+- und Prime-Video-Serien. Sie werden nie auf die Festplatte geschrieben: veraltete Einträge werden laufend entfernt, der Eintrag der aktuellen Seite, die Daten der Seitenleiste und die Schaureihenfolgen sofort beim Abmelden eines Kontos gelöscht, der Rest beim Schließen des Browsers.

### AniList- und MyAnimeList-Konten

- Die Anmeldung erfolgt über das offizielle Autorisierungsfenster von AniList bzw. MyAnimeList (`chrome.identity`). SyncKai sieht dein Passwort nie.
- Zugriffstoken (OAuth) werden lokal **verschlüsselt** gespeichert (AES-GCM, mit einem nicht exportierbaren Schlüssel der Erweiterung, den Webseiten nicht lesen können) und **nur** verwendet, um die API des jeweiligen Dienstes aufzurufen (Liste lesen, Serien hinzufügen oder entfernen, Fortschritt, Status, Bewertung, Rewatch oder Kommentar aktualisieren; bei AniList auch die Einträge der Personen lesen, denen du folgst).
- MyAnimeList nutzt den OAuth2-Ablauf mit **PKCE**, ohne in der Erweiterung eingebettetes Client-Secret.

### Netzwerkverbindungen

SyncKai kontaktiert nur diese Hosts:

| Host | Zweck |
| --- | --- |
| `graphql.anilist.co` | AniList-API: Eintragssuche, Liste, Aktualisierungen, Ausstrahlungsplan, Fortsetzungen, Schaureihenfolge, Vorschläge, Personen, denen du folgst |
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

- **Abmelden** eines Kontos unter Einstellungen › Konten löscht dessen Token, dessen Profil und die Serien, die du für dieses Konto außerhalb von „Ruhende Serien“ behalten hast, sowie den Vergleich AniList ↔ MyAnimeList, die Daten des Verlaufsimports, die gefundenen Fortsetzungen und die letzten Vorschläge; beim Abmelden des letzten Kontos werden auch Verlauf, Prüfungen, die abgelehnten Vorschläge, Warteschlange und die Caches in `chrome.storage.local` gelöscht. Jedes Abmelden löscht außerdem den Eintrag der aktuellen Seite, die Daten der Seitenleiste und die Schaureihenfolgen in `chrome.storage.session`.
- Einstellungen › Synchronisierung › Zuordnungen › „Alles zurücksetzen“ löscht die gespeicherten Zuordnungen.
- **Deinstallieren der Erweiterung** löscht alle gespeicherten Daten.
- Auf AniList oder MyAnimeList gespeicherte Daten (deine Liste) verwaltest du direkt bei diesen Diensten.

### Kontakt

Fragen oder Anfragen: [GitHub Issues](https://github.com/Sync-Kai/SyncKai/issues).
