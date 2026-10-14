import { describe, expect, it } from 'vitest';
import { applyDisneySeason, reduceDisneyPlayerExperience, reduceDisneySeriesPage, type DisneyPlayerExperience, type DisneySeriesPage } from '../disney/bridge-protocol';
import {
  nonAnimeEpisode,
  nonAnimeSeriesPage,
  PLAY_PAGE_VIDEOS,
  SEEN_AT,
  UNDEAD_UNLUCK_S1E1_AVAIL_ID,
  UNDEAD_UNLUCK_ENTITY_ID,
  UNDEAD_UNLUCK_S1_ID,
  UNDEAD_UNLUCK_S1E1_PLAY_ID,
  undeadUnluckS1E1,
  undeadUnluckSeriesPage,
  UP_NEXT_TITLES,
  WINTER_ARC_E1_AVAIL_ID,
  WINTER_ARC_SEASON_ID,
  winterArcE1,
  winterArcSeasonResponse,
} from '../disney/fixtures';
import {
  arcTitleFromSubtitle,
  chooseDisneyVideo,
  createProgressReader,
  disneyAdapter,
  episodeInfoFromPlayerExperience,
  episodeTitleFromSubtitle,
  hasAnimeGenre,
  isJapaneseOriginal,
  parseDisneyEntityId,
  parseDisneyPlayId,
  parseInternalTitle,
  pickDisneySeason,
  pickPlayingVideo,
  seasonFromMenu,
  seriesInfoFromDisneyPage,
  type MenuElement,
  readProgressRange,
  type ProgressContext,
} from './disney';

function reduced(raw: unknown, requestId: string): DisneyPlayerExperience {
  const entry = reduceDisneyPlayerExperience(raw, requestId, SEEN_AT);
  if (!entry) throw new Error('fixture invalide');
  return entry;
}

/** S1E1 demandée par availId : l'épisode de l'URL /play/{id} vient de infoBlock */
const S1E1 = reduced(undeadUnluckS1E1(), UNDEAD_UNLUCK_S1E1_AVAIL_ID);
const WINTER_ARC = reduced(winterArcE1(), WINTER_ARC_E1_AVAIL_ID);

describe('parseDisneyPlayId', () => {
  it.each([
    ['/fr-fr/play/539f8e74-65f6-4c6e-a689-c91d125b6c61', '539f8e74-65f6-4c6e-a689-c91d125b6c61'],
    ['/en-us/play/EACCAAFA-CF43-4D6A-B85F-F9ADD5B6CF41/', 'eaccaafa-cf43-4d6a-b85f-f9add5b6cf41'],
    ['/es-419/play/0580a81e-2408-48e8-a6e0-14da8ca0e87f', '0580a81e-2408-48e8-a6e0-14da8ca0e87f'],
    ['/play/0580a81e-2408-48e8-a6e0-14da8ca0e87f', '0580a81e-2408-48e8-a6e0-14da8ca0e87f'],
  ])('%s → %s', (path, id) => {
    expect(parseDisneyPlayId(path)).toBe(id);
  });

  it.each(['/fr-fr/browse/entity-eaccaafa-cf43-4d6a-b85f-f9add5b6cf41', '/fr-fr/play/', '/fr-fr/play/1234', '/fr-fr/home', '/a/b/play/eaccaafa-cf43-4d6a-b85f-f9add5b6cf41'])(
    'pas une page de lecture : %s',
    (path) => {
      expect(parseDisneyPlayId(path)).toBeNull();
    },
  );

  it('adapter : hôtes disneyplus.com uniquement, identifiant de l’URL', () => {
    expect(disneyAdapter.supportsHost('www.disneyplus.com')).toBe(true);
    expect(disneyAdapter.supportsHost('disneyplus.com')).toBe(true);
    expect(disneyAdapter.supportsHost('disneyplus.com.evil.example')).toBe(false);
    expect(disneyAdapter.getEpisodeId(new URL(`https://www.disneyplus.com/fr-fr/play/${UNDEAD_UNLUCK_S1E1_PLAY_ID}?contextId=x`))).toBe(UNDEAD_UNLUCK_S1E1_PLAY_ID);
    expect(disneyAdapter.quiet).toBe(true);
    // Début du générique de fin : repère FFEC de la réponse de lecture (voir disney-credits.test.ts)
    expect(disneyAdapter.getCreditsStart).toBeTypeOf('function');
  });
});

