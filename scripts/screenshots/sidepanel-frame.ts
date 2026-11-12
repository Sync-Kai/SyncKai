// Monte le VRAI panneau latéral (src/sidepanel/sidepanel.ts) sur l'API chrome simulée :
// onglet Crunchyroll (page de lecture), port de progression en direct, fiche AniList et agenda de la semaine.
import '../../src/sidepanel/sidepanel.css';
import { isPanelTab } from '../../src/sidepanel/tabs';
import { STORAGE_KEYS } from '../../src/protocol/storage-keys';
import { announcedDemo } from './demo-data';
import { panelChrome } from './demo-panel';
import { installChromeMock } from './mock-chrome';
import { loadedLocaleParam, markReady, param, waitFor } from './params';

const tabParam = param('tab');
const tab = isPanelTab(tabParam) ? tabParam : 'nowPlaying';

/**
 * Agenda : horloge décalée au mardi 14 h de la semaine en cours (semaine du lundi), quel que soit le jour de génération,
 * pour que la capture montre toujours la même semaine type (lundi vu, aujourd'hui, sorties à venir : demo-panel.ts)
 */
function shiftClockToTuesday(): void {
  const RealDate = Date;
  const real = new RealDate();
  const monday = real.getDate() - ((real.getDay() + 6) % 7);
  const offset = new RealDate(real.getFullYear(), real.getMonth(), monday + 1, 14, 0).getTime() - real.getTime();
  class ShiftedDate extends RealDate {
    constructor(...args: [] | ConstructorParameters<DateConstructor>) {
      if (args.length === 0) super(RealDate.now() + offset);
      else super(...args);
    }
    static override now(): number {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = ShiftedDate as DateConstructor;
}

if (tab === 'agenda') shiftClockToTuesday();

// `demo=mushoku` : « En lecture » sur la vraie franchise Mushoku Tensei (captures du Store, demo-panel.ts)
const options = panelChrome(await loadedLocaleParam(), tab, Date.now(), param('demo') === 'mushoku' ? 'mushoku' : 'frieren');
// `view=announced` : suites et séries de la liste datées par rapport à aujourd'hui (captures du Store)
const announced = tab === 'agenda' && param('view') === 'announced';
if (announced) options.storage[STORAGE_KEYS.sequelsState] = announcedDemo(Date.now());
installChromeMock(options);

const zoom = Number(param('zoom') ?? '1');
if (zoom !== 1) document.documentElement.style.zoom = String(zoom);

await import('../../src/sidepanel/sidepanel.ts');

if (tab === 'nowPlaying') {
  // Fiche complète (ordre de visionnage) et compte à rebours de la progression en direct affichés
  await waitFor(() => document.querySelector('[data-focus="panel-section-order"]'));
  await waitFor(() => [...document.querySelectorAll('[role="progressbar"]')].some((bar) => bar.getAttribute('aria-valuenow') !== null && !bar.closest('[hidden]')));
  // `reveal=order` : section « Ordre de visionnage » dépliée (repliée par défaut), vue « Tout » (histoires parallèles
  // comprises) et toutes ses entrées (« Afficher N de plus »), puis amenée en haut du panneau (aucune carte coupée au-dessus)
  if (param('reveal') === 'order') {
    document.querySelector<HTMLElement>('[data-focus="panel-section-order"][aria-expanded="false"]')?.click();
    const header = await waitFor(() => document.querySelector<HTMLElement>('[data-focus="panel-section-order"][aria-expanded="true"]'));
    (await waitFor(() => document.querySelector<HTMLElement>('[data-focus="order-mode-all"]'))).click();
    await waitFor(() => document.querySelector('[data-focus="order-mode-all"][aria-checked="true"]'));
    document.querySelector<HTMLElement>('[data-focus="order-more"]')?.click();
    await waitFor(() => !document.querySelector('[data-focus="order-more"]'));
    const panel = document.querySelector<HTMLElement>('[role="tabpanel"]');
    if (panel) panel.scrollTop += Math.max(0, header.getBoundingClientRect().top - panel.getBoundingClientRect().top - 10);
  }
} else {
  await waitFor(() => document.querySelector('[data-focus^="agenda-open-"]'));
  // Vue « Annoncées » par le vrai sélecteur Semaine / Annoncées
  if (announced) {
    document.querySelector<HTMLElement>('[data-focus="agenda-view-announced"]')?.click();
    await waitFor(() => document.querySelector('[data-sequel-group]'));
  }
}
(document.activeElement as HTMLElement | null)?.blur();
await markReady();
