export type LocalInstanceRegistryReconciliationInput = Readonly<{
  allowedInstanceIds: readonly string[];
  driftMode: 'fail' | 'warn';
  parentDomain: string;
  reconcileMode: 'authoritative' | 'preserve';
  tenantAuthClientId: string;
  tenantAdminClientId: string;
  tenantAuthRealmMode: 'instance-id' | 'keep';
}>;

export type LocalInstanceRegistryIdentityRow = Readonly<{
  auth_client_id: string | null;
  auth_realm: string | null;
  id: string;
  parent_domain: string | null;
  primary_hostname: string | null;
  tenant_admin_client_id: string | null;
}>;

export type LocalInstanceRegistryIdentityDrift = Readonly<{
  fields: readonly (
    | 'auth_client_id'
    | 'auth_realm'
    | 'parent_domain'
    | 'primary_hostname'
    | 'tenant_admin_client_id'
  )[];
  id: string;
}>;

const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;

const normalizeParentDomain = (value: string) => value.trim().toLowerCase();

const normalizeAllowedInstanceIds = (value: readonly string[]) =>
  value
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const normalizeMode = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T => {
  const normalized = value?.trim().toLowerCase();
  return normalized && allowed.includes(normalized as T) ? (normalized as T) : fallback;
};

export const buildLocalInstanceRegistryReconciliationInput = (
  env: NodeJS.ProcessEnv
): LocalInstanceRegistryReconciliationInput | null => {
  const parentDomain = normalizeParentDomain(env.SVA_PARENT_DOMAIN ?? '');
  const allowedInstanceIds = normalizeAllowedInstanceIds((env.SVA_ALLOWED_INSTANCE_IDS ?? '').split(','));

  if (parentDomain.length === 0 || allowedInstanceIds.length === 0) {
    return null;
  }

  const tenantAuthRealmMode = normalizeMode(env.SVA_LOCAL_TENANT_AUTH_REALM_MODE, ['instance-id', 'keep'], 'keep');

  return {
    allowedInstanceIds,
    driftMode: normalizeMode(env.SVA_LOCAL_INSTANCE_IDENTITY_DRIFT_MODE, ['warn', 'fail'], 'warn'),
    reconcileMode: normalizeMode(
      env.SVA_LOCAL_INSTANCE_IDENTITY_RECONCILE_MODE,
      ['preserve', 'authoritative'],
      'preserve'
    ),
    parentDomain,
    tenantAuthClientId: env.SVA_LOCAL_TENANT_AUTH_CLIENT_ID?.trim() || 'sva-studio-login',
    tenantAdminClientId: env.SVA_LOCAL_TENANT_ADMIN_CLIENT_ID?.trim() || 'sva-studio-realm-admin',
    tenantAuthRealmMode,
  };
};

const isNonEmpty = (value: string | null | undefined) => Boolean(value?.trim());

export const evaluateLocalInstanceRegistryIdentityDrift = (
  input: LocalInstanceRegistryReconciliationInput,
  rows: readonly LocalInstanceRegistryIdentityRow[]
): LocalInstanceRegistryIdentityDrift[] => {
  const expectedById = new Map(
    input.allowedInstanceIds.map((instanceId) => [
      instanceId,
      {
        auth_client_id: input.tenantAuthClientId,
        auth_realm: input.tenantAuthRealmMode === 'instance-id' ? instanceId : undefined,
        parent_domain: input.parentDomain,
        primary_hostname: `${instanceId}.${input.parentDomain}`,
        tenant_admin_client_id: input.tenantAdminClientId,
      },
    ])
  );

  return rows.flatMap((row) => {
    const expected = expectedById.get(row.id);
    if (!expected) {
      return [];
    }

    const fields: Array<
      'auth_client_id' | 'auth_realm' | 'parent_domain' | 'primary_hostname' | 'tenant_admin_client_id'
    > = [];

    if (isNonEmpty(row.parent_domain) && row.parent_domain !== expected.parent_domain) {
      fields.push('parent_domain');
    }
    if (isNonEmpty(row.primary_hostname) && row.primary_hostname !== expected.primary_hostname) {
      fields.push('primary_hostname');
    }
    if (isNonEmpty(row.auth_client_id) && row.auth_client_id !== expected.auth_client_id) {
      fields.push('auth_client_id');
    }
    if (expected.auth_realm && isNonEmpty(row.auth_realm) && row.auth_realm !== expected.auth_realm) {
      fields.push('auth_realm');
    }
    if (
      isNonEmpty(row.tenant_admin_client_id) &&
      row.tenant_admin_client_id !== expected.tenant_admin_client_id
    ) {
      fields.push('tenant_admin_client_id');
    }

    return fields.length > 0 ? [{ id: row.id, fields }] : [];
  });
};

