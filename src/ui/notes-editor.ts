import { t } from '../i18n';
import { LIST_NOTES_MAX, normalizeListNotes, notesPreview } from '../shared/list-notes';
import { busyAttrs, h, nodes } from './dom';
import { icon } from './icons';

// Éditeur du commentaire d'une entrée (AniList `notes`, MAL `comments`) : panneau (« Ta progression », repliable) et
// popup (sous la ligne de « En cours », ouvert depuis le menu « ⋯ »). Élément PERSISTANT : l'écran le réinsère à chaque
// rendu, la zone de texte (brouillon, curseur) n'est jamais recréée. Rien n'est écrit à la frappe, seulement sur
// « Enregistrer » (Ctrl+Entrée) ; Échap annule.

export interface NotesEditorView {
  /** Commentaire enregistré (aperçu replié, valeur de départ du brouillon) */
  notes: string | null;
  /** Commentaire en cours de lecture (popup) : zone de texte en lecture seule */
  loading: boolean;
  /** Raison pour laquelle le commentaire ne peut pas être écrit (série absente de la liste, lecture en échec) */
  unavailable: string | null;
  /** Autre action en cours sur la fiche */
  busy: boolean;
  title: string;
}

export interface NotesEditorOptions {
  /** Préfixe des clés de focus : `${focusKey}-toggle`, `${focusKey}-input`, `${focusKey}-save`, `${focusKey}-cancel` */
  focusKey: string;
  /** Panneau : replié par défaut (aperçu d'une ligne) ; popup : toujours ouvert, « Annuler » le ferme (`onClose`) */
  collapsible: boolean;
  /** Enregistre le texte saisi ; true si c'est fait (l'écran affiche lui-même le retour, succès ou erreur) */
  onSave: (notes: string) => Promise<boolean>;
  /** Éditeur non repliable : fermeture (« Annuler », Échap, après l'enregistrement) */
  onClose?: () => void;
}

export interface NotesEditor {
  readonly element: HTMLElement;
  /** Nouvel état de la fiche : l'éditeur ne se redessine que s'il change (le brouillon ouvert est gardé) */
  update(view: NotesEditorView): void;
  /** Autre fiche affichée : replié, brouillon oublié */
  reset(): void;
}

const BTN =
  'inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition hover:brightness-110 disabled:cursor-default disabled:opacity-50 disabled:hover:brightness-100 aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:brightness-100';

