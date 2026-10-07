import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, MAX_SERIES_OFFSETS, normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('retourne les valeurs par défaut sans données', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('corrompu')).toEqual(DEFAULT_SETTINGS);
  });

  it('conserve des réglages valides', () => {
    const settings = {
      autoSync: false,
      completionTrigger: 'percentage',
      completionPercentage: 90,
      notificationLevel: 'detailed',
      preferredPlayer: 'adn',
      ratingPrompt: false,
      airingAlerts: false,
      airingDelayHours: 3,
      language: 'de',
      platformOffsets: { crunchyroll: 30, adn: -15 },
      seriesOffsets: { '21': 120 },
    } as const;
    expect(normalizeSettings(settings)).toEqual(settings);
  });

  it('migre les réglages sans délais de sortie (≤ 1.9) : délais par défaut, le reste conservé', () => {
    const legacy = { autoSync: false, preferredPlayer: 'adn', airingDelayHours: 1, language: 'fr' };
    expect(normalizeSettings(legacy)).toMatchObject({
      autoSync: false,
      preferredPlayer: 'adn',
      airingDelayHours: 1,
      platformOffsets: { crunchyroll: 60, adn: 60 },
      seriesOffsets: {},
    });
  });

  it('borne et arrondit les délais de plateforme, rejette les valeurs invalides', () => {
    expect(normalizeSettings({ platformOffsets: { crunchyroll: 99_999, adn: -5000 } }).platformOffsets).toEqual({ crunchyroll: 10080, adn: -1440 });
    expect(normalizeSettings({ platformOffsets: { crunchyroll: 12.6, adn: 'tard' } }).platformOffsets).toEqual({ crunchyroll: 13, adn: 60 });
    expect(normalizeSettings({ platformOffsets: [1, 2] }).platformOffsets).toEqual({ crunchyroll: 60, adn: 60 });
  });

  it('ne garde que les délais de série valides, dans la limite autorisée', () => {
    expect(
      normalizeSettings({ seriesOffsets: { '21': 30, '0': 10, abc: 5, '7': Number.NaN, '8': 20_000, '-3': 1 } }).seriesOffsets,
    ).toEqual({ '21': 30, '8': 10080 });
    expect(normalizeSettings({ seriesOffsets: [30] }).seriesOffsets).toEqual({});
    const many = Object.fromEntries(Array.from({ length: MAX_SERIES_OFFSETS + 5 }, (_, i) => [String(i + 1), i]));
    const kept = normalizeSettings({ seriesOffsets: many }).seriesOffsets;
    expect(Object.keys(kept)).toHaveLength(MAX_SERIES_OFFSETS);
    expect(kept['1']).toBeUndefined();
  });

  it('migre l’ancien réglage showToast (≤ 1.3)', () => {
    expect(normalizeSettings({ showToast: false }).notificationLevel).toBe('alerts-only');
    expect(normalizeSettings({ showToast: true }).notificationLevel).toBe('discreet');
    expect(normalizeSettings({ showToast: false, notificationLevel: 'detailed' }).notificationLevel).toBe('detailed');
  });

  it('rejette un niveau de notification ou un lecteur inconnus', () => {
    expect(normalizeSettings({ notificationLevel: 'bruyant', preferredPlayer: 'netflix' })).toMatchObject({
      notificationLevel: 'discreet',
      preferredPlayer: 'crunchyroll',
    });
  });

  it('rejette une langue inconnue (auto par défaut)', () => {
    expect(normalizeSettings({ language: 'es' }).language).toBe('auto');
    expect(normalizeSettings({ language: 'fr' }).language).toBe('fr');
    expect(normalizeSettings({}).language).toBe('auto');
  });

  it('borne et arrondit le pourcentage, rejette les valeurs invalides', () => {
    expect(normalizeSettings({ completionPercentage: 40 }).completionPercentage).toBe(70);
    expect(normalizeSettings({ completionPercentage: 100 }).completionPercentage).toBe(98);
    expect(normalizeSettings({ completionPercentage: 87.6 }).completionPercentage).toBe(88);
    expect(normalizeSettings({ completionPercentage: Number.NaN }).completionPercentage).toBe(85);
    expect(normalizeSettings({ completionTrigger: 'autre' }).completionTrigger).toBe('credits');
  });
});
