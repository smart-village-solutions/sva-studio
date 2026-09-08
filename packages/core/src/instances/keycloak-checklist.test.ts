import { describe, expect, it } from 'vitest';

import {
  areAllInstanceKeycloakRequirementsSatisfied,
  INSTANCE_KEYCLOAK_REQUIREMENTS,
  isInstanceKeycloakRequirementSatisfied,
} from './keycloak-checklist';

describe('instance keycloak checklist', () => {
  it('covers the canonical requirement matrix without deprecated user attribute checks', () => {
    expect(INSTANCE_KEYCLOAK_REQUIREMENTS.map((requirement) => requirement.key)).toEqual([
      'realm',
      'client',
      'tenant_admin_client',
      'redirect_uris',
      'logout_uris',
      'web_origins',
      'plugin_oidc_clients',
      'tenant_secret',
      'tenant_admin_client_secret',
      'tenant_admin',
      'tenant_admin_system_admin',
    ]);
  });

  it('evaluates all requirements while preserving the login-readiness metadata', () => {
    const status = {
      realmExists: true,
      clientExists: true,
      tenantAdminClientExists: true,
      tenantAdminExists: true,
      tenantAdminHasSystemAdmin: true,
      redirectUrisMatch: true,
      logoutUrisMatch: true,
      webOriginsMatch: true,
      pluginOidcClientsAligned: true,
      clientSecretConfigured: true,
      tenantClientSecretReadable: true,
      clientSecretAligned: true,
      tenantAdminClientSecretConfigured: true,
      tenantAdminClientSecretReadable: true,
      tenantAdminClientSecretAligned: true,
      runtimeSecretSource: 'tenant',
    } as const;

    expect(areAllInstanceKeycloakRequirementsSatisfied(status)).toBe(true);
    expect(areAllInstanceKeycloakRequirementsSatisfied({ ...status, clientExists: false })).toBe(false);
    expect(areAllInstanceKeycloakRequirementsSatisfied({ ...status, pluginOidcClientsAligned: false })).toBe(false);
    expect(
      INSTANCE_KEYCLOAK_REQUIREMENTS.find((requirement) => requirement.key === 'plugin_oidc_clients')
    ).toMatchObject({ statusField: 'pluginOidcClientsAligned', blocksLoginReadiness: false });
    expect(
      isInstanceKeycloakRequirementSatisfied(
        { ...status, tenantAdminHasSystemAdmin: false },
        INSTANCE_KEYCLOAK_REQUIREMENTS.find((requirement) => requirement.key === 'tenant_admin_system_admin')!
      )
    ).toBe(false);
  });
});
