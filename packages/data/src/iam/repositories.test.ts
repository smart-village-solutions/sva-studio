import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createIamSeedRepository, iamSeedStatements, type SqlStatement } from './repositories';

describe('iam seed statements', () => {
  it('builds role upsert with ON CONFLICT update', () => {
    const statement = iamSeedStatements.upsertRole({
      id: 'role-id',
      instanceId: 'instance-id',
      roleKey: 'editor',
      roleName: 'editor',
      description: 'Editor role',
      isSystemRole: true,
      roleLevel: 30,
    });

    assert.match(statement.text, /ON CONFLICT \(instance_id, role_key\) DO UPDATE/);
    assert.deepEqual(statement.values, [
      'role-id',
      'instance-id',
      'editor',
      'editor',
      'editor',
      'Editor role',
      true,
      30,
      'studio',
      'pending',
    ]);
  });

  it('allows explicit managedBy and external role mapping in role upserts', () => {
    const statement = iamSeedStatements.upsertRole({
      id: 'role-id',
      instanceId: 'instance-id',
      roleKey: 'mainserver_admin',
      roleName: 'mainserver_admin',
      description: 'Mainserver admin role',
      isSystemRole: false,
      roleLevel: 90,
      externalRoleName: 'Admin',
      managedBy: 'external',
      syncState: 'pending',
    });

    assert.match(statement.text, /managed_by/);
    assert.deepEqual(statement.values, [
      'role-id',
      'instance-id',
      'mainserver_admin',
      'mainserver_admin',
      'Admin',
      'Mainserver admin role',
      false,
      90,
      'external',
      'pending',
    ]);
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

  it('builds account upsert with keycloak subject and instance conflict target', () => {
    const statement = iamSeedStatements.upsertAccount({
      id: 'account-id',
      instanceId: 'instance-id',
      keycloakSubject: 'subject-id',
      emailCiphertext: 'enc-email',
      displayNameCiphertext: 'enc-display',
    });

    assert.match(
      statement.text,
      /ON CONFLICT \(keycloak_subject, instance_id\) WHERE instance_id IS NOT NULL DO UPDATE/
    );
    assert.deepEqual(statement.values, ['account-id', 'instance-id', 'subject-id', 'enc-email', 'enc-display']);
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
