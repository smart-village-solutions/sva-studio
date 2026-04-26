import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getLoggingRuntimeConfig,
  getOtelInitializationResult,
  getRegisteredOtelLoggerCountForTests,
  isOtelRuntimePending,
  isOtelRuntimeReady,
  registerOtelAwareLogger,
  resetLoggingRuntimeForTests,
  setOtelInitializationResult,
  unregisterOtelAwareLogger,
} from './logging-runtime.server.js';

describe('logging runtime state', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetLoggingRuntimeForTests();
  });

  it('derives production logging config from otel and console flags', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENABLE_OTEL', '0');
    vi.stubEnv('SVA_ENABLE_SERVER_CONSOLE_LOGS', 'true');

    expect(getLoggingRuntimeConfig()).toMatchObject({
      consoleEnabled: true,
      environment: 'production',
      mode: 'console_to_loki',
      otelRequested: false,
      otelRequired: false,
      uiEnabled: false,
    });
  });

  it('reports degraded mode when no transport is configured', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENABLE_OTEL', 'false');
    vi.stubEnv('SVA_ENABLE_SERVER_CONSOLE_LOGS', 'false');

    expect(getLoggingRuntimeConfig()).toMatchObject({
      consoleEnabled: false,
      mode: 'degraded',
      otelRequested: false,
    });
  });

  it('syncs pending otel-aware loggers when initialization completes', () => {
    const logger = {} as Parameters<typeof unregisterOtelAwareLogger>[0];
    const syncOtelTransport = vi.fn();

    expect(isOtelRuntimePending()).toBe(true);
    registerOtelAwareLogger({ logger, otelEnabled: true, syncOtelTransport });

    expect(getRegisteredOtelLoggerCountForTests()).toBe(1);
    expect(syncOtelTransport).toHaveBeenLastCalledWith(false);

    setOtelInitializationResult({ status: 'ready' });

    expect(isOtelRuntimeReady()).toBe(true);
    expect(getOtelInitializationResult()).toMatchObject({ status: 'ready' });
    expect(syncOtelTransport).toHaveBeenLastCalledWith(true);
    expect(getRegisteredOtelLoggerCountForTests()).toBe(0);
  });

  it('can unregister pending otel-aware loggers before initialization completes', () => {
    const logger = {} as Parameters<typeof unregisterOtelAwareLogger>[0];
    const syncOtelTransport = vi.fn();

    registerOtelAwareLogger({ logger, otelEnabled: true, syncOtelTransport });
    unregisterOtelAwareLogger(logger);

    expect(getRegisteredOtelLoggerCountForTests()).toBe(0);
  });
});
