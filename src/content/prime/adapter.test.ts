import { describe, expect, it } from 'vitest';
import { reducePrimeDetail, reducePrimeDetailWidgets, type PrimeTitle } from '../../shared/prime-metadata';
import type { ReceivedCatalog } from './bridge-client';
import { reducePrimeCatalog, type PrimeWidgetsEntry } from './bridge-protocol';
import {
  BUMPKIN_S1_COMPACT,
  BUMPKIN_TITLE,
  bumpkinCatalog,
  bumpkinDetailBody,
  bumpkinDetailWidgets,
  bumpkinEpisodeGti,
  hydrationDocument,
  SEEN_AT,
} from './fixtures';
import {
  choosePrimeVideo,
  episodeAliases,
  episodeInfoFromPrime,
  isAdPlaying,
  playingCatalog,
  readPrimePlayback,
  seriesInfoFromPrime,
  titleForEpisode,
  type PrimeVideoCandidate,
} from './adapter';

const PAGE = `/region/eu/detail/${BUMPKIN_S1_COMPACT}`;
const PAGE_URL = `https://www.primevideo.com${PAGE}`;

function catalog(n: number, options: { seenAt?: number; id?: string; seriesTitle?: string; type?: string } = {}): ReceivedCatalog {
  const raw = bumpkinCatalog(n, options.seriesTitle);
  if (options.type) Reflect.set(Reflect.get(Reflect.get(Reflect.get(raw, 'resources') as object, 'catalogMetadataV2') as object, 'catalog') as object, 'type', options.type);
  const entry = reducePrimeCatalog(raw, options.id ?? bumpkinEpisodeGti(n), options.seenAt ?? SEEN_AT);
  if (!entry) throw new Error('fixture invalide');
  return { ...entry, path: PAGE };
}

function title(options: Parameters<typeof bumpkinDetailBody>[0] = {}): PrimeTitle {
  const reduced = reducePrimeDetail(hydrationDocument(bumpkinDetailBody(options)));
  if (!reduced) throw new Error('fixture invalide');
  return reduced;
}

function widgets(playing: number, seenAt = SEEN_AT + 200): PrimeWidgetsEntry {
  const reduced = reducePrimeDetailWidgets(bumpkinDetailWidgets(playing));
  if (!reduced) throw new Error('fixture invalide');
  return { seenAt, widgets: reduced };
}

describe('épisode en lecture', () => {
  it('dernières métadonnées du lecteur, sur la page où elles ont été reçues seulement', () => {
    const entry = catalog(2);
    expect(playingCatalog(entry, PAGE)).toBe(entry);
    expect(playingCatalog(entry, '/region/eu/detail/0OTHERPAGE0000000000000000')).toBeNull();
    expect(playingCatalog(null, PAGE)).toBeNull();
  });

  it('recoupement avec bestSelf : même numéro d’épisode → identifiant ajouté ; autre numéro ou trop loin → ignoré', () => {
    const OTHER_ID = 'B0ABCDEF12';
    const entry = catalog(2, { id: OTHER_ID });
    expect(episodeAliases(entry, [widgets(2)])).toEqual([OTHER_ID, bumpkinEpisodeGti(2)]);
    expect(episodeAliases(entry, [widgets(3)])).toEqual([OTHER_ID]);
    expect(episodeAliases(entry, [widgets(2, SEEN_AT + 60_000)])).toEqual([OTHER_ID]);
    expect(episodeAliases(catalog(2), [widgets(2)])).toEqual([bumpkinEpisodeGti(2)]);
  });

  it('page de détail : celle qui liste l’épisode, sinon celle des widgets, sinon la page affichée de la même série', () => {
    const season = title();
    const entry = catalog(3);
    expect(titleForEpisode(entry, [entry.id], [season], [], null)?.seasonGti).toBe(season.seasonGti);
    const unlisted = catalog(9, { id: 'B0ABCDEF12' });
    expect(titleForEpisode(unlisted, [unlisted.id], [season], [], null)).toBeNull();
    expect(titleForEpisode(unlisted, [unlisted.id], [], [], season)?.seasonGti).toBe(season.seasonGti);
    const otherShow = catalog(1, { seriesTitle: 'Another Show' });
    expect(titleForEpisode({ ...otherShow, seasonNumber: 2 }, ['B0ABCDEF12'], [], [], season)).toBeNull();
    // Autre série lancée depuis le lecteur (URL inchangée), même numéro de saison : jamais la page affichée (son verdict « anime »)
    expect(titleForEpisode({ ...otherShow, id: 'B0ABCDEF12' }, ['B0ABCDEF12'], [], [], season)).toBeNull();
    // Titre de série inconnu dans le lecteur : même saison que la page affichée
    expect(titleForEpisode({ ...unlisted, seriesTitle: null }, [unlisted.id], [], [], season)?.seasonGti).toBe(season.seasonGti);
    // Widgets de la même saison : épisodes complétés
    expect(titleForEpisode(entry, [entry.id], [title({ episodes: 2 })], [widgets(3)], null)?.episodes).toHaveLength(4);
  });
});

