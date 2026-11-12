// Section « Ordre de visionnage » de la carte de détails (remplace « Suites et histoires liées »). Replié : « N / M vus », barre
// d'une cellule par entrée principale, « Ensuite : … ». Déplié : frise (<ol>) dans l'ordre de sortie, une ligne par entrée
// (nœud = forme + icône, jamais la couleur seule), « Ici » sur la page affichée, « Regarder », badge « Annoncée » et « + À regarder »
// des suites (magasin des suites annoncées). Données : graphe et états de liste du contrôleur (now-playing-controller.ts).
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { getLocale, t, tp } from '../../i18n';
import { PLATFORMS } from '../../platforms/registry';
import { entryLink, type EntryLinkContext } from '../../shared/entry-link';
import type { StreamingPlatform } from '../../shared/episode.types';
import { franchiseProgress, mergeStates, releaseOrder, shortTitle, type FranchiseGraph, type FranchiseNode, type ListState } from '../../shared/franchise';
import { formatSequelDate } from '../../shared/sequel-date';
import type { SyncOutcome } from '../../shared/sync.types';
import { TRACKER_LABELS } from '../../shared/tracker.types';
import { choosePlatformLink } from '../../shared/watching';
import { useMediaQuery } from '../../ui/preact/hooks';
import { Alert } from '../../ui/components/alert';
import { Button } from '../../ui/components/button';
import { Collapsible } from '../../ui/components/collapsible';
import { Icon } from '../../ui/components/icon';
import { Segmented } from '../../ui/components/segmented';
import { ServiceLogo } from '../../ui/components/service-logo';
import type { IconName } from '../../ui/icons';
import { noMalEntry } from '../../shared/sequels';
import { addToPlanning, sequelAddResult, sequelEndedKey, updateSequels } from '../../ui/sequel-actions';
import type { OrderState } from './now-playing-controller';
import { newTabLabel } from './now-playing-hero';

export interface WatchOrderProps {
  order: OrderState;
  /** Entrée de la page affichée (le départ du graphe n'est pas forcément elle) */
  currentId: number;
  /** Comptes connectés et fiche préférée : liens des entrées (`preferred` = réglage « Fiche ouverte par défaut ») */
  links: EntryLinkContext;
  /** Lecteur préféré : plateforme de « Regarder » */
  preferred: StreamingPlatform;
  /** Suites sans liste (magasin des suites annoncées) : « + À regarder » seulement pour elles */
  unlistedSequels: ReadonlySet<number>;
  open: boolean;
  onToggle: (open: boolean) => void;
  onRetry: () => void;
}

type Mode = 'main' | 'all';
type Cell = 'watched' | 'inProgress' | 'none' | 'announced';
type States = ReadonlyMap<number, ListState | 'notOnMal'>;

/** Choix « Série principale / Tout » gardé pour la durée de vie de la page du panneau (la carte est recréée à chaque fiche) */
let lastMode: Mode = 'main';

/** Lignes montrées avant « Afficher N de plus » (3 sous 340 px de large) */
const FIRST_ROWS = 5;
const NARROW_ROWS = 3;
const NARROW_QUERY = '(max-width: 339px)';
/** Entrées vues d'affilée à partir desquelles elles se regroupent en une ligne */
const MIN_RUN = 3;

const inFranchise = (graph: FranchiseGraph, id: number): boolean => graph.main.includes(id) || graph.extras.some((e) => e.id === id);
const kindOf = (states: States, node: FranchiseNode): NonNullable<ListState>['kind'] | null => {
  const state = states.get(node.id);
  return state && state !== 'notOnMal' ? state.kind : null;
};

function stateText(state: ListState | 'notOnMal'): string | null {
  if (state === 'notOnMal') return t('panel.order.state.notOnMal');
  if (state === null) return null;
  if (state.kind === 'inProgress') return t('panel.order.state.inProgress', { progress: state.progress ?? '…' });
  return t(`panel.order.state.${state.kind}`);
}

/** Période de sortie de l'étiquette : saison et année, sinon l'année, sinon rien */
function when(node: FranchiseNode): string | null {
  if (node.season !== null && node.seasonYear !== null) return t(`panel.nowPlaying.season.${node.season}`, { year: node.seasonYear });
  return node.year === null ? null : String(node.year);
}

