import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createBrowserLogger,
  isBrowserConsoleCaptureSuppressed,
  registerBrowserLogSink,
  redactLogMeta,
  redactLogString,
  serializeAndRedactLogValue,
  stringifyNonPlainValue,
} from '../src/logging.js';

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

  it('redacts inline secrets, bearer tokens and jwt-like fragments in strings', () => {
    const redacted = redactLogString(
      'authorization: Bearer token-123 password=secret access_token=abc.123 code=xyz eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.sig'
    );

    expect(redacted).toContain('authorization: [REDACTED]');
    expect(redacted).toContain('password=[REDACTED]');
    expect(redacted).toContain('access_token=[REDACTED]');
    expect(redacted).toContain('code=[REDACTED]');
    expect(redacted).toContain('[REDACTED_JWT]');
  });

  it('redacts sensitive object keys and serializes nested values defensively', () => {
    const error = new Error('token=secret');
    Object.assign(error, { access_token: 'secret-token' });

    const invalidDate = new Date('invalid');
    class CustomObject {
      toString() {
        return 'cookie=session123';
      }
    }

    class ThrowingToString {
      toString() {
        throw new Error('broken stringifier');
      }
    }

    expect(
      redactLogMeta({
        password: 'top-secret',
        nested: [
          'alice@example.org',
          invalidDate,
          new CustomObject(),
          new ThrowingToString(),
          error,
        ],
      })
    ).toEqual({
      password: '[REDACTED]',
      nested: [
        'a***@example.org',
        'Invalid Date',
        'cookie=[REDACTED]',
        '[object Object]',
        expect.objectContaining({
          message: 'token=[REDACTED]',
          access_token: '[REDACTED]',
        }),
      ],
    });
  });

  it('stringifies non-plain objects and preserves primitive-like values', () => {
    expect(stringifyNonPlainValue(new URL('https://alice@example.org/path?token=abc'))).toContain('a***@example.org');
    expect(serializeAndRedactLogValue(42)).toBe(42);
    expect(serializeAndRedactLogValue(true)).toBe(true);
    expect(serializeAndRedactLogValue(undefined)).toBeNull();
  });
});
