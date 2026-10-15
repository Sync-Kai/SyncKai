import type { EpisodeInfo, SentPrimeAnimeVerdict } from '../../../shared/episode.types';
import type { PageMediaInfo } from '../../../shared/page-media.types';
import type { MediaMapping } from '../../../shared/sync.types';
import type { CorpusCase, CorpusOutcome } from './types';

// Cas réels de correspondance (voir README.md). `expected` = comportement actuel, signaux du cas transmis (2026-10-14,
// feature/match-signals) ;
// `ideal` (+ `gap`) seulement là où le propriétaire attend autre chose. Les identifiants de série Crunchyroll / Netflix
// viennent des pages relevées (fixtures, tests existants) ou, à défaut, du lien AniList de la fiche (noté dans `note`).

type Numbers = Pick<EpisodeInfo, 'seasonNumber' | 'seasonTitle' | 'seasonEpisodeNumber' | 'displayedEpisodeNumber'> & Partial<Pick<EpisodeInfo, 'episodeTitle' | 'platformSeasons'>>;

const high = (mediaId: number, progress?: number): CorpusOutcome => ({ mediaId, confidence: 'high', ...(progress !== undefined ? { progress } : {}) });
const low = (mediaId: number, progress?: number): CorpusOutcome => ({ mediaId, confidence: 'low', ...(progress !== undefined ? { progress } : {}) });
const IGNORED: CorpusOutcome = { mediaId: null, confidence: 'ignored' };
const NOT_FOUND: CorpusOutcome = { mediaId: null, confidence: 'not-found' };

function crunchyroll(series: { seriesId: string; seriesSlug: string; animeTitle: string }, episodeId: string, numbers: Numbers): EpisodeInfo {
  return { platform: 'crunchyroll', episodeId, ...series, episodeTitle: null, url: `https://www.crunchyroll.com/watch/${episodeId}`, ...numbers };
}

function adn(series: { seriesId: string; seriesSlug: string; animeTitle: string }, episodeId: string, numbers: Numbers): EpisodeInfo {
  return { platform: 'adn', episodeId, ...series, episodeTitle: null, url: `https://animationdigitalnetwork.com/video/${series.seriesId}-${series.seriesSlug}/${episodeId}`, ...numbers };
}

function netflix(showId: string, animeTitle: string, episodeId: string, numbers: Numbers): EpisodeInfo {
  return { platform: 'netflix', episodeId, seriesId: showId, seriesSlug: null, animeTitle, episodeTitle: null, url: `https://www.netflix.com/watch/${episodeId}`, ...numbers };
}

/** Disney+ en lecture : aucun identifiant de série (titre anglais de `internalTitle`), numérotation par saison */
function disney(animeTitle: string, episodeId: string, numbers: Numbers): EpisodeInfo {
  return { platform: 'disney', episodeId, seriesId: null, seriesSlug: null, animeTitle, episodeTitle: null, url: `https://www.disneyplus.com/play/${episodeId}`, ...numbers };
}

/** Prime Video : titre de la série sans mention de version, saison et épisode par saison, verdict de genre */
function prime(animeTitle: string, primeAnime: SentPrimeAnimeVerdict, season: number, episode: number, seasonGti = '0PRIMECORPUS00000000000000'): EpisodeInfo {
  return {
    platform: 'prime',
    episodeId: `amzn1.dv.gti.corpus-${season}-${episode}`,
    seriesId: null,
    seriesSlug: null,
    animeTitle,
    seasonNumber: season,
    seasonTitle: null,
    seasonEpisodeNumber: episode,
    displayedEpisodeNumber: episode,
    episodeTitle: null,
    url: `https://www.primevideo.com/detail/${seasonGti}`,
    primeAnime,
  };
}

function seriesPage(page: Omit<PageMediaInfo, 'kind' | 'episode'>): PageMediaInfo {
  return { ...page, kind: 'series', episode: null };
}

const ONE_PIECE_CR = { seriesId: 'GRMG8ZQZR', seriesSlug: 'one-piece', animeTitle: 'One Piece' };
const KAIJU_CR = { seriesId: 'GG5H5XQ7D', seriesSlug: 'kaiju-no-8', animeTitle: 'Kaiju No. 8' };
const SLIME_CR = { seriesId: 'GYZJ43JMR', seriesSlug: 'that-time-i-got-reincarnated-as-a-slime', animeTitle: 'Moi, quand je me réincarne en Slime' };
const FRIEREN_CR = { seriesId: 'GG5H5XQX4', seriesSlug: 'frieren-beyond-journeys-end', animeTitle: 'Frieren: Beyond Journey’s End' };
const AOT_CR = { seriesId: 'GR751KNZY', seriesSlug: 'attack-on-titan', animeTitle: 'Attack on Titan' };
/**
 * Attack on Titan sur Crunchyroll, réponses CMS relevées le 2026-10-14 (anonyme, en-US) : saisons originales S1 (2013,
 * 27 ép.), S3 (2018, 22 ép.), Final Season (2020, 30 ép.) parmi six (S2, Last Attack et OADs : années non relevées) ;
 * lancement de la série 2013. Saison lue dans le menu de la page de série : titre seul, sans numéro (« Attack on Titan
 * Season 3 », « L'Attaque des Titans Saison 3 ») : signaux de la série seule.
 */
const AOT_CR_SIGNALS = {
  seasons: [
    { seq: 1, year: 2013, episodes: 27 },
    { seq: 3, year: 2018, episodes: 22 },
    { seq: 4, year: 2020, episodes: 30 },
  ],
  seriesStartYear: 2013,
  episodeDurationS: 1435,
  source: 'réponses CMS de Crunchyroll relevées le 2026-10-14 (cms/series, …/seasons, cms/seasons/{id}/episodes)',
};
const SHIPPUDEN_CR = { seriesId: 'GYQ4MW246', seriesSlug: 'naruto-shippuden', animeTitle: 'Naruto Shippuden' };
const BLACK_BUTLER_CR = { seriesId: 'GYQ43P3E6', seriesSlug: 'black-butler', animeTitle: 'Black Butler' };
const TOUGEN_ADN = { seriesId: '1311', seriesSlug: 'tougen-anki', animeTitle: 'TOUGEN ANKI' };
const SWORD_ADN = { seriesId: '970', seriesSlug: 'reincarnated-as-a-sword', animeTitle: 'Reincarnated as a Sword' };

