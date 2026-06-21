import { describe, expect, it } from 'vitest';

import {
  DE_MUSTERHAUSEN_AUTH_SESSION_FILE,
  ROOT_AUTH_SESSION_FILE,
  getDeMusterhausenAuthSetupEnv,
  getDeMusterhausenPlaywrightBaseUrl,
  getRootAuthSetupEnv,
  getRootPlaywrightBaseUrl,
  hasDeMusterhausenAuthSetupCredentials,
  hasRealAuthSetupCredentials,
  hasRootAuthSetupCredentials,
  unauthenticatedStorageState,
} from './playwright-auth-session-config';

describe('playwright auth session config', () => {
  it('reads root auth setup credentials from scoped environment variables', () => {
    expect(
      getRootAuthSetupEnv({
        PLAYWRIGHT_ROOT_BASE_URL: 'https://studio.example.test',
        PLAYWRIGHT_ROOT_PASSWORD: 'super-secret',
        PLAYWRIGHT_ROOT_USERNAME: 'root@example.test',
      })
    ).toEqual({
      baseUrl: 'https://studio.example.test',
      password: 'super-secret',
      username: 'root@example.test',
    });
  });

  it('falls back to the shared Playwright base url for root auth when no root host is set', () => {
    expect(
      getRootAuthSetupEnv({
        PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:4173',
        PLAYWRIGHT_ROOT_PASSWORD: 'super-secret',
        PLAYWRIGHT_ROOT_USERNAME: 'root@example.test',
      }).baseUrl
    ).toBe('http://127.0.0.1:4173');
  });

  it('ignores empty scoped base urls and uses the shared Playwright base url instead', () => {
    expect(
      getRootAuthSetupEnv({
        PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:4173',
        PLAYWRIGHT_ROOT_BASE_URL: '',
        PLAYWRIGHT_ROOT_PASSWORD: 'super-secret',
        PLAYWRIGHT_ROOT_USERNAME: 'root@example.test',
      }).baseUrl
    ).toBe('http://127.0.0.1:4173');
  });

  it('reads the de-musterhausen auth setup credentials from dedicated tenant variables', () => {
    expect(
      getDeMusterhausenAuthSetupEnv({
        PLAYWRIGHT_DE_MUSTERHAUSEN_BASE_URL: 'http://de-musterhausen.studio.localhost:3000',
        PLAYWRIGHT_DE_MUSTERHAUSEN_PASSWORD: 'tenant-secret',
        PLAYWRIGHT_DE_MUSTERHAUSEN_USERNAME: 'editor@example.test',
      })
    ).toEqual({
      baseUrl: 'http://de-musterhausen.studio.localhost:3000',
      password: 'tenant-secret',
      username: 'editor@example.test',
    });
  });

  it('throws a descriptive error when required root auth env vars are missing', () => {
    expect(() => getRootAuthSetupEnv({ PLAYWRIGHT_ROOT_USERNAME: 'root@example.test' })).toThrowError(
      'Missing Playwright root auth environment variables: PLAYWRIGHT_ROOT_PASSWORD'
    );
  });

  it('treats generic app auth env without dedicated Playwright users as insufficient for real auth setup', () => {
    expect(
      hasRealAuthSetupCredentials({
        PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:4173',
        SVA_AUTH_CLIENT_ID: 'gha-e2e-client',
        SVA_AUTH_CLIENT_SECRET: 'gha-e2e-secret',
        SVA_AUTH_ISSUER: 'https://accounts.google.com',
      })
    ).toBe(false);
  });

  it('requires both scoped Playwright credential pairs for the real auth setup', () => {
    const env = {
      PLAYWRIGHT_DE_MUSTERHAUSEN_PASSWORD: 'tenant-secret',
      PLAYWRIGHT_DE_MUSTERHAUSEN_USERNAME: 'editor@example.test',
      PLAYWRIGHT_ROOT_PASSWORD: 'super-secret',
      PLAYWRIGHT_ROOT_USERNAME: 'root@example.test',
    };

    expect(hasRootAuthSetupCredentials(env)).toBe(true);
    expect(hasDeMusterhausenAuthSetupCredentials(env)).toBe(true);
    expect(hasRealAuthSetupCredentials(env)).toBe(true);
  });

  it('resolves the scoped Playwright base urls from the configured port when no explicit host is set', () => {
    expect(getRootPlaywrightBaseUrl({ PLAYWRIGHT_PORT: '4300' })).toBe('http://127.0.0.1:4300');
    expect(getDeMusterhausenPlaywrightBaseUrl({ PLAYWRIGHT_PORT: '4300' })).toBe('http://127.0.0.1:4300');
  });

  it('exports the scoped auth session files and empty unauthenticated storage state', () => {
    expect(ROOT_AUTH_SESSION_FILE).toBe('playwright/.auth/root-user.json');
    expect(DE_MUSTERHAUSEN_AUTH_SESSION_FILE).toBe('playwright/.auth/de-musterhausen-user.json');
    expect(unauthenticatedStorageState).toEqual({
      cookies: [],
      origins: [],
    });
  });
});
