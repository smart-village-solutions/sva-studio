import { readFileSync } from 'node:fs';

const readSecretFile = (secretName: string): string | undefined => {
  try {
    const value = readFileSync(`/run/secrets/${secretName}`, 'utf8').trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
};

const readFirstEnv = (...envNames: string[]): string | undefined => {
  for (const envName of envNames) {
    const envValue = process.env[envName]?.trim();
    if (envValue) {
      return envValue;
    }
  }
  return undefined;
};

const readEnvOrSecret = (envNames: readonly string[], secretName: string): string | undefined => {
  const envValue = readFirstEnv(...envNames);
  if (envValue) {
    return envValue;
  }
  return readSecretFile(secretName);
};

const LOCAL_RUNTIME_PROFILES = new Set(['local-builder', 'local-keycloak']);

export const getAuthClientSecret = (): string | undefined =>
  readEnvOrSecret(['SVA_AUTH_CLIENT_SECRET'], 'sva_studio_app_auth_client_secret');

export const getAuthStateSecret = (): string | undefined =>
  readEnvOrSecret(['SVA_AUTH_STATE_SECRET'], 'sva_studio_app_auth_state_secret');

export const getAppDbPassword = (): string | undefined =>
  readEnvOrSecret(['APP_DB_PASSWORD', 'POSTGRES_PASSWORD'], 'sva_studio_app_db_password');

export const getRedisPassword = (): string | undefined =>
  readEnvOrSecret(['REDIS_PASSWORD'], 'sva_studio_redis_password');

const ensureValidDatabaseUrl = (databaseUrl: string | undefined): string | undefined => {
  if (!databaseUrl) {
    return undefined;
  }

  return new URL(databaseUrl).toString();
};

const buildDerivedIamDatabaseUrl = (): string | undefined => {
  const password = getAppDbPassword();
  if (!password) {
    return undefined;
  }

  const user = process.env.APP_DB_USER?.trim() || 'sva_app';
  const database = process.env.POSTGRES_DB?.trim() || 'sva_studio';
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@postgres:5432/${encodeURIComponent(database)}`;
};

export const getIamDatabaseUrl = (): string | undefined => {
  const databaseUrl = process.env.IAM_DATABASE_URL?.trim();
  if (databaseUrl) {
    try {
      return ensureValidDatabaseUrl(databaseUrl);
    } catch {
      // Fall back to the encoded runtime derivation if an explicit URL contains raw special characters.
    }
  }

  return buildDerivedIamDatabaseUrl();
};

export const getRedisUrl = (): string => {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    return redisUrl;
  }

  const runtimeProfile = process.env.SVA_RUNTIME_PROFILE?.trim();
  if (runtimeProfile && LOCAL_RUNTIME_PROFILES.has(runtimeProfile)) {
    return 'redis://localhost:6379';
  }

  return 'redis://redis:6379';
};
