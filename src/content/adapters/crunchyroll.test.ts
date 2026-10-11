import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EpisodeInfo } from '../../shared/episode.types';
import { installFakeDocument, type FakeDocument } from '../../test/fake-document';
import { ONE_PIECE_E1180, ONE_PIECE_E1180_WITH_URL, ONE_PIECE_E1181, type CrunchyrollWatchFixture } from './__fixtures__/crunchyroll-watch';
import type { StreamingAdapter } from './adapter';
import {
  crunchyrollAdapter,
  episodeFromJsonLdNodes,
  episodeFromWatchDom,
  parseEpisodeLabel,
  parseCrunchyrollSeasonLabel,
  parseCrunchyrollSeriesPath,
  parseEpisodeCount,
  parseSeasonOption,
  seasonEpisodeCountFromJsonLd,
  seriesTitleFromJsonLd,
  type WatchPageContext,
} from './crunchyroll';
import { createLabelGuard, flattenJsonLd, labelKey, type LabelGuard } from './parsing';

// Fixture JSON-LD d'une page de série (structure supposée, à vérifier sur le site réel)
const SERIES_JSON_LD = `{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "name": "Crunchyroll" },
    { "@type": "TVSeries", "name": "Black Clover", "url": "https://www.crunchyroll.com/fr/series/GRVN8MNQY/black-clover",
      "containsSeason": [{ "@type": "TVSeason", "name": "Black Clover", "seasonNumber": 1 }] }
  ]
}`;

describe('parseCrunchyrollSeriesPath', () => {
  it('reconnaît une page de série, avec ou sans préfixe de langue ni slug', () => {
    expect(parseCrunchyrollSeriesPath('/series/GRVN8MNQY/black-clover')).toEqual({ seriesId: 'GRVN8MNQY', seriesSlug: 'black-clover' });
    expect(parseCrunchyrollSeriesPath('/fr/series/GRVN8MNQY/black-clover/')).toEqual({ seriesId: 'GRVN8MNQY', seriesSlug: 'black-clover' });
    expect(parseCrunchyrollSeriesPath('/pt-br/series/GRVN8MNQY')).toEqual({ seriesId: 'GRVN8MNQY', seriesSlug: null });
  });

  it('ignore les pages de lecture et le reste du site', () => {
    expect(parseCrunchyrollSeriesPath('/fr/watch/GE00376431JAJP/titre')).toBeNull();
    expect(parseCrunchyrollSeriesPath('/fr/series/GRVN8MNQY/black-clover/videos/extra')).toBeNull();
    expect(parseCrunchyrollSeriesPath('/fr/simulcasts')).toBeNull();
  });

  it('l’adapter distingue page de série et page d’épisode', () => {
    expect(crunchyrollAdapter.getEpisodeId(new URL('https://www.crunchyroll.com/fr/series/GRVN8MNQY/black-clover'))).toBeNull();
  });
});

describe('parseCrunchyrollSeasonLabel', () => {
  it('lit le libellé du sélecteur de saison', () => {
    expect(parseCrunchyrollSeasonLabel('S2: Black Clover')).toEqual({ number: 2, title: 'Black Clover' });
    expect(parseCrunchyrollSeasonLabel('S24 : Elbaph (VF)')).toEqual({ number: 24, title: 'Elbaph' });
    expect(parseCrunchyrollSeasonLabel('S1: Frieren (English Dub)')).toEqual({ number: 1, title: 'Frieren' });
  });

  it('accepte les libellés génériques', () => {
    expect(parseCrunchyrollSeasonLabel('Saison 3')).toEqual({ number: 3, title: null });
    expect(parseCrunchyrollSeasonLabel('Staffel 2')).toEqual({ number: 2, title: null });
  });

  it('lit le libellé répété du sélecteur réel ("Season 1Season 1")', () => {
    expect(parseCrunchyrollSeasonLabel('Season 1Season 1')).toEqual({ number: 1, title: null });
    expect(parseCrunchyrollSeasonLabel('Season 12Season 12')).toEqual({ number: 12, title: null });
  });

  it('rejette un texte qui n’est pas un libellé de saison', () => {
    expect(parseCrunchyrollSeasonLabel('Black Clover')).toBeNull();
    expect(parseCrunchyrollSeasonLabel('Sous-titres')).toBeNull();
    expect(parseCrunchyrollSeasonLabel(null)).toBeNull();
  });
});

