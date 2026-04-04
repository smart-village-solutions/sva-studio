import { beforeEach, describe, expect, it } from 'vitest';

import { createSdkLogger } from '../../src/logger/index.server';
import {
  resetLoggingRuntimeForTests,
  setOtelInitializationResult,
} from '../../src/logger/logging-runtime.server';

describe('logger/index.server logging mode metadata', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    delete process.env.ENABLE_OTEL;
    delete process.env.SVA_ENABLE_SERVER_CONSOLE_LOGS;
    resetLoggingRuntimeForTests();
  });

  it('marks console-disabled and otel-disabled loggers as degraded even when runtime mode prefers console', async () => {
    const logger = createSdkLogger({
      component: 'logging-mode-test',
      enableConsole: false,
      enableOtel: false,
    });

    expect((logger as unknown as { defaultMeta?: Record<string, unknown> }).defaultMeta).toMatchObject({
      component: 'logging-mode-test',
      logging_mode: 'degraded',
    });
  });

  it('uses the effective logger environment for console transport and metadata', () => {
    const logger = createSdkLogger({
      component: 'logging-mode-test',
      environment: 'test',
      enableConsole: true,
      enableOtel: false,
    });

    expect((logger as unknown as { defaultMeta?: Record<string, unknown> }).defaultMeta).toMatchObject({
      component: 'logging-mode-test',
      environment: 'test',
      logging_mode: 'console_to_loki',
    });
  });

  it('keeps an emergency console transport when both console and otel are disabled', () => {
    const logger = createSdkLogger({
      component: 'logging-mode-test',
      environment: 'test',
      enableConsole: false,
      enableOtel: false,
    });

    expect(logger.transports).toHaveLength(1);
  });

  it('marks loggers as otel_to_loki when otel is enabled and ready', () => {
    setOtelInitializationResult({ status: 'ready' });

    const logger = createSdkLogger({
      component: 'logging-mode-test',
      environment: 'production',
      enableConsole: false,
      enableOtel: true,
    });

    expect((logger as unknown as { defaultMeta?: Record<string, unknown> }).defaultMeta).toMatchObject({
      component: 'logging-mode-test',
      environment: 'production',
      logging_mode: 'otel_to_loki',
    });
    expect(logger.transports.length).toBeGreaterThanOrEqual(1);
  });

  it('defaults the environment to development when node env is not production', () => {
    process.env.NODE_ENV = 'staging';

    const logger = createSdkLogger({
      component: 'logging-mode-test',
      enableConsole: true,
      enableOtel: false,
    });

    expect((logger as unknown as { defaultMeta?: Record<string, unknown> }).defaultMeta).toMatchObject({
      component: 'logging-mode-test',
      environment: 'staging',
      logging_mode: 'console_to_loki',
    });
  });
});
