import { t } from '../../i18n/content';
import type { MediaRef } from '../../shared/engagement.types';
import { sendMessage } from '../../protocol/messages';
import type { SyncOutcome } from '../../shared/sync.types';
import { formatScoreLabel } from '../../ui/rating';
import { createStarRating } from '../../ui/star-rating';
import { createLogger } from '../../browser/logger';
import type { EngagementPrompt } from './notification-policy';
import { ALERT_TOAST_MS, engagementResultToast, RATING_PROMPT_MS, REWATCH_PROMPT_MS } from './sync-toast';
import { showToast, type ToastHandle } from './toast';

const log = createLogger('prompt');
const swUnreachable = (): SyncOutcome => ({ status: 'error', message: t('content.unreachable.full') });

/** Classes de la feuille du Shadow DOM du toast (voir STYLES dans toast.ts) */
const STAR_CLASSES = { group: 'stars', row: 'stars-row', value: 'stars-value', star: 'star', outline: 'star-outline', fill: 'star-fill', half: 'star-half' };

async function send(run: () => Promise<SyncOutcome>): Promise<SyncOutcome> {
  try {
    return await run();
  } catch (error: unknown) {
    log.error('Service worker injoignable :', error);
    return swUnreachable();
  }
}

/** Affiche la demande portée par une synchro (bulle unique, remplace le résultat de la synchro) */
export function showEngagementPrompt(prompt: EngagementPrompt): void {
  if (prompt.kind === 'rate') showRatingPrompt(prompt.media);
  else showRewatchPrompt(prompt.media, prompt.progress);
}

/**
 * « Ta note ? » : un clic sur une valeur envoie la note (sur 10) au service worker.
 * « Plus tard », ×, 20 s sans réponse ou bulle remplacée → note reportée (carte « À noter » du popup).
 */
function showRatingPrompt(media: MediaRef): void {
  /** Note envoyée, reportée ou relancée : la fermeture de cette bulle ne doit plus rien reporter */
  let settled = false;
  const defer = (): void => {
    if (settled) return;
    settled = true;
    sendMessage('DEFER_RATING', { media, coverUrl: null })
      .then((result) => !result.ok && log.warn('Report de la note impossible :', result.message))
      .catch((error: unknown) => log.error('Report de la note impossible :', error));
  };

  async function rate(value: number): Promise<void> {
    // Bulle « Enregistrement… » sans rappel de fermeture : un × pendant l'envoi ne reporte rien
    handle.update({ tone: 'info', title: t('prompt.rating.saving'), message: media.title }, { variant: 'bubble' });
    const outcome = await send(() => sendMessage('RATE_MEDIA', { media, score: value }));
    log.info('Résultat de la note :', outcome);
    const result = engagementResultToast(outcome, { success: t('prompt.rating.saved', { score: formatScoreLabel(value) }), failure: t('prompt.rating.failed'), mediaTitle: media.title });
    if (result.ok) {
      settled = true;
      handle.update(result.content, { variant: result.variant, autoHideMs: result.autoHideMs });
      return;
    }
    // Échec : « Réessayer » rouvre la notation ; sinon la note est reportée à la fermeture
    const action = {
      label: t('common.retry'),
      onClick: () => {
        settled = true;
        showRatingPrompt(media);
      },
    };
    handle.update({ ...result.content, action }, { variant: 'bubble', autoHideMs: result.autoHideMs, onDismiss: defer });
  }

  const handle: ToastHandle = showToast(
    {
      tone: 'info',
      title: t('prompt.rating.title', { title: media.title }),
      message: t('prompt.rating.question'),
      body: createStarRating({ label: t('rating.groupLabel', { title: media.title }), classes: STAR_CLASSES, onConfirm: (value) => void rate(value) }),
      actions: [
        {
          label: t('prompt.rating.later'),
          kind: 'ghost',
          onClick: () => {
            defer();
            handle.dismiss();
          },
        },
      ],
    },
    { variant: 'bubble', autoHideMs: RATING_PROMPT_MS, onDismiss: defer },
  );
}

/** « Tu revois … ? » : Oui → revisionnage (REPEATING) ; Non → plus de question pendant 30 jours ; sans réponse → rien */
function showRewatchPrompt(media: MediaRef, progress: number): void {
  /** `target` : bulle à mettre à jour (une erreur affichée après un × ouvre un nouveau toast, d'où le paramètre) */
  async function start(target: ToastHandle): Promise<void> {
    const saving = { tone: 'info', title: t('prompt.rewatch.saving'), message: media.title } as const;
    target.update(saving, { variant: 'bubble' });
    const outcome = await send(() => sendMessage('START_REWATCH', { media, progress }));
    log.info('Résultat du revisionnage :', outcome);
    const result = engagementResultToast(outcome, { success: t('prompt.rewatch.saved', { progress }), failure: t('prompt.rewatch.failed'), mediaTitle: media.title });
    const action = result.ok ? undefined : { label: t('common.retry'), onClick: () => void start(showToast(saving)) };
    target.update({ ...result.content, action }, { variant: result.variant, autoHideMs: result.autoHideMs });
  }

  async function decline(): Promise<void> {
    handle.dismiss();
    try {
      const result = await sendMessage('DECLINE_REWATCH', { media });
      if (!result.ok) log.warn('Refus du revisionnage non enregistré :', result.message);
    } catch (error: unknown) {
      log.error('Service worker injoignable :', error);
      showToast({ tone: 'error', title: t('content.unreachable.title'), message: t('content.unreachable.message') }, { autoHideMs: ALERT_TOAST_MS });
    }
  }

  const handle: ToastHandle = showToast(
    {
      tone: 'info',
      title: t('prompt.rewatch.title', { title: media.title }),
      actions: [
        { label: t('prompt.rewatch.no'), kind: 'ghost', onClick: () => void decline() },
        { label: t('prompt.rewatch.yes'), kind: 'primary', onClick: () => void start(handle) },
      ],
    },
    { variant: 'bubble', autoHideMs: REWATCH_PROMPT_MS },
  );
}
