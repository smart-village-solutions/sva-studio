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
    process.env.SVA_MOCK_AUTH_ROLES = 'editor, support_admin';

    expect(createMockSessionUser()).toEqual({
      id: 'mock-user',
      instanceId: 'de-test',
      roles: ['editor', 'support_admin'],
    });
  });
});
