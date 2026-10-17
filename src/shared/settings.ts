import { LANGUAGE_SETTINGS, type LanguageSetting } from '../i18n/locale-codes';
import { DEFAULT_CONTENT_SETTINGS, normalizeContentSettings, type ContentSettings } from './content-settings';
import { AIRING_DELAYS, type AiringDelayHours } from './engagement.types';
import { isRecord } from './guards';
import { platformRecord, STREAMING_PLATFORMS, type StreamingPlatform } from '../platforms/ids';
import { TRACKER_IDS, type TrackerId } from './tracker.types';

// Champs lus par les scripts de contenu (déclenchement, notifications, langue) : définis et normalisés dans
// content-settings.ts, que ces scripts lisent seul (jamais getSettings / normalizeSettings)
export { PERCENTAGE_RANGE, SETTINGS_STORAGE_KEY, type CompletionTrigger, type ContentSettings, type NotificationLevel } from './content-settings';

// Langue de l'interface : 'auto' ou une langue proposée (liste dans i18n/locale-codes.ts, module feuille : le moteur
// i18n importe ces réglages, un import du moteur ici ferait un cycle)
export { LANGUAGE_SETTINGS, type LanguageSetting };

/** Onglet affiché à l'ouverture du panneau latéral : 'last' = dernier onglet consulté */
export type PanelDefaultTab = 'last' | 'nowPlaying' | 'agenda';
export const PANEL_DEFAULT_TABS: readonly PanelDefaultTab[] = ['last', 'nowPlaying', 'agenda'];

export interface SyncSettings extends ContentSettings {
  /** Plateforme ouverte par « Ouvrir » quand l'anime est disponible sur plusieurs plateformes */
  preferredPlayer: StreamingPlatform;
  /** Fiche ouverte au clic sur un titre ou une jaquette quand les deux comptes sont connectés */
  entryService: TrackerId;
  /** Proposer une note quand une série passe en Terminé */
  ratingPrompt: boolean;
  /** Notifications Chrome à la sortie d'un nouvel épisode d'une série en cours */
  airingAlerts: boolean;
  /** Délai des alertes de sortie, ajouté à l'heure de sortie estimée de l'agenda (décision 17, airing-policy.ts › alertAt) */
  airingDelayHours: AiringDelayHours;
  /** Agenda et alertes de sortie : délai estimé (minutes) entre la diffusion japonaise et la sortie sur chaque plateforme */
  platformOffsets: PlatformOffsets;
  /** Agenda et alertes de sortie : délai propre à une série (clé = mediaId AniList), prioritaire sur `platformOffsets` */
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
  autoSync: DEFAULT_CONTENT_SETTINGS.autoSync,
  completionTrigger: DEFAULT_CONTENT_SETTINGS.completionTrigger,
  completionPercentage: DEFAULT_CONTENT_SETTINGS.completionPercentage,
  notificationLevel: DEFAULT_CONTENT_SETTINGS.notificationLevel,
  preferredPlayer: 'crunchyroll',
  entryService: 'anilist',
  ratingPrompt: true,
  airingAlerts: true,
  airingDelayHours: 0,
  language: DEFAULT_CONTENT_SETTINGS.language,
  platformOffsets: platformRecord(() => 60),
  seriesOffsets: {},
  panelDefaultTab: 'last',
  panelLiveProgress: true,
};

/**
 * Lecteurs préférés à accès optionnel (permission d'hôte) : écrits ici plutôt que lus dans le registre (platforms/registry.ts,
 * absent des scripts de contenu qui lisent les réglages) ; égalité vérifiée par settings.test.ts
 */
export const ACCESS_PLAYERS: readonly StreamingPlatform[] = ['netflix', 'prime'];

/**
 * Lecteur préféré effectif : une plateforme à accès optionnel (Netflix, Prime Video) seulement avec son accès accordé
 * (`granted` : plateformes optionnelles accordées). Sans accès, ou état encore inconnu (`undefined`), repli sur le
 * lecteur par défaut. Seule lecture autorisée de `preferredPlayer` pour choisir un lien (popup, panneau, agenda,
 * notifications) ou l'afficher (Réglages).
 */
export function effectivePlayer(preferred: StreamingPlatform, granted: readonly StreamingPlatform[] | undefined): StreamingPlatform {
  if (!isPreferredPlayerOption(preferred)) return DEFAULT_SETTINGS.preferredPlayer;
  if (ACCESS_PLAYERS.includes(preferred)) return granted?.includes(preferred) === true ? preferred : DEFAULT_SETTINGS.preferredPlayer;
  return preferred;
}

