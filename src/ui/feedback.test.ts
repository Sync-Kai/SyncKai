import { describe, expect, it } from 'vitest';
import { addFeedback, adjustFeedback, notesFeedback, ratingFeedback, removeFeedback, statusFeedback } from './feedback';
import { setLocale } from '../i18n';
import type { SyncOutcome } from '../shared/sync.types';

// Textes attendus en français
setLocale('fr');

describe('ratingFeedback', () => {
  it('succès sur tous les services', () => {
    const result = ratingFeedback({ status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: { status: 'up-to-date', progress: 28 } }] }, '8,5', 'Frieren');
    expect(result.ok).toBe(true);
    expect(result.text).toBe('Note 8,5/10 enregistrée · Frieren');
  });

  it('échec partiel : le service est nommé', () => {
    const result = ratingFeedback(
      {
        status: 'synced',
        mediaTitle: 'Frieren',
        results: [
          { service: 'anilist', outcome: { status: 'updated', progress: 28, completed: true } },
          { service: 'mal', outcome: { status: 'error', message: 'Réseau' } },
        ],
      },
      '3',
      'Frieren',
    );
    expect(result).toMatchObject({ ok: false, tone: 'error', text: 'Échec sur MyAnimeList, réessaie' });
  });

  it('erreur globale : message du service worker', () => {
    expect(ratingFeedback({ status: 'error', message: 'Hors ligne' }, '3', 'Frieren')).toMatchObject({ ok: false, text: 'Hors ligne' });
  });
});

describe('statusFeedback', () => {
  const anilistOk = { service: 'anilist', outcome: { status: 'updated', progress: 12, completed: true } } as const;

  it('succès : phrase selon le statut', () => {
    expect(statusFeedback({ status: 'synced', mediaTitle: 'Frieren', results: [anilistOk] }, 'PAUSED')).toMatchObject({ tone: 'success', text: 'Frieren : en pause' });
    expect(statusFeedback({ status: 'synced', mediaTitle: 'Frieren', results: [anilistOk] }, 'DROPPED')).toMatchObject({ tone: 'success', text: 'Frieren : abandonnée' });
  });

  it('Terminé : mentionne la carte « À noter » créée', () => {
    const media = { mediaId: 1, malId: null, title: 'Frieren' };
    expect(statusFeedback({ status: 'synced', mediaTitle: 'Frieren', results: [anilistOk], prompts: { rate: media } }, 'COMPLETED')).toMatchObject({
      tone: 'success',
      text: 'Frieren : terminée · À noter dans Activité.',
    });
  });

  it('succès partiel : le service en échec est nommé', () => {
    const result = statusFeedback(
      { status: 'synced', mediaTitle: 'Frieren', results: [anilistOk, { service: 'mal', outcome: { status: 'error', message: 'Réseau' } }] },
      'PAUSED',
    );
    expect(result).toMatchObject({ tone: 'warning', text: 'Frieren : en pause · échec MyAnimeList' });
  });

  it('aucune écriture : échec ou rien de modifié', () => {
    expect(statusFeedback({ status: 'synced', mediaTitle: 'F', results: [{ service: 'mal', outcome: { status: 'error', message: 'Réseau' } }] }, 'DROPPED')).toMatchObject({
      tone: 'error',
      text: 'Échec de la mise à jour',
    });
    expect(statusFeedback({ status: 'synced', mediaTitle: 'F', results: [{ service: 'mal', outcome: { status: 'skipped', reason: 'Absente de ta liste' } }] }, 'DROPPED')).toMatchObject({
      tone: 'warning',
      text: 'Rien n’a été modifié',
    });
  });

  it('erreur globale : message affiché', () => {
    expect(statusFeedback({ status: 'error', message: 'Hors ligne' }, 'COMPLETED')).toMatchObject({ tone: 'error', text: 'Hors ligne' });
  });
});

describe('addFeedback', () => {
  it('ajout réussi, partiel ou déjà présent', () => {
    setLocale('fr');
    const updated = { status: 'updated', progress: 0, completed: false } as const;
    const skipped = { status: 'skipped', reason: 'Déjà dans ta liste' } as const;
    expect(addFeedback({ status: 'synced', mediaTitle: 'A', results: [{ service: 'anilist', outcome: updated }] }, 'PLANNING')).toMatchObject({
      tone: 'success',
      text: 'Ajoutée à À regarder',
    });
    expect(
      addFeedback({ status: 'synced', mediaTitle: 'A', results: [{ service: 'anilist', outcome: updated }, { service: 'mal', outcome: { status: 'error', message: 'x' } }] }, 'CURRENT'),
    ).toMatchObject({ tone: 'warning', text: 'Ajoutée à En cours · échec MyAnimeList' });
    expect(addFeedback({ status: 'synced', mediaTitle: 'A', results: [{ service: 'anilist', outcome: skipped }] }, 'PLANNING')).toMatchObject({
      tone: 'info',
      text: 'Déjà dans ta liste',
    });
  });
});

