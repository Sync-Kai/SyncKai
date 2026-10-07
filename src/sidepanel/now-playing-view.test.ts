import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import type { PageMediaInfo } from '../shared/page-media.types';
import { PANEL_RELATION_TYPES } from '../shared/panel-media.types';
import { airedLabel, episodeLine, pageKey, relationLabel } from './now-playing-view';

describe('onglet « En lecture »', () => {
  it('libellé de chaque relation, dans chaque langue', () => {
    setLocale('fr');
    expect(PANEL_RELATION_TYPES.map(relationLabel)).toEqual(['Préquelle', 'Suite', 'Histoire principale', 'Histoire parallèle', 'Spin-off']);
    setLocale('en');
    expect(relationLabel('SEQUEL')).toBe('Sequel');
    setLocale('de');
    expect(relationLabel('PREQUEL')).toBe('Vorgeschichte');
    setLocale('fr');
  });

  it('saison de diffusion', () => {
    setLocale('fr');
    expect(airedLabel({ season: 'SPRING', seasonYear: 2023 })).toBe('Printemps 2023');
    expect(airedLabel({ season: null, seasonYear: 2023 })).toBe('2023');
    expect(airedLabel({ season: 'FALL', seasonYear: null })).toBeNull();
  });

  it('épisode de la page (relatif à la fiche AniList)', () => {
    setLocale('fr');
    expect(episodeLine(5, 12)).toBe('Épisode 5 / 12');
    expect(episodeLine(1180, null)).toBe('Épisode 1180');
    expect(episodeLine(null, 12)).toBeNull();
  });

  it('clé de page : change avec l’épisode, pas avec le reste', () => {
    const page: PageMediaInfo = {
      platform: 'crunchyroll',
      kind: 'series',
      seriesId: 'G1',
      seriesSlug: 'slug',
      seriesTitle: 'Titre',
      seasonNumber: 2,
      seasonTitle: null,
      seasonEpisodeCount: 12,
      episode: null,
    };
    expect(pageKey(page)).toBe(pageKey({ ...page, seasonEpisodeCount: 13 }));
    expect(pageKey(page)).not.toBe(pageKey({ ...page, seasonNumber: 3 }));
  });
});
