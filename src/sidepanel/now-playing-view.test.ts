import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import type { PageMediaInfo } from '../shared/page-media.types';
import { PANEL_RELATION_TYPES } from '../shared/panel-media.types';
import { airedLabel, episodeLine, isPartialEpisodePage, pageKey, relationLabel, shouldRedetect } from './now-playing-view';
import { pageMediaFromEpisode } from '../shared/page-media';
import type { EpisodeInfo } from '../shared/episode.types';

// Régression : Black Butler -Public School Arc- E1 (GJWU2W1N5). Lu avant le JSON-LD (repli DOM, sans saison),
// le panneau devinait « Kuroshitsuji » (2008) alors que la synchro et le popup retenaient « Kishuku Gakkou-hen ».
const complete: EpisodeInfo = {
  platform: 'crunchyroll',
  episodeId: 'GJWU2W1N5',
  seriesId: 'GRDKJZ81Y',
  seriesSlug: 'black-butler',
  animeTitle: 'Black Butler',
  seasonNumber: 5,
  seasonTitle: 'Black Butler -Public School Arc-',
  seasonEpisodeNumber: 1,
  displayedEpisodeNumber: 1,
  episodeTitle: 'His Butler, at School',
  url: 'https://www.crunchyroll.com/watch/GJWU2W1N5/his-butler-at-school',
};
const fromDom: EpisodeInfo = { ...complete, seasonNumber: null, seasonTitle: null, seasonEpisodeNumber: null };

describe('fiche du panneau : lecture partielle et suivi en direct', () => {
  it('reconnaît une page de lecture lue sans ses données structurées', () => {
    expect(isPartialEpisodePage(pageMediaFromEpisode(fromDom))).toBe(true);
    expect(isPartialEpisodePage(pageMediaFromEpisode(complete))).toBe(false);
    // Une seule donnée de saison suffit (ADN : numéro relatif sans titre de saison)
    expect(isPartialEpisodePage(pageMediaFromEpisode({ ...fromDom, seasonEpisodeNumber: 1 }))).toBe(false);
  });

  it('la page complète change la clé : la fiche est recalculée', () => {
    expect(pageKey(pageMediaFromEpisode(fromDom))).not.toBe(pageKey(pageMediaFromEpisode(complete)));
  });

  it('synchro terminée : page relue (la fiche arrive par le cache de l’onglet)', () => {
    expect(shouldRedetect(pageMediaFromEpisode(complete), { type: 'synced' })).toBe(true);
    expect(shouldRedetect(pageMediaFromEpisode(fromDom), { type: 'synced' })).toBe(true);
  });

  it('épisode annoncé par la page : relu s’il diffère ou si la fiche vient d’une lecture partielle', () => {
    expect(shouldRedetect(pageMediaFromEpisode(complete), { type: 'page', episodeId: 'GJWU2W1N5' })).toBe(false);
    expect(shouldRedetect(pageMediaFromEpisode(fromDom), { type: 'page', episodeId: 'GJWU2W1N5' })).toBe(true);
    expect(shouldRedetect(pageMediaFromEpisode(complete), { type: 'page', episodeId: 'GOTHER' })).toBe(true);
    expect(shouldRedetect(null, { type: 'page', episodeId: 'GJWU2W1N5' })).toBe(true);
    expect(shouldRedetect(pageMediaFromEpisode(complete), { type: 'page', episodeId: null })).toBe(false);
  });
});
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
