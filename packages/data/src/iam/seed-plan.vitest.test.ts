import { describe, expect, it } from 'vitest';

import { getPersonaSeed, iamSeedPlan } from './seed-plan';

const granularContentPermissions = [
  'content.read',
  'content.create',
  'content.updateMetadata',
  'content.updatePayload',
  'content.changeStatus',
  'content.publish',
  'content.archive',
  'content.restore',
  'content.readHistory',
  'content.manageRevisions',
  'content.delete',
] as const;

describe('iamSeedPlan content permissions', () => {
  it('seeds every granular content permission without legacy content aliases', () => {
    const permissionKeys = iamSeedPlan.permissions.map((permission) => permission.key);

    expect(permissionKeys).toEqual(expect.arrayContaining([...granularContentPermissions]));
    expect(permissionKeys).not.toContain('content.update');
    expect(permissionKeys).not.toContain('content.moderate');
  });

  it('assigns granular content permissions to content personas', () => {
    expect(getPersonaSeed('app_manager').permissionKeys).toContain('content.readHistory');
    expect(getPersonaSeed('interface_manager').permissionKeys).toContain('content.readHistory');
    expect(getPersonaSeed('feature_manager').permissionKeys).toEqual(
      expect.arrayContaining(['content.updateMetadata', 'content.updatePayload', 'content.changeStatus'])
    );
    expect(getPersonaSeed('designer').permissionKeys).toEqual(
      expect.arrayContaining(['content.updateMetadata', 'content.updatePayload'])
    );
    expect(getPersonaSeed('editor').permissionKeys).toEqual(
      expect.arrayContaining(['content.create', 'content.changeStatus', 'content.delete'])
    );
    expect(getPersonaSeed('moderator').permissionKeys).toEqual(
      expect.arrayContaining(['content.publish', 'content.archive', 'content.restore', 'content.manageRevisions'])
    );
  });
});
