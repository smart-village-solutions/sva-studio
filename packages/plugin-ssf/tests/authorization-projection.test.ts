import { describe, expect, it } from 'vitest';

import {
  createSsfAuthorizationProjection,
  areSsfAuthorizationProjectionsEqual,
  createSsfAuthorizationRevision,
  normalizeSsfAuthorizationProjection,
  SSF_AUTHORIZATION_PROJECTION_VERSION,
  SSF_TENANT_PERMISSION_IDS,
  SSF_TOKEN_CLAIMS,
  type SsfAuthorizationProjection,
} from '../src/authorization-projection.js';

const projection = (instanceId = 'tenant-a'): SsfAuthorizationProjection => ({
  contractVersion: SSF_AUTHORIZATION_PROJECTION_VERSION,
  instanceId,
  subjects: [
    {
      subject: 'user-b',
      roles: ['user'],
      permissions: ['ssf.configuration.tenant.read'],
    },
    {
      subject: 'user-a',
      roles: ['user', 'tenant_admin'],
      permissions: ['ssf.configuration.tenant.read', 'ssf.configuration.tenant.manage'],
    },
  ],
});

describe('SSF authorization projection contract', () => {
  it('publishes the fixed V1 claim names and tenant permission catalog', () => {
    expect(SSF_TOKEN_CLAIMS).toEqual({
      instanceId: 'studio_instance_id',
      roles: 'ssf_roles',
      permissions: 'ssf_permissions',
      authorizationRevision: 'ssf_authorization_revision',
    });
    expect(SSF_TENANT_PERMISSION_IDS).toEqual([
      'ssf.configuration.tenant.manage',
      'ssf.configuration.tenant.read',
    ]);
  });

  it('normalizes subjects, roles and permissions before hashing', () => {
    const normalized = normalizeSsfAuthorizationProjection(projection());
    expect(normalized.subjects.map(({ subject }) => subject)).toEqual(['user-a', 'user-b']);
    expect(normalized.subjects[0]?.roles).toEqual(['tenant_admin', 'user']);

    const reordered: SsfAuthorizationProjection = {
      ...projection(),
      subjects: [...projection().subjects].reverse().map((entry) => ({
        ...entry,
        roles: [...entry.roles].reverse(),
        permissions: [...entry.permissions].reverse(),
      })),
    };
    expect(areSsfAuthorizationProjectionsEqual(projection(), reordered)).toBe(true);
    expect(createSsfAuthorizationRevision(projection())).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it('binds the revision to the tenant and effective permissions', () => {
    expect(createSsfAuthorizationRevision(projection('tenant-a'))).not.toBe(
      createSsfAuthorizationRevision(projection('tenant-b'))
    );
    const reduced: SsfAuthorizationProjection = {
      ...projection(),
      subjects: projection().subjects.map((entry) =>
        entry.subject === 'user-a' ? { ...entry, permissions: [] } : entry
      ),
    };
    expect(createSsfAuthorizationRevision(projection())).not.toBe(
      createSsfAuthorizationRevision(reduced)
    );
  });

  it('rejects duplicate subjects and permissions outside the catalog', () => {
    const firstSubject = projection().subjects[0];
    if (!firstSubject) throw new Error('projection fixture requires a subject');
    expect(() =>
      normalizeSsfAuthorizationProjection({
        ...projection(),
        subjects: [firstSubject, firstSubject],
      })
    ).toThrow('ssf_authorization_projection_duplicate_subject:user-b');
    expect(() =>
      normalizeSsfAuthorizationProjection({
        ...projection(),
        subjects: [
          {
            subject: 'user-a',
            roles: ['user'],
            permissions: ['ssf.unknown' as never],
          },
        ],
      })
    ).toThrow();
  });

  it('maps effective Studio permissions to tenant-local SSF roles without another identity map', () => {
    expect(
      createSsfAuthorizationProjection({
        instanceId: 'tenant-a',
        subjects: [
          {
            subject: 'reader',
            roleNames: ['editor'],
            permissionIds: ['content.read', 'ssf.configuration.tenant.read'],
          },
          {
            subject: 'admin',
            roleNames: ['system_admin'],
            permissionIds: [
              'ssf.configuration.tenant.read',
              'ssf.configuration.tenant.manage',
            ],
          },
          {
            subject: 'custom-manager',
            roleNames: ['ssf_manager'],
            permissionIds: ['ssf.configuration.tenant.manage'],
          },
          {
            subject: 'without-ssf-access',
            roleNames: ['system_admin'],
            permissionIds: ['content.read'],
          },
        ],
      })
    ).toEqual({
      contractVersion: SSF_AUTHORIZATION_PROJECTION_VERSION,
      instanceId: 'tenant-a',
      subjects: [
        {
          subject: 'admin',
          roles: ['tenant_admin'],
          permissions: [
            'ssf.configuration.tenant.manage',
            'ssf.configuration.tenant.read',
          ],
        },
        {
          subject: 'custom-manager',
          roles: ['user'],
          permissions: ['ssf.configuration.tenant.manage'],
        },
        {
          subject: 'reader',
          roles: ['user'],
          permissions: ['ssf.configuration.tenant.read'],
        },
      ],
    });
  });

  it('fails closed for an unrecognized permission in the SSF namespace', () => {
    expect(() =>
      createSsfAuthorizationProjection({
        instanceId: 'tenant-a',
        subjects: [{ subject: 'user-a', roleNames: ['custom'], permissionIds: ['ssf.unknown'] }],
      })
    ).toThrow('ssf_authorization_projection_unknown_permission:ssf.unknown');
  });
});