describe('nombre d’épisodes de la saison (menu des saisons, JSON-LD)', () => {
  it('parseEpisodeCount : libellés usuels', () => {
    expect(parseEpisodeCount('25 Episodes')).toBe(25);
    expect(parseEpisodeCount('24 épisodes')).toBe(24);
    expect(parseEpisodeCount('12 Folgen')).toBe(12);
    expect(parseEpisodeCount('1 Episode')).toBe(1);
    expect(parseEpisodeCount('Season 2')).toBeNull();
    expect(parseEpisodeCount(null)).toBeNull();
  });

  it('parseSeasonOption : entrée en éléments séparés ou texte unique', () => {
    expect(parseSeasonOption(['Season 2', '25 Episodes'])).toEqual({ number: 2, episodes: 25 });
    expect(parseSeasonOption(['S2: Mushoku Tensei', '25 épisodes'])).toEqual({ number: 2, episodes: 25 });
    expect(parseSeasonOption(['Season 1 · 24 Episodes'])).toEqual({ number: 1, episodes: 24 });
    expect(parseSeasonOption(['Season 3 / 14 Episodes'])).toEqual({ number: 3, episodes: 14 });
    expect(parseSeasonOption(['Season 3'])).toEqual({ number: 3, episodes: null });
    expect(parseSeasonOption(['25 Episodes'])).toBeNull();
  });

  it('seasonEpisodeCountFromJsonLd : TVSeries.containsSeason[].numberOfEpisodes', () => {
    const nodes = [{ '@type': 'TVSeries', containsSeason: [{ seasonNumber: 1, numberOfEpisodes: 24 }, { seasonNumber: 2, numberOfEpisodes: '25' }] }];
    expect(seasonEpisodeCountFromJsonLd(nodes, 2)).toBe(25);
    expect(seasonEpisodeCountFromJsonLd(nodes, 3)).toBeNull();
    expect(seasonEpisodeCountFromJsonLd(flattenJsonLd(JSON.parse(SERIES_JSON_LD)), 1)).toBeNull();
  });
});

describe('seriesTitleFromJsonLd', () => {
  const nodes = flattenJsonLd(JSON.parse(SERIES_JSON_LD));

  it('lit le nom de la série (TVSeries)', () => {
    expect(seriesTitleFromJsonLd(nodes, 'GRVN8MNQY')).toBe('Black Clover');
  });

  it('retire le « Watch » du nom réel (page TOUGEN ANKI, 2026-10-05)', () => {
    const real = flattenJsonLd({
      '@type': 'TVSeries',
      '@id': 'https://www.crunchyroll.com/series/GP5HJ84D2/tougen-anki',
      url: 'https://www.crunchyroll.com/series/GP5HJ84D2/tougen-anki',
      name: 'Watch TOUGEN ANKI',
    });
    expect(seriesTitleFromJsonLd(real, 'GP5HJ84D2')).toBe('TOUGEN ANKI');
  });

  it('ignore le JSON-LD d’une autre série (navigation SPA)', () => {
    expect(seriesTitleFromJsonLd(nodes, 'GRMG8ZQZR')).toBeNull();
  });

  it('accepte un nœud sans URL', () => {
    expect(seriesTitleFromJsonLd([{ '@type': 'TVSeries', name: 'Frieren' }], 'ANY')).toBe('Frieren');
  });
});

// ─── Page de lecture (TEST-04, CONT-04) ─────────────────────────────────────

const nodesOf = (fixture: CrunchyrollWatchFixture): Record<string, unknown>[] => flattenJsonLd(JSON.parse(fixture.jsonLd));

describe('parseEpisodeLabel', () => {
  it('lit le <h1> et le nom JSON-LD préfixé de la saison', () => {
    expect(parseEpisodeLabel('E1180 - Le désespoir envahit Elbaph !')).toEqual({ number: 1180, title: 'Le désespoir envahit Elbaph !' });
    expect(parseEpisodeLabel('Elbaph | E1180 - Le désespoir envahit Elbaph !')).toEqual({ number: 1180, title: 'Le désespoir envahit Elbaph !' });
  });

  it('accepte les tirets – et — et un numéro décimal', () => {
    expect(parseEpisodeLabel('E12 – Titre')).toEqual({ number: 12, title: 'Titre' });
    expect(parseEpisodeLabel('Saison | E7.5 — Récapitulatif')).toEqual({ number: 7.5, title: 'Récapitulatif' });
  });

  it('garde le libellé tel quel sans numéro (film)', () => {
    expect(parseEpisodeLabel('ONE PIECE FILM RED')).toEqual({ number: null, title: 'ONE PIECE FILM RED' });
    expect(parseEpisodeLabel(null)).toEqual({ number: null, title: null });
  });
});

