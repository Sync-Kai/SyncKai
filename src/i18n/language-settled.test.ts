import { describe, expect, it, vi } from 'vitest';
import { catalogOf } from '../test/catalogs';

// languageSettled : le service worker attend la dernière demande de langue avant de traduire une réponse (message
// d'erreur redemandé par l'écran dès sa propre bascule). Moteur neuf, catalogues servis à la main.
async function freshCore(): Promise<{ core: typeof import('./core'); serve: (locale: 'fr' | 'de') => void }> {
  vi.resetModules();
  const core = await import('./core');
  const waiting = new Map<string, () => void>();
  core.setCatalogLoader((locale) => new Promise((resolve) => waiting.set(locale, () => resolve(catalogOf(locale)))));
  return { core, serve: (locale) => waiting.get(locale)?.() };
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('languageSettled', () => {
  it('aucune demande : langue active tout de suite', async () => {
    const { core } = await freshCore();
    await expect(core.languageSettled()).resolves.toBe('en');
  });

  it('attend le catalogue de la demande en cours, puis la demande arrivée pendant l’attente', async () => {
    const { core, serve } = await freshCore();
    void core.applyLanguageSetting('fr');
    let settled: string | null = null;
    void core.languageSettled().then((locale) => (settled = locale));
    void core.applyLanguageSetting('de');
    // Chargeur appelé au tour suivant (loadLocale)
    await tick();
    serve('fr');
    await tick();
    // « fr » chargé mais dépassé par « de » : toujours en attente
    expect(settled).toBeNull();
    serve('de');
    await vi.waitFor(() => expect(settled).toBe('de'));
    expect(core.getLocale()).toBe('de');
  });
});