/** Nœud de la frise : la forme porte l'état (plein + coche = vu, demi-rempli = en cours, creux, pointillé = annoncé, carré = abandonné) */
function TimelineNode({ kind, main, announced }: { kind: NonNullable<ListState>['kind'] | null; main: boolean; announced: boolean }) {
  const size = main ? 'size-4' : 'size-2.5';
  const base = `flex shrink-0 items-center justify-center border-2 ${size}`;
  if (kind === 'watched') {
    return (
      <span class={`${base} rounded-pill border-mint bg-mint text-on-fill`} data-order-node="watched">
        {main && <Icon name="check" class="size-2.5" strokeWidth="3.4" />}
      </span>
    );
  }
  if (kind === 'inProgress') return <span class={`${base} rounded-pill border-lavender`} style={{ background: 'linear-gradient(90deg, var(--color-lavender) 50%, transparent 50%)' }} data-order-node="inProgress" />;
  const ICONS: Partial<Record<NonNullable<ListState>['kind'], IconName>> = { planned: 'clock', paused: 'pause', dropped: 'close' };
  const icon = kind === null ? undefined : ICONS[kind];
  if (kind === 'dropped') {
    return (
      <span class={`${base} rounded-control border-muted text-muted`} data-order-node="dropped">
        {main && icon && <Icon name={icon} class="size-2" strokeWidth="3.4" />}
      </span>
    );
  }
  return (
    <span class={`${base} rounded-pill ${announced ? 'border-dashed border-field' : 'border-field'} text-muted`} data-order-node={kind ?? (announced ? 'announced' : 'none')}>
      {main && icon && <Icon name={icon} class="size-2" strokeWidth="3.4" />}
    </span>
  );
}

/** Date de l'entrée à la précision connue (même libellé que les alertes de suite) */
const nodeDate = (node: FranchiseNode): string =>
  formatSequelDate({ status: node.status === 'RELEASING' ? 'RELEASING' : 'NOT_YET_RELEASED', year: node.year, month: node.month, day: node.day, season: node.season, seasonYear: node.seasonYear }, getLocale());

/**
 * Suite annoncée (ou déjà en diffusion) de la chaîne principale : badge, « + À regarder » et leur retour. `unlisted` : suite du
 * magasin des suites annoncées (dans aucune liste des comptes connectés), seule source de l'état de liste.
 */
function SequelActions({ node, links, unlisted }: { node: FranchiseNode; links: EntryLinkContext; unlisted: boolean }) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  const airing = node.status === 'RELEASING';
  const badged = !airing || unlisted;
  const result = outcome ? sequelAddResult(outcome, t('error.unexpectedAdd')) : null;
  const ended = result?.kind === 'ended';
  // MyAnimeList seul et entrée sans idMal : « + À regarder » échouerait toujours
  const unaddable = noMalEntry(links.connected, node.idMal);
  const add = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    const done = await addToPlanning({ mediaId: node.id, malId: node.idMal });
    // Un service a écrit (ou déjà dans une liste) : l'alerte de cette suite n'a plus d'objet, elle passe dans les séries de la liste ; échec : le passage quotidien nettoiera
    if (sequelAddResult(done, '').kind === 'ended') await updateSequels([node.id], 'listed');
    setOutcome(done);
    setBusy(false);
  };
  return (
    <>
      {badged && (
        <span class="flex min-w-0 items-center gap-1.5 text-secondary text-muted" data-relation-badge="">
          <span class="size-1.5 shrink-0 rounded-pill bg-lavender" aria-hidden="true" />
          <span class="line-clamp-2 break-words">{airing ? t('sequel.airing') : `${t('sequel.announced')} · ${nodeDate(node)}`}</span>
        </span>
      )}
      {ended && <span class="text-secondary font-bold text-lavender">{t(sequelEndedKey(result))}</span>}
      {!ended && unaddable && <span class="text-secondary font-bold text-lavender">{t('sequel.notOnMal')}</span>}
      {result?.kind === 'failed' && <span class="line-clamp-2 text-secondary font-bold text-danger" title={result.message}>{result.message}</span>}
      {unlisted && !ended && !unaddable && (
        <Button size="sm" class="self-start" busy={busy} ariaLabel={t('sequel.addLabel', { title: node.title })} focusKey={`relation-add-${node.id}`} onClick={() => void add()}>
          {result?.kind === 'failed' ? t('common.retry') : t('sequel.add')}
        </Button>
      )}
    </>
  );
}

