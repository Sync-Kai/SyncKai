// Groupe « En sommeil » au bas de « Mes séries » (spec 2.5.0 §5.3) : en-tête repliable (Kai endormi, nom, pastille du
// nombre, « Rien vu depuis plus de 30 jours »), puis les séries (ligne de 80 px : jaquette, titre, « Ép. 7 / 23 · vu il y
// a 2 mois », Pause / Abandonner / Garder), « Tout mettre en pause » (2 séries ou plus) et le lien du seuil. Abandon et
// pause groupée confirmés en ligne (focus sur « Non », Échap annule, focus rendu au bouton qui l'a ouverte). Tous les
// textes arrivent traduits.
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { kai } from '../icons';
import { Button } from './button';
import { Cover } from './cover';
import { Icon, MountedNode } from './icon';
import { InlineConfirm, type InlineConfirmProps } from './inline-confirm';
import { SeriesStatusLine, SeriesTitle, type SeriesEntryLink } from './series-row';

/** Textes d'une confirmation (« Oui » / « Non » et leurs noms accessibles) */
export type DormantConfirmTexts = Pick<InlineConfirmProps, 'question' | 'detail' | 'yes' | 'no'>;

interface DormantAction {
  label: string;
  ariaLabel: string;
  onClick: () => void;
}

export interface DormantRowView {
  /** Clé de la série : data-dormant-row, data-focus des boutons (`dormant-pause-<clé>`, `dormant-drop-<clé>`, `dormant-keep-<clé>`) */
  rowKey: string;
  title: string;
  coverUrl: string | null;
  entry: SeriesEntryLink | null;
  progress: number;
  total: number | null;
  /** « 7 épisodes vus sur 23 » (barre de la jaquette) */
  progressLabel: string;
  /** « Ép. 7 / 23 · vu il y a 2 mois » */
  line: string;
  pause: DormantAction;
  /** `onClick` : après la confirmation */
  drop: DormantAction & { confirm: DormantConfirmTexts };
  keep: DormantAction;
  /** Écriture en cours sur cette série (ou sur tout le groupe) */
  busy: boolean;
}

export interface DormantGroupProps {
  title: string;
  /** « Rien vu depuis plus de 30 jours » */
  subtitle: string;
  count: number;
  open: boolean;
  onToggle: (open: boolean) => void;
  /** Nom accessible de la liste */
  listLabel: string;
  rows: readonly DormantRowView[];
  /** « Tout mettre en pause » (null sous 2 séries) ; `onClick` : après la confirmation */
  pauseAll: (DormantAction & { confirm: DormantConfirmTexts; busy: boolean }) | null;
  /** « Seuil : 30 jours » : ouvre le réglage */
  threshold: { label: string; onClick: () => void };
}

/** Confirmation ouverte : une série (sa clé) ou la pause groupée */
type Confirming = { kind: 'drop'; key: string } | { kind: 'all' } | null;

const ALL_FOCUS = 'dormant-pause-all';

