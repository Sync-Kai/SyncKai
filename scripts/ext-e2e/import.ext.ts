// Import d'un historique et sauvegarde, sur l'extension construite (docs/audit/MANUAL-TESTS.md §6) : la vraie page
// d'import (src/import-cr), ouverte depuis Réglages › Mes données, pilote le vrai script de contenu de l'onglet de la
// plateforme, qui interroge les fausses API d'historique (fake-history.ts) ; analyse et application par le service
// worker sur les faux AniList / MyAnimeList. Sauvegarde : export depuis le popup (vrai téléchargement, CDP
// Browser.setDownloadBehavior), puis import du fichier dans un profil neuf.
// Lancement : npm run test:ext
import fs from 'node:fs';
import path from 'node:path';
import type { Page, Protocol } from 'puppeteer';
import { describe, expect, it, type TestContext } from 'vitest';
import { registerCatalogs, tl, tpl, type MessageKey, type MessageParams } from '../../src/i18n';
import { CR_IMPORT_KEYS, isCrImportJob, type CrImportJob } from '../../src/shared/cr-import';
import { SETTINGS_STORAGE_KEY } from '../../src/shared/settings';
import { STORAGE_KEYS } from '../../src/shared/storage-keys';
import { catalogOf } from '../../src/test/catalogs';
import { FakeAniList, type AniListMediaSeed } from './fake-anilist';
import { FakeAdnHistory, FakeCrunchyrollHistory, type AdnVideoSeed, type CrHistoryItemSeed } from './fake-history';
import { FakeMal, type MalAnimeSeed } from './fake-mal';
import { FakeSites } from './fake-sites';
import { EXTENSION_ORIGIN, artifactsDir, startExtension, waitFor, type ExtensionHarness, type RequestHandler } from './harness';
import { ANILIST_A, FRIEREN, MAL_A, anilistAccount, anilistMedia, expectCleanRun, malAccount, malAnime, seedMapping, seedSettings, signIn } from './seed';

registerCatalogs({ fr: catalogOf('fr') });

const en = (key: MessageKey, params?: MessageParams): string => tl('en', key, params);
const sel = (focus: string): string => `[data-focus="${focus}"]`;

const IMPORT_PAGE = `${EXTENSION_ORIGIN}/src/import-cr/import-cr.html`;

// ─── Séries des scénarios ─────────────────────────────────────────────────

const ONE_PIECE: { anilist: AniListMediaSeed; mal: MalAnimeSeed } = {
  anilist: { id: 21, idMal: 21, title: 'ONE PIECE', episodes: null, status: 'RELEASING', externalLinks: ['https://www.crunchyroll.com/series/GRMG8ZQZR'] },
  mal: { id: 21, title: 'One Piece', numEpisodes: 0 },
};

const TOUGEN_ANKI: { anilist: AniListMediaSeed; mal: MalAnimeSeed } = {
  anilist: { id: 178680, idMal: 59135, title: 'TOUGEN ANKI', episodes: 24, externalLinks: ['https://animationdigitalnetwork.com/video/1311-tougen-anki'] },
  mal: { id: 59135, title: 'Tougen Anki', numEpisodes: 24 },
};

const CONAN: { anilist: AniListMediaSeed; mal: MalAnimeSeed } = {
  anilist: { id: 235, idMal: 235, title: 'Detective Conan', episodes: null, status: 'RELEASING', externalLinks: ['https://animationdigitalnetwork.com/video/400-detective-conan'] },
  mal: { id: 235, title: 'Meitantei Conan', numEpisodes: 0 },
};

