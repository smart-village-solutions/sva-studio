import { beforeEach, describe, expect, it } from 'vitest';

import { createSdkLogger } from '../../src/logger/index.server';
import { resetLoggingRuntimeForTests } from '../../src/logger/logging-runtime.server';

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
});
