import { describe, expect, it } from 'vitest';

import {
  buildLocalInstanceRegistryReconciliationInput,
  buildLocalInstanceRegistryReconciliationSql,
} from './local-instance-registry';

describe('buildLocalInstanceRegistryReconciliationInput', () => {
  it('returns null when required tenant host context is missing', () => {
    expect(buildLocalInstanceRegistryReconciliationInput({})).toBeNull();
    expect(buildLocalInstanceRegistryReconciliationInput({ SVA_PARENT_DOMAIN: 'studio.localhost' })).toBeNull();
  });

  it('normalizes local tenant reconciliation input from env', () => {
    expect(
      buildLocalInstanceRegistryReconciliationInput({
        SVA_ALLOWED_INSTANCE_IDS: ' de-musterhausen , hb-meinquartier ',
        SVA_LOCAL_TENANT_AUTH_CLIENT_ID: 'sva-studio',
        SVA_LOCAL_TENANT_AUTH_REALM_MODE: 'instance-id',
        SVA_PARENT_DOMAIN: 'Studio.Localhost',
      })
    ).toEqual({
      allowedInstanceIds: ['de-musterhausen', 'hb-meinquartier'],
      parentDomain: 'studio.localhost',
      tenantAuthClientId: 'sva-studio',
      tenantAdminClientId: 'sva-studio-admin',
      tenantAuthRealmMode: 'instance-id',
    });
  });
});

describe('buildLocalInstanceRegistryReconciliationSql', () => {
  it('rewrites local instance hostnames and tenant realms without touching server profiles', () => {
    const sql = buildLocalInstanceRegistryReconciliationSql({
      allowedInstanceIds: ['de-musterhausen'],
      parentDomain: 'studio.localhost',
      tenantAuthClientId: 'sva-studio',
      tenantAdminClientId: 'sva-studio-admin',
      tenantAuthRealmMode: 'instance-id',
    });

    expect(sql).toContain("parent_domain = 'studio.localhost'");
    expect(sql).toContain("primary_hostname = 'de-musterhausen.studio.localhost'");
    expect(sql).toContain("auth_realm = 'de-musterhausen'");
    expect(sql).toContain("tenant_admin_client_id = COALESCE(NULLIF(tenant_admin_client_id, ''), 'sva-studio-admin')");
    expect(sql).toContain("VALUES ('de-musterhausen.studio.localhost', 'de-musterhausen', true, 'runtime-env-local')");
  });

  it('can keep the existing tenant realm when requested', () => {
    const sql = buildLocalInstanceRegistryReconciliationSql({
      allowedInstanceIds: ['de-musterhausen'],
      parentDomain: 'studio.localhost',
      tenantAuthClientId: 'sva-studio',
      tenantAdminClientId: 'sva-studio-admin',
      tenantAuthRealmMode: 'keep',
    });

    expect(sql).not.toContain('auth_realm =');
  });
});
