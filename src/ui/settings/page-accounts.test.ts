import { describe, expect, it } from 'vitest';
import { LOGGED_OUT } from '../state';
import { accountRowKind } from './page-accounts';

describe('accountRowKind', () => {
  it('chargement, ou connecté sans profil ni erreur : squelette', () => {
    expect(accountRowKind({ status: 'loading' })).toBe('skeleton');
    expect(accountRowKind({ status: 'logged-in', viewer: null, error: null })).toBe('skeleton');
  });

  it('UI-04 : connecté, profil jamais chargé et lecture en échec : erreur (Réessayer), pas de squelette sans fin', () => {
    expect(accountRowKind({ status: 'logged-in', viewer: null, error: 'Réseau indisponible' })).toBe('profile-error');
  });

  it('profil chargé (avec ou sans erreur de rafraîchissement) ; déconnecté', () => {
    expect(accountRowKind({ status: 'logged-in', viewer: { name: 'Kai' }, error: null })).toBe('profile');
    expect(accountRowKind({ status: 'logged-in', viewer: { name: 'Kai' }, error: 'Réseau indisponible' })).toBe('profile');
    expect(accountRowKind(LOGGED_OUT)).toBe('logged-out');
  });
});
