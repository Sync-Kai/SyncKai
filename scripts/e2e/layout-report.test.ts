import { describe, expect, it } from 'vitest';
import type { LayoutIssue } from './layout-probe';
import { allows, buildReport, parseAllowlist, type Finding } from './layout-report';

const issue = (patch: Partial<LayoutIssue> = {}): LayoutIssue => ({
  id: 1,
  kind: 'truncated',
  dx: 23.5,
  dy: 0,
  text: 'Nächster Versuch in 13 Min.',
  keys: ['queue.nextAttempt'],
  source: 'catalog',
  flagged: true,
  path: 'main > ul > li > span',
  focus: null,
  rect: { x: 0, y: 0, width: 100, height: 16 },
  ...patch,
});

const finding = (patch: Partial<Finding> = {}): Finding => ({ ...issue(), locale: 'de', screen: 'popup/activity', screenshot: 'de/popup-activity.png', ...patch });

describe('parseAllowlist', () => {
  it('accepte une liste vide et des entrées complètes', () => {
    expect(parseAllowlist({ $comment: 'format', allow: [] })).toEqual([]);
    expect(parseAllowlist({ allow: [{ locale: 'de', screen: 'panel-320/*', kind: 'truncated', key: 'panel.tab.agenda', reason: 'accepté' }] })).toEqual([
      { locale: 'de', screen: 'panel-320/*', kind: 'truncated', key: 'panel.tab.agenda', reason: 'accepté' },
    ]);
  });

  it('refuse une entrée sans raison, un champ inconnu ou un type inconnu', () => {
    expect(() => parseAllowlist({ allow: [{ locale: 'de' }] })).toThrow(/reason/);
    expect(() => parseAllowlist({ allow: [{ locale: 'de', reason: 'x', width: '320' }] })).toThrow(/width/);
    expect(() => parseAllowlist({ allow: [{ kind: 'wrapped', reason: 'x' }] })).toThrow(/wrapped/);
    expect(() => parseAllowlist([])).toThrow(/allow/);
  });
});

describe('allows', () => {
  it('toutes les conditions renseignées doivent correspondre (langue, écran ou préfixe, type, clé, texte)', () => {
    const f = finding();
    expect(allows({ reason: 'x' }, f)).toBe(true);
    expect(allows({ locale: '*', screen: 'popup/*', key: 'queue.nextAttempt', reason: 'x' }, f)).toBe(true);
    expect(allows({ locale: 'de', screen: 'popup/activity', kind: 'truncated', text: 'Versuch', reason: 'x' }, f)).toBe(true);
    expect(allows({ locale: 'fr', reason: 'x' }, f)).toBe(false);
    expect(allows({ screen: 'panel-320/*', reason: 'x' }, f)).toBe(false);
    expect(allows({ key: 'queue.failed', reason: 'x' }, f)).toBe(false);
    expect(allows({ kind: 'overflow', reason: 'x' }, f)).toBe(false);
  });
});

describe('buildReport', () => {
  const base = { generatedAt: new Date('2026-10-14T00:00:00Z'), durationMs: 61_000, outDir: '/tmp/layout', locales: ['de', 'fr'], errors: [] };

  it('échecs = anomalies signalées hors exceptions ; troncatures ignorées et exceptions inutilisées rapportées', () => {
    const report = buildReport({
      ...base,
      screens: [
        { locale: 'de', screen: 'popup/activity', screenshot: 'de/popup-activity.png', issues: [issue(), issue({ id: 2, flagged: false, source: 'data', text: 'Frieren', keys: [] })] },
        { locale: 'fr', screen: 'panel-320/now-playing', screenshot: 'fr/panel-320-now-playing.png', issues: [issue({ keys: ['page.action.PAUSED'], text: 'Pause', focus: 'page-status-PAUSED' })] },
      ],
      allowlist: [
        { locale: 'fr', key: 'page.action.PAUSED', reason: 'accepté à 320 px' },
        { locale: 'de', key: 'queue.failed', reason: 'plus d’actualité' },
      ],
    });
    expect(report.failures.map((f) => `${f.locale} ${f.keys[0] ?? ''}`)).toEqual(['de queue.nextAttempt']);
    const json: unknown = JSON.parse(report.json);
    expect(json).toMatchObject({ summary: { findings: 1, allowed: 1, ignored: 1 }, staleAllowlist: [{ key: 'queue.failed' }] });
    expect(report.markdown).toContain('**1 findings** (1 allowlisted)');
    expect(report.markdown).toContain('| de | 1 | 0 | 1 | 0 |');
    expect(report.markdown).toContain('[screenshot](de/popup-activity.png)');
    expect(report.markdown).toContain('## Stale allowlist entries');
  });

  it('regroupe un même élément (data-focus) relevé dans plusieurs langues', () => {
    const shared = { keys: ['page.action.DROPPED'], focus: 'page-status-DROPPED' };
    const report = buildReport({
      ...base,
      screens: [
        { locale: 'de', screen: 'panel-320/now-playing', screenshot: 'de/a.png', issues: [issue({ ...shared, text: 'Abbrechen', dx: 4 })] },
        { locale: 'fr', screen: 'panel-360/now-playing', screenshot: 'fr/a.png', issues: [issue({ ...shared, text: 'Abandonner', dx: 9 })] },
      ],
      allowlist: [],
    });
    expect(JSON.parse(report.json)).toMatchObject({ summary: { byElement: [{ element: 'panel [data-focus=page-status-DROPPED]', locales: ['de', 'fr'], max: 9 }] } });
  });
});
