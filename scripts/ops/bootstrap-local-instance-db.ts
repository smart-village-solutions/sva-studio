import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type CliOptions = {
  createDb: boolean;
  importSchema: boolean;
  keycloakAdminClientId: string;
  keycloakAdminClientSecret: string;
  keycloakBaseUrl: string;
  pageSize: number;
  skipAppUserBootstrap: boolean;
  skipCatalogSync: boolean;
  skipKeycloakUserSync: boolean;
  sourceDbContainer: string;
  sourceDbName: string;
  sourceDbUser: string;
  sourceInstanceId: string;
  targetAppDbPassword: string;
  targetAppDbUser: string;
  targetDbContainer: string;
  targetDbName: string;
  targetDbUser: string;
  targetDisplayName: string;
  targetInstanceId: string;
  targetRealm: string;
};

type InstanceMetadata = {
  auditRetentionDays: number;
  displayName: string;
  retentionDays: number;
};

type KeycloakUser = {
  email?: string;
  enabled?: boolean;
  id: string;
};

const [, , ...rawArgs] = process.argv;

const rootDir = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const usage = () => {
  process.stderr.write(`Usage: tsx scripts/ops/bootstrap-local-instance-db.ts \\
  --target-instance-id=<id> \\
  --target-realm=<realm> \\
  --keycloak-admin-client-id=<id> \\
  --keycloak-admin-client-secret=<secret> \\
  [--target-display-name=<name>] \\
  [--target-db-container=sva-studio-postgres-hb] \\
  [--target-db-name=sva_studio] \\
  [--target-db-user=sva] \\
  [--target-app-db-user=sva_app] \\
  [--target-app-db-password=sva_app_local_dev_password] \\
  [--source-db-container=sva-studio-postgres] \\
  [--source-db-name=sva_studio] \\
  [--source-db-user=sva] \\
  [--source-instance-id=de-musterhausen] \\
  [--keycloak-base-url=https://keycloak.smart-village.app] \\
  [--page-size=200] \\
  [--create-db] \\
  [--import-schema] \\
  [--skip-app-user-bootstrap] \\
  [--skip-catalog-sync] \\
  [--skip-keycloak-user-sync]
`);
  process.exit(2);
};

