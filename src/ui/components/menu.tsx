// Menu « ⋯ » des lignes (maquettes PopupSeriesMenu, PanelAgendaMenu) : options role="menuitem", focus itinérant
// (flèches en boucle, Début, Fin), Tab et Échap ferment (focus rendu au bouton), pointeur enfoncé dehors aussi
// (useDismiss : écouteurs du document posés seulement pendant l'ouverture). Sous-menus (« Ouvrir la fiche › »,
// « Chercher sur… › ») : liste déroulante sous l'entrée, ouverte au survol après un court délai d'intention, au clic,
// par → ou Entrée ; ← ou Échap la referment seule. Confirmation en ligne (MenuConfirm : « Abandonner ? Oui / Non ») :
// l'option devient la question, focus sur « Non », Échap l'annule sans fermer le menu.
import { createContext, type ComponentChildren, type RefObject } from 'preact';
import { useContext, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { StreamingPlatform } from '../../platforms/ids';
import type { TrackerId } from '../../shared/tracker.types';
import type { IconName } from '../icons';
import { useDismiss } from '../preact/hooks';
import { Icon } from './icon';
import { ServiceLogo } from './service-logo';
import { TONE_TEXT, type Tone } from './tone';

/** Survol d'une entrée de sous-menu avant son ouverture (intention : un passage du pointeur n'ouvre rien) */
export const SUBMENU_OPEN_DELAY_MS = 150;
/** Sortie du pointeur avant la fermeture (le temps de rejoindre la liste en diagonale) */
export const SUBMENU_CLOSE_DELAY_MS = 300;

const MENU_ITEM = '[role="menuitem"], [role="menuitemradio"]';

interface MenuApi {
  /** Ferme tout le menu ; `restore` : focus rendu au bouton « ⋯ » */
  close(restore: boolean): void;
  openSub: string | null;
  /** Ouvre un sous-menu ; `focusFirst` : focus sur sa première option (clavier) */
  showSub(id: string, focusFirst: boolean): void;
  /** Ferme le sous-menu ouvert ; `focusEntry` : focus rendu à son entrée */
  hideSub(focusEntry: boolean): void;
  /** Pointeur entré sur une entrée de sous-menu (id) ou sur une option du menu principal (null) */
  hoverEnter(id: string | null): void;
  hoverLeave(id: string): void;
  /** Confirmation affichée : Échap l'annule (null : Échap ferme le menu) */
  setEscape(cancel: (() => void) | null): void;
}

const MenuContext = createContext<MenuApi | null>(null);
/** Sous-menu englobant d'une option : son survol garde le sous-menu ouvert */
const SubMenuContext = createContext<string | null>(null);

function useMenu(): MenuApi {
  const api = useContext(MenuContext);
  if (!api) throw new Error('MenuItem / SubMenu hors d’un <Menu>');
  return api;
}

/** Options actives d'un menu (pas celles de ses sous-menus) */
function itemsOf(menu: Element): HTMLElement[] {
  return [...menu.querySelectorAll<HTMLElement>(MENU_ITEM)].filter((item) => item.closest('[role="menu"]') === menu && !item.matches(':disabled'));
}

export interface MenuProps {
  /** Nom du bouton « ⋯ » (aria-label et infobulle) : « Plus d'actions pour Dandadan » */
  label: string;
  /** Nom du menu (défaut : `label`) */
  menuLabel?: string;
  /** Côté d'alignement sous le bouton (défaut : fin, le menu s'ouvre vers la gauche) */
  align?: 'start' | 'end';
  /** Ouvert au premier rendu (galerie, captures) */
  defaultOpen?: boolean;
  focusKey?: string;
  /** Position et largeur du menu ouvert (voir MenuPopupProps) */
  placement?: string;
  /** Menu ramené dans la zone visible à l'ouverture (dernières lignes d'une liste qui défile) */
  reveal?: boolean;
  /** Classes de placement du conteneur (jamais de couleur) */
  class?: string;
  children: ComponentChildren;
}

const TRIGGER =
  'inline-flex h-8 w-icon-button shrink-0 cursor-pointer items-center justify-center rounded-pill border border-transparent bg-transparent p-0 text-muted transition-colors hover:text-ink aria-expanded:border-field aria-expanded:bg-raised aria-expanded:text-ink';

export function Menu({ label, menuLabel, align = 'end', defaultOpen = false, focusKey, placement, reveal = false, class: extra, children }: MenuProps) {
  const [open, setOpen] = useState(defaultOpen);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = (restore: boolean): void => {
    setOpen(false);
    if (restore) trigger.current?.focus();
  };
  return (
    <div ref={root} class={extra ? `relative inline-flex ${extra}` : 'relative inline-flex'}>
      <button
        ref={trigger}
        type="button"
        class={TRIGGER}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        data-focus={focusKey}
        data-menu-trigger=""
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          // Flèches sur le bouton fermé : ouverture directe du menu
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Icon name="more" class="size-4" strokeWidth="2.6" />
      </button>
      {open && (
        <MenuPopup label={menuLabel ?? label} align={align} placement={placement} reveal={reveal} root={root} onClose={close}>
          {children}
        </MenuPopup>
      )}
    </div>
  );
}

/** Ancêtre qui fait défiler `el` (zone principale du popup, panneau), sinon la fenêtre */
function scrollBox(el: Element): { top: number; bottom: number } {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      const box = node.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom };
    }
  }
  return { top: 0, bottom: window.innerHeight };
}

