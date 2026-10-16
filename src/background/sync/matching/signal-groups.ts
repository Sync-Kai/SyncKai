import { formatList, t } from '../../../i18n';
import { hasSignals, type PlatformSignals } from '../../../shared/match-signals';
import { PLATFORMS } from '../../../platforms/registry';
import { normalizeTitle } from '../../../shared/title';
import { groupSeasons } from './season-groups';
import { isSpecialTitled, titleSeasonOf } from './season-titles';
import { byStartDate, isAbsoluteNumbering, isDirectlyLinked, isLinked, isOtherSeries, SERIES_FORMATS, type EpisodeNumbers, type MediaCandidate, type ResolveResult } from './model';
import {
  concordanceVerdict,
  contradicts,
  formatCheck,
  isApplicable,
  isConfirmed,
  checkGroup,
  signalsWith,
  type ConcordanceVerdict,
  type GroupVerdict,
  type SignalChecks,
  type SignalGroup,
  type SignalName,
} from './concordance';

// Signaux de la plateforme confrontés aux fiches : groupes de saison par franchise, concordance d'un épisode avec ses
// candidats, et vérification du résultat des règles (voir rules-engine.ts › resolveTarget).

/**
 * Groupes de saison comparés aux signaux : fiches séries (hors autre série de la plateforme et spéciaux titrés) liées à
 * la série ou au titre de la série (saisons « Season N » et parties comprises), avec leurs suites / préquelles dans
 * l'ordre de diffusion (« Berserk 2 », suite de Berserk 2016, ne porte pas le titre). Une franchise par composante
 * reliée (deux remakes au même titre : deux franchises), chacune découpée en groupes (parties « Part 2 » réunies).
 */
export function signalGroups(candidates: readonly MediaCandidate[], animeTitle: string): SignalGroup<MediaCandidate>[] {
  const animeKey = normalizeTitle(animeTitle);
  const series = candidates.filter((c) => c.format !== null && SERIES_FORMATS.has(c.format) && !isOtherSeries(c) && !isSpecialTitled(c));
  const byId = new Map(series.map((c) => [c.id, c]));
  // Relation dans l'ordre de diffusion seulement (une « préquelle » sortie après, MONSTERS, n'est pas une saison)
  const neighbors = (c: MediaCandidate): MediaCandidate[] =>
    (c.relations ?? []).flatMap((rel) => {
      const other = byId.get(rel.id);
      if (!other) return [];
      const outOfOrder = c.startDate !== null && other.startDate !== null && (rel.type === 'SEQUEL' ? other.startDate < c.startDate : other.startDate > c.startDate);
      return outOfOrder ? [] : [other];
    });
  const seeds = series.filter((c) => isLinked(c) || titleSeasonOf(c.titles, animeKey) !== null);
  const chainOf = new Map<number, number>();
  const chains: MediaCandidate[][] = [];
  for (const seed of seeds) {
    if (chainOf.has(seed.id)) continue;
    const members: MediaCandidate[] = [];
    const queue = [seed];
    chainOf.set(seed.id, chains.length);
    for (let current = queue.shift(); current !== undefined; current = queue.shift()) {
      members.push(current);
      // Relations lues dans les deux sens (une fiche absente de la recherche n'a pas ses propres relations)
      const linkedHere = [...neighbors(current), ...series.filter((other) => neighbors(other).includes(current))];
      for (const next of linkedHere) {
        if (chainOf.has(next.id)) continue;
        chainOf.set(next.id, chains.length);
        queue.push(next);
      }
    }
    chains.push(members);
  }
  // Chaque franchise compte au moins sa graine : premier membre toujours présent
  const startOf = (members: readonly MediaCandidate[]): number => (members[0]?.startDate ?? Number.MAX_SAFE_INTEGER);
  return chains
    .map((members) => [...members].sort(byStartDate))
    .sort((a, b) => startOf(a) - startOf(b))
    .flatMap((members, chain) => groupSeasons(members).map((entries, index) => ({ entries, chain, first: index === 0 })));
}

/**
 * Liens vers la série dignes de confiance : sans lien `platform` (présence seule sur Disney+ / Prime Video), toujours ;
 * sinon seulement si les fiches liées directement (`id`, `platform`…) qui portent le titre de la série comme 1re saison
 * (titre exact ou ses parties, pas « Série Season 2 ») appartiennent à une seule franchise (suites / préquelles, voir
 * signalGroups). Deux remakes au même titre liés chacun à la plateforme : non.
 */
