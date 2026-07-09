import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const seedDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'seeds');
const readSeed = (name: string) => readFileSync(resolve(seedDir, name), 'utf8');

describe('iam seed sql contracts', () => {
  it('keeps protected instance identity fields in 0001 additive for existing environments', () => {
    const sql = readSeed('0001_iam_personas.sql');

    expect(sql).toMatch(/parent_domain = COALESCE\(NULLIF\(iam\.instances\.parent_domain, ''\), EXCLUDED\.parent_domain\)/);
    expect(sql).toMatch(/primary_hostname = COALESCE\(NULLIF\(iam\.instances\.primary_hostname, ''\), EXCLUDED\.primary_hostname\)/);
    expect(sql).toMatch(/auth_realm = COALESCE\(NULLIF\(iam\.instances\.auth_realm, ''\), EXCLUDED\.auth_realm\)/);
    expect(sql).toMatch(/auth_client_id = COALESCE\(NULLIF\(iam\.instances\.auth_client_id, ''\), EXCLUDED\.auth_client_id\)/);
    expect(sql).toMatch(
      /tenant_admin_client_id = COALESCE\(NULLIF\(iam\.instances\.tenant_admin_client_id, ''\), EXCLUDED\.tenant_admin_client_id\)/
    );
    expect(sql).not.toMatch(/parent_domain = EXCLUDED\.parent_domain,/);
    expect(sql).not.toMatch(/primary_hostname = EXCLUDED\.primary_hostname,/);
    expect(sql).not.toMatch(/auth_realm = EXCLUDED\.auth_realm,/);
    expect(sql).not.toMatch(/auth_client_id = EXCLUDED\.auth_client_id,/);
    expect(sql).not.toMatch(/tenant_admin_client_id = EXCLUDED\.tenant_admin_client_id,/);
    expect(sql).toMatch(/instances\.primary_hostname = 'de-musterhausen\.studio\.localhost'/);
    expect(sql).toMatch(/AND instances\.primary_hostname = EXCLUDED\.hostname/);
  });

  it('seeds de-musterhausen with the local-keycloak reference identity by default', () => {
    const sql = readSeed('0001_iam_personas.sql');

    expect(sql).toMatch(
      /VALUES\s*\(\s*'de-musterhausen',\s*'Seed Instance Default',\s*'active',\s*'studio\.localhost',\s*'de-musterhausen\.studio\.localhost',\s*'de-musterhausen',\s*'sva-studio',\s*'sva-studio-realm-admin',\s*'\{\}'::jsonb\s*\)/
    );
    expect(sql).not.toMatch(/'de-musterhausen\.studio\.smart-village\.app'/);
    expect(sql).not.toMatch(/'svs-intern-studio-staging'/);
    expect(sql).not.toMatch(/'sva-studio-admin'/);
  });

  it('keeps 0002 non-destructive for an already provisioned instance identity', () => {
    const sql = readSeed('0002_bb_guben_permissions.sql');

    expect(sql).toMatch(/ON CONFLICT \(id\) DO NOTHING;/);
    expect(sql).not.toMatch(/ON CONFLICT \(id\) DO UPDATE/);
    expect(sql).not.toMatch(/parent_domain = EXCLUDED\.parent_domain,/);
    expect(sql).not.toMatch(/primary_hostname = EXCLUDED\.primary_hostname,/);
    expect(sql).not.toMatch(/auth_realm = EXCLUDED\.auth_realm,/);
    expect(sql).not.toMatch(/auth_client_id = EXCLUDED\.auth_client_id,/);
    expect(sql).not.toMatch(/tenant_admin_client_id = EXCLUDED\.tenant_admin_client_id,/);
  });

  it('does not keep a tenant-side instance_registry_admin persona in 0001 anymore', () => {
    const sql = readSeed('0001_iam_personas.sql');

    expect(sql).not.toMatch(/'seed:instance_registry_admin'/);
    expect(sql).not.toMatch(/'30188888-8888-8888-8888-888888888888', 'de-musterhausen', 'instance_registry_admin'/);
    expect(sql).not.toMatch(/\('de-musterhausen', '50888888-8888-8888-8888-888888888888', 'member'\)/);
    expect(sql).not.toMatch(/\('de-musterhausen', '50888888-8888-8888-8888-888888888888', '30188888-8888-8888-8888-888888888888'\)/);
    expect(sql).not.toMatch(/\('instance_registry_admin', 'instance\.registry\.manage'\)/);
    expect(sql).not.toMatch(/\('instance_registry_admin', 'feature\.toggle'\)/);
    expect(sql).not.toMatch(/\('instance_registry_admin', 'integration\.manage'\)/);
    expect(sql).not.toMatch(/'seed:app_manager'/);
    expect(sql).not.toMatch(/'seed:feature_manager'/);
    expect(sql).not.toMatch(/'seed:interface_manager'/);
    expect(sql).not.toMatch(/'seed:designer'/);
    expect(sql).not.toMatch(/'seed:editor'/);
    expect(sql).not.toMatch(/'seed:moderator'/);
    expect(sql).not.toMatch(/'app_manager'/);
    expect(sql).not.toMatch(/'feature-manager'/);
    expect(sql).not.toMatch(/'interface-manager'/);
    expect(sql).not.toMatch(/'designer'/);
    expect(sql).not.toMatch(/'editor'/);
    expect(sql).not.toMatch(/'moderator'/);
  });

  it('expects the deletion-rules seed to create tenant defaults', () => {
    const sql = readSeed('0003_iam_deletion_rules_defaults.sql');

    expect(sql).toMatch(/INSERT INTO iam\.instance_deletion_rules/);
    expect(sql).toMatch(/\('de-musterhausen', 90, 180, 365, 'retain', false\)/);
    expect(sql).toMatch(/ON CONFLICT \(instance_id\) DO UPDATE/);
    expect(sql).toMatch(/default_content_strategy = EXCLUDED\.default_content_strategy/);
    expect(sql).toMatch(/allow_content_preference_override = EXCLUDED\.allow_content_preference_override/);
    expect(sql).toMatch(/updated_at = NOW\(\)/);
  });

  it('assigns the categories module to seeded instances with mainserver content modules', () => {
    const defaultSeedSql = readSeed('0001_iam_personas.sql');
    const bbGubenSeedSql = readSeed('0002_bb_guben_permissions.sql');

    expect(defaultSeedSql).toMatch(/\('de-musterhausen', 'categories'\)/);
    expect(bbGubenSeedSql).toMatch(/\('bb-guben', 'categories'\)/);
  });

  it('seeds iam.accounts.delete for fresh tenant bootstraps and grants it to system_admin', () => {
    const defaultSeedSql = readSeed('0001_iam_personas.sql');
    const bbGubenSeedSql = readSeed('0002_bb_guben_permissions.sql');

    expect(defaultSeedSql).toMatch(/'iam\.accounts\.delete', 'iam\.accounts\.delete', 'iam'/);
    expect(defaultSeedSql).toMatch(/\('system_admin', 'iam\.accounts\.delete'\)/);
    expect(bbGubenSeedSql).toMatch(/'iam\.accounts\.delete', 'iam\.accounts\.delete', 'iam'/);
    expect(bbGubenSeedSql).toMatch(/\('system_admin', 'iam\.accounts\.delete'\)/);
  });

  it('keeps deletion-rule seeds scoped to the existing retain lifecycle defaults', () => {
    const seedSql = readSeed('0003_iam_deletion_rules_defaults.sql');

    expect(seedSql).toMatch(/\('de-musterhausen', 90, 180, 365, 'retain', false\)/);
    expect(seedSql).toMatch(/default_content_strategy = EXCLUDED\.default_content_strategy/);
    expect(seedSql).toMatch(/allow_content_preference_override = EXCLUDED\.allow_content_preference_override/);
    expect(seedSql).not.toMatch(/hard[_-]?delete/i);
  });
});
