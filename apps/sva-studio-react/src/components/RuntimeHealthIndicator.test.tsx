import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RuntimeHealthIndicator } from './RuntimeHealthIndicator';

const useRuntimeHealthMock = vi.fn();

vi.mock('../hooks/use-runtime-health', () => ({
  useRuntimeHealth: () => useRuntimeHealthMock(),
}));

vi.mock('../i18n', () => ({
  getActiveLocale: () => 'en',
  t: (key: string, params?: Record<string, string>) => {
    if (params?.timestamp) {
      return `${key}:${params.timestamp}`;
    }
    if (params?.requestId) {
      return `${key}:${params.requestId}`;
    }
    return key;
  },
}));

describe('RuntimeHealthIndicator', () => {
  const dateTimeFormatSpy = vi.spyOn(Intl, 'DateTimeFormat');

  beforeEach(() => {
    dateTimeFormatSpy.mockImplementation(
      (function mockDateTimeFormat(locale: string | string[] | undefined) {
        return {
          format: () => `formatted:${Array.isArray(locale) ? locale.join(',') : locale ?? 'default'}`,
        } as Intl.DateTimeFormat;
      }) as typeof Intl.DateTimeFormat
    );
    useRuntimeHealthMock.mockReturnValue({
      error: null,
      health: {
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
            keycloak: { status: 'not_ready', reasonCode: 'keycloak_dependency_failed' },
            redis: { status: 'degraded', reasonCode: 'redis_ping_failed' },
          },
        },
        path: '/api/v1/iam/health/ready',
        status: 'degraded',
        timestamp: '2026-04-04T12:34:00.000Z',
      },
      isLoading: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    dateTimeFormatSpy.mockReset();
    useRuntimeHealthMock.mockReset();
  });

  it('renders the per-service runtime status', () => {
    render(<RuntimeHealthIndicator />);

    expect(screen.getByTestId('runtime-health-indicator')).toBeTruthy();
    expect(screen.getByText('shell.runtimeHealth.services.database')).toBeTruthy();
    expect(screen.getByText('shell.runtimeHealth.services.redis')).toBeTruthy();
    expect(screen.getByText('shell.runtimeHealth.services.keycloak')).toBeTruthy();
    expect(screen.getByText('shell.runtimeHealth.services.authorizationCache')).toBeTruthy();
    expect(screen.getByText('shell.runtimeHealth.reasons.keycloakDependencyFailed')).toBeTruthy();
    expect(screen.getByText('shell.runtimeHealth.reasons.redisPingFailed')).toBeTruthy();
    expect(screen.getByText('shell.runtimeHealth.overall.degraded')).toBeTruthy();
    expect(screen.getByText('shell.runtimeHealth.lastUpdated:formatted:en')).toBeTruthy();
  });

  it('renders loading and fetch error hints', () => {
    useRuntimeHealthMock.mockReturnValue({
      error: {
        requestId: 'req-runtime-health',
      },
      health: {
        checks: {
          authorizationCache: {
            coldStart: false,
            consecutiveRedisFailures: 0,
            recomputePerMinute: 0,
            status: 'empty',
          },
          db: false,
          diagnostics: {},
          errors: {},
          keycloak: false,
          redis: false,
          services: {
            authorizationCache: { status: 'unknown' },
            database: { status: 'unknown' },
            keycloak: { status: 'unknown' },
            redis: { status: 'unknown' },
          },
        },
        path: '/api/v1/iam/health/ready',
        status: 'not_ready',
        timestamp: new Date(0).toISOString(),
      },
      isLoading: true,
      refetch: vi.fn(),
    });

    render(<RuntimeHealthIndicator />);

    expect(screen.getByText('shell.runtimeHealth.overall.unknown')).toBeTruthy();
    expect(screen.getAllByText('shell.runtimeHealth.reasons.unknown')).toHaveLength(4);
    expect(screen.getByText('shell.runtimeHealth.loading')).toBeTruthy();
    expect(screen.getByText('shell.runtimeHealth.fetchError:req-runtime-health')).toBeTruthy();
  });
});
