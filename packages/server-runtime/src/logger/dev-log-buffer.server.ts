import { serializeAndRedactLogValue } from '@sva/monitoring-client/logging';

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

const isDevelopmentLogContext = (
  value: unknown
): value is Record<string, DevelopmentLogJsonValue> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

export const appendDevelopmentLogEntry = (entry: Omit<DevelopmentLogEntry, 'id'>): DevelopmentLogEntry => {
  const serializedContext = serializeAndRedactLogValue(entry.context);
  const nextEntry: DevelopmentLogEntry = {
    ...entry,
    context: isDevelopmentLogContext(serializedContext) ? serializedContext : undefined,
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