/** Historique Crunchyroll : Frieren E1–E6 vus, E7 seulement commencé ; One Piece E1179–E1180 (saison 24, numérotation absolue) */
function crunchyrollHistory(): CrHistoryItemSeed[] {
  const frieren = (n: number, watched: boolean): CrHistoryItemSeed => ({
    episodeId: `GFRIEREN${n}`,
    seriesId: FRIEREN.seriesId,
    seriesTitle: FRIEREN.title,
    seriesSlug: 'frieren-beyond-journeys-end',
    seasonId: 'GFRIERENS1',
    seasonNumber: 1,
    seasonTitle: FRIEREN.title,
    episodeNumber: n,
    fullyWatched: watched,
    playhead: watched ? 1_400 : 9,
    durationMs: 1_440_000,
    playedAt: `2026-10-0${Math.min(9, n)}T20:00:00Z`,
  });
  const onePiece = (n: number): CrHistoryItemSeed => ({
    episodeId: `GONEPIECE${n}`,
    seriesId: 'GRMG8ZQZR',
    seriesTitle: 'One Piece',
    seriesSlug: 'one-piece',
    seasonId: 'GONEPIECES24',
    seasonNumber: 24,
    seasonTitle: 'Elbaph',
    episodeNumber: n,
    fullyWatched: true,
    playhead: 1_420,
    durationMs: 1_440_000,
    playedAt: `2026-10-1${n - 1179}T20:00:00Z`,
  });
  return [onePiece(1180), onePiece(1179), frieren(7, false), ...[6, 5, 4, 3, 2, 1].map((n) => frieren(n, true))];
}

/** Saison 24 de One Piece sur Crunchyroll : E1156 à E1180 (E1180 = 25e épisode de la saison) */
const ONE_PIECE_S24 = Array.from({ length: 25 }, (_, i) => 1156 + i);

// ─── Mise en place ────────────────────────────────────────────────────────

interface Scenario {
  h: ExtensionHarness;
  anilist: FakeAniList;
  mal: FakeMal;
}

async function launch(context: TestContext, media: { anilist: AniListMediaSeed; mal: MalAnimeSeed }[], entries: Record<number, number>, pageRoutes: RequestHandler[]): Promise<Scenario> {
  const anilist = new FakeAniList({
    media: media.map((m) => m.anilist),
    accounts: [anilistAccount(ANILIST_A, Object.fromEntries(Object.entries(entries).map(([id, progress]) => [id, { status: 'CURRENT', progress }])))],
  });
  const malIds = new Map(media.map((m) => [m.anilist.id, m.mal.id]));
  const mal = new FakeMal({
    anime: media.map((m) => m.mal),
    accounts: [malAccount(Object.fromEntries(Object.entries(entries).map(([id, progress]) => [malIds.get(Number(id)) ?? 0, { status: 'watching', num_episodes_watched: progress }])))],
  });
  const h = await startExtension(context, { routes: [anilist.handler, mal.handler], pageRoutes });
  await seedSettings(h);
  await signIn(h, { anilist: ANILIST_A, mal: true });
  return { h, anilist, mal };
}

/** Popup › Réglages › Mes données, puis le bouton `focus` (ex. « cr-import ») : la page d'import s'ouvre dans un onglet */
async function openFromMyData(h: ExtensionHarness, focus: string, prefix: string): Promise<Page> {
  const popup = await h.openPage('src/popup/popup.html', { width: 400, height: 580 });
  await popup.locator(sel('gear')).click();
  await popup.locator(sel('settings-cat-data')).click();
  await popup.locator(sel(focus)).click();
  const page = await h.waitForPage(prefix);
  await popup.close();
  return page;
}

async function pageText(page: Page): Promise<string> {
  return page.evaluate(() => (document.getElementById('app') as HTMLElement | null)?.innerText ?? '');
}

async function importJob(h: ExtensionHarness): Promise<CrImportJob | null> {
  const value: unknown = (await h.storage())[CR_IMPORT_KEYS.job];
  return isCrImportJob(value) ? value : null;
}

/** « Read my history », dès que la page d'import a trouvé l'onglet de la plateforme (« {platform} tab ready ») */
async function readHistory(page: Page, platform: string): Promise<void> {
  await page.waitForSelector(sel('cr-read'), { timeout: 10_000 });
  expect(await pageText(page)).toContain(en('crImport.connect.found', { platform }).replace(' ready', ''));
  await page.locator(sel('cr-read')).click();
}

// ─── Scénarios ────────────────────────────────────────────────────────────

