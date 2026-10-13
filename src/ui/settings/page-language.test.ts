import { afterEach, describe, expect, it } from 'vitest';
import { getLocale, setLocale } from '../../i18n';
import { languagePageModel, type LanguagePageInput } from './page-language';

const initial = getLocale();
afterEach(() => setLocale(initial));

const input = (patch: Partial<LanguagePageInput> = {}): LanguagePageInput => ({ setting: 'auto', uiLocale: 'fr', browserLocale: 'fr', query: '', translationUrl: null, ...patch });

describe('languagePageModel (Réglages › Langue)', () => {
  it('« Automatique » en tête, coché par défaut, avec la langue détectée ; puis Deutsch, English, Français', () => {
    setLocale('fr');
    const model = languagePageModel(input());
    expect(model.auto).toEqual({ value: 'auto', label: 'Automatique', subtitle: 'Langue du navigateur · Français', lang: null, checked: true });
    expect(model.rows).toEqual([
      { value: 'de', label: 'Deutsch', subtitle: 'Allemand', lang: 'de', checked: false },
      { value: 'en', label: 'English', subtitle: 'Anglais', lang: 'en', checked: false },
      { value: 'fr', label: 'Français', subtitle: null, lang: 'fr', checked: false },
    ]);
    // 3 langues : pas de champ de recherche
    expect(model.search).toBe(false);
  });

  it('langue choisie cochée ; sous-titres dans la langue de l’interface', () => {
    setLocale('en');
    const model = languagePageModel(input({ setting: 'en', uiLocale: 'en', browserLocale: 'de' }));
    expect(model.auto).toMatchObject({ label: 'Automatic', subtitle: 'Browser language · Deutsch', checked: false });
    expect(model.rows.map((row) => [row.label, row.subtitle, row.checked])).toEqual([
      ['Deutsch', 'German', false],
      ['English', null, true],
      ['Français', 'French', false],
    ]);
    setLocale('de');
    expect(languagePageModel(input({ uiLocale: 'de', browserLocale: 'de' })).auto.subtitle).toBe('Browsersprache · Deutsch');
  });

  it('champ masqué : une recherche en mémoire ne filtre rien', () => {
    setLocale('fr');
    expect(languagePageModel(input({ query: 'klingon' })).rows).toHaveLength(3);
  });

  it('ligne « Aider à traduire » : seulement avec une adresse', () => {
    expect(languagePageModel(input()).translationUrl).toBeNull();
    expect(languagePageModel(input({ translationUrl: 'https://example.org/translate' })).translationUrl).toBe('https://example.org/translate');
  });
});
