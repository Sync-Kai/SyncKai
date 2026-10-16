import { t } from '../../../i18n';
import type { EpisodeInfo } from '../../../shared/episode.types';
import { PLATFORMS } from '../../../platforms/registry';
import { ignoredResult, representsWholeShow, singleEntryDoubt, type PlatformLinkVerdict } from './matching';
import { platformLinkVerdict } from './policies/registry';
import { isLinked, SEASON_COUNT_TOLERANCE, totalEpisodes, type MediaCandidate, type ResolveResult } from './model';
import { groupSeasons } from './season-groups';
import { seasonPool } from './season-pool';
import { isUnmatchedNamedSeason } from './season-titles';
import { inLinkedFranchise } from './signal-groups';

// Juge unique du résultat des règles (audit 1-§4.4) : spécifications nommées, évaluées une fois sur la fiche retenue,
// partagées par la synchro (resolver.ts › resolveEpisode, doubtedMapping, revalidatedMapping) et la page de série
// (page-media.ts › pickSeriesSeason). Chaque appelant traduit les doutes dans son vocabulaire : confiance basse et raison
// pour la synchro (syncResult), « à vérifier » pour la page (page-media-rules.ts › pageMatchConfident).

/**
 * Série jugée : page de lecture (EpisodeInfo) ou page de série (titre de la série en `animeTitle`, saison affichée).
 * `seasonEpisodeCount` : épisodes de la saison affichés par la page (contrôle countMismatch).
 */
export type JudgeQuery = Pick<EpisodeInfo, 'platform' | 'animeTitle' | 'platformSeasons' | 'primeAnime'> &
  Partial<Pick<EpisodeInfo, 'seasonTitle' | 'seasonNumber'>> & { seasonFirstEpisode?: number; seasonEpisodeCount?: number | null };

/**
 * Doutes sur la fiche retenue :
 * - titleOnly : plateforme généraliste sans fiche liée, fiches au titre de la série seulement (jamais fiable) ;
 * - singleEntry : fiche unique, suite d'une autre fiche, qui ne couvre pas toutes les saisons de la plateforme ;
 * - unlinkedEntry : fiche non liée retenue à côté d'une fiche liée (série TV homonyme d'un film lié), hors groupe prouvé
 *   par les signaux dans la franchise liée ;
 * - unmatchedName : saison nommée (« HEROINES ») sans fiche à son titre, fiche retenue = série principale ;
 * - countMismatch : épisodes de la saison sur la page très différents du total AniList du groupe de la fiche.
 */
export type Doubt = 'titleOnly' | 'singleEntry' | 'unlinkedEntry' | 'unmatchedName' | 'countMismatch';

export interface Judgement {
  /** Filtre « anime » de la plateforme (voir platformLinkVerdict) */
  verdict: PlatformLinkVerdict;
  /** Résultat des règles, inchangé */
  result: ResolveResult;
  /** Doutes qui tiennent sur la fiche retenue (vide sans fiche) */
  doubts: readonly Doubt[];
  /** Fiche unique liée couvrant toutes les saisons de la plateforme : la série entière (arcs One Piece Netflix) */
  wholeShow: boolean;
  /** Fiche placée par un groupe prouvé par les signaux (SyncTarget.bySignals) */
  bySignals: boolean;
}

/** Faits sur la fiche retenue, lus par les spécifications */
interface Facts {
  query: JudgeQuery;
  candidates: readonly MediaCandidate[];
  verdict: PlatformLinkVerdict;
  mediaId: number;
  chosen: MediaCandidate | undefined;
  bySignals: boolean;
}

/**
 * Nombre d'épisodes de la saison affiché par la page très différent de celui des fiches AniList retenues (somme des
 * parties), au-delà de l'écart toléré (épisode 0, récapitulatif compté à part…). Inconnu d'un côté ou de l'autre (saison en
 * cours) → pas d'alerte.
 */
export function episodeCountMismatch(pageCount: number | null | undefined, episodes: readonly (number | null)[]): boolean {
  if (pageCount === null || pageCount === undefined || episodes.length === 0) return false;
  const total = totalEpisodes(episodes.map((count) => ({ episodes: count })));
  return total !== null && Math.abs(pageCount - total) > SEASON_COUNT_TOLERANCE;
}

