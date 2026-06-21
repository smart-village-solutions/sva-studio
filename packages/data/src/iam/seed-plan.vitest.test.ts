import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getPersonaSeed, iamSeedPlan, rootOnlySeedPermissionKeys, tenantBootstrapPermissionKeys } from './seed-plan';

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
  'experimental.read',
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
  'categories.read',
  'categories.create',
  'categories.update',
  'categories.delete',
] as const;

const seedDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../seeds');
const personaSeedSql = readFileSync(resolve(seedDir, '0001_iam_personas.sql'), 'utf8');
const bbGubenSeedSql = readFileSync(resolve(seedDir, '0002_bb_guben_permissions.sql'), 'utf8');

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

  it('assigns the full tenant bootstrap permission set to system_admin', () => {
    expect(getPersonaSeed('system_admin').permissionKeys).toEqual(tenantBootstrapPermissionKeys);
    expect(getPersonaSeed('system_admin').permissionKeys).toEqual(
      expect.arrayContaining([
        'experimental.read',
        'app.read',
        'cockpit.read',
        'iam.legalText.read',
        'iam.governance.write',
        'iam.dsr.export',
        'iam.deletionRules.write',
        'iam.monitoring.write',
        'content.create',
        'content.changeStatus',
        'content.publish',
        'content.manageRevisions',
        'content.delete',
        'media.create',
        'media.reference.manage',
        'media.deliver.protected',
        'news.create',
        'news.update',
        'events.create',
        'poi.delete',
        'categories.read',
        'categories.create',
        'categories.update',
        'categories.delete',
        'integration.manage',
        'feature.toggle',
      ])
    );
  });

  it('does not seed a tenant-side instance_registry_admin persona into 0001 anymore', () => {
    expect(rootOnlySeedPermissionKeys).toEqual(['instance.registry.manage']);
    expect(tenantBootstrapPermissionKeys).not.toContain('instance.registry.manage');
    expect(getPersonaSeed('system_admin').permissionKeys).toEqual(tenantBootstrapPermissionKeys);
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
    expect(personaSeedSql).not.toContain("'seed:app_manager'");
    expect(personaSeedSql).not.toContain("('app_manager', 'experimental.read')");
    expect(personaSeedSql).not.toContain("('app_manager', 'app.read')");
    expect(personaSeedSql).not.toContain("('app_manager', 'cockpit.read')");
  });

  it('assigns the categories module to seeded instances with mainserver content modules', () => {
    expect(personaSeedSql).toContain("('de-musterhausen', 'categories')");
    expect(bbGubenSeedSql).toContain("('bb-guben', 'categories')");
  });

  it('throws for unknown persona keys', () => {
    expect(() => getPersonaSeed('unknown' as never)).toThrowError('Unknown persona key: unknown');
  });
});
