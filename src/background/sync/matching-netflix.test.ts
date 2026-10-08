import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n';
import type { EpisodeInfo } from '../../shared/episode.types';
import { gateByPlatformLink, matchNetflixLink, matchPlatformLink, resolveTarget, type MediaCandidate, type ResolveResult } from './matching';

// Netflix (catalogue généraliste) : correspondance par lien AniList → /title/{showId}, filtre « anime ».
setLocale('fr');

const SHOW_ID = '80987039';

function candidate(overrides: Partial<MediaCandidate> & Pick<MediaCandidate, 'id'>): MediaCandidate {
  return { format: 'TV', episodes: 12, startDate: null, titles: [], link: null, ...overrides };
}

/** Épisode Netflix tel que le produira l'adapter (numérotation : section 5 de l'architecture) */
function netflixEpisode(overrides: Partial<EpisodeInfo> = {}): EpisodeInfo {
  return {
    platform: 'netflix',
    episodeId: '81402901',
    seriesId: SHOW_ID,
    seriesSlug: null,
    animeTitle: 'Mushoku Tensei: Jobless Reincarnation',
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: 1,
    displayedEpisodeNumber: 1,
    episodeTitle: null,
    url: 'https://www.netflix.com/watch/81402901',
    ...overrides,
  };
}

describe('matchNetflixLink', () => {
  it('reconnaît /title/{showId}, avec ou sans pays (ou pays-langue)', () => {
    expect(matchNetflixLink(`https://www.netflix.com/title/${SHOW_ID}`, SHOW_ID)).toBe('id');
    expect(matchNetflixLink(`https://www.netflix.com/be-fr/title/${SHOW_ID}`, SHOW_ID)).toBe('id');
    expect(matchNetflixLink(`https://netflix.com/us/title/${SHOW_ID}/`, SHOW_ID)).toBe('id');
    expect(matchNetflixLink(`https://www.netflix.com/title/${SHOW_ID}?s=a&trkid=1`, SHOW_ID)).toBe('id');
  });

  it('rejette une autre série, une page de lecture, un autre site ou une URL invalide', () => {
    expect(matchNetflixLink('https://www.netflix.com/title/81234567', SHOW_ID)).toBeNull();
    expect(matchNetflixLink(`https://www.netflix.com/watch/${SHOW_ID}`, SHOW_ID)).toBeNull();
    expect(matchNetflixLink('https://www.netflix.com/us/title/', SHOW_ID)).toBeNull();
    expect(matchNetflixLink(`https://www.notnetflix.com/title/${SHOW_ID}`, SHOW_ID)).toBeNull();
    expect(matchNetflixLink(`https://www.crunchyroll.com/title/${SHOW_ID}`, SHOW_ID)).toBeNull();
    expect(matchNetflixLink('pas une url', SHOW_ID)).toBeNull();
    expect(matchNetflixLink(`https://www.netflix.com/title/${SHOW_ID}`, null)).toBeNull();
  });

  it('matchPlatformLink : règle Netflix pour un épisode Netflix uniquement', () => {
    const url = `https://www.netflix.com/title/${SHOW_ID}`;
    expect(matchPlatformLink(url, 'netflix', SHOW_ID, null)).toBe('id');
    expect(matchPlatformLink(url, 'crunchyroll', SHOW_ID, null)).toBeNull();
    expect(matchPlatformLink('https://www.crunchyroll.com/series/GRMG8ZQZR', 'netflix', 'GRMG8ZQZR', null)).toBeNull();
  });
});

