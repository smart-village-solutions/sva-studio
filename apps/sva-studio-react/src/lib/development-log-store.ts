export type BrowserDevelopmentLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface BrowserDevelopmentLogEntry {
  readonly id: number;
  readonly timestamp: string;
  readonly source: 'browser';
  readonly level: BrowserDevelopmentLogLevel;
  readonly message: string;
  readonly component: 'browser-console';
  readonly context?: Record<string, unknown>;
}

type BrowserLogListener = (entries: BrowserDevelopmentLogEntry[]) => void;

const MAX_BROWSER_DEVELOPMENT_LOG_ENTRIES = 200;

let nextBrowserLogId = 1;
let browserLogEntries: BrowserDevelopmentLogEntry[] = [];
const browserLogListeners = new Set<BrowserLogListener>();
let browserCaptureStop: (() => void) | null = null;

const serializeValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeValue(entry));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, serializeValue(entry)])
    );
  }

  return String(value);
};

const stringifyMessage = (args: readonly unknown[]): string => {
  if (args.length === 0) {
    return '';
  }

  return args
    .map((value) => {
      if (typeof value === 'string') {
        return value;
      }

      try {
        return JSON.stringify(serializeValue(value));
      } catch {
        return String(value);
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
  context?: Record<string, unknown>
): BrowserDevelopmentLogEntry => {
  const entry: BrowserDevelopmentLogEntry = {
    id: nextBrowserLogId++,
    timestamp: new Date().toISOString(),
    source: 'browser',
    level,
    message: stringifyMessage(args),
    component: 'browser-console',
    context,
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
  if (browserCaptureStop || typeof window === 'undefined') {
    return browserCaptureStop ?? (() => undefined);
  }

  const originalConsole = {
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  console.debug = (...args: unknown[]) => {
    appendBrowserDevelopmentLog('debug', args);
    originalConsole.debug(...args);
  };

  console.info = (...args: unknown[]) => {
    appendBrowserDevelopmentLog('info', args);
    originalConsole.info(...args);
  };

  console.warn = (...args: unknown[]) => {
    appendBrowserDevelopmentLog('warn', args);
    originalConsole.warn(...args);
  };

  console.error = (...args: unknown[]) => {
    appendBrowserDevelopmentLog('error', args);
    originalConsole.error(...args);
  };

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

  window.addEventListener('error', handleWindowError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  browserCaptureStop = () => {
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    window.removeEventListener('error', handleWindowError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
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
