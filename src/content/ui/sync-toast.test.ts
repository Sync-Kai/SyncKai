import { describe, expect, it } from 'vitest';
import type { SyncOutcome } from '../../shared/sync.types';
import { ALERT_TOAST_MS, PILL_TOAST_MS, SUCCESS_TOAST_MS, engagementResultToast, pillForOutcome, toastForOutcome } from './sync-toast';
import { setLocale } from '../../i18n';

// Textes attendus en français
setLocale('fr');

const synced: SyncOutcome = {
  status: 'synced',
  mediaTitle: 'Tougen Anki',
  results: [
    { service: 'anilist', outcome: { status: 'updated', progress: 2, completed: false } },
    { service: 'mal', outcome: { status: 'up-to-date', progress: 2 } },
  ],
};

describe('toastForOutcome', () => {
  it('discreet : pastille 3 s avec le numéro et le titre', () => {
    expect(toastForOutcome(synced, 'discreet', false)).toEqual({
      content: { tone: 'success', title: 'Ép. 2 enregistré', message: 'Tougen Anki' },
      variant: 'pill',
      autoHideMs: PILL_TOAST_MS,
    });
  });

  it('discreet en plein écran : rien', () => {
    expect(toastForOutcome(synced, 'discreet', true)).toBeNull();
  });

  it('detailed : bulle 5 s avec une ligne par service', () => {
    expect(toastForOutcome(synced, 'detailed', false)).toEqual({
      content: {
        tone: 'success',
        title: 'Tougen Anki',
        lines: [
          { label: 'AniList', text: 'épisode 2 enregistré', tone: 'ok' },
          { label: 'MyAnimeList', text: 'déjà à jour (épisode 2)', tone: 'neutral' },
        ],
      },
      variant: 'bubble',
      autoHideMs: SUCCESS_TOAST_MS,
    });
  });

  it('alerts-only : rien pour un succès, bulle 9 s pour une vérification', () => {
    expect(toastForOutcome(synced, 'alerts-only', false)).toBeNull();
    const review = toastForOutcome({ status: 'needs-review', reason: 'Fiche incertaine' }, 'alerts-only', true);
    expect(review?.variant).toBe('bubble');
    expect(review?.autoHideMs).toBe(ALERT_TOAST_MS);
    expect(review?.content.title).toBe('À vérifier dans SyncKai');
  });
});

describe('pillForOutcome', () => {
  it('aucun service modifié : "déjà à jour"', () => {
    const outcome: SyncOutcome = { status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: { status: 'up-to-date', progress: 7 } }] };
    expect(pillForOutcome(outcome)).toEqual({ tone: 'success', title: 'Ép. 7 déjà à jour', message: 'Frieren' });
  });
});

describe('toastForOutcome — série exclue', () => {
  const excluded: SyncOutcome = { status: 'excluded', mediaTitle: 'One Piece' };

  it('rien en discret (même hors plein écran) ni en alertes seulement', () => {
    expect(toastForOutcome(excluded, 'discreet', false)).toBeNull();
    expect(toastForOutcome(excluded, 'alerts-only', false)).toBeNull();
  });

  it('bulle d’information en mode détaillé', () => {
    expect(toastForOutcome(excluded, 'detailed', true)).toEqual({
      content: { tone: 'info', title: 'One Piece', message: 'Série exclue de la synchronisation.' },
      variant: 'bubble',
      autoHideMs: SUCCESS_TOAST_MS,
    });
  });
});

describe('engagementResultToast', () => {
  const copy = { success: 'Note 8/10 enregistrée', failure: 'Note non enregistrée', mediaTitle: 'Frieren' };

  it('tous les services écrits : pastille de succès', () => {
    const outcome: SyncOutcome = { status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: { status: 'updated', progress: 28, completed: true } }] };
    expect(engagementResultToast(outcome, copy)).toEqual({
      ok: true,
      content: { tone: 'success', title: 'Note 8/10 enregistrée', message: 'Frieren' },
      variant: 'pill',
      autoHideMs: PILL_TOAST_MS,
    });
  });

  it('échec partiel : bulle avec le détail par service', () => {
    const outcome: SyncOutcome = {
      status: 'synced',
      mediaTitle: 'Frieren',
      results: [
        { service: 'anilist', outcome: { status: 'up-to-date', progress: 28 } },
        { service: 'mal', outcome: { status: 'error', message: 'Réseau' } },
      ],
    };
    const result = engagementResultToast(outcome, copy);
    expect(result.ok).toBe(false);
    expect(result.variant).toBe('bubble');
    expect(result.content.tone).toBe('warning');
    expect(result.content.lines).toEqual([
      { label: 'AniList', text: 'enregistré', tone: 'ok' },
      { label: 'MyAnimeList', text: 'échec : Réseau', tone: 'error' },
    ]);
  });

  it('erreur globale : bulle d’erreur avec le message', () => {
    expect(engagementResultToast({ status: 'error', message: 'AniList indisponible' }, copy).content).toEqual({
      tone: 'error',
      title: 'Note non enregistrée',
      message: 'AniList indisponible',
    });
  });
});

describe('toastForOutcome — série ignorée (Netflix, pas un anime)', () => {
  it('rien à tous les niveaux, même en mode détaillé', () => {
    const ignored: SyncOutcome = { status: 'ignored' };
    for (const level of ['detailed', 'discreet', 'alerts-only'] as const) {
      expect(toastForOutcome(ignored, level, false)).toBeNull();
    }
  });
});
