// Résumés d'une ligne affichés sous chaque catégorie de l'accueil des Réglages (maquettes Main, ReglagesEtats).
// Fonctions pures (langue active de l'i18n) : testées en fr, en et de.
import { getLocale, t, tp, type Locale } from '../../i18n';
import { endonym } from '../../i18n/language-list';
import { isOptionalPlatform, STREAMING_PLATFORMS, type StreamingPlatform } from '../../platforms/registry';
import { effectivePlayer, type LanguageSetting, type SyncSettings } from '../../shared/settings';
import { TRACKER_IDS, type TrackerId } from '../../shared/tracker.types';
import type { AccountState } from '../state';

/** État d'un compte réduit à ce que résume l'accueil */
export type AccountLink = 'loading' | 'connected' | 'expired' | 'disconnected';

export interface SettingsSummary {
  text: string;
  /** Point devant le texte : ok (compte connecté), danger (session expirée, texte rouge aussi), muted (aucun compte, lecture) */
  tone: 'ok' | 'muted' | 'danger';
}

const PLAYER_NAMES: Record<StreamingPlatform, string> = { crunchyroll: 'Crunchyroll', adn: 'ADN', netflix: 'Netflix', disney: 'Disney+', prime: 'Prime Video' };
/** Libellé court des services (« AniList ✓ · MAL ✓ ») */
const SHORT_LABELS: Record<TrackerId, string> = { anilist: 'AniList', mal: 'MAL' };

const ACCOUNT_LINK_KEYS = {
  connected: 'settings.summary.connected',
  expired: 'settings.summary.expired',
  disconnected: 'settings.summary.notConnected',
} as const;

/**
 * Carte Comptes de l'accueil : « AniList et MyAnimeList connectés », « AniList connecté · MAL : session expirée » (rouge),
 * « AniList connecté · MAL non connecté », « Aucun compte connecté »
 */
export function accountsSummary(links: Readonly<Record<TrackerId, AccountLink>>): SettingsSummary {
  if (TRACKER_IDS.some((id) => links[id] === 'loading')) return { text: t('settings.summary.loading'), tone: 'muted' };
  if (TRACKER_IDS.every((id) => links[id] === 'connected')) return { text: t('settings.summary.bothConnected'), tone: 'ok' };
  if (TRACKER_IDS.every((id) => links[id] === 'disconnected')) return { text: t('settings.summary.noAccount'), tone: 'muted' };
  const text = TRACKER_IDS.map((id) => {
    const link = links[id];
    return link === 'loading' ? '' : t(ACCOUNT_LINK_KEYS[link], { service: SHORT_LABELS[id] });
  }).join(' · ');
  return { text, tone: TRACKER_IDS.some((id) => links[id] === 'expired') ? 'danger' : 'ok' };
}

/** « Auto · au générique », « Auto · à 85 % », « En pause » */
export function syncSummary(settings: Pick<SyncSettings, 'autoSync' | 'completionTrigger' | 'completionPercentage'>): string {
  if (!settings.autoSync) return t('settings.summary.paused');
  const trigger =
    settings.completionTrigger === 'credits' ? t('settings.summary.credits') : t('settings.summary.percentage', { percent: t('settings.percent', { value: settings.completionPercentage }) });
  return `${t('settings.summary.auto')} · ${trigger}`;
}

/**
 * « 4 sur 5 actives · lecteur Crunchyroll » : plateformes suivies (incluses toujours, optionnelles avec leur accès) et
 * lecteur préféré effectif (Netflix / Prime Video seulement avec l'accès) ; accès pas encore lus : « Chargement… »
 */
export function platformsSummary(settings: Pick<SyncSettings, 'preferredPlayer'>, granted: readonly StreamingPlatform[] | undefined): string {
  if (granted === undefined) return t('settings.summary.loading');
  const active = STREAMING_PLATFORMS.filter((platform) => !isOptionalPlatform(platform) || granted.includes(platform)).length;
  const player = t('settings.summary.player', { player: PLAYER_NAMES[effectivePlayer(settings.preferredPlayer, granted)] });
  return `${tp('settings.summary.platforms', active, { total: STREAMING_PLATFORMS.length })} · ${player}`;
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

/** « Automatique (Français) » ou le nom de la langue choisie, chacune dans sa propre langue (comme le sélecteur) */
export function languageSummary(setting: LanguageSetting, active: Locale): string {
  return setting === 'auto' ? t('settings.summary.languageAuto', { language: endonym(active) }) : endonym(setting);
}

/** "Alt+Shift+K" → "Alt+Maj+K" (nom de la touche Maj dans la langue active) */
export function formatShortcut(shortcut: string): string {
  return shortcut.replace(/Shift/g, t('settings.shortcut.shiftKey'));
}

/**
 * Caractère imprimé sur les touches chiffres en AZERTY (sans Maj), identique en France et en Belgique ; 6 et 8
 * diffèrent entre les deux (« - » / « § », « _ » / « ! ») : pas d'indication.
 */
const AZERTY_DIGIT_CHARS: Readonly<Record<string, string>> = { '1': '&', '2': 'é', '3': '"', '4': "'", '5': '(', '7': 'è', '9': 'ç', '0': 'à' };

/**
 * Français uniquement : « touche & » pour un raccourci qui se termine par un chiffre (Alt+Shift+1 se tape Alt+Maj+&
 * en AZERTY, même touche physique). null : autre langue, autre touche.
 */
export function azertyKeyHint(shortcut: string): string | null {
  if (getLocale() !== 'fr') return null;
  const key = shortcut.split('+').pop() ?? '';
  const char = AZERTY_DIGIT_CHARS[key];
  return char === undefined ? null : t('settings.shortcut.azertyKey', { char });
}

/** « Version 2.4.0 · aucune erreur », « Version 2.4.0 · 2 erreurs » ; journal illisible ou en lecture : la version seule */
export function helpSummary(version: string, errors: number | null): string {
  const versionText = t('settings.summary.version', { version });
  if (errors === null) return versionText;
  return `${versionText} · ${errors > 0 ? tp('settings.summary.errors', errors) : t('settings.summary.noErrors')}`;
}

/** État d'un compte (popup / panneau) → état résumé sur l'accueil */
export function accountLink(state: AccountState<unknown>): AccountLink {
  if (state.status === 'loading') return 'loading';
  if (state.status === 'logged-in') return 'connected';
  return state.expired ? 'expired' : 'disconnected';
}
