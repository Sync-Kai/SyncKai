import { describe, expect, it } from 'vitest';
import { t, tp } from '../i18n';
import { BACKUP_FORMAT, BACKUP_VERSION, type BackupData, type ParsedBackup } from '../shared/backup';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { fileContents, readyState, withConfirming, withIncludeSettings, withMode } from './view';

// Page Sauvegarde : contenu du fichier choisi, mode d'import et réglages, confirmation du remplacement.

const data = (patch: Partial<BackupData> = {}): BackupData => ({
  settings: DEFAULT_SETTINGS,
  mediaMappings: {},
  pendingReviews: [],
  recentSyncs: [],
  excludedSeries: [],
  pendingRatings: [],
  rewatchDeclined: { 'anilist:1': 1, 'mal:2': 2 },
  ...patch,
});

const parsed = (patch: Partial<BackupData> = {}, invalidCount = 0): ParsedBackup => ({
  backup: { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: '2026-10-12T19:40:00Z', appVersion: '2.3.1', data: data(patch) },
  invalidCount,
});

describe('page Sauvegarde : contenu du fichier', () => {
  it('réglages inclus ou absents, puis chaque section avec son nombre', () => {
    const rows = fileContents(parsed());
    expect(rows[0]).toEqual({ id: 'settings', label: t('import.summary.settings'), value: t('import.summary.included'), tone: 'ok' });
    expect(rows.map((row) => row.id)).toEqual(['settings', 'mediaMappings', 'excludedSeries', 'recentSyncs', 'pendingReviews', 'pendingRatings', 'rewatchDeclined']);
    expect(rows.at(-1)).toEqual({ id: 'rewatchDeclined', label: tp('import.summary.rewatchDeclined', 2), value: '2', tone: null });
    expect(fileContents(parsed({ settings: null }))[0]).toMatchObject({ value: t('import.summary.missing'), tone: 'warn' });
  });
});

describe('page Sauvegarde : options de l’import', () => {
  const ready = readyState('synckai.json', parsed());

  it('fichier lu : fusion, réglages décochés, rien en cours', () => {
    expect(ready).toEqual({ kind: 'ready', fileName: 'synckai.json', parsed: parsed(), mode: 'merge', includeSettings: false, confirming: false, applying: false, error: null });
  });

  it('remplacement : réglages cochés s’ils sont dans le fichier ; retour à la fusion : décochés', () => {
    const replace = withMode(ready, 'replace');
    expect(replace).toMatchObject({ mode: 'replace', includeSettings: true });
    expect(withMode(replace, 'merge')).toMatchObject({ mode: 'merge', includeSettings: false });
    expect(withMode(readyState('a.json', parsed({ settings: null })), 'replace').includeSettings).toBe(false);
  });

  it('une option changée annule la confirmation du remplacement', () => {
    const confirming = withConfirming(withMode(ready, 'replace'), true);
    expect(confirming.confirming).toBe(true);
    expect(withIncludeSettings(confirming, false)).toMatchObject({ includeSettings: false, confirming: false });
    expect(withMode(confirming, 'replace').confirming).toBe(false);
  });

  it('réglages absents du fichier : jamais importés', () => {
    expect(withIncludeSettings(readyState('a.json', parsed({ settings: null })), true).includeSettings).toBe(false);
  });
});
