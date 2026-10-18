import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { startAnalyzeJob, startApplyJob, type CrImportJob, type CrImportPlan } from '../shared/cr-import';
import { reduceJob } from '../shared/job';
import { connectStep, type PlatformTab } from './state';
import { analyzeEnd, currentStep, importScreen, jobProgress, netflixPhases, platformStatus, readingStatus, readStep, type ReadingStep } from './view';

// Page d'import : écran affiché, étape de l'indicateur, état de chaque plateforme, textes de lecture et d'analyse.

const PLAN: CrImportPlan = { builtAt: 1, services: ['anilist'], stats: { items: 0, pages: 0, partial: false }, seasonCount: 0, items: [], review: [], excluded: 0, failed: 0 };

const analyze = (patch: Partial<CrImportJob> = {}): CrImportJob => ({ ...startAnalyzeJob(4, 0).job, ...patch });
const apply = (patch: Partial<CrImportJob> = {}): CrImportJob => ({ ...startApplyJob(['m:1', 'm:2'], 0).job, ...patch });
const tab = (patch: Partial<PlatformTab> = {}): PlatformTab => ({ access: true, tabId: null, tabTitle: null, ...patch });

const reading: Extract<ReadingStep, { kind: 'reading' }> = { kind: 'reading', pages: 0, items: 0, lookups: 0, lookupsTotal: 0, tabId: 7 };
const netflix = (patch: Partial<Extract<ReadingStep, { kind: 'netflix' }>> = {}): Extract<ReadingStep, { kind: 'netflix' }> => ({ kind: 'netflix', phase: 'rows', done: 0, total: 0, rows: 0, titles: 0, tabId: 9, ...patch });

describe('page d’import : écran affiché', () => {
  const page = (patch: Partial<Parameters<typeof importScreen>[0]> = {}) => importScreen({ loaded: true, job: null, plan: null, step: connectStep(), ...patch });

  it('chargement, puis choix de la plateforme', () => {
    expect(page({ loaded: false }).kind).toBe('loading');
    // Tâche ou aperçu déjà relus pendant le chargement : rien n'est montré avant la fin
    expect(page({ loaded: false, plan: PLAN, job: analyze() }).kind).toBe('loading');
    expect(page().kind).toBe('choose');
  });

  it('lecture de l’historique (Crunchyroll / ADN, Netflix), puis démarrage de l’analyse', () => {
    expect(page({ step: reading })).toEqual({ kind: 'reading', step: reading });
    expect(page({ step: netflix() }).kind).toBe('reading');
    expect(page({ step: { kind: 'starting' } }).kind).toBe('starting');
  });

  it('analyse en cours : elle l’emporte sur l’écran de connexion (page rouverte, autre onglet)', () => {
    const job = analyze();
    expect(page({ job })).toEqual({ kind: 'analyzing', job });
    expect(page({ job, step: reading }).kind).toBe('analyzing');
  });

  it('analyse arrêtée ou interrompue sans aperçu : son bilan ; finie : retour au choix', () => {
    const stopped = analyze({ status: 'stopped', message: 'Session expirée' });
    expect(page({ job: stopped })).toEqual({ kind: 'analyze-ended', job: stopped });
    expect(page({ job: analyze({ status: 'cancelled' }) }).kind).toBe('analyze-ended');
    expect(page({ job: analyze({ status: 'done' }) }).kind).toBe('choose');
  });

  it('aperçu en attente : affiché tel quel, avec l’import en cours ou son bilan', () => {
    expect(page({ plan: PLAN })).toEqual({ kind: 'preview', plan: PLAN, job: null });
    const running = apply();
    expect(page({ plan: PLAN, job: running })).toEqual({ kind: 'preview', plan: PLAN, job: running });
    // Bilan de l'analyse qui a produit l'aperçu : pas un import
    expect(page({ plan: PLAN, job: analyze({ status: 'done' }) })).toEqual({ kind: 'preview', plan: PLAN, job: null });
  });
});

