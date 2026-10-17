// Pages Preact des Réglages qui dépendent des réglages stockés : squelette pendant la lecture, alerte si illisibles
// (équivalent de settingsPlaceholder, rows.ts, pour les pages vanilla).
import { t } from '../../i18n';
import { Alert } from '../components/alert';

export function SettingsPlaceholder({ error }: { error: boolean }) {
  if (error) return <Alert message={t('settings.loadError')} />;
  return <div class="h-40 rounded-card border border-line bg-surface motion-safe:animate-pulse" aria-busy="true" aria-label={t('settings.loading')} data-settings-skeleton="" />;
}
