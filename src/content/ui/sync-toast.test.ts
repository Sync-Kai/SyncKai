import { describe, expect, it } from 'vitest';
import type { SyncOutcome } from '../../shared/sync.types';
import { ALERT_TOAST_MS, PILL_TOAST_MS, SUCCESS_TOAST_MS, bubbleForOutcome, engagementResultToast, mergeServiceLines, pillForOutcome, toastForOutcome } from './sync-toast';
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

/** Épisode lu sur la page (sous-titre des bulles sans fiche) */
const page = { series: 'Frieren', episode: 6 };

describe('mergeServiceLines', () => {
  it('même résultat partout : une seule ligne, les deux logos, services joints', () => {
    expect(
      mergeServiceLines([
        { service: 'anilist', text: 'statut Terminé', tone: 'ok' },
        { service: 'mal', text: 'statut Terminé', tone: 'ok' },
      ]),
    ).toEqual([{ services: ['anilist', 'mal'], label: 'AniList et MyAnimeList', text: 'statut Terminé', tone: 'ok' }]);
  });

  it('résultats différents (texte ou ton) : une ligne par service, dans l’ordre', () => {
    expect(
      mergeServiceLines([
        { service: 'anilist', text: 'enregistré', tone: 'ok' },
        { service: 'mal', text: 'déjà à jour', tone: 'neutral' },
      ]),
    ).toEqual([
      { services: ['anilist'], label: 'AniList', text: 'enregistré', tone: 'ok' },
      { services: ['mal'], label: 'MyAnimeList', text: 'déjà à jour', tone: 'neutral' },
    ]);
    expect(
      mergeServiceLines([
        { service: 'anilist', text: 'réseau', tone: 'error' },
        { service: 'mal', text: 'réseau', tone: 'warning' },
      ]),
    ).toHaveLength(2);
  });
});

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

  it('detailed : bulle 5 s, l’épisode dans le titre, une ligne par résultat', () => {
    expect(toastForOutcome(synced, 'detailed', false)).toEqual({
      content: {
        tone: 'success',
        title: 'Épisode 2 enregistré',
        subtitle: 'Tougen Anki',
        lines: [
          { services: ['anilist'], label: 'AniList', text: 'enregistré', tone: 'ok' },
          { services: ['mal'], label: 'MyAnimeList', text: 'déjà à jour', tone: 'neutral' },
        ],
      },
      variant: 'bubble',
      autoHideMs: SUCCESS_TOAST_MS,
    });
  });

  it('alerts-only : rien pour un succès, bulle 9 s pour une vérification', () => {
    expect(toastForOutcome(synced, 'alerts-only', false)).toBeNull();
    const review = toastForOutcome({ status: 'needs-review', reason: 'Fiche incertaine' }, 'alerts-only', true, page);
    expect(review?.variant).toBe('bubble');
    expect(review?.autoHideMs).toBe(ALERT_TOAST_MS);
    expect(review?.content.title).toBe('À vérifier dans SyncKai');
    expect(review?.content.subtitle).toBe('Frieren · ép. 6');
  });
});

