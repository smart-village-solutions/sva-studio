import type { RuntimeDependencyHealth, RuntimeDependencyKey, RuntimeHealthResponse } from '@sva/core';
import React from 'react';

import { asIamError, getRuntimeHealth, type IamHttpError } from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationAbort,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';

const runtimeHealthLogger = createOperationLogger('runtime-health-hook', 'debug');

const runtimeHealthServiceKeys: readonly RuntimeDependencyKey[] = ['database', 'redis', 'keycloak', 'authorizationCache'];

const createUnknownServices = (): RuntimeHealthResponse['checks']['services'] =>
  Object.fromEntries(
    runtimeHealthServiceKeys.map((serviceKey) => [
      serviceKey,
      {
        status: 'unknown',
      } satisfies RuntimeDependencyHealth,
    ])
  ) as RuntimeHealthResponse['checks']['services'];

export const createUnknownRuntimeHealth = (): RuntimeHealthResponse => ({
  checks: {
    authorizationCache: {
      coldStart: false,
      consecutiveRedisFailures: 0,
      recomputePerMinute: 0,
      status: 'empty',
    },
    auth: {},
    db: false,
    diagnostics: {},
    errors: {},
    keycloak: false,
    redis: false,
    services: createUnknownServices(),
  },
  path: '/api/v1/iam/health/ready',
  status: 'not_ready',
  timestamp: new Date(0).toISOString(),
});

type RuntimeHealthState = Readonly<{
  error: IamHttpError | null;
  health: RuntimeHealthResponse;
  isLoading: boolean;
}>;

export const useRuntimeHealth = () => {
  const abortControllersRef = React.useRef<Set<AbortController>>(new Set());
  const inFlightRef = React.useRef<Promise<void> | null>(null);
  const [state, setState] = React.useState<RuntimeHealthState>({
    error: null,
    health: createUnknownRuntimeHealth(),
    isLoading: true,
  });

  const refetch = React.useCallback(async () => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const controller = new AbortController();
    abortControllersRef.current.add(controller);
    const request = (async () => {
      logBrowserOperationStart(runtimeHealthLogger, 'studio_runtime_health_started', {
        operation: 'get_runtime_health',
      });

      setState((current) => ({
        ...current,
        isLoading: true,
      }));

      try {
        const health = await getRuntimeHealth({ signal: controller.signal });
        setState({
          error: null,
          health,
          isLoading: false,
        });
        logBrowserOperationSuccess(
          runtimeHealthLogger,
          'studio_runtime_health_succeeded',
          {
            operation: 'get_runtime_health',
            overall_status: health.status,
          },
          'debug'
        );
      } catch (error) {
        if (controller.signal.aborted) {
          logBrowserOperationAbort(runtimeHealthLogger, 'studio_runtime_health_aborted', {
            operation: 'get_runtime_health',
          });
          return;
        }

        const resolvedError = asIamError(error);
        setState((current) => ({
          error: resolvedError,
          health: {
            ...current.health,
            checks: {
              ...current.health.checks,
              services: createUnknownServices(),
            },
          },
          isLoading: false,
        }));
        logBrowserOperationFailure(runtimeHealthLogger, 'studio_runtime_health_failed', resolvedError, {
          operation: 'get_runtime_health',
        });
      } finally {
        abortControllersRef.current.delete(controller);
      }
    })();

    inFlightRef.current = request;

    try {
      await request;
    } finally {
      if (inFlightRef.current === request) {
        inFlightRef.current = null;
      }
    }
  }, []);

  React.useEffect(() => {
    void refetch();

    if (typeof document !== 'undefined') {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          void refetch();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        for (const controller of abortControllersRef.current) {
          controller.abort();
        }
        abortControllersRef.current.clear();
        inFlightRef.current = null;
      };
    }

    return () => {
      for (const controller of abortControllersRef.current) {
        controller.abort();
      }
      abortControllersRef.current.clear();
      inFlightRef.current = null;
    };
  }, [refetch]);

  return {
    error: state.error,
    health: state.health,
    isLoading: state.isLoading,
    refetch,
  };
};
