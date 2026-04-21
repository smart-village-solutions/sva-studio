import { describe, expect, it } from 'vitest';

import {
  areAllInstanceKeycloakRequirementsSatisfied,
  INSTANCE_KEYCLOAK_REQUIREMENTS,
  isInstanceKeycloakRequirementSatisfied,
} from './keycloak-checklist';

describe('instance keycloak checklist', () => {
  it('covers the canonical requirement matrix including tenant admin instance binding', () => {
    expect(INSTANCE_KEYCLOAK_REQUIREMENTS.map((requirement) => requirement.key)).toEqual([
      'realm',
      'client',
      'tenant_admin_client',
      'redirect_uris',
      'logout_uris',
      'web_origins',
      'instance_id_mapper',
      'tenant_secret',
      'tenant_admin_client_secret',
      'tenant_admin',
      'tenant_admin_system_admin',
      'tenant_admin_lacks_instance_registry_admin',
      'tenant_admin_instance_id',
    ]);
  });

  it('evaluates login-blocking requirements against the shared status contract', () => {
    const status = {
      realmExists: true,
      clientExists: true,
      tenantAdminClientExists: true,
      instanceIdMapperExists: true,
      tenantAdminExists: true,
      tenantAdminHasSystemAdmin: true,
      tenantAdminHasInstanceRegistryAdmin: false,
      tenantAdminInstanceIdMatches: true,
      redirectUrisMatch: true,
      logoutUrisMatch: true,
      webOriginsMatch: true,
      clientSecretConfigured: true,
      tenantClientSecretReadable: true,
      clientSecretAligned: true,
      tenantAdminClientSecretConfigured: true,
      tenantAdminClientSecretReadable: true,
      tenantAdminClientSecretAligned: true,
      runtimeSecretSource: 'tenant',
    } as const;

    expect(areAllInstanceKeycloakRequirementsSatisfied(status)).toBe(true);
    expect(
      isInstanceKeycloakRequirementSatisfied(
        { ...status, tenantAdminInstanceIdMatches: false },
        INSTANCE_KEYCLOAK_REQUIREMENTS.find((requirement) => requirement.key === 'tenant_admin_instance_id')!
      )
    ).toBe(false);
    expect(
      areAllInstanceKeycloakRequirementsSatisfied({
        ...status,
        instanceIdMapperExists: false,
        tenantAdminInstanceIdMatches: false,
      })
    ).toBe(true);
    expect(areAllInstanceKeycloakRequirementsSatisfied({ ...status, clientExists: false })).toBe(false);
  });
});
