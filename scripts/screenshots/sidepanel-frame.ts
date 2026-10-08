// Monte le VRAI panneau latéral (src/sidepanel/sidepanel.ts) sur l'API chrome simulée :
// onglet Crunchyroll (page de lecture), port de progression en direct, fiche AniList et agenda de la semaine.
import '../../src/sidepanel/sidepanel.css';
import { isPanelTab } from '../../src/sidepanel/tabs';
import { panelChrome } from './demo-panel';
import { installChromeMock } from './mock-chrome';
import { localeParam, markReady, param, waitFor } from './params';

const tabParam = param('tab');
const tab = isPanelTab(tabParam) ? tabParam : 'nowPlaying';

installChromeMock(panelChrome(localeParam(), tab));

const zoom = Number(param('zoom') ?? '1');
if (zoom !== 1) document.documentElement.style.zoom = String(zoom);

await import('../../src/sidepanel/sidepanel.ts');

if (tab === 'nowPlaying') {
  // Fiche complète (relations) et compte à rebours de la progression en direct affichés
  await waitFor(() => document.querySelector('[data-focus^="relation-watch-"]'));
  await waitFor(() => [...document.querySelectorAll('[role="progressbar"]')].some((bar) => bar.getAttribute('aria-valuenow') !== null && !bar.closest('[hidden]')));
  // `reveal=relations` : défilement juste suffisant pour montrer la première suite (« Regarder ») en bas du panneau,
  // sans jamais masquer le titre de la fiche
  const panel = document.querySelector<HTMLElement>('[role="tabpanel"]');
  const relation = document.querySelector('[data-focus^="relation-watch-"]')?.closest('li');
  const title = panel?.querySelector('h2');
  if (param('reveal') === 'relations' && panel && relation && title) {
    const box = panel.getBoundingClientRect();
    const overflow = relation.getBoundingClientRect().bottom - box.bottom + 10;
    const titleRoom = title.getBoundingClientRect().top - box.top - 6;
    panel.scrollTop += Math.max(0, Math.min(overflow, titleRoom));
  }
} else {
  await waitFor(() => document.querySelector('[data-focus^="agenda-open-"]'));
}
(document.activeElement as HTMLElement | null)?.blur();
await markReady();
