import { loadInstanceById } from '@sva/data-repositories/server';
import {
  readPluginOidcClientAlignment,
  readPluginOidcClientRequirements,
  reconcilePluginOidcClients,
} from '@sva/instance-registry/provisioning-auth-state';

import { readInstanceRegistryPluginOidcClientRequirements } from './iam-instance-registry/plugin-activation-policy-snapshot.js';
import { resolveInstanceKeycloakProjectionTenant } from './ssf-authorization-projection-tenant.js';

const resolveLoginContract = async (instanceId: string) => {
  const instance = await loadInstanceById(instanceId);
  if (!instance || instance.status === 'suspended' || instance.status === 'archived') return null;
  const requirements = readInstanceRegistryPluginOidcClientRequirements().filter(
    ({ pluginId }) => pluginId === 'ssf'
  );
  const browser = requirements.find((requirement) => requirement.contractVersion === '2.0');
  if (!browser || !requirements.some((requirement) => requirement.contractVersion === '1.0'))
    return null;
  const input = {
    authClientId: instance.authClientId,
    tenantAdminClient: instance.tenantAdminClient,
    pluginOidcClients: requirements,
  };
  readPluginOidcClientRequirements(input);
  const tenant = await resolveInstanceKeycloakProjectionTenant(instanceId, browser.clientId);
  return tenant ? { tenant, input, instance } : null;
};

/** Only validated installation declarations enter the existing Core provisioning adapter. */
export const prepareInstanceSsfLoginClients = async (instanceId: string): Promise<void> => {
  const contract = await resolveLoginContract(instanceId);
  if (!contract) throw new Error('ssf_login_contract_unavailable');
  // Reconcile the browser client first, then normalize the resource client.
  // This also migrates legacy resource clients that token issuance left enabled.
  const pluginOidcClients = [
    ...contract.input.pluginOidcClients.filter(({ contractVersion }) => contractVersion === '2.0'),
    ...contract.input.pluginOidcClients.filter(({ contractVersion }) => contractVersion === '1.0'),
  ];
  await reconcilePluginOidcClients(contract.tenant.client, {
    ...contract.input,
    pluginOidcClients,
  });
};

export const readInstanceSsfLoginClientsReady = async (instanceId: string): Promise<boolean> => {
  const contract = await resolveLoginContract(instanceId);
  if (!contract || contract.instance.status !== 'active') return false;
  for (const requirement of contract.input.pluginOidcClients) {
    const clientRepresentation = await contract.tenant.client.getOidcClientByClientId(
      requirement.clientId
    );
    if (!clientRepresentation) return false;
    const protocolMappers = await contract.tenant.client.listClientProtocolMappers(
      requirement.clientId
    );
    if (
      !readPluginOidcClientAlignment(requirement, { clientRepresentation, protocolMappers })
        .aligned ||
      (requirement.contractVersion === '2.0' && clientRepresentation.enabled !== true)
    )
      return false;
  }
  return true;
};
