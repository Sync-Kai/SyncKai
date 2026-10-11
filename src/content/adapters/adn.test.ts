import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EpisodeInfo } from '../../shared/episode.types';
import { installFakeDocument, type FakeDocument } from '../../test/fake-document';
import { TOUGEN_ANKI_E1, TOUGEN_ANKI_E1_DE, TOUGEN_ANKI_E2, type AdnWatchFixture } from './__fixtures__/adn-watch';
import type { StreamingAdapter } from './adapter';
import {
  adnEpisodeFromJsonLdNodes,
  adnEpisodeFromPlayer,
  adnSeriesTitleFromJsonLd,
  parseAdnEpisodeLabel,
  parseAdnSeriesPath,
  parseAdnWatchPath,
} from './adn';
import { createLabelGuard, flattenJsonLd, labelKey } from './parsing';

describe('parseAdnWatchPath', () => {
  it('extrait série et épisode d’une page de lecture (URL réelle)', () => {
    expect(parseAdnWatchPath('/video/1311-tougen-anki/29344-episode-1')).toEqual({
      seriesId: '1311',
      seriesSlug: 'tougen-anki',
      episodeId: '29344',
    });
  });

  it('accepte un préfixe de langue et un slash final', () => {
    expect(parseAdnWatchPath('/de/video/1311-tougen-anki/29344-folge-1/')?.episodeId).toBe('29344');
  });

  it('ignore les pages de série et le reste du site', () => {
    expect(parseAdnWatchPath('/video/1311-tougen-anki')).toBeNull();
    expect(parseAdnWatchPath('/catalog')).toBeNull();
  });
});

describe('parseAdnEpisodeLabel', () => {
  it('lit le nom JSON-LD avec préfixe de série', () => {
    expect(parseAdnEpisodeLabel('TOUGEN ANKI - Épisode 1 : Sang d’Oni')).toEqual({ number: 1, title: 'Sang d’Oni' });
  });

  it('lit le sous-titre du lecteur', () => {
    expect(parseAdnEpisodeLabel('Épisode 12 : Le retour')).toEqual({ number: 12, title: 'Le retour' });
  });

  it('gère un numéro décimal et un épisode sans titre', () => {
    expect(parseAdnEpisodeLabel('Épisode 12,5')).toEqual({ number: 12.5, title: null });
  });

  it('ne confond pas un tiret dans le titre de la série', () => {
    expect(parseAdnEpisodeLabel('Re:Zero - Starting Life - Épisode 3 : Titre')).toEqual({ number: 3, title: 'Titre' });
  });

  it('conserve le libellé tel quel sans numéro (film, OAV)', () => {
    expect(parseAdnEpisodeLabel('TOUGEN ANKI - Film')).toEqual({ number: null, title: 'TOUGEN ANKI - Film' });
  });
});

describe('parseAdnSeriesPath', () => {
  it('reconnaît une page de série (sans segment d’épisode)', () => {
    expect(parseAdnSeriesPath('/video/1311-tougen-anki')).toEqual({ seriesId: '1311', seriesSlug: 'tougen-anki' });
    expect(parseAdnSeriesPath('/de/video/1311-tougen-anki/')).toEqual({ seriesId: '1311', seriesSlug: 'tougen-anki' });
  });

  it('ignore les pages de lecture et le reste du site', () => {
    expect(parseAdnSeriesPath('/video/1311-tougen-anki/29344-episode-1')).toBeNull();
    expect(parseAdnSeriesPath('/video/tougen-anki')).toBeNull();
    expect(parseAdnSeriesPath('/catalog')).toBeNull();
  });
});

describe('adnSeriesTitleFromJsonLd', () => {
  // Fixture supposée (à vérifier sur le site réel)
  const nodes = flattenJsonLd(JSON.parse('[{ "@type": "TVSeries", "name": "TOUGEN ANKI", "url": "https://animationdigitalnetwork.com/video/1311-tougen-anki" }]'));

  it('lit le nom de la série', () => {
    expect(adnSeriesTitleFromJsonLd(nodes, '1311')).toBe('TOUGEN ANKI');
  });

  it('ignore une autre série', () => {
    expect(adnSeriesTitleFromJsonLd(nodes, '999')).toBeNull();
  });
});

// ─── Page de lecture (TEST-04) ──────────────────────────────────────────────

const nodesOf = (fixture: AdnWatchFixture): Record<string, unknown>[] => flattenJsonLd(JSON.parse(fixture.jsonLd));