interface RowContext {
  rootTitle: string;
  mainIds: ReadonlySet<number>;
  states: States;
  other: ReadonlyMap<number, { service: 'anilist' | 'mal'; state: ListState }>;
  props: WatchOrderProps;
}

function Row({ node, ctx }: { node: FranchiseNode; ctx: RowContext }) {
  const { props, states } = ctx;
  const main = ctx.mainIds.has(node.id);
  const current = node.id === props.currentId;
  const state = states.get(node.id);
  const counterpart = ctx.other.get(node.id);
  const tooltip = counterpart ? t('panel.order.otherService', { service: TRACKER_LABELS[counterpart.service], state: stateText(counterpart.state) ?? '—' }) : undefined;
  // Service choisi sans état pour l'entrée : celui de l'autre service, affiché en texte discret (ORD-07)
  const text = (state === undefined ? null : stateText(state)) ?? tooltip ?? null;
  const label = [node.format, when(node)].filter(Boolean).join(' · ');
  const watch = choosePlatformLink(node, props.preferred);
  // Fiche AniList toujours connue : repli sur sa page si MyAnimeList est préférée sans équivalent
  const site = entryLink({ mediaId: node.id, malId: node.idMal }, props.links) ?? { service: 'anilist' as const, url: node.siteUrl };
  const title = shortTitle(ctx.rootTitle, node.title);
  const sequel = main && (node.status === 'NOT_YET_RELEASED' || node.status === 'RELEASING');
  return (
    <li class={`group flex min-w-0 gap-2.5 rounded-panel px-2 pt-2 ${current ? 'bg-raised' : ''}`} data-order-row={node.id} aria-current={current ? 'true' : undefined}>
      <span class="flex w-4 shrink-0 flex-col items-center gap-1 pt-0.5" aria-hidden="true">
        <TimelineNode kind={state === undefined ? null : kindOf(states, node)} main={main} announced={node.status === 'NOT_YET_RELEASED'} />
        <span class="w-px flex-1 bg-line group-last:hidden" />
      </span>
      <div class="flex min-w-0 flex-1 flex-col gap-1 pb-2">
        <div class="flex min-w-0 items-center gap-2">
          <span class={`min-w-0 truncate text-overline uppercase ${main ? 'text-lavender' : 'text-muted'}`}>{label}</span>
          {current && <span class="shrink-0 rounded-pill bg-lavender/15 px-1.5 text-overline font-bold text-lavender uppercase">{t('panel.order.here')}</span>}
        </div>
        <div class="flex min-w-0 items-start gap-2">
          <a
            class="group/link min-w-0 flex-1 rounded-control text-ink no-underline"
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={newTabLabel(t('entry.openAria', { title: node.title, service: TRACKER_LABELS[site.service] }))}
            data-focus={`order-entry-${node.id}`}
          >
            <span class="line-clamp-2 text-secondary font-extrabold break-words underline-offset-2 group-hover/link:underline" title={node.title} data-order-title="">
              {title}
            </span>
          </a>
        </div>
        {text !== null && (
          <span class={`text-secondary text-muted${kindOf(states, node) === 'watched' && !tooltip ? ' sr-only' : ''}`} title={tooltip} data-order-state="">
            {text}
          </span>
        )}
        {sequel && <SequelActions node={node} links={props.links} unlisted={props.unlistedSequels.has(node.id)} />}
      </div>
      {/* « Regarder » centré verticalement sur toute la ligne (surtitre, titre et état), pas sur le titre seul */}
      {watch && (
        <Button
          size="sm"
          class="mb-2 shrink-0 self-center"
          href={watch.url}
          target="_blank"
          title={t('panel.nowPlaying.watchOn', { platform: PLATFORMS[watch.platform].label })}
          ariaLabel={t('panel.nowPlaying.watchAria', { title: node.title, platform: PLATFORMS[watch.platform].label })}
          focusKey={`order-watch-${node.id}`}
        >
          <ServiceLogo id={watch.platform} size="sm" />
          {t('panel.nowPlaying.watch')}
        </Button>
      )}
    </li>
  );
}

type Unit = { kind: 'row'; node: FranchiseNode } | { kind: 'run'; nodes: FranchiseNode[] };

