import { LANGUAGE_SETTINGS, type LanguageSetting } from '../i18n/locale-codes';
import { isRecord } from './guards';

// Réglages lus par les scripts de contenu (session de lecture, historique Crunchyroll) et le moteur i18n : sous-ensemble
// de `SyncSettings` normalisé seul, sans les délais de l'Agenda ni le reste de settings.ts (taille des scripts de contenu).
// normalizeSettings (settings.ts) reprend ce normaliseur pour ces champs : les deux lectures ne peuvent pas diverger.

export type CompletionTrigger = 'credits' | 'percentage';

/**
 * Notifications affichées sur la page de lecture :
 * - discreet    : petite pastille de succès 3 s (rien en plein écran), aucun toast de progression
 * - detailed    : bulle complète avec le résultat par service
 * - alerts-only : uniquement quand il faut agir (à vérifier, erreur, reconnexion)
 * Les alertes s'affichent dans tous les cas.
 */
export type NotificationLevel = 'discreet' | 'detailed' | 'alerts-only';

export interface ContentSettings {
  /** Synchronisation automatique active (false = pause) */
  autoSync: boolean;
  /** "credits" : début du générique de fin si connu, sinon pourcentage */
  completionTrigger: CompletionTrigger;
  /** Pourcentage de la vidéo (repli, ou déclencheur unique en mode "percentage") */
  completionPercentage: number;
  notificationLevel: NotificationLevel;
  language: LanguageSetting;
}

export const DEFAULT_CONTENT_SETTINGS: ContentSettings = {
  autoSync: true,
  completionTrigger: 'credits',
  completionPercentage: 85,
  notificationLevel: 'discreet',
  language: 'auto',
};

export const PERCENTAGE_RANGE = { min: 70, max: 98 } as const;

export const SETTINGS_STORAGE_KEY = 'settings';

const NOTIFICATION_LEVELS: readonly NotificationLevel[] = ['discreet', 'detailed', 'alerts-only'];

/**
 * Champs des scripts de contenu, complétés et bornés : les valeurs absentes ou invalides (ancienne version, stockage
 * corrompu) retombent sur les valeurs par défaut.
 */
export function normalizeContentSettings(raw: unknown): ContentSettings {
  const value = isRecord(raw) ? raw : {};
  const percentage =
    typeof value.completionPercentage === 'number' && Number.isFinite(value.completionPercentage)
      ? Math.min(PERCENTAGE_RANGE.max, Math.max(PERCENTAGE_RANGE.min, Math.round(value.completionPercentage)))
      : DEFAULT_CONTENT_SETTINGS.completionPercentage;

  // Migration ≤ 1.3 : "showToast: false" correspondait à n'afficher que les alertes
  const legacyLevel: NotificationLevel | null = value.showToast === false ? 'alerts-only' : null;
  const notificationLevel = NOTIFICATION_LEVELS.find((level) => level === value.notificationLevel) ?? legacyLevel ?? DEFAULT_CONTENT_SETTINGS.notificationLevel;

  return {
    autoSync: typeof value.autoSync === 'boolean' ? value.autoSync : DEFAULT_CONTENT_SETTINGS.autoSync,
    completionTrigger:
      value.completionTrigger === 'credits' || value.completionTrigger === 'percentage'
        ? value.completionTrigger
        : DEFAULT_CONTENT_SETTINGS.completionTrigger,
    completionPercentage: percentage,
    notificationLevel,
    language: LANGUAGE_SETTINGS.find((l) => l === value.language) ?? DEFAULT_CONTENT_SETTINGS.language,
  };
}
