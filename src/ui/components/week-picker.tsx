// Navigation par semaine (maquettes PanelAgendaSemaine, PanelAgendaAutreSemaine) : ‹ [📅 dates ▾] ›. Le bouton du
// milieu ouvre le calendrier du mois : 6 lignes fixes de 36 px, une par semaine, la ligne entière cliquable ; semaine
// affichée entourée, aujourd'hui cerclé de lavande ; pied « Cette semaine ». Clavier (liste focalisée, semaine active
// par aria-activedescendant) : ↑ ↓ semaine, PgUp / PgDn mois, Début (cette semaine), Entrée (afficher), Échap (fermer,
// focus rendu au bouton). Changer de mois ne choisit rien : seul le choix d'une semaine appelle `onSelect` (l'hôte
// n'envoie aucune requête pendant la navigation dans le calendrier).
import type { ComponentChildren } from 'preact';
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { shiftWeek, weekRange, type IsoWeekday, type WeekRange } from '../../shared/agenda';
import { useDismiss } from '../preact/hooks';
import { Icon } from './icon';

/** Lignes du calendrier : toujours 6 (hauteur fixe d'un mois à l'autre) */
export const CALENDAR_ROWS = 6;

export interface WeekPickerLabels {
  /** ‹ et › (aria-label et infobulle) */
  prev: string;
  next: string;
  /** Nom du groupe de navigation (« Semaine ») */
  nav: string;
  /** Nom du calendrier (« Choisir une semaine ») */
  dialog: string;
  prevMonth: string;
  nextMonth: string;
  /** Pied : « Cette semaine » */
  thisWeek: string;
  /** Pied : « ↑ ↓ pour changer de semaine, Entrée pour l'afficher. » */
  hint: string;
}

export interface WeekPickerProps {
  /** Semaine affichée */
  week: WeekRange;
  /** Premier jour de la semaine de la langue */
  firstDay: IsoWeekday;
  /** Langue des dates (Intl) */
  locale: string;
  labels: WeekPickerLabels;
  /** Maintenant (ms) : aujourd'hui et « Cette semaine » ; défaut Date.now() au rendu */
  now?: number;
  /** Actualisation en cours : spinner dans le bouton du milieu */
  busy?: boolean;
  /** ‹ › : semaine précédente / suivante */
  onStep: (delta: number) => void;
  /** Semaine choisie dans le calendrier */
  onSelect: (week: WeekRange) => void;
  /** Contenu après › (bouton « Aujourd'hui » d'une autre semaine) */
  trailing?: ComponentChildren;
  /** Préfixe des clés data-focus : `<clé>-prev`, `<clé>-week`, `<clé>-next` */
  focusKey?: string;
  /** Calendrier ouvert au premier rendu (captures) */
  defaultOpen?: boolean;
}

/** Midi d'un jour (jamais un minuit : un changement d'heure ne change pas de jour) */
const noon = (at: number): Date => {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
};

/** Mois (1er jour, midi) qui contient le milieu de la semaine */
function monthOfWeek(week: WeekRange): Date {
  const middle = noon(week.days[3] ?? week.start);
  return new Date(middle.getFullYear(), middle.getMonth(), 1, 12);
}

/** Les 6 semaines affichées pour un mois : de celle qui contient le 1er aux 5 suivantes */
export function calendarWeeks(month: Date, firstDay: IsoWeekday): WeekRange[] {
  const first = weekRange(new Date(month.getFullYear(), month.getMonth(), 1, 12).getTime(), firstDay);
  return Array.from({ length: CALENDAR_ROWS }, (_, i) => shiftWeek(first, i));
}

/** Même quantième dans le mois décalé de `delta` (borné à la longueur du mois) */
function sameDayInMonth(at: number, delta: number): Date {
  const date = noon(at);
  const target = new Date(date.getFullYear(), date.getMonth() + delta, 1, 12);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), last), 12);
}

