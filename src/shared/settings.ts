import type { StreamingPlatform } from './episode.types';
import { AIRING_DELAYS, type AiringDelayHours } from './engagement.types';
import { isRecord } from './guards';

export type CompletionTrigger = 'credits' | 'percentage';

/**
 * Notifications affichées sur la page de lecture :
 * - discreet    : petite pastille de succès 3 s (rien en plein écran), aucun toast de progression
 * - detailed    : bulle complète avec le résultat par service
 * - alerts-only : uniquement quand il faut agir (à vérifier, erreur, reconnexion)
 * Les alertes s'affichent dans tous les cas.
 */
export type NotificationLevel = 'discreet' | 'detailed' | 'alerts-only';

/** Langue de l'interface : 'auto' suit la langue du navigateur (fr, de, en ; anglais sinon) */
export type LanguageSetting = 'auto' | 'fr' | 'en' | 'de';
export const LANGUAGE_SETTINGS: readonly LanguageSetting[] = ['auto', 'fr', 'en', 'de'];

/** Onglet affiché à l'ouverture du panneau latéral : 'last' = dernier onglet consulté */
export type PanelDefaultTab = 'last' | 'nowPlaying' | 'agenda';
export const PANEL_DEFAULT_TABS: readonly PanelDefaultTab[] = ['last', 'nowPlaying', 'agenda'];

export interface SyncSettings {
  /** Synchronisation automatique active (false = pause) */
  autoSync: boolean;
  /** "credits" : début du générique de fin si connu, sinon pourcentage */
  completionTrigger: CompletionTrigger;
  /** Pourcentage de la vidéo (repli, ou déclencheur unique en mode "percentage") */
  completionPercentage: number;
  notificationLevel: NotificationLevel;
  /** Plateforme ouverte par « Ouvrir » quand l'anime est disponible sur plusieurs plateformes */
  preferredPlayer: StreamingPlatform;
  /** Proposer une note quand une série passe en Terminé */
  ratingPrompt: boolean;
  /** Notifications Chrome à la sortie d'un nouvel épisode d'une série en cours */
  airingAlerts: boolean;
  /** Délai après la diffusion japonaise avant de notifier */
  airingDelayHours: AiringDelayHours;
  language: LanguageSetting;
  /** Agenda : délai estimé (minutes) entre la diffusion japonaise et la sortie sur chaque plateforme */
  platformOffsets: PlatformOffsets;
  /** Agenda : délai propre à une série (clé = mediaId AniList), prioritaire sur `platformOffsets` */
  seriesOffsets: Readonly<Record<string, SeriesOffset>>;
  /** Panneau latéral : onglet ouvert par défaut */
  panelDefaultTab: PanelDefaultTab;
  /** Panneau latéral : position de lecture et compte à rebours en direct (port ouvert vers l'onglet) */
  panelLiveProgress: boolean;
}

export type PlatformOffsets = Readonly<Record<StreamingPlatform, number>>;

/** Délai propre à une série : minutes, et date du réglage (ms) pour ne garder que les plus récents (DATA-03) */
export interface SeriesOffset {
  minutes: number;
  at: number;
}

/** Bornes d'un délai de sortie (minutes) : jusqu'à 1 jour d'avance, 1 semaine de retard */
export const OFFSET_RANGE = { min: -1440, max: 10080 } as const;
/** Nombre maximal de délais par série conservés */
export const MAX_SERIES_OFFSETS = 200;

export const DEFAULT_SETTINGS: SyncSettings = {
  autoSync: true,
  completionTrigger: 'credits',
  completionPercentage: 85,
  notificationLevel: 'discreet',
  preferredPlayer: 'crunchyroll',
  ratingPrompt: true,
  airingAlerts: true,
  airingDelayHours: 0,
  language: 'auto',
  platformOffsets: { crunchyroll: 60, adn: 60, netflix: 60 },
  seriesOffsets: {},
  panelDefaultTab: 'last',
  panelLiveProgress: true,
};

export const PERCENTAGE_RANGE = { min: 70, max: 98 } as const;

/**
 * Lecteur préféré effectif : Netflix seulement avec l'accès accordé (permission optionnelle). Sans accès, ou état
 * encore inconnu (`undefined`), repli sur le lecteur par défaut. Seule lecture autorisée de `preferredPlayer`
 * pour choisir un lien (popup, panneau, agenda, notifications) ou l'afficher (Réglages).
 */
export function effectivePlayer(preferred: StreamingPlatform, netflixGranted: boolean | undefined): StreamingPlatform {
  return preferred === 'netflix' && netflixGranted !== true ? DEFAULT_SETTINGS.preferredPlayer : preferred;
}

const SETTINGS_KEY = 'settings';
const NOTIFICATION_LEVELS: readonly NotificationLevel[] = ['discreet', 'detailed', 'alerts-only'];
const PLAYERS: readonly StreamingPlatform[] = ['crunchyroll', 'adn', 'netflix'];

/**
 * Valeur d'un champ de délai (`<input type="number">`) : vide, ou saisie non numérique que le navigateur rend
 * vide, donne NaN (jamais 0 comme `Number('')`) ; la validation reste à l'appelant.
 */
export function parseOffsetInput(raw: string): number {
  return raw.trim() === '' ? Number.NaN : Number(raw);
}

/** Délai en minutes (entier borné) ou null si invalide */
export function normalizeOffset(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(OFFSET_RANGE.max, Math.max(OFFSET_RANGE.min, Math.round(value)));
}

