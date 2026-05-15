import type { InstanceRegistryService } from '@sva/instance-registry/service-types';

import { assertRequired } from './parse-options.js';
import { deriveTenantAdminClientId } from './shared.js';
import type { CliOptions } from './shared.js';

const toRequestId = (idempotencyKey: string): string => `cli-${idempotencyKey}`;

export const runMutationCommand = async (service: InstanceRegistryService, options: CliOptions): Promise<unknown> => {
  switch (options.command) {
    case 'create':
      return service.createProvisioningRequest({
        actorId: options.actorId,
        authClientId: assertRequired(options.authClientId, '--auth-client-id'),
        authIssuerUrl: options.authIssuerUrl,
        authRealm: assertRequired(options.authRealm, '--auth-realm'),
        displayName: assertRequired(options.displayName, '--display-name'),
        featureFlags: options.featureFlags,
        idempotencyKey: options.idempotencyKey,
        instanceId: assertRequired(options.instanceId, '--instance-id'),
        mainserverConfigRef: options.mainserverConfigRef,
        parentDomain: assertRequired(options.parentDomain, '--parent-domain'),
        realmMode: options.realmMode,
        requestId: toRequestId(options.idempotencyKey),
        tenantAdminClient: {
          clientId: deriveTenantAdminClientId(
            assertRequired(options.authClientId, '--auth-client-id'),
            options.tenantAdminClientId
          ),
          ...(options.tenantAdminClientSecret ? { secret: options.tenantAdminClientSecret } : {}),
        },
        themeKey: options.themeKey,
      });
    case 'backfill-admin-client': {
      const instances = await service.listInstances({ status: 'active' });
      const updatedInstances = [];

      for (const instance of instances) {
        if (instance.tenantAdminClient?.clientId) {
          continue;
        }

        const updated = await service.updateInstance({
          actorId: options.actorId,
          instanceId: instance.instanceId,
          displayName: instance.displayName,
          parentDomain: instance.parentDomain,
          realmMode: instance.realmMode,
          authRealm: instance.authRealm,
          authClientId: instance.authClientId,
          authIssuerUrl: instance.authIssuerUrl,
          requestId: toRequestId(options.idempotencyKey),
          tenantAdminClient: {
            clientId: deriveTenantAdminClientId(instance.authClientId, options.tenantAdminClientId),
            ...(options.tenantAdminClientSecret ? { secret: options.tenantAdminClientSecret } : {}),
          },
          tenantAdminBootstrap: instance.tenantAdminBootstrap,
          themeKey: instance.themeKey,
          featureFlags: instance.featureFlags,
          mainserverConfigRef: instance.mainserverConfigRef,
        });

        if (!updated) {
          continue;
        }

        const provisioningRun = await service.executeKeycloakProvisioning({
          actorId: options.actorId,
          idempotencyKey: `${options.idempotencyKey}:${instance.instanceId}:provision-admin-client`,
          instanceId: instance.instanceId,
          intent: 'provision_admin_client',
          requestId: toRequestId(options.idempotencyKey),
        });

        updatedInstances.push({
          instanceId: instance.instanceId,
          tenantAdminClientId: deriveTenantAdminClientId(instance.authClientId, options.tenantAdminClientId),
          provisioningRunId: provisioningRun?.id,
        });
      }

      return updatedInstances;
    }
    case 'activate':
    case 'suspend':
    case 'archive':
      return service.changeStatus({
        actorId: options.actorId,
        idempotencyKey: options.idempotencyKey,
        instanceId: assertRequired(options.instanceId, '--instance-id'),
        nextStatus: options.command === 'activate' ? 'active' : options.command === 'suspend' ? 'suspended' : 'archived',
        requestId: toRequestId(options.idempotencyKey),
      });
    default:
      throw new Error(`Unerwarteter Mutation-Command: ${options.command}`);
  }
};
