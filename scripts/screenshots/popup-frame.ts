// Monte le VRAI popup (src/popup/popup.ts) avec l'API chrome simulée et les données de démo.
import '../../src/popup/popup.css';
import { demoChrome, type Scenario } from './demo-data';
import { installChromeMock } from './mock-chrome';
import { loadedLocaleParam, markReady, param, waitFor } from './params';
import { isSettingsSubPage, SETTINGS_PAGE_PARENTS, type SettingsSubPage } from '../../src/ui/settings/navigation';

const SCENARIOS: readonly Scenario[] = ['watching', 'menu', 'page', 'activity', 'compare', 'settings', 'foryou', 'stats'];
const scenario = SCENARIOS.find((s) => s === param('scenario')) ?? 'watching';

installChromeMock(demoChrome(await loadedLocaleParam(), scenario));
// Tirage de « Pour toi » reproductible (seul usage de Math.random dans src/) : 0,6 tombe sur la 4e fiche du lot pondéré
// (Jujutsu Kaisen, « Parce que tu as noté Dandadan »), une série absente des listes montrées sur les autres captures
Math.random = () => 0.6;
await import('../../src/popup/popup.ts');

// Zoom appliqué avant la navigation : les défilements se calculent à l'échelle finale
const zoom = Number(param('zoom') ?? '1');
if (zoom !== 1) document.documentElement.style.zoom = String(zoom);

const find = (selector: string): Promise<HTMLElement> => waitFor(() => document.querySelector<HTMLElement>(selector));
const click = async (selector: string): Promise<void> => (await find(selector)).click();

// Navigation par les vrais boutons, une fois les comptes chargés
await waitFor(() => document.querySelector('[data-focus="rail-activity"]') && document.querySelector('main section'));
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
    await click('[data-focus="rail-activity"]');
    await waitFor(() => document.querySelector('main article button[aria-pressed="true"]'));
    break;
  case 'foryou':
    // « Pour toi » par le vrai bouton du rail : puces de genre, choix du format et fiches affichés
    await click('[data-focus="rail-foryou"]');
    await find('[data-screen="foryou"] [data-reco-filters]');
    break;
  case 'stats':
    // « Stats » par le vrai bouton du rail : activité et blocs du profil affichés
    await click('[data-focus="rail-stats"]');
    await find('[data-screen="stats"] [data-stats-block]');
    break;
  case 'compare':
    // Réglages › Mes données › Écarts AniList ↔ MAL, analyse de démo affichée
    await click('[data-focus="gear"]');
    await click('[data-focus="settings-cat-data"]');
    await click('[data-focus="settings-cat-compare"]');
    await find('[data-diff]');
    break;
  case 'settings': {
    // Accueil des Réglages, ou page via `settingsPage` (SETTINGS_SUBPAGES : accounts, sync, …, language, shortcuts)
    await click('[data-focus="gear"]');
    await waitFor(() => document.querySelector('[data-account-summary]:not([data-account-summary="loading"])') && document.querySelector('[data-focus="sk-quick-auto"]'));
    const settingsPage = param('settingsPage');
    if (isSettingsSubPage(settingsPage)) {
      // Page de second niveau : par sa page parente, comme à la main
      const trail: SettingsSubPage[] = [];
      for (let id: SettingsSubPage | 'home' = settingsPage; id !== 'home'; id = SETTINGS_PAGE_PARENTS[id]) trail.unshift(id);
      for (const id of trail) {
        await click(`[data-focus="settings-cat-${id}"]`);
        await find('[data-focus="settings-home"]');
      }
      // Comptes : profils chargés avant la capture
      if (settingsPage === 'accounts') await waitFor(() => [...document.querySelectorAll('[data-account-status]')].some((status) => status.textContent?.includes('Kai_fan')));
    }
    break;
  }
}
// Pas de focus visible sur le bouton cliqué ni sur le premier élément du menu
(document.activeElement as HTMLElement | null)?.blur();

await markReady();
