import { describe, expect, it } from 'vitest';

import {
  buildLocalInstanceRegistryIdentitySelectSql,
  buildLocalInstanceRegistryReconciliationInput,
  buildLocalInstanceRegistryReconciliationSql,
  evaluateLocalInstanceRegistryIdentityDrift,
} from './local-instance-registry';

describe('buildLocalInstanceRegistryReconciliationInput', () => {
  it('returns null when required tenant host context is missing', () => {
    expect(buildLocalInstanceRegistryReconciliationInput({})).toBeNull();
    expect(buildLocalInstanceRegistryReconciliationInput({ SVA_PARENT_DOMAIN: 'studio.localhost' })).toBeNull();
  });

  it.each([
    ['studio', 'reserved_tenant_hostname'],
    ['auth', 'reserved_tenant_hostname'],
    ['Studio', 'reserved_tenant_hostname'],
    ['AUTH', 'reserved_tenant_hostname'],
    ['admin', 'root_host_collision'],
    ['Admin', 'invalid_instance_id'],
  ])('rejects reserved reconciliation host %s', (id, reason) => {
    expect(() => buildLocalInstanceRegistryReconciliationInput({
      SVA_PARENT_DOMAIN: 'example.org', SVA_STUDIO_ROOT_HOST: 'admin.example.org', SVA_ALLOWED_INSTANCE_IDS: id,
    })).toThrow(`${id} (${reason})`);
  });

  it('detects root host collisions regardless of the root host casing', () => {
    expect(() => buildLocalInstanceRegistryReconciliationInput({
      SVA_PARENT_DOMAIN: 'example.org', SVA_STUDIO_ROOT_HOST: 'Admin.Example.org', SVA_ALLOWED_INSTANCE_IDS: 'admin',
    })).toThrow('admin (root_host_collision)');
  });

  it('blames an invalid parent domain instead of the allowlisted ids', () => {
    expect(() => buildLocalInstanceRegistryReconciliationInput({
      SVA_PARENT_DOMAIN: 'localhost', SVA_ALLOWED_INSTANCE_IDS: 'bb-guben',
    })).toThrow('SVA_PARENT_DOMAIN ist ungültig: localhost.');
  });

  it.each([
    ['De-Musterhausen', 'invalid_instance_id'],
    ['DE-MUSTERHAUSEN', 'invalid_instance_id'],
    ['-musterhausen', 'invalid_instance_id'],
    ['muster_hausen', 'invalid_instance_id'],
    ['xn--mnchen-3ya', 'invalid_instance_id'],
    ["de'musterhausen", 'invalid_instance_id'],
    ['de.musterhausen', 'invalid_instance_id'],
    ['bb-guben:3000', 'invalid_instance_id'],
  ])('rejects non-canonical instance id %s before any SQL is built', (id, reason) => {
    expect(() => buildLocalInstanceRegistryReconciliationInput({
      SVA_PARENT_DOMAIN: 'studio.localhost', SVA_ALLOWED_INSTANCE_IDS: `de-musterhausen,${id}`,
    })).toThrow(`SVA_ALLOWED_INSTANCE_IDS enthält ungültige oder reservierte Instanz-IDs: ${id} (${reason})`);
  });

  it('reports every rejected id instead of renaming any of them', () => {
    expect(() => buildLocalInstanceRegistryReconciliationInput({
      SVA_PARENT_DOMAIN: 'studio.localhost', SVA_ALLOWED_INSTANCE_IDS: 'De-Musterhausen, studio ,hb-meinquartier',
    })).toThrow(
      'SVA_ALLOWED_INSTANCE_IDS enthält ungültige oder reservierte Instanz-IDs: ' +
        'De-Musterhausen (invalid_instance_id), studio (reserved_tenant_hostname).'
    );
  });

  it('carries trimmed valid ids verbatim into the generated SQL', () => {
    const input = buildLocalInstanceRegistryReconciliationInput({
      SVA_PARENT_DOMAIN: 'studio.localhost', SVA_ALLOWED_INSTANCE_IDS: ' bb-guben ,, 0815 ',
    });

    if (!input) {
      throw new Error('expected reconciliation input');
    }
    expect(input.allowedInstanceIds).toEqual(['bb-guben', '0815']);
    expect(buildLocalInstanceRegistryIdentitySelectSql(input)).toContain("ARRAY['bb-guben', '0815']::text[]");
    expect(buildLocalInstanceRegistryReconciliationSql(input)).toContain("WHERE id = 'bb-guben';");
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
    expect(sql).toContain("auth_client_id = 'sva-studio-login'");
    expect(sql).toContain("tenant_admin_client_id = 'sva-studio-realm-admin'");
  });
});

describe('buildLocalInstanceRegistryIdentitySelectSql', () => {
  it('loads all protected identity fields for read-only drift checks', () => {
    const sql = buildLocalInstanceRegistryIdentitySelectSql({
      allowedInstanceIds: ['de-musterhausen'],
    });

    expect(sql).toContain('SELECT id, parent_domain, primary_hostname, auth_client_id, auth_realm, tenant_admin_client_id');
    expect(sql).toContain("WHERE id = ANY(ARRAY['de-musterhausen']::text[])");
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
