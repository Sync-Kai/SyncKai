import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_MAX_BYTES,
  BACKUP_STORAGE_KEYS,
  BACKUP_VERSION,
  backupFileName,
  bindBackupToSession,
  buildBackup,
  mergeBackup,
  parseBackup,
  sectionsFromStorage,
  summarizeBackup,
  type BackupData,
} from './backup';
import type { PendingRating } from './engagement.types';
import type { EpisodeInfo } from './episode.types';
import type { ExcludedSeries } from './exclusions';
import type { PendingReview, RecentSync } from './review.types';
import { DEFAULT_SETTINGS } from './settings';
import { MAX_RECENT_SYNCS } from './storage';
import type { MediaMapping } from './sync.types';

const NOW = new Date('2026-10-01T12:00:00.000Z');

const episode: EpisodeInfo = {
  platform: 'crunchyroll',
  episodeId: 'E1',
  seriesId: 'S1',
  seriesSlug: null,
  animeTitle: 'Frieren',
  seasonNumber: 1,
  seasonTitle: null,
  seasonEpisodeNumber: 3,
  displayedEpisodeNumber: 3,
  episodeTitle: null,
  url: 'https://www.crunchyroll.com/watch/E1',
};

const mapping = (mediaId: number): MediaMapping => ({ mediaId, numbering: 'displayed', offset: 0, episodes: 12 });
/** Clé au format de mappingKey */
const KEY = 'crunchyroll:GG5H5XQX4:s1';
const review = (key: string, createdAt: number): PendingReview => ({ key, episode, reason: 'r', suggestion: null, candidates: [], previous: null, createdAt });
const recent = (key: string, syncedAt: number): RecentSync => ({ key, episode, mediaId: 1, mediaTitle: 'T', progress: 3, syncedAt });
const exclusion = (id: string, mediaId: number | null = null): ExcludedSeries => ({ id, platformKey: id.startsWith('anilist:') ? null : id, mediaId, label: id, excludedAt: 1 });
const rating = (mediaId: number, completedAt: number): PendingRating => ({ id: `anilist:${mediaId}`, mediaId, malId: null, title: 'T', coverUrl: null, completedAt });

const emptyData = (): BackupData => ({
  settings: DEFAULT_SETTINGS,
  mediaMappings: {},
  pendingReviews: [],
  recentSyncs: [],
  excludedSeries: [],
  pendingRatings: [],
  rewatchDeclined: {},
});

function fileText(data: unknown, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: NOW.toISOString(), appVersion: '1.7.0', data, ...overrides });
}

describe('BACKUP_STORAGE_KEYS', () => {
  it('ne contient que les 7 clés sauvegardables (jamais les tokens ni les caches)', () => {
    expect(Object.values(BACKUP_STORAGE_KEYS).sort()).toEqual(
      ['excludedSeries', 'mediaMappings', 'pendingRatings', 'pendingReviews', 'recentSyncs', 'rewatchDeclined', 'settings'].sort(),
    );
  });

  it('sectionsFromStorage ignore les clés non sauvegardées', () => {
    const sections = sectionsFromStorage({ anilistToken: 'secret', malToken: 'secret', watchingCache: {}, settings: { autoSync: false } });
    expect(JSON.stringify(sections)).not.toContain('secret');
    expect(sections.settings).toEqual({ autoSync: false });
  });
});

describe('buildBackup', () => {
  it('produit l’en-tête et normalise les sections', () => {
    const backup = buildBackup(
      {
        settings: { autoSync: false, completionPercentage: 200 },
        mediaMappings: { a: mapping(1), b: { mediaId: 'x' } },
        pendingReviews: [review('k1', 1), 'junk'],
        recentSyncs: [recent('k1', 1)],
        excludedSeries: [exclusion('adn:1'), { id: 3 }],
        pendingRatings: [rating(5, 1), { ...rating(6, 1), id: 'anilist:999' }],
        rewatchDeclined: { 'anilist:1': 10, 'anilist:2': 'x' },
      },
      '1.7.0',
      NOW,
    );
    expect(backup).toMatchObject({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: NOW.toISOString(), appVersion: '1.7.0' });
    expect(backup.data.settings).toEqual({ ...DEFAULT_SETTINGS, autoSync: false, completionPercentage: 98 });
    expect(Object.keys(backup.data.mediaMappings)).toEqual(['a']);
    expect(backup.data.pendingReviews).toHaveLength(1);
    expect(backup.data.excludedSeries).toHaveLength(1);
    expect(backup.data.pendingRatings.map((r) => r.mediaId)).toEqual([5]);
    expect(backup.data.rewatchDeclined).toEqual({ 'anilist:1': 10 });
  });

  it('stockage vide : réglages par défaut et sections vides', () => {
    expect(buildBackup({}, '1.7.0', NOW).data).toEqual(emptyData());
  });

  it('trie les dernières synchros et les borne au maximum', () => {
    const syncs = Array.from({ length: 8 }, (_, i) => recent(`k${i}`, i));
    const { data } = buildBackup({ recentSyncs: syncs }, '1', NOW);
    expect(data.recentSyncs).toHaveLength(MAX_RECENT_SYNCS);
    expect(data.recentSyncs[0]?.syncedAt).toBe(7);
  });
});

