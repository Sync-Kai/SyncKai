import { describe, expect, it } from 'vitest';
import { seriesOffset, withSeriesOffset } from './agenda';
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
      platformOffsets: { crunchyroll: 30, adn: -15, netflix: 90 },
      seriesOffsets: { '21': { minutes: 120, at: 5 } },
      panelDefaultTab: 'agenda',
      panelLiveProgress: false,
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
    expect(normalizeSettings({ platformOffsets: { crunchyroll: 99_999, adn: -5000, netflix: 7.4 } }).platformOffsets).toEqual({ crunchyroll: 10080, adn: -1440, netflix: 7 });
    expect(normalizeSettings({ platformOffsets: { crunchyroll: 12.6, adn: 'tard' } }).platformOffsets).toEqual({ crunchyroll: 13, adn: 60, netflix: 60 });
    expect(normalizeSettings({ platformOffsets: [1, 2] }).platformOffsets).toEqual({ crunchyroll: 60, adn: 60, netflix: 60 });
  });

  it('ne garde que les délais de série valides', () => {
    expect(
      normalizeSettings({ seriesOffsets: { '21': { minutes: 30, at: 1 }, '0': { minutes: 10, at: 1 }, abc: { minutes: 5, at: 1 }, '7': { minutes: Number.NaN, at: 1 }, '8': { minutes: 20_000, at: 1 }, '-3': { minutes: 1, at: 1 }, '9': 'x' } }).seriesOffsets,
    ).toEqual({ '21': { minutes: 30, at: 1 }, '8': { minutes: 10080, at: 1 } });
    expect(normalizeSettings({ seriesOffsets: [30] }).seriesOffsets).toEqual({});
    // Date illisible : la plus ancienne (évincée en premier)
    expect(normalizeSettings({ seriesOffsets: { '5': { minutes: 15, at: 'hier' } } }).seriesOffsets).toEqual({ '5': { minutes: 15, at: 0 } });
  });

  it('format ≤ 2.1 (minutes seules) : relu, daté du plus ancien', () => {
    expect(normalizeSettings({ seriesOffsets: { '21': 30, '8': 20_000 } }).seriesOffsets).toEqual({ '21': { minutes: 30, at: 0 }, '8': { minutes: 10080, at: 0 } });
  });

  it('200 délais réglés dans le désordre puis « Ajuster l’heure » sur l’id 21 : le réglage de l’id 21 est gardé (DATA-03)', () => {
    let settings = normalizeSettings({});
    for (let i = 0; i < MAX_SERIES_OFFSETS; i++) settings = normalizeSettings(withSeriesOffset(settings, 1000 + ((i * 37) % MAX_SERIES_OFFSETS), 60, 1_000 + i));
    settings = normalizeSettings(withSeriesOffset(settings, 21, 120, 10_000));
    expect(seriesOffset(settings, 21)).toBe(120);
    expect(Object.keys(settings.seriesOffsets)).toHaveLength(MAX_SERIES_OFFSETS);
  });

  it('au-delà de la limite : les délais les plus récemment réglés sont gardés, jamais selon le mediaId (DATA-03)', () => {
    // 200 délais réglés dans le désordre des identifiants (ids 1000 → 1199, dates mélangées)
    const ids = Array.from({ length: MAX_SERIES_OFFSETS }, (_, i) => 1000 + ((i * 37) % MAX_SERIES_OFFSETS));
    const many = Object.fromEntries(ids.map((id, i) => [String(id), { minutes: 60, at: 1_000 + i }]));
    const settings = normalizeSettings({ seriesOffsets: many });
    expect(Object.keys(settings.seriesOffsets)).toHaveLength(MAX_SERIES_OFFSETS);

    // « Ajuster l'heure » sur une série au plus petit identifiant : gardée, la plus ancienne évincée
    const next = normalizeSettings(withSeriesOffset(settings, 21, 120, 10_000)).seriesOffsets;
    expect(Object.keys(next)).toHaveLength(MAX_SERIES_OFFSETS);
    expect(next['21']).toEqual({ minutes: 120, at: 10_000 });
    expect(next[String(ids[0])]).toBeUndefined();
    expect(next[String(ids[1])]).toBeDefined();
  });

  it('migre l’ancien réglage showToast (≤ 1.3)', () => {
    expect(normalizeSettings({ showToast: false }).notificationLevel).toBe('alerts-only');
    expect(normalizeSettings({ showToast: true }).notificationLevel).toBe('discreet');
    expect(normalizeSettings({ showToast: false, notificationLevel: 'detailed' }).notificationLevel).toBe('detailed');
  });

  it('rejette un niveau de notification ou un lecteur inconnus', () => {
    expect(normalizeSettings({ preferredPlayer: 'netflix' }).preferredPlayer).toBe('netflix');
    expect(normalizeSettings({ notificationLevel: 'bruyant', preferredPlayer: 'hidive' })).toMatchObject({
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

  it('migre les réglages sans options du panneau (≤ 1.9) : dernier onglet, progression en direct affichée', () => {
    const legacy = { autoSync: false, language: 'de', platformOffsets: { crunchyroll: 30, adn: 90 } };
    expect(normalizeSettings(legacy)).toMatchObject({ autoSync: false, language: 'de', panelDefaultTab: 'last', panelLiveProgress: true });
  });

  it('rejette un onglet de panneau inconnu ou une progression en direct non booléenne', () => {
    expect(normalizeSettings({ panelDefaultTab: 'settings', panelLiveProgress: 'oui' })).toMatchObject({ panelDefaultTab: 'last', panelLiveProgress: true });
    expect(normalizeSettings({ panelDefaultTab: 'nowPlaying' }).panelDefaultTab).toBe('nowPlaying');
    expect(normalizeSettings({ panelLiveProgress: false }).panelLiveProgress).toBe(false);
  });
});