describe('parseInternalTitle', () => {
  it('épisode : série en anglais, saison, épisode', () => {
    expect(parseInternalTitle(S1E1.internalTitle)).toEqual({ kind: 'episode', series: 'Undead Unluck', season: 1, episode: 1 });
    expect(parseInternalTitle(WINTER_ARC.internalTitle)).toEqual({ kind: 'episode', series: 'Undead Unluck', season: 99, episode: 1 });
  });

  it.each(UP_NEXT_TITLES)('titre affiché « $displayed » → série « $series » (internalTitle, jamais le titre localisé)', ({ internalTitle, series, season, episode }) => {
    expect(parseInternalTitle(internalTitle)).toEqual({ kind: 'episode', series, season, episode });
  });

  it('film (sans sNeN) et formes illisibles', () => {
    expect(parseInternalTitle('Suzume - mediaId:6175d8e7-a4c4-4dfc-9b45-ae2e9d518a59')).toEqual({ kind: 'movie', title: 'Suzume' });
    expect(parseInternalTitle(null)).toBeNull();
    expect(parseInternalTitle('Undead Unluck - s1e1')).toBeNull();
    expect(parseInternalTitle(' - s1e1 - mediaId:6175d8e7-a4c4-4dfc-9b45-ae2e9d518a59')).toBeNull();
  });
});

describe('sous-titre localisé', () => {
  it('arc (saison 99) : texte avant le repère d’épisode portant le bon numéro', () => {
    expect(arcTitleFromSubtitle(WINTER_ARC.subtitle, 1)).toBe('Undead Unluck: Winter Arc');
    expect(arcTitleFromSubtitle('Undead Unluck: Winter Arc: E12 Titre', 12)).toBe('Undead Unluck: Winter Arc');
    expect(arcTitleFromSubtitle('Undead Unluck: Winter Arc : F3 Titel', 3)).toBe('Undead Unluck: Winter Arc');
    expect(arcTitleFromSubtitle('Undead Unluck: Winter Arc : E1 Titre', 2)).toBeNull();
    expect(arcTitleFromSubtitle(null, 1)).toBeNull();
  });

  it('titre de l’épisode : texte après le repère', () => {
    expect(episodeTitleFromSubtitle(S1E1.subtitle, 1)).toBe('Undead et Unluck');
    expect(episodeTitleFromSubtitle(WINTER_ARC.subtitle, 1)).toBe('Undead Unluck: Winter Arc');
    expect(episodeTitleFromSubtitle('S1:E1', 1)).toBeNull();
  });
});

