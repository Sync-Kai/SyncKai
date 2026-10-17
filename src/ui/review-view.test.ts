import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import type { EpisodeInfo } from '../shared/episode.types';
import type { CandidateSummary, PendingReview } from '../shared/review.types';
import { candidateMeta, checkProgress, defaultCandidate, defaultProgress, deferredNote, freshResults, previousNote, reviewEpisodeLabel, reviewOrder } from './review-view';

// Textes attendus en français
setLocale('fr');

const EPISODE: EpisodeInfo = {
  platform: 'netflix',
  episodeId: 'e30',
  seriesId: 'mushoku',
  seriesSlug: null,
  animeTitle: 'Mushoku Tensei',
  seasonNumber: 2,
  seasonTitle: null,
  seasonEpisodeNumber: 5,
  displayedEpisodeNumber: 30,
  episodeTitle: null,
  url: 'https://www.netflix.com/watch/1',
};

const II: CandidateSummary = { id: 146065, title: 'Mushoku Tensei II', format: 'TV', episodes: 12, year: 2023, coverUrl: null };
const PART2: CandidateSummary = { id: 166873, title: 'Mushoku Tensei II Part 2', format: 'TV', episodes: 12, year: 2024, coverUrl: null };

function review(patch: Partial<PendingReview> = {}): PendingReview {
  return { key: 'netflix:mushoku:s2', episode: EPISODE, reason: 'Titre seul', suggestion: { mediaId: PART2.id, progress: 5 }, candidates: [II, PART2], previous: null, createdAt: 1, ...patch };
}

describe('carte « À vérifier » : textes', () => {
  it('en-tête : saison, épisode, numéro affiché s’il diffère, plateforme', () => {
    expect(reviewEpisodeLabel(review())).toBe('S2 · E5 · (affiché E30) · Netflix');
    expect(reviewEpisodeLabel(review({ episode: { ...EPISODE, displayedEpisodeNumber: 5 } }))).toBe('S2 · E5 · Netflix');
    expect(reviewEpisodeLabel(review({ episode: { ...EPISODE, seasonNumber: null, seasonEpisodeNumber: null, displayedEpisodeNumber: null } }))).toBe('Netflix');
  });

  it('détails d’une fiche : format traduit (TV, ONA… tels quels), épisodes, année ; rien de connu : tiret', () => {
    expect(candidateMeta(II)).toBe('TV · 12 ép. · 2023');
    expect(candidateMeta({ ...II, format: 'MOVIE', episodes: 1, year: 2012 })).toBe('Film · 1 ép. · 2012');
    expect(candidateMeta({ ...II, format: 'SPECIAL', episodes: null, year: null })).toBe('Spécial');
    expect(candidateMeta({ ...II, format: null, episodes: null, year: null })).toBe('—');
  });

  it('mentions d’une correction : épisode mis de côté, ancienne fiche à corriger seulement si la fiche change', () => {
    expect(deferredNote(review())).toBeNull();
    const deferred = { episode: { ...EPISODE, displayedEpisodeNumber: 6 }, epochs: { anilist: 0 } };
    expect(deferredNote(review({ deferred }))).toBe('Épisode 6 en attente, appliqué après ta décision');
    const previous = { mediaId: II.id, title: 'Mushoku Tensei II', progress: 5 };
    expect(previousNote(review({ previous }), PART2.id)).toBe('Pense à corriger « Mushoku Tensei II » sur tes listes (épisode 5 y a été enregistré).');
    expect(previousNote(review({ previous }), II.id)).toBeNull();
    expect(previousNote(review(), PART2.id)).toBeNull();
  });
});

describe('carte « À vérifier » : choix proposés', () => {
  it('fiche cochée : la suggestion, sinon la première, sinon aucune', () => {
    expect(defaultCandidate(review())?.id).toBe(PART2.id);
    expect(defaultCandidate(review({ suggestion: null }))?.id).toBe(II.id);
    expect(defaultCandidate(review({ suggestion: null, candidates: [] }))).toBeNull();
  });

  it('numéro proposé : suggestion, sinon épisode de la saison, sinon numéro affiché, sinon vide', () => {
    expect(defaultProgress(review())).toBe('5');
    expect(defaultProgress(review({ suggestion: null, episode: { ...EPISODE, seasonEpisodeNumber: 4 } }))).toBe('4');
    expect(defaultProgress(review({ suggestion: null, episode: { ...EPISODE, seasonEpisodeNumber: null } }))).toBe('30');
    expect(defaultProgress(review({ suggestion: null, episode: { ...EPISODE, seasonEpisodeNumber: null, displayedEpisodeNumber: null } }))).toBe('');
  });

  it('numéro saisi : entier de 1 au total de la fiche ; total inconnu : pas de maximum', () => {
    expect(checkProgress('5', 12)).toEqual({ ok: true, progress: 5 });
    expect(checkProgress('30', 12)).toEqual({ ok: false, title: 'Épisode invalide', message: 'Entre 1 et 12 pour cette fiche.' });
    expect(checkProgress('0', null)).toEqual({ ok: false, title: 'Épisode invalide', message: 'Entre un numéro supérieur ou égal à 1.' });
    expect(checkProgress('2.5', null).ok).toBe(false);
    expect(checkProgress('', null).ok).toBe(false);
    expect(checkProgress('1180', null)).toEqual({ ok: true, progress: 1180 });
  });

  it('résultats d’une recherche : les fiches déjà proposées sont retirées', () => {
    const egg: CandidateSummary = { ...II, id: 12, title: 'Berserk: The Golden Age Arc I' };
    expect(freshResults(review(), [PART2, egg]).map((c) => c.id)).toEqual([12]);
  });
});

describe('ordre des cartes', () => {
  it('nouvelles vérifications en tête, cartes affichées gardées à leur place', () => {
    expect(reviewOrder([], ['b', 'a'], new Set())).toEqual(['b', 'a']);
    expect(reviewOrder(['b', 'a'], ['c', 'b', 'a'], new Set())).toEqual(['c', 'b', 'a']);
  });

  it('vérification retirée : sa carte part, sauf si elle est occupée (envoi, résultat affiché)', () => {
    expect(reviewOrder(['c', 'b', 'a'], ['c', 'a'], new Set())).toEqual(['c', 'a']);
    expect(reviewOrder(['c', 'b', 'a'], ['c', 'a'], new Set(['b']))).toEqual(['c', 'b', 'a']);
    // Carte fermée puis vérification toujours là : elle reste à sa place
    expect(reviewOrder(['b', 'a'], ['b', 'a'], new Set())).toEqual(['b', 'a']);
  });
});
