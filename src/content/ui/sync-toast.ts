import { lowerFirst, t } from '../../i18n/content';
import type { NotificationLevel } from '../../shared/settings';
import { describeOutcome } from '../../shared/sync-feedback';
import type { ServiceResult, SyncOutcome } from '../../shared/sync.types';
import { TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { decideExcludedNotification, decideNotification, isAlertTone } from './notification-policy';
import type { ToastBadge, ToastContent, ToastLine, ToastLineTone, ToastVariant } from './toast';

export const PILL_TOAST_MS = 3_000;
export const SUCCESS_TOAST_MS = 5_000;
export const ALERT_TOAST_MS = 9_000;
/** Explication du raccourci « valider l'épisode » quand il n'envoie rien (aucune lecture, pause…) */
export const NOTICE_TOAST_MS = 5_000;
/** Toast d'erreur avec "Réessayer" : laissé plus longtemps pour avoir le temps de cliquer */
export const RETRY_TOAST_MS = 15_000;

export interface OutcomeToast {
  content: ToastContent;
  variant: ToastVariant;
  autoHideMs: number;
}

/** Épisode lu sur la page : sous-titre des bulles qui n'ont pas de fiche (échec, à vérifier…) */
export interface ToastEpisode {
  series: string;
  episode: number | null;
}

/** Sous-titre « série · ép. 6 » (la série seule sans numéro) */
export function episodeSubtitle(series: string, episode: number | null): string {
  return episode !== null ? t('content.episodeShort', { title: series, number: episode }) : series;
}

/** Message placé en fin de ligne : minuscule initiale, sauf un nom propre en casse mixte (« AniList », « SyncKai ») */
function lowerLead(text: string): string {
  return /^\p{Lu}\p{Ll}*\p{Lu}/u.test(text) ? text : lowerFirst(text);
}

/** Résultat d'un service avant fusion */
export interface ServiceLine {
  service: TrackerId;
  text: string;
  tone: ToastLineTone;
}

/** Une ligne par résultat : les deux services au même résultat (texte et ton) partagent la ligne, logos côte à côte */
export function mergeServiceLines(lines: readonly ServiceLine[]): ToastLine[] {
  const merged: { services: TrackerId[]; text: string; tone: ToastLineTone }[] = [];
  for (const { service, text, tone } of lines) {
    const same = merged.find((line) => line.text === text && line.tone === tone);
    if (same) same.services.push(service);
    else merged.push({ services: [service], text, tone });
  }
  return merged.map(({ services, text, tone }) => ({ services, label: services.length > 1 ? t('toast.line.both') : TRACKER_LABELS[services[0] ?? 'anilist'], text, tone }));
}

/**
 * Ligne d'un service : le résultat seul, l'épisode est dans le titre ou le sous-titre. `saved` : note ou revisionnage,
 * écrit ou déjà en place (« enregistré »)
 */
function serviceLine({ service, outcome }: ServiceResult, saved?: string): ServiceLine {
  switch (outcome.status) {
    case 'updated':
      return { service, text: saved ?? t(outcome.completed ? 'toast.line.completed' : 'toast.line.saved'), tone: 'ok' };
    case 'up-to-date':
      return saved ? { service, text: saved, tone: 'ok' } : { service, text: t('toast.line.upToDate'), tone: 'neutral' };
    case 'skipped':
      return { service, text: lowerLead(outcome.reason), tone: 'warning' };
    case 'error': {
      // « MyAnimeList est injoignable… » sur la ligne de MyAnimeList : le nom du service n'est pas répété
      const label = `${TRACKER_LABELS[service]} `;
      return { service, text: lowerLead(outcome.message.startsWith(label) ? outcome.message.slice(label.length) : outcome.message), tone: 'error' };
    }
  }
}

type Synced = Extract<SyncOutcome, { status: 'synced' }>;

/** Bulle d'une synchro arrivée jusqu'aux services : titre = ce qui s'est passé, une ligne par résultat */
function syncedBubble(outcome: Synced, page: ToastEpisode | undefined): ToastContent {
  const { results, mediaTitle } = outcome;
  let progress = page?.episode ?? null;
  for (const { outcome: r } of results) if (r.status === 'updated' || r.status === 'up-to-date') progress = r.progress;
  const lines = mergeServiceLines(results.map((result) => serviceLine(result)));
  const errors = results.filter((r) => r.outcome.status === 'error');
  const skipped = results.filter((r) => r.outcome.status === 'skipped').length;
  const updated = results.find((r) => r.outcome.status === 'updated')?.outcome;
  // Pastille de Kai : celle du ton, sauf « rien de modifié » (coche lavande)
  const content: ToastContent = { tone: 'success', title: '', subtitle: episodeSubtitle(mediaTitle, progress), lines };
  if (errors.length > 0) {
    content.tone = 'error';
    // Deux services au plus : échec partiel = un seul service en échec
    content.title = errors.length === results.length ? t('feedback.error.title') : t('toast.title.failedOn', { service: TRACKER_LABELS[errors[0]?.service ?? 'anilist'] });
    // « . Nouvel essai automatique bientôt. » : la phrase seule, sous le sous-titre
    if (outcome.queued) content.message = t('feedback.queuedSuffix').replace(/^[.。]\s*/u, '');
  } else if (skipped > 0) {
    content.tone = 'warning';
    content.title = t(skipped === results.length ? 'toast.title.notSaved' : 'toast.title.partial');
  } else if (results.some((r) => r.outcome.status === 'updated' && r.outcome.completed)) {
    content.title = t('toast.title.completed');
  } else {
    // L'épisode passe dans le titre : la série seule en sous-titre
    content.subtitle = mediaTitle;
    if (updated?.status === 'updated') content.title = t('toast.title.saved', { episode: updated.progress });
    else Object.assign(content, { badge: 'same', title: t('toast.pill.upToDate', { episode: progress ?? '' }) });
  }
  return content;
}

/** Pastille compacte : "Ép. 2 enregistré · Tougen Anki" (premier service réellement mis à jour) */
export function pillForOutcome(outcome: SyncOutcome): ToastContent {
  if (outcome.status !== 'synced') return { ...describeOutcome(outcome) };
  const updated = outcome.results.find((r) => r.outcome.status === 'updated')?.outcome;
  if (updated?.status === 'updated') return { tone: 'success', title: t('toast.pill.saved', { episode: updated.progress }), message: outcome.mediaTitle };
  // Aucun service modifié (tout déjà à jour) : on le dit sans inventer d'écriture, coche lavande
  const upToDate = outcome.results.find((r) => r.outcome.status === 'up-to-date')?.outcome;
  const title = upToDate?.status === 'up-to-date' ? t('toast.pill.upToDate', { episode: upToDate.progress }) : t('toast.pill.alreadyUpToDate');
  return { tone: 'success', badge: 'same', title, message: outcome.mediaTitle };
}

/** Bulle complète ; `page` : épisode lu sur la page, sous-titre des résultats sans fiche */
export function bubbleForOutcome(outcome: SyncOutcome, page?: ToastEpisode): ToastContent {
  if (outcome.status === 'synced') return syncedBubble(outcome, page);
  if (outcome.status === 'excluded') return { tone: 'info', badge: 'off', title: t('toast.title.excluded'), subtitle: episodeSubtitle(outcome.mediaTitle, page?.episode ?? null) };
  const { tone, title, message } = describeOutcome(outcome);
  return { tone, title, ...(page ? { subtitle: episodeSubtitle(page.series, page.episode) } : {}), ...(message ? { message } : {}) };
}

/**
 * Traduit le résultat d'une synchronisation en toast selon le niveau de notification.
 * `null` : rien à afficher (succès en mode "alertes seulement", discret en plein écran, ou série ignorée).
 */
export function toastForOutcome(outcome: SyncOutcome, level: NotificationLevel, isFullscreen: boolean, page?: ToastEpisode): OutcomeToast | null {
  // Série hors périmètre (Netflix, pas un anime) : jamais signalée, quel que soit le niveau
  if (outcome.status === 'ignored') return null;
  const tone = describeOutcome(outcome).tone;
  const display = outcome.status === 'excluded' ? decideExcludedNotification(level) : decideNotification(level, tone, isFullscreen);
  switch (display) {
    case 'none':
      return null;
    case 'pill':
      return { content: pillForOutcome(outcome), variant: 'pill', autoHideMs: PILL_TOAST_MS };
    case 'bubble':
      return { content: bubbleForOutcome(outcome, page), variant: 'bubble', autoHideMs: isAlertTone(tone) ? ALERT_TOAST_MS : SUCCESS_TOAST_MS };
  }
}

// ─── Note de fin de série et revisionnage ───────────────────────────────────

/** Bulle de note : sans réponse au bout de 20 s, la note est reportée (carte « À noter ») */
export const RATING_PROMPT_MS = 20_000;
/** Bulle de revisionnage : sans réponse au bout de 15 s, rien n'est fait */
export const REWATCH_PROMPT_MS = 15_000;

export interface EngagementResultCopy {
  /** Pastille de succès : « Note 8,5/10 enregistrée » */
  success: string;
  /** Titre de la bulle d'échec : « Note non enregistrée » */
  failure: string;
  /** Titre quand un service a écrit et pas l'autre : « Note enregistrée en partie » */
  partial: string;
  /** Après le titre de la pastille */
  mediaTitle: string;
  /** Sous-titre des bulles : « Frieren · 8,5/10 » */
  subtitle: string;
  /** Pastille d'état du succès (étoile, revisionnage) */
  badge: ToastBadge;
}

/**
 * Résultat d'une note ou d'un revisionnage : pastille si tous les services ont réussi,
 * sinon bulle (détail par service) ; `ok` = rien à relancer.
 */
export function engagementResultToast(outcome: SyncOutcome, copy: EngagementResultCopy): OutcomeToast & { ok: boolean } {
  if (outcome.status === 'synced') {
    const written = outcome.results.filter((r) => r.outcome.status === 'updated' || r.outcome.status === 'up-to-date').length;
    if (written > 0 && written === outcome.results.length) {
      return { ok: true, content: { tone: 'success', badge: copy.badge, title: copy.success, message: copy.mediaTitle }, variant: 'pill', autoHideMs: PILL_TOAST_MS };
    }
    const failed = outcome.results.some((r) => r.outcome.status === 'error');
    const tone = written > 0 || !failed ? 'warning' : 'error';
    return {
      ok: !failed,
      content: { tone, title: written > 0 ? copy.partial : copy.failure, subtitle: copy.subtitle, lines: mergeServiceLines(outcome.results.map((result) => serviceLine(result, t('toast.line.saved')))) },
      variant: 'bubble',
      autoHideMs: failed ? RETRY_TOAST_MS : ALERT_TOAST_MS,
    };
  }
  const message = outcome.status === 'error' ? outcome.message : describeOutcome(outcome).message;
  return {
    ok: false,
    content: { tone: 'error', title: copy.failure, subtitle: copy.subtitle, ...(message ? { message } : {}) },
    variant: 'bubble',
    autoHideMs: RETRY_TOAST_MS,
  };
}
