// Connexion à un service de suivi depuis l'interface (LOGIN_ANILIST, LOGIN_MAL).
import type { AuthResult } from '../../shared/auth.types';
import type { TrackerId } from '../../shared/tracker.types';
import { endPreviousAccountData } from '../../browser/storage/session-end';
import { hasAniListToken, hasMalToken } from '../../browser/storage/tokens';
import { getCachedMalViewer, getCachedViewer } from '../../browser/storage/viewer-cache';
import { loginWithAniList } from '../anilist/auth';
import { getViewer } from '../anilist/viewer';
import { loginWithMal } from '../mal/auth';
import { getMalViewer } from '../mal/client';

/**
 * Connexion, puis profil préchargé (la popup, souvent fermée pendant l'OAuth, l'affichera aussitôt). Par-dessus une
 * session encore enregistrée (jeton AniList expiré : « Reconnecter ») : si le compte connecté n'est pas celui du profil
 * en cache, ou s'il est inconnu, les données de l'utilisateur de l'ancien compte sont effacées (STO-01, décision 11 b) ;
 * la même personne qui se reconnecte garde les siennes. Identifiants comparés en mémoire seulement, jamais copiés.
 */
export async function signIn(service: TrackerId): Promise<AuthResult> {
  const anilist = service === 'anilist';
  const hadSession = await (anilist ? hasAniListToken() : hasMalToken());
  const previousId = hadSession ? ((await (anilist ? getCachedViewer() : getCachedMalViewer()))?.id ?? null) : undefined;
  const result = await (anilist ? loginWithAniList() : loginWithMal());
  if (!result.ok) return result;
  const viewer = await (anilist ? getViewer() : getMalViewer());
  if (previousId !== undefined && (!viewer.ok || viewer.data.id !== previousId)) await endPreviousAccountData(service);
  return result;
}
