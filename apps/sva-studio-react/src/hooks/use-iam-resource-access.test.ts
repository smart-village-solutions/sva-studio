import { describe, expect, it } from 'vitest';

import {
  buildIamResourceRequirement,
  type IamUiResource,
} from './use-iam-resource-access';

describe('buildIamResourceRequirement', () => {
  it.each([
    ['user', 'read'],
    ['user', 'update'],
    ['role', 'read'],
    ['role', 'update'],
  ] as const)('uses the root role for the supported platform operation %s.%s', (resource, operation) => {
    expect(buildIamResourceRequirement(resource, operation, true)).toEqual({
      kind: 'platform',
      roles: { mode: 'anyOf', values: ['instance_registry_admin'] },
    });
  });

  it.each([
    ['user', 'create', 'iam.user.write'],
    ['user', 'delete', 'iam.accounts.delete'],
    ['role', 'create', 'iam.role.write'],
    ['role', 'delete', 'iam.role.write'],
  ] as const)(
    'keeps the tenant-only operation %s.%s tenant-bound in platform sessions',
    (resource, operation, action) => {
      expect(buildIamResourceRequirement(resource, operation, true)).toEqual({
        kind: 'tenant',
        actions: { mode: 'allOf', values: [action] },
      });
    }
  );

  it.each<IamUiResource>(['group', 'legalText', 'organization'])(
    'keeps every %s operation tenant-bound',
    (resource) => {
      for (const operation of ['read', 'create', 'update', 'delete'] as const) {
        expect(buildIamResourceRequirement(resource, operation, true).kind).toBe('tenant');
      }
    }
  );

  it('uses the resource action mapping in tenant scope', () => {
    expect(buildIamResourceRequirement('legalText', 'read', false)).toEqual({
      kind: 'tenant',
      actions: { mode: 'allOf', values: ['iam.legalText.read'] },
    });
  });
});
