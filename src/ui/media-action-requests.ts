import type { AdjustProgressPayload } from '../protocol/messages';
import type { PageMediaView } from '../shared/page-media.types';
import type { AddListStatus, AdjustRetry, ListStatusChange, SyncOutcome } from '../shared/sync.types';
import { addFeedback, adjustFeedback, notesFeedback, ratingFeedback, removeFeedback, statusFeedback } from './feedback';
import { normalizeListNotes } from '../shared/list-notes';
import { toSafeImageUrl } from '../shared/url';
import type { InlineFeedback } from './state';
import { formatStarValue } from './rating';
import { mediaRefOf } from './media-ref';
import { callWorker, outcomeFailure } from './worker-call';

// Envoi des actions de la fiche au service worker et texte du retour : partagé par le popup et le panneau.

/** Action en cours (une seule à la fois) */
export type MediaAction = `add-${AddListStatus}` | 'minus' | 'plus' | `status-${ListStatusChange}` | 'rate' | 'season' | 'remove' | 'notes';

export interface MediaActionsState {
  busy: MediaAction | null;
  /** Retour de la dernière action (affiché quelques secondes) */
  feedback: InlineFeedback | null;
}

export type MediaActionRequest =
  | { kind: 'add'; status: AddListStatus }
  /** `retry` : nouvel essai après un échec partiel (progression absolue sur les seuls services en échec) */
  | { kind: 'adjust'; delta: 1 | -1; retry?: AdjustRetry }
  | { kind: 'status'; status: ListStatusChange }
  | { kind: 'rate'; value: number }
  /** Retire la série de chaque liste connectée où elle est (après confirmation) */
  | { kind: 'remove' }
  /** Commentaire de l'entrée ("" l'efface) */
  | { kind: 'notes'; notes: string };

/** Action affichée comme « en cours » (spinner sur le bouton concerné) */
export function mediaActionKey(request: MediaActionRequest): MediaAction {
  switch (request.kind) {
    case 'add':
      return `add-${request.status}`;
    case 'adjust':
      return request.delta === 1 ? 'plus' : 'minus';
    case 'status':
      return `status-${request.status}`;
    case 'rate':
      return 'rate';
    case 'remove':
      return 'remove';
    case 'notes':
      return 'notes';
  }
}

/** Message ADJUST_PROGRESS : delta, ou nouvel essai ciblé (`retry`) ; partagé avec « En cours » du popup */
export function adjustPayload(mediaId: number | null, malId: number | null, delta: 1 | -1, retry?: AdjustRetry): AdjustProgressPayload {
  return retry ? { mediaId, malId, delta, retry: { services: retry.services, progress: retry.progress } } : { mediaId, malId, delta };
}

/** Message de l'action ; service worker injoignable → erreur affichée comme n'importe quel échec */
function send(request: MediaActionRequest, { media }: PageMediaView): Promise<SyncOutcome> {
  switch (request.kind) {
    case 'add':
      return callWorker('ADD_TO_LIST', { mediaId: media.mediaId, malId: media.idMal, status: request.status }, outcomeFailure);
    case 'adjust':
      return callWorker('ADJUST_PROGRESS', adjustPayload(media.mediaId, media.idMal, request.delta, request.retry), outcomeFailure);
    case 'status': {
      // Affiche de la carte « À noter » : hôtes d'images autorisés seulement (IMAGE_HOSTS), sinon sans affiche ; une
      // affiche refusée par la validation du message ferait échouer tout le changement de statut
      return callWorker('SET_LIST_STATUS', { mediaId: media.mediaId, malId: media.idMal, status: request.status, coverUrl: toSafeImageUrl(media.coverUrl) }, outcomeFailure);
    }
    case 'rate':
      return callWorker('RATE_MEDIA', { media: mediaRefOf(media.mediaId, media.idMal, media.title), score: request.value }, outcomeFailure);
    case 'remove':
      return callWorker('REMOVE_FROM_LIST', { media: mediaRefOf(media.mediaId, media.idMal, media.title) }, outcomeFailure);
    case 'notes':
      return callWorker('SET_LIST_NOTES', { media: mediaRefOf(media.mediaId, media.idMal, media.title), notes: request.notes }, outcomeFailure);
  }
}

function toFeedback(request: MediaActionRequest, outcome: SyncOutcome, view: PageMediaView): InlineFeedback {
  switch (request.kind) {
    case 'add':
      return addFeedback(outcome, request.status);
    case 'adjust':
      return adjustFeedback(outcome, request.delta, request.retry);
    case 'status':
      return statusFeedback(outcome, request.status);
    case 'rate': {
      const { tone, text, detail } = ratingFeedback(outcome, formatStarValue(request.value), view.media.title);
      return { tone, text, detail };
    }
    case 'remove':
      return removeFeedback(outcome);
    case 'notes':
      return notesFeedback(outcome, normalizeListNotes(request.notes) === '');
  }
}

/** Envoie l'action et retourne le retour à afficher (service worker injoignable → erreur) */
export async function runMediaAction(request: MediaActionRequest, view: PageMediaView): Promise<InlineFeedback> {
  return toFeedback(request, await send(request, view), view);
}
