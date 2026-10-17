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
  it('carte des lignes : conteneur de requêtes (@container) ; description masquée sous 340 px, gardée en title et aria-describedby', async () => {
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
    expect(description?.className).toContain('@max-[340px]:hidden');
    expect(row?.getAttribute('title')).toBe('Auto · au début du générique');
    expect(row?.getAttribute('aria-describedby')).toBe(description?.id);
    expect(row?.getAttribute('aria-labelledby')).toBe($('[data-row-title]')?.id);
    row?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ligne de navigation : résumé (masqué sous 340 px) et chevron ; lien si href', async () => {
    await show(<SettingsRow title="Correspondances" summary="73" href="#mappings" />);
    const link = $<HTMLAnchorElement>('a');
    expect(link?.getAttribute('href')).toBe('#mappings');
    expect($('[data-row-summary]')?.textContent).toBe('73');
    expect($('[data-row-summary]')?.className).toContain('@max-[340px]:hidden');
    expect($('[data-row-chevron]')).not.toBeNull();
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

  it('sans description : ni aria-describedby ni title', async () => {
    await show(<SettingsRow title="Affichage" onClick={() => undefined} />);
    expect($('button')?.hasAttribute('aria-describedby')).toBe(false);
    expect($('button')?.hasAttribute('title')).toBe(false);
  });
});
