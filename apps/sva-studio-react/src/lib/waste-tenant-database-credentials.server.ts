import { randomBytes } from 'node:crypto';

import type { ExternalInterfaceRecord } from '@sva/core';
import {
  buildExternalInterfaceSecretConfigAad,
  type WasteTenantDatabaseNames,
} from '@sva/server-runtime';

const existingSecretUnreadable = 'waste_database_existing_secret_unreadable';

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
