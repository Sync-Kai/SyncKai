// Onglet « Agenda » du panneau latéral (maquettes PanelAgenda, PanelAgendaSemaine, PanelAgendaAutreSemaine,
// PanelAgendaEtats, PanelAgendaMenu, PanelAgendaMenuRecherche, PanelAgendaHeure, PanelAgendaHeureEtats) : sorties de la
// semaine pour les séries en cours, du premier au dernier jour de la semaine (jours passés atténués, défilement jusqu'à
// aujourd'hui), jour vide = son titre et « Aucun épisode » à droite, sans carte. Ligne : jaquette 32 × 44, titre … +
// « · Ép. N », puis l'heure sur la plateforme en gras (lavande si réglée pour la série) · plateforme · « Japon HH:MM »
// (tronqué en premier), « ● Vu » et ligne atténuée si l'épisode est vu ; « Ouvrir » (logo) et « ⋯ » (« Ajuster
// l'heure », « Ouvrir la fiche › », « Chercher sur… › »). L'éditeur de délai s'ouvre sous la ligne et rend le focus au
// « ⋯ » de la série en se fermant (4-A2). Données et requêtes : sidepanel/agenda-controller.ts (sans rendu).
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { getLocale, t, upperFirst } from '../../i18n';
import { activePlatforms } from '../../browser/platform-access';
import { platformSearchUrl } from '../../platforms/links';
import { PLATFORMS } from '../../platforms/registry';
import { buildAgendaDays, dateKey, formatOffset, weekRange, type AgendaDay, type AgendaRow, type AgendaSeries, type IsoWeekday, type WeekRange } from '../../shared/agenda';
import { entryLink, entryLinks, type EntryLinkContext } from '../../shared/entry-link';
import type { StreamingPlatform } from '../../shared/episode.types';
import { DEFAULT_SETTINGS, OFFSET_RANGE, parseOffsetInput, type SyncSettings } from '../../shared/settings';
import { TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { Alert } from '../../ui/components/alert';
import { Button } from '../../ui/components/button';
import { Cover } from '../../ui/components/cover';
import { Icon } from '../../ui/components/icon';
import { LogoButton } from '../../ui/components/logo-button';
import { Menu, MenuItem, MenuSeparator, SubMenu } from '../../ui/components/menu';
import { ServiceLogo } from '../../ui/components/service-logo';
import { WeekPicker } from '../../ui/components/week-picker';
import { alertAttrs } from '../../ui/live-region';
import { formatPlatformList } from '../../ui/platform-list';
import { useLocale, useStore } from '../../ui/preact/hooks';
import type { ReadonlyStore } from '../../ui/state';
import type { AgendaController, AgendaStatus } from '../agenda-controller';

/** Instantané du contrôleur publié pour l'arbre Preact (sidepanel.ts) */
export interface AgendaSnapshot {
  range: WeekRange;
  firstDay: IsoWeekday;
  status: AgendaStatus;
  settings: SyncSettings | null;
  player: StreamingPlatform;
  series: ReadonlyMap<number, AgendaSeries>;
  connected: readonly TrackerId[];
}

export function agendaSnapshot(ctl: AgendaController): AgendaSnapshot {
  const { range, firstDay, status, settings, player, series, connected } = ctl;
  return { range, firstDay, status, settings, player, series, connected };
}

export interface AgendaProps {
  /** null : contrôleur pas encore créé (squelette) */
  state: ReadonlyStore<AgendaSnapshot | null>;
  /** Plateformes à accès optionnel accordées : recherches du menu « ⋯ » */
  granted: readonly StreamingPlatform[] | undefined;
  /** ‹ › (regroupés par le contrôleur) */
  onStep: (delta: number) => void;
  /** Semaine choisie (calendrier, « Aujourd'hui ») */
  onChoose: (week: WeekRange) => void;
  /** « Réessayer » */
  onRetry: () => void;
  /** Délai propre à la série (null : délai de la plateforme) ; rejette en cas d'échec */
  onSaveOffset: (mediaId: number, offset: number | null) => Promise<void>;
}

/** Remplace `{time}` (ou un autre paramètre) par un repère, pour mettre l'heure en forme dans la phrase traduite */
const MARK = '\u0000';

function timeFormat(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getLocale(), { hour: 'numeric', minute: '2-digit' });
}

