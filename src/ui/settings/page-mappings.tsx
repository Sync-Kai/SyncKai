// Réglages › Synchronisation › Correspondances (maquettes SyncCorrespondances, SyncCorrespondancesEtats) : recherche,
// texte d'introduction, une carte repliable par plateforme (la plus fournie ouverte d'abord ; MAPPINGS_GROUP_LIMIT lignes
// puis « Voir les N autres »), légende des origines et zone de danger (« Tout réinitialiser » confirmé sur place). Écritures
// par browser/storage/mappings.ts (forgetMapping, clearMediaMappings), puis notifyMappingsChanged (résolutions de page
// gardées en mémoire par le service worker, L4) et relecture de la liste. Modèle sans DOM : mappings-model.ts.
import type { ComponentChild } from 'preact';
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t, tp } from '../../i18n';
import { createLogger } from '../../browser/logger';
import { clearMediaMappings, forgetMapping } from '../../browser/storage/mappings';
import { isStreamingPlatform } from '../../shared/episode.types';
import { Alert } from '../components/alert';
import { Button } from '../components/button';
import { Icon } from '../components/icon';
import { Section } from '../components/section';
import { ServiceLogo } from '../components/service-logo';
import { useFocusFallback, useLocale, useStore } from '../preact/hooks';
import { createStore, type Store } from '../state';
import { notifyMappingsChanged } from '../worker-call';
import type { SettingsContext, SettingsMountedPage } from './context';
import { MAPPING_BADGES, mappingsPageModel, type MappingBadge, type MappingGroupModel, type MappingRowModel } from './mappings-model';
import { preactPage } from './preact-page';

const log = createLogger('settings');

const CARD = 'rounded-card border border-line bg-surface';
const SEARCH_FOCUS = 'mappings-search';

/** État gardé entre deux visites (et aux changements de langue) */
interface MappingsView {
  query: string;
  /** Groupes dépliés au-delà de MAPPINGS_GROUP_LIMIT lignes */
  expanded: ReadonlySet<string>;
  /** Cartes ouvertes ; null : réglage par défaut (la plus fournie seule) */
  open: ReadonlySet<string> | null;
}

const BADGE_KEYS = {
  chosen: ['settings.mappings.origin.chosen', 'settings.mappings.origin.chosenHelp'],
  learned: ['settings.mappings.origin.learned', 'settings.mappings.origin.learnedHelp'],
  unmarked: ['settings.mappings.origin.unmarked', 'settings.mappings.origin.unmarkedHelp'],
  unverified: ['settings.mappings.origin.unverified', 'settings.mappings.origin.unverifiedHelp'],
} as const;

const BADGE_COLORS: Readonly<Record<MappingBadge, string>> = {
  chosen: 'bg-mint/14 text-mint',
  learned: 'bg-lavender/16 text-lavender',
  unmarked: 'bg-raised text-muted',
  unverified: 'bg-butter/14 text-butter',
};

function OriginBadge({ badge }: { badge: MappingBadge }) {
  return (
    // Pastille longue (néerlandais, panneau de 320 px) : sur deux lignes plutôt que coupée
    <span class={`inline-flex min-h-5 max-w-full items-center rounded-pill px-2 py-px text-section leading-tight tracking-normal ${BADGE_COLORS[badge]}`} data-origin={badge}>
      {t(BADGE_KEYS[badge][0])}
    </span>
  );
}

/** Une action en cours : « Oublier » d'une ligne (sa clé) ou la réinitialisation */
type Busy = { kind: 'forget'; key: string } | { kind: 'reset' } | null;
/** Échec d'enregistrement affiché sous la carte de son groupe, ou sous la zone de danger */
type Failure = { scope: string } | null;
const RESET_SCOPE = ':reset';

interface RowProps {
  row: MappingRowModel;
  first: boolean;
  busy: boolean;
  blocked: boolean;
  onForget: () => void;
}

