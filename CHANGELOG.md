# Changelog

Toutes les évolutions notables de SyncKai sont documentées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions selon [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

### Modifié

- La file des synchros en attente, les cartes *À noter*, les dernières synchros et les corrections sont liées au compte connecté au moment de leur création : elles ne valent plus que pour lui. À la mise à jour, celles qui existent déjà sont rattachées au compte connecté ; une sauvegarde importée les rattache au compte connecté à l’import.
- Après une déconnexion, même suivie d’une reconnexion au même compte, les synchros en attente, notes et corrections créées avant ne sont plus écrites sur ce service.
- La saison choisie dans le sélecteur du panneau ou du popup, sur une page de lecture, est mémorisée comme correspondance de la saison : la fin de l’épisode (et des suivants) est synchronisée sur cette fiche. Pour revenir au choix automatique : *Oublier* dans Réglages › Mes données. Si l’épisode n’existe pas dans la saison choisie, la carte le signale et rien n’est mémorisé.
- Popup et panneau partagent la même fiche « Sur cette page » : mêmes états et mêmes messages sur une même page, la carte du popup se met à jour quand une synchro réécrit la fiche de l’onglet, et une relecture en échec garde la fiche affichée avec l’erreur en retour d’action.
- Accessibilité : un bouton dont l’action est en cours (*+1*, *Réessayer*, *Garder AniList*, *Analyser*, *Se connecter*, *Copier le rapport*, *Enregistrer*…) reste sélectionnable au clavier et est annoncé « indisponible » par les lecteurs d’écran, au lieu d’être désactivé ; un second appui est sans effet.
- Accessibilité : les messages d’erreur sont annoncés par une zone unique de la page, une seule fois tant qu’ils restent affichés ; les résultats série par série de l’import Crunchyroll et de l’alignement AniList ↔ MAL ne sont plus lus à voix haute (le bilan l’est).

### Corrigé

- Les synchros en attente, les cartes *À noter* et *Corriger* d’un compte ne sont plus rejouées sur un autre compte : après une déconnexion (ou un accès révoqué) puis la connexion d’un autre compte AniList ou MyAnimeList, rien de l’ancien compte n’est écrit sur le nouveau, et la part du service déconnecté est retirée de la file.
- Accès révoqué sur AniList ou MyAnimeList alors qu’aucun autre service n’est connecté : tes vérifications, synchros en attente, notes, liens de séries et agenda sont effacés comme après une déconnexion.
- Se déconnecter de MyAnimeList quand le token AniList a seulement expiré (*Reconnecter*) n’efface plus tes vérifications, synchros en attente, notes, liens de séries ni l’agenda.
- *Reconnecter* AniList après l’expiration du token : le profil, la liste *En cours*, la dernière comparaison et l’aperçu d’import de l’ancien compte sont effacés avant la nouvelle connexion.
- Import de l’historique Crunchyroll : un changement de compte pendant l’analyse ou l’application (pendant une attente de quota, par exemple) arrête l’import sans rien écrire sur le nouveau compte, et l’aperçu de l’ancien compte n’est plus recréé.
- Import de l’historique Crunchyroll : une brève coupure réseau, une limite de requêtes ou une erreur passagère de Crunchyroll pendant la lecture ne fait plus perdre toute la lecture. La requête est renvoyée après une courte attente (celle demandée par Crunchyroll si elle est indiquée), et une saison dont la numérotation reste illisible passe *À vérifier* au lieu d’arrêter la lecture.
- Import de l’historique Crunchyroll : une réponse inattendue de Crunchyroll à la demande d’accès affiche *Import indisponible* au lieu de demander à un utilisateur déjà connecté de se connecter à Crunchyroll.
- Import de l’historique Crunchyroll : une série écrite sur AniList alors que MyAnimeList était momentanément indisponible n’est plus comptée en échec. Seul MyAnimeList est retenté, la série est comptée *mise à jour* et sa correspondance est retenue pour la synchro en direct.
- Une analyse ou un import Crunchyroll, ou un alignement AniList ↔ MAL, en cours pendant une mise à jour de l’extension reprend tout seul, au lieu de rester sur *Reprise…* jusqu’au redémarrage du navigateur.
- Import de l’historique Crunchyroll : l’historique réduit n’est plus conservé après un arrêt ou un échec de l’analyse, comme l’annonce la politique de confidentialité ; celui laissé par une version précédente est effacé à la mise à jour.
- Import de l’historique Crunchyroll : un gros historique (des centaines de saisons) s’analyse et s’applique bien plus légèrement. L’historique et l’aperçu ne sont plus relus et réécrits en entier à chaque saison, et la page d’import se met à jour par lots.
- Page d’import Crunchyroll : les blocs *Déjà à jour* et *À vérifier* restent ouverts ou repliés comme tu les as laissés, au lieu de changer à chaque série traitée.
- Se déconnecter de MyAnimeList pendant un renouvellement de session (popup ouvert, synchro en cours) ne reconnecte plus le compte quelques secondes plus tard : le token renouvelé est abandonné.
- Une reconnexion à AniList ou MyAnimeList juste après un accès refusé n’est plus effacée par la réponse tardive d’une requête partie avec l’ancien token : la requête repart avec le nouveau.
- Plusieurs requêtes MyAnimeList refusées en même temps ne renouvellent plus la session une fois chacune : un seul renouvellement, que les autres réutilisent (moins de déconnexions intempestives).
- Après une déconnexion pendant un chargement, le profil, la dernière comparaison AniList ↔ MAL et la semaine d’agenda de l’ancien compte ne sont plus réenregistrés ; le compte suivant ne voit plus la liste *En cours* de l’ancien.
- Déconnexion du dernier compte : les alertes de sortie déjà envoyées, leurs séries et la date de la dernière vérification sont effacées, et une vérification en cours n’envoie plus de notification pour le compte déconnecté.
- Accès révoqué sur AniList, ou session MyAnimeList impossible à renouveler, pendant une synchro en arrière-plan : le popup, le panneau et les réglages affichent *Session expirée* en rouge avec *Reconnecter*, au lieu de *Non connecté*.
- MyAnimeList qui ne répond pas au renouvellement de la session : abandon après 20 secondes avec le message *délai dépassé*, au lieu de bloquer sans fin les synchros MyAnimeList, la liste *En cours*, l’alignement et l’import.
- Trop de requêtes (erreur 429) au renouvellement de la session MyAnimeList : la session est gardée, et l’alignement ou l’import Crunchyroll fait une pause puis réessaie au lieu de marquer la série en échec.
- Réponse d’AniList ou de MyAnimeList trop lente à arriver (connexion faible, longue liste) : message *délai dépassé* au lieu de *réponse inattendue*, et les tâches de fond réessaient.
- Première connexion à MyAnimeList refusée à la dernière étape (code expiré, URL de redirection de l’app différente) : le message en donne la cause et rappelle l’URL de redirection attendue, au lieu de *Session MyAnimeList expirée*.
- Alertes de sortie : la liste *En cours* est rechargée par la vérification horaire dès qu’elle a plus de 12 heures, même si tu n’ouvres jamais le popup. Une série ajoutée depuis un autre appareil reçoit ses alertes, une série terminée ou abandonnée n’en reçoit plus, et un épisode que SyncKai vient de synchroniser n’est plus annoncé comme sorti.
- Alertes de sortie : une notification que le navigateur n’a pas pu afficher est retentée à la vérification suivante au lieu d’être perdue, et les autres notifications de la même vérification s’affichent quand même.
- Alertes de sortie : baisser le délai d’alerte (de 6 h à 0 h, par exemple) ne fait plus sauter les épisodes sortis entre-temps.
- Alertes de sortie et agenda : avec beaucoup de séries à diffusion quotidienne, les sorties les plus récentes de la semaine ne sont plus perdues. Les alertes les relisent à part, et le panneau recharge une semaine restée incomplète.
- Une série exclue depuis la page de lecture avant que SyncKai ait trouvé sa fiche n’apparaît plus dans l’agenda ni dans les alertes de sortie.
- Ouvrir le popup ou le panneau plusieurs fois de suite ne recharge plus à chaque fois le profil (relu au plus toutes les 6 heures) ni la liste *En cours* (gardée 90 secondes si aucune synchro n’a eu lieu entre-temps) : moins de requêtes, et moins de pauses *limite de requêtes* pendant un alignement ou un import. *Réessayer* et chaque synchro relisent toujours la liste.
- Sauvegarde importée : une correspondance suspecte (fiche AniList invalide, décalage d’épisodes absurde, saison mal formée) est refusée et comptée parmi les éléments ignorés. Les correspondances importées sont revérifiées sur le catalogue AniList à leur premier usage : une fiche introuvable ou un épisode hors de la fiche relance la recherche au lieu d’envoyer une progression fausse.
- Une correspondance enregistrée par une autre version de SyncKai, illisible par celle-ci, n’est plus effacée quand une autre saison est apprise, oubliée ou importée.
- *Ignorer* une carte *À noter* dans le popup au moment où une autre série se termine ne fait plus disparaître la nouvelle carte, et une carte n’est plus visible d’un côté et invisible de l’autre (popup et synchro).
- Agenda : *Ajuster l’heure* sur une série alors que 200 délais sont déjà réglés garde ce réglage ; c’est le délai réglé il y a le plus longtemps qui part, et non celui de la série au plus petit identifiant AniList. Les délais existants sont tous conservés à la mise à jour.
- Page d’import Crunchyroll : *Recommencer* n’efface plus une analyse lancée entre-temps depuis un autre onglet.
- La fiche de la page en cours (avec l’état de tes listes) et les données du panneau latéral sont effacées dès la déconnexion d’un compte, au lieu de rester visibles jusqu’à 10 minutes. Celles des onglets fermés ou expirées sont retirées au fil de l’eau au lieu de s’accumuler jusqu’à la fermeture du navigateur.
- Le service worker n’est plus réveillé par les mises en cache du popup et du panneau.

- Une préquelle ou une suite publiée comme une autre série sur la plateforme (Naruto pour Naruto Shippuden, Bleach pour Bleach TYBW…) n’est plus comptée comme une saison de la série regardée : la progression n’est plus écrite sur la fiche de la série précédente.
- Film Netflix : la fiche AniList liée au film l’emporte sur une série TV au même titre ; une fiche trouvée par son seul titre passe par une carte *À vérifier*.
- Les correspondances Netflix enregistrées par la 2.1.0 sont oubliées à la mise à jour et se recalculent toutes seules au prochain épisode.
- Si tu regardes une suite publiée à part sur Crunchyroll (Naruto Shippuden, Bleach TYBW…), vérifie dans AniList et MAL que la série précédente n’a pas reçu ta progression, et utilise *Réglages › Mes données › Correspondances › Oublier* si une correspondance est fausse.
- Écarts AniList ↔ MAL : « Garder AniList », « Garder MAL » et « Tout aligner » relisent les deux listes juste avant d’écrire. Une série modifiée depuis l’analyse (épisode regardé, +1/−1, statut, note, autre appareil) est ignorée avec le message *Modifiée depuis l’analyse* au lieu d’être réécrite avec d’anciennes valeurs : l’alignement ne fait plus reculer la progression ni le statut.
- Après une synchro ou un contrôle sur une série, son écart affiché dans Activité est marqué *Modifiée depuis l’analyse* et ne peut plus être aligné avant une nouvelle analyse.
- Les écritures simultanées sur une même série passent l’une après l’autre (synchro en direct, nouvelle tentative d’une synchro en attente, +1/−1, statut, note, revisionnage, import Crunchyroll, alignement AniList ↔ MAL) : deux +1 cliqués en même temps depuis le panneau et le popup comptent bien pour deux, et un ancien épisode renvoyé au retour de la connexion ou par l’import ne fait plus reculer la progression.
- +1 / −1 n’ajoutent plus la série à l’épisode 1 sur le service où elle est absente de ta liste : ce service est laissé tel quel et le retour l’indique (*Ép. 8 vu · absente de MyAnimeList*). L’ajout reste réservé aux boutons *Ajouter*.
- +1 / −1 réussi sur un service et en échec sur l’autre : un bouton *Réessayer* écrit le même épisode sur le seul service en échec, au lieu de recliquer +1 et de décaler celui qui avait réussi.
- +1 sur le dernier épisode d’un revisionnage le termine comme la synchro automatique : *Terminé* avec un revisionnage de plus sur AniList, et MyAnimeList quitte *Re-watching* avec son compteur incrémenté. Les séries laissées en *Re-watching* sur MyAnimeList par l’ancien comportement sont à corriger à la main sur MyAnimeList.
- *Corriger* une synchro sur une série en revisionnage la laisse en revisionnage (et le termine, compteur compris, au dernier épisode) ; MyAnimeList reçoit toujours l’état du revisionnage explicitement.
- La carte *À noter* reste dans Activité tant qu’un service n’a pas enregistré la note (MyAnimeList hors ligne, par exemple) ou si la série n’est dans aucune de tes listes : la note peut être renvoyée plus tard, ou la carte ignorée.
- Carte *À vérifier* validée alors que MyAnimeList (ou AniList) est momentanément indisponible : l’épisode est mis en attente et renvoyé automatiquement à ce service, au lieu d’être perdu.
- *Corriger* : l’épisode suivant de la même saison ne fait plus disparaître la carte de correction et n’est plus écrit sur la fiche contestée ; il est signalé *À vérifier* tant que la correction n’est pas validée ou ignorée.
- *Corriger* ne fait plus reculer une série dont la progression a changé depuis la synchro (épisode suivant, autre appareil) : la correction est refusée avec un message, et une série terminée entre-temps reste terminée.
- Les corrections importées depuis une sauvegarde deviennent de simples vérifications : elles ne peuvent plus faire reculer la progression ni repasser une série terminée en cours.
- Plus de bulle *Noter* en fin de série si la série a déjà une note sur AniList ou MyAnimeList, à la fin d’un revisionnage, ni quand seule la fiche MyAnimeList, découpée plus court, se termine.
- Une saison mise en correspondance pendant sa diffusion (nombre d’épisodes encore inconnu) n’est plus bloquée quand AniList publie la suite dans une fiche séparée (*Part 2*) : les épisodes suivants vont sur la bonne fiche au lieu d’être ignorés.
- Une fiche introuvable (supprimée ou fusionnée sur AniList, absente de MyAnimeList) n’est plus renvoyée en boucle pendant 24 h : l’erreur est affichée tout de suite, et une correspondance vers une fiche AniList supprimée est oubliée puis recalculée.
- Panneau latéral, *En lecture* : la fiche ne reste plus bloquée sur le chargement, ni grisée avec ses boutons désactivés, quand l’onglet finit de se charger pendant la recherche de la fiche (panneau ouvert sur un épisode qui démarre, épisode suivant, après un +1).
- Panneau latéral : une action (+1/−1, statut, note) qui se termine après un changement d’onglet ou d’épisode n’affiche plus la fiche de la page quittée ni son retour sur la nouvelle page.
- Agenda du panneau : une erreur de chargement (AniList saturé, réseau) reste affichée avec *Réessayer* au lieu de disparaître au rafraîchissement suivant du panneau, et la même semaine n’est plus demandée deux fois de suite.
- Netflix désactivé (dans les Réglages, `chrome://extensions` ou `about:addons`) : un onglet Netflix resté ouvert ne synchronise plus rien, même sans être rechargé, et le popup comme le panneau y affichent *Netflix est désactivé*.
- Netflix désactivé hors des Réglages, ou sauvegarde importée sur un navigateur où Netflix n’est pas activé : le lecteur préféré *Netflix* repasse sur Crunchyroll, et les boutons *Ouvrir*, l’agenda et les notifications de nouvel épisode n’ouvrent plus Netflix.
- Crunchyroll, lecture automatique (One Piece E1180 puis E1181, par exemple) : le nouvel épisode n’est plus identifié avec le titre et le numéro du précédent quand la page tarde à se mettre à jour. Le popup et le panneau affichent le bon épisode, et c’est lui qui est synchronisé.
- SyncKai ne modifie plus la langue déclarée par les pages Crunchyroll, ADN et Netflix. Chrome ne propose plus de traduire la page à tort, les lecteurs d’écran gardent la bonne langue, et l’import de l’historique Crunchyroll récupère les titres dans la langue de ton compte Crunchyroll (espagnol, par exemple) même si SyncKai est dans une autre langue.
- Les onglets Crunchyroll, ADN et Netflix ne reçoivent plus chaque écriture des données de SyncKai (import, alignement, journal) : moins de travail en arrière-plan pendant la lecture. Un changement de langue de SyncKai s’applique aux messages de la page sans la recharger, au plus tard à l’épisode suivant.
- Clavier : après *+1*, *Réessayer*, *Oublier*, *Réactiver*, *Ignorer* ou *Fermer* sur une vérification, le focus reste sur le bouton ou passe à l’élément voisin (ou au titre de la section) au lieu de repartir du haut du popup ; même chose sur le lien *Ouvrir* d’une série quand la liste se met à jour.
- Lecteurs d’écran (NVDA, VoiceOver, Narrateur) : le bandeau *Pas d’accès à Crunchyroll / ADN* et les messages d’erreur du popup, du panneau et des pages d’import ne sont plus relus à chaque mise à jour de l’affichage, ni chaque minute.
- Pause d’un alignement AniList ↔ MAL ou d’un import Crunchyroll : seul le compte à rebours change chaque seconde ; le popup et la page d’import ne sont plus redessinés en entier (le survol et le focus clavier ne sautent plus), et les mises à jour simultanées du popup sont regroupées en un seul affichage.

## [2.1.0] - 2026-10-10

Netflix rejoint Crunchyroll et ADN, en option et pour les animes uniquement.

### Ajouté

- **Netflix (facultatif)** : à activer dans *Réglages › Lecture & synchro* ; le navigateur demande alors l’accès à netflix.com, et les onglets Netflix déjà ouverts fonctionnent sans les recharger. Désactiver Netflix retire cet accès.
- Netflix ne distinguant pas les animes, seules les séries dont la fiche AniList contient un lien vers le titre Netflix sont synchronisées ; une série trouvée par son seul titre passe par une carte *À vérifier*, les autres titres sont ignorés sans bruit (ni notification, ni journal, popup et panneau neutres).
- Numérotation des épisodes continue d’une saison Netflix à l’autre, synchro au début du générique (repli au pourcentage, comme sur Crunchyroll).
- Panneau latéral, fiche de la page et progression en direct sur les pages de lecture Netflix ; logo Netflix dans le popup et le panneau, Netflix proposé comme lecteur préféré et dans les réglages de l’agenda.

### Modifié

- Moins de requêtes AniList sur Netflix : une série reconnue comme hors animes est mémorisée 24 h.

### Corrigé

- Liste « En cours » bloquée sur le chargement : après 25 s, un message d’erreur et un bouton *Réessayer* s’affichent ; une réponse arrivée en retard est tout de même affichée.
- Rapport de diagnostic : un stockage local bloqué plus de 10 s est désormais signalé dans les erreurs récentes.

## [2.0.0] - 2026-10-08

Panneau latéral, import de l’historique Crunchyroll et réglages repensés.

### Ajouté

- **Panneau latéral** (Crunchyroll et ADN) : onglet *En lecture* avec la fiche AniList complète (synopsis, genres, studio, suites avec un bouton *Regarder* quand elles sont sur Crunchyroll / ADN), ta progression et tes actions, et un lien vers la discussion de l'épisode.
- Progression en direct dans le panneau (position, synchro au générique dans X min, synchronisé) ; la fiche se met à jour après la synchro.
- **Agenda** (panneau latéral) : les sorties de la semaine pour tes séries en cours, avec l'heure estimée sur Crunchyroll / ADN (réglable) et les épisodes déjà vus.
- **Import de l'historique Crunchyroll** (Réglages) : lit ton historique dans ton navigateur et met à jour AniList / MyAnimeList (aperçu avant import, jamais de recul, vérification en cas de doute).
- Tests de bout en bout du popup dans l'intégration continue (bloquent une release en cas d'échec).
- Réglages du panneau latéral : onglet ouvert par défaut, affichage de la progression en direct.

