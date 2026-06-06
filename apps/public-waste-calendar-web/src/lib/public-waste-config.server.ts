export type PublicWasteConfig = {
  readonly instanceId: string;
  readonly supabase: {
    readonly databaseUrl: string;
    readonly schemaName: string;
  };
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

  return {
    instanceId,
    supabase: {
      databaseUrl,
      schemaName,
    },
  };
};
