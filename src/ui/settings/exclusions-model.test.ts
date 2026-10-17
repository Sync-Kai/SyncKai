import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getLocale, setLocale } from '../../i18n';
import type { ExcludedSeries } from '../../shared/exclusions';
import { exclusionRows } from './exclusions-model';

const NOW = new Date(2026, 9, 17, 12).getTime();

function excluded(id: string, patch: Partial<ExcludedSeries> = {}): ExcludedSeries {
  return { id, platformKey: id, mediaId: null, label: id, excludedAt: NOW, ...patch };
}

describe('exclusionRows', () => {
  const initial = getLocale();
  beforeEach(() => setLocale('fr'));
  afterEach(() => setLocale(initial));

  it('plus récente d’abord ; plateforme, année de la série (clé par titre) et date d’exclusion', () => {
    const rows = exclusionRows(
      [
        excluded('netflix:81000', { label: 'Pokémon Horizons', excludedAt: new Date(2026, 8, 12).getTime() }),
        excluded('prime:title:berserk:y1997', { label: 'Berserk', excludedAt: new Date(2026, 9, 3).getTime() }),
      ],
      NOW,
    );
    expect(rows.map((r) => [r.id, r.platform, r.meta])).toEqual([
      ['prime:title:berserk:y1997', 'prime', 'Prime Video · série de 1997 · exclue le 3 oct.'],
      ['netflix:81000', 'netflix', 'Netflix · exclue le 12 sept.'],
    ]);
  });

  it('autre année : la date la précise ; exclusion par fiche AniList seule : pas de plateforme ; date absente : omise', () => {
    const rows = exclusionRows(
      [
        excluded('crunchyroll:GRMG8ZQZR', { label: 'Frieren', excludedAt: new Date(2025, 11, 24).getTime() }),
        excluded('anilist:154587', { platformKey: null, mediaId: 154587, label: 'Dandadan', excludedAt: 0 }),
      ],
      NOW,
    );
    expect(rows.map((r) => [r.platform, r.meta])).toEqual([
      ['crunchyroll', 'Crunchyroll · exclue le 24 déc. 2025'],
      [null, ''],
    ]);
  });
});
