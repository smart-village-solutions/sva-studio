import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  'iam.legalText.read',
  'iam.legalText.write',
  'iam.governance.read',
  'iam.governance.write',
  'iam.governance.export',
  'iam.dsr.read',
  'iam.dsr.write',
  'iam.dsr.export',
  'iam.deletionRules.read',
  'iam.deletionRules.write',
  'iam.monitoring.read',
  'iam.monitoring.write',
  'app.read',
  'cockpit.read',
  'media.read',
  'media.create',
  'media.update',
  'media.reference.manage',
  'media.delete',
  'media.deliver.protected',
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

const seedDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../seeds');
const personaSeedSql = readFileSync(resolve(seedDir, '0001_iam_personas.sql'), 'utf8');

describe('iamSeedPlan content permissions', () => {
  it('includes deletion-rules defaults in the seed plan', () => {
    expect(iamSeedPlan.seedFiles).toEqual([
      '0001_iam_personas.sql',
      '0002_bb_guben_permissions.sql',
      '0003_iam_deletion_rules_defaults.sql',
    ]);
  });

  it('seeds every granular content and plugin permission without legacy content aliases', () => {
    const permissionKeys = iamSeedPlan.permissions.map((permission) => permission.key);

    expect(permissionKeys).toEqual(expect.arrayContaining([...granularContentPermissions]));
    expect(permissionKeys).toEqual(expect.arrayContaining([...pluginContentPermissions]));
    expect(permissionKeys).not.toContain('content.update');
    expect(permissionKeys).not.toContain('content.moderate');
  });

  it('assigns granular content permissions to content personas', () => {
    expect(getPersonaSeed('app_manager').permissionKeys).toEqual(
      expect.arrayContaining(['app.read', 'cockpit.read'])
    );
    expect(getPersonaSeed('app_manager').permissionKeys).toEqual(
      expect.arrayContaining([
        'iam.legalText.read',
        'iam.legalText.write',
        'iam.monitoring.read',
        'iam.monitoring.write',
        'integration.manage',
      ])
    );
    expect(getPersonaSeed('app_manager').permissionKeys).toContain('content.readHistory');
    expect(getPersonaSeed('app_manager').permissionKeys).toContain('media.read');
    expect(getPersonaSeed('interface_manager').permissionKeys).toContain('content.readHistory');
    expect(getPersonaSeed('interface_manager').permissionKeys).toEqual(
      expect.arrayContaining(['app.read', 'cockpit.read'])
    );
    expect(getPersonaSeed('feature_manager').permissionKeys).toEqual(
      expect.arrayContaining(['content.updateMetadata', 'content.updatePayload', 'content.changeStatus', 'media.reference.manage'])
    );
    expect(getPersonaSeed('designer').permissionKeys).toEqual(expect.arrayContaining(['app.read', 'cockpit.read']));
    expect(getPersonaSeed('designer').permissionKeys).toEqual(
      expect.arrayContaining(['content.updateMetadata', 'content.updatePayload', 'media.update'])
    );
    expect(getPersonaSeed('editor').permissionKeys).toEqual(expect.arrayContaining(['app.read', 'cockpit.read']));
    expect(getPersonaSeed('editor').permissionKeys).toEqual(
      expect.arrayContaining(['content.create', 'content.changeStatus', 'content.delete', 'media.create', 'media.reference.manage'])
    );
    expect(getPersonaSeed('editor').permissionKeys).toEqual(
      expect.arrayContaining(['news.create', 'news.update', 'events.create', 'events.update', 'poi.create', 'poi.update'])
    );
    expect(getPersonaSeed('moderator').permissionKeys).toEqual(expect.arrayContaining(['app.read', 'cockpit.read']));
    expect(getPersonaSeed('moderator').permissionKeys).toEqual(
      expect.arrayContaining(['content.publish', 'content.archive', 'content.restore', 'content.manageRevisions', 'media.read'])
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

  it('does not seed a tenant-side instance_registry_admin persona into 0001 anymore', () => {
    expect(personaSeedSql).not.toContain("'seed:instance_registry_admin'");
    expect(personaSeedSql).not.toContain(
      "('30188888-8888-8888-8888-888888888888', 'de-musterhausen', 'instance_registry_admin'"
    );
    expect(personaSeedSql).not.toContain(
      "('de-musterhausen', '50888888-8888-8888-8888-888888888888', 'member')"
    );
    expect(personaSeedSql).not.toContain(
      "('de-musterhausen', '50888888-8888-8888-8888-888888888888', '30188888-8888-8888-8888-888888888888')"
    );
    expect(personaSeedSql).not.toContain(
      "('instance_registry_admin', 'instance.registry.manage')"
    );
    expect(personaSeedSql).not.toContain(
      "('instance_registry_admin', 'feature.toggle')"
    );
    expect(personaSeedSql).not.toContain(
      "('instance_registry_admin', 'integration.manage')"
    );
    expect(personaSeedSql).toContain(
      "('app_manager', 'app.read')"
    );
    expect(personaSeedSql).toContain(
      "('app_manager', 'cockpit.read')"
    );
  });
});