### Modifié

- **Réglages réorganisés** : accueil par catégories avec un résumé de chaque réglage, interrupteurs rapides (synchro, alertes), sous-pages et zones de danger ; aussi accessibles depuis le panneau latéral.
- Logos de Crunchyroll, ADN, AniList et MyAnimeList à la place des pastilles texte CR / ADN / AL / MAL (popup, panneau latéral), embarqués dans l’extension.
- Firefox : version minimale 142 (supprime l’avertissement de validation AMO lié à Firefox pour Android).

### Corrigé

- Fiche de la page : popup et panneau affichent la même fiche pour un onglet, mise à jour juste après la synchro ; une page de lecture lue avant son chargement complet ne donne plus une saison devinée sur le seul titre (ex : *Black Butler -Public School Arc-* affiché comme *Kuroshitsuji* 2008).
- Lecteur préféré ADN : SyncKai retient les pages de séries ADN que tu visites (AniList ne les référence presque jamais) ; sinon « Ouvrir » reste sur Crunchyroll et le menu ⋯ propose « Chercher sur ADN ».
- Correspondance des saisons : saisons spéciales (OVA, extras, saison 0) jamais confondues avec la N-ième saison (film ou OVA unique au titre exact reconnu, sinon fiche à choisir) ; numéro de saison du titre (« Season 2 ») prioritaire ; saison Crunchyroll découpée en « Part 2 » sur AniList reconnue sans lien ; numérotation absolue sur une fiche unique (One Piece) jugée sûre.
- Limite de requêtes AniList : les tâches de fond (import, comparaison des listes) se limitent à ~20 requêtes/min et laissent passer le popup et la synchro en priorité ; après un refus, attente d’au moins 5 s (plus de « réessaie dans 0 s »).