/** Un menu de `height` px tient au-dessus de `anchor` mais pas en dessous, dans sa zone de défilement visible */
function opensUpward(anchor: Element | null, height: number): boolean {
  if (!anchor || height <= 0) return false;
  const box = scrollBox(anchor);
  const rect = anchor.getBoundingClientRect();
  return box.bottom - rect.bottom < height + 8 && rect.top - box.top >= height + 8;
}

/** Placement ouvert vers le bas (`top-full`, `mt-*`) retourné vers le haut (`bottom-full`, `mb-*`) */
function flipUp(placement: string, up: boolean): string {
  if (!up) return placement;
  return placement.replace(/\btop-full\b/, 'bottom-full').replace(/\bmt-(\S+)/, 'mb-$1');
}

export interface MenuPopupProps {
  label: string;
  align: 'start' | 'end';
  /** Position et largeur à la place du défaut (sous le bouton, 240 px) : menu du compte au-dessus de la barre d'état */
  placement?: string;
  /** Contenu non interactif décrit au lecteur d'écran à l'ouverture (aria-describedby) */
  describedBy?: string;
  /** Menu ramené dans la zone visible à l'ouverture */
  reveal?: boolean;
  root: RefObject<Element | null>;
  onClose: (restore: boolean) => void;
  children: ComponentChildren;
}

/**
 * Menu ouvert : monté à l'ouverture, démonté à la fermeture (écouteurs et minuterie retirés avec lui). `root` contient
 * le bouton qui l'ouvre (son clic ne compte pas comme un clic extérieur)
 */
