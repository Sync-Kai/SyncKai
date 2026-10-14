import { isRecord } from './guards';
import type { PlatformSignals } from './match-signals';
import type { StreamingPlatform } from './platforms';
import { sessionArea } from './session-cache';
import { MATCH_DIAGNOSTIC_KEY } from './storage-keys';

// Diagnostic des correspondances (builds de dev seulement) : décisions de la résolution AniList écrites par le service
// worker (background/sync/match-diagnostic.ts), lues et effacées par Réglages › Aide. `storage.session` : en mémoire,
// vidé à la fermeture du navigateur ; rien de lié au compte (catalogue AniList et données de la page seulement).

/** Décisions gardées (les plus récentes d'abord) */
export const MATCH_DIAGNOSTIC_MAX = 50;
/** Candidats gardés par décision (ordre de la recherche) */
export const MATCH_DIAGNOSTIC_MAX_CANDIDATES = 12;

/** Verdict d'un signal contre un candidat (concordance.ts › SignalCheck) */
export type DiagnosticCheck = 'agree' | 'weak-agree' | 'contradict' | 'weak-contradict' | 'unknown';
export type DiagnosticSignal = 'format' | 'seasonYear' | 'seriesYear' | 'episodeCount' | 'episodeMinutes' | 'country' | 'originalTitle';

export interface DiagnosticCandidate {
  id: number;
  title: string | null;
  startYear: number | null;
  episodes: number | null;
  format: string | null;
  /** Minutes par épisode */
  duration: number | null;
  /** Lien avec la série (matching.ts › LinkKind) */
  link: string | null;
  /** Gardé par la concordance (false : écarté par le format ou une franchise contredite) */
  kept: boolean;
  /** Signaux comparés au groupe de saison du candidat (à la fiche seule hors groupe) */
  checks: Partial<Record<DiagnosticSignal, DiagnosticCheck>>;
}

/** Origine d'une correspondance en cache (sync.types.ts › MediaMapping) */
export type MappingOrigin = 'learned' | 'chosen' | 'unmarked';

export interface MatchDecision {
  at: number;
  platform: StreamingPlatform;
  /** Clé de la correspondance (matching.ts › mappingKey) */
  key: string;
  /** 'interactive' (lecture, page) ou 'background' (import) */
  lane: string;
  seriesTitle: string;
  seasonTitle: string | null;
  seasonNumber: number | null;
  seasonEpisodeNumber: number | null;
  displayedEpisodeNumber: number | null;
  signals: PlatformSignals | null;
  candidates: DiagnosticCandidate[];
  decision: {
    /** cache : correspondance en cache ; doubted : en cache mais contredite ; resolved : recherche ; ignored : sans recherche */
    source: 'cache' | 'doubted' | 'resolved' | 'ignored';
    mediaId: number | null;
    confidence: 'high' | 'low' | null;
    reason: string;
    bySignals: boolean;
    /** Correspondance en cache lue (et son verdict face aux signaux), null sans correspondance */
    mapping: { mediaId: number; origin: MappingOrigin; verdict: 'keep' | 'drop' | 'doubt' } | null;
  };
}

/** Forme minimale (écrite par le service worker de la même extension) : de quoi afficher la ligne sans planter */
export function isMatchDecision(value: unknown): value is MatchDecision {
  return (
    isRecord(value) &&
    typeof value.at === 'number' &&
    typeof value.platform === 'string' &&
    typeof value.key === 'string' &&
    typeof value.seriesTitle === 'string' &&
    Array.isArray(value.candidates) &&
    isRecord(value.decision) &&
    typeof value.decision.reason === 'string' &&
    typeof value.decision.source === 'string'
  );
}

/** Décisions enregistrées, les plus récentes d'abord ; vide sans `storage.session` */
export async function readMatchDecisions(): Promise<MatchDecision[]> {
  const area = sessionArea();
  if (!area) return [];
  const stored: unknown = (await area.get(MATCH_DIAGNOSTIC_KEY))[MATCH_DIAGNOSTIC_KEY];
  return Array.isArray(stored) ? stored.filter(isMatchDecision) : [];
}

export async function clearMatchDecisions(): Promise<void> {
  await sessionArea()?.remove(MATCH_DIAGNOSTIC_KEY);
}
