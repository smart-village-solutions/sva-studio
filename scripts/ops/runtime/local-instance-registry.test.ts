import { describe, expect, it } from 'vitest';

import {
  buildLocalInstanceRegistryReconciliationInput,
  buildLocalInstanceRegistryReconciliationSql,
  evaluateLocalInstanceRegistryIdentityDrift,
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
        SVA_LOCAL_TENANT_AUTH_CLIENT_ID: 'sva-studio-login',
        SVA_LOCAL_TENANT_AUTH_REALM_MODE: 'instance-id',
        SVA_PARENT_DOMAIN: 'Studio.Localhost',
      })
    ).toEqual({
      allowedInstanceIds: ['de-musterhausen', 'hb-meinquartier'],
      driftMode: 'warn',
      parentDomain: 'studio.localhost',
      reconcileMode: 'preserve',
      tenantAuthClientId: 'sva-studio-login',
      tenantAdminClientId: 'sva-studio-realm-admin',
      tenantAuthRealmMode: 'instance-id',
    });
  });
});

describe('buildLocalInstanceRegistryReconciliationSql', () => {
  it('rewrites local instance hostnames and tenant realms without touching server profiles', () => {
    const sql = buildLocalInstanceRegistryReconciliationSql({
      allowedInstanceIds: ['de-musterhausen'],
      driftMode: 'warn',
      parentDomain: 'studio.localhost',
      reconcileMode: 'preserve',
      tenantAuthClientId: 'sva-studio-login',
      tenantAdminClientId: 'sva-studio-realm-admin',
      tenantAuthRealmMode: 'instance-id',
    });

    expect(sql).toContain("parent_domain = COALESCE(NULLIF(parent_domain, ''), 'studio.localhost')");
    expect(sql).toContain(
      "primary_hostname = COALESCE(NULLIF(primary_hostname, ''), 'de-musterhausen.studio.localhost')"
    );
    expect(sql).toContain("auth_realm = COALESCE(NULLIF(auth_realm, ''), 'de-musterhausen')");
    expect(sql).toContain(
      "tenant_admin_client_id = COALESCE(NULLIF(tenant_admin_client_id, ''), 'sva-studio-realm-admin')"
    );
    expect(sql).toContain("VALUES ('de-musterhausen.studio.localhost', 'de-musterhausen', true, 'runtime-env-local')");
  });

  it('can keep the existing tenant realm when requested', () => {
    const sql = buildLocalInstanceRegistryReconciliationSql({
      allowedInstanceIds: ['de-musterhausen'],
      driftMode: 'warn',
      parentDomain: 'studio.localhost',
      reconcileMode: 'preserve',
      tenantAuthClientId: 'sva-studio-login',
      tenantAdminClientId: 'sva-studio-realm-admin',
      tenantAuthRealmMode: 'keep',
    });

    expect(sql).not.toContain('auth_realm =');
  });

  it('can build an authoritative reconcile sql for new or explicitly corrected environments', () => {
    const sql = buildLocalInstanceRegistryReconciliationSql({
      allowedInstanceIds: ['de-musterhausen'],
      driftMode: 'fail',
      parentDomain: 'studio.localhost',
      reconcileMode: 'authoritative',
      tenantAuthClientId: 'sva-studio-login',
      tenantAdminClientId: 'sva-studio-realm-admin',
      tenantAuthRealmMode: 'instance-id',
    });

    expect(sql).toContain("parent_domain = 'studio.localhost'");
    expect(sql).toContain("primary_hostname = 'de-musterhausen.studio.localhost'");
    expect(sql).toContain("auth_realm = 'de-musterhausen'");
  });
});

describe('evaluateLocalInstanceRegistryIdentityDrift', () => {
  it('returns no drift for matching or still-empty protected fields', () => {
    expect(
      evaluateLocalInstanceRegistryIdentityDrift(
        {
          allowedInstanceIds: ['de-musterhausen'],
          driftMode: 'warn',
          parentDomain: 'studio.localhost',
          reconcileMode: 'preserve',
          tenantAuthClientId: 'sva-studio-login',
          tenantAdminClientId: 'sva-studio-realm-admin',
          tenantAuthRealmMode: 'instance-id',
        },
        [
          {
            auth_client_id: '',
            auth_realm: '',
            id: 'de-musterhausen',
            parent_domain: 'studio.localhost',
            primary_hostname: '',
            tenant_admin_client_id: '',
          },
        ]
      )
    ).toEqual([]);
  });

  it('reports drift for existing protected identity values that differ from the local target', () => {
    expect(
      evaluateLocalInstanceRegistryIdentityDrift(
        {
          allowedInstanceIds: ['de-musterhausen'],
          driftMode: 'warn',
          parentDomain: 'studio.localhost',
          reconcileMode: 'preserve',
          tenantAuthClientId: 'sva-studio-login',
          tenantAdminClientId: 'sva-studio-realm-admin',
          tenantAuthRealmMode: 'instance-id',
        },
        [
          {
            auth_client_id: 'sva-studio',
            auth_realm: 'svs-intern-studio-staging',
            id: 'de-musterhausen',
            parent_domain: 'studio.smart-village.app',
            primary_hostname: 'de-musterhausen.studio.smart-village.app',
            tenant_admin_client_id: 'sva-studio-admin',
          },
        ]
      )
    ).toEqual([
      {
        fields: [
          'parent_domain',
          'primary_hostname',
          'auth_client_id',
          'auth_realm',
          'tenant_admin_client_id',
        ],
        id: 'de-musterhausen',
      },
    ]);
  });
});
