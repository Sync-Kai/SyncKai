import { t } from '../../i18n';
import { isViewerQueryData, type AniListViewer, type ViewerResult } from '../../shared/anilist.types';
import { getSessionEpoch, saveCachedViewer } from '../../shared/storage';
import { toSafeUrl } from '../../shared/url';
import { anilistQuery } from './client';
import { ApiError } from './errors';
import { createLogger } from '../../shared/logger';

const log = createLogger('anilist');

const VIEWER_QUERY = /* GraphQL */ `
  query Viewer {
    Viewer {
      id
      name
      siteUrl
      avatar { medium }
    }
  }
`;

/** Récupère le profil de l'utilisateur connecté et le met en cache (si la session n'a pas changé pendant la requête). */
export async function getViewer(): Promise<ViewerResult> {
  try {
    // Génération relevée avant la requête : une déconnexion pendant celle-ci rend le profil obsolète (AUTH-04)
    const epoch = await getSessionEpoch('anilist');
    const { Viewer } = await anilistQuery(VIEWER_QUERY, isViewerQueryData);
    const viewer: AniListViewer = {
      id: Viewer.id,
      name: Viewer.name,
      siteUrl: toSafeUrl(Viewer.siteUrl, 'anilist.co') ?? `https://anilist.co/user/${Viewer.id}`,
      avatarUrl: toSafeUrl(Viewer.avatar?.medium),
    };
    if (!(await saveCachedViewer(viewer, epoch))) {
      // Ni profil de l'ancien compte en cache, ni renvoyé à l'interface
      return { ok: false, code: 'NOT_AUTHENTICATED', message: t('api.notAuthenticated', { service: 'AniList' }) };
    }
    return { ok: true, data: viewer };
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return { ok: false, code: error.code, message: error.message };
    }
    log.error('Erreur inattendue (getViewer) :', error);
    return { ok: false, code: 'API_ERROR', message: t('api.profileLoadFailed') };
  }
}