export function MenuPopup({ label, align, placement, describedBy, reveal = false, root, onClose, children }: MenuPopupProps) {
  const menu = useRef<HTMLDivElement>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  /** Ouvert vers le haut : pas la place sous le bouton dans la zone de défilement, mais au-dessus */
  const [up, setUp] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Focus à poser après le rendu qui ouvre ou ferme un sous-menu */
  const pendingFocus = useRef<{ sub: string; target: 'first' | 'entry' } | null>(null);
  /** Annulation de la confirmation affichée (Échap) */
  const cancelConfirm = useRef<(() => void) | null>(null);

  const clearTimer = (): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const later = (delay: number, run: () => void): void => {
    clearTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      run();
    }, delay);
  };
  const subEntry = (id: string): HTMLElement | null => menu.current?.querySelector<HTMLElement>(`[data-submenu-entry="${id}"]`) ?? null;

  const api: MenuApi = {
    close: (restore) => {
      clearTimer();
      onClose(restore);
    },
    openSub,
    showSub: (id, focusFirst) => {
      clearTimer();
      pendingFocus.current = focusFirst ? { sub: id, target: 'first' } : null;
      setOpenSub(id);
    },
    hideSub: (focusEntry) => {
      clearTimer();
      if (openSub === null) return;
      // Focus dans la liste qui disparaît : rendu à l'entrée, sinon il tomberait sur <body>
      const inside = document.activeElement instanceof Element && document.activeElement.closest(`[data-submenu-list="${openSub}"]`) !== null;
      pendingFocus.current = focusEntry || inside ? { sub: openSub, target: 'entry' } : null;
      setOpenSub(null);
    },
    hoverEnter: (id) => {
      if (id !== null && id === openSub) clearTimer();
      else if (id !== null) later(SUBMENU_OPEN_DELAY_MS, () => api.showSub(id, false));
      else if (openSub !== null) later(SUBMENU_CLOSE_DELAY_MS, () => api.hideSub(false));
      else clearTimer();
    },
    hoverLeave: (id) => {
      if (id === openSub) later(SUBMENU_CLOSE_DELAY_MS, () => api.hideSub(false));
      else clearTimer();
    },
    setEscape: (cancel) => {
      cancelConfirm.current = cancel;
    },
  };

  // Échap : annule la confirmation affichée, sinon ferme le sous-menu ouvert seul, sinon le menu (focus rendu au
  // bouton) ; pointeur dehors : tout, sans focus
  useDismiss(root, () => (cancelConfirm.current ? cancelConfirm.current() : openSub !== null ? api.hideSub(true) : api.close(true)), { outside: false });
  useDismiss(root, () => api.close(false), { escape: false });

  // Ouverture : focus sur le choix coché (menu de choix exclusifs), sinon la première option ; démontage : minuterie de
  // survol annulée
  useLayoutEffect(() => {
    if (menu.current) {
      const items = itemsOf(menu.current);
      (items.find((item) => item.getAttribute('aria-checked') === 'true') ?? items[0])?.focus({ preventScroll: reveal });
      // Dernières lignes d'une liste : le menu s'ouvre vers le haut s'il y tient, sinon il est ramené dans la zone
      // visible (la liste défile)
      if (reveal) {
        const flip = opensUpward(root.current, menu.current.offsetHeight);
        if (flip) setUp(true);
        else menu.current.scrollIntoView?.({ block: 'nearest' });
      }
    }
    return clearTimer;
  }, []);

  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    pendingFocus.current = null;
    if (!pending) return;
    if (pending.target === 'entry') subEntry(pending.sub)?.focus();
    else {
      const list = menu.current?.querySelector(`[data-submenu-list="${pending.sub}"]`);
      if (list) itemsOf(list)[0]?.focus();
    }
  }, [openSub]);

  const onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const current = target?.closest('[role="menu"]');
    if (!target || !current) return;
    const entry = target.dataset.submenuEntry;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Home':
      case 'End': {
        event.preventDefault();
        const items = itemsOf(current);
        const index = items.indexOf(target);
        const last = items.length - 1;
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : event.key === 'ArrowDown' ? (index >= last ? 0 : index + 1) : index <= 0 ? last : index - 1;
        items[next]?.focus();
        break;
      }
      case 'Tab':
        event.preventDefault();
        api.close(true);
        break;
      case 'ArrowRight':
      case 'Enter':
      case ' ':
        // Entrée de sous-menu : ouverture au clavier, focus sur la première option (clic natif annulé)
        if (entry === undefined) return;
        event.preventDefault();
        api.showSub(entry, true);
        break;
      case 'ArrowLeft':
        if (current === menu.current) return;
        event.preventDefault();
        api.hideSub(true);
        break;
      default:
    }
  };

  return (
    <MenuContext.Provider value={api}>
      <div
        ref={menu}
        class={`absolute z-10 flex flex-col rounded-menu border border-field bg-raised p-1.5 shadow-pop ${flipUp(placement ?? `top-full mt-1 w-60 ${align === 'end' ? 'right-0' : 'left-0'}`, up)}`}
        role="menu"
        aria-label={label}
        aria-describedby={describedBy}
        data-menu=""
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </MenuContext.Provider>
  );
}

