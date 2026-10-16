import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { STORAGE_LOCK } from '../../browser/storage/lock-core';
import type { MediaMapping } from '../../shared/sync.types';
import { installFakeChrome } from '../../test/fake-chrome';
import type { AniListMedia } from '../anilist/media';
import type { RequestLane } from '../rate-limit';

// Purge unique (2.3.0) des correspondances apprises avant SYNC-01 vers une autre série de la plateforme.
// Catalogue AniList simulé ; stockage et verrou réels (fausse API chrome).

const api = vi.hoisted(() => ({ getAnimeByIds: vi.fn<(ids: readonly number[], lane?: RequestLane) => Promise<AniListMedia[]>>() }));
vi.mock('../anilist/media', () => api);

const fake = installFakeChrome();
const { belongsToOtherSeries, markOtherSeriesPurgePending, purgeOtherSeriesMappings, runPendingOtherSeriesPurge, seriesSlugFromLabel, slugFromTitle } =
  await import('./mapping-purge');
const { saveChosen } = await import('../../browser/storage/mappings');

const SHIPPUDEN = 'GYQ4MW246';
const NARUTO_SERIES = 'GY9VWW3XY';
const PURGE_FLAG = STORAGE_KEYS.otherSeriesPurge;

// Données AniList relevées : Naruto (20) → http://www.crunchyroll.com/naruto ; Shippuden (1735) → …/naruto-shippuden
const catalog: Record<number, string[]> = {
  20: ['http://www.crunchyroll.com/naruto', 'https://www.netflix.com/title/70205012'],
  1735: ['http://www.crunchyroll.com/naruto-shippuden', 'http://www.crunchyroll.com/naruto-shippuden-dubs'],
  // Fiche liée par identifiant à une autre série Crunchyroll (la série Naruto)
  900: ['https://www.crunchyroll.com/series/GY9VWW3XY/naruto'],
  // Aucun lien de plateforme
  901: ['https://twitter.com/naruto_info'],
  // Liée par identifiant à une autre série ET à la série elle-même : gardée
  902: ['https://www.crunchyroll.com/series/GY9VWW3XY/naruto', 'https://www.crunchyroll.com/fr/series/GYQ4MW246/naruto-shippuden'],
  // Tensura : ancien slug anglais, titre traduit sur la page (libellé français)
  101280: ['http://www.crunchyroll.com/that-time-i-got-reincarnated-as-a-slime'],
  // ADN : identifiant explicite d'une autre série, puis de la série elle-même
  910: ['https://animationdigitalnetwork.fr/video/999-naruto'],
  911: ['https://animationdigitalnetwork.com/video/1311-naruto-shippuden'],
};

const media = (id: number): AniListMedia => ({
  id,
  idMal: null,
  format: 'TV',
  episodes: 220,
  startDate: null,
  displayTitle: `#${id}`,
  titles: [],
  year: null,
  coverUrl: null,
  externalLinkUrls: catalog[id] ?? [],
  relations: [],
});

const mapping = (mediaId: number, seriesLabel?: string): MediaMapping => ({
  mediaId,
  numbering: 'season',
  offset: 0,
  episodes: 220,
  ...(seriesLabel !== undefined ? { seriesLabel } : {}),
});

const storedMappings = (): Record<string, unknown> => {
  const raw = fake.local.peek(STORAGE_KEYS.mediaMappings);
  return typeof raw === 'object' && raw !== null ? { ...raw } : {};
};

beforeEach(() => {
  fake.reset();
  api.getAnimeByIds.mockReset();
  api.getAnimeByIds.mockImplementation(async (ids) => ids.filter((id) => id in catalog).map(media));
});