export function createNotesEditor(options: NotesEditorOptions): NotesEditor {
  const { focusKey, collapsible } = options;
  const id = `sk-notes-${focusKey.replace(/[^\w-]/g, '_')}`;
  let view: NotesEditorView = { notes: null, loading: false, unavailable: null, busy: false, title: '' };
  let expanded = !collapsible;
  let saving = false;
  /** Texte saisi depuis l'ouverture : une relecture de la fiche ne l'écrase pas */
  let dirty = false;
  /** Dernier texte enregistré ici, affiché replié jusqu'à la relecture de la fiche */
  let savedHere: string | null | undefined;
  let lastKey = '';

  const element = h('div', { class: 'flex min-w-0 flex-col gap-1.5', attrs: { 'data-notes-editor': focusKey } });
  const counter = h('span', { class: 'min-w-0 flex-1 text-[10px] font-semibold text-muted tabular-nums', attrs: { id: `${id}-count`, 'aria-live': 'off' } });
  const textarea = h('textarea', {
    class:
      'min-h-[64px] w-full resize-y rounded-lg border border-line bg-ground px-2 py-1.5 text-[12px] leading-[17px] font-semibold text-ink placeholder:text-muted focus-visible:border-lavender focus-visible:outline-none read-only:opacity-70',
    attrs: { id, rows: '3', maxlength: String(LIST_NOTES_MAX), 'data-focus': `${focusKey}-input`, 'aria-describedby': `${id}-count` },
  });
  let saveButton: HTMLButtonElement | null = null;

  const shownNotes = (): string | null => (savedHere !== undefined ? savedHere : view.notes);
  const unchanged = (): boolean => normalizeListNotes(textarea.value) === (shownNotes() ?? '');

  function refreshCounter(): void {
    const count = textarea.value.length;
    counter.textContent = `${count} / ${LIST_NOTES_MAX}`;
    counter.setAttribute('aria-label', t('notes.counterAria', { count, max: LIST_NOTES_MAX }));
    counter.classList.toggle('text-butter', count >= LIST_NOTES_MAX * 0.9);
    // Rien à enregistrer tant que le texte n'a pas changé
    if (saveButton) saveButton.disabled = unchanged() && !saving;
  }

  textarea.addEventListener('input', () => {
    dirty = true;
    refreshCounter();
  });
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      // Annule sans fermer le popup ni le panneau
      event.preventDefault();
      event.stopPropagation();
      cancel();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void save();
    }
  });

  function focusKeyed(key: string): void {
    element.querySelector<HTMLElement>(`[data-focus="${key}"]`)?.focus({ preventScroll: true });
  }

  /** Brouillon repris du commentaire enregistré (ouverture, ou relecture terminée sans saisie) */
  function loadDraft(): void {
    textarea.value = shownNotes() ?? '';
    dirty = false;
  }

  function open(): void {
    if (expanded || view.unavailable !== null) return;
    expanded = true;
    loadDraft();
    draw();
    textarea.focus({ preventScroll: true });
  }

  function cancel(): void {
    if (saving) return;
    dirty = false;
    if (!collapsible) {
      options.onClose?.();
      return;
    }
    expanded = false;
    draw();
    focusKeyed(`${focusKey}-toggle`);
  }

  async function save(): Promise<void> {
    if (saving || view.busy || view.loading || view.unavailable !== null || unchanged()) return;
    const text = textarea.value;
    saving = true;
    draw();
    const ok = await options.onSave(text);
    saving = false;
    if (!ok) {
      // Échec (affiché par l'écran) : le brouillon reste ouvert pour réessayer
      draw();
      if (element.isConnected) textarea.focus({ preventScroll: true });
      return;
    }
    const saved = normalizeListNotes(text);
    savedHere = saved.length > 0 ? saved : null;
    dirty = false;
    if (!collapsible) {
      options.onClose?.();
      return;
    }
    expanded = false;
    draw();
    focusKeyed(`${focusKey}-toggle`);
  }

  function renderCollapsed(): HTMLElement {
    const notes = shownNotes();
    const off = view.unavailable !== null;
    return h(
      'button',
      {
        class: `flex min-h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-line bg-raised px-2.5 py-1 text-left transition-colors hover:border-lavender disabled:cursor-default disabled:opacity-60 disabled:hover:border-line`,
        attrs: {
          type: 'button',
          'aria-expanded': 'false',
          'aria-controls': id,
          'aria-label': t('notes.editAria', { title: view.title }),
          'data-focus': `${focusKey}-toggle`,
          ...(off ? { disabled: '' } : {}),
        },
        on: { click: open },
      },
      icon('pencil', 'h-3.5 w-3.5 text-lavender'),
      h('span', { class: 'shrink-0 text-[11px] font-bold text-muted' }, t('notes.title')),
      h(
        'span',
        { class: `min-w-0 flex-1 truncate text-[11px] font-semibold ${notes ? 'text-ink' : 'text-muted'}`, attrs: notes ? { title: notes } : {} },
        notes ? notesPreview(notes) : t('notes.add'),
      ),
    );
  }

  function renderExpanded(): HTMLElement[] {
    const locked = saving || view.loading || view.busy;
    textarea.readOnly = locked;
    textarea.setAttribute('aria-label', t('notes.editAria', { title: view.title }));
    textarea.placeholder = view.loading ? t('notes.loading') : t('notes.placeholder');
    if (view.loading) textarea.setAttribute('aria-busy', 'true');
    else textarea.removeAttribute('aria-busy');
    saveButton = h(
      'button',
      {
        class: `${BTN} bg-lavender text-on-fill`,
        attrs: { type: 'button', 'data-focus': `${focusKey}-save`, ...busyAttrs(saving || view.busy || view.loading, saving) },
        on: { click: () => void save() },
      },
      saving ? icon('spinner', 'h-3 w-3 motion-safe:animate-spin') : icon('check', 'h-3 w-3', '3'),
      t('notes.save'),
    );
    const cancelButton = h(
      'button',
      { class: `${BTN} border border-line text-ink`, attrs: { type: 'button', 'data-focus': `${focusKey}-cancel`, ...busyAttrs(saving) }, on: { click: cancel } },
      t('common.cancel'),
    );
    refreshCounter();
    return [
      h('label', { class: 'flex items-center gap-1.5 text-[11px] font-bold text-muted', attrs: { for: id } }, icon('pencil', 'h-3.5 w-3.5 text-lavender'), t('notes.title')),
      textarea,
      h('div', { class: 'flex items-center gap-1.5' }, counter, cancelButton, saveButton),
    ];
  }

  function draw(): void {
    lastKey = JSON.stringify([view, expanded, saving, savedHere]);
    const showEditor = expanded && view.unavailable === null;
    if (!showEditor) saveButton = null;
    // Zone de texte déplacée par replaceChildren : elle perd le focus, rendu aussitôt (le curseur est conservé)
    const typing = document.activeElement === textarea;
    element.replaceChildren(
      ...nodes([
        ...(showEditor ? renderExpanded() : collapsible ? [renderCollapsed()] : []),
        view.unavailable !== null && h('p', { class: 'm-0 text-[11px] font-semibold text-muted', attrs: { role: 'note' } }, view.unavailable),
      ]),
    );
    if (typing && textarea.isConnected) textarea.focus({ preventScroll: true });
  }

  return {
    element,
    update(next) {
      const notesChanged = next.notes !== view.notes;
      const loaded = view.loading && !next.loading;
      view = next;
      // Plus rien à commenter (série retirée de la liste) : repliée, le brouillon ne reviendra pas après un nouvel ajout
      if (collapsible && next.unavailable !== null && !saving) {
        expanded = false;
        dirty = false;
      }
      // Fiche relue avec un autre commentaire : l'enregistrement local n'a plus à primer
      if (notesChanged) savedHere = undefined;
      // Brouillon repris du commentaire relu tant que rien n'a été saisi
      if (expanded && !dirty && (notesChanged || loaded)) loadDraft();
      if (JSON.stringify([view, expanded, saving, savedHere]) !== lastKey) draw();
    },
    reset() {
      expanded = !collapsible;
      saving = false;
      dirty = false;
      savedHere = undefined;
      textarea.value = '';
      draw();
    },
  };
}
