import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_RECO_FILTER } from '../../shared/recommendations';
import { installFakeChrome } from '../../test/fake-chrome';

// Préférences d'affichage des sections du popup (clé `popupPrefs:sections`) : lecture tolérante, écriture par fusion

const fake = installFakeChrome();
const { DEFAULT_SECTION_PREFS, SECTION_PREFS_KEY, loadSectionPrefs, normalizeSectionPrefs, saveSectionPrefs } = await import('./section-prefs');

beforeEach(() => fake.reset());

describe('section-prefs', () => {
  it('clé et défaut', () => {
    expect(SECTION_PREFS_KEY).toBe('popupPrefs:sections');
    expect(DEFAULT_SECTION_PREFS).toEqual({ recoFilter: ALL_RECO_FILTER });
  });

  it('valeur illisible → défaut ; genre de plus de 40 caractères → null', async () => {
    for (const raw of [undefined, null, 'x', 3, [], {}, { recoFilter: 'x' }, { recoFilter: { genre: 3, format: 'all' } }, { recoFilter: { genre: null, format: 'tv' } }]) {
      expect(normalizeSectionPrefs(raw)).toEqual(DEFAULT_SECTION_PREFS);
    }
    expect(normalizeSectionPrefs({ recoFilter: { genre: 'Action', format: 'movies' } })).toEqual({ recoFilter: { genre: 'Action', format: 'movies' } });
    expect(normalizeSectionPrefs({ recoFilter: { genre: 'x'.repeat(40), format: 'series' } }).recoFilter.genre).toBe('x'.repeat(40));
    expect(normalizeSectionPrefs({ recoFilter: { genre: 'x'.repeat(41), format: 'series' } })).toEqual({ recoFilter: { genre: null, format: 'series' } });
    fake.local.seed({ [SECTION_PREFS_KEY]: { recoFilter: { genre: 'Action', format: 'series' } } });
    expect(await loadSectionPrefs()).toEqual({ recoFilter: { genre: 'Action', format: 'series' } });
    fake.local.seed({});
    expect(await loadSectionPrefs()).toEqual(DEFAULT_SECTION_PREFS);
  });

  it('saveSectionPrefs fusionne avec la valeur enregistrée', async () => {
    // Champ d'une autre version : gardé ; champ absent du patch : gardé
    fake.local.seed({ [SECTION_PREFS_KEY]: { recoFilter: { genre: 'Drama', format: 'all' }, futur: 1 } });
    await saveSectionPrefs({});
    expect(fake.local.peek(SECTION_PREFS_KEY)).toEqual({ recoFilter: { genre: 'Drama', format: 'all' }, futur: 1 });
    await saveSectionPrefs({ recoFilter: { genre: null, format: 'movies' } });
    expect(fake.local.peek(SECTION_PREFS_KEY)).toEqual({ recoFilter: { genre: null, format: 'movies' }, futur: 1 });
    // Rien d'enregistré : le patch seul
    fake.local.seed({});
    await saveSectionPrefs({ recoFilter: ALL_RECO_FILTER });
    expect(fake.local.peek(SECTION_PREFS_KEY)).toEqual({ recoFilter: ALL_RECO_FILTER });
  });
});
