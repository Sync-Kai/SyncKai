# SyncKai : synthèse des 7 audits (architecture, logique, contenu, perf, UI, sécurité, domaines, dossiers)

Base auditée : `develop` = `9a5d08c` (`feature/match-signals` fusionnée), 2026-10-15. Sources :
`1-business-logic.md`, `2-content-architecture.md`, `3-performance.md`, `4-ui-architecture.md`, `5-security-quality.md`,
`6-business-domains.md`, `7-folder-architecture.md` (même dossier). Synthèse en lecture seule : rien n'a été modifié dans le dépôt.

**Convention d'identifiants.** Les familles R, D et A existent dans plusieurs audits : elles portent ici le numéro de
l'audit en préfixe (`2-R1` = réutilisation XHR dans les ponts, `4-R1` = course de l'import ; `1-D1`, `4-D1`, `6-D1`).
Les optimisations de bundle de l'audit 2 sont notées `2-A` … `2-H`. Les autres identifiants sont uniques et gardent
leur forme : H1/M1/L1/I1 (audit 1), PERF-xx (3), SEC-xx (5), B1/P1 (6), étapes 0–10 (7).

**Statuts.** « en cours (nuit) » = en correction cette nuit sur `bugfix/matching-audit`, `bugfix/score-and-backup` ou
`bugfix/bridge-hardening` (aucun commit au moment de la synthèse) ; « proposé » = tout le reste ; « décision » = à
trancher par le propriétaire (§3).

---

## 1. Résumé exécutif

1. Le code est sain : aucun constat CRITIQUE dans les 7 audits. Il n'y a ni `any`, ni sink HTML, ni cycle de fichiers. Les jetons sont chiffrés, les messages filtrés et les couches testées par `architecture.test.ts`. Les tests unitaires (2456) et le corpus (63 cas réels) sont solides.
2. Les deux seuls constats HAUTS (H1, H2) concernent le matching : une fiche fausse peut être synchronisée en `high` puis apprise. Ils sont en correction cette nuit, comme les 6 MOYENS de données (M1–M3, B1, B2) et les durcissements des ponts.
3. Le risque principal est la marge : le script CR/ADN est à 83,0/83 KB, donc aucune évolution n'est possible sur ces plateformes. Des gains mesurés existent : −8 KB (IIFE autonome), −10,8 KB (lecteurs d'historique à la demande), puis la séparation CR/ADN (≈ 55 / 45 KB visés).
4. Il y a ensuite la duplication des règles métier (identité de série ×5, verrou → lecture → décision → session → écriture ×6, règles « vu » et réducteurs d'import ×3, kit des ponts ×3), qui a déjà produit des divergences (M4, M5, B1, B4).
5. Côté sécurité, il n'y a rien d'urgent. Trois chantiers MOYENS : une page compromise peut piloter les écritures de liste (SEC-01), les motifs `*://` acceptent le http (SEC-02), et les actions CI ne sont pas épinglées par SHA alors qu'elles détiennent les secrets des stores (SEC-03).
6. Gains attendus du plan : ≈ 5 requêtes AniList/MAL et 1 aller-retour série évités par épisode (PERF-07/-08), un import CR/ADN 3 à 10× plus rapide (PERF-10) et ≈ 25 KB de marge sur le script CR/ADN. S'y ajoutent des règles déclarées dans CLAUDE.md qui deviennent des tests, et un `shared/` réduit au code pur.
7. Méthode : d'abord les filets de sécurité, puis les déplacements purs (empreinte `dist/` identique), puis les refactors directement dans les dossiers finaux. La partie UI suit la décision Preact.

---

## 2. Constats dédupliqués, classés par gravité

### 2.1 Gravité élevée

| Id | Constat | Preuve | Statut |
|---|---|---|---|
| H1 | Netflix : `bySignals` accepté dans la branche `linked` sans vérifier que le groupe prouvé appartient à la franchise liée. Une fiche titre seul est synchronisée en `high` et apprise. | `background/sync/matching.ts:1360-1367`, `:880-904`, `:839-842` | en cours (nuit) |
| H2 | Disney+/Prime : deux remakes homonymes portant chacun un lien plateforme deviennent `id`, ce qui coupe la garde des remakes. Le plus ancien part en `high` sous une clé sans année partagée. | `resolver.ts:105-112`, `matching.ts:229-239`, `:257-259`, `:1004-1007` | en cours (nuit) |
| 2-§0 / PERF-13 | Script CR/ADN à 83,0/83 KB, sans aucune marge. C'est le seul script construit en chunks ESM partagés avec les pages (tree-shaking pour l'union des importeurs, ≈ 2 KB de colle). | `scripts/verify-build.ts` ; mesures 2 §0, 3 §2.5 | proposé (phase c) |
| 4-A1 | Menu « ⋯ » de l'Agenda sans modèle clavier : pas d'`aria-controls`, le focus n'entre pas dans le menu, les items restent dans l'ordre Tab et ignorent les flèches. Valeur élevée selon l'audit 4. | `sidepanel/components/agenda.ts:492-559` | proposé (phase f) |

### 2.2 Gravité moyenne

| Id | Constat | Preuve | Statut |
|---|---|---|---|
| M1 | Une correspondance `chosen` est supprimée dès qu'un épisode sort de son intervalle (revoir S2E3 détruit le choix « Part 2 »). | `resolver.ts:433-452`, `sync-service.ts:305-308` | en cours (nuit) |
| M2 | Mise à jour perdue : une écriture `learned` construite avant les appels réseau écrase un choix utilisateur récent. | `shared/storage.ts:191-196`, `resolver.ts:484-488`, `sync-service.ts:310-321` | en cours (nuit) |
| M3 | Les cartes « À vérifier » sont évincées à 20 sans critère, y compris les corrections qui portent un épisode différé. | `shared/storage.ts:266-270`, `cr-import.ts:629-637` | en cours (nuit) |
| M4 | La page série réimplémente la porte `gateByPlatformLink` sans la règle « fiche non liée à côté d'une fiche liée ». Exemple Bubble : la série TV s'affiche comme certaine et le lien Netflix est appris sur la mauvaise fiche. | `background/page-media.ts:211-236` | décision (§3) |
| M5 | Le verdict « pas un anime » des pages série Disney+/Prime utilise une clé uuid/GTI, alors que la lecture utilise une clé titre : le verdict n'est pas partagé. | `page-media.ts:168`, `adapters/disney.ts:245`, `prime.ts:149` | décision (§3) |
| M6 | Une correspondance `season` retombe sur le numéro affiché (peut-être absolu) si `seasonEpisodeNumber` est null. Forme non vérifiée chez les adaptateurs réels. | `matching.ts:460-466`, `:1010` | décision (§3) |
| B1 | Une même note SyncKai donne des scores différents sur AniList et MAL (8,5 → 9 et 8), puis la comparaison signale un écart. 11 demi-points sont concernés. | `shared/score.ts:21-22`, `:32-34`, `shared/compare.ts:124-129` | en cours (nuit) |
| B2 | Une sauvegarde importée sans compte connecté lie ses cartes à `epochs: {}` : elles ne s'appliquent jamais. | `shared/backup-store.ts:37`, `shared/backup.ts:279-286`, `engagement.ts:68-92` | en cours (nuit) |
| 4-D9 | `SET_LIST_STATUS` (actions média) vérifie la jaquette à la main au lieu de `toSafeImageUrl` : tout le message serait rejeté par la garde. Latent. | `ui/media-action-requests.ts:53-57`, `message-guards.ts:122` | en cours (nuit) |
| SEC-01 | Tout script d'une page supportée peut faire envoyer `EPISODE_COMPLETED` pour n'importe quel titre ou numéro. Les signaux (forgeables, SEC-05) peuvent faire passer un titre seul en `high`. | `rules.ts:34-39`, `:59-66`, `episode-completed.ts:24-39` | décision (§3) |
| SEC-02 | Les motifs `*://` injectent aussi sur http. Un attaquant réseau sur un sous-domaine non HSTS peut alimenter SEC-01. | `manifest.json:24-26,32-34,46,56-58,71-73` | décision (§3) |
| SEC-03 | Actions CI épinglées par tag mutable (18 occurrences) dans des jobs `environment: stores`, avec `cache: npm`. | `.github/workflows/release.yml`, `ci.yml` | proposé |
| PERF-07 | Après chaque sync, la carte de l'onglet est re-résolue même sans écran ouvert. La boucle s'entretient seule : l'âge n'est jamais vérifié, puis l'entrée est réécrite. | `episode-completed.ts:34-37`, `page-media.ts:431-437`, `page-media-cache.ts:88-95` | proposé |
| PERF-08 | Le média est récupéré deux fois à chaque sync (`AnimeByIds` puis `AnimeById` non mis en cache) : un aller-retour série de plus avant le toast. | `resolver.ts:278`, `sync-service.ts:298`, `:331` | proposé |
| PERF-09 | Cache catalogue indexé par ensemble d'ids exact : `[2]` rate `[1,2,3]`, et les recherches ne servent jamais les lectures par id. | `api/media.ts:213` | proposé |
| PERF-10 | L'analyse CR/ADN fait 1 à 4 recherches unitaires par saison, jamais groupées. 300 saisons ≈ 10–30 min. | `cr-import.ts:218-240` | proposé |
| PERF-11 | Page série : jusqu'à 6 lectures de liste en série, puis relecture de l'entrée choisie. | `page-media.ts:123-133`, `:357-379` | proposé |
| 2-R6 | Prime : si le catalogue de l'épisode suivant arrive avant la bascule en mode ratio, la session redémarre et l'épisode n'est jamais synchronisé. Non vérifié, test à écrire. | `prime/bridge-client.ts:193-197`, `adapters/prime.ts:318-330` | proposé (test d'abord) |
| 2-R7 | Firefox : `watchUrl` abandonne le sondage 1 s si `window.navigation` existe ; risque de navigation SPA manquée. Non vérifié. | `content/lib/url-watcher.ts:20-33` | proposé |
| 4-R1 | Import d'historique : le minuteur de reconnexion n'est pas annulé, donc Stop puis Lire peut ouvrir deux ports et lire l'historique deux fois. | `import-cr/import-cr.ts:371-373` | proposé |
| 4-A2 | Éditeur de délai de l'Agenda : Annuler / Échap envoient le focus sur la série suivante. | `agenda.ts` (éditeur), `ui/dom.ts` › `pickFocusKey` | proposé |
| 4-A3 | 39 nœuds `role="status"` recréés à chaque rendu : l'annonce après « +1 » peut rester muette. Non vérifié (lecteur d'écran). | `ui/media-actions.ts:173`, `agenda.ts:299` | proposé (dépend de Preact) |
| 4-#12 | i18n UI : lettres S/E non traduites, 3 découpages de chaînes par marqueur, noms de plateformes codés en dur dans 6 textes (21 retraductions par nouvelle plateforme). | `queue-section.ts:32-42`, `review-card.ts:52-62`, `watching-screen.ts:605`, `agenda.ts:430` | décision (S/E) + proposé |
| 5-3.8 | `test:ext` (32 scénarios réels) ne tourne ni en CI ni dans `release.yml`. | `ci.yml`, `release.yml` | décision (§3) |
| 5-3.3 | Tests de ponts dépendants du temps réel (`delay`, `setTimeout(10)`, 1 s réelle) : instables sur un runner chargé. | `disney/bridge-client.test.ts:143-279`, 8 fichiers `page-bridge.test.ts`, `lib/page-media.test.ts:46` | proposé |
| 5-2 | `noUncheckedIndexedAccess` : 78 erreurs hors tests (47 dans `matching.ts`). | sonde `tsc` | proposé (progressif) |