describe('episodeInfoFromPlayerExperience', () => {
  it('saison normale : épisode de l’URL (pas l’availId), titre anglais de la série, numérotation par saison', () => {
    expect(episodeInfoFromPlayerExperience(S1E1, UNDEAD_UNLUCK_S1E1_PLAY_ID.toUpperCase())).toEqual({
      platform: 'disney',
      episodeId: UNDEAD_UNLUCK_S1E1_PLAY_ID,
      seriesId: null,
      seriesSlug: null,
      animeTitle: 'Undead Unluck',
      seasonNumber: 1,
      seasonTitle: null,
      seasonEpisodeNumber: 1,
      displayedEpisodeNumber: 1,
      episodeTitle: 'Undead et Unluck',
      url: `https://www.disneyplus.com/play/${UNDEAD_UNLUCK_S1E1_PLAY_ID}`,
      // Sans page de série vue : format et durée de la fiche seulement
      signals: { episodeMinutes: 24.3, format: 'series' },
    });
    // Identifiant de la réponse (requête par availId) : reconnu aussi
    expect(episodeInfoFromPlayerExperience(S1E1, UNDEAD_UNLUCK_S1E1_AVAIL_ID)?.episodeId).toBe(UNDEAD_UNLUCK_S1E1_AVAIL_ID);
  });

  it('page de série de la même série vue dans l’onglet : année de la série et épisodes de la saison', () => {
    const page = reduceDisneySeriesPage(undeadUnluckSeriesPage(), UNDEAD_UNLUCK_ENTITY_ID, SEEN_AT);
    const other = reduceDisneySeriesPage(undeadUnluckSeriesPage({ entityId: '11111111-2222-4333-8444-000000000002', title: 'Andor', internalTitles: false }), '11111111-2222-4333-8444-000000000002', SEEN_AT);
    if (!page || !other) throw new Error('fixture invalide');
    expect(episodeInfoFromPlayerExperience(S1E1, UNDEAD_UNLUCK_S1E1_PLAY_ID, [page, other])?.signals).toEqual({ seriesYear: 2023, seasonEpisodeCount: 24, episodeMinutes: 24.3, format: 'series' });
    // Page d'une autre série (sans titre interne) : jamais rapprochée
    expect(episodeInfoFromPlayerExperience(S1E1, UNDEAD_UNLUCK_S1E1_PLAY_ID, [other])?.signals).toEqual({ episodeMinutes: 24.3, format: 'series' });
    // Arc : saison désignée par son nom
    const arc = episodeInfoFromPlayerExperience(WINTER_ARC, WINTER_ARC_E1_AVAIL_ID, [page]);
    expect(arc?.signals).toMatchObject({ seriesYear: 2023, seasonEpisodeCount: 1 });
  });

  it('saison 99 : arc en titre de saison (fiche AniList distincte)', () => {
    expect(episodeInfoFromPlayerExperience(WINTER_ARC, WINTER_ARC_E1_AVAIL_ID)).toMatchObject({
      animeTitle: 'Undead Unluck',
      seasonNumber: 99,
      seasonTitle: 'Undead Unluck: Winter Arc',
      seasonEpisodeNumber: 1,
      displayedEpisodeNumber: 1,
    });
    // Arc illisible : saison spéciale (0), jamais la saison 99 de la série
    expect(episodeInfoFromPlayerExperience({ ...WINTER_ARC, subtitle: null }, WINTER_ARC_E1_AVAIL_ID)).toMatchObject({ seasonNumber: 0, seasonTitle: null });
  });

  it('pas un anime (langue originale non japonaise) : rien', () => {
    const andor = reduced(nonAnimeEpisode(), '11111111-2222-4333-8444-555555555555');
    expect(isJapaneseOriginal(andor)).toBe(false);
    expect(episodeInfoFromPlayerExperience(andor, '11111111-2222-4333-8444-555555555555')).toBeNull();
    expect(episodeInfoFromPlayerExperience({ ...S1E1, originalLanguage: null }, UNDEAD_UNLUCK_S1E1_PLAY_ID)).toBeNull();
    expect(isJapaneseOriginal({ originalLanguage: 'ja-JP' })).toBe(true);
    expect(isJapaneseOriginal({ originalLanguage: 'jav' })).toBe(false);
  });

  it('fiche d’une autre vidéo ou titre interne illisible : rien', () => {
    expect(episodeInfoFromPlayerExperience(S1E1, WINTER_ARC_E1_AVAIL_ID)).toBeNull();
    expect(episodeInfoFromPlayerExperience({ ...S1E1, internalTitle: 'Undead Unluck' }, UNDEAD_UNLUCK_S1E1_PLAY_ID)).toBeNull();
  });

  it('film : épisode 1 sans saison (comme Netflix), seulement si le programme est un film', () => {
    const movie: DisneyPlayerExperience = { ...S1E1, internalTitle: 'Suzume - mediaId:6175d8e7-a4c4-4dfc-9b45-ae2e9d518a59', programType: 'movie' };
    expect(episodeInfoFromPlayerExperience(movie, UNDEAD_UNLUCK_S1E1_PLAY_ID)).toMatchObject({ animeTitle: 'Suzume', seasonNumber: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 });
    expect(episodeInfoFromPlayerExperience({ ...movie, programType: 'episode' }, UNDEAD_UNLUCK_S1E1_PLAY_ID)).toBeNull();
  });
});

