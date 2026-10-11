import { describe, expect, it } from 'vitest';
import { CONTENT_KEYS } from '../i18n/content-keys';
import de from '../i18n/locales/de.json';
import en from '../i18n/locales/en.json';
import fr from '../i18n/locales/fr.json';
import { contentCatalogs, contentCatalogsDefine } from './content-catalog';

describe('contentCatalogs', () => {
  it('ne garde que les clés de contenu, dans l’ordre de CONTENT_KEYS, avec les textes des catalogues', () => {
    const subset = contentCatalogs({ en, fr, de });
    for (const [locale, catalog] of [['fr', fr], ['en', en], ['de', de]] as const) {
      expect(Object.keys(subset[locale])).toEqual([...CONTENT_KEYS]);
      for (const key of CONTENT_KEYS) expect(subset[locale][key]).toBe(catalog[key]);
    }
  });

  it('une clé absente d’une langue fait échouer le build', () => {
    const { 'common.retry': _removed, ...incomplete } = de;
    expect(() => contentCatalogs({ en, fr, de: incomplete })).toThrow(/de .*common\.retry/);
  });

  it('valeur du define : JSON stable, identique à celle injectée dans les tests', () => {
    const value = contentCatalogsDefine({ en, fr, de });
    expect(value).toBe(contentCatalogsDefine({ en, fr, de }));
    expect(JSON.parse(value)).toEqual(__SYNCKAI_CONTENT_CATALOGS__);
    // Bien plus léger que les catalogues complets (PERF-01)
    expect(value.length).toBeLessThan(JSON.stringify({ en, fr, de }).length / 5);
  });
});
