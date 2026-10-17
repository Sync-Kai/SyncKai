// Menu « ⋯ » d'une série (maquettes PopupSeriesMenu, PopupSeriesMenuConfirm) : statuts (pause ; abandon et terminé
// confirmés en ligne), commentaire, « Ouvrir la fiche › » (AniList / MyAnimeList des comptes connectés), « Chercher
// sur… › » (plateformes actives sans lien connu), exclusion ou réactivation de la synchro, retrait de la liste (confirmé,
// phrase d'explication sous la question). Les actions restent celles de l'hôte (contrôleurs, messages) ; pendant un envoi,
// statuts, commentaire et retrait sont grisés, les liens restent ouverts. Popup « Mes séries », carte « Reprendre » et
// carte « Sur cette page » (maquette PopupPageMenu : statut actuel grisé « Statut actuel », sans commentaire ni
// recherche ; série absente des listes : ni statuts ni retrait) ; prévu pour le panneau latéral (aucune dépendance au popup).
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import type { StreamingPlatform } from '../platforms/ids';
import { PLATFORMS } from '../platforms/registry';
import type { EntryLink } from '../shared/entry-link';
import type { ListStatus, ListStatusChange } from '../shared/sync.types';
import { TRACKER_LABELS } from '../shared/tracker.types';
import { Menu, MenuConfirm, MenuItem, MenuSeparator, SubMenu } from './components/menu';
import type { IconName } from './icons';
import type { Tone } from './components/tone';

/** Recherche proposée sur une plateforme sans lien connu */
export interface SeriesSearch {
  platform: StreamingPlatform;
  url: string;
}

export interface SeriesMenuProps {
  /** Titre de la série : noms accessibles du bouton, du menu et des confirmations */
  title: string;
  /** Clé de la série : data-focus `more-<clé>`, `<option>-<clé>`, `confirm-yes-<clé>` / `confirm-no-<clé>` */
  focusKey: string;
  /** Action en cours sur la série : statuts, commentaire et retrait grisés */
  busy?: boolean;
  onStatus: (status: ListStatusChange) => void;
  /** « Commentaire… » ; absent : pas d'option */
  onNotes?: () => void;
  /** Fiches ouvrables (service préféré en tête) ; vide : pas de sous-menu */
  entryLinks: readonly EntryLink[];
  /** Recherches sur les plateformes actives sans lien (lecteur préféré en tête) ; vide : pas de sous-menu */
  searches: readonly SeriesSearch[];
  /** Synchro de la série : exclue (« Réactiver la synchro ») ou non ; `canExclude` faux : option grisée (aucune fiche AniList) */
  sync: { excluded: boolean; canExclude: boolean; onExclude: () => void; onInclude: () => void };
  /** « Retirer de la liste » confirmé : retirée de chaque compte connecté */
  onRemove: () => void;
  /** Série dans au moins une liste (défaut) ; faux : ni statuts, ni commentaire, ni retrait */
  inList?: boolean;
  /** Statut de la série : son option est grisée, « Statut actuel » à droite */
  currentStatus?: ListStatus | null;
  /** Ouvert au premier rendu (captures) */
  defaultOpen?: boolean;
}

type Confirm = 'DROPPED' | 'COMPLETED' | 'REMOVE';

const STATUS_LABELS = {
  PAUSED: 'watching.status.PAUSED',
  DROPPED: 'watching.status.DROPPED',
  COMPLETED: 'watching.status.COMPLETED',
} as const;

const STATUS_ICONS: Readonly<Record<ListStatusChange, { icon: IconName; tone: Tone }>> = {
  PAUSED: { icon: 'pause', tone: 'warn' },
  DROPPED: { icon: 'xCircle', tone: 'error' },
  COMPLETED: { icon: 'check', tone: 'ok' },
};

const CONFIRM_QUESTIONS = { DROPPED: 'watching.confirm.DROPPED', COMPLETED: 'watching.confirm.COMPLETED' } as const;

