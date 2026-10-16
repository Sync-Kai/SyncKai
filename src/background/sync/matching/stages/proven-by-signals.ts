import { PROOF_SIGNALS } from '../concordance';
import { fits, SEASON_COUNT_TOLERANCE, totalEpisodes, walkSeasons } from '../model';
import { agreeReason, type SignalConcordance } from '../signal-groups';
import type { Proposal, Stage } from './context';

/**
 * Groupe prouvé par les signaux de la SAISON (année de début ou nombre d'épisodes) : épisode placé dans ce groupe par
 * son numéro dans la saison, quel que soit le rang des saisons (Mushoku Tensei S2 Netflix = « II » + « II Part 2 », alors
 * que « Part 2 », liée seulement à Crunchyroll, manque aux fiches liées à Netflix). null : pas de preuve, saison de la
 * plateforme plus courte que le groupe (cours découpé autrement : position inconnue), ou épisode hors du groupe.
 */
export function provenProposal(concordance: SignalConcordance, relative: number): Proposal | null {
  const { verdict, signals } = concordance;
  const [group] = verdict.kept;
  if (!verdict.proven || !group || (group.checks.seasonYear !== 'agree' && group.checks.episodeCount !== 'agree')) return null;
  const total = totalEpisodes(group.entries);
  const count = signals.seasonEpisodeCount;
  if (count !== undefined && total !== null && count < total - SEASON_COUNT_TOLERANCE && signals.airing !== true) return null;
  const hit = walkSeasons(group.entries, 0, relative);
  const chosen = hit ? group.entries[hit.index] : undefined;
  if (!hit || !chosen || !fits(chosen, hit.progress)) return null;
  // Seule preuve : le nombre d'épisodes (ni année ni titre original), qui ne distingue pas une saison décalée de même longueur
  const proofs = PROOF_SIGNALS.filter((name) => group.checks[name] === 'agree');
  const countOnly = proofs.length === 1 && proofs[0] === 'episodeCount';
  return { candidate: chosen, base: relative, progress: hit.progress, numbering: 'season', confidence: 'high', reason: agreeReason(concordance, group.checks), bySignals: true, ...(countOnly ? { countOnlyProof: true } : {}) };
}

/** Groupe prouvé par les signaux (calculé avec le contexte, voir RulesContext.proven) : prime sur le rang des saisons */
export const provenBySignals: Stage = (ctx) => ctx.proven;
