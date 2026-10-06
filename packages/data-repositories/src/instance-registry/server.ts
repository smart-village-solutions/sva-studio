import { type InstanceRegistryRecord, type ServerAccountInvitationTemplateState } from '@sva/core';
import { type WasteTenantProvisioningRecord } from '@sva/waste-management-contracts';

import { createInstanceRegistryRepository } from './index.js';
import { createWasteProvisioningRepository } from './repository-waste-provisioning.js';
import {
  closeInstanceRegistryPools,
  createExecutor,
  logger,
  readErrorType,
  withClient,
} from './server-client.js';
import { resetInstanceRegistryCache } from './server-host.js';

export {
  invalidateInstanceRegistryHost,
  loadInstanceByHostname,
  resetInstanceRegistryCache,
} from './server-host.js';

export const resetInstanceRegistryServerState = async (): Promise<void> => {
  resetInstanceRegistryCache();
  await closeInstanceRegistryPools();
};

export const loadInstanceById = async (
  instanceId: string,
  options: { readonly getDatabaseUrl?: () => string | undefined } = {}
): Promise<InstanceRegistryRecord | null> =>
  withClient(
    async (client) => {
      const repository = createInstanceRegistryRepository(createExecutor(client));
      return repository.getInstanceById(instanceId);
    },
    { getDatabaseUrl: options.getDatabaseUrl }
  );

export const loadServerAccountInvitationTemplate = async (
  options: { readonly getDatabaseUrl?: () => string | undefined } = {}
): Promise<ServerAccountInvitationTemplateState> =>
  withClient(
    async (client) => {
      const repository = createInstanceRegistryRepository(createExecutor(client));
      return repository.getServerAccountInvitationTemplate();
    },
    { getDatabaseUrl: options.getDatabaseUrl }
  );

export const loadInstanceAuthClientSecretCiphertext = async (
  instanceId: string,
  options: { readonly getDatabaseUrl?: () => string | undefined } = {}
): Promise<string | null> =>
  withClient(
    async (client) => {
      const repository = createInstanceRegistryRepository(createExecutor(client));
      return repository.getAuthClientSecretCiphertext(instanceId);
    },
    { getDatabaseUrl: options.getDatabaseUrl }
  );

export const loadTenantAdminClientSecretCiphertext = async (
  instanceId: string,
  options: { readonly getDatabaseUrl?: () => string | undefined } = {}
): Promise<string | null> =>
  withClient(
    async (client) => {
      const repository = createInstanceRegistryRepository(createExecutor(client));
      return repository.getTenantAdminClientSecretCiphertext(instanceId);
    },
    { getDatabaseUrl: options.getDatabaseUrl }
  );

type WasteProvisioningServerOptions = {
  readonly getDatabaseUrl?: () => string | undefined;
};

const withWasteProvisioningRepository = <T>(
  instanceId: string,
  options: WasteProvisioningServerOptions,
  work: (repository: ReturnType<typeof createWasteProvisioningRepository>) => Promise<T>
): Promise<T> =>
  withClient(
    async (client) => {
      await client.query('BEGIN');
      try {
        await client.query('SELECT set_config($1, $2, true);', ['app.instance_id', instanceId]);
        const result = await work(createWasteProvisioningRepository(createExecutor(client)));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          logger.warn('Waste provisioning transaction rollback failed', {
            operation: 'waste_provisioning_repository_transaction',
            error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
            error_type: readErrorType(rollbackError),
          });
        }
        throw error;
      }
    },
    { getDatabaseUrl: options.getDatabaseUrl }
  );

export const loadWasteTenantProvisioningRecord = (
  instanceId: string,
  options: WasteProvisioningServerOptions = {}
): Promise<WasteTenantProvisioningRecord | null> =>
  withWasteProvisioningRepository(instanceId, options, (repository) =>
    repository.getWasteProvisioning(instanceId)
  );

export const requestWasteTenantProvisioning = (
  instanceId: string,
  options: WasteProvisioningServerOptions = {}
): Promise<WasteTenantProvisioningRecord> =>
  withWasteProvisioningRepository(instanceId, options, (repository) =>
    repository.requestWasteProvisioning(instanceId)
  );

export const disableWasteTenantProvisioning = (
  instanceId: string,
  options: WasteProvisioningServerOptions = {}
): Promise<WasteTenantProvisioningRecord | null> =>
  withWasteProvisioningRepository(instanceId, options, (repository) =>
    repository.disableWasteProvisioning(instanceId)
  );

export const claimWasteTenantProvisioning = (
  input: {
    readonly instanceId: string;
    readonly jobId: string;
    readonly desiredGeneration: number;
  },
  options: WasteProvisioningServerOptions = {}
): Promise<WasteTenantProvisioningRecord | null> =>
  withWasteProvisioningRepository(input.instanceId, options, (repository) =>
    repository.claimWasteProvisioning(input)
  );

export const completeWasteTenantProvisioning = (
  input: {
    readonly instanceId: string;
    readonly jobId: string;
    readonly desiredGeneration: number;
    readonly databaseName: string;
    readonly interfaceId: string;
  },
  options: WasteProvisioningServerOptions = {}
): Promise<WasteTenantProvisioningRecord | null> =>
  withWasteProvisioningRepository(input.instanceId, options, (repository) =>
    repository.completeWasteProvisioning(input)
  );

export const failWasteTenantProvisioning = (
  input: {
    readonly instanceId: string;
    readonly jobId: string;
    readonly desiredGeneration: number;
    readonly errorCode: string;
    readonly errorMessage: string;
  },
  options: WasteProvisioningServerOptions = {}
): Promise<WasteTenantProvisioningRecord | null> =>
  withWasteProvisioningRepository(input.instanceId, options, (repository) =>
    repository.failWasteProvisioning(input)
  );

export const failWasteTenantProvisioningRequest = (
  input: {
    readonly instanceId: string;
    readonly desiredGeneration: number;
    readonly errorCode: string;
    readonly errorMessage: string;
  },
  options: WasteProvisioningServerOptions = {}
): Promise<WasteTenantProvisioningRecord | null> =>
  withWasteProvisioningRepository(input.instanceId, options, (repository) =>
    repository.failWasteProvisioningRequest(input)
  );
