import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSeed = (name: string) => readFileSync(resolve('packages/data/seeds', name), 'utf8');

describe('iam seed sql contracts', () => {
  it('keeps protected instance identity fields in 0001 additive for existing environments', () => {
    const sql = readSeed('0001_iam_personas.sql');

    assert.match(sql, /parent_domain = COALESCE\(NULLIF\(iam\.instances\.parent_domain, ''\), EXCLUDED\.parent_domain\)/);
    assert.match(
      sql,
      /primary_hostname = COALESCE\(NULLIF\(iam\.instances\.primary_hostname, ''\), EXCLUDED\.primary_hostname\)/
    );
    assert.match(sql, /auth_realm = COALESCE\(NULLIF\(iam\.instances\.auth_realm, ''\), EXCLUDED\.auth_realm\)/);
    assert.match(
      sql,
      /auth_client_id = COALESCE\(NULLIF\(iam\.instances\.auth_client_id, ''\), EXCLUDED\.auth_client_id\)/
    );
    assert.match(
      sql,
      /tenant_admin_client_id = COALESCE\(NULLIF\(iam\.instances\.tenant_admin_client_id, ''\), EXCLUDED\.tenant_admin_client_id\)/
    );
    assert.doesNotMatch(sql, /parent_domain = EXCLUDED\.parent_domain,/);
    assert.doesNotMatch(sql, /primary_hostname = EXCLUDED\.primary_hostname,/);
    assert.doesNotMatch(sql, /auth_realm = EXCLUDED\.auth_realm,/);
    assert.doesNotMatch(sql, /auth_client_id = EXCLUDED\.auth_client_id,/);
    assert.doesNotMatch(sql, /tenant_admin_client_id = EXCLUDED\.tenant_admin_client_id,/);
    assert.match(
      sql,
      /instances\.primary_hostname = 'de-musterhausen\.studio\.localhost'/
    );
    assert.match(
      sql,
      /AND instances\.primary_hostname = EXCLUDED\.hostname/
    );
  });

  it('seeds de-musterhausen with the local-keycloak reference identity by default', () => {
    const sql = readSeed('0001_iam_personas.sql');

    assert.match(
      sql,
      /VALUES\s*\(\s*'de-musterhausen',\s*'Seed Instance Default',\s*'active',\s*'studio\.localhost',\s*'de-musterhausen\.studio\.localhost',\s*'de-musterhausen',\s*'sva-studio',\s*'sva-studio-realm-admin',\s*'\{\}'::jsonb\s*\)/
    );
    assert.doesNotMatch(sql, /'de-musterhausen\.studio\.smart-village\.app'/);
    assert.doesNotMatch(sql, /'svs-intern-studio-staging'/);
    assert.doesNotMatch(sql, /'sva-studio-admin'/);
  });

  it('keeps 0002 non-destructive for an already provisioned instance identity', () => {
    const sql = readSeed('0002_bb_guben_permissions.sql');

    assert.match(sql, /ON CONFLICT \(id\) DO NOTHING;/);
    assert.doesNotMatch(sql, /ON CONFLICT \(id\) DO UPDATE/);
    assert.doesNotMatch(sql, /parent_domain = EXCLUDED\.parent_domain,/);
    assert.doesNotMatch(sql, /primary_hostname = EXCLUDED\.primary_hostname,/);
    assert.doesNotMatch(sql, /auth_realm = EXCLUDED\.auth_realm,/);
    assert.doesNotMatch(sql, /auth_client_id = EXCLUDED\.auth_client_id,/);
    assert.doesNotMatch(sql, /tenant_admin_client_id = EXCLUDED\.tenant_admin_client_id,/);
  });

  it('does not keep a tenant-side instance_registry_admin persona in 0001 anymore', () => {
    const sql = readSeed('0001_iam_personas.sql');

    assert.doesNotMatch(sql, /'seed:instance_registry_admin'/);
    assert.doesNotMatch(sql, /'30188888-8888-8888-8888-888888888888', 'de-musterhausen', 'instance_registry_admin'/);
    assert.doesNotMatch(sql, /\('de-musterhausen', '50888888-8888-8888-8888-888888888888', 'member'\)/);
    assert.doesNotMatch(sql, /\('de-musterhausen', '50888888-8888-8888-8888-888888888888', '30188888-8888-8888-8888-888888888888'\)/);
    assert.doesNotMatch(sql, /\('instance_registry_admin', 'instance\.registry\.manage'\)/);
    assert.doesNotMatch(sql, /\('instance_registry_admin', 'feature\.toggle'\)/);
    assert.doesNotMatch(sql, /\('instance_registry_admin', 'integration\.manage'\)/);
    assert.doesNotMatch(sql, /'seed:app_manager'/);
    assert.doesNotMatch(sql, /'seed:feature_manager'/);
    assert.doesNotMatch(sql, /'seed:interface_manager'/);
    assert.doesNotMatch(sql, /'seed:designer'/);
    assert.doesNotMatch(sql, /'seed:editor'/);
    assert.doesNotMatch(sql, /'seed:moderator'/);
    assert.doesNotMatch(sql, /'app_manager'/);
    assert.doesNotMatch(sql, /'feature-manager'/);
    assert.doesNotMatch(sql, /'interface-manager'/);
    assert.doesNotMatch(sql, /'designer'/);
    assert.doesNotMatch(sql, /'editor'/);
    assert.doesNotMatch(sql, /'moderator'/);
  });

  it('expects the deletion-rules seed to create tenant defaults', () => {
    const sql = readSeed('0003_iam_deletion_rules_defaults.sql');

    assert.match(sql, /INSERT INTO iam\.instance_deletion_rules/);
    assert.match(sql, /\('de-musterhausen', 90, 180, 365, 'retain', false\)/);
    assert.match(sql, /ON CONFLICT \(instance_id\) DO UPDATE/);
    assert.match(sql, /default_content_strategy = EXCLUDED\.default_content_strategy/);
    assert.match(sql, /allow_content_preference_override = EXCLUDED\.allow_content_preference_override/);
    assert.match(sql, /updated_at = NOW\(\)/);
  });
});
