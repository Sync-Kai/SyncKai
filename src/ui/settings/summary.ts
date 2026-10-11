// Résumés d'une ligne affichés sous chaque catégorie de l'accueil des Réglages.
// Fonctions pures (langue active de l'i18n) : testées en fr, en et de.
import { t, tp, type Locale } from '../../i18n';
import type { StreamingPlatform } from '../../shared/episode.types';
import { effectivePlayer, type LanguageSetting, type SyncSettings } from '../../shared/settings';
import { TRACKER_IDS, type TrackerId } from '../../shared/tracker.types';
import type { AccountState } from '../../popup/state';

/** État d'un compte réduit à ce que résume l'accueil */
export type AccountLink = 'loading' | 'connected' | 'expired' | 'disconnected';

export interface SettingsSummary {
  text: string;
  /** danger : action attendue (session expirée) */
  tone: 'muted' | 'danger';
}

const PLAYER_NAMES: Record<StreamingPlatform, string> = { crunchyroll: 'Crunchyroll', adn: 'ADN', netflix: 'Netflix' };
/** Langues affichées dans leur propre langue (comme le sélecteur) */
const LANGUAGE_NAMES: Record<Locale, string> = { fr: 'Français', en: 'English', de: 'Deutsch' };
/** Libellé court des services (« AniList ✓ · MAL ✓ ») */
const SHORT_LABELS: Record<TrackerId, string> = { anilist: 'AniList', mal: 'MAL' };

/** « AniList ✓ · MAL ✓ », « MAL : session expirée », « Aucun compte connecté » */
export function accountsSummary(links: Readonly<Record<TrackerId, AccountLink>>): SettingsSummary {
  if (TRACKER_IDS.some((id) => links[id] === 'loading')) return { text: t('settings.summary.loading'), tone: 'muted' };
  const parts = TRACKER_IDS.flatMap((id): string[] => {
    if (links[id] === 'connected') return [t('settings.summary.connected', { service: SHORT_LABELS[id] })];
    if (links[id] === 'expired') return [t('settings.summary.expired', { service: SHORT_LABELS[id] })];
    return [];
  });
  if (parts.length === 0) return { text: t('settings.summary.noAccount'), tone: 'muted' };
  const expired = TRACKER_IDS.some((id) => links[id] === 'expired');
  return { text: parts.join(' · '), tone: expired ? 'danger' : 'muted' };
}

/** « Crunchyroll · au générique », « ADN · à 85 % », « Crunchyroll · en pause » */
export function syncSummary(
  settings: Pick<SyncSettings, 'autoSync' | 'completionTrigger' | 'completionPercentage' | 'preferredPlayer'>,
  netflixAccess?: boolean,
): string {
  const trigger = !settings.autoSync
    ? t('settings.summary.paused')
    : settings.completionTrigger === 'credits'
      ? t('settings.summary.credits')
      : t('settings.summary.percentage', { percent: t('settings.percent', { value: settings.completionPercentage }) });
  return `${PLAYER_NAMES[effectivePlayer(settings.preferredPlayer, netflixAccess)]} · ${trigger}`;
}

const LEVEL_TITLES = {
  discreet: 'settings.notif.discreet.title',
  detailed: 'settings.notif.detailed.title',
  'alerts-only': 'settings.notif.alertsOnly.title',
} as const;

/** « Discrètes · alertes à l'heure », « Détaillées · alertes +3 h », « Discrètes · alertes désactivées » */
export function notificationsSummary(settings: Pick<SyncSettings, 'notificationLevel' | 'airingAlerts' | 'airingDelayHours'>): string {
  const airing = !settings.airingAlerts
    ? t('settings.summary.airingOff')
    : settings.airingDelayHours === 0
      ? t('settings.summary.airingOnTime')
      : t('settings.summary.airingDelay', { hours: settings.airingDelayHours });
  return `${t(LEVEL_TITLES[settings.notificationLevel])} · ${airing}`;
}

/** « 12 correspondances · 2 exclues » ; null = pas encore lu (ou illisible) */
export function dataSummary(mappings: number | null, excluded: number | null): string {
  const parts = [mappings !== null && tp('settings.summary.mappings', mappings), excluded !== null && tp('settings.summary.excluded', excluded)].filter(
    (part): part is string => typeof part === 'string',
  );
  return parts.length > 0 ? parts.join(' · ') : t('settings.summary.loading');
}

/** « Automatique (Français) » ou le nom de la langue choisie */
export function languageSummary(setting: LanguageSetting, active: Locale): string {
  return setting === 'auto' ? t('settings.summary.languageAuto', { language: LANGUAGE_NAMES[active] }) : LANGUAGE_NAMES[setting];
}

/** « v2.0.0 », précédé du nombre d'erreurs enregistrées s'il y en a */
export function helpSummary(version: string, errors: number | null): string {
  const versionText = t('settings.summary.version', { version });
  return errors !== null && errors > 0 ? `${tp('settings.summary.errors', errors)} · ${versionText}` : versionText;
}

/** État d'un compte (popup / panneau) → état résumé sur l'accueil */
export function accountLink(state: AccountState<unknown>): AccountLink {
  if (state.status === 'loading') return 'loading';
  if (state.status === 'logged-in') return 'connected';
  return state.expired ? 'expired' : 'disconnected';
}
