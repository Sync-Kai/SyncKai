# Feuille de route des correctifs (audit du 2026-10-10)

Plan de traitement des 131 cas de l'[audit 2.1.0](AUDIT-2026-10-10.md). Chaque lot correspond à une branche Gitflow (rebase sur `develop`, `merge --ff-only`, branche supprimée ensuite). Les cas en double entre thèmes sont rattachés à un seul ID principal ; les autres figurent dans « [Regroupés / écartés](#regroupés--écartés) ».

Ordre de priorité dans chaque version : 1) corruption de données (mauvaise fiche, progression qui recule, mauvais compte) ; 2) fonctionnalité centrale cassée ; 3) le reste.

Vérification avant chaque fusion (session principale) : `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npm run test:e2e` si le popup ou le panneau changent. À partir du lot 11, `npm run verify` remplace cette liste.

## Synthèse

| Ordre | Version | Branche | Cas | Effort |
|---|---|---|---|---|
| 1 | 2.1.1 | `bugfix/relation-autre-serie` | 3 | M |
| 2 | 2.1.1 | `bugfix/alignement-instantane-perime` | 2 | S |
| 3 | 2.1.1 | `bugfix/verrou-par-fiche` | 2 | S |
| 4 | 2.1.1 | `bugfix/controles-revisionnage` | 5 | M |
| 5 | 2.1.1 | `bugfix/cartes-verification` | 6 | M |
| 6 | 2.1.1 | `bugfix/panneau-en-lecture` | 3 | M |
| 7 | 2.1.1 | `bugfix/netflix-retrait-acces` | 2 | S |
| 8 | sans version | `chore/garde-permissions-release` | 3 | S |
| 9 | sans version | `chore/docs-stores` | 5 | S |
| 10 | sans version | `chore/build-reproductible` | 3 | M |
| 11 | sans version | `chore/verification-locale-ci` | 3 | S |
| 12 | 2.2.0 | `bugfix/liaison-compte` | 5 | M |
| 13 | 2.2.0 | `bugfix/ecritures-sous-session` | 6 | M |
| 14 | 2.2.0 | `bugfix/auth-erreurs` | 7 | M |
| 15 | 2.2.0 | `chore/tests-orchestration` | 4 | M |
| 16 | 2.2.0 | `bugfix/import-crunchyroll` | 8 | L |
| 17 | 2.2.0 | `bugfix/alertes-sortie` | 6 | M |
| 18 | 2.2.0 | `bugfix/stockage-local` | 6 | M |
| 19 | 2.2.0 | `bugfix/extraction-episode` | 4 | M |
| 20 | 2.2.0 | `chore/frontieres-modules` | 2 | M |
| 21 | 2.2.0 | `feature/controleur-fiche-page` | 2 | M |
| 22 | 2.2.0 | `feature/accessibilite` | 3 | M |
| 23 | 2.2.0 | `bugfix/finitions-ui` | 8 | M |
| 24 | 2.2.0 | `feature/durcissement-securite` | 3 | M |
| 25 | 2.3.0 | `chore/registre-plateformes` | 1 | S |
| 26 | 2.3.0 | `bugfix/reattachement-video` | 7 | L |
| 27 | 2.3.0 | `feature/agenda-hors-cible` | 1 | M |
| 28 | plus tard | `chore/popup-controleurs` | 1 | L |
| 29 | plus tard | `chore/i18n-contenu-leger` | 1 | M |

Total : 112 cas affectés à un lot, 19 regroupés, aucun écarté.

## Par où commencer

