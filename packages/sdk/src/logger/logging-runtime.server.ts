import type { Logger } from 'winston';
import type { NodeSDK } from '@opentelemetry/sdk-node';

export interface LoggingRuntimeConfig {
  readonly environment: 'development' | 'production';
  readonly consoleEnabled: boolean;
  readonly uiEnabled: boolean;
  readonly otelRequested: boolean;
  readonly otelRequired: boolean;
}

export interface OtelInitializationResult {
  readonly status: 'ready' | 'disabled' | 'failed';
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
  status: 'disabled',
  reason: 'OTEL SDK wurde noch nicht initialisiert.',
};

const resolveEnvironment = (value: string | undefined): LoggingRuntimeConfig['environment'] => {
  return value === 'production' ? 'production' : 'development';
};

export const getLoggingRuntimeConfig = (): LoggingRuntimeConfig => {
  const environment = resolveEnvironment(process.env.NODE_ENV);
  const devDisableFlag = process.env.ENABLE_OTEL;
  const otelRequested = environment === 'production' ? true : devDisableFlag !== 'false' && devDisableFlag !== '0';

  return {
    environment,
    consoleEnabled: environment === 'development',
    uiEnabled: environment === 'development',
    otelRequested,
    otelRequired: environment === 'production',
  };
};

export const getOtelInitializationResult = (): OtelInitializationResult => {
  return otelRuntimeResult;
};

export const isOtelRuntimeReady = (): boolean => {
  return otelRuntimeResult.status === 'ready';
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
};

export const registerOtelAwareLogger = (entry: RegisteredLogger): void => {
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
    status: 'disabled',
    reason: 'Test-Reset',
  };
};
