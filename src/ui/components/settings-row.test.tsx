// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsCard, SettingsRow } from './settings-row';

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

describe('SettingsRow', () => {
  it('carte des lignes : conteneur de requêtes (@container) ; description masquée sous 304 px de carte (panneau latéral sous ~340 px), gardée en title et aria-describedby', async () => {
    const onClick = vi.fn<() => void>();
    await show(
      <SettingsCard>
        <SettingsRow icon="sync" tile="lavender" title="Synchronisation" description="Auto · au début du générique" summary="Auto" onClick={onClick} />
      </SettingsCard>,
    );
    expect($('[data-settings-card]')?.className).toContain('@container');
    const row = $<HTMLButtonElement>('button');
    const description = $('[data-row-description]');
    expect(description?.textContent).toBe('Auto · au début du générique');
    expect(description?.className).toContain('@max-[304px]:hidden');
    expect(row?.getAttribute('title')).toBe('Auto · au début du générique');
    expect(row?.getAttribute('aria-describedby')).toBe(description?.id);
    expect(row?.getAttribute('aria-labelledby')).toBe($('[data-row-title]')?.id);
    row?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ligne de navigation : résumé (masqué sous 304 px de carte) et chevron ; lien si href', async () => {
    await show(<SettingsRow title="Correspondances" summary="73" href="#mappings" />);
    const link = $<HTMLAnchorElement>('a');
    expect(link?.getAttribute('href')).toBe('#mappings');
    expect($('[data-row-summary]')?.textContent).toBe('73');
    expect($('[data-row-summary]')?.className).toContain('@max-[304px]:hidden');
    expect($('[data-row-chevron]')).not.toBeNull();
    expect(link?.getAttribute('target')).toBeNull();
  });

  it('lien externe (Aide & à propos) : nouvel onglet sans opener, flèche ↗ à la place du chevron, résumé gardé', async () => {
    await show(<SettingsRow icon="code" title="Code source" summary="GitHub" href="https://github.com/Sync-Kai/SyncKai" external focusKey="about-source" />);
    const link = $<HTMLAnchorElement>('a');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.dataset.focus).toBe('about-source');
    expect($('[data-row-summary]')?.textContent).toBe('GitHub');
    expect($('[data-row-chevron]')).toBeNull();
    expect($('[data-row-external]')).not.toBeNull();
  });

  it('interrupteur : nommé par le titre, décrit par la description ; clic sur la ligne = bascule', async () => {
    const onChange = vi.fn<(checked: boolean) => void>();
    await show(<SettingsRow title="Synchro automatique" description="Met à jour ta liste" toggle={{ checked: true, onChange }} />);
    const sw = $('[role="switch"]');
    expect(sw?.getAttribute('aria-labelledby')).toBe($('[data-row-title]')?.id);
    expect(sw?.getAttribute('aria-describedby')).toBe($('[data-row-description]')?.id);
    expect($('[data-row-chevron]')).toBeNull();
    $('[data-row-title]')?.click();
    expect(onChange).toHaveBeenCalledWith(false);
    sw?.click();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('ligne inerte avec contenu de fin ; séparateur sur les lignes suivantes', async () => {
    await show(
      <SettingsCard>
        <SettingsRow title="Version" trailing={<span data-trailing="">2.4.0</span>} />
        <SettingsRow title="Langue" divider trailing={<span>FR</span>} />
      </SettingsCard>,
    );
    const rows = [...container.querySelectorAll<HTMLElement>('[data-settings-row]')];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.tagName).toBe('DIV');
    expect(rows[0]?.dataset.divider).toBeUndefined();
    expect(rows[1]?.dataset.divider).toBe('');
    expect($('[data-trailing]')?.textContent).toBe('2.4.0');
  });

  it('description d’avertissement (synchro en pause) : butter, icône décorative devant, toujours décrite', async () => {
    await show(<SettingsRow title="Synchro automatique" description="En pause : aucun épisode n’est envoyé" descriptionTone="warn" toggle={{ checked: false, onChange: () => undefined }} />);
    const description = $('[data-row-description]');
    expect(description?.dataset.tone).toBe('warn');
    expect(description?.className).toContain('text-butter');
    expect(description?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(description?.textContent).toBe('En pause : aucun épisode n’est envoyé');
    expect($('[role="switch"]')?.getAttribute('aria-describedby')).toBe(description?.id);
  });

  it('visuel de tête (logo de plateforme) à la place de la pastille : décoratif, séparateur décalé comme avec une icône', async () => {
    await show(
      <SettingsCard>
        <SettingsRow title="Crunchyroll" leading={<img src="/brands/crunchyroll.png" alt="" />} trailing={<span>Inclus</span>} />
        <SettingsRow title="ADN" leading={<img src="/brands/adn.png" alt="" />} divider />
      </SettingsCard>,
    );
    const [first, second] = [...container.querySelectorAll<HTMLElement>('[data-settings-row]')];
    expect(first?.querySelector('[data-row-leading]')?.getAttribute('aria-hidden')).toBe('true');
    expect(first?.querySelector('[data-row-leading] img')).not.toBeNull();
    expect(first?.className).toContain('py-2.5');
    expect(second?.className).toContain('before:left-13');
  });

  it('sans description : ni aria-describedby ni title', async () => {
    await show(<SettingsRow title="Affichage" onClick={() => undefined} />);
    expect($('button')?.hasAttribute('aria-describedby')).toBe(false);
    expect($('button')?.hasAttribute('title')).toBe(false);
  });
});
