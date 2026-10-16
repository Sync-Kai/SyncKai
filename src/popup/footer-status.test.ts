import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '../shared/watching';
import type { AccountState } from '../ui/state';
import { footerChips, footerStatus, type FooterInput } from './footer-status';

// Barre d'état du popup : priorités de l'état affiché et pastilles des comptes

const IN: AccountState<unknown> = { status: 'logged-in', viewer: null, error: null };
const OUT: AccountState<unknown> = { status: 'logged-out', pending: false, error: null, expired: false };
const EXPIRED: AccountState<unknown> = { status: 'logged-out', pending: false, error: null, expired: true };
const NOW = 1_800_000_000_000;

function input(patch: Partial<FooterInput> = {}): FooterInput {
  return { accounts: { anilist: IN, mal: OUT }, reviews: 0, queue: { failed: 0, pending: 0 }, toRate: 0, latestSyncAt: null, now: NOW, ...patch };
}

describe('footerStatus', () => {
  it('priorité : abandonnées, puis « À vérifier », puis relances en attente', () => {
    expect(footerStatus(input({ queue: { failed: 2, pending: 3 }, reviews: 1 }))).toEqual({ kind: 'queue-failed', count: 2 });
    expect(footerStatus(input({ queue: { failed: 0, pending: 3 }, reviews: 1 }))).toEqual({ kind: 'pending', count: 1 });
    expect(footerStatus(input({ queue: { failed: 0, pending: 3 } }))).toEqual({ kind: 'queue-pending', count: 3 });
  });

  it('session expirée : après la file, avant les notes ; sans compte connecté, l’emporte sur « aucun compte »', () => {
    const accounts = { anilist: IN, mal: EXPIRED };
    expect(footerStatus(input({ accounts, queue: { failed: 1, pending: 0 } }))).toEqual({ kind: 'queue-failed', count: 1 });
    expect(footerStatus(input({ accounts, toRate: 2 }))).toEqual({ kind: 'expired', service: 'mal' });
    expect(footerStatus(input({ accounts: { anilist: EXPIRED, mal: OUT }, reviews: 4 }))).toEqual({ kind: 'expired', service: 'anilist' });
  });

  it('aucun compte connecté : file et vérifications ignorées', () => {
    expect(footerStatus(input({ accounts: { anilist: OUT, mal: OUT }, reviews: 3, queue: { failed: 1, pending: 1 } }))).toEqual({ kind: 'none' });
    expect(footerStatus(input({ accounts: { anilist: { status: 'loading' }, mal: OUT } }))).toEqual({ kind: 'none' });
  });

  it('notes reportées : priorité la plus basse, avant « à jour »', () => {
    expect(footerStatus(input({ toRate: 2 }))).toEqual({ kind: 'to-rate', count: 2 });
  });

  it('à jour : date relative de la dernière synchro, null sans synchro', () => {
    expect(footerStatus(input())).toEqual({ kind: 'ok', relative: null });
    const at = NOW - 3 * 60_000;
    expect(footerStatus(input({ latestSyncAt: at }))).toEqual({ kind: 'ok', relative: formatRelativeTime(at, NOW) });
  });
});

describe('footerChips', () => {
  it('services connectés, ou à reconnecter ; déconnectés et en lecture absents', () => {
    expect(footerChips({ anilist: IN, mal: EXPIRED })).toEqual([
      { service: 'anilist', state: 'ok' },
      { service: 'mal', state: 'expired' },
    ]);
    expect(footerChips({ anilist: { status: 'loading' }, mal: OUT })).toEqual([]);
  });
});
