// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusBar, type StatusBarAccount } from './status-bar';

let container: HTMLElement;

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

const ACCOUNTS: readonly StatusBarAccount[] = [
  { service: 'anilist', state: 'connected', label: 'Compte AniList' },
  { service: 'mal', state: 'connected', label: 'Compte MyAnimeList' },
];

describe('StatusBar', () => {
  it('pied de page de 48 px (jeton h-status-bar), message role="status" en text-secondary muted, jamais souligné', async () => {
    await show(<StatusBar accounts={ACCOUNTS} message={{ text: 'il y a 5 min', tone: 'ok', icon: 'checkCircle', title: 'Tout est synchronisé' }} />);
    expect($('footer')?.className).toContain('h-status-bar');
    const status = $('[role="status"]');
    const message = $('[data-status-message]');
    expect(status?.contains(message)).toBe(true);
    expect(message?.textContent).toBe('il y a 5 min');
    expect(message?.getAttribute('title')).toBe('Tout est synchronisé');
    expect(message?.className).toContain('text-secondary');
    expect(message?.className).toContain('text-muted');
    expect(message?.className).toContain('no-underline');
    expect(message?.tagName).toBe('SPAN');
    // Ton porté par l'icône seule
    expect($('[data-status-icon]')?.className).toContain('text-mint');
  });

  it('comptes : logos boutons (menu du compte) ; jamais connecté : aucun logo ; session expirée : logo grisé et point rouge', async () => {
    const onAniList = vi.fn<() => void>();
    await show(
      <StatusBar
        accounts={[
          { service: 'anilist', state: 'connected', label: 'Compte AniList', onClick: onAniList, expanded: true },
          { service: 'mal', state: 'none', label: 'Compte MyAnimeList' },
        ]}
        message={null}
      />,
    );
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('[data-account]')];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.getAttribute('aria-label')).toBe('Compte AniList');
    expect(buttons[0]?.getAttribute('aria-haspopup')).toBe('menu');
    expect(buttons[0]?.getAttribute('aria-expanded')).toBe('true');
    buttons[0]?.click();
    expect(onAniList).toHaveBeenCalledTimes(1);

    await show(<StatusBar accounts={[{ service: 'mal', state: 'expired', label: 'Compte MyAnimeList, session expirée', onClick: () => undefined }]} message={null} />);
    const expired = $('[data-account="mal"]');
    expect(expired?.dataset.state).toBe('expired');
    expect(expired?.querySelector('img')?.dataset.dimmed).toBe('');
    expect(expired?.querySelector('[data-badge="expired"]')).not.toBeNull();
  });

  it('compte sans action : logo seul (pas de bouton), nommé par son texte alternatif', async () => {
    await show(<StatusBar accounts={ACCOUNTS} message={null} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect([...container.querySelectorAll('img')].map((img) => img.getAttribute('alt'))).toEqual(['Compte AniList', 'Compte MyAnimeList']);
  });

  it('message cliquable : bouton avec chevron de fin', async () => {
    const onClick = vi.fn<() => void>();
    await show(<StatusBar accounts={ACCOUNTS} message={{ text: '2 à vérifier', tone: 'warn', icon: 'alert', onClick }} />);
    const message = $<HTMLButtonElement>('[data-status-message]');
    expect(message?.tagName).toBe('BUTTON');
    expect(message?.type).toBe('button');
    expect(message?.querySelector('[data-chevron]')).not.toBeNull();
    message?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('message non cliquable : pas de chevron', async () => {
    await show(<StatusBar accounts={ACCOUNTS} message={{ text: 'Synchro…', tone: 'info', icon: 'sync' }} />);
    expect($('[data-chevron]')).toBeNull();
  });

  it('message qui nomme une série : deux lignes, titre en ink tronqué (infobulle) puis statut avec son icône', async () => {
    await show(<StatusBar accounts={ACCOUNTS} message={{ series: 'Mushoku Tensei: Isekai Ittara Honki Dasu', text: 'Ép. 6 synchronisé', tone: 'ok', icon: 'checkCircle', onClick: () => undefined }} />);
    const series = $('[data-status-series]');
    expect(series?.textContent).toBe('Mushoku Tensei: Isekai Ittara Honki Dasu');
    expect(series?.className).toContain('text-ink');
    expect(series?.className).toContain('truncate');
    expect(series?.getAttribute('title')).toBe('Mushoku Tensei: Isekai Ittara Honki Dasu');
    const line = $('[data-status-line]');
    expect(line?.textContent).toBe('Ép. 6 synchronisé');
    expect(line?.querySelector('[data-status-icon]')).not.toBeNull();
  });

  it('logo qui n’ouvre pas de menu : ni aria-haspopup ni aria-expanded ; clés data-focus du logo et du message', async () => {
    await show(
      <StatusBar
        accounts={[{ service: 'anilist', state: 'connected', label: 'Compte AniList', onClick: () => undefined, focusKey: 'chip-anilist' }]}
        message={{ text: '2 à vérifier', tone: 'warn', icon: 'alert', onClick: () => undefined, focusKey: 'footer-pending', label: '2 à vérifier — voir l’activité' }}
      />,
    );
    const logo = $('[data-focus="chip-anilist"]');
    expect(logo?.hasAttribute('aria-haspopup')).toBe(false);
    expect(logo?.hasAttribute('aria-expanded')).toBe(false);
    expect($('[data-focus="footer-pending"]')?.getAttribute('aria-label')).toBe('2 à vérifier — voir l’activité');
  });

  it('nom accessible d’un message en texte : copie hors écran, texte visible masqué au lecteur d’écran', async () => {
    await show(<StatusBar accounts={ACCOUNTS} message={{ text: 'il y a 5 min', tone: 'ok', icon: 'check', label: 'Tout est synchronisé · il y a 5 min' }} />);
    expect($('[role="status"] .sr-only')?.textContent).toBe('Tout est synchronisé · il y a 5 min');
    expect($('[data-status-message] .truncate')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('sans logo : message à gauche ; sans icône : point muted', async () => {
    await show(<StatusBar accounts={[]} message={{ text: 'Aucun compte connecté', tone: 'muted', icon: null }} />);
    expect($('[role="status"]')?.className).not.toContain('ml-auto');
    expect($('[data-status-dot]')).not.toBeNull();
    expect($('[data-status-icon]')).toBeNull();
    await show(<StatusBar accounts={ACCOUNTS} message={{ text: 'il y a 5 min', tone: 'ok', icon: 'check' }} />);
    expect($('[role="status"]')?.className).toContain('ml-auto');
  });

  it('contenu de fin (masquer, reconnecter) et barre de progression décorative', async () => {
    await show(
      <StatusBar accounts={ACCOUNTS} message={{ text: 'Import Crunchyroll · 42 / 120', tone: 'info', icon: 'sync' }} progress={0.35} trailing={<button type="button" data-hide="">×</button>} />,
    );
    expect($('[data-hide]')).not.toBeNull();
    const bar = $('[data-status-progress]');
    expect(bar?.getAttribute('aria-hidden')).toBe('true');
    expect(bar?.querySelector<HTMLElement>('span')?.style.width).toBe('35%');
  });
});
