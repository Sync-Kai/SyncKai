# SyncKai 2.5.0 : synthèse de l'audit du 2026-11-10

Base auditée : `release/2.5.0` = `4188b90` (branche `chore/audit-2026-11-10`, code identique), juste avant le tag 2.5.0. Dernière version publiée : 2.4.2 = `46942a2`. 17 audits en lecture seule, puis vérification adverse de chaque constat moyen ou élevé par 5 groupes de vérificateurs. Détail de chaque constat (en anglais) : `findings.md` ; périmètre, méthode et légende : `README.md`. **Chemins et numéros de ligne : `4188b90`.** Rien n'a été modifié dans le code.

**En bref.**

1. Rien de critique. Après dédoublonnage, 69 constats (sur 78) : 1 élevé, 13 moyens, 55 faibles. Aucun n'a été réfuté ; 22 ont été vérifiés, les 47 autres sont des faibles non vérifiés.
2. **Ne pas taguer en l'état.** Trois bloquants : la CI e2e est rouge (deux tests mal écrits, pas un bug produit), la politique de confidentialité ne décrit pas les nouveautés 2.5.0, et les alertes de suites ne se terminent jamais pour les grosses listes.
3. Sept petits correctifs recommandés avant le tag, tous sur des nouveautés 2.5.0 qui écrivent une mauvaise donnée ou cassent une partie visible. Une décision à trancher avant le tag : TERMS-02.
4. Le reste part en 2.5.1 ou 2.6, SYNC-01 en tête (ancien, pas propre à la 2.5.0, mais il abîme des correspondances).

---

## 1. Verdict pour la 2.5.0

### 1.1 Bloquants avant le tag (dans l'ordre)

**1. ARCH-01 : la CI e2e est rouge, et `release.yml` lance la même suite avant l'envoi aux stores.**

- Constat : le dernier passage CI de la 2.5.0 (run 207, `develop` @ `443c461`) a échoué au job « Tests de bout en bout (popup) » : 2 échecs sur 118 (`watching-undo` et `panel-section-friends`, valeur reçue `null`). `release/2.5.0` n'est jamais passée en CI (`ci.yml` ne tourne que sur `main`, `develop` et les PR). Au push du tag, le job `build` de `release.yml` relance `npm run test:e2e`, et un échec bloque l'envoi au Chrome Web Store et à AMO : rien n'est publié (l'échec est sans danger), mais une relance peut passer, ce qui fait de cette barrière un pile ou face.
- Cause (V2) : une course dans les tests, pas un bug produit. Les deux tests lisent le focus une seule fois, juste avant que le produit le pose (un tour de `setTimeout(0)` dans la popup, une image `requestAnimationFrame` dans le panneau). Le focus arrive toujours (40 fois sur 40, même processeur ralenti ×4) ; le test des amis échoue environ 1 fois sur 15 en local.
- Correctif (tests seulement) : remplacer `expect(await focused(page)).toBe('watching-undo')` (`scripts/e2e/popup.e2e.ts:1862`) et la lecture unique de `scripts/e2e/sidepanel.e2e.ts:520` par `await page.waitForFunction(() => document.activeElement?.getAttribute('data-focus') === '<clé>')`, la forme déjà utilisée aux lignes 1872, 1919, 1937 et 2077-2082 de `popup.e2e.ts`.
- Test qui échoue d'abord : `CI=1 npx vitest run -c vitest.e2e.config.ts scripts/e2e/sidepanel.e2e.ts -t "ouvre la section des amis" --repeats 14` (environ 1 échec sur 15 aujourd'hui, 15 sur 15 attendu après).
- Puis, en toute fin (§3.3), un passage CI vert sur l'arbre exact de la release avant de pousser le tag. Ajouter `release/**` aux branches de `ci.yml` est facultatif.

**2. SEC-01 (= TERMS-01) : `PRIVACY.md` et l'onglet Confidentialité du Chrome Web Store décrivent la 2.4.**

- Constat : avec les réglages par défaut, la 2.5.0 lit chaque jour les listes AniList et MAL complètes (alertes de suites, activées par défaut, y compris pour qui avait coupé les alertes de sortie : TERMS-02) ; pour un compte MAL seul, elle envoie à l'API publique d'AniList, sans jeton, les identifiants MAL de tout l'historique vu, en cours ou revu ; les boutons des notifications écrivent dans les listes ; chaque fiche lit les entrées AniList des personnes suivies (nom, avatar, statut, progression, note, gardés 10 min en mémoire) ; les suggestions sont gardées 24 h et les suggestions écartées vont dans la sauvegarde ; de nouvelles clés sont stockées. La phrase « only sent to AniList and/or MyAnimeList, solely to update your list » devient fausse par défaut.
- Règles du CWS : des champs de confidentialité qui contredisent la politique ou le comportement peuvent valoir un retrait, et un changement de pratique après installation doit être annoncé clairement. Pas de rejet automatique (aucune permission ni aucun hôte nouveau), mais la politique est servie depuis `main` (`blob/main/PRIVACY.md`), qui ne bouge qu'avec la release : il faut la corriger avant le tag. Elle sert aussi de politique sur AMO.
- Ce n'est pas une décision : le « no Store Privacy change » de la spec 2.5.0 (`2026-11-08-2.5.0-design.md:21`, `:164`) date d'avant les specs des suites et des suggestions, qui ne l'ont jamais revu.

Ce qu'il faut changer dans `PRIVACY.md`, d'abord en anglais, puis les mêmes changements en français et en allemand :

