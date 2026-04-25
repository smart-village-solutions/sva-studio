import { describe, expect, it } from 'vitest';

import type { SqlExecutionResult, SqlExecutor, SqlStatement } from './types.js';
import { createIamSeedRepository } from './create-repository.js';
import { iamSeedStatements } from './statements.js';

const uuid = '00000000-0000-4000-8000-000000000001';
const instanceId = 'tenant-a';

const createExecutor = () => {
  const statements: SqlStatement[] = [];
  const executor: SqlExecutor = {
    async execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> {
      statements.push(statement);
      return { rowCount: 0, rows: [] };
    },
  };

  return { executor, statements };
};

describe('IAM seed statements', () => {
  it('builds defaults for roles, permissions, groups and memberships', () => {
    expect(
      iamSeedStatements.upsertRole({
        id: uuid,
        instanceId,
        roleKey: 'editor',
        roleName: 'Editor',
        description: 'Can edit content',
        isSystemRole: false,
        roleLevel: 20,
      }).values
    ).toEqual([uuid, instanceId, 'editor', 'Editor', 'editor', 'Can edit content', false, 20, 'studio', 'pending']);

    expect(
      iamSeedStatements.upsertPermission({
        id: uuid,
        instanceId,
        permissionKey: 'content.publish',
        description: 'Publish content',
      }).values
    ).toEqual([uuid, instanceId, 'content.publish', 'content.publish', 'content', null, 'allow', '{}', 'Publish content']);

    expect(
      iamSeedStatements.upsertGroup({
        id: uuid,
        instanceId,
        groupKey: 'editors',
        displayName: 'Editors',
      }).values
    ).toEqual([uuid, instanceId, 'editors', 'Editors', null, 'role_bundle', true]);

    expect(
      iamSeedStatements.assignAccountGroup({
        instanceId,
        accountId: uuid,
        groupId: '00000000-0000-4000-8000-000000000002',
      }).values
    ).toEqual([instanceId, uuid, '00000000-0000-4000-8000-000000000002', 'manual', null, null]);
  });

  it('keeps explicit optional values in generated statements', () => {
    expect(
      iamSeedStatements.upsertPermission({
        id: uuid,
        instanceId,
        permissionKey: 'iam.user.read',
        action: 'read',
        resourceType: 'iam-user',
        resourceId: 'user-1',
        effect: 'deny',
        scope: { organizationId: 'org-1' },
        description: 'Read users',
      }).values
    ).toEqual([
      uuid,
      instanceId,
      'iam.user.read',
      'read',
      'iam-user',
      'user-1',
      'deny',
      '{"organizationId":"org-1"}',
      'Read users',
    ]);
  });
});

describe('IAM seed repository', () => {
  it('executes normalized statements for hierarchy arrays and assignment helpers', async () => {
    const { executor, statements } = createExecutor();
    const repository = createIamSeedRepository(executor);

    await repository.upsertInstance({ id: instanceId, displayName: 'Tenant A' });
    await repository.upsertOrganization({
      id: uuid,
      instanceId,
      organizationKey: 'org',
      displayName: 'Org',
      metadata: '{}',
      organizationType: 'municipality',
      contentAuthorPolicy: 'org_only',
      hierarchyPath: [uuid],
      depth: 0,
    });
    await repository.upsertGeoUnit({
      id: uuid,
      instanceId,
      geoKey: 'geo',
      displayName: 'Geo',
      geoType: 'municipality',
      metadata: '{}',
      hierarchyPath: [uuid],
      depth: 0,
    });
    await repository.upsertAccount({
      id: uuid,
      instanceId,
      keycloakSubject: 'subject-1',
      emailCiphertext: 'email-cipher',
      displayNameCiphertext: 'name-cipher',
    });
    await repository.upsertInstanceMembership({
      instanceId,
      accountId: uuid,
      membershipType: 'member',
    });
    await repository.assignAccountRole({ instanceId, accountId: uuid, roleId: uuid });
    await repository.assignGroupRole({ instanceId, groupId: uuid, roleId: uuid });
    await repository.assignAccountOrganization({ instanceId, accountId: uuid, organizationId: uuid });
    await repository.assignRolePermission({ instanceId, roleId: uuid, permissionId: uuid });

    expect(statements).toHaveLength(9);
    expect(statements[1]?.values).toContainEqual([uuid]);
    expect(statements[2]?.values).toContainEqual([uuid]);
    expect(statements.at(-1)?.text).toContain('INSERT INTO iam.role_permissions');
  });
});
