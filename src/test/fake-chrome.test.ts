import { beforeEach, describe, expect, it } from 'vitest';
import { FakeFetch, installFakeChrome, jsonResponse } from './fake-chrome';

// La fausse API chrome elle-même : une simulation infidèle rendrait les autres tests trompeurs.

const fake = installFakeChrome();

beforeEach(() => fake.reset());

describe('stockage simulé', () => {
  it('get : chaîne, liste, objet avec valeurs par défaut, null ; copies indépendantes', async () => {
    fake.reset({ a: { n: 1 }, b: 2 });
    expect(await chrome.storage.local.get('a')).toEqual({ a: { n: 1 } });
    expect(await chrome.storage.local.get(['a', 'absent'])).toEqual({ a: { n: 1 } });
    expect(await chrome.storage.local.get({ b: 0, c: 'défaut' })).toEqual({ b: 2, c: 'défaut' });
    expect(await chrome.storage.local.get(null)).toEqual({ a: { n: 1 }, b: 2 });
    const read = await chrome.storage.local.get('a');
    (read.a as { n: number }).n = 99;
    expect(fake.local.peek('a')).toEqual({ n: 1 });
  });

  it('onChanged : valeurs changées seulement, zone indiquée, après l’écriture', async () => {
    const seen: [string[], string][] = [];
    chrome.storage.onChanged.addListener((changes, area) => void seen.push([Object.keys(changes), area]));
    await chrome.storage.local.set({ a: 1 });
    await chrome.storage.local.set({ a: 1 });
    await chrome.storage.session.set({ s: true });
    await chrome.storage.local.remove(['a', 'absent']);
    await Promise.resolve();
    expect(seen).toEqual([
      [['a'], 'local'],
      [['s'], 'session'],
      [['a'], 'local'],
    ]);
  });
});

describe('alarmes simulées', () => {
  it('create / get / clear / fire', async () => {
    await chrome.alarms.create('x', { when: 5_000 });
    expect(await chrome.alarms.get('x')).toEqual({ name: 'x', scheduledTime: 5_000, persistAcrossSessions: true });
    const fired: string[] = [];
    chrome.alarms.onAlarm.addListener((alarm) => void fired.push(alarm.name));
    expect(fake.alarms.fire('x')).toBe(true);
    expect(fired).toEqual(['x']);
    expect(await chrome.alarms.get('x')).toBeUndefined();
    expect(await chrome.alarms.clear('x')).toBe(false);
  });
});

describe('Web Locks simulés', () => {
  it('file FIFO par nom, noms indépendants', async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    const first = navigator.locks.request('a', () => new Promise<void>((r) => (release = r)).then(() => void order.push('a1')));
    const second = navigator.locks.request('a', async () => void order.push('a2'));
    await navigator.locks.request('b', async () => void order.push('b'));
    expect(order).toEqual(['b']);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(['b', 'a1', 'a2']);
    expect(fake.locks.isHeld('a')).toBe(false);
  });

  it('ifAvailable : null si le verrou est détenu, un verrou sinon ; un rejet libère le verrou', async () => {
    let release: () => void = () => undefined;
    const held = navigator.locks.request('run', () => new Promise<void>((r) => (release = r)));
    expect(await navigator.locks.request('run', { ifAvailable: true }, async (lock) => lock)).toBeNull();
    release();
    await held;
    expect(await navigator.locks.request('run', { ifAvailable: true }, async (lock) => lock?.name)).toBe('run');
    await expect(navigator.locks.request('run', () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(fake.locks.isHeld('run')).toBe(false);
  });
});

describe('fetch simulé', () => {
  it('routes dans l’ordre, `once` s’épuise, coupure réseau, requête imprévue rejetée', async () => {
    fake.fetch.once('https://api.test/a', () => jsonResponse(503, {})).on('https://api.test/a', () => jsonResponse(200, { ok: true }));
    fake.fetch.on(/coupure/, FakeFetch.networkError());
    expect((await fetch('https://api.test/a')).status).toBe(503);
    expect(await (await fetch('https://api.test/a')).json()).toEqual({ ok: true });
    await expect(fetch('https://api.test/coupure')).rejects.toThrow(TypeError);
    await expect(fetch('https://ailleurs.test/', { method: 'POST' })).rejects.toThrow('fetch non simulé : POST https://ailleurs.test/');
    expect(fake.fetch.calls.map((c) => c.url)).toHaveLength(4);
  });
});