export function hasTrustedLinks(candidates: readonly MediaCandidate[], animeTitle: string): boolean {
  if (!candidates.some((c) => c.link === 'platform')) return true;
  const animeKey = normalizeTitle(animeTitle);
  const isFirstSeason = (c: MediaCandidate): boolean => isDirectlyLinked(c) && titleSeasonOf(c.titles, animeKey) === 1;
  const chains = new Set(signalGroups(candidates, animeTitle).filter((group) => group.entries.some(isFirstSeason)).map((group) => group.chain));
  return chains.size <= 1;
}

/**
 * Fiche dont la franchise (fiches séries reliées par suite / préquelle, voir signalGroups) contient une fiche liée à la
 * série de la plateforme : un groupe prouvé par les signaux n'y vaut un lien que dans ce cas (remake homonyme non lié).
 */
export function inLinkedFranchise(candidates: readonly MediaCandidate[], animeTitle: string, mediaId: number): boolean {
  const groups = signalGroups(candidates, animeTitle);
  const chain = groups.find((group) => group.entries.some((c) => c.id === mediaId))?.chain;
  return chain !== undefined && groups.some((group) => group.chain === chain && group.entries.some(isLinked));
}

/** Concordance d'un épisode avec ses candidats : candidats gardés, verdict, et ce qui rend le résultat jamais fiable */
export interface SignalConcordance {
  signals: PlatformSignals;
  /** Candidats après les filtres : format contredit, franchise entièrement contredite (si une autre concorde) */
  candidates: MediaCandidate[];
  verdict: ConcordanceVerdict<MediaCandidate>;
  /** Tout se contredit (groupes, ou format de tous les candidats) : candidats inchangés, résultat à vérifier */
  forceLow: boolean;
  contradicting: SignalName[];
  /** Année qui a écarté une autre franchise au même titre (remake), null sinon */
  remakeYear: number | null;
}

export function signalConcordance(episode: EpisodeNumbers, candidates: readonly MediaCandidate[], signals: PlatformSignals): SignalConcordance {
  // 1. Format (film contre série) : candidats contredits écartés s'il en reste un autre
  let kept = [...candidates];
  let formatContradicts = false;
  if (signals.format !== undefined) {
    const isContradicted = (c: MediaCandidate): boolean => c.format !== 'MUSIC' && formatCheck(signals.format, [c]) === 'contradict';
    const remaining = candidates.filter((c) => c.format !== 'MUSIC' && !isContradicted(c));
    if (remaining.length > 0) kept = candidates.filter((c) => !isContradicted(c));
    else formatContradicts = candidates.some(isContradicted);
  }
  // 2. Groupes de saison : franchise dont aucun groupe ne concorde écartée, si une autre concorde (remakes au même titre).
  //    Les groupes contredits d'une franchise gardée restent : le rang des saisons ne bouge pas.
  const verdict = concordanceVerdict(signalGroups(kept, episode.animeTitle), signals, { absolute: isAbsoluteNumbering(episode) });
  const keptChains = new Set(verdict.kept.map((group) => group.chain));
  const dropped = keptChains.size > 0 ? verdict.groups.filter((group) => !keptChains.has(group.chain)) : [];
  const droppedIds = new Set(dropped.flatMap((group) => group.entries.map((c) => c.id)));
  if (droppedIds.size > 0) kept = kept.filter((c) => !droppedIds.has(c.id));
  const byYear = dropped.some((group) => group.checks.seasonYear === 'contradict' || group.checks.seriesYear === 'contradict');
  const contradicting = formatContradicts ? ['format' as const] : [...new Set(verdict.groups.flatMap((group) => signalsWith(group.checks, 'contradict')))];
  return {
    signals,
    candidates: kept,
    verdict,
    forceLow: formatContradicts || verdict.allContradict,
    contradicting,
    remakeYear: byYear ? (signals.seasonYear ?? signals.seriesYear ?? null) : null,
  };
}

/** Libellés des signaux (raisons « À vérifier » et journal), année de saison et de série confondues */
export function signalList(names: readonly SignalName[]): string {
  const labels: Record<SignalName, string> = {
    seasonYear: t('match.signal.year'),
    seriesYear: t('match.signal.year'),
    episodeCount: t('match.signal.episodes'),
    episodeMinutes: t('match.signal.duration'),
    format: t('match.signal.format'),
    country: t('match.signal.country'),
    originalTitle: t('match.signal.originalTitle'),
  };
  return formatList([...new Set(names.map((name) => labels[name]))]);
}

