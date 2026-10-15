import { describe, expect, it } from 'vitest';
import type { MatchDecision } from '../../shared/match-diagnostic';
import { decisionJson, matchDecisionsJson } from './match-diagnostic';

function decision(at: number, key: string, mediaId: number | null): MatchDecision {
  return {
    at,
    platform: 'crunchyroll',
    key,
    lane: 'interactive',
    seriesTitle: 'Frieren',
    seasonTitle: null,
    seasonNumber: 1,
    seasonEpisodeNumber: 3,
    displayedEpisodeNumber: 3,
    signals: { seasonYear: 2023 },
    candidates: [],
    decision: { source: 'resolved', mediaId, confidence: 'high', reason: 'linked', bySignals: false, mapping: null },
  };
}

describe('Diagnostic des correspondances : copies JSON', () => {
  const decisions = [decision(3, 'crunchyroll:b:s1', 154587), decision(2, 'crunchyroll:a:s1', null), decision(1, 'netflix:1:s1', 21)];

  it('« Tout copier » : un tableau JSON de toutes les décisions, dans l’ordre affiché (les plus récentes d’abord)', () => {
    const parsed: unknown = JSON.parse(matchDecisionsJson(decisions));
    expect(parsed).toEqual(decisions);
    expect(Array.isArray(parsed) && parsed.map((entry: MatchDecision) => entry.at)).toEqual([3, 2, 1]);
  });

  it('même forme que la copie d’une décision : chaque élément vaut le JSON copié seul', () => {
    const parsed = JSON.parse(matchDecisionsJson(decisions)) as unknown[];
    expect(parsed).toEqual(decisions.map((entry) => JSON.parse(decisionJson(entry)) as unknown));
    // Indentation de la copie d'une décision gardée (lisible une fois collée)
    expect(matchDecisionsJson(decisions)).toContain('\n    "at": 3,');
  });

  it('aucune décision : tableau vide', () => {
    expect(matchDecisionsJson([])).toBe('[]');
  });
});