/** One Piece sur Netflix (/title/80107103), saisons relevées par le propriétaire le 2026-10-14 (année = début d'origine) */
const ONE_PIECE_NETFLIX_SEASONS = [
  { seq: 1, year: 1999, episodes: 61, title: 'East Blue' },
  { seq: 2, year: 2001, episodes: 16, title: 'Grand Line' },
  { seq: 3, year: 2001, episodes: 15, title: 'Drum' },
  { seq: 4, year: 2001, episodes: 38, title: 'Alabasta' },
  { seq: 38, year: 2024, episodes: 34, title: 'Egghead Arc ①' },
  { seq: 39, year: 2025, episodes: 33, title: 'Egghead Arc ②' },
  { seq: 40, year: 2026, episodes: 25, title: 'Elbaph Arc' },
];
const ONE_PIECE_NETFLIX = {
  platformSeasons: ONE_PIECE_NETFLIX_SEASONS.map((s) => s.episodes),
  signals: { seasons: ONE_PIECE_NETFLIX_SEASONS, source: 'capture du propriétaire (métadonnées Netflix video.seasons[], 2026-10-14)' },
};
/** Mushoku Tensei sur Netflix (/title/80987039, content/netflix/fixtures.ts) : S1 = cours 1 + 2, S2 = II + épisode 0 + II Part 2 */
const MUSHOKU_NETFLIX_SEASONS = [
  { seq: 1, year: 2021, episodes: 23 },
  { seq: 2, year: 2023, episodes: 25 },
];
const MUSHOKU_SIGNALS = { seasons: MUSHOKU_NETFLIX_SEASONS, source: 'fixture Netflix (2026-10-09) et capture du propriétaire (2026-10-14)' };
const MUSHOKU_SEASONS = MUSHOKU_NETFLIX_SEASONS.map((s) => s.episodes);
/** Correspondance Netflix S2 → « III » (S2 E14 = III épisode 1), en cache avant le marquage de son origine (cas réel du 2026-10-14) */
const STALE_MUSHOKU_MAPPING: MediaMapping = { mediaId: 178789, numbering: 'season', offset: 13, episodes: 14, seriesLabel: 'Mushoku Tensei: Jobless Reincarnation · S2', mediaTitle: 'Mushoku Tensei III' };

