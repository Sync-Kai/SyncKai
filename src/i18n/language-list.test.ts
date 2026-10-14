import { describe, expect, it } from 'vitest';
import { endonym, filterLanguages, foldSearchText, LANGUAGE_SEARCH_MIN, languageEntries, languageName, showsLanguageSearch, supportedLanguages } from './language-list';
import { LOCALES } from './locale-codes';

describe('noms des langues (Intl.DisplayNames)', () => {
  it('endonyme avec majuscule initiale selon la langue', () => {
    expect(endonym('fr')).toBe('Français');
    expect(endonym('en')).toBe('English');
    expect(endonym('de')).toBe('Deutsch');
    expect(endonym('pt-BR')).toBe('Português (Brasil)');
    expect(endonym('ja')).toBe('日本語');
  });

  it('chinois nommé par l’écriture, espagnol d’Espagne explicite', () => {
    expect(endonym('zh-CN')).toBe('简体中文');
    expect(endonym('zh-TW')).toBe('繁體中文');
    expect(endonym('es')).toBe('Español de España');
    expect(endonym('es-419')).toBe('Español latinoamericano');
    expect(languageName('zh-CN', 'fr')).toBe('Chinois simplifié');
    expect(languageName('zh-TW', 'en')).toBe('Traditional Chinese');
    expect(languageName('es', 'en')).toBe('European Spanish');
    expect(languageName('es-419', 'de')).toBe('Spanisch (Lateinamerika)');
  });

  it('nom traduit dans la langue de l’interface', () => {
    expect(languageName('de', 'fr')).toBe('Allemand');
    expect(languageName('fr', 'en')).toBe('French');
    expect(languageName('en', 'de')).toBe('Englisch');
  });

  it('chaque langue a un nom propre et distinct dans chaque langue de l’interface (es / es-419, zh-CN / zh-TW compris)', () => {
    for (const ui of LOCALES) {
      const names = LOCALES.map((code) => languageName(code, ui));
      expect({ ui, unnamed: LOCALES.filter((code, index) => names[index] === code) }).toEqual({ ui, unnamed: [] });
      expect({ ui, distinct: new Set(names).size }).toEqual({ ui, distinct: LOCALES.length });
    }
    expect(new Set(LOCALES.map(endonym)).size).toBe(LOCALES.length);
  });

  it('repli sur le code si Intl ne sait pas nommer la langue', () => {
    expect(languageName('not a code', 'fr')).toBe('not a code');
    expect(languageName('de', 'not a locale')).toBe('de');
  });
});

describe('languageEntries', () => {
  /** Ordre des endonymes (collation racine) : alphabet latin, puis cyrillique, hangeul, kana et sinogrammes */
  const ORDER = ['cs', 'de', 'en', 'es', 'es-419', 'fr', 'id', 'it', 'nl', 'pl', 'pt-BR', 'ro', 'sv', 'vi', 'tr', 'ru', 'uk', 'ko', 'ja', 'zh-CN', 'zh-TW'];

  it('les 21 langues triées par endonyme, dans le même ordre quelle que soit la langue de l’interface', () => {
    for (const ui of LOCALES) expect(supportedLanguages(ui).map((entry) => entry.code)).toEqual(ORDER);
  });

  it('tri sans tenir compte des accents ni de la casse', () => {
    // Ordre des points de code : « Čeština » après « Dansk »
    expect(languageEntries('en', ['da', 'cs', 'ca']).map((entry) => entry.endonym)).toEqual(['Català', 'Čeština', 'Dansk']);
  });

  it('sous-titre : nom traduit, absent quand il est identique à l’endonyme', () => {
    const fr = supportedLanguages('fr');
    expect(fr.find((entry) => entry.code === 'de')).toEqual({ code: 'de', endonym: 'Deutsch', name: 'Allemand', subtitle: 'Allemand' });
    expect(fr.find((entry) => entry.code === 'zh-TW')).toEqual({ code: 'zh-TW', endonym: '繁體中文', name: 'Chinois traditionnel', subtitle: 'Chinois traditionnel' });
    for (const ui of ['fr', 'en', 'de'] as const) {
      expect(supportedLanguages(ui).filter((entry) => entry.subtitle === null).map((entry) => entry.code)).toEqual([ui]);
    }
    // Interface en espagnol : les deux espagnols (et l'italien, « Italiano » dans les deux langues) sans sous-titre
    expect(supportedLanguages('es-419').filter((entry) => entry.subtitle === null).map((entry) => entry.code)).toEqual(['es', 'es-419', 'it']);
  });
});

describe('recherche', () => {
  const entries = languageEntries('fr', ['de', 'en', 'fr', 'pt-BR', 'es', 'ja']);
  const codes = (query: string): string[] => filterLanguages(entries, query).map((entry) => entry.code);
  const all = (query: string): string[] => filterLanguages(supportedLanguages('fr'), query).map((entry) => entry.code);

  it('texte replié : minuscules, sans accents, espaces réduits', () => {
    expect(foldSearchText('  Português   (Brasil) ')).toBe('portugues (brasil)');
    expect(foldSearchText('FRANÇAIS')).toBe('francais');
  });

  it('endonyme, nom traduit ou code ; insensible aux accents et à la casse', () => {
    expect(codes('pt')).toEqual(['pt-BR']);
    expect(codes('portu')).toEqual(['pt-BR']);
    expect(codes('brésil')).toEqual(['pt-BR']);
    expect(codes('BRESIL')).toEqual(['pt-BR']);
    expect(codes('espanol')).toEqual(['es']);
    expect(codes('japonais')).toEqual(['ja']);
    expect(codes('日本')).toEqual(['ja']);
    expect(codes('allem')).toEqual(['de']);
    expect(codes('francais')).toEqual(['fr']);
  });

  it('parmi les 21 langues : variantes régionales et écritures', () => {
    expect(all('espagnol')).toEqual(['es', 'es-419']);
    expect(all('latino')).toEqual(['es-419']);
    expect(all('chinois')).toEqual(['zh-CN', 'zh-TW']);
    expect(all('中文')).toEqual(['zh-CN', 'zh-TW']);
    expect(all('zh-tw')).toEqual(['zh-TW']);
    expect(all('ukr')).toEqual(['uk']);
  });

  it('recherche vide : toutes les langues ; aucune correspondance : liste vide', () => {
    expect(codes('  ')).toEqual(entries.map((entry) => entry.code));
    expect(codes('klingon')).toEqual([]);
  });
});

describe('seuil du champ de recherche', () => {
  it(`affiché à partir de ${LANGUAGE_SEARCH_MIN} langues : donc pour les 21 langues proposées`, () => {
    expect(showsLanguageSearch(3)).toBe(false);
    expect(showsLanguageSearch(LANGUAGE_SEARCH_MIN - 1)).toBe(false);
    expect(showsLanguageSearch(LANGUAGE_SEARCH_MIN)).toBe(true);
    expect(showsLanguageSearch(supportedLanguages('fr').length)).toBe(true);
  });
});