/** Élément minimal : attributs ARIA de la plage de la barre de progression */
function rangeElement(attributes: Record<string, string>): Pick<Element, 'getAttribute'> {
  return { getAttribute: (name: string) => attributes[name] ?? null };
}

describe('readProgressRange', () => {
  it('position et durée en secondes', () => {
    expect(readProgressRange(rangeElement({ 'aria-valuenow': '363', 'aria-valuemax': '2913', 'aria-valuetext': '6:03 of 48:33' }))).toEqual({ now: 363, max: 2913 });
    expect(readProgressRange(rangeElement({ 'aria-valuenow': '12.5' }))).toEqual({ now: 12.5, max: null });
  });

  it('valeurs absentes ou invalides', () => {
    expect(readProgressRange(null)).toBeNull();
    expect(readProgressRange(rangeElement({ 'aria-valuemax': '2913' }))).toBeNull();
    expect(readProgressRange(rangeElement({ 'aria-valuenow': 'abc', 'aria-valuemax': '2913' }))).toBeNull();
    expect(readProgressRange(rangeElement({ 'aria-valuenow': '-1' }))).toBeNull();
    expect(readProgressRange(rangeElement({ 'aria-valuenow': '10', 'aria-valuemax': '0' }))).toEqual({ now: 10, max: null });
  });
});

/** Hôte `progress-bar` simulé : Shadow DOM ouvert contenant la plage, attributs modifiables */
function fakeHost(attributes: Record<string, string>): { host: Element; attributes: Record<string, string>; detach: () => void } {
  const state = { connected: true };
  const range = rangeElement(attributes);
  const host = {
    get isConnected() {
      return state.connected;
    },
    shadowRoot: { querySelector: (selector: string) => (selector === '.progress-bar__seekable-range' ? range : null) },
  } as unknown as Element;
  return { host, attributes, detach: () => (state.connected = false) };
}

const fakeVideo = (currentTime: number): HTMLVideoElement => ({ currentTime, duration: Number.POSITIVE_INFINITY }) as unknown as HTMLVideoElement;

/** Contexte de lecture : vidéo de la page (S1E1 par défaut) et durée de sa fiche */
const ctx = (fallbackDuration: number | null, key: string | null = 'eaccaafa-cf43-4d6a-b85f-f9add5b6cf41'): ProgressContext => ({ key, fallbackDuration });

