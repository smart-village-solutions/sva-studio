import { describe, expect, it } from 'vitest';

import {
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
      REDIS_URL: 'redis://localhost:6379',
      IAM_DATABASE_URL: 'postgres://localhost/sva',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
      SVA_MAINSERVER_GRAPHQL_URL: 'https://mainserver.example/graphql',
      SVA_MAINSERVER_OAUTH_TOKEN_URL: 'https://mainserver.example/oauth/token',
      SVA_MAINSERVER_CLIENT_ID: 'client-id',
      SVA_MAINSERVER_CLIENT_SECRET: 'client-secret',
      SVA_AUTH_ISSUER: 'https://keycloak.example/realms/demo',
      SVA_AUTH_CLIENT_ID: 'studio',
      SVA_AUTH_STATE_SECRET: 'state-secret',
      SVA_AUTH_REDIRECT_URI: 'https://hb.example.app/auth/callback',
      SVA_AUTH_POST_LOGOUT_REDIRECT_URI: 'https://hb.example.app',
      KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example',
      KEYCLOAK_ADMIN_REALM: 'demo',
      KEYCLOAK_ADMIN_CLIENT_ID: 'svc-client',
      SVA_ALLOWED_INSTANCE_IDS: 'de-musterhausen',
      SVA_PARENT_DOMAIN: 'hb.example.app',
      IAM_PII_KEYRING_JSON: '{k1:broken}',
    });

    expect(result.invalid).toContain('IAM_PII_KEYRING_JSON');
    expect(result.missing).not.toContain('IAM_PII_KEYRING_JSON');
    expect(result.placeholders).toEqual([]);
  });
});