## [1.9.0] - 2026-10-07

SyncKai arrive sur Firefox.

### Ajouté

- **Version Firefox** (Firefox 140 ou plus récent, ordinateur) : mêmes fonctionnalités que sur Chrome, publiée sur Firefox Add-ons (AMO).
- Bandeau « Autoriser l’accès » dans le popup si l’accès à Crunchyroll / ADN a été retiré (Firefox).
- Publication automatique sur le Chrome Web Store et Firefox Add-ons à chaque version.

### Modifié

- Connexions AniList / MyAnimeList configurées par navigateur.
- Firefox : notifications de nouvel épisode sans bouton (un clic ouvre l’épisode).

## [1.8.0] - 2026-10-05

### Ajouté

- **Statut depuis le popup** : *Mettre en pause*, *Abandonner* ou *Marquer comme terminé* une série depuis le menu « … » de *En cours*, sur tous les services connectés (confirmation pour Abandonner et Terminé ; la note de fin de série est proposée après Terminé).
- **Fiche de la page** : sur une page de série ou d'épisode Crunchyroll / ADN, le popup affiche la fiche AniList correspondante ; ajout à « À regarder » ou « En cours » si elle n'est pas dans ta liste, sinon progression, statut et note modifiables.
- **Comparer AniList ↔ MyAnimeList** (Activité) : repère les écarts de progression, de statut, de note et les séries absentes d'un côté, puis aligne une série ou toute la liste sur le service de ton choix (rien n'est corrigé automatiquement).
- **Rapport de diagnostic** (Réglages › Aide) : copie un rapport technique sans données sensibles (version, navigateur, réglages, dernières erreurs) et ouvre un signalement GitHub prérempli. Les 50 dernières erreurs sont conservées localement.