function DormantRow({ row, separated, confirming, onConfirm, onYes, onCancel }: { row: DormantRowView; separated: boolean; confirming: boolean; onConfirm: () => void; onYes: () => void; onCancel: () => void }) {
  const cover = <Cover size="row" title={row.title} src={row.coverUrl} progress={{ value: row.progress, total: row.total, label: row.progressLabel }} />;
  return (
    // Marges verticales de 6 px (8 px sur une ligne ordinaire) : titre, ligne 2 et boutons de 28 px tiennent dans les 80 px
    <li class="relative flex h-series-row items-center gap-3 py-1.5 pr-2 pl-3" data-dormant-row={row.rowKey}>
      {separated && <span class="absolute inset-x-2.5 top-0 h-px bg-line" aria-hidden="true" />}
      {row.entry ? (
        <a class="flex shrink-0 rounded-cover transition hover:brightness-110" href={row.entry.href} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
          {cover}
        </a>
      ) : (
        cover
      )}
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <SeriesTitle title={row.title} entry={row.entry} focusKey={`title-${row.rowKey}`} />
        <SeriesStatusLine status={{ tone: 'muted', text: row.line }} />
        {confirming ? (
          <InlineConfirm {...row.drop.confirm} focusKey={row.rowKey} onYes={onYes} onNo={onCancel} />
        ) : (
          // Boutons de 28 px sur une ligne, sans rognage (anneau de focus visible)
          <div class="flex h-7 min-w-0 items-center gap-1.5" data-dormant-actions="">
            <Button size="sm" busy={row.busy} ariaLabel={row.pause.ariaLabel} focusKey={`dormant-pause-${row.rowKey}`} onClick={row.pause.onClick}>
              {row.pause.label}
            </Button>
            <Button size="sm" disabled={row.busy} ariaLabel={row.drop.ariaLabel} focusKey={`dormant-drop-${row.rowKey}`} onClick={onConfirm}>
              {row.drop.label}
            </Button>
            <Button size="sm" variant="text" disabled={row.busy} ariaLabel={row.keep.ariaLabel} focusKey={`dormant-keep-${row.rowKey}`} onClick={row.keep.onClick}>
              {row.keep.label}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

export function DormantGroup(props: DormantGroupProps) {
  const bodyId = useId();
  const root = useRef<HTMLElement>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  /** Bouton à refocaliser après une confirmation annulée ou confirmée */
  const restore = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (confirming !== null || restore.current === null) return;
    root.current?.querySelector<HTMLElement>(`[data-focus="${restore.current}"]`)?.focus({ preventScroll: true });
    restore.current = null;
  }, [confirming]);
  const cancel = (focus: string): void => {
    restore.current = focus;
    setConfirming(null);
  };
  // « Oui » : focus sur un bouton qui reste focalisable pendant l'envoi (« Pause » de la ligne, « Tout mettre en pause »)
  const confirmed = (run: () => void, focus: string): void => {
    restore.current = focus;
    setConfirming(null);
    run();
  };
  const { pauseAll } = props;
  return (
    // Ligne sortie du groupe (mise en pause, abandonnée, gardée) avec le focus : il passe à l'en-tête du groupe
    <section ref={root} class="flex flex-col gap-2" aria-labelledby={`${bodyId}-title`} data-dormant-group="" data-focus-fallback="dormant-toggle">
      <button
        type="button"
        class="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-card border border-line bg-surface px-3 py-2 text-left transition-colors hover:bg-raised/50"
        aria-expanded={props.open ? 'true' : 'false'}
        aria-controls={bodyId}
        data-focus="dormant-toggle"
        onClick={() => props.onToggle(!props.open)}
      >
        <MountedNode build={() => kai('size-7 shrink-0', { size: 'small', expression: 'sleep', tile: true })} inputs={[]} />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="flex min-w-0 items-center gap-1.5">
            <span class="truncate text-body font-extrabold text-ink" id={`${bodyId}-title`}>
              {props.title}
            </span>
            <span class="shrink-0 rounded-pill bg-raised px-1.5 text-section font-bold tracking-normal text-ink tabular-nums" data-dormant-count="">
              {props.count}
            </span>
          </span>
          <span class="truncate text-secondary text-muted" title={props.subtitle}>
            {props.subtitle}
          </span>
        </span>
        <span class={`flex shrink-0 text-muted transition-transform duration-(--motion-enter) motion-reduce:transition-none ${props.open ? 'rotate-180' : ''}`}>
          <Icon name="chevronDown" class="size-4" strokeWidth="2.4" />
        </span>
      </button>
      <div id={bodyId} class="flex flex-col gap-2" hidden={!props.open} data-dormant-body="">
        <ul class="m-0 list-none rounded-card border border-line bg-surface p-0" aria-label={props.listLabel}>
          {props.rows.map((row, index) => (
            <DormantRow
              key={row.rowKey}
              row={row}
              separated={index > 0}
              confirming={confirming?.kind === 'drop' && confirming.key === row.rowKey}
              onConfirm={() => setConfirming({ kind: 'drop', key: row.rowKey })}
              onYes={() => confirmed(row.drop.onClick, `dormant-pause-${row.rowKey}`)}
              onCancel={() => cancel(`dormant-drop-${row.rowKey}`)}
            />
          ))}
        </ul>
        {pauseAll && confirming?.kind === 'all' ? (
          <InlineConfirm {...pauseAll.confirm} focusKey={ALL_FOCUS} onYes={() => confirmed(pauseAll.onClick, ALL_FOCUS)} onNo={() => cancel(ALL_FOCUS)} />
        ) : (
          <div class="mx-1 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <Button size="sm" variant="text" focusKey="dormant-threshold" onClick={props.threshold.onClick}>
              {props.threshold.label}
            </Button>
            {pauseAll && (
              <Button size="sm" busy={pauseAll.busy} ariaLabel={pauseAll.ariaLabel} focusKey={ALL_FOCUS} class="tabular-nums" onClick={() => setConfirming({ kind: 'all' })}>
                {pauseAll.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
