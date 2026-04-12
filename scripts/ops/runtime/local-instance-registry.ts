export type LocalInstanceRegistryReconciliationInput = Readonly<{
  allowedInstanceIds: readonly string[];
  parentDomain: string;
  tenantAuthClientId: string;
  tenantAuthRealmMode: 'instance-id' | 'keep';
}>;

const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;

const normalizeParentDomain = (value: string) => value.trim().toLowerCase();

const normalizeAllowedInstanceIds = (value: readonly string[]) =>
  value
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

export const buildLocalInstanceRegistryReconciliationInput = (
  env: NodeJS.ProcessEnv
): LocalInstanceRegistryReconciliationInput | null => {
  const parentDomain = normalizeParentDomain(env.SVA_PARENT_DOMAIN ?? '');
  const allowedInstanceIds = normalizeAllowedInstanceIds((env.SVA_ALLOWED_INSTANCE_IDS ?? '').split(','));

  if (parentDomain.length === 0 || allowedInstanceIds.length === 0) {
    return null;
  }

  const tenantAuthRealmMode = (env.SVA_LOCAL_TENANT_AUTH_REALM_MODE?.trim().toLowerCase() ?? 'keep') === 'instance-id'
    ? 'instance-id'
    : 'keep';

  return {
    allowedInstanceIds,
    parentDomain,
    tenantAuthClientId: env.SVA_LOCAL_TENANT_AUTH_CLIENT_ID?.trim() || 'sva-studio',
    tenantAuthRealmMode,
  };
};

export const buildLocalInstanceRegistryReconciliationSql = (
  input: LocalInstanceRegistryReconciliationInput
): string => {
  const statements = input.allowedInstanceIds.flatMap((instanceId) => {
    const primaryHostname = `${instanceId}.${input.parentDomain}`;
    const authRealmAssignment =
      input.tenantAuthRealmMode === 'instance-id'
        ? `auth_realm = ${sqlLiteral(instanceId)},`
        : '';

    return [
      `UPDATE iam.instances
SET parent_domain = ${sqlLiteral(input.parentDomain)},
    primary_hostname = ${sqlLiteral(primaryHostname)},
    ${authRealmAssignment}
    auth_client_id = COALESCE(NULLIF(auth_client_id, ''), ${sqlLiteral(input.tenantAuthClientId)}),
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
