import { beforeEach, describe, expect, it } from 'vitest';
import { installFakeChrome } from '../test/fake-chrome';
import { sealToken } from '../browser/tokens/crypto';
import type { AniListToken } from '../shared/auth.types';
import type { MalToken } from '../shared/mal.types';
import { isAllowedOrigin, isRuntimeMessage } from './message-guards';

// Rapport de diagnostic (Réglages › Aide, SEC-06) : construit et expurgé dans le service worker, seul contexte qui
// déchiffre les jetons. La page ne reçoit que le texte final. Jetons factices, jamais de vrais jetons.

const fake = installFakeChrome({
  extensionId: 'synckai-test',
  extra: {
    runtime: {
      id: 'synckai-test',
      getURL: (path: string) => `chrome-extension://synckai-test/${path.replace(/^\//, '')}`,
      getManifest: () => ({ version: '9.9.9' }),
    },
  },
});

const { diagnosticsReport } = await import('./diagnostics-report');

// Formes de JWT et de jetons MAL, factices
const ANILIST_ACCESS = 'eyJfake.anilistAccessTokenForTests.sig';
const MAL_ACCESS = 'malAccessTokenForTestsOnly1234';
const MAL_REFRESH = 'malRefreshTokenForTestsOnly5678';

beforeEach(async () => {
  const anilist: AniListToken = { accessToken: ANILIST_ACCESS, expiresAt: Number.MAX_SAFE_INTEGER };
  const mal: MalToken = { accessToken: MAL_ACCESS, refreshToken: MAL_REFRESH, expiresAt: Number.MAX_SAFE_INTEGER };
  fake.reset({
    anilistToken: await sealToken('anilist', anilist),
    malToken: await sealToken('mal', mal),
    anilistViewer: { id: 1, name: 'KaiFanAniList' },
    malViewer: { id: 2, name: 'KaiFanMal' },
    // Journal où des secrets auraient fuité malgré l'expurgation à l'écriture
    'diagnostics:log': [
      { at: 1, level: 'error', scope: 'sync', message: `requête refusée ${ANILIST_ACCESS} pour KaiFanAniList` },
      { at: 2, level: 'warn', scope: 'auth', message: `refresh ${MAL_REFRESH} / ${MAL_ACCESS} de KaiFanMal` },
    ],
  });
});

describe('GET_DIAGNOSTICS_REPORT (SEC-06)', () => {
  it('rapport construit dans le service worker : jetons déchiffrés et noms de compte masqués', async () => {
    const result = await diagnosticsReport();
    expect(result.ok).toBe(true);
    const report = result.ok ? result.data : '';
    expect(report).toContain('9.9.9');
    expect(report).toContain('[REDACTED]');
    for (const secret of [ANILIST_ACCESS, MAL_ACCESS, MAL_REFRESH, 'KaiFanAniList', 'KaiFanMal']) expect(report).not.toContain(secret);
  });

  it('demandé par une page de l’extension seulement, sans payload', () => {
    expect(isRuntimeMessage({ type: 'GET_DIAGNOSTICS_REPORT', payload: null })).toBe(true);
    expect(isRuntimeMessage({ type: 'GET_DIAGNOSTICS_REPORT', payload: {} })).toBe(false);
    expect(isAllowedOrigin('GET_DIAGNOSTICS_REPORT', 'extension')).toBe(true);
    expect(isAllowedOrigin('GET_DIAGNOSTICS_REPORT', 'content')).toBe(false);
  });
});
