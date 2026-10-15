// Synchro et contrôles, sur l'extension construite (docs/audit/MANUAL-TESTS.md §2) : échec partiel puis « Réessayer »,
// deux +1 simultanés, revisionnage terminé, pas de demande de note en double.
// Lancement : npm run test:ext
import { describe, expect, it } from 'vitest';
import { tl, type MessageKey, type MessageParams } from '../../src/i18n';
import { PENDING_RATINGS_KEY } from '../../src/protocol/storage-keys';
import { FakeAniList } from './fake-anilist';
import { FakeMal } from './fake-mal';
import { FakeSites, crunchyrollWatchHtml, play, seek } from './fake-sites';
import { sleep, startExtension, waitFor, type ExtensionHarness } from './harness';
import { ANILIST_A, BOCCHI, DUNGEON_MESHI, FRIEREN, MAL_A, anilistAccount, anilistMedia, crunchyrollEpisode, expectCleanRun, malAccount, malAnime, seedMapping, seedSettings, signIn } from './seed';
import { CREDITS_START, FRIEREN_E3, FRIEREN_S1, FRIEREN_S2, launch, nowPlayingText, openPanel, waitForEntry } from './scenario';

const en = (key: MessageKey, params?: MessageParams): string => tl('en', key, params);
const sel = (focus: string): string => `[data-focus="${focus}"]`;

/** Progression AniList de la fiche en cache de l'onglet (storage.session `pageMedia:<onglet>`), null si aucune fiche */
async function cachedProgress(h: ExtensionHarness): Promise<number | null> {
  const items = await (await h.bridge()).evaluate(() => chrome.storage.session.get(null));
  const entry = Object.entries(items).find(([key]) => key.startsWith('pageMedia:'))?.[1] as { view: { lists: { service: string; progress?: number }[] } } | undefined;
  return entry?.view.lists.find((list) => list.service === 'anilist')?.progress ?? null;
}

