import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '../i18n';
import { mediaRefOf } from './media-ref';
import type { SyncOutcome } from '../shared/sync.types';

const worker = vi.hoisted(() => ({ send: vi.fn<(type: string, payload: unknown) => Promise<unknown>>() }));
vi.mock('../protocol/messages', () => ({ sendMessage: (type: string, payload: unknown): Promise<unknown> => worker.send(type, payload) }));

const { callWorker, networkFailure, outcomeFailure } = await import('./worker-call');

setLocale('fr');

beforeEach(() => {
  worker.send.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('callWorker', () => {
  it('réponse du service worker : renvoyée telle quelle, le repli n’est pas appelé', async () => {
    const response: SyncOutcome = { status: 'synced', mediaTitle: 'Frieren', results: [] };
    worker.send.mockResolvedValue(response);
    const unreachable = vi.fn(outcomeFailure);
    expect(await callWorker('RETRY_QUEUED', { id: 'crunchyroll:EP1' }, unreachable)).toBe(response);
    expect(worker.send).toHaveBeenCalledWith('RETRY_QUEUED', { id: 'crunchyroll:EP1' });
    expect(unreachable).not.toHaveBeenCalled();
  });

  it('une réponse d’erreur du service worker n’est pas un échec d’envoi : renvoyée telle quelle', async () => {
    const failed = { ok: false, code: 'NOT_AUTHENTICATED', message: 'Non connecté' };
    worker.send.mockResolvedValue(failed);
    expect(await callWorker('GET_VIEWER', null, networkFailure)).toBe(failed);
  });

  it('service worker injoignable : journalisé, repli construit avec le texte de popup.swUnreachable, jamais d’exception', async () => {
    worker.send.mockRejectedValue(new Error('Could not establish connection. Receiving end does not exist.'));
    expect(await callWorker('GET_VIEWER', null, networkFailure)).toEqual({ ok: false, code: 'NETWORK', message: t('popup.swUnreachable') });
    expect(await callWorker('RETRY_QUEUED', { id: 'x' }, outcomeFailure)).toEqual({ status: 'error', message: t('popup.swUnreachable') });
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it('repli sur mesure : code propre à l’appelant', async () => {
    worker.send.mockRejectedValue(new Error('x'));
    expect(await callWorker('LOGIN_ANILIST', null, (message) => ({ ok: false, code: 'UNKNOWN', message }))).toEqual({ ok: false, code: 'UNKNOWN', message: t('popup.swUnreachable') });
  });
});

describe('mediaRefOf', () => {
  it('identifiants conservés (MAL seul possible), titre borné à 300 caractères', () => {
    expect(mediaRefOf(21, null, 'One Piece')).toEqual({ mediaId: 21, malId: null, title: 'One Piece' });
    expect(mediaRefOf(null, 52991, 'Frieren')).toEqual({ mediaId: null, malId: 52991, title: 'Frieren' });
    expect(mediaRefOf(1, null, 'x'.repeat(500)).title).toHaveLength(300);
  });
});
