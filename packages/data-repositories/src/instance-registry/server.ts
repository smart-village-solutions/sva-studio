import { type InstanceRegistryRecord, type ServerAccountInvitationTemplateState } from '@sva/core';

import { createInstanceRegistryRepository } from './index.js';
import {
  closeInstanceRegistryPools,
  createExecutor,
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
