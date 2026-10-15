import type { MessageKey } from './core';

/**
 * Clés traduites utilisées par les scripts de contenu (Crunchyroll, ADN, Netflix, Disney+), triées : seules embarquées
 * dans leurs bundles, en anglais, et seules demandées au service worker pour une autre langue (PERF-01). Tenue à jour
 * par content.test.ts, qui relève les clés citées dans le code atteignable depuis les scripts de contenu.
 */
export const CONTENT_KEYS = [
  'common.close',
  'common.excludedTitle',
  'common.retry',
  'common.serviceMessage',
  'common.syncing',
  'content.episodeShort',
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

/** Textes des clés de contenu dans une langue (réponse de GET_CONTENT_CATALOG) */
export type ContentCatalog = Readonly<Record<ContentKey, string>>;

/**
 * Sous-ensemble embarqué par les scripts de contenu (`__SYNCKAI_CONTENT_CATALOGS__`) : l'anglais seul ; une autre langue
 * est demandée au service worker (GET_CONTENT_CATALOG, voir content.ts)
 */
export type ContentCatalogs = Readonly<{ en: ContentCatalog }>;