const ITEM =
  'flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-control border-0 px-2.5 text-left text-body no-underline transition-colors hover:bg-line focus-visible:bg-line disabled:pointer-events-none disabled:opacity-50';

export interface MenuItemProps {
  /** Icône de tête ; `tone` la colore (danger, à vérifier…) */
  icon?: IconName;
  tone?: Tone;
  /** Logo de tête (fiche AniList / MyAnimeList, recherche sur une plateforme), à la place de l'icône */
  service?: TrackerId | StreamingPlatform;
  /** Action destructive : texte et icône en `danger` */
  danger?: boolean;
  /** Action mise en avant (« Reconnecter » d'une session expirée) : fond `line`, texte 800, icône sakura */
  emphasis?: boolean;
  /** Lien dans un nouvel onglet ; sinon bouton */
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  /**
   * Choix exclusif (tri) : role="menuitemradio" et aria-checked ; coché : fond `surface`, texte 800 et coche finale,
   * sinon texte `muted`
   */
  checked?: boolean;
  /** Nom accessible quand le texte visible ne suffit pas (« Chercher Dandadan sur ADN ») */
  ariaLabel?: string;
  /** Clé data-focus (tests, focus rendu après une confirmation annulée) */
  focusKey?: string;
  /** Le menu reste ouvert après le choix (l'option affiche une confirmation en ligne) */
  keepOpen?: boolean;
  /** Le ton colore aussi le texte (« Réactiver la synchro » en mint) */
  tinted?: boolean;
  /** Mention discrète en fin d'option (« Statut actuel » d'un statut grisé) */
  hint?: string;
  /** Seconde ligne sous le libellé, `muted`, qui passe à la ligne sans élargir le menu (« 19:45 Netflix · délai par défaut ») */
  description?: string;
  children: ComponentChildren;
}

export function MenuItem({ icon, tone, service, danger = false, emphasis = false, href, onSelect, disabled = false, checked, ariaLabel, focusKey, keepOpen = false, tinted = false, hint, description, children }: MenuItemProps) {
  const api = useMenu();
  const sub = useContext(SubMenuContext);
  const radio = checked !== undefined;
  const look = radio ? (checked ? 'bg-surface font-extrabold text-ink' : 'bg-transparent font-bold text-muted hover:text-ink') : `${danger ? 'text-danger' : tinted && tone ? TONE_TEXT[tone] : 'text-ink'} ${emphasis ? 'bg-line font-extrabold' : 'bg-transparent font-bold'}`;
  const className = `${ITEM} ${sub === null ? 'min-h-menu-item' : 'min-h-8'} ${look}`;
  const lead = service ? <ServiceLogo id={service} size="sm" /> : icon && <Icon name={icon} class={`size-4 ${tone ? TONE_TEXT[tone] : emphasis ? 'text-sakura' : ''}`} strokeWidth="2.2" />;
  const shared = {
    class: className,
    role: radio ? ('menuitemradio' as const) : ('menuitem' as const),
    'aria-checked': radio ? (checked ? ('true' as const) : ('false' as const)) : undefined,
    tabIndex: -1,
    'data-danger': danger ? '' : undefined,
    'aria-label': ariaLabel,
    'data-focus': focusKey,
    onMouseEnter: () => api.hoverEnter(sub),
  };
  if (href !== undefined) {
    return (
      // Lien : la navigation suit son cours, le menu se ferme
      <a {...shared} href={href} target="_blank" rel="noopener noreferrer" onClick={() => api.close(true)}>
        {lead}
        <span class="min-w-0 flex-1 truncate">{children}</span>
        <Icon name="external" class="size-3 text-muted" strokeWidth="2.4" />
      </a>
    );
  }
  return (
    <button
      {...shared}
      type="button"
      disabled={disabled}
      onClick={() => {
        onSelect?.();
        if (!keepOpen) api.close(true);
      }}
    >
      {lead}
      {description === undefined ? (
        <span class="min-w-0 flex-1 truncate">{children}</span>
      ) : (
        <span class="flex min-w-0 flex-1 flex-col py-1.5">
          <span class="truncate">{children}</span>
          {/* w-0 + min-w-full : la ligne prend la largeur du menu sans l'élargir */}
          <span class="w-0 min-w-full text-secondary font-semibold text-muted" data-menu-description="">
            {description}
          </span>
        </span>
      )}
      {hint !== undefined && (
        <span class="shrink-0 text-section font-bold tracking-normal text-muted" data-menu-hint="">
          {hint}
        </span>
      )}
      {checked && (
        <span class="flex shrink-0" data-menu-check="">
          <Icon name="check" class="size-3.5" strokeWidth="2.4" />
        </span>
      )}
    </button>
  );
}

