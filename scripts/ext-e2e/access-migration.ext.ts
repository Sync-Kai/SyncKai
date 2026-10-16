// Passage des motifs d'hôtes en https:// seulement (SEC-02) : un accès Netflix accordé par une version ≤ 2.3.1, sous
// l'ancien motif *://, doit rester reconnu après la mise à jour, et les scripts Netflix réenregistrés en https:// seulement.
// L'accès optionnel ne s'accorde pas sans le dialogue natif de permissions.request (inaccessible au protocole DevTools) :
// l'ancienne version le reçoit à l'installation, en accès obligatoire (même préférence « permissions actives » de Chrome,
// bornée à chaque chargement par les permissions obligatoires + optionnelles du manifeste).
// Lancement : npm run test:ext
import { describe, expect, it } from 'vitest';
import { startExtension, waitFor, type ManifestTransform } from './harness';
import { FakeAniList } from './fake-anilist';

const NETFLIX = 'https://*.netflix.com/*';
const LEGACY_NETFLIX = '*://*.netflix.com/*';

const legacy = (pattern: string): string => pattern.replace(/^https:\/\//, '*://');
const isSitePattern = (pattern: string): boolean => !/anilist\.co|myanimelist\.net/.test(pattern);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
const entries = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null) : [];

/**
 * Manifeste d'une version ≤ 2.3.1 : motifs des sites en *://, accès Netflix déjà accordé (en accès obligatoire, voir
 * l'en-tête), Disney+ et Prime Video toujours optionnels
 */
const legacyManifest: ManifestTransform = (manifest) => ({
  ...manifest,
  version: '2.3.1',
  host_permissions: [...strings(manifest.host_permissions).map((pattern) => (isSitePattern(pattern) ? legacy(pattern) : pattern)), LEGACY_NETFLIX],
  optional_host_permissions: strings(manifest.optional_host_permissions).filter((pattern) => pattern !== NETFLIX).map(legacy),
  content_scripts: entries(manifest.content_scripts).map((script) => ({ ...script, matches: strings(script.matches).map(legacy) })),
  web_accessible_resources: entries(manifest.web_accessible_resources).map((entry) => ({ ...entry, matches: strings(entry.matches).map(legacy) })),
});

interface AccessState {
  origins: string[];
  containsHttps: boolean;
  netflixScripts: { id: string; matches: string[] }[];
}

describe('Motifs https:// seulement (SEC-02)', () => {
  it('accès Netflix accordé en *:// par une version ≤ 2.3.1 : reconnu après la mise à jour, scripts en https:// seulement', async (context) => {
    const anilist = new FakeAniList({ media: [], accounts: [] });
    const h = await startExtension(context, { routes: [anilist.handler], manifest: legacyManifest });
    const read = async (): Promise<AccessState> =>
      (await h.bridge()).evaluate(async (pattern: string) => ({
        origins: (await chrome.permissions.getAll()).origins ?? [],
        containsHttps: await chrome.permissions.contains({ origins: [pattern] }),
        netflixScripts: (await chrome.scripting.getRegisteredContentScripts())
          .filter((script) => script.id.startsWith('synckai-netflix-'))
          .map((script) => ({ id: script.id, matches: script.matches ?? [] })),
      }), NETFLIX);

    // Ancienne version : accès accordé sous le motif *://
    const before = await read();
    expect(before.origins).toContain(LEGACY_NETFLIX);
    expect(before.containsHttps).toBe(true);

    // Mise à jour : manifeste de dist/ (motifs https://), version plus récente
    await h.restart({ manifest: (manifest) => manifest, version: '9.9.9' });
    const page = await h.bridge();
    expect(await page.evaluate(() => chrome.runtime.getManifest().version)).toBe('9.9.9');
    // onInstalled (update) : scripts réenregistrés si l'accès est reconnu
    const after = await waitFor('scripts Netflix réenregistrés', async () => {
      const state = await read();
      return state.netflixScripts.length === 2 ? state : null;
    });
    // Chrome réduit l'accès accordé au motif du nouveau manifeste (intersection kPatternsContainedByBoth)
    expect(after.origins).toContain(NETFLIX);
    expect(after.origins).not.toContain(LEGACY_NETFLIX);
    expect(after.origins.filter((origin) => !origin.startsWith('https://'))).toEqual([]);
    expect(after.containsHttps).toBe(true);
    expect(after.netflixScripts).toEqual([
      { id: 'synckai-netflix-bridge', matches: [NETFLIX] },
      { id: 'synckai-netflix-content', matches: [NETFLIX] },
    ]);

    // Retrait (Réglages) : le motif https:// suffit sur Chrome ; l'ancien motif, absent du manifeste, y est refusé
    const removal = await page.evaluate(async (patterns: { current: string; old: string }) => {
      const legacyError = await chrome.permissions.remove({ origins: [patterns.old] }).then(
        () => null,
        (error: unknown) => String(error),
      );
      const removed = await chrome.permissions.remove({ origins: [patterns.current] });
      return { legacyError, removed, contains: await chrome.permissions.contains({ origins: [patterns.current] }) };
    }, { current: NETFLIX, old: LEGACY_NETFLIX });
    expect(removal.legacyError).not.toBeNull();
    expect(removal).toMatchObject({ removed: true, contains: false });
    // permissions.onRemoved : scripts Netflix retirés
    await waitFor('scripts Netflix retirés', async () => ((await read()).netflixScripts.length === 0 ? true : null));
  });
});
