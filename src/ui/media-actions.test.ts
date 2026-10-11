import { describe, expect, it } from 'vitest';
import type { PageMediaView, PageSeason } from '../shared/page-media.types';
import { renderSeasonPicker, seasonPickerOptions } from './media-actions';

// Sélecteur de saison de « Sur cette page » (popup) et de « Votre progression » (panneau) : l'avertissement « Saison
// devinée : vérifiez ci-dessous » n'a de sens qu'avec un sélecteur (deux choix au moins).

const season = (id: number, title: string): PageSeason => ({ id, title, format: 'TV', episodes: 12, year: 2024, coverUrl: null, slot: null });

function view(overrides: Partial<PageMediaView> = {}): PageMediaView {
  return {
    media: { mediaId: 21, idMal: 21, title: 'ONE PIECE', coverUrl: null, episodes: null, format: 'TV', year: 1999, airingStatus: 'RELEASING', nextEpisode: null, siteUrl: 'https://anilist.co/anime/21' },
    lists: [],
    confidence: 'uncertain',
    source: 'page',
    seasons: [],
    episodeProgress: null,
    ...overrides,
  };
}

describe('sélecteur de saison et avertissement « Saison devinée »', () => {
  it('un seul choix (One Piece sur Netflix : fiche unique), même incertain : ni sélecteur ni avertissement', () => {
    expect(seasonPickerOptions(view())).toHaveLength(1);
    expect(renderSeasonPicker(view(), false, () => undefined)).toBeNull();
    expect(renderSeasonPicker(view({ seasons: [season(21, 'ONE PIECE')] }), false, () => undefined)).toBeNull();
    expect(renderSeasonPicker(view({ source: 'manual' }), false, () => undefined)).toBeNull();
  });

  it('deux choix ou plus : sélecteur proposé (fiche affichée ajoutée si elle n’en fait pas partie)', () => {
    expect(seasonPickerOptions(view({ seasons: [season(178533, 'Ranma 1/2 (2024)')] })).map((s) => s.id)).toEqual([21, 178533]);
    expect(seasonPickerOptions(view({ seasons: [season(21, 'ONE PIECE'), season(2, 'Autre')] }))).toHaveLength(2);
  });
});
