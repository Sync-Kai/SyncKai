// Données de départ des scénarios : comptes connectés sans OAuth, séries, correspondances et réglages.
// Connexion simulée : tokens enregistrés dans l'ANCIEN format en clair (avant la 2.2.0, voir shared/storage.ts ›
// readStoredToken) ; le service worker les chiffre lui-même au premier accès (shared/token-access.ts), comme après une
// mise à jour. Le profil est ensuite lu par les vrais messages GET_VIEWER / GET_MAL_VIEWER (mis en cache, lié à la session).
import { expect } from 'vitest';
import { mappingKey } from '../../src/background/sync/matching';
import type { EpisodeInfo } from '../../src/shared/episode.types';
import { SETTINGS_STORAGE_KEY, type SyncSettings } from '../../src/shared/settings';
import { STORAGE_KEYS } from '../../src/protocol/storage-keys';
import type { MediaMapping } from '../../src/shared/sync.types';
import type { AniListAccountSeed, AniListEntrySeed, AniListMediaSeed, FakeAniList } from './fake-anilist';
import type { FakeMal, MalAccountSeed, MalAnimeSeed, MalListStatusSeed } from './fake-mal';
import type { ExtensionHarness } from './harness';

/** Expiration lointaine : jamais de renouvellement MAL pendant un test (myanimelist.net/v1/oauth2/token non simulé) */
const FAR_FUTURE_MS = 30 * 24 * 60 * 60 * 1000;

export const ANILIST_A = { token: 'e2e-anilist-token-account-A', viewer: { id: 5001, name: 'KaiFanA' } } as const;
export const ANILIST_B = { token: 'e2e-anilist-token-account-B', viewer: { id: 5002, name: 'KaiFanB' } } as const;
export const MAL_A = { token: 'e2e-mal-access-token-A', refreshToken: 'e2e-mal-refresh-token-A', user: { id: 7001, name: 'KaiFanMal' } } as const;

/** Série Crunchyroll d'un scénario : fiche AniList, fiche MAL, identifiant de série Crunchyroll */
export interface SeriesFixture {
  mediaId: number;
  malId: number;
  title: string;
  episodes: number;
  seriesId: string;
}

export const FRIEREN: SeriesFixture = { mediaId: 154587, malId: 52991, title: 'Frieren: Beyond Journey’s End', episodes: 28, seriesId: 'GG5H5XQX4' };
export const DUNGEON_MESHI: SeriesFixture = { mediaId: 153518, malId: 52701, title: 'Delicious in Dungeon', episodes: 24, seriesId: 'GXJHM3NJ5' };
export const BOCCHI: SeriesFixture = { mediaId: 130003, malId: 47917, title: 'BOCCHI THE ROCK!', episodes: 12, seriesId: 'GKEH2G428' };

/** Fiche du faux AniList, liée à la série Crunchyroll (comme les externalLinks réels) */
export function anilistMedia(series: SeriesFixture): AniListMediaSeed {
  return { id: series.mediaId, idMal: series.malId, title: series.title, episodes: series.episodes, externalLinks: [`https://www.crunchyroll.com/series/${series.seriesId}`] };
}

export function malAnime(series: SeriesFixture): MalAnimeSeed {
  return { id: series.malId, title: series.title, numEpisodes: series.episodes };
}

export function anilistAccount(account: typeof ANILIST_A | typeof ANILIST_B, entries: Record<number, AniListEntrySeed> = {}): AniListAccountSeed {
  return { token: account.token, viewer: account.viewer, entries };
}

export function malAccount(list: Record<number, MalListStatusSeed> = {}): MalAccountSeed {
  return { token: MAL_A.token, user: MAL_A.user, list };
}

/** Épisode `number` (saison 1) tel que l'envoie le script de contenu Crunchyroll */
export function crunchyrollEpisode(series: SeriesFixture, number: number): EpisodeInfo {
  return {
    platform: 'crunchyroll',
    episodeId: `GE${series.seriesId}E${number}`,
    seriesId: series.seriesId,
    seriesSlug: null,
    animeTitle: series.title,
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: number,
    displayedEpisodeNumber: number,
    episodeTitle: `Episode ${number}`,
    url: `https://www.crunchyroll.com/watch/GE${series.seriesId}E${number}/episode-${number}`,
  };
}

/**
 * Réglages déterministes : interface en anglais (textes attendus lus dans src/i18n/locales/en.json), alertes de sortie
 * coupées (l'alarme horaire interrogerait AniList une minute après la connexion).
 */
export async function seedSettings(h: ExtensionHarness, overrides: Partial<SyncSettings> = {}): Promise<void> {
  await h.setStorage({ [SETTINGS_STORAGE_KEY]: { language: 'en', airingAlerts: false, ...overrides } });
}

/** Tokens en clair (ancien format) : AniList `{ accessToken, expiresAt }`, MAL `{ accessToken, refreshToken, expiresAt }` */
export async function seedTokens(h: ExtensionHarness, accounts: { anilist?: string; mal?: boolean }): Promise<void> {
  const expiresAt = Date.now() + FAR_FUTURE_MS;
  await h.setStorage({
    ...(accounts.anilist !== undefined ? { [STORAGE_KEYS.anilistToken]: { accessToken: accounts.anilist, expiresAt } } : {}),
    ...(accounts.mal ? { [STORAGE_KEYS.malToken]: { accessToken: MAL_A.token, refreshToken: MAL_A.refreshToken, expiresAt } } : {}),
  });
}

/** Comptes connectés : tokens puis profils lus par l'extension (GET_VIEWER / GET_MAL_VIEWER), qui doivent réussir */
export async function signIn(h: ExtensionHarness, accounts: { anilist?: typeof ANILIST_A | typeof ANILIST_B; mal?: boolean }): Promise<void> {
  await seedTokens(h, { anilist: accounts.anilist?.token, mal: accounts.mal });
  if (accounts.anilist) expect(await h.send('GET_VIEWER', null)).toMatchObject({ ok: true, data: { id: accounts.anilist.viewer.id } });
  if (accounts.mal) expect(await h.send('GET_MAL_VIEWER', null)).toMatchObject({ ok: true, data: { id: MAL_A.user.id } });
}

export function seriesMappingKey(series: SeriesFixture): string {
  return mappingKey(crunchyrollEpisode(series, 1));
}

/** Correspondance saison Crunchyroll → fiche AniList déjà apprise (numérotation de la saison, sans décalage) */
export async function seedMapping(h: ExtensionHarness, ...series: SeriesFixture[]): Promise<void> {
  const mappings: Record<string, MediaMapping> = Object.fromEntries(
    series.map((s) => [seriesMappingKey(s), { mediaId: s.mediaId, numbering: 'season', offset: 0, episodes: s.episodes, seriesLabel: `${s.title} · S1`, mediaTitle: s.title }]),
  );
  await h.setStorage({ [STORAGE_KEYS.mediaMappings]: mappings });
}

/** Fin de scénario : aucune requête hors des routes prévues, aucune opération inconnue des faux, aucune erreur de page */
export function expectCleanRun(h: ExtensionHarness, anilist: FakeAniList, mal: FakeMal): void {
  expect(h.unexpected.map((r) => `${r.source} ${r.method} ${r.url}`)).toEqual([]);
  expect(anilist.unknownOperations).toEqual([]);
  expect(mal.unknownPaths).toEqual([]);
  expect(h.pageErrors).toEqual([]);
}