| Ligne EN / FR / DE | Changement |
|---|---|
| `:3` | date d'effet `2026-10-12` → date de la release |
| `:17` / `:100` / `:183` (« In short ») | remplacer « solely to update your list » : les données servent aussi à afficher des informations sur les séries de la liste (sorties, suites, ordre de visionnage, suggestions, personnes suivies sur AniList) |
| nouveaux paragraphes (par exemple une section après « Data read from pages ») | **Alertes de suites** : activées par défaut ; une lecture par jour des listes ; relations lues dans le catalogue public d'AniList ; identifiants MAL des séries vues, en cours ou revues absentes de la liste AniList recherchés sur AniList (sans jeton pour un compte MAL seul, avec le jeton AniList sinon) ; les boutons de la notification peuvent ajouter la suite à « À regarder ». **Suggestions** : mêmes lectures, plus les recommandations d'AniList ; dernières suggestions gardées 24 h ; identifiants écartés gardés et inclus dans la sauvegarde. **Ordre de visionnage** : statuts lus dans les listes ; franchise lue dans le catalogue public, en cache de session 24 h ; liste MAL gardée en mémoire 5 min au plus. **Amis** : AniList seulement ; nom, avatar, statut, progression et note des personnes suivies, pour la série affichée ; en mémoire 10 min au plus, jamais stockés |
| `:44-53` / `:127-136` / `:210-219` (stockage local) | ajouter : les suites trouvées ou notifiées et le résultat de la dernière vérification ; les dernières suggestions et les suggestions écartées ; les séries gardées hors du groupe « En sommeil » |
| `:55` / `:138` / `:221` (cache de session) | ajouter l'ordre de visionnage de la franchise (24 h) |
| `:60` / `:143` / `:226` (jetons) | après « read your list, update your progress, score or rewatch » : lire sur AniList les entrées des personnes suivies, changer le statut |
| `:69` / `:152` / `:235` (ligne `graphql.anilist.co`) | ajouter : suites, ordre de visionnage, suggestions, personnes suivies |

Puis `docs/store/permissions.md`, à coller dans l'onglet Confidentialité du CWS **avant** le tag (`scripts/store-permissions.test.ts` plafonne chaque bloc à 1000 caractères) :

| Bloc | Ligne | Changement | Taille actuelle |
|---|---|---|---|
| Single purpose | `:10` | ajouter à « All features (…) » : alertes de suites, ordre de visionnage, suggestions tirées de la liste, personnes suivies sur les fiches, séries en sommeil | 554 / 1000 |
| `alarms` | `:30` | ajouter la vérification au plus quotidienne des listes pour les suites ; remplacer « only when the user has turned alerts on » par « while release or sequel alerts are on (both on by default) and an account is connected » | 662 |
| `notifications` | `:36` | ajouter les notifications de suites (activées par défaut) : « + Plan to watch » ajoute la suite aux listes, « Open entry » l'ouvre ; plusieurs suites sont groupées | 253 |
| `storage` | `:18` | ajouter les nouveaux stockages locaux et le cache de session de la franchise ; il faudra condenser | 912 |
| Host permission | `:80` | après « graphql.anilist.co: AniList API (match the series, save progress) », ajouter calendrier, suites, ordre de visionnage, suggestions et entrées des personnes suivies ; à condenser | 962 |

- Conseillé dans le même collage (décision 14 du §2) : cocher « Personally identifiable information » en « Yes (conservative) » et réécrire la note de `:140` (nom et avatar du compte connecté en cache local, noms et avatars des personnes suivies en mémoire seulement) ; mettre à jour le bloc libre (`:153`) et la note interne (`:158`). Les cases « Data usage » et les trois certifications restent vraies (mêmes destinataires, mêmes catégories).
- Ailleurs : si le Developer Hub d'AMO contient une copie collée de la politique, la recoller ; ajouter dans l'entrée 2.5.0 du `CHANGELOG.md` (d'où sortent les notes de version) une ligne qui annonce la mise à jour de la politique et ce que lisent les alertes de suites.
- Test : `npx vitest run scripts/store-permissions.test.ts` (limite de 1000 caractères). Garde facultative proposée par TERMS : une ligne de ce test qui exige que chaque groupe de clés de compte de `account-keys.ts` (suites, lot de suggestions, suggestions écartées, marques « Garder ») soit nommé dans la section anglaise de `PRIVACY.md` ; elle échoue aujourd'hui.

**3. TRK-01 (= PERF-01, SEQ-01, XB-01) : la passe quotidienne des suites ne se termine jamais pour les grosses listes.**

- Constat : AniList est en mode dégradé (30 requêtes par minute, dernière mesure du projet le 2026-10-15). La voie « de fond » (requêtes non interactives) n'a alors droit qu'à 20 requêtes par minute, et attend 60 s après la dernière réponse dès qu'AniList annonce 10 requêtes restantes ou moins. La passe enchaîne les morceaux de liste, la liste MAL, puis une requête de relations par 50 séries : la 21e requête du réveil attend environ 60 s dans une boucle de `setTimeout` de 5 s, sans aucun événement ni appel d'API d'extension. Chrome arrête un service worker inactif au bout de 30 s : la passe meurt. Rien n'est écrit avant la fin (`lastCheck`, `sequels:lastResult`), donc le délai de 6 h après échec ne s'applique pas, et l'alarme horaire relance la passe, qui meurt au même endroit, toutes les heures.
- Pour l'utilisateur : aucune suite n'est jamais annoncée, Activité et la vue « Annoncées » de l'Agenda restent vides, Réglages › Notifications dit « jamais vérifié », sans aucune erreur visible ; et environ 20 requêtes AniList plus une lecture complète de la liste MAL sont gâchées chaque heure (environ 480 requêtes AniList par jour au lieu d'environ 15).
- Qui : en mode dégradé, à partir d'environ 750 à 900 séries terminées, en cours ou revues (AniList seul), et d'environ 460 à 510 (MAL seul) ; en mode normal (90 par minute), au-delà d'environ 2000 et 1100 (seuils reproduits par V1). Firefox (lu dans ses sources) : même règle des 30 s, et ses lectures de `storage.local` ne remettent pas le compteur à zéro. Invisible en dev : l'alarme `debug:dev-reload` réveille le worker toutes les 30 s, et le faux AniList de `test:ext` répond 90/89.
- Plus petit correctif (V1) : dans `src/background/sequels/check.ts` › `pass()`, appeler `void chrome.runtime.getPlatformInfo()` au départ puis toutes les 20 s (`setInterval`, effacé dans `finally`). C'est un « battement » : un appel d'API d'extension anodin qui remet à zéro le compteur d'inactivité ; c'est le motif que documente Chrome, un appel au processus parent sur Firefox, et il n'ajoute aucun écouteur. Pas d'écriture `storage.session` à la place (elle déclenche `storage.onChanged` dans les pages ouvertes). Le marqueur « passe commencée » est un renfort facultatif : seul, il ne répare rien (la passe mourrait toutes les 6 h). Ajouter `runtime.getPlatformInfo` au faux `chrome` (`src/test/fake-chrome.ts`, qui n'en a pas), sinon les tests existants de la passe lèvent.
- Test qui échoue d'abord : `check.test.ts`, minuteurs simulés (fake timers), un `fetchSequelRelations` qui se résout après 70 s (ou le cas dégradé de V1 : 950 séries à 30 par minute) : `chrome.runtime.getPlatformInfo` est appelé au départ et jamais à plus de 25 s d'écart jusqu'à la fin de la passe. Aujourd'hui, il n'est jamais appelé.
- Hors périmètre : les calculs déclenchés par un message (`GET_RECOMMENDATIONS`, `GET_FRANCHISE`) subissent les mêmes attentes, et on ne sait pas si un message en attente garde le worker en vie. Le même battement peut envelopper le calcul des suggestions (deux lignes) ; RECO-01, en 2.5.1, supprime de toute façon l'attente en pratique.