describe('episodeInfoFromPrime', () => {
  it('anime (animation + piste japonaise) : série, saison, numéro dans la saison, clé par titre', () => {
    const entry = catalog(2);
    expect(episodeInfoFromPrime(entry, [entry.id], title(), PAGE_URL)).toEqual({
      platform: 'prime',
      episodeId: bumpkinEpisodeGti(2),
      seriesId: null,
      seriesSlug: null,
      animeTitle: BUMPKIN_TITLE,
      seasonNumber: 1,
      seasonTitle: null,
      seasonEpisodeNumber: 2,
      displayedEpisodeNumber: 2,
      episodeTitle: 'The Old Country Bumpkin is Astounded by a Wizard',
      url: `https://www.primevideo.com/detail/${BUMPKIN_S1_COMPACT}`,
      primeAnime: 'animation-ja',
      // Signaux de la saison : releaseYear (nombre), 4 épisodes de 1440 s
      signals: { seasonYear: 2025, seasonEpisodeCount: 4, episodeMinutes: 24, format: 'series' },
    });
  });

  it('signaux de la page seulement pour un épisode de cette saison (lecture automatique vers la saison 2, URL inchangée)', () => {
    const next = catalog(1, { id: 'amzn1.dv.gti.e860c26c-0000-4000-8000-000000000201' });
    const s2 = { ...next, seasonNumber: 2 };
    // Page affichée = saison 1 (même série) : verdict repris, signaux de la saison 1 jamais attribués à la saison 2
    expect(episodeInfoFromPrime(s2, [s2.id], title(), PAGE_URL)).not.toHaveProperty('signals');
    // Saison 1 sans année : les autres signaux restent
    expect(episodeInfoFromPrime(catalog(2), [bumpkinEpisodeGti(2)], title({ releaseYear: null }), PAGE_URL)?.signals).toEqual({ seasonEpisodeCount: 4, episodeMinutes: 24, format: 'series' });
  });

  it('verdict transmis ; pas d’animation, genres illisibles ou page inconnue : rien (silencieux)', () => {
    const entry = catalog(1);
    expect(episodeInfoFromPrime(entry, [entry.id], title({ genres: ['av_genre_anime'] }), PAGE_URL)?.primeAnime).toBe('anime');
    expect(episodeInfoFromPrime(entry, [entry.id], title({ audioTracks: ['English'] }), PAGE_URL)?.primeAnime).toBe('animation-exact-only');
    expect(episodeInfoFromPrime(entry, [entry.id], title({ genres: ['av_genre_drama'] }), PAGE_URL)).toBeNull();
    expect(episodeInfoFromPrime(entry, [entry.id], null, PAGE_URL)).toBeNull();
  });

  it('mention de version retirée du titre ; film : épisode 1 sans saison', () => {
    const dub = catalog(1, { seriesTitle: 'Attack on Titan (English Dubbed)' });
    expect(episodeInfoFromPrime(dub, [dub.id], title({ genres: ['av_genre_anime'] }), PAGE_URL)?.animeTitle).toBe('Attack on Titan');
    const movie = catalog(1, { type: 'MOVIE' });
    expect(episodeInfoFromPrime(movie, [movie.id], title({ genres: ['av_genre_anime'] }), PAGE_URL)).toMatchObject({
      seasonNumber: null,
      seasonEpisodeNumber: 1,
      displayedEpisodeNumber: 1,
      episodeTitle: null,
    });
  });
});

