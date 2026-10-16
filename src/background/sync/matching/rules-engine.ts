import { t } from '../../../i18n';
import { hasSignals } from '../../../shared/match-signals';
import { PLATFORMS } from '../../../platforms/registry';
import { normalizeTitle } from '../../../shared/title';
import { isAbsoluteNumbering, isDirectlyLinked, isLinked, SERIES_FORMATS, type EpisodeNumbers, type MediaCandidate, type ResolveFailure, type ResolveResult } from './model';
import { groupSeasons } from './season-groups';
import { seasonPool, titleSeasonGroup } from './season-pool';
import { effectiveSeasonNumber, titleSeasonOf } from './season-titles';
import { checkedBySignals, hasTrustedLinks, signalConcordance, type SignalConcordance } from './signal-groups';
import { absoluteSplit } from './stages/absolute-split';
import { failure, isProposal, noEntry, type Proposal, type RulesContext, type Stage } from './stages/context';
import { dedicated } from './stages/dedicated';
import { displayedBeyondSeason } from './stages/displayed-beyond-season';
import { provenBySignals, provenProposal } from './stages/proven-by-signals';
import { seasonByNumber } from './stages/season-by-number';
import { seasonByTitle } from './stages/season-by-title';
import { noSeason, singleEntry } from './stages/single-entry';
import { specialSeason } from './stages/special-season';

// Règles de correspondance (épisode → fiche AniList et progression) : chaîne d'étapes pures, la première qui décide
// l'emporte. L'ordre compte (figé par le corpus et matching*.test.ts) : fiche dédiée avant groupe prouvé avant fiche
// unique ; titre de saison avant numéro de saison.

const STAGES: readonly Stage[] = [
  specialSeason,
  dedicated,
  provenBySignals,
  noSeason,
  singleEntry,
  absoluteSplit,
  seasonByTitle,
  displayedBeyondSeason,
  seasonByNumber,
];

/**
 * Choisit la fiche AniList et la progression correspondant à un épisode. Signaux de la plateforme (année, épisodes,
 * durée…) : candidats filtrés et groupe prouvé d'abord (signalConcordance, provenBySignals), résultat des règles vérifié
 * ensuite (checkedBySignals). Sans signal : règles seules, comportement d'avant.
 */
export function resolveTarget(episode: EpisodeNumbers, candidates: MediaCandidate[]): ResolveResult {
  if (!hasSignals(episode.signals)) return resolveByRules(episode, candidates, null);
  const concordance = signalConcordance(episode, candidates, episode.signals);
  return checkedBySignals(episode, resolveByRules(episode, concordance.candidates, concordance), concordance);
}

function resolveByRules(episode: EpisodeNumbers, candidates: readonly MediaCandidate[], concordance: SignalConcordance | null): ResolveResult {
  const ctx = rulesContext(episode, candidates, concordance);
  if ('ok' in ctx) return ctx;
  for (const stage of STAGES) {
    const result = stage(ctx);
    if (result !== null) return isProposal(result) ? finalize(ctx, result) : result;
  }
  return failure(t('match.undetermined'));
}

