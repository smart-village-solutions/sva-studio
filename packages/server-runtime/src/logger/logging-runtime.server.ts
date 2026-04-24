import type { Logger } from 'winston';
import type { NodeSDK } from '@opentelemetry/sdk-node';

export interface LoggingRuntimeConfig {
  readonly environment: 'development' | 'production';
  readonly consoleEnabled: boolean;
  readonly uiEnabled: boolean;
  readonly otelRequested: boolean;
  readonly otelRequired: boolean;
  readonly mode: 'console_to_loki' | 'otel_to_loki' | 'degraded';
}

export interface OtelInitializationResult {
  readonly status: 'pending' | 'ready' | 'disabled' | 'failed';
  readonly sdk?: NodeSDK;
  readonly reason?: string;
}

type RegisteredLogger = {
  readonly logger: Logger;
  readonly otelEnabled: boolean;
  readonly syncOtelTransport: (ready: boolean) => void;
};

const registeredLoggers = new Set<RegisteredLogger>();

let otelRuntimeResult: OtelInitializationResult = {
  status: 'pending',
  reason: 'OTEL SDK wurde noch nicht initialisiert.',
};

const resolveEnvironment = (value: string | undefined): LoggingRuntimeConfig['environment'] => {
  return value === 'production' ? 'production' : 'development';
};

const isDisabledFlag = (value: string | undefined): boolean => {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'false' || normalized === '0';
};

const resolveLoggingMode = (input: {
  consoleEnabled: boolean;
  otelRequested: boolean;
}): LoggingRuntimeConfig['mode'] => {
  if (input.otelRequested) {
    return 'otel_to_loki';
  }
  if (input.consoleEnabled) {
    return 'console_to_loki';
  }
  return 'degraded';
};

export const getLoggingRuntimeConfig = (): LoggingRuntimeConfig => {
  const environment = resolveEnvironment(process.env.NODE_ENV);
  const otelRequested = !isDisabledFlag(process.env.ENABLE_OTEL);
  const consoleOverride = (process.env.SVA_ENABLE_SERVER_CONSOLE_LOGS?.trim() || '').toLowerCase();
  const consoleEnabledInProduction = consoleOverride === 'true' || consoleOverride === '1';
  const consoleEnabled = environment === 'development' || consoleEnabledInProduction;

  return {
    environment,
    consoleEnabled,
    uiEnabled: environment === 'development',
    otelRequested,
    otelRequired: environment === 'production' && otelRequested,
    mode: resolveLoggingMode({
      consoleEnabled,
      otelRequested,
    }),
  };
};

export const getOtelInitializationResult = (): OtelInitializationResult => {
  return otelRuntimeResult;
};

export const isOtelRuntimeReady = (): boolean => {
  return otelRuntimeResult.status === 'ready';
};

export const isOtelRuntimePending = (): boolean => {
  return otelRuntimeResult.status === 'pending';
};

export const setOtelInitializationResult = (result: OtelInitializationResult): void => {
  otelRuntimeResult = result;

  const otelReady = result.status === 'ready';
  for (const entry of registeredLoggers) {
    if (!entry.otelEnabled) {
      continue;
    }
    entry.syncOtelTransport(otelReady);
  }

  if (result.status !== 'pending') {
    registeredLoggers.clear();
  }
};

export const registerOtelAwareLogger = (entry: RegisteredLogger): void => {
  if (!isOtelRuntimePending()) {
    entry.syncOtelTransport(isOtelRuntimeReady());
    return;
  }

  registeredLoggers.add(entry);
  entry.syncOtelTransport(isOtelRuntimeReady());
};

export const unregisterOtelAwareLogger = (logger: Logger): void => {
  for (const entry of registeredLoggers) {
    if (entry.logger === logger) {
      registeredLoggers.delete(entry);
      break;
    }
  }
};

export const resetLoggingRuntimeForTests = (): void => {
  registeredLoggers.clear();
  otelRuntimeResult = {
    status: 'pending',
    reason: 'Test-Reset',
  };
};

export const getRegisteredOtelLoggerCountForTests = (): number => {
  return registeredLoggers.size;
};
