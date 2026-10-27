import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  installClientErrorTelemetry,
  setClientErrorTelemetryIdentity,
} from './client-error-telemetry.client.js';

describe('client error telemetry reporter', () => {
  afterEach(() => {
    setClientErrorTelemetryIdentity(null);
    vi.useRealTimers();
  });

  it('sends only a stable error category and ignores already-correlated failures', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    setClientErrorTelemetryIdentity({ userId: 'user-a', instanceId: 'tenant-a' });
    const uninstall = installClientErrorTelemetry(window, fetcher as typeof fetch);
    const correlatedError = Object.assign(new Error('private server response'), {
      requestId: 'api-request-1',
    });
    window.dispatchEvent(new ErrorEvent('error', { error: correlatedError }));
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('private client detail') }));
    await Promise.resolve();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/monitoring/client-errors',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
        body: expect.stringMatching(/"errorCode":"client_unhandled_error"/),
      })
    );
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain('private');
    uninstall();
  });

  it('caps reports at ten per five minutes and retries a failed report at most once', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
    setClientErrorTelemetryIdentity({ userId: 'user-b', instanceId: 'tenant-a' });
    const uninstall = installClientErrorTelemetry(window, fetcher as typeof fetch);
    for (let index = 0; index < 11; index += 1) {
      window.dispatchEvent(new ErrorEvent('error', { error: new Error('offline') }));
    }
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(10);
    window.dispatchEvent(new Event('online'));
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(20);
    await vi.advanceTimersByTimeAsync(10_000);
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(20);
    uninstall();
  });

  it('drops pending reports when the authenticated user or tenant changes', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
    setClientErrorTelemetryIdentity({ userId: 'old-user', instanceId: 'tenant-a' });
    const uninstall = installClientErrorTelemetry(window, fetcher as typeof fetch);
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('private') }));
    await Promise.resolve();
    setClientErrorTelemetryIdentity(
      { userId: 'new-user', instanceId: 'tenant-b' },
      fetcher as typeof fetch
    );
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
    uninstall();
  });
});
