import { afterEach, describe, expect, it, vi } from 'vitest';
import { movieShow, NETFLIX_ROWS, ONE_PIECE_E1170, onePieceShow, RANMA_S1E5, ranmaShow } from './__fixtures__/netflix-history';
import { isCrHistoryResult } from './cr-history';
import { toEpisodeInfo } from './cr-import';
import { isNetflixShowMetadata } from './netflix-metadata';
import {
  groupNetflixRows,
  isNetflixPageState,
  isNetflixTitlesPayload,
  isNetflixWatched,
  keepsShow,
  MAX_NETFLIX_HISTORY_ROWS,
  needsMetadata,
  NETFLIX_CLICK_GAP_MS,
  NETFLIX_GROWTH_TIMEOUT_MS,
  NETFLIX_MAX_STALLS,
  NETFLIX_PAGE_ROWS,
  NETFLIX_READY_TIMEOUT_MS,
  netflixPageProblem,
  netflixTabOp,
  parseNetflixRow,
  readNetflixHistory,
  reduceNetflixShow,
  splitNetflixTitle,
  type NetflixPageState,
  type NetflixTab,
} from './netflix-import';

describe('lignes de l’historique Netflix', () => {
  it('identifiant du lien /title/{id} et texte nettoyé ; ligne illisible ignorée', () => {
    expect(parseNetflixRow({ href: '/title/81301838', text: '  Ranma ½ :  Saison 1 : "Épisode 5" ' })).toEqual({ id: '81301838', text: 'Ranma ½ : Saison 1 : "Épisode 5"' });
    expect(parseNetflixRow({ href: 'https://www.netflix.com/title/81301838?trackId=1', text: 'X' })).toEqual({ id: '81301838', text: 'X' });
    expect(parseNetflixRow({ href: '/reportproblem/81301838', text: 'Signaler un problème' })).toBeNull();
    expect(parseNetflixRow({ href: '/title/81301838', text: '   ' })).toBeNull();
    expect(parseNetflixRow({ href: '/title/1234567890123', text: 'trop long' })).toBeNull();
    expect(parseNetflixRow(null)).toBeNull();
  });

  it('série, saison et épisode en français, anglais et allemand', () => {
    expect(splitNetflixTitle('Ranma ½ : Saison 1 : "Épisode 5"')).toEqual({ series: 'Ranma ½', season: 'Saison 1', episode: 'Épisode 5' });
    // Espace insécable avant les deux-points (typographie française)
    expect(splitNetflixTitle('One Piece : Elbaph Arc : « Épisode 1180 »')).toEqual({ series: 'One Piece', season: 'Elbaph Arc', episode: 'Épisode 1180' });
    expect(splitNetflixTitle('Demon Slayer: Kimetsu no Yaiba: Season 1: "Cruelty"')).toEqual({ series: 'Demon Slayer: Kimetsu no Yaiba', season: 'Season 1', episode: 'Cruelty' });
    expect(splitNetflixTitle('Ranma1/2: Staffel 1: „Folge 3“')).toEqual({ series: 'Ranma1/2', season: 'Staffel 1', episode: 'Folge 3' });
    expect(splitNetflixTitle('Mercredi : Mini-série : "Épisode 1"')).toEqual({ series: 'Mercredi', season: 'Mini-série', episode: 'Épisode 1' });
    // Deux-points dans le titre de l'épisode : seule la dernière partie entre guillemets est l'épisode
    expect(splitNetflixTitle('Re:ZERO: Season 3: "Theft: The Beginning"')).toEqual({ series: 'Re:ZERO', season: 'Season 3', episode: 'Theft: The Beginning' });
    // Série sans saison : le titre entier avant l'épisode
    expect(splitNetflixTitle('Cyberpunk Edgerunners : "Révolution"')).toEqual({ series: 'Cyberpunk Edgerunners', season: null, episode: 'Révolution' });
  });

  it('guillemets de toutes les langues de profil, ouvrants comme fermants', () => {
    const quoted: readonly (readonly [string, string])[] = [
      ['“', '”'], // anglais, espagnol d'Amérique latine, portugais du Brésil, chinois
      ['”', '”'], // suédois
      ['„', '“'], // allemand, tchèque
      ['„', '”'], // polonais, roumain
      ['«', '»'], // français, italien, espagnol, russe, ukrainien
      ['»', '«'], // allemand (variante)
      ['‹', '›'], // guillemets simples français
      ['›', '‹'],
      ['‚', '‘'], // guillemets simples allemands
      ['‘', '’'], // guillemets simples anglais
      ['「', '」'], // japonais, chinois traditionnel
      ['『', '』'],
      ['"', '"'],
    ];
    for (const [open, close] of quoted) {
      expect(splitNetflixTitle(`Ranma ½: Season 1: ${open}Episode 5${close}`)).toEqual({ series: 'Ranma ½', season: 'Season 1', episode: 'Episode 5' });
    }
    // Apostrophe typographique dans le titre de la série : pas un guillemet hors d'un début de segment
    expect(splitNetflixTitle('JoJo’s Bizarre Adventure: Season 5: “Golden Wind”')).toEqual({ series: 'JoJo’s Bizarre Adventure', season: 'Season 5', episode: 'Golden Wind' });
  });

  it('deux-points pleine chasse (chinois, japonais) avec ou sans espace', () => {
    expect(splitNetflixTitle('鬼灭之刃：第 1 季：“残酷”')).toEqual({ series: '鬼灭之刃', season: '第 1 季', episode: '残酷' });
    expect(splitNetflixTitle('ONE PIECE： シーズン1： 「第1話」')).toEqual({ series: 'ONE PIECE', season: 'シーズン1', episode: '第1話' });
    expect(splitNetflixTitle('サイバーパンク エッジランナーズ：「革命」')).toEqual({ series: 'サイバーパンク エッジランナーズ', season: null, episode: '革命' });
    // Sans guillemets : film, deux-points pleine chasse compris
    expect(splitNetflixTitle('ゴジラ-1.0：マイナスカラー')).toEqual({ series: 'ゴジラ-1.0：マイナスカラー', season: null, episode: null });
  });

  it('film : titre entier, deux-points compris', () => {
    expect(splitNetflixTitle('Le Voyage de Chihiro')).toEqual({ series: 'Le Voyage de Chihiro', season: null, episode: null });
    expect(splitNetflixTitle('Godzilla Minus One: Minus Color')).toEqual({ series: 'Godzilla Minus One: Minus Color', season: null, episode: null });
  });

  it('séries distinctes, la plus récente d’abord, 3 vidéos au plus chacune', () => {
    expect(groupNetflixRows(NETFLIX_ROWS)).toEqual([
      { title: 'Ranma ½', movieIds: [RANMA_S1E5, '81301837', '81301834'] },
      { title: 'One Piece', movieIds: ['82000024', '82000006'] },
      { title: 'Mercredi', movieIds: ['81231974', '81231975'] },
      { title: 'Le Voyage de Chihiro', movieIds: ['60023642'] },
    ]);
  });
});

