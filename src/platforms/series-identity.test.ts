import { describe, expect, it } from 'vitest';
import { exclusionKey, exclusionKeyCovers, exclusionKeyYear, seriesKey } from './series-identity';

// Identité d'une série (D1, décision 7) : clé de série (exclusions, séries ignorées) et clé d'exclusion avec l'année de
// début de la série quand elle est connue (remakes au même titre sur Disney+ / Prime Video).

const berserk = (seriesYear?: number, seasonNumber: number | null = 1, seasonYear?: number) => ({
  platform: 'prime' as const,
  seriesId: null,
  animeTitle: 'Berserk',
  seasonNumber,
  ...(seriesYear !== undefined || seasonYear !== undefined
    ? { signals: { ...(seriesYear !== undefined ? { seriesYear } : {}), ...(seasonYear !== undefined ? { seasonYear } : {}) } }
    : {}),
});

describe('seriesKey', () => {
  it('identifiant de série quand la plateforme en donne un, sinon le titre', () => {
    expect(seriesKey({ platform: 'crunchyroll', seriesId: 'GRMG8ZQZR', animeTitle: 'One Piece' })).toBe('crunchyroll:GRMG8ZQZR');
    expect(seriesKey({ platform: 'adn', seriesId: null, animeTitle: 'Tougen Anki' })).toBe('adn:title:tougen anki');
    expect(seriesKey({ platform: 'netflix', seriesId: '80987039', animeTitle: 'Mushoku Tensei' })).toBe('netflix:80987039');
  });

  it('Disney+ et Prime Video : toujours par titre, même quand la page de série connaît l’uuid / le GTI', () => {
    expect(seriesKey({ platform: 'disney', seriesId: '5d6e6a2f-8f4e-4c0b-9d7a-1c2b3a4d5e6f', animeTitle: 'Undead Unluck' })).toBe('disney:title:undead unluck');
    expect(seriesKey({ platform: 'prime', seriesId: '0GMSR5LDQCKJ3B0DQAYCSQIR2W', animeTitle: 'Tokyo Ghoul' })).toBe('prime:title:tokyo ghoul');
  });
});

describe('exclusionKey', () => {
  it('Berserk 1997 / 2016 sur Prime Video : année de début de la série dans la clé', () => {
    expect(exclusionKey(berserk(1997))).toBe('prime:title:berserk:y1997');
    expect(exclusionKey(berserk(2016))).toBe('prime:title:berserk:y2016');
    expect(seriesKey(berserk(2016))).toBe('prime:title:berserk');
  });

  it('saison 1 sans année de série (Prime Video) : son année est celle du début de la série', () => {
    expect(exclusionKey(berserk(undefined, 1, 2016))).toBe('prime:title:berserk:y2016');
    // Saison 2 d'un remake : autre année que le début de la série, jamais dans la clé
    expect(exclusionKey(berserk(undefined, 2, 2017))).toBe('prime:title:berserk');
    expect(exclusionKey(berserk(undefined, null, 2016))).toBe('prime:title:berserk');
  });

  it('année inconnue : clé de série seule', () => {
    expect(exclusionKey(berserk())).toBe('prime:title:berserk');
  });

  it('identifiant de série : jamais d’année (Crunchyroll, Netflix)', () => {
    expect(exclusionKey({ platform: 'crunchyroll', seriesId: 'GRMG8ZQZR', animeTitle: 'One Piece', seasonNumber: 1, signals: { seriesYear: 1999, seasonYear: 1999 } })).toBe('crunchyroll:GRMG8ZQZR');
    expect(exclusionKey({ platform: 'netflix', seriesId: '80987039', animeTitle: 'Mushoku', seasonNumber: 1, signals: { seasonYear: 2021 } })).toBe('netflix:80987039');
  });

  it('Disney+ : la clé est par titre même avec l’uuid, année de la série comprise', () => {
    expect(exclusionKey({ platform: 'disney', seriesId: '5d6e6a2f-8f4e-4c0b-9d7a-1c2b3a4d5e6f', animeTitle: 'Undead Unluck', seasonNumber: 1, signals: { seriesYear: 2023 } })).toBe(
      'disney:title:undead unluck:y2023',
    );
  });
});

describe('exclusionKeyCovers (règle prudente, décision 7)', () => {
  const NO_YEAR = 'prime:title:berserk';
  const Y1997 = 'prime:title:berserk:y1997';
  const Y2016 = 'prime:title:berserk:y2016';
  // [exclusion enregistrée, épisode / page, couvert]
  const TABLE: [string, string, boolean][] = [
    // Requête avec année : même année ou exclusion sans année (anciennes exclusions : les deux remakes)
    [Y2016, Y2016, true],
    [Y1997, Y2016, false],
    [NO_YEAR, Y2016, true],
    // Requête sans année : toute exclusion de ce titre (jamais de synchro d'une série exclue à l'année inconnue)
    [Y2016, NO_YEAR, true],
    [Y1997, NO_YEAR, true],
    [NO_YEAR, NO_YEAR, true],
    // Autre titre, autre plateforme
    [Y2016, 'prime:title:berserk of gluttony:y2016', false],
    [NO_YEAR, 'prime:title:berserk of gluttony', false],
    [NO_YEAR, 'disney:title:berserk', false],
    // Identifiants de série : égalité stricte, aucune année
    ['crunchyroll:GRMG8ZQZR', 'crunchyroll:GRMG8ZQZR', true],
    ['crunchyroll:GRMG8ZQZR', 'crunchyroll:GRMG8ZQZX', false],
    ['crunchyroll:GRMG8ZQZR', 'crunchyroll:title:one piece', false],
  ];

  it.each(TABLE)('%s couvre %s → %s', (excluded, query, covered) => {
    expect(exclusionKeyCovers(excluded, query)).toBe(covered);
  });

  it('année d’une clé d’exclusion (titre seulement)', () => {
    expect(exclusionKeyYear(Y2016)).toBe(2016);
    expect(exclusionKeyYear(NO_YEAR)).toBeNull();
    expect(exclusionKeyYear('crunchyroll:GRMG8ZQZR')).toBeNull();
  });
});
