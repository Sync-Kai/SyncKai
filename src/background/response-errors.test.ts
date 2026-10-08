import { describe, expect, it } from 'vitest';
import { describeFailedResponse } from './response-errors';

describe('describeFailedResponse', () => {
  it('décrit un SyncOutcome en erreur', () => {
    expect(describeFailedResponse({ status: 'error', code: 'NETWORK', message: 'AniList est injoignable.' })).toBe(
      'NETWORK · AniList est injoignable.',
    );
  });

  it('décrit un Result en échec', () => {
    expect(describeFailedResponse({ ok: false, code: 'API_ERROR', message: 'Erreur' })).toBe('API_ERROR · Erreur');
  });

  it('décrit une vérification des sorties en échec', () => {
    expect(describeFailedResponse({ checkedAt: 1, notified: 0, skipped: null, error: 'Réseau' })).toBe('Réseau');
  });

  it('ignore une série Netflix ignorée (fiche de la page sans objet), pas une fiche introuvable', () => {
    expect(describeFailedResponse({ ok: false, code: 'NOT_TRACKED', message: 'Rien à suivre ici' })).toBeNull();
    expect(describeFailedResponse({ ok: false, code: 'NOT_FOUND', message: 'Aucune fiche' })).toBe('NOT_FOUND · Aucune fiche');
  });

  it('ignore les succès, les échecs partiels et l’annulation par l’utilisateur', () => {
    expect(describeFailedResponse({ ok: true, data: null })).toBeNull();
    expect(describeFailedResponse({ status: 'synced', mediaTitle: 'X', results: [] })).toBeNull();
    expect(describeFailedResponse({ checkedAt: 1, notified: 0, skipped: null, error: null })).toBeNull();
    expect(describeFailedResponse({ ok: false, code: 'USER_CANCELLED', message: 'Annulé' })).toBeNull();
    expect(describeFailedResponse(null)).toBeNull();
  });
});
