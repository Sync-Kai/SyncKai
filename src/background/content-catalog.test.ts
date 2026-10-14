import { describe, expect, it, vi } from 'vitest';
import { CONTENT_KEYS } from '../i18n/content-keys';
import de from '../i18n/locales/de.json';
import en from '../i18n/locales/en.json';
import { getContentCatalog } from './content-catalog';

describe('GET_CONTENT_CATALOG (service worker)', () => {
  it('les seules clés de contenu, dans l’ordre de CONTENT_KEYS, avec les textes de la langue', async () => {
    const catalog = await getContentCatalog('de');
    expect(Object.keys(catalog ?? {})).toEqual([...CONTENT_KEYS]);
    for (const key of CONTENT_KEYS) expect(catalog?.[key]).toBe(de[key]);
    expect((await getContentCatalog('en'))?.['common.retry']).toBe(en['common.retry']);
  });

  it('catalogue introuvable : null (le script de contenu reste en anglais), nouvel essai à la demande suivante', async () => {
    // Moteur neuf : anglais seul enregistré, chargeur simulé (src/test/setup.ts enregistre toutes les langues)
    vi.resetModules();
    const i18n = await import('../i18n');
    const { getContentCatalog: fresh } = await import('./content-catalog');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    i18n.setCatalogLoader(() => Promise.reject(new Error('fichier absent')));
    await expect(fresh('ja')).resolves.toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();

    i18n.setCatalogLoader(() => Promise.resolve({ ...en, 'common.retry': 'リトライ' }));
    const catalog = await fresh('ja');
    expect(catalog?.['common.retry']).toBe('リトライ');
    expect(catalog?.['common.close']).toBe(en['common.close']);
  });
});
