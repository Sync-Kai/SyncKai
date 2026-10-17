import { describe, expect, it } from 'vitest';
import { entryLink, entryLinks, entryService, entryUrl } from './entry-link';

const BOTH = ['anilist', 'mal'] as const;
const FRIEREN = { mediaId: 154587, malId: 52991 };
const AL = 'https://anilist.co/anime/154587';
const MAL = 'https://myanimelist.net/anime/52991';

describe('entryUrl', () => {
  it('page de la fiche sur chaque service', () => {
    expect(entryUrl('anilist', 21)).toBe('https://anilist.co/anime/21');
    expect(entryUrl('mal', 21)).toBe('https://myanimelist.net/anime/21');
  });
});

describe('entryService', () => {
  it('un seul compte connecté : ce service, quel que soit le réglage', () => {
    expect(entryService({ connected: ['mal'], preferred: 'anilist' })).toBe('mal');
    expect(entryService({ connected: ['anilist'], preferred: 'mal' })).toBe('anilist');
  });

  it('deux comptes : le réglage', () => {
    expect(entryService({ connected: BOTH, preferred: 'anilist' })).toBe('anilist');
    expect(entryService({ connected: ['mal', 'anilist'], preferred: 'mal' })).toBe('mal');
  });

  it('aucun compte (accueil) : AniList', () => {
    expect(entryService({ connected: [], preferred: 'mal' })).toBe('anilist');
  });

  it('doublons ignorés : un seul service reste un seul service', () => {
    expect(entryService({ connected: ['mal', 'mal'], preferred: 'anilist' })).toBe('mal');
  });
});

describe('entryLink', () => {
  it('un seul compte connecté : sa fiche', () => {
    expect(entryLink(FRIEREN, { connected: ['anilist'], preferred: 'mal' })).toEqual({ service: 'anilist', url: AL });
    expect(entryLink(FRIEREN, { connected: ['mal'], preferred: 'anilist' })).toEqual({ service: 'mal', url: MAL });
  });

  it('deux comptes : fiche du service préféré', () => {
    expect(entryLink(FRIEREN, { connected: BOTH, preferred: 'anilist' })).toEqual({ service: 'anilist', url: AL });
    expect(entryLink(FRIEREN, { connected: BOTH, preferred: 'mal' })).toEqual({ service: 'mal', url: MAL });
  });

  it('aucun compte : AniList si l’identifiant est connu, sinon MyAnimeList', () => {
    expect(entryLink(FRIEREN, { connected: [], preferred: 'mal' })).toEqual({ service: 'anilist', url: AL });
    expect(entryLink({ mediaId: null, malId: 52991 }, { connected: [], preferred: 'anilist' })).toEqual({ service: 'mal', url: MAL });
  });

  it('identifiant absent sur le service choisi : repli sur l’autre service', () => {
    expect(entryLink({ mediaId: 154587, malId: null }, { connected: BOTH, preferred: 'mal' })).toEqual({ service: 'anilist', url: AL });
    expect(entryLink({ mediaId: 154587, malId: null }, { connected: ['mal'], preferred: 'mal' })).toEqual({ service: 'anilist', url: AL });
    expect(entryLink({ mediaId: null, malId: 52991 }, { connected: ['anilist'], preferred: 'anilist' })).toEqual({ service: 'mal', url: MAL });
  });

  it('aucun identifiant (ou identifiant invalide) : pas de lien', () => {
    expect(entryLink({ mediaId: null, malId: null }, { connected: BOTH, preferred: 'anilist' })).toBeNull();
    expect(entryLink({ mediaId: 0, malId: -3 }, { connected: BOTH, preferred: 'mal' })).toBeNull();
    expect(entryLink({ mediaId: 1.5, malId: null }, { connected: [], preferred: 'anilist' })).toBeNull();
  });
});

describe('entryLinks (« Ouvrir la fiche › » du menu « ⋯ »)', () => {
  it('deux comptes : les deux fiches, service préféré en tête', () => {
    expect(entryLinks(FRIEREN, { connected: BOTH, preferred: 'anilist' })).toEqual([
      { service: 'anilist', url: AL },
      { service: 'mal', url: MAL },
    ]);
    expect(entryLinks(FRIEREN, { connected: BOTH, preferred: 'mal' })).toEqual([
      { service: 'mal', url: MAL },
      { service: 'anilist', url: AL },
    ]);
  });

  it('un seul compte : sa fiche seulement', () => {
    expect(entryLinks(FRIEREN, { connected: ['mal'], preferred: 'anilist' })).toEqual([{ service: 'mal', url: MAL }]);
  });

  it('identifiant absent sur un service connecté : ce service est omis ; sur tous : repli de entryLink', () => {
    expect(entryLinks({ mediaId: 154587, malId: null }, { connected: BOTH, preferred: 'mal' })).toEqual([{ service: 'anilist', url: AL }]);
    expect(entryLinks({ mediaId: 154587, malId: null }, { connected: ['mal'], preferred: 'mal' })).toEqual([{ service: 'anilist', url: AL }]);
  });

  it('aucun identifiant : aucune fiche', () => {
    expect(entryLinks({ mediaId: null, malId: null }, { connected: BOTH, preferred: 'anilist' })).toEqual([]);
  });
});