/** Entier dans le format de la langue : signe moins et séparateur de milliers (« -1 440 », « 10 080 ») */
function formatInteger(value: number): string {
  return new Intl.NumberFormat(getLocale()).format(value);
}

function sameLocalDay(a: number, b: number): boolean {
  const [da, db] = [new Date(a), new Date(b)];
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

/** Heure de sortie (UNIX secondes) ; autre jour que la diffusion japonaise : jour abrégé devant (« dim. 00:30 ») */
function releaseTime(at: number, airingAt: number): string {
  const ms = at * 1000;
  return sameLocalDay(ms, airingAt * 1000)
    ? timeFormat().format(ms)
    : new Intl.DateTimeFormat(getLocale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(ms);
}

/** Délai effectif de la ligne : celui de la série, sinon celui de la plateforme */
function rowOffset(row: AgendaRow, settings: SyncSettings): number | null {
  return row.customOffset ?? (row.platform ? settings.platformOffsets[row.platform] : null);
}

/** Infobulle de l'heure estimée : délai de la plateforme (réglable) ou de la série */
function estimateTitle(row: AgendaRow, settings: SyncSettings): string {
  const offset = formatOffset(rowOffset(row, settings) ?? 0);
  return row.customOffset !== null || !row.platform ? t('agenda.estimate.custom', { offset }) : t('agenda.estimate.title', { platform: PLATFORMS[row.platform].label, offset });
}

/** Séparateur « · » (espaces insécables : les éléments de la ligne sont des boîtes flexibles, sans espace entre elles) */
const SEPARATOR = '\u00a0·\u00a0';
const DOT = <span class="shrink-0 whitespace-pre">{SEPARATOR}</span>;

/**
 * « Japon 17:00 », l'heure en gras quand c'est la seule heure de la ligne ; après l'heure de la plateforme, précédé de son
 * séparateur « · » et tronqué en premier (le séparateur disparaît avec lui)
 */
function JapanTime({ airingAt, strong }: { airingAt: number; strong: boolean }) {
  const time = timeFormat().format(airingAt * 1000);
  const [before = '', after = ''] = t('agenda.jp', { time: MARK }).split(MARK);
  return (
    <span class={strong ? 'min-w-0 truncate' : 'min-w-0 shrink-1000 truncate'} title={t('agenda.jp.title')} data-agenda-jp="">
      {!strong && SEPARATOR}
      {before}
      {strong ? <strong class="font-extrabold text-ink">{time}</strong> : time}
      {after}
    </span>
  );
}

/** Ligne 2 : « ● Vu · 18:00 Crunchyroll · Japon 17:00 » */
function RowTimes({ row, settings }: { row: AgendaRow; settings: SyncSettings }) {
  return (
    <span class="flex min-w-0 items-baseline overflow-hidden text-secondary font-semibold whitespace-nowrap text-muted tabular-nums" data-agenda-times="">
      {row.watched && (
        <>
          <span class="inline-flex shrink-0 items-center gap-1 font-extrabold text-mint" data-agenda-watched="">
            <span class="size-1.5 self-center rounded-pill bg-mint" aria-hidden="true" />
            {t('agenda.watched')}
          </span>
          {DOT}
        </>
      )}
      {row.estimateAt !== null ? (
        <>
          <span class="flex min-w-0 shrink items-baseline" title={estimateTitle(row, settings)}>
            <strong class={`shrink-0 font-extrabold ${row.customOffset !== null ? 'text-lavender' : 'text-ink'}`} data-agenda-estimate={row.customOffset !== null ? 'custom' : 'platform'}>
              {releaseTime(row.estimateAt, row.airingAt)}
            </strong>
            {row.platform && <span class="min-w-0 truncate">{`\u00a0${PLATFORMS[row.platform].label}`}</span>}
          </span>
          <JapanTime airingAt={row.airingAt} strong={false} />
        </>
      ) : (
        <JapanTime airingAt={row.airingAt} strong />
      )}
    </span>
  );
}

/** Seconde ligne de « Ajuster l'heure » : « 19:45 Netflix · réglé pour cette série » */
function adjustSummary(row: AgendaRow): string | undefined {
  if (row.estimateAt === null) return undefined;
  const time = releaseTime(row.estimateAt, row.airingAt);
  const where = row.platform ? `${time} ${PLATFORMS[row.platform].label}` : time;
  return `${where} · ${t(row.customOffset !== null ? 'agenda.adjust.custom' : 'agenda.adjust.default')}`;
}

interface RowProps {
  row: AgendaRow;
  first: boolean;
  links: EntryLinkContext;
  settings: SyncSettings;
  player: StreamingPlatform;
  active: readonly StreamingPlatform[];
  editing: boolean;
  onEdit: () => void;
  onCloseEditor: () => void;
  onSaveOffset: (offset: number | null) => Promise<void>;
}

function Row({ row, first, links, settings, player, active, editing, onEdit, onCloseEditor, onSaveOffset }: RowProps) {
  const site = entryLink(row, links);
  const sites = entryLinks(row, links);
  // Plateformes actives sans lien connu : recherche, lecteur préféré en tête
  const searches = row.searchPlatforms.filter((platform) => active.includes(platform)).sort((a, b) => Number(b === player) - Number(a === player));
  const cover = <Cover size="agenda" title={row.title} src={row.coverUrl} dimmed={row.watched} />;
  return (
    <li class="relative flex flex-col gap-2 py-2.5 pr-1.5 pl-3" data-agenda-row={row.scheduleId}>
      {!first && <span class="absolute inset-x-3 top-0 h-px bg-line" aria-hidden="true" />}
      <div class="flex items-center gap-2.5">
        {site ? (
          // Même lien que le titre : hors tabulation et masqué aux lecteurs d'écran (doublon)
          <a class="flex shrink-0 rounded-cover transition hover:brightness-110" href={site.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
            {cover}
          </a>
        ) : (
          cover
        )}
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class={`flex min-w-0 items-baseline text-row-title ${row.watched ? 'text-muted' : 'text-ink'}`}>
            <span class="min-w-0 truncate" title={row.title}>
              {site ? (
                <a
                  class="text-inherit no-underline underline-offset-2 hover:underline"
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('entry.openAria', { title: row.title, service: TRACKER_LABELS[site.service] })}
                  data-focus={`agenda-entry-${row.scheduleId}`}
                >
                  {row.title}
                </a>
              ) : (
                row.title
              )}
            </span>
            <span class="shrink-0 whitespace-pre">{` · ${t('agenda.episode', { episode: row.episode })}`}</span>
          </span>
          <RowTimes row={row} settings={settings} />
        </div>
        {row.link && (
          <LogoButton
            platform={row.link.platform}
            href={row.link.url}
            label={t('watching.openOnAria', { title: row.title, platform: PLATFORMS[row.link.platform].label })}
            title={t('agenda.openTitle', { platform: PLATFORMS[row.link.platform].label })}
            focusKey={`agenda-open-${row.scheduleId}`}
          />
        )}
        <span class="flex shrink-0" data-menu-root={`agenda-${row.scheduleId}`}>
          <Menu label={t('agenda.menu', { title: row.title })} focusKey={`agenda-menu-${row.scheduleId}`} placement="top-full right-0 mt-1 w-max min-w-60 max-w-72" reveal>
            <MenuItem icon="clock" description={adjustSummary(row)} focusKey={`agenda-adjust-${row.scheduleId}`} onSelect={onEdit}>
              {t('agenda.adjust')}
            </MenuItem>
            {(sites.length > 0 || searches.length > 0) && <MenuSeparator />}
            {sites.length > 0 && (
              <SubMenu icon="external" label={t('watching.menu.openEntry')} focusKey={`agenda-site-${row.scheduleId}`}>
                {sites.map((link) => (
                  <MenuItem key={link.service} service={link.service} href={link.url} ariaLabel={t('page.openOn', { service: TRACKER_LABELS[link.service] })}>
                    {TRACKER_LABELS[link.service]}
                  </MenuItem>
                ))}
              </SubMenu>
            )}
            {searches.length > 0 && (
              <SubMenu icon="search" label={t('watching.menu.searchOn')} focusKey={`agenda-search-${row.scheduleId}`}>
                {searches.map((platform) => (
                  <MenuItem
                    key={platform}
                    service={platform}
                    href={platformSearchUrl(platform, row.title)}
                    ariaLabel={t('watching.searchOnAria', { title: row.title, platform: PLATFORMS[platform].label })}
                  >
                    {PLATFORMS[platform].label}
                  </MenuItem>
                ))}
              </SubMenu>
            )}
          </Menu>
        </span>
      </div>
      {editing && <DelayEditor row={row} settings={settings} onClose={onCloseEditor} onSave={onSaveOffset} />}
    </li>
  );
}

interface DelayEditorProps {
  row: AgendaRow;
  settings: SyncSettings;
  onClose: () => void;
  /** Rejette en cas d'échec ; l'éditeur se ferme une fois enregistré */
  onSave: (offset: number | null) => Promise<void>;
}

/** Pas des flèches ↑ ↓ dans le champ du délai (minutes) */
const OFFSET_KEY_STEP = 5;

/** Valeur saisie valable : entier dans OFFSET_RANGE (champ vide = invalide, jamais 0) */
function validOffset(value: string): number | null {
  const offset = parseOffsetInput(value);
  return Number.isInteger(offset) && offset >= OFFSET_RANGE.min && offset <= OFFSET_RANGE.max ? offset : null;
}

/**
 * « Ajuster l'heure » (maquettes PanelAgendaHeure, PanelAgendaHeureEtats) : minutes après la diffusion japonaise, aperçu
 * « ≈ [logo] 19:45 », phrase du délai, aide des bornes ; hors bornes : champ et aide en rouge, rien n'est envoyé ;
 * enregistrement en cours : champ et boutons grisés, spinner ; échec : « Non enregistré, réessaie ». Entrée enregistre,
 * Échap annule.
 */
function DelayEditor({ row, settings, onClose, onSave }: DelayEditorProps) {
  const platformOffset = row.platform ? settings.platformOffsets[row.platform] : null;
  const [value, setValue] = useState(() => String(row.customOffset ?? platformOffset ?? 60));
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const offset = validOffset(value);
  // Rouge après une tentative, ou dès qu'un nombre hors bornes est tapé (pas pour un champ vide ou un « - » en cours)
  const invalid = offset === null && (attempted || /\d/.test(value));
  const inputId = `sk-offset-${row.scheduleId}`;
  const helpId = `sk-offset-help-${row.scheduleId}`;

  useLayoutEffect(() => {
    input.current?.focus({ preventScroll: true });
    input.current?.closest('[data-agenda-editor]')?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  const save = async (next: number | null): Promise<void> => {
    // Enregistrement en cours : Entrée ou second clic sans effet (un seul envoi)
    if (saving) return;
    setAttempted(true);
    setFailed(false);
    setSaving(true);
    try {
      await onSave(next);
    } catch {
      setSaving(false);
      setFailed(true);
    }
  };
  const submit = (): void => {
    if (offset === null) {
      setAttempted(true);
      return;
    }
    void save(offset);
  };

  // Aperçu : heure de sortie avec le délai saisi
  const custom = row.customOffset !== null || offset !== platformOffset;
  const preview = offset === null ? null : releaseTime(row.airingAt + offset * 60, row.airingAt);
  const [before = '', after = ''] = t('agenda.estimate', { platform: MARK, time: preview ?? '' }).split(MARK);
  const description =
    offset === null ? null : custom || !row.platform ? t('agenda.estimate.custom', { offset: formatOffset(offset) }) : t('agenda.adjust.platform', { platform: PLATFORMS[row.platform].label, offset: formatOffset(offset) });
  const help = t('agenda.adjust.help', { min: formatInteger(OFFSET_RANGE.min), max: formatInteger(OFFSET_RANGE.max) });
  return (
    // Fermé (enregistré, Annuler, Échap) : focus rendu au « ⋯ » de la série par l'Agenda ; repli déclaré pour useFocusFallback
    <div class="flex flex-col gap-2 rounded-panel border border-line bg-ground p-3" data-focus-fallback={`agenda-menu-${row.scheduleId}`} data-agenda-editor="">
      <label class="text-body font-extrabold text-ink" for={inputId}>
        {t('agenda.adjust.label', { title: row.title })}
      </label>
      <div class="flex min-w-0 items-center gap-2">
        <input
          ref={input}
          id={inputId}
          class={`h-9 w-24 shrink-0 rounded-panel border bg-surface px-3 text-body font-bold text-ink tabular-nums disabled:opacity-50 ${invalid ? 'border-danger' : 'border-field'}`}
          // Texte numérique comme le délai d'une plateforme (Réglages › Plateformes) : pas de flèches natives ; ↑ ↓ par 5 min
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellcheck={false}
          value={value}
          disabled={saving}
          aria-describedby={helpId}
          aria-invalid={invalid ? 'true' : 'false'}
          data-focus={`agenda-offset-${row.scheduleId}`}
          onInput={(event) => setValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && offset !== null) {
              event.preventDefault();
              const next = offset + (event.key === 'ArrowUp' ? OFFSET_KEY_STEP : -OFFSET_KEY_STEP);
              setValue(String(Math.min(OFFSET_RANGE.max, Math.max(OFFSET_RANGE.min, next))));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }
          }}
        />
        <span class="text-secondary font-bold text-muted">{t('settings.offsets.unit')}</span>
        {preview !== null && (
          <span class={`ms-auto inline-flex min-w-0 items-center gap-1 text-body font-extrabold whitespace-nowrap tabular-nums ${custom ? 'text-lavender' : 'text-ink'}`} data-agenda-preview="">
            {before.trim()}
            {row.platform && <ServiceLogo id={row.platform} size="sm" />}
            {after.trim()}
          </span>
        )}
      </div>
      <div class="flex flex-col gap-1">
        {description !== null && <p class="m-0 text-secondary text-muted">{description}</p>}
        {failed ? (
          <p class="m-0 flex items-center gap-1.5 text-secondary font-extrabold text-danger" id={helpId} {...alertAttrs(t('agenda.adjust.saveFailed'))}>
            <Icon name="alert" class="size-3.5 shrink-0" strokeWidth="2.2" />
            {t('agenda.adjust.saveFailed')}
          </p>
        ) : (
          <p class={`m-0 text-secondary ${invalid ? 'font-extrabold text-danger' : 'text-muted'}`} id={helpId} role="note">
            {help}
          </p>
        )}
      </div>
      <div class="flex flex-wrap items-center gap-2">
        {row.customOffset !== null && (
          <Button size="sm" disabled={saving} focusKey={`agenda-reset-${row.scheduleId}`} onClick={() => void save(null)}>
            {t('agenda.adjust.reset')}
          </Button>
        )}
        <Button size="sm" variant="text" disabled={saving} focusKey={`agenda-cancel-${row.scheduleId}`} onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button size="sm" variant="primary" class="ms-auto" busy={saving} focusKey={`agenda-save-${row.scheduleId}`} onClick={submit}>
          {t('agenda.adjust.save')}
        </Button>
      </div>
    </div>
  );
}

/** Jour : titre (« Vendredi 16 », badge « Aujourd'hui »), « Aucun épisode » à droite d'un jour vide, sinon sa carte */
function Day({ day, now, children }: { day: AgendaDay; now: number; children: ComponentChildren }) {
  const label = upperFirst(new Intl.DateTimeFormat(getLocale(), { weekday: 'long', day: 'numeric' }).format(new Date(day.start)));
  const past = !day.isToday && day.start < now;
  const empty = day.rows.length === 0;
  return (
    <section class="flex flex-col gap-1.5" data-agenda-day={dateKey(new Date(day.start))}>
      <h3 class={`m-0 flex h-6 min-w-0 scroll-mt-12 items-center gap-2 px-1 text-body font-extrabold ${past ? 'text-muted' : 'text-ink'}`} data-agenda-today={day.isToday ? '' : undefined}>
        <span class="min-w-0 truncate">{label}</span>
        {day.isToday && <span class="inline-flex h-5 shrink-0 items-center rounded-pill border border-field px-2 text-section tracking-normal font-extrabold text-ink">{t('agenda.day.today')}</span>}
        {empty && <span class="ms-auto shrink-0 text-secondary font-semibold text-muted">{t('agenda.day.none')}</span>}
      </h3>
      {!empty && <ul class="m-0 flex list-none flex-col rounded-card border border-line bg-surface p-0">{children}</ul>}
    </section>
  );
}

/** Carte d'état (aucun compte, aucune série, semaine vide, erreur sans programme en mémoire) */
function StateCard({ text, tone = 'info', onRetry }: { text: string; tone?: 'info' | 'error'; onRetry?: () => void }) {
  return (
    <div
      class="flex flex-col items-center gap-2.5 rounded-card border border-line bg-surface px-4 py-6 text-center"
      {...(tone === 'error' ? alertAttrs(text) : { role: 'status' })}
      data-agenda-state={tone}
    >
      <Icon name={tone === 'error' ? 'alert' : 'calendar'} class={`size-5 ${tone === 'error' ? 'text-danger' : 'text-lavender'}`} strokeWidth="2.2" />
      <p class="m-0 max-w-64 text-secondary text-muted">{text}</p>
      {onRetry && (
        <Button size="sm" icon="retry" focusKey="agenda-retry" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div class="flex flex-col gap-2.5" role="status" aria-busy="true" aria-label={t('agenda.loading')} data-agenda-skeleton="">
      {[0, 1, 2].map((i) => (
        <div key={i} class="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-3 motion-safe:animate-pulse">
          <span class="h-3 w-24 rounded-pill bg-raised" />
          <span class="flex items-center gap-3">
            <span class="h-cover-agenda-h w-cover-agenda-w shrink-0 rounded-cover bg-raised" />
            <span class="flex flex-1 flex-col gap-2">
              <span class="h-3 w-3/4 rounded-pill bg-raised" />
              <span class="h-2.5 w-1/2 rounded-pill bg-raised" />
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function Agenda({ state, granted, onStep, onChoose, onRetry, onSaveOffset }: AgendaProps) {
  const locale = useLocale();
  const snapshot = useStore(state);
  const root = useRef<HTMLDivElement>(null);
  /** Ligne dont l'éditeur de délai est ouvert */
  const [editing, setEditing] = useState<number | null>(null);
  /** « ⋯ » à refocaliser après la fermeture de l'éditeur (4-A2) */
  const refocus = useRef<number | null>(null);
  /** Semaine déjà amenée à aujourd'hui (ou en haut) : une fois par semaine affichée */
  const scrolled = useRef<string | null>(null);
  const range = snapshot?.range ?? null;
  const ready = snapshot !== null && snapshot.status.kind !== 'loading';

  // Autre semaine : éditeur oublié
  useEffect(() => setEditing(null), [range?.key]);

  useLayoutEffect(() => {
    if (editing !== null || refocus.current === null) return;
    root.current?.querySelector<HTMLElement>(`[data-focus="agenda-menu-${refocus.current}"]`)?.focus({ preventScroll: true });
    refocus.current = null;
  }, [editing]);

  // Semaine affichée prête : défilement jusqu'à aujourd'hui (sous la navigation collante), sinon en haut après un changement
  // de semaine. Retour sur l'onglet : la coque rétablit ensuite le défilement gardé.
  useLayoutEffect(() => {
    if (!range || !ready || scrolled.current === range.key) return;
    const first = scrolled.current === null;
    scrolled.current = range.key;
    const today = root.current?.querySelector<HTMLElement>('[data-agenda-today]');
    if (today) today.scrollIntoView?.({ block: 'start' });
    else if (!first) {
      const panel = root.current?.closest<HTMLElement>('[role="tabpanel"]');
      if (panel) panel.scrollTop = 0;
    }
  }, [range?.key, ready]);

  if (!snapshot || !range) return <Skeleton />;
  const { status, settings, firstDay } = snapshot;
  const now = Date.now();
  const current = now >= range.start && now < range.end;
  const closeEditor = (scheduleId: number): void => {
    refocus.current = scheduleId;
    setEditing(null);
  };

  const body = (): ComponentChildren => {
    switch (status.kind) {
      case 'loading':
        return <Skeleton />;
      case 'not-connected':
        return <StateCard text={t('agenda.notConnected')} />;
      case 'no-series':
        return (
          <StateCard
            text={
              status.optional.length > 0
                ? t('agenda.empty.noSeriesPlatforms', { platforms: formatPlatformList(activePlatforms(status.optional), 'disjunction') })
                : t('agenda.empty.noSeries')
            }
          />
        );
      case 'error':
        return <StateCard tone="error" text={t('agenda.error', { error: status.message })} onRetry={onRetry} />;
      case 'ready': {
        if (!settings) return <Skeleton />;
        const days = buildAgendaDays(status.cache.schedules, snapshot.series, range, settings, now);
        const links: EntryLinkContext = { connected: snapshot.connected, preferred: settings.entryService ?? DEFAULT_SETTINGS.entryService };
        const active = activePlatforms(granted ?? []);
        return (
          <>
            {status.error !== null && <Alert message={t('agenda.stale', { error: status.error })} action={{ label: t('common.retry'), icon: 'retry', onClick: onRetry, focusKey: 'agenda-retry' }} />}
            {days.every((day) => day.rows.length === 0) ? (
              <StateCard text={t('agenda.empty.week')} />
            ) : (
              days.map((day) => (
                <Day key={day.start} day={day} now={now}>
                  {day.rows.map((row, i) => (
                    <Row
                      key={row.scheduleId}
                      row={row}
                      first={i === 0}
                      links={links}
                      settings={settings}
                      player={snapshot.player}
                      active={active}
                      editing={editing === row.scheduleId}
                      onEdit={() => setEditing(row.scheduleId)}
                      onCloseEditor={() => closeEditor(row.scheduleId)}
                      onSaveOffset={async (offset) => {
                        await onSaveOffset(row.mediaId, offset);
                        closeEditor(row.scheduleId);
                      }}
                    />
                  ))}
                </Day>
              ))
            )}
          </>
        );
      }
    }
  };

  return (
    <div ref={root} class="flex flex-col gap-2.5" data-agenda="">
      {/* Navigation collante : reste visible quand la semaine défile */}
      <div class="sticky top-0 z-10 -mx-3 bg-ground px-3 pt-1 pb-1.5">
        <WeekPicker
          week={range}
          firstDay={firstDay}
          locale={locale}
          now={now}
          busy={status.kind === 'ready' && status.refreshing}
          focusKey="agenda"
          labels={{
            prev: t('agenda.prev'),
            next: t('agenda.next'),
            nav: t('agenda.nav'),
            dialog: t('agenda.picker.label'),
            prevMonth: t('agenda.picker.prevMonth'),
            nextMonth: t('agenda.picker.nextMonth'),
            thisWeek: t('agenda.picker.thisWeek'),
            hint: t('agenda.picker.hint'),
          }}
          onStep={onStep}
          onSelect={onChoose}
          trailing={
            !current && (
              <Button size="sm" focusKey="agenda-today" onClick={() => onChoose(weekRange(Date.now(), firstDay))}>
                {t('agenda.today')}
              </Button>
            )
          }
        />
      </div>
      {body()}
    </div>
  );
}
