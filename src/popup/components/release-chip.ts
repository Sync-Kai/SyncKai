// Pastille de statut de sortie d'une série (spec 2.5.0 §5.5) partagée par les lignes de « Mes séries » et d'« En sommeil » :
// icône et ton selon le statut (décision du 2026-11-09 : mint, gris, butter, danger ; jamais sakura), texte `page.airing.*` déjà traduit en 21 langues.
import { t } from '../../i18n';
import { releaseChip, type ReleaseChip } from '../../shared/watching';
import type { WatchingEntry } from '../../shared/watching.types';
import type { SeriesChip } from '../../ui/components/series-row';

const CHIPS: Record<ReleaseChip, Pick<SeriesChip, 'tone' | 'icon'>> = {
  RELEASING: { tone: 'ok', icon: 'play' },
  NOT_YET_RELEASED: { tone: 'muted', icon: 'calendar' },
  HIATUS: { tone: 'warn', icon: 'pause' },
  CANCELLED: { tone: 'error', icon: 'ban' },
};

/** Pastille de la série, null sans statut notable (terminée, statut inconnu) */
export function releaseChipView(entry: WatchingEntry): SeriesChip | null {
  const status = releaseChip(entry);
  if (status === null) return null;
  const text = t(`page.airing.${status}`);
  return { ...CHIPS[status], text, title: text };
}