describe('page d’import : étape de l’indicateur', () => {
  it('1 plateforme, 2 lecture, 3 analyse, 4 aperçu, 5 import, 6 tout fait', () => {
    expect(currentStep({ kind: 'loading' })).toBe(1);
    expect(currentStep({ kind: 'choose' })).toBe(1);
    expect(currentStep({ kind: 'reading', step: reading })).toBe(2);
    expect(currentStep({ kind: 'starting' })).toBe(3);
    expect(currentStep({ kind: 'analyzing', job: analyze() })).toBe(3);
    expect(currentStep({ kind: 'analyze-ended', job: analyze({ status: 'stopped' }) })).toBe(3);
    expect(currentStep({ kind: 'preview', plan: PLAN, job: null })).toBe(4);
    expect(currentStep({ kind: 'preview', plan: PLAN, job: apply() })).toBe(5);
    expect(currentStep({ kind: 'preview', plan: PLAN, job: apply({ status: 'done' }) })).toBe(6);
    // Import arrêté ou interrompu : l'étape 5 reste en cours (bilan, séries pas encore écrites)
    expect(currentStep({ kind: 'preview', plan: PLAN, job: apply({ status: 'cancelled' }) })).toBe(5);
    expect(currentStep({ kind: 'preview', plan: PLAN, job: apply({ status: 'stopped', message: 'Session expirée' }) })).toBe(5);
  });
});

describe('page d’import : état d’une plateforme (tuile et barre d’action)', () => {
  it('accès refusé avant tout (Netflix optionnel, accès retiré sur Firefox)', () => {
    expect(platformStatus(tab({ access: false, tabId: 7 }), false)).toEqual({ kind: 'access' });
    expect(platformStatus(tab({ access: false }), true)).toEqual({ kind: 'access' });
  });

  it('onglet trouvé (avec son titre), en attente de l’onglet ouvert, aucun onglet', () => {
    expect(platformStatus(tab({ tabId: 7, tabTitle: 'Crunchyroll' }), false)).toEqual({ kind: 'ready', tabId: 7, title: 'Crunchyroll' });
    // Onglet trouvé pendant l'attente : prêt
    expect(platformStatus(tab({ tabId: 7 }), true)).toEqual({ kind: 'ready', tabId: 7, title: null });
    expect(platformStatus(tab(), true)).toEqual({ kind: 'waiting' });
    expect(platformStatus(tab(), false)).toEqual({ kind: 'none' });
    // Accès pas encore relu : comme accordé (le chargement ne montre aucune tuile)
    expect(platformStatus(tab({ access: null }), false)).toEqual({ kind: 'none' });
  });
});

