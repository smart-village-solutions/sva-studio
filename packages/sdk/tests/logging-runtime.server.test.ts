import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('logging runtime config', () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv };
    const runtime = await import('../src/logger/logging-runtime.server');
    runtime.resetLoggingRuntimeForTests();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('enables console and UI in development by default', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ENABLE_OTEL;

    const { getLoggingRuntimeConfig } = await import('../src/logger/logging-runtime.server');

    expect(getLoggingRuntimeConfig()).toEqual({
      environment: 'development',
      consoleEnabled: true,
      uiEnabled: true,
      otelRequested: true,
      otelRequired: false,
      mode: 'otel_to_loki',
    });
  });

  it('disables development OTEL when ENABLE_OTEL=false is set', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_OTEL = 'false';

    const { getLoggingRuntimeConfig } = await import('../src/logger/logging-runtime.server');

    expect(getLoggingRuntimeConfig()).toEqual({
      environment: 'development',
      consoleEnabled: true,
      uiEnabled: true,
      otelRequested: false,
      otelRequired: false,
      mode: 'console_to_loki',
    });
  });

  it('supports console-to-loki mode in production when OTEL is disabled explicitly', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_OTEL = 'false';
    process.env.SVA_ENABLE_SERVER_CONSOLE_LOGS = 'true';

    const { getLoggingRuntimeConfig } = await import('../src/logger/logging-runtime.server');

    expect(getLoggingRuntimeConfig()).toEqual({
      environment: 'production',
      consoleEnabled: true,
      uiEnabled: false,
      otelRequested: false,
      otelRequired: false,
      mode: 'console_to_loki',
    });
  });

  it('reports degraded mode in production when both OTEL and console logging are disabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_OTEL = 'false';
    delete process.env.SVA_ENABLE_SERVER_CONSOLE_LOGS;

    const { getLoggingRuntimeConfig } = await import('../src/logger/logging-runtime.server');

    expect(getLoggingRuntimeConfig()).toEqual({
      environment: 'production',
      consoleEnabled: false,
      uiEnabled: false,
      otelRequested: false,
      otelRequired: false,
      mode: 'degraded',
    });
  });

  it('keeps OTEL-first mode in production by default', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_OTEL;

    const { getLoggingRuntimeConfig } = await import('../src/logger/logging-runtime.server');

    expect(getLoggingRuntimeConfig()).toEqual({
      environment: 'production',
      consoleEnabled: false,
      uiEnabled: false,
      otelRequested: true,
      otelRequired: true,
      mode: 'otel_to_loki',
    });
  });

  it('starts in pending state before OTEL bootstrap finishes', async () => {
    const { getOtelInitializationResult } = await import('../src/logger/logging-runtime.server');

    expect(getOtelInitializationResult().status).toBe('pending');
  });
});
