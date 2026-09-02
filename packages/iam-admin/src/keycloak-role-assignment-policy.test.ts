import { describe, expect, it } from 'vitest';

import { classifyTenantKeycloakRole } from './keycloak-role-assignment-policy.js';

describe('classifyTenantKeycloakRole', () => {
  it.each([
    ['offline_access', undefined, 'keycloak_builtin'],
    ['uma_authorization', undefined, 'keycloak_builtin'],
    ['default-roles-tenant', undefined, 'keycloak_builtin'],
    ['realm_account_admin', undefined, 'service_role'],
    ['instance_registry_admin', undefined, 'platform_role'],
    ['system_admin', undefined, 'system_admin'],
    ['client-role', true, 'client_role'],
  ] as const)('classifies protected role %s', (externalName, clientRole, category) => {
    expect(classifyTenantKeycloakRole({ externalName, clientRole })).toMatchObject({
      category,
      assignable: false,
    });
  });

  it.each(['mainserver_role_news_item', 'event_editor', 'future_application_role'])(
    'allows regular realm role %s without an application allowlist',
    (externalName) => {
      expect(classifyTenantKeycloakRole({ externalName })).toEqual({
        category: 'assignable',
        assignable: true,
      });
    }
  );
});
