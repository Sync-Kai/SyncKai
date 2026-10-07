<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/kai-lockup-dark.svg">
    <img src="assets/brand/kai-lockup-light.svg" alt="SyncKai" width="420">
  </picture>
</p>

<p align="center">Regarde tes animes sur Crunchyroll ou ADN : ta liste AniList / MyAnimeList se met à jour toute seule au générique.</p>

<p align="center">
  <a href="https://github.com/Sync-Kai/SyncKai/releases"><img alt="Version" src="https://img.shields.io/github/v/release/Sync-Kai/SyncKai?label=version"></a>
  <a href="LICENSE"><img alt="Licence MIT" src="https://img.shields.io/badge/licence-MIT-blue.svg"></a>
</p>

<!-- capture : popup, onglet « En cours » -->

## Fonctionnalités

- **Synchro automatique au générique de fin** : l’épisode est marqué comme vu dès le début du générique (Crunchyroll), sinon à un pourcentage réglable (85 % par défaut).
- **AniList et MyAnimeList**, ensemble ou séparément : chaque compte est facultatif.
- **Reconnaissance intelligente des saisons** : numérotation absolue (One Piece E1180) ou par saison, saisons découpées en plusieurs fiches. En cas de doute, une carte **À vérifier** te laisse choisir la bonne fiche.
- **En cours** : tes séries avec le prochain épisode (« Ép. 5 dans 18 h », « Ép. 3 disponible »), triables par prochaine sortie, dernière mise à jour, titre ou épisodes restants.
- **Ouvrir** une série directement sur Crunchyroll ou ADN, selon ton **lecteur préféré**.
- **Notifications sur la page** à trois niveaux : *Discrètes*, *Détaillées*, *Alertes seulement*. Compatibles plein écran.
- **File de synchro hors ligne** : en cas de coupure réseau ou de service indisponible, la synchro est relancée automatiquement.
- **+1 / −1** sur chaque série, et raccourci **Alt+Maj+S** pour valider l’épisode en cours.
- **Exclusion par série** : « Ne plus synchroniser cette série », réactivable à tout moment.
- **Note en fin de série** : une bulle « Ta note ? » quand une série passe en Terminé.
- **Revisionnage** : SyncKai le détecte sur une série terminée et le propose.
- **Alertes de nouveaux épisodes** : notification à la sortie d’un épisode de tes séries en cours.
- **Sauvegarde** : export / import de tes réglages, correspondances et historique (jamais de tes connexions).
- **Interface en français, anglais et allemand.**

<!-- capture : bulle de synchronisation sur Crunchyroll -->
<!-- capture : carte « À vérifier » -->

## Plateformes et services pris en charge

