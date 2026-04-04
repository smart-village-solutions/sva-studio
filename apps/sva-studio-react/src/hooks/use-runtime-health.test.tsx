import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRuntimeHealth } from './use-runtime-health';

const getRuntimeHealthMock = vi.fn();
const browserLoggerState = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../lib/iam-api', () => ({
  asIamError: (error: unknown) => error,
  getRuntimeHealth: (...args: Parameters<typeof getRuntimeHealthMock>) => getRuntimeHealthMock(...args),
}));

vi.mock('@sva/sdk/logging', () => ({
  createBrowserLogger: () => browserLoggerState,
}));

function RuntimeHealthProbe() {
  const { error, health, isLoading } = useRuntimeHealth();

  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="status">{health.status}</span>
      <span data-testid="database-status">{health.checks.services.database.status}</span>
      <span data-testid="request-id">{error?.requestId ?? 'none'}</span>
    </div>
  );
}

const flushRuntimeHealthUpdates = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useRuntimeHealth', () => {
  beforeEach(() => {
    getRuntimeHealthMock.mockReset();
    browserLoggerState.debug.mockReset();
    browserLoggerState.error.mockReset();
    browserLoggerState.info.mockReset();
    browserLoggerState.warn.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('loads runtime health immediately and updates the state', async () => {
    getRuntimeHealthMock.mockResolvedValue({
      checks: {
        authorizationCache: {
          coldStart: false,
          consecutiveRedisFailures: 0,
          recomputePerMinute: 0,
          status: 'ready',
        },
        db: true,
        diagnostics: {},
        errors: {},
        keycloak: true,
        redis: true,
        services: {
          authorizationCache: { status: 'ready' },
          database: { status: 'ready' },
          keycloak: { status: 'ready' },
          redis: { status: 'ready' },
        },
      },
      path: '/api/v1/iam/health/ready',
      status: 'ready',
      timestamp: '2026-04-04T12:00:00.000Z',
    });

    render(<RuntimeHealthProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('status').textContent).toBe('ready');
      expect(screen.getByTestId('database-status').textContent).toBe('ready');
    });
  });

  it('polls the runtime health endpoint and exposes fetch errors', async () => {
    vi.useFakeTimers();
    getRuntimeHealthMock
      .mockResolvedValueOnce({
        checks: {
          authorizationCache: {
            coldStart: false,
            consecutiveRedisFailures: 0,
            recomputePerMinute: 0,
            status: 'ready',
          },
          db: true,
          diagnostics: {},
          errors: {},
          keycloak: true,
          redis: true,
          services: {
            authorizationCache: { status: 'ready' },
            database: { status: 'ready' },
            keycloak: { status: 'ready' },
            redis: { status: 'ready' },
          },
        },
        path: '/api/v1/iam/health/ready',
        status: 'ready',
        timestamp: '2026-04-04T12:00:00.000Z',
      })
      .mockRejectedValueOnce({
        code: 'internal_error',
        message: 'down',
        requestId: 'req-health',
        status: 503,
      });

    render(<RuntimeHealthProbe />);

    await flushRuntimeHealthUpdates();

    expect(screen.getByTestId('loading').textContent).toBe('false');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    await flushRuntimeHealthUpdates();

    expect(screen.getByTestId('database-status').textContent).toBe('unknown');
    expect(screen.getByTestId('request-id').textContent).toBe('req-health');
  });
});
