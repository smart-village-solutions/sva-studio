import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getAppDbPassword,
  getAuthClientSecret,
  getAuthStateSecret,
  getIamDatabaseUrl,
  getKeycloakAdminClientSecret,
  getKeycloakProvisionerClientSecret,
  getMediaStorageAccessKeyId,
  getMediaStorageBucket,
  getMediaStorageEndpoint,
  getMediaStoragePublicBaseUrl,
  getMediaStorageRegion,
  getMediaStorageSecretAccessKey,
  getMediaStorageSignedUrlTtlSeconds,
  getRedisPassword,
  getRedisUrl,
} from './runtime-secrets.js';

describe('auth runtime secrets', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads trimmed env secrets and provisioner fallback values', () => {
    vi.stubEnv('SVA_AUTH_CLIENT_SECRET', ' auth-secret ');
    vi.stubEnv('SVA_AUTH_STATE_SECRET', ' state-secret ');
    vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_SECRET', ' admin-secret ');
    vi.stubEnv('REDIS_PASSWORD', ' redis-secret ');

    expect(getAuthClientSecret()).toBe('auth-secret');
    expect(getAuthStateSecret()).toBe('state-secret');
    expect(getKeycloakAdminClientSecret()).toBe('admin-secret');
    expect(getKeycloakProvisionerClientSecret()).toBe('admin-secret');
    expect(getRedisPassword()).toBe('redis-secret');

    vi.stubEnv('KEYCLOAK_PROVISIONER_CLIENT_SECRET', ' provisioner-secret ');
    expect(getKeycloakProvisionerClientSecret()).toBe('provisioner-secret');
  });

  it('derives IAM database urls with encoded credentials when explicit urls are absent or invalid', () => {
    vi.stubEnv('IAM_DATABASE_URL', 'postgres://user:pass@localhost:5432/db');
    expect(getIamDatabaseUrl()).toBe('postgres://user:pass@localhost:5432/db');

    vi.stubEnv('IAM_DATABASE_URL', 'not a url');
    vi.stubEnv('APP_DB_PASSWORD', 'p@ss word');
    vi.stubEnv('APP_DB_USER', 'sva user');
    vi.stubEnv('POSTGRES_DB', 'studio db');
    expect(getIamDatabaseUrl()).toBe('postgres://sva%20user:p%40ss%20word@postgres:5432/studio%20db');

    vi.stubEnv('APP_DB_PASSWORD', '');
    vi.stubEnv('POSTGRES_PASSWORD', '');
    expect(getAppDbPassword()).toBeUndefined();
  });

  it('chooses redis urls from explicit env, local runtime profiles or container defaults', () => {
    vi.stubEnv('REDIS_URL', ' redis://custom:6379 ');
    expect(getRedisUrl()).toBe('redis://custom:6379');

    vi.stubEnv('REDIS_URL', '');
    vi.stubEnv('SVA_RUNTIME_PROFILE', 'local-builder');
    expect(getRedisUrl()).toBe('redis://localhost:6379');

    vi.stubEnv('SVA_RUNTIME_PROFILE', 'production');
    expect(getRedisUrl()).toBe('redis://redis:6379');
  });

  it('reads media storage configuration and clamps signed-url ttl values', () => {
    vi.stubEnv('MEDIA_STORAGE_ENDPOINT', ' https://minio.example.test ');
    vi.stubEnv('MEDIA_STORAGE_BUCKET', ' media-bucket ');
    vi.stubEnv('MEDIA_STORAGE_ACCESS_KEY_ID', ' access-key ');
    vi.stubEnv('MEDIA_STORAGE_SECRET_ACCESS_KEY', ' secret-key ');
    vi.stubEnv('MEDIA_STORAGE_PUBLIC_BASE_URL', 'https://cdn.example.test/media/');
    vi.stubEnv('MEDIA_STORAGE_SIGNED_URL_TTL_SECONDS', '7200');
    vi.stubEnv('MEDIA_STORAGE_REGION', 'eu-west-1');

    expect(getMediaStorageEndpoint()).toBe('https://minio.example.test');
    expect(getMediaStorageBucket()).toBe('media-bucket');
    expect(getMediaStorageAccessKeyId()).toBe('access-key');
    expect(getMediaStorageSecretAccessKey()).toBe('secret-key');
    expect(getMediaStoragePublicBaseUrl()).toBe('https://cdn.example.test/media');
    expect(getMediaStorageSignedUrlTtlSeconds()).toBe(3600);
    expect(getMediaStorageRegion()).toBe('eu-west-1');

    vi.stubEnv('MEDIA_STORAGE_SIGNED_URL_TTL_SECONDS', '-10');
    expect(getMediaStorageSignedUrlTtlSeconds()).toBe(900);
  });
});
