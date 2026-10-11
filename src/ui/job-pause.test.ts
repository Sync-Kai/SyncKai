import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { reduceJob, startJob } from '../shared/job';
import { jobPauseText } from './job-pause';

setLocale('fr');

describe('texte de la pause d’une tâche', () => {
  const job = startJob('demo', ['a'], 0);

  it('quota AniList : compte à rebours, ou « … » si la reprise est inconnue ou échue ; rien hors pause', () => {
    const paused = reduceJob(job, { type: 'pause', until: 12_000, reason: 'budget', service: 'anilist', at: 0 });
    expect(jobPauseText(paused, 0)).toBe('En attente du quota AniList : reprise dans 12 s');
    expect(jobPauseText(paused, 12_000)).toBe('En attente du quota AniList…');
    expect(jobPauseText(reduceJob(paused, { type: 'wait-end', at: 1 }), 1)).toBeNull();
  });

  it('limite 429 : service nommé', () => {
    const paused = reduceJob(job, { type: 'pause', until: 5_000, reason: 'rate-limit', service: 'anilist', at: 0 });
    expect(jobPauseText(paused, 0)).toBe('Pause : limite de requêtes AniList, reprise dans 5 s');
  });
});
