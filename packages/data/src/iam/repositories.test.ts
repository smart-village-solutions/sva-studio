import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createIamSeedRepository, iamSeedStatements, type SqlStatement } from './repositories';

describe('iam seed statements', () => {
  it('builds permission upsert with structured fields and scope json', () => {
    const statement = iamSeedStatements.upsertPermission({
      id: 'permission-id',
      instanceId: 'instance-id',
      permissionKey: 'content.publish',
      action: 'content.publish',
      resourceType: 'news',
      resourceId: 'resource-id',
      effect: 'deny',
      scope: { restrictedOrganizationIds: ['org-id'] },
      description: 'Publish content',
    });

    assert.match(statement.text, /resource_type/);
    assert.match(statement.text, /scope = EXCLUDED\.scope/);
    assert.deepEqual(statement.values, [
      'permission-id',
      'instance-id',
      'content.publish',
      'content.publish',
      'news',
      'resource-id',
      'deny',
      '{"restrictedOrganizationIds":["org-id"]}',
      'Publish content',
    ]);
  });

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

  it('builds group upsert with role_bundle defaults', () => {
    const statement = iamSeedStatements.upsertGroup({
      id: 'group-id',
      instanceId: 'instance-id',
      groupKey: 'editors',
      displayName: 'Editors',
      description: 'Bundled editor roles',
    });

    assert.match(statement.text, /INSERT INTO iam\.groups/);
    assert.deepEqual(statement.values, [
      'group-id',
      'instance-id',
      'editors',
      'Editors',
      'Bundled editor roles',
      'role_bundle',
      true,
    ]);
  });

  it('builds geo unit upsert with hierarchy path fields', () => {
    const statement = iamSeedStatements.upsertGeoUnit({
      id: 'geo-id',
      instanceId: 'instance-id',
      geoKey: 'de-bw',
      displayName: 'Baden-Wuerttemberg',
      geoType: 'state',
      metadata: '{"level":"state"}',
      parentGeoUnitId: 'country-id',
      hierarchyPath: ['country-id'],
      depth: 1,
      isActive: true,
    });

    assert.match(statement.text, /INSERT INTO iam\.geo_units/);
    assert.deepEqual(statement.values, [
      'geo-id',
      'instance-id',
      'de-bw',
      'Baden-Wuerttemberg',
      'state',
      '{"level":"state"}',
      'country-id',
      {
        sqlType: 'uuid[]',
        values: ['country-id'],
      },
      1,
      true,
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

  it('builds group-role assignment as idempotent insert', () => {
    const statement = iamSeedStatements.assignGroupRole({
      instanceId: 'instance-id',
      groupId: 'group-id',
      roleId: 'role-id',
    });

    assert.match(statement.text, /ON CONFLICT \(instance_id, group_id, role_id\) DO NOTHING/);
    assert.deepEqual(statement.values, ['instance-id', 'group-id', 'role-id']);
  });

  it('builds account-group assignment with origin and validity fields', () => {
    const statement = iamSeedStatements.assignAccountGroup({
      instanceId: 'instance-id',
      accountId: 'account-id',
      groupId: 'group-id',
      origin: 'seed',
      validFrom: '2026-03-17T10:00:00Z',
      validTo: '2026-12-31T23:59:59Z',
    });

    assert.match(statement.text, /INSERT INTO iam\.account_groups/);
    assert.deepEqual(statement.values, [
      'instance-id',
      'account-id',
      'group-id',
      'seed',
      '2026-03-17T10:00:00Z',
      '2026-12-31T23:59:59Z',
    ]);
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

  it('builds organization upsert with hierarchy and policy fields', () => {
    const statement = iamSeedStatements.upsertOrganization({
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

    assert.match(statement.text, /parent_organization_id/);
    assert.match(statement.text, /hierarchy_path/);
    assert.deepEqual(statement.values, [
      'org-id',
      'instance-id',
      'org-key',
      'Org Display',
      '{"seed":true}',
      'municipality',
      'org_or_personal',
      'parent-id',
      {
        sqlType: 'uuid[]',
        values: ['root-id', 'parent-id'],
      },
      2,
      true,
    ]);
  });

  it('builds account-organization assignment with default context and visibility fields', () => {
    const statement = iamSeedStatements.assignAccountOrganization({
      instanceId: 'instance-id',
      accountId: 'account-id',
      organizationId: 'org-id',
      isDefaultContext: true,
      membershipVisibility: 'external',
    });

    assert.match(statement.text, /is_default_context/);
    assert.match(statement.text, /membership_visibility/);
    assert.deepEqual(statement.values, ['instance-id', 'account-id', 'org-id', true, 'external']);
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
      scope: { allowedGeoScopes: ['county'] },
      description: 'Read content',
    });

    assert.equal(captured.length, 1);
    assert.match(captured[0].text, /INSERT INTO iam\.permissions/);
    assert.deepEqual(captured[0].values, [
      'permission-id',
      'instance-id',
      'content.read',
      'content.read',
      'content',
      null,
      'allow',
      '{"allowedGeoScopes":["county"]}',
      'Read content',
    ]);
  });

  it('normalizes uuid array parameters before delegating organization statements to the executor', async () => {
    const captured: SqlStatement[] = [];
    const repository = createIamSeedRepository({
      async execute(statement) {
        captured.push(statement);
        return { rowCount: 1, rows: [] };
      },
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

    assert.deepEqual(captured[0]?.values, [
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
  });
});
