// Modules `*?script` de crxjs : chemins des scripts Netflix et Disney+ enregistrés à la demande (background/platform-access.ts)
/// <reference types="@crxjs/vite-plugin/client" />
/** Injecté par Vite (voir `define` dans vite.config.ts) */
declare const __SYNCKAI_BUILD__: string;
/** Injecté par Vite : true hors mode production (active les logs debug/info) */
declare const __SYNCKAI_DEBUG__: boolean;
/** Injecté par Vite : navigateur ciblé par le build (`SYNCKAI_TARGET`, chrome par défaut) */
declare const __SYNCKAI_TARGET__: 'chrome' | 'firefox';
/** Injecté par Vite : textes des scripts de contenu en anglais (src/build/content-catalog.ts, PERF-01) */
declare const __SYNCKAI_CONTENT_CATALOGS__: import('./i18n/content-keys').ContentCatalogs;