describe('gateByPlatformLink', () => {
  const highResult: ResolveResult = {
    ok: true,
    target: { mediaId: 1, numbering: 'season', offset: 0, episodes: 12, progress: 3, confidence: 'high', reason: 'Seule fiche AniList portant ce titre (saison 1)' },
  };

  it('fiche liée à la série Netflix (ou suite liée) : résultat inchangé', () => {
    const linked = [candidate({ id: 1, titles: ['Autre titre'], link: 'id' })];
    expect(gateByPlatformLink(netflixEpisode(), linked, highResult)).toBe(highResult);
    const relation = [candidate({ id: 1, titles: ['Autre titre'], link: 'relation' })];
    expect(gateByPlatformLink(netflixEpisode(), relation, highResult)).toBe(highResult);
  });

  it('sans lien mais au même titre : correspondance à vérifier (confiance basse) ; échec inchangé', () => {
    const sameTitle = [candidate({ id: 1, titles: ['Mushoku Tensei: Jobless Reincarnation'] })];
    expect(gateByPlatformLink(netflixEpisode(), sameTitle, highResult)).toEqual({
      ok: true,
      target: { ...(highResult.ok ? highResult.target : {}), confidence: 'low', reason: 'Trouvée par le titre seul (aucune fiche AniList liée à cette série Netflix)' },
    });
    const failure: ResolveResult = { ok: false, reason: 'Impossible de déterminer la saison AniList correspondante' };
    expect(gateByPlatformLink(netflixEpisode(), sameTitle, failure)).toBe(failure);
  });

  it('ni lien ni titre identique : série ignorée (probablement pas un anime)', () => {
    const unrelated = [candidate({ id: 9, titles: ['Mushoku no Eiyuu'] })];
    expect(gateByPlatformLink(netflixEpisode({ animeTitle: 'Wednesday' }), unrelated, highResult)).toEqual({
      ok: false,
      reason: 'Aucune fiche AniList trouvée pour « Wednesday »',
      ignored: true,
    });
    expect(gateByPlatformLink(netflixEpisode({ animeTitle: 'Wednesday' }), [], { ok: false, reason: 'x' })).toMatchObject({ ok: false, ignored: true });
  });

  it('Crunchyroll et ADN ne sont jamais filtrés', () => {
    const unrelated = [candidate({ id: 9, titles: ['Autre'] })];
    expect(gateByPlatformLink(netflixEpisode({ platform: 'crunchyroll' }), unrelated, highResult)).toBe(highResult);
    expect(gateByPlatformLink(netflixEpisode({ platform: 'adn' }), [], { ok: false, reason: 'x' })).toEqual({ ok: false, reason: 'x' });
  });
});

describe('Mushoku Tensei sur Netflix (S1 23 ép., S2 25 ép., numérotation continue)', () => {
  // Fiches AniList : la 1re liée à /title/80987039, les suites rattachées par relation (voir collectCandidates)
  const mushoku = [
    candidate({ id: 108465, episodes: 11, startDate: 20210111, titles: ['Mushoku Tensei: Isekai Ittara Honki Dasu', 'Mushoku Tensei: Jobless Reincarnation'], link: 'id' }),
    candidate({ id: 127720, episodes: 12, startDate: 20211004, titles: ['Mushoku Tensei: Isekai Ittara Honki Dasu Part 2', 'Mushoku Tensei: Jobless Reincarnation Cour 2'], link: 'relation' }),
    candidate({ id: 146065, episodes: 12, startDate: 20230703, titles: ['Mushoku Tensei II: Isekai Ittara Honki Dasu', 'Mushoku Tensei: Jobless Reincarnation Season 2'], link: 'relation' }),
    candidate({ id: 166873, episodes: 12, startDate: 20240408, titles: ['Mushoku Tensei II: Isekai Ittara Honki Dasu Part 2', 'Mushoku Tensei: Jobless Reincarnation Season 2 Part 2'], link: 'relation' }),
  ];
  const resolve = (episode: EpisodeInfo): ResolveResult => gateByPlatformLink(episode, mushoku, resolveTarget(episode, mushoku));

  it('S1 E15 (seq 15, affiché 15) → « Part 2 », épisode 4', () => {
    expect(resolve(netflixEpisode({ seasonNumber: 1, seasonEpisodeNumber: 15, displayedEpisodeNumber: 15 }))).toMatchObject({
      ok: true,
      target: { mediaId: 127720, progress: 4, confidence: 'high' },
    });
  });

  it('S2 E1 (seq 1, affiché 24) → « Mushoku Tensei II », épisode 1', () => {
    expect(resolve(netflixEpisode({ seasonNumber: 2, seasonEpisodeNumber: 1, displayedEpisodeNumber: 24 }))).toMatchObject({
      ok: true,
      target: { mediaId: 146065, progress: 1, confidence: 'high' },
    });
  });

  it('mêmes fiches sans lien Netflix : jamais fiable, à vérifier', () => {
    const unlinked = mushoku.map((c) => ({ ...c, link: null }));
    const episode = netflixEpisode({ seasonNumber: 1, seasonEpisodeNumber: 3, displayedEpisodeNumber: 3 });
    expect(gateByPlatformLink(episode, unlinked, resolveTarget(episode, unlinked))).toMatchObject({
      ok: true,
      target: { mediaId: 108465, progress: 3, confidence: 'low', reason: 'Trouvée par le titre seul (aucune fiche AniList liée à cette série Netflix)' },
    });
  });
});
