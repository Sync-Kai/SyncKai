import type { EpisodeInfo } from '../../shared/episode.types';
import {
  MATCH_DIAGNOSTIC_MAX,
  MATCH_DIAGNOSTIC_MAX_CANDIDATES,
  readMatchDecisions,
  type DiagnosticCandidate,
  type MappingOrigin,
  type MatchDecision,
} from '../../shared/match-diagnostic';
import { createLogger } from '../../browser/logger';
import { sessionArea } from '../../browser/storage/session-cache';
import { MATCH_DIAGNOSTIC_KEY } from '../../protocol/storage-keys';
import type { MediaMapping } from '../../shared/sync.types';
import type { RequestLane } from '../rate-limit';
import { candidateSignalChecks, type CachedMappingVerdict, type MediaCandidate, type ResolveResult } from './matching';

// Diagnostic des correspondances, builds de dev seulement (`npm run build:dev`) : chaque appel est placé sous
// `if (__SYNCKAI_DEBUG__)` par resolver.ts, donc absent des bundles publiés (vérifié par une recherche de
// MATCH_DIAGNOSTIC_KEY dans dist/). Décisions lues dans Réglages › Aide (ui/settings/match-diagnostic.ts).

const log = createLogger('sync');

export interface DecisionInput {
  episode: EpisodeInfo;
  key: string;
  lane: RequestLane;
  source: MatchDecision['decision']['source'];
  /** Candidats comparés (vide : correspondance en cache sans fiche relue, ou série ignorée sans recherche) */
  candidates: readonly MediaCandidate[];
  result: ResolveResult;
  mapping?: { mapping: MediaMapping; verdict: CachedMappingVerdict['kind'] } | null;
}

export const mappingOrigin = (mapping: MediaMapping): MappingOrigin => (mapping.chosen === true ? 'chosen' : mapping.learned === true ? 'learned' : 'unmarked');

/** Décision réduite à ce qui sert à un cas du corpus (pur, testable) */
export function toMatchDecision({ episode, key, lane, source, candidates, result, mapping = null }: DecisionInput, at: number): MatchDecision {
  const checks = candidateSignalChecks(episode, candidates);
  const compared: DiagnosticCandidate[] = candidates.slice(0, MATCH_DIAGNOSTIC_MAX_CANDIDATES).map((c) => ({
    id: c.id,
    title: c.titles[0] ?? null,
    startYear: c.startDate === null ? null : Math.floor(c.startDate / 10_000),
    episodes: c.episodes,
    format: c.format,
    duration: c.duration ?? null,
    link: c.link,
    kept: checks.get(c.id)?.kept ?? true,
    checks: checks.get(c.id)?.checks ?? {},
  }));
  return {
    at,
    platform: episode.platform,
    key,
    lane,
    seriesTitle: episode.animeTitle,
    seasonTitle: episode.seasonTitle,
    seasonNumber: episode.seasonNumber,
    seasonEpisodeNumber: episode.seasonEpisodeNumber,
    displayedEpisodeNumber: episode.displayedEpisodeNumber,
    signals: episode.signals ?? null,
    candidates: compared,
    decision: {
      source,
      mediaId: result.ok ? result.target.mediaId : null,
      confidence: result.ok ? result.target.confidence : null,
      reason: result.ok ? result.target.reason : result.reason,
      bySignals: result.ok && result.target.bySignals === true,
      mapping: mapping ? { mediaId: mapping.mapping.mediaId, origin: mappingOrigin(mapping.mapping), verdict: mapping.verdict } : null,
    },
  };
}

/** Écritures en série dans ce contexte (lecture puis écriture de la liste) */
let pending: Promise<void> = Promise.resolve();

/** Ajoute une décision (les plus récentes d'abord, 50 au plus) ; sans effet hors build de dev ou sans `storage.session` */
export function recordMatchDecision(input: DecisionInput): void {
  if (!__SYNCKAI_DEBUG__) return;
  const decision = toMatchDecision(input, Date.now());
  pending = pending
    .then(async () => {
      const area = sessionArea();
      if (!area) return;
      const previous = await readMatchDecisions();
      await area.set({ [MATCH_DIAGNOSTIC_KEY]: [decision, ...previous].slice(0, MATCH_DIAGNOSTIC_MAX) });
    })
    .catch((error: unknown) => log.warn('Diagnostic des correspondances non enregistré :', error));
}