describe('createProgressReader (barre de progression du lecteur)', () => {
  it('position et durée de la barre ; la <video> (durée infinie) n’est jamais lue pour la durée', () => {
    const { host } = fakeHost({ 'aria-valuenow': '363', 'aria-valuemax': '2913' });
    const read = createProgressReader(() => host);
    expect(read(fakeVideo(10_000), ctx(1460))).toEqual({ currentTime: 363, duration: 2913 });
  });

  it('durée absente de la barre : durée de la fiche (runtimeMs)', () => {
    const { host } = fakeHost({ 'aria-valuenow': '60' });
    expect(createProgressReader(() => host)(fakeVideo(0), ctx(1460))).toEqual({ currentTime: 60, duration: 1460 });
  });

  it('barre figée (commandes masquées) : la position avance du temps écoulé sur la <video>', () => {
    const { host, attributes } = fakeHost({ 'aria-valuenow': '100', 'aria-valuemax': '1460' });
    const read = createProgressReader(() => host);
    const video = { currentTime: 5000, duration: Number.NaN } as unknown as HTMLVideoElement;
    expect(read(video, ctx(null))?.currentTime).toBe(100);
    Object.assign(video, { currentTime: 5030 });
    expect(read(video, ctx(null))?.currentTime).toBe(130);
    // Mise à jour de la barre : nouvelle ancre
    attributes['aria-valuenow'] = '131';
    expect(read(video, ctx(null))?.currentTime).toBe(131);
    // Retour en arrière de la <video> sans mise à jour de la barre : jamais en arrière de l'ancre
    Object.assign(video, { currentTime: 4000 });
    expect(read(video, ctx(null))?.currentTime).toBe(131);
    // Bornée à la durée
    Object.assign(video, { currentTime: 99_999 });
    expect(read(video, ctx(null))?.currentTime).toBe(1460);
  });

  it('lecteur pas encore monté : recherches espacées, puis barre trouvée', () => {
    let clock = 0;
    let available: Element | null = null;
    let searches = 0;
    const reports: boolean[] = [];
    const read = createProgressReader(
      () => {
        searches++;
        return available;
      },
      () => clock,
      (found) => reports.push(found),
    );
    // Sans barre ni ancre : position inconnue (la <video> n'a pas la position du programme)
    expect(read(fakeVideo(30), ctx(1460))).toBeNull();
    expect(read(fakeVideo(30), ctx(null))).toBeNull();
    expect(searches).toBe(1);
    clock = 1_500;
    read(fakeVideo(30), ctx(1460));
    expect(searches).toBe(2);
    available = fakeHost({ 'aria-valuenow': '42', 'aria-valuemax': '1460' }).host;
    clock = 10_000;
    expect(read(fakeVideo(30), ctx(1460))).toEqual({ currentTime: 42, duration: 1460 });
    expect(searches).toBe(3);
    // Diagnostic : « introuvable » une fois par série d'échecs, puis « trouvée »
    expect(reports).toEqual([false, true]);
  });

  it('lecture automatique : barre restée sur la vidéo précédente ignorée jusqu’à ce qu’elle bouge, ancre non reprise', () => {
    const { host, attributes } = fakeHost({ 'aria-valuenow': '1400', 'aria-valuemax': '1460' });
    const read = createProgressReader(() => host);
    const video = { currentTime: 1400, duration: Number.NaN } as unknown as HTMLVideoElement;
    expect(read(video, ctx(1460))).toEqual({ currentTime: 1400, duration: 1460 });
    // Épisode suivant, même <video> : valeurs figées de l'épisode précédent → ni la barre ni l'ancre ne valent
    Object.assign(video, { currentTime: 1405 });
    expect(read(video, ctx(1440, '0580a81e-2408-48e8-a6e0-14da8ca0e87f'))).toBeNull();
    // La barre repart pour le nouvel épisode
    attributes['aria-valuenow'] = '1';
    attributes['aria-valuemax'] = '1440';
    expect(read(video, ctx(1440, '0580a81e-2408-48e8-a6e0-14da8ca0e87f'))).toEqual({ currentTime: 1, duration: 1440 });
  });

  it('hôte retiré du DOM (lecteur remonté) : nouvelle recherche', () => {
    const first = fakeHost({ 'aria-valuenow': '10', 'aria-valuemax': '1460' });
    const second = fakeHost({ 'aria-valuenow': '20', 'aria-valuemax': '1460' });
    const hosts = [first.host, second.host];
    const read = createProgressReader(() => hosts.shift() ?? null, () => 0);
    const video = fakeVideo(0);
    expect(read(video, ctx(null))?.currentTime).toBe(10);
    first.detach();
    expect(read(video, ctx(null))?.currentTime).toBe(20);
  });
});

