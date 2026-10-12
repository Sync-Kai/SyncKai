import { describe, expect, it } from 'vitest';
import {
  applyDisneySeason,
  decodeDisneyPush,
  DISNEY_BRIDGE_VERSION,
  DISNEY_MAX_PAGES,
  encodeDisneyPush,
  isDisneySeriesPage,
  observedRequest,
  playerExperienceRequestId,
  reduceDisneySeriesPage,
  type DisneySeriesPage,
} from './bridge-protocol';
import {
  nonAnimeSeriesPage,
  seasonUrl,
  SEEN_AT,
  seriesPageUrl,
  UNDEAD_UNLUCK_ENTITY_ID,
  UNDEAD_UNLUCK_S1_ID,
  undeadUnluckSeriesPage,
  WINTER_ARC_SEASON_ID,
  winterArcSeasonResponse,
} from './fixtures';

// Pages de série Disney+ (/browse/entity-{uuid}) : requêtes observées par le pont, réduction de la réponse
// `page/entity-{uuid}` (relevée le 2026-10-11) et des réponses `season/{id}` (forme non relevée, lecture tolérante).

function reduced(raw: unknown = undeadUnluckSeriesPage(), entityId = UNDEAD_UNLUCK_ENTITY_ID): DisneySeriesPage {
  const page = reduceDisneySeriesPage(raw, entityId, SEEN_AT);
  if (!page) throw new Error('fixture invalide');
  return page;
}

describe('observedRequest', () => {
  it('page de série, saison et fiche de vidéo de l’API du site', () => {
    expect(observedRequest(seriesPageUrl(UNDEAD_UNLUCK_ENTITY_ID.toUpperCase()))).toEqual({ kind: 'page', id: UNDEAD_UNLUCK_ENTITY_ID });
    expect(observedRequest(seasonUrl(WINTER_ARC_SEASON_ID, '3'))).toEqual({ kind: 'season', id: WINTER_ARC_SEASON_ID });
    expect(observedRequest(`/explore/v1.21/season/${WINTER_ARC_SEASON_ID}`, 'https://www.disneyplus.com/fr-fr/browse/x')).toEqual({ kind: 'season', id: WINTER_ARC_SEASON_ID });
    expect(observedRequest(`https://disney.api.edge.bamgrid.com/explore/v1.21/playerExperience/${WINTER_ARC_SEASON_ID}`)?.kind).toBe('player');
  });

  it.each([
    // Page sans entité (accueil, collection) ou saison / fiche avec préfixe d'entité : forme inconnue
    `https://disney.api.edge.bamgrid.com/explore/v1.21/page/${UNDEAD_UNLUCK_ENTITY_ID}`,
    `https://disney.api.edge.bamgrid.com/explore/v1.21/season/entity-${WINTER_ARC_SEASON_ID}`,
    'https://disney.api.edge.bamgrid.com/explore/v1.21/page/home',
    `https://evil.example/explore/v1.21/page/entity-${UNDEAD_UNLUCK_ENTITY_ID}`,
    `http://disney.api.edge.bamgrid.com/explore/v1.21/season/${WINTER_ARC_SEASON_ID}`,
  ])('ignorée : %s', (url) => {
    expect(observedRequest(url)).toBeNull();
    expect(playerExperienceRequestId(url)).toBeNull();
  });
});

describe('reduceDisneySeriesPage', () => {
  it('Undead Unluck : titres, genres, saison affichée, saisons (arc sans épisode lu)', () => {
    expect(reduced()).toEqual({
      entityId: UNDEAD_UNLUCK_ENTITY_ID,
      seenAt: SEEN_AT,
      title: 'Undead Unluck',
      internalTitle: 'Undead Unluck - s1e1 - mediaId:1986b4d2-f9b8-4382-8059-e067b887c911',
      genres: ['Action et aventure', 'Animation', 'Anime', 'Science-fiction', 'Fantastique'],
      focusSeasonId: UNDEAD_UNLUCK_S1_ID,
      selectedSeasonId: null,
      seasons: [
        { id: UNDEAD_UNLUCK_S1_ID, name: 'Saison 1', seasonNumber: 1, episodeCount: 24 },
        { id: WINTER_ARC_SEASON_ID, name: 'Undead Unluck: Winter Arc', seasonNumber: null, episodeCount: 1 },
      ],
    });
  });

  it('aucun champ écarté ne passe (description, images, jetons, suggestions)', () => {
    const json = JSON.stringify(reduced());
    for (const leak of ['Description', 'imageId', 'jeton', 'Summer Time Rendering', 'partnerFeed']) expect(json).not.toContain(leak);
  });

  it('titre localisé différent du titre anglais : titre interne gardé (titre anglais)', () => {
    const page = reduced(undeadUnluckSeriesPage({ title: 'Time Shadows' }));
    expect(page.internalTitle).toMatch(/^Undead Unluck - s1e1 - /);
    expect(page.title).toBe('Time Shadows');
  });

  it('sans titre interne : numéro de saison lu dans `visuals.seasonNumber`, titre interne inconnu', () => {
    const page = reduced(nonAnimeSeriesPage(), '11111111-2222-4333-8444-000000000001');
    expect(page.internalTitle).toBeNull();
    expect(page.genres).toEqual(['Science-fiction', 'Action et aventure']);
    expect(page.seasons[0]?.seasonNumber).toBe(1);
  });

  it('forme inattendue ou identifiant invalide : écartée', () => {
    expect(reduceDisneySeriesPage({ data: {} }, UNDEAD_UNLUCK_ENTITY_ID, SEEN_AT)).toBeNull();
    expect(reduceDisneySeriesPage(null, UNDEAD_UNLUCK_ENTITY_ID, SEEN_AT)).toBeNull();
    expect(reduceDisneySeriesPage(undeadUnluckSeriesPage(), 'x', SEEN_AT)).toBeNull();
    // Page sans conteneur d'épisodes (film) : gardée, sans saison
    expect(reduceDisneySeriesPage({ data: { page: { visuals: { title: 'Suzume' } } } }, UNDEAD_UNLUCK_ENTITY_ID, SEEN_AT)?.seasons).toEqual([]);
  });
});