// ─── Fonction injectée dans l'onglet (faux DOM) ───────────────────────────

interface FakeButton {
  textContent: string;
  disabled: boolean;
  inRow: boolean;
  clicks: number;
  closest(selector: string): object | null;
  click(): void;
}

function fakeNetflixPage(path = '/viewingactivity', more = '  Voir plus '): { buttons: FakeButton[]; rows: { href: string; text: string }[] } {
  const rows = [
    { href: '/title/81301838', text: 'Ranma ½ : Saison 1 : "Épisode 5"' },
    { href: '/title/60023642', text: 'Le Voyage de Chihiro' },
  ];
  const button = (textContent: string, inRow = false): FakeButton => {
    const b: FakeButton = { textContent, disabled: false, inRow, clicks: 0, closest: (selector) => (b.inRow && selector === 'li.retableRow' ? {} : null), click: () => void b.clicks++ };
    return b;
  };
  const buttons = [button('Masquer dans l’historique', true), button('Signaler un problème', true), button('Masquer tout'), button(more)];
  vi.stubGlobal('location', { pathname: path });
  vi.stubGlobal('document', {
    querySelectorAll: (selector: string) =>
      selector === 'button'
        ? buttons
        : selector === 'li.retableRow'
          ? rows.map((row) => ({ querySelector: () => ({ getAttribute: () => row.href, textContent: row.text }) }))
          : [],
    querySelector: (selector: string) => (selector === '.retable' ? {} : null),
  });
  return { buttons, rows };
}