describe('Import de l’historique Crunchyroll', () => {
  it('lecture, coupure réseau pendant « Checking episode numbering » puis reprise, analyse, aperçu, application : écritures reçues', async (context) => {
    const cr = new FakeCrunchyrollHistory({ items: crunchyrollHistory(), seasons: { GONEPIECES24: ONE_PIECE_S24 } });
    const run = await launch(context, [{ anilist: anilistMedia(FRIEREN), mal: malAnime(FRIEREN) }, ONE_PIECE], { [FRIEREN.mediaId]: 3, [ONE_PIECE.anilist.id]: 1170 }, [cr.handler]);
    await run.h.openTab('https://www.crunchyroll.com/fr/');
    const page = await openFromMyData(run.h, 'cr-import', `${IMPORT_PAGE}?platform=crunchyroll`);

    // Wi-Fi coupé dès la première lecture d'une saison (vérification de la numérotation de One Piece S24), AniList compris
    cr.cutNetworkAt = '/content/v2/cms/seasons/';
    await readHistory(page, 'Crunchyroll');
    const lookups = en('crImport.read.lookups', { done: 0, total: 1 });
    await waitFor('« Checking episode numbering » affiché, coupure en cours', async () => cr.offline && (await pageText(page)).includes(lookups));
    run.anilist.failure = { network: true };
    // Deux tentatives perdues (la première et la nouvelle tentative 2 s plus tard), puis le réseau revient
    await waitFor('deux lectures de saison perdues', () => cr.calls('/content/v2/cms/seasons/').filter((r) => r.status === 0).length === 2, 10_000);
    cr.offline = false;
    run.anilist.failure = null;

    // La lecture reprend seule (tentative suivante 5 s plus tard), puis analyse en tâche de fond et aperçu
    await page.waitForSelector(sel('cr-apply'), { timeout: 30_000 });
    expect(cr.calls('/content/v2/cms/seasons/').map((r) => r.status)).toEqual([0, 0, 200]);
    expect(cr.calls('/content/v2/e2e-cr-account/watch-history').map((r) => r.status)).toEqual([200]);
    const preview = await pageText(page);
    expect(preview).toContain(tpl('en', 'crImport.preview.seasons', 2));
    expect(preview).toContain(tpl('en', 'crImport.preview.toUpdate', 2));
    // Frieren : E7 seulement commencé, jamais compté (6) ; One Piece : E1180 en numéro absolu (pas 25)
    expect(preview).toContain('3 → 6');
    expect(preview).toContain('1170 → 1180');
    expect(preview).toContain(en('common.labelValue', { label: 'Crunchyroll', value: '' }).trim());
    expect(run.anilist.mutations()).toEqual([]);

    await page.locator(sel('cr-apply')).click();
    await waitFor('import terminé', async () => (await pageText(page)).includes(en('crImport.apply.done')), 30_000);
    expect(run.anilist.mutations().map((m) => m.variables).sort((a, b) => Number(a.mediaId) - Number(b.mediaId))).toEqual([
      { mediaId: ONE_PIECE.anilist.id, progress: 1180, status: 'CURRENT' },
      { mediaId: FRIEREN.mediaId, progress: 6, status: 'CURRENT' },
    ]);
    expect(run.mal.entry(MAL_A.token, FRIEREN.malId)).toMatchObject({ num_episodes_watched: 6 });
    expect(run.mal.entry(MAL_A.token, ONE_PIECE.mal.id)).toMatchObject({ num_episodes_watched: 1180 });
    // Correspondances sûres apprises (la synchro en direct s'en sert)
    const mappings = (await run.h.storage())[STORAGE_KEYS.mediaMappings] as Record<string, { mediaId: number }>;
    expect(Object.values(mappings).map((m) => m.mediaId).sort((a, b) => a - b)).toEqual([ONE_PIECE.anilist.id, FRIEREN.mediaId]);
    expect(cr.unknown).toEqual([]);
    expectCleanRun(run.h, run.anilist, run.mal);
  }, 90_000);

  it('navigateur relancé pendant l’application : l’import reprend seul et se termine, sans écriture en double', async (context) => {
    const cr = new FakeCrunchyrollHistory({ items: crunchyrollHistory(), seasons: { GONEPIECES24: ONE_PIECE_S24 } });
    const run = await launch(context, [{ anilist: anilistMedia(FRIEREN), mal: malAnime(FRIEREN) }, ONE_PIECE], { [FRIEREN.mediaId]: 3, [ONE_PIECE.anilist.id]: 1170 }, [cr.handler]);
    await run.h.openTab('https://www.crunchyroll.com/fr/');
    const page = await openFromMyData(run.h, 'cr-import', `${IMPORT_PAGE}?platform=crunchyroll`);
    await readHistory(page, 'Crunchyroll');
    await page.waitForSelector(sel('cr-apply'), { timeout: 30_000 });

    // Écritures lentes : le navigateur est fermé juste après la première écriture AniList
    run.anilist.latencyMs = 1_000;
    run.mal.latencyMs = 1_000;
    await page.locator(sel('cr-apply')).click();
    await waitFor('première écriture', () => run.anilist.mutations().length === 1, 20_000);
    expect(await importJob(run.h)).toMatchObject({ kind: 'cr-apply', status: 'running' });
    await run.h.restart();
    run.anilist.latencyMs = 0;
    run.mal.latencyMs = 0;

    // Au redémarrage (runtime.onStartup ou alarme de reprise), la tâche reprend sans aucune page ouverte
    const job = await waitFor('import repris et terminé', async () => {
      const current = await importJob(run.h);
      return current?.kind === 'cr-apply' && current.status !== 'running' ? current : null;
    }, 45_000);
    expect(job).toMatchObject({ status: 'done', total: 2 });
    expect(run.anilist.entry(ANILIST_A.token, FRIEREN.mediaId)).toMatchObject({ progress: 6 });
    expect(run.anilist.entry(ANILIST_A.token, ONE_PIECE.anilist.id)).toMatchObject({ progress: 1180 });
    expect(run.mal.entry(MAL_A.token, FRIEREN.malId)).toMatchObject({ num_episodes_watched: 6 });
    expect(run.mal.entry(MAL_A.token, ONE_PIECE.mal.id)).toMatchObject({ num_episodes_watched: 1180 });
    // Une seule écriture par série et par service, même pour l'élément interrompu
    const perMedia = (ids: unknown[]): Record<string, number> => Object.fromEntries([...new Set(ids)].map((id) => [String(id), ids.filter((x) => x === id).length]));
    expect(perMedia(run.anilist.mutations().map((m) => m.variables.mediaId))).toEqual({ [FRIEREN.mediaId]: 1, [ONE_PIECE.anilist.id]: 1 });
    expect(perMedia(run.mal.writes().map((w) => w.path))).toEqual({ [`/anime/${FRIEREN.malId}/my_list_status`]: 1, [`/anime/${ONE_PIECE.mal.id}/my_list_status`]: 1 });
    expectCleanRun(run.h, run.anilist, run.mal);
  }, 120_000);
});

