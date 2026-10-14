// Comptes et mise à jour, sur l'extension construite (docs/audit/MANUAL-TESTS.md §1) : tokens chiffrés, mise à jour
// sans perte de session, session expirée, changement de compte avec une synchro en file.
// Lancement : npm run test:ext
import type { Page } from 'puppeteer';
import { describe, expect, it } from 'vitest';
import { tl, type MessageKey, type MessageParams } from '../../src/i18n';
import { SESSION_EXPIRED_KEYS, STORAGE_KEYS, SYNC_QUEUE_KEY } from '../../src/shared/storage-keys';
import { isSealedToken } from '../../src/shared/token-crypto';
import { FakeAniList } from './fake-anilist';
import { FakeMal } from './fake-mal';
import { startExtension, waitFor, type ExtensionHarness } from './harness';
import {
  ANILIST_A,
  ANILIST_B,
  FRIEREN,
  MAL_A,
  anilistAccount,
  anilistMedia,
  crunchyrollEpisode,
  expectCleanRun,
  malAccount,
  malAnime,
  seedMapping,
  seedSettings,
  seedTokens,
  signIn,
} from './seed';

const en = (key: MessageKey, params?: MessageParams): string => tl('en', key, params);
const sel = (focus: string): string => `[data-focus="${focus}"]`;

/** Faux services avec Frieren à l'épisode 5 sur les deux listes */
function fakes(): { anilist: FakeAniList; mal: FakeMal } {
  return {
    anilist: new FakeAniList({ media: [anilistMedia(FRIEREN)], accounts: [anilistAccount(ANILIST_A, { [FRIEREN.mediaId]: { status: 'CURRENT', progress: 5 } }), anilistAccount(ANILIST_B)] }),
    mal: new FakeMal({ anime: [malAnime(FRIEREN)], accounts: [malAccount({ [FRIEREN.malId]: { status: 'watching', num_episodes_watched: 5 } })] }),
  };
}

/** Popup ouvert dans un onglet (même page que la bulle de l'icône) */
async function openPopup(h: ExtensionHarness): Promise<Page> {
  const page = await h.openPage('src/popup/popup.html', { width: 400, height: 580 });
  await page.waitForSelector('footer');
  return page;
}

async function ariaLabel(page: Page, selector: string): Promise<string | null> {
  return page.$eval(selector, (el) => el.getAttribute('aria-label'));
}

