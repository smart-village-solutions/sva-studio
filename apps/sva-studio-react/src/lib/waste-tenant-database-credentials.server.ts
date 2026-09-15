import { randomBytes } from 'node:crypto';

import type { ExternalInterfaceRecord } from '@sva/core';
import {
  buildExternalInterfaceSecretConfigAad,
  type WasteTenantDatabaseNames,
} from '@sva/server-runtime';
import type { SqlClient } from './waste-management-operations.types.js';

const existingSecretUnreadable = 'waste_database_existing_secret_unreadable';
const identifierPattern = /^[a-z][a-z0-9_]{0,62}$/u;

export const quoteWasteTenantIdentifier = (value: string): string => {
  if (!identifierPattern.test(value)) {
    throw new Error('waste_tenant_identifier_invalid');
  }
  return `"${value}"`;
};

const quoteLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`;

export const createWasteTenantDatabasePassword = (): string =>
  randomBytes(32).toString('base64url');

export const buildWasteTenantDatabaseUrl = (
  adminUrl: string,
  input: { readonly database: string; readonly role: string; readonly password: string }
): string => {
  const url = new URL(adminUrl);
  url.username = input.role;
  url.password = input.password;
  url.pathname = `/${input.database}`;
  return url.toString();
};

export const createOrUpdateWasteTenantRoles = async (
  client: SqlClient,
  input: {
    readonly names: WasteTenantDatabaseNames;
    readonly passwords: Readonly<{ migrator: string; app: string; publicApp: string }>;
    readonly preserveRuntimeCredentials: boolean;
  }
): Promise<void> => {
  const roleSpecs = [
    {
      name: input.names.ownerRole,
      createAttributes: 'NOLOGIN NOCREATEDB NOCREATEROLE',
      reconcileAttributes: 'NOLOGIN NOCREATEDB NOCREATEROLE',
      runtimeCredential: false,
    },
    {
      name: input.names.migratorRole,
      createAttributes: `LOGIN PASSWORD ${quoteLiteral(input.passwords.migrator)} NOCREATEDB NOCREATEROLE NOINHERIT`,
      reconcileAttributes: `LOGIN PASSWORD ${quoteLiteral(input.passwords.migrator)} NOCREATEDB NOCREATEROLE NOINHERIT`,
      runtimeCredential: false,
    },
    {
      name: input.names.appRole,
      createAttributes: `LOGIN PASSWORD ${quoteLiteral(input.passwords.app)} NOCREATEDB NOCREATEROLE NOINHERIT`,
      // Runtime credentials have independent consumers and rotate only through an explicit cutover.
      reconcileAttributes: 'LOGIN NOCREATEDB NOCREATEROLE NOINHERIT',
      runtimeCredential: true,
    },
    {
      name: input.names.publicAppRole,
      createAttributes: `LOGIN PASSWORD ${quoteLiteral(input.passwords.publicApp)} NOCREATEDB NOCREATEROLE NOINHERIT`,
      reconcileAttributes: 'LOGIN NOCREATEDB NOCREATEROLE NOINHERIT',
      runtimeCredential: true,
    },
  ] as const;
  const existing = await client.query<{
    rolname: string;
    rolsuper: boolean;
    rolreplication: boolean;
    rolbypassrls: boolean;
  }>(
    'SELECT rolname, rolsuper, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = ANY($1::text[]);',
    [roleSpecs.map((role) => role.name)]
  );
  // PostgreSQL 16 restricts ALTER of these attributes even when setting their negative forms.
  // Reject privileged existing roles before changing any credentials or database grants.
  if (
    existing.rows.some(
      (role) =>
        role.rolsuper !== false || role.rolreplication !== false || role.rolbypassrls !== false
    )
  ) {
    throw new Error('waste_tenant_role_privilege_drift');
  }
  const existingNames = new Set(existing.rows.map((row) => row.rolname));
  for (const role of roleSpecs) {
    const roleExists = existingNames.has(role.name);
    const preserveExistingCredential = role.runtimeCredential && input.preserveRuntimeCredentials;
    const attributes = roleExists && (!role.runtimeCredential || preserveExistingCredential)
      ? role.reconcileAttributes
      : role.createAttributes;
    await client.query(
      roleExists
        ? `ALTER ROLE ${quoteWasteTenantIdentifier(role.name)} WITH ${attributes};`
        : `CREATE ROLE ${quoteWasteTenantIdentifier(role.name)} WITH ${attributes} NOSUPERUSER NOREPLICATION NOBYPASSRLS;`
    );
  }
  await client.query(
    `GRANT ${quoteWasteTenantIdentifier(input.names.ownerRole)} TO ${quoteWasteTenantIdentifier(input.names.migratorRole)};`
  );
  await client.query(
    `GRANT ${quoteWasteTenantIdentifier(input.names.ownerRole)} TO CURRENT_USER WITH SET TRUE;`
  );
};

const readExistingRuntimePassword = (input: {
  readonly databaseUrl: unknown;
  readonly databaseName: string;
  readonly roleName: string;
}): string => {
  if (typeof input.databaseUrl !== 'string' || input.databaseUrl.length === 0) {
    throw new Error(existingSecretUnreadable);
  }
  try {
    const url = new URL(input.databaseUrl);
    const username = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const databaseName = decodeURIComponent(url.pathname.replace(/^\//u, ''));
    if (username !== input.roleName || databaseName !== input.databaseName || !password) {
      throw new Error(existingSecretUnreadable);
    }
    return password;
  } catch {
    throw new Error(existingSecretUnreadable);
  }
};

export const readExistingWasteRuntimePasswords = (input: {
  readonly existing: ExternalInterfaceRecord;
  readonly names: WasteTenantDatabaseNames;
  readonly revealSecret?: (
    ciphertext: string | null | undefined,
    aad: string
  ) => string | undefined;
}): Readonly<{ app: string; publicApp: string }> => {
  if (!input.existing.secretConfigCiphertext || !input.revealSecret) {
    throw new Error(existingSecretUnreadable);
  }
  const plaintext = input.revealSecret(
    input.existing.secretConfigCiphertext,
    buildExternalInterfaceSecretConfigAad(input.existing.id)
  );
  if (!plaintext) {
    throw new Error(existingSecretUnreadable);
  }
  try {
    const config = JSON.parse(plaintext) as Record<string, unknown>;
    return {
      app: readExistingRuntimePassword({
        databaseUrl: config.databaseUrl,
        databaseName: input.names.database,
        roleName: input.names.appRole,
      }),
      publicApp: readExistingRuntimePassword({
        databaseUrl: config.publicDatabaseUrl,
        databaseName: input.names.database,
        roleName: input.names.publicAppRole,
      }),
    };
  } catch {
    throw new Error(existingSecretUnreadable);
  }
};
