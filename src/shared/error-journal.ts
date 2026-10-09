import { isRecord } from './guards';
import { requestStorageLock } from './storage-lock-core';

// Journal local des warn/error (rapport de diagnostic). Règle absolue : ce module ne logue jamais
// (le logger l'appelle, tout log ici bouclerait) et ne lève jamais.

export const DIAGNOSTICS_LOG_KEY = 'diagnostics:log';
export const MAX_JOURNAL_ENTRIES = 50;
export const MAX_MESSAGE_LENGTH = 500;
/** Regroupe les entrées arrivées ensemble en une seule écriture */
const FLUSH_DELAY_MS = 50;

export type JournalLevel = 'warn' | 'error';

export interface JournalEntry {
  /** Horodatage (ms) */
  at: number;
  level: JournalLevel;
  scope: string;
  /** Message déjà expurgé et tronqué */
  message: string;
}

export function isJournalEntry(value: unknown): value is JournalEntry {
  return (
    isRecord(value) &&
    typeof value.at === 'number' &&
    Number.isFinite(value.at) &&
    (value.level === 'warn' || value.level === 'error') &&
    typeof value.scope === 'string' &&
    typeof value.message === 'string'
  );
}

// ─── Expurgation ──────────────────────────────────────────────────────────

const REDACTED = '[REDACTED]';
/** Paramètres OAuth dont la valeur est secrète (query string, fragment, corps x-www-form-urlencoded) */
const SECRET_PARAMS = 'access_token|refresh_token|id_token|code|code_verifier|code_challenge|client_secret|token|password';
/** Clés d'objet masquées avant sérialisation (accessToken, refresh_token, Authorization, code_verifier…) */
const SECRET_KEY = /token|secret|verifier|password|authorization|^code$|^code_challenge$/i;

const SECRET_RULES: readonly (readonly [RegExp, string])[] = [
  // En-tête complet, avant la règle Bearer (« Authorization: Bearer xxx » → une seule mention)
  [/\bAuthorization\b(["']?\s*[:=]\s*["']?)(?:Bearer\s+|Basic\s+)?[^\s"',;}]+/gi, `Authorization$1${REDACTED}`],
  [/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, `Bearer ${REDACTED}`],
  // Paramètres d'URL / formulaire : access_token=…, #code=…, &code_verifier=…
  [new RegExp(`\\b(${SECRET_PARAMS})=[^&#\\s"']+`, 'gi'), `$1=${REDACTED}`],
  // Paires JSON : "access_token":"…", "refreshToken": "…"
  [/("[^"]*(?:token|secret|verifier|password|authorization)[^"]*"\s*:\s*)"(?:[^"\\]|\\.)*"/gi, `$1"${REDACTED}"`],
  [/("code(?:_challenge)?"\s*:\s*)"(?:[^"\\]|\\.)*"/gi, `$1"${REDACTED}"`],
  // JWT (tokens AniList / MAL) et secrets client Google
  [/\beyJ[A-Za-z0-9_-]{4,}(?:\.[A-Za-z0-9_-]+)*/g, REDACTED],
  [/GOCSPX-[A-Za-z0-9_-]+/g, REDACTED],
];

/** Masque tokens, codes OAuth, en-têtes d'autorisation et valeurs sensibles connues (`extra`). */
export function redactSecrets(text: string, extra: readonly string[] = []): string {
  let result = text;
  // Valeurs connues (tokens, noms de compte) : remplacées telles quelles, les plus longues d'abord
  for (const value of [...extra].filter((v) => v.length >= 3).sort((a, b) => b.length - a.length)) {
    result = result.split(value).join(REDACTED);
  }
  for (const [pattern, replacement] of SECRET_RULES) result = result.replace(pattern, replacement);
  return result;
}

function describeError(error: Error): string {
  return error.message ? `${error.name}: ${error.message}` : error.name;
}

/** JSON compact ; clés sensibles masquées, Error lisibles, références circulaires tolérées */
function compactJson(value: object): string {
  const seen = new WeakSet<object>();
  try {
    return (
      JSON.stringify(value, (key: string, inner: unknown): unknown => {
        if (key && SECRET_KEY.test(key)) return REDACTED;
        if (inner instanceof Error) return describeError(inner);
        if (typeof inner === 'bigint') return inner.toString();
        if (typeof inner === 'object' && inner !== null) {
          if (seen.has(inner)) return '[Circular]';
          seen.add(inner);
        }
        return inner;
      }) ?? String(value)
    );
  } catch {
    return '[unserializable]';
  }
}

