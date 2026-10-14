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
  parseCrunchyrollSeasonName,
  parseCrunchyrollSeriesPath,
  parseEpisodeCount,
  parseSeasonOption,
  seasonEpisodeCountFromJsonLd,
  seriesTitleFromJsonLd,
  type WatchPageContext,
} from './crunchyroll';
import { createLabelGuard, flattenJsonLd, LABEL_SETTLE_MS, labelKey, type LabelGuard } from './parsing';

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

  it('saison spéciale sans numéro (« Special », relevé le 2026-10-11 sur « I Got a Cheat Skill… ») : titre de saison seul', () => {
    expect(parseCrunchyrollSeasonLabel('Special')).toEqual({ number: null, title: 'Special' });
    expect(parseCrunchyrollSeasonLabel('SpecialSpecial')).toEqual({ number: null, title: 'Special' });
    expect(parseCrunchyrollSeasonLabel('Specials')).toEqual({ number: null, title: 'Special' });
    expect(parseCrunchyrollSeasonLabel('Spécial')).toEqual({ number: null, title: 'Special' });
    expect(parseCrunchyrollSeasonLabel('Spezial')).toEqual({ number: null, title: 'Special' });
    expect(parseCrunchyrollSeasonLabel('OVA')).toEqual({ number: null, title: 'OVA' });
    expect(parseCrunchyrollSeasonLabel('Movie')).toEqual({ number: null, title: 'Movie' });
    // Autres textes des éléments voisins du menu : jamais une saison
    for (const text of ['Options', 'Newest', 'Special Edition Trailer', 'E1 - The Legendary Dragon—Awakens']) expect(parseCrunchyrollSeasonLabel(text)).toBeNull();
  });

  it('arc de One Piece avec sa plage d’épisodes absolus (relevé le 2026-10-11 : « Elbaph (1156-current) »)', () => {
    expect(parseCrunchyrollSeasonLabel('Elbaph (1156-current)')).toEqual({ number: null, title: 'Elbaph', firstEpisode: 1156 });
    expect(parseCrunchyrollSeasonLabel('Egghead (1086-1155)')).toEqual({ number: null, title: 'Egghead', firstEpisode: 1086 });
    expect(parseCrunchyrollSeasonLabel('Elbaph (1156–actuel)')).toEqual({ number: null, title: 'Elbaph', firstEpisode: 1156 });
    expect(parseCrunchyrollSeasonLabel('Elbaph (1156-aktuell)')).toEqual({ number: null, title: 'Elbaph', firstEpisode: 1156 });
    expect(parseCrunchyrollSeasonLabel('Elbaph (1156-)')).toEqual({ number: null, title: 'Elbaph', firstEpisode: 1156 });
    expect(parseCrunchyrollSeasonLabel('S43: Elbaph (1156-current)')).toEqual({ number: 43, title: 'Elbaph', firstEpisode: 1156 });
    // Parenthèse sans plage d'épisodes : pas un libellé de saison à elle seule
    expect(parseCrunchyrollSeasonLabel('Elbaph (VF)')).toBeNull();
  });

  it('lit le libellé répété du sélecteur réel ("Season 1Season 1")', () => {
    expect(parseCrunchyrollSeasonLabel('Season 1Season 1')).toEqual({ number: 1, title: null });
    expect(parseCrunchyrollSeasonLabel('Season 12Season 12')).toEqual({ number: 12, title: null });
    expect(parseCrunchyrollSeasonLabel('Elbaph (1156-current)Elbaph (1156-current)')).toEqual({ number: null, title: 'Elbaph', firstEpisode: 1156 });
    expect(parseCrunchyrollSeasonLabel('S2: Black CloverS2: Black Clover')).toEqual({ number: 2, title: 'Black Clover' });
  });

  it('rejette un texte qui n’est pas un libellé de saison', () => {
    expect(parseCrunchyrollSeasonLabel('Black Clover')).toBeNull();
    expect(parseCrunchyrollSeasonLabel('Sous-titres')).toBeNull();
    expect(parseCrunchyrollSeasonLabel(null)).toBeNull();
  });
});

