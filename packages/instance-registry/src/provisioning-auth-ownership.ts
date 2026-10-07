import type { KeycloakReadState } from './provisioning-auth-types.js';
import {
  isSystemAdminRoleOwnedByInstance,
  readStudioOwnedClient,
  readStudioOwnedUser,
  isApprovedTenantAdminAdoption,
} from './provisioning-auth-policy.js';

export const readRealmOwnershipConflicts = (
  state: KeycloakReadState,
  instanceId: string,
  tenantAdminBootstrap?: import('./provisioning-auth-types.js').TenantAdminBootstrap
): string[] => {
  const conflicts: string[] = [];
  if (
    state.clientRepresentation &&
    readStudioOwnedClient(state.clientRepresentation, instanceId, 'login_client') !== 'owned'
  ) {
    conflicts.push('login_client');
  }
  if (
    state.tenantAdminClientRepresentation &&
    readStudioOwnedClient(
      state.tenantAdminClientRepresentation,
      instanceId,
      'tenant_admin_client'
    ) !== 'owned'
  ) {
    conflicts.push('tenant_admin_client');
  }
  for (const pluginClient of state.pluginOidcClients) {
    if (
      pluginClient.clientRepresentation &&
      readStudioOwnedClient(
        pluginClient.clientRepresentation,
        instanceId,
        `plugin_client:${pluginClient.requirement.pluginId}`
      ) !== 'owned'
    ) {
      conflicts.push(`plugin_client:${pluginClient.requirement.pluginId}`);
    }
  }
  if (
    state.systemAdminRole &&
    !isSystemAdminRoleOwnedByInstance(state.systemAdminRole, instanceId)
  ) {
    conflicts.push('system_admin_role');
  }
  if (
    state.tenantAdminRepresentation &&
    readStudioOwnedUser(state.tenantAdminRepresentation, instanceId, 'tenant_admin') !== 'owned' &&
    !isApprovedTenantAdminAdoption(state.tenantAdminRepresentation, tenantAdminBootstrap)
  ) {
    conflicts.push('tenant_admin');
  }
  return conflicts;
};
