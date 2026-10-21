/** Local lifecycle handler. The host injects status only, never provider secrets. */
import type { PluginJobExecutionHandler } from '@sva/plugin-sdk';
import { APP_TRANSLATIONS_LIFECYCLE_JOB } from './descriptor.js';

export type AppTranslationsLocalRuntime = {
  readonly readLocalReadiness: (
    instanceId: string
  ) => Promise<{ readonly schemaReady: boolean; readonly providerConfigured: boolean }>;
};
export const createPluginJobExecutionHandlers = (
  runtime: AppTranslationsLocalRuntime
): Readonly<Record<string, PluginJobExecutionHandler>> => ({
  [APP_TRANSLATIONS_LIFECYCLE_JOB]: async (context) => {
    const operation = context.tenantLifecycle?.operation;
    if (
      !context.job.instanceId ||
      !operation ||
      !['provision', 'reconcile', 'readiness', 'suspend', 'reactivate'].includes(operation)
    ) {
      throw Object.assign(new Error('app_translations_invalid_lifecycle_context'), {
        cause: {
          code: 'app-translations.invalid-lifecycle-context',
          messageKey: 'appTranslations.readiness.invalidContext',
          retry: { kind: 'terminal' },
        },
      });
    }
    await context.throwIfCancellationRequested();
    const status = await runtime.readLocalReadiness(context.job.instanceId);
    await context.throwIfCancellationRequested();
    return {
      resultPayload: { plugin: { localOnly: true } },
      tenantLifecycle: {
        revision: `local-v1:${Number(status.schemaReady)}:${Number(status.providerConfigured)}`,
        checks: [
          { checkId: 'app-translations.schema', status: status.schemaReady ? 'ready' : 'blocked' },
          {
            checkId: 'app-translations.provider',
            status: status.providerConfigured ? 'ready' : 'degraded',
          },
        ],
      },
    };
  },
});
