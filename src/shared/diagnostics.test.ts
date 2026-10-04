import { describe, expect, it } from 'vitest';
import { buildDiagnosticsReport, buildIssueUrl, describeBrowser, MAX_ISSUE_URL_LENGTH, type DiagnosticsInput } from './diagnostics';
import { DEFAULT_SETTINGS } from './settings';

const FAKE_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI0MiJ9.ZmFrZS1zaWduYXR1cmU';
const FAKE_REFRESH = 'def50200a1b2c3d4e5f6refresh';
const ACCOUNT = 'KaiFan42';

function input(overrides: Partial<DiagnosticsInput> = {}): DiagnosticsInput {
  return {
    generatedAt: Date.UTC(2026, 9, 5, 12),
    version: '1.7.3',
    buildMode: 'production',
    browser: 'Google Chrome 129 · Windows',
    uiLocale: 'fr',
    browserLanguage: 'fr-FR',
    settings: DEFAULT_SETTINGS,
    services: { anilist: true, mal: false },
    counters: { mappings: 3, excludedSeries: 1, pendingReviews: 0, queuePending: 2, queueFailed: 1, pendingRatings: 0, recentSyncs: 5 },
    airing: { checkedAt: Date.UTC(2026, 9, 5, 11), notified: 1, skipped: null, error: null },
    journal: [{ at: Date.UTC(2026, 9, 5, 10), level: 'error', scope: 'sync', message: 'TypeError: Failed to fetch' }],
    sensitiveValues: [],
    ...overrides,
  };
}

describe('buildDiagnosticsReport', () => {
  it('contient version, navigateur, réglages, compteurs et journal', () => {
    const report = buildDiagnosticsReport(input());
    expect(report).toContain('- Version: 1.7.3 (production)');
    expect(report).toContain('- Browser: Google Chrome 129 · Windows');
    expect(report).toContain('- Language: UI fr, browser fr-FR');
    expect(report).toContain('- AniList: connected');
    expect(report).toContain('- MyAnimeList: not connected');
    expect(report).toContain('- completionPercentage: 85');
    expect(report).toContain('- Sync queue: 2 pending, 1 failed');
    expect(report).toContain('- Last check: 2026-10-05T11:00:00.000Z · notified 1');
    expect(report).toContain('2026-10-05T10:00:00.000Z ERROR [sync] TypeError: Failed to fetch');
  });

  it('indique l’absence d’erreurs et de vérification', () => {
    const report = buildDiagnosticsReport(input({ journal: [], airing: null }));
    expect(report).toContain('### Recent errors (0)\n- None');
    expect(report).toContain('- Never run');
  });

  it('ne laisse jamais passer un token ni un nom de compte présents dans les entrées', () => {
    const report = buildDiagnosticsReport(
      input({
        journal: [
          { at: 1, level: 'error', scope: 'auth', message: `Token ${FAKE_TOKEN} refusé pour ${ACCOUNT}` },
          { at: 2, level: 'warn', scope: 'mal', message: `refresh ${FAKE_REFRESH} expiré` },
          { at: 3, level: 'warn', scope: 'auth', message: 'redirect #access_token=plainsecret99&expires_in=1' },
        ],
        airing: { checkedAt: 4, notified: 0, skipped: null, error: `Bearer ${FAKE_REFRESH}` },
        sensitiveValues: [FAKE_TOKEN, FAKE_REFRESH, ACCOUNT],
      }),
    );
    for (const secret of [FAKE_TOKEN, FAKE_REFRESH, ACCOUNT, 'plainsecret99']) expect(report).not.toContain(secret);
    expect(report).toContain('[REDACTED]');
  });

  it('neutralise les sauts de ligne et ``` des messages', () => {
    const report = buildDiagnosticsReport(input({ journal: [{ at: 1, level: 'warn', scope: 's', message: 'a\n```b' }] }));
    expect(report).toContain("a ↵ '''b");
  });
});

describe('describeBrowser', () => {
  it('préfère la marque précise de userAgentData', () => {
    const uaData = { brands: [{ brand: 'Not)A;Brand', version: '99' }, { brand: 'Chromium', version: '129' }, { brand: 'Google Chrome', version: '129' }], platform: 'Windows' };
    expect(describeBrowser(uaData, 'UA')).toBe('Google Chrome 129 · Windows');
  });

  it('retombe sur Chromium puis sur l’user agent', () => {
    expect(describeBrowser({ brands: [{ brand: 'Chromium', version: '129' }], platform: '' }, 'UA')).toBe('Chromium 129');
    expect(describeBrowser(undefined, 'Mozilla/5.0 Chrome/129')).toBe('Mozilla/5.0 Chrome/129');
  });
});

describe('buildIssueUrl', () => {
  it.each(['fr', 'en', 'de'] as const)('prérempli et court en %s', (locale) => {
    const url = buildIssueUrl({ version: '1.7.3', browser: 'Google Chrome 129 · Windows', locale });
    expect(url.startsWith('https://github.com/Sync-Kai/SyncKai/issues/new?')).toBe(true);
    expect(url.length).toBeLessThan(MAX_ISSUE_URL_LENGTH);
    const body = new URL(url).searchParams.get('body') ?? '';
    expect(body).toContain('1.7.3');
    expect(body).toContain('Google Chrome 129');
  });

  it('utilise la langue de l’interface', () => {
    const body = new URL(buildIssueUrl({ version: '1', browser: 'b', locale: 'fr' })).searchParams.get('body') ?? '';
    expect(body).toContain('Réglages › Aide › Copier le rapport');
  });

  it('tronque un navigateur trop long', () => {
    expect(buildIssueUrl({ version: '1', browser: 'x'.repeat(5000), locale: 'en' }).length).toBeLessThan(MAX_ISSUE_URL_LENGTH);
  });
});
