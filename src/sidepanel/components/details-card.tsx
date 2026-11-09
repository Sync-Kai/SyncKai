// Carte à sections repliables de « En lecture » (maquettes PanelLecture, PanelFicheDetails, PanelCommentaire) :
// « Note et commentaire » (10 demi-étoiles dans une liste, puis la ligne du commentaire qui s'ouvre en éditeur),
// « Amis sur AniList » (personnes suivies qui ont la série, ui/components/friends-section.tsx), « Synopsis » (5 lignes,
// « Lire la suite » / « Réduire »), « Ordre de visionnage » (frise des entrées de la franchise, components/watch-order.tsx) et « Discussions » (épisode sur Reddit, forum MAL, AniList).
// Sections repliées par défaut ; leur état est gardé par la page du panneau (sidepanel.ts).
import { Fragment, type JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import type { EntryLinkContext } from '../../shared/entry-link';
import { normalizeListNotes, notesPreview } from '../../shared/list-notes';
import type { PageMediaInfo, PageMediaView } from '../../shared/page-media.types';
import { isLongDescription, malForumUrl, redditSearchUrl } from '../../shared/panel-media';
import type { PanelMedia } from '../../shared/panel-media.types';
import type { StreamingPlatform } from '../../shared/episode.types';
import { Collapsible } from '../../ui/components/collapsible';
import { aniListScore, FriendsSection, showsFriendsSection } from '../../ui/components/friends-section';
import { Icon } from '../../ui/components/icon';
import { NotesEditor } from '../../ui/components/notes-editor';
import { RatingBlock } from '../../ui/components/rating-block';
import { displayScore, primaryList } from '../../ui/page-media-view';
import type { FriendsView } from '../../ui/preact/use-friends';
import { pageKey } from '../now-playing-view';
import { newTabLabel } from './now-playing-hero';
import type { OrderState } from './now-playing-controller';
import { showsWatchOrder, WatchOrder } from './watch-order';

/** Sections repliables de la carte, dans l'ordre d'affichage */
export const PANEL_SECTIONS = ['order', 'notes', 'friends', 'synopsis', 'discussion'] as const;
export type PanelSection = (typeof PANEL_SECTIONS)[number];
export type PanelSectionsState = Readonly<Record<PanelSection, boolean>>;

export const CLOSED_SECTIONS: PanelSectionsState = { order: false, notes: false, friends: false, synopsis: false, discussion: false };

export interface DetailsCardProps {
  page: PageMediaInfo;
  view: PageMediaView;
  details: PanelMedia | null;
  /** Comptes connectés et fiche préférée : liens des suites */
  entryLinks: EntryLinkContext;
  /** Lecteur préféré : plateforme de « Regarder » */
  preferred: StreamingPlatform;
  /** Amis AniList de la fiche (useFriends, partagé avec la ligne de résumé de « Ta liste ») */
  friends: FriendsView;
  /** Suites sans liste (magasin des suites annoncées) : « + À regarder » seulement pour elles */
  unlistedSequels: ReadonlySet<number>;
  /** Ordre de visionnage de la franchise (contrôleur) et son rechargement après une erreur */
  order: OrderState;
  onRetryOrder: () => void;
  /** Action en cours ou fiche relue */
  busy: boolean;
  sections: PanelSectionsState;
  onToggle: (section: PanelSection, open: boolean) => void;
  onRate: (value: number) => void;
  /** Commentaire enregistré ; true si c'est fait */
  onSaveNotes: (notes: string) => Promise<boolean>;
}

const CHIP_LINK =
  'inline-flex h-8 min-w-0 items-center gap-1.5 rounded-pill border border-line bg-raised px-3 text-secondary font-extrabold text-ink no-underline transition-colors hover:border-field';

/**
 * Commentaire de la série (maquette PanelCommentaire) : ligne repliée « ✎ Commentaire » avec l'aperçu de sa première ligne
 * (ou « Ajouter un commentaire »), qui s'ouvre en éditeur (focus dans la zone de texte) ; enregistré, Annuler ou Échap :
 * repliée, focus rendu à la ligne. Hors liste : ligne désactivée et l'explication dessous.
 */
function NotesRow({ title, notes, unavailable, busy, onSave }: { title: string; notes: string | null; unavailable: string | null; busy: boolean; onSave: (notes: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  /** Commentaire enregistré ici, affiché replié jusqu'à la relecture de la fiche */
  const [savedHere, setSavedHere] = useState<string | null | undefined>(undefined);
  const toggle = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  useEffect(() => setSavedHere(undefined), [notes]);
  // Plus rien à commenter (série retirée de la liste) : éditeur replié
  useEffect(() => {
    if (unavailable !== null) setOpen(false);
  }, [unavailable]);
  useLayoutEffect(() => {
    if (open || !refocus.current) return;
    refocus.current = false;
    toggle.current?.focus({ preventScroll: true });
  }, [open]);
  const shown = savedHere !== undefined ? savedHere : notes;
  const close = (): void => {
    refocus.current = true;
    setOpen(false);
  };

  if (open && unavailable === null) {
    return (
      <NotesEditor
        title={title}
        notes={shown}
        loading={false}
        unavailable={null}
        busy={busy}
        focusKey="panel-notes"
        onClose={close}
        onSave={async (text) => {
          const ok = await onSave(text);
          if (ok) {
            const saved = normalizeListNotes(text);
            setSavedHere(saved.length > 0 ? saved : null);
            close();
          }
          return ok;
        }}
      />
    );
  }
  return (
    <div class="flex min-w-0 flex-col gap-1.5">
      <button
        ref={toggle}
        type="button"
        class="flex min-h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-panel border border-line bg-raised px-3 py-1.5 text-left transition-colors hover:border-field disabled:cursor-default disabled:opacity-60 disabled:hover:border-line"
        aria-expanded="false"
        aria-label={t('notes.editAria', { title })}
        disabled={unavailable !== null}
        data-focus="panel-notes-toggle"
        onClick={() => setOpen(true)}
      >
        <Icon name="pencil" class="size-3.5 text-lavender" />
        <span class="shrink-0 text-secondary font-extrabold text-muted">{t('notes.title')}</span>
        <span class={`min-w-0 flex-1 truncate text-secondary ${shown ? 'font-bold text-ink' : 'text-muted'}`} title={shown ?? undefined}>
          {shown ? notesPreview(shown) : t('notes.add')}
        </span>
      </button>
      {unavailable !== null && (
        <p class="m-0 text-secondary text-muted" role="note">
          {unavailable}
        </p>
      )}
    </div>
  );
}

/** Synopsis : 5 lignes, « Lire la suite » / « Réduire » quand il est long ; replié à chaque nouvelle page */
function Synopsis({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = isLongDescription(text);
  return (
    <div class="flex flex-col gap-1.5">
      {/* Texte brut (sanitizeDescription), sauts de ligne conservés */}
      <p id="sk-synopsis-text" class={`m-0 text-secondary leading-4.5 whitespace-pre-line text-ink ${long && !expanded ? 'line-clamp-5' : ''}`}>
        {text}
      </p>
      {long && (
        <button
          type="button"
          class="cursor-pointer self-start border-0 bg-transparent p-0 text-secondary font-extrabold text-sakura underline underline-offset-2"
          aria-expanded={expanded ? 'true' : 'false'}
          aria-controls="sk-synopsis-text"
          data-focus="panel-synopsis"
          onClick={() => setExpanded(!expanded)}
        >
          {t(expanded ? 'panel.nowPlaying.readLess' : 'panel.nowPlaying.readMore')}
        </button>
      )}
    </div>
  );
}

function Discussion({ page, view, details }: { page: PageMediaInfo; view: PageMediaView; details: PanelMedia | null }) {
  // Liens d'épisode seulement sur une page de lecture dont l'épisode AniList est connu
  const episode = page.kind === 'episode' ? view.episodeProgress : null;
  const reddit = redditSearchUrl(details?.romajiTitle ?? null, episode);
  const mal = malForumUrl(view.media.idMal, episode);
  const links = [
    reddit !== null && { href: reddit, label: t('panel.nowPlaying.reddit') },
    mal !== null && { href: mal, label: t('panel.nowPlaying.malForum') },
    { href: view.media.siteUrl, label: 'AniList' },
  ].filter((link) => link !== false);
  return (
    <div class="flex flex-wrap gap-1.5">
      {links.map((link) => (
        <a key={link.href} class={CHIP_LINK} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={newTabLabel(link.label)}>
          <span class="truncate">{link.label}</span>
          <Icon name="external" class="size-3 shrink-0" />
        </a>
      ))}
    </div>
  );
}

export function DetailsCard({ page, view, details, entryLinks, preferred, friends, unlistedSequels, order, onRetryOrder, busy, sections, onToggle, onRate, onSaveNotes }: DetailsCardProps) {
  const { media } = view;
  const primary = primaryList(view.lists);
  const parts: { key: PanelSection; node: JSX.Element }[] = [];
  if (showsWatchOrder(order, media.mediaId)) {
    parts.push({
      key: 'order',
      node: (
        <WatchOrder
          order={order}
          currentId={media.mediaId}
          links={entryLinks}
          preferred={preferred}
          unlistedSequels={unlistedSequels}
          open={sections.order}
          onToggle={(open) => onToggle('order', open)}
          onRetry={onRetryOrder}
        />
      ),
    });
  }
  // Note et commentaire : avec au moins un compte connecté (commentaire désactivé, avec l'explication, hors liste)
  if (view.lists.length > 0) {
    parts.push({
      key: 'notes',
      node: (
        <Collapsible variant="row" title={t('panel.nowPlaying.ratingNotes')} open={sections.notes} onToggle={(open) => onToggle('notes', open)} focusKey="panel-section-notes">
          <div class="flex flex-col gap-3">
            {primary && <RatingBlock label={t('page.yourRating')} sliderLabel={t('rating.groupLabel', { title: media.title })} value={displayScore(view.lists) ?? 0} disabled={busy} onRate={onRate} focusKey="page-rate" labelHidden />}
            <NotesRow key={media.mediaId} title={media.title} notes={primary?.notes ?? null} unavailable={primary ? null : t('notes.notInList')} busy={busy} onSave={onSaveNotes} />
          </div>
        </Collapsible>
      ),
    });
  }
  // Amis AniList : section absente sans ami qui a la série ni session AniList (et repliée tant qu'ils se chargent)
  if (showsFriendsSection(friends.state, sections.friends)) {
    parts.push({
      key: 'friends',
      node: (
        <Collapsible
          variant="row"
          title={t('friends.title')}
          count={friends.summary?.total}
          open={sections.friends}
          onToggle={(open) => onToggle('friends', open)}
          focusKey="panel-section-friends"
        >
          <FriendsSection key={media.mediaId} friends={friends} yourScore={aniListScore(view.lists)} episodes={media.episodes} siteUrl={media.siteUrl} />
        </Collapsible>
      ),
    });
  }
  if (details?.description) {
    parts.push({
      key: 'synopsis',
      node: (
        <Collapsible variant="row" title={t('panel.nowPlaying.synopsis')} open={sections.synopsis} onToggle={(open) => onToggle('synopsis', open)} focusKey="panel-section-synopsis">
          <Synopsis key={pageKey(page)} text={details.description} />
        </Collapsible>
      ),
    });
  }
  parts.push({
    key: 'discussion',
    node: (
      <Collapsible variant="row" title={t('panel.nowPlaying.discussion')} open={sections.discussion} onToggle={(open) => onToggle('discussion', open)} focusKey="panel-section-discussion">
        <Discussion page={page} view={view} details={details} />
      </Collapsible>
    ),
  });
  return (
    <section class="flex flex-col rounded-card border border-line bg-surface" data-details-card="">
      {parts.map(({ key, node }, index) => (
        <Fragment key={key}>
          {index > 0 && <span class="mx-3 h-px bg-line" aria-hidden="true" />}
          {node}
        </Fragment>
      ))}
    </section>
  );
}