export const CASES: readonly CorpusCase[] = [
  // ─── Crunchyroll ────────────────────────────────────────────────────────
  {
    id: 'cr-one-piece-elbaph-e1180',
    kind: 'episode',
    note: 'Page de lecture réelle (fixture crunchyroll-watch.ts) : saison 24 « Elbaph », 25e épisode, affiché E1180.',
    anilist: 'one-piece',
    episode: crunchyroll(ONE_PIECE_CR, 'GE00376431JAJP', { seasonNumber: 24, seasonTitle: 'Elbaph', seasonEpisodeNumber: 25, displayedEpisodeNumber: 1180 }),
    searches: ['One Piece', 'One Piece Elbaph'],
    expected: high(21, 1180),
  },
  {
    id: 'cr-one-piece-heroines-e1',
    kind: 'episode',
    note: 'Page réelle /watch/GE00380778JAJP : saison 30 « HEROINES » de One Piece, E1 ; ONE PIECE HEROINES lié à cette page sur AniList.',
    anilist: 'one-piece',
    episode: crunchyroll(ONE_PIECE_CR, 'GE00380778JAJP', { seasonNumber: 30, seasonTitle: 'HEROINES', seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }),
    searches: ['One Piece', 'One Piece HEROINES'],
    expected: high(197178, 1),
  },
  {
    id: 'cr-one-piece-series-elbaph',
    kind: 'series',
    note: 'Page de série, arc « Elbaph (1156-current) » choisi dans le menu (premier épisode absolu 1156). MONSTERS (préquelle 2024, Netflix seulement) jamais une saison.',
    anilist: 'one-piece',
    page: seriesPage({ platform: 'crunchyroll', ...ONE_PIECE_CR, seriesTitle: 'One Piece', seasonNumber: null, seasonTitle: 'Elbaph', seasonFirstEpisode: 1156 }),
    searches: ['One Piece', 'One Piece Elbaph'],
    expected: high(21),
  },
  {
    id: 'cr-one-piece-series-heroines',
    kind: 'series',
    note: 'Page de série, saison nommée « HEROINES » (spécial rangé en saison 30).',
    anilist: 'one-piece',
    page: seriesPage({ platform: 'crunchyroll', ...ONE_PIECE_CR, seriesTitle: 'One Piece', seasonNumber: 30, seasonTitle: 'HEROINES' }),
    searches: ['One Piece', 'One Piece HEROINES'],
    expected: high(197178),
  },
  {
    id: 'cr-kaiju-s3-season2-e23',
    kind: 'episode',
    note: 'Kaiju No. 8 : la saison Crunchyroll 3 s’appelle « Season 2 » (doublage en saison 2), E23 = 11e de la saison.',
    anilist: 'kaiju-no-8',
    episode: crunchyroll(KAIJU_CR, 'GKAIJU0323', { seasonNumber: 3, seasonTitle: 'Season 2', seasonEpisodeNumber: 11, displayedEpisodeNumber: 23 }),
    searches: ['Kaiju No. 8', 'Kaiju No. 8 Season 2'],
    expected: high(178754, 11),
  },
  {
    id: 'cr-kaiju-s1-e5',
    kind: 'episode',
    note: 'Kaiju No. 8 saison 1, E5.',
    anilist: 'kaiju-no-8',
    episode: crunchyroll(KAIJU_CR, 'GKAIJU0105', { seasonNumber: 1, seasonTitle: 'Kaiju No. 8', seasonEpisodeNumber: 5, displayedEpisodeNumber: 5 }),
    searches: ['Kaiju No. 8'],
    expected: high(153288, 5),
  },
  {
    id: 'cr-slime-fr-s1e5',
    kind: 'episode',
    note: 'Crunchyroll /fr/ : titre localisé accentué (AniList ne trouve pas un synonyme accentué, observé 2026-10-14) ; lien AniList par ancien slug.',
    anilist: 'slime',
    episode: crunchyroll(SLIME_CR, 'GSLIME0105', { seasonNumber: 1, seasonTitle: null, seasonEpisodeNumber: 5, displayedEpisodeNumber: 5 }),
    searches: ['Moi, quand je me réincarne en Slime', 'Moi, quand je me reincarne en Slime'],
    expected: high(101280, 5),
  },
  {
    id: 'cr-frieren-s1e5',
    kind: 'episode',
    note: 'Frieren saison 1, E5 (identifiant de série du lien AniList).',
    anilist: 'frieren',
    episode: crunchyroll(FRIEREN_CR, 'GFRIER0105', { seasonNumber: 1, seasonTitle: 'Frieren: Beyond Journey’s End', seasonEpisodeNumber: 5, displayedEpisodeNumber: 5 }),
    searches: ['Frieren: Beyond Journey’s End'],
    expected: high(154587, 5),
  },
  {
    id: 'cr-frieren-s2e3',
    kind: 'episode',
    note: 'Frieren saison 2 (2026), E3, numérotation par saison (supposée).',
    anilist: 'frieren',
    episode: crunchyroll(FRIEREN_CR, 'GFRIER0203', { seasonNumber: 2, seasonTitle: 'Frieren: Beyond Journey’s End Season 2', seasonEpisodeNumber: 3, displayedEpisodeNumber: 3 }),
    searches: ['Frieren: Beyond Journey’s End', 'Frieren: Beyond Journey’s End Season 2'],
    expected: high(182255, 3),
  },
  {
    id: 'cr-frieren-s2e3-airing',
    kind: 'episode',
    note: 'cr-frieren-s2e3 si Crunchyroll publiait la saison 2 (2026) en cours avec déjà 13 épisodes : plus que les 10 de la fiche AniList.',
    anilist: 'frieren',
    episode: crunchyroll(FRIEREN_CR, 'GFRIER0203', { seasonNumber: 2, seasonTitle: 'Frieren: Beyond Journey’s End Season 2', seasonEpisodeNumber: 3, displayedEpisodeNumber: 3 }),
    signals: { seasons: [{ seq: 2, year: 2026, episodes: 13 }], airing: true, source: 'SUPPOSÉ : saison en cours sur la plateforme avec plus d’épisodes que la fiche AniList (situation construite)' },
    searches: ['Frieren: Beyond Journey’s End', 'Frieren: Beyond Journey’s End Season 2'],
    // Crunchyroll n'envoie pas `airing` : 13 épisodes contre 10 sur la fiche terminée contredit, donc « À vérifier »
    // (jamais une synchro automatique sur un total incohérent)
    expected: low(182255, 3),
  },
  {
    id: 'cr-aot-s1e5',
    kind: 'episode',
    note: 'Attack on Titan saison 1, E5 (GR751KNZY, liens AniList par ancien slug).',
    anilist: 'attack-on-titan',
    episode: crunchyroll(AOT_CR, 'GAOT00105', { seasonNumber: 1, seasonTitle: 'Attack on Titan', seasonEpisodeNumber: 5, displayedEpisodeNumber: 5 }),
    searches: ['Attack on Titan'],
    expected: high(16498, 5),
  },
  {
    id: 'cr-aot-last-attack',
    kind: 'episode',
    note: 'Saison « Attack on Titan: Last Attack » (film de montage, un seul épisode) : aucune fiche AniList du film (relevé 2026-10-11).',
    anilist: 'attack-on-titan',
    episode: crunchyroll(AOT_CR, 'GLASTATK1', { seasonNumber: 1, seasonTitle: 'Attack on Titan: Last Attack', seasonEpisodeNumber: 1, displayedEpisodeNumber: 1, episodeTitle: 'Attack on Titan: The Last Attack' }),
    searches: ['Attack on Titan', 'Attack on Titan: Last Attack'],
    expected: NOT_FOUND,
  },
  {
    id: 'cr-aot-series-s3',
    kind: 'series',
    note: 'Page de série (relevé réel du 2026-10-14) : « Attack on Titan Season 3 » choisie dans le menu des saisons (libellé sans numéro). Cas du propriétaire : le panneau restait sur « Season 1 » après plusieurs choix dans le menu (relectures automatiques suspendues), la résolution elle-même est juste.',
    anilist: 'attack-on-titan',
    page: seriesPage({ platform: 'crunchyroll', ...AOT_CR, seriesTitle: 'Attack on Titan', seasonNumber: null, seasonTitle: 'Attack on Titan Season 3' }),
    signals: AOT_CR_SIGNALS,
    searches: ['Attack on Titan', 'Attack on Titan Season 3'],
    expected: high(99147),
  },
  {
    id: 'cr-aot-series-final',
    kind: 'series',
    note: 'Page de série, « Attack on Titan Final Season » choisie dans le menu (relevé réel du 2026-10-14).',
    anilist: 'attack-on-titan',
    page: seriesPage({ platform: 'crunchyroll', ...AOT_CR, seriesTitle: 'Attack on Titan', seasonNumber: null, seasonTitle: 'Attack on Titan Final Season' }),
    signals: AOT_CR_SIGNALS,
    searches: ['Attack on Titan', 'Attack on Titan Final Season'],
    expected: high(110277),
  },
  {
    id: 'cr-aot-series-s1',
    kind: 'series',
    note: 'Page de série, première saison affichée dans le menu (relevé réel du 2026-10-15) : son libellé est le titre de la série seul (« Attack on Titan », sans « Season 1 »), lu comme saison 1 par le script de contenu, signaux de la saison 1 du pont (2013, 27 ép.). Le panneau proposait la dernière partie (Final Season Part 2).',
    anilist: 'attack-on-titan',
    page: seriesPage({ platform: 'crunchyroll', ...AOT_CR, seriesTitle: 'Attack on Titan', seasonNumber: 1, seasonTitle: 'Attack on Titan' }),
    signals: AOT_CR_SIGNALS,
    searches: ['Attack on Titan'],
    expected: high(16498),
  },
  {
    id: 'cr-aot-series-s1-no-signals',
    kind: 'series',
    note: 'Même page, onglet ouvert avant le rechargement de l’extension : le pont n’a vu aucune réponse CMS, aucun signal.',
    anilist: 'attack-on-titan',
    page: seriesPage({ platform: 'crunchyroll', ...AOT_CR, seriesTitle: 'Attack on Titan', seasonNumber: 1, seasonTitle: 'Attack on Titan' }),
    searches: ['Attack on Titan'],
    expected: high(16498),
  },
  {
    id: 'cr-aot-series-s1-unnumbered',
    kind: 'series',
    note: 'Même page lue sans numéro (script de contenu d’avant le correctif, ou libellé écrit autrement que le titre de la série : casse, ponctuation) : année de la série seule. Le service worker la lit comme saison 1 (seriesTitledSeason).',
    anilist: 'attack-on-titan',
    page: seriesPage({ platform: 'crunchyroll', ...AOT_CR, seriesTitle: 'Attack on Titan', seasonNumber: null, seasonTitle: 'ATTACK ON TITAN' }),
    signals: AOT_CR_SIGNALS,
    searches: ['Attack on Titan'],
    expected: high(16498),
  },
  {
    id: 'cr-aot-series-s3-fr',
    kind: 'series',
    note: 'Même page en français (/fr/, relevé réel du 2026-10-14) : « L\'Attaque des Titans Saison 3 », titre de la saison 3 sur Crunchyroll (22 ép. = « Season 3 » + « Season 3 Part 2 »). AniList ne connaît ce titre que dans un synonyme de la partie 2 (« L\'Attaque des Titans Saison 3 Partie 2 »).',
    anilist: 'attack-on-titan',
    page: seriesPage({ platform: 'crunchyroll', ...AOT_CR, seriesTitle: "L'Attaque des Titans", seasonNumber: null, seasonTitle: "L'Attaque des Titans Saison 3" }),
    signals: AOT_CR_SIGNALS,
    searches: ["L'Attaque des Titans", "L'Attaque des Titans Saison 3"],
    expected: high(99147),
  },
  {
    id: 'cr-naruto-shippuden-s2e3',
    kind: 'episode',
    note: 'Naruto Shippuden saison 2, E3 affiché E35 ; Naruto (préquelle) lié à une autre série Crunchyroll.',
    anilist: 'naruto',
    episode: crunchyroll(SHIPPUDEN_CR, 'GSHIPP0203', { seasonNumber: 2, seasonTitle: 'Naruto Shippuden', seasonEpisodeNumber: 3, displayedEpisodeNumber: 35 }),
    searches: ['Naruto Shippuden'],
    expected: high(1735, 35),
  },
  {
    id: 'cr-black-butler-series',
    kind: 'series',
    note: 'Page de série Black Butler sans saison lue : toutes les saisons TV gardées (relations datées).',
    anilist: 'black-butler',
    page: seriesPage({ platform: 'crunchyroll', ...BLACK_BUTLER_CR, seriesTitle: 'Black Butler', seasonNumber: null, seasonTitle: null }),
    searches: ['Black Butler'],
    expected: low(4898),
  },
  {
    id: 'cr-cheat-skill-special',
    kind: 'series',
    note: 'Page de série, saison « Special » (relevé 2026-10-11) : fiche spéciale liée à sa page de lecture.',
    anilist: 'cheat-skill',
    page: seriesPage({
      platform: 'crunchyroll',
      seriesId: 'GEXH3W49E',
      seriesSlug: 'i-got-a-cheat-skill-in-another-world-and-became-unrivaled-in-the-real-world-too',
      seriesTitle: 'I Got a Cheat Skill in Another World and Became Unrivaled in The Real World, Too',
      seasonNumber: null,
      seasonTitle: 'Special',
    }),
    searches: ['I Got a Cheat Skill in Another World and Became Unrivaled in The Real World, Too', 'I Got a Cheat Skill in Another World and Became Unrivaled in The Real World, Too Special'],
    expected: high(170110),
  },

  // ─── ADN ────────────────────────────────────────────────────────────────
  {
    id: 'adn-tougen-anki-s1e5',
    kind: 'episode',
    note: 'TOUGEN ANKI saison 1 (24 épisodes), E5 (JSON-LD « Saison 1 », fixture adn-watch.ts).',
    anilist: 'tougen-anki',
    episode: adn(TOUGEN_ADN, '29348', { seasonNumber: 1, seasonTitle: null, seasonEpisodeNumber: 5, displayedEpisodeNumber: 5 }),
    searches: ['TOUGEN ANKI'],
    expected: high(177474, 5),
  },
  {
    id: 'adn-tougen-anki-s2e2',
    kind: 'episode',
    note: 'TOUGEN ANKI saison 2 en cours (API ADN 2026-10-14 : 2 spéciaux puis E1, E2), E2.',
    anilist: 'tougen-anki',
    episode: adn(TOUGEN_ADN, '32923', { seasonNumber: 2, seasonTitle: null, seasonEpisodeNumber: 2, displayedEpisodeNumber: 2 }),
    searches: ['TOUGEN ANKI'],
    expected: low(204650, 2),
    ideal: high(204650, 2),
    gap: 'bonne fiche mais « À vérifier » : saison 2 par le titre seul (ADN jamais lié sur AniList) ; suite de la fiche de la saison 1, début 2026-10 comme les épisodes ADN de la saison 2 (signaux année + relation)',
  },
  {
    id: 'adn-tougen-anki-series',
    kind: 'series',
    note: 'Page de série ADN : aucune saison envoyée (detectAdnSeries).',
    anilist: 'tougen-anki',
    page: seriesPage({ platform: 'adn', ...TOUGEN_ADN, seriesTitle: 'TOUGEN ANKI', seasonNumber: null, seasonTitle: null }),
    searches: ['TOUGEN ANKI'],
    expected: low(177474),
  },
  {
    id: 'adn-sword-s2e3',
    kind: 'episode',
    note: 'Reincarnated as a Sword saison 2 en cours (API ADN 2026-10-14 : S1 12 ép. 2022, S2 E1–E3 depuis le 2026-09-30), E3.',
    anilist: 'reincarnated-as-a-sword',
    episode: adn(SWORD_ADN, '32912', { seasonNumber: 2, seasonTitle: null, seasonEpisodeNumber: 3, displayedEpisodeNumber: 3 }),
    searches: ['Reincarnated as a Sword'],
    expected: low(159042, 3),
    ideal: high(159042, 3),
    gap: 'bonne fiche mais « À vérifier » : saison 2 par le titre seul ; suite de « Reincarnated as a Sword » (2022), début 2026-10 comme la saison 2 ADN (2026-09-30)',
  },

  {
    id: 'adn-tougen-anki-s2e2-signals',
    kind: 'episode',
    note: 'Même épisode que adn-tougen-anki-s2e2, avec les signaux qu’ADN pourra transmettre (étape 5) : saison 2 commencée en 2026 (API ADN 2026-10-14), en cours, 4 vidéos (2 spéciaux + E1, E2), donc moins d’épisodes que les 12 d’AniList.',
    anilist: 'tougen-anki',
    episode: adn(TOUGEN_ADN, '32923', { seasonNumber: 2, seasonTitle: null, seasonEpisodeNumber: 2, displayedEpisodeNumber: 2 }),
    signals: { seasons: [{ seq: 2, year: 2026, episodes: 4 }], airing: true, source: 'API ADN du 2026-10-14 (dates et nombre de vidéos de la saison 2) ; forme du signal SUPPOSÉE (ADN ne l’envoie pas encore)' },
    searches: ['TOUGEN ANKI'],
    // Saison en cours plus courte qu’AniList : aucune contradiction ; l’année (2026) écarte la saison 1 (2025) et prouve la suite
    expected: high(204650, 2),
  },

  // ─── Netflix ────────────────────────────────────────────────────────────
  {
    id: 'nf-one-piece-elbaph-e1180',
    kind: 'episode',
    note: 'One Piece S40 « Elbaph Arc » (seq 1156…1180, déjà absolu), 25e épisode, E1180.',
    anilist: 'one-piece',
    episode: netflix('80107103', 'One Piece', '82000040', { seasonNumber: 40, seasonTitle: 'Elbaph Arc', seasonEpisodeNumber: 25, displayedEpisodeNumber: 1180, platformSeasons: ONE_PIECE_NETFLIX.platformSeasons }),
    signals: ONE_PIECE_NETFLIX.signals,
    searches: ['One Piece', 'One Piece Elbaph Arc'],
    expected: high(21, 1180),
  },
  {
    id: 'nf-one-piece-east-blue-e5',
    kind: 'episode',
    note: 'One Piece S1 « East Blue » (61 ép.), E5.',
    anilist: 'one-piece',
    episode: netflix('80107103', 'One Piece', '82000105', { seasonNumber: 1, seasonTitle: 'East Blue', seasonEpisodeNumber: 5, displayedEpisodeNumber: 5, platformSeasons: ONE_PIECE_NETFLIX.platformSeasons }),
    signals: ONE_PIECE_NETFLIX.signals,
    searches: ['One Piece', 'One Piece East Blue'],
    expected: high(21, 5),
  },
  {
    id: 'nf-one-piece-egghead-e1086',
    kind: 'episode',
    note: 'One Piece S38 « Egghead Arc ① » (34 ép., numérotée en absolu à partir de 1086), 1er épisode.',
    anilist: 'one-piece',
    episode: netflix('80107103', 'One Piece', '82000038', { seasonNumber: 38, seasonTitle: 'Egghead Arc ①', seasonEpisodeNumber: 1, displayedEpisodeNumber: 1086, platformSeasons: ONE_PIECE_NETFLIX.platformSeasons }),
    signals: ONE_PIECE_NETFLIX.signals,
    searches: ['One Piece', 'One Piece Egghead Arc ①'],
    expected: high(21, 1086),
  },
  {
    id: 'nf-ranma-s1e1',
    kind: 'episode',
    note: 'Ranma1/2 (/title/81171925, 3 saisons 12 / 12 / 2) : AniList lie S1 et S2 à un autre titre Netflix (81301833), S3 à celui-ci.',
    anilist: 'ranma',
    episode: netflix('81171925', 'Ranma1/2', '81321001', { seasonNumber: 1, seasonTitle: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1, platformSeasons: [12, 12, 2] }),
    searches: ['Ranma1/2'],
    expected: high(178533, 1),
  },
  {
    id: 'nf-ranma-s3e1',
    kind: 'episode',
    note: 'Ranma1/2 saison 3 en cours, E1 (affiché 25).',
    anilist: 'ranma',
    episode: netflix('81171925', 'Ranma1/2', '81323001', { seasonNumber: 3, seasonTitle: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 25, platformSeasons: [12, 12, 2] }),
    searches: ['Ranma1/2'],
    expected: high(209872, 1),
  },
  {
    id: 'nf-naruto-shippuden-s1e1',
    kind: 'episode',
    note: 'Naruto Shippuden (titre Netflix du lien AniList, 80000603 ; découpage 32 + 468 repris du test existant, non relevé) : Naruto publié à part.',
    anilist: 'naruto',
    episode: netflix('80000603', 'Naruto Shippuden', '80000700', { seasonNumber: 1, seasonTitle: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1, platformSeasons: [32, 468] }),
    searches: ['Naruto Shippuden'],
    expected: high(1735, 1),
  },
  {
    id: 'nf-mushoku-s1e15',
    kind: 'episode',
    note: 'Mushoku Tensei S1 (23 ép. = cours 1 + 2), E15 → Part 2 épisode 4 (fixture /watch/81402901).',
    anilist: 'mushoku-tensei',
    episode: netflix('80987039', 'Mushoku Tensei: Jobless Reincarnation', '81402901', { seasonNumber: 1, seasonTitle: null, seasonEpisodeNumber: 15, displayedEpisodeNumber: 15, platformSeasons: MUSHOKU_SEASONS }),
    signals: MUSHOKU_SIGNALS,
    searches: ['Mushoku Tensei: Jobless Reincarnation'],
    expected: high(127720, 4),
  },
  {
    id: 'nf-mushoku-s2e2',
    kind: 'episode',
    note: 'Mushoku Tensei S2 (25 ép. = II + épisode 0 + II Part 2) : E1 est l’épisode 0, donc E2 = II épisode 1.',
    anilist: 'mushoku-tensei',
    episode: netflix('80987039', 'Mushoku Tensei: Jobless Reincarnation', '81691701', { seasonNumber: 2, seasonTitle: null, seasonEpisodeNumber: 2, displayedEpisodeNumber: 25, platformSeasons: MUSHOKU_SEASONS }),
    signals: MUSHOKU_SIGNALS,
    searches: ['Mushoku Tensei: Jobless Reincarnation'],
    expected: high(146065, 2),
  },
  {
    id: 'nf-mushoku-s2e14',
    kind: 'episode',
    note: 'Mushoku Tensei S2 E14 = premier épisode de II Part 2 (13 épisodes de « II », épisode 0 compris sur AniList).',
    anilist: 'mushoku-tensei',
    episode: netflix('80987039', 'Mushoku Tensei: Jobless Reincarnation', '81691713', { seasonNumber: 2, seasonTitle: null, seasonEpisodeNumber: 14, displayedEpisodeNumber: 37, platformSeasons: MUSHOKU_SEASONS }),
    signals: MUSHOKU_SIGNALS,
    searches: ['Mushoku Tensei: Jobless Reincarnation'],
    // Sans signaux : Mushoku Tensei III (2026, lié au même titre Netflix) en confiance haute ; l’année de la saison Netflix
    // (2023) et le total 13 + 12 = 25 désignent II + II Part 2 (non liée à Netflix), seul groupe sans contradiction
    expected: high(166873, 1),
  },
  {
    id: 'nf-mushoku-s2e14-stale-mapping',
    kind: 'episode',
    note: 'Cas réel (2026-10-14) : correspondance Netflix S2 → « III » (178789) en cache, d’origine inconnue (enregistrée avant le marquage learned / chosen, peut-être un choix de l’utilisateur).',
    anilist: 'mushoku-tensei',
    episode: netflix('80987039', 'Mushoku Tensei: Jobless Reincarnation', '81691713', { seasonNumber: 2, seasonTitle: null, seasonEpisodeNumber: 14, displayedEpisodeNumber: 37, platformSeasons: MUSHOKU_SEASONS }),
    signals: MUSHOKU_SIGNALS,
    mappings: { 'netflix:80987039:s2': STALE_MUSHOKU_MAPPING },
    searches: ['Mushoku Tensei: Jobless Reincarnation'],
    // Année de la saison Netflix (2023) contre « III » (2026) : jamais supprimée ni synchronisée d’office, « À vérifier »
    // avec II Part 2 (prouvée par les signaux) proposée
    expected: low(166873, 1),
  },
  {
    id: 'nf-mushoku-s2e14-chosen-mapping',
    kind: 'episode',
    note: 'Même correspondance vers « III » (178789), choisie par l’utilisateur (`chosen`) : jamais remise en cause.',
    anilist: 'mushoku-tensei',
    episode: netflix('80987039', 'Mushoku Tensei: Jobless Reincarnation', '81691713', { seasonNumber: 2, seasonTitle: null, seasonEpisodeNumber: 14, displayedEpisodeNumber: 37, platformSeasons: MUSHOKU_SEASONS }),
    signals: MUSHOKU_SIGNALS,
    mappings: { 'netflix:80987039:s2': { ...STALE_MUSHOKU_MAPPING, chosen: true } },
    searches: [],
    expected: high(178789, 1),
  },
  {
    id: 'nf-mushoku-s2e14-learned-mapping',
    kind: 'episode',
    note: 'Même correspondance vers « III » (178789), apprise automatiquement (`learned`) : oubliée, nouvelle résolution.',
    anilist: 'mushoku-tensei',
    episode: netflix('80987039', 'Mushoku Tensei: Jobless Reincarnation', '81691713', { seasonNumber: 2, seasonTitle: null, seasonEpisodeNumber: 14, displayedEpisodeNumber: 37, platformSeasons: MUSHOKU_SEASONS }),
    signals: MUSHOKU_SIGNALS,
    mappings: { 'netflix:80987039:s2': { ...STALE_MUSHOKU_MAPPING, learned: true } },
    searches: ['Mushoku Tensei: Jobless Reincarnation'],
    expected: high(166873, 1),
  },
  {
    id: 'nf-mushoku-s2e14-with-s3',
    kind: 'episode',
    note: 'Même épisode (S2 E14) si Netflix publie la saison 3 (14 ép., 2026) sur le même titre : découpage 23 / 25 / 14 SUPPOSÉ (non relevé).',
    anilist: 'mushoku-tensei',
    episode: netflix('80987039', 'Mushoku Tensei: Jobless Reincarnation', '81691713', { seasonNumber: 2, seasonTitle: null, seasonEpisodeNumber: 14, displayedEpisodeNumber: 37, platformSeasons: [23, 25, 14] }),
    searches: ['Mushoku Tensei: Jobless Reincarnation'],
    expected: high(166873, 1),
  },
  {
    id: 'nf-mushoku-s2e25',
    kind: 'episode',
    note: 'Mushoku Tensei S2, dernier épisode (E25) = II Part 2 épisode 12.',
    anilist: 'mushoku-tensei',
    episode: netflix('80987039', 'Mushoku Tensei: Jobless Reincarnation', '81691724', { seasonNumber: 2, seasonTitle: null, seasonEpisodeNumber: 25, displayedEpisodeNumber: 48, platformSeasons: MUSHOKU_SEASONS }),
    signals: MUSHOKU_SIGNALS,
    searches: ['Mushoku Tensei: Jobless Reincarnation'],
    // Sans signaux : III épisode 12 (même cause que S2 E14)
    expected: high(166873, 12),
  },
  {
    id: 'nf-mushoku-series-s2',
    kind: 'series',
    note: 'Page de série Netflix de Mushoku Tensei, saison 2 choisie dans la fenêtre de détails (25 épisodes).',
    anilist: 'mushoku-tensei',
    page: seriesPage({ platform: 'netflix', seriesId: '80987039', seriesSlug: null, seriesTitle: 'Mushoku Tensei: Jobless Reincarnation', seasonNumber: 2, seasonTitle: null, seasonEpisodeCount: 25, platformSeasons: MUSHOKU_SEASONS }),
    signals: MUSHOKU_SIGNALS,
    searches: ['Mushoku Tensei: Jobless Reincarnation'],
    // Sans signaux : « Saison devinée » (25 épisodes sur la page contre 13 pour « II », seule fiche liée à Netflix) ;
    // l’année (2023) et le total de II + II Part 2 la prouvent
    expected: high(146065),
  },
  {
    id: 'nf-mushoku-series-s2-after-part2',
    kind: 'series',
    note: 'Page de série, saison 2 lue dans le menu, après la lecture de S2 E14+ (correspondance S2 → II Part 2 apprise) : page construite par l’adapter (seriesInfoFromMetadata, fixture réduite : 25 ép., 2023, 23,7 min).',
    anilist: 'mushoku-tensei',
    page: seriesPage({ platform: 'netflix', seriesId: '80987039', seriesSlug: null, seriesTitle: 'Mushoku Tensei: Jobless Reincarnation', seasonNumber: 2, seasonTitle: null, seasonEpisodeCount: 25, platformSeasons: MUSHOKU_SEASONS }),
    signals: { ...MUSHOKU_SIGNALS, episodeDurationS: 1422 },
    mappings: { 'netflix:80987039:s2': { mediaId: 166873, numbering: 'season', offset: 13, episodes: 12, seriesLabel: 'Mushoku Tensei: Jobless Reincarnation · S2', mediaTitle: 'Mushoku Tensei II: Isekai Ittara Honki Dasu Part 2', learned: true } },
    searches: ['Mushoku Tensei: Jobless Reincarnation'],
    // Saison prouvée par les signaux : sa première fiche, jamais la partie du dernier épisode synchronisé
    expected: high(146065),
  },
  {
    id: 'nf-mushoku-series-unread-season',
    kind: 'series',
    note: 'Cas du propriétaire (2026-10-14) : panneau sur « II Part 2 » (166873) en page de série, saison 2 choisie sur Netflix. Seule reproduction avec la page que construit l’adapter (fixture /watch/81402901 réduite, seriesInfoFromMetadata) : menu des saisons non lu (fenêtre de détail pas encore rendue, ou relecture perdue), donc ni saison ni signaux, et correspondance S2 → II Part 2 apprise en lecture de S2 E14+. Saison lue (« Season 2 » / « Saison 2 ») : 146065, certaine (nf-mushoku-series-s2).',
    anilist: 'mushoku-tensei',
    page: seriesPage({ platform: 'netflix', seriesId: '80987039', seriesSlug: null, seriesTitle: 'Mushoku Tensei: Jobless Reincarnation', seasonNumber: null, seasonTitle: null, seasonEpisodeCount: null, platformSeasons: MUSHOKU_SEASONS }),
    mappings: { 'netflix:80987039:s2': { mediaId: 166873, numbering: 'season', offset: 13, episodes: 12, seriesLabel: 'Mushoku Tensei: Jobless Reincarnation · S2', mediaTitle: 'Mushoku Tensei II: Isekai Ittara Honki Dasu Part 2', learned: true } },
    searches: ['Mushoku Tensei: Jobless Reincarnation'],
    // Dernière saison mémorisée (la partie du dernier épisode synchronisé), « Saison devinée »
    expected: low(166873),
    ideal: low(146065),
    gap: 'saison non lue : la correspondance de S2 désigne la partie du dernier épisode synchronisé, la page de série devrait montrer la première fiche de la saison',
  },
  {
    id: 'nf-mushoku-series-s2-stale-mapping',
    kind: 'series',
    note: 'Page de série Netflix, saison 2, avec la correspondance d’origine inconnue vers « III » (178789) en cache.',
    anilist: 'mushoku-tensei',
    page: seriesPage({ platform: 'netflix', seriesId: '80987039', seriesSlug: null, seriesTitle: 'Mushoku Tensei: Jobless Reincarnation', seasonNumber: 2, seasonTitle: null, seasonEpisodeCount: 25, platformSeasons: MUSHOKU_SEASONS }),
    signals: MUSHOKU_SIGNALS,
    mappings: { 'netflix:80987039:s2': STALE_MUSHOKU_MAPPING },
    searches: ['Mushoku Tensei: Jobless Reincarnation'],
    // Saison prouvée par les signaux affichée, mais « à vérifier » tant que l’utilisateur n’a pas tranché
    expected: low(146065),
  },
  {
    id: 'nf-monsters',
    kind: 'episode',
    note: 'MONSTERS (ONA 2024, /title/81733654, publié comme film supposé : saison null, épisode 1), « préquelle » de One Piece sur AniList.',
    anilist: 'one-piece',
    episode: netflix('81733654', 'MONSTERS: 103 Mercies Dragon Damnation', '81733654', { seasonNumber: null, seasonTitle: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }),
    searches: ['MONSTERS: 103 Mercies Dragon Damnation'],
    expected: high(167404, 1),
  },
  {
    id: 'nf-berserk-linked-remake-contradicted',
    kind: 'episode',
    note: 'Titre Netflix « Berserk » (/title/80146743, lien AniList de Berserk 2016) dont la saison dit 1997 (25 ép.) : la franchise liée (2016, « Berserk 2 ») est contredite, Berserk 1997 (sans lien Netflix, aucune relation avec 2016) est prouvé par l’année. Audit H1.',
    anilist: 'berserk',
    episode: netflix('80146743', 'Berserk', '80146744', { seasonNumber: 1, seasonTitle: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1, platformSeasons: [25] }),
    signals: { seasons: [{ seq: 1, year: 1997, episodes: 25 }], source: 'SUPPOSÉ : saison Netflix de 1997 sur le titre lié à Berserk 2016 (lien AniList erroné ou titre réutilisé)' },
    searches: ['Berserk'],
    // Titre seul (aucun lien Netflix sur la fiche de 1997) : « À vérifier », jamais synchronisé ni appris (avant : high)
    expected: low(33, 1),
  },

  // ─── Disney+ ────────────────────────────────────────────────────────────
  {
    id: 'dp-bleach-tybw-s1e1',
    kind: 'episode',
    note: 'BLEACH: Thousand-Year Blood War S1E1 ; BLEACH (2004) lié à une autre série Disney+.',
    anilist: 'bleach',
    episode: disney('BLEACH: Thousand-Year Blood War', 'bleach-tybw-s1e1', { seasonNumber: 1, seasonTitle: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }),
    searches: ['BLEACH: Thousand-Year Blood War'],
    expected: high(116674, 1),
  },
  {
    id: 'dp-bleach-tybw-s2e1',
    kind: 'episode',
    note: 'BLEACH: Thousand-Year Blood War S2E1 (« The Separation »).',
    anilist: 'bleach',
    episode: disney('BLEACH: Thousand-Year Blood War', 'bleach-tybw-s2e1', { seasonNumber: 2, seasonTitle: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }),
    searches: ['BLEACH: Thousand-Year Blood War'],
    expected: low(159322, 1),
    ideal: high(159322, 1),
    gap: 'bonne fiche mais « À vérifier » : « The Separation » porte le même lien Disney+ que la saison 1 (même série) et suit la saison 1 dans l’ordre de diffusion',
  },
  {
    id: 'dp-bleach-tybw-s2e1-series-year',
    kind: 'episode',
    note: 'Même épisode que dp-bleach-tybw-s2e1, avec l’année de début de la série Disney+ (2022) : antérieure à « The Separation » (2023), jamais une contradiction pour une saison suivante.',
    anilist: 'bleach',
    episode: disney('BLEACH: Thousand-Year Blood War', 'bleach-tybw-s2e1', { seasonNumber: 2, seasonTitle: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }),
    signals: { seriesStartYear: 2022, source: 'SUPPOSÉ : releaseYearRange.startYear de la série Disney+ (non relevé), année de la saison 1' },
    searches: ['BLEACH: Thousand-Year Blood War'],
    // Aucune contradiction, aucune preuve de la saison (l’année de série ne désigne que la 1re saison) : inchangé
    expected: low(159322, 1),
  },
  {
    id: 'dp-undead-unluck-s1e1',
    kind: 'episode',
    note: 'Undead Unluck S1E1 (fixture Disney+ relevée 2026-10-11).',
    anilist: 'undead-unluck',
    episode: disney('Undead Unluck', '539f8e74-undead-s1e1', { seasonNumber: 1, seasonTitle: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }),
    signals: { seriesStartYear: 2023, source: 'fixture Disney+ (page de série, releaseYearRange 2023–2025, relevée le 2026-10-11)' },
    searches: ['Undead Unluck'],
    expected: high(154116, 1),
  },
  {
    id: 'dp-undead-unluck-winter-arc-e1',
    kind: 'episode',
    note: 'Undead Unluck « Winter Arc » publié en saison 99 (internalTitle s99e1), E1.',
    anilist: 'undead-unluck',
    episode: disney('Undead Unluck', '6175d8e7-winter-arc-e1', { seasonNumber: 99, seasonTitle: 'Undead Unluck: Winter Arc', seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }),
    signals: { seriesStartYear: 2023, source: 'fixture Disney+ (page de série, releaseYearRange 2023–2025, relevée le 2026-10-11)' },
    searches: ['Undead Unluck', 'Undead Unluck: Winter Arc'],
    expected: high(179930, 1),
  },

  {
    id: 'dp-the-fable-s1e1',
    kind: 'episode',
    note: 'The Fable (anime 2024) sur Disney+, S1E1 en lecture (titre seul, sans identifiant de série).',
    anilist: 'the-fable',
    episode: disney('The Fable', 'the-fable-s1e1', { seasonNumber: 1, seasonTitle: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }),
    signals: {
      seriesStartYear: 2024,
      seasons: [{ seq: 1, year: 2024, episodes: 25 }],
      episodeDurationS: 1424,
      source: 'capture du propriétaire (explore page/entity-{uuid}, 2026-10-14) : startYear « 2024 » de la série (aucune année par saison), saison 25 épisodes, durationMs 1424048 ; Disney+ n’envoie que l’année de la SÉRIE (l’année de la saison n’est pas transmise)',
    },
    searches: ['The Fable'],
    expected: high(166910, 1),
  },

  // ─── Prime Video ────────────────────────────────────────────────────────
  {
    id: 'pv-berserk-1997-e1',
    kind: 'episode',
    note: 'Berserk (1997, 25 ép.) sur Prime Video, genre anime, titre « Berserk » : deux fiches AniList homonymes (1997, 2016). Page sans releaseYear (repli) : bonne fiche par hasard, à vérifier ; avec l’année lue (étapes 4–5) : pv-berserk-1997-e1-year.',
    anilist: 'berserk',
    episode: prime('Berserk', 'anime', 1, 1),
    searches: ['Berserk'],
    expected: low(33, 1),
  },
  {
    id: 'pv-berserk-2016-e1',
    kind: 'episode',
    note: 'Berserk (2016) sur Prime Video, même titre « Berserk », saison 1 E1 : même recherche que 1997, autre fiche attendue. Page sans releaseYear (repli) : fiche de 1997, jamais synchronisée (à vérifier) ; avec l’année : pv-berserk-2016-e1-year.',
    anilist: 'berserk',
    episode: prime('Berserk', 'anime', 1, 1, '0PRIMEBERSERK2016000000000'),
    searches: ['Berserk'],
    expected: low(33, 1),
  },
  {
    id: 'pv-berserk-2016-s2e1',
    kind: 'episode',
    note: 'Berserk (2016) saison 2 (= « Berserk 2 », 2017) sur Prime Video, titre « Berserk ». Page sans releaseYear (repli) : Berserk 2016, à vérifier ; avec l’année : pv-berserk-2016-s2e1-year.',
    anilist: 'berserk',
    episode: prime('Berserk', 'anime', 2, 1, '0PRIMEBERSERK2017000000000'),
    searches: ['Berserk'],
    expected: low(21560, 1),
  },
  {
    id: 'pv-berserk-1997-e1-year',
    kind: 'episode',
    note: 'pv-berserk-1997-e1 avec l’année de la saison Prime Video (releaseYear de headerDetail, lue depuis les étapes 4–5).',
    anilist: 'berserk',
    episode: prime('Berserk', 'anime', 1, 1),
    signals: { seasons: [{ seq: 1, year: 1997 }], source: 'SUPPOSÉ : valeur de releaseYear non relevée pour ce titre (chemin relevé le 2026-10-14), année de diffusion d’origine ; passée par reducePrimeDetail et primeSignals' },
    searches: ['Berserk'],
    expected: high(33, 1),
  },
  {
    id: 'pv-berserk-2016-e1-year',
    kind: 'episode',
    note: 'pv-berserk-2016-e1 avec l’année de la saison Prime Video : 2016 écarte 1997 et « Berserk 2 » (2017, à un an près alors qu’une fiche tombe juste).',
    anilist: 'berserk',
    episode: prime('Berserk', 'anime', 1, 1, '0PRIMEBERSERK2016000000000'),
    signals: { seasons: [{ seq: 1, year: 2016 }], source: 'SUPPOSÉ : valeur de releaseYear non relevée pour ce titre (chemin relevé le 2026-10-14), année de diffusion d’origine ; passée par reducePrimeDetail et primeSignals' },
    searches: ['Berserk'],
    expected: high(21560, 1),
  },
  {
    id: 'pv-berserk-2016-s2e1-year',
    kind: 'episode',
    note: 'pv-berserk-2016-s2e1 avec l’année de la saison Prime Video (2017) : « Berserk 2 », suite de Berserk 2016 qui ne porte pas le titre exact.',
    anilist: 'berserk',
    episode: prime('Berserk', 'anime', 2, 1, '0PRIMEBERSERK2017000000000'),
    signals: { seasons: [{ seq: 2, year: 2017 }], source: 'SUPPOSÉ : valeur de releaseYear non relevée pour ce titre (chemin relevé le 2026-10-14), année de diffusion d’origine ; passée par reducePrimeDetail et primeSignals' },
    searches: ['Berserk'],
    expected: high(97643, 1),
  },
  {
    id: 'pv-fate-ubw-movie',
    kind: 'episode',
    note: 'Film « Fate/stay night: Unlimited Blade Works » (2010) publié sur Prime Video sous ce titre : la série TV de 2014 porte exactement ce titre, le film s’appelle « Fate/stay night Movie: UNLIMITED BLADE WORKS ».',
    anilist: 'fate-ubw',
    episode: {
      platform: 'prime',
      episodeId: 'amzn1.dv.gti.corpus-fate-ubw-movie',
      seriesId: null,
      seriesSlug: null,
      animeTitle: 'Fate/stay night: Unlimited Blade Works',
      seasonNumber: null,
      seasonTitle: null,
      seasonEpisodeNumber: 1,
      displayedEpisodeNumber: 1,
      episodeTitle: null,
      url: 'https://www.primevideo.com/detail/0PRIMEFATEUBWMOVIE00000000',
      primeAnime: 'anime',
    },
    signals: { format: 'movie', seasons: [{ seq: 1, year: 2010 }], source: 'SUPPOSÉ : titleType « movie » et releaseYear d’un film Prime Video (non relevés)' },
    searches: ['Fate/stay night: Unlimited Blade Works'],
    // Sans signaux : série TV de 2014 au titre exact, en confiance haute (mauvaise œuvre) ; le format « film » l’écarte, le
    // film reste à confirmer (titre différent)
    expected: low(6922, 1),
  },
  {
    id: 'pv-bumpkin-s1e3',
    kind: 'episode',
    note: 'From Old Country Bumpkin to Master Swordsman S1E3 : pas de genre av_genre_anime, piste 日本語 → animation-ja (relevé 2026-10-14).',
    anilist: 'bumpkin',
    episode: prime('From Old Country Bumpkin to Master Swordsman', 'animation-ja', 1, 3),
    signals: { seasons: [{ seq: 1, year: 2025 }], source: 'SUPPOSÉ : valeur de releaseYear non relevée pour ce titre (chemin relevé le 2026-10-14), année de diffusion d’origine ; passée par reducePrimeDetail et primeSignals' },
    searches: ['From Old Country Bumpkin to Master Swordsman'],
    expected: high(179955, 3),
  },
  {
    id: 'pv-vinland-saga-s2-ja',
    kind: 'episode',
    note: 'VINLAND SAGA S2 Pt. 1 (Original Japanese Version) : animation_adult_interest + 日本語 → animation-ja ; titre de série supposé « VINLAND SAGA ».',
    anilist: 'vinland-saga',
    episode: prime('VINLAND SAGA', 'animation-ja', 2, 1),
    signals: { seasons: [{ seq: 2, year: 2023 }], source: 'SUPPOSÉ : valeur de releaseYear non relevée pour ce titre (chemin relevé le 2026-10-14), année de diffusion d’origine ; passée par reducePrimeDetail et primeSignals' },
    searches: ['VINLAND SAGA'],
    // Sans releaseYear : « À vérifier » (saison 2 au titre seul) ; l’année 2023 prouve « VINLAND SAGA SEASON 2 »
    expected: high(136430, 1),
  },
  {
    id: 'pv-vinland-saga-s2-simuldub',
    kind: 'episode',
    note: 'VINLAND SAGA S2 Pt. 1 (Simuldub) : anglais seulement → animation-exact-only ; titre « VINLAND SAGA » saison 2.',
    anilist: 'vinland-saga',
    episode: prime('VINLAND SAGA', 'animation-exact-only', 2, 1),
    signals: { seasons: [{ seq: 2, year: 2023 }], source: 'SUPPOSÉ : valeur de releaseYear non relevée pour ce titre (chemin relevé le 2026-10-14), année de diffusion d’origine ; passée par reducePrimeDetail et primeSignals' },
    searches: ['VINLAND SAGA'],
    // Titre exact (fiche de la saison 1) : filtre « exact seulement » passé ; sans releaseYear « À vérifier », l’année 2023
    // prouve la saison 2
    expected: high(136430, 1),
  },
  {
    id: 'pv-vinland-saga-season-2-title',
    kind: 'episode',
    note: 'Même Simuldub si Prime donne le titre « VINLAND SAGA Season 2 » en saison 1 (forme du test existant).',
    anilist: 'vinland-saga',
    episode: prime('VINLAND SAGA Season 2', 'animation-exact-only', 1, 1),
    signals: { seasons: [{ seq: 1, year: 2023 }], source: 'SUPPOSÉ : valeur de releaseYear non relevée pour ce titre (chemin relevé le 2026-10-14), année de diffusion d’origine ; passée par reducePrimeDetail et primeSignals' },
    searches: ['VINLAND SAGA Season 2'],
    expected: high(136430, 1),
  },
  {
    id: 'pv-invincible-s1e1',
    kind: 'episode',
    note: 'Invincible (animation occidentale, animation_adult_interest, anglais seulement) → animation-exact-only, jamais suivi.',
    anilist: 'western-animation',
    episode: prime('Invincible', 'animation-exact-only', 1, 1),
    searches: ['Invincible'],
    expected: IGNORED,
  },
  {
    id: 'pv-hazbin-hotel-s1e1',
    kind: 'episode',
    note: 'Hazbin Hotel (animation occidentale, même genre, anglais seulement) → animation-exact-only, jamais suivi.',
    anilist: 'western-animation',
    episode: prime('Hazbin Hotel', 'animation-exact-only', 1, 1),
    searches: ['Hazbin Hotel'],
    expected: IGNORED,
  },
  {
    id: 'pv-tokyo-ghoul-s1e3',
    kind: 'episode',
    note: 'Tokyo Ghoul S1E3 (anime, parentTitle « Tokyo Ghoul »).',
    anilist: 'tokyo-ghoul',
    episode: prime('Tokyo Ghoul', 'anime', 1, 3),
    signals: { seasons: [{ seq: 1, year: 2014 }], source: 'SUPPOSÉ : valeur de releaseYear non relevée pour ce titre (chemin relevé le 2026-10-14), année de diffusion d’origine ; passée par reducePrimeDetail et primeSignals' },
    searches: ['Tokyo Ghoul'],
    expected: high(20605, 3),
  },
  {
    id: 'pv-tokyo-ghoul-root-a-s2e1',
    kind: 'episode',
    note: 'Tokyo Ghoul √A (Original Japanese Version) en saison 2, parentTitle « Tokyo Ghoul » (catalogue US : « Tokyo Ghoul: Root A », séquence 2).',
    anilist: 'tokyo-ghoul',
    episode: prime('Tokyo Ghoul', 'anime', 2, 1),
    signals: { seasons: [{ seq: 2, year: 2015 }], source: 'SUPPOSÉ : valeur de releaseYear non relevée pour ce titre (chemin relevé le 2026-10-14), année de diffusion d’origine ; passée par reducePrimeDetail et primeSignals' },
    searches: ['Tokyo Ghoul'],
    expected: high(20850, 1),
  },
  {
    id: 'nf-bubble-film',
    kind: 'episode',
    note: 'Film « Bubble » (2022) sur Netflix (/title/81345945, lié sur AniList à la fiche ONA 142455) : épisode 1, sans saison, comme tout film Netflix.',
    anilist: 'bubble',
    episode: netflix('81345945', 'Bubble', '81345945', { seasonNumber: null, seasonTitle: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }),
    searches: ['Bubble'],
    expected: high(142455, 1),
  },
  {
    id: 'nf-bubble-series-page',
    kind: 'series',
    note: 'Page /title/81345945 du film « Bubble » : fiche liée à ce titre Netflix. Cas d’audit 1-M4, sur les VRAIES données : aucune série TV homonyme non liée dans le catalogue, donc le résultat est déjà l’idéal.',
    anilist: 'bubble',
    page: seriesPage({ platform: 'netflix', seriesId: '81345945', seriesSlug: null, seriesTitle: 'Bubble', seasonNumber: null, seasonTitle: null }),
    searches: ['Bubble'],
    expected: high(142455),
  },
];
