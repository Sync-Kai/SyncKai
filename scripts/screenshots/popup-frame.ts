// Monte le VRAI popup (src/popup/popup.ts) avec l'API chrome simulée et les données de démo.
import '../../src/popup/popup.css';
import { demoChrome, type Scenario } from './demo-data';
import { installChromeMock } from './mock-chrome';
import { localeParam, markReady, param, waitFor } from './params';

const SCENARIOS: readonly Scenario[] = ['watching', 'menu', 'page', 'activity', 'compare', 'settings'];
const scenario = SCENARIOS.find((s) => s === param('scenario')) ?? 'watching';

installChromeMock(demoChrome(localeParam(), scenario));
await import('../../src/popup/popup.ts');

// Zoom appliqué avant la navigation : les défilements se calculent à l'échelle finale
const zoom = Number(param('zoom') ?? '1');
if (zoom !== 1) document.documentElement.style.zoom = String(zoom);

const find = (selector: string): Promise<HTMLElement> => waitFor(() => document.querySelector<HTMLElement>(selector));
const click = async (selector: string): Promise<void> => (await find(selector)).click();

/** Amène `node` en haut de la zone défilante du popup, avec une petite marge */
function scrollToTop(node: Element | null, margin = 12): void {
  node?.scrollIntoView({ block: 'start' });
  const main = document.querySelector('main');
  if (main) main.scrollTop -= margin;
}

// Navigation par les vrais boutons, une fois les comptes chargés
await waitFor(() => document.querySelector('[data-focus="nav-activity"]') && document.querySelector('main section'));
switch (scenario) {
  case 'watching':
    break;
  case 'menu':
    // Menu « ⋯ » de la carte « Reprendre » (Dandadan) : −1, statuts, exclusion, fiche ; il tient sans défilement
    await click('[data-focus="more-185660:60543"]');
    await find('[role="menu"]');
    // L'ouverture amène le menu dans la zone visible : on revient en haut, la carte reste entière
    document.querySelector('main')?.scrollTo({ top: 0 });
    break;
  case 'page':
    // Carte « Sur cette page » résolue (contrôles de la série dans la liste affichés)
    await find('[data-focus="page-plus"]');
    break;
  case 'activity':
    await click('[data-focus="nav-activity"]');
    await waitFor(() => document.querySelector('main article button[aria-pressed="true"]'));
    break;
  case 'compare':
    await click('[data-focus="nav-activity"]');
    scrollToTop((await find('[data-focus^="compare-anilist-"]')).closest('section'));
    break;
  case 'settings':
    await click('[data-focus="gear"]');
    await waitFor(() => document.querySelector('#sk-airing') && [...document.querySelectorAll('main a')].some((a) => a.textContent === 'Kai_fan'));
    break;
}
// Pas de focus visible sur le bouton cliqué ni sur le premier élément du menu
(document.activeElement as HTMLElement | null)?.blur();

await markReady();