describe('applyDisneySeason (réponse season/{id})', () => {
  it('arc choisi dans le menu : saison retenue, numéro 99 lu dans le titre interne', () => {
    const page = applyDisneySeason(reduced(), WINTER_ARC_SEASON_ID, winterArcSeasonResponse());
    expect(page?.selectedSeasonId).toBe(WINTER_ARC_SEASON_ID);
    expect(page?.seasons[1]).toEqual({ id: WINTER_ARC_SEASON_ID, name: 'Undead Unluck: Winter Arc', seasonNumber: 99, episodeCount: 1 });
    expect(page?.seasons[0]).toEqual(reduced().seasons[0]);
  });

  it('forme illisible : la saison est quand même retenue comme choisie, rien d’autre ne change', () => {
    const page = applyDisneySeason(reduced(), WINTER_ARC_SEASON_ID, { unexpected: true });
    expect(page).toEqual({ ...reduced(), selectedSeasonId: WINTER_ARC_SEASON_ID });
  });

  it('forme `{ data: { items } }` acceptée ; titre interne complété s’il manquait', () => {
    const { data } = winterArcSeasonResponse() as { data: { season: Record<string, unknown> } };
    const page = applyDisneySeason({ ...reduced(), internalTitle: null }, WINTER_ARC_SEASON_ID, { data: data.season });
    expect(page?.seasons[1]?.seasonNumber).toBe(99);
    expect(page?.internalTitle).toMatch(/^Undead Unluck - s99e1 - /);
  });

  it('saison d’une autre page : null', () => {
    expect(applyDisneySeason(reduced(), '00000000-0000-4000-8000-000000000000', winterArcSeasonResponse())).toBeNull();
  });
});

describe('isDisneySeriesPage et messages', () => {
  const PAGE = reduced();

  it.each<[string, Partial<Record<keyof DisneySeriesPage, unknown>>]>([
    ['entité invalide', { entityId: 'x' }],
    ['entité en majuscules', { entityId: UNDEAD_UNLUCK_ENTITY_ID.toUpperCase() }],
    ['titre vide', { title: '' }],
    ['genre trop long', { genres: ['x'.repeat(61)] }],
    ['saison invalide', { seasons: [{ id: 'x', name: null, seasonNumber: null, episodeCount: null }] }],
    ['numéro de saison négatif', { seasons: [{ id: UNDEAD_UNLUCK_S1_ID, name: null, seasonNumber: -1, episodeCount: null }] }],
    ['saison choisie invalide', { selectedSeasonId: 'x' }],
  ])('%s : refusée', (_label, patch) => {
    expect(isDisneySeriesPage(PAGE)).toBe(true);
    expect(isDisneySeriesPage({ ...PAGE, ...patch })).toBe(false);
  });

  it('pages poussées avec les fiches : revalidées une à une, bornées', () => {
    const V = DISNEY_BRIDGE_VERSION;
    expect(decodeDisneyPush(encodeDisneyPush({ v: V, entries: [], pages: [PAGE] }))).toEqual({ v: V, entries: [], pages: [PAGE] });
    expect(decodeDisneyPush(JSON.stringify({ v: V, entries: [], pages: [PAGE, { ...PAGE, title: '' }] }))?.pages).toEqual([PAGE]);
    expect(decodeDisneyPush(JSON.stringify({ v: V, entries: [], pages: Array.from({ length: DISNEY_MAX_PAGES + 1 }, () => PAGE) }))).toBeNull();
    expect(decodeDisneyPush(JSON.stringify({ v: V, entries: [], pages: 'x' }))).toBeNull();
  });
});