### Modifié

- Requêtes AniList / MyAnimeList limitées à 20 s ; erreurs passagères de MyAnimeList (502, 503, 504, délai dépassé) retentées automatiquement pendant un alignement.
- Visuels du Chrome Web Store renouvelés (fiche de la page, statuts, comparateur) et tuile promo 1400×560.

### Corrigé

- Saisons découpées en plusieurs fiches AniList (« Part 2 », « Cour 2 ») : la saison Crunchyroll est associée au bon groupe de fiches (fiche de la page, et repli de la synchro par numéro de saison).
- Épisode spécial rangé dans une saison de la série (ex. *ONE PIECE HEROINES*, saison 30 de One Piece sur Crunchyroll) : la synchro et la fiche de la page retrouvent sa fiche AniList dédiée au lieu de compter l'épisode 1 de la série principale ; le sélecteur de saison de la fiche de la page ne propose plus de films ni de spéciaux.

## [1.7.3] - 2026-10-03

### Ajouté

- Intégration continue (GitHub Actions) et publication automatique sur le Chrome Web Store à chaque tag de version.

### Modifié

- Console silencieuse en production : seuls les avertissements et erreurs sont affichés ; les journaux détaillés sont réservés aux builds de développement (`npm run build:dev`).

## [1.7.2] - 2026-10-01

