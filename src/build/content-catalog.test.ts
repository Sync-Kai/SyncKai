import { describe, expect, it } from 'vitest';
import { CONTENT_KEYS } from '../i18n/content-keys';
import en from '../i18n/locales/en.json';
import { contentCatalogs, contentCatalogsDefine } from './content-catalog';

describe('contentCatalogs', () => {
  it('l’anglais seul, réduit aux clés de contenu dans l’ordre de CONTENT_KEYS', () => {
    const subset = contentCatalogs(en);
    expect(Object.keys(subset)).toEqual(['en']);
    expect(Object.keys(subset.en)).toEqual([...CONTENT_KEYS]);
    for (const key of CONTENT_KEYS) expect(subset.en[key]).toBe(en[key]);
  });

  it('une clé absente fait échouer le build', () => {
    const { 'common.retry': _removed, ...incomplete } = en;
    expect(() => contentCatalogs(incomplete)).toThrow(/en .*common\.retry/);
  });

  it('valeur du define : JSON stable, identique à celle injectée dans les tests', () => {
    const value = contentCatalogsDefine(en);
    expect(value).toBe(contentCatalogsDefine(en));
    expect(JSON.parse(value)).toEqual(__SYNCKAI_CONTENT_CATALOGS__);
    // Bien plus léger que le catalogue complet (PERF-01)
    expect(value.length).toBeLessThan(JSON.stringify(en).length / 5);
  });
});
