// Carte « Tu regardes » (maquettes PanelLecture, PanelLectureEtats) : épisode de la page de lecture, puis la lecture en
// direct reçue par le port (components/live-progress.ts) : barre (lavande) et repère du point de synchro (beurre),
// position « 14:40 / 23:40 » et légende « Générique à 21:32 », puis la ligne d'état (compte à rebours en texte simple,
// sinon icône + état, ligne secondaire : raison, erreur, point attendu en pause). Seule cette carte est redessinée à
// chaque tick. Changements d'état annoncés aux lecteurs d'écran, jamais le compte à rebours.
import { useId } from 'preact/hooks';
import { t } from '../../i18n';
import { Icon } from '../../ui/components/icon';
import { useStore } from '../../ui/preact/hooks';
import type { ReadonlyStore } from '../../ui/state';
import { formatClock, liveBlock, type LiveDisplay, type LiveSnapshot, type LiveTone } from '../live-view';

export interface LiveCardProps {
  /** « Épisode 7 / 28 » (null : épisode inconnu) */
  episode: string | null;
  /** Réglage « Afficher la progression en direct » */
  enabled: boolean;
  live: ReadonlyStore<LiveSnapshot>;
}

const TONE_TEXT: Readonly<Record<LiveTone, string>> = {
  info: 'text-lavender',
  success: 'text-mint',
  muted: 'text-ink',
  warning: 'text-butter',
  error: 'text-danger',
};

const TONE_ICON: Readonly<Record<LiveTone, string>> = {
  info: 'text-lavender',
  success: 'text-mint',
  muted: 'text-muted',
  warning: 'text-butter',
  error: 'text-danger',
};

const SECTION_TITLE = 'text-section text-muted uppercase';

function LiveBar({ bar, clock }: { bar: NonNullable<LiveDisplay['bar']>; clock: string }) {
  return (
    <>
      <div
        class="relative h-1.5 rounded-pill bg-raised"
        role="progressbar"
        aria-label={t('panel.live.playback')}
        aria-valuemin={0}
        aria-valuemax={bar.valueMax}
        aria-valuenow={bar.valueNow}
        aria-valuetext={bar.valueText}
      >
        <div class="absolute inset-y-0 left-0 rounded-pill bg-lavender transition-[width] duration-1000 ease-linear motion-reduce:transition-none" style={{ width: `${bar.percent}%` }} />
        {bar.pointPercent !== null && (
          <span class="absolute -top-0.75 h-3 w-0.5 -translate-x-1/2 rounded-pill bg-butter" style={{ left: `${bar.pointPercent}%` }} title={bar.legend ?? undefined} aria-hidden="true" data-live-marker="" />
        )}
      </div>
      <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-secondary text-muted tabular-nums">
        <span>{clock}</span>
        {bar.legend !== null && (
          <span class="flex min-w-0 items-center gap-1.5" data-live-legend="">
            <span class="h-2.5 w-0.5 shrink-0 rounded-pill bg-butter" aria-hidden="true" />
            <span class="min-w-0">{bar.legend}</span>
          </span>
        )}
      </div>
    </>
  );
}

function LiveStatus({ display }: { display: LiveDisplay }) {
  if (display.text === '') return null;
  if (display.icon === null) return <p class="m-0 text-secondary text-muted" data-live-status="">{display.text}</p>;
  return (
    <div class="flex min-w-0 items-start gap-2" data-live-status={display.tone}>
      <span class={`flex shrink-0 pt-0.5 ${TONE_ICON[display.tone]} ${display.icon === 'sync' ? 'motion-safe:animate-spin' : ''}`}>
        <Icon name={display.icon} class="size-3.5" strokeWidth="2.4" />
      </span>
      <div class="flex min-w-0 flex-col">
        <span class={`text-secondary font-extrabold ${TONE_TEXT[display.tone]}`}>{display.text}</span>
        {display.detail !== null && <span class={`text-secondary break-words ${display.tone === 'error' ? 'text-danger' : 'text-muted'}`}>{display.detail}</span>}
      </div>
    </div>
  );
}

export function LiveCard({ episode, enabled, live }: LiveCardProps) {
  const id = useId();
  const snapshot = useStore(live);
  const block = enabled ? liveBlock(snapshot) : { kind: 'none' as const };
  const tick = snapshot.tick;
  return (
    <section class="flex flex-col gap-2 rounded-card border border-line bg-surface p-3" aria-labelledby={id} data-live-card="">
      <div class="flex min-w-0 items-baseline justify-between gap-2">
        <h3 class={`m-0 ${SECTION_TITLE}`} id={id}>
          {t('panel.nowPlaying.watching')}
        </h3>
        {episode !== null && <span class="min-w-0 text-body font-extrabold tabular-nums">{episode}</span>}
      </div>
      {block.kind === 'live' && (
        <>
          {block.display.bar && tick && <LiveBar bar={block.display.bar} clock={`${formatClock(tick.t ?? 0)} / ${formatClock(tick.duration ?? 0)}`} />}
          <LiveStatus display={block.display} />
        </>
      )}
      {block.kind === 'unreachable' && (
        <p class="m-0 flex items-center gap-2 text-secondary font-extrabold text-butter">
          <Icon name="retry" class="size-3.5" strokeWidth="2.4" />
          {t('panel.live.unreachable')}
        </p>
      )}
      {/* Région annoncée : changements d'état uniquement (pause, synchro, erreur), jamais le compte à rebours */}
      <span class="sr-only" aria-live="polite" aria-atomic="true">
        {block.kind === 'live' ? (block.display.announce ?? '') : ''}
      </span>
    </section>
  );
}
