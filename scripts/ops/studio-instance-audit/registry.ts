import type { AuditRegistryTarget } from './model.ts';
type RegistryRow = Readonly<Record<string, string | boolean | null>>;

const readRequiredString = (
  row: RegistryRow,
  key: string,
): string => {
  const value = row[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Registry-Feld ${key} fehlt.`);
  }
  return value;
};

const readOptionalString = (row: RegistryRow, key: string): string | undefined => {
  const value = row[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
};

const readBoolean = (row: RegistryRow, key: string): boolean => row[key] === true;

export const loadAuditTargets = async (client: {
  queryRows: (sql: string) => Promise<readonly RegistryRow[]>;
}): Promise<readonly AuditRegistryTarget[]> => {
  const rows = await client.queryRows(`
SELECT
  id AS instance_id,
  display_name,
  primary_hostname,
  parent_domain,
  auth_realm,
  auth_client_id,
  status,
  tenant_admin_client_id,
  tenant_admin_username,
  tenant_admin_email,
  tenant_admin_first_name,
  tenant_admin_last_name,
  (auth_client_secret_ciphertext IS NOT NULL AND BTRIM(auth_client_secret_ciphertext) <> '') AS auth_client_secret_configured,
  (
    tenant_admin_client_secret_ciphertext IS NOT NULL
    AND BTRIM(tenant_admin_client_secret_ciphertext) <> ''
  ) AS tenant_admin_client_secret_configured
FROM iam.instances
WHERE status = 'active'
ORDER BY id ASC;
`);

  return rows.map((row) => ({
    authClientSecretConfigured: readBoolean(row, 'auth_client_secret_configured'),
    authClientId: readRequiredString(row, 'auth_client_id'),
    authRealm: readRequiredString(row, 'auth_realm'),
    displayName: readRequiredString(row, 'display_name'),
    instanceId: readRequiredString(row, 'instance_id'),
    parentDomain: readRequiredString(row, 'parent_domain'),
    primaryHostname: readRequiredString(row, 'primary_hostname'),
    status: readRequiredString(row, 'status'),
    tenantAdminClientId: readRequiredString(row, 'tenant_admin_client_id'),
    tenantAdminClientSecretConfigured: readBoolean(row, 'tenant_admin_client_secret_configured'),
    tenantAdminEmail: readOptionalString(row, 'tenant_admin_email'),
    tenantAdminFirstName: readOptionalString(row, 'tenant_admin_first_name'),
    tenantAdminLastName: readOptionalString(row, 'tenant_admin_last_name'),
    tenantAdminUsername: readOptionalString(row, 'tenant_admin_username'),
  }));
};
