import { describe, expect, it } from 'vitest';

import {
  getRuntimeProfileDerivedEnvKeys,
  getRuntimeProfileDefinition,
  getRuntimeProfileFromEnv,
  getRuntimeProfileRequiredEnvKeys,
  isMockAuthRuntimeProfile,
  parseRuntimeProfile,
  validateRuntimeProfileEnv,
} from '../src/runtime-profile';

describe('runtime-profile', () => {
  it('parses supported profiles', () => {
    expect(parseRuntimeProfile('local-keycloak')).toBe('local-keycloak');
    expect(parseRuntimeProfile('local-builder')).toBe('local-builder');
    expect(parseRuntimeProfile('acceptance-hb')).toBe('acceptance-hb');
    expect(parseRuntimeProfile('studio')).toBe('studio');
    expect(parseRuntimeProfile('unknown')).toBeNull();
  });

  it('resolves the runtime profile from env', () => {
    expect(getRuntimeProfileFromEnv({ SVA_RUNTIME_PROFILE: 'local-builder' })).toBe('local-builder');
    expect(getRuntimeProfileFromEnv({ VITE_SVA_RUNTIME_PROFILE: 'acceptance-hb' })).toBe('acceptance-hb');
    expect(getRuntimeProfileFromEnv({})).toBeNull();
  });

  it('marks the builder profile as mock-auth based', () => {
    expect(isMockAuthRuntimeProfile('local-builder')).toBe(true);
    expect(isMockAuthRuntimeProfile('local-keycloak')).toBe(false);
  });

  it('exposes required env keys per profile', () => {
    expect(getRuntimeProfileRequiredEnvKeys('local-builder')).toContain('VITE_PUBLIC_BUILDER_KEY');
    expect(getRuntimeProfileRequiredEnvKeys('acceptance-hb')).toContain('SVA_PARENT_DOMAIN');
    expect(getRuntimeProfileRequiredEnvKeys('acceptance-hb')).toContain('SVA_AUTH_STATE_SECRET');
    expect(getRuntimeProfileRequiredEnvKeys('studio')).toContain('SVA_PARENT_DOMAIN');
    expect(getRuntimeProfileRequiredEnvKeys('studio')).toContain('KEYCLOAK_ADMIN_CLIENT_SECRET');
    expect(getRuntimeProfileDerivedEnvKeys('local-builder')).toEqual([]);
    expect(getRuntimeProfileDerivedEnvKeys('studio')).toEqual(['IAM_DATABASE_URL', 'REDIS_URL']);
  });

  it('returns runtime profile definitions', () => {
    expect(getRuntimeProfileDefinition('local-keycloak')).toEqual(
      expect.objectContaining({
        authMode: 'keycloak',
        isLocal: true,
        usesBuilder: false,
      }),
    );
  });

  it('reports missing and placeholder env values', () => {
    const result = validateRuntimeProfileEnv('local-builder', {
      SVA_RUNTIME_PROFILE: 'local-builder',
      SVA_PUBLIC_BASE_URL: 'http://localhost:3000',
      REDIS_URL: 'redis://localhost:6379',
      IAM_DATABASE_URL: 'postgres://localhost/sva',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
      SVA_MAINSERVER_GRAPHQL_URL: 'https://mainserver.example/graphql',
      SVA_MAINSERVER_OAUTH_TOKEN_URL: 'https://mainserver.example/oauth/token',
      SVA_MAINSERVER_CLIENT_ID: '__SET_IN_LOCAL_OVERRIDE__',
      SVA_MAINSERVER_CLIENT_SECRET: '__SET_IN_LOCAL_OVERRIDE__',
      KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example.com',
      KEYCLOAK_ADMIN_REALM: 'demo',
      KEYCLOAK_ADMIN_CLIENT_ID: 'svc-client',
      KEYCLOAK_ADMIN_CLIENT_SECRET: '',
      SVA_MOCK_AUTH: 'true',
      VITE_MOCK_AUTH: 'true',
      VITE_PUBLIC_BUILDER_KEY: '__SET_IN_LOCAL_OVERRIDE__',
    });

    expect(result.invalid).toEqual([]);
    expect(result.derived).toEqual([]);
    expect(result.missing).toContain('KEYCLOAK_ADMIN_CLIENT_SECRET');
    expect(result.placeholders).toEqual(
      expect.arrayContaining([
        'SVA_MAINSERVER_CLIENT_ID',
        'SVA_MAINSERVER_CLIENT_SECRET',
        'VITE_PUBLIC_BUILDER_KEY',
      ]),
    );
  });

  it('reports invalid runtime env values', () => {
    const result = validateRuntimeProfileEnv('acceptance-hb', {
      SVA_RUNTIME_PROFILE: 'acceptance-hb',
      SVA_PUBLIC_BASE_URL: 'https://hb.example.app',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
      SVA_MAINSERVER_GRAPHQL_URL: 'https://mainserver.example/graphql',
      SVA_MAINSERVER_OAUTH_TOKEN_URL: 'https://mainserver.example/oauth/token',
      SVA_MAINSERVER_CLIENT_ID: 'client-id',
      SVA_MAINSERVER_CLIENT_SECRET: 'client-secret',
      SVA_AUTH_CLIENT_SECRET: 'tenant-client-secret',
      SVA_AUTH_STATE_SECRET: 'state-secret',
      SVA_AUTH_REDIRECT_URI: 'https://hb.example.app/auth/callback',
      SVA_AUTH_POST_LOGOUT_REDIRECT_URI: 'https://hb.example.app',
      KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example',
      KEYCLOAK_ADMIN_REALM: 'demo',
      KEYCLOAK_ADMIN_CLIENT_ID: 'svc-client',
      KEYCLOAK_ADMIN_CLIENT_SECRET: 'svc-secret',
      SVA_ALLOWED_INSTANCE_IDS: 'de-musterhausen',
      SVA_PARENT_DOMAIN: 'hb.example.app',
      POSTGRES_DB: 'sva_studio',
      POSTGRES_USER: 'sva',
      POSTGRES_PASSWORD: 'postgres-secret',
      APP_DB_USER: 'sva_app',
      APP_DB_PASSWORD: 'app-secret',
      REDIS_PASSWORD: 'redis-secret',
      SVA_STACK_NAME: 'studio',
      QUANTUM_ENDPOINT: 'sva',
      IAM_PII_KEYRING_JSON: '{k1:broken}',
    });

    expect(result.derived).toEqual(expect.arrayContaining(['IAM_DATABASE_URL', 'REDIS_URL']));
    expect(result.invalid).toContain('IAM_PII_KEYRING_JSON');
    expect(result.missing).not.toContain('IAM_PII_KEYRING_JSON');
    expect(result.placeholders).toEqual([]);
  });

  it('skips the OTEL endpoint requirement when OTEL is disabled explicitly', () => {
    const result = validateRuntimeProfileEnv('studio', {
      SVA_RUNTIME_PROFILE: 'studio',
      SVA_PUBLIC_BASE_URL: 'https://studio.example.app',
      ENABLE_OTEL: 'false',
      SVA_MAINSERVER_GRAPHQL_URL: 'https://mainserver.example/graphql',
      SVA_MAINSERVER_OAUTH_TOKEN_URL: 'https://mainserver.example/oauth/token',
      SVA_MAINSERVER_CLIENT_ID: 'client-id',
      SVA_MAINSERVER_CLIENT_SECRET: 'client-secret',
      SVA_AUTH_CLIENT_SECRET: 'tenant-client-secret',
      SVA_AUTH_STATE_SECRET: 'state-secret',
      SVA_AUTH_REDIRECT_URI: 'https://studio.example.app/auth/callback',
      SVA_AUTH_POST_LOGOUT_REDIRECT_URI: 'https://studio.example.app',
      KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example',
      KEYCLOAK_ADMIN_REALM: 'demo',
      KEYCLOAK_ADMIN_CLIENT_ID: 'svc-client',
      KEYCLOAK_ADMIN_CLIENT_SECRET: 'svc-secret',
      SVA_PARENT_DOMAIN: 'studio.example.app',
      POSTGRES_DB: 'sva_studio',
      POSTGRES_USER: 'sva',
      POSTGRES_PASSWORD: 'postgres-secret',
      APP_DB_USER: 'sva_app',
      APP_DB_PASSWORD: 'app-secret',
      REDIS_PASSWORD: 'redis-secret',
      SVA_STACK_NAME: 'studio',
      QUANTUM_ENDPOINT: 'sva',
      IAM_PII_ACTIVE_KEY_ID: 'active',
      IAM_PII_KEYRING_JSON: '{"active":"secret"}',
      ENCRYPTION_KEY: 'encryption-key',
    });

    expect(result.missing).not.toContain('OTEL_EXPORTER_OTLP_ENDPOINT');
    expect(result.derived).toEqual(expect.arrayContaining(['IAM_DATABASE_URL', 'REDIS_URL']));
  });

  it('skips the OTEL endpoint requirement when OTEL is disabled via 0', () => {
    const env = {
      SVA_RUNTIME_PROFILE: 'studio',
      SVA_PUBLIC_BASE_URL: 'https://studio.example.app',
      ENABLE_OTEL: '0',
      SVA_MAINSERVER_GRAPHQL_URL: 'https://mainserver.example/graphql',
      SVA_MAINSERVER_OAUTH_TOKEN_URL: 'https://mainserver.example/oauth/token',
      SVA_MAINSERVER_CLIENT_ID: 'client-id',
      SVA_MAINSERVER_CLIENT_SECRET: 'client-secret',
      SVA_AUTH_CLIENT_SECRET: 'tenant-client-secret',
      SVA_AUTH_STATE_SECRET: 'state-secret',
      SVA_AUTH_REDIRECT_URI: 'https://studio.example.app/auth/callback',
      SVA_AUTH_POST_LOGOUT_REDIRECT_URI: 'https://studio.example.app',
      KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example',
      KEYCLOAK_ADMIN_REALM: 'demo',
      KEYCLOAK_ADMIN_CLIENT_ID: 'svc-client',
      KEYCLOAK_ADMIN_CLIENT_SECRET: 'svc-secret',
      SVA_PARENT_DOMAIN: 'studio.example.app',
      POSTGRES_DB: 'sva_studio',
      POSTGRES_USER: 'sva',
      POSTGRES_PASSWORD: 'postgres-secret',
      APP_DB_USER: 'sva_app',
      APP_DB_PASSWORD: 'app-secret',
      REDIS_PASSWORD: 'redis-secret',
      SVA_STACK_NAME: 'studio',
      QUANTUM_ENDPOINT: 'sva',
      IAM_PII_ACTIVE_KEY_ID: 'active',
      IAM_PII_KEYRING_JSON: '{"active":"secret"}',
      ENCRYPTION_KEY: 'encryption-key',
    } satisfies NodeJS.ProcessEnv;

    expect(validateRuntimeProfileEnv('studio', env)).toEqual({
      missing: [],
      derived: ['IAM_DATABASE_URL', 'REDIS_URL'],
      placeholders: [],
      invalid: [],
    });
  });

  it('treats explicit remote derived values as placeholders when they still use rollout markers', () => {
    const result = validateRuntimeProfileEnv('studio', {
      SVA_RUNTIME_PROFILE: 'studio',
      SVA_PUBLIC_BASE_URL: 'https://studio.example.app',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otel.example/v1/logs',
      SVA_MAINSERVER_GRAPHQL_URL: 'https://mainserver.example/graphql',
      SVA_MAINSERVER_OAUTH_TOKEN_URL: 'https://mainserver.example/oauth/token',
      SVA_MAINSERVER_CLIENT_ID: 'client-id',
      SVA_MAINSERVER_CLIENT_SECRET: 'client-secret',
      SVA_AUTH_CLIENT_SECRET: 'tenant-client-secret',
      SVA_AUTH_STATE_SECRET: 'state-secret',
      SVA_AUTH_REDIRECT_URI: 'https://studio.example.app/auth/callback',
      SVA_AUTH_POST_LOGOUT_REDIRECT_URI: 'https://studio.example.app',
      KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example',
      KEYCLOAK_ADMIN_REALM: 'demo',
      KEYCLOAK_ADMIN_CLIENT_ID: 'svc-client',
      KEYCLOAK_ADMIN_CLIENT_SECRET: 'svc-secret',
      SVA_PARENT_DOMAIN: 'studio.example.app',
      POSTGRES_DB: 'sva_studio',
      POSTGRES_USER: 'sva',
      POSTGRES_PASSWORD: 'postgres-secret',
      APP_DB_USER: 'sva_app',
      APP_DB_PASSWORD: 'app-secret',
      REDIS_PASSWORD: 'redis-secret',
      SVA_STACK_NAME: 'studio',
      QUANTUM_ENDPOINT: 'sva',
      IAM_PII_ACTIVE_KEY_ID: 'active',
      IAM_PII_KEYRING_JSON: '{"active":"secret"}',
      ENCRYPTION_KEY: 'encryption-key',
      IAM_DATABASE_URL: '__SET_REMOTE_DATABASE_URL__',
      REDIS_URL: '__REQUIRED_REMOTE_REDIS_URL__',
    });

    expect(result.derived).toEqual([]);
    expect(result.placeholders).toEqual(expect.arrayContaining(['IAM_DATABASE_URL', 'REDIS_URL']));
  });
});