/** Opérations reçues par AniList depuis le rang `from`, une fois le trafic calmé (aucune requête pendant `quietMs`) */
async function settledOperations(anilist: FakeAniList, from: number, quietMs = 1500): Promise<Record<string, number>> {
  let seen = -1;
  while (seen !== anilist.requests.length) {
    seen = anilist.requests.length;
    await sleep(quietMs);
  }
  const counts: Record<string, number> = {};
  for (const operation of anilist.operations(from)) counts[operation] = (counts[operation] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

describe('Synchro et contrôles', () => {
  it('« +1 » avec MyAnimeList en panne : « échec sur MyAnimeList », puis « Réessayer » rattrape MAL sans réécrire AniList', async (context) => {
    const anilist = new FakeAniList({ media: [anilistMedia(FRIEREN)], accounts: [anilistAccount(ANILIST_A, { [FRIEREN.mediaId]: { status: 'CURRENT', progress: 3 } })] });
    const mal = new FakeMal({ anime: [malAnime(FRIEREN)], accounts: [malAccount({ [FRIEREN.malId]: { status: 'watching', num_episodes_watched: 3 } })] });
    const h = await startExtension(context, { routes: [anilist.handler, mal.handler] });
    await seedSettings(h);
    await signIn(h, { anilist: ANILIST_A, mal: true });

    // Écritures MAL en erreur 500 (lectures normales)
    mal.failure = { status: 500, methods: ['PATCH'] };
    const popup = await h.openPage('src/popup/popup.html', { width: 400, height: 580 });
    const plus = sel(`plus-${FRIEREN.mediaId}:${FRIEREN.malId}`);
    await popup.locator(plus).click();
    await popup.waitForSelector(sel('watching-retry'));
    const notice = await popup.$eval('[data-watching-notice]', (el) => el.textContent ?? '');
    expect(notice).toContain(en('inline.partial', { text: en('inline.watched', { progress: 4 }), services: 'MyAnimeList' }));
    expect(await popup.$eval(sel('watching-retry'), (el) => el.getAttribute('aria-label'))).toBe(en('inline.retryOn', { services: 'MyAnimeList' }));
    expect(anilist.entry(ANILIST_A.token, FRIEREN.mediaId)).toMatchObject({ progress: 4 });
    expect(mal.entry(MAL_A.token, FRIEREN.malId)).toMatchObject({ num_episodes_watched: 3 });

    // MAL rétabli : « Réessayer » écrit la progression absolue sur MAL seul
    mal.failure = null;
    await popup.locator(sel('watching-retry')).click();
    await popup.waitForSelector(sel('watching-retry'), { hidden: true });
    await waitFor('MAL rattrapé', () => mal.entry(MAL_A.token, FRIEREN.malId)?.num_episodes_watched === 4);
    expect(mal.writes().map((w) => w.body)).toEqual([{ status: 'watching', num_watched_episodes: '4', is_rewatching: 'false' }]);
    expect(anilist.mutations().map((m) => m.variables)).toEqual([{ mediaId: FRIEREN.mediaId, progress: 4, status: 'CURRENT' }]);
    expect(anilist.entry(ANILIST_A.token, FRIEREN.mediaId)).toMatchObject({ progress: 4 });
    expectCleanRun(h, anilist, mal);
  });

  it('deux « +1 » simultanés depuis deux pages : +2 au total sur AniList et MAL, écritures sérialisées', async (context) => {
    const anilist = new FakeAniList({ media: [anilistMedia(DUNGEON_MESHI)], accounts: [anilistAccount(ANILIST_A, { [DUNGEON_MESHI.mediaId]: { status: 'CURRENT', progress: 7 } })] });
    const mal = new FakeMal({ anime: [malAnime(DUNGEON_MESHI)], accounts: [malAccount({ [DUNGEON_MESHI.malId]: { status: 'watching', num_episodes_watched: 7 } })] });
    const h = await startExtension(context, { routes: [anilist.handler, mal.handler] });
    await seedSettings(h);
    await signIn(h, { anilist: ANILIST_A, mal: true });

    // Latence : sans verrou, les deux lectures se feraient avant la première écriture (7 + 1 deux fois = 8)
    anilist.latencyMs = 150;
    mal.latencyMs = 150;
    const first = await h.bridge();
    const second = await h.openPage('manifest.json');
    const payload = { mediaId: DUNGEON_MESHI.mediaId, malId: DUNGEON_MESHI.malId, delta: 1 } as const;
    const outcomes = await Promise.all([h.send('ADJUST_PROGRESS', payload, first), h.send('ADJUST_PROGRESS', payload, second)]);

    const progresses = outcomes.map((o) => (o.status === 'synced' ? o.results.map((r) => (r.outcome.status === 'updated' ? r.outcome.progress : null)) : null));
    expect(progresses.sort()).toEqual([
      [8, 8],
      [9, 9],
    ]);
    expect(anilist.entry(ANILIST_A.token, DUNGEON_MESHI.mediaId)).toMatchObject({ progress: 9 });
    expect(mal.entry(MAL_A.token, DUNGEON_MESHI.malId)).toMatchObject({ num_episodes_watched: 9 });
    // Lecture, écriture, lecture, écriture : le second +1 relit la progression écrite par le premier
    const entryOps = anilist.requests.filter((r) => r.operation === 'MediaEntry' || r.operation === 'SaveProgress').map((r) => r.operation);
    expect(entryOps).toEqual(['MediaEntry', 'SaveProgress', 'MediaEntry', 'SaveProgress']);
    expect(mal.writes().map((w) => w.body?.num_watched_episodes)).toEqual(['8', '9']);
    expectCleanRun(h, anilist, mal);
  });

  it('revisionnage à 11/12 puis « +1 » : Terminé avec un revisionnage de plus, MAL n’est plus « Re-watching »', async (context) => {
    const anilist = new FakeAniList({ media: [anilistMedia(BOCCHI)], accounts: [anilistAccount(ANILIST_A, { [BOCCHI.mediaId]: { status: 'REPEATING', progress: 11, repeat: 1, score: 9 } })] });
    const mal = new FakeMal({
      anime: [malAnime(BOCCHI)],
      accounts: [malAccount({ [BOCCHI.malId]: { status: 'completed', num_episodes_watched: 11, is_rewatching: true, num_times_rewatched: 1, score: 9 } })],
    });
    const h = await startExtension(context, { routes: [anilist.handler, mal.handler] });
    await seedSettings(h);
    await signIn(h, { anilist: ANILIST_A, mal: true });

    const outcome = await h.send('ADJUST_PROGRESS', { mediaId: BOCCHI.mediaId, malId: BOCCHI.malId, delta: 1 });
    expect(outcome).toMatchObject({
      status: 'synced',
      results: [
        { service: 'anilist', outcome: { status: 'updated', progress: 12, completed: true } },
        { service: 'mal', outcome: { status: 'updated', progress: 12, completed: true } },
      ],
    });
    expect(anilist.mutations().map((m) => m.variables)).toEqual([{ mediaId: BOCCHI.mediaId, progress: 12, status: 'COMPLETED', repeat: 2 }]);
    expect(anilist.entry(ANILIST_A.token, BOCCHI.mediaId)).toMatchObject({ status: 'COMPLETED', progress: 12, repeat: 2 });
    expect(mal.writes().map((w) => w.body)).toEqual([{ status: 'completed', num_watched_episodes: '12', is_rewatching: 'false', num_times_rewatched: '2' }]);
    expect(mal.entry(MAL_A.token, BOCCHI.malId)).toMatchObject({ status: 'completed', num_episodes_watched: 12, is_rewatching: false, num_times_rewatched: 2 });
    expectCleanRun(h, anilist, mal);
  });

  it('dernier épisode d’une série déjà notée : aucune demande de note ni carte « À noter » (une série non notée, si)', async (context) => {
    const anilist = new FakeAniList({
      media: [anilistMedia(BOCCHI), anilistMedia(FRIEREN), anilistMedia(DUNGEON_MESHI)],
      accounts: [
        anilistAccount(ANILIST_A, {
          [BOCCHI.mediaId]: { status: 'CURRENT', progress: 11, score: 8.5 },
          [FRIEREN.mediaId]: { status: 'CURRENT', progress: 27 },
          [DUNGEON_MESHI.mediaId]: { status: 'CURRENT', progress: 10, score: 7 },
        }),
      ],
    });
    const mal = new FakeMal({
      anime: [malAnime(BOCCHI), malAnime(FRIEREN), malAnime(DUNGEON_MESHI)],
      accounts: [
        malAccount({
          [BOCCHI.malId]: { status: 'watching', num_episodes_watched: 11, score: 8 },
          [FRIEREN.malId]: { status: 'watching', num_episodes_watched: 27 },
          [DUNGEON_MESHI.malId]: { status: 'watching', num_episodes_watched: 10, score: 7 },
        }),
      ],
    });
    const h = await startExtension(context, { routes: [anilist.handler, mal.handler] });
    await seedSettings(h);
    await signIn(h, { anilist: ANILIST_A, mal: true });
    await seedMapping(h, BOCCHI, FRIEREN);

    // Série notée : passée en Terminé sur les deux services, sans demande de note
    const rated = await h.sendFromContent('EPISODE_COMPLETED', { episode: crunchyrollEpisode(BOCCHI, 12), services: null });
    expect(rated).toMatchObject({ status: 'synced', results: [{ outcome: { status: 'updated', progress: 12, completed: true } }, { outcome: { status: 'updated', completed: true } }] });
    expect(rated.status === 'synced' ? rated.prompts : 'pas synchronisé').toBeUndefined();
    expect((await h.storage())[PENDING_RATINGS_KEY]).toBeUndefined();

    // Témoin : une série non notée demande bien sa note (bulle de fin d'épisode)
    const unrated = await h.sendFromContent('EPISODE_COMPLETED', { episode: crunchyrollEpisode(FRIEREN, 28), services: null });
    expect(unrated).toMatchObject({ status: 'synced', prompts: { rate: { mediaId: FRIEREN.mediaId, malId: FRIEREN.malId } } });

    // « Terminé » depuis le popup sur une autre série notée : passée en Terminé, sans carte « À noter » non plus
    const completed = await h.send('SET_LIST_STATUS', { mediaId: DUNGEON_MESHI.mediaId, malId: DUNGEON_MESHI.malId, status: 'COMPLETED', coverUrl: null });
    expect(completed).toMatchObject({ status: 'synced', results: [{ outcome: { status: 'updated', progress: 24, completed: true } }, { outcome: { status: 'updated', progress: 24, completed: true } }] });
    expect(completed.status === 'synced' ? completed.prompts : 'pas synchronisé').toBeUndefined();
    expect((await h.storage())[PENDING_RATINGS_KEY]).toBeUndefined();
    expect(anilist.mutations().filter((m) => m.operation === 'SaveScore')).toEqual([]);
    expectCleanRun(h, anilist, mal);
  });
});

// Nombre de requêtes AniList par action (ligne de base chiffrée, resserrée à chaque économie de requêtes) : une requête
// de plus est un défaut de performance silencieux (limite de 90 par minute, latence du toast).
describe('Requêtes AniList par action', () => {
  it('épisode terminé, aucune vue ouverte : 1re synchro (correspondance apprise) puis 2e (correspondance en cache)', async (context) => {
    const run = await launch(context, [FRIEREN_S1, FRIEREN_S2]);
    let from = run.anilist.requests.length;
    await run.h.sendFromContent('EPISODE_COMPLETED', { episode: crunchyrollEpisode(FRIEREN, 3), services: null });
    // Recherche de la série, relations (AnimeByIds), fiche du catalogue (AnimeByIds : PERF-09 la servira depuis la recherche), entrée de la liste, écriture
    expect(await settledOperations(run.anilist, from)).toEqual({ AnimeByIds: 2, MediaEntry: 1, SaveProgress: 1, SearchAnime: 1 });

    from = run.anilist.requests.length;
    await run.h.sendFromContent('EPISODE_COMPLETED', { episode: crunchyrollEpisode(FRIEREN, 4), services: null });
    // Fiche du catalogue déjà lue par la synchro précédente (cache de 5 min) : plus que la lecture de l'entrée et l'écriture
    expect(await settledOperations(run.anilist, from)).toEqual({ MediaEntry: 1, SaveProgress: 1 });
    expect(run.anilist.mutations().map((m) => m.variables)).toEqual([
      { mediaId: FRIEREN.mediaId, progress: 3, status: 'CURRENT' },
      { mediaId: FRIEREN.mediaId, progress: 4, status: 'CURRENT' },
    ]);
  });

  it('épisode terminé, panneau ouvert sur l’onglet : fiche recalculée (une lecture de liste en plus) et progression à jour dans le cache', async (context) => {
    const sites = new FakeSites().page(FRIEREN_E3.url, crunchyrollWatchHtml(FRIEREN_E3, { lang: 'en' })).creditsStart(FRIEREN_E3.episodeId, CREDITS_START);
    const run = await launch(context, [FRIEREN_S1, FRIEREN_S2], sites);
    const panel = await openPanel(run.h);
    await settledOperations(run.anilist, 0);
    const tab = await run.h.openTab(FRIEREN_E3.url);
    await waitForEntry(panel, FRIEREN_S1.anilist.title, 'Ep. 3');
    await settledOperations(run.anilist, 0);
    const from = run.anilist.requests.length;
    await play(tab);
    await seek(tab, CREDITS_START + 1);
    await waitFor('progression écrite', () => run.anilist.mutations().length === 1);
    // Panneau ouvert : la fiche est recalculée (MediaEntry en plus) et affiche l'épisode synchronisé
    expect(await settledOperations(run.anilist, from)).toEqual({ AnimeByIds: 1, MediaEntry: 2, SaveProgress: 1 });
    expect(await cachedProgress(run.h)).toBe(3);
    expectCleanRun(run.h, run.anilist, run.mal);
  });

  it('épisode terminé, panneau fermé depuis (fiche de l’onglet encore en cache) : ni recalculée ni gardée (PERF-07)', async (context) => {
    const sites = new FakeSites().page(FRIEREN_E3.url, crunchyrollWatchHtml(FRIEREN_E3, { lang: 'en' })).creditsStart(FRIEREN_E3.episodeId, CREDITS_START);
    const run = await launch(context, [FRIEREN_S1, FRIEREN_S2], sites);
    const panel = await openPanel(run.h);
    await settledOperations(run.anilist, 0);
    const tab = await run.h.openTab(FRIEREN_E3.url);
    await waitForEntry(panel, FRIEREN_S1.anilist.title, 'Ep. 3');
    await settledOperations(run.anilist, 0);
    await panel.close();
    await tab.bringToFront();
    const from = run.anilist.requests.length;
    await play(tab);
    await seek(tab, CREDITS_START + 1);
    await waitFor('progression écrite', () => run.anilist.mutations().length === 1);
    // Aucun écran n'affiche l'onglet : la fiche n'est pas recalculée (pas de seconde lecture de liste), la fiche devenue fausse est oubliée
    expect(await settledOperations(run.anilist, from)).toEqual({ AnimeByIds: 1, MediaEntry: 1, SaveProgress: 1 });
    expect(await cachedProgress(run.h)).toBeNull();
    expectCleanRun(run.h, run.anilist, run.mal);
  });

  it('page de série affichée dans le panneau : requêtes de la fiche (recherche, relations, fiche, listes)', async (context) => {
    const url = 'https://www.crunchyroll.com/series/GG5H5XQX4/frieren';
    const sites = new FakeSites().page(url, '<!doctype html><html lang="en"><head><title>Frieren</title></head><body><h1 data-t="series-hero-title">Frieren: Beyond Journey’s End</h1></body></html>');
    const run = await launch(context, [FRIEREN_S1, FRIEREN_S2], sites);
    const panel = await openPanel(run.h);
    await settledOperations(run.anilist, 0);
    const from = run.anilist.requests.length;
    await run.h.openTab(url);
    await waitFor('fiche de la série', async () => (await nowPlayingText(panel)).includes(FRIEREN_S1.anilist.title));
    // La saison 1 est lue deux fois (MediaEntry : statut des saisons, puis listes de la fiche) : PERF-11
    expect(await settledOperations(run.anilist, from)).toEqual({ AnimeByIds: 1, MediaEntry: 2, PageMedia: 1, PanelMedia: 1, SearchAnime: 1 });
    expectCleanRun(run.h, run.anilist, run.mal);
  });
});
