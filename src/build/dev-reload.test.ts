import { describe, expect, it } from 'vitest';
import { devBuildChanged, devBuildPayload } from './dev-reload';

describe('devBuildChanged', () => {
  const stamp = '2026-10-16T08:00:00.000Z';

  it('même horodatage que le build qui tourne : rien à recharger', () => {
    expect(devBuildChanged(stamp, devBuildPayload(stamp))).toBe(false);
  });

  it('nouveau build écrit sur le disque : rechargement', () => {
    expect(devBuildChanged(stamp, devBuildPayload('2026-10-16T08:05:00.000Z'))).toBe(true);
  });

  it('fichier illisible, vide ou d’une autre forme : jamais de rechargement', () => {
    for (const body of ['', '{', 'null', '[]', '{"stamp":1}', '{"stamp":""}', '{}']) expect(devBuildChanged(stamp, body)).toBe(false);
  });
});
