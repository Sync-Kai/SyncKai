import { t } from '../../i18n';
import { renderAlert } from '../../popup/components/alert';
import { renderAiring } from '../../popup/components/page-media-card';
import { kanaLabel, renderCover } from '../../popup/components/ui';
import { mediaMetaParts } from '../../popup/page-media-view';
import type { InlineFeedback } from '../../popup/state';
import { createLogger } from '../../shared/logger';
import { sendMessage } from '../../shared/messages';
import type { PageMediaInfo, PageMediaView } from '../../shared/page-media.types';
import { isLongDescription, malForumUrl, redditSearchUrl } from '../../shared/panel-media';
import type { PanelMedia, PanelRelation } from '../../shared/panel-media.types';
import type { ListStatusChange } from '../../shared/sync.types';
import { h, nodes, type Child } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { mediaActionKey, runMediaAction, type MediaActionRequest } from '../../ui/media-action-requests';
import { renderMediaActions, type MediaActionsState } from '../../ui/media-actions';
import { airedLabel, episodeLine, pageKey, relationLabel } from '../now-playing-view';
import { requestPageMedia } from '../presence';

const log = createLogger('sidepanel');

// Onglet « En lecture » : fiche AniList complète de la série / de l'épisode ouvert dans l'onglet suivi,
// état dans les listes et actions (partagées avec la carte « Sur cette page » du popup).

type ContentState =
  /** Aucun onglet Crunchyroll / ADN suivi */
  | { status: 'idle' }
  /** Interrogation du script de contenu */
  | { status: 'detecting' }
  /** Page de la plateforme sans série (accueil, catalogue…) */
  | { status: 'no-page' }
  | { status: 'loading'; page: PageMediaInfo }
  /** Aucune fiche AniList trouvée */
  | { status: 'not-found'; page: PageMediaInfo; message: string }
  | { status: 'error'; page: PageMediaInfo; message: string }
  /** `panel` null : détails AniList non chargés (`panelError` renseigné en cas d'échec) */
  | { status: 'ready'; page: PageMediaInfo; view: PageMediaView; panel: PanelMedia | null; panelError: string | null; refreshing: boolean };

/** Nouvelles tentatives quand la page n'est pas encore lisible (navigation SPA, chargement) */
const DETECT_RETRY_DELAYS_MS: readonly number[] = [0, 700, 1_800];
const FEEDBACK_MS = 4_000;

const SECTION = 'flex flex-col gap-2 rounded-card bg-surface p-3';
const SECTION_TITLE = 'm-0 text-[11px] font-bold tracking-[0.4px] text-muted uppercase';
const CHIP_LINK =
  'inline-flex h-7 min-w-0 items-center gap-1 rounded-full border border-line bg-raised px-2.5 text-[11px] font-bold text-ink no-underline transition-colors hover:border-sakura';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Lien externe (nouvel onglet) annoncé comme tel aux lecteurs d'écran */
function externalLink(href: string, label: string, cls: string, ...children: Child[]): HTMLAnchorElement {
  return h('a', { class: cls, attrs: { href, target: '_blank', rel: 'noopener noreferrer', 'aria-label': t('panel.nowPlaying.newTab', { label }) } }, ...children);
}

export interface NowPlaying {
  /** Onglet suivi (null hors Crunchyroll / ADN) ; rappelé à chaque navigation de l'onglet */
  setTab(tabId: number | null): void;
  render(): HTMLElement;
}

