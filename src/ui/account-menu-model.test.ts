import { describe, expect, it } from 'vitest';
import type { AniListViewer } from '../shared/anilist.types';
import type { MalViewer } from '../shared/mal.types';
import { ACCOUNT_STATS_TTL_MS, formatStatDays, menuNeedsRefresh, profileUrl, statsView } from './account-menu-model';
import { LOGGED_OUT, type AccountState } from './state';

// Menu du compte de la barre d'état : relecture du profil et de ses statistiques à l'ouverture, état des tuiles,
// lien du profil, jours arrondis

const NOW = 1_800_000_000_000;
const STATS = { animeCount: 142, episodes: 3210, days: 54.3 };
const ANILIST: AniListViewer = { id: 5, name: 'Kai', siteUrl: 'https://anilist.co/user/Kai', avatarUrl: null, stats: STATS };
const MAL: MalViewer = { id: 7, name: 'Kai fan', pictureUrl: null, stats: STATS };
const IN = (viewer: AniListViewer | MalViewer | null, error: string | null = null): AccountState<AniListViewer | MalViewer> => ({ status: 'logged-in', viewer, error });

describe('menuNeedsRefresh (une requête par ouverture au plus)', () => {
  it('profil lu il y a moins d’une heure, avec ses statistiques : rien n’est relu', () => {
    expect(menuNeedsRefresh(IN(ANILIST), NOW - ACCOUNT_STATS_TTL_MS + 1, NOW)).toBe(false);
  });

  it('plus d’une heure, date inconnue ou du futur, statistiques jamais lues (profil d’avant) : relu', () => {
    expect(menuNeedsRefresh(IN(ANILIST), NOW - ACCOUNT_STATS_TTL_MS, NOW)).toBe(true);
    expect(menuNeedsRefresh(IN(ANILIST), null, NOW)).toBe(true);
    expect(menuNeedsRefresh(IN(ANILIST), NOW + 1, NOW)).toBe(true);
    const { stats: _stats, ...legacy } = ANILIST;
    expect(menuNeedsRefresh(IN(legacy), NOW, NOW)).toBe(true);
  });

  it('profil en cours de lecture (démarrage) : pas de seconde requête ; lecture en échec : nouvel essai ; hors session : rien', () => {
    expect(menuNeedsRefresh(IN(null), null, NOW)).toBe(false);
    expect(menuNeedsRefresh(IN(null, 'réseau'), null, NOW)).toBe(true);
    expect(menuNeedsRefresh({ ...LOGGED_OUT, expired: true }, null, NOW)).toBe(false);
    expect(menuNeedsRefresh({ status: 'loading' }, null, NOW)).toBe(false);
  });
});

describe('statsView (tuiles)', () => {
  it('statistiques connues : affichées, même pendant une relecture (pas de saut)', () => {
    expect(statsView(IN(ANILIST), false)).toEqual(STATS);
    expect(statsView(IN(ANILIST), true)).toEqual(STATS);
  });

  it('pendant la lecture : squelette ; illisibles ou en échec : masquées', () => {
    expect(statsView(IN(null), false)).toBe('loading');
    expect(statsView(IN({ ...ANILIST, stats: null }), true)).toBe('loading');
    expect(statsView(IN({ ...ANILIST, stats: null }), false)).toBe('hidden');
    expect(statsView(IN(null, 'réseau'), false)).toBe('hidden');
    expect(statsView({ ...LOGGED_OUT, expired: true }, false)).toBe('hidden');
  });
});

describe('profileUrl', () => {
  it('AniList : siteUrl du profil ; MAL : page profile du nom (encodé)', () => {
    expect(profileUrl(ANILIST)).toBe('https://anilist.co/user/Kai');
    expect(profileUrl(MAL)).toBe('https://myanimelist.net/profile/Kai%20fan');
  });
});

describe('formatStatDays', () => {
  it('entier à partir de 10 jours (« 54 j »), une décimale en dessous, format de la langue', () => {
    expect(formatStatDays(54.3, 'fr')).toBe('54');
    expect(formatStatDays(54.6, 'en')).toBe('55');
    expect(formatStatDays(2.46, 'fr')).toBe('2,5');
    expect(formatStatDays(0.09, 'en')).toBe('0.1');
    expect(formatStatDays(1234.4, 'en')).toBe('1,234');
  });
});