function normalizePlatformOffsets(raw: unknown): PlatformOffsets {
  const value = isRecord(raw) ? raw : {};
  return {
    crunchyroll: normalizeOffset(value.crunchyroll) ?? DEFAULT_SETTINGS.platformOffsets.crunchyroll,
    adn: normalizeOffset(value.adn) ?? DEFAULT_SETTINGS.platformOffsets.adn,
    netflix: normalizeOffset(value.netflix) ?? DEFAULT_SETTINGS.platformOffsets.netflix,
  };
}

/**
 * Délai d'une série, null si invalide. Format ≤ 2.1 (nombre de minutes seul) : daté de `legacyAt` (0 par défaut : le
 * plus ancien ; la migration de la 2.2.0 le date de la mise à jour, voir agenda-store.ts).
 */
function normalizeSeriesOffset(value: unknown, legacyAt: number): SeriesOffset | null {
  if (typeof value === 'number') {
    const minutes = normalizeOffset(value);
    return minutes === null ? null : { minutes, at: legacyAt };
  }
  if (!isRecord(value)) return null;
  const minutes = normalizeOffset(value.minutes);
  if (minutes === null) return null;
  return { minutes, at: typeof value.at === 'number' && Number.isFinite(value.at) && value.at >= 0 ? value.at : legacyAt };
}

/**
 * Garde les entrées `mediaId (entier > 0) → délai` valides, dans la limite de MAX_SERIES_OFFSETS : les plus récemment
 * réglées (date `at`). Jamais l'ordre des clés : JavaScript énumère les clés entières par ordre numérique croissant,
 * quel que soit l'ordre d'insertion (DATA-03, BAK-04).
 */
export function normalizeSeriesOffsets(raw: unknown, legacyAt = 0): Record<string, SeriesOffset> {
  if (!isRecord(raw) || Array.isArray(raw)) return {};
  const valid: [string, SeriesOffset][] = [];
  for (const [key, value] of Object.entries(raw)) {
    const offset = /^[1-9]\d{0,9}$/.test(key) ? normalizeSeriesOffset(value, legacyAt) : null;
    if (offset) valid.push([key, offset]);
  }
  // Tri stable : à date égale, l'ordre de lecture départage
  const kept = valid.sort((a, b) => b[1].at - a[1].at).slice(0, MAX_SERIES_OFFSETS);
  return Object.fromEntries(kept);
}

/**
 * Complète et borne des réglages lus du stockage : les valeurs absentes ou invalides
 * (ancienne version, stockage corrompu) retombent sur les valeurs par défaut.
 */
export function normalizeSettings(raw: unknown): SyncSettings {
  const value = isRecord(raw) ? raw : {};
  const percentage =
    typeof value.completionPercentage === 'number' && Number.isFinite(value.completionPercentage)
      ? Math.min(PERCENTAGE_RANGE.max, Math.max(PERCENTAGE_RANGE.min, Math.round(value.completionPercentage)))
      : DEFAULT_SETTINGS.completionPercentage;

  // Migration ≤ 1.3 : "showToast: false" correspondait à n'afficher que les alertes
  const legacyLevel: NotificationLevel | null = value.showToast === false ? 'alerts-only' : null;
  const notificationLevel = NOTIFICATION_LEVELS.find((level) => level === value.notificationLevel) ?? legacyLevel ?? DEFAULT_SETTINGS.notificationLevel;

  return {
    autoSync: typeof value.autoSync === 'boolean' ? value.autoSync : DEFAULT_SETTINGS.autoSync,
    completionTrigger:
      value.completionTrigger === 'credits' || value.completionTrigger === 'percentage'
        ? value.completionTrigger
        : DEFAULT_SETTINGS.completionTrigger,
    completionPercentage: percentage,
    notificationLevel,
    preferredPlayer: PLAYERS.find((p) => p === value.preferredPlayer) ?? DEFAULT_SETTINGS.preferredPlayer,
    ratingPrompt: typeof value.ratingPrompt === 'boolean' ? value.ratingPrompt : DEFAULT_SETTINGS.ratingPrompt,
    airingAlerts: typeof value.airingAlerts === 'boolean' ? value.airingAlerts : DEFAULT_SETTINGS.airingAlerts,
    airingDelayHours: AIRING_DELAYS.find((d) => d === value.airingDelayHours) ?? DEFAULT_SETTINGS.airingDelayHours,
    language: LANGUAGE_SETTINGS.find((l) => l === value.language) ?? DEFAULT_SETTINGS.language,
    platformOffsets: normalizePlatformOffsets(value.platformOffsets),
    seriesOffsets: normalizeSeriesOffsets(value.seriesOffsets),
    // Réglages du panneau (1.10) : absents des réglages plus anciens → valeurs par défaut
    panelDefaultTab: PANEL_DEFAULT_TABS.find((tab) => tab === value.panelDefaultTab) ?? DEFAULT_SETTINGS.panelDefaultTab,
    panelLiveProgress: typeof value.panelLiveProgress === 'boolean' ? value.panelLiveProgress : DEFAULT_SETTINGS.panelLiveProgress,
  };
}

// Module volontairement séparé de storage.ts : il est aussi chargé par le content script

export async function getSettings(): Promise<SyncSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(settings: SyncSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
}

export const SETTINGS_STORAGE_KEY = SETTINGS_KEY;