describe('parseCrunchyrollSeasonName (bouton du menu des saisons : saison nommée, sans numéro)', () => {
  it('saison nommée seule (« HEROINES » de One Piece, relevé le 2026-10-11) : titre de saison', () => {
    expect(parseCrunchyrollSeasonName('HEROINES')).toBe('HEROINES');
    expect(parseCrunchyrollSeasonName('HEROINESHEROINES')).toBe('HEROINES');
    expect(parseCrunchyrollSeasonName('HEROINES HEROINES')).toBe('HEROINES');
    expect(parseCrunchyrollSeasonName('HEROINES (VF)')).toBe('HEROINES');
    expect(parseCrunchyrollSeasonName('Wano Country')).toBe('Wano Country');
  });

  it('textes des contrôles voisins (tri, options, langue, navigation) : jamais un nom de saison, en FR / EN / DE', () => {
    const noise = [
      'Options', 'Optionen', 'Newest', 'Oldest', 'Plus récents', 'Plus anciens', 'Neueste', 'Älteste', 'Sort by', 'Trier par', 'Sortieren',
      'Sous-titres', 'Subtitles', 'Untertitel', 'Audio', 'Seasons', 'Saisons', 'Staffeln', 'Next Season', 'Saison précédente', 'Nächste Staffel',
      'Show more', 'Afficher plus', 'Mehr anzeigen',
    ];
    for (const text of noise) expect(parseCrunchyrollSeasonName(text), text).toBeNull();
  });

  it('épisode, nombre d’épisodes, numéro seul, texte trop long ou vide : rejetés', () => {
    for (const text of ['E1 - One Piece Heroines', '25 Episodes', '1156', '(VF)', '', null, 'x'.repeat(81)]) expect(parseCrunchyrollSeasonName(text)).toBeNull();
  });
});

