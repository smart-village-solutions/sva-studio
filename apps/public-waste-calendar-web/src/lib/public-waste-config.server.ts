export type PublicWasteConfig = {
  readonly instanceId: string;
  readonly supabase: {
    readonly databaseUrl: string;
    readonly schemaName: string;
  };
  readonly pdf: {
    readonly urlTemplate: string;
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
  const pdf = isRecord(input.pdf) ? input.pdf : null;

  const databaseUrl = readString(supabase?.databaseUrl);
  const schemaName = readString(supabase?.schemaName);
  const urlTemplate = readString(pdf?.urlTemplate);

  if (instanceId === null || databaseUrl === null || schemaName === null || urlTemplate === null) {
    throw new Error(CONFIG_ERROR);
  }

  return {
    instanceId,
    supabase: {
      databaseUrl,
      schemaName,
    },
    pdf: {
      urlTemplate,
    },
  };
};

export const readPublicWasteConfigFromEnvironment = (
  env: NodeJS.ProcessEnv = process.env
): PublicWasteConfig | null => {
  const instanceId = readString(env.PUBLIC_WASTE_INSTANCE_ID);
  const databaseUrl = readString(env.PUBLIC_WASTE_DATABASE_URL);
  const schemaName = readString(env.PUBLIC_WASTE_SCHEMA_NAME);
  const urlTemplate = readString(env.PUBLIC_WASTE_PDF_URL_TEMPLATE);

  if (instanceId === null || databaseUrl === null || schemaName === null || urlTemplate === null) {
    return null;
  }

  return {
    instanceId,
    supabase: {
      databaseUrl,
      schemaName,
    },
    pdf: {
      urlTemplate,
    },
  };
};
