import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import {
  encryptFieldValue,
  parseFieldEncryptionConfigFromEnv,
} from '../../packages/core/src/security/field-encryption.js';

const instanceId = 'example-instance';
const accountId = '66111111-1111-4111-8111-111111111111';
const roleId = '66222222-2222-4222-8222-222222222222';
const mediaPermissionId = '66333333-3333-4333-8333-333333333333';
const ssfPermissionId = '66444444-4444-4444-8444-444444444444';

export const buildSeedSql = (authSecretCiphertext: string): string => {
  if (!/^enc:v1:[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+){3}$/u.test(authSecretCiphertext)) {
    throw new Error('invalid_verify_auth_ciphertext');
  }
  return `
BEGIN;
INSERT INTO iam.instances (
  id, display_name, status, parent_domain, primary_hostname, auth_realm,
  auth_client_id, auth_client_secret_ciphertext, tenant_admin_client_id
) VALUES (
  '${instanceId}', 'Image Verify Tenant', 'active', 'studio.example.invalid',
  '${instanceId}.studio.example.invalid', '${instanceId}', 'sva-studio',
  '${authSecretCiphertext}', 'sva-studio-realm-admin'
);
INSERT INTO iam.instance_hostnames (hostname, instance_id, is_primary, created_by)
VALUES ('${instanceId}.studio.example.invalid', '${instanceId}', true, 'image-verify');
INSERT INTO iam.accounts (id, keycloak_subject, status, instance_id)
VALUES ('${accountId}', 'verify-ssf-user', 'active', '${instanceId}');
INSERT INTO iam.instance_memberships (instance_id, account_id)
VALUES ('${instanceId}', '${accountId}');
INSERT INTO iam.roles (
  id, instance_id, role_key, role_name, display_name, external_role_name, is_system_role
) VALUES (
  '${roleId}', '${instanceId}', 'image_verify_reader', 'image_verify_reader',
  'Image Verify Reader', 'image_verify_reader', false
);
INSERT INTO iam.permissions (id, instance_id, permission_key, action, resource_type)
VALUES
  ('${mediaPermissionId}', '${instanceId}', 'media.read', 'media.read', 'media'),
  ('${ssfPermissionId}', '${instanceId}', 'ssf.configuration.tenant.read', 'ssf.configuration.tenant.read', 'ssf');
INSERT INTO iam.account_roles (instance_id, account_id, role_id)
VALUES ('${instanceId}', '${accountId}', '${roleId}');
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
VALUES
  ('${instanceId}', '${roleId}', '${mediaPermissionId}'),
  ('${instanceId}', '${roleId}', '${ssfPermissionId}');
INSERT INTO iam.instance_modules (instance_id, module_id, activation_policy, activation_origin, effective_active)
VALUES
  ('${instanceId}', 'media', 'optional', 'manual', true),
  ('${instanceId}', 'ssf', 'optional', 'manual', true);
COMMIT;
`;
};

const withPermissionRevision = (mutation: string): string => `
BEGIN;
${mutation}
INSERT INTO iam.permission_cache_instance_revisions (instance_id, revision)
VALUES ('${instanceId}', 2)
ON CONFLICT (instance_id) DO UPDATE
SET revision = iam.permission_cache_instance_revisions.revision + 1, updated_at = NOW();
COMMIT;
`;

export const revokeMediaSql = withPermissionRevision(`
DELETE FROM iam.role_permissions
WHERE instance_id = '${instanceId}'
  AND role_id = '${roleId}'
  AND permission_id = '${mediaPermissionId}';
`);

const restoreGrantSql = (permissionId: string): string => withPermissionRevision(`
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
VALUES ('${instanceId}', '${roleId}', '${permissionId}');
`);

const run = (mode: string, containerName: string): void => {
  if (!/^studio-image-verify-[0-9]+-postgres$/u.test(containerName)) {
    throw new Error('invalid_verify_postgres_container');
  }
  let sql: string;
  if (mode === 'seed') {
    const encryptionConfig = parseFieldEncryptionConfigFromEnv(process.env);
    if (!encryptionConfig) throw new Error('verify_pii_keyring_missing');
    const ciphertext = encryptFieldValue(
      'verify-auth-client-secret',
      encryptionConfig,
      `iam.instances.auth_client_secret:${instanceId}`
    );
    sql = buildSeedSql(ciphertext);
  } else if (mode === 'revoke-media') {
    sql = revokeMediaSql;
  } else if (mode === 'restore-media') {
    sql = restoreGrantSql(mediaPermissionId);
  } else {
    throw new Error('invalid_verify_fixture_mode');
  }

  const result = spawnSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'sva', '-d', 'sva_studio'],
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'ignore', 'pipe'] }
  );
  if (result.status !== 0) throw new Error('verify_auth_fixture_sql_failed');
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv[2] || '', process.argv[3] || '');
}