/**
 * Plateforme proposable comme lecteur préféré. Disney+ ne l'est pas : ses liens AniList (anciennes pages /series/…,
 * pages /browse/entity-…) ne sont pas fiables pour « Ouvrir » en priorité ; il reste ouvert en repli (seul lien connu).
 * Prime Video l'est, comme Netflix (décision du 2026-10-14) : liens AniList primevideo.com et amazon.<tld>.
 */
export function isPreferredPlayerOption(platform: StreamingPlatform): boolean {
  return platform !== 'disney';
}

/**
 * Valeur d'un champ de délai (`<input type="number">`) : vide, ou saisie non numérique que le navigateur rend
 * vide, donne NaN (jamais 0 comme `Number('')`) ; la validation reste à l'appelant.
 */
export function parseOffsetInput(raw: string): number {
  return raw.trim() === '' ? Number.NaN : Number(raw);
}

/** Pas des boutons − / + du délai d'une plateforme (Réglages › Plateformes) */
export const OFFSET_STEP = 15;

/**
 * Délai après un clic sur − (-1) ou + (1) : premier multiple de OFFSET_STEP dans le sens du clic (une valeur saisie
 * hors du pas, 65, se recale sur 60 ou 75), borné à OFFSET_RANGE
 */
export function stepOffset(value: number, direction: 1 | -1): number {
  const next = direction > 0 ? (Math.floor(value / OFFSET_STEP) + 1) * OFFSET_STEP : (Math.ceil(value / OFFSET_STEP) - 1) * OFFSET_STEP;
  // -0 (Math.ceil(-7 / 15) = -0) rendu en 0
  return Math.min(OFFSET_RANGE.max, Math.max(OFFSET_RANGE.min, next)) || 0;
}

/**
 * Saisie du champ de délai d'une plateforme : entier signé (« +75 », « -30 », « −30 » avec le moins typographique
 * affiché par le champ) dans OFFSET_RANGE ; sinon null (champ signalé invalide, rien n'est enregistré)
 */
export function parseOffsetDraft(raw: string): number | null {
  const match = /^([+\-−]?)(\d{1,5})$/.exec(raw.trim());
  if (!match) return null;
  const value = (match[1] === '' || match[1] === '+' ? 1 : -1) * Number(match[2]);
  return value >= OFFSET_RANGE.min && value <= OFFSET_RANGE.max ? value || 0 : null;
}

/** Valeur affichée dans le champ : signe toujours écrit (« +60 », « 0 », « −30 »), relue telle quelle par parseOffsetDraft */
export function formatOffsetDraft(value: number): string {
  if (value > 0) return `+${value}`;
  return value < 0 ? `−${-value}` : '0';
}

/** Délai en minutes (entier borné) ou null si invalide */
export function normalizeOffset(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(OFFSET_RANGE.max, Math.max(OFFSET_RANGE.min, Math.round(value)));
}

function normalizePlatformOffsets(raw: unknown): PlatformOffsets {
  const value = isRecord(raw) ? raw : {};
  return platformRecord((platform) => normalizeOffset(value[platform]) ?? DEFAULT_SETTINGS.platformOffsets[platform]);
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
  // Champs des scripts de contenu : mêmes règles que leur lecteur (content-settings.ts), migration ≤ 1.3 comprise
  const content = normalizeContentSettings(value);

  return {
    autoSync: content.autoSync,
    completionTrigger: content.completionTrigger,
    completionPercentage: content.completionPercentage,
    notificationLevel: content.notificationLevel,
    preferredPlayer: STREAMING_PLATFORMS.find((p) => p === value.preferredPlayer) ?? DEFAULT_SETTINGS.preferredPlayer,
    // Réglage récent : absent des réglages plus anciens → AniList
    entryService: TRACKER_IDS.find((service) => service === value.entryService) ?? DEFAULT_SETTINGS.entryService,
    ratingPrompt: typeof value.ratingPrompt === 'boolean' ? value.ratingPrompt : DEFAULT_SETTINGS.ratingPrompt,
    airingAlerts: typeof value.airingAlerts === 'boolean' ? value.airingAlerts : DEFAULT_SETTINGS.airingAlerts,
    airingDelayHours: AIRING_DELAYS.find((d) => d === value.airingDelayHours) ?? DEFAULT_SETTINGS.airingDelayHours,
    language: content.language,
    platformOffsets: normalizePlatformOffsets(value.platformOffsets),
    seriesOffsets: normalizeSeriesOffsets(value.seriesOffsets),
    // Réglages du panneau (1.10) : absents des réglages plus anciens → valeurs par défaut
    panelDefaultTab: PANEL_DEFAULT_TABS.find((tab) => tab === value.panelDefaultTab) ?? DEFAULT_SETTINGS.panelDefaultTab,
    panelLiveProgress: typeof value.panelLiveProgress === 'boolean' ? value.panelLiveProgress : DEFAULT_SETTINGS.panelLiveProgress,
  };
}
