export const RUNTIME_PROFILES = ['local-keycloak', 'local-builder', 'acceptance-hb'] as const;

export type RuntimeProfile = (typeof RUNTIME_PROFILES)[number];
export type RuntimeProfileAuthMode = 'keycloak' | 'mock';

export type RuntimeProfileDefinition = {
  readonly authMode: RuntimeProfileAuthMode;
  readonly description: string;
  readonly isLocal: boolean;
  readonly requiredEnvKeys: readonly string[];
  readonly usesBuilder: boolean;
};

export type RuntimeProfileEnvValidationResult = {
  readonly invalid: string[];
  readonly missing: string[];
  readonly placeholders: string[];
};

const COMMON_REQUIRED_ENV_KEYS = [
  'SVA_RUNTIME_PROFILE',
  'SVA_PUBLIC_BASE_URL',
  'REDIS_URL',
  'IAM_DATABASE_URL',
  'IAM_PII_ACTIVE_KEY_ID',
  'IAM_PII_KEYRING_JSON',
  'ENCRYPTION_KEY',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'SVA_MAINSERVER_GRAPHQL_URL',
  'SVA_MAINSERVER_OAUTH_TOKEN_URL',
  'SVA_MAINSERVER_CLIENT_ID',
  'SVA_MAINSERVER_CLIENT_SECRET',
] as const;

const KEYCLOAK_AUTH_REQUIRED_ENV_KEYS = [
  'SVA_AUTH_ISSUER',
  'SVA_AUTH_CLIENT_ID',
  'SVA_AUTH_CLIENT_SECRET',
  'SVA_AUTH_STATE_SECRET',
  'SVA_AUTH_REDIRECT_URI',
  'SVA_AUTH_POST_LOGOUT_REDIRECT_URI',
] as const;

const KEYCLOAK_ADMIN_REQUIRED_ENV_KEYS = [
  'KEYCLOAK_ADMIN_BASE_URL',
  'KEYCLOAK_ADMIN_REALM',
  'KEYCLOAK_ADMIN_CLIENT_ID',
  'KEYCLOAK_ADMIN_CLIENT_SECRET',
] as const;

const PROFILE_DEFINITIONS = {
  'local-keycloak': {
    authMode: 'keycloak',
    description: 'Lokaler Betrieb auf localhost mit Test-Realm in Keycloak.',
    isLocal: true,
    requiredEnvKeys: [
      ...COMMON_REQUIRED_ENV_KEYS,
      ...KEYCLOAK_AUTH_REQUIRED_ENV_KEYS,
      ...KEYCLOAK_ADMIN_REQUIRED_ENV_KEYS,
    ],
    usesBuilder: false,
  },
  'local-builder': {
    authMode: 'mock',
    description: 'Lokaler Betrieb mit Builder.io und Mock-User statt OIDC-Login.',
    isLocal: true,
    requiredEnvKeys: [
      ...COMMON_REQUIRED_ENV_KEYS,
      ...KEYCLOAK_ADMIN_REQUIRED_ENV_KEYS,
      'SVA_MOCK_AUTH',
      'VITE_MOCK_AUTH',
      'VITE_PUBLIC_BUILDER_KEY',
    ],
    usesBuilder: true,
  },
  'acceptance-hb': {
    authMode: 'keycloak',
    description: 'Serverbetrieb fuer HB-Abnahme mit produktionsnaher Realm-Anbindung.',
    isLocal: false,
    requiredEnvKeys: [
      ...COMMON_REQUIRED_ENV_KEYS,
      'SVA_AUTH_ISSUER',
      'SVA_AUTH_CLIENT_ID',
      'SVA_AUTH_STATE_SECRET',
      'SVA_AUTH_REDIRECT_URI',
      'SVA_AUTH_POST_LOGOUT_REDIRECT_URI',
      'KEYCLOAK_ADMIN_BASE_URL',
      'KEYCLOAK_ADMIN_REALM',
      'KEYCLOAK_ADMIN_CLIENT_ID',
      'SVA_PARENT_DOMAIN',
    ],
    usesBuilder: false,
  },
} satisfies Record<RuntimeProfile, RuntimeProfileDefinition>;

const PLACEHOLDER_PREFIXES = ['__SET_', '__REQUIRED_', '__OVERRIDE_'] as const;

const isPlaceholderValue = (value: string | undefined) =>
  typeof value === 'string' &&
  PLACEHOLDER_PREFIXES.some((prefix) => value.startsWith(prefix));

const readEnvValue = (env: NodeJS.ProcessEnv, key: string) => {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const isJsonObjectValue = (value: string) => {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
};

const isRuntimeEnvValueInvalid = (key: string, value: string) => {
  switch (key) {
    case 'IAM_PII_KEYRING_JSON':
      return !isJsonObjectValue(value);
    default:
      return false;
  }
};

export const parseRuntimeProfile = (value: string | undefined): RuntimeProfile | null => {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim();
  return (RUNTIME_PROFILES as readonly string[]).includes(normalized)
    ? (normalized as RuntimeProfile)
    : null;
};

export const getRuntimeProfileFromEnv = (env: NodeJS.ProcessEnv): RuntimeProfile | null =>
  parseRuntimeProfile(env.SVA_RUNTIME_PROFILE) ?? parseRuntimeProfile(env.VITE_SVA_RUNTIME_PROFILE);

export const getRuntimeProfileDefinition = (profile: RuntimeProfile): RuntimeProfileDefinition =>
  PROFILE_DEFINITIONS[profile];

export const getRuntimeProfileRequiredEnvKeys = (profile: RuntimeProfile): readonly string[] =>
  PROFILE_DEFINITIONS[profile].requiredEnvKeys;

export const isMockAuthRuntimeProfile = (profile: RuntimeProfile) =>
  PROFILE_DEFINITIONS[profile].authMode === 'mock';

export const validateRuntimeProfileEnv = (
  profile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
): RuntimeProfileEnvValidationResult => {
  const invalid: string[] = [];
  const missing: string[] = [];
  const placeholders: string[] = [];

  for (const key of PROFILE_DEFINITIONS[profile].requiredEnvKeys) {
    const value = readEnvValue(env, key);

    if (value.length === 0) {
      missing.push(key);
      continue;
    }

    if (isPlaceholderValue(value)) {
      placeholders.push(key);
      continue;
    }

    if (isRuntimeEnvValueInvalid(key, value)) {
      invalid.push(key);
    }
  }

  return { invalid, missing, placeholders };
};