export const buildLocalInstanceRegistryIdentitySelectSql = (
  input: Pick<LocalInstanceRegistryReconciliationInput, 'allowedInstanceIds'>
): string => `SELECT COALESCE(json_agg(row_to_json(instance_rows) ORDER BY instance_rows.id), '[]'::json)::text
FROM (
  SELECT id, parent_domain, primary_hostname, auth_client_id, auth_realm, tenant_admin_client_id
  FROM iam.instances
  WHERE id = ANY(ARRAY[${input.allowedInstanceIds.map((instanceId) => sqlLiteral(instanceId)).join(', ')}]::text[])
) AS instance_rows;`;

export const buildLocalInstanceRegistryReconciliationSql = (
  input: LocalInstanceRegistryReconciliationInput
): string => {
  const statements = input.allowedInstanceIds.flatMap((instanceId) => {
    const primaryHostname = `${instanceId}.${input.parentDomain}`;
    const authRealmAssignment =
      input.tenantAuthRealmMode === 'instance-id'
        ? input.reconcileMode === 'authoritative'
          ? `auth_realm = ${sqlLiteral(instanceId)},`
          : `auth_realm = COALESCE(NULLIF(auth_realm, ''), ${sqlLiteral(instanceId)}),`
        : '';
    const parentDomainAssignment =
      input.reconcileMode === 'authoritative'
        ? `parent_domain = ${sqlLiteral(input.parentDomain)},`
        : `parent_domain = COALESCE(NULLIF(parent_domain, ''), ${sqlLiteral(input.parentDomain)}),`;
    const primaryHostnameAssignment =
      input.reconcileMode === 'authoritative'
        ? `primary_hostname = ${sqlLiteral(primaryHostname)},`
        : `primary_hostname = COALESCE(NULLIF(primary_hostname, ''), ${sqlLiteral(primaryHostname)}),`;
    const authClientIdAssignment =
      input.reconcileMode === 'authoritative'
        ? `auth_client_id = ${sqlLiteral(input.tenantAuthClientId)},`
        : `auth_client_id = COALESCE(NULLIF(auth_client_id, ''), ${sqlLiteral(input.tenantAuthClientId)}),`;
    const tenantAdminClientIdAssignment =
      input.reconcileMode === 'authoritative'
        ? `tenant_admin_client_id = ${sqlLiteral(input.tenantAdminClientId)},`
        : `tenant_admin_client_id = COALESCE(NULLIF(tenant_admin_client_id, ''), ${sqlLiteral(input.tenantAdminClientId)}),`;

    return [
      `UPDATE iam.instances
SET ${parentDomainAssignment}
    ${primaryHostnameAssignment}
    ${authRealmAssignment}
    ${authClientIdAssignment}
    ${tenantAdminClientIdAssignment}
    updated_at = NOW()
WHERE id = ${sqlLiteral(instanceId)};`,
      `UPDATE iam.instance_hostnames
SET is_primary = false
WHERE instance_id = ${sqlLiteral(instanceId)}
  AND hostname <> ${sqlLiteral(primaryHostname)};`,
      `INSERT INTO iam.instance_hostnames (hostname, instance_id, is_primary, created_by)
VALUES (${sqlLiteral(primaryHostname)}, ${sqlLiteral(instanceId)}, true, 'runtime-env-local')
ON CONFLICT (hostname) DO UPDATE
SET instance_id = EXCLUDED.instance_id,
    is_primary = EXCLUDED.is_primary,
    created_by = EXCLUDED.created_by;`,
    ];
  });

  return `BEGIN;
${statements.join('\n')}
COMMIT;
`;
};