export const agreeReason = (concordance: SignalConcordance, checks: SignalChecks): string =>
  concordance.remakeYear !== null
    ? t('match.yearRemake', { year: String(concordance.remakeYear) })
    : t('match.signalsAgree', { signals: signalList(signalsWith(checks, 'agree')) });

/**
 * Résultat des règles confronté aux signaux :
 * - tout se contredit, ou fiche retenue dans un groupe contredit → à vérifier ;
 * - fiche sans lien vers la plateforme (titre seul) jugée sûre par les règles : sûre seulement si les signaux la
 *   prouvent (groupe unique confirmé, ou fiche hors saisons confirmée sans contradiction) ; aucun signal comparable
 *   (données absentes) → inchangé, comme sans signaux.
 */
export function checkedBySignals(episode: EpisodeNumbers, result: ResolveResult, concordance: SignalConcordance): ResolveResult {
  if (!result.ok || result.target.bySignals) return result;
  const { target } = result;
  const low = (reason: string): ResolveResult => ({ ok: true, target: { ...target, confidence: 'low', reason } });
  const disagree = (names: readonly SignalName[]): string => t('match.signalsContradict', { signals: signalList(names) });
  if (concordance.forceLow) return low(disagree(concordance.contradicting));
  const group: GroupVerdict<MediaCandidate> | undefined = concordance.verdict.groups.find((g) => g.entries.some((c) => c.id === target.mediaId));
  if (group && contradicts(group.checks)) return low(disagree(signalsWith(group.checks, 'contradict')));
  const chosen = concordance.candidates.find((c) => c.id === target.mediaId);
  if (target.confidence !== 'high' || !chosen || isLinked(chosen)) return result;
  const checks = group?.checks ?? checkGroup({ entries: [chosen], chain: -1, first: false }, concordance.signals, { absolute: isAbsoluteNumbering(episode) });
  if (!isApplicable(checks)) return result;
  if (!group && contradicts(checks)) return low(disagree(signalsWith(checks, 'contradict')));
  const proven = group ? concordance.verdict.proven && concordance.verdict.kept[0] === group : isConfirmed(checks);
  if (proven) return { ok: true, target: { ...target, reason: agreeReason(concordance, checks) } };
  return low(episode.platform === 'prime' ? t('match.platformTitleOnly', { platform: PLATFORMS.prime.label }) : t('match.titleOnly'));
}

/**
 * Fiche dans le groupe de saison que les signaux de la plateforme prouvent (groupe unique sans contradiction, confirmé
 * au-delà du titre, voir concordanceVerdict) : proposée à la place d'une correspondance en cache mise en doute.
 */
export function provenBySignals(episode: EpisodeNumbers, candidates: readonly MediaCandidate[], mediaId: number): boolean {
  if (!hasSignals(episode.signals)) return false;
  const { verdict } = signalConcordance(episode, candidates, episode.signals);
  const [group] = verdict.kept;
  return verdict.proven && group !== undefined && group.entries.some((c) => c.id === mediaId);
}

/**
 * Diagnostic (builds de dev, voir match-diagnostic.ts) : signaux comparés à chaque candidat (verdicts de son groupe de
 * saison, sinon de la fiche seule) et candidats gardés par la concordance. Sans signal : rien de comparé, tout gardé.
 */
export function candidateSignalChecks(episode: EpisodeNumbers, candidates: readonly MediaCandidate[]): Map<number, { checks: SignalChecks; kept: boolean }> {
  const result = new Map<number, { checks: SignalChecks; kept: boolean }>();
  if (!hasSignals(episode.signals)) {
    for (const c of candidates) result.set(c.id, { checks: {}, kept: true });
    return result;
  }
  const signals = episode.signals;
  const concordance = signalConcordance(episode, candidates, signals);
  const kept = new Set(concordance.candidates.map((c) => c.id));
  const context = { absolute: isAbsoluteNumbering(episode) };
  for (const c of candidates) {
    const group = concordance.verdict.groups.find((g) => g.entries.some((e) => e.id === c.id));
    result.set(c.id, { checks: group?.checks ?? checkGroup({ entries: [c], chain: -1, first: true }, signals, context), kept: kept.has(c.id) });
  }
  return result;
}