describe('adnEpisodeFromJsonLdNodes', () => {
  it('extrait l’épisode de la page de lecture (TOUGEN ANKI E1)', () => {
    expect(adnEpisodeFromJsonLdNodes(nodesOf(TOUGEN_ANKI_E1), TOUGEN_ANKI_E1.episodeId)).toEqual({
      animeTitle: 'TOUGEN ANKI',
      seasonNumber: 1,
      seasonTitle: null, // « Saison 1 » : générique, inutile pour AniList
      seasonEpisodeNumber: 1,
      displayedEpisodeNumber: 1,
      episodeTitle: 'Sang d’Oni',
    });
  });

  it('lit la page allemande (Folge, Staffel)', () => {
    expect(adnEpisodeFromJsonLdNodes(nodesOf(TOUGEN_ANKI_E1_DE), TOUGEN_ANKI_E1_DE.episodeId)).toMatchObject({
      seasonTitle: null,
      displayedEpisodeNumber: 1,
      episodeTitle: 'Oni-Blut',
    });
  });

  it('ignore le JSON-LD de l’épisode précédent (navigation SPA)', () => {
    expect(adnEpisodeFromJsonLdNodes(nodesOf(TOUGEN_ANKI_E1), TOUGEN_ANKI_E2.episodeId)).toBeNull();
    expect(adnEpisodeFromJsonLdNodes(nodesOf(TOUGEN_ANKI_E2), TOUGEN_ANKI_E2.episodeId)?.displayedEpisodeNumber).toBe(2);
  });

  it('ne confond pas un identifiant préfixe d’un autre (2934 ≠ 29344)', () => {
    expect(adnEpisodeFromJsonLdNodes(nodesOf(TOUGEN_ANKI_E1), '2934')).toBeNull();
  });
});

describe('adnEpisodeFromPlayer', () => {
  it('lit la surcouche du lecteur (sans saison ni numéro relatif)', () => {
    expect(adnEpisodeFromPlayer(TOUGEN_ANKI_E2.player, TOUGEN_ANKI_E2.episodeId, createLabelGuard())).toEqual({
      animeTitle: 'TOUGEN ANKI',
      seasonNumber: null,
      seasonTitle: null,
      seasonEpisodeNumber: null,
      displayedEpisodeNumber: 2,
      episodeTitle: 'Titre de l’épisode suivant',
    });
  });

  it('rejette la surcouche de l’épisode précédent', () => {
    const guard = createLabelGuard();
    guard.remember(TOUGEN_ANKI_E1.episodeId, labelKey(1, 'Sang d’Oni'));
    expect(adnEpisodeFromPlayer(TOUGEN_ANKI_E1.player, TOUGEN_ANKI_E2.episodeId, guard)).toBeNull();
    expect(adnEpisodeFromPlayer({ seriesTitle: null, subtitle: 'Épisode 2' }, TOUGEN_ANKI_E2.episodeId, createLabelGuard())).toBeNull();
  });
});

describe('adnAdapter.extractEpisodeInfo : épisode 1 → épisode 2 (SPA)', () => {
  let page: FakeDocument;
  let adapter: StreamingAdapter;

  const show = (fixture: AdnWatchFixture, parts: { jsonLd?: boolean } = {}): void => {
    page.setJsonLd(...(parts.jsonLd === false ? [] : [fixture.jsonLd]));
    page.set('.vjs-meta-title', { text: fixture.player.seriesTitle });
    page.set('.vjs-meta-subtitle', { text: fixture.player.subtitle });
  };
  const extract = (fixture: AdnWatchFixture): EpisodeInfo | null => adapter.extractEpisodeInfo(new URL(fixture.url));

  beforeEach(async () => {
    page = installFakeDocument();
    vi.resetModules();
    ({ adnAdapter: adapter } = await import('./adn'));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('identifie chaque épisode avec ses identifiants d’URL, sans reprendre le précédent', () => {
    show(TOUGEN_ANKI_E1);
    expect(extract(TOUGEN_ANKI_E1)).toEqual({
      platform: 'adn',
      episodeId: '29344',
      seriesId: '1311',
      seriesSlug: 'tougen-anki',
      url: TOUGEN_ANKI_E1.url,
      animeTitle: 'TOUGEN ANKI',
      seasonNumber: 1,
      seasonTitle: null,
      seasonEpisodeNumber: 1,
      displayedEpisodeNumber: 1,
      episodeTitle: 'Sang d’Oni',
    });

    // Navigation : JSON-LD et surcouche encore ceux de l'épisode 1 → rien
    expect(extract(TOUGEN_ANKI_E2)).toBeNull();

    // Surcouche à jour, JSON-LD absent → repli sur le lecteur
    show(TOUGEN_ANKI_E2, { jsonLd: false });
    expect(extract(TOUGEN_ANKI_E2)).toMatchObject({ episodeId: '29345', seasonEpisodeNumber: null, displayedEpisodeNumber: 2 });

    show(TOUGEN_ANKI_E2);
    expect(extract(TOUGEN_ANKI_E2)).toMatchObject({ episodeId: '29345', seasonEpisodeNumber: 2, displayedEpisodeNumber: 2 });
  });
});