/** Contexte des étapes ; échec si l'épisode n'a pas de numéro exploitable */
function rulesContext(episode: EpisodeNumbers, candidates: readonly MediaCandidate[], concordance: SignalConcordance | null): RulesContext | ResolveFailure {
  const linked = candidates.filter((c) => isLinked(c) && c.format !== null && SERIES_FORMATS.has(c.format));
  const animeKey = normalizeTitle(episode.animeTitle);
  const pool = seasonPool(candidates, episode.animeTitle);

  const seasonNumber = effectiveSeasonNumber(episode);
  // Titre seul jugé fiable uniquement s'il désigne UNE saison (une fiche, ou ses parties « Part 2 ») et qu'il
  // s'agit de la 1re saison (fréquent sur ADN, rarement lié sur AniList). Remakes au même titre → plusieurs saisons → à vérifier.
  // Sans lien : fiches au titre de la série (saison 1), hors « Série Season N »
  const basePool = linked.length > 0 ? pool : pool.filter((c) => titleSeasonOf(c.titles, animeKey) === 1);
  const soleSeason = basePool.length > 0 && groupSeasons(basePool).length === 1;

  const displayed = episode.displayedEpisodeNumber;
  const relative = episode.seasonEpisodeNumber ?? displayed;
  if (relative === null) return pool.length === 0 ? noEntry({ episode }) : failure(t('match.noNumber'));
  if (!Number.isInteger(relative) || (displayed !== null && !Number.isInteger(displayed))) {
    return pool.length === 0 ? noEntry({ episode }) : failure(t('match.special'));
  }

  const groups = groupSeasons(pool);
  return {
    episode,
    candidates,
    pool,
    groups,
    animeKey,
    linked,
    // Liens Disney+ / Prime Video au titre de la série répartis sur plusieurs franchises (remakes homonymes) : aucun ne
    // désigne la série, choix jamais fiable (comme sans lien)
    untrustedLinks: linked.length > 0 && !hasTrustedLinks(candidates, episode.animeTitle),
    trustedTitleMatch: linked.length === 0 && soleSeason && (seasonNumber ?? 1) === 1,
    soleSeason,
    // Fiche écartée sur un ancien slug différent : ce peut être une vraie saison dont la page a été renommée (ancienne page
    // par saison). Les saisons suivantes seraient alors décalées d'un cran (épisode de S2 compté sur la fiche de S3) : seul
    // un choix lié directement à la série ou à l'épisode reste fiable, le reste passe en vérification (jamais mis en cache).
    weakExclusion: candidates.some((c) => c.link === 'other-slug'),
    seasonNumber,
    season: seasonNumber ?? (soleSeason ? 1 : null),
    displayed,
    relative,
    isAbsolute: isAbsoluteNumbering(episode),
    designated: titleSeasonGroup(episode, pool, groups),
    concordance,
    proven: concordance ? provenProposal(concordance, relative) : null,
  };
}

/**
 * Seul passage d'une proposition au résultat. Règles transversales :
 * - plafond « autre slug » : une fiche écartée sur un ancien slug rend tout choix sûr à vérifier, sauf fiche liée
 *   directement ou dédiée au titre exact ;
 * - raison : liens non fiables (remakes Disney+ / Prime Video), ou absence de tout lien (titre seul) plutôt que la règle ;
 * - groupe prouvé par les signaux : tel quel (audit L1, décision 9 en attente).
 */
function finalize(ctx: RulesContext, proposal: Proposal): ResolveResult {
  const { candidate, base, progress, numbering, confidence, reason } = proposal;
  const placement = { mediaId: candidate.id, numbering, offset: base - progress, episodes: candidate.episodes, progress };
  if (proposal.bySignals) return { ok: true, target: { ...placement, confidence, reason, bySignals: true } };

  const { episode } = ctx;
  const isCapped = confidence === 'high' && ctx.weakExclusion && !isDirectlyLinked(candidate) && proposal.byExactTitle !== true;
  const finalReason = isCapped
    ? t('match.otherSeriesExcluded')
    : ctx.untrustedLinks && confidence !== 'high' && episode.platform !== undefined
      ? t('match.platformTitleOnly', { platform: PLATFORMS[episode.platform].label })
      : ctx.linked.length === 0 && !isLinked(candidate)
        ? confidence === 'high'
          ? (proposal.trustedReason ?? t('match.titleOnlyTrusted'))
          : // Sans lien plateforme, c'est l'absence de lien (et non la règle appliquée) qui rend le choix incertain ;
            // le texte « Crunchyroll / ADN » ne vaut pas pour Prime Video, seule autre plateforme résolue par le titre seul
            episode.platform === 'prime'
            ? t('match.platformTitleOnly', { platform: PLATFORMS.prime.label })
            : t('match.titleOnly')
        : reason;
  const target = { ...placement, confidence: isCapped ? ('low' as const) : confidence, reason: finalReason };
  return { ok: true, target: proposal.byRank ? { ...target, byRank: true } : target };
}