describe('seriesInfoFromPrime', () => {
  it('page de saison : GTI compact, titre de série, saison, nombre d’épisodes, verdict', () => {
    expect(seriesInfoFromPrime(title(), BUMPKIN_S1_COMPACT)).toEqual({
      seriesId: BUMPKIN_S1_COMPACT,
      seriesSlug: null,
      seriesTitle: BUMPKIN_TITLE,
      seasonNumber: 1,
      seasonTitle: null,
      seasonEpisodeCount: 4,
      primeAnime: 'animation-ja',
      signals: { seasonYear: 2025, seasonEpisodeCount: 4, episodeMinutes: 24, format: 'series' },
    });
  });

  it('pas un anime : rien à afficher', () => {
    expect(seriesInfoFromPrime(title({ genres: ['av_genre_comedy'] }), BUMPKIN_S1_COMPACT)).toBeNull();
  });
});

describe('choosePrimeVideo', () => {
  const video = (paused: boolean, duration: number, isConnected = true): PrimeVideoCandidate => ({ paused, duration, isConnected });
  const trailer = video(true, 63);

  it('durée de l’épisode d’abord, jamais la bande-annonce en pause', () => {
    const main = video(false, 1441);
    expect(choosePrimeVideo([trailer, main], 1441)).toBe(main);
    expect(choosePrimeVideo([trailer, video(true, 133)], null)).toBeNull();
    expect(choosePrimeVideo([video(false, 1441, false), trailer], 1441)).toBeNull();
  });

  it('bascule de la lecture automatique (durée NaN) : lecteur principal retenu, en pause ou non', () => {
    const switching = video(false, Number.NaN);
    expect(choosePrimeVideo([trailer, switching], 1441)).toBe(switching);
    const loading = video(true, Number.NaN);
    expect(choosePrimeVideo([trailer, loading], 1441)).toBe(loading);
  });

  it('durée attendue inconnue : vidéo en lecture plutôt qu’en pause', () => {
    const paused = video(true, 1440);
    const playing = video(false, 1440);
    expect(choosePrimeVideo([paused, playing], null)).toBe(playing);
  });
});

describe('position de lecture et publicités', () => {
  const ad = (text: string | null, visible: boolean): { querySelector: () => { textContent: string | null; getClientRects: () => { length: number } } | null } => ({
    querySelector: () => ({ textContent: text, getClientRects: () => ({ length: visible ? 1 : 0 }) }),
  });

  it('compte à rebours visible et non vide : publicité', () => {
    expect(isAdPlaying(ad('0:25', true))).toBe(true);
    expect(isAdPlaying(ad('0:25', false))).toBe(false);
    expect(isAdPlaying(ad('  ', true))).toBe(false);
    expect(isAdPlaying({ querySelector: () => null })).toBe(false);
  });

  it('pendant une publicité ou la bascule (durée NaN) : aucune progression', () => {
    expect(readPrimePlayback({ currentTime: 600, duration: 1441 }, false)).toEqual({ currentTime: 600, duration: 1441 });
    expect(readPrimePlayback({ currentTime: 600, duration: 1441 }, true)).toBeNull();
    expect(readPrimePlayback({ currentTime: 0, duration: Number.NaN }, false)).toBeNull();
  });
});
