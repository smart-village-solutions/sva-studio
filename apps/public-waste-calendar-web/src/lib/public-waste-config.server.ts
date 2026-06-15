import {
  readWasteManagementEmailReminderConfig,
  readWasteManagementEmailReminderSigningSecret,
  type WasteManagementEmailReminderConfig,
} from '@sva/core';

export type PublicWasteConfig = {
  readonly instanceId: string;
  readonly supabase: {
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

export const parsePublicWasteConfig = (input: unknown): PublicWasteConfig => {
  if (!isRecord(input)) {
    throw new Error(CONFIG_ERROR);
  }

  const instanceId = readString(input.instanceId);
  const supabase = isRecord(input.supabase) ? input.supabase : null;

  const databaseUrl = readString(supabase?.databaseUrl);
  const schemaName = readString(supabase?.schemaName);

  if (instanceId === null || databaseUrl === null || schemaName === null) {
    throw new Error(CONFIG_ERROR);
  }

  const emailReminderConfig = readWasteManagementEmailReminderConfig(input);
  const emailReminderSigningSecret = readWasteManagementEmailReminderSigningSecret(input);

  return {
    instanceId,
    supabase: {
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
    supabase: {
      databaseUrl,
      schemaName,
    },
    ...(emailReminderConfig ? { emailReminderConfig } : {}),
    ...(emailReminderSigningSecret ? { emailReminderSigningSecret } : {}),
  };
};