| Plateformes de streaming | Fin d’épisode détectée | | Services de suivi |
| --- | --- | --- | --- |
| [Crunchyroll](https://www.crunchyroll.com) | Début du générique (repli au pourcentage) | | [AniList](https://anilist.co) |
| [ADN](https://animationdigitalnetwork.com) | Pourcentage réglable | | [MyAnimeList](https://myanimelist.net) |

Navigateurs : Chrome 116 ou plus récent (et navigateurs basés sur Chromium : Edge, Brave…), Firefox 142 ou plus récent (ordinateur).

## Installation

### Chrome Web Store (recommandé)

[Installer SyncKai depuis le Chrome Web Store](https://chromewebstore.google.com/detail/synckai/khokcmigioggannjoojambdgioigdceb).

### Firefox Add-ons

SyncKai pour Firefox est en cours d’examen par Mozilla : le lien arrive très bientôt.

### Installation depuis les sources

La connexion AniList / MyAnimeList n’est autorisée que pour l’identifiant de l’extension du Chrome Web Store : le zip des [Releases](https://github.com/Sync-Kai/SyncKai/releases) (sans clé) chargé à la main obtient un autre identifiant et ne peut pas se connecter. Pour une version de développement, compile le projet (voir [Contribuer](#contribuer)) : le `manifest.json` du dépôt conserve l’identifiant du Store.

## Prise en main

1. **Connecte ton compte** : clique sur l’icône SyncKai, puis sur *Connecter AniList* et/ou *Connecter MyAnimeList*.
2. **Regarde un épisode** sur Crunchyroll ou ADN, comme d’habitude.
3. **Vérifie le popup** : l’épisode apparaît dans *Activité › Dernières synchros*, et ta série dans *En cours*. Si une carte *À vérifier* s’affiche, choisis la bonne fiche une fois : SyncKai s’en souvient pour la suite.

<!-- capture : écran de premier lancement -->

## FAQ

**Mon épisode n’a pas été synchronisé.**
Regarde d’abord la barre d’état du popup : élément à vérifier, synchro en attente ou session expirée (« Reconnecter »). Vérifie aussi que la synchro automatique n’est pas en pause et que la série n’est pas exclue (Réglages). Après une mise à jour de l’extension, recharge l’onglet du lecteur. En dernier recours, `Alt+Maj+S` valide l’épisode en cours.

**SyncKai a choisi la mauvaise saison.**
Dans *Activité › Dernières synchros*, clique sur **Corriger** et choisis la bonne fiche. Tu peux aussi « Oublier » une correspondance dans *Réglages › Correspondances* : elle sera recalculée au prochain épisode. Pense à corriger la progression enregistrée par erreur (bouton −1 dans *En cours*).

**Je ne vois pas les notifications en plein écran.**
C’est voulu en mode *Discrètes* (par défaut) : rien en plein écran, une coche apparaît sur l’icône de l’extension. Choisis *Détaillées* dans *Réglages › Notifications sur la page* pour voir la bulle complète. Les alertes (à vérifier, erreur, reconnexion) s’affichent toujours.

**Que deviennent mes données ?**
Rien ne passe par un serveur SyncKai : tout reste dans ton navigateur et seules les API AniList et MyAnimeList sont contactées. Détails dans la [politique de confidentialité](PRIVACY.md).

## Confidentialité

Pas de serveur, pas de statistiques d’usage, pas de publicité. Voir [PRIVACY.md](PRIVACY.md) (français, English, Deutsch).

## Contribuer

Les signalements de bugs et suggestions sont les bienvenus dans les [issues](https://github.com/Sync-Kai/SyncKai/issues).

Prérequis : Node.js 20+ et Chrome.

```bash
npm install       # dépendances
npm run dev       # build de développement (Vite + @crxjs/vite-plugin)
npm run build     # vérification TypeScript + build de production dans dist/ (console : warn/error)
npm run build:dev # même build avec les journaux détaillés (info/debug) dans la console
npm test          # tests unitaires (Vitest)
```

Charge ensuite le dossier `dist/` via **Charger l’extension non empaquetée**. Pour empaqueter une version (zip prêt pour le Chrome Web Store, sans la clé `key`), lance `npm run package` : le fichier est créé dans `release/`. Les informations de publication sur le Chrome Web Store sont dans [docs/STORE.md](docs/STORE.md).

**Traductions** : les textes de l’interface sont dans `src/i18n/locales/` (`fr.json`, `en.json`, `de.json`), et le nom / la description de l’extension dans `public/_locales/`. Une plateforme de traduction collaborative (Weblate) est prévue ; d’ici là, les contributions passent par une pull request.

## Licence

[MIT](LICENSE) © 2026 Quentin Geerts

SyncKai n’est affilié ni à Crunchyroll, ni à ADN, ni à AniList, ni à MyAnimeList.

---

## In English

**SyncKai** is a Chrome extension that automatically updates your **AniList** and/or **MyAnimeList** list while you watch anime on **Crunchyroll** or **ADN**: the episode is marked as watched when the ending credits start (or at an adjustable percentage).

- Smart season matching, with review cards when a match is uncertain.
- “Watching” list with next-episode countdown, sorting and an “Open” button for your preferred player.
- Offline retry queue, +1 / −1, `Alt+Shift+S` shortcut, per-series exclusion.
- Rating prompt at series end, rewatch detection, new-episode alerts, backup export / import.
- Interface in French, English and German.

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/synckai/khokcmigioggannjoojambdgioigdceb) (Firefox Add-ons: coming soon). No server, no analytics: see the [privacy policy](PRIVACY.md). Licensed under [MIT](LICENSE).