describe('chooseDisneyVideo (lecteur de la page)', () => {
  type FakeVideo = (typeof PLAY_PAGE_VIDEOS)[number];
  /** Faux document : `video.hive-video`, lecteurs connus (classe btm-media-client-element) et toutes les <video> */
  function fakeRoot(videos: readonly FakeVideo[]): Pick<ParentNode, 'querySelector' | 'querySelectorAll'> {
    const matching = (selector: string): FakeVideo[] => {
      if (selector === 'video.hive-video') return videos.filter((video) => video.className.split(' ').includes('hive-video'));
      if (selector === 'video') return [...videos];
      return videos.filter((video) => video.className.split(' ').includes('btm-media-client-element'));
    };
    return {
      querySelector: ((selector: string) => matching(selector)[0] ?? null) as ParentNode['querySelector'],
      querySelectorAll: ((selector: string) => matching(selector)) as unknown as ParentNode['querySelectorAll'],
    };
  }
  const [inactive, hive] = PLAY_PAGE_VIDEOS;

  it('relevé réel : video.hive-video retenue, jamais la btm-media-client-element inactive', () => {
    expect(chooseDisneyVideo(fakeRoot(PLAY_PAGE_VIDEOS))).toBe(hive);
  });

  it('sans hive-video : la <video> en lecture, sinon celle qui a une image, sinon la première', () => {
    const playing = { ...hive, className: 'autre-lecteur' };
    expect(chooseDisneyVideo(fakeRoot([inactive, playing]))).toBe(playing);
    const framed = { ...playing, paused: true };
    expect(chooseDisneyVideo(fakeRoot([inactive, framed]))).toBe(framed);
    expect(chooseDisneyVideo(fakeRoot([inactive]))).toBe(inactive);
    expect(chooseDisneyVideo(fakeRoot([]))).toBeNull();
    expect(pickPlayingVideo([inactive])).toBeNull();
  });

  it('position : celle de la barre ; currentTime de hive-video (23 s) ne sert que d’écart d’extrapolation', () => {
    const { host } = fakeHost({ 'aria-valuenow': '600', 'aria-valuemax': '1460' });
    const read = createProgressReader(() => host);
    const video = { ...hive } as unknown as HTMLVideoElement;
    expect(read(video, ctx(1460))).toEqual({ currentTime: 600, duration: 1460 });
    Object.assign(video, { currentTime: 33 });
    expect(read(video, ctx(1460))).toEqual({ currentTime: 610, duration: 1460 });
  });
});

// ─── Page de série (/browse/entity-{uuid}) ────────────────────────────────

function seriesPage(raw: unknown = undeadUnluckSeriesPage(), entityId = UNDEAD_UNLUCK_ENTITY_ID): DisneySeriesPage {
  const page = reduceDisneySeriesPage(raw, entityId, SEEN_AT);
  if (!page) throw new Error('fixture invalide');
  return page;
}

describe('parseDisneyEntityId', () => {
  it.each([
    [`/fr-fr/browse/entity-${UNDEAD_UNLUCK_ENTITY_ID}`, UNDEAD_UNLUCK_ENTITY_ID],
    [`/browse/entity-${UNDEAD_UNLUCK_ENTITY_ID.toUpperCase()}/`, UNDEAD_UNLUCK_ENTITY_ID],
    [`/es-419/browse/entity-${UNDEAD_UNLUCK_ENTITY_ID}`, UNDEAD_UNLUCK_ENTITY_ID],
  ])('%s → %s', (path, id) => {
    expect(parseDisneyEntityId(path)).toBe(id);
  });

  it.each([`/fr-fr/play/${UNDEAD_UNLUCK_ENTITY_ID}`, '/fr-fr/browse/entity-1234', `/fr-fr/browse/${UNDEAD_UNLUCK_ENTITY_ID}`, '/fr-fr/home', `/a/b/browse/entity-${UNDEAD_UNLUCK_ENTITY_ID}`])(
    'pas une page de série : %s',
    (path) => {
      expect(parseDisneyEntityId(path)).toBeNull();
    },
  );
});

