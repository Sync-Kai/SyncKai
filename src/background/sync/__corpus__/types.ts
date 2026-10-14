import type { EpisodeInfo } from '../../../shared/episode.types';
import type { PageMediaInfo } from '../../../shared/page-media.types';
import { isRecord } from '../../../shared/guards';

// Corpus de cas réels de correspondance (voir README.md) : types des instantanés AniList et des cas.

/**
 * Signaux AniList pas encore lus par la résolution (étapes suivantes de feature/match-signals), relevés à part pour ne
 * rien changer à la forme lue par parseMedia.
 */
export interface CorpusSignals {
  /** Durée d'un épisode (minutes) */
  duration: number | null;
  /** Pays d'origine (JP, CN, KR, TW…) */
  countryOfOrigin: string | null;
  /** FINISHED, RELEASING, NOT_YET_RELEASED, CANCELLED, HIATUS */
  status: string | null;
  seasonYear: number | null;
  endDate: { year: number | null; month: number | null; day: number | null } | null;
}

/** Fiche AniList telle que renvoyée par la recherche (champs de MEDIA_FIELDS), liens réduits aux plateformes prises en charge */
export interface CorpusMedia {
  id: number;
  idMal: number | null;
  format: string | null;
  episodes: number | null;
  startDate: { year: number | null; month: number | null; day: number | null } | null;
  seasonYear: number | null;
  title: { romaji: string | null; english: string | null; native: string | null; userPreferred: string | null };
  synonyms: string[];
  externalLinks: { url: string }[];
  relations: { edges: { relationType: string | null; node: { id: number; type: string | null; format: string | null } }[] };
  signals: CorpusSignals;
}

/**
 * Instantané d'une franchise : résultats (identifiants, dans l'ordre de l'API) de chaque requête que SyncKai envoie pour
 * ses cas. `searches` : clé = texte exact de la recherche ; `byIds` : clé = identifiants demandés, triés, joints par « , ».
 * Une valeur `null` : requête à relever (scripts/refresh-anilist-corpus.ts --pending).
 */
export interface AniListSnapshot {
  /** Date du relevé (AAAA-MM-JJ) */
  fetchedAt: string;
  searches: Record<string, number[] | null>;
  byIds: Record<string, number[] | null>;
  media: CorpusMedia[];
}

/** Résultat de la résolution, réduit à ce que l'utilisateur voit : fiche, confiance, épisode envoyé */
export interface CorpusOutcome {
  mediaId: number | null;
  /** high : synchro directe ; low : « À vérifier » (ou « Saison devinée ») ; ignored : série ignorée ; not-found : introuvable */
  confidence: 'high' | 'low' | 'ignored' | 'not-found';
  /** Épisode envoyé à AniList (page de lecture), absent sur une page de série */
  progress?: number | null;
}

interface CaseBase {
  /** Identifiant stable du cas (plateforme-série-situation) */
  id: string;
  /** Situation réelle et source (signalement, test, relevé) */
  note: string;
  /** Instantané AniList (nom du fichier anilist/<name>.json) */
  anilist: string;
  /** Recherches AniList envoyées aujourd'hui, dans l'ordre (budget de requêtes figé avec le résultat) */
  searches: string[];
  /** Comportement ACTUEL du code (vérifié strictement par corpus.test.ts) */
  expected: CorpusOutcome;
  /**
   * Ce que veut le propriétaire : bonne fiche ; « high » seulement si un lien ou des signaux le prouvent. Absent :
   * identique à `expected` (cas déjà idéal).
   */
  ideal?: CorpusOutcome;
  /** Pourquoi le résultat actuel n'est pas idéal (obligatoire avec `ideal`) */
  gap?: string;
  /** Signaux de la plateforme relevés sur le site, pas encore transmis à la résolution (étapes suivantes) */
  signals?: PlatformSignals;
}

/** Saison de la plateforme telle que relevée (Netflix : `video.seasons[]` des métadonnées) */
export interface PlatformSeasonSignal {
  /** Numéro de la saison sur la plateforme (Netflix `seq`) */
  seq: number;
  /** Année de DÉBUT d'origine de la saison (Netflix `seasons[].year`, vérifiée le 2026-10-14 ; `video.year` absent pour une série) */
  year: number;
  episodes: number;
  title?: string;
}

export interface PlatformSignals {
  seasons?: PlatformSeasonSignal[];
  /**
   * Année de début de la SÉRIE (pas de la saison) : Disney+ `page.visuals.metastringParts.releaseYearRange.startYear`
   * (chaîne dans la réponse, convertie ici), page de série seulement
   */
  seriesStartYear?: number;
  /** Durée d'un épisode (s) : Disney+ `items[].visuals.durationMs` / 1000, Netflix `runtime`, Prime `duration` */
  episodeDurationS?: number;
  /** Origine du relevé (capture du propriétaire, fixture…) */
  source: string;
}

/** Page de lecture : synchro de l'épisode (resolveEpisode) */
export interface EpisodeCase extends CaseBase {
  kind: 'episode';
  episode: EpisodeInfo;
}

/** Page de série : fiche « Sur cette page » (resolvePageMedia) */
export interface SeriesCase extends CaseBase {
  kind: 'series';
  page: PageMediaInfo;
}

export type CorpusCase = EpisodeCase | SeriesCase;

const isNullableNumber = (v: unknown): v is number | null => v === null || typeof v === 'number';
const isIdList = (v: unknown): v is number[] | null => v === null || (Array.isArray(v) && v.every((id) => typeof id === 'number'));
const isResults = (v: unknown): v is Record<string, number[] | null> => isRecord(v) && Object.values(v).every(isIdList);

function isCorpusMedia(value: unknown): value is CorpusMedia {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    isNullableNumber(value.episodes) &&
    isRecord(value.title) &&
    Array.isArray(value.synonyms) &&
    Array.isArray(value.externalLinks) &&
    isRecord(value.relations) &&
    Array.isArray(value.relations.edges) &&
    isRecord(value.signals)
  );
}

/** Instantané JSON relu (forme vérifiée : un fichier abîmé échoue au chargement, pas au milieu d'un cas) */
export function asSnapshot(name: string, value: unknown): AniListSnapshot {
  if (
    !isRecord(value) ||
    typeof value.fetchedAt !== 'string' ||
    !isResults(value.searches) ||
    !isResults(value.byIds) ||
    !Array.isArray(value.media) ||
    !value.media.every(isCorpusMedia)
  ) {
    throw new Error(`Instantané AniList illisible : anilist/${name}.json`);
  }
  return { fetchedAt: value.fetchedAt, searches: value.searches, byIds: value.byIds, media: value.media };
}
