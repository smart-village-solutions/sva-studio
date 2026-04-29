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

export const getKeycloakAdminClientSecret = (): string | undefined =>
  readEnvOrSecret(['KEYCLOAK_ADMIN_CLIENT_SECRET'], 'sva_studio_keycloak_admin_client_secret');

export const getKeycloakProvisionerClientSecret = (): string | undefined => {
  const provisionerClientSecret = readEnvOrSecret(
    ['KEYCLOAK_PROVISIONER_CLIENT_SECRET'],
    'sva_studio_keycloak_provisioner_client_secret'
  );

  return provisionerClientSecret ?? getKeycloakAdminClientSecret();
};

export const getAppDbPassword = (): string | undefined =>
  readEnvOrSecret(['APP_DB_PASSWORD', 'POSTGRES_PASSWORD'], 'sva_studio_app_db_password');

export const getRedisPassword = (): string | undefined =>
  readEnvOrSecret(['REDIS_PASSWORD'], 'sva_studio_redis_password');

export const getMediaStorageEndpoint = (): string | undefined =>
  readEnvOrSecret(['MEDIA_STORAGE_ENDPOINT', 'S3_ENDPOINT'], 'sva_studio_media_storage_endpoint');

export const getMediaStorageRegion = (): string =>
  readFirstEnv('MEDIA_STORAGE_REGION', 'AWS_REGION', 'AWS_DEFAULT_REGION') ?? 'eu-central-1';

export const getMediaStorageBucket = (): string | undefined =>
  readEnvOrSecret(['MEDIA_STORAGE_BUCKET', 'S3_BUCKET'], 'sva_studio_media_storage_bucket');

export const getMediaStorageAccessKeyId = (): string | undefined =>
  readEnvOrSecret(['MEDIA_STORAGE_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID'], 'sva_studio_media_storage_access_key_id');

export const getMediaStorageSecretAccessKey = (): string | undefined =>
  readEnvOrSecret(
    ['MEDIA_STORAGE_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY'],
    'sva_studio_media_storage_secret_access_key'
  );

export const getMediaStoragePublicBaseUrl = (): string | undefined => {
  const value = readFirstEnv('MEDIA_STORAGE_PUBLIC_BASE_URL');
  if (!value) {
    return undefined;
  }
  return new URL(value).toString().replace(/\/$/, '');
};

export const getMediaStorageSignedUrlTtlSeconds = (): number => {
  const raw = readFirstEnv('MEDIA_STORAGE_SIGNED_URL_TTL_SECONDS');
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 900;
  }
  return Math.min(Math.floor(parsed), 3600);
};

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
