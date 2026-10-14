import { describe, expect, it } from 'vitest';
import { chromeLocaleFolder, isLocale, LANGUAGE_SETTINGS, LOCALES, matchLocale } from './locale-codes';

describe('langues proposées', () => {
  it('21 langues, sans doublon, toutes des étiquettes BCP 47 canoniques', () => {
    expect(LOCALES).toHaveLength(21);
    expect(new Set(LOCALES).size).toBe(LOCALES.length);
    for (const locale of LOCALES) expect(Intl.getCanonicalLocales(locale)).toEqual([locale]);
    expect(LANGUAGE_SETTINGS).toEqual(['auto', ...LOCALES]);
  });

  it('isLocale : codes exacts seulement', () => {
    expect(isLocale('pt-BR')).toBe(true);
    expect(isLocale('es-419')).toBe(true);
    for (const value of ['auto', 'pt-br', 'pt', 'zh', 'es-MX', '', null, 3]) expect(isLocale(value)).toBe(false);
  });

  it('dossiers _locales : « - » remplacé par « _ »', () => {
    expect(chromeLocaleFolder('es-419')).toBe('es_419');
    expect(chromeLocaleFolder('pt-BR')).toBe('pt_BR');
    expect(chromeLocaleFolder('zh-TW')).toBe('zh_TW');
    expect(chromeLocaleFolder('fr')).toBe('fr');
  });
});

describe('matchLocale (langue du navigateur → langue de l’extension)', () => {
  it.each([
    // Code proposé : correspondance exacte, « - » ou « _ », casse indifférente
    ['fr', 'fr'],
    ['EN', 'en'],
    ['pt-BR', 'pt-BR'],
    ['pt_br', 'pt-BR'],
    ['es-419', 'es-419'],
    ['es_419', 'es-419'],
    ['zh-CN', 'zh-CN'],
    ['zh_TW', 'zh-TW'],
    ['ZH-tw', 'zh-TW'],
    // Chinois : traditionnel par l'écriture ou la région, simplifié sinon
    ['zh-HK', 'zh-TW'],
    ['zh-MO', 'zh-TW'],
    ['zh-Hant', 'zh-TW'],
    ['zh-Hant-CN', 'zh-TW'],
    ['zh_Hant_HK', 'zh-TW'],
    ['zh', 'zh-CN'],
    ['zh-SG', 'zh-CN'],
    ['zh-Hans', 'zh-CN'],
    ['zh-Hans-HK', 'zh-CN'],
    // Espagnol : Espagne ou sans région → es, toute autre région → es-419
    ['es', 'es'],
    ['es-ES', 'es'],
    ['es_es', 'es'],
    ['es-MX', 'es-419'],
    ['es-AR', 'es-419'],
    ['es-CO', 'es-419'],
    ['es-CL', 'es-419'],
    ['es-US', 'es-419'],
    // Portugais : toujours pt-BR
    ['pt', 'pt-BR'],
    ['pt-PT', 'pt-BR'],
    ['pt-AO', 'pt-BR'],
    // Langue de base proposée
    ['fr-CA', 'fr'],
    ['fr-BE', 'fr'],
    ['de-AT', 'de'],
    ['de-CH', 'de'],
    ['nl-BE', 'nl'],
    ['sv-FI', 'sv'],
    ['en-GB', 'en'],
    ['en-US', 'en'],
    ['ru-UA', 'ru'],
    ['ja-JP', 'ja'],
    ['ko-KR', 'ko'],
    ['it-CH', 'it'],
    ['tr-TR', 'tr'],
    ['ro-MD', 'ro'],
    ['de-DE-u-co-phonebk', 'de'],
    // Codes dépréciés ramenés à leur forme canonique
    ['in', 'id'],
    ['in-ID', 'id'],
    ['mo', 'ro'],
    // Langue non proposée, étiquette vide ou invalide : anglais
    ['nb-NO', 'en'],
    ['he', 'en'],
    ['ar-EG', 'en'],
    ['', 'en'],
    ['!!', 'en'],
    ['  fr-FR  ', 'fr'],
  ] as const)('%s → %s', (tag, expected) => {
    expect(matchLocale(tag)).toBe(expected);
  });
});
