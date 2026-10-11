# Politique de confidentialité · Privacy Policy · Datenschutzerklärung

**SyncKai** · Date d’effet / Effective date / Gültig ab : **2026-10-10**

- [Français](#français)
- [English](#english)
- [Deutsch](#deutsch)

---

## Français

### En bref

SyncKai n’a **aucun serveur**. Tes données restent dans ton navigateur et ne sont envoyées qu’à AniList et/ou MyAnimeList, uniquement pour mettre ta liste à jour. Aucune statistique d’usage, aucune publicité, aucune revente ni aucun partage.

### Données lues sur les pages

Le content script s’exécute uniquement sur **crunchyroll.com** et **animationdigitalnetwork.com** (et sur **netflix.com** si tu l’actives, voir plus bas). Sur une page d’épisode, il lit :

- le titre de la série, la saison et le numéro d’épisode ;
- la position et la durée de lecture de la vidéo (pour détecter la fin de l’épisode).

Il ne lit ni tes identifiants Crunchyroll/ADN, ni ton historique de navigation.

**Netflix** (Réglages, facultatif) : seulement si tu l’actives, ton navigateur te demande l’accès à **netflix.com** ; le désactiver retire cet accès. Sur la page de lecture Netflix, SyncKai lit les mêmes informations (titre de la série, saison, numéro d’épisode, début du générique) en interrogeant, depuis ton onglet et avec la session de ce site, les métadonnées de la vidéo en cours, ainsi que la position de lecture. Il ne lit ni ton compte, ni ton profil, ni ton historique Netflix, et rien n’est envoyé à quiconque d’autre qu’AniList / MyAnimeList. Seuls les animes liés à Netflix sur AniList sont synchronisés : pour le vérifier, le titre de la série est recherché dans le catalogue public d’AniList (sans ton compte). Les autres titres sont ignorés : rien n’est écrit dans tes listes, et seul l’identifiant Netflix de la série est retenu 24 h en mémoire de session (effacé à la fermeture du navigateur) pour ne pas refaire la recherche.

**Import depuis Crunchyroll** (Réglages, facultatif) : seulement quand tu le lances, SyncKai lit ton historique de visionnage Crunchyroll dans ton propre onglet Crunchyroll, avec la session de ce site. Rien n’est conservé hormis l’aperçu de l’import (séries, épisodes, progression prévue) ; rien n’est envoyé à quiconque d’autre qu’AniList / MyAnimeList. Le jeton temporaire de Crunchyroll reste dans l’onglet et n’est jamais enregistré.

### Données stockées

Sont enregistrés **localement** sur ton appareil, dans le stockage de l’extension (`chrome.storage.local`) :

- tes réglages (déclenchement, notifications, lecteur préféré, langue…) ;
- les correspondances mémorisées entre séries et fiches AniList/MAL, les séries exclues ;
- l’historique des dernières synchros, les épisodes à vérifier, les séries à noter, les refus de revisionnage ;
- la file des synchros en attente (nouvel essai hors ligne) ;
- des caches (liste « En cours », profil, calendrier des sorties) ;
- les 50 dernières erreurs techniques (sans jetons ni noms de compte), pour aider à diagnostiquer un problème : elles ne quittent jamais le navigateur, sauf si tu copies toi-même le rapport de diagnostic (Réglages › Aide).

Quelques caches de courte durée sont gardés en mémoire, dans le stockage de session de l’extension (`chrome.storage.session`) : la fiche affichée pour la page en cours, les données du panneau latéral (fiche AniList de l’épisode, suites) et les séries Netflix reconnues comme non-animes. Ils ne sont jamais écrits sur le disque et sont effacés à la fermeture du navigateur.

### Comptes AniList et MyAnimeList

- La connexion passe par la fenêtre d’authentification officielle d’AniList ou de MyAnimeList (`chrome.identity`). SyncKai ne voit jamais ton mot de passe.
- Les jetons d’accès (tokens OAuth) sont stockés localement et servent **uniquement** à appeler l’API du service concerné (lire ta liste, mettre à jour ta progression, ta note ou ton revisionnage).
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
| `www.netflix.com` | Métadonnées de l’épisode en cours (titre, saison, numéro), uniquement si Netflix est activé, depuis ton onglet Netflix |

Le popup et le panneau latéral affichent aussi les images (couvertures, bannières) et l’avatar fournis par AniList et MyAnimeList, chargés depuis leurs serveurs d’images.

### Sauvegarde (export / import)

Le fichier d’export est un fichier JSON téléchargé sur ton appareil. Il n’est envoyé nulle part et ne contient **jamais** tes jetons ni tes connexions AniList/MAL.

### Supprimer tes données

- **Déconnecter** un compte dans Réglages › Comptes supprime son jeton et son profil ; à la déconnexion du dernier compte, l’historique, les vérifications, la file d’attente et les caches de `chrome.storage.local` sont effacés (ceux de la session le sont à la fermeture du navigateur).
- Réglages › Correspondances › « Tout réinitialiser » efface les correspondances.
- **Désinstaller l’extension** supprime toutes les données stockées.
- Les données enregistrées sur AniList ou MyAnimeList (ta liste) se gèrent directement sur ces services.

### Contact

Questions ou demandes : [GitHub Issues](https://github.com/Sync-Kai/SyncKai/issues).

---

## English

### In short

SyncKai has **no server**. Your data stays in your browser and is only sent to AniList and/or MyAnimeList, solely to update your list. No analytics, no ads, no selling or sharing.

### Data read from pages

The content script runs only on **crunchyroll.com** and **animationdigitalnetwork.com** (and on **netflix.com** if you turn it on, see below). On an episode page, it reads:

- the series title, season and episode number;
- the video playback position and duration (to detect the end of the episode).

It does not read your Crunchyroll/ADN credentials or your browsing history.

**Netflix** (Settings, optional): only if you turn it on, your browser asks you for access to **netflix.com**; turning it off removes that access. On the Netflix player page, SyncKai reads the same information (series title, season, episode number, credits start) by requesting the current video’s metadata from your tab, using that site’s session, plus the playback position. It does not read your Netflix account, profile or viewing history, and nothing is sent to anyone but AniList / MyAnimeList. Only anime linked to Netflix on AniList are synced: to check this, the series title is looked up in AniList’s public catalog (without your account). Other titles are ignored: nothing is written to your lists, and only the Netflix series ID is kept for 24 h in session memory (cleared when the browser closes) to avoid searching again.

**Import from Crunchyroll** (Settings, optional): only when you start it, SyncKai reads your Crunchyroll watch history in your own Crunchyroll tab, using that site’s session. Nothing is kept except the import preview (series, episodes, planned progress); nothing is sent to anyone but AniList / MyAnimeList. Crunchyroll’s temporary token stays in the tab and is never saved.

### Stored data

Stored **locally** on your device, in the extension storage (`chrome.storage.local`):

- your settings (trigger, notifications, preferred player, language…);
- remembered matches between series and AniList/MAL entries, excluded series;
- recent sync history, episodes to review, series to rate, declined rewatches;
- the queue of pending syncs (offline retry);
- caches (“Watching” list, profile, airing schedule);
- the last 50 technical errors (without tokens or account names), to help diagnose problems: they never leave your browser unless you copy the diagnostic report yourself (Settings › Help).

A few short-lived caches are kept in memory, in the extension’s session storage (`chrome.storage.session`): the entry shown for the current page, the side panel data (the episode’s AniList entry, sequels) and the Netflix series recognized as not anime. They are never written to disk and are cleared when the browser closes.

### AniList and MyAnimeList accounts

- Sign-in uses the official AniList or MyAnimeList authorization window (`chrome.identity`). SyncKai never sees your password.
- Access tokens (OAuth) are stored locally and used **only** to call the corresponding service’s API (read your list, update your progress, score or rewatch).
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
| `www.netflix.com` | Current episode metadata (title, season, number), only if Netflix is turned on, from your Netflix tab |

The popup and the side panel also display images (covers, banners) and avatars provided by AniList and MyAnimeList, loaded from their image servers.

### Backup (export / import)

The export file is a JSON file downloaded to your device. It is not sent anywhere and **never** contains your tokens or AniList/MAL connections.

### Deleting your data

- **Log out** of an account in Settings › Accounts to delete its token and profile; logging out of the last account also clears history, reviews, the pending queue and the `chrome.storage.local` caches (session caches are cleared when the browser closes).
- Settings › Matches › “Reset all” clears the remembered matches.
- **Uninstalling the extension** deletes all stored data.
- Data saved on AniList or MyAnimeList (your list) is managed directly on those services.

### Contact

Questions or requests: [GitHub Issues](https://github.com/Sync-Kai/SyncKai/issues).

---

## Deutsch

### Kurz gesagt

SyncKai hat **keinen eigenen Server**. Deine Daten bleiben in deinem Browser und werden nur an AniList und/oder MyAnimeList gesendet, ausschließlich um deine Liste zu aktualisieren. Keine Analyse, keine Werbung, kein Verkauf und keine Weitergabe.

### Von Seiten gelesene Daten

Das Content-Script läuft nur auf **crunchyroll.com** und **animationdigitalnetwork.com** (und auf **netflix.com**, wenn du es aktivierst, siehe unten). Auf einer Episodenseite liest es:

- den Serientitel, die Staffel und die Episodennummer;
- die Wiedergabeposition und Dauer des Videos (um das Ende der Episode zu erkennen).

Es liest weder deine Crunchyroll-/ADN-Zugangsdaten noch deinen Browserverlauf.

**Netflix** (Einstellungen, optional): nur wenn du es aktivierst, fragt dein Browser nach Zugriff auf **netflix.com**; beim Deaktivieren wird dieser Zugriff entfernt. Auf der Netflix-Wiedergabeseite liest SyncKai dieselben Informationen (Serientitel, Staffel, Episodennummer, Beginn des Abspanns), indem es aus deinem Tab, mit der Sitzung dieser Website, die Metadaten des laufenden Videos abfragt, sowie die Wiedergabeposition. Es liest weder dein Netflix-Konto noch dein Profil oder deinen Netflix-Verlauf, und gesendet wird nur an AniList / MyAnimeList. Synchronisiert werden nur Animes, die auf AniList mit Netflix verknüpft sind: zur Prüfung wird der Serientitel im öffentlichen Katalog von AniList gesucht (ohne dein Konto). Andere Titel werden ignoriert: In deine Listen wird nichts geschrieben, und nur die Netflix-Serien-ID wird 24 Std. im Sitzungsspeicher gehalten (beim Schließen des Browsers gelöscht), damit die Suche nicht wiederholt wird.

**Import von Crunchyroll** (Einstellungen, optional): nur wenn du ihn startest, liest SyncKai deinen Crunchyroll-Wiedergabeverlauf in deinem eigenen Crunchyroll-Tab, mit der Sitzung dieser Website. Gespeichert wird nur die Import-Vorschau (Serien, Folgen, geplanter Fortschritt); gesendet wird nur an AniList / MyAnimeList. Das temporäre Crunchyroll-Token bleibt im Tab und wird nie gespeichert.

### Gespeicherte Daten

**Lokal** auf deinem Gerät gespeichert, im Erweiterungsspeicher (`chrome.storage.local`):

- deine Einstellungen (Auslöser, Benachrichtigungen, bevorzugter Player, Sprache…);
- gespeicherte Zuordnungen zwischen Serien und AniList-/MAL-Einträgen, ausgeschlossene Serien;
- Verlauf der letzten Synchronisierungen, zu prüfende Episoden, zu bewertende Serien, abgelehnte Rewatches;
- die Warteschlange ausstehender Synchronisierungen (Offline-Wiederholung);
- Caches (Liste „Schaue ich“, Profil, Ausstrahlungsplan);
- die letzten 50 technischen Fehler (ohne Tokens und Kontonamen) zur Fehlerdiagnose: Sie verlassen den Browser nie, außer du kopierst selbst den Diagnosebericht (Einstellungen › Hilfe).

Einige kurzlebige Caches werden im Arbeitsspeicher gehalten, im Sitzungsspeicher der Erweiterung (`chrome.storage.session`): der für die aktuelle Seite angezeigte Eintrag, die Daten der Seitenleiste (AniList-Eintrag der Folge, Fortsetzungen) und die als Nicht-Anime erkannten Netflix-Serien. Sie werden nie auf die Festplatte geschrieben und beim Schließen des Browsers gelöscht.

### AniList- und MyAnimeList-Konten

- Die Anmeldung erfolgt über das offizielle Autorisierungsfenster von AniList bzw. MyAnimeList (`chrome.identity`). SyncKai sieht dein Passwort nie.
- Zugriffstoken (OAuth) werden lokal gespeichert und **nur** verwendet, um die API des jeweiligen Dienstes aufzurufen (Liste lesen, Fortschritt, Bewertung oder Rewatch aktualisieren).
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
| `www.netflix.com` | Metadaten der aktuellen Episode (Titel, Staffel, Nummer), nur wenn Netflix aktiviert ist, aus deinem Netflix-Tab |

Das Popup und die Seitenleiste zeigen außerdem Bilder (Cover, Banner) und Avatare von AniList und MyAnimeList an, die von deren Bildservern geladen werden.

### Sicherung (Export / Import)

Die Exportdatei ist eine JSON-Datei, die auf dein Gerät heruntergeladen wird. Sie wird nirgendwohin gesendet und enthält **niemals** deine Token oder AniList-/MAL-Verbindungen.

### Daten löschen

- **Abmelden** eines Kontos unter Einstellungen › Konten löscht dessen Token und Profil; beim Abmelden des letzten Kontos werden auch Verlauf, Prüfungen, Warteschlange und die Caches in `chrome.storage.local` gelöscht (die Sitzungs-Caches beim Schließen des Browsers).
- Einstellungen › Zuordnungen › „Alles zurücksetzen“ löscht die Zuordnungen.
- **Deinstallieren der Erweiterung** löscht alle gespeicherten Daten.
- Auf AniList oder MyAnimeList gespeicherte Daten (deine Liste) verwaltest du direkt bei diesen Diensten.

### Kontakt

Fragen oder Anfragen: [GitHub Issues](https://github.com/Sync-Kai/SyncKai/issues).