describe('adjustFeedback', () => {
  const anilistOk = { service: 'anilist', outcome: { status: 'updated', progress: 8, completed: false } } as const;
  const malError = { service: 'mal', outcome: { status: 'error', message: 'Réseau' } } as const;
  const malAbsent = { service: 'mal', outcome: { status: 'skipped', reason: 'Absente de ta liste', code: 'not-in-list' } } as const;

  it('service où la série est absente : nommé, rien n’y est écrit', () => {
    expect(adjustFeedback({ status: 'synced', mediaTitle: 'F', results: [anilistOk, malAbsent] }, 1)).toMatchObject({ tone: 'info', text: 'Ép. 8 vu · absente de MyAnimeList' });
    expect(adjustFeedback({ status: 'synced', mediaTitle: 'F', results: [malAbsent] }, 1)).toMatchObject({ tone: 'warning', text: 'Absente de ta liste' });
  });

  it('échec partiel : « Réessayer » porte la progression absolue pour le seul service en échec', () => {
    const feedback = adjustFeedback({ status: 'synced', mediaTitle: 'F', results: [anilistOk, malError] }, 1);
    expect(feedback).toMatchObject({ tone: 'warning', text: 'Ép. 8 vu · échec MyAnimeList', retry: { delta: 1, services: ['mal'], progress: 8 } });
  });

  it('nouvel essai encore en échec : « Réessayer » reproposé, jamais de retour au delta', () => {
    const retry = { delta: 1, services: ['mal'], progress: 8 } as const;
    const again = { delta: 1 as const, services: [...retry.services], progress: retry.progress };
    expect(adjustFeedback({ status: 'synced', mediaTitle: 'F', results: [malError] }, 1, again)).toMatchObject({ tone: 'error', retry: again });
    expect(adjustFeedback({ status: 'error', message: 'Hors ligne' }, 1, again)).toMatchObject({ tone: 'error', retry: again });
    // Succès complet : plus de bouton
    expect(adjustFeedback({ status: 'synced', mediaTitle: 'F', results: [{ service: 'mal', outcome: { status: 'updated', progress: 8, completed: false } }] }, 1, again)).not.toHaveProperty('retry');
  });
});

describe('removeFeedback (« Retirer de la liste »)', () => {
  const removed = { status: 'updated', progress: 0, completed: false } as const;
  const absent = { status: 'skipped', reason: 'Absente de ta liste', code: 'not-in-list' } as const;

  it('retirée : titre nommé ; échec partiel : service nommé', () => {
    expect(removeFeedback({ status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: removed }, { service: 'mal', outcome: absent }] })).toMatchObject({
      tone: 'success',
      text: 'Frieren : retirée de ta liste',
    });
    expect(
      removeFeedback({ status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: removed }, { service: 'mal', outcome: { status: 'error', message: 'Réseau' } }] }),
    ).toMatchObject({ tone: 'warning', text: 'Frieren : retirée de ta liste · échec MyAnimeList' });
  });

  it('rien retiré : erreur du service affichée telle quelle (session expirée, limite), sinon « Absente de ta liste »', () => {
    const expired = { status: 'error', message: 'Session AniList expirée.', code: 'TOKEN_INVALID' } as const;
    expect(removeFeedback({ status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: expired }] })).toMatchObject({
      tone: 'error',
      text: 'AniList : Session AniList expirée.',
    });
    expect(removeFeedback({ status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: absent }] })).toMatchObject({ tone: 'warning', text: 'Absente de ta liste' });
    expect(removeFeedback({ status: 'error', message: 'Service worker injoignable' })).toMatchObject({ tone: 'error', text: 'Service worker injoignable' });
  });
});

describe('notesFeedback (commentaire)', () => {
  it('enregistré ou effacé ; déjà identique compte comme enregistré', () => {
    const synced = (status: 'updated' | 'up-to-date'): SyncOutcome => ({
      status: 'synced',
      mediaTitle: 'Frieren',
      results: [{ service: 'anilist', outcome: status === 'updated' ? { status, progress: 3, completed: false } : { status, progress: 3 } }],
    });
    expect(notesFeedback(synced('updated'), false)).toMatchObject({ tone: 'success', text: 'Commentaire enregistré' });
    expect(notesFeedback(synced('up-to-date'), true)).toMatchObject({ tone: 'success', text: 'Commentaire effacé' });
  });

  it('absente de toutes les listes : rien n’est ajouté ; échec : erreur du service', () => {
    const absent = { status: 'skipped', reason: 'Absente de ta liste', code: 'not-in-list' } as const;
    expect(notesFeedback({ status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'mal', outcome: absent }] }, false)).toMatchObject({
      tone: 'warning',
      text: 'Ajoute la série à ta liste pour la commenter.',
    });
    expect(notesFeedback({ status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'mal', outcome: { status: 'error', message: 'Trop de requêtes.' } }] }, false)).toMatchObject({
      tone: 'error',
      text: 'MyAnimeList : Trop de requêtes.',
    });
  });
});
