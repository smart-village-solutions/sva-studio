import { afterEach, describe, expect, it } from 'vitest';

import { createMockSessionUser, isMockAuthEnabled } from './mock-auth.js';

const originalEnv = { ...process.env };

describe('auth-runtime mock auth', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('enables mock auth outside production when explicitly requested', () => {
    process.env.NODE_ENV = 'development';
    process.env.SVA_MOCK_AUTH = 'true';
    delete process.env.SVA_RUNTIME_PROFILE;
    delete process.env.SVA_DEV_AUTH;

    expect(isMockAuthEnabled()).toBe(true);
  });

  it('enables dev auth outside production when explicitly requested via the new flag', () => {
    process.env.NODE_ENV = 'development';
    process.env.SVA_DEV_AUTH = 'true';
    delete process.env.SVA_RUNTIME_PROFILE;
    delete process.env.SVA_MOCK_AUTH;

    expect(isMockAuthEnabled()).toBe(true);
  });

  it('requires an allowed runtime profile in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SVA_MOCK_AUTH = 'true';
    delete process.env.SVA_RUNTIME_PROFILE;

    expect(isMockAuthEnabled()).toBe(false);
  });

  it('creates a configured mock session user', () => {
    process.env.SVA_MOCK_AUTH_USER_ID = 'mock-user';
    process.env.SVA_MOCK_AUTH_INSTANCE_ID = 'de-test';
    process.env.SVA_MOCK_AUTH_ROLES = 'system_admin, support_admin';

    expect(createMockSessionUser()).toEqual({
      id: 'mock-user',
      instanceId: 'de-test',
      roles: ['system_admin', 'support_admin'],
    });
  });

  it('creates the new local dev auth defaults when no explicit user is configured', () => {
    delete process.env.SVA_MOCK_AUTH_USER_ID;
    delete process.env.SVA_MOCK_AUTH_INSTANCE_ID;
    delete process.env.SVA_MOCK_AUTH_ROLES;

    expect(createMockSessionUser()).toEqual({
      id: 'dev:local-admin',
      instanceId: 'de-musterhausen',
      roles: ['system_admin'],
    });
  });
});
