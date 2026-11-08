// Groupe « En sommeil » de « Mes séries » (ui/components/dormant-group.tsx) : textes traduits et actions du contrôleur
// (popup/controllers/dormant.ts) ; rien quand aucune série n'est en sommeil.
import { formatList, t, tp } from '../../i18n';
import type { EntryLinkContext } from '../../shared/entry-link';
import { lastActivity } from '../../shared/dormant';
import { TRACKER_LABELS } from '../../shared/tracker.types';
import { entryKey } from '../../shared/watching';
import type { WatchingEntry } from '../../shared/watching.types';
import { formatInactivity } from '../../ui/dormant-view';
import type { ReadonlyStore } from '../../ui/state';
import { DormantGroup, type DormantRowView } from '../../ui/components/dormant-group';
import { useStore } from '../../ui/preact/hooks';
import type { DormantState } from '../controllers/dormant';
import { entrySite } from './entry-site';

/** Groupe et actions fournis par l'hôte (popup.ts) */
export interface DormantHost {
  state: ReadonlyStore<DormantState>;
  /** Préférences du popup : groupe déplié */
  prefs: ReadonlyStore<{ dormantOpen: boolean }>;
  onToggle: (open: boolean) => void;
  onPause: (entry: WatchingEntry) => void;
  /** Abandon confirmé */
  onDrop: (entry: WatchingEntry) => void;
  onKeep: (entry: WatchingEntry) => void;
  /** « Tout mettre en pause » confirmé */
  onPauseAll: () => void;
  /** « Seuil : 30 jours » : Réglages › Affichage, au réglage */
  onOpenThreshold: () => void;
}

const confirmTexts = (action: string) => ({
  yes: { label: t('watching.confirm.yes'), ariaLabel: t('watching.confirm.yesAria', { action }), tone: 'ok' as const },
  no: { label: t('watching.confirm.no'), ariaLabel: t('watching.confirm.noAria', { action }) },
});

function rowView(entry: WatchingEntry, host: DormantHost, state: DormantState, links: EntryLinkContext, now: number): DormantRowView {
  const { title, progress, totalEpisodes: total } = entry;
  const site = entrySite(entry, links);
  const at = lastActivity(entry) ?? now;
  const progressText = total !== null ? t('watching.heroProgress', { progress, total }) : t('watching.heroProgressNoTotal', { progress });
  const drop = t('watching.status.DROPPED');
  return {
    rowKey: entryKey(entry),
    title,
    coverUrl: entry.coverUrl,
    entry: { href: site.url, label: t('entry.openAria', { title, service: TRACKER_LABELS[site.service] }) },
    progress,
    total,
    progressLabel: total !== null ? tp('watching.seenOf', progress, { total }) : tp('watching.seen', progress),
    line: `${progressText} · ${t('watching.dormant.seen', { ago: formatInactivity(at, now) })}`,
    pause: { label: t('watching.dormant.pause'), ariaLabel: t('watching.dormant.pauseAria', { title }), onClick: () => host.onPause(entry) },
    drop: {
      label: t('watching.dormant.drop'),
      ariaLabel: t('watching.dormant.dropAria', { title }),
      onClick: () => host.onDrop(entry),
      confirm: { question: t('watching.confirm.DROPPED'), ...confirmTexts(drop), yes: { ...confirmTexts(drop).yes, tone: 'danger' } },
    },
    keep: { label: t('watching.dormant.keep'), ariaLabel: t('watching.dormant.keepAria', { title }), onClick: () => host.onKeep(entry) },
    busy: state.bulk || state.busy.has(entryKey(entry)),
  };
}

export function DormantSection({ host, state, links, now }: { host: DormantHost; state: DormantState; links: EntryLinkContext; now: number }) {
  const { dormantOpen } = useStore(host.prefs);
  const { entries, thresholdDays } = state;
  if (entries.length === 0 || thresholdDays === null) return null;
  const pauseAll = t('watching.dormant.pauseAll');
  return (
    <DormantGroup
      title={t('settings.dormant.label')}
      subtitle={t('watching.dormant.subtitle', { days: thresholdDays })}
      count={entries.length}
      open={dormantOpen}
      onToggle={host.onToggle}
      listLabel={t('settings.dormant.label')}
      rows={entries.map((entry) => rowView(entry, host, state, links, now))}
      pauseAll={
        entries.length >= 2
          ? {
              label: pauseAll,
              ariaLabel: pauseAll,
              onClick: host.onPauseAll,
              busy: state.bulk,
              confirm: {
                question: tp('watching.dormant.pauseAllConfirm', entries.length),
                detail: t('watching.dormant.pauseAllDetail', { services: formatList(links.connected.map((service) => TRACKER_LABELS[service])) }),
                ...confirmTexts(pauseAll),
              },
            }
          : null
      }
      threshold={{ label: t('watching.dormant.threshold', { days: thresholdDays }), onClick: host.onOpenThreshold }}
    />
  );
}
