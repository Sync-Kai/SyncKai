import { describe, expect, it } from 'vitest';
import { checkCatalog, isCatalog, placeholders, pluralBases, pluralVariants, type CatalogIssue } from './catalog-check';

/** Référence anglaise réduite : clés simples et deux clés plurielles (`{count}` présent ou non dans `_one`) */
const EN = {
  'common.close': 'Close',
  'common.connect': 'Connect {service}',
  'footer.toRate_one': '{count} series to rate',
  'footer.toRate_other': '{count} series to rate',
  'queue.pending_one': 'One sync pending on {service}',
  'queue.pending_other': '{count} syncs pending on {service}',
};

const errors = (issues: readonly CatalogIssue[]): string[] => issues.filter((issue) => issue.level === 'error').map((issue) => `${issue.key ?? '*'}: ${issue.message}`);
const warnings = (issues: readonly CatalogIssue[]): string[] => issues.filter((issue) => issue.level === 'warning').map((issue) => issue.key ?? '*');

describe('variantes de pluriel par langue (Intl.PluralRules)', () => {
  it.each([
    ['en', ['one', 'other'], ['one', 'other']],
    ['fr', ['one', 'other'], ['one', 'many', 'other']],
    ['ru', ['one', 'few', 'many', 'other'], ['one', 'few', 'many', 'other']],
    ['pl', ['one', 'few', 'many', 'other'], ['one', 'few', 'many', 'other']],
    ['uk', ['one', 'few', 'many', 'other'], ['one', 'few', 'many', 'other']],
    // Tchèque : `many` ne sert qu'aux décimaux (permise, jamais requise pour un compte)
    ['cs', ['one', 'few', 'other'], ['one', 'few', 'many', 'other']],
    ['ro', ['one', 'few', 'other'], ['one', 'few', 'other']],
    ['ja', ['other'], ['other']],
    ['zh-TW', ['other'], ['other']],
    ['id', ['other'], ['other']],
  ] as const)('%s : requises %j, permises %j', (locale, required, allowed) => {
    expect(pluralVariants(locale)).toEqual({ required, allowed });
  });

  it('bases plurielles : paires `_one` / `_other` seulement', () => {
    expect([...pluralBases({ ...EN, 'orphan_other': 'x', 'lonely_one': 'y' })].sort()).toEqual(['footer.toRate', 'queue.pending']);
  });

  it('placeholders sans doublon, triés', () => {
    expect(placeholders('{b} et {a}, puis {b}')).toEqual(['a', 'b']);
    expect(placeholders('aucun')).toEqual([]);
  });

  it('isCatalog : objet de textes seulement', () => {
    expect(isCatalog({ a: 'x' })).toBe(true);
    expect(isCatalog({})).toBe(true);
    for (const value of [null, [], 'x', { a: 1 }, { a: null }]) expect(isCatalog(value)).toBe(false);
  });
});

describe('checkCatalog', () => {
  it('l’anglais est conforme à lui-même', () => {
    expect(checkCatalog('en', EN, EN)).toEqual([]);
  });

  it('catalogue illisible', () => {
    expect(errors(checkCatalog('fr', [], EN))).toEqual(['*: not a JSON object of strings']);
    expect(errors(checkCatalog('fr', { 'common.close': 3 }, EN))).toEqual(['*: not a JSON object of strings']);
  });

  it('clés absentes ou inconnues, texte vide', () => {
    const { 'common.close': _removed, ...rest } = EN;
    expect(errors(checkCatalog('de', { ...rest, 'common.connect': '  ', 'common.extra': 'x' }, EN))).toEqual([
      'common.close: missing key',
      'common.connect: empty text',
      'common.extra: unknown key (not in en.json)',
    ]);
  });

  it('russe : `_few` et `_many` requis', () => {
    expect(errors(checkCatalog('ru', EN, EN))).toEqual([
      'footer.toRate_few: missing plural variant (ru needs _one, _few, _many, _other)',
      'footer.toRate_many: missing plural variant (ru needs _one, _few, _many, _other)',
      'queue.pending_few: missing plural variant (ru needs _one, _few, _many, _other)',
      'queue.pending_many: missing plural variant (ru needs _one, _few, _many, _other)',
    ]);
    const complete = { ...EN, 'footer.toRate_few': '{count} x', 'footer.toRate_many': '{count} y', 'queue.pending_few': '{count} {service}', 'queue.pending_many': '{count} {service}' };
    expect(errors(checkCatalog('ru', complete, EN))).toEqual([]);
  });

  it('japonais : `_one` refusée (une seule forme)', () => {
    expect(errors(checkCatalog('ja', EN, EN))).toEqual([
      'footer.toRate_one: plural variant not used in ja (allowed: _other)',
      'queue.pending_one: plural variant not used in ja (allowed: _other)',
    ]);
    const { 'footer.toRate_one': _a, 'queue.pending_one': _b, ...single } = EN;
    expect(errors(checkCatalog('ja', single, EN))).toEqual([]);
  });

  it('français : `_many` permise sans être requise', () => {
    expect(errors(checkCatalog('fr', { ...EN, 'footer.toRate_many': '{count} séries à noter' }, EN))).toEqual([]);
    expect(errors(checkCatalog('fr', { ...EN, 'footer.toRate_few': '{count} x' }, EN))).toEqual(['footer.toRate_few: plural variant not used in fr (allowed: _one, _many, _other)']);
  });

  it('placeholders : ceux de l’anglais ; `{count}` facultatif seulement si `_one` anglais l’omet', () => {
    expect(errors(checkCatalog('fr', { ...EN, 'common.connect': 'Connecter', 'footer.toRate_one': 'Une série à noter' }, EN))).toEqual([
      'common.connect: placeholders none instead of {service}',
      'footer.toRate_one: placeholders none instead of {count}',
    ]);
    // « One sync pending » : `{count}` absent du `_one` anglais, donc facultatif dans chaque variante
    expect(errors(checkCatalog('fr', { ...EN, 'queue.pending_one': 'Une synchro en attente sur {service}' }, EN))).toEqual([]);
    expect(errors(checkCatalog('fr', { ...EN, 'queue.pending_other': '{count} synchros en attente' }, EN))).toEqual(['queue.pending_other: placeholders {count} instead of {count} {service}']);
    expect(errors(checkCatalog('fr', { ...EN, 'common.close': 'Fermer {extra}' }, EN))).toEqual(['common.close: placeholders {extra} instead of none']);
  });

  it('avertissement (informatif) : texte court traduit plus de 1,6 fois plus long', () => {
    const issues = checkCatalog('de', { ...EN, 'common.close': 'Schließen und beenden' }, EN);
    expect(errors(issues)).toEqual([]);
    expect(warnings(issues)).toEqual(['common.close']);
    // Texte anglais long : pas d'avertissement
    expect(warnings(checkCatalog('de', { ...EN, 'queue.pending_other': `{count} ${'x'.repeat(80)} {service}` }, EN))).toEqual([]);
  });
});