describe('slug de la série déduit du libellé', () => {
  it('titre de la série seul, au format des URL de la plateforme', () => {
    expect(seriesSlugFromLabel('Naruto Shippuden · S1', 1)).toBe('naruto-shippuden');
    expect(seriesSlugFromLabel('One Piece · S24 (Elbaph)', 24)).toBe('one-piece');
    expect(seriesSlugFromLabel('BLEACH: Thousand-Year Blood War · S1 (The Separation)', 1)).toBe('bleach-thousand-year-blood-war');
    expect(seriesSlugFromLabel('Frieren', 0)).toBe('frieren');
    expect(slugFromTitle('JoJo’s Bizarre Adventure')).toBe('jojos-bizarre-adventure');
    expect(slugFromTitle('Héros')).toBe('heros');
  });

  it('libellé absent, ambigu ou sans caractère latin : aucun slug', () => {
    expect(seriesSlugFromLabel(undefined, 1)).toBeNull();
    expect(seriesSlugFromLabel('Mushoku Tensei (Jobless Reincarnation)', 0)).toBeNull();
    expect(seriesSlugFromLabel('進撃の巨人 · S1', 1)).toBeNull();
  });
});

describe('belongsToOtherSeries', () => {
  const check = (id: number, seriesId: string, slug: string | null, platform: 'crunchyroll' | 'adn' = 'crunchyroll'): boolean =>
    belongsToOtherSeries(media(id), platform, seriesId, slug);

  it('Naruto sur la page Shippuden : ancien slug « naruto », début de « naruto-shippuden »', () => {
    expect(check(20, SHIPPUDEN, 'naruto-shippuden')).toBe(true);
    // Sans slug (libellé absent) : l'ancien lien seul ne prouve rien
    expect(check(20, SHIPPUDEN, null)).toBe(false);
  });

  it('fiche liée à la série elle-même (slug, version doublée, identifiant) : jamais', () => {
    expect(check(20, NARUTO_SERIES, 'naruto')).toBe(false);
    expect(check(1735, SHIPPUDEN, 'naruto-shippuden')).toBe(false);
    expect(check(902, SHIPPUDEN, null)).toBe(false);
    expect(check(911, '1311', null, 'adn')).toBe(false);
  });

  it('identifiant explicite d’une autre série : oui, même sans slug', () => {
    expect(check(900, SHIPPUDEN, null)).toBe(true);
    expect(check(910, '1311', null, 'adn')).toBe(true);
  });

  it('slug simplement différent (titre traduit) ou aucun lien de plateforme : non', () => {
    expect(check(101280, 'GYZJ43JMR', slugFromTitle('Moi, quand je me réincarne en Slime'))).toBe(false);
    expect(check(901, SHIPPUDEN, 'naruto-shippuden')).toBe(false);
  });
});