export interface SubMenuProps {
  label: string;
  icon?: IconName;
  /** Clé data-focus de l'entrée */
  focusKey?: string;
  children: ComponentChildren;
}

export function SubMenu({ label, icon, focusKey, children }: SubMenuProps) {
  const api = useMenu();
  const id = useId();
  const open = api.openSub === id;
  const list = useRef<HTMLDivElement>(null);
  const [up, setUp] = useState(false);
  // Pas la place sous l'entrée (bas de la zone de défilement) : la liste s'ouvre vers le haut
  useLayoutEffect(() => {
    if (open && list.current) setUp(opensUpward(list.current.parentElement, list.current.offsetHeight));
  }, [open]);
  return (
    <div class="relative" data-submenu="" onMouseEnter={() => api.hoverEnter(id)} onMouseLeave={() => api.hoverLeave(id)}>
      <button
        type="button"
        class={`${ITEM} min-h-menu-item font-bold text-ink ${open ? 'bg-surface' : 'bg-transparent'}`}
        role="menuitem"
        tabIndex={-1}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        data-submenu-entry={id}
        data-focus={focusKey}
        // Clic (pointeur) : bascule, le focus reste sur l'entrée ; le clavier passe par onKeyDown du menu
        onClick={() => (open ? api.hideSub(false) : api.showSub(id, false))}
      >
        {icon && <Icon name={icon} class="size-4" strokeWidth="2.2" />}
        <span class="min-w-0 flex-1 truncate">{label}</span>
        <Icon name="chevronRight" class="size-3 text-muted" strokeWidth="2.4" />
      </button>
      {open && (
        <SubMenuContext.Provider value={id}>
          <div ref={list} class={`absolute ${up ? 'bottom-full -mb-1' : 'top-full -mt-1'} left-7 z-20 flex min-w-44 flex-col rounded-panel border border-field bg-surface p-1 shadow-pop`} role="menu" aria-label={label} data-submenu-list={id}>
            {children}
          </div>
        </SubMenuContext.Provider>
      )}
    </div>
  );
}

/** Séparateur entre deux groupes d'options */
export function MenuSeparator() {
  return <div class="mx-1.5 my-1 h-px shrink-0 bg-line" role="separator" />;
}

export interface MenuConfirmProps {
  /** Question à la place de l'option (« Abandonner ? ») */
  question: string;
  /** Phrase d'explication sous la question (« Retirée de chaque compte connecté… ») : question, phrase et boutons empilés */
  detail?: string;
  icon?: IconName;
  tone?: Tone;
  yes: { label: string; ariaLabel?: string; tone: 'ok' | 'danger' };
  no: { label: string; ariaLabel?: string };
  /** Suffixe des clés data-focus : `confirm-yes-<clé>`, `confirm-no-<clé>` */
  focusKey?: string;
  /** Confirmé : l'action, puis le menu se ferme (focus rendu au bouton « ⋯ ») */
  onYes: () => void;
  /** « Non », Échap : retour à l'option (l'hôte y rend le focus) */
  onNo: () => void;
}

