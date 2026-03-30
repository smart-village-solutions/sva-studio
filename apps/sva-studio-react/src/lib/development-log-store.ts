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

const SENSITIVE_CONTEXT_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'api_key',
  'secret',
  'client_secret',
  'email',
  'cookie',
  'set-cookie',
  'session',
  'session_id',
  'user_id',
  'csrf',
  'refresh_token',
  'access_token',
  'id_token',
  'id_token_hint',
  'x-api-key',
  'x-csrf-token',
  'actor_user_id',
  'session_user_id',
  'actor_account_id',
  'keycloak_subject',
  'db_keycloak_subject',
]);
const jwtLikeRegex = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?\b/g;
const querySecretRegexSource = String.raw`([?&](?:access_token|refresh_token|id_token|id_token_hint|token|code|client_secret|api_key|authorization)=)([^&#\s]+)`;
const inlineQuerySecretRegexSource = String.raw`((?:^|[\s,(])(?:access_token|refresh_token|id_token|id_token_hint|token|code|client_secret|api_key|authorization)[\w.-]{0,20}[=:]\s*)([^\s,)]+)`;
const inlineSensitiveFieldRegexSource = String.raw`((?:^|[\s,(])(?:password|secret|session|cookie|csrf)[\w.-]{0,20}[=:]\s*)([^\s,)]+)`;
const urlSecretPatterns: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(authorization:\s*)(bearer\s+)?[^\s,]+/gi, '$1[REDACTED]'],
  [/\b(bearer\s+)(?!\[REDACTED(?:_JWT)?\])[^\s,]+/gi, '$1[REDACTED]'],
  [new RegExp(querySecretRegexSource, 'gi'), '$1[REDACTED]'],
  [new RegExp(inlineQuerySecretRegexSource, 'gi'), '$1[REDACTED]'],
  [new RegExp(inlineSensitiveFieldRegexSource, 'gi'), '$1[REDACTED]'],
];

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isEmailCharacter = (character: string): boolean => {
  return /[A-Za-z0-9._%+-]/.test(character);
};

const maskEmailToken = (token: string): string => {
  const atIndex = token.indexOf('@');
  if (atIndex <= 0 || atIndex === token.length - 1) {
    return token;
  }

  const localPart = token.slice(0, atIndex);
  const domain = token.slice(atIndex + 1);
  if (!domain.includes('.') || !/\.[A-Za-z]{2,}$/.test(domain)) {
    return token;
  }

  return `${localPart[0]}***@${domain}`;
};

const maskEmail = (value: string): string => {
  let maskedValue = '';
  let tokenStart = -1;

  const flushToken = (tokenEnd: number) => {
    if (tokenStart < 0) {
      return;
    }

    maskedValue += maskEmailToken(value.slice(tokenStart, tokenEnd));
    tokenStart = -1;
  };

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? '';
    if (isEmailCharacter(character) || character === '@') {
      if (tokenStart < 0) {
        tokenStart = index;
      }
      continue;
    }

    flushToken(index);
    maskedValue += character;
  }

  flushToken(value.length);
  return maskedValue;
};

const redactSensitiveString = (value: string): string => {
  let next = maskEmail(value);
  next = next.replaceAll(jwtLikeRegex, '[REDACTED_JWT]');
  for (const [pattern, replacement] of urlSecretPatterns) {
    next = next.replaceAll(pattern, replacement);
  }
  return next;
};

const serializeValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return typeof value === 'string' ? redactSensitiveString(value) : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeValue(entry));
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? String(value) : value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveString(value.message),
      ...(typeof value.stack === 'string' ? { stack: redactSensitiveString(value.stack) } : {}),
    };
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_CONTEXT_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : serializeValue(entry),
      ])
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
        return redactSensitiveString(value);
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
    context: isPlainObject(context) ? (serializeValue(context) as Record<string, unknown>) : undefined,
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

  globalThis.addEventListener('error', handleWindowError);
  globalThis.addEventListener('unhandledrejection', handleUnhandledRejection);

  browserCaptureStop = () => {
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    globalThis.removeEventListener('error', handleWindowError);
    globalThis.removeEventListener('unhandledrejection', handleUnhandledRejection);
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
