import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamingPlatform } from '../platforms/registry';
import { createPlatformAccessStore, requestPlatformAccessFromClick } from './platform-access-store';

// Store des accès optionnels (4-D6, 4-R2) : une lecture de chrome.permissions par page, une seule paire d'écouteurs,
// la lecture la plus récente l'emporte même si une plus ancienne répond après elle.

const NETFLIX = 'https://*.netflix.com/*';
const PRIME = 'https://*.primevideo.com/*';

interface Deferred {
  origins: readonly string[];
  resolve: (granted: boolean) => void;
}

const fake = {
  granted: new Set<string>(),
  /** Réponses de contains retenues jusqu'à `resolve` (courses) ; sinon réponse immédiate */
  hold: false,
  held: [] as Deferred[],
  added: [] as (() => void)[],
  removed: [] as (() => void)[],
  request: vi.fn<(query: { origins: string[] }) => Promise<boolean>>(),
};

const fire = (): void => {
  for (const listener of [...fake.added]) listener();
};

beforeEach(() => {
  fake.granted = new Set();
  fake.hold = false;
  fake.held = [];
  fake.added = [];
  fake.removed = [];
  fake.request.mockReset();
  vi.stubGlobal('chrome', {
    permissions: {
      contains: ({ origins }: { origins: string[] }) => {
        if (!fake.hold) return Promise.resolve(origins.every((origin) => fake.granted.has(origin)));
        return new Promise<boolean>((resolve) => fake.held.push({ origins, resolve }));
      },
      request: (query: { origins: string[] }) => fake.request(query),
      onAdded: {
        addListener: (listener: () => void) => void fake.added.push(listener),
        removeListener: (listener: () => void) => void fake.added.splice(fake.added.indexOf(listener), 1),
      },
      onRemoved: {
        addListener: (listener: () => void) => void fake.removed.push(listener),
        removeListener: (listener: () => void) => void fake.removed.splice(fake.removed.indexOf(listener), 1),
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Répond aux lectures retenues d'une lecture (une par plateforme optionnelle) selon `granted` */
function answerHeld(reads: Deferred[], granted: readonly string[]): void {
  for (const read of reads) read.resolve(read.origins.every((origin) => granted.includes(origin)));
}

describe('createPlatformAccessStore', () => {
  it('lit les accès à la création : undefined puis la liste accordée', async () => {
    fake.granted.add(PRIME);
    const access = createPlatformAccessStore();
    expect(access.get()).toBeUndefined();
    expect(await access.read()).toEqual(['prime']);
    expect(access.get()).toEqual(['prime']);
  });

  it('une seule paire d’écouteurs par store, quel que soit le nombre d’abonnés', () => {
    const access = createPlatformAccessStore();
    access.subscribe(() => undefined);
    access.onPermissionsChange(() => undefined);
    access.onPermissionsChange(() => undefined);
    expect(fake.added).toHaveLength(1);
    expect(fake.removed).toHaveLength(1);
  });

  it('permission changée : liste relue, abonnés prévenus seulement si elle change, rappels d’événement toujours', async () => {
    const access = createPlatformAccessStore();
    await access.read();
    const seen: (readonly StreamingPlatform[] | undefined)[] = [];
    access.subscribe((granted) => seen.push(granted));
    const events = vi.fn();
    access.onPermissionsChange(events);

    fake.granted.add(NETFLIX);
    fire();
    await settle();
    expect(seen).toEqual([[], ['netflix']]);
    // Autre permission (accès aux sites sous Firefox) : rappel, liste inchangée
    fire();
    await settle();
    expect(events).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([[], ['netflix']]);
  });

  it('4-R2 : deux relectures concurrentes, la plus ancienne répond en dernier : la plus récente l’emporte', async () => {
    const access = createPlatformAccessStore();
    await access.read();
    fake.hold = true;
    // Accès accordé puis retiré aussitôt : la première relecture voit Netflix, la seconde plus rien
    fire();
    const first = fake.held.splice(0);
    fire();
    const second = fake.held.splice(0);
    answerHeld(second, []);
    await settle();
    answerHeld(first, [NETFLIX]);
    await settle();
    expect(access.get()).toEqual([]);
  });

  it('read() attend la relecture en cours (événement reçu, réponse pas encore là)', async () => {
    fake.granted.add(NETFLIX);
    const access = createPlatformAccessStore();
    await access.read();
    fake.hold = true;
    fire();
    let answered: readonly StreamingPlatform[] | null = null;
    void access.read().then((granted) => (answered = granted));
    await settle();
    expect(answered).toBeNull();
    answerHeld(fake.held.splice(0), []);
    await settle();
    expect(answered).toEqual([]);
    expect(await access.has('netflix')).toBe(false);
    expect(await access.has('crunchyroll')).toBe(true);
  });

  it('dispose : écouteurs retirés, plus aucun rappel', async () => {
    const access = createPlatformAccessStore();
    const events = vi.fn();
    access.onPermissionsChange(events);
    access.dispose();
    expect(fake.added).toHaveLength(0);
    expect(fake.removed).toHaveLength(0);
    await settle();
    expect(events).not.toHaveBeenCalled();
  });
});

describe('requestPlatformAccessFromClick', () => {
  it('permissions.request appelé sans attendre (geste utilisateur), puis accès relus avant la réponse', async () => {
    const access = createPlatformAccessStore();
    await access.read();
    fake.request.mockImplementation(() => {
      fake.granted.add(NETFLIX);
      return Promise.resolve(true);
    });
    const pending = requestPlatformAccessFromClick('netflix', access);
    // Synchrone : aucun await ne précède la demande
    expect(fake.request).toHaveBeenCalledWith({ origins: [NETFLIX] });
    expect(await pending).toBe(true);
    expect(access.get()).toEqual(['netflix']);
  });

  it('demande refusée : false, liste relue inchangée', async () => {
    const access = createPlatformAccessStore();
    await access.read();
    fake.request.mockResolvedValue(false);
    expect(await requestPlatformAccessFromClick('prime', access)).toBe(false);
    expect(access.get()).toEqual([]);
  });

  it('demande en échec : erreur transmise à l’appelant', async () => {
    const access = createPlatformAccessStore();
    fake.request.mockRejectedValue(new Error('pas de geste'));
    await expect(requestPlatformAccessFromClick('disney', access)).rejects.toThrow('pas de geste');
  });
});
