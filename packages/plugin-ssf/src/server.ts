import type { PluginJobExecutionHandler } from '@sva/plugin-sdk';

import type { SsfAuthorizationProjectionRuntime } from './authorization-projection-runtime.js';
import { SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID, ssfPlugin } from './plugin.js';

export { ssfPlugin };

export const createPluginJobExecutionHandlers = (
  runtime: SsfAuthorizationProjectionRuntime
): Readonly<Record<string, PluginJobExecutionHandler>> => ({
  [SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID]: async (context) => {
    if (
      context.tenantLifecycle?.operation !== 'provision' &&
      context.tenantLifecycle?.operation !== 'reconcile'
    ) {
      throw new Error('invalid_ssf_authorization_reconcile_context');
    }

    await context.throwIfCancellationRequested();
    const result = await runtime.reconcile(context.job.instanceId);
    if (result.status !== 'ready') {
      throw Object.assign(new Error(`ssf_authorization_reconcile_${result.status}`), {
        cause: {
          code: 'ssf.authorization-reconcile-unavailable',
          messageKey: 'ssf.errors.authorizationReconcileUnavailable',
          retry: { kind: 'retryable' },
          details: { status: result.status, generation: result.generation },
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
        checks: [],
      },
    };
  },
});