describe('getEpisodeId (page de lecture)', () => {
  it('lit l’identifiant avec ou sans préfixe de langue', () => {
    expect(crunchyrollAdapter.getEpisodeId(new URL(ONE_PIECE_E1180.url))).toBe('GE00376431JAJP');
    expect(crunchyrollAdapter.getEpisodeId(new URL('https://www.crunchyroll.com/es-es/watch/GE00376431JAJP/slug'))).toBe('GE00376431JAJP');
    expect(crunchyrollAdapter.getEpisodeId(new URL('https://www.crunchyroll.com/watch/GE00376431JAJP'))).toBe('GE00376431JAJP');
  });
});

describe('episodeFromJsonLdNodes', () => {
  const fresh = (heading: string | null = ONE_PIECE_E1180.heading): WatchPageContext => ({ heading, guard: createLabelGuard() });
  /** Garde-fou ayant déjà vu E1180 sous son propre identifiant */
  const afterE1180 = (): LabelGuard => {
    const guard = createLabelGuard();
    guard.remember(ONE_PIECE_E1180.episodeId, labelKey(1180, 'Le désespoir envahit Elbaph !'));
    return guard;
  };

  it('sépare le numéro relatif à la saison (25) du numéro affiché (1180) : One Piece', () => {
    expect(episodeFromJsonLdNodes(nodesOf(ONE_PIECE_E1180), ONE_PIECE_E1180.episodeId, fresh())).toEqual({
      seriesId: 'GRMG8ZQZR',
      seriesSlug: 'one-piece',
      animeTitle: 'One Piece',
      seasonNumber: 24,
      seasonTitle: 'Elbaph',
      seasonEpisodeNumber: 25,
      displayedEpisodeNumber: 1180,
      episodeTitle: 'Le désespoir envahit Elbaph !',
    });
  });

  it('rejette un nœud sans url resté sur E1180 quand le <h1> annonce E1181', () => {
    expect(episodeFromJsonLdNodes(nodesOf(ONE_PIECE_E1180), ONE_PIECE_E1181.episodeId, fresh(ONE_PIECE_E1181.heading))).toBeNull();
  });

  it('rejette un nœud sans url déjà attribué à un autre épisode tant que le <h1> n’est pas rendu', () => {
    expect(episodeFromJsonLdNodes(nodesOf(ONE_PIECE_E1180), ONE_PIECE_E1181.episodeId, { heading: null, guard: afterE1180() })).toBeNull();
    // Même épisode (rechargement, popup) : accepté
    const same = episodeFromJsonLdNodes(nodesOf(ONE_PIECE_E1180), ONE_PIECE_E1180.episodeId, { heading: null, guard: afterE1180() });
    expect(same?.displayedEpisodeNumber).toBe(1180);
  });

  it('accepte un nœud sans url d’accord avec le <h1> (autre version audio du même épisode)', () => {
    const dub = episodeFromJsonLdNodes(nodesOf(ONE_PIECE_E1180), 'GRDUB0001180', { heading: ONE_PIECE_E1180.heading, guard: afterE1180() });
    expect(dub?.seasonEpisodeNumber).toBe(25);
  });

  it('accepte un nœud sans url quand le <h1> n’affiche pas de numéro', () => {
    expect(episodeFromJsonLdNodes(nodesOf(ONE_PIECE_E1180), ONE_PIECE_E1180.episodeId, fresh('One Piece'))?.displayedEpisodeNumber).toBe(1180);
  });

  it('se fie à l’url du nœud quand elle existe', () => {
    expect(episodeFromJsonLdNodes(nodesOf(ONE_PIECE_E1180_WITH_URL), ONE_PIECE_E1180.episodeId, fresh(ONE_PIECE_E1181.heading))?.displayedEpisodeNumber).toBe(1180);
    expect(episodeFromJsonLdNodes(nodesOf(ONE_PIECE_E1180_WITH_URL), ONE_PIECE_E1181.episodeId, fresh())).toBeNull();
  });

  it('ignore les nœuds d’un autre type ou sans série', () => {
    expect(episodeFromJsonLdNodes([{ '@type': 'Organization', name: 'Crunchyroll' }], 'X', fresh())).toBeNull();
    expect(episodeFromJsonLdNodes([{ '@type': 'TVEpisode', name: 'E1 - Titre', episodeNumber: 1 }], 'X', fresh())).toBeNull();
  });
});