describe('netflixTabOp (exécutée dans l’onglet Netflix)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis, Symbol.for('synckai.test.hook'));
  });

  it('état de la page, puis un clic sur « Voir plus » et sur RIEN d’autre', () => {
    const page = fakeNetflixPage();
    expect(netflixTabOp('state', 'synckai.test.hook', '')).toEqual({ path: '/viewingactivity', rows: 2, more: true, gate: false, list: true });
    expect(netflixTabOp('click', 'synckai.test.hook', '')).toBe(true);
    expect(page.buttons.map((b) => [b.textContent.trim(), b.clicks])).toEqual([
      ['Masquer dans l’historique', 0],
      ['Signaler un problème', 0],
      ['Masquer tout', 0],
      ['Voir plus', 1],
    ]);
  });

  it('« Voir plus » dans la langue du profil Netflix (libellés de l’aide Netflix), casse et normalisation ignorées', () => {
    const labels = [
      'Show more',
      'Mehr anzeigen',
      'Mostra altri',
      'Mostrar más',
      'Mostrar mais',
      'Meer weergeven',
      'Visa mer',
      'Pokaż więcej',
      'Zobrazit více',
      'Mai multe',
      'Показать еще',
      'Показать ещё',
      'Показати більше',
      'Daha Fazla Göster',
      'Tampilkan lainnya',
      'Hiển thị thêm',
      // Vietnamien décomposé (NFD) : comparé après normalisation
      'Hiển thị thêm'.normalize('NFD'),
      'その他を表示',
      '顯示更多',
      '显示更多',
      '더 보기',
    ];
    for (const label of labels) {
      const page = fakeNetflixPage('/viewingactivity', label);
      expect(netflixTabOp('state', 'synckai.test.hook', ''), label).toMatchObject({ more: true });
      expect(netflixTabOp('click', 'synckai.test.hook', ''), label).toBe(true);
      expect(page.buttons.map((b) => b.clicks), label).toEqual([0, 0, 0, 1]);
    }
  });

  it('libellé inconnu (langue de profil non vérifiée) : bouton jamais cliqué', () => {
    // Thaï : langue de profil dont le libellé n'est pas vérifié
    const page = fakeNetflixPage('/viewingactivity', 'ดูเพิ่มเติม');
    expect(netflixTabOp('state', 'synckai.test.hook', '')).toMatchObject({ more: false });
    expect(netflixTabOp('click', 'synckai.test.hook', '')).toBe(false);
    expect(page.buttons.every((b) => b.clicks === 0)).toBe(true);
  });

  it('bouton absent ou désactivé : aucun clic', () => {
    const page = fakeNetflixPage();
    const more = page.buttons[3];
    if (more) more.disabled = true;
    expect(netflixTabOp('state', 'synckai.test.hook', '')).toMatchObject({ more: false });
    expect(netflixTabOp('click', 'synckai.test.hook', '')).toBe(false);
    expect(page.buttons.every((b) => b.clicks === 0)).toBe(true);
  });

  it('lignes : lien et texte ; métadonnées demandées au script de contenu, « absent » sans lui', async () => {
    fakeNetflixPage();
    expect(netflixTabOp('rows', 'synckai.test.hook', '')).toEqual([
      { href: '/title/81301838', text: 'Ranma ½ : Saison 1 : "Épisode 5"' },
      { href: '/title/60023642', text: 'Le Voyage de Chihiro' },
    ]);
    expect(netflixTabOp('show', 'synckai.test.hook', '81301838')).toBe('absent');
    Reflect.set(globalThis, Symbol.for('synckai.test.hook'), (id: string) => Promise.resolve({ asked: id }));
    await expect(netflixTabOp('show', 'synckai.test.hook', '81301838')).resolves.toEqual({ asked: '81301838' });
  });
});

// ─── Lecture pilotée (faux onglet) ────────────────────────────────────────

/** Onglet simulé : `pages` lignes de plus par clic, `total` lignes au plus ; bouton présent tant qu'il en reste */
function fakeTab(options: { initial?: number; perClick?: number; total?: number; path?: string; stuck?: boolean; list?: boolean; unknownLabel?: boolean } = {}) {
  const perClick = options.perClick ?? 20;
  const total = options.total ?? 70;
  let rows = options.initial ?? 20;
  let clicks = 0;
  const tab: NetflixTab = {
    state: () => Promise.resolve({ path: options.path ?? '/viewingactivity', rows, more: !options.unknownLabel && rows < total, gate: false, list: options.list ?? true } satisfies NetflixPageState),
    clickMore: () => {
      clicks++;
      if (!options.stuck) rows = Math.min(total, rows + perClick);
      return Promise.resolve(true);
    },
    rows: () => Promise.resolve(Array.from({ length: rows }, (_, i) => ({ href: `/title/${81000000 + i}`, text: `Série ${i} : Saison 1 : "Épisode 1"` }))),
  };
  return { tab, clicks: () => clicks };
}

