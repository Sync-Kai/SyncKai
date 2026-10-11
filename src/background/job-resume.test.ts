import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPARE_JOB_ALARM } from '../shared/compare-job';
import { CR_IMPORT_ALARM } from '../shared/cr-import';
import { FakeEvent, installFakeChrome } from '../test/fake-chrome';

// ARCH-14 : les tâches de fond reprennent après une mise à jour de l'extension (onInstalled), pas seulement au
// démarrage du navigateur ou par leur alarme.

const resume = vi.hoisted(() => ({ compare: vi.fn(async () => undefined), crImport: vi.fn(async () => undefined) }));
vi.mock('./compare', () => ({ resumeCompareJob: resume.compare }));
vi.mock('./cr-import', () => ({ resumeCrImport: resume.crImport }));

const onInstalled = new FakeEvent<[{ reason: string; previousVersion?: string }]>();
const onStartup = new FakeEvent<[]>();
const fake = installFakeChrome({ extra: { runtime: { id: 'synckai-test', onInstalled, onStartup } } });

const { listenJobResume } = await import('./job-resume');

/** Exécution immédiate (langue déjà chargée) */
listenJobResume((run) => void run());

beforeEach(() => {
  resume.compare.mockClear();
  resume.crImport.mockClear();
});

describe('reprise des tâches de fond (ARCH-14)', () => {
  it('mise à jour de l’extension (onInstalled) : alignement et import Crunchyroll repris', () => {
    onInstalled.emit({ reason: 'update', previousVersion: '2.1.0' });
    expect(resume.compare).toHaveBeenCalledOnce();
    expect(resume.crImport).toHaveBeenCalledOnce();
  });

  it('démarrage du navigateur : les deux tâches reprises', () => {
    onStartup.emit();
    expect(resume.compare).toHaveBeenCalledOnce();
    expect(resume.crImport).toHaveBeenCalledOnce();
  });

  it('alarme de reprise : seule la tâche concernée', async () => {
    await chrome.alarms.create(CR_IMPORT_ALARM, { periodInMinutes: 0.5 });
    await chrome.alarms.create(COMPARE_JOB_ALARM, { periodInMinutes: 0.5 });
    fake.alarms.fire(CR_IMPORT_ALARM);
    expect(resume.crImport).toHaveBeenCalledOnce();
    expect(resume.compare).not.toHaveBeenCalled();
    fake.alarms.fire(COMPARE_JOB_ALARM);
    expect(resume.compare).toHaveBeenCalledOnce();
  });
});