/** Historique ADN : Tougen Anki E1–E12 vus et E13 commencé (8 s), Détective Conan E1–E137 vus ; 150 épisodes, 2 pages */
function adnHistory(): AdnVideoSeed[] {
  const tougen = (n: number, watched: boolean): AdnVideoSeed => ({
    id: 30_000 + n,
    showId: 1311,
    showTitle: 'Tougen Anki',
    showSlug: 'tougen-anki',
    season: '1',
    shortNumber: String(n),
    duration: 1_420,
    stoptime: watched ? 1_400 : 8,
    isFullyWatched: watched,
    watchDate: `2026-10-${String(n).padStart(2, '0')}T21:00:00Z`,
  });
  const conan = (n: number): AdnVideoSeed => ({
    id: 40_000 + n,
    showId: 400,
    showTitle: 'Détective Conan',
    showSlug: 'detective-conan',
    season: '1',
    shortNumber: String(n),
    duration: 1_440,
    stoptime: 1_440,
    isFullyWatched: true,
    watchDate: '2026-09-01T21:00:00Z',
  });
  return [tougen(13, false), ...Array.from({ length: 12 }, (_, i) => tougen(12 - i, true)), ...Array.from({ length: 137 }, (_, i) => conan(137 - i))];
}

const ADN_HOME = 'https://animationdigitalnetwork.com/';

