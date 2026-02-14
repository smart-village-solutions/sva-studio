/**
 * Globaler Logger Provider Singleton
 *
 * Dies wird vom OTEL SDK gesetzt wenn es initialisiert wird,
 * damit Winston Transport und andere Komponenten darauf zugreifen können.
 */

import type { LoggerProvider } from '@opentelemetry/sdk-logs';

let globalLoggerProvider: LoggerProvider | null = null;

export const setGlobalLoggerProvider = (provider: LoggerProvider | null) => {
  globalLoggerProvider = provider;
};

export const getGlobalLoggerProvider = (): LoggerProvider | null => {
  return globalLoggerProvider;
};

export const hasLoggerProvider = (): boolean => {
  return globalLoggerProvider !== null;
};
