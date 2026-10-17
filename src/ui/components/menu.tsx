// Menu « ⋯ » des lignes (maquettes PopupSeriesMenu, PanelAgendaMenu) : options role="menuitem", focus itinérant
// (flèches en boucle, Début, Fin), Tab et Échap ferment (focus rendu au bouton), pointeur enfoncé dehors aussi
// (useDismiss : écouteurs du document posés seulement pendant l'ouverture). Sous-menus (« Ouvrir la fiche › »,
// « Chercher sur… › ») : liste déroulante sous l'entrée, ouverte au survol après un court délai d'intention, au clic,
// par → ou Entrée ; ← ou Échap la referment seule.
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

const MENU_ITEM = '[role="menuitem"]';

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
  children: ComponentChildren;
}

const TRIGGER =
  'inline-flex h-8 w-icon-button shrink-0 cursor-pointer items-center justify-center rounded-pill border border-transparent bg-transparent p-0 text-muted transition-colors hover:text-ink aria-expanded:border-field aria-expanded:bg-raised aria-expanded:text-ink';

export function Menu({ label, menuLabel, align = 'end', defaultOpen = false, focusKey, children }: MenuProps) {
  const [open, setOpen] = useState(defaultOpen);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = (restore: boolean): void => {
    setOpen(false);
    if (restore) trigger.current?.focus();
  };
  return (
    <div ref={root} class="relative inline-flex">
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
      >
        <Icon name="more" class="size-4" strokeWidth="2.6" />
      </button>
      {open && (
        <MenuPopup label={menuLabel ?? label} align={align} root={root} onClose={close}>
          {children}
        </MenuPopup>
      )}
    </div>
  );
}

interface MenuPopupProps {
  label: string;
  align: 'start' | 'end';
  root: RefObject<HTMLDivElement | null>;
  onClose: (restore: boolean) => void;
  children: ComponentChildren;
}

/** Menu ouvert : monté à l'ouverture, démonté à la fermeture (écouteurs et minuterie retirés avec lui) */
function MenuPopup({ label, align, root, onClose, children }: MenuPopupProps) {
  const menu = useRef<HTMLDivElement>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Focus à poser après le rendu qui ouvre ou ferme un sous-menu */
  const pendingFocus = useRef<{ sub: string; target: 'first' | 'entry' } | null>(null);

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
  };

  // Échap : ferme le sous-menu ouvert seul, sinon le menu (focus rendu au bouton) ; pointeur dehors : tout, sans focus
  useDismiss(root, () => (openSub !== null ? api.hideSub(true) : api.close(true)), { outside: false });
  useDismiss(root, () => api.close(false), { escape: false });

  // Ouverture : focus sur la première option ; démontage : minuterie de survol annulée
  useLayoutEffect(() => {
    if (menu.current) itemsOf(menu.current)[0]?.focus();
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
        class={`absolute top-full z-10 mt-1 flex w-60 flex-col rounded-menu border border-field bg-raised p-1.5 shadow-pop ${align === 'end' ? 'right-0' : 'left-0'}`}
        role="menu"
        aria-label={label}
        data-menu=""
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </MenuContext.Provider>
  );
}

const ITEM =
  'flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-control border-0 bg-transparent px-2.5 text-left text-body font-bold no-underline transition-colors hover:bg-line focus-visible:bg-line disabled:pointer-events-none disabled:opacity-50';

export interface MenuItemProps {
  /** Icône de tête ; `tone` la colore (danger, à vérifier…) */
  icon?: IconName;
  tone?: Tone;
  /** Logo de tête (fiche AniList / MyAnimeList, recherche sur une plateforme), à la place de l'icône */
  service?: TrackerId | StreamingPlatform;
  /** Action destructive : texte et icône en `danger` */
  danger?: boolean;
  /** Lien dans un nouvel onglet ; sinon bouton */
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  children: ComponentChildren;
}

export function MenuItem({ icon, tone, service, danger = false, href, onSelect, disabled = false, children }: MenuItemProps) {
  const api = useMenu();
  const sub = useContext(SubMenuContext);
  const className = `${ITEM} ${sub === null ? 'min-h-menu-item' : 'min-h-8'} ${danger ? 'text-danger' : 'text-ink'}`;
  const lead = service ? <ServiceLogo id={service} size="sm" /> : icon && <Icon name={icon} class={`size-4 ${tone ? TONE_TEXT[tone] : ''}`} strokeWidth="2.2" />;
  const shared = {
    class: className,
    role: 'menuitem' as const,
    tabIndex: -1,
    'data-danger': danger ? '' : undefined,
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
        api.close(true);
      }}
    >
      {lead}
      <span class="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

export interface SubMenuProps {
  label: string;
  icon?: IconName;
  children: ComponentChildren;
}

export function SubMenu({ label, icon, children }: SubMenuProps) {
  const api = useMenu();
  const id = useId();
  const open = api.openSub === id;
  return (
    <div class="relative" data-submenu="" onMouseEnter={() => api.hoverEnter(id)} onMouseLeave={() => api.hoverLeave(id)}>
      <button
        type="button"
        class={`${ITEM} min-h-menu-item text-ink ${open ? 'bg-surface' : ''}`}
        role="menuitem"
        tabIndex={-1}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        data-submenu-entry={id}
        // Clic (pointeur) : bascule, le focus reste sur l'entrée ; le clavier passe par onKeyDown du menu
        onClick={() => (open ? api.hideSub(false) : api.showSub(id, false))}
      >
        {icon && <Icon name={icon} class="size-4" strokeWidth="2.2" />}
        <span class="min-w-0 flex-1 truncate">{label}</span>
        <Icon name="chevronRight" class="size-3 text-muted" strokeWidth="2.4" />
      </button>
      {open && (
        <SubMenuContext.Provider value={id}>
          <div class="absolute top-full left-7 z-20 -mt-1 flex min-w-44 flex-col rounded-panel border border-field bg-surface p-1 shadow-pop" role="menu" aria-label={label} data-submenu-list={id}>
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
