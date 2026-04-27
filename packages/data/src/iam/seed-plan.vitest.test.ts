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

const pluginContentPermissions = [
  'news.read',
  'news.create',
  'news.update',
  'news.delete',
  'events.read',
  'events.create',
  'events.update',
  'events.delete',
  'poi.read',
  'poi.create',
  'poi.update',
  'poi.delete',
] as const;

describe('iamSeedPlan content permissions', () => {
  it('seeds every granular content and plugin permission without legacy content aliases', () => {
    const permissionKeys = iamSeedPlan.permissions.map((permission) => permission.key);

    expect(permissionKeys).toEqual(expect.arrayContaining([...granularContentPermissions]));
    expect(permissionKeys).toEqual(expect.arrayContaining([...pluginContentPermissions]));
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
    expect(getPersonaSeed('editor').permissionKeys).toEqual(
      expect.arrayContaining(['news.create', 'news.update', 'events.create', 'events.update', 'poi.create', 'poi.update'])
    );
    expect(getPersonaSeed('moderator').permissionKeys).toEqual(
      expect.arrayContaining(['content.publish', 'content.archive', 'content.restore', 'content.manageRevisions'])
    );
  });

  it('keeps plugin permissions namespace-isolated in persona assignments', () => {
    expect(getPersonaSeed('designer').permissionKeys).toEqual(
      expect.arrayContaining(['news.update', 'events.update', 'poi.update'])
    );
    expect(getPersonaSeed('designer').permissionKeys).not.toContain('news.create');
    expect(getPersonaSeed('moderator').permissionKeys).toEqual(
      expect.arrayContaining(['news.read', 'events.read', 'poi.read'])
    );
    expect(getPersonaSeed('moderator').permissionKeys).not.toContain('events.update');
  });
});
