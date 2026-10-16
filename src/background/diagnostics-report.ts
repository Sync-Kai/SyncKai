import { buildCurrentReport } from '../browser/storage/diagnostics-store';
import { readTokenSecrets } from '../browser/tokens/access';
import type { MessageResponse } from '../protocol/messages';

/**
 * GET_DIAGNOSTICS_REPORT (Réglages › Aide, « Copier le rapport ») : rapport construit ici, seul contexte qui déchiffre
 * les jetons (SEC-06). Les jetons servent uniquement à les masquer ; la page ne reçoit que le texte déjà expurgé.
 */
export async function diagnosticsReport(): Promise<MessageResponse<'GET_DIAGNOSTICS_REPORT'>> {
  return { ok: true, data: await buildCurrentReport(await readTokenSecrets()) };
}
