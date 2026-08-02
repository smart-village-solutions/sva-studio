import { randomBytes } from 'node:crypto';

import {
  wasteTenantProvisioningContract,
  type ExternalInterfaceRecord,
  type WasteManagementProvisionTenantDatabaseJobInput,
} from '@sva/core';
import {
  claimWasteTenantProvisioning,
  completeWasteTenantProvisioning,
  failWasteTenantProvisioning,
  loadExternalInterfaceRecordByAlias,
  saveExternalInterfaceRecord,
} from '@sva/data-repositories/server';
import {
  buildExternalInterfaceSecretConfigAad,
  deriveWasteTenantDatabaseNames,
  type WasteTenantDatabaseNames,
} from '@sva/server-runtime';
import { Pool } from 'pg';

import { applySchemaStatements, inspectWasteSchema } from './waste-management-operations.schema.js';
import type { OperationSummary, WasteOperationSqlPool } from './waste-management-operations.types.js';

export { deriveWasteTenantDatabaseNames, type WasteTenantDatabaseNames } from '@sva/server-runtime';

const identifierPattern = /^[a-z][a-z0-9_]{0,62}$/u;

const quoteIdentifier = (value: string): string => {
  if (!identifierPattern.test(value)) {
    throw new Error('waste_tenant_identifier_invalid');
  }
  return `"${value}"`;
};

const quoteLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`;
const createPassword = (): string => randomBytes(32).toString('base64url');

const buildDatabaseUrl = (
  adminUrl: string,
  input: { readonly database: string; readonly role: string; readonly password: string }
): string => {
  const url = new URL(adminUrl);
  url.username = input.role;
  url.password = input.password;
  url.pathname = `/${input.database}`;
  return url.toString();
};

type ProvisioningPool = WasteOperationSqlPool;

export type WasteTenantDatabaseProvisionerDeps = Readonly<{
  getProvisionerDatabaseUrl?: () => string | undefined;
  createPool?: (databaseUrl: string) => ProvisioningPool;
  protectSecret?: (plaintext: string, aad: string) => string | null;
  loadManagedInterface?: typeof loadExternalInterfaceRecordByAlias;
  saveManagedInterface?: typeof saveExternalInterfaceRecord;
  claimProvisioning?: typeof claimWasteTenantProvisioning;
  completeProvisioning?: typeof completeWasteTenantProvisioning;
  failProvisioning?: typeof failWasteTenantProvisioning;
  createPassword?: () => string;
  now?: () => Date;
}>;

const defaultCreatePool = (databaseUrl: string): ProvisioningPool =>
  new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 10_000 });

type ProvisioningClient = Awaited<ReturnType<ProvisioningPool['connect']>>;

const createOrUpdateRoles = async (
  client: ProvisioningClient,
  input: {
    readonly names: WasteTenantDatabaseNames;
    readonly passwords: Readonly<{ migrator: string; app: string; publicApp: string }>;
  }
): Promise<void> => {
  const roleSpecs = [
    {
      name: input.names.ownerRole,
      attributes: 'NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
    },
    {
      name: input.names.migratorRole,
      attributes: `LOGIN PASSWORD ${quoteLiteral(input.passwords.migrator)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT`,
    },
    {
      name: input.names.appRole,
      attributes: `LOGIN PASSWORD ${quoteLiteral(input.passwords.app)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT`,
    },
    {
      name: input.names.publicAppRole,
      attributes: `LOGIN PASSWORD ${quoteLiteral(input.passwords.publicApp)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT`,
    },
  ] as const;
  const existing = await client.query<{ rolname: string }>(
    'SELECT rolname FROM pg_roles WHERE rolname = ANY($1::text[]);',
    [roleSpecs.map((role) => role.name)]
  );
  const existingNames = new Set(existing.rows.map((row) => row.rolname));
  for (const role of roleSpecs) {
    await client.query(
      existingNames.has(role.name)
        ? `ALTER ROLE ${quoteIdentifier(role.name)} WITH ${role.attributes};`
        : `CREATE ROLE ${quoteIdentifier(role.name)} WITH ${role.attributes};`
    );
  }
  await client.query(
    `GRANT ${quoteIdentifier(input.names.ownerRole)} TO ${quoteIdentifier(input.names.migratorRole)};`
  );
  await client.query(
    `GRANT ${quoteIdentifier(input.names.ownerRole)} TO CURRENT_USER WITH ADMIN OPTION;`
  );
};

const ensureDatabase = async (
  client: ProvisioningClient,
  names: WasteTenantDatabaseNames
): Promise<void> => {
  const result = await client.query<{ exists: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists;',
    [names.database]
  );
  if (!result.rows[0]?.exists) {
    await client.query(
      `CREATE DATABASE ${quoteIdentifier(names.database)} OWNER ${quoteIdentifier(names.ownerRole)};`
    );
  }
  await client.query(
    `REVOKE ALL ON DATABASE ${quoteIdentifier(names.database)} FROM PUBLIC;`
  );
  await client.query(
    `GRANT CONNECT ON DATABASE ${quoteIdentifier(names.database)} TO ${quoteIdentifier(names.migratorRole)}, ${quoteIdentifier(names.appRole)}, ${quoteIdentifier(names.publicAppRole)};`
  );
};

const migrateAndGrant = async (pool: ProvisioningPool, names: WasteTenantDatabaseNames) => {
  const client = await pool.connect();
  try {
    await client.query(`SET ROLE ${quoteIdentifier(names.ownerRole)};`);
    await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC;');
    await client.query(`ALTER SCHEMA public OWNER TO ${quoteIdentifier(names.ownerRole)};`);
    for (const sql of applySchemaStatements('public')) {
      await client.query(sql);
    }
    await client.query(
      `GRANT USAGE ON SCHEMA public TO ${quoteIdentifier(names.appRole)}, ${quoteIdentifier(names.publicAppRole)};`
    );
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${quoteIdentifier(names.appRole)};`
    );
    await client.query(
      `GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${quoteIdentifier(names.publicAppRole)};`
    );
    await client.query(
      `GRANT INSERT, UPDATE, DELETE ON TABLE
        public.waste_email_reminder_subscriptions,
        public.waste_email_reminder_subscription_items,
        public.waste_email_reminder_outbox
      TO ${quoteIdentifier(names.publicAppRole)};`
    );
    await client.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${quoteIdentifier(names.appRole)};`
    );
    await client.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdentifier(names.ownerRole)} IN SCHEMA public
       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${quoteIdentifier(names.appRole)};`
    );
    await client.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdentifier(names.ownerRole)} IN SCHEMA public
       GRANT USAGE, SELECT ON SEQUENCES TO ${quoteIdentifier(names.appRole)};`
    );
    await client.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdentifier(names.ownerRole)} IN SCHEMA public
       GRANT SELECT ON TABLES TO ${quoteIdentifier(names.publicAppRole)};`
    );
    return inspectWasteSchema(client, 'public');
  } finally {
    client.release();
  }
};

