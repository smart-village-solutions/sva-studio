import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

type BindLocalUserCliOptions = {
  copyFromKeycloakSubject?: string;
  dryRun: boolean;
  iamDatabaseUrl: string;
  instanceId: string;
  keycloakSubject: string;
  organizationIds: readonly string[];
  roleKeys: readonly string[];
};

const usage = () => `Usage: tsx scripts/ops/bind-local-user.ts \\
  --instance-id=<id> \\
  --keycloak-subject=<subject> \\
  [--copy-from-keycloak-subject=<subject>] \\
  [--role-keys=system_admin,pw1] \\
  [--organization-ids=<uuid>,<uuid>] \\
  [--iam-database-url=postgres://...] \\
  [--dry-run]
`;

const parseCsv = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const readOptionValue = (entry: string) => {
  const separatorIndex = entry.indexOf('=');
  if (separatorIndex === -1) {
    return null;
  }

  return {
    key: entry.slice(2, separatorIndex),
    value: entry.slice(separatorIndex + 1),
  };
};

const parseArgs = (argv: readonly string[]): BindLocalUserCliOptions => {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (const entry of argv) {
    if (!entry.startsWith('--')) {
      throw new Error(`Ungültiges Argument: ${entry}`);
    }

    const option = readOptionValue(entry);
    if (!option) {
      flags.add(entry.slice(2));
      continue;
    }

    values.set(option.key, option.value);
  }

  const instanceId = values.get('instance-id')?.trim();
  const keycloakSubject = values.get('keycloak-subject')?.trim();
  const iamDatabaseUrl =
    values.get('iam-database-url')?.trim() ||
    process.env.IAM_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    '';

  if (!instanceId) {
    throw new Error('Fehlende Option --instance-id=...');
  }
  if (!keycloakSubject) {
    throw new Error('Fehlende Option --keycloak-subject=...');
  }
  if (!iamDatabaseUrl) {
    throw new Error('Fehlende IAM_DATABASE_URL oder Option --iam-database-url=...');
  }

  return {
    copyFromKeycloakSubject: values.get('copy-from-keycloak-subject')?.trim() || undefined,
    dryRun: flags.has('dry-run'),
    iamDatabaseUrl,
    instanceId,
    keycloakSubject,
    organizationIds: parseCsv(values.get('organization-ids')),
    roleKeys: parseCsv(values.get('role-keys')),
  };
};

const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;

const runPsql = (databaseUrl: string, sql: string): string => {
  const result = spawnSync(
    'psql',
    [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-Atc', sql],
    {
      encoding: 'utf8',
    }
  );

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || 'psql execution failed');
  }

  return result.stdout.trim();
};

const loadSourceBindings = (input: {
  copyFromKeycloakSubject: string;
  iamDatabaseUrl: string;
  instanceId: string;
}): { organizationIds: string[]; roleKeys: string[] } => {
  const sql = `
SELECT json_build_object(
  'role_keys', COALESCE((
    SELECT json_agg(DISTINCT r.role_key ORDER BY r.role_key)
    FROM iam.accounts a
    JOIN iam.account_roles ar
      ON ar.account_id = a.id
     AND ar.instance_id = a.instance_id
     AND ar.valid_from <= NOW()
     AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
    JOIN iam.roles r
      ON r.instance_id = ar.instance_id
     AND r.id = ar.role_id
    WHERE a.instance_id = ${sqlLiteral(input.instanceId)}
      AND a.keycloak_subject = ${sqlLiteral(input.copyFromKeycloakSubject)}
  ), '[]'::json),
  'organization_ids', COALESCE((
    SELECT json_agg(DISTINCT ao.organization_id ORDER BY ao.organization_id)
    FROM iam.accounts a
    JOIN iam.account_organizations ao
      ON ao.account_id = a.id
     AND ao.instance_id = a.instance_id
    WHERE a.instance_id = ${sqlLiteral(input.instanceId)}
      AND a.keycloak_subject = ${sqlLiteral(input.copyFromKeycloakSubject)}
  ), '[]'::json)
)::text;
`;

  const raw = runPsql(input.iamDatabaseUrl, sql);
  const parsed = JSON.parse(raw || '{}') as {
    organization_ids?: string[];
    role_keys?: string[];
  };

  return {
    organizationIds: parsed.organization_ids ?? [],
    roleKeys: parsed.role_keys ?? [],
  };
};