const CONFIRM_BTN = 'inline-flex h-7 shrink-0 cursor-pointer items-center rounded-pill px-3 text-secondary font-extrabold transition-colors';
const CONFIRM_YES: Readonly<Record<MenuConfirmProps['yes']['tone'], string>> = {
  ok: 'border-0 bg-mint text-on-fill hover:brightness-105',
  danger: 'border-0 bg-danger text-on-fill hover:brightness-105',
};

/**
 * Confirmation en ligne dans un menu : la ligne devient la question, « Oui » / « Non » restent des options du menu
 * (flèches), focus sur « Non » à l'affichage (une action irréversible ne se valide pas d'un double Entrée), Échap annule
 */
export function MenuConfirm({ question, detail, icon, tone, yes, no, focusKey, onYes, onNo }: MenuConfirmProps) {
  const api = useMenu();
  const noButton = useRef<HTMLButtonElement>(null);
  const latestNo = useRef(onNo);
  latestNo.current = onNo;
  useLayoutEffect(() => {
    noButton.current?.focus({ preventScroll: true });
    // Confirmation plus haute que l'option (retrait : trois lignes) : ramenée dans la zone visible en bas de liste
    noButton.current?.closest('[data-menu-confirm]')?.scrollIntoView?.({ block: 'nearest' });
    api.setEscape(() => latestNo.current());
    return () => api.setEscape(null);
  }, []);
  const lead = icon && <Icon name={icon} class={`size-4 shrink-0 ${tone ? TONE_TEXT[tone] : ''}`} strokeWidth="2.2" />;
  const buttons = (
    <span class="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        class={`${CONFIRM_BTN} ${CONFIRM_YES[yes.tone]}`}
        role="menuitem"
        tabIndex={-1}
        aria-label={yes.ariaLabel}
        data-focus={focusKey && `confirm-yes-${focusKey}`}
        onMouseEnter={() => api.hoverEnter(null)}
        onClick={() => {
          onYes();
          api.close(true);
        }}
      >
        {yes.label}
      </button>
      <button
        ref={noButton}
        type="button"
        class={`${CONFIRM_BTN} border border-field bg-transparent text-ink hover:bg-line`}
        role="menuitem"
        tabIndex={-1}
        aria-label={no.ariaLabel}
        data-focus={focusKey && `confirm-no-${focusKey}`}
        onMouseEnter={() => api.hoverEnter(null)}
        onClick={onNo}
      >
        {no.label}
      </button>
    </span>
  );
  if (detail === undefined) {
    return (
      <div class="flex min-h-menu-item min-w-0 items-center gap-2.5 rounded-control bg-surface px-2.5" role="group" aria-label={question} data-menu-confirm="">
        {lead}
        <span class="min-w-0 flex-1 truncate text-body font-extrabold text-ink" title={question}>
          {question}
        </span>
        {buttons}
      </div>
    );
  }
  return (
    <div class="flex min-w-0 flex-col gap-1.5 rounded-control bg-surface px-2.5 py-2" role="group" aria-label={question} data-menu-confirm="">
      <span class="flex min-w-0 items-center gap-2.5">
        {lead}
        <span class={`min-w-0 flex-1 text-body font-extrabold ${tone === 'error' ? 'text-danger' : 'text-ink'}`}>{question}</span>
      </span>
      {/* w-0 + min-w-full : la phrase prend la largeur du menu sans l'élargir */}
      <span class="w-0 min-w-full ps-6.5 text-secondary text-muted">{detail}</span>
      <span class="flex justify-end">{buttons}</span>
    </div>
  );
}
