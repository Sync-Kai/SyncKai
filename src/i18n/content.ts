// Traductions des scripts de contenu : seules les clés de `content-keys.ts`, dans les trois langues, extraites des
// catalogues au build (`define` de vite.config.ts, voir src/build/content-catalog.ts) au lieu des catalogues complets
// (PERF-01). Importé par les modules de `content/` ; les modules partagés qu'ils utilisent importent `./core`.
import { registerCatalogs } from './core';

registerCatalogs(__SYNCKAI_CONTENT_CATALOGS__);

export * from './core';