/** Lignes et séries vues regroupées (3 entrées vues d'affilée ou plus ; la page affichée n'est jamais regroupée) */
function toUnits(list: readonly FranchiseNode[], states: States, currentId: number): Unit[] {
  const units: Unit[] = [];
  let run: FranchiseNode[] = [];
  const flush = (): void => {
    if (run.length >= MIN_RUN) units.push({ kind: 'run', nodes: run });
    else units.push(...run.map((node): Unit => ({ kind: 'row', node })));
    run = [];
  };
  for (const node of list) {
    if (kindOf(states, node) === 'watched' && node.id !== currentId) run.push(node);
    else {
      flush();
      units.push({ kind: 'row', node });
    }
  }
  flush();
  return units;
}

function Timeline({ graph, ctx, list, mode, onMode }: { graph: FranchiseGraph; ctx: RowContext; list: readonly FranchiseNode[]; mode: Mode; onMode: (mode: Mode) => void }) {
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const firstRows = useMediaQuery(NARROW_QUERY) ? NARROW_ROWS : FIRST_ROWS;
  const units = toUnits(list, ctx.states, ctx.props.currentId);
  const holdsCurrent = (unit: Unit): boolean => (unit.kind === 'row' ? unit.node.id === ctx.props.currentId : false);
  // La page affichée reste visible même au-delà des premières lignes
  const limit = showAll ? units.length : Math.max(firstRows, units.findIndex(holdsCurrent) + 1);
  const shown = units.slice(0, limit);
  const hidden = units.slice(limit).reduce((sum, unit) => sum + (unit.kind === 'row' ? 1 : unit.nodes.length), 0);
  return (
    <div class="flex flex-col gap-2">
      <Segmented
        options={[
          { value: 'main', label: t('panel.order.main') },
          { value: 'all', label: t('panel.order.all') },
        ]}
        value={mode}
        onChange={onMode}
        label={t('panel.order.title')}
        fill
        focusKey="order-mode"
      />
      <ol class="m-0 flex list-none flex-col p-0">
        {shown.map((unit) => {
          if (unit.kind === 'row') return <Row key={unit.node.id} node={unit.node} ctx={ctx} />;
          const first = unit.nodes[0]?.id ?? 0;
          if (expanded.has(first)) return unit.nodes.map((node) => <Row key={node.id} node={node} ctx={ctx} />);
          return (
            <li key={`run-${first}`} class="group flex min-w-0 gap-2.5 px-2 pt-2">
              <span class="flex w-4 shrink-0 flex-col items-center gap-1 pt-0.5" aria-hidden="true">
                <TimelineNode kind="watched" main announced={false} />
                <span class="w-px flex-1 bg-line group-last:hidden" />
              </span>
              <button
                type="button"
                class="mb-2 min-h-6 min-w-0 cursor-pointer self-start border-0 bg-transparent p-0 text-left text-secondary font-extrabold text-muted underline-offset-2 hover:text-ink hover:underline"
                aria-expanded="false"
                data-order-run=""
                data-focus={`order-run-${first}`}
                onClick={() => setExpanded(new Set([...expanded, first]))}
              >
                {tp('panel.order.watchedRun', unit.nodes.length, { count: unit.nodes.length })}
              </button>
            </li>
          );
        })}
      </ol>
      {hidden > 0 && (
        <button
          type="button"
          class="cursor-pointer self-start border-0 bg-transparent p-0 text-secondary font-extrabold text-sakura underline underline-offset-2"
          data-order-more=""
          data-focus="order-more"
          onClick={() => setShowAll(true)}
        >
          {tp('panel.order.more', hidden, { count: hidden })}
        </button>
      )}
      {graph.capped && (
        <p class="m-0 text-secondary text-muted" role="note">
          {t('panel.order.tooLong', { count: graph.main.length })}
        </p>
      )}
      <p class="m-0 text-secondary text-muted">{t('panel.order.releaseNote')}</p>
    </div>
  );
}

