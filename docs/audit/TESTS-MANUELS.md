# Tests manuels (2.2.0 et suivantes)

Ce que les tests automatiques ne couvrent pas : à dérouler dans **Brave/Chrome** et **Firefox**, avec le build de `dist/` (`npm run build`, ou `npm run dev`), extension rechargée puis onglets rouverts. Cocher au fur et à mesure ; noter le navigateur en cas d'échec et joindre la console (F12) de la page et du service worker.

Astuce pour simuler une panne d'un service : outils de développement du popup (clic droit › Inspecter) ou du service worker (`chrome://extensions` › SyncKai › « service worker ») › onglet **Réseau** › clic droit sur une requête › **Bloquer l'URL de la requête** (`api.myanimelist.net` ou `graphql.anilist.co`). Débloquer ensuite.

## 1. Mise à jour et comptes

- [ ] **Mise à jour depuis la version du Store** (la plus importante) : installer la version publiée, se connecter à AniList et MAL, laisser un onglet Crunchyroll ouvert, puis charger le nouveau build (*Recharger*). Attendu : les deux comptes restent connectés, l'onglet ouvert continue de fonctionner sans le recharger (Chrome), ou affiche *Recharge la page* dès la lecture (Firefox).
- [ ] **Jetons chiffrés** : console du service worker → `chrome.storage.local.get(['anilistToken','malToken'], console.log)`. Attendu : `{ v: 1, iv, data, expiresAt }`, jamais le jeton en clair.
- [ ] **Session expirée** : révoquer SyncKai sur anilist.co (Settings › Apps), lancer une synchro. Attendu : *Session expirée* en rouge avec *Reconnecter* (pas *Non connecté*) ; *Reconnecter* rétablit tout.
- [ ] **Changement de compte** : bloquer AniList, terminer un épisode (il part dans *Synchros en attente*), se déconnecter d'AniList, se connecter avec un autre compte, débloquer. Attendu : rien n'est écrit sur le nouveau compte.

## 2. Synchro et contrôles

- [ ] **Échec partiel puis Réessayer** : bloquer MAL, faire *+1* sur une série. Attendu : bandeau *Ép. N vu · échec MyAnimeList* avec *Réessayer* ; débloquer, cliquer : MAL rattrape, AniList ne bouge pas.
- [ ] **+1 simultanés** : *+1* sur la même série dans le panneau et dans le popup, dans la même seconde. Attendu : +2 au total sur AniList et MAL.
- [ ] **Revisionnage** (si une série s'y prête) : série en revisionnage à 11/12, *+1*. Attendu : *Terminé* avec un revisionnage de plus ; MAL n'est plus en *Re-watching*.
- [ ] **Corriger** : Activité › *Dernières synchros* › *Corriger* sur une série, puis lancer l'épisode suivant sans valider. Attendu : la carte reste, rien n'est écrit (après le correctif du lot 5 : l'épisode est mémorisé et appliqué après la décision).
- [ ] **Pas de note en double** : terminer le dernier épisode d'une série déjà notée. Attendu : aucune bulle *Noter*.
- [ ] **Écarts AniList ↔ MAL** : *Analyser*, faire *+1* sur une série en écart, revenir. Attendu : *Modifiée depuis l'analyse*, boutons *Garder* grisés ; un écart non modifié s'aligne normalement.

## 3. Détection de la lecture

- [ ] **Lecture automatique** Crunchyroll (et Netflix) : laisser enchaîner l'épisode suivant. Attendu : les deux épisodes se synchronisent, le popup affiche le bon numéro.
- [ ] **Onglet en arrière-plan** : ouvrir un épisode dans un onglet en arrière-plan, attendre plus d'une minute, puis le regarder. Attendu : synchro normale à la fin.
- [ ] **Raccourci Alt+Maj+S** : sur une page de série → *Aucun épisode en lecture* ; sur un épisode déjà synchronisé → *Épisode déjà synchronisé* ; synchro en pause → message explicatif.
- [ ] **Langue de la page** : Crunchyroll dans une autre langue que SyncKai ; console de la page → `document.documentElement.lang`. Attendu : la langue du site, pas celle de SyncKai.
- [ ] **ADN** : un épisode ADN se détecte et se synchronise ; la fiche s'affiche dans le popup et le panneau.

## 4. Netflix

- [ ] **Retrait de l'accès** : Netflix activé, onglet Netflix ouvert ; retirer l'accès dans `brave://extensions` (Firefox : `about:addons` › Permissions) sans recharger l'onglet, finir l'épisode. Attendu : rien n'est synchronisé, popup/panneau affichent *Netflix est désactivé* ; le lecteur préféré repasse sur Crunchyroll.
- [ ] **Série non anime** : rien ne s'affiche, aucune erreur dans Réglages › Aide.

## 5. Panneau latéral et agenda

- [ ] **Panneau pendant le chargement** : ouvrir le panneau pendant le chargement d'un épisode. Attendu : la fiche s'affiche (pas de squelette sans fin).
- [ ] **Action puis changement d'épisode** : *+1* dans le panneau puis lancer aussitôt un autre épisode. Attendu : la fiche du nouvel épisode reste affichée.
- [ ] **Agenda en erreur** : bloquer AniList, ouvrir l'Agenda. Attendu : le message d'erreur et *Réessayer* restent visibles.
- [ ] **Choix de saison** : sur un épisode d'une série à saisons découpées, choisir une autre saison dans le panneau, finir l'épisode. Attendu : la progression part sur la saison choisie ; Réglages › Mes données liste la correspondance.

## 6. Alertes, import, sauvegarde

- [ ] **Alertes sans popup** : laisser le popup fermé plus de 12 h avec une série en cours qui sort. Attendu : la notification arrive.
- [ ] **Import Crunchyroll** : Réglages › Mes données › Importer depuis Crunchyroll ; couper le Wi-Fi 5 s pendant « Vérification des saisons ». Attendu : la lecture continue et se termine. Recharger l'extension pendant l'application : elle reprend toute seule.
- [ ] **Sauvegarde** : *Exporter* depuis le popup (ouvre la page *Sauvegarde*, nom de fichier dans la langue de l'interface), puis réimporter. Attendu : réglages et correspondances conservés.

## 7. Accessibilité (rapide)

- [ ] **Clavier** : dans *En cours*, Tab jusqu'à *+1*, Entrée. Attendu : le focus reste sur le bouton pendant et après l'envoi.
- [ ] **Lecteur d'écran** (NVDA/Narrateur, facultatif) : une erreur n'est annoncée qu'une fois.

## 8. Lien vers la fiche (développement en cours)

- [ ] Titre et affiche ouvrent la fiche dans le popup (*Sur cette page*, *En cours*, *Dernières synchros*, *À noter*, *Écarts*) et le panneau (*En lecture*, suites, *Agenda*).
- [ ] Réglages › Comptes › *Fiche ouverte par défaut* sur MAL : les liens ouvrent myanimelist.net ; avec un seul compte connecté, la ligne disparaît et le lien suit ce compte.
