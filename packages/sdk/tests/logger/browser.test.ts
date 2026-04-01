import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createBrowserLogger,
  isBrowserConsoleCaptureSuppressed,
  registerBrowserLogSink,
} from '../../src/logging';

describe('browser logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts sensitive values before writing to console and sinks', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const sink = vi.fn();
    const unregister = registerBrowserLogSink(sink);
    const logger = createBrowserLogger({ component: 'test-browser' });

    logger.error('Request failed for alice@example.org', {
      access_token: 'secret-token',
      callback: 'https://issuer.example/logout?id_token_hint=eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.signature',
    });

    expect(errorSpy).toHaveBeenCalledWith('Request failed for a***@example.org', {
      access_token: '[REDACTED]',
      callback: 'https://issuer.example/logout?id_token_hint=[REDACTED]',
    });
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        component: 'test-browser',
        level: 'error',
        message: 'Request failed for a***@example.org',
        context: {
          access_token: '[REDACTED]',
          callback: 'https://issuer.example/logout?id_token_hint=[REDACTED]',
        },
      })
    );

    unregister();
  });

  it('suppresses console capture only while the logger writes to console', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const logger = createBrowserLogger({ component: 'test-browser' });

    expect(isBrowserConsoleCaptureSuppressed()).toBe(false);

    infoSpy.mockImplementation(() => {
      expect(isBrowserConsoleCaptureSuppressed()).toBe(true);
    });

    logger.info('hello');

    expect(infoSpy).toHaveBeenCalledWith('hello');
    expect(isBrowserConsoleCaptureSuppressed()).toBe(false);
  });

  it('isolates failing sinks and still writes the log entry to console', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const healthySink = vi.fn();
    const unregisterFailing = registerBrowserLogSink(() => {
      throw new Error('sink failed');
    });
    const unregisterHealthy = registerBrowserLogSink(healthySink);
    const logger = createBrowserLogger({ component: 'test-browser' });

    logger.info('hello');

    expect(warnSpy).toHaveBeenCalledWith('Browser log sink failed', {
      component: 'test-browser',
      sink_error: 'sink failed',
    });
    expect(healthySink).toHaveBeenCalledWith(
      expect.objectContaining({
        component: 'test-browser',
        level: 'info',
        message: 'hello',
      })
    );
    expect(infoSpy).toHaveBeenCalledWith('hello');

    unregisterHealthy();
    unregisterFailing();
  });
});
