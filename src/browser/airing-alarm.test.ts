import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../protocol/storage-keys';
import { buildBackup } from '../shared/backup';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../shared/settings';
import { installFakeChrome } from '../test/fake-chrome';

// Alarme horaire des alertes de sortie tenue à jour là où ses conditions changent (PERF-17, 2026-10-15) : réglages
// enregistrés par une page, sauvegarde importée, déconnexion. Plus d'écouteur storage.onChanged dans le service worker.

vi.mock('./badge', () => ({ refreshReviewBadge: async () => undefined }));

const fake = installFakeChrome({
  extra: {
    runtime: { id: 'synckai-test', getURL: (path: string) => `chrome-extension://synckai-test/${path}`, getManifest: () => ({ version: '2.4.0' }) },
    permissions: { contains: async () => false },
  },
});
const { AIRING_ALARM, SEQUEL_ALARM, ensureAiringAlarm } = await import('./airing-alarm');
const { updateSettings } = await import('./storage/settings-store');
const { applyBackup } = await import('./storage/backup-store');
const { endSession } = await import('./storage/session-end');

const ANILIST = { [STORAGE_KEYS.anilistToken]: { accessToken: 'anilist', expiresAt: Number.MAX_SAFE_INTEGER } };
const MAL = { [STORAGE_KEYS.malToken]: { accessToken: 'mal', refreshToken: 'refresh', expiresAt: Number.MAX_SAFE_INTEGER } };
const settings = (airingAlerts: boolean, sequelAlerts = false): Record<string, unknown> => ({ [SETTINGS_STORAGE_KEY]: { ...DEFAULT_SETTINGS, airingAlerts, sequelAlerts } });

const HOUR_MS = 3_600_000;
const alarm = (): Promise<chrome.alarms.Alarm | undefined> => chrome.alarms.get(AIRING_ALARM);

beforeEach(() => {
  fake.reset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ensureAiringAlarm', () => {
  it('alertes actives et un service connecté : alarme horaire créée (1 min, puis toutes les 60 min)', async () => {
    fake.reset({ ...ANILIST, ...settings(true) });
    await ensureAiringAlarm();
    expect(await alarm()).toMatchObject({ name: AIRING_ALARM, periodInMinutes: 60 });
  });

  it('alarme déjà là : laissée telle quelle (son horaire n’est pas repoussé)', async () => {
    fake.reset({ ...MAL, ...settings(true) });
    await chrome.alarms.create(AIRING_ALARM, { when: 42, periodInMinutes: 60 });
    await ensureAiringAlarm();
    expect((await alarm())?.scheduledTime).toBe(42);
  });

  it('alertes coupées ou aucun service : alarme supprimée', async () => {
    fake.reset({ ...ANILIST, ...settings(false) });
    await chrome.alarms.create(AIRING_ALARM, { periodInMinutes: 60 });
    await ensureAiringAlarm();
    expect(await alarm()).toBeUndefined();

    fake.reset(settings(true));
    await chrome.alarms.create(AIRING_ALARM, { periodInMinutes: 60 });
    await ensureAiringAlarm();
    expect(await alarm()).toBeUndefined();
  });
});