describe('seriesInfoFromDisneyPage', () => {
  it('Undead Unluck, saison affichée au chargement (focus) : uuid, titre anglais, anime, saison 1 (24 épisodes)', () => {
    const page = seriesPage();
    expect(seriesInfoFromDisneyPage(page, pickDisneySeason(page, null))).toEqual({
      seriesId: UNDEAD_UNLUCK_ENTITY_ID,
      seriesSlug: null,
      seriesTitle: 'Undead Unluck',
      catalogAnime: true,
      seasonNumber: 1,
      seasonTitle: null,
      seasonEpisodeCount: 24,
      // Année de début de la SÉRIE (releaseYearRange.startYear « 2023 »), saison 1 : 24 épisodes de 1459917 ms
      signals: { seriesYear: 2023, seasonEpisodeCount: 24, episodeMinutes: 24.3, format: 'series' },
    });
  });

  it('arc choisi (réponse season/{id} : s99) : saison 99 et nom de l’arc, comme la lecture', () => {
    const page = applyDisneySeason(seriesPage(), WINTER_ARC_SEASON_ID, winterArcSeasonResponse());
    if (!page) throw new Error('saison absente');
    expect(seriesInfoFromDisneyPage(page, pickDisneySeason(page, null))).toMatchObject({ seasonNumber: 99, seasonTitle: 'Undead Unluck: Winter Arc', seasonEpisodeCount: 1 });
  });

  it('arc choisi dans le menu, aucun épisode lu : désigné par son nom', () => {
    const page = seriesPage();
    const season = pickDisneySeason(page, seasonFromMenu(menuRoot([menuButton('Undead Unluck:  Winter Arc ')]), page.seasons)?.id ?? null);
    expect(seriesInfoFromDisneyPage(page, season)).toMatchObject({ seasonNumber: null, seasonTitle: 'Undead Unluck: Winter Arc' });
  });

  it('saison générique sans épisode lu (« Saison 2 ») : numéro du nom', () => {
    const page = seriesPage();
    expect(seriesInfoFromDisneyPage(page, { id: UNDEAD_UNLUCK_S1_ID, name: 'Saison 2', seasonNumber: null, episodeCount: 12, episodeMinutes: null })).toMatchObject({ seasonNumber: 2, seasonTitle: null, seasonEpisodeCount: 12 });
  });

  it('titre localisé (« Time Shadows ») : titre anglais du titre interne', () => {
    const page = seriesPage(undeadUnluckSeriesPage({ title: 'Time Shadows' }));
    expect(seriesInfoFromDisneyPage(page, null).seriesTitle).toBe('Undead Unluck');
  });

  it('pas un anime (aucun genre « Anime ») : signalé ; titre localisé faute de titre interne', () => {
    const page = seriesPage(nonAnimeSeriesPage(), '11111111-2222-4333-8444-000000000001');
    expect(seriesInfoFromDisneyPage(page, pickDisneySeason(page, null))).toMatchObject({ seriesTitle: 'Andor', catalogAnime: false, seasonNumber: 1 });
  });

  it('genres inconnus : rien n’est affirmé sur le genre', () => {
    const page = { ...seriesPage(), genres: [] };
    expect(seriesInfoFromDisneyPage(page, null)).not.toHaveProperty('catalogAnime');
  });

  it('hasAnimeGenre : casse et accents ignorés', () => {
    expect(hasAnimeGenre(['Animation', 'ANIME'])).toBe(true);
    expect(hasAnimeGenre(['Animé'])).toBe(true);
    expect(hasAnimeGenre(['Animation', 'Anime-Serie'])).toBe(false);
  });
});

/** Élément simulé : texte affiché et texte complet (textContent), visible ou non */
function element(text: string, { visible = true, textContent = text }: { visible?: boolean; textContent?: string } = {}): MenuElement & { innerText: string } {
  return { innerText: text, textContent, getClientRects: () => ({ length: visible ? 1 : 0 }) };
}

