export type DevelopmentLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'verbose';
export type DevelopmentLogSource = 'server';
export type DevelopmentLogJsonValue =
  | string
  | number
  | boolean
  | null
  | DevelopmentLogJsonValue[]
  | { readonly [key: string]: DevelopmentLogJsonValue };

export interface DevelopmentLogEntry {
  readonly id: number;
  readonly timestamp: string;
  readonly level: DevelopmentLogLevel;
  readonly source: DevelopmentLogSource;
  readonly message: string;
  readonly component?: string;
  readonly context?: Record<string, DevelopmentLogJsonValue>;
}

export interface DevelopmentLogQuery {
  readonly afterId?: number;
}

const MAX_DEVELOPMENT_LOG_ENTRIES = 400;

let nextDevelopmentLogId = 1;
let developmentLogEntries: DevelopmentLogEntry[] = [];

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const serializeError = (value: Error): Record<string, DevelopmentLogJsonValue> => {
  const serialized: Record<string, DevelopmentLogJsonValue> = {
    name: value.name,
    message: value.message,
  };

  if (typeof value.stack === 'string') {
    serialized.stack = value.stack;
  }

  for (const [key, entry] of Object.entries(value)) {
    serialized[key] = toSerializableValue(entry);
  }

  return serialized;
};

const stringifyNonPlainValue = (value: object): string => {
  const stringifier = value.toString;
  if (typeof stringifier === 'function' && stringifier !== Object.prototype.toString) {
    try {
      return String(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }

  return Object.prototype.toString.call(value);
};

const toSerializableValue = (value: unknown): DevelopmentLogJsonValue => {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toSerializableValue(item));
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? String(value) : value.toISOString();
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toSerializableValue(entry)]));
  }

  return stringifyNonPlainValue(value);
};

export const appendDevelopmentLogEntry = (entry: Omit<DevelopmentLogEntry, 'id'>): DevelopmentLogEntry => {
  const nextEntry: DevelopmentLogEntry = {
    ...entry,
    context: isPlainObject(entry.context)
      ? (toSerializableValue(entry.context) as Record<string, DevelopmentLogJsonValue>)
      : undefined,
    id: nextDevelopmentLogId++,
  };

  developmentLogEntries = [...developmentLogEntries, nextEntry].slice(-MAX_DEVELOPMENT_LOG_ENTRIES);
  return nextEntry;
};

export const readDevelopmentLogEntries = (query: DevelopmentLogQuery = {}): DevelopmentLogEntry[] => {
  const afterId = query.afterId;

  if (afterId === undefined) {
    return [...developmentLogEntries];
  }

  return developmentLogEntries.filter((entry) => entry.id > afterId);
};

export const resetDevelopmentLogBufferForTests = (): void => {
  nextDevelopmentLogId = 1;
  developmentLogEntries = [];
};