describe('page d’import : lecture de l’historique', () => {
  it('Crunchyroll / ADN : connexion, pages lues (sans total), puis vérification de la numérotation (avec barre)', () => {
    expect(readingStatus(reading, 'Crunchyroll')).toEqual({ text: t('crImport.read.starting', { platform: 'Crunchyroll' }), progress: null });
    const pages: typeof reading = { ...reading, pages: 14, items: 1236 };
    expect(readingStatus(pages, 'Crunchyroll')).toEqual({ text: t('crImport.read.progress', { pages: 14, items: 1236 }), progress: null });
    const lookups: typeof reading = { ...reading, pages: 14, items: 1236, lookups: 38, lookupsTotal: 52 };
    expect(readingStatus(lookups, 'Crunchyroll')).toEqual({ text: t('crImport.read.lookups', { done: 38, total: 52 }), progress: { done: 38, total: 52 } });
  });

  it('Netflix en trois temps : lignes, titres sur AniList, progression des séries gardées', () => {
    expect(netflixPhases(netflix())).toEqual([
      { id: 'rows', state: 'current', text: t('crImport.read.starting', { platform: 'Netflix' }), progress: null },
      { id: 'titles', state: 'pending', text: t('crImport.netflix.titlesNext'), progress: null },
      { id: 'shows', state: 'pending', text: t('crImport.netflix.showsNext'), progress: null },
    ]);
    expect(netflixPhases(netflix({ done: 214, rows: 214 }))[0]).toEqual({ id: 'rows', state: 'current', text: t('crImport.netflix.rows', { rows: 214 }), progress: null });
    expect(netflixPhases(netflix({ phase: 'titles', done: 40, total: 96, rows: 214, titles: 96 }))).toEqual([
      { id: 'rows', state: 'done', text: t('crImport.netflix.rowsDone', { rows: 214 }), progress: null },
      { id: 'titles', state: 'current', text: t('crImport.netflix.titles', { done: 40, total: 96 }), progress: { done: 40, total: 96 } },
      { id: 'shows', state: 'pending', text: t('crImport.netflix.showsNext'), progress: null },
    ]);
    expect(netflixPhases(netflix({ phase: 'shows', done: 3, total: 5, rows: 214, titles: 96 })).map((phase) => [phase.id, phase.state])).toEqual([
      ['rows', 'done'],
      ['titles', 'done'],
      ['shows', 'current'],
    ]);
    // Titres tous lus : leur compte reste affiché
    expect(netflixPhases(netflix({ phase: 'shows', done: 0, total: 5, rows: 214, titles: 96 }))[1]?.text).toBe(t('crImport.netflix.titles', { done: 96, total: 96 }));
  });

  it('progression Netflix : lignes chargées et titres filtrés gardés pour les étapes suivantes', () => {
    let step = readStep(connectStep(), { kind: 'netflix', phase: 'rows', done: 0, total: 0 }, 9);
    expect(step).toEqual({ kind: 'netflix', phase: 'rows', done: 0, total: 0, rows: 0, titles: 0, tabId: 9 });
    step = readStep(step, { kind: 'netflix', phase: 'rows', done: 45, total: 0 }, 9);
    step = readStep(step, { kind: 'netflix', phase: 'titles', done: 0, total: 41 }, 9);
    expect(step).toEqual({ kind: 'netflix', phase: 'titles', done: 0, total: 41, rows: 45, titles: 41, tabId: 9 });
    expect(readStep(step, { kind: 'netflix', phase: 'shows', done: 1, total: 3 }, 9)).toMatchObject({ phase: 'shows', rows: 45, titles: 41 });
    // Crunchyroll / ADN : progression telle quelle
    expect(readStep(connectStep(), { kind: 'reading', pages: 1, items: 100, lookups: 0, lookupsTotal: 0 }, 7)).toEqual({ kind: 'reading', pages: 1, items: 100, lookups: 0, lookupsTotal: 0, tabId: 7 });
  });
});

describe('page d’import : tâche de fond (analyse, import)', () => {
  it('analyse : saisons analysées, sans l’étape finale (lecture des listes) dans le total', () => {
    const job = reduceJob(analyze(), { type: 'item', outcome: 'updated', at: 1 });
    expect(jobProgress(job)).toEqual({ analyzing: true, done: 1, total: 4, finalizing: false, text: t('crImport.analyze.running', { done: 1, total: 4 }) });
  });

  it('analyse : dernière étape, barre pleine qui n’avance plus', () => {
    expect(jobProgress(analyze({ done: 4 }))).toEqual({ analyzing: true, done: 4, total: 4, finalizing: true, text: t('crImport.analyze.finalizing') });
  });

  it('import : séries écrites', () => {
    expect(jobProgress(apply({ done: 1 }))).toEqual({ analyzing: false, done: 1, total: 2, finalizing: false, text: t('crImport.apply.running', { done: 1, total: 2 }) });
  });

  it('bilan d’une analyse sans aperçu : interrompue (erreur, raison) ou arrêtée (attention)', () => {
    expect(analyzeEnd(analyze({ status: 'stopped', message: 'Session AniList expirée.' }))).toEqual({ tone: 'error', text: t('crImport.analyze.stopped', { message: 'Session AniList expirée.' }) });
    expect(analyzeEnd(analyze({ status: 'cancelled' }))).toEqual({ tone: 'warn', text: t('crImport.analyze.cancelled') });
  });
});
