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
    });
  });

  it('disables development OTEL when ENABLE_OTEL=false is set', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_OTEL = 'false';

    const { getLoggingRuntimeConfig } = await import('../src/logger/logging-runtime.server');

    expect(getLoggingRuntimeConfig().otelRequested).toBe(false);
  });

  it('forces OTEL and disables console/UI in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_OTEL = 'false';

    const { getLoggingRuntimeConfig } = await import('../src/logger/logging-runtime.server');

    expect(getLoggingRuntimeConfig()).toEqual({
      environment: 'production',
      consoleEnabled: false,
      uiEnabled: false,
      otelRequested: true,
      otelRequired: true,
    });
  });

  it('starts in pending state before OTEL bootstrap finishes', async () => {
    const { getOtelInitializationResult } = await import('../src/logger/logging-runtime.server');

    expect(getOtelInitializationResult().status).toBe('pending');
  });
});
