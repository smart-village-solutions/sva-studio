import type { PluginJobExecutionHandler } from '@sva/plugin-sdk';

import type { SsfAuthorizationProjectionRuntime } from './authorization-projection-runtime.js';
import { SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID, ssfPlugin } from './plugin.js';

export { ssfPlugin };

const lifecycleError = (message: string, cause: Readonly<Record<string, unknown>>): Error =>
  Object.assign(new Error(message), { cause });

export const createPluginJobExecutionHandlers = (
  runtime: SsfAuthorizationProjectionRuntime
): Readonly<Record<string, PluginJobExecutionHandler>> => ({
  [SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID]: async (context) => {
    if (context.tenantLifecycle?.operation === 'readiness') {
      await context.throwIfCancellationRequested();
      let revision: Awaited<ReturnType<SsfAuthorizationProjectionRuntime['readiness']>>;
      try {
        revision = await runtime.readiness(context.job.instanceId);
      } catch (error) {
        throw lifecycleError('ssf_authorization_readiness_unavailable', {
          code: 'ssf.authorization-readiness-unavailable',
          messageKey: 'ssf.errors.authorizationReconcileUnavailable',
          retry: { kind: 'retryable' },
          details: {
            errorType: error instanceof Error ? error.name : typeof error,
          },
        });
      }
      await context.throwIfCancellationRequested();
      return {
        resultPayload: { plugin: { operation: 'readiness' } },
        tenantLifecycle: {
          revision: revision ?? 'ssf:not-ready',
          checks: [{ checkId: 'ssf.loginReady', status: revision ? 'ready' : 'blocked' }],
        },
      };
    }
    if (
      context.tenantLifecycle?.operation !== 'provision' &&
      context.tenantLifecycle?.operation !== 'reconcile'
    ) {
      throw lifecycleError('invalid_ssf_authorization_reconcile_context', {
        code: 'ssf.invalid-authorization-reconcile-context',
        messageKey: 'ssf.errors.invalidAuthorizationReconcileContext',
        retry: { kind: 'terminal' },
      });
    }

    await context.throwIfCancellationRequested();
    let result: Awaited<ReturnType<SsfAuthorizationProjectionRuntime['reconcile']>>;
    try {
      result = await runtime.reconcile(context.job.instanceId);
    } catch (error) {
      throw lifecycleError('ssf_authorization_reconcile_unavailable', {
        code: 'ssf.authorization-reconcile-unavailable',
        messageKey: 'ssf.errors.authorizationReconcileUnavailable',
        retry: { kind: 'retryable' },
        details: {
          errorType: error instanceof Error ? error.name : typeof error,
        },
      });
    }
    if (result.status !== 'ready') {
      throw lifecycleError(`ssf_authorization_reconcile_${result.status}`, {
        code: 'ssf.authorization-reconcile-unavailable',
        messageKey: 'ssf.errors.authorizationReconcileUnavailable',
        retry: { kind: 'retryable' },
        details: {
          status: result.status,
          generation: result.generation,
          ...(result.status === 'blocked' ? { reason: result.reason } : {}),
        },
      });
    }
    await context.throwIfCancellationRequested();

    return {
      resultPayload: {
        plugin: {
          operation: 'reconcile-authorization',
          changed: result.changed,
          generation: result.generation,
        },
      },
      tenantLifecycle: {
        revision: result.authorizationRevision,
        checks: [{ checkId: 'ssf.loginReady', status: 'ready' }],
      },
    };
  },
});