describe('purgeOtherSeriesMappings', () => {
  it('oublie Naruto sur Shippuden et la fiche d’une autre série, garde le reste', async () => {
    fake.local.seed({
      [STORAGE_KEYS.mediaMappings]: {
        [`crunchyroll:${SHIPPUDEN}:s1`]: mapping(20, 'Naruto Shippuden · S1'),
        [`crunchyroll:${SHIPPUDEN}:s2`]: mapping(900, 'Naruto Shippuden · S2'),
        [`crunchyroll:${SHIPPUDEN}:s3`]: mapping(1735, 'Naruto Shippuden · S3'),
        [`crunchyroll:${NARUTO_SERIES}:s1`]: mapping(20, 'Naruto · S1'),
        'crunchyroll:GRNOLINK:s1': mapping(901, 'Boruto · S1'),
        // Avant la 1.1 : pas de libellé, donc pas de slug
        'crunchyroll:GYOLDLBL:s1': mapping(20),
        'crunchyroll:GYZJ43JMR:s1': mapping(101280, 'Moi, quand je me réincarne en Slime · S1'),
        'adn:1311:s1': mapping(910, 'Naruto Shippuden · S1'),
        'adn:1311:s2': mapping(911, 'Naruto Shippuden · S2'),
        // Fiche absente de la réponse (supprimée d'AniList) : aucune preuve
        'crunchyroll:GRGONE:s1': mapping(404, 'Disparue · S1'),
      },
    });

    expect(await purgeOtherSeriesMappings()).toBe(3);
    expect(Object.keys(storedMappings()).sort()).toEqual(
      [
        `crunchyroll:${SHIPPUDEN}:s3`,
        `crunchyroll:${NARUTO_SERIES}:s1`,
        'crunchyroll:GRNOLINK:s1',
        'crunchyroll:GYOLDLBL:s1',
        'crunchyroll:GYZJ43JMR:s1',
        'adn:1311:s2',
        'crunchyroll:GRGONE:s1',
      ].sort(),
    );
  });

  it('fiches demandées une seule fois, par lots de 50, sur la file de fond ; clés par titre ignorées', async () => {
    const mappings: Record<string, MediaMapping> = {
      'disney:title:undead unluck:s1': mapping(1),
      'crunchyroll:title:frieren:s1': mapping(2),
    };
    for (let id = 1000; id < 1120; id++) mappings[`crunchyroll:GR${id}:s1`] = mapping(id, `Série ${id} · S1`);
    mappings['crunchyroll:GRDOUBLE:s2'] = mapping(1000, 'Série 1000 · S2');
    fake.local.seed({ [STORAGE_KEYS.mediaMappings]: mappings });

    expect(await purgeOtherSeriesMappings()).toBe(0);
    const batches = api.getAnimeByIds.mock.calls.map(([ids]) => [...ids]);
    expect(batches.map((ids) => ids.length)).toEqual([50, 50, 20]);
    expect(batches.flat()).not.toContain(1);
    expect(batches.flat()).not.toContain(2);
    expect(api.getAnimeByIds.mock.calls.every(([, lane]) => lane === 'background')).toBe(true);
  });

  it('catalogue lu hors du verrou du stockage, suppression sous le verrou', async () => {
    fake.local.seed({ [STORAGE_KEYS.mediaMappings]: { [`crunchyroll:${SHIPPUDEN}:s1`]: mapping(20, 'Naruto Shippuden · S1') } });
    const lockHeldDuringFetch: boolean[] = [];
    api.getAnimeByIds.mockImplementation(async (ids) => {
      lockHeldDuringFetch.push(fake.locks.isHeld(STORAGE_LOCK));
      return ids.map(media);
    });

    expect(await purgeOtherSeriesMappings()).toBe(1);
    expect(lockHeldDuringFetch).toEqual([false]);
    expect(fake.locks.requested).toContain(STORAGE_LOCK);
  });

  it('correspondance réécrite pendant la vérification : gardée', async () => {
    const key = `crunchyroll:${SHIPPUDEN}:s1`;
    fake.local.seed({ [STORAGE_KEYS.mediaMappings]: { [key]: mapping(20, 'Naruto Shippuden · S1') } });
    api.getAnimeByIds.mockImplementation(async (ids) => {
      // L'utilisateur choisit Shippuden pendant la requête
      await saveChosen(key, mapping(1735, 'Naruto Shippuden · S1'));
      return ids.map(media);
    });

    expect(await purgeOtherSeriesMappings()).toBe(0);
    expect(storedMappings()[key]).toEqual({ ...mapping(1735, 'Naruto Shippuden · S1'), chosen: true });
  });

  it('entrées illisibles conservées', async () => {
    fake.local.seed({
      [STORAGE_KEYS.mediaMappings]: {
        [`crunchyroll:${SHIPPUDEN}:s1`]: mapping(20, 'Naruto Shippuden · S1'),
        [`crunchyroll:${SHIPPUDEN}:s9`]: { mediaId: 'vingt', format: 'futur' },
        'futur:clé': 42,
      },
    });

    expect(await purgeOtherSeriesMappings()).toBe(1);
    expect(storedMappings()).toEqual({ [`crunchyroll:${SHIPPUDEN}:s9`]: { mediaId: 'vingt', format: 'futur' }, 'futur:clé': 42 });
  });

  it('erreur réseau : rien n’est supprimé, l’erreur remonte', async () => {
    const stored = { [`crunchyroll:${SHIPPUDEN}:s1`]: mapping(20, 'Naruto Shippuden · S1') };
    fake.local.seed({ [STORAGE_KEYS.mediaMappings]: stored });
    api.getAnimeByIds.mockRejectedValue(new Error('AniList injoignable'));

    await expect(purgeOtherSeriesMappings()).rejects.toThrow('AniList injoignable');
    expect(storedMappings()).toEqual(stored);
  });

  it('aucune correspondance vérifiable : aucune requête', async () => {
    fake.local.seed({ [STORAGE_KEYS.mediaMappings]: { 'disney:title:undead unluck:s1': mapping(1), 'adn:title:tougen anki:s1': mapping(2) } });
    expect(await purgeOtherSeriesMappings()).toBe(0);
    expect(api.getAnimeByIds).not.toHaveBeenCalled();
  });
});