describe('crunchyrollAdapter.detectSeries : saison du menu de la page de série', () => {
  const ONE_PIECE = new URL('https://www.crunchyroll.com/fr/series/GRMG8ZQZR/one-piece');
  let page: FakeDocument;

  beforeEach(() => {
    page = installFakeDocument();
    page.set('h1', { text: 'One Piece' });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('saison nommée « HEROINES » sur le bouton du menu : titre de saison, ni numéro ni indice de numérotation absolue', () => {
    page.set('[data-t="seasons-select"]', { text: 'HEROINESHEROINES' });
    const series = crunchyrollAdapter.detectSeries?.(ONE_PIECE);
    expect(series).toMatchObject({ seriesTitle: 'One Piece', seasonNumber: null, seasonTitle: 'HEROINES' });
    expect(series).not.toHaveProperty('seasonFirstEpisode');
  });

  it('menu réel (relevé le 2026-10-11) : div[role="button"] de .erc-seasons-select, libellé affiché deux fois', () => {
    page.set('.erc-seasons-select [role="button"]', { text: 'HEROINESHEROINES' });
    page.set('.season-info', { text: 'HEROINESHEROINES' });
    expect(crunchyrollAdapter.detectSeries?.(ONE_PIECE)).toMatchObject({ seasonNumber: null, seasonTitle: 'HEROINES' });
    page.set('.erc-seasons-select [role="button"]', { text: 'Elbaph (1156-current)Elbaph (1156-current)' });
    expect(crunchyrollAdapter.detectSeries?.(ONE_PIECE)).toMatchObject({ seasonTitle: 'Elbaph', seasonFirstEpisode: 1156 });
  });

  it('Elbaph ↔ HEROINES : la saison retenue change à chaque choix (suivi du menu par le panneau)', () => {
    const season = (): string | null | undefined => crunchyrollAdapter.detectSeries?.(ONE_PIECE)?.seasonTitle;
    page.set('[data-t="seasons-select"]', { text: 'Elbaph (1156-current)' });
    expect(crunchyrollAdapter.detectSeries?.(ONE_PIECE)).toMatchObject({ seasonTitle: 'Elbaph', seasonFirstEpisode: 1156 });
    page.set('[data-t="seasons-select"]', { text: 'HEROINES' });
    expect(season()).toBe('HEROINES');
    page.set('[data-t="seasons-select"]', { text: 'Egghead (1086-1155)' });
    expect(season()).toBe('Egghead');
  });

  it('nom seul lu uniquement sur le bouton du menu, jamais sur un conteneur ni sur un contrôle voisin', () => {
    // Conteneur du menu : seuls les libellés reconnus (numéro, plage, spécial) y sont lus
    page.set('[data-t="seasons-dropdown"]', { text: 'HEROINES' });
    expect(crunchyrollAdapter.detectSeries?.(ONE_PIECE)).toMatchObject({ seasonNumber: null, seasonTitle: null });
    page.set('.season-info', { text: 'Options' });
    expect(crunchyrollAdapter.detectSeries?.(ONE_PIECE)).toMatchObject({ seasonNumber: null, seasonTitle: null });
    // Bouton au texte de tri : ignoré, le libellé reconnu d'un sélecteur suivant reste lu
    page.set('.seasons-select button', { text: 'Newest' });
    page.set('.seasons-select', { text: 'S2: Black Clover' });
    expect(crunchyrollAdapter.detectSeries?.(ONE_PIECE)).toMatchObject({ seasonNumber: 2, seasonTitle: 'Black Clover' });
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
  const afterE1180 = (now?: () => number): LabelGuard => {
    const guard = createLabelGuard(now);
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

  it('<h1> d’accord mais libellé d’un autre épisode : refusé juste après le changement d’URL (rendu en retard), accepté ensuite (version audio)', () => {
    let now = 0;
    const context = { heading: ONE_PIECE_E1180.heading, guard: afterE1180(() => now) };
    // Lecture automatique : URL d'un autre épisode, <h1> et JSON-LD encore ceux de E1180 → rien plutôt que le numéro 1180
    expect(episodeFromJsonLdNodes(nodesOf(ONE_PIECE_E1180), 'GRDUB0001180', context)).toBeNull();
    now = LABEL_SETTLE_MS - 1;
    expect(episodeFromJsonLdNodes(nodesOf(ONE_PIECE_E1180), 'GRDUB0001180', context)).toBeNull();
    // Libellé toujours le même passé le délai : autre version audio du même épisode, reconnue avec ses numéros
    now = LABEL_SETTLE_MS;
    expect(episodeFromJsonLdNodes(nodesOf(ONE_PIECE_E1180), 'GRDUB0001180', context)).toMatchObject({ seasonEpisodeNumber: 25, displayedEpisodeNumber: 1180 });
    // Épisode qui possède déjà ce libellé : jamais retardé
    expect(episodeFromJsonLdNodes(nodesOf(ONE_PIECE_E1180), ONE_PIECE_E1180.episodeId, context)?.displayedEpisodeNumber).toBe(1180);
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

  it('URL changée avant le rendu (<h1> et JSON-LD encore ceux de E1180) : rien, puis E1181 une fois rendu', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      show(ONE_PIECE_E1180);
      expect(extract(ONE_PIECE_E1180)).toMatchObject({ displayedEpisodeNumber: 1180 });
      expect(extract(ONE_PIECE_E1181)).toBeNull();
      vi.advanceTimersByTime(LABEL_SETTLE_MS / 2);
      expect(extract(ONE_PIECE_E1181)).toBeNull();
      show(ONE_PIECE_E1181);
      expect(extract(ONE_PIECE_E1181)).toMatchObject({ episodeId: ONE_PIECE_E1181.episodeId, seasonEpisodeNumber: 26, displayedEpisodeNumber: 1181 });
    } finally {
      vi.useRealTimers();
    }
  });
});
