# Changelog

Toutes les évolutions notables de SyncKai sont documentées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions selon [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

### Ajouté

- Panneau latéral (en préparation) : ouverture depuis le popup sur Crunchyroll et ADN uniquement.
- Tests de bout en bout du popup dans l'intégration continue (bloquent une release en cas d'échec).

### Modifié

- Firefox : version minimale 142 (supprime l’avertissement de validation AMO lié à Firefox pour Android).

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