function clock() {
  let elapsed = 0;
  return { sleep: (ms: number) => ((elapsed += ms), Promise.resolve()), elapsed: () => elapsed };
}

describe('lecture de l’historique (« Voir plus » jusqu’à la fin)', () => {
  it('clique tant que le bouton existe, au plus un clic par seconde, puis lit toutes les lignes', async () => {
    const { tab, clicks } = fakeTab();
    const time = clock();
    const progress: number[] = [];
    const result = await readNetflixHistory(tab, { sleep: time.sleep, stopped: () => false }, (rows) => progress.push(rows));
    expect(result).toMatchObject({ ok: true, read: { clicks: 3, partial: false } });
    expect(result?.ok && result.read.rows).toHaveLength(70);
    expect(clicks()).toBe(3);
    expect(progress).toEqual([20, 40, 60, 70]);
    expect(time.elapsed()).toBeGreaterThanOrEqual(3 * NETFLIX_CLICK_GAP_MS);
  });

  it('bouton sans effet : NETFLIX_MAX_STALLS clics puis arrêt, historique déclaré partiel', async () => {
    const { tab, clicks } = fakeTab({ stuck: true });
    const time = clock();
    const result = await readNetflixHistory(tab, { sleep: time.sleep, stopped: () => false }, () => undefined);
    expect(result).toMatchObject({ ok: true, read: { clicks: NETFLIX_MAX_STALLS, partial: true } });
    expect(clicks()).toBe(NETFLIX_MAX_STALLS);
    expect(time.elapsed()).toBeGreaterThanOrEqual(NETFLIX_MAX_STALLS * NETFLIX_GROWTH_TIMEOUT_MS);
  });

  it('limite de lignes atteinte : arrêt, partiel', async () => {
    const { tab } = fakeTab({ initial: MAX_NETFLIX_HISTORY_ROWS, total: MAX_NETFLIX_HISTORY_ROWS + 100 });
    const result = await readNetflixHistory(tab, { sleep: clock().sleep, stopped: () => false }, () => undefined);
    expect(result).toMatchObject({ ok: true, read: { clicks: 0, partial: true } });
    expect(result?.ok && result.read.rows).toHaveLength(MAX_NETFLIX_HISTORY_ROWS);
  });

  it('profil dans une langue au « Voir plus » inconnu : première page pleine sans bouton reconnu → partiel, signalé', async () => {
    const { tab, clicks } = fakeTab({ unknownLabel: true });
    const result = await readNetflixHistory(tab, { sleep: clock().sleep, stopped: () => false }, () => undefined);
    expect(result).toMatchObject({ ok: true, read: { clicks: 0, partial: true, moreUnrecognized: true } });
    expect(result?.ok && result.read.rows).toHaveLength(NETFLIX_PAGE_ROWS);
    expect(clicks()).toBe(0);
  });

  it('historique plus court qu’une page (aucun bouton) : complet, rien de signalé', async () => {
    const result = await readNetflixHistory(fakeTab({ initial: 12, total: 12 }).tab, { sleep: clock().sleep, stopped: () => false }, () => undefined);
    expect(result).toMatchObject({ ok: true, read: { clicks: 0, partial: false, moreUnrecognized: false } });
  });

  it('« Arrêter » : null, aucun clic de plus', async () => {
    const { tab, clicks } = fakeTab();
    let stop = false;
    const result = await readNetflixHistory(tab, { sleep: clock().sleep, stopped: () => stop }, (rows) => (stop = rows >= 40));
    expect(result).toBeNull();
    expect(clicks()).toBe(1);
  });

  it('page de connexion, choix du profil, autre page : code d’échec, aucun clic', async () => {
    for (const [path, code] of [
      ['/login', 'logged-out'],
      ['/be-fr/login', 'logged-out'],
      ['/browse', 'wrong-page'],
    ] as const) {
      const { tab, clicks } = fakeTab({ path });
      expect(await readNetflixHistory(tab, { sleep: clock().sleep, stopped: () => false }, () => undefined)).toEqual({ ok: false, code });
      expect(clicks()).toBe(0);
    }
    expect(netflixPageProblem({ path: '/viewingactivity', rows: 0, more: false, gate: true, list: false })).toBe('logged-out');
    expect(netflixPageProblem({ path: '/be-fr/viewingactivity', rows: 3, more: false, gate: false, list: true })).toBeNull();
  });

  it('aucune ligne après NETFLIX_READY_TIMEOUT_MS : historique vide (liste présente) ou page modifiée', async () => {
    const empty = await readNetflixHistory(fakeTab({ initial: 0, total: 0 }).tab, { sleep: clock().sleep, stopped: () => false }, () => undefined);
    expect(empty).toEqual({ ok: true, read: { rows: [], clicks: 0, partial: false, moreUnrecognized: false } });
    const time = clock();
    const changed = await readNetflixHistory(fakeTab({ initial: 0, total: 0, list: false }).tab, { sleep: time.sleep, stopped: () => false }, () => undefined);
    expect(changed).toEqual({ ok: false, code: 'unavailable' });
    expect(time.elapsed()).toBeGreaterThanOrEqual(NETFLIX_READY_TIMEOUT_MS);
  });

  it('réponse inattendue de l’onglet : page modifiée', async () => {
    const tab: NetflixTab = { state: () => Promise.resolve({ path: 42 }), clickMore: () => Promise.resolve(false), rows: () => Promise.resolve([]) };
    expect(await readNetflixHistory(tab, { sleep: clock().sleep, stopped: () => false }, () => undefined)).toEqual({ ok: false, code: 'unavailable' });
    expect(isNetflixPageState({ path: '/viewingactivity', rows: -1, more: true, gate: false, list: true })).toBe(false);
  });
});

