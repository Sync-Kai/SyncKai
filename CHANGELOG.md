# Changelog

Toutes les évolutions notables de SyncKai sont documentées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions selon [SemVer](https://semver.org/lang/fr/).

## [2.2.0] - 2026-10-11

Version fiabilité : après un audit complet de l’extension, ta progression ne recule plus jamais, chaque compte garde ses propres données et les jetons de connexion sont chiffrés.

### Ajouté

- La saison choisie dans le sélecteur du popup ou du panneau, sur une page de lecture, est mémorisée : l’épisode en cours et les suivants sont synchronisés sur cette fiche. Pour revenir au choix automatique : *Oublier* dans *Réglages › Mes données*. Si l’épisode n’existe pas dans cette saison, la carte le signale et rien n’est mémorisé.
- Après une mise à jour de SyncKai, les onglets Crunchyroll et ADN déjà ouverts sont repris tout seuls dans Chrome, sans recharger la page. Sinon, l’avertissement *Recharge la page* s’affiche dès l’ouverture de l’épisode ou le début de la lecture, et plus seulement à la fin.
- SyncKai injoignable à la fin d’un épisode : la bulle propose *Réessayer* (un seul envoi, même après plusieurs clics). Le raccourci de validation (Alt+Maj+S) renvoie aussi un épisode qui n’a rien écrit et répond toujours à l’écran : *Aucun épisode en lecture*, *Épisode déjà synchronisé*, *Synchro automatique en pause* ou *Série exclue de la synchronisation*.
- +1 / −1 réussi sur un service et en échec sur l’autre : un bouton *Réessayer* écrit le même épisode sur le seul service en échec, au lieu de recliquer +1 et de décaler celui qui avait réussi.
- Accessibilité : après une action (*+1*, *Réessayer*, *Oublier*, *Ignorer*, *Fermer*…), le focus clavier reste sur le bouton ou passe à l’élément voisin au lieu de repartir du haut du popup ; un bouton dont l’action est en cours reste sélectionnable et est annoncé « indisponible » ; les messages d’erreur ne sont lus qu’une fois par les lecteurs d’écran (NVDA, VoiceOver, Narrateur), et les résultats série par série de l’import et de l’alignement ne le sont plus (le bilan l’est).

### Modifié

- Les synchros en attente, les cartes *À noter*, les dernières synchros et les corrections sont liées au compte connecté à leur création et ne valent que pour lui : après une déconnexion, même suivie d’une reconnexion au même compte, elles ne sont plus écrites. À la mise à jour, celles qui existent déjà sont rattachées au compte connecté (pour une sauvegarde importée, au compte connecté à l’import).
- Écarts AniList ↔ MAL : *Garder AniList*, *Garder MAL* et *Tout aligner* relisent les deux listes juste avant d’écrire. Une série modifiée ou synchronisée depuis l’analyse est marquée *Modifiée depuis l’analyse* et laissée telle quelle, au lieu d’être réécrite avec d’anciennes valeurs : l’alignement ne fait plus reculer la progression ni le statut.
- Les écritures sur une même série passent l’une après l’autre (synchro, synchros en attente, +1/−1, statut, note, revisionnage, import, alignement) : deux +1 cliqués en même temps depuis le popup et le panneau comptent bien pour deux, et un ancien épisode renvoyé plus tard ne fait plus reculer la progression.
- +1 / −1 n’ajoutent plus la série à l’épisode 1 sur le service où elle est absente de ta liste : ce service est laissé tel quel et le retour l’indique (*Ép. 8 vu · absente de MyAnimeList*). L’ajout reste réservé aux boutons *Ajouter*.
- Popup et panneau partagent la même fiche « Sur cette page » : mêmes états et mêmes messages, la carte du popup se met à jour quand une synchro réécrit la fiche, et une relecture en échec garde la fiche affichée avec l’erreur.
- Moins de requêtes et de travail en arrière-plan : le profil est relu au plus toutes les 6 heures et la liste *En cours* gardée 90 secondes (*Réessayer* et chaque synchro la relisent toujours), le service worker n’est plus réveillé par les caches du popup et du panneau, et les scripts des pages de lecture, jusqu’à trois fois plus légers, ne reçoivent plus chaque écriture des données de SyncKai. Un changement de langue s’applique aux messages de la page sans la recharger, au plus tard à l’épisode suivant.
- Sauvegarde : le fichier exporté porte un nom dans la langue de l’interface (*synckai-backup-…*, *synckai-sicherung-…*), et *Exporter* depuis le popup ouvre la page *Sauvegarde*, qui lance le téléchargement : la boîte *Enregistrer sous* ne ferme plus le popup en plein export.
- Textes : Netflix est cité dans l’accueil, dans *Rien en cours* (avec un bouton *Ouvrir Netflix* quand il est activé), dans l’Agenda vide et dans le panneau hors Crunchyroll / ADN ; l’astuce de *Rien en cours* indique le vrai chemin *Réglages › Lecture & synchro* et l’ouvre d’un clic.
- Chaque version est vérifiée avant publication : paquet reconstruit à l’identique depuis les sources, permissions contrôlées, analyse du code et tests élargis.

### Corrigé

- Fin d’épisode de nouveau détectée quand le lecteur remplace sa vidéo (lecture automatique sur Crunchyroll ou Netflix), quand une bande-annonce précède le lecteur, dans un onglet en arrière-plan ou quand le lecteur met plus de 30 secondes à apparaître (publicité, avertissement de contenu, connexion lente). Sur Crunchyroll, en lecture automatique (One Piece E1180 puis E1181), le nouvel épisode n’est plus identifié avec le titre et le numéro du précédent.
- Une préquelle ou une suite publiée comme une autre série sur la plateforme (Naruto pour Naruto Shippuden, Bleach pour Bleach TYBW…) n’est plus comptée comme une saison de la série regardée. **Si tu regardes une telle suite sur Crunchyroll, vérifie dans AniList et MAL que la série précédente n’a pas reçu ta progression**, et utilise *Réglages › Mes données › Correspondances › Oublier* si une correspondance est fausse.
- Comptes : rien d’un ancien compte n’est plus écrit sur un nouveau (synchros en attente, cartes *À noter* et *Corriger*, import Crunchyroll en cours), ni réenregistré après une déconnexion (profil, liste *En cours*, comparaison AniList ↔ MAL, agenda, alertes de sortie). *Reconnecter* AniList efface d’abord les données de l’ancien compte, et la fiche de la page comme le panneau latéral sont vidés dès la déconnexion.
- Accès révoqué alors qu’aucun autre service n’est connecté : tes données de suivi sont effacées comme après une déconnexion ; à l’inverse, se déconnecter de MyAnimeList quand AniList a seulement expiré ne les efface plus. Un accès révoqué ou une session impossible à renouveler pendant une synchro en arrière-plan affiche *Session expirée* avec *Reconnecter*, au lieu de *Non connecté*.
- Connexions : plusieurs requêtes MyAnimeList refusées ne renouvellent la session qu’une fois (moins de déconnexions intempestives) ; abandon après 20 secondes si MyAnimeList ne répond pas ; session gardée en cas de limite de requêtes (429) ; plus de reconnexion fantôme après une déconnexion pendant un renouvellement, ni de reconnexion effacée par une réponse tardive ; une première connexion MyAnimeList refusée en donne la cause et l’URL de redirection attendue ; une réponse trop lente affiche *délai dépassé* au lieu de *réponse inattendue*, et les tâches de fond réessaient.
- Import de l’historique Crunchyroll : une coupure réseau, une limite de requêtes ou une erreur passagère ne fait plus perdre la lecture (nouvel essai après une courte attente, saison illisible passée *À vérifier*) ; une réponse inattendue à la demande d’accès affiche *Import indisponible* ; une série écrite sur AniList alors que MyAnimeList était indisponible n’est plus comptée en échec (seul MyAnimeList est retenté).
- Import Crunchyroll et alignement AniList ↔ MAL : un traitement en cours pendant une mise à jour de l’extension reprend tout seul ; un gros historique s’analyse et s’applique bien plus légèrement ; l’historique réduit n’est plus conservé après un arrêt ou un échec de l’analyse (celui d’une version précédente est effacé) ; les blocs *Déjà à jour* et *À vérifier* restent ouverts ou repliés ; *Recommencer* n’efface plus une analyse lancée depuis un autre onglet.
- Revisionnage : +1 sur le dernier épisode le termine comme la synchro automatique (*Terminé* avec un revisionnage de plus, MyAnimeList quitte *Re-watching*), et *Corriger* laisse la série en revisionnage. **Les séries laissées en *Re-watching* sur MyAnimeList par l’ancien comportement sont à corriger à la main sur MyAnimeList.**
- *Corriger* est refusé avec un message si la progression a changé depuis la synchro (une série terminée entre-temps reste terminée), et l’épisode suivant de la même saison est signalé *À vérifier* tant que la correction n’est pas validée ou ignorée. **Les corrections importées depuis une sauvegarde deviennent de simples vérifications.**
- Cartes : une carte *À noter* reste dans Activité tant qu’un service n’a pas enregistré la note (ou si la série n’est dans aucune de tes listes) et n’est plus effacée par une autre série qui se termine ; une carte *À vérifier* validée pendant une panne d’un service met l’épisode en attente au lieu de le perdre. Plus de bulle *Noter* si la série a déjà une note, à la fin d’un revisionnage, ni quand seule la fiche MyAnimeList se termine.
- Correspondances : une saison suivie pendant sa diffusion n’est plus bloquée quand AniList publie la suite dans une fiche *Part 2* ; une fiche introuvable (supprimée, fusionnée, absente de MyAnimeList) affiche l’erreur tout de suite au lieu d’être renvoyée en boucle pendant 24 h ; une correspondance d’une autre version de SyncKai n’est plus effacée. Celles d’une sauvegarde importée sont refusées si elles sont suspectes et revérifiées sur AniList à leur premier usage, au lieu d’envoyer une progression fausse.
- Alertes de sortie : la liste *En cours* est rechargée toutes les 12 heures même sans ouvrir le popup (séries ajoutées ailleurs alertées, séries terminées ou abandonnées plus alertées, épisode tout juste synchronisé plus annoncé) ; une notification non affichée est retentée ; baisser le délai d’alerte ne fait plus sauter d’épisodes ; les sorties récentes ne sont plus perdues avec beaucoup de séries quotidiennes ; une série exclue n’apparaît plus dans l’agenda ni dans les alertes.
- Agenda : une erreur de chargement reste affichée avec *Réessayer* et la même semaine n’est plus demandée deux fois de suite ; *Ajuster l’heure* avec 200 délais déjà réglés garde le nouveau réglage et retire le plus ancien ; *Entrée* dans un champ de délai vide n’enregistre plus 0 minute.
- Panneau *En lecture* : la fiche ne reste plus bloquée sur le chargement ni grisée quand l’onglet finit de se charger pendant la recherche, et une action terminée après un changement d’onglet ou d’épisode ne s’affiche plus sur la nouvelle page.
- Netflix : un film l’emporte sur une série TV au même titre (une fiche trouvée par son seul titre passe par *À vérifier*), et les correspondances enregistrées par la 2.1.0 sont recalculées au prochain épisode. Netflix désactivé (Réglages, `chrome://extensions` ou `about:addons`) : un onglet resté ouvert ne synchronise plus rien et affiche *Netflix est désactivé*, le lecteur préféré repasse sur Crunchyroll (aussi après l’import d’une sauvegarde), et *Ouvrir*, l’agenda et les notifications n’ouvrent plus Netflix.
- SyncKai ne modifie plus la langue déclarée par les pages Crunchyroll, ADN et Netflix : plus de proposition de traduction à tort, bonne langue pour les lecteurs d’écran, et l’import Crunchyroll récupère les titres dans la langue de ton compte Crunchyroll.
- Interface : pendant la pause d’un alignement ou d’un import, seul le compte à rebours change (le survol et le focus ne sautent plus) ; un compte dont le profil n’a jamais pu être chargé affiche l’erreur avec *Réessayer* et *Déconnecter* au lieu d’un chargement sans fin ; la page *Sauvegarde* ne laisse plus choisir un autre fichier pendant un import ; sous Firefox, *Modifier* le raccourci ouvre la page des raccourcis (ou affiche la marche à suivre) ; en anglais et en allemand, plus d’espace avant les deux-points.

### Sécurité

- Les jetons de connexion AniList et MyAnimeList sont chiffrés (AES-GCM) avec une clé non exportable que les pages web et les scripts de contenu ne peuvent pas lire. Ceux des versions précédentes sont chiffrés à la mise à jour : tu restes connecté. Si la clé est perdue (données de l’extension effacées), le compte affiche *Session expirée* et il suffit de se reconnecter.
- Les images (couvertures, bannières, avatars) ne sont chargées que depuis les serveurs d’AniList et de MyAnimeList : une autre adresse, venue par exemple d’une sauvegarde importée, est remplacée par l’affiche de repli et bloquée par la politique de sécurité des pages de l’extension.
- Depuis les pages Crunchyroll, ADN et Netflix, SyncKai n’accepte plus que les messages de lecture (fin d’épisode, note, revisionnage, panneau) ; tout le reste est réservé aux pages de l’extension.

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

[2.2.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v2.2.0
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
