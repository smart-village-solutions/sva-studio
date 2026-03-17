import { describe, expect, it } from 'vitest';

import { createIamSeedRepository, iamSeedStatements, type SqlStatement } from './repositories';

describe('iamSeedStatements (vitest)', () => {
  it('builds permission upserts with defaults for action, resource type and effect', () => {
    const statement = iamSeedStatements.upsertPermission({
      id: 'permission-id',
      instanceId: 'instance-id',
      permissionKey: 'dashboard',
      description: 'Open dashboard',
    });

    expect(statement.text).toContain('INSERT INTO iam.permissions');
    expect(statement.values).toEqual([
      'permission-id',
      'instance-id',
      'dashboard',
      'dashboard',
      'dashboard',
      null,
      'allow',
      '{}',
      'Open dashboard',
    ]);
  });

  it('builds organization and geo statements with optional defaults and uuid array parameters', () => {
    const organizationStatement = iamSeedStatements.upsertOrganization({
      id: 'org-id',
      instanceId: 'instance-id',
      organizationKey: 'org-key',
      displayName: 'Org Display',
      metadata: '{"seed":true}',
      organizationType: 'municipality',
      contentAuthorPolicy: 'org_only',
      hierarchyPath: [],
      depth: 0,
    });
    const geoStatement = iamSeedStatements.upsertGeoUnit({
      id: 'geo-id',
      instanceId: 'instance-id',
      geoKey: 'de',
      displayName: 'Deutschland',
      geoType: 'country',
      metadata: '{}',
      hierarchyPath: [],
      depth: 0,
    });

    expect(organizationStatement.values).toEqual([
      'org-id',
      'instance-id',
      'org-key',
      'Org Display',
      '{"seed":true}',
      'municipality',
      'org_only',
      null,
      {
        sqlType: 'uuid[]',
        values: [],
      },
      0,
      true,
    ]);
    expect(geoStatement.values).toEqual([
      'geo-id',
      'instance-id',
      'de',
      'Deutschland',
      'country',
      '{}',
      null,
      {
        sqlType: 'uuid[]',
        values: [],
      },
      0,
      true,
    ]);
  });

  it('builds group and membership statements with default fallbacks', () => {
    const groupStatement = iamSeedStatements.upsertGroup({
      id: 'group-id',
      instanceId: 'instance-id',
      groupKey: 'admins',
      displayName: 'Admins',
    });
    const accountGroupStatement = iamSeedStatements.assignAccountGroup({
      instanceId: 'instance-id',
      accountId: 'account-id',
      groupId: 'group-id',
    });
    const accountOrganizationStatement = iamSeedStatements.assignAccountOrganization({
      instanceId: 'instance-id',
      accountId: 'account-id',
      organizationId: 'org-id',
    });
    const membershipStatement = iamSeedStatements.upsertInstanceMembership({
      instanceId: 'instance-id',
      accountId: 'account-id',
      membershipType: 'member',
    });

    expect(groupStatement.values).toEqual([
      'group-id',
      'instance-id',
      'admins',
      'Admins',
      null,
      'role_bundle',
      true,
    ]);
    expect(accountGroupStatement.values).toEqual([
      'instance-id',
      'account-id',
      'group-id',
      'manual',
      null,
      null,
    ]);
    expect(accountOrganizationStatement.values).toEqual([
      'instance-id',
      'account-id',
      'org-id',
      false,
      'internal',
    ]);
    expect(membershipStatement.values).toEqual(['instance-id', 'account-id', 'member']);
  });
});

describe('createIamSeedRepository (vitest)', () => {
  it('delegates every supported seed operation and normalizes uuid arrays', async () => {
    const captured: SqlStatement[] = [];
    const repository = createIamSeedRepository({
      async execute(statement) {
        captured.push(statement);
        return { rowCount: 1, rows: [] };
      },
    });

    await repository.upsertInstance({
      id: 'instance-id',
      displayName: 'Instance Display',
    });
    await repository.upsertOrganization({
      id: 'org-id',
      instanceId: 'instance-id',
      organizationKey: 'org-key',
      displayName: 'Org Display',
      metadata: '{"seed":true}',
      organizationType: 'municipality',
      contentAuthorPolicy: 'org_or_personal',
      parentOrganizationId: 'parent-id',
      hierarchyPath: ['root-id', 'parent-id'],
      depth: 2,
      isActive: true,
    });
    await repository.upsertRole({
      id: 'role-id',
      instanceId: 'instance-id',
      roleKey: 'editor',
      roleName: 'editor',
      description: 'Editor role',
      isSystemRole: false,
      roleLevel: 10,
    });
    await repository.upsertGroup({
      id: 'group-id',
      instanceId: 'instance-id',
      groupKey: 'editors',
      displayName: 'Editors',
    });
    await repository.upsertGeoUnit({
      id: 'geo-id',
      instanceId: 'instance-id',
      geoKey: 'de-bw',
      displayName: 'Baden-Wuerttemberg',
      geoType: 'state',
      metadata: '{"level":"state"}',
      parentGeoUnitId: 'country-id',
      hierarchyPath: ['country-id'],
      depth: 1,
    });
    await repository.upsertPermission({
      id: 'permission-id',
      instanceId: 'instance-id',
      permissionKey: 'content.read',
      scope: { allowedGeoScopes: ['county'] },
      description: 'Read content',
    });
    await repository.upsertAccount({
      id: 'account-id',
      instanceId: 'instance-id',
      keycloakSubject: 'subject-id',
      emailCiphertext: 'enc-email',
      displayNameCiphertext: 'enc-display',
    });
    await repository.upsertInstanceMembership({
      instanceId: 'instance-id',
      accountId: 'account-id',
      membershipType: 'member',
    });
    await repository.assignAccountRole({
      instanceId: 'instance-id',
      accountId: 'account-id',
      roleId: 'role-id',
    });
    await repository.assignGroupRole({
      instanceId: 'instance-id',
      groupId: 'group-id',
      roleId: 'role-id',
    });
    await repository.assignAccountGroup({
      instanceId: 'instance-id',
      accountId: 'account-id',
      groupId: 'group-id',
      origin: 'sync',
    });
    await repository.assignAccountOrganization({
      instanceId: 'instance-id',
      accountId: 'account-id',
      organizationId: 'org-id',
      isDefaultContext: true,
    });
    await repository.assignRolePermission({
      instanceId: 'instance-id',
      roleId: 'role-id',
      permissionId: 'permission-id',
    });

    expect(captured).toHaveLength(13);
    expect(captured[0]?.text).toContain('INSERT INTO iam.instances');
    expect(captured[1]?.values).toEqual([
      'org-id',
      'instance-id',
      'org-key',
      'Org Display',
      '{"seed":true}',
      'municipality',
      'org_or_personal',
      'parent-id',
      ['root-id', 'parent-id'],
      2,
      true,
    ]);
    expect(captured[4]?.values).toEqual([
      'geo-id',
      'instance-id',
      'de-bw',
      'Baden-Wuerttemberg',
      'state',
      '{"level":"state"}',
      'country-id',
      ['country-id'],
      1,
      true,
    ]);
    expect(captured[12]?.values).toEqual(['instance-id', 'role-id', 'permission-id']);
  });
});
