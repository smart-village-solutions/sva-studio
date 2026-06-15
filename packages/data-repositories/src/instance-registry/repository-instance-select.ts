const qualify = (alias: string | undefined, column: string): string => (alias ? `${alias}.${column}` : column);

export const buildInstanceSelectColumns = (alias?: string): string => {
  const id = qualify(alias, 'id');
  return `
  ${id} AS instance_id,
  ${qualify(alias, 'display_name')},
  ${qualify(alias, 'status')},
  ${qualify(alias, 'parent_domain')},
  ${qualify(alias, 'primary_hostname')},
  ${qualify(alias, 'realm_mode')},
  ${qualify(alias, 'auth_realm')},
  ${qualify(alias, 'auth_client_id')},
  ${qualify(alias, 'auth_issuer_url')},
  ${qualify(alias, 'auth_client_secret_ciphertext')},
  ${qualify(alias, 'tenant_admin_client_id')},
  ${qualify(alias, 'tenant_admin_client_secret_ciphertext')},
  ${qualify(alias, 'tenant_admin_username')},
  ${qualify(alias, 'tenant_admin_email')},
  ${qualify(alias, 'tenant_admin_first_name')},
  ${qualify(alias, 'tenant_admin_last_name')},
  ${qualify(alias, 'theme_key')},
  (
    SELECT COALESCE(array_agg(module_id ORDER BY module_id), ARRAY[]::text[])
    FROM iam.instance_modules
    WHERE instance_id = ${id}
  ) AS assigned_module_ids,
  ${qualify(alias, 'feature_flags')},
  ${qualify(alias, 'mainserver_config_ref')},
  ${qualify(alias, 'created_at')}::text AS created_at,
  ${qualify(alias, 'created_by')},
  ${qualify(alias, 'updated_at')}::text AS updated_at,
  ${qualify(alias, 'updated_by')}`;
};

export const upsertPrimaryHostnameSql = `
INSERT INTO iam.instance_hostnames (hostname, instance_id, is_primary, created_by)
VALUES ($1, $2, true, $3)
ON CONFLICT (hostname) DO UPDATE
SET
  instance_id = EXCLUDED.instance_id,
  is_primary = EXCLUDED.is_primary;
`;
