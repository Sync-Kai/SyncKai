import { describe, expect, it } from 'vitest';
import { endonym, filterLanguages, foldSearchText, LANGUAGE_SEARCH_MIN, languageEntries, languageName, showsLanguageSearch, supportedLanguages } from './language-list';

describe('noms des langues (Intl.DisplayNames)', () => {
  it('endonyme avec majuscule initiale selon la langue', () => {
    expect(endonym('fr')).toBe('Français');
    expect(endonym('en')).toBe('English');
    expect(endonym('de')).toBe('Deutsch');
    expect(endonym('pt-BR')).toBe('Português (Brasil)');
  });

  it('nom traduit dans la langue de l’interface', () => {
    expect(languageName('de', 'fr')).toBe('Allemand');
    expect(languageName('fr', 'en')).toBe('French');
    expect(languageName('en', 'de')).toBe('Englisch');
  });

  it('repli sur le code si Intl ne sait pas nommer la langue', () => {
    expect(languageName('not a code', 'fr')).toBe('not a code');
    expect(languageName('de', 'not a locale')).toBe('de');
  });
});

describe('languageEntries', () => {
  it('tri par endonyme, identique quelle que soit la langue de l’interface', () => {
    for (const ui of ['fr', 'en', 'de'] as const) {
      expect(supportedLanguages(ui).map((entry) => entry.endonym)).toEqual(['Deutsch', 'English', 'Français']);
    }
  });

  it('tri sans tenir compte des accents ni de la casse', () => {
    // Ordre des points de code : « Čeština » après « Dansk »
    expect(languageEntries('en', ['da', 'cs', 'ca']).map((entry) => entry.endonym)).toEqual(['Català', 'Čeština', 'Dansk']);
  });

  it('sous-titre : nom traduit, absent quand il est identique à l’endonyme', () => {
    expect(supportedLanguages('fr')).toEqual([
      { code: 'de', endonym: 'Deutsch', name: 'Allemand', subtitle: 'Allemand' },
      { code: 'en', endonym: 'English', name: 'Anglais', subtitle: 'Anglais' },
      { code: 'fr', endonym: 'Français', name: 'Français', subtitle: null },
    ]);
    expect(supportedLanguages('de').map((entry) => entry.subtitle)).toEqual([null, 'Englisch', 'Französisch']);
    expect(supportedLanguages('en').map((entry) => entry.subtitle)).toEqual(['German', null, 'French']);
  });
});

describe('recherche', () => {
  const entries = languageEntries('fr', ['de', 'en', 'fr', 'pt-BR', 'es', 'ja']);
  const codes = (query: string): string[] => filterLanguages(entries, query).map((entry) => entry.code);

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

  it('recherche vide : toutes les langues ; aucune correspondance : liste vide', () => {
    expect(codes('  ')).toEqual(entries.map((entry) => entry.code));
    expect(codes('klingon')).toEqual([]);
  });
});

describe('seuil du champ de recherche', () => {
  it(`affiché à partir de ${LANGUAGE_SEARCH_MIN} langues`, () => {
    expect(showsLanguageSearch(3)).toBe(false);
    expect(showsLanguageSearch(LANGUAGE_SEARCH_MIN - 1)).toBe(false);
    expect(showsLanguageSearch(LANGUAGE_SEARCH_MIN)).toBe(true);
    expect(showsLanguageSearch(20)).toBe(true);
  });
});