/** Contenu du menu ouvert : monté à l'ouverture, la confirmation en cours est oubliée à la fermeture */
function SeriesMenuItems({ title, focusKey: key, busy = false, onStatus, onNotes, entryLinks, searches, sync, onRemove, inList = true, currentStatus = null }: SeriesMenuProps) {
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  /** Option à refocaliser après une confirmation annulée */
  const restore = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (confirm !== null || restore.current === null) return;
    document.querySelector<HTMLElement>(`[data-menu-root="${key}"] [data-focus="${restore.current}"]`)?.focus({ preventScroll: true });
    restore.current = null;
  }, [confirm]);
  const cancel = (): void => {
    if (confirm !== null) restore.current = `${confirm}-${key}`;
    setConfirm(null);
  };

  const status = (value: ListStatusChange) => {
    const look = STATUS_ICONS[value];
    const current = currentStatus === value;
    if (value !== 'PAUSED' && confirm === value && !busy) {
      const action = t(STATUS_LABELS[value]);
      return (
        <MenuConfirm
          key={value}
          question={t(CONFIRM_QUESTIONS[value])}
          icon={look.icon}
          tone={look.tone}
          yes={{ label: t('watching.confirm.yes'), ariaLabel: t('watching.confirm.yesAria', { action }), tone: value === 'DROPPED' ? 'danger' : 'ok' }}
          no={{ label: t('watching.confirm.no'), ariaLabel: t('watching.confirm.noAria', { action }) }}
          focusKey={key}
          onYes={() => onStatus(value)}
          onNo={cancel}
        />
      );
    }
    return (
      <MenuItem
        key={value}
        icon={look.icon}
        tone={look.tone}
        disabled={busy || current}
        hint={current ? t('page.currentStatus') : undefined}
        focusKey={`${value}-${key}`}
        // Abandonner / Terminé : confirmés en ligne, le menu reste ouvert
        onSelect={value === 'PAUSED' ? () => onStatus(value) : () => setConfirm(value)}
        keepOpen={value !== 'PAUSED'}
      >
        {t(STATUS_LABELS[value])}
      </MenuItem>
    );
  };

  return (
    <>
      {inList && (
        <>
          {status('PAUSED')}
          {status('DROPPED')}
          {status('COMPLETED')}
          <MenuSeparator />
        </>
      )}
      {inList && onNotes && (
        <MenuItem icon="pencil" tone="info" disabled={busy} focusKey={`notes-${key}`} onSelect={onNotes}>
          {t('notes.menu')}
        </MenuItem>
      )}
      {entryLinks.length > 0 && (
        <SubMenu icon="external" label={t('watching.menu.openEntry')} focusKey={`site-${key}`}>
          {entryLinks.map((link) => (
            <MenuItem key={link.service} service={link.service} href={link.url} ariaLabel={t('page.openOn', { service: TRACKER_LABELS[link.service] })} focusKey={`site-${link.service}-${key}`}>
              {TRACKER_LABELS[link.service]}
            </MenuItem>
          ))}
        </SubMenu>
      )}
      {searches.length > 0 && (
        <SubMenu icon="search" label={t('watching.menu.searchOn')} focusKey={`search-${key}`}>
          {searches.map(({ platform, url }) => (
            <MenuItem
              key={platform}
              service={platform}
              href={url}
              ariaLabel={t('watching.searchOnAria', { title, platform: PLATFORMS[platform].label })}
              focusKey={`search-${platform}-${key}`}
            >
              {PLATFORMS[platform].label}
            </MenuItem>
          ))}
        </SubMenu>
      )}
      <MenuSeparator />
      {sync.excluded ? (
        <MenuItem icon="retry" tone="ok" focusKey={`include-${key}`} onSelect={sync.onInclude} tinted>
          {t('watching.resumeSync')}
        </MenuItem>
      ) : (
        <MenuItem icon="ban" disabled={!sync.canExclude} focusKey={`exclude-${key}`} onSelect={sync.onExclude}>
          {t('common.stopSyncSeries')}
        </MenuItem>
      )}
      {!inList ? null : confirm === 'REMOVE' && !busy ? (
        <MenuConfirm
          question={t('list.remove.confirm')}
          detail={t('list.remove.detail')}
          icon="trash"
          tone="error"
          yes={{ label: t('list.remove.yes'), ariaLabel: t('list.remove.yesAria', { title }), tone: 'danger' }}
          no={{ label: t('common.cancel'), ariaLabel: t('list.remove.noAria', { title }) }}
          focusKey={key}
          onYes={onRemove}
          onNo={cancel}
        />
      ) : (
        <MenuItem icon="trash" danger disabled={busy} focusKey={`REMOVE-${key}`} onSelect={() => setConfirm('REMOVE')} keepOpen>
          {t('list.remove')}
        </MenuItem>
      )}
    </>
  );
}

/** Bouton « ⋯ » d'une série et son menu (un seul ouvert à la fois : un clic ailleurs ferme le précédent) */
export function SeriesMenu(props: SeriesMenuProps) {
  return (
    <span class="flex shrink-0" data-menu-root={props.focusKey}>
      <Menu
        label={t('watching.moreActions', { title: props.title })}
        menuLabel={t('watching.menuAria', { title: props.title })}
        focusKey={`more-${props.focusKey}`}
        placement="top-full right-0 mt-1 w-max min-w-60 max-w-80"
        reveal
        defaultOpen={props.defaultOpen}
      >
        <SeriesMenuItems {...props} />
      </Menu>
    </span>
  );
}
