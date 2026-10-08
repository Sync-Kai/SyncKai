// Monte la VRAIE page d'import Crunchyroll (src/import-cr/import-cr.ts) sur l'API chrome simulée : aperçu prêt.
import '../../src/import-cr/import-cr.css';
import { importChrome } from './demo-panel';
import { installChromeMock } from './mock-chrome';
import { localeParam, markReady, param, waitFor } from './params';

installChromeMock(importChrome(localeParam()));

const zoom = Number(param('zoom') ?? '1');
if (zoom !== 1) document.documentElement.style.zoom = String(zoom);

await import('../../src/import-cr/import-cr.ts');

await waitFor(() => document.querySelector('[data-focus="cr-apply"]'));
// Marge haute de la page réduite : l’aperçu et « À vérifier » tiennent dans la fenêtre
window.scrollTo(0, 16);
(document.activeElement as HTMLElement | null)?.blur();
await markReady();
