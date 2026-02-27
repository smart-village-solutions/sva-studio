import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createIamSeedRepository, iamSeedStatements, type SqlStatement } from './repositories';

describe('iam seed statements', () => {
  it('builds role upsert with ON CONFLICT update', () => {
    const statement = iamSeedStatements.upsertRole({
      id: 'role-id',
      instanceId: 'instance-id',
      roleName: 'editor',
      description: 'Editor role',
      isSystemRole: true,
    });

    assert.match(statement.text, /ON CONFLICT \(instance_id, role_name\) DO UPDATE/);
    assert.deepEqual(statement.values, ['role-id', 'instance-id', 'editor', 'Editor role', true]);
  });

  it('builds account-role assignment as idempotent insert', () => {
    const statement = iamSeedStatements.assignAccountRole({
      instanceId: 'instance-id',
      accountId: 'account-id',
      roleId: 'role-id',
    });

    assert.match(statement.text, /ON CONFLICT \(instance_id, account_id, role_id\) DO NOTHING/);
    assert.deepEqual(statement.values, ['instance-id', 'account-id', 'role-id']);
  });
});

describe('iam seed repository', () => {
  it('delegates to SQL executor', async () => {
    const captured: SqlStatement[] = [];
    const repository = createIamSeedRepository({
      async execute(statement) {
        captured.push(statement);
        return { rowCount: 1, rows: [] };
      },
    });

    await repository.upsertPermission({
      id: 'permission-id',
      instanceId: 'instance-id',
      permissionKey: 'content.read',
      description: 'Read content',
    });

    assert.equal(captured.length, 1);
    assert.match(captured[0].text, /INSERT INTO iam\.permissions/);
    assert.deepEqual(captured[0].values, ['permission-id', 'instance-id', 'content.read', 'Read content']);
  });
});