### 2.3 Gravité faible

| Id | Constat (une phrase) | Preuve | Statut |
|---|---|---|---|
| L1 | `bySignals` contourne le plafond « other-slug » (comportement à documenter ou à plafonner). | `matching.ts:1035`, `:1075-1080` | décision |
| L2 | Vérification de session et écriture tracker non atomiques (fenêtre de quelques ms). | `sync-service.ts:175` | proposé |
| L3 | Les syncs récentes peuvent être recréées pour une session fermée. | `sync-service.ts:247` | proposé |
| L4 | Le cache mémoire des résolutions de page n'est pas invalidé par « Oublier » ou par une restauration. | `background.ts:129-147`, `page-media.ts:68` | proposé |
| L5 | `seriesMappingPrefix` ne voit pas les arcs Disney+ (`:s99`). | `page-media-rules.ts:22-25` | en cours (nuit) |
| B3 | Aperçu d'import : en cas de doublon de clé, c'est la première saison qui est gardée, pas la plus avancée. | `shared/cr-import.ts:372-374` | en cours (nuit) |
| B4 | L'import Netflix ignore `completionTrigger: 'percentage'`. | `shared/netflix-import.ts`, `import-cr.ts:509` | en cours (nuit) |
| B5 | Branche morte dans `startRewatch` (message « au-delà de la fiche » jamais affiché). | `engagement.ts:147-148` | proposé |
| B6 | Une carte « À noter » `mal:<id>` n'est pas retirée quand la note passe par la référence AniList. | `engagement.ts:91,112` | en cours (nuit) |
| B7 | « Retirer de la liste » ne purge ni la file ni les cartes de la série, qui peut être ré-ajoutée. Non vérifié. | `engagement.ts:212-236` | décision |
| B8 = SEC-14 | `LOGIN_MAL` ne ferme pas une session MAL ouverte (pas de bump d'epoch), et `saveToken` / `saveMalToken` n'utilisent pas le verrou. Non vérifié en UI. | `auth/mal.ts:132-134,220`, `storage.ts:412-415` | proposé |
| B9 | L'alarme horaire et les écritures de jobs passent par la voie AniList interactive. | `airing.ts:124`, `api/client.ts:123`, `api/list.ts:112,149` | proposé |
| B10 = 4-R4 | Settings sauvegardés en entier sans le verrou de stockage. | `ui/settings/settings-view.ts:136-148` | en cours (nuit) |
| B11 | Heartbeat de l'analyse de comparaison pendant les longues lectures MAL. | `compare.ts:188-225` | proposé |
| 2-R1 | Réutilisation d'un XHR (`abort` + `open` + `send`) : la réponse B est attribuée à la requête A. | `crunchyroll/page-bridge.iife.ts:143-157` (+ Disney+, Prime) | en cours (nuit) |
| 2-R2 | `getCreditsStart?.(…).then` sans `.catch`. | `lib/watch-session.ts:448-450` | en cours (nuit) |
| 2-R3 | Les wrappers fetch/XHR s'empilent à chaque mise à jour sans rechargement de la page. | `installXBridgeOnce` ×4 | en cours (nuit) si petit, sinon kit (e11) |
| 2-R4 | Le pont Netflix n'a pas de `MAX_PORTS`. | `netflix/page-bridge.iife.ts:74-82` | en cours (nuit) |
| 2-R5 | `decodeCrunchyrollPush` sans plafond de taille. | `crunchyroll/bridge-protocol.ts:119-128` | en cours (nuit) |
| 2-R8 = SEC-09 | Chunks web-accessibles à `use_dynamic_url: false` : un site peut détecter SyncKai. | `dist/manifest.json` › `web_accessible_resources` | proposé (2-A pour CR/ADN) |
| 2-R9…R13 | Toast après abandon de session (à documenter), ensembles non bornés, `until()` sans délai, toast en onglet caché, fetch lu en entier avant le plafond. | `watch-session.ts:199-221`, `:42`, `parsing.ts:59`, `toast.ts:331-333` | proposé |
| SEC-04 | `storage.local` est partagé avec les scripts de contenu ; les URL de `WatchingList` ne sont pas revalidées à la lecture. | `shared/watching.types.ts:65-80`, `airing.ts:316-336` | proposé |
| SEC-05 | Handshake des ponts plus faible que ne le disent les commentaires (nonce lisible, `isTrusted` sans effet contre la page). | `crunchyroll/bridge-client.ts:162-181`, `page-bridge.iife.ts:42-46` | proposé |
| SEC-06 | Jetons déchiffrés dans une page (diagnostic) alors que CLAUDE.md dit « service worker uniquement ». | `shared/diagnostics-store.ts:12,24`, `ui/settings/page-help.ts:5` | proposé |
| SEC-07/08 | Modèle de menace du chiffrement non documenté ; `state` absent de l'implicit grant AniList. | `token-crypto.ts:16-20,55`, `auth/anilist.ts:24-28` | proposé |
| SEC-10 | `isEpisodeInfo` accepte des chaînes non bornées et des nombres non finis. | `shared/episode.types.ts:85-106` | proposé |
| SEC-11 | Chaque import CR enregistre un nouvel appareil « SyncKai » (device id aléatoire). Non vérifié. | `crunchyroll-history.ts:17,151-158`, `cr-history-port.ts:30` | décision |
| SEC-12 | CSP sans `default-src`, `connect-src`, `base-uri`, `form-action` ni `frame-ancestors`. | `manifest.json:36-38` | décision |
| SEC-13 | Le retrait du code dev et l'absence de `chrome.` dans le monde MAIN ne sont vérifiés qu'à la main. | `scripts/verify-build.ts:104-128` | proposé (phase a) |
| SEC-15 | `npm audit` : 3 vulnérabilités hautes dans l'outillage `web-ext`, utilisé avec les secrets AMO. | `dependabot.yml` | proposé |
| 6-D4 | Marquer un revisionnage « Terminé » met une note en file, alors que la lecture ne le fait pas. | `sync-service.ts:186`, `controls.ts:176` | proposé |
| 6-D8 | 501 et 505 relancés par la file, pas par les jobs. | `jobs/runner.ts:119`, `queue-policy.ts:27` | proposé |
| 6-D13 | Notifications à l'heure JP + délai global, sans le décalage par série de l'Agenda. | `airing-policy.ts:385`, `shared/agenda.ts:285` | décision |
| PERF-12 | Chaque démarrage de script de contenu (UI non anglaise) réveille le SW pour le catalogue. | `content/start.ts:37`, `i18n/content.ts:27-39` | proposé |
| PERF-14 | `storage.local.get(null)` à chaque contrôle horaire et à chaque rafraîchissement d'Agenda. | `shared/agenda-store.ts:48` (aussi `storage.ts:356`) | proposé |
| PERF-15 | La popup construit toute la vue Réglages au démarrage (79 KB de JS, toutes les correspondances triées). | `popup/popup.ts:178`, `settings-view.ts:401-415` | proposé |
| PERF-16 | Le job est réécrit en entier (avec `pending[]`) à chaque item et chaque heartbeat : O(n²) octets. | `jobs/runner.ts:22-38`, `cr-import.ts:128-130` | proposé |
| PERF-17 | Le `storage.local.onChanged` du SW le réveille pour toute écriture d'un autre contexte. | `background.ts:260-264` | proposé |
| PERF-18 | `mediaMappings` est une seule clé sans plafond (lecture-modification-écriture de tout l'objet). | `storage.ts:191-219` | rejeté pour l'instant (§4) |
| PERF-19/20 | Caches mémoire morts avec le SW ; deux requêtes `Media(id)` au premier affichage du panneau. | `media.ts:255`, `panel-media.ts` | proposé |
| PERF-21 | Voie de fond fixée à 20/min quel que soit `X-RateLimit-Limit`. | `rate-limit.ts:40` | décision (avec PERF-10) |
| PERF-22 | Paquet : `.woff` inutiles (128 KB), 9 fichiers non référencés (43 KB). | `dist/` | proposé |
| 4-R2/R3/R5/R6 | Relectures de permissions concurrentes, Agenda sur une frontière de semaine, travail du panneau hors onglet, écouteurs sans `dispose`. | `popup.ts:645-651`, `sidepanel.ts:291-298`, `agenda.ts` | proposé |
| 4-#13/#16/#17/#18 | Onglet « soon » mort (3 clés × 21 catalogues), `entryKey` importé d'une vue, import « connecté » sur simple présence du jeton, pas de « Autoriser l'accès » dans le panneau Firefox (non vérifié). | `sidepanel.ts:26-35`, `controllers/watching.ts:21`, `import-cr.ts:171` | proposé |
| 5-2 divers | `any` implicite via `Array.isArray` (4), `exactOptionalPropertyTypes` (16), `parseEntry` sans `isFinite`, `afterI18n` masque une promesse. | `adapters/adn.ts:192`, `api/list.ts:72-78`, `background.ts:58-60` | proposé |

### 2.4 Dette structurelle (duplications et complexité), avec la branche qui la résout

| Ids (audits croisés) | Dette | Branche (§6) |
|---|---|---|
| 1-D1 / I7, M5, L5, remarque « exclusions sans année » | Identité de série calculée de 5 façons (`mappingKey`, `platformSeriesKey`, `seriesMappingPrefix`, clé ignorée, `queueItemId`). | e2 |
| 1-D3 / M4 | Porte finale (`gateByPlatformLink`, `seriesPageGate` + `pickSeriesSeason`, `doubtedMapping`). | e4 |
| 1-D2, D6–D9, D11, D12 | Numérotation absolue ×3, clés de titre, formats, tolérance ±2 ×3, total de groupe à deux sémantiques, marqueurs de saison et de spécial. | e3 |
| 1-D4, D5, D15 | Détection du « lien propre » ×2, `linksElsewhereOnly` absent de `signalGroups` (non vérifié), regex Netflix ×2. | e5 |
| 1-D13 / I6 = 6-D10 / P3 | Verrou → lecture → décision → session → écriture recopié 6 fois. | e7 |
| 1-D10, 1-D14 = 6-D3 | Correspondance en cache non revalidée côté import ; `decideImport` est une seconde copie des règles de liste. | e10 |
| 6-D1, D2, B4 | Règle « épisode vu » ×4 et réducteur par saison ×3. | e10 |
| 6-D5, D6, D9, B1 | Conversions de score, maps de statut MAL, résolution service → id ×5. | e8 |
| 6-D7 | Listes de clés liées au compte purgées dans 3 ou 4 endroits. | e9 |
| 6-D8, D11, D12 | Classification des erreurs relançables, `getAniListUserId` ×2, réservation de job ×3. | e12 |
| 1-§4 | Complexité : `resolveByRules` 88, `collectCandidates` 50, `pickSeriesSeason` 43, `resolveEpisode` 38. | e3, e6, e4 |
| 2-§1, 5 #15 | `observeXhr` / `observeFetch` identiques octet pour octet ×3, `until` ×2 divergents, canal client ×3. | e11 |
| 4-D1…D5, 5 #1/#5/#9/#10 | Glue « Sur cette page » / « En lecture », menus ×3, bandeau ×7, lignes d'état ×6, en-têtes ×2, closures de 400 à 620 lignes. | f (décision Preact) |
| 4-D6 | Accès aux plateformes optionnelles lu 6 fois, 3 booléens codés en dur dans Réglages (prérequis HIDIVE). | f1 |
| 7-§1 | `shared/` fourre-tout (79 modules, 24 avec API navigateur), cycles de dossiers, fichiers mal placés, noms trompeurs. | b1–b8 |

---

## 3. Décisions qui reviennent au propriétaire

| # | Décision | Options | Recommandation |
|---|---|---|---|
| 1 | **SEC-01** : garde d'anomalie avant écriture | (a) « fiche absente de la liste » ou « gros saut » → « À vérifier » ; (b) garde ciblée | **(b)**. Ajouter une fiche absente est le cœur de la promesse « aucune action manuelle », et un saut de 0 à 6 est courant (épisodes vus ailleurs). Je propose : 1) une limite de débit de `EPISODE_COMPLETED` par onglet et par série ; 2) « À vérifier » seulement pour un saut direct vers le dernier épisode depuis loin (seuil N à fixer, par exemple > 12) ; 3) les signaux venus du seul pont ne suffisent jamais à passer un titre seul en `high` (prolonge H1). Ajouter des cas adverses au corpus. |
| 2 | **SEC-02** : motifs `https://` uniquement | appliquer / ne rien faire | **Appliquer**, groupé avec la release 2.4.0. Restreindre un motif ne déclenche aucun avertissement. Coût : `docs/store/permissions.md` change, il faut donc coller ses blocs dans l'onglet Confidentialité du Chrome Web Store avant le tag, et mettre à jour `store-permissions.test.ts`. À vérifier à la main : un accès Netflix déjà accordé en `*://` reste reconnu après la mise à jour (Chrome et Firefox). |
| 3 | **4-#12** : lettres S/E | garder le latin / traduire | **Traduire avec un seul gabarit** `episode.short` = « S{season} E{episode} » (règle CLAUDE.md : une valeur dont la position dépend de la langue est un placeholder). Le japonais peut alors écrire « 第{season}期 第{episode}話 ». Coût : 1 à 2 clés, les notes de contexte, 20 traductions, puis `test:i18n-layout`. |
| 4 | **`test:ext` en CI** | non / informatif / bloquant | **Job non bloquant sur `develop`** (Chromium complet, `SYNCKAI_EXT_CHROME`), puis **requis dans `release.yml`** une fois stable 2 semaines. |
| 5 | **Seuil de couverture** | aucun / cible fixe / cliquet | **Cliquet sur les branches** à la valeur courante (77,7 %), sans cible fixe. Job `vitest --coverage` en CI, échec seulement en cas de baisse. |
| 6 | **M4** : faire passer la page série par la même porte (`judge()`) | oui / non | **Oui** (e4), après l'ajout au corpus du cas « film lié + série TV homonyme » (Bubble). Effet visible : certaines pages série passent de « certain » à « à vérifier ». Test manuel sur les arcs One Piece Netflix (`representsWholeShow`). |
| 7 | **M5** et exclusions sans année | clé titre pour Disney+/Prime ; année dans les exclusions ? | **Clé titre** via `SeriesIdentity` (e2). Pour les exclusions : **ajouter l'année quand elle est connue**, les anciennes clés sans année continuant de couvrir les deux remakes (pas de migration). |
| 8 | **M6** : `season` sans `seasonEpisodeNumber` | repli actuel / `null` puis re-résolution | **`null` puis re-résolution** (garde S, helper `seasonPosition()` partagé avec l'import). Vérifier le chemin des films Disney+. |
| 9 | **L1** : `bySignals` et plafond « other-slug » | documenter / plafonner si la seule preuve est le nombre d'épisodes | **Plafonner quand la preuve n'est que le nombre d'épisodes**, documenter le cas de l'année (dans e3 : `finalize` unique). |
| 10 | **Calendrier des déplacements** vs 2.4.0 (en attente d'AMO) | après `release/2.4.0` (audit 7) / maintenant | **Maintenant**, dès la fusion des branches de nuit. L'attente d'AMO est sans date, et un déplacement prouvé par une empreinte `dist/` identique ne change pas le paquet. Un hotfix depuis `main` reste rebasable grâce à la détection des renommages. Couper `release/2.4.0` tôt imposerait des cherry-picks vers `develop`, ce qu'il faut éviter depuis l'incident 2.2.1. |
| 11 | **Variante d'arborescence** (§5) | minimale / complète | **« Minimale étendue »** (§5.3). |
| 12 | **Preact** (pilote `feature/ui-preact-pilot`) | adopter pour les pages / rester en vanilla | Décision après le pilote. Critères : poids par page, `test:i18n-layout`, focus / aria, tests e2e inchangés. Jamais dans les scripts de contenu (garanti par le test « content → ui allow-list », a1). |
| 13 | **2-F** : journal d'erreurs via le SW (−2,2 KB par bundle) | oui / non | **Oui** après 2-A et 2-C si la marge manque encore. Contrepartie : un warn est perdu quand le SW est injoignable (la sync est alors cassée de toute façon). |
| 14 | **PERF-21** : quota de fond adaptatif | 20 fixe / `min(limite − réserve, 45)` | **Seulement avec PERF-10**, et 20 en mode dégradé (30/min). |
| 15 | **SEC-12** : CSP renforcée | oui / non | **Oui**, avec un test de synchronisation comme pour `img-src`. Risque moyen (le SW partage la CSP et charge les catalogues) : test manuel Chrome et Firefox. |
| 16 | **SEC-11** : device id CR stable + mention dans `PRIVACY.md` | oui / non | **Oui** (S), après vérification qu'un appareil apparaît bien dans le compte. |
| 17 | **6-D13** : notifications avec le décalage par série | oui / non | **Oui** (`estimateRelease` partagé), sinon documenter l'écart. |
| 18 | **B7** : vider la file et les cartes d'une série retirée | oui / non | **Oui** pour les éléments mis en file *avant* le retrait. |
| 19 | **Étape 7-10** : renommer `import/` → `backup/`, `import-cr/` → `history-import/`, `Cr*` → `History*` | maintenant / jamais | **Pas maintenant.** Le renommage des types `Cr*` (compilation seule) est éventuellement possible en dernier. Ne jamais renommer `crImport:*`, `crImport.*` ni `CR_IMPORT_*`. |

---

## 4. Patrons de conception

### 4.1 Retenus (recoupés entre audits, chacun supprime une duplication ou un risque nommé)

| Patron | Où | Supprime | Audits |
|---|---|---|---|
| **Strategy par plateforme**, déjà en place côté contenu (`StreamingAdapter`) et à garder | `content/<p>/adapter.ts` | — (petits helpers seulement : `withSignals` ×10, `domainOrSubdomain` ×10, `runStrategies`, `seriesTitleChain`) | 2-2.3, 7-§3.2 |
| **Strategy de matching par plateforme** `PlatformMatchPolicy` (`linkOf`, `otherSeries`, `settleLinks?`, `animeGate`, `seriesKey`, `countsAsPresence`) | `background/sync/matching/policies/<p>.ts` | 1-D1, D4, rend H2 local ; HIDIVE = 1 fichier | 1-4.2 |
| **Chain of Responsibility / pipeline** pour `resolveByRules` : étapes pures + `finalize` unique (plafond, raisons, `level()`) | `background/sync/matching/stages/*.ts`, `rules-engine.ts` | complexité 88, classe de bugs L1 | 1-4.1, 5 #2 |
| **Pipeline sur `CandidateSet`** pour `collectCandidates`, avec un **port `Catalog`** injecté (paramètre par défaut, pas de conteneur) | `background/sync/candidates.ts`, `background/ports/catalog.ts` | complexité 50, 12 `vi.mock('api/media')` | 1-4.3, 7-7b, 5 #13 |
| **Juge unique** (spécifications nommées → `doubts`) partagé par `resolveEpisode`, `doubtedMapping`, `pickSeriesSeason` | `background/sync/matching/judge.ts` | M4, 1-D3 | 1-4.4 |
| **Store de correspondances à compare-and-set**, avec l'origine typée en union `'learned' \| 'chosen' \| 'unmarked'` | `browser/storage/mappings.ts` | M1, M2, I1 (le CAS de base arrive cette nuit) | 1-I1, 5 #11, 7-5a |
| **Écriture gardée / Command** `runOnServices(ref, EntryCommand)` : verrou → lecture fraîche → décision pure → session → écriture | `background/entry-commands.ts` (consommé par `controls`, `engagement`, `sync-service`, import) | 1-I6/D13, 6-P3/D9/D10, B6 | 1, 6 (convergents) |
| **Codecs du tracker** (`ScoreCodec`, `fullList`, `targetId`) dans `TrackerService` | `background/ports/tracker.ts`, `background/{anilist,mal}/` | 6-D5/D6/D9, B1 (test de contrat sur les 2 codecs) | 6-P2 |
| **Interface `HistorySource`** + règle « vu » et réducteur uniques sur des `WatchEvent` bruts | `shared/history-source.ts`, `import-cr/sources/<p>.ts` | 6-D1, D2, B4 | 6-P1, 4-§3, 5 #3 |
| **Registre des données liées au compte** (`AccountBoundStore[]`) parcouru au déconnexion, test « toute clé est classée » | `browser/storage/account-data.ts` | 6-D7 | 6-P4 |
| **Kit des ponts passifs (Template Method)** + kit client (`openBridgeChannel`, `createWaiters` à délai obligatoire) | `content/bridge/kit.ts` (MAIN), `content/bridge/client-kit.ts` (isolé) | 2-§1, 2-R1/R3/R4/R11 une seule fois ; +0,2 KB par pont mesuré | 2-2.1/2.2, 5 #15 |
| **Identité de série** (`SeriesIdentity`), un seul module pur, sûr pour le contenu | `platforms/series-identity.ts` | 1-D1/I7, M5, L5 | 1 |

Retenus en faible priorité : la table de décision `decideSyncAction` (1-4.5), la machine d'états de session d'import
(6-P5, L, seulement avec P1 ; le petit pas `BatchWriter` + `analyze`/`apply` est retenu) et l'undo de « Retirer de la
liste » via le `snapshot` des commandes (6-P3).

### 4.2 Rejetés explicitement

| Rejeté | Pourquoi | Audits |
|---|---|---|
| Conteneur d'injection, bus de commandes, classes `application/` par type de message | La table de dispatch typée de `background.ts` est déjà le registre des cas d'usage. Les ports passent par un paramètre par défaut. | 7-§3.2 |
| `Repository<T>` / `StoragePort` générique | La sémantique est spécifique (Web Locks, epochs, `writeIfSession`, caches de session). Le faux `chrome` de `src/test/fake-chrome.ts` sert déjà de point d'injection. Le store de correspondances, lui, est spécifique et donc retenu. | 7-§2.1/§3.2 |
| Barrels (`index.ts` de réexport) | `reachableFrom` rendrait tout « atteignable » depuis le contenu (faux positifs PERF-01), le tree-shaking est incertain avec des effets à l'import, et la dépendance réelle disparaît des revues. Au passage : `background/sync/score.ts` est un réexport (`export * from '../../shared/score'`) ; il est supprimé en b6. | 7-§4 #10 |
| Alias de chemins (`@domain/*`) | `src/test/import-graph.ts` ne suit que les spécificateurs relatifs : chaque test de frontière perdrait des arêtes en silence. | 7-§2.1/§3.2 |
| Classe de base `BridgeAdapter<TMeta>` pour Netflix / Disney+ / Prime | Modèles d'identité trop différents (id d'URL ; id d'URL + `since` + repli ; pas d'id d'URL) : de l'indirection pour peu de gain. Petits helpers à la place. | 2-2.3 |
| Hexagonal dans les scripts de contenu | Chaque indirection coûte des octets sur un budget de 83 KB, et `StreamingAdapter` + `content/lib` ont déjà la bonne forme. | 7-§3.2 |
| `ClockPort`, `NotificationPort` | Les fonctions prennent déjà `now` là où c'est utile. | 7-§3.2 |
| Monorepo / workspaces npm | Un seul bundler, un seul manifeste, des budgets par entrée. | 7-§3.2 |
| `import()` dynamique dans le SW | Interdit dans le service worker module de Chrome. | 3-§2.1, CLAUDE.md |
| `import()` paresseux dans le chargeur ESM du contenu (variante PERF-13) | **Désaccord 3 ↔ 2, tranché pour l'audit 2** : un IIFE autonome + `executeScript` à la demande, mesuré, supprime aussi l'exposition WAR (2-R8/SEC-09) et suit le modèle de l'import Netflix. | 3-PERF-13, 2-A/C |
| Codec compact `"v:nonce"` pour tous les ponts | ≈ 0,3 KB pour 3 changements de protocole et de version. | 2-2.2 |
| Fragmentation de `mediaMappings` (PERF-18) | Effort L (migration, sauvegardes, Réglages) pour un coût faible aujourd'hui. À rouvrir si les imports créent des milliers de correspondances. | 3-PERF-18 |
| Renommer `shared/` → `domain/` et déplacer `matching` dans `domain/` (étape 6 complète) | ≈ 730 spécificateurs pour un nom, et aucun refactor du plan n'en a besoin. Le rejeter fixe dès maintenant l'emplacement final de `matching`. | 7-étape 6 |
| Chasser les cycles `popup ↔ popup/components` (type seul) | Aucun effet à l'exécution. | 7-§3.2 |

---

## 5. Architecture cible des dossiers et fichiers

### 5.1 Principes réconciliés

1. **Le runtime d'abord** (SW, contenu isolé, MAIN, pages), puis les couches à l'intérieur du SW (audit 7, que tous les audits respectent).
2. **Chemins d'entrée gelés** : manifeste, HTML des pages, `src/content/<p>/*.iife.ts` (regex de `output-names.ts`, frontière de sécurité WAR), `background/background.ts`. Seule exception volontaire : 2-D, qui *ajoute* `content-crunchyroll.iife.ts` et `content-adn.iife.ts` à la place de `content/content.ts`, sur le modèle existant `content/<p>/content-<p>.iife.ts`.
3. **Le code pur et multi-runtime** reste dans `shared/` (domaine) ou va dans `platforms/` (savoir par plateforme sûr pour MAIN). **Le code pur propre au SW** (matching) reste sous `background/sync/` : pas de `domain/`.
4. **Chaque refactor du plan (§6 e/f) crée ses fichiers directement à leur emplacement final** ci-dessous. Un fichier racine qui se scinde devient son propre dossier de fonctionnalité (pas d'étape 7c générique).
5. Preact, s'il est adopté, est réservé aux pages : `ui/content-safe/` reste en vanilla, et le test a1 l'interdit au contenu.

### 5.2 Arbre cible (« minimale étendue »)

```
src/
├── shared/                 DOMAINE PUR multi-runtime (cliquet : 0 module à API navigateur)
│   ├── *.types.ts, guards.ts, result.ts, url.ts, title.ts, match-signals.ts, score.ts, session-epochs.ts, list-notes.ts,
│   │   page-media.ts, watching.ts, agenda.ts, compare.ts, compare-job.ts, job.ts, backup.ts, diagnostics.ts,
│   │   cr-import.ts (plan), exclusions.ts (règles), settings.ts (types, défauts, normalisation ; get/save → browser/)
│   ├── preferred-player.ts   (ex netflix-access.ts, b1)
│   ├── lru.ts                (nouveau, e11 : keep ×6)
│   └── history-source.ts     (nouveau, e10 : WatchEvent, isEpisodeWatched, reduceWatchEvents)
├── platforms/              PUR, sûr pour MAIN (b4) ; n'importe que shared/ et platforms/
│   ├── ids.ts (platform-ids + domainOrSubdomain), registry.ts (platforms), target-pages.ts, links.ts (platform-links pur)
│   ├── series-identity.ts    (nouveau, e2)
│   ├── crunchyroll/{metadata,history}.ts   adn/history.ts   prime/metadata.ts
│   ├── netflix/{metadata,history,tab-op}.ts   (tab-op : fonction sérialisée, zéro import, test dédié, b4bis)
│   └── disney/metadata.ts    (réducteurs sortis de content/disney/bridge-protocol.ts, b4bis)
├── protocol/               contrats entre runtimes (b3)
│   └── messages.ts, content-messages.ts, live.ts, panel-toggle.ts, commands.ts, history-ports.ts, storage-keys.ts
├── browser/                infrastructure chrome.* (b5, b6)
│   ├── storage/   mappings.ts, reviews.ts, sessions.ts, viewer-cache.ts, watching-cache.ts, account-data.ts,
│   │              lock.ts, lock-core.ts, session-cache.ts, session-end.ts, page-media-cache.ts, settings-store.ts,
│   │              exclusions-store.ts, exclusions-read.ts (ex exclusions-core), *-store.ts existants
│   ├── tokens/    crypto.ts, key-store.ts, access.ts (SW uniquement, par test)
│   └── platform-access.ts, host-access.ts, side-panel.ts, badge.ts, logger.ts, error-journal.ts
├── i18n/                   inchangé
├── background/             racine de composition du SW (background.ts gelé)
│   ├── background.ts, message-guards.ts, response-errors.ts, errors.ts, rate-limit.ts
│   ├── ports/     tracker.ts (b7a), catalog.ts (nouveau, e6)
│   ├── anilist/   client, media, list, viewer, watching, panel-media, full-list (sorti de compare), auth   (b7a)
│   ├── mal/       client (ex api/mal), full-list, auth, pkce                                             (b7a)
│   ├── trackers/  index.ts (adaptateurs + décorateur), oauth-clients.ts
│   ├── jobs/      runner.ts
│   ├── sync/      resolver, sync-service, queue, review-decision, mapping-purge, ignored-series, entry-lock,
│   │   │          match-diagnostic, rules, queue-policy, candidates.ts (e6), __corpus__, __fixtures__
│   │   └── matching/  matching.ts → scindé en e3 : rules-engine.ts, stages/*.ts, mapping.ts, season-titles.ts,
│   │                  signal-groups.ts ; concordance.ts, season-groups.ts (b7b) ; judge.ts (e4) ; policies/<p>.ts (e5)
│   ├── compare/          compare.ts, compare-parse.ts, compare-snapshot.ts      (b7b ; supprime trackers → racine)
│   ├── history-import/   cr-import.ts → analyze.ts, apply.ts, batch-writer.ts (e10) ; netflix-import.ts   (b7b)
│   ├── page-media/       page-media.ts, page-media-rules.ts                     (b7b)
│   ├── entry-commands.ts (nouveau, e7), controls.ts, engagement.ts, episode-completed.ts, agenda.ts, airing*.ts,
│   │   content-catalog.ts
│   └── platform-access.ts, platform-scripts.ts, history-scripts.ts (nouveau, c5 : seul autre ?script autorisé),
│       content-reinjection.ts, side-panel.ts, update-migrations.ts, job-resume.ts
├── content/
│   ├── content.ts (jusqu'à c6), start.ts
│   ├── lib/       moteur + adapter.ts + parsing.ts (b1) + history-port.ts + dom-strategies.ts (e11)
│   ├── bridge/    kit.ts (MAIN, seul module de content/ permis aux ponts hors leur dossier), client-kit.ts (e11)
│   ├── ui/        toast, sync-toast, engagement-prompt, notification-policy
│   ├── crunchyroll/  adapter.ts, history.ts, history-port.ts (b2), page-bridge.iife.ts, bridge-client.ts,
│   │                 bridge-protocol.ts, content-crunchyroll.iife.ts (c6)
│   ├── adn/          adapter.ts, history.ts (b2), content-adn.iife.ts (c6)
│   ├── history/      history.iife.ts (c5 : lecteurs injectés à la demande)
│   └── netflix/ disney/ prime/   adapter.ts (b2) + fichiers existants
├── ui/                     kit de pages
│   ├── content-safe/  rating, star-rating, kai-small (+ happyKai, c3), svg, sync-feedback (b8)
│   ├── controllers/   page-media-controller, page-media-request, accounts, media-action-requests,
│   │                  platform-access-store (f1), worker-call (f2), redetect-limiter, own-writes (f3)
│   └── settings/
├── popup/  sidepanel/  import/  import-cr/{sources/<p>.ts, state.ts}   (chemins gelés ; vues selon Preact)
├── build/
└── test/   + builders.ts (a4)
scripts/screenshots/   gardé et documenté comme banc commun des pages (pas de déplacement vers page-harness/)
```

### 5.3 Option minimale, option complète, recommandation

| Variante | Étapes de l'audit 7 | Fichiers touchés (≈) | Ce qu'elle laisse |
|---|---|---|---|
| **Minimale** (audit 7) | 0, 1, 2, 3, 4, 6-MV (+5a) | ~200 | `browser/` partiel, `api/` mêlant AniList et MAL, `matching.ts` dans `sync/` sans dossier, `ui/` à plat. Plusieurs refactors du plan (e1, e6, e8, e9, f1) atterriraient alors dans des fichiers déplacés plus tard : c'est le **double travail** que le propriétaire refuse. |
| **Complète** (audit 7) | + 5, 6-complète, 7a/7b/7c, 8, 9, (10) | ~600 + docs | Le renommage `shared → domain`, `features/` générique et le cycle `shared ↔ i18n` coûtent cher pour un nom. |
| **Minimale étendue (recommandée)** | 0, 1, 2, 3, 4 (+ 4bis), 5a, 5b, 6-MV, 7a, 7b ciblé (ports/tracker, `compare/`, `history-import/`, `page-media/`, `sync/matching/`), 8 (après la décision Preact) | ~350 | Exactement les dossiers que les refactors §6 (e, f) vont toucher. Rejetés : 6-complète, 7c générique, 9 (sauf si le test « pas de cycle de dossiers » est adopté), 10. |

Règles pour chaque déplacement (audit 7 §3) : un commit par étape, `git mv` + réécriture des imports par un codemod
lancé depuis le scratchpad (spécificateurs relatifs, `vi.mock`, `?raw` / `?script`, chemins dans `architecture.test.ts`
et `i18n/content.test.ts`). Aucun formateur. SHA ajouté à `.git-blame-ignore-revs`. Chemins de CLAUDE.md et `docs/`
mis à jour dans la même PR (≈ 43 + 44 références). Pour l'empreinte `dist/`, neutraliser l'horodatage de build du script
de contenu (`build/build-stamp.ts`), sinon le hash change à chaque build.

---

## 6. Plan ordonné en petites branches

Légende : **Auto** = peut tourner sans surveillance (vérifications automatiques suffisantes) ; **Manuel** = test du
propriétaire dans Chrome et/ou Firefox avant fusion. Base de chaque branche : `npm run verify` ; « dist = » = empreinte
`dist/` + `dist-firefox/` identique ; « budgets = » = `verify:build` inchangé.

**Phase 0 (en cours cette nuit) :** `bugfix/matching-audit` (H1, H2, M1, M2, M3, L5), `bugfix/score-and-backup` (B1, B2,
B3, B4, B6, B10/4-R4, 4-D9), `bugfix/bridge-hardening` (2-R1, 2-R2, 2-R4, 2-R5, 2-R3 si petit), et l'évaluation
`feature/ui-preact-pilot`. Ces branches doivent être fusionnées avant toute branche ci-dessous : les phases b et e
touchent les mêmes fichiers. Les 3 branches de nuit demandent un test manuel Chrome du propriétaire (matching et notes
visibles, ponts Netflix / Disney+ / Prime non automatisables).

### (a) Filets de sécurité, avant tout refactor

| Branche | Contenu | Fichiers | Risque | Tests qui protègent | Dépend | Mode |
|---|---|---|---|---|---|---|
| a1 `test/architecture-boundaries` | Tests de 7-§2.4 qui passent **aujourd'hui** : #1 atteignabilité MAIN + scan brut `chrome.` ; #3 `token-access` atteignable depuis le SW seulement (exception diagnostic commentée, levée en s3) ; #4 liste blanche content → `ui/` (protège aussi de Preact) ; #8 intégrité des `vi.mock` ; cliquet des 24 modules `shared/` à API navigateur ; test statique « pas de nouvel écouteur de premier niveau dans `background/` » (3-§3) | `src/architecture.test.ts`, `src/test/import-graph.ts` | S | eux-mêmes | 0 | Auto |
| a2 `test/build-guards` | `verify-build` : absence des marqueurs dev (`debug:matchDiagnostic`, `[disney]`, code `settings.matchDiag`) et des chaînes interdites dans les IIFE MAIN (`chrome.`, `getResponseHeader`, `setRequestHeader`, `.headers`, `document.cookie`, `localStorage`…) (2-2.1, SEC-13) ; script `scripts/dist-fingerprint.ts` ; `.git-blame-ignore-revs` vide | `scripts/verify-build.ts`, `scripts/build-checks*.ts` | S | `build-checks.test.ts` | 0 | Auto |
| a3 `test/request-counts` | Dans `sync.ext.ts`, opérations `FakeAniList.requests` par `EPISODE_COMPLETED` (ligne de base actuelle, resserrée par d1) + variante page série (PERF-11) | `scripts/ext-e2e/sync.ext.ts`, `fake-anilist.ts` | S | `test:ext` | 0 | Auto |
| a4 `test/deflake-and-builders` | Faux minuteurs dans les 8 tests de ponts et `lib/page-media.test.ts` (5-3.3) ; `src/test/builders.ts` (épisode, candidat, média AniList, 5-3.4) | tests `content/*`, `src/test/` | S | `vitest` | 0 | Auto |
| a5 `test/coverage-gaps` | Tests unitaires de `background/controls.ts` (37,9 %), `auth/anilist.ts`, `sidepanel/presence.ts` (8,2 %) et des branches négatives de `message-guards` ; test de propriété 1-I7 « clés lecture et page série d'une même série identiques » (en `it.fails`, il passera en e2) ; cas corpus « Bubble » (`ideal` + `gap`, M4) ; test Prime « catalogue suivant en avance, mode ratio » (2-R6 : s'il échoue, c'est un bug à traiter) | tests + `__corpus__/cases.ts` | S–M | eux-mêmes | 0 | Auto (2-R6 : avis du propriétaire si rouge) |
| a6 `chore/lint-ratchet` | `no-unsafe-*`, `no-unnecessary-type-assertion`, `no-deprecated`, interdictions `no-restricted-syntax` (`innerHTML`, `eval`, `new Function`, `localStorage` hors `adn-history`, `console.*` hors `logger`), `max-lines-per-function` en warn ; règle « `.info` / `.debug` hors `if (__SYNCKAI_DEBUG__)` » sous `src/content` (activée en c2) | `eslint.config.js`, 4 corrections `any` implicite | S | `npm run lint` | 0 | Auto |
| a7 `chore/ci-hardening` | SEC-03 (épinglage SHA, pas de `cache: npm` dans les jobs à secrets), job couverture en cliquet (déc. 5), job `test:ext` non bloquant (déc. 4), CodeQL, suivi SEC-15 | `.github/workflows/*.yml` | S | prochaine exécution CI ; `release.yml` vérifié au prochain tag | 0 | Auto (le propriétaire relit les workflows) |

### (b) Déplacements purs (`git mv` + imports, un commit, « dist = »)

| Branche | Contenu (étape 7) | Risque | Tests | Dépend | Mode |
|---|---|---|---|---|---|
| b1 `refactor/move-content-lib` | Étape 1 : `netflix-access` → `preferred-player`, `adapters/{adapter,parsing}` → `content/lib/` | S | base + dist = + `test:ext` | a1, a2 | Auto |
| b2 `refactor/move-content-platforms` | Étape 2 : `content/<p>/adapter.ts`, `content/adn/`, lecteurs d'historique dans leur plateforme ; imports de `scripts/ext-e2e/fake-sites.ts` et `scripts/e2e` | S | base + dist = + `test:ext` playback | b1 | Auto |
| b3 `refactor/move-protocol` | Étape 3 : `protocol/` (messages, content-messages, live, panel-toggle, commands, history-ports, storage-keys) | S | base + dist = + `test:e2e` + `test:ext` | b2 | Auto |
| b4 `refactor/move-platforms` | Étape 4 : `platforms/` (ids, registry, target-pages, links, metadata, history) ; liste « heavy », corpus et `refresh-anilist-corpus.ts` mis à jour | S–M | base + dist = + test MAIN (a1) + `test:e2e` + `test:ext` | b3 | Auto |
| b4bis `refactor/split-platform-files` | `netflixTabOp` → `platforms/netflix/tab-op.ts` (+ test zéro import) ; réducteurs Disney+ → `platforms/disney/metadata.ts`. Même code, mais une scission de fichiers | S | base + budgets = (dist peut différer de quelques octets) + `test:ext` import | b4 | Auto |
| b5 `refactor/move-browser-storage` | Étape 5a : `storage.ts` scindé selon ses en-têtes `// ───` → `browser/storage/*`, `browser/tokens/*`, stores, verrou, caches ; `vi.mock` de `src/test/setup.ts` (a1 #8 le surveille) | M | base + dist = + `test:e2e` + `test:ext` comptes | b4bis | Auto |
| b6 `refactor/move-browser-apis` | Étape 5b + 6-MV : badge, side-panel, accès, logger → `browser/` ; cliquet `shared/` ramené à 0 ; suppression du réexport `background/sync/score.ts` | S–M | base + dist = + `test:e2e` + `test:ext` | b5 | Auto |
| b7a `refactor/move-background-services` | `api/` + `auth/` → `anilist/`, `mal/` ; `errors`, `rate-limit` à la racine ; `fetch*FullList` sortis de `compare.ts` (même code) ; `trackers/tracker.ts` → `ports/` | M | base + corpus identique + `test:ext` complet | b6 | Auto |
| b7b `refactor/move-background-features` | `compare/`, `history-import/`, `page-media/`, `sync/matching/` (matching, concordance, season-groups) | S–M | base + dist = + corpus + `test:ext` | b7a | Auto |
| b8 `refactor/move-ui-folders` | Étape 8 : `ui/content-safe/` (+ `sync-feedback`), `ui/controllers/`. **Après la décision Preact**, pour ne pas faire rebaser le pilote | S | base + dist = + `test:e2e` + `test:i18n-layout` + `test:ext` toasts | b7b, décision 12 | Auto |

Aucun test manuel n'est nécessaire en phase b si l'empreinte `dist/` est identique (b4bis : budgets identiques). En cas
de différence inexpliquée : arrêt et analyse.

### (c) Gains de bundle (contenu)

| Branche | Contenu | Gain | Risque | Tests | Dépend | Mode |
|---|---|---|---|---|---|---|
| c1 `perf/content-iife` | 2-A : `content.ts` en IIFE autonome (`standaloneFiles`) ; supprime le chargeur et l'entrée WAR CR/ADN (2-R8 / SEC-09) ; fixtures `build-checks.test.ts`, `output-names.test.ts:38` | −8,0 KB mesuré | S | budgets, `test:ext` playback + import | b2 | **Manuel** : CR et ADN réels (Chrome + Firefox) ; `npm run dev` (rechargement au lieu du HMR, non vérifié) |
| c2 `perf/content-debug-strings` | 2-B : 16 appels `info` / `debug` gardés + activation de la règle a6 | −0,85 KB (≈ −0,8 par bundle optionnel) | S | lint, budgets | c1, a6 | Auto |
| c3 `perf/content-mascot` | 2-E : `happyKai()` pour le toast | −1,1 KB par bundle | S | `test:ext` toasts | c1 | Auto (coup d'œil au toast) |
| c4 `perf/content-settings-reader` | 2-G : lecteur de réglages propre au contenu (+ `i18n/core`) | ≈ −1 KB (non mesuré) | S | `content.test.ts`, `test:ext` langue | c1, b6 | Auto |
| c5 `perf/history-on-demand` | 2-C : lecteurs CR/ADN en `content/history/history.iife.ts`, injectés par le SW (`background/history-scripts.ts`, message `INJECT_HISTORY_READER` d'origine `extension`) ; protocole de port inchangé | −10,8 KB mesuré | M | `import.ext.ts` (CR, ADN, coupure réseau), `import-cr.e2e`, tests des lecteurs | c1, b2 | **Manuel** : import CR et ADN réels, Chrome + Firefox (`executeScript` de fichiers en monde isolé, non vérifié) |
| c6 `perf/split-cr-adn-scripts` | 2-D : `content-crunchyroll.iife.ts` / `content-adn.iife.ts`, budgets par script réétalonnés à la taille mesurée + 10 % | CR ≈ 55–58 KB, ADN ≈ 45 KB (estimés) | S–M | budgets, `content-reinjection.test.ts`, `test:ext` | c5 | **Manuel** : CR + ADN réels ; vérifier que la regex `registeredScriptDir` ne classe pas ces IIFE manifeste parmi les scripts enregistrés |
| c7 `perf/journal-via-sw` | 2-F (décision 13) : `RECORD_LOG` d'origine `content` | −2,2 KB par bundle | M | `error-journal.test.ts`, `message-guards.test.ts` | c6 | Auto |
| c8 `chore/package-hygiene` | 2-H + PERF-22 : fichiers non référencés refusés par `package.ts`, `.woff` retirés | −43 KB et −128 KB de paquet | S | `verify:build`, `web-ext lint` | c6 | Auto |

### (d) Correctifs de performance

| Branche | Contenu | Risque | Tests | Dépend | Mode |
|---|---|---|---|---|---|
| d1 `perf/sync-requests` | PERF-07 (âge + même page via `matchCachedPageMedia` ; `runtime.getContexts` sur Chrome seulement) et PERF-08 (`getCatalogMedia` via `getAnimeByIds` en cache, 404 conservé). a3 resserré : plus d'`AnimeById` ni de `PageMedia` sans vue | S | unitaires, corpus, a3 `test:ext` | a3, b7a | Auto |
| d2 `perf/catalog-cache-per-media` | PERF-09 : cache `media:<id>`, `getAnimeByIds` ne demande que les manquants ; option miroir `storage.session` 5 min (PERF-19) | M | `media-cache.test.ts`, corpus (`searches` gelés), a3 | d1 | Auto |
| d3 `perf/storage-reads` | PERF-14 (`getKeys()` avec repli `get(null)` détecté) + PERF-17 (`ensureAiringAlarm` explicite, retrait de l'écouteur du SW) | S–M | `airing*.test.ts`, `agenda.test.ts`, `accounts.ext` | b6 | **Manuel léger** : activer / désactiver les alertes, Firefox (`getKeys` non vérifié) |
| d4 `perf/popup-lazy-settings` | PERF-15 : getter paresseux comme le panneau (S), puis `import()` dynamique de `settings-view` dans les deux pages | S | `popup.e2e` Réglages, `sidepanel.e2e` | — | Auto |
| d5 `perf/content-catalog-on-demand` | PERF-12 : catalogue chargé par `loadSettings` et le chemin du toast de raccourci, plus au démarrage | S | `content.test.ts`, `test:ext` langue | c4 | **Manuel** : toast en allemand ou japonais sur un site réel, Firefox |
| d6 `perf/series-page-lists` | PERF-11 (une requête `mediaList(mediaId_in)`, forme non vérifiée) + PERF-20 | M | `page-media.test.ts`, a3 page série | b7b | **Manuel** : page série réelle connectée AniList + MAL |
| d7 `perf/import-batching` | PERF-10 (pré-chargement par lots de 10) + B9 (voies de fond) + PERF-21 si décidé (déc. 14) | M | `cr-import.test.ts`, `rate-limit.test.ts`, `import.ext.ts` | b7b, d2 | **Manuel** : gros historique CR réel |
| d8 `perf/job-store` | PERF-16 : `pending` dans une clé séparée, heartbeat `{updatedAt}` minuscule ; migration d'un job en cours | M | `runner.test.ts`, `job-resume.test.ts`, `import.ext.ts` (reprise) | d7 | **Manuel** : pause / reprise d'un import, mise à jour pendant un job |

### (e) Refactors métier, directement dans les dossiers finaux

| Branche | Contenu | Risque | Tests | Dépend | Mode |
|---|---|---|---|---|---|
| e1 `refactor/mapping-store` | I1 : `saveLearned` (refuse au-dessus de `chosen`), `saveChosen`, `forgetIfUnchanged`, origine en union (migration de la forme stockée et des sauvegardes) ; L4 (`onChanged` sur `mediaMappings` dans le SW) | M | `storage.test.ts`, `sync-service.test.ts`, `backup*.test.ts`, corpus | b5, phase 0 | **Manuel léger** : export puis import de sauvegarde, Réglages › Correspondances |
| e2 `refactor/series-identity` | `platforms/series-identity.ts` : `mappingKey`, `platformSeriesKey`, préfixe, clé ignorée ; M5, reliquat L5, année dans les exclusions (déc. 7) ; a5-I7 passe au vert | M | a5-I7, `page-media*.test.ts`, `exclusions*.test.ts`, corpus | b4, e1 | **Manuel** : pages série Disney+ et Prime |
| e3 `refactor/rules-pipeline` | 1-4.1 : `rules-engine.ts` + `stages/*` + `finalize` (L1, déc. 9) ; scission de `matching.ts` (mapping, season-titles, signal-groups) ; 1-D2, D6–D9, D11 ; `noUncheckedIndexedAccess` sur `background/sync/` | M | **corpus strictement identique**, `matching*.test.ts`, `concordance.test.ts` | b7b, phase 0 | Auto (un étage à la fois, corpus vert) |
| e4 `refactor/judge` | 1-4.4 `judge()` + M4 (déc. 6) ; découpe de `resolveEpisode` (`fromCache`, `ignoredShortcut`, `fresh`) autour du store e1 | M | corpus (cas Bubble promu en `expected`), `page-media.test.ts`, `resolver.test.ts` | e3, e1 | **Manuel** : arcs One Piece Netflix (page série), Chrome |
| e5 `refactor/platform-policies` | 1-4.2 `PlatformMatchPolicy` ; 1-D4, D5, D15 | M | corpus identique, `matching-{prime,disney,netflix}.test.ts` | e4, e2 | Auto |
| e6 `refactor/candidates-pipeline` | 1-4.3 + port `background/ports/catalog.ts` ; les 12 `vi.mock('api/media')` deviennent des faux | M | corpus (`searches` identiques), `resolver*.test.ts`, a3 | e5, d2 | Auto |
| e7 `refactor/entry-commands` | 1-I6 / 6-P3 `runOnServices` pour `controls`, `engagement`, `writeEntry`, l'import ; 6-D9, D10, B5, 6-D4, B7 (déc. 18), L3 ; option L2 (`getValidToken(service, epoch)`) | M | a5 `controls`, `engagement.test.ts`, `sync-service.test.ts`, `lists.ext.ts` | b7a | **Manuel** : +1 / −1, statut, retirer, noter, sur de vrais comptes (Chrome) |
| e8 `refactor/tracker-codecs` | 6-P2 `ScoreCodec`, `fullList`, `targetId` ; maps MAL (6-D6) ; test de contrat de parité (prolonge B1) | M | `api/*.test.ts`, `compare*.test.ts`, `score.test.ts` | e7 | **Manuel** : note sur AniList `POINT_10` + MAL réels |
| e9 `refactor/account-data-registry` | 6-P4 : registre `AccountBoundStore[]`, test « toute clé de `STORAGE_KEYS` est classée » | S–M | `storage.test.ts`, `accounts.ext.ts` | b5 | Auto |
| e10 `refactor/history-sources` | 6-P1 `HistorySource` + règle « vu » et réducteur uniques (6-D1, D2), événements bruts sur le port ; `import-cr/sources/<p>.ts` + `state.ts` (sans les vues) ; scission `history-import/{analyze,apply,batch-writer}` ; 1-D10 (revalidation des correspondances en cache), 1-D14 / 6-D3 | M–L | `netflix-import-parity.test.ts`, `adn-import.test.ts`, `netflix-import.test.ts`, `cr-import.test.ts`, `import.ext.ts`, `import-cr.e2e` | c5, d7, e7 | **Manuel** : imports CR, ADN et Netflix réels, Chrome + Firefox |
| e11 `refactor/bridge-kit` | 2-2.1 kit MAIN, 2-2.2 kit client (délai obligatoire, 2-R11), 2-2.3 helpers (`shared/lru.ts`, `parseJsonBounded`, `installOnce`, `withSignals`, `domainOrSubdomain`, `dom-strategies.ts`) ; 2-R3 (emplacement de gestionnaire sans version) s'il n'a pas été fait cette nuit ; SEC-05 (`Object.hasOwn`, en-têtes honnêtes) ; bump des 4 versions de ponts | M | tests `page-bridge`, `bridge-client`, `bridge-protocol` (après a4), a1 #1, a2, budgets | a4, b4bis, c1 | **Manuel** : Netflix, Disney+, Prime réels (non automatisables) + CR, Chrome + Firefox |
| e12 `refactor/background-small-extractions` | 6-P6 (`getAniListUserId`, `reserveJob`, `isRetryable` = 6-D8), B11 (`withHeartbeat`) ; option 1-4.5 `decideSyncAction` | S | `runner.test.ts`, `queue-policy.test.ts`, `compare.test.ts` | b7b | Auto |

**Correctifs fonctionnels restants**, à placer après b7b (ils touchent des fichiers déplacés) :

| Branche | Contenu | Risque | Mode |
|---|---|---|---|
| s1 `fix/https-patterns` | SEC-02 (déc. 2) + `permissions.md` + `store-permissions.test.ts` | S | **Manuel** : mise à jour avec un accès Netflix / Disney+ / Prime déjà accordé, Chrome + Firefox ; blocs collés avant le tag |
| s2 `fix/episode-guards` | SEC-01 (déc. 1), SEC-10, cas adverses au corpus (5-3.5) | M | **Manuel** : enchaînement autoplay sans déclencher la limite |
| s3 `fix/token-boundary` | SEC-06 (masquage du diagnostic dans le SW, exception a1 levée), B8 / SEC-14, SEC-08 (après vérification que AniList renvoie `state`), SEC-07 (doc) | S | **Manuel** : connexions AniList / MAL (`launchWebAuthFlow` non automatisable), rapport de diagnostic |
| s4 `fix/stored-url-validation` | SEC-04 (revalidation des URL de `WatchingList` à la lecture) | S | Auto |
| s5 `chore/csp` | SEC-12 (déc. 15) + test de synchronisation | S | **Manuel** : toutes les pages et le SW, Chrome + Firefox |
| s6 `fix/content-robustness` | 2-R7 (sondage 1 s conservé), 2-R9 (doc), 2-R10 (plafond ~200), 2-R12, 2-R13 ; M6 (déc. 8) | S | **Manuel** : navigation SPA sous Firefox |

### (f) UI, selon la décision Preact

**Indépendant de Preact** (aucun rendu ; peut passer avant la décision) :

| Branche | Contenu | Risque | Tests | Mode |
|---|---|---|---|---|
| f0 `fix/ui-small` | 4-A2 (`data-focus-fallback`), 4-R1 (minuteur annulé), 4-R3, 4-#13 (onglet « soon » + 3 clés × 21 catalogues + `context.json`), 4-#16, 4-#17, `upperFirst(locale)`, helper `tSlots` + test sur tous les catalogues | S | `sidepanel.e2e`, `import-cr.e2e`, `tabs.test`, `i18n:check` | Auto |
| f1 `refactor/ui-platform-access-store` | 4-D6 : un store par page, une seule paire d'écouteurs, `requestPlatformAccessFromClick` ; Réglages passe de 3 booléens à un tableau ; 4-R2 | M | `popup.e2e` bascules, `sidepanel.e2e` UX-05, `page-media-controller.test` | **Manuel** : activer / désactiver Netflix, Disney+, Prime (dialogue natif) |
| f2 `refactor/ui-worker-call` | 4-D8 `callWorker` (9 copies, message d'erreur de l'Agenda harmonisé) + `mediaRefOf` | S | `controllers/*.test.ts`, `accounts.test` | Auto |
| f3 `refactor/ui-controllers-extract` | Limiteur de redétection + filtre anti-écho (4-§3, 5 #4), contrôleur de données de l'Agenda, `footerStatus` pur, `dispose()` (4-R6) | S–M | `page-media-controller.test`, `agenda-load.test` | Auto |

**Dépend de la décision Preact (déc. 12)** : ne rien unifier à la main avant cette décision.

- **Si Preact est adopté (pages seulement)** : migration écran par écran à partir de l'écran du pilote. Les primitives de 4-D1…D5 (menu + état de menu, bandeau, lignes d'état, en-têtes, liens externes) deviennent des composants. 4-A1 se règle dans le composant menu, 4-A3 par une région live persistante par page. Les messages sont stockés en `{ key, params }` (4-§2.4 étape 7). Les grosses vues (`popup.ts`, `watching-screen.ts`, vues de l'Agenda, `now-playing.ts`, vues de `import-cr`) se scindent pendant la migration, pas avant. 4-§2.3 (`page-context`, `screen`, `region`) est remplacé par les signaux / hooks, sur les stores existants (f1, f3). Tests : `test:e2e`, `test:i18n-layout`, `panel.ext`, `lists.ext`. **Manuel** : popup et panneau, Chrome + Firefox, à chaque écran.
- **Si Preact est rejeté** : audit 4 §2.4, étapes 1 à 7 en vanilla (`ui/page-context.ts`, `ui/screen.ts`, `ui/region.ts`), puis D1…D5 en fonctions de kit et scission des grosses vues (4-§3). L'étape 4 (shell du panneau, focus synchrone) reste la plus risquée.
- **Dans les deux cas** : si la décision tarde de plus de deux semaines, corriger 4-A1 localement (S). Le gabarit S/E (déc. 3) et les noms de plateformes en placeholders (4-#12) sont faits une fois, dans le composant final.

### 6.1 Ordre résumé

0 (nuit) → a1–a7 → b1 → b2 → b3 → b4 → b4bis → b5 → b6 → b7a → b7b → c1 → c2/c3/c4 → c5 → c6 → (c7, c8) →
d1 → d2 → d3/d4 → d5 → d6 → d7 → d8 → e1 → e2 → e3 → e4 → e5 → e6 → e7 → e8 → e9 → e10 → e11 → e12 →
s1–s6 (s1 groupé avec la release 2.4.0) → f0–f3 → b8 + f (après la décision Preact).
Les phases c et d peuvent s'entrelacer avec e une fois b7b fusionnée : elles touchent des fichiers différents, sauf
d2 et e6 (`anilist/media.ts`), d7 et e10 (`history-import/`), qui restent dans cet ordre.

**Sans surveillance** : a1–a6, toute la phase b, c2–c4, c7, c8, d1, d2, d4, e3, e5, e6, e9, e12, s4, f0, f2, f3.
**Test manuel du propriétaire** : la phase 0, c1, c5, c6, d3 (léger), d5–d8, e1 (léger), e2, e4, e7, e8, e10, e11,
s1–s3, s5, s6, f1 et toute la migration UI.

---

## 7. Ce qui n'a pas été vérifié (UNVERIFIED, tous audits)

**Matching (1)**
- Les adaptateurs émettent-ils réellement `seasonEpisodeNumber: null` avec un numéro absolu (M6) ?
- Existe-t-il de vraies paires AniList de remakes homonymes portant chacun un lien Disney+ / Prime (H2 : chemin confirmé, fréquence inconnue) ?
- À quelle fréquence `seasons[].year` de Netflix contredit-il la fiche liée (H1) ?
- À quelle fréquence MAL et AniList découpent-ils une saison différemment ?
- `signalGroups` sans `linksElsewhereOnly` sur un cas réel (1-D5) ?

**Contenu (2)**
- Gains supposés du kit sur les ponts Disney+ / Prime (~+0,2 KB) et de 2-G (≈ −1 KB).
- Mode dev (`npm run dev`) après le passage en IIFE.
- Retrait des entrées WAR des plateformes optionnelles (crxjs les ajoute, `checkWebAccessibleResources` les exige).
- 2-R6 (catalogue Prime en avance) et 2-R7 (Navigation API dans le bac à sable Firefox).
- Absence de nouvel avertissement à la revue Store après 2-D.
- Total cumulé A+B+E+F+C+D, additionné et non construit d'un bloc.

**Performance (3)**
- Toutes les latences (RTT, toast en 1–2 s, page série).
- Tailles réelles d'un plan CR et d'un job sur un gros historique, et la marge de quota.
- Disponibilité sur Firefox de `runtime.getContexts`, `storage.local.getKeys` et de la Navigation API.
- Forme de la requête AniList `mediaList(mediaId_in)` (PERF-11).
- Coût de parse des graphes SW (299 KB) et popup (316 KB) sur du matériel modeste.
- Tailles des JSON SPA Prime / Disney+ re-parsés dans MAIN.
- Origine des source maps du premier `dist/` : course entre builds parallèles dans le même arbre. Leçon : toujours un worktree par agent.
- Estimation du gain de PERF-10.

**UI (4)** (audit fait sans exécution)
- Annonce des régions live recréées (4-A3, dépend du lecteur d'écran).
- Impact réel de l'écriture des réglages sans verrou (4-R4, corrigé cette nuit).
- Scintillement du panneau (4-R5).
- Absence de « Autoriser l'accès » dans le panneau Firefox (4-#18).
- 4-A2 confirmé par lecture de `pickFocusKey`, pas exécuté.

**Sécurité (5)**
- Préchargement HSTS de tous les sous-domaines CR / ADN (SEC-02).
- `setAccessLevel` sur `storage.local` (SEC-04).
- `use_dynamic_url: true` avec le chargeur ESM (SEC-09, sans objet après 2-A pour CR / ADN).
- AniList renvoie-t-il `state` dans le fragment (SEC-08) ?
- Appareil « SyncKai » listé à chaque import (SEC-11).
- Atteignabilité réelle de `LOGIN_MAL` avec un jeton présent (SEC-14 / B8).

**Domaines (6)**
- B7 (retrait vs file), B8 (atteignabilité en UI).
- Aucun constat de l'audit 6 n'a été reproduit sur les sites réels ; B1 et B2 sont confirmés par exécution unitaire.

**Dossiers (7)**
- Sortie strictement identique après les déplacements (probable : même graphe de modules).
- Vitest échoue-t-il sur un `vi.mock` qui ne cible plus rien ? Supposé que non, d'où le test a1 #8.
- Tree-shaking complet des barrels par Rolldown (argument pour les rejeter).
- Persistance par Chrome d'URL de pages à la mise à jour (sans objet si l'étape 10 n'est pas faite).

**Synthèse (ajouts à vérifier pendant le plan)**
- Un accès optionnel accordé en `*://` reste-t-il reconnu après le passage du manifeste en `https://` (s1) ?
- La regex `registeredScriptDir` traite-t-elle correctement les nouveaux IIFE de manifeste dans `content/crunchyroll/` et `content/adn/` (c6), ainsi que `content/history/` (c5) ?
- Neutralisation de l'horodatage de build pour l'empreinte `dist/` (a2).

**Couverture structurelle manquante (tous audits)** : rien n'exécute Firefox en test (seul `web-ext lint`), ni les
sites réels Netflix / Disney+ / Prime (dialogue de permission natif), ni le flux `launchWebAuthFlow`, ni le
renouvellement MAL de bout en bout (`seed.ts:15` sans faux `oauth2/token`), ni le chemin IndexedDB réel de
`token-key-store` hors `test:ext`.