describe('episodeFromWatchDom', () => {
  const dom = { seriesTitle: ' One Piece ', seriesHref: ONE_PIECE_E1181.seriesLink.href, heading: ONE_PIECE_E1181.heading };

  it('lit la série et le numéro affiché, sans numéro relatif', () => {
    expect(episodeFromWatchDom(dom, ONE_PIECE_E1181.episodeId, createLabelGuard())).toEqual({
      seriesId: 'GRMG8ZQZR',
      seriesSlug: 'one-piece',
      animeTitle: 'One Piece',
      seasonNumber: null,
      seasonTitle: null,
      seasonEpisodeNumber: null,
      displayedEpisodeNumber: 1181,
      episodeTitle: 'Titre de l’épisode suivant',
    });
  });

  it('rejette le <h1> d’un autre épisode, une page sans lien vers la série ou sans <h1>', () => {
    const guard = createLabelGuard();
    guard.remember(ONE_PIECE_E1180.episodeId, labelKey(1181, 'Titre de l’épisode suivant'));
    expect(episodeFromWatchDom(dom, ONE_PIECE_E1181.episodeId, guard)).toBeNull();
    expect(episodeFromWatchDom({ ...dom, seriesTitle: null }, ONE_PIECE_E1181.episodeId, createLabelGuard())).toBeNull();
    expect(episodeFromWatchDom({ ...dom, heading: null }, ONE_PIECE_E1181.episodeId, createLabelGuard())).toBeNull();
  });
});

describe('crunchyrollAdapter.extractEpisodeInfo : lecture automatique E1180 → E1181 (SPA)', () => {
  let page: FakeDocument;
  let adapter: StreamingAdapter;

  const show = (fixture: CrunchyrollWatchFixture, parts: { jsonLd?: boolean } = {}): void => {
    if (parts.jsonLd !== false) page.setJsonLd(fixture.jsonLd);
    page.set('h1', { text: fixture.heading });
    page.set('a.show-title-link', { text: fixture.seriesLink.text, href: fixture.seriesLink.href });
  };
  const extract = (fixture: CrunchyrollWatchFixture): EpisodeInfo | null => adapter.extractEpisodeInfo(new URL(fixture.url));

  beforeEach(async () => {
    page = installFakeDocument();
    // Module neuf : le garde-fou des libellés est propre à chaque test
    vi.resetModules();
    ({ crunchyrollAdapter: adapter } = await import('./crunchyroll'));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('n’attribue jamais à E1181 les numéros de E1180', () => {
    show(ONE_PIECE_E1180);
    expect(extract(ONE_PIECE_E1180)).toMatchObject({ episodeId: ONE_PIECE_E1180.episodeId, seasonEpisodeNumber: 25, displayedEpisodeNumber: 1180 });

    // Navigation : JSON-LD inchangé, <h1> en cours de rendu → rien plutôt que l'épisode précédent
    page.set('h1', null);
    expect(extract(ONE_PIECE_E1181)).toBeNull();

    // <h1> à jour, JSON-LD toujours périmé → repli DOM (numéro affiché seul)
    show(ONE_PIECE_E1181, { jsonLd: false });
    expect(extract(ONE_PIECE_E1181)).toMatchObject({ episodeId: ONE_PIECE_E1181.episodeId, seasonEpisodeNumber: null, displayedEpisodeNumber: 1181 });

    // JSON-LD à jour → numéros complets
    show(ONE_PIECE_E1181);
    expect(extract(ONE_PIECE_E1181)).toMatchObject({ seasonNumber: 24, seasonEpisodeNumber: 26, displayedEpisodeNumber: 1181 });
  });
});