### Corrigé

- Carte « À vérifier » : les boutons passent à la ligne au lieu de déborder (interface en allemand).

### Modifié

- Liens « Code source » et « Signaler un problème » vers le nouveau dépôt [Sync-Kai/SyncKai](https://github.com/Sync-Kai/SyncKai).

## [1.7.1] - 2026-10-01

### Modifié

- Nouvelle identité : la mascotte **Kai** remplace Mochi (icônes de l’extension, en-tête du popup, écran d’accueil, liste vide, bulles sur la page, onglet d’import).
- README orienté utilisateur, licence MIT et politique de confidentialité (FR/EN/DE) ; préparation de la publication sur le Chrome Web Store.

## [1.7.0] - 2026-10-01

Sauvegarde et interface multilingue.

### Ajouté

- **Export / import** (Réglages › Sauvegarde) : fichier JSON avec réglages, correspondances, séries exclues, séries à noter, refus de revisionnage, vérifications en attente et historique — jamais les connexions AniList/MAL. Import dans un onglet dédié : validation complète, aperçu, mode **Fusionner** (par défaut) ou **Remplacer** (avec confirmation), option « Importer aussi les réglages ».
- **Interface en français, anglais et allemand** (Réglages › Langue : Automatique, Français, English, Deutsch). Nom et description de l’extension traduits (`_locales`). Pluriels, dates et délais localisés (`Intl`). Anglais par défaut pour les autres langues de Chrome.

## [1.6.0] - 2026-10-01

Note, revisionnage et alertes de nouveaux épisodes.

### Ajouté

- **Note en fin de série** : quand une série passe en Terminé, une bulle propose une note sur 10 (10 étoiles, demi-points). Convertie selon le format de note AniList du profil (sur 100, sur 10 décimal, sur 10, sur 5, smileys) ; arrondie à l’entier inférieur pour MyAnimeList. « Plus tard » crée une carte dans Activité › À noter.
- **Revisionnage** : un épisode vu sur une série déjà terminée propose un revisionnage (AniList REPEATING, MAL `is_rewatching`) ; les épisodes suivants avancent et le compteur de revisionnages augmente à la fin. « Non » : plus de question pendant 30 jours. Pas de proposition pour le seul dernier épisode.
- **Alertes de nouveaux épisodes** : vérification horaire (une requête AniList groupée) et notification Chrome avec « Ouvrir » sur le lecteur préféré ; délai réglable (0, 1, 3, 6 h) ; état de la dernière vérification et bouton « Vérifier maintenant » dans Réglages.

### Modifié

- +1 / −1 conserve un revisionnage en cours.
- Le badge de l’icône compte aussi les séries à noter.

## [1.5.0] - 2026-10-01

Fiabilité et contrôle manuel.

### Ajouté

- **File de synchro hors ligne** : une synchro en échec passager (réseau, limite de requêtes, erreur serveur) est mise en file et relancée automatiquement (1 min, 5 min, 15 min, 1 h, 6 h), abandonnée après ~24 h. Section « Synchros en attente » dans Activité avec « Réessayer » / « Abandonner ».
- **+1 / −1** sur chaque série de « En cours », écrit sur tous les services connectés.
- **Raccourci clavier** `Alt+Maj+S` : valide immédiatement l’épisode en cours (modifiable dans `chrome://extensions/shortcuts`).
- **Exclusion par série** (« Ne plus synchroniser cette série ») depuis En cours, les cartes À vérifier et les dernières synchros ; gestion dans Réglages › Séries exclues.

### Modifié

- Barre d’état : synchros en échec ou en attente signalées en priorité.
- Le badge de l’icône compte aussi les synchros abandonnées.

## [1.4.0] - 2026-10-01

Refonte complète du popup (direction « Yoru Mochi · Kotatsu ») : tout se gère désormais depuis le popup.

### Ajouté

- **En cours** : liste des animes en cours (AniList ou MyAnimeList, sélecteur si les deux sont connectés), avec carte « Reprendre » pour la dernière série synchronisée.
- **Prochain épisode** : « Ép. 3 disponible », « Ép. 5 dans 18 h », « Prochain épisode bientôt » ou « Série terminée » (catalogue AniList, y compris pour MyAnimeList).
- **Tri** de la liste : prochaine sortie (par défaut), dernière mise à jour, titre, épisodes restants — choix mémorisé.
- **Ouvrir** chaque anime sur sa plateforme (Crunchyroll, ADN), avec un réglage **Lecteur préféré** quand il est disponible sur les deux.
- **Barre d'état** : « Tout est synchronisé · il y a … », éléments à vérifier, session expirée avec « Reconnecter ».
- **Notifications sur la page** à 3 niveaux : *Discrètes* (par défaut : petite pastille, rien en plein écran), *Détaillées*, *Alertes seulement*. Les alertes restent toujours affichées.
- Coche sur l'icône de l'extension après chaque synchronisation réussie.
- Écrans de premier lancement et de liste vide avec la mascotte Mochi.

### Modifié

- La page d'options est supprimée : ses réglages sont dans l'onglet Réglages du popup (comptes, lecture, synchronisation, notifications, correspondances).
- Nouveau style visuel : thème sombre chaleureux, polices M PLUS Rounded 1c et Nunito embarquées (sous-ensembles latins), toasts en bulle.
- L'ancien réglage « toasts activés / désactivés » est migré vers le niveau de notification équivalent.

### Corrigé

- La liste « En cours » se met à jour après une synchronisation même si le popup est ouvert.
- MyAnimeList : les séries classées adultes et les listes de plus de 100 séries sont incluses.
- Le cache d'une liste est effacé à la déconnexion du compte correspondant.

## [1.3.0] - 2026-09-30

### Ajouté

- **MyAnimeList** : connexion (OAuth2 + PKCE, sans secret, renouvellement automatique du token), carte de compte dans le popup, synchronisation de la progression en parallèle d'AniList.
- Chaque compte est facultatif : MyAnimeList fonctionne sans compte AniList (catalogue AniList public pour la correspondance, puis `idMal`).
- Résultat par service dans le toast, et « Réessayer » limité aux services en échec.

### Modifié

- Déconnexion par service depuis sa carte ; les vérifications et l'historique ne sont effacés qu'à la déconnexion du dernier compte.
- Services de suivi derrière une interface commune (pattern Adapter, `src/background/trackers/`).

## [1.2.0] - 2026-09-30

### Ajouté

- **Adapter ADN** (animationdigitalnetwork.com) : détection des épisodes (JSON-LD, repli sur le lecteur video.js), navigation entre épisodes sans rechargement, complétion au pourcentage réglé (ADN ne fournit pas le début du générique).
- Correspondance AniList via les liens ADN des fiches (`/video/{id}-{slug}`, ancien format par slug).
- Correspondance automatique par titre quand une seule fiche AniList (série) porte exactement ce titre et qu'il s'agit de la saison 1 ; les autres cas sans lien plateforme restent à vérifier.

### Modifié

- Helpers de lecture (JSON-LD, texte, garde-fou anti-données périmées) partagés entre les adapters.
- Raison « à vérifier » explicite quand la fiche AniList n'a été trouvée que par son titre (aucun lien vers la plateforme).

## [1.1.0] - 2026-09-30

### Ajouté

- **Icônes de l'extension** (16 à 128 px), générées par `npm run icons`.
- **Page d'options** (lien « Options » dans le popup) :
  - pause de la synchronisation automatique ;
  - déclenchement au générique de fin ou à un pourcentage réglable (70–98 %) ;
  - activation des toasts de confirmation (les alertes restent affichées) ;
  - liste des correspondances mémorisées, avec « Oublier » par saison et réinitialisation complète.
- **Bouton « Réessayer »** dans le toast quand une synchronisation échoue (réseau, AniList indisponible) : l'épisode n'est plus perdu.

### Modifié

- Limite de requêtes AniList (429) : nouvelle tentative automatique si AniList demande une attente courte (≤ 20 s).
- Version minimale de Chrome : 116.

### Corrigé

- L'épisode suivant pouvait être marqué comme vu dès la navigation (derniers instants de l'épisode précédent pris en compte).
- Une correction sur la même fiche AniList ne pouvait pas faire baisser la progression.
- Une vérification arrivée pendant l'affichage d'un résultat n'apparaissait qu'à la réouverture du popup.
- Écritures concurrentes du stockage (popup, options, synchronisation) pouvant s'écraser mutuellement.
- Les alertes n'apparaissaient plus si le toast « Synchronisation… » avait été fermé.
- Le lecteur Crunchyroll n'était pas prioritaire sur une autre balise `<video>` de la page.
- Erreurs silencieuses : réponse de secours du service worker, échec d'enregistrement des réglages ou de « Ignorer » désormais affichés.

