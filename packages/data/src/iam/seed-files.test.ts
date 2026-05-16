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
      /instances\.primary_hostname = 'de-musterhausen\.studio\.smart-village\.app'/
    );
    assert.match(
      sql,
      /AND instances\.primary_hostname = EXCLUDED\.hostname/
    );
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
});