describe('bubbleForOutcome', () => {
  it('série terminée, même résultat partout : une seule ligne', () => {
    const outcome: SyncOutcome = {
      status: 'synced',
      mediaTitle: 'Frieren',
      results: [
        { service: 'anilist', outcome: { status: 'updated', progress: 28, completed: true } },
        { service: 'mal', outcome: { status: 'updated', progress: 28, completed: true } },
      ],
    };
    expect(bubbleForOutcome(outcome, page)).toEqual({
      tone: 'success',
      title: 'Série terminée !',
      subtitle: 'Frieren · ép. 28',
      lines: [{ services: ['anilist', 'mal'], label: 'AniList et MyAnimeList', text: 'statut Terminé', tone: 'ok' }],
    });
  });

  it('tout déjà à jour : coche lavande', () => {
    const outcome: SyncOutcome = { status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: { status: 'up-to-date', progress: 7 } }] };
    expect(bubbleForOutcome(outcome)).toMatchObject({ badge: 'same', title: 'Ép. 7 déjà à jour', subtitle: 'Frieren' });
  });

  it('un service en échec : « Échec sur … », le message de l’erreur sur sa ligne', () => {
    const outcome: SyncOutcome = {
      status: 'synced',
      mediaTitle: 'Frieren',
      results: [
        { service: 'anilist', outcome: { status: 'updated', progress: 6, completed: false } },
        { service: 'mal', outcome: { status: 'error', message: 'Injoignable, vérifie ta connexion' } },
      ],
    };
    expect(bubbleForOutcome(outcome, page)).toEqual({
      tone: 'error',
      title: 'Échec sur MyAnimeList',
      subtitle: 'Frieren · ép. 6',
      lines: [
        { services: ['anilist'], label: 'AniList', text: 'enregistré', tone: 'ok' },
        { services: ['mal'], label: 'MyAnimeList', text: 'injoignable, vérifie ta connexion', tone: 'error' },
      ],
    });
  });

  it('message d’erreur qui nomme le service de la ligne : nom non répété', () => {
    const outcome: SyncOutcome = {
      status: 'synced',
      mediaTitle: 'Frieren',
      results: [
        { service: 'anilist', outcome: { status: 'updated', progress: 6, completed: false } },
        { service: 'mal', outcome: { status: 'error', message: 'MyAnimeList est injoignable. Vérifie ta connexion.' } },
      ],
    };
    expect(bubbleForOutcome(outcome, page).lines?.[1]).toEqual({ services: ['mal'], label: 'MyAnimeList', text: 'est injoignable. Vérifie ta connexion.', tone: 'error' });
  });

  it('service ignoré : synchro partielle ; tous ignorés : épisode non enregistré', () => {
    const partial: SyncOutcome = {
      status: 'synced',
      mediaTitle: 'Frieren',
      results: [
        { service: 'anilist', outcome: { status: 'updated', progress: 7, completed: false } },
        { service: 'mal', outcome: { status: 'skipped', reason: 'Pas de fiche équivalente' } },
      ],
    };
    expect(bubbleForOutcome(partial, page)).toMatchObject({ tone: 'warning', title: 'Synchro partielle', subtitle: 'Frieren · ép. 7' });
    const none: SyncOutcome = {
      status: 'synced',
      mediaTitle: 'Dandadan',
      results: [
        { service: 'anilist', outcome: { status: 'skipped', reason: 'La fiche s’arrête à 12 épisodes' } },
        { service: 'mal', outcome: { status: 'skipped', reason: 'La fiche s’arrête à 12 épisodes' } },
      ],
    };
    expect(bubbleForOutcome(none, { series: 'Dandadan', episode: 13 })).toEqual({
      tone: 'warning',
      title: 'Épisode non enregistré',
      subtitle: 'Dandadan · ép. 13',
      lines: [{ services: ['anilist', 'mal'], label: 'AniList et MyAnimeList', text: 'la fiche s’arrête à 12 épisodes', tone: 'warning' }],
    });
  });

  it('échec global : titre, épisode de la page en sous-titre, message', () => {
    expect(bubbleForOutcome({ status: 'error', message: 'AniList ne répond pas.', queued: true }, page)).toEqual({
      tone: 'error',
      title: 'Échec de la synchronisation',
      subtitle: 'Frieren · ép. 6',
      message: 'AniList ne répond pas. Nouvel essai automatique bientôt.',
    });
  });
});

describe('pillForOutcome', () => {
  it('aucun service modifié : "déjà à jour", coche lavande', () => {
    const outcome: SyncOutcome = { status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: { status: 'up-to-date', progress: 7 } }] };
    expect(pillForOutcome(outcome)).toEqual({ tone: 'success', badge: 'same', title: 'Ép. 7 déjà à jour', message: 'Frieren' });
  });
});

describe('toastForOutcome — série exclue', () => {
  const excluded: SyncOutcome = { status: 'excluded', mediaTitle: 'One Piece' };

  it('rien en discret (même hors plein écran) ni en alertes seulement', () => {
    expect(toastForOutcome(excluded, 'discreet', false)).toBeNull();
    expect(toastForOutcome(excluded, 'alerts-only', false)).toBeNull();
  });

  it('bulle d’information en mode détaillé, pastille grise', () => {
    expect(toastForOutcome(excluded, 'detailed', true, { series: 'One Piece', episode: 1180 })).toEqual({
      content: { tone: 'info', badge: 'off', title: 'Série exclue, rien n’est envoyé', subtitle: 'One Piece · ép. 1180' },
      variant: 'bubble',
      autoHideMs: SUCCESS_TOAST_MS,
    });
  });
});

describe('engagementResultToast', () => {
  const copy = { success: 'Note 8/10 enregistrée', failure: 'Note non enregistrée', partial: 'Note enregistrée en partie', mediaTitle: 'Frieren', subtitle: 'Frieren · 8/10', badge: 'star' as const };

  it('tous les services écrits : pastille de succès', () => {
    const outcome: SyncOutcome = { status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: { status: 'updated', progress: 28, completed: true } }] };
    expect(engagementResultToast(outcome, copy)).toEqual({
      ok: true,
      content: { tone: 'success', badge: 'star', title: 'Note 8/10 enregistrée', message: 'Frieren' },
      variant: 'pill',
      autoHideMs: PILL_TOAST_MS,
    });
  });

  it('échec partiel : « en partie », le détail par service', () => {
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
    expect(result.content).toEqual({
      tone: 'warning',
      title: 'Note enregistrée en partie',
      subtitle: 'Frieren · 8/10',
      lines: [
        { services: ['anilist'], label: 'AniList', text: 'enregistré', tone: 'ok' },
        { services: ['mal'], label: 'MyAnimeList', text: 'réseau', tone: 'error' },
      ],
    });
  });

  it('erreur globale : bulle d’erreur avec le message', () => {
    expect(engagementResultToast({ status: 'error', message: 'AniList indisponible' }, copy).content).toEqual({
      tone: 'error',
      title: 'Note non enregistrée',
      subtitle: 'Frieren · 8/10',
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
