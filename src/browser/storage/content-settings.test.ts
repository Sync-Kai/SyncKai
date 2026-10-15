import { beforeEach, describe, expect, it } from 'vitest';
import { installFakeChrome } from '../../test/fake-chrome';

// Lecteur des scripts de contenu : pour chaque forme stockée, mêmes valeurs que normalizeSettings sur ses champs
// (les deux lectures partagent normalizeContentSettings ; ce test garde la parité si l'une change).

const fake = installFakeChrome();
const { getContentSettings } = await import('./content-settings');
const { DEFAULT_CONTENT_SETTINGS, SETTINGS_STORAGE_KEY } = await import('../../shared/content-settings');
const { DEFAULT_SETTINGS, normalizeSettings } = await import('../../shared/settings');

const FIELDS = Object.keys(DEFAULT_CONTENT_SETTINGS);

/** Champs du contenu dans les réglages complets */
function contentFields(raw: unknown): Record<string, unknown> {
  const full: Record<string, unknown> = { ...normalizeSettings(raw) };
  return Object.fromEntries(FIELDS.map((field) => [field, full[field]]));
}

/** Formes stockées : absente, illisible, partielle, valide, hors bornes, inconnue, ancienne (≤ 1.3) */
const SHAPES: readonly [string, unknown][] = [
  ['null', null],
  ['chaîne', 'corrompu'],
  ['nombre', 42],
  ['tableau', [1, 2]],
  ['objet vide', {}],
  ['partielle (pause)', { autoSync: false }],
  ['partielle (langue)', { language: 'de' }],
  ['valide', { autoSync: false, completionTrigger: 'percentage', completionPercentage: 90, notificationLevel: 'detailed', language: 'ja' }],
  ['réglages complets par défaut', DEFAULT_SETTINGS],
  ['réglages complets modifiés', { ...DEFAULT_SETTINGS, autoSync: false, notificationLevel: 'alerts-only', language: 'pt-BR', seriesOffsets: { '21': { minutes: 120, at: 5 } } }],
  ['pourcentage trop bas', { completionPercentage: 10 }],
  ['pourcentage trop haut', { completionPercentage: 150 }],
  ['pourcentage décimal', { completionPercentage: 85.6 }],
  ['pourcentage NaN', { completionPercentage: Number.NaN }],
  ['pourcentage infini', { completionPercentage: Number.POSITIVE_INFINITY }],
  ['pourcentage en texte', { completionPercentage: '90' }],
  ['déclencheur inconnu', { completionTrigger: 'end' }],
  ['niveau inconnu', { notificationLevel: 'loud' }],
  ['langue inconnue', { language: 'xx' }],
  ['langue régionale non proposée', { language: 'fr-CA' }],
  ['types faux', { autoSync: 'yes', completionTrigger: 1, notificationLevel: null, language: 3 }],
  ['ancien showToast: false', { showToast: false }],
  ['ancien showToast: false avec un niveau', { showToast: false, notificationLevel: 'detailed' }],
  ['ancien showToast: false avec un niveau inconnu', { showToast: false, notificationLevel: 'loud' }],
  ['ancien showToast: true', { showToast: true }],
];

beforeEach(() => fake.reset());

describe('getContentSettings', () => {
  it('ne normalise que les champs lus par les scripts de contenu', () => {
    expect([...FIELDS].sort()).toEqual(['autoSync', 'completionPercentage', 'completionTrigger', 'language', 'notificationLevel']);
  });

  it('valeurs par défaut sans réglages enregistrés, égales à celles des réglages complets', async () => {
    expect(await getContentSettings()).toEqual(DEFAULT_CONTENT_SETTINGS);
    expect(DEFAULT_CONTENT_SETTINGS).toEqual(contentFields(undefined));
  });

  it.each(SHAPES)('mêmes valeurs que normalizeSettings : %s', async (_label, stored) => {
    fake.reset({ [SETTINGS_STORAGE_KEY]: stored });
    expect(await getContentSettings()).toEqual(contentFields(stored));
  });
});
