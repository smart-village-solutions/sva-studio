import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMockSessionUser, isMockAuthEnabled } from './mock-auth.server';

describe('mock-auth.server', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('enables mock auth via vite flag', () => {
    vi.stubEnv('VITE_MOCK_AUTH', 'true');

    expect(isMockAuthEnabled()).toBe(true);
  });

  it('enables mock auth via the builder runtime profile', () => {
    vi.stubEnv('SVA_RUNTIME_PROFILE', 'local-builder');

    expect(isMockAuthEnabled()).toBe(true);
  });

  it('creates a privileged default mock user', () => {
    vi.stubEnv('VITE_MOCK_AUTH', 'true');

    expect(createMockSessionUser()).toEqual({
      id: 'seed:system_admin',
      name: 'Mock User',
      email: 'mock.user@sva.local',
      instanceId: 'de-musterhausen',
      roles: ['system_admin', 'iam_admin', 'support_admin', 'security_admin', 'interface_manager', 'app_manager', 'editor'],
    });
  });

  it('supports explicit env overrides', () => {
    vi.stubEnv('SVA_MOCK_AUTH', 'true');
    vi.stubEnv('SVA_MOCK_AUTH_USER_ID', 'builder-user');
    vi.stubEnv('SVA_MOCK_AUTH_USER_NAME', 'Builder User');
    vi.stubEnv('SVA_MOCK_AUTH_USER_EMAIL', 'builder.user@example.com');
    vi.stubEnv('SVA_MOCK_AUTH_INSTANCE_ID', 'de-builder');
    vi.stubEnv('SVA_MOCK_AUTH_ROLES', 'system_admin, editor');

    expect(createMockSessionUser()).toEqual({
      id: 'builder-user',
      name: 'Builder User',
      email: 'builder.user@example.com',
      instanceId: 'de-builder',
      roles: ['system_admin', 'editor'],
    });
  });
});
