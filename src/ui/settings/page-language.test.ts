import { afterEach, describe, expect, it } from 'vitest';
import { getLocale, LOCALES, setLocale } from '../../i18n';
import { languagePageModel, type LanguagePageInput } from './page-language';

const initial = getLocale();
afterEach(() => setLocale(initial));

const input = (patch: Partial<LanguagePageInput> = {}): LanguagePageInput => ({ setting: 'auto', uiLocale: 'fr', browserLocale: 'fr', query: '', translationUrl: null, ...patch });

describe('languagePageModel (Réglages › Langue)', () => {
  it('« Automatique » en tête, coché par défaut, avec la langue détectée ; puis les 21 langues par endonyme', () => {
    setLocale('fr');
    const model = languagePageModel(input());
    expect(model.auto).toEqual({ value: 'auto', label: 'Automatique', subtitle: 'Langue du navigateur · Français', lang: null, checked: true });
    expect(model.rows).toHaveLength(LOCALES.length);
    expect(model.rows.slice(0, 3)).toEqual([
      { value: 'cs', label: 'Čeština', subtitle: 'Tchèque', lang: 'cs', checked: false },
      { value: 'de', label: 'Deutsch', subtitle: 'Allemand', lang: 'de', checked: false },
      { value: 'en', label: 'English', subtitle: 'Anglais', lang: 'en', checked: false },
    ]);
    expect(model.rows.find((row) => row.value === 'fr')).toEqual({ value: 'fr', label: 'Français', subtitle: null, lang: 'fr', checked: false });
    // Plus de LANGUAGE_SEARCH_MIN langues : champ de recherche
    expect(model.search).toBe(true);
  });

  it('langue choisie cochée ; sous-titres dans la langue de l’interface', () => {
    setLocale('en');
    const model = languagePageModel(input({ setting: 'en', uiLocale: 'en', browserLocale: 'de' }));
    expect(model.auto).toMatchObject({ label: 'Automatic', subtitle: 'Browser language · Deutsch', checked: false });
    const row = (value: string): [string, string | null, boolean] | undefined => {
      const found = model.rows.find((r) => r.value === value);
      return found && [found.label, found.subtitle, found.checked];
    };
    expect(row('de')).toEqual(['Deutsch', 'German', false]);
    expect(row('en')).toEqual(['English', null, true]);
    expect(row('fr')).toEqual(['Français', 'French', false]);
    expect(row('zh-CN')).toEqual(['简体中文', 'Simplified Chinese', false]);
    expect(model.rows.filter((r) => r.checked).map((r) => r.value)).toEqual(['en']);
    setLocale('de');
    expect(languagePageModel(input({ uiLocale: 'de', browserLocale: 'de' })).auto.subtitle).toBe('Browsersprache · Deutsch');
  });

  it('recherche : filtre les langues, jamais « Automatique »', () => {
    setLocale('fr');
    expect(languagePageModel(input({ query: 'chinois' })).rows.map((row) => row.value)).toEqual(['zh-CN', 'zh-TW']);
    const none = languagePageModel(input({ query: 'klingon' }));
    expect(none.rows).toEqual([]);
    expect(none.auto.value).toBe('auto');
  });

  it('ligne « Aider à traduire » : seulement avec une adresse', () => {
    expect(languagePageModel(input()).translationUrl).toBeNull();
    expect(languagePageModel(input({ translationUrl: 'https://example.org/translate' })).translationUrl).toBe('https://example.org/translate');
  });
});