/** Bouton du menu des saisons relevé : button[data-testid="dropdown-button"][aria-haspopup="listbox"] */
const menuButton = (text: string, options?: { visible?: boolean; textContent?: string }): { selector: 'button'; element: MenuElement } => ({ selector: 'button', element: element(text, options) });
const toggle = (text: string, options?: { visible?: boolean; textContent?: string }): { selector: 'toggle'; element: MenuElement } => ({ selector: 'toggle', element: element(text, options) });

/** Document simulé : le bouton du menu répond à son sélecteur exact, les autres au sélecteur générique */
function menuRoot(nodes: readonly { selector: 'button' | 'toggle'; element: MenuElement }[]): { querySelectorAll(selector: string): MenuElement[] } {
  return {
    querySelectorAll: (selector) =>
      nodes.filter((node) => (selector.includes('data-testid="dropdown-button"') ? node.selector === 'button' : node.selector === 'toggle')).map((node) => node.element),
  };
}

describe('seasonFromMenu (menu des saisons, relevé du 2026-10-11)', () => {
  const page = seriesPage();

  it('Winter Arc choisi : bouton dropdown-button, même si un autre élément (masqué, pas à jour) affiche « Saison 1 »', () => {
    const root = menuRoot([menuButton('Undead Unluck: Winter Arc'), toggle('Saison 1', { visible: false })]);
    expect(seasonFromMenu(root, page.seasons)).toEqual({ id: WINTER_ARC_SEASON_ID, source: 'menu' });
  });

  it('texte masqué dans le bouton (icône, libellé d’accessibilité) : le texte affiché fait foi', () => {
    const root = menuRoot([menuButton('Undead Unluck: Winter Arc', { textContent: 'Undead Unluck: Winter ArcOuvrir la liste' })]);
    expect(seasonFromMenu(root, page.seasons)?.id).toBe(WINTER_ARC_SEASON_ID);
  });

  it('casse, espaces et typographie française ignorés', () => {
    expect(seasonFromMenu(menuRoot([menuButton('  undead unluck : WINTER   arc ')]), page.seasons)?.id).toBe(WINTER_ARC_SEASON_ID);
    expect(seasonFromMenu(menuRoot([menuButton('SAISON 1')]), page.seasons)?.id).toBe(UNDEAD_UNLUCK_S1_ID);
  });

  it('bouton absent : repli sur un élément visible et sans ambiguïté, jamais sur un élément masqué', () => {
    expect(seasonFromMenu(menuRoot([toggle('Undead Unluck: Winter Arc')]), page.seasons)).toEqual({ id: WINTER_ARC_SEASON_ID, source: 'generic' });
    expect(seasonFromMenu(menuRoot([toggle('Saison 1', { visible: false })]), page.seasons)).toBeNull();
    expect(seasonFromMenu(menuRoot([toggle('Saison 1'), toggle('Undead Unluck: Winter Arc')]), page.seasons)).toBeNull();
    expect(seasonFromMenu(menuRoot([toggle('Profil')]), page.seasons)).toBeNull();
  });
});

describe('pickDisneySeason', () => {
  const page = seriesPage();

  it('priorité : menu (DOM), puis dernière requête season/{id}, puis focus', () => {
    expect(pickDisneySeason(page, null)?.id).toBe(UNDEAD_UNLUCK_S1_ID);
    expect(pickDisneySeason({ ...page, selectedSeasonId: WINTER_ARC_SEASON_ID }, null)?.id).toBe(WINTER_ARC_SEASON_ID);
    expect(pickDisneySeason({ ...page, selectedSeasonId: WINTER_ARC_SEASON_ID }, UNDEAD_UNLUCK_S1_ID)?.id).toBe(UNDEAD_UNLUCK_S1_ID);
    expect(pickDisneySeason({ ...page, focusSeasonId: null }, null)).toBeNull();
    expect(pickDisneySeason({ ...page, focusSeasonId: null, seasons: page.seasons.slice(0, 1) }, null)?.id).toBe(UNDEAD_UNLUCK_S1_ID);
  });

});
