import { wasteTenantProvisioningContract } from '@sva/core';
import {
  loadExternalInterfaceRecordByAlias,
  loadWasteTenantProvisioningRecord,
} from '@sva/data-repositories/server';
import type { PluginTenantLifecycleExecutionResult } from '@sva/plugin-sdk';
import { wasteManagementTenantLifecycleContract } from '@sva/waste-management-contracts';

import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

export const createReadWasteTenantDatabaseReadinessOperation =
  (deps: Pick<WasteOperationRuntimeDeps, 'loadManagedInterface' | 'loadProvisioning'> = {}) =>
  async (instanceId: string): Promise<PluginTenantLifecycleExecutionResult> => {
    const [provisioning, managedInterface] = await Promise.all([
      (deps.loadProvisioning ?? loadWasteTenantProvisioningRecord)(instanceId),
      (deps.loadManagedInterface ?? loadExternalInterfaceRecordByAlias)(
        instanceId,
        'postgresql',
        wasteTenantProvisioningContract.interfaceAlias
      ),
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
      ],
    };
  };