/** Spécifications nommées, dans l'ordre où la synchro les applique */
const DOUBTS: readonly (readonly [Doubt, (facts: Facts) => boolean])[] = [
  ['titleOnly', (f) => f.verdict === 'title'],
  ['singleEntry', (f) => singleEntryDoubt(f.query, f.candidates, f.mediaId)],
  // Fiche prouvée par les signaux dans la franchise liée (« II Part 2 », liée seulement à Crunchyroll) : comme liée.
  // Prouvée hors de la franchise liée (homonyme sans lien ni relation avec la fiche liée) : doute
  ['unlinkedEntry', (f) => f.verdict === 'linked' && !(f.chosen !== undefined && isLinked(f.chosen)) && !(f.bySignals && inLinkedFranchise(f.candidates, f.query.animeTitle, f.mediaId))],
  [
    'unmatchedName',
    (f) =>
      f.chosen !== undefined &&
      isUnmatchedNamedSeason({ animeTitle: f.query.animeTitle, seasonTitle: f.query.seasonTitle ?? null, seasonNumber: f.query.seasonNumber ?? null, seasonFirstEpisode: f.query.seasonFirstEpisode }, f.chosen),
  ],
  [
    'countMismatch',
    (f) => {
      if (f.query.seasonEpisodeCount === null || f.query.seasonEpisodeCount === undefined) return false;
      const group = groupSeasons(seasonPool(f.candidates, f.query.animeTitle)).find((entries) => entries.some((c) => c.id === f.mediaId));
      return group !== undefined && episodeCountMismatch(f.query.seasonEpisodeCount, group.map((c) => c.episodes));
    },
  ],
];

/** Juge le résultat des règles (resolveTarget) pour la série : filtre « anime », doutes sur la fiche retenue */
export function judge(query: JudgeQuery, candidates: readonly MediaCandidate[], result: ResolveResult): Judgement {
  const verdict = platformLinkVerdict(query, candidates);
  if (!result.ok) return { verdict, result, doubts: [], wholeShow: false, bySignals: false };
  const { mediaId } = result.target;
  const bySignals = result.target.bySignals === true;
  const facts: Facts = { query, candidates, verdict, mediaId, chosen: candidates.find((c) => c.id === mediaId), bySignals };
  return {
    verdict,
    result,
    doubts: DOUBTS.filter(([, holds]) => holds(facts)).map(([name]) => name),
    wholeShow: representsWholeShow(query, candidates, mediaId),
    bySignals,
  };
}

/**
 * Jugement traduit pour la synchro (filtre « anime » des plateformes généralistes : PLATFORMS[…].linkRequired, Netflix,
 * Disney+ ; Prime Video selon son verdict de genre, voir primeAnimeGate) :
 * 1. une fiche liée à la série → résultat inchangé, mais confiance basse pour une fiche unique qui ne couvre pas les
 *    saisons de la plateforme (singleEntry) ou une fiche non liée retenue à côté (unlinkedEntry) ;
 * 2. sinon, des fiches au titre de la série → correspondance jamais fiable (carte « à vérifier »), échec inchangé ;
 * 3. sinon → série ignorée (probablement pas un anime : ni carte de vérification ni toast).
 * Les autres doutes (saison nommée, nombre d'épisodes) ne valent que pour la page de série.
 */
export function syncResult(query: Pick<JudgeQuery, 'platform' | 'animeTitle'>, { verdict, result, doubts }: Judgement): ResolveResult {
  if (verdict === 'open') return result;
  if (verdict === 'none') return ignoredResult(query);
  const platform = PLATFORMS[query.platform].label;
  if (!result.ok) return result;
  const low = (reason: string): ResolveResult => ({ ok: true, target: { ...result.target, confidence: 'low', reason } });
  if (doubts.includes('titleOnly')) return low(t('match.platformTitleOnly', { platform }));
  if (result.target.confidence !== 'high') return result;
  if (doubts.includes('singleEntry')) return low(t('match.platformSeasonsSingle', { platform }));
  if (doubts.includes('unlinkedEntry')) return low(t('match.platformUnlinkedEntry', { platform }));
  return result;
}

/** Synchro : résultat des règles jugé puis traduit (voir syncResult) */
export function gateByPlatformLink(query: JudgeQuery, candidates: readonly MediaCandidate[], result: ResolveResult): ResolveResult {
  return syncResult(query, judge(query, candidates, result));
}