/** Aperçu de l'en-tête replié : compte, barre (une cellule par entrée principale), « Ensuite » ; rien sans compte connecté */
function Summary({ main, states }: { main: readonly FranchiseNode[]; states: States }) {
  if (states.size === 0) return null;
  const progress = franchiseProgress(main, states);
  const counted = main.filter((node) => states.get(node.id) !== 'notOnMal' && node.status !== 'CANCELLED');
  const cells = counted.map((node): { id: number; cell: Cell } => {
    if (node.status === 'NOT_YET_RELEASED') return { id: node.id, cell: 'announced' };
    const kind = kindOf(states, node);
    return { id: node.id, cell: kind === 'watched' || kind === 'inProgress' ? kind : 'none' };
  });
  const CELL: Record<Cell, string> = { watched: 'bg-mint', inProgress: 'bg-line', none: 'bg-line', announced: 'border border-dashed border-field' };
  return (
    <>
      {progress.total > 0 && <span class="text-secondary font-semibold text-muted tabular-nums">{tp('panel.order.watched', progress.watched, { count: progress.watched, total: progress.total })}</span>}
      <span class="flex h-1.5 w-full gap-0.5" aria-hidden="true">
        {cells.map(({ id, cell }) => (
          <span
            key={id}
            class={`h-full min-w-0 flex-1 rounded-pill ${CELL[cell]}`}
            style={cell === 'inProgress' ? { background: 'linear-gradient(90deg, var(--color-lavender) 50%, var(--color-line) 50%)' } : undefined}
            data-order-cell={cell}
          />
        ))}
      </span>
      {progress.allWatched && <span class="text-secondary font-semibold text-mint">{t('panel.order.allWatched')}</span>}
      {progress.next && <span class="line-clamp-2 text-secondary font-semibold break-words text-muted">{t('panel.order.next', { title: shortTitle(main[0]?.title ?? '', progress.next.title) })}</span>}
    </>
  );
}

function ReadyOrder({ props, graph }: { props: WatchOrderProps; graph: FranchiseGraph }) {
  const [mode, setMode] = useState<Mode>(() => (graph.extras.some((e) => e.id === props.currentId) ? 'all' : lastMode));
  const states0 = props.order.status === 'ready' ? props.order.states : { anilist: null, mal: null };
  const main = releaseOrder(graph, 'main');
  const list = releaseOrder(graph, mode);
  const { byId, other } = mergeStates(states0, props.links.preferred, releaseOrder(graph, 'all'));
  const ctx: RowContext = { rootTitle: main[0]?.title ?? '', mainIds: new Set(graph.main), states: byId, other, props };
  return (
    <Collapsible
      variant="row"
      title={t('panel.order.title')}
      summary={<Summary main={main} states={byId} />}
      open={props.open}
      onToggle={props.onToggle}
      focusKey="panel-section-order"
    >
      <Timeline
        graph={graph}
        ctx={ctx}
        list={list}
        mode={mode}
        onMode={(next) => {
          lastMode = next;
          setMode(next);
        }}
      />
    </Collapsible>
  );
}

/** La section est dessinée : chargement, erreur ou franchise de plusieurs entrées (même règle pour la carte, qui y met un séparateur) */
export function showsWatchOrder(order: OrderState, currentId: number): boolean {
  if (order.status === 'idle') return false;
  if (order.status !== 'ready') return true;
  // Graphe prêt qui ne contient pas la page (autre franchise le temps d'un changement de page) : rien, jamais de squelette éternel
  if (!inFranchise(order.graph, currentId)) return false;
  return releaseOrder(order.graph, 'all').length >= 2;
}

export function WatchOrder(props: WatchOrderProps) {
  const { order } = props;
  if (!showsWatchOrder(order, props.currentId)) return null;
  const shell = (body: ComponentChildren) => (
    <Collapsible variant="row" title={t('panel.order.title')} open={props.open} onToggle={props.onToggle} focusKey="panel-section-order">
      {body}
    </Collapsible>
  );
  const graph = order.status === 'ready' ? order.graph : null;
  if (order.status === 'error') return shell(<Alert message={order.message ?? t('panel.order.error')} action={{ label: t('common.retry'), onClick: props.onRetry, focusKey: 'order-retry' }} />);
  if (graph === null) {
    return shell(
      <div class="flex flex-col gap-2 motion-safe:animate-pulse" role="status" aria-busy="true" aria-label={t('panel.order.title')}>
        <span class="h-1.5 w-full rounded-pill bg-line" />
        <span class="h-4 w-2/3 rounded-control bg-line" />
        <span class="h-4 w-1/2 rounded-control bg-line" />
      </div>,
    );
  }
  return <ReadyOrder props={props} graph={graph} />;
}
