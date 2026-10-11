import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeChrome } from '../test/fake-chrome';
import { installFakeDocument, type FakeDocument } from '../test/fake-document';

// initI18n est mémoïsé : module neuf pour chaque test (ARCH-01, PERF-03)
const fake = installFakeChrome({ language: 'fr' });
let page: FakeDocument;

async function freshI18n(): Promise<typeof import('./index')> {
  vi.resetModules();
  return import('./index');
}

beforeEach(() => {
  fake.reset({ settings: { language: 'en' } });
  // Page Crunchyroll en espagnol d'Amérique latine
  page = installFakeDocument('es-419');
});

describe('initI18n dans un script de contenu', () => {
  it('applique la langue des réglages sans toucher <html lang> ni poser d’écouteur', async () => {
    const i18n = await freshI18n();
    await expect(i18n.initI18n({ setDocumentLang: false, follow: false })).resolves.toBe('en');
    expect(page.documentElement.lang).toBe('es-419');
    expect(fake.local.onChanged.hasListeners()).toBe(false);
    expect(fake.onStorageChanged.hasListeners()).toBe(false);
  });

  it('un changement de langue ultérieur (relecture des réglages) ne touche pas non plus <html lang>', async () => {
    const i18n = await freshI18n();
    await i18n.initI18n({ setDocumentLang: false, follow: false });
    i18n.applyLanguageSetting('de');
    expect(i18n.getLocale()).toBe('de');
    expect(page.documentElement.lang).toBe('es-419');
  });
});

describe('initI18n dans une page de l’extension', () => {
  it('écrit <html lang> et suit la langue des réglages', async () => {
    const i18n = await freshI18n();
    await i18n.initI18n();
    expect(page.documentElement.lang).toBe('en');
    expect(fake.local.onChanged.hasListeners()).toBe(true);

    await fake.local.set({ settings: { language: 'de' } });
    expect(i18n.getLocale()).toBe('de');
    expect(page.documentElement.lang).toBe('de');
  });
});
