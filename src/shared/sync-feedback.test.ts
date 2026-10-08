import { describe, expect, it } from 'vitest';
import { describeOutcome } from './sync-feedback';
import { failedServices, type SyncOutcome } from './sync.types';
import { setLocale } from '../i18n';

// Textes attendus en français
setLocale('fr');

describe('describeOutcome', () => {
  it('résume le résultat de chaque service', () => {
    const outcome: SyncOutcome = {
      status: 'synced',
      mediaTitle: 'Initial D',
      results: [
        { service: 'anilist', outcome: { status: 'updated', progress: 2, completed: false } },
        { service: 'mal', outcome: { status: 'up-to-date', progress: 2 } },
      ],
    };
    expect(describeOutcome(outcome)).toEqual({
      tone: 'success',
      title: 'Initial D',
      message: 'AniList : épisode 2 enregistré · MyAnimeList : déjà à jour (épisode 2)',
    });
  });

  it('signale un échec partiel en erreur', () => {
    const outcome: SyncOutcome = {
      status: 'synced',
      mediaTitle: 'Fairy Tail',
      results: [
        { service: 'anilist', outcome: { status: 'updated', progress: 3, completed: false } },
        { service: 'mal', outcome: { status: 'error', message: 'MyAnimeList est injoignable.' } },
      ],
    };
    const feedback = describeOutcome(outcome);
    expect(feedback.tone).toBe('error');
    expect(feedback.message).toContain('MyAnimeList : échec : MyAnimeList est injoignable.');
    expect(failedServices(outcome)).toEqual(['mal']);
  });

  it('annonce la fin de l’anime et un service ignoré', () => {
    const feedback = describeOutcome({
      status: 'synced',
      mediaTitle: 'Tougen Anki',
      results: [
        { service: 'anilist', outcome: { status: 'updated', progress: 24, completed: true } },
        { service: 'mal', outcome: { status: 'skipped', reason: 'Pas de fiche équivalente' } },
      ],
    });
    expect(feedback).toMatchObject({ tone: 'warning', title: 'Tougen Anki terminé !' });
    expect(feedback.message).toContain('MyAnimeList : pas de fiche équivalente');
  });

  it('ne relance rien hors échec partiel', () => {
    expect(failedServices({ status: 'error', message: 'Réseau' })).toEqual([]);
    expect(failedServices({ status: 'not-connected' })).toEqual([]);
  });
});

describe('describeOutcome — série ignorée', () => {
  it('texte neutre (information), sans relance', () => {
    expect(describeOutcome({ status: 'ignored' })).toEqual({
      tone: 'info',
      title: 'Série ignorée',
      message: 'Aucune fiche AniList n’est liée à ce titre Netflix : ce n’est probablement pas un anime.',
    });
    expect(failedServices({ status: 'ignored' })).toEqual([]);
  });
});