describe('parseBackup', () => {
  it('relit une sauvegarde exportée à l’identique, correspondances marquées « à revérifier »', () => {
    const backup = buildBackup({ mediaMappings: { [KEY]: mapping(1) }, recentSyncs: [recent('k', 1)] }, '1.7.0', NOW);
    const result = parseBackup(JSON.stringify(backup));
    const expected = { ...backup, data: { ...backup.data, mediaMappings: { [KEY]: { ...mapping(1), unverified: true } } } };
    expect(result).toEqual({ ok: true, data: { backup: expected, invalidCount: 0 } });
  });

  it('rejette les correspondances suspectes : mediaId non entier ou négatif, décalage absurde, clé hors format (BAK-02)', () => {
    const result = parseBackup(
      fileText({
        mediaMappings: {
          [KEY]: mapping(1),
          'crunchyroll:GRMG8ZQZR:s1': { ...mapping(2), mediaId: 1.5 },
          'crunchyroll:GRMG8ZQZR:s2': { ...mapping(3), mediaId: -3 },
          'crunchyroll:GRMG8ZQZR:s0': { mediaId: 21, numbering: 'displayed', offset: -500, episodes: null },
          'crunchyroll:GRMG8ZQZR:s3': { ...mapping(4), offset: 2.5 },
          'crunchyroll:GRMG8ZQZR:s4': { ...mapping(5), episodes: 0 },
          'hidive:X:s1': mapping(6),
          'crunchyroll:GRMG8ZQZR': mapping(7),
          a: mapping(8),
        },
      }),
    );
    if (!result.ok) throw new Error(result.message);
    expect(Object.keys(result.data.backup.data.mediaMappings)).toEqual([KEY]);
    expect(result.data.invalidCount).toBe(8);
  });

  it('accepte les décalages réels (numérotation absolue, seconde partie numérotée depuis 1)', () => {
    const result = parseBackup(fileText({ mediaMappings: { 'crunchyroll:GRMG8ZQZR:s24': { ...mapping(21), offset: 1155 }, 'adn:1311:s2': { ...mapping(3), offset: -12 } } }));
    if (!result.ok) throw new Error(result.message);
    expect(Object.keys(result.data.backup.data.mediaMappings)).toHaveLength(2);
  });

  it('rejette un JSON invalide', () => {
    expect(parseBackup('{oops')).toMatchObject({ ok: false, code: 'INVALID_JSON' });
  });

  it('rejette un fichier trop volumineux', () => {
    expect(parseBackup(' '.repeat(BACKUP_MAX_BYTES + 1))).toMatchObject({ ok: false, code: 'TOO_LARGE' });
  });

  it('rejette un format inconnu', () => {
    expect(parseBackup('[]')).toMatchObject({ ok: false, code: 'INVALID_FORMAT' });
    expect(parseBackup('null')).toMatchObject({ ok: false, code: 'INVALID_FORMAT' });
    expect(parseBackup(fileText({}, { format: 'autre' }))).toMatchObject({ ok: false, code: 'INVALID_FORMAT' });
  });

  it('rejette une version non prise en charge', () => {
    expect(parseBackup(fileText({}, { version: 2 }))).toMatchObject({ ok: false, code: 'UNSUPPORTED_VERSION' });
    expect(parseBackup(fileText({}, { version: '1' }))).toMatchObject({ ok: false, code: 'UNSUPPORTED_VERSION' });
  });

  it('rejette un en-tête incomplet', () => {
    expect(parseBackup(fileText({}, { exportedAt: 'hier' }))).toMatchObject({ ok: false, code: 'INVALID_FORMAT' });
    expect(parseBackup(fileText({}, { appVersion: 3 }))).toMatchObject({ ok: false, code: 'INVALID_FORMAT' });
    expect(parseBackup(fileText([]))).toMatchObject({ ok: false, code: 'INVALID_FORMAT' });
    expect(parseBackup(fileText('x'))).toMatchObject({ ok: false, code: 'INVALID_FORMAT' });
  });

  it('ignore et compte les éléments invalides', () => {
    const result = parseBackup(
      fileText({
        settings: 'nope',
        mediaMappings: { [KEY]: mapping(1), 'adn:1:s1': null },
        pendingReviews: [review('k', 1), { key: 'k2' }],
        recentSyncs: 'nope',
        excludedSeries: [exclusion('adn:1'), exclusion('adn:1')],
        pendingRatings: [rating(1, 1), { ...rating(2, 1), coverUrl: 4 }],
        rewatchDeclined: { 'anilist:1': 5, 'anilist:2': null },
      }),
    );
    if (!result.ok) throw new Error(result.message);
    // settings + mapping b + review k2 + recentSyncs + rating 2 + decline 2 (doublon d'exclusion : ignoré sans être compté)
    expect(result.data.invalidCount).toBe(6);
    expect(result.data.backup.data.settings).toBeNull();
    expect(summarizeBackup(result.data.backup)).toEqual({
      settings: false,
      mediaMappings: 1,
      pendingReviews: 1,
      recentSyncs: 0,
      excludedSeries: 1,
      pendingRatings: 1,
      rewatchDeclined: 1,
    });
  });

  it('une carte de correction importée devient une vérification simple (previous → null)', () => {
    const correction: PendingReview = { ...review('k', 1), previous: { mediaId: 1, title: 'T', progress: 3 } };
    const result = parseBackup(fileText({ pendingReviews: [correction] }));
    if (!result.ok) throw new Error(result.message);
    expect(result.data.backup.data.pendingReviews).toEqual([{ ...correction, previous: null }]);
  });

  it('sections absentes : vides, sans erreur', () => {
    const result = parseBackup(fileText({}));
    expect(result).toEqual({ ok: true, data: { backup: expect.objectContaining({ data: { ...emptyData(), settings: null } }), invalidCount: 0 } });
  });

  it('traite une clé "__proto__" comme une donnée (refusée comme clé de correspondance)', () => {
    const result = parseBackup(
      fileText({
        mediaMappings: JSON.parse('{"__proto__": {"mediaId": 1, "numbering": "season", "offset": 0, "episodes": null}}'),
        rewatchDeclined: JSON.parse('{"__proto__": 5}'),
      }),
    );
    if (!result.ok) throw new Error(result.message);
    expect(Object.hasOwn(result.data.backup.data.mediaMappings, '__proto__')).toBe(false);
    expect(Object.getPrototypeOf(result.data.backup.data.mediaMappings)).toBe(Object.prototype);
    expect(Object.hasOwn(result.data.backup.data.rewatchDeclined, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(result.data.backup.data.rewatchDeclined)).toBe(Object.prototype);
  });

  it('normalise les réglages importés', () => {
    const result = parseBackup(fileText({ settings: { autoSync: false, notificationLevel: 'bogus' } }));
    if (!result.ok) throw new Error(result.message);
    expect(result.data.backup.data.settings).toEqual({ ...DEFAULT_SETTINGS, autoSync: false });
  });
});

describe('mergeBackup', () => {
  const current: BackupData = {
    ...emptyData(),
    settings: { ...DEFAULT_SETTINGS, autoSync: false },
    mediaMappings: { a: mapping(1), b: mapping(2) },
    pendingReviews: [review('r1', 5)],
    recentSyncs: [recent('s1', 10), recent('s2', 1)],
    excludedSeries: [exclusion('adn:1')],
    pendingRatings: [rating(1, 5)],
    rewatchDeclined: { 'anilist:1': 100, 'anilist:2': 50 },
  };
  const incoming: BackupData = {
    ...emptyData(),
    settings: { ...DEFAULT_SETTINGS, completionPercentage: 75 },
    mediaMappings: { a: mapping(99), c: mapping(3) },
    pendingReviews: [review('r1', 9), review('r2', 7)],
    recentSyncs: [recent('s1', 99), recent('s3', 5), recent('s4', 4), recent('s5', 3), recent('s6', 2)],
    excludedSeries: [{ ...exclusion('adn:1'), label: 'autre' }, exclusion('anilist:7', 7)],
    pendingRatings: [rating(1, 99), rating(2, 1)],
    rewatchDeclined: { 'anilist:1': 10, 'anilist:2': 80, 'anilist:3': 1 },
  };

  it('replace : les données importées remplacent tout', () => {
    expect(mergeBackup(current, incoming, 'replace', true)).toEqual(incoming);
  });

  it('replace sans les réglages : conserve les réglages actuels', () => {
    expect(mergeBackup(current, incoming, 'replace', false)).toEqual({ ...incoming, settings: current.settings });
  });

  it('merge : l’existant l’emporte en cas de conflit', () => {
    const merged = mergeBackup(current, incoming, 'merge');
    expect(merged.settings).toEqual(current.settings);
    expect(merged.mediaMappings).toEqual({ a: mapping(1), b: mapping(2), c: mapping(3) });
    expect(merged.pendingReviews.map((r) => [r.key, r.createdAt])).toEqual([
      ['r2', 7],
      ['r1', 5],
    ]);
    expect(merged.excludedSeries).toEqual([exclusion('adn:1'), { ...exclusion('anilist:7', 7) }]);
    expect(merged.pendingRatings.map((r) => [r.id, r.completedAt])).toEqual([
      ['anilist:1', 5],
      ['anilist:2', 1],
    ]);
    expect(merged.rewatchDeclined).toEqual({ 'anilist:1': 100, 'anilist:2': 80, 'anilist:3': 1 });
  });

  it('merge : dernières synchros triées et bornées', () => {
    const merged = mergeBackup(current, incoming, 'merge');
    expect(merged.recentSyncs.map((s) => [s.key, s.syncedAt])).toEqual([
      ['s1', 10],
      ['s3', 5],
      ['s4', 4],
      ['s5', 3],
      ['s6', 2],
    ]);
  });

  it('merge avec les réglages : reprend les réglages importés', () => {
    expect(mergeBackup(current, incoming, 'merge', true).settings).toEqual(incoming.settings);
  });

  it('réglages absents du fichier : conserve les actuels même si demandés', () => {
    expect(mergeBackup(current, { ...incoming, settings: null }, 'replace', true).settings).toEqual(current.settings);
  });

  it('merge : une exclusion qui partage la fiche AniList complète l’existante', () => {
    const cur: BackupData = { ...emptyData(), excludedSeries: [{ id: 'anilist:7', platformKey: null, mediaId: 7, label: 'X', excludedAt: 1 }] };
    const inc: BackupData = { ...emptyData(), excludedSeries: [{ id: 'adn:9', platformKey: 'adn:9', mediaId: 7, label: 'X', excludedAt: 2 }] };
    expect(mergeBackup(cur, inc, 'merge').excludedSeries).toEqual([{ id: 'anilist:7', platformKey: 'adn:9', mediaId: 7, label: 'X', excludedAt: 1 }]);
  });
});

describe('bindBackupToSession (DATA-01)', () => {
  it('notes et synchros importées rattachées aux sessions ouvertes, celles du fichier ignorées ; vérifications sans session', () => {
    const epochs = { anilist: 4, mal: 1 };
    const data: BackupData = {
      ...emptyData(),
      pendingReviews: [{ ...review('k1', 1), epochs: { anilist: 9 } }],
      recentSyncs: [recent('k1', 1), { ...recent('k2', 2), epochs: { anilist: 9 } }],
      pendingRatings: [rating(1, 1)],
    };
    const bound = bindBackupToSession(data, epochs);
    expect(bound.pendingReviews).toEqual([review('k1', 1)]);
    expect(bound.recentSyncs).toEqual([{ ...recent('k1', 1), epochs }, { ...recent('k2', 2), epochs }]);
    expect(bound.pendingRatings).toEqual([{ ...rating(1, 1), epochs }]);
  });
});

describe('backupFileName', () => {
  it('utilise la date locale AAAA-MM-JJ', () => {
    expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe('synckai-sauvegarde-2026-01-05.json');
  });
});
