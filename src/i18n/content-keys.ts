import type { Locale, MessageKey } from './core';

/**
 * Clés traduites utilisées par les scripts de contenu (Crunchyroll, ADN, Netflix), triées : seules embarquées dans
 * leurs bundles (PERF-01). Tenue à jour par content.test.ts, qui relève les clés citées dans le code atteignable
 * depuis les scripts de contenu.
 */
export const CONTENT_KEYS = [
  'common.close',
  'common.excludedTitle',
  'common.retry',
  'common.serviceMessage',
  'common.syncing',
  'content.episodeShort',
  'content.shortcut.alreadySynced',
  'content.shortcut.noPlayback.message',
  'content.shortcut.noPlayback.title',
  'content.shortcut.paused.message',
  'content.shortcut.paused.title',
  'content.unidentified.message',
  'content.unidentified.title',
  'content.unreachable.full',
  'content.unreachable.message',
  'content.unreachable.title',
  'content.updated.message',
  'content.updated.title',
  'feedback.completedTitle',
  'feedback.error.queued',
  'feedback.error.title',
  'feedback.excluded',
  'feedback.ignored.message',
  'feedback.ignored.title',
  'feedback.notConnected.message',
  'feedback.notConnected.title',
  'feedback.queuedSuffix',
  'feedback.review.message',
  'feedback.review.title',
  'feedback.service.completed',
  'feedback.service.error',
  'feedback.service.upToDate',
  'feedback.service.updated',
  'popup.syncDisabledDetail',
  'prompt.rating.failed',
  'prompt.rating.later',
  'prompt.rating.question',
  'prompt.rating.saved',
  'prompt.rating.saving',
  'prompt.rating.title',
  'prompt.rewatch.failed',
  'prompt.rewatch.no',
  'prompt.rewatch.saved',
  'prompt.rewatch.saving',
  'prompt.rewatch.title',
  'prompt.rewatch.yes',
  'rating.groupLabel',
  'rating.rateAria',
  'toast.line.saved',
  'toast.pill.alreadyUpToDate',
  'toast.pill.saved',
  'toast.pill.upToDate',
] as const satisfies readonly MessageKey[];

export type ContentKey = (typeof CONTENT_KEYS)[number];

/** Sous-ensemble des catalogues embarqué par les scripts de contenu */
export type ContentCatalogs = Readonly<Record<Locale, Readonly<Record<ContentKey, string>>>>;
