// Valeur de __SYNCKAI_CONTENT_CATALOGS__ pour le serveur Vite du harnais, calculée comme dans vite.config.ts.
// Chargé par runnerImport (harness.ts) : Node seul ne résout pas les imports sans extension de src/.
import { contentCatalogsDefine } from '../../src/build/content-catalog';
import en from '../../src/i18n/locales/en.json';

export const CONTENT_CATALOGS_DEFINE: string = contentCatalogsDefine(en);