// ─── Points de lecture → saisons ──────────────────────────────────────────

describe('épisode vu d’après le dernier point de lecture', () => {
  it('position ≥ plus petite marque de fin connue (fin de visionnage, générique)', () => {
    expect(isNetflixWatched({ bookmark: { offset: 1308, watchedToEndOffset: 1269 }, runtime: 1462, creditsOffset: 1302 }, 85)).toBe(true);
    expect(isNetflixWatched({ bookmark: { offset: 1262, watchedToEndOffset: 1283 }, runtime: 1462, creditsOffset: 1293 }, 85)).toBe(false);
    // Générique seul
    expect(isNetflixWatched({ bookmark: { offset: 1300, watchedToEndOffset: null }, runtime: 1462, creditsOffset: 1293 }, 85)).toBe(true);
  });

  it('sans marque : seuil de fin réglé (pourcentage de la durée) ; jamais vu, commencé, à 0 : non', () => {
    expect(isNetflixWatched({ bookmark: { offset: 1300, watchedToEndOffset: null }, runtime: 1462, creditsOffset: null }, 85)).toBe(true);
    expect(isNetflixWatched({ bookmark: { offset: 1200, watchedToEndOffset: null }, runtime: 1462, creditsOffset: null }, 85)).toBe(false);
    expect(isNetflixWatched({ bookmark: { offset: 1300, watchedToEndOffset: null }, runtime: null, creditsOffset: null }, 85)).toBe(false);
    expect(isNetflixWatched({ bookmark: null, runtime: 1462, creditsOffset: 1302 }, 85)).toBe(false);
    expect(isNetflixWatched({ bookmark: { offset: 0, watchedToEndOffset: 1269 }, runtime: 1462, creditsOffset: 1302 }, 85)).toBe(false);
    expect(isNetflixWatched({ runtime: 1462, creditsOffset: 1302 }, 85)).toBe(false);
  });
});

