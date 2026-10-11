import { t } from '../i18n';
import { sendMessage, type AdjustProgressPayload } from '../shared/messages';
import type { PageMediaView } from '../shared/page-media.types';
import type { AddListStatus, AdjustRetry, ListStatusChange, SyncOutcome } from '../shared/sync.types';
import { addFeedback, adjustFeedback, ratingFeedback, statusFeedback } from './feedback';
import type { InlineFeedback } from './state';
import type { MediaAction } from './media-actions';
import { formatStarValue } from './rating';

// Envoi des actions de la fiche au service worker et texte du retour : partagé par le popup et le panneau.

export type MediaActionRequest =
  | { kind: 'add'; status: AddListStatus }
  /** `retry` : nouvel essai après un échec partiel (progression absolue sur les seuls services en échec) */
  | { kind: 'adjust'; delta: 1 | -1; retry?: AdjustRetry }
  | { kind: 'status'; status: ListStatusChange }
  | { kind: 'rate'; value: number };

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
  }
}

/** Message ADJUST_PROGRESS : delta, ou nouvel essai ciblé (`retry`) ; partagé avec « En cours » du popup */
export function adjustPayload(mediaId: number | null, malId: number | null, delta: 1 | -1, retry?: AdjustRetry): AdjustProgressPayload {
  return retry ? { mediaId, malId, delta, retry: { services: retry.services, progress: retry.progress } } : { mediaId, malId, delta };
}

function send(request: MediaActionRequest, { media }: PageMediaView): Promise<SyncOutcome> {
  switch (request.kind) {
    case 'add':
      return sendMessage('ADD_TO_LIST', { mediaId: media.mediaId, malId: media.idMal, status: request.status });
    case 'adjust':
      return sendMessage('ADJUST_PROGRESS', adjustPayload(media.mediaId, media.idMal, request.delta, request.retry));
    case 'status': {
      // Affiche de la carte « À noter » : https uniquement (refusée sinon par la validation du message)
      const coverUrl = media.coverUrl?.startsWith('https://') && media.coverUrl.length <= 2000 ? media.coverUrl : null;
      return sendMessage('SET_LIST_STATUS', { mediaId: media.mediaId, malId: media.idMal, status: request.status, coverUrl });
    }
    case 'rate':
      return sendMessage('RATE_MEDIA', { media: { mediaId: media.mediaId, malId: media.idMal, title: media.title.slice(0, 300) }, score: request.value });
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
  }
}

/** Envoie l'action et retourne le retour à afficher (service worker injoignable → erreur) */
export async function runMediaAction(request: MediaActionRequest, view: PageMediaView, onError: (error: unknown) => void = () => undefined): Promise<InlineFeedback> {
  let outcome: SyncOutcome;
  try {
    outcome = await send(request, view);
  } catch (error: unknown) {
    onError(error);
    outcome = { status: 'error', message: t('popup.swUnreachable') };
  }
  return toFeedback(request, outcome, view);
}