describe('Comptes', () => {
  it('tokens en clair chiffrés au premier accès, token déchiffré envoyé aux API, aucun secret en clair dans le stockage', async (context) => {
    const { anilist, mal } = fakes();
    const h = await startExtension(context, { routes: [anilist.handler, mal.handler] });
    await seedSettings(h);
    await seedTokens(h, { anilist: ANILIST_A.token, mal: true });
    // Ancien format bien en place avant le premier accès du service worker
    expect((await h.storage())[STORAGE_KEYS.anilistToken]).toMatchObject({ accessToken: ANILIST_A.token });

    expect(await h.send('GET_VIEWER', null)).toMatchObject({ ok: true, data: { id: ANILIST_A.viewer.id, name: ANILIST_A.viewer.name } });
    expect(await h.send('GET_MAL_VIEWER', null)).toMatchObject({ ok: true, data: { id: MAL_A.user.id, name: MAL_A.user.name } });

    const stored = await h.storage();
    for (const key of [STORAGE_KEYS.anilistToken, STORAGE_KEYS.malToken]) {
      expect(isSealedToken(stored[key]), key).toBe(true);
      expect(Object.keys(stored[key] as object).sort()).toEqual(['data', 'expiresAt', 'iv', 'v']);
    }
    // Aucun secret en clair, nulle part dans le stockage (profils en cache compris)
    const dump = JSON.stringify(stored);
    for (const secret of [ANILIST_A.token, MAL_A.token, MAL_A.refreshToken]) expect(dump).not.toContain(secret);

    // Le token déchiffré est bien celui envoyé aux API
    expect(anilist.requests.map((r) => [r.operation, r.token])).toEqual([['Viewer', ANILIST_A.token]]);
    expect(mal.requests.map((r) => [r.method, r.path, r.token])).toEqual([['GET', '/users/@me', MAL_A.token]]);

    // Les requêtes suivantes déchiffrent le token chiffré (plus aucun ancien format)
    expect(await h.send('GET_WATCHING', { service: 'anilist', force: true })).toMatchObject({ ok: true, data: { entries: [{ mediaId: FRIEREN.mediaId, progress: 5 }] } });
    expect(anilist.requests.at(-1)).toMatchObject({ operation: 'Watching', token: ANILIST_A.token });
    expectCleanRun(h, anilist, mal);
  });

  it('session refusée par AniList : « Session expirée » avec « Reconnecter », jamais « Non connecté »', async (context) => {
    const { anilist, mal } = fakes();
    const h = await startExtension(context, { routes: [anilist.handler, mal.handler] });
    await seedSettings(h);
    await signIn(h, { anilist: ANILIST_A, mal: true });

    // Application révoquée sur anilist.co, puis une synchro (+1)
    anilist.revoke(ANILIST_A.token);
    const outcome = await h.send('ADJUST_PROGRESS', { mediaId: FRIEREN.mediaId, malId: FRIEREN.malId, delta: 1 });
    expect(outcome).toMatchObject({ status: 'synced', results: [{ service: 'anilist', outcome: { status: 'error' } }, { service: 'mal', outcome: { status: 'updated', progress: 6 } }] });

    const stored = await h.storage();
    expect(stored[SESSION_EXPIRED_KEYS.anilist]).toBe(true);
    expect(stored[STORAGE_KEYS.anilistToken]).toBeUndefined();
    expect(stored[SESSION_EXPIRED_KEYS.mal]).toBeUndefined();

    const popup = await openPopup(h);
    await popup.waitForSelector(sel('footer-reconnect'));
    expect(await ariaLabel(popup, sel('footer-reconnect'))).toBe(en('common.reconnectService', { service: 'AniList' }));
    const footer = await popup.$eval('footer', (el) => el.textContent ?? '');
    expect(footer).toContain(en('common.sessionExpired'));
    expect(footer).not.toContain(en('feedback.notConnected.title'));
    expect(await ariaLabel(popup, sel('chip-anilist'))).toBe(en('footer.chip.expired', { service: 'AniList' }));
    expect(await ariaLabel(popup, sel('chip-mal'))).toBe(en('footer.chip.ok', { service: 'MyAnimeList' }));
    expectCleanRun(h, anilist, mal);
  });

  it('mise à jour (relance sur une nouvelle version) : comptes toujours connectés, données gardées, réseau du nouveau worker intercepté', async (context) => {
    const { anilist, mal } = fakes();
    const h = await startExtension(context, { routes: [anilist.handler, mal.handler], version: '2.3.0' });
    await seedSettings(h, { completionPercentage: 90 });
    await signIn(h, { anilist: ANILIST_A, mal: true });
    await seedMapping(h, FRIEREN);
    expect(await h.sendFromContent('EPISODE_COMPLETED', { episode: crunchyrollEpisode(FRIEREN, 6), services: null })).toMatchObject({
      status: 'synced',
      results: [{ service: 'anilist', outcome: { status: 'updated', progress: 6 } }, { service: 'mal', outcome: { status: 'updated', progress: 6 } }],
    });
    const before = await h.storage();
    expect(before[STORAGE_KEYS.recentSyncs]).toHaveLength(1);
    const requestsBefore = anilist.requests.length;

    // chrome.runtime.reload() ne recharge pas une extension chargée par --load-extension dans ce Chromium headless (elle
    // reste déchargée) : la mise à jour passe par une relance du navigateur sur le même profil avec une version plus récente
    await h.restart({ version: '2.3.1' });
    expect(await (await h.bridge()).evaluate(() => chrome.runtime.getManifest().version)).toBe('2.3.1');

    const after = await h.storage();
    const kept = [
      STORAGE_KEYS.anilistToken,
      STORAGE_KEYS.malToken,
      STORAGE_KEYS.anilistViewer,
      STORAGE_KEYS.malViewer,
      STORAGE_KEYS.recentSyncs,
      STORAGE_KEYS.mediaMappings,
      STORAGE_KEYS.sessionEpoch,
      'settings',
    ];
    for (const key of kept) expect(after[key], key).toEqual(before[key]);
    expect(after[SESSION_EXPIRED_KEYS.anilist]).toBeUndefined();
    expect(after[SESSION_EXPIRED_KEYS.mal]).toBeUndefined();

    // Tokens toujours déchiffrables (clé de l'IndexedDB conservée) et réseau du nouveau worker toujours intercepté
    expect(await h.send('GET_VIEWER', null)).toMatchObject({ ok: true, data: { id: ANILIST_A.viewer.id } });
    expect(await h.send('GET_MAL_VIEWER', null)).toMatchObject({ ok: true, data: { id: MAL_A.user.id } });
    expect(anilist.requests.slice(requestsBefore).map((r) => [r.operation, r.token])).toEqual([['Viewer', ANILIST_A.token]]);

    const popup = await openPopup(h);
    await popup.waitForSelector(sel('chip-mal'));
    expect(await ariaLabel(popup, sel('chip-anilist'))).toBe(en('footer.chip.ok', { service: 'AniList' }));
    expect(await ariaLabel(popup, sel('chip-mal'))).toBe(en('footer.chip.ok', { service: 'MyAnimeList' }));
    expect(await popup.$(sel('footer-reconnect'))).toBeNull();
    expectCleanRun(h, anilist, mal);
  });

  it('changement de compte : la synchro en file de l’ancien compte AniList n’est jamais écrite sur le nouveau', async (context) => {
    const { anilist, mal } = fakes();
    const h = await startExtension(context, { routes: [anilist.handler, mal.handler] });
    await seedSettings(h);
    await signIn(h, { anilist: ANILIST_A, mal: true });
    await seedMapping(h, FRIEREN);

    // AniList bloqué : l'épisode terminé part dans la file de relance (sessions AniList A et MAL)
    anilist.failure = { network: true };
    const episode = crunchyrollEpisode(FRIEREN, 6);
    expect(await h.sendFromContent('EPISODE_COMPLETED', { episode, services: null })).toMatchObject({ status: 'error', code: 'NETWORK', queued: true });
    const [queued] = await waitFor('synchro en file', async () => {
      const queue = (await h.storage())[SYNC_QUEUE_KEY];
      return Array.isArray(queue) && queue.length === 1 ? queue : null;
    });
    expect(queued).toMatchObject({ id: `crunchyroll:${episode.episodeId}`, services: ['anilist', 'mal'], epochs: { anilist: 0, mal: 0 }, status: 'pending' });

    // Déconnexion d'AniList depuis le popup (pastille du compte → Réglages › Comptes → « Déconnecter »)
    const popup = await openPopup(h);
    await popup.waitForSelector(sel('footer-queue'));
    await popup.locator(sel('chip-anilist')).click();
    await popup.locator(sel('logout-anilist')).click();
    const afterLogout = await waitFor('session AniList fermée', async () => {
      const stored = await h.storage();
      return stored[STORAGE_KEYS.anilistToken] === undefined ? stored : null;
    });
    expect(afterLogout[STORAGE_KEYS.sessionEpoch]).toEqual({ anilist: 1 });
    expect(afterLogout[SESSION_EXPIRED_KEYS.anilist]).toBeUndefined();
    // La part AniList de la synchro en file est retirée ; celle de MAL (même session) reste
    expect(afterLogout[SYNC_QUEUE_KEY]).toMatchObject([{ id: queued.id, services: ['mal'], epochs: { mal: 0 } }]);

    // Autre compte AniList, puis AniList débloqué et « Réessayer »
    await seedTokens(h, { anilist: ANILIST_B.token });
    anilist.failure = null;
    expect(await h.send('GET_VIEWER', null)).toMatchObject({ ok: true, data: { id: ANILIST_B.viewer.id } });
    const retried = await h.send('RETRY_QUEUED', { id: queued.id });
    expect(retried).toMatchObject({ status: 'synced', results: [{ service: 'mal', outcome: { status: 'updated', progress: 6 } }] });

    // Rien d'écrit sur le compte B (ni sur A) ; MAL rattrapé
    expect(anilist.mutations()).toEqual([]);
    expect(anilist.entry(ANILIST_B.token, FRIEREN.mediaId)).toBeNull();
    expect(anilist.entry(ANILIST_A.token, FRIEREN.mediaId)).toMatchObject({ progress: 5 });
    expect(mal.entry(MAL_A.token, FRIEREN.malId)).toMatchObject({ num_episodes_watched: 6 });
    expect((await h.storage())[SYNC_QUEUE_KEY]).toBeUndefined();
    expectCleanRun(h, anilist, mal);
  });
});