## [1.0.0] - 2026-09-30

Première version : synchronisation automatique Crunchyroll → AniList.

### Ajouté

- **Connexion AniList** (OAuth2 Implicit Grant via `chrome.identity`), déconnexion et affichage du profil (avatar, pseudo, lien vers le profil).
- **Adapter Crunchyroll** : détection des pages de lecture (navigation SPA incluse), extraction de l'anime, de la saison et des numéros d'épisode (JSON-LD, repli DOM avec détection des données périmées).
- **Détection de fin d'épisode** au début du générique de fin (données « skip events » de Crunchyroll), avec repli à 85 % de la vidéo. Les publicités (vidéos de moins de 2 min) sont ignorées.
- **Synchronisation AniList** :
  - recherche de la fiche via les liens Crunchyroll des fiches AniList, puis ordre des saisons (suites/préquelles) ;
  - gestion de la numérotation absolue (ex : One Piece E1180) et relative par saison, y compris les saisons découpées en plusieurs fiches ;
  - règles de mise à jour : jamais de recul, passage en « En cours » puis « Terminé », fiches terminées et revisionnages laissés intacts ;
  - correspondances mémorisées par saison.
- **Toast dans la page** (compatible plein écran) indiquant le résultat de chaque synchronisation.
- **Vérification manuelle** des correspondances incertaines depuis le popup (fiches suggérées, recherche, numéro d'épisode), avec badge sur l'icône de l'extension.
- **Dernières synchros** dans le popup, avec correction a posteriori d'une correspondance.

[2.1.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v2.1.0
[2.0.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v2.0.0
[1.9.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.9.0
[1.8.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.8.0
[1.7.3]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.7.3
[1.7.2]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.7.2
[1.7.1]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.7.1
[1.7.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.7.0
[1.6.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.6.0
[1.5.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.5.0
[1.4.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.4.0
[1.3.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.3.0
[1.2.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.2.0
[1.1.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.1.0
[1.0.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.0.0
