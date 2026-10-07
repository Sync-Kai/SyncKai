import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import type { PageListState, PageMediaView } from '../shared/page-media.types';
import { displayScore, hasMissingList, mediaMetaParts, pageBadge, primaryList, seasonOptionLabel, seasonPosition, seasonSlotLabel } from './page-media-view';

// Textes attendus en français
setLocale('fr');

const NOW = Date.UTC(2026, 9, 5, 12);
const DAY = 86_400_000;

function view(lists: PageListState[], patch: Partial<PageMediaView['media']> = {}): PageMediaView {
  return {
    media: {
      mediaId: 2,
      idMal: 20,
      title: 'Série S2',
      coverUrl: null,
      episodes: 12,
      format: 'TV',
      year: 2018,
      airingStatus: 'RELEASING',
      nextEpisode: { episode: 6, airingAt: NOW + 2 * DAY },
      siteUrl: 'https://anilist.co/anime/2',
      ...patch,
    },
    lists,
    confidence: 'certain',
    source: 'page',
    episodeProgress: null,
    seasons: [
      { id: 1, title: 'Série', format: 'TV', episodes: 12, year: 2017, coverUrl: null, slot: { season: 1, part: 1, parts: 1 } },
      { id: 2, title: 'Série S2', format: 'TV', episodes: 12, year: 2018, coverUrl: null, slot: { season: 2, part: 1, parts: 1 } },
    ],
  };
}

const inList = (progress: number, score: number | null = null): PageListState => ({
  service: 'anilist',
  state: 'in-list',
  status: 'CURRENT',
  progress,
  score,
  siteUrl: 'https://anilist.co/anime/2',
});
const malMissing: PageListState = { service: 'mal', state: 'not-in-list', siteUrl: 'https://myanimelist.net/anime/20' };

describe('vue de la carte « Sur cette page »', () => {
  it('liste de référence : premier service où la série est dans la liste', () => {
    expect(primaryList([malMissing, inList(3)])?.progress).toBe(3);
    expect(primaryList([malMissing])).toBeNull();
  });

  it('boutons « Ajouter » dès qu’un service n’a pas la série', () => {
    expect(hasMissingList([inList(3), malMissing])).toBe(true);
    expect(hasMissingList([inList(3), { service: 'mal', state: 'unavailable' }])).toBe(false);
  });

  it('note affichée : première note connue', () => {
    expect(displayScore([inList(3), { ...inList(3, 8.5), service: 'mal' }])).toBe(8.5);
    expect(displayScore([inList(3)])).toBeNull();
  });

  it('pastille : épisode disponible dans la liste, jamais hors liste', () => {
    expect(pageBadge(view([inList(3)]), NOW)).toEqual({ kind: 'available', label: 'Ép. 4 disponible' });
    expect(pageBadge(view([malMissing]), NOW)).toEqual({ kind: 'upcoming', label: 'Ép. 6 dans 2 j' });
    expect(pageBadge(view([malMissing], { airingStatus: 'FINISHED', nextEpisode: null }), NOW).kind).toBe('finished');
  });

  it('position de la saison et ligne d’infos', () => {
    expect(seasonPosition(view([]))).toEqual({ season: 2, part: 1, parts: 1 });
    expect(mediaMetaParts(view([]))).toEqual(['Saison 2', '2018', '12 ép.', 'En diffusion']);
    expect(mediaMetaParts(view([], { format: 'MOVIE', episodes: 1, airingStatus: null }))).toEqual(['Saison 2', 'MOVIE 2018', '1 ép.']);
  });

  it('saison découpée en parties : « Saison 2 · partie 1/2 »', () => {
    const split: PageMediaView = {
      ...view([]),
      seasons: [
        { id: 1, title: 'Mushoku Tensei', format: 'TV', episodes: 11, year: 2021, coverUrl: null, slot: { season: 1, part: 1, parts: 2 } },
        { id: 2, title: 'Mushoku Tensei II', format: 'TV', episodes: 12, year: 2023, coverUrl: null, slot: { season: 2, part: 1, parts: 2 } },
      ],
    };
    expect(mediaMetaParts(split)[0]).toBe('Saison 2 · partie 1/2');
    expect(seasonSlotLabel({ season: 1, part: 2, parts: 2 })).toBe('Saison 1 · partie 2/2');
  });

  it('options du sélecteur : position, titre et année', () => {
    expect(seasonOptionLabel({ title: 'Mushoku Tensei II', year: 2023, slot: { season: 2, part: 1, parts: 2 } })).toBe('Saison 2 · partie 1 — Mushoku Tensei II (2023)');
    expect(seasonOptionLabel({ title: 'Frieren', year: 2023, slot: { season: 1, part: 1, parts: 1 } })).toBe('Saison 1 — Frieren (2023)');
    expect(seasonOptionLabel({ title: 'ONE PIECE HEROINES', year: null, slot: null })).toBe('ONE PIECE HEROINES');
  });

  it('saison unique, fiche hors saisons ou absente du sélecteur : pas de position', () => {
    expect(seasonPosition({ ...view([]), seasons: [] })).toBeNull();
    expect(seasonPosition({ ...view([]), media: { ...view([]).media, mediaId: 99 } })).toBeNull();
    expect(seasonPosition({ ...view([]), seasons: [{ ...view([]).seasons[1], slot: { season: 1, part: 1, parts: 1 } }] })).toBeNull();
    expect(seasonPosition({ ...view([]), seasons: view([]).seasons.map((s) => ({ ...s, slot: null })) })).toBeNull();
  });
});