function MappingRow({ row, first, busy, blocked, onForget }: RowProps) {
  return (
    <li
      class={`relative flex items-start gap-2.5 py-2.5 pr-2 pl-3 ${first ? '' : 'before:absolute before:top-0 before:right-3 before:left-3 before:h-px before:bg-line'}`}
      data-mapping={row.key}
    >
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="font-bold break-words" title={row.key}>
          {row.title}
        </span>
        <span class="flex min-w-0 items-baseline gap-1 text-secondary text-muted">
          <span aria-hidden="true">→</span>
          <a class="min-w-0 break-words text-ink underline decoration-field underline-offset-2 hover:decoration-ink" href={row.url} target="_blank" rel="noopener noreferrer">
            {row.entry}
          </a>
        </span>
        <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="text-secondary text-muted">{row.meta}</span>
          <OriginBadge badge={row.badge} />
        </span>
      </span>
      <button
        type="button"
        class="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-pill border-0 bg-transparent px-2.5 text-secondary font-bold text-danger transition-colors hover:bg-danger/10 disabled:pointer-events-none disabled:opacity-50"
        aria-label={t('settings.mappings.forgetAria', { label: row.title })}
        title={t('settings.mappings.forgetTitle')}
        aria-busy={busy ? 'true' : undefined}
        disabled={blocked}
        data-focus={`forget-${row.key}`}
        onClick={onForget}
      >
        {busy && <Icon name="spinner" class="size-3 animate-spin motion-reduce:animate-none" strokeWidth="2.6" />}
        {t('settings.mappings.forget')}
      </button>
    </li>
  );
}

interface GroupProps {
  group: MappingGroupModel;
  open: boolean;
  busy: Busy;
  failed: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onForget: (key: string) => void;
}