function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return describeError(arg);
  if (typeof arg === 'object' && arg !== null) return compactJson(arg);
  return String(arg);
}

/** Texte d'une entrée : arguments joints, expurgés puis tronqués (l'expurgation d'abord : pas de token coupé) */
export function formatLogArgs(args: readonly unknown[]): string {
  const text = redactSecrets(args.map(formatArg).join(' '));
  return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH - 1)}…` : text;
}

/** Ajoute des entrées en gardant les `max` plus récentes (ordre chronologique) */
export function appendToRing(current: unknown, added: readonly JournalEntry[], max: number = MAX_JOURNAL_ENTRIES): JournalEntry[] {
  const valid = Array.isArray(current) ? current.filter(isJournalEntry) : [];
  return [...valid, ...added].slice(-max);
}

// ─── Écriture ─────────────────────────────────────────────────────────────

/** Accès au stockage du journal (injectable pour les tests) */
export interface JournalStorage {
  read(): Promise<unknown>;
  write(entries: JournalEntry[]): Promise<void>;
  /** Exclusion mutuelle des lectures-modifications-écritures */
  lock<T>(task: () => Promise<T>): Promise<T>;
}

export interface Journal {
  record(level: JournalLevel, scope: string, args: readonly unknown[]): void;
  /** Écrit tout de suite les entrées en attente (tests, fermeture) */
  flush(): Promise<void>;
}

export function createJournal(
  storage: () => JournalStorage | null,
  schedule: (task: () => void, delayMs: number) => void = (task, delayMs) => void setTimeout(task, delayMs),
  now: () => number = Date.now,
): Journal {
  let pending: JournalEntry[] = [];
  let scheduled = false;

  async function flush(): Promise<void> {
    scheduled = false;
    const batch = pending;
    pending = [];
    if (batch.length === 0) return;
    try {
      const store = storage();
      if (!store) return;
      await store.lock(async () => store.write(appendToRing(await store.read(), batch)));
    } catch {
      // Stockage indisponible (contexte invalidé, quota…) : entrées perdues, jamais de log ici
    }
  }

  return {
    record(level, scope, args) {
      try {
        pending.push({ at: now(), level, scope, message: formatLogArgs(args) });
        // Une rafale ne garde que les dernières entrées : inutile d'en accumuler davantage
        if (pending.length > MAX_JOURNAL_ENTRIES) pending = pending.slice(-MAX_JOURNAL_ENTRIES);
        if (!scheduled) {
          scheduled = true;
          schedule(() => void flush(), FLUSH_DELAY_MS);
        }
      } catch {
        // Jamais d'exception depuis un log
      }
    },
    flush,
  };
}

/** chrome.storage.local si disponible (absent sous Vitest, contexte invalidé d'un content script orphelin) */
function chromeJournalStorage(): JournalStorage | null {
  if (typeof chrome === 'undefined' || !chrome.storage?.local || !chrome.runtime?.id) return null;
  const local = chrome.storage.local;
  return {
    read: async () => (await local.get(DIAGNOSTICS_LOG_KEY))[DIAGNOSTICS_LOG_KEY],
    write: (entries) => local.set({ [DIAGNOSTICS_LOG_KEY]: entries }),
    // Web Locks par origine : partagé entre popup / page d'import / service worker ; dans un content
    // script, il ne sérialise que les écritures de cette origine (course rare avec le service worker)
    lock: (task) => (typeof navigator !== 'undefined' && navigator.locks ? requestStorageLock(task) : task()),
  };
}

/** Journal par défaut de l'extension, utilisé par `createLogger` */
export const defaultJournal: Journal = createJournal(chromeJournalStorage);

/** Entrées valides du journal, de la plus ancienne à la plus récente */
export async function readJournal(): Promise<JournalEntry[]> {
  const stored = await chrome.storage.local.get(DIAGNOSTICS_LOG_KEY);
  const value: unknown = stored[DIAGNOSTICS_LOG_KEY];
  return Array.isArray(value) ? value.filter(isJournalEntry) : [];
}

export function clearJournal(): Promise<void> {
  return requestStorageLock(() => chrome.storage.local.remove(DIAGNOSTICS_LOG_KEY));
}
