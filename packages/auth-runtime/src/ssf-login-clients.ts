import { createSdkLogger } from '@sva/server-runtime';
import { loadInstanceById } from '@sva/data-repositories/server';
import {
  readPluginOidcClientAlignment,
  readPluginOidcClientRequirements,
  reconcilePluginOidcClients,
} from '@sva/instance-registry/provisioning-auth-state';

import { readInstanceRegistryPluginOidcClientRequirements } from './iam-instance-registry/plugin-activation-policy-snapshot.js';
import { resolveInstanceKeycloakProjectionTenant } from './ssf-authorization-projection-tenant.js';

const logger = createSdkLogger({ component: 'ssf-login-clients', level: 'info' });

const resolveLoginContract = async (instanceId: string, authRealm?: string) => {
  const instance = await loadInstanceById(instanceId);
  if (!instance || instance.status === 'suspended' || instance.status === 'archived') return null;
  const requirements = readInstanceRegistryPluginOidcClientRequirements().filter(
    ({ pluginId }) => pluginId === 'ssf'
  );
  const browser = requirements.find((requirement) => requirement.contractVersion === '2.0');
  if (!browser || !requirements.some((requirement) => requirement.contractVersion === '1.0'))
    return null;
  const input = {
    instanceId,
    authClientId: instance.authClientId,
    tenantAdminClient: instance.tenantAdminClient,
    pluginOidcClients: requirements,
  };
  readPluginOidcClientRequirements(input);
  const tenant = await resolveInstanceKeycloakProjectionTenant(
    instanceId,
    browser.clientId,
    authRealm ?? instance.authRealm
  );
  return tenant ? { tenant, input, instance } : null;
};

/** Only validated installation declarations enter the existing Core provisioning adapter. */
export const prepareInstanceSsfLoginClients = async (
  instanceId: string,
  authRealm?: string
): Promise<void> => {
  const contract = await resolveLoginContract(instanceId, authRealm);
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
  const client = contract.tenant.client;
  const clientId = contract.input.authClientId;
  const audience = process.env.SVA_STUDIO_SSF_GATEWAY_AUDIENCE?.trim() || contract.tenant.clientId;
  try {
    await client.ensureSsfRecordingExchange(clientId, instanceId);
    await client.ensureSsfExchangeAssuranceMapper(clientId, audience);
    await client.ensureAudienceProtocolMapper({
      clientId,
      name: 'studio-ssf-recording-audience',
      audience,
    });
    for (const claimName of ['studio_tenant_id', 'ssf_permissions']) {
      await client.ensureUserAttributeProtocolMapper({
        clientId,
        name: 'studio-' + claimName.replaceAll('_', '-'),
        userAttribute: claimName,
        claimName,
        multivalued: claimName === 'ssf_permissions',
        exclusiveClaim: true,
      });
    }
  } catch {
    // Recording management verifies the signed exchange independently. A missing mapper
    // must not suspend ordinary SSF conversations during coordinated provider rollout.
    logger.warn('ssf_recording_exchange_provisioning_unavailable', {
      operation: 'prepare_recording_exchange',
      instance_id: instanceId,
    });
  }
};

const readInstanceSsfLoginClientsReadyForStatuses = async (
  instanceId: string,
  authRealm: string | undefined,
  allowedStatuses: ReadonlySet<string>
): Promise<boolean> => {
  const contract = await resolveLoginContract(instanceId, authRealm);
  if (!contract || !allowedStatuses.has(contract.instance.status)) return false;
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

export const readInstanceSsfLoginClientsReady = async (
  instanceId: string,
  authRealm?: string
): Promise<boolean> =>
  readInstanceSsfLoginClientsReadyForStatuses(instanceId, authRealm, new Set(['active']));

export const readInstanceSsfProvisioningLoginClientsReady = async (
  instanceId: string,
  authRealm?: string
): Promise<boolean> =>
  readInstanceSsfLoginClientsReadyForStatuses(
    instanceId,
    authRealm,
    new Set(['provisioning', 'active'])
  );
