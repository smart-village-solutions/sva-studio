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

type BrowserLogSink = (entry: BrowserLogEntry) => void;

const browserLogLevelPriority: Record<BrowserLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const browserLogSinks = new Set<BrowserLogSink>();
let suppressedBrowserConsoleCaptureDepth = 0;

const getConsoleMethod = (level: BrowserLogLevel): ((message?: unknown, ...optionalParams: unknown[]) => void) => {
  return console[level].bind(console);
};

const shouldLogBrowserLevel = (configuredLevel: BrowserLogLevel, targetLevel: BrowserLogLevel): boolean => {
  return browserLogLevelPriority[targetLevel] >= browserLogLevelPriority[configuredLevel];
};

const emitBrowserLogEntry = (entry: BrowserLogEntry): void => {
  for (const sink of browserLogSinks) {
    try {
      sink(entry);
    } catch (error) {
      suppressedBrowserConsoleCaptureDepth += 1;
      try {
        console.warn('Browser log sink failed', {
          component: entry.component,
          sink_error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        suppressedBrowserConsoleCaptureDepth -= 1;
      }
    }
  }
};

export const registerBrowserLogSink = (sink: BrowserLogSink): (() => void) => {
  browserLogSinks.add(sink);

  return () => {
    browserLogSinks.delete(sink);
  };
};

export const isBrowserConsoleCaptureSuppressed = (): boolean => suppressedBrowserConsoleCaptureDepth > 0;

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

      if (browserLogSinks.size > 0) {
        emitBrowserLogEntry(entry);
      }

      suppressedBrowserConsoleCaptureDepth += 1;
      try {
        const consoleMethod = getConsoleMethod(targetLevel);
        if (sanitizedMeta && Object.keys(sanitizedMeta).length > 0) {
          consoleMethod(entry.message, sanitizedMeta);
        } else {
          consoleMethod(entry.message);
        }
      } finally {
        suppressedBrowserConsoleCaptureDepth -= 1;
      }
    };

  return {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
  };
};
