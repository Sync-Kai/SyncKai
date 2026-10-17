// Éditeur du commentaire d'une série (maquette PopupSeriesCommentaire), ouvert sous sa ligne depuis « Commentaire… » :
// titre « Commentaire », zone de texte (lecture seule le temps de lire le commentaire), compteur (beurre dès 90 % de la
// limite), « Annuler » / « Enregistrer » (grisé tant que le texte n'a pas changé, en rotation pendant l'envoi, zone
// verrouillée). Rien n'est écrit à la frappe : Ctrl+Entrée ou « Enregistrer » ; Échap ou « Annuler » ferme sans rien
// écrire. Série absente de la liste (ou lecture en échec) : la phrase remplace l'éditeur. Variante `inline` (détails de la
// carte « Sur cette page », maquette PopupSeriesDeplie) : sans cadre ni « Annuler », aucun focus à l'ouverture, Échap
// rend le texte enregistré, le brouillon suit le commentaire enregistré après l'envoi. Le panneau latéral garde l'éditeur
// repliable vanilla (ui/notes-editor.ts) jusqu'à sa migration.
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { LIST_NOTES_MAX, normalizeListNotes } from '../../shared/list-notes';
import { Button } from './button';
import { Icon } from './icon';

export interface NotesEditorProps {
  /** Titre de la série : nom de la zone de texte */
  title: string;
  /** Commentaire enregistré (valeur de départ du brouillon) */
  notes: string | null;
  /** Commentaire en cours de lecture : zone en lecture seule, « Enregistrer » grisé */
  loading: boolean;
  /** Raison pour laquelle rien ne peut être écrit (série absente de la liste, lecture en échec) : remplace l'éditeur */
  unavailable: string | null;
  /** Autre action en cours sur la série */
  busy: boolean;
  /** Préfixe des clés data-focus : `<clé>-input`, `<clé>-save`, `<clé>-cancel` */
  focusKey: string;
  /** Enregistre le texte ; true si c'est fait (l'hôte ferme alors l'éditeur et affiche le retour) */
  onSave: (notes: string) => Promise<boolean>;
  /** « Annuler », Échap (variante `card`) */
  onClose?: () => void;
  /** `card` (défaut) : éditeur ouvert sous une ligne ; `inline` : section des détails d'une carte */
  variant?: 'card' | 'inline';
}

/** Compteur en beurre à partir de 90 % de la limite */
const NEAR_LIMIT = 0.9;

export function NotesEditor({ title, notes, loading, unavailable, busy, focusKey, onSave, onClose, variant = 'card' }: NotesEditorProps) {
  const inline = variant === 'inline';
  const id = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  /** Texte saisi depuis l'ouverture (null : rien saisi, la zone montre le commentaire lu, relecture comprise) */
  const [typed, setTyped] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  const draft = typed ?? notes ?? '';

  // Ouverture : focus dans la zone de texte (aussi en lecture seule, pendant la lecture) ; jamais dans une carte dépliée
  useLayoutEffect(() => {
    if (!inline) textarea.current?.focus({ preventScroll: true });
    return () => {
      mounted.current = false;
    };
  }, []);

  if (unavailable !== null) {
    return (
      <p class="m-0 flex min-w-0 items-center gap-2 rounded-panel border border-line bg-raised px-3 py-2 text-secondary text-muted" role="note" data-notes-editor={focusKey}>
        <Icon name="pencil" class="size-3.5 shrink-0 text-lavender" />
        <span class="min-w-0">{unavailable}</span>
      </p>
    );
  }

  const unchanged = normalizeListNotes(draft) === (notes ?? '');
  const locked = saving || loading || busy;

  const save = async (): Promise<void> => {
    if (locked || unchanged) return;
    setSaving(true);
    const ok = await onSave(draft);
    if (!mounted.current) return;
    setSaving(false);
    if (ok) {
      // Carte : le brouillon redevient le commentaire enregistré (relu par l'hôte)
      if (inline) setTyped(null);
      return;
    }
    // Échec (bandeau de l'hôte) : le brouillon reste ouvert pour réessayer
    textarea.current?.focus({ preventScroll: true });
  };
  const cancel = (): void => {
    if (saving) return;
    if (inline) setTyped(null);
    else onClose?.();
  };
  const count = draft.length;

  return (
    <div
      class={inline ? 'flex min-w-0 flex-col gap-1.5' : 'flex min-w-0 flex-col gap-2 rounded-panel border border-line bg-raised p-3'}
      data-notes-editor={focusKey}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          // Annule sans fermer le popup ni le panneau
          event.preventDefault();
          event.stopPropagation();
          cancel();
        } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && event.target === textarea.current) {
          event.preventDefault();
          void save();
        }
      }}
    >
      <label class="flex items-center gap-1.5 text-section text-muted uppercase" for={id}>
        {!inline && <Icon name="pencil" class="size-3.5 text-lavender" />}
        {t('notes.title')}
      </label>
      <textarea
        ref={textarea}
        id={id}
        class="min-h-16 w-full resize-y rounded-control border border-field bg-ground px-2.5 py-2 text-body text-ink placeholder:text-muted focus-visible:border-lavender read-only:opacity-70"
        rows={inline ? 2 : 3}
        maxLength={LIST_NOTES_MAX}
        value={draft}
        readOnly={locked}
        placeholder={loading ? t('notes.loading') : t('notes.placeholder')}
        aria-label={t('notes.editAria', { title })}
        aria-describedby={`${id}-count`}
        aria-busy={loading ? 'true' : undefined}
        data-focus={`${focusKey}-input`}
        onInput={(event) => setTyped(event.currentTarget.value)}
      />
      <div class="flex items-center gap-2">
        <span
          id={`${id}-count`}
          class={`min-w-0 flex-1 text-secondary tabular-nums ${count >= LIST_NOTES_MAX * NEAR_LIMIT ? 'font-extrabold text-butter' : 'text-muted'}`}
          aria-label={t('notes.counterAria', { count, max: LIST_NOTES_MAX })}
          data-notes-count=""
        >
          {`${count} / ${LIST_NOTES_MAX}`}
        </span>
        {!inline && (
          <Button variant="text" size="sm" disabled={saving} focusKey={`${focusKey}-cancel`} onClick={cancel}>
            {t('common.cancel')}
          </Button>
        )}
        <Button size="sm" busy={saving} disabled={!saving && (unchanged || loading || busy)} focusKey={`${focusKey}-save`} onClick={() => void save()}>
          {t('notes.save')}
        </Button>
      </div>
    </div>
  );
}