function MappingGroup({ group, open, busy, failed, onToggle, onExpand, onForget }: GroupProps) {
  const id = useId();
  const platform = isStreamingPlatform(group.id) ? group.id : null;
  return (
    <section class="flex flex-col gap-2" aria-label={group.label} data-mapping-group={group.id}>
      <div class={`${CARD} overflow-hidden`}>
        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent p-3 text-left text-ink transition-colors hover:bg-raised"
          aria-expanded={open ? 'true' : 'false'}
          aria-controls={id}
          data-focus={`maps-group-${group.id}`}
          onClick={onToggle}
        >
          {platform !== null && <ServiceLogo id={platform} size="lg" />}
          <span class="min-w-0 flex-1 truncate font-extrabold">{group.label}</span>
          <span class="shrink-0 text-secondary font-bold text-muted tabular-nums">{group.count}</span>
          <span class={`flex shrink-0 text-muted transition-transform duration-(--motion-enter) motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}>
            <Icon name="chevronDown" class="size-4" strokeWidth="2.4" />
          </span>
        </button>
        <div id={id} hidden={!open} class="border-t border-line">
          <ul class="m-0 flex list-none flex-col p-0">
            {group.rows.map((row, index) => (
              <MappingRow
                key={row.key}
                row={row}
                first={index === 0}
                busy={busy?.kind === 'forget' && busy.key === row.key}
                blocked={busy !== null}
                onForget={() => onForget(row.key)}
              />
            ))}
          </ul>
          {group.expandable && (
            <button
              type="button"
              class="flex h-9 w-full cursor-pointer items-center justify-center gap-1 border-0 border-t border-line bg-transparent text-secondary font-bold text-muted transition-colors hover:bg-raised hover:text-ink"
              aria-expanded={group.hidden === 0 ? 'true' : 'false'}
              data-focus={`maps-more-${group.id}`}
              onClick={onExpand}
            >
              {group.hidden > 0 ? tp('settings.mappings.showMore', group.hidden, { platform: group.label }) : t('settings.mappings.hide')}
              <span class={`flex ${group.hidden > 0 ? '' : 'rotate-180'}`}>
                <Icon name="chevronDown" class="size-3" strokeWidth="2.6" />
              </span>
            </button>
          )}
        </div>
      </div>
      {failed && <Alert message={t('settings.mappings.saveFailed')} />}
    </section>
  );
}

function OriginLegend() {
  return (
    // Pastille puis texte sur une ligne ; le texte passe dessous quand la carte est trop étroite (panneau de 320 px)
    <dl
      class="m-0 flex flex-col gap-1.5 rounded-card border border-dashed border-line px-3 py-2.5 text-secondary text-muted"
      aria-label={t('settings.mappings.originLegend')}
      data-origin-legend=""
    >
      {MAPPING_BADGES.map((badge) => (
        <div key={badge} class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <dt class="max-w-full">
            <OriginBadge badge={badge} />
          </dt>
          <dd class="m-0 min-w-0 flex-[1_1_10rem]">{t(BADGE_KEYS[badge][1])}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Confirmation sur place de « Tout réinitialiser » : focus sur « Annuler » à l'ouverture, Échap annule (charte) */
function ResetConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  // Avant le repli du focus de la page (useFocusFallback) : le bouton « Tout réinitialiser » focalisé vient de disparaître
  useLayoutEffect(() => cancel.current?.focus({ preventScroll: true }), []);
  return (
    <div
      // Question sur sa ligne, boutons dessous à droite (maquette SyncCorrespondancesEtats)
      class="flex flex-col gap-2 rounded-card border border-danger/40 bg-surface p-3"
      // Échap annule la confirmation sans quitter la page (la vue ferait « retour » sinon)
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
      data-focus-fallback="reset"
    >
      <span class="font-bold text-butter" role="status">
        {t('settings.mappings.resetConfirm')}
      </span>
      <span class="flex flex-wrap items-center justify-end gap-2">
        <button
          ref={cancel}
          type="button"
          class="inline-flex h-8 cursor-pointer items-center rounded-pill border-0 bg-transparent px-2 text-body font-extrabold text-muted transition-colors hover:text-ink"
          data-focus="reset-cancel"
          onClick={onCancel}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          class="inline-flex h-8 cursor-pointer items-center rounded-pill border-0 bg-danger px-4 text-body font-extrabold text-on-fill transition hover:brightness-105"
          data-focus="reset-confirm"
          onClick={onConfirm}
        >
          {t('common.confirm')}
        </button>
      </span>
    </div>
  );
}

function DangerZone({ count, busy, failed, onReset }: { count: number; busy: boolean; failed: boolean; onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  // Confirmation refermée (Annuler, Échap) : focus rendu à « Tout réinitialiser » (seule la zone est redessinée)
  useFocusFallback(zone, 'reset');
  return (
    <div ref={zone} class="contents">
      <Section title={t('settings.section.danger')} tone="danger">
        {confirming ? (
          <ResetConfirm
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              setConfirming(false);
              onReset();
            }}
          />
        ) : (
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-danger/40 bg-surface p-3">
            <span class="min-w-45 flex-1 text-secondary text-muted">{t('settings.mappings.resetHelp')}</span>
            <Button variant="danger" busy={busy} disabled={count === 0} focusKey="reset" onClick={() => setConfirming(true)}>
              {t('settings.mappings.reset')}
            </Button>
          </div>
        )}
        {failed && <Alert message={t('settings.mappings.saveFailed')} />}
      </Section>
    </div>
  );
}

/** Carte en pointillés : liste vide, recherche sans résultat */
function EmptyCard({ title, help, icon }: { title: string; help: string; icon?: 'sync' }) {
  return (
    <div class="flex flex-col items-center gap-1.5 rounded-card border border-dashed border-line bg-surface px-3 py-4 text-center" role="status" data-mappings-empty="">
      {icon && (
        <span class="flex size-8 items-center justify-center rounded-pill bg-raised text-lavender" aria-hidden="true">
          <Icon name={icon} class="size-4" strokeWidth="2.4" />
        </span>
      )}
      <span class="font-bold break-words">{title}</span>
      <span class="text-secondary text-muted">{help}</span>
    </div>
  );
}

export function MappingsPage({ ctx, view }: { ctx: SettingsContext; view: Store<MappingsView> }) {
  useLocale();
  const data = useStore(ctx.state);
  const state = useStore(view);
  const root = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [failure, setFailure] = useState<Failure>(null);
  // Ligne oubliée retirée : focus sur sa voisine (même groupe), sinon le titre de la page
  useFocusFallback(root);

  async function run(action: () => Promise<void>, next: Busy, scope: string): Promise<void> {
    setBusy(next);
    setFailure(null);
    try {
      await action();
      // Résolutions de page gardées en mémoire par le service worker : oubliées (L4)
      void notifyMappingsChanged();
    } catch (error: unknown) {
      log.error('Modification des correspondances impossible :', error);
      setFailure({ scope });
    }
    await ctx.refreshMappings();
    setBusy(null);
  }

  if (data.mappingsError !== null) return <Alert message={t('settings.mappings.loadError')} />;
  if (data.mappings === null) return <div class={`${CARD} h-40 motion-safe:animate-pulse`} aria-busy="true" aria-label={t('settings.summary.loading')} data-mappings-skeleton="" />;

  const model = mappingsPageModel(data.mappings, { query: state.query, expanded: state.expanded });
  const searching = state.query.trim() !== '';
  const isOpen = (id: string): boolean => searching || (state.open === null ? id === model.groups[0]?.id : state.open.has(id));
  const toggleOpen = (id: string): void => {
    const current = new Set(model.groups.filter((group) => isOpen(group.id)).map((group) => group.id));
    if (current.has(id)) current.delete(id);
    else current.add(id);
    view.set({ ...state, open: current });
  };
  const toggleExpanded = (id: string): void => {
    const next = new Set(state.expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    view.set({ ...state, expanded: next });
  };

  let list: ComponentChild;
  if (model.total === 0) {
    list = <EmptyCard icon="sync" title={t('settings.mappings.empty')} help={t('settings.mappings.emptyHelp')} />;
  } else if (model.matches === 0) {
    list = <EmptyCard title={t('settings.mappings.noResult', { query: state.query.trim() })} help={t('settings.mappings.noResultHelp')} />;
  } else {
    list = model.groups.map((group) => (
      <MappingGroup
        key={group.id}
        group={group}
        open={isOpen(group.id)}
        busy={busy}
        failed={failure?.scope === group.id}
        onToggle={() => toggleOpen(group.id)}
        onExpand={() => toggleExpanded(group.id)}
        onForget={(key) => void run(() => forgetMapping(key), { kind: 'forget', key }, group.id)}
      />
    ));
  }

  return (
    <div ref={root} class="flex flex-col gap-3">
      {model.total > 0 && (
        <>
          <label class="flex h-10 items-center gap-2 rounded-pill border border-field bg-surface px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-lavender">
            <span class="flex shrink-0 text-muted">
              <Icon name="search" class="size-4" strokeWidth="2.4" />
            </span>
            <input
              class="min-w-0 flex-1 border-0 bg-transparent text-body text-ink outline-none placeholder:text-muted"
              type="search"
              placeholder={t('settings.mappings.search')}
              aria-label={t('settings.mappings.search')}
              maxLength={80}
              autocomplete="off"
              spellcheck={false}
              value={state.query}
              data-focus={SEARCH_FOCUS}
              onInput={(event) => view.set({ ...state, query: event.currentTarget.value })}
            />
          </label>
          <p class="m-0 mx-1 text-secondary text-muted">{tp('settings.mappings.intro', model.total)}</p>
        </>
      )}
      {list}
      {model.total > 0 && <OriginLegend />}
      <DangerZone
        count={model.total}
        busy={busy?.kind === 'reset'}
        failed={failure?.scope === RESET_SCOPE}
        onReset={() => {
          view.set({ ...state, expanded: new Set(), open: null });
          void run(clearMediaMappings, { kind: 'reset' }, RESET_SCOPE);
        }}
      />
    </div>
  );
}

export function createMappingsPage(ctx: SettingsContext): SettingsMountedPage {
  const view = createStore<MappingsView>({ query: '', expanded: new Set(), open: null });
  return preactPage(() => <MappingsPage ctx={ctx} view={view} />);
}
