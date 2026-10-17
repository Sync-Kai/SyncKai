// Carte à sections repliables de « En lecture » (maquettes PanelLecture, PanelFicheDetails, PanelCommentaire) :
// « Note et commentaire » (10 demi-étoiles dans une liste, puis la ligne du commentaire qui s'ouvre en éditeur),
// « Synopsis » (5 lignes, « Lire la suite » / « Réduire »), « Suites et histoires liées » (étiquette · format, jaquette,
// titre vers la fiche, « Regarder » sur le lecteur préféré) et « Discussions » (épisode sur Reddit, forum MAL, AniList).
// Sections repliées par défaut ; leur état est gardé par la page du panneau (sidepanel.ts).
import { Fragment, type JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { PLATFORMS } from '../../platforms/registry';
import { entryLink, type EntryLinkContext } from '../../shared/entry-link';
import { normalizeListNotes, notesPreview } from '../../shared/list-notes';
import type { PageMediaInfo, PageMediaView } from '../../shared/page-media.types';
import { isLongDescription, malForumUrl, redditSearchUrl } from '../../shared/panel-media';
import type { PanelMedia, PanelRelation } from '../../shared/panel-media.types';
import type { StreamingPlatform } from '../../shared/episode.types';
import { TRACKER_LABELS } from '../../shared/tracker.types';
import { choosePlatformLink } from '../../shared/watching';
import { Collapsible } from '../../ui/components/collapsible';
import { Cover } from '../../ui/components/cover';
import { Icon } from '../../ui/components/icon';
import { NotesEditor } from '../../ui/components/notes-editor';
import { RatingBlock } from '../../ui/components/rating-block';
import { ServiceLogo } from '../../ui/components/service-logo';
import { displayScore, primaryList } from '../../ui/page-media-view';
import { pageKey, relationLabel } from '../now-playing-view';
import { newTabLabel } from './now-playing-hero';

/** Sections repliables de la carte, dans l'ordre d'affichage */
export const PANEL_SECTIONS = ['notes', 'synopsis', 'relations', 'discussion'] as const;
export type PanelSection = (typeof PANEL_SECTIONS)[number];
export type PanelSectionsState = Readonly<Record<PanelSection, boolean>>;

export const CLOSED_SECTIONS: PanelSectionsState = { notes: false, synopsis: false, relations: false, discussion: false };

export interface DetailsCardProps {
  page: PageMediaInfo;
  view: PageMediaView;
  details: PanelMedia | null;
  /** Comptes connectés et fiche préférée : liens des suites */
  entryLinks: EntryLinkContext;
  /** Lecteur préféré : plateforme de « Regarder » */
  preferred: StreamingPlatform;
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

function Relation({ relation, links, preferred }: { relation: PanelRelation; links: EntryLinkContext; preferred: StreamingPlatform }) {
  const label = relationLabel(relation.relationType);
  const watch = choosePlatformLink(relation, preferred);
  // Fiche AniList toujours connue : repli sur sa page si MyAnimeList est préférée sans équivalent
  const site = entryLink({ mediaId: relation.mediaId, malId: relation.idMal }, links) ?? { service: 'anilist' as const, url: relation.siteUrl };
  return (
    <li class="flex min-w-0 items-center gap-2.5">
      <a
        class="group flex min-w-0 flex-1 items-center gap-2.5 rounded-control text-ink no-underline"
        href={site.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={newTabLabel(t('common.labelValue', { label, value: t('entry.openAria', { title: relation.title, service: TRACKER_LABELS[site.service] }) }))}
        data-focus={`relation-entry-${relation.mediaId}`}
      >
        <Cover size="agenda" title={relation.title} src={relation.coverUrl} />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="text-section text-lavender uppercase">{[label, relation.format].filter(Boolean).join(' · ')}</span>
          <span class="line-clamp-2 text-secondary font-extrabold break-words underline-offset-2 group-hover:underline">{relation.title}</span>
        </span>
      </a>
      {watch && (
        <a
          class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill border border-line px-2.5 text-secondary font-extrabold text-ink no-underline transition-colors hover:border-field hover:bg-raised"
          href={watch.url}
          target="_blank"
          rel="noopener noreferrer"
          title={t('panel.nowPlaying.watchOn', { platform: PLATFORMS[watch.platform].label })}
          aria-label={t('panel.nowPlaying.watchAria', { title: relation.title, platform: PLATFORMS[watch.platform].label })}
          data-focus={`relation-watch-${relation.mediaId}`}
        >
          <ServiceLogo id={watch.platform} size="sm" />
          {t('panel.nowPlaying.watch')}
        </a>
      )}
    </li>
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

export function DetailsCard({ page, view, details, entryLinks, preferred, busy, sections, onToggle, onRate, onSaveNotes }: DetailsCardProps) {
  const { media } = view;
  const primary = primaryList(view.lists);
  const relations = details?.relations ?? [];
  const parts: { key: PanelSection; node: JSX.Element }[] = [];
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
  if (relations.length > 0) {
    parts.push({
      key: 'relations',
      node: (
        <Collapsible variant="row" title={t('panel.nowPlaying.relations')} count={relations.length} open={sections.relations} onToggle={(open) => onToggle('relations', open)} focusKey="panel-section-relations">
          <ul class="m-0 flex list-none flex-col gap-2 p-0">
            {relations.map((relation) => (
              <Relation key={relation.mediaId} relation={relation} links={entryLinks} preferred={preferred} />
            ))}
          </ul>
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
