import { t } from '../../../../i18n';
import type { NumberingMode } from '../../../../shared/sync.types';
import type { EpisodeNumbers, MediaCandidate, ResolveFailure } from '../model';
import type { SignalConcordance } from '../signal-groups';

// Contrat des étapes de resolveByRules (voir rules-engine.ts) : un contexte calculé une fois, des étapes pures qui
// proposent une fiche, échouent, ou passent la main (null) à la suivante. Seul `finalize` transforme une proposition en
// résultat (plafond « autre slug », raisons du titre seul, marque byRank).

/** Épisode et candidats, et ce que les étapes en déduisent (aucun calcul ne dépend de l'ordre des étapes) */
export interface RulesContext {
  episode: EpisodeNumbers;
  candidates: readonly MediaCandidate[];
  /** Saisons de la série (voir seasonPool) et leurs groupes (parties « Part 2 » réunies, voir groupSeasons) */
  pool: MediaCandidate[];
  groups: MediaCandidate[][];
  animeKey: string;
  /** Fiches séries rattachées à la série de la plateforme */
  linked: MediaCandidate[];
  /** Liens Disney+ / Prime Video au titre de la série répartis sur plusieurs franchises : aucun ne désigne la série */
  untrustedLinks: boolean;
  /** Sans lien : titre seul fiable (une saison au titre de la série, et c'est la 1re) */
  trustedTitleMatch: boolean;
  /** Fiches au titre de la série (ou liées) formant une seule saison */
  soleSeason: boolean;
  /** Fiche écartée sur un ancien slug différent (voir finalize) */
  weakExclusion: boolean;
  /** Numéro de saison du titre, sinon de la plateforme (effectiveSeasonNumber) */
  seasonNumber: number | null;
  /** Saison retenue pour le placement par numéro : seasonNumber, sinon 1 pour une série d'une seule saison */
  season: number | null;
  displayed: number | null;
  /** Numéro dans la saison (à défaut, numéro affiché), entier */
  relative: number;
  /** Numérotation absolue (One Piece E1180 pour S24 E25) */
  isAbsolute: boolean;
  /** Groupe désigné par le titre de saison (voir titleSeasonGroup) */
  designated: { group: MediaCandidate[]; from: MediaCandidate[] } | null;
  concordance: SignalConcordance | null;
  /** Groupe prouvé par les signaux de la saison (étape provenBySignals), calculé d'avance : l'étape dedicated s'y réfère */
  proven: Proposal | null;
}

/** Fiche proposée par une étape, avant les règles transversales de finalize */
export interface Proposal {
  candidate: MediaCandidate;
  /** Numéro de la plateforme d'où part le décalage (offset = base − progress) */
  base: number;
  progress: number;
  numbering: NumberingMode;
  confidence: 'high' | 'low';
  /** Raison de la règle appliquée */
  reason: string;
  /** Raison d'un choix sûr sans aucun lien (titre seul) ; défaut : match.titleOnlyTrusted */
  trustedReason?: string;
  /** Fiche dédiée au titre « série + saison » exact : le rang des saisons n'y joue aucun rôle, pas de plafond */
  byExactTitle?: boolean;
  /** Placement par le seul rang de la saison (voir SyncTarget.byRank) */
  byRank?: boolean;
  /**
   * Groupe prouvé par les signaux : confiance et raison gardées telles quelles, sans raison du titre seul ; plafond « autre
   * slug » seulement si la preuve n'est que le nombre d'épisodes (`countOnlyProof`, audit L1, décision 9)
   */
  bySignals?: boolean;
  /** Groupe prouvé par le seul nombre d'épisodes (ni année ni titre original) : une saison décalée de même longueur passerait */
  countOnlyProof?: boolean;
}

/** Proposition, échec définitif, ou null : l'étape ne s'applique pas, la suivante décide */
export type StageResult = Proposal | ResolveFailure | null;

export type Stage = (ctx: RulesContext) => StageResult;

export const isProposal = (result: Proposal | ResolveFailure): result is Proposal => 'candidate' in result;

export const failure = (reason: string): ResolveFailure => ({ ok: false, reason });

export const noEntry = (ctx: Pick<RulesContext, 'episode'>): ResolveFailure => failure(t('match.noEntry', { title: ctx.episode.animeTitle }));

/** Confiance d'une règle jugée sûre : fiable seulement avec des liens dignes de confiance, ou un titre seul fiable */
export const level = (ctx: RulesContext, isConfident: boolean): 'high' | 'low' =>
  isConfident && ((ctx.linked.length > 0 && !ctx.untrustedLinks) || ctx.trustedTitleMatch) ? 'high' : 'low';

/** Titre et numéro en désaccord (fiche retenue hors du groupe désigné par le titre de saison) : jamais sûr */
export const outsideTitle = (ctx: RulesContext, candidate: MediaCandidate): boolean => ctx.designated !== null && !ctx.designated.group.includes(candidate);

/** Confiance d'un placement par numéro : basse hors du groupe désigné par le titre, sinon level */
export const levelByNumber = (ctx: RulesContext, candidate: MediaCandidate, isConfident: boolean): 'high' | 'low' =>
  outsideTitle(ctx, candidate) ? 'low' : level(ctx, isConfident);
