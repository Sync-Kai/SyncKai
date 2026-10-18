import { describe, expect, it, vi } from 'vitest';
import { consumeReopenRequest, loadOrReload, type ReloadDeps } from './lazy-module';

// Module chargé à la demande (Réglages) dont le fichier a disparu : page ouverte pendant une reconstruction de dist/
// (rapport du 2026-10-18 : « Failed to fetch dynamically imported module …/settings-view-CY37PaZP.js », 15 fois, et le
// bouton Réglages ne faisait plus rien jusqu'à la réouverture du panneau)

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

function deps(now = 1_000_000): ReloadDeps & { reload: ReturnType<typeof vi.fn<() => void>> } {
  return { storage: memoryStorage(), reload: vi.fn<() => void>(), now: () => now };
}

const missingChunk = (): Promise<never> => Promise.reject(new TypeError('Failed to fetch dynamically imported module: chrome-extension://id/assets/settings-view-CY37PaZP.js'));

describe('loadOrReload', () => {
  it('module chargé : rendu tel quel, aucune relecture de la page', async () => {
    const d = deps();
    expect(await loadOrReload(async () => 'vue', 'settings', d)).toBe('vue');
    expect(d.reload).not.toHaveBeenCalled();
  });

  it('fichier du module introuvable : page rechargée une fois, réouverture demandée', async () => {
    const d = deps();
    expect(await loadOrReload(missingChunk, 'settings', d)).toBeNull();
    expect(d.reload).toHaveBeenCalledTimes(1);
    expect(consumeReopenRequest('settings', d)).toBe(true);
    // Lue une seule fois
    expect(consumeReopenRequest('settings', d)).toBe(false);
  });

  it('échec juste après un rechargement : pas de boucle, échec rendu (nouvel essai au prochain clic)', async () => {
    const d = deps();
    await loadOrReload(missingChunk, 'settings', d);
    consumeReopenRequest('settings', d);
    expect(await loadOrReload(missingChunk, 'settings', d)).toBeNull();
    expect(d.reload).toHaveBeenCalledTimes(1);
  });

  it('autre erreur (exception du module) : jamais de rechargement', async () => {
    const d = deps();
    expect(await loadOrReload(() => Promise.reject(new Error('boom')), 'settings', d)).toBeNull();
    expect(d.reload).not.toHaveBeenCalled();
    expect(consumeReopenRequest('settings', d)).toBe(false);
  });

  it('stockage de session indisponible : rechargement quand même, sans réouverture', async () => {
    const d = deps();
    d.storage = null;
    expect(await loadOrReload(missingChunk, 'settings', d)).toBeNull();
    expect(d.reload).toHaveBeenCalledTimes(1);
    expect(consumeReopenRequest('settings', d)).toBe(false);
  });
});
