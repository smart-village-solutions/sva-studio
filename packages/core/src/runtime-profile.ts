import { PROFILE_DEFINITIONS, RUNTIME_PROFILES } from './runtime-profile-definitions.js';
import type {
  RuntimeProfile,
  RuntimeProfileDefinition,
  RuntimeProfileEnvValidationResult,
} from './runtime-profile-definitions.js';

export { RUNTIME_PROFILES } from './runtime-profile-definitions.js';
export type {
  RuntimeProfile,
  RuntimeProfileAuthMode,
  RuntimeProfileDefinition,
  RuntimeProfileEnvValidationResult,
} from './runtime-profile-definitions.js';

const PLACEHOLDER_PREFIXES = ['__SET_', '__REQUIRED_', '__OVERRIDE_'] as const;

const isDisabledFlag = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized === 'false' || normalized === '0';
};

const isPlaceholderValue = (value: string | undefined) =>
  typeof value === 'string' && PLACEHOLDER_PREFIXES.some((prefix) => value.startsWith(prefix));

const readEnvValue = (env: NodeJS.ProcessEnv, key: string) => {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const hasAnyValue = (env: NodeJS.ProcessEnv, keys: readonly string[]) =>
  keys.some((key) => readEnvValue(env, key).length > 0);

const hasAllValues = (env: NodeJS.ProcessEnv, keys: readonly string[]) =>
  keys.every((key) => readEnvValue(env, key).length > 0);

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

export const getRuntimeProfileDerivedEnvKeys = (profile: RuntimeProfile): readonly string[] =>
  PROFILE_DEFINITIONS[profile].isLocal ? [] : ['IAM_DATABASE_URL', 'REDIS_URL'];

export const isMockAuthRuntimeProfile = (profile: RuntimeProfile) =>
  PROFILE_DEFINITIONS[profile].authMode === 'mock';

const collectRequiredEnvValidation = (
  keys: readonly string[],
  env: NodeJS.ProcessEnv,
  result: RuntimeProfileEnvValidationResult
): void => {
  for (const key of keys) {
    const value = readEnvValue(env, key);

    if (value.length === 0) {
      result.missing.push(key);
      continue;
    }

    if (isPlaceholderValue(value)) {
      result.placeholders.push(key);
      continue;
    }

    if (isRuntimeEnvValueInvalid(key, value)) {
      result.invalid.push(key);
    }
  }
};

const collectOptionalOtelValidation = (
  env: NodeJS.ProcessEnv,
  result: RuntimeProfileEnvValidationResult
): void => {
  if (isDisabledFlag(readEnvValue(env, 'ENABLE_OTEL'))) {
    return;
  }

  const otelEndpoint = readEnvValue(env, 'OTEL_EXPORTER_OTLP_ENDPOINT');
  if (otelEndpoint.length === 0) {
    result.missing.push('OTEL_EXPORTER_OTLP_ENDPOINT');
    return;
  }

  if (isPlaceholderValue(otelEndpoint)) {
    result.placeholders.push('OTEL_EXPORTER_OTLP_ENDPOINT');
  }
};

const collectDerivedRemoteEnvValidation = (
  env: NodeJS.ProcessEnv,
  result: RuntimeProfileEnvValidationResult
): void => {
  const explicitIamDatabaseUrl = readEnvValue(env, 'IAM_DATABASE_URL');
  if (explicitIamDatabaseUrl.length === 0) {
    if (
      hasAllValues(env, ['APP_DB_USER', 'POSTGRES_DB']) &&
      hasAnyValue(env, ['APP_DB_PASSWORD', 'POSTGRES_PASSWORD'])
    ) {
      result.derived.push('IAM_DATABASE_URL');
    } else {
      result.missing.push('IAM_DATABASE_URL');
    }
  } else if (isPlaceholderValue(explicitIamDatabaseUrl)) {
    result.placeholders.push('IAM_DATABASE_URL');
  }

  const explicitRedisUrl = readEnvValue(env, 'REDIS_URL');
  if (explicitRedisUrl.length === 0) {
    if (hasAllValues(env, ['REDIS_PASSWORD'])) {
      result.derived.push('REDIS_URL');
    } else {
      result.missing.push('REDIS_URL');
    }
  } else if (isPlaceholderValue(explicitRedisUrl)) {
    result.placeholders.push('REDIS_URL');
  }
};

export const validateRuntimeProfileEnv = (
  profile: RuntimeProfile,
  env: NodeJS.ProcessEnv
): RuntimeProfileEnvValidationResult => {
  const result: RuntimeProfileEnvValidationResult = {
    derived: [],
    invalid: [],
    missing: [],
    placeholders: [],
  };

  const definition = PROFILE_DEFINITIONS[profile];
  collectRequiredEnvValidation(definition.requiredEnvKeys, env, result);
  collectOptionalOtelValidation(env, result);

  if (!definition.isLocal) {
    collectDerivedRemoteEnvValidation(env, result);
  }

  return {
    derived: [...new Set(result.derived)],
    invalid: [...new Set(result.invalid)],
    missing: [...new Set(result.missing)],
    placeholders: [...new Set(result.placeholders)],
  };
};
