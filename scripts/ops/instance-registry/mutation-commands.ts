import type { InstanceRegistryService } from '@sva/instance-registry/service-types';

import { assertRequired } from './parse-options.js';
import { deriveTenantAdminClientId } from './shared.js';
import type { CliOptions } from './shared.js';

const toRequestId = (idempotencyKey: string): string => `cli-${idempotencyKey}`;

type WithInstanceTransaction = <T>(
  instanceId: string,
  work: (service: InstanceRegistryService) => Promise<T>
) => Promise<T>;

export const runBackfillAdminClientCommand = async (
  readService: InstanceRegistryService,
  withInstanceTransaction: WithInstanceTransaction,
  options: CliOptions
): Promise<unknown> => {
  const instances = await readService.listInstances({ status: 'active' });
  const updatedInstances = [];

  for (const instance of instances) {
    if (instance.tenantAdminClient?.clientId) {
      continue;
    }

    const result = await withInstanceTransaction(instance.instanceId, async (service) => {
      const current = await service.getInstanceDetail(instance.instanceId);
      if (!current || current.status !== 'active' || current.tenantAdminClient?.clientId) {
        return null;
      }
      const updated = await service.updateInstance({
        actorId: options.actorId,
        instanceId: current.instanceId,
        displayName: current.displayName,
        parentDomain: current.parentDomain,
        realmMode: current.realmMode,
        authRealm: current.authRealm,
        authClientId: current.authClientId,
        authIssuerUrl: current.authIssuerUrl,
        requestId: toRequestId(options.idempotencyKey),
        tenantAdminClient: {
          clientId: deriveTenantAdminClientId(current.authClientId, options.tenantAdminClientId),
          ...(options.tenantAdminClientSecret ? { secret: options.tenantAdminClientSecret } : {}),
        },
        tenantAdminBootstrap: current.tenantAdminBootstrap,
        themeKey: current.themeKey,
        featureFlags: current.featureFlags,
        mainserverConfigRef: current.mainserverConfigRef,
      });

      if (!updated) {
        return null;
      }

      const provisioningRun = await service.executeKeycloakProvisioning({
        actorId: options.actorId,
        idempotencyKey: `${options.idempotencyKey}:${instance.instanceId}:provision-admin-client`,
        instanceId: instance.instanceId,
        intent: 'provision_admin_client',
        requestId: toRequestId(options.idempotencyKey),
      });

      return {
        instanceId: instance.instanceId,
        tenantAdminClientId: deriveTenantAdminClientId(current.authClientId, options.tenantAdminClientId),
        provisioningRunId: provisioningRun?.id,
      };
    });

    if (result) {
      updatedInstances.push(result);
    }
  }

  return updatedInstances;
};

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