/** Page d'accueil d'ADN connectée : le site garde son jeton (JWT), son profil et sa distribution dans le localStorage */
function adnHomeHtml(token: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>ADN</title>
<script>
  localStorage.setItem('token', JSON.stringify(${JSON.stringify(token)}));
  localStorage.setItem('profile', JSON.stringify({ id: 42 }));
  localStorage.setItem('distribution', JSON.stringify('fr'));
</script></head><body><h1>ADN</h1></body></html>`;
}

describe('Import de l’historique ADN', () => {
  it('déconnecté (401) : message de connexion, aucune analyse ; connecté : aperçu « ADN: … », épisode commencé jamais compté ; confidentialité du jeton', async (context) => {
    const adn = new FakeAdnHistory(adnHistory());
    const sites = new FakeSites().page(ADN_HOME, adnHomeHtml(adn.token));
    const run = await launch(context, [TOUGEN_ANKI, CONAN], { [TOUGEN_ANKI.anilist.id]: 4, [CONAN.anilist.id]: 100 }, [adn.handler, sites.handler]);
    const tab = await run.h.openTab(ADN_HOME);
    // Cookie de session du site : il ne doit jamais partir avec la requête de l'historique (credentials: 'omit')
    await tab.setCookie({ name: 'adn_session', value: 'e2e-adn-cookie', domain: '.animationdigitalnetwork.com', path: '/', secure: true });
    const page = await openFromMyData(run.h, 'adn-import', `${IMPORT_PAGE}?platform=adn`);

    // Session ADN expirée : message de connexion, rien d'analysé
    adn.loggedOut = true;
    await readHistory(page, 'ADN');
    await waitFor('message de connexion ADN', async () => (await pageText(page)).includes(en('crImport.read.error.adnLoggedOut')));
    expect(await importJob(run.h)).toBeNull();
    expect(run.anilist.requests.filter((r) => r.operation !== 'Viewer' && r.operation !== 'Watching' && r.operation !== 'CatalogByMal')).toEqual([]);

    // Connecté de nouveau (page rechargée), nouvelle lecture
    adn.loggedOut = false;
    await tab.reload({ waitUntil: 'load' });
    await readHistory(page, 'ADN');
    await page.waitForSelector(sel('cr-apply'), { timeout: 30_000 });
    const preview = await pageText(page);
    expect(preview).toContain(tpl('en', 'crImport.preview.toUpdate', 2));
    expect(preview).toContain(en('common.labelValue', { label: 'ADN', value: 'Tougen Anki · S1' }));
    expect(preview).toContain(en('common.labelValue', { label: 'ADN', value: 'Détective Conan · S1' }));
    // E13 vu 8 s seulement : la progression monte à 12, jamais 13
    expect(preview).toContain('4 → 12');
    expect(preview).not.toMatch(/→ 13(?!\d)/);
    expect(preview).toContain('100 → 137');

    // Une requête d'historique par tranche de 100 épisodes (150 : deux), exactement les en-têtes du site
    const pages = (calls: { url: string }[]): string[] => calls.map((c) => new URL(c.url).search);
    expect(pages(adn.historyCalls().slice(-2))).toEqual(['?offset=0&limit=100&onlyNext=false', '?offset=100&limit=100&onlyNext=false']);
    expect(adn.historyCalls()).toHaveLength(3);
    for (const call of adn.historyCalls()) {
      expect(call.headers).toMatchObject({
        authorization: `Bearer ${adn.token}`,
        'x-profile-id': '42',
        'x-target-distribution': 'fr',
        'accept-language': 'fr',
        'x-i18n-platform': '1',
        'x-source': 'Web',
      });
    }
    // Cookies (en-têtes vus par l'interception, cookies compris) : envoyés avec la page du site rechargée (témoin),
    // jamais avec l'historique ni son pré-vol CORS
    expect(sites.requests.at(-1)?.headers.cookie).toBe('adn_session=e2e-adn-cookie');
    expect(adn.requests.map((r) => r.headers.cookie)).toEqual(adn.requests.map(() => undefined));

    // Le jeton ne quitte jamais l'onglet ADN : ni stockage de l'extension, ni console de la page d'import ou de l'onglet
    const bridge = await run.h.bridge();
    const stored = JSON.stringify([await run.h.storage(), await bridge.evaluate(() => chrome.storage.session.get(null))]);
    expect(stored).not.toContain(adn.token);
    expect(run.h.consoleMessages.filter((m) => m.includes(adn.token) || m.includes('e2e-adn-signature'))).toEqual([]);
    expect(run.anilist.mutations()).toEqual([]);
    expectCleanRun(run.h, run.anilist, run.mal);
  }, 90_000);
});

describe('Sauvegarde', () => {
  it('export depuis le popup (fichier au nom dans la langue de l’interface), import dans un profil neuf : réglages et correspondances gardés', async (context) => {
    const anilist = new FakeAniList({ media: [anilistMedia(FRIEREN)], accounts: [anilistAccount(ANILIST_A)] });
    const mal = new FakeMal({ anime: [malAnime(FRIEREN)], accounts: [malAccount()] });
    const h = await startExtension(context, { routes: [anilist.handler, mal.handler] });
    await seedSettings(h, { language: 'fr', completionPercentage: 90, autoSync: false });
    await signIn(h, { anilist: ANILIST_A, mal: true });
    await seedMapping(h, FRIEREN);
    const before = await h.storage();

    // Téléchargements du navigateur dans un dossier temporaire, hors du dépôt
    const dir = fs.mkdtempSync(path.join(artifactsDir(), 'downloads-'));
    context.onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
    const browserCdp = await h.browser.target().createCDPSession();
    await browserCdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir, eventsEnabled: true });
    const suggested = new Promise<string>((resolve) => browserCdp.on('Browser.downloadWillBegin', (event: Protocol.Browser.DownloadWillBeginEvent) => resolve(event.suggestedFilename)));
    const finished = new Promise<void>((resolve) =>
      browserCdp.on('Browser.downloadProgress', (event: Protocol.Browser.DownloadProgressEvent) => {
        if (event.state === 'completed') resolve();
      }),
    );

    // Popup › Réglages › Mes données › Exporter : la page Sauvegarde s'ouvre et lance l'export
    const popup = await h.openPage('src/popup/popup.html', { width: 400, height: 580 });
    await popup.locator(sel('gear')).click();
    await popup.locator(sel('settings-cat-data')).click();
    await popup.locator(sel('backup-export')).click();
    await h.waitForPage(`${EXTENSION_ORIGIN}/src/import/import.html`);
    const fileName = await suggested;
    await finished;
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(fileName).toBe(tl('fr', 'backup.fileName', { date }));
    const file = path.join(dir, fileName);
    const content = fs.readFileSync(file, 'utf8');
    // Jamais les comptes AniList / MAL
    for (const secret of [ANILIST_A.token, MAL_A.token, MAL_A.refreshToken]) expect(content).not.toContain(secret);
    await browserCdp.detach();
    expectCleanRun(h, anilist, mal);

    // Profil neuf (autre navigateur) : page Sauvegarde › choisir le fichier › réglages compris › Importer
    const fresh = await startExtension(context, { routes: [anilist.handler, mal.handler] });
    const backupPage = await fresh.openPage('src/import/import.html', { width: 600, height: 800 });
    const input = await backupPage.waitForSelector('input#sk-file');
    await input?.uploadFile(file);
    await backupPage.waitForSelector(`${sel('settings')}:not([disabled])`);
    await backupPage.locator(sel('settings')).click();
    await backupPage.locator(sel('import')).click();
    // Réglages importés : la page passe au français (langue de la sauvegarde)
    await waitFor('import terminé', async () => {
      const text = await backupPage.evaluate(() => document.body.innerText);
      return text.includes(tl('en', 'import.done')) || text.includes(tl('fr', 'import.done'));
    });
    const after = await fresh.storage();
    // Correspondances importées marquées « à revérifier » contre le catalogue à leur premier usage (shared/backup.ts)
    const imported = before[STORAGE_KEYS.mediaMappings] as Record<string, object>;
    expect(after[STORAGE_KEYS.mediaMappings]).toEqual(Object.fromEntries(Object.entries(imported).map(([key, mapping]) => [key, { ...mapping, unverified: true }])));
    expect(after[SETTINGS_STORAGE_KEY]).toMatchObject({ language: 'fr', completionPercentage: 90, autoSync: false });
    // Aucun compte importé
    expect(after[STORAGE_KEYS.anilistToken]).toBeUndefined();
    expect(after[STORAGE_KEYS.malToken]).toBeUndefined();
    expect(fresh.unexpected).toEqual([]);
    expect(fresh.pageErrors).toEqual([]);
  }, 90_000);
});
