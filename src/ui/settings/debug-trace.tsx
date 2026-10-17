// Réglages › Aide & à propos › Trace de débogage (maquette AProposDev ; builds de dev seulement : montée sous
// `__SYNCKAI_DEBUG__` par page-help.tsx, absente des bundles publiés). Événements écrits par le service worker
// (background/debug-trace.ts) dans storage.session : les plus récents d'abord, filtre par catégorie ; « Copier la trace »
// donne toute la trace en JSON (à coller pour déboguer un cas réel), « Effacer » et le mode détaillé passent par le
// service worker. Section repliée par défaut (liste longue). Logger créé à l'usage : rien au chargement du module.
import { useEffect, useId, useState } from 'preact/hooks';
import { getLocale, t } from '../../i18n';
import { clearTrace, readTraceEvents, readTraceVerbose, setTraceVerbose } from '../../browser/debug-trace-store';
import { DEBUG_TRACE_KEY, DEBUG_TRACE_VERBOSE_KEY } from '../../protocol/storage-keys';
import { TRACE_CATEGORIES, traceCapacity, type TraceCategory, type TraceEvent } from '../../shared/debug-trace';
import { createLogger } from '../../browser/logger';
import { Button } from '../components/button';
import { Collapsible } from '../components/collapsible';
import { Icon } from '../components/icon';
import { Switch } from '../components/switch';
import { useLocale } from '../preact/hooks';

const COPIED_MS = 2_000;
/** Relecture regroupée : la trace change à chaque événement pendant qu'on la lit */
const RELOAD_DELAY_MS = 300;
const CARD = 'rounded-card border border-line bg-surface';

const isCategory = (value: string): value is TraceCategory => (TRACE_CATEGORIES as readonly string[]).includes(value);

/** Contexte d'un événement en une ligne : numéro, origine, onglet, plateforme */
function originLine(event: TraceEvent): string {
  return [`#${event.seq}`, event.source, event.tabId !== undefined && `tab ${event.tabId}`, event.platform].filter((part): part is string => typeof part === 'string').join(' · ');
}

const time = (at: number): string => new Date(at).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });

function EventRow({ event, first }: { event: TraceEvent; first: boolean }) {
  const data = JSON.stringify(event.data);
  return (
    <li class={`flex min-w-0 flex-col gap-0.5 px-3 py-2 ${first ? '' : 'border-t border-line'}`}>
      <div class="flex min-w-0 items-center gap-2">
        <span class="min-w-0 flex-1 truncate font-bold">{`${event.category} · ${event.type}`}</span>
        <span class="shrink-0 text-secondary text-muted tabular-nums">{time(event.at)}</span>
      </div>
      <span class="min-w-0 text-secondary break-words text-muted">{originLine(event)}</span>
      {data !== '{}' && <span class="min-w-0 font-mono text-secondary break-all text-muted">{data}</span>}
    </li>
  );
}

export function DebugTraceSection() {
  useLocale();
  const [events, setEvents] = useState<TraceEvent[] | null>(null);
  const [verbose, setVerbose] = useState(false);
  const [filter, setFilter] = useState<TraceCategory | 'all'>('all');
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const verboseId = useId();

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = (): void => {
      Promise.all([readTraceEvents(), readTraceVerbose()]).then(
        ([read, mode]) => {
          if (!live) return;
          setEvents(read);
          setVerbose(mode);
        },
        (error: unknown) => {
          createLogger('settings').warn('Trace de débogage illisible :', error);
          if (live) setEvents([]);
        },
      );
    };
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
      if (area !== 'session' || (!changes[DEBUG_TRACE_KEY] && !changes[DEBUG_TRACE_VERBOSE_KEY])) return;
      clearTimeout(timer);
      timer = setTimeout(load, RELOAD_DELAY_MS);
    };
    chrome.storage.onChanged.addListener(onChanged);
    load();
    return () => {
      live = false;
      clearTimeout(timer);
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [version]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy(): Promise<void> {
    try {
      // Toute la trace (ordre d'arrivée), avec la version et le build : de quoi rejouer le cas
      const exported = { exportedAt: new Date().toISOString(), version: chrome.runtime.getManifest().version, build: __SYNCKAI_BUILD__, verbose, events: await readTraceEvents() };
      await navigator.clipboard.writeText(JSON.stringify(exported, null, 2));
      setCopied(true);
      setCopyFailed(false);
    } catch (error: unknown) {
      createLogger('settings').warn('Copie de la trace impossible :', error);
      setCopyFailed(true);
    }
  }

  /** Effacer, mode détaillé : par le service worker, puis relecture */
  async function run(task: () => Promise<unknown>): Promise<void> {
    try {
      await task();
    } catch (error: unknown) {
      createLogger('settings').warn('Trace de débogage : service worker injoignable :', error);
    }
    setVersion((current) => current + 1);
  }

  const empty = events === null || events.length === 0;
  const number = new Intl.NumberFormat(getLocale());
  const shown = (events ?? []).filter((event) => filter === 'all' || event.category === filter).reverse();
  return (
    <Collapsible title={t('settings.debugTrace.title')} count={events?.length} variant="section" focusKey="debug-trace-toggle">
      <div class={`${CARD} flex flex-col`}>
        <div class="flex flex-col gap-2.5 px-3 py-2.5">
          <p class="m-0 text-secondary text-muted">{t('settings.debugTrace.text')}</p>
          <div class="flex items-center gap-3">
            <span class="min-w-0 flex-1 font-bold" id={verboseId}>
              {t('settings.debugTrace.verbose')}
            </span>
            <Switch checked={verbose} labelledBy={verboseId} focusKey="debug-trace-verbose" onChange={(checked) => void run(() => setTraceVerbose(checked))} />
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <select
              class="h-7 min-w-0 flex-1 cursor-pointer rounded-pill border border-field bg-raised px-2 text-secondary font-bold text-ink"
              aria-label={t('settings.debugTrace.filterAria')}
              data-focus="debug-trace-filter"
              value={filter}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setFilter(isCategory(value) ? value : 'all');
              }}
            >
              <option value="all">{t('settings.debugTrace.allCategories')}</option>
              {TRACE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <Button size="sm" icon={copied ? 'check' : undefined} disabled={empty} focusKey="debug-trace-copy" onClick={() => void copy()}>
              {copied ? t('settings.debugTrace.copied') : t('settings.debugTrace.copy')}
            </Button>
            <Button variant="danger" size="sm" disabled={empty} focusKey="debug-trace-clear" onClick={() => void run(clearTrace)}>
              {t('settings.matchDiag.clear')}
            </Button>
          </div>
          <span class="text-secondary text-muted tabular-nums">
            {t('settings.debugTrace.count', { count: number.format(events?.length ?? 0), max: number.format(traceCapacity(verbose)) })}
          </span>
          {copyFailed && (
            <p class="m-0 text-secondary font-bold text-danger" role="status">
              {t('settings.debugTrace.copyFailed')}
            </p>
          )}
        </div>
        <div class="border-t border-line">
          {events === null && (
            <span class="flex px-3 py-2.5 text-muted">
              <Icon name="spinner" class="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth="2.6" />
            </span>
          )}
          {events !== null && shown.length === 0 && (
            <p class="m-0 px-3 py-2.5 text-secondary text-muted" role="status">
              {t('settings.debugTrace.empty')}
            </p>
          )}
          {shown.length > 0 && (
            <ul class="m-0 flex list-none flex-col p-0">
              {shown.map((event, index) => (
                <EventRow key={event.seq} event={event} first={index === 0} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Collapsible>
  );
}
