import { t } from '../i18n';
import { createLogger } from '../browser/logger';
import type { NetflixTitlesPayload, NetflixTitlesResult, NetflixTitleVerdict } from '../platforms/netflix/history';
import { normalizeTitle } from '../shared/title';
import { ApiError } from './api/errors';
import { searchAnimeBatch, type AniListMedia } from './api/media';
import { netflixShowIdInLink } from './sync/matching';
import { getConnectedTrackers } from './trackers';

// Import de l'historique Netflix : filtre « anime » des titres de l'historique, AVANT toute requête à Netflix. Une
// recherche AniList par titre (plusieurs titres par requête GraphQL, file de fond, cache du catalogue) ; un titre n'est
// gardé que si une fiche trouvée renvoie vers une série Netflix (/title/{id}) ou porte exactement ce titre. Les titres
// eux-mêmes ne sont jamais journalisés (historique de l'utilisateur).

const log = createLogger('netflix-import');

/** Verdict d'un titre d'après les fiches trouvées par sa recherche (pur, testé) */
export function titleVerdict(title: string, media: readonly Pick<AniListMedia, 'titles' | 'externalLinkUrls'>[]): NetflixTitleVerdict {
  const showIds = [...new Set(media.flatMap((m) => m.externalLinkUrls.flatMap((url) => netflixShowIdInLink(url) ?? [])))];
  const key = normalizeTitle(title);
  const titleMatch = key.length > 0 && media.some((m) => m.titles.some((candidate) => normalizeTitle(candidate) === key));
  return { title, showIds, titleMatch };
}

/** NETFLIX_IMPORT_TITLES : verdict de chaque titre (une requête AniList de fond au plus, rien d'écrit) */
export async function checkNetflixTitles({ titles }: NetflixTitlesPayload): Promise<NetflixTitlesResult> {
  try {
    if ((await getConnectedTrackers()).length === 0) return { ok: false, code: 'NOT_CONNECTED', message: t('crImport.error.notConnected') };
    const results = await searchAnimeBatch(titles, 'background');
    const verdicts = titles.map((title) => titleVerdict(title, results.get(title) ?? []));
    log.info(`Filtre Netflix : ${verdicts.filter((v) => v.showIds.length > 0 || v.titleMatch).length} / ${titles.length} titres gardés`);
    return { ok: true, data: verdicts };
  } catch (error: unknown) {
    if (!(error instanceof ApiError)) log.error('Erreur inattendue (filtre de l’import Netflix) :', error);
    return { ok: false, code: 'API_ERROR', message: error instanceof ApiError ? error.message : t('crImport.error.unexpected') };
  }
}