describe('alertes de suite : alarme unique `synckai:sequels`, plus l’alarme horaire (PERF-04)', () => {
  const sequelAlarm = (): Promise<chrome.alarms.Alarm | undefined> => chrome.alarms.get(SEQUEL_ALARM);
  const state = (lastCheck: number | null): Record<string, unknown> => ({ [STORAGE_KEYS.sequelsState]: { records: [], known: [], seeded: [], lastCheck } });
  const failed = (checkedAt: number): Record<string, unknown> => ({ [STORAGE_KEYS.sequelsLastResult]: { checkedAt, found: 0, notified: 0, skipped: null, error: 'Limite' } });

  it('alertes de sortie coupées, alertes de suite actives et un service : aucune alarme de 60 min, une alarme des suites à lastCheck + 24 h', async () => {
    const lastCheck = Date.now() - HOUR_MS;
    fake.reset({ ...ANILIST, ...settings(false, true), ...state(lastCheck) });
    await chrome.alarms.create(AIRING_ALARM, { delayInMinutes: 1, periodInMinutes: 60 });
    await ensureAiringAlarm();
    expect(await alarm()).toBeUndefined();
    expect((await chrome.alarms.getAll()).map(({ name }) => name)).toEqual([SEQUEL_ALARM]);
    expect((await sequelAlarm())?.scheduledTime).toBe(lastCheck + 24 * HOUR_MS);
  });

  it('dernière passe en échec : alarme des suites à checkedAt + 6 h', async () => {
    const lastCheck = Date.now() - 30 * HOUR_MS;
    const checkedAt = Date.now() - HOUR_MS;
    fake.reset({ ...MAL, ...settings(false, true), ...state(lastCheck), ...failed(checkedAt) });
    await ensureAiringAlarm();
    expect((await sequelAlarm())?.scheduledTime).toBe(checkedAt + 6 * HOUR_MS);
  });

  it('jamais vérifié : première passe une minute plus tard', async () => {
    fake.reset({ ...ANILIST, ...settings(false, true) });
    const before = Date.now();
    await ensureAiringAlarm();
    expect((await sequelAlarm())?.scheduledTime).toBeGreaterThanOrEqual(before + 60_000);
    expect((await sequelAlarm())?.scheduledTime).toBeLessThan(before + 2 * 60_000);
  });

  it('alertes de suite coupées ou aucun service : aucune alarme des suites', async () => {
    fake.reset({ ...ANILIST, ...settings(true, false), ...state(Date.now()) });
    await chrome.alarms.create(SEQUEL_ALARM, { when: Date.now() + HOUR_MS });
    await ensureAiringAlarm();
    expect(await sequelAlarm()).toBeUndefined();
    expect(await alarm()).toMatchObject({ periodInMinutes: 60 });

    fake.reset({ ...settings(false, true), ...state(Date.now()) });
    await chrome.alarms.create(SEQUEL_ALARM, { when: Date.now() + HOUR_MS });
    await ensureAiringAlarm();
    expect(await chrome.alarms.getAll()).toEqual([]);
  });

  it('les deux actives : alarme horaire des sorties et alarme des suites à lastCheck + 24 h', async () => {
    const lastCheck = Date.now() - 2 * HOUR_MS;
    fake.reset({ ...ANILIST, ...settings(true, true), ...state(lastCheck) });
    await ensureAiringAlarm();
    expect(await alarm()).toMatchObject({ periodInMinutes: 60 });
    expect((await sequelAlarm())?.scheduledTime).toBe(lastCheck + 24 * HOUR_MS);
  });

  it('les deux coupées : aucune alarme', async () => {
    fake.reset({ ...ANILIST, ...settings(false, false) });
    await chrome.alarms.create(AIRING_ALARM, { periodInMinutes: 60 });
    await chrome.alarms.create(SEQUEL_ALARM, { when: Date.now() + HOUR_MS });
    await ensureAiringAlarm();
    expect(await chrome.alarms.getAll()).toEqual([]);
  });

  it('alertes de suite coupées depuis les réglages, puis dernier service déconnecté : alarme des suites supprimée', async () => {
    fake.reset({ ...ANILIST, ...settings(false, true) });
    await ensureAiringAlarm();
    expect(await sequelAlarm()).toBeDefined();
    await updateSettings({ sequelAlerts: false });
    expect(await sequelAlarm()).toBeUndefined();
    await updateSettings({ sequelAlerts: true });
    expect(await sequelAlarm()).toBeDefined();
    await endSession('anilist');
    expect(await sequelAlarm()).toBeUndefined();
  });
});

describe('réglages enregistrés par une page : l’alarme suit sans réveil du service worker', () => {
  it('alertes activées puis coupées depuis les réglages : alarme créée puis supprimée', async () => {
    fake.reset({ ...ANILIST, ...settings(false) });
    await updateSettings({ airingAlerts: true });
    expect(await alarm()).toMatchObject({ periodInMinutes: 60 });
    await updateSettings({ airingAlerts: false });
    expect(await alarm()).toBeUndefined();
  });

  it('sauvegarde importée avec ses réglages : alertes coupées → alarme supprimée', async () => {
    fake.reset({ ...ANILIST, ...settings(true) });
    await ensureAiringAlarm();
    const backup = buildBackup({ settings: { ...DEFAULT_SETTINGS, airingAlerts: false, sequelAlerts: false } }, '2.4.0', new Date()).data;
    await applyBackup(backup, 'replace', true);
    expect(await alarm()).toBeUndefined();
  });
});

describe('déconnexion : l’alarme suit', () => {
  it('dernier service déconnecté : alarme supprimée', async () => {
    fake.reset({ ...ANILIST, ...settings(true) });
    await ensureAiringAlarm();
    await endSession('anilist');
    expect(await alarm()).toBeUndefined();
  });

  it('un autre service reste connecté : alarme gardée', async () => {
    fake.reset({ ...ANILIST, ...MAL, ...settings(true) });
    await ensureAiringAlarm();
    await endSession('anilist');
    expect(await alarm()).toMatchObject({ periodInMinutes: 60 });
  });
});
