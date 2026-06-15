import type { SqlExecutor, SqlPrimitive } from '../iam/repositories/types.js';

import type { InstanceRegistryRepository } from './repository-contract.js';
import { buildInstanceSelectColumns, upsertPrimaryHostnameSql } from './repository-instance-select.js';
import { mapInstance } from './repository-mappers.js';
import { queryRows, statement } from './repository-shared.js';
import type { InstanceListRow } from './repository-types.js';

type MutationRepository = Pick<InstanceRegistryRepository, 'createInstance' | 'updateInstance' | 'setInstanceStatus'>;

const defaultActorId = (actorId: string | undefined): string => actorId ?? 'system';

const upsertPrimaryHostname = async (
  executor: SqlExecutor,
  hostname: string,
  instanceId: string,
  actorId: string | undefined
): Promise<void> => {
  await executor.execute({
    text: upsertPrimaryHostnameSql,
    values: [hostname, instanceId, defaultActorId(actorId)],
  });
};

const createInstanceValues = (input: Parameters<MutationRepository['createInstance']>[0]): readonly SqlPrimitive[] => [
  input.instanceId,
  input.displayName,
  input.status,
  input.parentDomain,
  input.primaryHostname,
  input.realmMode,
  input.authRealm,
  input.authClientId,
  input.authIssuerUrl ?? null,
  input.authClientSecretCiphertext ?? null,
  input.tenantAdminClient?.clientId ?? null,
  input.tenantAdminClient?.secretCiphertext ?? null,
  input.tenantAdminBootstrap?.username ?? null,
  input.tenantAdminBootstrap?.email ?? null,
  input.tenantAdminBootstrap?.firstName ?? null,
  input.tenantAdminBootstrap?.lastName ?? null,
  input.themeKey ?? null,
  JSON.stringify(input.featureFlags ?? {}),
  input.mainserverConfigRef ?? null,
  defaultActorId(input.actorId),
];

const updateInstanceValues = (input: Parameters<MutationRepository['updateInstance']>[0]): readonly SqlPrimitive[] => [
  input.instanceId,
  input.displayName,
  input.parentDomain,
  input.primaryHostname,
  input.realmMode,
  input.authRealm,
  input.authClientId,
  input.authIssuerUrl ?? null,
  input.keepExistingAuthClientSecret !== false && typeof input.authClientSecretCiphertext === 'undefined',
  input.authClientSecretCiphertext ?? null,
  input.tenantAdminClient?.clientId ?? null,
  input.keepExistingTenantAdminClientSecret !== false && typeof input.tenantAdminClient?.secretCiphertext === 'undefined',
  input.tenantAdminClient?.secretCiphertext ?? null,
  input.tenantAdminBootstrap?.username ?? null,
  input.tenantAdminBootstrap?.email ?? null,
  input.tenantAdminBootstrap?.firstName ?? null,
  input.tenantAdminBootstrap?.lastName ?? null,
  input.themeKey ?? null,
  JSON.stringify(input.featureFlags ?? {}),
  input.mainserverConfigRef ?? null,
  defaultActorId(input.actorId),
];

const createInstance = async (executor: SqlExecutor, input: Parameters<MutationRepository['createInstance']>[0]) => {
  const rows = await queryRows<InstanceListRow>(
    executor,
    {
      text: `
INSERT INTO iam.instances (
  id, display_name, status, parent_domain, primary_hostname, realm_mode, auth_realm, auth_client_id,
  auth_issuer_url, auth_client_secret_ciphertext, tenant_admin_client_id, tenant_admin_client_secret_ciphertext,
  tenant_admin_username, tenant_admin_email, tenant_admin_first_name, tenant_admin_last_name, theme_key,
  feature_flags, mainserver_config_ref, created_by, updated_by
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::jsonb, $20, $20)
ON CONFLICT (id) DO NOTHING
RETURNING
${buildInstanceSelectColumns()};
`,
      values: createInstanceValues(input),
    }
  );
  if (!rows[0]) {
    return null;
  }
  await upsertPrimaryHostname(executor, input.primaryHostname, input.instanceId, input.actorId);
  return mapInstance(rows[0]);
};

const updateInstance = async (executor: SqlExecutor, input: Parameters<MutationRepository['updateInstance']>[0]) => {
  const rows = await queryRows<InstanceListRow>(
    executor,
    statement(
      `
UPDATE iam.instances
SET
  display_name = $2,
  parent_domain = $3,
  primary_hostname = $4,
  realm_mode = $5,
  auth_realm = $6,
  auth_client_id = $7,
  auth_issuer_url = $8,
  auth_client_secret_ciphertext = CASE WHEN $9::boolean THEN auth_client_secret_ciphertext ELSE $10 END,
  tenant_admin_client_id = $11,
  tenant_admin_client_secret_ciphertext = CASE WHEN $12::boolean THEN tenant_admin_client_secret_ciphertext ELSE $13 END,
  tenant_admin_username = $14,
  tenant_admin_email = $15,
  tenant_admin_first_name = $16,
  tenant_admin_last_name = $17,
  theme_key = $18,
  feature_flags = $19::jsonb,
  mainserver_config_ref = $20,
  updated_by = $21,
  updated_at = NOW()
WHERE id = $1
RETURNING
${buildInstanceSelectColumns()};
`,
      updateInstanceValues(input)
    )
  );
  if (!rows[0]) {
    return null;
  }
  await upsertPrimaryHostname(executor, input.primaryHostname, input.instanceId, input.actorId);
  return mapInstance(rows[0]);
};

const setInstanceStatus = async (
  executor: SqlExecutor,
  input: Parameters<MutationRepository['setInstanceStatus']>[0]
) => {
  const rows = await queryRows<InstanceListRow>(
    executor,
    statement(
      `
UPDATE iam.instances
SET
  status = $2,
  updated_by = $3,
  updated_at = NOW()
WHERE id = $1
RETURNING
${buildInstanceSelectColumns()};
`,
      [input.instanceId, input.status, defaultActorId(input.actorId)]
    )
  );
  return rows[0] ? mapInstance(rows[0]) : null;
};

export const createMutationRepository = (executor: SqlExecutor): MutationRepository => ({
  createInstance: (input) => createInstance(executor, input),
  updateInstance: (input) => updateInstance(executor, input),
  setInstanceStatus: (input) => setInstanceStatus(executor, input),
});
