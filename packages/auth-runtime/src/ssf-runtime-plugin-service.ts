import { emitAuthAuditEvent } from './audit-events.js';
import { withRegistryRepository } from './iam-instance-registry/repository.js';
import type { PluginServerHandlerDispatcherDependencies } from './plugin-server-handlers/dispatcher.js';
import { readConfiguredPluginTenantAccess } from './plugin-tenant-lifecycle/access.js';
import { createSsfRuntimeBindServiceTenant } from './ssf-runtime-plugin-service-access.js';
import { createSsfRuntimeAuthenticateService } from './ssf-runtime-plugin-service-authentication.js';
import {
  type SsfRuntimePluginServiceDependencies,
  resolveSsfTenantReadinessReason,
} from './ssf-runtime-plugin-service-contract.js';
import {
  createSsfRuntimeAuditDenial,
  observeSsfRuntimeServiceResponse,
} from './ssf-runtime-plugin-service-observability.js';
import { authenticateSsfRuntimeServiceToken } from './ssf-runtime-service-token.js';

export { resolveSsfTenantReadinessReason };

export const createSsfRuntimePluginServiceAccess = (
  dependencies: SsfRuntimePluginServiceDependencies = {}
): Pick<
  PluginServerHandlerDispatcherDependencies,
  'authenticateService' | 'bindServiceTenant' | 'observeServiceResponse'
> => {
  const authenticateToken = dependencies.authenticateToken ?? authenticateSsfRuntimeServiceToken;
  const readInstance =
    dependencies.readInstance ??
    ((instanceId: string) =>
      withRegistryRepository((repository) => repository.getInstanceById(instanceId)));
  const auditDenial = createSsfRuntimeAuditDenial(
    dependencies.emitSecurityAudit ?? emitAuthAuditEvent
  );

  return {
    authenticateService: createSsfRuntimeAuthenticateService({ authenticateToken, auditDenial }),
    bindServiceTenant: createSsfRuntimeBindServiceTenant({
      auditDenial,
      dependencies: {
        readInstance,
        readPluginAccess: dependencies.readPluginAccess ?? readConfiguredPluginTenantAccess,
        readDatabaseReadiness: dependencies.readDatabaseReadiness ?? (async () => false),
        readAuthorizationRevision: dependencies.readAuthorizationRevision ?? (async () => null),
        readTimeZone: dependencies.readTimeZone ?? (async () => null),
      },
    }),
    observeServiceResponse: observeSsfRuntimeServiceResponse,
  };
};