/** Contrôleur de l'onglet : `onChange` redessine le panneau */
export function createNowPlaying(onChange: () => void): NowPlaying {
  let tabId: number | null = null;
  let content: ContentState = { status: 'idle' };
  let actions: MediaActionsState = { busy: null, confirm: null, feedback: null };
  let expanded = false;
  /** Saison choisie dans le sélecteur, pour la page affichée */
  let manualId: number | null = null;
  let run = 0;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

  const set = (next: ContentState): void => {
    content = next;
    onChange();
  };
  const patchActions = (patch: Partial<MediaActionsState>): void => {
    actions = { ...actions, ...patch };
    onChange();
  };

  // ─── Données ──────────────────────────────────────────────────────────

  /** Série / épisode de l'onglet (quelques essais : la page peut être en cours de rendu) */
  async function detect(current: number, id: number): Promise<PageMediaInfo | null> {
    for (const wait of DETECT_RETRY_DELAYS_MS) {
      if (wait > 0) await delay(wait);
      if (current !== run) return null;
      const response = await requestPageMedia(id);
      if (response !== 'unreachable' && response !== null) return response;
    }
    return null;
  }

  async function loadDetails(current: number, page: PageMediaInfo, view: PageMediaView, refreshing: boolean): Promise<void> {
    const previous = content.status === 'ready' && content.view.media.mediaId === view.media.mediaId ? content.panel : null;
    set({ status: 'ready', page, view, panel: previous, panelError: null, refreshing });
    if (previous && !refreshing) return;
    let panel: PanelMedia | null = previous;
    let panelError: string | null = null;
    try {
      const result = await sendMessage('GET_PANEL_MEDIA', { mediaId: view.media.mediaId });
      if (result.ok) panel = result.data;
      else panelError = result.message;
    } catch (error: unknown) {
      log.warn('Service worker injoignable :', error);
      panelError = t('popup.swUnreachable');
    }
    if (current !== run) return;
    set({ status: 'ready', page, view, panel, panelError: panel ? null : panelError, refreshing: false });
  }

  /** Résout la fiche de la page ; `silent` : la fiche reste affichée pendant la relecture */
  async function resolve(page: PageMediaInfo, silent: boolean): Promise<void> {
    const current = ++run;
    if (silent && content.status === 'ready') set({ ...content, refreshing: true });
    else set({ status: 'loading', page });
    try {
      const result = await sendMessage('RESOLVE_PAGE_MEDIA', { page, mediaId: manualId });
      if (current !== run) return;
      if (result.ok) await loadDetails(current, page, result.data, false);
      else if (result.code === 'NOT_FOUND') set({ status: 'not-found', page, message: result.message });
      else set({ status: 'error', page, message: result.message });
    } catch (error: unknown) {
      log.warn('Service worker injoignable :', error);
      if (current === run) set({ status: 'error', page, message: t('popup.swUnreachable') });
    }
  }

  /** Lit la page de l'onglet et recharge la fiche si elle a changé (`force` : relecture demandée) */
  async function refresh(force: boolean): Promise<void> {
    const id = tabId;
    if (id === null) return;
    const current = ++run;
    const known = 'page' in content ? content.page : null;
    if (!known || force) set({ status: 'detecting' });
    const page = await detect(current, id);
    if (current !== run) return;
    if (!page) {
      set({ status: 'no-page' });
      return;
    }
    // Même page (fin de chargement, retour d'onglet) : rien à recharger
    if (!force && known && pageKey(known) === pageKey(page) && content.status !== 'error') return;
    if (!known || pageKey(known) !== pageKey(page)) {
      manualId = null;
      expanded = false;
      actions = { busy: null, confirm: null, feedback: null };
    }
    await resolve(page, false);
  }

  // ─── Actions (mêmes messages que le popup) ────────────────────────────

  function showFeedback(feedback: InlineFeedback): void {
    clearTimeout(feedbackTimer);
    patchActions({ feedback });
    feedbackTimer = setTimeout(() => patchActions({ feedback: null }), feedback.tone === 'success' ? FEEDBACK_MS : FEEDBACK_MS * 2);
  }

  async function runAction(request: MediaActionRequest): Promise<void> {
    if (actions.busy !== null || content.status !== 'ready') return;
    const { page, view } = content;
    patchActions({ busy: mediaActionKey(request), confirm: null });
    const feedback = await runMediaAction(request, view, (error) => log.warn('Service worker injoignable :', error));
    patchActions({ busy: null });
    showFeedback(feedback);
    await resolve(page, true);
  }

  /** Confirmation Abandonner / Terminé : focus sur « Non » à l'ouverture, rendu au bouton à l'annulation */
  function setConfirm(status: ListStatusChange | null): void {
    if (actions.busy !== null || actions.confirm === status) return;
    const previous = actions.confirm;
    patchActions({ confirm: status });
    const selector = status !== null ? '[data-focus="confirm-no-page"]' : previous !== null ? `[data-focus="page-status-${previous}"]` : null;
    if (selector) document.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
  }

  function pickSeason(mediaId: number): void {
    if (actions.busy !== null || content.status !== 'ready') return;
    manualId = mediaId;
    actions = { ...actions, confirm: null, feedback: null };
    void resolve(content.page, true);
  }

  // ─── Rendu ────────────────────────────────────────────────────────────

  function renderStatus(text: string, busy: boolean, extra: Child = null): HTMLElement {
    return h(
      'div',
      { class: `${SECTION} items-center py-6 text-center`, attrs: { role: 'status' } },
      busy ? icon('spinner', 'h-5 w-5 text-lavender motion-safe:animate-spin') : icon('screen', 'h-6 w-6 text-lavender'),
      h('p', { class: 'm-0 max-w-[280px] text-muted' }, text),
      extra,
    );
  }

  function renderSkeleton(page: PageMediaInfo | null): HTMLElement {
    return h(
      'div',
      { class: 'flex flex-col gap-3 motion-safe:animate-pulse', attrs: { 'aria-busy': 'true', role: 'status', 'aria-label': t('panel.nowPlaying.loading') } },
      h('div', { class: 'h-24 rounded-card bg-surface' }),
      h(
        'div',
        { class: 'flex gap-3 px-1' },
        h('div', { class: 'h-[104px] w-[74px] shrink-0 rounded-lg bg-surface' }),
        h(
          'div',
          { class: 'flex min-w-0 flex-1 flex-col gap-2 pt-1' },
          page ? h('span', { class: 'truncate text-[14px] font-bold text-muted' }, page.seriesTitle) : h('div', { class: 'h-4 w-40 rounded bg-surface' }),
          h('div', { class: 'h-3 w-32 rounded bg-surface' }),
          h('div', { class: 'h-[18px] w-24 rounded-full bg-surface' }),
        ),
      ),
      h('div', { class: 'h-28 rounded-card bg-surface' }),
      h('div', { class: 'h-20 rounded-card bg-surface' }),
    );
  }

  function renderBanner(panel: PanelMedia | null): HTMLElement {
    // Couleur validée (#rrggbb) : sans risque dans un attribut style
    const color = panel?.coverColor ?? '#2c2640';
    const box = h('div', {
      class: 'relative h-24 overflow-hidden rounded-card bg-raised',
      attrs: { style: `background-image: linear-gradient(135deg, ${color} 0%, rgba(22,19,31,.9) 100%)`, 'aria-hidden': 'true' },
    });
    if (panel?.bannerUrl) {
      const img = h('img', { class: 'absolute inset-0 h-full w-full object-cover', attrs: { src: panel.bannerUrl, alt: '', referrerpolicy: 'no-referrer', decoding: 'async' } });
      img.addEventListener('error', () => img.remove(), { once: true });
      box.append(img);
    }
    box.append(h('div', { class: 'absolute inset-0 bg-linear-to-t from-ground via-ground/30 to-transparent' }));
    return box;
  }

  function renderRefresh(): HTMLElement {
    const refreshing = content.status === 'ready' && content.refreshing;
    return h(
      'button',
      {
        class: 'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ground/70 text-muted transition-colors hover:text-ink disabled:cursor-default disabled:opacity-50',
        attrs: { type: 'button', 'data-focus': 'panel-refresh', 'aria-label': t('panel.nowPlaying.refresh'), title: t('panel.nowPlaying.refresh'), ...(actions.busy !== null || refreshing ? { disabled: '' } : {}) },
        on: { click: () => void refresh(true) },
      },
      icon('retry', `h-3.5 w-3.5 ${refreshing ? 'motion-safe:animate-spin' : ''}`),
    );
  }

  function renderHero(view: PageMediaView, panel: PanelMedia | null): HTMLElement {
    const { media } = view;
    const meta = mediaMetaParts(view);
    const facts = nodes([
      panel?.averageScore !== null && panel?.averageScore !== undefined &&
        h(
          'span',
          { class: 'inline-flex items-center gap-1 text-butter', attrs: { title: t('panel.nowPlaying.score', { score: panel.averageScore }), 'aria-label': t('panel.nowPlaying.score', { score: panel.averageScore }) } },
          icon('star', 'h-3 w-3 fill-butter', '0'),
          `${panel.averageScore} %`,
        ),
      panel && airedLabel(panel),
      panel?.studio &&
        (panel.studio.siteUrl
          ? externalLink(panel.studio.siteUrl, `${t('panel.nowPlaying.studio')} : ${panel.studio.name}`, 'min-w-0 truncate text-muted no-underline hover:text-ink hover:underline', panel.studio.name)
          : h('span', { class: 'min-w-0 truncate', attrs: { title: t('panel.nowPlaying.studio') } }, panel.studio.name)),
    ]);

    return h(
      'div',
      { class: 'relative flex flex-col' },
      renderBanner(panel),
      h('div', { class: 'absolute top-2 right-2' }, renderRefresh()),
      h(
        'div',
        { class: '-mt-12 flex gap-3 px-2' },
        renderCover(media.title, panel?.coverUrl ?? media.coverUrl, 'h-[104px] w-[74px] shadow-pop', 'text-[20px]'),
        h(
          'div',
          { class: 'flex min-w-0 flex-1 flex-col justify-end gap-1 pt-12' },
          h('h2', { class: 'm-0 line-clamp-3 font-display text-[15px] leading-[19px] font-extrabold break-words', attrs: { title: media.title } }, media.title),
          meta.length > 0 && h('span', { class: 'text-[11px] font-semibold text-muted' }, meta.join(' · ')),
        ),
      ),
      h(
        'div',
        { class: 'mt-2 flex flex-col gap-1.5 px-2' },
        facts.length > 0 && h('div', { class: 'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-muted' }, ...facts),
        renderAiring(view, Date.now()),
        panel && panel.genres.length > 0 &&
          h(
            'ul',
            { class: 'm-0 flex list-none flex-wrap gap-1 p-0', attrs: { 'aria-label': t('panel.nowPlaying.genres') } },
            ...panel.genres.map((genre) => h('li', { class: 'rounded-full bg-raised px-2 py-0.5 text-[10px] font-bold text-lavender' }, genre)),
          ),
      ),
    );
  }

  function renderProgress(view: PageMediaView, refreshing: boolean): HTMLElement {
    const line = episodeLine(view.episodeProgress, view.media.episodes);
    return h(
      'section',
      { class: SECTION, attrs: { 'aria-label': t('panel.nowPlaying.progress'), 'aria-busy': String(refreshing || actions.busy !== null) } },
      h(
        'div',
        { class: 'flex items-baseline justify-between gap-2' },
        h('h3', { class: SECTION_TITLE }, t('panel.nowPlaying.progress')),
        line && h('span', { class: 'text-[13px] font-extrabold text-sakura tabular-nums' }, line),
      ),
      // Emplacement réservé : position de lecture en direct et compte à rebours (version suivante)
      renderLiveProgress(),
      view.lists.length === 0 && h('p', { class: 'm-0 text-[11px] text-muted' }, t('panel.nowPlaying.connectHint')),
      ...nodes(
        renderMediaActions({
          view,
          state: actions,
          refreshing,
          lines: 'always',
          linesWithScore: true,
          handlers: {
            onAdd: (status) => void runAction({ kind: 'add', status }),
            onAdjust: (delta) => void runAction({ kind: 'adjust', delta }),
            onConfirm: setConfirm,
            onSetStatus: (status) => void runAction({ kind: 'status', status }),
            onRate: (value) => void runAction({ kind: 'rate', value }),
            onPickSeason: pickSeason,
          },
        }),
      ),
    );
  }

  /** Position de lecture en direct : pas encore disponible (emplacement gardé dans la mise en page) */
  function renderLiveProgress(): HTMLElement | null {
    return null;
  }

  function renderSynopsis(text: string): HTMLElement {
    const long = isLongDescription(text);
    return h(
      'section',
      { class: SECTION, attrs: { 'aria-labelledby': 'sk-synopsis' } },
      h('h3', { class: SECTION_TITLE, attrs: { id: 'sk-synopsis' } }, t('panel.nowPlaying.synopsis')),
      // Texte brut (sanitizeDescription) inséré comme nœud texte ; sauts de ligne conservés
      h('p', { class: `m-0 text-[12px] leading-[18px] font-semibold whitespace-pre-line text-ink/90 ${long && !expanded ? 'line-clamp-5' : ''}`, attrs: { id: 'sk-synopsis-text' } }, text),
      long &&
        h(
          'button',
          {
            class: 'self-start cursor-pointer rounded-full text-[11px] font-bold text-sakura underline-offset-2 hover:underline',
            attrs: { type: 'button', 'data-focus': 'panel-synopsis', 'aria-expanded': String(expanded), 'aria-controls': 'sk-synopsis-text' },
            on: {
              click: () => {
                expanded = !expanded;
                onChange();
              },
            },
          },
          t(expanded ? 'panel.nowPlaying.readLess' : 'panel.nowPlaying.readMore'),
        ),
    );
  }

  function renderDiscussion(view: PageMediaView, panel: PanelMedia | null, page: PageMediaInfo): HTMLElement | null {
    // Liens d'épisode seulement sur une page de lecture dont l'épisode AniList est connu
    const episode = page.kind === 'episode' ? view.episodeProgress : null;
    const reddit = redditSearchUrl(panel?.romajiTitle ?? null, episode);
    const mal = malForumUrl(view.media.idMal, episode);
    const links = nodes([
      reddit && externalLink(reddit, t('panel.nowPlaying.reddit'), CHIP_LINK, h('span', { class: 'truncate' }, t('panel.nowPlaying.reddit')), icon('external', 'h-3 w-3 shrink-0')),
      mal && externalLink(mal, t('panel.nowPlaying.malForum'), CHIP_LINK, h('span', { class: 'truncate' }, t('panel.nowPlaying.malForum')), icon('external', 'h-3 w-3 shrink-0')),
      externalLink(view.media.siteUrl, 'AniList', CHIP_LINK, h('span', { class: 'truncate' }, 'AniList'), icon('external', 'h-3 w-3 shrink-0')),
    ]);
    return h(
      'section',
      { class: SECTION, attrs: { 'aria-labelledby': 'sk-discussion' } },
      h('h3', { class: SECTION_TITLE, attrs: { id: 'sk-discussion' } }, t('panel.nowPlaying.discussion')),
      h('div', { class: 'flex flex-wrap gap-1.5' }, ...links),
    );
  }

  function renderRelation(relation: PanelRelation): HTMLElement {
    const label = relationLabel(relation.relationType);
    return h(
      'li',
      {},
      externalLink(
        relation.siteUrl,
        `${label} : ${relation.title}`,
        'flex min-w-0 items-center gap-2 rounded-lg p-1 text-ink no-underline transition-colors hover:bg-raised',
        renderCover(relation.title, relation.coverUrl, 'h-12 w-[34px]', 'text-[10px]'),
        h(
          'span',
          { class: 'flex min-w-0 flex-1 flex-col' },
          h('span', { class: 'text-[10px] font-bold text-lavender uppercase' }, [label, relation.format].filter(Boolean).join(' · ')),
          h('span', { class: 'line-clamp-2 text-[12px] leading-4 font-bold break-words' }, relation.title),
        ),
        icon('external', 'h-3 w-3 shrink-0 text-muted'),
      ),
    );
  }

  function renderRelations(relations: readonly PanelRelation[]): HTMLElement | null {
    if (relations.length === 0) return null;
    return h(
      'section',
      { class: SECTION, attrs: { 'aria-labelledby': 'sk-relations' } },
      h('h3', { class: SECTION_TITLE, attrs: { id: 'sk-relations' } }, t('panel.nowPlaying.relations')),
      h('ul', { class: 'm-0 flex list-none flex-col gap-1 p-0' }, ...relations.map(renderRelation)),
    );
  }

  function renderReady(state: Extract<ContentState, { status: 'ready' }>): HTMLElement {
    const { view, panel, page } = state;
    return h(
      'div',
      { class: 'flex flex-col gap-3', attrs: { 'aria-label': t('panel.nowPlaying.aria') } },
      renderHero(view, panel),
      ...nodes([
        state.panelError !== null &&
          renderAlert({ message: `${t('panel.nowPlaying.detailsError')} ${state.panelError}`, action: { label: t('common.retry'), onClick: () => void resolve(page, true) } }),
        renderProgress(view, state.refreshing),
        panel?.description && renderSynopsis(panel.description),
        renderDiscussion(view, panel, page),
        panel && renderRelations(panel.relations),
      ]),
    );
  }

  function render(): HTMLElement {
    switch (content.status) {
      case 'idle':
      case 'detecting':
        return content.status === 'detecting' ? renderSkeleton(null) : renderStatus(t('panel.nowPlaying.detecting'), true);
      case 'no-page':
        return renderStatus(t('panel.nowPlaying.noPage'), false);
      case 'loading':
        return renderSkeleton(content.page);
      case 'not-found':
        return renderStatus(
          content.message,
          false,
          h('p', { class: 'm-0 max-w-[280px] text-[11px] text-muted' }, kanaLabel('ヒント', 'text-butter'), ' ', t('panel.nowPlaying.notFoundHint')),
        );
      case 'error': {
        const { page } = content;
        return h(
          'div',
          { class: 'flex flex-col gap-2' },
          h('span', { class: 'truncate text-[13px] font-bold', attrs: { title: page.seriesTitle } }, page.seriesTitle),
          renderAlert({ message: content.message, action: { label: t('common.retry'), onClick: () => void resolve(page, false) } }),
        );
      }
      case 'ready':
        return renderReady(content);
    }
  }

  return {
    setTab(next: number | null): void {
      const changed = next !== tabId;
      tabId = next;
      if (next === null) {
        run++;
        content = { status: 'idle' };
        return;
      }
      void refresh(changed);
    },
    render,
  };
}
