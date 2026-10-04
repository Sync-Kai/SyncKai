import { describe, expect, it } from 'vitest';
import {
  appendToRing,
  createJournal,
  formatLogArgs,
  MAX_JOURNAL_ENTRIES,
  MAX_MESSAGE_LENGTH,
  redactSecrets,
  type JournalEntry,
  type JournalStorage,
} from './error-journal';

const JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlLXNlY3JldA';

describe('redactSecrets', () => {
  it.each([
    ['https://x.chromiumapp.org/#access_token=abc123secret&token_type=Bearer', 'abc123secret'],
    ['callback?code=def456secret&state=1', 'def456secret'],
    ['grant_type=authorization_code&code_verifier=ver789secret&client_id=84d0', 'ver789secret'],
    ['refresh_token=ref000secret', 'ref000secret'],
    ['Authorization: Bearer hdr111secret', 'hdr111secret'],
    ['{"Authorization":"Bearer js222secret"}', 'js222secret'],
    ['Bearer brr333secret', 'brr333secret'],
    ['{"access_token":"jsn444secret","expires_in":3600}', 'jsn444secret'],
    ['{"refreshToken":"cam555secret"}', 'cam555secret'],
    [`token ${JWT} rejeté`, JWT],
    ['client GOCSPX-goo666secret', 'GOCSPX-goo666secret'],
  ])('masque le secret de %s', (input, secret) => {
    const output = redactSecrets(input);
    expect(output).not.toContain(secret);
    expect(output).toContain('[REDACTED]');
  });

  it('masque les valeurs connues (noms de compte)', () => {
    expect(redactSecrets('Profil de KaiFan introuvable', ['KaiFan'])).toBe('Profil de [REDACTED] introuvable');
  });

  it('laisse intact un message sans secret', () => {
    expect(redactSecrets('HTTP 429 sur graphql.anilist.co, error_code=12')).toBe('HTTP 429 sur graphql.anilist.co, error_code=12');
  });
});

describe('formatLogArgs', () => {
  it('formate Error, objets et primitives', () => {
    expect(formatLogArgs(['Échec :', new TypeError('Failed to fetch'), { status: 500 }, 3, null])).toBe('Échec : TypeError: Failed to fetch {"status":500} 3 null');
  });

  it('masque les clés sensibles des objets', () => {
    const text = formatLogArgs([{ accessToken: 'tok999secret', nested: { code_verifier: 'v' }, ok: 1 }]);
    expect(text).not.toContain('tok999secret');
    expect(text).toContain('"ok":1');
  });

  it('tolère les références circulaires', () => {
    const loop: Record<string, unknown> = { a: 1 };
    loop.self = loop;
    expect(formatLogArgs([loop])).toBe('{"a":1,"self":"[Circular]"}');
  });

  it('tronque après expurgation', () => {
    const text = formatLogArgs([`${'x'.repeat(MAX_MESSAGE_LENGTH)} access_token=zzz`]);
    expect(text).toHaveLength(MAX_MESSAGE_LENGTH);
    expect(text.endsWith('…')).toBe(true);
  });
});

describe('appendToRing', () => {
  const entry = (at: number): JournalEntry => ({ at, level: 'error', scope: 's', message: `m${at}` });

  it('garde les entrées les plus récentes et ignore les invalides', () => {
    const current = [...Array.from({ length: MAX_JOURNAL_ENTRIES }, (_, i) => entry(i)), { bogus: true }];
    const ring = appendToRing(current, [entry(100), entry(101)]);
    expect(ring).toHaveLength(MAX_JOURNAL_ENTRIES);
    expect(ring[0]?.at).toBe(2);
    expect(ring.at(-1)?.at).toBe(101);
  });

  it('part de zéro si le stockage est vide ou corrompu', () => {
    expect(appendToRing('n/a', [entry(1)])).toEqual([entry(1)]);
  });
});

/** Stockage en mémoire, verrou compris */
function memoryStorage(initial: unknown = undefined): JournalStorage & { value: unknown; writes: number } {
  let chain: Promise<unknown> = Promise.resolve();
  const store = {
    value: initial,
    writes: 0,
    read: async () => store.value,
    write: async (entries: JournalEntry[]) => {
      store.writes++;
      store.value = entries;
    },
    lock: <T>(task: () => Promise<T>): Promise<T> => {
      const run = chain.then(task, task);
      chain = run.catch(() => undefined);
      return run;
    },
  };
  return store;
}

describe('createJournal', () => {
  it('regroupe les entrées d’une rafale en une seule écriture', async () => {
    const storage = memoryStorage();
    const tasks: (() => void)[] = [];
    const journal = createJournal(() => storage, (task) => tasks.push(task), () => 42);
    journal.record('warn', 'sync', ['a']);
    journal.record('error', 'auth', ['access_token=secret1']);
    expect(tasks).toHaveLength(1);
    await journal.flush();
    expect(storage.writes).toBe(1);
    expect(storage.value).toEqual([
      { at: 42, level: 'warn', scope: 'sync', message: 'a' },
      { at: 42, level: 'error', scope: 'auth', message: 'access_token=[REDACTED]' },
    ]);
  });

  it('ne garde que les 50 dernières entrées', async () => {
    const storage = memoryStorage();
    let t = 0;
    const journal = createJournal(() => storage, () => {}, () => t++);
    for (let i = 0; i < 70; i++) journal.record('error', 's', [`e${i}`]);
    await journal.flush();
    for (let i = 70; i < 75; i++) journal.record('error', 's', [`e${i}`]);
    await journal.flush();
    const entries = storage.value as JournalEntry[];
    expect(entries).toHaveLength(MAX_JOURNAL_ENTRIES);
    expect(entries[0]?.message).toBe('e25');
    expect(entries.at(-1)?.message).toBe('e74');
  });

  it('sérialise les écritures concurrentes', async () => {
    const storage = memoryStorage();
    const journal = createJournal(() => storage, () => {});
    journal.record('warn', 's', ['1']);
    const first = journal.flush();
    journal.record('warn', 's', ['2']);
    await Promise.all([first, journal.flush()]);
    expect((storage.value as JournalEntry[]).map((e) => e.message)).toEqual(['1', '2']);
  });

  it('ignore silencieusement un stockage absent ou en échec', async () => {
    const absent = createJournal(() => null, () => {});
    absent.record('error', 's', ['x']);
    await expect(absent.flush()).resolves.toBeUndefined();

    const failing = createJournal(
      () => ({ read: () => Promise.reject(new Error('quota')), write: () => Promise.resolve(), lock: (task) => task() }),
      () => {},
    );
    failing.record('error', 's', ['x']);
    await expect(failing.flush()).resolves.toBeUndefined();
  });
});
