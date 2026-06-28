import { redactLogMeta, redactLogString } from './redaction.js';

export type BrowserLogLevel = 'debug' | 'info' | 'warn' | 'error';
export type BrowserLogMeta = Record<string, unknown>;

export interface BrowserLoggerOptions {
  readonly component: string;
  readonly level?: BrowserLogLevel;
}

export interface BrowserLogEntry {
  readonly timestamp: string;
  readonly level: BrowserLogLevel;
  readonly message: string;
  readonly component: string;
  readonly context?: Record<string, unknown>;
}

export interface BrowserLogger {
  debug: (message: string, meta?: BrowserLogMeta) => void;
  info: (message: string, meta?: BrowserLogMeta) => void;
  warn: (message: string, meta?: BrowserLogMeta) => void;
  error: (message: string, meta?: BrowserLogMeta) => void;
}

const browserLogLevelPriority: Record<BrowserLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const getConsoleMethod = (
  level: BrowserLogLevel
): ((message?: unknown, ...optionalParams: unknown[]) => void) => {
  return console[level].bind(console);
};

const shouldLogBrowserLevel = (
  configuredLevel: BrowserLogLevel,
  targetLevel: BrowserLogLevel
): boolean => {
  return browserLogLevelPriority[targetLevel] >= browserLogLevelPriority[configuredLevel];
};

export const createBrowserLogger = ({
  component,
  level = 'info',
}: BrowserLoggerOptions): BrowserLogger => {
  const write =
    (targetLevel: BrowserLogLevel) =>
    (message: string, meta?: BrowserLogMeta): void => {
      if (!shouldLogBrowserLevel(level, targetLevel)) {
        return;
      }

      const sanitizedMeta = meta ? redactLogMeta(meta) : undefined;
      const entry: BrowserLogEntry = {
        timestamp: new Date().toISOString(),
        level: targetLevel,
        message: redactLogString(message),
        component,
        context: sanitizedMeta,
      };

      const consoleMethod = getConsoleMethod(targetLevel);
      if (sanitizedMeta && Object.keys(sanitizedMeta).length > 0) {
        consoleMethod(entry.message, sanitizedMeta);
      } else {
        consoleMethod(entry.message);
      }
    };

  return {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
  };
};