const buildExecutionSql = (input: {
  dryRun: boolean;
  instanceId: string;
  keycloakSubject: string;
  organizationIds: readonly string[];
  roleKeys: readonly string[];
}): string => {
  const roleKeyArray =
    input.roleKeys.length > 0
      ? `ARRAY[${input.roleKeys.map((entry) => sqlLiteral(entry)).join(', ')}]::text[]`
      : 'ARRAY[]::text[]';
  const organizationIdArray =
    input.organizationIds.length > 0
      ? `ARRAY[${input.organizationIds.map((entry) => `${sqlLiteral(entry)}::uuid`).join(', ')}]::uuid[]`
      : 'ARRAY[]::uuid[]';

  return `
WITH target_account AS (
  SELECT a.id
  FROM iam.accounts a
  WHERE a.instance_id = ${sqlLiteral(input.instanceId)}
    AND a.keycloak_subject = ${sqlLiteral(input.keycloakSubject)}
  LIMIT 1
),
target_membership AS (
  ${input.dryRun ? 'SELECT NULL::uuid AS account_id WHERE FALSE' : `INSERT INTO iam.instance_memberships (instance_id, account_id, membership_type)
  SELECT ${sqlLiteral(input.instanceId)}, id, 'member'
  FROM target_account
  ON CONFLICT (instance_id, account_id) DO NOTHING
  RETURNING account_id`}
),
resolved_account AS (
  SELECT id AS account_id FROM target_account
),
resolved_roles AS (
  SELECT r.id
  FROM iam.roles r
  WHERE r.instance_id = ${sqlLiteral(input.instanceId)}
    AND r.role_key = ANY(${roleKeyArray})
),
clear_roles AS (
  ${input.dryRun ? 'SELECT 0 AS noop' : `DELETE FROM iam.account_roles
  WHERE instance_id = ${sqlLiteral(input.instanceId)}
    AND account_id = (SELECT account_id FROM resolved_account)`}
),
insert_roles AS (
  ${input.dryRun ? 'SELECT 0 AS noop' : `INSERT INTO iam.account_roles (instance_id, account_id, role_id, valid_from)
  SELECT ${sqlLiteral(input.instanceId)}, (SELECT account_id FROM resolved_account), id, NOW()
  FROM resolved_roles
  ON CONFLICT DO NOTHING`}
),
clear_orgs AS (
  ${input.dryRun ? 'SELECT 0 AS noop' : `DELETE FROM iam.account_organizations
  WHERE instance_id = ${sqlLiteral(input.instanceId)}
    AND account_id = (SELECT account_id FROM resolved_account)`}
),
insert_orgs AS (
  ${input.dryRun ? 'SELECT 0 AS noop' : `INSERT INTO iam.account_organizations (instance_id, account_id, organization_id)
  SELECT ${sqlLiteral(input.instanceId)}, (SELECT account_id FROM resolved_account), organization_id
  FROM unnest(${organizationIdArray}) AS organization_id
  ON CONFLICT DO NOTHING`}
)
SELECT json_build_object(
  'instance_id', ${sqlLiteral(input.instanceId)},
  'keycloak_subject', ${sqlLiteral(input.keycloakSubject)},
  'account_exists', EXISTS(SELECT 1 FROM resolved_account),
  'role_keys', ${roleKeyArray},
  'organization_ids', ${organizationIdArray},
  'dry_run', ${input.dryRun ? 'true' : 'false'}
)::text;
`;
};

export const runBindLocalUser = (argv: readonly string[]): number => {
  const options = parseArgs(argv);

  const copiedBindings = options.copyFromKeycloakSubject
    ? loadSourceBindings({
        copyFromKeycloakSubject: options.copyFromKeycloakSubject,
        iamDatabaseUrl: options.iamDatabaseUrl,
        instanceId: options.instanceId,
      })
    : { organizationIds: [], roleKeys: [] };

  const roleKeys = [...new Set([...copiedBindings.roleKeys, ...options.roleKeys])];
  const organizationIds = [...new Set([...copiedBindings.organizationIds, ...options.organizationIds])];

  const sql = buildExecutionSql({
    dryRun: options.dryRun,
    instanceId: options.instanceId,
    keycloakSubject: options.keycloakSubject,
    organizationIds,
    roleKeys,
  });

  const result = runPsql(options.iamDatabaseUrl, sql);
  process.stdout.write(`${result}\n`);
  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const exitCode = runBindLocalUser(process.argv.slice(2));
    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}`);
    process.exitCode = 2;
  }
}