/** « 12 – 18 octobre » ; à cheval sur deux mois ou `short` : mois abrégés (« 28 sept. – 4 oct. », « 5 – 11 oct. ») */
export function weekLabel(week: WeekRange, locale: string, withYear = false, short = false): string {
  const last = week.days[6] ?? week.start;
  const sameMonth = new Date(week.start).getMonth() === new Date(last).getMonth();
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: sameMonth && !short ? 'long' : 'short', ...(withYear ? { year: 'numeric' as const } : {}) });
  return format.formatRange(new Date(week.start), new Date(last));
}

const sameDay = (a: number, b: number): boolean => noon(a).getTime() === noon(b).getTime();

const NAV_BUTTON =
  'inline-flex size-logo-button shrink-0 cursor-pointer items-center justify-center rounded-pill border border-line bg-surface p-0 text-ink transition-colors hover:border-field hover:bg-raised';
const MONTH_BUTTON =
  'inline-flex size-icon-button shrink-0 cursor-pointer items-center justify-center rounded-pill border-0 bg-transparent p-0 text-muted transition-colors hover:bg-line hover:text-ink';

export function WeekPicker({ week, firstDay, locale, labels, now = Date.now(), busy = false, onStep, onSelect, trailing, focusKey = 'week', defaultOpen = false }: WeekPickerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = (restore: boolean): void => {
    setOpen(false);
    if (restore) trigger.current?.focus({ preventScroll: true });
  };
  const step = (delta: number): void => {
    setOpen(false);
    onStep(delta);
  };
  const label = weekLabel(week, locale);
  /** Bouton « Aujourd'hui » à côté : mois abrégé et icône masquée dès 300 px de navigation (sinon sous 240 px) */
  const compact = Boolean(trailing);
  return (
    // @container : à 320 px (et dans la barre latérale de Firefox), l'icône du calendrier laisse la place aux dates
    <div ref={root} class="@container relative flex min-w-0 items-center gap-1.5" role="group" aria-label={labels.nav} data-week-picker="">
      <button type="button" class={NAV_BUTTON} aria-label={labels.prev} title={labels.prev} data-focus={`${focusKey}-prev`} onClick={() => step(-1)}>
        <Icon name="chevronRight" class="size-4 rotate-180" strokeWidth="2.4" />
      </button>
      <button
        ref={trigger}
        type="button"
        class="inline-flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-pill border border-line bg-surface px-3 text-body font-extrabold text-ink tabular-nums transition-colors hover:border-field hover:bg-raised aria-expanded:border-field aria-expanded:bg-raised"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={open ? `${id}-calendar` : undefined}
        title={labels.dialog}
        data-focus={`${focusKey}-week`}
        onClick={() => setOpen(!open)}
      >
        <span class={`flex shrink-0 text-muted ${compact ? '@max-[300px]:hidden' : '@max-[240px]:hidden'}`}>
          <Icon name="calendar" class="size-3.5" strokeWidth="2.2" />
        </span>
        <span class={`min-w-0 truncate ${compact ? '@max-[300px]:hidden' : '@max-[240px]:hidden'}`} aria-hidden="true" data-week-label="">
          {label}
        </span>
        {/* Navigation étroite (320 px avec « Aujourd'hui », barre latérale de Firefox) : mois abrégé */}
        <span class={`min-w-0 truncate ${compact ? '@min-[300px]:hidden' : '@min-[240px]:hidden'}`} aria-hidden="true">
          {weekLabel(week, locale, false, true)}
        </span>
        {busy && (
          <span class="flex shrink-0 text-muted motion-safe:animate-spin" data-week-busy="">
            <Icon name="spinner" class="size-3.5" strokeWidth="2.4" />
          </span>
        )}
        <span class={`flex shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}>
          <Icon name="chevronDown" class="size-3.5" strokeWidth="2.4" />
        </span>
      </button>
      <button type="button" class={NAV_BUTTON} aria-label={labels.next} title={labels.next} data-focus={`${focusKey}-next`} onClick={() => step(1)}>
        <Icon name="chevronRight" class="size-4" strokeWidth="2.4" />
      </button>
      {trailing}
      {/* Semaine affichée annoncée à chaque changement (‹ ›, calendrier) */}
      <span class="sr-only" aria-live="polite">
        {label}
      </span>
      {open && (
        <WeekCalendar
          id={`${id}-calendar`}
          week={week}
          firstDay={firstDay}
          locale={locale}
          labels={labels}
          now={now}
          root={root}
          onSelect={(chosen) => {
            close(true);
            if (chosen.key !== week.key) onSelect(chosen);
          }}
          onClose={close}
        />
      )}
    </div>
  );
}

interface WeekCalendarProps {
  id: string;
  week: WeekRange;
  firstDay: IsoWeekday;
  locale: string;
  labels: WeekPickerLabels;
  now: number;
  root: { current: HTMLElement | null };
  onSelect: (week: WeekRange) => void;
  onClose: (restore: boolean) => void;
}

/** Molette : déplacement cumulé qui change de mois, et silence qui termine un geste */
const WHEEL_THRESHOLD_PX = 30;
const WHEEL_GESTURE_MS = 300;

/** Calendrier ouvert : monté à l'ouverture (mois de la semaine affichée), démonté à la fermeture */
function WeekCalendar({ id, week, firstDay, locale, labels, now, root, onSelect, onClose }: WeekCalendarProps) {
  const [month, setMonth] = useState(() => monthOfWeek(week));
  const [active, setActive] = useState<WeekRange>(week);
  const list = useRef<HTMLDivElement>(null);
  const today = weekRange(now, firstDay);
  const rows = calendarWeeks(month, firstDay);

  // Échap : fermé, focus rendu au bouton ; pointeur enfoncé dehors : fermé sans focus
  useDismiss(root, () => onClose(true), { outside: false });
  useDismiss(root, () => onClose(false), { escape: false });
  useLayoutEffect(() => {
    list.current?.focus({ preventScroll: true });
  }, []);

  /** Semaine active : le mois affiché suit quand elle sort de ses 6 lignes */
  const activate = (next: WeekRange): void => {
    setActive(next);
    if (!calendarWeeks(month, firstDay).some((row) => row.key === next.key)) setMonth(monthOfWeek(next));
  };
  /** Autre mois : même quantième que la semaine active (aucun choix, aucune requête) */
  const changeMonth = (delta: number): void => {
    const day = sameDayInMonth(active.days[3] ?? active.start, delta);
    setMonth(new Date(day.getFullYear(), day.getMonth(), 1, 12));
    setActive(weekRange(day.getTime(), firstDay));
  };

  /** Molette : un mois par geste. Un pavé tactile envoie une rafale d'événements : la suite du geste (événements
   * espacés de moins de WHEEL_GESTURE_MS) est ignorée ; les petits déplacements se cumulent jusqu'au seuil */
  const wheel = useRef({ sum: 0, lockedUntil: 0 });
  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const now = Date.now();
    const state = wheel.current;
    if (now < state.lockedUntil) {
      state.lockedUntil = now + WHEEL_GESTURE_MS;
      return;
    }
    // Firefox peut compter en lignes (deltaMode 1) : ramené à des pixels
    state.sum += event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    if (Math.abs(state.sum) < WHEEL_THRESHOLD_PX) return;
    changeMonth(state.sum > 0 ? 1 : -1);
    state.sum = 0;
    state.lockedUntil = now + WHEEL_GESTURE_MS;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        activate(shiftWeek(active, event.key === 'ArrowDown' ? 1 : -1));
        break;
      case 'PageDown':
      case 'PageUp':
        changeMonth(event.key === 'PageDown' ? 1 : -1);
        break;
      case 'Home':
        setMonth(monthOfWeek(today));
        setActive(today);
        break;
      case 'Enter':
      case ' ':
        onSelect(active);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const weekdays = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  const longWeekdays = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  // Quantième seul, chiffres de la langue (« 18 », jamais « 18日 » : la cellule ne passe pas à la ligne)
  const days = new Intl.NumberFormat(locale);
  const optionId = (row: WeekRange): string => `${id}-${row.key}`;
  const isActive = (row: WeekRange): boolean => row.key === active.key;
  return (
    <div
      id={id}
      class="absolute inset-x-0 top-full z-20 mt-2 flex flex-col gap-1 rounded-menu border border-field bg-raised p-3 shadow-pop"
      role="dialog"
      aria-label={labels.dialog}
      data-week-calendar=""
      onWheel={onWheel}
      onFocusOut={(event) => {
        // Tab hors du calendrier : fermé (un clic dehors passe par useDismiss)
        const next = event.relatedTarget;
        if (next instanceof Node && !root.current?.contains(next)) onClose(false);
      }}
    >
      <div class="flex items-center justify-between gap-2">
        <button type="button" class={MONTH_BUTTON} aria-label={labels.prevMonth} title={labels.prevMonth} data-focus="calendar-prev-month" onClick={() => changeMonth(-1)}>
          <Icon name="chevronRight" class="size-4 rotate-180" strokeWidth="2.4" />
        </button>
        <span class="min-w-0 truncate text-body font-extrabold text-ink" aria-live="polite" data-calendar-month="">
          {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)}
        </span>
        <button type="button" class={MONTH_BUTTON} aria-label={labels.nextMonth} title={labels.nextMonth} data-focus="calendar-next-month" onClick={() => changeMonth(1)}>
          <Icon name="chevronRight" class="size-4" strokeWidth="2.4" />
        </button>
      </div>
      <div class="grid grid-cols-7 px-1 text-center text-section tracking-normal text-muted" aria-hidden="true">
        {(rows[0]?.days ?? []).map((day) => (
          <span key={day} class="flex h-7 items-center justify-center" title={longWeekdays.format(day)}>
            {weekdays.format(day)}
          </span>
        ))}
      </div>
      <div
        ref={list}
        class="group flex flex-col outline-none"
        role="listbox"
        aria-label={labels.dialog}
        aria-activedescendant={optionId(active)}
        tabIndex={0}
        data-focus="calendar-weeks"
        onKeyDown={onKeyDown}
      >
        {rows.map((row) => {
          const selected = row.key === week.key;
          return (
            <div
              key={row.key}
              id={optionId(row)}
              class={`grid h-9 shrink-0 cursor-pointer grid-cols-7 items-center rounded-pill border px-1 transition-colors hover:bg-line ${selected ? 'border-field bg-surface' : 'border-transparent'} ${isActive(row) ? 'bg-line group-focus-visible:outline-2 group-focus-visible:outline-offset-1 group-focus-visible:outline-lavender' : ''}`}
              role="option"
              aria-selected={selected ? 'true' : 'false'}
              aria-label={weekLabel(row, locale, true)}
              data-week={row.key}
              data-active={isActive(row) ? '' : undefined}
              onClick={() => onSelect(row)}
            >
              {row.days.map((day) => {
                const inMonth = new Date(day).getMonth() === month.getMonth();
                return (
                  <span key={day} class="flex justify-center" aria-hidden="true">
                    <span
                      class={`flex size-7 items-center justify-center rounded-pill text-body font-bold tabular-nums ${inMonth ? 'text-ink' : 'text-muted/55'} ${sameDay(day, now) ? 'ring-1 ring-lavender' : ''}`}
                      data-today={sameDay(day, now) ? '' : undefined}
                    >
                      {days.format(new Date(day).getDate())}
                    </span>
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
      <div class="mt-1 flex items-center gap-3 border-t border-line pt-2.5">
        <p class="m-0 min-w-0 flex-1 text-secondary text-muted">{labels.hint}</p>
        <button
          type="button"
          class="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-pill border border-field bg-transparent px-3 text-secondary font-extrabold whitespace-nowrap text-ink transition-colors hover:bg-line disabled:pointer-events-none disabled:opacity-50"
          disabled={today.key === week.key}
          data-focus="calendar-this-week"
          onClick={() => onSelect(today)}
        >
          {labels.thisWeek}
        </button>
      </div>
    </div>
  );
}
