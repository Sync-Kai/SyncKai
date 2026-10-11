import { beforeEach, describe, expect, it } from 'vitest';
import { installFakeChrome } from '../test/fake-chrome';

// Écritures de la page d'import Crunchyroll (ARCH-18) : sous le verrou du stockage, tâche relue sous ce verrou.

const fake = installFakeChrome();
const { CR_IMPORT_KEYS, startAnalyzeJob } = await import('./cr-import');
const { reduceJob } = await import('./job');
const { dismissCrImportJob, resetCrImport } = await import('./cr-import-store');
const { STORAGE_LOCK } = await import('./storage-lock-core');

const NOW = 1_800_000_000_000;
const running = startAnalyzeJob(3, NOW);
const done = reduceJob(running, { type: 'finish', at: NOW });
const all = { [CR_IMPORT_KEYS.job]: running, [CR_IMPORT_KEYS.plan]: {}, [CR_IMPORT_KEYS.input]: {}, [CR_IMPORT_KEYS.resolutions]: {} };
const storedKeys = (): string[] => [...fake.local.data.keys()].sort();

beforeEach(() => fake.reset());

describe('resetCrImport (« Recommencer »)', () => {
  it('analyse lancée entre-temps (état de la page en retard) : rien n’est effacé', async () => {
    fake.local.seed(all);
    expect(await resetCrImport(NOW + 1_000)).toBe(false);
    expect(storedKeys()).toEqual(Object.keys(all).sort());
    expect(fake.locks.requested).toContain(STORAGE_LOCK);
  });

  it('tâche terminée ou sans signe de vie : aperçu, tâche et données effacés', async () => {
    fake.local.seed({ ...all, [CR_IMPORT_KEYS.job]: done });
    expect(await resetCrImport(NOW + 1_000)).toBe(true);
    expect(storedKeys()).toEqual([]);
    fake.local.seed(all);
    expect(await resetCrImport(NOW + 3_600_000)).toBe(true);
    expect(storedKeys()).toEqual([]);
  });
});

describe('dismissCrImportJob', () => {
  it('ne ferme jamais une tâche en cours, relue sous verrou', async () => {
    fake.local.seed({ [CR_IMPORT_KEYS.job]: running });
    expect(await dismissCrImportJob()).toBe(false);
    expect(storedKeys()).toEqual([CR_IMPORT_KEYS.job]);
    fake.local.seed({ [CR_IMPORT_KEYS.job]: done, [CR_IMPORT_KEYS.plan]: {} });
    expect(await dismissCrImportJob()).toBe(true);
    expect(storedKeys()).toEqual([CR_IMPORT_KEYS.plan]);
  });
});