const parseArgs = (args: readonly string[]): CliOptions => {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (const entry of args) {
    if (!entry.startsWith('--')) {
      usage();
    }

    const separatorIndex = entry.indexOf('=');
    if (separatorIndex === -1) {
      flags.add(entry.slice(2));
      continue;
    }

    values.set(entry.slice(2, separatorIndex), entry.slice(separatorIndex + 1));
  }

  const readRequired = (key: string): string => {
    const value = values.get(key);
    if (!value) {
      process.stderr.write(`Missing required option --${key}=...\n`);
      usage();
    }
    return value ?? '';
  };

  const readString = (key: string, fallback: string) => values.get(key) ?? fallback;
  const readNumber = (key: string, fallback: number) => {
    const raw = values.get(key);
    if (!raw) {
      return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Invalid numeric value for --${key}: ${raw}`);
    }

    return parsed;
  };

  const targetInstanceId = readRequired('target-instance-id');

  return {
    createDb: flags.has('create-db'),
    importSchema: flags.has('import-schema'),
    keycloakAdminClientId: readRequired('keycloak-admin-client-id'),
    keycloakAdminClientSecret: readRequired('keycloak-admin-client-secret'),
    keycloakBaseUrl: readString('keycloak-base-url', 'https://keycloak.smart-village.app'),
    pageSize: readNumber('page-size', 200),
    skipAppUserBootstrap: flags.has('skip-app-user-bootstrap'),
    skipCatalogSync: flags.has('skip-catalog-sync'),
    skipKeycloakUserSync: flags.has('skip-keycloak-user-sync'),
    sourceDbContainer: readString('source-db-container', 'sva-studio-postgres'),
    sourceDbName: readString('source-db-name', 'sva_studio'),
    sourceDbUser: readString('source-db-user', 'sva'),
    sourceInstanceId: readString('source-instance-id', 'de-musterhausen'),
    targetAppDbPassword: readString('target-app-db-password', 'sva_app_local_dev_password'),
    targetAppDbUser: readString('target-app-db-user', 'sva_app'),
    targetDbContainer: readString('target-db-container', 'sva-studio-postgres-hb'),
    targetDbName: readString('target-db-name', 'sva_studio'),
    targetDbUser: readString('target-db-user', 'sva'),
    targetDisplayName: readString('target-display-name', targetInstanceId),
    targetInstanceId,
    targetRealm: readRequired('target-realm'),
  };
};

const options = parseArgs(rawArgs);

const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;
const sqlIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

const run = (commandName: string, args: readonly string[], input?: string) => {
  const result = spawnSync(commandName, args, {
    cwd: rootDir,
    encoding: 'utf8',
    input,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `${commandName} ${args.join(' ')} failed`);
  }

  return result.stdout;
};

const logStep = (message: string) => {
  process.stdout.write(`\n==> ${message}\n`);
};

const dockerPsql = (container: string, dbUser: string, dbName: string, sql: string) =>
  run('docker', ['exec', '-i', container, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', dbUser, '-d', dbName, '-c', sql]);

const dockerPsqlQuiet = (container: string, dbUser: string, dbName: string, sql: string) =>
  run('docker', ['exec', '-i', container, 'psql', '-At', '-F', '\t', '-U', dbUser, '-d', dbName, '-c', sql]).trim();

const recreateDatabase = () => {
  logStep(`Erzeuge Ziel-Datenbank ${options.targetDbName} in ${options.targetDbContainer}`);
  run('docker', [
    'exec',
    '-i',
    options.targetDbContainer,
    'sh',
    '-lc',
    `dropdb -U ${options.targetDbUser} --if-exists ${options.targetDbName} && createdb -U ${options.targetDbUser} ${options.targetDbName}`,
  ]);
};

const importSchema = () => {
  logStep(`Importiere Schema aus ${options.sourceDbContainer}:${options.sourceDbName}`);
  const schemaSql = run('docker', [
    'exec',
    '-i',
    options.sourceDbContainer,
    'pg_dump',
    '-U',
    options.sourceDbUser,
    '--schema-only',
    '--no-owner',
    '--no-privileges',
    options.sourceDbName,
  ]);

  run(
    'docker',
    [
      'exec',
      '-i',
      options.targetDbContainer,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      options.targetDbUser,
      '-d',
      options.targetDbName,
    ],
    schemaSql
  );
};

const bootstrapAppUser = () => {
  logStep(`Bootstrappe App-User ${options.targetAppDbUser} auf ${options.targetDbContainer}`);
  const sql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iam_app') THEN
    CREATE ROLE iam_app NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(options.targetAppDbUser)}) THEN
    EXECUTE format(
      'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT',
      ${sqlLiteral(options.targetAppDbUser)},
      ${sqlLiteral(options.targetAppDbPassword)}
    );
  ELSE
    EXECUTE format(
      'ALTER ROLE %I WITH LOGIN INHERIT PASSWORD %L',
      ${sqlLiteral(options.targetAppDbUser)},
      ${sqlLiteral(options.targetAppDbPassword)}
    );
  END IF;
END
$$;

GRANT iam_app TO ${sqlIdentifier(options.targetAppDbUser)};
GRANT USAGE ON SCHEMA iam TO ${sqlIdentifier(options.targetAppDbUser)};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO ${sqlIdentifier(options.targetAppDbUser)};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO ${sqlIdentifier(options.targetAppDbUser)};
ALTER DEFAULT PRIVILEGES IN SCHEMA iam GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${sqlIdentifier(options.targetAppDbUser)};
ALTER DEFAULT PRIVILEGES IN SCHEMA iam GRANT USAGE, SELECT ON SEQUENCES TO ${sqlIdentifier(options.targetAppDbUser)};
`;

  dockerPsql(options.targetDbContainer, options.targetDbUser, options.targetDbName, sql);
};

const loadSourceInstanceMetadata = (): InstanceMetadata => {
  const raw = dockerPsqlQuiet(
    options.sourceDbContainer,
    options.sourceDbUser,
    options.sourceDbName,
    `SELECT display_name, retention_days, audit_retention_days FROM iam.instances WHERE id = ${sqlLiteral(options.sourceInstanceId)};`
  );

  if (!raw) {
    throw new Error(`Source instance ${options.sourceInstanceId} not found in ${options.sourceDbContainer}`);
  }

  const [displayName, retentionDays, auditRetentionDays] = raw.split('\t');
  return {
    auditRetentionDays: Number.parseInt(auditRetentionDays, 10),
    displayName,
    retentionDays: Number.parseInt(retentionDays, 10),
  };
};

const syncCatalog = () => {
  logStep(`Synchronisiere Basiskatalog von ${options.sourceInstanceId} nach ${options.targetInstanceId}`);
  const metadata = loadSourceInstanceMetadata();
  const catalogDump = run('docker', [
    'exec',
    '-i',
    options.sourceDbContainer,
    'pg_dump',
    '-U',
    options.sourceDbUser,
    '--data-only',
    '--inserts',
    '--column-inserts',
    '--table=iam.organizations',
    '--table=iam.roles',
    '--table=iam.permissions',
    '--table=iam.role_permissions',
    options.sourceDbName,
  ]);

  const sourceLiteral = new RegExp(sqlLiteral(options.sourceInstanceId).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'gu');
  const targetLiteral = sqlLiteral(options.targetInstanceId);
  const rewrittenDump = catalogDump.replace(sourceLiteral, targetLiteral);

  const cleanupAndUpsert = `
BEGIN;
DELETE FROM iam.role_permissions WHERE instance_id = ${targetLiteral};
DELETE FROM iam.permissions WHERE instance_id = ${targetLiteral};
DELETE FROM iam.roles WHERE instance_id = ${targetLiteral};
DELETE FROM iam.organizations WHERE instance_id = ${targetLiteral};
INSERT INTO iam.instances (id, display_name, retention_days, audit_retention_days)
VALUES (
  ${targetLiteral},
  ${sqlLiteral(options.targetDisplayName || metadata.displayName)},
  ${Number.isFinite(metadata.retentionDays) ? metadata.retentionDays : 90},
  ${Number.isFinite(metadata.auditRetentionDays) ? metadata.auditRetentionDays : 365}
)
ON CONFLICT (id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    retention_days = EXCLUDED.retention_days,
    audit_retention_days = EXCLUDED.audit_retention_days,
    updated_at = NOW();
COMMIT;
`;

  run(
    'docker',
    [
      'exec',
      '-i',
      options.targetDbContainer,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      options.targetDbUser,
      '-d',
      options.targetDbName,
    ],
    `${cleanupAndUpsert}\n${rewrittenDump}`
  );
};

const fetchKeycloakAccessToken = async () => {
  const response = await fetch(`${options.keycloakBaseUrl}/realms/${options.targetRealm}/protocol/openid-connect/token`, {
    body: new URLSearchParams({
      client_id: options.keycloakAdminClientId,
      client_secret: options.keycloakAdminClientSecret,
      grant_type: 'client_credentials',
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Keycloak token request failed with ${response.status}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error('Keycloak token response did not contain access_token');
  }

  return payload.access_token;
};

const fetchKeycloakUsers = async () => {
  logStep(`Lese aktive Keycloak-User aus Realm ${options.targetRealm}`);
  const accessToken = await fetchKeycloakAccessToken();
  const users: KeycloakUser[] = [];

  for (let first = 0; ; first += options.pageSize) {
    const url = new URL(`${options.keycloakBaseUrl}/admin/realms/${options.targetRealm}/users`);
    url.searchParams.set('first', String(first));
    url.searchParams.set('max', String(options.pageSize));

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Keycloak user sync failed with ${response.status} for page starting at ${first}`);
    }

    const page = (await response.json()) as KeycloakUser[];
    users.push(...page);

    if (page.length < options.pageSize) {
      break;
    }
  }

  const seen = new Set<string>();
  return users.filter((user) => {
    if (!user?.id || user.enabled === false || seen.has(user.id)) {
      return false;
    }
    seen.add(user.id);
    return true;
  });
};

const syncKeycloakUsers = async () => {
  const users = await fetchKeycloakUsers();
  logStep(`Provisioniere ${users.length} Keycloak-Subjects nach ${options.targetInstanceId}`);

  let sql = 'BEGIN;\n';
  for (const user of users) {
    const subject = sqlLiteral(user.id);
    sql += `INSERT INTO iam.accounts (instance_id, keycloak_subject, status)\n`;
    sql += `VALUES (${sqlLiteral(options.targetInstanceId)}, ${subject}, 'active')\n`;
    sql += `ON CONFLICT (keycloak_subject, instance_id) WHERE instance_id IS NOT NULL DO UPDATE\n`;
    sql += `SET status = 'active', updated_at = NOW();\n`;
    sql += `INSERT INTO iam.instance_memberships (instance_id, account_id, membership_type)\n`;
    sql += `SELECT ${sqlLiteral(options.targetInstanceId)}, id, 'member'\n`;
    sql += `FROM iam.accounts\n`;
    sql += `WHERE keycloak_subject = ${subject} AND instance_id = ${sqlLiteral(options.targetInstanceId)}\n`;
    sql += `ON CONFLICT (instance_id, account_id) DO NOTHING;\n`;
  }
  sql += 'COMMIT;\n';

  run(
    'docker',
    [
      'exec',
      '-i',
      options.targetDbContainer,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      options.targetDbUser,
      '-d',
      options.targetDbName,
    ],
    sql
  );
};

const summarizeTargetState = () => {
  const raw = dockerPsqlQuiet(
    options.targetDbContainer,
    options.targetDbUser,
    options.targetDbName,
    `
SELECT 'accounts', COUNT(*)::text FROM iam.accounts WHERE instance_id = ${sqlLiteral(options.targetInstanceId)}
UNION ALL
SELECT 'memberships', COUNT(*)::text FROM iam.instance_memberships WHERE instance_id = ${sqlLiteral(options.targetInstanceId)}
UNION ALL
SELECT 'organizations', COUNT(*)::text FROM iam.organizations WHERE instance_id = ${sqlLiteral(options.targetInstanceId)}
UNION ALL
SELECT 'roles', COUNT(*)::text FROM iam.roles WHERE instance_id = ${sqlLiteral(options.targetInstanceId)}
UNION ALL
SELECT 'permissions', COUNT(*)::text FROM iam.permissions WHERE instance_id = ${sqlLiteral(options.targetInstanceId)};
`
  );

  process.stdout.write('\n==> Zielzustand\n');
  for (const line of raw.split('\n')) {
    const [label, count] = line.split('\t');
    process.stdout.write(`- ${label}: ${count}\n`);
  }
};

const main = async () => {
  if (options.createDb) {
    recreateDatabase();
  }

  if (options.importSchema) {
    importSchema();
  }

  if (!options.skipAppUserBootstrap) {
    bootstrapAppUser();
  }

  if (!options.skipCatalogSync) {
    syncCatalog();
  }

  if (!options.skipKeycloakUserSync) {
    await syncKeycloakUsers();
  }

  summarizeTargetState();
  process.stdout.write('\nFertig. Nächste Schritte: Runtime-Datei setzen, App neu starten und `pnpm env:doctor:<profil>` ausführen.\n');
};

await main();
