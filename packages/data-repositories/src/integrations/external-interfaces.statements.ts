import type {
  ExternalInterfaceConnectionCheckRecord,
  ExternalInterfaceRecord,
  ExternalInterfaceTypeDefinition,
} from '@sva/core';

import type { SqlStatement } from '../iam/repositories/types.js';

const baseSelectInterfaceColumns = `
SELECT
  id,
  instance_id,
  type_key,
  owner_kind,
  owner_id,
  display_name,
  alias,
  enabled,
  is_default,
  category,
  base_url,
  auth_mode,
  public_config_json,
  secret_config_ciphertext,
  status_check_kind,
  visible_status,
  last_checked_at,
  last_check_status,
  last_check_error_code,
  last_check_error_message,
  created_at,
  updated_at
FROM iam.instance_external_interfaces
`;

const selectTypesStatement = (): SqlStatement => ({
  text: `
SELECT
  type_key,
  owner_kind,
  owner_id,
  display_name,
  category,
  public_schema_json,
  secret_schema_json,
  status_check_kind,
  enabled
FROM iam.external_interface_types
WHERE enabled = true
ORDER BY owner_kind ASC, type_key ASC;
`,
  values: [],
});

const upsertTypeStatement = (input: ExternalInterfaceTypeDefinition): SqlStatement => ({
  text: `
INSERT INTO iam.external_interface_types (
  type_key,
  owner_kind,
  owner_id,
  display_name,
  category,
  public_schema_json,
  secret_schema_json,
  status_check_kind,
  enabled
)
VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
ON CONFLICT (type_key) DO UPDATE
SET owner_kind = EXCLUDED.owner_kind,
    owner_id = EXCLUDED.owner_id,
    display_name = EXCLUDED.display_name,
    category = EXCLUDED.category,
    public_schema_json = EXCLUDED.public_schema_json,
    secret_schema_json = EXCLUDED.secret_schema_json,
    status_check_kind = EXCLUDED.status_check_kind,
    enabled = EXCLUDED.enabled,
    updated_at = NOW();
`,
  values: [
    input.typeKey,
    input.ownerKind,
    input.ownerId,
    input.displayName,
    input.category,
    JSON.stringify(input.publicSchema),
    JSON.stringify(input.secretSchema),
    input.statusCheckKind,
    input.enabled,
  ],
});

const listByInstanceStatement = (instanceId: string): SqlStatement => ({
  text: `
${baseSelectInterfaceColumns}
WHERE instance_id = $1
ORDER BY type_key ASC, is_default DESC, alias ASC;
`,
  values: [instanceId],
});

const getByIdStatement = (instanceId: string, id: string): SqlStatement => ({
  text: `
${baseSelectInterfaceColumns}
WHERE instance_id = $1
  AND id = $2
LIMIT 1;
`,
  values: [instanceId, id],
});

const getByAliasStatement = (instanceId: string, typeKey: string, alias: string): SqlStatement => ({
  text: `
${baseSelectInterfaceColumns}
WHERE instance_id = $1
  AND type_key = $2
  AND alias = $3
LIMIT 1;
`,
  values: [instanceId, typeKey, alias],
});

const getDefaultStatement = (instanceId: string, typeKey: string): SqlStatement => ({
  text: `
${baseSelectInterfaceColumns}
WHERE instance_id = $1
  AND type_key = $2
  AND is_default = true
LIMIT 1;
`,
  values: [instanceId, typeKey],
});

const upsertStatement = (input: ExternalInterfaceRecord): SqlStatement => ({
  text: `
WITH clear_defaults AS (
  UPDATE iam.instance_external_interfaces
  SET is_default = false,
      updated_at = NOW()
  WHERE instance_id = $1
    AND type_key = $3
    AND id <> $2
    AND $8 = true
)
INSERT INTO iam.instance_external_interfaces (
  id,
  instance_id,
  type_key,
  owner_kind,
  owner_id,
  display_name,
  alias,
  enabled,
  is_default,
  category,
  base_url,
  auth_mode,
  public_config_json,
  secret_config_ciphertext,
  status_check_kind,
  visible_status,
  last_checked_at,
  last_check_status,
  last_check_error_code,
  last_check_error_message
)
VALUES ($2, $1, $3, $4, $5, $6, $7, $9, $8, $10, $11, $12, $13::jsonb, $14, $15, $16, $17, $18, $19, $20)
ON CONFLICT (id) DO UPDATE
SET type_key = EXCLUDED.type_key,
    owner_kind = EXCLUDED.owner_kind,
    owner_id = EXCLUDED.owner_id,
    display_name = EXCLUDED.display_name,
    alias = EXCLUDED.alias,
    enabled = EXCLUDED.enabled,
    is_default = EXCLUDED.is_default,
    category = EXCLUDED.category,
    base_url = EXCLUDED.base_url,
    auth_mode = EXCLUDED.auth_mode,
    public_config_json = EXCLUDED.public_config_json,
    secret_config_ciphertext = EXCLUDED.secret_config_ciphertext,
    status_check_kind = EXCLUDED.status_check_kind,
    visible_status = EXCLUDED.visible_status,
    last_checked_at = EXCLUDED.last_checked_at,
    last_check_status = EXCLUDED.last_check_status,
    last_check_error_code = EXCLUDED.last_check_error_code,
    last_check_error_message = EXCLUDED.last_check_error_message,
    updated_at = NOW();
`,
  values: [
    input.instanceId,
    input.id,
    input.typeKey,
    input.ownerKind,
    input.ownerId,
    input.displayName,
    input.alias,
    input.isDefault,
    input.enabled,
    input.category,
    input.baseUrl ?? null,
    input.authMode ?? null,
    JSON.stringify(input.publicConfig),
    input.secretConfigCiphertext ?? null,
    input.statusCheckKind,
    input.visibleStatus,
    input.lastCheckedAt ?? null,
    input.lastCheckStatus ?? null,
    input.lastCheckErrorCode ?? null,
    input.lastCheckErrorMessage ?? null,
  ],
});

const deleteStatement = (instanceId: string, id: string): SqlStatement => ({
  text: `
DELETE FROM iam.instance_external_interfaces
WHERE instance_id = $1
  AND id = $2;
`,
  values: [instanceId, id],
});

const updateConnectionCheckStatement = (input: ExternalInterfaceConnectionCheckRecord): SqlStatement => ({
  text: `
UPDATE iam.instance_external_interfaces
SET visible_status = $3,
    last_checked_at = $4,
    last_check_status = $5,
    last_check_error_code = $6,
    last_check_error_message = $7,
    updated_at = NOW()
WHERE instance_id = $1
  AND id = $2;
`,
  values: [
    input.instanceId,
    input.interfaceId,
    input.visibleStatus,
    input.checkedAt,
    input.checkStatus,
    input.errorCode ?? null,
    input.errorMessage ?? null,
  ],
});

export const externalInterfaceStatements = {
  listTypes: selectTypesStatement,
  upsertType: upsertTypeStatement,
  listByInstance: listByInstanceStatement,
  getById: getByIdStatement,
  getByAlias: getByAliasStatement,
  getDefault: getDefaultStatement,
  upsert: upsertStatement,
  deleteById: deleteStatement,
  updateConnectionCheck: updateConnectionCheckStatement,
} as const;
