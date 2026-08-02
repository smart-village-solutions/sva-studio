import {
  readWasteManagementEmailReminderConfig,
  readWasteManagementEmailReminderSigningSecret,
  type WasteManagementEmailReminderConfig,
} from '@sva/core';
import { deriveWasteTenantDatabaseNames } from '@sva/server-runtime';

export type PublicWasteConfig = {
  readonly instanceId: string;
  readonly database: {
    readonly databaseUrl: string;
    readonly schemaName: string;
  };
  readonly emailReminderConfig?: WasteManagementEmailReminderConfig;
  readonly emailReminderSigningSecret?: string;
};

const CONFIG_ERROR = 'public_waste_config_invalid';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const assertTenantDatabaseIdentity = (instanceId: string, databaseUrl: string): void => {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error(CONFIG_ERROR);
  }
  const names = deriveWasteTenantDatabaseNames(instanceId);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//u, ''));
  if (
    (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') ||
    decodeURIComponent(url.username) !== names.publicAppRole ||
    databaseName !== names.database
  ) {
    throw new Error(CONFIG_ERROR);
  }
};

export const parsePublicWasteConfig = (input: unknown): PublicWasteConfig => {
  if (!isRecord(input)) {
    throw new Error(CONFIG_ERROR);
  }

  const instanceId = readString(input.instanceId);
  const database = isRecord(input.database) ? input.database : null;

  const databaseUrl = readString(database?.databaseUrl);
  const schemaName = readString(database?.schemaName);

  if (
    instanceId === null ||
    databaseUrl === null ||
    schemaName === null ||
    schemaName !== 'public'
  ) {
    throw new Error(CONFIG_ERROR);
  }
  assertTenantDatabaseIdentity(instanceId, databaseUrl);

  const emailReminderConfig = readWasteManagementEmailReminderConfig(input);
  const emailReminderSigningSecret = readWasteManagementEmailReminderSigningSecret(input);

  return {
    instanceId,
    database: {
      databaseUrl,
      schemaName,
    },
    ...(emailReminderConfig ? { emailReminderConfig } : {}),
    ...(emailReminderSigningSecret ? { emailReminderSigningSecret } : {}),
  };
};

export const readPublicWasteConfigFromEnvironment = (
  env: NodeJS.ProcessEnv = process.env
): PublicWasteConfig | null => {
  const instanceId = readString(env.PUBLIC_WASTE_INSTANCE_ID);
  const databaseUrl = readString(env.PUBLIC_WASTE_DATABASE_URL);
  const schemaName = readString(env.PUBLIC_WASTE_SCHEMA_NAME);
  const rawConfigJson = readString(env.PUBLIC_WASTE_CONFIG_JSON);

  if (instanceId === null || databaseUrl === null || schemaName === null) {
    return null;
  }
  if (schemaName !== 'public') {
    throw new Error(CONFIG_ERROR);
  }
  assertTenantDatabaseIdentity(instanceId, databaseUrl);

  let emailReminderConfig: WasteManagementEmailReminderConfig | undefined;
  let emailReminderSigningSecret: string | undefined;
  if (rawConfigJson) {
    const parsed = JSON.parse(rawConfigJson) as unknown;
    if (isRecord(parsed)) {
      const parsedReminderConfig = readWasteManagementEmailReminderConfig(parsed);
      if (parsedReminderConfig) {
        emailReminderConfig = parsedReminderConfig;
      }
      const parsedSigningSecret = readWasteManagementEmailReminderSigningSecret(parsed);
      if (parsedSigningSecret) {
        emailReminderSigningSecret = parsedSigningSecret;
      }
    }
  }

  return {
    instanceId,
    database: {
      databaseUrl,
      schemaName,
    },
    ...(emailReminderConfig ? { emailReminderConfig } : {}),
    ...(emailReminderSigningSecret ? { emailReminderSigningSecret } : {}),
  };
};
