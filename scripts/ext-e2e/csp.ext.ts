// CSP des pages de l'extension et du service worker (SEC-12) sur l'extension construite : chaque page s'affiche sans
// aucune violation relevée par le navigateur (domaine Log, source « security »), le service worker lit encore les
// catalogues de traduction du paquet (connect-src 'self') et joint les faux AniList / MAL (connect-src de leurs API).
// Les autres scénarios vérifient aussi l'absence de violation (seed.ts › expectCleanRun).
// Lancement : npm run test:ext
import { describe, expect, it } from 'vitest';
import { sleep, waitFor } from './harness';
import { DUNGEON_MESHI, expectCleanRun, seedSettings } from './seed';
import { clickOn, launch, openPanel, openPopup, sel, type SeriesSeed } from './scenario';

/** Delicious in Dungeon à l'épisode 7 sur les deux listes : barres de progression du popup (largeur, étincelle) */
const DUNGEON: SeriesSeed = {
  anilist: { id: DUNGEON_MESHI.mediaId, idMal: DUNGEON_MESHI.malId, title: DUNGEON_MESHI.title, episodes: DUNGEON_MESHI.episodes, externalLinks: [] },
  mal: { id: DUNGEON_MESHI.malId, title: DUNGEON_MESHI.title, numEpisodes: DUNGEON_MESHI.episodes },
  anilistEntry: { status: 'CURRENT', progress: 7 },
  malEntry: { status: 'watching', num_episodes_watched: 7 },
};

describe('CSP des pages et du service worker (SEC-12)', () => {
  it('popup, réglages, panneau, sauvegarde et pages d’import sans violation ; catalogues et API joignables', async (context) => {
    const { h, anilist, mal } = await launch(context, [DUNGEON]);

    // Contrôle du relevé : une violation volontaire est bien vue
    const probe = await h.openPage('src/popup/popup.html');
    await probe.evaluate(() => document.body.setAttribute('style', 'outline: 1px solid red'));
    await waitFor('violation volontaire relevée', () => h.cspViolations.length > 0);
    await probe.close();
    h.cspViolations.length = 0;

    // Popup : « En cours » (barres de progression), puis les réglages
    const popup = await openPopup(h);
    await popup.waitForSelector(sel(`title-${DUNGEON.anilist.id}:${DUNGEON.mal.id}`), { timeout: 15_000 });
    await clickOn(popup, sel('gear'));
    await clickOn(popup, sel('settings-cat-accounts'));
    await popup.waitForSelector(sel('entry-service-mal'));

    // Panneau (Agenda hors page de streaming), sauvegarde, import de chaque plateforme
    await openPanel(h);
    await h.openPage('src/import/import.html', { width: 600, height: 800 });
    for (const platform of ['crunchyroll', 'adn', 'netflix']) await h.openPage(`src/import-cr/import-cr.html?platform=${platform}`, { width: 600, height: 800 });

    // Service worker : catalogue d'une autre langue lu dans le paquet (fetch de assets/locales/fr.json, connect-src 'self')
    await seedSettings(h, { language: 'fr' });
    const catalog = await h.sendFromContent('GET_CONTENT_CATALOG', { locale: 'fr' });
    expect(catalog).not.toBeNull();
    expect(Object.keys(catalog ?? {}).length).toBeGreaterThan(0);

    // Relevé après un court délai : rendus différés, images, requêtes du worker
    await sleep(1_000);
    expect(anilist.requests.length).toBeGreaterThan(0);
    expectCleanRun(h, anilist, mal);
  }, 90_000);
});
