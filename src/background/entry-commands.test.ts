import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionChangedError } from '../shared/session-epochs';
import type { TrackerId } from '../shared/tracker.types';
import type { TrackerEntry, TrackerService } from './ports/tracker';

// Écriture gardée (runGuarded) : requêtes liées à la session de l'écriture (L2). Le service simulé refuse, comme le
// vrai client d'API, une requête dont la session n'est plus celle du token enregistré.

const sessions = vi.hoisted((): { open: Partial<Record<TrackerId, number>> } => ({ open: {} }));
vi.mock('../browser/storage/sessions', () => ({
  isSessionOpen: async (service: TrackerId, epoch: number | undefined) => epoch !== undefined && sessions.open[service] === epoch,
}));
vi.mock('../browser/storage/tokens', () => ({ isSessionExpired: async () => false }));
vi.stubGlobal('navigator', { locks: { request: <T>(_name: string, task: () => Promise<T>): Promise<T> => task() } });

const reco = vi.hoisted(() => ({ dropSuggestion: vi.fn<(service: string, id: number) => Promise<void>>() }));
vi.mock('./recommendations/messages', () => ({ dropSuggestion: reco.dropSuggestion }));

const { runGuarded } = await import('./entry-commands');

const ENTRY: TrackerEntry = { title: 'Frieren', episodes: 28, entry: { status: 'CURRENT', progress: 5, repeat: 0 }, notes: null };

/** Service simulé : chaque requête relève la session à laquelle elle est liée, refusée si ce n'est plus celle ouverte */
function fakeTracker(): TrackerService & { requests: (number | undefined)[]; writes: number[] } {
  const requests: (number | undefined)[] = [];
  const writes: number[] = [];
  const bound = (session: number | undefined): TrackerService => {
    const check = (): void => {
      requests.push(session);
      if (session !== undefined && sessions.open.mal !== session) throw new SessionChangedError('mal');
    };
    return {
      id: 'mal',
      isConnected: async () => true,
      resolveId: () => 1,
      fullList: async () => [],
      forSession: (epoch) => bound(epoch),
      getEntry: async () => {
        check();
        return ENTRY;
      },
      saveProgress: async (_id, progress, status) => {
        check();
        writes.push(progress);
        return { status, progress };
      },
      saveScore: () => Promise.reject(new Error('hors test')),
      startRewatch: () => Promise.reject(new Error('hors test')),
      saveStatus: () => Promise.reject(new Error('hors test')),
      saveEntry: () => Promise.reject(new Error('hors test')),
      deleteEntry: () => Promise.reject(new Error('hors test')),
      saveNotes: () => Promise.reject(new Error('hors test')),
    };
  };
  return Object.assign(bound(undefined), { requests, writes });
}

beforeEach(() => {
  sessions.open = { mal: 0 };
  reco.dropSuggestion.mockReset();
  reco.dropSuggestion.mockResolvedValue(undefined);
});

describe('runGuarded : requêtes liées à la session de l’écriture (L2)', () => {
  it('lecture et écriture passent par le service lié à la session de l’écriture', async () => {
    const tracker = fakeTracker();
    const result = await runGuarded<number | 'closed'>({ tracker, id: 1 }, {
      epoch: 0,
      sessionClosed: () => 'closed',
      decide: (_current, target) => ({ write: async () => (await target.saveProgress(1, 6, 'CURRENT')).progress }),
    });
    expect(result).toBe(6);
    expect(tracker.requests).toEqual([0, 0]);
  });

  it('autre compte connecté entre la dernière vérification et la requête d’écriture : rien n’est écrit, session fermée', async () => {
    const tracker = fakeTracker();
    const result = await runGuarded({ tracker, id: 1 }, {
      epoch: 0,
      sessionClosed: () => 'closed',
      decide: (_current, target) => ({
        write: async () => {
          // Fenêtre de L2 : déconnexion puis connexion à un autre compte juste avant la lecture du token
          sessions.open = { mal: 1 };
          return String((await target.saveProgress(1, 6, 'CURRENT')).progress);
        },
      }),
    });
    expect(result).toBe('closed');
    expect(tracker.writes).toEqual([]);
  });

  it('session fermée pendant la relecture : session fermée, aucune erreur levée', async () => {
    const tracker = fakeTracker();
    const forSession = tracker.forSession;
    tracker.forSession = (epoch) => {
      const bound = forSession(epoch);
      return {
        ...bound,
        getEntry: (id, lane) => {
          // Déconnexion pendant l'attente du verrou de la fiche
          sessions.open = {};
          return bound.getEntry(id, lane);
        },
      };
    };
    const decide = vi.fn(() => ({ done: 'lu' }));
    expect(await runGuarded({ tracker, id: 1 }, { epoch: 0, sessionClosed: () => 'closed', decide })).toBe('closed');
    expect(decide).not.toHaveBeenCalled();
  });

  it('aucune session relevée : ni lecture ni écriture', async () => {
    const tracker = fakeTracker();
    expect(await runGuarded({ tracker, id: 1 }, { epoch: undefined, sessionClosed: () => 'closed', decide: () => ({ done: 'lu' }) })).toBe('closed');
    expect(tracker.requests).toEqual([]);
  });

  it('autre erreur d’API : levée telle quelle (l’appelant en fait un résultat ou une relance)', async () => {
    const tracker = fakeTracker();
    const failure = new Error('réseau');
    await expect(runGuarded({ tracker, id: 1 }, { epoch: 0, sessionClosed: () => 'closed', decide: () => ({ write: () => Promise.reject(failure) }) })).rejects.toBe(failure);
  });
});

describe('runGuarded : suggestion retirée du lot quand une entrée est créée', () => {
  const write = { epoch: 0, sessionClosed: () => 'closed', decide: (_c: TrackerEntry, target: TrackerService) => ({ write: async () => String((await target.saveProgress(1, 1, 'CURRENT')).progress) }) };

  it('série absente de la liste puis écrite : retirée du lot', async () => {
    const tracker = fakeTracker();
    tracker.forSession = (epoch) => ({ ...fakeTracker(), getEntry: async () => ({ ...ENTRY, entry: null }), saveProgress: async (_id, progress, status) => ({ status, progress }), forSession: () => tracker.forSession(epoch) });
    expect(await runGuarded({ tracker, id: 7 }, write)).toBe('1');
    expect(reco.dropSuggestion).toHaveBeenCalledWith('mal', 7);
  });

  it('entrée déjà dans la liste, ou aucune écriture : lot intact', async () => {
    const tracker = fakeTracker();
    await runGuarded({ tracker, id: 7 }, write);
    await runGuarded({ tracker, id: 7 }, { epoch: 0, sessionClosed: () => 'closed', decide: () => ({ done: 'lu' }) });
    expect(reco.dropSuggestion).not.toHaveBeenCalled();
  });

  it('échec du retrait : l\'écriture reste réussie', async () => {
    reco.dropSuggestion.mockRejectedValue(new Error('stockage'));
    const tracker = fakeTracker();
    tracker.forSession = (epoch) => ({ ...fakeTracker(), getEntry: async () => ({ ...ENTRY, entry: null }), saveProgress: async (_id, progress, status) => ({ status, progress }), forSession: () => tracker.forSession(epoch) });
    expect(await runGuarded({ tracker, id: 7 }, write)).toBe('1');
  });
});
