// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '../../i18n';
import { LIST_NOTES_MAX } from '../../shared/list-notes';
import { NotesEditor, type NotesEditorProps } from './notes-editor';

let container: HTMLElement;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));
const input = (): HTMLTextAreaElement | null => $<HTMLTextAreaElement>('[data-focus="n-input"]');
const save = (): HTMLButtonElement | null => $<HTMLButtonElement>('[data-focus="n-save"]');
const cancel = (): HTMLButtonElement | null => $<HTMLButtonElement>('[data-focus="n-cancel"]');
const type = async (text: string): Promise<void> => {
  await act(() => {
    const el = input();
    if (!el) return;
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const press = async (key: string, init: KeyboardEventInit = {}): Promise<KeyboardEvent> => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  await act(() => {
    input()?.dispatchEvent(event);
  });
  return event;
};

const onSave = vi.fn<(notes: string) => Promise<boolean>>();
const onClose = vi.fn<() => void>();

function editor(props: Partial<NotesEditorProps> = {}) {
  return <NotesEditor title="Dandadan" notes={null} loading={false} unavailable={null} busy={false} focusKey="n" onSave={onSave} onClose={onClose} {...props} />;
}

beforeEach(() => {
  setLocale('fr');
  container = document.createElement('div');
  document.body.append(container);
  onSave.mockReset();
  onClose.mockReset();
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

describe('NotesEditor', () => {
  it('lecture du commentaire : zone en lecture seule (focus), « Lecture du commentaire… », « Enregistrer » grisé', async () => {
    await show(editor({ loading: true }));
    expect(document.activeElement).toBe(input());
    expect(input()?.readOnly).toBe(true);
    expect(input()?.placeholder).toBe(t('notes.loading'));
    expect(input()?.getAttribute('aria-busy')).toBe('true');
    expect(input()?.getAttribute('aria-label')).toBe(t('notes.editAria', { title: 'Dandadan' }));
    expect(save()?.disabled).toBe(true);
    expect($('[data-notes-count]')?.textContent).toBe(`0 / ${LIST_NOTES_MAX}`);
  });

  it('commentaire lu : repris dans la zone, compteur ; « Enregistrer » actif seulement si le texte change', async () => {
    await show(editor({ loading: true }));
    await show(editor({ notes: 'Le rythme lent sert parfaitement l’histoire.' }));
    expect(input()?.value).toBe('Le rythme lent sert parfaitement l’histoire.');
    expect(input()?.readOnly).toBe(false);
    expect(input()?.placeholder).toBe(t('notes.placeholder'));
    expect($('[data-notes-count]')?.textContent).toBe(`44 / ${LIST_NOTES_MAX}`);
    expect(save()?.disabled).toBe(true);
    await type('Le rythme lent sert parfaitement l’histoire. Superbe.');
    expect(save()?.disabled).toBe(false);
    // Espaces seuls ajoutés : rien à enregistrer (texte normalisé)
    await type('Le rythme lent sert parfaitement l’histoire.  ');
    expect(save()?.disabled).toBe(true);
  });

  it('commentaire lu : dans la zone dès le rendu qui retire la lecture (jamais une zone vide entre les deux)', async () => {
    await show(editor({ loading: true }));
    // Rendu synchrone, sans attendre les effets : la valeur est déjà là quand aria-busy disparaît
    render(editor({ notes: 'AniList note' }), container);
    expect(input()?.hasAttribute('aria-busy')).toBe(false);
    expect(input()?.value).toBe('AniList note');
    await act(() => undefined);
  });

  it('relecture pendant la saisie : le brouillon n’est pas écrasé', async () => {
    await show(editor({ notes: 'A' }));
    await type('A modifié');
    await show(editor({ notes: 'B' }));
    expect(input()?.value).toBe('A modifié');
  });

  it('Ctrl+Entrée enregistre ; pendant l’envoi zone verrouillée, « Annuler » grisé, Échap sans effet ; succès : rien de plus (l’hôte ferme)', async () => {
    let resolve: (ok: boolean) => void = () => undefined;
    onSave.mockImplementation(() => new Promise<boolean>((r) => (resolve = r)));
    await show(editor({ notes: null }));
    await type('Superbe arc');
    await press('Enter', { ctrlKey: true });
    expect(onSave).toHaveBeenCalledWith('Superbe arc');
    expect(input()?.readOnly).toBe(true);
    expect(save()?.getAttribute('aria-busy')).toBe('true');
    expect(cancel()?.disabled).toBe(true);
    await press('Escape');
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => resolve(true));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('échec : le brouillon reste ouvert, la zone redevient modifiable et reprend le focus', async () => {
    onSave.mockResolvedValue(false);
    await show(editor({ notes: null }));
    await type('Superbe arc');
    await act(async () => save()?.click());
    expect(input()?.value).toBe('Superbe arc');
    expect(input()?.readOnly).toBe(false);
    expect(document.activeElement).toBe(input());
    expect(save()?.disabled).toBe(false);
  });

  it('Échap (ou « Annuler ») : fermeture sans rien écrire, sans atteindre l’hôte', async () => {
    const host = vi.fn<() => void>();
    container.addEventListener('keydown', host);
    await show(editor({ notes: 'A' }));
    await type('brouillon');
    const event = await press('Escape');
    expect(event.defaultPrevented).toBe(true);
    expect(host).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(() => cancel()?.click());
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('près de la limite : compteur en beurre', async () => {
    await show(editor({ notes: 'x'.repeat(Math.ceil(LIST_NOTES_MAX * 0.9)) }));
    expect($('[data-notes-count]')?.className).toContain('text-butter');
    await type('x'.repeat(10));
    expect($('[data-notes-count]')?.className).not.toContain('text-butter');
  });

  it('autre action en cours : zone verrouillée, « Enregistrer » grisé', async () => {
    await show(editor({ notes: 'A', busy: true }));
    expect(input()?.readOnly).toBe(true);
    expect(save()?.disabled).toBe(true);
  });

  it('série absente de la liste : la phrase remplace l’éditeur', async () => {
    await show(editor({ unavailable: t('notes.notInList') }));
    expect(input()).toBeNull();
    expect($('[role="note"]')?.textContent).toBe(t('notes.notInList'));
  });

  it('variante inline (détails de « Sur cette page ») : ni focus à l’ouverture ni « Annuler », Échap rend le texte enregistré', async () => {
    await show(editor({ variant: 'inline', notes: 'Superbe arc', onClose: undefined }));
    expect(document.activeElement).not.toBe(input());
    expect(cancel()).toBeNull();
    expect(input()?.value).toBe('Superbe arc');
    await type('Superbe arc, revu');
    expect(save()?.disabled).toBe(false);
    await press('Escape');
    expect(input()?.value).toBe('Superbe arc');
    expect(save()?.disabled).toBe(true);
  });

  it('variante inline : enregistré, le brouillon suit le commentaire relu par l’hôte', async () => {
    onSave.mockResolvedValue(true);
    await show(editor({ variant: 'inline', notes: 'Avant', onClose: undefined }));
    await type('Après');
    await act(async () => {
      save()?.click();
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalledWith('Après');
    await show(editor({ variant: 'inline', notes: 'Après', onClose: undefined }));
    expect(input()?.value).toBe('Après');
    expect(save()?.disabled).toBe(true);
  });
});
