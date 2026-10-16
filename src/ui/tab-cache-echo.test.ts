import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOwnWrites, isForeignCacheChange, OWN_WRITES_KEPT } from './tab-cache-echo';

// Anti-écho du cache de la fiche de l'onglet : seules les fiches réécrites ou effacées par un AUTRE relancent la lecture

function entry(resolvedAt: number): Record<string, unknown> {
  return { pageKey: 'crunchyroll:FRIEREN', episodeId: null, partial: false, resolvedAt, source: 'resolve', epochs: {}, view: { media: { mediaId: 1 }, lists: [] } };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createOwnWrites', () => {
  it('horodatages uniques même dans la même milliseconde', () => {
    vi.useFakeTimers({ now: 5_000 });
    const own = createOwnWrites();
    expect([own.stamp(), own.stamp(), own.stamp()]).toEqual([5_000, 5_001, 5_002]);
    expect(own.has(5_001)).toBe(true);
    expect(own.has(4_999)).toBe(false);
  });

  it(`seules les ${OWN_WRITES_KEPT} dernières écritures sont retenues`, () => {
    vi.useFakeTimers({ now: 1 });
    const own = createOwnWrites();
    const stamps = Array.from({ length: OWN_WRITES_KEPT + 1 }, () => own.stamp());
    expect(own.has(stamps[0] ?? -1)).toBe(false);
    expect(own.has(stamps.at(-1) ?? -1)).toBe(true);
  });
});

describe('isForeignCacheChange', () => {
  it('écho de sa propre écriture : ignoré', () => {
    const own = createOwnWrites();
    const at = own.stamp();
    expect(isForeignCacheChange({ newValue: entry(at) }, own)).toBe(false);
  });

  it('fiche réécrite ailleurs (synchro, autre écran) : à relire', () => {
    const own = createOwnWrites();
    own.stamp();
    expect(isForeignCacheChange({ newValue: entry(1) }, own)).toBe(true);
  });

  it('fiche effacée (forgetCachedPageMedia) : à relire ; effacement d’une valeur illisible ou valeur illisible : ignoré', () => {
    const own = createOwnWrites();
    expect(isForeignCacheChange({ oldValue: entry(1) }, own)).toBe(true);
    expect(isForeignCacheChange({ oldValue: { x: 1 } }, own)).toBe(false);
    expect(isForeignCacheChange({ newValue: { x: 1 } }, own)).toBe(false);
  });
});
