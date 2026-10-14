import { beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogOf, routeCatalogs } from '../test/catalogs';
import { installFakeChrome } from '../test/fake-chrome';
import { installFakeDocument, type FakeDocument } from '../test/fake-document';

// initI18n est mémoïsé : module neuf pour chaque test (ARCH-01, PERF-03). Moteur neuf : anglais embarqué, autres
// langues lues par le chargeur de i18n/index.ts (fetch simulé, servi depuis src/i18n/locales)
const fake = installFakeChrome({ language: 'fr' });
let page: FakeDocument;
/** Langues demandées au chargeur (fichiers du paquet) */
const requested: string[] = [];

async function freshI18n(): Promise<typeof import('./index')> {
  vi.resetModules();
  return import('./index');
}

beforeEach(() => {
  fake.reset({ settings: { language: 'en' } });
  requested.length = 0;
  routeCatalogs(fake.fetch, requested);
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
    // Anglais embarqué : aucun fichier lu
    expect(requested).toEqual([]);
  });

  it('un changement de langue ultérieur (relecture des réglages) ne touche pas non plus <html lang>', async () => {
    const i18n = await freshI18n();
    await i18n.initI18n({ setDocumentLang: false, follow: false });
    await expect(i18n.applyLanguageSetting('de')).resolves.toBe('de');
    expect(i18n.getLocale()).toBe('de');
    expect(page.documentElement.lang).toBe('es-419');
  });
});

describe('initI18n dans une page de l’extension', () => {
  it('écrit <html lang> et suit la langue des réglages, catalogue lu à la demande avant le changement', async () => {
    const i18n = await freshI18n();
    await i18n.initI18n();
    expect(page.documentElement.lang).toBe('en');
    expect(fake.local.onChanged.hasListeners()).toBe(true);

    const changes: string[] = [];
    i18n.onLocaleChange((locale) => changes.push(`${locale}:${i18n.t('common.close')}`));
    await fake.local.set({ settings: { language: 'de' } });
    await vi.waitFor(() => expect(i18n.getLocale()).toBe('de'));
    expect(page.documentElement.lang).toBe('de');
    // Abonnés prévenus une fois le catalogue enregistré : textes déjà traduits
    expect(changes).toEqual([`de:${catalogOf('de')['common.close']}`]);
    expect(requested).toEqual(['de']);
  });

  it('langue du navigateur (auto) chargée avant la fin de initI18n ; repli sur l’anglais si le fichier manque', async () => {
    fake.reset({ settings: { language: 'auto' } });
    routeCatalogs(fake.fetch, requested);
    let i18n = await freshI18n();
    await expect(i18n.initI18n()).resolves.toBe('fr');
    expect(i18n.t('common.close')).toBe(catalogOf('fr')['common.close']);
    expect(page.documentElement.lang).toBe('fr');

    // Fichier du paquet introuvable : anglais, consigné
    fake.reset({ settings: { language: 'ja' } });
    fake.fetch.on(/\/locales\//, () => new Response('', { status: 404 }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    i18n = await freshI18n();
    await expect(i18n.initI18n()).resolves.toBe('en');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