describe('purgeOtherSeriesMappings — Netflix (série en plusieurs saisons, Ranma1/2)', () => {
  it('correspondance vers une suite (saison 3 retenue pour la saison 1) : oubliée ; vers une 1re saison : gardée', async () => {
    const sequelOf = (id: number, prequel: number): AniListMedia => ({ ...media(id), relations: [{ relationType: 'PREQUEL', id: prequel, type: 'ANIME', format: 'TV' }] });
    api.getAnimeByIds.mockImplementation(async (ids) =>
      ids.flatMap((id) => (id === 209872 ? [sequelOf(209872, 185731)] : id === 178533 ? [{ ...media(178533), relations: [{ relationType: 'SEQUEL', id: 185731, type: 'ANIME', format: 'TV' }] }] : [])),
    );
    fake.local.seed({
      [STORAGE_KEYS.mediaMappings]: { 'netflix:81171925:s1': mapping(209872, 'Ranma1/2 · S1'), 'netflix:80000001:s1': mapping(178533, 'Autre · S1') },
    });
    expect(await purgeOtherSeriesMappings()).toBe(1);
    expect(Object.keys(storedMappings())).toEqual(['netflix:80000001:s1']);
  });
});

describe('runPendingOtherSeriesPurge', () => {
  const NARUTO_ON_SHIPPUDEN = { [`crunchyroll:${SHIPPUDEN}:s1`]: mapping(20, 'Naruto Shippuden · S1') };

  it('rien en attente : une lecture du stockage, aucune requête', async () => {
    fake.local.seed({ [STORAGE_KEYS.mediaMappings]: NARUTO_ON_SHIPPUDEN });
    await runPendingOtherSeriesPurge();
    expect(api.getAnimeByIds).not.toHaveBeenCalled();
    expect(storedMappings()).toEqual(NARUTO_ON_SHIPPUDEN);
  });

  it('en attente puis réussie : correspondance oubliée, purge terminée', async () => {
    fake.local.seed({ [STORAGE_KEYS.mediaMappings]: NARUTO_ON_SHIPPUDEN });
    await markOtherSeriesPurgePending();
    await runPendingOtherSeriesPurge();
    expect(storedMappings()).toEqual({});
    expect(fake.local.peek(PURGE_FLAG)).toBeUndefined();
  });

  it('AniList injoignable : rien supprimé, purge toujours en attente, puis réussie au démarrage suivant', async () => {
    fake.local.seed({ [STORAGE_KEYS.mediaMappings]: NARUTO_ON_SHIPPUDEN });
    await markOtherSeriesPurgePending();
    api.getAnimeByIds.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(runPendingOtherSeriesPurge()).resolves.toBeUndefined();
    expect(storedMappings()).toEqual(NARUTO_ON_SHIPPUDEN);
    expect(fake.local.peek(PURGE_FLAG)).toBe('pending');

    await runPendingOtherSeriesPurge();
    expect(storedMappings()).toEqual({});
    expect(fake.local.peek(PURGE_FLAG)).toBeUndefined();
  });
});
