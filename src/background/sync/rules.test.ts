import { describe, expect, it } from 'vitest';
import { decideListUpdate, decideStatusChange } from './rules';

describe('decideListUpdate', () => {
  it('ajoute un anime absent de la liste en CURRENT', () => {
    expect(decideListUpdate(null, 1, 12)).toEqual({ action: 'update', progress: 1, status: 'CURRENT' });
  });

  it('reprend un anime PLANNING / PAUSED / DROPPED en CURRENT', () => {
    for (const status of ['PLANNING', 'PAUSED', 'DROPPED'] as const) {
      expect(decideListUpdate({ status, progress: 2 }, 3, 12)).toEqual({ action: 'update', progress: 3, status: 'CURRENT' });
    }
  });

  it('passe en COMPLETED au dernier épisode', () => {
    expect(decideListUpdate({ status: 'CURRENT', progress: 11 }, 12, 12)).toEqual({ action: 'update', progress: 12, status: 'COMPLETED' });
  });

  it('reste en CURRENT si le nombre total d’épisodes est inconnu (série en cours)', () => {
    expect(decideListUpdate({ status: 'CURRENT', progress: 1179 }, 1180, null)).toEqual({ action: 'update', progress: 1180, status: 'CURRENT' });
  });

  it('ne fait jamais reculer la progression', () => {
    expect(decideListUpdate({ status: 'CURRENT', progress: 10 }, 10, 12)).toEqual({ action: 'skip', reason: 'up-to-date' });
    expect(decideListUpdate({ status: 'CURRENT', progress: 10 }, 4, 12)).toEqual({ action: 'skip', reason: 'up-to-date' });
  });

  it('ne touche pas à un anime terminé', () => {
    expect(decideListUpdate({ status: 'COMPLETED', progress: 12 }, 3, 12)).toEqual({ action: 'skip', reason: 'already-completed' });
  });
});

describe('decideListUpdate — revisionnage (REPEATING)', () => {
  it('fait avancer la progression en restant REPEATING', () => {
    expect(decideListUpdate({ status: 'REPEATING', progress: 2 }, 3, 12)).toEqual({ action: 'update', progress: 3, status: 'REPEATING' });
    expect(decideListUpdate({ status: 'REPEATING', progress: 2, repeat: 1 }, 3, null)).toEqual({ action: 'update', progress: 3, status: 'REPEATING' });
  });

  it('termine le revisionnage au dernier épisode et incrémente le compteur', () => {
    expect(decideListUpdate({ status: 'REPEATING', progress: 11, repeat: 1 }, 12, 12)).toEqual({
      action: 'update',
      progress: 12,
      status: 'COMPLETED',
      repeat: 2,
    });
    expect(decideListUpdate({ status: 'REPEATING', progress: 11 }, 12, 12)).toEqual({ action: 'update', progress: 12, status: 'COMPLETED', repeat: 1 });
  });

  it('ne fait jamais reculer un revisionnage', () => {
    expect(decideListUpdate({ status: 'REPEATING', progress: 5 }, 5, 12)).toEqual({ action: 'skip', reason: 'up-to-date' });
    expect(decideListUpdate({ status: 'REPEATING', progress: 5 }, 2, 12)).toEqual({ action: 'skip', reason: 'up-to-date' });
  });
});

describe('decideListUpdate — correction manuelle sur la même fiche', () => {
  it('autorise un recul de progression (régression)', () => {
    expect(decideListUpdate({ status: 'CURRENT', progress: 15 }, 3, 24, true)).toEqual({ action: 'update', progress: 3, status: 'CURRENT' });
  });

  it('corrige une fiche marquée terminée à tort', () => {
    expect(decideListUpdate({ status: 'COMPLETED', progress: 12 }, 5, 12, true)).toEqual({ action: 'update', progress: 5, status: 'CURRENT' });
  });

  it('ne réécrit pas une valeur identique', () => {
    expect(decideListUpdate({ status: 'CURRENT', progress: 4 }, 4, 12, true)).toEqual({ action: 'skip', reason: 'up-to-date' });
  });
});

describe('decideStatusChange', () => {
  it('Terminé : progression portée au total connu', () => {
    expect(decideStatusChange({ status: 'CURRENT', progress: 5 }, 12, 'COMPLETED')).toEqual({ action: 'write', status: 'COMPLETED', progress: 12 });
  });

  it('Terminé : total inconnu, progression conservée', () => {
    expect(decideStatusChange({ status: 'CURRENT', progress: 1100 }, null, 'COMPLETED')).toEqual({ action: 'write', status: 'COMPLETED', progress: 1100 });
  });

  it('Terminé : ne baisse jamais la progression', () => {
    expect(decideStatusChange({ status: 'CURRENT', progress: 14 }, 12, 'COMPLETED')).toEqual({ action: 'write', status: 'COMPLETED', progress: 14 });
  });

  it('En pause / Abandonné : progression conservée', () => {
    expect(decideStatusChange({ status: 'CURRENT', progress: 5 }, 12, 'PAUSED')).toEqual({ action: 'write', status: 'PAUSED', progress: 5 });
    expect(decideStatusChange({ status: 'CURRENT', progress: 5 }, 12, 'DROPPED')).toEqual({ action: 'write', status: 'DROPPED', progress: 5 });
  });

  it('revisionnage marqué terminé : compteur incrémenté', () => {
    expect(decideStatusChange({ status: 'REPEATING', progress: 4, repeat: 1 }, 12, 'COMPLETED')).toEqual({ action: 'write', status: 'COMPLETED', progress: 12, repeat: 2 });
    expect(decideStatusChange({ status: 'REPEATING', progress: 4 }, null, 'COMPLETED')).toEqual({ action: 'write', status: 'COMPLETED', progress: 4, repeat: 1 });
  });

  it('revisionnage mis en pause ou abandonné : compteur inchangé', () => {
    expect(decideStatusChange({ status: 'REPEATING', progress: 4, repeat: 1 }, 12, 'PAUSED')).toEqual({ action: 'write', status: 'PAUSED', progress: 4 });
  });

  it('série absente de la liste : rien n’est écrit', () => {
    expect(decideStatusChange(null, 12, 'DROPPED')).toEqual({ action: 'skip', reason: 'not-in-list' });
  });

  it('statut déjà en place : rien n’est écrit', () => {
    expect(decideStatusChange({ status: 'PAUSED', progress: 5 }, 12, 'PAUSED')).toEqual({ action: 'skip', reason: 'unchanged' });
    expect(decideStatusChange({ status: 'COMPLETED', progress: 12 }, 12, 'COMPLETED')).toEqual({ action: 'skip', reason: 'unchanged' });
  });

  it('déjà terminé mais progression incomplète : complétée', () => {
    expect(decideStatusChange({ status: 'COMPLETED', progress: 10 }, 12, 'COMPLETED')).toEqual({ action: 'write', status: 'COMPLETED', progress: 12 });
  });
});