Commencer par le **lot 1** : [SYNC-01](AUDIT-2026-10-10.md#sync-01) est le seul cas de gravité haute confirmé qui corrompt les listes. Une préquelle ou une suite publiée comme une autre série Crunchyroll (Naruto pour Naruto Shippuden, Bleach pour Bleach TYBW) reçoit la progression avec une confiance « high », et la correspondance fausse est mise en cache pour toute la saison. Enchaîner aussitôt avec le **lot 2** ([SYNC-02](AUDIT-2026-10-10.md#sync-02)) : « Aligner » réécrit un instantané périmé et peut faire reculer des centaines de séries en un clic. Les deux lots sont courts, touchent des fichiers distincts (`resolver.ts`/`matching.ts` contre `compare.ts`) et peuvent être relus le même jour. Faire ensuite le lot 3 (verrou par fiche), dont dépendent les lots 4 et 5. Le lot 8 (garde-fou des permissions et chaîne de publication) doit être fusionné avant le tag `v2.1.1`.

---

## 2.1.1 : correctifs urgents (intégrité des données et panneau)

### Lot 1 · `bugfix/relation-autre-serie`

**Objectif :** ne plus écrire la progression sur une fiche AniList liée à une autre série de la plateforme, ni sur une série TV homonyme d'un film Netflix.

| Cas | Gravité | Sujet |
|---|---|---|
| [SYNC-01](AUDIT-2026-10-10.md#sync-01) | haute | Préquelle/suite d'une autre série Crunchyroll comptée comme saison (Naruto ← Shippuden) |
| [BRW-01](AUDIT-2026-10-10.md#brw-01) | moyenne | Film Netflix : la série TV homonyme l'emporte en confiance high |
| [TEST-08](AUDIT-2026-10-10.md#test-08) | moyenne | Chemin « correspondance en cache » et propagation SEQUEL/PREQUEL non testés |

- **Effort :** M.
- **Dépendances :** aucune.
- **Tests :**
  - `matching.test.ts` : Shippuden S1 E5 avec Naruto en PREQUEL lié à un autre `seriesId` donne Shippuden (ou une vérification), jamais Naruto ; S2 E35 de même ; LinkKind `'other'` exclu de `seasonPool` et jamais propagé.
  - `matching-netflix.test.ts` : « Jujutsu Kaisen 0 » donne le MOVIE lié ; « Bubble » donne le MOVIE lié, et la TV homonyme non liée retombe à confiance `low`.
  - `resolver.test.ts` : bloc « cache » (mapping valide : aucun `searchAnime` ; hors fiche avec `persist:true` : suppression puis nouvelle résolution ; `persist:false` : ni suppression ni écriture) ; relation SEQUEL récupérée par `getAnimeByIds` et marquée `'relation'`.
- **Vérification manuelle (Chrome ou Brave) :** Naruto Shippuden S1 E1 sur Crunchyroll, popup ouvert : la fiche proposée est Shippuden (1735), pas Naruto (20). Un épisode de One Piece reste correct (non-régression de la numérotation absolue). Firefox : un film Netflix lié sur AniList (Netflix activé).
- **Migration et purge :**
  - Revalidation au premier usage d'une correspondance en cache : si la fiche mise en cache a son propre lien vers une autre série de la même plateforme, supprimer la correspondance et relancer la résolution.
  - À la mise à jour vers 2.1.1 (`onInstalled`, `reason === 'update'`), supprimer toutes les correspondances `netflix:*` (créées depuis la 2.1.0, il y a quelques jours, elles se recalculent toutes seules).
  - La progression déjà écrite sur la mauvaise fiche ne peut pas être annulée automatiquement. CHANGELOG (Corrigé) : « Si tu regardes une suite publiée à part sur Crunchyroll (Naruto Shippuden, Bleach TYBW…), vérifie dans AniList et MAL que la série précédente n'a pas reçu ta progression, et utilise *Réglages › Mes données › Correspondances › Oublier* si une correspondance est fausse. »

### Lot 2 · `bugfix/alignement-instantane-perime`

**Objectif :** l'alignement AniList ↔ MAL relit l'état réel avant d'écrire et ne fait jamais reculer une liste.

| Cas | Gravité | Sujet |
|---|---|---|
| [SYNC-02](AUDIT-2026-10-10.md#sync-02) | moyenne | « Aligner » écrit l'instantané `compare:last` sans relecture |
| [ARCH-21](AUDIT-2026-10-10.md#arch-21) | moyenne | `compare:last` jamais invalidé après une synchro ou un contrôle |

- **Effort :** S.
- **Dépendances :** aucune. Si le lot 3 est déjà fusionné, faire la relecture sous `withEntryLock`.
- **Tests :** `src/background/compare.test.ts` : la cible relue avec une progression différente de `diff[target]` donne un élément ignoré « modifié depuis l'analyse » ; une écriture inférieure à la progression actuelle de la cible est refusée ; `compare:last` est marqué « à réanalyser » (ou les écarts de la fiche retirés) après une synchro réussie de la même fiche.
- **Vérification manuelle (Chrome) :** lancer une analyse avec un écart, regarder un épisode de cette série, puis cliquer « Aligner » : la série est ignorée avec le message, et aucune progression ne recule sur AniList ni sur MAL.
- **Migration :** aucune. CHANGELOG : l'alignement ignore les séries modifiées depuis l'analyse.

### Lot 3 · `bugfix/verrou-par-fiche`

**Objectif :** sérialiser par fiche la séquence lecture → décision → écriture, pour qu'aucun chemin concurrent ne fasse reculer la progression.

| Cas | Gravité | Sujet |
|---|---|---|
| [ARCH-12](AUDIT-2026-10-10.md#arch-12) | moyenne | Aucun verrou par fiche entre direct, file, contrôles, import, alignement |
| [CRI-02](AUDIT-2026-10-10.md#cri-02) | basse | `applyItem` : attente du budget entre lecture et écriture |

- **Effort :** S.
- **Dépendances :** aucune. Les lots 4, 5 et 16 s'appuient sur le helper.
- **Tests :** nouveau `src/background/sync/entry-lock.test.ts` sur le modèle de `watching-race.test.ts` : deux `syncEpisode` concurrents (E5 depuis la file, E7 en direct) sur la même fiche donnent une progression finale de 7 ; deux `ADJUST_PROGRESS` +1 donnent +2 ; dans `applyItem`, le créneau d'écriture (`waitWriteSlot`) est pris avant la relecture.
- **Vérification manuelle (Chrome) :** +1 depuis le panneau et depuis « En cours » du popup dans la même seconde : +2 au total sur AniList.
- **Migration :** aucune.

### Lot 4 · `bugfix/controles-revisionnage`

**Objectif :** des contrôles manuels (+1/−1, note, correction) cohérents avec la synchro automatique, revisionnage compris.

| Cas | Gravité | Sujet |
|---|---|---|
| [CTRL-02](AUDIT-2026-10-10.md#ctrl-02) | moyenne | +1 crée l'entrée à l'épisode 1 sur le service où la série est absente |
| [CTRL-03](AUDIT-2026-10-10.md#ctrl-03) | moyenne | +1 en échec partiel : recliquer décale le service qui avait réussi |
| [CTRL-01](AUDIT-2026-10-10.md#ctrl-01) | moyenne | +1 au dernier épisode d'un revisionnage : compteur et `is_rewatching` |
| [CTRL-04](AUDIT-2026-10-10.md#ctrl-04) | moyenne | Carte « À noter » supprimée malgré un service en échec |
| [SYNC-08](AUDIT-2026-10-10.md#sync-08) | basse | « Corriger » sur un revisionnage le fait sortir du revisionnage |

- **Effort :** M.
- **Dépendances :** lot 3 (`adjustOnService` et `statusOnService` sous verrou).
- **Tests :**
  - `controls.test.ts` : `entry === null` donne un skip `notInList` ; REPEATING 11/12 puis +1 donne COMPLETED avec `repeat+1` ; après un échec partiel, le nouvel essai écrit une progression absolue sur le seul service en échec.
  - `rules.test.ts` : une correction sur REPEATING reste REPEATING, avec `repeat+1` au dernier épisode, et MAL reçoit `is_rewatching` explicite.
  - `engagement-store.test.ts` : la carte est conservée tant qu'un service est en erreur ou que tous sont `skipped`.
- **Vérification manuelle (Chrome + Firefox) :** une série présente sur AniList et absente de MAL, +1 : MAL n'est pas créé. Une série en revisionnage à 11/12, +1 : AniList COMPLETED avec un revisionnage de plus, MAL n'est plus « Re-watching ». Noter avec MAL hors ligne (coupure réseau dans les outils de développement) : la carte reste après la réouverture du popup.
- **Migration :** aucune. Les entrées MAL restées en `is_rewatching` se corrigent à la main ; le mentionner dans le CHANGELOG.

### Lot 5 · `bugfix/cartes-verification`

**Objectif :** les cartes « À vérifier » et « Corriger » ne perdent plus d'échec, ne font pas reculer la progression et ne restent pas bloquées sur une correspondance caduque.

| Cas | Gravité | Sujet |
|---|---|---|
| [BAK-01](AUDIT-2026-10-10.md#bak-01) | basse | Carte de correction importée : la progression peut reculer |
| [SYNC-07](AUDIT-2026-10-10.md#sync-07) | basse | La synchro suivante supprime la carte « Corriger » et réécrit sur la fiche contestée |
| [SYNC-03](AUDIT-2026-10-10.md#sync-03) | moyenne | Vérification manuelle : un échec MAL passager est perdu |
| [SYNC-04](AUDIT-2026-10-10.md#sync-04) | moyenne | Demande de note alors que la série est déjà notée |
| [SYNC-05](AUDIT-2026-10-10.md#sync-05) | moyenne | Correspondance en cache avec `episodes:null` jamais revalidée |
| [SYNC-06](AUDIT-2026-10-10.md#sync-06) | basse | 404 et fiche supprimée classés « passagers », cache jamais invalidé |

- **Effort :** M.
- **Dépendances :** lot 3.
- **Tests :** créer `src/background/sync/sync-service.test.ts` (mocks de `../trackers`, `../api/media`, `./resolver`, `../../shared/storage`) avec les scénarios de ce lot : `resolveReview` avec MAL en 504 passe par `recordSyncOutcome` (élément en file) ; une correction n'est acceptée que si la progression actuelle vaut `previous.progress` ; une carte avec `previous !== null` n'est pas supprimée par la synchro suivante ; pas de demande de note si un service a déjà une note ou si l'entrée était REPEATING ; une correspondance avec `episodes:null` est revalidée avec `catalog.episodes`. `queue-policy.test.ts` : `API_ERROR` 404 donne `failed` sans relance, 503 donne `retry`.
- **Vérification manuelle (Chrome) :** ouvrir « Corriger » sur une synchro, lancer l'épisode suivant sans valider : la carte reste. Finale d'une série déjà notée : aucune bulle « Noter ».
- **Migration :** à l'import d'une sauvegarde, forcer `previous` à `null` sur les `pendingReviews` (`backup.ts`). Correspondances `episodes:null` : revalidées au premier usage, sans purge globale. CHANGELOG : préciser que les corrections importées depuis une sauvegarde deviennent de simples vérifications.

### Lot 6 · `bugfix/panneau-en-lecture`

**Objectif :** le panneau « En lecture » ne reste plus bloqué en chargement et n'affiche plus la fiche d'une page quittée ; l'agenda ne jette plus ses réponses.

| Cas | Gravité | Sujet |
|---|---|---|
| [UI-01](AUDIT-2026-10-10.md#ui-01) | haute | Panneau bloqué en chargement si l'onglet se met à jour pendant la résolution |
| [UI-02](AUDIT-2026-10-10.md#ui-02) | moyenne | Le retour d'une action recharge l'ancienne page après un changement d'onglet |
| [UI-03](AUDIT-2026-10-10.md#ui-03) | moyenne | Agenda : chaque rendu relance `load()` et jette `GET_AGENDA`, erreurs comprises |

- **Effort :** M.
- **Dépendances :** aucune.
- **Tests :** `src/sidepanel/now-playing-view.test.ts` (ou un nouveau `now-playing.test.ts` avec un faux `sendMessage`) : `refresh(false)` sur la même page pendant un `resolve` en vol finit en `ready` ; une action dont la réponse arrive après un changement de `tabId` ou de `pageKey` ne touche ni la fiche ni `actions`. `src/sidepanel/tabs.test.ts` : `activate()` n'est appelé qu'au passage sur l'onglet Agenda ; une erreur `GET_AGENDA` affiche « données périmées » et le bouton Réessayer. Ajouter un scénario e2e du panneau si le harnais le permet.
- **Vérification manuelle (Chrome + Brave, puis Firefox pour le changement d'onglet) :** ouvrir le panneau pendant le chargement d'un épisode Crunchyroll : la fiche s'affiche. Cliquer « +1 » puis changer aussitôt d'onglet : la fiche du nouvel onglet reste affichée. Agenda ouvert avec AniList bloqué (outils de développement) : le message d'erreur reste visible.
- **Migration :** aucune.

### Lot 7 · `bugfix/netflix-retrait-acces`

**Objectif :** retirer l'accès Netflix arrête vraiment la synchro et le lecteur préféré Netflix.

| Cas | Gravité | Sujet |
|---|---|---|
| [CONT-03](AUDIT-2026-10-10.md#cont-03) | moyenne | Onglets Netflix déjà ouverts : la synchro continue après le retrait |
| [BRW-04](AUDIT-2026-10-10.md#brw-04) | basse | Lecteur préféré « Netflix » encore utilisé après le retrait de l'accès |

- **Effort :** S.
- **Dépendances :** aucune.
- **Tests :** `src/background/netflix-scripts.test.ts` (ou un nouveau test du routage) : `EPISODE_COMPLETED` `platform:'netflix'` sans permission donne `ignored`, sans écriture. `src/ui/settings/summary.test.ts` : un helper unique `effectivePlayer(preferred, netflixGranted)` est utilisé par le popup, le panneau, l'agenda et `airing.ts` ; sur `permissions.onRemoved`, `preferredPlayer` revient à la valeur par défaut.
- **Vérification manuelle (Chrome + Firefox) :** onglet Netflix ouvert, retirer l'accès dans `chrome://extensions` (Firefox : `about:addons`) sans recharger l'onglet, finir un épisode lié : rien n'est écrit. Notification de sortie et bouton de reprise : ils ouvrent Crunchyroll.
- **Migration :** au démarrage, si `preferredPlayer === 'netflix'` sans permission, le remettre à la valeur par défaut.

---

## Outillage et publication (sans version)

Branches `chore/…` fusionnées dans `develop` hors release. Le lot 8 doit précéder le tag `v2.1.1`.

### Lot 8 · `chore/garde-permissions-release`

**Objectif :** plus jamais de soumission refusée au Chrome Web Store pour une permission non justifiée, et une chaîne de publication verrouillée.

| Cas | Gravité | Sujet |
|---|---|---|
| [ARCH-24](AUDIT-2026-10-10.md#arch-24) | haute | Test manifest ↔ `permissions.md`, release GitHub idempotente, codes AMO |
| [ARCH-23](AUDIT-2026-10-10.md#arch-23) | haute | CLI de publication non épinglées, secrets hors environnement, tag hors `main` |
| [ARCH-32](AUDIT-2026-10-10.md#arch-32) | moyenne | Chrome headless non épinglé dans la release |

- **Effort :** S.
- **Dépendances :** aucune.
- **Tests :** `scripts/store-permissions.test.ts` : chaque entrée de `permissions`, `host_permissions` et `optional_host_permissions` de `manifest.json` a sa section dans `docs/store/permissions.md`, et l'en-tête de version y correspond. Le test doit échouer sur un manifeste où une permission fictive a été ajoutée.
- **Vérification manuelle :** lancer `release.yml` en `workflow_dispatch` à blanc (ou un tag de test sur un fork) : `npx --no-install` résout les versions du lockfile, `gh release` passe en `edit`/`upload --clobber` si la release existe, et l'étape AMO échoue sur un code autre que 200, 401, 403 ou 404. Côté GitHub : environnement `stores` limité aux tags `v*`, règle sur les tags, contrôle `merge-base --is-ancestor` avec `main`.
- **Migration :** documenter la reprise dans `docs/STORE.md` › 7 (onglet Confidentialité, puis « Re-run failed jobs »). Corriger les releases v2.0.0 et v2.1.0 rédigées à la main si leur texte est faux.

### Lot 9 · `chore/docs-stores`

**Objectif :** des fiches et des notes d'examen fidèles au code (AMO, confidentialité, build des relecteurs).

| Cas | Gravité | Sujet |
|---|---|---|
| [REL-02](AUDIT-2026-10-10.md#rel-02) | moyenne | Fiche AMO sans Netflix, renvoyée à chaque version |
| [REL-03](AUDIT-2026-10-10.md#rel-03) | basse | `approval_notes` inexactes sur les hôtes contactés |
| [REL-04](AUDIT-2026-10-10.md#rel-04) | basse | `npm ci` télécharge Chrome pour le relecteur AMO |
| [REL-06](AUDIT-2026-10-10.md#rel-06) | basse | Date d'effet de `PRIVACY.md` non mise à jour, `storage.session` absent |
| [SEC-04](AUDIT-2026-10-10.md#sec-04) | basse | `permissions.md` : `web_accessible_resources` décrit comme limité à Netflix |

- **Effort :** S.
- **Dépendances :** aucune.
- **Tests :** test Vitest : chaque plateforme citée dans `docs/store/listing-*.md` figure dans `description` de `amo-metadata.json` (en-US, fr, de).
- **Vérification manuelle :** relire `amo-metadata.json`, `PRIVACY.md` (3 langues) et `BUILD.md` (`PUPPETEER_SKIP_DOWNLOAD=true npm ci`, variante PowerShell) ; lancer cette commande dans un clone propre. Corriger la ligne de `CLAUDE.md` qui dit que seules les `approval_notes` repartent.
- **Migration :** aucune.

### Lot 10 · `chore/build-reproductible`

**Objectif :** un build Firefox identique quel que soit le dossier, et un contrôle automatique du paquet construit.

| Cas | Gravité | Sujet |
|---|---|---|
| [ARCH-22](AUDIT-2026-10-10.md#arch-22) | haute | Nom du chunk background dépendant du chemin absolu |
| [ARCH-31](AUDIT-2026-10-10.md#arch-31) | moyenne | Horodatage CI (`git log`) contre `.source-date-epoch` du relecteur |
| [ARCH-27](AUDIT-2026-10-10.md#arch-27) | moyenne | Aucune vérification du manifeste généré ni budget de taille |

- **Effort :** M.
- **Dépendances :** lot 9 (`BUILD.md`).
- **Tests :** `scripts/verify-build.ts` lancé en CI après `build` et `build:firefox` : l'entrée Netflix des `web_accessible_resources` est limitée à `*://*.netflix.com/*`, tous les fichiers référencés existent, les `*.iife.js` n'ont ni `import` ni `export` au niveau supérieur, les permissions sont identiques au manifeste source, et le budget des scripts de contenu tient en 300 Ko. Étape CI : dézipper l'archive des sources dans `/tmp/repro`, construire sans `SOURCE_DATE_EPOCH` forcé, puis `diff -r` avec le zip Firefox.
- **Vérification manuelle :** build Firefox dans deux dossiers différents sous Windows : même nom de chunk. Charger `dist/` dans Chrome et `dist-firefox/` dans Firefox : popup, panneau et synchro d'un épisode fonctionnent (le chunk renommé ne casse pas le chargeur crxjs).
- **Migration :** aucune.

### Lot 11 · `chore/verification-locale-ci`

**Objectif :** les vérifications de la CI tournent en local avant chaque fusion, sur un outillage assaini.

| Cas | Gravité | Sujet |
|---|---|---|
| [ARCH-28](AUDIT-2026-10-10.md#arch-28) | moyenne | La CI ne tourne qu'après la fusion ; checklist locale incomplète |
| [ARCH-29](AUDIT-2026-10-10.md#arch-29) | basse | `@tailwindcss/cli` inutilisé, `npm audit`, alertes Dependabot |
| [ARCH-30](AUDIT-2026-10-10.md#arch-30) | basse | Aucun linter typé (`no-floating-promises`) |

- **Effort :** S (web-ext 10 à part, sans urgence).
- **Dépendances :** aucune ; idéalement après le lot 10 pour inclure `verify-build` dans `verify`.
- **Tests :** `npm run verify` (`tsc --noEmit`, `tsc -p scripts`, `tsc -p scripts/screenshots`, `vitest run`, `build`, `build:firefox`, `lint:firefox`) passe ; lint typé limité à `no-floating-promises`, `no-misused-promises`, `switch-exhaustiveness-check` et `no-explicit-any`, après vérification de la compatibilité avec TypeScript 6.
- **Vérification manuelle :** `npm run verify` sur une copie propre ; mettre à jour la checklist de `CLAUDE.md`. Alertes Dependabot de sécurité, avec des mises à jour groupées mensuelles.
- **Migration :** aucune.

---

## 2.2.0 : socle (liaison au compte, tests d'orchestration, frontières de modules, accessibilité)

### Lot 12 · `bugfix/liaison-compte`

**Objectif :** la file, les cartes et les notes d'un compte ne sont jamais rejouées sur un autre compte.

| Cas | Gravité | Sujet |
|---|---|---|
| [DATA-01](AUDIT-2026-10-10.md#data-01) | moyenne | File, notes et synchros récentes rejouées sur un autre compte |
| [CRI-03](AUDIT-2026-10-10.md#cri-03) | basse | Changement de compte pendant l'application de l'import |
| [AUTH-06](AUDIT-2026-10-10.md#auth-06) | basse | Jeton AniList expiré jamais purgé : données de l'ancien compte conservées |
| [DATA-06](AUDIT-2026-10-10.md#data-06) | basse | Jeton AniList expiré traité comme « aucun service » : données effacées |
| [TEST-10](AUDIT-2026-10-10.md#test-10) | basse | Effacements de session et plafonds de `storage.ts` non testés |

- **Effort :** M.
- **Dépendances :** lot 3 ; à faire avant le lot 13 (même module `storage.ts`).
- **Tests :** nouveau `src/shared/storage.test.ts` (faux `chrome.storage.local` en Map, verrou immédiat) : liste exacte des clés effacées par `clearUserSyncData`, `clearAniListSession` et `clearMalSession` ; `mediaMappings` et `sessionEpoch` conservés ; plafonds de `savePendingReview` (20) et `addRecentSync` (5). `queue.test.ts` : un élément enregistré avec l'epoch A et relancé sous l'epoch B est retiré sans écriture. `cr-import` : un epoch changé entre `getEntry` et `saveProgress` abandonne l'élément.
- **Vérification manuelle (Chrome) :** mettre MAL hors ligne pour remplir la file, se déconnecter d'AniList, connecter un autre compte AniList : la file de l'ancien compte disparaît et rien n'est écrit sur le nouveau.
- **Migration :** les éléments existants de `syncQueue`, `pendingRatings` et `recentSyncs` n'ont pas d'epoch. À la mise à jour, leur attribuer l'epoch courant (le compte connecté au moment de la mise à jour est le plus probable). CHANGELOG : la file et les cartes sont désormais liées au compte.

### Lot 13 · `bugfix/ecritures-sous-session`

**Objectif :** aucune écriture réseau tardive ne recrée la session ou les données d'un compte déconnecté.

| Cas | Gravité | Sujet |
|---|---|---|
| [AUTH-01](AUDIT-2026-10-10.md#auth-01) | moyenne | Un renouvellement MAL en cours ressuscite la session après la déconnexion |
| [AUTH-02](AUDIT-2026-10-10.md#auth-02) | moyenne | Effacement sur 401 sans vérifier que c'est le jeton refusé |
| [AUTH-04](AUDIT-2026-10-10.md#auth-04) | moyenne | Profil en cache sans epoch : liste « En cours » de l'ancien compte |
| [AUTH-08](AUDIT-2026-10-10.md#auth-08) | basse | Renouvellement forcé comparé au jeton relu : renouvellements en cascade |
| [DATA-05](AUDIT-2026-10-10.md#data-05) | basse | Aperçu d'import, comparaison et semaine d'agenda réécrits après déconnexion |
| [ALRT-05](AUDIT-2026-10-10.md#alrt-05) | basse | Clés `airing*` non effacées, agenda réécrit pour le compte déconnecté |

- **Effort :** M.
- **Dépendances :** lot 12.
- **Tests :** `storage.test.ts` : `writeIfSession(service, epoch, entries)` n'écrit rien si l'epoch a changé ; `clearAniListSessionIfToken` et `clearMalSessionIfToken` n'effacent que le jeton refusé. Nouveau `src/background/auth/mal.test.ts` (partagé avec le lot 14) : déconnexion pendant `requestToken` donne un jeton abandonné ; trois 401 concurrents avec le même jeton donnent un seul renouvellement.
- **Vérification manuelle (Chrome) :** jeton MAL proche de l'expiration (le modifier dans le stockage), ouvrir le popup puis se déconnecter de MAL aussitôt : le compte reste déconnecté. Se déconnecter pendant une vérification des sorties : l'agenda est vide.
- **Migration :** ajouter `airingNotified`, `airingTargets`, `airingLastCheck` et `airingLastResult` à `clearUserSyncData`. Pas de purge des données existantes.

### Lot 14 · `bugfix/auth-erreurs`

**Objectif :** des erreurs d'authentification exactes et des renouvellements MAL bornés, testés.

| Cas | Gravité | Sujet |
|---|---|---|
| [AUTH-03](AUDIT-2026-10-10.md#auth-03) | moyenne | Session invalidée en arrière-plan affichée « Non connecté » |
| [AUTH-05](AUDIT-2026-10-10.md#auth-05) | basse | Aucun délai sur l'endpoint de jeton MAL appelé sous verrou |
| [AUTH-07](AUDIT-2026-10-10.md#auth-07) | basse | 5xx et 429 du renouvellement sans statut HTTP : tâches arrêtées |
| [AUTH-09](AUDIT-2026-10-10.md#auth-09) | basse | Délai dépassé pendant la lecture du corps présenté comme « réponse invalide » |
| [AUTH-10](AUDIT-2026-10-10.md#auth-10) | basse | Échec de l'échange du code MAL affiché « session expirée » |
| [TEST-02](AUDIT-2026-10-10.md#test-02) | moyenne | Renouvellement du jeton MAL non testé |
| [TEST-03](AUDIT-2026-10-10.md#test-03) | moyenne | « Invalid token » AniList et 401/429 de `malRequest` non testés |

- **Effort :** M.
- **Dépendances :** lot 13 (même `auth/mal.ts`).
- **Tests :** `src/background/auth/mal.test.ts` : deux appels concurrents donnent un seul POST ; 400 efface la session ; 503 lève une erreur `httpStatus` 503 avec la session intacte ; 429 donne `RATE_LIMITED` ; le délai est respecté ; un `state` différent donne `INVALID_RESPONSE`. `src/background/api/client.test.ts` : « Invalid token » en mode public donne un rejeu sans `Authorization`, en mode `required` `TOKEN_INVALID`, 200 avec `errors` `API_ERROR`. `src/background/api/mal.test.ts` : 401 puis renouvellement puis succès ; 429 avec `Retry-After` ; délai pendant `json()` donne `NETWORK` avec `timedOut`. `src/ui/accounts` : l'indicateur `sessionExpired:<service>` donne `expired: true`.
- **Vérification manuelle (Chrome + Firefox) :** révoquer l'accès SyncKai sur AniList, attendre une synchro, ouvrir le popup : « Session expirée » en rouge. Firefox : première connexion MAL avec une URL de redirection erronée affiche le message dédié avec l'URL attendue.
- **Migration :** aucune.

### Lot 15 · `chore/tests-orchestration`

**Objectif :** couvrir le chemin d'écriture du service worker par une table de décision et quelques scénarios d'intégration.

| Cas | Gravité | Sujet |
|---|---|---|
| [TEST-01](AUDIT-2026-10-10.md#test-01) | moyenne | `sync-service.ts` sans test |
| [TEST-07](AUDIT-2026-10-10.md#test-07) | moyenne | `queue.ts` sans test |
| [TEST-06](AUDIT-2026-10-10.md#test-06) | moyenne | `createJobLoop` sans test |
| [ARCH-25](AUDIT-2026-10-10.md#arch-25) | moyenne | Fausse API chrome partagée et mesure de couverture |

- **Effort :** M.
- **Dépendances :** lots 3 et 5 (le fichier `sync-service.test.ts` existe déjà).
- **Tests :** `src/test/fake-chrome.ts` (`storage.local`/`session` avec `onChanged`, `alarms`, `navigator.locks` avec `ifAvailable`, `fetch` scriptable). Compléter `sync-service.test.ts` avec la table de décision de TEST-01 (exclusions, `ignored`, faible confiance, `idMal` null, garde « au-delà de la fiche »). `src/background/sync/queue.test.ts` : échec réseau donne une entrée et l'alarme ; succès ultérieur vide la file et retire l'alarme ; succès partiel `only=['mal']` ; deux `processSyncQueue` simultanés donnent un seul `syncEpisode`. `src/background/jobs/runner.test.ts` : faux timers, `cancel` pendant la pause, `ensure()` sur une boucle muette depuis plus de `JOB_STALE_MS`, `step.stop`. `@vitest/coverage-v8` en rapport seulement, sans seuil bloquant.
- **Vérification manuelle :** aucune (tests seuls).
- **Migration :** aucune.

### Lot 16 · `bugfix/import-crunchyroll`

**Objectif :** un import d'historique robuste aux erreurs passagères, linéaire en coût et conforme à la politique de confidentialité.

| Cas | Gravité | Sujet |
|---|---|---|
| [CRI-05](AUDIT-2026-10-10.md#cri-05) | basse | Nouvel essai : écriture réussie rapportée en échec, correspondance non apprise |
| [CRI-01](AUDIT-2026-10-10.md#cri-01) | moyenne | Une erreur passagère fait perdre toute la lecture de l'historique |
| [ARCH-14](AUDIT-2026-10-10.md#arch-14) | moyenne | Tâches de fond non reprises après une mise à jour |
| [CRI-04](AUDIT-2026-10-10.md#cri-04) | basse | Historique réduit conservé après un arrêt ou un échec |
| [CRI-06](AUDIT-2026-10-10.md#cri-06) | basse | 400 sans `invalid_client` classé « déconnecté » ; justification du Store |
| [PERF-02](AUDIT-2026-10-10.md#perf-02) | basse | Relecture et réécriture complètes à chaque saison (coût quadratique) |
| [UI-06](AUDIT-2026-10-10.md#ui-06) | basse | Blocs « Déjà à jour » / « À vérifier » repliés à chaque progression |
| [TEST-05](AUDIT-2026-10-10.md#test-05) | moyenne | `background/cr-import.ts` sans test |

- **Effort :** L (découper en deux commits si la relecture l'exige : robustesse puis performance).
- **Dépendances :** lots 3, 12 et 15 (fausse API chrome).
- **Tests :** nouveau `src/background/cr-import.test.ts` (scénarios de TEST-05) : saison sans numéro connu, donc à vérifier ; `persist:false` ; AniList OK puis MAL 503 : seul MAL est retenté et AniList compté « mis à jour » avec la correspondance apprise ; arrêt donne `input` et `resolutions` effacés ; résolutions écrites par lots. `src/content/lib/crunchyroll-history.test.ts` : 429 avec `Retry-After` puis succès ; échec persistant d'une recherche de saison donne une position inconnue, pas un abandon ; 400 `invalid_request` donne `unavailable`. `src/background` : `onInstalled` appelle `resumeCompareJob` et `resumeCrImport`. `scripts/e2e/import-cr.e2e.ts` : l'état ouvert des `<details>` survit à un `draw()`.
- **Vérification manuelle (Chrome) :** import d'un vrai historique avec une coupure Wi-Fi brève pendant les recherches de saison ; recharger l'extension pendant l'application, puis vérifier la reprise sans redémarrer le navigateur.
- **Migration :** au démarrage, supprimer `crImport:input` et `crImport:resolutions` orphelins (tâche absente ou terminée). Mettre à jour `PRIVACY.md` et `docs/store/permissions.md` (jeton temporaire demandé à Crunchyroll avec l'identifiant public du site) et documenter la rotation de `CR_WEB_CLIENT_ID` dans `docs/STORE.md`.

### Lot 17 · `bugfix/alertes-sortie`

**Objectif :** des alertes de sortie justes sans ouvrir le popup, sans trou ni perte.

| Cas | Gravité | Sujet |
|---|---|---|
| [ALRT-01](AUDIT-2026-10-10.md#alrt-01) | moyenne | Alertes basées sur un cache « En cours » que seul le popup rafraîchit |
| [ALRT-04](AUDIT-2026-10-10.md#alrt-04) | basse | `airingNotified` validé avant la création des notifications |
| [ALRT-02](AUDIT-2026-10-10.md#alrt-02) | basse | Baisse du délai : épisodes de l'intervalle jamais notifiés |
| [ALRT-06](AUDIT-2026-10-10.md#alrt-06) | basse | Pagination tronquée en silence : les sorties récentes sont perdues |
| [ALRT-03](AUDIT-2026-10-10.md#alrt-03) | basse | Série exclue sans `mediaId` toujours notifiée |
| [PERF-04](AUDIT-2026-10-10.md#perf-04) | basse | Profils et liste « En cours » rechargés à chaque ouverture |

- **Effort :** M.
- **Dépendances :** lot 13 (epoch dans `runCheck`).
- **Tests :** `airing-policy.test.ts` : fenêtre reprise à la dernière borne couverte quand le délai passe de 6 h à 0 h. Nouveau `src/background/airing.test.ts` (fausse API chrome) : un cache plus vieux que 12 h est rafraîchi avant le calcul ; une notification qui échoue est retirée de `airingNotified` ; troncature donne un cache de semaine marqué incomplet. `agenda.test.ts` : exclusion par `platformKey`. `src/shared/watching.test.ts` : `GET_WATCHING` sans `force` et récent de moins de 90 s ne relance pas de requête.
- **Vérification manuelle (Chrome) :** popup fermé pendant plus de 12 h, puis une série suivie sort : l'alerte arrive. Exclure une série depuis Crunchyroll avant la résolution de la fiche : elle disparaît de l'agenda.
- **Migration :** aucune.

### Lot 18 · `bugfix/stockage-local`

**Objectif :** des écritures de stockage verrouillées, non destructives et bornées.

| Cas | Gravité | Sujet |
|---|---|---|
| [BAK-02](AUDIT-2026-10-10.md#bak-02) | basse | Correspondances importées peu validées, utilisées en confiance high |
| [ARCH-15](AUDIT-2026-10-10.md#arch-15) | basse | Réécritures destructives de `mediaMappings` (écrire sur l'objet brut) |
| [DATA-02](AUDIT-2026-10-10.md#data-02) | basse | « Ignorer » une note réécrit `pendingRatings` sans verrou |
| [ARCH-18](AUDIT-2026-10-10.md#arch-18) | basse | Écritures hors verrou de `import-cr.ts`, réveils dus à `storage.session` |
| [DATA-03](AUDIT-2026-10-10.md#data-03) | basse | Élagage des délais par série : les plus petits `mediaId`, pas les plus anciens |
| [DATA-04](AUDIT-2026-10-10.md#data-04) | basse | Caches `storage.session` jamais purgés ni effacés à la déconnexion |

- **Effort :** M.
- **Dépendances :** lot 12.
- **Tests :** `backup.test.ts` : `mediaId` 1.5 ou -3, offset -500, clé hors motif `^(crunchyroll|adn|netflix):.+:s\d+$` sont rejetés. `storage.test.ts` : une entrée illisible de `mediaMappings` survit à `saveMediaMapping`. `engagement-store.test.ts` : une seule garde `isPendingRating` ; `popup/pending-ratings.ts` et son test supprimés. `settings.test.ts` : 200 délais plus un réglage sur l'id 21 gardent l'id 21 (insertion dans le désordre). `page-media-cache.test.ts` : purge des `pageMedia:*` et `panelMedia:*` expirés, effacement à la déconnexion.
- **Vérification manuelle (Chrome) :** importer une sauvegarde forgée avec un offset absurde : la correspondance est refusée. « Ignorer » une note dans le popup pendant qu'une finale se termine dans un autre onglet : la nouvelle carte reste.
- **Migration :** les délais par série passent au format `{ minutes, at }` ; convertir les anciens en conservant tout (`at` = date de mise à jour). Les correspondances importées marquées « à revérifier » au premier usage.

### Lot 19 · `bugfix/extraction-episode`

**Objectif :** une extraction d'épisode Crunchyroll et ADN testée sur des données réelles, sans effet de bord sur les pages hôtes.

| Cas | Gravité | Sujet |
|---|---|---|
| [CONT-04](AUDIT-2026-10-10.md#cont-04) | moyenne | JSON-LD périmé accepté s'il n'a ni `url` ni `@id` |
| [TEST-04](AUDIT-2026-10-10.md#test-04) | moyenne | Extraction de la page de lecture Crunchyroll et ADN non testée |
| [ARCH-01](AUDIT-2026-10-10.md#arch-01) | moyenne | Le script de contenu réécrit `<html lang>` des sites |
| [PERF-03](AUDIT-2026-10-10.md#perf-03) | basse | Chaque onglet de streaming écoute `storage.onChanged` |

- **Effort :** M.
- **Dépendances :** aucune.
- **Tests :** fixtures réelles anonymisées et datées dans `src/content/adapters/__fixtures__/` (One Piece : `episodeNumber` 25, nom « Elbaph | E1180 - … » ; ADN). `crunchyroll.test.ts` : `episodeFromJsonLdNodes` sépare `seasonEpisodeNumber` et `displayedEpisodeNumber` ; un nœud sans `url` resté sur E1180 est rejeté quand le `<h1>` annonce E1181. `adn.test.ts` : extraction de la page de lecture. `src/i18n` : `initI18n({ setDocumentLang: false, follow: false })` laisse `document.documentElement.lang` intact et ne pose aucun écouteur.
- **Vérification manuelle (Chrome + Firefox) :** lecture automatique One Piece E1180 vers E1181 : le popup affiche E1181. Crunchyroll en espagnol avec SyncKai en anglais : `document.documentElement.lang` reste `es-419`, et l'import récupère les titres espagnols.
- **Migration :** aucune.

### Lot 20 · `chore/frontieres-modules`

**Objectif :** casser les cycles d'import et remonter le kit UI hors de `popup/`.

| Cas | Gravité | Sujet |
|---|---|---|
| [ARCH-04](AUDIT-2026-10-10.md#arch-04) | moyenne | `ui/` importe `popup/`, deux cycles d'import |
| [ARCH-11](AUDIT-2026-10-10.md#arch-11) | moyenne | `STORAGE_KEYS` importé depuis `storage.ts` par des modules de types |

- **Effort :** M (renommages mécaniques).
- **Dépendances :** à faire après les lots 6 et 18 pour limiter les conflits ; avant le lot 21.
- **Tests :** `src/architecture.test.ts` minimal : aucun cycle, `shared ↛ ui/popup/sidepanel/content`, `ui ↛ popup/sidepanel`. Nouvelle feuille `src/shared/storage-keys.ts`, `normalizeTitle` sorti de `matching.ts`.
- **Vérification manuelle (Chrome) :** popup, panneau, réglages, import de sauvegarde et import Crunchyroll s'ouvrent sans erreur console ; `npm run test:e2e` passe.
- **Migration :** aucune. Règles des frontières décrites en 10 lignes dans `CLAUDE.md`.

### Lot 21 · `feature/controleur-fiche-page`

**Objectif :** une seule machine d'état « fiche de la page » pour le popup et le panneau, et un choix de saison qui compte pour la synchro.

| Cas | Gravité | Sujet |
|---|---|---|
| [ARCH-20](AUDIT-2026-10-10.md#arch-20) | moyenne | Saison choisie dans le panneau ignorée par la synchro |
| [ARCH-05](AUDIT-2026-10-10.md#arch-05) | moyenne | Contrôleur « fiche de la page » dupliqué popup/panneau |

- **Effort :** M.
- **Dépendances :** lots 6 et 20.
- **Tests :** `src/ui/page-media-controller.test.ts` : états `detecting`, `loading`, `ready`, `not-found` et `error` alignés ; anti-écho ; réponse tardive après changement de page ignorée. `page-media.test.ts` : un choix de saison manuel enregistre la correspondance (`mediaMappings`), et `EPISODE_COMPLETED` l'utilise.
- **Vérification manuelle (Chrome + Firefox) :** choisir une autre saison dans le panneau puis finir l'épisode : la progression part sur la saison choisie. Même page dans le popup et le panneau : mêmes états et mêmes messages.
- **Migration :** aucune. CHANGELOG : le choix de saison du panneau est mémorisé comme correspondance (« Oublier » pour revenir en arrière).

### Lot 22 · `feature/accessibilite`

**Objectif :** un focus clavier stable et des annonces de lecteur d'écran non répétées.

| Cas | Gravité | Sujet |
|---|---|---|
| [UX-01](AUDIT-2026-10-10.md#ux-01) | moyenne | Focus perdu quand le bouton actif est désactivé ou retiré |
| [UX-02](AUDIT-2026-10-10.md#ux-02) | moyenne | Zones `role="alert"` recréées à chaque rendu |
| [PERF-06](AUDIT-2026-10-10.md#perf-06) | basse | Rendu complet du popup chaque seconde et sans regroupement |

- **Effort :** M.
- **Dépendances :** lot 20 (kit UI déplacé).
- **Tests :** test de `src/ui/dom.ts` : un bouton en `aria-disabled` garde le focus ; un élément retiré donne le focus à `data-focus-fallback`. `scripts/e2e/popup.e2e.ts` : Tab jusqu'au +1, Entrée, `document.activeElement` est toujours le +1 ; le nœud `role="alert"` du bandeau d'accès est le même objet entre deux rendus ; `scheduleRender()` ne déclenche qu'un rendu par tour.
- **Vérification manuelle (Firefox + NVDA, Chrome au clavier) :** +1, « Réessayer » et « Oublier » au clavier ; bandeau d'accès retiré sous Firefox : une seule annonce.
- **Migration :** aucune.

### Lot 23 · `bugfix/finitions-ui`

**Objectif :** petites erreurs d'interface et de textes (3 langues).

| Cas | Gravité | Sujet |
|---|---|---|
| [UI-04](AUDIT-2026-10-10.md#ui-04) | basse | Carte de compte bloquée sur le squelette sans erreur |
| [UI-05](AUDIT-2026-10-10.md#ui-05) | basse | Entrée sur un délai vide enregistre 0 minute |
| [UI-07](AUDIT-2026-10-10.md#ui-07) | basse | Import de sauvegarde : un autre fichier choisi pendant l'import écrase l'état |
| [BRW-02](AUDIT-2026-10-10.md#brw-02) | basse | Firefox : « Modifier le raccourci » ouvre une URL `chrome://` |
| [UX-05](AUDIT-2026-10-10.md#ux-05) | basse | Netflix absent de l'accueil, de l'état vide et du panneau hors cible |
| [UX-06](AUDIT-2026-10-10.md#ux-06) | basse | Astuce « Réglages › Lecture » sans entrée correspondante |
| [UX-07](AUDIT-2026-10-10.md#ux-07) | basse | Ponctuation française codée en dur sur la page d'import |
| [BAK-05](AUDIT-2026-10-10.md#bak-05) | basse | Nom du fichier d'export toujours en français, export par blob depuis le popup |

- **Effort :** M (nombreux mais petits).
- **Dépendances :** lot 20 de préférence.
- **Tests :** `src/i18n/locales.test.ts` : clés `crImport.labelValue` présentes dans les 3 langues. `src/ui/settings/navigation.test.ts` : chemin de l'astuce construit depuis `settings.cat.sync`. Tests unitaires de la lecture du champ de délai (vide donne NaN) et de `page-accounts` (viewer null avec erreur donne une alerte avec Réessayer). Régénérer les captures (`npm run screenshots`) si les textes affichés changent.
- **Vérification manuelle :** Firefox : bouton du raccourci (ouvre `browser.commands.openShortcutSettings()` ou affiche l'aide). Export depuis le popup avec « Toujours demander où enregistrer » sous Firefox et Chrome. Page d'import en anglais et en allemand.
- **Migration :** aucune.

### Lot 24 · `feature/durcissement-securite`

**Objectif :** tenir la règle de `CLAUDE.md` sur les jetons, restreindre les images et les messages.

| Cas | Gravité | Sujet |
|---|---|---|
| [SEC-01](AUDIT-2026-10-10.md#sec-01) | basse | Jetons OAuth en clair dans `storage.local`, lisibles par les scripts de contenu |
| [SEC-02](AUDIT-2026-10-10.md#sec-02) | basse | URLs de couverture non validées, pas de CSP `img-src` |
| [ARCH-07](AUDIT-2026-10-10.md#arch-07) | basse | Liste de refus des messages au lieu d'une liste d'autorisation |

- **Effort :** M.
- **Dépendances :** lots 13 et 14 (même code de jetons).
- **Tests :** `storage.test.ts` : jeton chiffré en AES-GCM avec une clé non extractible conservée dans IndexedDB ; un ancien jeton en clair est migré au premier accès. `messages.test.ts` : `MESSAGE_ORIGINS` exhaustif, et les types `content` correspondent exactement aux envois de `src/content`. `engagement-store.test.ts` et `backup.test.ts` : `coverUrl` hors liste d'hôtes rejetée.
- **Vérification manuelle (Chrome + Firefox) :** après la mise à jour, AniList et MAL restent connectés (migration des jetons) ; les couvertures s'affichent ; aucune erreur CSP en console dans le popup, le panneau ni les pages d'import.
- **Migration :** chiffrement des jetons existants à la mise à jour ; en cas d'échec, déconnexion propre avec « Session expirée ». La CSP `extension_pages` modifie le manifeste : la vérifier sous Firefox, et vérifier que la fiche du Chrome Web Store n'a rien à justifier (ce n'est pas une permission).

---

## 2.3.0 : plateformes

### Lot 25 · `chore/registre-plateformes`

**Objectif :** un descripteur unique par plateforme (libellé, hôtes, `linkRequired`, URLs), préalable à toute nouvelle plateforme.

| Cas | Gravité | Sujet |
|---|---|---|
| [ARCH-02](AUDIT-2026-10-10.md#arch-02) | moyenne | Registre des plateformes (périmètre réduit : `shared/platforms.ts` seul) |

- **Effort :** S.
- **Dépendances :** lots 1 et 20.
- **Tests :** `src/shared/platforms.test.ts` : `Record<StreamingPlatform, …>` exhaustif ; `matchPlatformLink`, `platform-links.ts` et les libellés passent par le registre. Non-régression avec `matching-netflix.test.ts` et `platform-links.test.ts`.
- **Vérification manuelle (Chrome) :** liens « Ouvrir » et icônes de plateforme dans le popup, le panneau et l'agenda.
- **Migration :** aucune. L'extraction de `optional-platforms.ts` et de `main-bridge.ts` attend une deuxième plateforme optionnelle.

L'adaptateur HIDIVE (`feature/hidive-adapter`, hors audit) se branche sur ce registre. Un nouvel hôte dans `host_permissions` ou `content_scripts` déclenche un avertissement de permission sous Chrome, et l'extension est désactivée jusqu'à l'acceptation de l'utilisateur : passer par `optional_host_permissions` comme Netflix, ou l'assumer explicitement. Dans les deux cas, justifier la permission dans l'onglet Confidentialité du Chrome Web Store avant le tag.

### Lot 26 · `bugfix/reattachement-video`

**Objectif :** la session de lecture suit le bon `<video>` jusqu'au bout et ne perd plus un épisode en silence.

| Cas | Gravité | Sujet |
|---|---|---|
| [CONT-01](AUDIT-2026-10-10.md#cont-01) | moyenne | `<video>` figée au démarrage : complétion manquée si le lecteur est remplacé |
| [CONT-02](AUDIT-2026-10-10.md#cont-02) | moyenne | Attente du lecteur limitée à 30 s sans nouvel essai |
| [CONT-06](AUDIT-2026-10-10.md#cont-06) | basse | Script orphelin après une mise à jour : prévient seulement à la fin |
| [CONT-05](AUDIT-2026-10-10.md#cont-05) | basse | Échec d'envoi sans « Réessayer », complétion désarmée |
| [CONT-07](AUDIT-2026-10-10.md#cont-07) | basse | Netflix : « Réessayer » reste actif pendant l'envoi (doublons) |
| [CTRL-07](AUDIT-2026-10-10.md#ctrl-07) | basse | Raccourci « valider l'épisode » sans retour quand il ne fait rien |
| [TEST-09](AUDIT-2026-10-10.md#test-09) | basse | `trackVideoProgress` jamais exécuté en test |

- **Effort :** L.
- **Dépendances :** lot 19 (fixtures et i18n du contenu), lot 15 pour les faux timers.
- **Tests :** nouveau `src/content/lib/video-tracker.test.ts` (fausse vidéo basée sur `EventTarget`) : un seul `onCompleted` ; réarmement sur `loadstart` ; durée inférieure à 120 s ignorée ; plus aucun appel après `abort`. `watch-session.test.ts` : `<video>` détachée puis remplacée, donc tracker recréé ; lecteur apparu après 35 s (`play` capté sur `document`) ; `sendMessage` qui lève donne un toast avec Réessayer ; pause de la synchro, puis `forceComplete` renvoie l'épisode ; double clic sur Réessayer donne un seul envoi ; contexte invalidé détecté au démarrage de la session. Test de la réinjection `onInstalled` avec garde `STARTED_FLAG`.
- **Vérification manuelle (Chrome + Brave + Firefox) :** lecture automatique Crunchyroll et Netflix jusqu'à l'épisode suivant ; épisode ouvert dans un onglet en arrière-plan puis regardé plus d'une minute après ; recharger l'extension avec un onglet Crunchyroll ouvert : avertissement immédiat ou script réinjecté ; Alt+Maj+S sur un épisode déjà synchronisé affiche un toast.
- **Migration :** aucune. La réinjection utilise la permission `scripting` déjà déclarée (2.1.0) : pas de nouvelle justification.

### Lot 27 · `feature/agenda-hors-cible`

**Objectif :** l'agenda et le panneau sont accessibles hors d'un onglet de streaming.

| Cas | Gravité | Sujet |
|---|---|---|
| [UX-04](AUDIT-2026-10-10.md#ux-04) | basse | Agenda inaccessible hors d'un onglet Crunchyroll, ADN ou Netflix |

- **Effort :** M.
- **Dépendances :** lots 6 et 21.
- **Tests :** `src/sidepanel/tabs.test.ts` et `presence.test.ts` : hors cible, onglets Agenda et Réglages disponibles, Agenda par défaut ; « En lecture » réservé à l'onglet suivi. e2e : bouton « Ouvrir le panneau » visible hors cible.
- **Vérification manuelle (Chrome + Firefox) :** ouvrir le panneau sur un site quelconque : l'agenda s'affiche et le panneau ne se ferme pas (Chrome, `presence.ts`).
- **Migration :** aucune.

---

## Plus tard

### Lot 28 · `chore/popup-controleurs`

**Objectif :** découper `popup.ts` en contrôleurs au fil de l'eau, quand une fonctionnalité y touche.

| Cas | Gravité | Sujet |
|---|---|---|
| [ARCH-08](AUDIT-2026-10-10.md#arch-08) | basse | `popup.ts` de 1 382 lignes, trois conventions d'état, menus doublés |

- **Effort :** L (par petites extractions : `compare`, `ratings`, `queue`, puis `watching`).
- **Dépendances :** lots 21 et 22 (regroupement des rendus déjà fait).
- **Tests :** chaque contrôleur extrait reçoit son test unitaire avec la fausse API chrome ; `npm run test:e2e` à chaque extraction.
- **Vérification manuelle :** popup complet sous Chrome et Firefox après chaque extraction.
- **Migration :** aucune.

### Lot 29 · `chore/i18n-contenu-leger`

**Objectif :** ne charger dans les scripts de contenu que les clés utiles, ou la seule langue active.

| Cas | Gravité | Sujet |
|---|---|---|
| [PERF-01](AUDIT-2026-10-10.md#perf-01) | basse | 3 catalogues i18n complets dans chaque script de contenu (~255 Ko) |

- **Effort :** M.
- **Dépendances :** lots 10 (budget de taille) et 19.
- **Tests :** `verify-build.ts` : budget resserré à 80 Ko pour le chargeur de contenu ; `locales.test.ts` : toutes les clés `content.*` utilisées existent dans le catalogue réduit.
- **Vérification manuelle (Chrome + Firefox) :** toasts et bulles du script de contenu dans les 3 langues, changement de langue pris en compte à la session suivante.
- **Migration :** aucune.

---

## Regroupés / écartés

Chaque ligne renvoie au cas principal qui porte le correctif. Aucun cas n'est écarté : les recommandations surdimensionnées sont réduites dans le lot de leur cas principal (ARCH-02, ARCH-15, ARCH-19, ARCH-25).

| Cas | Rattaché à | Raison |
|---|---|---|
| [ARCH-13](AUDIT-2026-10-10.md#arch-13) | [SYNC-02](AUDIT-2026-10-10.md#sync-02) (lot 2) | Même défaut : relecture avant l'alignement |
| [CTRL-05](AUDIT-2026-10-10.md#ctrl-05) | [UI-02](AUDIT-2026-10-10.md#ui-02) (lot 6) | Même scénario `runAction` dans `now-playing.ts:347` |
| [CTRL-06](AUDIT-2026-10-10.md#ctrl-06) | [ARCH-12](AUDIT-2026-10-10.md#arch-12) (lot 3) | Verrou par fiche autour de `adjustOnService` |
| [BRW-03](AUDIT-2026-10-10.md#brw-03) | [CONT-03](AUDIT-2026-10-10.md#cont-03) (lot 7) | Même cas : onglet Netflix ouvert après le retrait |
| [BAK-03](AUDIT-2026-10-10.md#bak-03) | [BRW-04](AUDIT-2026-10-10.md#brw-04) (lot 7) | Même correctif : lecteur préféré effectif centralisé |
| [UX-03](AUDIT-2026-10-10.md#ux-03) | [BRW-02](AUDIT-2026-10-10.md#brw-02) (lot 23) | Même bouton de raccourci sous Firefox |
| [BAK-04](AUDIT-2026-10-10.md#bak-04) | [DATA-03](AUDIT-2026-10-10.md#data-03) (lot 18) | Même élagage de `seriesOffsets` |
| [PERF-05](AUDIT-2026-10-10.md#perf-05) | [DATA-04](AUDIT-2026-10-10.md#data-04) (lot 18) | Mêmes caches `storage.session` non purgés |
| [SEC-03](AUDIT-2026-10-10.md#sec-03) | [DATA-04](AUDIT-2026-10-10.md#data-04) (lot 18) | Effacement de `pageMedia:*` à la déconnexion, inclus dans DATA-04 |
| [ARCH-06](AUDIT-2026-10-10.md#arch-06) | [DATA-02](AUDIT-2026-10-10.md#data-02) (lot 18) | Suppression du second store « À noter » non verrouillé |
| [ARCH-16](AUDIT-2026-10-10.md#arch-16) | [ALRT-01](AUDIT-2026-10-10.md#alrt-01) (lot 17) | Même cache « En cours » non rafraîchi |
| [ARCH-17](AUDIT-2026-10-10.md#arch-17) | [AUTH-01](AUDIT-2026-10-10.md#auth-01) (lot 13) | Helper `writeIfSession` appliqué à AUTH-01, AUTH-04, DATA-05 et ALRT-05 |
| [ARCH-19](AUDIT-2026-10-10.md#arch-19) | [PERF-02](AUDIT-2026-10-10.md#perf-02) (lot 16) | Seul point retenu : `writeResolution` par lots ; LRU et index de clés jugés spéculatifs |
| [ARCH-09](AUDIT-2026-10-10.md#arch-09) | [TEST-01](AUDIT-2026-10-10.md#test-01) (lot 15) | Même table de décision sur `syncEpisode` |
| [ARCH-26](AUDIT-2026-10-10.md#arch-26) | [TEST-04](AUDIT-2026-10-10.md#test-04) (lot 19) | Fixtures réelles datées ; happy-dom seulement si un repli DOM l'exige |
| [ARCH-03](AUDIT-2026-10-10.md#arch-03) | [PERF-01](AUDIT-2026-10-10.md#perf-01) (lot 29) | Gain réel uniquement côté i18n ; scission de `messages.ts` sans effet ; budget dans le lot 10 |
| [ARCH-10](AUDIT-2026-10-10.md#arch-10) | [PERF-01](AUDIT-2026-10-10.md#perf-01) (lot 29) | Constat complémentaire du même poids i18n |
| [REL-01](AUDIT-2026-10-10.md#rel-01) | [ARCH-24](AUDIT-2026-10-10.md#arch-24) (lot 8) | Même échec CWS ; ARCH-24 porte le garde-fou automatique |
| [REL-05](AUDIT-2026-10-10.md#rel-05) | [ARCH-23](AUDIT-2026-10-10.md#arch-23) (lot 8) | Même épinglage des CLI de publication |

---

## Rappel : checklist de release

Commune à chaque version (voir `CLAUDE.md` et `docs/STORE.md`) :

1. Branche `release/x.y.z` depuis `develop`.
2. `npm version x.y.z --no-git-tag-version` (`manifest.json`, `package.json`, `package-lock.json`), puis grep de l'ancienne version (pied de page du popup, harnais des captures).
3. Entrée `CHANGELOG.md` (FR, Keep a Changelog), commit `chore(release): x.y.z`.
4. **Permissions** : si `permissions`, `host_permissions` ou `optional_host_permissions` changent, mettre à jour `docs/store/permissions.md` **et** l'onglet Confidentialité du tableau de bord du Chrome Web Store **avant le tag**. Les soumissions 2.0.0 et 2.1.0 ont échoué faute de justification. Reporter aussi le changement dans `amo-metadata.json` et les fiches.
5. `npm run verify` (après le lot 11) et `npm run test:e2e` avant le tag : le job `build` de `release.yml` les rejoue, et un échec bloque l'envoi aux stores.
6. `npm run screenshots` si l'interface ou la version affichée change.
7. Fast-forward sur `main`, tag annoté `vx.y.z` (« SyncKai x.y.z »), `develop` aligné, push : seulement après un go explicite.

Points propres à chaque version :

- **2.1.1** : aucune nouvelle permission attendue (le test du lot 8 le confirme). Lot 8 fusionné avant le tag. CHANGELOG : note sur les correspondances fausses (lot 1 : vérifier les séries précédentes, « Oublier » dans *Réglages › Mes données*), purge des correspondances `netflix:*`, alignement qui ignore les séries modifiées. Test manuel complet sous Chrome et Firefox (lots 1, 6 et 7).
- **2.2.0** : migrations à la mise à jour (epoch de la file, format des délais par série, chiffrement des jetons) testées en installant la 2.1.1 puis en mettant à jour vers le build local. La CSP du lot 24 change le manifeste : vérifier `web-ext lint` et l'absence d'erreur CSP. CHANGELOG : liaison au compte, choix de saison mémorisé.
- **2.3.0** : toute nouvelle plateforme (HIDIVE, Prime Video, Disney+) ajoute un hôte. Préférer `optional_host_permissions` pour éviter la désactivation à la mise à jour sous Chrome, et justifier la permission dans l'onglet Confidentialité avant le tag. Mettre à jour `PRIVACY.md` (date d'effet), `permissions.md`, les fiches et `amo-metadata.json`.