### 1.2 Recommandés avant le tag

Petits correctifs (effort S), tous sur des nouveautés 2.5.0, dans l'ordre de leur valeur.

1. **RECO-02** (moyen, confirmé) : pendant le tour du dé (« 🎲 Autre », 360 ms), « + À regarder » et « Pas intéressé » agissent sur la suggestion suivante, que l'utilisateur n'a pas vue. *Pourquoi avant le tag :* écriture fausse et visible (ajout à « À regarder » sur AniList et/ou MAL, avec une activité publique sur AniList), deux clics rapides suffisent ; une garde d'une ligne dans `RecoCard`.
2. **POP-04** (faible, non vérifié, reproduit par l'auditeur) : une série en attente de son épisode 1 (daté) passe « En sommeil » après 30 jours, et « Tout mettre en pause » la met en pause : elle quitte « Mes séries », l'Agenda et l'alerte de l'épisode 1. *Pourquoi :* écriture fausse dans le nouvel écran, contraire à la spec §5.3 (« une série à jour sur un calendrier n'est jamais en sommeil ») ; une condition dans `isDormant`.
3. **PERF-02** (moyen, confirmé) **+ POP-02** (faible) : « Tout mettre en pause » envoie deux requêtes AniList interactives par série sans pause ; à 30 par minute, la 16e série reçoit un 429, puis toutes les requêtes AniList interactives échouent pendant une minute (popup, panneau ; la synchro d'un épisode fini à ce moment part dans la file). *Pourquoi :* l'action phare du nouveau groupe casse justement pour les gros comptes qu'elle vise. Correctif : 6 s entre deux séries quand il y en a plusieurs (délai injectable pour les tests), et POP-02 dans la même branche, parce que ce rythme allonge la fenêtre où un « Garder » peut être écrasé. Afficher « n / N » sur le bouton (une chaîne nouvelle, 21 langues), pour que l'utilisateur ne ferme pas la popup pendant les 1 à 2 minutes du lot (POP-05 : « Annuler » serait perdu).
4. **POP-01** (moyen, plausible), **à condition** que le contrôle manuel du §4 le confirme : à 110 % ou 125 % de zoom, la popup 496 × 600 dépasse le plafond de 600 px de Chrome et rien ne défile ; la barre d'état (comptes, « Session expirée · Reconnecter ») disparaît. *Pourquoi :* régression de la nouvelle taille (la 2.4.2 avait 20 px de marge), zoom courant, et une ligne de CSS : `overflow-y: auto; overflow-x: hidden` sur `html`.
5. **ORD-08** (faible, non vérifié, reproduit) : dans l'ordre de visionnage, « Overlord II » s'affiche « II », et l'en-tête plié de Gundam dit « Ensuite : I ». *Pourquoi :* texte absurde dans l'en-tête de la nouvelle section, sur des franchises très courantes ; une règle de plus dans `shortTitle`.
6. **SEQ-05** (faible, non vérifié) : compte MAL seul sous Chrome, le bouton « + À regarder » de la notification d'une suite sans `idMal` (fréquent à l'annonce) échoue à chaque fois et remplace le texte par « Aucun service connecté n'a de fiche pour cette série. ». *Pourquoi :* bouton de la nouvelle notification toujours cassé pour ces comptes ; il suffit de ne pas l'afficher, comme le font déjà les lignes d'Activité.
7. **SEQ-04** (faible, non vérifié, reproduit) : dans Activité, avec 4 suites annoncées ou plus (le cas courant après la première passe), la suite qu'on vient d'ajouter passe derrière « N autres suites annoncées », et son résultat (« pas encore sur MyAnimeList ») n'est jamais vu. *Pourquoi :* la ligne sur laquelle on vient d'agir disparaît ; garder les lignes terminées à leur place est un tri.

### 1.3 À trancher avant le tag

- **TERMS-02** : migration pour les utilisateurs qui avaient coupé les alertes de sortie en 2.4.2 (§2, décision 1). Elle n'a d'effet que sur la mise à jour 2.4.2 → 2.5.0 : maintenant ou jamais. Elle réduit aussi l'exposition de SEC-01. Recommandation : oui.
- **ORD-03** (facultatif) : si le propriétaire valide la règle SUMMARY / COMPILATION (décision 2), elle peut partir avec ORD-08 dans la même branche.
- **PII** dans l'onglet Confidentialité (décision 14), dans le même collage que SEC-01.

### 1.4 Le reste : 2.5.1 et 2.6

- **2.5.1, en tête** : SYNC-01 (numéros d'épisode décimaux ou absents : correspondances supprimées ou illisibles, carte impossible à valider ; ancien, mais c'est le constat moyen restant qui abîme des données), CR-01 avec SEC-02 et SEC-03 (données stockées revalidées), UI-01 (= ORD-02), UI-03 et UI-04 (focus, identifiants ARIA, note au clavier), RECO-01 (requêtes des comptes MAL seuls), SVOD-01 après le contrôle d'un film Prime Video.
- **2.5.1, ensuite** : les autres faibles 2.5.0 par écran (suggestions, ordre de visionnage, sommeil, suites, panneau), la sauvegarde et l'import (IMP-01, IMP-02, IMP-03, STO-02), TRK-02, SYNC-03, CR-02, TERMS-03, TERMS-04, l'outillage (ARCH-03, ARCH-05, ARCH-06), et les décisions du §2 une fois tranchées.
- **2.6** : ce qui demande une vraie conception : le lot de mise en pause comme tâche du service worker (POP-05, option a), le lien entre les messages de note ou de revisionnage et une invite réelle (SEC-04), l'alarme unique des suites (PERF-04), la région live de la barre d'état (UI-05), la marge des budgets de scripts de contenu (ARCH-02, option a).

---

## 2. Décisions à prendre par le propriétaire

| # | Constat | Options | Recommandation | Quand |
|---|---|---|---|---|
| 1 | **TERMS-02** : qui avait coupé les alertes de sortie en 2.4.2 reçoit, après la mise à jour, les alertes de suites (lectures quotidiennes des listes, notifications), sans en être prévenu. Le défaut « les deux activés » est consigné dans la spec. | (a) migration 2.5.0 : réglages bruts avec `airingAlerts === false` et sans clé `sequelAlerts` → `sequelAlerts: false` (la première alarme se supprime alors d'elle-même) ; (b) seulement `sequelNotifications: false` (garde Activité, le réveil horaire et les lectures) ; (c) rien, une ligne dans le CHANGELOG | **(a)** : cet utilisateur avait refusé la seule fonction d'alerte de SyncKai ; il retrouve l'état de la 2.4.2 (aucun réveil, aucune lecture) et peut activer les suites en un clic. Test dans `update-migrations.test.ts`. S. | avant le tag |
| 2 | **ORD-03** : les récapitulatifs reliés par PREQUEL / SEQUEL entrent dans la chaîne principale ; après la série TV Gundam, « Ensuite » pointe vers son film récapitulatif. | (a) après le parcours, passer en extras (toujours visibles sous « Tout ») les entrées qu'une entrée principale déclare SUMMARY ou COMPILATION ; (b) y ajouter ALTERNATIVE ; (c) garder | **(a)** : exacte sur les quatre captures (Gundam passe de 23 à 19 entrées principales et « Ensuite » = Ζ Gundam ; AoT, Monogatari et Mushoku Tensei inchangés). **Pas (b)** : AniList déclare ALTERNATIVE dans les deux sens, cela rétrograderait Ζ Gundam, UC et THE ORIGIN eux-mêmes. Les rééditions reliées seulement par ALTERNATIVE restent dans la chaîne. S. | avant le tag (avec ORD-08) ou 2.5.1 |
| 3 | **SYNC-02** : les correspondances sans origine (tout choix manuel d'avant 2.4.0) sont supprimées quand un épisode sort de leur intervalle ; trois documents disent qu'elles ne le sont jamais. | (a) aligner les trois documents sur le code ; (b) les protéger comme les `chosen` | **(a)** : la plupart sont automatiques et doivent pouvoir être remplacées ; (b) coûterait des recherches AniList à chaque épisode hors intervalle. Documents : `docs/memory/matching.md:18`, `src/shared/sync.types.ts:37-39`, `src/background/sync/__corpus__/README.md:26-28`. | 2.5.1 |
| 4 | **SEQ-02** : une suite retirée parce que sa série source a été mise en pause, abandonnée ou exclue ne revient jamais quand la source reprend (affichage seulement). | (a) un ensemble `ended` (écartées, ajoutées, sorties par le plafond de 200) et recréer les autres candidates connues comme « vues », sans notification ; (b) garder et documenter | **(a)**, avec la correction de V1 : les identifiants sortis par le plafond restent exclus, sinon le plafond tourne en boucle. Change le test `sequels.test.ts:116`. | 2.5.1 |
| 5 | **XB-02** : le clic sur la notification groupée « N suites annoncées » n'ouvre presque jamais Activité (toujours refusé sur Firefox 142 à 148, et sur Chrome quand la fenêtre n'est pas active) ; le repli n'ouvre que la fiche de la première suite. | (a) donner le focus à la dernière fenêtre normale puis `openPopup({ windowId })`, garder le repli pour Firefox < 149, corriger le commentaire de `actions.ts:88` ; (b) assumer le repli et le dire | **(a)**, après un essai à la main sur Chrome et Firefox (§4). | 2.5.1 |
| 6 | **POP-05** : « Tout mettre en pause » tourne dans la popup ; la fermer pendant le lot l'arrête et fait perdre « Annuler ». | (a) une tâche du service worker, comme l'alignement des listes ; (b) rester dans la popup avec « n / N » et le jeu d'annulation gardé brièvement dans `storage.session` ; (c) garder | **(b) en 2.5.1** (le compteur peut déjà venir avec PERF-02 avant le tag), **(a) en 2.6** si les lots restent longs. | 2.5.1 / 2.6 |
| 7 | **PERF-03** : le panneau relit toute la liste MAL presque à chaque épisode (mémo de 5 min dans le worker, perdu quand il s'endort), même pour une franchise d'une seule entrée. À l'inverse, ORD-06 : après « Actualiser » ou une action de la popup, l'état MAL reste périmé. | (a) garder la liste MAL dans la page du panneau, comme le dit la spec §5.2 (relue au changement de page, à « Actualiser » et après une action) ; (b) `storage.session` par époque de session (epoch), 10 min ; (c) garder | **(a)** : règle à la fois PERF-03 et ORD-06 ; dans la même branche, RECO-07 et « pas de `GET_LIST_STATES` sous 2 entrées ». | 2.5.1 |
| 8 | **PERF-04** : les alertes de suites gardent l'alarme horaire : 24 réveils par jour, dont 23 pour répondre « pas encore », chez qui a coupé les alertes de sortie. | (a) une alarme unique `synckai:sequels` à `lastCheck` + 24 h (+ 6 h après un échec), traitée dans l'écouteur `onAlarm` existant, et l'alarme horaire seulement avec les alertes de sortie ; (b) garder | **(a)** : `CLAUDE.md` demande un worker au repos ; la migration TERMS-02 règle déjà le cas des mises à jour. | 2.6 |
| 9 | **PNL-02** : panneau resté ouvert, la semaine affichée dans l'Agenda n'est jamais relue (sauf réécriture par l'alarme, qui ne tourne plus quand les notifications sont bloquées). | (a) appliquer la durée de vie (1 h / 6 h) aux semaines gardées en mémoire ; (b) garder et documenter | **(a)** : S, sans requête en trop (la garde des 60 s reste). | 2.5.1 |
| 10 | **STO-02 (= IMP-04)** : « Remplacer » avec une sauvegarde 2.4.x efface les suggestions écartées, sans que l'aperçu ni l'avertissement en parlent. | (a) absent ≠ vide : garder la liste actuelle quand le fichier n'a pas la section, et ajouter la ligne dans « Contenu du fichier » (chaîne nouvelle) ; (b) seulement la ligne et le texte d'avertissement | **(a)** | 2.5.1 |
| 11 | **STO-01** : se connecter par-dessus un jeton expiré avec un autre compte garde les données « utilisateur » du précédent (cartes « À vérifier » simples, suggestions écartées, état des alertes, liens appris). | (a) terminer la fermeture comme une déconnexion ; (b) purger seulement si l'identifiant du nouveau compte diffère de celui en cache | **(b)** : la même personne qui se reconnecte garde ses données ; une autre ne reçoit pas celles du précédent. | 2.5.1 |
| 12 | **ARCH-02** : budgets des scripts de contenu épuisés (Crunchyroll : 262 octets libres, ADN 512, Prime Video 891), alors que la décision 13 supposait 10 % de marge. | (a) regagner 5 à 10 % de marge (c7 ou une autre coupe : rouvre la décision 13) ; (b) écrire une règle de correctif urgent pour relever un budget ; les deux | **(b) tout de suite** (une ligne dans `docs/memory/workflow.md`), **(a) avant** le prochain chantier de script de contenu. | 2.5.1 / 2.6 |
| 13 | **ARCH-03** : seuils de couverture 4,4 à 5,6 points sous la mesure ; le cliquet de la décision 5 n'a jamais été resserré. | (a) seuils au plancher mesuré (90,3 / 85,8 / 90,0 / 92,1) et un avertissement au-delà d'un point d'écart ; (b) garder | **(a)**, S, `chore/`. | 2.5.1 |
| 14 | **PII** (dans SEC-01) : l'onglet Confidentialité dit « No », alors que le CWS compte les noms d'utilisateur comme données personnelles ; antérieur à la 2.5.0, élargi par les amis. | cocher « Yes (conservative) » avec une note réécrite ; garder « No » | **Cocher**, dans le même collage que SEC-01. | avant le tag |
| 15 | **TERMS-04** : le temps restant lit `average_episode_duration` chez MAL, contre la règle « les nouveautés ne lisent qu'AniList » (écrite six heures après ce code). | (a) prendre `duration` dans la requête catalogue AniList déjà faite, retirer le champ MAL ; (b) consigner une exception | **(a)** : aucune requête en plus, et la règle reste sans exception. | 2.5.1 |

Petits arbitrages dans les branches : l'indice « Entrée pour enregistrer » d'UI-04 (une chaîne nouvelle) ; le nom accessible du bouton « Réessayer » de SEQ-03 (chaîne nouvelle, ou construite autour du texte visible).

---

## 3. Plan de branches ordonné

### 3.1 Avant le tag : où brancher

`develop` (`443c461`) est un ancêtre de `release/2.5.0`, qui a deux commits de plus (`2f91742` pour l'i18n, `4188b90` pour la release). Le plus simple, sans réécriture ni push forcé : chaque branche part de `release/2.5.0` et y revient en fast-forward ; `develop` sera aligné sur `main` après le tag. Ne rien fusionner dans `develop` d'ici là. Variante, si l'on tient à ce que le commit de release reste le dernier : brancher sur `develop`, puis rebaser `release/2.5.0` dessus ; il faut alors un push forcé de `release/2.5.0`, à faire par le propriétaire si le proxy Git le refuse. Pour avoir la CI sur chaque branche : une PR vers `release/2.5.0` (`ci.yml` tourne sur toutes les PR).

Avant chaque fusion : `npm run verify`, plus `CI=1 npm run test:e2e` si la popup ou le panneau change, plus `CI=1 npm run test:i18n-layout` pour toute chaîne nouvelle.

### 3.2 Branches avant le tag, dans l'ordre

1. **`chore/e2e-focus-waits`** : ARCH-01. Effort S, tests seulement.
   - Tests qui échouent d'abord : la commande `--repeats 14` du §1.1 sur le test des amis (environ 1 échec sur 15), et la même sur le test « Pause … Annuler » de `popup.e2e.ts`.
   - À la main : rien.
   - En premier : chaque branche suivante aura ainsi un résultat e2e qui a un sens.
2. **`bugfix/sequel-pass-keepalive`** : TRK-01. Effort S.
   - Test qui échoue d'abord : `check.test.ts`, battement `getPlatformInfo` au départ et au plus toutes les 25 s pendant une passe de 70 s (jamais appelé aujourd'hui).
   - À la main : pas de contrôle direct fiable (une build de dev réveille le worker toutes les 30 s, et DevTools ouvert le garde en vie) ; voir §4.
3. **`bugfix/dormant-bulk`** : POP-04, PERF-02, POP-02 (et le compteur « n / N »). Effort S, ou M avec le compteur (une chaîne, 20 traductions, `test:i18n-layout`).
   - Tests qui échouent d'abord : `isDormant` pour un épisode 1 daté dans 3 jours, progression 0, 40 jours d'inactivité → false ; `pauseAllDormant` sur 20 séries ou plus, horloge simulée : jamais plus de 10 `SET_LIST_STATUS` (20 requêtes AniList) par fenêtre de 60 s ; une pause seule résolue pendant le lot → `bulk` reste vrai, et aucun `PAUSED` pour la ligne gardée entre-temps.
   - À la main (Chrome) : « Tout mettre en pause » sur un vrai compte avec plusieurs séries en sommeil : le lot va au bout, « Annuler » rétablit tout ; une série dont l'épisode 1 est annoncé n'est pas dans le groupe.
4. **`bugfix/reco-dice-turn`** : RECO-02. Effort S.
   - Test qui échoue d'abord : contrôleur réel et `RecoCard` (happy-dom) : « Autre » puis « + À regarder » en moins de 360 ms → aucun `ADD_TO_LIST` pour une suggestion jamais affichée.
   - À la main : Découvrir et la popup vide, « Autre » puis vite « + À regarder » : rien d'ajouté ; avec « réduire les animations », rien ne change.
5. **`bugfix/popup-zoom`** : POP-01, seulement si le contrôle du §4 montre la coupure. Effort S.
   - Test qui échoue d'abord : un e2e qui ouvre `popup.html` en 496 × 545 et vérifie que la barre d'état peut défiler entièrement en vue.
   - À la main : à 100 %, aucune barre de défilement ; à 110 % et 125 %, une barre verticale qui atteint la barre d'état, sans barre horizontale ; Chrome et Firefox.
6. **`bugfix/watch-order-titles`** : ORD-08, et ORD-03 si la décision 2 est oui. Effort S.
   - Tests qui échouent d'abord : `shortTitle('Overlord', 'Overlord II')` → « Overlord II » ; « Kidou Senshi Gundam I » entier ; « Season 2 » inchangé ; avec ORD-03 : fixture Gundam, 80 vu → `next.id` 85 et 19 entrées principales, AoT, Monogatari et Mushoku Tensei inchangés.
   - À la main : panneau sur une page Overlord ou Gundam, en-tête plié et lignes.
7. **`bugfix/sequel-alert-actions`** : SEQ-05, SEQ-04. Effort S.
   - Tests qui échouent d'abord : `check.test.ts`, compte MAL seul et suite sans `idMal` → notification sans le bouton « + À regarder » ; `sequels-section.test.tsx`, 4 suites, ajout de la première avec MAL en échec → la ligne reste parmi les lignes visibles, avec sa mention.
   - À la main : Activité avec 4 suites ou plus, en ajouter une. La notification d'un compte MAL seul est difficile à provoquer (il faut une suite nouvelle) : s'en remettre au test.
8. **`bugfix/sequel-alerts-opt-out`** : TERMS-02, si la décision 1 est oui. Effort S.
   - Test qui échoue d'abord : `update-migrations.test.ts`, depuis 2.4.2 avec `airingAlerts: false` et sans clé de suites → `sequelAlerts: false` ; inchangé avec `airingAlerts: true` ou depuis 2.5.0.
   - À la main : installer une build 2.4.2, couper les alertes de sortie, mettre à jour vers la build 2.5.0 : Réglages › Notifications montre les alertes de suites coupées, et `chrome.alarms.getAll()` (console du service worker) ne liste plus `synckai:airing`.
9. **`chore/privacy-2.5.0`** : SEC-01. Effort S à M (trois langues, deux blocs à condenser). En dernier, pour décrire le comportement final (décision 1 comprise).
   - Test : `npx vitest run scripts/store-permissions.test.ts` (et la garde facultative, qui doit échouer avant).
   - À la main : relire l'onglet Confidentialité du CWS après le collage ; vérifier le champ de politique sur AMO (lien ou texte collé).

### 3.3 Release 2.5.0

1. Sur `release/2.5.0`, mettre à jour l'entrée 2.5.0 du `CHANGELOG.md` : la date, une ligne sur la politique de confidentialité et, si la migration TERMS-02 est retenue, préciser dans « Sequel alerts » qu'elles restent coupées pour qui avait coupé les alertes de sortie. Puis `npm run verify` et `CI=1 npm run test:e2e`.
2. Coller les blocs modifiés de `docs/store/permissions.md` dans l'onglet Confidentialité du CWS (et la politique sur AMO si elle y est collée).
3. Fast-forward de `main` sur `release/2.5.0`, push de `main`, puis attendre le passage vert de `ci.yml` sur `main` : c'est le passage vert sur l'arbre exact qu'ARCH-01 demande, et la politique en ligne est à jour avant l'envoi.
4. Tag annoté `v2.5.0`, poussé par le propriétaire (le proxy Git des sessions cloud refuse les tags) ; `release.yml` construit et soumet.
5. Fast-forward de `develop` sur `main`, push ; suppression de `release/2.5.0`.

### 3.4 2.5.1

Branches partant de `develop`, dans l'ordre.

| # | Branche | Constats | Effort | Tests qui doivent échouer d'abord | À la main sur les vrais sites |
|---|---|---|---|---|---|
| 1 | `bugfix/fractional-episodes` | SYNC-01, SYNC-03, SYNC-02 (documents, décision 3) | M | résolveur : correspondance apprise + E12.5 → pas oubliée ; carte sans numéro validée avec 1 → `synced` ; carte décimale validée sur un `chosen` → l'ancien reste lisible ; reprise par la file d'une carte confirmée → MAL écrit 24 | Crunchyroll : un épisode décimal (Slime S2 E48.5) ; ADN : un film ou un OAV sans numéro, carte validée |
| 2 | `bugfix/stored-data-validation` | CR-01, SEC-02, SEC-03 | S-M | `isEpisodeInfo` avec `signals: { seriesYear: 2020, junk: 'x' }` → false ; lot stocké avec un `siteUrl` étranger → recalculé ; `buildPlatforms` écarte un lien d'historique étranger ; `isAniListViewer` refuse un `siteUrl` étranger | une synchro Crunchyroll normale (les vrais signaux restent acceptés) |
| 3 | `bugfix/focus-and-controls` | UI-01 (= ORD-02), UI-04, UI-02 | M | un enfant retire le bouton focalisé → focus sur le repli, jamais `body` ; `ReviewList` → « Fermer » ; « Afficher N de plus » → première ligne révélée ; note : ← ← puis sortie → « 8/10 » et rien d'envoyé ; survol 250 ms puis clic → sous-menu ouvert | parcours au clavier dans Chrome : « Confirmer » d'une carte, « Abandonner » puis « Oui », « Afficher N de plus », note aux flèches puis Tab |
| 4 | `bugfix/use-id-scope` | UI-03 | S-M | deux racines avec une `Section` chacune → identifiants distincts, chaque section nommée par son titre | facultatif, lecteur d'écran : Réglages › Notifications, menu du compte |
| 5 | `bugfix/reco-batch-queries` | RECO-01, RECO-03, TERMS-03, RECO-06 | M | MAL seul, 1000 séries vues → au plus 4 requêtes AniList (22 aujourd'hui) ; écriture MAL pendant un calcul → absente du lot ; graines MAL → titre AniList dans « Parce que tu as noté » ; graine `isAdult` → jamais citée | d'abord mesurer la complexité de la requête des graines avec `idMal` sur l'API réelle (spec §8) ; Découvrir sur un compte MAL seul |
| 6 | `bugfix/reco-card` | RECO-05, RECO-08, UI-06, RECO-04 | S-M (RECO-04 : 21 langues) | `[anilist updated, mal skipped]` → « pas encore sur MyAnimeList » ; écartée puis « Autre » → absente de « Déjà tirées » ; fr, `TV_SHORT` → libellé traduit et « 8,4 » ; test de catalogue : `reco.dismissAria` contient `reco.dismiss` dans chaque langue | Découvrir en français |
| 7 | `bugfix/panel-list-states` | PERF-03 (décision 7), ORD-06, RECO-07 | M | deux `loadListStates` en 10 min à travers un rechargement du module → une lecture MAL ; « Actualiser » → `fresh: true` ; écriture MAL → mémo oublié ; 5 rafraîchissements de la même série → un `GET_LIST_STATES` ; graphe d'une entrée → aucun | panneau ouvert sur un compte MAL pendant deux épisodes |
| 8 | `bugfix/watch-order-follow-ups` | ORD-01, ORD-07, ORD-05, ORD-04 (et ORD-03 s'il n'est pas fait) | S-M | lien ADN appris rendu par `choosePlatformLink(node, 'adn')`, sans entrer dans le cache ; AniList absent et MAL « Vu » → « MyAnimeList : Vu » visible ; page vide → une requête ; extra d'AoT en cache → une requête | « Regarder » ADN sur une saison vue sur ADN |
| 9 | `bugfix/dormant-follow-ups` | POP-03, POP-06, POP-08, POP-07, POP-05 (option b) | M | « Pause » inerte pendant la revalidation ; cache du worker à jour après `setListStatus` ; marque « Garder » stable quand `mediaId` manque ; moyenne nulle si `total > 50` ; popup fermée pendant le lot → « Annuler » encore proposé | lot de mise en pause, popup fermée au milieu puis rouverte |
| 10 | `bugfix/sequel-follow-ups` | SEQ-02 (décision 4), SEQ-03, XB-02 (décision 5) | S-M | pause puis reprise de la source → suite revenue comme « vue », non notifiée ; ajout en échec → `[data-alert]` et nom contenant « Réessayer » ; clic groupé → `openPopup` après `windows.update` | notification groupée sur Chrome (fenêtre active et inactive) et sur Firefox |
| 11 | `bugfix/panel-follow-ups` | PNL-01, PNL-03, PNL-04 (= XB-03), PNL-02 (décision 9) | S-M | 3 connexions refusées puis `follow` du même onglet → nouvelle connexion ; réponse de l'ancienne semaine ignorée ; demande pour la fenêtre 3 ignorée par la fenêtre 2 ; semaine gardée 5 h → un `GET_AGENDA` | F5 sur un épisode Crunchyroll, ADN et Prime Video, panneau ouvert ; deux fenêtres et « Plus d'idées dans le panneau » |
| 12 | `bugfix/backup-and-import` | IMP-01, IMP-02, IMP-03, STO-02 (= IMP-04, décision 10) | S-M (une chaîne pour IMP-02, une pour STO-02) | fusion → la correction locale reste ; 2001 écarts → charge acceptée par la garde ; 201 vérifications → charge acceptée ; exclusion après l'analyse → rien d'écrit ; « Remplacer » sans la section → liste gardée | — |
| 13 | `bugfix/prime-video` | SVOD-01, SVOD-02, SVOD-03, ARCH-04 | M | catalogue `MOVIE` sans titre de série + page du film → épisode 1 `movie` ; entrée revue plus récente sur un autre chemin → nouveau chemin ; script démarré sur B avec l'hydratation de A → pas A ; 2-R6 : `it.fails` levé ou test supprimé selon le contrôle | film anime jusqu'au bout ; reprise d'un épisode depuis une autre page ; activation de Prime Video dans un onglet déjà ouvert ; 2-R6 (§4) |
| 14 | `bugfix/session-edges` | TRK-02, STO-01 (décision 11) | S | jeton relu après l'attente → `SessionChangedError` et aucun envoi ; connexion d'un autre compte par-dessus un jeton expiré → données « utilisateur » purgées | reconnexion AniList après expiration, avec le même compte puis avec un autre |
| 15 | `bugfix/mal-duration` | TERMS-04 (décision 15) | S | minutes d'une entrée MAL tirées du nœud catalogue AniList ; `MAL_WATCHING_PATH` sans `average_episode_duration` | temps restant d'une liste MAL |
| 16 | `bugfix/crunchyroll-music-pages` | CR-02 | S (budget : 262 octets) | `getEpisodeId` → null pour `/de/watch/musicvideo/MV5B02C79/x` et `/watch/concert/MC2E2AC135/x` | une vidéo musicale Crunchyroll jusqu'à 85 % |
| 17 | `chore/audit-2026-11-tooling` | ARCH-05 (= UI-07), ARCH-06, ARCH-03 (décision 13), ARCH-02 option b (décision 12) | S | test des clés inutilisées → échoue sur les 7 clés ; test de la notice tierce → échoue tant qu'elle manque | — |

### 3.5 2.6

| Branche | Constats | Effort | Tests qui doivent échouer d'abord | À la main |
|---|---|---|---|---|
| `feature/dormant-bulk-job` | POP-05 option a | L | e2e de l'extension : popup fermée au milieu du lot → le lot continue, « Annuler » proposé à la réouverture | lot de 20 séries sur un vrai compte |
| `bugfix/engagement-prompt-binding` | SEC-04 | M | `RATE_MEDIA` d'origine contenu sans invite enregistrée pour l'onglet → refusé, aucune écriture | note et revisionnage depuis le toast sur Crunchyroll et ADN |
| `bugfix/sequel-alarm` | PERF-04 (décision 8) | M | alertes de sortie coupées, suites actives → aucune alarme de 60 min, une alarme unique à `lastCheck` + 24 h | réveils du worker sur une journée (`chrome://serviceworker-internals`) |
| `bugfix/status-bar-live-region` | UI-05 | S-M (chaînes) | état `ok`, horloge + 60 s → texte du `role="status"` inchangé | lecteur d'écran dans le panneau |
| `chore/content-budget-margin` | ARCH-02 option a (décision 12) | M | aucun (mesuré par `verify:build`) | synchro normale sur les trois plateformes concernées |

---

## 4. À tester à la main

Ce que seul le propriétaire peut vérifier (vrais navigateurs, vrais sites, vrais comptes). Règle habituelle : ne jamais lire, copier ni consigner de jeton, cookie, en-tête ou identifiant de compte ou de profil.

**Avant le tag**

1. **POP-01, popup et zoom** (décide la branche 5). Dans `chrome://settings/appearance`, zoom des pages à 110 % puis 125 % ; ouvrir la popup sur une page de streaming et sur un onglet vide. La barre d'état entière (logos des comptes en bas) est-elle visible et cliquable ? La dernière ligne d'une longue liste « Mes séries » peut-elle venir entièrement en vue ? Puis, à 100 %, Ctrl + « + » deux fois dans la popup ouverte, mêmes contrôles (Ctrl + 0 pour revenir). Refaire dans Firefox (zoom par défaut à 110 %). Comparer avec la 2.4.2 à 110 %. Si c'est coupé, essayer le correctif dans une build de dev : à 100 % aucune barre de défilement ; à 110 % une barre verticale qui atteint la barre d'état, sans barre horizontale.
2. **Les correctifs d'avant le tag, dans Chrome** : tour du dé (RECO-02) ; lot de mise en pause et « Annuler » (PERF-02, POP-02) ; une série en attente de son épisode 1 absente du groupe (POP-04) ; titres de l'ordre de visionnage (ORD-08) ; Activité avec 4 suites ou plus (SEQ-04).
3. **Notifications Firefox** : notification d'une seule suite (sans boutons sur Firefox, le clic ouvre la fiche) ; notification groupée (XB-02 : sur Firefox avant 149, attendre le repli vers la fiche de la première suite) ; « Vérifier maintenant » dans Réglages › Notifications. Sur Chrome, cliquer une notification groupée pendant qu'une autre application a le focus.
4. **TERMS-02** (si la migration est retenue) : mise à jour depuis une build 2.4.2 avec les alertes de sortie coupées (branche 8).
5. **SEC-01** : relire l'onglet Confidentialité du CWS après le collage, et le champ de politique d'AMO.
6. **TRK-01** : pas de contrôle direct fiable (une build de dev réveille le worker toutes les 30 s, et DevTools ouvert le garde en vie). Après la publication, sur un gros compte (800 séries ou plus), vérifier que Réglages › Notifications affiche une dernière vérification datée du jour.

**Après le tag (pour trancher ou corriger en 2.5.1)**

7. **SVOD-01, films Prime Video** : regarder un film anime sur Prime Video jusqu'à la fin ; est-il synchronisé ? Sinon, capturer la forme de son `catalogMetadataV2.catalog` (sans jeton, cookie, en-tête ni identifiant) pour en faire la fixture du test.
8. **ARCH-04 (2-R6), Prime Video en mode ratio** (sans marqueur de générique) : le catalogue de l'épisode suivant arrive-t-il avant la bascule ? Si oui, l'épisode en cours n'est jamais synchronisé.
9. **PNL-01** : F5 sur un épisode Crunchyroll, ADN et Prime Video, panneau ouvert ; la progression en direct revient-elle, ou reste-t-elle sur « Recharge l'onglet pour suivre la lecture. » ?
10. **SYNC-01** : un épisode décimal sur Crunchyroll (Slime S2 E48.5 ou S3 E65.5), et un film ou un OAV ADN lu par le repli du lecteur (sans numéro).
11. **CR-02** : une vidéo musicale ou un concert Crunchyroll jusqu'à 85 % ; un toast d'erreur apparaît-il ?
12. **SVOD-02, SVOD-03** : sur Prime Video, reprise d'un épisode depuis une autre page du même onglet ; activation de Prime Video dans un onglet déjà ouvert après une navigation interne.
13. **API AniList** (pour RECO-01 et RECO-06) : complexité de la requête des graines avec `idMal` dans les relations, et présence de médias adultes dans `Page.media(id_in / idMal_in)` sans argument `isAdult`.
14. **Lecteur d'écran** (facultatif, NVDA) : UI-01, UI-03, UI-05.

---

## 5. Chiffres

Constats bruts : 78 (4 élevés, 23 moyens, 51 faibles). Fusions : 9 (TRK-01 = PERF-01 = SEQ-01 = XB-01 ; SEC-01 = TERMS-01 ; UI-01 = ORD-02 ; RECO-01 = PERF-05 ; PNL-04 = XB-03 ; STO-02 = IMP-04 ; ARCH-05 = UI-07). Après dédoublonnage : **69 constats**.

| Gravité finale | CONFIRMED | PLAUSIBLE | DELIBERATE | non vérifié | Total |
|---|---|---|---|---|---|
| critique | 0 | 0 | 0 | 0 | 0 |
| élevée | 1 | 0 | 0 | 0 | **1** |
| moyenne | 11 | 2 | 0 | 0 | **13** |
| faible | 6 | 1 | 1 | 47 | **55** |
| **Total** | **18** | **3** | **1** | **47** | **69** |

- Réfutés : 0. Vérifiés : 22 (tous les moyens et élevés, dont 8 moyens rétrogradés en faible : TERMS-02, SEQ-02, SYNC-02, PNL-01, UI-02, IMP-01, IMP-02, ORD-01). TERMS-01 est passé d'élevé à moyen en fusionnant avec SEC-01 ; XB-01 (moyen) est entré dans TRK-01 (élevé).
- Introduits par la 2.5.0 : 40 oui, 3 en partie (UI-01, POP-01, POP-06), 26 non.
- Décisions à revisiter : 13 (ORD-03, TERMS-02, SEQ-02, SYNC-02 vérifiées ; XB-02, POP-05, PERF-03, PERF-04, PNL-02, STO-02, STO-01, ARCH-02, ARCH-03 non vérifiées), plus 2 arbitrages (PII, TERMS-04).
- Avant le tag : 3 bloquants (ARCH-01, SEC-01, TRK-01) et 7 recommandés (RECO-02, POP-04, PERF-02 avec POP-02, POP-01 sous condition, ORD-08, SEQ-05, SEQ-04), soit 8 constats corrigés en plus des bloquants.
