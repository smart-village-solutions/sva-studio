import {
  isBrowserConsoleCaptureSuppressed,
  redactLogString,
  registerBrowserLogSink,
  serializeAndRedactLogValue,
  stringifyNonPlainValue,
} from '@sva/sdk/logging';

export type BrowserDevelopmentLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface BrowserDevelopmentLogEntry {
  readonly id: number;
  readonly timestamp: string;
  readonly source: 'browser';
  readonly level: BrowserDevelopmentLogLevel;
  readonly message: string;
  readonly component: string;
  readonly context?: Record<string, unknown>;
}

type BrowserLogListener = (entries: BrowserDevelopmentLogEntry[]) => void;

const MAX_BROWSER_DEVELOPMENT_LOG_ENTRIES = 200;

let nextBrowserLogId = 1;
let browserLogEntries: BrowserDevelopmentLogEntry[] = [];
const browserLogListeners = new Set<BrowserLogListener>();
let browserCaptureStop: (() => void) | null = null;

const serializeValue = (value: unknown): unknown => {
  return serializeAndRedactLogValue(value);
};

const stringifyMessage = (args: readonly unknown[]): string => {
  if (args.length === 0) {
    return '';
  }

  return args
    .map((value) => {
      if (typeof value === 'string') {
        return redactLogString(value);
      }

      try {
        return JSON.stringify(serializeValue(value));
      } catch {
        return value && typeof value === 'object' ? stringifyNonPlainValue(value) : String(value);
      }
    })
    .join(' ');
};

const notifyBrowserLogListeners = () => {
  const snapshot = [...browserLogEntries];
  for (const listener of browserLogListeners) {
    listener(snapshot);
  }
};

export const appendBrowserDevelopmentLog = (
  level: BrowserDevelopmentLogLevel,
  args: readonly unknown[],
  context?: Record<string, unknown>,
  component = 'browser-console'
): BrowserDevelopmentLogEntry => {
  const entry: BrowserDevelopmentLogEntry = {
    id: nextBrowserLogId++,
    timestamp: new Date().toISOString(),
    source: 'browser',
    level,
    message: stringifyMessage(args),
    component,
    context:
      context && typeof context === 'object' && !Array.isArray(context)
        ? (serializeValue(context) as Record<string, unknown>)
        : undefined,
  };

  browserLogEntries = [...browserLogEntries, entry].slice(-MAX_BROWSER_DEVELOPMENT_LOG_ENTRIES);
  notifyBrowserLogListeners();
  return entry;
};

export const getBrowserDevelopmentLogs = (): BrowserDevelopmentLogEntry[] => {
  return [...browserLogEntries];
};

export const subscribeToBrowserDevelopmentLogs = (listener: BrowserLogListener): (() => void) => {
  browserLogListeners.add(listener);
  listener(getBrowserDevelopmentLogs());

  return () => {
    browserLogListeners.delete(listener);
  };
};

export const startBrowserDevelopmentLogCapture = (): (() => void) => {
  if (browserCaptureStop || globalThis.window === undefined) {
    return browserCaptureStop ?? (() => undefined);
  }

  const originalConsole = {
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  console.debug = (...args: unknown[]) => {
    if (isBrowserConsoleCaptureSuppressed()) {
      originalConsole.debug(...args);
      return;
    }
    appendBrowserDevelopmentLog('debug', args);
    originalConsole.debug(...args);
  };

  console.info = (...args: unknown[]) => {
    if (isBrowserConsoleCaptureSuppressed()) {
      originalConsole.info(...args);
      return;
    }
    appendBrowserDevelopmentLog('info', args);
    originalConsole.info(...args);
  };

  console.warn = (...args: unknown[]) => {
    if (isBrowserConsoleCaptureSuppressed()) {
      originalConsole.warn(...args);
      return;
    }
    appendBrowserDevelopmentLog('warn', args);
    originalConsole.warn(...args);
  };

  console.error = (...args: unknown[]) => {
    if (isBrowserConsoleCaptureSuppressed()) {
      originalConsole.error(...args);
      return;
    }
    appendBrowserDevelopmentLog('error', args);
    originalConsole.error(...args);
  };

  const unregisterBrowserLogSink = registerBrowserLogSink((entry) => {
    appendBrowserDevelopmentLog(entry.level, [entry.message], entry.context, entry.component);
  });

  const handleWindowError = (event: ErrorEvent) => {
    appendBrowserDevelopmentLog('error', [event.message || 'window error'], {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    appendBrowserDevelopmentLog('error', ['Unhandled promise rejection'], {
      reason: serializeValue(event.reason),
    });
  };

  globalThis.addEventListener('error', handleWindowError);
  globalThis.addEventListener('unhandledrejection', handleUnhandledRejection);

  browserCaptureStop = () => {
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    globalThis.removeEventListener('error', handleWindowError);
    globalThis.removeEventListener('unhandledrejection', handleUnhandledRejection);
    unregisterBrowserLogSink();
    browserCaptureStop = null;
  };

  return browserCaptureStop;
};

export const resetBrowserDevelopmentLogsForTests = (): void => {
  nextBrowserLogId = 1;
  browserLogEntries = [];
  notifyBrowserLogListeners();
  if (browserCaptureStop) {
    browserCaptureStop();
  }
};
