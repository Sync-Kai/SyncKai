// Carte « À vérifier » (maquette PopupVerification) : textes et règles pures, sans rendu. En-tête de l'épisode, détails
// d'une fiche candidate, fiche cochée et numéro proposés au départ, contrôle du numéro saisi, mentions d'une correction,
// et ordre des cartes affichées (une carte occupée reste à sa place après le retrait de sa vérification).
import { t, type MessageKey } from '../i18n';
import type { CandidateSummary, PendingReview } from '../shared/review.types';
import { PLATFORM_LABELS } from './kit';

/** Formats traduits ; les autres (TV, ONA, OVA…) restent tels qu'AniList les nomme */
const FORMAT_LABELS: Readonly<Record<string, MessageKey>> = {
  TV_SHORT: 'review.format.tvShort',
  MOVIE: 'review.format.movie',
  SPECIAL: 'review.format.special',
};

function formatLabel(format: string): string {
  const key = FORMAT_LABELS[format];
  return key ? t(key) : format;
}

/** « S2 · E5 · (affiché E30) · Netflix » */
export function reviewEpisodeLabel({ episode }: PendingReview): string {
  const parts = [
    episode.seasonNumber !== null ? `S${episode.seasonNumber}` : null,
    episode.seasonEpisodeNumber !== null ? `E${episode.seasonEpisodeNumber}` : null,
  ].filter((p): p is string => p !== null);
  const displayed = episode.displayedEpisodeNumber;
  if (displayed !== null && displayed !== episode.seasonEpisodeNumber) parts.push(t('review.displayed', { number: displayed }));
  parts.push(PLATFORM_LABELS[episode.platform]);
  return parts.join(' · ');
}

/** « TV · 12 ép. · 2023 » ; rien de connu : « — » */
export function candidateMeta(candidate: CandidateSummary): string {
  const parts = [candidate.format ? formatLabel(candidate.format) : null, candidate.episodes !== null ? t('review.episodes', { count: candidate.episodes }) : null, candidate.year];
  return parts.filter((p) => p !== null).join(' · ') || '—';
}

/** Fiche cochée au départ : la suggestion, sinon la première proposée, sinon aucune */
export function defaultCandidate(review: PendingReview): CandidateSummary | null {
  const suggested = review.suggestion?.mediaId;
  return review.candidates.find((c) => c.id === suggested) ?? review.candidates[0] ?? null;
}

/** Numéro proposé : celui de la suggestion, sinon l'épisode dans la saison, sinon le numéro affiché */
export function defaultProgress(review: PendingReview): string {
  const value = review.suggestion?.progress ?? review.episode.seasonEpisodeNumber ?? review.episode.displayedEpisodeNumber;
  return value !== null ? String(value) : '';
}

export type ProgressCheck = { ok: true; progress: number } | { ok: false; title: string; message: string };

/** Numéro saisi : entier de 1 au nombre d'épisodes de la fiche choisie (inconnu : pas de maximum) */
export function checkProgress(text: string, max: number | null): ProgressCheck {
  const progress = Number(text);
  if (text.trim() !== '' && Number.isInteger(progress) && progress >= 1 && (max === null || progress <= max)) return { ok: true, progress };
  return { ok: false, title: t('review.invalidEpisode'), message: max !== null ? t('review.invalidRange', { max }) : t('review.invalidMin') };
}

/** Mention de l'épisode mis de côté pendant une correction (appliqué après la décision), null sans épisode */
export function deferredNote({ deferred }: PendingReview): string | null {
  if (!deferred) return null;
  const number = deferred.episode.displayedEpisodeNumber ?? deferred.episode.seasonEpisodeNumber;
  return t('review.deferredNote', { number: number ?? '?' });
}

/** Correction vers une autre fiche : la progression écrite sur l'ancienne n'est pas annulée, à corriger à la main */
export function previousNote(review: PendingReview, chosenId: number): string | null {
  const previous = review.previous;
  return previous && previous.mediaId !== chosenId ? t('review.previousNote', { title: previous.title, progress: previous.progress }) : null;
}

/** Résultats d'une recherche, sans les fiches déjà proposées */
export function freshResults(review: PendingReview, results: readonly CandidateSummary[]): CandidateSummary[] {
  return results.filter((c) => !review.candidates.some((r) => r.id === c.id));
}

/**
 * Ordre des cartes : les nouvelles vérifications en tête (dans l'ordre du stockage, la plus récente d'abord), puis les
 * cartes déjà affichées à leur place, tant que leur vérification existe ou qu'elles sont occupées (envoi, résultat).
 */
export function reviewOrder(shown: readonly string[], stored: readonly string[], held: ReadonlySet<string>): string[] {
  const storedSet = new Set(stored);
  const kept = shown.filter((key) => storedSet.has(key) || held.has(key));
  const keptSet = new Set(kept);
  return [...stored.filter((key) => !keptSet.has(key)), ...kept];
}
