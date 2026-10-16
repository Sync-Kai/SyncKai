import { t } from '../../../i18n';
import { hasSignals, type PlatformSignals } from '../../../shared/match-signals';
import { seasonPosition } from '../../../shared/episode-position';
import { mappingOrigin, type MediaMapping } from '../../../shared/sync.types';
import { normalizeTitle } from '../../../shared/title';
import { contradictingSignals, type ConcordanceEntry, type SignalName } from './concordance';
import { isValidProgress, type EpisodeNumbers, type MediaCandidate } from './model';
import { seasonPool, titleSeasonGroup } from './season-pool';
import { isSpecialSeason, seasonNumberFromTitle } from './season-titles';
import { signalList } from './signal-groups';

// Correspondances en cache (saison de la plateforme → fiche AniList) : application à un épisode, déduction d'un choix
// manuel, et remise en question par les signaux ou le titre de saison. La clé (mappingKey) reste dans matching.ts.

/**
 * Applique une correspondance en cache ; null si elle ne s'applique plus (ex : saison suivante) ou si la position de
 * l'épisode dans sa numérotation est inconnue (numérotation « saison » sans numéro dans la saison : jamais le numéro
 * affiché à sa place, M6).
 */
export function applyMapping(episode: EpisodeNumbers, mapping: MediaMapping): number | null {
  const base = seasonPosition(episode, mapping.numbering);
  if (base === null) return null;
  const progress = base - mapping.offset;
  return isValidProgress(progress, mapping.episodes) ? progress : null;
}

/**
 * Déduit une correspondance d'un choix manuel (fiche + épisode AniList confirmé par l'utilisateur).
 * Ex : Crunchyroll affiche E28, l'utilisateur confirme l'épisode 4 → numbering "displayed", offset 24,
 * donc E29 donnera 5. Retourne null si la progression est invalide pour la fiche.
 */
export function mappingFromManualChoice(
  episode: EpisodeNumbers,
  mediaId: number,
  progress: number,
  episodes: number | null,
): MediaMapping | null {
  if (!isValidProgress(progress, episodes)) return null;
  const { seasonEpisodeNumber: season, displayedEpisodeNumber: displayed } = episode;

  // Numéro dans la saison identique : correspondance la plus simple et la plus stable
  if (season !== null && progress === season) return { mediaId, numbering: 'season', offset: 0, episodes };
  if (displayed !== null) return { mediaId, numbering: 'displayed', offset: displayed - progress, episodes };
  if (season !== null) return { mediaId, numbering: 'season', offset: season - progress, episodes };
  return null;
}

/**
 * Correspondance en cache confrontée aux signaux de la plateforme (fiche de la correspondance seule, voir
 * contradictingSignals) :
 * - `keep` : elle tient, choix de l'utilisateur (`chosen`, jamais remis en cause), ou rien à comparer ;
 * - `drop` : apprise automatiquement (`learned`) et contredite : oubliée, nouvelle résolution ;
 * - `doubt` : origine inconnue (enregistrée avant la 2.4.0, importée) et contredite : jamais supprimée (peut-être un
 *   choix de l'utilisateur), jamais synchronisée d'office : « À vérifier ».
 */
export type CachedMappingVerdict =
  | { kind: 'keep' }
  /** `titleGroup` : contredite par le titre de saison (cachedTitleVerdict), fiches du groupe qu'il désigne ; `signals` alors vide */
  | { kind: 'drop' | 'doubt'; signals: SignalName[]; titleGroup?: number[] };

export function cachedMappingVerdict(mapping: MediaMapping, entry: ConcordanceEntry | null, signals: PlatformSignals | undefined): CachedMappingVerdict {
  if (mappingOrigin(mapping) === 'chosen' || entry === null || !hasSignals(signals)) return { kind: 'keep' };
  const names = contradictingSignals(entry, signals);
  if (names.length === 0) return { kind: 'keep' };
  return { kind: mappingOrigin(mapping) === 'learned' ? 'drop' : 'doubt', signals: names };
}

/**
 * Titre de saison à confronter à une correspondance en cache (cachedTitleVerdict) : titre propre, sans numéro de saison
 * (« Saison 2 » ne désigne aucun groupe : le numéro en décide), saison non spéciale. Correspondance en numérotation
 * absolue (One Piece « Elbaph ») : le titre ne choisit pas la fiche, jamais confrontée.
 */
export function questionsByTitle(episode: Pick<EpisodeNumbers, 'animeTitle' | 'seasonTitle' | 'seasonNumber' | 'episodeTitle'>, mapping: MediaMapping): boolean {
  if (mappingOrigin(mapping) === 'chosen' || mapping.numbering === 'displayed' || !episode.seasonTitle) return false;
  const seasonKey = normalizeTitle(episode.seasonTitle);
  return seasonKey !== '' && seasonKey !== normalizeTitle(episode.animeTitle) && seasonNumberFromTitle(episode.seasonTitle) === null && !isSpecialSeason(episode);
}

/**
 * Correspondance en cache confrontée au titre de saison (Crunchyroll « Dr. STONE NEW WORLD » rangée en saison 4, spécial
 * compté : l'import fautif du 2026-10-15 a enregistré S4 → SCIENCE FUTURE Part 2) : fiche hors du groupe que le titre
 * désigne → apprise : oubliée (`drop`) ; origine inconnue : « À vérifier » (`doubt`) ; choix de l'utilisateur : `keep`.
 */
export function cachedTitleVerdict(mapping: MediaMapping, episode: EpisodeNumbers, candidates: readonly MediaCandidate[]): CachedMappingVerdict {
  if (!questionsByTitle(episode, mapping)) return { kind: 'keep' };
  const designated = titleSeasonGroup(episode, seasonPool(candidates, episode.animeTitle));
  if (!designated || designated.group.some((c) => c.id === mapping.mediaId)) return { kind: 'keep' };
  return { kind: mappingOrigin(mapping) === 'learned' ? 'drop' : 'doubt', signals: [], titleGroup: designated.group.map((c) => c.id) };
}

/** Raison « À vérifier » d'une correspondance en cache contredite par la plateforme (verdict `doubt`) */
export const savedMappingDoubt = (names: readonly SignalName[]): string => t('match.savedContradicted', { signals: signalList(names) });
/** Raison « À vérifier » d'une correspondance en cache contredite par le titre de saison (voir cachedTitleVerdict) */
export const titleMappingDoubt = (seasonTitle: string | null): string => t('match.seasonByTitle', { title: seasonTitle ?? '' });
