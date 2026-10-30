/** Local lifecycle handler. The host injects status only, never provider secrets. */
import type { PluginJobExecutionHandler, PluginJobHandlerContext } from '@sva/plugin-sdk';
import { APP_TRANSLATIONS_LIFECYCLE_JOB, APP_TRANSLATIONS_CATALOG_JOB } from './descriptor.js';

export type AppTranslationsLocalRuntime = {
  readonly translateCatalog?: PluginJobExecutionHandler;
  readonly reconcileServiceBinding: (context: PluginJobHandlerContext) => Promise<boolean>;
  readonly readLocalReadiness: (
    instanceId: string
  ) => Promise<{
    readonly schemaReady: boolean;
    readonly providerConfigured: boolean;
    readonly serviceConfigured: boolean;
  }>;
};
export const createPluginJobExecutionHandlers = (
  runtime: AppTranslationsLocalRuntime
): Readonly<Record<string, PluginJobExecutionHandler>> => ({
  [APP_TRANSLATIONS_CATALOG_JOB]: async (context) => {
    if (!runtime.translateCatalog)
      throw Object.assign(new Error('catalog_unavailable'), {
        cause: { retry: { kind: 'terminal' } },
      });
    return runtime.translateCatalog(context);
  },
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
    const reconciled = ['provision', 'reconcile', 'reactivate'].includes(operation)
      ? await runtime.reconcileServiceBinding(context)
      : undefined;
    await context.throwIfCancellationRequested();
    const status = await runtime.readLocalReadiness(context.job.instanceId);
    const serviceConfigured = reconciled ?? status.serviceConfigured;
    await context.throwIfCancellationRequested();
    return {
      resultPayload: { plugin: { localOnly: true } },
      tenantLifecycle: {
        revision: `local-v2:${Number(status.schemaReady)}:${Number(status.providerConfigured)}:${Number(serviceConfigured)}`,
        checks: [
          { checkId: 'app-translations.schema', status: status.schemaReady ? 'ready' : 'blocked' },
          {
            checkId: 'app-translations.provider',
            status: status.providerConfigured ? 'ready' : 'degraded',
          },
          {
            checkId: 'app-translations.service',
            status: serviceConfigured ? 'ready' : 'degraded',
            ...(!serviceConfigured
              ? { messageKey: 'appTranslations.readiness.serviceMissing' }
              : {}),
          },
        ],
      },
    };
  },
});
