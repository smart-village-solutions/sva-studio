export type PublicWasteConfig = {
  readonly instanceId: string;
  readonly supabase: {
    readonly databaseUrl: string;
    readonly schemaName: string;
  };
  readonly preferences: {
    readonly cookieName: string;
    readonly maxAgeSeconds: number;
    readonly sameSite: 'lax' | 'none';
    readonly secure: boolean;
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

const readBoolean = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);

const readPositiveInteger = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;

export const parsePublicWasteConfig = (input: unknown): PublicWasteConfig => {
  if (!isRecord(input)) {
    throw new Error(CONFIG_ERROR);
  }

  const instanceId = readString(input.instanceId);
  const supabase = isRecord(input.supabase) ? input.supabase : null;
  const preferences = isRecord(input.preferences) ? input.preferences : null;
  const pdf = isRecord(input.pdf) ? input.pdf : null;

  const databaseUrl = readString(supabase?.databaseUrl);
  const schemaName = readString(supabase?.schemaName);
  const cookieName = readString(preferences?.cookieName);
  const maxAgeSeconds = readPositiveInteger(preferences?.maxAgeSeconds);
  const sameSite = preferences?.sameSite === 'lax' || preferences?.sameSite === 'none' ? preferences.sameSite : null;
  const secure = readBoolean(preferences?.secure);
  const urlTemplate = readString(pdf?.urlTemplate);

  if (
    instanceId === null ||
    databaseUrl === null ||
    schemaName === null ||
    cookieName === null ||
    maxAgeSeconds === null ||
    sameSite === null ||
    secure === null ||
    urlTemplate === null
  ) {
    throw new Error(CONFIG_ERROR);
  }

  return {
    instanceId,
    supabase: {
      databaseUrl,
      schemaName,
    },
    preferences: {
      cookieName,
      maxAgeSeconds,
      sameSite,
      secure,
    },
    pdf: {
      urlTemplate,
    },
  };
};