const verifyRuntimeAccess = async (
  pool: ProvisioningPool,
  expectedAccess: 'read-write' | 'public-runtime'
): Promise<void> => {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      can_select: boolean;
      can_insert: boolean;
      can_insert_subscription: boolean;
    }>(
      `SELECT
         has_table_privilege(current_user, 'public.waste_fractions', 'SELECT') AS can_select,
         has_table_privilege(current_user, 'public.waste_fractions', 'INSERT') AS can_insert,
         has_table_privilege(current_user, 'public.waste_email_reminder_subscriptions', 'INSERT') AS can_insert_subscription;`
    );
    const access = result.rows[0];
    const valid =
      expectedAccess === 'read-write'
        ? access?.can_select && access.can_insert && access.can_insert_subscription
        : access?.can_select && !access.can_insert && access.can_insert_subscription;
    if (!valid) {
      throw new Error('waste_database_runtime_privileges_invalid');
    }
  } finally {
    client.release();
  }
};

export const createProvisionTenantDatabaseOperation = (
  deps: WasteTenantDatabaseProvisionerDeps
) => async (
  instanceId: string,
  input: WasteManagementProvisionTenantDatabaseJobInput,
  context: { readonly jobId: string }
): Promise<OperationSummary> => {
  const startedAt = Date.now();
  if (!Number.isSafeInteger(input.desiredGeneration) || input.desiredGeneration < 1 || !context.jobId) {
    throw new Error('invalid_waste_tenant_provisioning_input');
  }
  const claim = await (deps.claimProvisioning ?? claimWasteTenantProvisioning)({
    instanceId,
    jobId: context.jobId,
    desiredGeneration: input.desiredGeneration,
  });
  if (!claim) {
    throw new Error('waste_tenant_provisioning_claim_rejected');
  }

  let managedInterfaceForFailure: ExternalInterfaceRecord | undefined;

  try {
    const adminUrl = deps.getProvisionerDatabaseUrl?.()?.trim();
    if (!adminUrl) {
      throw new Error('waste_database_provisioner_url_missing');
    }
    if (!deps.protectSecret) {
      throw new Error('waste_database_secret_protection_missing');
    }
    const names = deriveWasteTenantDatabaseNames(instanceId);
    const passwordFactory = deps.createPassword ?? createPassword;
    const passwords = { migrator: passwordFactory(), app: passwordFactory(), publicApp: passwordFactory() };
    const createPool = deps.createPool ?? defaultCreatePool;
    const adminPool = createPool(adminUrl);
    try {
      const adminClient = await adminPool.connect();
      try {
        await createOrUpdateRoles(adminClient, { names, passwords });
        await ensureDatabase(adminClient, names);
      } finally {
        adminClient.release();
      }
    } finally {
      await adminPool.end();
    }

    const migratorUrl = buildDatabaseUrl(adminUrl, { database: names.database, role: names.migratorRole, password: passwords.migrator });
    const appUrl = buildDatabaseUrl(adminUrl, { database: names.database, role: names.appRole, password: passwords.app });
    const publicAppUrl = buildDatabaseUrl(adminUrl, { database: names.database, role: names.publicAppRole, password: passwords.publicApp });
    const interfaceId = `waste-management:${instanceId}`;
    const now = (deps.now ?? (() => new Date()))().toISOString();
    const ciphertext = deps.protectSecret(
      JSON.stringify({ databaseUrl: appUrl, publicDatabaseUrl: publicAppUrl }),
      buildExternalInterfaceSecretConfigAad(interfaceId)
    );
    if (!ciphertext) {
      throw new Error('waste_database_secret_protection_failed');
    }

    const baseRecord: ExternalInterfaceRecord = {
      id: interfaceId,
      instanceId,
      typeKey: 'postgresql',
      ownerKind: 'plugin',
      ownerId: wasteTenantProvisioningContract.interfaceOwnerId,
      displayName: 'Waste PostgreSQL',
      alias: wasteTenantProvisioningContract.interfaceAlias,
      enabled: false,
      isDefault: true,
      category: 'database',
      authMode: 'database_credentials',
      publicConfig: { schemaName: 'public', databaseName: names.database, managed: true },
      secretConfigCiphertext: ciphertext,
      statusCheckKind: 'postgresql',
      visibleStatus: 'disabled',
      createdAt: now,
      updatedAt: now,
    };
    managedInterfaceForFailure = baseRecord;
    const existing = await (deps.loadManagedInterface ?? loadExternalInterfaceRecordByAlias)(
      instanceId,
      'postgresql',
      wasteTenantProvisioningContract.interfaceAlias
    );
    if (existing && (existing.ownerKind !== 'plugin' || existing.ownerId !== wasteTenantProvisioningContract.interfaceOwnerId)) {
      throw new Error('waste_managed_interface_owner_conflict');
    }
    await (deps.saveManagedInterface ?? saveExternalInterfaceRecord)({
      ...baseRecord,
      ...(existing?.createdAt ? { createdAt: existing.createdAt } : {}),
    });

    const migrationPool = createPool(migratorUrl);
    let schemaInspection: Awaited<ReturnType<typeof migrateAndGrant>>;
    try {
      schemaInspection = await migrateAndGrant(migrationPool, names);
    } finally {
      await migrationPool.end();
    }
    if (schemaInspection.missingTables.length > 0) {
      throw new Error('waste_database_schema_incomplete');
    }
    const appPool = createPool(appUrl);
    try {
      await verifyRuntimeAccess(appPool, 'read-write');
    } finally {
      await appPool.end();
    }
    const publicAppPool = createPool(publicAppUrl);
    try {
      await verifyRuntimeAccess(publicAppPool, 'public-runtime');
    } finally {
      await publicAppPool.end();
    }

    await (deps.saveManagedInterface ?? saveExternalInterfaceRecord)({
      ...baseRecord,
      enabled: true,
      visibleStatus: 'ok',
      lastCheckedAt: now,
      lastCheckStatus: 'succeeded',
    });
    const completed = await (deps.completeProvisioning ?? completeWasteTenantProvisioning)({
      instanceId,
      jobId: context.jobId,
      desiredGeneration: input.desiredGeneration,
      databaseName: names.database,
      interfaceId,
    });
    if (!completed) {
      throw new Error('waste_tenant_provisioning_completion_rejected');
    }
    return {
      durationMs: Math.max(1, Date.now() - startedAt),
      details: { databaseName: names.database, interfaceId, desiredGeneration: input.desiredGeneration },
    };
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.split(':', 1)[0] : 'waste_tenant_provisioning_failed';
    if (managedInterfaceForFailure) {
      await (deps.saveManagedInterface ?? saveExternalInterfaceRecord)({
        ...managedInterfaceForFailure,
        enabled: false,
        visibleStatus: 'error',
        lastCheckStatus: 'failed',
        lastCheckErrorCode: errorCode,
        updatedAt: (deps.now ?? (() => new Date()))().toISOString(),
      }).catch(() => undefined);
    }
    await (deps.failProvisioning ?? failWasteTenantProvisioning)({
      instanceId,
      jobId: context.jobId,
      desiredGeneration: input.desiredGeneration,
      errorCode,
      errorMessage: 'Die Waste-Datenbank konnte nicht vollständig provisioniert werden.',
    }).catch(() => null);
    throw new Error(errorCode, { cause: error });
  }
};