describe('série Netflix → une ligne par saison vue', () => {
  it('Ranma ½ (relevé réel) : S1 progression 5 (E6 non terminé), S2 jamais vue absente', () => {
    const seasons = reduceNetflixShow(ranmaShow(), 85);
    expect(seasons).toEqual([
      {
        seriesId: '81301833',
        seriesTitle: 'Ranma1/2',
        seriesSlug: null,
        seasonId: '81301833-s1',
        seasonNumber: 1,
        seasonTitle: null,
        episodeId: RANMA_S1E5,
        episodeTitle: 'Épisode 5',
        episodeNumber: 5,
        seasonEpisodeNumber: 5,
        watchedCount: 4,
        lastPlayedAt: null,
        platformSeasons: [12, 12],
      },
    ]);
    expect(isCrHistoryResult({ seasons, stats: { items: 8, pages: 1, partial: false, ignored: 2 } })).toBe(true);
    expect(isCrHistoryResult({ seasons, stats: { items: 20, pages: 1, partial: true, moreUnrecognized: true } })).toBe(true);
    expect(isCrHistoryResult({ seasons, stats: { items: 20, pages: 1, partial: true, moreUnrecognized: 'yes' } })).toBe(false);
    // Même clé de correspondance et mêmes numéros que la page de lecture : netflix:{showId}:s{seq}
    const [s1] = seasons;
    if (!s1) throw new Error('saison absente');
    expect(toEpisodeInfo(s1, 'netflix')).toMatchObject({ platform: 'netflix', seriesId: '81301833', seasonNumber: 1, url: `https://www.netflix.com/watch/${RANMA_S1E5}`, platformSeasons: [12, 12] });
  });

  it('One Piece, arc Elbaph : lancé (5 s) et partiel (963 / 1417) jamais importés', () => {
    expect(reduceNetflixShow(onePieceShow(), 85)).toEqual([]);
  });

  it('One Piece, arc Elbaph : numérotation absolue (E1170 = 15e épisode de l’arc), comme en lecture', () => {
    expect(reduceNetflixShow(onePieceShow(true), 85)).toEqual([
      expect.objectContaining({ seasonId: '80107103-s40', seasonNumber: 40, seasonTitle: 'Elbaph Arc', episodeId: ONE_PIECE_E1170, episodeNumber: 1170, seasonEpisodeNumber: 15, watchedCount: 1, platformSeasons: [61, 25] }),
    ]);
  });

  it('film vu : épisode 1 sans saison ; film commencé : rien', () => {
    expect(reduceNetflixShow(movieShow(7300), 85)).toEqual([
      { seriesId: '60023642', seriesTitle: 'Spirited Away', seriesSlug: null, seasonId: '60023642-s0', seasonNumber: null, seasonTitle: null, episodeId: '60023642', episodeTitle: null, episodeNumber: 1, seasonEpisodeNumber: 1, watchedCount: 1, lastPlayedAt: null },
    ]);
    expect(reduceNetflixShow(movieShow(600), 85)).toEqual([]);
  });

  it('forme réduite avec points de lecture acceptée par la page d’import', () => {
    expect(isNetflixShowMetadata(ranmaShow())).toBe(true);
    expect(isNetflixShowMetadata(movieShow(10))).toBe(true);
    expect(isNetflixShowMetadata({ ...movieShow(10), bookmark: { offset: -1, watchedToEndOffset: null } })).toBe(false);
    expect(isNetflixShowMetadata({ ...movieShow(10), bookmark: { offset: 10, watchedToEndOffset: 'x' } })).toBe(false);
  });
});

describe('filtre « anime » (verdicts du service worker)', () => {
  it('métadonnées demandées seulement pour un titre lié à Netflix ou au même titre', () => {
    expect(needsMetadata({ showIds: ['81301833'], titleMatch: false })).toBe(true);
    expect(needsMetadata({ showIds: [], titleMatch: true })).toBe(true);
    expect(needsMetadata({ showIds: [], titleMatch: false })).toBe(false);
  });

  it('série lue gardée si AniList la lie, ou au même titre (vérification seulement)', () => {
    expect(keepsShow({ showIds: ['81301833', '81171925'], titleMatch: false }, { showId: '81301833' })).toBe(true);
    expect(keepsShow({ showIds: ['80107103'], titleMatch: false }, { showId: '81231974' })).toBe(false);
    expect(keepsShow({ showIds: [], titleMatch: true }, { showId: '81231974' })).toBe(true);
  });

  it('paquets de 10 titres au plus', () => {
    expect(isNetflixTitlesPayload({ titles: ['Ranma ½'] })).toBe(true);
    expect(isNetflixTitlesPayload({ titles: Array.from({ length: 11 }, () => 'x') })).toBe(false);
    expect(isNetflixTitlesPayload({ titles: ['x'.repeat(301)] })).toBe(false);
  });
});
