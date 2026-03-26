import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  appendBrowserDevelopmentLog,
  getBrowserDevelopmentLogs,
  resetBrowserDevelopmentLogsForTests,
  startBrowserDevelopmentLogCapture,
  subscribeToBrowserDevelopmentLogs,
} from './development-log-store';

describe('development log store', () => {
  beforeEach(() => {
    resetBrowserDevelopmentLogsForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetBrowserDevelopmentLogsForTests();
  });

  it('redacts sensitive browser log messages and context values', () => {
    const entry = appendBrowserDevelopmentLog(
      'error',
      [
        'Authorization: Bearer secret-token-value',
        'https://issuer.example/logout?id_token_hint=eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.signature',
      ],
      {
        email: 'test@example.org',
        nested: {
          code: 'abc123',
          note: 'bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.signature',
        },
      }
    );

    expect(entry.message).toContain('Authorization: [REDACTED]');
    expect(entry.message).toContain('id_token_hint=[REDACTED]');
    expect(entry.context).toEqual({
      email: '[REDACTED]',
      nested: {
        code: 'abc123',
        note: 'bearer [REDACTED_JWT]',
      },
    });
  });

  it('serializes complex values and notifies subscribers until they unsubscribe', () => {
    const received: Array<ReturnType<typeof getBrowserDevelopmentLogs>> = [];
    const unsubscribe = subscribeToBrowserDevelopmentLogs((entries) => {
      received.push(entries);
    });

    const entry = appendBrowserDevelopmentLog('warn', [{ state: 'ok' }], {
      occurredAt: new Date('2026-03-25T12:00:00.000Z'),
      failure: Object.assign(new Error('token eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.signature'), {
        code: 'E_TEST',
      }),
      diagnostic: {
        nested: 'https://issuer.example/logout?code=abc123',
      },
    });

    unsubscribe();
    appendBrowserDevelopmentLog('info', ['after unsubscribe']);

    expect(entry.message).toContain('{"state":"ok"}');
    expect(entry.context).toEqual({
      occurredAt: '2026-03-25T12:00:00.000Z',
      failure: expect.objectContaining({
        name: 'Error',
        message: 'token [REDACTED_JWT]',
      }),
      diagnostic: {
        nested: 'https://issuer.example/logout?code=[REDACTED]',
      },
    });
    expect(received).toHaveLength(2);
    expect(received[0]).toEqual([]);
    expect(received[1]).toHaveLength(1);
  });

  it('captures console calls and browser events only once until stopped', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const stopCapture = startBrowserDevelopmentLogCapture();
    const secondStopCapture = startBrowserDevelopmentLogCapture();

    console.debug('debug message');
    console.info('info message');
    console.warn('Authorization: Bearer secret-token-value');
    console.error('error message');

    const browserErrorEvent = Object.assign(new Event('error'), {
      message: 'window exploded',
      filename: 'app.tsx',
      lineno: 12,
      colno: 7,
    });
    globalThis.dispatchEvent(browserErrorEvent);

    const rejectionEvent = Object.assign(new Event('unhandledrejection'), {
      reason: new Error('rejected with access_token=abc123'),
    });
    globalThis.dispatchEvent(rejectionEvent);

    stopCapture();
    console.info('after stop');

    expect(secondStopCapture).toBe(stopCapture);
    expect(debugSpy).toHaveBeenCalledWith('debug message');
    expect(infoSpy).toHaveBeenCalledWith('info message');
    expect(warnSpy).toHaveBeenCalledWith('Authorization: Bearer secret-token-value');
    expect(errorSpy).toHaveBeenCalledWith('error message');

    expect(getBrowserDevelopmentLogs()).toEqual([
      expect.objectContaining({ level: 'debug', message: 'debug message' }),
      expect.objectContaining({ level: 'info', message: 'info message' }),
      expect.objectContaining({ level: 'warn', message: 'Authorization: [REDACTED]' }),
      expect.objectContaining({ level: 'error', message: 'error message' }),
      expect.objectContaining({
        level: 'error',
        message: 'window exploded',
        context: expect.objectContaining({ filename: 'app.tsx', lineno: 12, colno: 7 }),
      }),
      expect.objectContaining({
        level: 'error',
        message: 'Unhandled promise rejection',
        context: expect.objectContaining({
          reason: expect.objectContaining({ message: 'rejected with access_token=[REDACTED]' }),
        }),
      }),
    ]);
  });
});