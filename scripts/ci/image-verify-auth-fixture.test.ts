import { expect, it } from 'vitest';

import { buildSeedSql, revokeMediaSql } from './image-verify-auth-fixture.ts';

it('seeds only the test tenant, OIDC identity, assigned optional SSF module, and two read grants', () => {
  const sql = buildSeedSql('enc:v1:k1:iv:tag:ciphertext');
  expect(sql).toContain("'example-instance.studio.example.invalid'");
  expect(sql).toContain("'verify-ssf-user', 'active', 'example-instance'");
  expect(sql).toContain("'ssf', 'optional', 'manual', true");
  expect(sql).toContain("'media.read', 'media.read', 'media'");
  expect(sql).toContain("'ssf.configuration.tenant.read', 'ssf.configuration.tenant.read', 'ssf'");
  expect(sql).not.toContain('verify-auth-client-secret');
  expect(revokeMediaSql).toContain('DELETE FROM iam.role_permissions');
  expect(revokeMediaSql).toContain("instance_id = 'example-instance'");
  expect(revokeMediaSql).toContain('INSERT INTO iam.permission_cache_instance_revisions');
  expect(() => buildSeedSql("ciphertext'; DROP TABLE iam.instances; --")).toThrow('invalid_verify_auth_ciphertext');
});
