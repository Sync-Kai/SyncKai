import { beforeEach, describe, expect, it } from 'vitest';
import type { EpisodeInfo } from '../../shared/episode.types';
import { clearMatchDecisions, MATCH_DIAGNOSTIC_MAX, readMatchDecisions } from '../../shared/match-diagnostic';
import { installFakeChrome } from '../../test/fake-chrome';
import { recordMatchDecision, toMatchDecision } from './match-diagnostic';
import type { MediaCandidate, ResolveResult } from './matching/model';

// Diagnostic des correspondances (builds de dev) : décision réduite et liste bornée dans storage.session.

const fake = installFakeChrome();
beforeEach(() => fake.reset());

const episode: EpisodeInfo = {
  platform: 'prime',
  episodeId: 'amzn1.dv.gti.e1',
  seriesId: null,
  seriesSlug: null,
  animeTitle: 'Berserk',
  seasonNumber: 1,
  seasonTitle: null,
  seasonEpisodeNumber: 3,
  displayedEpisodeNumber: 3,
  episodeTitle: null,
  url: 'https://www.primevideo.com/detail/X',
  signals: { seasonYear: 2016, seasonEpisodeCount: 12 },
};

const candidate = (id: number, year: number, episodes: number, relations: MediaCandidate['relations'] = []): MediaCandidate => ({
  id,
  format: 'TV',
  episodes,
  startDate: year * 10_000 + 701,
  titles: ['Berserk'],
  link: null,
  status: 'FINISHED',
  duration: 24,
  relations,
});

const result: ResolveResult = { ok: true, target: { mediaId: 21560, numbering: 'season', offset: 0, episodes: 12, progress: 3, confidence: 'high', reason: 'ok', bySignals: true } };

describe('toMatchDecision', () => {
  it('signaux par candidat, décision et origine de la correspondance', () => {
    const decision = toMatchDecision(
      {
        episode,
        key: 'prime:title:berserk:y2016:s1',
        lane: 'interactive',
        source: 'resolved',
        candidates: [candidate(33, 1997, 25), candidate(21560, 2016, 12)],
        result,
        mapping: { mapping: { mediaId: 33, numbering: 'season', offset: 0, episodes: 25, learned: true }, verdict: 'drop' },
      },
      1_000,
    );
    expect(decision.candidates.map((c) => [c.id, c.startYear, c.checks.seasonYear, c.checks.episodeCount])).toEqual([
      [33, 1997, 'contradict', 'unknown'],
      [21560, 2016, 'agree', 'agree'],
    ]);
    expect(decision.decision).toEqual({ source: 'resolved', mediaId: 21560, confidence: 'high', reason: 'ok', bySignals: true, mapping: { mediaId: 33, origin: 'learned', verdict: 'drop' } });
    expect(decision.signals).toEqual({ seasonYear: 2016, seasonEpisodeCount: 12 });
  });
});

describe('recordMatchDecision', () => {
  it('les plus récentes d’abord, 50 au plus, effacées sur demande', async () => {
    for (let i = 0; i < MATCH_DIAGNOSTIC_MAX + 2; i++) {
      recordMatchDecision({ episode, key: `k${i}`, lane: 'interactive', source: 'ignored', candidates: [], result: { ok: false, reason: 'ignored', ignored: true } });
    }
    await expect.poll(async () => (await readMatchDecisions())[0]?.key).toBe(`k${MATCH_DIAGNOSTIC_MAX + 1}`);
    const decisions = await readMatchDecisions();
    expect(decisions).toHaveLength(MATCH_DIAGNOSTIC_MAX);
    expect(fake.local.peek('debug:matchDiagnostic')).toBeUndefined();
    await clearMatchDecisions();
    expect(await readMatchDecisions()).toEqual([]);
  });
});
