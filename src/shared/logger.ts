import { defaultJournal, type Journal } from './error-journal';

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

const noop = (): void => {};

/**
 * Logger préfixé ([SyncKai:scope]) avec debug/info activables. warn/error sont toujours affichés
 * et consignés dans le journal local (rapport de diagnostic) quand `journal` est fourni.
 * Exporté pour les tests ; le code applicatif passe par `createLogger`.
 */
export function createLoggerFor(scope: string, debugEnabled: boolean, journal: Journal | null = null): Logger {
  const prefix = `[SyncKai:${scope}]`;
  return {
    debug: debugEnabled ? (...args: unknown[]) => console.debug(prefix, ...args) : noop,
    info: debugEnabled ? (...args: unknown[]) => console.info(prefix, ...args) : noop,
    warn: (...args: unknown[]) => {
      console.warn(prefix, ...args);
      journal?.record('warn', scope, args);
    },
    error: (...args: unknown[]) => {
      console.error(prefix, ...args);
      journal?.record('error', scope, args);
    },
  };
}

/**
 * Logger du module `scope`. debug/info ne s'affichent qu'en build de développement
 * (`__SYNCKAI_DEBUG__` remplacé à la compilation : esbuild élimine les appels en production).
 */
export function createLogger(scope: string): Logger {
  const prefix = `[SyncKai:${scope}]`;
  return {
    debug: __SYNCKAI_DEBUG__ ? (...args: unknown[]) => console.debug(prefix, ...args) : noop,
    info: __SYNCKAI_DEBUG__ ? (...args: unknown[]) => console.info(prefix, ...args) : noop,
    warn: (...args: unknown[]) => {
      console.warn(prefix, ...args);
      defaultJournal.record('warn', scope, args);
    },
    error: (...args: unknown[]) => {
      console.error(prefix, ...args);
      defaultJournal.record('error', scope, args);
    },
  };
}
