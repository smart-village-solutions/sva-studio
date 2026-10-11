import { wasteTenantProvisioningContract } from '@sva/waste-management-contracts';
import type { PluginTenantLifecycleExecutionResult } from '@sva/plugin-sdk';
import { wasteManagementTenantLifecycleContract } from '@sva/waste-management-contracts';

import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

export const createReadWasteTenantDatabaseReadinessOperation =
  (
    deps: Pick<
      WasteOperationRuntimeDeps,
      'loadManagedInterface' | 'loadProvisioning' | 'checkSchema'
    > = {}
  ) =>
  async (instanceId: string): Promise<PluginTenantLifecycleExecutionResult> => {
    if (!deps.loadProvisioning || !deps.loadManagedInterface || !deps.checkSchema) {
      throw new Error('waste_readiness_host_capability_unavailable');
    }
    const [provisioning, managedInterface, schemaReady] = await Promise.all([
      deps.loadProvisioning(instanceId),
      deps.loadManagedInterface(
        instanceId,
        'postgresql',
        wasteTenantProvisioningContract.interfaceAlias
      ),
      deps.checkSchema(instanceId),
    ]);
    const provisioningReady = Boolean(
      provisioning &&
      provisioning.status === 'ready' &&
      provisioning.desiredGeneration > 0 &&
      provisioning.completedGeneration === provisioning.desiredGeneration &&
      provisioning.databaseName &&
      provisioning.interfaceId
    );
    const managedInterfaceReady = Boolean(
      managedInterface &&
      managedInterface.id === provisioning?.interfaceId &&
      managedInterface.ownerKind === 'plugin' &&
      managedInterface.ownerId === wasteTenantProvisioningContract.interfaceOwnerId &&
      managedInterface.enabled &&
      managedInterface.visibleStatus === 'ok' &&
      managedInterface.lastCheckStatus === 'succeeded'
    );

    return {
      revision: wasteManagementTenantLifecycleContract.revision,
      checks: [
        {
          checkId: wasteManagementTenantLifecycleContract.readinessCheckIds.provisioning,
          status: provisioningReady ? 'ready' : 'blocked',
          ...(provisioningReady
            ? {}
            : { messageKey: 'wasteManagement.readiness.provisioningBlocked' }),
        },
        {
          checkId: wasteManagementTenantLifecycleContract.readinessCheckIds.managedInterface,
          status: managedInterfaceReady ? 'ready' : 'blocked',
          ...(managedInterfaceReady
            ? {}
            : { messageKey: 'wasteManagement.readiness.managedInterfaceBlocked' }),
        },
        {
          checkId: wasteManagementTenantLifecycleContract.readinessCheckIds.iamSchema,
          status: schemaReady ? 'ready' : 'blocked',
          ...(schemaReady ? {} : { messageKey: 'wasteManagement.readiness.iamSchemaBlocked' }),
        },
      ],
    };
  };
